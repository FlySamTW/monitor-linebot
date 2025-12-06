# LLM 回答邏輯調整歷程

此文件記錄所有客服 LLM 回答邏輯的調整（非程式碼錯誤修正）。
每次更新請依照格式新增於最上方。

---

## Version 24.4.4 - PDF 智慧匹配修復 + 反問流程優化
**日期**: 2025/12/06  
**類型**: Bug Fix / Flow Optimization

### 問題背景

v24.4.0~24.4.3 的 PDF 智慧匹配功能有多個嚴重問題：
1. 反問時附加了 Fast Mode 的錯誤回答（既然需要查 PDF，Fast Mode 回答就是錯的）
2. `updateHistorySheetAndCache` 參數順序錯誤導致 history 格式錯亂
3. `getRelevantKBFiles` 假設所有 messages 都有 content，導致 `undefined.toUpperCase()` 錯誤
4. 反問時更新 history 為「等待用戶選擇型號」，污染對話記錄

### 修復內容

#### 1. 反問流程優化

**之前（錯誤）**：
```
用戶：「M8 視訊鏡頭怎麼用」
  ↓
Fast Mode 回答：「根據我的資料庫...（錯誤內容）」
  ↓
反問：「Fast Mode 回答...\n---\nM8 有幾個版本...」
```

**現在（正確）**：
```
用戶：「M8 視訊鏡頭怎麼用」
  ↓
Fast Mode 判斷：需要查 PDF → 輸出 [AUTO_SEARCH_PDF]
  ↓
直接反問：「Smart Monitor M8 有幾個版本...」
（不顯示 Fast Mode 的錯誤回答）
```

#### 2. History 更新時機

**之前（錯誤）**：
- 反問時就更新 history → `「等待用戶選擇型號」` 進入對話記錄
- 下次讀取 history 時格式錯亂 → API 400 錯誤

**現在（正確）**：
- 反問時**不更新** history
- 等用戶選擇型號後，一次性更新：`原始問題 → AI 回答`

#### 3. 防護性程式碼

```javascript
// v24.4.4: 防護 undefined.toUpperCase() 錯誤
for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg && msg.content && typeof msg.content === 'string') {
        combinedQuery += " " + msg.content.toUpperCase();
    }
    ...
}
```

### 完整流程圖（v24.4.4 修正版）

```
用戶問產品相關問題（如「M8 視訊鏡頭怎麼用」）
  ↓
直通車命中 M8 → 記錄關鍵字到 Cache（不開 PDF Mode）
  ↓
Fast Mode（QA + CLASS_RULES，不帶 PDF）
  ↓
AI 判斷：資料不足 → 輸出 [AUTO_SEARCH_PDF]
  ↓
檢測到 [AUTO_SEARCH_PDF] + 有直通車關鍵字
  ↓
searchPdfByAliasPattern("M8") → 從 CLASS_RULES 提取型號模式
  ↓
┌─────────────────────────────────────────────────────┐
│ 0 個匹配 → 引導找 Sam                               │
│ 1 個匹配 → 直接載入 PDF，重新回答                   │
│ 多個匹配 → 反問用戶選擇（不更新 history）           │
└─────────────────────────────────────────────────────┘
  ↓ [多個匹配]
系統反問：「M8 有幾個版本，請問型號開頭是？」
  ↓
用戶回覆「2」
  ↓
handlePdfSelectionReply() 處理
  ↓
showLoadingAnimation() → 顯示打字中（最長 60 秒）
  ↓
注入型號到 Cache → 載入對應 PDF → 用原始問題重新呼叫 API
  ↓
回覆用戶（含 Token 花費顯示）
  ↓
更新 history（原始問題 → AI 回答）
```

### 修復的錯誤清單

| 版本 | 錯誤 | 修復 |
|------|------|------|
| v24.4.0 | 觸發時機錯誤（直通車+操作類就反問） | 改為 `[AUTO_SEARCH_PDF]` 時才觸發 |
| v24.4.1 | 缺少 Loading 動畫 | 加入 `showLoadingAnimation(userId, 60)` |
| v24.4.2 | 缺少 Token 花費顯示 | 加入 `DEBUG_SHOW_TOKENS` 支援 |
| v24.4.3 | `updateHistorySheetAndCache` 參數錯誤 | 修正參數順序 `(cid, prev, uMsg, aMsg)` |
| v24.4.4 | 反問附加 Fast Mode 錯誤回答 | 直接反問，不附加 |
| v24.4.4 | history 污染 | 反問時不更新 history |
| v24.4.4 | `undefined.toUpperCase()` 錯誤 | 加入防護性檢查 |

---

## Version 24.4.0 - PDF 智慧匹配 + 型號反問機制
**日期**: 2025/12/06  
**類型**: Architecture / UX Improvement / PDF Selection

### 問題背景

用戶問「M8 的視訊鏡頭該如何使用」時：
1. 直通車提取內部代號 `M80D`
2. 但 PDF 檔名是 `S32BM801.pdf`、`S32FM803.pdf`、`S32DM803.pdf`
3. `M80D` 無法匹配任何 PDF → 載入錯誤的手冊

### 解決方案

#### 1. 從 CLASS_RULES 提取「型號模式」

CLASS_RULES 別稱行已有定義：
```
別稱_M8,...型號模式為：M80D或S32?M80*
```

新函數 `searchPdfByAliasPattern()` 會：
1. 解析「型號模式為：XXX」
2. 將 `?` 轉為正則 `.`，`*` 轉為 `.*`
3. 用正則匹配 PDF 檔名

#### 2. 多個匹配時反問用戶

```
用戶：「M8 的視訊鏡頭該如何使用」
  ↓
匹配到 3 個 PDF：S32BM801, S32DM803, S32FM803
  ↓
系統反問：
「Smart Monitor M8 有幾個版本，請問你的螢幕型號開頭是？
  1️⃣ S32BM8...
  2️⃣ S32DM8...
  3️⃣ S32FM8...
  都不是的話可以找 Sam 幫你查喔！
  或直接告訴我完整型號（通常在螢幕背面標籤）」
```

#### 3. 用戶回覆處理

| 用戶回覆 | 處理方式 |
|---------|---------|
| 數字 `1`/`2`/`3` | 載入對應 PDF，用原始問題重新回答 |
| 完整型號 `S32FM803` | 精確匹配 PDF |
| 其他（新問題） | 清除等待狀態，當作新問題處理 |

#### 4. 選項排序

按字母順序排列（B → D → F）：
```
1️⃣ S32BM8...
2️⃣ S32DM8...
3️⃣ S32FM8...
```

### 新增函數

| 函數 | 用途 |
|------|------|
| `searchPdfByAliasPattern(aliasKey)` | 從 CLASS_RULES 提取模式並搜尋 PDF |
| `handlePdfSelectionReply(msg, userId, replyToken, contextId)` | 處理用戶的型號選擇回覆 |
| `buildPdfSelectionMessage(aliasName, matchedPdfs)` | 生成反問訊息 |
| `checkDirectDeepSearchWithKey(msg, userId)` | 直通車檢查並返回命中關鍵字 |

### 新增 Cache Key

```javascript
PENDING_PDF_SELECTION: 'pending_pdf_sel_'  // 等待用戶選擇 PDF 型號
```

