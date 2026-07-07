# Check catalog

Every finding has a stable `code`, severity, location, remediation, tool documentation link, and—where relevant—an official Google reference. The sources below are official Google Search Central or Google Crawling Infrastructure documentation, reviewed for v0.1 in July 2026.

## sitemap

Basis: Google recommendation plus local regression heuristics.

Checks the sitemap declared by `robots.txt` (with conventional fallbacks), detects `<sitemapindex>`, recursively loads child indexes and URL sets, and validates every file at its own URL/file location. It checks valid XML, absolute HTTP(S) URLs, configured origin, production host leaks, duplicates across children, excluded page paths, and valid `lastmod` syntax. Traversal is deduplicated and bounded by `crawl.maxSitemaps` and `crawl.maxSitemapDepth`. Google describes sitemap URL and date requirements in [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap). A sitemap is a discovery hint, not an indexing guarantee.

## robots

Basis: Google technical requirement plus local regression heuristics.

Checks availability, recognized field syntax, root-relative allow/disallow paths, accidental site-wide blocking, absolute sitemap declarations, and local/staging leaks. Based on [Google's robots.txt specification](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec). robots.txt controls crawling, not reliable de-indexing; use supported `noindex` mechanisms for that purpose.

## indexability

Basis: Google technical requirement.

Checks that crawled public pages return HTTP 200 and do not carry `noindex`/`none` in robots metadata or `X-Robots-Tag`. These are among Google's [minimum technical requirements](https://developers.google.com/search/docs/essentials/technical) and [robots meta specifications](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag). Passing does not guarantee indexing.

HTTP crawls retain both the initial and final response URL. Normal same-origin redirects, including trailing-slash normalization, are not findings. A redirect from an internal URL outside the configured public origin is reported as `redirect-outside-origin`.

Static HTML redirect stubs with `meta http-equiv="refresh"` are treated as navigation artifacts rather than indexable content pages, while their generated route remains available to link resolution.

## metadata

Basis: Google recommendation plus local heuristics.

Checks non-empty and non-generic titles, descriptions, duplicates, document language, and viewport metadata. Google's guidance favors descriptive, concise, distinct title text and useful page-specific descriptions: [title links](https://developers.google.com/search/docs/appearance/title-link) and [snippets](https://developers.google.com/search/docs/appearance/snippet). Length ranges are configurable project heuristics, not Google limits.

## canonical

Basis: Google recommendation plus local regression heuristics.

Checks presence when configured, one non-empty absolute production URL, origin consistency, and normalized self-reference. In HTTP mode, self-reference is compared with the final response URL after redirects. Based on [canonical URL guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls). A non-self canonical is a warning because legitimate duplicate consolidation exists.

## structured-data

Basis: Google structured-data recommendations plus local regression heuristics. Structured data is not required for ordinary indexing; applicable properties and policies become requirements only for specific rich-result eligibility.

Parses JSON-LD and checks `@context`, `@type`, empty values, obvious placeholders, non-production URLs, and conflicting types for the same `@id`. Google recommends JSON-LD and accurate, visible-content-aligned markup in [structured data basics](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) and [general guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies). This check does not implement feature-specific required properties and does not replace Rich Results Test.

## open-graph

Basis: local heuristic; Open Graph is not a Google Search requirement.

Checks `og:title`, `og:description`, `og:url`, `og:type`, optional `og:image`, production URLs, and agreement between `og:url` and canonical. Open Graph itself is not a Google Search requirement; it is included as a cross-channel metadata regression check.

## internal-links

Basis: Google recommendation plus local regression heuristics.

Checks crawlable `href` values, malformed/empty links, local host leaks, known 404s, missing static routes, accessible anchor text, and orphans. Static mode uses the build inventory. HTTP mode combines entrypoints, discovered internal links, and recursively collected sitemap URLs; `crawl.exclude` removes intentionally isolated routes from orphan candidates. Relative links are resolved against the final response URL. Based on Google's [crawlable link best practices](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) and Search Essentials' emphasis on discoverable links.

## rendered-html

Basis: Google technical requirements and recommendations plus local heuristics.

Checks meaningful visible text in delivered HTML, optional `<main>`, H1 policy, and placeholder-only app shells. This catches obvious JavaScript rendering risks described in [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics). v1 parses delivered HTML and does not execute JavaScript.

## accessibility

Basis: local semantic-quality heuristics; this is not a WCAG audit or ranking-factor claim.

Checks basic image alternatives, accessible link/button names, document language, and severe heading-level jumps. These checks improve semantic usability and help avoid content-discovery regressions, but they are not a WCAG conformance audit.

## performance-hints

Basis: Google performance recommendation plus local static heuristics.

Flags configurable HTML/image size, excessive third-party scripts, missing lazy loading for many distinct non-primary images, and local/staging asset URLs. Responsive candidates from `srcset` and `<picture>` are grouped, repeated groups are deduplicated, and simple `px`/`vw` values in `sizes` are included as context without simulating viewport selection. Google recommends good real-world [Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals), but these static hints do not measure LCP, INP, or CLS and do not replace Lighthouse or field data.

## Broader policy context

The tool intentionally does not automate subjective content or spam judgments. Teams should separately follow [Search Essentials](https://developers.google.com/search/docs/essentials), [spam policies](https://developers.google.com/search/docs/essentials/spam-policies), [people-first content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), [image SEO](https://developers.google.com/search/docs/appearance/google-images), and [favicon requirements](https://developers.google.com/search/docs/appearance/favicon-in-search).
