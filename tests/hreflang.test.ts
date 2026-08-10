import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checks } from "../src/checks/index.js";
import { hreflangCheck } from "../src/checks/hreflang.js";
import { configSchema } from "../src/config/schema.js";
import type { PageArtifact } from "../src/crawler/types.js";
import { context, fixture, page } from "./helpers.js";

interface AltPageOptions {
  url: string;
  lang?: string;
  alternates?: { hreflang: string; href: string }[];
  canonical?: string;
  status?: number;
}

function altPage(opts: AltPageOptions): PageArtifact {
  const links = [
    ...(opts.canonical
      ? [`<link rel="canonical" href="${opts.canonical}" />`]
      : []),
    ...(opts.alternates ?? []).map(
      (a) =>
        `<link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`,
    ),
  ].join("\n    ");
  const html = `<!doctype html>
<html${opts.lang ? ` lang="${opts.lang}"` : ""}>
  <head>
    <title>Example</title>
    ${links}
  </head>
  <body>
    <main>
      <h1>Example</h1>
      <p>Substantial visible content for a page that can be indexed.</p>
    </main>
  </body>
</html>`;
  const p = page(html, opts.url);
  return opts.status === undefined ? p : { ...p, status: opts.status };
}

describe("hreflang: monolingual silence", () => {
  it("stays silent across the whole existing fixture corpus", async () => {
    const fixturesDir = path.join(import.meta.dirname, "fixtures");
    const htmlFixtures = readdirSync(fixturesDir).filter((f) =>
      f.endsWith(".html"),
    );
    expect(htmlFixtures.length).toBeGreaterThan(0);
    for (const name of htmlFixtures) {
      const html = await fixture(name);
      const findings = await hreflangCheck.run(
        context({ pages: [page(html)] }),
      );
      expect(findings, `${name} produced hreflang findings`).toEqual([]);
    }
  });

  it("is silent for a single page with only a self-referencing hreflang", async () => {
    const p = altPage({
      url: "https://example.com/",
      lang: "en",
      alternates: [{ hreflang: "en", href: "https://example.com/" }],
    });
    const findings = await hreflangCheck.run(context({ pages: [p] }));
    expect(findings).toEqual([]);
  });
});

describe("hreflang: reciprocity", () => {
  const en = () =>
    altPage({
      url: "https://example.com/en/",
      lang: "en",
      alternates: [
        { hreflang: "en", href: "https://example.com/en/" },
        { hreflang: "de", href: "https://example.com/de/" },
        { hreflang: "fr", href: "https://example.com/fr/" },
      ],
    });
  const de = () =>
    altPage({
      url: "https://example.com/de/",
      lang: "de",
      alternates: [
        { hreflang: "en", href: "https://example.com/en/" },
        { hreflang: "de", href: "https://example.com/de/" },
        { hreflang: "fr", href: "https://example.com/fr/" },
      ],
    });
  const frComplete = () =>
    altPage({
      url: "https://example.com/fr/",
      lang: "fr",
      alternates: [
        { hreflang: "en", href: "https://example.com/en/" },
        { hreflang: "de", href: "https://example.com/de/" },
        { hreflang: "fr", href: "https://example.com/fr/" },
      ],
    });
  const frBroken = () =>
    altPage({
      url: "https://example.com/fr/",
      lang: "fr",
      alternates: [
        { hreflang: "de", href: "https://example.com/de/" },
        { hreflang: "fr", href: "https://example.com/fr/" },
      ],
    });

  it("is silent for an intact three-page cluster", async () => {
    const findings = await hreflangCheck.run(
      context({ pages: [en(), de(), frComplete()] }),
    );
    expect(findings).toEqual([]);
  });

  it("reports exactly one missing-reciprocal when fr drops its link back to en", async () => {
    const findings = await hreflangCheck.run(
      context({ pages: [en(), de(), frBroken()] }),
    );
    const reciprocal = findings.filter((f) => f.code === "missing-reciprocal");
    expect(reciprocal).toHaveLength(1);
    expect(reciprocal[0]?.url).toBe("https://example.com/fr/");
    expect(reciprocal[0]?.relatedUrls).toContain("https://example.com/en/");
  });

  it("keeps the missing-reciprocal message free of digits so the baseline stays stable", async () => {
    const findings = await hreflangCheck.run(
      context({ pages: [en(), de(), frBroken()] }),
    );
    const reciprocal = findings.find((f) => f.code === "missing-reciprocal");
    expect(reciprocal).toBeDefined();
    expect(/\d/.test(reciprocal!.message)).toBe(false);
  });

  it("reports exactly one finding for an eight-page cluster with one broken page", async () => {
    const langs = ["en", "de", "fr", "es", "it", "pt", "nl", "pl"];
    const urlFor = (i: number) => `https://example.com/${langs[i]}/`;
    const pages = langs.map((lang, i) =>
      altPage({
        url: urlFor(i),
        lang,
        alternates:
          i === langs.length - 1
            ? [{ hreflang: langs[i]!, href: urlFor(i) }]
            : langs.map((l, j) => ({ hreflang: l, href: urlFor(j) })),
      }),
    );
    const findings = await hreflangCheck.run(context({ pages }));
    const reciprocal = findings.filter((f) => f.code === "missing-reciprocal");
    expect(reciprocal).toHaveLength(1);
    expect(reciprocal[0]?.url).toBe(urlFor(langs.length - 1));
    expect(reciprocal[0]?.relatedUrls).toHaveLength(langs.length - 1);
  });
});

