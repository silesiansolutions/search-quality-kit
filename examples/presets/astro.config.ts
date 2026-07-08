// Use for a statically generated Astro site. Build the site before verification.
import { defineConfig, presets } from "@silesiansolutions/search-quality-kit";

export default defineConfig({
  ...presets.astro(),
  site: { baseUrl: "https://example.com" },
});
