# 優先級架構與實現邏輯文檔

**最後更新**：2025-12-08  
**版本**：v25.0.5  
**作者**：Sam (與 AI 共同設計)  

⚠️ **重要**：本文檔記錄已解決問題的「完整解決方案」，防止未來版本（v26/v27/v28...）在除錯時「重新發現」同一問題並反覆解決。這是「決策歷史記錄」，不是開發文檔。

---

## 📋 目錄

1. [核心原則](#核心原則)
2. [優先級架構](#優先級架構)
3. [實現細節](#實現細節)
4. [常見陷阱](#常見陷阱)
5. [修改檢查清單](#修改檢查清單)

---

## 核心原則

### 💡 Brain-First 優先級設計

**目標**：降低成本 + 提高速度 + 保留完整記憶

```
QA資料庫（最優先）
  ↓
CLASS_RULES（規格/術語）
  ↓
LLM 通用知識（業界標準）
  ↓
PDF 手冊（操作步驟、故障排除）
  ↓
網路搜尋（補充信息）
```

### ❌ 禁止模式

1. **禁止盲目進 PDF**
   - ❌ 「什麼是 HDR」不應進 PDF（是通識知識，不是產品手冊內容）
   - ❌ 「M8 有視訊鏡頭嗎」不應進 PDF（規格在 CLASS_RULES 中）
   - ❌ 「M7 多少錢」不應進 PDF（是商業信息，手冊無此內容）

2. **禁止型號汙染**
   - ❌ 用戶說「M8」就載所有包含「M8」別稱的 PDF（會導致載 M80D/M70D/M50 的 PDF）
   - ✅ 只載「明確對應的 M8 型號」的 PDF（如 S32FM803）

3. **禁止跳過 Fast Mode**
   - ❌ 直通車關鍵字命中就立即開 PDF Mode
   - ✅ 先走 Fast Mode（QA + CLASS_RULES），只有 Fast Mode 無法完整回答才進 PDF

4. **禁止官方信息搜尋**
   - ❌ 用戶問「有沒有最新韌體」就直接搜網路
   - ✅ 告訴用戶「請到官網查詢」，由用戶主動維護重要信息在 QA/CLASS_RULES

---

## 優先級架構

### 分層流程圖

```
用戶問題 (msg)
    ↓
【實時資訊層】 (2305-2328 行)
  • 「今天幾號」「現在幾點」→ 直接回答
    ↓ (若非實時信息)
【Fast Mode 層】 (2494 行)
  attachPDFs = false
  
  ┌─ 優先 1: QA 資料庫 (Cache 注入)
  ├─ 優先 2: CLASS_RULES (Cache 注入)
  └─ 優先 3: LLM 通用知識 (Gemini 內建)
  
  回應包含 [AUTO_SEARCH_PDF]?
  ├─ NO → 直接回覆（成本 $0.001-0.003）✅
  └─ YES ↓
【Non-PDF 過濾層】 (2523-2550 行)
  檢查是否「不需要 PDF 的問題」
  ├─ YES (規格定義、通識知識、價格等)
     → 用 Fast Mode 答案（成本 $0.001-0.003）✅
  └─ NO ↓
【Deep Mode 層】 (2561 行)
  attachPDFs = true
  
  ┌─ 優先 4: PDF 手冊 (getRelevantKBFiles)
  │   • 智慧選擇相關 PDF（精準型號匹配）
  │   • 避免型號汙染（hasInjectedModels 標記）
  └─ 優先 5: LLM 知識 + 網路搜尋（補充）
  
  → 詳細回覆（成本 $0.65-1.2）⚠️
```

### 各層的詳細實現

#### 【優先 1】QA 資料庫

**時機**：Fast Mode 中永遠載入  
**來源**：`QA.csv` Sheet  
**實現**：`buildDynamicContext()` 第 1390-1420 行

```javascript
// 從 Cache 讀取 QA（由 syncGeminiKnowledgeBase 預先儲存）
const qaChunks = [];
for (let i = 0; i < parseInt(cache.get('KB_QA_COUNT') || '0'); i++) {
    const chunk = cache.get(`KB_QA_${i}`);
    if (chunk) qaChunks.push(chunk);
}

// 拼接到 Prompt 的最優先位置
dynamicContext += `\n\n=== 💡 精選問答 (QA - 最優先參考) ===\n${qaContent}\n`;
```

**成本**：通常 2-5KB，約 $0.0001 per call  
**特性**：
- ✅ 已驗證的問答，LLM 直接引用
- ✅ 優先於所有其他資料源
- ✅ 適合常見問題、價格、型號確認

**何時應擴充 QA**：
- 用戶重複問的問題（>3 次相同問題）
- 容易被誤解的概念
- 操作手冊無明確步驟但用戶常問的功能

---

#### 【優先 2】CLASS_RULES 規格定義

**時機**：Fast Mode 中永遠載入  
**來源**：`CLASS_RULES.csv` Sheet  
**實現**：`buildDynamicContext()` 第 1420-1480 行

```javascript
// 從 Cache 讀取 CLASS_RULES（分為規格 + 定義）
const rulesChunks = [];
for (let i = 0; i < parseInt(cache.get('KB_RULES_COUNT') || '0'); i++) {
    const chunk = cache.get(`KB_RULES_${i}`);
    if (chunk) rulesChunks.push(chunk);
}

// 拼接到 Prompt 中
dynamicContext += `\n\n=== 📚 通用術語與系列定義 ===\n${definitionsContent}\n`;
dynamicContext += `\n\n=== 📱 詳細機型規格資料庫 ===\n${specsContent}\n`;
```

**格式**（CSV 中的例子）：

```csv
型號：S32FM803, M8, Smart Monitor M8,有視訊鏡頭,支援 Wi-Fi,內建揚聲器,解析度 1920x1080
型號：S27CM50, M50, Smart Monitor M50,無視訊鏡頭,支援藍牙,無內建揚聲器,解析度 1920x1200
術語_OLED,有機發光二極體,對比度無限,色彩準確,功耗低,價格較高
術語_HDR,高動態範圍,擴展亮度範圍,色彩豐富,需要支援設備
```

**成本**：通常 10-20KB，約 $0.001-0.002 per call  
**分流規則**（`syncGeminiKnowledgeBase` 第 1370-1410 行）：

```javascript
// 分流邏輯
if (key.startsWith("型號：") || key.startsWith("LS")) {
    // → 進入 specsContent（硬體規格區）
    specsContent += `* ${text}\n`;
} else {
    // → 進入 definitionsContent（術語定義區）
    definitionsContent += `* ${text}\n`;
}
```

**何時應擴充 CLASS_RULES**：
- 新型號上市（必須新增規格行）
- 新術語出現（定義新功能/技術）
- 規格變更（如新版本的韌體支持新功能）

**規格行的別稱映射**（第 1410-1430 行）：

```javascript
// 從規格行中自動提取別稱
// 例如「S32FM803, M8, Smart Monitor M8,有視訊鏡頭...」
// 會自動映射：M8 → S32FM803, S32FM803 → 完整規格文本

potentialAliases.forEach(alias => {
    if (alias !== sModel && !alias.startsWith("LS")) {
        keywordMap[alias] = sModel;  // M8 → S32FM803
    }
});
```

---

#### 【優先 3】LLM 通用知識

**時機**：Fast Mode 中，當 QA + CLASS_RULES 無答案時  
**來源**：Gemini 內建知識庫  
**實現**：Prompt.csv 中的指導

```csv
【極速模式】(Fast Mode)
3.智能判斷優先級（不進 PDF 可直接回答的）：
  - **業界標準/通識知識**（如「什麼是 HDR」「HDR vs HDR10」）
    → 用 LLM 通用知識回答，無需進 PDF
```

**何時使用**：
- ✅ 「什麼是 HDR/色域/Gsync」
- ✅ 「HDR 和 HDR10 有什麼差異」
- ✅ 「為什麼曲面螢幕適合電競」
- ❌ 「我的 M8 怎麼設定 HDR」（這是操作問題，需要 PDF）

**成本**：包含在 Fast Mode 中，不額外增加  
**特性**：
- ✅ LLM 能講得清楚的概念（無歧義）
- ✅ 不涉及三星特定產品功能
- ✅ 通常是「解釋」而非「操作步驟」

---

#### 【優先 4】PDF 手冊

**時機**：僅當 Fast Mode 輸出 `[AUTO_SEARCH_PDF]` 時觸發  
**來源**：Drive 中的 PDF 檔案  
**實現**：`getRelevantKBFiles()` 第 1770-1920 行

##### 三層型號匹配策略

```javascript
// Tier 0: 必載（QA + CLASS_RULES）- 已在 buildDynamicContext 中
const tier0 = [];

// Tier 1: 精準匹配（根據用戶提到的型號）
const tier1 = [];
const exactModels = []; // 從對話中提取的型號

// 步驟 1: 從對話歷史提取型號
if (userId) {
    const contextFromHistory = extractContextFromHistory(userId, contextId);
    if (contextFromHistory && contextFromHistory.models) {
        exactModels = exactModels.concat(contextFromHistory.models);
    }
}

// 步驟 2: 從短期 Cache 讀取直通車注入型號（避免重複反問）
if (userId) {
    const injectedModelsJson = cache.get(`${userId}:direct_search_models`);
    if (injectedModelsJson) {
        const injectedModels = JSON.parse(injectedModelsJson);
        exactModels = exactModels.concat(injectedModels);
        hasInjectedModels = true;  // v25.0.0 新增：避免型號汙染
    }
}

// 步驟 3: 從 KEYWORD_MAP 擴充（僅當「未從 Cache 讀到型號」時）
// v25.0.0 修復：hasInjectedModels = true 時跳過此步
if (!hasInjectedModels) {
    Object.keys(keywordMap).forEach(key => {
        if (combinedQuery.includes(key) || combinedQueryNoSpace.includes(key)) {
            const mappedValue = keywordMap[key].toUpperCase();
            const modelMatch = mappedValue.match(MODEL_REGEX);
            if (modelMatch) {
                exactModels = exactModels.concat(modelMatch);
            }
        }
    });
}

// 步驟 4: 分級載入
kbList.forEach(file => {
    const fileName = file.name.toUpperCase();
    
    // Tier 0: 必載
    if (file.isPriority) {
        tier0.push(file);
        return;
    }
    
    // Tier 1: 精準匹配（完整型號如 G90XF, S32DG802SC）
    const isTier1 = exactModels.some(model => fileName.includes(model));
    if (isTier1 && tier1.length < MAX_TIER1_COUNT) {  // 上限 2 本
        tier1.push(file);
        return;
    }
});

return [...tier0, ...tier1];
```

**關鍵設計**：

| 設計點 | 意義 | 為什麼重要 |
|------|------|----------|
| `hasInjectedModels` 標記 | 若已從 Cache 讀到型號，跳過 KEYWORD_MAP 擴充 | 避免型號汙染（例如 M8 的別稱包含 M80D/M70D，會載多本 PDF） |
| 精準匹配限制（`MAX_TIER1_COUNT = 2`） | 最多載 2 本 PDF | 控制成本（2 本 PDF = 65K tokens = $0.65；3 本 = $1.0） |
| 無模糊匹配 | 只載「完整型號」的 PDF，不載「相似型號」 | 避免「問 G90XF」卻載到「G80SD」的手冊 |
| 短型號自動生成 | S32DG802SC → S32DG802 | 適配 PDF 檔名格式（許多檔名不含 SC/UC 後綴） |

**成本**：1-2 本 PDF × 30-40KB = 60-80K tokens = $0.06-0.12  
**何時應上傳新 PDF**：
- 新型號推出（對應新手冊）
- 舊型號韌體重大更新（操作步驟改變）
- 常見故障排除無對應手冊

---

#### 【優先 5】網路搜尋

**時機**：Deep Mode 中，当 PDF 確實無相關內容時  
**實現**：Gemini API 中的 `google_search` 工具（第 2115-2119 行）

```javascript
if (attachPDFs && !imageBlob) {
    tools: [
        {
            google_search: {}  // 僅在 Deep Mode 啟用
        }
    ]
}
```

**Prompt 指導**（Prompt.csv Deep Mode 第 5 點）：

```csv
【深度模式】(Deep Mode - 已掛載 PDF)
5.來源與搜尋邏輯：
  - **優先用 PDF**：直接引用手冊內容 → 「[來源: 產品手冊]」
  - **補充通用知識**：若手冊提及但解釋不足，可加入 LLM 通用知識 → 「[來源: 非三星官方]」
  - **啟用網路搜尋**：只有在以下情況：
      手冊確實無相關內容，且用戶問的內容需要最新資訊才能回答
      （如最新韌體版本、當前驅動程式版本等技術更新）
      才啟用搜尋 → 「[來源: 網路搜尋]」
  - ❌ **絕對禁止搜尋**：
      官方公告、韌體更新資訊、驅動程式、安全通報等。
      用戶若問這類 → 回答「這類資訊會定期發佈在官網，建議到 Samsung 官網查詢」，勿搜尋
```

**禁止搜尋列表**（第 30-35 行）：

```csv
❌ **嚴格禁止搜尋**：
  • 價格/銷售通路/競品比較
  • 負面新聞/災情/異常問題/八卦
  • 投資/股價
  • **官方公告/韌體更新/驅動程式/安全性通報**
  • 用戶若問 → 婉拒「這類資訊沒有收錄，建議聯絡 Sam 或查詢官網」
```

**為什麼禁止官方信息搜尋**：
- 官方信息應由 **用戶（你）主動維護** 在 QA/CLASS_RULES 中
- Bot 不應主動搜尋官方信息，因為：
  1. 網路上可能有舊/錯誤的版本
  2. 用戶無法控制 Bot 回答的是否是最新信息
  3. 成本無法預測（搜尋會額外費用）
  4. 安全風險（可能搜到釣魚網站）

**成本**：搜尋工具額外計費，約 $0.1-0.3 per search

---

## 實現細節

### 核心機制 1：四層型號處理

**概念**：避免「用戶說 M8，系統載了 M80D/M70D/M50 的 PDF」這類型號汙染

**流程**（`getRelevantKBFiles` 第 1775-1830 行）：

```javascript
// 1. 對話歷史型號（最清晰，跨時間邊界）
const contextFromHistory = extractContextFromHistory(userId, contextId);
if (contextFromHistory && contextFromHistory.models) {
    exactModels = exactModels.concat(contextFromHistory.models);
}

// 2. 短期 Cache 型號（直通車注入，同一對話內有效）
const injectedModelsJson = cache.get(`${userId}:direct_search_models`);
if (injectedModelsJson) {
    const injectedModels = JSON.parse(injectedModelsJson);
    exactModels = exactModels.concat(injectedModels);
    hasInjectedModels = true;  // 標記：禁止再從 KEYWORD_MAP 擴充
}

// 3. 當前查詢型號（最直接）
const directModelMatch = combinedQuery.match(MODEL_REGEX);
if (directModelMatch) {
    exactModels = exactModels.concat(directModelMatch);
}

// 4. KEYWORD_MAP 擴充（僅當「無直通車注入」時）
if (!hasInjectedModels) {
    // 從 KEYWORD_MAP 查找相關型號
    // 例如：M8 → S32FM803, M80D, M70D （但只在未從 Cache 讀到時）
}
```

**優先級順序**：歷史 > Cache (direct) > 當前查詢 > KEYWORD_MAP

**為什麼需要 `hasInjectedModels`**（v25.0.0 新增）：

場景：用戶說「我的 M8」→ 系統從 KEYWORD_MAP 提取 M8 的所有別稱（M80D, M70D, M50）  
↓  
「那 M7 呢」→ 系統又從 KEYWORD_MAP 提取 M7 的所有別稱  
↓  
最後載了 10 本 PDF，Token 爆炸！

解決方案：
- 第一次命中直通車時，將型號存到 Cache（`${userId}:direct_search_models`）
- 並設置 `hasInjectedModels = true` 標記
- 後續就不再從 KEYWORD_MAP 擴充，只沿用已知型號

---

### 核心機制 2：[AUTO_SEARCH_PDF] 暗號

**概念**：Fast Mode 回應包含此暗號，系統自動進入 Deep Mode

**實現**（第 2520-2630 行）：

```javascript
// Fast Mode 回應
let rawResponse = callChatGPTWithRetry([...history, userMsgObj], null, false, false, userId);

// 檢測暗號
if (finalText.includes("[AUTO_SEARCH_PDF]") || finalText.includes("[NEED_DOC]")) {
    writeLog("[Auto Search] 偵測到搜尋暗號");
    finalText = finalText.replace(/\[AUTO_SEARCH_PDF\]/g, "").trim();
    
    // 檢查「這是否真的需要 PDF」
    const isNonPdfQuestion = nonPdfPatterns.some(p => p.test(msg));
    
    if (isNonPdfQuestion) {
        // 不進 Deep Mode，用 Fast Mode 的答案
        replyText = finalText;
    } else {
        // 進入 Deep Mode
        const deepResponse = callChatGPTWithRetry([...history, userMsgObj], null, true, true, userId);
    }
}
```

**為什麼設計暗號而非讓 LLM 決定**：
- Prompt 指導無法 100% 控制 LLM 行為
- 暗號是「顯式信號」，更可靠
- 便於 debug（可在日誌中看到）
- LLM 可安全地輸出「需要查資料」的想法

**Prompt 中的指導**（Prompt.csv 極速模式第 4 點）：

```csv
4.操作步驟/故障排除（**這裡才需要 [AUTO_SEARCH_PDF]**）：
  - 若 QA 中有答案 → 直接回答。
  - 若 QA 中無答案（即無完整操作/故障步驟）
    → **必須**在回答最後加上暗號 [AUTO_SEARCH_PDF]，系統會自動幫你翻閱 PDF 手冊。
  - 即使你知道該功能的原理，若無法提供具體「操作步驟」或「故障排除方法」，
    也必須輸出 [AUTO_SEARCH_PDF]。
```

---

### 核心機制 3：buildDynamicContext（動態內容注入）

**概念**：無需上傳大檔案，而是在每次 API 呼叫時動態注入 QA + CLASS_RULES

**實現**（第 1390-1510 行）：

```javascript
function buildDynamicContext(messages, userId) {
    let dynamicContext = "";
    
    // 讀取 QA（分塊儲存，每塊 90KB）
    const qaChunks = [];
    for (let i = 0; i < parseInt(cache.get('KB_QA_COUNT') || '0'); i++) {
        const chunk = cache.get(`KB_QA_${i}`);
        if (chunk) qaChunks.push(chunk);
    }
    const qaContent = qaChunks.join("\n\n");
    
    // 讀取 CLASS_RULES（定義 + 規格）
    const rulesChunks = [];
    for (let i = 0; i < parseInt(cache.get('KB_RULES_COUNT') || '0'); i++) {
        const chunk = cache.get(`KB_RULES_${i}`);
        if (chunk) rulesChunks.push(chunk);
    }
    
    // 拼接到 Prompt
    dynamicContext += `\n\n=== 💡 精選問答 (QA - 最優先參考) ===\n${qaContent}\n`;
    dynamicContext += `\n\n=== 📚 通用術語與系列定義 ===\n${definitionsContent}\n`;
    dynamicContext += `\n\n=== 📱 詳細機型規格資料庫 ===\n${specsContent}\n`;
    
    return dynamicContext;
}
```

**優勢**：
- ✅ 無需上傳額外檔案，省空間
- ✅ QA + CLASS_RULES 永遠在 Fast Mode
- ✅ 實時更新（修改 Sheet 後自動反映）
- ✅ 成本透明（預知 Token 數量）

**存儲方案**：
- QA 最多 90KB/塊（CacheService 6 小時有效期）
- CLASS_RULES 最多 90KB/塊（分別儲存定義區 + 規格區）
- 每次同步時重新計算分塊數（`KB_QA_COUNT`, `KB_RULES_COUNT`）

---

## 常見陷阱

### 🔴 陷阱 1：型號汙染（v24 版本的慘劇）

**症狀**：
```
用戶：「M8 怎麼樣」
Bot：「根據手冊，M8 支援以下功能：」
日誌：「[KB Select] 命中型號: S32FM803, M80D, M70D, M50, ... 總共 8 本 PDF」
Token 使用：114K（預期 50K，超 2 倍）
費用：$0.12（本應 $0.06）
```

**根因**：KEYWORD_MAP 中，M8 的別稱包含「M80D, M70D, M50 都是 Smart Monitor」，系統全部載入。

**解決方案**：v25.0.0 新增 `hasInjectedModels` 標記

```javascript
// 關鍵代碼（第 1810 行）
if (injectedModelsJson) {
    const injectedModels = JSON.parse(injectedModelsJson);
    exactModels = exactModels.concat(injectedModels);
    hasInjectedModels = true;  // ← 此標記很關鍵
}

// 後續（第 1856 行）
if (!hasInjectedModels) {  // 只有此時才從 KEYWORD_MAP 擴充
    Object.keys(keywordMap).forEach(key => {
        // 擴充邏輯...
    });
}
```

**檢查清單**（修改時）：
- [ ] 修改型號提取邏輯前，確認 `hasInjectedModels` 是否有被考慮
- [ ] 測試「M8」→「M7」的連續問題，檢查 PDF 數量是否異常增加
- [ ] 確認日誌輸出「從 Cache 讀取直通車注入型號」時不再出現「從 KEYWORD_MAP 擴充」

---

### 🔴 陷阱 2：所有 [AUTO_SEARCH_PDF] 都進 PDF

**症狀**：
```
用戶：「什麼是 OLED」
Bot：「[AUTO_SEARCH_PDF]」
系統：進入 Deep Mode，載 PDF，用 $0.65...
```

**根因**：過於信任 LLM 的 [AUTO_SEARCH_PDF]，沒有過濾「不需要 PDF」的問題。

**解決方案**：`nonPdfPatterns` 過濾（第 2523-2550 行）

```javascript
const nonPdfPatterns = [
    // 硬體規格問題（CLASS_RULES 已包含）
    /耳機孔|USB|HDMI|解析度|Hz|喇叭|VESA|面板|OLED|TN/i,
    
    // 通識知識、技術概念（LLM 可答）
    /什麼是|定義|優點|缺點|比較|差異/i,
    /HDR|色域|Gsync|Freesync|色溫|對比度|色準/i
];

const isNonPdfQuestion = nonPdfPatterns.some(p => p.test(msg));

if (isNonPdfQuestion) {
    // 不進 Deep Mode
    replyText = finalText;
}
```

**檢查清單**（修改時）：
- [ ] 新增 `nonPdfPatterns` 時，確認與 Prompt 中「無需進 PDF」的定義一致
- [ ] 測試「什麼是 HDR」「M8 有視訊鏡頭嗎」，確認不進 PDF
- [ ] 測試「怎麼設定 HDR」「HDMI 連不上」，確認進 PDF

---

### 🔴 陷阱 3：跳過 Fast Mode，直接進 PDF

**症狀**：
```
用戶：提到直通車關鍵字（如「M8」）
Bot：立即進 Deep Mode，載 PDF
用戶：提問「M8 有附鏡頭嗎」
費用：$0.65（本應 $0.001）
```

**根因**：v24 版本的設計，直通車命中就立即開 PDF Mode。

**正確設計**（v24.4.1 修正）：

```javascript
// ❌ 舊邏輯（v24 及以前）
if (directSearchResult.hit) {
    // 立即開啟 PDF Mode，進入反問流程
}

// ✅ 新邏輯（v24.4.1+）
if (directSearchResult.hit) {
    hitAliasKey = directSearchResult.key;
    // 只記錄，不立即開 PDF Mode
    writeLog(`[Direct Search] 命中直通車關鍵字: ${hitAliasKey}，先走 Fast Mode`);
    cache.put(`${userId}:hit_alias_key`, hitAliasKey, 300);
}
// 然後繼續走 Fast Mode
let rawResponse = callChatGPTWithRetry([...history, userMsgObj], null, false, false, userId);
```

**檢查清單**（修改時）：
- [ ] 確認「直通車關鍵字命中」時，不會跳過 Fast Mode
- [ ] 測試「M8」「G90XF」等關鍵字，確認先走 Fast Mode（日誌應顯示「先走 Fast Mode」）
- [ ] 僅當 Fast Mode 輸出 `[AUTO_SEARCH_PDF]` 時，才進入 Deep Mode

---

### 🔴 陷阱 4：官方信息搜尋

**症狀**：
```
用戶：「有沒有最新的 M8 韌體」
Bot：搜尋網路，回覆「是的，最新版本是...」
實際：搜到的是舊版本或釣魚網站 😱
用戶無法更新 QA/RULES，信息無法控制
```

**根因**：没有限制搜尋範圍，LLM 無法分辨官方信息的真偽。

**正確設計**（Prompt v25.0.5）：

```csv
❌ **絕對禁止搜尋**：官方公告、韌體更新資訊、驅動程式、安全通報等
用戶若問這類 → 回答「這類資訊會定期發佈在官網，建議到 Samsung 官網查詢」，勿搜尋
```

**實作意義**：
- 官方信息應由 **你（用戶）主動維護** 在 QA/CLASS_RULES
- Bot 只負責補充「手冊缺的」非官方技術知識
- 成本完全可控（無隨意搜尋費用）
- 信息準確性由你保證（你是最熟悉產品的人）

**檢查清單**（修改時）：
- [ ] Prompt 中「禁止搜尋官方信息」的限制仍然存在
- [ ] 若用戶問「有沒有新韌體」，Bot 應回「請到官網查詢」而非搜尋
- [ ] 若要支持韌體查詢，應在 QA 中手動新增「最新韌體版本」，而非搜尋

---

## 未來除錯檢查清單（防止重複解決）

> 當 v26/v27/v28... 在除錯時發現「奇怪的成本問題」或「回答質量下降」時，使用此清單確認是否是「重新發現」了已解決的問題。

### 場景 1：發現「PDF 查詢量超預期」

**症狀**：
```
分析日誌發現：
  - 預期 30% Fast Mode，70% Deep Mode
  - 實際：90% Deep Mode，Fast Mode 極少
  - 成本急速上升
  - 用戶反映「回答速度變慢」
```

**檢查清單**：

```markdown
問題診斷：
- [ ] 檢查 nonPdfPatterns 是否還存在（第 2523-2550 行）
- [ ] 驗證「什麼是 HDR」「M8 有鏡頭嗎」等問題的日誌
      應該看到「[Non-PDF Q]」而非「[KB Load] AttachPDFs: true」
- [ ] 檢查直通車邏輯是否被改回「命中就進 PDF」
      應該在日誌中看到「先走 Fast Mode」，而非立即「[PDF Mode]」
- [ ] 確認 Prompt 是否有被改動（特別是「快速判斷優先級」部分）

如果 1-4 都檢查過了，可能的新問題：
- [ ] 是否新增了「用戶多次提問就自動進 PDF」的邏輯？
- [ ] 是否修改了 MODEL_REGEX，導致型號提取不準確？
- [ ] 是否改動了 buildDynamicContext，導致 QA/CLASS_RULES 沒被載入？

→ 參考本文檔的「問題 #1」「問題 #2」「問題 #3」
→ 不要重新設計，之前已論證過，恢復對應邏輯
```

---

### 場景 2：發現「Token 數量異常高」（同一問題多個 PDF）

**症狀**：
```
日誌顯示：
  [KB Select] 命中型號: S32FM803, M80D, M70D, S27CM50, S32DG802, ...
  [KB Load] Files: 8 / 15  (加載 8 本 PDF！)
  Token 計算：114K tokens = $1.14
  成本是預期的 2 倍
```

**檢查清單**：

```markdown
問題診斷：
- [ ] 檢查 hasInjectedModels 標記是否存在（第 1810 行）
- [ ] 驗證 getRelevantKBFiles() 中的「if (!hasInjectedModels)」邏輯
      此條件應該防止 KEYWORD_MAP 過度擴充
- [ ] 檢查日誌中「從 Cache 讀取直通車」和「設置 hasInjectedModels」的順序
      應該看到：
        [KB Select] 從 Cache 讀取直通車注入型號: S32FM803
        [KB Select] 已標記 hasInjectedModels=true，跳過 KEYWORD_MAP 擴充
- [ ] 驗證「短型號生成」邏輯是否超展（MAX_TIER1_COUNT = 2 是否被改成更大）

如果 1-4 都沒問題，可能的新問題：
- [ ] 是否新增了第三層型號來源（如 API），但沒加入 hasInjectedModels 判斷？
- [ ] 是否修改了 KEYWORD_MAP 的生成邏輯，導致別稱爆炸？
- [ ] 是否移除了 MAX_TIER1_COUNT 的限制？

→ 參考本文檔的「問題 #1」
→ 確保 hasInjectedModels 機制完整，不要移除或改動此邏輯
```

---

### 場景 3：發現「回答內容偏差」或「遺漏上下文」

**症狀**：
```
用戶對話中出現：
  Q1: 「M8 和 M7 區別」
  Q2: 「M8 的具體功能」
  系統反問型號，用戶選擇
  A: 「S32FM803 支持以下功能...」（完全沒提 M7 或比較）
  
用戶抱怨：「怎麼之前說的都忘了」
```

**檢查清單**：

```markdown
問題診斷：
- [ ] 檢查型號選擇流程中是否使用了 getHistoryFromCacheOrSheet()
      （第 715 行或 handlePdfSelectionReply() 函數）
- [ ] 驗證日誌中「[History]」的記錄行數
      應該 > 2（表示有完整歷史，不只是當前問題）
- [ ] 確認傳給 LLM 的 messages 陣列長度
      日誌應顯示類似「[API Call] Messages: 6 items」（而非只有 1-2 項）
- [ ] 檢查是否有「pending.originalQuery」的使用
      ❌ 如果還有，表示邏輯被改回舊版本了！

如果 1-4 都沒問題，可能的新問題：
- [ ] 是否修改了 getHistoryFromCacheOrSheet() 函數，導致只返回部分歷史？
- [ ] 是否改動了 Cache 的 TTL，導致歷史被提前清除？
- [ ] 是否新增了「簡化歷史以節省 Token」的邏輯，不小心把重要上下文刪掉？

→ 參考本文檔的「問題 #5」
→ 確保完整的歷史被傳給 LLM，不要改回舊邏輯
```

---

### 場景 4：發現「官方信息不準確」或「搜尋到釣魚網站」

**症狀**：
```
用戶反映：
  「Bot 說最新韌體是 1.2.3，但官網是 1.5.0」
  「Bot 搜到的『Samsung 公告』來自二手網站」
  
日誌顯示：
  [API Call] Tools: [google_search]
  User asked: 「最新韌體」「安全更新」「驅動程式」
  Bot: 搜尋網路並回複
```

**檢查清單**：

```markdown
問題診斷：
- [ ] 檢查 Prompt.csv 中「禁止搜尋清單」是否存在（第 30-35 行）
      應該包含「官方公告」「韌體更新」「驅動程式」「安全通報」
- [ ] 驗證日誌中「搜尋的關鍵字」是否包含禁止清單中的內容
      如果有，表示 Prompt 限制被忽略了
- [ ] 檢查是否有「自動更新官方信息」的新功能被加入
      ❌ 此功能應該被禁止（改由用戶在 QA.csv 維護）
- [ ] 確認 google_search 工具是否只在 Deep Mode 啟用
      （第 2115-2119 行應該有 if (attachPDFs) 判斷）

如果 1-4 都沒問題，可能的新問題：
- [ ] 是否有人新增了「定期搜尋官方網站」的排程任務？
- [ ] 是否修改了 Prompt，移除了「官方信息由用戶維護」的指導？
- [ ] 是否新增了「智能搜尋」功能，自動判斷何時搜尋？

→ 參考本文檔的「問題 #4」
→ 官方信息應由你在 QA.csv 維護，不要被 Bot 搜尋
→ 立即移除任何「自動搜尋官方信息」的功能
```

---

### 場景 5：發現「規格問題進 PDF 查詢」或「價格問題浪費成本」

**症狀**：
```
日誌顯示：
  Q: 「M8 有多少吋」
  → [KB Load] AttachPDFs: true, Files: 1
  成本：$0.65（本應 $0.001）

  Q: 「M8 多少錢」
  → [KB Load] AttachPDFs: true, Files: 1
  成本：$0.65（本應直接回覆「到官網查詢」）
```

**檢查清單**：

```markdown
問題診断：
- [ ] 檢查直通車邏輯是否被改回「命中就進 PDF」
      （第 2437-2460 行應該只記錄，不立即開 PDF Mode）
- [ ] 驗證是否有「簡單問題判斷」邏輯（simplePatterns，第 2465-2475 行）
      應該可以識別「價格」「官網」「多少」等關鍵字
- [ ] 檢查 nonPdfPatterns 是否涵蓋「規格定義」類問題
      例如「解析度」「尺寸」「Hz」應該不進 PDF
- [ ] 確認「型號變化檢測」邏輯是否被移除
      應該有「當用戶換型號時，清除 PDF Mode」的邏輯

如果 1-4 都沒問題，可能的新問題：
- [ ] 是否修改了 isSimpleQuestion 判斷，導致簡單問題被當複雜問題？
- [ ] 是否新增了「所有含型號的問題都進 PDF」的邏輯？
- [ ] 是否移除了「型號變化清除 PDF Mode」的功能？

→ 參考本文檔的「問題 #2」「問題 #3」
→ 不要因「提高 PDF 命中率」就改動此邏輯，會破壞成本控制
```

---

### 使用流程

當 v26+ 發現異常時：

```
第 1 步：根據「症狀」找到對應的「場景」章節
   ↓
第 2 步：按照「檢查清單」逐項驗證（4 項 + 新問題 3 項）
   ↓
第 3 步：如果「4 項都符合」且「新問題 3 項都否定」
   → 確認是「已解決問題」被重新觸發
   → 使用「箭頭建議」恢復邏輯
   ↓
第 4 步：如果「4 項都檢查過了」但「新問題有符合」
   → 這是「新變數導致的舊問題復發」
   → 需要設計「新的修復」
   → 記錄在本文檔，防止 v29 再重複
   ↓
第 5 步：如果「4 項都不符合」
   → 這是「完全新的問題」
   → 新設計方案，記錄在本文檔
```

---

## 版本歷史

### v25.0.5 (2025-12-08) - 現在
- ✅ 優先級架構正式文檔化
- ✅ 禁止官方信息搜尋
- ✅ 加強文案避免機器人感
- ✅ 本文檔新增

### v25.0.3 (2025-12-08)
- ✅ 保留完整對話歷史（選擇型號後）

### v25.0.0 (2025-12-08)
- ✅ 新增 `hasInjectedModels` 標記，防止型號汙染

### v24.5.0 (2025-12-05)
- ✅ 改為「先 Fast Mode，再根據 [AUTO_SEARCH_PDF] 決定是否進 Deep Mode」
- ✅ 新增 `nonPdfPatterns` 過濾

### v24.4.1 (2025-12-04)
- ✅ 修正：直通車命中不再立即反問，改為先走 Fast Mode

### v24.4.0
- ✅ 記錄 `hitAliasKey`，供後續 PDF 智慧匹配使用

---

**最後提醒**：每次修改前，至少看一遍「常見陷阱」部分，避免重蹈覆轍。特別是 **陷阱 1：型號汙染** 和 **陷阱 3：跳過 Fast Mode**，這兩個成本影響最大。
