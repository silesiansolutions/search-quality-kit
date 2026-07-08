import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { DoctorReport } from "../src/doctor.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const cli = path.join(repositoryRoot, "src/cli/index.ts");
const roots: string[] = [];

function run(args: string[], cwd = repositoryRoot) {
  return spawnSync(process.execPath, ["--import", "tsx", cli, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

async function tempRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "sqk-doctor-"));
  roots.push(root);
  return root;
}

async function writeSite(root: string, config: Record<string, unknown> = {}) {
  await mkdir(path.join(root, "dist"), { recursive: true });
  await writeFile(
    path.join(root, "dist/index.html"),
    "<!doctype html><html><body><main>Ready</main></body></html>",
    "utf8",
  );
  await writeFile(
    path.join(root, "search-quality.config.json"),
    JSON.stringify({
      site: { baseUrl: "https://example.com" },
      crawl: { mode: "static" },
      build: { distDir: "dist" },
      ...config,
    }),
    "utf8",
  );
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("doctor command", () => {
  it("passes for a loadable single-site static config", async () => {
    const root = await tempRoot();
    await writeSite(root);
    const result = run(["doctor", "--root", root, "--json"]);
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as DoctorReport;
    expect(report).toMatchObject({
      mode: "site",
      status: "ok",
      summary: { errors: 0 },
    });
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "config-found", level: "ok" }),
        expect.objectContaining({ code: "build-dist-dir", level: "ok" }),
        expect.objectContaining({
          code: "package-node-engine",
          level: "ok",
        }),
      ]),
    );
  });

  it("exits 2 for a missing static build directory", async () => {
    const root = await tempRoot();
    await writeSite(root, { build: { distDir: "missing-dist" } });
    const result = run(["doctor", "--root", root]);
    expect(result.status).toBe(2);
    expect(result.stdout).toContain("ERROR crawl.mode=static requires");
    expect(result.stdout).toContain("missing-dist");
  });

  it("exits 2 for an explicit missing config", async () => {
    const root = await tempRoot();
    const result = run([
      "doctor",
      "--root",
      root,
      "--config",
      "missing.config.ts",
      "--json",
    ]);
    expect(result.status).toBe(2);
    const report = JSON.parse(result.stdout) as DoctorReport;
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "config-missing", level: "error" }),
      ]),
    );
  });

  it("checks portfolio site configs, baselines, outputs, and gate settings", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, "sites/site-a"), { recursive: true });
    await writeFile(
      path.join(root, "sites/site-a/search-quality.config.json"),
      JSON.stringify({ site: { baseUrl: "https://site-a.example" } }),
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
            config: "search-quality.config.json",
            baseline: "baselines/site-a.json",
          },
          {
            name: "site-b",
            root: "sites/site-b",
            config: "search-quality.config.json",
            enabled: false,
          },
        ],
        portfolio: { failOn: ["error"], failOnNew: true },
      }),
      "utf8",
    );
    const result = run([
      "doctor",
      "--root",
      root,
      "--portfolio-config",
      "portfolio.search-quality.config.json",
      "--json",
    ]);
    expect(result.status).toBe(2);
    const report = JSON.parse(result.stdout) as DoctorReport;
    expect(report.mode).toBe("portfolio");
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "portfolio-site-baseline",
          level: "error",
        }),
        expect.objectContaining({
          code: "portfolio-site-config",
          level: "error",
        }),
        expect.objectContaining({
          code: "portfolio-site-disabled",
          level: "info",
        }),
        expect.objectContaining({ code: "portfolio-gate", level: "ok" }),
      ]),
    );
  });
});
