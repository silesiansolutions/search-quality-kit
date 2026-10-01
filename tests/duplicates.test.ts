import { describe, expect, it } from "vitest";
import { duplicatesCheck, mainContentHash } from "../src/checks/duplicates.js";
import {
  errorFreeUrlRate,
  errorFreeUrlSummary,
} from "../src/report/errorFreeUrlRate.js";
import { formatMarkdownReport } from "../src/report/formatMarkdownReport.js";
import type { Finding, SearchQualityReport } from "../src/report/types.js";
import { context, page } from "./helpers.js";

const PAD =
  " This sentence pads the main content past the default minimum text length of eighty characters.";
const doc = (main: string, head = "", chrome = "") =>
  `<html><head>${head}</head><body>${chrome}<main>${main}${PAD}</main></body></html>`;
const canonical = (href: string) => `<link rel="canonical" href="${href}">`;

async function run(pages: ReturnType<typeof page>[]) {
  const { config, crawl } = context({ pages });
  return duplicatesCheck.run({ config, crawl });
}

const pairs = (findings: Finding[]) =>
  findings.map((f) => [f.code, f.url, f.relatedUrls]);

describe("main content hash", () => {
  it("ignores chrome, markup and whitespace but keeps case", () => {
    const a = mainContentHash(
      doc("<p>Hello   <b>world</b></p>", "", "<nav>A</nav>"),
    );
    expect(a).toBe(
      mainContentHash(doc("<p>Hello <i>world</i></p>", "", "<nav>B</nav>")),
    );
    expect(a).not.toBe(mainContentHash(doc("<p>hello world</p>")));
    expect(
      mainContentHash(
        "<html><body><header>X</header><p>Body text</p><footer>Y</footer></body></html>",
      ),
    ).toBe(
      mainContentHash(
        "<html><body><header>Z</header><p>Body text</p><script>1</script></body></html>",
      ),
    );
    expect(
      mainContentHash("<html><body><main>   </main></body></html>"),
    ).toBeUndefined();
  });
});

describe("duplicates check", () => {
  it("reports identical pages without a canonical", async () => {
    const found = await run([
      page(doc("Same text"), "https://example.com/a"),
      page(doc("Same text"), "https://example.com/b"),
      page(doc("Other text"), "https://example.com/c"),
    ]);
    expect(pairs(found)).toEqual([
      [
        "exact-without-canonical",
        "https://example.com/a",
        ["https://example.com/b"],
      ],
      [
        "exact-without-canonical",
        "https://example.com/b",
        ["https://example.com/a"],
      ],
    ]);
    expect(found.every((f) => f.severity === "warning")).toBe(true);
    expect(found[0]!.message).not.toMatch(/\d/);
  });

  it("flags only the copies that lack a canonical", async () => {
    const found = await run([
      page(
        doc("Same", canonical("https://example.com/a")),
        "https://example.com/a",
      ),
      page(doc("Same"), "https://example.com/b"),
    ]);
    expect(pairs(found).map(([code, url]) => [code, url])).toEqual([
      ["exact-without-canonical", "https://example.com/b"],
    ]);
  });

  it("reports copies that each declare a different canonical", async () => {
    const found = await run([
      page(
        doc("Same", canonical("https://example.com/a")),
        "https://example.com/a",
      ),
      page(doc("Same", canonical("/b")), "https://example.com/b"),
    ]);
    expect(pairs(found).map(([code, url]) => [code, url])).toEqual([
      ["conflicting-canonicals", "https://example.com/a"],
      ["conflicting-canonicals", "https://example.com/b"],
    ]);
  });

  it("accepts copies consolidated on one canonical and ignores noindex copies", async () => {
    expect(
      await run([
        page(
          doc("Same", canonical("https://example.com/a")),
          "https://example.com/a",
        ),
        page(
          doc("Same", canonical("https://example.com/a/")),
          "https://example.com/b",
        ),
        page(
          doc("Same", '<meta name="robots" content="noindex">'),
          "https://example.com/c",
        ),
        {
          ...page(doc("Same"), "https://example.com/d"),
          headers: { "x-robots-tag": "noindex" },
        },
        { ...page(doc("Same"), "https://example.com/e"), status: 404 },
      ]),
    ).toEqual([]);
  });
});

