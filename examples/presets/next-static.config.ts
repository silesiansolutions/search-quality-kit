// Use only when Next.js sets `output: "export"` and produces the `out/` directory.
import { defineConfig, presets } from "@silesiansolutions/search-quality-kit";

export default defineConfig({
  ...presets.nextStatic(),
  site: { baseUrl: "https://example.com" },
});
