import { resolveProfile } from "../config/resolveProfile.js";
import type { SearchQualityConfig } from "../config/schema.js";
import { obviousTextConflict, comparableText } from "../utils/consistency.js";
import {
  loadHtml,
  metaContent,
  normalizedText,
  textFromSelection,
} from "../utils/html.js";
import { isHttpUrl, normalizeUrl } from "../utils/urls.js";
import { defineCheck, definePlugin } from "../plugins/definePlugin.js";
import type {
  PluginCheckContext,
  PluginFinding,
  PluginPage,
} from "../plugins/types.js";

type JsonObject = Record<string, unknown>;

const DOCS =
  "https://github.com/SilesianSolutions/search-quality-kit/blob/master/docs/policy-packs.md";

const SOCIAL_HOSTS = [
  "linkedin.com",
  "github.com",
  "x.com",
  "twitter.com",
  "bsky.app",
  "mastodon.social",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "medium.com",
  "substack.com",
];

const CONTACT_WORDS =
  /\b(contact|kontakt|email|e-mail|mail|hire|work with me|book|consultation|consulting|call|message)\b/i;

const APP_SHELL =
  /^(loading(?:\.\.\.)?|please enable javascript|enable javascript|coming soon|app loading|loading app)$/i;

const LOCAL_OR_STAGING_TEXT =
  /\b(?:staging site|preview environment|local development|localhost|127\.0\.0\.1|0\.0\.0\.0)\b|https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|[^/\s]*\.(?:local|test)|(?:staging|preview|dev)[.-][^/\s]+)/i;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nodes(value: unknown, includeSelf = true): JsonObject[] {
  if (Array.isArray(value)) return value.flatMap((item) => nodes(item, true));
  if (!isObject(value)) return [];
  const include =
      includeSelf || "@type" in value || "@id" in value || "@graph" in value,
    children = Object.values(value).flatMap((child) => nodes(child, false));
  return [...(include ? [value] : []), ...children];
}

function types(node: JsonObject) {
  const value = node["@type"];
  return (Array.isArray(value) ? value : [value]).filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
}

function scalar(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (isObject(value)) {
    const nested = value["@id"] ?? value.url;
    return typeof nested === "string" ? nested.trim() || undefined : undefined;
  }
  return undefined;
}

function titleAndH1(page: PluginPage) {
  const $ = loadHtml(page.rawHtml);
  return {
    title: page.metadata.title ?? "",
    h1: normalizedText(textFromSelection($("h1").first())),
  };
}

function pagePath(page: PluginPage) {
  return new URL(page.url).pathname.replace(/\/$/, "") || "/";
}

function activeProfile(page: PluginPage, ctx: PluginCheckContext) {
  return resolveProfile(page.url, ctx.config as SearchQualityConfig)
    .activeProfile;
}

function isHome(page: PluginPage) {
  return pagePath(page) === "/";
}

function isAbout(page: PluginPage) {
  return ["/about", "/about-me", "/bio", "/o-mnie", "/o-nas"].includes(
    pagePath(page),
  );
}

function hasContactOrProfileLink(page: PluginPage) {
  return page.links.some((link) => {
    const href = link.href.toLowerCase(),
      text = link.text.toLowerCase();
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return true;
    if (CONTACT_WORDS.test(`${href} ${text}`)) return true;
    if (!link.url) return false;
    try {
      const host = new URL(link.url).hostname.replace(/^www\./, "");
      return SOCIAL_HOSTS.some(
        (socialHost) => host === socialHost || host.endsWith(`.${socialHost}`),
      );
    } catch {
      return false;
    }
  });
}

function pageFinding(
  code: string,
  page: PluginPage,
  message: string,
  remediation: string,
  severity: PluginFinding["severity"] = "warning",
): PluginFinding {
  return {
    code,
    severity,
    url: page.url,
    ...(page.file ? { file: page.file } : {}),
    message,
    remediation,
  };
}

