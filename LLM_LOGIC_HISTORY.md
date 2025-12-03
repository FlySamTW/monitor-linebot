# LLM 回答邏輯調整歷程

此文件記錄所有客服 LLM 回答邏輯的調整（非程式碼錯誤修正）。
每次更新請依照格式新增於最上方。

---

## Version 22.24.0 - LLM Strategy Finalized
**日期**: 2025/12/03
**類型**: 架構優化

### LLM 呼叫策略定案

| 呼叫點 | 模型 | Thinking Mode | 用途 |
|--------|------|---------------|------|
| `callChatGPTWithRetry` | gemini-2.5-flash | ✅ 啟用 | 主要對話，需要複雜推理 |
| `findSimilarQA` | gemini-2.5-flash | ❌ thinkingBudget=0 | 相似 QA 比對 |
| `callGeminiToMergeQA` | gemini-2.5-flash | ❌ thinkingBudget=0 | 合併 QA |
| `callGeminiToRefineQA` | gemini-2.5-flash | ❌ thinkingBudget=0 | 精煉 QA |
| `callGeminiToPolish` | gemini-2.5-flash | ❌ thinkingBudget=0 | 潤稿 |
| `callGeminiToModify` | gemini-2.5-flash | ❌ thinkingBudget=0 | 修改 QA |
| `handleAutoQA` | gemini-2.5-flash | ❌ thinkingBudget=0 | 自動整理 |

### 設計原則
- **主要對話**：保留 Thinking Mode，提供複雜推理能力（硬體規格判讀、多條件判斷）
- **QA 輔助任務**：關閉 Thinking Mode (`thinkingBudget=0`)，加快速度、降低成本
- **統一使用 gemini-2.5-flash**：不再混用 2.0-flash，維護更簡單

### 技術細節
Gemini 2.5 Flash 的 Thinking Mode 可透過 `thinkingConfig.thinkingBudget` 控制：
- `thinkingBudget: 0` = 完全關閉思考
- 不設定 = 預設啟用（Auto 模式）

---

## Version 22.21.0 - Loading Animation Loop + Thinking Leak Filter
**日期**: 2025/12/03
**類型**: 體驗優化 + 安全性

### 1. Loading 動畫循環補發

**問題**：LINE Loading Animation 最長 60 秒，但 Gemini 有時需要更久回應。

**解決方案**：
- `showLoadingAnimation` 改成 20 秒
- `callChatGPTWithRetry` 新增 userId 參數
- 每 18 秒自動補發 Loading（20 秒會消失，提前 2 秒補發）

### 2. Thinking Mode 洩漏過濾

**問題**：Gemini 2.5 Flash 的 Thinking Mode 有時會在回應中輸出內部指令。

**解決方案**：
在 `formatForLineMobile` 加入過濾：
```javascript
// 過濾 Thinking Mode 洩漏
text = text.replace(/SPECIAL INSTRUCTION[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi, '');
text = text.replace(/\[INTERNAL\][\s\S]*?\[\/INTERNAL\]/gi, '');
text = text.replace(/\[THINKING\][\s\S]*?\[\/THINKING\]/gi, '');
```

---

## Version 22.20.0 - Prompt Rules Enhancement
**日期**: 2025/12/03
**類型**: 邏輯強化

### 新增 Prompt 規則 16-18

**問題背景**：
從對話 Log 分析發現以下問題：
1. 過期活動仍推薦（雙11 已過期還在推）
2. 模糊問題直接假設（「最近」→ 直接列活動）
3. 競品比較回答（QD-OLED vs W-OLED）

**新增規則**：

#### 規則 16【價格與活動查詢規則】
- 活動截止日期判斷（過期嚴禁提及）
- 標準回覆格式含官網連結
- **日期判斷天條**：回答任何活動前必須先確認今天日期

#### 規則 17【模糊/過短問題處理】
- 少於 5 字且語意不明 → 反問釐清
- 部分型號無法匹配 → 列出可能型號
- 嚴禁直接說「沒有資料」

#### 規則 18【競品比較禁令】
- 嚴禁比較非三星品牌
- 標準回覆：「我只熟三星的產品啦」
- 唯一例外：資料庫明確提到的技術比較

---

