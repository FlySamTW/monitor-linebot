# AI_CONTEXT — 唯一目前狀態入口

## 此刻狀態（2026-09-23）

- **正式已部署 v29.6.326／GAS @1508／build 2026-09-23 16:58**。既有正式 webhook、Remote HEAD 與本機版本/build 已重新核對一致；發布收據為 `published_pending_user_line_test`，`liveAccepted=false`。
- 本次全面改善已完成 Worker UTF-8 HMAC、回答完整度/數值/能力守門、request-aware page RAG、逐檔 Files URI 到期調度及共用已驗證 PDF SHA 的型號身分重用。
- Windows 排程 `SamsungLineBot-ManualPageIndex` 於修復後實際手動重跑成功，`LastTaskResult=0`；worker v2 真實 bundle probe 已讀回 9 個 active 文件的 PDF SHA 與 index SHA。
- 手冊庫最新診斷：registered=88、active=88、models=137、uniqueIndexes=50、missing=[]、workerHealthOk=true。M50F 四款 `S27FM500EC / S27FM501EC / S32FM500EC / S32FM501EC` 均有 page-level index ready；三款早上 `WORKER_AUTH` 事件不是缺手冊，而是共用已驗證 PDF 的 identity/worker 流程未完成。
- 已跑 v326 `test:static`、`test:contract`、`test:production-contract`、`test:release` 全 PASS；20 條核心旅程 20/20 PASS，real provider calls=0。這些是離線/契約驗收，不冒充真人 LINE 驗收。
- 使用者明確要求完成並部署，因此仍採 `PublishForUserLineTest`：程式與資料維護已正式上線，但真實 LINE 可見回答尚待使用者實測封存；不得把 health、HTTP 200 或 fixture 當真人通過。
- 本機／遠端只用 main；既有 `deliverables/system_maps_20260909`、`output/` 等未追蹤產物維持原狀，不 clean/reset、不混入本次提交。
- 正式 Prompt 仍只取 Google Sheet `Prompt!C3`；本次未改 Prompt、Rich Menu、金鑰、正式來源次數或導入 managed Google File Search / 付費 Context Caching。
## 正式設定與發布鐵律

| ID | 正式來源 | 說明 |
|---|---|---|
| CONF-001 | Prompt!C3 | Google Sheet 的 `Prompt!C3` 是唯一 runtime Prompt；`Prompt.csv` 只做本地鏡像/人工備份。 |

- 部署流程不會自動把它上傳到 Google Sheet；除非明確維護 Prompt，程式發布不得覆寫 `Prompt!C3`。
- Prompt 維護鐵律：先讀雲端 `Prompt!C3`，不得拿本機 `Prompt.csv` 反向覆蓋正式內容。
- 除非使用者明確要求，程式部署不得同步或覆蓋 `Prompt!C3`。
- 回答來源固定：QA 資料庫 → CLASS_RULES → 官方 PDF 手冊 → 網路搜尋/官方頁 → 誠實告知無資料。不得把 LLM 通用知識放在 PDF 手冊之前。
- 正式發布禁止只 `clasp push` 後宣稱完成；必須走 `tools/release_existing_webhook.ps1`、核對既有 deployment 與正式 health。禁止新建 deployment ID。

## v326 已部署狀態

- `v29.6.326 / build 2026-09-23 16:58 / GAS @1508` 已透過唯一既有 deployment 發布；v325 已被 v326 supersede。
- 答案 policy 已升為 `qa-rule-v325-1`，舊 policy 快取不得直接重用；requestItems 是最低需求清單，來源只可解決有對應 evidence 的需求。
- Worker identity policy 升為 `cover-v326-1`：相同官方 PDF SHA 已完成雙 SHA 驗證時，可安全重用已驗證 PDF 身分到其他同來源、各自 support-page 綁定的 SKU，仍保留型號、角色、支援頁與證據 scope 守門。
- Files API 續期改成逐檔到期優先：expired / 12 小時內到期 / retry_pending 優先處理，再公平輪替；provenance 永久拒絕只綁定同一 Drive identity，不再每輪重試。
## 已完成的主要修正

