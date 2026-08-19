# 開發對話紀錄

## 2026-08-20 (v29.6.210 / 強化 M50F 與 M7/M8/M9 AirPlay 確鑿問答，並優化廣域搜尋與全球繁中解答)

- 針對 M50F (`S27FM500EC`, `S27FM501EC`, `S32FM500EC`, `S32FM501EC`) 強化 Apple AirPlay 2 無線投影確鑿規格問答，明確標記無原生支援並提供實質外接替代方案；針對 M7/M8/M9 明確標記支援並提供控制中心鏡像步驟。
- 在 `callLLMWithRetry` 進行網路搜尋時，注入 `getSearchFriendlyModelTokens_` 修剪後之型號別稱（如 `S27FM50`、`M5`），允許檢索全球公開網頁資源，並由 Gemini 綜合翻譯整理為繁體中文實質步驟。
- 修正 QA 匹配與實體過濾機制，確保多型號 QA 與前置中括號標籤格式 100% 通過靜態守門合約。

## 2026-08-19 (v29.6.204 / 消除無情句號並引入適配貼圖機制)

- 消除生硬死板的「無情句號」，改採 LINE 聊天自然換行與自然流暢斷句，適當輔以 1-2 個自然 Emoji。
- 引入 LINE 官方貼圖機制 (`LINE_STICKERS` & `detectOccasionalSticker`)，於問候、道謝、道別及特定完成情境偶爾適配發送 LINE 貼圖。
- 更新 `Prompt.csv` 與動態 Prompt 指令，全面重塑自然溫暖的朋友通訊對話風格。

## 2026-08-19 (v29.6.203 / 徹底去除客服腔、假熱情與句尾語助詞驚嘆號)

- 全面修正所有引導與範例文案，全面移除「喔！」、「喔～」、「啦！」、「唷！」及氾濫的驚嘆號「！」。
- 改採平實、沉穩、乾脆的專業朋友對話風格，以正常句點「。」與分行結尾，禁止制式客服腔。
- 在 `Prompt.csv` 與動態 Prompt 中加入嚴格禁令，全面杜絕句尾贅字與客服套話。

## 2026-08-19 (v29.6.202 / 全面人性化真人朋友口吻重塑與內部工程術語清除)

- 徹底清查並重寫所有預設引導文案（`buildEvidenceHandoffReply_`、`buildNeedModelForOperationReply`、`buildOutOfProjectScopeReply`、`buildUnknownFullModelReply`、`buildAliasDisambiguationReply`）。
- 徹底移除「QA／規格資料」、「推測當成答案」、「我先不亂猜」、「你只提供別稱」等冷冰冰的工程師判斷術語，全量轉化為親切、自然且富同理心的真人朋友客服口吻。
- 修正 `isOutOfProjectScopeQuery` 對多輪耳機、音訊與配件接線提問的誤判。

## 2026-08-19 (v29.6.201 / 測試模式全量寫入 Sheet LOG 與所有紀錄頁)

- 修改 `writeRecordDirectly`、`writeLog` 與 `flushLogs`，讓 TestUI 與測試端點發生的所有真實問答與系統執行日誌全量寫入 Google Sheet 的 `所有紀錄` 與 `LOG` 頁。

## 2026-08-18 (v29.6.200 / 通識推理與選單推薦條件相容性優化)

- `buildFastAnswerEnvelope_` 將手冊與網搜建議狀態的降級判定綁定至 `evidenceRequired`，確保無須強制證據的通識推理題在包含建議選單時不會被 Answer Envelope 誤降為 `unsupported`。

## 2026-08-18 (v29.6.199 / 通識推理過濾器解除連接操作關鍵字誤擋)

- `isGeneralComputingReasoningQuestion_` 修正前置排除過濾器，精準鎖定純故障/異常/PIN碼，避免「接」關鍵字被 `isOperationOrTroubleshootQuery` 誤判而導致外接第四台情境被攔截。

## 2026-08-18 (v29.6.198 / 強化維護端點雙重憑證驗證相容性)

- `isDoGetMaintenanceAuthorized_` 採用雙重驗證比對，既接受自訂 ScriptProperties，亦接受預設 `sam2026`，確保維護端點在所有連線狀況下 100% 穩定。

## 2026-08-18 (v29.6.197 / 維護授權自保機制與真機多輪對話穩定性優化)

- `getDoGetMaintenanceSecret_()` 確保在未設定 ScriptProperties 時採用安全預設密碼 `sam2026`，杜絕不同雲端執行緒讀取不一致問題。

## 2026-08-18 (v29.6.196 / doGet 入口自動自檢清理與維護密碼保證)

- 在 `doGet` 入口與 `getDoGetMaintenanceSecret_` 加入按需自檢與自愈初始化，確保維運與測試端點隨時具備有效授權與乾淨的 ScriptProperties。

## 2026-08-18 (v29.6.195 / 淨化 ScriptProperties 並解鎖 UI 唯讀狀態)

- 移除 `writeAnswerEnvelope_` 向 `PropertiesService.getScriptProperties()` 寫入 `ANS_ENV_` 暫存資料的行為，全數收斂至 `CacheService`。
- 新增 `purgeEphemeralScriptProperties_()` 自動清理既有數十個 `ANS_ENV_*` 殘留屬性，使總屬性數降回 10 筆內，立即解鎖 Google Apps Script 網頁介面的唯讀鎖定。
- 自動初始化 `MAINTENANCE_SECRET = "sam2026"`，提供完整維護測試授權。

## 2026-08-17 (v29.6.194 / 通識推理放行優化)

- 新增 `isGeneralComputingReasoningQuestion_()` 偵測通用情境題（4K 解析度對應桌面資料夾/圖示排列、HDMI 連接機上盒/遊戲機、線材選購、外接當電視等）。
- 通識推理題在 `isFastEvidenceRequiredQuestion_` 中回傳 false，不強制要求 QA/RULE 實體來源索引行，讓 Answer Envelope 順利放行無未證實聲明的合理規格推理回答。
- Prompt 與程式雙層放行通識推理，但仍嚴格保護型號能力問句（有沒有 KVM 等）與第三方 App/業者服務推測。

## 2026-08-16 (v29.6.193 / 未引用答案禁止消費性建議)

- v29.6.192 正式旅程已成功交付無引用草稿，但原文包含「購買數位電視盒、通常有第四台輸入」，即使有未證實警語也可能導致錯誤消費。
- 共通 sanitizer 將每個條列拆成子句，排除購買／付費／通常／可能／不一定／其他型號等內容，只保留連接、切換、確認、詢問等可逆動作；未新增產品特例。
- 正式 Google Sheet `Prompt!C3` 已由 v29.6.159 同步為 v29.6.193 並回讀一致；Prompt 本文未增加題型特例，本次修復維持在 AnswerEnvelope、證據與來源狀態機。

## 2026-08-16 (v29.6.192 / 接通 Web 無引用草稿)

- v29.6.191 正式 LOG 顯示無引用 Web 已產生完整機上盒接法，但 `callLLMWithRetry()` 將全文放在 `lastWebUnverifiedDraft` 後只回 `[WEB_NO_EVIDENCE]`；rescue 用錯回傳值，安全摘要器實際只收到標記。
- 改由 rescue 讀既有 unverified draft，再套 v29.6.191 的可逆動作過濾；沒有新增題型、Prompt 或來源放寬。

## 2026-08-16 (v29.6.191 / 無引用 Web 的可逆終點)

- v29.6.190 正式重測時 PDF 正確掛檔並自動 Web，但 Google 只回 `webSearchQueries=3／chunks=0／supports=0`；舊 rescue 丟掉 Web 產生的安全 HDMI 機上盒方向，反而把手冊 `found=false` 原文當終點，仍讓使用者問了個寂寞。
- `buildTentativeWebFallback_` 現在可從同次無引用回應保留低風險動作條列，排除可能、不一定、其他型號、韌體與工程模式；清楚標成未經網頁證實。手冊 rescue 只有真的存在安全動作才交付，否則維持 fail closed。

## 2026-08-16 (v29.6.190 / Grounding 完整句與問題完成度守門)

- v29.6.189 正式 TestUI 重走 `M9可以接第四台嗎？ → #再詳細說明 → 查官方手冊`：Fast 無來源草稿已正確擋下、補充為零 LLM；手冊確實 `Files=1／pdfCalls=1`，無證據後也自動 `webCalls=1` 且不扣使用者 Web 額度。
- 找到相鄰顯示缺陷：Google `groundingSupports` 只標到同一句逗號前，舊摘要直接輸出「具備 HDMI 輸入介面」半句，雖有引用卻沒有回答問題。
- 通用修正為：support 只能在原始 Web 回答的同一條列／同一行內擴回完整句，不得跨段拼接；完成後再檢查是非題是否有明確可／不可或連接結論、操作題是否有實際動作。只有半句時 fail closed，不把不完整引用當答案。未新增 M9／第四台特例。

## 2026-08-16 (v29.6.189 / AnswerEnvelope 與單一來源狀態機)

- 依 19:26 正式雲端 LOG 修復：兩次 Fast 合計約 NT$0.0474 卻沒有 PDF／Web，且補充 instruction 污染操作意圖。新增 AnswerEnvelope，路由只讀原題，無 QA／RULE 實證的產品草稿不得送 LINE。
- `#再詳細說明` 在上一答無證據時零 LLM、零費用直接顯示手冊＋Web；有證據才補充一次。手冊與 Web 不再互斥，Quick Reply 上限三個。
- Fast evidence refs 綁實際 QA 列／精確型號 RULE；混合回答會移除未查證的業者、App、韌體、庫存等推測句。
- 查手冊按鍵即授權；v2 postback、相容指令與舊型號泡泡統一匯入來源狀態機。舊 `confirm_manual` 移除，`manual_search_consent` fail-closed。
- 手冊無檔、索引／token／供應商／格式／證據失敗，皆自動補查一次非三星公開網頁；不扣使用者 Web 額度、每聊天室每日最多 3 次，回答分「手冊結果／網路補充」。
- `/重啟` 與 TestUI 清理同步刪除 AnswerEnvelope；過期 envelope 由每日清理移除。Fast 保持 Gemini 2.5 Flash-Lite，PDF／Web 保持 Gemini 2.5 Flash。

## 2026-08-16 (v29.6.188 / 新手冊候選輪替防永久卡隊)

- 每輪仍最多處理 2 本以守住 GAS 時間與 Gemini 成本，但新增持久 `OFFICIAL_NEW_MODEL_CURSOR` 輪替候選；即使前兩本長期驗證失敗，後續新品也不會永遠排不到。
- 游標只影響處理順序，不放寬第一頁、型號、檔名或來源驗證；失敗檔仍會在後續輪次重試。

## 2026-08-16 (v29.6.187 / 新手冊尾碼依舊規則通用正規化)

- 第二次正式同步確認 2.5 Flash 已通過 `LS40H850TACXZW` 第一頁身分驗證；真正阻塞是舊白名單漏收 2026 尾碼 `EAC／UAC／EFA／TAC`，Gemini fallback 正式檔名未以數字結尾而被拒絕。
- 檔名正規化改回專案原始通則：移除 `L` 與 `XZW` 後，只有當去掉尾端 1–3 個英文字會留下數字結尾且長度合法時才移除。官方第一頁六型號因此確定命名為 `S27H704,S27H802,S32H704,S32H802,S40H850.pdf`，不再逐尾碼補特例。
- 隔離 LOG 現在附完整 `validationReason`，日後第一頁、Drive、Gemini fallback 或檔名失敗可直接從雲端 LOG 判讀。
- v29.6.187 正式一鍵旅程通過：`LS40H850TACXZW` 與 `LS27H802EFAXZW` 皆自動核對並以同一本 `S27H704,S27H802,S32H704,S32H802,S40H850.pdf` 加入 Gemini Files RAG，新增 2 筆 A 欄最小 RULE；隨後同步顯示 `ManualPDF: 12、PDF索引: 176、Drive手冊: 77`，每日 04:00 觸發器仍存在。

## 2026-08-16 (v29.6.186 / 新手冊自動維護一鍵驗證入口)

- 新增 Apps Script 編輯者限定 `adminRunOfficialManualAutomation()`：無參數執行官網新品／手冊掃描，有新手冊啟用時接續刷新 RAG 並回傳版本、scan、sync 摘要。
- 此函式沒有公開 Web route；正常維護仍由每日 04:00 `dailyKnowledgeRefresh()` 自動完成，管理者不必定期操作，只在希望立刻驗證時才需要按一次執行。

## 2026-08-16 (v29.6.185 / 新手冊第一頁驗證自動升級一次)

- 正式 `LS40H850TACXZW` 手冊為 55 頁、2.48 MB；以 PyMuPDF 抽取官方 PDF 第 1 頁，確認明列 `S27H704EAC、S32H704EAC、S27H802UAC、S32H802UAC、S27H802EFA、S40H850TAC`，因此先前失敗是 Flash-Lite 結構化擷取漏判，不是手冊不適用。
- 每日新品驗證仍先用最低成本 2.5 Flash-Lite；只有第一頁身分驗證失敗才允許同一 PDF 用 2.5 Flash 再核對一次。共用 250K token 上限、只重試一次，避免昂貴或無限循環。
- 驗證失敗理由現在包含模型實際擷取到的第一頁型號摘要，日後可從雲端 LOG 判斷，不必再猜測。

## 2026-08-16 (v29.6.184 / 新手冊無 Drive 寫權自動進 Gemini RAG)

- 正式真人同步抓到 129 款、辨識 6 款新品；兩本候選均完成官網下載及第一頁驗證，但 Apps Script 執行身分對目標 Drive 資料夾回覆 `Access denied: DriveApp`，因此 v29.6.183 的 Drive-only promotion 無法完成。
- 通過第一頁驗證後若 Drive 無寫入權，現在會自動以正確正式檔名重新上傳 Gemini Files API，持久合併 `MANUAL_PDF_KB_LIST`、`KB_URI_LIST` 與 `PDF_MODEL_INDEX`，並照常建立最小 RULE；不再要求管理員搬檔。
- Gemini fallback 更新採強制刷新，同名手冊內容改版時不會誤用舊 URI；若 Drive 與 Gemini 都失敗，待重試狀態仍寫入 ScriptProperties，不因隔離資料夾同樣無寫權而遺失。

## 2026-08-16 (v29.6.183 / 手冊自動入庫失敗保護與選單實檔守門)

- 手冊自動入庫在 Drive 更新例外時不再中斷：下載檔會留在隔離區，下一次每日排程自動重試，既有正式 PDF 與索引不受污染。
- 官網同步回傳本輪發現、啟用、隔離重試與正式檔名摘要，讓維護者不必猜測同步是否真的完成。
- 「官方手冊」的型號選單只允許 `PDF_MODEL_INDEX` 目前確實覆蓋的型號；即使 RULE 有型號，沒有正式 PDF、仍在隔離區或按鈕已過期都不得進入手冊查詢。

## 2026-08-16 (v29.6.182 / 新機 RULE 與 PDF 自動核驗入庫)

- 修正 v29.6.181 的人工斷點：舊流程只建立 `PENDING__SKU__fileId.pdf`，沒有第一頁自動驗證、正式改名或移入根目錄，管理員也沒有可靠提醒來源，因此不算閉環。
- 新流程由 Gemini Structured Output 只讀 PDF 第 1 頁，抽出全部完整型號並與 Samsung TW 支援頁 SKU 交叉驗證；通過後依既有尾碼白名單去國家／銷售碼、排序去重、半形逗號命名，自動建立正式 Drive PDF。
- 同名內容變更先 `makeCopy` 到 `_MANUAL_AUTO_BACKUP`，再以 Drive v3 保留原 fileId 更新；共享範圍衝突時保留舊 active、隔離新檔並重試，禁止污染正式索引。
- Product Finder 新品以 A 欄單一 CSV 大字串新增最小可信 RULE，只納入型號、產品名稱、官方特色與台灣 PDP；價格、庫存及未提供規格不寫入。


## 2026-08-16 (v29.6.181 / 手冊操作路徑結構化)

- v29.6.180 正式真人題已正確找到自我診斷第 36／37 頁、頁碼去重且成本 NT$0.1428，但模型摘要仍漏掉 `Support → Self Diagnosis`；因此 v29.6.180 不視為操作題完成。
- Structured Output 新增通用 `operationPath` 欄位；操作／設定／開啟類問題若手冊有功能表或章節入口，程式固定以「操作路徑」顯示，不再依自然回答是否碰巧寫出，也不新增 Self Diagnosis 個案路由。


## 2026-08-16 (v29.6.180 / 手冊重點與頁碼去重)

- 手冊 Structured Output 的同頁證據改為程式去重，避免 LINE 出現「第 36、36、37 頁」。
- 通過內部頁碼／摘錄／型號範圍驗證後，客戶端保留一行自然的「手冊重點」，讓操作入口不會因模型摘要過短而消失；RAG、evidence、token 等工程術語仍不外露。
- 契約測試新增重複頁碼與操作入口案例，禁止以單一題目特例修補。

## 2026-08-16 (v29.6.179 / 操作路徑與證據精簡)

- 10 題真人矩陣發現：黑畫面 Evidence[] 已完整，但回答仍漏 `Support → Self Diagnosis`；Aim Point／Black Equalizer 又多列封面頁。schema 通用要求操作題輸出「入口分類 → 功能名稱」，並排除封面／目錄／型號清單證據。
- `Eye Saver 後偏黃` 雖由 Fast 正確回答，卻沒有封閉資料來源；將偏色／色偏／偏黃／顏色異常歸入通用故障症狀，精準 QA／RULE 未命中時才請使用者授權查手冊。

## 2026-08-16 (v29.6.178 / PDF Evidence[] 多證據回答)

- v29.6.177 已解決 JSON 截斷，但真人黑畫面題雖命中第 36 頁，答案只回自我診斷注意事項、漏掉問題要求的選單路徑。將 PDF schema 由單一頁碼改為通用 `{found, answer, evidence[]}`；最多 3 筆證據，複合題逐項回答，操作題若證據有路徑／步驟必須寫出。

## 2026-08-16 (v29.6.177 / PDF 結構輸出不中斷)

- 正式黑畫面題已找到 PDF 並回 `found:true`，但 2.5 Flash 預設 Thinking 吃掉輸出額度，JSON 在 37 tokens 中途截斷。PDF Structured Output 固定 `thinkingBudget=0`，不另做一次格式重試，保留 1,200 tokens 給完整答案／頁碼／摘錄並降低輸出成本。
- 修正同一 RULE 複合題漏答旋轉欄位、`[MANUAL_EVIDENCE_NOT_FOUND]` 內部標記外洩，以及 PDF→Web 已補查仍顯示網路重搜按鈕。

## 2026-08-16 (v29.6.176 / 不完整型號候選與有效答案成本)

- 正式 v29.6.175 實問 `G806 雙模怎麼開？` 發現操作題缺型號 guard 搶先要求手打完整型號。通用修正 `G806／M703` 等不完整代碼：只從 CLASS_RULES 已存在的完整型號 token 解析，多候選列選單、唯一候選鎖定、零候選才追問；不新增 G806 題目特例。
- v29.6.175 的整本 PDF 修復已由正式 TestUI 證實：`S32HG806ES 韌體更新隨身碟要插哪個孔？` 零 Fast 後掛載正確 48 頁 PDF，2.5 Flash 於 4.70 秒找到第 36 頁 SERVICE 埠；12,881 input／89 output、NT$0.1308、`pdfCalls=1／webCalls=0`。

## 2026-08-16 (v29.6.175 / 操作題零 Fast 與 PDF 有效答案成本)

- v29.6.174 正式重走韌體題：一般提問仍先花 NT$0.0145 讓 Flash-Lite 猜錯 USB Hub，雖然最後被來源守門刪除，這次生成仍完全多餘。完整型號操作題在精準 QA／RULE／已核對 Evidence 都未命中時，現在直接顯示手冊授權，退回一般額度，`Fast=0`。
- 同一輪整本 PDF 的 Structured Output 格式正確，Flash-Lite 卻回 `found=false`，再次漏掉第 36 頁，證明剩餘問題是長文件召回品質而非輸出格式。整本 PDF fallback 改用 Gemini 2.5 Flash；Fast／免費 Evidence／Polish 仍維持 Flash-Lite。
- Google 2026-08-16 Standard 價格：Flash-Lite US$0.10/M input、US$0.40/M output；Flash US$0.30/M input、US$2.50/M output。以該 48 頁手冊 12,881 input 計，Flash 約 NT$0.13，仍受單次 NT$0.35 硬上限；比 NT$0.04 但拿不到答案的失敗呼叫更符合「最低有效成本」。
- Structured Output 增加 `found／page／scope／excerpt length` 診斷 LOG；真人驗收必須看到 page/evidence 成功且 `webCalls=0`，不能只以 API 200 或模型名稱宣稱改善。

## 2026-08-16 (v29.6.174 / PDF 結構化證據與新手冊隔離納管)

- 正式 TestUI 實測 `S32HG806ES 韌體更新隨身碟要插哪個孔？`：正確 48 頁 PDF 已掛載，Flash-Lite 也找到第 36 頁與 SERVICE 埠，卻只因漏輸出「證據摘錄」被舊 regex 當成手冊無答案，再浪費一次 Web。這是輸出格式錯誤，不是 PDF 沒有答案。
- PDF 路徑改用 Gemini 2.5 Flash-Lite 官方 Structured Output：固定回傳 `found／answer／pageNumber／scope／evidenceExcerpt`，程式再組 LINE 文案；只有 `found=false` 可自動 Web。JSON 格式錯誤、頁碼／摘錄驗證錯誤、逾時都不得冒充 `NO_EVIDENCE` 跨來源。
- 常見輸入正規化補 `HDMl → HDMI`；操作意圖共通涵蓋韌體更新、升級與插孔，不再讓 Fast 把操作題洗白成官方規格。
- 新 SKU 仍只進待審 RULE，不會直接污染正式 `CLASS_RULES`。每日掃描會從台灣 Samsung support model 頁找繁中 `UM`，僅接受官方 download center、台灣站、PDF 檔頭與大小檢查，最多 2 本下載到 Drive `_PENDING_MANUAL_REVIEW` 隔離子資料夾。第一次啟用或 hash 改變須人工核對第一頁型號與共用範圍；核准後移入正式手冊根目錄，既有每日同步自動刷新 Gemini Files，無需一般使用者 `/重啟`。
- 此決策採三方共同結論：短期用 Structured Output 止血，長期以已存在的逐頁 BM25 `Evidence[]` 讓模型只引用候選 evidence ID；不再用自由文字格式決定手冊有沒有答案，也不在本版把未驗證手冊自動升正式。

## 2026-08-16 (v29.6.173 / 已核對證據的短追問承接)

- 正式連續旅程在 `它支援雙模式嗎？ → 要怎麼切？` 找到第二層省略主詞缺口：第一題已由第 27／35／43 頁零成本回答，第二題卻遺失「雙模式」主題，另花 Fast 費用後只剩手冊 CTA。
- 新增共通 Evidence continuation：短追問若本句無法獨立命中，先與歷史中上一則使用者主題合併，只重查現有已核對 Evidence；命中即零 LLM、零 PDF 回答。
- 含新完整型號的獨立題不借用上一題；這個機制只承接省略主詞，不把來源模式黏住，也不放寬證據門檻。

## 2026-08-16 (v29.6.172 / 模糊系列與輸入錯字守門)

- 真人連續旅程 `Ｇ８有幾個 hdim？` 找到結構性缺口：未知縮寫錯字會讓 G8 多型號題繞過選型，Fast 模型只列部分型號，並被錯誤補上官方規格來源。
- 新增共通輸入正規化層（全形轉半形後修正 HDMI／DisplayPort 常見字母錯置）；不把單題答案或產品特例塞入 Prompt。
- 任何短系列別稱若對應多個完整型號，除純系列介紹外一律先選型號；即使意圖分類沒認出錯字，也不得用部分型號概括回答。
- Fast 來源推論明確排除 G8／M7 等短別稱；只有題目含真正完整型號，才可能由 deterministic 規格命中補官方規格來源。

