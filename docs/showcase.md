# Public portfolio showcase

The public showcase runs the portfolio runner against `https://dawidrylko.com`, `https://silesiansolutions.com`, and `https://cyberkatalog.pl`. It demonstrates the package's public npm API, HTTP crawler, site profiles, configurable policy packs, reviewed suppressions, contract export, handoff reports, isolated reports, and one aggregate gate without requiring access to the sites' source repositories.

## What this demonstrates

- `dawidrylko.com`: a personal/blog site using `personalBrand` and
  `aiVisibilitySafe` policy packs with Polish contact labels and scoped blog
  routes.
- `silesiansolutions.com`: a company/service/blog site using `companySite` and
  `aiVisibilitySafe` policy packs with English/Polish contact labels and a
  narrow reviewed suppression example.
- `cyberkatalog.pl`: a directory/blog site using `directory` and
  `aiVisibilitySafe` policy packs with directory route scope and reviewed
  snippet-directive exceptions.

The showcase remains report-only. Public HTTP results can change independently
of the package release, so they are observations in workflow artifacts, not a
release gate or committed generated report.

## Why it lives in this repository

The showcase is versioned with the API it documents. Config, Action behavior, tests, and examples change in one review, while volatile reports remain GitHub Actions artifacts. A separate repository would add release and compatibility drift without providing useful isolation at this stage.

Do not create a separate showcase repository while the examples test the current package API, belong with the npm release, fit in normal code review, and produce artifacts only. Reconsider that decision when a standalone GitHub Pages/docs application exists, generated content becomes substantial, several package versions must be tested independently, customer/private repositories enter the scope, or demo operations need a release cycle separate from the package.

## Run locally

From the repository root:

```bash
npm install
npm run build
node dist/cli/index.js portfolio verify \
  --config examples/showcase/portfolio.search-quality.config.ts \
  --report-only \
  --output-dir search-quality-reports \
  --sarif
node dist/cli/index.js contract \
  --portfolio-config examples/showcase/portfolio.search-quality.config.ts \
  --output search-quality-reports/portfolio-contract.json
node dist/cli/index.js report \
  search-quality-reports/portfolio.json \
  --format handoff \
  --output search-quality-reports/portfolio-handoff.md
```

The manifest itself sets `portfolio.reportOnly: true`, so the production HTTP showcase observes changes without blocking package releases. `--report-only` makes that intent explicit at the call site. The crawl is read-only, bounded by each site's `maxPages`, needs no secret, and sends only normal HTTP requests.

## GitHub Actions

The manual and weekly workflow is [`.github/workflows/showcase.yml`](../.github/workflows/showcase.yml). It also runs on pull requests that change showcase, source, Action, package, or documentation files. It uploads the whole `search-quality-reports/` directory after adding `portfolio-contract.json` and `portfolio-handoff.md`, then appends the portfolio and handoff Markdown to the job summary. It is not a release gate because a production site or network can change independently of this repository.

Use synthetic static fixtures in the regular test suite for the hard gate. Use the public workflow to demonstrate current production behavior.

## Read the reports

`portfolio.json` is the stable schema `0.7` machine report. It contains portfolio totals, per-site summaries and report paths, bounded highlights, operational errors, and the final gate decision. Full findings stay in each site's `search-quality-report.json` unless `--include-findings` is requested. `portfolio.md` is a bounded GitHub summary with the gate reason, site table, top findings, resolved items, operational failures, and next actions.

`portfolio-contract.json` is the schema `0.9` contract export. It records the
validated portfolio/site policy without crawling: base URLs, crawl scope,
profiles, policy packs, suppressions, and gate settings. Use it when a reviewer
or coding agent needs to understand the quality contract before changing a
site.

`portfolio-handoff.md` is the action-oriented report for maintainers and coding
agents. It separates immediate fixes from reviewed suppressions, baseline debt,
resolved items, and operational errors. Suppressed findings remain visible as
accepted decisions; they are not listed as unreviewed TODOs.

Each enabled site gets its own JSON and Markdown report. `--sarif` adds one SARIF file per completed site; there is no combined portfolio SARIF in v0.7.

## Add another public site

1. Add a bounded HTTP config under `examples/showcase/sites/` with the correct production `baseUrl`, site/route profiles, and relevant policy packs.
2. Add a unique, path-safe lowercase name to `portfolio.search-quality.config.ts`.
3. Keep `maxPages` and timeouts reasonable; do not add credentials, mutation, browsers, Google APIs, or private endpoints.
4. Run report-only locally and inspect the per-site and aggregate reports.
5. Add or update contract tests if the example changes public API coverage.

If a public URL is unavailable or unstable, set `enabled: false` and document the reason. Do not invent or commit a successful result.

## Per-site baselines

The initial showcase intentionally has no committed baselines. To adopt them, add a path to each site entry:

```ts
{
  name: "dawidrylko",
  config: "sites/dawidrylko.config.ts",
  baseline: "baselines/dawidrylko.baseline.json",
}
```

Then run:

```bash
search-quality-kit portfolio baseline \
  --config examples/showcase/portfolio.search-quality.config.ts
```

The command writes normal single-site JSON reports and refuses to replace an existing snapshot without `--force`. Review baseline diffs as accepted technical debt, not as an “ideal” or ranking benchmark. A configured missing or invalid baseline becomes an operational error for that site while the runner continues with the rest.

## Public HTTP versus local build

The committed showcase uses `crawl.mode: "http"` against production and needs no source checkout. A local build audit instead points each site entry at a local site root and uses its normal static or preview config. Local builds give stronger source/build context and reproducibility, but require the repository and production-equivalent build inputs. Keep local paths in an uncommitted portfolio manifest unless every checkout is public and portable.

## What this is not

The showcase is not an SEO ranking, content score, Core Web Vitals measurement, Rich Results Test, Search Console replacement, or claim that one site is “better” than another. It reports deterministic technical foundations visible to the configured crawl at that moment.

If the project grows into a public demo/docs site with significant generated history, it can move to a dedicated repository later. Until then, package-aligned configs plus workflow artifacts are the lower-drift design.
