# LLM 回答邏輯調整歷程

此文件記錄所有客服 LLM 回答邏輯的調整（非程式碼錯誤修正）。
每次更新請依照格式新增於最上方。

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
isSameModel = false 但邏輯無法比對...
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