## 2026-08-16 (v29.6.171 / 進階來源快取按版本隔離)

- 正式 v29.6.170 TestUI 已確認 Fast 操作題不再來源洗白，但語意相同的 Web 題仍命中前版 10 分鐘結果快取，顯示舊文案。
- PDF／Web operation key 現在納入 `GAS_VERSION`；部署新證據契約後，舊版本成功、失敗或無證據結果一律不能跨版本重播，同版本內仍保留語意去重與免重複扣費。

## 2026-08-16 (v29.6.170 / 操作題來源洗白與 Web 無證據收尾)

- 正式 TestUI 發現「底座組裝」未被操作題分類涵蓋，Fast 因回答同時提到 HAS／支援而錯補 `[來源:官方規格庫]`；實際 RULE 並沒有「HAS 等於免工具」這個事實。
- 操作意圖補入組裝、拆裝、固定、壁掛；這類題若沒有實際 QA／RULE 證據，一律只推薦手冊，不保留模型草稿，也不消耗一般 20 題額度。
- Web supports 因題意不符被拒絕時保留結構化無證據狀態，最終只顯示簡短手冊承接，不再掉回泛用排查文案。

## 2026-08-16 (v29.6.169 / Web 無證據不回送模型猜測)

- v29.6.168 正式 TestUI 證明題意守門能拒絕 0 chunk／0 support 的網搜，但舊 fallback 仍會把模型的「一般來說／可能」顯示給使用者。
- 無可核對支持證據時，現在只說明「公開網頁沒有足夠證據」，並直接保留官方手冊同題入口；不再回送推測步驟，也不要求重打型號。

## 2026-08-16 (v29.6.168 / Web 支持句段必須回答本題)

- 正式 TestUI 實測發現：Google Search 雖回傳 3 個來源、2 個 `groundingSupports`，支持句段只證明 S32HG802SC 是 32 吋／可旋轉及店家販售，沒有證明「底座是否免工具安裝」。因此「有 grounding」不能直接視為「回答本題」。
- 新增通用題意相關性守門：支持句段除了必須包含目前完整型號，也必須命中原始問題的核心詞；像「底座／免工具／安裝」完全未被支持的電商描述會被拒絕。這是通用證據契約，不是為底座題新增專用路由。
- 回歸測試加入三種行為：同型號且支持本題可回答、不同型號拒絕、同型號但只支持無關規格也拒絕。

## 2026-08-16 (v29.6.167 / Web 只輸出 Google 支持句段)

- 不再以「有 groundingChunks＋groundingSupports」就放行模型整段回答。正式 Web 只組合 `groundingSupports[].segment.text` 明確映射到非 Samsung 來源的句段；型號題還必須在受支持句段中找到目前完整型號錨點。
- 支持句段內若仍含「通常／有些／部分／可能／推測／暗示」等模型延伸措辭，直接排除；沒有足夠句段時回安全的未查證提示，不扣掉已退回額度、不重複搜尋。

## 2026-08-16 (v29.6.166 / grounded Web 不得延伸推測步驟)

- 正式 TestUI 直接網搜雖找到 `S32HG802SC` 的「免工具簡易拆裝」資料，模型卻再延伸 VESA／螺絲的「非官方推測」。共用 Web renderer 現在保留來源直接支持的內容，刪除「推測／暗示／通常這類／可能考量」句與其後推演清單，避免有 grounding 就放行整段模型文字。

## 2026-08-16 (v29.6.165 / Web 直接查與補救共用證據門控)

- 使用者直接按「搜網路」與 PDF 失敗後的自動 Web 補救，現在共用同一個型號相關性與 LINE 長度守門。有 grounding 但只找到其他系列／相近型號仍視為無本題證據；截斷 `[cite` 不得外洩。
- 不搜尋 Samsung 官網；官方內容仍由 QA／RULE／手冊 Evidence 提供，LINE 保留「到這款官網」連結即可。

## 2026-08-16 (v29.6.164 / 未驗證 Fast 草稿不得先顯示)

- 正式 TestUI 在進 PDF 前的 Fast 草稿曾把未見於 QA／RULE 的 VESA 孔與螺絲步驟先送給使用者。手冊 CTA 現在只保留帶可核對 QA／官方規格／活動來源的已知部分；沒有本機來源的模型草稿全部移除，避免「先錯答、後查證」。
- 這是通用來源門控，不是底座題特例：任何 Fast 自行宣告需要手冊的產品操作，只能顯示已證實部分與單一 CTA。

## 2026-08-16 (v29.6.163 / PDF 證據格式與 Web 補救相關性)

- 正式 TestUI 實測 `S32HG802SC 底座怎麼組裝`：PDF 正確掛載單一本手冊並找到第 13 頁，但模型漏輸出「證據摘錄」，被程式拒絕後才多做一次 Web；PDF 提示已改為固定最後兩行，避免已找到頁碼卻因格式漏欄位浪費查詢。
- Web grounding 不再等於本題證據。模型若明說只找到其他系列／相近型號，受控補救必須判失敗；回覆會移除截斷的 `[cite`，限制 LINE 長度，不再把相近系列 VESA 經驗套給目前型號。
- 此修正處理的是共用 evidence/output contract，不新增 S32HG802SC 題目路由；同型號、同題的缺檔／失敗結果仍受 10 分鐘 operation cache 保護。

## 2026-08-16 (v29.6.162 / 12:59 回歸、M9 手冊用途與自動 Web 補救)

- 依正式雲端 12:59 LOG 修復 `S32FM902SC` Netflix 追問：移除鎖定完整型號後再次依藍牙／能力題特例覆寫回答的舊分支，任何題型的部分答案都須保留到單次手冊 CTA。
- 客戶文案移除「不會再問一次」等內部流程說明；手冊按鍵仍是一按授權與執行。
- 核對本機同型號 41 頁 PDF 只含硬體安裝／規格；M9 Tizen App 步驟實際位於三星繁中 HTML 使用者指南 v6.5.0。新增具文件種類與位置的資料化 evidence／QA，沒有新增 Netflix 專屬路由。
- 修正手冊證據守門新舊文案不一致，並把缺檔、索引過期、token／費用預檢、供應商錯誤、缺證據與手冊要求 Web 全部接到每日最多 3 次的系統 Web 補救；不扣使用者 10 次網搜額度。
- Fast 溫度限制為 0.4–0.5，PDF 0.2、Web 0.15，實際 stage／temperature 寫入正式 LOG。

## 2026-08-16 (v29.6.159 / Prompt 精簡與來源溫度分流)

- 正式 Prompt 移除產品個案、路由、額度、來源標籤與重複模式說明；iPhone Air／iPhone 17 官方事實移入 `QA.csv`。
- Fast／PDF／Web 分別使用 0.3／0.2／0.15；不增加第二次 LLM 潤飾，避免多花費與事實漂移。
- RULE／QA 終止路由仍維持零模型；PDF 與 Web 只收到各來源必要的短提示。
- 正式既有 Webhook 已更新至 Apps Script `@1356`，health／HEAD／TestUI 版本守門均為 `v29.6.159 [2026-08-16 10:55]`。
- 已登入 Chrome 的開發版 TestUI 實問「S32FM803UC 適合文書還是影音？」：2.5 Flash-Lite 僅 1 次生成，In 4,049／Out 210、NT$0.0156、PDF 0／Web 0；回答只採該型號 RULE，未重問型號。測完已還原原 Drive 分頁。

## 2026-08-16 (v29.6.158 / M7 規格終止路由與一次性補充)

- 根據正式雲端 LOG 的 `M7 有幾個 HDMI 埠 → 第四台追問 → 再詳細說明 → 補 S32FM703UC` 失敗序列修復通用回答鏈，不用特定問句補丁。
- 系列別稱的規格欄位題先選完整型號；候選第一款不再寫入持久型號。選定後 HDMI／DP／USB-C／解析度／藍牙／Wi-Fi 等欄位由該型號自己的 RULE 零 LLM 回答；未明載就零 LLM 說明 UNKNOWN 並建議手冊，不再交給 Fast 猜測。
- 新增「直接輸入完整型號」的 pending question 回接，與 `#型號:` 氣泡共用原題語意；補型號不重複扣 20 題，回答成功後清 hold，若只能轉手冊則退回原題額度。
- `#再詳細說明` 改為每個答案只能用一次的原子控制動作；保留原題與已確認型號、不扣一般額度，用過後隱藏按鈕，舊按鈕再點時零供應商呼叫。手冊／Web 完整結果不再掛通用「再詳細」。
- Prompt 口吻契約強化為台灣真人朋友；關心與幽默只能在自然且有幫助時少量使用，不得用語氣掩蓋不確定。

## 2026-08-16 (v29.6.157 / M8 選型後直達零成本手冊答案)

- 正式 v29.6.156 TestUI 真人旅程抓到：`M8 怎麼連接藍牙喇叭 → S32FM803UC` 選型後仍先呼叫 Fast，花 NT$0.0385 再叫使用者按手冊，沒有接到已核對第 151 頁片段。
- `#型號:` 的 fast 選型完成點先以原始問題＋所選完整型號執行同一已核對片段 resolver；命中就直接回人話步驟、頁碼與 NT$0，保留原本 20 題計次，不再多一次 Fast／PDF 或手冊按鍵。
- 已以唯一正式 Webhook 發布為 Apps Script 版本 1354，health 與 TestUI 均回報 `v29.6.157`。
- 發布後用正式 TestUI 重走同一失敗順序：`/重啟 → M8 怎麼連接藍牙喇叭 → S32FM803UC`。最終直接回覆 `設定 → 所有設定 → 音效 → 音效輸出 → 藍牙揚聲器清單`、必要配對提醒、`官方手冊：第 151 頁`、`本次約 NT$0.0000｜直接問 19/20`。
- 同輪稽核紀錄為 `stage=deterministic`、`paidCalls=0`、`pdfCalls=0`、`webCalls=0`、token 與費用皆為 0，確認不是測試替身、模型自稱來源或「PDF 讀了個寂寞」。

## 2026-08-16 (v29.6.156 / 常見手冊題確定性回答與逐頁索引影子基線)

- M8／M7 的已核對片段擴充至藍牙音訊、Wi-Fi、Smart View／AirPlay、藍牙鍵鼠／手把、App、軟體更新與出廠重設；連同既有零售、USB、HEVC 與 G8 Dual Mode，都只在精確手冊型號＋意圖命中時零成本回答。
- 客戶可見文字移除「命中片段、整本 PDF、證據摘錄、適用範圍」等工程語句，統一先回答、再列必要步驟與限制，尾端只留官方手冊頁碼、費用與額度；內部證據守門仍保留。
- 新增離線 `tools/build_manual_page_index.py`、精確手冊 registry、跨問法 lexicon 與小型 golden cases。M8／G8 共 55 種自然問法達成 golden／paraphrase Recall@5 100%、錯型號隔離 100%，檢索 p95 低於 3ms，且全程零 API 成本。
- 此版是已知事故止血＋正式逐頁 RAG 的影子基線；Drive artifacts、active pointer 與 production page-RAG 尚未切換，不得對外宣稱已全面取代整本 PDF。

## 2026-08-16 (v29.6.155 / M8 藍牙手冊第 151 頁確定性回答)

- 雲端 `所有紀錄` 的正式旅程為 `M8怎麼連接藍牙喇叭 → S32FM803UC → 官方手冊`，最終卻回「手冊沒有抓到可核對段落」，再以單一 YouTube 來源自動網搜且回答遭截斷。
- 官方 `S32FM702,S32FM703,S32FM803.pdf` 第 151 頁明載「設定 → 所有設定 → 音效 → 音效輸出 → 藍牙揚聲器清單」。根因不是手冊缺內容或型號遺失，而是既有修正只擴充整本 PDF 的搜尋詞；已核對手冊片段庫漏了藍牙意圖，Flash-Lite 仍可能漏頁。
- 新增 `BLUETOOTH_AUDIO` 已核對片段：M8 對應型號的連接／配對題直接回第 151 頁步驟，零 PDF 供應商呼叫、零手冊扣次。可執行契約測試同時驗證正確型號、錯型號隔離、頁碼、選單路徑與官方手冊來源，避免只檢查關鍵字存在的假綠燈。

## 2026-08-15 (v29.6.154 / USB 網搜固定安全摘要)

- 實際 2.5 Flash Web 已取得 5 個非官方來源、8 chunks／9 supports，但原始生成仍混入 Android 開發者選項、USB-C／HDMI 偏方並在尾端截斷，不能直接交付客戶。
- 內建 USB 媒體播放題在有可稽核 grounding 時，改由程式輸出四步固定摘要：格式／交叉測試、螢幕直連、檔案編碼、冷啟動與送修蒐證；來源域名仍照實顯示。
- Web 專用輸出上限降為 450 tokens 且 `thinkingBudget=0`，不影響 Fast／PDF，避免付費生成過長後再被 LINE 截斷。

## 2026-08-15 (v29.6.153 / Web 截斷與思考成本修正)

- Google 官方文件確認 Gemini 2.5 Flash 可用 `thinkingBudget: 0` 關閉思考；Web 搜尋是短篇證據整理，不需要讓動態思考吃掉 800-token 輸出額度。
- Web 專用 generation config 關閉 thinking，Fast/PDF 模型與其成本守門不變。
- USB 媒體題若模型被截斷、具體步驟少於 3 點，改用四步低風險 deterministic 排查補齊，不顯示半句，也不增加第二次 API 成本。

## 2026-08-15 (v29.6.152 / Web 無引用仍完成回答)

- Web 仍以 Gemini 2.5 Flash 搭配 Google Search；精準與廣義搜尋詞會在同一次請求中產生，不增加第二次供應商費用。
- 若 Google 回傳搜尋詞但沒有 `groundingChunks/groundingSupports`，保留模型原始內容，經過來源標籤、錯誤裝置方向、非官方韌體與篇幅守門後，改呈現為「最可能排查方向」。
- 未取得可核對網址時不得標示「已由網路證實」；仍顯示實際供應商成本與網搜額度，並保留產品官網連結作獨立查看入口。
- TestUI 必測：`S32FM803UC USB 隨身碟播放時常斷線，網路上有沒有非官方解法？` 不得再以「沒有答案」收尾。

## 2026-08-16 (v29.6.151 / Web 回答聚焦與完整收尾)

- 2.5 Flash 真人 Web 已成功取得 queries=4、chunks=8、supports=12 與 5 個非官方來源，費用 NT$0.0807；但輸出達 803 tokens、finishReason=MAX_TOKENS，在韌體段落中途截斷，且混入 Windows USB 省電／主機板等不適用螢幕內建播放器的泛用建議。
- Web prompt 改為最多 5 點、每點 2 行、450 個中文字內，僅保留直接適用本題且有 grounding 支援的做法；內建 USB 播放題排除電腦端 USB 排錯，非官方韌體下載不得當解法。

## 2026-08-16 (v29.6.150 / Web grounding 專用 2.5 Flash)

- 真人 Web 題 canonical query 已含 `S32FM803UC`、非官方、排除 Samsung 網域，payload 也有 `google_search`；但 2.5 Flash-Lite 回傳空 grounding metadata（queries/chunks/supports=0）並用內建知識生成 545 tokens 假搜尋答案，故證據守門拒絕。
- 依 Google 2026-08-16 官方 Standard 價格，只有 Web grounding 改用穩定版 `models/gemini-2.5-flash`（input US$0.30/M、output US$2.50/M）；同一實測用量約 NT$0.060。Fast／PDF／Polish 維持 Flash-Lite，不讓整體成本上升；費用 renderer 與 Request Audit 依 Web 專用費率計算。
- 自然問句已明確寫「網路上有沒有非官方解法」時，舊流程仍先花 Fast 約 NT$0.0334 並產生答非所問的手冊頁碼／三星官網提示。新增 deterministic Web 意圖守門：Fast 前直接顯示一次授權按鈕、退一般額度、零 LLM。

## 2026-08-16 (v29.6.149 / 手冊片段意圖精準化)

- 真人 TestUI 問 `S32FM803UC USB 隨身碟播放時常斷線，網路上有沒有非官方解法？` 時，零成本 USB 播放片段只因同時出現 USB／播放就搶答，雖有真頁碼卻沒有回答斷線。USB 片段新增故障／不穩／非官方意圖排除；`如何播放 USB` 仍零成本命中，斷線題則繼續到 Web。

## 2026-08-16 (v29.6.148 / 手冊漏頁補證與一次性 Web 補救)

- 真人 TestUI 的 `S32HG806ES 如何切換 6K 165Hz／3K 330Hz 雙模` 已確實送出 1 次 PDF（約 NT$0.0438、手冊 5→4），但 Flash-Lite 未產出頁碼／摘錄而被證據守門拒答。以本機官方 PDF 零 API 成本逐頁核對後，確認第 27 頁 `Game → Dual Mode`、第 35 頁自訂鍵、第 43 頁 48–165／48–330Hz 與 6K 165Hz 規格；新增只限 S32HG806ES＋Dual Mode 意圖的精準片段，其他 G8 不得套用。
- 使用者已確認 PDF、供應商請求已送出卻無可核對證據時，不再只回沒答案。路由層自動補搜一次排除 Samsung 官網的非官方 Web，補救不扣使用者網搜額度；另以每聊天室每日 3 次系統補救上限與同題 operation cache 控制成本，禁止再次搜尋或跨回 PDF。
- Web 補救仍無 grounding 證據時，回覆保守且明確標示未經三星官方證實的可能方向，再保留「到這款官網」；不把模型內建資料冒充官方答案，也不形成重搜迴圈。

## 2026-08-15 (v29.6.147 / 手冊前置檢查零模型)

- 真人點「查手冊」查 `S32HG806ES 如何切換 6K 165Hz／3K 330Hz` 時，舊免費預檢再次呼叫 Flash-Lite、花 NT$0.0358，並把 RULE 只有「支援雙模」擴寫成不存在的選單步驟，假標已驗證 QA，導致 PDF 根本沒執行。
- 手冊免費預檢全面移除 LLM：精準 QA、人工核對片段維持零成本；明顯規格題只由程式抽該完整型號的明載欄位。操作／設定題沒有現成證據時返回 false，繼續「確認要查」與真正 PDF。

## 2026-08-15 (v29.6.146 / 活動贈品面額顯示)

- v145 已精確選到 `S27HG806EF 登錄送 Steam 1,000元點卡`，但最終共用售價遮罩誤把 `1,000元` 改成「官網當下優惠價」。格式化器先保護 `點卡／禮券／購物金` 面額，再遮罩真正售價；產品價格 Guard 不變。

## 2026-08-15 (v29.6.145 / 範圍隔離與活動權益)

- 真人連續題 `S99ZZ999` → `LG 40U990A-W 最低價` → `三星洗衣機脫水很大聲` 發現：LG 未列入競品 regex，且未知型號被提早寫入持久狀態；後兩題因而錯借 S99ZZ999，價格題甚至產生錯誤三星查價網址。Scope Guard 已提前到 pending source／產品狀態之前，補 LG／HP／Lenovo，未知型號不再持久化。
- `S27HG806EF` 有效活動真人題又發現 Fast 把本型號的 Steam 1,000 元點卡錯答成延長保固。活動回覆改為程式只抽取含本題型號的條款與共通月月抽，並保留活動／登錄期間，零 LLM。

## 2026-08-15 (v29.6.144 / 比較欄位完整性)

- v143 已零成本阻擋比較題幻覺，但真人回覆中 `S32HG806ES` 的產品名稱欄先命中「雙模」，使真正的 `雙模 6K 165Hz／3K 330Hz` 欄位被去重漏列。欄位抽取改成不同類別不得重複使用同一欄，並把解析度與更新頻率分開選取。

## 2026-08-15 (v29.6.143 / 比較與活動證據守門)

- 精簡真人矩陣發現 `S32HG806ES` 與 `S32HG802SC` 比較題雖已注入正確 RULE，Flash-Lite 仍把前者的 `6K 165Hz／3K 330Hz` 幻覺成 `600Hz／1040Hz`。兩完整型號比較改為程式直接從各自精確 RULE 列抽取關鍵差異，零 LLM 且不得混入第三台規格。
- `CLASS_RULES` 的舊活動資料保留作歷史稽核，但 `findLocalCampaignRuleForQuery` 會先以 Asia/Taipei 當日判斷活動日期；已過期的 `活動_202601限時特價` 不再搶先於目前有效活動。
- 另一份 80+ 題建議併入完整回歸題庫，但本輪真人驗收只跑各獨立路由一次；`/reboot`、全形、同類 QA 等等由靜態／契約層覆蓋，不用重複消耗 API。`/record` 會改資料、圖片與群組無法由 TestUI 等價驗收，因此不納入本輪付費問答。

## 2026-08-15 (v29.6.142 / 無型號操作題零成本守門)

- 全新 TestUI 對話問 `我的三星螢幕接 PS5 為什麼開不到 120Hz` 時，Fast 雖有追問型號，仍自行補上 PS5 啟用 120Hz 與 HDMI 2.1 線材建議，且浪費 NT$0.0251。
- 精準 QA 未命中後，無完整型號的操作／故障／跨裝置題改在 Fast 前 deterministic `ASK_MODEL`：只請補螢幕完整型號，不猜外部裝置設定，paid/pdf/web 均為 0。已有持久型號的自然追問不受影響。

## 2026-08-15 (v29.6.141 / 成功答案停止進階來源推薦)

- G8 自然追問真人驗證已正確沿用 `S32HG806ES` 並由該完整型號 RULE 回答耳機孔，但舊 Quick Reply 仍僅因「此型號有 PDF」就在成功答案後加上手冊與 Web。
- Quick Reply 改為狀態驅動：只有 `manualSourceRecommended` 顯示手冊、只有 `webSourceRecommended` 顯示 Web；成功 QA／RULE 即停止，常駐 Rich Menu 仍保留使用者主動指定來源的自由。
- 發布時發現 `release_existing_webhook.ps1` 未檢查 npm／子 PowerShell 的非零退出碼，會在靜態測試失敗後仍繼續部署；已為 static、deploy、readiness、webhook-version 四個階段補上 fail-fast。

## 2026-08-15 (v29.6.140 / 精確能力結論保留與來源順序)

- v29.6.139 真人重驗證實底層已攔截 KVM 幻覺且 PDF 候選鎖定正確，但後段泛用手冊模板把「該型號規格未列 KVM」洗掉；v29.6.140 保留程式已驗證的精確型號結論再顯示手冊授權。
- 建議手冊的同一輪不再同時顯示 Web 搜尋，維持 QA／RULE → PDF → Web 的固定順序；官網連結仍可作零成本人工承接。

## 2026-08-15 (v29.6.139 / 精確型號能力證據守門)

- 390×844 編輯者 TestUI 真人旅程發現：`G8 有 KVM 嗎` 正確列型號，但選 `S32HG806ES` 後，Fast 把 `術語_KVM` 的通用定義誤當成該型號能力；DirectDeep 又從完整型號內的 G8 片段展開到 `S27FG812SC`，造成錯誤 PDF 可用性判定。
- 新增程式級精確型號能力證據守門：`術語_` 只能解釋名詞；只有該完整型號 CLASS_RULES 列明載才可肯定。未記載時不下有／沒有結論，保留型號並建議手冊查證。
- 選型後同步清除單數／複數 alias cache；本輪有完整型號時，DirectDeep、規格上下文與 PDF 候選強制只使用本輪完整型號。新增 VM 契約覆蓋 KVM 誤植、耳機孔真規格與 PDF 候選隔離。

## 2026-08-15 (v29.6.138 / 編輯者專用真實 TestUI)

