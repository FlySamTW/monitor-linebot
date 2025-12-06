# Copilot Instructions - LINE Bot 三星螢幕客服 (GAS)

## ⚠️ 開發鐵律 (Development Iron Rules)
1. **每次修改代碼後，必須更新 `linebot.gs` 頂部的版本號 (Version)。**
2. **每次修改完成後，必須執行 `clasp push -f` 推送至 GAS。**
3. **Prompt 修改必須在 `Prompt.csv` 進行，禁止硬編碼在 `linebot.gs`。**

## 專案概述
Google Apps Script (GAS) 專案，整合 LINE Messaging API + Gemini 2.5 Flash，為台灣三星電腦螢幕提供 AI 客服。

**核心架構**: Brain-First Architecture（Version 22.0.0）
**自動召喚機制**: `[AUTO_SEARCH_PDF]` 暗號觸發自動深度搜尋

## 關鍵角色
- **Sam**：開發者，同時也是群組中的真人客服。當 AI 無法回答時，會引導使用者「找 Sam」

## 程式架構（Brain-First）

```
linebot.gs 區塊順序（約 700 行）：
├── 0. 全域設定 (CONFIG, SHEET_NAMES, CACHE_KEYS)
├── 1. BRAIN LAYER - AI 大腦層 ⭐ 最重要
│   ├── aiRouter() - 智慧路由決策
│   ├── checkDirectDeepSearch() - 直通車檢查
│   ├── buildSystemPrompt() - 動態 Prompt 注入
│   ├── buildKeywordMap() - KEYWORD_MAP 建構
│   ├── getRelevantKBFiles() - PDF 智慧選擇
│   └── checkAutoSearchSignal() - [AUTO_SEARCH_PDF] 攔截
├── 2. CORE LAYER - 核心業務層
├── 3. COMMAND LAYER - 指令處理層
├── 4. DATA LAYER - 資料存取層
├── 5. SYNC LAYER - 知識庫同步層
├── 6. UTILITY LAYER - 工具函數層
├── 7. RECORD MODE LAYER - 建檔模式層
└── 8. TRIGGERS - 觸發器設定
```

## 知識庫分層架構

| 資料源 | 用途 | 優先級 | 觸發時機 |
|--------|------|--------|----------|
| **QA Sheet** | 精選問答，高命中率的常見問題 | 🥇 最優先 | 永遠載入 |
| **CLASS_RULES** | 型號規格 + 術語定義，建立 KEYWORD_MAP | 🥈 第二 | 永遠載入 |
| **PDF 手冊** | 詳細操作步驟、OSD 路徑、故障排除 | 🥉 第三 | 自動召喚/深度搜尋 |

### 資料用途說明
- **QA**：已驗證的問答對，AI 可直接引用回答
- **CLASS_RULES**：
  - `LS` 開頭 → 機型硬體規格（耳機孔、解析度、Hz 等）
  - 其他 → 術語定義（Odyssey、OLED、1000R 等）
  - 自動生成 `KEYWORD_MAP` 供 RAG 擴充查詢
- **PDF**：操作手冊，用於「怎麼設定 XXX」這類需要步驟的問題

## 架構關鍵點

### 單一入口檔案 `linebot.gs`
- 所有邏輯集中於此，約 700 行
- **版本規範**：強制 Block Style 展開，拒絕單行縮寫
- 區塊以 `// ========` 註解分隔（共 8 個主要區塊）

### 資料流
```
LINE Webhook → doPost() → handleMessage() → callChatGPTWithRetry()
                                                    ↓
                                           getRelevantKBFiles() ← KEYWORD_MAP
                                                    ↓
                                              Gemini API + PDF/Sheet
```

### 知識庫同步 (`syncGeminiKnowledgeBase`)
- **觸發**：`/重啟` 指令或 47 小時自動排程
- **資料分流**：`LS` 開頭 → 機型規格 / 其他 → 通用定義
- PDF 使用 Resumable Upload，上傳後等待 `ACTIVE` 狀態

## 編碼規範

### GAS 特殊語法
```javascript
// 正確：使用 PropertiesService 存取設定
const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");

// 正確：使用 LockService 防止並發
const lock = LockService.getScriptLock();
if (!lock.tryLock(120000)) return;

// 正確：使用 CacheService 短期快取 (最長 6 小時)
CacheService.getScriptCache().put(key, value, 3600);
```

### 常數命名
- Sheet 名稱：`SHEET_NAMES.QA`, `SHEET_NAMES.CLASS_RULES`
- 快取鍵值：`CACHE_KEYS.KB_URI_LIST`, `CACHE_KEYS.KEYWORD_MAP`
- 設定：`CONFIG.MODEL_NAME`, `CONFIG.MAX_OUTPUT_TOKENS`

