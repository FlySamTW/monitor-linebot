# v306 接手操作單（唯一現行契約仍為 Developer_Manual.md）

## 先看結論，不能自行補題型規則

本輪改善來源：test_runner/results/review_20260908.md。v305 可回復基線 @1486，main ee0218a。9/8已 guarded 發布 v306 @1487，health／HEAD／local一致；實測和剩餘範圍見 test_runner/results/v306_live_20260908.md。之後仍須當次讀回，不能僅依文件判定現況。

| 修改 | 位置 | 不得破壞的界線 |
|---|---|---|
| 操作回答保留同段警語 | manual_answer_quality.gs、hydrateManualPageRagResponse_ | 僅核實並已採用的 menuPath／evidenceId／頁碼，同款同設定段；不得補猜測操作、其他列警語，不新增 LLM |
| 新 SHA 推廣前檢查索引一致 | manual_revision_maintenance.gs、promoteOfficialManualToRoot_ | 在任何 Drive 寫入前阻擋不一致；舊 PDF／manifest／active index 全保留，不放寬 SHA |
| 待建索引去重 | stageOfficialTwManualCandidate_ | 相同 SKU＋SHA 不每日重付第一頁驗證；新 SHA 可重驗 |
| 覆蓋報告一致 | readReadyManualIndexModels_、buildManualCoverageReport_ | PDF 與有效 active 頁索引取聯集；舊 SHA 不得算就緒；分列 pendingIndexRevisions |
| 具名家族與口語連接意圖 | extractNamedMonitorFamilyTokens_、getQaIntentTokens_、family選型入口 | Smart螢幕／顯示器等同一身分詞；完整QA命中先答，不能注入前台H704；「接螢幕」為有線顯示意圖，不把充電問法也當顯示 |
| 取消永遠是控制事件 | handleMessage前置→handleRichMenuPostback_取消共用入口 | 無pending、N、/取消也不得啟動LLM／恢復中斷題／扣一般額度；清暫存選型與澄清，不刪持久型號與月帳 |

QA/RULE → 必要 PDF → 僅未解部分一次 Web。不改模型、額度、Rich Menu、Prompt!C3。不增加每題守門、不加入單題 Prompt。不把外部 AI 的結論當產品證據。

真人第一輪另發現：原文前綴「―」使警語去重失效，已先去除排版符號再比較；明確「切勿」被模型標 partial，導致不必要 Web。頁級共通生成契約新增「明確禁止也是否定答案」，不寫 H704 或其他單題知識，不放寬實際證據驗證。重測結果仍須另記，不能僅改文字就稱解決。

## 新 PDF 更新的真實邊界

本批完成的是「防止新 PDF 讓舊頁索引失效」與可讀取的待建佇列，**不是無人完整建索引已完成**。GAS 不能直接跑本機 PyMuPDF；既有排程只有下載與 URI 同步，不能聲稱每日自動產生逐頁索引。沒有新增付費主機。

後續完整自動化不可只移除 promotion barrier。需同時完成：

1. 從編輯者 TestUI 的索引報告讀 pendingIndexRevisions（不可傳 access token 給外部 AI）。下載只接受已驗證官方下載網址，核對 SHA／角色／首頁型號。
2. 在可靠的既有執行環境執行 build_manual_page_index.py；保留欄位、步驟及模式限制。registry、PDF、頁索引必須同一版。
3. 解決 prepared revision 的正式切換：現有 importer 會拒絕 compiled 與 manifest SHA 不符。不可為了匯入而提前改 manifest，亦不可把 readManualRevision_ 放寬。需要預備指標／完整版本包讀回驗證後才切 active，失敗保持舊完整包。
4. 用改 SHA／失敗／重跑／成功各一例驗證，再開背景排程。未有可靠執行環境與此原子切換契約前，不安排空殼排程冒稱完成。

## 驗證命令（零供應商）

```powershell
npm --prefix test_runner run test:static
npm --prefix test_runner run test:contract
npm --prefix test_runner run test:production-contract
node test_runner/verify_manual_library_retrieval.js
git diff --check
```

library 測試載入所有 root .gs、真 importer／resolver／validator，只模擬儲存與外部 I/O；47包81登錄136型號。新增案例：H704同段不切輸入警語、新SHA不能寫Drive、舊active仍可用、錯誤包裝後去重。不可把函式替身綠燈當成雲端已驗收。

## 真人旅程驗收清單

Chrome 現有 /dev?test=1；共用 NT$5 ledger，不重設。逐題保留時間、實際回答、型號、sources、router/pdf/webCalls、usage、費用。下列是測試設計，未記結果就是未測。

1. M7有幾個HDMI → 選型 → 那USB-C能充幾瓦。
2. G8更新率多少 → 選型 → 支援G-Sync嗎。
3. G932 PBP怎麼開 → 兩邊都能120Hz嗎。
4. M8可以接藍牙喇叭嗎 → 怎麼連。
5. M8 Wi-Fi怎麼連 → 改接網路線呢。
6. M8內建App怎麼切 → 零售模式在哪。
7. G9後方那圈燈怎麼開 → 我要跟畫面同步。
8. M7 HDMI切換 → 改問G9同功能（不偷借M7）。
9. 已選G8跨日 → 昨天那台怎麼開PBP（時間只可在隔離I/O模擬）。
10. 按手冊 → 取消 → M7一般規格。
11. 實際覆蓋報告中的無PDF款 → 查手冊 → 到有用終點、不借檔。
12. 同款同題同資料版本重按 → 快取，不重扣。
13. 有證據答案 → 再詳細 → 再按一次不重複消耗。
14. S99ZZ999支援PBP嗎 → 拒絕猜測，不花來源費。
15. H704自我診斷 → 測試時能切輸入嗎（警語）。
16–20 保留題：另款已登錄基本規格、無型號一般FAQ、插入非產品題後續問、無上下文「多少錢」、洗衣機範圍外。不得把未測保留題列成功。

Claude 只提供題庫草案，主責刪除未核实 A83U／S27HG802SC 等預設答案和「全部 G8 必須選型」假設；以實際 RULE 與答案是否因款式而異決定。

## 發布與 Git

12:55追加FAQ實測發現旧「SMART MONITOR」辨識漏掉句中的「Smart螢幕」，繼承H704並被手冊額度擋住。主責在建立正式版本前中止發布。修復的是家族名稱解析／口語意圖／既有精準QA先於必要選型，不加iPhone產品事实或逐題分支。新增完整handleMessage整合：H704既有狀態→iPhone17顯示QA→iPhone Air顯示QA，以及充電不得誤命中反例。

只用 tools/release_existing_webhook.ps1；先 DryRun、StageOnly、Chrome 受影響真人旅程，再正式既有 deployment。驗月 seed、容量、health、雲端 LOG；最後只 stage 本批檔案、commit/push main，保留其他未追蹤結果。沒有手機實測就不能標手機LINE通過。
