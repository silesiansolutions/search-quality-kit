import type { SearchQualityConfigInput } from "./config/schema.js";
import { configSchema } from "./config/schema.js";
import type { PageArtifact, CrawlResult } from "./crawler/types.js";
import { createPluginContext } from "./plugins/context.js";
import { definePlugin } from "./plugins/definePlugin.js";
import { runPluginsInContext } from "./plugins/runPlugins.js";
import type {
  PluginCheckContext,
  PluginCheckDefinition,
  PluginDefinition,
  PluginError,
  PluginFinding,
  PluginPageLink,
  PluginPageMetadata,
} from "./plugins/types.js";
import type { Finding } from "./report/types.js";

export interface PluginTestPageInput {
  readonly html: string;
  readonly url?: string;
  readonly initialUrl?: string;
  readonly finalUrl?: string;
  readonly statusCode?: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly file?: string;
  readonly visibleText?: string;
  readonly metadata?: Partial<PluginPageMetadata>;
  readonly links?: readonly PluginPageLink[];
  readonly structuredData?: readonly unknown[];
}

export interface PluginTestContextInput {
  readonly pages: readonly PluginTestPageInput[];
  readonly baseUrl?: string;
  readonly config?: SearchQualityConfigInput;
}

export interface PluginTestRunResult {
  readonly findings: readonly Finding[];
  readonly errors: readonly PluginError[];
}

export interface RunCheckForTestOptions {
  readonly pluginName?: string;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function originFromUrl(value: string) {
  return new URL(value).origin;
}

function pageUrl(input: PluginTestPageInput, index: number) {
  return (
    input.url ??
    input.finalUrl ??
    input.initialUrl ??
    `https://example.com/${index === 0 ? "" : `page-${index}`}`
  );
}

function pageArtifact(input: PluginTestPageInput, index: number): PageArtifact {
  const finalUrl = input.finalUrl ?? pageUrl(input, index),
    initialUrl = input.initialUrl ?? input.url ?? finalUrl;
  return {
    initialUrl,
    finalUrl,
    url: finalUrl,
    requestUrl: input.file ? `file://${input.file}` : finalUrl,
    status: input.statusCode ?? 200,
    html: input.html,
    headers: { ...(input.headers ?? {}) },
    ...(input.file ? { file: input.file } : {}),
    bytes: Buffer.byteLength(input.html),
  };
}

function pluginNameForCheck(check: PluginCheckDefinition) {
  const namespace = check.id.split(".")[0];
  return namespace && namespace !== "custom" ? namespace : "test-plugin";
}

function testCrawl(
  pages: readonly PluginTestPageInput[],
  publicBaseUrl: string,
): CrawlResult {
  const sitemap = {
    url: `${publicBaseUrl}/sitemap.xml`,
    status: 200,
    content: "<urlset></urlset>",
  };
  return {
    mode: "static",
    target: "plugin-test",
    publicBaseUrl,
    pages: pages.map(pageArtifact),
    robots: {
      url: `${publicBaseUrl}/robots.txt`,
      status: 200,
      content: `User-agent: *\nAllow: /\nSitemap: ${publicBaseUrl}/sitemap.xml`,
    },
    llmsTxt: { url: `${publicBaseUrl}/llms.txt`, status: 404 },
    sitemap,
    sitemaps: [sitemap],
    sitemapUrls: [],
    sitemapTruncated: false,
    assets: new Map(),
  };
}

export function createPluginTestContext(
  input: PluginTestContextInput,
): PluginCheckContext {
  const firstUrl = input.pages[0] ? pageUrl(input.pages[0], 0) : undefined,
    configuredBaseUrl = input.config?.site?.baseUrl,
    baseUrl =
      input.baseUrl ??
      configuredBaseUrl ??
      originFromUrl(firstUrl ?? "https://example.com/");
  const config = configSchema.parse({
      ...input.config,
      site: {
        ...input.config?.site,
        baseUrl,
      },
    }),
    context = createPluginContext(config, testCrawl(input.pages, baseUrl));
  const pages = context.pages.map((page, index) => {
    const override = input.pages[index]!;
    return deepFreeze({
      ...page,
      ...(override.visibleText !== undefined
        ? { visibleText: override.visibleText }
        : {}),
      ...(override.metadata
        ? {
            metadata: {
              ...page.metadata,
              ...override.metadata,
              openGraph: {
                ...page.metadata.openGraph,
                ...(override.metadata.openGraph ?? {}),
              },
            },
          }
        : {}),
      ...(override.links ? { links: [...override.links] } : {}),
      ...(override.structuredData
        ? { structuredData: [...override.structuredData] }
        : {}),
    });
  });
  return deepFreeze({ ...context, pages });
}

export async function runPluginForTest(
  plugin: PluginDefinition,
  context: PluginCheckContext,
): Promise<PluginTestRunResult> {
  return runPluginsInContext([plugin], context);
}

export async function runCheckForTest(
  check: PluginCheckDefinition,
  context: PluginCheckContext,
  options: RunCheckForTestOptions = {},
): Promise<PluginTestRunResult> {
  const plugin = definePlugin({
    name: options.pluginName ?? pluginNameForCheck(check),
    checks: [check],
  });
  return runPluginsInContext([plugin], context);
}

export type { PluginFinding };
