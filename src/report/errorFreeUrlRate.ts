import { unsuppressedFindings } from "../suppressions.js";
import { normalizeUrl } from "../utils/urls.js";
import type { Finding } from "./types.js";

const normalized = (url: string) => {
  try {
    return normalizeUrl(url);
  } catch {
    return url;
  }
};

export function errorFreeUrlRate(auditedUrls: number, urlsWithErrors: number) {
  return Math.floor(((auditedUrls - urlsWithErrors) / auditedUrls) * 100);
}

export function errorFreeUrlSummary(
  pages: readonly { url: string }[],
  findings: readonly Finding[],
): { urlsWithErrors?: number; errorFreeUrlRate?: number } {
  if (!pages.length) return {};
  const audited = new Set(pages.map((page) => normalized(page.url)));
  const erroring = new Set<string>();
  for (const finding of unsuppressedFindings([...findings])) {
    if (finding.severity !== "error" || !finding.url) continue;
    const url = normalized(finding.url);
    if (audited.has(url)) erroring.add(url);
  }
  return {
    urlsWithErrors: erroring.size,
    errorFreeUrlRate: errorFreeUrlRate(pages.length, erroring.size),
  };
}

export function errorFreeUrlLine(summary: {
  checkedPages: number;
  urlsWithErrors?: number;
  errorFreeUrlRate?: number;
}) {
  return summary.errorFreeUrlRate === undefined
    ? undefined
    : `Error-free URLs: ${summary.errorFreeUrlRate}% (${summary.urlsWithErrors} of ${summary.checkedPages} pages carry an error)`;
}