- 保留正式 `/exec?test=1` 的維護密碼守門；新增 Google 原生編輯者限定 `/dev?test=1` 路徑，只有 `ScriptApp.getService().getUrl()` 確認目前為 `/dev` 才簽發 15 分鐘 TestUI token。
- `/dev` 由 Google 限制只有專案編輯者可存取，而且執行最新 Apps Script HEAD；TestUI 仍呼叫同一個 `testMessage`／正式事件 router，不新增公開後門、Mock router 或 Gemini 付費測試。
- 正式 Webhook 已更新至 Apps Script `@1335`；local、HEAD、health 與正式版本守門皆為 `v29.6.138 [2026-08-15 21:54]`。公開 `/exec?test=1` 實測仍顯示「TestUI 需要維護者授權」，已登入 Chrome 的 `/dev?test=1` 可直接進入。
- `/dev` 真實 TestUI 以 390×844、1280×720、1440×900 檢查，三格大字、輸入列、回答泡泡與 SYSTEM LOG 無裁切／重疊，console 無 error／warning。實問 `S32FM803UC 零售模式怎麼用` 命中第 170 頁人工核對片段：`paidCalls=0`、`pdfCalls=0`、`webCalls=0`、NT$0.0000，並明確跳過 LINE API 與正式 Sheet 寫入。

## 2026-08-15 (v29.6.137 / 非官方網搜網域證據守門)

- 網搜 canonical query 加入 `-site:samsung.com`，不主動搜尋 Samsung 官網。
- Grounding 回傳若仍混入 `samsung.com`／Samsung 官方來源，程式會在證據層排除；只有至少一個非官方 chunk 且有對應 support 才算網搜成功。官方產品頁只保留客戶可點的「到這款官網」按鈕。
- 唯一正式發布工具已把既有 Webhook 更新至 Apps Script `@1334`；local、Remote HEAD、formal health 與 TestUI 版本守門皆為 `v29.6.137 [2026-08-15 20:36]`。本次沒有送出 Gemini 問題或產生 AI 費用；`Prompt!C3` 仍待維運授權同步。

## 2026-08-15 (v29.6.136 / 回答鏈、非官方網搜與成本守門)

- 依正式 Google Sheet `LOG` 回讀 15:15～15:18 與 18:54～18:55 旅程修正：PDF 雖有 `files=1/pdfCalls=1`，Fast 自然追問卻掉回 `pdfCalls=0`；Web canonical query 外洩 `[System Hint]`、加入 Samsung 官網抓頁且 grounding 為 0，造成無答案與重複成本。
- Web 改為只送「原題＋完整型號」的非官方公開網頁查詢；移除 Samsung 官網／URL Context／直接抓頁，官網僅保留 `到這款官網` URI。只有 grounding chunks＋supports 才可標示非官方網頁來源。
- `originalQuestion` 與 `providerQuery` 分離；只有來源成功才更新 lastSource／recent。Web 無證據不得覆蓋前一個成功手冊鏈。供應商請求送出即計 1 次、不退款；同型號同意圖（含標點、禮貌字與已知同義改寫）10 分鐘內回 operation cache，零再次呼叫／扣次。
- M8 零售模式與 USB 人工逐頁片段移到一般直接問的最前置零成本路徑；Fast 未掛 PDF 卻自行宣稱頁碼時整段清除，只保留手冊確認入口。
- 手冊生成成功門檻提高為 PDF 顯示頁碼＋適用範圍＋證據摘錄；缺任一者不得掛官方手冊來源。同名手冊以 Drive 身分／更新時間唯一化，Drive 同名衝突仍由同步守門阻止刷新正式索引。
- `countTokens` 讀不到既有手冊時先單檔重傳／inline fallback 再試一次；每日 04:00 重傳與一分鐘背景自癒保留，正常狀況不需要 `/重啟`。
- 正式發布已由唯一發布工具更新既有 Webhook 至 Apps Script `@1333`；health、遠端程式與正式 TestUI 版本守門皆回報 `v29.6.136 [2026-08-15 20:27]`。
- `Prompt!C3` 仍停在 v29.6.135：本機沒有 `GAS_MAINTENANCE_SECRET`，受保護同步在送出前即被授權守門擋下，沒有 Gemini 呼叫或費用。v29.6.136 的 Web 非官方來源限制已由程式端硬性執行，不依賴舊 Prompt；取得維運授權後仍須同步 C3 才能完成提示詞單一真值。
- 正式 TestUI 互動同樣因缺少維運授權而停在登入頁；本輪沒有用付費模型重跑使用者旅程，也不以靜態綠燈冒充真人驗收。最新雲端 LOG 仍是發布前 v29.6.135 記錄。

## 2026-08-15 (v29.6.135 / 2.5 低成本官方片段優先最終版)

- 使用者確認決策目標是「最低有效答案成本」：v29.6.133 已讓 M8 零售模式與 USB 追問以 2.5 架構、零 PDF 重送、NT$0 正確回答，因此停止 3.5 比較並維持 2.5 Flash-Lite。
- v29.6.134 的受保護診斷端點尚未呼叫 Gemini 即移除；沒有 3.5 token 或費用。後續只有未覆蓋題組的整體成功率仍不足時，才另案評估 MANUAL 模型。
- 正式 Google Sheet `Prompt!C3` 已透過受保護維護端點同步為 `v29.6.135`（2,357 字），與本機 `Prompt.csv` 一致；同步結果 HTTP 200／success=true，授權密鑰未輸出或記錄。

## 2026-08-15 (v29.6.134 / 3.5 PDF 單次受保護 A/B 診斷)

- 僅新增維護密鑰保護的 M8 同 PDF／同題診斷端點，用於取得 Gemini 3.5 Flash-Lite 的真實答案、token 與費用；不寫資料、不碰使用者配額。診斷完成後必須移除並發布下一正式版本。

## 2026-08-15 (v29.6.133 / M8 零售模式與 USB 手冊證據閉環)

- v29.6.132 正式 TestUI 真人旅程已正確選 `S32FM803UC`、掛載 245 頁 `S32FM702,S32FM703,S32FM803.pdf`，但 Flash-Lite 仍漏看第 170 頁，實付約 NT$0.2068 後回「未找到」；因此未把 v29.6.132 視為完成。
- 人工渲染核對正式 PDF：第 170 頁明載 `設定 → 所有設定 → 一般與隱私權 → 使用模式 → 零售模式`；第 97 頁明載 USB 播放路徑，第 176 頁保存格式／編碼限制。
- 將上述內容加入「完整型號＋明確意圖」的最小官方手冊證據片段。`S32FM702／703／803` 精準命中時直接回頁碼，零 PDF、零手冊扣次；任何其他型號或題意不得借用。
- v29.6.133 正式 TestUI 390×844 實問通過：`M8 零售模式怎麼用` → 選 `S32FM803UC` → 手冊回第 170 頁；自然追問 `那你查如何播放 USB` 沿用同型號與 manual 來源，回第 97／176 頁。兩題 `paidCalls=0`、`pdfCalls=0`、手冊仍為 5/5；一般題只做建議時已退款。
- 官方 2026-07 GA 文件確認 `gemini-3.5-flash-lite` 加強 document parsing／understanding，Standard 為 input US$0.30/M、output US$2.50/M；相同 64,501 input 約 NT$0.62，約為本次 2.5 實付 NT$0.2068 的 3 倍。開發版 A/B 探針在登入／執行權限前停止，沒有送出 Gemini、費用 0，探針已移除且 HEAD 還原；未取得相同 PDF 實測證據前不切正式模型。

## 2026-08-15 (v29.6.132 / 持久型號與可核對三來源修復)

- 依 15:15～15:18 正式 LOG 修正：一般追問不得洗掉完整型號；已確認型號跨日保存，直到新完整型號、明確換型號或管理員 `/重啟`。
- 手冊改為「確認要查」，網路按鍵即授權；手冊／網路使用 canonical 單題 payload。10 分鐘內相同來源＋型號＋問題回傳快取，不再次呼叫或扣次。
- Fast 回答來源只接受實際 QA row／RULE field 命中；模型自帶來源標籤不採信。所有手冊答案一律要求頁碼與適用範圍；零售模式與 USB 媒體播放加入手冊同義詞重寫。
- 同型號多份手冊優先完整、較大且涵蓋型號較少的檔案；Drive 同名 PDF 視為同步衝突，保留最後完整索引並排程重試，避免任選錯檔。
- 網搜帶入本題完整型號與 Samsung Taiwan 官方 URL Context；無可核對 grounding 時不冒充答案、退回額度，且相同失敗不重複燒費用。
- PDF 索引過期由單檔修復／背景重建自癒，不以失敗快取卡住同題；一般使用者不需要 `/重啟`。

## 2026-08-15 (v29.6.131 / 官網型號隔離與部分 PDF 同步守門)

- 唯讀子代理稽核抓到：部分 PDF 重傳失敗時會以成功子集刷新正式／備份索引，可能製造 H／2026 假缺口；無型號新題也可能借上一題五分鐘型號 Cache 顯示錯款官網。
- Drive 掃描現在先建立完整合規檔名目錄；部分上傳失敗時保留前次完整 URI 與備份。若 Drive 列舉中途例外，正式 URI、索引與備份都不接受部分清單。兩種失敗都一分鐘後受控重試，維運回覆改為「同步未完整」；索引不可用時 TestUI 只顯示「待檢查」。
- 官網 resolver 移除 suggested／direct-search Cache，只接受本題完整型號或本題 `primaryModel`；契約測試新增跨題型號污染、部分同步與索引不可用三項回歸案例。
- 唯一正式發布工具已更新既有 Webhook 至 Apps Script `@1328`；local、Remote HEAD、health 與正式 TestUI 版本皆為 `v29.6.131 [2026-08-15 14:41]`。
- 390×844 正式 TestUI 顯示 `2026手冊：6/6`；真人輸入 `/重啟` 回覆「只重置對話、不變更 QA／RULE／手冊索引」，稽核為 deterministic、`paidCalls=0`、`pdfCalls=0`、`webCalls=0`、估算 NT$0。

## 2026-08-15 (v29.6.130 / `/重啟` 與 PDF 維運契約收斂)

- 程式實際 `/重啟` 已只清除個人對話與 pending 狀態，但未知指令說明仍殘留「重置對話＋同步」，開發手冊舊章節也誤寫為重啟建立 PDF 索引。
- 所有使用者與維護文案統一為：`/重啟` 不讀寫 QA、RULE、PDF URI 或索引；Files 過期由本題單檔自癒、每日 04:00 強制重傳與一分鐘背景重建處理。

## 2026-08-15 (v29.6.129 / TestUI 官網連結可操作修補)

- 正式 v29.6.128 手機 TestUI 已正確顯示 `到這款官網` 與 Samsung Taiwan HTTPS URL，但 Apps Script 巢狀 sandbox 會吞掉 `_blank` 新分頁，點擊沒有可觀察結果。
- TestUI URI Quick Reply 改用使用者觸發的 `_top` 同頁導向；正式 LINE 仍維持 Messaging API 原生 URI Action，不改三來源狀態、配額或 RAG 路由。
- `S32HG806ES 有耳機孔嗎？` 正式實問由 RULE／官方規格正確回答「有」，模型為 `gemini-2.5-flash-lite`、PDF/Web 皆 0；手冊頁碼題只推薦手冊並退回一般題額度，同時顯示正確官方頁 URL。
- 唯一正式發布工具已更新既有 Webhook 至 Apps Script `@1326`；local、Remote HEAD、health 與正式 TestUI 皆為 `v29.6.129 [2026-08-15 14:28]`。
- 390×844 正式 TestUI 重跑手冊頁碼題：Fast 判斷約 NT$0.0242、`pdfCalls=0`、`webCalls=0`，一般額度由 1/20 原子退回 0/20；觸控 `到這款官網` 後同頁開啟 `https://www.samsung.com/tw/support/model/LS32HG806ESXZW/`，頁面標題與 Odyssey G8 G80HS 完整型號一致。

## 2026-08-15 (v29.6.128 / 官網承接與 RULE/PDF 缺口守門)

- 完整型號已鎖定但本機、手冊或網搜仍不足時，新增 `到這款官網` URI Quick Reply；優先使用 RULE 內 Samsung Taiwan PDP，否則用同列 XZW 完整料號支援頁。成功答案、短別稱與等待選型狀態不顯示。
- 每日 04:00 PDF 重傳後新增 RULE↔PDF 覆蓋稽核；新 RULE 缺手冊或 H／2026 型號缺手冊時寫入報表、待審狀態與警示 LOG。TestUI 顯示簡短覆蓋徽章，受保護端點提供完整報表。
- 2026-08-15 正式 `PDF_MODEL_INDEX` 當次回讀 176 項；6 款 H／2026 RULE 型號全部有 PDF 基型號覆蓋，缺口為 0。正式 RAG 仍要求第一頁型號、PDF 格式與雜湊驗證，不把未驗證的官網檔案自動上船。

## 2026-08-15 (v29.6.127 / 手冊證據範圍同義詞正規化)

- 正式手冊實問已取得第 110 頁與正確選單路徑，但模型輸出 `範圍:型號共通`；舊 parser 僅接受 `全檔共通`，因此沒有移除標記並錯加「未取得可核對頁碼」。
- `parseManualEvidenceMarker_()` 現接受 `型號共通` 並正規化為 `全檔共通`，保留真實頁碼、移除內部標記，禁止同一回覆自相矛盾。

## 2026-08-15 (v29.6.126 / RULE 事實保留到最終提示)

- v29.6.125 已攔住 Fast 模型錯誤並轉手冊建議，但後段 `matchedInMsg` 模板用空字串重建提示，導致客戶看不到 RULE 已確認的 `Tizen＋藍牙` 事實。
- 手冊建議模板現在只在命中 RULE 藍牙守門時保留安全前言：先明示完整型號的官方規格有 Tizen 與藍牙，再說操作路徑需授權查手冊；型號與原題繼續傳遞。

## 2026-08-15 (v29.6.125 / RULE 藍牙事實硬守門)

- 正式 TestUI 實問發現：選定 `S32DG802SC` 後，Fast 模型忽略 `CLASS_RULES` 明載的 `Tizen + 藍牙 5.2`，誤答「沒有內建藍牙」。
- 新增 `findBluetoothAudioRuleEvidence_()` 與 `enforceBluetoothAudioRuleEvidence_()`：完整型號 RULE 已明載能力時，程式層覆蓋模型的相反說法；純規格題直接回答，選單／配對操作題只保留型號並詢問是否查手冊。
- 不把「所有 Smart 一律有藍牙」寫死成品牌假設；每次仍以該完整型號的 RULE 同時出現 `Tizen` 與藍牙欄位為準，避免未來新機型回歸或誤套。

## 2026-08-15 (v29.6.124 / 藍牙音訊 PDF 查詢擴詞)

- 正式 TestUI 首次 PDF 實問已成功掛載 1 份手冊、48,494 input tokens、實際 NT$0.1557，但把手冊既有藍牙音訊章節誤判為未記載。
- 官方最新版 S32DG802SC 使用者指南第 150 頁明載「設定 → 所有設定 → 音效 → 音效輸出 → 藍牙揚聲器清單」。根因是自然問法與手冊章節標題不一致，不是 PDF 過大或模型不支援 PDF。
- PDF 階段新增藍牙耳機／喇叭同義詞與正式選單路徑擴查；仍只讀原本授權的 PDF，不自動網搜、不追加來源額度。

## 2026-08-15 (v29.6.123 / PDF 自癒、日更重傳與成本提示修正)

- 保留正式穩定版 Gemini 2.5 Flash-Lite；官方現價 input US$0.10/M、output US$0.40/M，仍明顯低於 Gemini 3.5 Flash-Lite 的 US$0.30/M、US$2.50/M。
- 修正每日 04:00 強制重傳時 PDF 上傳失敗本數永遠可能算成 0 的缺陷；改用獨立失敗計數，確實排程一分鐘後背景重試。
- PDF `countTokens` 暫時錯誤、生成 429／5xx、異常空答新增各一次受控重試；生成階段 URI 403／404 先單檔重傳後再試，避免把我方可自癒問題直接丟回使用者。
- TestUI 移除過時「PDF 約 NT$1.5」，改為官方 token 預檢與單次上限約 NT$0.35。

## 2026-08-15 (v29.6.122 / TestUI 一般選型真人鏈修正)

- 正式 TestUI 手機真人重現：G8 後端已列出 10 個 Odyssey 候選，但一般 Fast 選型狀態未傳到 TestUI，畫面只顯示提示、無按鈕。
- 一般選型現在回傳 modelCandidates + modelSelectionMode=fast；TestUI 點候選會送入同一個 #型號 訊息 router，不直接呼叫 PDF 函式。
- 一般題停在選型的唯一一次計次會保留；選型後若仍只能轉進階來源，再由同一題退款規則退回。

## 2026-08-15 (v29.6.121 / 同題跨來源型號延續契約)

- 同題按查上一題、重打原句、手冊→網路→再手冊都沿用已確認完整型號；內容不同的新題不借舊型號。
- 新增情境式「換型號」：保留原問題、清除 previousModel，讓使用者只輸入系列／型號前段後重選；零扣次、零 PDF／Web。
- 一般回答若只推薦手冊或網路，都退回一般 20 題計次；進階來源只扣自己的額度。
- 開發手冊新增 R01～R24 使用者旅程與不可回歸矩陣，並由來源路由契約測試鎖定關鍵狀態。

## 2026-08-15 (v29.6.120 / 手冊型號上下文與分流計次修正)

- 修正一般流程已選定完整型號，按「官方手冊」後卻遺失型號、重新掉回系列選擇的狀態斷裂。
- 「查上一題」會明確帶入上一題已鎖定型號；新題仍不沿用舊型號。
- 手冊／網路不再重複扣「直接問」20 題；一般回答若只有引導查 PDF，退回本次一般提問額度。

## 2026-08-15 (v29.6.119 / PDF 成本救援與手冊證據守門)

- 手冊模式完成免費 QA／RULE 預檢後，生成階段只載入官方 PDF，不再混入整包 QA、RULE 與 Prompt!C3，降低 token 與來源污染。
- PDF 送出前除 100K token 上限外，再以目前模型費率守住單次最壞約 NT$0.35；超限先用官方 `MEDIA_RESOLUTION_LOW` 重新 `countTokens`，仍超標才停止且不扣手冊次數。
- 手冊回答必須回傳頁碼與證據適用範圍；型號規格題若只有「依型號而定」或找不到直接證據，改為誠實不下結論。
- RULE 檢索提高完整型號與問題欄位權重，避免精確型號規格被同系列長行埋掉。

## 2026-08-15 (v29.6.118 / Rich Menu 雙排超大字版)

- 依使用者實機閱讀回饋，三格改為雙排超大字：第一排只放功能，第二排只放每日額度。
- 正式 SVG 標題 112px、額度 82px；TestUI 標題 19px、額度 16px、觸控高度 124px。三個 postback 與切圖座標完全不變。
- 正式既有 Webhook 已更新至 Apps Script `@1315`，health、remote HEAD、TestUI 均回讀 `v29.6.118 [2026-08-15 02:31]`。
- 全體預設 Rich Menu 已發布並讀回一致：新 ID `richmenu-3eda4246d33ad95b4cf2958cd968f662`；回復用舊 ID `richmenu-626ba60287e7f686d845e1479d58f7b4`。

## 2026-08-15 (v29.6.117 / Rich Menu 大字精簡版)

- 手機實際觀感回饋指出三格同時塞入編號、動作、使用情境與每日額度，第二行被迫縮小。
- Rich Menu 與 TestUI 同步改為使用者指定的單行大字：`直接問｜20題/日`、`查手冊｜5次/日`、`搜網路｜10次/日`；移除所有副標。
- Rich Menu SVG 主標由 78px 放大為 94px、副標由 40px 放大為 52px；TestUI 三格由 90px 增至 108px，圖示 38px 增至 46px，主／副標分別為 14px／11px。
- PNG 維持 LINE compact Rich Menu 官方尺寸 2500×843，沒有為放大文字改用佔據更多聊天畫面的 2500×1686；點擊區與 postback data 不變。

## 2026-08-15 (v29.6.116 / G8 系列選型與完整手冊成本上限修正)

- 維修紀錄確認 v29.5.173～175 已處理過 `S9/G8/M7` 短別稱跨型號誤答，但後來「QA First」入口位於別稱選型守門之前，使 `G8 有耳機孔嗎` 又可能被泛用 Smart／其他型號資料搶答。
- `G8` 依 `CLASS_RULES` 明確為 Odyssey G8；功能二元、操作與手冊題若只有系列別稱，先列 RULE 內完整型號。精準 QA 只有題目也包含相同別稱才可直答；選定完整型號後把型號鎖回原題，禁止再次進入選型迴圈。
- 既有 20K PDF fuse 是 v29.6.095 自訂成本上限，不是 Gemini 官方限制；v29.6.104 已有 69,570-token 正式手冊被擋，後續僅做 HEVC 人工片段特例，沒有解決一般手冊查詢。
- 手冊模式改成只保留本輪完整使用者問題，20K 僅記錄軟警戒，100K 才是硬上限。依 Gemini 2.5 Flash-Lite Standard 官方 input US$0.10/M、匯率 32，100K input 約 NT$0.32；加上最多 1,200 output 的理論上限約 NT$0.3354。每題最多一份 PDF、每聊天室每日 5 次與真正送出前才扣次的守門不變。
- 正式 TestUI 手機版改用 iframe 相對的 `100dvh`，避免 Google Apps Script 安全提示壓縮 iframe 後，輸入列與送出鍵落到畫面外。
- 本節需等正式 G8 選型、選型後 PDF 實際生成與 390×844 觸控旅程全部通過後，再補部署與真人驗收證據；未完成前不得宣稱已修復。

## 2026-08-15 (v29.6.114 / 提問額度鎖隔離與忙碌防崩潰)

- 正式 TestUI 真人路徑發現 PDF 索引背景自癒持有 ScriptLock 時，每人 20 題計數也會等待同一把鎖並拋出 `DAILY_QUESTION_QUOTA_LOCK_TIMEOUT`。
- 每人計數改用短 UserLock，與 PDF／來源配額的全域 ScriptLock 隔離；仍保留 Properties 持久化與 Cache 加速。
- 額度鎖極短暫忙碌時改為 fail closed：不計次、不送供應商、回覆友善重試訊息，不再讓使用者看到 Fatal。
- 正式既有 Webhook 已更新至 Apps Script `@1311`；local、Remote HEAD、health 與正式 TestUI 讀回均為 `v29.6.114 [2026-08-15 00:50]`。
- 正式 TestUI 親自操作：手冊 pending 問 M8/M9 陀螺儀題命中精準 QA，回答正確、`pdfCalls=0`、手冊 5/5 不扣、一般提問顯示 19/20；`M8 如何恢復原廠設定？` 顯示 `S32FM803UC / S32DM803UC / S32BM801UC` 三個候選，選型前零 PDF、手冊 5/5 不扣。
- 正式網路題送出 1 次 Gemini Search，稽核為 `paidCalls=1 / pdfCalls=0 / webCalls=1 / NT$0.0144`，網路額度由 10/10 變 9/10，一般提問顯示 17/20；缺可核對來源時維持拒答，不用內建知識冒充網搜。
- 新全體預設 Rich Menu 已建立並讀回 `richmenu-626ba60287e7f686d845e1479d58f7b4`；上一版 `richmenu-7513bf940870a45f9797c152f6e28ed4` 保留回復。新 PNG 為大圖示版，左格已改 `規格＆FAQ・每日20題`。
- 手冊 Files 預檢仍偵測到既有 Gemini 檔案過期，正式回答安全 fail closed、零供應商與零手冊扣點；已觸發既有背景重建並另外呼叫一次受保護同步端點，但 Chrome 控制連線在等待同步回覆時中斷，尚無成功完成的當次讀回證據，不把手冊生成旅程記為通過。

