param(
  [string]$ProjectRoot = "",
  [string]$LogDir = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

if ([string]::IsNullOrWhiteSpace($LogDir)) {
  $LogDir = Join-Path $ProjectRoot ".codex\sync-logs"
}

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $LogDir "sync-all-$timestamp.log"

Push-Location -LiteralPath $ProjectRoot
try {
  "[$(Get-Date -Format s)] sync start" | Tee-Object -FilePath $logPath
  npm run sync:all 2>&1 | Tee-Object -FilePath $logPath -Append

  if ($LASTEXITCODE -ne 0) {
    throw "sync:all failed with exit code $LASTEXITCODE."
  }

  "[$(Get-Date -Format s)] sync success" | Tee-Object -FilePath $logPath -Append
  Write-Output "Sync log: $logPath"
} catch {
  "[$(Get-Date -Format s)] sync failed: $($_.Exception.Message)" | Tee-Object -FilePath $logPath -Append
  Write-Error "Sync failed. See log: $logPath"
  exit 1
} finally {
  Pop-Location
}
