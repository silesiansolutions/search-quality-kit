import { pageResources } from "../crawler/resources.js";
import type { ResourceKind } from "../crawler/types.js";
import { normalizeUrl, sameOrigin } from "../utils/urls.js";
import type { CheckDefinition } from "./types.js";
import { finding } from "./types.js";

const BROKEN_CODE: Record<ResourceKind, string> = {
  image: "broken-image",
  script: "broken-script",
  stylesheet: "broken-stylesheet",
};

function withoutQuery(url: string) {
  const parsed = new URL(url);
  parsed.search = "";
  return normalizeUrl(parsed.toString());
}

function pageList(pages: string[]) {
  return pages.length === 1 ? "1 page" : `${pages.length} pages`;
}

export const assetsCheck: CheckDefinition = {
  name: "assets",
  description:
    "Checks that same-origin images, scripts, and stylesheets exist in the build (static) or answer with a success status (HTTP).",
  run({ crawl, config }) {
    const out = [];
    if (crawl.mode === "static") {
      const missing = new Map<
        string,
        { kind: ResourceKind; pages: string[] }
      >();
      for (const p of crawl.pages)
        for (const resource of pageResources(p.html, p.url)) {
          if (!sameOrigin(resource.url, crawl.publicBaseUrl)) continue;
          let key: string;
          try {
            key = withoutQuery(resource.url);
          } catch {
            continue;
          }
          if (crawl.assets.has(key)) continue;
          const entry = missing.get(key) ?? { kind: resource.kind, pages: [] };
          if (!entry.pages.includes(p.url)) entry.pages.push(p.url);
          missing.set(key, entry);
        }
      for (const [url, entry] of missing) {
        const pages = [...entry.pages].sort();
        out.push(
          finding(
            "assets",
            "missing-static-asset",
            "warning",
            `Referenced ${entry.kind} is absent from the build output: ${new URL(url).pathname} (${pageList(pages)}).`,
            "Emit the file in the build, or fix the reference.",
            { url: pages[0]!, relatedUrls: [url, ...pages.slice(1)] },
          ),
        );
      }
      return out;
    }
    for (const resource of crawl.resources ?? []) {
      if (resource.status >= 200 && resource.status < 400) continue;
      const pages = resource.referencedBy;
      out.push(
        finding(
          "assets",
          BROKEN_CODE[resource.kind],
          "warning",
          resource.status
            ? `Referenced ${resource.kind} returns HTTP ${resource.status}: ${resource.url} (${pageList(pages)}).`
            : `Referenced ${resource.kind} did not respond (${resource.failure ?? "network"}): ${resource.url} (${pageList(pages)}).`,
          "Publish the resource, or fix the reference.",
          {
            ...(pages[0] ? { url: pages[0] } : {}),
            relatedUrls: [resource.url, ...pages.slice(1)],
          },
        ),
      );
    }
    if (crawl.resourcesTruncated)
      out.push(
        finding(
          "assets",
          "request-limit",
          "info",
          `Resource requests stopped at crawl.maxResources (${config.crawl.maxResources}); the remaining resources were not checked.`,
          "Raise crawl.maxResources if every resource must be verified.",
          { url: crawl.publicBaseUrl },
        ),
      );
    return out;
  },
};
