export const codeAliases: Readonly<Record<string, string>> = Object.freeze({
  "indexability.4xx": "indexability.non-200",
  "indexability.5xx": "indexability.non-200",
  "indexability.timeout": "indexability.non-200",
  "indexability.unreachable": "indexability.non-200",
  "robots.unavailable": "robots.missing",
});

export function stableFindingCode(finding: { check: string; code: string }) {
  return finding.code.includes(".")
    ? finding.code
    : `${finding.check}.${finding.code}`;
}

export function legacyFindingCode(stableCode: string) {
  return codeAliases[stableCode] ?? stableCode;
}
