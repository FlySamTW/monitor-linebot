# AGENTS.md - Samsung LINE Bot Development Guide

## 📋 Project Overview

Google Apps Script (GAS) LINE Bot providing AI customer service for Samsung computer monitors in Taiwan. Uses Gemini 2.5 Flash + LINE Messaging API with Brain-First Architecture.

## 🔧 Build & Deployment Commands

### 🚨 完整部署流程 (MANDATORY - 每次修改後必須執行)

```bash
# ⚠️ 重要：只執行 clasp push 不會更新 LINE Webhook！
# 必須依序執行以下 4 步驟，Webhook 才會生效：

# Step 1: 推送代碼
clasp push -f

# Step 2: 建立版本快照
clasp version "v29.x.xxx 功能描述"

# Step 3: 部署到 Webhook (這步最關鍵！)
clasp deploy -i AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA

# Step 4: Git 同步
git add . && git commit -m "v29.x.xxx 功能描述" && git push

# 🔥 一行完整部署指令 (推薦使用)：
clasp push -f; clasp version "v29.x.xxx"; clasp deploy -i AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA
```

### ❌ 常見錯誤
- 只執行 `clasp push` → Webhook 不會更新，LINE 無反應
- 忘記 `clasp deploy` → 代碼已上傳但未部署到生產環境
- 使用錯誤的 Deployment ID → 部署到測試環境

### Main Commands

```bash
# Deploy to GAS (Primary)
./deploy.bat                     # Windows batch deployment
clasp push -f                   # Push code only (不會更新 Webhook!)
clasp version "description"     # Create version snapshot
clasp deploy -i DEPLOYMENT_ID   # Deploy to webhook (必須執行!)

# Git Operations (Required after each deployment)
git add .
git commit -m "version description"
git push origin main
```

### Test Commands

```bash
# Run end-to-end test via Puppeteer
cd test_runner
npm install
node verify_linebot.js

# Manual test via web interface
# Open: https://script.google.com/macros/s/{SCRIPT_ID}/exec?test=1
```

### Development Utilities

```bash
# Check logs
cat logs/*.txt

# PDF processing (if needed)
cd tools
python pdf_keyword_extractor.py
```

## 📁 File Structure & Responsibilities

```
linebot.gs          # Main application (single file, ~10300 lines)
├── CONFIG          # Global constants & settings
├── BRAIN LAYER     # AI routing & decision logic ⭐
├── CORE LAYER      # Message handling & LLM calls
├── COMMAND LAYER   # /restart, /record commands
├── DATA LAYER      # Sheet & Cache operations
├── SYNC LAYER      # Knowledge base synchronization
├── UTILITY LAYER   # Formatting & helper functions
└── RECORD LAYER    # QA entry system

CLASS_RULES.csv     # Product specs & keyword definitions
QA.csv              # Curated Q&A database
Prompt.csv          # AI system prompts
TestUI.html         # Web testing interface
```

## 🎯 Code Style & Conventions

### JavaScript Style (GAS Environment)

```javascript
// ✅ Correct: Block style, explicit braces
if (condition) {
  doSomething();
  return result;
}

// ❌ Wrong: Single-line, ternary for complex logic
if (condition) return doSomething();

// ✅ Correct: GAS-specific APIs
const apiKey =
  PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
const cache = CacheService.getScriptCache();
const lock = LockService.getScriptLock();

// ✅ Correct: Async/await in GAS
async function callAPI() {
  try {
    const response = await UrlFetchApp.fetch(url, options);
    return response.getContentText();
  } catch (error) {
    writeLog(`[API Error] ${error.message}`);
    throw error;
  }
}
```

### Naming Conventions

```javascript
// Constants: UPPER_SNAKE_CASE
const SHEET_NAMES = { QA: "QA", LOG: "LOG" };
const CACHE_KEYS = { KB_URI_LIST: "kb_list_v15_0" };

// Functions: camelCase with descriptive names
function handleMessage(userId, msg) {}
function getRelevantKBFiles(query, exactModels) {}
function callLLMWithRetry(params) {}

// Variables: camelCase
let userMessage = "";
const filteredFiles = [];
```

### Error Handling & Logging

