import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { CrawlResult } from "../crawler/types.js";
import type { SearchQualityConfig } from "../config/schema.js";
import { loadHtml, normalizedText } from "../utils/html.js";
import type { CheckDefinition } from "./types.js";
import { finding, pageOptions } from "./types.js";

const CHECK = "agent-readiness",
  LLMS_TXT = "https://llmstxt.org/",
  EXCLUDED_TYPES = new Set(["hidden", "submit", "button", "reset", "image"]);

function present(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== "";
}

function llmsTxtFindings(crawl: CrawlResult, config: SearchQualityConfig) {
  const llmsTxt = crawl.llmsTxt,
    o = { url: llmsTxt.url, file: llmsTxt.file };
  if (llmsTxt.content === undefined && llmsTxt.status === 0)
    return [
      finding(
        CHECK,
        "llms-txt-unreadable",
        "warning",
        "llms.txt failed to load.",
        "Fix the connectivity issue serving llms.txt, then retry.",
        o,
      ),
    ];
  if (llmsTxt.status >= 500)
    return [
      finding(
        CHECK,
        "llms-txt-unreadable",
        "warning",
        "llms.txt responded with a server error.",
        "Fix the server error serving llms.txt, then retry.",
        o,
      ),
    ];
  if (
    llmsTxt.content === undefined ||
    (llmsTxt.status >= 400 && llmsTxt.status <= 499)
  )
    return [
      finding(
        CHECK,
        "llms-txt-missing",
        config.rules.agentReadiness.requireLlmsTxt ? "warning" : "info",
        "llms.txt was not found.",
        `Add a Markdown llms.txt at the site root; see ${LLMS_TXT}.`,
        o,
      ),
    ];
  if (llmsTxt.status !== 200) return [];
  const content = llmsTxt.content,
    out = [];
  if (!/^\s*#\s+.+/m.test(content))
    out.push(
      finding(
        CHECK,
        "llms-txt-missing-h1",
        "warning",
        "llms.txt has no H1 heading.",
        "Start llms.txt with a Markdown H1 (# Title).",
        o,
      ),
    );
  if (!/\[.+\]\(.+\)/.test(content))
    out.push(
      finding(
        CHECK,
        "llms-txt-missing-links",
        "warning",
        "llms.txt has no Markdown links.",
        "Add Markdown links to key pages for agents to follow.",
        o,
      ),
    );
  if (content.length < 50)
    out.push(
      finding(
        CHECK,
        "llms-txt-too-short",
        "warning",
        "llms.txt content is shorter than 50 characters.",
        "Add more detail so agents understand the site.",
        o,
      ),
    );
  if (!/^\s*>\s?\S/m.test(content))
    out.push(
      finding(
        CHECK,
        "llms-txt-missing-summary",
        "info",
        "llms.txt has no blockquote summary under the H1.",
        "Add a blockquote summary after the H1 per llmstxt.org.",
        o,
      ),
    );
  return out;
}

function isUserFacingControl($: CheerioAPI, el: AnyNode) {
  const tag = "tagName" in el ? el.tagName?.toLowerCase() : undefined;
  if (tag === "textarea" || tag === "select") return true;
  if (tag !== "input") return false;
  const type = ($(el).attr("type") ?? "text").toLowerCase();
  return !EXCLUDED_TYPES.has(type);
}

function hasAssociatedLabel($: CheerioAPI, control: AnyNode): boolean {
  const id = $(control).attr("id");
  if (present(id)) {
    const forLabel = $("label[for]").filter(
      (_, label) => $(label).attr("for") === id,
    );
    if (
      forLabel
        .toArray()
        .some((label) => normalizedText($(label).text()).length > 0)
    )
      return true;
  }
  const ancestor = $(control).closest("label");
  return ancestor.length > 0 && normalizedText(ancestor.text()).length > 0;
}

function webmcpFindings(crawl: CrawlResult) {
  const out = [];
  for (const p of crawl.pages) {
    const $ = loadHtml(p.html),
      o = pageOptions(p),
      forms = $("form").toArray(),
      annotated: { toolname: string; tooldescription: string }[] = [];
    for (const formEl of forms) {
      const form = $(formEl),
        toolname = form.attr("toolname"),
        tooldescription = form.attr("tooldescription"),
        hasToolname = present(toolname),
        hasTooldescription = present(tooldescription),
        controls = form
          .find("input,select,textarea")
          .toArray()
          .filter((el) => isUserFacingControl($, el));
      if (hasToolname !== hasTooldescription) {
        const missing = hasToolname ? "tooldescription" : "toolname";
        out.push(
          finding(
            CHECK,
            "webmcp-tool-annotation-incomplete",
            "warning",
            `Form is missing ${missing}; the tool will not be registered.`,
            "Declare both toolname and tooldescription on the form.",
            o,
          ),
        );
        continue;
      }
      if (hasToolname && hasTooldescription) {
        annotated.push({
          toolname: toolname!.trim(),
          tooldescription: tooldescription!.trim(),
        });
        for (const control of controls) {
          const name = $(control).attr("name");
          if (!present(name)) continue;
          const hasParamDescription = present(
              $(control).attr("toolparamdescription"),
            ),
            hasAriaDescription = present($(control).attr("aria-description")),
            hasAriaDescribedby = present(
              $(control).attr("aria-describedby"),
            ),
            hasLabel = hasAssociatedLabel($, control);
          if (
            !hasParamDescription &&
            !hasLabel &&
            !hasAriaDescription &&
            !hasAriaDescribedby
          )
            out.push(
              finding(
                CHECK,
                "webmcp-param-description-missing",
                "info",
                `Field "${name}" in tool "${toolname!.trim()}" has no description.`,
                "Add toolparamdescription, a label, or an aria-description/aria-describedby.",
                o,
              ),
            );
        }
        continue;
      }
      if (controls.length)
        out.push(
          finding(
            CHECK,
            "webmcp-form-uncovered",
            "info",
            "Form has user-facing controls but no WebMCP annotations.",
            "Add declarative WebMCP annotations (toolname/tooldescription) so agents can identify/operate the form.",
            o,
          ),
        );
    }
    const counts = new Map<string, number>();
    for (const { toolname } of annotated)
      counts.set(toolname, (counts.get(toolname) ?? 0) + 1);
    for (const [toolname, count] of counts)
      if (count >= 2)
        out.push(
          finding(
            CHECK,
            "webmcp-tool-name-duplicate",
            "warning",
            `Tool name "${toolname}" is used by multiple forms on this page.`,
            "Give each form a unique toolname.",
            o,
          ),
        );
  }
  return out;
}

export const agentReadinessCheck: CheckDefinition = {
  name: "agentReadiness",
  description:
    "Validates llms.txt recommendations and declarative WebMCP form annotations for AI agents.",
  run({ crawl, config }) {
    return [...llmsTxtFindings(crawl, config), ...webmcpFindings(crawl)];
  },
};
