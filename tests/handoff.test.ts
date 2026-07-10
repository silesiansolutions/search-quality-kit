import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  formatPortfolioHandoffReport,
  formatSiteHandoffReport,
  loadPortfolioSiteReports,
} from "../src/report/formatHandoffReport.js";
import type { PortfolioReport } from "../src/portfolio/types.js";
import type { Finding, SearchQualityReport } from "../src/report/types.js";

const roots: string[] = [];
const repositoryRoot = path.resolve(import.meta.dirname, "..");
const cli = path.join(repositoryRoot, "src/cli/index.ts");

const finding = (
  code: string,
  severity: Finding["severity"],
  url: string,
  message: string,
): Finding => ({
  severity,
  check: code.split(".")[0]!,
  code,
  message,
  suggestion: `Remediate ${code}.`,
  url,
  file: `/tmp/dist${new URL(url).pathname}/index.html`,
  docs: "https://example.com/docs",
  classification: ["local-heuristic"],
  activeProfile: url.includes("services") ? "servicePage" : "company",
  source: { type: "core", name: code.split(".")[0]! },
});

function siteReport(): SearchQualityReport {
  const added = finding(
    "canonical.wrong-origin",
    "error",
    "https://example.com/services/audit",
    "Canonical points outside the production origin.",
  );
  const existing = finding(
    "metadata.description-length",
    "warning",
    "https://example.com/about",
    "Description is shorter than the configured range.",
  );
  const suppressed: Finding = {
    ...finding(
      "company-site.contact-link",
      "warning",
      "https://example.com/services/legacy",
      "Legacy page has no page-level contact CTA.",
    ),
    source: { type: "plugin", name: "company-site" },
    suppressed: true,
    suppression: {
      code: "company-site.contact-link",
      urlPattern: "/services/legacy/**",
      reason: "Legacy pages intentionally use the global footer CTA.",
      owner: "growth",
      expires: "2026-12-31",
    },
  };
  const resolved = finding(
    "metadata.missing-title",
    "error",
    "https://example.com/old",
    "Page had no title.",
  );
  return {
    schemaVersion: "0.3",
    tool: "search-quality-kit",
    version: "0.9.0",
    generatedAt: "2026-07-10T00:00:00.000Z",
    mode: "static",
    target: "/tmp/dist",
    summary: {
      checkedPages: 3,
      errors: 1,
      warnings: 2,
      info: 0,
      suppressedFindings: 1,
    },
    findings: [added, existing, suppressed],
    pages: [
      {
        url: added.url!,
        status: 200,
        activeProfile: "servicePage",
        matchedProfilePattern: "/services/**",
      },
      { url: existing.url!, status: 200, activeProfile: "company" },
      {
        url: suppressed.url!,
        status: 200,
        activeProfile: "servicePage",
        matchedProfilePattern: "/services/**",
      },
    ],
    durationMs: 12,
    baseline: {
      summary: {
        totalFindings: 3,
        existingFindings: 2,
        newFindings: 1,
        resolvedFindings: 1,
      },
      newFindings: [added],
      resolvedFindings: [resolved],
    },
  };
}