### 流程圖
│ 數字 → 載入對應 PDF，重新回答       │
│ 完整型號 → 精確匹配 PDF             │
│ 新問題 → 清除狀態，正常處理         │
└─────────────────────────────────────┘
```

---

## Version 24.3.0 - 三層記憶架構 + 上下文自動提取
**日期**: 2025/12/06  
**類型**: Architecture / Memory Management / Context Awareness

### 改進內容

#### 1. 三層記憶架構

解決之前「型號 Cache 只有 300 秒，店員隔天無法繼續提問」的問題。新架構分層：

| 層級 | 儲存媒介 | TTL | 用途 | 例子 |
|------|---------|-----|------|------|
| **Layer 1** | Cache (記憶體) | 300s | 同句話多步驟流程 | 「M7 怎麼用」→ 提取型號 → 查詢 → 回答 |
| **Layer 2** | Sheet (永久) | ∞ | 完整對話歷史，自動提取上下文 | 店員隔天回來「那它支援什麼介面」，自動從 Sheet 找到上次提的 M70D |
| **Layer 3** | API (實時) | 實時 | 日期、時間、天氣、股票等需要動態更新的資訊 | 用戶問「現在幾點」，直接調用系統時間 |

#### 2. 上下文自動提取（新函數）

新增 `extractContextFromHistory()` 函數，自動從對話歷史中提取：
- **型號**：S27DG602SC, M70D, G80SD 等所有型號
- **品牌**：Samsung/三星
- **功能特徵**：4K, OLED, VA, USB-C 等術語
- **使用場景**：電競、創意工作、商務、居家等

**實作位置**: `linebot.gs` 第 ~3210 行  
**觸發時機**：每次 `getRelevantKBFiles()` 呼叫時自動執行

#### 3. 使用者隔離（Cache 前綴）

防止多個店員同時使用 Bot 時型號互相覆蓋：

```javascript
// 之前（全域共用）
cache.put('direct_search_models', data)

// 現在（使用者隔離）
cache.put(`${userId}:direct_search_models`, data)
```

**影響範圍**：
- `checkDirectDeepSearch()` 現在接受 `userId` 參數
- 所有 Cache 鍵都改用 `${userId}:` 前綴

#### 4. 實時資訊 API（日期、時間）

新增快速路徑，用戶問「今天幾號」或「現在幾點」時：
- ✅ 直接調用 `new Date()` 回答，不問 Gemini
- ✅ 回答準確，不會有 AI 幻覺
- ✅ 節省 Token 成本

**實作位置**: `linebot.gs` 第 ~1841 行  
**檢測關鍵字**: `今天|現在|幾月|幾號|幾點|幾分|時間|日期`

### 架構圖

```
使用者訊息
  ↓
 ┌─────────────────────────────┐
 │ Layer 3: 實時資訊 API        │
 │ (日期、時間、天氣等)        │
 └─────────────────────────────┘
        (直接回答，不問 AI)
  ↓ [非實時資訊]
 ┌─────────────────────────────┐
 │ Layer 1: Cache 短期 (300s)  │
 │ 同句話多步驟內的上下文      │
 └─────────────────────────────┘
  ↓
 ┌─────────────────────────────┐
 │ extractContextFromHistory()  │
 │ ↓                            │
 │ Layer 2: Sheet 永久          │
 │ 跨越時間邊界的對話記憶      │
 └─────────────────────────────┘
  ↓
 ┌─────────────────────────────┐
 │ Gemini API 回答              │
 │ + QA/CLASS_RULES/PDF         │
 └─────────────────────────────┘
```

### 關鍵修正

**問題**: M7 面板問題  
用戶「M7 多少錢」→ 命中直通車，注入 M70D 到 Cache  
用戶「那它是什麼面板」→ Cache 已過期 (>300s) → 無法找到 M70D → AI 回答「不確定」

**解決方案**:
1. 直通車注入到 Cache，保留不刪除
2. `extractContextFromHistory()` 從 Sheet 讀完整對話歷史
3. 自動提取上一個問題提到的型號 M70D
4. 用 M70D 查詢 CLASS_RULES → 找到「VA 平面面板」
5. AI 正確回答

---

## Version 24.2.3 - 雙模型策略 + API 錯誤中文提示
**日期**: 2025/12/06
**類型**: Architecture / UX Improvement

### 改進內容

#### 1. 雙模型策略

根據任務難度使用不同模型，平衡成本和質量：

| 場景 | 模型 | 思考預算 | 定價 (per 1M tokens) | 用途 |
|------|------|----------|-------------------|------|
| **一般對話** (Fast Mode) | `gemini-2.0-flash` | ❌ 無 | In: $0.10, Out: $0.40 | 快速回應，不需複雜推理 |
| **PDF 深讀** (PDF Mode) | `gemini-2.5-flash` | 🧠 2048 | In: $0.15, Out: $3.50 | 深度閱讀、複雜理解 |
| **QA 搜尋** (findSimilarQA) | `gemini-2.0-flash` | ❌ 無 | In: $0.10, Out: $0.40 | 簡單關鍵字匹配 |
| **QA 合併** (callGeminiToMergeQA) | `gemini-2.5-flash` | 🧠 512 | In: $0.15, Out: $3.50 | 理解語意，融合多個 QA |
| **QA 修改** (callGeminiToRefineQA) | `gemini-2.5-flash` | 🧠 1024 | In: $0.15, Out: $3.50 | 理解對話，修改 QA |
| **格式轉換** (callGeminiToPolish) | `gemini-2.5-flash` | 🧠 1024 | In: $0.15, Out: $3.50 | 理解用戶意圖，轉為標準格式 |
| **QA 格式化** (callGeminiToAutoFormatQA) | `gemini-2.0-flash` | ❌ 無 | In: $0.10, Out: $0.40 | 簡單格式調整 |
| **自動整理** (handleAutoQA) | `gemini-2.0-flash` | ❌ 無 | In: $0.10, Out: $0.40 | 對話濃縮成一行 |
| **對話摘要** (summarizeConversation) | `gemini-2.0-flash` | ❌ 無 | In: $0.10, Out: $0.40 | 快速摘要，不需深思 |

#### 2. 成本估算 (每日 1000 次問答)

| 場景 | 平均成本 | 月成本 |
|------|---------|--------|
| 平均每則對話 | ~NT$0.018 | ~NT$540 |
| 含 PDF 深讀 | ~NT$0.050 | ~NT$1,500 |
| 每日知識庫重建 | ~NT$0.10 | ~NT$3.00 |
| **預估月費** | | **~NT$2,000** |

#### 3. API 錯誤處理改進

所有 HTTP 錯誤碼都加上用戶友善的中文提示：

```javascript
// 400: 參數錯誤 → "請求參數有誤"
// 403: 檔案過期 → "檔案已過期或無權限" (自動觸發重建)
// 404: 檔案不存在 → 標記 KB_EXPIRED，自動重建
// 429: 配額限制 → "系統暫時忙碌，請稍後重試"
// 500/503: 伺服器錯誤 → "Google 伺服器暫時故障"
```

### 實作細節

**新增全域常量** (linebot.gs 第 35-37 行):
```javascript
const GEMINI_MODEL_FAST = 'models/gemini-2.0-flash';
const GEMINI_MODEL_THINK = 'models/gemini-2.5-flash';
```

**修改 CONFIG** (linebot.gs 第 763-765 行):
```javascript
const CONFIG = {
  MODEL_NAME_FAST: GEMINI_MODEL_FAST,
  MODEL_NAME_THINK: GEMINI_MODEL_THINK,
  ...
};
```

**主要 API 呼叫邏輯** (linebot.gs 第 1617-1633 行):
```javascript
const useThinkModel = attachPDFs; // PDF 模式才用 Think 模型
const modelName = useThinkModel ? CONFIG.MODEL_NAME_THINK : CONFIG.MODEL_NAME_FAST;
const genConfig = { 
    maxOutputTokens: attachPDFs ? 4096 : CONFIG.MAX_OUTPUT_TOKENS,
    temperature: tempSetting
};
if (useThinkModel) {
    genConfig.thinkingConfig = { thinkingBudget: 2048 };
}
```

---

## Version 24.2.1 - Think Mode 開啟 + 每日 04:00 自動重建
**日期**: 2025/12/06
**類型**: Feature / Bug Fix

### 問題背景
1. **PDF 不到 48 小時就過期 (403)**：
   - 12/6 00:03 重啟時顯示 `沿用舊檔：56 本`
   - 12/6 19:56 就出現 403 過期（不到 20 小時）
   - 原因：舊檔案是更早之前上傳的，已接近 48 小時期限
   
2. **自動重啟沒有執行**：
   - 排程是 47 小時後，不是每天固定時間
   - 每次 `/重啟` 會重置計時器，可能永遠不會觸發

3. **Think Mode 被關閉**：
   - 之前為了相容 Flash-Lite 而關閉
   - 但 Flash 支援 Thinking Mode，可以提升 PDF 閱讀理解

### 解決方案

1. **開啟 Think Mode**：
   - PDF 模式啟用 `thinkingBudget: 2048`
   - Fast 模式維持關閉（不需要思考）

2. **改為每日 04:00 固定重建**：
   - 使用 `timeBased().atHour(4).everyDays(1)` 觸發器
   - 強制 `forceRebuild=true`，重新上傳所有 PDF
   - 確保 PDF 永遠不會過期

3. **溫度設定確認**：
   - 已確認有讀取 Prompt Sheet B3 儲存格
   - 程式碼：`promptSheet.getRange("B3:C3").getValues()[0]`

### 程式碼變更

**新增函數**：
```javascript
function dailyKnowledgeRefresh() {
  writeLog("[Daily] 開始每日知識庫重建 (04:00)...");
  syncGeminiKnowledgeBase(true); // forceRebuild = true
  writeLog("[Daily] 每日知識庫重建完成");
}
```

**修改觸發器**：
```javascript
ScriptApp.newTrigger('dailyKnowledgeRefresh')
    .timeBased()
    .atHour(4)
    .everyDays(1)
    .inTimezone('Asia/Taipei')
    .create();
