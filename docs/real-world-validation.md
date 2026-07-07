# Real-world validation

Validation date: 2026-07-08. Both audits used clean temporary clones; neither target repository was modified. Reports were written under `/tmp`.

## v0.3 CI adoption rerun

The v0.3 candidate was built first, then exercised against clean current clones using each site's committed config and build output. JSON and Markdown were generated separately, and each JSON report was reused with `--baseline ... --fail-on-new` without `--report-only`.

- `SilesianSolutions/silesiansolutions.com` at `133b905`: installed with locked pnpm 11.7.0, built on Node 24.18, then audited 40 pages with 0 errors and 84 warnings. The matching baseline classified all 84 as existing, 0 as new, and 0 as resolved; exit code was `0`.
- `dawidrylko/dawidrylko.com` at `698fff1`: installed with locked pnpm 10.33.0, built 74 generated routes and 1,234 image variants, then audited 73 content pages with 0 errors and 58 warnings. The matching baseline classified all 58 as existing, 0 as new, and 0 as resolved; exit code was `0`.

Reports are `/tmp/search-quality-silesiansolutions-v03.{json,md}` and `/tmp/search-quality-dawidrylko-v03.{json,md}`; baseline comparison reports use the `-baseline.{json,md}` suffix. Totals match the v0.2 candidate rerun, so the report schema, classification metadata, and portable baseline identity did not introduce finding churn.

The v0.2 candidate was revalidated after implementing recursive sitemap traversal, effective HTTP URLs, HTTP orphan inventory, and responsive-image grouping. The reports are `/tmp/search-quality-silesiansolutions-v02.{json,md}` and `/tmp/search-quality-dawidrylko-v02.{json,md}`.

## SilesianSolutions/silesiansolutions.com

The current Astro `dist/` build ran with defaults and no config. The tool inferred the public origin and discovered `sitemap-index.xml` from `robots.txt`.

Result: 42 content pages, 6 errors, 85 warnings.

- Real errors: four internal article links point to routes absent from the build. The target article pages live under `/blog/`, while links point to root-level paths.
- Intentional scope findings: two legal pages contain `noindex`. They should be added to `crawl.exclude` if that policy is intentional; they are not technical defects in that case.
- Real risks: one orphaned blog page, repeated titles on project case studies, heading-level jumps, 27 distinct images above 500 KiB, and several groups of eagerly loaded images.
- Heuristics requiring editorial review: title/description lengths are not Google limits and should not be treated as automatic defects.
- Needed config: none to run; a production CI config should explicitly exclude the intentionally non-indexable legal routes.

Recommended site follow-up: repair four article hrefs, connect the orphaned article, optimize the largest image assets, make case-study titles distinct, review heading hierarchy, and record intentional `noindex` exclusions.

### v0.2 candidate rerun

The clean current checkout was installed and built with its locked pnpm 11.7.0 dependency graph on Node 24.18. Its committed config excludes the two intentional legal `noindex` routes.

Result: 40 audited pages, 0 errors, 84 warnings.

- The Astro sitemap index and child URL set were recursively loaded with no sitemap findings.
- The previously observed broken article links and orphan were absent from the current build; this reflects site changes plus the intentional route exclusions, not suppression in the checks.
- The remaining warning profile is 30 heading skips, three duplicate-title groups, 20 title/description length heuristics, four lazy-loading group hints, and 27 deduplicated large-image hints.
- No obvious new false positive was introduced by recursive sitemap parsing or responsive-image grouping.

## dawidrylko/dawidrylko.com

The existing checkout contained stale Gatsby artifacts in `public/`, while the current repository is Astro. To avoid modifying or auditing stale output, the current `master` was cloned under `/tmp`, installed with its locked pnpm dependencies, and built into `dist/`. The example config is [`examples/real-world/dawidrylko.config.ts`](../examples/real-world/dawidrylko.config.ts).

Result after central fixes: 73 content pages, 0 errors, 58 warnings.

- Real risks: 22 older articles fall back to the same generic meta description and also emit an empty JSON-LD `description`; four blog pagination pages share a description; three older posts skip from H2 to H4.
- Performance hints: nine referenced responsive image variants exceed 500 KiB. These are candidates for browser/Lighthouse verification, not proven Core Web Vitals failures.
- Editorial heuristics: 22 title/description length warnings need human review, not mechanical truncation.
- Needed config: public `baseUrl`, `pnpm build`, and `distDir: "dist"`.

Recommended site follow-up: populate old article descriptions once at the content/data layer so meta and JSON-LD agree, specialize pagination descriptions or allow that duplicate pattern intentionally, review three heading outlines, and inspect the nine heavy image candidates with browser metrics.

### v0.2 candidate rerun

Because the local checkout was behind and contained unrelated untracked Gatsby artifacts, current `master` was cloned under `/tmp`, installed with the locked pnpm 10.33.0 dependency graph, and built with Node 24.18. The build generated 1,234 optimized image variants.

Result: 73 audited pages, 0 errors, 58 warnings—the same totals as the corrected v0.1 run.

- The recursive sitemap index and child URL set produced no sitemap or orphan findings.
- The warning profile remains three heading skips, two duplicate-description groups, 17 description-length heuristics, five title-length heuristics, 22 empty JSON-LD descriptions, and nine large-image hints.
- Responsive variants are now grouped: several findings summarize two large candidates and include the basic `sizes` value (`100vw`) instead of emitting one finding per candidate. The total remained nine and did not expand with the 1,234 generated files.
- No obvious new false positive was found.

## Improvements driven by these tests

The first baseline exposed false positives in the tool. v0.1 was corrected centrally to:

- discover a sitemap declared by `robots.txt`, including Astro's `sitemap-index.xml`;
- ignore generated 404 aliases by default;
- aggregate repeated large-image findings per asset;
- treat static meta-refresh redirect stubs as redirects rather than content pages;
- preserve trailing-slash directory semantics when resolving relative links.

The v0.2 work closes the four crawler/reporting gaps above in core: bounded recursive sitemap indexes, initial/final HTTP URLs, sitemap-backed HTTP orphan candidates, and grouped `srcset` hints with basic `sizes` context. Redirect and HTTP orphan behavior are covered by deterministic local-server fixtures because both real repositories use static mode.

Remaining limits:

- sitemap traversal is intentionally bounded and same-origin; a limit produces `sitemap/fetch-limit` rather than unbounded fetches;
- `sizes` parsing recognizes basic `px` and `vw` context but does not simulate viewports, DPR selection, transfer compression, or rendering priority;
- HTTP orphan results are bounded by configured crawl scope and the URLs available from sitemap files and delivered links;
- the tool parses delivered HTML but does not execute JavaScript or measure LCP, INP, or CLS.
