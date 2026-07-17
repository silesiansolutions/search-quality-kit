import path from "node:path";
import { loadConfig } from "./config/loadConfig.js";
import type { SearchQualityConfig } from "./config/schema.js";
import { loadPortfolioConfig } from "./portfolio/config.js";
import type {
  FindingClassification,
  FindingSuppression,
  Severity,
} from "./report/types.js";

export const CONTRACT_SCHEMA_VERSION = "0.10" as const;

export interface ContractPluginCheck {
  id: string;
  title: string;
  category: string;
  classification: FindingClassification;
  defaultSeverity: Severity;
  docsUrl?: string;
}

export interface ContractPlugin {
  name: string;
  source: "plugin" | "policy-pack";
  checks: ContractPluginCheck[];
}

export interface SiteContractBody {
  site: { baseUrl: string };
  crawl: {
    mode: "auto" | "static" | "http";
    entrypoints: string[];
    include: string[];
    exclude: string[];
    maxPages: number;
    maxSitemaps: number;
    maxSitemapDepth: number;
    requestTimeoutMs: number;
  };
  profiles: SearchQualityConfig["profiles"];
  checks: { enabled: string[]; disabled: string[] };
  rules: SearchQualityConfig["rules"];
  plugins: ContractPlugin[];
  policyPacks: Array<{
    name: string;
    optionsSummary: Readonly<Record<string, unknown>>;
  }>;
  suppressions: FindingSuppression[];
  allowBroadSuppressions: boolean;
  ci: { failOn: Severity[]; warnOnly: boolean };
}

export interface SearchQualitySiteContract extends SiteContractBody {
  schemaVersion: typeof CONTRACT_SCHEMA_VERSION;
  type: "site";
}

export interface SearchQualityPortfolioContract {
  schemaVersion: typeof CONTRACT_SCHEMA_VERSION;
  type: "portfolio";
  outputDir: string;
  portfolio: {
    failOn: Severity[];
    failOnNew: boolean;
    continueOnSiteFailure: boolean;
    reportOnly: boolean;
  };
  sites: Array<{
    name: string;
    enabled: boolean;
    root: string;
    config: string;
    baseline?: string;
    outputDir: string;
    summary: SiteContractBody;
  }>;
}

export type SearchQualityContract =
  SearchQualitySiteContract | SearchQualityPortfolioContract;

const clone = <T>(value: T): T => structuredClone(value);

export function createSiteContractFromConfig(
  config: SearchQualityConfig,
): SearchQualitySiteContract {
  const checks = Object.entries(config.checks);
  const plugins: ContractPlugin[] = config.plugins.map((plugin) => ({
    name: plugin.name,
    source: plugin.policyPack ? "policy-pack" : "plugin",
    checks: plugin.checks.map((check) => ({
      id: check.id,
      title: check.title,
      category: check.category,
      classification: check.classification,
      defaultSeverity: check.defaultSeverity,
      ...(check.docsUrl ? { docsUrl: check.docsUrl } : {}),
    })),
  }));
  return {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    type: "site",
    site: { baseUrl: config.site.baseUrl! },
    crawl: {
      mode: config.crawl.mode,
      entrypoints: [...config.crawl.entrypoints],
      include: [...config.crawl.include],
      exclude: [...config.crawl.exclude],
      maxPages: config.crawl.maxPages,
      maxSitemaps: config.crawl.maxSitemaps,
      maxSitemapDepth: config.crawl.maxSitemapDepth,
      requestTimeoutMs: config.crawl.requestTimeoutMs,
    },
    profiles: clone(config.profiles),
    checks: {
      enabled: checks.filter(([, enabled]) => enabled).map(([name]) => name),
      disabled: checks.filter(([, enabled]) => !enabled).map(([name]) => name),
    },
    rules: clone(config.rules),
    plugins,
    policyPacks: config.plugins.flatMap((plugin) =>
      plugin.policyPack
        ? [
            {
              name: plugin.policyPack.name,
              optionsSummary: clone(plugin.policyPack.optionsSummary),
            },
          ]
        : [],
    ),
    suppressions: config.suppressions.map((suppression) => ({
      ...suppression,
    })),
    allowBroadSuppressions: config.allowBroadSuppressions,
    ci: { failOn: [...config.ci.failOn], warnOnly: config.ci.warnOnly },
  };
}

export async function createSiteContract(
  root = process.cwd(),
  configPath?: string,
) {
  const { config } = await loadConfig(root, configPath);
  return createSiteContractFromConfig(config);
}

function siteContractBody(
  contract: SearchQualitySiteContract,
): SiteContractBody {
  return Object.fromEntries(
    Object.entries(contract).filter(
      ([key]) => key !== "schemaVersion" && key !== "type",
    ),
  ) as unknown as SiteContractBody;
}

