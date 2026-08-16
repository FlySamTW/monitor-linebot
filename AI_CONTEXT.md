# Samsung LINE Bot 專案 AI 協作指南 (Project Context for AI Agents)

## v29.6.159 Prompt 與模型呼叫契約

- Fast、PDF、Web 只取得各自必要提示；路由、授權、額度與來源標籤由程式守門，不重複塞入 Prompt。
- 特定產品事實（含 iPhone Air／iPhone 17）放在 `QA.csv`，不得放進通用 Prompt。
- 溫度為 Fast 0.3、PDF 0.2、Web 0.15；不增加第二次潤飾模型呼叫。

## v29.6.158 回答鏈與一次性補充契約

- 系列別稱只產生候選，不得把候選第一款寫入已確認型號。型號特定規格只能用該完整型號自己的 RULE；未明載等於 UNKNOWN，不可讓 Fast 猜測，直接建議手冊並退回一般額度。
- 規格欄位可由精確 RULE 回答時必須 terminal return：不建 history／Top-K／Fast prompt，`LLM=0`、PDF=0、Web=0。
- 「再詳細說明」是一次性 control action：保留 active question 與 confirmed model，不扣 20 題，使用後不再顯示；重點是友善表達，不得改寫型號事實或暗中跨到 PDF／Web。
- 系統請使用者補型號後，點選與直接輸入完整型號都必須接回原問題，而不是把型號當一題新問題。

## v29.6.157 回答鏈、精確型號證據與逐頁索引基線

- LINE 可見回答固定依「直接答案 → 必要步驟 → 必要限制 → 官方手冊頁碼 → 簡短費用／額度」排列。`RAG`、`BM25`、chunk、evidence ID、revision、token、grounding、適用範圍等只准留在後台；模型的「證據摘錄」只供程式驗證，送 LINE 前必須剝除。
- 已核對手冊片段用確定性重排，不再呼叫第二次模型潤稿；只可刪贅詞、調整順序與換成台灣口語，型號、數字、單位、選單名稱及「僅／必須／不支援／可能／需要」等限制詞不可改寫或省略。
- `tools/build_manual_page_index.py` 是離線、零 API 的通用逐頁索引產生器；來源由 `config/manual_registry.json` 精確綁定手冊與型號，`config/manual_lexicon.json` 只做跨問法意圖擴詞。輸出採小型 meta、lexical index 與頁面 shards，不把整本索引塞進 GAS 熱路徑。
- v29.6.157 的正式回答仍以既有 QA／RULE、已核對片段與整本 PDF 為主；逐頁索引先完成 M8／G8 影子驗證，不得假稱已全面取代正式 PDF。正式切換需另版完成 Drive artifact、ScriptProperties active pointer、revision／SHA 原子發布與頁面 evidence ID 驗證。
- 系列別稱選型後必須重新進入與「直接輸入完整型號」相同的已核對片段入口；能回答時直接回頁碼與步驟，不能先花 Fast 費用再叫使用者按手冊。
- M8／M7 常見手冊題的已核對片段擴充為藍牙音訊、Wi-Fi、Smart View／AirPlay、藍牙鍵鼠／手把、App 管理、軟體更新與出廠重設；每個片段仍須同時命中精確手冊型號與操作意圖，不能跨型號套用。

- `S32FM702／S32FM703／S32FM803` 的藍牙喇叭／耳機操作已人工核對官方手冊第 151 頁：路徑為「設定 → 所有設定 → 音效 → 音效輸出 → 藍牙揚聲器清單」。進入手冊查詢後必須先命中這個確定性片段，直接回覆頁碼與操作步驟，`pdfCalls=0`、不扣手冊次數；不得再把整本 PDF 交給 Flash-Lite 機率式找頁後誤判未記載。
- 上述片段僅允許完整型號匹配與藍牙音訊操作意圖；其他型號仍走原有 PDF 查詢擴詞，不能借用 M8 手冊內容。

