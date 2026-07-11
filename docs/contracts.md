# Search quality contracts

A search quality contract is a deterministic export of the validated policy in
a site or portfolio config. It gives developers, CI, and coding agents the
rules they must preserve without building, crawling, or auditing the site.

## Site contract

```bash
search-quality-kit contract \
  --config search-quality.config.ts \
  --output search-quality-contract.json
```

The JSON contract uses `schemaVersion: "0.9"` and `type: "site"`. It includes:

- the production base URL;
- crawl mode, entrypoints, include/exclude rules, and bounded crawl limits;
- default and route profiles;
- enabled and disabled core checks;
- configured rule thresholds;
- safe plugin metadata: plugin name, source, check IDs, classifications,
  default severities, and documentation URLs;
- policy pack names and serializable option summaries;
- reviewed suppressions with route scope, reason, owner, and optional expiry;
- the configured CI severity gate.

The export never executes `build.command`, `build.startCommand`, the crawler, or
plugin check functions. It omits build commands, environment variables, local
preview URLs, staging hosts, and plugin functions. A config module itself is
loaded and validated exactly as it is for the normal CLI, so keep config modules
free of unrelated side effects.

## Portfolio contract

```bash
search-quality-kit contract \
  --portfolio-config portfolio.search-quality.config.ts \
  --output portfolio-contract.json
```

The portfolio contract includes the portfolio gate, shared output directory,
and each site's name, enabled state, root, config path, baseline path, output
directory, and validated site-contract summary. Site configs are loaded but no
site is built or crawled.

Portfolio contracts are useful before a coding agent edits one site in a group:
the agent can see the intended crawl scope, profiles, policy packs, baselines,
suppressions, and gate policy for every configured site without running the
portfolio audit.

## Markdown format

Use Markdown when the contract should be reviewed in a pull request or supplied
directly to a coding agent:

```bash
search-quality-kit contract \
  --config search-quality.config.ts \
  --format markdown \
  --output search-quality-contract.md
```

JSON is the default and should be preferred for automation. Both formats are
deterministic for the same resolved config and intentionally omit timestamps.

## Contract versus handoff

Use a contract before changing code: it explains the rules that must remain
true. Use a handoff report after an audit: it explains which findings need
action, which findings are reviewed suppressions, which findings are baseline
debt, and which findings were resolved.

```bash
search-quality-kit report search-quality-report.json \
  --format handoff \
  --output search-quality-handoff.md

search-quality-kit report portfolio.json \
  --format handoff \
  --output portfolio-handoff.md
```

Neither format crawls, builds, calls Google APIs, or scores content quality.

## CI usage

Contract export is a cheap validation step because it does not need a build
artifact or network access:

```yaml
- name: Export search quality contract
  run: >-
    pnpm exec search-quality-kit contract
    --config search-quality.config.ts
    --output search-quality-contract.json

- uses: actions/upload-artifact@v7
  with:
    name: search-quality-contract
    path: search-quality-contract.json
```

Do not put secrets in config values that are intentionally part of the public
policy, including suppression reasons, owners, URLs, or policy pack options.
