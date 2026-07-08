import { loadHtml } from "../utils/html.js";
import {
  isHttpUrl,
  isLocalOrStaging,
  normalizeUrl,
  sameOrigin,
} from "../utils/urls.js";
import type { CheckDefinition } from "./types.js";
import { finding, pageOptions } from "./types.js";
const G =
  "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls";
export const canonicalCheck: CheckDefinition = {
  name: "canonical",
  description:
    "Checks canonical presence, uniqueness, public URL, and self-consistency.",
  run({ crawl, config }) {
    const out = [],
      sitemapUrls = new Set(
        crawl.sitemapUrls.flatMap((url) => {
          try {
            return [normalizeUrl(url)];
          } catch {
            return [];
          }
        }),
      );
    for (const p of crawl.pages) {
      const $ = loadHtml(p.html),
        cs = $('link[rel~="canonical"]')
          .map((_, n) => ($(n).attr("href") ?? "").trim())
          .get(),
        o = { ...pageOptions(p), googleDocs: G };
      if (!cs.length) {
        if (config.rules.canonical.required)
          out.push(
            finding(
              "canonical",
              "missing",
              "warning",
              "Page has no canonical link.",
              "Add an absolute canonical URL.",
              o,
            ),
          );
        continue;
      }
      if (cs.length > 1)
        out.push(
          finding(
            "canonical",
            "multiple",
            "error",
            `Page declares ${cs.length} canonicals.`,
            "Declare exactly one.",
            o,
          ),
        );
      const c = cs[0] ?? "";
      if (!c) {
        out.push(
          finding(
            "canonical",
            "empty",
            "error",
            "Canonical is empty.",
            "Set the preferred URL.",
            o,
          ),
        );
        continue;
      }
      if (!isHttpUrl(c)) {
        out.push(
          finding(
            "canonical",
            "not-absolute",
            "error",
            `Canonical is not absolute: ${c}.`,
            "Use a fully qualified URL.",
            o,
          ),
        );
        continue;
      }
      if (isLocalOrStaging(c, config))
        out.push(
          finding(
            "canonical",
            "non-production-url",
            "error",
            `Canonical points to a non-production host: ${c}.`,
            "Use production.",
            o,
          ),
        );
      if (config.site.baseUrl && !sameOrigin(c, config.site.baseUrl))
        out.push(
          finding(
            "canonical",
            "wrong-origin",
            "error",
            `Canonical is outside baseUrl: ${c}.`,
            "Use the configured public origin.",
            o,
          ),
        );
      if (normalizeUrl(c) !== normalizeUrl(p.url))
        out.push(
          finding(
            "canonical",
            sitemapUrls.has(normalizeUrl(p.url))
              ? "sitemap-canonical-mismatch"
              : "not-self-referencing",
            "warning",
            sitemapUrls.has(normalizeUrl(p.url))
              ? `Sitemap URL '${p.url}' declares a different canonical '${c}'.`
              : `Canonical '${c}' differs from final URL '${p.url}'.`,
            sitemapUrls.has(normalizeUrl(p.url))
              ? "Keep sitemap URLs canonical, or remove the duplicate URL from the sitemap."
              : "Confirm intentional duplicate consolidation or use a self-reference.",
            o,
          ),
        );
      if (
        p.initialUrl !== p.finalUrl &&
        sitemapUrls.has(normalizeUrl(p.initialUrl)) &&
        !sitemapUrls.has(normalizeUrl(p.finalUrl))
      )
        out.push(
          finding(
            "canonical",
            "sitemap-final-url-mismatch",
            "warning",
            `Sitemap contains redirected URL '${p.initialUrl}' instead of final URL '${p.finalUrl}'.`,
            "Publish the final canonical URL in the sitemap.",
            o,
          ),
        );
    }
    return out;
  },
};
