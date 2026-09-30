import { afterEach, describe, expect, it, vi } from "vitest";
import { assetsCheck } from "../src/checks/assets.js";
import { canonicalCheck } from "../src/checks/canonical.js";
import { hreflangCheck } from "../src/checks/hreflang.js";
import { indexabilityCheck } from "../src/checks/indexability.js";
import { internalLinksCheck } from "../src/checks/internalLinks.js";
import { metadataCheck } from "../src/checks/metadata.js";
import { redirectsCheck } from "../src/checks/redirects.js";
import { robotsAllows, robotsCheck } from "../src/checks/robots.js";
import { sitemapCheck } from "../src/checks/sitemap.js";
import { configSchema } from "../src/config/schema.js";
import { crawlHttp } from "../src/crawler/crawlSite.js";
import type { PageArtifact } from "../src/crawler/types.js";
import { codeAliases } from "../src/findingCodes.js";
import { findingFingerprint } from "../src/report/baseline.js";
import type { Finding } from "../src/report/types.js";
import {
  applyReviewedSuppressions,
  unmatchedSuppressions,
} from "../src/suppressions.js";
import { context } from "./helpers.js";

type Route =
  | { status: number; body?: string; headers?: Record<string, string> }
  | { error: unknown };

function stubFetch(routes: Record<string, Route>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: string) => {
    const url = new URL(input);
    calls.push(`${url.pathname}${url.search}`);
    const route = routes[`${url.pathname}${url.search}`] ?? { status: 404 };
    if ("error" in route) throw route.error;
    return new Response(route.body ?? "", {
      status: route.status,
      headers: { "content-type": "text/html", ...route.headers },
    });
  });
  return calls;
}

const html = (body: string, head = "") =>
  `<html lang="en"><head><title>Page title here</title>${head}</head><body>${body}</body></html>`;

const httpConfig = (overrides: Record<string, unknown> = {}) =>
  configSchema.parse({
    site: { baseUrl: "https://example.com" },
    crawl: { mode: "http", ...overrides },
  });

const codes = (findings: Finding[]) =>
  findings.map((f) => `${f.check}.${f.code}`).sort();

