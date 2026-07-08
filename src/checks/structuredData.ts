import type { CheerioAPI } from "cheerio";
import {
  type SiteProfileId,
  type StructuredDataType,
} from "../config/profileDefinitions.js";
import {
  resolveProfile,
  type ResolvedProfile,
} from "../config/resolveProfile.js";
import type { SearchQualityConfig } from "../config/schema.js";
import type { PageArtifact } from "../crawler/types.js";
import type { Finding } from "../report/types.js";
import {
  obviousDescriptionConflict,
  obviousTextConflict,
} from "../utils/consistency.js";
import { loadHtml, metaContent, normalizedText } from "../utils/html.js";
import { isHttpUrl, isLocalOrStaging, normalizeUrl } from "../utils/urls.js";
import type { CheckDefinition } from "./types.js";
import { finding, pageOptions } from "./types.js";

const GOOGLE_INTRO =
    "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data",
  GOOGLE_GENERAL =
    "https://developers.google.com/search/docs/appearance/structured-data/sd-policies",
  GOOGLE_ARTICLE =
    "https://developers.google.com/search/docs/appearance/structured-data/article",
  GOOGLE_LOCAL_BUSINESS =
    "https://developers.google.com/search/docs/appearance/structured-data/local-business",
  PLACEHOLDER =
    /(?:\b(?:todo|tbd|lorem ipsum|your (?:name|company|url)|replace me)\b|(?:^|\/)example\.com(?:\/|$))/i,
  URL_KEYS = new Set([
    "@id",
    "url",
    "sameAs",
    "image",
    "logo",
    "mainEntityOfPage",
    "item",
  ]),
  LOCAL_BUSINESS_TYPES = new Set([
    "LocalBusiness",
    "AnimalShelter",
    "AutomotiveBusiness",
    "ChildCare",
    "Dentist",
    "DryCleaningOrLaundry",
    "EmergencyService",
    "EmploymentAgency",
    "EntertainmentBusiness",
    "FinancialService",
    "FoodEstablishment",
    "GovernmentOffice",
    "HealthAndBeautyBusiness",
    "HomeAndConstructionBusiness",
    "InternetCafe",
    "LegalService",
    "Library",
    "LodgingBusiness",
    "MedicalBusiness",
    "ProfessionalService",
    "RadioStation",
    "RealEstateAgent",
    "RecyclingCenter",
    "SelfStorage",
    "ShoppingCenter",
    "SportsActivityLocation",
    "Store",
    "TelevisionStation",
    "TouristInformationCenter",
    "TravelAgency",
  ]);

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function nodes(value: unknown, includeSelf = true): JsonObject[] {
  if (Array.isArray(value)) return value.flatMap((item) => nodes(item, true));
  if (!isObject(value)) return [];
  const entityLike =
      includeSelf || "@type" in value || "@id" in value || "@graph" in value,
    children = Object.values(value).flatMap((child) => nodes(child, false));
  return [...(entityLike ? [value] : []), ...children];
}

function types(node: JsonObject) {
  const value = node["@type"];
  return (Array.isArray(value) ? value : [value]).filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
}

function hasType(actual: string[], expected: StructuredDataType) {
  if (actual.includes(expected)) return true;
  if (expected === "Article") return actual.includes("BlogPosting");
  if (expected === "Organization")
    return actual.some((type) => LOCAL_BUSINESS_TYPES.has(type));
  if (expected === "LocalBusiness")
    return actual.some((type) => LOCAL_BUSINESS_TYPES.has(type));
  return false;
}

function profileFinding(
  page: PageArtifact,
  profile: ResolvedProfile,
  code: string,
  message: string,
  suggestion: string,
  expected: StructuredDataType[],
) {
  return finding("structured-data", code, "warning", message, suggestion, {
    ...pageOptions(page),
    classification: ["profile-expectation"],
    impact: "profile-expectation",
    activeProfile: profile.activeProfile,
    expectedStructuredData: expected,
    googleDocs: GOOGLE_INTRO,
  });
}

