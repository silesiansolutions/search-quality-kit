import { defineConfig } from "search-quality-kit";

export default defineConfig({
  site: { baseUrl: "https://dawidrylko.com" },
  build: { command: "pnpm build", distDir: "dist" },
});
