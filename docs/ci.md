# Continuous integration

Start with `--report-only` for one or two pull requests, triage findings, then remove it to enforce errors.

```yaml
name: Search Quality
on: [pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx @silesiansolutions/search-quality-kit verify --json --output search-quality-report.json
      - uses: actions/upload-artifact@v7
        if: always()
        with:
          name: search-quality-report
          path: search-quality-report.json
```

Default exit codes are `0` for no errors, `1` for configured finding severities, and `2` for CLI/config/runtime failures. Warnings do not fail CI unless `ci.failOn` includes `warning`. `ci.warnOnly` and `--report-only` force a successful finding outcome, but runtime failures still remain visible.

Pin a released dependency version for reproducible CI. A dedicated composite Action is not required because the CLI works in any Node workflow.

## Baseline only new findings

Create a reviewed baseline with a normal JSON report:

```bash
search-quality-kit verify --report-only --json --output search-quality-baseline.json
```

Commit that file, then fail only when a finding is absent from it:

```bash
search-quality-kit verify \
  --baseline search-quality-baseline.json \
  --fail-on-new
```

Findings are compared deterministically by check, code, URL, file location, and whitespace-normalized message. Severity and remediation copy do not affect identity. Update the baseline only after reviewing resolved, changed, or intentionally accepted findings. `--fail-on-new` requires `--baseline`; `--report-only` still forces a successful finding outcome.

## Markdown and GitHub step summary

The Markdown formatter includes severity, check, stable code, location, message, and remediation. It can be uploaded as an artifact, posted to a pull request by a separate trusted step, or appended to the built-in workflow summary:

```yaml
- name: Search quality gate
  shell: bash
  run: |
    set +e
    npx @silesiansolutions/search-quality-kit verify \
      --baseline search-quality-baseline.json \
      --fail-on-new \
      --format markdown \
      --output search-quality-report.md
    status=$?
    cat search-quality-report.md >> "$GITHUB_STEP_SUMMARY"
    exit "$status"
- uses: actions/upload-artifact@v7
  if: always()
  with:
    name: search-quality-report
    path: search-quality-report.md
```
