import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { runVerification } from "../engine/verify.js";
import {
  parseBaselineReport,
  withBaselineComparison,
} from "../report/baseline.js";
import { formatJsonReport } from "../report/formatJsonReport.js";
import { formatMarkdownReport } from "../report/formatMarkdownReport.js";
import { formatSarifReport } from "../report/formatSarifReport.js";
import type {
  Finding,
  SearchQualityReport,
  Severity,
} from "../report/types.js";
import { VERSION } from "../version.js";
import { loadPortfolioConfig, portfolioFailOn } from "./config.js";
import {
  findingHighlight,
  formatPortfolioJsonReport,
  formatPortfolioMarkdownReport,
} from "./report.js";
import {
  emptyPortfolioSiteSummary,
  PORTFOLIO_REPORT_SCHEMA_VERSION,
  type PortfolioFindingHighlight,
  type PortfolioReport,
  type PortfolioSiteReport,
} from "./types.js";

export interface RunPortfolioOptions {
  root?: string;
  configPath?: string;
  outputDir?: string;
  reportOnly?: boolean;
  failOnNew?: boolean;
  skipBuild?: boolean;
  includeFindings?: boolean;
  sarif?: boolean;
  writeBaselines?: boolean;
  forceBaselines?: boolean;
}

export interface RunPortfolioResult {
  report: PortfolioReport;
  outputDirectory: string;
  jsonPath: string;
  markdownPath: string;
  exitCode: 0 | 1;
}

const posixPath = (value: string) => value.split(path.sep).join("/");
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function inside(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return (
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
  );
}

function relativeReportPath(outputDirectory: string, file: string) {
  return posixPath(path.relative(outputDirectory, file));
}

function baselineWithoutPrevious(report: SearchQualityReport) {
  return {
    ...report,
    baseline: {
      summary: {
        totalFindings: report.findings.length,
        existingFindings: 0,
        newFindings: report.findings.length,
        resolvedFindings: 0,
      },
      newFindings: report.findings,
      resolvedFindings: [],
    },
  };
}

function siteSummary(report: SearchQualityReport) {
  return {
    ...report.summary,
    totalFindings: report.findings.length,
    existingFindings:
      report.baseline?.summary.existingFindings ?? report.findings.length,
    newFindings: report.baseline?.summary.newFindings ?? 0,
    resolvedFindings: report.baseline?.summary.resolvedFindings ?? 0,
  };
}

function boundedHighlights(
  sites: Array<{ name: string; report: SearchQualityReport }>,
  select: (report: SearchQualityReport) => Finding[],
  limit = 10,
) {
  const highlights: PortfolioFindingHighlight[] = [];
  for (const site of sites)
    for (const finding of select(site.report)) {
      highlights.push(findingHighlight(site.name, finding));
      if (highlights.length === limit) return highlights;
    }
  return highlights;
}

