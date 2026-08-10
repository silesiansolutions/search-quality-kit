import { loadHtml, metaContent } from "../utils/html.js";
import { normalizeUrl, sameOrigin } from "../utils/urls.js";
import { parseSitemap } from "./sitemaps.js";
import type { CrawlResult, PageArtifact, TextArtifact } from "./types.js";

export type StatusProvenance = "observed" | "assumed" | "unresolved";

export interface UrlNode {
  id: string;
  url: string;
  kind: "page" | "referenced" | "sitemap";
  status?: number;
  statusProvenance: StatusProvenance;
  sameOrigin: boolean;
  file?: string;
  pageIndex?: number;
  inAssets: boolean;
  noindex?: boolean;
  htmlLang?: string;
  canonicalHref?: string;
}

interface EdgeBase {
  from: string;
  to?: string;
  rawTarget: string;
}

export type UrlEdge =
  | (EdgeBase & { kind: "link" })
  | (EdgeBase & { kind: "canonical" })
  | (EdgeBase & { kind: "alternate"; hreflang: string })
  | (EdgeBase & { kind: "sitemap"; sitemapUrl: string; lastmod?: string })
  | (EdgeBase & { kind: "redirect"; detail: "collapsed" });

export interface UrlGraph {
  nodes: readonly UrlNode[];
  edges: readonly UrlEdge[];
  node(url: string): UrlNode | undefined;
  outgoing(kind: UrlEdge["kind"], from: string): UrlEdge[];
  incoming(kind: UrlEdge["kind"], to: string): UrlEdge[];
}

export function statusIsTrustworthy(
  node: UrlNode,
): node is UrlNode & { status: number } {
  return (
    node.statusProvenance === "observed" && typeof node.status === "number"
  );
}

function tryNormalize(value: string, base?: string): string | undefined {
  try {
    return normalizeUrl(value, base);
  } catch {
    return undefined;
  }
}

function tryResolve(
  href: string,
  base: string,
): { url: string; id: string } | undefined {
  try {
    const url = new URL(href, base).toString();
    return { url, id: normalizeUrl(url) };
  } catch {
    return undefined;
  }
}

function safeParseSitemap(content?: string) {
  try {
    return parseSitemap(content);
  } catch {
    return undefined;
  }
}

