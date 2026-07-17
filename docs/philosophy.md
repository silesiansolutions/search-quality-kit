# Philosophy

search-quality-kit verifies technical search foundations. It does not promise ranking gains, perform SEO spam, generate content, or judge the business quality of copy.

It complements rather than replaces Google Search Console, Rich Results Test, URL Inspection, PageSpeed Insights, or Lighthouse. Local checks deliberately catch deterministic regressions before deployment; Google-owned tools remain authoritative for Google rendering, eligibility, field data, and indexed state.

The tool must remain useful locally and in CI, configurable per project, framework-independent, and able to run its core checks without internet access. Validation logic lives centrally in this repository. Target applications keep only configuration and workflow glue.

Rules distinguish hard technical failures from recommendations and heuristics. A malformed sitemap or localhost canonical can be an error. Approximate title length, HTML weight, heading structure, and lazy-loading opportunities are warnings because context matters and Google does not define universal thresholds for them.

The first version optimizes for explainable regression detection, not crawler scale. It favors stable findings, actionable remediation, offline fixtures, and a small dependency graph over browser automation or opaque scoring.

Agent-readiness checks follow the same discipline: they are deterministic and static, and are labeled `agentic-readiness` rather than a Google requirement or recommendation. The kit does not attempt runtime agentic audits — cumulative layout shift, the runtime accessibility tree, and imperative WebMCP tool registration all need a real browser, so Lighthouse remains authoritative there.
