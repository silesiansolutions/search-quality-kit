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
  plugins: [policyPacks.companySite(), policyPacks.aiVisibilitySafe()],
});
