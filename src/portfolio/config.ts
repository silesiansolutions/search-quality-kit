import path from "node:path";
import { access } from "node:fs/promises";
import { createJiti } from "jiti";
import { z } from "zod";
import type { Severity } from "../report/types.js";

const portfolioConfigNames = [
  "portfolio.search-quality.config.ts",
  "portfolio.search-quality.config.mts",
  "portfolio.search-quality.config.js",
  "portfolio.search-quality.config.mjs",
  "portfolio.search-quality.config.cjs",
  "portfolio.search-quality.config.json",
];

const safeRelativePath = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !path.isAbsolute(value) &&
      !path.win32.isAbsolute(value) &&
      !value.split(/[\\/]+/).includes(".."),
    "Expected a safe relative path without '..'.",
  );

export const safeSiteName = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;

export const portfolioConfigSchema = z
  .object({
    outputDir: safeRelativePath.default("search-quality-reports"),
    sites: z
      .array(
        z.object({
          name: z.string().regex(safeSiteName, {
            error:
              "Use 1-64 lowercase letters, numbers, dots, underscores, or hyphens; start and end with a letter or number.",
          }),
          root: safeRelativePath.default("."),
          config: safeRelativePath,
          baseline: safeRelativePath.optional(),
          outputDir: safeRelativePath.optional(),
          enabled: z.boolean().default(true),
        }),
      )
      .min(1),
    portfolio: z
      .object({
        failOn: z
          .array(z.enum(["error", "warning", "info"]))
          .default(["error"]),
        failOnNew: z.boolean().default(false),
        continueOnSiteFailure: z.boolean().default(true),
        reportOnly: z.boolean().default(false),
      })
      .prefault({}),
  })
  .superRefine((value, context) => {
    const names = new Set<string>();
    value.sites.forEach((site, index) => {
      if (names.has(site.name))
        context.addIssue({
          code: "custom",
          path: ["sites", index, "name"],
          message: `Duplicate site name "${site.name}".`,
        });
      names.add(site.name);
    });
  });

export type PortfolioConfig = z.infer<typeof portfolioConfigSchema>;
export type PortfolioConfigInput = z.input<typeof portfolioConfigSchema>;

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function findPortfolioConfig(root: string, explicit?: string) {
  if (explicit) {
    const file = path.resolve(root, explicit);
    if (!(await exists(file)))
      throw new Error(`Portfolio config file not found: ${file}`);
    return file;
  }
  for (const name of portfolioConfigNames) {
    const file = path.join(root, name);
    if (await exists(file)) return file;
  }
  throw new Error(
    `Portfolio config file not found in ${root}. Pass --config portfolio.search-quality.config.ts.`,
  );
}

export async function loadPortfolioConfig(
  root = process.cwd(),
  explicit?: string,
): Promise<{ config: PortfolioConfig; path: string }> {
  const file = await findPortfolioConfig(root, explicit);
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  const loaded = await jiti.import<unknown>(file, { default: true });
  const input = (loaded as { default?: unknown })?.default ?? loaded;
  const parsed = portfolioConfigSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      `Invalid portfolio config:\n${parsed.error.issues
        .map(
          (issue) =>
            `${issue.path.join(".") || "config"}: ${issue.message} Fix the value in ${file}.`,
        )
        .join("\n")}`,
    );
  return { config: parsed.data, path: file };
}

export const portfolioFailOn = (failOn: Severity[]) => [...new Set(failOn)];
