import { loadHtml, metaContent } from "../utils/html.js";
import {
  obviousDescriptionConflict,
  obviousTextConflict,
} from "../utils/consistency.js";
import { isHttpUrl, isLocalOrStaging, normalizeUrl } from "../utils/urls.js";
import type { CheckDefinition } from "./types.js";
import { finding, pageOptions } from "./types.js";
export const openGraphCheck: CheckDefinition = {
  name: "openGraph",
  description: "Checks core Open Graph metadata and canonical consistency.",
  run({ crawl, config }) {
    const out = [];
    for (const p of crawl.pages) {
      const $ = loadHtml(p.html),
        o = pageOptions(p);
      for (const prop of ["og:title", "og:description", "og:url", "og:type"])
        if (!metaContent($, prop))
          out.push(
            finding(
              "open-graph",
              `missing-${prop.slice(3)}`,
              "warning",
              `Missing ${prop}.`,
              `Add ${prop} for reliable social previews.`,
              o,
            ),
          );
      const image = metaContent($, "og:image"),
        url = metaContent($, "og:url"),
        ogTitle = metaContent($, "og:title"),
        ogDescription = metaContent($, "og:description"),
        title = $("title").first().text().replace(/\s+/g, " ").trim(),
        h1 = $("h1").first().text().replace(/\s+/g, " ").trim(),
        description = metaContent($, "description"),
        canonical = $('link[rel~="canonical"]').first().attr("href")?.trim();
      if (config.rules.openGraph.requireImage && !image)
        out.push(
          finding(
            "open-graph",
            "missing-image",
            "warning",
            "Missing required og:image.",
            "Provide a representative image.",
            o,
          ),
        );
      for (const [label, v] of [
        ["og:url", url],
        ["og:image", image],
      ] as const)
        if (v && (!isHttpUrl(v) || isLocalOrStaging(v, config)))
          out.push(
            finding(
              "open-graph",
              "invalid-public-url",
              "error",
              `${label} is not a production absolute URL: ${v}.`,
              "Use a production absolute URL.",
              o,
            ),
          );
      try {
        if (url && canonical && normalizeUrl(url) !== normalizeUrl(canonical))
          out.push(
            finding(
              "open-graph",
              "url-canonical-mismatch",
              "warning",
              `og:url '${url}' differs from canonical '${canonical}'.`,
              "Align og:url with canonical.",
              o,
            ),
          );
      } catch {
        // Invalid URLs are reported above.
      }
      if (
        ogTitle &&
        title &&
        h1 &&
        obviousTextConflict(ogTitle, title) &&
        obviousTextConflict(ogTitle, h1)
      )
        out.push(
          finding(
            "open-graph",
            "title-mismatch",
            "warning",
            `og:title '${ogTitle}' conflicts with both title and H1.`,
            "Keep the social title semantically aligned; exact wording and brand suffixes may differ.",
            o,
          ),
        );
      if (
        ogDescription &&
        description &&
        ogDescription.length >= 30 &&
        description.length >= 30 &&
        obviousDescriptionConflict(ogDescription, description)
      )
        out.push(
          finding(
            "open-graph",
            "description-mismatch",
            "warning",
            "og:description conflicts with the meta description.",
            "Keep both descriptions semantically aligned; exact wording is not required.",
            o,
          ),
        );
    }
    return out;
  },
};
