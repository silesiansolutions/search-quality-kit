import { loadHtml, normalizedText, visibleText } from "../utils/html.js";
import type { CheckDefinition } from "./types.js";
import { finding, pageOptions } from "./types.js";
const G =
    "https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics",
  PLACE =
    /^(loading(?:\.\.\.)?|please enable javascript|coming soon|lorem ipsum|todo)$/i;
export const renderedHtmlCheck: CheckDefinition = {
  name: "renderedHtml",
  description:
    "Detects empty app shells, missing main content, headings, and placeholders.",
  run({ crawl, config }) {
    const out = [];
    for (const p of crawl.pages) {
      const $ = loadHtml(p.html),
        text = visibleText(p.html),
        o = { ...pageOptions(p), googleDocs: G };
      if (config.rules.renderedHtml.requireMain && !$("main").length)
        out.push(
          finding(
            "rendered-html",
            "missing-main",
            "warning",
            "Page has no <main>.",
            "Wrap primary content in main.",
            o,
          ),
        );
      if (text.length < config.rules.renderedHtml.minTextLength)
        out.push(
          finding(
            "rendered-html",
            "thin-html-shell",
            "error",
            `HTML contains only ${text.length} visible text characters.`,
            "Pre-render primary content.",
            o,
          ),
        );
      if (PLACE.test(normalizedText(text)))
        out.push(
          finding(
            "rendered-html",
            "placeholder-only",
            "error",
            `Content looks like a placeholder: '${text}'.`,
            "Deliver meaningful HTML content.",
            o,
          ),
        );
      const h = $("h1").length;
      if (config.rules.renderedHtml.requireH1 && !h)
        out.push(
          finding(
            "rendered-html",
            "missing-h1",
            "warning",
            "Page has no H1.",
            "Add a descriptive main heading.",
            o,
          ),
        );
      if (!config.rules.renderedHtml.allowMultipleH1 && h > 1)
        out.push(
          finding(
            "rendered-html",
            "multiple-h1",
            "warning",
            `Page has ${h} H1 headings.`,
            "Use a clear page-level H1.",
            o,
          ),
        );
    }
    return out;
  },
};
