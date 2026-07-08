#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOG_DIR="${LOG_DIR:-${PROJECT_ROOT}/.codex/sync-logs}"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
LOG_PATH="${LOG_DIR}/sync-and-push-${TIMESTAMP}.log"
COMMIT_MESSAGE="${SYNC_COMMIT_MESSAGE:-chore(sync): update content}"
VALIDATE_BUILD="${VALIDATE_BUILD:-true}"

SYNC_TARGETS=(
  "src/content/blog"
  "src/content/notes"
  "src/content/diary"
  "src/data/books"
  "src/data/projects"
)

mkdir -p "${LOG_DIR}"

exec > >(tee -a "${LOG_PATH}") 2>&1

echo "[$(date -Iseconds)] sync-and-push start"
echo "project_root=${PROJECT_ROOT}"

cd "${PROJECT_ROOT}"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required but not found."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but not found."
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Current directory is not a git repository."
  exit 1
fi

if ! git diff --quiet -- "${SYNC_TARGETS[@]}"; then
  echo "Refusing to run: sync target paths already have unstaged changes."
  echo "Please commit, stash, or discard changes under sync-managed paths first."
  exit 1
fi

if ! git diff --cached --quiet -- "${SYNC_TARGETS[@]}"; then
  echo "Refusing to run: sync target paths already have staged changes."
  echo "Please commit or unstage those changes first."
  exit 1
fi

UNTRACKED_TARGETS="$(git ls-files --others --exclude-standard -- "${SYNC_TARGETS[@]}")"
if [[ -n "${UNTRACKED_TARGETS}" ]]; then
  echo "Refusing to run: sync target paths already contain untracked files."
  echo "${UNTRACKED_TARGETS}"
  exit 1
fi

echo "[$(date -Iseconds)] running npm run sync:all"
npm run sync:all

if [[ "${VALIDATE_BUILD}" == "true" ]]; then
  echo "[$(date -Iseconds)] running npm run build"
  npm run build
fi

echo "[$(date -Iseconds)] staging synced content"
git add -- "${SYNC_TARGETS[@]}"

if git diff --cached --quiet -- "${SYNC_TARGETS[@]}"; then
  echo "No synced content changes detected."
  echo "[$(date -Iseconds)] sync-and-push success"
  exit 0
fi

echo "[$(date -Iseconds)] committing changes"
git commit -m "${COMMIT_MESSAGE}"

echo "[$(date -Iseconds)] pushing changes"
git push

echo "[$(date -Iseconds)] sync-and-push success"
echo "log_path=${LOG_PATH}"
