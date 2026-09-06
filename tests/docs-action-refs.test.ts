import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, ".."),
  reference = /uses:\s+["']?(actions\/[\w.-]+)@([^\s"']+)/g;

type Reference = { file: string; action: string; ref: string };

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

async function referencesIn(files: string[]): Promise<Reference[]> {
  const collected: Reference[] = [];
  for (const file of files) {
    const source = await readFile(path.join(root, file), "utf8");
    for (const [, action, ref] of source.matchAll(reference)) {
      if (action && ref) {
        collected.push({ file, action, ref });
      }
    }
  }
  return collected;
}

async function documentedReferences(): Promise<Reference[]> {
  return referencesIn([
    "README.md",
    ...(await filesUnder("docs", [".md"])),
    ...(await filesUnder("examples", [".yml", ".yaml"])),
  ]);
}

describe("third-party action references", () => {
  it("teaches the same major versions the repository itself runs", async () => {
    const workflows = await referencesIn(
        await filesUnder(".github/workflows", [".yml", ".yaml"]),
      ),
      documented = await documentedReferences(),
      expected = new Map(
        workflows.map(({ action, ref }) => [action, ref] as const),
      );

    expect(workflows.length).toBeGreaterThan(0);
    expect(documented.length).toBeGreaterThan(0);

    expect(
      workflows.map(({ file, action, ref }) => `${file}: ${action}@${ref}`),
    ).toEqual(
      workflows.map(
        ({ file, action }) => `${file}: ${action}@${expected.get(action)}`,
      ),
    );

    expect(
      documented.map(({ file, action, ref }) => `${file}: ${action}@${ref}`),
    ).toEqual(
      documented.map(
        ({ file, action }) => `${file}: ${action}@${expected.get(action)}`,
      ),
    );
  });

  it("keeps documentation on movable major tags and shipped metadata on commit SHAs", async () => {
    const documented = await documentedReferences(),
      shipped = await referencesIn(["action.yml", "action/action.yml"]);

    expect(shipped.length).toBeGreaterThan(0);

    for (const { file, action, ref } of documented) {
      expect(ref, `${file} pins ${action} to a non-major ref`).toMatch(/^v\d+$/);
    }

    for (const { file, action, ref } of shipped) {
      expect(ref, `${file} does not pin ${action} to a commit SHA`).toMatch(
        /^[0-9a-f]{40}$/,
      );
    }
  });
});
