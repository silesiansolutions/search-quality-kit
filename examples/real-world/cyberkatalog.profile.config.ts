// Profile template aligned with CyberKatalog/cyberkatalog-web routes in July 2026.
// Revalidate intentional exclusions and route groups when the target site changes.
import {
  defineConfig,
  presets,
  profiles,
} from "@silesiansolutions/search-quality-kit";

const preset = presets.genericStatic();

export default defineConfig({
  ...preset,
  ...profiles.directory(),
  site: { baseUrl: "https://cyberkatalog.pl" },
  build: { ...preset.build, distDir: "build" },
  crawl: {
    ...preset.crawl,
    maxPages: 500,
    exclude: [...(preset.crawl?.exclude ?? []), "/200", "/200.html"],
  },
  profiles: {
    default: "directory",
    routes: [
      // These legal pages are currently indexable, so keep technical checks
      // enabled while removing directory-specific expectations.
      { pattern: "/polityka-prywatnosci", profile: "generic" },
      { pattern: "/klauzula-informacyjna", profile: "generic" },
      { pattern: "/regulamin", profile: "generic" },
      {
        pattern: "/firma/**",
        profile: "directoryEntry",
        expectedStructuredData: ["Organization", "BreadcrumbList"],
      },
      {
        pattern: "/kategoria/**",
        profile: "directoryList",
        expectedStructuredData: ["ItemList", "BreadcrumbList"],
      },
      {
        pattern: "/aktualnosci/**",
        profile: "blogPost",
        expectedStructuredData: ["Article", "BreadcrumbList"],
      },
    ],
  },
});
