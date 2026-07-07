import { loadHtml } from "../utils/html.js";
import { isHttpUrl, sameOrigin } from "../utils/urls.js";
export function discoverLinks(
  html: string,
  pageUrl: string,
  publicBase: string,
  excluded: (p: string) => boolean,
) {
  const $ = loadHtml(html);
  return $("a")
    .map((_, el) => {
      const raw = ($(el).attr("href") ?? "").trim();
      if (
        !raw ||
        raw.startsWith("#") ||
        /^(mailto:|tel:|javascript:|data:)/i.test(raw)
      )
        return { raw, internal: false };
      try {
        const absolute = new URL(raw, pageUrl).toString();
        return {
          raw,
          absolute,
          internal:
            isHttpUrl(absolute) &&
            sameOrigin(absolute, publicBase) &&
            !excluded(new URL(absolute).pathname),
        };
      } catch {
        return { raw, internal: false };
      }
    })
    .get();
}
