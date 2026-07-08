# Multi-site and monorepo design

Status: design only for v0.4. The core runner remains single-site and deterministic.

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

## Future CLI direction

The smallest future API is repeated single-site invocation with root-relative paths:

```bash
search-quality-kit verify --config sites/site-a/search-quality.config.ts
search-quality-kit verify --config sites/site-b/search-quality.config.ts
```

Before implementing that exact form, path resolution must be specified: whether build paths are relative to process cwd, config location, or an explicit site root. The current `--root` contract is unambiguous and should not be weakened.

A future orchestrator could accept a manifest of named existing configs, not embed several sites inside today's schema:

```ts
export default defineWorkspace({
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

The orchestrator would run the current engine independently, preserve per-site reports/baselines/exit status, and produce a thin aggregate summary. A `defineConfig({ sites: [...] })` shape is not recommended: it would overload single-site fields, complicate backward compatibility, and tempt cross-site crawling and baseline merging.

## Non-goals

v0.4 does not add workspace discovery, parallel scheduling, cross-site link analysis, a combined baseline, or a partially supported `sites` field. Repository-native CI matrices already provide explicit scheduling, caching, ownership, and failure isolation.
