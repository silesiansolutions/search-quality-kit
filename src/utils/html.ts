import * as cheerio from "cheerio";
export const loadHtml = (html: string) => cheerio.load(html);
export const normalizedText = (v: string) => v.replace(/\s+/g, " ").trim();
type NodeLike = {
  type?: string;
  data?: string;
  children?: unknown[];
};
type TextOptions = {
  maxChars?: number;
  maxNodes?: number;
};
const DEFAULT_TEXT_MAX_CHARS = 200_000,
  DEFAULT_TEXT_MAX_NODES = 50_000;

function toNodes(value: unknown): unknown[] {
  if (
    value &&
    typeof value === "object" &&
    "toArray" in value &&
    typeof (value as { toArray?: unknown }).toArray === "function"
  )
    return (value as { toArray(): unknown[] }).toArray();
  return [value];
}

export function textFromSelection(value: unknown, options: TextOptions = {}) {
  const maxChars = options.maxChars ?? DEFAULT_TEXT_MAX_CHARS,
    maxNodes = options.maxNodes ?? DEFAULT_TEXT_MAX_NODES,
    nodes = toNodes(value),
    stack = [...nodes].reverse(),
    seen = new Set<object>(),
    out: string[] = [];
  let chars = 0,
    visited = 0;

  while (stack.length && chars < maxChars && visited < maxNodes) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    if (seen.has(current)) continue;
    seen.add(current);
    visited += 1;

    const node = current as NodeLike;
    if (node.type === "text" || node.type === "cdata") {
      const chunk = node.data ?? "";
      if (!chunk) continue;
      const remaining = maxChars - chars,
        value = chunk.length > remaining ? chunk.slice(0, remaining) : chunk;
      out.push(value);
      chars += value.length;
      continue;
    }

    const children = node.children ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1)
      stack.push(children[index]);
  }

  return out.join("");
}

export function visibleText(html: string) {
  const $ = loadHtml(html);
  $("script,style,noscript,template,svg").remove();
  return normalizedText(textFromSelection($("body")));
}
export function metaContent($: cheerio.CheerioAPI, name: string) {
  const lower = name.toLowerCase();
  const el = $("meta").filter(
    (_, n) =>
      ($(n).attr("name") ?? $(n).attr("property") ?? "").toLowerCase() ===
      lower,
  );
  return el.first().attr("content")?.trim() || undefined;
}

export function isHtmlRedirect(html: string): boolean {
  const $ = loadHtml(html);
  const refresh = $('meta[http-equiv="refresh" i]').attr("content") ?? "";
  return /^\s*\d+\s*;\s*url\s*=/i.test(refresh);
}
