@echo off
REM Rebuild switch_mouse.exe / recoil_assist.exe / sniper_assist.exe from .cs
REM Run this on Windows after editing any bin\*.cs file.
set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
if not exist "%CSC%" set CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe
if not exist "%CSC%" ( echo [ERROR] csc.exe not found - install .NET Framework 4.x & exit /b 1 )
for %%N in (switch_mouse recoil_assist sniper_assist) do (
  if exist "%~dp0%%N.cs" (
    echo Building %%N.exe ...
    "%CSC%" /nologo /target:exe /out:"%~dp0%%N.exe" "%~dp0%%N.cs" || exit /b 1
  )
)
echo Done.