function relTokens(rel: string | undefined): string[] {
  return (rel ?? "")
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function isAlternateRel(rel: string | undefined): boolean {
  const tokens = relTokens(rel);
  return tokens.includes("alternate") && !tokens.includes("stylesheet");
}

function pushResolvableEdge(
  edges: UrlEdge[],
  knownUrls: Map<string, string>,
  extra: Record<string, unknown>,
  href: string,
  pageUrl: string,
) {
  const resolved = href ? tryResolve(href, pageUrl) : undefined;
  if (resolved && !knownUrls.has(resolved.id))
    knownUrls.set(resolved.id, resolved.url);
  edges.push({
    ...extra,
    rawTarget: href,
    ...(resolved ? { to: resolved.id } : {}),
  } as UrlEdge);
}

function collectPageEdges(
  html: string,
  p: PageArtifact,
  from: string,
  edges: UrlEdge[],
  knownUrls: Map<string, string>,
) {
  const $ = loadHtml(html);
  $("a").each((_, a) => {
    const href = ($(a).attr("href") ?? "").trim();
    pushResolvableEdge(edges, knownUrls, { kind: "link", from }, href, p.url);
  });
  $('link[rel~="canonical"]').each((_, link) => {
    const href = ($(link).attr("href") ?? "").trim();
    pushResolvableEdge(
      edges,
      knownUrls,
      { kind: "canonical", from },
      href,
      p.url,
    );
  });
  $("link[hreflang]").each((_, link) => {
    if (!isAlternateRel($(link).attr("rel"))) return;
    const hreflang = $(link).attr("hreflang") ?? "";
    const href = ($(link).attr("href") ?? "").trim();
    pushResolvableEdge(
      edges,
      knownUrls,
      { kind: "alternate", from, hreflang },
      href,
      p.url,
    );
  });
  return {
    noindex: pageNoindex($),
    htmlLang: $("html").first().attr("lang")?.trim() || undefined,
    canonicalHref:
      $('link[rel~="canonical"]').first().attr("href")?.trim() || undefined,
  };
}

function pageNoindex($: ReturnType<typeof loadHtml>): boolean {
  const robots =
    `${metaContent($, "robots") ?? ""},${metaContent($, "googlebot") ?? ""}`.toLowerCase();
  return /(?:^|[,\s])(?:noindex|none)(?:$|[,\s])/.test(robots);
}

function ensureReferenced(
  id: string,
  nodes: Map<string, UrlNode>,
  knownUrls: Map<string, string>,
  crawl: CrawlResult,
) {
  if (nodes.has(id)) return;
  const url = knownUrls.get(id) ?? id;
  nodes.set(id, {
    id,
    url,
    kind: "referenced",
    statusProvenance: "unresolved",
    sameOrigin: sameOrigin(url, crawl.publicBaseUrl),
    inAssets: crawl.assets.has(id),
  });
}

function buildGraph(crawl: CrawlResult): UrlGraph {
  const nodes = new Map<string, UrlNode>();
  const edges: UrlEdge[] = [];
  const knownUrls = new Map<string, string>();

  crawl.pages.forEach((p, pageIndex) => {
    const id = tryNormalize(p.url);
    if (!id) return;
    let parsed: ReturnType<typeof collectPageEdges> | undefined;
    try {
      parsed = collectPageEdges(p.html, p, id, edges, knownUrls);
    } catch {
      parsed = undefined;
    }
    nodes.set(id, {
      id,
      url: p.url,
      kind: "page",
      status: p.status,
      statusProvenance: crawl.mode === "static" ? "assumed" : "observed",
      sameOrigin: sameOrigin(p.url, crawl.publicBaseUrl),
      file: p.file,
      pageIndex,
      inAssets: crawl.assets.has(id),
      ...(parsed?.noindex === undefined ? {} : { noindex: parsed.noindex }),
      ...(parsed?.htmlLang ? { htmlLang: parsed.htmlLang } : {}),
      ...(parsed?.canonicalHref ? { canonicalHref: parsed.canonicalHref } : {}),
    });
    const initialId = tryNormalize(p.initialUrl);
    if (initialId && initialId !== id) {
      edges.push({
        kind: "redirect",
        from: initialId,
        to: id,
        rawTarget: p.finalUrl,
        detail: "collapsed",
      });
    }
  });

  for (const artifact of crawl.sitemaps as TextArtifact[]) {
    const id = tryNormalize(artifact.url);
    if (!id) continue;
    if (!nodes.has(id))
      nodes.set(id, {
        id,
        url: artifact.url,
        kind: "sitemap",
        status: artifact.status,
        statusProvenance: crawl.mode === "static" ? "assumed" : "observed",
        sameOrigin: sameOrigin(artifact.url, crawl.publicBaseUrl),
        file: artifact.file,
        inAssets: crawl.assets.has(id),
      });
    const parsed = safeParseSitemap(artifact.content);
    if (parsed?.type !== "urlset") continue;
    for (const entry of parsed.entries) {
      const resolved = entry.loc
        ? tryResolve(entry.loc, artifact.url)
        : undefined;
      if (resolved && !knownUrls.has(resolved.id))
        knownUrls.set(resolved.id, resolved.url);
      edges.push({
        kind: "sitemap",
        from: id,
        rawTarget: entry.loc,
        sitemapUrl: artifact.url,
        ...(resolved ? { to: resolved.id } : {}),
        ...(entry.lastmod !== undefined ? { lastmod: entry.lastmod } : {}),
      });
    }
  }

  for (const edge of edges) {
    ensureReferenced(edge.from, nodes, knownUrls, crawl);
    if (edge.to) ensureReferenced(edge.to, nodes, knownUrls, crawl);
  }

  const nodeList = [...nodes.values()];
  return {
    nodes: nodeList,
    edges,
    node: (url: string) => nodes.get(tryNormalize(url) ?? url),
    outgoing: (kind: UrlEdge["kind"], from: string) => {
      const id = tryNormalize(from) ?? from;
      return edges.filter((e) => e.kind === kind && e.from === id);
    },
    incoming: (kind: UrlEdge["kind"], to: string) => {
      const id = tryNormalize(to) ?? to;
      return edges.filter((e) => e.kind === kind && e.to === id);
    },
  };
}

const cache = new WeakMap<CrawlResult, UrlGraph>();
export function urlGraph(crawl: CrawlResult): UrlGraph {
  const cached = cache.get(crawl);
  if (cached) return cached;
  const built = buildGraph(crawl);
  cache.set(crawl, built);
  return built;
}
