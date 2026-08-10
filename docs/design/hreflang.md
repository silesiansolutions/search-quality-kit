# hreflang

hreflang is the first consumer of the [URL graph](url-graph.md), shipping in v0.11.

## Why hreflang first

Reciprocity is an explicitly documented Google requirement, not practitioner convention: if page X links to page Y via hreflang, page Y must link back to X, or the annotations may be ignored or misinterpreted; each version in a cluster must also list itself. Only ISO 639-1 language codes and ISO 3166-1 alpha-2 region codes are supported values. See Google's [localized versions documentation](https://developers.google.com/search/docs/specialty/international/localized-versions).

hreflang is fully decidable from delivered HTML, needs zero additional requests, and behaves identically in static and HTTP mode — the only planned graph-backed check with no mode asymmetry. Redirect integrity and canonical target validation both depend on data the crawler does not yet retain (see [URL graph](url-graph.md)); hreflang depends only on markup already in `p.html`.

## Transport scope

| Transport                                 | Status            | Reason                                                                                                                                                                                                                          |
| ----------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<link rel="alternate" hreflang>` in HTML | supported         | Fully decidable from delivered HTML in both modes.                                                                                                                                                                              |
| HTTP `Link:` header                       | deferred          | `headers` is `{}` in static mode (`crawlSite.ts:180`); a header-only annotation would produce findings that appear in HTTP mode and vanish in static mode — the same dead-code class as `x-robots-tag` at `indexability.ts:47`. |
| Sitemap `xhtml:link`                      | deferred to v0.12 | One mapper change away: `parseSitemap` (`src/crawler/sitemaps.ts:19`) already parses with `ignoreAttributes: false`, but `sitemaps.ts:38-46` discards everything except `loc` and `lastmod`.                                    |

A site that annotates hreflang only through headers or sitemap entries must stay silent rather than report `missing-self` on every page it cannot see annotations for.

## The monolingual-silence invariant

The primary false-positive risk is a monolingual site with zero hreflang usage being told it is missing self-references or reciprocal links it never intended to have. Three independent layers guard against it, each sufficient on its own for the trivial case:

- a global short-circuit: the check exits immediately when the graph holds no alternate edges at all;
- cluster membership: `missing-self` and `missing-reciprocal` evaluate only nodes that belong to a discovered alternate cluster, never nodes outside one;
- self-anchored comparison: `lang-mismatch` compares `<html lang>` only against the page's own self-hreflang entry, never against a sibling's.

The corpus sweep test is what holds this invariant — it runs the check against every existing HTML fixture in the suite and asserts zero findings, not just zero findings from one layer. Because it sweeps the whole corpus rather than a hand-picked case, every fixture added for any future feature strengthens it automatically.

The sweep must also cover the near-boundary case the first layer does not catch: a single page carrying a self-referencing `hreflang` and nothing else, which is what a site following common advice produces before it has any translations. That page has one alternate edge, so the global short-circuit does not apply to it. It stays silent through the other two layers — `missing-self` is satisfied by the self-reference, and a cluster of one has nothing to reciprocate against — but a design that is silent only by argument is not verified, so this case gets its own fixture.

## Finding codes

| Code                   | Default severity | Severity under `rules.hreflang.strict` | Classification        |
| ---------------------- | ---------------- | -------------------------------------- | --------------------- |
| `invalid-value`        | warning          | error                                  | google-requirement    |
| `invalid-language`     | warning          | error                                  | google-requirement    |
| `invalid-region`       | warning          | error                                  | google-requirement    |
| `relative-href`        | warning          | error                                  | google-requirement    |
| `missing-self`         | warning          | error                                  | google-requirement    |
| `missing-reciprocal`   | warning          | error                                  | google-requirement    |
| `duplicate-language`   | warning          | error                                  | google-requirement    |
| `broken-target`        | warning          | error                                  | google-requirement    |
| `x-default-duplicate`  | warning          | warning                                | google-recommendation |
| `non-canonical-target` | warning          | warning                                | google-recommendation |
| `lang-mismatch`        | warning          | warning                                | local-heuristic       |
| `unresolved-target`    | info             | info                                   | local-heuristic       |
| `missing-x-default`    | info             | info                                   | google-recommendation |

`missing-x-default` is emitted only under `rules.hreflang.requireXDefault`; it has no unconditional default state.

## Why nothing is error by default

`ci.failOn` defaults to `["error"]` (`src/config/schema.ts:193`). An error-severity code in a default-on check would break CI for every multilingual user on a minor upgrade, the moment they update the package. This follows the v0.10 `agentReadiness` precedent: default-on, no severity that reaches the default gate until the user opts in. `rules.hreflang.strict` is that opt-in; the default flips to error at 1.0, where gate changes are a legitimate part of the stability promise.

## Reciprocity attribution and the cardinality rule

The defect belongs to the page that fails to link back, so that page is the finding's `url`, and the pages that do link to it go in `relatedUrls`. One finding per failing page, never one per pair: a 40-language cluster with one broken page yields one finding, not 39.

This forces a rule on message wording. The baseline fingerprint hashes `message` but not `relatedUrls` (`src/report/baseline.ts:29-38`), so every graph-derived message must be free of counts and enumerations. `Page is missing a reciprocal hreflang link back from its alternates.` is stable across the cluster growing or shrinking. `Page is missing reciprocal links from 3 of 4 alternates.` is not — adding a fifth language to the cluster changes the count, changes the message, and churns the baseline for a finding that did not otherwise change.

## Determinism of subtag validation

`Intl` is rejected as the validation source. Measured evidence:

- `Intl.getCanonicalLocales("eng")` returns `"en"`, silently normalizing away the exact ISO 639-2 violation Google's documentation calls out;
- `Intl.getCanonicalLocales("xx-YY")` passes, accepting an unregistered language code;
- `Intl.DisplayNames` resolves `"UK"` to United Kingdom although ISO 3166-1 uses `GB`, and accepts `"ZZ"` without complaint.

Beyond the false negatives, `Intl.DisplayNames` answers depend on the ICU build bundled with the user's Node runtime, so the same input could produce different findings on a laptop and in CI — disqualifying for a tool whose first pillar is determinism.

`src/utils/bcp47.ts` therefore vendors ISO 639-1, ISO 3166-1 alpha-2, and UN M.49 macro-regions directly, under 1.5 KB total, carrying a `SUBTAG_TABLE_REVISION`. ISO 15924 script subtags are deliberately not vendored: a 4-letter Title-case subtag is accepted by shape and never reported, because Google's hreflang documentation covers language and region only, and flagging `zh-Hant` as invalid would be inventing a rule Google does not state. UN M.49 macro-regions are needed because `es-419` — Latin American Spanish — is a real, Google-documented hreflang value with a region code that ISO 3166-1 does not define.

## Crawl truncation bounds what the check can know

`crawl.maxPages` (`src/config/schema.ts:55`, default 100) bounds both crawl modes. An hreflang alternate that points outside the crawled set becomes an `unresolved` graph node, and the check reports `unresolved-target` at `info` — the same result whether the target was excluded by configuration, pushed past `maxPages`, or genuinely absent. The check cannot distinguish those three, because the crawler did not fetch the URL in any of them.

The consequence has to be stated rather than discovered: on a site larger than `maxPages`, a genuinely broken alternate that falls past the truncation boundary reports at `info` instead of the `warning`/`error` that `broken-target` would carry. The defect is real, the report is quieter, and a gate configured on `warning` and above will not see it.

This is accepted for v0.11 rather than mitigated with new machinery, on two conditions. `unresolved-target` names the specific URL it could not resolve, so the report says what was not checked instead of implying it passed. And the documentation states that raising `maxPages` above the site's page count is what converts an `unresolved-target` into a decidable result. Silence about a URL is never evidence that the URL is fine, and the code exists precisely so that silence is never what the report shows.

## Config surface

- `checks.hreflang`, default `true` — the check as a whole.
- `rules.hreflang.strict`, default `false` — promotes every google-requirement code in the table above from `warning` to `error`. The default flips at 1.0.
- `rules.hreflang.requireXDefault`, default `false` — emits `missing-x-default` when a cluster holds two or more language versions and no `x-default` anywhere. Off by default because `x-default` is a recommendation, not a requirement, and a cluster without one is well-formed.
- `rules.hreflang.requireCanonicalTargets`, default `true` — emits `non-canonical-target` when an alternate's target page declares a canonical other than the alternate href. On by default because it usually indicates a real mistake, but switchable off for sites that deliberately point alternates at URLs that consolidate elsewhere.
