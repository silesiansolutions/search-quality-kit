import type { Finding, SearchQualityReport } from "./types.js";

const level = (severity: Finding["severity"]) =>
  severity === "info" ? "note" : severity;

export function formatSarifReport(report: SearchQualityReport) {
  const rules = new Map<string, Finding>();
  for (const finding of report.findings)
    if (!rules.has(finding.code)) rules.set(finding.code, finding);

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
                id: finding.code,
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
            ruleId: finding.code,
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
            },
          })),
        },
      ],
    },
    null,
    2,
  );
}
