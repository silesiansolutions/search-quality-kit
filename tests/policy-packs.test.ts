import { describe, expect, expectTypeOf, it } from "vitest";
import {
  aiVisibilitySafePolicyPack,
  companySitePolicyPack,
  directoryPolicyPack,
  personalBrandPolicyPack,
  policyPacks,
  type PluginDefinition,
} from "../src/index.js";
import { configSchema } from "../src/config/schema.js";
import { runPluginChecks } from "../src/plugins/runPlugins.js";
import { context, fixture, page } from "./helpers.js";

const configured = (
  plugins: readonly PluginDefinition[],
  config: Record<string, unknown> = {},
) =>
  configSchema.parse({
    site: { baseUrl: "https://example.com" },
    checks: {
      sitemap: false,
      robots: false,
      indexability: false,
      metadata: false,
      canonical: false,
      structuredData: false,
      openGraph: false,
      internalLinks: false,
      renderedHtml: false,
      accessibility: false,
      performanceHints: false,
    },
    plugins,
    ...config,
  });

async function runPack(
  plugin: PluginDefinition,
  htmlFixture: string,
  url: string,
  config: Record<string, unknown> = {},
) {
  return runPackHtml(plugin, await fixture(htmlFixture), url, config);
}

async function runPackHtml(
  plugin: PluginDefinition,
  html: string,
  url: string,
  config: Record<string, unknown> = {},
) {
  const cfg = configured([plugin], config),
    crawl = context({ pages: [page(html, url)] }, cfg).crawl;
  return runPluginChecks(cfg, crawl);
}

