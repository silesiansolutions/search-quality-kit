import {
  defineConfig,
  policyPacks,
} from "@silesiansolutions/search-quality-kit";

export default defineConfig({
  site: { baseUrl: "https://silesiansolutions.com" },
  crawl: {
    mode: "http",
    entrypoints: ["/"],
    maxPages: 50,
    requestTimeoutMs: 15_000,
  },
  profiles: {
    default: "company",
    routes: [
      { pattern: "/services/**", profile: "servicePage" },
      { pattern: "/blog/**", profile: "blogPost" },
      { pattern: "/articles/**", profile: "blogPost" },
    ],
  },
  plugins: [policyPacks.companySite(), policyPacks.aiVisibilitySafe()],
});