const page = (url: string, body: string, extra: Partial<PageArtifact> = {}) =>
  ({
    initialUrl: url,
    finalUrl: url,
    url,
    requestUrl: url,
    status: 200,
    html: body,
    headers: {},
    bytes: body.length,
    ...extra,
  }) satisfies PageArtifact;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HTTP crawl redirect rework", () => {
  it("records every hop and reports chains, links to redirects, and redirected canonicals", async () => {
    stubFetch({
      "/": { status: 301, headers: { location: "/a" } },
      "/a": { status: 301, headers: { location: "https://example.com/b" } },
      "/b": {
        status: 200,
        body: html(
          '<a href="/a">Old</a><a href="/b">Self</a>',
          '<link rel="canonical" href="https://example.com/a">',
        ),
      },
    });
    const config = httpConfig();
    const crawl = await crawlHttp("https://example.com", config);
    const [home] = crawl.pages;
    expect(home?.finalUrl).toBe("https://example.com/b");
    expect(home?.redirects?.map((hop) => [hop.url, hop.status])).toEqual([
      ["https://example.com/", 301],
      ["https://example.com/a", 301],
    ]);
    expect(crawl.pages).toHaveLength(1);
    const redirects = await redirectsCheck.run({ config, crawl });
    expect(codes(redirects)).toEqual([
      "redirects.chain",
      "redirects.internal-link-to-redirect",
    ]);
    expect(redirects.find((f) => f.code === "chain")?.url).toBe(
      "https://example.com/",
    );
    const canonical = await canonicalCheck.run({ config, crawl });
    expect(codes(canonical)).toContain("canonical.target-redirect");
  });

  it("does not mistake a trailing-slash redirect for a loop", async () => {
    stubFetch({
      "/section": { status: 308, headers: { location: "/section/" } },
      "/section/": { status: 200, body: html("") },
    });
    const crawl = await crawlHttp(
      "https://example.com",
      httpConfig({ entrypoints: ["/section"] }),
    );
    expect(crawl.pages[0]?.status).toBe(200);
    expect(crawl.pages[0]?.failure).toBeUndefined();
    expect(crawl.pages[0]?.redirects).toHaveLength(1);
  });

  it("reports loops and hop limits as unreachable pages with redirect findings", async () => {
    stubFetch({
      "/": { status: 302, headers: { location: "/x" } },
      "/x": { status: 302, headers: { location: "/" } },
      "/far": { status: 301, headers: { location: "/far1" } },
      "/far1": { status: 301, headers: { location: "/far2" } },
      "/far2": { status: 301, headers: { location: "/far3" } },
    });
    const config = httpConfig({ entrypoints: ["/", "/far"], maxRedirects: 2 });
    const crawl = await crawlHttp("https://example.com", config);
    expect(crawl.pages.map((p) => p.failure)).toEqual([
      "redirect-loop",
      "too-many-redirects",
    ]);
    expect(codes(await redirectsCheck.run({ config, crawl }))).toEqual([
      "redirects.broken",
      "redirects.loop",
    ]);
    expect(codes(await indexabilityCheck.run({ config, crawl }))).toEqual([
      "indexability.unreachable",
      "indexability.unreachable",
    ]);
  });

  it("splits non-200 pages by status class and failure kind", async () => {
    const dnsError = new TypeError("fetch failed", {
      cause: Object.assign(new Error("getaddrinfo"), { code: "ENOTFOUND" }),
    });
    const abortError = new DOMException("aborted", "AbortError");
    stubFetch({
      "/": {
        status: 200,
        body: html(
          '<a href="/gone">a</a><a href="/down">b</a><a href="/dns">c</a><a href="/slow">d</a>',
        ),
      },
      "/gone": { status: 404 },
      "/down": { status: 503 },
      "/dns": { error: dnsError },
      "/slow": { error: abortError },
    });
    const config = httpConfig();
    const crawl = await crawlHttp("https://example.com", config);
    const findings = await indexabilityCheck.run({ config, crawl });
    expect(codes(findings)).toEqual([
      "indexability.4xx",
      "indexability.5xx",
      "indexability.timeout",
      "indexability.unreachable",
    ]);
    expect(findings.map((f) => f.message).sort()).toEqual([
      "Page returned HTTP 404.",
      "Page returned HTTP 503.",
      "Page returned HTTP network failure.",
      "Page returned HTTP network failure.",
    ]);
    expect(findings.find((f) => f.code === "unreachable")?.suggestion).toMatch(
      /DNS/,
    );
  });

  it("requests same-origin resources and reports broken ones once per resource", async () => {
    const calls = stubFetch({
      "/": {
        status: 200,
        body: html(
          '<img src="/missing.png" alt=""><img src="https://cdn.example.net/x.png" alt=""><script src="/app.js"></script><link rel="stylesheet" href="/gone.css"><a href="/two">Two</a>',
        ),
      },
      "/two": { status: 200, body: html('<img src="/missing.png" alt="">') },
      "/app.js": { status: 200, body: "" },
    });
    const config = httpConfig();
    const crawl = await crawlHttp("https://example.com", config);
    expect(calls).not.toContain("/x.png");
    const findings = await assetsCheck.run({ config, crawl });
    expect(codes(findings)).toEqual([
      "assets.broken-image",
      "assets.broken-stylesheet",
    ]);
    expect(findings.find((f) => f.code === "broken-image")?.message).toMatch(
      /2 pages/,
    );
  });

  it("skips resource requests when the assets check is disabled", async () => {
    const calls = stubFetch({
      "/": { status: 200, body: html('<img src="/a.png" alt="">') },
    });
    const config = configSchema.parse({
      site: { baseUrl: "https://example.com" },
      crawl: { mode: "http" },
      checks: { assets: false },
    });
    const crawl = await crawlHttp("https://example.com", config);
    expect(calls).not.toContain("/a.png");
    expect(crawl.resources).toBeUndefined();
  });
});

