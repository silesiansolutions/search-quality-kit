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
import {
  classificationForCheck,
  legacyBasisForCheck,
} from "./types.js";
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

export type { CheckBasis } from "./types.js";

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
  classification: classificationForCheck(check.name),
  /** @deprecated Use classification. Retained for public API compatibility. */
  basis: legacyBasisForCheck(check.name),
}));
export type { CheckContext, CheckDefinition } from "./types.js";
