# CLASP 設定指南 - GAS 自動部署工具

## 什麼是 CLASP？
Google 官方的 Apps Script CLI 工具，可以：
- 從本機推送 `.gs` 檔案到 GAS
- 建立新版本（對應「管理部署 → 新增版本」）
- 下載 Sheet 資料

## 一次性設定（約 10 分鐘）

### 步驟 1：安裝 Node.js
下載並安裝：https://nodejs.org/（選 LTS 版本）

### 步驟 2：安裝 CLASP
```powershell
npm install -g @google/clasp
```

### 步驟 3：登入 Google 帳號
```powershell
clasp login
```
會開啟瀏覽器授權，選擇你的 Google 帳號

### 步驟 4：啟用 Apps Script API
前往：https://script.google.com/home/usersettings
將「Google Apps Script API」開啟

### 步驟 5：複製你的 Script ID
1. 開啟你的 GAS 專案
2. 點選「專案設定」（齒輪圖示）
3. 複製「指令碼 ID」

### 步驟 6：初始化專案連結
在 `d:\00_程式\20251125_GAS客服LineBot\` 目錄執行：
```powershell
clasp clone <你的 Script ID>
```

這會建立 `.clasp.json` 檔案，之後就可以用 BAT 一鍵操作了！

---

## 檔案結構
```
20251125_GAS客服LineBot/
├── .clasp.json          ← CLASP 設定（自動產生）
├── appsscript.json      ← GAS 專案設定（自動產生）
├── linebot.gs           ← 主程式
├── deploy.bat           ← 一鍵部署
├── download_log.bat     ← 一鍵下載 LOG
└── tools/
    └── download_sheet.py
```