function inspectValues(
  value: unknown,
  path: string,
  key: string | undefined,
  page: PageArtifact,
  config: SearchQualityConfig,
): Finding[] {
  const out: Finding[] = [],
    options = { ...pageOptions(page), googleDocs: GOOGLE_GENERAL };
  if (
    value === "" ||
    value === null ||
    (Array.isArray(value) && value.length === 0) ||
    (isObject(value) && Object.keys(value).length === 0)
  )
    out.push(
      finding(
        "structured-data",
        "empty-value",
        "warning",
        `Empty JSON-LD value at ${path}.`,
        "Remove it or provide accurate data.",
        options,
      ),
    );
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (PLACEHOLDER.test(trimmed))
      out.push(
        finding(
          "structured-data",
          "placeholder",
          "warning",
          `Placeholder at ${path}: '${value}'.`,
          "Replace placeholder data with an accurate value or remove the property.",
          options,
        ),
      );
    if (key && URL_KEYS.has(key) && trimmed && !trimmed.startsWith("#")) {
      if (!isHttpUrl(trimmed))
        out.push(
          finding(
            "structured-data",
            "invalid-url",
            "warning",
            `JSON-LD URL at ${path} is not an absolute HTTP(S) URL: ${value}.`,
            "Use an absolute production URL.",
            options,
          ),
        );
      else if (isLocalOrStaging(trimmed, config))
        out.push(
          finding(
            "structured-data",
            "non-production-url",
            "error",
            `Non-production URL at ${path}: ${value}.`,
            "Use a production URL.",
            options,
          ),
        );
    }
  } else if (Array.isArray(value))
    value.forEach((item, index) =>
      out.push(...inspectValues(item, `${path}[${index}]`, key, page, config)),
    );
  else if (isObject(value))
    Object.entries(value).forEach(([childKey, child]) =>
      out.push(
        ...inspectValues(child, `${path}.${childKey}`, childKey, page, config),
      ),
    );
  return out;
}

function scalar(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (isObject(value)) {
    const nested = value["@id"] ?? value.url;
    return typeof nested === "string" ? nested.trim() || undefined : undefined;
  }
  return undefined;
}

function entityMatchesPage(
  node: JsonObject,
  profile: SiteProfileId,
  pageUrl: string,
  title: string,
  h1: string,
  isRoot = false,
) {
  const entityTypes = types(node),
    label = scalar(node.headline) ?? scalar(node.name),
    canonicalIdentity = [scalar(node.url), scalar(node["@id"])].some((raw) => {
      if (!raw || raw.startsWith("#") || !isHttpUrl(raw)) return false;
      try {
        return normalizeUrl(raw) === normalizeUrl(pageUrl);
      } catch {
        return false;
      }
    }),
    visibleIdentity =
      Boolean(label) &&
      (!title || !obviousTextConflict(label, title)) &&
      (!h1 || !obviousTextConflict(label, h1)),
    substantivePageEntity =
      Boolean(label) &&
      Boolean(scalar(node.description)) &&
      (Boolean(scalar(node.url)) || Boolean(scalar(node.mainEntityOfPage)));
  if (
    entityTypes.some((type) =>
      ["WebPage", "Article", "BlogPosting"].includes(type),
    )
  )
    return (
      canonicalIdentity || visibleIdentity || (isRoot && substantivePageEntity)
    );
  if (entityTypes.includes("Service"))
    return profile === "servicePage" && (canonicalIdentity || visibleIdentity);
  if (profile === "directoryEntry")
    return (
      entityTypes.some((type) =>
        ["Organization", ...LOCAL_BUSINESS_TYPES].includes(type),
      ) &&
      (canonicalIdentity || visibleIdentity)
    );
  if (profile === "personal" && entityTypes.includes("Person"))
    return canonicalIdentity || visibleIdentity;
  if (
    profile === "company" &&
    entityTypes.includes("Organization") &&
    new URL(pageUrl).pathname === "/"
  )
    return canonicalIdentity || visibleIdentity;
  if (
    profile === "localBusiness" &&
    entityTypes.some((type) => LOCAL_BUSINESS_TYPES.has(type)) &&
    (new URL(pageUrl).pathname === "/" || canonicalIdentity)
  )
    return true;
  return false;
}

