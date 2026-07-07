export type Severity = "error" | "warning" | "info";
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
}
export interface ReportSummary {
  checkedPages: number;
  errors: number;
  warnings: number;
  info: number;
}
export interface SearchQualityReport {
  tool: "search-quality-kit";
  version: string;
  generatedAt: string;
  mode: "static" | "http";
  target: string;
  summary: ReportSummary;
  findings: Finding[];
  pages: Array<{ url: string; status: number; file?: string }>;
  durationMs: number;
}
