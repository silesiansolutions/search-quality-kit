# errorFreeUrlRate

Scope note for the v0.13 summary metric. It is a counting rule, not a score: nothing is weighted and nothing is hidden. It is never the primary CI gate. New-error baseline gating stays the gate.

## The rule

- `auditedUrls`: the crawled pages, the same number as `summary.checkedPages`.
- `urlsWithErrors`: the unique normalized URLs of audited pages that carry at least one unsuppressed finding with severity `error`.
- `errorFreeUrlRate`: the share of audited pages without such a finding, as an integer percentage.

A finding without a URL, such as invalid sitemap XML, is global and never attributed to a page. A finding whose URL is not an audited page, such as a sitemap URL the crawl did not reach, is not attributed either, so `urlsWithErrors` never exceeds `auditedUrls`. A run with zero audited pages has no rate, and the field is omitted.

## Rounding

`floor((auditedUrls - urlsWithErrors) / auditedUrls * 100)`. The roadmap draft wrote `ceil`, which was rejected: with `ceil`, one erroring page out of 1,000 gives `ceil(99.9) = 100`, and a site with an error reports a perfect rate. With `floor` the same site reports 99, and 100 means exactly zero erroring pages.

## Where it appears

- JSON report: `summary.urlsWithErrors` and `summary.errorFreeUrlRate`, both optional and additive. The report schema stays `0.3`.
- Markdown and console summaries: one line, with the count beside the rate.
- Portfolio: both fields in each site summary. The strict `summarySchema` in `src/portfolio/report.ts` must accept them, or the showcase job fails. A portfolio-wide rate is computed from the summed counts, not by averaging the site rates. The two new optional fields in the portfolio JSON are additive, so the portfolio schema stays `0.7`.

The count travels with the rate on purpose: a portfolio total cannot be computed from rates alone, and a reader can check the arithmetic.
