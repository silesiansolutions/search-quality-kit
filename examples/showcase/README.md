# Public portfolio showcase

This example audits four public production sites over HTTP: `dawidrylko.com`, `silesiansolutions.com`, `cyberkatalog.pl`, and `dawid.dev`. It uses no secrets, does not mutate a site, and writes changing reports only to `search-quality-reports/` for artifact upload.

The configs demonstrate configurable policy packs in report-only mode:

- `dawidrylko.com`: `personalBrand` plus `aiVisibilitySafe` with Polish
  contact labels and scoped blog routes;
- `silesiansolutions.com`: `companySite` plus `aiVisibilitySafe` with
  English/Polish contact labels and one reviewed suppression example;
- `cyberkatalog.pl`: `directory` plus `aiVisibilitySafe` with directory route
  scope and reviewed snippet-directive exceptions;
- `dawid.dev`: no policy packs, the minimal showcase entry.

Run it from the repository root:

```bash
npm run build
node dist/cli/index.js portfolio verify \
  --config examples/showcase/portfolio.search-quality.config.ts \
  --report-only \
  --output-dir search-quality-reports \
  --sarif
node dist/cli/index.js contract \
  --portfolio-config examples/showcase/portfolio.search-quality.config.ts \
  --output search-quality-reports/portfolio-contract.json
node dist/cli/index.js report \
  search-quality-reports/portfolio.json \
  --format handoff \
  --output search-quality-reports/portfolio-handoff.md
```

The manifest is report-only by default because public sites can change independently of this package. Results are examples of deterministic technical checks at crawl time, not an SEO score or ranking.

No baseline is committed initially. To adopt reviewed per-site baselines, add a safe `baseline` path to each site entry, run `portfolio baseline`, review each single-site JSON file, and commit only snapshots the maintainers intentionally accept. Existing files require `--force` before replacement.

See [the full showcase guide](../../docs/showcase.md) and [`snapshots/README.md`](snapshots/README.md).
