import {
  loadHtml,
  metaContent,
  normalizedText,
  textFromSelection,
} from "../utils/html.js";
import { isKnownLanguage, isKnownRegion } from "../utils/bcp47.js";
import type { CheckDefinition } from "./types.js";
import { finding, pageOptions } from "./types.js";
const TG = "https://developers.google.com/search/docs/appearance/title-link",
  DG = "https://developers.google.com/search/docs/appearance/snippet",
  GEN = /^(home|homepage|untitled|new page|document)$/i;
function invalidLang(value: string) {
  const parts = value.split(/[-_]/);
  const language = parts[0] ?? "";
  if (!/^[A-Za-z]{2,8}$/.test(language) || value.includes("_"))
    return "is not a well-formed BCP 47 tag";
  if (language.length === 2 && !isKnownLanguage(language))
    return `uses the unknown language subtag "${language}"`;
  const region = parts.slice(1).find((part) => /^[A-Za-z]{2}$/.test(part));
  if (region && !isKnownRegion(region))
    return `uses the unknown region subtag "${region}"`;
  return undefined;
}

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
        title = normalizedText(textFromSelection($("title").first())),
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
      const titleCount = $("head title").length;
      if (titleCount > 1)
        out.push(
          finding(
            "metadata",
            "multiple-titles",
            "warning",
            `Page declares ${titleCount} <title> elements.`,
            "Keep exactly one <title> in the head.",
            { ...o, googleDocs: TG },
          ),
        );
      const descriptionCount = $('meta[name="description" i]').length;
      if (descriptionCount > 1)
        out.push(
          finding(
            "metadata",
            "multiple-descriptions",
            "warning",
            `Page declares ${descriptionCount} meta descriptions.`,
            "Keep exactly one meta description.",
            { ...o, googleDocs: DG },
          ),
        );
      const lang = $("html").attr("lang")?.trim();
      const langProblem = lang ? invalidLang(lang) : undefined;
      if (langProblem)
        out.push(
          finding(
            "metadata",
            "invalid-lang",
            "warning",
            `The <html> lang "${lang}" ${langProblem}.`,
            'Use a BCP 47 language tag such as "en", "pl" or "en-GB".',
            o,
          ),
        );
      if (!lang)
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