## Version 22.17.1 - Record Prompt Slim
**日期**: 2025/12/03
**類型**: 穩定性提升

### 內容
- 精簡 `/紀錄` 相關提示詞：
   - `callGeminiToPolish`、`callGeminiToModify` 刪除長篇示例，改用極短約束（只回一行、半形逗號、≤80字、嚴禁解釋）
- 限制輸出長度：兩者 `maxOutputTokens=80`，降低觸發 `finishReason=MAX_TOKENS` 的機率
- 與 22.17.0 的降級保底搭配，顯著降低「分析失敗」回覆風險

---

## Version 22.17.0 - Record Polish Fallbacks
**日期**: 2025/12/03
**類型**: 穩定性提升 + 體驗優化

### 1. `/紀錄` 流程全面防呆

**現象**：
部分情況 Gemini 回應 `finishReason=MAX_TOKENS` 或 `candidates[0].content.parts[0].text` 不存在，舊版程式直接存取 index 造成錯誤，回覆「分析失敗」。

**處理**：
- `callGeminiToPolish`、`callGeminiToModify` 改為安全解析（完整檢查陣列與欄位存在）
- 任何 API 錯誤／解析失敗／text 不存在 → 不丟例外，改走本地降級：
   - `simplePolishFallback(input)` 生成「問題, 答案」
   - `simpleModifyFallback(text, instruction)` 以最小代價修改既有內容

### 2. `/紀錄`（無內容）自動整理

- `handleAutoQA` 改為輸出單列「問題, 答案」，並在 AI 回傳無效時，以最後一輪 user/assistant 內容降級組字，確保可入庫

### 3. 使用者體驗

- 啟動建檔後立即顯示預覽，並清楚提示：
   - 修改 → 直接回訊修改
   - 儲存 → `/紀錄`
   - 退出 → `/取消`

---

## Version 22.16.0 - Robust Polish + Price Fix
**日期**: 2025/12/03
**類型**: Bug Fix + 邏輯修正

### 1. `/紀錄` 健壯化

**問題**：
`/紀錄` 出現錯誤 `Cannot read properties of undefined (reading '0')`

**原因**：
`callGeminiToPolish()` 和 `callGeminiToModify()` 沒有錯誤處理，當 API 回傳異常時直接 crash。

**修正**：
- 加入完整 try-catch
- 檢查 HTTP 狀態碼
- 檢查 AI 回傳是否為空
- 加入詳細 Log

### 2. 價格查詢邏輯修正

**問題**：
問「S27BM50 價格」時，AI 可能會把型號改成「M5」或「Smart Monitor」，導致官網搜尋無法命中。

**修正**：
在型號模式識別指南中明確規定：
```
【價格查詢原則】(最高優先級)
1. 若使用者問價格但資料庫沒有，一律引導到官網
2. 網址中的型號【必須】使用使用者提供的「原始型號」，不要改成系列名
3. 範例：
   - 問「S27BM50 價格」→ 回 https://www.samsung.com/tw/search/?searchvalue=S27BM50
   - 問「G80SD 價格」→ 回 https://www.samsung.com/tw/search/?searchvalue=G80SD
4. 嚴禁把 S27BM50 改成 M5 或 Smart Monitor
```

### 資料表分工原則 (重要)

| 資料表 | 維護方式 | 用途 | 格式 |
|--------|----------|------|------|
| **CLASS_RULES** | 後台直接編輯 | 型號規格、術語定義 | 關鍵字, 定義, 備註, 說明 |
| **QA** | LINE `/紀錄` | 使用者發掘的問答 | 問題, 答案 |

---

## Version 22.15.0 - Model Pattern Guide (型號模式識別)
**日期**: 2025/12/03
**類型**: 知識庫增強

### 問題背景
使用者詢問「S27BM50 多少錢」時，AI 無法識別這是 Smart Monitor M5 系列，直接回覆「沒資料找 Sam」。

**根本原因**：
- CLASS_RULES 的「別稱_M5」只定義了型號模式 `S27?M50*`
- AI 無法自動做正則匹配，看不懂 S27BM50 = M5 系列
- Prompt 規則 16 「用產品名搜尋」沒被觸發，先觸發了規則 1 「查無資料找 Sam」

### 解決方案
在 `syncGeminiKnowledgeBase` 產生的知識庫內容中，加入「型號模式識別指南」：

