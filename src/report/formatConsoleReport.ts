import pc from "picocolors";
import { displayUrl } from "../utils/urls.js";
import type { Finding, SearchQualityReport } from "./types.js";
const label = (f: Finding) =>
  f.severity === "error"
    ? pc.red("ERROR")
    : f.severity === "warning"
      ? pc.yellow("WARNING")
      : pc.cyan("INFO");
export function formatConsoleReport(r: SearchQualityReport) {
  const lines = [
    pc.bold("Search Quality Report"),
    "",
    `Target: ${r.target}`,
    `Mode: ${r.mode}`,
    `Checked pages: ${r.summary.checkedPages}`,
    `Total findings: ${r.findings.length}`,
    `Errors: ${r.summary.errors}`,
    `Warnings: ${r.summary.warnings}`,
    `Info: ${r.summary.info}`,
    `Reviewed suppressions: ${r.findings.filter((finding) => finding.suppressed).length}`,
    ...(r.baseline
      ? [
          `Existing findings: ${r.baseline.summary.existingFindings}`,
          `New findings: ${r.baseline.summary.newFindings}`,
          `Resolved findings: ${r.baseline.summary.resolvedFindings}`,
        ]
      : []),
    "",
  ];
  const groups = new Map<string, Finding[]>();
  r.findings.forEach((f) =>
    groups.set(f.check, [...(groups.get(f.check) ?? []), f]),
  );
  for (const [name, items] of groups) {
    lines.push(pc.bold(name));
    for (const f of items) {
      const where = f.url
        ? ` (${displayUrl(f.url)})`
        : f.file
          ? ` (${f.file})`
          : "";
      lines.push(
        `${f.suppressed ? pc.blue("REVIEWED") : label(f)} ${f.message}${where}`,
        f.suppressed && f.suppression
          ? `  Accepted by ${f.suppression.owner}: ${f.suppression.reason}`
          : `  Fix: ${f.suggestion}`,
      );
    }
    lines.push("");
  }
  if (!r.findings.length && !r.pluginErrors?.length)
    lines.push(pc.green("No findings. The configured checks passed."), "");
  if (r.pluginErrors?.length) {
    lines.push(pc.red(pc.bold("Plugin errors")));
    for (const error of r.pluginErrors)
      lines.push(`${error.plugin}/${error.check}: ${error.message}`);
    lines.push("");
  }
  lines.push(`Completed in ${r.durationMs} ms.`);
  return lines.join("\n");
}
