# v307–v311 最短接手指引

正式 v29.6.319 @1501 已切到新專案 standby；切換守門要求 3.1 Flash-Lite（Fast／頁級）與 3.7 Flash（Router／整本 PDF／Web）都須極小實呼叫成功。受限 `AQ.` key 只存在 ScriptProperties；備援不自動 failover。2026-09-11 實測 2 calls 皆成功、約 NT$0.000328；新帳單預付 NT$170、auto-reload 關閉、專案月上限 NT$90。

## v29.6.319 冷備援最短路徑

- 專用新 Cloud project 連既有 Billing、先設封頂，只開 Generative Language API，再建限制該 API 的 key。
- 把新 key 儲存到 `GEMINI_API_KEY_STANDBY`，不覆寫舊 key，不改 deployment、webhook、LINE Rich Menu、Drive 索引或 worker。
- TestUI 先讀狀態與「檢查備援可用模型（零生成）」作診斷；只有「全模型驗證並啟用備援」同時通過 3.1 與 3.7 極小生成，才可切換。啟用結果必須列 `verifiedModels`、呼叫數與費用。
- 程式不會在 403 後自動用第二把 key；這是防止雙重費用與兩專案一起受影響，不可刪除此守門。
- 新專案不是申訴繞過的官方保證；若 Cloud 明示帳戶級限制或新專案也拒絕，立即停止，不反覆建專案。

本文件記錄這批實作決策；正式版本／雲端驗收以 `V307_LIVE_ACCEPTANCE.md` 最後讀回為準。不要把候選測試當正式部署。唯一現行契約仍是 `Developer_Manual.md`。

## v29.6.313 正式交接

- Smart/Tizen 改為平台身分；Smart Monitor 才是 M5～M9 家族。平台共通重設有核實資料即答；裸「重設」只問一次範圍，不再先選機型。
- 供應商 403 停用憑證改列 `credential_denied`：零實際費用、退來源次數、同憑證熔斷 Router/PDF/Web/上傳；不再自動 Web 重送，也不能顯示「手冊查無答案」。
- 維護動作 `provider_health` 成功才解除熔斷；`redact_logs` 僅遮蔽近 1,200 列敏感字串，不刪 LOG。任何建立／替換 API key 都屬安全敏感動作，必須在實際操作前取得明確確認。
- 離線回歸須見 `Smart 怎麼重置 → 一次範圍選擇 → 整台恢復出廠 → 第171頁答案`、已鎖定 S32FM703UC 口語追問直答，以及 403 一次送出後零後續 fetch。

## 不可變原則

- main、不升模型、不增付費服務、不一般LINE Push。QA/RULE→必要PDF→一次未解Web；找不到可靠答案也不能拿其他型號資料充數。
- 一般10／PDF2／Web5／系統補救3；月90元應用停止線。真供應商驗收共享NT$5，不重設ledger來逃避上限。
- 原題、型號、證據與未解主張必須一起傳遞。修改前先讀雲端LOG；不得再用新題型Prompt掩蓋流程問題。

## 此批通用修復與回歸入口

16:32 Chrome J15修後PASS：H704首輪引用第41頁（約NT$0.0048）；追問「測試時可以切換輸入嗎？」走真正pageRAG1、證據1/1、coverage full，Router1 NT$0.0268＋Lite NT$0.005046≈NT$0.0318，Web0、未讀整本，答「診斷期間不要變更輸入」。修前約NT$0.2458為歷史失敗；通用許可／條件分類修復，不是單題Prompt。

| 事故 | 共通修復 | 驗證 |
|---|---|---|
| M8連線找到頁151卻誤拒 | 操作格式「步驟與設定路徑」不是兩項產品主張；真雙功能／數值限制仍守門 | `verify_manual_procedure_claims_v307.js` |
| 更新率答App更新、未知型號偷借舊M8 | 完整規格詞不當動作；沿用既有澄清狀態攔未知身分，不刪已知型號 | `verify_unknown_identity_followup_v307.js` |
| G9「後面的／後方那圈燈」漏頁115 | 只對檢索副本正規化方位、指示／量詞；不把不同燈效認定相同 | `verify_manual_index_worker.js` 真檢索 |
| 新追問／同功能換型號丟原題 | 省略主詞保留前題；換型號後同時更新routingQuestion；完整免費答案仍不叫守門 | `verify_20_journeys_v307.js` J7/J8/J9 |
| 再詳細花Fast卻重播手冊快取 | 自然展開走同一控制入口，繼承真證據；新產品事實／路徑不得藉繼承refs通關 | J13及獨立elaboration守門測試 |
| 網搜結尾重貼規格／給無關拔線建議 | 數值模式限制不能用多數相似款推論；只有真故障才給故障建議；保留具體未解項目 | `verify_web_terminal_v307.js` |
| 手動HDMI切換誤答CEC／自動切換 | 依操作意圖分開檢索section，再驗答案；已核實一般來源選擇不因省略HDMI字被誤拒，數值／複合限制仍不放寬 | `verify_source_switch_intent_v307.js` |

