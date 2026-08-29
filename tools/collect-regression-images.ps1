param(
  [ValidateRange(5,10)]
  [int]$PerCategory = 6,
  [ValidateRange(320,1600)]
  [int]$Width = 960,
  [string]$Path,
  [switch]$Force,
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $Path) { $Path = Join-Path $root 'tests\accuracy\local-samples' }
$defsPath = Join-Path $root 'data\fixed-label-prototypes.json'
$sourceConfigPath = Join-Path $root 'tests\accuracy\commons-regression-sources.json'
$defs = Get-Content -Raw -Encoding UTF8 $defsPath | ConvertFrom-Json
$sourceConfig = Get-Content -Raw -Encoding UTF8 $sourceConfigPath | ConvertFrom-Json

$categoryMap = @{}
foreach ($entry in $sourceConfig.categories) { $categoryMap[$entry.key] = $entry }

New-Item -ItemType Directory -Force -Path $Path | Out-Null
$userAgent = 'SmartImageSorterRegressionDataset/2.6.1 (https://github.com/ttomohisa/htmlapps-smart-image-sorter)'
$headers = @{ 'User-Agent' = $userAgent }
$allowedExtensions = @('.jpg','.jpeg','.png','.webp','.avif')
$seenPageIds = [System.Collections.Generic.HashSet[string]]::new()
$records = [System.Collections.Generic.List[object]]::new()
$recordIndex = @{}
$manifestPath = Join-Path $Path '_commons-sources.json'
$attributionPath = Join-Path $Path 'ATTRIBUTION.md'

function Clean-MetadataText($Value) {
  if ($null -eq $Value) { return '' }
  $text = [string]$Value.value
  if (-not $text) { $text = [string]$Value }
  $text = [regex]::Replace($text, '<[^>]+>', ' ')
  $text = [System.Net.WebUtility]::HtmlDecode($text)
  return ([regex]::Replace($text, '\s+', ' ')).Trim()
}

function Get-FileExtension([string]$Mime, [string]$Url) {
  switch -Regex ($Mime) {
    '^image/jpeg$' { return '.jpg' }
    '^image/png$' { return '.png' }
    '^image/webp$' { return '.webp' }
    '^image/avif$' { return '.avif' }
    '^image/svg\+xml$' { return '.png' }
  }
  try {
    $ext = [IO.Path]::GetExtension(([uri]$Url).AbsolutePath).ToLowerInvariant()
    if ($allowedExtensions -contains $ext) { return $ext }
  } catch {}
  return $null
}

function Invoke-CommonsSearch([string]$Query, [int]$ThumbWidth) {
  $escaped = [uri]::EscapeDataString($Query)
  $api = "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=35&gsrsearch=$escaped&prop=imageinfo&iiprop=url%7Cmime%7Cextmetadata&iiurlwidth=$ThumbWidth&format=json&formatversion=2"
  try {
    $response = Invoke-RestMethod -Uri $api -Headers $headers -Method Get
    if ($response.query -and $response.query.pages) { return @($response.query.pages) }
  } catch {
    Write-Host "  [warn] Commons search failed: $Query" -ForegroundColor Yellow
    Write-Host "         $($_.Exception.Message)" -ForegroundColor DarkYellow
  }
  return @()
}

function Test-DownloadedImage([string]$FilePath) {
  if (-not (Test-Path $FilePath)) { return $false }
  $info = Get-Item $FilePath
  if ($info.Length -lt 1024) { return $false }
  $stream = [IO.File]::OpenRead($FilePath)
  try {
    $buf = New-Object byte[] 16
    $n = $stream.Read($buf,0,$buf.Length)
    $head = [Text.Encoding]::ASCII.GetString($buf,0,$n).ToLowerInvariant()
    if ($head.Contains('<html') -or $head.Contains('<!doctype')) { return $false }
  } finally { $stream.Dispose() }
  return $true
}

function Get-RecordKey([string]$Category, [string]$FileName) {
  return ($Category.ToLowerInvariant() + '|' + $FileName.ToLowerInvariant())
}

function Add-Record($Record) {
  $key = Get-RecordKey ([string]$Record.category) ([string]$Record.file)
  if ($recordIndex.ContainsKey($key)) { return }
  $records.Add([PSCustomObject]$Record)
  $recordIndex[$key] = $true
  if ($Record.pageId) { [void]$seenPageIds.Add([string]$Record.pageId) }
}

function Remove-CategoryRecords([string]$CategoryKey) {
  if ($records.Count -eq 0) { return }
  $keep = [System.Collections.Generic.List[object]]::new()
  foreach ($r in $records) {
    if ([string]$r.category -ne $CategoryKey) { $keep.Add($r) }
  }
  $records.Clear()
  $recordIndex.Clear()
  $seenPageIds.Clear()
  foreach ($r in $keep) { Add-Record $r }
}