function visiblePlaceholderFindings(
  pages: readonly PluginPage[],
  code: string,
  placeholderPattern: RegExp,
  message: string,
): PluginFinding[] {
  return pages.flatMap((page) =>
    placeholderPattern.test(page.visibleText)
      ? [
          pageFinding(
            code,
            page,
            message,
            "Replace placeholder copy in the delivered HTML with reviewed production content, or remove it from public pages.",
          ),
        ]
      : [],
  );
}

function genericDescription(page: PluginPage, pattern: RegExp) {
  const { title, h1 } = titleAndH1(page),
    description = page.metadata.description ?? "";
  return [title, h1, description].some(
    (value) => pattern.test(comparableText(value)) && value.trim().length < 40,
  );
}

function organizationNames(page: PluginPage) {
  return page.structuredData.flatMap((item) =>
    nodes(item)
      .filter((node) =>
        types(node).some((type) =>
          [
            "Organization",
            "LocalBusiness",
            "ProfessionalService",
            "Corporation",
          ].includes(type),
        ),
      )
      .map((node) => scalar(node.name))
      .filter((value): value is string => Boolean(value)),
  );
}

function directoryEntityNames(page: PluginPage) {
  return page.structuredData.flatMap((item) =>
    nodes(item)
      .filter((node) =>
        types(node).some((type) =>
          ["Organization", "LocalBusiness", "ProfessionalService"].includes(
            type,
          ),
        ),
      )
      .map((node) => scalar(node.name))
      .filter((value): value is string => Boolean(value)),
  );
}

function itemListEmpty(page: PluginPage) {
  return page.structuredData.some((item) =>
    nodes(item).some((node) => {
      if (!types(node).includes("ItemList")) return false;
      const value = node.itemListElement;
      return Array.isArray(value) && value.length === 0;
    }),
  );
}

function pageLevelUrls(page: PluginPage) {
  const urls: Array<{ label: string; value: string }> = [];
  for (const item of page.structuredData)
    for (const node of nodes(item)) {
      if (
        !types(node).some((type) =>
          ["WebPage", "Article", "BlogPosting"].includes(type),
        )
      )
        continue;
      for (const [label, value] of [
        ["JSON-LD url", scalar(node.url)],
        ["JSON-LD @id", scalar(node["@id"])],
        ["JSON-LD mainEntityOfPage", scalar(node.mainEntityOfPage)],
      ] as const)
        if (value && !value.startsWith("#") && isHttpUrl(value))
          urls.push({ label, value });
    }
  return urls;
}

function firstUrlConflict(
  expected: string,
  candidates: Array<{ label: string; value: string }>,
) {
  for (const candidate of candidates)
    try {
      if (normalizeUrl(candidate.value) !== normalizeUrl(expected))
        return candidate;
    } catch {
      // URL syntax is covered by core checks.
    }
  return undefined;
}

export function personalBrandPolicyPack() {
  const placeholders =
    /\b(?:lorem ipsum|todo|tbd|demo person|your name)\b|(?:^|[^@\w.-])example\.com(?:[^\w.-]|$)/i;
  return definePlugin({
    name: "personal-brand",
    checks: [
      defineCheck({
        id: "personal-brand.no-placeholder-copy",
        title: "No personal placeholder copy",
        category: "policy-pack",
        classification: "local-heuristic",
        defaultSeverity: "warning",
        docsUrl: DOCS,
        run: (ctx) =>
          visiblePlaceholderFindings(
            ctx.pages,
            "personal-brand.no-placeholder-copy",
            placeholders,
            "Visible copy contains a personal-site placeholder.",
          ),
      }),
      defineCheck({
        id: "personal-brand.contact-or-profile-link",
        title: "Personal contact or profile link",
        category: "policy-pack",
        classification: "profile-expectation",
        defaultSeverity: "warning",
        docsUrl: DOCS,
        run: (ctx) =>
          ctx.pages.flatMap((page) => {
            if (activeProfile(page, ctx) !== "personal") return [];
            if (!isHome(page) && !isAbout(page)) return [];
            if (hasContactOrProfileLink(page)) return [];
            return [
              pageFinding(
                "personal-brand.contact-or-profile-link",
                page,
                "Personal/about page has no obvious contact or public profile link.",
                "Add a reviewed contact, booking, email, or public profile link where visitors can verify or reach the person.",
              ),
            ];
          }),
      }),
      defineCheck({
        id: "personal-brand.specific-description",
        title: "Specific personal description",
        category: "policy-pack",
        classification: "local-heuristic",
        defaultSeverity: "warning",
        docsUrl: DOCS,
        run: (ctx) =>
          ctx.pages.flatMap((page) =>
            activeProfile(page, ctx) === "personal" &&
            genericDescription(page, /^(personal website|personal site)$/i)
              ? [
                  pageFinding(
                    "personal-brand.specific-description",
                    page,
                    "Personal page uses a generic description without a concrete identity or topic.",
                    "Replace generic personal-site copy with a concise reviewed description of the person, role, or work.",
                  ),
                ]
              : [],
          ),
      }),
    ],
  });
}

