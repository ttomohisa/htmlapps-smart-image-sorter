@echo off
setlocal
call "%~dp0setup-assets.bat" %*
if errorlevel 1 exit /b %errorlevel%
call "%~dp0build-standalone.bat"
if errorlevel 1 exit /b %errorlevel%