function Write-MetadataFiles {
  if ($DryRun) { return }
  [object[]]$allRecords = $records.ToArray()
  $manifest = [ordered]@{
    schemaVersion = 1
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString('s') + 'Z'
    provider = 'Wikimedia Commons'
    perCategoryTarget = $PerCategory
    thumbnailWidth = $Width
    images = $allRecords
  }
  [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 20), [Text.UTF8Encoding]::new($false))

  $attr = [System.Collections.Generic.List[string]]::new()
  $attr.Add('# Regression sample attribution')
  $attr.Add('')
  $attr.Add('Downloaded from Wikimedia Commons for local Smart Image Sorter regression testing.')
  $attr.Add('Each item retains its source page and license metadata below. Check the source page before redistributing a sample image.')
  $attr.Add('')
  foreach ($r in $allRecords) {
    $attr.Add("## $($r.category) / $($r.file)")
    $attr.Add('')
    $attr.Add("- Source: $($r.sourcePage)")
    if ($r.artist) { $attr.Add("- Author/artist: $($r.artist)") }
    if ($r.license) { $attr.Add("- License: $($r.license)") }
    if ($r.licenseUrl) { $attr.Add("- License URL: $($r.licenseUrl)") }
    $attr.Add('')
  }
  [IO.File]::WriteAllLines($attributionPath, $attr.ToArray(), [Text.UTF8Encoding]::new($false))
}

# Reuse metadata from a previous successful or partial run.
if ((-not $Force) -and (Test-Path $manifestPath)) {
  try {
    $previous = Get-Content -Raw -Encoding UTF8 $manifestPath | ConvertFrom-Json
    foreach ($r in @($previous.images)) {
      if (-not $r.category -or -not $r.file) { continue }
      $filePath = Join-Path (Join-Path $Path ([string]$r.category)) ([string]$r.file)
      if (Test-DownloadedImage $filePath) { Add-Record $r }
    }
    if ($records.Count -gt 0) {
      Write-Host ("[Smart Image Sorter] Reusing metadata for {0} existing Commons samples." -f $records.Count) -ForegroundColor DarkGray
    }
  } catch {
    Write-Host '[warn] Existing _commons-sources.json could not be read; managed samples without metadata will be recollected.' -ForegroundColor Yellow
  }
}

if ($Force) {
  foreach ($category in $defs.categories) {
    $dir = Join-Path $Path $category.key
    if (Test-Path $dir) {
      Get-ChildItem -LiteralPath $dir -File -ErrorAction SilentlyContinue |
        Where-Object { $_.BaseName -like ($category.key + '__commons_*') } |
        Remove-Item -Force
    }
  }
  foreach ($generated in @('_commons-sources.json','ATTRIBUTION.md')) {
    $p = Join-Path $Path $generated
    if (Test-Path $p) { Remove-Item -Force $p }
  }
  $records.Clear()
  $recordIndex.Clear()
  $seenPageIds.Clear()
}

Write-Host '[Smart Image Sorter] Collecting real regression images from Wikimedia Commons.' -ForegroundColor Cyan
Write-Host ("Target: {0} images x {1} categories = {2} images" -f $PerCategory, @($defs.categories).Count, ($PerCategory * @($defs.categories).Count))
Write-Host ("Thumbnail width: {0}px" -f $Width)
if ($DryRun) { Write-Host '[dry-run] No files will be downloaded.' -ForegroundColor Yellow }
Write-Host ''

