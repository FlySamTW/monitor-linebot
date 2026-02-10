# 開發對話紀錄

## 2026-01-19

### 建立對話記錄機制
- **用戶需求**: 詢問如何才能每次都記錄開發對話。
- **分析**: 在目前的 CLI 環境中，最可靠的方式是將對話重點與決策寫入本地文件。
- **解決方案**: 建立此 `DEVELOPMENT_LOG.md` 檔案。
- **執行方式**:
    - 在每個重要討論段落結束，或完成特定任務後，由 Agent (我) 主動更新此檔案。
    - 記錄內容包含：日期、主題、用戶需求、關鍵決策、已完成的變更。

### 狀態追蹤機制 (新增)
- **目的**: 應對用戶誤按 Ctrl+C 導致的中斷，確保下次啟動能接續進度。
- **作法**: 在檔案末尾維護一個 `## 當前狀態 (Current Status)` 區塊，記錄「最後動作」與「下一步計畫」。

---

## 當前狀態 (Current Status)
- **最後更新時間**: 2026-01-19
- **最後動作**: 建立開發紀錄檔與狀態追蹤機制。
- **目前進度**: 基礎建設完成，等待用戶指派新任務。
- **下一步 (Next Steps)**: 
    - [x] 等待用戶指令

---

## 2026-01-19 (Gemini API 錯誤修復專案)

### 1. 問題遭遇與分析
- **事件**: 使用者回報在查詢型號 `S27AG500NC` 與 `G5` 時，API 頻繁失敗。
- **錯誤訊息**: `No candidates or content parts in response`。
- **初步診斷**: 
    - 系統觸發 PDF 深度搜尋，載入了 2 份大檔 (PDF)。
    - Token 用量暴增至 49,164 (Gemini 2.0 Flash 上限雖高，但在 GAS 環境下可能超時或觸發 API 內部限制)。
    - Log 顯示系統嘗試重試 3 次，雖然第一次重試成功移除了第 2 份 PDF，但剩餘的一份 PDF (約 3.7 萬 Token) 仍然導致 API 拒絕回應。
    - 此外，型號鎖定邏輯存在漏洞，反向別稱查找 (Reverse Alias Lookup) 導致原本鎖定的 `S27AG500NC` 又被擴充回 `G5` 系列，造成多餘檔案載入。

### 2. 解決方案規劃 (v29.5.46)
經過 Log 分析，制定了「兩道防線」策略：

#### A. 源頭減量 (getRelevantKBFiles)
- **策略**: 針對非比較題 (`!isComparison`)，強制限制 `MAX_TIER1_COUNT = 1`。
- **目的**: 杜絕因型號擴充導致的無謂檔案載入，直接將 Token 減半 (4.9萬 -> 2.5萬)，提高首發成功率。

#### B. 終極降級 (Ultimate Fallback in callLLMWithRetry)
- **策略**: 在 API 最後一次重試 (`retryCount === 2`) 且仍失敗時，啟動核彈級降級。
- **實作**:
    - 強制移除 Payload 中**所有**的 `file_data` 與 `inline_data` (圖片/PDF)。
    - 注入系統提示：`(系統自動降級：因參考文件過大導致讀取失敗，已切換為無文件模式...)`。
    - 移除所有 Tools。
- **目的**: 確保系統「死不了」。即使 PDF 完全讀不到，也能用內建知識庫 (QA/Rules) 回答，而非報錯。

### 3. 執行結果
- **狀態**: 已確認程式碼 (`linebot.gs`) 中正確實作了上述 v29.5.46 邏輯。
- **交付**: 已提供給協作 AI 完整的繁體中文修改建議指令。
- **驗證**: Log 顯示重啟後版本號已更新為 v29.5.46。

---

## 當前狀態 (Current Status)
- **最後更新時間**: 2026-02-09
- **最後動作**: v29.5.129 修復 Quick Reply 系列 bug（TDZ、按鈕邏輯、來源標註、型號驗證）
- **目前進度**: Quick Reply 三按鈕系統穩定，已部署至生產環境
- **下一步 (Next Steps)**: 
    - [ ] 觀察「再詳細說明」按鈕在實際使用中 AI 是否能正確依賴歷史上下文展開回答
    - [ ] 確認不存在型號的查詢是否被正確攔截（Prompt 層型號驗證）

---

## 2026-02-09 (Quick Reply 系統全面修復)

### 背景
用戶反覆測試 Quick Reply 按鈕，發現多個連鎖 bug。從 v29.5.123 到 v29.5.129，共經歷 7 個版本的修復。

