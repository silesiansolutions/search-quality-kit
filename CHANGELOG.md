# Changelog

All notable changes to this project are documented here.

## [0.1.3] - 2026-07-07

- Keep excluded and over-limit HTML routes in the static route inventory so links to intentionally non-audited pages are not reported as missing.
- Add a regression test for links from audited pages to excluded routes.

## [0.1.2] - 2026-07-07

- Derive the CLI, report, and crawler user-agent version from `package.json` instead of a hard-coded value.
- Add a regression test that keeps runtime and package versions aligned.

## [0.1.1] - 2026-07-07

- Add tag-driven npm publishing through GitHub Actions and npm Trusted Publishing (OIDC).
- Create a GitHub Release automatically after a successful npm publish.
- Add release documentation and enforce the `v${package.version}` tag contract.
- Improve the npm/GitHub package description, links, badges, and README.
- Ensure `npm pack` always builds the distributable CLI.

## [0.1.0] - 2026-07-07

- Initial public release with static-build and HTTP crawl modes.
- Add eleven technical search-quality checks, typed configuration, console/JSON/Markdown reports, and CI exit codes.
- Validate the tool against `SilesianSolutions/silesiansolutions.com` and `dawidrylko/dawidrylko.com`.

[0.1.3]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/silesiansolutions/search-quality-kit/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/SilesianSolutions/search-quality-kit/releases/tag/v0.1.0
