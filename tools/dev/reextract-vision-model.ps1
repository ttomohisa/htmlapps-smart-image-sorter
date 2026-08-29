param([switch]$ForceAssets)
$ErrorActionPreference='Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$modelRoot = Join-Path $root 'models\TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX'
$full = Join-Path $modelRoot 'onnx\model_quantized.onnx'
$out = Join-Path $modelRoot 'onnx\vision_model_quantized.onnx'
$report = Join-Path $modelRoot 'onnx\vision_model_quantized.report.json'

$setupArgs=@('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'setup-label-assets.ps1'))
if ($ForceAssets) { $setupArgs += '-Force' }
if ($PSVersionTable.PSEdition -eq 'Core') { & pwsh @setupArgs } else { & powershell @setupArgs }
if ($LASTEXITCODE -ne 0) { throw 'Developer asset setup failed.' }

$extractArgs=@('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'extract-tinyclip-vision.ps1'),'-InputModel',$full,'-OutputModel',$out,'-ReportPath',$report)
if ($PSVersionTable.PSEdition -eq 'Core') { & pwsh @extractArgs } else { & powershell @extractArgs }
if ($LASTEXITCODE -ne 0) { throw 'Vision-model extraction failed.' }

Write-Host ''
Write-Host '[Smart Image Sorter] Vision-only model re-extracted.' -ForegroundColor Green
Write-Host 'IMPORTANT: update the expected model SHA-256 in tools\setup-assets.ps1, tools\build-standalone.ps1, and model-manifest.json before committing.' -ForegroundColor Yellow
