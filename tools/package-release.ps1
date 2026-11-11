param(
  [string]$HtmlPath = './dist/index.html',
  [string]$OutputDirectory = './dist/release'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$config = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'app.config.json') | ConvertFrom-Json -ErrorAction Stop
$version = [string]$config.version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw "Invalid semantic release version: $version" }

$htmlFile = [IO.Path]::GetFullPath($HtmlPath)
$releaseDir = [IO.Path]::GetFullPath($OutputDirectory)
if (!(Test-Path -PathType Leaf $htmlFile)) { throw "Built standalone HTML not found: $htmlFile" }
$html = Get-Content -Raw -Encoding UTF8 $htmlFile
if ($html -notmatch [regex]::Escape('v' + $version)) { throw 'Standalone HTML has the wrong release version' }
if (!$html.Contains('"version": "' + $version + '"') -and !$html.Contains('"version":"'+$version+'"')) {
  throw 'Embedded app config has the wrong release version'
}
foreach ($placeholder in @('__APP_CONFIG_JSON__','__BUILD_MANIFEST_JSON__','__EMBEDDED_ASSET_BUNDLE_JSON__','__FIXED_CATEGORY_CATALOG_JSON__','__ACCURACY_REGRESSION_CONFIG_JSON__')) {
  if ($html.Contains($placeholder)) { throw "Unresolved build placeholder: $placeholder" }
}
if ($html -notmatch 'connect-src blob:' -or $html -match 'connect-src[^;]*(https?:|\*)') {
  throw 'Runtime network CSP is missing or allows an external connection'
}

$prefix = "htmlapps-smart-image-sorter-v$version"
$staging = Join-Path $root 'dist/release-staging'
if (Test-Path $releaseDir) { Remove-Item -Recurse -Force $releaseDir }
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Force -Path $releaseDir, $staging | Out-Null
try {
  $htmlAsset = Join-Path $releaseDir "$prefix.html"
  Copy-Item -LiteralPath $htmlFile -Destination $htmlAsset
  Copy-Item -LiteralPath $htmlFile -Destination (Join-Path $staging 'index.html')
  foreach ($name in @('app.config.json','README.md','README.ja.md','CHANGELOG.md','LICENSE','THIRD_PARTY_NOTICES.md','VERIFY_OFFLINE.md','DEVELOPMENT.md')) {
    Copy-Item -LiteralPath (Join-Path $root $name) -Destination (Join-Path $staging $name)
  }
  Copy-Item -LiteralPath (Join-Path $root 'dist/build-metrics.json') -Destination (Join-Path $staging 'build-metrics.json')
  $assetDir = Join-Path $staging 'assets'
  New-Item -ItemType Directory -Force -Path $assetDir | Out-Null
  foreach ($name in @('favicon.svg','screenshot.png','screenshot-ja.png','screenshot-en.png')) {
    Copy-Item -LiteralPath (Join-Path $root "assets/$name") -Destination (Join-Path $assetDir $name)
  }
  $notesDir = Join-Path $staging 'docs/releases'
  New-Item -ItemType Directory -Force -Path $notesDir | Out-Null
  Copy-Item -LiteralPath (Join-Path $root "docs/releases/v$version.md") -Destination (Join-Path $notesDir "v$version.md")

  $zipAsset = Join-Path $releaseDir "$prefix.zip"
  Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zipAsset -CompressionLevel Optimal
  if (!(Test-Path $zipAsset)) { throw 'Release ZIP was not created' }

  Add-Type -AssemblyName System.IO.Compression
  $archive = [IO.Compression.ZipFile]::OpenRead($zipAsset)
  try {
    $names = @($archive.Entries | ForEach-Object { $_.FullName.Replace('\','/') })
    foreach ($required in @('index.html','app.config.json','README.md','README.ja.md','LICENSE','THIRD_PARTY_NOTICES.md','build-metrics.json','assets/favicon.svg',"docs/releases/v$version.md")) {
      if ($names -notcontains $required) { throw "Missing release ZIP entry: $required" }
    }
    if ($names -contains 'smart-image-sorter.html') { throw 'Stale root HTML cannot be released' }
  } finally { $archive.Dispose() }

  $copiedHash = (Get-FileHash -LiteralPath $htmlAsset -Algorithm SHA256).Hash.ToLowerInvariant()
  $originalHash = (Get-FileHash -LiteralPath $htmlFile -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($copiedHash -ne $originalHash) { throw 'Release HTML differs from the validated generated HTML' }
  $zipHash = (Get-FileHash -LiteralPath $zipAsset -Algorithm SHA256).Hash.ToLowerInvariant()
  $sums = "$copiedHash  $prefix.html" + [Environment]::NewLine + "$zipHash  $prefix.zip" + [Environment]::NewLine
  [IO.File]::WriteAllText((Join-Path $releaseDir 'SHA256SUMS.txt'),$sums,[Text.UTF8Encoding]::new($false))
  Write-Host "Release candidate: v$version"
  Write-Host ("HTML size: {0:N2} MB" -f ((Get-Item $htmlAsset).Length / 1MB))
  Write-Host ("ZIP size: {0:N2} MB" -f ((Get-Item $zipAsset).Length / 1MB))
  Write-Host "SHA-256 checksums recorded."
} finally {
  if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
}
