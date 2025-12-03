@echo off
echo ========================================
echo   GAS 開發環境初始化
echo ========================================
echo.

cd /d "%~dp0"

echo [1/4] 檢查 Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 找不到 Node.js！
    echo    請先下載安裝：https://nodejs.org/
    echo    選擇 LTS 版本
    pause
    exit /b 1
)
echo ✅ Node.js 已安裝

echo.
echo [2/4] 安裝 CLASP...
call npm install -g @google/clasp
if errorlevel 1 (
    echo ❌ CLASP 安裝失敗
    pause
    exit /b 1
)
echo ✅ CLASP 已安裝

echo.
echo [3/4] 登入 Google 帳號...
echo    （會開啟瀏覽器進行授權）
call clasp login
if errorlevel 1 (
    echo ❌ 登入失敗
    pause
    exit /b 1
)
echo ✅ 已登入

echo.
echo ========================================
echo [4/4] 連結 GAS 專案
echo ========================================
echo.
echo 請到你的 GAS 專案：
echo   1. 點選「專案設定」（齒輪圖示）
echo   2. 複製「指令碼 ID」
echo.
set /p SCRIPT_ID="請貼上 Script ID: "

if "%SCRIPT_ID%"=="" (
    echo ❌ 未輸入 Script ID
    pause
    exit /b 1
)

echo.
echo 正在連結專案...
call clasp clone %SCRIPT_ID% --rootDir .
if errorlevel 1 (
    echo.
    echo ❌ 連結失敗！請確認：
    echo    1. Script ID 正確
    echo    2. 已啟用 Apps Script API
    echo       https://script.google.com/home/usersettings
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ 初始化完成！
echo ========================================
echo.
echo 現在你可以使用：
echo   - deploy.bat      一鍵部署程式碼
echo   - download_log.bat 下載 LOG 記錄
echo.
echo ⚠️ 還需要設定 LOG 下載功能：
echo   1. 編輯 tools\download_log.py
echo   2. 將 SPREADSHEET_ID 改成你的 Sheet ID
echo   3. 設定 Service Account（見 tools\README.md）
echo.
pause
