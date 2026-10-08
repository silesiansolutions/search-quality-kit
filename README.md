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
- [Product roadmap](docs/roadmap.md)

It checks technical foundations: crawlability, indexability, sitemap and robots rules, metadata, canonicals, JSON-LD, Open Graph, internal links, delivered HTML, basic accessibility, and lightweight performance risks. It does **not** promise rankings, score content quality, call Google APIs, replace Search Console, Rich Results Test, or Lighthouse.

## Quick start

Requires Node.js 24 or newer.

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

Pack options tune placeholder text, contact labels, contact href patterns,
route scope, visible-text thresholds, and reviewed snippet-directive
exceptions. No custom plugin is needed for that.

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
visible as reviewed decisions. The summary counts `errors`, `warnings`, and
`info` leave them out; `suppressedFindings` counts them instead.

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
      - uses: SilesianSolutions/search-quality-kit@v0
        with:
          node-version-file: .nvmrc
          install-command: npm ci
          build-command: npm run build
          config: search-quality.config.ts
          upload-artifact: "true"
          summary: "true"
```

The composite Action runs the CLI installed in the repository and exposes the CLI options instead of replacing them. With `package-manager: npm` and no local install, it falls back to the latest release from npm. It writes JSON/Markdown reports first, then preserves the CLI exit code. Manual CLI workflows remain supported. See [CI usage](docs/ci.md).

Set `mode: portfolio` and `portfolio-config` to upload the complete portfolio report directory and put `portfolio.md` in the workflow summary. Single-site mode remains the default.

## Built-in checks

`sitemap`, `robots`, `indexability`, `metadata`, `canonical`, `structuredData`, `openGraph`, `internalLinks`, `renderedHtml`, `accessibility`, `performanceHints`, `agentReadiness`, `hreflang`, `redirects`, `assets`, and `duplicates`.

Rules are tied to official areas of [Google Search Central](https://developers.google.com/search/docs/essentials). Project heuristics such as title length, HTML weight, and image size are labeled as heuristics. Profile expectations are labeled separately and are not represented as Google requirements or ranking thresholds.

`agentReadiness` checks deterministic agent-readiness signals: llms.txt recommendations and declarative WebMCP annotations. They are aligned with the experimental Lighthouse Agentic Browsing category. Runtime audits such as CLS, the accessibility tree, and imperative WebMCP tools stay with Lighthouse and PageSpeed Insights.

`hreflang` validates international targeting across the whole crawl rather than one page at a time. It covers reciprocity, self-reference, ISO 639-1 and ISO 3166-1 subtags, and alternate targets that redirect, 404, or disagree with their own canonical. A monolingual site produces no findings from it. Every code is `warning` or `info`, so the default gate is unchanged; `rules.hreflang.strict` opts into error severity.

`robots` also audits AI crawler access against a vendored copy of the [ai.robots.txt](https://github.com/ai-robots-txt/ai.robots.txt) roster. It reports which answer engines, training crawlers and user-triggered fetchers robots.txt blocks, and it never says whether a block is right. `duplicates` reports pages with identical main content that do not agree on one canonical. Both are `warning` or `info`.

Every report summary carries `errorFreeUrlRate`: the share of crawled pages without an unsuppressed error finding, rounded down, next to the `urlsWithErrors` count. It is a counting rule, not a score, and the gate does not read it.

In HTTP mode the crawler follows redirects itself and keeps every hop. `redirects` reports chains, loops, redirects that end in an error, and internal links that point at a redirect. `canonical` reports canonical targets that redirect or fail. `assets` reports same-origin images, scripts, and stylesheets that are missing from the build or answer with an error. These new codes are warnings, so the default gate is unchanged on upgrade.

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

Dependencies are deliberately small. Commander carries the CLI contract and Cheerio parses HTML on the server side. fast-xml-parser handles XML syntax, Zod validates config at runtime, Jiti loads TypeScript/JavaScript config, and picocolors keeps terminal output readable. Browser automation and Google APIs are intentionally outside the core package.

## Contributing

Commits and pull request titles follow [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:`, ...). New behavior should follow [the project philosophy](docs/philosophy.md): deterministic, offline, and honestly labeled. The [product roadmap](docs/roadmap.md) records what is planned and what the project will never do. Promoting an item into a release needs a scoped note in [docs/design](docs/design/) first.

Contribution and security policies are shared across the organization and live in [`silesiansolutions/.github`](https://github.com/silesiansolutions/.github). Report vulnerabilities privately through the process described there rather than in a public issue.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Author

Developed and maintained by [Dawid Ryłko](https://dawidrylko.com) at [Silesian Solutions](https://silesiansolutions.com/).
