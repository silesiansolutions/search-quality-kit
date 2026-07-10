import { describe, expect, it } from "vitest";
import { configSchema } from "../src/config/schema.js";
import {
  applyReviewedSuppressions,
  findingStableCode,
  isSuppressionExpired,
} from "../src/suppressions.js";
import type { Finding } from "../src/report/types.js";

const finding: Finding = {
  severity: "warning",
  check: "metadata",
  code: "description-length",
  message: "Description is short.",
  suggestion: "Write a useful summary.",
  url: "https://example.com/legal/terms",
  docs: "https://example.com/docs",
};

const config = (expires?: string) =>
  configSchema.parse({
    site: { baseUrl: "https://example.com" },
    suppressions: [
      {
        code: "metadata.description-length",
        urlPattern: "/legal/**",
        reason: "Legal pages intentionally use short metadata.",
        owner: "site-owner",
        ...(expires ? { expires } : {}),
      },
    ],
  });

describe("reviewed suppressions", () => {
  it("matches a core finding by stable code and route glob", () => {
    const [suppressed] = applyReviewedSuppressions(
      [finding],
      config("2026-12-31"),
      "2026-07-10",
    );
    expect(findingStableCode(finding)).toBe("metadata.description-length");
    expect(suppressed).toMatchObject({
      suppressed: true,
      suppression: {
        code: "metadata.description-length",
        urlPattern: "/legal/**",
        owner: "site-owner",
        expires: "2026-12-31",
      },
    });
  });

  it("does not apply a route mismatch or expired suppression", () => {
    expect(
      applyReviewedSuppressions(
        [{ ...finding, url: "https://example.com/blog/post" }],
        config(),
        "2026-07-10",
      )[0],
    ).not.toHaveProperty("suppressed");
    expect(
      applyReviewedSuppressions(
        [finding],
        config("2026-07-09"),
        "2026-07-10",
      )[0],
    ).not.toHaveProperty("suppressed");
    expect(isSuppressionExpired({ expires: "2026-07-09" }, "2026-07-10")).toBe(
      true,
    );
  });

  it("uses a plugin finding code without duplicating its namespace", () => {
    const pluginFinding = {
      ...finding,
      check: "company-site.contact-link",
      code: "company-site.contact-link",
    };
    expect(findingStableCode(pluginFinding)).toBe("company-site.contact-link");
  });
});
