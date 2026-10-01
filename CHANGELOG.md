# Changelog

All notable changes to this project are documented here.

## [Unreleased]

- Ignore the query string when a static crawl resolves an internal link. Links such as `/category/nis2?page=2` or `./contact?source=home` were reported as `internal-links.missing-static-route` although the file exists. They also did not count as incoming links, so a page reached only through them could get `internal-links.orphan-page`. Both lookups now drop the query, as `assets.missing-static-asset` already did. HTTP crawls are unchanged. Messages are unchanged, so baselines keep matching.
- Require Node.js 24 or newer. `engines.node` moves from `>=20.11` to `>=24`. The old floor was already wrong: `commander` 15 (since 0.11.3) needs Node 22.12, and `doctor` reported Node 20 as supported. On Node 22 the CLI still starts, the package manager warns about the unsupported engine and `doctor` exits with an error.
- The GitHub Action defaults `node-version` to `"24"`. The default also sets the Node that runs `install-command` and `build-command`. A workflow that passes `node-version` or `node-version-file` keeps its own version, so a pin to 22 must move to 24. The CI workflows, the `docs/ci.md` snippets and the files in `examples/ci/` use Node 24.
- Correct the docs for the Action's `package-manager` input. `docs/ci.md` still described `npx --no-install`, which 0.11.1 replaced with `npx --yes @silesiansolutions/search-quality-kit`. With npm and no local install, the Action runs the latest release from npm. The README and the input description say so too.

## [0.13.0] - 2026-10-01

- Audit AI crawler access in the `robots` check. robots.txt rules are evaluated per agent against a vendored copy of the ai.robots.txt roster (180 agents, MIT, pinned commit `987266f`). Twelve tokens documented by their operators carry a category: answer engine, training crawler or user-triggered fetcher. New codes: `robots.ai-search-blocked` (warning) and `robots.ai-crawler-blocked` (info), classified `local-heuristic`. An unnamed token that follows `*` is evaluated only when Googlebot has its own group, so one `*` rule does not repeat as a dozen findings. Roster text stays out of the message, so a roster update does not reopen baselined findings. The kit reports the consequence of a block and never rates the policy.
- Add `robots.named-group-ignores-wildcard` (info): a named `User-agent` group that does not repeat the Disallow rules of `*`, so that agent may fetch paths `*` blocks. A repeated rule counts by exact pattern, and an allow list after a root block is not reported.
- Add `rules.robots.aiCrawlers.blockedByPolicy` to declare intended AI blocks once instead of renewing suppressions.
- Add a default-on `duplicates` check: `duplicates.exact-without-canonical` and `duplicates.conflicting-canonicals` (both warning) for pages with identical normalized main text. Identical documents only, with no similarity threshold. Pages below `rules.renderedHtml.minTextLength` and regional variants linked by reciprocal hreflang are excluded.
- Add `urlsWithErrors` and `errorFreeUrlRate` to the report summary, the console and Markdown summaries, and the portfolio report. The rate is rounded down, so 100 means no audited page carries an unsuppressed error. The portfolio rate comes from summed counts, and the per-site Markdown table gains an "Error-free" column. The gate does not read the rate.
- Every new code is `warning` or `info`, so the default `ci.failOn: ["error"]` gate is unchanged. The contract schema moves to `0.13` for `checks.duplicates` and `rules.robots.aiCrawlers`. The JSON report schema stays `0.3` and the portfolio schema stays `0.7`, because the new fields are optional.
- Ship `THIRD_PARTY_NOTICES.md` with the package for the roster license. `scripts/update-ai-roster.mjs` refreshes the roster in minor releases.
- Add tests for a rate-limited robots.txt (`robots.unavailable`) and for deprecated but registered language subtags (`iw`, `in`), which `metadata.invalid-lang` accepts. Record the 0.12 crawler decisions in `docs/design/crawler-rework.md`.

## [0.12.0] - 2026-10-01

