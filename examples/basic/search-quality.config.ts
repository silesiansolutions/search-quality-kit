// Use when demonstrating explicit config without a framework preset.
import { defineConfig } from "@silesiansolutions/search-quality-kit";
export default defineConfig({
  site: { baseUrl: "https://example.com" },
  build: { command: "npm run build", distDir: "dist" },
});