```

### 使用者需執行

部署後請執行一次 `/重啟` 以建立新的每日觸發器。

---

## ⚠️⚠️⚠️ 重大成本事故記錄 (2025/12/06) ⚠️⚠️⚠️

### 事故摘要
**日期**: 2025/12/04-05
**損失金額**: $54.69 美元（正常應為 $0.50-1.00/天）
**根本原因**: v23.4.0 使用了不存在的模型名稱

### 事故時間線

| 時間 | 事件 |
|------|------|
| 12/04 11:19 | 部署 v23.4.0，使用模型名稱 `gemini-2.5-flash-lite` |
| 12/04-05 | API 靜默 fallback 到 Gemini 3 Pro / Gemini 3 Pro Image |
| 12/05 深夜 | 發現帳單異常：$56.86（應為 ~$1.00） |
| 12/06 | 確認根本原因，部署 v24.2.0 修正 |

### 帳單明細

| SKU | 模型 | Tokens | 費用 |
|-----|------|--------|------|
| Image output | Gemini 3 Pro Image | 13,440 | **$50.57** |
| Text output | Gemini 3 Pro | 6,532 | $2.46 |
| Text input | Gemini 3 Pro | 20,227 | $1.27 |
| Image input | Gemini 3 Pro | 6,192 | $0.39 |
| **異常費用小計** | | | **$54.69** |

### 根本原因分析

```
問題版本：v23.4.0 (commit da68b0e, 2025-12-04 11:19:34)
問題程式碼：MODEL_NAME: 'models/gemini-2.5-flash-lite'
實際情況：gemini-2.5-flash-lite 這個模型名稱不存在！
```

**API 的異常行為**：
- 當收到不存在的模型名稱時，API **沒有返回錯誤**
- 而是**靜默 fallback** 到其他模型（Gemini 3 Pro / Gemini 3 Pro Image）
- 這些模型的費用是 Flash 的 **50 倍**！

### 為什麼會發生？

1. **錯誤假設**：以為 Google 有 `gemini-2.5-flash-lite` 這個模型
2. **沒有驗證**：部署前沒有確認模型名稱是否存在
3. **API 沒有警告**：Google API 對無效模型名稱的處理方式是靜默 fallback，而非報錯

### 修正措施

1. **v24.2.0 統一模型**：
   - 移除雙軌制（Flash + Lite）
   - 全部改用 `gemini-2.0-flash`（官方確認存在）
   
2. **模型設定移到最開頭**：
   - 方便未來更換（如 Flash 3.0）
   - 開頭有醒目警告提醒

3. **新增防呆警告**：
   ```javascript
   // ⚠️ 重要警告：模型名稱必須是 Google 官方存在的名稱！
   // ⚠️ 使用不存在的名稱可能導致 API 靜默 fallback 到更貴的模型！
   // ⚠️ 參考文件：https://ai.google.dev/gemini-api/docs/models/gemini
   ```

### 教訓與預防

| 教訓 | 預防措施 |
|------|----------|
| 不要猜測模型名稱 | 永遠查閱官方文件確認 |
| API 不會幫你報錯 | 部署前測試 API 回應 |
| 成本可能暴增 50 倍 | 設置每日預算警報 |
| 雙軌制增加複雜度 | 統一使用單一模型 |

### 官方模型文件
https://ai.google.dev/gemini-api/docs/models/gemini

---

## Version 24.2.0 - 統一模型 + 成本事件記錄
**日期**: 2025/12/06
**類型**: Architecture / Cost Optimization / Critical Fix

### 變更內容

1. **統一模型**：
   - 移除 `MODEL_NAME_LITE`
   - 全部使用 `MODEL_NAME` (gemini-2.0-flash)
   - 成本差距僅 $0.10/天，統一管理更安全

2. **模型設定移到最開頭**：
   ```javascript
   // ⬇⬇⬇ 模型名稱設定 - 未來升級只改這一行 ⬇⬇⬇
   const GEMINI_MODEL = 'models/gemini-2.0-flash';
   // ⬆⬆⬆ 模型名稱設定 - 未來升級只改這一行 ⬆⬆⬆
   ```

3. **新增成本事件記錄**：
   - 在檔案開頭詳細記錄 v23.4.0 事故
   - 防止未來重蹈覆轍

### 受影響的函數
- findSimilarQA: MODEL_NAME_LITE → MODEL_NAME
- callGeminiToAutoFormatQA: MODEL_NAME_LITE → MODEL_NAME
- handleAutoQA: MODEL_NAME_LITE → MODEL_NAME
- summarizeConversation: MODEL_NAME_LITE → MODEL_NAME

---

## Version 24.1.43 - 成本警告：Vertex AI 自動升級問題
**日期**: 2025/12/06
**類型**: Cost Alert / Critical

### 問題背景
2025/12/01-05 期間發現 $80.55 美元的異常 Gemini 帳單：
- **Gemini 3 Pro Image**: $54.78 (14,560 tokens) - 68% of total
- Gemini 2.5 Flash Lite: $8.54
- Gemini 2.5 Flash: $7.42

但 CONFIG 只設定了：
- `gemini-2.0-flash`
- `gemini-2.0-flash-lite`

### 根本原因
**Vertex AI 自動升級模型！**

當同時啟用 Vertex AI 和使用 Gemini API Key 時，Google Cloud 可能會：
1. 自動將請求路由到 Vertex AI
2. Vertex AI 自動升級模型到更貴的版本
3. 圖片處理時自動選擇 Gemini Pro Image

### 解決方案
1. **關閉 Vertex AI API**（推薦）
   - Google Cloud Console → APIs & Services → Disable Vertex AI API
2. **或重新生成 API Key**
   - Google AI Studio → 創建新 Key → 更新 Script Properties

### 程式碼變更
- 在 CONFIG 中加入成本警告註解
- API 呼叫時記錄使用的模型名稱

---

## Version 24.1.41 - PDF 搜尋指令位置優化
**日期**: 2025/12/05
**類型**: Architecture Fix / Critical

### 問題背景
AI 讀了 20K tokens 的 PDF，但回答內容與用戶問題不相關：
- 用戶問：「Odyssey Hub 開遊戲沒有 3D」
- AI 答：「如何開啟遊戲」（完全沒回答「沒有 3D」的問題）

### 根本原因分析
Gemini API 處理順序：
1. `systemInstruction`：70 行 Prompt + Deep Mode 指令
2. `user message`：PDF 內容 + 用戶問題

問題：**Deep Mode 搜尋指令在 systemInstruction 中，AI 讀完大量 Prompt 後可能遺忘**，或者沒有將指令與 PDF 內容連結起來。

### 解決方案
把搜尋指令直接放在 **PDF 後面、用戶問題前面**：
```
[PDF 內容] → [搜尋任務指令] → [用戶問題]
```

新增的指令：
```
【PDF 搜尋任務】請在上述 PDF 手冊中，找出與以下問題相關的所有段落並詳細回答：
```

### 預期效果
AI 讀完 PDF 後會立刻看到「搜尋任務」，然後看到用戶問題，更容易連結起來。

---

## Version 24.1.40 - 修正換題誤判
**日期**: 2025/12/05
**類型**: Prompt Fix

### 問題背景
用戶第一題問「Odyssey Hub 開遊戲沒有 3D」，AI 回答後竟然輸出了 `[NEW_TOPIC]`，導致 PDF Mode 被錯誤退出。

Log：`[New Topic] 偵測到換題，退出 PDF 模式`

**原因**：Prompt.csv 的換題規則過於寬鬆：
> 如果使用者的新問題與之前主題明顯無關，請在回答最後加上 [NEW_TOPIC]

這讓 AI 在「沒有前題」的情況下也輸出了換題暗號。

### 解決方案
修改 Prompt.csv 換題規則：
```
變更前：
如果使用者的新問題與之前主題明顯無關，請在回答最後加上 [NEW_TOPIC] 暗號。

