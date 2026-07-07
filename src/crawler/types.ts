export interface PageArtifact {
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
  sitemap: TextArtifact;
  assets: Map<string, AssetArtifact>;
}