function compareEntity(
  node: JsonObject,
  page: PageArtifact,
  $: CheerioAPI,
  profile: ResolvedProfile,
  isRoot: boolean,
): Finding[] {
  const out: Finding[] = [],
    entityTypes = types(node),
    canonical = $('link[rel~="canonical"]').first().attr("href")?.trim(),
    title = normalizedText($("title").first().text()),
    h1 = normalizedText($("h1").first().text()),
    description = metaContent($, "description"),
    options = { ...pageOptions(page), googleDocs: GOOGLE_GENERAL },
    label = scalar(node.headline) ?? scalar(node.name),
    entityDescription = scalar(node.description);

  const matchesPage = entityMatchesPage(
    node,
    profile.activeProfile,
    canonical ?? page.url,
    title,
    h1,
    isRoot,
  );
  if (matchesPage && label && (title || h1)) {
    const titleConflict = title && obviousTextConflict(label, title),
      h1Conflict = h1 && obviousTextConflict(label, h1);
    if (titleConflict && h1Conflict)
      out.push(
        finding(
          "structured-data",
          "name-content-mismatch",
          "warning",
          `JSON-LD name/headline '${label}' conflicts with both title and H1.`,
          "Align the entity name or headline with the visible page topic.",
          options,
        ),
      );
  }
  if (
    entityDescription &&
    description &&
    entityDescription.length >= 30 &&
    description.length >= 30 &&
    matchesPage &&
    obviousDescriptionConflict(entityDescription, description)
  )
    out.push(
      finding(
        "structured-data",
        "description-mismatch",
        "warning",
        "JSON-LD description conflicts with the meta description.",
        "Keep descriptions semantically aligned; exact wording is not required.",
        options,
      ),
    );

  if (canonical && matchesPage) {
    for (const [property, raw] of [
      ["url", scalar(node.url)],
      ["@id", scalar(node["@id"])],
    ] as const) {
      if (
        property === "url" &&
        profile.activeProfile === "directoryEntry" &&
        entityTypes.some((type) =>
          ["Organization", ...LOCAL_BUSINESS_TYPES].includes(type),
        )
      )
        continue;
      if (!raw || raw.startsWith("#") || !isHttpUrl(raw)) continue;
      try {
        if (normalizeUrl(raw) !== normalizeUrl(canonical))
          out.push(
            finding(
              "structured-data",
              `${property === "@id" ? "id" : "url"}-canonical-mismatch`,
              "warning",
              `JSON-LD ${property} '${raw}' differs from canonical '${canonical}'.`,
              "Use the canonical page URL for page-level entity identity; a same-page fragment in @id is allowed.",
              options,
            ),
          );
      } catch {
        // URL syntax findings are emitted by inspectValues.
      }
    }
  }
  return out;
}

function expectedNodeExists(
  allNodes: JsonObject[],
  rootNodes: Set<JsonObject>,
  expected: StructuredDataType,
  page: PageArtifact,
  $: CheerioAPI,
  profile: ResolvedProfile,
) {
  const title = normalizedText($("title").first().text()),
    h1 = normalizedText($("h1").first().text()),
    canonical =
      $('link[rel~="canonical"]').first().attr("href")?.trim() ?? page.url;
  return allNodes.some((node) => {
    if (!hasType(types(node), expected)) return false;
    if (["BreadcrumbList", "ItemList", "WebSite"].includes(expected))
      return true;
    if (
      [scalar(node.url), scalar(node["@id"])].some((raw) => {
        if (!raw || raw.startsWith("#") || !isHttpUrl(raw)) return false;
        try {
          return normalizeUrl(raw) === normalizeUrl(canonical);
        } catch {
          return false;
        }
      })
    )
      return true;
    return entityMatchesPage(
      node,
      profile.activeProfile,
      canonical,
      title,
      h1,
      rootNodes.has(node),
    );
  });
}

