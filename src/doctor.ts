import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";
import packageJson from "../package.json" with { type: "json" };
import { findConfig, loadConfig } from "./config/loadConfig.js";
import type { SearchQualityConfig } from "./config/schema.js";
import {
  findPortfolioConfig,
  loadPortfolioConfig,
  safeSiteName,
  type PortfolioConfig,
} from "./portfolio/config.js";

export type DoctorMode = "site" | "portfolio";
export type DoctorIssueLevel = "ok" | "info" | "warning" | "error";

export interface DoctorIssue {
  readonly level: DoctorIssueLevel;
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export interface DoctorReport {
  readonly tool: "search-quality-kit";
  readonly mode: DoctorMode;
  readonly status: "ok" | "warning" | "error";
  readonly root: string;
  readonly configPath?: string;
  readonly summary: {
    readonly ok: number;
    readonly info: number;
    readonly warnings: number;
    readonly errors: number;
  };
  readonly issues: readonly DoctorIssue[];
}

export interface DoctorOptions {
  readonly root?: string;
  readonly configPath?: string;
  readonly portfolioConfigPath?: string;
  readonly baselinePath?: string;
}

const pathDisplay = (root: string, file: string) =>
  path.isAbsolute(file) ? path.relative(root, file) || "." : file;

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(file: string) {
  try {
    return (await stat(file)).isDirectory();
  } catch {
    return false;
  }
}

function inside(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function compareVersions(actual: string, minimum: string) {
  const parse = (value: string) =>
    value
      .split(".")
      .slice(0, 3)
      .map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(actual),
    right = parse(minimum);
  for (let index = 0; index < 3; index += 1) {
    const a = left[index] ?? 0,
      b = right[index] ?? 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

function minVersion(range: string) {
  return range.match(/>=\s*(\d+(?:\.\d+){0,2})/)?.[1];
}

async function packageNodeRange(root: string) {
  try {
    const parsed = JSON.parse(
      await readFile(path.join(root, "package.json"), "utf8"),
    ) as { engines?: { node?: unknown } };
    return typeof parsed.engines?.node === "string"
      ? parsed.engines.node
      : undefined;
  } catch {
    return undefined;
  }
}

function nodeIssue(range: string, code: string): DoctorIssue {
  const minimum = minVersion(range);
  if (!minimum)
    return {
      level: "info",
      code,
      message: `Node ${process.versions.node} is running; could not interpret engines.node '${range}'.`,
    };
  if (compareVersions(process.versions.node, minimum) < 0)
    return {
      level: "error",
      code,
      message: `Node ${process.versions.node} does not satisfy engines.node '${range}'.`,
    };
  return {
    level: "ok",
    code,
    message: `Node ${process.versions.node} satisfies engines.node '${range}'.`,
  };
}

function outputFileIssues(
  root: string,
  config: SearchQualityConfig,
): DoctorIssue[] {
  const files: Array<readonly [string, string]> = [
    ["output-json-file", config.output.jsonFile],
    ["output-markdown-file", config.output.markdownFile],
  ];
  return files.map(([code, configured]) => {
    const resolved = path.resolve(root, configured);
    if (!inside(root, resolved))
      return {
        level: "error",
        code,
        message: `Configured output file escapes the project root: ${configured}.`,
        path: configured,
      } satisfies DoctorIssue;
    return {
      level: "ok",
      code,
      message: `Configured output file stays inside the project root: ${configured}.`,
      path: configured,
    } satisfies DoctorIssue;
  });
}

function pluginRegistrationIssues(config: SearchQualityConfig): DoctorIssue[] {
  const ids = new Set<string>();
  for (const plugin of config.plugins)
    for (const check of plugin.checks) {
      if (ids.has(check.id))
        return [
          {
            level: "error",
            code: "duplicate-plugin-check-id",
            message: `Duplicate plugin check id '${check.id}'.`,
          },
        ];
      ids.add(check.id);
    }
  return [
    {
      level: "ok",
      code: "plugins-registered",
      message: `${config.plugins.length} plugin${config.plugins.length === 1 ? "" : "s"} registered successfully.`,
    },
  ];
}

async function siteDoctor(options: DoctorOptions): Promise<DoctorReport> {
  const root = path.resolve(options.root ?? process.cwd()),
    issues: DoctorIssue[] = [];
  let configPath: string | undefined, config: SearchQualityConfig | undefined;

  try {
    configPath = await findConfig(root, options.configPath);
  } catch (error) {
    issues.push({
      level: "error",
      code: "config-missing",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (!configPath)
    issues.push({
      level: "error",
      code: "config-missing",
      message: `Config file not found in ${root}. Pass --config search-quality.config.ts.`,
    });
  else {
    issues.push({
      level: "ok",
      code: "config-found",
      message: `Config file found: ${pathDisplay(root, configPath)}.`,
      path: pathDisplay(root, configPath),
    });
    try {
      const loaded = await loadConfig(root, options.configPath);
      config = loaded.config;
      issues.push({
        level: "ok",
        code: "config-loads",
        message: "Config loaded and passed schema validation.",
      });
    } catch (error) {
      issues.push({
        level: "error",
        code: "config-loads",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (config) {
    issues.push({
      level: "ok",
      code: "site-base-url",
      message: `site.baseUrl is ${config.site.baseUrl}.`,
    });
    if (config.crawl.mode === "static") {
      const dist = path.resolve(root, config.build.distDir);
      issues.push(
        (await isDirectory(dist))
          ? {
              level: "ok",
              code: "build-dist-dir",
              message: `Static build directory exists: ${pathDisplay(root, dist)}.`,
              path: pathDisplay(root, dist),
            }
          : {
              level: "error",
              code: "build-dist-dir",
              message: `crawl.mode=static requires an existing build.distDir: ${pathDisplay(root, dist)}.`,
              path: pathDisplay(root, dist),
            },
      );
    }
    if (config.build.command && process.env.SQK_BUILD_COMMAND)
      issues.push({
        level: "warning",
        code: "duplicate-build-command",
        message:
          "Both config.build.command and SQK_BUILD_COMMAND are set. In the official Action, build-command should normally own the build and the CLI should receive --skip-build.",
      });
    if (options.baselinePath) {
      const baseline = path.resolve(root, options.baselinePath);
      issues.push(
        (await exists(baseline))
          ? {
              level: "ok",
              code: "baseline-exists",
              message: `Baseline exists: ${pathDisplay(root, baseline)}.`,
              path: pathDisplay(root, baseline),
            }
          : {
              level: "error",
              code: "baseline-exists",
              message: `Baseline file does not exist: ${pathDisplay(root, baseline)}.`,
              path: pathDisplay(root, baseline),
            },
      );
    }
    issues.push(...pluginRegistrationIssues(config));
    issues.push(...outputFileIssues(root, config));
  }

  issues.push(nodeIssue(packageJson.engines.node, "package-node-engine"));
  const targetRange = await packageNodeRange(root);
  if (targetRange) issues.push(nodeIssue(targetRange, "project-node-engine"));

  return report("site", root, configPath, issues);
}

function portfolioOutputIssues(
  root: string,
  manifestDirectory: string,
  config: PortfolioConfig,
): DoctorIssue[] {
  const issues: DoctorIssue[] = [],
    outputRoot = path.resolve(root, config.outputDir),
    outputs = new Map<string, string>();
  for (const site of config.sites) {
    const output = site.outputDir
      ? path.resolve(root, site.outputDir)
      : path.join(outputRoot, site.name);
    if (!inside(outputRoot, output))
      issues.push({
        level: "error",
        code: "portfolio-output-dir",
        message: `Output directory for site '${site.name}' must stay inside ${pathDisplay(root, outputRoot)}.`,
        path: pathDisplay(root, output),
      });
    const duplicate = [...outputs.entries()].find(
      ([, previous]) => previous === output,
    );
    if (duplicate)
      issues.push({
        level: "error",
        code: "portfolio-output-dir-duplicate",
        message: `Sites '${duplicate[0]}' and '${site.name}' resolve to the same output directory.`,
        path: pathDisplay(root, output),
      });
    outputs.set(site.name, output);
    const siteRoot = path.resolve(manifestDirectory, site.root);
    if (!inside(root, siteRoot))
      issues.push({
        level: "error",
        code: "portfolio-site-root",
        message: `Site '${site.name}' root escapes the portfolio root.`,
        path: pathDisplay(root, siteRoot),
      });
  }
  if (!issues.length)
    issues.push({
      level: "ok",
      code: "portfolio-output-dirs",
      message:
        "Portfolio output directories are unique and stay inside the portfolio output root.",
    });
  return issues;
}

async function portfolioDoctor(options: DoctorOptions): Promise<DoctorReport> {
  const root = path.resolve(options.root ?? process.cwd()),
    issues: DoctorIssue[] = [];
  let configPath: string | undefined, config: PortfolioConfig | undefined;

  try {
    configPath = await findPortfolioConfig(root, options.portfolioConfigPath);
    issues.push({
      level: "ok",
      code: "portfolio-config-found",
      message: `Portfolio config found: ${pathDisplay(root, configPath)}.`,
      path: pathDisplay(root, configPath),
    });
  } catch (error) {
    issues.push({
      level: "error",
      code: "portfolio-config-missing",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (configPath)
    try {
      const loaded = await loadPortfolioConfig(
        root,
        options.portfolioConfigPath,
      );
      config = loaded.config;
      issues.push({
        level: "ok",
        code: "portfolio-config-loads",
        message: "Portfolio config loaded and passed schema validation.",
      });
    } catch (error) {
      issues.push({
        level: "error",
        code: "portfolio-config-loads",
        message: error instanceof Error ? error.message : String(error),
      });
    }

  if (config && configPath) {
    const manifestDirectory = path.dirname(configPath),
      names = new Set<string>();
    for (const site of config.sites) {
      if (names.has(site.name) || !safeSiteName.test(site.name))
        issues.push({
          level: "error",
          code: "portfolio-site-name",
          message: `Site name is not unique or path-safe: ${site.name}.`,
        });
      names.add(site.name);

      const siteRoot = path.resolve(manifestDirectory, site.root),
        siteConfig = path.resolve(siteRoot, site.config);
      issues.push(
        (await exists(siteConfig))
          ? {
              level: "ok",
              code: "portfolio-site-config",
              message: `Site '${site.name}' config exists.`,
              path: pathDisplay(root, siteConfig),
            }
          : {
              level: "error",
              code: "portfolio-site-config",
              message: `Site '${site.name}' config does not exist: ${pathDisplay(root, siteConfig)}.`,
              path: pathDisplay(root, siteConfig),
            },
      );

      if (site.baseline) {
        const baseline = path.resolve(siteRoot, site.baseline);
        issues.push(
          (await exists(baseline))
            ? {
                level: "ok",
                code: "portfolio-site-baseline",
                message: `Site '${site.name}' baseline exists.`,
                path: pathDisplay(root, baseline),
              }
            : {
                level: "error",
                code: "portfolio-site-baseline",
                message: `Site '${site.name}' baseline does not exist: ${pathDisplay(root, baseline)}.`,
                path: pathDisplay(root, baseline),
              },
        );
      }

      if (!site.enabled)
        issues.push({
          level: "info",
          code: "portfolio-site-disabled",
          message: `Site '${site.name}' is explicitly disabled.`,
        });
    }

    issues.push(...portfolioOutputIssues(root, manifestDirectory, config));
    if (!config.portfolio.failOn.length)
      issues.push({
        level: "warning",
        code: "portfolio-gate-empty",
        message:
          "portfolio.failOn is empty, so findings will not fail the portfolio gate.",
      });
    else
      issues.push({
        level: "ok",
        code: "portfolio-gate",
        message: `Portfolio gate fails on: ${config.portfolio.failOn.join(", ")}.`,
      });
    if (
      config.portfolio.failOnNew &&
      config.sites.filter((site) => site.enabled && site.baseline).length === 0
    )
      issues.push({
        level: "warning",
        code: "portfolio-fail-on-new-without-baselines",
        message:
          "portfolio.failOnNew is true but no enabled site has a baseline; first-run findings will be treated as new.",
      });
  }

  issues.push(nodeIssue(packageJson.engines.node, "package-node-engine"));
  const targetRange = await packageNodeRange(root);
  if (targetRange) issues.push(nodeIssue(targetRange, "project-node-engine"));

  return report("portfolio", root, configPath, issues);
}

function report(
  mode: DoctorMode,
  root: string,
  configPath: string | undefined,
  issues: DoctorIssue[],
): DoctorReport {
  const errors = issues.filter((issue) => issue.level === "error").length,
    warnings = issues.filter((issue) => issue.level === "warning").length,
    info = issues.filter((issue) => issue.level === "info").length,
    ok = issues.filter((issue) => issue.level === "ok").length;
  return {
    tool: "search-quality-kit",
    mode,
    status: errors ? "error" : warnings ? "warning" : "ok",
    root,
    ...(configPath ? { configPath } : {}),
    summary: { ok, info, warnings, errors },
    issues,
  };
}

function label(level: DoctorIssueLevel) {
  if (level === "error") return pc.red("ERROR");
  if (level === "warning") return pc.yellow("WARNING");
  if (level === "info") return pc.cyan("INFO");
  return pc.green("OK");
}

export function formatDoctorReport(report: DoctorReport) {
  return [
    pc.bold("Search Quality Doctor"),
    "",
    `Mode: ${report.mode}`,
    `Root: ${report.root}`,
    ...(report.configPath ? [`Config: ${report.configPath}`] : []),
    `Status: ${report.status}`,
    `OK: ${report.summary.ok}`,
    `Info: ${report.summary.info}`,
    `Warnings: ${report.summary.warnings}`,
    `Errors: ${report.summary.errors}`,
    "",
    ...report.issues.map((issue) =>
      [
        `${label(issue.level)} ${issue.message}`,
        issue.path ? `  Path: ${issue.path}` : undefined,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n");
}

export async function runDoctor(options: DoctorOptions = {}) {
  if (options.configPath && options.portfolioConfigPath)
    throw new Error("Use either --config or --portfolio-config, not both.");
  if (options.portfolioConfigPath) return portfolioDoctor(options);
  return siteDoctor(options);
}
