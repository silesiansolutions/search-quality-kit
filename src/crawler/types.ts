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
}
export interface TextArtifact {
  url: string;
  status: number;
  content?: string;
  file?: string;
  parentUrl?: string;
  depth?: number;
}
export interface AssetArtifact {
  url: string;
  file?: string;
  bytes?: number;
}
export interface CrawlResult {
  mode: "static" | "http";
  target: string;
  publicBaseUrl: string;
  pages: PageArtifact[];
  robots: TextArtifact;
  llmsTxt: TextArtifact;
  sitemap: TextArtifact;
  sitemaps: TextArtifact[];
  sitemapUrls: string[];
  sitemapTruncated: boolean;
  assets: Map<string, AssetArtifact>;
}