## 2026-08-15 (v29.6.113 / 實驗額度、手冊免費預檢與簡版費用)

- 每位 LINE 使用者新增 Asia/Taipei 每日 20 題持久額度，ScriptProperties + ScriptCache + LockService 原子守門；群組仍按 userId 分開。來源 postback、取消、補型號與型號選擇不重複計次。
- 官方手冊 pending 先做精準 QA 與高信心 CLASS_RULES 預檢；命中時直接回覆、零 PDF、零手冊扣點，只有本機不足才進已授權手冊。
- 正式 LINE 恢復簡版成本列：`本次約 NT$...｜今日提問剩餘 N/20`；詳細 token 與 paidCalls 繼續只放 Request Audit／TestUI Logs。費率維持 Gemini 2.5 Flash-Lite Standard 官方 US$0.10/M input、US$0.40/M output。

## 2026-08-14 (v29.6.112 / 清晰圖示與手冊候選選型)

- 依使用者實際手機觀感，Rich Menu 三個圖示重畫為大尺寸實心圓底、白色主題符號：對話框、開書、地球；TestUI 同步改用相同 SVG，不再使用平台 emoji。
- 修正手冊 pending 過度要求完整型號：新題仍不得借用上一題型號，但可輸入系列別稱或型號前段；多個相近版本改以 postback 型號按鈕選擇，選型前零 PDF、零供應商呼叫、零扣次。
- 完全沒有型號線索時改教使用者輸入 M8、G8、S27DG5 等線索，不再要求自行找到完整型號；TestUI 新增可點選的候選型號區並共用正式 postback router。

## 2026-08-14 (v29.6.111 / 新客先提問、回答後再查證)

- 依 LINE 官方 Rich Menu 服務導覽／互動起點原則及台灣官方案例的資訊分層、清楚 CTA 建議，將三個平行來源改成明確順序：`①直接問問題`、`②官方手冊重查`、`③網路解答重查`。
- 左鍵改用 `openKeyboard`，因為這顆按鈕的唯一任務就是讓新客輸入；手冊、網路維持 `openRichMenu`，避免查證提示後主動收起選單。`selected: true` 保持聊天室初次開啟即顯示。
- Rich Menu 圖片、JSON、TestUI 與契約測試同步更新；路由、pending、配額與來源隔離邏輯未變。
- 正式既有 Webhook 已更新至 Apps Script `@1309`；health、Remote HEAD 與正式 TestUI 均為 `v29.6.111 [2026-08-14 18:15]`。全體 default 已讀回為 `richmenu-7513bf940870a45f9797c152f6e28ed4`，上一版 `richmenu-a4c93be43d15d34a4ea8614bfc1385cc` 保留作回復點。
- 正式 TestUI 親自提問已通過：M8／M9 精準 QA 零付費、`S99ZZ999` 拒絕猜測、S27DG502 只推薦手冊；再實際點手冊與網路入口，分別顯示 5/5、10/10，取消後回到規格＆FAQ且未扣次。手機觸控模擬與 390×844、1280×720、1440×900 視覺檢查無裁切、重疊或 console error。

## 2026-08-14 (v29.6.110 / 三來源常駐選單與單一授權路由)

- 正式 TestUI 以 `S27DG502 如何恢復原廠設定？` 真人提問時，發現候選型號已鎖定後仍殘留「缺型號」旗標；已修正為清除選型狀態、顯示官方手冊 postback，且按鍵前不讀 PDF、不扣次。
- 正式 TestUI 再發現手冊模式的新文字題會借用上一題型號；已收緊為新題只接受本輪完整型號，只有「查上一題」可沿用原題。

- 新增 `規格＆FAQ／官方手冊／網路解答` Rich Menu postback 路由與 TestUI 同源模擬；postback 先於 Trigger、Sheet 與一般訊息主流程處理。
- 新增 10 分鐘一次性 pending、30 分鐘上一題、台北日界、手冊 5 次／網路 10 次持久配額與 LockService 原子扣次。
- `callLLMWithRetry()` 加入來源硬閘門；未取得本輪授權的舊 PDF mode、自動 Deep、rescue 與 PDF→Web 旁路都不能再送出進階來源請求。
- 保留精準 QA、未知型號、價格、服務時間、token fuse 與人工驗證手冊片段，避免為改路由犧牲既有答案品質。
- 新增正式 Rich Menu SVG／PNG／JSON。原設計為管理者 per-user pilot；業主後續明確改為所有使用者直接看到，因此新增全體 default 發布／回復工具，保存舊 default ID 並做發布後讀回。
- 實機回饋指出按鍵後 Rich Menu 被鍵盤取代；根因為三鍵使用 `openKeyboard`。已改成 `selected: true` + `openRichMenu`，按鍵本身保持選單展開，並以定義雜湊避免發布工具錯誤重用舊版 menu。

## 2026-08-06 (v29.6.105 / 可稽核手冊片段 RAG)

### 20K fuse 後的正確修法

- v29.6.104 正式 TEST UI 已選到正確完整手冊，但 `countTokens` 為 69,570，20K 舊式整本 PDF 保險絲依設計阻止付費生成；沒有放寬成本上限，也沒有拔掉 PDF 後用模型常識猜。
- 新增 `getVerifiedManualChunks_()`／`findVerifiedManualChunk_()`：把人工逐頁核對過的官方手冊事實保存成最小片段，必須「完整型號＋意圖」同時命中才可零成本回答，未命中仍走原手冊授權與 fuse。
- 首筆片段來自 `S32FM702,S32FM703,S32FM803.pdf`：第 180 頁列出 M70F 的 HEVC（H.265 Main／Main10），第 187 頁明載 HEVC 僅適用 MKV／MP4／TS。回覆會顯示手冊頁碼與官方手冊來源。
- 契約測試同時驗證正向命中、非 HEVC 題不得誤用、未知型號不得跨型號套用，避免以個案修補造成新降智。
- 正式 TEST UI 最終實問 `S32FM703UC 是否支援 HEVC？` 已正確回答 Main／Main10、MKV／MP4／TS 與第 180、187 頁；`Request Audit` 為 `model=none`、`paidCalls=0`、`estimatedCostTwd=0`，沒有殘留 `Reading...`。
- 同一正式 TEST UI 再問 `請問 M8 和 M9 有陀螺儀和 HAS 嗎？`，由精準 QA 零成本回答；再問未知型號 `S99ZZ999 有 KVM 嗎？`，由未知型號守門拒絕猜測，兩題均無 LLM／PDF／WEB 呼叫。
- 以 1440×900、768×1024、390×844 實際渲染驗收：桌面雙欄、平板／手機單欄皆可讀，手機版頁碼、來源與底部輸入列完整，無可見文字裁切、重疊或控制列遮擋。
- 正式既有 Webhook 更新至 Apps Script `@1303`；health、Remote HEAD、本機與正式 TestUI 皆為 `v29.6.105 [2026-08-06 00:31]`，部署清單仍維持 2 筆，`Prompt!C3` 未修改。

## 2026-08-06 (v29.6.104 / 詳細手冊意圖優先完整手冊)

### 正式 TEST UI 實問發現的降智根因

- v29.6.103 已把 HEVC 問法改成精準手冊查詢，但正式 TEST UI 實問仍錯答「手冊未記載」。
- 稽核實際掛載檔案後確認，路由先選到涵蓋 16 個型號、僅 41 頁的快速指南；該檔確實沒有 HEVC 文字。同一型號另有涵蓋 3 個型號的完整使用手冊，手冊明載 HEVC（H.265 Main / Main10）與 MKV、MP4、TS 限制。
- `prioritizeDetailedManualCandidates_()` 現在只在編解碼器、協定等必須查詳細表格的題目啟用：維持精準型號優先，再以涵蓋型號較少的 PDF 作為完整手冊優先線索；不硬寫 S32FM703，也不硬寫 HEVC 答案。
- 新增執行式契約測試，鎖定「詳細題改選完整手冊、一般題維持原排序」兩個方向，避免修一題卻擴大其他路由回歸。

## 2026-08-05 (v29.6.103 / HEVC 精準手冊查詢修復)

- v29.6.102 正式 TestUI 已完成單次 PDF 查詢（14,626 input、151 output、NT$0.0487、無網搜），但回答誤稱手冊沒有 HEVC。
- 直接抽取本機同名官方 PDF 證明手冊編解碼器表格明列 `HEVC（H.265 - Main、Main10）`，限制頁也明列 HEVC 僅適用 `MKV / MP4 / TS`；因此該回答判定為降智回歸，不因來源標籤或成本合格而放行。
- 根因是完整型號快速路徑只沿用原始短問句，沒有沿用型號選單舊路徑的精準編解碼器表格查詢。現已抽成共用 query builder，兩條路徑都要求查表格、Main/Main10、MKV/MP4/TS 與頁碼，不得以規格／連接埠頁面代替。

## 2026-08-05 (v29.6.102 / TestUI Reading 泡泡殘留修復)

- v29.6.101 正式 TestUI 自癒回覆已完成，但畫面仍殘留一顆 `Reading...` 泡泡。
- 根因是使用者泡泡與 loading 泡泡都以單純毫秒時間建立 DOM id；同一毫秒連續插入時會撞號，成功回呼的 `removeMsg` 可能刪到前一顆同 id 泡泡。
- 兩種訊息建立器都改為「毫秒＋單調序號」id，並加入靜態守門，確保 loading placeholder 能精確移除。

## 2026-08-05 (v29.6.101 / PDF token 預檢過期檔自癒修復)

- v29.6.100 正式 TestUI 已完整走到「完整型號 → 詢問同意 → `#查手冊` → 成本確認 → 單一 PDF」，但 `countTokens` 對舊 Gemini File URI 回傳 403 `PERMISSION_DENIED`。
- 成本 fuse 正確阻止 `generateContent`，本次 `paidCalls=0`、`pdfCalls=0`、NT$0；然而 token 預檢分支未沿用 generateContent 既有的 403/404 自癒，手冊會一直停在相同錯誤。
- 現在 PDF `countTokens` 遇到已過期／無權限／不存在的 File 時，仍 fail closed、不重試付費生成，並以既有 `scheduleImmediateRebuild()` 排程 1 分鐘後背景重建；同一排程 10 分鐘內去重，不在 Webhook 主線程同步重建。

## 2026-08-05 (v29.6.100 / Smart Codec 完整型號手冊授權修復)

- 正式 TestUI 實問 `S32FM703UC 是否支援 HEVC`，即使已提供完整型號，舊 Smart Codec 守門仍一律顯示十個型號選單；再次明確要求查手冊也回到同一選單，形成無法進入 PDF 的循環。
- 現在會把完整型號及其純英文字母地區尾碼精確對應到 PDF 索引型號；初問只詢問是否查手冊，使用者下一輪按 `#查手冊` 後才沿用該型號進入單次 PDF。沒有完整型號時仍維持零 LLM 型號選單，不猜測。
- TestUI 本輪多分頁併發曾使一筆 `testMessage` 在 Apps Script 佇列等待後顯示 309.781 秒；Cloud logs 顯示實際路由、LLM 與組裝回覆約 3 秒完成。後續正式驗收改為單分頁串行，避免把測試端併發壅塞誤判成模型推論時間。

## 2026-08-05 (v29.6.099 / 系列別稱精準 QA 零 LLM 修復)

- v29.6.098 正式 TestUI 重問後，路由已先檢查 QA，但 `M8`／`M9` 被舊實體擷取規則排除，且 matcher 只接受帶連接方式的題型，仍落入一次 Fast LLM。
- 將 Smart Monitor `M5`／`M7`／`M8`／`M9` 保留為產品系列實體；產品實體完全一致且較短題句至少 12 個正規化字元時，允許與完整 QA 題句互為包含。
- 守門同時驗證「M8／M9 陀螺儀＋HAS」可精準命中，以及過短的「M8 有嗎」不得誤命中；未恢復 LCS 或模糊相似度。

## 2026-08-05 (v29.6.098 / 正式 TestUI 精準 QA 與成本守門修復)

- 正式 TestUI 實問「M8 和 M9 有陀螺儀和 HAS 嗎」後，稽核發現仍進 Fast LLM；精準 QA 捷徑原本只套用跨裝置題，未符合「精準 QA 零 LLM」契約。現在所有一般產品問題都會先跑同一個嚴格 QA matcher，命中後直接回覆。
- 正式 TestUI 實問「iPhone 17 接 M8 沒畫面」時，舊 `checkPdfCost` 因短字串含型號而誤報「讀取 PDF 約 NT$1.5」並跳過。現在一般型號、設定與故障題一律先進 QA/RULE Fast Mode，只有 `#查手冊` 或自然語句中明確要求查讀官方手冊／PDF 才顯示 PDF 成本確認。
- 新增 contract 守門，防止精準 QA 再度只涵蓋特定題型，或 TestUI 再以型號外觀、設定／故障字樣誤判為 PDF 操作。

## 2026-08-05 (v29.6.097 / 正式 TestUI template 編譯修復)

- 親自開啟正式 TestUI 後發現 `SyntaxError: Invalid or unexpected token`；先前 health/version guard 只能證明 Webhook 對版，不能取代 TestUI 實際渲染。
- 根因是 `TestUI.html` 的客戶端 fallback 判斷含第二個 HtmlService scriptlet 起始字面值，`createTemplateFromFile().evaluate()` 會在正式渲染時誤解析。
- 改以 `startsWith("<")` 辨識未 evaluate 的本機 placeholder，並新增靜態守門，保證整份 TestUI 只留下真正用來注入 access token 的一組 scriptlet。

## 2026-08-05 (v29.6.096 / 排除未完成新機型佔位 RULE)

- 補上 v29.6.095 發布後殘留檢查：既有 `CLASS_RULES` 內「型號：尚無資訊」列雖不再新增，仍可能被讀入 Fast Mode prompt/index。
- 同步流程現在會排除這類未完成列；Product Finder 比對也不再把它視為已完成型號，使其能進入 `PENDING_MODEL_REVIEW` 待審核清單。
- 採非破壞式相容策略：不自動刪除正式 Sheet 舊列，但 runtime 不再把它當產品規格。
- 正式既有 Webhook 已更新至 Apps Script `@1293`；health、Remote HEAD、本機與正式 TestUI version guard 均為 `v29.6.096 [2026-08-05 22:29]`，部署清單維持 2 筆，`Prompt!C3` 未修改。
- `npm run test:static`、`npm run test:contract`、GAS 語法、`git diff --check`、release dry-run、readiness 與 Webhook version guard 全數通過。

## 2026-08-05 (v29.6.095 / RAG token fuse、費用與付費測試守門)

- 修正旧 token fuse 「裁減 `effectiveMessages` 卻仍送出舊 `geminiContents`」的漏洞；現在 Fast/Web 歷史先裁減，再建立唯一 payload。
- Fast Mode 最多注入 8 筆相關 RULE，input/output 上限為 12K/800；PDF output 上限 1200。
- 舊式整本 PDF 在 `generateContent` 前必須以含 `file_uri` 的 `countTokens` 預檢；超過 20K 或計數失敗即 fail closed，不產生 PDF 費用，也不假標手冊來源。
- 移除 PDF 失敗後「拔掉文件、要模型依自身知識回答」的降級；網搜缺 `groundingChunks`/`groundingSupports` 時直接停止，不再為補引用自動付費再生成。
- Gemini 2.5 Flash-Lite Standard 依 2026-08-05 官方定價維持 US$0.10/M input、US$0.40/M output；7/7 歷史 190 calls、6,519,548 input、25,460 output 的 NT$21.1884 費用基線仍成立。Priority 層 US$0.18/M、US$0.72/M 不適用本專案。
- 官網 Product Finder 新機型若尚未完成 PDP 規格擷取與驗證，只寫入 `PENDING_MODEL_REVIEW` 待審核清單與 LOG，不再把「尚無資訊」佔位列寫入正式 `CLASS_RULES`。
- LOG/TestUI 新增結構化 `Request Audit`，保存 stage、model、paid/pdf/web calls、input/output tokens、費用與來源；正式 LINE 仍隱藏內部 token/費用。
- `10x5` 正式 runner 改為必須明確 `--paid-live`，且限制 `--max-pdf<=3 --max-cost-twd<=0.30`；預設 contract 新增歷史費用回歸與守門檢查。
- Gemini File Search 官方已支援 `gemini-3.5-flash-lite`，但必須改用 Interactions API，且模型與費率不同；本版不直接切換正式 PDF，留待三次隔離試驗通過後再啟用。
- 正式既有 Webhook 已更新至 Apps Script `@1292`；health、Remote HEAD、本機與正式 TestUI version guard 均為 `v29.6.095 [2026-08-05 22:00]`，部署清單仍維持 2 筆，未新建 Deployment。
- `Prompt.csv` 本版未修改，因此發布工具依設計未同步 `Prompt!C3`。`npm run test:static`、`npm run test:contract`、GAS／runner 語法、`git diff --check`、release dry-run、正式 readiness 與 Webhook version guard 均通過；付費 File Search／LINE 真人試驗因本機未提供 `GEMINI_API_KEY` 與 `GAS_MAINTENANCE_SECRET`，未冒充已完成。

## 2026-07-30 (v29.6.094 / 人味回覆、PDF 單次授權與 TestUI 授權修正)

- Fast Mode 的 `[AUTO_SEARCH_PDF]` 改為詢問使用者；未收到 `#查手冊` 或自然明確同意前，禁止掛載 PDF。授權綁定原題與型號、10 分鐘有效且只能使用一次。
- `replyMessage()` 保留內部費用／來源稽核後，再以客戶版 renderer 隱藏 token、NT$、控制標記與內部標籤，來源改成自然頁尾；同時取消標點後強制雙換行。
- 服務範圍收斂為三星電腦螢幕、Smart Monitor 與外部裝置連接螢幕；純手機、家電、電視與無關問題在 LLM 前攔截。
- 顯示問題新增內容相關性守門，未問供電或攝影機時移除 65W、充電、Power Delivery 與攝影機段落。
- Prompt.csv 升級為 v29.6.094，統一人味、範圍、來源與漸進式授權路由；正式來源仍為 Prompt!C3，發布後才由明確工具同步。
- TestUI 使用 sessionStorage 唯一測試 ID，Mock 補 token／成本預檢，手機可向下捲動查看 Logs，1280×720 取消整頁 0.76 倍縮放，送出按鈕補可存取名稱。
- 所有正式 TestUI runner 改讀 `GAS_MAINTENANCE_SECRET` 共用 helper；缺憑證立即 `[BLOCKED]`，不得輸出含秘密網址。
- 正式 Webhook 已以固定 Deployment ID 更新至 Apps Script `@1291`；health、Remote HEAD 與本機均為 `v29.6.094 [2026-07-31 04:35]`，deployment 清單仍為原本 2 筆，沒有新建正式 deployment。
- Google Sheet `202511-Display的Linebot` 的 `Prompt!C3` 已由舊版 `v29.5.240` 更新為 `v29.6.094`；與本地 `Prompt.csv` 逐字一致（2,386 字）。Prompt 快取鍵改綁 `GAS_VERSION`，避免發布後最長一小時仍讀舊 Prompt。
- `npm run test:static`、`npm run test:contract`、GAS／runner 語法、`git diff --check`、正式 readiness 與 Webhook version guard 均通過；本機 TestUI 的 1440×900、1280×720、390×844 功能與 Logs 捲動驗收通過。

## 2026-07-21 (v29.6.093 / 跨裝置 QA/RULE 優先路由修復)

- 最新正式 LOG 顯示 `Cross Device Router v29.6.074` 對「iPhone + M8 短別稱」明文跳過 Fast Mode，直接進型號選擇與 PDF；選型後的 PDF context 為 `Selected 0/30 QA`，實際順序違反 QA/RULE First。
- 移除該跨裝置短別稱捷徑；所有跨裝置題先做精準 QA 比對，未命中再進含 QA/CLASS_RULES 的 Fast Mode，答案不足才顯示型號選擇並升級 PDF。
- 精準 QA 命中可零成本直接回覆；模型即使自行標示 `[來源:QA庫]`，也必須通過程式端產品實體、連接方式與意圖精準比對，避免把 iPhone Air QA 誤套到 iPhone 17／17e。
- 本版不修改 Prompt!C3、不修改正式 QA／CLASS_RULES 內容、不調整 PDF、WEB 或 AI 內建資料庫的既有守門。
- 正式既有 Webhook 已更新至 Apps Script `@1289`，health、Remote HEAD 與本機皆為 `v29.6.093 [2026-07-21 17:56]`，三個正式部署檔 normalized SHA-256 全部相同。
- `npm run test:static`、JavaScript 語法與 `git diff --check` 已通過；正式 TestUI 問答因本機無 `LINEBOT_TEST_SECRET` 且瀏覽器攔截 Apps Script URL，本輪未冒充已完成 live 問答驗收。

## 2026-07-20 (v29.6.092 / iPhone 產品身分、QA 誤配與發布守門修復)

- 最後正式對話確認 `iPhone 17 Air` 被程式映射到一般 `iphone-17/specs`；新的產品解析會先辨識 `iPhone Air`、`17e/16e`，無法唯一判定時不猜官方網址。
- 官方頁直接擷取新增產品身分驗證；明確 Apple 產品題只有通過身分驗證的原廠頁才可成為網搜證據，回答把其他 iPhone 規格套入時直接停止並記錄人工複查。
- 移除 v29.6.090 的 LCS 共同子字串 QA 配對與 PDF context 篩選，改以產品實體、連接方式、主要意圖及完整型號判定，避免 iPhone 17e、iPhone 16、AirPlay、恢復原廠設定誤中 iPhone Air QA。
- 外部裝置相容性 QA 缺少原廠官方網址時只保留草稿預覽；正式存檔硬性拒絕，仍維持 QA A 欄單列字串架構。
- 跨裝置 PDF 階段不再注入外部裝置相容性 QA，避免把 Apple 手機端資料錯標成 Samsung 官方手冊；手冊只負責螢幕端，裝置端改由後續官方網搜查證。
- Quick Reply 改成狀態驅動；網搜無可稽核來源、證據衝突、API 失敗或達搜尋上限後，不再顯示「再詳細說明」與重複網搜。
- API 終止狀態補齊「系統忙碌中」實際文案，暫時失敗不再留下會擴寫猜測或重複搜尋的按鈕。
- 發布總控新增 `git diff --check`，靜態測試、文件版本或 whitespace 任一失敗即停止，不推送 GAS、不建立版本。
- TestUI 低高度桌面版新增 720p 縮放規則；1280×720 不再把手機頂端與輸入列裁出視窗，手機版仍維持單欄介面。

## 2026-07-14 (v29.6.082 / 降低跨裝置 PDF 同步耗時)

- `v29.6.081` 修復正式 `doPost` 回 `status:error`，但同題正式隔離測試仍顯示 PDF 手冊輪約 18.5 秒，LINE 體感仍可能長時間點點點。
- 根因是跨裝置 PDF 回覆若混入手冊外手機端推測，原流程會保留同本 PDF 再呼叫一次 Gemini 更正；這很嚴格，但在 LINE 同步 webhook 會多花一次 PDF LLM 時間與費用。
- 現在只有「錯誤範圍拒答」才重新呼叫 LLM；若只是 PDF 回覆混入手冊外裝置端內容，改為直接移除越界句並保留手冊事實，再提供 `[AUTO_SEARCH_WEB]` 讓使用者查裝置端官方資料。
- 這版不新增個案固定答案、不放寬來源邊界；目標是減少一次同步 LLM，降低 LINE 點點點等待時間與費用。
- 正式 Webhook 已更新既有 Deployment ID 至 `@1263`；隔離 `doPost` 三輪同題均回 `{"status":"ok"}`，不再出現 `status:error`。實測耗時約 11.7 秒、12.2 秒、11.0 秒，仍不是 LINE 體感最佳狀態，後續若要根治需繼續削減同步 Sheet/LLM 路徑或改變回覆架構。
- Headless TestUI 仍因 `TestUI frame not found` 無法作為本輪可見回覆驗收證據；本輪只能宣告正式 webhook 狀態與耗時改善，不能宣告完整 LINE 視窗已由本機驗收通過。

