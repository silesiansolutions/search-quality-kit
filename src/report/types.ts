export type Severity = "error" | "warning" | "info";
export const REPORT_SCHEMA_VERSION = "0.3" as const;
export type FindingClassification =
  "Google requirement" | "Google recommendation" | "local heuristic";
export interface Finding {
  severity: Severity;
  check: string;
  code: string;
  message: string;
  suggestion: string;
  url?: string;
  file?: string;
  docs: string;
  googleDocs?: string;
  relatedUrls?: string[];
  classification?: FindingClassification[];
}
export interface ReportSummary {
  checkedPages: number;
  errors: number;
  warnings: number;
  info: number;
}
export interface SearchQualityReport {
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  tool: "search-quality-kit";
  version: string;
  generatedAt: string;
  mode: "static" | "http";
  target: string;
  summary: ReportSummary;
  findings: Finding[];
  pages: Array<{
    url: string;
    initialUrl?: string;
    finalUrl?: string;
    status: number;
    file?: string;
  }>;
  durationMs: number;
  baseline?: {
    summary: {
      totalFindings: number;
      existingFindings: number;
      newFindings: number;
      resolvedFindings: number;
    };
    newFindings: Finding[];
    resolvedFindings: Finding[];
  };
}

export type LegacySearchQualityReport = Omit<
  SearchQualityReport,
  "schemaVersion" | "baseline"
> & {
  schemaVersion?: undefined;
};
