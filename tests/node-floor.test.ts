import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const root = path.resolve(import.meta.dirname, "..");

async function readText(file: string) {
  return readFile(path.join(root, file), "utf8");
}

async function readJson<T>(file: string) {
  return JSON.parse(await readText(file)) as T;
}

async function filesUnder(
  relative: string,
  extensions: string[],
): Promise<string[]> {
  const entries = await readdir(path.join(root, relative), {
      withFileTypes: true,
    }),
    collected: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const next = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) {
      collected.push(...(await filesUnder(next, extensions)));
    } else if (extensions.includes(path.extname(entry.name))) {
      collected.push(next);
    }
  }
  return collected;
}

function nodeVersions(source: string) {
  return [...source.matchAll(/^\s*node-version:\s*["']?([^"'\s#]+)/gm)].map(
    (match) => match[1] ?? "",
  );
}

function majorOf(version: string) {
  return version.split(".")[0];
}

async function floorMajor() {
  const range = (await readJson<{ engines: { node: string } }>("package.json"))
    .engines.node;
  const major = range.match(/^>=\s*(\d+)(?:\.\d+){0,2}$/)?.[1];
  expect(
    major,
    `engines.node '${range}' is not a plain >= range`,
  ).toBeDefined();
  return major as string;
}

describe("Node floor", () => {
  it("is the same in package.json and the lockfile root", async () => {
    const manifest = await readJson<{ engines: { node: string } }>(
        "package.json",
      ),
      lock = await readJson<{
        packages: Record<string, { engines?: { node?: string } }>;
      }>("package-lock.json");
    expect(lock.packages[""]?.engines?.node).toBe(manifest.engines.node);
  });

  it("is the version the README requires and the build targets", async () => {
    const major = await floorMajor(),
      readme = (await readText("README.md")).match(
        /Requires Node\.js (\d+) or newer\./,
      )?.[1],
      target = (await readText("tsup.config.ts")).match(
        /target:\s*["']node(\d+)["']/,
      )?.[1];
    expect(readme, "README.md requirement line").toBe(major);
    expect(target, "tsup.config.ts target").toBe(major);
  });

  it("is the default node-version of both Action metadata files", async () => {
    const major = await floorMajor(),
      violations: string[] = [];
    for (const file of ["action.yml", "action/action.yml"]) {
      const action = parse(await readText(file)) as {
          inputs: Record<string, { default?: unknown }>;
        },
        value = String(action.inputs["node-version"]?.default);
      if (majorOf(value) !== major) violations.push(`${file}: ${value}`);
    }
    expect(violations, `Node floor is ${major}`).toEqual([]);
  });

  it("is the node-version of every workflow, example and doc snippet", async () => {
    const major = await floorMajor(),
      files = [
        ...(await filesUnder(".github/workflows", [".yml", ".yaml"])),
        ...(await filesUnder("examples", [".yml", ".yaml"])),
        "README.md",
        ...(await filesUnder("docs", [".md"])),
      ],
      scanned: string[] = [],
      violations: string[] = [];
    for (const file of files) {
      const versions = nodeVersions(await readText(file));
      if (versions.length > 0) scanned.push(file);
      for (const version of versions)
        if (majorOf(version) !== major) violations.push(`${file}: ${version}`);
    }
    expect(violations, `Node floor is ${major}`).toEqual([]);
    for (const required of [
      ".github/workflows/ci.yml",
      "examples/ci/github-actions-basic.yml",
      "docs/ci.md",
    ])
      expect(scanned, `no node-version found in ${required}`).toContain(
        required,
      );
  });
});
