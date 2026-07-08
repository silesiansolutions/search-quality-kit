import {
  defineConfig,
  policyPacks,
  presets,
  profiles,
} from "@silesiansolutions/search-quality-kit";

export default defineConfig({
  ...presets.astro(),
  ...profiles.directory(),
  site: {
    baseUrl: "https://example.com",
  },
  profiles: {
    default: "directory",
    routes: [
      { pattern: "/entries/**", profile: "directoryEntry" },
      { pattern: "/categories/**", profile: "directoryList" },
      { pattern: "/blog/**", profile: "blogPost" },
    ],
  },
  plugins: [policyPacks.directory(), policyPacks.aiVisibilitySafe()],
});
