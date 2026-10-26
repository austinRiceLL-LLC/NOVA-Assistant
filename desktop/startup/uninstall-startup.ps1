$ErrorActionPreference = 'Stop'
$launcher = Join-Path ([Environment]::GetFolderPath('Startup')) 'Atlas Companion.vbs'
if (Test-Path -LiteralPath $launcher) { Remove-Item -LiteralPath $launcher -Force }
Write-Output 'Atlas startup launcher removed.'
