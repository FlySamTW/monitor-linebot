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

## 2026-02-12 (Quick Reply 動態規則校正 + 文案修正)

### 背景
- 用戶指出兩個核心問題：
  1. 「搜網路」泡泡文案不自然，且容易誤解成「只能問新題」。
  2. Web 回合被硬編碼縮成 1 顆泡泡，與「同題可繼續查手冊/搜網路/再詳細」的設計衝突。

### 修復內容
- **文案調整**：統一為 `🌐 這題再搜網路`（指向同題延伸，不是開新題）。
- **指令相容**：新增 `#這題再搜網路`，同時保留 `#搜尋網路` / `#搜網上其他解答` / `#搜往上其他解答`。
- **Web 回合泡泡修復**：
  - 移除「Web 階段只留再詳細」的硬編碼。
  - 改為依條件動態顯示（再詳細次數、是否可查手冊、同題型號記憶）。
- **手冊入口保留**：
  - 在 `#這題再搜網路` 回合，若同題已有型號記憶 (`direct_search_models`)，仍保留「📖 查手冊」。
- **可觀測性**：
  - 新增日誌：`[Quick Reply v29.5.139] 這題再搜網路回合泡泡數: N`，避免「看起來像 1 顆」但無法追查。
- **測試防回歸**：
  - 新增 `test_runner/verify_web_qr_persistence.js`（檢查 Web 回合泡泡數）。
  - 更新 `test_runner/verify_17_points.js`：`userId` 改動態，避免舊快取污染導致誤判。

### 驗證結果
- `verify_web_qr_persistence`：PASS
- `verify_17_points`：PASS
- `verify_manual_continuity`：PASS
- 生產部署已更新至 `AKfycbz7... @824`。

---

## 當前狀態 (Current Status)
- **最後更新時間**: 2026-02-12
- **最後動作**: v29.5.139 完成 Quick Reply 文案與動態規則校正（Web 回合不再硬編碼 1 顆）
- **目前進度**: 17 點修復完成；同題泡泡行為與測試腳本已對齊
- **下一步 (Next Steps)**:
    - [ ] 觀察真實 LINE 流量下 `groundingMetadata` 穩定度（`webSearchQueries`/`groundingChunks`）
    - [ ] 補一支「泡泡矩陣快照」測試（QA/PDF/Web 三種來源 × 次數上限 × 有無型號）

## 2026-03-11 (v29.5.157 價格防呆修復)

### 背景
- **問題**: LINEBOT 在價格題（如 M9/G8 最低價、建議售價）會回覆具體數字，與既有策略不符。
- **用戶要求**: 不要直接報價；可導到三星官網查價頁。且避免把規格硬寫在程式碼。

### 修復內容
- **linebot.gs**
  - 版本更新為 `v29.5.157`。
  - 新增價格意圖防呆：偵測價格題後，直接回覆「不提供具體價格數字」並提供三星官網查價連結。
  - 防呆邏輯僅處理「價格行為」，未將任何產品規格硬編碼進程式。
- **Prompt.csv**
  - Prompt 版本更新為 `v29.5.157`。
  - 強化價格規則：嚴禁回覆任何具體價格數字（最低價/通路價/活動價/建議售價數字），一律導官網查價並以官網頁面為準。

### 驗證 (TestUI 真實測試)
- 測試腳本：`test_runner/verify_price_no_number.js`
- 測試結果：`3/3 PASS`
  - 案例 1：M9/G8/M8/S34BG850SC3 最低價與建議售價
  - 案例 2：G8 現在價格多少
  - 案例 3：M7 43 吋售價
- 驗證重點全部通過：
  - 有回覆
  - 有官網查價連結
  - 無金額數字報價
  - Log 命中 `[Price Guard v29.5.157]`

### 部署紀錄
- `clasp push -f`：成功
- `clasp version "v29.5.157 fix: 價格題禁止報價數字 + 官網查價防呆"`：成功（Version 839）
- `clasp deploy -i AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA`：成功（更新到 @840）

---

## 當前狀態 (Current Status)
- **最後更新時間**: 2026-03-11
- **最後動作**: 完成價格題防呆（禁止報價數字）與 Prompt 規則強化，並更新部署。
- **目前進度**: 生產環境已套用 v29.5.157，TestUI 價格題驗證通過。
- **下一步 (Next Steps)**:
    - [ ] 觀察實際 LINE 對話中的價格題是否維持不報價
    - [ ] 若要進一步收斂，追加「促銷/活動」題型的統一話術與驗證用例
## 2026-03-17 (v29.5.160 手冊流程一致性修復 + Prompt 強化)

### 背景
- 用戶回報 M7/M8/SmartThings/Matter 對話出現前後矛盾，且 #查手冊 來源標註出現不存在的手冊名稱（如「Smart Monitor M7 使用手冊」）。
- 用戶要求：回答規範優先寫在 Prompt（可回貼 GAS 儲存格），程式僅保留必要防呆。

