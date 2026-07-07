import { isHttpUrl, isLocalOrStaging } from "../utils/urls.js";
import type { CheckDefinition } from "./types.js";
import { finding } from "./types.js";
const G =
    "https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec",
  SUPPORTED = new Set(["user-agent", "allow", "disallow", "sitemap"]);
export const robotsCheck: CheckDefinition = {
  name: "robots",
  description:
    "Validates robots syntax, site-wide blocking, and sitemap declarations.",
  run({ crawl, config }) {
    const o = { url: crawl.robots.url, file: crawl.robots.file, googleDocs: G };
    if (crawl.robots.status !== 200 || crawl.robots.content === undefined)
      return [
        finding(
          "robots",
          "missing",
          "warning",
          "robots.txt was not found.",
          "Add robots.txt at the site root.",
          o,
        ),
      ];
    const out = [],
      sitemaps: string[] = [],
      blocked = new Set<string>();
    let agents: string[] = [];
    for (const [i, raw] of crawl.robots.content.split(/\r?\n/).entries()) {
      const line = raw.replace(/#.*$/, "").trim();
      if (!line) continue;
      const m = line.match(/^([^:]+):(.*)$/);
      if (!m) {
        out.push(
          finding(
            "robots",
            "invalid-line",
            "warning",
            `Line ${i + 1} has no valid separator.`,
            "Use field: value syntax.",
            o,
          ),
        );
        continue;
      }
      const field = m[1]!.trim().toLowerCase(),
        value = m[2]!.trim();
      if (!SUPPORTED.has(field))
        out.push(
          finding(
            "robots",
            "unsupported-field",
            "info",
            `Google does not support field '${field}' on line ${i + 1}.`,
            "Use supported REP fields.",
            o,
          ),
        );
      if (field === "user-agent") agents = [value.toLowerCase()];
      if (
        (field === "allow" || field === "disallow") &&
        value &&
        !value.startsWith("/")
      )
        out.push(
          finding(
            "robots",
            "invalid-path",
            "warning",
            `${field} path must start with '/': ${value}.`,
            "Use a root-relative path.",
            o,
          ),
        );
      if (field === "disallow" && value === "/")
        agents.forEach((a) => blocked.add(a));
      if (field === "sitemap") sitemaps.push(value);
    }
    if (
      !config.rules.robots.disallowAllInProduction &&
      (blocked.has("*") || blocked.has("googlebot"))
    )
      out.push(
        finding(
          "robots",
          "disallow-all",
          "error",
          "robots.txt blocks the entire site.",
          "Remove Disallow: / for production.",
          o,
        ),
      );
    for (const v of sitemaps) {
      if (!isHttpUrl(v))
        out.push(
          finding(
            "robots",
            "relative-sitemap",
            "error",
            `Sitemap is not absolute: ${v}.`,
            "Use a fully qualified URL.",
            o,
          ),
        );
      else if (isLocalOrStaging(v, config))
        out.push(
          finding(
            "robots",
            "non-production-sitemap",
            "error",
            `Sitemap points to a non-production host: ${v}.`,
            "Use the production sitemap.",
            o,
          ),
        );
    }
    if (crawl.sitemap.status === 200 && !sitemaps.length)
      out.push(
        finding(
          "robots",
          "sitemap-not-declared",
          "warning",
          "robots.txt does not declare the available sitemap.",
          "Add a Sitemap: directive.",
          o,
        ),
      );
    return out;
  },
};
