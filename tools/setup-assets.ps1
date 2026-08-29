param(
  [switch]$Force
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$vendorRoot = Join-Path $root 'vendor\transformers'
$tinyRoot = Join-Path $root 'models\TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX'
$visionModel = Join-Path $tinyRoot 'onnx\vision_model_quantized.onnx'
$labels = Join-Path $root 'data\fixed-label-embeddings.tinyclip-int8.generated.json'
New-Item -ItemType Directory -Force -Path $vendorRoot, (Join-Path $tinyRoot 'onnx') | Out-Null

function Get-Sha256([string]$Path) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $s = [IO.File]::OpenRead($Path)
    try { $h = $sha.ComputeHash($s) } finally { $s.Dispose() }
    return ([BitConverter]::ToString($h)).Replace('-','').ToLowerInvariant()
  } finally { $sha.Dispose() }
}
function Test-LfsPointer([string]$Path) {
  if (-not (Test-Path $Path)) { return $false }
  $fs = [IO.File]::OpenRead($Path)
  try {
    $buf = New-Object byte[] 96
    $n = $fs.Read($buf,0,$buf.Length)
    $head = [Text.Encoding]::UTF8.GetString($buf,0,$n)
    return $head.StartsWith('version https://git-lfs.github.com/spec/v1')
  } finally { $fs.Dispose() }
}
function Assert-RepoAsset([string]$Path, [long]$MinBytes, [string]$Name) {
  if (-not (Test-Path $Path)) {
    throw "$Name is missing from the repository: $Path`nRestore the committed asset before building."
  }
  if (Test-LfsPointer $Path) {
    throw "$Name is a Git LFS pointer, but this project now commits the release ONNX directly: $Path"
  }
  $size = (Get-Item $Path).Length
  if ($size -lt $MinBytes) { throw "$Name is unexpectedly small: $size bytes ($Path)" }
}
function Save-Url([string]$Url, [string]$Path, [long]$MinBytes = 1) {
  $existingOk = (Test-Path $Path) -and ((Get-Item $Path).Length -ge $MinBytes) -and -not (Test-LfsPointer $Path)
  if ((-not $Force) -and $existingOk) {
    Write-Host "[skip] $(Split-Path -Leaf $Path)"
    return
  }
  Write-Host "[download] $Url" -ForegroundColor Cyan
  $dir = Split-Path -Parent $Path
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  Invoke-WebRequest -Uri $Url -OutFile $Path -UseBasicParsing
}

# These two release assets are committed to the repository. Normal setup never rebuilds them.
Assert-RepoAsset $visionModel 1MB 'TinyCLIP vision-only model'
Assert-RepoAsset $labels 1024 'Fixed label embeddings'
$expectedModelSha = 'bbf8426b0e548881dcfd9257030dd6139fceeeb4808994968b882ecc3ada291f'
$actualModelSha = Get-Sha256 $visionModel
if ($actualModelSha -ne $expectedModelSha) {
  throw "Committed TinyCLIP model SHA-256 does not match the release manifest.`nExpected: $expectedModelSha`nActual:   $actualModelSha"
}

# Browser runtime dependencies. These remain setup-time downloads to keep the repository small.
$transformersVersion = '3.8.1'
$ortVersion = '1.22.0-dev.20250409-89f8206ba4'
Save-Url "https://cdn.jsdelivr.net/npm/@huggingface/transformers@$transformersVersion/dist/transformers.min.js" (Join-Path $vendorRoot 'transformers.min.js') 1024
Save-Url "https://cdn.jsdelivr.net/npm/@huggingface/transformers@$transformersVersion/LICENSE" (Join-Path $vendorRoot 'TRANSFORMERS-LICENSE') 32
Save-Url "https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/$ortVersion/ort-wasm-simd-threaded.mjs" (Join-Path $vendorRoot 'ort-wasm-simd-threaded.mjs') 1024
Save-Url "https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/$ortVersion/ort-wasm-simd-threaded.wasm" (Join-Path $vendorRoot 'ort-wasm-simd-threaded.wasm') 1024
if (-not (Test-Path (Join-Path $vendorRoot 'ONNXRUNTIME-LICENSE'))) {
  "onnxruntime-web is distributed under the MIT License.`nSee: https://github.com/microsoft/onnxruntime/blob/main/LICENSE`n" | Set-Content -Path (Join-Path $vendorRoot 'ONNXRUNTIME-LICENSE') -Encoding UTF8
}

# TinyCLIP runtime metadata required by Transformers.js. No full model or tokenizer is downloaded here.
$tinyOnnx = 'https://huggingface.co/onnx-community/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX/resolve/main'
foreach ($item in @(
  @{ Url = "$tinyOnnx/config.json?download=true"; Path = (Join-Path $tinyRoot 'config.json'); Min = 64 },
  @{ Url = "$tinyOnnx/preprocessor_config.json?download=true"; Path = (Join-Path $tinyRoot 'preprocessor_config.json'); Min = 64 },
  @{ Url = 'https://raw.githubusercontent.com/wkcn/TinyCLIP/main/LICENSE'; Path = (Join-Path $tinyRoot 'LICENSE'); Min = 32 }
)) { Save-Url $item.Url $item.Path $item.Min }

Write-Host ''
Write-Host '[Smart Image Sorter] Release assets are ready.' -ForegroundColor Green
Write-Host '[Smart Image Sorter] Prebuilt TinyCLIP vision-only model: repository copy' -ForegroundColor Green
Write-Host '[Smart Image Sorter] Precomputed label embeddings: repository copy' -ForegroundColor Green
Write-Host '[Smart Image Sorter] No Python / uv / ONNX extraction is used by the normal build.' -ForegroundColor Green
