import { defineConfig } from "@silesiansolutions/search-quality-kit";

export default defineConfig({
  site: { baseUrl: "https://dawid.dev" },
  crawl: {
    mode: "http",
    entrypoints: ["/"],
    maxPages: 50,
    requestTimeoutMs: 15_000,
  },
  profiles: {
    default: "personal",
  },
});