function portfolioReport(): PortfolioReport {
  return {
    schemaVersion: "0.7",
    tool: {
      name: "@silesiansolutions/search-quality-kit",
      version: "0.9.0",
    },
    generatedAt: "2026-07-10T00:00:00.000Z",
    portfolio: {
      sitesTotal: 2,
      sitesPassed: 0,
      sitesFailed: 1,
      sitesSkipped: 0,
      totalPages: 3,
      totalFindings: 3,
      newFindings: 1,
      resolvedFindings: 1,
      suppressedFindings: 1,
      errors: 1,
      warnings: 2,
      infos: 0,
      operationalErrors: 1,
    },
    sites: [
      {
        name: "site-a",
        status: "failed",
        reportPath: "site-a/search-quality-report.json",
        markdownReportPath: "site-a/search-quality-report.md",
        summary: {
          checkedPages: 3,
          errors: 1,
          warnings: 2,
          info: 0,
          totalFindings: 3,
          existingFindings: 2,
          newFindings: 1,
          resolvedFindings: 1,
          suppressedFindings: 1,
        },
        baseline: { status: "used", path: "baseline.json" },
      },
      {
        name: "site-b",
        status: "error",
        summary: {
          checkedPages: 0,
          errors: 0,
          warnings: 0,
          info: 0,
          totalFindings: 0,
          existingFindings: 0,
          newFindings: 0,
          resolvedFindings: 0,
          suppressedFindings: 0,
        },
        baseline: { status: "not-configured" },
        operationalError: {
          stage: "config",
          message: "Config file is missing.",
        },
      },
    ],
    highlights: { newFindings: [], errors: [], warnings: [], resolved: [] },
    gate: {
      status: "failed",
      reportOnly: false,
      failOn: ["error"],
      failOnNew: true,
      reason: "One new error matched the portfolio gate.",
      failures: [
        {
          site: "site-a",
          type: "finding",
          severity: "error",
          count: 1,
          message: "1 new error finding matched portfolio.failOn.",
        },
      ],
    },
  };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("handoff report", () => {
  it("renders deterministic site actions and keeps suppressions out of Do now", () => {
    const output = formatSiteHandoffReport(siteReport());
    expect(output).toBe(formatSiteHandoffReport(siteReport()));
    expect(output).toMatchSnapshot();
    const doNow = output.split("## Review accepted suppressions")[0]!;
    expect(doNow).toContain("canonical.wrong-origin");
    expect(doNow).not.toContain("company-site.contact-link");
    expect(output).toContain("Original remediation (not a TODO)");
    expect(output).toContain("Do not change the page solely because");
    expect(output).toContain("## Baseline / debt");
    expect(output).toContain("## Resolved since baseline");
  });

  it("renders top portfolio actions, per-site tables, and operational errors", () => {
    const loaded = {
      reports: new Map([["site-a", siteReport()]]),
      errors: [],
    };
    const output = formatPortfolioHandoffReport(portfolioReport(), loaded);
    expect(output).toMatchSnapshot();
    expect(output).toContain("## Per-site action table");
    expect(output).toContain("site-a/search-quality-report.md");
    expect(output).toContain("Config file is missing.");
    expect(output).toContain("**Site:** `site-a`");
  });

  it("loads bounded per-site reports and exposes portfolio handoff in the CLI", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "sqk-handoff-"));
    roots.push(root);
    await mkdir(path.join(root, "site-a"), { recursive: true });
    await writeFile(
      path.join(root, "site-a/search-quality-report.json"),
      JSON.stringify(siteReport()),
      "utf8",
    );
    await writeFile(
      path.join(root, "portfolio.json"),
      JSON.stringify(portfolioReport()),
      "utf8",
    );
    const loaded = await loadPortfolioSiteReports(
      portfolioReport(),
      path.join(root, "portfolio.json"),
    );
    expect(loaded.errors).toEqual([]);
    expect(loaded.reports.get("site-a")?.findings).toHaveLength(3);

    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        cli,
        "report",
        path.join(root, "portfolio.json"),
        "--format",
        "handoff",
        "--output",
        path.join(root, "portfolio-handoff.md"),
      ],
      { encoding: "utf8" },
    );
    expect(result.status, result.stderr).toBe(0);
    await expect(
      readFile(path.join(root, "portfolio-handoff.md"), "utf8"),
    ).resolves.toContain("# Search Quality Portfolio Handoff");
  });

  it("rejects unsafe portfolio report paths and bounds details", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "sqk-handoff-unsafe-"));
    roots.push(root);
    const portfolio = portfolioReport();
    portfolio.sites[0]!.reportPath = "../outside.json";
    const loaded = await loadPortfolioSiteReports(
      portfolio,
      path.join(root, "portfolio.json"),
    );
    expect(loaded.errors[0]?.message).toContain("escapes");
    expect(() =>
      formatSiteHandoffReport(siteReport(), { detailLimit: 0 }),
    ).toThrow("1 to 500");
  });
});