### v29.5.123 - 查手冊按鈕條件顯示
- **問題**: 「查PDF手冊」按鈕在沒有 PDF 的型號也顯示，造成用戶期望落空
- **修復**: 在 DirectDeep 階段預載 PDF_MODEL_INDEX，設置 `hasPdfForModel` flag，條件控制按鈕是否出現
- **核心邏輯**: DirectDeep 命中 → 檢查 PDF_MODEL_INDEX → 有 PDF 才顯示「📖 查PDF手冊」按鈕

### v29.5.124 - Quick Reply 按鈕標籤優化
- **問題**: 按鈕標籤太長，不直覺
- **修復**: 統一為三個按鈕：`💬 再詳細說明`、`📖 查PDF手冊`、`🌐 網路搜尋`
- **教訓**: 版本號未同步更新導致 LINE 端無反應，追加修正

### v29.5.125 - #繼續問 缺少 # 前綴
- **問題**: 用戶按「繼續問」按鈕，LINE 將文字當一般訊息處理，未進入命令 handler
- **修復**: 按鈕 text 加上 `#` 前綴（`#繼續問`）

### v29.5.126 - 不存在型號的幻覺回答
- **問題**: 用戶輸入 `S32FD812`（不存在型號），AI 仍編造完整規格回答
- **根因分析（四層失敗）**:
  1. DirectDeep 匹配到關鍵字（`FD` 系列）但不驗證型號是否存在
  2. KEYWORD_MAP 擴展到真實型號，AI 以為找到了
  3. System Hint 強制 AI 觸發 `[AUTO_SEARCH_PDF]`
  4. Prompt 缺乏「型號不存在時應拒答」的規則
- **修復**: 在 Prompt.csv 新增【型號驗證】規則：「Context 中完全找不到的型號，必須先告知資料庫無此型號，嚴禁用 LLM 通用知識編造規格」
- **設計決策**: 用 Prompt 層而非硬編碼解決，因為型號列表會動態變化

### v29.5.127 - 四項修復
1. **「繼續問」重新命名為「再詳細說明」**: 語意更精確，handler 從 `#繼續問` 改為 `#再詳細說明`
2. **查手冊觸發時機文件化**: 只在 `hasPdfForModel = true` 時顯示
3. **查手冊等待提示**: 加入「📖 正在查閱手冊，約需 30 秒」loading 提示
4. **來源標註去重**: Web 搜尋結果同時被 LLM 和程式碼加上 `[來源: 網路搜尋]`，修復為先 regex 移除 LLM 的再由程式碼統一加上

### v29.5.128 - #再詳細說明 handler 簡化（有 bug）
- **問題**: 原 handler 從歷史中提取 AI 最後回答並截取前 200 字，造成上下文遺失
- **用戶指出**: 系統已保留 5 輪對話歷史，AI 本來就看得到完整上下文，不需要手動提取
- **修復**: 簡化為只改寫 `msg` 和 `userMessage`，讓正常流程帶歷史呼叫 LLM
- **⚠️ 留下 TDZ bug**: handler 中設置了 `userMsgObj = {...}`，但 `const userMsgObj` 在後面才宣告

### v29.5.129 - TDZ ReferenceError 修復 ⭐
- **問題**: v29.5.128 的 `#再詳細說明` handler 中 `userMsgObj = { role: "user", content: continueMsg }` 在 `const userMsgObj` 宣告前賦值，V8 引擎的暫時性死區 (TDZ) 會拋出 `ReferenceError`
- **根因**: `const` 是 block-scoped，handler 和 `const userMsgObj` 在同一個 `try {}` block 中（第 4831 行起），TDZ 從 block 開始到 `const` 宣告行為止
- **修復**: 移除 handler 中多餘的 `userMsgObj = {...}` 行。因為：
  - handler 已改寫 `msg = continueMsg` ✅
  - 後面第 5500 行 `const userMsgObj = { role: "user", content: msg }` 會自動基於改寫後的 `msg` 建構 ✅
  - `getHistoryFromCacheOrSheet(contextId)` 在第 5499 行載入完整 5 輪歷史 ✅
  - `callLLMWithRetry(userMessage, [...history, userMsgObj], ...)` 帶著完整歷史呼叫 LLM ✅
- **教訓**: 修改代碼前必須追蹤完整的變數作用域和生命週期，不能「順著用戶的話改」而不驗證

### `#再詳細說明` 完整流程（驗證後的正確理解）

