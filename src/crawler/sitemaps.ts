import { XMLParser, XMLValidator } from "fast-xml-parser";

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
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
      const value = entry as { loc?: unknown; lastmod?: unknown };
      return {
        loc: typeof value.loc === "string" ? value.loc.trim() : "",
        ...(value.lastmod === undefined
          ? {}
          : { lastmod: String(value.lastmod) }),
      };
    }),
  };
}
