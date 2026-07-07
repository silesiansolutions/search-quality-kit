import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/loadConfig.js";
import { configSchema } from "../src/config/schema.js";
describe("config", () => {
  it("fills defaults for a partial config", () => {
    const c = configSchema.parse({ site: { baseUrl: "https://example.com" } });
    expect(c.crawl.maxPages).toBe(100);
    expect(c.crawl.maxSitemaps).toBe(50);
    expect(c.crawl.maxSitemapDepth).toBe(3);
    expect(c.checks.canonical).toBe(true);
  });
  it("loads TypeScript config", async () => {
    const { config } = await loadConfig(
      import.meta.dirname,
      "fixtures/config.ts",
    );
    expect(config.crawl.maxPages).toBe(7);
    expect(config.rules.canonical.required).toBe(false);
    expect(config.checks.sitemap).toBe(true);
  });
  it("rejects invalid URLs", () =>
    expect(() => configSchema.parse({ site: { baseUrl: "nope" } })).toThrow());
});
