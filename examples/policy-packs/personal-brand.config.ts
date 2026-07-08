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
  plugins: [policyPacks.personalBrand(), policyPacks.aiVisibilitySafe()],
});