### 修復內容
- **linebot.gs**
  - 版本更新為 `v29.5.160`。
  - `#查手冊` 路徑改為 `getRelevantKBFiles([searchMsg], ..., forceCurrentOnly=true)`，避免混入歷史型號污染。
  - `#查手冊` 呼叫 LLM 時改為只帶當前問題 `[userMsgObj]`，降低 M7/M8 串題污染機率。
  - 新增來源標註工具：
    - `buildPdfSourceLabelFromFiles()`
    - `appendPdfSourceTag()`
    - 來源改用「實際掛載 PDF 檔名」，避免虛構手冊名稱。
  - SmartThings/Matter/Hub/中樞/橋接 題型新增手冊查證防呆：若具手冊條件成立，追加 `[AUTO_SEARCH_PDF]`。
  - 新增 `sanitizeManualDeflection()`，手冊模式下移除「叫使用者自己查手冊/官網」甩鍋語句。
  - `getRelevantKBFiles()`：`forceCurrentOnly=true` 時跳過歷史/Cache 型號注入。

- **Prompt.csv**
  - Prompt 版本更新為 `v29.5.160`。
  - 新增「手冊回答硬規則」：
    - 手冊模式禁止甩鍋（自行查手冊/官網/客服）。
    - 手冊無直接證據時要明示「手冊未記載」並輸出 `[AUTO_SEARCH_WEB]`。
    - SmartThings/Matter/Hub 題優先手冊查證。
    - 來源名稱必須使用系統實際掛載手冊檔名，不可自創名稱。

### TestUI 驗證
- `test_runner/verify_manual_continuity.js`：PASS（部署後 v29.5.160）
- `test_runner/verify_m7_m8_matter.js`：PASS（部署後 v29.5.160）
  - 驗證點：
    - 命中 `forceCurrentOnly` 防污染
    - 回覆含真實 PDF 來源標註
    - 不再出現 `Smart Monitor M7 使用手冊` 類型虛構來源
    - 手冊模式不再甩鍋「自行查手冊/官網」

### 部署紀錄
- `clasp push -f`：成功
- `clasp version "v29.5.160 fix: manual deflection filter + smartthings guard"`：成功（Version 845）
- `clasp deploy -i AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA`：成功（更新到 @846）

## 2026-03-17 (v29.5.161 追問型號記憶條件修復)

### 修復內容
- linebot.gs
  - 版本更新為 v29.5.161。
  - 修正 isModelMismatch 的別稱條件：僅在 hitAliasKeys.length > 0 時才保留既有型號記憶，避免一般追問誤沿用舊型號。
- Prompt.csv
  - Prompt 版本更新為 v29.5.161。
  - 新增 SmartThings Hub 判定規則：手冊僅提到 Smart Hub 服務合約/SmartThings 功能時，不得推論為內建 Hub；需回覆「手冊未明確記載」並輸出 [AUTO_SEARCH_WEB]。

### 驗證
- node test_runner/verify_m7_m8_matter.js：PASS
- node test_runner/verify_manual_continuity.js：PASS
- node test_runner/verify_price_no_number.js：PASS
### 部署紀錄
- clasp push -f：成功
- clasp version "v29.5.161 fix: alias-memory guard + prompt/manual consistency"：成功（Version 847）
- clasp deploy -i AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA：成功（更新到 @848）
- git commit：99af3d5（main）
- git push origin main：成功

## 2026-03-17 (v29.5.162 SmartThings/Matter 路由與格式修復)

### 修復內容
- linebot.gs
  - SmartThings/Matter 高風險題觸發手冊查證時，不再先回 Fast Mode 文案再跳泡泡；改為先鎖定單一型號進手冊流程。
  - 新增 stripAnySourceTags()，移除 AI 臆測來源標籤（例如 [來源:QA資料庫]）。
  - 手冊路徑新增 enforceManualNumberedList()，將條列符號統一為數字項次並保留空行。
  - 手冊路徑來源統一以 appendPdfSourceTag() 標示實際掛載 PDF 檔名。

### 驗證
- node test_runner/verify_m7_exact_issue.js：PASS
  - 首回覆不再出現 [來源:QA資料庫]。
  - 不再觸發「準備顯示型號選擇泡泡」。
  - 手冊回覆來源為真實 PDF 檔名。

### 部署紀錄
- clasp version "v29.5.162 fix: smartthings router + source strip + manual numbering"：成功（Version 849）
- clasp deploy -i AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA：成功（更新到 @850）

## 2026-03-17 (v29.5.163 手冊暗號清理 + Prompt 防呆補強)

### 修復內容
- linebot.gs
  - 手冊路徑清理 [型號:...] 內部標籤，避免輸出到終端回覆。
