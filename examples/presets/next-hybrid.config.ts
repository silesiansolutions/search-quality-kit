// Use for SSR/hybrid Next.js; start the app separately or opt in to startCommand.
import { defineConfig, presets } from "@silesiansolutions/search-quality-kit";

const preset = presets.nextHybrid();

export default defineConfig({
  ...preset,
  site: {
    ...preset.site,
    baseUrl: "https://example.com",
  },
});
