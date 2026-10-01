# AI crawler access audit

Scope note for the v0.13 item that extends the robots check with per-agent evaluation for AI crawlers. Background and sources: [ai-surface-review.md](ai-surface-review.md).

## What the check answers

One question per AI user agent: can this agent fetch the pages the crawl found indexable? The kit reports the consequence of the robots.txt policy, for example that OAI-SearchBot cannot fetch any crawled page and the site therefore cannot be cited in ChatGPT search. It never says whether blocking is right. Blocking training crawlers is a legitimate policy, and the kit has no opinion on it.

## The upstream roster, measured

The roadmap quoted 464 user agents. A fetch of `robots.json` on 2026-10-01 (upstream commit `987266f`, 2026-09-26) returned **180** keys. The 464 figure does not match the file and is dropped from the docs.

Each entry carries `operator`, `respect`, `function`, `frequency` and `description`. Two properties of that data shape the design:

- `function` is free text with 69 distinct values across 180 entries. Some follow a category vocabulary ("AI Search Crawlers", "AI Assistants", "AI Data Scrapers"), others are prose ("Scrapes data to train OpenAI's products."). The training, answer-engine and user-triggered split the roadmap names cannot be derived from it mechanically without a heuristic that breaks on the next upstream wording change.
- `respect` is "Yes" for 62 entries, "No" for 11 and unclear for 107. The kit reports the robots.txt consequence for agents that honor it. For an agent marked "No", a block is a request the agent may ignore, and the message says so.

## Classification: a small primary-source overlay on top of the roster

The vendored roster answers "is this token a known AI agent, and who operates it". A short overlay in the kit assigns the three categories, and only to tokens whose operator documents the token in its own primary source (OpenAI, Anthropic, Google, Perplexity, Apple, Common Crawl, Meta):

| Category | Tokens |
|---|---|
| answer engine | OAI-SearchBot, Claude-SearchBot, PerplexityBot |
| training | GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, CCBot, meta-externalagent |
| user-triggered fetcher | ChatGPT-User, Claude-User, Perplexity-User |

Every other roster token is "other AI agent" and carries the roster's operator text. The overlay is hand-maintained, but it is twelve entries, each tied to an operator URL, and it changes when an operator publishes a new token, not weekly. Legacy tokens such as `anthropic-ai` stay in the roster as "other AI agent". The kit reports what the roster claims and never asserts that an agent is live.

## Evaluation

The check reuses the robots matcher (`robotsAllows` in `src/checks/robots.ts`). It does not get a second REP implementation. Group selection is generalized from Googlebot to any product token: the groups naming the token, compared case-insensitively, or the `*` group when none names it. RFC 9309 and Google combine all groups naming the same token, and the existing code already does that.

Evaluated agents:

- every overlay token, always. Most sites do not name them, so their access follows `*`;
- every other roster token that robots.txt names in its own group. An unnamed roster agent follows `*`, exactly like Googlebot, and the existing robots findings already cover that case.

Evaluated paths: the root path and every crawled page with status 200 and no noindex, the same set `robots.indexable-url-blocked` uses. When `*` blocks the whole site, `robots.disallow-all` already fires as an error. The AI findings are then suppressed for agents that follow `*`, so one cause does not produce a dozen findings.

## Findings

One finding per agent, never one per agent and URL. The finding URL is robots.txt, `relatedUrls` lists up to ten blocked pages. The message names the agent, its category, its operator, and whether the block covers the whole site or part of it. It carries no counts, because counts would change the baseline fingerprint on every content change.

| Code | Severity | When |
|---|---|---|
| `robots.ai-search-blocked` | warning | an answer-engine agent cannot fetch some or all crawled indexable pages |
| `robots.ai-crawler-blocked` | info | a training agent, a user-triggered fetcher or another roster agent is blocked |
| `robots.named-group-ignores-wildcard` | info | a named group exists while `*` carries Disallow rules the named group does not repeat |

The third code comes from a measured trap: a named `User-agent` group does not inherit from `*`. A group such as `User-agent: GPTBot` with `Allow: /` is a no-op today, and it silently exempts GPTBot from every `Disallow` added to `*` later. It is not AI-specific, so it applies to any named group, Googlebot included. The finding fires only when `*` already has Disallow rules the named group does not repeat. A named group that merely duplicates a `*` without Disallow rules is a trap for later, not a present exemption, and stays silent.

All codes are `warning` or `info`. The default `ci.failOn: ["error"]` gate is unchanged.

## Declared policy

A site that blocks training crawlers on purpose should not see the same info finding forever. Reviewed suppressions carry an expiry by design, so they are the wrong tool for a standing policy. `rules.robots.aiCrawlers.blockedByPolicy: ["GPTBot", "CCBot"]` says once that the block is intended. Tokens match case-insensitively, and a listed token produces no `ai-search-blocked` or `ai-crawler-blocked` finding. The list does not silence `named-group-ignores-wildcard`, which is about the file's structure, not the policy. The new key moves the contract schema to `0.13`.

## Vendoring and updates

The roster ships as generated data in `src/data/aiRobotsRoster.ts`: token, operator, respect and function, without descriptions, plus the upstream commit, its date and the license. A script, `scripts/update-ai-roster.mjs`, fetches `robots.json` at a given commit and regenerates the file. Updating the roster is a deliberate step in a minor release, listed in [releasing.md](../releasing.md). No scheduled workflow updates it. The kit never fetches the roster at audit time, because the core makes no network requests beyond the audited site.

## License

The upstream repository is MIT licensed, `Copyright (c) 2024 ai.robots.txt`. MIT requires the notice in copies of substantial portions, and the published package ships the data inside `dist`. The full notice lives in `THIRD_PARTY_NOTICES.md`, which is listed in the package `files`. The generated data file also carries the source repository, commit and license as data.

## Not in scope

- user-agent strings in HTTP request logs, IP verification and reverse DNS. The kit audits the site, not its traffic;
- prescribing a policy, or rating it as good or bad;
- `Content-Signal` and other non-REP extensions, rejected in [ai-surface-review.md](ai-surface-review.md);
- Agentic Resource Discovery, which stays watched, not scheduled.
