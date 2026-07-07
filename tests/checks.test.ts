import { describe, expect, it } from "vitest";
import { canonicalCheck } from "../src/checks/canonical.js";
import { metadataCheck } from "../src/checks/metadata.js";
import { robotsCheck } from "../src/checks/robots.js";
import { sitemapCheck } from "../src/checks/sitemap.js";
import { structuredDataCheck } from "../src/checks/structuredData.js";
import { context, fixture, page } from "./helpers.js";
describe("sitemap", () => {
  it("finds localhost URLs", async () => {
    const content = await fixture("sitemap.xml"),
      findings = await sitemapCheck.run(
        context({
          sitemap: {
            url: "https://example.com/sitemap.xml",
            status: 200,
            content,
          },
        }),
      );
    expect(findings.some((f) => f.code === "non-production-url")).toBe(true);
  });
  it("rejects malformed XML", async () => {
    const f = await sitemapCheck.run(
      context({
        sitemap: {
          url: "https://example.com/sitemap.xml",
          status: 200,
          content: "<urlset>",
        },
      }),
    );
    expect(f[0]?.code).toBe("invalid-xml");
  });
});
describe("robots", () => {
  it("flags a production-wide block", async () => {
    const f = await robotsCheck.run(
      context({
        robots: {
          url: "https://example.com/robots.txt",
          status: 200,
          content: "User-agent: *\nDisallow: /",
        },
      }),
    );
    expect(
      f.some((x) => x.code === "disallow-all" && x.severity === "error"),
    ).toBe(true);
  });
});
describe("page metadata", () => {
  it("finds missing and generic metadata", async () => {
    const html = await fixture("bad.html"),
      f = await metadataCheck.run(context({ pages: [page(html)] }));
    expect(f.map((x) => x.code)).toEqual(
      expect.arrayContaining([
        "generic-title",
        "missing-description",
        "missing-lang",
        "missing-viewport",
      ]),
    );
  });
  it("detects duplicate titles", async () => {
    const html = await fixture("good.html"),
      f = await metadataCheck.run(
        context({ pages: [page(html), page(html, "https://example.com/two")] }),
      );
    expect(f.some((x) => x.code === "duplicate-title")).toBe(true);
  });
});
describe("canonical", () => {
  it("flags localhost canonicals", async () => {
    const html = await fixture("bad.html"),
      f = await canonicalCheck.run(context({ pages: [page(html)] }));
    expect(f.some((x) => x.code === "non-production-url")).toBe(true);
  });
});
describe("JSON-LD", () => {
  it("reports invalid JSON", async () => {
    const html = await fixture("bad.html"),
      f = await structuredDataCheck.run(context({ pages: [page(html)] }));
    expect(f.some((x) => x.code === "invalid-json")).toBe(true);
  });
  it("accepts a basic valid node", async () => {
    const html = await fixture("good.html"),
      f = await structuredDataCheck.run(context({ pages: [page(html)] }));
    expect(f.filter((x) => x.severity === "error")).toHaveLength(0);
  });
});