```javascript
// ✅ Structured logging with tags
writeLog(`[KB Select] 🎯 Found models: ${models.join(", ")}`);
writeLog(`[API Error] ${error.message}`);
writeLog(`[Fatal] ${error.stack}`);

// ✅ Graceful error handling
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  writeLog(`[Operation Failed] ${error.message}`);
  return fallbackValue;
}

// ✅ User-friendly error messages
if (apiError) {
  return "⚠️ 系統忙碌中，請稍後再試。";
}
```

### Version Management

```javascript
// ✅ Always update version after code changes
const GAS_VERSION = "v29.5.129"; // Format: vMajor.Minor.Patch
// 每次修改後必須更新版本號
```

## 🧠 AI Logic & Prompt Guidelines

### System Architecture

```
User Message → Direct Search Check → Fast Mode (QA+Rules)
                                        ↓
                                    AI Decision
                                   /          \
                              [Answer]    [AUTO_SEARCH_PDF]
                                             ↓
                                       Deep Mode (PDF)
                                             ↓
                                       [Answer] or [AUTO_SEARCH_WEB]
```

### Quick Reply 按鈕系統 (v29.5.129)

LINE 回覆訊息底部附帶 Quick Reply 按鈕，用戶點擊後發送帶 `#` 前綴的命令：

| 按鈕 | text | 顯示條件 | 處理方式 |
|------|------|----------|----------|
| 💬 再詳細說明 | `#再詳細說明` | 永遠 | 改寫 msg 後**不 return**，走正常流程帶完整 5 輪對話歷史 |
| 📖 查PDF手冊 | `#查手冊` | `hasPdfForModel=true` | 獨立 handler，從歷史找問題 → getRelevantKBFiles → callLLMWithRetry |
| 🌐 網路搜尋 | `#搜尋網路` | 永遠 | 呼叫 handleCommand 觸發 Web Search |

**⚠️ 關鍵注意**：`#再詳細說明` handler 不 return，會繼續走到 `const userMsgObj` 宣告處。
因此 handler 內部**禁止**對 `userMsgObj` 賦值（V8 TDZ 會拋 ReferenceError）。
只需改寫 `msg` 和 `userMessage`，後面的 `const userMsgObj = { role: "user", content: msg }` 會自動使用改寫後的值。

### Prompt Engineering Rules

```javascript
// ✅ Use structured system instructions
const systemPrompt = `
【角色】台灣三星電腦螢幕服務專員
【語氣】用「你」不用「您」，朋友式口吻
【邏輯】QA資料庫 > CLASS_RULES > PDF手冊 > 網路搜尋
【暗號】[AUTO_SEARCH_PDF] 觸發深度搜尋
`;

// ✅ Dynamic context injection
function buildDynamicContext(query, userId) {
  let context = loadQADatabase();
  context += loadProductRules(query);
  return context;
}
```

### Response Format Standards

```javascript
// ✅ Consistent response formatting
function formatForLineMobile(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1") // Remove markdown
    .replace(/\->/g, "→") // Arrow conversion
    .replace(/([。！？])/g, "$1\n\n"); // Line breaks
}
```

## 🔐 Security & Configuration

### Required Script Properties

```javascript
// Set in GAS Editor → Project Settings → Script Properties
GEMINI_API_KEY; // Gemini AI API key (Required)
TOKEN; // LINE Channel Access Token (Required)
DRIVE_FOLDER_ID; // PDF storage folder (Optional)
ADMIN_USER_ID; // Admin LINE ID (Optional)
```

### Cache Strategy

```javascript
// Short-term: ScriptCache (6 hours max)
cache.put("user_state", data, 3600); // 1 hour TTL

// Medium-term: Sheet storage
writeRecordDirectly(userId, message, contextId, role, flag);

// Long-term: PropertiesService for configuration
PropertiesService.getScriptProperties().setProperty(key, value);
```

## 🚨 Critical Development Rules

### Deployment Protocol (MANDATORY)

1. **Update version number** in `linebot.gs` (GAS_VERSION)
2. **Update prompt version** in `Prompt.csv` if changed
3. **Test locally** via TestUI if possible
4. **Run deployment**: `clasp push -f`
5. **Create version**: `clasp version "description"`
6. **Deploy webhook**: `clasp deploy -i DEPLOYMENT_ID`
7. **Commit to git**: `git add . && git commit -m "version" && git push`