- QA/RULE 候選包含完整答案、逐子題與必要條件；免費精準答案／完成快取優先，同次請求只判讀一次。原始必要限制由程式補回可見答案，仍擋錯來源、型號、數字及捏造條件。
- **取消候選格式／驗證失敗的第二次付費生成**；保留可驗證部分，執行錯誤不當資料缺口升 PDF/Web。條件句只差句尾標點時合併，避免本次H6曾出現的重複。
- AnswerEnvelope v2／qa-rule-v325-1 保存已支持與未解子題、型號及執行狀態；不相信模型全域complete，不因追問丟掉新限制。
- 費用統一 providerFetch_，JEV cost:null／缺usage不歸零，同收據不重複結算。搜尋未知至少涵蓋觀測query數；相同query重複出現不可去重少算。
- Web Interactions adapter核對typed steps、URL citation、中文字／emoji byte offsets、完成狀態及usage；缺有效引用不得假成功。
- JEV固定 typesafe/jev-1.13，既有條件路由保留。新增證據驗證仍 acceptance_only，一般流量不增加該項付費呼叫；未證實JEV降低本案總成本，不擴大用途。
- 生成固定 models/gemini-3.1-flash-lite。2.5 Flash於本專案當次404、Lite200；未完成兩模型同題A/B，不能推論2.5全球停用或Lite品質全面勝出。
- 首頁核實不送整本PDF，免費下載／抽字／索引不叫LLM；已付費階段不重付、永久不適用文件停止自動付費、暫時錯誤有限重試。

## 當次費用與品質證據

- 同批 `v324-cost-remediation` 上限 NT$10；v326 最新診斷 `batchAfterTwd=4.155059392`、`reserved=0`、`remaining=5.844940608`。全部是供應商回報或依用量估算，不是 Cloud 帳單實付。
- 接手前3.849683392未清除；兩輪新增診斷合計0.15544，9次provider送出（8次成功生成、1次404），3個不同問題執行6次，含初輪一次格式修復與2次可用性探測；不是整批只有9次。
- 初輪23:34 build三題本身0.087504，另可用性0.000072；23:59 build同三題0.067864，各只一次呼叫。H10由0.03884降0.019296；H8由0.016376略增0.016424，不能宣稱每題必然省錢。
- 三題是既有QA/RULE證據，不是新PDF／Web／JEV／LINE驗收。H6入口與限制保留；H8仍為簡短概念回答；H10區分硬體多來源與桌面視窗排列，末尾仍有來源限制語氣。
- 複驗發現H6限制句標點不同而重複，最終00:10 build僅零模型去重及build標記；與生成版的雲端原始碼差異已核對，未改模型、Prompt、payload、路由或費率。最終只讀帳，沒有再次付費生成三題。
- 費用明細：test_runner/results/v324_cost_breakdown.md。原始兩輪：v324_generation_diagnostics_20260921.json、v324_generation_retest_20260922.json；最終讀帳：v324_generation_diagnostics_20260922.json；差異證據：v324_final_format_lineage.json，均在test_runner/results。
- 舊H5/H8 Web無有效引用、H10呈現及H11–H15保留題沒有全部真人重驗通過，fixture修好不能把歷史FAIL直接改PASS。

## 必要驗證與發布證據

