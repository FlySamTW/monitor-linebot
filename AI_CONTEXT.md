# AI_CONTEXT — 唯一目前狀態入口

- CONF-001 | Prompt!C3 | 正式來源；Prompt.csv 是本地鏡像/人工備份，部署流程不會自動把它上傳到 Google Sheet。
- 證據優先序：QA 資料庫 → CLASS_RULES → 官方 PDF 手冊 → 網路搜尋/官方頁 → 誠實告知無資料。
- 發布及 Prompt 維護鐵律：禁止只 `clasp push` 後宣稱完成；禁止新建 deployment ID；除非使用者明確要求，程式部署不得同步或覆蓋 `Prompt!C3`。

## 此刻狀態（2026-09-21）

- 任務：接手 v324 半成品，完成費用／答案契約／JEV 評估，依使用者要求以真實 LINE 輸入及可見回答驗收；不先跑 TestUI。整體尚未完成，不能宣稱完美或正式發布成功。
- 正式仍 v29.6.323 @1505 [2026-09-18 17:35]；本次實際由唯一工具回復同一 deployment 並核對數字版本及 health。接手基準為 e8c07213afe52999b3b9a8b916222aebf342afa0；當前main提交以Git HEAD為準。
- 目前GAS HEAD已成功上傳22檔 v29.6.324 [2026-09-21 23:34]，Chrome診斷讀回build一致，正式webhook仍舊版。上輪23:03候選曾成功回復19檔HEAD至10:52並核SHA；本輪原HEAD備份為output/release_state/head_c6de9a9ee05744588ae2e01ac6848168。尚未建立GAS版本、未切正式候選，不能宣稱新版正式發布完成。排程執行HEAD，與正式webhook分開。
- 分支整理已依使用者明確授權完成：刪除本機及遠端 backup-before-identity-refactor、copilot/check-copilot-usage-quota；前者已合併，後者只有不改檔的 Initial plan commit。本機／遠端只剩 main，一個主要 worktree，無 force-push。
- 接手前快照：output/takeover_20260921/before_changes.zip 與 before_hashes.json。保留所有前手 dirty/untracked 及 deliverables/system_maps_20260909、v296275_global_rag_20_baseline.md；不可 clean/reset 或整批混入提交。
- 生成固定 models/gemini-3.1-flash-lite；JEV 固定 typesafe/jev-1.13，只走 Decisions API。未改 Prompt!C3、Rich Menu、金鑰、正式來源次數或付費儲存設定。

## 當次授權與阻礙

- 同一驗收批次 v324-cost-remediation 累計上限已由使用者授權為 NT$10；runtime 與 config/provider_cost_review.json 一致，歷史失敗、既有支出、其他批次和月帳均保留。
- LINE 擴充頁可在 Chrome 分頁清單看到，但 getTab 被工具明確拒絕：Browser URL policy blocks this action。不得改用 CDP、其他瀏覽器介面或間接控制繞過。未向 LINE 發送任何本次驗收題。
- 使用者要求自行操作並搜尋解法；已查OpenAI官方來源政策說明、LINE官方Chrome說明及openai/codex #27160／#45990回報，未找到已證實適用本案的官方修復。一般HTTPS Apps Script可操作，不是Chrome整體斷線，也未證實是企業管理設定；不重問LINE授權、不改policy檔或換通道繞過。
- CLI clasp run 未成功；原編輯器入口缺userinfo.email已修正，改用Google原生editor-only /dev?diagnostics=1及15分鐘build綁定token。Chrome實際讀帳及模型診斷成功，未新增Email權限、未使用TestUI對話。/exec不得核發token，缺失／舊build token均拒絕。
- LINE_ACCEPTANCE_V324 僅新增本機支援：指定使用者雜湊、版本/build、同批額度及最長30分鐘視窗，真實 reply 路徑不開 IS_TEST_MODE。尚未設定 ScriptProperties 驗收視窗，也未取得可見回答證據。
- 正式 liveAccepted 仍 false、liveReportSha256 空白。正式守門要求LINE可見回答／eventId／provider收據／版本build與20旅程門檻對齊；TestUI、API200、fixture皆不能替代。
- 已加入同一入口 BeginLineAcceptance／FinalizeLineAcceptance：要求LINE可操作、雲端時窗讀回、模型比較審查與原批餘額，最多30分鐘；hidden watchdog呼叫原入口回復deployment及HEAD。離線故障測試通過，尚未啟動真候選時窗／watchdog，電腦或網路失效仍可能延遲回復；不能冒稱雲端硬期限保證。
- 目前回復依據output/release_state/pre_release_formal.json指向head_c6de9a9ee05744588ae2e01ac6848168。上輪回復證據rollback_current.log保留；本輪22檔上傳與全套檢查證據stage_diagnostics.log，CLI回應較慢但最後exit0。Properties／Sheet／帳本未清除。

