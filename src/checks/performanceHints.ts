import path from "node:path";
import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import { loadHtml } from "../utils/html.js";
import { isLocalOrStaging, normalizeUrl, sameOrigin } from "../utils/urls.js";
import type { CheckDefinition } from "./types.js";
import { finding, pageOptions } from "./types.js";

const G =
  "https://developers.google.com/search/docs/appearance/core-web-vitals";

interface ImageCandidate {
  url: string;
  descriptor?: string;
}

function srcsetCandidates(value: string, base: string): ImageCandidate[] {
  return value
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .flatMap((candidate) => {
      const match = candidate.match(/^(\S+)(?:\s+(\d+(?:\.\d+)?[wx]))?$/);
      if (!match?.[1]) return [];
      try {
        return [
          {
            url: normalizeUrl(match[1], base),
            ...(match[2] ? { descriptor: match[2] } : {}),
          },
        ];
      } catch {
        return [];
      }
    });
}

function basicSizesHint(value?: string) {
  if (!value) return undefined;
  const lengths = [...value.matchAll(/(?:^|[\s,])(\d+(?:\.\d+)?)(px|vw)\b/g)];
  const last = lengths.at(-1);
  return last ? `${last[1]}${last[2]}` : undefined;
}

function imageCandidates($: CheerioAPI, image: AnyNode, pageUrl: string) {
  const candidates: ImageCandidate[] = [];
  const src = $(image).attr("src");
  if (src)
    try {
      candidates.push({ url: normalizeUrl(src, pageUrl) });
    } catch {
      // Malformed image URLs are outside this performance heuristic.
    }
  const srcsets = [$(image).attr("srcset")];
  const picture = $(image).closest("picture");
  if (picture.length)
    picture.find("source[srcset]").each((_, source) => {
      srcsets.push($(source).attr("srcset"));
    });
  for (const srcset of srcsets)
    if (srcset) candidates.push(...srcsetCandidates(srcset, pageUrl));
  return [
    ...new Map(
      candidates.map((candidate) => [candidate.url, candidate]),
    ).values(),
  ];
}

export const performanceHintsCheck: CheckDefinition = {
  name: "performanceHints",
  description:
    "Static hints for HTML weight, scripts, responsive images, lazy loading, and host leaks; not Core Web Vitals measurements.",
  run({ crawl, config }) {
    const out = [];
    const reportedLargeAssets = new Set<string>();
    const reportedImageGroups = new Set<string>();
    const reportedNonProductionAssets = new Set<string>();
    for (const p of crawl.pages) {
      const $ = loadHtml(p.html),
        o = { ...pageOptions(p), googleDocs: G };
      if (p.bytes > config.rules.performance.maxHtmlBytes)
        out.push(
          finding(
            "performance-hints",
            "heavy-html",
            "warning",
            `HTML is ${(p.bytes / 1024).toFixed(0)} KiB. This is a static payload hint, not a Core Web Vitals result.`,
            "Reduce payload where practical and verify impact with browser or field measurements.",
            o,
          ),
        );
      const scripts = $("script[src]").filter((_, e) => {
        try {
          return !sameOrigin(
            new URL($(e).attr("src")!, p.url).toString(),
            crawl.publicBaseUrl,
          );
        } catch {
          return false;
        }
      });
      if (scripts.length > config.rules.performance.maxExternalScripts)
        out.push(
          finding(
            "performance-hints",
            "many-external-scripts",
            "warning",
            `Page loads ${scripts.length} external scripts. This static count does not measure INP or blocking time.`,
            "Audit their necessity and verify runtime cost in a browser.",
            o,
          ),
        );

      const groups = new Map<
        string,
        { candidates: ImageCandidate[]; loading?: string; sizes?: string }
      >();
      $("img[src],img[srcset]").each((_, image) => {
        const candidates = imageCandidates($, image, p.url);
        if (!candidates.length) return;
        const key = candidates
          .map((candidate) => candidate.url)
          .sort()
          .join("\n");
        if (!groups.has(key))
          groups.set(key, {
            candidates,
            loading: $(image).attr("loading"),
            sizes:
              $(image).attr("sizes") ??
              $(image)
                .closest("picture")
                .find("source[sizes]")
                .first()
                .attr("sizes"),
          });
      });

      const eager = [...groups.values()].filter(
        (group, index) => index > 0 && group.loading !== "lazy",
      );
      if (groups.size >= 4 && eager.length >= 3)
        out.push(
          finding(
            "performance-hints",
            "images-not-lazy",
            "warning",
            `${eager.length} distinct non-primary image groups are not lazy-loaded.`,
            "Consider lazy loading for below-fold images, then verify behavior in a browser.",
            o,
          ),
        );

      for (const [key, group] of groups) {
        for (const candidate of group.candidates)
          if (
            isLocalOrStaging(candidate.url, config) &&
            !reportedNonProductionAssets.has(candidate.url)
          ) {
            reportedNonProductionAssets.add(candidate.url);
            out.push(
              finding(
                "performance-hints",
                "non-production-asset",
                "error",
                `Image points to non-production: ${candidate.url}.`,
                "Use a production or relative URL.",
                o,
              ),
            );
          }
        if (reportedImageGroups.has(key)) continue;
        const large = group.candidates
          .map((candidate) => ({
            ...candidate,
            asset: crawl.assets.get(candidate.url),
          }))
          .filter(
            (candidate) =>
              candidate.asset?.bytes &&
              candidate.asset.bytes >
                config.rules.performance.largeImageBytes &&
              !reportedLargeAssets.has(candidate.url),
          )
          .sort((a, b) => (b.asset?.bytes ?? 0) - (a.asset?.bytes ?? 0));
        if (!large.length) continue;
        reportedImageGroups.add(key);
        group.candidates.forEach((candidate) =>
          reportedLargeAssets.add(candidate.url),
        );
        const largest = large[0]!;
        const sizeHint = basicSizesHint(group.sizes);
        out.push(
          finding(
            "performance-hints",
            "large-image",
            "warning",
            large.length > 1
              ? `Responsive image group has ${large.length} variants above ${(config.rules.performance.largeImageBytes / 1024).toFixed(0)} KiB; the largest (${path.basename(new URL(largest.url).pathname)}) is ${((largest.asset?.bytes ?? 0) / 1024).toFixed(0)} KiB${sizeHint ? ` with a basic sizes hint of ${sizeHint}` : ""}.`
              : `Image ${path.basename(new URL(largest.url).pathname)} is ${((largest.asset?.bytes ?? 0) / 1024).toFixed(0)} KiB${sizeHint ? ` with a basic sizes hint of ${sizeHint}` : ""}.`,
            "This is a static byte hint, not an LCP/INP/CLS result. Resize or compress candidates where appropriate, then verify transfer and rendering in a browser.",
            {
              ...o,
              file: largest.asset?.file ?? o.file,
              relatedUrls: large.map((candidate) => candidate.url),
            },
          ),
        );
      }

      $("script[src],link[href]").each((_, e) => {
        const raw = $(e).attr("src") ?? $(e).attr("href");
        if (!raw) return;
        try {
          const url = new URL(raw, p.url).toString();
          if (
            isLocalOrStaging(url, config) &&
            !reportedNonProductionAssets.has(url)
          ) {
            reportedNonProductionAssets.add(url);
            out.push(
              finding(
                "performance-hints",
                "non-production-asset",
                "error",
                `Asset points to non-production: ${url}.`,
                "Use a production or relative URL.",
                o,
              ),
            );
          }
        } catch {
          // Malformed asset URLs are covered by link checks.
        }
      });
    }
    return out;
  },
};
