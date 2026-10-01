# Crawler rework (shipped in 0.12)

This note records the decisions behind the 0.12 crawler rework after the fact. They are spread across the 0.12 changelog entry, [url-graph.md](url-graph.md) and [finding-code-stability.md](finding-code-stability.md). The note keeps them in one place so later changes do not undo them by accident.

## The problem it closed

Up to 0.11 the crawler fetched with `redirect: "follow"` and kept only the first and last URL. A bare `catch {}` turned every failed request into `{status: 0}`. Two consequences followed. The kit could not report redirect chains or loops, because the hops were never captured. It also could not name the cause of a failure, because the error was discarded. [url-graph.md](url-graph.md) recorded both gaps as limits of the 0.11 graph.

## Manual redirects

`src/crawler/fetchPage.ts` fetches with `redirect: "manual"` and follows `Location` itself. Every hop is kept as `{ url, status, location }` in `PageArtifact.redirects`. The redirect, canonical-target and assets checks read the hops directly, and no check guesses a chain from two URLs.

`Location` resolves against the current hop URL. A missing or unparsable `Location` ends the chain at that response. The kit reports what it received and does not invent a target.

## Loop detection by exact URL

A loop is a redirect to a URL already visited in the same chain. The comparison key is the exact URL without its fragment. It is deliberately not the kit's `normalizeUrl`, which strips trailing slashes and lowercases the host. Under the normalized key, the very common `/a` to `/a/` redirect would look like a loop. A test covers that case. The server sees exact URLs, so loop detection uses exact URLs too.

## Hop limit

`crawl.maxRedirects` defaults to 10, the number of hops Googlebot follows, and accepts 0 to 20. A chain longer than the limit ends as a failure, the same way a loop does, and is never truncated into a success.

## Failure kinds

A failed request carries `failure`, one of `timeout`, `dns`, `connection-refused`, `tls`, `redirect-loop`, `too-many-redirects` or `network`. The classifier reads error codes from the error and up to four levels of its `cause` chain, because undici wraps the system error. An aborted request is a `timeout`. Anything the classifier does not recognize is `network`. A specific kind is claimed only when the error says so, so an unclassified failure is never reported under a confident wrong name.

Checks map kinds to codes conservatively. `indexability.timeout` exists only for `timeout`. Every other kind is `indexability.unreachable`, and the message names the kind. The robots.txt fetch uses the same kinds: a 5xx, a 429 or any failure is `robots.unavailable`, because Google stops crawling on those, while a 404 stays `robots.missing`.

## Bounded resource requests

The assets check makes one request per unique same-origin image, script or stylesheet. `crawl.maxResources` bounds the requests (default 500, up to 10000). A run that hits the limit reports `assets.request-limit` (info) instead of silently checking a subset. `checks.assets: false` skips the requests entirely, so the speed pillar stays under the user's control.

## Alias migration

The `indexability.non-200` split and the `robots.missing` to `robots.unavailable` move went through `codeAliases` in `src/findingCodes.ts`. That is the prerequisite [finding-code-stability.md](finding-code-stability.md) set. The baseline fingerprint and the suppression matcher both read the legacy code, so existing baselines and suppressions keep matching. The split kept the old message, so its baseline entries match exactly. `robots.unavailable` changed the message because it now names the status. Its baseline entries reappear once, and the changelog says so. SARIF rule ids close and reopen once under the new codes.

## Warning-only policy

Every code added in 0.12 is `warning` or `info`. The default `ci.failOn: ["error"]` gate therefore produces no new failures on a minor upgrade. The split `indexability` codes stay `error` because they replace an existing error code and did not add a new one. The same policy has held since 0.10, and 0.13 keeps it.
