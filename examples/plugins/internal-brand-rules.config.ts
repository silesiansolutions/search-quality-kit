import {
  defineConfig,
  presets,
  profiles,
} from "@silesiansolutions/search-quality-kit";
import { internalBrandRules } from "./custom-checks.js";

export default defineConfig({
  ...presets.astro(),
  ...profiles.companySite(),
  site: { baseUrl: "https://example.com" },
  plugins: [internalBrandRules],
});
