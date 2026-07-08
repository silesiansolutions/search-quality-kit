import { execFile } from "node:child_process";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");

describe("GitHub Action wrapper", () => {
  it("has valid composite-action metadata and the supported inputs", async () => {
    const source = await readFile(path.join(root, "action/action.yml"), "utf8"),
      action = parse(source) as {
        inputs: Record<string, unknown>;
        outputs: Record<string, unknown>;
        runs: { using: string; steps: Array<{ uses?: string }> };
      };
    expect(action.runs.using).toBe("composite");
    expect(Object.keys(action.inputs)).toEqual(
      expect.arrayContaining([
        "mode",
        "config",
        "portfolio-config",
        "report-only",
        "baseline",
        "fail-on-new",
        "output-dir",
        "summary",
        "upload-artifact",
        "node-version",
        "node-version-file",
        "package-manager",
        "install-command",
        "build-command",
      ]),
    );
    expect(action.runs.steps.map((step) => step.uses).filter(Boolean)).toEqual([
      "actions/setup-node@v6",
      "actions/setup-node@v6",
      "actions/upload-artifact@v7",
    ]);
    expect(action.outputs).toHaveProperty("json-report");
    expect(action.outputs).toHaveProperty("markdown-report");
  });

  it("passes shell syntax validation", async () => {
    await expect(
      exec("bash", ["-n", path.join(root, "action/run.sh")]),
    ).resolves.toBeDefined();
  });

  it("uses the built local CLI when the Action runs inside this package repository", async () => {
    const temporary = await mkdtemp(path.join(tmpdir(), "sqk-action-local-")),
      bin = path.join(temporary, "bin"),
      project = path.join(temporary, "project"),
      cliDirectory = path.join(project, "dist/cli"),
      summary = path.join(temporary, "summary.md"),
      output = path.join(temporary, "github-output.txt"),
      calls = path.join(temporary, "calls.txt");
    await mkdir(bin);
    await mkdir(cliDirectory, { recursive: true });
    await writeFile(
      path.join(project, "package.json"),
      JSON.stringify({ name: "@silesiansolutions/search-quality-kit" }),
    );
    await writeFile(
      path.join(cliDirectory, "index.js"),
      `const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_CALLS, args.join(" ") + "\\n");
const outputDirectory = args[args.indexOf("--output-dir") + 1];
fs.mkdirSync(path.join(outputDirectory, "site-a"), { recursive: true });
fs.writeFileSync(path.join(outputDirectory, "portfolio.json"), '{"schemaVersion":"0.7"}\\n');
fs.writeFileSync(path.join(outputDirectory, "portfolio.md"), '# Search Quality Portfolio Report\\n\\nLocal CLI.\\n');
`,
    );
    await writeFile(
      path.join(bin, "npx"),
      `#!/usr/bin/env bash
echo "unexpected npx" >&2
exit 99
`,
    );
    await chmod(path.join(bin, "npx"), 0o755);
    try {
      await exec("bash", [path.join(root, "action/run.sh")], {
        cwd: root,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          SQK_MODE: "portfolio",
          SQK_PACKAGE_MANAGER: "npm",
          SQK_WORKING_DIRECTORY: project,
          SQK_PORTFOLIO_CONFIG: "portfolio.search-quality.config.ts",
          SQK_OUTPUT_DIR: "reports",
          SQK_SUMMARY: "true",
          FAKE_CALLS: calls,
          GITHUB_STEP_SUMMARY: summary,
          GITHUB_OUTPUT: output,
        },
      });
      await expect(readFile(calls, "utf8")).resolves.toContain(
        "portfolio verify --config portfolio.search-quality.config.ts",
      );
      await expect(
        readFile(path.join(project, "reports/portfolio.json"), "utf8"),
      ).resolves.toContain('"schemaVersion":"0.7"');
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it("generates reports and preserves the CLI exit code", async () => {
    const temporary = await mkdtemp(path.join(tmpdir(), "sqk-action-")),
      bin = path.join(temporary, "bin"),
      project = path.join(temporary, "project"),
      summary = path.join(temporary, "summary.md"),
      output = path.join(temporary, "github-output.txt"),
      calls = path.join(temporary, "calls.txt");
    await mkdir(bin);
    await mkdir(project);
    const fakeNpx = path.join(bin, "npx");
    await writeFile(
      fakeNpx,
      `#!/usr/bin/env bash
set -euo pipefail
echo "$*" >> "$FAKE_CALLS"
shift 2
command="$1"
shift
subcommand=""
if [[ "$command" == "portfolio" ]]; then
  subcommand="$1"
  shift
fi
output=""
output_directory=""
format=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) output="$2"; shift 2 ;;
    --output-dir) output_directory="$2"; shift 2 ;;
    --format) format="$2"; shift 2 ;;
    *) shift ;;
  esac
done
if [[ "$command" == "portfolio" && "$subcommand" == "verify" ]]; then
  mkdir -p "$output_directory/site-a"
  printf '%s\n' '{"schemaVersion":"0.7","tool":{"name":"@silesiansolutions/search-quality-kit","version":"0.7.0"},"generatedAt":"2026-07-08T00:00:00.000Z","portfolio":{"sitesTotal":1,"sitesPassed":0,"sitesFailed":1,"sitesSkipped":0,"totalPages":1,"totalFindings":1,"newFindings":1,"resolvedFindings":0,"errors":1,"warnings":0,"infos":0,"operationalErrors":0},"sites":[],"highlights":{"newFindings":[],"errors":[],"warnings":[],"resolved":[]},"gate":{"status":"failed","reportOnly":false,"failOn":["error"],"failOnNew":true,"reason":"failed","failures":[]}}' > "$output_directory/portfolio.json"
  printf '# Search Quality Portfolio Report\n\nSmoke portfolio report.\n' > "$output_directory/portfolio.md"
  printf '%s\n' '{}' > "$output_directory/site-a/search-quality-report.json"
  exit "\${FAKE_VERIFY_EXIT:-0}"
fi
if [[ "$command" == "verify" ]]; then
  printf '%s\n' '{"schemaVersion":"0.3","tool":"search-quality-kit","version":"0.6.0","generatedAt":"2026-07-08T00:00:00.000Z","mode":"static","target":"dist","summary":{"checkedPages":1,"errors":1,"warnings":0,"info":0},"findings":[],"pages":[],"durationMs":1}' > "$output"
  exit "\${FAKE_VERIFY_EXIT:-0}"
fi
if [[ "$format" == "markdown" ]]; then
  printf '# Search Quality Report\n\nSmoke report.\n' > "$output"
else
  printf '%s\n' '{"version":"2.1.0","runs":[]}' > "$output"
fi
`,
    );
    await chmod(fakeNpx, 0o755);
    try {
      let failure: unknown;
      try {
        await exec("bash", [path.join(root, "action/run.sh")], {
          cwd: root,
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            SQK_PACKAGE_MANAGER: "npm",
            SQK_WORKING_DIRECTORY: project,
            SQK_CONFIG: "search-quality.config.ts",
            SQK_OUTPUT_DIR: "reports",
            SQK_REPORT_ONLY: "false",
            SQK_FAIL_ON_NEW: "false",
            SQK_SUMMARY: "true",
            SQK_SARIF: "true",
            FAKE_VERIFY_EXIT: "1",
            FAKE_CALLS: calls,
            GITHUB_STEP_SUMMARY: summary,
            GITHUB_OUTPUT: output,
          },
        });
      } catch (error) {
        failure = error;
      }
      expect(failure).toMatchObject({ code: 1 });
      await expect(
        readFile(
          path.join(project, "reports/search-quality-report.json"),
          "utf8",
        ),
      ).resolves.toContain('"schemaVersion":"0.3"');
      await expect(
        readFile(
          path.join(project, "reports/search-quality-report.md"),
          "utf8",
        ),
      ).resolves.toContain("Search Quality Report");
      await expect(
        readFile(
          path.join(project, "reports/search-quality-report.sarif"),
          "utf8",
        ),
      ).resolves.toContain('"version":"2.1.0"');
      await expect(readFile(summary, "utf8")).resolves.toContain(
        "## Search Quality Report",
      );
      await expect(readFile(output, "utf8")).resolves.toContain(
        "artifact-path=",
      );
      const invocations = await readFile(calls, "utf8");
      expect(invocations).toContain(
        "--no-install search-quality-kit verify --config search-quality.config.ts",
      );
      expect(invocations).toContain("search-quality-kit report");
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it("runs portfolio mode, uploads the whole directory, and preserves its gate", async () => {
    const temporary = await mkdtemp(
        path.join(tmpdir(), "sqk-action-portfolio-"),
      ),
      bin = path.join(temporary, "bin"),
      project = path.join(temporary, "project"),
      summary = path.join(temporary, "summary.md"),
      output = path.join(temporary, "github-output.txt"),
      calls = path.join(temporary, "calls.txt");
    await mkdir(bin);
    await mkdir(project);
    const fakeNpx = path.join(bin, "npx");
    await writeFile(
      fakeNpx,
      `#!/usr/bin/env bash
set -euo pipefail
echo "$*" >> "$FAKE_CALLS"
shift 2
[[ "$1" == "portfolio" && "$2" == "verify" ]]
shift 2
output_directory=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output-dir) output_directory="$2"; shift 2 ;;
    *) shift ;;
  esac
done
mkdir -p "$output_directory/site-a"
printf '%s\n' '{"schemaVersion":"0.7"}' > "$output_directory/portfolio.json"
printf '# Search Quality Portfolio Report\n\nSmoke portfolio report.\n' > "$output_directory/portfolio.md"
printf '%s\n' '{}' > "$output_directory/site-a/search-quality-report.json"
exit 1
`,
    );
    await chmod(fakeNpx, 0o755);
    try {
      let failure: unknown;
      try {
        await exec("bash", [path.join(root, "action/run.sh")], {
          cwd: root,
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            SQK_MODE: "portfolio",
            SQK_PACKAGE_MANAGER: "npm",
            SQK_WORKING_DIRECTORY: project,
            SQK_PORTFOLIO_CONFIG: "portfolio.search-quality.config.ts",
            SQK_OUTPUT_DIR: "reports",
            SQK_REPORT_ONLY: "false",
            SQK_FAIL_ON_NEW: "true",
            SQK_SUMMARY: "true",
            SQK_SARIF: "true",
            FAKE_CALLS: calls,
            GITHUB_STEP_SUMMARY: summary,
            GITHUB_OUTPUT: output,
          },
        });
      } catch (error) {
        failure = error;
      }
      expect(failure).toMatchObject({ code: 1 });
      await expect(
        readFile(path.join(project, "reports/portfolio.json"), "utf8"),
      ).resolves.toContain('"schemaVersion":"0.7"');
      await expect(readFile(summary, "utf8")).resolves.toContain(
        "## Search Quality Portfolio Report",
      );
      await expect(readFile(output, "utf8")).resolves.toContain(
        `json-report=${path.join(project, "reports/portfolio.json")}`,
      );
      const invocations = await readFile(calls, "utf8");
      expect(invocations).toContain(
        "search-quality-kit portfolio verify --config portfolio.search-quality.config.ts",
      );
      expect(invocations).toContain("--fail-on-new");
      expect(invocations).toContain("--sarif");
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
});
