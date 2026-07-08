import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/loadConfig.js";
import { presetNames } from "../src/config/presets.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const cli = path.join(repositoryRoot, "src/cli/index.ts");
const roots: string[] = [];

beforeAll(() => {
  const result = spawnSync("npm", ["run", "build"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.status !== 0)
    throw new Error(
      `Could not build the public package entrypoint: ${result.stderr}`,
    );
});

function run(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", cli, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

async function runAsync(args: string[]) {
  return await new Promise<{
    status: number | null;
    stdout: string;
    stderr: string;
  }>((resolve) => {
    const child = spawn(process.execPath, ["--import", "tsx", cli, ...args], {
      cwd: repositoryRoot,
      env: { ...process.env, NO_COLOR: "1" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

async function temporaryRoot() {
  const root = await mkdtemp(path.join(repositoryRoot, ".init-test-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("init presets", () => {
  it.each(presetNames)("generates and loads the %s preset", async (preset) => {
    const root = await temporaryRoot();
    const result = run(["init", "--root", root, "--preset", preset]);
    expect(result.status, result.stderr).toBe(0);
    const source = await readFile(
      path.join(root, "search-quality.config.ts"),
      "utf8",
    );
    expect(source).toContain("defineConfig, presets");
    expect(source).toContain("TODO: replace with the production origin");
    expect((await loadConfig(root)).config.site.baseUrl).toBe(
      "https://example.com",
    );
  });

  it.each(presetNames.filter((name) => name !== "next-hybrid"))(
    "verifies a generated %s static config",
    async (preset) => {
      const root = await temporaryRoot();
      expect(run(["init", "--root", root, "--preset", preset]).status).toBe(0);
      const { config } = await loadConfig(root);
      const dist = path.resolve(root, config.build.distDir);
      await mkdir(dist, { recursive: true });
      await writeFile(
        path.join(dist, "index.html"),
        '<!doctype html><html lang="en"><head><title>Example page</title><meta name="description" content="A useful example description for preset verification in tests."><meta name="viewport" content="width=device-width"><link rel="canonical" href="https://example.com/"></head><body><main><h1>Example page</h1><p>This generated page contains enough server-rendered text to exercise the static preset without a configuration error.</p></main></body></html>',
      );
      const result = run(["verify", "--root", root, "--report-only", "--json"]);
      expect(result.status, result.stderr).toBe(0);
    },
  );

  it("verifies a generated next-hybrid config against a local app", async () => {
    const root = await temporaryRoot();
    expect(
      run(["init", "--root", root, "--preset", "next-hybrid"]).status,
    ).toBe(0);
    const server = createServer((request, response) => {
      response.setHeader("content-type", "text/html");
      if (request.url === "/robots.txt") return response.end("User-agent: *");
      if (request.url === "/sitemap.xml") {
        response.statusCode = 404;
        return response.end("");
      }
      return response.end(
        '<!doctype html><html lang="en"><head><title>Hybrid app</title><meta name="description" content="A local hybrid application used for preset verification."><meta name="viewport" content="width=device-width"><link rel="canonical" href="https://example.com/"></head><body><main><h1>Hybrid app</h1><p>This response verifies the generated HTTP preset against a local server.</p></main></body></html>',
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No port");
      const file = path.join(root, "search-quality.config.ts");
      const source = await readFile(file, "utf8");
      await writeFile(
        file,
        source.replace(
          "http://localhost:3000",
          `http://127.0.0.1:${address.port}`,
        ),
      );
      const result = await runAsync([
        "verify",
        "--root",
        root,
        "--report-only",
        "--json",
      ]);
      expect(result.status, result.stderr).toBe(0);
    } finally {
      server.close();
    }
  });

  it("does not overwrite unless --force is provided", async () => {
    const root = await temporaryRoot();
    const file = path.join(root, "search-quality.config.ts");
    await writeFile(file, "keep me");
    const refused = run(["init", "--root", root, "--preset", "astro"]);
    expect(refused.status).toBe(2);
    expect(await readFile(file, "utf8")).toBe("keep me");
    const forced = run([
      "init",
      "--root",
      root,
      "--preset",
      "astro",
      "--force",
    ]);
    expect(forced.status, forced.stderr).toBe(0);
    expect(await readFile(file, "utf8")).toContain("presets.astro()");
  });

  it("returns exit code 2 for an unknown preset", async () => {
    const root = await temporaryRoot();
    const result = run(["init", "--root", root, "--preset", "wordpress"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Unknown preset "wordpress"');
  });

  it("detects Astro but does not guess an ambiguous Next mode", async () => {
    const astroRoot = await temporaryRoot();
    await writeFile(
      path.join(astroRoot, "package.json"),
      JSON.stringify({ devDependencies: { astro: "latest" } }),
    );
    expect(run(["init", "--root", astroRoot, "--detect"]).stdout).toContain(
      "preset astro",
    );

    const nextRoot = await temporaryRoot();
    await writeFile(
      path.join(nextRoot, "package.json"),
      JSON.stringify({ dependencies: { next: "latest" } }),
    );
    const result = run(["init", "--root", nextRoot, "--detect"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Could not confidently detect");
  });
});