```
用戶按「再詳細說明」按鈕
  ↓
LINE 發送 #再詳細說明
  ↓
handleMessage() 收到 msg = "#再詳細說明"
  ↓
if (msg === "#再詳細說明") handler:
  - msg = "請針對你剛才的回答再詳細說明..."
  - userMessage = 同上
  - 不 return（繼續走一般對話流程）
  ↓
D. 一般對話:
  - history = getHistoryFromCacheOrSheet(contextId) ← 載入 5 輪歷史
  - const userMsgObj = { role: "user", content: msg } ← 基於改寫後的 msg
  ↓
E. 直通車檢查 → 不會命中（msg 已不是型號關鍵字）
  ↓
callLLMWithRetry(userMessage, [...history, userMsgObj], ...)
  - history 包含之前的問答（含 AI 上次的完整回答）
  - userMsgObj 是「請再詳細說明」指令
  - AI 看到完整上下文，自然知道要展開什麼
```

### Quick Reply 按鈕完整架構（截至 v29.5.129）

| 按鈕 | text | 觸發條件 | 處理方式 |
|------|------|----------|----------|
| 💬 再詳細說明 | `#再詳細說明` | 永遠顯示 | 改寫 msg 後走正常流程，帶完整對話歷史 |
| 📖 查PDF手冊 | `#查手冊` | `hasPdfForModel = true` | 獨立 handler，從歷史找原始問題，呼叫 getRelevantKBFiles + callLLMWithRetry |
| 🌐 網路搜尋 | `#搜尋網路` | 永遠顯示 | 呼叫 handleCommand("不滿意...") 觸發 Web Search |

---

## 2026-02-10 (TestUI 可靠性 + PDF→WEB 升級邏輯修復)

### 背景
用戶要求用 `TestUI.html` 或其他方式驗證整體流程「自洽」，確保實際 LINE 問答不會出錯。

### 問題與根因
- **TestUI 按下 `#搜尋網路` 出現「(無回覆)」**
  - **根因**：TestUI 走 `google.script.run.testMessage()`，而 `replyMessage()` 在 TEST MODE 會直接 `return` 不呼叫 LINE API，也沒有把回覆內容寫入 `TEST_LOGS`，導致 `testMessage()` 收集不到回覆。
- **`#再詳細說明` 在某些情境會把 `[AUTO_SEARCH_PDF]` 等暗號外洩到最終回覆**
  - **根因**：LLM 在「延伸說明」問題偶爾仍輸出暗號；程式在「PDF 已查過 → 升級 Web」路徑上，存在 flow decision 的先後順序問題，可能導致不會真的跑 Web Search，甚至讓暗號留在 `replyText`。
- **`pdf_consulted` key 不一致**
  - **根因**：主流程使用 `${userId}:pdf_consulted`；`handleCommand()` 使用 `pdf_consulted_${u}`，造成 Quick Reply 的「網路搜尋」可能誤判「尚未查過 PDF」而重跑 Pass 1.5（PDF）。

### 修復內容 (v29.5.130)
- **TestUI 回覆捕捉**：`replyMessage()` 在 TEST MODE 會額外寫入 `[Reply] ...` 到 log，讓 `testMessage()` 能穩定收集回覆。
- **PDF→WEB 升級流程修復**：Flow decision 改為先處理 `[AUTO_SEARCH_WEB]`，避免被 `hasExplicitTrigger` 先攔住；同時加強 Pass 1 bubble 清理，移除 `[AUTO_SEARCH_*]`、`[NEED_DOC]`、`[型號:...]` 等標記避免外洩。
- **強化 `#再詳細說明`**：在改寫的 msg 中加入 `System Hint`，降低 LLM 觸發暗號的機率。
- **統一 `pdf_consulted` flags**：主流程在寫入 `${userId}:pdf_consulted` 時同步寫入 `pdf_consulted_${userId}`；`handleCommand()` 讀取時接受兩種 key，且在 PDF pass 也同步寫回主流程 key。
- **測試工具更新**：更新 `test_runner/verify_linebot.js` 的 `TEST_URL` 至目前生產部署。

### 驗證結果
- TestUI 端實測流程：
  - `/重啟` 顯示版本 `v29.5.130`
  - `M8有視訊鏡頭嗎` 正常回覆
  - `#再詳細說明` 正常展開、無暗號外洩
  - `#搜尋網路` 正常回覆（且不再誤走 PDF Pass 1.5）

---

## 當前狀態 (Current Status)
- **最後更新時間**: 2026-02-10
- **最後動作**: v29.5.130 修復 TestUI 回覆捕捉、PDF→WEB 升級流程、`pdf_consulted` key 對齊，並強化 `#再詳細說明`
- **目前進度**: TestUI 測試可穩定重現 LINE 主流程，Quick Reply 主要路徑已驗證
- **下一步 (Next Steps)**:
    - [ ] 追加測試「型號選擇泡泡 → #型號:xxx → PDF 查詢」完整鏈
    - [ ] 觀察實際 LINE 端「網路搜尋」是否能穩定取得 groundingMetadata（避免 `webSearchQueries` 為空）
