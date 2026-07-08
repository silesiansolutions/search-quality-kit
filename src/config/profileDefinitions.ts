export const structuredDataTypes = [
  "Person",
  "Organization",
  "WebSite",
  "WebPage",
  "Article",
  "BlogPosting",
  "BreadcrumbList",
  "ItemList",
  "LocalBusiness",
  "Service",
] as const;

export type StructuredDataType = (typeof structuredDataTypes)[number];

export const profileIds = [
  "generic",
  "personal",
  "company",
  "blog",
  "directory",
  "localBusiness",
  "blogPost",
  "directoryEntry",
  "directoryList",
  "servicePage",
] as const;

export type SiteProfileId = (typeof profileIds)[number];

export interface ProfileDefinition {
  id: SiteProfileId;
  description: string;
  expectedStructuredData: StructuredDataType[];
  expectedAnyOf?: StructuredDataType[];
  typicalRoutes: string[];
  expectation: "none" | "home" | "home-or-about" | "content" | "all";
}

export const profileCatalog: ProfileDefinition[] = [
  {
    id: "generic",
    description:
      "Neutral technical sanity checks without site-type assumptions.",
    expectedStructuredData: [],
    typicalRoutes: ["/**"],
    expectation: "none",
  },
  {
    id: "personal",
    description: "Personal expert, portfolio, and author sites.",
    expectedStructuredData: ["Person"],
    typicalRoutes: ["/", "/about", "/o-mnie"],
    expectation: "home-or-about",
  },
  {
    id: "company",
    description: "Company and service-business sites.",
    expectedStructuredData: ["Organization"],
    typicalRoutes: ["/", "/about", "/o-nas"],
    expectation: "home",
  },
  {
    id: "blog",
    description: "Blogs and editorial publications.",
    expectedStructuredData: ["Article", "BlogPosting"],
    expectedAnyOf: ["Article", "BlogPosting"],
    typicalRoutes: ["/blog/**", "/articles/**"],
    expectation: "content",
  },
  {
    id: "directory",
    description: "Directory and catalog sites with list and entry routes.",
    expectedStructuredData: ["ItemList"],
    typicalRoutes: ["/", "/categories/**", "/entries/**"],
    expectation: "home",
  },
  {
    id: "localBusiness",
    description: "A local business or location-specific service site.",
    expectedStructuredData: ["LocalBusiness"],
    typicalRoutes: ["/", "/locations/**", "/services/**"],
    expectation: "all",
  },
  {
    id: "blogPost",
    description: "A route containing an article or blog post.",
    expectedStructuredData: ["Article", "BlogPosting"],
    expectedAnyOf: ["Article", "BlogPosting"],
    typicalRoutes: ["/blog/**", "/articles/**"],
    expectation: "all",
  },
  {
    id: "directoryEntry",
    description: "An individual organization or business listing.",
    expectedStructuredData: ["Organization", "LocalBusiness"],
    expectedAnyOf: ["Organization", "LocalBusiness"],
    typicalRoutes: ["/firmy/**", "/entries/**"],
    expectation: "all",
  },
  {
    id: "directoryList",
    description: "A category or listing collection page.",
    expectedStructuredData: ["ItemList"],
    typicalRoutes: ["/kategorie/**", "/categories/**"],
    expectation: "all",
  },
  {
    id: "servicePage",
    description: "A page describing a company or local-business service.",
    expectedStructuredData: ["Service"],
    typicalRoutes: ["/services/**", "/uslugi/**"],
    expectation: "all",
  },
];

const byId = new Map(profileCatalog.map((profile) => [profile.id, profile]));

export function profileDefinition(id: SiteProfileId) {
  return byId.get(id)!;
}

export function validRoutePattern(pattern: string) {
  return (
    pattern.startsWith("/") &&
    !/[\\[\]{}?!#]/.test(pattern) &&
    !pattern.includes("***") &&
    !pattern.includes("//")
  );
}

export function routePatternRegex(pattern: string) {
  if (!validRoutePattern(pattern))
    throw new Error(
      `Invalid route profile pattern "${pattern}". Use a root-relative glob such as /blog/**; supported wildcards are * and **.`,
    );
  const escaped = pattern.replace(/[.+^$()|\\]/g, "\\$&");
  const tokenized = escaped
    .replace(/\/\*\*$/g, "__GLOBSTAR_TAIL__")
    .replace(/\*\*/g, "__GLOBSTAR__")
    .replace(/\*/g, "[^/]*")
    .replace(/__GLOBSTAR_TAIL__/g, "(?:/.*)?")
    .replace(/__GLOBSTAR__/g, ".*");
  return new RegExp(`^${tokenized}/?$`);
}

export function matchesRoutePattern(pathname: string, pattern: string) {
  return routePatternRegex(pattern).test(pathname);
}
