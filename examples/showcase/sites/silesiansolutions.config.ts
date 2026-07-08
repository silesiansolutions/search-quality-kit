import { defineConfig, profiles } from "@silesiansolutions/search-quality-kit";

export default defineConfig({
  ...profiles.companySite(),
  site: { baseUrl: "https://silesiansolutions.com" },
  crawl: {
    mode: "http",
    entrypoints: ["/"],
    maxPages: 50,
    requestTimeoutMs: 15_000,
  },
});