foreach ($category in $defs.categories) {
  $key = [string]$category.key
  $dir = Join-Path $Path $key
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $existing = @(Get-ChildItem -LiteralPath $dir -File -ErrorAction SilentlyContinue | Where-Object { $allowedExtensions -contains $_.Extension.ToLowerInvariant() })
  $managed = @($existing | Where-Object { $_.BaseName -like ($key + '__commons_*') })

  # If files survived a previous interrupted run but their metadata manifest did not,
  # recollect only this managed category so source/license attribution stays trustworthy.
  if ($managed.Count -gt 0 -and -not $DryRun) {
    $missingMetadata = @($managed | Where-Object { -not $recordIndex.ContainsKey((Get-RecordKey $key $_.Name)) })
    if ($missingMetadata.Count -gt 0) {
      Write-Host ("[{0}] repairing {1} managed sample(s) with missing source metadata" -f $key, $missingMetadata.Count) -ForegroundColor Yellow
      $managed | Remove-Item -Force
      Remove-CategoryRecords $key
      $managed = @()
    }
  }

  $current = $managed.Count
  Write-Host ("[{0}] {1} / {2}" -f $key, $current, $PerCategory) -ForegroundColor Green
  if ($current -ge $PerCategory) { continue }

  if ($categoryMap.ContainsKey($key)) {
    $source = $categoryMap[$key]
  } else {
    $fallbackQueries = [System.Collections.Generic.List[string]]::new()
    if ($category.en) { $fallbackQueries.Add(([string]$category.en + ' photograph')) }
    if ($category.ja) { $fallbackQueries.Add(([string]$category.ja + ' photograph')) }
    foreach ($prototype in @($category.prototypes) | Select-Object -First 2) {
      if ($prototype) { $fallbackQueries.Add([string]$prototype) }
    }
    $source = [PSCustomObject]@{ key = $key; queries = @($fallbackQueries | Select-Object -Unique) }
    Write-Host '  [info] using automatic search queries for this newly added category' -ForegroundColor DarkYellow
  }

  $nextIndex = 1
  if ($managed.Count) {
    $numbers = @($managed | ForEach-Object {
      if ($_.BaseName -match '__commons_(\d+)$') { [int]$Matches[1] }
    })
    if ($numbers.Count) { $nextIndex = ([int](($numbers | Measure-Object -Maximum).Maximum)) + 1 }
  }

  foreach ($query in $source.queries) {
    if ($current -ge $PerCategory) { break }
    Write-Host "  search: $query" -ForegroundColor DarkGray
    $pages = Invoke-CommonsSearch $query $Width
    foreach ($page in $pages) {
      if ($current -ge $PerCategory) { break }
      $pageId = [string]$page.pageid
      if (-not $pageId -or -not $seenPageIds.Add($pageId)) { continue }
      if (-not $page.imageinfo -or @($page.imageinfo).Count -eq 0) { continue }
      $ii = @($page.imageinfo)[0]
      $url = if ($ii.thumburl) { [string]$ii.thumburl } else { [string]$ii.url }
      if (-not $url) { continue }
      $mime = if ($ii.thumbmime) { [string]$ii.thumbmime } else { [string]$ii.mime }
      $ext = Get-FileExtension $mime $url
      if (-not $ext) { continue }

      $fileName = ('{0}__commons_{1:D3}{2}' -f $key, $nextIndex, $ext)
      $outFile = Join-Path $dir $fileName
      $meta = $ii.extmetadata
      $record = [ordered]@{
        category = $key
        file = $fileName
        title = [string]$page.title
        pageId = [int64]$page.pageid
        sourcePage = if ($ii.descriptionurl) { [string]$ii.descriptionurl } else { "https://commons.wikimedia.org/?curid=$($page.pageid)" }
        downloadUrl = $url
        mime = $mime
        license = Clean-MetadataText $meta.LicenseShortName
        licenseUrl = Clean-MetadataText $meta.LicenseUrl
        artist = Clean-MetadataText $meta.Artist
        credit = Clean-MetadataText $meta.Credit
        description = Clean-MetadataText $meta.ImageDescription
      }

      if ($DryRun) {
        Write-Host "    would download: $fileName <- $($page.title)"
        Add-Record $record
        $current++
        $nextIndex++
        continue
      }

      $tmp = $outFile + '.tmp'
      try {
        Invoke-WebRequest -Uri $url -OutFile $tmp -Headers $headers -UseBasicParsing
        if (-not (Test-DownloadedImage $tmp)) { throw 'Downloaded content is not a valid image payload.' }
        Move-Item -Force $tmp $outFile
        Add-Record $record
        $sizeKb = [Math]::Round((Get-Item $outFile).Length / 1KB)
        Write-Host ("    + {0} ({1} KB)" -f $fileName, $sizeKb)
        $current++
        $nextIndex++
      } catch {
        if (Test-Path $tmp) { Remove-Item -Force $tmp }
        Write-Host "    [skip] $($page.title): $($_.Exception.Message)" -ForegroundColor DarkYellow
      }
    }
  }

  if ($current -lt $PerCategory) {
    Write-Host ("  [warn] only {0}/{1} images were collected for {2}" -f $current, $PerCategory, $key) -ForegroundColor Yellow
  }

  # Persist after every category so an interrupted run does not lose attribution metadata.
  Write-MetadataFiles
}

Write-MetadataFiles

Write-Host ''
Write-Host '[Smart Image Sorter] Collection finished.' -ForegroundColor Green
Write-Host $Path
Write-Host ("Metadata records: {0}" -f $records.Count)
Write-Host 'Run check-regression-dataset.bat -Strict to verify coverage.'
