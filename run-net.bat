@echo off
title Pandakeyauto Pro - Cyber Cafe Quick Loader
color 0b
echo ========================================================
echo       PANDAKEYAUTO PRO VIP - QUAN NET QUICK LOADER
echo ========================================================
echo.
set "TARGET_DIR=%TEMP%\Pandakeyauto"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
set "EXE_PATH=%TARGET_DIR%\Pandakeyauto-Pro-Portable.exe"

if exist "%EXE_PATH%" (
    echo [*] Tim thay ban san co trong Temp. Dang khoi chay...
    start "" "%EXE_PATH%"
    exit /b 0
)

echo [*] Dang tai Pandakeyauto Pro Portable tu GitHub... Vui long cho giay lat...
curl -L -k -# -o "%EXE_PATH%" "https://github.com/3122380192/Pandakeyauto/releases/latest/download/Pandakeyauto-Pro-Portable.exe"

if not exist "%EXE_PATH%" (
    echo [!] Dang thu tai lai bang PowerShell...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://github.com/3122380192/Pandakeyauto/releases/latest/download/Pandakeyauto-Pro-Portable.exe', '%EXE_PATH%')"
)

if exist "%EXE_PATH%" (
    echo [OK] Tai thanh cong! Dang khoi dong Pandakeyauto...
    start "" "%EXE_PATH%"
) else (
    echo [X] Khong the tai file. Vui long kiem tra ket noi mang.
    pause
)
exit /b 0