變更後：
只有當「對話歷史中有明確前題」且「新問題與前題明顯無關」時，才在回答最後加上 [NEW_TOPIC]。
如果是第一個問題或不確定，**禁止輸出 [NEW_TOPIC]**。
```

---

## Version 24.1.39 - Deep Mode 引導 AI 搜尋正確段落
**日期**: 2025/12/05
**類型**: Prompt Enhancement / Critical

### 問題背景
用戶問「Odyssey Hub 開遊戲沒有 3D」，AI 回答的是「攝影機設定、螢幕解析度」— 這是 PDF 中的一般 3D 觀看注意事項，不是 Odyssey Hub 的具體操作步驟。

**原因**：Deep Mode 只告訴 AI「從 PDF 找步驟」，但沒有告訴它「用戶問的是什麼」。AI 隨便找了一段 3D 相關內容就回答了。

### 解決方案
在 Deep Mode 提示中加入用戶問題引導：
```
【用戶問題】Odyssey Hub 開遊戲沒有 3D
【任務】請在 PDF 中搜尋與「Odyssey Hub 開遊戲沒有 3D」相關的段落，找出具體操作步驟。
```

### 預期效果
AI 會在 PDF 中搜尋「Odyssey Hub」、「遊戲」、「3D」等關鍵字，找到正確的段落再回答。

---

## Version 24.1.38 - 直通車 + 操作題直接開 PDF
**日期**: 2025/12/05
**類型**: Logic Optimization

### 問題背景
用戶問「用 Odyssey Hub 開遊戲沒有 3D」時：
1. Fast Mode 先跑一次（5K tokens）
2. AI 輸出 `[AUTO_SEARCH_PDF]`
3. 重試帶 PDF 再跑一次（20K tokens）

**浪費了第一次 API 呼叫**！

### 解決方案
當「直通車關鍵字」+「操作類問題」同時命中時，**直接開 PDF Mode**：
```javascript
const operationPatterns = [
    /怎麼|如何|開啟|設定|打開|關閉|調整|步驟|操作/i,
    /故障|問題|不行|沒有|無法|失敗|壞|黑屏|閃爍|不顯示/i,
    /安裝|連接|更新|韌體|升級|重置/i
];
```

### 效果
- **之前**：直通車 → Fast Mode → 暗號 → 重試 PDF（2 次 API）
- **現在**：直通車 + 操作題 → 直接 PDF（1 次 API）

---

## Version 24.1.37 - 移除 Prompt 範例避免複製
**日期**: 2025/12/05
**類型**: Prompt Fix / Critical

### 問題背景
AI 在 Deep Mode (已載入 20K tokens PDF) 下，只輸出 26 tokens，內容是：
「Odyssey Hub 是 3D 功能，可能需要檢查設定...」

這正是 Prompt.csv 中的**範例文字**！AI 直接複製範例，完全忽略 PDF 內容。

### 根本原因
Prompt.csv 中有這段範例：
```
**範例**：「Odyssey Hub 是 3D 功能，可能需要檢查設定... [AUTO_SEARCH_PDF]」
```
AI 在 Deep Mode 下看到「Odyssey Hub」關鍵字，直接複製範例作為答案。

### 解決方案
1. **移除範例**：從 Prompt.csv 中刪除「Odyssey Hub」範例
2. **Prompt 版本更新**：v24.1.33-B → v24.1.36-A

### Prompt 變更
```
變更前：
  - **範例**：「Odyssey Hub 是 3D 功能，可能需要檢查設定... [AUTO_SEARCH_PDF]」

變更後：
  (移除此範例)
