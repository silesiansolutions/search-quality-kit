import type { SearchQualityConfig } from "../config/schema.js";
import type { CrawlResult, PageArtifact } from "../crawler/types.js";
import type {
  Finding,
  FindingClassification,
  Severity,
} from "../report/types.js";

const classifications: Record<string, FindingClassification[]> = {
  sitemap: ["Google recommendation", "local heuristic"],
  robots: ["Google requirement", "local heuristic"],
  indexability: ["Google requirement"],
  metadata: ["Google recommendation", "local heuristic"],
  canonical: ["Google recommendation", "local heuristic"],
  "structured-data": ["Google recommendation", "local heuristic"],
  "open-graph": ["local heuristic"],
  "internal-links": ["Google recommendation", "local heuristic"],
  "rendered-html": [
    "Google requirement",
    "Google recommendation",
    "local heuristic",
  ],
  accessibility: ["local heuristic"],
  "performance-hints": ["Google recommendation", "local heuristic"],
};

export const classificationForCheck = (check: string) =>
  classifications[check] ?? ["local heuristic" as const];
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
