import { XMLValidator } from "fast-xml-parser";
import { parseSitemap } from "../crawler/sitemaps.js";
import {
  isHttpUrl,
  isLocalOrStaging,
  normalizeUrl,
  pathAllowed,
  sameOrigin,
} from "../utils/urls.js";
import type { CheckDefinition } from "./types.js";
import { finding } from "./types.js";

const G =
  "https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap";
const LASTMOD =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/;

function validLastmod(value: string) {
  return LASTMOD.test(value) && !Number.isNaN(Date.parse(value));
}

export const sitemapCheck: CheckDefinition = {
  name: "sitemap",
  description:
    "Validates sitemap indexes and URL sets recursively, including scope, duplicates, exclusions, and lastmod.",
  run({ crawl, config }) {
    const out = [];
    const pageUrls = new Set<string>();
    const sitemapUrls = new Set<string>([normalizeUrl(crawl.sitemap.url)]);
    const artifacts = crawl.sitemaps.length ? crawl.sitemaps : [crawl.sitemap];

    if (crawl.sitemapTruncated)
      out.push(
        finding(
          "sitemap",
          "fetch-limit",
          "warning",
          `Sitemap traversal stopped at the configured limit (${config.crawl.maxSitemaps} files, depth ${config.crawl.maxSitemapDepth}).`,
          "Raise the sitemap limits if this index is intentionally larger, or split the audit scope.",
          { url: crawl.sitemap.url, file: crawl.sitemap.file, googleDocs: G },
        ),
      );

    for (const artifact of artifacts) {
      const location = {
        url: artifact.url,
        file: artifact.file,
        googleDocs: G,
      };
      if (artifact.status !== 200 || !artifact.content) {
        out.push(
          finding(
            "sitemap",
            artifact.parentUrl ? "child-missing" : "missing",
            "error",
            artifact.parentUrl
              ? `Child sitemap ${artifact.url} referenced by ${artifact.parentUrl} returned HTTP ${artifact.status || "network failure"}.`
              : `Sitemap was not found at ${artifact.url}.`,
            artifact.parentUrl
              ? "Publish the referenced child sitemap or remove it from the index."
              : "Generate and expose a sitemap, then declare it in robots.txt.",
            location,
          ),
        );
        continue;
      }
      const valid = XMLValidator.validate(artifact.content);
      if (valid !== true) {
        out.push(
          finding(
            "sitemap",
            "invalid-xml",
            "error",
            `Sitemap XML is invalid in ${artifact.url}: ${valid.err.msg}.`,
            "Fix the XML syntax in this sitemap file.",
            location,
          ),
        );
        continue;
      }
      const parsed = parseSitemap(artifact.content)!;
      if (parsed.type === "unknown") {
        out.push(
          finding(
            "sitemap",
            "invalid-root",
            "error",
            `Sitemap ${artifact.url} has neither a urlset nor sitemapindex root.`,
            "Use a standard <urlset> or <sitemapindex> document.",
            location,
          ),
        );
        continue;
      }
      if (!parsed.entries.length)
        out.push(
          finding(
            "sitemap",
            "empty",
            "warning",
            `${parsed.type === "sitemapindex" ? "Sitemap index" : "Sitemap"} ${artifact.url} contains no entries.`,
            parsed.type === "sitemapindex"
              ? "Reference at least one child sitemap."
              : "Add canonical indexable URLs.",
            location,
          ),
        );

      for (const entry of parsed.entries) {
        const loc = entry.loc;
        if (!isHttpUrl(loc)) {
          out.push(
            finding(
              "sitemap",
              "invalid-url",
              "error",
              `${parsed.type === "sitemapindex" ? "Sitemap index" : "Sitemap"} contains a non-absolute URL: ${loc || "(empty)"}.`,
              "Use a fully qualified HTTP(S) URL.",
              location,
            ),
          );
          continue;
        }
        const normalized = normalizeUrl(loc);
        const seen = parsed.type === "sitemapindex" ? sitemapUrls : pageUrls;
        if (seen.has(normalized))
          out.push(
            finding(
              "sitemap",
              parsed.type === "sitemapindex"
                ? "duplicate-sitemap"
                : "duplicate-url",
              "warning",
              `${parsed.type === "sitemapindex" ? "Duplicate child sitemap" : "Duplicate sitemap URL"}: ${loc}.`,
              "Keep each URL once across the sitemap tree.",
              location,
            ),
          );
        seen.add(normalized);
        if (config.site.baseUrl && !sameOrigin(loc, config.site.baseUrl))
          out.push(
            finding(
              "sitemap",
              "wrong-origin",
              "error",
              `${parsed.type === "sitemapindex" ? "Child sitemap" : "Sitemap URL"} is outside baseUrl: ${loc}.`,
              "Use the configured public origin.",
              location,
            ),
          );
        if (isLocalOrStaging(loc, config))
          out.push(
            finding(
              "sitemap",
              "non-production-url",
              "error",
              `${parsed.type === "sitemapindex" ? "Child sitemap" : "Sitemap"} contains a local or staging URL: ${loc}.`,
              "Use production URLs.",
              location,
            ),
          );
        if (
          parsed.type === "urlset" &&
          !pathAllowed(new URL(loc).pathname, config)
        )
          out.push(
            finding(
              "sitemap",
              "excluded-url",
              "warning",
              `Sitemap contains an excluded URL: ${loc}.`,
              "Remove it or adjust crawl.exclude if the page should be audited.",
              location,
            ),
          );
        if (entry.lastmod !== undefined && !validLastmod(entry.lastmod))
          out.push(
            finding(
              "sitemap",
              "invalid-lastmod",
              "warning",
              `Invalid lastmod for ${loc}: ${entry.lastmod}.`,
              "Use W3C date or date-time format.",
              location,
            ),
          );
      }
    }
    return out;
  },
};
