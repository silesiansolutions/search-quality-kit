// Use for a Vite SPA; findings apply to delivered HTML because JavaScript is not executed.
import { defineConfig, presets } from "@silesiansolutions/search-quality-kit";

export default defineConfig({
  ...presets.viteSpa(),
  site: { baseUrl: "https://example.com" },
});