- 完整型號一旦由使用者選定，本輪 DirectDeep、規格檢索與 PDF 可用性只能使用該完整型號；不得再從型號字串中的 G8／M8 片段展開其他系列候選或掛錯手冊。
- `術語_` RULE 只可解釋功能名稱，不是型號能力證據。能力題只有該完整型號自己的 CLASS_RULES 列明載才可肯定；未記載時須誠實說無法確認並提供手冊查證，不得把同系列其他型號套用。
- 程式守門產生的精確型號結論必須保留在最終手冊授權提示，不得被泛用模板洗掉；正在建議手冊時只顯示手冊與可選官網，不得同時提前顯示 Web 搜尋入口。
- QA／RULE 已完整回答時即停止，不因該型號「有 PDF」就在回答後追加手冊或 Web Quick Reply；只有 `manualSourceRecommended` 才推薦手冊，只有 `webSourceRecommended` 才推薦 Web。常駐 Rich Menu 仍可讓使用者主動指定來源。
- 全新對話的無型號操作／故障／跨裝置相容性題，在精準 QA 未命中後直接 deterministic `ASK_MODEL`；不得先讓 Fast 猜 PS5／PC 設定、HDMI 線材或其他型號步驟，也不得為單純補型號呼叫 LLM。已有持久完整型號時仍依使用者鐵律沿用，不誤判成缺型號。
- 兩個完整型號的比較題直接從各自的精確 `CLASS_RULES` 列抽取面板、解析度／更新頻率、反應時間、HDR 與同步規格；不交給模型混入第三台數字。活動 RULE 必須先以台北日期判斷仍有效，過期活動只留歷史資料，不可進回答。
- 範圍外題必須在 pending source、持久型號、價格與未知型號之前攔截；LG／HP／Lenovo 等競品與洗衣機等家電不得借用上一題螢幕型號。未登錄的完整型號不得寫入持久產品狀態。有效活動的指定型號權益由程式擷取該型號所在條款及共通抽獎，不交給模型混淆 Steam 點卡與延長保固。
- 商品售價仍一律遮罩並導官網；活動 RULE 明載的點卡、禮券或購物金面額屬贈品權益，不得被售價遮罩洗掉。
- 使用者選手冊後的免費前置檢查不得再呼叫 Fast 模型。只允許精準 QA、人工逐頁核對片段或程式從該完整型號 RULE 擷取的明載規格；操作／設定沒有現成證據時必須繼續顯示手冊確認並真的讀 PDF。
- `S32HG806ES` 的 Dual Mode 已由官方手冊第 27／35／43 頁人工核對：OSD `Game → Dual Mode`、可設自訂鍵、48–165Hz／48–330Hz 與 6K 165Hz 規格。僅精準命中該型號與雙模意圖時可零成本回答，不得套到其他 G8。
- USB 已核對片段只回答「如何播放」與格式限制；含斷線、中斷、不穩、異常、無法、故障或明確非官方／網路意圖時不得搶答，必須繼續到對應來源。
- 自然問句已同時明確出現非官方／公開網頁來源與查找解法意圖時，不先呼叫 Fast；零成本顯示「這題再搜網路」並退回一般 20 題額度。使用者按下後才由 Web 專用模型搜尋。
- 使用者確認 PDF 後若整本手冊生成仍取不到可核對證據，路由層自動做一次非 Samsung 官網的 Web 補救，不要求重按且不扣 10 次網搜額度；每聊天室每日最多 3 次系統補救。同題不得再次重試，Web 仍無證據時提供明確標示未經證實的保守操作方向與官網連結，禁止只回沒答案或形成迴圈。

- 完整型號是跨日產品狀態：沒有新完整型號前，數天後自然追問、手冊、網路都沿用。短系列名列候選，不覆蓋；只有換型號、新完整型號或管理員 `/重啟` 清除／取代。
- 手冊有上一題時顯示「確認要查／換型號／取消」，確認後才讀 PDF；網路按鍵本身就是授權，有上一題直接搜尋，不做二次確認。
- 手冊與網路都先建立 canonical source operation；10 分鐘內同來源＋型號＋問題回傳快取，不再次呼叫／扣次。手冊索引過期不快取失敗，背景修復後可立即重試。
- 所有手冊回答都要有頁碼、適用範圍與證據摘錄；Fast 的 QA／RULE 來源只能由實際命中決定，模型自帶來源標籤不採信。網路只接受 grounding supports/chunks；禁止 Samsung 官網 URL Context／直接抓頁，官網只作可點 URI。
- provider query 與 originalQuestion 分離：System Hint、模型提示與 canonical 關鍵字不得寫回對話。只有來源成功才更新 lastSource；Web 無證據不得切斷既有 manual 追問鏈。供應商請求送出即計次，不以退款放任改寫重燒；同型號同意圖 10 分鐘 operation cache 去重。
- `S32FM702／703／803` 的零售模式與 USB 媒體播放已加入人工逐頁核對片段：第 170 頁使用模式、第 97／176 頁 USB 路徑與限制。精準命中時零 PDF 呼叫、零手冊扣次；其他型號／意圖不得套用。

