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

echo.
echo [3/4] Auto-initializing trigger...
call clasp run ensureSyncTriggerExists
if errorlevel 1 (
    echo [WARN] Auto-init failed. You may need to open Web App URL once.
) else (
    echo [OK] Trigger initialized!
)

echo.
echo ========================================
echo [DONE] Deploy complete!
echo [DONE] Version: %TIMESTAMP%
echo [DONE] Trigger: Auto-scheduled
echo ========================================
echo.
pause