```

---

## Version 24.1.36 - 模型分配細化
**日期**: 2025/12/05
**類型**: Model Assignment

### 問題背景
用戶指出 `/紀錄` 流程中 LLM 需要與用戶討論、理解修改意圖，這不是簡單任務，不適合用 Lite。

### 解決方案
將 `/紀錄` 相關的 3 個 LLM 函數改回 Flash：
- `callGeminiToPolish` - 初次整理（需理解格式規則）
- `callGeminiToMergeQA` - 合併判斷（需理解語意）
- `callGeminiToRefineQA` - 對話修改（需理解上下文）

### 最終模型分配表
| 功能 | 模型 | 原因 |
|------|------|------|
| **callChatGPTWithRetry** | Flash | 用戶對話，需理解 Fast/Deep Mode |
| **callGeminiToPolish** | Flash | /紀錄 初次整理，需理解格式 |
| **callGeminiToMergeQA** | Flash | /紀錄 合併判斷，需理解語意 |
| **callGeminiToRefineQA** | Flash | /紀錄 對話修改，需理解上下文 |
| findSimilarQA | Lite | 純搜尋，簡單 |
| callGeminiToAutoFormatQA | Lite | 簡單自動格式化 |
| handleAutoQA | Lite | 簡單自動整理 |
| summarizeConversation | Lite | 簡單摘要 |

---

## Version 24.1.35 - 模型切換 Flash-Lite → Flash (雙軌制)
**日期**: 2025/12/05
**類型**: Model Change / Architecture

### 問題背景
1. AI 在 Deep Mode (已掛載 PDF) 下，依然輸出「根據我的資料庫」而非「根據產品手冊」。
2. AI 在 Deep Mode 下依然輸出 `[AUTO_SEARCH_PDF]` 暗號，造成無限迴圈。
3. AI 讀取 20K tokens 的 PDF 後，只輸出 27 tokens 的簡短回答，完全沒有利用 PDF 內容。
4. 上述問題在 Prompt 中已明確禁止，但 AI 完全無視。

### 根本原因
**Gemini 2.0 Flash-Lite 模型能力不足**，無法理解並遵守複雜的多模式 Prompt 指令（Fast Mode vs Deep Mode 規則）。

### 解決方案
1. **雙軌制模型配置**：
   - `MODEL_NAME`: `gemini-2.0-flash` - 用於**用戶對話**（需理解複雜 Prompt）
   - `MODEL_NAME_LITE`: `gemini-2.0-flash-lite` - 用於**後台任務**（省錢）
   
2. **模型分配**：
   | 功能 | 模型 | 原因 |
   |------|------|------|
   | callChatGPTWithRetry | Flash | 需理解 Fast/Deep Mode 規則 |
   | findSimilarQA | Lite | 簡單搜尋任務 |
   | callGeminiToMergeQA | Lite | 簡單合併任務 |
   | callGeminiToFormatQA | Lite | 簡單格式化 |
   | callGeminiToFormatEntry | Lite | 簡單格式化 |
   | callGeminiToAutoFormatQA | Lite | 簡單格式化 |
   | callGeminiToRefineQA | Lite | 簡單修改任務 |
   | handleAutoQA | Lite | 簡單整理任務 |
   | summarizeConversation | Lite | 簡單摘要任務 |

3. **成本影響**：
   - Flash: Input $0.10/1M, Output $0.40/1M
   - Flash-Lite: Input $0.075/1M, Output $0.30/1M
   - 用戶對話約貴 33%，但後台任務維持低成本

4. **Deep Mode 提示強化**：
   - 加入醒目的 `⚠️⚠️⚠️` 符號
   - 直接在 System Prompt 中列出 4 條核心規則
   - 避免 AI 因規則太多而忽略

### Log 更新
- Token 計價 Log 改顯示「費率: 2.0 Flash」（用戶對話）
- 後台任務的 Token 計價維持原樣（Flash-Lite）

---

## Version 24.1.33-B - Prompt 強化 (極速模式 & 價格)
**日期**: 2025/12/05
**類型**: Prompt Engineering

### 問題背景
1. AI 在 Fast Mode 下沒有輸出 `[AUTO_SEARCH_PDF]`，直接說「手冊也沒寫，找 Sam」。
2. M7 價格回答太冷漠，只丟連結不說話。

### 解決方案
1. **極速模式強化**：
   - 禁止清單加入「手冊也沒寫」
   - 加入範例：「Odyssey Hub 是 3D 功能，可能需要檢查設定... [AUTO_SEARCH_PDF]」
2. **價格規則強化**：
   - 提供兩個親切範本
   - 加入「**嚴禁**：只丟出連結不說話」

---

## Version 24.1.32 - 直通車與簡單問題衝突修正
**日期**: 2025/12/05
**類型**: Logic Fix

### 問題背景
用戶指出 Log 顯示「命中關鍵字且非規格問題，強制開啟 PDF 模式」，但隨後又顯示「簡單/追問類問題，跳過 PDF」，導致邏輯矛盾且浪費運算。

### 解決方案
1. **邏輯順序確認**：目前的邏輯是先執行直通車檢查 (`isInPdfMode = true`)，再執行簡單問題檢查 (`isInPdfMode = false`)。
2. **結果正確**：雖然 Log 看起來矛盾，但最終結果是正確的（跳過 PDF，走 Fast Mode）。
3. **優化**：這其實是預期行為。直通車負責「識別型號」，簡單問題負責「過濾不需要 PDF 的意圖」。兩者結合確保了「M7 價格」這種題型能正確走 Fast Mode。

---

## Version 24.1.31 - Prompt 語氣多樣化
**日期**: 2025/12/05
**類型**: Polish / Prompt Engineering

### 問題背景
用戶反映 AI 的回答太像機器人，每次都用一模一樣的句型（如「建議您到官網...」），且違反了「禁用您」的規則。

### 解決方案
1. **模糊化指令**：在 Prompt.csv 中，將所有指定回答的指令改為「類似...」，給予 AI 更多自由度。
2. **移除「您」**：修正所有範例句，確保不出現「您」，改用「你」或省略主詞。
3. **多樣化**：明確要求 AI 使用不同的句型，避免重複感。

---

## Version 24.1.30 - 語氣優化 & 退出邏輯修正
**日期**: 2025/12/05
**類型**: Polish / Logic Adjustment

### 問題背景
1. **語氣矛盾**：AI 說「手冊未記載」卻還加「試試看吧😎👍」，顯得不專業且輕浮。
2. **冷漠回應**：價格引導語句太過機械化，缺乏溫度。
3. **退出失效**：AI 已經說了「手冊未記載」，但系統沒有識別到這句話，導致 PDF Mode 沒有自動退出。

### 解決方案
1. **Prompt 修正**：
   - 禁止在「手冊未記載」時加表情符號。
   - 優化價格引導語氣，要求保持親切。
2. **退出邏輯增強**：
   - 在 `exitPatterns` 中加入 `/手冊未記載/i`，確保 AI 承認手冊沒寫時，系統能自動退出 PDF Mode。

---

## Version 24.1.29 - 直通車智慧分流 (Smart Direct Search)
**日期**: 2025/12/05
**類型**: Logic Adjustment / Optimization

### 問題背景
用戶質疑「為什麼問 M7 面板需要進 PDF？」，雖然 v24.1.28 恢復了強制 PDF 以解決 Odyssey Hub 問題，但也導致 M7 規格題被強制進 PDF，浪費資源且不合邏輯。

### 解決方案
1. **智慧分流**：在 `checkDirectDeepSearch` 命中後，增加一層 `isHardwareSpec` 檢查。
2. **規格題 (Fast Mode)**：若問題包含「面板、規格、解析度」等關鍵字，**不強制開啟 PDF Mode**，讓系統走 Fast Mode (查 CLASS_RULES)。
3. **操作題 (PDF Mode)**：若非規格題（如 Odyssey Hub 設定、故障），則**強制開啟 PDF Mode**。

---

## Version 24.1.28 - 直通車強制 PDF 回歇
**日期**: 2025/12/05
**類型**: Logic Adjustment / Strategy

### 問題背景
用戶質疑「為什麼命中直通車關鍵字還要等待 AI 判斷」，認為這多此一舉且導致回答不穩定（AI 可能自作聰明不查 PDF）。

### 解決方案
1. **恢復強制 PDF**：在 `handleMessage` 中，若 `checkDirectDeepSearch` 命中，直接將 `isInPdfMode` 設為 `true`。
2. **跳過 Fast Mode**：直接進入 PDF 模式查詢，省去一次 API 來回，提升速度與準確度。
3. **確保規格題不掛**：依賴 v24.1.25 的 Prompt 強化與 v24.1.20 的動態上下文，確保即使在 PDF 模式下，AI 也能讀取 Rules 回答規格問題（如 M7 面板）。

---

## Version 24.1.27 - API 400 修復 (移除 Thinking)
**日期**: 2025/12/05
**類型**: Bug Fix / API Compatibility

### 問題背景
1. 用戶回報 API 400 錯誤，錯誤訊息顯示 `thinking is not supported by this model`。
2. 這是因為我們切換到了 `gemini-2.0-flash-lite`，而此模型（Lite 版）並不支援 Thinking Mode (思考模式)，只有 Pro 版支援。
3. 程式碼中原本針對 PDF 模式開啟了 `thinkingConfig`，導致 API 請求被拒絕。

### 解決方案
1. **移除 Thinking Config**：在 `callChatGPTWithRetry` 中，將 `generationConfig` 裡的 `thinkingConfig` 參數移除。
2. **保留 Token 放寬**：保留 `maxOutputTokens: 4096` 的設定，確保 PDF 模式仍能完整回答。

---

## Version 24.1.26 - 模型版本修正 (GA)
**日期**: 2025/12/05
**類型**: Bug Fix / Configuration

### 問題背景
用戶指出 `gemini-2.0-flash-lite` 已於 2025/02/25 正式發布 (GA)，應使用正式版而非預覽版或錯誤的版本號。

### 解決方案
1. **模型名稱更新**：將 `CONFIG.MODEL_NAME` 更新為 `models/gemini-2.0-flash-lite`。

---

## Version 24.1.25 - 模型名稱修正 & Prompt 強化
**日期**: 2025/12/05
**類型**: Bug Fix / Optimization

### 問題背景
1. 用戶詢問「Gemini 2.5 Flash」，檢查發現程式碼中誤寫為 `gemini-2.5-flash-lite` (此模型不存在，API 可能自動 fallback 或報錯)。
2. AI 在 Fast Mode 下遇到 Odyssey Hub 問題，因為知道原理而自作聰明不查 PDF，導致回答不夠具體。

### 解決方案
1. **模型名稱修正**：將 `CONFIG.MODEL_NAME` 修正為 `models/gemini-2.0-flash-lite-preview-02-05` (Google 最新發布的 Flash-Lite 模型)。
2. **Prompt 強化**：在 Prompt.csv 的【極速模式】中加入條款：「即使你知道該功能的原理，若無法提供具體操作步驟，也必須查閱 PDF」。

---

## Version 24.1.24 - PDF 輸出限制放寬 & Log 完整性
**日期**: 2025/12/05
**類型**: Optimization / 體驗優化

### 問題背景
1. 用戶反映 PDF 模式下 AI 似乎無法一次講完所有解決方案，懷疑有輸出限制。
2. Log 中的 `[AI Reply]` 被截斷，無法看到完整回答。

### 解決方案
1. **放寬 Token 限制**：在 `generationConfig` 中，針對 PDF 模式 (attachPDFs=true) 將 `maxOutputTokens` 提升至 **4096** (原為全域設定，通常較小)。
2. **Log 完整性**：將 `writeLog` 中 `[AI Reply]` 的截斷長度從 500 字放寬至 **2000 字**，確保能記錄完整對話。

---

## Version 24.1.23 - Code Cleanup (移除遺留代碼)
**日期**: 2025/12/05
**類型**: Refactoring / 代碼清理

### 問題背景
用戶指出系統中可能殘留「手動確認深度搜尋」的舊代碼，雖然功能已改為自動，但舊代碼可能導致潛在衝突或混淆。

### 解決方案
1. **移除 PENDING_QUERY**：在 `handleMessage` 中移除讀取與判斷 `PENDING_QUERY` 的邏輯。
2. **廢棄 handleDeepSearch**：清空 `handleDeepSearch` 函數內容，僅保留 Log 警告，確保舊流程完全阻斷。
3. **確保純淨**：系統現在完全依賴 `[AUTO_SEARCH_PDF]` 自動觸發，不再有任何「等待用戶輸入 1」的狀態。

---

## Version 24.1.22 - Auto Deep Search 實裝 (自動觸發不詢問)
**日期**: 2025/12/05
**類型**: Logic Adjustment / 體驗優化

### 問題背景
用戶抱怨「為什麼又不進入 PDF 了」，系統雖然偵測到 `[AUTO_SEARCH_PDF]` 但卻停下來詢問用戶「是否要查閱」，不符合「自動」的預期。

### 解決方案
1. **自動執行重試**：當偵測到 `[AUTO_SEARCH_PDF]` 且非硬體問題時，系統會：
   - 自動將 `isInPdfMode` 設為 true。
   - 立即再次呼叫 `callChatGPTWithRetry` (帶 PDF)。
   - 將第二次的完整回答直接回傳給用戶。
2. **移除詢問步驟**：不再顯示「💡 需要查閱產品手冊嗎？...」的提示。

---

## Version 24.1.21 - Prompt 策略優化 (操作題強制查 PDF)
**日期**: 2025/12/05
**類型**: Prompt Optimization / 策略調整

### 問題背景
用戶詢問「Odyssey Hub 3D 沒顯示」，系統識別出型號 G90XF，但因為移除了直通車強制 PDF 模式，AI 在 Fast Mode 下查無 QA 資料，直接回答「找 Sam」，未觸發 `[AUTO_SEARCH_PDF]`。

### 解決方案
1. **Prompt.csv 策略調整**：
   - 明確區分「規格題」(找 Sam) 與「操作題」(查 PDF) 的處理邏輯。
   - **極速模式 (Fast Mode)**：遇到操作/故障排除問題且無 QA 答案時，**必須**輸出 `[AUTO_SEARCH_PDF]`，禁止直接放棄。
   - **深度模式 (Deep Mode)**：若查了 PDF 還是沒有，才回答「手冊也沒寫，只能看 Sam」。

---

## Version 24.1.20 - Prompt 架構重構 (CSV 化)
**日期**: 2025/12/05
**類型**: Refactoring / 架構重構

### 問題背景
用戶要求 Prompt 不要寫死在 GS 程式碼中，以便隨時調整且不需改動程式碼。

### 解決方案
1. **移除硬編碼**：將 `linebot.gs` 中所有詳細 Prompt 文字移除。
2. **Prompt.csv 升級**：
   - 新增 `【極速模式】` 與 `【深度模式】` 區塊。
   - 將所有指令、語氣、規範移至 CSV 管理。
3. **動態注入**：GS 僅負責注入「系統狀態」(Fast/Deep Mode)，AI 根據狀態查閱 CSV 中的對應規範。

---

## Version 24.1.19 - Brain-First 回歸 (移除直通車強制 PDF)
**日期**: 2025/12/05
**類型**: Logic Adjustment / 成本優化

### 問題背景
用戶質疑「萬一手冊有寫呢？」，且直通車強制進 PDF 導致明明 Rules 有寫規格（如 M7 面板）卻因 PDF 沒寫而回答不出來。

### 解決方案
1. **移除強制 PDF**：直通車 (Direct Search) 命中關鍵字時，僅執行「型號識別與注入 Cache」，**不再強制開啟 PDF Mode**。
2. **Brain-First 流程**：
   - 先用 Fast Mode (QA + CLASS_RULES) 嘗試回答。
   - 若 Rules 有答案（如規格），直接回答（省 Token）。
   - 若 Rules 沒答案（如操作），AI 判斷後輸出 `[AUTO_SEARCH_PDF]`，再掛載 PDF。

---

## Version 24.1.18 - PDF Mode 語氣與退出邏輯優化
**日期**: 2025/12/05
**類型**: Prompt Optimization / 體驗優化

### 問題背景
1. PDF Mode 回答開頭出現重複打招呼 (哈囉)。
2. 用戶覺得「先找 PDF 然後才說退出」是白費工。

### 解決方案
1. **禁止打招呼**：在 Deep Mode Prompt 中明確禁止「哈囉」、「你好」等開場白。
2. **優化退出邏輯**：增加 `exitPatterns` 識別「手邊的資料剛好沒有寫到」，讓系統在查無資料時能更果斷退出 PDF Mode。

---

## Version 24.1.17 - S8 直通車修復 & 語氣優化
**日期**: 2025/12/05
**類型**: Bug Fix / 體驗優化

### 問題背景
1. S8/M7/G9 等短關鍵字無法觸發直通車 (DirectDeep)，因為長度限制 >= 3。
2. 回答語氣過於生硬（機器人感）。

### 解決方案
1. **放寬長度限制**：將 `strongKeywords` 限制放寬至 >= 2 碼。
2. **語氣優化**：修改 Prompt.csv，允許「適度親切」，並修正模糊型號邏輯（若有明確定義則直接回答）。

---

## Version 24.1.8 - 型號提取正則修正（M7 型號偵測修復）
**日期**: 2025/12/05
**類型**: Bug Fix / 型號偵測邏輯

### 問題背景
v24.1.7 已修復：
1. ✅ 動畫計時器清除
2. ✅ M7 規格補全（加入「VA 平面」）

但用戶仍反映「m7是什麼面板」不知道答案。

LOG 顯示：
```
[HandleMsg] 收到: m7是什麼面板
[PDF Mode] 延續 PDF 模式  ← v24.1.5 的型號變化清除應該工作，但沒有
[KB Load] AttachPDFs: true
[AI Reply] 這題資料沒寫,看Sam知不知道。
```

### 根本原因

`extractModelNumbers()` 函數在提取 M 系列型號時有 bug：

```javascript
// 原始邏輯 (v24.1.5):
/\bM([5789][\dA-Z]*)\b/g    // ❌ 使用了括號分組

