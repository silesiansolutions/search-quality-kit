// Use for plain HTML or another static generator that writes to `dist/`.
import { defineConfig, presets } from "@silesiansolutions/search-quality-kit";

export default defineConfig({
  ...presets.genericStatic(),
  site: { baseUrl: "https://example.com" },
});
