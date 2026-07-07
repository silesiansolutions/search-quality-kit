import type { Finding, SearchQualityReport } from "./types.js";

const normalize = (value?: string) =>
  (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

export function findingFingerprint(finding: Finding) {
  return [
    normalize(finding.check),
    normalize(finding.code),
    normalize(finding.url),
    normalize(finding.file),
    normalize(finding.message),
  ].join("\u0000");
}

export function newFindings(
  report: SearchQualityReport,
  baseline: SearchQualityReport,
) {
  const known = new Set(baseline.findings.map(findingFingerprint));
  return report.findings.filter(
    (finding) => !known.has(findingFingerprint(finding)),
  );
}
