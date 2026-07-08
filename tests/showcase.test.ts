import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { loadConfig } from "../src/config/loadConfig.js";
import { loadPortfolioConfig } from "../src/portfolio/config.js";

const root = path.resolve(import.meta.dirname, "..");
const showcase = path.join(root, "examples/showcase");

describe("public showcase", () => {
  it("loads three secret-free HTTP configs in report-only mode", async () => {
    const { config } = await loadPortfolioConfig(
      root,
      "examples/showcase/portfolio.search-quality.config.ts",
    );
    expect(config.portfolio.reportOnly).toBe(true);
    expect(config.portfolio.continueOnSiteFailure).toBe(true);
    expect(config.sites.map((site) => site.name)).toEqual([
      "dawidrylko",
      "silesiansolutions",
      "cyberkatalog",
    ]);
    expect(config.sites.every((site) => site.baseline === undefined)).toBe(
      true,
    );

    for (const site of config.sites) {
      const loaded = await loadConfig(showcase, site.config);
      expect(loaded.config.crawl.mode).toBe("http");
      expect(loaded.config.site.localUrl).toBeUndefined();
      expect(loaded.config.build.command).toBeUndefined();
      expect(loaded.config.build.startCommand).toBeUndefined();
      const source = await readFile(path.join(showcase, site.config), "utf8");
      expect(source).not.toMatch(/process\.env|secret|token/i);
    }
  });

  it("keeps the showcase workflow observational and artifact-based", async () => {
    const workflow = parse(
      await readFile(path.join(root, ".github/workflows/showcase.yml"), "utf8"),
    ) as {
      on: Record<string, unknown>;
      jobs: {
        showcase: {
          steps: Array<{ uses?: string; with?: Record<string, string> }>;
        };
      };
    };
    expect(workflow.on).toHaveProperty("workflow_dispatch");
    expect(workflow.on).toHaveProperty("schedule");
    const action = workflow.jobs.showcase.steps.find(
      (step) => step.uses === "./action",
    );
    expect(action?.with).toMatchObject({
      mode: "portfolio",
      "report-only": "true",
      "upload-artifact": "true",
      summary: "true",
    });
  });
});
