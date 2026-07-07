import { defineConfig } from "@silesiansolutions/search-quality-kit";
export default defineConfig({
  site: { baseUrl: "https://example.com" },
  build: { command: "npm run build", distDir: "dist" },
});
