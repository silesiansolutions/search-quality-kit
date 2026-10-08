import type { PageArtifact } from "../crawler/types.js";
import { loadHtml } from "../utils/html.js";
import { sameOrigin } from "../utils/urls.js";
import type { CheckDefinition } from "./types.js";
import { finding, pageOptions } from "./types.js";

const G =
  "https://developers.google.com/search/docs/crawling-indexing/301-redirects";

function exactUrl(value: string, base?: string) {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

function chainUrls(p: PageArtifact) {
  return [...(p.redirects ?? []).map((hop) => hop.url), p.finalUrl];
}

export const redirectsCheck: CheckDefinition = {
  name: "redirects",
  description:
    "Checks redirect loops, chains, broken redirect targets, and internal links that point at redirects (HTTP mode).",
  run({ crawl }) {
    if (crawl.mode !== "http") return [];
    const out = [];
    const redirecting = new Map<string, PageArtifact>();
    for (const p of [...crawl.pages, ...(crawl.documents ?? [])]) {
      const hops = p.redirects ?? [];
      if (!hops.length) continue;
      for (const hop of hops) {
        const key = exactUrl(hop.url);
        if (key && !redirecting.has(key)) redirecting.set(key, p);
      }
      const o = {
        url: p.initialUrl,
        relatedUrls: chainUrls(p),
        googleDocs: G,
      };
      if (p.failure === "redirect-loop") {
        out.push(
          finding(
            "redirects",
            "loop",
            "warning",
            `Redirect chain starting at ${p.initialUrl} loops back to ${p.finalUrl}.`,
            "Point every redirect at the final URL that answers with HTTP 200.",
            o,
          ),
        );
        continue;
      }
      if (p.status >= 400 || p.status === 0) {
        out.push(
          finding(
            "redirects",
            "broken",
            "warning",
            p.status
              ? `Redirect from ${p.initialUrl} ends at ${p.finalUrl} with HTTP ${p.status}.`
              : `Redirect from ${p.initialUrl} ends without a response (${p.failure ?? "network"}).`,
            "Redirect to a live URL, or return 404/410 from the original URL directly.",
            o,
          ),
        );
        continue;
      }
      if (hops.length > 1)
        out.push(
          finding(
            "redirects",
            "chain",
            "warning",
            `${p.initialUrl} reaches ${p.finalUrl} through ${hops.length} redirects.`,
            "Redirect the first URL straight to the final URL.",
            o,
          ),
        );
    }
    if (!redirecting.size) return out;
    for (const p of crawl.pages) {
      if (p.status < 200 || p.status >= 300) continue;
      const $ = loadHtml(p.html);
      const reported = new Set<string>();
      $("a[href]").each((_, a) => {
        const href = ($(a).attr("href") ?? "").trim();
        if (!href || /^(mailto:|tel:|javascript:|data:|#)/i.test(href)) return;
        const target = exactUrl(href, p.url);
        if (
          !target ||
          reported.has(target) ||
          !sameOrigin(target, crawl.publicBaseUrl)
        )
          return;
        const destination = redirecting.get(target);
        if (!destination) return;
        reported.add(target);
        out.push(
          finding(
            "redirects",
            "internal-link-to-redirect",
            "warning",
            `Internal link to ${target} is redirected to ${destination.finalUrl}.`,
            "Link to the final URL directly.",
            {
              ...pageOptions(p),
              relatedUrls: [target, destination.finalUrl],
              googleDocs: G,
            },
          ),
        );
      });
    }
    return out;
  },
};
