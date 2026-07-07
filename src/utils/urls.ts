import type { SearchQualityConfig } from "../config/schema.js";
export function normalizeUrl(value: string, base?: string) {
  const u = base ? new URL(value, base) : new URL(value);
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  if (
    (u.protocol === "https:" && u.port === "443") ||
    (u.protocol === "http:" && u.port === "80")
  )
    u.port = "";
  if (u.pathname !== "/") u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString();
}
export function isHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
export function sameOrigin(a: string, b: string) {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}
export function isLocalOrStaging(value: string, config: SearchQualityConfig) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return config.site.stagingHosts.some(
      (token) => host === token || host.includes(token.toLowerCase()),
    );
  } catch {
    return false;
  }
}
export function pathAllowed(pathname: string, config: SearchQualityConfig) {
  const match = (p: string) =>
    p === "/" || pathname === p || pathname.startsWith(`${p}/`);
  return config.crawl.include.some(match) && !config.crawl.exclude.some(match);
}
export function displayUrl(value: string) {
  try {
    const u = new URL(value);
    return `${u.pathname}${u.search}`;
  } catch {
    return value;
  }
}