- Prompt.csv
  - 版本升級為 Prompt v29.5.163。
  - 新增「來源與路由防呆」：未實際引用 QA 不得標註 [來源:QA]；SmartThings/Matter/Hub 題未手冊查證前不得先下結論。

### 部署紀錄
- clasp version "v29.5.163 fix: remove model-tag leakage in manual replies"：成功（Version 852）
- clasp deploy -i AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA -V 852：成功（更新到 @852）

## 2026-03-17 (v29.5.164 ~ v29.5.166 手冊甩鍋語句過濾強化)

### 修復內容
- linebot.gs
  - 擴充 `sanitizeManualDeflection()`：
    - 新增客服/專線/聯絡 Samsung 等甩鍋語句過濾。
    - 新增官方網站/支援頁面等導流語句過濾。
    - 擴充動詞詞彙（詢問/聯絡/聯繫/直接詢問/前往）以覆蓋更多變形句。

### 驗證
- node test_runner/verify_m7_exact_issue.js：PASS
  - 首輪不再錯標 [來源:QA]。
  - 不再跳型號選擇泡泡。
  - 手冊回覆維持實際 PDF 檔名來源標註。

### 部署紀錄
- clasp version "v29.5.164 fix: filter manual deflection to support hotline wording"：成功（Version 854）
- clasp version "v29.5.166 fix: manual deflection filter includes official-site/support-page wording"：成功（Version 859）
- clasp deploy -i AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA -V 859：成功（更新到 @859）

## 2026-03-18 (v29.5.171 SmartThings/Matter 回答收斂 + 雲端 PDF 查證)

### 修復內容
- `linebot.gs`
  - 版本更新為 `v29.5.171`。
  - SmartThings/Matter/Hub 題在手冊路徑加上統一後處理：
    - 強制「你」語氣（避免「您」）
    - 統一數字列表與空行
    - 移除手冊模式甩鍋語句
    - 回覆過長或破碎時收斂為三點結論
  - 補上 `ensurePdfSourceTag()`，確保手冊回答最終一定帶真實 PDF 檔名來源。
  - 在 Auto Deep / #查手冊 路徑補上 `pdf_consulted` 旗標，避免剛查完手冊又出現「再幫你查手冊」提示。
  - 新增 `verifySmartThingsClaimFromCloudPdf()`：
    - 直接從 Drive 雲端資料夾抓取 `S32FM702,S32FM703,S32FM803.pdf`
    - 上傳至 Gemini File API 後做頁碼/原文片段查證
    - 回傳可序列化查證結果（含 Drive fileId、最後更新時間、模型 JSON 結果）。

### 驗證
- `node test_runner/verify_m7_exact_issue.js`：PASS（部署後 v29.5.171）
  - 首輪不再回 QA 假來源
  - 不再先跳型號選擇泡泡
  - `#查手冊` 回覆符合數字項次+空行，且來源為真實 PDF 檔名
- TestUI 直接呼叫 `verifySmartThingsClaimFromCloudPdf()`：
  - Drive 檔案：`S32FM702,S32FM703,S32FM803.pdf`
  - Drive File ID：`19B6dTtgtcMQHZEy_J_C6sayNfS9w8QAG`
  - 模型查證結果：找到對應句意，但證據頁碼為 `page 16`（非「91-93」）
  - 證據片段：`此功能允許 Product 連接和控制在相同空間內偵測到的各種裝置。`

### 部署紀錄
- `clasp push -f`：成功
- `clasp version "v29.5.171 SmartThings修正與雲端PDF查證輸出序列化"`：成功（Version 874）
- `clasp deploy -i AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA`：成功（更新到 @875）

### CSV / GAS 同步提示
- 本次沒有修改 `CLASS_RULES.csv`、`QA.csv`、`Prompt.csv` 的內容。
- `Prompt` 雲端儲存格版本目前仍為 `v29.5.161`（與程式版號分離）。

## 2026-03-18 (v29.5.173 S9/KVM 別稱誤答修復 + Fast Mode 來源補回)

### 問題背景
- 用戶提問：`s9有內建kvm嗎`
- 系統在 Fast Mode 回覆「S9 支援 KVM」，且最終回覆沒有來源標註。
- 用戶指出疑點：
  - QA 無明確 S9=KVM 結論
  - 規格表應無該結論
  - 最終訊息缺來源標註

### 根因
- `S9` 是系列別稱，規格庫同時存在多個 S9 相關型號（含 `S49C950UAC` 條目帶 KVM），導致 LLM 用別型號資訊做肯定回答。
- Fast Mode 會先 `stripAnySourceTags()`，但後續沒有補回來源標籤。
- 既有別稱防呆未命中 `S9` 這種短別稱（`extractModelNumbers` 不抓單位數 S 系列別稱）。

