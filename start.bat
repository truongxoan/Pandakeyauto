@echo off
cd /d "%~dp0"

taskkill /f /im electron.exe >nul 2>nul

if exist "%~dp0node_modules\electron\dist\electron.exe" (
    start "" "%~dp0node_modules\electron\dist\electron.exe" .
    exit /b 0
)

if exist "%~dp0start.vbs" (
    start "" wscript "%~dp0start.vbs"
    exit /b 0
)

start "" npm start
exit /b 0