export async function createPortfolioContract(
  root = process.cwd(),
  configPath?: string,
): Promise<SearchQualityPortfolioContract> {
  const loaded = await loadPortfolioConfig(root, configPath);
  const manifestDirectory = path.dirname(loaded.path);
  const sites = await Promise.all(
    loaded.config.sites.map(async (site) => {
      const siteRoot = path.resolve(manifestDirectory, site.root);
      const contract = await createSiteContract(siteRoot, site.config);
      return {
        name: site.name,
        enabled: site.enabled,
        root: site.root,
        config: site.config,
        ...(site.baseline ? { baseline: site.baseline } : {}),
        outputDir:
          site.outputDir ?? path.posix.join(loaded.config.outputDir, site.name),
        summary: siteContractBody(contract),
      };
    }),
  );
  return {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    type: "portfolio",
    outputDir: loaded.config.outputDir,
    portfolio: {
      failOn: [...loaded.config.portfolio.failOn],
      failOnNew: loaded.config.portfolio.failOnNew,
      continueOnSiteFailure: loaded.config.portfolio.continueOnSiteFailure,
      reportOnly: loaded.config.portfolio.reportOnly,
    },
    sites,
  };
}

export const formatContractJson = (contract: SearchQualityContract) =>
  JSON.stringify(contract, null, 2);

const code = (value: string) => `\`${value.replaceAll("`", "\\`")}\``;
const list = (values: string[]) => values.map(code).join(", ") || "none";

function siteMarkdown(body: SiteContractBody, headingLevel = 2) {
  const heading = "#".repeat(headingLevel);
  const routeProfiles = body.profiles.routes.length
    ? body.profiles.routes.map(
        (route) =>
          `- ${code(route.pattern)} → ${code(route.profile ?? body.profiles.default)}`,
      )
    : ["- No route-specific profile overrides."];
  const plugins = body.plugins.length
    ? body.plugins.map(
        (plugin) =>
          `- ${code(plugin.name)} (${plugin.source}): ${list(plugin.checks.map((check) => check.id))}`,
      )
    : ["- No plugins."];
  const suppressions = body.suppressions.length
    ? body.suppressions.map(
        (suppression) =>
          `- ${code(suppression.code)} on ${code(suppression.urlPattern)} — owner ${code(suppression.owner)}${suppression.expires ? `, expires ${code(suppression.expires)}` : ""}: ${suppression.reason}`,
      )
    : ["- No reviewed suppressions."];
  return [
    `${heading} Site`,
    "",
    `- Base URL: ${code(body.site.baseUrl)}`,
    `- Crawl mode: ${code(body.crawl.mode)}`,
    `- Entrypoints: ${list(body.crawl.entrypoints)}`,
    `- Include: ${list(body.crawl.include)}`,
    `- Exclude: ${list(body.crawl.exclude)}`,
    `- Max pages: ${body.crawl.maxPages}`,
    "",
    `${heading} Profiles`,
    "",
    `- Default: ${code(body.profiles.default)}`,
    ...routeProfiles,
    "",
    `${heading} Checks`,
    "",
    `- Enabled: ${list(body.checks.enabled)}`,
    `- Disabled: ${list(body.checks.disabled)}`,
    "",
    `${heading} Plugins`,
    "",
    ...plugins,
    "",
    `${heading} Policy packs`,
    "",
    ...(body.policyPacks.length
      ? body.policyPacks.map(
          (pack) =>
            `- ${code(pack.name)}: ${code(JSON.stringify(pack.optionsSummary))}`,
        )
      : ["- No policy packs."]),
    "",
    `${heading} Reviewed suppressions`,
    "",
    ...suppressions,
    "",
    `${heading} Gate`,
    "",
    `- Fail on: ${list(body.ci.failOn)}`,
    `- Warn only: ${body.ci.warnOnly}`,
    "",
    `${heading} Rules`,
    "",
    "```json",
    JSON.stringify(body.rules, null, 2),
    "```",
    "",
  ];
}

export function formatContractMarkdown(contract: SearchQualityContract) {
  if (contract.type === "site")
    return [
      "# Search Quality Contract",
      "",
      `- Schema version: ${code(contract.schemaVersion)}`,
      `- Type: ${code(contract.type)}`,
      "",
      ...siteMarkdown(contract),
    ].join("\n");
  const rows = contract.sites.map(
    (site) =>
      `| ${site.name.replaceAll("|", "\\|")} | ${site.enabled ? "enabled" : "disabled"} | ${code(site.config)} | ${site.baseline ? code(site.baseline) : "—"} | ${code(site.outputDir)} |`,
  );
  const details = contract.sites.flatMap((site) => [
    `## ${site.name}`,
    "",
    `- Root: ${code(site.root)}`,
    `- Config: ${code(site.config)}`,
    ...(site.baseline ? [`- Baseline: ${code(site.baseline)}`] : []),
    `- Output: ${code(site.outputDir)}`,
    "",
    ...siteMarkdown(site.summary, 3),
  ]);
  return [
    "# Search Quality Portfolio Contract",
    "",
    `- Schema version: ${code(contract.schemaVersion)}`,
    `- Output directory: ${code(contract.outputDir)}`,
    `- Fail on: ${list(contract.portfolio.failOn)}`,
    `- Fail on new: ${contract.portfolio.failOnNew}`,
    `- Report only: ${contract.portfolio.reportOnly}`,
    "",
    "## Sites",
    "",
    "| Site | Status | Config | Baseline | Output |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    ...details,
  ].join("\n");
}
