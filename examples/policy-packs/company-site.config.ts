import {
  defineConfig,
  policyPacks,
  presets,
  profiles,
} from "@silesiansolutions/search-quality-kit";

export default defineConfig({
  ...presets.astro(),
  ...profiles.companySite(),
  site: {
    baseUrl: "https://example.com",
  },
  profiles: {
    default: "company",
    routes: [{ pattern: "/services/**", profile: "servicePage" }],
  },
  plugins: [
    policyPacks.companySite({
      placeholders: ["Demo Company", "Acme", "Your Company"],
      contactLinkText: [
        "Kontakt",
        "Skontaktuj się",
        "Umów konsultację",
        "Napisz",
      ],
      contactHrefPatterns: ["/kontakt", "mailto:"],
      routePatterns: ["/", "/services/**", "/uslugi/**"],
    }),
    policyPacks.aiVisibilitySafe({
      minVisibleTextLength: 250,
      allowNoindexOn: ["/privacy/**"],
      allowNosnippetOn: ["/legal/**", "/privacy/**"],
    }),
  ],
});