## 已整合的候選內容

- 前手 v324：AnswerEnvelope v2、QA/RULE 候選語意範圍、保留主詞與已核實部分、頁級 RAG 與手冊追問重用、背景首頁隔離與有限重試、worker 按 SHA 快取、用途共用費用守門。這些不等於真人品質已過。
- 本次 provider gateway 修正 JEV cost:null 不得轉零、費用只由收據結算一次、request audit 與批次／月帳一致；新增 evidence_verify 用途，未知搜尋費至少涵蓋已觀測查詢數。
- 本次原生 Interactions adapter 核對 typed steps、URL citation、UTF-8 byte offsets、完成狀態、有效 usage 與單／多 query；無合法引用或未知費用不能假成功／假零費。
- conditions回填可見答案；JEV Choice／Noul拒絕null、字串、越界及錯type，任一中間機率不得高信心接管，初始門檻0.85並更新GatePolicyV5快取。此值仍未以本批真實品質校準。
- 模型比較限定2.5 Flash與3.1 Flash-Lite，同題／相同證據，先查可用性、404不重試、結果分包保存與重開只讀回。2026-09-21 23:41真實探測2.5 Flash回404、3.1 Flash-Lite回200。Lite完成H6/H8/H10三題候選判讀，H10包含一次格式修復；未完成兩模型同題A/B，不宣稱JEV降低總成本。
- JEV 官方 citation-check 應用已評估並做驗收用候選 evidence_verifier.gs：接收原問題／完整片段／限制，逐主張支持度及完整性判斷，保留已支持子題；失敗不盲重送或轉 Web。
- 新 JEV 證據判讀只限明確 LINE 驗收視窗，一般正式流量仍保持既有條件路由；不得把離線 fixture 當實際 JEV 品質或節省成本證據，不根據信心值宣稱實測正確率。
- 正式程式只在 root .gs；.claspignore 排除 JS、tools、test_runner、output。新增檔名與測試見 git status，不遺漏尚未追蹤的 .gs。

## RAG／免費儲存的當次判斷

- 使用者確認原始定期上傳是為避免儲存費。這項要求保留；本次沒有改動 URI 輪替排程，沒有遷移到 managed File Search 或啟用付費 Context Caching。
- Files API 上傳與儲存免費、48小時到期刪除，不是到期轉收費；定期上傳維持免費臨時附件可用，不能只因重傳便判為問題。模型讀 PDF 的生成用量另計。
- 自建頁級索引持續保存；主要問答召回至多5段原文，整本 Files/inline PDF 是備援。Files URI 不是 RAG 索引，每日同步也不是整庫重建。
- Chrome LOG A1044=2026/9/21 20:59:01，B1044=refreshed=10/10, cursor=39, total=77；A1039=04:21:00，B1039=daily 同步完成／v324。當次確認續期執行，不能推定77份全數可回答。
- 每4小時10份，77份理論最多8批／約32小時一輪；每日增量同步另補一批。須看逐檔期限／失敗／略過才評估到期覆蓋率，不能拿單次成功或排程存在當全庫健康。
- Chrome LOG A853=2026/9/19 16:10:50，B853=F24T350FHC 頁級 RAG pages 20,23,14,14,13；B852=providerCoverage/validatedCoverage full。這是先前執行證據，不是本次真實 LINE 驗收。
- 仍有實際能力邊界：抽字未做一般頁面 OCR／圖像語意、複雜表格與印刷頁碼待核對；關鍵詞召回和結構驗證不能單獨證明答案涵蓋問題／獲引用支持。
- 最新 Google File Search 支援3.1 Flash-Lite，索引儲存免費且持久，匯入 embedding／回答 tokens 另收費；不必每48小時重傳僅指持久索引。不能把原每日續期照搬成每日付費重建。
- 官方、GitHub PyMuPDF4LLM／Docling／Google cookbook、網友與 Google 論壇查核已寫 Developer_Manual.md「2026-09-21 RAG 現況」。維持本架構，候選只做同 PDF／模型／題目的受控比較，不直接全庫遷移。