- `到這款官網` 是回答不足時的情境 Quick Reply，不是第四個 Rich Menu。只有已鎖定 CLASS_RULES 完整型號，且回覆查無資料、手冊未記載、來源失敗或證據衝突時才顯示；成功的 QA／RULE 答案、G8/M8 等短別稱與選型中一律不顯示。RULE 內 PDP 優先，否則用同列 XZW 料號的 Samsung Taiwan support URL；只允許 `https://www.samsung.com/tw/`。
- 正式 `/exec?test=1` 仍需維護密碼；Google Apps Script 的 `/dev?test=1` 僅專案編輯者能進入，程式以 `ScriptApp.getService().getUrl()` 確認 `/dev` 後才簽發 15 分鐘 TestUI token。兩者都共用 `testMessage` 與正式事件 router，禁止 Mock 冒充真人驗收。
- 每日 04:00 PDF 重傳後必跑 `auditManualCoverageGaps_()`；新 RULE 缺 PDF 或 H／2026 型號缺 PDF 時，保存報表、待審狀態與警示 LOG。`?manualCoverage=1` 必須維護授權，TestUI 顯示簡短覆蓋徽章。
- 官網掃描可自動發現產品與手冊下載網址，但沒有第一頁完整型號、PDF magic/MIME、SHA-256 與檔名驗證就不得自動進正式 RAG。2026-08-15 正式索引回讀顯示 H／2026 的 6 款 RULE 型號全部覆蓋，缺口 0。

- RULE 事實守門：完整型號的 `CLASS_RULES` 若明載 `Tizen` 與藍牙版本，Fast 模型不得回答「沒有內建藍牙」或「不支援藍牙」。純規格題直接用 RULE 回答；藍牙耳機的選單／配對操作題要在最終可見提示保留 RULE 肯定事實與已選型號，再建議使用者授權查官方手冊，禁止被後段模板洗掉。
- 手冊證據標記：模型輸出 `範圍:型號共通` 時正規化為既有契約的 `全檔共通`；若同一回覆已有有效第 N 頁，不得再追加「未取得可核對頁碼」，內部標記不得外洩。

- 藍牙耳機／喇叭操作題在 PDF 階段必須擴查手冊正式標題與選單同義詞（音效輸出、藍牙揚聲器清單、Bluetooth Speaker List、掃描、配對），不得因使用者用語不同就誤回「手冊未記載」。

- Fast／PDF／Polish 仍固定 `models/gemini-2.5-flash-lite`（US$0.10/M input、US$0.40/M output）；只有實際 Google Search grounding 改用穩定版 `models/gemini-2.5-flash`（US$0.30/M、US$2.50/M）。2026-08-16 真人 LOG 證實 Flash-Lite 雖收到 `google_search` payload，仍回 queries/chunks/supports 全 0 並用內建知識假裝搜尋；Web 專用升級是為了有效答案，不能擴及 QA／RULE／PDF。
- Web 回答最多 5 點、每點最多 2 行、450 個中文字內並須完整收尾。螢幕內建 USB 媒體播放題不得混入 Windows USB 省電、主機板 USB 埠或電腦端線材；非官方韌體下載不得列為解法。
- 成本比較看有效答案而非單次單價：先用精準 QA／RULE、頁面收斂與已核對手冊片段。只有未覆蓋題組的整體正確率仍不足，才另案 A/B MANUAL；不得在低成本方法已達標後繼續為模型比較花費。
- PDF 先以官方 `countTokens` 精算同一 payload，單次硬上限 NT$0.35；生成後以 `usageMetadata` 記實際費用。TestUI 不得再顯示舊的「約 NT$1.5」。
- `countTokens` 暫時錯誤、PDF 429／5xx、異常空答只受控重試一次；403／404 先單檔重傳再試。每日 04:00 強制重傳仍存在，失敗本數必須正確計數並排程背景重試。
- `/重啟` 只清使用者對話狀態；一般 PDF 過期、上傳失敗與同步不需要人工 `/重啟`。
- 官網 URI 只能使用本題完整型號或本題明確解析的 `primaryModel`；不得借上一題 `direct_search_models`／suggested cache。
- 每日重傳若部分 PDF 上傳失敗，保留前次完整 URI 與備份；Drive 掃描完整時以完整檔名目錄建立索引，掃描中途失敗則連正式索引也不覆蓋。兩種失敗都排程一分鐘後重試，TestUI／稽核不得把暫時失敗誤報成手冊缺口。

