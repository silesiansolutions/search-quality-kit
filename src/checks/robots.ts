import { aiCrawlerCategories } from "../data/aiCrawlerCategories.js";
import type { AiCrawlerCategory } from "../data/aiCrawlerCategories.js";
import { aiRoster } from "../data/aiRobotsRoster.js";
import { loadHtml, metaContent } from "../utils/html.js";
import { isHttpUrl, isLocalOrStaging, sameOrigin } from "../utils/urls.js";
import type { CheckContext, CheckDefinition } from "./types.js";
import { finding } from "./types.js";
const G =
    "https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec",
  SUPPORTED = new Set(["user-agent", "allow", "disallow", "sitemap"]);

interface Rule {
  allow: boolean;
  path: string;
}

function parseGroups(content: string) {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let collectingAgents = false;
  for (const raw of content.split(/\r?\n/)) {
    const m = raw
      .replace(/#.*$/, "")
      .trim()
      .match(/^([^:]+):(.*)$/);
    if (!m) continue;
    const field = m[1]!.trim().toLowerCase(),
      value = m[2]!.trim();
    if (field === "user-agent") {
      if (!collectingAgents || !groups.length)
        groups.push({ agents: [], rules: [] });
      groups.at(-1)!.agents.push(value.toLowerCase());
      collectingAgents = true;
    } else if (field === "allow" || field === "disallow") {
      collectingAgents = false;
      if (groups.length && value)
        groups.at(-1)!.rules.push({ allow: field === "allow", path: value });
    }
  }
  return groups;
}

type Groups = ReturnType<typeof parseGroups>;

function rulesForAgent(groups: Groups, token: string) {
  const agent = token.toLowerCase();
  const own = groups.filter((g) => g.agents.includes(agent));
  return {
    named: own.length > 0,
    rules: (own.length
      ? own
      : groups.filter((g) => g.agents.includes("*"))
    ).flatMap((g) => g.rules),
  };
}

function ruleMatches(pattern: string, path: string) {
  const anchored = pattern.endsWith("$"),
    body = anchored ? pattern.slice(0, -1) : pattern,
    parts = body.split("*");
  let index = 0;
  for (const [i, part] of parts.entries()) {
    if (i === 0) {
      if (!path.startsWith(part)) return false;
      index = part.length;
      continue;
    }
    const found =
      i === parts.length - 1 && anchored
        ? path.length - part.length >= index && path.endsWith(part)
          ? path.length - part.length
          : -1
        : path.indexOf(part, index);
    if (found < 0) return false;
    index = found + part.length;
  }
  return !anchored || index === path.length;
}

export function robotsAllows(rules: Rule[], path: string) {
  let best: Rule | undefined;
  for (const rule of rules)
    if (
      ruleMatches(rule.path, path) &&
      (!best ||
        rule.path.length > best.path.length ||
        (rule.path.length === best.path.length && rule.allow))
    )
      best = rule;
  return best?.allow ?? true;
}

function pageNoindex(page: CheckContext["crawl"]["pages"][number]) {
  const $ = loadHtml(page.html);
  const directives =
    `${metaContent($, "robots") ?? ""},${metaContent($, "googlebot") ?? ""},${page.headers["x-robots-tag"] ?? ""}`.toLowerCase();
  return /(?:^|[,\s])(?:noindex|none)(?:$|[,\s])/.test(directives);
}

function pathOf(url: string) {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return undefined;
  }
}

function indexablePages(crawl: CheckContext["crawl"]) {
  return crawl.pages.filter(
    (page) =>
      page.status === 200 &&
      sameOrigin(page.url, crawl.publicBaseUrl) &&
      pathOf(page.url) !== undefined &&
      !pageNoindex(page),
  );
}

function blockedUrlFindings(
  crawl: CheckContext["crawl"],
  groups: Groups,
  indexable: CheckContext["crawl"]["pages"],
) {
  const { rules } = rulesForAgent(groups, "googlebot");
  if (!rules.length || !robotsAllows(rules, "/")) return [];
  const blocked = (url: string) => {
    if (!sameOrigin(url, crawl.publicBaseUrl)) return false;
    const p = pathOf(url);
    return p !== undefined && !robotsAllows(rules, p);
  };
  const out = [];
  for (const page of indexable)
    if (blocked(page.url))
      out.push(
        finding(
          "robots",
          "indexable-url-blocked",
          "warning",
          `robots.txt blocks Googlebot from crawled page ${page.url}.`,
          "Allow the path in robots.txt, or noindex the page instead of blocking it.",
          {
            url: page.url,
            ...(page.file ? { file: page.file } : {}),
            googleDocs: G,
          },
        ),
      );
  for (const url of crawl.sitemapUrls)
    if (blocked(url))
      out.push(
        finding(
          "robots",
          "sitemap-url-blocked",
          "warning",
          `Sitemap lists ${url}, which robots.txt blocks for Googlebot.`,
          "Remove the URL from the sitemap, or allow it in robots.txt.",
          { url, googleDocs: G },
        ),
      );
  return out;
}

const RELATED_LIMIT = 10;
const categoryLabel: Record<AiCrawlerCategory | "other", string> = {
  "answer-engine": "answer engine",
  training: "training crawler",
  "user-fetcher": "user-triggered fetcher",
  other: "AI agent",
};
const rosterByToken = new Map(
  Object.keys(aiRoster).map((token) => [token.toLowerCase(), token]),
);

