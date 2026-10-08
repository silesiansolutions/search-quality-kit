# Check catalog

Every finding has a stable `code`, severity, location, remediation, tool documentation link, classification, and an official Google reference where relevant. Classifications are machine-readable in JSON, printed by `list-checks`, and shown in Markdown reports:

- `google-requirement`: a minimum technical or documented protocol requirement.
- `google-recommendation`: official guidance, not a ranking guarantee.
- `local-heuristic`: a configurable project threshold or deterministic approximation.
- `cross-channel-metadata`: metadata used outside Google Search, currently Open Graph.
- `accessibility-basic`: a narrow semantic/accessibility check, not WCAG conformance.
- `profile-expectation`: a site/route-specific expectation configured by the project; not a universal Google requirement.
- `agentic-readiness`: a deterministic local signal for agentic browsing tooling (llms.txt, WebMCP annotations); not a Google Search requirement or recommendation.

Checks can inherit more than one classification. The sources below are official Google Search Central or Google Crawling Infrastructure documentation, reviewed in July 2026.

New reports also include `source`. Built-in findings use `{"type":"core","name":"<check>"}`; custom findings use `{"type":"plugin","name":"<plugin>"}`. Source attribution is visible in JSON, Markdown, and SARIF properties but is not part of the v0.3 baseline fingerprint, preserving compatibility with older baselines. Custom checks and their classification rules are documented in [Custom checks and plugins](plugins.md).

## sitemap

Classification: `google-recommendation`, `local-heuristic`.

Checks the sitemap declared by `robots.txt` (with conventional fallbacks) and detects `<sitemapindex>`. It recursively loads child indexes and URL sets, and validates every file at its own URL/file location. It checks valid XML, absolute HTTP(S) URLs, configured origin, production host leaks, duplicates across children, excluded page paths, and valid `lastmod` syntax. Traversal is deduplicated and bounded by `crawl.maxSitemaps` and `crawl.maxSitemapDepth`. `sitemap.url-noindex` (warning) reports a sitemap URL whose crawled page carries `noindex` or `none` in robots metadata or `X-Robots-Tag`. Google describes sitemap URL and date requirements in [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap). A sitemap is a discovery hint, not an indexing guarantee.

## robots

Classification: `google-requirement`, `local-heuristic`.

