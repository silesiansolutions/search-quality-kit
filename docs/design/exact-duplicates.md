# Exact-duplicate detection

Scope note for the v0.13 duplicate-identity item. Identical documents only. Similarity scoring stays rejected in the roadmap, because it is heuristic and not deterministic.

## The content key

Every page with HTML gets a SHA-256 of its normalized main text:

1. Take `<main>` when the page has exactly one. Otherwise take `<body>` without `header`, `nav`, `footer` and `aside`.
2. Drop `script`, `style`, `noscript`, `template` and `svg`.
3. Take the text, apply Unicode NFC, and collapse every run of whitespace to one space.

Case is kept. "Contact" and "contact" are different documents. Pages whose normalized text is empty are skipped: an empty shell is a rendering problem that `rendered-html` already reports, not a duplicate.

Markup, attributes and images do not count. Two pages that differ only in an image are identical documents to a reader and to a search engine extracting text, and that is the case the check exists for.

## Which pages take part

Pages with HTTP 200 and no noindex. In static mode every built page counts as 200, as everywhere else in the kit. A noindexed duplicate is already consolidated in the way that matters for search, so it never forms or joins a group.

## Canonical resolution

Each page in a group of two or more resolves to a canonical target: the resolved and normalized `rel=canonical` href when present, nothing otherwise.

- At least one page has no canonical element: each such page gets `duplicates.exact-without-canonical`.
- Every page declares a canonical, but the targets are not all the same URL: each page whose target differs from the target of another page gets `duplicates.conflicting-canonicals`. Two self-canonical copies are the common case here.
- Every page declares the same target: consolidated, no finding.

Findings are per page: `url` is the page, `relatedUrls` lists the other members of the group. The message carries no group size, so a third copy does not change the fingerprint of the first two. Per-page findings also let `errorFreeUrlRate` count them like any other page finding, if a policy ever raises their severity.

## Codes

| Code | Severity |
|---|---|
| `duplicates.exact-without-canonical` | warning |
| `duplicates.conflicting-canonicals` | warning |

Both are `warning`, following the policy since 0.10 that new codes stay out of the default error gate.

## Config and cost

A new check, `checks.duplicates`, default on. That grows the config surface, so the contract schema moves to `0.13`. Cost: one HTML parse and one hash per page, with no requests. The check reads canonical targets and meta-robots `noindex` from the URL graph, which the canonical and hreflang checks already build, so the graph adds no parse. It reads `X-Robots-Tag` from the page headers, because the graph does not carry headers.

## Not in scope

- near duplicates, shingling, or any threshold;
- duplicate titles or descriptions, which `metadata` already reports;
- choosing which copy should be canonical. The kit reports the conflict and leaves the choice to the site.
