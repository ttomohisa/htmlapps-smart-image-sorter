param(
  [string]$Path,
  [switch]$Strict
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $Path) { $Path = Join-Path $root 'tests\accuracy\local-samples' }
$defs = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'data\fixed-label-prototypes.json') | ConvertFrom-Json
$config = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'tests\accuracy\regression-config.json') | ConvertFrom-Json
$keys = @($defs.categories | ForEach-Object { $_.key })
$keySet = @{}
foreach ($key in $keys) { $keySet[$key.ToLowerInvariant()] = $true }
$counts = @{}
foreach ($key in $keys) { $counts[$key] = 0 }
$unknown = New-Object System.Collections.Generic.List[string]
$extensions = @('.jpg','.jpeg','.png','.webp','.avif')
$files = @(Get-ChildItem -LiteralPath $Path -File -Recurse -ErrorAction SilentlyContinue | Where-Object { $extensions -contains $_.Extension.ToLowerInvariant() })
foreach ($file in $files) {
  $expected = $null
  $relative = [IO.Path]::GetRelativePath($Path, $file.FullName)
  $parts = $relative -split '[\\/]'
  if ($parts.Length -gt 1) {
    for ($i=$parts.Length-2; $i -ge 0; $i--) {
      $candidate = $parts[$i].ToLowerInvariant()
      if ($keySet.ContainsKey($candidate)) { $expected = $candidate; break }
    }
  }
  if (-not $expected -and $file.BaseName.Contains('__')) {
    $candidate = $file.BaseName.Split('__')[0].ToLowerInvariant()
    if ($keySet.ContainsKey($candidate)) { $expected = $candidate }
  }
  if ($expected) { $counts[$expected] = [int]$counts[$expected] + 1 }
  else { $unknown.Add($relative) }
}
$rows = foreach ($category in $defs.categories) {
  $count = [int]$counts[$category.key]
  [PSCustomObject]@{
    Key = $category.key
    Category = $category.ja
    Images = $count
    Coverage = if ($count -ge [int]$config.minImagesPerCategory) { 'OK' } else { "Need $($config.minImagesPerCategory)" }
  }
}
$rows | Format-Table -AutoSize
Write-Host ("Images: {0} / Recognized: {1} / Unlabeled: {2}" -f $files.Count, ($files.Count-$unknown.Count), $unknown.Count)
if ($unknown.Count) {
  Write-Host 'Unlabeled files:' -ForegroundColor Yellow
  $unknown | Select-Object -First 20 | ForEach-Object { Write-Host "  $_" }
  if ($unknown.Count -gt 20) { Write-Host "  ... +$($unknown.Count-20)" }
}
$incomplete = @($rows | Where-Object { $_.Images -lt [int]$config.minImagesPerCategory })
if ($incomplete.Count -eq 0) {
  Write-Host '[Smart Image Sorter] Regression dataset coverage is complete.' -ForegroundColor Green
} else {
  Write-Host ("[Smart Image Sorter] Incomplete coverage: {0} categories need more images." -f $incomplete.Count) -ForegroundColor Yellow
  if ($Strict) { exit 2 }
}
