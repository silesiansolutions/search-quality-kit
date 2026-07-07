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
});
