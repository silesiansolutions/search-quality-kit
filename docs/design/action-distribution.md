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

## How the shim works: no delegation at all

The obvious shim has `action/action.yml` delegate to the root action with `uses: ./`. That was rejected. Local `uses:` paths inside a composite action have historically resolved against the consumer's workspace rather than the action's own repository, and the behavior has moved across runner versions — a dependency on undocumented resolution order is not something to build a compatibility guarantee on.

There is no need for it. Both metadata files invoke the same `action/run.sh`, and `github.action_path` already points at the directory holding the metadata file being executed. The root file calls `${{ github.action_path }}/action/run.sh`; the subdirectory file calls `${{ github.action_path }}/run.sh`. One script, two entry points, no delegation, no runner-version dependency.

The cost is two metadata files that can drift. A test asserts they declare identical inputs, outputs, name and description, and identical `runs` steps once the script path is normalized — so a change to one that is not made to the other fails the suite rather than reaching a consumer.

The root file additionally carries `branding` and `author`, which the subdirectory file does not need and which the sync test deliberately ignores.

Verified against a real workflow run rather than assumed: `.github/workflows/showcase.yml` was switched from `uses: ./action` to `uses: ./`, so the root metadata is exercised by a live four-site audit on every pull request that touches it.

## Backward compatibility

Every documented `uses:` path must keep resolving after the move:

- `README.md:192` — `uses: SilesianSolutions/search-quality-kit/action@v0`
- `docs/ci.md` — the same path, at lines 51, 67, 83, 100, 235, 352, and 371

`tests/action.test.ts:46` asserts the composite action's step `uses:` list by exact equality (`["actions/setup-node@v6", "actions/setup-node@v6", "actions/upload-artifact@v7"]`). Any structural change to either `runs:` block must keep this assertion — or its root-level equivalent — passing; a shim that changes step order or introduces new steps breaks it.

Per `docs/releasing.md`, the moving `v0` major tag is force-moved to the release commit after each npm publish. Introducing root metadata does not change that procedure, but the tag now has to point at a commit where both the root and subdirectory metadata resolve correctly — the release runbook does not change, the verification bar for what "correct" means at that commit does.

## npm package unaffected

`package.json` `files` is `["dist", "docs", "examples", "README.md", "CHANGELOG.md", "LICENSE"]` — it does not include `action/` or a root `action.yml`. Moving or duplicating the Action metadata has no effect on what ships to npm.
