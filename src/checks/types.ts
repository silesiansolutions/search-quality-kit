import type { SearchQualityConfig } from "../config/schema.js";
import type { CrawlResult, PageArtifact } from "../crawler/types.js";
import type {
  Finding,
  FindingClassification,
  Severity,
} from "../report/types.js";

export const checkClassifications: Record<string, FindingClassification[]> = {
  sitemap: ["google-recommendation", "local-heuristic"],
  robots: ["google-requirement", "local-heuristic"],
  indexability: ["google-requirement"],
  metadata: ["google-recommendation", "local-heuristic"],
  canonical: ["google-recommendation", "local-heuristic"],
  structuredData: ["google-recommendation", "local-heuristic"],
  "structured-data": ["google-recommendation", "local-heuristic"],
  openGraph: ["cross-channel-metadata", "local-heuristic"],
  "open-graph": ["cross-channel-metadata", "local-heuristic"],
  internalLinks: ["google-recommendation", "local-heuristic"],
  "internal-links": ["google-recommendation", "local-heuristic"],
  renderedHtml: [
    "google-requirement",
    "google-recommendation",
    "local-heuristic",
  ],
  "rendered-html": [
    "google-requirement",
    "google-recommendation",
    "local-heuristic",
  ],
  accessibility: ["accessibility-basic"],
  performanceHints: ["google-recommendation", "local-heuristic"],
  "performance-hints": ["google-recommendation", "local-heuristic"],
};

export const classificationForCheck = (check: string) =>
  checkClassifications[check] ?? ["local-heuristic" as const];

export type CheckBasis =
  "Google requirement" | "Google recommendation" | "local heuristic";

const legacyBasis: Record<string, CheckBasis> = {
  "google-requirement": "Google requirement",
  "google-recommendation": "Google recommendation",
  "local-heuristic": "local heuristic",
  "cross-channel-metadata": "local heuristic",
  "accessibility-basic": "local heuristic",
};

export const legacyBasisForCheck = (check: string) => [
  ...new Set(
    classificationForCheck(check).map(
      (classification) => legacyBasis[classification] ?? "local heuristic",
    ),
  ),
];
export interface CheckContext {
  config: SearchQualityConfig;
  crawl: CrawlResult;
}
export interface CheckDefinition {
  name: keyof SearchQualityConfig["checks"];
  description: string;
  run(c: CheckContext): Promise<Finding[]> | Finding[];
}
export function finding(
  check: string,
  code: string,
  severity: Severity,
  message: string,
  suggestion: string,
  options: Partial<
    Pick<Finding, "url" | "file" | "googleDocs" | "relatedUrls">
  > = {},
): Finding {
  return {
    severity,
    check,
    code,
    message,
    suggestion,
    docs: `https://github.com/SilesianSolutions/search-quality-kit/blob/master/docs/checks.md#${check}`,
    classification: classificationForCheck(check),
    ...options,
  };
}
export const pageOptions = (p: PageArtifact) => ({ url: p.url, file: p.file });
