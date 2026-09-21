# Samsung LINE Bot 開發規範

正式候選已完成 JEV Router 遷移；最終發布以當次 health 為準。生成模型固定為 3.1 Flash-Lite（Fast／頁級 RAG／整本 PDF／Web／QA 維護）；條件式 Semantic Router 固定 `typesafe/jev-1.13`，只走 OpenRouter Decisions API，不使用 latest、不回答產品事實。Gemini 專用專案 `shining-sphinx-508304-f9` 維持既有帳單與月停止線；Gemini primary／standby 不自動 failover。OpenRouter key 只存在 ScriptProperties，禁止進 repo／URL／LOG。

一律台灣繁體中文，客觀、不得附和式開場。現行唯一契約：[Developer_Manual.md](Developer_Manual.md)；快速索引：[AI_CONTEXT.md](AI_CONTEXT.md)。[完整歷史快照](docs/history/v29.6.302/AGENTS.md) 的舊額度、技術限制及旁路不得套回正式系統。

接手先讀唯一 [目前狀態](AI_CONTEXT.md)，再依任務讀本規範與 [開發手冊](Developer_Manual.md)。[舊交接](docs/V307_HANDOFF.md) 與 [舊驗收](docs/V307_LIVE_ACCEPTANCE.md) 僅作歷史證據，不能用其中的舊模型、費率、額度或啟用步驟覆蓋現行契約。