export function companySitePolicyPack() {
  const placeholders =
    /\b(?:demo company|acme|your company|todo)\b|(?:^|[^@\w.-])example\.com(?:[^\w.-]|$)/i;
  return definePlugin({
    name: "company-site",
    checks: [
      defineCheck({
        id: "company-site.no-placeholder-copy",
        title: "No company placeholder copy",
        category: "policy-pack",
        classification: "local-heuristic",
        defaultSeverity: "warning",
        docsUrl: DOCS,
        run: (ctx) =>
          visiblePlaceholderFindings(
            ctx.pages,
            "company-site.no-placeholder-copy",
            placeholders,
            "Visible copy contains a company-site placeholder.",
          ),
      }),
      defineCheck({
        id: "company-site.contact-link",
        title: "Company contact link",
        category: "policy-pack",
        classification: "profile-expectation",
        defaultSeverity: "warning",
        docsUrl: DOCS,
        run: (ctx) =>
          ctx.pages.flatMap((page) => {
            const profile = activeProfile(page, ctx);
            if (!(
              (profile === "company" && isHome(page)) ||
              profile === "servicePage"
            ))
              return [];
            if (hasContactOrProfileLink(page)) return [];
            return [
              pageFinding(
                "company-site.contact-link",
                page,
                "Company home/service page has no obvious contact link.",
                "Add a reviewed contact, booking, quote, or consultation link to the primary navigation or page body.",
              ),
            ];
          }),
      }),
      defineCheck({
        id: "company-site.organization-name-conflict",
        title: "Organization name consistency",
        category: "policy-pack",
        classification: "local-heuristic",
        defaultSeverity: "warning",
        docsUrl: DOCS,
        run: (ctx) =>
          ctx.pages.flatMap((page) => {
            const { title, h1 } = titleAndH1(page),
              conflict = organizationNames(page).find(
                (name) =>
                  Boolean(title) &&
                  Boolean(h1) &&
                  obviousTextConflict(name, title) &&
                  obviousTextConflict(name, h1),
              );
            return conflict
              ? [
                  pageFinding(
                    "company-site.organization-name-conflict",
                    page,
                    `Organization JSON-LD name '${conflict}' conflicts with both title and H1.`,
                    "Align the visible company name and Organization JSON-LD name for the page, or remove stale structured data.",
                  ),
                ]
              : [];
          }),
      }),
      defineCheck({
        id: "company-site.no-staging-copy",
        title: "No staging or local copy",
        category: "policy-pack",
        classification: "local-heuristic",
        defaultSeverity: "warning",
        docsUrl: DOCS,
        run: (ctx) =>
          ctx.pages.flatMap((page) =>
            LOCAL_OR_STAGING_TEXT.test(page.visibleText)
              ? [
                  pageFinding(
                    "company-site.no-staging-copy",
                    page,
                    "Visible copy appears to mention a staging/local environment or local URL.",
                    "Replace staging/local copy and URLs with production-safe wording before publishing.",
                  ),
                ]
              : [],
          ),
      }),
    ],
  });
}

