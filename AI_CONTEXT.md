# AI_CONTEXT — v29.6.313 正式 @1494

正式 v29.6.313 @1494（BUILD10:38）：formal health、static／contract／production-contract通過，版本容量38/200；20條離線旅程20 PASS／49事件。正式 LOG 已零供應商呼叫遮蔽172／1048筆命中內容。Google Cloud 專案因疑似憑證外洩後遭第三方濫用仍停權，故真人 Gemini／PDF／Web 尚未恢復驗收；程式已對同憑證熔斷、退款並停止補救重送。9/11恢復申訴已收件，Ticket `2FPP7WMWZSXUISBNIVU7DZHTMQ`，通常兩個工作天內審查。本批不換模型、不改 Prompt／Rich Menu／配額，也沒有新增模型費。

本批入口：[交接](docs/V307_HANDOFF.md)、[當次驗收](docs/V307_LIVE_ACCEPTANCE.md)、[worker契約](Developer_Manual.md#v307-自動索引-worker-正式契約)、[來源重查](docs/V307_OFFICIAL_GAPS.md)。F612英文／M9 HTML已補，三款台灣適用證據缺口仍獨立列明。

v29.6.313 新增鐵律：`Smart系列／Smart／Tizen` 是功能平台，不是 M5～M9 家族；只有明講 Smart Monitor／Smart螢幕且答案依款式不同才選系列。只有裸「重設」才問一次整台／Smart Hub／畫面音效，明講回出廠值直接用核實操作證據。Gemini `CONSUMER_SUSPENDED`／憑證拒絕是服務失敗，不是查無資料；同金鑰立刻熔斷 Router/PDF/Web/上傳、零元結算、退來源次數，健康檢查成功才解除。編輯者 TestUI 可執行一次健康檢查與既有 LOG 遮蔽；預留不可冒充實際費用。詳見 Developer_Manual 的 v29.6.313 節。

v307離線證據：30項worker整合全過；20條多輪49事件、20 PASS／0 FAIL／0 BLOCKED，見[離線報告](test_runner/results/v307_20_journeys_offline.md)。載入真路由、只模擬外部I/O，不冒稱20條真人供應商通過。M7真PDF244頁與F612官方ZIP下載／SHA／精確entry核對通過，worker零生成呼叫；M7與F612於15:57:57完成正式prepare／activation／PDF與index SHA probe，零provider，見[正式worker實測](test_runner/results/v307_worker_live_20260908.json)。

前版證據：9/8 v306 @1487曾實測17次文字／按鍵事件（含失敗及重測），59項離線整合通過；81登錄／136型號／47索引就緒，測試帳2.1352。這是歷史讀回，接手須重查正式health，不把其HEAD／local一致敘述套到v307候選。

## 給後續模型的最短操作單

1. 先讀本頁和Developer_Manual的v307節；使用者報錯先Chrome讀雲端LOG／所有紀錄。保持main與未追蹤結果，不改Prompt!C3／模型／Rich Menu／額度。
2. 檢查worker：`node test_runner/verify_manual_index_worker.js`，應核對當次輸出（本次30項）。`manual_index_worker.gs`是簽章入口與原子提交；`manual_worker_runtime.gs`負責同請求版本、catalog／manifest／附件；`tools/manual_index_worker.py`抽頁；`tools/run_manual_index_worker.ps1`是固定正式目標＋Local mutex入口。
3. 秘密只由編輯者短token設定；設定檔在repo外並限制ACL。只回報布林、revision、SHA、去敏`last-run.json`。不得dump設定檔、token、環境變數，也不把它們傳外部AI。
4. `workerHealth`只看最近回報，不等於索引ready。正式一次下載→build→prepare→probe雙SHA→Bot頁檢索／PDF備援讀回全部成功，才建立排程；再查LastTaskResult與報告時間。尚未提供這組雲端證據，勿替主責寫成已部署／已自動每日執行。
5. 新SHA失敗保留舊完整版本；不要提前改manifest或鬆綁SHA。舊pending缺workerBinding須重驗；新文件只綁被官方核實的單一SKU，不借共用檔名整群範圍。
6. F612官方英文38頁手冊印刷封面S27F61*完整匹配，索引SHA `1de245a1c37998a06a77160b381946333177dbfebeff7d867687ca79de7f7b4f`；透過reviewed queue原子換版，不先放寬舊manifest SHA。D392兩款／M703外區資料僅參考，非台灣適用證據；M9 HTML入口不等於PDF頁索引就緒。
7. static／contract／diff／guarded DryRun通過後，由主責走唯一正式發布入口及Chrome TestUI；不要自行clasp push或建立deployment。真LINE手機證據另列。

現行唯一契約：[Developer_Manual.md](Developer_Manual.md)。正式版本當次讀health，不把候選當已發布。[完整舊脈絡](docs/history/v29.6.302/AI_CONTEXT.md) 僅供歷史。

- QA 資料庫 → CLASS_RULES → 官方 PDF 手冊 → 網路搜尋/官方頁（官方頁僅保留連結）→ 誠實告知無資料並提供有用下一步。不可無證據猜規格。
- 條件式守門不是每題必經。型號／系列能RULE解析就不叫模型；新限制不能因已有plan而丟失。
- 一般10／手冊2／網路5，系統補救3。Fast／頁級2.5Lite，PDF／Web2.5Flash，條件式3.7Flash；不自行升級。
- **本批月費共同入口必須先讀Cloud当月費用並seed；未初始化禁止發布**，避免全部付費中斷。
- 不Push、不改RichMenu、不做無關解析度；main、不開分支、不清歷史。

## 設定來源

| ID | 正式來源 | 用途 |
|---|---|---|
| CONF-001 | Prompt!C3 | 正式 system prompt |
| CONF-002 | ScriptProperties | 配額／月預留／手冊revision |

`Prompt.csv` 為本地鏡像/人工備份；部署流程不會自動把它上傳到 Google Sheet。
Prompt 維護鐵律：除非使用者明確要求，程式部署不得同步或覆蓋 `Prompt!C3`。本批不增加題型提示。

## 歷史發布與事故背景（以下不是v307現況）

v305已正式發布 **@1486 / v29.6.305 [2026-09-05 17:03]**；guarded release全部通過，local／HEAD／formal health及build一致，30/200版本。81登錄／136型號／47不同PDF索引已全部啟用且SHA讀回；非81本手冊。修復雙欄交錯、實際表格階層及跨頁引用、SCFU完整型號和唯一代號。Chrome實問G932 PBP、F24護眼、接續切H704自我診斷，均1次2.5Lite、零Router／Web、有核對頁碼。共同測試約NT$2.0622；詳見[本批紀錄](test_runner/results/v305_manual_library_20260905.md)。尚有5個官方來源適用性缺口，不冒充已取得完整手冊；未宣稱本批手機LINE／全案20旅程通過。

歷史 v304：**@1485 / v29.6.304 [2026-09-05 16:15]**；guarded release全部通過，local／HEAD／formal health及build一致，29/200版本。v303手機已成功送達2個HDMI／65W，但LOG1499仍暴露短句展開誤吃內部型號提示；v304已收斂純換型號語法，任何新功能／限制都保留原題，50項完整來源整合及contract通過。

M7簡稱新Chrome聊天室→點S32FM703UC→`那usb-c充電有幾瓦`已完整實問：選型不另扣，回答2個／65W，0模型／0費用，16:14:30雲端LOG1541不再改寫為HDMI。G8系列身分與S99ZZ999未知型號也0模型驗證通過。使用者最新明確要求「自己測不要叫我幫你測，有TestUI」：以AI真正Chrome TestUI＋正式health＋雲端LOG完成本批收尾，不再請使用者代測；手機v303已送達、v304未做手機，保持分列。不得把「使用者只說M7」當必須花LLM或要求自行輸入完整型號。

歷史 v303：guarded release 曾更新既有 Webhook 至 **@1484 / v29.6.303 [2026-09-05 16:05]**，當時local／HEAD／formal health 的版本及 build 一致，版本容量28/200。沒有新增deployment、沒有刪舊版本；@1483保留作程式回復。正式Prompt!C3及Rich Menu未改。

48項完整來源離線整合、static／contract／diff／DryRun通過。Chrome已實問：M7 HDMI→USB-C追問正確65W且零模型；M8 Netflix系列QA零模型；零售→App→睡眠最後一題Lite PDF；G9選型→115頁Core Lighting（保留依型號限制）→額度0時按手冊零費快取重播。選型轉手冊的一般題退款已有完整handler離線驗證，未冒稱手机驗收。

費用讀回驗證合計 **NT$1.58951296，reserved0**（含File Search embedding保守估算0.606816）；後續接孔／Netflix複驗全部0模型。兩份2026官方PDF已更新、六份完整頁索引啟用；共用權限已解除，不要再索取。File Search 10題A/B相容但品質門檻未過，不遷移；實驗資源已清。

v305延續授權完成可驗證全庫索引：81筆範圍登錄／136型號／47不同PDF，不是81本不同手冊。仍有5款外部來源缺口，不能用Product Guide、DRM非PDF或封面矛盾資料湊齊。索引啟用、逐題實測與發布狀態見本批報告；全案20條旅程／5條保留題及未來新PDF自動抽頁不可由覆蓋數冒充通過。「分批」不是自行停止點，不再詢問已授權事項。

Chrome可直接以Google Sheet `/htmlview?gid=174529670` 讀LOG表格文字，無需視覺模型或連接器。先定位最新列再擷取，不dump整份表格。費用逐筆見test_runner/results/v303_live_reliability_20260905.md。

先讀雲端 Spreadsheet `1RTjPac2aoURzlJKTVydapyJlLni4Y0VyQqeeIrHQOqQ` 的 LOG／所有紀錄，按時間串接原題、選型、答案、source/calls/cost，再決定最小重現。舊事件不代表最新版失敗；health綠不代表真人通過。
登入資料只用本機Chrome，不用Connector，不輸出維護密碼或token。正式 `exec?test=1` 與編輯者 `dev?test=1` 共用router，不能Mock冒充真人。

## 模組與發布

linebot.gs：事件／狀態／證據／回覆。manual_index_runtime.gs：完整頁檢索與SHA。manual_revision_maintenance.gs：lease/pending。provider_cost_gateway.gs：生成共同預留／結算。config/manual_registry.json、tools/build_manual_page_index.py：可追溯索引。test_runner/production_harness.js：完整正式來源，只模擬I/O。
禁止只 `clasp push` 後宣稱完成；禁止新建 deployment ID。唯一入口 tools\release_existing_webhook.ps1，先static/contract/diff/DryRun。正式ID `AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA`。
月seed、Cloud Cap幣別／服務、資料SHA、正式health、AI親自Chrome TestUI與雲端LOG核對後commit/push；手機未測就寫未測，不再要求使用者代測。
