import { access } from "node:fs/promises";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import { checks } from "../checks/index.js";
import { loadConfig } from "../config/loadConfig.js";
import { resolveProfile } from "../config/resolveProfile.js";
import type { SearchQualityConfig } from "../config/schema.js";
import { crawlHttp, crawlStatic } from "../crawler/crawlSite.js";
import { runPluginChecks } from "../plugins/runPlugins.js";
import {
  REPORT_SCHEMA_VERSION,
  type Finding,
  type SearchQualityReport,
  type Severity,
} from "../report/types.js";
import { runCommand, startCommand, waitForUrl } from "../utils/process.js";
import { VERSION } from "../version.js";
import {
  applyReviewedSuppressions,
  unsuppressedFindings,
} from "../suppressions.js";
export interface VerifyOptions {
  root?: string;
  configPath?: string;
  skipBuild?: boolean;
}
async function exists(f: string) {
  try {
    await access(f);
    return true;
  } catch {
    return false;
  }
}
async function stop(c?: ChildProcess) {
  if (!c || c.exitCode !== null) return;
  c.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((r) => c.once("exit", () => r())),
    new Promise<void>((r) => setTimeout(r, 2000)),
  ]);
  if (c.exitCode === null) c.kill("SIGKILL");
}
export async function runVerification(
  options: VerifyOptions = {},
): Promise<{ report: SearchQualityReport; config: SearchQualityConfig }> {
  const start = Date.now(),
    root = path.resolve(options.root ?? process.cwd()),
    { config } = await loadConfig(root, options.configPath);
  let preview: ChildProcess | undefined;
  try {
    if (config.build.command && !options.skipBuild) {
      try {
        await runCommand(config.build.command, root);
      } catch (error) {
        throw new Error(
          `build.command failed: ${(error as Error).message}. Run it manually to inspect the build, or fix build.command in the config.`,
        );
      }
    }
    if (config.build.startCommand) {
      if (!config.site.localUrl)
        throw new Error("build.startCommand requires site.localUrl");
      preview = startCommand(config.build.startCommand, root);
      await waitForUrl(config.site.localUrl, config, preview);
    }
    const dist = path.resolve(root, config.build.distDir);
    const baseUrl = config.site.baseUrl;
    if (!baseUrl)
      throw new Error(
        "site.baseUrl is missing. Set it to the production origin in the config.",
      );
    let crawl;
    if (config.crawl.mode === "static") {
      if (!(await exists(dist)))
        throw new Error(
          `build.distDir does not exist: ${dist}. Build the site first or set build.distDir to the generated static output.`,
        );
      crawl = await crawlStatic(root, config);
    } else if (config.crawl.mode === "http") {
      crawl = await crawlHttp(config.site.localUrl ?? baseUrl, config);
    } else {
      crawl = config.site.localUrl
        ? await crawlHttp(config.site.localUrl, config)
        : (await exists(dist))
          ? await crawlStatic(root, config)
          : await crawlHttp(baseUrl, config);
    }
    const findings: Finding[] = [];
    for (const check of checks)
      if (config.checks[check.name])
        findings.push(
          ...(await check.run({ config, crawl })).map((item) => ({
            ...item,
            source: { type: "core" as const, name: check.name },
          })),
        );
    const pluginResult = await runPluginChecks(config, crawl);
    findings.push(...pluginResult.findings);
    for (let index = 0; index < findings.length; index += 1) {
      const item = findings[index]!;
      if (!item.url) continue;
      const resolved = resolveProfile(item.url, config);
      findings[index] = {
        ...item,
        activeProfile: item.activeProfile ?? resolved.activeProfile,
      };
    }
    const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
    findings.sort(
      (a, b) =>
        order[a.severity] - order[b.severity] ||
        a.check.localeCompare(b.check) ||
        a.code.localeCompare(b.code) ||
        (a.url ?? "").localeCompare(b.url ?? "") ||
        (a.file ?? "").localeCompare(b.file ?? "") ||
        a.message.localeCompare(b.message),
    );
    const reviewedFindings = applyReviewedSuppressions(findings, config);
    const report: SearchQualityReport = {
      schemaVersion: REPORT_SCHEMA_VERSION,
      tool: "search-quality-kit",
      version: VERSION,
      generatedAt: new Date().toISOString(),
      mode: crawl.mode,
      target: crawl.target,
      summary: {
        checkedPages: crawl.pages.length,
        errors: findings.filter((f) => f.severity === "error").length,
        warnings: findings.filter((f) => f.severity === "warning").length,
        info: findings.filter((f) => f.severity === "info").length,
        suppressedFindings: reviewedFindings.filter((f) => f.suppressed).length,
      },
      findings: reviewedFindings,
      pages: crawl.pages.map(({ url, initialUrl, finalUrl, status, file }) => {
        const resolved = resolveProfile(url, config);
        return {
          url,
          initialUrl,
          finalUrl,
          status,
          ...(file ? { file } : {}),
          activeProfile: resolved.activeProfile,
          ...(resolved.expectedStructuredData.length
            ? { expectedStructuredData: resolved.expectedStructuredData }
            : {}),
          ...(resolved.matchedPattern
            ? { matchedProfilePattern: resolved.matchedPattern }
            : {}),
        };
      }),
      durationMs: Date.now() - start,
      ...(pluginResult.errors.length
        ? { pluginErrors: pluginResult.errors }
        : {}),
    };
    return { report, config };
  } finally {
    await stop(preview);
  }
}
export const shouldFail = (
  r: SearchQualityReport,
  c: SearchQualityConfig,
  reportOnly = false,
  findings: Finding[] = r.findings,
) =>
  !reportOnly &&
  !c.ci.warnOnly &&
  unsuppressedFindings(findings).some((f) => c.ci.failOn.includes(f.severity));
