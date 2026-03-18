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
