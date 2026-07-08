// Verified against the current Astro build of dawidrylko/dawidrylko.com.
import { defineConfig, presets } from "@silesiansolutions/search-quality-kit";

const preset = presets.astro();

export default defineConfig({
  ...preset,
  site: { baseUrl: "https://dawidrylko.com" },
  crawl: {
    ...preset.crawl,
    entrypoints: ["/"],
    maxPages: 150,
  },
});