export function directoryPolicyPack() {
  const placeholders =
    /\b(?:lorem ipsum|todo|tbd|demo company|acme|your company|company name)\b|(?:^|[^@\w.-])example\.com(?:[^\w.-]|$)/i;
  return definePlugin({
    name: "directory",
    checks: [
      defineCheck({
        id: "directory.no-placeholder-copy",
        title: "No directory placeholder copy",
        category: "policy-pack",
        classification: "local-heuristic",
        defaultSeverity: "warning",
        docsUrl: DOCS,
        run: (ctx) =>
          visiblePlaceholderFindings(
            ctx.pages,
            "directory.no-placeholder-copy",
            placeholders,
            "Visible directory copy contains a placeholder.",
          ),
      }),
      defineCheck({
        id: "directory.entry-has-name",
        title: "Directory entry has a name",
        category: "policy-pack",
        classification: "profile-expectation",
        defaultSeverity: "warning",
        docsUrl: DOCS,
        run: (ctx) =>
          ctx.pages.flatMap((page) => {
            if (activeProfile(page, ctx) !== "directoryEntry") return [];
            const { title, h1 } = titleAndH1(page),
              names = directoryEntityNames(page);
            if (title || h1 || names.length) return [];
            return [
              pageFinding(
                "directory.entry-has-name",
                page,
                "Directory entry page has no obvious company/person name in title, H1, or JSON-LD.",
                "Expose the listed entity name in the page title or H1, and keep JSON-LD aligned when present.",
              ),
            ];
          }),
      }),
      defineCheck({
        id: "directory.entry-name-consistency",
        title: "Directory entry name consistency",
        category: "policy-pack",
        classification: "local-heuristic",
        defaultSeverity: "warning",
        docsUrl: DOCS,
        run: (ctx) =>
          ctx.pages.flatMap((page) => {
            if (activeProfile(page, ctx) !== "directoryEntry") return [];
            const { title, h1 } = titleAndH1(page),
              conflict = directoryEntityNames(page).find(
                (name) =>
                  Boolean(title) &&
                  Boolean(h1) &&
                  obviousTextConflict(name, title) &&
                  obviousTextConflict(name, h1),
              );
            return conflict
              ? [
                  pageFinding(
                    "directory.entry-name-consistency",
                    page,
                    `Directory entry JSON-LD name '${conflict}' conflicts with both title and H1.`,
                    "Align the listed entity name across visible headings, title, and structured data.",
                  ),
                ]
              : [];
          }),
      }),
      defineCheck({
        id: "directory.list-not-empty",
        title: "Directory list is not empty",
        category: "policy-pack",
        classification: "profile-expectation",
        defaultSeverity: "warning",
        docsUrl: DOCS,
        run: (ctx) =>
          ctx.pages.flatMap((page) => {
            if (activeProfile(page, ctx) !== "directoryList") return [];
            if (
              itemListEmpty(page) ||
              /\b(?:no listings|no results|no companies found|brak firm|brak wyników)\b/i.test(
                page.visibleText,
              )
            )
              return [
                pageFinding(
                  "directory.list-not-empty",
                  page,
                  "Directory category/list page appears to contain an empty listing set.",
                  "Publish at least one reviewed listing for this category or mark the route as intentionally empty/excluded.",
                ),
              ];
            return [];
          }),
      }),
      defineCheck({
        id: "directory.specific-entry-title",
        title: "Specific directory entry title",
        category: "policy-pack",
        classification: "local-heuristic",
        defaultSeverity: "warning",
        docsUrl: DOCS,
        run: (ctx) =>
          ctx.pages.flatMap((page) => {
            if (activeProfile(page, ctx) !== "directoryEntry") return [];
            return genericDescription(
              page,
              /^(company profile|business profile|firma|profil firmy)$/i,
            )
              ? [
                  pageFinding(
                    "directory.specific-entry-title",
                    page,
                    "Directory entry uses a generic title or heading instead of the listed entity name.",
                    "Use the reviewed listing name in the title/H1 so the entry is identifiable in reports and search snippets.",
                  ),
                ]
              : [];
          }),
      }),
    ],
  });
}

