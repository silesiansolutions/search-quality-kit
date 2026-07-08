import { describe, expect, it } from "vitest";
import { structuredDataCheck } from "../src/checks/structuredData.js";
import { matchesRoutePattern } from "../src/config/profileDefinitions.js";
import { profiles } from "../src/config/profiles.js";
import { resolveProfile } from "../src/config/resolveProfile.js";
import {
  configSchema,
  type SearchQualityConfigInput,
} from "../src/config/schema.js";
import { context, fixture, page } from "./helpers.js";

const config = (input: SearchQualityConfigInput = {}) =>
  configSchema.parse({ site: { baseUrl: "https://site.test" }, ...input });

async function runFixture(
  name: string,
  url: string,
  input: SearchQualityConfigInput,
) {
  const html = await fixture(name);
  return structuredDataCheck.run(
    context({ pages: [page(html, url)] }, config(input)),
  );
}

describe("site profile config", () => {
  it.each([
    [profiles.personalSite, "personal"],
    [profiles.companySite, "company"],
    [profiles.blog, "blog"],
    [profiles.directory, "directory"],
    [profiles.localBusiness, "localBusiness"],
    [profiles.generic, "generic"],
  ] as const)("provides a tested profile factory", (factory, expected) => {
    expect(config(factory()).profiles.default).toBe(expected);
  });

  it("defaults to generic", () => {
    expect(config().profiles.default).toBe("generic");
  });

  it("matches simple route globs", () => {
    expect(matchesRoutePattern("/blog/post", "/blog/**")).toBe(true);
    expect(matchesRoutePattern("/blog", "/blog/**")).toBe(true);
    expect(matchesRoutePattern("/firmy/acme", "/firmy/*")).toBe(true);
    expect(matchesRoutePattern("/firmy/acme/team", "/firmy/*")).toBe(false);
  });

  it("uses first-match order and route overrides", () => {
    const resolved = resolveProfile(
      "https://site.test/blog/post",
      config({
        profiles: {
          default: "company",
          routes: [
            { pattern: "/blog/**", profile: "blogPost" },
            { pattern: "/**", profile: "generic" },
          ],
        },
      }),
    );
    expect(resolved).toMatchObject({
      activeProfile: "blogPost",
      matchedPattern: "/blog/**",
      expectedAnyOf: ["Article", "BlogPosting"],
    });
  });

  it("keeps the default profile when no route matches", () => {
    expect(
      resolveProfile(
        "https://site.test/about",
        config({
          profiles: {
            default: "personal",
            routes: [{ pattern: "/blog/**", profile: "blogPost" }],
          },
        }),
      ).activeProfile,
    ).toBe("personal");
  });

  it("rejects invalid patterns with field context", () => {
    expect(() =>
      config({ profiles: { routes: [{ pattern: "blog/**" }] } }),
    ).toThrow("root-relative glob");
  });
});

describe("structured data profiles", () => {
  it("accepts a personal homepage with Person", async () => {
    const findings = await runFixture(
      "profile-personal-valid.html",
      "https://site.test/",
      profiles.personalSite(),
    );
    expect(findings.some((item) => item.code === "missing-expected-type")).toBe(
      false,
    );
  });

  it("reports a profile expectation when Person is absent", async () => {
    const findings = await runFixture(
      "profile-personal-missing.html",
      "https://site.test/",
      profiles.personalSite(),
    );
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-expected-type",
          severity: "warning",
          classification: ["profile-expectation"],
          activeProfile: "personal",
          expectedStructuredData: ["Person"],
        }),
      ]),
    );
  });

  it("recognizes Organization, WebSite, WebPage, and BreadcrumbList", async () => {
    const findings = await runFixture(
      "profile-company.html",
      "https://site.test/",
      profiles.companySite(),
    );
    expect(findings.some((item) => item.code === "missing-expected-type")).toBe(
      false,
    );
    expect(
      findings.some((item) => item.code === "breadcrumb-missing-items"),
    ).toBe(false);
  });

  it("accepts a complete BlogPosting", async () => {
    const findings = await runFixture(
      "profile-blog-article.html",
      "https://site.test/blog/search-regressions",
      { profiles: { routes: [{ pattern: "/blog/**", profile: "blogPost" }] } },
    );
    expect(findings.some((item) => item.code === "missing-expected-type")).toBe(
      false,
    );
    expect(
      findings.some((item) => item.code === "article-recommended-properties"),
    ).toBe(false);
  });

  it("finds an obvious Article headline conflict", async () => {
    const findings = await runFixture(
      "profile-blog-conflict.html",
      "https://site.test/blog/search-regressions",
      { profiles: { routes: [{ pattern: "/blog/**", profile: "blogPost" }] } },
    );
    expect(findings.some((item) => item.code === "name-content-mismatch")).toBe(
      true,
    );
  });

  it("accepts a populated directory ItemList", async () => {
    const findings = await runFixture(
      "profile-directory-list.html",
      "https://site.test/kategorie/security",
      {
        profiles: {
          default: "directory",
          routes: [{ pattern: "/kategorie/**", profile: "directoryList" }],
        },
      },
    );
    expect(findings.some((item) => item.code === "missing-expected-type")).toBe(
      false,
    );
    expect(findings.some((item) => item.code === "empty-item-list")).toBe(
      false,
    );
  });

  it("accepts an Organization directory entry route override", async () => {
    const findings = await runFixture(
      "profile-directory-entry.html",
      "https://site.test/firmy/acme",
      {
        profiles: {
          default: "directory",
          routes: [{ pattern: "/firmy/**", profile: "directoryEntry" }],
        },
      },
    );
    expect(findings.some((item) => item.code === "missing-expected-type")).toBe(
      false,
    );
  });

  it("finds placeholders in directory entries", async () => {
    const findings = await runFixture(
      "profile-directory-placeholder.html",
      "https://site.test/firmy/acme",
      {
        profiles: {
          routes: [{ pattern: "/firmy/**", profile: "directoryEntry" }],
        },
      },
    );
    expect(
      findings.filter((item) => item.code === "placeholder").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("accepts LocalBusiness subtypes and Service", async () => {
    const findings = await runFixture(
      "profile-local-business.html",
      "https://site.test/services/audit",
      {
        profiles: {
          default: "localBusiness",
          routes: [
            {
              pattern: "/services/**",
              profile: "servicePage",
              expectedStructuredData: ["LocalBusiness"],
            },
          ],
        },
      },
    );
    expect(findings.some((item) => item.code === "missing-expected-type")).toBe(
      false,
    );
  });
});
