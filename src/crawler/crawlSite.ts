import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { SearchQualityConfig } from "../config/schema.js";
import { fileExists, readOptional, walkFiles } from "../utils/files.js";
import { isHtmlRedirect, loadHtml } from "../utils/html.js";
import { normalizeUrl, pathAllowed, sameOrigin } from "../utils/urls.js";
import { discoverLinks } from "./discoverUrls.js";
import { fetchText } from "./fetchPage.js";
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

function declaredSitemapPath(value?: string): string | undefined {
  try {
    return value ? new URL(value).pathname : undefined;
  } catch {
    return undefined;
  }
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
  for (const file of files.filter((f) => f.endsWith(".html"))) {
    const url = fileUrl(file, dist, base);
    if (
      !pathAllowed(new URL(url).pathname, config) ||
      pages.length >= config.crawl.maxPages
    )
      continue;
    const html = await readFile(file, "utf8");
    if (isHtmlRedirect(html)) continue;
    pages.push({
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
    }
  }
  for (const page of pages)
    assets.set(normalizeUrl(page.url), {
      url: page.url,
      file: page.file,
      bytes: page.bytes,
    });
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
    sitemap: {
      url: new URL("/sitemap.xml", base).toString(),
      status: sitemap === undefined ? 404 : 200,
      content: sitemap,
      file: sitemapFile,
    },
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
    const url = normalizeUrl(queue.shift()!);
    if (
      seen.has(url) ||
      !sameOrigin(url, base) ||
      !pathAllowed(new URL(url).pathname, config)
    )
      continue;
    seen.add(url);
    const u = new URL(url),
      requestUrl = new URL(
        `${u.pathname}${u.search}`,
        target.origin,
      ).toString(),
      f = await fetchText(requestUrl, config),
      html = f.content ?? "";
    pages.push({
      url,
      requestUrl,
      status: f.status,
      html,
      headers: f.headers,
      bytes: Buffer.byteLength(html),
    });
    if (f.status < 200 || f.status >= 400) continue;
    for (const link of discoverLinks(
      html,
      url,
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
  return {
    mode: "http",
    target: target.origin,
    publicBaseUrl: base,
    pages,
    robots,
    sitemap,
    assets: new Map(pages.map((p) => [normalizeUrl(p.url), { url: p.url }])),
  };
}
