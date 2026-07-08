# Custom checks and plugins

Plugins let a project enforce deterministic organization-specific rules without forking the crawler or adding those rules to core. Good examples are placeholder brand names, required navigation links, or a reviewed site-profile expectation. Plugins run after the built-in checks against the same crawl snapshot and produce normal findings for JSON, Markdown, SARIF, baseline comparison, and `ci.failOn`.

Plugins should not start browsers, call Google APIs, mutate build output, fetch unbounded external resources, score content quality, or depend on time, randomness, locale, network timing, or machine-specific paths. Put heavyweight or stateful integrations in a separate tool or package.

Use [policy packs](policy-packs.md) before writing a custom plugin when the
rule is a common personal-site, company-site, directory, or AI-visibility safety
heuristic. Policy packs are exported plugin factories, so they can be mixed with
project-specific plugins in the same `plugins` array.

## Minimal custom check

```ts
import {
  defineCheck,
  defineConfig,
  definePlugin,
  presets,
} from "@silesiansolutions/search-quality-kit";

const noPlaceholderCopy = defineCheck({
  id: "custom.no-placeholder-copy",
  title: "No placeholder copy",
  category: "custom",
  classification: "local-heuristic",
  defaultSeverity: "warning",
  docsUrl: "https://example.com/internal-rules/no-placeholders",
  run(ctx) {
    return ctx.pages.flatMap((page) =>
      page.visibleText.includes("Lorem ipsum")
        ? [
            {
              code: "custom.no-placeholder-copy",
              severity: "warning",
              url: page.url,
              message: "Page contains placeholder copy.",
              remediation: "Replace placeholder copy before deployment.",
            },
          ]
        : [],
    );
  },
});

const internalRules = definePlugin({
  name: "internal-rules",
  checks: [noPlaceholderCopy],
});

export default defineConfig({
  ...presets.astro(),
  site: { baseUrl: "https://example.com" },
  plugins: [internalRules],
});
```

`severity` on a returned finding is optional; `defaultSeverity` is used when it is omitted. `message`, `remediation`, and a stable namespaced `code` are required. Check ids and finding codes must start with `custom.` or the plugin name, for example `internal-rules.contact-link`. Duplicate ids, missing `run`, unsupported severities, and invalid findings fail with an actionable plugin error.

## Stable plugin context

`run(ctx)` receives a deeply frozen snapshot, not the crawler's internal structures:

- `ctx.pages`: crawled pages in deterministic crawl order;
- `page.url`, `initialUrl`, and `finalUrl`;
- `page.statusCode`, optional `file`, and `rawHtml`;
- parsed `metadata`: title, description, canonical, robots, language, and Open Graph values;
- normalized links with raw `href`, resolved `url`, link text, and `rel` tokens;
- successfully parsed JSON-LD values in `structuredData`;
- normalized `visibleText` from delivered HTML;
- `ctx.config`: a read-only config snapshot with the `plugins` section removed.

Malformed JSON-LD remains visible in `rawHtml` and is reported by core, but it is not inserted as a fake parsed value. The context deliberately excludes mutable asset maps, child processes, crawl queues, response objects, and plugin functions.

## A plugin with several checks

Keep checks small and name them by policy, not implementation detail:

```ts
const plugin = definePlugin({
  name: "company-rules",
  checks: [noPlaceholderCopy, requireContactLink, rejectStagingBrandName],
});
```

The complete three-check example is under [`examples/plugins/`](../examples/plugins/). It is example behavior only; no Silesian Solutions brand rule is built into core.

## Findings, source attribution, and failures

Every new report identifies the producer:

```json
{
  "source": { "type": "plugin", "name": "internal-rules" }
}
```

Built-in findings use `{"type":"core","name":"structuredData"}`. Markdown shows the same source next to classification and impact; SARIF stores it in result properties.

An exception or invalid return value is not converted into an SEO finding. It appears in the top-level `pluginErrors` array and the Markdown/console `Plugin errors` section. The CLI still writes the report, then exits `2`, including in report-only mode. This prevents a broken custom policy from silently passing CI.

## Baselines and `ci.failOn`

Plugin findings participate in baseline comparison and severity gates exactly like core findings. Source attribution is intentionally not part of the current fingerprint, so adding `source` does not invalidate older v0.3 baselines. Identity remains normalized check id, code, severity, URL, target-relative file, and message.

Changing a check id, code, severity, location, or message can make a finding appear new. Treat those changes as policy migrations: review the diff, update internal plugin release notes, and regenerate the baseline only after approval. Changing remediation or documentation alone does not change identity.

## Versioning internal checks

- Publish shared plugins as a pinned workspace or package dependency instead of copying files between repositories.
- Use semantic versioning. Breaking context assumptions, id/code changes, or stricter behavior require a major version in the plugin package.
- Keep ids and codes stable after adoption. Add a new code when a rule has materially different meaning.
- Record the core package range tested by the plugin and run the plugin's fixtures against the lowest and highest supported versions.
- Do not encode a plugin version into each finding code; package metadata and the lockfile already own version selection.

## Avoiding flaky checks

Prefer pure functions of the provided snapshot. Sort any derived collections before producing aggregate findings. Normalize whitespace and URLs deliberately. Never read the current date, use randomness, depend on object key insertion from an external service, or make network calls inside `run`. If a policy needs remote state, fetch and pin that state before the audit or keep the integration outside core.

One finding per page/policy is usually more useful than one finding per matching DOM node. Bound message detail and move the durable fix into `remediation`.

## Writing useful remediation

Say what should change, where the owner should change it, and what success looks like. Prefer “Replace the placeholder in the shared company footer with the approved legal name” over “Fix branding.” Do not claim rankings or Google requirements unless the cited protocol or feature documentation actually requires the behavior.

## Classification

- `google-requirement`: a documented minimum protocol or applicable Google feature requirement. It is not shorthand for “important.”
- `google-recommendation`: current official guidance without a ranking or display guarantee.
- `local-heuristic`: a deterministic project rule or approximation, such as forbidden placeholder copy.
- `profile-expectation`: a requirement chosen by the site/profile configuration, such as expecting a contact link on company pages. It is not universal Google guidance.

When uncertain, use `local-heuristic`. A plugin cannot relabel a company preference as a Google rule by making its severity `error`.

## Testing locally

Keep fixture HTML in the plugin repository and call each check with a small typed context in unit tests. Then run the real integration against a production-equivalent build:

```bash
npm run build
npx search-quality-kit verify \
  --config search-quality.config.ts \
  --report-only \
  --json \
  --output /tmp/plugin-report.json
npx search-quality-kit report /tmp/plugin-report.json \
  --format markdown \
  --output /tmp/plugin-report.md
```

Inspect `source`, then repeat with `--baseline /tmp/plugin-report.json --fail-on-new` and expect zero new findings. Test invalid returns and thrown exceptions too; a policy library is only trustworthy when its failure mode is covered.

## API stability

The public contract and upgrade rules are documented in [Plugin API stability](design/plugin-api-stability.md). Import only symbols exported from the package root. Files under `src/`, crawler result types, and report formatter internals are not plugin API.
