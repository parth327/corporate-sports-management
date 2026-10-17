@echo off
setlocal enabledelayedexpansion
title Corporate Sports Events Console

rem Run from wherever this file actually lives, not wherever it was double-clicked from.
cd /d "%~dp0"

echo ============================================================
echo   Corporate Sports Events Console - starting
echo ============================================================
echo.

rem ---- 1. Node.js must be installed ----------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js was not found on this computer.
    echo.
    echo This application needs Node.js 18 or newer to run.
    echo Download and install it from:
    echo     https://nodejs.org/   ^(choose the "LTS" version^)
    echo.
    echo After installing, close this window and double-click start.bat again.
    echo.
    pause
    exit /b 1
)

for /f "tokens=1 delims=v" %%v in ('node -v') do set NODE_RAW=%%v
for /f "delims=." %%m in ("%NODE_RAW%") do set NODE_MAJOR=%%m
echo Found Node.js version: v%NODE_RAW%
if %NODE_MAJOR% LSS 18 (
    echo.
    echo [WARNING] Node.js v%NODE_RAW% is older than the recommended version ^(18+^).
    echo If the next step fails, install the current LTS release from https://nodejs.org/
    echo.
)

rem ---- 2. Install dependencies when any declared package is missing --------
rem Checking each package, not just the folder, also catches an update that added one.
node -e "const p=require('./package.json');const fs=require('fs');const names=Object.keys(Object.assign({},p.dependencies,p.devDependencies));const missing=names.filter(n=>fs.existsSync('node_modules/'+n+'/package.json')===false);if(missing.length>0){console.log('Missing packages: '+missing.join(', '));process.exit(1)}"
if errorlevel 1 (
    echo.
    echo Installing dependencies. This needs an internet connection and
    echo takes a few minutes the first time. Please wait...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed. Check the messages above.
        echo A common cause is no internet connection, or a corporate proxy
        echo blocking access to the npm registry.
        echo.
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed - skipping npm install.
    echo ^(Delete the node_modules folder to force a clean reinstall.^)
)

rem ---- 3. Start the app -----------------------------------------------------
echo.
echo ============================================================
echo   Starting the console. Your browser will open automatically
echo   at http://localhost:5173
echo.
echo   To stop the server, close this window or press Ctrl+C.
echo ============================================================
echo.

call npm run dev

pause