### 修復內容
- `linebot.gs` 升級 `v29.5.173`。
- 新增 Fast Mode 來源標籤標準化與補回：
  - `normalizeSourceTagFromRaw()`
  - `appendSourceTagIfMissing()`
- 新增短別稱功能題防誤答：
  - `applyAliasFeatureAmbiguityGuard(...)`
  - 對 `S9/G8/M7` 這類短別稱 + 功能二元題（如 KVM/G-Sync/HDR/耳機孔）若回覆為肯定，改為要求完整型號後再答。
  - 防呆改為吃 Smart Router 已解析的型號快取，確保 `S9` 也能命中。

### 驗證
- TestUI 實測（userId: `TEST_S9_KVM_002`）：
  - 原始 AI 回覆仍可能先產生「S9 有 KVM」
  - 最終回覆已被防呆改寫為「請提供完整型號」
  - 並附上來源標籤 `[來源:規格庫]`

### 部署紀錄
- `clasp version "v29.5.173 fix short alias guard for feature queries"`：成功（Version 878）
- `clasp deploy -i AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA`：成功（更新到 @879）

## 2026-03-18 (v29.5.174 別稱歧義題改為型號條列選擇)

### 問題背景
- 用戶強調 SOP：若問題可能對應多個型號，必須先讓使用者選擇型號（條列或泡泡），不能直接回答規格結論。
- 針對 `s9有內建kvm嗎`，v29.5.173 雖已避免直接肯定，但僅要求補型號，仍未提供可選型號列表。

### 修復內容
- `linebot.gs` 升級為 `v29.5.174`。
- 在短別稱功能題防呆中新增候選型號條列：
  - 新增 `getAliasCandidatesFromClassRules(aliasToken)`，從 `CLASS_RULES` 提取該別稱可對應的完整型號。
  - `applyAliasFeatureAmbiguityGuard()` 改為優先輸出「候選完整型號條列」，再請用戶回覆其中一個型號。
- 保留來源標註：仍會附 `[來源:規格庫]`。

### 驗證
- TestUI 實測 `s9有內建kvm嗎`：
  - 回覆為別稱歧義提示 + 候選型號條列（例如 `S49C950UAC`、`S27C900PAC`）。
  - 不再直接回覆「S9 有 KVM」。
  - 來源標註存在：`[來源:規格庫]`。

### 部署紀錄
- `clasp version "v29.5.174 alias ambiguity list for feature queries"`：成功（Version 880）
- 因 GAS 版本數達上限，改用「更新既有部署版本」：
  - `clasp deploy -i AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA -V 880`
  - 成功（更新到 @880）

## 2026-03-18 (v29.5.175 短別稱改回泡泡SOP + #型號流程分流)

### 問題背景
- 用戶指出 v29.5.174 仍違反 SOP：
  - 多型號歧義時應優先顯示型號泡泡，而非讓使用者輸入數字條列。
  - `S49...` 與 `LS49...` 實為同機，前台應使用統一顯示名稱（以 `S...` 為主）。
  - 選型後若無手冊，不應硬進 PDF 流程再回「找不到手冊」。

### 修復內容
- `linebot.gs` 升級為 `v29.5.175`。
- 新增型號顯示正規化：
  - `normalizeModelForDisplay()`
  - `dedupDisplayModels()`
  - `getAliasCandidatesFromClassRules()` 改為優先提取 `S...` 完整型號，僅在必要時由 `LS...` 轉換為顯示型號。
- Smart Router 新增短別稱功能題強制泡泡：
  - `S9/G8/M7` 這類短別稱 + 功能二元問題時，改為「先選完整型號」並直接進 Flex 泡泡流程。
- 新增選型流程模式分流：
  - 泡泡新增 `model_select_mode`（`fast` / `pdf`）。
  - `#型號:...` 在 `fast` 模式下不再強制 Pass 1.5，改為回到一般 SOP（QA/RULE -> PDF -> WEB）。
  - `pdf` 模式維持既有手冊流程。
- 防呆調整：
  - `applyAliasFeatureAmbiguityGuard()` 改為簡短提醒，不再輸出可被誤解為「請輸入數字」的條列回覆。

### 驗證
- 程式語法檢查：`node -e "new Function(require('fs').readFileSync('linebot.gs','utf8'))"` 通過。
- 規則資料檢查（本地 `CLASS_RULES.csv`）：
  - `S9` 候選型號僅提取到 `S49C950UAC`、`S27C900PAC`（無 `LS...` 顯示）。
- 端到端 TestUI（現有正式 Webhook `@880`）仍會出現舊行為，因部署版本未更新到本次程式碼（見下方部署狀態）。

