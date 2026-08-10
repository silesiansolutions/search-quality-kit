import { statusIsTrustworthy, urlGraph } from "../crawler/graph.js";
import type { UrlEdge, UrlNode } from "../crawler/graph.js";
import type {
  Finding,
  FindingClassification,
  Severity,
} from "../report/types.js";
import {
  isKnownLanguage,
  isKnownRegion,
  parseHreflang,
} from "../utils/bcp47.js";
import { normalizeUrl } from "../utils/urls.js";
import type { CheckDefinition } from "./types.js";
import { finding } from "./types.js";

const CHECK = "hreflang",
  G =
    "https://developers.google.com/search/docs/specialty/international/localized-versions";

const GOOGLE_REQUIREMENT_CODES = new Set([
  "invalid-value",
  "invalid-language",
  "invalid-region",
  "relative-href",
  "missing-self",
  "missing-reciprocal",
  "duplicate-language",
  "broken-target",
]);

const DEFAULT_SEVERITY: Record<string, Severity> = {
  "invalid-value": "warning",
  "invalid-language": "warning",
  "invalid-region": "warning",
  "relative-href": "warning",
  "missing-self": "warning",
  "missing-reciprocal": "warning",
  "duplicate-language": "warning",
  "broken-target": "warning",
  "x-default-duplicate": "warning",
  "non-canonical-target": "warning",
  "lang-mismatch": "warning",
  "unresolved-target": "info",
  "missing-x-default": "info",
};

const CLASSIFICATION: Record<string, FindingClassification[]> = {
  "invalid-value": ["google-requirement"],
  "invalid-language": ["google-requirement"],
  "invalid-region": ["google-requirement"],
  "relative-href": ["google-requirement"],
  "missing-self": ["google-requirement"],
  "missing-reciprocal": ["google-requirement"],
  "duplicate-language": ["google-requirement"],
  "broken-target": ["google-requirement"],
  "x-default-duplicate": ["google-recommendation"],
  "non-canonical-target": ["google-recommendation"],
  "lang-mismatch": ["local-heuristic"],
  "unresolved-target": ["local-heuristic"],
  "missing-x-default": ["google-recommendation"],
};

const ABSOLUTE_URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

type AlternateEdge = Extract<UrlEdge, { kind: "alternate" }>;

function severityFor(code: string, strict: boolean): Severity {
  if (strict && GOOGLE_REQUIREMENT_CODES.has(code)) return "error";
  return DEFAULT_SEVERITY[code]!;
}

function tryNormalizeUrl(value: string, base?: string): string | undefined {
  try {
    return normalizeUrl(value, base);
  } catch {
    return undefined;
  }
}

function nodeOptions(node: UrlNode) {
  return { url: node.url, ...(node.file ? { file: node.file } : {}) };
}

function hf(
  code: string,
  strict: boolean,
  message: string,
  suggestion: string,
  options: Partial<Pick<Finding, "url" | "file" | "relatedUrls">> = {},
): Finding {
  const classification = CLASSIFICATION[code]!;
  return finding(CHECK, code, severityFor(code, strict), message, suggestion, {
    classification,
    ...(classification.includes("local-heuristic") ? {} : { googleDocs: G }),
    ...options,
  });
}