- 使用者報錯先讀雲端LOG／所有紀錄；TestUI、Mock、手機LINE分開驗收，不混稱。
- 保持main、不開分支、不清未追蹤結果、不升貴模型、不新增付費服務。QA/RULE→必要PDF→未解部分一次Web，不無證據編造。
- 按來源即授權，不重複確認；型號跨日保存，新限制不能丟失。Prompt不補單題特例，正式Prompt!C3非本機Prompt.csv，程式發布不覆寫。
- 生成前月預留，再來源扣次；重試每次算費，缺usage不填0。一般10／手冊2／網路5，補救3；程式月90元停止線與Cloud專案50元月封頂保留，自動儲值關閉。預付餘額只放當次狀態與證據，不沿用歷史數字。封頂非即時阻斷，恢復服務後仍須核對幣別、服務與帳單。
- 一般LINE禁止Push；等待動畫尽早。RichMenu不任意重建。
- 型號／文件角色／官方來源／SHA／頁碼共同守門，檔名非範圍證據。更新失敗保留有效版，不拿暫存URI當成功。
- root .gs才是正式來源；.claspignore排除 **/*.js、tools/**、test_runner/**、output/**。聊天Webhook不掃整庫。既有compiled索引用編輯者分包匯入；新PDF用簽章本機worker→官方SHA核對→不可變PDF/index→單一MANUAL_WORKER_BUNDLE指標切換，不能放寬舊manifest SHA，也不能把全索引塞Properties／正式程式。
- worker只接受已驗證pending單一SKU／角色／官方URL；舊pending缺workerBinding須重驗。秘密僅編輯者短token設定，存本機受限設定檔及ScriptProperties，不入repo／LOG。先真實一次下載、建索引、prepare、probe與Bot讀回，再建排程；失敗留舊完整版本，不以health心跳冒稱索引完成。
- F612已找到官方英文38頁手冊，印刷封面S27F61*完整匹配、索引SHA `1de245a1c37998a06a77160b381946333177dbfebeff7d867687ca79de7f7b4f`，已由正式worker啟用並完成PDF／索引SHA probe。D392兩款與M703仍只有外區參考，不能充作台灣適用證據；M9已有官方HTML入口，不是PDF頁索引就緒。詳見[來源重查](docs/V307_OFFICIAL_GAPS.md)；不解DRM、不借相似型號、不捏造頁碼。
- UM下載分類不代表使用手冊角色；Product Guide／快速入門不得因日期較新而覆蓋操作手冊。已授權計畫不能把「分批發布」當作自行停止點；若剩外部資料缺口，必須列出實際證據與影響。
- CLASS_RULES維持A欄CSV大字串，不展欄。UTF8讀檔，勿因終端解碼亂碼重部署。
- PDF命名沿用無國家碼型號本體排序逗號；第一頁／支援頁核範圍，不能盲刪全部尾字母造成混款。
- 禁止Connector／ChatGPT帳號資料；登入用本機Chrome，公開資料先Web／CLI。重複自動化評估smart-ui-automation Skill。重要改動做受影響真人旅程，不做無關解析度測試。
- 新技術先查官方。File Search不等於Files API；舊「一定換API、貴模型、儲存收費」已過時，未相容性與A/B不可遷移。


## 費用與證據永久鐵律（v324）

- QA／RULE → PDF → WEB 是證據優先順序，不是每題固定跑三次。免費精準答案與完成快取優先；相關候選與可直接回答必須分開判斷，語意模型應看 QA 答案與 RULE 內容。一般通論不得寫成單題 Prompt 或產品分支；案例只放測試或正式 QA。
- 無型號不等於必須補型號。通論／個別產品需求由同一次候選語意判讀決定，不用連接、設定、使用等詞硬擋；通論缺證據才查 Web，不讀無關 PDF，不先生成無證據草稿。判讀失敗與資料不足分開；較強模型不能補救模型根本沒收到問題或證據的流程錯誤。
- 正確率第一、總成本第二。比較須包含後續生成、錯誤翻 PDF／Web 和每個正確可用答案的總成本；只比 JEV 單次價格不算通過。正式流量只跑一個方案，A/B 只限編輯者驗收。
- PDF 手冊回答是核心能力，費用優化不得移除手冊檢索、削弱頁碼／型號／SHA 驗證，或以泛用回答冒充手冊答案。發布驗收必須明列實際 RAG／PDF 呼叫、所用頁面、有效答案與費用；Google File Search、Files API、自建頁級 RAG 分開記錄。
- 費用歸因先看當次收據／LOG 和版本差異，禁止把整本 PDF、少量頁段、既有證據重用混成同一件事。便宜模型讀大量內容仍可能昂貴；較低費用不等於 JEV 的功勞。模型、輸入內容或題目不同，不得冒稱同題 A/B 或計算全面節省比例。
- 對外說明費用須明確區分單一階段、單題完整流程、整批驗收與背景維護；估算需附幣別／匯率依據，供應商用量估算不是帳單實付。測試題數、模型呼叫數、搜尋 query 數分列；失敗、比較及重測全數保留，禁止只挑便宜成功案例代表整批。使用者未要求報告時，將原委與證據指標寫入相關 MD，回覆只講必要結論。
- 所有生成只走 providerFetch_：明列用途、固定模型、輸入範圍、輸出上限、預留費用與收據 ID。禁止藉共用 THINK 常數連帶升級 QA 維護，禁止依模型名稱猜用途。升模型或提高價格必須有前後品質／費用證據；相容性修復不是例外。
- 首頁核驗禁止傳整本 PDF，也不能靠「只讀首頁」提示詞假裝切頁。先由本機抽字；必要辨識只能傳抽出的首頁文字或實體單頁圖。不得轉貴模型備援。來源 SHA、抽取器版本、政策共同作快取鍵；SKU／地區／角色逐筆核實，衍生檔 SHA 不得取代原 PDF SHA。
- 持久區分抽取、SKU 核實、索引建立、啟用待讀回、雙 SHA 讀回完成。完成付費階段不得因後段失敗重跑；pending／指標／health 都不代表完成。舊有效版在失敗時保留。
- 永久不適用文件停止自動付費；只有內容／政策變更或明確修復才重開。暫時錯誤同一階段最多三次，間隔至少一個排程週期。記錄階段、HTTP 狀態、原因和下次重試時間。
- 正常下載、抽字、建索引零 LLM。必要首頁辨識每份內容最多一次送出，預留上限 NT$0.05、每日 NT$0.10、每月 NT$1；仍計入共用月帳。PDF NT$0.35、程式月 NT$90 與 Cloud 既有封頂不得放寬。
- 聊天／QA 維護／診斷／背景／重試共用總帳，分用途統計。同題共用費用預算；重試不能拿新額度。驗收新批次不得清舊帳或月總額。缺 usage／cost:null／逾時為估算或未知，不能歸零。4xx 明確拒絕與送出後結果不明必須區分。
- 400／404、空 PDF 答案及格式錯誤禁止同內容盲目重送或轉 Web；只有真正資料缺口才能升來源。已驗證的部分答案必須保留，補查只針對未解項目。搜尋做了不代表必有可靠資料，不得編造；仍要提供已確認內容與可行下一步。
- 搜尋依模型和生效日期計價，分清生成請求、實際查詢與工具費。共享免費額度未核實就保守估算；一次請求可能多個查詢，預留上限不是供應商帳單硬封頂。超額／未知扣入共同帳以限制後續支出。
- 付費驗收回報須分列題目、同題重測／A/B、模型呼叫次數、搜尋查詢數及各項費用；不能用單一便宜題代表整批成本。顯著支出且答案不合格時，先揭露該筆與累計，再安排有明確修正依據的重測。已失敗費用不可消失，估算／預留／帳單實付不可混稱。
- 發布必跑費用鐵律、靜態、契約、核心旅程及本次風險驗收。完整 PDF 入首頁、缺預算生成、未知費用歸零、無限重試、個案否定覆寫都須擋下。使用者指定真實 LINE 時，以實際輸入／可見回答及雲端 LOG 對齊驗收，不要求先跑 TestUI；受影響 worker 另驗雙 SHA。TestUI、離線 fixture、LINE API 接受送出都不能冒稱真人收到合格答案。
- 保留免儲存費要求。Files API 免費上傳／儲存48小時後刪除，定期重傳可維持附件可用；不得把續期上傳混算生成費用，或未核對容量與到期覆蓋率就移除。Google File Search 持久索引、Files API 暫存與付費 Context Caching 分開評估；不得為減少重傳自行啟用付費儲存／快取或每日重建收費索引。

## 唯一正式發布入口

改程式更新GAS_VERSION／文件／回歸案例，不為湊版本改Prompt。先在test_runner跑npm run test:static與test:contract，再git diff --check。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\release_existing_webhook.ps1 -DryRun
powershell -NoProfile -ExecutionPolicy Bypass -File tools\release_existing_webhook.ps1 -VersionDescription "v29.6.xxx 說明"
```

禁止自行拼接 `clasp push`、`clasp version`、未帶 -V 的deploy；禁止新增deployment或繞測。月seed／容量／正式health／指定真人旅程／雲端LOG驗收後commit/push。付費驗收依當次明確授權與共同帳本上限，舊批次支出不得清除；目前額度與阻礙只放AI_CONTEXT.md。真實LINE驗收可取代先跑TestUI，但離線必要檢查不可省略；只有實際輸入及可見回覆才標LINE通過。保存部署版本與資料checksum可回復。

受控 LINE 候選只可用同一入口 `-BeginLineAcceptance -LineReadinessReceipt <已核對檔>`；要求真實 LINE 可操作、雲端時窗讀回、模型比較審查及同批餘額，最長30分鐘。`-FinalizeLineAcceptance` 須 sealed LINE 可見回答／事件／provider收據及20旅程門檻全部通過；不重新建版本。失敗／到期由同一入口 `-RollbackVersion` 回復正式 pin 與原 HEAD。背景 watchdog 須電腦與網路持續可用，其實機結果另列；不得以離線時鐘 fixture 冒稱已驗證雲端逾時回復。上傳前一律備份 HEAD，回復後核對全部檔案 SHA；不得清除 Properties、Sheet、月帳或歷史驗收費用。
整合測試載入真正router／resolver／驗證器，只模擬I/O；關鍵安全全過、20旅程至少19正確終點。沒驗證不宣稱徹底完成。
