# Continuous integration

The CLI has three exit codes: `0` when the configured gate passes, `1` when findings match `ci.failOn`, and `2` for CLI, config, baseline, or runtime errors. `--report-only` always suppresses the finding gate, but it does not hide operational errors.

Pin a released package version in `devDependencies` and start with `--report-only` while the team reviews the first report. Existing repositories should normally adopt the baseline workflow below instead of weakening checks globally.

## Official GitHub Action

The official composite Action sets up Node, optionally runs explicit install/build commands, invokes the pinned local `search-quality-kit` binary, creates JSON and Markdown reports, and then preserves the CLI exit code. It does not guess a package manager, build command, config, baseline, or deployment behavior.

### Basic workflow

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
          node-version: "22"
          package-manager: npm
          install-command: npm ci
          build-command: npm run build
          config: search-quality.config.ts
          report-only: "false"
          output-dir: search-quality-reports
          summary: "true"
          upload-artifact: "true"
```

`install-command` and `build-command` default to empty; the Action runs neither unless configured. When `build-command` is set, the Action passes `--skip-build` to the CLI so a `build.command` in config is not executed twice. `package-manager` selects only how the already-installed local binary is invoked: `npx --no-install`, `pnpm exec`, or `yarn exec`.

The default artifact contains `search-quality-report.json` and `search-quality-report.md`. Set `sarif: "true"` to add `search-quality-report.sarif`; uploading SARIF to GitHub Code Scanning remains an explicit workflow decision because it requires repository permissions.

### Baseline and fail-on-new

```yaml
- uses: SilesianSolutions/search-quality-kit/action@v0
  with:
    node-version: "22"
    install-command: npm ci
    build-command: npm run build
    config: search-quality.config.ts
    baseline: search-quality-baseline.json
    fail-on-new: "true"
    summary: "true"
    upload-artifact: "true"
```

`fail-on-new: "true"` requires `baseline`. It maps directly to `verify --baseline ... --fail-on-new`; the severities still come from `ci.failOn`.

### Report-only rollout

```yaml
- uses: SilesianSolutions/search-quality-kit/action@v0
  with:
    install-command: npm ci
    build-command: npm run build
    config: search-quality.config.ts
    report-only: "true"
    summary: "true"
    upload-artifact: "true"
```

Report-only suppresses finding-based failure while the team reviews initial debt. Config, baseline, runtime, and plugin errors still exit `2`; a broken audit never becomes a green observation run.

### Pull request summary and artifact

`summary: "true"` appends the bounded Markdown report to `$GITHUB_STEP_SUMMARY`. `upload-artifact: "true"` uses `actions/upload-artifact` after the audit even when findings fail the gate. The Action exports absolute `json-report`, `markdown-report`, and optional `sarif-report` paths for later steps. It does not create PR comments or fabricate source-line annotations.

Complete examples are available at [`examples/ci/github-action-basic.yml`](../examples/ci/github-action-basic.yml) and [`examples/ci/github-action-baseline.yml`](../examples/ci/github-action-baseline.yml).

## Manual CLI workflow

Use the manual form when the repository needs custom job ordering, separate permissions, SARIF upload, or nonstandard report handling. This workflow writes JSON during the audit, reformats it as Markdown even when the gate fails, appends Markdown to the workflow summary, and uploads both files.

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
      - run: npm run build

      - name: Run search quality audit
        run: |
          npx @silesiansolutions/search-quality-kit verify \
            --skip-build \
            --json \
            --output search-quality-report.json

      - name: Create Markdown report
        if: always()
        run: |
          npx @silesiansolutions/search-quality-kit report \
            search-quality-report.json \
            --format markdown \
            --output search-quality-report.md

      - name: Add report to workflow summary
        if: always()
        run: cat search-quality-report.md >> "$GITHUB_STEP_SUMMARY"

      - name: Upload report artifact
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: search-quality-report
          path: |
            search-quality-report.json
            search-quality-report.md
```

Remove `npm run build` and `--skip-build` when `build.command` in `search-quality.config.ts` should own the build. The separate form above avoids building twice in repositories that already have an explicit build step.