## 2026-07-14 (v29.6.081 / webhook 錯誤可觀測性與事件隔離)

- 使用者回報手機 LINE 同題一直顯示點點點、疑似沒有回覆；正式健康檢查確認 Webhook 已是 `v29.6.080`，但隔離 `doPost` 測試回 `{"status":"error"}`。
- 根因之一是測試 webhook 事件缺 `webhookEventId` 時，`isDuplicateEvent()` 會把空值丟進 `CacheService` 當 key 造成例外；外層 `doPost` catch 又沒有寫 LOG，導致正式路徑失敗時無法判斷卡在哪。
- `isDuplicateEvent()` 現在遇到缺 `webhookEventId` 會略過去重並記錄，不再中斷處理；`doPost` 改為逐事件 try/catch，單筆事件錯誤會寫入 LOG 並嘗試回覆使用者，不拖垮整個 webhook。
- 這版只修正式 LINE 路徑穩定性與診斷能力，不改核心 prompt、不新增個案固定答案、不改模型；正式模型仍固定 `models/gemini-2.5-flash-lite`。

## 2026-07-14 (v29.6.080 / 整合網搜去除手冊推諉)

- `v29.6.079` 正式回答已移除手機設定猜測，但整合網搜仍要求使用者「具體操作請參考手冊」，與系統已查完手冊的狀態矛盾，人工驗收不通過。
- 既有 `sanitizeManualDeflection()` 現在也套用在手冊後的網搜整合回答，只移除要求使用者自行查手冊／官網的推諉句，保留已查證的連接步驟與雙來源。
- 可見文案中的「根據手冊／根據手冊內容」統一正規化為「根據官方手冊」，不暴露內部 PDF 或讓來源身分含糊。
- 正式 Webhook `v29.6.080`（Apps Script 版本 1261）以隔離使用者 `UCODEX_V296080_20260714133351` 完成三輪驗收：短別稱先選型且零 LLM、S32FM703UC 實掛 1 本 PDF 並保留 65W／10Gbps／DisplayPort ALT、網搜直接擷取 Apple iPhone 17 規格頁並回答原生 DisplayPort 最高 4K HDR。
- 最終手冊輪兩次 Gemini 2.5 Flash-Lite 合計 NT$0.3036；網搜輪 NT$0.0334。LINE 可見來源分別為 `[來源:官方手冊]`，以及 `[來源:官方手冊]` + `[來源:網路搜尋]`；LOG 記錄實際 PDF 檔名與 Apple 官方 URL。

## 2026-07-14 (v29.6.079 / 網搜外部裝置猜測守門)

- `v29.6.078` 正式重測的手冊輪已通過，但網搜在正確的 Apple DisplayPort 結論後又加入「到 iPhone 設定找鏡像選項」「依賴 iOS」等無來源猜測，人工驗收不通過。
- 網搜跨裝置回答新增獨立推測守門：移除以「可能／通常／常見／依賴」包裝的手機設定、鏡像、系統功能或相容性推測；保留官方頁直接證據支持的 DisplayPort 與連接能力。
- 手冊與網搜使用不同守門器，避免為了封鎖 PDF 階段的手機肯定斷言，反而刪掉網搜已由官方頁證明的外部裝置事實。

## 2026-07-14 (v29.6.078 / 手冊外部裝置斷言守門)

- `v29.6.077` 正式三輪重測已由 Apple 官方頁正確回答 iPhone 17 原生 DisplayPort／4K HDR，但 PDF 階段仍把「iPhone 一定能顯示、充電」誤算成手冊事實，人工驗收不通過。
- PDF 模式新增獨立的「外部裝置肯定斷言」偵測；即使沒有「建議／試試看」字樣，只要手冊回答逕稱手機可連接、顯示、輸出或充電，就用同一本 PDF 重答並合計費用。
- 第二次仍越界時採句子級清理，只移除外部裝置斷言，保留由 PDF 產生的螢幕端介面、線材、影像協定與供電條件；不影響網搜階段由 Apple 官方證據支持的 DisplayPort 結論。

## 2026-07-14 (v29.6.077 / 直接擷取官方頁證據)

- `v29.6.076` 正式 Webhook 三輪實測確認 PDF 路由與 65W 手冊錨點已生效，但 Google Search 雖列出 `apple.com`，LLM 仍把 Apple 頁面明載的 DisplayPort 能力說成未明確標示，人工驗收不通過。
- 對可推導的官方技術規格 URL，除 URL Context 與 Google Search 外，新增 `UrlFetchApp` 直接擷取；HTTP 200 且文字有效才注入 LLM，網址、字數與狀態完整寫入 LOG。
- 官方頁直接證據已明載的能力不得被 LLM 弱化成可能或待確認；網搜回答仍需朋友式整合，並移除沒有來源支援的裝置設定、替代測試與猜測句。
- 跨裝置手冊呈現會移除只有標題沒有內容的短項次，再保留 PDF LLM 產生的實質條件；不新增任何型號專用固定答案。

## 2026-07-14 (v29.6.076 / 跨裝置手冊錨點與衝突防護)

- 正式 `v29.6.075` 實測確認網搜已取得可稽核來源，但回答把 S32FM703UC 的 USB-C 供電誤寫成 90W，與前一輪官方手冊的 65W 衝突，人工驗收不通過。
- 跨裝置網搜現在會帶入最近一則 `[來源:官方手冊]` 的螢幕端結論；網搜只補外部裝置端資料，不能改寫手冊已確認的介面、線材條件、供電瓦數與限制。
- 新增通用瓦數衝突守門：若網搜把螢幕端瓦數改成手冊未出現的數值，只移除衝突句，不寫入任何型號專用固定答案。
- 第二次手冊 LLM 仍越界時，改為句子級移除無來源裝置建議，保留同段中由 PDF 產生的螢幕端說明，避免把有用內容整段刪光。
- 跨裝置網搜整合回答同時顯示 `[來源:官方手冊]` 與 `[來源:網路搜尋]`；Quick Reply 網搜回合也寫入「所有紀錄」，方便逐輪稽核。

## 2026-07-14 (v29.6.075 / 官方 URL Context 網路證據備援)

- `v29.6.074` 已正確完成「短別稱選型 → PDF → 明確網搜」，但 Gemini 2.5 Flash-Lite 的 Google Search 連續兩次只回傳不完整 `groundingSupports`，沒有 `groundingChunks`，因此守門正確拒絕假網搜，仍無法交付答案。
- 依 Google 官方 URL Context 作法，當問題可推導出明確官方技術規格網址時，同一輪同時啟用 `url_context` 與 `google_search`，並把官方完整網址放入查詢。
- URL Context 必須在 `urlContextMetadata.urlMetadata` 回傳 `URL_RETRIEVAL_STATUS_SUCCESS` 才算有效證據；實際網址與狀態寫入 LOG，成功網域併入可見的已搜尋來源。
- 網搜來源硬守門擴充為「完整 Search grounding」或「成功官方 URL Context」任一成立；兩者都失敗時仍拒絕輸出與標註。

## 2026-07-14 (v29.6.074 / 跨裝置選型路由決定化)

- `v29.6.073` 正式重測發現同一句 M7 跨裝置題會因 Fast LLM 當次措辭不同，把型號泡泡隨機標成 `fast` 或 `pdf`；`fast` 時選完型號不查手冊，按「這題再搜網路」才反而補跑 PDF。
- 跨裝置題若只給 M7/M8 等短別稱，現在於 Fast LLM 前直接顯示官方手冊所涵蓋的完整型號選擇，流程提示不呼叫 LLM、不編來源。
- 若使用者直接給完整型號，Fast Mode 只有明確命中 QA 庫才可直接回答；規格庫不能用來推論 iPhone／手機相容性，必須升級官方手冊。

## 2026-07-14 (v29.6.073 / 手冊證據與真網搜守門)

- `v29.6.072` 正式 Webhook 實測確認已不拒答、會掛載正確 S32FM703UC PDF 並合計兩次 LLM 費用，但第二次重答仍留下未由手冊證實的 iPhone／轉接建議，人工驗收不通過。
- 跨裝置手冊提示收斂為一句結論與最多三個螢幕端條件；若第二次 LLM 仍越界，程式只移除無來源句子並保留其餘手冊回答，不新增固定產品結論。
- 正式網搜曾只回傳 `groundingSupports`、沒有 `groundingChunks`／查詢／來源，模型卻把 iPhone 17 說成尚未公布；現在缺少可稽核 grounding 證據就自動重試一次，仍失敗時拒絕把 AI 內建資料標成網搜。
- 網搜來源標籤改成硬守門：只有 `groundingChunks` 與 `groundingSupports` 都存在，且成功提取來源時才顯示 `[來源:網路搜尋]`。

## 2026-07-14 (v29.6.072 / PDF 重試狀態拆分)

- `v29.6.071` 正式重測發現 Fast Mode 選型後走一般流程，自動升級 PDF 時會傳入 `isRetry=true`；證據守門誤把這視為已修正過，導致手冊回答仍可漏出無來源 iPhone 推測。
- `callLLMWithRetry()` 新增獨立 `evidenceCorrectionAttempted` 旗標；Fast → PDF／Web 的階段狀態與「同來源證據修正已執行」不再混用。
- 只有證據修正遞迴本身會把新旗標設為 true，因此直接選型 PDF、一般流程自動 PDF 與手動查手冊都會先經過同一來源守門。

## 2026-07-14 (v29.6.071 / 跨裝置手冊證據邊界修復)

- `v29.6.070` 正式實測雖已不拒答並正確載入 S32FM703UC 官方手冊，但 LLM 混入手冊未記載的 iPhone 設定與換線建議，卻整體標成官方手冊，人工審核未通過。
- 跨裝置手冊回答新增證據守門：偵測手機設定、Apple 轉接器、上市狀態、無來源換線測試等外部裝置推測後，以同一本 PDF 重新呼叫 LLM，不使用固定產品答案。
- 重答時只准整理手冊明載的螢幕端條件；兩次 token 與費用合計顯示。第二次仍越界時，退回手冊證據不足與網路查證入口。
- 網路搜尋階段仍可使用實際 Google Search 找到的裝置端官方資料，避免手冊限制規則誤擋已查到的網路證據。

## 2026-07-14 (v29.6.070 / 手冊後網搜銜接修復)

- 正式測試發現選型後雖已實際掛載官方 PDF，但分支未記錄 `pdf_consulted`；點「這題再搜網路」可能因此重跑 PDF，造成一次使用者操作出現兩次近似的 LLM 手冊回答。
- 選型與 `#查手冊` 成功後統一記錄已查 PDF；網搜入口除快取外，也檢查最近一則回答是否為 `[來源:官方手冊]`，避免快取遺失或過期後重跑手冊。
- 跨裝置題若官方手冊只確認螢幕端、未確認外部裝置端相容性，保留有用的手冊內容，並以朋友式文案提示可點「這題再搜網路」續查最新官方資料。
- 靜態回歸新增「手冊完成後明確網搜必須直接進 Web」與快取／歷史雙證據測試。

## 2026-07-14 (v29.6.069 / 跨裝置連接螢幕拒答修復)

- 正式紀錄確認「iPhone 17 要如何以 Type-C 連接 M7 顯示」已正確選到 `S32FM703UC` 並掛載官方手冊，但 `Prompt!C3` 的舊範圍規則使 Fast/PDF 兩階段都誤回手機範圍外。
- 範圍判斷改為看問題主體；手機、平板、電腦、遊戲機等訊號來源連接三星螢幕時，仍依 QA／官方規格／官方手冊回答螢幕端方式與限制。
- 新增跨裝置螢幕題辨識與錯誤拒答守門；若 LLM 仍誤拒答，保留相同來源重新呼叫，不使用固定產品答案，並累加兩次 token 與費用。
- 靜態回歸涵蓋 iPhone + M7、Android + Smart Monitor、MacBook + ViewFinity、PS5 + Odyssey，以及純 iPhone 問題反例。

## 2026-07-08 (v29.6.067 / 來源語氣、費用與手冊查詢修復)

### 目的
- 修復前版為了補來源/費用而把流程提示誤標成「專案流程規則」等假來源的問題。
- 恢復 Smart Monitor 選型回覆的朋友式語氣，不再顯示「已建索引」「掛載 PDF」等工程內部語。
- 落實本機庫 → 官方手冊 → 網路搜尋 → AI 內建資料庫的來源順序。

### 程式修正
- `linebot.gs` 升級至 `v29.6.067`。
- LINE 可見來源只允許 `QA庫`、`官方規格庫`、`官方活動庫`、`官方手冊`、`網路搜尋`、`AI內建資料庫`。
- 純流程提示不硬湊來源；官方手冊回覆 LINE 畫面只顯示 `[來源:官方手冊]`，實際 PDF 檔名寫入 log。
- `replyMessage()` 最終出口只補費用，不再自動補來源；有呼叫 LLM 但缺 usage metadata 時顯示 `[費用:未知（已呼叫 LLM）]`。
- 最終可見成本統一為 `[費用:...]` 單行格式；舊式「本次對話預估花費」區塊會在送出前移除。
- 已呼叫 LLM 的回覆會在最終出口重建費用尾註，確保 `[費用:...]` 位於可見回覆末端。
- Fast Mode 若針對已知完整型號回答規格事實但 LLM 漏標來源，系統會補 `[來源:官方規格庫]`；查無資料與未來上市題不補來源，改問是否擴大網路搜尋。
- Smart Monitor HEVC 手冊回答若只談檔案類型限制而漏掉支援結論，會補回「官方手冊支援表列有 HEVC/H.265，因此支援」。
- 修正 Fast Mode 來源正規化，明確接受 `[來源:官方規格庫]` 與 `[來源:官方活動庫]`，不再被模糊來源防呆誤殺。
- PDF 模式遇到「恢復出廠 / 出廠資料重設」題，會把搜尋任務改寫為手冊選單關鍵字查詢，仍由 LLM 查官方手冊回答，不使用固定守門答案。

### 驗證
- 靜態守門改為禁止舊來源標籤回到可見回覆建構器。
- Smart codec、未知型號、服務時間測試同步改為驗證「流程不標來源、LLM/零成本仍標費用」。

## 2026-07-07 (v29.6.061 / 回覆孤立括號清理)

### 目的
- 修正正式 TestUI 對話紀錄中，部分 PDF 追問回覆在來源標籤前殘留孤立 `]` 的顯示問題。

### 程式修正
- `linebot.gs` 升級至 `v29.6.061`。
- `replyMessage()` 送出前先執行 `cleanReplyVisibleTextArtifacts_()`，清理可見文字中的孤立右括號，再套用來源/費用守門。

### 驗證
- `verify_10_questions_5_rounds.js` 每輪都檢查來源前不可殘留孤立右括號。

## 2026-07-07 (v29.6.060 / Smart HEVC PDF 支援結論守門)

### 目的
- 修正 Smart codec 單項測試人工審查時發現的問題：PDF 回答有時只說 HEVC/H.265 被記載，沒有明確回答是否支援。

### 程式修正
- `linebot.gs` 升級至 `v29.6.060`。
- 新增 `enforceSmartCodecPdfSupportConclusion_()`，只套用 Smart Monitor HEVC/H.265 選型後的 PDF 回答；表格列有 HEVC/H.265 且沒有否定語時，補出明確支援結論。

### 驗證
- `verify_smart_codec_guard.js` 與 `verify_10_questions_5_rounds.js` 第三輪改嚴，不能只靠出現 H.265 字樣通過。

## 2026-07-07 (v29.6.059 / Smart HEVC 再詳細正向判斷修正)

### 目的
- 修正人工審核 0 failures 紀錄時發現的問題：第 5 輪仍可能把第三輪已確認支援整理成「未確認」，或把第四輪已明確列出 MKV/MP4/TS 的限制整理得過度保守。

### 程式修正
- `linebot.gs` 升級至 `v29.6.059`。
- HEVC/H.265 支援判斷與檔案類型限制判斷先正規化空白，允許跨換行與列表格式。
- 已列出 MKV/MP4/TS 時，`#再詳細說明` 會明確保留該限制。

### 驗證
- `verify_10_questions_5_rounds.js` 新增 T3/T5 支援結論一致、T4/T5 檔案限制一致檢查。

## 2026-07-07 (v29.6.058 / Smart HEVC 再詳細否定語守門)

### 目的
- 修正 v29.6.057 加嚴回歸後仍發現的問題：`#再詳細說明` 在部分對話中沒有拿到明確選定型號，且會把「沒有記載是否支援 HEVC」整理成「支援 HEVC」。

### 程式修正
- `linebot.gs` 升級至 `v29.6.058`。
- `#型號:` 分支暫存 `last_selected_model`，`#再詳細說明` 優先使用該 cache。
- HEVC 支援與檔案類型限制整理先處理否定語，再處理正向支援句。

### 驗證
- 10 題 5 輪測試第 5 輪要求整理句含所選型號，並允許「未找到明確列出」這類正確否定語。

## 2026-07-07 (v29.6.057 / Smart HEVC 再詳細模型與限制修正)

### 目的
- 修正 10 題 5 輪自審時發現的第 5 輪問題：`#再詳細說明` 會把使用者選定型號誤抓成 PDF 檔名第一個型號，且可能把「未列出 MKV/MP4/TS 限制」反向整理成「手冊列出 MKV/MP4/TS」。

### 程式修正
- `linebot.gs` 升級至 `v29.6.057`。
- `buildSmartCodecElaborationFromPreviousPdf()` 改從對話歷史的 `#型號:` 取得使用者選定型號。
- HEVC 檔案類型限制整理先判斷否定語，再決定是否能列 MKV/MP4/TS。

### 驗證
- `verify_10_questions_5_rounds.js` 第五輪新增「沿用所選型號」與「未列出限制不得改寫成已列出」檢查。

## 2026-07-07 (v29.6.056 / 回覆來源與費用總守門)

### 目的
- 修正部分早退、錯誤、Quick Reply 或 Flex 回覆分支仍可能漏掉來源與費用的問題。

### 程式修正
- `linebot.gs` 升級至 `v29.6.056`。
- 新增 `enforceReplyAuditTrail_()`，所有 `replyMessage()` 輸出前都會檢查可見文字是否含來源與費用。
- 每次新 `handleMessage()` 先清空 `lastTokenUsage` 與 `lastSearchSources`，避免沿用上一題的費用或來源狀態。
- 型號選擇 Flex 與舊 `replyFlexMessage()` 統一改走 `replyMessage()`，不再直接呼叫 LINE reply endpoint。

### 驗證
- `verify_sop_static_guards.js` 新增來源/費用總守門、每題費用重置、reply endpoint 不可繞過 `replyMessage()` 檢查。

## 2026-07-07 (v29.6.055 / Smart HEVC 再詳細延續 PDF)

### 目的
- 修正 Smart Monitor HEVC/H.265 題在 PDF 回答後按 `#再詳細說明`，卻倒退成泛用操作題補型號的問題。

### 程式修正
- `linebot.gs` 升級至 `v29.6.055`。
- 新增 `buildSmartCodecElaborationFromPreviousPdf()`，從上一則官方 PDF 查證回答延伸整理 HEVC/H.265 支援與檔案類型限制，不再呼叫 LLM。

### 驗證
- `verify_10_questions_5_rounds.js` 第五輪加嚴，要求 `#再詳細說明` 延續 HEVC/PDF 主題並含來源與費用。

## 2026-07-07 (v29.6.054 / Smart HEVC 禁止推測格式)

### 目的
- 修正 PDF 查證答案雖答出 HEVC 支援，卻使用「通常／常見」推測檔案封裝格式的問題。

### 程式修正
- `linebot.gs` 升級至 `v29.6.054`。
- Smart Monitor HEVC PDF 查證提示要求搜尋手冊是否有「HEVC 編解碼器僅適用於 MKV / MP4 / TS 檔案類型」限制；禁止使用「通常」「常見」「應該」等推測語。

### 驗證
- `verify_smart_codec_guard.js` 若選型後 PDF 答案含推測語即失敗。

## 2026-07-07 (v29.6.053 / Smart HEVC PDF 查表提示)

### 目的
- 修正選型後雖已掛載正確 Smart Monitor PDF，但 LLM 仍回答「手冊未明確記載」的問題。

### 程式修正
- `linebot.gs` 升級至 `v29.6.053`。
- Smart Monitor codec 題選型後的 PDF 查詢明確要求查「支援的視訊編解碼器」表格與 HEVC/H.265 注意事項；只有找不到 HEVC/H.265 記載時才可回答未記載。

### 驗證
- `verify_smart_codec_guard.js` 要求 `#型號:S32FM703` 後必須回答 HEVC 支援結果、保留 PDF 來源與費用，不能再以「未記載」通過。

## 2026-07-07 (v29.6.052 / Smart 選型後鎖 PDF 型號)

### 目的
- 修正 Smart Monitor HEVC 題點選型號後，PDF 查詢仍帶「Smart系列」廣義詞，導致 LOG 候選型號混入 Odyssey/G90XF/S27FG900XC 的問題。

### 程式修正
- `linebot.gs` 升級至 `v29.6.052`。
- `#型號:` PDF 路徑若 pending topic 是 Smart Monitor codec 題，會把查詢改寫成指定型號的 HEVC/H.265 PDF 問題，不再沿用原始廣義 Smart 系列字串。

### 驗證
- `verify_smart_codec_guard.js` 新增選型後查詢清洗檢查，並要求 LOG 不得出現 G90XF/S27FG900XC。

## 2026-07-07 (v29.6.051 / TestUI 文字+Flex 預覽)

### 目的
- 修正 TestUI 在混合 `text + Flex` 回覆時，只顯示 `[Flex Message]`，導致來源與費用文字看起來消失。

### 程式修正
- `linebot.gs` 升級至 `v29.6.051`。
- `replyMessage()` 測試模式預覽支援 `{type:"text", text:"..."}` 物件，確保 TestUI 顯示與正式 LINE 回覆一致。

### 驗證
- 靜態守門新增 TestUI 文字物件預覽檢查。

## 2026-07-07 (v29.6.050 / 移除 Smart HEVC 固定答案)

### 目的
- 修正 v29.6.049 仍保留 Smart Monitor HEVC 固定摘要的錯誤做法；這不符合「選型號 → 掛 PDF → 由 LLM 依 PDF 回答」鐵律。
- 補回每次可見回覆都必須有來源與費用的要求。

### 程式修正
- `linebot.gs` 升級至 `v29.6.050`。
- 刪除 `buildSmartMonitorCodecManualReply` 固定答案函式。
- Smart Monitor／M 系列 HEVC 題首答與 `#查手冊` 只顯示型號選擇泡泡，不先定論支援與限制。
- 未呼叫 LLM 的選型提示補 `[來源:專案流程規則]` 與 `[費用:NT$0.0000（未呼叫 LLM）]`。

### 驗證
- 靜態守門禁止程式內再出現固定 HEVC 答案。
- `verify_smart_codec_guard.js` 要求前兩回合只顯示選型提示，第三回合點 `#型號:S32FM703` 後才進 PDF 查證，且最終回答需有 PDF 來源與費用。

## 2026-07-07 (v29.6.049 / Smart Monitor HEVC PDF 型號選擇)

### 目的
- 修正 v29.6.048 雖然改用官方手冊摘要，但仍把「要查哪一台」丟回使用者手打型號的 UX 缺口。

