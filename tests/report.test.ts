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
    },
  ],
  pages: [{ url: "https://example.com/", status: 200 }],
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
  });

  it("groups Markdown findings and includes operational context", () => {
    const output = formatMarkdownReport(report);
    expect(output).toContain("Scanned pages: 1");
    expect(output).toContain("Total findings: 1");
    expect(output).toContain("### Error");
    expect(output).toContain("`canonical/missing` (1)");
    expect(output).toContain("**URL / route:** `https://example.com/`");
    expect(output).toContain("**Location:** `/tmp/dist/index.html`");
    expect(output).toContain("**Remediation:** Add one.");
    expect(output).toContain("google-recommendation, local-heuristic");
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
    expect(sarif.runs[0].results[0].locations[0].physicalLocation.region).toBe(
      undefined,
    );
  });
});
