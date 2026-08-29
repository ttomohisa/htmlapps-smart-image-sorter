@echo off
setlocal
where pwsh >nul 2>nul
if %errorlevel%==0 (
  pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\build-standalone.ps1" %*
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\build-standalone.ps1" %*
)
if errorlevel 1 exit /b %errorlevel%
