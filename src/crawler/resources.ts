import { loadHtml } from "../utils/html.js";
import { srcsetCandidates } from "../utils/srcset.js";
import { normalizeUrl } from "../utils/urls.js";
import type { ResourceKind } from "./types.js";

export interface PageResource {
  url: string;
  kind: ResourceKind;
}

function resolve(raw: string | undefined, pageUrl: string) {
  const value = raw?.trim();
  if (!value || /^(data:|blob:|javascript:|about:)/i.test(value))
    return undefined;
  try {
    const url = normalizeUrl(value, pageUrl);
    return /^https?:/.test(url) ? url : undefined;
  } catch {
    return undefined;
  }
}

export function pageResources(html: string, pageUrl: string): PageResource[] {
  const $ = loadHtml(html);
  const found = new Map<string, PageResource>();
  const add = (url: string | undefined, kind: ResourceKind) => {
    if (url && !found.has(url)) found.set(url, { url, kind });
  };
  $("img").each((_, image) => {
    add(resolve($(image).attr("src"), pageUrl), "image");
    const srcset = $(image).attr("srcset");
    if (srcset)
      for (const candidate of srcsetCandidates(srcset, pageUrl))
        add(resolve(candidate.url, pageUrl), "image");
  });
  $("picture source[srcset]").each((_, source) => {
    for (const candidate of srcsetCandidates(
      $(source).attr("srcset") ?? "",
      pageUrl,
    ))
      add(resolve(candidate.url, pageUrl), "image");
  });
  $("script[src]").each((_, script) => {
    add(resolve($(script).attr("src"), pageUrl), "script");
  });
  $("link[href]").each((_, link) => {
    const rel = ($(link).attr("rel") ?? "").toLowerCase().split(/\s+/);
    if (rel.includes("stylesheet"))
      add(resolve($(link).attr("href"), pageUrl), "stylesheet");
  });
  return [...found.values()];
}
