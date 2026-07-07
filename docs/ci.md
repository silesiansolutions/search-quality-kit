# Continuous integration

Start with `--report-only` for one or two pull requests, triage findings, then remove it to enforce errors.

```yaml
name: Search Quality
on: [pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx search-quality-kit verify --json --output search-quality-report.json
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: search-quality-report
          path: search-quality-report.json
```

Default exit codes are `0` for no errors, `1` for configured finding severities, and `2` for CLI/config/runtime failures. Warnings do not fail CI unless `ci.failOn` includes `warning`. `ci.warnOnly` and `--report-only` force a successful finding outcome, but runtime failures still remain visible.

Pin a released dependency version for reproducible CI. A dedicated composite Action is not required for v1 because the CLI works in any Node workflow.
