param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+$')]
  [string]$Version,
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')]
  [string]$Repository,
  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($env:GH_TOKEN)) {
  throw 'GH_TOKEN is required for the release lookup'
}
$uri = "https://api.github.com/repos/$Repository/releases/tags/v$Version"
$headers = @{
  Authorization = "Bearer $env:GH_TOKEN"
  Accept = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
}
# Invoke-WebRequest on PowerShell 7 returns an HTTP response even for 404
# with -SkipHttpErrorCheck. The response itself contains the StatusCode.
$response = Invoke-WebRequest -Uri $uri -Headers $headers -SkipHttpErrorCheck -TimeoutSec 30
$status = [int]$response.StatusCode
if ($status -eq 200) {
  Write-Host "GitHub Release v$Version already exists. Not overwriting."
  $publish = 'false'
} elseif ($status -eq 404) {
  Write-Host "GitHub Release v$Version is absent (HTTP 404). Proceeding."
  $publish = 'true'
} else {
  throw "GitHub Release lookup failed with HTTP $status"
}
Add-Content -LiteralPath $OutputPath -Value "publish=$publish" -Encoding utf8
