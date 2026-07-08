# Check catalog

Every finding has a stable `code`, severity, location, remediation, tool documentation link, classification, and—where relevant—an official Google reference. Classifications are machine-readable in JSON, printed by `list-checks`, and shown in Markdown reports:

- `google-requirement`: a minimum technical or documented protocol requirement.
- `google-recommendation`: official guidance, not a ranking guarantee.
- `local-heuristic`: a configurable project threshold or deterministic approximation.
- `cross-channel-metadata`: metadata used outside Google Search, currently Open Graph.
- `accessibility-basic`: a narrow semantic/accessibility check, not WCAG conformance.
- `profile-expectation`: a site/route-specific expectation configured by the project; not a universal Google requirement.

Checks can inherit more than one classification. The sources below are official Google Search Central or Google Crawling Infrastructure documentation, reviewed in July 2026.

New reports also include `source`. Built-in findings use `{"type":"core","name":"<check>"}`; custom findings use `{"type":"plugin","name":"<plugin>"}`. Source attribution is visible in JSON, Markdown, and SARIF properties but is not part of the v0.3 baseline fingerprint, preserving compatibility with older baselines. Custom checks and their classification rules are documented in [Custom checks and plugins](plugins.md).

## sitemap

Classification: `google-recommendation`, `local-heuristic`.

Checks the sitemap declared by `robots.txt` (with conventional fallbacks), detects `<sitemapindex>`, recursively loads child indexes and URL sets, and validates every file at its own URL/file location. It checks valid XML, absolute HTTP(S) URLs, configured origin, production host leaks, duplicates across children, excluded page paths, and valid `lastmod` syntax. Traversal is deduplicated and bounded by `crawl.maxSitemaps` and `crawl.maxSitemapDepth`. Google describes sitemap URL and date requirements in [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap). A sitemap is a discovery hint, not an indexing guarantee.

## robots

Classification: `google-requirement`, `local-heuristic`.

Checks availability, recognized field syntax, root-relative allow/disallow paths, accidental site-wide blocking, absolute sitemap declarations, and local/staging leaks. Based on [Google's robots.txt specification](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec). robots.txt controls crawling, not reliable de-indexing; use supported `noindex` mechanisms for that purpose.

## indexability

Classification: `google-requirement`.

Checks that crawled public pages return HTTP 200 and do not carry `noindex`/`none` in robots metadata or `X-Robots-Tag`. These are among Google's [minimum technical requirements](https://developers.google.com/search/docs/essentials/technical) and [robots meta specifications](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag). Passing does not guarantee indexing.

HTTP crawls retain both the initial and final response URL. Normal same-origin redirects, including trailing-slash normalization, are not findings. A redirect from an internal URL outside the configured public origin is reported as `redirect-outside-origin`.

Static HTML redirect stubs with `meta http-equiv="refresh"` are treated as navigation artifacts rather than indexable content pages, while their generated route remains available to link resolution.

## metadata

Classification: `google-recommendation`, `local-heuristic`.

Checks non-empty and non-generic titles, descriptions, duplicates, document language, and viewport metadata. Google's guidance favors descriptive, concise, distinct title text and useful page-specific descriptions: [title links](https://developers.google.com/search/docs/appearance/title-link) and [snippets](https://developers.google.com/search/docs/appearance/snippet). Length ranges are configurable project heuristics, not Google limits.

## canonical

Classification: `google-recommendation`, `local-heuristic`.

Checks presence when configured, one non-empty absolute production URL, origin consistency, normalized self-reference, sitemap/canonical agreement, and redirected sitemap URLs. In HTTP mode, self-reference is compared with the final response URL after redirects. Based on [canonical URL guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls). A non-self canonical is a warning because legitimate duplicate consolidation exists.

## structured-data

Classification: `google-recommendation`, `local-heuristic`. Structured data is not required for ordinary indexing; applicable properties and policies become requirements only for specific rich-result eligibility.

Parses JSON-LD and recognizes `Person`, `Organization`, `WebSite`, `WebPage`, `Article`, `BlogPosting`, `BreadcrumbList`, `ItemList`, `LocalBusiness` subtypes, and `Service`. It checks `@context`, `@type`, empty values, obvious placeholders, URL syntax, non-production URLs, conflicting `@id` definitions, page-level URL/canonical agreement, and only obvious name/headline/description conflicts after whitespace, casing, and brand-suffix normalization.

Profile rules add warning-level expected types and a few bounded property hints. Article fields are labeled `google-recommendation`; breadcrumb eligibility properties are labeled `google-requirement`; directory/list and site-type assumptions are labeled `profile-expectation`. Local-business contact/address/opening-hours values are never invented or universally forced. Google recommends valid, visible-content-aligned markup in [structured data basics](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data), [general guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies), [Article documentation](https://developers.google.com/search/docs/appearance/structured-data/article), and [LocalBusiness documentation](https://developers.google.com/search/docs/appearance/structured-data/local-business). This check is intentionally not a feature-complete validator and does not replace Rich Results Test.

## open-graph

Classification: `cross-channel-metadata`, `local-heuristic`; Open Graph is not a Google Search requirement.

Checks `og:title`, `og:description`, `og:url`, `og:type`, optional `og:image`, production URLs, agreement between `og:url` and canonical, and only obvious semantic conflicts with title/H1/meta description. Exact wording and common brand suffixes may differ. Open Graph itself is not a Google Search requirement; it is included as a cross-channel metadata regression check.

## internal-links

Classification: `google-recommendation`, `local-heuristic`.

Checks crawlable `href` values, malformed/empty links, local host leaks, known 404s, missing static routes, accessible anchor text, and orphans. Static mode uses the build inventory. HTTP mode combines entrypoints, discovered internal links, and recursively collected sitemap URLs; `crawl.exclude` removes intentionally isolated routes from orphan candidates. Relative links are resolved against the final response URL. Based on Google's [crawlable link best practices](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) and Search Essentials' emphasis on discoverable links.

## rendered-html

Classification: `google-requirement`, `google-recommendation`, `local-heuristic`.

Checks meaningful visible text in delivered HTML, optional `<main>`, H1 policy, and placeholder-only app shells. This catches obvious JavaScript rendering risks described in [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics). v1 parses delivered HTML and does not execute JavaScript.

## accessibility

Classification: `accessibility-basic`; this is not a WCAG audit or ranking-factor claim.

Checks basic image alternatives, accessible link/button names, document language, and severe heading-level jumps. These checks improve semantic usability and help avoid content-discovery regressions, but they are not a WCAG conformance audit.

## performance-hints

Classification: `google-recommendation`, `local-heuristic`.

Flags configurable HTML/image size, excessive third-party scripts, missing lazy loading for many distinct non-primary images, and local/staging asset URLs. Responsive candidates from `srcset` and `<picture>` are grouped, repeated groups are deduplicated, and simple `px`/`vw` values in `sizes` are included as context without simulating viewport selection. Google recommends good real-world [Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals), but these static hints do not measure LCP, INP, or CLS and do not replace Lighthouse or field data.

## Broader policy context

The tool intentionally does not automate subjective content or spam judgments. Teams should separately follow [Search Essentials](https://developers.google.com/search/docs/essentials), [spam policies](https://developers.google.com/search/docs/essentials/spam-policies), [people-first content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), [image SEO](https://developers.google.com/search/docs/appearance/google-images), and [favicon requirements](https://developers.google.com/search/docs/appearance/favicon-in-search).
