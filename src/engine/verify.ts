import { access } from "node:fs/promises";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import { checks } from "../checks/index.js";
import { loadConfig } from "../config/loadConfig.js";
import type { SearchQualityConfig } from "../config/schema.js";
import { crawlHttp, crawlStatic } from "../crawler/crawlSite.js";
import type {
  Finding,
  SearchQualityReport,
  Severity,
} from "../report/types.js";
import { runCommand, startCommand, waitForUrl } from "../utils/process.js";
import { VERSION } from "../version.js";
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
    if (config.build.command && !options.skipBuild)
      await runCommand(config.build.command, root);
    if (config.build.startCommand) {
      if (!config.site.localUrl)
        throw new Error("build.startCommand requires site.localUrl");
      preview = startCommand(config.build.startCommand, root);
      await waitForUrl(config.site.localUrl, config, preview);
    }
    const dist = path.resolve(root, config.build.distDir),
      crawl = config.site.localUrl
        ? await crawlHttp(config.site.localUrl, config)
        : (await exists(dist))
          ? await crawlStatic(root, config)
          : config.site.baseUrl
            ? await crawlHttp(config.site.baseUrl, config)
            : (() => {
                throw new Error(
                  "No verification target. Configure a URL or build directory.",
                );
              })();
    const findings: Finding[] = [];
    for (const check of checks)
      if (config.checks[check.name])
        findings.push(...(await check.run({ config, crawl })));
    const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
    findings.sort(
      (a, b) =>
        order[a.severity] - order[b.severity] ||
        a.check.localeCompare(b.check) ||
        (a.url ?? "").localeCompare(b.url ?? ""),
    );
    const report: SearchQualityReport = {
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
      },
      findings,
      pages: crawl.pages.map(({ url, initialUrl, finalUrl, status, file }) => ({
        url,
        initialUrl,
        finalUrl,
        status,
        ...(file ? { file } : {}),
      })),
      durationMs: Date.now() - start,
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
  findings.some((f) => c.ci.failOn.includes(f.severity));