function aiAgentsToEvaluate(groups: Groups) {
  const tokens = new Map(
    Object.keys(aiCrawlerCategories).map((token) => [
      token.toLowerCase(),
      token,
    ]),
  );
  for (const group of groups)
    for (const agent of group.agents) {
      const token = rosterByToken.get(agent);
      if (token && !tokens.has(agent)) tokens.set(agent, token);
    }
  return [...tokens.values()];
}

function aiAccessFindings(
  crawl: CheckContext["crawl"],
  config: CheckContext["config"],
  groups: Groups,
  indexable: CheckContext["crawl"]["pages"],
  o: { url: string; file?: string; googleDocs: string },
) {
  const byPolicy = new Set(
    config.rules.robots.aiCrawlers.blockedByPolicy.map((token) =>
      token.toLowerCase(),
    ),
  );
  const wildcardBlocksSite = !robotsAllows(
    rulesForAgent(groups, "*").rules,
    "/",
  );
  const rootUrl = new URL("/", crawl.publicBaseUrl).toString();
  const out = [];
  for (const token of aiAgentsToEvaluate(groups)) {
    if (byPolicy.has(token.toLowerCase())) continue;
    const { named, rules } = rulesForAgent(groups, token);
    if (!rules.length || (!named && wildcardBlocksSite)) continue;
    const rootBlocked = !robotsAllows(rules, "/");
    const blockedPages = indexable
      .filter((page) => !robotsAllows(rules, pathOf(page.url)!))
      .map((page) => page.url)
      .sort();
    if (!rootBlocked && !blockedPages.length) continue;
    const whole = rootBlocked && blockedPages.length === indexable.length;
    const category = aiCrawlerCategories[token]?.category ?? "other";
    const roster = aiRoster[token];
    const operator =
      roster && !/^unclear/i.test(roster.operator) ? roster.operator : "";
    const subject = `${token} (${categoryLabel[category]}${operator ? `, ${operator}` : ""})`;
    const ignores =
      roster?.respect === "no"
        ? " The ai.robots.txt roster marks this agent as not honoring robots.txt, so the block is a request it may ignore."
        : "";
    const consequence =
      category === "answer-engine"
        ? " Blocked pages cannot be fetched for, or cited in, that answer engine."
        : "";
    out.push(
      finding(
        "robots",
        category === "answer-engine"
          ? "ai-search-blocked"
          : "ai-crawler-blocked",
        category === "answer-engine" ? "warning" : "info",
        `robots.txt blocks ${subject} from ${whole ? "every crawled indexable page" : "some crawled indexable pages"}.${consequence}${ignores}`,
        `If this block is intended, list ${token} in rules.robots.aiCrawlers.blockedByPolicy. Otherwise allow it in robots.txt.`,
        {
          url: o.url,
          ...(o.file ? { file: o.file } : {}),
          classification: ["local-heuristic"],
          relatedUrls: (blockedPages.length ? blockedPages : [rootUrl]).slice(
            0,
            RELATED_LIMIT,
          ),
        },
      ),
    );
  }
  return out;
}

function samplePath(pattern: string) {
  return pattern.replace(/\$$/, "").replace(/\*/g, "x");
}

function namedGroupFindings(
  groups: Groups,
  o: { url: string; file?: string; googleDocs: string },
) {
  const wildcard = rulesForAgent(groups, "*");
  if (!wildcard.named) return [];
  if (!robotsAllows(wildcard.rules, "/")) return [];
  const disallows = wildcard.rules.filter((rule) => !rule.allow);
  if (!disallows.length) return [];
  const out = [],
    seen = new Set<string>();
  for (const group of groups) {
    const agents = group.agents.filter((agent) => agent !== "*");
    if (!agents.length || agents.length !== group.agents.length) continue;
    const key = agents.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    const { rules } = rulesForAgent(groups, agents[0]!);
    const exempt = disallows
      .filter(
        (rule) =>
          !rules.some((own) => !own.allow && own.path === rule.path) &&
          robotsAllows(rules, samplePath(rule.path)),
      )
      .map((rule) => rule.path);
    if (!exempt.length) continue;
    out.push(
      finding(
        "robots",
        "named-group-ignores-wildcard",
        "info",
        `The robots.txt group for ${agents.join(", ")} does not inherit Disallow rules from the * group, so it may fetch ${exempt.slice(0, 3).join(", ")}${exempt.length > 3 ? " and more" : ""}.`,
        "A named group replaces the * group for that agent. Repeat the * Disallow rules in the named group, or remove the named group if it only restates *.",
        o,
      ),
    );
  }
  return out;
}

export const robotsCheck: CheckDefinition = {
  name: "robots",
  description:
    "Validates robots syntax, site-wide blocking, and sitemap declarations.",
  run({ crawl, config }) {
    const o = { url: crawl.robots.url, file: crawl.robots.file, googleDocs: G };
    if (
      crawl.robots.status >= 500 ||
      crawl.robots.status === 429 ||
      crawl.robots.failure
    )
      return [
        finding(
          "robots",
          "unavailable",
          "warning",
          crawl.robots.status
            ? `robots.txt returned HTTP ${crawl.robots.status}.`
            : `robots.txt did not respond (${crawl.robots.failure}).`,
          "Serve robots.txt with HTTP 200 or 404. Google treats server errors on robots.txt as a reason to stop crawling the site.",
          o,
        ),
      ];
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
    const groups = parseGroups(crawl.robots.content),
      indexable = indexablePages(crawl);
    out.push(
      ...blockedUrlFindings(crawl, groups, indexable),
      ...aiAccessFindings(crawl, config, groups, indexable, o),
      ...namedGroupFindings(groups, o),
    );
    return out;
  },
};
