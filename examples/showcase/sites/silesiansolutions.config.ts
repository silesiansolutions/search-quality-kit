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
  plugins: [
    policyPacks.companySite({
      placeholders: ["Demo Company", "Acme", "Your Company"],
      contactLinkText: [
        "Contact",
        "Kontakt",
        "Skontaktuj się",
        "Umów konsultację",
        "Napisz",
        "Book a call",
      ],
      contactHrefPatterns: ["/contact", "/kontakt", "mailto:"],
      routePatterns: ["/", "/services/**", "/uslugi/**"],
    }),
    policyPacks.aiVisibilitySafe({
      minVisibleTextLength: 220,
      allowNoindexOn: ["/privacy/**", "/legal/**"],
      allowNosnippetOn: ["/privacy/**", "/legal/**"],
    }),
  ],
  suppressions: [
    {
      code: "company-site.contact-link",
      urlPattern: "/services/legacy/**",
      reason:
        "Legacy service pages use the global footer contact CTA instead of a page-level CTA.",
      owner: "growth",
      expires: "2026-12-31",
    },
  ],
});
