import { defineConfig, profiles } from "@silesiansolutions/search-quality-kit";

export default defineConfig({
  ...profiles.directory(),
  site: { baseUrl: "https://cyberkatalog.pl" },
  crawl: {
    mode: "http",
    entrypoints: ["/"],
    maxPages: 100,
    requestTimeoutMs: 15_000,
    exclude: ["/admin", "/preview", "/api", "/404", "/404.html"],
  },
  profiles: {
    default: "directory",
    routes: [
      { pattern: "/firma/**", profile: "directoryEntry" },
      { pattern: "/kategoria/**", profile: "directoryList" },
      { pattern: "/aktualnosci/**", profile: "blogPost" },
    ],
  },
});