function incompatibleEntityTypes(left: string[], right: string[]) {
  if (!left.length || !right.length) return false;
  const compatibleFamilies = [
    new Set(["Organization", ...LOCAL_BUSINESS_TYPES]),
    new Set(["Article", "BlogPosting", "NewsArticle"]),
    new Set(["WebPage", "CollectionPage", "AboutPage", "ContactPage"]),
  ];
  if (
    compatibleFamilies.some(
      (family) =>
        left.every((type) => family.has(type)) &&
        right.every((type) => family.has(type)),
    )
  )
    return false;
  return !left.some((type) => right.includes(type));
}

function propertyRecommendations(
  node: JsonObject,
  page: PageArtifact,
  profile: ResolvedProfile,
  $: CheerioAPI,
  isRoot: boolean,
): Finding[] {
  const out: Finding[] = [],
    actual = types(node),
    missing = (properties: string[]) =>
      properties.filter((property) => {
        const value = node[property];
        return value === undefined || value === null || value === "";
      }),
    options = { ...pageOptions(page), googleDocs: GOOGLE_INTRO },
    canonical =
      $('link[rel~="canonical"]').first().attr("href")?.trim() ?? page.url,
    title = normalizedText($("title").first().text()),
    h1 = normalizedText($("h1").first().text()),
    matchesPage = entityMatchesPage(
      node,
      profile.activeProfile,
      canonical,
      title,
      h1,
      isRoot,
    );

  const coreProperties = (
    type: StructuredDataType,
    properties: string[],
    asProfileExpectation: boolean,
  ) => {
    const substantive = Object.keys(node).some(
      (property) => !["@context", "@type", "@id"].includes(property),
    );
    if (!substantive) return;
    const absent = properties.filter((property) => {
      if (
        property === "url" &&
        scalar(node["@id"]) &&
        isHttpUrl(scalar(node["@id"])!)
      )
        return false;
      const value = node[property];
      return value === undefined || value === null || value === "";
    });
    if (!absent.length) return;
    out.push(
      finding(
        "structured-data",
        "missing-core-properties",
        "warning",
        `${type} is missing core properties: ${absent.join(", ")}.`,
        "Add only accurate public values that represent this entity.",
        {
          ...options,
          classification: asProfileExpectation
            ? ["profile-expectation"]
            : ["local-heuristic"],
          impact: asProfileExpectation
            ? "profile-expectation"
            : "recommendation",
          ...(asProfileExpectation
            ? {
                activeProfile: profile.activeProfile,
                expectedStructuredData: [type],
              }
            : {}),
        },
      ),
    );
  };

  if (matchesPage && actual.includes("Person"))
    coreProperties(
      "Person",
      ["name", "url"],
      profile.activeProfile === "personal",
    );
  if (matchesPage && actual.includes("Organization"))
    coreProperties(
      "Organization",
      ["name", "url"],
      ["company", "directoryEntry"].includes(profile.activeProfile),
    );
  if (actual.includes("WebSite") && new URL(canonical).pathname === "/")
    coreProperties("WebSite", ["name", "url"], false);
  if (matchesPage && actual.includes("WebPage"))
    coreProperties("WebPage", ["name", "url"], false);
  if (matchesPage && actual.includes("Service"))
    coreProperties(
      "Service",
      ["name", "url"],
      profile.activeProfile === "servicePage",
    );

  if (actual.some((type) => ["Article", "BlogPosting"].includes(type))) {
    const absent = missing([
      "headline",
      "description",
      "datePublished",
      "dateModified",
      "author",
      "image",
    ]);
    if (absent.length)
      out.push(
        finding(
          "structured-data",
          "article-recommended-properties",
          "warning",
          `Article is missing recommended properties: ${absent.join(", ")}.`,
          "Add only accurate properties that apply; Google currently lists these as recommendations, not universal Article requirements.",
          {
            ...options,
            classification: ["google-recommendation"],
            googleDocs: GOOGLE_ARTICLE,
          },
        ),
      );
  }
  if (actual.includes("BreadcrumbList") && missing(["itemListElement"]).length)
    out.push(
      finding(
        "structured-data",
        "breadcrumb-missing-items",
        "warning",
        "BreadcrumbList has no itemListElement.",
        "Add ordered ListItem entries when breadcrumb rich-result eligibility matters.",
        { ...options, classification: ["google-requirement"] },
      ),
    );
  if (
    actual.includes("ItemList") &&
    (profile.expectedStructuredData.includes("ItemList") ||
      ["directory", "directoryList"].includes(profile.activeProfile))
  ) {
    const items = node.itemListElement;
    if (!Array.isArray(items) || items.length === 0)
      out.push(
        finding(
          "structured-data",
          "empty-item-list",
          "warning",
          "ItemList has no listing entries.",
          "Populate itemListElement or remove empty listing markup.",
          {
            ...options,
            classification: ["profile-expectation", "local-heuristic"],
            impact: "profile-expectation",
            activeProfile: profile.activeProfile,
            expectedStructuredData: ["ItemList"],
          },
        ),
      );
  }
  if (
    actual.some((type) => LOCAL_BUSINESS_TYPES.has(type)) &&
    ["directoryEntry", "localBusiness", "servicePage"].includes(
      profile.activeProfile,
    )
  ) {
    const absent = missing(["name", "url"]);
    if (absent.length)
      out.push(
        finding(
          "structured-data",
          "local-business-core-properties",
          "warning",
          `LocalBusiness is missing profile properties: ${absent.join(", ")}.`,
          "Add accurate public values when available. Address, telephone, and opening hours are intentionally not forced.",
          {
            ...options,
            classification: ["profile-expectation"],
            impact: "profile-expectation",
            activeProfile: profile.activeProfile,
            expectedStructuredData: ["LocalBusiness"],
            googleDocs: GOOGLE_LOCAL_BUSINESS,
          },
        ),
      );
  }
  if (
    matchesPage &&
    actual.includes("Person") &&
    profile.activeProfile === "personal"
  ) {
    const description = scalar(node.description);
    if (!description || PLACEHOLDER.test(description))
      out.push(
        profileFinding(
          page,
          profile,
          "person-description",
          "Person has no useful public description.",
          "Add a short professional description if appropriate; do not add private data.",
          ["Person"],
        ),
      );
  }
  return out;
}