```
=== 🔤 型號模式識別指南 ===
【重要】三星螢幕型號有多種格式，以下是對照表：
* S27BM50x / S32BM50x = Smart Monitor M5 系列 (M50)
* S27CM50x / S32CM50x = Smart Monitor M5 系列 (M50)
* S27DM50x / S32DM50x = Smart Monitor M5 系列 (M50)
* S27BM70x / S32BM70x = Smart Monitor M7 系列 (M70)
* S27DG80x / S32DG80x = Odyssey OLED G8 系列 (G80SD/G81SF)
* S27DG60x = Odyssey OLED G6 系列 (G60SD)
* S27FG90x = Odyssey 3D G9 系列 (G90XF)
* S57CG95x = Odyssey G9 系列 (G95SC)
* S27C90x / S32C90x = ViewFinity S9 系列

【價格查詢原則】若使用者問價格但資料庫沒有，請用以下格式回覆：
「價格的部分因為可能會有變動，你可以到官網確認→ https://www.samsung.com/tw/search/?searchvalue=[型號]」
```

### 效果
- AI 現在能識別 S27BM50 是 M5 系列
- 問價格時會引導到官網搜尋，而不是說「找 Sam」

---

## Version 22.14.0 - Simplified QA Format (問題答案格式)
**日期**: 2025/12/03
**類型**: 格式簡化

### `/紀錄` 格式大幅簡化

**問題背景**：
v22.13.0 的格式「日期, 大分類, 小分類, 問題, 答案, Manual」過於複雜，分類欄位不必要。

**簡化方案**：
```
舊格式 (v22.13.0):
日期, 一、產品諮詢, 01.Smart Monitor, 問題, 答案, Manual

新格式 (v22.14.0):
問題, 答案
```

**範例**：
```
輸入：M50A M50B M50C有內建陀螺儀
輸出：M50有陀螺儀嗎/M50支援自動旋轉嗎, 僅M50A、M50B、M50C有內建陀螺儀支援自動旋轉，M50D和M50F沒有此功能
```

**優點**：
1. 移除不必要的分類欄位（分類由後台維護）
2. AI 只需專注於「問題」和「答案」兩個核心欄位
3. 問題欄位支援 `/` 分隔多種問法，增加搜尋命中率

### 資料表分工原則

| 資料表 | 維護方式 | 用途 | 格式 |
|--------|----------|------|------|
| **CLASS_RULES** | 後台直接編輯 | 型號規格、術語定義 | 關鍵字, 定義, 備註, 說明 |
| **QA** | LINE `/紀錄` | 使用者發掘的問答 | 問題, 答案 |

### 重要原則

1. **CLASS_RULES 不透過 LINE 編輯** - 這是後台直接維護的規格資料
2. **QA 透過 LINE `/紀錄` 新增** - 管理者新增客服問答
3. **LLM 在存檔前會格式化** - AI 潤飾成「問題, 答案」一行格式

---

## Version 22.13.0 - Record to QA (QA格式寫入)
**日期**: 2025/12/03
**類型**: 功能修正

### `/紀錄` 寫入目標改為 QA

**問題背景**：
v22.12.0 的 `/紀錄` 功能誤設為寫入 CLASS_RULES，但使用者期望寫入 QA。

**修正內容**：
1. `saveDraftToSheet()` 目標從 `CLASS_RULES` 改為 `QA`
2. `callGeminiToPolish()` 輸出格式改為 QA 格式
3. `callGeminiToModify()` 提示詞調整為 QA 格式
4. 預覽訊息調整為「將寫入 QA」

**新格式（QA 格式）**：
```
日期, 大分類, 小分類, 問題, 答案, Manual
```

**範例**：
```
輸入：M50A M50B M50C有內建陀螺儀
輸出：2025/12/3, 一、產品諮詢, 01.Smart Monitor, M50有陀螺儀嗎/M50支援自動旋轉嗎, 僅M50A、M50B、M50C有內建陀螺儀支援自動旋轉，M50D和M50F沒有此功能, Manual
```

**分類參考**：
- 01.Smart Monitor: M5/M7/M8/M9等智慧螢幕
- 02.Odyssey: G3/G5/G6/G7/G8/G9等電競螢幕
- 03.ViewFinity: S6/S7/S8/S9等商用螢幕
- 04.通用功能: 跨系列的通用問題

