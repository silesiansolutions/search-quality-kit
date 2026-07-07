import type { SearchQualityConfig } from "../config/schema.js";
export async function fetchText(url: string, config: SearchQualityConfig) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    config.crawl.requestTimeoutMs,
  );
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": config.crawl.userAgent,
        accept: "text/html,application/xml,text/plain,*/*",
      },
    });
    return {
      status: response.status,
      content: await response.text(),
      headers: Object.fromEntries(response.headers.entries()),
    };
  } catch {
    return { status: 0, headers: {} as Record<string, string> };
  } finally {
    clearTimeout(timer);
  }
}
