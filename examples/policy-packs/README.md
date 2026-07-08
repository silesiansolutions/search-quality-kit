# Policy pack examples

These configs show the smallest practical way to adopt built-in policy packs.
They are examples only; replace `site.baseUrl`, route patterns, and exclusions
with the audited site.

- [`personal-brand.config.ts`](personal-brand.config.ts): personal/blog site
  using `personalBrand` and `aiVisibilitySafe`.
- [`company-site.config.ts`](company-site.config.ts): company/service site
  using `companySite` and `aiVisibilitySafe`.
- [`directory.config.ts`](directory.config.ts): directory/blog site using
  `directory` and `aiVisibilitySafe`.

Roll out on an existing site in this order:

1. update the package;
2. add the closest preset, site profile, route profiles, and policy packs;
3. run `search-quality-kit doctor`;
4. run `verify --report-only`;
5. review the Markdown report;
6. create a baseline only for accepted existing debt;
7. gate with `--baseline ... --fail-on-new`.
