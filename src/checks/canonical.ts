import type { PageArtifact } from "../crawler/types.js";
import { loadHtml } from "../utils/html.js";
import {
  isHttpUrl,
  isLocalOrStaging,
  normalizeUrl,
  sameOrigin,
} from "../utils/urls.js";
import type { CheckDefinition } from "./types.js";
import { finding, pageOptions } from "./types.js";
const G =
  "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls";

function exactUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

function canonicalTargets(pages: PageArtifact[]) {
  const redirecting = new Map<string, PageArtifact>();
  const byFinal = new Map<string, PageArtifact>();
  for (const page of pages) {
    for (const hop of page.redirects ?? []) {
      const key = exactUrl(hop.url);
      if (key && !redirecting.has(key)) redirecting.set(key, page);
    }
    try {
      const key = normalizeUrl(page.finalUrl);
      if (!byFinal.has(key)) byFinal.set(key, page);
    } catch {
      // Malformed final URLs cannot be canonical targets.
    }
  }
  return {
    resolve(canonical: string) {
      const exact = exactUrl(canonical);
      const redirected = exact ? redirecting.get(exact) : undefined;
      if (redirected) return { page: redirected, redirected: true };
      try {
        const page = byFinal.get(normalizeUrl(canonical));
        return page ? { page, redirected: false } : undefined;
      } catch {
        return undefined;
      }
    },
  };
}

function canonicalTargetFinding(
  canonical: string,
  target: { page: PageArtifact; redirected: boolean },
) {
  const { page } = target;
  if (page.status >= 400 && page.status < 500)
    return {
      code: "target-4xx",
      message: `Canonical target ${canonical} returns HTTP ${page.status}.`,
      suggestion: "Point the canonical at a live, indexable URL.",
    };
  if (page.status >= 500)
    return {
      code: "target-5xx",
      message: `Canonical target ${canonical} returns HTTP ${page.status}.`,
      suggestion:
        "Fix the server error on the target, or point the canonical at a live URL.",
    };
  if (page.status === 0)
    return {
      code: "target-unreachable",
      message: `Canonical target ${canonical} did not respond (${page.failure ?? "network"}).`,
      suggestion: "Point the canonical at a URL that answers with HTTP 200.",
    };
  if (target.redirected)
    return {
      code: "target-redirect",
      message: `Canonical target ${canonical} redirects to ${page.finalUrl}.`,
      suggestion: "Use the final URL as the canonical.",
    };
  return undefined;
}
export const canonicalCheck: CheckDefinition = {
  name: "canonical",
  description:
    "Checks canonical presence, uniqueness, public URL, and self-consistency.",
  run({ crawl, config }) {
    const targets = canonicalTargets(crawl.pages);
    const out = [],
      sitemapUrls = new Set(
        crawl.sitemapUrls.flatMap((url) => {
          try {
            return [normalizeUrl(url)];
          } catch {
            return [];
          }
        }),
      );
    for (const p of crawl.pages) {
      const $ = loadHtml(p.html),
        cs = $('link[rel~="canonical"]')
          .map((_, n) => ($(n).attr("href") ?? "").trim())
          .get(),
        o = { ...pageOptions(p), googleDocs: G };
      if (!cs.length) {
        if (config.rules.canonical.required)
          out.push(
            finding(
              "canonical",
              "missing",
              "warning",
              "Page has no canonical link.",
              "Add an absolute canonical URL.",
              o,
            ),
          );
        continue;
      }
      if (cs.length > 1)
        out.push(
          finding(
            "canonical",
            "multiple",
            "error",
            `Page declares ${cs.length} canonicals.`,
            "Declare exactly one.",
            o,
          ),
        );
      const c = cs[0] ?? "";
      if (!c) {
        out.push(
          finding(
            "canonical",
            "empty",
            "error",
            "Canonical is empty.",
            "Set the preferred URL.",
            o,
          ),
        );
        continue;
      }
      if (!isHttpUrl(c)) {
        out.push(
          finding(
            "canonical",
            "not-absolute",
            "error",
            `Canonical is not absolute: ${c}.`,
            "Use a fully qualified URL.",
            o,
          ),
        );
        continue;
      }
      if (isLocalOrStaging(c, config))
        out.push(
          finding(
            "canonical",
            "non-production-url",
            "error",
            `Canonical points to a non-production host: ${c}.`,
            "Use production.",
            o,
          ),
        );
      if (config.site.baseUrl && !sameOrigin(c, config.site.baseUrl))
        out.push(
          finding(
            "canonical",
            "wrong-origin",
            "error",
            `Canonical is outside baseUrl: ${c}.`,
            "Use the configured public origin.",
            o,
          ),
        );
      const target = crawl.mode === "http" ? targets.resolve(c) : undefined;
      if (target && (target.page !== p || target.redirected)) {
        const targetFinding = canonicalTargetFinding(c, target);
        if (targetFinding)
          out.push(
            finding(
              "canonical",
              targetFinding.code,
              "warning",
              targetFinding.message,
              targetFinding.suggestion,
              { ...o, relatedUrls: [c] },
            ),
          );
      }
      if (normalizeUrl(c) !== normalizeUrl(p.url))
        out.push(
          finding(
            "canonical",
            sitemapUrls.has(normalizeUrl(p.url))
              ? "sitemap-canonical-mismatch"
              : "not-self-referencing",
            "warning",
            sitemapUrls.has(normalizeUrl(p.url))
              ? `Sitemap URL '${p.url}' declares a different canonical '${c}'.`
              : `Canonical '${c}' differs from final URL '${p.url}'.`,
            sitemapUrls.has(normalizeUrl(p.url))
              ? "Keep sitemap URLs canonical, or remove the duplicate URL from the sitemap."
              : "Confirm intentional duplicate consolidation or use a self-reference.",
            o,
          ),
        );
      if (
        p.initialUrl !== p.finalUrl &&
        sitemapUrls.has(normalizeUrl(p.initialUrl)) &&
        !sitemapUrls.has(normalizeUrl(p.finalUrl))
      )
        out.push(
          finding(
            "canonical",
            "sitemap-final-url-mismatch",
            "warning",
            `Sitemap contains redirected URL '${p.initialUrl}' instead of final URL '${p.finalUrl}'.`,
            "Publish the final canonical URL in the sitemap.",
            o,
          ),
        );
    }
    return out;
  },
};
