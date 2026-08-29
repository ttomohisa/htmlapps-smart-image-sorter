param(
  [string]$OutputPath
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $OutputPath) { $OutputPath = Join-Path $root 'index.html' }
$distDir = Join-Path $root 'dist'
New-Item -ItemType Directory -Force -Path $distDir | Out-Null

$modelRoot = Join-Path $root 'models\TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX'
$labelsPath = Join-Path $root 'data\fixed-label-embeddings.tinyclip-int8.generated.json'
$defsPath = Join-Path $root 'data\fixed-label-prototypes.json'
$regressionConfigPath = Join-Path $root 'tests\accuracy\regression-config.json'
$modelPath = Join-Path $modelRoot 'onnx\vision_model_quantized.onnx'
$expectedModelSha = 'bbf8426b0e548881dcfd9257030dd6139fceeeb4808994968b882ecc3ada291f'

function Get-Sha256([string]$Path) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try { $s=[IO.File]::OpenRead($Path); try{$h=$sha.ComputeHash($s)}finally{$s.Dispose()}; return([BitConverter]::ToString($h)).Replace('-','').ToLowerInvariant() } finally { $sha.Dispose() }
}
function Assert-RealFile([string]$Path,[long]$MinBytes=1) {
  if (-not (Test-Path $Path)) { throw "Missing asset: $Path`nRun setup-assets.bat first." }
  $info = Get-Item $Path
  if ($info.Length -lt $MinBytes) { throw "Asset is unexpectedly small: $Path ($($info.Length) bytes)." }
  $fs=[IO.File]::OpenRead($Path)
  try { $buf=New-Object byte[] 160; $n=$fs.Read($buf,0,$buf.Length); $first=[Text.Encoding]::UTF8.GetString($buf,0,$n) } finally { $fs.Dispose() }
  if ($first.StartsWith('version https://git-lfs.github.com/spec/v1')) { throw "Git LFS pointer is not materialized: $Path" }
}
function Encode-Asset([string]$Path,[string]$Mime,[string]$Compression='auto') {
  $raw=[IO.File]::ReadAllBytes($Path); $stored=$raw; $kind='none'
  if($Compression -eq 'gzip' -or $Compression -eq 'auto') {
    $ms=[IO.MemoryStream]::new()
    $gz=[IO.Compression.GZipStream]::new($ms,[IO.Compression.CompressionLevel]::Optimal,$true)
    try{$gz.Write($raw,0,$raw.Length)}finally{$gz.Dispose()}
    $candidate=$ms.ToArray();$ms.Dispose()
    if($Compression -eq 'gzip' -or $candidate.Length -lt [int]($raw.Length*0.98)){$stored=$candidate;$kind='gzip'}
  }
  return [ordered]@{mime=$Mime;compression=$kind;originalBytes=$raw.Length;storedBytes=$stored.Length;sha256=(Get-Sha256 $Path);base64=[Convert]::ToBase64String($stored)}
}
function Assert-LabelEmbeddingsCurrent([string]$DefinitionsPath,[string]$EmbeddingsPath) {
  $defs = Get-Content -Raw -Encoding UTF8 $DefinitionsPath | ConvertFrom-Json -ErrorAction Stop
  $labels = Get-Content -Raw -Encoding UTF8 $EmbeddingsPath | ConvertFrom-Json -ErrorAction Stop
  $defCats = @($defs.categories)
  $labelCats = @($labels.categories)
  if ($defCats.Count -lt 2) { throw 'At least two categories are required.' }
  if ($labelCats.Count -ne $defCats.Count) {
    throw "Label embeddings are stale: category count differs ($($labelCats.Count) vs $($defCats.Count)).`nRun dev-update-label-embeddings.bat, then commit the updated generated JSON."
  }
  $seen = @{}
  for ($i=0; $i -lt $defCats.Count; $i++) {
    $d = $defCats[$i]
    $l = $labelCats[$i]
    if (-not $d.key -or $seen.ContainsKey([string]$d.key)) { throw "Invalid or duplicate category key in fixed-label-prototypes.json: '$($d.key)'" }
    $seen[[string]$d.key] = $true
    if ([string]$l.key -ne [string]$d.key) {
      throw "Label embeddings are stale: category order/key mismatch at index $i ('$($l.key)' vs '$($d.key)').`nRun dev-update-label-embeddings.bat."
    }
    if ([string]$l.ja -ne [string]$d.ja -or [string]$l.en -ne [string]$d.en) {
      throw "Label embeddings are stale for category '$($d.key)': display labels changed.`nRun dev-update-label-embeddings.bat."
    }
    $dp = @($d.prototypes)
    $lp = @($l.prototypes)
    if ($dp.Count -lt 1) { throw "Category '$($d.key)' needs at least one prototype prompt." }
    if ($lp.Count -ne $dp.Count) {
      throw "Label embeddings are stale for category '$($d.key)': prototype count changed.`nRun dev-update-label-embeddings.bat."
    }
    for ($j=0; $j -lt $dp.Count; $j++) {
      if ([string]$lp[$j].text -ne [string]$dp[$j]) {
        throw "Label embeddings are stale for category '$($d.key)': prototype text changed.`nRun dev-update-label-embeddings.bat."
      }
      if (@($lp[$j].vector).Count -ne 512) {
        throw "Invalid label embedding for category '$($d.key)': expected 512 dimensions."
      }
    }
  }
  return $defCats.Count
}

