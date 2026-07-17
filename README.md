# @silesiansolutions/search-quality-kit

[![npm version](https://img.shields.io/npm/v/@silesiansolutions/search-quality-kit.svg)](https://www.npmjs.com/package/@silesiansolutions/search-quality-kit)
[![CI](https://github.com/SilesianSolutions/search-quality-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/SilesianSolutions/search-quality-kit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A framework-agnostic CLI for auditing technical Google Search foundations in local builds and CI. It catches practical crawlability, indexability, metadata, structured-data, linking, accessibility, and performance regressions before deployment.

- [npm package](https://www.npmjs.com/package/@silesiansolutions/search-quality-kit)
- [GitHub repository](https://github.com/SilesianSolutions/search-quality-kit)
- [Check catalog](docs/checks.md)
- [Custom plugins](docs/plugins.md)
- [Search quality contracts](docs/contracts.md)
- [CI and rollout](docs/ci.md)
- [Public portfolio showcase](docs/showcase.md)

It checks technical foundations: crawlability, indexability, sitemap and robots rules, metadata, canonicals, JSON-LD, Open Graph, internal links, delivered HTML, basic accessibility, and lightweight performance risks. It does **not** promise rankings, score content quality, call Google APIs, replace Search Console, Rich Results Test, or Lighthouse.

## Quick start

Requires Node.js 20.11 or newer.

```bash
npm install --save-dev @silesiansolutions/search-quality-kit
npx search-quality-kit init --preset astro
# Replace the TODO baseUrl, then build the site.
npx @silesiansolutions/search-quality-kit verify --report-only
npx @silesiansolutions/search-quality-kit verify
```

For reproducible CI, pin `@silesiansolutions/search-quality-kit` in `devDependencies`.

## Configuration

`search-quality.config.ts`:

```ts
import {
  defineConfig,
  presets,
  profiles,
} from "@silesiansolutions/search-quality-kit";

export default defineConfig({
  ...presets.astro(),
  ...profiles.companySite(),
  site: {
    baseUrl: "https://example.com",
  },
});
```

Official presets are `astro`, `nextStatic`, `nextHybrid`, `gatsby`, `viteSpa`, and `genericStatic`. They select a safe output directory, crawl mode, and narrow generated-route exclusions. They never run a build or start a server. Add `build.command` or `build.startCommand` only when that automation is intentional.

Site profiles add contextual, warning-level expectations for `personal`, `company`, `blog`, `directory`, and `localBusiness` sites. Route overrides can model article, listing, entry, and service pages without changing hard technical checks. See [structured data profiles](docs/structured-data-profiles.md).

`init --detect` recognizes unambiguous Astro, Gatsby, Vite SPA, and Next static-export projects. It refuses to guess between Next static and hybrid modes. See the [preset reference](docs/config.md) and [rollout guide](docs/rollout.md).

See [Getting started](docs/getting-started.md), [configuration](docs/config.md), and the [complete check catalog](docs/checks.md).
The v0.1 behavior was also exercised against two production repositories; see the [real-world validation report](docs/real-world-validation.md).

## Policy packs

Policy packs are ready-to-use plugin factories for common public-site rollout
checks:

```ts
import {
  defineConfig,
  policyPacks,
  presets,
  profiles,
} from "@silesiansolutions/search-quality-kit";

export default defineConfig({
  ...presets.astro(),
  ...profiles.companySite(),
  site: { baseUrl: "https://example.com" },
  plugins: [policyPacks.companySite(), policyPacks.aiVisibilitySafe()],
});
```

Available packs are `personalBrand`, `companySite`, `directory`, and
`aiVisibilitySafe`. They are deterministic plugins: no Google APIs, no browser
automation, no content scoring, and no private contact-data requirements. See
[policy packs](docs/policy-packs.md) and [plugin testing](docs/testing-plugins.md).

Pack options let real repositories tune placeholder text, contact labels,
contact href patterns, route scope, visible-text thresholds, and reviewed
snippet-directive exceptions without writing a custom plugin.

## Reviewed suppressions

Use reviewed suppressions for accepted findings that should stay visible in
reports but should not fail the gate:

```ts
export default defineConfig({
  site: { baseUrl: "https://example.com" },
  suppressions: [
    {
      code: "company-site.contact-link",
      urlPattern: "/services/legacy/**",
      reason:
        "Legacy service pages use the global footer contact CTA instead of a page-level CTA.",
      owner: "growth",
      expires: "2026-12-31",
    },
  ],
});
```

Suppressions require a stable finding code, narrow route pattern, reason, and
owner. Expired suppressions stop affecting the gate. Broad suppression patterns
are rejected unless `allowBroadSuppressions` is enabled intentionally. JSON,
Markdown, portfolio, handoff, and contract outputs keep suppressed findings
visible as reviewed decisions.

## Commands

```text
search-quality-kit verify [--config file] [--report-only] [--json]
                          [--output report.json]
                          [--baseline report.json --fail-on-new]
search-quality-kit doctor [--config file] [--baseline report.json]
search-quality-kit doctor --portfolio-config portfolio.search-quality.config.ts
search-quality-kit contract [--config file | --portfolio-config file]
                            [--format json|markdown] [--output file]
search-quality-kit init [--preset name | --detect] [--force]
search-quality-kit list-checks
search-quality-kit list-profiles
search-quality-kit report [report.json] --format markdown|handoff|sarif [--output file]
search-quality-kit portfolio verify --config portfolio.search-quality.config.ts
search-quality-kit portfolio baseline --config portfolio.search-quality.config.ts [--force]
```

- Normal CI mode exits `1` when a configured failing severity is present.
- `--report-only` always exits `0` for baselining.
- `--json` writes machine-readable JSON to stdout; build and preview logs stay on stderr.
- `--baseline <file> --fail-on-new` fails only for findings absent from a prior JSON report.
- `--format markdown --output report.md` creates a review artifact.
- `--format handoff --output handoff.md` creates a bounded action list for developers, site owners, and coding agents.
- `report report.json --format sarif --output report.sarif` creates a GitHub Code Scanning-compatible artifact.
- `doctor` checks config loading, local setup, baselines, output paths, Node engines, and portfolio manifests without running an audit.
- `contract` exports validated site or portfolio policy without running a build or crawl; see [search quality contracts](docs/contracts.md).
- CLI/configuration failures exit `2`.

Run `doctor` before the first audit in a repository, after changing baselines or
portfolio manifests, and before CI debugging:

```bash
search-quality-kit doctor --config search-quality.config.ts
search-quality-kit doctor \
  --portfolio-config portfolio.search-quality.config.ts
```

## Portfolio runner

Run several existing site configs sequentially and produce isolated site reports plus one stable `portfolio.json`, one bounded `portfolio.md`, and one final gate:

```bash
search-quality-kit portfolio verify \
  --config examples/showcase/portfolio.search-quality.config.ts \
  --report-only \
  --output-dir search-quality-reports
```

Each site may define its own root, config, baseline, and output directory. Baselines are compared only within that site; missing/invalid configured baselines and plugin/config/runtime failures are attributed as operational errors. Portfolio summaries aggregate reviewed suppressions per site. See [portfolio configuration](docs/config.md#portfolio-configuration), [CI usage](docs/ci.md#portfolio-action-mode), and the [public showcase](docs/showcase.md).

For a legacy rollout, record the reviewed state and gate only regressions:

```bash
search-quality-kit verify --report-only --json > search-quality-baseline.json
search-quality-kit verify --baseline search-quality-baseline.json --fail-on-new
```

## GitHub Actions

```yaml
name: Search Quality
on:
  pull_request:
  push:
    branches: [main]

jobs:
  search-quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: SilesianSolutions/search-quality-kit/action@v0
        with:
          node-version-file: .nvmrc
          install-command: npm ci
          build-command: npm run build
          config: search-quality.config.ts
          upload-artifact: "true"
          summary: "true"
```

The composite Action calls the repository's pinned local CLI, exposes the CLI options instead of replacing them, and preserves its exit code after writing JSON/Markdown reports. Manual CLI workflows remain supported. See [CI usage](docs/ci.md).

Set `mode: portfolio` and `portfolio-config` to upload the complete portfolio report directory and put `portfolio.md` in the workflow summary. Single-site mode remains the default.

## Built-in checks

`sitemap`, `robots`, `indexability`, `metadata`, `canonical`, `structuredData`, `openGraph`, `internalLinks`, `renderedHtml`, `accessibility`, `performanceHints`, and `agentReadiness`.

Rules are tied to official areas of [Google Search Central](https://developers.google.com/search/docs/essentials). Project heuristics such as title length, HTML weight, and image size are labeled as heuristics; profile expectations are labeled separately and are not represented as Google requirements or ranking thresholds. `agentReadiness` checks deterministic agent-readiness signals — llms.txt recommendations and declarative WebMCP annotations — aligned with the experimental Lighthouse Agentic Browsing category; runtime audits such as CLS, the accessibility tree, and imperative WebMCP tools stay with Lighthouse and PageSpeed Insights.

## Custom checks

Use `defineCheck` and `definePlugin` to add deterministic project rules without forking core. Plugins receive a frozen, documented page/config snapshot and return normal findings that participate in JSON, Markdown, SARIF, baseline comparison, and `ci.failOn`.

```ts
import { defineCheck } from "@silesiansolutions/search-quality-kit";

const noPlaceholderCopy = defineCheck({
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
              remediation: "Replace placeholder copy before deployment.",
            },
          ]
        : [],
    ),
});
```

See [custom checks and plugins](docs/plugins.md) and the [`examples/plugins/`](examples/plugins/) package-ready example. Contributors adding built-in behavior should still follow [the project philosophy](docs/philosophy.md).

## Releases

Version tags are published to npm through GitHub Actions using short-lived OIDC credentials. A successful npm publish is followed by an automatically generated GitHub Release. Maintainer instructions are in [docs/releasing.md](docs/releasing.md).

See [CHANGELOG.md](CHANGELOG.md) for release history.

## Development

```bash
npm install
npm run check
npm pack --dry-run
```

Dependencies are deliberately small: Commander for the CLI contract, Cheerio for server-side HTML parsing, fast-xml-parser for XML syntax, Zod for runtime config validation, Jiti for TypeScript/JavaScript config loading, and picocolors for readable terminal output. Browser automation and Google APIs are intentionally outside the core package.

MIT © Silesian Solutions
