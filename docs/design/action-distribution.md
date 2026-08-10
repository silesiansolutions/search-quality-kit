# Composite Action distribution

## Decision

The composite Action moves from `action/action.yml` to the repository root (`action.yml`), so the project can be listed on the GitHub Marketplace. The existing subdirectory path stays as a shim so every documented `uses:` reference keeps working.

This removes two concrete blockers:

- **Subdirectory metadata is unlistable.** GitHub Marketplace requires the action metadata file at the repository root; a metadata file in a subfolder works for `uses:` but cannot be published to the Marketplace. Source: https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace
- **Missing `branding:` and `author:`.** `action/action.yml` (110 lines) has no `branding:` key and no `author:` key (`grep -n "^branding:\|^author:" action/action.yml` returns nothing). Both are required Marketplace listing fields alongside root placement.

A Marketplace search for this project returns no result today — it is not listed. The `seo` category holds roughly 29 actions, mostly low-quality, so competition for a listed entry is thin.

## Why this matters now

Package adoption as of 2026-08-10: 83 npm downloads in the last week, 2 GitHub stars, 0 forks, 0 issues, 0 external contributors. Marketplace listing is the only cheap discovery channel available to a project at this size — no ad budget, no existing audience, no SEO backlog for the Action itself. That is the entire justification for spending a design note on distribution rather than a feature.

## Options considered

**(a) Leave as is.** Permanently unlistable: the metadata file stays in `action/`, so the Marketplace requirement is never met. Forgoes the only cheap discovery channel this project has. Rejected.

**(b) Separate repository for the Action.** Splits release coordination across two repositories, requires the moving `v0` tag (see `docs/releasing.md`) to be created and repointed in two places on every release, and duplicates CI for a wrapper that is 236 lines total (`action/action.yml`, 110 lines, plus `action/run.sh`, 126 lines). The maintenance cost is disproportionate to the code it protects. Rejected.

**(c) Root metadata plus subdirectory shim.** Chosen. `action.yml` at the repository root becomes the canonical, Marketplace-eligible metadata, carrying `branding:` and `author:`. `action/action.yml` remains in place as a shim so `SilesianSolutions/search-quality-kit/action@v0` keeps resolving.

## Open risk: `uses: ./` resolution

The straightforward shim implementation has the subdirectory `action/action.yml` delegate to the root action with `uses: ./` (or an equivalent relative reference). This pattern has historically resolved relative to the **consumer's** workspace rather than the action's own repository when invoked from a nested composite step context — behavior that has shifted across GitHub Actions runner versions and is not something to assume compatible today.

If `uses: ./`-style delegation does not resolve correctly, the fallback is that both metadata files — the root `action.yml` and `action/action.yml` — independently invoke the shared `action/run.sh`, with no delegation between the two `runs:` blocks. A test must assert the two `runs:` blocks stay in sync (same steps, same environment variable mapping) so they cannot drift.

Either way, this must be verified against a real workflow run — a workflow in this repository or a scratch repository that exercises both `SilesianSolutions/search-quality-kit@v0` and `SilesianSolutions/search-quality-kit/action@v0` — before merge. It is not something to assume works from reading the composite-action documentation alone.

## Backward compatibility

Every documented `uses:` path must keep resolving after the move:

- `README.md:192` — `uses: SilesianSolutions/search-quality-kit/action@v0`
- `docs/ci.md` — the same path, at lines 51, 67, 83, 100, 235, 352, and 371

`tests/action.test.ts:46` asserts the composite action's step `uses:` list by exact equality (`["actions/setup-node@v6", "actions/setup-node@v6", "actions/upload-artifact@v7"]`). Any structural change to either `runs:` block must keep this assertion — or its root-level equivalent — passing; a shim that changes step order or introduces new steps breaks it.

Per `docs/releasing.md`, the moving `v0` major tag is force-moved to the release commit after each npm publish. Introducing root metadata does not change that procedure, but the tag now has to point at a commit where both the root and subdirectory metadata resolve correctly — the release runbook does not change, the verification bar for what "correct" means at that commit does.

## npm package unaffected

`package.json` `files` is `["dist", "docs", "examples", "README.md", "CHANGELOG.md", "LICENSE"]` — it does not include `action/` or a root `action.yml`. Moving or duplicating the Action metadata has no effect on what ships to npm.