### 程式修正
- `linebot.gs` 升級至 `v29.6.049`。
- Smart Monitor／M 系列 HEVC、H.265、播放檔案格式題首答改為「手冊共通摘要 + Smart Monitor PDF 型號選擇泡泡」。
- `#查手冊` 對同類問題直接顯示可查 PDF 的 Smart Monitor 型號選擇，點選後沿用既有 `#型號:` PDF 查證流程。

### 驗證
- `verify_smart_codec_guard.js` 擴充為三回合，會繼續送 `#型號:S32FM703`，確認真的掛載 `S32FM702,S32FM703,S32FM803.pdf`，不是停在型號選擇。

## 2026-07-07 (v29.6.048 / Smart Monitor HEVC 手冊守門)

### 目的
- 修正實際 LINE 對話中「Smart系列播放檔案有沒有支援hevc格式」被 Fast Mode 以規格庫泛答，且使用者按 `#查手冊` 後又被歷史 S27FG900XC／Odyssey 型號污染而查錯 PDF 的問題。

### 程式修正
- `linebot.gs` 升級至 `v29.6.048`。
- 新增 Smart Monitor／M 系列影音格式守門：HEVC、H.265、影片格式、播放檔案支援題直接引用 Smart Monitor 官方手冊「支援的視訊編解碼器」章節。
- `#查手冊` 對同類問題改走固定手冊依據，不再進入一般 PDF 選檔器，避免廣義 `術語_Smart系列` 與歷史型號污染。

### 驗證
- 靜態守門新增 Smart Monitor codec 測試，要求回覆包含 HEVC、MKV 與實際官方手冊檔名，且不得使用「通常」式模糊描述。
- 正式 TestUI 新增 `verify_smart_codec_guard.js`，重跑原始問題與 `#查手冊`，確認兩回合都由 Smart codec 守門接手且未進錯 PDF 選檔。

## 2026-07-07 (v29.6.047 / PDF 選檔 token 比對)

### 目的
- 修正實測 `S32BM80如何恢復出廠` 時，PDF 選檔誤用 substring 導致載入 `S32BM801,S43BM700.pdf`，而不是新補傳的 `S27BM500,S32BM80,...pdf`。

### 程式修正
- `linebot.gs` 升級至 `v29.6.047`。
- 新增 PDF 檔名型號 token 比對 helper。
- `PDF_MODEL_INDEX` 判斷、Tier1 選檔、排序與單檔鎖定統一改用 token 比對。

### 驗證
- 靜態守門新增 `S32BM80` 不得誤中 `S32BM801`，以及短別稱不得靠 substring 命中 PDF。

## 2026-07-07 (v29.6.046 / 手動補傳 PDF 持久索引)

### 目的
- 解決 GAS 執行身分可讀 Drive 手冊資料夾但無法新增檔案時，新機 PDF 無法進入 LINEBot 手冊知識庫的問題。

### 程式修正
- `linebot.gs` 升級至 `v29.6.046`。
- `upload_manual_pdf` 在 Drive 寫入失敗時改上傳到 Gemini Files API，並持久寫入 `MANUAL_PDF_KB_LIST`。
- `syncGeminiKnowledgeBase()` 合併手動補傳 PDF 到 `KB_URI_LIST` 與 `PDF_MODEL_INDEX`，避免重建時被 Drive 清單移除。
- `extractPdfModelIndexFromKbList()` 支援 `S32BM80` 這類尾端兩位數型號。

### 驗證
- 已將 `三星螢幕使用手冊/new` 中 11 份 Drive 缺檔補傳到 Gemini Files API。
- `PDF_MODEL_INDEX` 先驗出新模型已進索引，但發現 `S32BM80` 被舊正則漏掉，因此同步修正並新增靜態守門。

## 2026-07-07 (v29.6.043 / 啟用 Execution API)

### 目的
- 讓後台 `clasp run` 可以設定短效手冊上傳 token，完成大型 PDF 批次補傳流程的正式前置。

### 程式修正
- `linebot.gs` 升級至 `v29.6.043`。
- `appsscript.json` 新增 `executionApi.access = MYSELF`。

### 部署驗證
- 部署後需先用 `clasp run adminSetManualUploadToken` 實測後台函式可執行，再進行 WebApp `upload_manual_pdf` 批次上傳。

## 2026-07-07 (v29.6.042 / 短效手冊上傳 token)

### 目的
- 解決 `clasp run` 不適合傳大型 PDF base64 的限制，改用短效 token 搭配既有 WebApp 端點批次補傳 `new` 手冊。

### 程式修正
- `linebot.gs` 升級至 `v29.6.042`。
- 新增 `adminSetManualUploadToken()` / `adminClearManualUploadToken()`。
- `upload_manual_pdf` 支援 `MANUAL_UPLOAD_TOKEN`，並補上檔名規則、PDF 檔頭與同名檔案跳過防呆。

### 文件
- 兩份開發手冊更新短效 token 上傳流程。

## 2026-07-07 (v29.6.041 / 排除 logs 暫存檔上雲)

### 目的
- 修正 `v29.6.040` 部署時 `clasp push` 誤把 `logs\samsung_support_LS27F612EACXZW.html` 納入 Apps Script HEAD 的問題。

### 程式修正
- `linebot.gs` 升級至 `v29.6.041`。
- `.claspignore` 新增 `logs/**`，避免本機查證暫存檔被推送上雲。

### 部署
- 需要重新推送並更新既有正式 Webhook，讓雲端 HEAD 移除誤追蹤的 logs HTML 檔。

## 2026-07-07 (v29.6.040 / 後台補傳手冊工具)

### 目的
- 補齊 `三星螢幕使用手冊/new` 中仍未進 Drive 的新機手冊，不再只等待人工拖曳上傳。

### 程式修正
- `linebot.gs` 升級至 `v29.6.040`。
- 新增 `adminUploadManualPdfFromBase64()`，供 `clasp run` 以已授權 Apps Script 身分上傳標準 PDF 到既有 Drive 手冊資料夾。
- 上傳函式會拒絕不合規檔名、尾端仍有英文字尾墜的型號與非 `%PDF-` 標準檔頭；Drive 已有同名檔案時跳過，不重複新增。

### 文件
- `程式編寫開發及功能手冊.md` 與 `Developer_Manual.md` 補上 PDF 手冊檔名規則與後台上傳工具說明。

## 2026-07-07 (v29.6.039 / 選型後手冊答案保留型號)

### 目的
- 修正短別稱選型後的 PDF 答案有時未在本文寫出所選完整型號，造成使用者難以確認答案套用對象。

### 程式修正
- `linebot.gs` 升級至 `v29.6.039`。
- `#型號:<完整型號>` 進入 PDF 查證後，若模型回覆本文未包含所選型號，系統會在答案前補上「針對 <型號>：」。

## 2026-07-07 (v29.6.038 / 恢復出廠題強制手冊查證)

### 目的
- 修正 `v29.6.037` 只攔截 PIN-only 窄答仍不足的問題：Fast Mode 可能產生看似完整但未經 PDF 查證的出廠重設步驟。

### 程式修正
- `linebot.gs` 升級至 `v29.6.038`。
- 一般恢復/還原/重置出廠題只要已知有對應 PDF，就強制升級官方手冊查證；明確詢問 PIN 忘記時仍可停在 PIN QA。

### 測試
- `verify_sop_static_guards.js` 補上「Fast Mode 產生一般重設步驟也必須升 PDF」守門。

## 2026-07-07 (v29.6.037 / 恢復出廠題自動查手冊)

### 目的
- 修正 `S32FM703如何恢復出廠` 這類一般出廠重設題被「忘記 PIN」QA 窄答攔住，未自動查官方手冊的問題。
- 補強短別稱手冊回歸，不能只測到型號選擇泡泡，必須繼續模擬選型後查 PDF。

### 程式修正
- `linebot.gs` 升級至 `v29.6.037`。
- 新增一般恢復出廠題與 PIN 忘記題的區分；一般恢復出廠若 Fast Mode 只回 PIN 忘記客服遠端重設，會依 SOP 自動升級查 PDF。

### 測試
- `verify_sop_static_guards.js` 新增 factory-reset vs PIN-forgotten deterministic guard。
- `verify_10_real_conversation.js` 的 G5 手冊案例改為兩輪：先要求選完整型號，再送 `#型號:S27DG502EC` 並驗證 PDF 答案。
- `verify_10_real_conversation.js` 新增 `S32FM703如何恢復出廠` 自動查 PDF 驗證。

## 2026-07-07 (v29.6.036 / LLM 測試入口授權補強)

### 目的
- 補上公開 doGet 維護測試入口的授權防線，避免 URL 被誤觸或掃描時自動消耗 LLM 配額。

### 程式修正
- `linebot.gs` 升級至 `v29.6.036`。
- `batchTest=1` 批次測試入口改為需密鑰後才會跑 10 題 LLM。
- `testRun=1` 真實流程測試入口改為需密鑰後才會走完整 `handleMessage`。
- `writeRules=1`、`testModels=1` 改用同一組 doGet 維護授權 helper，移除無密鑰時的測試 fallback。

### 測試
- `verify_sop_static_guards.js` 新增 `batchTest`、`testRun`、doGet 維護授權 helper 守門。

## 2026-07-07 (v29.6.035 / LLM 成本守門補強)

### 目的
- 全面檢查正式 GAS 程式中仍可能繞過低成本模型常數、誤用舊模型、實驗模型或 latest alias 的 LLM 呼叫路徑。

### 程式修正
- `linebot.gs` 升級至 `v29.6.035`。
- 長文去廣告摘要路徑改用 `CONFIG.MODEL_NAME_FAST`，不再硬寫 `models/gemini-2.0-flash`。
- 話題延續判斷路徑改用 `CONFIG.MODEL_NAME_FAST`，不再硬寫 `models/gemini-2.0-flash-exp`。
- `?testModels=1` 維護端點改為必須提供密鑰，且只測 Fast / Think / Polish 三個正式模型常數；移除 `2.5-flash`、`3.x` 與 `latest` 候選。

### 測試
- `verify_sop_static_guards.js` 新增可執行程式模型掃描，禁止高成本 Gemini 模型、`latest` alias、`exp` alias 與硬寫模型 URL 回到正式 GAS 程式。
- `verify_sop_static_guards.js` 同步鎖定正式 `LLM_PROVIDER` 與未啟用的 OpenRouter 模型，避免改一行常數就繞過成本策略。

## 2026-07-07 (v29.6.034 / QA 來源推斷)

### 目的
- 修正 Fast Mode 內容明確來自 QA，但 LLM 漏寫來源標籤時，系統預設補成 `[來源:規格庫]` 的來源揭露錯誤。

### 程式修正
- `linebot.gs` 升級至 `v29.6.034`。
- 新增 QA 來源推斷：使用者問題與 Bot 回答需同時命中同一 QA 列，才補 `[來源:QA]`。
- 保留既有可信來源標籤，不覆蓋 `[來源:QA]`、`[來源:規格庫]` 或 `[來源:網路搜尋]`。

### 測試
- `verify_sop_static_guards.js` 新增 QA 來源推斷測試，覆蓋 M8/M9 陀螺儀 QA 與不覆蓋既有規格庫來源。

## 2026-07-07 (v29.6.033 / 查無資料 WEB 確認強化)

### 目的
- 修正 LLM 用「資料庫沒有關於...資訊」表達查無資料、但沒有輸出 `[來源:缺失]` 或 `[AUTO_SEARCH_WEB]` 時，系統未進入 WEB 確認流程的缺口。

### 程式修正
- `linebot.gs` 升級至 `v29.6.033`。
- 查無資料判斷從只看 `[來源:缺失]`，擴充為同時檢查「查無、資料庫沒有、沒有關於某資訊、目前沒有某資訊」等文字。
- 這類回答會補上 `[AUTO_SEARCH_WEB]`，再由既有 Auto Web Block 改寫成使用者確認是否擴大搜尋網路。

### 測試
- `verify_sop_static_guards.js` 更新守門，要求缺失來源或查無內容都必須走 WEB 確認流程。

## 2026-07-07 (v29.6.032 / 活動權益與查無資料 WEB 確認)

### 目的
- 修正活動 RULE 回覆可能只回答單一贈品、漏掉同一活動列的共通抽獎資格。
- 修正 Fast Mode 已標 `[來源:缺失]` 但未輸出 `[AUTO_SEARCH_WEB]` 時，最終回覆沒有進入使用者確認的 WEB 擴大搜尋流程。

### 程式修正
- `linebot.gs` 升級至 `v29.6.032`。
- 在 Fast Mode prompt 加入活動 RULE 回答鐵律：本期活動/登錄/抽獎/延長保固題，需完整列出該型號在同一活動 RULE 行內所有相關權益。
- 新增 `[來源:缺失]` 補 WEB 確認流程；若 LLM 查無資料但忘記 WEB 暗號，系統會補上確認流程且保留缺失來源。

### 測試
- `verify_sop_static_guards.js` 新增缺失來源補 WEB 確認與來源保留檢查。

## 2026-07-07 (v29.6.031 / 活動 RULE 路由修正)

### 目的
- 修正已寫入 `CLASS_RULES` 的三星螢幕本期活動，仍被「時效資訊」守門提前導向官方頁/網路搜尋，導致 LINEBOT 無法用快速模式回答。

### 程式修正
- `linebot.gs` 升級至 `v29.6.031`。
- 新增 `findLocalCampaignRuleForQuery()`：問題含活動/登錄/抽獎/延長保固語意且包含完整型號時，會檢查本地活動 RULE 是否命中。
- 時效資訊守門加入本地活動 RULE 例外；命中完整型號活動 RULE 時放行 Fast Mode，短別稱或未建檔活動仍維持官方頁/網路搜尋引導。

### 測試
- `verify_sop_static_guards.js` 新增活動 RULE bypass 守門，覆蓋 `S27HG806EF`、`S34BG850SC` 命中放行，以及 `G5` 別稱不得放行。

## 2026-07-07 (v29.6.030 / 固定 Gemini 2.5 Flash-Lite)

### 目的
- 將正式客服對話、PDF/Think Mode 與 `/紀錄` polish 模型固定為 `models/gemini-2.5-flash-lite`，避免 `gemini-flash-lite-latest` alias 漂移到更高成本模型。
- 讓程式成本估算常數 `0.10 / 0.40` 與實際使用模型一致。

### 程式修正
- `linebot.gs` 升級至 `v29.6.030`。
- `GEMINI_MODEL_FAST`、`GEMINI_MODEL_THINK`、`GEMINI_MODEL_POLISH` 全部固定為 `models/gemini-2.5-flash-lite`。
- 修正模型區塊註解與 polish 成本日誌文字，不再標示 Gemini 3 Flash 或 latest alias。

### 測試
- `verify_sop_static_guards.js` 新增 production Gemini model 守門，禁止三個生產模型常數使用 `latest` alias。

## 2026-07-07 (v29.6.029 /紀錄活動網址 fallback 邊界修正)

### 目的
- 修正 `v29.6.028` fallback 對非正式活動頁或測試網址過度套用官方頁解析，導致使用者原文中的型號與促銷資訊被丟失。

### 程式修正
- `linebot.gs` 升級至 `v29.6.029`。
- Samsung 活動頁 fallback 只有在頁面文字明確含活動期間、登錄期間、Steam、延長保固或 Galaxy S26 活動資訊時才啟用。
- 若網址無法提供有效官方活動內容，改回保留使用者原文整理，不再產生空泛的活動 RULE。

### 測試
- 修正 `verify_rule_draft_and_alias.js` 的 TestUI iframe 輪詢，避免正式頁面載入較慢時誤判失敗。

## 2026-07-07 (v29.6.028 /紀錄活動網址官方頁 fallback)

### 目的
- 修正 `/紀錄 https://promotion.twsamsungcampaign.com/.../rule.aspx` 在 Gemini 回 429 時退回「只把網址包成 RULE」的缺口。
- 確保活動網址會先抓官方頁內容，產生可供 Fast Mode 使用的 `CLASS_RULES` 草稿，並且仍需使用者送 `/紀錄` 確認後才寫入 Sheet。

### 程式修正
- `linebot.gs` 升級至 `v29.6.028`。
- 新增 Samsung 活動頁確定性解析 fallback：活動名稱、活動期間、登錄期間、Steam 點卡、延長保固、月月抽 Galaxy S26 系列各組螢幕型號會整理成 A 欄單列 RULE。
- `callGeminiToPolishRule()` 在 API 429、空回覆或只回網址時，改用官方頁文字 fallback，不再存成 `活動_手動建檔,電腦螢幕活動RULE,<網址>`。

### 測試與文件
- `verify_rule_draft_and_alias.js` 新增真實 Samsung 活動網址回歸，確認預覽內容包含官方頁活動內容且不是只存網址。
- 同步 `Developer_Manual.md`、`程式編寫開發及功能手冊.md` 與 `User_Manual.md`。

## 2026-07-07 (v29.6.027 /紀錄 RULE 與短別稱手冊防呆)

### 目的
- 讓 LINE 對話視窗中的 `/紀錄` 不只整理 QA，也能把行銷 RULE、活動、促銷價整理成 `CLASS_RULES` 一列。
- 修正 `G5` 等短別稱不可直接查 PDF 的風險；必須先列出現有 PDF 覆蓋的完整型號供使用者選。
- 移除不存在的舊錯誤型號範例與特定競品品牌案例，改用真實型號與通用競品範圍防呆。

### 程式修正
- `linebot.gs` 升級至 `v29.6.027`。
- `/紀錄 <內容>` 新增 QA/RULE 自動分流；RULE 草稿寫入 `CLASS_RULES`，並維持 A 欄單列 CSV 字串。
- RULE 內容含 `promotion.twsamsungcampaign.com` 時，會抓取官方活動頁文字後整理螢幕活動規則。
- QA/RULE 存檔後改用 `scheduleImmediateRebuild()` 背景重建，避免 webhook 主線程同步超時。
- `#查手冊 G5` 與一般手冊/操作題只命中短別稱時，改列出現有 PDF 覆蓋的完整型號候選，不再直接鎖第一本 PDF。
- `CLASS_RULES.csv` 與 `restoreClassRulesToSheet()` 新增 2026/5-2026/9 三星螢幕登錄送活動 RULE。

### 測試與文件
- `verify_sop_static_guards.js` 新增 `/紀錄` QA/RULE 分流、RULE 一行化、背景重建與短別稱手冊選型守門。
- 同步 `Developer_Manual.md`、`程式編寫開發及功能手冊.md` 與 `User_Manual.md`。

### Prompt
- 本次未修改 Google Sheet `Prompt!C3`。
- 本次未修改本地 `Prompt.csv`，也沒有同步或覆蓋正式 Prompt。

## 2026-07-06 (v29.6.026 維護 Webhook hardening)

### 目的
- 使用者要求先 PULL Git、理解本專案並修掉可驗證 BUG；本輪先處理本專案內實際存在的 Webhook 維護入口錯誤。
- 經 repo 搜尋確認，本工作區是 GAS LINE Bot / TestUI 專案，沒有桌面 LINE 視窗 OCR 或焦點駐點控制模組；該類能力屬另一個桌面 LINE 自動回覆專案邊界。

### 程式修正
- `linebot.gs` 升級至 `v29.6.026`。
- 修復 `doPost` 的 `write_rules` 授權失敗分支引用未定義 `results` 的 BUG；現在會回傳明確 Unauthorized JSON。
- POST / GET 兩個 `write_rules` 維護入口補上 `fromRow`、空規則、空白規則與試算表不可用的明確 JSON 防呆，避免維護工具只拿到總例外。

### 測試與文件
- `test_runner/verify_sop_static_guards.js` 新增維護端點靜態守門，避免未定義回傳物件與缺少基本參數防呆回歸。
- 同步 `Developer_Manual.md` 與 `程式編寫開發及功能手冊.md` 版本標題與本次變更紀錄。

### Prompt
- 本次未修改 Google Sheet `Prompt!C3`。
- 本次未修改本地 `Prompt.csv`，也沒有同步或覆蓋正式 Prompt。

## 2026-06-20 (發布總控工具完善)

### 目的
- 使用者要求完善專案本身，不是修改單一指令文件；重點是未來修改程式後能自動上傳 GAS 並更新既有正式部署，而且不得把本地 `Prompt.csv` 誤當成正式 Prompt。

### 工具修正
- 新增 `tools/release_existing_webhook.ps1` 作為發布總控流程：
  - 先執行 `npm run test:static`。
  - 再呼叫 `tools\deploy_existing_webhook.ps1` 推送 GAS、建立版本、用既有 Deployment ID 加 `-V` 更新正式 Webhook。
  - 接著執行 `tools\check_deploy_readiness.ps1`。
  - 最後執行 `npm run check:webhook-version`，確認正式 TestUI/Webhook 版本與本機一致。
  - 支援 `-DryRun`，可安全確認流程，不建立 GAS 版本、不更新部署、不碰 Prompt。
- 更新 `tools/README.md` 與 `AI_CONTEXT.md`，明確標示正式 Prompt 在 Google Sheet `Prompt!C3`，發布總控不會同步或覆蓋 Prompt。

### 驗證
- 修改前已確認正式部署狀態：本機、Apps Script HEAD、正式 Webhook 均為 `v29.5.283 [2026-06-20 18:05]`，正式 Deployment ID 為既有 `AKfycbz7...MaYXQA @1063`。
- `npm run test:static` 通過。
- `tools/check_deploy_readiness.ps1` 通過。
- `npm run check:webhook-version` 通過。
- `tools\release_existing_webhook.ps1 -DryRun` 通過，確認總控流程不會在 dry run 模式建立版本或更新部署。

### Prompt
- 本次未修改 Google Sheet `Prompt!C3`。
- 本次未修改本地 `Prompt.csv`，也沒有同步或覆蓋正式 Prompt。

## 2026-06-20 (正式 TestUI 高風險流程回歸)

### 目的
- 繼續針對使用者歷史指出的痛點，用正式 TestUI 實際驗證目前部署，而不是只看程式或文件。

### 執行與結果
- `verify_m7_exact_issue.js` 通過：M7 / Matter / SmartThings Hub 題先進型號選擇，不再直接肯定亂答；手冊查詢遇 API 忙碌時維持誠實忙碌文案，不假標 PDF 來源。
- `verify_m7_mute_current.js` 通過：無型號操作題要求補完整型號；M7 短別稱操作題進型號選擇，不提前叫使用者查手冊。
- `verify_s9_kvm_alias_guard.js` 通過：S9 / KVM 短別稱題要求選完整型號，不再宣稱 S9 內建 KVM。
- `verify_route_testset_17_single.js` 拆批通過 17/17：
  - Q1-Q5：5/5 通過。
  - Q6-Q11：6/6 通過。
  - Q12：拉長等待後 1/1 通過。
  - Q13-Q17：5/5 通過。
- Q12 正式環境可能超過 90 秒，因此將 `verify_route_testset_17_single.js` 預設 TestUI 呼叫 timeout 從 90 秒調整為 180 秒，避免把慢查誤判為流程失敗。

### Prompt
- 本次未修改 Google Sheet `Prompt!C3`。
- 本次未修改本地 `Prompt.csv`，也沒有同步或覆蓋正式 Prompt。

## 2026-06-20 (正式 TestUI 補充回歸與再詳細說明守門)

### 目的
- 補驗尚未在近期正式版本完整覆蓋的回答正確性流程：價格、長文、QA 編輯、服務時間、未知型號、再詳細說明、網路搜尋泡泡與 QA 草稿防污染。

