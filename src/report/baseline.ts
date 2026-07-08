import { normalizeUrl } from "../utils/urls.js";
import {
  REPORT_SCHEMA_VERSION,
  type Finding,
  type LegacySearchQualityReport,
  type SearchQualityReport,
} from "./types.js";

const normalize = (value?: string) =>
  (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

const normalizedUrl = (value?: string) => {
  if (!value) return "";
  try {
    return normalizeUrl(value);
  } catch {
    return normalize(value);
  }
};

const normalizedLocation = (finding: Finding, target?: string) => {
  const file = (finding.file ?? "").replaceAll("\\", "/"),
    root = (target ?? "").replaceAll("\\", "/").replace(/\/+$/, "");
  if (root && (file === root || file.startsWith(`${root}/`)))
    return normalize(file.slice(root.length).replace(/^\/+/, ""));
  return normalize(file);
};

export function findingFingerprint(finding: Finding, target?: string) {
  return [
    normalize(finding.check),
    normalize(finding.code),
    normalize(finding.severity),
    normalizedUrl(finding.url),
    normalizedLocation(finding, target),
    normalize(finding.message),
  ].join("\u0000");
}

export interface BaselineComparison {
  existing: Finding[];
  new: Finding[];
  resolved: Finding[];
}

export function compareBaseline(
  report: SearchQualityReport,
  baseline: SearchQualityReport | LegacySearchQualityReport,
): BaselineComparison {
  const partition = (
    findings: Finding[],
    findingsTarget: string,
    reference: Finding[],
    referenceTarget: string,
  ) => {
    const available = new Map<string, number>();
    for (const finding of reference) {
      const fingerprint = findingFingerprint(finding, referenceTarget);
      available.set(fingerprint, (available.get(fingerprint) ?? 0) + 1);
    }
    const matched: Finding[] = [],
      unmatched: Finding[] = [];
    for (const finding of findings) {
      const fingerprint = findingFingerprint(finding, findingsTarget),
        count = available.get(fingerprint) ?? 0;
      if (count > 0) {
        matched.push(finding);
        available.set(fingerprint, count - 1);
      } else unmatched.push(finding);
    }
    return { matched, unmatched };
  };
  const current = partition(
      report.findings,
      report.target,
      baseline.findings,
      baseline.target,
    ),
    previous = partition(
      baseline.findings,
      baseline.target,
      report.findings,
      report.target,
    );
  return {
    existing: current.matched,
    new: current.unmatched,
    resolved: previous.unmatched,
  };
}

export const newFindings = (
  report: SearchQualityReport,
  baseline: SearchQualityReport | LegacySearchQualityReport,
) => compareBaseline(report, baseline).new;

export function withoutFindings(
  findings: Finding[],
  excluded: Finding[],
  target?: string,
) {
  const counts = new Map<string, number>();
  for (const finding of excluded) {
    const fingerprint = findingFingerprint(finding, target);
    counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);
  }
  return findings.filter((finding) => {
    const fingerprint = findingFingerprint(finding, target),
      count = counts.get(fingerprint) ?? 0;
    if (!count) return true;
    counts.set(fingerprint, count - 1);
    return false;
  });
}

export function withBaselineComparison(
  report: SearchQualityReport,
  baseline: SearchQualityReport | LegacySearchQualityReport,
): SearchQualityReport {
  const comparison = compareBaseline(report, baseline);
  return {
    ...report,
    baseline: {
      summary: {
        totalFindings: report.findings.length,
        existingFindings: comparison.existing.length,
        newFindings: comparison.new.length,
        resolvedFindings: comparison.resolved.length,
      },
      newFindings: comparison.new,
      resolvedFindings: comparison.resolved,
    },
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasNumericFields = (value: unknown, fields: string[]) =>
  isRecord(value) && fields.every((field) => typeof value[field] === "number");

const isFinding = (value: unknown): value is Finding =>
  isRecord(value) &&
  ["severity", "check", "code", "message", "suggestion", "docs"].every(
    (key) => typeof value[key] === "string",
  ) &&
  ["error", "warning", "info"].includes(value.severity as string) &&
  (value.source === undefined ||
    (isRecord(value.source) &&
      ["core", "plugin"].includes(value.source.type as string) &&
      typeof value.source.name === "string"));

function parseReport(
  input: string,
  label: "baseline" | "report",
): SearchQualityReport | LegacySearchQualityReport {
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw new Error(`Invalid ${label}: expected valid JSON.`);
  }
  if (!isRecord(value))
    throw new Error(`Invalid ${label}: expected a JSON report object.`);
  if (
    value.schemaVersion !== undefined &&
    value.schemaVersion !== REPORT_SCHEMA_VERSION
  )
    throw new Error(
      `Unsupported ${label} schemaVersion: ${String(value.schemaVersion)}. Expected ${REPORT_SCHEMA_VERSION}.`,
    );
  if (
    value.tool !== "search-quality-kit" ||
    typeof value.version !== "string" ||
    typeof value.generatedAt !== "string" ||
    !["static", "http"].includes(value.mode as string) ||
    typeof value.target !== "string" ||
    !hasNumericFields(value.summary, [
      "checkedPages",
      "errors",
      "warnings",
      "info",
    ]) ||
    !Array.isArray(value.findings) ||
    !Array.isArray(value.pages) ||
    typeof value.durationMs !== "number"
  )
    throw new Error(`Invalid ${label}: expected a search-quality-kit report.`);
  if (!value.findings.every(isFinding))
    throw new Error(
      `Invalid ${label}: findings do not match the report schema.`,
    );
  if (value.baseline !== undefined) {
    const baseline = value.baseline;
    if (
      !isRecord(baseline) ||
      !hasNumericFields(baseline.summary, [
        "totalFindings",
        "existingFindings",
        "newFindings",
        "resolvedFindings",
      ]) ||
      !["newFindings", "resolvedFindings"].every(
        (key) =>
          Array.isArray(baseline[key]) &&
          (baseline[key] as unknown[]).every(isFinding),
      )
    )
      throw new Error(`Invalid ${label}: baseline comparison is malformed.`);
  }
  if (
    value.pluginErrors !== undefined &&
    (!Array.isArray(value.pluginErrors) ||
      !value.pluginErrors.every(
        (error) =>
          isRecord(error) &&
          ["plugin", "check", "message"].every(
            (key) => typeof error[key] === "string",
          ),
      ))
  )
    throw new Error(`Invalid ${label}: pluginErrors are malformed.`);
  return value as unknown as SearchQualityReport | LegacySearchQualityReport;
}

export const parseBaselineReport = (input: string) =>
  parseReport(input, "baseline");

export const parseSearchQualityReport = (input: string) =>
  parseReport(input, "report");
