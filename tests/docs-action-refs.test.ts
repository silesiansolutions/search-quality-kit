import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, ".."),
  reference =
    /^[ \t]*(?:-[ \t]+)?uses:[ \t]+["']?([\w-]+\/[\w.-]+)(?:\/[\w./-]+)?@([^\s"'#]+)["']?(?:[ \t]+#[ \t]*(\S+))?/gm,
  pinned = /^[0-9a-f]{40}$/;

type Reference = {
  file: string;
  action: string;
  ref: string;
  version?: string;
};

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
    for (const [, action, ref, version] of source.matchAll(reference)) {
      if (action && ref) {
        collected.push({ file, action, ref, version });
      }
    }
  }
  return collected;
}

async function documentedReferences(): Promise<Reference[]> {
  return (
    await referencesIn([
      "README.md",
      ...(await filesUnder("docs", [".md"])),
      ...(await filesUnder("examples", [".yml", ".yaml"])),
    ])
  ).filter(({ action }) => action.startsWith("actions/"));
}

async function runtimeReferences(): Promise<Reference[]> {
  return referencesIn([
    ...(await filesUnder(".github/workflows", [".yml", ".yaml"])),
    "action.yml",
    "action/action.yml",
  ]);
}

const pinOf = ({ ref, version }: Reference) => `${ref} # ${version}`;

describe("third-party action references", () => {
  it("pins workflows and shipped metadata to commit SHAs with a version comment", async () => {
    const runtime = await runtimeReferences();

    expect(runtime.length).toBeGreaterThan(0);

    for (const { file, action, ref, version } of runtime) {
      expect(ref, `${file} does not pin ${action} to a commit SHA`).toMatch(
        pinned,
      );
      expect(
        version,
        `${file} pins ${action} without a "# vX.Y.Z" comment`,
      ).toMatch(/^v\d+\.\d+\.\d+$/);
    }
  });

  it("uses one pin per action across workflows and both action metadata files", async () => {
    const runtime = await runtimeReferences(),
      expected = new Map(
        runtime.map(
          (reference) => [reference.action, pinOf(reference)] as const,
        ),
      );

    for (const reference of runtime) {
      expect(
        pinOf(reference),
        `${reference.file} pins ${reference.action} differently from another runtime file`,
      ).toBe(expected.get(reference.action));
    }
  });

  it("teaches the major versions the repository itself runs on movable tags", async () => {
    const runtime = await runtimeReferences(),
      documented = await documentedReferences(),
      expected = new Map(
        runtime.map(
          ({ action, version }) => [action, version?.split(".")[0]] as const,
        ),
      );

    expect(documented.length).toBeGreaterThan(0);

    for (const { file, action, ref } of documented) {
      expect(
        expected.has(action),
        `${file} documents ${action}, which no workflow or action metadata runs`,
      ).toBe(true);
      expect(ref, `${file} teaches ${action} on a different major`).toBe(
        expected.get(action),
      );
    }
  });
});
