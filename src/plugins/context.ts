import type { SearchQualityConfig } from "../config/schema.js";
import type { CrawlResult } from "../crawler/types.js";
import {
  loadHtml,
  metaContent,
  normalizedText,
  visibleText,
} from "../utils/html.js";
import type {
  PluginCheckContext,
  PluginConfig,
  PluginPage,
  PluginPageLink,
} from "./types.js";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function parsedStructuredData(html: string) {
  const $ = loadHtml(html),
    data: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      data.push(JSON.parse($(element).text()) as unknown);
    } catch {
      // Core reports malformed JSON-LD. Plugins still receive rawHtml.
    }
  });
  return data;
}

function pageLinks(html: string, baseUrl: string): PluginPageLink[] {
  const $ = loadHtml(html),
    links: PluginPageLink[] = [];
  $("a[href]").each((_, element) => {
    const href = ($(element).attr("href") ?? "").trim();
    let url: string | undefined;
    try {
      url = new URL(href, baseUrl).toString();
    } catch {
      // Keep the raw href so a plugin can inspect malformed links.
    }
    links.push({
      href,
      ...(url ? { url } : {}),
      text: normalizedText($(element).text()),
      rel: ($(element).attr("rel") ?? "")
        .split(/\s+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    });
  });
  return links;
}

function pluginPage(page: CrawlResult["pages"][number]): PluginPage {
  const $ = loadHtml(page.html),
    openGraph: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, element) => {
    const property = ($(element).attr("property") ?? "").trim(),
      content = ($(element).attr("content") ?? "").trim();
    if (property && content && openGraph[property] === undefined)
      openGraph[property] = content;
  });
  return deepFreeze({
    url: page.url,
    initialUrl: page.initialUrl,
    finalUrl: page.finalUrl,
    statusCode: page.status,
    rawHtml: page.html,
    visibleText: visibleText(page.html),
    metadata: {
      title: normalizedText($("title").first().text()) || undefined,
      description: metaContent($, "description"),
      canonical: $('link[rel~="canonical"]').first().attr("href")?.trim(),
      robots: metaContent($, "robots"),
      language: $("html").first().attr("lang")?.trim(),
      openGraph,
    },
    links: pageLinks(page.html, page.finalUrl),
    structuredData: parsedStructuredData(page.html),
    ...(page.file ? { file: page.file } : {}),
  });
}

export function createPluginContext(
  config: SearchQualityConfig,
  crawl: CrawlResult,
): PluginCheckContext {
  const publicConfig = Object.fromEntries(
    Object.entries(config).filter(([key]) => key !== "plugins"),
  ) as Omit<SearchQualityConfig, "plugins">;
  const configSnapshot = structuredClone(publicConfig) as PluginConfig;
  return deepFreeze({
    pages: crawl.pages.map(pluginPage),
    config: configSnapshot,
  });
}