describe("duplicates exclusions", () => {
  it("skips pages below rules.renderedHtml.minTextLength", async () => {
    const shell = "<html><body><main>Loading...</main></body></html>";
    expect(
      await run([
        page(shell, "https://example.com/a"),
        page(shell, "https://example.com/b"),
      ]),
    ).toEqual([]);
  });

  const alternates =
    '<link rel="alternate" hreflang="en-us" href="https://example.com/us/"><link rel="alternate" hreflang="en-gb" href="https://example.com/gb/">';
  const variants = [
    page(
      doc("Same", canonical("https://example.com/us/") + alternates),
      "https://example.com/us/",
    ),
    page(
      doc("Same", canonical("https://example.com/gb/") + alternates),
      "https://example.com/gb/",
    ),
  ];

  it("does not compare regional variants linked by reciprocal hreflang", async () => {
    expect(await run(variants)).toEqual([]);
    expect(
      await run([
        ...variants,
        page(
          doc("Same", canonical("https://example.com/us/")),
          "https://example.com/copy",
        ),
      ]),
    ).toEqual([]);
  });

  it("still reports a single copy outside the hreflang cluster", async () => {
    const bare = await run([
      ...variants,
      page(doc("Same"), "https://example.com/copy"),
    ]);
    expect(pairs(bare)).toEqual([
      [
        "exact-without-canonical",
        "https://example.com/copy",
        ["https://example.com/gb/", "https://example.com/us/"],
      ],
    ]);
    const self = await run([
      ...variants,
      page(
        doc("Same", canonical("https://example.com/copy")),
        "https://example.com/copy",
      ),
    ]);
    expect(pairs(self).map(([code, url]) => [code, url])).toEqual([
      ["conflicting-canonicals", "https://example.com/copy"],
    ]);
  });
});

describe("errorFreeUrlRate", () => {
  const error = (url?: string, extra: Partial<Finding> = {}) =>
    ({
      severity: "error",
      check: "metadata",
      code: "missing-title",
      message: "m",
      suggestion: "s",
      docs: "d",
      classification: ["local-heuristic"],
      impact: "technical-error",
      ...(url ? { url } : {}),
      ...extra,
    }) as Finding;

  it("rounds down so 100 means zero erroring pages", () => {
    expect(errorFreeUrlRate(1000, 1)).toBe(99);
    expect(errorFreeUrlRate(3, 1)).toBe(66);
    expect(errorFreeUrlRate(5, 0)).toBe(100);
  });

  it("counts unique audited URLs with unsuppressed errors only", () => {
    const pages = [
      "https://example.com/",
      "https://example.com/a",
      "https://example.com/b",
    ].map((url) => ({ url }));
    expect(
      errorFreeUrlSummary(pages, [
        error("https://example.com/a"),
        error("https://example.com/a/"),
        error("https://example.com/b", { suppressed: true }),
        error("https://example.com/b", { severity: "warning" }),
        error("https://example.com/not-crawled"),
        error(),
      ]),
    ).toEqual({ urlsWithErrors: 1, errorFreeUrlRate: 66 });
    expect(errorFreeUrlSummary([], [error()])).toEqual({});
  });

  it("prints the count beside the rate in Markdown", () => {
    const report = {
      schemaVersion: "0.3",
      tool: "search-quality-kit",
      version: "0",
      generatedAt: new Date(0).toISOString(),
      mode: "static",
      target: "dist",
      summary: {
        checkedPages: 3,
        errors: 1,
        warnings: 0,
        info: 0,
        urlsWithErrors: 1,
        errorFreeUrlRate: 66,
      },
      findings: [],
      pages: [],
      durationMs: 0,
    } as SearchQualityReport;
    expect(formatMarkdownReport(report)).toContain(
      "- Error-free URLs: 66% (1 of 3 pages carry an error)",
    );
  });
});
