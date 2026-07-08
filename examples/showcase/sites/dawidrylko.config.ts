import { defineConfig, profiles } from "@silesiansolutions/search-quality-kit";

export default defineConfig({
  ...profiles.personalSite(),
  site: { baseUrl: "https://dawidrylko.com" },
  crawl: {
    mode: "http",
    entrypoints: ["/"],
    maxPages: 50,
    requestTimeoutMs: 15_000,
  },
});
