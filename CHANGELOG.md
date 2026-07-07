# Changelog

All notable changes to this project are documented here.

## [0.3.0] - 2026-07-08

- Add portable, schema-validated baselines with total, existing, new, and resolved finding counts; `--fail-on-new` now gates only new findings matching `ci.failOn`.
- Version the JSON report contract as schema `0.3` while accepting schema-less v0.2 reports as a migration fallback.
- Keep JSON stdout machine-readable by routing configured build and preview logs to stderr.
- Expand Markdown artifacts with baseline sections, severity/check-code grouping, remediation, documentation, and finding classification.
- Add dependency-free SARIF 2.1.0 output for GitHub Code Scanning without fabricated source lines.
- Add complete GitHub Actions summary/artifact examples for baseline and non-baseline rollout.

## [0.2.0] - 2026-07-07

- Recursively crawl and validate bounded, deduplicated sitemap indexes in static and HTTP modes, with child-level error locations.
- Preserve initial and final HTTP response URLs so redirects, canonicals, relative links, and origin checks use the effective URL without flagging normal redirect normalization.
- Detect HTTP sitemap orphans by combining entrypoints, crawl links, sitemap URLs, and `crawl.exclude`.
- Group responsive image variants from `srcset`/`picture`, read basic `sizes` hints, and deduplicate static image findings.
- Add JSON finding baselines with `--baseline` and `--fail-on-new`, improve Markdown artifacts, and document GitHub step summaries.
- Expand `list-checks` with severity and Google-requirement/recommendation/local-heuristic provenance.

## [0.1.3] - 2026-07-07

- Keep excluded and over-limit HTML routes in the static route inventory so links to intentionally non-audited pages are not reported as missing.
- Add a regression test for links from audited pages to excluded routes.

## [0.1.2] - 2026-07-07

- Derive the CLI, report, and crawler user-agent version from `package.json` instead of a hard-coded value.
- Add a regression test that keeps runtime and package versions aligned.

## [0.1.1] - 2026-07-07

- Add tag-driven npm publishing through GitHub Actions and npm Trusted Publishing (OIDC).
- Create a GitHub Release automatically after a successful npm publish.
- Add release documentation and enforce the `v${package.version}` tag contract.
- Improve the npm/GitHub package description, links, badges, and README.
- Ensure `npm pack` always builds the distributable CLI.

## [0.1.0] - 2026-07-07

- Initial public release with static-build and HTTP crawl modes.
- Add eleven technical search-quality checks, typed configuration, console/JSON/Markdown reports, and CI exit codes.
- Validate the tool against `SilesianSolutions/silesiansolutions.com` and `dawidrylko/dawidrylko.com`.

[0.3.0]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/SilesianSolutions/search-quality-kit/releases/tag/v0.1.0
