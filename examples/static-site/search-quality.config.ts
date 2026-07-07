import { defineConfig } from "@silesiansolutions/search-quality-kit";
export default defineConfig({
  site: { baseUrl: "https://example.com" },
  build: { distDir: "public" },
  crawl: { entrypoints: ["/"], maxPages: 50 },
});
