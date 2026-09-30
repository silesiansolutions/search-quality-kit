import { matchesRoutePattern } from "./config/profileDefinitions.js";
import type { SearchQualityConfig } from "./config/schema.js";
import { legacyFindingCode, stableFindingCode } from "./findingCodes.js";
import type { Finding, FindingSuppression } from "./report/types.js";

export function findingStableCode(finding: Finding) {
  return stableFindingCode(finding);
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

function suppressionMatches(
  suppression: FindingSuppression,
  finding: Finding,
  baseUrl: string,
) {
  const code = findingStableCode(finding);
  return (
    (suppression.code === code ||
      suppression.code === legacyFindingCode(code)) &&
    findingPaths(finding, baseUrl).some((pathname) =>
      matchesRoutePattern(pathname, suppression.urlPattern),
    )
  );
}

export function applyReviewedSuppressions(
  findings: Finding[],
  config: SearchQualityConfig,
  today = new Date().toISOString().slice(0, 10),
) {
  const baseUrl = config.site.baseUrl;
  if (!baseUrl || !config.suppressions.length) return findings;
  return findings.map((finding) => {
    const suppression = config.suppressions.find(
      (candidate) =>
        !isSuppressionExpired(candidate, today) &&
        suppressionMatches(candidate, finding, baseUrl),
    );
    if (!suppression) return finding;
    return {
      ...finding,
      suppressed: true as const,
      suppression: { ...suppression },
    };
  });
}

export function unmatchedSuppressions(
  findings: Finding[],
  config: SearchQualityConfig,
  today = new Date().toISOString().slice(0, 10),
): FindingSuppression[] {
  const baseUrl = config.site.baseUrl;
  if (!baseUrl) return [];
  return config.suppressions
    .filter(
      (suppression) =>
        !isSuppressionExpired(suppression, today) &&
        !findings.some((finding) =>
          suppressionMatches(suppression, finding, baseUrl),
        ),
    )
    .map((suppression) => ({ ...suppression }));
}

export const unsuppressedFindings = (findings: Finding[]) =>
  findings.filter((finding) => !finding.suppressed);
