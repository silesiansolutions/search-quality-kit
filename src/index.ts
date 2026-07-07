import type { SearchQualityConfigInput } from "./config/schema.js";
export const defineConfig = (config: SearchQualityConfigInput) => config;
export { loadConfig } from "./config/loadConfig.js";
export { configSchema } from "./config/schema.js";
export type {
  SearchQualityConfig,
  SearchQualityConfigInput,
} from "./config/schema.js";
export { runVerification, shouldFail } from "./engine/verify.js";
export type { VerifyOptions } from "./engine/verify.js";
export type { Finding, SearchQualityReport, Severity } from "./report/types.js";
