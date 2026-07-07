import * as cheerio from "cheerio";
export const loadHtml = (html: string) => cheerio.load(html);
export const normalizedText = (v: string) => v.replace(/\s+/g, " ").trim();
export function visibleText(html: string) {
  const $ = loadHtml(html);
  $("script,style,noscript,template,svg").remove();
  return normalizedText($("body").text());
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
