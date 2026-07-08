# Configuration

The loader discovers `search-quality.config.ts`, `.mts`, `.js`, `.mjs`, `.cjs`, or `.json`. Pass another file with `--config`. Every nested section accepts partial values and receives defaults.

| Section                | Important fields                                                        | Defaults                         |
| ---------------------- | ----------------------------------------------------------------------- | -------------------------------- |
| `site`                 | `baseUrl`, `localUrl`, `stagingHosts`                                   | common local/preview host tokens |
| `build`                | `command`, `startCommand`, `distDir`, `startupTimeoutMs`                | `dist`, 30 seconds               |
| `crawl`                | `mode`, entrypoints, page/sitemap limits, `include`, `exclude`, timeout | `auto`, `/`, 100 pages           |
| `profiles`             | default site type and ordered route overrides                           | `generic`, no route overrides    |
| `checks`               | one boolean per built-in check                                          | all enabled                      |
| `rules.title`          | min/max length, duplicate policy                                        | 10–70, no duplicates             |
| `rules.description`    | min/max, missing and duplicate policy                                   | 50–170, required, no duplicates  |
| `rules.canonical`      | `required`                                                              | true                             |
| `rules.robots`         | `disallowAllInProduction`                                               | false                            |
| `rules.structuredData` | JSON and visible-content switches                                       | syntax validation on             |
| `rules.openGraph`      | `requireImage`                                                          | false                            |
| `rules.renderedHtml`   | main/H1 policy and minimum visible text                                 | main and H1 required, 80 chars   |
| `rules.performance`    | HTML, script, and image thresholds                                      | 500 KiB HTML/image, 10 scripts   |
| `output`               | default format (`console`, `json`, `markdown`, `sarif`) and filenames   | console                          |
| `ci`                   | `failOn`, `warnOnly`                                                    | fail on error                    |

Length and byte thresholds are regression heuristics, not Google ranking limits. Tune them to the project instead of disabling unrelated checks.

Paths in `include`, `exclude`, and `entrypoints` are URL paths. Exclusions apply to sitemap scope and crawling. A deliberate `noindex` page should normally be excluded rather than globally weakening the indexability check.

`crawl.mode` is `auto`, `static`, or `http`. `auto` preserves the original target selection: prefer `site.localUrl`, otherwise use an existing `build.distDir`, otherwise crawl `site.baseUrl`. Official static presets use `static`, so a missing output directory fails clearly instead of silently auditing production. `nextHybrid()` uses `http` and defaults `site.localUrl` to `http://localhost:3000`.

`crawl.maxSitemaps` defaults to 50 and `crawl.maxSitemapDepth` defaults to 3. They bound recursive sitemap-index traversal in both static and HTTP modes. A truncated traversal produces `sitemap/fetch-limit`; raise the limits only when the site intentionally needs a larger sitemap tree.

Baseline behavior is controlled by CLI flags rather than config: use `--baseline <report.json> --fail-on-new`. The gate still reads severity policy from `ci.failOn`, while `ci.warnOnly` and `--report-only` suppress finding-based failure. Report and SARIF output are presentation formats and do not alter finding identity or gate behavior.

## Site and route profiles

Use a factory for the common case, or configure `profiles.default` directly. The two forms produce the same config shape.

```ts
import {
  defineConfig,
  presets,
  profiles,
} from "@silesiansolutions/search-quality-kit";

export default defineConfig({
  ...presets.astro(),
  ...profiles.directory(),
  site: { baseUrl: "https://example.com" },
  profiles: {
    default: "directory",
    routes: [
      {
        pattern: "/entries/**",
        profile: "directoryEntry",
        expectedStructuredData: ["Organization", "BreadcrumbList"],
      },
      {
        pattern: "/blog/**",
        profile: "blogPost",
        expectedStructuredData: ["BreadcrumbList"],
      },
    ],
  },
});
```

Supported default profiles are `generic`, `personal`, `company`, `blog`, `directory`, and `localBusiness`. Route-only profiles are `blogPost`, `directoryEntry`, `directoryList`, and `servicePage`. Routes are evaluated in declaration order; the first matching pattern wins. Patterns are root-relative and support `*` within one path segment and `**` across segments. Invalid or non-root-relative patterns fail config loading.

`expectedStructuredData` is additive to the selected profile. Missing expected markup is a warning classified as `profile-expectation`; it does not become a Google requirement. Full behavior and safe suppression guidance live in [structured data profiles](structured-data-profiles.md).

## Framework presets

Presets return small `SearchQualityConfigInput` objects. They do not execute a build, start a process, install an integration, or inspect framework internals.

| API                       | CLI name         | Output / mode           | Narrow framework behavior                                                 |
| ------------------------- | ---------------- | ----------------------- | ------------------------------------------------------------------------- |
| `presets.astro()`         | `astro`          | `dist`, static          | Conventional generated 404 aliases; sitemap indexes work in core.         |
| `presets.nextStatic()`    | `next-static`    | `out`, static           | Requires Next.js `output: "export"`; `.next` is not static export output. |
| `presets.nextHybrid()`    | `next-hybrid`    | `.next`, HTTP localhost | Crawls `http://localhost:3000`; `.next` is not crawled in HTTP mode.      |
| `presets.gatsby()`        | `gatsby`         | `public`, static        | Excludes Gatsby's dev 404 and offline app-shell fallback routes.          |
| `presets.viteSpa()`       | `vite-spa`       | `dist`, static          | Audits delivered HTML; JavaScript is not executed.                        |
| `presets.genericStatic()` | `generic-static` | `dist`, static          | Neutral plain HTML/static-generator defaults.                             |

Common exclusions are limited to `/admin`, `/preview`, `/api`, `/404`, and `/404.html`. Asset directories do not need route exclusions: static crawling only treats HTML as pages while retaining other files as assets for link and size checks.

```ts
import { defineConfig, presets } from "@silesiansolutions/search-quality-kit";

const preset = presets.astro();

export default defineConfig({
  ...preset,
  site: { baseUrl: "https://example.com" },
  crawl: {
    ...preset.crawl,
    maxPages: 300,
    exclude: [...(preset.crawl?.exclude ?? []), "/intentional-noindex"],
  },
});
```

Object spread is shallow. Preserve `preset.crawl`, `preset.site`, or `preset.build` when overriding fields in those sections. Do not exclude legal or account pages merely because of their names; exclude only routes whose non-indexable status is intentional and reviewed.

Generate the same shape with `search-quality-kit init --preset <name>`. `--detect` reads `package.json` and, for Next static export, `next.config.*`. Detection deliberately stops when the framework or Next rendering mode is ambiguous.

Hugo uses the neutral preset with its conventional output override: start from `generic-static`, set `build.distDir` to `public`, and keep `crawl.mode: "static"`. There is no separate Hugo preset because the current architecture needs no Hugo-specific exclusions or crawler behavior.

## Validation errors

Configuration failures exit `2` and identify the field plus a fix. `site.baseUrl` is required by the CLI even for a local static build because reports and canonical checks need the production origin. Static mode requires `build.distDir` to exist after any configured build. `build.startCommand` requires `site.localUrl`; `site.localUrl` conflicts with `crawl.mode: "static"`; and excluding `/` is rejected because it removes the whole audit scope.
