# AI_CONTEXT — 唯一目前狀態入口

## 此刻狀態（2026-09-22）

- **正式已部署 v29.6.324／GAS @1506／build 2026-09-22 00:10**。既有正式 webhook 的 health、雲端 HEAD 與本機版本/build 均已核對一致；不是僅 StageOnly。
- 使用者明確要求「先切正式，讓我在 LINE 測試」，因此採唯一入口 PublishForUserLineTest；正式發布與完整真人驗收分列，liveAccepted=false，沒有偽造封存報告。
- LINE 尚待實際回答驗收，完整 Web／PDF 保留題也未全部通過；不能宣稱專案完美或所有真人品質完成。
- 本機／遠端僅 main、一個主要 worktree。既有整合提交89c76c0、73cdec7已推送；最新成本修正與發布紀錄以Git HEAD為準。不另建分支。
- 保留既有未追蹤 deliverables/system_maps_20260909、test_runner/results/v296275_global_rag_20_baseline.md、output；不可 clean/reset 或混入提交。
- 正式 Prompt 僅 Google Sheet Prompt!C3，Prompt.csv 是本機鏡像。此次未改 Prompt、Rich Menu、金鑰、正式來源次數或付費儲存。

## 已完成的主要修正

- QA/RULE 候選包含完整答案、逐子題與必要條件；免費精準答案／完成快取優先，同次請求只判讀一次。原始必要限制由程式補回可見答案，仍擋錯來源、型號、數字及捏造條件。
- **取消候選格式／驗證失敗的第二次付費生成**；保留可驗證部分，執行錯誤不當資料缺口升 PDF/Web。條件句只差句尾標點時合併，避免本次H6曾出現的重複。
- AnswerEnvelope v2／qa-rule-v324-9 保存已支持與未解子題、型號及執行狀態；不相信模型全域complete，不因追問丟掉新限制。
- 費用統一 providerFetch_，JEV cost:null／缺usage不歸零，同收據不重複結算。搜尋未知至少涵蓋觀測query數；相同query重複出現不可去重少算。
- Web Interactions adapter核對typed steps、URL citation、中文字／emoji byte offsets、完成狀態及usage；缺有效引用不得假成功。
- JEV固定 typesafe/jev-1.13，既有條件路由保留。新增證據驗證仍 acceptance_only，一般流量不增加該項付費呼叫；未證實JEV降低本案總成本，不擴大用途。
- 生成固定 models/gemini-3.1-flash-lite。2.5 Flash於本專案當次404、Lite200；未完成兩模型同題A/B，不能推論2.5全球停用或Lite品質全面勝出。
- 首頁核實不送整本PDF，免費下載／抽字／索引不叫LLM；已付費階段不重付、永久不適用文件停止自動付費、暫時錯誤有限重試。

## 當次費用與品質證據

- 同批 v324-cost-remediation 上限NT$10，最新讀回spent=4.005123392、reserved=0、remaining=5.994876608；月帳23.811638208，待核對9.2431008保留。全部是供應商／用量估算，不是帳單實付。
- 接手前3.849683392未清除；兩輪新增診斷合計0.15544，9次provider送出（8次成功生成、1次404），3個不同問題執行6次，含初輪一次格式修復與2次可用性探測；不是整批只有9次。
- 初輪23:34 build三題本身0.087504，另可用性0.000072；23:59 build同三題0.067864，各只一次呼叫。H10由0.03884降0.019296；H8由0.016376略增0.016424，不能宣稱每題必然省錢。
- 三題是既有QA/RULE證據，不是新PDF／Web／JEV／LINE驗收。H6入口與限制保留；H8仍為簡短概念回答；H10區分硬體多來源與桌面視窗排列，末尾仍有來源限制語氣。
- 複驗發現H6限制句標點不同而重複，最終00:10 build僅零模型去重及build標記；與生成版的雲端原始碼差異已核對，未改模型、Prompt、payload、路由或費率。最終只讀帳，沒有再次付費生成三題。
- 費用明細：test_runner/results/v324_cost_breakdown.md。原始兩輪：v324_generation_diagnostics_20260921.json、v324_generation_retest_20260922.json；最終讀帳：v324_generation_diagnostics_20260922.json；差異證據：v324_final_format_lineage.json，均在test_runner/results。
- 舊H5/H8 Web無有效引用、H10呈現及H11–H15保留題沒有全部真人重驗通過，fixture修好不能把歷史FAIL直接改PASS。

## 必要驗證與發布證據

- 最終版本 test:static、test:contract、test:production-contract、test:release 全PASS；40項費用、8項v2、17項接手回歸。新增單次候選呼叫、條件去重、重複query不低估、使用者先發布守門。
- 最終20條核心旅程20/20 PASS，真實provider0次；只模擬I/O，載入真正router/resolver/驗證器，不代表LINE真人通過。結果v324_20_journeys_offline.json/.md；日誌output/takeover_20260921/core_final_cost.log。
- 最終上傳及完整檢查：output/takeover_20260921/stage_final_cost.log；正式發布：output/takeover_20260921/publish_final_cost.log。git diff --check通過。
- runtimeManifestSha256=ff04f84255da91f495f055f7f45dc8d5eb19e26067da61f9d1dfaaa1c1304984；policyChecksum=2ba5a7d25ffaf015787c100c8c0fd1482c47abee314645c1e336dd8308831b83；dataChecksum=c8ca2cfb5f2af83d5c7d67a610e2fd21c1e920ba19c66836bb50ea800b054b27。
- 唯一入口tools/release_existing_webhook.ps1，固定既有deployment。發布前保存原正式@1505/v323及雲端HEAD；output/release_state/pre_release_formal.json為當次回復指標。Properties、Sheet、費用帳本不可回復清除。
- 此次是使用者自行LINE測試模式，不啟動AI最長30分鐘候選watchdog。BeginLineAcceptance／FinalizeLineAcceptance的原流程保留；預設正式定版仍要求真實LINE封存報告。
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
- 頁級RAG先前F24T350FHC及H704第41頁有真實證據；本輪沒有新增PDF實測。一般頁面OCR、複雜表格、圖示、印刷頁碼仍是能力邊界。
- F612正式worker雙SHA成功屬既有證據；D392/M703外區參考不能當台灣適用，M9官方HTML不等於PDF就緒。參閱docs/V307_OFFICIAL_GAPS.md。

## 下一步

1. 讀本頁、AGENTS.md及git status；只依當次正式health和Git判斷，不重讀巨大聊天或另建狀態檔。
2. 收集使用者新版LINE問題／可見答案，對齊雲端LOG、版本及provider收據；優先檢查錯答、漏限制、錯讀PDF/Web及單題總費用。不得以HTTP200或fixture封存為真人通過。
3. 付費重測保留原批NT$10與月帳；每次先查剩餘，不清歷史。模型改變須同題同證據比較；不盲目重跑已成功付費階段。
4. Developer_Manual.md維護架構與方法、REGRESSION_GUARDS.md維護不變式。正式來源root .gs，.claspignore排除JS/tools/tests/output。
5. 雲端LOG：Sheet 1RTjPac2aoURzlJKTVydapyJlLni4Y0VyQqeeIrHQOqQ、gid174529670，只走本機Chrome；CLASS_RULES維持A欄CSV大字串。秘密不得進repo或LOG。
