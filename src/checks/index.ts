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
export type { CheckContext, CheckDefinition } from "./types.js";