export async function runPortfolio(
  options: RunPortfolioOptions = {},
): Promise<RunPortfolioResult> {
  const root = path.resolve(options.root ?? process.cwd());
  const loaded = await loadPortfolioConfig(root, options.configPath);
  const manifestDirectory = path.dirname(loaded.path);
  const config = loaded.config;
  const outputDirectory = path.resolve(
    root,
    options.outputDir ?? config.outputDir,
  );
  const failOn = portfolioFailOn(config.portfolio.failOn);
  const failOnNew = options.failOnNew ?? config.portfolio.failOnNew;
  const reportOnly = options.reportOnly ?? config.portfolio.reportOnly;
  const resolvedOutputs = new Map<string, string>();

  for (const site of config.sites) {
    const output = options.outputDir
      ? path.join(outputDirectory, site.name)
      : site.outputDir
        ? path.resolve(root, site.outputDir)
        : path.join(outputDirectory, site.name);
    if (!inside(outputDirectory, output))
      throw new Error(
        `Invalid portfolio config: output directory for site "${site.name}" must be a child of ${outputDirectory}.`,
      );
    const duplicate = [...resolvedOutputs.entries()].find(
      ([, existing]) => existing === output,
    );
    if (duplicate)
      throw new Error(
        `Invalid portfolio config: sites "${duplicate[0]}" and "${site.name}" resolve to the same output directory.`,
      );
    resolvedOutputs.set(site.name, output);
  }

  await mkdir(outputDirectory, { recursive: true });
  const sites: PortfolioSiteReport[] = [];
  const completed: Array<{ name: string; report: SearchQualityReport }> = [];
  const failures: PortfolioReport["gate"]["failures"] = [];
  let stop = false;

  for (const site of config.sites) {
    const output = resolvedOutputs.get(site.name)!;
    if (!site.enabled) {
      sites.push({
        name: site.name,
        status: "disabled",
        summary: emptyPortfolioSiteSummary(),
        baseline: { status: "not-configured" },
      });
      continue;
    }
    if (stop) {
      sites.push({
        name: site.name,
        status: "skipped",
        summary: emptyPortfolioSiteSummary(),
        baseline: { status: "not-configured" },
      });
      continue;
    }

    await mkdir(output, { recursive: true });
    const siteRoot = path.resolve(manifestDirectory, site.root);
    const configPath = path.resolve(siteRoot, site.config);
    const baselinePath = site.baseline
      ? path.resolve(siteRoot, site.baseline)
      : undefined;
    const jsonPath = path.join(output, "search-quality-report.json");
    const markdownPath = path.join(output, "search-quality-report.md");
    const sarifPath = path.join(output, "search-quality-report.sarif");
    let report: SearchQualityReport | undefined;
    let baseline: PortfolioSiteReport["baseline"] = site.baseline
      ? {
          status: "used",
          path: posixPath(path.relative(root, baselinePath!)),
        }
      : { status: "not-configured" };
    let operationalError: PortfolioSiteReport["operationalError"];

    try {
      const result = await runVerification({
        root: siteRoot,
        configPath,
        skipBuild: options.skipBuild,
      });
      report = result.report;
    } catch (error) {
      const message = errorMessage(error);
      operationalError = {
        stage: /config/i.test(message) ? "config" : "verification",
        message,
      };
    }

    if (report && options.writeBaselines) {
      if (!baselinePath) {
        baseline = {
          status: "missing",
          message: "No baseline path is configured for this site.",
        };
        operationalError = {
          stage: "baseline",
          message:
            "Cannot write a baseline because the site has no baseline path in the portfolio config.",
        };
      } else if ((await exists(baselinePath)) && !options.forceBaselines) {
        operationalError = {
          stage: "baseline",
          message: `Baseline already exists: ${baselinePath}. Re-run with --force to replace the reviewed snapshot.`,
        };
      } else {
        try {
          await mkdir(path.dirname(baselinePath), { recursive: true });
          await writeFile(
            baselinePath,
            `${formatJsonReport(report)}\n`,
            "utf8",
          );
        } catch (error) {
          operationalError = {
            stage: "baseline",
            message: `Could not write baseline ${baselinePath}: ${errorMessage(error)}`,
          };
        }
      }
    } else if (report && baselinePath) {
      try {
        const previous = parseBaselineReport(
          await readFile(baselinePath, "utf8"),
        );
        report = withBaselineComparison(report, previous);
      } catch (error) {
        const message = errorMessage(error);
        const missing = !(await exists(baselinePath));
        baseline = {
          status: missing ? "missing" : "invalid",
          path: posixPath(path.relative(root, baselinePath)),
          message,
        };
        operationalError = { stage: "baseline", message };
      }
    } else if (report && failOnNew) {
      report = baselineWithoutPrevious(report);
    }

    if (report?.pluginErrors?.length) {
      const pluginMessage = report.pluginErrors
        .map((error) => `${error.plugin}/${error.check}: ${error.message}`)
        .join("; ");
      operationalError = operationalError
        ? {
            ...operationalError,
            message: `${operationalError.message}; plugin: ${pluginMessage}`,
          }
        : { stage: "plugin", message: pluginMessage };
    }

    if (report) {
      try {
        await writeFile(jsonPath, `${formatJsonReport(report)}\n`, "utf8");
        await writeFile(
          markdownPath,
          `${formatMarkdownReport(report)}\n`,
          "utf8",
        );
        if (options.sarif)
          await writeFile(sarifPath, `${formatSarifReport(report)}\n`, "utf8");
      } catch (error) {
        operationalError = { stage: "output", message: errorMessage(error) };
      }
    } else {
      await writeFile(
        path.join(output, "operational-error.json"),
        `${JSON.stringify({ site: site.name, ...operationalError }, null, 2)}\n`,
        "utf8",
      );
    }

    const candidates = report
      ? failOnNew
        ? (report.baseline?.newFindings ?? report.findings)
        : report.findings
      : [];
    const findingFailures = options.writeBaselines
      ? []
      : failOn.flatMap((severity) => {
          const count = candidates.filter(
            (finding) => finding.severity === severity,
          ).length;
          return count
            ? [
                {
                  site: site.name,
                  type: "finding" as const,
                  severity,
                  count,
                  message: `${count} ${failOnNew ? "new " : ""}${severity} finding${count === 1 ? "" : "s"} matched portfolio.failOn.`,
                },
              ]
            : [];
        });
    failures.push(...findingFailures);
    if (operationalError)
      failures.push({
        site: site.name,
        type: "operational",
        message: operationalError.message,
      });

    const status = operationalError
      ? "error"
      : findingFailures.length
        ? "failed"
        : "passed";
    sites.push({
      name: site.name,
      status,
      summary: report ? siteSummary(report) : emptyPortfolioSiteSummary(),
      baseline,
      ...(report
        ? {
            reportPath: relativeReportPath(outputDirectory, jsonPath),
            markdownReportPath: relativeReportPath(
              outputDirectory,
              markdownPath,
            ),
            ...(options.sarif
              ? {
                  sarifReportPath: relativeReportPath(
                    outputDirectory,
                    sarifPath,
                  ),
                }
              : {}),
            ...(options.includeFindings
              ? {
                  findings: report.findings.map((finding) => ({
                    site: site.name,
                    ...finding,
                  })),
                }
              : {}),
          }
        : {}),
      ...(operationalError ? { operationalError } : {}),
    });
    if (report) completed.push({ name: site.name, report });
    if (status !== "passed" && !config.portfolio.continueOnSiteFailure)
      stop = true;
  }

  const failed = sites.filter(
    (site) => site.status === "failed" || site.status === "error",
  ).length;
  const skipped = sites.filter(
    (site) => site.status === "skipped" || site.status === "disabled",
  ).length;
  const gateFailed = failures.length > 0 && !reportOnly;
  const operationalCount = sites.filter((site) => site.operationalError).length;
  const report: PortfolioReport = {
    schemaVersion: PORTFOLIO_REPORT_SCHEMA_VERSION,
    tool: {
      name: "@silesiansolutions/search-quality-kit",
      version: VERSION,
    },
    generatedAt: new Date().toISOString(),
    portfolio: {
      sitesTotal: sites.length,
      sitesPassed: sites.filter((site) => site.status === "passed").length,
      sitesFailed: failed,
      sitesSkipped: skipped,
      totalPages: sites.reduce(
        (total, site) => total + site.summary.checkedPages,
        0,
      ),
      totalFindings: sites.reduce(
        (total, site) => total + site.summary.totalFindings,
        0,
      ),
      newFindings: sites.reduce(
        (total, site) => total + site.summary.newFindings,
        0,
      ),
      resolvedFindings: sites.reduce(
        (total, site) => total + site.summary.resolvedFindings,
        0,
      ),
      errors: sites.reduce((total, site) => total + site.summary.errors, 0),
      warnings: sites.reduce((total, site) => total + site.summary.warnings, 0),
      infos: sites.reduce((total, site) => total + site.summary.info, 0),
      operationalErrors: operationalCount,
    },
    sites,
    highlights: {
      newFindings: boundedHighlights(
        completed,
        (siteReport) => siteReport.baseline?.newFindings ?? [],
      ),
      errors: boundedHighlights(completed, (siteReport) =>
        siteReport.findings.filter((finding) => finding.severity === "error"),
      ),
      warnings: boundedHighlights(completed, (siteReport) =>
        siteReport.findings.filter((finding) => finding.severity === "warning"),
      ),
      resolved: boundedHighlights(
        completed,
        (siteReport) => siteReport.baseline?.resolvedFindings ?? [],
      ),
    },
    gate: {
      status: gateFailed ? "failed" : "passed",
      reportOnly,
      failOn: failOn as Severity[],
      failOnNew,
      reason: reportOnly
        ? failures.length
          ? `Report-only mode observed ${failures.length} gate failure${failures.length === 1 ? "" : "s"}; exit code is 0.`
          : "Report-only mode completed without gate failures."
        : gateFailed
          ? `${failures.length} portfolio gate failure${failures.length === 1 ? "" : "s"} across ${failed} site${failed === 1 ? "" : "s"}.`
          : "All enabled sites passed the portfolio gate.",
      failures,
    },
  };

  const jsonPath = path.join(outputDirectory, "portfolio.json");
  const markdownPath = path.join(outputDirectory, "portfolio.md");
  await writeFile(jsonPath, `${formatPortfolioJsonReport(report)}\n`, "utf8");
  await writeFile(
    markdownPath,
    `${formatPortfolioMarkdownReport(report)}\n`,
    "utf8",
  );
  return {
    report,
    outputDirectory,
    jsonPath,
    markdownPath,
    exitCode: gateFailed ? 1 : 0,
  };
}
