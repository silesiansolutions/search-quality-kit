// Use for Gatsby builds, including legacy sites that emit fallback HTML routes.
import { defineConfig, presets } from "@silesiansolutions/search-quality-kit";

export default defineConfig({
  ...presets.gatsby(),
  site: { baseUrl: "https://example.com" },
});
