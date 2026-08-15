# Samsung LINE Bot 專案 AI 協作指南 (Project Context for AI Agents)

## v29.6.127 三來源路由、PDF 成本、自癒與證據不可破壞契約

- RULE 事實守門：完整型號的 `CLASS_RULES` 若明載 `Tizen` 與藍牙版本，Fast 模型不得回答「沒有內建藍牙」或「不支援藍牙」。純規格題直接用 RULE 回答；藍牙耳機的選單／配對操作題要在最終可見提示保留 RULE 肯定事實與已選型號，再建議使用者授權查官方手冊，禁止被後段模板洗掉。
- 手冊證據標記：模型輸出 `範圍:型號共通` 時正規化為既有契約的 `全檔共通`；若同一回覆已有有效第 N 頁，不得再追加「未取得可核對頁碼」，內部標記不得外洩。

- 藍牙耳機／喇叭操作題在 PDF 階段必須擴查手冊正式標題與選單同義詞（音效輸出、藍牙揚聲器清單、Bluetooth Speaker List、掃描、配對），不得因使用者用語不同就誤回「手冊未記載」。

- 生產模型仍固定 `models/gemini-2.5-flash-lite`；2026-08-15 官方 Standard 價格為 input US$0.10/M、output US$0.40/M，比 Gemini 3.5 Flash-Lite 的 US$0.30/M、US$2.50/M 便宜，不得因版本號較新直接升級。
- PDF 先以官方 `countTokens` 精算同一 payload，單次硬上限 NT$0.35；生成後以 `usageMetadata` 記實際費用。TestUI 不得再顯示舊的「約 NT$1.5」。
- `countTokens` 暫時錯誤、PDF 429／5xx、異常空答只受控重試一次；403／404 先單檔重傳再試。每日 04:00 強制重傳仍存在，失敗本數必須正確計數並排程背景重試。
- `/重啟` 只清使用者對話狀態；一般 PDF 過期、上傳失敗與同步不需要人工 `/重啟`。

- 「直接問」20 題只計規格／FAQ 實質回答；手冊與網路使用各自額度，不得雙重計次。
- 一般回答若只產生手冊授權引導，必須退回該次一般提問額度。
- 一般流程已鎖定的完整型號必須寫入上一題狀態；「查上一題」或正規化後完全相同的同題重打可沿用，內容不同的新題不得借用舊型號。手冊、網路、再手冊跨來源都不得洗掉型號。
- 常駐 Rich Menu 維持三格；只有準備沿用已知型號時，才顯示情境 Quick Reply「換型號」。換型號保留原問題、零計次、零來源呼叫。

- Rich Menu 與 TestUI 三格使用雙排超大字：第一排 `直接問`／`查手冊`／`搜網路`，第二排 `20題/日`／`5次/日`／`10次/日`。禁止縮回單行小字或塞入長句。

- `G8` 是 `CLASS_RULES` 已定義的 Odyssey 系列別稱。系列別稱遇到型號相關功能／操作／手冊題時，先從 RULE 列完整型號按鈕；只有涵蓋相同別稱的精準 QA 可直接回答，禁止泛用 Smart／其他型號資料搶答。選定完整型號後不得再次進入選型迴圈。
- 手冊 `countTokens` 的 20K 是成本警戒而非拒絕線；先刪除無關歷史，只保留本輪完整問題。100K 與單次最壞 NT$0.35 為雙重硬上限；超限先用 `MEDIA_RESOLUTION_LOW` 重算，仍超標才停止且不扣次。
- 免費 QA／RULE 預檢未命中後，PDF 生成階段只能載入官方手冊，不得再混入 QA、RULE、Prompt!C3 或網路。型號規格結論必須附 PDF 頁碼與「型號明確／全檔共通」證據範圍；「依型號而定」不能當肯定證據。

- 手冊 URI 過期時，只更新本題實際選中的 1～2 份 PDF 並重跑 token 預檢；成功後才送出生成請求與扣除手冊額度。單檔更新仍失敗才使用既有背景整庫重建，禁止因一份手冊過期就先同步全部 PDF。

