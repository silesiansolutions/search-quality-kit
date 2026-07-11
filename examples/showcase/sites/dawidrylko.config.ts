import {
  defineConfig,
  policyPacks,
} from "@silesiansolutions/search-quality-kit";

export default defineConfig({
  site: { baseUrl: "https://dawidrylko.com" },
  crawl: {
    mode: "http",
    entrypoints: ["/"],
    maxPages: 50,
    requestTimeoutMs: 15_000,
  },
  profiles: {
    default: "personal",
    routes: [{ pattern: "/blog/**", profile: "blogPost" }],
  },
  plugins: [
    policyPacks.personalBrand({
      contactLinkText: ["Kontakt", "Skontaktuj się", "Napisz", "Book a call"],
      contactHrefPatterns: ["/kontakt", "mailto:", "linkedin.com/in/"],
      routePatterns: ["/", "/o-mnie", "/about", "/blog/**"],
    }),
    policyPacks.aiVisibilitySafe({
      minVisibleTextLength: 160,
      routePatterns: ["/", "/o-mnie", "/about", "/blog/**"],
    }),
  ],
});
