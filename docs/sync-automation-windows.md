# Windows Sync Automation

## One-click manual sync

In project root:

```powershell
npm run sync:all
```

This command runs:

1. Obsidian sync + frontmatter validation
2. Notion books sync
3. Notion projects sync
4. Notion blog sync with `--clean` (remove stale generated `notion-*.md`)
5. Notion diary sync with `--clean` (remove stale generated `notion-*.md`)

## Scheduled sync (Task Scheduler)

### Register a daily task (default 08:00)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\register-sync-task.ps1
```

### Register at custom time

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\register-sync-task.ps1 -At "22:30"
```

### Run task manually once

```powershell
Start-ScheduledTask -TaskName "SilentGardenSyncAll"
```

### Remove task

```powershell
Unregister-ScheduledTask -TaskName "SilentGardenSyncAll" -Confirm:$false
```

## Log output

Task script writes logs to:

```text
.codex/sync-logs/sync-all-YYYYMMDD-HHMMSS.log
```