export const hreflangCheck: CheckDefinition = {
  name: "hreflang",
  description:
    "Validates hreflang alternates: subtag validity, self-reference, reciprocity, and target resolution.",
  run({ crawl, config }) {
    const graph = urlGraph(crawl);
    const alternateEdges = graph.edges.filter(
      (e): e is AlternateEdge => e.kind === "alternate",
    );
    if (alternateEdges.length === 0) return [];
    const outgoingAlternates = (id: string) =>
      graph.outgoing("alternate", id) as AlternateEdge[];

    const strict = config.rules.hreflang.strict;
    const out: Finding[] = [];

    const declaringIds = [...new Set(alternateEdges.map((e) => e.from))];
    const clusterIds = new Set<string>(declaringIds);
    for (const e of alternateEdges)
      if (e.to && graph.node(e.to)?.kind === "page") clusterIds.add(e.to);

    for (const pid of declaringIds) {
      const page = graph.node(pid);
      if (!page) continue;
      const own = outgoingAlternates(pid);
      const o = nodeOptions(page);

      for (const e of own) {
        if (!ABSOLUTE_URL_RE.test(e.rawTarget))
          out.push(
            hf(
              "relative-href",
              strict,
              `Hreflang href "${e.rawTarget}" is not a fully-qualified URL.`,
              "Use an absolute URL with a scheme (https://...) for the hreflang href.",
              o,
            ),
          );

        const parsed = parseHreflang(e.hreflang);
        if (parsed.kind === "malformed") {
          out.push(
            hf(
              "invalid-value",
              strict,
              `Hreflang value "${e.hreflang}" is not a valid BCP 47 language tag.`,
              'Use a valid BCP 47 tag such as "en" or "en-US", or "x-default".',
              o,
            ),
          );
          continue;
        }
        if (parsed.kind === "tag") {
          if (!isKnownLanguage(parsed.language!))
            out.push(
              hf(
                "invalid-language",
                strict,
                `Hreflang language subtag "${parsed.language}" is not a recognized ISO 639-1 code.`,
                "Use a two-letter ISO 639-1 language code.",
                o,
              ),
            );
          if (parsed.region && !isKnownRegion(parsed.region))
            out.push(
              hf(
                "invalid-region",
                strict,
                `Hreflang region subtag "${parsed.region}" is not a recognized ISO 3166-1 or UN M.49 code.`,
                'Use a two-letter ISO 3166-1 region code or a UN M.49 macro-region such as "419".',
                o,
              ),
            );
        }
      }

      const hasSelf = own.some((e) => e.to === pid);
      if (own.length > 0 && !hasSelf)
        out.push(
          hf(
            "missing-self",
            strict,
            "Page declares hreflang alternates but none references itself.",
            "Add a self-referencing hreflang link so this page lists itself among its language versions.",
            o,
          ),
        );

      const byValue = new Map<string, UrlEdge[]>();
      for (const e of own) {
        const parsed = parseHreflang(e.hreflang);
        if (parsed.kind !== "tag") continue;
        const key = [parsed.language, parsed.script, parsed.region]
          .filter(Boolean)
          .join("-");
        const list = byValue.get(key) ?? [];
        list.push(e);
        byValue.set(key, list);
      }
      for (const [value, list] of byValue) {
        if (list.length < 2) continue;
        const targets = new Set(list.map((e) => e.to ?? `raw:${e.rawTarget}`));
        if (targets.size > 1)
          out.push(
            hf(
              "duplicate-language",
              strict,
              `Hreflang value "${value}" is declared more than once with different targets.`,
              "Keep a single hreflang entry per language/region combination pointing at one target.",
              o,
            ),
          );
      }

      const xDefaults = own.filter(
        (e) => parseHreflang(e.hreflang).kind === "x-default",
      );
      if (xDefaults.length > 1)
        out.push(
          hf(
            "x-default-duplicate",
            strict,
            "Page declares more than one x-default hreflang entry.",
            "Keep a single x-default hreflang link per page.",
            o,
          ),
        );

      if (page.htmlLang) {
        const selfEdge = own.find((e) => e.to === pid);
        if (selfEdge) {
          const selfParsed = parseHreflang(selfEdge.hreflang);
          if (selfParsed.kind === "tag") {
            const htmlPrimary = page.htmlLang.split("-")[0]!.toLowerCase();
            if (htmlPrimary !== selfParsed.language)
              out.push(
                hf(
                  "lang-mismatch",
                  strict,
                  "<html lang> does not match the page's own hreflang language.",
                  "Align the html lang attribute with the page's self-referencing hreflang value.",
                  o,
                ),
              );
          }
        }
      }
    }

    for (const e of alternateEdges) {
      if (!e.to) continue;
      const from = graph.node(e.from);
      const target = graph.node(e.to);
      if (!from || !target) continue;
      const o = nodeOptions(from);

      if (target.kind !== "page") {
        if (target.sameOrigin)
          out.push(
            hf(
              "unresolved-target",
              strict,
              `Alternate hreflang target ${target.url} was not found in the crawl.`,
              "Raise crawl.maxPages or add the target as an entrypoint so this hreflang link can be verified.",
              o,
            ),
          );
        continue;
      }

      if (statusIsTrustworthy(target) && target.status >= 400)
        out.push(
          hf(
            "broken-target",
            strict,
            `Alternate hreflang target ${target.url} returned an HTTP error status.`,
            "Fix or remove the broken hreflang target.",
            o,
          ),
        );

      if (
        config.rules.hreflang.requireCanonicalTargets &&
        target.canonicalHref
      ) {
        const canonicalId = tryNormalizeUrl(target.canonicalHref, target.url);
        if (canonicalId && canonicalId !== target.id)
          out.push(
            hf(
              "non-canonical-target",
              strict,
              `Alternate hreflang target ${target.url} declares a different canonical URL.`,
              "Point the hreflang href at the target's canonical URL, or adjust the target's canonical.",
              o,
            ),
          );
      }
    }

    for (const yid of clusterIds) {
      const yNode = graph.node(yid);
      if (!yNode || yNode.kind !== "page") continue;
      const incoming = graph
        .incoming("alternate", yid)
        .filter((e) => e.from !== yid && graph.node(e.from)?.kind === "page");
      const zIds = [...new Set(incoming.map((e) => e.from))];
      if (zIds.length === 0) continue;
      const outgoingTargets = new Set(
        graph
          .outgoing("alternate", yid)
          .map((e) => e.to)
          .filter((to): to is string => Boolean(to)),
      );
      const failing = zIds.filter((zid) => !outgoingTargets.has(zid));
      if (failing.length === 0) continue;
      const relatedUrls = failing
        .map((zid) => graph.node(zid)?.url)
        .filter((u): u is string => Boolean(u))
        .sort();
      out.push(
        hf(
          "missing-reciprocal",
          strict,
          "Page is missing a reciprocal hreflang link back from its alternates.",
          "Add hreflang links back to the pages that reference this page as an alternate.",
          { ...nodeOptions(yNode), relatedUrls },
        ),
      );
    }

    if (config.rules.hreflang.requireXDefault) {
      const parent = new Map<string, string>();
      const find = (id: string): string => {
        let root = id;
        while (parent.get(root) !== root) root = parent.get(root)!;
        return root;
      };
      const union = (a: string, b: string) => {
        const ra = find(a),
          rb = find(b);
        if (ra !== rb) parent.set(ra, rb);
      };
      for (const id of clusterIds) parent.set(id, id);
      for (const e of alternateEdges)
        if (e.to && clusterIds.has(e.from) && clusterIds.has(e.to))
          union(e.from, e.to);

      const groups = new Map<string, string[]>();
      for (const id of clusterIds) {
        const root = find(id);
        const list = groups.get(root) ?? [];
        list.push(id);
        groups.set(root, list);
      }

      for (const ids of groups.values()) {
        const groupSet = new Set(ids);
        const groupEdges = alternateEdges.filter((e) => groupSet.has(e.from));
        const hasXDefault = groupEdges.some(
          (e) => parseHreflang(e.hreflang).kind === "x-default",
        );
        if (hasXDefault) continue;
        const languages = new Set(
          groupEdges
            .map((e) => parseHreflang(e.hreflang))
            .filter((p) => p.kind === "tag")
            .map((p) => p.language),
        );
        if (languages.size < 2) continue;
        const sortedNodes = ids
          .map((id) => graph.node(id))
          .filter((n): n is UrlNode => Boolean(n))
          .sort((a, b) => a.url.localeCompare(b.url));
        if (sortedNodes.length === 0) continue;
        const [first, ...rest] = sortedNodes;
        out.push(
          hf(
            "missing-x-default",
            strict,
            "Hreflang cluster has multiple language versions but no x-default entry.",
            "Add an x-default hreflang link pointing at the recommended fallback page for this cluster.",
            {
              ...nodeOptions(first!),
              ...(rest.length ? { relatedUrls: rest.map((n) => n.url) } : {}),
            },
          ),
        );
      }
    }

    return out;
  },
};
