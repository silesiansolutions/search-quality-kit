import { unsuppressedFindings } from "../suppressions.js";
import { errorFreeUrlSummary } from "./errorFreeUrlRate.js";
import type { Finding, ReportSummary, Severity } from "./types.js";

export function reportSummary(
  pages: readonly { url: string }[],
  findings: readonly Finding[],
  unmatchedSuppressions = 0,
): ReportSummary {
  const active = unsuppressedFindings([...findings]);
  const count = (severity: Severity) =>
    active.filter((finding) => finding.severity === severity).length;
  return {
    checkedPages: pages.length,
    errors: count("error"),
    warnings: count("warning"),
    info: count("info"),
    suppressedFindings: findings.length - active.length,
    ...(unmatchedSuppressions ? { unmatchedSuppressions } : {}),
    ...errorFreeUrlSummary(pages, findings),
  };
}
