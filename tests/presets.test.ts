import { describe, expect, it } from "vitest";
import { checkCatalog } from "../src/checks/index.js";
import { presets, type PresetName } from "../src/config/presets.js";
import { configSchema } from "../src/config/schema.js";

const cases: Array<
  [
    PresetName,
    () => ReturnType<(typeof presets)[keyof typeof presets]>,
    string,
    string,
  ]
> = [
  ["astro", presets.astro, "dist", "static"],
  ["next-static", presets.nextStatic, "out", "static"],
  ["next-hybrid", presets.nextHybrid, ".next", "http"],
  ["gatsby", presets.gatsby, "public", "static"],
  ["vite-spa", presets.viteSpa, "dist", "static"],
  ["generic-static", presets.genericStatic, "dist", "static"],
];

describe("framework presets", () => {
  it.each(cases)(
    "provides predictable %s defaults",
    (_, factory, distDir, mode) => {
      const input = factory();
      const config = configSchema.parse({
        ...input,
        site: { ...input.site, baseUrl: "https://example.com" },
      });

      expect(config.build.distDir).toBe(distDir);
      expect(config.crawl.mode).toBe(mode);
      expect(config.crawl.exclude).toContain("/404");
      expect(config.build.command).toBeUndefined();
      expect(config.build.startCommand).toBeUndefined();
    },
  );

  it("covers Gatsby-generated fallback routes without broad exclusions", () => {
    const config = configSchema.parse({
      ...presets.gatsby(),
      site: { baseUrl: "https://example.com" },
    });
    expect(config.crawl.exclude).toContain("/dev-404-page");
    expect(config.crawl.exclude).not.toContain("/");
  });

  it("keeps Next hybrid HTTP-based without starting or building the app", () => {
    const config = configSchema.parse({
      ...presets.nextHybrid(),
      site: {
        ...presets.nextHybrid().site,
        baseUrl: "https://example.com",
      },
    });
    expect(config.site.localUrl).toBe("http://localhost:3000");
    expect(config.build.command).toBeUndefined();
    expect(config.build.startCommand).toBeUndefined();
  });

  it("retains the legacy check basis beside stable classifications", () => {
    expect(checkCatalog[0]?.classification).toContain("google-recommendation");
    expect(checkCatalog[0]?.basis).toContain("Google recommendation");
  });
});
