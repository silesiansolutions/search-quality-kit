import { access } from "node:fs/promises";
import path from "node:path";
import { createJiti } from "jiti";
import {
  configSchema,
  type SearchQualityConfig,
  type SearchQualityConfigInput,
} from "./schema.js";
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
      `Invalid search quality config:\n${parsed.error.issues.map((i) => `${i.path.join(".") || "config"}: ${i.message}`).join("\n")}`,
    );
  if (parsed.data.rules.title.maxLength < parsed.data.rules.title.minLength)
    throw new Error(
      "Invalid search quality config: title.maxLength must be >= title.minLength",
    );
  if (
    parsed.data.rules.description.maxLength <
    parsed.data.rules.description.minLength
  )
    throw new Error(
      "Invalid search quality config: description.maxLength must be >= description.minLength",
    );
  return { config: parsed.data, ...(file ? { path: file } : {}) };
}
export const CONFIG_FILE_TEMPLATE = `import type { SearchQualityConfigInput } from "search-quality-kit";

export default {
  site: { baseUrl: "https://example.com" },
  build: { distDir: "dist" },
  crawl: { entrypoints: ["/"], maxPages: 100, exclude: ["/admin", "/preview", "/api", "/404", "/404.html"] },
  ci: { failOn: ["error"] },
} satisfies SearchQualityConfigInput;
`;
