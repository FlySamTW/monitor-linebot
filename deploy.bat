@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ========================================
echo   GAS LineBot Deploy Tool
echo ========================================
echo.
echo This updates the existing LINE webhook deployment.
echo It does not create a new deployment and does not modify Prompt!C3.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\deploy_existing_webhook.ps1"
set EXIT_CODE=%ERRORLEVEL%

echo.
if not "%EXIT_CODE%"=="0" (
    echo ========================================
    echo [FAILED] Deployment did not complete.
    echo ========================================
    echo.
    if "%EXIT_CODE%"=="2" (
        echo Apps Script has reached the 200-version limit.
        echo Delete old unused versions in Apps Script Project History,
        echo then run deploy.bat again.
        echo Do not create a new deployment ID.
        echo.
    )
    pause
    exit /b %EXIT_CODE%
)

echo ========================================
echo [DONE] Code pushed and existing webhook updated.
echo ========================================
echo.
pause
