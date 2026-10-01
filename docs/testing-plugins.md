# Testing plugins

Use the public test harness when a plugin or policy pack can be tested from a
small HTML fixture and a typed plugin context. It skips the crawler, build
commands, local servers, and report formatting. The plugin definition and
finding validation stay the same as in the CLI.

```ts
import { policyPacks } from "@silesiansolutions/search-quality-kit";
import {
  createPluginTestContext,
  runPluginForTest,
} from "@silesiansolutions/search-quality-kit/test-utils";

const ctx = createPluginTestContext({
  pages: [
    {
      url: "https://example.com/",
      html: "<html><head><title>Demo Company</title></head><body>Lorem ipsum</body></html>",
    },
  ],
});

const { findings, errors } = await runPluginForTest(
  policyPacks.companySite(),
  ctx,
);
```

`errors` is the same plugin-error model the CLI uses. Assert it explicitly
when testing thrown checks or invalid findings.

## `createPluginTestContext`

```ts
const ctx = createPluginTestContext({
  config: {
    site: { baseUrl: "https://example.com" },
    profiles: {
      default: "company",
      routes: [{ pattern: "/services/**", profile: "servicePage" }],
    },
  },
  pages: [
    {
      url: "https://example.com/services/audit",
      finalUrl: "https://example.com/services/audit",
      statusCode: 200,
      html,
      visibleText: "Optional override",
      metadata: {
        title: "Optional override",
        openGraph: { "og:url": "https://example.com/services/audit" },
      },
      links: [
        {
          href: "/contact",
          url: "https://example.com/contact",
          text: "Contact",
          rel: [],
        },
      ],
      structuredData: [{ "@type": "Service", name: "Audit" }],
    },
  ],
});
```

The helper parses title, description, canonical, robots, language, Open Graph,
links, JSON-LD, and visible text from `html`. Per-page overrides pin edge
cases. Tests then do not depend on parser details.

The returned context is deeply frozen. It excludes `plugins` from
`ctx.config`, as in normal plugin execution.

## `runCheckForTest`

```ts
const { findings, errors } = await runCheckForTest(check, ctx);
```

Use this for unit-testing a single `defineCheck` result. The helper wraps the
check in a temporary plugin. It validates returned findings exactly like normal
plugin execution. For `custom.*` checks the temporary plugin name is
`test-plugin`. For namespaced checks it uses the namespace before the first dot.

Pass `pluginName` only when the test needs a specific plugin source:

```ts
await runCheckForTest(check, ctx, { pluginName: "internal-rules" });
```

## `runPluginForTest`

```ts
const { findings, errors } = await runPluginForTest(plugin, ctx);
```

Use this for plugin-level behavior: duplicate pages, aggregate checks, policy
packs, and error handling. It does not run built-in core checks. It does not
write reports. When adopting a plugin in a real site, run one end-to-end
`search-quality-kit verify --report-only` smoke test separately.
