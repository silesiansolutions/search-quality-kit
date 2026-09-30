# Product roadmap

This is the official roadmap for `@silesiansolutions/search-quality-kit`. It records what has shipped, what the next releases contain, and what the project will never do. The [philosophy](philosophy.md) and the [design notes](design/) hold the detailed reasoning; this page is the plan.

## Product thesis

The kit competes on three properties, and every roadmap item must strengthen at least one without weakening another:

1. **Fast.** Static analysis plus bounded HTTP requests. No browser, no external APIs, no accounts. An audit finishes in CI seconds, not minutes.
2. **AI-first.** Deterministic checks for how LLM-driven search and agents actually read sites — delivered HTML, structured identity, snippet directives, `llms.txt`, WebMCP, crawler access policy — honestly labeled: `agentic-readiness` findings are never presented as Google requirements.
3. **Easy to wire in.** Framework presets, one composite Action, a portfolio runner, stable JSON/SARIF/contract schemas, and handoff reports readable by developers, site owners, and coding agents.

The kit is not a second Ahrefs and not a second Lighthouse: no backlink index, no rank tracking, no browser runtime (see [Non-goals](#non-goals)).

## Where the project stands (v0.12)

- deterministic crawl of static output or an HTTP origin, including sitemap indexes, redirects, and orphan detection (v0.2);
- portable finding baselines with `--fail-on-new` gating, schema-versioned JSON reports, Markdown artifacts, and dependency-free SARIF (v0.3);
- official presets for Astro, Next.js static/hybrid, Gatsby, Vite SPA, and generic static builds, with `init --preset` and conservative `init --detect` (v0.4);
- typed site profiles and route-profile globs with expanded JSON-LD validation (v0.5);
- a typed plugin API (`defineCheck`, `definePlugin`) and the official composite GitHub Action (v0.6);
- a multi-config portfolio runner with per-site baselines, aggregated reports, and the report-only public showcase (v0.7);
- reusable policy packs (personal-brand, company-site, directory, AI-visibility), the `doctor` command, and the public plugin test harness (v0.8);
- reviewed suppressions with owner/reason/expiry, configurable policy packs, exported `contract` schemas, and handoff reports (v0.9);
- a default-on agent-readiness check covering `llms.txt` and declarative WebMCP form annotations, kept out of the default error gate (v0.10);
- a URL graph derived from every crawl, the hreflang check, and root-level Action metadata for the Marketplace (v0.11);
- a crawler that follows redirects itself and classifies failed requests, redirect and asset integrity checks, canonical-target validation, robots rule matching, the `indexability.non-200` split behind finding code aliases, sitemap hreflang, and warnings for suppressions that match nothing (v0.12).

## Research inputs

Three research passes informed this plan: a mapping of the Ahrefs Site Audit issue catalog onto the kit, a survey of free search-data sources, and a broad market scan of SEO/AEO tooling. Verified against v0.10, most market-scan proposals had already shipped (metadata/H1/alt/canonical checks, `init --detect`, `doctor`, policy packs, Astro/Next examples, handoff reports, `llms.txt`); the survey of external data sources confirmed the companion-package boundary rather than new core scope. The durable output is the catalog gaps scheduled below — all implementable from data the crawler already collects or one bounded request away, none requiring a browser.

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
- `sitemap.url-timeout`: duplicates `indexability.timeout`, which a crawled sitemap URL already carries;
- `canonical.no-incoming-links` — overlaps `internal-links.orphan-page` heavily; the orphan-page check already covers this case;
- Content Signals (`Content-Signal` robots.txt extension) — Cloudflare's own announcement (2025-09-24) states the signals are non-binding preferences, Google's John Mueller has stated the directive has no effect on any crawler or LLM, and no crawler has shipped support. See [ai-surface-review.md](design/ai-surface-review.md).

## How this roadmap changes

The roadmap is updated in the release pull request whenever a minor ships or a design note changes scope. Version sections state intent, not guarantees; items may move between releases. Promoting an item into the next release requires a scoped design note in [docs/design](design/) first.
