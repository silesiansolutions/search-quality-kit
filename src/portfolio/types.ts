import type { Finding, ReportSummary, Severity } from "../report/types.js";

export const PORTFOLIO_REPORT_SCHEMA_VERSION = "0.7" as const;

export type PortfolioSiteStatus =
  "passed" | "failed" | "error" | "skipped" | "disabled";

export interface PortfolioFindingHighlight {
  site: string;
  severity: Severity;
  code: string;
  message: string;
  url?: string;
}

export interface PortfolioSiteReport {
  name: string;
  status: PortfolioSiteStatus;
  reportPath?: string;
  markdownReportPath?: string;
  sarifReportPath?: string;
  summary: ReportSummary & {
    totalFindings: number;
    existingFindings: number;
    newFindings: number;
    resolvedFindings: number;
    suppressedFindings: number;
  };
  baseline: {
    status: "used" | "not-configured" | "missing" | "invalid";
    path?: string;
    message?: string;
  };
  operationalError?: {
    stage: "config" | "verification" | "plugin" | "baseline" | "output";
    message: string;
  };
  findings?: Array<Finding & { site: string }>;
}

export interface PortfolioReport {
  schemaVersion: typeof PORTFOLIO_REPORT_SCHEMA_VERSION;
  tool: {
    name: "@silesiansolutions/search-quality-kit";
    version: string;
  };
  generatedAt: string;
  portfolio: {
    sitesTotal: number;
    sitesPassed: number;
    sitesFailed: number;
    sitesSkipped: number;
    totalPages: number;
    totalFindings: number;
    newFindings: number;
    resolvedFindings: number;
    suppressedFindings: number;
    errors: number;
    warnings: number;
    infos: number;
    operationalErrors: number;
  };
  sites: PortfolioSiteReport[];
  highlights: {
    newFindings: PortfolioFindingHighlight[];
    errors: PortfolioFindingHighlight[];
    warnings: PortfolioFindingHighlight[];
    resolved: PortfolioFindingHighlight[];
  };
  gate: {
    status: "passed" | "failed";
    reportOnly: boolean;
    failOn: Severity[];
    failOnNew: boolean;
    reason: string;
    failures: Array<{
      site: string;
      type: "finding" | "operational";
      severity?: Severity;
      count?: number;
      message: string;
    }>;
  };
}

export const emptyPortfolioSiteSummary = () => ({
  checkedPages: 0,
  errors: 0,
  warnings: 0,
  info: 0,
  totalFindings: 0,
  existingFindings: 0,
  newFindings: 0,
  resolvedFindings: 0,
  suppressedFindings: 0,
});