- 「直接問」20 題只計規格／FAQ 實質回答；手冊與網路使用各自額度，不得雙重計次。
- 一般回答若只產生手冊授權引導，必須退回該次一般提問額度。
- 一般流程已鎖定的完整型號必須寫入持久產品狀態；內容不同的新題仍沿用產品型號，但不得沿用舊答案與來源授權。手冊、網路、再手冊跨來源都不得洗掉型號。
- 常駐 Rich Menu 維持三格；只有準備沿用已知型號時，才顯示情境 Quick Reply「換型號」。換型號保留原問題、零計次、零來源呼叫。

- Rich Menu 與 TestUI 三格使用雙排超大字：第一排 `直接問`／`查手冊`／`搜網路`，第二排 `20題/日`／`5次/日`／`10次/日`。禁止縮回單行小字或塞入長句。

- `G8` 是 `CLASS_RULES` 已定義的 Odyssey 系列別稱。系列別稱遇到型號相關功能／操作／手冊題時，先從 RULE 列完整型號按鈕；只有涵蓋相同別稱的精準 QA 可直接回答，禁止泛用 Smart／其他型號資料搶答。選定完整型號後不得再次進入選型迴圈。
- 手冊 `countTokens` 的 20K 是成本警戒而非拒絕線；先刪除無關歷史，只保留本輪完整問題。100K 與單次最壞 NT$0.35 為雙重硬上限；超限先用 `MEDIA_RESOLUTION_LOW` 重算，仍超標才停止且不扣次。
- 免費 QA／RULE 預檢未命中後，PDF 生成階段只能載入官方手冊，不得再混入 QA、RULE、Prompt!C3 或網路。型號規格結論必須附 PDF 頁碼與「型號明確／全檔共通」證據範圍；「依型號而定」不能當肯定證據。

- 手冊 URI 過期時，只更新本題實際選中的 1～2 份 PDF 並重跑 token 預檢；成功後才送出生成請求與扣除手冊額度。單檔更新仍失敗才使用既有背景整庫重建，禁止因一份手冊過期就先同步全部 PDF。

- 正式 TestUI 真人提問驗收新增守門：完整型號操作題不得誤判為缺型號，必須只推薦「官方手冊」，且按鍵前不得讀 PDF 或扣次。
- 使用者直接輸入文字是新問題，但在沒有新完整型號前仍沿用持久產品型號。手冊可輸入系列別稱或型號前段；多個候選時顯示可點選型號，選型均零扣次。
- 使用者雖選官方手冊，仍須先做高信心 QA／CLASS_RULES 預檢；本機答案足夠時直接回答，零 PDF、零手冊扣點。只有不足時才進已授權 PDF。
- 實驗期每位 LINE 使用者每天 20 次有效提問；來源 postback、取消、補型號與型號選擇不重複計次。群組內仍按 userId 個別計算。
- LINE 客戶版只顯示 `本次約 NT$...｜今日提問剩餘 N/20`；token、paidCalls 與詳細成本仍只留 Request Audit／TestUI Logs。
- 每人 20 題使用短 UserLock，不得與 PDF 索引同步共用 ScriptLock；鎖忙碌時 fail closed，必須零計次、零供應商呼叫並顯示友善重試訊息。

- 一般訊息永遠先走 `規格＆FAQ`；精準 QA、CLASS_RULES 與人工驗證片段優先回答，但實驗期間每位使用者每天最多送出 20 題。
- `官方手冊` 與 `網路解答` 只能由本輪 Rich Menu postback 或相容舊指令授權。手冊需確認；網路按鍵即授權。pending 10 分鐘有效；查完、失敗或取消後來源回到規格＆FAQ，但持久型號保留。
- 每聊天室每日（Asia/Taipei）手冊 5 次、網路 10 次；只有 token／檔案等預檢通過、第一個生成請求送出前才原子扣次。
- `[AUTO_SEARCH_PDF]`／`[AUTO_SEARCH_WEB]` 平常只能轉成來源建議；唯一例外是使用者已確認 PDF、PDF 已付費但證據守門失敗時的一次性 Web 補救，不扣使用者網搜額度且禁止再跨回 PDF。
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
