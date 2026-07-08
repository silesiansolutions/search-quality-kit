import type { SearchQualityConfigInput } from "./config/schema.js";
export const defineConfig = (config: SearchQualityConfigInput) => config;
export { loadConfig } from "./config/loadConfig.js";
export { configSchema } from "./config/schema.js";
export { presets } from "./config/presets.js";
export { profiles } from "./config/profiles.js";
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
  SearchQualityReport,
  Severity,
} from "./report/types.js";
export { REPORT_SCHEMA_VERSION } from "./report/types.js";
