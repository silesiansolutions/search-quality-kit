import { loadHtml, metaContent } from "../utils/html.js";
import { normalizeUrl, sameOrigin } from "../utils/urls.js";
import type { FetchFailure, PageArtifact } from "../crawler/types.js";
import type { CheckDefinition } from "./types.js";
import { finding, pageOptions } from "./types.js";

const FAILURE_SUGGESTIONS: Record<FetchFailure, string> = {
  timeout: "The request timed out. Make the page respond within crawl.requestTimeoutMs.",
  dns: "The host name did not resolve. Check DNS for the audited origin.",
  "connection-refused":
    "The server refused the connection. Check that the origin is listening.",
  tls: "The TLS handshake failed. Check the certificate chain and host name.",
  "redirect-loop":
    "The redirect chain loops back to a URL it already visited. Point every hop at the final URL.",
  "too-many-redirects":
    "The redirect chain exceeded crawl.maxRedirects. Redirect straight to the final URL.",
  network: "The request failed without an HTTP response. Check the origin.",
};

function statusFinding(p: PageArtifact) {
  if (p.status >= 400 && p.status < 500)
    return {
      code: "4xx",
      suggestion:
        "Serve indexable pages with HTTP 200, or remove links and sitemap entries that point at the missing URL.",
    };
  if (p.status >= 500)
    return {
      code: "5xx",
      suggestion:
        "Serve indexable pages with HTTP 200. Persistent server errors make Google slow down crawling and drop the URL.",
    };
  if (p.status === 0) {
    const failure = p.failure ?? "network";
    return {
      code: failure === "timeout" ? "timeout" : "unreachable",
      suggestion: FAILURE_SUGGESTIONS[failure],
    };
  }
  return { code: "non-200", suggestion: "Serve indexable pages with HTTP 200." };
}

export const indexabilityCheck: CheckDefinition = {
  name: "indexability",
  description: "Checks HTTP status and accidental noindex directives.",
  run({ crawl }) {
    const out = [];
    for (const p of crawl.pages) {
      if (
        normalizeUrl(p.initialUrl) !== normalizeUrl(p.finalUrl) &&
        !sameOrigin(p.finalUrl, crawl.publicBaseUrl)
      )
        out.push(
          finding(
            "indexability",
            "redirect-outside-origin",
            "error",
            `Internal URL ${p.initialUrl} redirects outside the public origin to ${p.finalUrl}.`,
            "Keep internal redirects on the configured public origin or update the entrypoint and baseUrl intentionally.",
            {
              ...pageOptions(p),
              relatedUrls: [p.initialUrl, p.finalUrl],
              googleDocs:
                "https://developers.google.com/search/docs/crawling-indexing/301-redirects",
            },
          ),
        );
      if (p.status !== 200) {
        const status = statusFinding(p);
        out.push(
          finding(
            "indexability",
            status.code,
            "error",
            `Page returned HTTP ${p.status || "network failure"}.`,
            status.suggestion,
            {
              ...pageOptions(p),
              googleDocs:
                "https://developers.google.com/search/docs/essentials/technical",
            },
          ),
        );
      }
      const $ = loadHtml(p.html),
        robots =
          `${metaContent($, "robots") ?? ""},${metaContent($, "googlebot") ?? ""},${p.headers["x-robots-tag"] ?? ""}`.toLowerCase();
      if (/(?:^|[,\s])(?:noindex|none)(?:$|[,\s])/.test(robots))
        out.push(
          finding(
            "indexability",
            "noindex",
            "error",
            "Page is marked noindex.",
            "Remove noindex or exclude the route intentionally.",
            {
              ...pageOptions(p),
              googleDocs:
                "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag",
            },
          ),
        );
    }
    return out;
  },
};
