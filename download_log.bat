@echo off
echo ========================================
echo   下載 GAS Sheet LOG 工具
echo ========================================
echo.

cd /d "%~dp0"

REM 檢查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 找不到 Python！請先安裝 Python 3.7+
    pause
    exit /b 1
)

REM 檢查必要套件
python -c "import google.oauth2" >nul 2>&1
if errorlevel 1 (
    echo 正在安裝必要套件...
    pip install google-api-python-client google-auth google-auth-oauthlib google-auth-httplib2
)

echo.
echo 正在下載 LOG 頁資料...
python tools\download_log.py

if errorlevel 1 (
    echo.
    echo ❌ 下載失敗！請確認：
    echo    1. service_account.json 存在
    echo    2. Sheet 已分享給 Service Account
    pause
    exit /b 1
)

echo.
echo ✅ LOG 已下載至 logs\ 資料夾
echo.

REM 開啟最新的 LOG 檔
for /f "delims=" %%i in ('dir /b /od logs\*.txt 2^>nul') do set LATEST=%%i
if defined LATEST (
    echo 正在開啟最新 LOG 檔...
    start notepad "logs\%LATEST%"
)

pause
