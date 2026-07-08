#!/usr/bin/env bash
set -euo pipefail

package_manager="${SQK_PACKAGE_MANAGER:-npm}"
working_directory="${SQK_WORKING_DIRECTORY:-.}"
config="${SQK_CONFIG:-search-quality.config.ts}"
output_directory="${SQK_OUTPUT_DIR:-search-quality-reports}"

case "$package_manager" in
  npm) cli=(npx --no-install search-quality-kit) ;;
  pnpm) cli=(pnpm exec search-quality-kit) ;;
  yarn) cli=(yarn exec search-quality-kit) ;;
  *)
    echo "search-quality-kit action: package-manager must be npm, pnpm, or yarn." >&2
    exit 2
    ;;
esac

if [[ "${SQK_FAIL_ON_NEW:-false}" == "true" && -z "${SQK_BASELINE:-}" ]]; then
  echo "search-quality-kit action: fail-on-new=true requires baseline." >&2
  exit 2
fi

cd -- "$working_directory"

if [[ -n "${SQK_INSTALL_COMMAND:-}" ]]; then
  bash -euo pipefail -c "$SQK_INSTALL_COMMAND"
fi

if [[ -n "${SQK_BUILD_COMMAND:-}" ]]; then
  bash -euo pipefail -c "$SQK_BUILD_COMMAND"
fi

mkdir -p -- "$output_directory"
output_directory="$(cd -- "$output_directory" && pwd)"
json_report="$output_directory/search-quality-report.json"
markdown_report="$output_directory/search-quality-report.md"
sarif_report="$output_directory/search-quality-report.sarif"

verify_args=(verify --config "$config" --json --output "$json_report")
if [[ -n "${SQK_BUILD_COMMAND:-}" ]]; then
  verify_args+=(--skip-build)
fi
if [[ "${SQK_REPORT_ONLY:-false}" == "true" ]]; then
  verify_args+=(--report-only)
fi
if [[ -n "${SQK_BASELINE:-}" ]]; then
  verify_args+=(--baseline "$SQK_BASELINE")
fi
if [[ "${SQK_FAIL_ON_NEW:-false}" == "true" ]]; then
  verify_args+=(--fail-on-new)
fi

set +e
"${cli[@]}" "${verify_args[@]}"
exit_code=$?
set -e

if [[ -f "$json_report" ]]; then
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
    if [[ "${SQK_SARIF:-false}" == "true" ]]; then
      echo "sarif-report=$sarif_report"
    else
      echo "sarif-report="
    fi
    echo "artifact-path=$output_directory"
  } >> "$GITHUB_OUTPUT"
fi

exit "$exit_code"
