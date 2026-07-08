import { describe, expect, expectTypeOf, it } from "vitest";
import {
  defineCheck,
  definePlugin,
  type PluginCheckContext,
  type PluginDefinition,
  type PluginFinding,
} from "../src/index.js";
import { configSchema } from "../src/config/schema.js";
import { runPluginChecks } from "../src/plugins/runPlugins.js";
import { shouldFail } from "../src/engine/verify.js";
import { withBaselineComparison } from "../src/report/baseline.js";
import { formatJsonReport } from "../src/report/formatJsonReport.js";
import { formatMarkdownReport } from "../src/report/formatMarkdownReport.js";
import type { SearchQualityReport } from "../src/report/types.js";
import { context, page } from "./helpers.js";

const placeholderCheck = defineCheck({
  id: "custom.no-placeholder-copy",
  title: "No placeholder copy",
  category: "custom",
  classification: "local-heuristic",
  defaultSeverity: "warning",
  docsUrl: "https://example.com/rules/no-placeholders",
  run(ctx) {
    return ctx.pages.flatMap((item) =>
      item.visibleText.includes("Lorem ipsum")
        ? [
            {
              code: "custom.no-placeholder-copy",
              url: item.url,
              message: "Page contains placeholder copy.",
              remediation: "Replace placeholder copy before deployment.",
            },
          ]
        : [],
    );
  },
});

const plugin = definePlugin({
  name: "internal-rules",
  checks: [placeholderCheck],
});

const configured = (plugins: readonly PluginDefinition[] = [plugin]) =>
  configSchema.parse({
    site: { baseUrl: "https://example.com" },
    plugins,
  });

const crawl = context({
  pages: [
    page(
      `<!doctype html><html lang="en"><head>
        <title>Example page</title>
        <meta name="description" content="A useful description">
        <meta property="og:title" content="Example social title">
        <link rel="canonical" href="https://example.com/">
        <script type="application/ld+json">{"@type":"Organization","name":"Example"}</script>
      </head><body><main>Lorem ipsum <a href="/contact" rel="nofollow">Contact</a></main></body></html>`,
    ),
  ],
}).crawl;

function report(
  findings: SearchQualityReport["findings"],
): SearchQualityReport {
  return {
    schemaVersion: "0.3",
    tool: "search-quality-kit",
    version: "0.6.0",
    generatedAt: "2026-07-08T00:00:00.000Z",
    mode: "static",
    target: "/tmp/dist",
    summary: {
      checkedPages: 1,
      errors: findings.filter((item) => item.severity === "error").length,
      warnings: findings.filter((item) => item.severity === "warning").length,
      info: findings.filter((item) => item.severity === "info").length,
    },
    findings,
    pages: [{ url: "https://example.com/", status: 200 }],
    durationMs: 1,
  };
}

describe("plugin definitions", () => {
  it("keeps defineCheck and definePlugin fully typed", () => {
    expectTypeOf(placeholderCheck.run)
      .parameter(0)
      .toMatchTypeOf<PluginCheckContext>();
    expectTypeOf<
      Awaited<ReturnType<typeof placeholderCheck.run>>
    >().toMatchTypeOf<readonly PluginFinding[]>();
    expectTypeOf(plugin).toMatchTypeOf<PluginDefinition>();
  });

  it.each([
    [
      {
        title: "Missing id",
        category: "custom",
        classification: "local-heuristic",
        defaultSeverity: "warning",
        run: () => [],
      },
      "id is required",
    ],
    [
      {
        id: "custom.missing-run",
        title: "Missing run",
        category: "custom",
        classification: "local-heuristic",
        defaultSeverity: "warning",
      },
      "run is required",
    ],
    [
      {
        id: "custom.bad-severity",
        title: "Bad severity",
        category: "custom",
        classification: "local-heuristic",
        defaultSeverity: "fatal",
        run: () => [],
      },
      "defaultSeverity",
    ],
  ])("rejects an invalid check definition", (definition, message) => {
    expect(() => defineCheck(definition as never)).toThrow(message);
  });

  it("rejects duplicate ids within and across plugins", () => {
    expect(() =>
      definePlugin({
        name: "one",
        checks: [placeholderCheck, placeholderCheck],
      }),
    ).toThrow("duplicate check id");
    expect(() =>
      configSchema.parse({
        plugins: [
          { name: "one", checks: [placeholderCheck] },
          { name: "two", checks: [placeholderCheck] },
        ],
      }),
    ).toThrow("Duplicate plugin check id");
  });

  it("supports a plugin with multiple checks", () => {
    const second = defineCheck({
      ...placeholderCheck,
      id: "internal-rules.require-contact",
      title: "Require contact",
    });
    expect(
      definePlugin({
        name: "internal-rules",
        checks: [placeholderCheck, second],
      }).checks,
    ).toHaveLength(2);
  });
});

