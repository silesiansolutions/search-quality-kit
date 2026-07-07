import { describe, expect, it } from "vitest";
import { formatConsoleReport } from "../src/report/formatConsoleReport.js";
import { formatJsonReport } from "../src/report/formatJsonReport.js";
import { formatMarkdownReport } from "../src/report/formatMarkdownReport.js";
import type { SearchQualityReport } from "../src/report/types.js";
const report: SearchQualityReport = {
  tool: "search-quality-kit",
  version: "0.1.0",
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
      docs: "https://example.com/docs",
    },
  ],
  pages: [{ url: "https://example.com/", status: 200 }],
  durationMs: 12,
};
describe("report formatters", () => {
  it("renders readable console output", () => {
    const text = formatConsoleReport(report);
    expect(text).toContain("Checked pages: 1");
    expect(text).toContain("Missing canonical.");
  });
  it("renders machine-readable JSON", () =>
    expect(JSON.parse(formatJsonReport(report)).summary.errors).toBe(1));
  it("renders stable codes in Markdown artifacts", () =>
    expect(formatMarkdownReport(report)).toContain("`missing`"));
});
