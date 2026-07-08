import type { SearchQualityConfig } from "../config/schema.js";
import type { CrawlResult } from "../crawler/types.js";
import type { Finding } from "../report/types.js";
import { createPluginContext } from "./context.js";
import { validatePluginFinding } from "./definePlugin.js";
import type {
  PluginCheckContext,
  PluginDefinition,
  PluginError,
} from "./types.js";

export async function runPluginsInContext(
  plugins: readonly PluginDefinition[],
  context: PluginCheckContext,
): Promise<{ findings: Finding[]; errors: PluginError[] }> {
  const findings: Finding[] = [],
    errors: PluginError[] = [];
  for (const plugin of plugins)
    for (const check of plugin.checks) {
      try {
        const result = await check.run(context);
        if (!Array.isArray(result))
          throw new Error("run must return an array of findings.");
        const validated = result.map((item, index) =>
          validatePluginFinding(item, plugin, check, index),
        );
        for (const item of validated) {
          const severity = item.severity ?? check.defaultSeverity,
            classification = [check.classification];
          findings.push({
            severity,
            check: check.id,
            code: item.code,
            message: item.message,
            suggestion: item.remediation,
            ...(item.url ? { url: item.url } : {}),
            ...(item.file ? { file: item.file } : {}),
            docs:
              check.docsUrl ??
              "https://github.com/SilesianSolutions/search-quality-kit/blob/master/docs/plugins.md",
            ...(item.relatedUrls ? { relatedUrls: [...item.relatedUrls] } : {}),
            classification,
            impact:
              check.classification === "profile-expectation"
                ? "profile-expectation"
                : severity === "error"
                  ? "technical-error"
                  : "recommendation",
            source: { type: "plugin", name: plugin.name },
          });
        }
      } catch (error) {
        errors.push({
          plugin: plugin.name,
          check: check.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  return { findings, errors };
}

export async function runPluginChecks(
  config: SearchQualityConfig,
  crawl: CrawlResult,
): Promise<{ findings: Finding[]; errors: PluginError[] }> {
  return runPluginsInContext(
    config.plugins,
    createPluginContext(config, crawl),
  );
}