- v326 最終 `test:static`、`test:contract`、`test:production-contract`、`test:release` 全 PASS；回答完整度、精確數值、能力擴張、必要條件、共用 PDF identity、逐檔 URI 到期與 worker UTF-8 認證均有回歸守門。
- v326 最終 20 條核心旅程 20/20 PASS，真實 provider 0 次；只模擬 I/O 並載入正式 router/resolver/validator，不代表 LINE 真人通過。最終結果 `test_runner/results/v326_20_journeys_offline.json`。
- 最終上傳及完整檢查：output/takeover_20260921/stage_final_cost.log；正式發布：output/takeover_20260921/publish_final_cost.log。git diff --check通過。
- runtimeManifestSha256=ff04f84255da91f495f055f7f45dc8d5eb19e26067da61f9d1dfaaa1c1304984；policyChecksum=2ba5a7d25ffaf015787c100c8c0fd1482c47abee314645c1e336dd8308831b83；dataChecksum=c8ca2cfb5f2af83d5c7d67a610e2fd21c1e920ba19c66836bb50ea800b054b27。
- 唯一入口tools/release_existing_webhook.ps1，固定既有deployment。發布前保存原正式@1505/v323及雲端HEAD；output/release_state/pre_release_formal.json為當次回復指標。Properties、Sheet、費用帳本不可回復清除。
- 本次仍是使用者自行 LINE 測試模式，v326 發布收據 `published_pending_line.json` 記錄 priorVersion=1507、currentVersion=1508、liveAccepted=false。BeginLineAcceptance／FinalizeLineAcceptance 原流程保留；正式真人定版仍要求 LINE 封存報告。
- 先前實際同deployment與HEAD回復、原始碼SHA讀回已成功；故障fixture亦驗過。最終發布收據保存在output/release_state/published_pending_line.json及test_runner/results/v324_publication_receipt_20260922.json。

## LINE與診斷入口邊界

- Chrome能看到LINE擴充分頁，但工具getTab曾明確拒絕Browser URL policy blocks this action。不得改CDP、桌面或其他通道繞過；未送出本次自動LINE驗收訊息。
- 官方來源與公開回報查核未找到已證實適用本案的修復；不是Chrome整體斷線。使用者現在可在已切新版的LINE自行輸入，不重問已給授權、不用TestUI冒充。
- 獨立/dev?diagnostics=1由Google原生限編輯者；15分鐘token綁build，/exec不核發，不新增userinfo.email。Chrome實際比較、讀帳成功；此頁不是TestUI對話或LINE測試。
- LINE_ACCEPTANCE_V324可綁actorHash、版本/build、原批額度及最多30分鐘；尚未設定本次真人時窗。封存須LINE可見答案、eventId、reply SHA、provider收據及版本對齊。

## RAG與不新增儲存費

- 保留Files API免費48小時臨時附件續期、自建持久頁級索引、型號／角色／官方來源／PDF與索引SHA／頁碼驗證。未遷入managed File Search或付費Context Caching。
- 主問答最多召回5段文字，整本Files/inline PDF是受限備援；PDF單題NT$0.35、程式月NT$90及Cloud既有NT$50不放寬，Cloud封頂不是即時阻斷。
- 9/21 LOG曾見rolling refreshed=10/10,cursor=39,total=77，每4小時10份另每日增量；理論約32小時一輪，不代表每份都及時續期或可回答。詳細官方研究與限制見Developer_Manual.md。
- 頁級 RAG 既有實例仍包括 F24T350FHC 與 H704 第41頁；v326 額外確認 M50F 四款各自綁定同一已驗證 PDF SHA `f6973810...cdc0c` 與 page index SHA `c9a0fd9a...a25d5`。一般頁面 OCR、複雜表格、圖示、印刷頁碼仍是能力邊界。
- F612正式worker雙SHA成功屬既有證據；D392/M703外區參考不能當台灣適用，M9官方HTML不等於PDF就緒。參閱docs/V307_OFFICIAL_GAPS.md。

## 下一步

1. 讀本頁、AGENTS.md及git status；只依當次正式health和Git判斷，不重讀巨大聊天或另建狀態檔。
2. 收集使用者新版LINE問題／可見答案，對齊雲端LOG、版本及provider收據；優先檢查錯答、漏限制、錯讀PDF/Web及單題總費用。不得以HTTP200或fixture封存為真人通過。
3. 付費重測保留原批NT$10與月帳；每次先查剩餘，不清歷史。模型改變須同題同證據比較；不盲目重跑已成功付費階段。
4. Developer_Manual.md維護架構與方法、REGRESSION_GUARDS.md維護不變式。正式來源root .gs，.claspignore排除JS/tools/tests/output。
5. 雲端LOG：Sheet 1RTjPac2aoURzlJKTVydapyJlLni4Y0VyQqeeIrHQOqQ、gid174529670，只走本機Chrome；CLASS_RULES維持A欄CSV大字串。秘密不得進repo或LOG。
