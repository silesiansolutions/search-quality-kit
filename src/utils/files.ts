import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
export async function fileExists(file: string) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}
export async function readOptional(file: string) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return undefined;
  }
}
export async function walkFiles(root: string) {
  const out: string[] = [];
  async function walk(dir: string) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile()) out.push(full);
    }
  }
  await walk(root);
  return out;
}
