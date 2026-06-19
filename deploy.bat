@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   GAS LineBot Deploy Tool
echo ========================================
echo.

REM Check clasp
clasp --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] clasp not found!
    echo         Run: npm install -g @google/clasp
    echo         Then: clasp login
    pause
    exit /b 1
)

REM Check .clasp.json
if not exist ".clasp.json" (
    echo [ERROR] .clasp.json not found!
    echo         Run: clasp clone YOUR_SCRIPT_ID --rootDir .
    pause
    exit /b 1
)

echo [1/4] Pushing to GAS...
call clasp push -f
if errorlevel 1 (
    echo.
    echo [ERROR] Push failed!
    pause
    exit /b 1
)

echo.
echo [2/4] Creating version...
for /f "tokens=*" %%i in ('powershell -Command "Get-Date -Format 'yyyy-MM-dd HH:mm'"') do set TIMESTAMP=%%i
call clasp version "%TIMESTAMP% deploy"
if errorlevel 1 (
    echo.
    echo [ERROR] Version creation failed!
    pause
    exit /b 1
)

echo.
echo [3/4] Deploying to existing webhook...
call clasp deploy -i AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA
if errorlevel 1 (
    echo.
    echo [ERROR] Deployment update failed!
    pause
    exit /b 1
)

echo.
echo [4/4] Syncing Prompt.csv to Google Sheet Prompt!C3...
if "%GAS_ADMIN_SECRET%"=="" (
    echo [SKIP] GAS_ADMIN_SECRET is not set. Prompt!C3 was not changed.
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\sync_prompt_c3.ps1"
    if errorlevel 1 (
        echo.
        echo [ERROR] Prompt!C3 sync failed!
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo [DONE] Code pushed and deployed successfully!
echo [DONE] Version: %TIMESTAMP%
echo ========================================
echo.
pause
