param(
  [string]$TaskName = "SilentGardenSyncAll",
  [string]$At = "08:00",
  [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$runner = Join-Path $PSScriptRoot "run-sync-all.ps1"
if (-not (Test-Path -LiteralPath $runner)) {
  throw "Runner script not found: $runner"
}

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`" -ProjectRoot `"$ProjectRoot`""

$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Sync blog content from Obsidian and Notion" `
  -Force | Out-Null

Write-Output "Scheduled task registered:"
Write-Output "  TaskName: $TaskName"
Write-Output "  Time: $At"
Write-Output "  ProjectRoot: $ProjectRoot"