### Code Modification Guidelines

```javascript
// ✅ Safe to modify: Utility functions, formatting, logging
function formatMessage(text) {}

// ⚠️ Modify with caution: Core business logic
function handleMessage(userId, msg) {}

// 🚨 Modify very carefully: AI routing & PDF selection
function getRelevantKBFiles(query, exactModels) {}
```

### V8 TDZ (暫時性死區) 注意事項

```javascript
// ❌ 危險：在同一 block 中，const 宣告前賦值會 ReferenceError
if (condition) {
  userMsgObj = { ... };  // 💥 ReferenceError: Cannot access before initialization
}
const userMsgObj = { ... };  // TDZ 從 block 開頭到此行

// ✅ 正確：只改寫 let 變數，讓後面的 const 自動使用新值
if (condition) {
  msg = newValue;         // ✅ msg 是 let，可以改
  userMessage = newValue; // ✅ userMessage 是 let，可以改
}
const userMsgObj = { role: "user", content: msg };  // 自動用改寫後的 msg
```

### Knowledge Base Management

```csv
# CLASS_RULES.csv format
"關鍵字,定義/類型,備註,完整說明"
"Odyssey3D,型號辨識,裸視3D電競螢幕(G90XF),..."

# QA.csv format
"問題 / 答案內容"
"M8 和 M9 有陀螺儀嗎？ / A：是的，M8 和 M9 有陀螺儀和 HAS..."
```

### Testing Strategy

```javascript
// ✅ Always test critical flows
1. Direct keyword triggers (G5, M8, Odyssey3D)
2. PDF selection and loading
3. Fallback mechanisms ([AUTO_SEARCH_WEB])
4. Error handling (API failures, token limits)
```

## 📊 Performance & Monitoring

### Token Management

- Fast Mode: <25K tokens (QA + Rules only)
- Deep Mode: <50K tokens (with 1-2 PDFs max)
- Emergency fallback: Strip all PDFs if API fails

### Logging Standards

```javascript
writeLog(`[Stage] Action: details`);
// Examples:
writeLog(`[KB Select] 🎯 Found models: S27AG500NC`);
writeLog(`[API Stats] 1.2s | In: 25K / Out: 200 | Cost: NT$0.08`);
writeLog(`[Fatal] ${error.message}`);
```

## ⛔️ 雲端安全與超時崩潰防禦鐵律 (NEVER FORGET)

為了確保生產環境 Webhook 的 100% 絕對穩定存活，任何開發者/AI 代理人必須死守以下三條崩潰防禦紅線：

### 1. 徹底隔離非 GAS 執行代碼 (Clasp Glob 排除)
* **現象**：GAS 雲端不支援 `.js`，使用 `clasp push` 時會自動把子目錄下的本地工具（如 `tools/*.js`）強制轉換為雲端 `*.gs` 加載，引發變數重複宣告（如 `CONFIG`）的致命 `SyntaxError`，導致整個 Webhook 於編譯階段當場癱瘓。
* **鐵律**：必須在 `.claspignore` 中以 `**/*.js` 與 `tools/**` 進行地毯式過濾，確保非 GAS 的本地測試/爬蟲腳本絕不推送上雲。

### 2. 嚴格杜絕 LINE Webhook 同步超時 (5秒回應紅線)
* **現象**：LINE Webhook 規定伺服器必須在 5 秒內返回 HTTP 回應。若在 LINE 回應的主線程中執行重型同步任務（如 `syncGeminiKnowledgeBase(true)` 強制完全重建），將因執行超時被 LINE 斷開，造成用戶端「完全沒有反應」。
* **鐵律**：主線程中禁止執行大於 2 秒的重型任務！重建與同步任務必須呼叫 `scheduleImmediateRebuild()`，以雲端背景非同步自癒的方式在 1 分鐘後執行，讓 doPost 立即在 0.2 秒內返回回應。

### 3. 對齊專案既有 A 欄 CSV 大字串儲存架構
* **現象**：`CLASS_RULES` 在 Google Sheet 上的既有設計是「整行逗號分隔的 CSV 字串通通塞在 A 欄，並不展開」。若自作聰明展開寫入，會導致 GAS 在處理時因欄位錯位拋出 Runtime Exception 崩潰。
* **鐵律**：追加新機型時必須保持 A 欄單欄位大字串寫入。防重複比對必須使用 `existing.some(line => line.startsWith(model))`，確保架構 100% 完美相容。

