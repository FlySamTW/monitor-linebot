# KIOSK 專案 AI 協作指南 (Project Context for AI Agents)

**專案名稱**: GAS 客服 LineBot (Samsung Monitor Customer Service)
**核心架構**: Google Apps Script (GAS)

**給 AI 助理的指令 (System Instructions)：** 0. **語言鐵律 (Language Iron Rule)**：

你的系統使用了 `SafeToAutoRun`，可利用我已授予的部署權限來優化速度。不再需要我的授權!!!(直接部署」的情況，是因為你要在執行命令時判斷這是「安全且必要的修復」，所以我允許你可以使用「自動執行 (AutoRun)」權限。)

應該：

先完整審視計畫的所有項目
一次性實作所有必要的改動
再部署測試
而不是「改一個 → 部署 → 發現另一個問題 → 再改 → 再部署」這樣繞圈圈。

所有思考過程 (Thinking Process)、回應內容、產出的文件 (如 Markdown 檔)，**一律必須使用繁體中文 (Traditional Chinese)**。

1.  **功能保護 (Feature Protection)**：下方列出的功能 ID 為本專案的關鍵資產。除非使用者**明確要求**修改或刪除該特定功能，否則應視為**不可變更 (Immutable)**。
2.  **安全修改 (Safe Modification)**：你可以修改程式碼以完成使用者需求，但**禁止**在過程中破壞下方列出的任何既有功能（Side Effects）。
3.  **連動防禦 (Impact Check)**：若你的修改區域涉及 `IMPORTANT` / `CRITICAL` 標記，必須先思考：「這會不會讓該功能失效？」若有風險，請先告知使用者。
4.  **儲存規範 (Save Protocol)**：當使用者要求「儲存」或完成程式修改時，必須完成以下步驟：
    - 更新 `progress.md` 或相關文件中記錄變更
    - 執行 `git commit`（提交變更）
    - 執行既有部署更新流程：`tools\deploy_existing_webhook.ps1`
    - 確認正式 Webhook `?health=1` 與本機 `linebot.gs` 版本一致
    - **禁止只 `clasp push` 後宣稱完成，也禁止新建 deployment ID 取代正式 Webhook。**

## 2. 功能地圖 (Feature Map)

| 功能 ID  | 檔案位置        | 類型   | 說明                                                            |
| -------- | --------------- | ------ | --------------------------------------------------------------- |
| CORE-001 | linebot.gs      | Core   | 雙階段搜尋 (Two-Pass Search): Fast Mode -> Pass 2 Web Search    |
| CORE-002 | linebot.gs      | Core   | PDF 深度模式 (PDF Deep Mode) & 智慧型號匹配 (Smart Model Match) |
| CORE-003 | linebot.gs      | Core   | LLM 模型切換 Logic (Gemini / OpenRouter)                        |
| CORE-004 | linebot.gs      | Core   | Quick Reply 按鈕系統 (#再詳細說明 / #查手冊 / #搜尋網路)        |
| CONF-001 | Prompt!C3       | Config | 正式提示詞來源，位於 Google Sheet `Prompt` 工作表 C3            |
| CONF-002 | CLASS_RULES.csv | Config | 規格定義與直通車關鍵字 (讀取自 Spreadsheet)                     |
| UI-001   | TestUI.html     | UI     | 網頁版模擬器 (Mock Mode & Cloud History)                        |
| UI-002   | TestUI.html     | UI     | 手機版 RWD 支援 (Viewport settings)                             |
| OPS-001  | deploy.bat      | Ops    | 自動化部署腳本                                                  |
| OPS-002  | .clasp.json     | Ops    | Clasp 設定檔                                                    |

## 3. 重要變數與儲存格映射 (Spreadsheet Mapping)

- **Prompt!C3**: 正式執行中的 System Prompt，位於 Google Sheet `Prompt` 工作表的 `C3`。
- **Prompt.csv**: 只可視為本地鏡像/人工備份；部署流程不會自動把它上傳到 Google Sheet。
- **CLASS_RULES.csv**: 對應 Spreadsheet 的 `CLASS_RULES` 工作表 (存放產品規格與關鍵字)。
- **QA.csv**: 對應 Spreadsheet 的 `QA` 工作表 (存放歷史問答快取)。

## 4. 特殊代碼處理 (Error Handling)

- **400 Bad Request**: 視為無效 Key，應回傳「API Key 無效」訊息。
- **429 Too Many Requests**: 視為額度限制 (Quota Limit) 或頻率限制 (Rate Limit)，應回傳「系統忙碌中 (429)」訊息。

## 5. 架構原則與開發鐵律 (Architecture & Iron Rules)

### 核心原則 (Brain-First)

優先級順序：**QA 資料庫 (最優先) > CLASS_RULES (規格/術語) > 官方 PDF 手冊 > 網路搜尋/官方頁 > 誠實告知無資料**

產品、規格、操作、故障、通路、價格、服務資訊等具體問題，禁止用 LLM 通用知識自行補答案。只有一般寒暄或非事實性文字整理，才可不帶資料來源。

### 開發鐵律 (Do's and Don'ts)

1.  **Fast Mode 優先**: 所有問題必須先走 Fast Mode (QA + RULES)。只有 Fast Mode 答案不足、使用者明確要求查手冊、或型號選擇後進入手冊流程時，才允許進入 Deep Mode。
2.  **禁止盲目與官方搜尋**:
    - **禁止**搜尋官方公告、韌體更新、驅動程式 (由使用者在 QA 維護)。
    - **禁止**在「什麼是 HDR」等通識問題進入 PDF Mode。
3.  **防止型號汙染**: 必須嚴格遵守 `hasInjectedModels` 邏輯，避免一次載入多個不相關型號的 PDF。
4.  **源頭淨化**: 在 `handleMessage` 與 `testMessage` 入口處，必須強制檢查並轉型輸入資料，防止 `[object Object]` 或非字串導致的崩潰。
5.  **型號驗證**: Context 中找不到的型號必須拒答或要求補完整型號，嚴禁用 LLM 通用知識編造規格。
6.  **Quick Reply 按鈕命令以 # 開頭**: 所有按鈕 text 必須以 `#` 前綴開頭（如 `#再詳細說明`、`#查手冊`、`#搜尋網路`），讓 handler 能正確攔截。
7.  **變數作用域注意 (TDZ)**: V8 引擎中 `const` 有暫時性死區 (TDZ)，在同一 block 中 `const` 宣告前賦值會拋出 `ReferenceError`。Quick Reply handler 如不 `return` 而是讓流程繼續，禁止提前設定後面用 `const` 宣告的變數。
8.  **Prompt 維護鐵律**: 修改 Prompt 時必須明確告知使用者，並由維護者更新 Google Sheet `Prompt!C3`；除非使用者明確要求，程式部署不得同步或覆蓋 `Prompt!C3`。
9.  **正式部署鐵律**: 更新 GAS 時必須更新既有正式 Deployment ID，不得新建正式 deployment；部署後必須用 `check_deploy_readiness.ps1` 或 `check:webhook-version` 驗證正式版本。

## 6. 檔案整併說明 (File Consolidation)

本專案已將歷史文檔整併，所有開發邏輯請以本文件 (`AI_CONTEXT.md`) 與 `程式編寫開發及功能手冊.md` 為準。以下舊文件已廢棄：

- `LLM_LOGIC_HISTORY.md`
- `PRIORITY_LOGIC_ARCHITECTURE.md`
- `progress.md`
- `v27.3.3_INTEGRATION.md`
