import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Finding, SearchQualityReport } from "../src/report/types.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const cli = path.join(repositoryRoot, "src/cli/index.ts");
let root: string;
let current: SearchQualityReport;

function run(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", cli, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

async function writeReport(name: string, report: SearchQualityReport) {
  const file = path.join(root, name);
  await writeFile(file, JSON.stringify(report), "utf8");
  return file;
}

describe("CLI baseline mode", () => {
  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "search-quality-cli-"));
    await mkdir(path.join(root, "dist"));
    await writeFile(
      path.join(root, "dist/index.html"),
      "<!doctype html><html><head><title>Test</title></head><body><p>Short</p></body></html>",
      "utf8",
    );
    await writeFile(
      path.join(root, "search-quality.config.json"),
      JSON.stringify({
        site: { baseUrl: "https://example.com" },
        build: { distDir: "dist" },
      }),
      "utf8",
    );
    const result = run([
      "verify",
      "--root",
      root,
      "--report-only",
      "--json",
      "--output",
      "current.json",
    ]);
    expect(result.status, result.stderr).toBe(0);
    current = JSON.parse(
      await readFile(path.join(root, "current.json"), "utf8"),
    ) as SearchQualityReport;
    expect(
      current.findings.some((finding) => finding.severity === "error"),
    ).toBe(true);
    expect(
      current.findings.some((finding) => finding.severity === "warning"),
    ).toBe(true);
    expect(
      current.findings.every((finding) => finding.classification?.length),
    ).toBe(true);
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("keeps normal no-baseline CI behavior", () => {
    const result = run([
      "verify",
      "--root",
      root,
      "--json",
      "--output",
      "no-baseline.json",
    ]);
    expect(result.status).toBe(1);
  });

  it("passes against a matching baseline", () => {
    const result = run([
      "verify",
      "--root",
      root,
      "--baseline",
      "current.json",
      "--fail-on-new",
      "--json",
      "--output",
      "matching.json",
    ]);
    expect(result.status, result.stderr).toBe(0);
  });

  it("does not fail on a new warning with the default failOn policy", async () => {
    const warning = current.findings.find(
      (finding) => finding.severity === "warning",
    )!;
    await writeReport("without-warning.json", {
      ...current,
      findings: current.findings.filter((finding) => finding !== warning),
    });
    const result = run([
      "verify",
      "--root",
      root,
      "--baseline",
      "without-warning.json",
      "--fail-on-new",
      "--json",
      "--output",
      "new-warning.json",
    ]);
    expect(result.status, result.stderr).toBe(0);
  });

  it("fails on a new error", async () => {
    const error = current.findings.find(
      (finding) => finding.severity === "error",
    )!;
    await writeReport("without-error.json", {
      ...current,
      findings: current.findings.filter((finding) => finding !== error),
    });
    const result = run([
      "verify",
      "--root",
      root,
      "--baseline",
      "without-error.json",
      "--fail-on-new",
      "--json",
      "--output",
      "new-error.json",
    ]);
    expect(result.status).toBe(1);
  });

  it("reports resolved findings without failing", async () => {
    const resolved: Finding = {
      severity: "error",
      check: "canonical",
      code: "old-finding",
      message: "Old finding.",
      suggestion: "Already fixed.",
      url: "https://example.com/old",
      docs: "https://example.com/docs",
    };
    await writeReport("with-resolved.json", {
      ...current,
      findings: [...current.findings, resolved],
    });
    const result = run([
      "verify",
      "--root",
      root,
      "--baseline",
      "with-resolved.json",
      "--fail-on-new",
      "--json",
      "--output",
      "resolved.json",
    ]);
    expect(result.status, result.stderr).toBe(0);
    const output = JSON.parse(
      await readFile(path.join(root, "resolved.json"), "utf8"),
    ) as SearchQualityReport;
    expect(output.baseline?.summary).toMatchObject({
      newFindings: 0,
      resolvedFindings: 1,
    });
    expect(output.baseline?.resolvedFindings[0]?.code).toBe("old-finding");
  });

  it("returns exit code 2 for invalid baseline JSON", async () => {
    await writeFile(path.join(root, "invalid.json"), "{", "utf8");
    const result = run([
      "verify",
      "--root",
      root,
      "--baseline",
      "invalid.json",
      "--fail-on-new",
    ]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Invalid baseline: expected valid JSON");
  });

  it("requires a baseline for --fail-on-new", () => {
    const result = run(["verify", "--root", root, "--fail-on-new"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--fail-on-new requires --baseline");
  });

  it("reformats a JSON report as SARIF", () => {
    const result = run([
      "report",
      path.join(root, "current.json"),
      "--format",
      "sarif",
      "--output",
      path.join(root, "report.sarif"),
    ]);
    expect(result.status, result.stderr).toBe(0);
  });

  it("keeps JSON stdout clean when the build writes logs", async () => {
    await writeFile(
      path.join(root, "build-log.config.json"),
      JSON.stringify({
        site: { baseUrl: "https://example.com" },
        build: {
          command: `${JSON.stringify(process.execPath)} -e "console.log('build output')"`,
          distDir: "dist",
        },
      }),
      "utf8",
    );
    const result = run([
      "verify",
      "--root",
      root,
      "--config",
      "build-log.config.json",
      "--report-only",
      "--json",
    ]);
    expect(result.status, result.stderr).toBe(0);
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    expect(result.stderr).toContain("build output");
  });

  it("shows stable classifications in list-checks", () => {
    const result = run(["list-checks"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("CLASSIFICATIONS");
    expect(result.stdout).toContain("google-requirement");
    expect(result.stdout).toContain("cross-channel-metadata");
    expect(result.stdout).toContain("accessibility-basic");
  });

  it("explains a missing static output directory", async () => {
    await writeFile(
      path.join(root, "missing-dist.config.json"),
      JSON.stringify({
        site: { baseUrl: "https://example.com" },
        build: { distDir: "not-built" },
        crawl: { mode: "static" },
      }),
    );
    const result = run([
      "verify",
      "--root",
      root,
      "--config",
      "missing-dist.config.json",
    ]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("build.distDir does not exist");
    expect(result.stderr).toContain("Build the site first");
  });

  it("adds field context when build.command fails", async () => {
    await writeFile(
      path.join(root, "failing-build.config.json"),
      JSON.stringify({
        site: { baseUrl: "https://example.com" },
        build: {
          command: `${JSON.stringify(process.execPath)} -e "process.exit(7)"`,
          distDir: "dist",
        },
        crawl: { mode: "static" },
      }),
    );
    const result = run([
      "verify",
      "--root",
      root,
      "--config",
      "failing-build.config.json",
    ]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("build.command failed");
    expect(result.stderr).toContain("Run it manually");
  });
});
