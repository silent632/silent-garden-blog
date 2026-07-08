#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
GH_BIN="${GH_BIN:-${PROJECT_ROOT}/.tools/gh/extracted-ok/gh_2.89.0_macOS_arm64/bin/gh}"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.dev.vars}"
REPO="${REPO:-silent632/silent-garden-blog}"

required_keys=(
  NOTION_TOKEN
  NOTION_DATABASE_ID
  NOTION_PROJECTS_DATABASE_ID
  NOTION_BLOG_DATABASE_ID
  NOTION_DIARY_DATABASE_ID
)

if [[ ! -x "${GH_BIN}" ]]; then
  echo "gh binary not found or not executable: ${GH_BIN}"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "env file not found: ${ENV_FILE}"
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

for key in "${required_keys[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "missing required env value: ${key}"
    exit 1
  fi
done

"${GH_BIN}" auth status >/dev/null

for key in "${required_keys[@]}"; do
  "${GH_BIN}" secret set "${key}" --repo "${REPO}" --body "${!key}"
  echo "set ${key}"
done

echo "all GitHub Actions secrets updated for ${REPO}"