## Baseline semantics: fail only on regressions

Create a baseline from a reviewed commit:

```bash
search-quality-kit verify \
  --report-only \
  --json \
  --output search-quality-baseline.json
```

Commit `search-quality-baseline.json`. The baseline is a normal report generated by the tool; do not hand-author a list of codes. Then gate only findings absent from it:

```bash
search-quality-kit verify \
  --baseline search-quality-baseline.json \
  --fail-on-new \
  --json \
  --output search-quality-report.json
```

`--fail-on-new` applies the current `ci.failOn` severities only to new findings. With the default `failOn: ["error"]`, a new warning is reported but does not fail. `--report-only` still wins over the finding gate. A missing, malformed, foreign, or schema-incompatible baseline exits `2`.

Identity uses normalized check, code, severity, public URL, file location relative to the audited target, and whitespace-normalized message. Remediation, timestamps, duration, ordering, summary counts, and report metadata are ignored. Relative file identity makes a baseline portable between a developer checkout and a CI runner.

The JSON and Markdown reports distinguish total, existing, new, and resolved findings. Resolved findings are useful review context but never fail the gate. Markdown shows at most 20 resolved items to keep the workflow summary readable.

The complete baseline workflow is available at [`examples/ci/github-actions-baseline.yml`](../examples/ci/github-actions-baseline.yml).

## Markdown pull request artifact

The Markdown report contains the page count and severity totals, then groups findings by severity and `check/code`. Each item includes URL, file location when known, message, remediation, documentation, and stable classifications such as `google-requirement` or `local-heuristic`. In baseline mode it adds dedicated new, existing, and bounded resolved sections.

For Astro, [`examples/ci/github-actions-preset-astro.yml`](../examples/ci/github-actions-preset-astro.yml) shows the complete preset, baseline, job-summary, and artifact flow. The workflow builds once and passes `--skip-build`; presets never trigger a second build themselves.

Use the `report` command to keep the audit output machine-readable while still producing a human review surface:

```bash
search-quality-kit report search-quality-report.json \
  --format markdown \
  --output search-quality-report.md
```

## SARIF and Code Scanning

Generate SARIF 2.1.0 without additional dependencies:

```bash
search-quality-kit report search-quality-report.json \
  --format sarif \
  --output search-quality-report.sarif
```

Each finding becomes a SARIF result, `code` is the rule id, and severities map to `error`, `warning`, and `note`. The URL or known file is used as the artifact URI. The tool deliberately does not invent source line numbers: crawl routes generally cannot be mapped safely to source files.

GitHub workflow-command annotations are not emitted in v0.3 for the same reason. Markdown summaries and SARIF provide bounded, honest review surfaces without pretending that a route has a source line. A future annotation mode should require real source mappings and enforce a configurable cap.

## JSON report compatibility

Every v0.3 report has `schemaVersion: "0.3"`, plus the existing `tool` and package `version` fields. Consumers should branch on `schemaVersion` rather than package version. Baselines with schema `0.3` are validated before comparison; schema-less reports from v0.2 remain accepted as a migration fallback. Other explicit schema versions fail with exit code `2` instead of being compared unsafely.

Dynamic fields such as `generatedAt` and `durationMs` remain useful diagnostics but are never part of baseline identity.

## Monorepos and several configs

The Action runs one config per invocation. Use one step per site or a small explicit matrix; keep each config, baseline, output directory, and artifact name unique.

```yaml
strategy:
  matrix:
    include:
      - site: marketing
        directory: apps/marketing
      - site: docs
        directory: apps/docs

steps:
  - uses: actions/checkout@v7
  - uses: SilesianSolutions/search-quality-kit/action@v0
    with:
      working-directory: ${{ matrix.directory }}
      install-command: npm ci
      build-command: npm run build
      config: search-quality.config.ts
      baseline: search-quality-baseline.json
      fail-on-new: "true"
      output-dir: search-quality-reports
      artifact-name: search-quality-${{ matrix.site }}
```

This is orchestration, not automatic multi-site discovery. Aggregated reports and per-site runner semantics remain proposed v0.7 work.
