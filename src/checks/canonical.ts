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
    const out = [];
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
            "not-self-referencing",
            "warning",
            `Canonical '${c}' differs from '${p.url}'.`,
            "Confirm duplication or self-reference.",
            o,
          ),
        );
    }
    return out;
  },
};