- Follow redirects in the crawler instead of delegating to `fetch`, and keep every hop. A failed request now records why it failed: timeout, DNS, refused connection, TLS, redirect loop, a chain longer than the new `crawl.maxRedirects` (default 10), or an unclassified network error.
- Add a default-on `redirects` check for HTTP crawls: `redirects.chain`, `redirects.loop`, `redirects.broken` and `redirects.internal-link-to-redirect`.
- Add a default-on `assets` check: `assets.missing-static-asset` in static mode, and `assets.broken-image`, `assets.broken-script` and `assets.broken-stylesheet` in HTTP mode. It sends one request per unique same-origin resource, bounded by the new `crawl.maxResources` (default 500). `checks.assets: false` skips the requests.
- Validate canonical targets in HTTP mode against responses the crawl already has: `canonical.target-redirect`, `canonical.target-4xx`, `canonical.target-5xx` and `canonical.target-unreachable`.
- Match crawled and sitemap URLs against the robots.txt rules that apply to Googlebot: `robots.indexable-url-blocked` and `robots.sitemap-url-blocked`. A 5xx, 429 or unreachable robots.txt is reported as `robots.unavailable` instead of `robots.missing`. Suppressions for `robots.missing` still match it; a baseline entry for that case reappears once, because the message had to change.
- Split `indexability.non-200` into `indexability.4xx`, `indexability.5xx`, `indexability.timeout` and `indexability.unreachable`. Messages are unchanged and a new `codeAliases` table maps each new code to the old one, so existing baselines and suppressions keep matching. SARIF alerts for these codes close and reopen once under the new rule ids.
- Add `sitemap.url-noindex`, `metadata.multiple-titles`, `metadata.multiple-descriptions`, `metadata.invalid-lang`, `internal-links.https-to-http` and `internal-links.no-outgoing-links`.
- Read hreflang alternates from sitemap `xhtml:link` entries for URLs whose HTML declares none.
- Report reviewed suppressions that matched no finding as `unmatchedSuppressions` in the JSON report and in their own console and Markdown section. They never affect the gate.
- Every new code is `warning` or `info`, so the default `ci.failOn: ["error"]` gate is unchanged on upgrade. The contract schema moves to `0.12` for `crawl.maxRedirects`, `crawl.maxResources` and the two new checks; the JSON report schema stays `0.3`.
- Refresh dependencies within their majors, patch the transitive `brace-expansion` advisory, and move the pinned `esbuild` override to 0.28.2. TypeScript stays on 6, because typescript-eslint does not support TypeScript 7 yet.

## [0.11.3] - 2026-09-02

- Refresh the runtime dependencies: `commander` 15.0.0, `zod` 4.5.2 and `fast-xml-parser` 5.11.1. The CLI surface, the config schema and the JSON report contract are unchanged.
- Pin the transitive `nanoid` to 3.3.18 in the lockfile after GHSA-2v37-7h3g-55p8 (high, reached through `postcss` under Vitest). `npm audit --audit-level=high` is clean again, and the scheduled `audit` job with it.
- Move the development toolchain to TypeScript 6.0.3, ESLint 10 with typescript-eslint 8.68 and Vitest 4, and drop `baseUrl` from `tsconfig.json` ahead of its removal in TypeScript 7. The only source change comes from the new lint rules: a failing `build.command` now rethrows with the original error attached as `cause`, with the same message as before.
- Group Dependabot version updates into one pull request per ecosystem with a seven-day cooldown. Keep both Action metadata files in one Action bump, and let the composite-action test follow Action bumps without a hand-edited version list.

## [0.11.2] - 2026-08-10

