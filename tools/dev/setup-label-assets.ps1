param([switch]$Force)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$modelRoot = Join-Path $root 'models\TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX'
New-Item -ItemType Directory -Force -Path (Join-Path $modelRoot 'onnx') | Out-Null

function Test-LfsPointer([string]$Path) {
  if (-not (Test-Path $Path)) { return $false }
  $fs=[IO.File]::OpenRead($Path)
  try { $buf=New-Object byte[] 96; $n=$fs.Read($buf,0,$buf.Length); return [Text.Encoding]::UTF8.GetString($buf,0,$n).StartsWith('version https://git-lfs.github.com/spec/v1') } finally { $fs.Dispose() }
}
function Save-Url([string]$Url,[string]$Path,[long]$MinBytes=1) {
  $ok=(Test-Path $Path) -and ((Get-Item $Path).Length -ge $MinBytes) -and -not (Test-LfsPointer $Path)
  if ($ok -and -not $Force) { Write-Host "[skip] $(Split-Path -Leaf $Path)"; return }
  Write-Host "[download:dev] $Url" -ForegroundColor Cyan
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Path) | Out-Null
  Invoke-WebRequest -Uri $Url -OutFile $Path -UseBasicParsing
}

# Ensure normal runtime dependencies/config are available first.
$normalSetup = Join-Path $root 'tools\setup-assets.ps1'
$args=@('-NoProfile','-ExecutionPolicy','Bypass','-File',$normalSetup)
if ($Force) { $args += '-Force' }
if ($PSVersionTable.PSEdition -eq 'Core') { & pwsh @args } else { & powershell @args }
if ($LASTEXITCODE -ne 0) { throw 'Normal asset setup failed.' }

$tiny='https://huggingface.co/onnx-community/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX/resolve/main'
foreach($item in @(
  @{Url="$tiny/tokenizer.json?download=true";Path=(Join-Path $modelRoot 'tokenizer.json');Min=64},
  @{Url="$tiny/tokenizer_config.json?download=true";Path=(Join-Path $modelRoot 'tokenizer_config.json');Min=64},
  @{Url="$tiny/special_tokens_map.json?download=true";Path=(Join-Path $modelRoot 'special_tokens_map.json');Min=32},
  @{Url="$tiny/merges.txt?download=true";Path=(Join-Path $modelRoot 'merges.txt');Min=32},
  @{Url="$tiny/vocab.json?download=true";Path=(Join-Path $modelRoot 'vocab.json');Min=64},
  @{Url="$tiny/onnx/model_quantized.onnx?download=true";Path=(Join-Path $modelRoot 'onnx\model_quantized.onnx');Min=1MB}
)) { Save-Url $item.Url $item.Path $item.Min }

Write-Host ''
Write-Host '[Smart Image Sorter] Developer label-generation assets are ready.' -ForegroundColor Green
Write-Host '[Smart Image Sorter] These files are ignored by Git and are not part of the release runtime.' -ForegroundColor Green
