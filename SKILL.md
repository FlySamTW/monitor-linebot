# 🛠️ 三星電腦螢幕 LINE 客服機器人 - 專案技能手冊 (SKILL.md)

本文件記載了開發、部署與維護本機器人所必需的特殊技能與環境配置要求。

---

## 🔑 環境變數與配置要求 (Script Properties)

請確保在 Google Apps Script (GAS) 編輯器的「專案設定」→「指令碼屬性」中配置了以下關鍵變數：

| 屬性名稱 | 必填 | 說明 |
|---|---|---|
| `GEMINI_API_KEY` | 是 | 用於呼叫 Gemini AI 的 API Key (如 2.5 Flash) |
| `TOKEN` | 是 | LINE Channel Access Token |
| `DRIVE_FOLDER_ID` | 是 | 存放三星官方手冊 PDF 的 Google Drive 資料夾 ID |
| `ADMIN_USER_ID` | 否 | 管理員的 LINE UID (用於解鎖 `/重啟` 等高權限指令) |

---

## 🚀 部署技能與 Clasp 運作

### 1. 本地開發環境
- 安裝 Node.js
- 安裝 Google clasp: `npm install -g @google/clasp`
- 使用 `clasp login` 登入您的 Google 帳號。

### 2. 生產環境部署 SOP (必須完全遵循)
由於 clasp 預設會將子目錄中的 `.js` 檔強制轉化為 `.gs` 上傳至 GAS 雲端，導致變數衝突，因此必須遵守以下紅線：
* 必須在 `.claspignore` 中排除 `**/*.js` 與 `tools/**` 等本地測試檔。
* **部署指令** (已封裝於 `deploy.bat` 中)：
  ```bash
  # ⚠️ 僅 clasp push 不會更新 Webhook 生效！必須完整執行以下三步：
  clasp push -f
  clasp version "v29.6.xxx 功能描述"
  clasp deploy -i AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA
  ```

---

## 🧠 漸進式調測與自癒重建機制

當對話中 PDF 連結過期或遇到 `[KB_EXPIRED]` 錯誤時：
1. **背景自癒重建**：向機器人發送 `/重啟`，它會排程 1 分鐘後執行背景同步，自動下載與重新上傳 Drive 手冊以補齊快取。
2. **快速索引重構**：若不希望等待 GAS 超時或重新上傳，可直接在瀏覽器訪問健康檢查端點：
   `https://script.google.com/macros/s/DEPLOY_ID/exec?sync=1`
   這會立刻在 1~2 秒內重建 PDF 型號索引而不重新上傳檔案。
