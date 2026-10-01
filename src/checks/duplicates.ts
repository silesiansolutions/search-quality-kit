import { createHash } from "node:crypto";
import { urlGraph } from "../crawler/graph.js";
import type { PageArtifact } from "../crawler/types.js";
import { loadHtml, normalizedText, textFromSelection } from "../utils/html.js";
import type { CheckDefinition } from "./types.js";
import { finding, pageOptions } from "./types.js";
const G =
  "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls";
const RELATED_LIMIT = 10;

export function mainContentText(html: string) {
  const $ = loadHtml(html);
  const main = $("main");
  let root = main;
  if (main.length !== 1) {
    root = $("body");
    root.find("header,nav,footer,aside").remove();
  }
  root.find("script,style,noscript,template,svg").remove();
  return normalizedText(
    textFromSelection(root, {
      maxChars: Number.POSITIVE_INFINITY,
      maxNodes: Number.POSITIVE_INFINITY,
    }).normalize("NFC"),
  );
}

export function mainContentHash(html: string) {
  const text = mainContentText(html);
  return text ? createHash("sha256").update(text).digest("hex") : undefined;
}

function hreflangVariants(
  graph: ReturnType<typeof urlGraph>,
  members: readonly { id: string }[],
) {
  const ids = new Set(members.map((member) => member.id));
  const variants = new Set<string>();
  for (const { id } of members)
    for (const edge of graph.outgoing("alternate", id))
      if (
        edge.to &&
        edge.to !== id &&
        ids.has(edge.to) &&
        graph.outgoing("alternate", edge.to).some((back) => back.to === id)
      ) {
        variants.add(id);
        variants.add(edge.to);
      }
  return variants;
}

function headerNoindex(page: PageArtifact) {
  return /(?:^|[,\s])(?:noindex|none)(?:$|[,\s])/i.test(
    page.headers["x-robots-tag"] ?? "",
  );
}

export const duplicatesCheck: CheckDefinition = {
  name: "duplicates",
  description:
    "Groups pages with identical main content and checks that each group declares one canonical.",
  run({ crawl, config }) {
    const graph = urlGraph(crawl);
    const minLength = config.rules.renderedHtml.minTextLength;
    const groups = new Map<
      string,
      { page: PageArtifact; id: string; canonical?: string }[]
    >();
    for (const page of crawl.pages) {
      if (page.status !== 200 || headerNoindex(page)) continue;
      const node = graph.node(page.url);
      if (!node || node.noindex) continue;
      let text: string;
      try {
        text = mainContentText(page.html);
      } catch {
        continue;
      }
      if (!text || text.length < minLength) continue;
      const hash = createHash("sha256").update(text).digest("hex");
      const canonicalEdge = graph
        .outgoing("canonical", node.id)
        .find((edge) => edge.to);
      const members = groups.get(hash) ?? [];
      members.push({
        page,
        id: node.id,
        ...(node.canonicalHref
          ? { canonical: canonicalEdge?.to ?? node.canonicalHref }
          : {}),
      });
      groups.set(hash, members);
    }
    const out = [];
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const variants = hreflangVariants(graph, group);
      const members = group.filter((member) => !variants.has(member.id));
      if (!members.length) continue;
      const related = (page: PageArtifact) =>
        group
          .filter((member) => member.page !== page)
          .map((member) => member.page.url)
          .sort()
          .slice(0, RELATED_LIMIT);
      const missing = members.filter(
        (member) => member.canonical === undefined,
      );
      if (missing.length) {
        for (const { page } of missing)
          out.push(
            finding(
              "duplicates",
              "exact-without-canonical",
              "warning",
              `Main content of ${page.url} is identical to other crawled pages, and this page declares no canonical.`,
              "Add rel=canonical pointing at the one URL that should represent this content, or remove the duplicate.",
              {
                ...pageOptions(page),
                relatedUrls: related(page),
                googleDocs: G,
              },
            ),
          );
        continue;
      }
      const cluster = new Set(
        group
          .filter((member) => variants.has(member.id))
          .flatMap((member) => [member.id, member.canonical ?? member.id]),
      );
      const conflicting = cluster.size
        ? members.filter((member) => !cluster.has(member.canonical!))
        : new Set(members.map((member) => member.canonical)).size < 2
          ? []
          : members;
      for (const { page } of conflicting)
        out.push(
          finding(
            "duplicates",
            "conflicting-canonicals",
            "warning",
            `Main content of ${page.url} is identical to other crawled pages that declare a different canonical.`,
            "Point every copy at the same canonical URL.",
            {
              ...pageOptions(page),
              relatedUrls: related(page),
              googleDocs: G,
            },
          ),
        );
    }
    return out;
  },
};
