# Product roadmap

This is the official roadmap for `@silesiansolutions/search-quality-kit`. It records what has shipped, what is planned next, and what the project will not do. Directions beyond the next minor release are options under evaluation, not commitments. The [philosophy](philosophy.md) and the [design notes](design/) remain the source of detailed reasoning; this page summarizes them.

## Where the project stands

As of v0.10, the kit is a framework-agnostic, offline-capable CLI that audits technical Google Search foundations in local builds and CI:

- deterministic crawl of static output or a local/public HTTP origin, including sitemap indexes, redirects, and orphan detection (v0.2);
- portable finding baselines with `--fail-on-new` gating, schema-versioned JSON reports, Markdown artifacts, and dependency-free SARIF for GitHub Code Scanning (v0.3);
- official presets for Astro, Next.js static/hybrid, Gatsby, Vite SPA, and generic static builds, with `init --preset` and conservative `init --detect` (v0.4);
- typed site profiles and route-profile globs with expanded JSON-LD validation (v0.5);
- a typed plugin API (`defineCheck`, `definePlugin`) and the official composite GitHub Action (v0.6);
- a multi-config portfolio runner with per-site baselines, aggregated reports, and the report-only public showcase (v0.7);
- reusable policy packs, the `doctor` diagnostics command, and the public plugin test harness at `/test-utils` (v0.8);
- reviewed suppressions with owner/reason/expiry, configurable policy packs, exported `contract` schemas, and handoff reports for developers and coding agents (v0.9);
- a default-on agent-readiness check covering `llms.txt` and declarative WebMCP form annotations, classified `agentic-readiness` and kept out of the default error gate (v0.10).

## Next

Work in this horizon is operational and additive; the SEO rule catalog and the report contract stay stable.

- **Plugin API stabilization toward 1.0.** Keep the documented plugin surface additive-only in minors and finish the compatibility guidance in [plugin API stability](design/plugin-api-stability.md) so plugin authors can pin a supported range with confidence.
- **Portfolio trend history from workflow artifacts.** Retain each showcase run's portfolio and site reports as artifacts with the package/config revision recorded, per the recommendation in [portfolio trend storage](design/portfolio-trends.md). No external store, scheduler, or automatic baseline mutation.
- **Annotation and SARIF refinements.** Continue hardening CI annotations without fabricating source locations, for both single-site and portfolio runs.

## Later (options, not commitments)

- **Standalone documentation site.** The in-repository docs remain authoritative until a published site adds enough discovery value to justify its build and maintenance.
- **Optional Search Console integration as a separate package.** A future plugin could correlate Search Console performance changes with deterministic deploy findings and call the URL Inspection API for explicitly selected URLs. It must live outside the offline core and handle credentials, quotas, delayed data, and network failure without changing core report determinism. See [future Google integrations](design/google-integrations.md).
- **Published trend history.** A small static history derived from reviewed showcase artifacts (for example on GitHub Pages) only if artifact-based retention proves insufficient.

## Non-goals

These boundaries are permanent, not backlog:

- no ranking promises, content-quality scoring, or SEO spam;
- no Google API calls, accounts, or credentials in the core package;
- no clone of Rich Results Test — the core keeps bounded syntax, URL, identity, and consistency checks and links to official tools;
- no browser automation or runtime auditing — Core Web Vitals, the runtime accessibility tree, and imperative WebMCP registration stay with Lighthouse and PageSpeed Insights;
- no external database, credentials, or hosted service in the lightweight core.

## How this roadmap changes

The roadmap is updated in the release pull request whenever a minor release ships or a design note changes scope. Anything listed under "Later" moves to "Next" only with a scoped design note in [docs/design](design/) first.
