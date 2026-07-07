import { classificationForCheck } from "../checks/types.js";
import { withoutFindings } from "./baseline.js";
import type { Finding, SearchQualityReport, Severity } from "./types.js";

const RESOLVED_LIMIT = 20;
const severityOrder: Severity[] = ["error", "warning", "info"];
const text = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .trim()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const code = (value: string) => `\`${value.replaceAll("`", "\\`")}\``;

function groups(findings: Finding[]) {
  const bySeverity = new Map<Severity, Map<string, Finding[]>>();
  for (const finding of findings) {
    const key = `${finding.check}/${finding.code}`;
    const byCode =
      bySeverity.get(finding.severity) ?? new Map<string, Finding[]>();
    byCode.set(key, [...(byCode.get(key) ?? []), finding]);
    bySeverity.set(finding.severity, byCode);
  }
  return bySeverity;
}

function findingLines(finding: Finding) {
  const classification =
    finding.classification ?? classificationForCheck(finding.check);
  const documentation = [
    finding.docs ? `[check documentation](${finding.docs})` : undefined,
    finding.googleDocs
      ? `[Google documentation](${finding.googleDocs})`
      : undefined,
  ].filter(Boolean);
  return [
    `- **URL / route:** ${finding.url ? code(finding.url) : "—"}`,
    `  - **Location:** ${finding.file ? code(finding.file) : "—"}`,
    `  - **Message:** ${text(finding.message)}`,
    `  - **Remediation:** ${text(finding.suggestion)}`,
    `  - **Classification:** ${classification.map(text).join(", ")}`,
    `  - **Documentation:** ${documentation.join(" · ") || "—"}`,
  ];
}

function section(title: string, findings: Finding[]) {
  const lines = [`## ${title}`, ""];
  if (!findings.length) return [...lines, "No findings.", ""];
  const grouped = groups(findings);
  for (const severity of severityOrder) {
    const byCode = grouped.get(severity);
    if (!byCode) continue;
    lines.push(`### ${severity[0]!.toUpperCase()}${severity.slice(1)}`, "");
    for (const [key, items] of byCode) {
      lines.push(`#### ${code(key)} (${items.length})`, "");
      for (const finding of items) lines.push(...findingLines(finding), "");
    }
  }
  return lines;
}

function collapsedSection(title: string, findings: Finding[]) {
  if (!findings.length) return [`## ${title}`, "", "No findings.", ""];
  return [
    "<details>",
    `<summary>${title} (${findings.length})</summary>`,
    "",
    ...section(title, findings),
    "</details>",
    "",
  ];
}

export function formatMarkdownReport(report: SearchQualityReport) {
  const lines = [
    "# Search Quality Report",
    "",
    `- Target: ${code(report.target)}`,
    `- Mode: ${report.mode}`,
    `- Scanned pages: ${report.summary.checkedPages}`,
    `- Total findings: ${report.findings.length}`,
    `- Errors: ${report.summary.errors}`,
    `- Warnings: ${report.summary.warnings}`,
    `- Info: ${report.summary.info}`,
  ];

  if (report.baseline) {
    lines.push(
      `- Existing findings: ${report.baseline.summary.existingFindings}`,
      `- New findings: ${report.baseline.summary.newFindings}`,
      `- Resolved findings: ${report.baseline.summary.resolvedFindings}`,
      "",
      ...section("New findings", report.baseline.newFindings),
    );
    lines.push(
      ...collapsedSection(
        "Existing findings",
        withoutFindings(
          report.findings,
          report.baseline.newFindings,
          report.target,
        ),
      ),
    );
    lines.push(...resolvedSection(report.baseline.resolvedFindings));
  } else {
    lines.push("", ...section("Findings", report.findings));
  }

  lines.push(`Generated at ${report.generatedAt}.`);
  return lines.join("\n");
}

function resolvedSection(findings: Finding[]) {
  const shown = findings.slice(0, RESOLVED_LIMIT);
  const lines = ["## Resolved findings", ""];
  if (!shown.length) return [...lines, "No resolved findings.", ""];
  for (const finding of shown)
    lines.push(
      `- **${finding.severity.toUpperCase()} ${code(`${finding.check}/${finding.code}`)}:** ${code(finding.url ?? finding.file ?? finding.message)}`,
    );
  if (findings.length > shown.length)
    lines.push(
      `- …and ${findings.length - shown.length} more resolved findings.`,
    );
  return [...lines, ""];
}
