import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { internalLinksCheck } from "../src/checks/internalLinks.js";
import { defaultConfig } from "../src/config/defaultConfig.js";
import { crawlStatic } from "../src/crawler/crawlSite.js";

describe("static crawl route inventory", () => {
  it("keeps excluded HTML routes available for internal-link validation", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "search-quality-kit-"));
    const dist = path.join(root, "dist");

    try {
      await mkdir(path.join(dist, "legal"), { recursive: true });
      await writeFile(
        path.join(dist, "index.html"),
        '<html><body><a href="/legal/">Legal</a></body></html>',
      );
      await writeFile(
        path.join(dist, "legal", "index.html"),
        "<html><body>Legal notice</body></html>",
      );

      const config = {
        ...defaultConfig,
        site: { ...defaultConfig.site, baseUrl: "https://example.com" },
        crawl: { ...defaultConfig.crawl, exclude: ["/legal"] },
      };
      const crawl = await crawlStatic(root, config);
      const findings = await internalLinksCheck.run({ config, crawl });

      expect(crawl.pages.map((page) => page.url)).toEqual([
        "https://example.com/",
      ]);
      expect(crawl.assets.has("https://example.com/legal")).toBe(true);
      expect(
        findings.some((finding) => finding.code === "missing-static-route"),
      ).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses a same-origin extensionless canonical for flat HTML output", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "search-quality-kit-flat-"));
    const dist = path.join(root, "dist");

    try {
      await mkdir(dist, { recursive: true });
      await writeFile(
        path.join(dist, "index.html"),
        '<html><head><link rel="canonical" href="https://example.com/"></head><body><a href="/about">About</a></body></html>',
      );
      await writeFile(
        path.join(dist, "about.html"),
        '<html><head><link rel="canonical" href="https://example.com/about"></head><body>About</body></html>',
      );

      const config = {
        ...defaultConfig,
        site: { ...defaultConfig.site, baseUrl: "https://example.com" },
      };
      const crawl = await crawlStatic(root, config);
      const findings = await internalLinksCheck.run({ config, crawl });

      expect(crawl.pages.map((page) => page.url)).toContain(
        "https://example.com/about",
      );
      expect(crawl.assets.has("https://example.com/about")).toBe(true);
      expect(findings).not.toContainEqual(
        expect.objectContaining({ code: "missing-static-route" }),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("static crawl llms.txt artifact", () => {
  it("reads llms.txt content when present", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "search-quality-kit-llms-"),
    );
    const dist = path.join(root, "dist");

    try {
      await mkdir(dist, { recursive: true });
      await writeFile(
        path.join(dist, "index.html"),
        "<html><body>Home</body></html>",
      );
      await writeFile(path.join(dist, "llms.txt"), "# Example\n\nHello.");

      const config = {
        ...defaultConfig,
        site: { ...defaultConfig.site, baseUrl: "https://example.com" },
      };
      const crawl = await crawlStatic(root, config);

      expect(crawl.llmsTxt).toEqual(
        expect.objectContaining({
          url: "https://example.com/llms.txt",
          status: 200,
          content: "# Example\n\nHello.",
          file: path.join(dist, "llms.txt"),
        }),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports a 404 status when llms.txt is absent", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "search-quality-kit-no-llms-"),
    );
    const dist = path.join(root, "dist");

    try {
      await mkdir(dist, { recursive: true });
      await writeFile(
        path.join(dist, "index.html"),
        "<html><body>Home</body></html>",
      );

      const config = {
        ...defaultConfig,
        site: { ...defaultConfig.site, baseUrl: "https://example.com" },
      };
      const crawl = await crawlStatic(root, config);

      expect(crawl.llmsTxt).toEqual(
        expect.objectContaining({
          url: "https://example.com/llms.txt",
          status: 404,
          content: undefined,
        }),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
