import {
  defineConfig,
  policyPacks,
  presets,
  profiles,
} from "@silesiansolutions/search-quality-kit";

export default defineConfig({
  ...presets.astro(),
  ...profiles.personalSite(),
  site: {
    baseUrl: "https://example.com",
  },
  profiles: {
    default: "personal",
    routes: [{ pattern: "/blog/**", profile: "blogPost" }],
  },
  plugins: [
    policyPacks.personalBrand({
      contactLinkText: ["Kontakt", "Skontaktuj się", "Napisz"],
      contactHrefPatterns: ["/kontakt", "mailto:"],
      routePatterns: ["/", "/about", "/o-mnie", "/blog/**"],
    }),
    policyPacks.aiVisibilitySafe({ minVisibleTextLength: 160 }),
  ],
});
