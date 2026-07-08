#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TIME_INPUT="${1:-08:00}"
LABEL="com.silentgarden.syncall"
LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"
PLIST_PATH="${LAUNCH_AGENTS_DIR}/${LABEL}.plist"
LOG_DIR="${PROJECT_ROOT}/.codex/sync-logs"

if [[ ! "${TIME_INPUT}" =~ ^([01][0-9]|2[0-3]):([0-5][0-9])$ ]]; then
  echo "Usage: $0 HH:MM"
  echo "Example: $0 08:00"
  exit 1
fi

HOUR="${TIME_INPUT%:*}"
MINUTE="${TIME_INPUT#*:}"
HOUR_NUM=$((10#${HOUR}))
MINUTE_NUM=$((10#${MINUTE}))

mkdir -p "${LAUNCH_AGENTS_DIR}"
mkdir -p "${LOG_DIR}"

cat > "${PLIST_PATH}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${PROJECT_ROOT}/scripts/macos/run-sync-and-push.sh</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${PROJECT_ROOT}</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>

  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${HOUR_NUM}</integer>
    <key>Minute</key>
    <integer>${MINUTE_NUM}</integer>
  </dict>

  <key>StandardOutPath</key>
  <string>${LOG_DIR}/launchagent-stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/launchagent-stderr.log</string>

  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "${PLIST_PATH}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "${PLIST_PATH}"
launchctl enable "gui/$(id -u)/${LABEL}"

echo "LaunchAgent installed."
echo "label=${LABEL}"
echo "time=${TIME_INPUT}"
echo "plist=${PLIST_PATH}"
echo "manual run: launchctl kickstart -k gui/$(id -u)/${LABEL}"
echo "remove: launchctl bootout gui/$(id -u) ${PLIST_PATH} && rm -f ${PLIST_PATH}"
