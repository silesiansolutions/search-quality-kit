import { readFile } from "node:fs/promises";
import path from "node:path";
import { defaultConfig } from "../src/config/defaultConfig.js";
import type { SearchQualityConfig } from "../src/config/schema.js";
import type { CrawlResult } from "../src/crawler/types.js";
export const fixture = (name: string) =>
  readFile(path.join(import.meta.dirname, "fixtures", name), "utf8");
export function context(
  overrides: Partial<CrawlResult> = {},
  config: SearchQualityConfig = defaultConfig,
) {
  const sitemap = overrides.sitemap ?? {
    url: "https://example.com/sitemap.xml",
    status: 200,
    content: "<urlset></urlset>",
  };
  const crawl: CrawlResult = {
    mode: "static",
    target: "/tmp/dist",
    publicBaseUrl: "https://example.com",
    pages: [],
    robots: {
      url: "https://example.com/robots.txt",
      status: 200,
      content:
        "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml",
    },
    llmsTxt: overrides.llmsTxt ?? {
      url: "https://example.com/llms.txt",
      status: 404,
    },
    sitemap,
    sitemaps: overrides.sitemaps ?? [sitemap],
    sitemapUrls: [],
    sitemapTruncated: false,
    assets: new Map(),
    ...overrides,
  };
  return { config, crawl };
}
export const page = (html: string, url = "https://example.com/") => ({
  initialUrl: url,
  finalUrl: url,
  url,
  requestUrl: `file:///tmp/index.html`,
  status: 200,
  html,
  headers: {},
  file: "/tmp/index.html",
  bytes: Buffer.byteLength(html),
});