describe("hreflang: subtag validation", () => {
  it("reports invalid-language for a non-ISO-639-1 code", async () => {
    const p = altPage({
      url: "https://example.com/",
      alternates: [{ hreflang: "eng", href: "https://example.com/other/" }],
    });
    const findings = await hreflangCheck.run(context({ pages: [p] }));
    expect(findings).toContainEqual(
      expect.objectContaining({ code: "invalid-language" }),
    );
  });

  it("reports invalid-region for a non-ISO-3166-1 region", async () => {
    const p = altPage({
      url: "https://example.com/",
      alternates: [{ hreflang: "en-UK", href: "https://example.com/other/" }],
    });
    const findings = await hreflangCheck.run(context({ pages: [p] }));
    expect(findings).toContainEqual(
      expect.objectContaining({ code: "invalid-region" }),
    );
  });

  it("reports invalid-value for a malformed tag", async () => {
    const p = altPage({
      url: "https://example.com/",
      alternates: [{ hreflang: "en_US", href: "https://example.com/other/" }],
    });
    const findings = await hreflangCheck.run(context({ pages: [p] }));
    expect(findings).toContainEqual(
      expect.objectContaining({ code: "invalid-value" }),
    );
  });

  it("ignores incidental whitespace around an otherwise valid value", async () => {
    const p = altPage({
      url: "https://example.com/",
      alternates: [{ hreflang: " en ", href: "https://example.com/" }],
    });
    const findings = await hreflangCheck.run(context({ pages: [p] }));
    expect(findings).toEqual([]);
  });

  it("silently accepts es-419", async () => {
    const p = altPage({
      url: "https://example.com/",
      alternates: [
        { hreflang: "en", href: "https://example.com/" },
        { hreflang: "es-419", href: "https://elsewhere.example/es/" },
      ],
    });
    const findings = await hreflangCheck.run(context({ pages: [p] }));
    expect(
      findings.filter((f) =>
        ["invalid-value", "invalid-language", "invalid-region"].includes(
          f.code,
        ),
      ),
    ).toEqual([]);
  });
});

describe("hreflang: mode asymmetry for broken-target", () => {
  const buildPages = (targetStatus: number) => [
    altPage({
      url: "https://example.com/en/",
      lang: "en",
      alternates: [
        { hreflang: "en", href: "https://example.com/en/" },
        { hreflang: "de", href: "https://example.com/de/" },
      ],
    }),
    altPage({
      url: "https://example.com/de/",
      lang: "de",
      status: targetStatus,
    }),
  ];

  it("stays silent in static mode", async () => {
    const findings = await hreflangCheck.run(
      context({ mode: "static", pages: buildPages(404) }),
    );
    expect(findings.some((f) => f.code === "broken-target")).toBe(false);
  });

  it("fires in http mode for the same input", async () => {
    const findings = await hreflangCheck.run(
      context({ mode: "http", pages: buildPages(404) }),
    );
    expect(findings).toContainEqual(
      expect.objectContaining({
        code: "broken-target",
        url: "https://example.com/en/",
      }),
    );
  });
});