// 在 while 迴圈中：
const model = match[1] || match[0];

// 當輸入「m7是什麼面板」時：
// match[0] = "M7"
// match[1] = "7"   ← 只有括號內的部分！
// 所以 model = "7" 而非 "M7"
```

這導致型號比對失敗：
```
currentModels = ["7"]
previousModels = ["M70D"]
isSameModel = false 但邏輯無法比对...
```

實際上系統無法識別「7」是「M 系列」的一部分，導致型號變化偵測完全失效。

### 修復方案

改為完整正則，不使用括號分組：

```javascript
// 修正 (v24.1.8):
/\bM[5789][\dA-Z]*\b/g      // ✓ 完整模式

// match[0] = "M7"
// match[1] = undefined
// const model = match[1] || match[0];
// model = "M7" ✓
```

同時將最小長度從 3 改為 2，支援「M7」「M5」等短型號。

### 邏輯流程驗證

修復後：
```
用戶: "m7是什麼面板"
  ↓ extractModelNumbers("m7是什麼面板")
  ↓ 提取型號: ["M7"]
  ↓ 檢查歷史: 前一個型號是 ["M70D", "G90XF", "S27FG900"]
  ↓ M7 vs M70D？都是 M 系列！
  ↓ 型號相同？否 (M7 ≠ M70D) ✓
  ↓ 清除 PDF Mode ✓
  ↓ 回到 Fast Mode，查 CLASS_RULES
  ↓ 找到：「別稱_M7,Smart Monitor M7...VA平面面板...」
  ↓ 回答：「M7 是 VA 平面螢幕...」
