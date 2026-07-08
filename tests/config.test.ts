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
  it("explains an invalid production URL", async () => {
    await expect(
      loadConfig(import.meta.dirname, "fixtures/invalid-url-config.ts"),
    ).rejects.toThrow(
      "site.baseUrl: Expected an absolute http(s) production URL",
    );
  });
  it("explains a missing production URL", async () => {
    await expect(
      loadConfig(import.meta.dirname, "fixtures/empty-config.ts"),
    ).rejects.toThrow("site.baseUrl is missing");
  });
  it("rejects a static/local URL conflict", async () => {
    await expect(
      loadConfig(import.meta.dirname, "fixtures/static-local-config.ts"),
    ).rejects.toThrow("site.localUrl conflicts with crawl.mode=static");
  });
  it("rejects an exclusion that removes the whole site", async () => {
    await expect(
      loadConfig(import.meta.dirname, "fixtures/exclude-all-config.ts"),
    ).rejects.toThrow("crawl.exclude contains '/'");
  });
  it("explains an invalid route profile pattern", async () => {
    await expect(
      loadConfig(import.meta.dirname, "fixtures/invalid-profile-config.ts"),
    ).rejects.toThrow(
      "profiles.routes.0.pattern: Expected a root-relative glob",
    );
  });
});
