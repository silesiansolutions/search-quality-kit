import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sitemapCheck } from "../src/checks/sitemap.js";
import { configSchema } from "../src/config/schema.js";
import { crawlStatic } from "../src/crawler/crawlSite.js";
import { fixture } from "./helpers.js";

async function staticSitemapSite(rootName = "sitemap-index.xml") {
  const root = await mkdtemp(path.join(tmpdir(), "search-quality-sitemaps-"));
  const dist = path.join(root, "dist");
  await mkdir(dist);
  await writeFile(
    path.join(dist, "robots.txt"),
    `User-agent: *\nSitemap: https://example.com/${rootName}`,
  );
  await writeFile(path.join(dist, rootName), await fixture(rootName));
  if (rootName === "sitemap-index.xml")
    for (const name of ["nested-index.xml", "child-a.xml", "child-b.xml"])
      await writeFile(path.join(dist, name), await fixture(name));
  return { root, dist };
}

describe("recursive static sitemaps", () => {
  it("loads nested child sitemaps and validates each child location", async () => {
    const { root, dist } = await staticSitemapSite();
    try {
      const config = configSchema.parse({
        site: { baseUrl: "https://example.com" },
      });
      const crawl = await crawlStatic(root, config);
      const findings = await sitemapCheck.run({ config, crawl });

      expect(crawl.sitemaps.map((sitemap) => sitemap.url)).toEqual([
        "https://example.com/sitemap-index.xml",
        "https://example.com/nested-index.xml",
        "https://example.com/child-a.xml",
        "https://example.com/child-b.xml",
      ]);
      expect(crawl.sitemapUrls).toHaveLength(3);
      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "duplicate-url",
            url: "https://example.com/child-b.xml",
            file: path.join(dist, "child-b.xml"),
          }),
          expect.objectContaining({
            code: "invalid-lastmod",
            url: "https://example.com/child-b.xml",
          }),
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports a missing child and enforces traversal limits", async () => {
    const missing = await staticSitemapSite("sitemap-index-missing.xml");
    try {
      const config = configSchema.parse({
        site: { baseUrl: "https://example.com" },
      });
      const crawl = await crawlStatic(missing.root, config);
      const findings = await sitemapCheck.run({ config, crawl });
      expect(findings).toContainEqual(
        expect.objectContaining({
          code: "child-missing",
          url: "https://example.com/missing-child.xml",
        }),
      );
    } finally {
      await rm(missing.root, { recursive: true, force: true });
    }

    const limited = await staticSitemapSite();
    try {
      const config = configSchema.parse({
        site: { baseUrl: "https://example.com" },
        crawl: { maxSitemapDepth: 1 },
      });
      const crawl = await crawlStatic(limited.root, config);
      expect(crawl.sitemapTruncated).toBe(true);
      expect(await sitemapCheck.run({ config, crawl })).toContainEqual(
        expect.objectContaining({ code: "fetch-limit" }),
      );
    } finally {
      await rm(limited.root, { recursive: true, force: true });
    }

    const countLimited = await staticSitemapSite();
    try {
      const config = configSchema.parse({
        site: { baseUrl: "https://example.com" },
        crawl: { maxSitemaps: 2 },
      });
      const crawl = await crawlStatic(countLimited.root, config);
      expect(crawl.sitemaps).toHaveLength(2);
      expect(crawl.sitemapTruncated).toBe(true);
    } finally {
      await rm(countLimited.root, { recursive: true, force: true });
    }
  });
});