describe("policy packs", () => {
  it("exports reusable policy pack factories", () => {
    expectTypeOf<
      ReturnType<typeof policyPacks.companySite>
    >().toMatchTypeOf<PluginDefinition>();
    expect(policyPacks.personalBrand()).toMatchObject({
      name: "personal-brand",
    });
    expect(policyPacks.companySite()).toMatchObject({ name: "company-site" });
    expect(policyPacks.directory()).toMatchObject({ name: "directory" });
    expect(policyPacks.aiVisibilitySafe()).toMatchObject({
      name: "ai-visibility-safe",
    });
    expect(policyPacks.companySite().policyPack).toEqual({
      name: "companySite",
      optionsSummary: {},
    });
  });

  it("detects personal placeholders and missing profile/contact links", async () => {
    const result = await runPack(
      personalBrandPolicyPack(),
      "policy-personal-placeholder.html",
      "https://example.com/about",
      { profiles: { default: "personal" } },
    );
    expect(result.errors).toEqual([]);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "personal-brand.no-placeholder-copy",
          classification: ["local-heuristic"],
          source: { type: "plugin", name: "personal-brand" },
        }),
        expect.objectContaining({
          code: "personal-brand.contact-or-profile-link",
          classification: ["profile-expectation"],
        }),
        expect.objectContaining({
          code: "personal-brand.specific-description",
          classification: ["local-heuristic"],
        }),
      ]),
    );
  });

  it("detects company placeholders, contact gaps, name conflicts, and staging copy", async () => {
    const result = await runPack(
      companySitePolicyPack(),
      "policy-company-conflict.html",
      "https://example.com/services/seo",
      {
        profiles: {
          default: "company",
          routes: [{ pattern: "/services/**", profile: "servicePage" }],
        },
      },
    );
    expect(result.errors).toEqual([]);
    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        "company-site.no-placeholder-copy",
        "company-site.contact-link",
        "company-site.organization-name-conflict",
        "company-site.no-staging-copy",
      ]),
    );
    expect(
      result.findings.find(
        (finding) => finding.code === "company-site.contact-link",
      )?.classification,
    ).toEqual(["profile-expectation"]);
  });

  it("detects directory entry and list regressions without content scoring", async () => {
    const entry = await runPack(
      directoryPolicyPack(),
      "policy-directory-entry.html",
      "https://example.com/entries/acme",
      {
        profiles: {
          default: "directory",
          routes: [{ pattern: "/entries/**", profile: "directoryEntry" }],
        },
      },
    );
    const list = await runPack(
      directoryPolicyPack(),
      "policy-directory-list-empty.html",
      "https://example.com/categories/security",
      {
        profiles: {
          default: "directory",
          routes: [{ pattern: "/categories/**", profile: "directoryList" }],
        },
      },
    );
    expect(entry.errors).toEqual([]);
    expect(list.errors).toEqual([]);
    expect(entry.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        "directory.no-placeholder-copy",
        "directory.entry-name-consistency",
        "directory.specific-entry-title",
      ]),
    );
    expect(list.findings).toEqual([
      expect.objectContaining({
        code: "directory.list-not-empty",
        classification: ["profile-expectation"],
      }),
    ]);
  });

  it("flags AI visibility safety issues as local heuristics", async () => {
    const result = await runPack(
      aiVisibilitySafePolicyPack(),
      "policy-ai-visibility.html",
      "https://example.com/",
    );
    expect(result.errors).toEqual([]);
    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        "ai-visibility-safe.public-snippet-directives",
        "ai-visibility-safe.meaningful-visible-text",
        "ai-visibility-safe.url-consistency",
        "ai-visibility-safe.no-placeholder-shell",
      ]),
    );
    expect(
      result.findings.every((finding) =>
        finding.classification?.includes("local-heuristic"),
      ),
    ).toBe(true);
  });

  it("supports literal custom placeholders and route scopes", async () => {
    const plugin = companySitePolicyPack({
      placeholders: ["Example Industries"],
      routePatterns: ["/services/**"],
    });
    const html =
      "<!doctype html><html><body><main><h1>Example Industries</h1></main></body></html>";
    const included = await runPackHtml(
      plugin,
      html,
      "https://example.com/services/audit",
    );
    const excluded = await runPackHtml(
      plugin,
      html,
      "https://example.com/legal/terms",
    );
    expect(included.findings.map((finding) => finding.code)).toContain(
      "company-site.no-placeholder-copy",
    );
    expect(excluded.findings).toEqual([]);
    expect(plugin.policyPack?.optionsSummary).toMatchObject({
      placeholders: ["Example Industries"],
      routePatterns: ["/services/**"],
    });
    const emailOnly = await runPackHtml(
      companySitePolicyPack(),
      '<!doctype html><html><body><a href="mailto:owner@example.com">Email</a></body></html>',
      "https://example.com/",
      { profiles: { default: "company" } },
    );
    expect(emailOnly.findings.map((finding) => finding.code)).not.toContain(
      "company-site.no-placeholder-copy",
    );
  });

  it("accepts custom and Polish-friendly contact labels and href patterns", async () => {
    const html = (href: string, text: string) =>
      `<!doctype html><html><body><main><h1>Service</h1><a href="${href}">${text}</a></main></body></html>`;
    const config = {
      profiles: {
        default: "company",
        routes: [{ pattern: "/services/**", profile: "servicePage" }],
      },
    };
    const polishDefault = await runPackHtml(
      companySitePolicyPack(),
      html("/start", "Umów konsultację"),
      "https://example.com/services/audit",
      config,
    );
    const custom = await runPackHtml(
      companySitePolicyPack({
        contactLinkText: ["Porozmawiajmy"],
        contactHrefPatterns: ["/zapytaj"],
      }),
      html("/zapytaj", "Porozmawiajmy"),
      "https://example.com/services/audit",
      config,
    );
    for (const result of [polishDefault, custom])
      expect(result.findings.map((finding) => finding.code)).not.toContain(
        "company-site.contact-link",
      );
  });

  it("supports visible-text thresholds and reviewed directive exceptions", async () => {
    const html = `<!doctype html><html><head><meta name="robots" content="noindex,nosnippet"></head><body><main><h1>Privacy</h1><p>Short but intentionally public legal copy.</p></main></body></html>`;
    const result = await runPackHtml(
      aiVisibilitySafePolicyPack({
        minVisibleTextLength: 0,
        allowNoindexOn: ["/privacy/**"],
        allowNosnippetOn: ["/privacy/**"],
      }),
      html,
      "https://example.com/privacy/policy",
    );
    expect(result.findings.map((finding) => finding.code)).not.toContain(
      "ai-visibility-safe.public-snippet-directives",
    );
    expect(result.findings.map((finding) => finding.code)).not.toContain(
      "ai-visibility-safe.meaningful-visible-text",
    );
  });

  it("rejects invalid policy pack options at runtime", () => {
    expect(() =>
      companySitePolicyPack({ routePatterns: ["not-root-relative"] }),
    ).toThrow("root-relative globs");
    expect(() =>
      aiVisibilitySafePolicyPack({ minVisibleTextLength: -1 }),
    ).toThrow();
    expect(() =>
      personalBrandPolicyPack({ placeholders: [42] as never }),
    ).toThrow();
    expect(() => directoryPolicyPack({ unknown: true } as never)).toThrow();
  });
});