describe("finding code aliases", () => {
  const base: Finding = {
    severity: "error",
    check: "indexability",
    code: "non-200",
    message: "Page returned HTTP 404.",
    suggestion: "Serve indexable pages with HTTP 200.",
    url: "https://example.com/gone",
    docs: "https://example.com/docs",
  };

  it("keeps every alias inside its own check namespace", () => {
    for (const [code, legacy] of Object.entries(codeAliases))
      expect(code.split(".")[0]).toBe(legacy.split(".")[0]);
  });

  it("fingerprints a split indexability finding like its legacy code", () => {
    expect(findingFingerprint({ ...base, code: "4xx" })).toBe(
      findingFingerprint(base),
    );
    expect(findingFingerprint({ ...base, code: "noindex" })).not.toBe(
      findingFingerprint(base),
    );
  });

  it("lets a legacy suppression match the renamed code and reports unused ones", () => {
    const config = configSchema.parse({
      site: { baseUrl: "https://example.com" },
      suppressions: [
        {
          code: "indexability.non-200",
          urlPattern: "/gone",
          reason: "Retired page.",
          owner: "site-owner",
        },
        {
          code: "metadata.title-length",
          urlPattern: "/legal/**",
          reason: "Short legal titles.",
          owner: "site-owner",
        },
      ],
    });
    const findings = [{ ...base, code: "4xx" }];
    expect(applyReviewedSuppressions(findings, config)[0]?.suppressed).toBe(
      true,
    );
    expect(unmatchedSuppressions(findings, config).map((s) => s.code)).toEqual([
      "metadata.title-length",
    ]);
  });
});

describe("robots rule matching", () => {
  it("applies longest-match precedence with allow winning ties", () => {
    const rules = [
      { allow: false, path: "/private" },
      { allow: true, path: "/private/public" },
      { allow: false, path: "/*.pdf$" },
      { allow: true, path: "/tie" },
      { allow: false, path: "/tie" },
    ];
    expect(robotsAllows(rules, "/private/x")).toBe(false);
    expect(robotsAllows(rules, "/private/public/x")).toBe(true);
    expect(robotsAllows(rules, "/docs/a.pdf")).toBe(false);
    expect(robotsAllows(rules, "/docs/a.pdf?x=1")).toBe(true);
    expect(robotsAllows(rules, "/tie")).toBe(true);
    expect(robotsAllows(rules, "/open")).toBe(true);
  });

  it("reports indexable and sitemap URLs blocked for Googlebot", async () => {
    const { config, crawl } = context({
      robots: {
        url: "https://example.com/robots.txt",
        status: 200,
        content:
          "User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nDisallow: /drafts\nSitemap: https://example.com/sitemap.xml",
      },
      pages: [
        page("https://example.com/drafts/a", html("")),
        page(
          "https://example.com/drafts/hidden",
          html("", '<meta name="robots" content="noindex">'),
        ),
        page("https://example.com/", html("")),
      ],
      sitemapUrls: ["https://example.com/drafts/b"],
    });
    const found = (await robotsCheck.run({ config, crawl })).filter((f) =>
      f.code.endsWith("-blocked"),
    );
    expect(found.map((f) => [f.code, f.url])).toEqual([
      ["indexable-url-blocked", "https://example.com/drafts/a"],
      ["sitemap-url-blocked", "https://example.com/drafts/b"],
    ]);
  });

  it("does not repeat a site-wide block per URL", async () => {
    const { config, crawl } = context({
      robots: {
        url: "https://example.com/robots.txt",
        status: 200,
        content: "User-agent: *\nDisallow: /",
      },
      pages: [page("https://example.com/a", html(""))],
    });
    const found = await robotsCheck.run({ config, crawl });
    expect(found.some((f) => f.code.endsWith("-blocked"))).toBe(false);
  });

  it("reports a server error on robots.txt as unavailable", async () => {
    const { config, crawl } = context({
      mode: "http",
      robots: { url: "https://example.com/robots.txt", status: 503 },
    });
    expect(codes(await robotsCheck.run({ config, crawl }))).toEqual([
      "robots.unavailable",
    ]);
  });
});

