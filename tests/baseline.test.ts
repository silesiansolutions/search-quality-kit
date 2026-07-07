import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/defaultConfig.js";
import { shouldFail } from "../src/engine/verify.js";
import {
  compareBaseline,
  findingFingerprint,
  parseBaselineReport,
  withBaselineComparison,
} from "../src/report/baseline.js";
import type { Finding, SearchQualityReport } from "../src/report/types.js";

const finding = (
  message: string,
  url = "https://example.com/",
  severity: Finding["severity"] = "error",
): Finding => ({
  severity,
  check: "canonical",
  code: "missing",
  message,
  suggestion: "Add one.",
  url,
  file: "/tmp/dist/index.html",
  docs: "https://example.com/docs",
});

const report = (
  findings: SearchQualityReport["findings"],
): SearchQualityReport => ({
  schemaVersion: "0.3",
  tool: "search-quality-kit",
  version: "0.3.0",
  generatedAt: "2026-07-07T00:00:00.000Z",
  mode: "static",
  target: "dist",
  summary: {
    checkedPages: 1,
    errors: findings.filter((item) => item.severity === "error").length,
    warnings: findings.filter((item) => item.severity === "warning").length,
    info: findings.filter((item) => item.severity === "info").length,
  },
  findings,
  pages: [],
  durationMs: 1,
});

describe("finding baselines", () => {
  it("normalizes URLs, file separators, whitespace, and case", () => {
    const baselineFinding = finding(
      "Missing   canonical.",
      "https://EXAMPLE.com/path/#fragment",
    );
    baselineFinding.file = "C:\\site\\index.html";
    const currentFinding = finding(
      " missing canonical. ",
      "https://example.com/path",
    );
    currentFinding.file = "c:/site/index.html";
    expect(findingFingerprint(currentFinding)).toBe(
      findingFingerprint(baselineFinding),
    );
  });

  it("includes severity in identity", () => {
    expect(findingFingerprint(finding("Same", undefined, "warning"))).not.toBe(
      findingFingerprint(finding("Same", undefined, "error")),
    );
  });

  it("normalizes static locations relative to each report target", () => {
    const currentFinding = finding("Same");
    currentFinding.file = "/home/runner/work/site/dist/blog/index.html";
    const baselineFinding = finding("Same");
    baselineFinding.file = "/Users/developer/site/dist/blog/index.html";
    const current = {
        ...report([currentFinding]),
        target: "/home/runner/work/site/dist",
      },
      baseline = {
        ...report([baselineFinding]),
        target: "/Users/developer/site/dist",
      };
    expect(compareBaseline(current, baseline).new).toEqual([]);
  });

  it("separates existing, new, and resolved findings", () => {
    const existing = finding("Existing"),
      added = finding("Added", "https://example.com/new"),
      resolved = finding("Resolved", "https://example.com/old"),
      comparison = compareBaseline(
        report([existing, added]),
        report([existing, resolved]),
      );
    expect(comparison).toEqual({
      existing: [existing],
      new: [added],
      resolved: [resolved],
    });
  });

  it("compares duplicate fingerprints as a multiset", () => {
    const duplicate = finding("Duplicate");
    expect(
      compareBaseline(report([duplicate, duplicate]), report([duplicate])),
    ).toMatchObject({ existing: [duplicate], new: [duplicate], resolved: [] });
  });

  it("adds deterministic baseline counts and finding lists to the report", () => {
    const existing = finding("Existing"),
      added = finding("Added", "https://example.com/new"),
      resolved = finding("Resolved", "https://example.com/old"),
      compared = withBaselineComparison(
        report([existing, added]),
        report([existing, resolved]),
      );
    expect(compared.baseline?.summary).toEqual({
      totalFindings: 2,
      existingFindings: 1,
      newFindings: 1,
      resolvedFindings: 1,
    });
    expect(compared.baseline?.newFindings).toEqual([added]);
    expect(compared.baseline?.resolvedFindings).toEqual([resolved]);
  });

  it("fails only when new findings match ci.failOn", () => {
    const warning = finding("Warning", undefined, "warning"),
      error = finding("Error");
    expect(shouldFail(report([warning]), defaultConfig, false, [warning])).toBe(
      false,
    );
    expect(shouldFail(report([error]), defaultConfig, false, [error])).toBe(
      true,
    );
    expect(shouldFail(report([error]), defaultConfig, true, [error])).toBe(
      false,
    );
  });

  it("accepts current and legacy reports but rejects incompatible schemas", () => {
    expect(parseBaselineReport(JSON.stringify(report([]))).findings).toEqual(
      [],
    );
    const legacy: Partial<SearchQualityReport> = { ...report([]) };
    delete legacy.schemaVersion;
    expect(parseBaselineReport(JSON.stringify(legacy)).findings).toEqual([]);
    expect(() =>
      parseBaselineReport(
        JSON.stringify({ ...report([]), schemaVersion: "0.4" }),
      ),
    ).toThrow("Unsupported baseline schemaVersion: 0.4");
  });

  it("returns practical errors for malformed baselines", () => {
    expect(() => parseBaselineReport("{")).toThrow(
      "Invalid baseline: expected valid JSON.",
    );
    expect(() =>
      parseBaselineReport(JSON.stringify({ tool: "other", findings: [] })),
    ).toThrow("Invalid baseline: expected a search-quality-kit report.");
  });
});
