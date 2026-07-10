import { matchesRoutePattern } from "./config/profileDefinitions.js";
import type { SearchQualityConfig } from "./config/schema.js";
import type { Finding, FindingSuppression } from "./report/types.js";

export function findingStableCode(finding: Finding) {
  return finding.code.includes(".")
    ? finding.code
    : `${finding.check}.${finding.code}`;
}

export function isSuppressionExpired(
  suppression: Pick<FindingSuppression, "expires">,
  today = new Date().toISOString().slice(0, 10),
) {
  return Boolean(suppression.expires && suppression.expires < today);
}

function findingPaths(finding: Finding, baseUrl: string) {
  return [finding.url, ...(finding.relatedUrls ?? [])].flatMap((url) => {
    if (!url) return [];
    try {
      return [new URL(url, baseUrl).pathname];
    } catch {
      return [];
    }
  });
}

export function applyReviewedSuppressions(
  findings: Finding[],
  config: SearchQualityConfig,
  today = new Date().toISOString().slice(0, 10),
) {
  const baseUrl = config.site.baseUrl;
  if (!baseUrl || !config.suppressions.length) return findings;
  return findings.map((finding) => {
    const code = findingStableCode(finding);
    const paths = findingPaths(finding, baseUrl);
    const suppression = config.suppressions.find(
      (candidate) =>
        candidate.code === code &&
        !isSuppressionExpired(candidate, today) &&
        paths.some((pathname) =>
          matchesRoutePattern(pathname, candidate.urlPattern),
        ),
    );
    if (!suppression) return finding;
    return {
      ...finding,
      suppressed: true as const,
      suppression: { ...suppression },
    };
  });
}

export const unsuppressedFindings = (findings: Finding[]) =>
  findings.filter((finding) => !finding.suppressed);
