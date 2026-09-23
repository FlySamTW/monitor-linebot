# Samsung LINE Bot 開發手冊 — v29.6.326 回答完整性與 PDF 生命週期契約

目前狀態以 [AI_CONTEXT.md](AI_CONTEXT.md) 與當次正式 health 為準。 本節是目前唯一回答與守門契約。本節為 v325 現行契約；下方舊版本段落保留歷史與回復依據，有衝突以本節為準。

## v325 回答完整性、候選判讀與背景生命週期契約

### 2026-09-23 v325 改善

- Worker HMAC 明確使用 UTF-8；已以真實端點證明 ASCII inspect 可通過認證而 Unicode inspect 在舊版回 `WORKER_AUTH`。本機 worker 回報失敗採 best-effort，不再讓二次回報覆蓋原始進度。
- AnswerEnvelope v2 新增 `requestItems` 最低需求清單；多子題沒有明確 `resolvedClaimIds`/request 對應時不得自動整題成功。數字以完整數值＋單位驗證，並零模型阻擋「來源切換→同時顯示」「HDMI→KVM」等能力擴張。
- 必要條件區分使用者可見條件與內部驗證限制，補入「切勿／請勿／不要」及 `only / must / do not / depending on model`。答案政策統一為 `qa-rule-v325-1`。
- 頁級 RAG 以 request item 分配最多五段證據，保存每段覆蓋需求與 `retrievalTruncated`；頁級命中仍只送文字片段給 Gemini 3.1 Flash-Lite，不附整本 PDF。
- Files API 續期改記逐檔上傳／到期／成功／失敗狀態；過期及 12 小時內到期優先，provider 無到期時間才以 48 小時保守推定。永久 provenance 拒絕只跳過相同 Drive identity，新 URI 失敗保留舊有效 URI。
- Web 搜尋收據額外保存 tool-call ID、query occurrences、request unique queries、provider grounding count 與 metadata 完整性；未知仍保守扣帳，不歸零。


QA／RULE → PDF → WEB 是證據優先順序。免費精準答案／有效快取先回覆；相關 QA 答案和 RULE 必須先進候選判讀，只有未解子題交給 PDF 或一次 Web。來源次數用完仍可完成 QA 候選判讀。一般 Fast 使用精準候選；尚未回答時，升來源前允許判讀較廣候選，但不得在相同候選、相同問題下重做判讀。JEV 仍僅在原本模糊追問條件做路由，候選選答只供編輯者 A/B；正式候選採 Lite，發布前須有實問比較證據。

候選召回必須涵蓋已存 QA 手冊答案，暖快取不得漏項。相關性門檻與可直接作答門檻分開；一般系列問題不能借單一型號的 QA。語意判讀接收完整 canonical 問句及新條件，不能只收到省略追問。上一題已驗證手冊答案可重用，但必須核對相同型號、程式版本、當前資料指紋、完成狀態及有效期。來源標籤由引用證據種類決定，RULE 不等於活動資料。

PDF 手冊回答是核心能力。主要路徑為自建頁級 RAG：索引免費召回已核實 PDF 原文，由 Gemini 整理並回填頁碼；無可靠頁級索引才使用受限的 Files API／inline PDF 直讀。managed Google File Search 尚未遷入正式流程。三者不可混稱，也不能用重用答案的零 PDF 呼叫取代實際手冊驗收。執行失敗狀態先於顯示格式保存，模型宣稱 full 但零證據通過時不能標 supported；清理器不得刪掉錯誤說明後只補官方來源。

### 2026-09-21 RAG 現況與最新官方查核

結論：既有頁級 RAG 可繼續改善與使用。使用者確認原始選擇 Files API／定期重傳的目的是避免儲存費，此要求持續有效。Files API 上傳與儲存免費，48小時到期刪除而非轉成付費；定期重傳是維持免費臨時附件可用的合理設計，不能只因重傳就判定有問題。保留續期及整本備援，改善重點為到期前覆蓋率、失敗接續、抽取與答案正確性；不可因減少上傳而導入付費快取或使手冊失效。

- 當次 Chrome 唯讀 LOG：A1039=2026/9/21 04:21:00，B1039 顯示 daily 同步完成、執行版本 v324；A1044=2026/9/21 20:59:01，B1044=`refreshed=10/10, cursor=39, total=77`。這證明當天背景有實際續期，不證明所有77份皆可回答。
- A853=2026/9/19 16:10:50，B853 的頁級 RAG 型號 F24T350FHC、pages=20,23,14,14,13、latencyMs=2362；B852 顯示 providerCoverage=full/validatedCoverage=full。這是既存雲端執行紀錄，不是本次新問答，也不是 LINE 收到訊息的證據。
- `dailyKnowledgeRefresh` 每日04:00做增量同步並補一批 URI；`manualPdfRollingRefresh` 每4小時一批、最多10份。`refreshManualPdfUriBatch_` 目前依游標選檔後直接上傳，未按 URI 到期時間或索引需求略過；每天不是整庫重建，但持續輪流重傳。`publishCompiledManualIndexes_` 會跳過相同 PDF/index SHA，worker 也依內容 SHA 快取，不會因日期改變重做相同索引。
- 以當次77份、每4小時10份計算，在批次都成功且文件集合穩定時，輪替最多8批／約32小時即可覆蓋一次，短於48小時；每日額外批次另提供餘裕。這是排程容量推算，單次10/10 LOG不證明每份皆及時續期。應先核對逐檔上傳時間、失敗與鎖略過再判斷需否調整，不能把免費上傳次數當生成費用，或把續期直接判為浪費。
- 主查詢 `findIndexedManualPagePlan_` 是文字詞項／別名／BM25 類型召回，至多5個相關片段，再交生成模型整理；沒有用 Files API URI 充當持久索引。原 PDF SHA、索引 SHA、型號、角色及頁碼驗證仍必須保留。
- `extract_pages` 使用 PyMuPDF 的 `get_text("blocks")` 與雙欄排序，沒有一般頁面 OCR／圖像語意抽取；`pageLabel` 尚為 null。圖示按鍵、掃描頁、複雜表格、印刷頁碼和PDF頁碼的差異仍是實際能力邊界，不能由「成功建索引」推定皆讀懂。
- 結構驗證能擋錯型號、來源ID、數字與部分限制，不能單獨證明「切換訊號來源」支持「同時顯示兩路畫面」。本次新增 JEV 語意驗證候選，但只在明確 LINE 驗收視窗啟用，尚無本次真實品質／總成本勝出證據。