### 4. 永遠禁止因 PowerShell 終端機編碼誤判檔案內容
* **現象**：Windows PowerShell 預設 codepage 是 Big5 (CP950)，當檔案內容是 UTF-8 中文時，終端機會把 byte 序列 decode 成「??」或亂碼。**這純粹是顯示問題，檔案內容 100% 正確**。
* **曾犯的錯**：過去曾因終端機亂碼花時間「驗證檔案是否壞掉」、誤以為 edit 工具沒寫入、用 `[Math]::Min(...)` 截斷驗證等。**這些都浪費時間且無意義**。
* **鐵律**：
  1. 看到終端機顯示 `??` 亂碼時，**不要懷疑檔案**，檔案絕對是正確的繁體中文 UTF-8
  2. **正確驗證方式**：用 `[System.IO.File]::WriteAllText($tmp, $utf8, [System.Text.Encoding]::UTF8)` 寫入暫存檔，再用 `Get-Content -Encoding UTF8` 讀取
  3. 或**直接用 [Console]::OutputEncoding = [System.Text.Encoding]::UTF8** 設終端機 UTF-8
  4. 或**用 [System.Text.Encoding]::UTF8.GetString($bytes)** 強制解碼
  5. **永遠不要**反覆重新部署同一個已知正確的改動，純粹是浪費時間
  6. 如果檔案用 `read` 工具讀到正確中文、edit 工具寫入成功、clasp push 成功、health check 回 200，**這 4 個證據鏈完整就夠了，不要再因終端機亂碼而重複驗證**

### 5. PDF 檔名規則（依第一頁型號 OCR + 逗號分隔，無國家碼）
* **現象**：Drive 既有 PDF 命名規則是**型號本體**（如 `S24A600` `C24F390` `C27G55,C32G55`），**不含國家碼**（不是 `S24A600NAC` `S24A600NWC`）。若自作聰明加國家碼或依 Samsung 原始檔名（如 `BN81-XXX_240226.1.pdf`）會造成 KB_PDF INDEX 錯位，AI 找不到對應型號。
* **鐵律**：
  1. **必須用 PyMuPDF 讀第一頁文字**，regex 抓 `\b(?:LS|S|LC|C)(?:\d{1,3}[A-Z]*\d*[A-Z]*|M\d+[A-Z]*)\b` 提取所有型號
  2. **去掉尾端國家碼**（`NC/UC/NAC/NWC/GAC/UBC/UXC/UIC/SC/EC/EF/WC/XC/ES`）用 `re.sub(r"[A-Z]{1,3}$", "", m)`
  3. **逗號分隔 + 排序去重**：`",".join(sorted(set(stripped))) + ".pdf"`
  4. **特殊情況**：M 系列通用手冊（第一頁無具體型號）→ 採子代理慣例簡稱如 `S32CM703.pdf`
  5. **範例對照**：
     * 錯：`S24A600NAC.pdf` / `BN81-24425G-02_WEB_M50C_240226.1.pdf`
     * 對：`S24A600.pdf` / `S24A600,S27A600.pdf` / `C27G55,C32G55.pdf`
  6. **上船前比對**：用 sha256 比對 Drive 是否已有同名檔，刪除重複；用 set 比對型號是否被 Drive 既有檔案覆蓋

### 6. Google 技術盤點 (已用 vs 未用) - v29.6.028 統計

#### ✅ 已使用 (11 種 Google 服務 + Gemini Files API)