## 本次驗證與證據邊界

- test:static、test:contract、test:production-contract 均 PASS；40項費用回歸、6項v2與16項接手回歸。本輪經唯一發布工具完整重跑；真實供應商診斷另列，LINE收訊未驗。
- 20核心旅程重跑20/20 PASS，程序exit0、真實provider0；結果 test_runner/results/v324_20_journeys_offline.json/.md，log為output/takeover_20260921/core_current.log。僅離線I/O fixture，不覆蓋歷史真人失敗。
- test:release PASS：HEAD hash回復、竄改／越界拒絕、LINE可見證據／收據守門、時窗及預算阻擋、watchdog到期與定版取消。watchdog為離線測試；實際HEAD及deployment回復另有rollback_current.log。
- git diff --check PASS；正式守門仍拒絕未驗候選。BeginLineAcceptance亦已用blocked receipt確認在上傳前拒絕，見line_gate_blocked.log。
- 當次輸出：output/takeover_20260921/static.log、contract.log、production-contract.log、core_journeys.log、formal_gate.log。
- 本機／本輪上傳候選runtimeManifestSha256=0dd9434413fd2f4b815a98ac4e613216998b5b0a1d14c8bdd93179614fea4471；policyChecksum=edf97a0b1aeb3d542de4166b632cae19ab5107f7596799fd2e036f815de7b550；dataChecksum=c8ca2cfb5f2af83d5c7d67a610e2fd21c1e920ba19c66836bb50ea800b054b27。此雜湊不代表正式webhook已更新。

## 費用與既有真人缺口

- 本輪新增provider送出6次：2次可用性探測（1次404）、3題候選生成加1次格式修復；5次成功生成，新增估算NT$0.087576。搜尋query／PDF／JEV／LINE均0。完整逐題結果與收據見test_runner/results/v324_generation_diagnostics_20260921.json。
- 2026-09-21 23:41 Chrome當次讀回本批spent=3.937259392、reserved=0、remaining=6.062740608，month=23.743774208；依用量估算不是帳單實付。起始3.849683392及所有舊失敗保留。H6已呈現必要限制；H8仍較簡略；H10已區分硬體多來源與桌面排列，但末尾仍含內部限制語氣，完整旅程品質尚未定版。
- 上輪 H8／H5 Web 付費失敗（無有效引用）、H10 呈現不完整仍未真人重驗通過；H11–H15 等保留題尚無當次合格證據。adapter 或 fixture 修好不能把舊 FAIL 直接改 PASS。
- PDF NT$0.35、程式月 NT$90、Cloud 既有 NT$50 封頂不放寬；Cloud 封頂非即時阻斷。舊預付餘額不當目前金額，背景必要辨識既有分類與月總帳不可重置。
- 背景既有免費下載／抽字／建索引可繼續；已完成付費階段保留收據，永久不適用文件不可自動重付。先前兩件 worker 真實雙 SHA 讀回保留歷史證據，新修改涉及時須再驗。

## 下一步與接手索引

1. 先讀本頁、AGENTS.md、git status 與 e8c0721 以後差異。唯一當前狀態只維護本頁，不另建進度日誌。
2. 由官方支援處理本次LINE來源政策，先確認可實際讀寫；診斷入口的既有授權相容性已實際修復，不新增email scope。之後才能啟用候選時窗，不用TestUI代替。
3. 讀回當次總帳與既有批次，將剩餘受影響 LINE／Web／手冊旅程限定於同批 NT$10，記問題數、重測數、provider calls、query數、實際頁段、答案及估算／未知費用。
4. 保留合格與失敗全部證據，完成品質與費用比較後產生 sealed live report，正式 guard 通過才由唯一發布入口定版。然後選擇性 stage 本次整合檔案、commit/push main。
5. Developer_Manual.md 放架構／官方研究；REGRESSION_GUARDS.md 與 test_runner/package.json 放必要檢查；docs/V307_OFFICIAL_GAPS.md 放既有來源限制。
6. 雲端 LOG：Google Sheet 1RTjPac2aoURzlJKTVydapyJlLni4Y0VyQqeeIrHQOqQ，gid174529670；唯讀登入只走本機 Chrome。正式 Prompt 只在 Prompt!C3，CLASS_RULES 維持 A欄 CSV大字串。
7. 唯一部署入口 tools/release_existing_webhook.ps1；固定既有 deployment，不增加 deployment／長期分支／worktree。秘密不入repo／LOG／外部AI。
