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

---

_This file guides agentic coding agents working on the Samsung LINE Bot codebase. Follow these conventions to maintain code quality and system stability._