20條測試載入真正root程式，只模擬I/O；完整跑而非修改expect洗綠：

```powershell
node test_runner/verify_20_journeys_v307.js
npm --prefix test_runner run test:static
npm --prefix test_runner run test:contract
npm --prefix test_runner run test:production-contract
git diff --check
```

`results/v307_20_journeys_offline.md`明確標離線；J5/J7/J9某些功能缺證據時只允許具體未知／部分答案，絕不解讀成所有產品功能都已證實。

測試使用本機已核SHA的 `output/manual_library/editor_import.json`；它不是Git內的假證據。新電腦須先依registry取回核實PDF並用既有 `tools/build_manual_page_index.py` 建立測試索引（輸出指定至output，不覆寫正式root catalog），缺資料就明列環境前置，不得改成stub resolver。F612 reviewed套件另保存在 `tools/data/manual_index_packages/`，排程不依賴暫存output。

## 全自動索引的真正邊界

全自動流程已有M7／F612真prepare／probe與排程成功證據：2026-09-08 16:16:10啟動，LastTaskResult=0；16:16:28 `last-run` 為ok=true、completed=[]、failed=[]、providerCalls=0，雲端health成功。此次空佇列是排程成功，不是新增索引證明；首次真啟用另存 `activation-proof.json`，允許空佇列後安全重裝。受限ACL私人資料改存 `D:\99_tools\SamsungLineBotWorker`；原LocalAppData在排程中Test-Path=false，原因未確認，不推測。每日09:30及登入觸發，Limited／hidden／IgnoreNew。正式v311已讀回。

1. GAS官方發現／核實候選寫可信`workerBinding`。無binding、錯角色、未知SHA不收。
2. 既有Windows worker下載核來源、完整抽頁；零LLM抽頁。不要求Sam日常手動複製或`/重啟`。
3. HMAC只准list/prepare/probe/health；PDF/index寫不可變檔並讀回SHA後，單一bundle指標切版。失敗留有效版本，不混新PDF舊index。
4. 本機排程只有真雲端prepare/probe成功後才安裝。受限私人設定在Git外；僅登入本機、網路／Python可用時執行，離線回來補跑，不是24小時雲端算力。
5. 每批最多20份，去敏report保存公平輪替cursor，失敗前列不得餓死後列。不要把空佇列或health回報當成實際建索引成功。

正式證據快取為 `EvidenceV26-OperationPermission`；驗證政策變更須升schema，避免舊結果跨版重播。重整TestUI不代表新模型驗收。

檢查依序：正式health→workerHealth→本機last-run.json→bundle/probe PDF與index SHA→受影響問答。秘密不得輸出、不可交外部AI；不得繞過唯一guarded release入口。

## 五項官方文件

完整下載／封面／SHA證據見 `V307_OFFICIAL_GAPS.md`。M9使用官方HTML入口；F612已有封面匹配的官方英文手冊，中文術語映射只擴召回、不改原文證據。D392兩款及M703外區文件只給標示清楚的參考連結；沒有台灣適用證據不能冒稱已補齊本款PDF索引。GAS抓不了60.5MB ZIP不能靠提高50MB上限假裝修好，採可信來源雜湊及有界PDF傳輸後原子切換。

## 正式操作

發布前讀回月seed、容量及當次測試費用；StageOnly不算發布。用既有 `tools/release_existing_webhook.ps1`，正式health／Chrome TestUI／LOG確認後才commit及push。手機LINE未實測就明列未測；不請Sam代跑已授權TestUI測試。
