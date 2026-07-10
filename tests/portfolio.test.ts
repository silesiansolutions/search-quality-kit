import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { portfolioConfigSchema } from "../src/portfolio/config.js";
import {
  formatPortfolioMarkdownReport,
  parsePortfolioReport,
  portfolioReportSchema,
} from "../src/portfolio/report.js";
import { runPortfolio } from "../src/portfolio/runner.js";
import type { SearchQualityReport } from "../src/report/types.js";

const roots: string[] = [];
const checks = [
  "sitemap",
  "robots",
  "indexability",
  "metadata",
  "canonical",
  "structuredData",
  "openGraph",
  "internalLinks",
  "renderedHtml",
  "accessibility",
  "performanceHints",
] as const;

const html = (origin: string, canonical = `${origin}/`) => `<!doctype html>
<html lang="en"><head><meta name="viewport" content="width=device-width">
<title>A useful example page</title>
<meta name="description" content="A sufficiently detailed summary of this useful example page for visitors.">
<link rel="canonical" href="${canonical}"></head>
<body><main><h1>Example</h1><p>This is substantial visible content for a useful public page that can be indexed.</p></main></body></html>`;

async function site(
  root: string,
  name: string,
  enabledChecks: string[],
  content: string,
) {
  const directory = path.join(root, "sites", name);
  await mkdir(path.join(directory, "dist"), { recursive: true });
  await writeFile(path.join(directory, "dist/index.html"), content, "utf8");
  await writeFile(
    path.join(directory, "search-quality.config.json"),
    JSON.stringify({
      site: { baseUrl: `https://${name}.example` },
      build: { distDir: "dist" },
      crawl: { mode: "static" },
      checks: Object.fromEntries(
        checks.map((check) => [check, enabledChecks.includes(check)]),
      ),
    }),
    "utf8",
  );
}

