# AI surface review

## Decision

The AI-first pillar stays. The kit stops tracking specifications that have no consumers. This note records the evidence behind each item on the AI/agentic surface so the question is not re-litigated release over release. Every claim below carries a source URL and, where the claim is time-sensitive, a date. Where a claim could not be independently confirmed, that is stated rather than asserted.

## Lighthouse has commoditized the check layer

Lighthouse 13.2.0 (2026-05-01) added `webmcp-form-coverage`, `webmcp-registered-tools`, `webmcp-schema-validity`, and an `llms.txt` check. Lighthouse 13.3.0 (2026-05-07) added the `agentic-browsing` category to the default config. Lighthouse 13.4.1 (2026-07-20) enabled that category through the PageSpeed Insights API. The Lighthouse `seo` category already contains `hreflang`, `canonical`, `robots-txt`, `is-crawlable`, `structured-data`, and more. Distribution is `@lhci/cli` at roughly 1.46 million weekly npm downloads, plus PageSpeed Insights itself.

Sources: [Lighthouse releases](https://github.com/GoogleChrome/lighthouse/releases) and [`core/config/default-config.js`](https://github.com/GoogleChrome/lighthouse/blob/main/core/config/default-config.js). Note that several third-party summaries of the agentic-browsing category list audit ids that do not exist in that config; the config file is the only reliable source for what actually ships.

## But every Lighthouse audit is single-page

This is the pivot of the note. Lighthouse has no cross-page graph, so it structurally cannot detect hreflang non-reciprocity, canonical targets that redirect or 404, redirect chains, or divergence between a sitemap and the crawlable set. All of those require correlating findings across many URLs in one run — a graph, not a per-page audit.

Cross-page analysis is where this project is not substitutable by Lighthouse, no matter how much single-page surface Lighthouse commoditizes. The v0.11 URL graph exists to serve exactly this: see [url-graph.md](url-graph.md) and [hreflang.md](hreflang.md).

## llms.txt: tooling-driven demand, not spec-driven

[SE Ranking](https://seranking.com/blog/llms-txt/), May 2026, surveying roughly 300,000 domains: about 10% adoption overall, **0% among the top 1,000 domains by traffic**, and no measurable effect on AI citations after controlling for domain authority. Google Search Central's ["AI features and your website"](https://developers.google.com/search/docs/appearance/ai-features) (updated 2025-12-10) states plainly that no new machine-readable files or AI-specific text files are needed. No frontier lab has publicly committed to consuming `llms.txt`.

The counter-force: Lighthouse now flags a missing `llms.txt` in its default config (see above). That is a reason the existing v0.10 check stays — checking what Lighthouse itself now treats as a signal keeps this kit aligned with what consuming tools expect — not a reason to invest further in the check. Demand here is tooling-driven, not spec-driven.

## Declarative WebMCP: frozen at the deterministic subset

The [specification](https://webmachinelearning.github.io/webmcp/) is a Draft Community Group Report (2026-07-28) published by the Web Machine Learning Community Group. It is explicitly not a W3C Standard and not on the W3C Standards Track. Section 4.3, declarative tool registration, is marked entirely as a TODO and refers out to an explainer draft that does not yet exist in normative form.

Conclusion: the v0.10 check targets a section of the spec that has no normative content yet. It stays frozen at its current deterministic subset and follows the spec as it firms up, rather than anticipating a shape that may still change.

## Content Signals: struck from the roadmap

The robots.txt extension originated at Cloudflare ([announced 2025-09-24](https://blog.cloudflare.com/content-signals-policy/)) with `search`, `ai-input`, and `ai-train` signals. Cloudflare's own announcement states the signals express preferences and are not technical countermeasures. Google's John Mueller has stated the directive has [no effect on any crawler or LLM](https://www.seroundtable.com/google-cloudflare-content-signals-41631.html). No crawler has shipped support, and it is not on any standards track.

**Decision: strike Content Signals from the roadmap.** There is no consumer on either side — no crawler reads it, and the site owner's own operator (Cloudflare) describes it as non-binding.

## AI crawler roster: vendor instead of hand-maintain

Replace the planned hand-maintained roster with a vendored copy of [`ai-robots-txt/ai.robots.txt`](https://github.com/ai-robots-txt/ai.robots.txt). Its `robots.json` carries 464 user-agent keys with `operator`, `respect`, `function`, and `frequency` fields, is MIT licensed, has roughly 4,040 stars, and is updated weekly. The roadmap already promises a versioned roster shipped in the package; vendoring delivers that same promise at a fraction of the ongoing maintenance cost of tracking crawler identities by hand.

Primary verification endpoints that do exist, for the roster entries that matter most: [OpenAI](https://developers.openai.com/api/docs/bots) publishes `openai.com/gptbot.json`, `searchbot.json`, and `chatgpt-user.json`; [Anthropic](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) publishes `claude.com/crawling/bots.json`; [Google](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers) publishes its common-crawlers IP ranges as JSON. Primary-source documentation was confirmed directly for OpenAI, Anthropic, and Google. PerplexityBot, CCBot, Bytespider, Meta-ExternalAgent, and Applebot-Extended were confirmed only through aggregators (including `ai.robots.txt` itself), not through each operator's own primary documentation — recorded honestly rather than presented as independently verified.

One roster caveat worth carrying: `anthropic-ai` appears widely in third-party lists and in older robots.txt files but is not in Anthropic's current documentation. A vendored roster inherits that kind of legacy entry, so the check must report what a roster claims, never assert that a user agent is live.

## Agentic Resource Discovery (ARD): watched, not scheduled

The one genuinely new candidate. [Announced on the Google Developers Blog](https://developers.googleblog.com/announcing-the-agentic-resource-discovery-specification/) on 2026-06-17, developed under the Linux Foundation's AI Catalog Working Group with Microsoft and Hugging Face as co-authors, Apache 2.0 licensed. It defines `/.well-known/ai-catalog.json` plus a registry API.

It is a static file at a well-known path — exactly the shape this kit already audits for `llms.txt` and `robots.txt` — and its institutional backing (Linux Foundation working group, multi-vendor co-authorship) is far stronger than `llms.txt` ever had. Adoption is currently near zero.

**Record it as watched, not scheduled.** The trigger that promotes it to a scheduled check is measured adoption, not further announcements from the working group or its co-authors. Concretely: a published survey of at least 10,000 domains showing adoption above the level `llms.txt` reached before this note judged it not worth further investment — about 10% overall, and above zero among the highest-traffic segment, which is where `llms.txt` flatlined. Re-checked once per minor release. Stating a number is the point: without one, "adoption" is a word two people can disagree about indefinitely, which is exactly what this note exists to prevent.

## Standing rule

The kit implements the deterministic subset of a specification once that specification has consumers, tracks published spec changes in minor releases, and does not build against sections marked TODO.