### 必要的 Script Properties
| Key | 必要 | 說明 |
|-----|------|------|
| `GEMINI_API_KEY` | ✅ | Gemini API 金鑰 |
| `TOKEN` | ✅ | LINE Channel Access Token |
| `DRIVE_FOLDER_ID` | 選填 | PDF 手冊資料夾 |

## 三階段 AI 策略 + 自動召喚機制

### 流程圖
```
使用者訊息
    ↓
aiRouter() 判斷路由
    ├── DIRECT (直通車關鍵字) → 強制附帶 PDF
    ├── DEEP (使用者輸入 1/深度) → 附帶 PDF
    └── FAST (預設) → 只用 Sheet
           ↓
    callGeminiWithRoute()
           ↓
    AI 回應包含 [AUTO_SEARCH_PDF]?
        ├── 是 → 自動重試 (isRetry=true) → 附帶 PDF
        └── 否 → 直接回覆使用者
```

### 關鍵參數
- `isRetry`: 防止無限循環，重試模式下禁止再輸出 `[AUTO_SEARCH_PDF]`
- 直通車關鍵字: `G90XF`, `G95SC`, `G80SD`, `G81SF`, `ViewFinity`, `Smart Monitor`, `OLED`, `Odyssey3D`

### 直通車（強制深度）
```javascript
// 在 checkDirectDeepSearch() 中的關鍵字
const strongKeywords = [
  "G90XF", "G95SC", "G80SD", "G81SF",
  "ViewFinity", "Smart Monitor",
  "OLED", "Odyssey3D"
];
```

## CLASS_RULES.csv 格式
```csv
"關鍵字,定義/類型,備註,完整說明"
"Odyssey3D,型號辨識,裸視3D電競螢幕(G90XF),..."
"LS32DG802SCXZW,型號：G80SD,32吋Odyssey OLED G8...,詳細規格..."
```
- **分流規則**：`LS` 開頭 → 機型規格區 / 其他 → 定義區
- 關鍵字會自動建立 `KEYWORD_MAP` 供 RAG 擴充查詢

## 指令系統
| 指令 | 功能 |
|------|------|
| `/重啟` | 清除對話 + 同步知識庫 |
| `/紀錄 <內容>` | 進入建檔模式 |
| `/紀錄` | 存檔或自動整理 QA |
| `/取消` | 退出建檔模式 |

## 文字格式化規則
- `formatForLineMobile()`：移除 Markdown、轉全形標點、`->` 改 `→`
- `sanitizeForSheet()`：移除換行、逗號轉全形，供 Sheet 單欄儲存
- 句尾強制換行（`。！？` 後加 `\n\n`）

## 除錯與日誌
- 所有日誌寫入 `LOG` Sheet：`writeLog("[Tag] message")`
- 對話紀錄寫入 `所有紀錄` Sheet
- 事件去重：`isDuplicateEvent()` 使用 60 秒快取

## 常見修改情境

### 新增產品型號
1. 編輯 `CLASS_RULES.csv` 新增規格行
2. 執行 `/重啟` 同步知識庫

### 調整 AI 行為
- 修改 `Prompt.csv` 的 C3 儲存格（System Prompt）
- Temperature 在 B3 儲存格（建議 0.6）

### 新增直通車關鍵字
```javascript
// 在 isDirectDeepSearch() 中新增
const strongKeywords = ["G90XF", "G95SC", "G80SD", "G81SF", "新關鍵字"];
```

## LLM 回答邏輯 (Prompt.csv C3)

### 核心原則
1. **硬體規格**：必須從 CLASS_RULES 交叉驗證，規格清單沒寫 = 沒有此功能
2. **操作步驟**：Sheet 沒有就加 `[NEED_DOC]`，觸發深度搜尋
3. **查無資料**：直接引導找 Sam，禁止瞎掰

### 回答策略
| 情境 | 處理方式 |
|------|----------|
| 模糊型號 (如「G8」) | 列出所有 G8 型號，詢問是哪一款 |
| 規格衝突 | 保守回答「不確定，問 Sam」 |
| 商業機密 | 幽默拒絕 |
| 連續追問無解 | 第四輪後引導找 Sam |

### 禁止事項
- 禁止使用「您」，只能用「你」
- 禁止提供 PDF/QA 以外的建議
- 禁止概括回答「G8 系列都有...」（不同型號規格可能不同）

## 本地開發工具 (tools/)

### PDF 關鍵字擷取
```bash
pip install pymupdf
python tools/pdf_keyword_extractor.py "D:\Samsung_Manuals\" -o keywords.json
```

### Google Sheet 同步
```bash
pip install google-api-python-client google-auth
python tools/sheet_sync.py -s SHEET_ID read CLASS_RULES
python tools/sheet_sync.py -s SHEET_ID add-qa -q "問題" -a "答案"
```
