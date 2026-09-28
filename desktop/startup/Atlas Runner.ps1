$ErrorActionPreference = 'Stop'
$atlasRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$logRoot = Join-Path $atlasRoot '.atlas-desktop-data'
$logPath = Join-Path $logRoot 'startup.log'

New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
function Write-AtlasLog([string]$message) {
  Add-Content -LiteralPath $logPath -Value "$(Get-Date -Format o) $message"
}

try {
  if (-not (Test-Path -LiteralPath (Join-Path $atlasRoot 'desktop\main.cjs'))) { throw "Atlas desktop files are missing from $atlasRoot" }
  $node = Get-Command node.exe -ErrorAction Stop
  $launcher = Join-Path $atlasRoot 'desktop\dev.cjs'
  Write-AtlasLog "Starting Atlas from $atlasRoot"
  $process = Start-Process -FilePath $node.Source -ArgumentList @($launcher) -WorkingDirectory $atlasRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'desktop.out.log') -RedirectStandardError (Join-Path $logRoot 'desktop.error.log') -PassThru
  Write-AtlasLog "Atlas launcher started with PID $($process.Id)"
} catch {
  Write-AtlasLog "Startup failed: $($_.Exception.Message)"
  exit 1
}