### 部署狀態
- `clasp push -f`：成功（已上傳最新程式碼到 HEAD）。
- `clasp version`：失敗（專案版本數已達 200 上限）。
- `clasp deploy -i ...`：無法更新既有正式 deployment（回覆 `Read-only deployments may not be modified.`）。
- 可建立新 deployment 指向舊版本（例如 `@880`），但無法產生新版本承載 `v29.5.175`。

## 2026-03-18 (v29.5.176 #型號後短別稱回圈修復)

### 問題背景
- `v29.5.175` 上線後，`s9有內建kvm嗎` 可觸發型號泡泡，但在選擇 `#型號:S27C900PAC` 後，仍可能被短別稱防呆再次攔截，出現「再請選型號」回圈。

### 修復內容
- `linebot.gs` 升級為 `v29.5.176`。
- 在 `#型號:` 的 `fast` 分流新增兩個防呆：
  1. 選型後重寫查詢字串時，移除原問題中的短別稱（如 `S9`），避免再次命中別稱防呆。
  2. 新增一次性旗標 `skipAliasFeatureGuard`，當輪 Fast Mode 跳過 `applyAliasFeatureAmbiguityGuard()`。

### 驗證
- TestUI `/重啟` 顯示版本：`v29.5.176`。
- 測試路徑：
  - 問 `s9有內建kvm嗎`：Router Log 顯示觸發型號泡泡候選 `S49C950UAC, S27C900PAC`（無 `LS...`）。
  - 選 `#型號:S27C900PAC`：最終回覆直接給 KVM 結論，且 `AttachPDFs:false`（符合 `fast` 分流）。
- 註：TestUI 內因 replyToken 為模擬值，Flex 發送 Log 會出現 `Invalid reply token`；此為測試環境限制，LINE 正式 webhook 會有有效 token。

### 部署紀錄
- `clasp version "v29.5.176 修復#型號後短別稱防呆回圈"`：成功（Version 883）
- `clasp deploy -i AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA`：成功（更新到 @884）

## 2026-03-18 (v29.5.177 SmartThings/Matter 單回合單次呼叫 + 主流程Log去重)

### 問題背景
- 用戶回報：同一題先有一個 Fast 回答（`AI Raw Response`），但 LINE 最終顯示的是後續 PDF 回答，導致：
  - 單題雙次 API 呼叫（成本翻倍）
  - 第一個回答被覆蓋，體感像「回答二次只顯示一次」
  - Log 列數膨脹

### 根因
- `v29.5.158` 對 SmartThings/Matter 題型會在同回合強制追加 `[AUTO_SEARCH_PDF]`，觸發第二次 LLM 呼叫覆蓋首答。

### 修復內容
- `linebot.gs` 升級為 `v29.5.177`。
- 移除同回合強制二次查詢：
  - SmartThings/Matter 題改為保留 Fast 回答，不再自動進 PDF。
  - 需要手冊時改由用戶顯式 `#查手冊` 觸發。
- 主流程 Log 去重：
  - `[Final Reply]` 改記摘要（字數/泡泡數），不再重複全量內容。
  - 移除主流程重複的 `[AI Reply]` 全文寫入，完整回覆由 `[Reply]` 單點記錄。

### 驗證
- TestUI 實測題目：
  - `客戶如果想用M7串聯其他的Matt 協議的裝置,是不是要購買smart thing hub`
- 結果：
  - `/重啟` 顯示版本 `v29.5.177`
  - `AI Stats` 僅 1 次
  - `AttachPDFs: true` 不再出現
  - 不再出現 `[Auto Deep]` 二次查詢
  - 最終 `[Reply]` 與首輪 `AI Raw Response` 同一路徑一致

### 部署紀錄
- `clasp version "v29.5.177 移除SmartThings同回合二次呼叫+主流程log去重"`：成功（Version 885）
- `clasp deploy -i AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA`：成功（更新到 @886）

## 2026-03-18 (v29.5.178 移除個案硬編碼，回歸 Prompt 驅動)

### 調整原則
- 不以單一案例在程式硬編碼規則，避免規則持續膨脹。
- 路由策略交由 `Prompt.csv` 管控，程式只保留通用機制。

### 程式碼修正
- 移除 SmartThings/Matter 專屬流程判斷（含專屬 leadText / 鎖型號分支 / 專屬路由旗標）。
- 移除 SmartThings 專屬後處理函式在主流程中的使用，回覆整形回到通用格式器。
- 保留「單回合單次呼叫」通用行為（不在同回合程式層強制二次查詢）。

### Prompt 修正（來源控制點）
- `Prompt.csv` 版本文字更新為 `Prompt v29.5.178`。
- 將「SmartThings Hub 判定規則」改為通用的「聯網中樞判定規則」描述。
- 將「SmartThings/Matter/Hub 題」改為「涉及聯網協議/中樞能力題目」的通用規則。