describe("plugin execution", () => {
  it("runs a custom check with a frozen, parsed context", async () => {
    let received: PluginCheckContext | undefined;
    const inspect = defineCheck({
      ...placeholderCheck,
      id: "custom.inspect-context",
      title: "Inspect context",
      run(ctx) {
        received = ctx;
        return [];
      },
    });
    await runPluginChecks(
      configured([definePlugin({ name: "internal-rules", checks: [inspect] })]),
      crawl,
    );
    const pluginPage = received?.pages[0];
    expect(pluginPage).toMatchObject({
      url: "https://example.com/",
      finalUrl: "https://example.com/",
      statusCode: 200,
      visibleText: "Lorem ipsum Contact",
      metadata: {
        title: "Example page",
        description: "A useful description",
        canonical: "https://example.com/",
        language: "en",
        openGraph: { "og:title": "Example social title" },
      },
      links: [
        {
          href: "/contact",
          url: "https://example.com/contact",
          text: "Contact",
          rel: ["nofollow"],
        },
      ],
      structuredData: [{ "@type": "Organization", name: "Example" }],
    });
    expect(Object.isFrozen(received)).toBe(true);
    expect(Object.isFrozen(pluginPage?.metadata.openGraph)).toBe(true);
    expect("plugins" in (received?.config ?? {})).toBe(false);
  });

  it("normalizes plugin findings and attributes their source", async () => {
    const result = await runPluginChecks(configured(), crawl);
    expect(result.errors).toEqual([]);
    expect(result.findings).toEqual([
      expect.objectContaining({
        check: "custom.no-placeholder-copy",
        code: "custom.no-placeholder-copy",
        severity: "warning",
        suggestion: "Replace placeholder copy before deployment.",
        source: { type: "plugin", name: "internal-rules" },
      }),
    ]);
  });

  it.each([
    [
      "missing code",
      () => [{ message: "Missing code", remediation: "Add code." }],
      "code is required",
    ],
    [
      "missing message",
      () => [{ code: "custom.invalid", remediation: "Add message." }],
      "message is required",
    ],
    [
      "invalid severity",
      () => [
        {
          code: "custom.invalid",
          severity: "fatal",
          message: "Bad",
          remediation: "Use a valid severity.",
        },
      ],
      "severity must be",
    ],
  ])(
    "turns an invalid finding into a plugin error: %s",
    async (_, run, message) => {
      const invalid = defineCheck({
        ...placeholderCheck,
        id: "custom.invalid",
        run,
      } as never);
      const result = await runPluginChecks(
        configured([
          definePlugin({ name: "internal-rules", checks: [invalid] }),
        ]),
        crawl,
      );
      expect(result.findings).toEqual([]);
      expect(result.errors[0]?.message).toContain(message);
    },
  );

  it("captures a thrown exception separately from findings", async () => {
    const broken = defineCheck({
      ...placeholderCheck,
      id: "custom.broken",
      run() {
        throw new Error("internal matcher exploded");
      },
    });
    const result = await runPluginChecks(
      configured([definePlugin({ name: "internal-rules", checks: [broken] })]),
      crawl,
    );
    expect(result.findings).toEqual([]);
    expect(result.errors).toEqual([
      {
        plugin: "internal-rules",
        check: "custom.broken",
        message: "internal matcher exploded",
      },
    ]);
  });
});

describe("plugin reporting and CI", () => {
  it("keeps source attribution in JSON and Markdown", async () => {
    const result = await runPluginChecks(configured(), crawl),
      pluginReport = report(result.findings),
      json = JSON.parse(formatJsonReport(pluginReport));
    expect(json.findings[0].source).toEqual({
      type: "plugin",
      name: "internal-rules",
    });
    expect(formatMarkdownReport(pluginReport)).toContain(
      "**Source:** plugin `internal-rules`",
    );
  });

  it("matches an old baseline without source attribution", async () => {
    const result = await runPluginChecks(configured(), crawl),
      current = report(result.findings),
      baseline = report(
        result.findings.map((item) => {
          const legacy = { ...item };
          delete legacy.source;
          return legacy;
        }),
      ),
      compared = withBaselineComparison(current, baseline);
    expect(compared.baseline?.summary).toMatchObject({
      existingFindings: 1,
      newFindings: 0,
      resolvedFindings: 0,
    });
  });

  it("applies ci.failOn to plugin findings", async () => {
    const result = await runPluginChecks(configured(), crawl),
      pluginReport = report(result.findings);
    expect(shouldFail(pluginReport, configured())).toBe(false);
    expect(
      shouldFail(
        pluginReport,
        configSchema.parse({
          site: { baseUrl: "https://example.com" },
          plugins: [plugin],
          ci: { failOn: ["warning"] },
        }),
      ),
    ).toBe(true);
  });
});