官方資料（2026-09-21讀取）：[Files API](https://ai.google.dev/gemini-api/docs/files) 原始檔保存48小時且上傳儲存免費；這不等於模型讀取免費。[PDF文件理解](https://ai.google.dev/gemini-api/docs/document-processing) 支援 PDF 圖文，生成依實際用量計價。每日重新上傳不會讓模型永久記住內容。

[File Search](https://ai.google.dev/gemini-api/docs/file-search) 的索引持續保存至刪除或模型淘汰；儲存與查詢embedding免費，匯入embedding與回答tokens收費。最新支援清單包含3.1 Flash-Lite，故不能再說一定要升貴模型才能採用；支援文字與embedding-2多模態，和 Files API 並非同一服務。File Search與Google Search不能在同一請求一起啟用，符合本案逐來源處理方式。

「不必每48小時重傳」只適用已匯入 File Search 的持久索引或本機自建索引，不適用仍需提供模型讀取的過期 Files URI。[計價表](https://ai.google.dev/gemini-api/docs/pricing) 的 Context Caching 按時間儲存費是另一項產品，不能混稱 Files API 或 File Search 儲存費。若評估 File Search，應一次匯入、依內容變更更新，不把原本的每日續期照搬成每日付費重建embedding；比較完整費用及答案品質後才能決定。

外部實作與經驗只作設計參考，不能代替本案驗收：

- [Google官方File Search範例](https://github.com/google-gemini/cookbook/blob/main/quickstarts/File_Search.ipynb)：建立持久store、匯入完成後查詢，作隔離相容性比較的基準。
- [PyMuPDF4LLM](https://github.com/pymupdf/pymupdf4llm)：頁級metadata、表格、圖片與Markdown；適合與本案既有PyMuPDF抽取作同文件比較，不應直接全庫換抽取器。
- [Docling](https://github.com/docling-project/docling)：版面、表格、閱讀順序、OCR及provenance；可優先比較目前抽字不完整的手冊，需衡量本機資源和部署負擔。
- [llmspy/gemini](https://github.com/llmspy/gemini)：示範 SHA 去重、來源metadata、背景匯入與遠端對帳；不照搬先刪舊檔的流程，本案更新失敗保留舊版。
- [2026年社群討論](https://www.reddit.com/r/Rag/comments/1synetk/managed_rag_recommendations_googleopenai_file/) 建議先限制候選範圍、預先處理文件結構、量測延遲再換服務；屬使用者經驗，沒有本案效能保證。
- [Google論壇2026-08-24重現](https://discuss.ai.google.dev/t/file-search-store-api-returns-503-for-all-file-sizes-files-upload-works-fine/121691/5) 報告同一大型PDF在embedding-2匯入503而001成功；[2026-04引用缺失回報](https://discuss.ai.google.dev/t/bug-large-system-prompts-6k-chars-cause-file-search-to-silently-drop-grounding-metadata/137331) 亦提醒須驗真正引用。這些是特定環境回報，不代表現行服務全面不可用。

決策：保留自建頁級RAG及免費 Files API 輪替續期，改善抽取／召回／證據完整性；File Search列為同型號、同手冊、同模型、同問題的候選比較。歷史2026-09-05比較曾出現藍牙方向與頁碼錯誤，只證明當時方案未達本案標準，不能代替最新A/B。未取得新證據前不付費重建全庫、不新增服務、不宣稱已遷移或已完整驗收。

候選判讀不要求模型重抄引文。Lite v2 以 `evidenceRefs` 指向完整來源，逐子題產生自然答案、條件及未解項目；程式核對來源／型號／數值與必要條件，且 `conditions` 必須呈現在最後答案，不可只留內部 JSON。JEV 選段對照才使用既有摘錄、程式回填原文；兩者契約不可混稱。型號在驗證入口統一表示法，不能因有無前綴 L 誤拒同一個已登錄型號，也不能放寬成相似型號可通用。

### 避免多付費的候選判讀

QA/RULE 語意候選每次判讀最多一次生成。必要限制直接由引用來源回填至可見 conditions，仍拒絕錯型號、數字、無效來源與捏造條件；格式錯誤保留可驗證部分並停止，不自動再付一次修復，也不能因此轉 PDF/Web。這降低重試費，但真正無效輸出仍可能無法完成答案，不能宣稱品質完美。精準免費答案與快取優先；一般流量不新增 JEV 證據驗證。搜尋工具重複 query 不可直接去重當計費數，計數不確定須保存觀測次數並保守估算，不能當成實付。

2026-09-22同題複驗：H6/H8/H10各一次，共NT$0.067864，前次同三題含修復NT$0.087504；H8由0.016376略增至0.016424，故不可宣稱每題都變便宜。差異主要是H10取消第二次修復，不能歸功於JEV。複驗發現H6同句限制因句尾標點不同而重複，最終以純程式去重修正，並以既有實際輸出及單元案例驗證，不為格式再呼叫模型。雲端生成證據build與最後格式修正版build分列。完整歷史與收據見`test_runner/results/v324_generation_retest_20260922.json`。

### 編輯者模型比較與發布回復

`cost_verification.gs` 的 `runProviderCostReadback` 只讀共用帳本；`runGenerationModelComparison` 使用獨立的 `/dev?diagnostics=1` 維護頁。Google 原生 `/dev` 限專案編輯者；伺服器核對執行 URL 後核發15分鐘、綁定 build 的診斷 token，公開 `/exec` 不核發，匿名／過期／舊 build 一律拒絕。此頁只讀帳或比較模型，不是 TestUI，也不模擬 LINE 對話。比較先探測 2.5 Flash／3.1 Flash-Lite，再以同題、同一份 QA/RULE 證據測試；不會將 2.5 Flash-Lite 混入。診斷使用原批 NT$10 與月帳，404 只記錄，不換模型重送。以鎖保護比較開始狀態，結果逐筆分包保存；同 build 再執行只讀回，包括未完成結果，避免瀏覽器記錄讀取失敗導致重付。可用性／答案品質／整題成本分開判斷，未取得兩款可用結果不宣稱完成同題 A/B。

唯一入口 `tools/release_existing_webhook.ps1` 在上傳前保存正式版本／health 與雲端 HEAD 到 `output/release_state/head_<id>`；`clasp clone` 明確指定專案檔與輸出目錄，避免誤讀主要工作樹。回復同時還原既有 deployment 及備份 HEAD，再比對 health 與所有原始碼 SHA；不回復或清除 Properties、Sheet 或費用帳本。正式 health 必須同時匹配版本和 build。僅 StageOnly 會影響排程 HEAD，不等於正式 webhook 已更新。

使用者明確要求先切正式再自行 LINE 測試時，唯一入口支援 `-PublishForUserLineTest -UserLineTestAuthorization <JSON>`。授權紀錄保存實際指示、候選版本/build/hash、當次診斷報告路徑、未超額帳本及已通過核心旅程。此模式仍備份、檢查、更新既有 deployment、核對 health，失敗仍回復；成功僅標示 published_pending_user_line_test，`liveAccepted` 保持 false，不偽造真人封存，也不啟動 AI 30分鐘驗收視窗。預設正式定版守門不變。

正式封存報告必須包含 LINE 可見回答、真實 eventId／reply SHA／provider receipt ID 與版本/build對齊，且20條核心旅程至少19條通過、關鍵失敗0。傳輸成功或 TestUI 不能冒充 LINE 實測。LINE 工具若遭政策拒絕，記錄阻礙，不得藉其他通道繞過或把 `liveAccepted` 改為 true。

`-BeginLineAcceptance -LineReadinessReceipt <檔案>` 與 `-FinalizeLineAcceptance` 分別代表最多30分鐘候選及封存定版；ready receipt 必須包含實際 LINE 可操作、已設定 `LINE_ACCEPTANCE_V324` 的雲端讀回、actorHash、版本/build、batch/cap/spent/reserved、時窗和模型比較已審查。缺任何一項拒絕切正式。watchdog 以獨立隱藏 PowerShell 程序在期限到達時呼叫原入口回復，不另開 deployment；本機 mutex 阻擋發布／定版／回復並行。定版失敗立即回復；正式 health 不符也回復。流程已通過離線故障測試，尚無真實 LINE 候選／逾時實機驗證；電腦休眠或網路不可用仍可能延遲回復，watchdog錯誤保存在 release_state，不能宣稱供應商端硬期限保證。

2026-09-21編輯器實跑讀帳入口在 `Session.getActiveUser` 被拒，缺 `userinfo.email`；未讀到帳本、未呼叫模型。已改用上述 Google 原生 editor-only `/dev` 與短效 token，移除新入口的 Email 讀取，不新增權限。既有 `cost_report`／`lowcost_probe` 維護能力仍須沿授權入口使用，不公開免驗證函式。依據：[Google Web Apps 測試部署權限](https://developers.google.com/apps-script/guides/web#test_a_web_app_deployment)。

本輪Chrome實測診斷頁可讀帳並執行比較；1365×618視窗的按鈕、等待、結果狀態已實際檢視，沒有用此頁冒充LINE。2.5 Flash在本專案當次回404，3.1 Flash-Lite回200；三題候選判讀含一次格式修復，新增估算NT$0.087576，原批累計NT$3.937259392。這只能支持保留目前可用模型，不能宣稱兩模型完成同題A/B、全球模型停用或完整PDF/Web/LINE品質已通過。精確收據與答案見`test_runner/results/v324_generation_diagnostics_20260921.json`。

尚無產品身分且免費直答未命中時，同一次候選判讀額外回傳 `questionScope=general|model_specific|non_product`。通論由原句語意判斷，不能用「連接」等片段推定操作題；個別產品缺身分才問型號。一般產品知識若仍有缺口，直接以既有共享判讀結果進一次 Web，不讀任意型號 PDF，也不先做無證據 Fast。分類不是事實證據，不能據此捏造答案；空候選仍可分類，但 schema 禁止選取答案片段。

### PDF 成本與驗收歸因教訓（永久）

2026-09-05 的 v29.6.298 曾以 2.5 Flash、medium 直接讀取整本 244 頁手冊，驗收紀錄顯示 PDF 階段約 NT$0.5155、約43秒、routerCalls=0，仍漏掉第101頁的答案。當時曾將單次 ceiling 放寬到0.60；這個做法沒有解決召回問題，後續已撤回0.35。原始版本紀錄保留於 `docs/history/v29.6.302/Developer_Manual.md` 的 v298/v299 節、Git `b6508a1`。這是當時保存的真人驗收估算，不是本次重跑，也不是供應商帳單。

後續改為免費頁級檢索，送少量原文給模型整理；v301 同類旅程已有頁級生成約0.0038的紀錄，早於 JEV 導入。2026-09-19 本批兩次自我診斷頁級生成各約0.012896，另一次鍵鼠題0.023568，三次手冊分項合計0.04936。這些題目／文件與舊244頁測試不同，不能直接當成同題省費比例，也不能把成本改善歸功於 JEV。較低費用來自讀取範圍等因素，仍須核對當次模型、輸入、輸出與資料版本。

本次曾只報某題成功追問約0.02045，而整批實際估算已1.359835392，造成使用者以為是否做了50題。當時是30次有費用模型呼叫，包含不同方案比較、失敗與重測；另2次404拒絕為零費。最大失敗項目是一般影音問題：一次Web生成包含2個搜尋query，搜尋保守估算0.896，加生成後整題0.94152，卻未交付合格答案。這證明「少量問題」不代表少量呼叫，「模型單次便宜」也不代表答案總成本低；失敗成本不能隱藏在批次合計，搜尋免費餘額未核實時不能把估算稱為實付。

同批手冊驗收另發現兩條會白花錢的失敗路徑：一是模型宣稱完整，但型號適用性驗證全數失敗，舊文字清理器又刪掉失敗提示，只剩官方來源並誤標supported；二是QA候選要求模型重抄引文、型號表示未統一，使資料判讀先失敗，根本沒有進入PDF。修正須保留執行狀態、用程式回填引用原文、統一已登錄型號，不能以移除QA檢查、弱化手冊證據或追加Web付費掩蓋。

後續保留題再找到兩種相反失敗：通論含「連接埠」被操作關鍵詞攔截，零模型就要求型號；另一題沒有召回任何 QA／RULE，Fast 仍回答品牌軟體並被標 supported。前者無論升級哪個模型都無法改善，後者須先補正資料與驗證流程。評估模型能力時必須保存模型實際收到的輸入範圍與證據，不能把檢索漏失、過早攔截或顯示清理錯誤統稱為便宜模型能力不足。只有相同問題與證據的實際比較，才能支持升級決定。

16:34 實問另證實資料加工本身會製造碎片答案：術語描述拆段時刪掉名稱，模型只看到「用於…」「不是…」，最後照引文拼接也缺主詞。候選現保留每段 `subject`、以原始資料別名顯示主詞，相關定義召回由3筆增至5筆，再由同次語意判讀選取；不新增產品特例、不多叫一次模型。16:50同題0.010424的重測確認主詞保留，但仍只列相關軟體，完整比較未達標，故沒有通過品質發布。驗收必須看最終可讀答案，`complete=true`、引文存在或費用便宜都不能單獨當通過。

後續修改一律遵守：

- 分開記錄免費檢索、QA判讀、頁級生成、整本PDF、Web、答案重用與背景維護；使用者問手冊操作時仍須驗證實際手冊能力。
- 單一階段成本不能當整題總價，成功個案不能當批次代表；整題含路由、QA、PDF、Web、必要修復，整批再含A/B與所有失敗重測。
- 用量按模型當期每百萬tokens費率計算，再乘明示估算匯率；目前專案使用32 TWD/USD。缺usage不填0，日後改幣別／匯率／模型時須重核，不能沿用本文歷史數字當當期帳單。
- 費用比較須同題、同文件、同證據／版本，並驗證答案與引用。跨題數字只可說明不同路徑的成本規模，不能宣稱全面節省多少。
- 發布前保留「PDF證據全被拒絕仍不可空答或supported」、「已知答案不得重查」、「候選片段ID回填」、「新台幣計價及快取／思考費」測試；失敗先修本機與離線契約，再做最小必要實問，共用既有批次上限。
- 使用者未要求交付報告時，相關MD與Git保存原因、證據及不變式，對使用者回覆完成事項；不要反覆交付大份報告，也不要把寫文件當成實作／真人驗收完成。

### 模型與角色

- Fast、頁級 RAG、整本 PDF、Web、QA 合併／修改／潤稿固定 gemini-3.1-flash-lite；不因 THINK 常數或錯誤自動轉 3.7。PDF／Web 降價後品質仍須真人驗收。
- 2.5 Flash-Lite 與 2.5 Flash 是不同模型，只能經編輯者 lowcost_probe 檢查一次能否實際產生答案。2026-09-19 此專案兩者實際生成皆回 404，沒有取得答案；這不是全平台下架的證據。404 不重試，不自動換槽／換模型；可用後另做品質比較才能切換。
- providerPurpose 明列 fast、pdf、web、router、qa_semantic、qa_candidate、各 QA/RULE 維護、history_summary、message_helper、diagnostic、manual_cover。共用 providerFetch_ 檢查用途／模型搭配，不能依模型名稱猜用途。
- 每百萬 tokens 的 USD：2.5 Lite 0.10/0.40、2.5 Flash 0.30/2.50、3.1 Lite 0.25/1.50、3.7 Flash 0.75/3.75；輸出含思考。2026-09-19 核對，生效日期與模型分開記錄。此為估算費率，不是帳單實付。

### 搜尋工具與多段回覆

Google Search 工具啟用不代表模型一定執行搜尋。Web 提示要求先用一個精簡查詢查證，但這不是供應商查詢數硬限制。使用官方 `toolConfig.includeServerSideToolInvocations=true` 保存工具執行跡象，查詢數先採 `groundingMetadata.webSearchQueries`，缺漏時採官方 `toolCall.toolType=GOOGLE_SEARCH_WEB` 的 `args.queries`；兩者皆缺仍列未知、保守入帳，不得自動填零或盲目重送。工具 trace 只證明查詢，不代替答案的 groundingSupports／來源驗證。

Gemini 回覆可含多個 parts；工具、思考或簽章可能在文字之前。答案須合併所有非 thought 文字，不能只取 parts[0].text。LOG／持久收據只保存 responseId、用量、查詢數與費用狀態，不記思考文字、簽章或完整工具回傳。[官方工具執行紀錄](https://ai.google.dev/gemini-api/docs/generate-content/tool-combination)

16:20 候選通論實測已通過範圍判讀，但一次 Web 回傳缺搜尋 metadata；生成估算 NT$0.028392（含 QA 判讀），搜尋待核對預留 NT$1.344，合計 NT$1.372392。這是失敗及未知成本，不得當成已證實搜尋三次或實付 NT$1.344，也不得清帳重測。

16:34 Web 回歸已實際觀察 `traceCalls=1`、`queryCount=2`，但仍無 groundingMetadata；總估算0.918432，答案不合格。此時不能再把無 metadata 說成「未搜尋」；工具執行與引用覆蓋是不同結果。AI Studio 同專案 GenerateContent storage 為關閉，沒有既有原始 response 可讀回；未擅自啟用全流量儲存。一般用量頁不提供本月搜尋 query 總量，因此仍不能核實共享免費餘額。

若需後續排除傳輸介面問題，可用同模型、同題對照官方 Interactions API 的 typed steps／annotations／grounding 用量；官方列3.1 Flash-Lite可用，generateContent亦仍受支援。這是待驗證替代路徑，不是已解決，也不能自動切正式、改高價模型、清帳或縮小搜尋預留來硬塞測試。驗收需 `store=false` 保持既有不儲存行為，所有入口仍經共用費用守門。[官方介面及支援模型](https://ai.google.dev/gemini-api/docs/interactions-overview)

### 首頁隔離與索引收據

1. 雲端核對官方下載 URL、support page 與單一 SKU，下載檔案取得原始 SHA，只排入 MANUAL_INSPECT_<SKU>；未核實文件不能直接入庫。
2. 簽章本機 worker 用 PyMuPDF 抽真正第一頁文字。足夠識別即零 LLM；必要時送首頁文字或單頁 PNG，禁止 PDF file URI。圖片 SHA 僅作衍生證據，不取代原 PDF SHA。
3. 抽取結果鍵含原 PDF SHA、pymupdf-page1-v1 與 cover-v326-1。相同內容跨 SKU 共用抽取，但 SKU／地區／使用手冊角色各自驗證；Product Guide／快速入門不可冒充使用手冊。
4. 抽取成功後寫獨立 receipt，SKU 通過才建 verified pending。單次付費嘗試先落盤，逾時／程序中斷也不得再次付費；後段失敗只接續未完成階段。
5. 本機 content-cache 依 SHA／政策保存已下載 PDF、verified-index.json 與 index-receipt.json。重跑先重算檔案 SHA，通過才重用；抽字與建索引不叫 LLM。
6. prepare 維持不可變 PDF/index、單一 MANUAL_WORKER_BUNDLE 原子切換；MANUAL_PROGRESS_<model> 先是 activated_pending_probe，實際 PDF 與 index 雙 SHA 讀回後才是 verified_ready。啟用後中斷可只 probe，不重新核驗或建索引。
7. inspections 的 retry_wait、索引 index_retry_wait 皆至少隔一天，同 SHA／政策同階段最多三次；永久不適用或已送出但結果不明變 blocked。更改內容／政策或有明確修復證據才重開，不能每天洗掉失敗紀錄。
8. worker 回傳失敗 stage、HTTP status、error code、nextRetryAt，不能只存 HTTPError。舊 compiled 文件被有效 worker 版本完整取代時不再算 stale；部分未覆蓋仍要查真正缺口。

### 共用費用帳與錯誤分類

- 月總帳沿用既有 seed、90 元停止線。2026-09-19 Chrome 讀回正確 Cloud 專案原為 90 元上限；使用者明確授權後已存成 50 元並讀回。當次預付餘額約 167 元、自動儲值關閉；舊文件的 391 元不可沿用。外部數字以當次帳單讀回為準，Cloud 限額存在處理延遲。任何新分類不能清掉既有花費。
- manual_cover 預留每次最多 NT$0.05、每日 NT$0.10、每月 NT$1。2026-09-13～19 已有 LOG 估算 2.657128 元納入本月背景分類起始值，沒有再加到已含這些費用的月總帳；所以九月後續背景付費辨識暫停，免費抽取／索引仍可執行。
- PDF 原本每次 0.35 元上限保留。同題所有模型最多五次、共用 2 元預留／結算，包含路由、候選、PDF、Web與修復；重試不重建預算。
- 每次生成先持久保存 PROVIDER_ATTEMPT_<id> reserved，送出前 sent，結算後 settled；含用途、模型、輸入範圍、payload SHA、輸入／輸出上限、預留、cost status、查詢數。近 80 筆已結算保留 Properties，完整收據寫 LOG；未結算不自動過期／退款。
- 本次使用者已將同一驗收批次 `v324-cost-remediation` 的累計上限授權為 NT$10；保留既有支出、verificationV303、其他批次與月總額，不重開帳。本次以真實 LINE 輸入／收訊驗收，不先跑 TestUI。候選 `LINE_ACCEPTANCE_V324` 只允許指定使用者雜湊、版本/build及最長30分鐘視窗套用同一批次；到期不得轉為一般流量逃過驗收上限。尚未設定或啟用任何正式驗收視窗。
- reported 為供應商費用；estimated 為 token／工具費推算；unknown 為缺用量／結果不明。cost:null 不能變零；明確 4xx 拒絕與送出後逾時分開，後者保留保守費用。
- 搜尋 2.5 按 grounded prompt（每日共享免費 1500）；3.x 按 query（每月共享免費 5000）；費率分別 USD 0.035、0.014。免費用量起始未由編輯者核實就保守計費，不能只因本程式計數小就當免費。一次生成可有多次搜尋，3.x 暫預留三個 query 不等於供應商硬封頂；依實際數量結算，超支限制後續呼叫。
- 格式/schema/摘錄驗證錯誤、provider 失敗、預算不足為執行失敗，不是缺資料；不能重送整份 PDF 或自動 Web。只有可驗證的資料缺口能升來源。
- 有效片段逐子題保留；共用手冊可用的條件式操作要保留限制，不因頁面有 caveat 就丟答案。通用網頁方法標明條件，不能證明特定型號能力；禁止數值關係或跨款類推。無可靠資料仍交付確認內容、限制與下一步。

### 發布驗證

唯一入口 release_existing_webhook.ps1 自動跑 static、contract、production-contract、diff。費用鐵律回歸必須覆蓋缺用途、貴模型、整本首頁、null cost、搜尋多查詢、未知費、重試上限、分階段接續、schema失敗、已確認部分保留。模型或費率超過基線時測試阻擋，必須更新比較證據；不能單以相容性修復略過。

候選方案比較使用同一批 QA/RULE 候選；只在驗收雙跑。勝出看完整正確率、漏 QA、無效 PDF/Web、每個正確可用答案的總成本。20 核心旅程至少 19 可用；五題預先封存通論題見 test_runner/v324_holdout_cases.json，不能為保留題增添專用程式。本次依使用者要求以真實 LINE 輸入／可見回答驗收，不先跑 TestUI；worker、LOG、正式 health 與離線結果分列。LINE Reply API 接受送出仍須核對實際可見回答，不能冒充已收訊。JEV 新增證據判讀只在上述驗收視窗啟用，正式一般流量保持既有條件路由；未取得真實品質／總成本證據不得擴大。

官方依據：[PDF FileData](https://ai.google.dev/api/generate-content#FileData)、[模型價格](https://ai.google.dev/gemini-api/docs/pricing)、[搜尋計費](https://ai.google.dev/gemini-api/docs/google-search)、[JEV Choice](https://docs.typesafe.ai/primitives/choice)、[Retrieve/Rerank](https://www.sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html)。

## v29.6.320 JEV Semantic Router 契約

- 固定 `typesafe/jev-1.13`，呼叫 OpenRouter `POST /api/alpha/decisions`；不使用 Chat Completions，也不使用浮動 latest 作正式版本。
- `OPENROUTER_API_KEY` 只放 ScriptProperties；Authorization 只在共用 provider gateway 加入 Header，不得進 URL、repo、LOG 或 TestUI 回傳。
- JEV 只判斷：新題／追問／歧義、是否複合主張、是否需要型號手冊、是否需要即時 Web、主要 intent、是否真的需要語意澄清。它不產生產品答案、不讀 PDF、不掛 Web、不選產品事實。
- claim 文字由程式 deterministic 建立：省略式追問沿用 `resolvePersistentFollowupQuestion_()`；已確認完整型號是權威狀態，多候選由既有選型器處理。
- 精準 QA2、完整 RULE、已確認型號的明確操作題與可判定 current-info 題仍在 Router 前零成本結束；JEV 不得變成每題必經服務。
- JEV Decisions API 仍經共用月預算預留／結算與 TestUI 驗收帳本；OpenRouter usage.cost 優先作實際費用，缺 usage 時保守列待核對。
- JEV 失敗、缺 key、HTTP 失敗或低信心時不得自行補產品事實；沿用既有安全 fallback／澄清／來源狀態機。

## v29.6.319 雙專案冷備援契約

- 停權屬 Google Cloud 專案／憑證層，LINE webhook、QA／RULE、Drive 索引與程式不應一起停擺；免費答案照常，付費路徑熔斷。
- 正式 Gemini URL 禁止含 API key；只由 `providerFetch_` 加入 `x-goog-api-key`。回歸測試須核對送出的 URL 無 key、Header 有 key、內部選項未外送。
- ScriptProperties：`GEMINI_API_KEY_PRIMARY` 可選；沒有時回相容舊 `GEMINI_API_KEY`。備援只寫 `GEMINI_API_KEY_STANDBY`；`GEMINI_ACTIVE_KEY_SLOT=primary|standby` 是唯一 active 指標。key 不入 Git、文件、URL、LOG 或外部 AI。啟用前必須逐一實測所有相異正式模型；models.list 只能診斷，不能授權切換。
- 備援 Cloud 專案為 `shining-sphinx-508304-f9`；2026-09-11 綁定獨立 `My Billing Account` 後依 Google 新制預付 NT$170，auto-reload 關閉，AI Studio 專案月上限 NT$90。程式端仍在 NT$90 前停止新付費請求；兩層皆有約 10 分鐘帳務延遲風險。
- v319 真人 TestUI 啟用證據：standby 指紋 `ed8221d46a54f0b9`，3.1／3.7 共 2 次極小生成皆成功，健康成本約 NT$0.000328。舊 primary 仍為 suspended，不重試。
- 不做自動 failover。`CONSUMER_SUSPENDED`、403、429、5xx 皆不得在同一題自動改用 standby；原因是帳戶／政策限制可能同時影響兩專案，而自動重送會有雙重費用及兩把 key 一起停用的風險。
- TestUI 編輯者維護區可讀狀態、設定 standby（儲存後仍不啟用）、列出 standby 可用模型、單獨檢查兩槽與「驗證並啟用」。models.list 是零生成診斷；啟用仍必須當次核准模型健康檢查成功，並在 lock 內再核對指紋才切換。輸出只有安全狀態、模型名稱與指紋，絕不回傳金鑰或原始錯誤本文。
- 切換後再各驗證 QA、PDF、Web 一題及雲端 LOG。LINE deployment／webhook、Drive 索引、worker 與 Rich Menu 不重建；Files API 暫存檔由既有流程重傳。
- Gemini Files API 暫存檔屬專案且會過期，換專案後按既有流程重新上傳；本機 QA／RULE、Drive PDF、逐頁索引與 worker bundle 不需重建。申訴可繼續，但不能作為營運唯一復原方案。

## v29.6.313 Smart／Tizen 與供應商失敗契約（正式 @1494）

9/10「那要怎麼重設回出廠值」的正式紀錄是：型號 `S32FM703UC` 與 `factory_reset` 索引皆正確，Gemini 卻以 `CONSUMER_SUSPENDED` 拒絕 PDF 生成；隨後 Web 又用同一憑證重送。這是服務未完成，不是手冊沒有答案。此批不換模型、不增加每題 Router，也不改 Prompt。

- 共用供應商結果固定分成 `success／no_evidence／credential_denied／permission_denied／resource_denied／transient／usage_unknown`。只有成功生成後仍缺引用才是 `no_evidence`；403／停用憑證不得改寫成查無資料。
- `credential_denied` 以金鑰雜湊指紋開啟熔斷：同一憑證的 Router、PDF、Web 與上傳立即停止，避免店員每問一題就再撞一次。管理入口 `provider_health` 只做一次低價 2.5 Flash-Lite 健康檢查；成功才解除，不由一般對話自行重試。
- 明確拒絕的請求結算為零、解除月預留並退還本輪來源額度；逾時、傳輸中斷或缺 usage 仍依原契約保守列待核對。預留不是實際費用。使用者只看到「查詢服務暫時連不上，不是你的問題；未完成不扣次」。
- 全部 LOG 先經秘密遮蔽。編輯者 TestUI 提供「驗證 Gemini 恢復並解除停用」與「遮蔽既有 LOG 金鑰」；`redact_logs` 只覆寫近 1,200 列中暴露的憑證，不刪整份紀錄，新 LOG 不得落入明文 API key。
- `Smart Monitor／Smart螢幕` 是 M5／M7／M8／M9 產品家族；`Smart系列／Smart／Tizen` 是功能平台。`Smart View／SmartThings／Smart Hub` 各自保留名稱，不能靠 Smart 單字混成產品家族。
- 固定先辨識範圍，再找證據，再判斷要不要追問。平台共通操作有已核實片段就直接答；明講 Smart Monitor 且答案因機型不同才選 M5～M9。已鎖定 Tizen 型號則沿用該型號，不重問。
- `回出廠值／恢復原廠` 明確代表整機資料重設；`重開機／重設 Smart Hub／重設畫面／重設音效` 是不同操作。只說「重設」且沒有上下文時，只問一次要重設哪一部分，不要求完整型號；店員選定後接回原題並立即到達答案。
- 守門紀錄要留下 `action=skip/run` 與原因。完整 QA／RULE、系列平台對照、已核實操作片段與明確來源按鍵均略過；只有指涉不明、複合主張或新增限制衝突才最多一次 Router。

回歸必須包含：裸 `Smart 怎麼重置` 一次範圍澄清、`整台恢復出廠` 接續直接回答、已鎖定 M7 的口語出廠重設零模型，以及停用憑證的退款／熔斷／遮蔽／不再 Web。測試成功必須同時核對答案、來源、呼叫數、費用與狀態，不得只看有文字。

**歷史：2026-09-08 v29.6.306 @1487：** guarded release、local／HEAD／health一致。59項離線整合與全庫載入通過；Chrome17次文字／按鍵事件包含修正前失敗及重測，詳見[逐題實測](test_runner/results/v306_live_20260908.md)。新增約NT$0.073、共用驗證帳2.1352；沒有改模型／Prompt!C3／Rich Menu。完整20條旅程、全自動新PDF索引與外部資料缺口仍不能列完成。

唯一現行設計契約。正式程式已發布；**外部供應商恢復與真人付費路徑仍未驗收，不能混稱完成。** 實際進度見 DEVELOPMENT_LOG.md／test_runner/results。此前完整文件保存在 [歷史快照](docs/history/v29.6.302/Developer_Manual.md)，其中舊額度、旁路或模型政策不得重新套回正式服務。

**歷史發布狀態：2026-09-05 已以唯一 guarded release 上線 @1486，v29.6.305 [17:03]；local／HEAD／formal health相符。** 57項完整來源整合、static／contract及全庫驗證通過；47份索引全部雲端讀回啟用，覆蓋81筆範圍登錄／136型號。Chrome真實供應商複驗G932 PBP、F24護眼、同聊天室切H704自我診斷均有正確手冊路徑，每題1次Lite、零Web／Router。共同驗證費約NT$2.0622（本批約0.4727），未改模型／Prompt／Rich Menu。五個官方來源適用性缺口及全案20旅程、手機LINE驗收不可混稱完成。詳細見[實測與發布紀錄](test_runner/results/v305_manual_library_20260905.md)。

## 決策原委

給台灣三星螢幕店員的同事型助手，便宜優先兼顧正確與速度。稱呼「你」，可直接說 Sam；只答有來源的產品事實，不求萬能、不用工程術語或重複結論湊內容。

G9 選型後轉護眼、Infinity Core 網搜變 CPU、G95SD 借 Ark 的 Eclipse Lighting、PBP 借全機120Hz、共用 PDF SHA 混版，分別是問題／語義／範圍／關係／資料版本缺口；增加高階模型不能取代這些守門。
v302 單一 PBP canary 與固定13類片段不等於整庫 RAG 驗收。v303 改為已核實文件的完整逐頁索引按原題召回；v305將原6筆／17型號擴為81筆範圍登錄／136完整型號、47份不同PDF。登錄數不等於不同PDF數，也不宣稱剩餘5個資料缺口已解決。正式啟用狀態以本批雲端讀回報告為準。

## 唯一回答與守門契約

`控制／冪等／型號 → 免費 QA／RULE → 必要的官方 PDF → 未解主張一次 Web → 有用終點`

- 沿用 AnswerEnvelope／RouteAnalysisV1／持久 product topic；共用真正原題、型號、功能、claims、evidenceRefs、未解部分及已執行來源，不另建競爭路由。內部補充 prompt 不得當原題。
- QA 同時符合意圖與產品範圍。系列共識可答就不選型；答案因機型而異才選。補型號接回原題；型號跨日保存，明確換系列解除舊綁定。
- 家族辨識包含句中的 Smart螢幕／顯示器，不只句首Smart或完整Smart Monitor。家族已明講且現有QA完整命中時，免費回答先於再問M5/M7/M8/M9；有線「接螢幕」與「充幾瓦」仍分不同意圖。
- 取消／N／/取消永遠先走同一來源控制入口，即使沒有pending也零LLM、零提問額度；清待選型／澄清／中斷恢復，不清持久型號或費用帳。
- 新限制不能因上一輪有 plan 而丟失。例如「那兩邊都120Hz嗎」保留 PBP 主題＋新限制。明確新功能不能沿用舊題。
- 按手冊／網路即授權，不再確認；缺必要資料自動往 PDF，未解部分一次非三星公開 Web 補救（個人網搜不扣，系統每日最多3次）。網路不附 PDF，已解部分不重做。
- 有結果不等於答對。無證據時保留未知、已知事實、明示未證實方向、安全下一步／官網連結／請 Sam 補 QA，不拿無關連結充數。
- 再詳細最多成功一次，必須新增資訊。不能生成後只剩查詢按鈕。相同題／型號／來源／資料與驗證政策版本重按用快取；operationId 防連點。
- LINE 只呈現答案、必要步驟／限制、精簡來源與「約 NT$…｜模型…／未使用模型」。不重複內部證據摘錄。一般回答禁止 Push；等待動畫盡早送出，平台不支援的聊天室不能保證顯示。

| 情境 | Router |
|---|---|
| 精準 QA、完整 RULE、已驗證答案 | 0次 |
| RULE 系列可解析、單純補型號、明確來源按鍵 | 0次 |
| 已確認型號的單一明確操作、同操作省略重述 | 0次 |
| 指涉不明、意圖衝突、複合題、新限制難解析 | 最多1次，短結構化分析 |

Fast／頁級／Polish 固定3.1 Flash-Lite，整本PDF／Web固定3.7 Flash；條件式 Semantic Router 固定 JEV 1.13，且不擴到每題。Router 無工具／無產品答案；候選型號與 claim 文字由程式決定，JEV 只回 typed decisions。低信心、HTTP 或格式失敗不重試產品事實，回既有安全路徑。

## v307 自動索引 worker 正式契約

新PDF完整版本包已於v307正式雲端完成M7／F612端到端；無人排程亦已真啟動讀回LastTaskResult=0與成功health，具可核對E2E及排程成功證據。既有PDF發現／首頁驗證仍依現行受費用守門流程，worker抽頁本身不呼叫LLM、不增加付費服務。

1. `stageOfficialTwManualCandidate_`把已核實單一SKU、官方URL、PDF SHA、文件角色寫入`workerBinding`；舊pending缺binding不可直接信任，須重新核實。不得從共用檔名繼承整群型號或替外部缺口猜範圍。編輯者短token入口`queueReviewedRegisteredManualFromTestUi(docKey,token)`只讀精確已登錄人工核實metadata，可排外區reviewed版本，不接受client自填scope／SHA／來源。
2. `tools/manual_index_worker.py`在既有Windows以官方HTTP下載，核SHA後呼叫同一`build_manual_page_index.py`的`build_document`。逐筆失敗仍繼續其他候選，最多20筆／次，從去敏報告`lastAttempted`游標輪替，避免前列永久失敗餓死後續候選；空佇列不代表曾成功建過索引。
3. 既有Webhook識別`manual-index-worker-v1`，獨立64-hex秘密HMAC簽署protocol／timestamp／nonce／action／原字串payload；5分鐘TTL、持久防重播及大小限制。只允許`list/prepare/probe/health`；秘密只經編輯者維護短token設定，不輸出、不交外部AI、不存repo。
4. 一般PDF由GAS再次官方下載核SHA，驗索引checksum、頁數／詞索引／pageHash與文字結構。reviewed ZIP由本機核archive SHA、精確唯一entry及PDF SHA；F612 ZIP約60.5MB，不由GAS整包下載，同一簽章prepare可傳最多8MiB PDF，body最多12MiB，GAS核已登錄PDF／索引SHA後才寫入。PDF存`_MANUAL_WORKER_REVISIONS/<SHA>/<既有命名>.pdf`；資料夾／PDF／gzip／bundle一律Advanced Drive v3 `supportsAllDrives:true`建立並讀回。單一`MANUAL_WORKER_BUNDLE`指標是唯一生效點，保留previous及舊檔；同revision重送復用，舊base或pending已變拒絕。
5. `manual_worker_runtime.gs`每請求讀同一bundle，僅覆蓋已核實SKU，不凍結其他compiled文件。頁檢索、manifest、PDF recovery及最終附件共用同SHA；缺新索引不借舊compiled頁，缺新PDF不退回root舊檔。`probe`核實不可變PDF及index兩個SHA；`health`僅代表worker回報時間與結果，不取代probe。
6. `tools/run_manual_index_worker.ps1`鎖定既有正式endpoint、Local mutex防同session重跑。`--secret-file`讀受限本機JSON `{endpoint,secret}`；`--report`寫去敏`last-run.json`。排程依賴這台Windows、Python／requests／PyMuPDF及網路可用，不是GAS能自行執行PyMuPDF；新排程須先單次正式端到端通過，不能先建空殼。

目前證據：`node test_runner/verify_manual_index_worker.js` 30項通過，載入root GAS、只模擬外部I/O，涵蓋SHA／失敗保舊／重跑／冷啟動／下一SHA／缺檔／附件／health／Python報告，以及ZIP錯entry、重複、路徑、炸彈與真F612 PDF＋索引的舊manifest原子換版。真官方M7 PDF244頁及F612 ZIP下載／雙SHA核對通過；雲端prepare與probe另已實測成功，排程／手機LINE不可由此冒稱通過。reviewed同SHA使用`tools/data/manual_index_packages/<indexSHA>.json`已核對追蹤資產，output僅fallback；query新詞映射不強制重建既有索引，一般新PDF仍自動build。

交接最短路徑：先查當次health／LOG與`workerHealth`、讀去敏報告 → 執行worker離線測試 → 編輯者核實來源排入canary → 正式worker一次`prepare/probe`及Bot讀回 → 留存revision、PDF/index SHA、結果及零worker生成費用 → 才建排程並核對實際LastTaskResult／報告時間。遇秘密／來源／SHA／頁數／容量錯誤，停在精確錯誤，不放寬守門、不換模型、不重設正式資料。發布只用既有guarded入口；主責完成雲端證據後再更新本節狀態。

外部範圍：F612官方英文38頁手冊印刷封面S27F61*完整匹配，index SHA `1de245a1c37998a06a77160b381946333177dbfebeff7d867687ca79de7f7b4f`，已由正式worker啟用且PDF／索引SHA probe成功；保留英文／外區與選配限制。S27D392GAC、S32D392GAC及S32AM703UC目前外區資料只作參考，不充當台灣適用證據；M9已核實HTML入口不等於PDF頁級ready。詳見[V307_OFFICIAL_GAPS](docs/V307_OFFICIAL_GAPS.md)。

## 手冊與 Evidence

- v307檢索query以通用方向結構正規化處理「後面的／後側的／後方的」等語法，原canonical題及型號／關係驗證不變。沿用既有lexicon的relatedTerms召回，不把Core Lighting與其他燈效判為同一能力；四種自然後方燈問法已真全庫召回G9第115頁，PBP選單及H704警語回歸通過。未重建47份PDF索引，也不以離線召回冒稱live答案已通過。

- v306 操作回答從同一已採用設定段保留必要警語，先去除PDF排版破折號再去重；不加第二次生成。明確禁止／不支援是可成立的否定答案，不應僅因不能提供正向做法而標記未解；仍須核對全部主張與適用条件。
- 覆蓋報告納入已啟用且SHA／checksum吻合的頁索引，統一型號母集合；一次盤點只讀一次manifest快照，不對81筆登錄逐筆讀遠端屬性。聊天單題仍讀當次版本，不延用跨請求舊快照。
- 自動新SHA先記PENDING_PAGE_INDEX並保留舊完整版本；具有效workerBinding的相同SKU/SHA不重付首頁驗證費。v307已由上述worker建立完整版本包且正式端到端通過，排程實跑亦已成功讀回，不得以放寬SHA解除阻擋。

- config/manual_registry.json 保存完整型號／料號、文件角色、適用範圍、來源／支援頁、SHA。檔名只辨識：維持無國家碼、型號本體排序逗號命名，不盲刪全部尾字母造成不同款碰撞。
- tools/build_manual_page_index.py 驗證 SHA 後產生完整 lex/pages。manual_index_runtime.gs 按原題 BM25 查頁，保留標題、表格、步驟與限制。PBP/PIP/多重視窗等 related aliases 只擴召回，不證明等價能力。
- v305雙欄事故：不能把左右欄依y座標交錯，否則Self Diagnosis會混到別欄／下一列Software Update的機型限定。產生器以實際欄間空隙分欄，再保留設定列、後續步驟及註記為同一layoutSection；檢索回填完整段落，不能只丟欄位名。一般單欄頁維持原路徑。
- 印出的選單章節＋設定欄位是證據結構，可回填`menuPath`，不可憑空補首頁按鍵。僅當**單一同名操作**、完整型號／原文驗證成立、沒有數值／新增限制／複合主張時，程式可據此判定完成；G8的PBP與多重視窗不能只憑相關名稱套用。模型仍不能偽造頁碼／證據ID。表格接續頁至多回看連續3頁，無明確章節、表格中斷或跨雙欄歧義就不拼接；保留前頁標題及限定原文並列兩頁引用。F24的正確證據為第18頁Picture標題＋第20頁Eye Saver Mode，不能誤作Color選單。
- 頁級召回使用既有RULE術語的中英別名；名稱不完整時只接受唯一術語匹配，別名只協助找頁，不證明功能相同。G932等RULE唯一實體可直接鎖型號；G8多款仍需必要的選型，不能先花Fast才知道缺型號。
- ManualRevision 綁 PDF SHA＋indexChecksum。Drive gzip index 讀回 SHA 通過才切 MANUAL_ACTIVE，保留 MANUAL_PREVIOUS；相同 compiled 版提供讀取備援。索引過時回現行受成本限制 PDF，不能混新 PDF／舊頁面。
- v305新索引存Drive，正式程式僅攜帶型號／SHA／checksum；原6筆保留同版本壓縮備援。同PDF共享內容不能合併型號適用性。匯入JSON只能提供已登錄checksum的壓縮內容，不能指定型號、來源或Drive ID；編輯者/dev及短token雙守門，逐包讀回後才發佈指標，重送復用已驗證檔。編輯者匯入期間滑動續期15分鐘；一般問答token不延長。
- Chrome文字備援使用package產生的`editor_import_001.json`等每包不超過6MB；不要把全庫13MB持續貼進同一textarea，否則輸入延遲可能超過瀏覽器控制逾時。這是輸入效能限制，不是權限或Gemini錯誤，不應要求Sam重新授權。每批完成再換下一批，正式索引指標不因中途停止而損毀。
- 維護流程：`audit_manual_library.py`盤點→`resolve_manual_library.py`核對台灣支援頁／官方下載→`build_manual_page_index.py`產生候選→`package_manual_library.py`輸出精簡程式與匯入包→guarded StageOnly→TestUI選取匯入包→讀回與提問→guarded正式發布。新SHA僅重建受影響文件用`refresh_manual_index_candidate.py`；`--resume-doc-key`只適用已確認之前各包成功的續傳。禁止把13MB暫存全庫直接當正式程式；output整個排除clasp。
- 事故規則：Samsung下載分類UM亦包含Product Guide，較新產品指南不能覆蓋操作手冊。首頁明確型號/實際星號範圍可建立候選，不能靠檔名；多SHA衝突改核對官方支援頁。明確首頁矛盾、DRM非PDF或只有產品指南列缺口，不假裝手冊已可用。2026-09-05 H704本機9CCD舊版被雲端D859阻擋，改取官方D859及新索引，禁止放寬SHA守門。
- PDF可查、頁級索引ready、worker最近成功與無人排程分別回報。未登錄但已驗證文件可保留既有PDF路線並排背景索引；v307完整worker已正式E2E通過，且無人排程已真啟動成功；仍依本機登入、網路與Python可用條件執行。日常問答不需Sam手動重啟。
- promotion 失敗只留 pending，禁止暫存 Gemini URI／新 SHA 覆蓋有效 manifest；備份、讀回、失敗回復；manifest 短鎖，慢同步不持有聊天預算鎖。每日 lease 成功去重，保留已有 daily／4小時 URI 續期 trigger。
- 模型只選 evidenceId，程式回填頁碼／原文／SHA。驗證型號、家族、原題功能與條件關係；不得因 PBP 與120Hz分別出現就推為每側120Hz。
- 「依型號可能不支援」只在驗證文件綁定＋獨立完整型號 RULE／QA 能力成立時支持單一共通入口；數值／限制不放寬，原文限制保留。另一家族的例外不當成目前型號證據。
- 只有相關操作要明示 partial，不能由整群 alias 開關強迫 full。找不到可靠文字才走受限 PDF 直讀；已頁級生成後不盲目再讀全本，Web 只補未解主張。

## 費用與技術

- 每聊天室台北每日一般10／手冊2／網路5；系統 Web 補救3。取消／選型／預檢阻擋不扣；供應商已送出來源扣一次；429/5xx 一次退避沿用 grant，但每次供應商請求都算成本。
- providerFetch_ 是生成共同入口（含背景與測試）：模型白名單→月預留→来源配額→fetch→usage結算。缺usage／送出後網路失敗保留保守估算，不能填0。
- 月 NT$90 應用停止線，留10元匯差／在途緩衝。2026-09-05 Chrome 已讀回 Sam-Paid-Project／Gemini API 本月 NT$5.58，Cloud 強制上限實際為 NT$90（名稱寫100並非設定值）。候選程式首次請求可用限定本 Script ID、本月、24小時內有效的讀回紀錄向上取整為 NT$6 初始化；過期或其他專案須重新讀回，禁止假設歷史為0。既有月帳不覆蓋，新月從0起。免費答案不受付費停止線影響。此初始化須以實際日誌確認，不能把候選程式視為已生效。
- 2026-09-05 [Google Standard 價格](https://ai.google.dev/gemini-api/docs/pricing)：每百萬 input/output，2.5 Lite US$0.10/0.40、2.5 Flash 0.30/2.50；3.7 Flash 2026年0.75/3.75，2027起1.50/7.50。output包含thinking、cached input另折價；本案未啟用付費 cache storage。
- 2.5 Search共享每日1500次免費 grounding，不代表文字生成免費。其他客戶端的共享額度未知，費用只能說約，不能保證與帳單完全一致。
- [Cloud Spend Cap](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps) 已支援 Gemini API；須讀回本專案／服務／NT$100幣別。封頂不是即時中斷，不能承諾絕不超額。
- [File Search](https://ai.google.dev/gemini-api/docs/generate-content/file-search) legacy generateContent 支援2.5 Flash-Lite；舊「一定換API、貴模型、儲存收費」廢止。本批隔離相容性及同本10題A/B前不遷移。Files API 整本附件不是 managed File Search。

## 三來源使用者旅程與不可回歸矩陣

按鍵即授權與執行；Quick Reply最多3個，Rich Menu保留；手冊 → 網路 → 再手冊 沿用同題型號與快取。

| ID | 旅程 | 終點 |
|---|---|---|
| R01 | 精準QA | 0 Router/PDF/Web，答原題 |
| R02 | 系列共通規格 | 有證據直接答，不細問代別 |
| R03 | G8操作型號不完整 | 列RULE候選，保留原操作 |
| R04 | G9後方燈→選型 | 不轉護眼／Ark上下燈 |
| R05 | Infinity Core追問 | 螢幕燈效語境，不搜CPU |
| R06 | S99ZZ999 | 不捏造，指引型號 |
| R07 | 補完整型號 | 接回原題，不重開話題 |
| R08 | 已有型號按手冊 | 不重選不確認 |
| R09 | 按手冊但QA可答 | 免費答、不扣手冊 |
| R10 | PDF缺型號 | 候選限實際PDF索引 |
| R11 | 無PDF／舊SHA | 不亂掛，補救與終點 |
| R12 | 手冊→網路→手冊 | 同題型號不變，重按快取 |
| R13 | 明確網路 | 不附PDF、不再確認 |
| R14 | 手冊partial | 保留有效答案，只補未解 |
| R15 | Web無相關引用 | 安全下一步、不湊結果 |
| R16 | 再詳細 | 一次新增資訊，成功後消失 |
| R17 | 那怎麼開 | 同操作不固定再Router |
| R18 | 兩邊都120Hz嗎 | 保留PBP＋新限制查證 |
| R19 | 跨日接續 | 型號與題意保留 |
| R20 | 換系列／新功能 | 不借舊型號／舊問題 |
| R21 | 取消/N/逾時/貼圖 | 不扣進階、不黏來源 |
| R22 | 連點/並行/429 | 次數一次，成本按每請求 |
| R23 | 配額／月額耗盡 | 0新生成、免費仍可答 |
| R24 | 管理員重啟 | 清狀態，日常不需重啟 |

## 驗收與發布

### 分批發布界線（2026-09-05 使用者再次要求完成並發布）

原核定計畫採分批測試、分批發布。v303 的本批範圍是已登錄六份頁索引的依題檢索、題意延續、共通證據驗證、費用共同入口、手冊同步鎖及接孔摘要；以對應完整來源整合與 Chrome 實問通過後走 guarded release。不能再把全庫索引擴充、整體不可變 ManualRevision 遷移綁成這批的發布前置，讓完成的修復停留在 HEAD。

全案仍保留下面的20條旅程／5條保留題、全库索引及完整 PDF/index 原子切換門檻；本批發布不得冒稱全案完成。手機未驗收時不得寫成已驗收，亦不以 TestUI 的「跳過 LINE API」冒充實際送達。2026-09-05使用者再次明確要求「自己測，不要叫我幫你測，有TestUI」，故由AI以真正Chrome TestUI完成受影響旅程、核對正式health與雲端LOG後commit/push，不再把使用者手機代測當成本批收尾的前置。

production_harness.js 載入完整正式 .gs，只模擬外部I/O；既有抽取式單元測試不代表真實驗證器通過。20條多輪旅程含5條保留題，分開判斷找對證據／答案受支持／回答原題／操作終點。安全全過、至少19/20有用終點。
Chrome TestUI 共用正式 router，手機 LINE 送達另驗，不混稱、不做無關解析度。付費測試目標NT$2、硬上限NT$5（含File Search），逐題記問題、模型、calls、usage費用、耗時。
保持main與未追蹤結果。static／contract／diff check／guarded DryRun；確認月seed、Cloud cap、資料SHA及部署容量後，唯一入口 tools\release_existing_webhook.ps1。正式health、AI親自Chrome TestUI與雲端LOG通過後commit/push；依使用者最新指示不要求其代測。LINE送達另分列已有證據與未測，不作不實完成宣告；記部署版本／commit／索引checksum可回復。

## 事故修復追蹤（未驗收不可改稱完成）

2026-09-05 當次雲端證據：正式仍 v29.6.302 @1483；v303 僅 HEAD。Cloud Gemini API 實際強制 Spend Cap 是 NT$90（預算名稱雖含100），當月讀回NT$5.58。原始檔與逐題費用見 [實測紀錄](test_runner/results/v303_live_reliability_20260905.md)。

- LOG 1219／1222／1224–1229：`Insufficient permissions for the specified parent.`。FlySam執行帳號對手冊資料夾不能新增，並非OCR或SHA計算錯誤；两份新PDF仍pending、六份Drive索引未啟用。不能標ok=true，不能為重試先再花第一頁驗證費。
- 維護先查Drive `capabilities.canAddChildren`，無寫權就零模型停止；保留compiled已核實頁索引與原PDF讀取。需資料夾擁有者調整既有執行帳號權限，不能改存其他資料夾假裝原入庫成功。
- 私有維護函式只經編輯者/dev＋短效token的明確按鈕執行；不新增userinfo.email、不公開免授權維護端點。File Search未通過相容性與A/B前仍禁止正式遷移。

### 2026-09-05 共享權限解除後與A/B實證

- 上述Drive權限事故已於14:16–14:18解除：兩份2026手冊UPDATED，六份索引active、failed=[]；不是仍待Sam授權。H704/H802/H850共用PDF與HG402/HG612/HG702/HG732/HG802/HG806共用PDF均依第一頁驗證與既有逗號命名入庫。完整SHA與檔名見本批報告。
- File Search以同一本M8、同2.5 Flash-Lite跑10題；可使用generateContent，無須換貴模型。頁級生成NT$0.0791264、File Search生成0.0559712、一次embedding保守估算0.606816。一次性匯入成本不能忽略，也不能把模型生成當免費。
- 不遷移：File Search「連藍牙喇叭」答成手機播到螢幕（方向反了）；安裝App、原廠重設、睡眠計時的自行生成頁碼與PDF頁不一致；七題無groundingSupports。retrievedContext有內容不代表每個答案主張受支持，chunk起始頁不等於摘錄跨頁後每項操作的頁碼。
- 現行頁級四題被同一守門拒絕：整頁的型號差異註記被當作整頁無用。候選將「已核實支援頁＋SHA的共用手冊操作」與「此機型確定支援」分開：只有單一操作可呈現**附明確適用限制**的手冊步驟，範圍標為依型號而異；不放行不同明示型號、不放行數值／多模式限制、不把相關功能認成同義。正式excerpt/關係驗證仍必須通過。
- 另一召回缺口：別名群組只含解除安裝等長詞時，把實際「安裝應用程式」頁排除。原題有辨識度的字詞可獨立召回，且標題中的原題動作加權；不是再增加App安裝專用路由。
- 電子手冊「立即嘗試」是文件導覽連結，不可列為實機操作步驟；程式只清顯示答案，不刪稽核原文。
- 純術語解釋不借持久型號當能力提問。Infinity Core定義放CLASS_RULES（A欄CSV），不放Prompt；Chrome追問已確認0 Router/PDF/Web與0費用。
- 本批尚未通過20條多輪及手機LINE；只能稱候選修復與隔離實驗，不能稱全案已發布。

### 14:45追問事故與共同入口修復

真人順序「M8零售模式→那App怎麼安裝→那睡眠計時器在哪裡設定」第三輪誤回App。`getPreviousUserTopicForEvidence_`先於新Planner，把任何短句首「那」當作省略追問；因此只測Planner／PDF驗證器仍會漏掉這條免費旁路。

- `isEllipticalEvidenceFollowUp_`改判語法省略／新增限制，不把已說出功能名的句子當省略；`getPreviousUserTopicForEvidence_`與`canReuseSemanticFollowup_`共用同題契約。型號繼續保存，問題不偷換。
- 頁級validator核實的條件操作以當次記憶體receipt傳到最後顯示守門；僅憑模型文字寫「依型號而異」仍不能放行。避免上游已核實，下游又把同段資料刪掉。快取保存已驗證finalText，政策版本變更即失效。
- `production_harness`補GAS UserLock I/O，完整`handleMessage`連跑三輪，原始QA/RULE、歷史讀取、來源router、頁索引及最後顯示都不替換；只模擬外部provider回應。斷言兩題免費、第三題一次Lite手冊、Router0/Web0，44項通過。這不是live模型品質或LINE送達證明。
- 商品價格遮罩不得處理已由usage產生的費用頁尾；先格式化答案，再附費用／模型／額度。加入NT$1.2295與商品NT$12,900的同輪測試。
- 1:40 Infinity亮度錯答來自NIT無英文字界；已補Infinity/ViewFinity/正常nits通用邊界案例。1:58術語定義被當成機型能力，另收斂claim scope；純術語定義不要求型號證據，但任何操作、數值或明確機型問題維持嚴格型號驗證。
- 1:23藍牙页級回答成功但規格重複；純操作的已完成手冊答案不再附整份RULE摘要。仍需真人重測，不能以離線38項當成20旅程或手機LINE驗收。

| 事故 | 通用修復 | 待驗證 |
|---|---|---|
| G9題意掉失、InfinityCore跑CPU | canonical保留新限制／產品領域查詢 | 整合、真人 |
| Ark頁／120Hz外推 | 真實家族、關係、主張驗證 | 整合、真人 |
| SHA不同／Drive寫失敗仍切metadata | pending、短鎖、讀回、回復 | 雲端 |
| 凌晨重複同步 | lease／保留trigger | 整合、雲端 |
| 固定片段與mock綠燈 | 完整逐頁query-time／真實來源harness | 已生成6份；正式未驗 |
| 重試／缺usage漏費 | 共同預留／結算 | 整合、Cloud seed與cap |

### 15:08 檢索名稱與適用範圍分離

G9口語「後方環形燈」未召回；英文Core Lighting又被共用單字Lighting帶到Eclipse上下燈頁。`manual_lexicon.json`新增`relatedTerms`：只擴充候選頁面，不混入等價aliases，不放行型號／主張驗證。完整英文複合功能名優先於拆散單字；加權取最大值而非累加別名數，避免無關密集段落排前面。GAS與本機產生器均讀同一份詞彙資料，原PDF SHA不變，索引checksum更新。新候選資料版本使用EvidenceV18以失效舊答案快取。

45項完整來源離線整合通過，包含原有App／Wi-Fi／PBP／錯Ark／數值外推。14:59 Chrome三輪最後睡眠題已正確，Lite一次約NT$0.0103136；不是手機LINE驗收。G9真人及20旅程仍须另外記錄，不能因單題排序通過就發布。

15:11 G9真人選S49DG952SC已查到115頁Core Lighting，Router0/PDF1/Web1、約0.0433；仍是共用手冊条件操作，不冒稱本款所有燈效已核實。Web未解的終點不得把generic no-evidence fallback接在已驗證手冊後，造成「先答再否定」；只說未解補充尚無法核對、選單不同請Sam協助。完整來源46項通過，整批費用讀回1.58951296（含不確定embedding0.606816）。20旅程及手機LINE未完成，正式未發布。

### 15:20 真正來源入口的配額／快取顺序

Rich Menu原先先檢查每日剩餘，讓下層「同題cached先於額度」永遠走不到。現在有已存問題與型號時先交共用executor；executor依資料版本核對完成快取，未命中才按額度拒絕，禁止為重播再呼叫供應商。無上一題仍直接顯示額度耗盡。不能只測`readDoneAdvancedSourceOperation_`就宣稱按鈕可用。

`#型號`確認與文字補型號都是同一個clarification continuation。Fast選型handler原先少設`resumedFromPlainModelClarification`，後續轉手冊拿不到原一般題charge；補上後只有需要進階來源時consume hold退款，本機免費答案不額外退／扣。47項完整來源整合包括handleMessage(G9)→#型號→handleRichMenuPostback(額度耗盡)，驗證一般題回10、只生成一次、重播cached且零新增呼叫。正式生效仍須完整發布守門。

### 接孔追問不能被數量摘要截掉規格

15:48 真問「S32FM703UC 有幾個 HDMI？」→「那 USB-C 可以幫筆電充幾瓦？」；型號正確延續，第二輪卻把 RULE 的 `65W` 刪成「1個 USB-C」。原因不是模型能力，是 `buildDeterministicExactRuleReply_` 對所有 portIntent 都做數量摘要。

現在只有純數量問題可摘要；供電、瓦數、版本、速度、解析度／更新率或混合問題保留原 RULE 欄位，不改產品事實、不新增 LLM。回歸包含 USB-C 幾瓦、Type-C 供電、數量與瓦數複合問，以及原 HDMI 數量不退步。完整來源離線48项通過；Chrome複驗與正式部署另記實測報告。

### v304：手機口語原題不得被「純換型號」旁路覆蓋

使用者16:05–16:06手機實問小寫無空格 `S32fm703uc有幾個hdmi` → `那usb-c充電有幾瓦`，雲端LOG1495／1504皆LINE回覆成功，答案2個／65W，0模型。但LOG1499仍將新題誤展開成前題HDMI：`isShortModelContinuation` 把程式注入的 `(型號: S32FM703UC)` 當使用者新型號，再只用短句開頭「那」判斷整句。

修復是語法範圍收斂，不加題型詞彙：先排除內部型號提示，再移除使用者實際輸入的型號；剩下必須只有「那／換成／呢／what about」等純轉換語法才可沿用舊題。一旦還有任何功能或限制文字，一律保留本輪原題，走既有QA／RULE／必要PDF，不再覆蓋成舊問題。完整真實handler回放手機兩輪、九種正負句型及其餘50項完整來源斷言通過；型號跨日保存不受影響。

口語 `M7有幾個hdmi` 已以全新Chrome聊天室驗證：0模型辨識M7並列可點型號，不要求自行打完整型號。系列共通資料仍由既有全候選RULE一致性檢查判定，資料不一致或缺漏不得以系列名猜同規格。候選點選及後續短句需一起驗收，不能只看到選單就算整段通過。
