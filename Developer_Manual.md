# Samsung LINE Bot 開發手冊 — v29.6.313

正式 v29.6.313 @1494（BUILD10:38／Smart-Platform-Provider-Circuit）：formal health、static／contract／production-contract通過，版本容量38/200；20條離線旅程20 PASS／49事件。正式 LOG 已遮蔽172／1048筆命中內容，未呼叫供應商。Google Cloud 專案仍因疑似憑證外洩後遭第三方濫用而停權，所以真人 Gemini／PDF／Web 路徑尚未恢復驗收；同憑證已熔斷、失敗退款且不再誤報「沒有證據」。9/11申訴已由Google收件，Ticket `2FPP7WMWZSXUISBNIVU7DZHTMQ`，通常兩個工作天內審查。本批沒有改模型、Prompt、Rich Menu或配額，也沒有新增模型費。

接手依 [V307_HANDOFF](docs/V307_HANDOFF.md)、[LIVE_ACCEPTANCE](docs/V307_LIVE_ACCEPTANCE.md) 與 [來源重查](docs/V307_OFFICIAL_GAPS.md)。離線20旅程49事件全過與Chrome代表性驗收分開；F612英文／M9 HTML已補，三款台灣適用證據缺口仍獨立列明。

本批接手以本文件的v307 worker契約及 [AI_CONTEXT](AI_CONTEXT.md) 為準；[v306 交接清單](docs/V306_HANDOFF.md) 保留前版故障脈絡，其中「worker尚未實作」不是目前正式狀態。正式狀態依當次發布紀錄，以下v306／v305為歷史基線，不代表當次health。

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

Fast／頁級固定2.5 Flash-Lite，整本PDF／Web固定2.5 Flash；既有條件式3.7 Flash不升級、不擴到每題。Router 無工具／無產品答案，只選候選 index、拆 claims；低信心、429、格式失敗不重試，回安全路徑。

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
