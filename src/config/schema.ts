import { z } from "zod";
import { VERSION } from "../version.js";
const command = z.string().min(1).optional();
export const configSchema = z.object({
  site: z
    .object({
      baseUrl: z.url().optional(),
      localUrl: z.url().optional(),
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
      format: z.enum(["console", "json", "markdown"]).default("console"),
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
export type SearchQualityConfig = z.infer<typeof configSchema>;
export type SearchQualityConfigInput = z.input<typeof configSchema>;
