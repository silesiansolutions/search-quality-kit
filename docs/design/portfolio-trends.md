# Portfolio trend storage

Status: design note; no released version implements a trend database.

## Options

1. **Workflow artifacts:** keep each run's `portfolio.json` and site reports under GitHub's retention policy. This is cheap, contextual, and already supported, but cross-run queries require downloading artifacts.
2. **Reviewed committed snapshots:** commit selected baselines or release snapshots. Diffs are visible and portable, but automatic report commits create noise and can accept transient production state accidentally.
3. **GitHub Pages:** publish a small static history derived from reviewed artifacts. This improves discovery but adds a build, retention policy, and public presentation layer.
4. **Separate demo repository:** decouple demo/history releases from the package when generated content or multi-version testing becomes large. It adds compatibility and review drift today.
5. **External object/database storage:** retain structured history and query trends at scale. It introduces credentials, cost, privacy, lifecycle, and operational ownership that do not belong in the lightweight core.

## Risks

Public HTTP results can vary because of deployments, temporary network/CDN behavior, redirects, and bounded crawl discovery. Artifacts lack source context unless the workflow records the target revision. A trend can look authoritative while comparing different crawl scopes, config versions, package versions, or baseline policies.

## Recommendation

Use GitHub Actions artifacts for every showcase run and manually reviewed single-site baselines when regression gating is useful. Record package/config revision with retained snapshots. Do not add an external store, scheduler service, automatic baseline mutation, or ranking dashboard to core. This is a continuous track in the [product roadmap](../roadmap.md).
