# URL graph

Promote crawl output into an explicit URL graph, derived on demand, as the enabling refactor for cross-page checks.

## Why a graph

Checks currently re-derive the same crawl state independently and incompatibly. Link edges are discarded after `discoverLinks` runs once during the crawl (`src/crawler/crawlSite.ts:325`) and then rebuilt with `loadHtml(p.html)` in `internalLinks.ts:33`, `accessibility.ts:48`, `structuredData.ts:626`, and `plugins/context.ts:42` — about eleven `loadHtml` calls per page across a full run. Sitemap membership is rebuilt twice, incompatibly: `canonical.ts:18-26` builds a normalized `Set` from `crawl.sitemapUrls`, `internalLinks.ts:23-28` builds a `Map` keyed the same way but filtered by origin and path allowlist. Redirect hops collapse to a single `initialUrl`/`finalUrl` pair with no intermediate structure. None of this duplication is accidental complexity to clean up — it is the absence of a shared model. Cross-page questions such as hreflang reciprocity, canonical target resolution, and sitemap correlation are edge queries over the crawl, and edge queries have no home in `CrawlResult` today.

## Threading mechanism

The graph is a free memoized accessor, not a new `CheckContext` field:

```ts
const cache = new WeakMap<CrawlResult, UrlGraph>();
export function urlGraph(crawl: CrawlResult): UrlGraph;
```

in a new `src/crawler/graph.ts`. `CheckContext` (`src/checks/types.ts:61-64`), `src/engine/verify.ts`, `tests/helpers.ts`, and every other `{config, crawl}` construction site stay unchanged. `src/crawler/types.ts` changes by zero lines. That is a reviewable property of the diff, not a claim to take on faith.

## Derive on demand, not during the crawl

The graph is built lazily from a finished `CrawlResult`, never inside `crawlStatic` or `crawlHttp`. Three reasons, in order:

1. Building the graph inside the two crawl functions separately would reproduce exactly the duplication that already produced two incompatible sitemap-membership rebuilds — one graph builder per crawl mode is the same mistake as one sitemap rebuild per check.
2. Zero cost when no consumer runs. Disabling every graph-backed check restores v0.10 timings exactly, because `urlGraph` is never called.
3. Every existing test already constructs a `CrawlResult`. Graph coverage over that fixture data is free — no new fixture infrastructure.

## Provenance is the core of the model

```ts
export type StatusProvenance = "observed" | "assumed" | "unresolved";
```

In static mode **no** node is `observed`, whatever its kind. Page nodes are `assumed` because `crawlSite.ts:178` hardcodes `status: 200` and `crawlSite.ts:180` hardcodes `headers: {}` for every built page regardless of what a server would actually return. Sitemap nodes are `assumed` for the same reason at one remove: a sitemap file present in the build output says nothing about what the origin will serve for that path, so its `200` is as synthetic as a page's. The rule is deliberately stated per mode rather than per node kind — a mode-wide invariant cannot be violated by adding a node kind later, and a per-kind rule can. In HTTP mode both come from a real response and are `observed`. Targets discovered as link, canonical, or hreflang targets but never crawled are `unresolved`, carrying no status at all, in either mode. The predicate:

```ts
export function statusIsTrustworthy(node: UrlNode): boolean;
```

ships alongside the type, and every status-dependent finding must route its status read through it. This is what makes status-dependent findings structurally silent in static mode instead of accidentally wrong. Contrast it with the existing `x-robots-tag` case: `indexability.ts:47` reads `p.headers["x-robots-tag"]`, which is dead code in static mode because `headers` is always `{}` there, but nothing in the check signals that the read is meaningless. `statusIsTrustworthy` turns that class of silent dead code into a typed, checkable gate instead of a fact a check author has to already know.

## Node and edge model

```ts
export interface UrlNode {
  id: string;
  url: string;
  kind: "page" | "referenced" | "sitemap";
  status?: number;
  statusProvenance: StatusProvenance;
  sameOrigin: boolean;
  file?: string;
  pageIndex?: number;
  inAssets: boolean;
  noindex?: boolean;
  htmlLang?: string;
  canonicalHref?: string;
}

interface EdgeBase {
  from: string;
  to?: string;
  rawTarget: string;
}

export type UrlEdge =
  | (EdgeBase & { kind: "link" })
  | (EdgeBase & { kind: "canonical" })
  | (EdgeBase & { kind: "alternate"; hreflang: string })
  | (EdgeBase & { kind: "sitemap" })
  | (EdgeBase & { kind: "redirect" });
```

`id` is the normalized URL — graph identity, not the raw string. `to` is optional because an edge can exist without a resolved target: `internalLinks.ts:37-49` reports `empty-href` and `internalLinks.ts:51-66` reports `malformed-href` for anchors whose `href` never resolves to a URL. If `to` were required, those hrefs could never become edges and `internalLinks` could never migrate onto the graph without losing findings it already produces.

## The public shape is free of Maps

The builder keeps lookup `Map`s in closure scope; `UrlGraph` exposes only readonly arrays and lookup functions over them. This is a forward-compatibility constraint, not a style preference: `plugins/context.ts:17-23` `deepFreeze` iterates `Object.values(value)` and calls `Object.freeze` on each child. A `Map` handed through that path would itself be frozen, but `Map.prototype.set` keeps working on a frozen `Map` — the freeze is shallow and the immutable-snapshot guarantee silently breaks. `docs/plugins.md:85` already documents that the plugin context excludes mutable asset maps for this reason. v0.11 does not expose the graph to plugins at all — `PluginCheckContext` is unchanged. Whether and how to expose it later is a decision governed by [plugin API stability](plugin-api-stability.md), not one this note makes.

## What the graph deliberately cannot represent in 0.11

Redirect hops. `fetchPage.ts:10` fetches with `redirect: "follow"`, so the runtime follows a redirect chain and returns only the final response; `crawlSite.ts:314-323` then keeps `initialUrl` and `finalUrl` and drops the `redirected` flag entirely. The graph can carry at most one collapsed redirect edge per page and cannot answer chain length or loop detection — that data was never captured. Redirect-integrity checks wait for the `fetchPage` rework that retains hop-by-hop history.

`{status: 0}` is also deliberately opaque. `fetchPage.ts:24-30` is a bare `catch {}` that collapses timeout, DNS failure, connection refused, TLS error, and redirect loop into the same `{status: 0}` result, discarding the original error object. No check built on the graph may name a specific cause for a zero status — the graph has no more information than the crawler captured, and the crawler captured none.
