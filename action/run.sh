#!/usr/bin/env bash
set -euo pipefail

package_manager="${SQK_PACKAGE_MANAGER:-npm}"
mode="${SQK_MODE:-site}"
working_directory="${SQK_WORKING_DIRECTORY:-.}"
config="${SQK_CONFIG:-search-quality.config.ts}"
portfolio_config="${SQK_PORTFOLIO_CONFIG:-portfolio.search-quality.config.ts}"
output_directory="${SQK_OUTPUT_DIR:-search-quality-reports}"

case "$package_manager" in
  npm) package_cli=(npx --no-install search-quality-kit) ;;
  pnpm) package_cli=(pnpm exec search-quality-kit) ;;
  yarn) package_cli=(yarn exec search-quality-kit) ;;
  *)
    echo "search-quality-kit action: package-manager must be npm, pnpm, or yarn." >&2
    exit 2
    ;;
esac

if [[ "$mode" != "site" && "$mode" != "portfolio" ]]; then
  echo "search-quality-kit action: mode must be site or portfolio." >&2
  exit 2
fi

if [[ "$mode" == "site" && "${SQK_FAIL_ON_NEW:-false}" == "true" && -z "${SQK_BASELINE:-}" ]]; then
  echo "search-quality-kit action: fail-on-new=true requires baseline." >&2
  exit 2
fi
if [[ "$mode" == "portfolio" && -n "${SQK_BASELINE:-}" ]]; then
  echo "search-quality-kit action: baseline is configured per site in portfolio mode; remove the baseline input." >&2
  exit 2
fi

cd -- "$working_directory"

if [[ -n "${SQK_INSTALL_COMMAND:-}" ]]; then
  bash -euo pipefail -c "$SQK_INSTALL_COMMAND"
fi

if [[ -n "${SQK_BUILD_COMMAND:-}" ]]; then
  bash -euo pipefail -c "$SQK_BUILD_COMMAND"
fi

cli=("${package_cli[@]}")
if [[ -f "package.json" && -f "dist/cli/index.js" ]]; then
  package_name="$(node -e "try { process.stdout.write(require('./package.json').name || '') } catch { }")"
  if [[ "$package_name" == "@silesiansolutions/search-quality-kit" ]]; then
    cli=(node "$(pwd)/dist/cli/index.js")
  fi
fi

mkdir -p -- "$output_directory"
output_directory="$(cd -- "$output_directory" && pwd)"
if [[ "$mode" == "portfolio" ]]; then
  json_report="$output_directory/portfolio.json"
  markdown_report="$output_directory/portfolio.md"
  sarif_report=""
  verify_args=(portfolio verify --config "$portfolio_config" --output-dir "$output_directory")
  if [[ "${SQK_SARIF:-false}" == "true" ]]; then
    verify_args+=(--sarif)
  fi
else
  json_report="$output_directory/search-quality-report.json"
  markdown_report="$output_directory/search-quality-report.md"
  sarif_report="$output_directory/search-quality-report.sarif"
  verify_args=(verify --config "$config" --json --output "$json_report")
fi
if [[ -n "${SQK_BUILD_COMMAND:-}" ]]; then
  verify_args+=(--skip-build)
fi
if [[ "${SQK_REPORT_ONLY:-false}" == "true" ]]; then
  verify_args+=(--report-only)
fi
if [[ "$mode" == "site" && -n "${SQK_BASELINE:-}" ]]; then
  verify_args+=(--baseline "$SQK_BASELINE")
fi
if [[ "${SQK_FAIL_ON_NEW:-false}" == "true" ]]; then
  verify_args+=(--fail-on-new)
fi

set +e
"${cli[@]}" "${verify_args[@]}"
exit_code=$?
set -e

if [[ "$mode" == "site" && -f "$json_report" ]]; then
  set +e
  "${cli[@]}" report "$json_report" --format markdown --output "$markdown_report"
  report_exit=$?
  set -e
  if [[ $report_exit -ne 0 && $exit_code -eq 0 ]]; then
    exit_code=$report_exit
  fi

  if [[ "${SQK_SARIF:-false}" == "true" ]]; then
    set +e
    "${cli[@]}" report "$json_report" --format sarif --output "$sarif_report"
    sarif_exit=$?
    set -e
    if [[ $sarif_exit -ne 0 && $exit_code -eq 0 ]]; then
      exit_code=$sarif_exit
    fi
  fi
fi

if [[ "${SQK_SUMMARY:-true}" == "true" && -f "$markdown_report" && -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  printf '\n' >> "$GITHUB_STEP_SUMMARY"
  sed -e 's/^# /## /' "$markdown_report" >> "$GITHUB_STEP_SUMMARY"
  printf '\n' >> "$GITHUB_STEP_SUMMARY"
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "json-report=$json_report"
    echo "markdown-report=$markdown_report"
    if [[ "$mode" == "site" && "${SQK_SARIF:-false}" == "true" ]]; then
      echo "sarif-report=$sarif_report"
    else
      echo "sarif-report="
    fi
    echo "artifact-path=$output_directory"
  } >> "$GITHUB_OUTPUT"
fi

exit "$exit_code"
