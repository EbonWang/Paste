@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>nul
title Paste Launcher
cd /d "%~dp0"

set "ELECTRON=%~dp0node_modules\electron\dist\electron.exe"

echo.
echo   Paste - Clipboard Manager
echo   --------------------------------------------
echo.

REM ---------------------------------------------------------------- Node.js
where node >nul 2>nul
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\node.exe" (
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
  ) else if exist "%LocalAppData%\Programs\nodejs\node.exe" (
    set "PATH=%LocalAppData%\Programs\nodejs;%PATH%"
  ) else (
    echo   [x] Node.js not found. Install Node 18+ first: https://nodejs.org
    echo.
    pause
    exit /b 1
  )
)

REM ------------------------------------------------------------ Dependencies
if not exist "%~dp0node_modules" (
  echo   [1/3] First run - installing dependencies...
  echo         (this may take a few minutes)
  call npm install --no-audit --no-fund --ignore-scripts
  if errorlevel 1 (
    echo.
    echo   [x] npm install failed. See the log above.
    pause
    exit /b 1
  )
)

REM ------------------------------------------------------- Electron runtime
if not exist "%ELECTRON%" (
  echo   [2/3] Downloading Electron runtime...
  call node "%~dp0node_modules\electron\install.js"
  if errorlevel 1 (
    echo.
    echo   [x] Electron download failed. Try a mirror:
    echo       set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    pause
    exit /b 1
  )
)

REM ------------------------------------------------------------------- Build
echo   [3/3] Building...
call npm run build
if errorlevel 1 (
  echo.
  echo   [x] Build failed. See the log above.
  pause
  exit /b 1
)

REM ------------------------------------------------------------------ Launch
echo.
echo   [OK] Paste is running.
echo        Alt+D  show / hide window
echo        Tray icon - right click to quit
echo.

if /i "%~1"=="--console" (
  call npm start
) else (
  start "" /D "%~dp0" "%ELECTRON%" "."
)

exit /b 0
