# Policy packs

Policy packs are reusable, deterministic plugins for common public-site rollout
checks. They use the same plugin API as custom checks, so findings work with
JSON, Markdown, SARIF, baselines, `ci.failOn`, and source attribution.

They are intentionally small. A policy pack does not call Google APIs, launch a
browser, score content quality, measure Core Web Vitals, require private contact
data, or claim special requirements for AI Overviews or AI Mode.

## Usage

```ts
import {
  defineConfig,
  policyPacks,
  presets,
  profiles,
} from "@silesiansolutions/search-quality-kit";

export default defineConfig({
  ...presets.astro(),
  ...profiles.companySite(),
  site: {
    baseUrl: "https://example.com",
  },
  plugins: [policyPacks.companySite(), policyPacks.aiVisibilitySafe()],
});
```

The exported factories are:

- `policyPacks.personalBrand()`
- `policyPacks.companySite()`
- `policyPacks.directory()`
- `policyPacks.aiVisibilitySafe()`

Equivalent named exports are available for direct imports:

- `personalBrandPolicyPack`
- `companySitePolicyPack`
- `directoryPolicyPack`
- `aiVisibilitySafePolicyPack`

## `personalBrand`

Plugin name: `personal-brand`.

Checks:

- `personal-brand.no-placeholder-copy`: visible text contains placeholders such
  as `Lorem ipsum`, `TODO`, `TBD`, `example.com`, `Demo Person`, or `Your Name`.
- `personal-brand.contact-or-profile-link`: personal home/about pages have no
  obvious contact, booking, email, or public profile link.
- `personal-brand.specific-description`: title, H1, or description is a generic
  phrase such as `Personal website`.

The contact/profile check is a `profile-expectation`. It does not require a
phone number, address, or private personal data.

## `companySite`

Plugin name: `company-site`.

Checks:

- `company-site.no-placeholder-copy`: visible text contains placeholders such as
  `Demo Company`, `Acme`, `Your Company`, `example.com`, or `TODO`.
- `company-site.contact-link`: company home/service pages have no obvious
  contact, booking, quote, or consultation link.
- `company-site.organization-name-conflict`: an Organization JSON-LD name
  obviously conflicts with both the page title and H1.
- `company-site.no-staging-copy`: visible text contains obvious staging/local
  copy or local URLs.

The pack does not require phone numbers, physical addresses, tax IDs, or company
registry data.

## `directory`

Plugin name: `directory`.

Checks:

- `directory.no-placeholder-copy`: visible text contains directory/listing
  placeholders.
- `directory.entry-has-name`: a `directoryEntry` page has no obvious listing
  name in title, H1, or JSON-LD.
- `directory.entry-name-consistency`: an entry JSON-LD name obviously conflicts
  with both title and H1.
- `directory.list-not-empty`: a `directoryList` page has an empty `ItemList` or
  obvious empty-state copy.
- `directory.specific-entry-title`: a `directoryEntry` title/H1 is generic, for
  example `Company profile`.

The pack checks for obvious structural regressions. It does not judge listing
quality or require complete business details.

## `aiVisibilitySafe`

Plugin name: `ai-visibility-safe`.

Checks:

- `ai-visibility-safe.public-snippet-directives`: public pages declare
  `noindex`, `none`, `nosnippet`, or `max-snippet:0`.
- `ai-visibility-safe.meaningful-visible-text`: delivered HTML has very little
  visible text or looks like an app shell.
- `ai-visibility-safe.url-consistency`: canonical/final URL conflicts with
  `og:url` or page-level JSON-LD URL values.
- `ai-visibility-safe.no-placeholder-shell`: delivered HTML looks like
  placeholder copy or app-shell-only content.

All checks in this pack are local heuristics. The pack does not require
`llms.txt` and does not represent AI-search-specific ranking requirements.

## Route profiles

Policy packs become more useful when the site config identifies route types:

```ts
export default defineConfig({
  ...presets.astro(),
  ...profiles.directory(),
  site: { baseUrl: "https://example.com" },
  profiles: {
    default: "directory",
    routes: [
      { pattern: "/entries/**", profile: "directoryEntry" },
      { pattern: "/categories/**", profile: "directoryList" },
      { pattern: "/blog/**", profile: "blogPost" },
    ],
  },
  plugins: [policyPacks.directory(), policyPacks.aiVisibilitySafe()],
});
```

Use `profile-expectation` findings as project policy: review them, fix real
issues, or document intentional exceptions in your rollout baseline. Keep custom
project rules in your own plugin when they depend on private business logic.
