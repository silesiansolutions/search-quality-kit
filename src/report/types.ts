export type Severity = "error" | "warning" | "info";
export const REPORT_SCHEMA_VERSION = "0.3" as const;
export type FindingClassification =
  | "google-requirement"
  | "google-recommendation"
  | "local-heuristic"
  | "cross-channel-metadata"
  | "accessibility-basic"
  | "profile-expectation"
  /** @deprecated Read legacy v0.3 reports only; new reports use kebab-case values. */
  | "Google requirement"
  /** @deprecated Read legacy v0.3 reports only; new reports use kebab-case values. */
  | "Google recommendation"
  /** @deprecated Read legacy v0.3 reports only; new reports use kebab-case values. */
  | "local heuristic";
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
  impact?: "technical-error" | "recommendation" | "profile-expectation";
  activeProfile?: string;
  expectedStructuredData?: string[];
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
    activeProfile?: string;
    expectedStructuredData?: string[];
    matchedProfilePattern?: string;
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
