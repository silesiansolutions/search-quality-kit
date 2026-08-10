# Product roadmap

This is the official roadmap for `@silesiansolutions/search-quality-kit`. It records what has shipped, what the next releases contain, and what the project will never do. The [philosophy](philosophy.md) and the [design notes](design/) hold the detailed reasoning; this page is the plan.

## Product thesis

The kit competes on three properties, and every roadmap item must strengthen at least one without weakening another:

1. **Fast.** Static analysis plus bounded HTTP requests. No browser, no external APIs, no accounts. An audit finishes in CI seconds, not minutes.
2. **AI-first.** Deterministic checks for how LLM-driven search and agents actually read sites — delivered HTML, structured identity, snippet directives, `llms.txt`, WebMCP, crawler access policy — honestly labeled: `agentic-readiness` findings are never presented as Google requirements.
3. **Easy to wire in.** Framework presets, one composite Action, a portfolio runner, stable JSON/SARIF/contract schemas, and handoff reports readable by developers, site owners, and coding agents.

The kit is not a second Ahrefs and not a second Lighthouse: no backlink index, no rank tracking, no browser runtime (see [Non-goals](#non-goals)).

## Where the project stands (v0.10)

- deterministic crawl of static output or an HTTP origin, including sitemap indexes, redirects, and orphan detection (v0.2);
- portable finding baselines with `--fail-on-new` gating, schema-versioned JSON reports, Markdown artifacts, and dependency-free SARIF (v0.3);
- official presets for Astro, Next.js static/hybrid, Gatsby, Vite SPA, and generic static builds, with `init --preset` and conservative `init --detect` (v0.4);
- typed site profiles and route-profile globs with expanded JSON-LD validation (v0.5);
- a typed plugin API (`defineCheck`, `definePlugin`) and the official composite GitHub Action (v0.6);
- a multi-config portfolio runner with per-site baselines, aggregated reports, and the report-only public showcase (v0.7);
- reusable policy packs (personal-brand, company-site, directory, AI-visibility), the `doctor` command, and the public plugin test harness (v0.8);
- reviewed suppressions with owner/reason/expiry, configurable policy packs, exported `contract` schemas, and handoff reports (v0.9);
- a default-on agent-readiness check covering `llms.txt` and declarative WebMCP form annotations, kept out of the default error gate (v0.10).

## Research inputs

Three research passes informed this plan: a mapping of the Ahrefs Site Audit issue catalog onto the kit, a survey of free search-data sources, and a broad market scan of SEO/AEO tooling. Verified against v0.10, most market-scan proposals had already shipped (metadata/H1/alt/canonical checks, `init --detect`, `doctor`, policy packs, Astro/Next examples, handoff reports, `llms.txt`); the survey of external data sources confirmed the companion-package boundary rather than new core scope. The durable output is the catalog gaps scheduled below — all implementable from data the crawler already collects or one bounded request away, none requiring a browser.

## v0.11 — crawl graph and international targeting

One internal refactor unlocks most of this roadmap: promote the crawl result to an explicit **URL graph** — every URL with its status, link edges, canonical target, hreflang alternates, and sitemap membership — derived once per run. Checks become pure queries over the graph instead of each re-deriving state from crawl internals. This keeps audits fast while the catalog grows, separates fetching from rule logic, and can later back a richer read-only plugin context. Every node records whether its status was **observed**, **assumed**, or **unresolved**, so a check can never treat static mode's hardcoded `200` as a real response. Redirects appear only as the single collapsed edge the crawler retains today; hop-by-hop history waits for v0.12. See [url-graph.md](design/url-graph.md).

**hreflang** is the graph's first consumer and the release's only new check: `hreflang.invalid-value`, `hreflang.invalid-language`, `hreflang.invalid-region`, `hreflang.relative-href`, `hreflang.missing-self`, `hreflang.missing-reciprocal`, `hreflang.duplicate-language`, `hreflang.broken-target`, `hreflang.x-default-duplicate`, `hreflang.non-canonical-target`, `hreflang.lang-mismatch`, `hreflang.unresolved-target`, `hreflang.missing-x-default`. Reciprocity is an explicitly documented Google requirement rather than practitioner convention, the check is fully decidable from delivered HTML with no additional requests, and it behaves identically in static and HTTP mode — the only planned check with no mode asymmetry. All findings ship at `warning`/`info` so the default error gate is unchanged; `rules.hreflang.strict` opts into error severity. See [hreflang.md](design/hreflang.md).

The release scope is deliberately one refactor and one check. The graph exists to be validated by a real consumer before more checks are built on it, and hreflang is the consumer that needs nothing the crawler does not already collect.

The JSON **report** schema stays `0.3`. The exported **contract** schema bumps with every config-surface change — it went `0.9` to `0.10` in v0.10.0 for exactly that reason, and goes to `0.11` here because `checks.hreflang` is added. Code renames are not additive and are deferred; see [finding-code-stability.md](design/finding-code-stability.md).

## v0.12 — crawler rework, redirect integrity, and resource reach

Everything here depends on one prerequisite: the crawler currently delegates redirect following, so redirect hops are unavailable, and a failed fetch collapses to `{status: 0}`, conflating timeout, DNS failure, connection refused, TLS error, and redirect loop into one undifferentiated state. `fetchPage` stops delegating redirect following, so hops become inspectable and failure modes become distinguishable. That rework lands first; it also shifts existing redirect-derived findings, so it is a migration, not an addition.

- **Redirect integrity** — the largest verified catalog gap, and unavailable until the rework: `redirects.loop`, `redirects.chain`, `redirects.broken`, `redirects.internal-link-to-redirect`.
- **Canonical target validation**: `canonical.target-redirect`, `canonical.target-4xx`, `canonical.target-5xx`, `canonical.target-unreachable` — resolved from the graph, with no extra requests for already-crawled targets. Structurally HTTP-only: static mode has no observed status to validate against.
- **Precise indexability codes**: split the blanket non-200 finding into `indexability.4xx` (with 404 detail), `indexability.5xx`, and `indexability.timeout`. This is a rename, not an addition — it invalidates baselines and suppressions and needs the alias mechanism described in [finding-code-stability.md](design/finding-code-stability.md), and `indexability.timeout` cannot be emitted honestly until the rework distinguishes a timeout from a DNS failure.
- **`sitemap.url-noindex`**: the one genuinely new code from the originally planned sitemap-correlation set; see "Evaluated and rejected" for the five duplicates struck from it.
- **`<html lang>` BCP 47 validation**: cheap once the v0.11 subtag tables exist, but a second source of new findings, which is why it does not ride along with hreflang.
- **Sitemap `xhtml:link` hreflang**: one mapper change away in `parseSitemap`, which already parses the attributes and discards them.
- **Asset integrity** (new check): `assets.broken-image`, `assets.broken-script`, `assets.broken-stylesheet`, `assets.missing-static-asset`. Static mode checks build-output presence; HTTP mode uses bounded requests under the existing crawl limits.
- **Robots rule matching**: a small REP matcher for `*` and `Googlebot` applied to crawled URLs: `robots.indexable-url-blocked`, `robots.sitemap-url-blocked`, `robots.unavailable` with 5xx/timeout semantics per Google's specification instead of being treated as absence.
- **Quick wins**: `metadata.multiple-titles`, `metadata.multiple-descriptions`, `internal-links.https-to-http`, `internal-links.no-outgoing-links`.

## v0.13 — AI visibility and duplicate identity

- **AI crawler access audit** (extends the robots check and the `aiVisibilitySafe` pack): evaluate robots.txt policy against a vendored copy of `ai-robots-txt/ai.robots.txt` (464 user agents, MIT licensed, updated weekly) instead of a hand-maintained roster, distinguishing training bots (GPTBot, ClaudeBot, Google-Extended, CCBot), answer-engine bots (OAI-SearchBot, Claude-SearchBot, PerplexityBot), and user-triggered fetchers. Findings stay `info`/`warning` and report-only: blocking may be deliberate policy, so the kit reports the consequence — invisibility to a given answer engine — and never prescribes the policy. The roster ships versioned in the package and updates in minor releases. See [ai-surface-review.md](design/ai-surface-review.md).
- **Agentic Resource Discovery (ARD)**: watched, not scheduled. `/.well-known/ai-catalog.json`, Linux Foundation AI Catalog Working Group, Apache 2.0. Adoption is near zero; the trigger to schedule it is observable adoption, not further announcements. See [ai-surface-review.md](design/ai-surface-review.md).
- **Exact-duplicate detection**: a normalized main-content hash producing `duplicates.exact-without-canonical` and `duplicates.conflicting-canonicals`. Identical documents only; no similarity scoring.
- **`errorFreeUrlRate` summary metric** in JSON, Markdown, and portfolio outputs: `ceil((auditedUrls − urlsWithErrors) / auditedUrls × 100)`, counting unique URLs carrying at least one error-severity finding. Global findings such as invalid sitemap XML are reported separately and never attributed to URLs. It is a transparent counting rule, not a weighted score, and never the primary CI gate — new-error baseline gating remains the gate.

## Toward 1.0

1.0 is a stability promise, not a feature milestone:

- freeze the documented plugin surface per [plugin API stability](design/plugin-api-stability.md);
- publish a benchmark fixture with tracked audit timings and make measurable slowdowns a release blocker, so the speed pillar is enforced rather than aspirational;
- finalize report and contract schema documentation so external tooling — dashboards, data pipelines, agents — can build on the formats without reading source.

## Continuous tracks

- **Showcase and trend history**: retain every showcase run's reports as workflow artifacts with the package/config revision recorded, per [portfolio trend storage](design/portfolio-trends.md). No external store, scheduler, or automatic baseline mutation.
- **Spec tracking**: `llms.txt` and declarative WebMCP are young specifications. Standing rule: the kit implements the deterministic subset of a specification once that specification has consumers, tracks published spec changes in minor releases, and does not build against sections marked TODO. See [ai-surface-review.md](design/ai-surface-review.md).
- **Docs**: in-repository docs stay authoritative; a standalone docs site only when discovery value justifies its maintenance.
- **Distribution**: the composite Action moves to the repository root, with the existing subdirectory path preserved as a shim, so it can be listed on the GitHub Marketplace. See [action-distribution.md](design/action-distribution.md).

## Companion packages, not core features

The core stays offline and dependency-light. Anything needing accounts, networks beyond the audited site, or a browser lives in separate optional packages that consume the kit's stable report contracts:

- **Search data plane**: correlating Search Console, CrUX, or Bing Webmaster data with deterministic deploy findings is the periodic-external-sensor pattern — a separate package, never a core dependency. See [future Google integrations](design/google-integrations.md).
- **Reporter integrations** (Slack, Teams, issue trackers): plugins or consumers of the JSON contract.
- **Performance adapters**: Core Web Vitals belong to Lighthouse and PageSpeed Insights; at most a companion package correlates their output with kit reports.

## Non-goals

Permanent boundaries, not backlog:

- no backlink index, rank tracking, competitor traffic estimation, or SERP history — not a second Ahrefs;
- no browser automation or JavaScript execution — no Core Web Vitals measurement, runtime accessibility trees, or imperative WebMCP auditing; not a second Lighthouse;
- no Google or third-party API calls, accounts, or credentials in the core package;
- no content-quality scoring, semantic similarity, or content generation;
- no opaque 0–100 "SEO score" — `errorFreeUrlRate` is a documented counting rule with nothing weighted or hidden;
- no Rich Results Test clone — bounded syntax, identity, and consistency checks plus links to official tools;
- no hosted service, dashboard, or external storage in core.

## Evaluated and rejected

Recorded so they are not re-litigated:

- near-duplicate similarity scoring — heuristic and non-deterministic;
- IndexNow pings — an external API and key lifecycle inside core;
- clickbait phrase-list metadata heuristics — arbitrary, with a high false-positive cost;
- runtime geo-blocking and popup detection — not detectable statically without guessing;
- full HTML validity audits — high noise, low search impact;
- generating metadata or content with LLMs — the kit audits, it does not write;
- translated documentation forks — one English source of truth;
- `sitemap.url-non-canonical` — duplicates `canonical.sitemap-canonical-mismatch`;
- `sitemap.url-redirects` — duplicates `canonical.sitemap-final-url-mismatch`, which already reports a sitemap URL whose final URL is not itself in the sitemap;
- `sitemap.url-4xx` and `sitemap.url-5xx` — duplicate the indexability finding a crawled URL already carries;
- `sitemap.url-timeout` — not implementable without the v0.12 crawler rework distinguishing timeout from other unreachable states, and even then it duplicates the indexability finding;
- `canonical.no-incoming-links` — overlaps `internal-links.orphan-page` heavily; the orphan-page check already covers this case;
- Content Signals (`Content-Signal` robots.txt extension) — Cloudflare's own announcement (2025-09-24) states the signals are non-binding preferences, Google's John Mueller has stated the directive has no effect on any crawler or LLM, and no crawler has shipped support. See [ai-surface-review.md](design/ai-surface-review.md).

## How this roadmap changes

The roadmap is updated in the release pull request whenever a minor ships or a design note changes scope. Version sections state intent, not guarantees; items may move between releases. Promoting an item into the next release requires a scoped design note in [docs/design](design/) first.