async function fixture(
  overrides: Record<string, unknown> = {},
  siteOverrides?: Array<Record<string, unknown>>,
) {
  const root = await mkdtemp(path.join(tmpdir(), "sqk-portfolio-"));
  roots.push(root);
  await site(root, "site-a", [], html("https://site-a.example"));
  await site(
    root,
    "site-b",
    ["metadata"],
    "<!doctype html><html><head><title>Home</title></head><body>Content</body></html>",
  );
  await site(
    root,
    "site-c",
    ["canonical"],
    html("https://site-c.example", "http://localhost:3000/"),
  );
  const sites = ["site-a", "site-b", "site-c"].map((name, index) => ({
    name,
    root: `sites/${name}`,
    config: "search-quality.config.json",
    outputDir: `reports/${name}`,
    ...(siteOverrides?.[index] ?? {}),
  }));
  await writeFile(
    path.join(root, "portfolio.search-quality.config.json"),
    JSON.stringify({
      outputDir: "reports",
      sites,
      portfolio: {
        failOn: ["error"],
        failOnNew: true,
        continueOnSiteFailure: true,
        ...overrides,
      },
    }),
    "utf8",
  );
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("portfolio config", () => {
  it("rejects duplicate and unsafe site names", () => {
    const duplicate = {
      sites: [
        { name: "site-a", config: "a.json" },
        { name: "site-a", config: "b.json" },
      ],
    };
    expect(() => portfolioConfigSchema.parse(duplicate)).toThrow(
      "Duplicate site name",
    );
    expect(() =>
      portfolioConfigSchema.parse({
        sites: [{ name: "../escape", config: "a.json" }],
      }),
    ).toThrow("lowercase letters");
  });

  it("rejects unsafe report paths", () => {
    expect(() =>
      portfolioConfigSchema.parse({
        outputDir: "../reports",
        sites: [{ name: "site-a", config: "a.json" }],
      }),
    ).toThrow("safe relative path");
    expect(() =>
      portfolioConfigSchema.parse({
        sites: [
          { name: "site-a", config: "a.json", outputDir: "/tmp/reports" },
        ],
      }),
    ).toThrow("safe relative path");
  });
});

describe("portfolio runner", () => {
  it("runs sites in order, isolates findings, and writes aggregate/per-site reports", async () => {
    const root = await fixture();
    const result = await runPortfolio({
      root,
      configPath: "portfolio.search-quality.config.json",
      sarif: true,
      includeFindings: true,
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.sites.map((site) => site.name)).toEqual([
      "site-a",
      "site-b",
      "site-c",
    ]);
    expect(result.report.sites.map((site) => site.status)).toEqual([
      "passed",
      "passed",
      "failed",
    ]);
    expect(result.report.sites[1]?.summary.newFindings).toBeGreaterThan(0);
    expect(
      result.report.sites[1]?.findings?.every((item) => item.site === "site-b"),
    ).toBe(true);
    expect(result.report.gate.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ site: "site-c", severity: "error" }),
      ]),
    );
    await expect(readFile(result.jsonPath, "utf8")).resolves.toContain(
      '"schemaVersion": "0.7"',
    );
    await expect(readFile(result.markdownPath, "utf8")).resolves.toContain(
      "| site-c | failed |",
    );
    expect(
      JSON.parse(
        await readFile(
          path.join(root, "reports/site-a/search-quality-report.sarif"),
          "utf8",
        ),
      ),
    ).toMatchObject({ version: "2.1.0" });
  });

  it("treats a configured missing baseline as a site error and continues", async () => {
    const root = await fixture({}, [
      {},
      { baseline: "baselines/missing.json" },
      {},
    ]);
    const result = await runPortfolio({
      root,
      configPath: "portfolio.search-quality.config.json",
    });
    expect(result.report.sites[1]).toMatchObject({
      name: "site-b",
      status: "error",
      baseline: { status: "missing" },
      operationalError: { stage: "baseline" },
    });
    expect(result.report.sites[2]?.summary.checkedPages).toBe(1);
  });

  it("reports invalid baselines without hiding other sites", async () => {
    const root = await fixture({}, [
      {},
      { baseline: "invalid-baseline.json" },
      {},
    ]);
    await writeFile(
      path.join(root, "sites/site-b/invalid-baseline.json"),
      "{",
      "utf8",
    );
    const result = await runPortfolio({
      root,
      configPath: "portfolio.search-quality.config.json",
    });
    expect(result.report.sites[1]?.baseline.status).toBe("invalid");
    expect(result.report.sites[2]?.status).toBe("failed");
    expect(result.report.portfolio.operationalErrors).toBe(1);
  });

  it("reports a missing site config and honors continueOnSiteFailure=false", async () => {
    const root = await fixture({ continueOnSiteFailure: false }, [
      { config: "missing.json" },
      {},
      {},
    ]);
    const result = await runPortfolio({
      root,
      configPath: "portfolio.search-quality.config.json",
    });
    expect(result.report.sites.map((site) => site.status)).toEqual([
      "error",
      "skipped",
      "skipped",
    ]);
    expect(result.report.sites[0]?.operationalError?.stage).toBe("config");
  });

  it("turns a plugin failure into a site operational error and continues", async () => {
    const root = await fixture();
    await writeFile(
      path.join(root, "sites/site-b/plugin.config.mjs"),
      `export default {
        site: { baseUrl: "https://site-b.example" },
        build: { distDir: "dist" },
        crawl: { mode: "static" },
        checks: ${JSON.stringify(Object.fromEntries(checks.map((check) => [check, false])))},
        plugins: [{
          name: "showcase-rules",
          checks: [{
            id: "custom.broken",
            title: "Broken",
            category: "custom",
            classification: "local-heuristic",
            defaultSeverity: "warning",
            run() { throw new Error("plugin exploded"); }
          }]
        }]
      };`,
      "utf8",
    );
    const manifestPath = path.join(
      root,
      "portfolio.search-quality.config.json",
    );
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      sites: Array<{ config: string }>;
    };
    manifest.sites[1]!.config = "plugin.config.mjs";
    await writeFile(manifestPath, JSON.stringify(manifest), "utf8");

    const result = await runPortfolio({
      root,
      configPath: "portfolio.search-quality.config.json",
    });
    expect(result.report.sites[1]).toMatchObject({
      status: "error",
      operationalError: {
        stage: "plugin",
        message: "showcase-rules/custom.broken: plugin exploded",
      },
    });
    expect(result.report.sites[2]?.summary.checkedPages).toBe(1);
  });

  it("keeps existing findings out of a per-site new-finding gate and reports resolved findings", async () => {
    const root = await fixture({}, [{}, {}, { baseline: "baseline.json" }]);
    const first = await runPortfolio({
      root,
      configPath: "portfolio.search-quality.config.json",
      reportOnly: true,
      outputDir: "first-run",
    });
    const current = JSON.parse(
      await readFile(
        first.report.sites[2]!.reportPath
          ? path.join(first.outputDirectory, first.report.sites[2]!.reportPath!)
          : "",
        "utf8",
      ),
    ) as SearchQualityReport;
    current.findings.push({
      severity: "error",
      check: "canonical",
      code: "resolved-example",
      message: "A previously reviewed error.",
      suggestion: "Already fixed.",
      docs: "https://example.com/docs",
      url: "https://site-c.example/old",
    });
    await writeFile(
      path.join(root, "sites/site-c/baseline.json"),
      JSON.stringify(current),
      "utf8",
    );

    const result = await runPortfolio({
      root,
      configPath: "portfolio.search-quality.config.json",
    });
    expect(result.report.sites[2]).toMatchObject({
      status: "passed",
      summary: { newFindings: 0, resolvedFindings: 1 },
      baseline: { status: "used" },
    });
    expect(result.report.gate.failures).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ site: "site-c" })]),
    );
  });

  it("writes baselines only explicitly and requires force for replacement", async () => {
    const root = await fixture({}, [
      { baseline: "baseline.json" },
      { baseline: "baseline.json" },
      { baseline: "baseline.json" },
    ]);
    const first = await runPortfolio({
      root,
      configPath: "portfolio.search-quality.config.json",
      writeBaselines: true,
    });
    expect(first.exitCode).toBe(0);
    await expect(
      readFile(path.join(root, "sites/site-a/baseline.json"), "utf8"),
    ).resolves.toContain('"tool": "search-quality-kit"');

    const second = await runPortfolio({
      root,
      configPath: "portfolio.search-quality.config.json",
      writeBaselines: true,
    });
    expect(second.exitCode).toBe(1);
    expect(second.report.sites[0]?.operationalError?.message).toContain(
      "--force",
    );

    const forced = await runPortfolio({
      root,
      configPath: "portfolio.search-quality.config.json",
      writeBaselines: true,
      forceBaselines: true,
    });
    expect(forced.exitCode).toBe(0);
  });

  it("aggregates reviewed suppressions without failing the portfolio gate", async () => {
    const root = await fixture({ failOn: ["warning"], failOnNew: false });
    await writeFile(
      path.join(root, "sites/site-a/search-quality.config.json"),
      JSON.stringify({
        site: { baseUrl: "https://site-a.example" },
        build: { distDir: "dist" },
        crawl: { mode: "static" },
        checks: Object.fromEntries(
          checks.map((check) => [check, check === "canonical"]),
        ),
        allowBroadSuppressions: true,
        suppressions: [
          {
            code: "canonical.missing",
            urlPattern: "/",
            reason: "Reviewed fixture exception.",
            owner: "site-owner",
          },
        ],
      }),
      "utf8",
    );
    await writeFile(
      path.join(root, "sites/site-a/dist/index.html"),
      html("https://site-a.example").replace(/<link rel="canonical"[^>]+>/, ""),
      "utf8",
    );
    const result = await runPortfolio({
      root,
      configPath: "portfolio.search-quality.config.json",
      includeFindings: true,
    });
    expect(result.report.sites[0]).toMatchObject({
      status: "passed",
      summary: { suppressedFindings: 1 },
    });
    expect(result.report.portfolio.suppressedFindings).toBe(1);
    expect(result.report.gate.failures).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ site: "site-a" })]),
    );
    expect(result.report.sites[0]?.findings?.[0]).toMatchObject({
      suppressed: true,
    });
  });

  it("validates the JSON contract and bounded Markdown sections", async () => {
    const root = await fixture({ reportOnly: true });
    const result = await runPortfolio({
      root,
      configPath: "portfolio.search-quality.config.json",
    });
    expect(portfolioReportSchema.safeParse(result.report).success).toBe(true);
    const parsed = parsePortfolioReport(
      await readFile(result.jsonPath, "utf8"),
    );
    expect(parsed.sites).toHaveLength(3);
    expect(parsed.sites[0]).not.toHaveProperty("findings");
    const markdown = formatPortfolioMarkdownReport(parsed);
    [
      "Portfolio summary",
      "Gate status",
      "Per-site status",
      "New findings by site",
      "Top errors",
      "Top warnings",
      "Resolved findings summary",
      "Operational, plugin, config, and baseline errors",
      "Next actions",
    ].forEach((section) => expect(markdown).toContain(section));
    expect(result.exitCode).toBe(0);
    expect(result.report.gate.reason).toContain("Report-only mode observed");
  });

  it("exposes portfolio verify through the CLI and exits from the final gate", async () => {
    const root = await fixture();
    const cli = path.resolve(import.meta.dirname, "../src/cli/index.ts");
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        cli,
        "portfolio",
        "verify",
        "--root",
        root,
        "--config",
        "portfolio.search-quality.config.json",
        "--output-dir",
        "cli-reports",
      ],
      { encoding: "utf8" },
    );
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout).toContain("Portfolio gate: failed");
    await expect(
      readFile(path.join(root, "cli-reports/portfolio.json"), "utf8"),
    ).resolves.toContain('"site": "site-c"');
  });
});
