import { z } from "zod";
import { VERSION } from "../version.js";
import {
  profileIds,
  structuredDataTypes,
  validRoutePattern,
} from "./profileDefinitions.js";
import { validatePluginCollection } from "../plugins/definePlugin.js";
import type { PluginDefinition } from "../plugins/types.js";
const command = z.string().min(1).optional();
const stableFindingCode = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/,
    "Expected a stable namespaced finding code, for example metadata.description-length.",
  );
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD format.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Expected a valid calendar date in YYYY-MM-DD format.");
const broadSuppressionPatterns = new Set(["/", "/*", "/**"]);
const httpUrl = (label: string) =>
  z
    .url({ error: `Expected an absolute http(s) ${label} URL.` })
    .refine((value) => /^https?:\/\//.test(value), {
      error: `Expected an absolute http(s) ${label} URL.`,
    });
const baseConfigSchema = z.object({
  site: z
    .object({
      baseUrl: httpUrl("production").optional(),
      localUrl: httpUrl("local preview").optional(),
      stagingHosts: z
        .array(z.string())
        .default(["staging", "preview", "localhost", "127.0.0.1"]),
    })
    .prefault({}),
  build: z
    .object({
      command,
      startCommand: command,
      distDir: z.string().min(1).default("dist"),
      startupTimeoutMs: z.number().int().positive().default(30000),
    })
    .prefault({}),
  crawl: z
    .object({
      mode: z.enum(["auto", "static", "http"]).default("auto"),
      entrypoints: z.array(z.string()).min(1).default(["/"]),
      maxPages: z.number().int().positive().max(10000).default(100),
      maxSitemaps: z.number().int().positive().max(1000).default(50),
      maxSitemapDepth: z.number().int().nonnegative().max(10).default(3),
      include: z.array(z.string()).default(["/"]),
      exclude: z
        .array(z.string())
        .default(["/admin", "/preview", "/api", "/404", "/404.html"]),
      requestTimeoutMs: z.number().int().positive().default(10000),
      userAgent: z.string().min(1).default(`search-quality-kit/${VERSION}`),
    })
    .prefault({}),
  profiles: z
    .object({
      default: z.enum(profileIds).default("generic"),
      routes: z
        .array(
          z.object({
            pattern: z.string().min(1).refine(validRoutePattern, {
              error:
                "Expected a root-relative glob using only * or **, for example /blog/**.",
            }),
            profile: z.enum(profileIds).optional(),
            expectedStructuredData: z
              .array(z.enum(structuredDataTypes))
              .default([]),
          }),
        )
        .default([]),
    })
    .prefault({}),
  plugins: z
    .array(z.custom<PluginDefinition>())
    .default([])
    .transform((plugins, context) => {
      try {
        return validatePluginCollection(plugins);
      } catch (error) {
        context.addIssue({
          code: "custom",
          message: error instanceof Error ? error.message : String(error),
        });
        return z.NEVER;
      }
    }),
  suppressions: z
    .array(
      z
        .object({
          code: stableFindingCode,
          urlPattern: z.string().min(1).refine(validRoutePattern, {
            error:
              "Expected a root-relative glob using only * or **, for example /legal/**.",
          }),
          reason: z.string().trim().min(1, "A reviewed reason is required."),
          owner: z.string().trim().min(1, "A suppression owner is required."),
          expires: isoDate.optional(),
        })
        .strict(),
    )
    .default([]),
  allowBroadSuppressions: z.boolean().default(false),
  checks: z
    .object({
      sitemap: z.boolean().default(true),
      robots: z.boolean().default(true),
      indexability: z.boolean().default(true),
      metadata: z.boolean().default(true),
      canonical: z.boolean().default(true),
      structuredData: z.boolean().default(true),
      openGraph: z.boolean().default(true),
      internalLinks: z.boolean().default(true),
      renderedHtml: z.boolean().default(true),
      accessibility: z.boolean().default(true),
      performanceHints: z.boolean().default(true),
    })
    .prefault({}),
  rules: z
    .object({
      title: z
        .object({
          minLength: z.number().int().nonnegative().default(10),
          maxLength: z.number().int().positive().default(70),
          allowDuplicates: z.boolean().default(false),
        })
        .prefault({}),
      description: z
        .object({
          minLength: z.number().int().nonnegative().default(50),
          maxLength: z.number().int().positive().default(170),
          allowMissing: z.boolean().default(false),
          allowDuplicates: z.boolean().default(false),
        })
        .prefault({}),
      canonical: z.object({ required: z.boolean().default(true) }).prefault({}),
      robots: z
        .object({ disallowAllInProduction: z.boolean().default(false) })
        .prefault({}),
      structuredData: z
        .object({
          validateJson: z.boolean().default(true),
          requireVisibleContentMatch: z.boolean().default(false),
        })
        .prefault({}),
      openGraph: z
        .object({ requireImage: z.boolean().default(false) })
        .prefault({}),
      renderedHtml: z
        .object({
          requireMain: z.boolean().default(true),
          requireH1: z.boolean().default(true),
          allowMultipleH1: z.boolean().default(false),
          minTextLength: z.number().int().nonnegative().default(80),
        })
        .prefault({}),
      performance: z
        .object({
          maxHtmlBytes: z.number().int().positive().default(500000),
          maxExternalScripts: z.number().int().nonnegative().default(10),
          largeImageBytes: z.number().int().positive().default(500000),
        })
        .prefault({}),
    })
    .prefault({}),
  output: z
    .object({
      format: z
        .enum(["console", "json", "markdown", "sarif"])
        .default("console"),
      jsonFile: z.string().min(1).default("search-quality-report.json"),
      markdownFile: z.string().min(1).default("search-quality-report.md"),
    })
    .prefault({}),
  ci: z
    .object({
      failOn: z.array(z.enum(["error", "warning", "info"])).default(["error"]),
      warnOnly: z.boolean().default(false),
    })
    .prefault({}),
});
export const configSchema = baseConfigSchema.superRefine((config, context) => {
  if (config.allowBroadSuppressions) return;
  config.suppressions.forEach((suppression, index) => {
    if (!broadSuppressionPatterns.has(suppression.urlPattern)) return;
    context.addIssue({
      code: "custom",
      path: ["suppressions", index, "urlPattern"],
      message:
        "Broad suppressions require allowBroadSuppressions: true. Prefer a narrow route pattern.",
    });
  });
});
export type SearchQualityConfig = z.infer<typeof configSchema>;
export type SearchQualityConfigInput = z.input<typeof configSchema>;
