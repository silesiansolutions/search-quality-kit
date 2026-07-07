# Real-world validation

Validation date: 2026-07-07. Both audits used `--report-only`; neither target repository was modified. Reports were written under `/tmp`.

## SilesianSolutions/silesiansolutions.com

The current Astro `dist/` build ran with defaults and no config. The tool inferred the public origin and discovered `sitemap-index.xml` from `robots.txt`.

Result: 42 content pages, 6 errors, 85 warnings.

- Real errors: four internal article links point to routes absent from the build. The target article pages live under `/blog/`, while links point to root-level paths.
- Intentional scope findings: two legal pages contain `noindex`. They should be added to `crawl.exclude` if that policy is intentional; they are not technical defects in that case.
- Real risks: one orphaned blog page, repeated titles on project case studies, heading-level jumps, 27 distinct images above 500 KiB, and several groups of eagerly loaded images.
- Heuristics requiring editorial review: title/description lengths are not Google limits and should not be treated as automatic defects.
- Needed config: none to run; a production CI config should explicitly exclude the intentionally non-indexable legal routes.

Recommended site follow-up: repair four article hrefs, connect the orphaned article, optimize the largest image assets, make case-study titles distinct, review heading hierarchy, and record intentional `noindex` exclusions.

## dawidrylko/dawidrylko.com

The existing checkout contained stale Gatsby artifacts in `public/`, while the current repository is Astro. To avoid modifying or auditing stale output, the current `master` was cloned under `/tmp`, installed with its locked pnpm dependencies, and built into `dist/`. The example config is [`examples/real-world/dawidrylko.config.ts`](../examples/real-world/dawidrylko.config.ts).

Result after central fixes: 73 content pages, 0 errors, 58 warnings.

- Real risks: 22 older articles fall back to the same generic meta description and also emit an empty JSON-LD `description`; four blog pagination pages share a description; three older posts skip from H2 to H4.
- Performance hints: nine referenced responsive image variants exceed 500 KiB. These are candidates for browser/Lighthouse verification, not proven Core Web Vitals failures.
- Editorial heuristics: 22 title/description length warnings need human review, not mechanical truncation.
- Needed config: public `baseUrl`, `pnpm build`, and `distDir: "dist"`.

Recommended site follow-up: populate old article descriptions once at the content/data layer so meta and JSON-LD agree, specialize pagination descriptions or allow that duplicate pattern intentionally, review three heading outlines, and inspect the nine heavy image candidates with browser metrics.

## Improvements driven by these tests

The first baseline exposed false positives in the tool. v0.1 was corrected centrally to:

- discover a sitemap declared by `robots.txt`, including Astro's `sitemap-index.xml`;
- ignore generated 404 aliases by default;
- aggregate repeated large-image findings per asset;
- treat static meta-refresh redirect stubs as redirects rather than content pages;
- preserve trailing-slash directory semantics when resolving relative links.

Known gaps exposed by the validation:

- sitemap indexes are validated but child sitemap files are not recursively parsed yet;
- remote HTTP mode does not retain the final response URL after redirects;
- responsive-image hints do not model `sizes`, viewport selection, or transfer compression;
- orphan detection is strongest in static mode and does not yet combine sitemap URLs with an HTTP crawl;
- v1 parses delivered HTML but does not execute JavaScript or measure Core Web Vitals.
