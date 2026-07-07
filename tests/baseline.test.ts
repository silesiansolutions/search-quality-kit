import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/defaultConfig.js";
import { shouldFail } from "../src/engine/verify.js";
import { findingFingerprint, newFindings } from "../src/report/baseline.js";
import type { SearchQualityReport } from "../src/report/types.js";

const finding = (message: string, url = "https://example.com/") => ({
  severity: "error" as const,
  check: "canonical",
  code: "missing",
  message,
  suggestion: "Add one.",
  url,
  docs: "https://example.com/docs",
});

const report = (
  findings: SearchQualityReport["findings"],
): SearchQualityReport => ({
  tool: "search-quality-kit",
  version: "0.2.0",
  generatedAt: "2026-07-07T00:00:00.000Z",
  mode: "static",
  target: "dist",
  summary: { checkedPages: 1, errors: findings.length, warnings: 0, info: 0 },
  findings,
  pages: [],
  durationMs: 1,
});

describe("finding baselines", () => {
  it("compares stable code, location, URL, and normalized message", () => {
    const baselineFinding = finding("Missing   canonical.");
    const currentFinding = finding(" missing canonical. ");
    expect(findingFingerprint(currentFinding)).toBe(
      findingFingerprint(baselineFinding),
    );
    expect(
      newFindings(report([currentFinding]), report([baselineFinding])),
    ).toEqual([]);
  });

  it("returns findings at a new URL", () => {
    const current = finding("Missing canonical.", "https://example.com/new");
    const additions = newFindings(
      report([current]),
      report([finding("Missing canonical.")]),
    );
    expect(additions).toEqual([current]);
    expect(shouldFail(report([current]), defaultConfig, false, additions)).toBe(
      true,
    );
  });
});
