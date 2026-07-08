# Plugin API stability

## Public API

The supported plugin surface is exported from `@silesiansolutions/search-quality-kit`: `defineCheck`, `definePlugin`, and the `Plugin*` TypeScript types. The documented fields of `PluginCheckContext`, `PluginPage`, `PluginFinding`, `PluginCheckDefinition`, and `PluginDefinition` are public. Additive optional fields may be introduced in minor releases.

The config `plugins` array, plugin source attribution, and top-level `pluginErrors` report field are also supported contracts. The report remains schema `0.3`; these fields are additive and parsers must continue accepting older reports without them.

## Internal API

Crawler queues/results, Cheerio objects, asset maps, check runner modules, context construction, validation helpers, config internals, and formatter implementation files are internal. Do not import `dist/plugins/*`, `src/*`, or undocumented subpaths. The package exports only the root entry point on purpose.

## Breaking changes

Removing or renaming a documented context field, changing its meaning, narrowing accepted findings, or changing check execution semantics requires a package major release. A new optional context/report field, clearer validation for already-invalid input, or an additive helper may ship in a minor release. Security fixes can reject unsafe behavior even when code depended on it.

## Resilient plugins

- import only from the package root;
- treat context objects as read-only snapshots;
- use documented fields and tolerate new fields;
- keep ids, codes, severities, and message templates stable;
- never rely on check execution timing or mutable global state;
- pin a compatible core version range and test upgrades before widening it.

## Testing outside core

Plugin packages should own typed fixtures, runtime validation/error tests, JSON/Markdown integration tests, and a baseline round-trip. CI should test the lowest supported core version plus the current pinned version. A small consumer fixture that loads a real TypeScript config catches packaging/export regressions that isolated unit tests miss.
