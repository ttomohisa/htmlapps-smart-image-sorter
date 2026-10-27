$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
foreach ($file in @(Get-ChildItem -LiteralPath (Join-Path $root 'tools') -Filter '*.ps1')) {
  $tokens = $null; $errors = $null
  [void][System.Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$tokens, [ref]$errors)
  if (@($errors).Count) { throw "PowerShell parse failed: $($file.Name)" }
}
Push-Location $root
try {
  & (Join-Path $root 'tools/build-standalone.ps1') -OutputPath (Join-Path $root 'dist/index.html')
  & node --test
  if ($LASTEXITCODE -ne 0) { throw 'Source regression suite failed.' }
  $env:SORTER_HTML = Join-Path $root 'dist/index.html'
  & node --test tests/result-workflow.test.cjs tests/common-ui.test.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Generated runtime regressions failed.' }
  & node tests/header-normalization.test.mjs src/index.template.html dist/index.html
  if ($LASTEXITCODE -ne 0) { throw 'Header regression failed.' }
  & node tests/help-dialog.test.cjs src/index.template.html dist/index.html
  if ($LASTEXITCODE -ne 0) { throw 'Help regression failed.' }
  & node tests/visual-assets.test.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Visual asset regression failed.' }
  & node tests/verify-common-artifacts.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Artifact parity/hash/CSP check failed.' }
} finally { Remove-Item Env:SORTER_HTML -ErrorAction SilentlyContinue; Pop-Location }
