# Releasing

Releases are automated by [`.github/workflows/release.yml`](../.github/workflows/release.yml). The workflow uses npm Trusted Publishing (OIDC), so no long-lived npm token is stored in GitHub.

## One-time npm configuration

The package must trust this exact publisher:

- Provider: GitHub Actions
- GitHub organization: `silesiansolutions` (the canonical, case-sensitive owner claim)
- Repository: `search-quality-kit`
- Workflow filename: `release.yml`
- Environment: none
- Allowed action: `npm publish`

The package is public and the repository URL in `package.json` must continue to match the GitHub repository exactly. See the official [npm Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/).

## Create a release

1. Update `CHANGELOG.md` if the release warrants it.
2. Bump the package version without creating a tag:

   ```bash
   npm version patch --no-git-tag-version
   ```

3. Commit and push the version change to `master`.
4. Create and push the matching tag from that commit:

   ```bash
   git tag -a "v$(node -p 'require("./package.json").version')" -m "Release"
   git push origin --follow-tags
   ```

The tag must equal `v${package.version}`. The workflow then:

1. installs dependencies on Node 24 with a current npm CLI;
2. validates the tag/version contract;
3. runs type checking, lint, tests, build, audit-safe packaging checks;
4. publishes the public package to npm through OIDC with automatic provenance;
5. creates the GitHub Release only after npm publishing succeeds.

If any step fails, npm is not published by later steps and no misleading GitHub Release is created.
