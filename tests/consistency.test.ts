import { describe, expect, it } from "vitest";
import { canonicalCheck } from "../src/checks/canonical.js";
import { openGraphCheck } from "../src/checks/openGraph.js";
import { structuredDataCheck } from "../src/checks/structuredData.js";
import { configSchema } from "../src/config/schema.js";
import { context, fixture, page } from "./helpers.js";

const config = configSchema.parse({ site: { baseUrl: "https://site.test" } });

describe("cross-field consistency", () => {
  it("accepts semantic alignment and a brand suffix", async () => {
    const html = await fixture("profile-cross-field-aligned.html"),
      crawl = { pages: [page(html, "https://site.test/services/audit")] },
      findings = [
        ...(await openGraphCheck.run(context(crawl, config))),
        ...(await structuredDataCheck.run(context(crawl, config))),
      ];
    expect(findings.some((item) => item.code.endsWith("mismatch"))).toBe(false);
  });

  it("reports only explicit URL, identity, and semantic conflicts", async () => {
    const html = await fixture("profile-cross-field-conflict.html"),
      currentPage = page(html, "https://site.test/search-regressions"),
      crawl = {
        pages: [currentPage],
        sitemapUrls: ["https://site.test/search-regressions"],
      },
      findings = [
        ...(await canonicalCheck.run(context(crawl, config))),
        ...(await openGraphCheck.run(context(crawl, config))),
        ...(await structuredDataCheck.run(context(crawl, config))),
      ],
      codes = findings.map((item) => item.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "sitemap-canonical-mismatch",
        "url-canonical-mismatch",
        "title-mismatch",
        "description-mismatch",
        "name-content-mismatch",
        "invalid-url",
        "non-production-url",
        "empty-value",
        "placeholder",
        "conflicting-identity",
      ]),
    );
  });
});
