import { loadHtml, metaContent, normalizedText } from "../utils/html.js";
import type { CheckDefinition } from "./types.js";
import { finding, pageOptions } from "./types.js";
const TG = "https://developers.google.com/search/docs/appearance/title-link",
  DG = "https://developers.google.com/search/docs/appearance/snippet",
  GEN = /^(home|homepage|untitled|new page|document)$/i;
export const metadataCheck: CheckDefinition = {
  name: "metadata",
  description:
    "Checks titles, descriptions, language, viewport, and duplicates.",
  run({ crawl, config }) {
    const out = [],
      titles = new Map<string, string[]>(),
      descs = new Map<string, string[]>();
    for (const p of crawl.pages) {
      const $ = loadHtml(p.html),
        title = normalizedText($("title").first().text()),
        desc = metaContent($, "description") ?? "",
        o = pageOptions(p);
      if (!title)
        out.push(
          finding(
            "metadata",
            "missing-title",
            "error",
            "Page has no non-empty <title>.",
            "Add a descriptive page-specific title.",
            { ...o, googleDocs: TG },
          ),
        );
      else {
        titles.set(title, [...(titles.get(title) ?? []), p.url]);
        if (
          title.length < config.rules.title.minLength ||
          title.length > config.rules.title.maxLength
        )
          out.push(
            finding(
              "metadata",
              "title-length",
              "warning",
              `Title length is ${title.length}; configured range is ${config.rules.title.minLength}-${config.rules.title.maxLength}.`,
              "Rewrite it concisely; length is a project heuristic.",
              { ...o, googleDocs: TG },
            ),
          );
        if (GEN.test(title))
          out.push(
            finding(
              "metadata",
              "generic-title",
              "warning",
              `Title is generic: '${title}'.`,
              "Identify the page and site clearly.",
              { ...o, googleDocs: TG },
            ),
          );
      }
      if (!desc) {
        if (!config.rules.description.allowMissing)
          out.push(
            finding(
              "metadata",
              "missing-description",
              "warning",
              "Page has no meta description.",
              "Add a useful page-specific summary.",
              { ...o, googleDocs: DG },
            ),
          );
      } else {
        descs.set(desc, [...(descs.get(desc) ?? []), p.url]);
        if (
          desc.length < config.rules.description.minLength ||
          desc.length > config.rules.description.maxLength
        )
          out.push(
            finding(
              "metadata",
              "description-length",
              "warning",
              `Description length is ${desc.length}; configured range is ${config.rules.description.minLength}-${config.rules.description.maxLength}.`,
              "Use a useful summary; length is a heuristic.",
              { ...o, googleDocs: DG },
            ),
          );
      }
      if (!$("html").attr("lang")?.trim())
        out.push(
          finding(
            "metadata",
            "missing-lang",
            "warning",
            "The <html> element has no lang.",
            "Set the document language.",
            o,
          ),
        );
      if (!metaContent($, "viewport"))
        out.push(
          finding(
            "metadata",
            "missing-viewport",
            "warning",
            "Page has no viewport meta tag.",
            "Add a mobile-friendly viewport.",
            o,
          ),
        );
    }
    if (!config.rules.title.allowDuplicates)
      for (const [v, urls] of titles)
        if (urls.length > 1)
          out.push(
            finding(
              "metadata",
              "duplicate-title",
              "warning",
              `Duplicate title on ${urls.length} pages: '${v}'.`,
              "Use distinct titles.",
              { relatedUrls: urls, googleDocs: TG },
            ),
          );
    if (!config.rules.description.allowDuplicates)
      for (const [v, urls] of descs)
        if (urls.length > 1)
          out.push(
            finding(
              "metadata",
              "duplicate-description",
              "warning",
              `Duplicate description on ${urls.length} pages: '${v}'.`,
              "Use page-specific summaries.",
              { relatedUrls: urls, googleDocs: DG },
            ),
          );
    return out;
  },
};
