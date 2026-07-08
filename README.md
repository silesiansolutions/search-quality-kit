# @silesiansolutions/search-quality-kit

[![npm version](https://img.shields.io/npm/v/@silesiansolutions/search-quality-kit.svg)](https://www.npmjs.com/package/@silesiansolutions/search-quality-kit)
[![CI](https://github.com/SilesianSolutions/search-quality-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/SilesianSolutions/search-quality-kit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A framework-agnostic CLI for auditing technical Google Search foundations in local builds and CI. It catches practical crawlability, indexability, metadata, structured-data, linking, accessibility, and performance regressions before deployment.

- [npm package](https://www.npmjs.com/package/@silesiansolutions/search-quality-kit)
- [GitHub repository](https://github.com/SilesianSolutions/search-quality-kit)
- [Check catalog](docs/checks.md)

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

## Commands

```text
search-quality-kit verify [--config file] [--report-only] [--json]
                          [--output report.json]
                          [--baseline report.json --fail-on-new]
search-quality-kit init [--preset name | --detect] [--force]
search-quality-kit list-checks
search-quality-kit list-profiles
search-quality-kit report [report.json] --format markdown|sarif [--output file]
```

- Normal CI mode exits `1` when a configured failing severity is present.
- `--report-only` always exits `0` for baselining.
- `--json` writes machine-readable JSON to stdout; build and preview logs stay on stderr.
- `--baseline <file> --fail-on-new` fails only for findings absent from a prior JSON report.
- `--format markdown --output report.md` creates a review artifact.
- `report report.json --format sarif --output report.sarif` creates a GitHub Code Scanning-compatible artifact.
- CLI/configuration failures exit `2`.

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
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx @silesiansolutions/search-quality-kit verify
```

For rollout guidance and report artifacts, see [docs/ci.md](docs/ci.md).

## Built-in checks

`sitemap`, `robots`, `indexability`, `metadata`, `canonical`, `structuredData`, `openGraph`, `internalLinks`, `renderedHtml`, `accessibility`, and `performanceHints`.

Rules are tied to official areas of [Google Search Central](https://developers.google.com/search/docs/essentials). Project heuristics such as title length, HTML weight, and image size are labeled as heuristics; profile expectations are labeled separately and are not represented as Google requirements or ranking thresholds.

## Add a check

1. Implement `CheckDefinition` under `src/checks/`.
2. Return normalized findings with severity, stable code, remediation, and documentation links.
3. Register it in `src/checks/index.ts` and add its boolean config key.
4. Add offline fixture-based tests and document whether each rule is a Google requirement, recommendation, or local heuristic.

The engine owns crawling and reporting; checks remain pure and reusable. See [docs/philosophy.md](docs/philosophy.md).

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
