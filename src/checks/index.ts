import { accessibilityCheck } from "./accessibility.js";
import { canonicalCheck } from "./canonical.js";
import { indexabilityCheck } from "./indexability.js";
import { internalLinksCheck } from "./internalLinks.js";
import { metadataCheck } from "./metadata.js";
import { openGraphCheck } from "./openGraph.js";
import { performanceHintsCheck } from "./performanceHints.js";
import { renderedHtmlCheck } from "./renderedHtml.js";
import { robotsCheck } from "./robots.js";
import { sitemapCheck } from "./sitemap.js";
import { structuredDataCheck } from "./structuredData.js";
export const checks = [
  sitemapCheck,
  robotsCheck,
  indexabilityCheck,
  metadataCheck,
  canonicalCheck,
  structuredDataCheck,
  openGraphCheck,
  internalLinksCheck,
  renderedHtmlCheck,
  accessibilityCheck,
  performanceHintsCheck,
];

export type CheckBasis =
  "Google technical requirement" | "Google recommendation" | "local heuristic";

const basis: Record<(typeof checks)[number]["name"], CheckBasis[]> = {
  sitemap: ["Google recommendation", "local heuristic"],
  robots: ["Google technical requirement", "local heuristic"],
  indexability: ["Google technical requirement"],
  metadata: ["Google recommendation", "local heuristic"],
  canonical: ["Google recommendation", "local heuristic"],
  structuredData: ["Google recommendation", "local heuristic"],
  openGraph: ["local heuristic"],
  internalLinks: ["Google recommendation", "local heuristic"],
  renderedHtml: [
    "Google technical requirement",
    "Google recommendation",
    "local heuristic",
  ],
  accessibility: ["local heuristic"],
  performanceHints: ["Google recommendation", "local heuristic"],
};

const severities: Record<
  (typeof checks)[number]["name"],
  readonly ("error" | "warning" | "info")[]
> = {
  sitemap: ["error", "warning"],
  robots: ["error", "warning"],
  indexability: ["error"],
  metadata: ["error", "warning"],
  canonical: ["error", "warning"],
  structuredData: ["error", "warning"],
  openGraph: ["error", "warning"],
  internalLinks: ["error", "warning"],
  renderedHtml: ["error", "warning"],
  accessibility: ["error", "warning"],
  performanceHints: ["error", "warning"],
};

export const checkCatalog = checks.map((check) => ({
  id: check.name,
  description: check.description,
  severities: severities[check.name],
  basis: basis[check.name],
}));
export type { CheckContext, CheckDefinition } from "./types.js";
