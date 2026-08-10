# Finding code stability

Finding codes are an identity contract. `indexability.non-200` is not split in v0.11.

## Codes are identity, not labels

A `check` and `code` pair is load-bearing in three places:

- the baseline fingerprint — `[check, code, severity, normalizeUrl(url), targetRelativeFile, message]` joined by NUL (`src/report/baseline.ts:29-38`);
- the suppression key — `applyReviewedSuppressions` matches `findingStableCode(finding)` against `candidate.code` by exact string equality (`src/suppressions.ts:37-46`);
- the SARIF `ruleId` — the bare `finding.code` (`src/report/formatSarifReport.ts:38`), deduplicated into a rule map keyed the same way (`:9`).

`docs/plugins.md:118` already states this policy for plugin authors: changing a check id, code, severity, location, or message can make a finding appear new, and such changes are policy migrations, not free edits. Core checks are held to the identical rule — there is no separate, looser standard for code shipped in this package.

## Why the split is deferred

Renaming `non-200` to a status-class code such as `4xx` changes both `code` and `message` at once, and both are in the fingerprint. Every baselined `indexability.non-200` finding becomes simultaneously resolved (the old fingerprint stops matching) and new (a fingerprint that never existed before appears) in the same run. `--fail-on-new` fails CI for every user holding a baseline with that code, on a minor upgrade they did not ask to be a migration. Suppressions targeting `indexability.non-200` stop matching silently, and findings that were previously suppressed start counting toward `ci.failOn` with no warning.

There is also a correctness gap the split cannot paper over: `indexability.timeout` cannot be implemented honestly today, because `fetchPage.ts:24-30` collapses timeout, DNS failure, connection refused, TLS error, and redirect loop into a single `{status: 0}` with the original error discarded. Emitting `timeout` for what might be a DNS failure is worse than emitting the current undifferentiated `non-200` — it is a specific, confident, and sometimes wrong claim in place of an honest generic one.

## The goal is mostly already met

The message already carries the status: `Page returned HTTP ${p.status || "network failure"}.` (`indexability.ts:36`). Because `message` is part of the fingerprint, a 404 and a 500 are already distinct findings in JSON, Markdown, and baselines — they simply share a `code`. The one surface where granularity genuinely fails is SARIF, where `ruleId` is the bare code and carries no message.

## The SARIF defect and its fix

`ruleId` being the bare `finding.code` (`formatSarifReport.ts:38`) already collapses unrelated findings into one rule wherever a code string repeats across checks. Two live collisions exist today: `non-production-url` is emitted by four checks — `canonical.ts:89`, `internalLinks.ts:71`, `sitemap.ts:155`, and `structuredData.ts:182` — and `missing-lang` is emitted by `metadata.ts:97` and `accessibility.ts:70`. Six findings from six different checks currently report under two SARIF rules. This is a pre-existing defect, unrelated to the indexability split.

The fix is `findingStableCode` (`src/suppressions.ts:5-9`), which already exists and already namespaces a bare code as `${check}.${code}` when the code has no dot. Using it to build SARIF `ruleId` values instead of the bare code resolves both collisions. This changes SARIF `ruleId` values for every finding: GitHub code scanning will close the alerts under the old `ruleId` and open new ones under the namespaced form. The JSON report contract is untouched — `finding.code` itself does not change, only how SARIF derives `ruleId` from it.

## The prerequisite for the eventual split

A `codeAliases` map, consulted by both `findingFingerprint` and the suppression matcher, so a baseline entry recorded under an old code still matches a finding emitted under its replacement. At introduction the map is identity-only — every code maps to itself — and is therefore a safe no-op with no behavioral effect. It is v0.12 scope. It is not added in 0.11, because there is nothing to alias yet: adding the mechanism before there is a rename to carry through it is speculative infrastructure.

## Rejected alternatives

- **An opt-in `rules.*` flag that switches between `non-200` and the split codes.** This makes baseline and suppression semantics config-dependent — the same finding would fingerprint differently depending on a setting, which is worse than either fixed state, because it makes the fingerprint format itself part of the configuration surface.
- **Additive dual-emit of both the old and new codes for the same event.** This doubles the reported error count for one underlying defect, corrupting `errorFreeUrlRate` and any downstream count that assumes one finding per problem.

## The general rule

Adding a code is additive and ships in a minor release. Renaming, removing, or changing the severity or message template of an existing code is a migration and needs an alias path before it ships.
