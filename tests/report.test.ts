import { describe, expect, it } from "vitest";
import { formatConsoleReport } from "../src/report/formatConsoleReport.js";
import { formatJsonReport } from "../src/report/formatJsonReport.js";
import { formatMarkdownReport } from "../src/report/formatMarkdownReport.js";
import { formatSarifReport } from "../src/report/formatSarifReport.js";
import type { SearchQualityReport } from "../src/report/types.js";

const report: SearchQualityReport = {
  schemaVersion: "0.3",
  tool: "search-quality-kit",
  version: "0.3.0",
  generatedAt: "2026-07-07T00:00:00.000Z",
  mode: "static",
  target: "dist",
  summary: { checkedPages: 1, errors: 1, warnings: 0, info: 0 },
  findings: [
    {
      severity: "error",
      check: "canonical",
      code: "missing",
      message: "Missing canonical.",
      suggestion: "Add one.",
      url: "https://example.com/",
      file: "/tmp/dist/index.html",
      docs: "https://example.com/docs",
      googleDocs: "https://developers.google.com/search/docs/example",
      classification: ["google-recommendation", "local-heuristic"],
      impact: "technical-error",
      activeProfile: "directoryEntry",
      expectedStructuredData: ["Organization", "BreadcrumbList"],
      source: { type: "core", name: "canonical" },
    },
  ],
  pages: [
    {
      url: "https://example.com/",
      status: 200,
      activeProfile: "directoryEntry",
      expectedStructuredData: ["Organization", "BreadcrumbList"],
      matchedProfilePattern: "/firmy/**",
    },
  ],
  durationMs: 12,
};

describe("report formatters", () => {
  it("renders readable console output", () => {
    const output = formatConsoleReport(report);
    expect(output).toContain("Checked pages: 1");
    expect(output).toContain("Missing canonical.");
  });

  it("keeps the versioned JSON report contract", () => {
    const json = JSON.parse(formatJsonReport(report));
    expect(json).toMatchObject({
      schemaVersion: "0.3",
      tool: "search-quality-kit",
      version: "0.3.0",
      summary: { checkedPages: 1, errors: 1, warnings: 0, info: 0 },
    });
    expect(Object.keys(json)).toEqual([
      "schemaVersion",
      "tool",
      "version",
      "generatedAt",
      "mode",
      "target",
      "summary",
      "findings",
      "pages",
      "durationMs",
    ]);
    expect(json.findings[0].classification).toEqual([
      "google-recommendation",
      "local-heuristic",
    ]);
    expect(json.findings[0]).toMatchObject({
      impact: "technical-error",
      activeProfile: "directoryEntry",
      expectedStructuredData: ["Organization", "BreadcrumbList"],
    });
    expect(json.pages[0]).toMatchObject({
      activeProfile: "directoryEntry",
      expectedStructuredData: ["Organization", "BreadcrumbList"],
      matchedProfilePattern: "/firmy/**",
    });
  });

  it("groups Markdown findings and includes operational context", () => {
    const output = formatMarkdownReport(report);
    expect(output).toContain("Scanned pages: 1");
    expect(output).toContain("Total findings: 1");
    expect(output).toContain("## Profile coverage");
    expect(output).toContain("`directoryEntry` · pattern `/firmy/**`");
    expect(output).toContain("### Error");
    expect(output).toContain("`canonical/missing` (1)");
    expect(output).toContain("**URL / route:** `https://example.com/`");
    expect(output).toContain("**Location:** `/tmp/dist/index.html`");
    expect(output).toContain("**Remediation:** Add one.");
    expect(output).toContain("google-recommendation, local-heuristic");
    expect(output).toContain("**Impact:** technical-error");
    expect(output).toContain("**Source:** core `canonical`");
    expect(output).toContain("**Active profile:** `directoryEntry`");
    expect(output).toContain(
      "**Expected structured data:** `Organization`, `BreadcrumbList`",
    );
    expect(output).toContain("[Google documentation]");
  });

  it("renders baseline sections and limits resolved finding noise", () => {
    const resolved = Array.from({ length: 22 }, (_, index) => ({
      ...report.findings[0]!,
      message: `Resolved ${index}`,
      url: `https://example.com/old-${index}`,
    }));
    const baselineReport: SearchQualityReport = {
      ...report,
      baseline: {
        summary: {
          totalFindings: 1,
          existingFindings: 1,
          newFindings: 0,
          resolvedFindings: resolved.length,
        },
        newFindings: [],
        resolvedFindings: resolved,
      },
    };
    const output = formatMarkdownReport(baselineReport);
    expect(output).toContain("## New findings");
    expect(output).toContain("## Existing findings");
    expect(output).toContain("<details>");
    expect(output).toContain("## Resolved findings");
    expect(output).toContain("…and 2 more resolved findings.");
    expect(output).not.toContain("old-21");
  });

  it("bounds repeated Markdown details while keeping JSON complete", () => {
    const repeated = Array.from({ length: 22 }, (_, index) => ({
      ...report.findings[0]!,
      url: `https://example.com/repeated-${index}`,
    }));
    const output = formatMarkdownReport({
      ...report,
      findings: repeated,
      summary: { ...report.summary, errors: repeated.length },
    });
    expect(output).toContain("…and 2 more in the JSON report.");
    expect(output).not.toContain("repeated-21");
  });

  it("emits GitHub-compatible SARIF without fake source lines", () => {
    const sarif = JSON.parse(formatSarifReport(report));
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs[0].tool.driver.rules[0]).toMatchObject({
      id: "missing",
      name: "canonical",
    });
    expect(sarif.runs[0].results[0]).toMatchObject({
      ruleId: "missing",
      level: "error",
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: "https://example.com/" },
          },
        },
      ],
    });
    expect(sarif.runs[0].results[0].properties.source).toEqual({
      type: "core",
      name: "canonical",
    });
    expect(sarif.runs[0].results[0].locations[0].physicalLocation.region).toBe(
      undefined,
    );
  });

  it("reports plugin errors separately from findings", () => {
    const output = formatMarkdownReport({
      ...report,
      pluginErrors: [
        {
          plugin: "internal-rules",
          check: "custom.broken",
          message: "matcher exploded",
        },
      ],
    });
    expect(output).toContain("## Plugin errors");
    expect(output).toContain("`internal-rules` / `custom.broken`");
    expect(output).toContain("matcher exploded");
  });

  it("keeps reviewed suppressions visible in JSON and Markdown", () => {
    const suppressedReport: SearchQualityReport = {
      ...report,
      summary: { ...report.summary, suppressedFindings: 1 },
      findings: [
        {
          ...report.findings[0]!,
          suppressed: true,
          suppression: {
            code: "canonical.missing",
            urlPattern: "/legal/**",
            reason: "Legal pages use an alternate canonical policy.",
            owner: "site-owner",
            expires: "2026-12-31",
          },
        },
      ],
    };
    const json = JSON.parse(formatJsonReport(suppressedReport));
    expect(json.findings[0]).toMatchObject({
      suppressed: true,
      suppression: { owner: "site-owner", expires: "2026-12-31" },
    });
    const markdown = formatMarkdownReport(suppressedReport);
    expect(markdown).toContain("## Reviewed suppressions");
    expect(markdown).toContain(
      "Legal pages use an alternate canonical policy.",
    );
    expect(markdown).toContain("accepted by `site-owner`");
    expect(markdown).not.toContain("## Findings\n\n### Error");
  });
});