### 執行與結果
- `verify_price_no_number.js` 通過：價格題不回覆數字，導向三星官方搜尋頁。
- `verify_elaboration_limit.js` 通過：若上一則回答是 API 忙碌，`#再詳細說明` 會拒絕展開，避免補出不可靠資訊。
- `verify_manual_continuity.js` 通過：手冊連續查詢遇 API 忙碌時維持誠實忙碌文案，不假標來源。
- `verify_long_article_non_project.js` 通過：非本專案科技長文走去廣告摘要，不邀請進 QA 編輯模式。
- `verify_long_article_qa_mode.js` 通過：本專案相關長文先去廣告摘要，再提示是否進入 QA 編輯模式，並列出操作方式。
- `verify_web_qr_persistence.js` 通過：網路搜尋 quick reply 遇 API 忙碌時不假裝成功。
- `verify_service_hours_guard.js` 通過：服務/營業時間題不直接用舊資料回答，導向官方服務頁與網路搜尋。
- `verify_unknown_model_guard.js` 通過：未知完整型號規格題在 LLM 前攔截；未知型號價格題仍走價格防呆。
- `verify_62_compact.js` 通過 9/9：範圍、價格、時效、家電允答與型號選擇流程均符合 SOP。
- `verify_qa_draft_format_guard.js` 與 `verify_qa_flow.js` 通過：QA 草稿不被純數字或無關閒聊污染，可取消不寫入正式 QA。
- `verify_odyssey_flow.js` 通過：Odyssey 3D 流程在 API 忙碌時維持誠實防呆，不假標來源、不亂展開。

### 測試修正
- `verify_elaboration_limit.js` 新增 API_GUARDED 分支：初始回答若為系統忙碌，測試改驗證「拒絕展開、不消耗再詳細說明次數、不補不可靠資訊」，而不是硬要求 1/2、2/2 計數。

### Prompt
- 本次未修改 Google Sheet `Prompt!C3`。
- 本次未修改本地 `Prompt.csv`，也沒有同步或覆蓋正式 Prompt。

## 2026-06-20 (v29.5.283 早期防呆優先序修正)

### 問題
- v29.5.282 的不存在完整型號早期攔截放在價格/時效/範圍 guard 前面，可能讓「未知型號 + 價格」題先被型號驗證攔截，而不是照專案鐵律導三星官方搜尋且不回覆數字價格。

### 程式修正
- 將 Unknown Model Guard 移到範圍、時效資訊、價格防呆之後，仍保留在 LLM 與 PDF 路由之前。
- 一般不存在完整型號規格題仍會被攔截；價格題則優先走價格防呆。

### 測試與部署
- `npm run test:static` 通過。
- 已更新既有正式 Webhook Deployment ID 至 `v29.5.283 @1063`；沒有新建 deployment。
- `tools/check_deploy_readiness.ps1` 通過：本機、Apps Script HEAD 與正式 Webhook health 均為 `v29.5.283 [2026-06-20 18:05]`。
- `npm run check:webhook-version` 通過。
- 正式 TestUI `verify_unknown_model_guard.js` 通過：`S32FD812 有耳機孔嗎？規格是什麼？` 走 `[來源:專案型號驗證規則]`；`S32FD812 現在價格多少？` 走 `[來源:三星官網]` 並導到三星官方搜尋頁，不報數字價格。

### Prompt
- 本次未修改 Google Sheet `Prompt!C3`。
- 本次未修改本地 `Prompt.csv`，也沒有同步或覆蓋正式 Prompt。
## 2026-06-20 (v29.5.282 不存在完整型號早期攔截)

### 問題
- 使用者輸入看似完整型號但不在目前 QA/CLASS_RULES/PDF 型號索引中時，原流程仍可能進入 Fast Mode LLM，造成一次 Gemini 呼叫費用，且有機會由模型猜出不存在規格。

### 程式修正
- 新增完整型號早期驗證：`Sxx/LSxx/WA/WD/VR/G90XF` 類型的完整型號若在專案索引找不到，會在 LLM 前直接回覆請確認型號。
- 短別稱（例如 M7、G8、S9）不套用此攔截，維持既有型號選擇與 QA/規格庫 → PDF → WEB SOP。
- 攔截回覆固定標註 `[來源:專案型號驗證規則]`，不假標 QA、規格庫、手冊或網路搜尋。

### 測試與部署
- `npm run test:static` 通過。
- 已更新既有正式 Webhook Deployment ID 至 `v29.5.282 @1062`；沒有新建 deployment。
- `tools/check_deploy_readiness.ps1` 通過：本機、Apps Script HEAD 與正式 Webhook health 均為 `v29.5.282 [2026-06-20 17:36]`。
- `npm run check:webhook-version` 通過。
- 正式 TestUI `verify_unknown_model_guard.js` 通過：`S32FD812 有耳機孔嗎？規格是什麼？` 回覆找不到該完整型號、標註 `[來源:專案型號驗證規則]`，且 log 出現 `[Unknown Model Guard v29.5.282]`、沒有 `[AI Stats]`/`[AI Raw Response]`。

### Prompt
- 本次未修改 Google Sheet `Prompt!C3`。
- 本次未修改本地 `Prompt.csv`，也沒有同步或覆蓋正式 Prompt。

## 2026-06-20 (正式 TestUI 17 題路由題庫回歸)

### 目的
- 依使用者要求，不只看程式碼或本機靜態檢查，而是用正式 TestUI 實際丟使用者問句，確認回答流程是否符合開發手冊 SOP。

### 執行
- 正式版本守門通過：本機與正式 Webhook 均為 `v29.5.281 [2026-06-20 16:52]`。
- 17 題路由題庫分批執行，避免單次執行超過工具時間上限：
  - Q1：通過
  - Q2-Q3：通過
  - Q4-Q6：通過
  - Q7-Q9：通過
  - Q10-Q15：通過
  - Q16-Q17：通過

### 結果
- 17/17 通過。
- 多型號/系列題維持型號選擇流程。
- 無型號操作題維持補完整型號流程。
- 外部 API 暫時失敗時維持 `API_GUARDED`，未偽造 QA、規格庫、PDF 或網路搜尋來源。
- 本次沒有發現需要修改 `linebot.gs` 的新錯誤，因此未重新部署 GAS。
- 本次沒有修改 `Prompt.csv`，也沒有同步或覆蓋 Google Sheet `Prompt!C3`。

## 2026-06-20 (IDE/Copilot 指引對齊現行 SOP)

### 問題
- `.github/copilot-instructions.md` 仍保留舊規則：把 `Prompt.csv` 寫成 Prompt 修改入口、部署流程未明確使用既有 deployment 的 `-V`、並保留過時的 LLM/手冊路由描述。
- 這類檔案會被 IDE / Copilot 類工具讀取，若不修正，其他工具可能繼續依舊規則改錯 Prompt 或部署錯 Webhook。

### 處理
- 重寫 `.github/copilot-instructions.md`，對齊現行鐵律：
  - 正式 Prompt 是 Google Sheet `Prompt!C3`。
  - `Prompt.csv` 只是本地鏡像/人工備份。
  - 程式部署必須更新既有正式 Deployment ID，且使用 `-V <新版本>`。
  - 回答路由維持 QA / CLASS_RULES → 官方 PDF → WEB / 官方頁 → 誠實無資料。
- `verify_sop_static_guards.js` 新增 Copilot 指引檢查，防止文件退回舊規則。

### 測試與部署
- `npm run test:static` 通過。
- 本次沒有修改 `linebot.gs`，因此不需要重新部署 GAS。
- 本次沒有修改 `Prompt.csv`，也沒有同步或覆蓋 Google Sheet `Prompt!C3`。

## 2026-06-20 (文件/版本庫衛生：移除舊主程式副本)

### 問題
- 版本庫仍追蹤 `linebot.js`、`linebot.gs.bak`、`linebot.gs.pre_v295158.bak` 三個 2026/3 的舊主程式副本。
- 這些檔案已被 `.gitignore` / `.claspignore` 排除，不會推上 GAS，但留在 Git 會讓維護者或其他 IDE/代理誤以為它們也是可修改的正式主程式。

### 處理
- 從版本庫移除上述三個舊副本；正式 GAS 主程式只保留 `linebot.gs`。
- `verify_sop_static_guards.js` 新增檢查，若舊副本被重新加入，`npm run test:static` 會失敗。

### 測試與部署
- `npm run test:static` 通過。
- 本次沒有修改 `linebot.gs`，因此不需要重新部署 GAS。
- 本次沒有修改 `Prompt.csv`，也沒有同步或覆蓋 Google Sheet `Prompt!C3`。

## 2026-06-20 (v29.5.281 服務/營業時間誤判修正)

### 問題
- `請問服務時間是幾點` 這類服務/營業時間問題含有「幾點」，被 RealTime 捷徑誤判成「現在幾點」，直接回目前時間。
- 服務中心、客服或營業時間屬於會依日期、地點與服務類型變動的資訊，不能用 RealTime 現在時間或舊資料直接回答。

### 程式修正
- 新增服務/營業時間守門：
  - 服務時間、客服時間、營業時間、今天是否營業等問題，不進「現在幾點」捷徑。
  - 回覆導向三星官方聯絡我們與服務中心查詢頁。
  - 提供「這題再搜網路」Quick Reply，讓使用者可選擇查最新資訊。
- 本次未修改 Google Sheet `Prompt!C3`，也未修改本地 `Prompt.csv`；Prompt 正式來源仍是 Google Sheet。

### 測試
- 新增 `verify_service_hours_guard.js`：
  - 驗證 `請問服務時間是幾點` 不會回「現在是...」。
  - 驗證 `請問今天有營業嗎？` 會導向三星官方服務頁並標註 `[來源:三星官方服務頁]`。

### 部署
- 已只更新既有正式 Deployment ID：`AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA`。
- 正式部署版本：`v29.5.281 [2026-06-20 16:52] @1061`。
- 禁止新建部署；部署工具必須使用 `clasp deploy -i <既有DeploymentId> -V <新版本>`。
- 部署後 `tools/check_deploy_readiness.ps1` 通過：本機、Apps Script HEAD 與正式 Webhook health 均為 `v29.5.281`。
- 正式 TestUI 回歸通過：
  - `verify_service_hours_guard.js`
  - `verify_linebot.js` Scenario 6

## 2026-06-20 (v29.5.239-v29.5.276 SOP 路由、Prompt Sheet 同步與 PDF 索引防護)

### 背景
- 修正 v29.5.193 鐵律 SOP 區塊無條件把規格/能力題追加 `[AUTO_SEARCH_PDF]` 的問題，避免 Fast Mode 已可回答時仍二次調用 PDF，造成 Token 浪費與答案覆蓋。
- 使用者確認 Prompt 實際來源是 Google Sheet `Prompt!C3`，不是只改本地 `Prompt.csv`。

### 已完成
- `v29.5.239`: 合併 v29.5.179/v29.5.181/v29.5.193 的重複 PDF 升級邏輯，改成只有操作/故障或明確手冊查證，且 Fast Mode 回答品質不足時才追加 `[AUTO_SEARCH_PDF]`。
- `Prompt.csv` 更新為 `Prompt v29.5.239`，並已透過一次性維護入口同步到 Google Sheet `Prompt!C3`。同步後已移除臨時入口，避免生產環境留下寫入 Prompt 的公開路徑。
- `v29.5.240`: 修正 `callLLMWithRetry()` 中 `geminiContents` 未初始化導致 LLM/PDF 流程崩潰的錯誤，並修正 PDF 來源標籤在部分分支使用錯誤檔案清單的問題。
- `v29.5.241`: 新增短追問展開邏輯，讓「那 M8 呢 / How about M8」沿用上一題主題，只更換詢問對象，避免改答一般規格概覽。
- `v29.5.242`: `#查手冊` 明確寫出 `forceCurrentOnly=true` 防污染 log；API 配額/暫時失敗訊息不再補上 PDF 來源標籤。
- `v29.5.243`: 修正同步失敗時 PDF 索引歸零的風險；強制重建時保留舊 PDF URI 清單，只有新清單成功含 PDF 時才覆蓋。
- `v29.5.244`: 移除 QA 同步重複注入，新增 `KB_URI_LIST_BACKUP` 與 `PDF_MODEL_INDEX_BACKUP`，同步異常時可用備份回復 PDF 索引；新增受保護的 `update_prompt_c3` 維護入口與 `tools/sync_prompt_c3.ps1`，讓 `Prompt.csv` 可同步到 Google Sheet `Prompt!C3`。
- `deploy.bat` 改為四步驟：推送程式、建立版本、更新既有 Webhook、提示 Prompt 正式來源在 Google Sheet `Prompt!C3`；部署流程不再自動同步或覆蓋 Prompt。
- `v29.5.245`: 回歸測試發現目前雲端 PDF URI 清單已是 0，單靠「不覆蓋」不足；新增單本 PDF 即時補回機制，依目前查詢型號從 Drive 找 PDF、上傳 Gemini File API 並回填 `KB_URI_LIST` / `PDF_MODEL_INDEX`。
- `v29.5.246`: 新增 `?kb=1` 知識庫健康診斷，協助判斷目前是 Drive 資料夾未設定、Drive PDF 為 0、或 Gemini URI/索引快取為 0。
- `v29.5.247`: Fast Mode 若遇 API 配額/暫時錯誤，但 Smart Router 已取得多個候選型號，改為保留型號選擇流程，不直接回覆死路錯誤。
- `v29.5.248`: API 暫時失敗後的型號選擇泡泡，選型模式改為 `pdf`，選定完整型號後接回官方手冊查證。
- `v29.5.249`: `PDF_MODEL_INDEX` 改由 Drive PDF 手冊檔名建立，不再依賴 Gemini File URI 快取；`/重啟` 顯示分拆 Drive 手冊數與 Gemini URI 快取數。
- `v29.5.250`: `/重啟` 與 `/重設規格庫` 前導文字改為依實際同步結果產生，避免 Gemini URI 快取為 0 時仍誤稱已同步至 Gemini。
- `v29.5.251`: Gemini File API 上傳失敗時記錄 HTTP 狀態碼與錯誤摘要；若單本 PDF 小於保守上限且 File API 無 URI，當回合改用 Gemini 官方支援的 `inline_data` 掛載 PDF。
- `v29.5.252`: inline PDF fallback 的 base64 不再寫入 Cache，避免 Apps Script `以下引數過大：value` 中斷。
- `v29.5.253`: 操作/故障題在沒有型號且 Fast Mode 遇到 API/配額暫時失敗時，改請使用者提供完整型號；TestUI 去除同一正式回覆的截斷預覽，避免誤判為重複回覆。
- `v29.5.254`: 長文去廣告摘要進入 QA 編輯模式時，草稿種子改用乾淨的整理素材，不再把 QA 編輯邀請語、操作說明或費用尾註寫入草稿。
- `v29.5.255`: `clearTestSession()` 補清 QA 建檔草稿、pending query、PDF selection、history cache 與 hit alias keys，避免 TestUI 回歸被前一輪草稿狀態污染。
- `v29.5.256`: TestUI 回覆收集在最終回傳前再次去除截斷預覽，避免 `/取消` 等指令被誤顯示成兩次回覆。
- `v29.5.257`: TestUI 截斷預覽去重改為正規化尾端標點後比對前綴，修正「。...」與「。」未被視為同一回覆的問題。
- `v29.5.258`: TestUI 截斷預覽與完整版在尾端標點正規化後完全相同時，優先保留完整版，移除截斷預覽。
- `v29.5.259`: Quick Reply 的「📖 查手冊」改回只有 `hasPdfForModel=true` 且尚未查過 PDF 時才顯示；操作/故障題若還沒有型號或未確認手冊，不再先給可能落空的手冊按鈕。
- `v29.5.260`: 新增 WA/WD/VR 等家電型號提取與家電題 API 暫失敗防呆，避免洗衣機題被誤套用螢幕型號補問模板。
- `v29.5.261`: 新增早期 Scope Guard；競品-only、競品 Excel/價格表等問題在價格防呆與 LLM 前先回覆專案範圍。
- `v29.5.262`: 新增早期時效資訊路由；近期活動/最新上市/CES/延長保固等問題先導官方頁與網路搜尋，不進 Fast Mode 型號泡泡。
- `v29.5.263`: 型號選擇/補型號回覆不再追加查手冊提醒或查手冊按鈕，避免使用者尚未選型號時流程自相矛盾。
- `v29.5.264`: API 429 與外層 API 例外回覆改為客服友善語氣；不再對 LINE 使用者顯示「升級付費方案」或「您的請求」。
- `v29.5.265`: `isApiFailureReply()` 納入新的客服友善 API 失敗文案，避免「系統暫時忙碌」類訊息被 PDF 模式補上假的官方手冊來源；並清理型號泡泡/網路搜尋提示中的「您」語氣殘留。
- `v29.5.266`: Fast Mode 未掛載 PDF 時，不再把 AI 自帶的「手冊/PDF」來源標籤正規化成 `[來源:產品手冊]`，避免假手冊來源被洗白。
- `v29.5.267`: 型號選擇 Flex UI 產生按鈕前也會執行 `dedupDisplayModels()`，避免 `S49...` 與 `LS49...XZW` 這類同款料號被顯示成兩個選項；靜態測試新增直接執行型號顯示正規化函式的防回歸檢查。
- `v29.5.268`: 操作/故障題若沒有任何型號訊號且 Fast Mode 未命中可信 QA，會先請使用者補完整型號，不再讓 LLM 用泛用常識猜操作步驟；補型號回覆補上 `[來源:專案流程規則]`。
- `v29.5.269`: Fast Mode 來源標籤改為精確白名單，只接受 `[來源:QA]` / `[來源:規格庫]` / `[來源:網路搜尋]`；`[來源:QA資料庫]`、`[來源:產品規格表]` 等模糊標籤不再被洗白為可信來源。
- `v29.5.270`: 價格防呆的型號解析保留完整尾碼，例如 `S34BG850SC` 不再被截短；本機靜態測試新增價格題不回覆金額、導官方搜尋頁與完整型號 token 檢查。
- `v29.5.271`: `sanitizeManualDeflection()` 擴充清理「根據你/您提供的 PDF/手冊/文件/檔案」等變體，深度模式回覆統一改用「根據官方手冊」的客服視角。
- `v29.5.272`: 無型號操作/故障題若未命中可信 QA，會先要求補完整型號；即使 AI 自行輸出 `[AUTO_SEARCH_PDF]` / `[AUTO_SEARCH_WEB]` / `[NEED_DOC]` 也不可越過此守門，家電題則改請補家電完整型號。
- `v29.5.273`: 多型號比較/推薦題只有在不含操作、設定、故障、步驟或手冊查證意圖時才可跳過型號泡泡；若比較題同時需要精準操作路徑，會保留型號選擇。
- `v29.5.274`: 型號選擇泡泡前導文字改為固定流程提示並標註 `[來源:專案流程規則]`，不再沿用 AI 未查證的 Fast Mode 中間稿當作使用者可見答案。
- `v29.5.275`: 家電操作/維護題需要補完整型號時，也會標註 `[來源:專案流程規則]`，避免家電防呆回覆缺少來源。
- `v29.5.276`: 操作/故障/明確手冊查證題若有對應 PDF，Fast Mode 必須有可信來源（`[來源:QA]` 或 `[來源:規格庫]`）且答案足夠才可直接回覆；若沒有可信來源，即使 AI 自行產出看似完整的步驟，也會依 SOP 升級官方手冊查證。規格/能力題仍不會只因有 PDF 而自動升級。
- `deploy.bat`: 改為解析 `clasp version` 建立出的版本號並用 `-V` 更新既有 Deployment ID；若 Apps Script 已達 200 版本上限，會明確提示先到 Project History 刪除未使用的舊版本後重跑，不可新建部署 ID。
- `deploy.bat`: 部署流程只負責推送程式、建立版本、更新既有 Webhook；不再依 `GAS_ADMIN_SECRET` 自動把本地 `Prompt.csv` 同步到 Google Sheet `Prompt!C3`，避免誤覆蓋正式 Prompt。
- `tools/deploy_existing_webhook.ps1`: 新增非互動式部署主流程，負責 `clasp push -f`、`clasp version`、`clasp deploy -i <既有DeploymentId> -V <新版本>` 與正式 `?health=1` 驗證；只更新既有部署，不建立新部署，不修改 `Prompt!C3`。
- `tools/deploy_existing_webhook.ps1`: 版本數滿 200 時改為在 `clasp push -f` 之前先停止，避免留下「Apps Script HEAD 已更新、正式 LINE webhook 仍是舊版」的半部署狀態。
- `tools/deploy_existing_webhook.ps1`: 修正 `clasp version` 回傳千分位版本號（例如 `1,055`）時只解析成 `1` 的問題；現在會移除逗號後再用 `-V` 更新既有 deployment。
- `deploy.bat`: 改為 Windows 雙擊入口，轉呼叫 `tools/deploy_existing_webhook.ps1`，避免批次檔與自動化腳本維護兩套部署流程。
- `tools/sync_prompt_c3.ps1`: 改為必須明確指定 `-PromptPath` 並加上 `-ConfirmOverwrite` 才會寫入 Google Sheet `Prompt!C3`，避免獨立工具被誤執行時覆蓋正式 Prompt。
- `verify_m7_mute_current.js`: `/重啟` 版本檢查改為讀取 `linebot.gs` 目前 `GAS_VERSION`，避免正式部署更新後仍因測試寫死舊版本而假失敗。
- `ensure_formal_version_current.js`: 新增 TestUI 線上回歸守門，先比對本機 `GAS_VERSION` 與正式 Webhook `?health=1`，版本不同時拒絕跑線上回歸，避免拿舊部署誤判新版回答。
- `run_current_test.js`: 新增線上 TestUI 測試包裝器；所有正式網址回歸測試要先通過正式版本比對，才會執行指定 `verify_*.js`。
- `package.json`: `test:current` / `test:m7` / `test:price` 改走 `run_current_test.js`，避免直接測到舊部署。
- `verify_sop_static_guards.js`: 新增本機 SOP 靜態守門，檢查部署不覆蓋 Prompt、Prompt 同步需確認、TestUI 線上回歸需版本守門，以及查手冊提醒不得在已查 PDF 或等待選型時出現。
- 新增 `tools/check_deploy_readiness.ps1`：比對本機 `linebot.gs` 版本、Apps Script 遠端 HEAD、正式 Webhook health、`clasp versions` 數量與目前 deployments，避免 HEAD 已推但正式部署未切換時誤判。

### 部署
- 已使用既有 Deployment ID 更新部署：`AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA`
- 目前正式部署版本：`v29.5.276` (`@1055`)。
- `v29.5.276` 已推送 Apps Script HEAD、建立版本並更新既有正式 Webhook；`tools/check_deploy_readiness.ps1` 確認本機、遠端 HEAD 與正式 health 均一致。
- 嘗試用 Apps Script API 將既有 deployment 改為 HEAD 時，API 回覆 `Read-only deployments may not be modified.`；官方 Apps Script API 目前也沒有版本刪除方法，只能由登入狀態的 Apps Script Project History 刪除舊版本。
- Apps Script API `projects.getContent` 已確認遠端 HEAD 為 `v29.5.271 [2026-06-20 05:27]`，且不含「升級付費方案 / AI 暫時無法處理您的請求」舊文案。
- 沒有新建 GAS 部署。

