import { configSchema, type SearchQualityConfig } from "./schema.js";
export const defaultConfig: SearchQualityConfig = configSchema.parse({});
