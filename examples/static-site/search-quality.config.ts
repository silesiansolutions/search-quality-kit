// Use for a generic generator that writes static HTML to public/.
import { defineConfig } from "@silesiansolutions/search-quality-kit";
export default defineConfig({
  site: { baseUrl: "https://example.com" },
  build: { distDir: "public" },
  crawl: { entrypoints: ["/"], maxPages: 50 },
});
