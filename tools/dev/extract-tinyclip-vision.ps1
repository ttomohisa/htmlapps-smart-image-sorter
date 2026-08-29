param(
  [Parameter(Mandatory=$true)][string]$InputModel,
  [Parameter(Mandatory=$true)][string]$OutputModel,
  [string]$ReportPath
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$venv = Join-Path $root '.venv-onnx'
$venvPython = Join-Path $venv 'Scripts\python.exe'

function Get-Uv {
  $cmd = Get-Command uv -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw @"
uv was not found.
Install uv first, then rerun dev-reextract-vision-model.bat.
https://docs.astral.sh/uv/getting-started/installation/
"@
}

$uv = Get-Uv

if (-not (Test-Path $venvPython)) {
  Write-Host '[Smart Image Sorter] Creating tool venv with uv: .venv-onnx' -ForegroundColor Cyan
  & $uv venv $venv --python 3.11
  if ($LASTEXITCODE -ne 0) { throw 'uv venv failed.' }
}

& $venvPython -c "import onnx; print(onnx.__version__)" *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host '[Smart Image Sorter] Installing onnx into .venv-onnx with uv...' -ForegroundColor Cyan
  & $uv pip install --python $venvPython onnx
  if ($LASTEXITCODE -ne 0) { throw 'uv pip install onnx failed.' }
}

Write-Host '[Smart Image Sorter] TinyCLIP extraction environment is ready.' -ForegroundColor Green
$script = Join-Path $PSScriptRoot 'extract-tinyclip-vision.py'
$args = @($script, '--input', $InputModel, '--output', $OutputModel)
if ($ReportPath) { $args += @('--report', $ReportPath) }

& $venvPython @args
if ($LASTEXITCODE -ne 0) { throw 'TinyCLIP vision-only extraction failed.' }
