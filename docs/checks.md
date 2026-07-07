# Check catalog

Every finding has a stable `code`, severity, location, remediation, tool documentation link, and—where relevant—an official Google reference. The sources below are official Google Search Central or Google Crawling Infrastructure documentation, reviewed for v0.1 in July 2026.

## sitemap

Checks `/sitemap.xml` availability, valid XML, absolute HTTP(S) URLs, configured origin, production host leaks, duplicates, excluded paths, and valid `lastmod` syntax. Google describes sitemap URL and date requirements in [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap). A sitemap is a discovery hint, not an indexing guarantee.

## robots

Checks availability, recognized field syntax, root-relative allow/disallow paths, accidental site-wide blocking, absolute sitemap declarations, and local/staging leaks. Based on [Google's robots.txt specification](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec). robots.txt controls crawling, not reliable de-indexing; use supported `noindex` mechanisms for that purpose.

## indexability

Checks that crawled public pages return HTTP 200 and do not carry `noindex`/`none` in robots metadata or `X-Robots-Tag`. These are among Google's [minimum technical requirements](https://developers.google.com/search/docs/essentials/technical) and [robots meta specifications](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag). Passing does not guarantee indexing.

Static HTML redirect stubs with `meta http-equiv="refresh"` are treated as navigation artifacts rather than indexable content pages, while their generated route remains available to link resolution.

## metadata

Checks non-empty and non-generic titles, descriptions, duplicates, document language, and viewport metadata. Google's guidance favors descriptive, concise, distinct title text and useful page-specific descriptions: [title links](https://developers.google.com/search/docs/appearance/title-link) and [snippets](https://developers.google.com/search/docs/appearance/snippet). Length ranges are configurable project heuristics, not Google limits.

## canonical

Checks presence when configured, one non-empty absolute production URL, origin consistency, and normalized self-reference. Based on [canonical URL guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls). A non-self canonical is a warning because legitimate duplicate consolidation exists.

## structured-data

Parses JSON-LD and checks `@context`, `@type`, empty values, obvious placeholders, non-production URLs, and conflicting types for the same `@id`. Google recommends JSON-LD and accurate, visible-content-aligned markup in [structured data basics](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) and [general guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies). This check does not implement feature-specific required properties and does not replace Rich Results Test.

## open-graph

Checks `og:title`, `og:description`, `og:url`, `og:type`, optional `og:image`, production URLs, and agreement between `og:url` and canonical. Open Graph itself is not a Google Search requirement; it is included as a cross-channel metadata regression check.

## internal-links

Checks crawlable `href` values, malformed/empty links, local host leaks, known 404s, missing static routes, accessible anchor text, and static-build orphans. Based on Google's [crawlable link best practices](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) and Search Essentials' emphasis on discoverable links.

## rendered-html

Checks meaningful visible text in delivered HTML, optional `<main>`, H1 policy, and placeholder-only app shells. This catches obvious JavaScript rendering risks described in [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics). v1 parses delivered HTML and does not execute JavaScript.

## accessibility

Checks basic image alternatives, accessible link/button names, document language, and severe heading-level jumps. These checks improve semantic usability and help avoid content-discovery regressions, but they are not a WCAG conformance audit.

## performance-hints

Flags configurable HTML/image size, excessive third-party scripts, missing lazy loading for many non-primary images, and local/staging asset URLs. Google recommends good real-world [Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals), but these static hints do not measure LCP, INP, or CLS and do not replace Lighthouse or field data.

## Broader policy context

The tool intentionally does not automate subjective content or spam judgments. Teams should separately follow [Search Essentials](https://developers.google.com/search/docs/essentials), [spam policies](https://developers.google.com/search/docs/essentials/spam-policies), [people-first content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), [image SEO](https://developers.google.com/search/docs/appearance/google-images), and [favicon requirements](https://developers.google.com/search/docs/appearance/favicon-in-search).
