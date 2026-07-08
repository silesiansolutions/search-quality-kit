# Rollout guide

The safe rollout pattern is: generate a narrow config, observe current findings, review intent, record a baseline, then fail only new regressions. Do not turn every historical warning into a blocking migration project.

## 1. Install and choose a preset

Install the package with the repository's package manager and pin it in `devDependencies`:

```bash
npm install --save-dev @silesiansolutions/search-quality-kit
npx search-quality-kit init --preset astro
```

Available CLI names are `astro`, `next-static`, `next-hybrid`, `gatsby`, `vite-spa`, and `generic-static`. `init --detect` is useful for an unambiguous stack, but an explicit preset is better in automation. Next detection only selects `next-static` when `output: "export"` is visible in `next.config.*`; otherwise choose the mode yourself.

Replace the generated `baseUrl` TODO with the production origin. Presets do not add build commands. Keep build ownership in the repository's existing scripts.

## 2. Run without gating

Build exactly as deployment does, then run the first audit in report-only mode:

```bash
npm run build
npx search-quality-kit verify \
  --report-only \
  --json \
  --output /tmp/search-quality-first.json
npx search-quality-kit report /tmp/search-quality-first.json \
  --format markdown \
  --output /tmp/search-quality-first.md
```

For Next hybrid, start the application at the preset's `http://localhost:3000` first, or explicitly configure `build.startCommand` and keep `site.localUrl`. Static presets fail when their output directory is absent, which prevents an accidental production crawl.

## 3. Review findings and scope

Triage in this order:

1. `google-requirement` errors: broken status/indexability/protocol behavior.
2. New broken internal links, production-host leaks, invalid sitemap/robots, and malformed JSON-LD.
3. `google-recommendation` findings with an obvious technical fix.
4. `cross-channel-metadata` and `accessibility-basic` regressions.
5. `local-heuristic` thresholds that require project context.

A heuristic is evidence to inspect, not a Google ranking threshold. Title, description, HTML, script, and image limits can be tuned narrowly. Do not globally disable a check because one known route is exceptional.

### Intentional noindex versus a defect

Confirm the route's product intent and its sitemap/link behavior. An intentionally private, preview, legal, or utility route may be added to `crawl.exclude`; preserve the preset's existing values when extending the list. A public landing page accidentally carrying `noindex`, a noindexed URL in the sitemap, or a route excluded only to make CI green is a defect.

```ts
const preset = presets.astro();

export default defineConfig({
  ...preset,
  site: { baseUrl: "https://example.com" },
  crawl: {
    ...preset.crawl,
    exclude: [...(preset.crawl?.exclude ?? []), "/reviewed-noindex-route"],
  },
});
```

## 4. Record the reviewed baseline

After fixing genuine errors and documenting intentional scope, create the baseline from the same build and config used in CI:

```bash
npx search-quality-kit verify \
  --report-only \
  --json \
  --output search-quality-baseline.json
git add search-quality.config.ts search-quality-baseline.json
```

Review baseline changes like dependency-lock changes. Never regenerate it automatically on every CI run; that would accept regressions before review.

## 5. Gate only new regressions in CI

Build once, then audit with `--skip-build` when `build.command` is also present in config:

```bash
npx search-quality-kit verify \
  --skip-build \
  --baseline search-quality-baseline.json \
  --fail-on-new \
  --json \
  --output search-quality-report.json
```

The gate applies `ci.failOn` only to new findings. Start with `failOn: ["error"]`. Promote warnings only after their false-positive rate and ownership are understood. Use the examples under `examples/ci/` for Markdown job summaries and artifacts.

## 6. Keep pull requests readable

- Put the grouped Markdown report in the workflow summary; do not emit one PR comment per finding.
- Upload JSON and Markdown as one artifact for debugging.
- Gate new errors first; leave historical warnings in the collapsible existing-findings section.
- Cap organizational noise by fixing shared templates before page-by-page symptoms.
- Update the baseline only in a reviewed PR that explains intentional additions or removals.
- Prefer stable check/code links over copied tool output in discussions.

## Recommended rollout for legacy sites

1. Use the closest preset and run `--report-only` against a clean production-equivalent build.
2. Fix broken build output, indexability errors, and local/staging leaks first.
3. Exclude only confirmed intentional noindex/generated routes.
4. Commit a reviewed baseline even if warnings remain.
5. Gate new errors for several weeks; then decide whether selected warning classes deserve enforcement.

Gatsby repositories deserve an extra check for stale `public/` artifacts. Clean before building, and verify that the deployment and audit use the same output. The Gatsby preset handles known generated fallback routes but does not hide old pages left in `public/`.

## Recommended rollout for new sites

1. Add config and CI before launch.
2. Run without a baseline when a clean zero-error state is realistic.
3. Keep `site.baseUrl`, canonical URLs, robots, and sitemap production-correct from the first deploy.
4. Add a baseline only when reviewed warnings are intentional or not immediately actionable.
5. Treat a baseline increase as an exception, not normal maintenance.

## Personal, company, blog, and directory sites

- Personal/blog: raise `maxPages` above the post count; review duplicate descriptions caused by old content templates and pagination.
- Company: explicitly review legal-page noindex policy, case-study title duplication, and staging-host leaks.
- Directory: set `maxPages` above the generated entity count, preserve category/detail entrypoints, and avoid blanket exclusions for dynamic-looking routes.
- SPA: remember that the tool inspects delivered HTML and does not execute JavaScript. An app-shell warning is a deployment/rendering signal, not a request to weaken `renderedHtml` blindly.

## Rolling out across several repositories

Use one small PR per repository: pinned dependency, explicit preset config, reviewed baseline, and CI workflow. Keep a tracking table with repository, owner, preset, first-run date, baseline status, gate status, and top real defects. Roll out to one representative site per stack before copying the pattern. Centralize lessons in this package's docs or presets instead of maintaining bespoke shell logic everywhere.

For monorepos, use one config, baseline, and report path per site as described in [the multi-site design](design/multi-site.md).

## Portfolio rollout

Choose the execution model deliberately:

- **Single-site audit:** one deployable and one config; use `verify`.
- **Monorepo matrix:** sites need parallel runners, separate builds/caches, or independent ownership; use one `verify` job per site.
- **Portfolio runner:** sites can run sequentially and need one bounded report/gate while retaining isolated configs, baselines, and artifacts.
- **Public HTTP showcase:** read-only production observation; default to report-only because target state is external to the package release.
- **Local build showcase:** production-equivalent checkouts/builds; stronger reproducibility, but local source and build inputs must be available.

For portfolio adoption, first run `portfolio verify --report-only`, triage operational errors before findings, and confirm every site's crawl scope. Add reviewed single-site baseline paths only where existing debt requires regression-only gating. Then enable `failOnNew`, keep `failOn: ["error"]`, and remove report-only for internal deterministic targets. Do not automatically regenerate baselines in CI.

The final gate fails for configured severities (or new configured severities in baseline mode) and for operational/plugin/config/baseline failures. Resolved and existing findings do not fail a new-findings gate. Keep `continueOnSiteFailure: true` so maintainers receive a complete portfolio report instead of fixing sites serially.

## Scope after v0.7

Keep v0.8 focused on operational hardening driven by real portfolio usage. Trend storage, a standalone docs/demo site, and richer annotations need separate evidence and design. Search Console belongs in an optional package/plugin, not core. Google APIs, browser automation, content scoring, synthetic Core Web Vitals, and SaaS scheduling remain out of scope.
