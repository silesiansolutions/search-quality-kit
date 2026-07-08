# Multi-site and monorepo design

Status: implemented in v0.7 as a thin portfolio orchestrator. The core site runner remains isolated and deterministic.

## Recommended operation today

Keep one config and baseline per deployable site. Run the existing CLI once for each site from the monorepo root:

```bash
search-quality-kit verify \
  --root sites/marketing \
  --config search-quality.config.ts \
  --baseline search-quality-baseline.json \
  --fail-on-new \
  --json \
  --output search-quality-report.json

search-quality-kit verify \
  --root sites/docs \
  --config search-quality.config.ts \
  --baseline search-quality-baseline.json \
  --fail-on-new \
  --json \
  --output search-quality-report.json
```

Alternatively, keep configs in a root `search-quality/` directory and pass paths explicitly. `--config` is resolved relative to `--root`, so keep each config near its build when possible. Separate files make framework presets, output directories, public origins, exclusions, limits, and ownership visible without conditional configuration code.

## CI aggregation

Use a matrix with stable site names. Each matrix job writes unique paths such as `reports/marketing.json` and `reports/docs.json`, then uploads a site-named artifact. Let each invocation retain its own exit code; a shell loop must accumulate failures rather than stopping before later reports are produced.

A final summary job may concatenate Markdown reports under site headings. It should not merge raw finding arrays or rewrite targets because baseline identity includes target-relative file locations. JSON remains one report per site.

## Baselines

Store one baseline per site, for example:

```text
search-quality/
  marketing.baseline.json
  docs.baseline.json
```

Never share a baseline across origins. Review and update only the affected site's baseline. Renaming a package or moving its build directory should be checked for baseline identity churn before merge.

## Implemented CLI direction

The single-site API remains available for explicit repeated invocation:

```bash
search-quality-kit verify --config sites/site-a/search-quality.config.ts
search-quality-kit verify --config sites/site-b/search-quality.config.ts
```

Before implementing that exact form, path resolution must be specified: whether build paths are relative to process cwd, config location, or an explicit site root. The current `--root` contract is unambiguous and should not be weakened.

The v0.7 orchestrator accepts a manifest of named existing configs instead of embedding sites inside the single-site schema:

```ts
export default definePortfolioConfig({
  sites: [
    {
      name: "marketing",
      root: "sites/marketing",
      config: "search-quality.config.ts",
    },
    { name: "docs", root: "sites/docs", config: "search-quality.config.ts" },
  ],
});
```

The orchestrator runs the current engine independently, preserves per-site reports/baselines/status, and produces a thin aggregate summary. A `defineConfig({ sites: [...] })` shape remains intentionally unsupported because it would overload single-site fields, complicate backward compatibility, and tempt cross-site crawling and baseline merging.

## Non-goals

v0.7 does not add workspace discovery, parallel scheduling, cross-site link analysis, a combined baseline, external trend storage, or a partially supported single-site `sites` field. Repository-native CI matrices still provide explicit parallel scheduling, caching, ownership, and failure isolation.