```

---

## Version 24.1.7 - M7 面板規格補全
**日期**: 2025/12/05
**類型**: 數據完善 / 使用者體驗改善

### 問題背景
用戶詢問：「m7是什麼面板」
系統回答：「這題資料沒寫,看Sam知不知道。」

### 根本原因
CLASS_RULES.csv 中 M7 系列的定義不完整：
```
舊版：別稱_M7,Smart Monitor M7，進階智慧螢幕，4K解析度...
     （缺少面板類型信息）
```

但實際上所有 M7 系列的型號都明確記載為：
```
LS43FM703UC: 43吋 VA平面螢幕
LS32FM703UC: 32吋 VA平面螢幕
LS43FM702UC: 43吋 VA平面螢幕
...以及 2024 新款 M70D...
```

### 修復方案
更新 `別稱_M7` 的定義加入面板類型：
```
新版：別稱_M7,Smart Monitor M7，進階智慧螢幕，VA平面面板，4K解析度...
     ✓ 現在包含「VA 平面面板」的明確信息
```

### 效果驗證
修復前：
```
[AI Reply] 這題資料沒寫,看Sam知不知道。
```

修復後（預期）：
```
[AI Reply] M7 是 VA 平面螢幕，4K 解析度...
```

---

## Version 24.1.6 - Odyssey Hub 關鍵字匹配修復（第一問題解決）
**日期**: 2025/12/05
**類型**: 關鍵字匹配 / 使用者體驗優化

### 問題背景
用戶詢問：「我用Odyssey Hub開啟遊戲但是沒有顯示3D耶？」
系統反應：
1. ✅ 直通車觸發，進入 PDF Mode
2. ❌ 但 LOG 顯示 Files: 0 / 56，沒有載入任何 PDF
3. ❌ 回答不完整，用戶需要追問「繼續」才能得到完整答案

### 根本原因
在 `getRelevantKBFiles()` 函數中，KEYWORD_MAP 的查詢邏輯沒有「去空白」處理：
- 用戶輸入：「Odyssey Hub」(帶空格)
- KEYWORD_MAP 的 Key：「OdysseyHub」(無空格)
- 結果：`combinedQuery.includes(key)` 返回 false，無法匹配到 OdysseyHub
- 最終：無法提取 G90XF 型號，故找不到對應的 PDF

### 修復方案

**1. 關鍵字匹配優化**：
```javascript
const combinedQueryNoSpace = combinedQuery.replace(/\s+/g, '');
if (combinedQuery.includes(key) || combinedQueryNoSpace.includes(key)) {
    // 匹配成功，提取型號...
}
```

**2. PDF 名稱友善化**：
```javascript
// 舊版：「將查閱：S27FG900」
// 新版：「將查閱：Odyssey 3D 產品手冊」
const productNames = pdfNames.map(name => getPdfProductName(name));
```

### 新增函數

**`getPdfProductName(pdfFileName)`**
- 將 PDF 檔名（如 S27FG900）轉換為產品名稱（如 Odyssey 3D）
- 優先從 KEYWORD_MAP 反向查詢，失敗則使用簡單規則
- 回退策略確保不會失敗

### 效果驗證

修復前：
```
[KB Load] AttachPDFs: true, isRetry: false, Files: 0 / 56
```

修復後：
```
[KB Load] AttachPDFs: true, isRetry: false, Files: 2 / 56
→ 可正確載入 Odyssey 3D 相關 PDF
```

---

## Version 24.1.5 - PDF Mode 黏性修復（型號變化自動清除）
**日期**: 2025/12/05
**類型**: 架構優化 / 智慧退出機制

### 問題背景
用戶從詢問 Odyssey 3D (G90XF) 的 3D 設定問題，切換到詢問 M7 的面板規格。
系統仍延續 PDF Mode，導致：
1. 載入 G90XF 相關 PDF（浪費 Token）
2. PDF 中沒有 M7 面板規格 → 回答「資料沒寫」
3. 忽視了 CLASS_RULES 中明確記載的 M7 VA 面板規格

### 根本原因
PDF Mode 的「黏性」（TTL 5 分鐘）設計本意是讓同一主題的連續追問能重複使用 PDF。
但當用戶**型號變化**（從 A 型號切換到 B 型號）時，系統沒有偵測到，仍載入 A 型號的 PDF。

### 修復方案
**新增型號變化偵測邏輯**：
1. `extractModelNumbers(text)` - 從訊息提取所有型號
2. `checkAndClearPdfModeOnModelChange(msg, history)` - 比對當前型號與歷史型號
3. 當型號不同時，自動清除 PDF Mode，回到 Fast Mode (QA + CLASS_RULES)

**邏輯流程**：
```
用戶: "m7用什麼面板"
  ↓ 提取型號: M7
  ↓ 檢查歷史: 上一個討論的是 G90XF
  ↓ 型號不同? YES
  ↓ 清除 PDF Mode，回到 Fast Mode
  ↓ 查詢 CLASS_RULES → 找到 "M7: VA 平面螢幕" ✓
  ↓ 直接回答，不浪費 Token 讀 PDF