**與 CLASS_RULES 的差異**：
| 資料表 | 用途 | 格式 |
|--------|------|------|
| QA | 問答對（使用者發掘的問題） | 日期, 分類, 小分類, 問題, 答案, 來源 |
| CLASS_RULES | 規格定義（官方資料） | 關鍵字, 定義, 備註, 說明 |

---

## Version 22.12.0 - Simplified Draft (單欄寫入)
**日期**: 2025/12/03
**類型**: 架構簡化

### `/紀錄` 功能大幅簡化

**問題背景**：
原本的 `/紀錄` 功能使用 JSON 分欄設計（type/key/def/desc/q/a），容易導致：
1. AI 回傳 `undefined` 欄位
2. JSON 解析失敗
3. 過度複雜的驗證邏輯

**簡化方案**：
```
舊流程：
使用者輸入 → AI 解析為 JSON → 分欄驗證 → join 成字串 → 寫入 Sheet

新流程（v22.12.0）：
使用者輸入 → AI 潤飾成一句話 → 使用者確認 → 直接寫入 Sheet
```

**移除的函式**：
- `callGeminiToDraft()` - JSON 分欄解析
- `generatePreviewMsg()` - 複雜預覽生成
- `cleanJson()` - JSON 清理

**新增的函式**：
- `callGeminiToPolish(input)` - AI 潤飾成單行格式
- `callGeminiToModify(text, instruction)` - AI 修改現有文字

**新格式**：
```
關鍵字, 簡短定義, Manual, 詳細說明
```
例：`M50陀螺儀, M50A/M50B/M50C內建陀螺儀, Manual, Smart Monitor M50系列支援自動旋轉功能`

**優點**：
1. 簡單可靠，沒有 JSON 解析錯誤
2. 預覽即寫入內容，所見即所得
3. 減少 AI 出錯機會

---

## Version 22.11.0 - Price URL + Draft Validation
**日期**: 2025/12/03
**類型**: 功能修正 + 新功能

### 1. 價格查詢規則（Prompt 規則 16）

**問題背景**：
AI 回答了錯誤的價格資訊，包含過期的促銷價格和臆測價格。

**解決方案**：
- 新增 Prompt 規則 16【價格查詢規則】(嚴格執行)
- 禁止報價除非當前有活動促銷
- 強制回覆官網查詢連結

**標準回覆格式**：
```
價格的部分因為可能會有變動,你可以到官網確認→ [官網URL]
```

### 2. 官網 URL 自動生成 (`getProductUrl`)

**新函式**：
```javascript
getProductUrl(modelOrKeyword)
// G80SD → https://www.samsung.com/tw/search/?searchvalue=LS32DG802SCXZW
```

**運作邏輯**：
1. 若輸入已是 LS 編號 → 直接生成 URL
2. 否則查詢 KEYWORD_MAP 取得對應 LS 編號
3. 找不到則使用原始關鍵字作搜尋參數

### 3. `/紀錄` 功能強化

**問題背景**：
`callGeminiToDraft()` 有時回傳 `{"type":"rule", "key":"undefined", ...}` 導致寫入失敗。

**解決方案**：
1. `callGeminiToDraft()` 加入明確 JSON 範例和格式要求
2. `saveDraftToSheet()` 加入欄位驗證
   - 檢查 `!draft.key || draft.key === 'undefined'`
   - 回傳具體錯誤訊息而非通用「寫入失敗」

**錯誤訊息改進**：
```
❌ Rule 草稿不完整，缺少關鍵字(key)或定義(def)欄位。
請用修改指令補充，或 /取消 重新開始。
```

---

## Version 22.10.0 - Auto Trigger Recovery
**日期**: 2025/12/02
**類型**: 系統強化

### 觸發器自動恢復機制

**問題背景**：
47 小時同步排程可能因重新部署而遺失。

**解決方案**：
1. 新增 `ensureSyncTriggerExists()` 函式
2. 每則訊息處理時檢查（使用 6 小時快取避免頻繁檢查）
3. `doGet()` 支援健康檢查並自動建立觸發器
4. `deploy.bat` 自動執行初始化

---

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
