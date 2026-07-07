import path from "node:path";
import { loadHtml } from "../utils/html.js";
import { isLocalOrStaging, normalizeUrl, sameOrigin } from "../utils/urls.js";
import type { CheckDefinition } from "./types.js";
import { finding, pageOptions } from "./types.js";
const G =
  "https://developers.google.com/search/docs/appearance/core-web-vitals";
export const performanceHintsCheck: CheckDefinition = {
  name: "performanceHints",
  description:
    "Hints for HTML weight, scripts, image loading, image size, and host leaks.",
  run({ crawl, config }) {
    const out = [];
    const reportedLargeAssets = new Set<string>();
    for (const p of crawl.pages) {
      const $ = loadHtml(p.html),
        o = { ...pageOptions(p), googleDocs: G };
      if (p.bytes > config.rules.performance.maxHtmlBytes)
        out.push(
          finding(
            "performance-hints",
            "heavy-html",
            "warning",
            `HTML is ${(p.bytes / 1024).toFixed(0)} KiB.`,
            "Reduce payload and verify with Lighthouse.",
            o,
          ),
        );
      const scripts = $("script[src]").filter((_, e) => {
        try {
          return !sameOrigin(
            new URL($(e).attr("src")!, p.url).toString(),
            crawl.publicBaseUrl,
          );
        } catch {
          return false;
        }
      });
      if (scripts.length > config.rules.performance.maxExternalScripts)
        out.push(
          finding(
            "performance-hints",
            "many-external-scripts",
            "warning",
            `Page loads ${scripts.length} external scripts.`,
            "Audit their necessity and loading.",
            o,
          ),
        );
      const images = $("img[src]"),
        eager = images.filter(
          (i, e) => i > 0 && $(e).attr("loading") !== "lazy",
        );
      if (images.length >= 4 && eager.length >= 3)
        out.push(
          finding(
            "performance-hints",
            "images-not-lazy",
            "warning",
            `${eager.length} non-primary images are not lazy-loaded.`,
            "Lazy-load below-fold images.",
            o,
          ),
        );
      images.each((_, e) => {
        const src = $(e).attr("src")!;
        let url: string;
        try {
          url = normalizeUrl(src, p.url);
        } catch {
          return;
        }
        if (isLocalOrStaging(url, config))
          out.push(
            finding(
              "performance-hints",
              "non-production-asset",
              "error",
              `Image points to non-production: ${url}.`,
              "Use production or relative URLs.",
              o,
            ),
          );
        const a = crawl.assets.get(url);
        if (
          a?.bytes &&
          a.bytes > config.rules.performance.largeImageBytes &&
          !reportedLargeAssets.has(url)
        ) {
          reportedLargeAssets.add(url);
          out.push(
            finding(
              "performance-hints",
              "large-image",
              "warning",
              `Image ${path.basename(new URL(url).pathname)} is ${(a.bytes / 1024).toFixed(0)} KiB.`,
              "Resize and compress it.",
              { ...o, file: a.file ?? o.file },
            ),
          );
        }
      });
      $("script[src],link[href]").each((_, e) => {
        const raw = $(e).attr("src") ?? $(e).attr("href");
        if (!raw) return;
        try {
          const url = new URL(raw, p.url).toString();
          if (isLocalOrStaging(url, config))
            out.push(
              finding(
                "performance-hints",
                "non-production-asset",
                "error",
                `Asset points to non-production: ${url}.`,
                "Use production or relative URLs.",
                o,
              ),
            );
        } catch {
          // Malformed asset URLs are covered by link checks.
        }
      });
    }
    return out;
  },
};