function hasCoherentListingLinks($: CheerioAPI, pageUrl: string) {
  const paths = $("a[href]")
    .map((_, element) => {
      try {
        const url = new URL($(element).attr("href")!, pageUrl);
        return url.origin === new URL(pageUrl).origin
          ? url.pathname
          : undefined;
      } catch {
        return undefined;
      }
    })
    .get()
    .filter((path) => path !== new URL(pageUrl).pathname);
  const parents = paths.map((path) => path.split("/").slice(0, -1).join("/"));
  return parents.some(
    (parent) => parents.filter((candidate) => candidate === parent).length >= 3,
  );
}

export const structuredDataCheck: CheckDefinition = {
  name: "structuredData",
  description:
    "Validates JSON-LD syntax, identity, URLs, profile expectations, and obvious content conflicts.",
  run({ crawl, config }) {
    const out: Finding[] = [];
    for (const page of crawl.pages) {
      const $ = loadHtml(page.html),
        blocks = $('script[type="application/ld+json"]'),
        profile = resolveProfile(page.url, config),
        parsedBlocks: unknown[] = [];
      blocks.each((index, element) => {
        try {
          parsedBlocks.push(JSON.parse($(element).html()?.trim() ?? ""));
        } catch (error) {
          out.push(
            finding(
              "structured-data",
              "invalid-json",
              "error",
              `JSON-LD block ${index + 1} is invalid: ${(error as Error).message}.`,
              "Fix the JSON syntax, then use Rich Results Test for feature-specific validation.",
              { ...pageOptions(page), googleDocs: GOOGLE_INTRO },
            ),
          );
        }
      });

      const rootNodes = new Set(
          parsedBlocks.flatMap((parsed) =>
            (Array.isArray(parsed) ? parsed : [parsed]).filter(isObject),
          ),
        ),
        allNodes = parsedBlocks.flatMap((parsed) => nodes(parsed)),
        ids = new Map<string, { types: string[]; name?: string }>(),
        conflictingIds = new Set<string>();

      parsedBlocks.forEach((parsed, blockIndex) => {
        const roots = (Array.isArray(parsed) ? parsed : [parsed]).filter(
          isObject,
        );
        for (const root of roots)
          if (!root["@context"])
            out.push(
              finding(
                "structured-data",
                "missing-context",
                "warning",
                `JSON-LD block ${blockIndex + 1} has a root node with no @context.`,
                "Declare https://schema.org as the JSON-LD context.",
                { ...pageOptions(page), googleDocs: GOOGLE_INTRO },
              ),
            );
        for (const node of nodes(parsed)) {
          if (!node["@type"] && !node["@graph"] && !node["@id"])
            out.push(
              finding(
                "structured-data",
                "missing-type",
                "warning",
                `JSON-LD block ${blockIndex + 1} contains a node with no @type.`,
                "Declare the schema.org type for each entity node.",
                { ...pageOptions(page), googleDocs: GOOGLE_INTRO },
              ),
            );
          const id = scalar(node["@id"]),
            entityTypes = types(node),
            name = scalar(node.name) ?? scalar(node.headline);
          if (id) {
            const previous = ids.get(id);
            if (
              previous &&
              (incompatibleEntityTypes(previous.types, entityTypes) ||
                (previous.name &&
                  name &&
                  obviousTextConflict(previous.name, name)))
            )
              conflictingIds.add(id);
            else ids.set(id, { types: entityTypes, ...(name ? { name } : {}) });
          }
          out.push(
            ...compareEntity(node, page, $, profile, rootNodes.has(node)),
          );
          out.push(
            ...propertyRecommendations(
              node,
              page,
              profile,
              $,
              rootNodes.has(node),
            ),
          );
        }
        out.push(
          ...inspectValues(parsed, `$[${blockIndex}]`, undefined, page, config),
        );
      });

      if (conflictingIds.size) {
        const shown = [...conflictingIds].slice(0, 3);
        out.push(
          finding(
            "structured-data",
            "conflicting-identity",
            "warning",
            `${conflictingIds.size} JSON-LD @id value${conflictingIds.size === 1 ? "" : "s"} identify conflicting entities: ${shown.join(", ")}${conflictingIds.size > shown.length ? ", …" : ""}.`,
            "Use one stable @id per entity and reconcile incompatible types or names.",
            { ...pageOptions(page), googleDocs: GOOGLE_GENERAL },
          ),
        );
      }

      const explicitRequired = profile.requiredStructuredData;
      for (const expected of explicitRequired) {
        if (expectedNodeExists(allNodes, rootNodes, expected, page, $, profile))
          continue;
        if (
          expected === "ItemList" &&
          profile.activeProfile === "directoryList" &&
          hasCoherentListingLinks($, page.url)
        )
          continue;
        out.push(
          profileFinding(
            page,
            profile,
            "missing-expected-type",
            `Profile '${profile.activeProfile}' expects ${expected} on this route.`,
            "Add accurate markup if it represents the page, or adjust the route profile instead of adding fictional data.",
            [expected],
          ),
        );
      }
      if (
        profile.expectedAnyOf?.length &&
        !profile.requiredStructuredData.some((expected) =>
          profile.expectedAnyOf!.includes(expected),
        ) &&
        !profile.expectedAnyOf.some((expected) =>
          expectedNodeExists(allNodes, rootNodes, expected, page, $, profile),
        )
      )
        out.push(
          profileFinding(
            page,
            profile,
            "missing-expected-type",
            `Profile '${profile.activeProfile}' expects one of: ${profile.expectedAnyOf.join(", ")}.`,
            "Add the type that accurately represents the page, or adjust the route profile.",
            profile.expectedAnyOf,
          ),
        );
      if (!blocks.length && !profile.expectedStructuredData.length)
        out.push(
          finding(
            "structured-data",
            "missing",
            "info",
            "No JSON-LD was found.",
            "No action is required unless an appropriate Search feature or configured profile applies.",
            { ...pageOptions(page), googleDocs: GOOGLE_INTRO },
          ),
        );
    }
    const unique = new Map<string, Finding>();
    for (const item of out)
      unique.set(
        [item.check, item.code, item.url, item.message].join("\u0000"),
        item,
      );
    return [...unique.values()];
  },
};
