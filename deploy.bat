@echo off
setlocal EnableExtensions EnableDelayedExpansion
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
set "VERSION_LOG=%TEMP%\clasp_version_%RANDOM%.txt"
call clasp version "%TIMESTAMP% deploy" > "%VERSION_LOG%" 2>&1
type "%VERSION_LOG%"
if errorlevel 1 (
    echo.
    echo [ERROR] Version creation failed!
    findstr /i /c:"Cannot create more versions" "%VERSION_LOG%" >nul 2>&1
    if not errorlevel 1 (
        echo.
        echo [ACTION REQUIRED] Apps Script has reached the 200-version limit.
        echo Open Apps Script Project History and bulk-delete old versions that are not used by active deployments.
        echo Then run deploy.bat again. Do not create a new deployment ID.
    )
    del "%VERSION_LOG%" >nul 2>&1
    pause
    exit /b 1
)
for /f "tokens=3" %%v in ('findstr /r /c:"Created version" "%VERSION_LOG%"') do set "GAS_VERSION_NUMBER=%%v"
set "GAS_VERSION_NUMBER=!GAS_VERSION_NUMBER:,=!"
del "%VERSION_LOG%" >nul 2>&1
if "%GAS_VERSION_NUMBER%"=="" (
    echo.
    echo [ERROR] Could not parse created GAS version number.
    pause
    exit /b 1
)

echo.
echo [3/4] Deploying version %GAS_VERSION_NUMBER% to existing webhook...
call clasp deploy -i AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA -V %GAS_VERSION_NUMBER%
if errorlevel 1 (
    echo.
    echo [ERROR] Deployment update failed!
    pause
    exit /b 1
)

echo.
echo [4/4] Prompt source reminder...
echo [INFO] Prompt lives in Google Sheet Prompt!C3.
echo [INFO] deploy.bat does not modify Prompt!C3 or upload Prompt.csv.
echo [INFO] If Prompt needs changes, update the Sheet intentionally and verify /重啟 shows the expected prompt version.

echo.
echo ========================================
echo [DONE] Code pushed and deployed successfully!
echo [DONE] Version: %TIMESTAMP%
echo ========================================
echo.
pause
