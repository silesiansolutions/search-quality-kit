import { z } from "zod";
import {
  matchesRoutePattern,
  validRoutePattern,
} from "../config/profileDefinitions.js";
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

const DEFAULT_CONTACT_LINK_TEXT = [
  "Contact",
  "Kontakt",
  "Email",
  "E-mail",
  "Mail",
  "Hire",
  "Work with me",
  "Book",
  "Consultation",
  "Consulting",
  "Call",
  "Message",
  "Skontaktuj się",
  "Umów konsultację",
  "Napisz",
];

const DEFAULT_CONTACT_HREF_PATTERNS = [
  "mailto:",
  "tel:",
  "/contact",
  "/kontakt",
  "/email",
  "/e-mail",
  "/mail",
  "/hire",
  "/work-with-me",
  "/book",
  "/booking",
  "/consultation",
  "/consulting",
  "/call",
  "/message",
];

const PERSONAL_PLACEHOLDERS = [
  "Lorem ipsum",
  "TODO",
  "TBD",
  "Demo Person",
  "Your Name",
  "example.com",
];

const COMPANY_PLACEHOLDERS = [
  "Demo Company",
  "Acme",
  "Your Company",
  "TODO",
  "example.com",
];

const DIRECTORY_PLACEHOLDERS = [
  "Lorem ipsum",
  "TODO",
  "TBD",
  "Demo Company",
  "Acme",
  "Your Company",
  "Company Name",
  "example.com",
];

const AI_VISIBILITY_PLACEHOLDERS = [
  "Lorem ipsum",
  "TODO",
  "TBD",
  "example.com",
  "Demo Company",
  "Your Company",
  "Your Name",
];

export interface PersonalBrandPolicyPackOptions {
  readonly placeholders?: readonly string[];
  readonly contactLinkText?: readonly string[];
  readonly contactHrefPatterns?: readonly string[];
  readonly routePatterns?: readonly string[];
}

export type CompanySitePolicyPackOptions = PersonalBrandPolicyPackOptions;

export interface DirectoryPolicyPackOptions {
  readonly placeholders?: readonly string[];
  readonly routePatterns?: readonly string[];
}

export interface AiVisibilitySafePolicyPackOptions {
  readonly placeholders?: readonly string[];
  readonly routePatterns?: readonly string[];
  readonly minVisibleTextLength?: number;
  readonly allowNoindexOn?: readonly string[];
  readonly allowNosnippetOn?: readonly string[];
}

const stringList = z.array(z.string().trim().min(1)).max(100);
const routePatterns = stringList.refine(
  (patterns) => patterns.every(validRoutePattern),
  "Expected root-relative globs using only * or **, for example /services/**.",
);
const commonPolicyPackSchema = z
  .object({
    placeholders: stringList.optional(),
    routePatterns: routePatterns.optional(),
  })
  .strict();
const contactPolicyPackSchema = commonPolicyPackSchema.extend({
  contactLinkText: stringList.optional(),
  contactHrefPatterns: stringList.optional(),
});
const aiVisibilitySafePolicyPackSchema = commonPolicyPackSchema.extend({
  minVisibleTextLength: z.number().int().nonnegative().max(100_000).optional(),
  allowNoindexOn: routePatterns.optional(),
  allowNosnippetOn: routePatterns.optional(),
});

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

function appliesToRoute(page: PluginPage, patterns?: readonly string[]) {
  if (!patterns) return true;
  const pathname = new URL(page.url).pathname;
  return patterns.some((pattern) => matchesRoutePattern(pathname, pattern));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsConfiguredText(value: string, candidates: readonly string[]) {
  if (!candidates.length) return false;
  const text = normalizedText(value);
  return candidates.some((candidate) => {
    const normalized = normalizedText(candidate);
    if (!normalized) return false;
    const boundary = normalized.includes(".")
      ? "@\\p{L}\\p{N}._-"
      : "\\p{L}\\p{N}";
    return new RegExp(
      `(?:^|[^${boundary}])${escapeRegExp(normalized)}(?=$|[^${boundary}])`,
      "iu",
    ).test(text);
  });
}

function optionsSummary(options: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(options).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value] : value,
    ]),
  );
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