### 驗證
- `/重啟` 版本：`v29.5.178`
- 測試題（M7 + Matter + Hub）：
  - `AI Stats` 僅 1 次
  - `AttachPDFs: true` 不觸發
  - 無 `Auto Deep` 二次流程
  - 無 SmartThings 專屬程式分支 log

### 部署紀錄
- `clasp version "v29.5.178 移除個案硬編碼，改由Prompt規則控制"`：成功（Version 887）
- `clasp deploy -i AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA`：成功（更新到 @888）

## 2026-03-18 (v29.5.179 通用流程落地：QA/RULE -> PDF -> WEB)

### 目標
- 不用個案硬編碼，回歸專案通用 SOP：
  - 先 QA/RULE
  - 找不到或回答不足才進 PDF
  - PDF 不足再進 WEB

### 程式調整
- 新增通用操作題判斷函式：
  - `isOperationOrTroubleshootQuery(text)`
  - `isOperationAnswerInsufficient(text)`
- 在 Fast 回答後新增通用升級條件：
  - 只有「操作/故障題 + 有可用手冊 + Fast 回答不足」時，才自動補 `[AUTO_SEARCH_PDF]`
  - 不包含任何 SmartThings/Matter 專屬字串或分支
- 之前已移除的個案邏輯維持不回加。

### Prompt 調整
- `Prompt.csv` 已更新為 `Prompt v29.5.178`（維持通用描述，不做品牌個案硬規則）。

### 驗證摘要
- `M7 + Matter + Hub`：單回合單次呼叫（`AI Stats` 1 次），不再同回合二次覆蓋。
- 操作類 QA 題（例如 Odyssey 3D、M5 YouTube）：有完整步驟時維持 Fast，不誤升級。

### 部署
- `clasp version "v29.5.179 通用SOP操作題Fast不足自動進PDF"`：成功（Version 889）
- `clasp version "v29.5.179b 操作題不足判斷誤觸發修正"`：成功（Version 891）
- 正式 deployment 更新至 `@892`

## 2026-03-18 (v29.5.180 Log 精簡：減列數但保留可追溯)

### 目標
- 針對單題回覆過多的路由噪音 Log（尤其 `DirectDeep` / `KB Select`）減列數。
- 保留可追溯關鍵點（命中、選檔結果、最終回覆、AI 統計），不犧牲除錯能力。

### 程式調整
- 新增 Log 精簡設定快取：
  - `LOG_FILTER_STATE`（5 分鐘快取 Script Property）
  - Script Property：`LOG_COMPACT_ROUTING`（預設 `true`，可設 `false` 關閉）
- 新增 `refreshLogFilterConfig_()` 與 `shouldSkipNoisyRoutingLog_()`：
  - 保留：`[HandleMsg]`、`[AI Stats]`、`[AI Raw Response]`、`[Flow Decision]`、`[Final Reply]`、`[Reply]`、`[DirectDeep 命中]`、`[KB Select 最終命中]` 等關鍵節點
  - 壓縮：`DirectDeep 型號中間提取/去重細節`、`KB Select 中間決策與排序細節` 等重複噪音

### 備註
- 這次只做「列數精簡」，沒有改動 QA/RULE/PDF/WEB 的主流程判定邏輯。

## 2026-03-19 (v29.5.181 SOP 回歸修正：快取降級自癒 + 保守升級 PDF)

### 問題根因（整體）
- 發生 `QA Cache Miss` / `Spec Rules Cache Miss` 時，Fast Mode 仍可能直接定論，造成看起來像「直接跳資料庫」。
- `buildDynamicContext()` 中 `specRules` 雖有 Sheet fallback，但 SmartRetrieval 後段只讀 Spec Cache chunk，導致 fallback 被忽略。

### 程式修正（非個案硬編碼）
- 修復 Spec fallback 斷鏈：
  - SmartRetrieval 改為優先使用前段已載入的 `specRules`（含 Sheet fallback），不是只看 cache chunk。
- 新增上下文健康度記錄：
  - `CACHE_KEYS.CONTEXT_HEALTH_PREFIX`
  - `buildDynamicContext()` 會把 `qa/light/spec` 載入狀態寫入 cache（`degraded` 旗標）。
- 新增保守升級守門（通用 SOP）：
  - 當 `contextHealth.degraded=true` 且題型屬「操作/故障」或「規格能力判定」且有手冊可查時，自動補 `[AUTO_SEARCH_PDF]`。
- 回覆口吻清理：
  - 新增 `sanitizeLeadDatabasePhrase()`，移除「根據我的資料庫」起手語。

### Prompt 修正
- `Prompt.csv` 升級為 `Prompt v29.5.181`。
- 移除「回答開頭要說根據我的資料庫」傾向。
- 統一來源標籤規則為 `[來源:QA]/[來源:規格庫]/[來源:產品手冊]/[來源:網路搜尋]`，避免格式互相衝突。

