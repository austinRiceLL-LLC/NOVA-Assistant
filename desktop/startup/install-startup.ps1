$ErrorActionPreference = 'Stop'
$startup = [Environment]::GetFolderPath('Startup')
$runner = (Resolve-Path (Join-Path $PSScriptRoot 'Atlas Runner.ps1')).Path
$legacy = @('NOVA Runner.ps1', 'NOVA Work Intelligence.vbs')

foreach ($name in $legacy) {
  $path = Join-Path $startup $name
  if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
}

$launcherPath = Join-Path $startup 'Atlas Companion.vbs'
$escapedRunner = $runner.Replace('"', '""')
$launcher = @"
Set shell = CreateObject("WScript.Shell")
command = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""$escapedRunner"""
shell.Run command, 0, False
"@
[IO.File]::WriteAllText($launcherPath, $launcher, [Text.UTF8Encoding]::new($false))
Write-Output "Installed Atlas startup launcher: $launcherPath"
