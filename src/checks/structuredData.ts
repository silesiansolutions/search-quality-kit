import { loadHtml } from "../utils/html.js";
import { isLocalOrStaging } from "../utils/urls.js";
import type { Finding } from "../report/types.js";
import type { CheckDefinition } from "./types.js";
import { finding, pageOptions } from "./types.js";
const G =
    "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data",
  PLACE = /^(example|test|todo|tbd|lorem ipsum|your (name|company|url))$/i;
function nodes(v: any): any[] {
  if (Array.isArray(v)) return v.flatMap(nodes);
  if (v && typeof v === "object" && Array.isArray(v["@graph"]))
    return [v, ...v["@graph"].flatMap(nodes)];
  return v && typeof v === "object" ? [v] : [];
}
function inspect(
  v: any,
  path: string,
  page: { url: string; file?: string },
  config: Parameters<CheckDefinition["run"]>[0]["config"],
): Finding[] {
  const out: Finding[] = [];
  if (v === "" || v === null)
    out.push(
      finding(
        "structured-data",
        "empty-value",
        "warning",
        `Empty JSON-LD value at ${path}.`,
        "Remove it or provide accurate data.",
        { ...page, googleDocs: G },
      ),
    );
  else if (typeof v === "string") {
    if (PLACE.test(v.trim()))
      out.push(
        finding(
          "structured-data",
          "placeholder",
          "warning",
          `Placeholder at ${path}: '${v}'.`,
          "Replace placeholder data.",
          { ...page, googleDocs: G },
        ),
      );
    if (/^https?:\/\//i.test(v) && isLocalOrStaging(v, config))
      out.push(
        finding(
          "structured-data",
          "non-production-url",
          "error",
          `Non-production URL at ${path}: ${v}.`,
          "Use production URLs.",
          { ...page, googleDocs: G },
        ),
      );
  } else if (Array.isArray(v))
    v.forEach((x, i) => out.push(...inspect(x, `${path}[${i}]`, page, config)));
  else if (v && typeof v === "object")
    Object.entries(v).forEach(([k, x]) =>
      out.push(...inspect(x, `${path}.${k}`, page, config)),
    );
  return out;
}
export const structuredDataCheck: CheckDefinition = {
  name: "structuredData",
  description:
    "Parses JSON-LD and checks context, type, empty values, placeholders, and host leaks.",
  run({ crawl, config }) {
    const out: Finding[] = [];
    for (const p of crawl.pages) {
      const $ = loadHtml(p.html),
        blocks = $('script[type="application/ld+json"]');
      if (!blocks.length) {
        out.push(
          finding(
            "structured-data",
            "missing",
            "info",
            "No JSON-LD was found.",
            "No action unless an appropriate Search feature applies.",
            { ...pageOptions(p), googleDocs: G },
          ),
        );
        continue;
      }
      const ids = new Map<string, string>();
      blocks.each((i, el) => {
        let parsed: any;
        try {
          parsed = JSON.parse($(el).html()?.trim() ?? "");
        } catch (e) {
          out.push(
            finding(
              "structured-data",
              "invalid-json",
              "error",
              `JSON-LD block ${i + 1} is invalid: ${(e as Error).message}.`,
              "Fix JSON and use Rich Results Test.",
              { ...pageOptions(p), googleDocs: G },
            ),
          );
          return;
        }
        for (const n of nodes(parsed)) {
          if (!n["@context"] && !parsed["@context"])
            out.push(
              finding(
                "structured-data",
                "missing-context",
                "warning",
                `Block ${i + 1} has no @context.`,
                "Declare schema.org context.",
                { ...pageOptions(p), googleDocs: G },
              ),
            );
          if (!n["@type"] && !n["@graph"])
            out.push(
              finding(
                "structured-data",
                "missing-type",
                "warning",
                `Block ${i + 1} has no @type.`,
                "Declare the schema type.",
                { ...pageOptions(p), googleDocs: G },
              ),
            );
          const id = n["@id"],
            type = JSON.stringify(n["@type"]);
          if (typeof id === "string" && ids.has(id) && ids.get(id) !== type)
            out.push(
              finding(
                "structured-data",
                "conflicting-identity",
                "warning",
                `@id '${id}' has conflicting @type values.`,
                "Reconcile the entity nodes.",
                { ...pageOptions(p), googleDocs: G },
              ),
            );
          if (typeof id === "string") ids.set(id, type);
        }
        out.push(...inspect(parsed, `$[${i}]`, pageOptions(p), config));
      });
    }
    return out;
  },
};