export function aiVisibilitySafePolicyPack() {
  return definePlugin({
    name: "ai-visibility-safe",
    checks: [
      defineCheck({
        id: "ai-visibility-safe.public-snippet-directives",
        title: "Public pages allow snippets",
        category: "policy-pack",
        classification: "local-heuristic",
        defaultSeverity: "warning",
        docsUrl: DOCS,
        run: (ctx) =>
          ctx.pages.flatMap((page) => {
            const $ = loadHtml(page.rawHtml),
              robots = [
                page.metadata.robots,
                metaContent($, "googlebot"),
                metaContent($, "bingbot"),
              ]
                .filter(Boolean)
                .join(",");
            if (
              /(?:^|[,\s])(?:noindex|none|nosnippet|max-snippet\s*:\s*0)(?:$|[,\s])/i.test(
                robots,
              )
            )
              return [
                pageFinding(
                  "ai-visibility-safe.public-snippet-directives",
                  page,
                  "Public page declares a robots directive that can block indexing or snippets.",
                  "Remove accidental noindex/nosnippet/none/max-snippet:0 directives, or exclude the route intentionally.",
                ),
              ];
            return [];
          }),
      }),
      defineCheck({
        id: "ai-visibility-safe.meaningful-visible-text",
        title: "Meaningful visible text",
        category: "policy-pack",
        classification: "local-heuristic",
        defaultSeverity: "warning",
        docsUrl: DOCS,
        run: (ctx) =>
          ctx.pages.flatMap((page) => {
            const text = normalizedText(page.visibleText);
            return text.length < 80 || APP_SHELL.test(text)
              ? [
                  pageFinding(
                    "ai-visibility-safe.meaningful-visible-text",
                    page,
                    `Delivered HTML has only ${text.length} visible text characters or looks like an app shell.`,
                    "Pre-render meaningful page content in the delivered HTML rather than relying only on client-side rendering.",
                  ),
                ]
              : [];
          }),
      }),
      defineCheck({
        id: "ai-visibility-safe.url-consistency",
        title: "Canonical, Open Graph, and JSON-LD URL consistency",
        category: "policy-pack",
        classification: "local-heuristic",
        defaultSeverity: "warning",
        docsUrl: DOCS,
        run: (ctx) =>
          ctx.pages.flatMap((page) => {
            const expected = page.metadata.canonical ?? page.finalUrl,
              candidates = [
                page.metadata.openGraph["og:url"]
                  ? {
                      label: "Open Graph url",
                      value: page.metadata.openGraph["og:url"],
                    }
                  : undefined,
                ...pageLevelUrls(page),
              ].filter((item): item is { label: string; value: string } => {
                if (!item) return false;
                return isHttpUrl(item.value);
              }),
              conflict = expected
                ? firstUrlConflict(expected, candidates)
                : undefined;
            return conflict
              ? [
                  pageFinding(
                    "ai-visibility-safe.url-consistency",
                    page,
                    `${conflict.label} '${conflict.value}' differs from canonical/final URL '${expected}'.`,
                    "Keep canonical, og:url, and page-level JSON-LD URL values aligned with the public page URL.",
                  ),
                ]
              : [];
          }),
      }),
      defineCheck({
        id: "ai-visibility-safe.no-placeholder-shell",
        title: "No placeholder or app-shell-only HTML",
        category: "policy-pack",
        classification: "local-heuristic",
        defaultSeverity: "warning",
        docsUrl: DOCS,
        run: (ctx) =>
          ctx.pages.flatMap((page) => {
            const text = normalizedText(page.visibleText);
            if (
              APP_SHELL.test(text) ||
              /\b(?:lorem ipsum|todo|tbd|example\.com|demo company|your company|your name)\b/i.test(
                text,
              )
            )
              return [
                pageFinding(
                  "ai-visibility-safe.no-placeholder-shell",
                  page,
                  "Delivered HTML looks like placeholder copy or an app shell.",
                  "Ship reviewed, crawlable production content in the initial HTML.",
                ),
              ];
            return [];
          }),
      }),
    ],
  });
}

export const policyPacks = {
  personalBrand: personalBrandPolicyPack,
  companySite: companySitePolicyPack,
  directory: directoryPolicyPack,
  aiVisibilitySafe: aiVisibilitySafePolicyPack,
};
