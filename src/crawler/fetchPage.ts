import type { SearchQualityConfig } from "../config/schema.js";
import type { FetchFailure, RedirectHop } from "./types.js";

export interface FetchTextResult {
  status: number;
  content?: string;
  headers: Record<string, string>;
  finalUrl: string;
  redirected: boolean;
  redirects: RedirectHop[];
  failure?: FetchFailure;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const DNS_CODES = new Set(["ENOTFOUND", "EAI_AGAIN", "EAI_NONAME", "EAI_FAIL"]);
const REFUSED_CODES = new Set(["ECONNREFUSED"]);
const TIMEOUT_CODES = new Set([
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

function errorCodes(error: unknown): string[] {
  const codes: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (typeof current !== "object") break;
    const record = current as {
      code?: unknown;
      name?: unknown;
      cause?: unknown;
    };
    if (typeof record.code === "string") codes.push(record.code);
    if (typeof record.name === "string") codes.push(record.name);
    current = record.cause;
  }
  return codes;
}

export function classifyFetchError(
  error: unknown,
  aborted: boolean,
): FetchFailure {
  if (aborted) return "timeout";
  const codes = errorCodes(error);
  if (codes.some((code) => code === "AbortError" || code === "TimeoutError"))
    return "timeout";
  if (codes.some((code) => TIMEOUT_CODES.has(code))) return "timeout";
  if (codes.some((code) => DNS_CODES.has(code))) return "dns";
  if (codes.some((code) => REFUSED_CODES.has(code)))
    return "connection-refused";
  if (
    codes.some(
      (code) =>
        code.startsWith("ERR_TLS") ||
        code.startsWith("ERR_SSL") ||
        code.includes("CERT") ||
        code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
        code === "EPROTO",
    )
  )
    return "tls";
  return "network";
}

async function fetchOnce(
  url: string,
  config: SearchQualityConfig,
  readBody: boolean,
) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    config.crawl.requestTimeoutMs,
  );
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "user-agent": config.crawl.userAgent,
        accept: "text/html,application/xml,text/plain,*/*",
      },
    });
    const location = REDIRECT_STATUSES.has(response.status)
      ? (response.headers.get("location") ?? undefined)
      : undefined;
    let content: string | undefined;
    if (readBody && location === undefined) content = await response.text();
    else await response.body?.cancel().catch(() => undefined);
    return {
      ok: true as const,
      status: response.status,
      content,
      headers: Object.fromEntries(response.headers.entries()),
      location,
    };
  } catch (error) {
    return {
      ok: false as const,
      failure: classifyFetchError(error, controller.signal.aborted),
    };
  } finally {
    clearTimeout(timer);
  }
}

function keyOf(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

async function fetchFollowing(
  url: string,
  config: SearchQualityConfig,
  readBody: boolean,
): Promise<FetchTextResult> {
  const redirects: RedirectHop[] = [];
  const visited = new Set<string>([keyOf(url)]);
  let current = url;
  for (;;) {
    const response = await fetchOnce(current, config, readBody);
    const base = {
      finalUrl: current,
      redirected: redirects.length > 0,
      redirects,
    };
    if (!response.ok)
      return { ...base, status: 0, headers: {}, failure: response.failure };
    let next: string | undefined;
    if (response.location !== undefined)
      try {
        next = new URL(response.location, current).toString();
      } catch {
        next = undefined;
      }
    if (next === undefined)
      return {
        ...base,
        status: response.status,
        headers: response.headers,
        ...(response.content === undefined
          ? {}
          : { content: response.content }),
      };
    redirects.push({ url: current, status: response.status, location: next });
    const key = keyOf(next);
    const failure: FetchFailure | undefined = visited.has(key)
      ? "redirect-loop"
      : redirects.length > config.crawl.maxRedirects
        ? "too-many-redirects"
        : undefined;
    if (failure)
      return {
        status: 0,
        headers: {},
        finalUrl: next,
        redirected: true,
        redirects,
        failure,
      };
    visited.add(key);
    current = next;
  }
}

export function fetchText(url: string, config: SearchQualityConfig) {
  return fetchFollowing(url, config, true);
}

export function fetchStatus(url: string, config: SearchQualityConfig) {
  return fetchFollowing(url, config, false);
}
