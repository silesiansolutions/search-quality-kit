#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { checkCatalog } from "../checks/index.js";
import { CONFIG_FILE_TEMPLATE } from "../config/loadConfig.js";
import { runVerification, shouldFail } from "../engine/verify.js";
import { formatConsoleReport } from "../report/formatConsoleReport.js";
import { formatJsonReport } from "../report/formatJsonReport.js";
import { formatMarkdownReport } from "../report/formatMarkdownReport.js";
import { newFindings } from "../report/baseline.js";
import type { SearchQualityReport } from "../report/types.js";
import { fileExists } from "../utils/files.js";
import { VERSION } from "../version.js";
const program = new Command();
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
  .option("--format <format>", "console, json, or markdown")
  .option("-o, --output <file>", "write report to a file")
  .option("--skip-build", "skip build.command")
  .action(async (o) => {
    if (o.failOnNew && !o.baseline)
      throw new Error("--fail-on-new requires --baseline <file>");
    const { report, config } = await runVerification({
        root: o.root,
        configPath: o.config,
        skipBuild: o.skipBuild,
      }),
      format = o.json ? "json" : (o.format ?? config.output.format);
    if (!["console", "json", "markdown"].includes(format))
      throw new Error(`Unknown report format: ${format}`);
    const rendered =
      format === "json"
        ? formatJsonReport(report)
        : format === "markdown"
          ? formatMarkdownReport(report)
          : formatConsoleReport(report);
    if (o.output)
      await writeFile(path.resolve(o.root, o.output), `${rendered}\n`, "utf8");
    else process.stdout.write(`${rendered}\n`);
    const baseline = o.baseline
      ? (JSON.parse(
          await readFile(path.resolve(o.root, o.baseline), "utf8"),
        ) as SearchQualityReport)
      : undefined;
    const failureCandidates =
      o.failOnNew && baseline ? newFindings(report, baseline) : report.findings;
    if (shouldFail(report, config, o.reportOnly, failureCandidates))
      process.exitCode = 1;
  });
program
  .command("init")
  .description("Create a typed example config")
  .option("--root <directory>", "target project root", process.cwd())
  .option("--force", "overwrite existing config")
  .action(async (o) => {
    const dest = path.resolve(o.root, "search-quality.config.ts");
    if ((await fileExists(dest)) && !o.force)
      throw new Error(
        `Config already exists: ${dest}. Use --force to replace it.`,
      );
    await writeFile(dest, CONFIG_FILE_TEMPLATE, "utf8");
    process.stdout.write(`Created ${dest}\n`);
  });
program
  .command("list-checks")
  .description("List built-in checks")
  .action(() => {
    process.stdout.write("ID\tSEVERITIES\tBASIS\tDESCRIPTION\n");
    checkCatalog.forEach((check) =>
      process.stdout.write(
        `${check.id}\t${check.severities.join(",")}\t${check.basis.join(", ")}\t${check.description}\n`,
      ),
    );
  });
program
  .command("report")
  .description("Reformat a JSON report")
  .argument("[file]", "JSON report file", "search-quality-report.json")
  .option("--format <format>", "console, json, or markdown", "markdown")
  .option("-o, --output <file>")
  .action(async (file, o) => {
    const r = JSON.parse(
        await readFile(path.resolve(file), "utf8"),
      ) as SearchQualityReport,
      rendered =
        o.format === "json"
          ? formatJsonReport(r)
          : o.format === "console"
            ? formatConsoleReport(r)
            : formatMarkdownReport(r);
    if (o.output)
      await writeFile(path.resolve(o.output), `${rendered}\n`, `utf8`);
    else process.stdout.write(`${rendered}\n`);
  });
program.parseAsync().catch((e) => {
  process.stderr.write(`search-quality-kit: ${(e as Error).message}\n`);
  process.exitCode = 2;
});
