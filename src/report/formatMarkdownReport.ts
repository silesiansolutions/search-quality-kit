import { classificationForCheck } from "../checks/types.js";
import { withoutFindings } from "./baseline.js";
import type { Finding, SearchQualityReport, Severity } from "./types.js";

const RESOLVED_LIMIT = 20;
const FINDING_GROUP_LIMIT = 20;
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
    `  - **Impact:** ${finding.impact ?? (finding.severity === "error" ? "technical-error" : "recommendation")}`,
    ...(finding.source
      ? [
          `  - **Source:** ${finding.source.type === "plugin" ? `plugin ${code(finding.source.name)}` : `core ${code(finding.source.name)}`}`,
        ]
      : []),
    ...(finding.activeProfile
      ? [`  - **Active profile:** ${code(finding.activeProfile)}`]
      : []),
    ...(finding.expectedStructuredData?.length
      ? [
          `  - **Expected structured data:** ${finding.expectedStructuredData.map(code).join(", ")}`,
        ]
      : []),
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
      for (const finding of items.slice(0, FINDING_GROUP_LIMIT))
        lines.push(...findingLines(finding), "");
      if (items.length > FINDING_GROUP_LIMIT)
        lines.push(
          `- …and ${items.length - FINDING_GROUP_LIMIT} more in the JSON report.`,
          "",
        );
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

function profileCoverage(report: SearchQualityReport) {
  const groups = new Map<string, { count: number; label: string }>();
  for (const page of report.pages) {
    if (!page.activeProfile) continue;
    const label = [
      code(page.activeProfile),
      page.matchedProfilePattern
        ? `pattern ${code(page.matchedProfilePattern)}`
        : "default",
      page.expectedStructuredData?.length
        ? `expects ${page.expectedStructuredData.map(code).join(", ")}`
        : "sanity checks only",
    ].join(" · ");
    const current = groups.get(label);
    groups.set(label, { count: (current?.count ?? 0) + 1, label });
  }
  if (!groups.size) return [];
  return [
    "## Profile coverage",
    "",
    ...[...groups.values()].map(
      ({ count, label }) =>
        `- ${label}: ${count} page${count === 1 ? "" : "s"}`,
    ),
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
      ...profileCoverage(report),
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
    lines.push(
      "",
      ...profileCoverage(report),
      ...section("Findings", report.findings),
    );
  }

  if (report.pluginErrors?.length) {
    lines.push("## Plugin errors", "");
    for (const error of report.pluginErrors)
      lines.push(
        `- **${code(error.plugin)} / ${code(error.check)}:** ${text(error.message)}`,
      );
    lines.push("");
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
