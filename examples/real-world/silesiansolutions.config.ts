import { defineConfig } from "@silesiansolutions/search-quality-kit";

export default defineConfig({
  site: { baseUrl: "https://silesiansolutions.com" },
  build: { distDir: "dist" },
  crawl: {
    entrypoints: ["/"],
    maxPages: 100,
    exclude: [
      "/admin",
      "/preview",
      "/api",
      "/404",
      "/404.html",
      "/klauzula-informacyjna",
      "/polityka-prywatnosci",
    ],
  },
});
