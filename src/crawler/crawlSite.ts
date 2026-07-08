import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { SearchQualityConfig } from "../config/schema.js";
import { fileExists, readOptional, walkFiles } from "../utils/files.js";
import { isHtmlRedirect, loadHtml } from "../utils/html.js";
import { normalizeUrl, pathAllowed, sameOrigin } from "../utils/urls.js";
import { discoverLinks } from "./discoverUrls.js";
import { fetchText } from "./fetchPage.js";
import { parseSitemap } from "./sitemaps.js";
import type {
  AssetArtifact,
  CrawlResult,
  PageArtifact,
  TextArtifact,
} from "./types.js";
function fileUrl(file: string, dist: string, base: string) {
  const rel = path.relative(dist, file).split(path.sep).join("/");
  const route =
    rel === "index.html"
      ? "/"
      : rel.endsWith("/index.html")
        ? `/${rel.slice(0, -10)}`
        : `/${rel}`;
  return new URL(route, base).toString();
}

function publicHtmlUrl(file: string, dist: string, base: string, html: string) {
  const generated = fileUrl(file, dist, base);
  if (path.basename(file) === "index.html") return generated;
  const canonical = loadHtml(html)('link[rel~="canonical"]')
    .first()
    .attr("href");
  if (!canonical?.match(/^https?:\/\//)) return generated;
  try {
    const candidate = normalizeUrl(canonical);
    if (!sameOrigin(candidate, base)) return generated;
    const generatedPath = normalizeUrl(generated);
    const extensionlessPath = normalizeUrl(generated.replace(/\.html$/, ""));
    return candidate === generatedPath || candidate === extensionlessPath
      ? candidate
      : generated;
  } catch {
    return generated;
  }
}

function declaredSitemapPath(value?: string): string | undefined {
  try {
    return value ? new URL(value).pathname : undefined;
  } catch {
    return undefined;
  }
}

function sitemapPageUrls(sitemaps: TextArtifact[]) {
  const urls = new Map<string, string>();
  for (const artifact of sitemaps) {
    const parsed = parseSitemap(artifact.content);
    if (parsed?.type !== "urlset") continue;
    for (const { loc } of parsed.entries) {
      try {
        const normalized = normalizeUrl(loc);
        urls.set(normalized, loc);
      } catch {
        // URL validity is reported by the sitemap check.
      }
    }
  }
  return [...urls.values()];
}

async function collectSitemaps(
  initial: TextArtifact,
  config: SearchQualityConfig,
  loadChild: (
    url: string,
    parentUrl: string,
    depth: number,
  ) => Promise<TextArtifact | undefined>,
) {
  const sitemaps = [initial];
  const seen = new Set<string>();
  try {
    seen.add(normalizeUrl(initial.url));
  } catch {
    seen.add(initial.url);
  }
  let truncated = false;
  for (let index = 0; index < sitemaps.length; index += 1) {
    const artifact = sitemaps[index]!;
    const parsed = parseSitemap(artifact.content);
    if (parsed?.type !== "sitemapindex") continue;
    const depth = artifact.depth ?? 0;
    if (depth >= config.crawl.maxSitemapDepth) {
      if (parsed.entries.length) truncated = true;
      continue;
    }
    for (const { loc } of parsed.entries) {
      let key: string;
      try {
        key = normalizeUrl(loc);
      } catch {
        continue;
      }
      if (seen.has(key)) continue;
      if (sitemaps.length >= config.crawl.maxSitemaps) {
        truncated = true;
        break;
      }
      seen.add(key);
      const child = await loadChild(loc, artifact.url, depth + 1);
      if (child) sitemaps.push(child);
    }
  }
  return { sitemaps, truncated };
}
async function inferBase(
  dist: string,
  config: SearchQualityConfig,
  sitemap?: string,
) {
  if (config.site.baseUrl) return config.site.baseUrl;
  const loc = sitemap?.match(/<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/i)?.[1];
  if (loc) return new URL(loc).origin;
  const html = await readOptional(path.join(dist, "index.html"));
  const canonical = html
    ? loadHtml(html)('link[rel~="canonical"]').first().attr("href")
    : undefined;
  return canonical?.match(/^https?:\/\//)
    ? new URL(canonical).origin
    : "http://localhost";
}
export async function crawlStatic(
  root: string,
  config: SearchQualityConfig,
): Promise<CrawlResult> {
  const dist = path.resolve(root, config.build.distDir);
  if (!(await fileExists(dist)))
    throw new Error(`Build directory not found: ${dist}`);
  const robotsFile = path.join(dist, "robots.txt");
  const [robots, files] = await Promise.all([
    readOptional(robotsFile),
    walkFiles(dist),
  ]);
  const declaredSitemap = robots?.match(/^\s*sitemap:\s*(\S+)\s*$/im)?.[1];
  const declaredPath = declaredSitemapPath(declaredSitemap);
  const declaredFile = declaredPath
    ? decodeURIComponent(declaredPath).replace(/^\/+/, "")
    : undefined;
  const sitemapFile = [
    declaredFile && path.join(dist, declaredFile),
    path.join(dist, "sitemap.xml"),
    path.join(dist, "sitemap-index.xml"),
  ].find((candidate): candidate is string =>
    Boolean(candidate && files.includes(candidate)),
  );
  const sitemap = sitemapFile ? await readOptional(sitemapFile) : undefined;
  const base = await inferBase(dist, config, sitemap);
  const pages: PageArtifact[] = [];
  const htmlPublicUrls = new Map<string, string>();
  for (const file of files.filter((f) => f.endsWith(".html"))) {
    const html = await readFile(file, "utf8");
    const url = publicHtmlUrl(file, dist, base, html);
    htmlPublicUrls.set(file, url);
    if (
      !pathAllowed(new URL(url).pathname, config) ||
      pages.length >= config.crawl.maxPages
    )
      continue;
    if (isHtmlRedirect(html)) continue;
    pages.push({
      initialUrl: url,
      finalUrl: url,
      url,
      requestUrl: `file://${file}`,
      status: 200,
      html,
      headers: {},
      file,
      bytes: Buffer.byteLength(html),
    });
  }
  const assets = new Map<string, AssetArtifact>();
  for (const file of files) {
    const url = normalizeUrl(
      `/${path.relative(dist, file).split(path.sep).join("/")}`,
      base,
    );
    const bytes = (await stat(file)).size;
    assets.set(url, { url, file, bytes });
    if (file.endsWith(".html")) {
      const routeUrl = normalizeUrl(fileUrl(file, dist, base));
      assets.set(routeUrl, { url: routeUrl, file, bytes });
      const publicUrl = normalizeUrl(htmlPublicUrls.get(file) ?? routeUrl);
      assets.set(publicUrl, { url: publicUrl, file, bytes });
    }
  }
  for (const page of pages)
    assets.set(normalizeUrl(page.url), {
      url: page.url,
      file: page.file,
      bytes: page.bytes,
    });
  const sitemapUrl = sitemapFile
    ? fileUrl(sitemapFile, dist, base)
    : new URL("/sitemap.xml", base).toString();
  const rootSitemap: TextArtifact = {
    url: sitemapUrl,
    status: sitemap === undefined ? 404 : 200,
    content: sitemap,
    file: sitemapFile,
    depth: 0,
  };
  const collected = await collectSitemaps(
    rootSitemap,
    config,
    async (url, parentUrl, depth) => {
      if (!sameOrigin(url, base)) return undefined;
      const pathname = decodeURIComponent(new URL(url).pathname).replace(
        /^\/+/,
        "",
      );
      const file = path.resolve(dist, pathname);
      if (file !== dist && !file.startsWith(`${dist}${path.sep}`))
        return undefined;
      const content = files.includes(file)
        ? await readOptional(file)
        : undefined;
      return {
        url,
        status: content === undefined ? 404 : 200,
        content,
        ...(content === undefined ? {} : { file }),
        parentUrl,
        depth,
      };
    },
  );
  return {
    mode: "static",
    target: dist,
    publicBaseUrl: base,
    pages,
    assets,
    robots: {
      url: new URL("/robots.txt", base).toString(),
      status: robots === undefined ? 404 : 200,
      content: robots,
      file: robotsFile,
    },
    sitemap: rootSitemap,
    sitemaps: collected.sitemaps,
    sitemapUrls: sitemapPageUrls(collected.sitemaps),
    sitemapTruncated: collected.truncated,
  };
}
async function artifact(
  target: string,
  base: string,
  name: string,
  config: SearchQualityConfig,
): Promise<TextArtifact> {
  const f = await fetchText(new URL(name, target).toString(), config);
  return {
    url: new URL(name, base).toString(),
    status: f.status,
    content: f.content,
  };
}

function publicResponseUrl(responseUrl: string, target: URL, base: string) {
  const response = new URL(responseUrl);
  if (response.origin !== target.origin) return response.toString();
  return new URL(`${response.pathname}${response.search}`, base).toString();
}
export async function crawlHttp(
  targetBase: string,
  config: SearchQualityConfig,
): Promise<CrawlResult> {
  const target = new URL(targetBase),
    base = config.site.baseUrl ?? target.origin,
    queue = config.crawl.entrypoints.map((e) => new URL(e, base).toString()),
    seen = new Set<string>(),
    pages: PageArtifact[] = [];
  while (queue.length && pages.length < config.crawl.maxPages) {
    const initial = new URL(queue.shift()!);
    initial.hash = "";
    const initialUrl = initial.toString();
    const key = normalizeUrl(initialUrl);
    if (
      seen.has(key) ||
      !sameOrigin(initialUrl, base) ||
      !pathAllowed(initial.pathname, config)
    )
      continue;
    seen.add(key);
    const u = initial,
      requestUrl = new URL(
        `${u.pathname}${u.search}`,
        target.origin,
      ).toString(),
      f = await fetchText(requestUrl, config),
      html = f.content ?? "",
      finalUrl = publicResponseUrl(f.finalUrl, target, base);
    seen.add(normalizeUrl(finalUrl));
    pages.push({
      initialUrl,
      finalUrl,
      url: finalUrl,
      requestUrl,
      status: f.status,
      html,
      headers: f.headers,
      bytes: Buffer.byteLength(html),
    });
    if (f.status < 200 || f.status >= 400) continue;
    for (const link of discoverLinks(
      html,
      finalUrl,
      base,
      (p) => !pathAllowed(p, config),
    ))
      if (
        link.internal &&
        link.absolute &&
        !seen.has(normalizeUrl(link.absolute))
      )
        queue.push(link.absolute);
  }
  const robots = await artifact(target.origin, base, "/robots.txt", config);
  const declared = robots.content?.match(/^\s*sitemap:\s*(\S+)\s*$/im)?.[1];
  let sitemap = await artifact(
    target.origin,
    base,
    declaredSitemapPath(declared) ?? "/sitemap.xml",
    config,
  );
  if (sitemap.status !== 200 && !declared)
    sitemap = await artifact(target.origin, base, "/sitemap-index.xml", config);
  sitemap.depth = 0;
  const collected = await collectSitemaps(
    sitemap,
    config,
    async (url, parentUrl, depth) => {
      if (!sameOrigin(url, base)) return undefined;
      const publicUrl = new URL(url);
      const f = await fetchText(
        new URL(`${publicUrl.pathname}${publicUrl.search}`, target).toString(),
        config,
      );
      return {
        url: publicUrl.toString(),
        status: f.status,
        content: f.content,
        parentUrl,
        depth,
      };
    },
  );
  return {
    mode: "http",
    target: target.origin,
    publicBaseUrl: base,
    pages,
    robots,
    sitemap,
    sitemaps: collected.sitemaps,
    sitemapUrls: sitemapPageUrls(collected.sitemaps),
    sitemapTruncated: collected.truncated,
    assets: new Map(pages.map((p) => [normalizeUrl(p.url), { url: p.url }])),
  };
}
