// Verified against CyberKatalog/cyberkatalog-web (SvelteKit adapter-static).
import { defineConfig, presets } from "@silesiansolutions/search-quality-kit";

const preset = presets.genericStatic();

export default defineConfig({
  ...preset,
  site: { baseUrl: "https://cyberkatalog.pl" },
  build: { ...preset.build, distDir: "build" },
  crawl: {
    ...preset.crawl,
    maxPages: 500,
    exclude: [...(preset.crawl?.exclude ?? []), "/200", "/200.html"],
  },
});