## 2026-03-19 (v29.5.182 高風險能力題手冊查證守門)

### 目的
- 防止「聯網協議/中樞能力」這類高風險題目被 Fast Mode 的 QA 單點定論。

### 修正
- 新增 `isManualVerificationRequiredQuery()`（通用風險類別，非個案型號）。
- 主流程新增守門：
  - 若題目屬高風險能力題、型號有 PDF、且 Fast 回答來源看起來僅來自 QA，則自動追加 `[AUTO_SEARCH_PDF]`。
  - 讓流程回到 `QA/RULE → PDF → WEB` 的可驗證路徑。

## 2026-03-20 (v29.5.184 科技長文改為去廣告摘要模式)

### 目標
- 使用者貼上整篇科技網頁內容時，不走一般客服問答，而是執行：
  - 去除廣告/導購/訂閱/重複段落
  - 輸出【重點摘要】與【去廣告原文】

### 程式修正
- `handleMessage()` 長文入口改為 `ArticleClean` 模式：
  - 觸發條件：長文 + 非指令 + 科技訊號
  - 輸出格式：固定兩段（摘要 + 整理後原文）
  - 防呆：清除 `[AUTO_SEARCH_PDF]` / `[AUTO_SEARCH_WEB]` 內部標記，避免外洩
- 新增/使用輔助判斷：
  - `isLikelyPastedLongArticle()`
  - `hasTechSignals()`

### Prompt 同步
- `Prompt.csv` 增加 `長文貼文處理 v29.5.184` 規則說明。

## 2026-03-20 (v29.5.185 長文後 QA 題材判定與建檔引導)

### 目標
- 科技長文整理完成後，系統自動判斷：
  - 是否與本專案（三星螢幕/智慧家電）相關
  - 是否可作為 QA 題材
- 若符合，主動詢問是否進入 QA 編輯模式，並先列出完整操作指令。

### 程式修正
- 新增判定函式：
  - `isProjectRelevantLongContent()`
  - `isQACandidateLongContent()`
  - `isAffirmativeForQaEdit()` / `isNegativeForQaEdit()`
  - `buildQaEditInstructionText()`
- `ArticleClean` 回覆尾段新增 QA 引導：
  - 顯示「是否進入 QA 編輯模式」＋操作步驟與指令
  - 快取 `qa_offer_payload`（草稿種子）18 分鐘
- 新增一鍵進建檔流程：
  - 用戶回「要」會直接呼叫 `startNewEntryDraft()` 進入建檔草稿模式
  - 回「不要/先不要」會清除邀請快取

## 2026-03-20 (v29.5.186 QA 草稿模式優先權修正)

### 目標
- 避免使用者已進入 QA 草稿編輯時，輸入較長內容被 `ArticleClean` 長文機制誤攔截。

### 程式修正
- `handleMessage()` 調整執行順序：
  - 先讀取 `draftCache`
  - 若目前在建檔模式且非 `/` 指令，優先進 `handleDraftModification()`
  - 之後才進入 `ArticleClean` 長文判斷
- `qa_offer_payload` 入口加上防呆：
  - 若已有 `draftCache`，不再處理「回覆要進 QA 編輯」入口，避免重入與流程衝突。
- `Prompt.csv` 清理：
  - 版本抬升為 `Prompt v29.5.186`
  - 移除長文規則前方誤植的 `\n` 字元，避免貼回 Sheet 時出現異常字串。

### 效果
- QA 編輯模式下的修稿回覆穩定走草稿流程，不會被長文摘要流程打斷。

## 2026-03-20 (v29.5.187 長文模式移除舊總編回退)

### 目標
- 落實「科技長文一律走去廣告摘要+原文」設計，不再被舊版 `總編模式` Prompt 行為干擾。

### 程式修正
- `ArticleClean` 的 Prompt 載入改為：
  - 只讀 `prompts["長文去廣告摘要"]`
  - 若不存在，直接用程式內建 fallback（去廣告摘要模板）
  - 不再 fallback 到 `prompts["總編模式"]`

### 效果
- 非本專案科技長文也能維持標準輸出結構（摘要+原文），僅在 QA 候選判定階段決定是否追加 QA 編輯邀請。

## 2026-03-20 (v29.5.188 長文輸出硬規則強化)

### 問題
- 部分 Prompt 內容仍可能導致模型在「非三星長文」時只回一句「內容無關」，未輸出摘要與整理原文。

### 程式修正
- `ArticleClean` 組裝的 `articlePrompt` 新增硬規則：
  - 即使內容與三星無關，也必須完整輸出 `【重點摘要】` 與 `【去廣告原文】`
  - 禁止只回覆「內容無關」單句。

### 效果
- 長文處理輸出格式更穩定，不受既有 Prompt 歷史內容影響。