describe("v0.12 page checks", () => {
  it("reports duplicate titles and descriptions and invalid html lang", async () => {
    const { config, crawl } = context({
      pages: [
        page(
          "https://example.com/a",
          '<html lang="xx"><head><title>First title here</title><title>Second</title><meta name="description" content="a"><meta name="description" content="b"></head></html>',
        ),
        page(
          "https://example.com/b",
          '<html lang="fil"><head><title>Filipino page title</title></head></html>',
        ),
        page(
          "https://example.com/c",
          '<html lang="de-CH-1996"><head><title>Swiss German page</title></head></html>',
        ),
        page(
          "https://example.com/d",
          '<html lang="en-QQ"><head><title>Unknown region page</title></head></html>',
        ),
      ],
    });
    const found = (await metadataCheck.run({ config, crawl })).filter((f) =>
      ["multiple-titles", "multiple-descriptions", "invalid-lang"].includes(
        f.code,
      ),
    );
    expect(found.map((f) => [f.code, f.url])).toEqual([
      ["multiple-titles", "https://example.com/a"],
      ["multiple-descriptions", "https://example.com/a"],
      ["invalid-lang", "https://example.com/a"],
      ["invalid-lang", "https://example.com/d"],
    ]);
  });

  it("reports https-to-http links and pages without internal links", async () => {
    const { config, crawl } = context({
      pages: [
        page(
          "https://example.com/",
          html('<a href="http://example.com/b">Insecure</a>'),
        ),
        page("https://example.com/b", html('<a href="/">Home</a>')),
      ],
    });
    const found = (await internalLinksCheck.run({ config, crawl })).filter(
      (f) => ["https-to-http", "no-outgoing-links"].includes(f.code),
    );
    expect(found.map((f) => [f.code, f.url, f.severity])).toEqual([
      ["https-to-http", "https://example.com/", "warning"],
      ["no-outgoing-links", "https://example.com/", "info"],
    ]);
  });

  it("reports sitemap URLs that are marked noindex", async () => {
    const sitemap = {
      url: "https://example.com/sitemap.xml",
      status: 200,
      content:
        '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/a</loc></url><url><loc>https://example.com/b</loc></url></urlset>',
    };
    const { config, crawl } = context({
      sitemap,
      sitemaps: [sitemap],
      pages: [
        page(
          "https://example.com/a",
          html("", '<meta name="robots" content="noindex, follow">'),
        ),
        page("https://example.com/b", html("")),
      ],
    });
    const found = (await sitemapCheck.run({ config, crawl })).filter(
      (f) => f.code === "url-noindex",
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain("https://example.com/a");
  });

  it("reads hreflang from sitemap alternates when HTML declares none", async () => {
    const alternates = (self: string) =>
      `<url><loc>https://example.com/${self}</loc><xhtml:link rel="alternate" hreflang="en" href="https://example.com/en"/><xhtml:link rel="alternate" hreflang="pl" href="https://example.com/pl"/></url>`;
    const content = (entries: string) =>
      `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries}</urlset>`;
    const run = async (entries: string) => {
      const sitemap = {
        url: "https://example.com/sitemap.xml",
        status: 200,
        content: content(entries),
      };
      const { config, crawl } = context({
        sitemap,
        sitemaps: [sitemap],
        pages: [
          page("https://example.com/en", html("")),
          page(
            "https://example.com/pl",
            html("").replace('lang="en"', 'lang="pl"'),
          ),
        ],
      });
      return codes(await hreflangCheck.run({ config, crawl }));
    };
    expect(await run(alternates("en") + alternates("pl"))).toEqual([]);
    expect(
      await run(
        alternates("en") + "<url><loc>https://example.com/pl</loc></url>",
      ),
    ).toEqual(["hreflang.missing-reciprocal"]);
  });

  it("reports static resources absent from the build", async () => {
    const { config, crawl } = context({
      pages: [
        page(
          "https://example.com/",
          html(
            '<img src="/present.png?v=2" alt=""><img src="/absent.png" alt=""><script src="https://cdn.example.net/x.js"></script>',
          ),
        ),
      ],
      assets: new Map([
        [
          "https://example.com/present.png",
          { url: "https://example.com/present.png" },
        ],
      ]),
    });
    const found = await assetsCheck.run({ config, crawl });
    expect(codes(found)).toEqual(["assets.missing-static-asset"]);
    expect(found[0]?.relatedUrls).toEqual(["https://example.com/absent.png"]);
  });
});