function hasContactOrProfileLink(
  page: PluginPage,
  contactLinkText: readonly string[],
  contactHrefPatterns: readonly string[],
) {
  return page.links.some((link) => {
    const href = link.href.toLowerCase(),
      text = link.text.toLowerCase();
    if (
      contactHrefPatterns.some((pattern) =>
        href.includes(pattern.toLowerCase()),
      ) ||
      contactLinkText.some((label) => text.includes(label.toLowerCase()))
    )
      return true;
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
  placeholders: readonly string[],
  message: string,
  routePatterns?: readonly string[],
): PluginFinding[] {
  return pages.flatMap((page) =>
    appliesToRoute(page, routePatterns) &&
    containsConfiguredText(page.visibleText, placeholders)
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

export function personalBrandPolicyPack(
  input: PersonalBrandPolicyPackOptions = {},
) {
  const options = contactPolicyPackSchema.parse(input);
  const placeholders = options.placeholders ?? PERSONAL_PLACEHOLDERS;
  const contactLinkText = options.contactLinkText ?? DEFAULT_CONTACT_LINK_TEXT;
  const contactHrefPatterns =
    options.contactHrefPatterns ?? DEFAULT_CONTACT_HREF_PATTERNS;
  return definePlugin({
    name: "personal-brand",
    policyPack: {
      name: "personalBrand",
      optionsSummary: optionsSummary(options),
    },
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
            options.routePatterns,
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
            if (!appliesToRoute(page, options.routePatterns)) return [];
            if (activeProfile(page, ctx) !== "personal") return [];
            if (!isHome(page) && !isAbout(page)) return [];
            if (
              hasContactOrProfileLink(
                page,
                contactLinkText,
                contactHrefPatterns,
              )
            )
              return [];
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
            appliesToRoute(page, options.routePatterns) &&
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

export function companySitePolicyPack(
  input: CompanySitePolicyPackOptions = {},
) {
  const options = contactPolicyPackSchema.parse(input);
  const placeholders = options.placeholders ?? COMPANY_PLACEHOLDERS;
  const contactLinkText = options.contactLinkText ?? DEFAULT_CONTACT_LINK_TEXT;
  const contactHrefPatterns =
    options.contactHrefPatterns ?? DEFAULT_CONTACT_HREF_PATTERNS;
  return definePlugin({
    name: "company-site",
    policyPack: {
      name: "companySite",
      optionsSummary: optionsSummary(options),
    },
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
            options.routePatterns,
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
            if (!appliesToRoute(page, options.routePatterns)) return [];
            const profile = activeProfile(page, ctx);
            if (!(
              (profile === "company" && isHome(page)) ||
              profile === "servicePage"
            ))
              return [];
            if (
              hasContactOrProfileLink(
                page,
                contactLinkText,
                contactHrefPatterns,
              )
            )
              return [];
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
            if (!appliesToRoute(page, options.routePatterns)) return [];
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
            appliesToRoute(page, options.routePatterns) &&
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

export function directoryPolicyPack(input: DirectoryPolicyPackOptions = {}) {
  const options = commonPolicyPackSchema.parse(input);
  const placeholders = options.placeholders ?? DIRECTORY_PLACEHOLDERS;
  return definePlugin({
    name: "directory",
    policyPack: {
      name: "directory",
      optionsSummary: optionsSummary(options),
    },
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
            options.routePatterns,
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
            if (!appliesToRoute(page, options.routePatterns)) return [];
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
            if (!appliesToRoute(page, options.routePatterns)) return [];
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
            if (!appliesToRoute(page, options.routePatterns)) return [];
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
            if (!appliesToRoute(page, options.routePatterns)) return [];
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

export function aiVisibilitySafePolicyPack(
  input: AiVisibilitySafePolicyPackOptions = {},
) {
  const options = aiVisibilitySafePolicyPackSchema.parse(input);
  const placeholders = options.placeholders ?? AI_VISIBILITY_PLACEHOLDERS;
  const minVisibleTextLength = options.minVisibleTextLength ?? 80;
  return definePlugin({
    name: "ai-visibility-safe",
    policyPack: {
      name: "aiVisibilitySafe",
      optionsSummary: optionsSummary(options),
    },
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
            if (!appliesToRoute(page, options.routePatterns)) return [];
            const $ = loadHtml(page.rawHtml),
              robots = [
                page.metadata.robots,
                metaContent($, "googlebot"),
                metaContent($, "bingbot"),
              ]
                .filter(Boolean)
                .join(",");
            const blocksIndex = /(?:^|[,\s])(?:noindex|none)(?:$|[,\s])/i.test(
                robots,
              ),
              blocksSnippet =
                /(?:^|[,\s])(?:nosnippet|none|max-snippet\s*:\s*0)(?:$|[,\s])/i.test(
                  robots,
                ),
              allowsIndex =
                !blocksIndex ||
                appliesToRoute(page, options.allowNoindexOn ?? []),
              allowsSnippet =
                !blocksSnippet ||
                appliesToRoute(page, options.allowNosnippetOn ?? []);
            if (!allowsIndex || !allowsSnippet)
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
            if (!appliesToRoute(page, options.routePatterns)) return [];
            const text = normalizedText(page.visibleText);
            return text.length < minVisibleTextLength || APP_SHELL.test(text)
              ? [
                  pageFinding(
                    "ai-visibility-safe.meaningful-visible-text",
                    page,
                    `Delivered HTML has only ${text.length} visible text characters; configured minimum is ${minVisibleTextLength}, or the page looks like an app shell.`,
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
            if (!appliesToRoute(page, options.routePatterns)) return [];
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
            if (!appliesToRoute(page, options.routePatterns)) return [];
            const text = normalizedText(page.visibleText);
            if (
              APP_SHELL.test(text) ||
              containsConfiguredText(text, placeholders)
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
