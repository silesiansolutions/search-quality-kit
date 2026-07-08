#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { checkCatalog } from "../checks/index.js";
import { detectPreset, supportedPresetMessage } from "../config/loadConfig.js";
import { profileCatalog } from "../config/profileDefinitions.js";
import {
  configTemplate,
  presetByName,
  type PresetName,
} from "../config/presets.js";
import { runVerification, shouldFail } from "../engine/verify.js";
import { formatConsoleReport } from "../report/formatConsoleReport.js";
import { formatJsonReport } from "../report/formatJsonReport.js";
import { formatMarkdownReport } from "../report/formatMarkdownReport.js";
import { formatSarifReport } from "../report/formatSarifReport.js";
import {
  parseBaselineReport,
  parseSearchQualityReport,
  withBaselineComparison,
} from "../report/baseline.js";
import {
  REPORT_SCHEMA_VERSION,
  type SearchQualityReport,
} from "../report/types.js";
import { fileExists } from "../utils/files.js";
import { VERSION } from "../version.js";
import { runPortfolio } from "../portfolio/runner.js";
import { formatPortfolioJsonReport } from "../portfolio/report.js";
const program = new Command();
const formats = ["console", "json", "markdown", "sarif"] as const;

function renderReport(report: SearchQualityReport, format: string) {
  if (!formats.includes(format as (typeof formats)[number]))
    throw new Error(`Unknown report format: ${format}`);
  if (format === "json") return formatJsonReport(report);
  if (format === "markdown") return formatMarkdownReport(report);
  if (format === "sarif") return formatSarifReport(report);
  return formatConsoleReport(report);
}
program
  .name("search-quality-kit")
  .description("Catch technical Google Search quality regressions.")
  .version(VERSION);
program
  .command("verify", { isDefault: true })
  .description("Build/crawl the configured target and run enabled checks")
  .option("-c, --config <file>", "config path relative to root")
  .option("--root <directory>", "target project root", process.cwd())
  .option("--report-only", "always exit successfully")
  .option("--baseline <file>", "compare findings with a JSON report")
  .option("--fail-on-new", "fail only on findings absent from --baseline")
  .option("--json", "print JSON")
  .option("--format <format>", "console, json, markdown, or sarif")
  .option("-o, --output <file>", "write report to a file")
  .option("--skip-build", "skip build.command")
  .action(async (o) => {
    if (o.failOnNew && !o.baseline)
      throw new Error("--fail-on-new requires --baseline <file>");
    const baseline = o.baseline
        ? parseBaselineReport(
            await readFile(path.resolve(o.root, o.baseline), "utf8"),
          )
        : undefined,
      result = await runVerification({
        root: o.root,
        configPath: o.config,
        skipBuild: o.skipBuild,
      }),
      config = result.config,
      report = baseline
        ? withBaselineComparison(result.report, baseline)
        : result.report,
      format = o.json ? "json" : (o.format ?? config.output.format);
    const rendered = renderReport(report, format);
    if (o.output)
      await writeFile(path.resolve(o.root, o.output), `${rendered}\n`, "utf8");
    else process.stdout.write(`${rendered}\n`);
    const failureCandidates =
      o.failOnNew && report.baseline
        ? report.baseline.newFindings
        : report.findings;
    if (shouldFail(report, config, o.reportOnly, failureCandidates))
      process.exitCode = 1;
    if (report.pluginErrors?.length) process.exitCode = 2;
  });
const portfolio = program
  .command("portfolio")
  .description("Run isolated site audits and one portfolio gate");
portfolio
  .command("verify")
  .description("Verify every site in a portfolio config")
  .requiredOption("-c, --config <file>", "portfolio config path")
  .option("--root <directory>", "portfolio root", process.cwd())
  .option("--output-dir <directory>", "override the report directory")
  .option("--report-only", "always exit successfully after writing reports")
  .option("--fail-on-new", "gate only per-site findings absent from baselines")
  .option("--skip-build", "skip build.command for every site")
  .option("--include-findings", "include full site findings in portfolio.json")
  .option("--sarif", "write a SARIF report for every completed site")
  .option("--json", "print portfolio JSON to stdout")
  .action(async (o) => {
    const result = await runPortfolio({
      root: o.root,
      configPath: o.config,
      outputDir: o.outputDir,
      reportOnly: o.reportOnly || undefined,
      failOnNew: o.failOnNew || undefined,
      skipBuild: o.skipBuild,
      includeFindings: o.includeFindings,
      sarif: o.sarif,
    });
    process.stdout.write(
      o.json
        ? `${formatPortfolioJsonReport(result.report)}\n`
        : `Portfolio gate: ${result.report.gate.status}. Reports: ${result.outputDirectory}\n`,
    );
    process.exitCode = result.exitCode;
  });
