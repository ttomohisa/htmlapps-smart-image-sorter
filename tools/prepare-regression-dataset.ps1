$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$defsPath = Join-Path $root 'data\fixed-label-prototypes.json'
$outRoot = Join-Path $root 'tests\accuracy\local-samples'
$defs = Get-Content -Raw -Encoding UTF8 $defsPath | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
foreach ($category in $defs.categories) {
  $dir = Join-Path $outRoot $category.key
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
}
Write-Host '[Smart Image Sorter] Regression dataset folders are ready.' -ForegroundColor Green
Write-Host $outRoot
Write-Host ("Categories: {0}" -f @($defs.categories).Count)
Write-Host 'Add at least 5 representative images to each category folder.'