```

### 支援的型號格式
- Samsung 標準型號: S27FG900, S32DG802
- 電競型號: G90XF, G80SD
- Smart Monitor: M7, M8, M9, M70D, S27FM703UC
- 特殊機種: ARK, ARK DIAL, Odyssey, Odyssey 3D, Odyssey Hub

---

## Version 24.1.4 - 編輯 API 成本追蹤完善
**日期**: 2025/12/05
**類型**: 工程優化 / 監測強化

### 編輯 API Token 完整記錄

**新增內容**：
- `callGeminiToPolish` - 初版 QA 生成時記錄 Token 用量和成本
- `callGeminiToRefineQA` - 用戶修改指令後記錄 Token 用量和成本
- `callGeminiToMergeQA` - 合併多個 QA 時記錄 Token 用量和成本

**記錄格式**：
```
[Polish Tokens] In: 345, Out: 128, Total: 473 (約 NT$0.0189)
[RefineQA Tokens] In: 567, Out: 234, Total: 801 (約 NT$0.0321)
[MergeQA Tokens] In: 789, Out: 345, Total: 1134 (約 NT$0.0454)
```

**用途**：
- 分析建檔系統的 Token 消耗分佈
- 評估編輯模式的性價比
- 追蹤 Think Mode (1024/512 budget) 實際消耗

---

## Version 23.6.4 - Brainy, Warm & Disciplined
**日期**: 2025/12/05
**類型**: 邏輯修正 / 體驗優化

### 1. 範圍與幻覺控制 (Scope & Hallucination Control)
**問題背景**：
用戶回報 AI 回答手機問題 (Galaxy S24)，且將舊款螢幕 (S57CG95) 誤判為新機。

**調整內容**：
- **範圍天條**: 嚴格限制僅能回答「三星電腦螢幕」相關問題，禁止回答手機、家電等。
- **新品天條**: 禁止捏造「最新產品」。若資料庫無標示，必須誠實回答「無最新消息」，嚴禁將舊機包裝成新機。

### 2. 深度搜尋優化 (Deep Search Optimization)
**問題背景**：
用戶詢問 "Odyssey Hub" 與 "3D" 功能時，AI 未能觸發 PDF 搜尋，導致回答不完整。

**調整內容**：
- **強制直通車重啟**: 針對高度技術性關鍵字 (Odyssey Hub, 3D, Ark Dial, Firmware) 強制開啟 PDF 模式。
- **[AUTO_SEARCH_PDF] 強化**: 提示 Prompt 只要涉及「操作步驟」、「故障排除」且資料不足，必須無條件觸發自動搜尋。
- **全量輸出**: PDF 步驟不再摘要，改為「列出所有詳細步驟」，滿足用戶對完整資訊的需求。

### 3. 語氣與記憶 (Tone & Memory)
- **移除溫馨提醒**: 嚴禁使用「溫馨提醒」等贅詞。
- **Rolling Summary**: 實作滾動式摘要，保留長期記憶。

## Version 23.5.5 - Dynamic Context & Cost Optimization
**日期**: 2025/12/05
**類型**: 架構優化 / 成本控制

### 1. 動態上下文注入 (Dynamic Context Injection)
**問題背景**：
舊版邏輯將所有 QA 與 CLASS_RULES 打包成一個巨大文字檔 (`samsung_kb_priority.txt`)，每次對話都強制上傳。導致單次對話 Token 消耗高達 50,000+，且容易觸發 Gemini 的過濾機制。

**新機制設計**：
- **Cache Storage**: 將 QA 與 Rules 切割並存入 `CacheService` (取代檔案上傳)。
- **Keyword Filtering**: 每次對話根據用戶訊息中的關鍵字 (型號、功能詞)，動態撈取相關的 QA 與規格。
- **Token 瘦身**: 上下文長度從 50k 降至 1k~3k，大幅降低成本並提升反應速度。

### 2. 智慧 PDF 模式 (Smart PDF Mode)
**調整內容**：
- **廢除直通車**: 移除「關鍵字強制進 PDF」的邏輯。現在全權交由 LLM 判斷，只有當 Fast Mode 資料不足並輸出 `[AUTO_SEARCH_PDF]` 時，才掛載 PDF。
- **降低黏性**: PDF 模式的 TTL 從 10 分鐘縮短為 5 分鐘。
- **智慧退出**: 若用戶在 PDF 模式下問簡單問題 (價格、官網、閒聊)，系統會自動暫停掛載 PDF，避免浪費 Token。

### 3. 記憶與連續性
- **歷史繼承**: 對話歷史 (History) 保持不變，確保用戶不會感到被遺忘。
- **上下文刷新**: 每一輪對話都會重新計算 Dynamic Context，確保不會背負上一輪的無關資訊 (Token Baggage)。

## Version 22.0.0 - Brain-First Architecture
**日期**: 2025/01 (待確認實際部署日期)
**類型**: 重大架構調整

### 1. [AUTO_SEARCH_PDF] 自動召喚機制

**問題背景**：
原本的 `[NEED_DOC]` 機制需要使用者手動輸入「1」或「深度」才能觸發深度搜尋，使用者體驗不佳。

**新機制設計**：

```
Phase 1: 極速模式
├── 只掛載 QA + CLASS_RULES
├── AI 判斷資料不足 → 輸出 [AUTO_SEARCH_PDF] 暗號
└── 如果資料足夠 → 直接回答

Phase 2: 自動攔截
├── 系統偵測到 [AUTO_SEARCH_PDF]
├── 自動重新呼叫 Gemini（isRetry=true）
└── 附帶相關 PDF 手冊

Phase 3: 最終回答
├── AI 使用 PDF 資料回答
├── 禁止再輸出 [AUTO_SEARCH_PDF]
└── 若仍無法回答 → 引導找 Sam
```

**關鍵參數**：
- `isRetry`: 防止無限循環的旗標
- 重試模式下 Prompt 會明確告知「禁止再輸出暗號」

---

### 2. 硬體判讀天條

**規則**：CLASS_RULES 規格清單沒寫的功能 = 此型號沒有此功能

**範例**：
- ❌ 錯誤：「G8 系列都有耳機孔」（過度概括）
- ✅ 正確：「G80SD 的規格表中有標註 3.5mm 耳機孔」
- ✅ 正確：「G81SF 的規格表中沒有耳機孔的說明，建議確認官網規格或找 Sam」

---

### 3. 系列差異隔離

**問題**：同系列不同型號的規格可能差異很大

**處理方式**：
1. 使用者提到模糊型號（如「G8」）→ 列出所有 G8 型號
2. 詢問「請問你的型號是哪一款？」
3. 確認型號後才提供規格資訊

**Prompt 指示**：
```
禁止使用「G8 系列都有...」這類概括回答。
不同型號的規格可能完全不同，必須確認具體型號才能回答。
```

---

### 4. 上下文讀取（6 句規則）

**設計**：
- 對話歷史保留 3 輪（6 句：3 user + 3 assistant）
- 儲存於 `上次對話` Sheet
- 每次 API 呼叫時自動載入

**用途**：
- 處理代名詞（「它」「這台」「剛剛說的那個」）
- 連續追問同一主題
- 判斷是否為第 4 輪無解（觸發引導找 Sam）

---

### 5. 直通車機制（強制深度搜尋）

**觸發關鍵字**：
```javascript
const strongKeywords = [
  "G90XF", "G95SC", "G80SD", "G81SF",
  "ViewFinity", "Smart Monitor",
  "OLED", "Odyssey3D"
];
```

**設計理由**：
這些產品較新或較複雜，Sheet 資料通常不足，強制附帶 PDF 可提供更完整回答。

---

### 6. 知識庫優先級

| 優先級 | 資料源 | 用途 | 觸發時機 |
|--------|--------|------|----------|
| 🥇 1 | QA Sheet | 已驗證的問答對 | 永遠載入 |
| 🥈 2 | CLASS_RULES | 機型規格 + 術語定義 | 永遠載入 |
| 🥉 3 | PDF 手冊 | 詳細操作步驟 | 深度搜尋/自動召喚 |

---

## Version 21.x - 舊版邏輯（已棄用）

### [NEED_DOC] 機制

**原設計**：
- AI 資料不足時輸出 `[NEED_DOC]` 暗號
- 使用者需手動輸入「1」或「深度」觸發深度搜尋
- 使用者體驗不佳，已被 [AUTO_SEARCH_PDF] 取代

---

## 調整記錄模板

```markdown
## Version X.X.X - 標題
**日期**: YYYY/MM/DD
**類型**: 邏輯調整 | 規則新增 | 架構變更

### 調整內容
- 問題描述
- 解決方案
- 影響範圍

### Prompt 變更（如有）
\`\`\`
變更前：...
變更後：...
\`\`\`
```

---

## 附錄：Prompt 核心規則（Prompt.csv C3）

以下為 AI 客服的核心回答規則，任何調整請同步更新此文件：

1. **硬體規格**：必須從 CLASS_RULES 交叉驗證
2. **操作步驟**：優先使用 QA，不足則 [AUTO_SEARCH_PDF]
3. **查無資料**：引導找 Sam，禁止瞎掰
4. **模糊型號**：列出所有可能，詢問確認
5. **規格衝突**：保守回答「不確定，問 Sam」
6. **商業機密**：幽默拒絕
7. **連續追問無解**：第四輪後引導找 Sam
8. **稱謂**：只用「你」，禁用「您」
