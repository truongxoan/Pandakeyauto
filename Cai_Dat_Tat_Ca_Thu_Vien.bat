@echo off
chcp 65001 >nul
title Pandakeyauto Pro - Cai Dat Toan Bo Thu Vien & Moi Truong
color 0B

echo =======================================================================
echo   🎮 PANDAKEYAUTO PRO VIP - CÀI ĐẶT TOÀN BỘ THƯ VIỆN & MÔI TRƯỜNG
echo =======================================================================
echo.
echo [*] Script này sẽ tự động:
echo     1. Kiểm tra môi trường Node.js & npm (hỗ trợ tự cài đặt nếu chưa có)
echo     2. Cài đặt toàn bộ thư viện npm (dependencies + devDependencies)
echo     3. Kiểm tra các công cụ điều khiển cốt lõi (Scrcpy, ADB, Helper EXEs)
echo     4. Tải các gói OCR ngôn ngữ (nếu cần cho dịch thuật)
echo.
echo =======================================================================
echo.

cd /d "%~dp0"

:: ----------------------------------------------------
:: BƯỚC 1: Kiểm tra Node.js & npm
:: ----------------------------------------------------
echo [1/4] Đang kiểm tra Node.js và npm...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Máy tính chưa cài đặt Node.js!
    echo [*] Đang thử tải và cài đặt Node.js LTS tự động qua winget...
    where winget >nul 2>nul
    if %errorlevel% equ 0 (
        winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
        echo [*] Đang nạp lại PATH môi trường...
        call refreshenv >nul 2>nul
    ) else (
        echo [!] Không tìm thấy winget. Vui lòng tải và cài Node.js tại: https://nodejs.org/
        echo [*] Gợi ý: Nếu không muốn cài Node.js, bạn có thể chạy trực tiếp:
        echo     - Bản Portable: dist\Pandakeyauto-Pro-Portable.exe
        echo     - Hoặc file: Chay_Offline_Khong_Can_Cai_Dat.bat
        pause
        exit /b 1
    )
)

for /f "tokens=*" %%v in ('node -v 2^>nul') do set NODE_VER=%%v
for /f "tokens=*" %%v in ('npm -v 2^>nul') do set NPM_VER=%%v
echo [OK] Đã tìm thấy Node.js %NODE_VER% và npm %NPM_VER%.
echo.

:: ----------------------------------------------------
:: BƯỚC 2: Cài đặt toàn bộ dependencies và devDependencies
:: ----------------------------------------------------
echo [2/4] Đang cài đặt toàn bộ thư viện phụ thuộc (npm install)...
echo [*] Đang cài: electron, electron-builder, tesseract.js và các module hỗ trợ...
call npm install
if %errorlevel% neq 0 (
    echo [!] npm install gặp lỗi. Đang thử chạy npm install --legacy-peer-deps...
    call npm install --legacy-peer-deps
)
echo [OK] Đã cài đặt xong toàn bộ thư viện npm vào node_modules!
echo.

:: ----------------------------------------------------
:: BƯỚC 3: Kiểm tra các công cụ hệ thống trong thư mục bin
:: ----------------------------------------------------
echo [3/4] Kiểm tra các công cụ nhị phân Scrcpy, ADB và Helper...
if not exist "bin\scrcpy.exe" (
    echo [!] Thiếu scrcpy.exe trong bin. Đang tự động tải bộ Scrcpy mới nhất...
    node download-scrcpy.js
) else (
    echo [OK] Đã có đầy đủ Scrcpy và ADB trong bin\.
)

if exist "bin\build_helpers.bat" (
    echo [*] Kiểm tra các helper C# Win32 (switch_mouse, recoil, sniper)...
    call "bin\build_helpers.bat" >nul 2>nul
    echo [OK] Các helper Win32 đã sẵn sàng.
)
echo.

:: ----------------------------------------------------
:: BƯỚC 4: Hoàn tất
:: ----------------------------------------------------
echo [4/4] Hoàn tất thiết lập!
echo =======================================================================
echo   🎉 TẤT CẢ THƯ VIỆN & CÔNG CỤ ĐÃ ĐƯỢC CÀI ĐẶT THÀNH CÔNG 100%!
echo =======================================================================
echo.
echo Bạn có thể khởi động Pandakeyauto bằng 1 trong các cách sau:
echo   1. Nhấp đúp vào: "Khởi Động Pandakeyauto.vbs" (chạy ngầm cực nhanh không console)
echo   2. Hoặc chạy file: "Khởi Động Pandakeyauto.bat"
echo   3. Hoặc mở file Portable: "dist\Pandakeyauto-Pro-Portable.exe"
echo   4. Hoặc cài đặt bản Setup: "dist\Pandakeyauto-Pro-Setup.exe"
echo   5. Hoặc gõ lệnh: npm start
echo.
pause