## 2026-03-20 (v29.5.189 長文格式保底器)

### 問題
- 即使已加硬規則，模型仍可能回傳非結構化單句（例：只回「內容無關」）。

### 程式修正
- 新增 `ensureArticleCleanOutputFormat(aiText, originalText)`：
  - 若 AI 回覆缺少 `【重點摘要】` 或 `【去廣告原文】`，自動套用本地保底重整。
- 新增 `buildHeuristicCleanArticleText()`：
  - 先去除常見廣告/導購行，再保留可讀原文。
- 新增 `buildHeuristicSummaryPoints()`：
  - 由清理後內容抽取 1~4 個重點句，組成數字清單。
- `ArticleClean` 主流程整合：
  - AI 回覆格式不符時，寫 log 並改用保底輸出。

### 效果
- 長文模式永遠會輸出兩段結構（摘要 + 去廣告原文），不再退化為單句回覆。

## 2026-03-20 (v29.5.190 專案相關判定去除通用詞誤判)

### 問題
- `isProjectRelevantLongContent()` 先前把通用詞（如「螢幕」）納入，導致非三星科技長文也可能被誤判為本專案相關，進而錯誤觸發 QA 編輯邀請。

### 程式修正
- 重寫 `isProjectRelevantLongContent()` 判定邏輯：
  - 以「三星品牌訊號、三星系列訊號、型號碼、SmartThings/Matter 的三星脈絡」為主。
  - 移除單靠通用品類詞就判定相關的規則。

### 效果
- 非三星文章可維持長文清理輸出，但不會再誤觸 QA 題材邀請。

## 2026-03-20 (v29.5.191 高風險聯網中樞題強制手冊查證)

### 問題
- M7 / Matter / SmartThings Hub 類問題在 Fast Mode 仍可能直接採用規格庫強結論，沒有升級到 PDF，造成錯答外送。

### 程式修正
- 將高風險題升級條件由「僅 QA 來源才升級」改為：
  - 只要命中 `isManualVerificationRequiredQuery()`（Matter / Thread / Zigbee / Hub / 中樞 / 協議）
  - 且該型號有 PDF，可用時就一律追加 `[AUTO_SEARCH_PDF]`。
- 為避免多型號泡泡打斷流程：
  - 追加 `[AUTO_SEARCH_PDF]` 時同步鎖定 `primaryModel` 到 `direct_search_models`。
  - Smart Router 偵測到此強制升級時，略過多型號泡泡，直接用已鎖定型號進 Pass 1.5。

### 效果
- 高風險聯網能力題不再停留在 Fast 強結論，會先走手冊查證再回覆。

## 2026-03-20 (v29.5.192 還原鐵律：多型號先選型號)

### 問題
- v29.5.191 為了避免錯答，對高風險題做了單型號鎖定，與既有鐵律衝突：
  - 若問題對應多個型號，應先讓使用者選型號，再進 PDF 查證。

### 程式修正
- 移除高風險題自動覆寫 `direct_search_models=[primaryModel]` 的邏輯。
- 新增 `forcedManualNeedsModelSelection`：
  - 高風險題且 `suggestedModels.length > 1` 時，強制顯示型號泡泡。
  - 不再自動鎖單一型號。
- 即使存在列表意圖/數量過多，若為上述高風險多型號場景也不可跳過泡泡。

### 效果
- 重新符合手冊鐵律：
  - 多型號高風險題 → 先選型號 → 再手冊查證。

## 2026-03-20 (v29.5.193 鐵律SOP文字與路由一致化)

### 問題
- Prompt 內仍有「QA命中時禁止輸出 [AUTO_SEARCH_PDF]」舊規則，與實際鐵律SOP衝突。

### 修正
- `Prompt.csv` 升級為 `Prompt v29.5.193`：
  - QA優先條款改為：產品規格/能力/操作流程題，QA回答後仍須進 PDF 查證。
  - 新增「鐵律SOP」條款：QA或規格庫→官方手冊→不足再外部資料；多型號先選型號。
- `linebot.gs` 路由文字同步：
  - 改為「SOP鐵律查證」命名，不再用「高風險」作為核心判斷描述。

## 2026-03-20 (v29.5.194 手冊不確定結論防呆)

### 問題
- PDF 回答偶爾同時出現「手冊未明確」與「因此不需額外 Hub」的自我矛盾敘述。

### 程式修正
- 新增 `enforceManualUncertaintyGuard(text, queryText)`：
  - 若題目屬協議/中樞能力判定，且回覆同時含「未明確」與「直接定論」訊號，改寫為保守結論。
- 套用範圍：
  - `#型號:` 查手冊流程
  - `#查手冊` 流程
  - 自動 AutoDeep / Pass1.5 的 PDF 回覆流程

### 效果
- 減少「手冊未明確但又下肯定結論」的矛盾回答。