| 技術 | 次數 | 用途 |
|---|---|---|
| PropertiesService | 72 | API Key/Secret 配置 |
| ContentService | 65 | HTTP 回應 (doGet/doPost) |
| Trigger | 51 | 每日 04:00 排程 sync |
| CacheService | 46 | 短期快取 (QA Cache) |
| UrlFetchApp | 27 | 外部 API 呼叫 (Gemini/LINE) |
| SpreadsheetApp | 17 | Google Sheet 讀寫 (CLASS_RULES/QA/PROMPT) |
| DriveApp | 6 | Drive 掃描 PDF |
| LockService | 6 | 並行鎖 |
| ScriptApp | 8 | 部署資訊 |
| HtmlService | 1 | TestUI 介面 |
| **Gemini Files API** | 6 函數 | uploadFileToGemini, getRelevantKBFiles, ... (100 個 PDF 已上傳) |
| **Gemini :generateContent** | 6 endpoint | LLM 對話 |
| **Thinking Mode** | 15 次 | AI 思考預算 |
| **groundingMetadata** | 3 次 | 引用來源 |
| **RAG 架構** | 1 處 | 規格庫+QA+PDF 知識庫檢索 |

#### ❌ 尚未使用 (Google 最新技術, 升級空間大)

| 技術 | 用途 | 預期效益 |
|---|---|---|
| **File Search API** (Gemini 2025 新) | 取代自建 SmartRetrieval | ⚠️ **不建議升級** (見下方) |
| **Google Search Grounding** | 即時網路搜尋 | 不需手寫爬蟲 |
| **Function Calling** | AI 主動呼叫函數 | 自動化操作 |
| **Structured Output** | JSON Schema 強制格式 | 結構化回應 |
| **Cached Content** | 長 context 快取 | 成本 -80% |
| **Embeddings** | 語意搜尋 | 取代關鍵字 |
| **Code Execution** | AI 跑 Python | 進階分析 |
| **Live API (Realtime)** | 語音對話 | 多模態 |
| **Image Gen (Imagen 3)** | 文字生圖 | 產品圖 |

#### 🚀 下代升級優先級

1. **Cached Content** - ⚠️ **暫時禁用**: API 限制 400 (見下方) (已記錄)
2. **Google Search Grounding** - ❌ **不適用**: 我們邏輯是「找不到才搜, 自動搜會破壞封閉式」 (已記錄)
3. **File Search API** - ❌ **不建議**: 需改 `interactions.create` API, 純 GAS 無 SDK, 有 storage/query 費用, 對精確型號匹配沒效益

#### ⚠️ File Search 升級風險分析 (2026-06-25 查證)

- 必須從 `:generateContent` 改 `interactions.create` (整個 linebot.gs 改寫)
- 純 GAS 無法用 `google-genai` SDK, 必須手刻 REST
- 6 分鐘 GAS 上限可能撞到 File Search ingestion 等待
- 計費: 存儲 + embedding + 查詢
- grounding metadata 暫不支援 Interactions API
- 我們現有 Files API + 關鍵字比對已穩定運作 (100 PDF), 改 File Search 效益有限

#### ⚠️ Cached Content 升級風險 (2026-06-25 實測失敗 v29.6.029-031)

- **API 限制**: `cached_content` 不能與 `system_instruction` + `tools` 同時使用
- **錯誤訊息**: `CachedContent can not be used with GenerateContent request setting system_instruction, tools or tool_config. Proposed fix: move those values to Cache`
- **現有架構**: linebot.gs 5600 行附近用 `systemInstruction: { parts: [{ text: dynamicPrompt }] }` + `tools: tools` (google_search 等)
- **重構成本**: 必須把 12K 規格庫 + systemInstruction + tools **全部移到 cache 內**, 改變整個 prompt 結構
- **風險**: 重構失敗會造成整個 AI 問答崩潰
- **結論**: 暫時禁用, 寫好 TODO 等未來重構

#### ⚠️ Google Search Grounding 不適用原因 (2026-06-25)

- **專案邏輯** (用戶原話): 「一律先自建 QA/RULE/官方 PDF, 若都沒有才搜尋網路, 否則是封閉的, 連動用自己知識庫都不準」
- **現有邏輯**: `#搜尋網路` 觸發才搜, 找不到來源就拒答或標記 `[來源:規格庫缺失]`
- **Search Grounding 預設**: **每次**問答都自動搜尋網路
- **衝突**: 會破壞封閉式知識庫鐵律, 讓 AI 用網路資訊污染回答
- **結論**: 不啟用 Search Grounding, 維持現有 `#搜尋網路` 按需觸發

---

_This file guides agentic coding agents working on the Samsung LINE Bot codebase. Follow these conventions to maintain code quality and system stability._