Checks availability, recognized field syntax, root-relative allow/disallow paths, accidental site-wide blocking, absolute sitemap declarations, and local/staging leaks. Based on [Google's robots.txt specification](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec). robots.txt controls crawling, not reliable de-indexing; use supported `noindex` mechanisms for that purpose.

The check also matches URLs against the rules that apply to Googlebot: the `Googlebot` groups when present, otherwise the `*` groups. Rules support `*` and a trailing `$`; the longest matching rule wins and `Allow` wins a tie. When the root path itself is blocked, per-URL findings are skipped because the site-wide block is already visible.

- `robots.indexable-url-blocked` (warning): a crawled page answered 200 without `noindex` but robots.txt blocks it for Googlebot.
- `robots.sitemap-url-blocked` (warning): the sitemap lists a URL that robots.txt blocks for Googlebot.
- `robots.unavailable` (warning): robots.txt answered with a 5xx or 429 status or did not respond. Google treats a server error on robots.txt as a reason to stop crawling, unlike a 404. It replaces `robots.missing` for that case and carries an alias to it, so existing suppressions keep matching.

### AI crawler access

Since 0.13 the check evaluates the same rules for AI user agents. Group selection is identical: the groups that name the agent, otherwise the `*` groups. A named group does not inherit anything from `*`. The kit reports the consequence of the policy and never says whether blocking is right. Blocking training crawlers is a legitimate policy.

The agent list comes from a vendored copy of [ai.robots.txt](https://github.com/ai-robots-txt/ai.robots.txt) (MIT, 181 agents at the pinned commit). Twelve tokens carry a category, each from the operator's own documentation:

- answer engine: `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`;
- training: `GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`, `meta-externalagent`;
- user-triggered fetcher: `ChatGPT-User`, `Claude-User`, `Perplexity-User`.

An agent that robots.txt names in its own group is always evaluated, for the twelve tokens and for any other roster agent. An unnamed classified token follows `*`. It is evaluated only when Googlebot has its own group, because otherwise Googlebot follows the same `*` rules and `robots.indexable-url-blocked` already reports the cause. The checked paths are the root path and every crawled page with status 200 and no `noindex`. When `*` blocks the root path, agents that follow `*` get no AI finding, because the block is site-wide and not specific to AI. A literal `Disallow: /` is reported as `robots.disallow-all`. Each finding points at robots.txt and lists up to ten blocked pages in `relatedUrls`. The message names only the agent, its category and whether every or some pages are blocked. The operator and the roster's robots.txt compliance note go into the suggestion, which is not part of the baseline fingerprint, so a roster update does not reopen findings. The roster reports what it claims about an agent. The kit does not verify that an agent is live.

- `robots.ai-search-blocked` (warning): an answer-engine agent cannot fetch some or all crawled indexable pages, so those pages cannot be cited in that answer engine.
- `robots.ai-crawler-blocked` (info): a training crawler, a user-triggered fetcher or another roster agent is blocked. For an agent the roster marks as not honoring robots.txt, the message says the block is a request it may ignore.
- `robots.named-group-ignores-wildcard` (info): a named group exists while `*` has Disallow rules the named group does not apply, so the named agent may fetch those paths. A named group replaces `*` for that agent and silently skips every Disallow added to `*` later. It is not reported when `*` blocks the root path, because an allow list after a full block is deliberate. A named group that repeats a rule exactly, patterns included, covers it.

The two AI access codes are classified `local-heuristic` and carry no Google documentation link, because blocking an AI agent is not a Google requirement. `named-group-ignores-wildcard` keeps the robots.txt specification link, since group selection is defined there.

List intended blocks in `rules.robots.aiCrawlers.blockedByPolicy` to silence the first two codes for those agents. Details and sources: [AI crawler access audit](design/ai-crawler-access.md).

## indexability

Classification: `google-requirement`.

Checks that crawled public pages return HTTP 200 and do not carry `noindex`/`none` in robots metadata or `X-Robots-Tag`. These are among Google's [minimum technical requirements](https://developers.google.com/search/docs/essentials/technical) and [robots meta specifications](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag). Passing does not guarantee indexing.

A page that does not answer 200 is reported under a code that names the status class. All of them are `error`, and the message keeps the pre-0.12 wording, so baselines and suppressions recorded under `indexability.non-200` still match through the code alias.

- `indexability.4xx`: the page returned a 4xx status.
- `indexability.5xx`: the page returned a 5xx status.
- `indexability.timeout`: the request timed out after `crawl.requestTimeoutMs`.
- `indexability.unreachable`: no HTTP response for another reason. The suggestion names the cause: DNS failure, refused connection, TLS failure, redirect loop, or a chain longer than `crawl.maxRedirects`.
- `indexability.non-200`: any other status, such as a 3xx without a usable `Location`.

HTTP crawls retain the initial URL, every redirect hop, and the final response URL. Redirect quality is reported by the [redirects](#redirects) check. A redirect from an internal URL outside the configured public origin is reported as `redirect-outside-origin`.

Static HTML redirect stubs with `meta http-equiv="refresh"` are treated as navigation artifacts rather than indexable content pages, while their generated route remains available to link resolution.

## metadata

Classification: `google-recommendation`, `local-heuristic`.

Checks non-empty and non-generic titles, descriptions, duplicates, document language, and viewport metadata. Google's guidance favors descriptive, concise, distinct title text and useful page-specific descriptions: [title links](https://developers.google.com/search/docs/appearance/title-link) and [snippets](https://developers.google.com/search/docs/appearance/snippet). Length ranges are configurable project heuristics, not Google limits.

- `metadata.multiple-titles` (warning): the head contains more than one `<title>`.
- `metadata.multiple-descriptions` (warning): the page contains more than one meta description.
- `metadata.invalid-lang` (warning): `<html lang>` is not a well-formed tag, or uses a two-letter language or region subtag missing from the vendored ISO tables. Three-letter languages and variant subtags are accepted without a table lookup.

## canonical

Classification: `google-recommendation`, `local-heuristic`.

Checks presence when configured, one non-empty absolute production URL, origin consistency, normalized self-reference, sitemap/canonical agreement, and redirected sitemap URLs. In HTTP mode, self-reference is compared with the final response URL after redirects. Based on [canonical URL guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls). A non-self canonical is a warning because legitimate duplicate consolidation exists.

In HTTP mode the canonical target is resolved against responses the crawl already has, without extra requests. A target outside the crawl is not checked.

- `canonical.target-redirect` (warning): the canonical URL redirects. This includes a canonical without the trailing slash the server redirects to.
- `canonical.target-4xx` and `canonical.target-5xx` (warning): the canonical URL returns an error status.
- `canonical.target-unreachable` (warning): the canonical URL did not respond.

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

- `internal-links.https-to-http` (warning): an HTTPS page links to the `http:` form of an internal URL.
- `internal-links.no-outgoing-links` (info): a page that answered 200 has no same-origin link, so crawling stops there.

## rendered-html

Classification: `google-requirement`, `google-recommendation`, `local-heuristic`.

Checks meaningful visible text in delivered HTML, optional `<main>`, H1 policy, and placeholder-only app shells. This catches obvious JavaScript rendering risks described in [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics). v1 parses delivered HTML and does not execute JavaScript.

## accessibility

Classification: `accessibility-basic`; this is not a WCAG audit or ranking-factor claim.

Checks basic image alternatives, accessible link/button names, document language, and severe heading-level jumps. These checks improve semantic usability and help avoid content-discovery regressions, but they are not a WCAG conformance audit.

## performance-hints

Classification: `google-recommendation`, `local-heuristic`.

Flags configurable HTML/image size, excessive third-party scripts, missing lazy loading for many distinct non-primary images, and local/staging asset URLs. Responsive candidates from `srcset` and `<picture>` are grouped, repeated groups are deduplicated, and simple `px`/`vw` values in `sizes` are included as context without simulating viewport selection. Google recommends good real-world [Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals). These static hints do not measure LCP, INP, or CLS and do not replace Lighthouse or field data.

## agent-readiness

Classification: `agentic-readiness`; a local signal, not a Google Search requirement or recommendation.

Reads a deterministic `/llms.txt` artifact (build output in static mode, origin in HTTP mode). It also statically scans delivered HTML forms for declarative WebMCP tool annotations (`toolname`, `tooldescription`, `toolparamdescription`). It does not execute JavaScript and does not detect imperative WebMCP tool registration.

- `agent-readiness.llms-txt-missing` - info, or warning when `rules.agentReadiness.requireLlmsTxt` is enabled: no `/llms.txt` found; add a Markdown `llms.txt` at the site root per [llmstxt.org](https://llmstxt.org/).
- `agent-readiness.llms-txt-unreadable` - warning: `/llms.txt` responded with a server error or failed to load.
- `agent-readiness.llms-txt-missing-h1` - warning: the file lacks an H1 (`# Title`).
- `agent-readiness.llms-txt-missing-links` - warning: the file contains no Markdown links.
- `agent-readiness.llms-txt-too-short` - warning: content is shorter than 50 characters.

  These three checks replicate Lighthouse's `llms-txt` audit content rules exactly.

- `agent-readiness.llms-txt-missing-summary` - info: no blockquote summary under the H1. This is an llmstxt.org recommendation and intentionally goes beyond the Lighthouse audit.
- `agent-readiness.webmcp-tool-annotation-incomplete` - warning: a form declares only one of `toolname`/`tooldescription`, so the browser will not register the tool.
- `agent-readiness.webmcp-tool-name-duplicate` - warning: two annotated forms on the same page share a `toolname`.
- `agent-readiness.webmcp-param-description-missing` - info: a named field in a tool form has no `toolparamdescription`, associated/wrapping label, or `aria-description`/`aria-describedby`. The generated input schema then has an undescribed parameter.
- `agent-readiness.webmcp-form-uncovered` - info: a form with user-facing controls carries no WebMCP annotations, mirroring the informative Lighthouse WebMCP form coverage audit.

`rules.agentReadiness.requireLlmsTxt` (default `false`) raises a missing `/llms.txt` from info to warning once a project has committed to publishing one.

Cumulative layout shift, runtime accessibility-tree integrity, and imperative WebMCP tools (`navigator.modelContext.registerTool`) require a real browser. They remain covered by the experimental Lighthouse [Agentic Browsing](https://developer.chrome.com/docs/lighthouse/agentic-browsing) category (Chrome 150+, WebMCP origin trial) and PageSpeed Insights, which this kit deliberately complements and does not replace. See also [WebMCP](https://developer.chrome.com/docs/ai/webmcp) and [llms.txt](https://llmstxt.org/).

## hreflang

Classification: `google-requirement`, `google-recommendation`, `local-heuristic`.

Validates `<link rel="alternate" hreflang>` annotations across the whole crawl, not one page at a time. Reciprocity is the reason this check needs a cross-page view. Google states that if page X links to page Y, page Y must link back, or the annotations may be ignored. Only ISO 639-1 language codes and ISO 3166-1 alpha-2 region codes are supported, plus UN M.49 macro-regions such as `es-419`.

Sitemap `xhtml:link` alternates are read too. For each URL the HTML annotations win; the sitemap annotations count only for a URL whose HTML declares none, so a site that uses both methods is not reported twice. Annotations in the HTTP `Link:` header are not read. A site that annotates only that way produces no findings rather than a false `missing-self` on every page.

Every code is `warning` or `info` by default, so the default `ci.failOn: ["error"]` gate is unchanged on upgrade. `rules.hreflang.strict` (default `false`) promotes the Google-requirement codes to `error`.

- `hreflang.invalid-value` - warning: the value is not a parseable language tag, such as `en_US`; use hyphens and a `language[-script][-region]` shape.
- `hreflang.invalid-language` - warning: the value parses but its language is not ISO 639-1, such as `eng` instead of `en`.
- `hreflang.invalid-region` - warning: the region is neither ISO 3166-1 alpha-2 nor a UN M.49 macro-region, such as `en-UK` instead of `en-GB`.
- `hreflang.relative-href` - warning: the `href` is not fully qualified; hreflang targets must be absolute URLs.
- `hreflang.missing-self` - warning: the page declares alternates but none targets itself.
- `hreflang.missing-reciprocal` - warning: another crawled page names this one as an alternate and this page does not link back. Reported once against the page that fails to link back, with the declaring pages in `relatedUrls`.
- `hreflang.duplicate-language` - warning: the same value is declared twice on one page with different targets.
- `hreflang.broken-target` - warning: an alternate target returned an error status. Emitted only when the status was actually observed, so it never fires in static mode, where the crawler cannot know what the origin will serve.
- `hreflang.x-default-duplicate` - warning: more than one `x-default` on a page.
- `hreflang.non-canonical-target` - warning: the target page declares a canonical other than the alternate `href`. Gated by `rules.hreflang.requireCanonicalTargets` (default `true`).
- `hreflang.lang-mismatch` - warning: the `<html lang>` value disagrees with the page's own self-referencing annotation.
- `hreflang.unresolved-target` - info: a same-origin alternate target was not crawled, so it could not be checked. Raising `crawl.maxPages` above the site's page count converts this into a decidable result; silence about a URL is never evidence that the URL is fine.
- `hreflang.missing-x-default` - info: a cluster has two or more language versions and no `x-default`. Emitted only under `rules.hreflang.requireXDefault` (default `false`).

A monolingual site produces no findings from this check at all. An `x-default` entry pointing at the page itself counts as a self-reference. See [Google's localized versions documentation](https://developers.google.com/search/docs/specialty/international/localized-versions) and the [design note](design/hreflang.md).

## redirects

Classification: `google-recommendation`, `local-heuristic`. HTTP mode only; a static build has no redirects to observe.

The crawler follows redirects itself, up to `crawl.maxRedirects` hops (default 10), and keeps every hop. Findings point at the URL where the chain starts. All codes are warnings, so the default error gate is unchanged on upgrade. Based on [Google's redirect documentation](https://developers.google.com/search/docs/crawling-indexing/301-redirects).

- `redirects.chain`: the start URL reaches its final URL through more than one redirect.
- `redirects.loop`: the chain returns to a URL it already visited.
- `redirects.broken`: the chain ends in a 4xx or 5xx status, gets no response, or exceeds `crawl.maxRedirects`.
- `redirects.internal-link-to-redirect`: a crawled page links to a URL that redirects. Reported once per page and target.

## assets

Classification: `local-heuristic`.

Checks same-origin images (`src`, `srcset`, `<picture>` sources), scripts and stylesheets referenced by crawled pages. Each resource is reported once, with the first referencing page as the location and the others in `relatedUrls`. Third-party resources are not checked. All codes are warnings or info.

- `assets.missing-static-asset` (static mode): the referenced file is absent from the build output. The query string is ignored for the lookup.
- `assets.broken-image`, `assets.broken-script`, `assets.broken-stylesheet` (HTTP mode): the resource answers with a 4xx or 5xx status or does not respond.
- `assets.request-limit` (info, HTTP mode): resource requests stopped at `crawl.maxResources`, so the remaining resources were not checked.

HTTP mode makes one request per unique resource, bounded by `crawl.maxResources` (default 500). Setting `checks.assets: false` skips these requests entirely.

## duplicates

Classification: `google-recommendation`.

Groups pages by a SHA-256 of their normalized main text: the single `<main>` element, otherwise `<body>` without `header`, `nav`, `footer` and `aside`. Scripts, styles and markup do not count, whitespace is collapsed and case is kept. Only pages with status 200 and no `noindex` take part. Pages whose main text is shorter than `rules.renderedHtml.minTextLength` (default 80 characters) are skipped, because loading shells and soft 404s are a `rendered-html` problem. Pages linked to each other by reciprocal hreflang alternates are regional variants, not duplicates, and are never compared with each other. A copy outside such a cluster is still reported unless its canonical points into the cluster. Identical documents only: there is no similarity threshold. Based on [Google's guidance on consolidating duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

- `duplicates.exact-without-canonical` (warning): the page has identical main content to other crawled pages and declares no canonical.
- `duplicates.conflicting-canonicals` (warning): every copy declares a canonical, but the copies do not all point at the same URL.

Findings are per page, with the other copies in `relatedUrls`. Copies that all point at the same canonical produce no finding. Details: [Exact-duplicate detection](design/exact-duplicates.md).

## Broader policy context

The tool intentionally does not automate subjective content or spam judgments. Teams should separately follow [Search Essentials](https://developers.google.com/search/docs/essentials), [spam policies](https://developers.google.com/search/docs/essentials/spam-policies), [people-first content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), [image SEO](https://developers.google.com/search/docs/appearance/google-images), and [favicon requirements](https://developers.google.com/search/docs/appearance/favicon-in-search).
