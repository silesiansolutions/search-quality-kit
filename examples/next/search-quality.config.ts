// Use for a Next.js app whose local production server is managed by the CLI.
import { defineConfig } from "@silesiansolutions/search-quality-kit";
export default defineConfig({
  site: { baseUrl: "https://example.com", localUrl: "http://localhost:3000" },
  build: { command: "npm run build", startCommand: "npm run start" },
});
