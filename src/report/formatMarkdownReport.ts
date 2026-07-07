import type { SearchQualityReport } from "./types.js";
const e = (v: string) => v.replace(/\|/g, "\\|").replace(/\n/g, " ");
export function formatMarkdownReport(r: SearchQualityReport) {
  const lines = [
    "# Search Quality Report",
    "",
    `- Target: \`${r.target}\``,
    `- Mode: ${r.mode}`,
    `- Checked pages: ${r.summary.checkedPages}`,
    `- Errors: ${r.summary.errors}`,
    `- Warnings: ${r.summary.warnings}`,
    `- Info: ${r.summary.info}`,
    "",
    "| Severity | Check | Location | Finding | Suggested fix |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const f of r.findings)
    lines.push(
      `| ${f.severity.toUpperCase()} | ${e(f.check)} | ${e(f.url ?? f.file ?? "—")} | ${e(f.message)} | ${e(f.suggestion)} |`,
    );
  if (!r.findings.length) lines.push("| — | — | — | No findings. | — |");
  return [...lines, "", `Generated at ${r.generatedAt}.`].join("\n");
}
