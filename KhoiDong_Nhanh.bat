@echo off
title Pandakeyauto - Khoi Dong Nhanh
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================================
echo   Dang don dep cac tien trinh cu...
echo ========================================================
taskkill /F /IM electron.exe >nul 2>nul
taskkill /F /IM scrcpy.exe >nul 2>nul
taskkill /F /IM switch_mouse.exe >nul 2>nul
taskkill /F /IM adb.exe >nul 2>nul

echo ========================================================
echo   Dang khoi dong Pandakeyauto...
echo ========================================================

if exist "%~dp0node_modules\electron\dist\electron.exe" (
    start "" "%~dp0node_modules\electron\dist\electron.exe" .
    exit /b 0
)

where npm >nul 2>nul
if %errorlevel% equ 0 (
    start "" npm start
    exit /b 0
)

echo [LOI] Khong tim thay Electron hoac Node.js de khoi dong!
echo Vui long kiem tra lai thu muc node_modules hoac cai dat Node.js.
pause
exit /b 1
