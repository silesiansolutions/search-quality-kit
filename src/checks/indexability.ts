import { loadHtml, metaContent } from "../utils/html.js";
import type { CheckDefinition } from "./types.js";
import { finding, pageOptions } from "./types.js";
export const indexabilityCheck: CheckDefinition = {
  name: "indexability",
  description: "Checks HTTP status and accidental noindex directives.",
  run({ crawl }) {
    const out = [];
    for (const p of crawl.pages) {
      if (p.status !== 200)
        out.push(
          finding(
            "indexability",
            "non-200",
            "error",
            `Page returned HTTP ${p.status || "network failure"}.`,
            "Serve indexable pages with HTTP 200.",
            {
              ...pageOptions(p),
              googleDocs:
                "https://developers.google.com/search/docs/essentials/technical",
            },
          ),
        );
      const $ = loadHtml(p.html),
        robots =
          `${metaContent($, "robots") ?? ""},${metaContent($, "googlebot") ?? ""},${p.headers["x-robots-tag"] ?? ""}`.toLowerCase();
      if (/(?:^|[,\s])(?:noindex|none)(?:$|[,\s])/.test(robots))
        out.push(
          finding(
            "indexability",
            "noindex",
            "error",
            "Page is marked noindex.",
            "Remove noindex or exclude the route intentionally.",
            {
              ...pageOptions(p),
              googleDocs:
                "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag",
            },
          ),
        );
    }
    return out;
  },
};
