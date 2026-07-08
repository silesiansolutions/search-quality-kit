import { loadHtml, normalizedText, textFromSelection } from "../utils/html.js";
import type { CheckDefinition } from "./types.js";
import { finding, pageOptions } from "./types.js";
export const accessibilityCheck: CheckDefinition = {
  name: "accessibility",
  description:
    "Checks image text alternatives, control names, language, and heading order.",
  run({ crawl }) {
    const out = [];
    for (const p of crawl.pages) {
      const $ = loadHtml(p.html),
        o = pageOptions(p);
      $("img").each((_, e) => {
        if (
          $(e).attr("alt") === undefined &&
          $(e).attr("role") !== "presentation" &&
          $(e).attr("aria-hidden") !== "true"
        )
          out.push(
            finding(
              "accessibility",
              "image-missing-alt",
              "warning",
              `Image is missing alt: ${$(e).attr("src") ?? "(no src)"}.`,
              'Add meaningful alt or alt="".',
              o,
            ),
          );
      });
      $("button").each((_, e) => {
        if (!(
          normalizedText(textFromSelection($(e))) ||
          $(e).attr("aria-label") ||
          $(e).attr("aria-labelledby") ||
          $(e).attr("title")
        ))
          out.push(
            finding(
              "accessibility",
              "unnamed-button",
              "warning",
              "Button has no accessible name.",
              "Add text or an accessible label.",
              o,
            ),
          );
      });
      $("a[href]").each((_, e) => {
        if (!(
          normalizedText(textFromSelection($(e))) ||
          $(e).attr("aria-label") ||
          $(e).attr("aria-labelledby") ||
          $(e).find("img[alt]").attr("alt")
        ))
          out.push(
            finding(
              "accessibility",
              "unnamed-link",
              "warning",
              `Link has no accessible name: ${$(e).attr("href")}.`,
              "Add descriptive text or label.",
              o,
            ),
          );
      });
      if (!$("html").attr("lang")?.trim())
        out.push(
          finding(
            "accessibility",
            "missing-lang",
            "warning",
            "Document language is not declared.",
            "Set lang on html.",
            o,
          ),
        );
      let prev = 0;
      $("h1,h2,h3,h4,h5,h6").each((_, e) => {
        const cur = Number(e.tagName.slice(1));
        if (prev && cur > prev + 1)
          out.push(
            finding(
              "accessibility",
              "heading-skip",
              "warning",
              `Heading jumps from H${prev} to H${cur}.`,
              "Use a logical hierarchy.",
              o,
            ),
          );
        prev = cur;
      });
    }
    return out;
  },
};
