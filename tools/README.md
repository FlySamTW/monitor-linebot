# 本地開發工具

## 📁 工具清單

| 工具 | 用途 |
|------|------|
| `setup_clasp.bat` | 一次性設定 CLASP 環境（首次使用） |
| `deploy.bat` | 一鍵推送程式碼 + 建立新版本 |
| `download_log.bat` | 下載 LOG + 對話紀錄 |
| `pdf_keyword_extractor.py` | PDF 關鍵字擷取 |
| `sheet_sync.py` | Sheet 讀寫工具 |
| `download_log.py` | LOG 下載核心程式 |

---

## 🚀 快速開始（GAS 部署）

### 步驟 1：初始化 CLASP（僅需一次）

雙擊執行根目錄的：
```
setup_clasp.bat
```

會自動：
1. 安裝 CLASP（Google 官方 Apps Script CLI）
2. 登入 Google 帳號
3. 連結你的 GAS 專案

### 步驟 2：設定 LOG 下載

1. **建立 Service Account**
   - 前往 [Google Cloud Console](https://console.cloud.google.com/)
   - 建立專案 → API 和服務 → 憑證
   - 建立憑證 → 服務帳戶
   - 下載 JSON 金鑰，命名為 `service_account.json`
   - 放到專案根目錄

2. **分享 Sheet 給 Service Account**
   - 打開 `service_account.json`
   - 複製 `client_email` 欄位的 Email
   - 到 Google Sheet → 共用 → 加入該 Email（檢視者權限即可）

3. **設定 Sheet ID**
   - 編輯 `tools/download_log.py`
   - 將 `SPREADSHEET_ID = "YOUR_SPREADSHEET_ID_HERE"` 
   - 改成你的 Sheet ID（從 Sheet 網址複製）

---

## 📦 日常使用

### 部署程式碼（根目錄）
```
deploy.bat
```
效果：
- 推送 `linebot.gs` 到 GAS
- 自動建立新版本（時間戳記）
- 提醒你到 GAS 更新部署（如需更新 Webhook）

### 下載 LOG（根目錄）
```
download_log.bat
```
效果：
- 下載 `LOG` 頁資料
- 下載 `所有紀錄` 頁對話記錄
- 儲存到 `logs/` 資料夾
- 自動開啟最新 LOG 檔

---

# PDF 關鍵字擷取工具

從 PDF 手冊前三頁擷取型號、系列名、規格關鍵字，用於建立 `KEYWORD_MAP`。

## 安裝依賴

```bash
pip install pymupdf
```

## 使用方式

### 分析單一 PDF
```bash
python pdf_keyword_extractor.py "G80SD_使用手冊.pdf"
```

### 分析整個資料夾
```bash
python pdf_keyword_extractor.py "D:\Samsung_Manuals\"
```

### 輸出 JSON 檔案
```bash
python pdf_keyword_extractor.py "D:\Samsung_Manuals\" -o keywords.json
```

## 輸出範例

```json
{
  "file": "G80SD_使用手冊.pdf",
  "models": ["G80SD", "LS32DG802SC", "S32DG802SC"],
  "series": ["Odyssey", "OLED", "G8"],
  "specs": ["32吋", "4K", "240Hz", "OLED"],
  "suggested_keywords": ["G80SD", "LS32DG802SC", "Odyssey"]
}
```

## 型號識別規則

| 模式 | 範例 |
|------|------|
| 完整型號 | LS32DG802SCXZW |
| 簡化型號 | S32DG802SC, G80SD |
| 系列代號 | G9, G8, M8, S9 |

## 與 GAS 整合

產生的 `keyword_map` 可用於更新 `getRelevantKBFiles()` 中的關鍵字映射。
