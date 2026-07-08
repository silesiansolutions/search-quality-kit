import { z } from "zod";
import type { Finding } from "../report/types.js";
import {
  PORTFOLIO_REPORT_SCHEMA_VERSION,
  type PortfolioFindingHighlight,
  type PortfolioReport,
} from "./types.js";

const severitySchema = z.enum(["error", "warning", "info"]);
const highlightSchema = z
  .object({
    site: z.string(),
    severity: severitySchema,
    code: z.string(),
    message: z.string(),
    url: z.string().optional(),
  })
  .strict();
const summarySchema = z
  .object({
    checkedPages: z.number().int().nonnegative(),
    errors: z.number().int().nonnegative(),
    warnings: z.number().int().nonnegative(),
    info: z.number().int().nonnegative(),
    totalFindings: z.number().int().nonnegative(),
    existingFindings: z.number().int().nonnegative(),
    newFindings: z.number().int().nonnegative(),
    resolvedFindings: z.number().int().nonnegative(),
  })
  .strict();

export const portfolioReportSchema = z
  .object({
    schemaVersion: z.literal(PORTFOLIO_REPORT_SCHEMA_VERSION),
    tool: z
      .object({
        name: z.literal("@silesiansolutions/search-quality-kit"),
        version: z.string().min(1),
      })
      .strict(),
    generatedAt: z.iso.datetime(),
    portfolio: z
      .object({
        sitesTotal: z.number().int().nonnegative(),
        sitesPassed: z.number().int().nonnegative(),
        sitesFailed: z.number().int().nonnegative(),
        sitesSkipped: z.number().int().nonnegative(),
        totalPages: z.number().int().nonnegative(),
        totalFindings: z.number().int().nonnegative(),
        newFindings: z.number().int().nonnegative(),
        resolvedFindings: z.number().int().nonnegative(),
        errors: z.number().int().nonnegative(),
        warnings: z.number().int().nonnegative(),
        infos: z.number().int().nonnegative(),
        operationalErrors: z.number().int().nonnegative(),
      })
      .strict(),
    sites: z.array(
      z
        .object({
          name: z.string(),
          status: z.enum(["passed", "failed", "error", "skipped", "disabled"]),
          reportPath: z.string().optional(),
          markdownReportPath: z.string().optional(),
          sarifReportPath: z.string().optional(),
          summary: summarySchema,
          baseline: z
            .object({
              status: z.enum(["used", "not-configured", "missing", "invalid"]),
              path: z.string().optional(),
              message: z.string().optional(),
            })
            .strict(),
          operationalError: z
            .object({
              stage: z.enum([
                "config",
                "verification",
                "plugin",
                "baseline",
                "output",
              ]),
              message: z.string(),
            })
            .strict()
            .optional(),
          findings: z
            .array(
              z
                .object({
                  site: z.string(),
                  severity: severitySchema,
                  check: z.string(),
                  code: z.string(),
                  message: z.string(),
                  suggestion: z.string(),
                  docs: z.string(),
                })
                .passthrough(),
            )
            .optional(),
        })
        .strict(),
    ),
    highlights: z
      .object({
        newFindings: z.array(highlightSchema),
        errors: z.array(highlightSchema),
        warnings: z.array(highlightSchema),
        resolved: z.array(highlightSchema),
      })
      .strict(),
    gate: z
      .object({
        status: z.enum(["passed", "failed"]),
        reportOnly: z.boolean(),
        failOn: z.array(severitySchema),
        failOnNew: z.boolean(),
        reason: z.string(),
        failures: z.array(
          z
            .object({
              site: z.string(),
              type: z.enum(["finding", "operational"]),
              severity: severitySchema.optional(),
              count: z.number().int().positive().optional(),
              message: z.string(),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();

export const formatPortfolioJsonReport = (report: PortfolioReport) =>
  JSON.stringify(report, null, 2);

export function parsePortfolioReport(input: string): PortfolioReport {
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw new Error("Invalid portfolio report: expected valid JSON.");
  }
  const parsed = portfolioReportSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      `Invalid portfolio report: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  return parsed.data as unknown as PortfolioReport;
}

const escapeCell = (value: string | number) =>
  String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
const displayStatus = (status: string) =>
  ({ passed: "passed", failed: "failed", error: "operational error" })[
    status
  ] ?? status;
const details = (items: PortfolioFindingHighlight[], empty: string) =>
  items.length
    ? items
        .map(
          (item) =>
            `- **${item.site}** · \`${item.code}\` · ${item.message}${item.url ? ` (\`${item.url}\`)` : ""}`,
        )
        .join("\n")
    : empty;

export function findingHighlight(
  site: string,
  finding: Finding,
): PortfolioFindingHighlight {
  return {
    site,
    severity: finding.severity,
    code: `${finding.check}/${finding.code}`,
    message: finding.message,
    ...(finding.url ? { url: finding.url } : {}),
  };
}

export function formatPortfolioMarkdownReport(report: PortfolioReport) {
  const rows = report.sites.map((site) => {
    const reportLink = site.markdownReportPath
      ? `[Markdown](${site.markdownReportPath})`
      : "—";
    return `| ${escapeCell(site.name)} | ${displayStatus(site.status)} | ${site.summary.checkedPages} | ${site.summary.errors} | ${site.summary.warnings} | ${site.summary.newFindings} | ${site.summary.resolvedFindings} | ${reportLink} |`;
  });
  const operational = report.sites
    .filter((site) => site.operationalError)
    .map(
      (site) =>
        `- **${site.name}** · ${site.operationalError!.stage}: ${site.operationalError!.message}`,
    );
  const newBySite = report.sites
    .filter((site) => site.summary.newFindings > 0)
    .map(
      (site) =>
        `- **${site.name}:** ${site.summary.newFindings} new (${site.summary.errors} errors, ${site.summary.warnings} warnings)`,
    );
  const gateFailures = report.gate.failures.length
    ? report.gate.failures.map(
        (failure) => `- **${failure.site}:** ${failure.message}`,
      )
    : ["- No gate failures."];

  return `# Search Quality Portfolio Report

## Portfolio summary

- Sites: ${report.portfolio.sitesTotal} total · ${report.portfolio.sitesPassed} passed · ${report.portfolio.sitesFailed} failed · ${report.portfolio.sitesSkipped} skipped/disabled
- Pages: ${report.portfolio.totalPages}
- Findings: ${report.portfolio.totalFindings} total · ${report.portfolio.errors} errors · ${report.portfolio.warnings} warnings · ${report.portfolio.infos} info
- Baseline delta: ${report.portfolio.newFindings} new · ${report.portfolio.resolvedFindings} resolved

## Gate status

**${report.gate.status.toUpperCase()}** — ${report.gate.reason}

${gateFailures.join("\n")}

## Per-site status

| Site | Status | Pages | Errors | Warnings | New | Resolved | Report |
|---|---:|---:|---:|---:|---:|---:|---|
${rows.join("\n")}

## New findings by site

${newBySite.join("\n") || "No new findings."}

## Top errors

${details(report.highlights.errors, "No error findings.")}

## Top warnings

${details(report.highlights.warnings, "No warning findings.")}

## Resolved findings summary

${details(report.highlights.resolved, "No resolved findings.")}

## Operational, plugin, config, and baseline errors

${operational.join("\n") || "No operational errors."}

## Next actions

${report.gate.status === "failed" ? "1. Open the affected per-site report and fix the gate-matching finding or operational error.\n2. Re-run the same portfolio command.\n3. Update a baseline only after reviewing the site-specific diff; use `portfolio baseline --force` intentionally." : "No gate action is required. Review warnings and resolved findings in the per-site reports before changing baselines."}
`;
}
