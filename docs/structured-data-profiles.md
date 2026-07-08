# Structured data profiles

Profiles add page-context to deterministic technical checks. They let a personal homepage expect `Person`, a company homepage expect `Organization`, a blog route expect `Article` or `BlogPosting`, and directory routes distinguish list pages from entries.

Profiles do not score content, predict rankings, prove rich-result eligibility, require private data, call Google APIs, or replace Rich Results Test, Search Console, or a schema.org validator. Technical findings such as invalid JSON, invalid URLs, local/staging leaks, broken canonicals, and conflicting identities remain visible under every profile.

## Finding classifications

- `google-requirement`: a property or protocol requirement documented by Google for the stated feature or technical behavior. It is not automatically a general indexing requirement.
- `google-recommendation`: current official guidance that may improve understanding or feature quality, without a ranking or display guarantee.
- `local-heuristic`: a deterministic project approximation designed to catch obvious regressions.
- `profile-expectation`: an assumption selected by your config for a site type or route. Missing markup is a warning, not proof of an SEO defect.

Every JSON finding includes `severity`, `classification`, and `impact`. Profile-aware pages and findings also include `activeProfile` and, when applicable, `expectedStructuredData`. Markdown renders the same context, groups repeated check codes, and caps each group's detail at 20 entries; JSON retains every finding.

## Choose a profile

Use the narrowest accurate default and override mixed route groups. `generic` preserves minimal JSON-LD sanity checks and is the default when no profile is configured.

| Profile factory            | Config id       | Bounded expectation                                         |
| -------------------------- | --------------- | ----------------------------------------------------------- |
| `profiles.personalSite()`  | `personal`      | `Person` on `/` or common about routes                      |
| `profiles.companySite()`   | `company`       | `Organization` on `/`                                       |
| `profiles.blog()`          | `blog`          | `Article` or `BlogPosting` on likely content routes         |
| `profiles.directory()`     | `directory`     | `ItemList` on `/`; use route profiles for lists and entries |
| `profiles.localBusiness()` | `localBusiness` | `LocalBusiness` or a recognized subtype                     |
| `profiles.generic()`       | `generic`       | no site-type expectation                                    |

Route-only profiles are `blogPost`, `directoryEntry`, `directoryList`, and `servicePage`. `directoryEntry` accepts `Organization` or `LocalBusiness`; `blogPost` accepts `Article` or `BlogPosting`. A coherent repeated set of entry links can satisfy the built-in `directoryList` expectation when `ItemList` is not explicitly required.

## Personal site

```ts
export default defineConfig({
  ...presets.astro(),
  ...profiles.personalSite(),
  site: { baseUrl: "https://person.example" },
});
```

The profile checks public `name`, `url`, `sameAs`, and a useful professional description when a `Person` node exists. It does not request an address, telephone number, birth date, or any other private field.

## Company site

```ts
export default defineConfig({
  ...presets.astro(),
  ...profiles.companySite(),
  site: { baseUrl: "https://company.example" },
  profiles: {
    default: "company",
    routes: [{ pattern: "/services/**", profile: "servicePage" }],
  },
});
```

The homepage expectation is `Organization`. `logo` and `sameAs` are useful when accurate but are not forced. Service routes can opt into `Service` explicitly.

## Blog or publication

```ts
profiles: {
  default: "blog",
  routes: [
    {
      pattern: "/blog/**",
      profile: "blogPost",
      expectedStructuredData: ["BreadcrumbList"],
    },
  ],
}
```

For article nodes, `headline`, `description`, `datePublished`, `dateModified`, `author`, and `image` are grouped into one recommendation finding instead of six warnings. Current Google Article documentation lists these as recommendations and states that Article has no required properties. Headline checks require an obvious conflict with both title and H1; wording does not need to match byte-for-byte.

## Directory or catalog

```ts
profiles: {
  default: "directory",
  routes: [
    {
      pattern: "/entries/**",
      profile: "directoryEntry",
      expectedStructuredData: ["BreadcrumbList"],
    },
    {
      pattern: "/categories/**",
      profile: "directoryList",
      expectedStructuredData: ["ItemList", "BreadcrumbList"],
    },
  ],
}
```

Entry pages may use `Organization` or a `LocalBusiness` subtype. Incomplete listings are valid: the tool checks only values that exist, core identity, placeholders, obvious name conflicts, canonical self-reference, and configured expectations. It does not force every company field.

## Route patterns and precedence

Patterns must start with `/`. `*` matches within one segment and `**` crosses segments. Routes are evaluated in declaration order and the first match wins, so put narrow patterns before catch-alls.

```ts
routes: [
  { pattern: "/blog/archive/**", profile: "generic" },
  { pattern: "/blog/**", profile: "blogPost" },
];
```

Route `expectedStructuredData` is additive. Use it for types that are truly part of the route contract, not aspirational content strategy.

## Intentional exceptions

Prefer a narrow route override over disabling `structuredData` globally:

```ts
profiles: {
  default: "company",
  routes: [{ pattern: "/legal/**", profile: "generic" }],
}
```

Use `crawl.exclude` only for reviewed pages that intentionally sit outside audit scope, such as a deliberate noindex route. Do not exclude a route merely to hide malformed JSON-LD, local URLs, canonical conflicts, or placeholders. For legacy sites, capture a reviewed JSON baseline and use `--fail-on-new`; the baseline keeps debt visible while gating new regressions.

Run `search-quality-kit list-profiles` to inspect profile ids, expected types, typical routes, and the non-hard-requirement status of profile findings.
