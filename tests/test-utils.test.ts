import { describe, expect, expectTypeOf, it } from "vitest";
import {
  defineCheck,
  policyPacks,
  type PluginCheckContext,
} from "../src/index.js";
import {
  createPluginTestContext,
  runCheckForTest,
  runPluginForTest,
} from "../src/test-utils.js";
import type {
  PluginTestContextInput,
  PluginTestRunResult,
} from "@silesiansolutions/search-quality-kit/test-utils";
import { fixture } from "./helpers.js";

describe("plugin test utils", () => {
  it("creates a frozen plugin context from fixture HTML", () => {
    const input: PluginTestContextInput = {
      pages: [
        {
          url: "https://example.com/",
          finalUrl: "https://example.com/final",
          statusCode: 201,
          html: `<!doctype html><html lang="en"><head>
            <title>Parsed title</title>
            <meta name="description" content="Parsed description">
            <meta property="og:title" content="Parsed OG title">
            <link rel="canonical" href="https://example.com/final">
            <script type="application/ld+json">{"@type":"WebPage","name":"Parsed"}</script>
          </head><body><main><a href="/contact" rel="nofollow">Contact</a> Parsed body</main></body></html>`,
          visibleText: "Override visible text",
          metadata: {
            title: "Override title",
            openGraph: { "og:url": "https://example.com/final" },
          },
          links: [
            {
              href: "mailto:hello@example.com",
              text: "Email",
              rel: [],
            },
          ],
          structuredData: [{ "@type": "WebPage", name: "Override" }],
        },
      ],
    };
    const context = createPluginTestContext(input);
    expectTypeOf(context).toMatchTypeOf<PluginCheckContext>();
    expect(Object.isFrozen(context)).toBe(true);
    expect(context.config.site.baseUrl).toBe("https://example.com");
    expect(context.pages[0]).toMatchObject({
      url: "https://example.com/final",
      initialUrl: "https://example.com/",
      finalUrl: "https://example.com/final",
      statusCode: 201,
      visibleText: "Override visible text",
      metadata: {
        title: "Override title",
        description: "Parsed description",
        canonical: "https://example.com/final",
        openGraph: {
          "og:title": "Parsed OG title",
          "og:url": "https://example.com/final",
        },
      },
      links: [
        {
          href: "mailto:hello@example.com",
          text: "Email",
          rel: [],
        },
      ],
      structuredData: [{ "@type": "WebPage", name: "Override" }],
    });
  });

  it("runs one check through normal finding validation", async () => {
    const context = createPluginTestContext({
      pages: [
        {
          url: "https://example.com/",
          html: "<html><body><main>Lorem ipsum</main></body></html>",
        },
      ],
    });
    const check = defineCheck({
      id: "custom.no-placeholder-copy",
      title: "No placeholder copy",
      category: "custom",
      classification: "local-heuristic",
      defaultSeverity: "warning",
      run: (ctx) =>
        ctx.pages.flatMap((page) =>
          page.visibleText.includes("Lorem ipsum")
            ? [
                {
                  code: "custom.no-placeholder-copy",
                  url: page.url,
                  message: "Page contains placeholder copy.",
                  remediation: "Replace placeholder copy.",
                },
              ]
            : [],
        ),
    });
    const result = await runCheckForTest(check, context);
    expectTypeOf(result).toMatchTypeOf<PluginTestRunResult>();
    expect(result.errors).toEqual([]);
    expect(result.findings).toEqual([
      expect.objectContaining({
        check: "custom.no-placeholder-copy",
        code: "custom.no-placeholder-copy",
        source: { type: "plugin", name: "test-plugin" },
      }),
    ]);
  });

  it("runs a whole plugin without the crawler or a build", async () => {
    const context = createPluginTestContext({
      config: {
        site: { baseUrl: "https://example.com" },
        profiles: {
          default: "company",
          routes: [{ pattern: "/services/**", profile: "servicePage" }],
        },
      },
      pages: [
        {
          url: "https://example.com/services/seo",
          html: await fixture("policy-company-conflict.html"),
        },
      ],
    });
    const result = await runPluginForTest(policyPacks.companySite(), context);
    expect(result.errors).toEqual([]);
    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        "company-site.no-placeholder-copy",
        "company-site.contact-link",
      ]),
    );
  });

  it("exposes plugin error behavior for invalid findings", async () => {
    const context = createPluginTestContext({
      pages: [
        {
          url: "https://example.com/",
          html: "<html><body><main>Content</main></body></html>",
        },
      ],
    });
    const invalid = defineCheck({
      id: "custom.invalid",
      title: "Invalid",
      category: "custom",
      classification: "local-heuristic",
      defaultSeverity: "warning",
      run: () =>
        [
          {
            code: "custom.invalid",
            remediation: "Add the missing message.",
          },
        ] as never,
    });
    const result = await runCheckForTest(invalid, context);
    expect(result.findings).toEqual([]);
    expect(result.errors).toEqual([
      expect.objectContaining({
        plugin: "test-plugin",
        check: "custom.invalid",
        message: expect.stringContaining("message is required"),
      }),
    ]);
  });
});
