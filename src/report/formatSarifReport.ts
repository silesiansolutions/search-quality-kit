import { findingStableCode } from "../suppressions.js";
import type { Finding, SearchQualityReport } from "./types.js";

const level = (severity: Finding["severity"]) =>
  severity === "info" ? "note" : severity;

export function formatSarifReport(report: SearchQualityReport) {
  const rules = new Map<string, Finding>();
  for (const finding of report.findings) {
    const id = findingStableCode(finding);
    if (!rules.has(id)) rules.set(id, finding);
  }

  return JSON.stringify(
    {
      $schema: "https://json.schemastore.org/sarif-2.1.0.json",
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "search-quality-kit",
              informationUri:
                "https://github.com/SilesianSolutions/search-quality-kit",
              version: report.version,
              rules: [...rules.values()].map((finding) => ({
                id: findingStableCode(finding),
                name: finding.check,
                shortDescription: {
                  text: `${finding.check}/${finding.code}`,
                },
                fullDescription: { text: finding.suggestion },
                helpUri: finding.googleDocs ?? finding.docs,
                help: {
                  text: `${finding.suggestion}\n\n${finding.googleDocs ?? finding.docs}`,
                },
              })),
            },
          },
          results: report.findings.map((finding) => ({
            ruleId: findingStableCode(finding),
            level: level(finding.severity),
            message: {
              text: `${finding.message}\n\nRemediation: ${finding.suggestion}`,
            },
            ...(finding.url || finding.file
              ? {
                  locations: [
                    {
                      physicalLocation: {
                        artifactLocation: {
                          uri: finding.url ?? finding.file,
                        },
                      },
                    },
                  ],
                }
              : {}),
            properties: {
              check: finding.check,
              source: finding.source,
              classification: finding.classification ?? [],
              documentation: finding.docs,
              ...(finding.googleDocs
                ? { googleDocumentation: finding.googleDocs }
                : {}),
              ...(finding.suppressed
                ? {
                    suppressed: true,
                    suppression: finding.suppression,
                  }
                : {}),
            },
            ...(finding.suppressed
              ? {
                  suppressions: [
                    {
                      kind: "external",
                      justification: finding.suppression?.reason,
                    },
                  ],
                }
              : {}),
          })),
        },
      ],
    },
    null,
    2,
  );
}
