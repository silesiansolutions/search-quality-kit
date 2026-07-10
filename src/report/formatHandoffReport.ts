import { readFile } from "node:fs/promises";
import path from "node:path";
import { classificationForCheck } from "../checks/types.js";
import type { PortfolioReport } from "../portfolio/types.js";
import { withoutFindings } from "./baseline.js";
import { parseSearchQualityReport } from "./baseline.js";
import type { Finding, SearchQualityReport, Severity } from "./types.js";

export interface HandoffFormatOptions {
  detailLimit?: number;
}

export interface PortfolioReportLoadError {
  site: string;
  path?: string;
  message: string;
}

export interface LoadedPortfolioSiteReports {
  reports: Map<string, SearchQualityReport>;
  errors: PortfolioReportLoadError[];
}

type FindingState = "current" | "new" | "existing" | "suppressed" | "resolved";

interface HandoffAction {
  site?: string;
  state: FindingState;
  finding: Finding;
  report: SearchQualityReport;
}

const DEFAULT_DETAIL_LIMIT = 20;
const severityOrder: Record<Severity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

const text = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .trim()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const code = (value: string) => `\`${value.replaceAll("`", "\\`")}\``;
const findingCode = (finding: Finding) =>
  finding.code.includes(".")
    ? finding.code
    : `${finding.check}.${finding.code}`;
const source = (finding: Finding) =>
  finding.source
    ? `${finding.source.type}:${finding.source.name}`
    : `core:${finding.check}`;
const classifications = (finding: Finding) =>
  finding.classification ?? classificationForCheck(finding.check);
const countLabel = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

function compareActions(left: HandoffAction, right: HandoffAction) {
  return (
    severityOrder[left.finding.severity] -
      severityOrder[right.finding.severity] ||
    (left.site ?? "").localeCompare(right.site ?? "") ||
    source(left.finding).localeCompare(source(right.finding)) ||
    classifications(left.finding)
      .join(",")
      .localeCompare(classifications(right.finding).join(",")) ||
    (left.finding.activeProfile ?? "").localeCompare(
      right.finding.activeProfile ?? "",
    ) ||
    findingCode(left.finding).localeCompare(findingCode(right.finding)) ||
    (left.finding.url ?? left.finding.file ?? "").localeCompare(
      right.finding.url ?? right.finding.file ?? "",
    ) ||
    left.finding.message.localeCompare(right.finding.message)
  );
}

function reportPartitions(report: SearchQualityReport, site?: string) {
  const action = (finding: Finding, state: FindingState): HandoffAction => ({
    ...(site ? { site } : {}),
    state,
    finding,
    report,
  });
  const suppressed = report.findings
    .filter((finding) => finding.suppressed)
    .map((finding) => action(finding, "suppressed"));
  const active = report.findings.filter((finding) => !finding.suppressed);
  if (!report.baseline)
    return {
      doNow: active.map((finding) => action(finding, "current")),
      suppressed,
      debt: [] as HandoffAction[],
      resolved: [] as HandoffAction[],
    };
  return {
    doNow: report.baseline.newFindings
      .filter((finding) => !finding.suppressed)
      .map((finding) => action(finding, "new")),
    suppressed,
    debt: withoutFindings(
      active,
      report.baseline.newFindings,
      report.target,
    ).map((finding) => action(finding, "existing")),
    resolved: report.baseline.resolvedFindings.map((finding) =>
      action(finding, "resolved"),
    ),
  };
}