describe("hreflang: strict severity promotion", () => {
  it("promotes google-requirement codes to error under strict", async () => {
    const config = configSchema.parse({
      rules: { hreflang: { strict: true } },
    });
    const p = altPage({
      url: "https://example.com/en/",
      alternates: [{ hreflang: "de", href: "https://example.com/de/" }],
    });
    const findings = await hreflangCheck.run(
      context(
        { pages: [p, altPage({ url: "https://example.com/de/" })] },
        config,
      ),
    );
    const missingSelf = findings.find((f) => f.code === "missing-self");
    expect(missingSelf?.severity).toBe("error");
  });

  it("leaves google-recommendation and local-heuristic codes at their default under strict", async () => {
    const config = configSchema.parse({
      rules: { hreflang: { strict: true } },
    });
    const p = altPage({
      url: "https://example.com/",
      alternates: [
        { hreflang: "x-default", href: "https://example.com/" },
        { hreflang: "x-default", href: "https://example.com/alt/" },
      ],
    });
    const findings = await hreflangCheck.run(context({ pages: [p] }, config));
    const duplicate = findings.find((f) => f.code === "x-default-duplicate");
    expect(duplicate?.severity).toBe("warning");
  });

  it("keeps codes at warning by default without strict", async () => {
    const p = altPage({
      url: "https://example.com/en/",
      alternates: [{ hreflang: "de", href: "https://example.com/de/" }],
    });
    const findings = await hreflangCheck.run(
      context({ pages: [p, altPage({ url: "https://example.com/de/" })] }),
    );
    const missingSelf = findings.find((f) => f.code === "missing-self");
    expect(missingSelf?.severity).toBe("warning");
  });
});

describe("hreflang: rule gates", () => {
  const buildPages = (canonical?: string) => [
    altPage({
      url: "https://example.com/en/",
      lang: "en",
      alternates: [
        { hreflang: "en", href: "https://example.com/en/" },
        { hreflang: "de", href: "https://example.com/de/" },
      ],
    }),
    altPage({
      url: "https://example.com/de/",
      lang: "de",
      alternates: [
        { hreflang: "en", href: "https://example.com/en/" },
        { hreflang: "de", href: "https://example.com/de/" },
      ],
      canonical,
    }),
  ];

  it("requireCanonicalTargets reports non-canonical-target by default", async () => {
    const findings = await hreflangCheck.run(
      context({ pages: buildPages("https://example.com/other/") }),
    );
    expect(findings).toContainEqual(
      expect.objectContaining({ code: "non-canonical-target" }),
    );
  });

  it("requireCanonicalTargets: false silences non-canonical-target", async () => {
    const config = configSchema.parse({
      rules: { hreflang: { requireCanonicalTargets: false } },
    });
    const findings = await hreflangCheck.run(
      context({ pages: buildPages("https://example.com/other/") }, config),
    );
    expect(findings.some((f) => f.code === "non-canonical-target")).toBe(false);
  });

  it("requireXDefault: false does not report missing-x-default", async () => {
    const findings = await hreflangCheck.run(context({ pages: buildPages() }));
    expect(findings.some((f) => f.code === "missing-x-default")).toBe(false);
  });

  it("requireXDefault: true reports missing-x-default for a cluster with no x-default", async () => {
    const config = configSchema.parse({
      rules: { hreflang: { requireXDefault: true } },
    });
    const findings = await hreflangCheck.run(
      context({ pages: buildPages() }, config),
    );
    expect(findings).toContainEqual(
      expect.objectContaining({ code: "missing-x-default" }),
    );
  });
});

describe("hreflang: check toggle", () => {
  it("checks.hreflang: false removes it from the enabled check set", () => {
    const config = configSchema.parse({ checks: { hreflang: false } });
    const enabled = checks.filter((c) => config.checks[c.name]);
    expect(enabled.some((c) => c.name === "hreflang")).toBe(false);
  });

  it("checks.hreflang defaults to true", () => {
    const config = configSchema.parse({});
    expect(config.checks.hreflang).toBe(true);
  });
});
