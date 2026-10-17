@echo off
setlocal enabledelayedexpansion
title Corporate Sports Events Console (production build)

rem Run from wherever this file actually lives, not wherever it was double-clicked from.
cd /d "%~dp0"

echo ============================================================
echo   Corporate Sports Events Console - production build and preview
echo ============================================================
echo.
echo This builds an optimised copy of the app and serves that,
echo instead of the live development server. Use this for a demo
echo that needs to run for a long time, or on a slower machine.
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
    echo After installing, close this window and double-click this file again.
    echo.
    pause
    exit /b 1
)

echo Found Node.js:
node -v
echo.

rem ---- 2. Install dependencies when any declared package is missing --------
rem Checking each package, not just the folder, also catches an update that added one.
node -e "const p=require('./package.json');const fs=require('fs');const names=Object.keys(Object.assign({},p.dependencies,p.devDependencies));const missing=names.filter(n=>fs.existsSync('node_modules/'+n+'/package.json')===false);if(missing.length>0){console.log('Missing packages: '+missing.join(', '));process.exit(1)}"
if errorlevel 1 (
    echo Installing dependencies. This needs an internet connection and
    echo takes a few minutes the first time. Please wait...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed. Check the messages above.
        pause
        exit /b 1
    )
    echo.
)

rem ---- 3. Build --------------------------------------------------------------
echo Building the app...
echo.
call npm run build
if errorlevel 1 (
    echo.
    echo [ERROR] The build failed. Check the messages above.
    pause
    exit /b 1
)

rem ---- 4. Serve the build -----------------------------------------------------
echo.
echo ============================================================
echo   Serving the production build. Your browser will open
echo   automatically at http://localhost:4173
echo.
echo   To stop the server, close this window or press Ctrl+C.
echo ============================================================
echo.

call npm run preview

pause
