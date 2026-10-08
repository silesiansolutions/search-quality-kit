import { loadHtml, normalizedText, textFromSelection } from "../utils/html.js";
import {
  normalizeUrl,
  normalizeUrlWithoutQuery,
  pathAllowed,
  sameOrigin,
} from "../utils/urls.js";
import type { CheckDefinition } from "./types.js";
import { finding, pageOptions } from "./types.js";
const G =
  "https://developers.google.com/search/docs/crawling-indexing/links-crawlable";
const pageLike = (u: URL) => {
  const f = u.pathname.split("/").pop() ?? "";
  return !f.includes(".") || /\.html?$/.test(f);
};
export const internalLinksCheck: CheckDefinition = {
  name: "internalLinks",
  description:
    "Checks empty, malformed, broken, non-production, and orphan links.",
  run({ crawl, config }) {
    const out = [],
      pages = new Map(crawl.pages.map((p) => [normalizeUrl(p.url), p])),
      orphanCandidates = new Map<string, string>();
    if (crawl.mode === "static")
      for (const page of crawl.pages)
        orphanCandidates.set(normalizeUrl(page.url), page.url);
    else
      for (const url of crawl.sitemapUrls)
        if (
          sameOrigin(url, crawl.publicBaseUrl) &&
          pathAllowed(new URL(url).pathname, config)
        )
          orphanCandidates.set(normalizeUrl(url), url);
    const incoming = new Map(
      [...orphanCandidates.keys()].map((url) => [url, 0]),
    );
    const pageByFile = new Map(
      crawl.pages.flatMap((p) =>
        p.file ? [[p.file, normalizeUrl(p.url)]] : [],
      ),
    );
    const incomingKey = (routeKey: string) => {
      if (crawl.mode !== "static" || incoming.has(routeKey)) return routeKey;
      const file = crawl.assets.get(routeKey)?.file;
      return (file && pageByFile.get(file)) ?? routeKey;
    };
    for (const p of crawl.pages) {
      const $ = loadHtml(p.html);
      let internalTargets = 0;
      $("a").each((_, a) => {
        const href = ($(a).attr("href") ?? "").trim(),
          o = { ...pageOptions(p), googleDocs: G };
        if (!href) {
          out.push(
            finding(
              "internal-links",
              "empty-href",
              "warning",
              "Link has no usable href.",
              "Use a crawlable href or a button.",
              o,
            ),
          );
          return;
        }
        if (/^(mailto:|tel:|javascript:|data:|#)/i.test(href)) return;
        let u: URL;
        try {
          u = new URL(href, p.url);
        } catch {
          out.push(
            finding(
              "internal-links",
              "malformed-href",
              "warning",
              `Malformed href: ${href}.`,
              "Use a valid URL.",
              o,
            ),
          );
          return;
        }
        if (/localhost|127\.0\.0\.1|staging|preview/i.test(u.hostname))
          out.push(
            finding(
              "internal-links",
              "non-production-url",
              "error",
              `Link points to a non-production host: ${u}.`,
              "Use production.",
              o,
            ),
          );
        if (
          u.protocol === "http:" &&
          new URL(p.url).protocol === "https:" &&
          u.hostname === new URL(crawl.publicBaseUrl).hostname
        )
          out.push(
            finding(
              "internal-links",
              "https-to-http",
              "warning",
              `HTTPS page links to the insecure internal URL ${u}.`,
              "Link to the HTTPS URL directly.",
              { ...o, relatedUrls: [u.toString()] },
            ),
          );
        if (!sameOrigin(u.toString(), crawl.publicBaseUrl)) return;
        internalTargets += 1;
        const n = normalizeUrl(u.toString());
        const routeKey =
          crawl.mode === "static" ? normalizeUrlWithoutQuery(u.toString()) : n;
        const linked = incomingKey(routeKey);
        if (incoming.has(linked))
          incoming.set(linked, (incoming.get(linked) ?? 0) + 1);
        const target = pages.get(n);
        if (target && target.status >= 400)
          out.push(
            finding(
              "internal-links",
              "broken-route",
              "error",
              `Internal link returns ${target.status}: ${u}.`,
              "Fix or remove it.",
              { ...o, relatedUrls: [u.toString()] },
            ),
          );
        else if (
          crawl.mode === "static" &&
          pageLike(u) &&
          !crawl.assets.has(routeKey)
        )
          out.push(
            finding(
              "internal-links",
              "missing-static-route",
              "error",
              `Internal route is absent from build: ${u.pathname}.`,
              "Generate or correct the route.",
              { ...o, relatedUrls: [u.toString()] },
            ),
          );
        if (
          !normalizedText(textFromSelection($(a))) &&
          !$(a).attr("aria-label") &&
          !$(a).find("img[alt]").length
        )
          out.push(
            finding(
              "internal-links",
              "empty-anchor-text",
              "warning",
              `Link to ${u.pathname} has no text or label.`,
              "Add descriptive link text.",
              o,
            ),
          );
      });
      if (p.status === 200 && internalTargets === 0)
        out.push(
          finding(
            "internal-links",
            "no-outgoing-links",
            "info",
            "Page has no crawlable internal links.",
            "Link to related pages so crawlers can continue from this page.",
            { ...pageOptions(p), googleDocs: G },
          ),
        );
    }
    const entries = new Set(
      config.crawl.entrypoints.map((e) => normalizeUrl(e, crawl.publicBaseUrl)),
    );
    for (const [normalized, count] of incoming) {
      if (count > 0 || entries.has(normalized)) continue;
      const url = orphanCandidates.get(normalized)!;
      out.push(
        finding(
          "internal-links",
          "orphan-page",
          "warning",
          crawl.mode === "http"
            ? `Sitemap page is not reachable from crawled internal links: ${url}.`
            : `Built page has no incoming link: ${url}.`,
          "Add a crawlable internal link or exclude the intentionally isolated route with crawl.exclude.",
          { url, googleDocs: G },
        ),
      );
    }
    return out;
  },
};
