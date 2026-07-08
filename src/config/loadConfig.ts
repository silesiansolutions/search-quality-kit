import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { createJiti } from "jiti";
import {
  configSchema,
  type SearchQualityConfig,
  type SearchQualityConfigInput,
} from "./schema.js";
import { type PresetName, presetNames } from "./presets.js";
const NAMES = [
  "search-quality.config.ts",
  "search-quality.config.mts",
  "search-quality.config.js",
  "search-quality.config.mjs",
  "search-quality.config.cjs",
  "search-quality.config.json",
];
async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}
export async function findConfig(root: string, explicit?: string) {
  if (explicit) {
    const file = path.resolve(root, explicit);
    if (!(await exists(file)))
      throw new Error(`Config file not found: ${file}`);
    return file;
  }
  for (const name of NAMES) {
    const file = path.join(root, name);
    if (await exists(file)) return file;
  }
  return undefined;
}
export async function loadConfig(
  root = process.cwd(),
  explicit?: string,
): Promise<{ config: SearchQualityConfig; path?: string }> {
  const file = await findConfig(root, explicit);
  let input: SearchQualityConfigInput = {};
  if (file) {
    const jiti = createJiti(import.meta.url, { interopDefault: true });
    const loaded = await jiti.import<any>(file, { default: true });
    input = (loaded?.default ?? loaded) as SearchQualityConfigInput;
  }
  const parsed = configSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      `Invalid search quality config:\n${parsed.error.issues.map((i) => `${i.path.join(".") || "config"}: ${i.message} Fix the value in ${file ?? "search-quality.config.ts"}.`).join("\n")}`,
    );
  if (!parsed.data.site.baseUrl)
    throw new Error(
      "Invalid search quality config: site.baseUrl is missing. Set it to the production origin, for example https://example.com.",
    );
  if (parsed.data.crawl.mode === "static" && parsed.data.site.localUrl)
    throw new Error(
      "Invalid search quality config: site.localUrl conflicts with crawl.mode=static. Remove localUrl or use crawl.mode=http.",
    );
  if (parsed.data.build.startCommand && !parsed.data.site.localUrl)
    throw new Error(
      "Invalid search quality config: build.startCommand requires site.localUrl. Set the preview URL or remove startCommand.",
    );
  if (
    parsed.data.crawl.exclude.some(
      (route) => route.trim().replace(/\/+$/, "") === "",
    )
  )
    throw new Error(
      "Invalid search quality config: crawl.exclude contains '/'; this excludes every route. Remove it and list only intentional route prefixes.",
    );
  const excluded = (route: string) =>
    parsed.data.crawl.exclude.some(
      (prefix) => route === prefix || route.startsWith(`${prefix}/`),
    );
  if (
    !parsed.data.crawl.include.length ||
    parsed.data.crawl.include.every(excluded) ||
    parsed.data.crawl.entrypoints.every(excluded)
  )
    throw new Error(
      "Invalid search quality config: crawl.include/exclude removes every configured entrypoint. Keep at least one auditable route or narrow crawl.exclude.",
    );
  if (parsed.data.rules.title.maxLength < parsed.data.rules.title.minLength)
    throw new Error(
      "Invalid search quality config: rules.title.maxLength must be greater than or equal to rules.title.minLength.",
    );
  if (
    parsed.data.rules.description.maxLength <
    parsed.data.rules.description.minLength
  )
    throw new Error(
      "Invalid search quality config: rules.description.maxLength must be greater than or equal to rules.description.minLength.",
    );
  return { config: parsed.data, ...(file ? { path: file } : {}) };
}

export async function detectPreset(
  root: string,
): Promise<PresetName | undefined> {
  const packageFile = path.resolve(root, "package.json");
  if (!(await exists(packageFile))) return undefined;
  const packageJson = JSON.parse(await readFile(packageFile, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  const candidates: PresetName[] = [];
  if (dependencies.astro) candidates.push("astro");
  if (dependencies.gatsby) candidates.push("gatsby");
  if (dependencies.next) {
    const nextConfigs = [
      "next.config.js",
      "next.config.mjs",
      "next.config.ts",
      "next.config.cjs",
    ];
    for (const config of nextConfigs) {
      const file = path.join(root, config);
      if (!(await exists(file))) continue;
      const source = await readFile(file, "utf8");
      if (/\boutput\s*:\s*["']export["']/.test(source))
        candidates.push("next-static");
      break;
    }
  }
  const knownMetaFramework =
    dependencies.astro ||
    dependencies.gatsby ||
    dependencies.next ||
    dependencies["@sveltejs/kit"] ||
    dependencies.nuxt;
  if (dependencies.vite && !knownMetaFramework) candidates.push("vite-spa");
  const unique = [...new Set(candidates)];
  return unique.length === 1 ? unique[0] : undefined;
}

export const supportedPresetMessage = presetNames.join(", ");
