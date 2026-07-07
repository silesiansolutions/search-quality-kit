import { XMLParser, XMLValidator } from "fast-xml-parser";
import {
  isHttpUrl,
  isLocalOrStaging,
  pathAllowed,
  sameOrigin,
} from "../utils/urls.js";
import type { CheckDefinition } from "./types.js";
import { finding } from "./types.js";
const G =
    "https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap",
  arr = <T>(v: T | T[] | undefined): T[] =>
    v === undefined ? [] : Array.isArray(v) ? v : [v];
export const sitemapCheck: CheckDefinition = {
  name: "sitemap",
  description:
    "Validates sitemap availability, XML, URL scope, duplicates, exclusions, and lastmod.",
  run({ crawl, config }) {
    const o = {
      url: crawl.sitemap.url,
      file: crawl.sitemap.file,
      googleDocs: G,
    };
    if (crawl.sitemap.status !== 200 || !crawl.sitemap.content)
      return [
        finding(
          "sitemap",
          "missing",
          "error",
          "Sitemap was not found at /sitemap.xml.",
          "Generate and expose a sitemap at /sitemap.xml.",
          o,
        ),
      ];
    const valid = XMLValidator.validate(crawl.sitemap.content);
    if (valid !== true)
      return [
        finding(
          "sitemap",
          "invalid-xml",
          "error",
          `Sitemap XML is invalid: ${valid.err.msg}.`,
          "Fix the XML syntax.",
          o,
        ),
      ];
    const p = new XMLParser({
        ignoreAttributes: false,
        trimValues: true,
      }).parse(crawl.sitemap.content),
      entries = [
        ...arr<any>(p.urlset?.url),
        ...arr<any>(p.sitemapindex?.sitemap),
      ],
      out = [];
    if (!entries.length)
      out.push(
        finding(
          "sitemap",
          "empty",
          "warning",
          "Sitemap contains no URL entries.",
          "Add canonical indexable URLs.",
          o,
        ),
      );
    const seen = new Set<string>();
    for (const e of entries) {
      const loc = typeof e?.loc === "string" ? e.loc.trim() : "";
      if (!isHttpUrl(loc)) {
        out.push(
          finding(
            "sitemap",
            "invalid-url",
            "error",
            `Sitemap contains a non-absolute URL: ${loc || "(empty)"}.`,
            "Use fully qualified HTTP(S) URLs.",
            o,
          ),
        );
        continue;
      }
      if (seen.has(loc))
        out.push(
          finding(
            "sitemap",
            "duplicate-url",
            "warning",
            `Duplicate sitemap URL: ${loc}.`,
            "Keep each URL once.",
            o,
          ),
        );
      seen.add(loc);
      if (config.site.baseUrl && !sameOrigin(loc, config.site.baseUrl))
        out.push(
          finding(
            "sitemap",
            "wrong-origin",
            "error",
            `Sitemap URL is outside baseUrl: ${loc}.`,
            "Use the public origin.",
            o,
          ),
        );
      if (isLocalOrStaging(loc, config))
        out.push(
          finding(
            "sitemap",
            "non-production-url",
            "error",
            `Sitemap contains a local or staging URL: ${loc}.`,
            "Use production URLs.",
            o,
          ),
        );
      if (!pathAllowed(new URL(loc).pathname, config))
        out.push(
          finding(
            "sitemap",
            "excluded-url",
            "warning",
            `Sitemap contains an excluded URL: ${loc}.`,
            "Remove it or adjust exclusions.",
            o,
          ),
        );
      if (e.lastmod !== undefined) {
        const d = String(e.lastmod);
        if (
          !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
            d,
          ) ||
          Number.isNaN(Date.parse(d))
        )
          out.push(
            finding(
              "sitemap",
              "invalid-lastmod",
              "warning",
              `Invalid lastmod for ${loc}: ${d}.`,
              "Use W3C date/date-time format.",
              o,
            ),
          );
      }
    }
    return out;
  },
};
