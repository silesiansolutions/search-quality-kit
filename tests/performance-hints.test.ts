import { describe, expect, it } from "vitest";
import { performanceHintsCheck } from "../src/checks/performanceHints.js";
import { defaultConfig } from "../src/config/defaultConfig.js";
import { normalizeUrl } from "../src/utils/urls.js";
import { context, fixture, page } from "./helpers.js";

describe("responsive image performance hints", () => {
  it("groups repeated srcset variants and reads a basic sizes hint", async () => {
    const html = await fixture("responsive-images.html");
    const assets = new Map(
      [
        ["/hero-640.webp", 600_000],
        ["/hero-1280.webp", 900_000],
        ["/gallery-a.webp", 10_000],
        ["/gallery-b.webp", 10_000],
        ["/gallery-c.webp", 10_000],
      ].map(([url, bytes]) => {
        const absolute = normalizeUrl(String(url), "https://example.com/");
        return [absolute, { url: absolute, bytes: Number(bytes) }] as const;
      }),
    );
    const findings = await performanceHintsCheck.run(
      context({ pages: [page(html)], assets }),
    );
    const large = findings.filter((finding) => finding.code === "large-image");

    expect(large).toHaveLength(1);
    expect(large[0]?.message).toContain("2 variants");
    expect(large[0]?.message).toContain("50vw");
    expect(large[0]?.relatedUrls).toHaveLength(2);
    expect(findings).toContainEqual(
      expect.objectContaining({ code: "images-not-lazy" }),
    );
  });

  it("does not flag distinct non-primary groups that are lazy-loaded", async () => {
    const html = (await fixture("responsive-images.html")).replace(
      /<img src="\/gallery/g,
      '<img loading="lazy" src="/gallery',
    );
    const findings = await performanceHintsCheck.run(
      context({ pages: [page(html)] }, defaultConfig),
    );
    expect(findings).not.toContainEqual(
      expect.objectContaining({ code: "images-not-lazy" }),
    );
  });
});
