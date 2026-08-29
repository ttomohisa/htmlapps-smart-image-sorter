param([switch]$ForceAssets)
$ErrorActionPreference='Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

$setupArgs=@('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'setup-label-assets.ps1'))
if ($ForceAssets) { $setupArgs += '-Force' }
if ($PSVersionTable.PSEdition -eq 'Core') { & pwsh @setupArgs } else { & powershell @setupArgs }
if ($LASTEXITCODE -ne 0) { throw 'Developer asset setup failed.' }

$genArgs=@('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'generate-label-embeddings.ps1'),'-Force')
if ($PSVersionTable.PSEdition -eq 'Core') { & pwsh @genArgs } else { & powershell @genArgs }
if ($LASTEXITCODE -ne 0) { throw 'Label embedding generation failed.' }

Write-Host ''
Write-Host '[Smart Image Sorter] Label embeddings updated.' -ForegroundColor Green
Write-Host 'Next: run build-standalone.bat and commit data\fixed-label-embeddings.tinyclip-int8.generated.json.' -ForegroundColor Green