Assert-RealFile (Join-Path $root 'app.config.json') 32
Assert-RealFile (Join-Path $root 'src\index.template.html') 1024
Assert-RealFile $defsPath 256
Assert-RealFile $labelsPath 1024
Assert-RealFile $regressionConfigPath 64
Assert-RealFile (Join-Path $root 'vendor\transformers\transformers.min.js') 1024
Assert-RealFile (Join-Path $root 'vendor\transformers\ort-wasm-simd-threaded.mjs') 1024
Assert-RealFile (Join-Path $root 'vendor\transformers\ort-wasm-simd-threaded.wasm') 1024
Assert-RealFile (Join-Path $modelRoot 'config.json') 64
Assert-RealFile (Join-Path $modelRoot 'preprocessor_config.json') 64
Assert-RealFile (Join-Path $modelRoot 'LICENSE') 32
Assert-RealFile $modelPath 1MB

$modelSha = Get-Sha256 $modelPath
if ($modelSha -ne $expectedModelSha) {
  throw "TinyCLIP release model SHA-256 mismatch.`nExpected: $expectedModelSha`nActual:   $modelSha"
}
$categoryCount = Assert-LabelEmbeddingsCurrent $defsPath $labelsPath

$appConfig = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'app.config.json')
$categoryDefs = Get-Content -Raw -Encoding UTF8 $defsPath
$regressionConfig = Get-Content -Raw -Encoding UTF8 $regressionConfigPath
$template = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'src\index.template.html')

$bundle = [ordered]@{ schemaVersion=1; dependencies=[ordered]@{
  runtime=[ordered]@{assets=[ordered]@{
    transformers=(Encode-Asset (Join-Path $root 'vendor\transformers\transformers.min.js') 'text/javascript' 'auto')
    'ort-mjs'=(Encode-Asset (Join-Path $root 'vendor\transformers\ort-wasm-simd-threaded.mjs') 'text/javascript' 'auto')
    'ort-wasm'=(Encode-Asset (Join-Path $root 'vendor\transformers\ort-wasm-simd-threaded.wasm') 'application/wasm' 'gzip')
  }}
  model=[ordered]@{assets=[ordered]@{
    config=(Encode-Asset (Join-Path $modelRoot 'config.json') 'application/json' 'auto')
    preprocessor=(Encode-Asset (Join-Path $modelRoot 'preprocessor_config.json') 'application/json' 'auto')
    license=(Encode-Asset (Join-Path $modelRoot 'LICENSE') 'text/plain' 'auto')
    'vision-model'=(Encode-Asset $modelPath 'application/octet-stream' 'gzip')
  }}
  fixed=[ordered]@{assets=[ordered]@{
    labels=(Encode-Asset $labelsPath 'application/json' 'auto')
  }}
}}

$buildManifest = [ordered]@{
  version = (($appConfig | ConvertFrom-Json).version)
  builtAtUtc = (Get-Date).ToUniversalTime().ToString('s') + 'Z'
  runtimeModelId = 'TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX'
  runtimeMode = 'vision-split'
  modelLabel = 'TinyCLIP ViT-8M/16 · vision-only INT8'
  dtype = 'q8'
  modelFile = 'vision_model_quantized.onnx'
  modelSha256 = $modelSha
  fetchBase = 'https://smart-image-sorter.invalid/models/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX/'
  embeddedCompression = 'gzip'
  releaseModel = $true
  prebuiltRepositoryAsset = $true
}
$bundleJson = $bundle | ConvertTo-Json -Depth 30 -Compress
$buildManifestJson = $buildManifest | ConvertTo-Json -Depth 10 -Compress
$html = $template.Replace('__APP_CONFIG_JSON__',$appConfig.Trim()).Replace('__BUILD_MANIFEST_JSON__',$buildManifestJson).Replace('__EMBEDDED_ASSET_BUNDLE_JSON__',$bundleJson).Replace('__FIXED_CATEGORY_CATALOG_JSON__',$categoryDefs.Trim()).Replace('__ACCURACY_REGRESSION_CONFIG_JSON__',$regressionConfig.Trim())

$buildPlaceholders = @(
  '__APP_CONFIG_JSON__',
  '__BUILD_MANIFEST_JSON__',
  '__EMBEDDED_ASSET_BUNDLE_JSON__',
  '__FIXED_CATEGORY_CATALOG_JSON__',
  '__ACCURACY_REGRESSION_CONFIG_JSON__'
)
$remainingPlaceholders = @($buildPlaceholders | Where-Object { $html.Contains($_) })
if ($remainingPlaceholders.Count -gt 0) {
  throw "Unresolved build placeholder(s): $($remainingPlaceholders -join ', ')"
}

[IO.File]::WriteAllText($OutputPath,$html,[Text.UTF8Encoding]::new($false))

$metrics = [ordered]@{
  model = 'tinyclip-vision-int8'
  outputPath = $OutputPath
  outputBytes = (Get-Item $OutputPath).Length
  outputSha256 = (Get-Sha256 $OutputPath)
  modelBytes = (Get-Item $modelPath).Length
  modelSha256 = $modelSha
  labelBytes = (Get-Item $labelsPath).Length
  labelSha256 = (Get-Sha256 $labelsPath)
  categoryCount = $categoryCount
  prebuiltModel = $true
  precomputedLabels = $true
}
$metricsPath = Join-Path $distDir 'build-metrics.json'
$metrics | ConvertTo-Json -Depth 10 | Set-Content -Path $metricsPath -Encoding UTF8
Write-Host '[Smart Image Sorter] Built release HTML.' -ForegroundColor Green
Write-Host $OutputPath
Write-Host ("[Smart Image Sorter] HTML size: {0:N1} MB" -f ((Get-Item $OutputPath).Length / 1MB))
Write-Host "[Smart Image Sorter] Categories: $categoryCount"
