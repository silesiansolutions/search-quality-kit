// Verified against the Astro build of SilesianSolutions/silesiansolutions.com.
import { defineConfig, presets } from "@silesiansolutions/search-quality-kit";

const preset = presets.astro();

export default defineConfig({
  ...preset,
  site: { baseUrl: "https://silesiansolutions.com" },
  crawl: {
    ...preset.crawl,
    entrypoints: ["/"],
    maxPages: 100,
    exclude: [
      ...(preset.crawl?.exclude ?? []),
      "/klauzula-informacyjna",
      "/polityka-prywatnosci",
    ],
  },
});
