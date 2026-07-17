import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_VERSION,
  createPortfolioContract,
  createSiteContract,
  formatContractJson,
  formatContractMarkdown,
} from "../src/contract.js";

const roots: string[] = [];
const repositoryRoot = path.resolve(import.meta.dirname, "..");
const cli = path.join(repositoryRoot, "src/cli/index.ts");

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function siteFixture(root: string, directory = root) {
  await mkdir(directory, { recursive: true });
  const marker = path.join(directory, "build-ran.txt");
  await writeFile(
    path.join(directory, "search-quality.config.mjs"),
    `export default {
      site: { baseUrl: "https://example.com" },
      build: { command: ${JSON.stringify(`${process.execPath} -e "require('node:fs').writeFileSync('${marker}', 'ran')"`)} },
      crawl: { entrypoints: ["/"], exclude: ["/admin", "/preview"] },
      profiles: {
        default: "company",
        routes: [{ pattern: "/services/**", profile: "servicePage" }]
      },
      plugins: [{
        name: "company-site",
        policyPack: {
          name: "companySite",
          optionsSummary: {
            contactLinkText: ["Kontakt", "Napisz"],
            routePatterns: ["/", "/services/**"]
          }
        },
        checks: [{
          id: "company-site.contact-link",
          title: "Company contact link",
          category: "policy-pack",
          classification: "profile-expectation",
          defaultSeverity: "warning",
          docsUrl: "https://example.com/docs",
          run() { throw new Error("contract must not execute plugin checks"); }
        }]
      }],
      suppressions: [{
        code: "company-site.contact-link",
        urlPattern: "/services/legacy/**",
        reason: "Legacy services use the global contact CTA.",
        owner: "growth",
        expires: "2026-12-31"
      }],
      ci: { failOn: ["error", "warning"] }
    };`,
    "utf8",
  );
  return marker;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("search quality contracts", () => {
  it("exports validated site policy without builds, crawls, or functions", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "sqk-contract-"));
    roots.push(root);
    const marker = await siteFixture(root);
    const contract = await createSiteContract(
      root,
      "search-quality.config.mjs",
    );
    expect(contract).toMatchObject({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      type: "site",
      site: { baseUrl: "https://example.com" },
      crawl: { entrypoints: ["/"], exclude: ["/admin", "/preview"] },
      profiles: {
        default: "company",
        routes: [{ pattern: "/services/**", profile: "servicePage" }],
      },
      plugins: [
        {
          name: "company-site",
          source: "policy-pack",
          checks: [
            {
              id: "company-site.contact-link",
              classification: "profile-expectation",
              defaultSeverity: "warning",
            },
          ],
        },
      ],
      policyPacks: [
        {
          name: "companySite",
          optionsSummary: { contactLinkText: ["Kontakt", "Napisz"] },
        },
      ],
      suppressions: [
        {
          code: "company-site.contact-link",
          owner: "growth",
          expires: "2026-12-31",
        },
      ],
      ci: { failOn: ["error", "warning"], warnOnly: false },
    });
    expect(contract.checks.enabled).toContain("metadata");
    expect(contract.checks.disabled).toEqual([]);
    const json = formatContractJson(contract);
    expect(json).not.toContain("build-ran");
    expect(json).not.toContain("run()");
    expect(json).not.toContain("localUrl");
    expect(await exists(marker)).toBe(false);
    expect(formatContractMarkdown(contract)).toBe(
      formatContractMarkdown(contract),
    );
  });

  it("exports portfolio paths, gate, and per-site config summaries", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "sqk-contract-portfolio-"));
    roots.push(root);
    await siteFixture(root, path.join(root, "sites/site-a"));
    await mkdir(path.join(root, "sites/site-b"), { recursive: true });
    await writeFile(
      path.join(root, "sites/site-b/search-quality.config.json"),
      JSON.stringify({ site: { baseUrl: "https://site-b.example" } }),
      "utf8",
    );
    await writeFile(
      path.join(root, "portfolio.search-quality.config.json"),
      JSON.stringify({
        outputDir: "reports",
        sites: [
          {
            name: "site-a",
            root: "sites/site-a",
            config: "search-quality.config.mjs",
            baseline: "baseline.json",
          },
          {
            name: "site-b",
            root: "sites/site-b",
            config: "search-quality.config.json",
            outputDir: "reports/custom-site-b",
          },
        ],
        portfolio: {
          failOn: ["error"],
          failOnNew: true,
          reportOnly: true,
        },
      }),
      "utf8",
    );
    const contract = await createPortfolioContract(
      root,
      "portfolio.search-quality.config.json",
    );
    expect(contract).toMatchObject({
      schemaVersion: "0.10",
      type: "portfolio",
      outputDir: "reports",
      portfolio: { failOn: ["error"], failOnNew: true, reportOnly: true },
      sites: [
        {
          name: "site-a",
          config: "search-quality.config.mjs",
          baseline: "baseline.json",
          outputDir: "reports/site-a",
          summary: { site: { baseUrl: "https://example.com" } },
        },
        {
          name: "site-b",
          outputDir: "reports/custom-site-b",
          summary: { site: { baseUrl: "https://site-b.example" } },
        },
      ],
    });
    expect(formatContractMarkdown(contract)).toContain(
      "# Search Quality Portfolio Contract",
    );
  });

  it("exposes JSON and Markdown export through the CLI", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "sqk-contract-cli-"));
    roots.push(root);
    const marker = await siteFixture(root);
    const json = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        cli,
        "contract",
        "--root",
        root,
        "--config",
        "search-quality.config.mjs",
        "--output",
        "contract.json",
      ],
      { encoding: "utf8" },
    );
    expect(json.status, json.stderr).toBe(0);
    expect(
      JSON.parse(await readFile(path.join(root, "contract.json"), "utf8")),
    ).toMatchObject({ schemaVersion: "0.10", type: "site" });
    const markdown = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        cli,
        "contract",
        "--root",
        root,
        "--config",
        "search-quality.config.mjs",
        "--format",
        "markdown",
      ],
      { encoding: "utf8" },
    );
    expect(markdown.status, markdown.stderr).toBe(0);
    expect(markdown.stdout).toContain("# Search Quality Contract");
    expect(await exists(marker)).toBe(false);
  });

  it("rejects invalid configs through the normal config loader", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "sqk-contract-invalid-"));
    roots.push(root);
    await writeFile(
      path.join(root, "search-quality.config.json"),
      JSON.stringify({ site: { baseUrl: "not-a-url" } }),
      "utf8",
    );
    await expect(createSiteContract(root)).rejects.toThrow(
      "Invalid search quality config",
    );
  });
});