function routeProfile(action: HandoffAction) {
  const page = action.finding.url
    ? action.report.pages.find(
        (candidate) => candidate.url === action.finding.url,
      )
    : undefined;
  let route = "—";
  if (action.finding.url)
    try {
      route = new URL(action.finding.url).pathname;
    } catch {
      route = action.finding.url;
    }
  const profile = action.finding.activeProfile ?? page?.activeProfile;
  const pattern = page?.matchedProfilePattern;
  return [
    code(route),
    profile ? `profile ${code(profile)}` : undefined,
    pattern ? `pattern ${code(pattern)}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
}

function actionLines(action: HandoffAction) {
  const finding = action.finding;
  const lines = [
    ...(action.site ? [`- **Site:** ${code(action.site)}`] : []),
    `- **State:** ${code(action.state)}`,
    `- **URL:** ${finding.url ? code(finding.url) : "—"}`,
    `- **Location:** ${finding.file ? code(finding.file) : "—"}`,
    `- **Source:** ${code(source(finding))}`,
    `- **Classification:** ${classifications(finding).map(code).join(", ")}`,
    `- **Route / profile:** ${routeProfile(action)}`,
    `- **Message:** ${text(finding.message)}`,
  ];
  if (action.state === "suppressed" && finding.suppression)
    lines.push(
      `- **Reviewed decision:** owner ${code(finding.suppression.owner)} · route ${code(finding.suppression.urlPattern)}${finding.suppression.expires ? ` · expires ${code(finding.suppression.expires)}` : ""}`,
      `- **Reason:** ${text(finding.suppression.reason)}`,
      `- **Original remediation (not a TODO):** ${text(finding.suggestion)}`,
      "- **Review step:** confirm the decision, owner, scope, and expiry still hold. Do not change the page solely because this item appears here.",
    );
  else if (action.state === "resolved")
    lines.push(
      `- **Previous remediation:** ${text(finding.suggestion)}`,
      "- **Action:** no change required; keep the fix and verify the resolution is intentional.",
    );
  else lines.push(`- **Action:** ${text(finding.suggestion)}`);
  return lines;
}

function actionSection(
  title: string,
  actions: HandoffAction[],
  empty: string,
  limit: number,
) {
  const sorted = [...actions].sort(compareActions);
  const shown = sorted.slice(0, limit);
  const lines = [`## ${title}`, ""];
  if (!shown.length) return [...lines, empty, ""];
  for (const severity of ["error", "warning", "info"] as const) {
    const items = shown.filter(
      (action) => action.finding.severity === severity,
    );
    if (!items.length) continue;
    lines.push(
      `### ${severity[0]!.toUpperCase()}${severity.slice(1)} (${sorted.filter((action) => action.finding.severity === severity).length})`,
      "",
    );
    for (const action of items)
      lines.push(
        `#### ${code(findingCode(action.finding))}`,
        "",
        ...actionLines(action),
        "",
      );
  }
  if (sorted.length > shown.length)
    lines.push(
      `_${sorted.length - shown.length} additional item${sorted.length - shown.length === 1 ? "" : "s"} omitted; inspect the JSON report for the complete set._`,
      "",
    );
  return lines;
}

function detailLimit(options: HandoffFormatOptions) {
  const limit = options.detailLimit ?? DEFAULT_DETAIL_LIMIT;
  if (!Number.isInteger(limit) || limit <= 0 || limit > 500)
    throw new Error("Handoff detailLimit must be an integer from 1 to 500.");
  return limit;
}

export function formatSiteHandoffReport(
  report: SearchQualityReport,
  options: HandoffFormatOptions = {},
) {
  const limit = detailLimit(options);
  const partitions = reportPartitions(report);
  return [
    "# Search Quality Handoff",
    "",
    "## Summary",
    "",
    `- Target: ${code(report.target)}`,
    `- Pages checked: ${report.summary.checkedPages}`,
    `- Findings: ${report.findings.length} total · ${countLabel(report.summary.errors, "error")} · ${countLabel(report.summary.warnings, "warning")} · ${report.summary.info} info`,
    `- Do now: ${partitions.doNow.length}`,
    `- Reviewed suppressions: ${partitions.suppressed.length}`,
    `- Baseline / debt: ${partitions.debt.length}`,
    `- Resolved since baseline: ${partitions.resolved.length}`,
    "",
    ...actionSection(
      "Do now",
      partitions.doNow,
      "No active findings require immediate changes.",
      limit,
    ),
    ...actionSection(
      "Review accepted suppressions",
      partitions.suppressed,
      "No reviewed suppressions.",
      limit,
    ),
    ...actionSection(
      "Baseline / debt",
      partitions.debt,
      report.baseline
        ? "No existing baseline debt."
        : "No baseline comparison is attached; current active findings are listed under Do now.",
      limit,
    ),
    ...actionSection(
      "Resolved since baseline",
      partitions.resolved,
      report.baseline
        ? "No findings resolved since the baseline."
        : "No baseline comparison is attached.",
      limit,
    ),
    ...(report.pluginErrors?.length
      ? [
          "## Operational / plugin errors",
          "",
          ...report.pluginErrors.map(
            (error) =>
              `- ${code(`${error.plugin}/${error.check}`)}: ${text(error.message)}`,
          ),
          "",
        ]
      : []),
  ].join("\n");
}

function inside(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export async function loadPortfolioSiteReports(
  portfolio: PortfolioReport,
  portfolioFile: string,
): Promise<LoadedPortfolioSiteReports> {
  const directory = path.dirname(path.resolve(portfolioFile));
  const reports = new Map<string, SearchQualityReport>();
  const errors: PortfolioReportLoadError[] = [];
  for (const site of portfolio.sites) {
    if (!site.reportPath) continue;
    const reportFile = path.resolve(directory, site.reportPath);
    if (!inside(directory, reportFile)) {
      errors.push({
        site: site.name,
        path: site.reportPath,
        message: "Per-site report path escapes the portfolio report directory.",
      });
      continue;
    }
    try {
      const parsed = parseSearchQualityReport(
        await readFile(reportFile, "utf8"),
      );
      reports.set(site.name, {
        ...parsed,
        schemaVersion: "0.3",
      });
    } catch (error) {
      errors.push({
        site: site.name,
        path: site.reportPath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { reports, errors };
}

export function formatPortfolioHandoffReport(
  portfolio: PortfolioReport,
  loaded: LoadedPortfolioSiteReports = {
    reports: new Map(),
    errors: [],
  },
  options: HandoffFormatOptions = {},
) {
  const limit = detailLimit(options);
  const perSite = portfolio.sites.map((site) => {
    const report = loaded.reports.get(site.name);
    return {
      site,
      ...(report
        ? { report, partitions: reportPartitions(report, site.name) }
        : {}),
    };
  });
  const all = <K extends "doNow" | "suppressed" | "debt" | "resolved">(
    key: K,
  ) => perSite.flatMap((item) => item.partitions?.[key] ?? []);
  const countsFor = (
    item: (typeof perSite)[number],
  ): Record<"doNow" | "suppressed" | "debt" | "resolved", number> => {
    if (item.partitions)
      return {
        doNow: item.partitions.doNow.length,
        suppressed: item.partitions.suppressed.length,
        debt: item.partitions.debt.length,
        resolved: item.partitions.resolved.length,
      };
    const summary = item.site.summary;
    return {
      doNow:
        item.site.baseline.status === "used"
          ? summary.newFindings
          : Math.max(0, summary.totalFindings - summary.suppressedFindings),
      suppressed: summary.suppressedFindings,
      debt: item.site.baseline.status === "used" ? summary.existingFindings : 0,
      resolved: summary.resolvedFindings,
    };
  };
  const aggregateCount = (key: "doNow" | "suppressed" | "debt" | "resolved") =>
    perSite.reduce((total, item) => total + countsFor(item)[key], 0);
  const siteRows = perSite.map((item) => {
    const { site } = item;
    const counts = countsFor(item);
    return [
      site.name,
      site.status,
      site.summary.checkedPages,
      counts.doNow,
      counts.suppressed,
      counts.debt,
      counts.resolved,
      site.markdownReportPath
        ? `[Markdown](${site.markdownReportPath})`
        : site.reportPath
          ? `[JSON](${site.reportPath})`
          : "—",
    ]
      .map((value) => String(value).replaceAll("|", "\\|"))
      .join(" | ");
  });
  const operational = [
    ...portfolio.sites.flatMap((site) =>
      site.operationalError
        ? [
            `- **${text(site.name)}** · ${code(site.operationalError.stage)}: ${text(site.operationalError.message)}`,
          ]
        : [],
    ),
    ...loaded.errors.map(
      (error) =>
        `- **${text(error.site)}** · report load${error.path ? ` ${code(error.path)}` : ""}: ${text(error.message)}`,
    ),
  ];
  return [
    "# Search Quality Portfolio Handoff",
    "",
    "## Summary",
    "",
    `- Sites: ${portfolio.portfolio.sitesTotal} total · ${portfolio.portfolio.sitesPassed} passed · ${portfolio.portfolio.sitesFailed} failed · ${portfolio.portfolio.sitesSkipped} skipped/disabled`,
    `- Pages checked: ${portfolio.portfolio.totalPages}`,
    `- Findings: ${portfolio.portfolio.totalFindings} total · ${countLabel(portfolio.portfolio.errors, "error")} · ${countLabel(portfolio.portfolio.warnings, "warning")} · ${portfolio.portfolio.infos} info`,
    `- Do now across all sites: ${aggregateCount("doNow")}`,
    `- Reviewed suppressions: ${aggregateCount("suppressed")}`,
    `- Baseline / debt: ${aggregateCount("debt")}`,
    `- Resolved since baseline: ${aggregateCount("resolved")}`,
    `- Gate: ${code(portfolio.gate.status)} · ${text(portfolio.gate.reason)}`,
    "",
    "## Per-site action table",
    "",
    "| Site | Status | Pages | Do now | Suppressed | Debt | Resolved | Report |",
    "|---|---:|---:|---:|---:|---:|---:|---|",
    ...siteRows.map((row) => `| ${row} |`),
    "",
    ...actionSection(
      "Do now",
      all("doNow"),
      "No active findings require immediate changes across the portfolio.",
      limit,
    ),
    ...actionSection(
      "Review accepted suppressions",
      all("suppressed"),
      "No reviewed suppressions were loaded from per-site reports.",
      limit,
    ),
    ...actionSection(
      "Baseline / debt",
      all("debt"),
      "No existing baseline debt was loaded from per-site reports.",
      limit,
    ),
    ...actionSection(
      "Resolved since baseline",
      all("resolved"),
      "No resolved findings were loaded from per-site reports.",
      limit,
    ),
    "## Operational errors",
    "",
    ...(operational.length ? operational : ["No operational errors."]),
    "",
  ].join("\n");
}
