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

echo [1/3] Pushing to GAS...
call clasp push -f
if errorlevel 1 (
    echo.
    echo [ERROR] Push failed!
    pause
    exit /b 1
)

echo.
echo [2/3] Creating version...
for /f "tokens=*" %%i in ('powershell -Command "Get-Date -Format 'yyyy-MM-dd HH:mm'"') do set TIMESTAMP=%%i
call clasp version "%TIMESTAMP% deploy"

echo.
echo ========================================
echo [DONE] Code pushed successfully!
echo [DONE] Version: %TIMESTAMP%
echo ========================================
echo.
pause
