import { XMLParser, XMLValidator } from "fast-xml-parser";

export interface SitemapAlternate {
  hreflang: string;
  href: string;
}

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  alternates?: SitemapAlternate[];
}

function sitemapAlternates(value: unknown): SitemapAlternate[] {
  return array(value as unknown[] | undefined).flatMap((link) => {
    const attributes = link as Record<string, unknown>;
    const rel = String(attributes["@_rel"] ?? "")
      .toLowerCase()
      .split(/\s+/);
    const hreflang = attributes["@_hreflang"];
    const href = attributes["@_href"];
    if (
      !rel.includes("alternate") ||
      typeof hreflang !== "string" ||
      typeof href !== "string"
    )
      return [];
    return [{ hreflang: hreflang.trim(), href: href.trim() }];
  });
}

export interface ParsedSitemap {
  type: "urlset" | "sitemapindex" | "unknown";
  entries: SitemapEntry[];
}

const array = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

export function parseSitemap(content?: string): ParsedSitemap | undefined {
  if (!content || XMLValidator.validate(content) !== true) return undefined;
  const parsed = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
  }).parse(content) as {
    urlset?: { url?: unknown | unknown[] };
    sitemapindex?: { sitemap?: unknown | unknown[] };
  };
  const type = parsed.sitemapindex
    ? "sitemapindex"
    : parsed.urlset
      ? "urlset"
      : "unknown";
  const raw =
    type === "sitemapindex"
      ? array(parsed.sitemapindex?.sitemap)
      : type === "urlset"
        ? array(parsed.urlset?.url)
        : [];
  return {
    type,
    entries: raw.map((entry) => {
      const value = entry as {
        loc?: unknown;
        lastmod?: unknown;
        "xhtml:link"?: unknown;
      };
      const alternates =
        type === "urlset" ? sitemapAlternates(value["xhtml:link"]) : [];
      return {
        loc: typeof value.loc === "string" ? value.loc.trim() : "",
        ...(value.lastmod === undefined
          ? {}
          : { lastmod: String(value.lastmod) }),
        ...(alternates.length ? { alternates } : {}),
      };
    }),
  };
}