portfolio
  .command("baseline")
  .description("Write one reviewed single-site baseline per configured site")
  .requiredOption("-c, --config <file>", "portfolio config path")
  .option("--root <directory>", "portfolio root", process.cwd())
  .option("--output-dir <directory>", "override the report directory")
  .option("--skip-build", "skip build.command for every site")
  .option("--force", "replace existing baseline files")
  .option("--sarif", "write a SARIF report for every completed site")
  .action(async (o) => {
    const result = await runPortfolio({
      root: o.root,
      configPath: o.config,
      outputDir: o.outputDir,
      skipBuild: o.skipBuild,
      sarif: o.sarif,
      writeBaselines: true,
      forceBaselines: o.force,
    });
    process.stdout.write(
      `Portfolio baselines: ${result.report.gate.status}. Reports: ${result.outputDirectory}\n`,
    );
    process.exitCode = result.exitCode;
  });
program
  .command("init")
  .description("Create a typed config for a supported project stack")
  .option("--root <directory>", "target project root", process.cwd())
  .option("--preset <name>", "framework preset")
  .option("--detect", "detect a preset conservatively from package.json")
  .option("--force", "overwrite existing config")
  .action(async (o) => {
    if (o.preset && o.detect)
      throw new Error("Use either --preset <name> or --detect, not both.");
    let presetName = o.preset as string | undefined;
    if (presetName) presetByName(presetName);
    if (o.detect) {
      presetName = await detectPreset(o.root);
      if (!presetName)
        throw new Error(
          `Could not confidently detect a preset. Use --preset with one of: ${supportedPresetMessage}.`,
        );
    }
    presetName ??= "generic-static";
    const dest = path.resolve(o.root, "search-quality.config.ts");
    if ((await fileExists(dest)) && !o.force)
      throw new Error(
        `Config already exists: ${dest}. Use --force to replace it.`,
      );
    await writeFile(dest, configTemplate(presetName as PresetName), "utf8");
    process.stdout.write(`Created ${dest} with preset ${presetName}\n`);
  });
program
  .command("list-checks")
  .description("List built-in checks")
  .action(() => {
    process.stdout.write("ID\tSEVERITIES\tCLASSIFICATIONS\tDESCRIPTION\n");
    checkCatalog.forEach((check) =>
      process.stdout.write(
        `${check.id}\t${check.severities.join(",")}\t${check.classification.join(", ")}\t${check.description}\n`,
      ),
    );
  });
program
  .command("list-profiles")
  .description("List site and route profile expectations")
  .action(() => {
    process.stdout.write(
      "ID\tEXPECTED STRUCTURED DATA\tTYPICAL ROUTES\tFINDING CLASS\tDESCRIPTION\n",
    );
    profileCatalog.forEach((profile) =>
      process.stdout.write(
        `${profile.id}\t${profile.expectedStructuredData.join(",") || "none"}\t${profile.typicalRoutes.join(",")}\tprofile-expectation (warning, not a hard requirement)\t${profile.description}\n`,
      ),
    );
  });
program
  .command("report")
  .description("Reformat a JSON report")
  .argument("[file]", "JSON report file", "search-quality-report.json")
  .option("--format <format>", "console, json, markdown, or sarif", "markdown")
  .option("-o, --output <file>")
  .action(async (file, o) => {
    const r = parseSearchQualityReport(
        await readFile(path.resolve(file), "utf8"),
      ),
      report: SearchQualityReport =
        "schemaVersion" in r && r.schemaVersion === REPORT_SCHEMA_VERSION
          ? r
          : { ...r, schemaVersion: REPORT_SCHEMA_VERSION },
      rendered = renderReport(report, o.format);
    if (o.output)
      await writeFile(path.resolve(o.output), `${rendered}\n`, `utf8`);
    else process.stdout.write(`${rendered}\n`);
  });
program.parseAsync().catch((e) => {
  process.stderr.write(`search-quality-kit: ${(e as Error).message}\n`);
  process.exitCode = 2;
});