- Fix `internal-links.missing-static-route` reporting every extensionless link to flat HTML output as a broken route. The static route inventory registered `tags/ai.html` as `/tags/ai.html` and as a directory-index form, but never as `/tags/ai`. Generators that emit flat files (Quartz, SvelteKit's static adapter, Hugo with ugly URLs) therefore produced one error per internal link. A real site measured 2878 of them, all false. The inventory now also registers the extensionless form.

## [0.11.1] - 2026-08-10

- Fix the composite Action failing in any repository that does not already depend on the package. It invoked `npx --no-install search-quality-kit`, which names the bin rather than the package, and modern npm ignores `--no-install`. So npx fell through to the registry, looked up a package literally named `search-quality-kit`, and exited with `E404`. It now invokes `npx --yes @silesiansolutions/search-quality-kit`, which still prefers a locally installed CLI and resolves correctly when there is none. Pin the package in `devDependencies` for reproducible runs; the fallback fetches the latest release.

## [0.11.0] - 2026-08-10

- Derive a `UrlGraph` from every crawl: a lazily built, memoized projection carrying per-URL status, link, canonical, hreflang-alternate, sitemap and collapsed-redirect edges. It is reached through a free `urlGraph(crawl)` accessor, so `CheckContext`, the engine and the crawler types are unchanged. Every node records whether its status was `observed`, `assumed` or `unresolved`, and `statusIsTrustworthy` is the only sanctioned way to read one. In static mode nothing is trustworthy, whatever the node kind.
- Add a default-on `hreflang` check, the first cross-page check in the kit: `invalid-value`, `invalid-language`, `invalid-region`, `relative-href`, `missing-self`, `missing-reciprocal`, `duplicate-language`, `broken-target`, `x-default-duplicate`, `non-canonical-target`, `lang-mismatch`, `unresolved-target`, and `missing-x-default`. Reciprocity is reported once against the page that fails to link back, with the declaring pages in `relatedUrls`.
- Keep every hreflang finding at `warning` or `info` so the default `ci.failOn: ["error"]` gate is unchanged on upgrade; add `rules.hreflang.strict`, `rules.hreflang.requireXDefault` and `rules.hreflang.requireCanonicalTargets`. A monolingual site produces no hreflang findings at all, held by a corpus sweep over every HTML fixture.
- Scope hreflang to `<link rel="alternate" hreflang>` in delivered HTML. The HTTP `Link:` header and sitemap `xhtml:link` variants are deferred rather than producing findings that appear in one crawl mode and vanish in the other.
- Add `src/utils/bcp47.ts`, a zero-import BCP 47 parser with vendored ISO 639-1, ISO 3166-1 alpha-2 and UN M.49 tables (`SUBTAG_TABLE_REVISION` `2026-08-10`). `Intl` is rejected because it normalizes `eng` to `en`, accepts unregistered codes, resolves `UK` as a region, and answers differently depending on the ICU build in the user's Node.
- Qualify SARIF `ruleId` values with the emitting check. `non-production-url` (four checks) and `missing-lang` (two checks) previously collapsed into single code-scanning rules. Existing alerts close under the old ids and reopen under the qualified ones; the JSON report contract is untouched.
- Publish Action metadata at the repository root with `branding` and `author` so the composite Action can be listed on the GitHub Marketplace. `action/action.yml` stays, so every documented `uses:` path resolves unchanged. Both entry points invoke the same `action/run.sh`, and a test keeps the two metadata files in sync.
- Bump the exported contract schema to `0.11` because the config surface grew; the JSON report contract stays schema `0.3` and existing baselines remain valid.
- Rescope the roadmap: v0.11 is the crawl graph and international targeting. Redirect integrity, canonical-target validation and the `indexability.non-200` split move to v0.12 with the crawler rework they depend on. Correct the claim that all new codes are additive and record why five of six planned sitemap-correlation codes duplicate existing findings. Add design notes for the URL graph, hreflang, finding-code stability, Action distribution and the AI surface.
- Run `npm audit` as its own scheduled CI job, add Dependabot coverage for npm and the `github-actions` ecosystem, and align the README with the sibling repositories.

## [0.10.0] - 2026-07-17

- Add a default-on `agentReadiness` check that audits a new `/llms.txt` crawl artifact (static build output or HTTP origin) and statically scans delivered HTML forms for declarative WebMCP annotations (`toolname`, `tooldescription`, `toolparamdescription`). It mirrors the deterministic subset of the experimental Lighthouse Agentic Browsing category.
- Replicate the Lighthouse `llms-txt` audit content rules exactly (H1, Markdown links, 50-character minimum) and add a blockquote-summary signal per llmstxt.org; emit `webmcp-tool-annotation-incomplete`, `webmcp-tool-name-duplicate`, `webmcp-param-description-missing`, and `webmcp-form-uncovered` findings.
- Keep all agent-readiness findings `info`/`warning` and classified `agentic-readiness`, so the default error gate is unchanged. Add `rules.agentReadiness.requireLlmsTxt` to raise a missing `llms.txt` to a warning once a project commits to publishing one.
- Bump the exported site and portfolio contract schema to `0.10`; the JSON report contract stays schema `0.3` because the change is additive.
- Add `dawid.dev` as a fourth report-only site in the public portfolio showcase and document the agent-readiness check, its finding codes, and its runtime boundaries (CLS, accessibility tree, imperative WebMCP stay with Lighthouse and PageSpeed Insights).

## [0.9.0] - 2026-07-12

- Add reviewed suppressions with required reason and owner, optional `YYYY-MM-DD` expiry, glob URL scoping, and `doctor` validation. Accepted findings stay visible in JSON, Markdown, SARIF, baseline, and portfolio outputs without failing `ci.failOn`.
- Make policy packs configurable with runtime-validated placeholder, contact-label, contact-href, route-scope, text-length, and noindex/nosnippet options while keeping `0.8.0` defaults.
- Add `search-quality-kit contract` exporting deterministic schema `0.9` site and portfolio contracts with safe plugin, policy-pack, suppression, and gate metadata without running builds or crawls.
- Add a handoff report format for site and portfolio reports that groups prioritized actions, reviewed suppressions, baseline debt, and resolved findings for developers, site owners, and coding agents.
- Update the public showcase workflow with contract and handoff artifacts and expand suppression, contract, CI, rollout, and adoption documentation.

## [0.8.0] - 2026-07-09

- Add reusable policy packs for personal-brand, company-site, directory, and AI-visibility safety checks through the existing plugin API.
- Add a public plugin test harness at `@silesiansolutions/search-quality-kit/test-utils` for fixture-based plugin and policy-pack tests without a crawler.
- Add `search-quality-kit doctor` for single-site and portfolio setup diagnostics with human-readable and JSON output.
- Update the public portfolio showcase to demonstrate policy packs on `dawidrylko.com`, `silesiansolutions.com`, and `cyberkatalog.pl` while remaining report-only.
- Expand policy-pack, plugin-testing, CI, rollout, and setup-diagnostics documentation.

## [0.7.0] - 2026-07-08

- Add a typed, path-safe multi-config portfolio runner with deterministic site order, isolated operational errors, per-site baselines, optional per-site SARIF, and one final gate.
- Add stable schema `0.7` portfolio JSON plus bounded GitHub-friendly Markdown summaries and separate report directories for every site.
- Add `portfolio verify` and explicit `portfolio baseline` commands, including safe overwrite protection and optional full finding attribution.
- Extend the official composite Action with backward-compatible `site` and `portfolio` modes, complete artifact upload, portfolio job summaries, and preserved gate exit codes.
- Add the report-only public HTTP showcase for Dawid Rylko, Silesian Solutions, and CyberKatalog, a manual/weekly workflow, portfolio CI examples, rollout guidance, and trend-storage design boundaries.

## [0.6.1] - 2026-07-08

- Add a `node-version-file` GitHub Action input so repositories can reuse `.nvmrc` or another setup-node-compatible version file instead of duplicating the Node.js version.

## [0.6.0] - 2026-07-08

- Add typed `defineCheck` and `definePlugin` helpers with runtime validation, namespaced ids/codes, duplicate detection, and a frozen public crawl context.
- Run custom checks through the normal JSON, Markdown, SARIF, baseline, and `ci.failOn` pipelines while reporting plugin failures separately with exit code 2.
- Attribute every new finding to its core check or plugin without changing the v0.3 baseline fingerprint.
- Add the official composite GitHub Action with optional install/build commands, baseline and report-only modes, summaries, artifacts, and preserved CLI exit codes.
- Add plugin examples, API stability guidance, Action workflows, contract/smoke tests, and the scoped v0.7 roadmap.

## [0.5.0] - 2026-07-08

- Add typed site profiles and ordered route-profile globs for personal, company, blog, directory, local-business, entry, list, article, and service contexts.
- Expand JSON-LD validation across core page/entity types with URL, placeholder, identity, recommended-property, and cross-field consistency checks.
- Add profile/classification context to JSON and Markdown reports plus `list-profiles` CLI discovery.
- Add deterministic profile fixtures, real-world configuration templates, Google-integration boundaries, and v0.6 design direction.

## [0.4.0] - 2026-07-08

- Add deterministic presets for Astro, Next.js static/hybrid, Gatsby, Vite SPA, and generic static builds.
- Add `init --preset`, conservative `init --detect`, overwrite protection, and generated-config verification tests.
- Add explicit static/HTTP crawl selection, actionable configuration errors, rollout examples, and real-repository configs.
- Standardize finding classifications across `list-checks`, Markdown, and JSON reports.
- Resolve same-origin extensionless canonicals for flat static HTML output such as SvelteKit adapter-static builds.
- Document legacy/new-site rollout, monorepo operation, and the proposed v0.5 boundary.

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

[0.13.0]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.11.3...v0.12.0
[0.11.3]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.11.2...v0.11.3
[0.11.2]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.11.1...v0.11.2
[0.11.1]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.11.0...v0.11.1
[0.11.0]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/SilesianSolutions/search-quality-kit/releases/tag/v0.1.0
