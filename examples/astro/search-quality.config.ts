// Legacy standalone Astro example; prefer examples/presets/astro.config.ts.
import { defineConfig } from "@silesiansolutions/search-quality-kit";
export default defineConfig({
  site: { baseUrl: "https://example.com" },
  build: { command: "npm run build", distDir: "dist" },
});
