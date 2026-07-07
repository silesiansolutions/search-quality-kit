import type { SearchQualityConfigInput } from "./config/schema.js";
export const defineConfig = (config: SearchQualityConfigInput) => config;
export { loadConfig } from "./config/loadConfig.js";
export { configSchema } from "./config/schema.js";
export type {
  SearchQualityConfig,
  SearchQualityConfigInput,
} from "./config/schema.js";
export { runVerification, shouldFail } from "./engine/verify.js";
export { findingFingerprint, newFindings } from "./report/baseline.js";
export { checkCatalog } from "./checks/index.js";
export type { CheckBasis } from "./checks/index.js";
export type { VerifyOptions } from "./engine/verify.js";
export type { Finding, SearchQualityReport, Severity } from "./report/types.js";
