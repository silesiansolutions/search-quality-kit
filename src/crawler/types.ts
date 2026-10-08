export type FetchFailure =
  | "timeout"
  | "dns"
  | "connection-refused"
  | "tls"
  | "redirect-loop"
  | "too-many-redirects"
  | "network";
export interface RedirectHop {
  /** URL that answered with a redirect status. */
  url: string;
  status: number;
  /** Absolute URL from the Location header. */
  location: string;
}
export interface PageArtifact {
  /** Public URL requested before redirects. */
  initialUrl: string;
  /** Public URL returned after redirects. */
  finalUrl: string;
  /** Alias for finalUrl kept for check compatibility. */
  url: string;
  requestUrl: string;
  status: number;
  html: string;
  headers: Record<string, string>;
  file?: string;
  bytes: number;
  /** Redirect hops observed in HTTP mode, in public URLs. */
  redirects?: RedirectHop[];
  /** Why an HTTP request produced no response. Set only when status is 0. */
  failure?: FetchFailure;
}
export interface TextArtifact {
  url: string;
  status: number;
  content?: string;
  file?: string;
  parentUrl?: string;
  depth?: number;
  failure?: FetchFailure;
}
export interface AssetArtifact {
  url: string;
  file?: string;
  bytes?: number;
}
export type ResourceKind = "image" | "script" | "stylesheet";
export interface ResourceArtifact {
  url: string;
  kind: ResourceKind;
  status: number;
  failure?: FetchFailure;
  /** Public URLs of the pages that reference the resource. */
  referencedBy: string[];
}
export interface CrawlResult {
  mode: "static" | "http";
  target: string;
  publicBaseUrl: string;
  pages: PageArtifact[];
  /** Non-HTML 2xx responses reached by an HTTP crawl, kept out of the page checks. Their html is empty. */
  documents?: PageArtifact[];
  robots: TextArtifact;
  llmsTxt: TextArtifact;
  sitemap: TextArtifact;
  sitemaps: TextArtifact[];
  sitemapUrls: string[];
  sitemapTruncated: boolean;
  assets: Map<string, AssetArtifact>;
  /** Same-origin page resources requested in HTTP mode. */
  resources?: ResourceArtifact[];
  /** Set when HTTP mode stopped requesting resources at the page budget. */
  resourcesTruncated?: boolean;
}
