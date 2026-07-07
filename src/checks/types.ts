import type { SearchQualityConfig } from "../config/schema.js";
import type { CrawlResult, PageArtifact } from "../crawler/types.js";
import type { Finding, Severity } from "../report/types.js";
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
    ...options,
  };
}
export const pageOptions = (p: PageArtifact) => ({ url: p.url, file: p.file });