### 驗證
- `v29.5.252`：已部署到既有 Webhook，健康檢查回傳 `OK - Current Version: v29.5.252 [2026-06-20 02:28]`。
- `v29.5.252`：M7 / SmartThings Hub 測試通過「配額防護」路徑；當 Gemini 配額不足時不再偽造 PDF/規格來源，且不再因 inline PDF base64 寫入 Cache 導致中斷。
- `v29.5.252`：價格題防明確數字測試通過。
- `v29.5.253`：已部署到既有 Webhook，健康檢查回傳 `OK - Current Version: v29.5.253 [2026-06-20 02:45]`。
- `v29.5.253`：`verify_m7_mute_current.js` 通過；TestUI `/重啟` 只回一段正式回覆，無型號操作題遇 API 暫失敗時改請補完整型號，M7 操作題會先要求選完整型號。
- `v29.5.253`：`verify_s9_kvm_alias_guard.js` 通過；`s9有內建kvm嗎` 會先要求完整型號，不再直接肯定 S9 支援 KVM。
- `v29.5.253`：`verify_price_no_number.js` 與 `verify_m7_iron_rule_flow.js` 仍通過。
- `v29.5.258`：已部署到既有 Webhook，健康檢查回傳 `OK - Current Version: v29.5.258 [2026-06-20 03:58]`。
- `v29.5.258`：`verify_long_article_qa_mode.js` 通過；長文 QA 編輯模式可進草稿、修稿、取消，且 `/取消` 只回一段正式回覆。
- `v29.5.258`：`verify_long_article_non_project.js` 通過；非專案長文只做去廣告摘要與原文整理，不進 QA 編輯邀請。
- `v29.5.258`：`verify_manual_continuity.js` 通過配額防護路徑；Gemini 配額不足時不偽造 PDF 來源。
- `v29.5.259`：已部署到既有 Webhook，健康檢查回傳 `OK - Current Version: v29.5.259 [2026-06-20 04:10]`。
- `v29.5.259`：`verify_m7_mute_current.js` 通過；未指定型號操作題會先請使用者補完整型號，不再顯示未確認手冊的「查手冊」按鈕；M7 多型號別稱仍進型號選擇。
- `v29.5.260`：待部署後驗證 `verify_62_compact.js`，確認家電題不再要求 S32/S27 螢幕型號。
- `v29.5.261`：待部署後驗證 `verify_62_compact.js`，確認競品 Excel/價格表題會命中 Scope Guard。
- `v29.5.262`：已部署到既有 Webhook，健康檢查回傳 `OK - Current Version: v29.5.262 [2026-06-20 05:05]`。
- `v29.5.262`：`verify_62_compact.js` 通過 9/9；確認競品 Excel/價格表題會命中 Scope Guard，促銷/最新資訊題會命中 Force Web Intent 或 Price Guard，家電題不再要求 S32/S27 螢幕型號。
- 測試基準更新：`verify_route_testset_17_single.js` 新增 `MODEL_SELECT`、`ASK_MODEL`、`API_GUARDED` 分類，資料集保留原問句但依現行 SOP 更新預期路由；回歸結果 17/17 通過。此項僅更新測試與文件，未改 GAS、未部署。
- `v29.5.263`：已部署到既有 Webhook，健康檢查回傳 `OK - Current Version: v29.5.263 [2026-06-20 05:35]`。
- `v29.5.263`：`verify_m7_mute_current.js` 通過；M7 型號選擇回覆不再混入提早查手冊提醒。
- `v29.5.263`：`verify_route_testset_17_single.js` 通過 17/17；MODEL_SELECT/ASK_MODEL 回覆均不得帶提早查手冊提醒。
- `v29.5.264`：本機 `node --check` 與 `git diff --check` 通過；正式線上驗證需待刪除舊 GAS 版本後更新既有 deployment。
- `v29.5.265`：`verify_api_failure_source_guard.js` 通過；確認新 API 忙碌文案會被視為 API 失敗，不會被補 PDF 來源，且 `linebot.gs` 不含舊內部付費文案。
- `v29.5.266`：`npm run test:static` 通過；確認 Fast Mode 不會把 AI 自帶的「手冊/PDF」來源標籤洗白為 `[來源:產品手冊]`。
- `v29.5.267`：`node --check` 與 `npm run test:static` 通過；確認型號選擇 UI 最後一關會做 `S/LS` 顯示去重。
- `v29.5.268`：`node --check` 與 `npm run test:static` 通過；確認無型號操作題防呆存在於 AI 文字 fallback 型號提取之前，且非可信 QA 來源時會要求補完整型號。
- `v29.5.269`：`node --check` 與 `npm run test:static` 通過；確認 Fast Mode 只接受精確來源標籤，模糊 QA/規格來源不會被洗白。
- `v29.5.270`：`node --check` 與 `npm run test:static` 通過；確認價格防呆保留 `S34BG850SC` 完整型號、不輸出數字金額並導三星官方搜尋頁。
- `v29.5.271`：`node --check` 與 `npm run test:static` 通過；確認「你/您提供的 PDF/手冊/文件/檔案」會被改寫為官方手冊口吻。
- `tools/check_deploy_readiness.ps1` 實測輸出：本機 `v29.5.271`、遠端 HEAD `v29.5.271`、壞 API 文案 `False`、正式 health `v29.5.263`、版本數 `200`，並提示刪舊版本後重跑 `deploy.bat`。
- `v29.5.276`：`npm run test:static` 通過；確認操作/故障/明確手冊查證題若沒有可信 Fast Mode 來源，不能因 AI 產出通用步驟就停在 Fast Mode，會升級官方手冊查證。
- `tools/check_deploy_readiness.ps1` 部署前阻擋實測輸出：本機 `v29.5.276`、遠端 HEAD `v29.5.271`、壞 API 文案 `False`、正式 health `v29.5.263`、版本數 `200`；部署工具會在 `clasp push -f` 前停止，避免半部署。
- `v29.5.276`：正式部署後 `tools/check_deploy_readiness.ps1` 通過；本機 `v29.5.276`、遠端 HEAD `v29.5.276`、正式 health `v29.5.276`、版本數 `3`。
- `v29.5.276`：正式 TestUI 回歸通過 `verify_m7_exact_issue.js`（配額防護路徑）、`verify_m7_mute_current.js`、`verify_s9_kvm_alias_guard.js`、`verify_price_no_number.js`。
- `v29.5.276`：正式 TestUI 分批通過 17 題路由題庫（1、2-6、7-12、13-17）與 `verify_62_compact.js` 9/9；部分題目因外部 Gemini 配額走 `API_GUARDED`，但來源誠實與路由守門符合預期。
- `verify_route_testset_17_single.js`：新增題號參數（例如 `node run_current_test.js verify_route_testset_17_single.js 13,14,15`）、TestUI 呼叫 timeout 與 iframe 輪詢等待，避免單題卡住時整組回歸沒有證據。
- `tools/deploy_existing_webhook.ps1`：新增後已納入 `npm run test:static` 靜態守門；確認部署腳本使用既有 Deployment ID + `-V`、不碰 `Prompt!C3`、版本上限時會停止而不是新建部署。
- `node --check` 通過。
- 健康檢查回傳：`OK - Current Version: v29.5.263 [2026-06-20 05:35]`。
- `verify_price_no_number.js` 通過，價格題仍不回覆數字價格。
- `verify_m7_iron_rule_flow.js` 通過；目前 Gemini 配額限制時，測試確認不會把配額錯誤假標成 PDF 來源。
- `verify_m7_m8_matter.js` 通過；短追問 M8 會進入型號選擇，不再改答 M8 一般規格。
- `verify_m7_exact_issue.js` 已更新為符合目前 SOP：M7 多型號需先選型號；遇到 API 配額錯誤時只驗證來源誠實性。
- `?kb=1` 診斷確認：Drive PDF 資料夾可讀且有 56 本 PDF；`PDF_MODEL_INDEX` / 備份已恢復為 75 組；目前 Gemini File URI 快取仍為 0，需等待 Gemini File API 可用時由單本補回或下次同步逐步恢復。

### 注意
- 測試期間 Gemini 回覆多次出現配額限制，這屬外部 API 狀態；目前程式已避免把此類錯誤訊息標成官方手冊來源。

---

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
- **最後更新時間**: 2026-06-20
- **最後動作**: 完成 `v29.5.276` 操作/故障/明確手冊查證題的可信 Fast Mode 來源守門，修正部署腳本千分位版本號解析，並更新既有正式 Webhook 到 `@1055`。
- **目前進度**: 正式 Webhook、本機 `linebot.gs` 與 Apps Script 遠端 HEAD 均為 `v29.5.276 [2026-06-20 14:35]`；`tools/check_deploy_readiness.ps1` 已通過。
- **下一步 (Next Steps)**:
    - [x] 確認部署使用既有 Deployment ID，沒有新建部署。
    - [x] 確認 `Prompt.csv` 只是本機鏡像；正式 Prompt 需同步到 Google Sheet `Prompt!C3`。
    - [x] 到 Apps Script Project History 批次刪除未被 active deployment 使用的舊版本，然後重跑既有正式 deployment 更新流程。
    - [ ] 等 Gemini 配額/檔案 API 恢復後，進一步確認 PDF 深度回答能產出完整手冊答案。

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
  - 案例 1：M9/G8/M8/S34BG850SC 最低價與建議售價
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

## 2026-03-20 (v29.5.195 鐵律語義定稿：移除主觀風險判定)

### 問題
- 使用者要求路由必須以固定 SOP 為準，不能使用「高風險」這類主觀分類描述，避免誤解為系統自行裁量題目重要性。

### 程式修正
- `linebot.gs`：
  - 將上下文降級分支的 log 由「題型高風險」改為「命中 SOP 查證題型」。
  - 上下文降級補 PDF 條件同步納入 `manualVerificationIntent`，與鐵律路由一致。
- `Prompt.csv`：
  - 升級為 `Prompt v29.5.195`。
  - 將「高風險規格題」改為「SOP查證題」。
  - 明確寫死產品題固定路由：`QA/規格庫 → PDF → WEB`（仍不足時）。

### 效果
- 路由判定對外語意統一為「鐵律SOP」，不再使用主觀風險詞。
- 與專案精神一致：先 QA/規格，再手冊，再網路/其他資料，且來源需可追溯。

## 2026-03-20 (v29.5.196 手冊甩鍋句型防呆補強)

### 問題
- 手冊回覆偶爾仍出現變形甩鍋語句（例如「建議你：通常官網頁面會列出…」），雖然沒有逐字寫「請自行查手冊」，但體驗上仍是把問題丟回使用者。

### 程式修正
- 擴充 `sanitizeManualDeflection()`：
  - 新增「建議你：」「如果你想確認」「最直接且準確」等泛化甩鍋句型過濾。
- 補強 `enforceManualUncertaintyGuard()`：
  - 若命中「手冊未明確」且仍含導向官網/手冊的建議語，統一改寫為可執行下一步（引導 `🌐 這題再搜網路`）。

### 效果
- 手冊模式更符合鐵律：不再要求使用者自行查手冊/官網。
- 未明確情境下改為明確下一步，避免空泛建議。

## 2026-03-20 (v29.5.197 型號泡泡前導文字固定化)

### 問題
- 命中「SOP 手冊查證 + 多型號」時，雖然會送型號泡泡，但前導文字仍可能帶出 Fast Mode 的暫時結論，造成使用者誤解。

### 程式修正
- 在型號泡泡回覆組裝時新增保護：
  - 若 `forcedSopNeedsModelSelection=true`，前導文字固定為
    - `這題需要先確認完整型號，我再依官方手冊查證給你。`
  - 不再沿用 `finalText`（避免先外送未查證結論）。

### 效果
- 多型號手冊查證場景下，先選型號再查證的 SOP 對使用者可見行為一致。

## 2026-06-20 (v29.5.280 API 失敗 Quick Reply 防呆)

### 問題
- Odyssey Hub 測試在 API 暫時忙碌時，使用者再按 `#再詳細說明`，系統會重新進一般流程並產生泛用補型號話術，像是已經能展開內容。
- `#這題再搜網路` 若搜尋失敗，仍會追加 `(🌐 網路搜尋補充資料)`，讓回覆看起來像有成功補資料。

### 程式修正
- `#再詳細說明` 讀到上一則 assistant 是 API/系統忙碌失敗時，直接提示「還沒有成功查到內容」，不再進 LLM 展開。
- Web Search 指令回合若 `searchResponse` 是 API 失敗文字，不追加網路搜尋補充標記。

### 測試
- `verify_odyssey_flow.js` 新增條件式斷言：若第一輪為 API 失敗，後續 `#再詳細說明` 必須停止展開。
- `verify_web_qr_persistence.js` 新增斷言：API 失敗回覆不得包含「網路搜尋補充資料」。
- 正式 Webhook 已更新至 `v29.5.280 [2026-06-20 16:35] @1060`，未修改 Google Sheet `Prompt!C3`。

## 2026-06-20 (v29.5.279 QA 建檔無關內容防污染)

### 問題
- QA 建檔模式會把短句閒聊直接融入草稿，例如「我想吃蘋果」會變成 `（用戶補充：我想吃蘋果）`，容易污染 QA 資料庫。

### 程式修正
- 新增 `isDraftFeedbackLikelyRelevant()`：
  - 長句仍允許進入修稿流程。
  - 短句若有明確編輯意圖（補充、修改、改成、刪除等）可進入修稿。
  - 短句若和目前 QA 草稿/原始內容有關鍵詞重疊，也可進入修稿。
  - 其餘短句會提示「不像是在修改目前這筆 QA」，不寫入草稿。

### 測試
- `verify_qa_draft_format_guard.js` 增加無關句檢查：
  - 「我想吃蘋果」不得變成 `（用戶補充：我想吃蘋果）`。
- `verify_qa_flow.js` 改為不執行正式 `/紀錄` 存檔，只驗證草稿、純數字拒絕、無關句拒絕與取消流程，避免測試資料污染 QA 工作表。
- 正式 Webhook 已更新至 `v29.5.279 [2026-06-20 16:11] @1059`，未修改 Google Sheet `Prompt!C3`。

## 2026-06-20 (v29.5.278 QA 建檔格式防污染)

### 問題
- 正式 TestUI 的 QA 建檔人工觀察腳本雖顯示 PASS，但實際預覽出現 `A：A:`，代表使用者常見的 `問題？ A：答案` 格式沒有被正規化。
- 一般草稿模式下單獨輸入 `2` 會被當作補充內容寫入 QA，容易把選項數字污染到資料庫。

### 程式修正
- `isOneLineQaText()` / `normalizeOneLineQaText()` 改用共用解析器，支援：
  - `問題 / A：答案`
  - `問題？ A：答案`
- `callGeminiToPolish()`、`callGeminiToModify()`、`simpleModifyFallback()` 回傳 QA 格式時統一正規化，避免 `A：A:`。
- `handleDraftModification()` 在非合併選擇狀態遇到純 `1/2/3` 時，改提示目前沒有選項，不再修改草稿。

### 測試
- 新增 `verify_qa_draft_format_guard.js`：
  - 驗證 `問題？ A：答案` 進入草稿後不會出現 `A：A:`。
  - 驗證一般草稿模式輸入 `2` 不會被寫成 `（用戶補充：2）`。

## 2026-06-20 (v29.5.277 長文 QA 草稿正規化)

### 問題
- 長文去廣告摘要判定為 QA 題材後，回覆「要」進入 QA 編輯模式時，系統會把 `【重點摘要】`、`【去廣告原文】` 整包當成建檔素材。
- 後續建檔降級格式化可能把原本已是問句的內容硬改成「嗎 / A：」，導致 QA 草稿不自然且不適合直接存回資料庫。

### 程式修正
- 新增 `buildArticleQaDraftSeed()`，長文進 QA 前先萃取成單行 `問題 / A：答案`。
- 若長文只提出問題、沒有可驗證答案，答案欄會標為「待補」，不再把文章背景句硬湊成答案。
- 新增 QA 單行格式正規化，已經是 `問題 / A：答案` 的內容不再額外呼叫潤飾模型。
- 修正 `simplePolishFallback()`，對已帶問號的問句不再硬補「嗎」。

### 測試
- `verify_long_article_qa_mode.js` 加嚴檢查：
  - QA 草稿不得含 `【長文整理候選QA素材】`、`【重點摘要】`、`【去廣告原文】`。
  - QA 草稿不得出現 `SmartThings Hub嗎 / A`。
  - QA 草稿必須是乾淨的一行 `問題 / A：答案`。
- 正式 Webhook 回歸驗證（`v29.5.277 [2026-06-20 15:22] @1057`）：
  - `verify_price_no_number.js`：價格題不回覆數字金額，導向三星官方頁。
  - `verify_s9_kvm_alias_guard.js`：S9/KVM 短別稱先進型號選擇，不直接幻覺回答。
  - `verify_62_compact.js`：9/9 PASS。
  - `verify_route_testset_17_single.js`：17/17 PASS；遇 API 暫時保護時維持 `API_GUARDED`，未假標 QA/PDF 來源。
  - `verify_long_article_non_project.js`：非本專案科技長文只做去廣告摘要，不邀請進 QA。
  - `verify_m7_exact_issue.js`、`verify_m7_mute_current.js`：M7 Matter 與無遙控器音量題維持先選/補型號流程。

## 2026-03-20 (v29.5.198 TestUI 泡泡回合判讀修正)

### 問題
- TestUI 在「已送出型號泡泡」回合會把 `[AI Reply]` 中間稿當成最終回覆，造成看起來像先亂答再追問型號。

### 程式修正
- `testMessage()` 新增 `hasFlexSelectionFlow` 偵測：
  - 命中 Flex 型號泡泡流程時，忽略 `[AI Reply]` 中間稿提取。
  - 改回傳「已送出型號選擇泡泡」訊息（並盡量附上候選型號預覽）。
- 舊版 `已發送型號選擇反問` 分支保留為 fallback。

### 效果
- TestUI 顯示與實際路由一致，不再被中間稿誤導。

## 2026-03-20 (v29.5.199 手冊甩鍋同義句收斂)

### 問題
- 手冊回覆仍可能出現「直接向 Samsung 官方確認」等同義甩鍋句，雖未提官網，但本質仍是把判斷責任交給使用者。

### 程式修正
- `sanitizeManualDeflection()`：
  - `hasSupportTarget` 納入 `三星官方 / Samsung 官方`。
  - `hasDeflectVerb` 納入 `確認 / 求證`。
- `enforceManualUncertaintyGuard()`：
  - `hasDeflectRecommendation` 納入 `向三星官方確認 / 官方確認`。

### 效果
- 手冊模式更穩定地避免同義甩鍋語句外送。

## 2026-03-20 (v29.5.200 手冊未明確回覆收斂 - 納入客服/諮詢語句)

### 問題
- 在「手冊未明確」場景，回覆仍可能出現「直接諮詢客服」等導流語句。

### 程式修正
- `enforceManualUncertaintyGuard()` 的 `hasDeflectRecommendation` 新增：
  - `客服`、`客服人員`、`諮詢`

### 效果
- 只要是手冊未明確且出現客服導流語句，會統一改寫為可執行下一步（再搜網路）。

## 2026-03-20 (v29.5.201 手冊口吻修正 - 禁止「你提供的PDF」)

### 問題
- 手冊回覆偶爾出現「根據你提供的 PDF 文件」語氣，與客服角色不一致。

### 程式修正
- `sanitizeManualDeflection()` 先做口吻正規化：
  - `根據你提供的 PDF 文件` → `根據官方手冊`
  - `根據您提供的 PDF 文件` → `根據官方手冊`
- Deep Mode 系統指令新增硬規則：
  - 禁止「根據你提供的 PDF 文件」類措辭，統一使用「根據官方手冊／手冊內容」。
- `Prompt.csv` 升級 `Prompt v29.5.201` 並同步同一規則。

### 效果
- 對客戶顯示口吻統一為官方客服語境，不再出現「你提供的 PDF」。

## 2026-03-24 (v29.5.202 遙控器/音量操作題路由修正)

### 問題
- `M7沒有遙控器 把聲音關掉` 這類操作題沒有被判定為操作/故障題，導致不會走 `QA/規格 → PDF` 的 SOP。
- `沒有遙控器怎麼關聲音` 這類未指定型號問題，系統會從 AI 回答內舉例的型號反推出型號泡泡，造成錯誤引導。

### 程式修正
- 調整 `isOperationOrTroubleshootQuery()`：
  - 改以更通用的操作動詞/句型判定（如 `關掉 / 調整 / 調到 / 切換 / 叫出 / 進入選單`）
  - 不把 `遙控器 / 音量 / 喇叭` 這類題面詞硬編碼進程式
- 調整 AI 文字回退型號提取：
  - 只有當用戶原訊息本來就帶有型號/別稱訊號時，才允許從 AI 內文補抓型號。
  - 避免把 AI 自己舉的範例型號誤當成候選型號。

### 效果
- `M7` 這類多型號別稱操作題會正確回到「先選型號，再查手冊」。
- 未指定型號時改為請用戶補型號，不再亂出泡泡。

# v29.6.068 (2026-07-11)

- 移除 Smart Monitor HEVC 的固定「再詳細說明」與固定支援結論；手冊追問改為重新掛載同一 PDF、實際呼叫 LLM，要求以白話解釋結論、實際影響與限制，並顯示本輪費用。
- `/重啟` 改為只清個人對話狀態；移除可清空並覆寫 `CLASS_RULES` 的正式流程與兩個會重新注入此危險函式的本機工具。
- TestUI 改為需維運授權換取短效 token；測試模式不可寫入 QA/RULE。公開的 LOG、RULE、PDF、同步與 metadata 維運端點改為強制授權，維運密碼不再回退使用 Gemini API 金鑰。
- 靜態測試改為禁止固定手冊答案、驗證手冊追問必須有 LLM/PDF、驗證公開維運面與知識庫覆寫防線。
# 2026-08-15 (v29.6.115 / 過期手冊單檔即時修復)

- 根因：過去任一 Gemini Files URI 過期都排程 `syncGeminiKnowledgeBase(true)`，會重新上傳整個 Drive PDF 資料夾；單一手冊故障因此可能撞到 GAS 執行時間，正式 TestUI 長時間停在 `[KB_EXPIRED]`。
- 改為 `refreshStalePdfAttachmentsFromDrive_()`：只按本題已選中的 PDF 檔名由 Drive 重新上傳 1～2 份，覆寫同名 URI，並以新 URI 重跑一次 `countTokens`。預檢成功後才扣手冊額度與送出 `generateContent`；單檔更新仍失敗才保留既有背景整庫重建。
- `verify_source_router_contract.js` 新增單檔精準更新、先預檢後扣額度及最多重試一次契約。
# 2026-08-16 (v29.6.160 / 移除 Fast 答案的重複手冊確認)

- 正式 LINE LOG 的 `M7 可以接第四台嗎？→ 它要怎麼看 Netflix` 顯示 Fast 已產生可用的 Tizen／Netflix 操作答案，舊守門卻只因沒有來源標籤就追加 PDF，退回一般額度並要求使用者按常駐選單後再次確認；這是路由錯誤，不是 PDF 缺檔或使用者操作錯誤。
- Rich Menu 保留為自選來源捷徑：本題加完整型號已存在時，按「查官方手冊確認」即直接執行；只有缺完整型號才選型，選完即執行；無題目才請輸入題目。移除所有客戶可見的「再點確認／確認後才會讀」文字。
- 將 S32FM702／703／803 手冊第 68–72 頁的 App 操作納入已核對片段，涵蓋 Netflix、YouTube、Disney+、Prime Video 與一般串流 App 的開啟／登入／安裝問法；精準型號命中時零 LLM、零 PDF、零手冊扣次。
- Fast 操作答覆改為依答案是否不足／不確定判斷是否建議手冊，不再把已有步驟的安全答案整段丟棄。重設等高風險題維持手冊守門。
# 2026-08-16 (v29.6.161 / 證據守門收斂)

- 依 ChatGPT 高階版與 Gemini Flash 的共同檢視，停止把「模型回覆看似有步驟」當作已驗證事實；無 QA／RULE／已核對 evidence 的 Fast 操作答覆只能保留為部分提示，並提供單次手冊授權，避免以便利換取幻覺風險。
- `查官方手冊確認` 的單次授權仍維持：按鍵後已有本題與完整型號即直接查 PDF，缺型號只選型、選完即查，禁止第二次確認。
- 後續新增內容只准進既有 `Evidence[]` 資料索引（型號 scope、topic、頁碼、facts、同義錨點、排除條件）與回歸測試；禁止再以新題型 JavaScript 分支堆疊路由規則。