- 正式 TestUI 真人提問驗收新增守門：完整型號操作題不得誤判為缺型號，必須只推薦「官方手冊」，且按鍵前不得讀 PDF 或扣次。
- 只有點「查上一題」才可沿用上一題；使用者直接輸入文字一律視為新題，不得借用上一題型號。手冊新題可輸入系列別稱或型號前段；多個候選時必須顯示可點選型號，完全沒有型號線索才追問，以上均零扣次。
- 使用者雖選官方手冊，仍須先做高信心 QA／CLASS_RULES 預檢；本機答案足夠時直接回答，零 PDF、零手冊扣點。只有不足時才進已授權 PDF。
- 實驗期每位 LINE 使用者每天 20 次有效提問；來源 postback、取消、補型號與型號選擇不重複計次。群組內仍按 userId 個別計算。
- LINE 客戶版只顯示 `本次約 NT$...｜今日提問剩餘 N/20`；token、paidCalls 與詳細成本仍只留 Request Audit／TestUI Logs。
- 每人 20 題使用短 UserLock，不得與 PDF 索引同步共用 ScriptLock；鎖忙碌時 fail closed，必須零計次、零供應商呼叫並顯示友善重試訊息。

- 一般訊息永遠先走 `規格＆FAQ`；精準 QA、CLASS_RULES 與人工驗證片段優先回答，但實驗期間每位使用者每天最多送出 20 題。
- `官方手冊` 與 `網路解答` 只能由本輪 Rich Menu postback 或相容舊指令建立一次性 pending 授權，10 分鐘有效，查完、失敗或取消後回到規格＆FAQ。
- 每聊天室每日（Asia/Taipei）手冊 5 次、網路 10 次；只有 token／檔案等預檢通過、第一個生成請求送出前才原子扣次。
- `[AUTO_SEARCH_PDF]`／`[AUTO_SEARCH_WEB]` 只能轉成來源建議，禁止自動執行或同一訊息跨來源。
- 手冊模式不得開 `google_search`，網路模式不得掛 PDF。任何新增的 PDF／Web 呼叫都必須通過 `assertAdvancedSourceGrant_()`。
- 正式 Rich Menu 資產在 `docs/rich_menu/`；業主於 2026-08-14 明確改為直接設定全體 default，不再使用 `ADMIN_USER_ID` pilot。發布必須保存舊 default ID、讀回新 ID，並保留 rollback 工具。
- Rich Menu 必須 `selected: true`；資訊層級是「①直接問問題 → 回答不足才②手冊重查／需要現況才③網路重查」，不得再呈現成三個平行來源。
- 左鍵明確用 `inputOption: openKeyboard` 讓新客直接輸入；中、右鍵用 `openRichMenu` 保持查證選單展開。LINE 鍵盤出現時會依平台限制暫時取代選單，收起鍵盤即可回到已綁定的 Rich Menu。

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
| CORE-001 | linebot.gs      | Core   | 漸進式路由：QA／RULE → 詢問 PDF → 同意後 PDF → 詢問 Web        |
| CORE-002 | linebot.gs      | Core   | PDF 單次授權與智慧型號匹配                                     |
| CORE-003 | linebot.gs      | Core   | LLM 模型切換 Logic (Gemini / OpenRouter)                        |
| CORE-004 | linebot.gs      | Core   | Quick Reply 按鈕系統 (#再詳細說明 / #查手冊 / #搜尋網路)        |
| CONF-001 | Prompt!C3       | Config | 正式提示詞來源，位於 Google Sheet `Prompt` 工作表 C3            |
| CONF-002 | CLASS_RULES.csv | Config | 規格定義與直通車關鍵字 (讀取自 Spreadsheet)                     |
| UI-001   | TestUI.html     | UI     | 網頁版模擬器 (Mock Mode & Cloud History)                        |
| UI-002   | TestUI.html     | UI     | 手機版 RWD 支援 (Viewport settings)                             |
| OPS-001  | deploy.bat      | Ops    | 自動化部署腳本                                                  |
| OPS-003  | tools/release_existing_webhook.ps1 | Ops | 發布總控：守門測試、GAS 上傳、既有 Webhook 更新、正式版本驗證 |
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
10. **發布總控鐵律**: 若要完成一輪正式發布，優先使用 `tools\release_existing_webhook.ps1`；它會先跑靜態守門，再呼叫既有部署更新流程，最後驗證正式 Webhook 版本。此流程不得同步或覆蓋 Google Sheet `Prompt!C3`。

## 6. 檔案整併說明 (File Consolidation)

本專案已將歷史文檔整併，所有開發邏輯請以本文件 (`AI_CONTEXT.md`) 與 `程式編寫開發及功能手冊.md` 為準。以下舊文件已廢棄：

- `LLM_LOGIC_HISTORY.md`
- `PRIORITY_LOGIC_ARCHITECTURE.md`
- `progress.md`
- `v27.3.3_INTEGRATION.md`
