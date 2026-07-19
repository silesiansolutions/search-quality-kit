# Future Google integrations

Google-backed validation should live in a separate optional package or plugin, not in the offline core.

A future integration could correlate Search Console performance changes with deterministic deploy findings and optionally call the URL Inspection API for explicitly selected URLs. It must handle credentials, quotas, property permissions, delayed data, privacy, and network failure without changing core report determinism.

Rich Results Test should not be cloned. Feature eligibility and Google's rendering behavior evolve independently; the core should keep bounded syntax, URL, identity, and consistency checks, then link to official tools for external validation.

The core remains small, offline, CI-first, and usable without a Google account. The operational work once proposed here — the Action wrapper, SARIF hardening, the multi-site runner, and the plugin API — shipped in v0.6–v0.7; current sequencing lives in the [product roadmap](../roadmap.md).
