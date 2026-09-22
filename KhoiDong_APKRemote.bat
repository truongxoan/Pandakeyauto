@echo off
cd /d "%~dp0"

REM 1. Giai phong tien trinh cu bi treo (neu co) de tranh xung dot Single Instance Lock
taskkill /f /im electron.exe >nul 2>nul

REM 2. Khoi chay truc tiep bang electron.exe
if exist "%~dp0node_modules\electron\dist\electron.exe" (
    start "" "%~dp0node_modules\electron\dist\electron.exe" .
    exit /b 0
)

REM 3. Khoi chay qua start.vbs
if exist "%~dp0start.vbs" (
    start "" wscript "%~dp0start.vbs"
    exit /b 0
)

REM 4. Du phong khoi chay qua npm start
where npm >nul 2>nul
if %errorlevel% equ 0 (
    start "" npm start
    exit /b 0
)

echo [LOI] Khong tim thay Electron hoac Node.js de khoi dong!
echo Vui long kiem tra lai thu muc node_modules.
pause
exit /b 1
