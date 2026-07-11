import type { SearchQualityConfigInput } from "./config/schema.js";
import type { PortfolioConfigInput } from "./portfolio/config.js";
export const defineConfig = (config: SearchQualityConfigInput) => config;
export const definePortfolioConfig = (config: PortfolioConfigInput) => config;
export { loadConfig } from "./config/loadConfig.js";
export { configSchema } from "./config/schema.js";
export { presets } from "./config/presets.js";
export { profiles } from "./config/profiles.js";
export { defineCheck, definePlugin } from "./plugins/definePlugin.js";
export {
  aiVisibilitySafePolicyPack,
  companySitePolicyPack,
  directoryPolicyPack,
  personalBrandPolicyPack,
  policyPacks,
} from "./policyPacks/index.js";
export type {
  AiVisibilitySafePolicyPackOptions,
  CompanySitePolicyPackOptions,
  DirectoryPolicyPackOptions,
  PersonalBrandPolicyPackOptions,
} from "./policyPacks/index.js";
export {
  profileCatalog,
  profileIds,
  structuredDataTypes,
} from "./config/profileDefinitions.js";
export type { PresetName } from "./config/presets.js";
export type {
  SearchQualityConfig,
  SearchQualityConfigInput,
} from "./config/schema.js";
export type {
  SiteProfileId,
  StructuredDataType,
} from "./config/profileDefinitions.js";
export { runVerification, shouldFail } from "./engine/verify.js";
export {
  compareBaseline,
  findingFingerprint,
  newFindings,
  parseBaselineReport,
  parseSearchQualityReport,
  withoutFindings,
  withBaselineComparison,
} from "./report/baseline.js";
export { checkCatalog } from "./checks/index.js";
export type { CheckBasis } from "./checks/index.js";
export type { VerifyOptions } from "./engine/verify.js";
export type {
  Finding,
  FindingClassification,
  FindingSuppression,
  SearchQualityReport,
  Severity,
} from "./report/types.js";
export {
  applyReviewedSuppressions,
  findingStableCode,
  isSuppressionExpired,
  unsuppressedFindings,
} from "./suppressions.js";
export type {
  PluginCheckClassification,
  PluginCheckContext,
  PluginCheckDefinition,
  PluginConfig,
  PluginDefinition,
  PluginError,
  PluginFinding,
  PluginPage,
  PluginPageLink,
  PluginPageMetadata,
  PluginPolicyPackMetadata,
} from "./plugins/types.js";
export { REPORT_SCHEMA_VERSION } from "./report/types.js";
export {
  formatPortfolioHandoffReport,
  formatSiteHandoffReport,
  loadPortfolioSiteReports,
} from "./report/formatHandoffReport.js";
export type {
  HandoffFormatOptions,
  LoadedPortfolioSiteReports,
  PortfolioReportLoadError,
} from "./report/formatHandoffReport.js";
export {
  CONTRACT_SCHEMA_VERSION,
  createPortfolioContract,
  createSiteContract,
  createSiteContractFromConfig,
  formatContractJson,
  formatContractMarkdown,
} from "./contract.js";
export type {
  ContractPlugin,
  ContractPluginCheck,
  SearchQualityContract,
  SearchQualityPortfolioContract,
  SearchQualitySiteContract,
  SiteContractBody,
} from "./contract.js";
export {
  findPortfolioConfig,
  loadPortfolioConfig,
  portfolioConfigSchema,
  safeSiteName,
} from "./portfolio/config.js";
export { runPortfolio } from "./portfolio/runner.js";
export {
  formatPortfolioJsonReport,
  formatPortfolioMarkdownReport,
  parsePortfolioReport,
  portfolioReportSchema,
} from "./portfolio/report.js";
export { PORTFOLIO_REPORT_SCHEMA_VERSION } from "./portfolio/types.js";
export type {
  PortfolioConfig,
  PortfolioConfigInput,
} from "./portfolio/config.js";
export type {
  RunPortfolioOptions,
  RunPortfolioResult,
} from "./portfolio/runner.js";
export type {
  PortfolioFindingHighlight,
  PortfolioReport,
  PortfolioSiteReport,
  PortfolioSiteStatus,
} from "./portfolio/types.js";
