# AI_CONTEXT — v29.6.304 已發布 @1485

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

## 錯答先讀LOG

v304已正式發布 **@1485 / v29.6.304 [2026-09-05 16:15]**；guarded release全部通過，local／HEAD／formal health及build一致，29/200版本。v303手機已成功送達2個HDMI／65W，但LOG1499仍暴露短句展開誤吃內部型號提示；v304已收斂純換型號語法，任何新功能／限制都保留原題，50項完整來源整合及contract通過。

M7簡稱新Chrome聊天室→點S32FM703UC→`那usb-c充電有幾瓦`已完整實問：選型不另扣，回答2個／65W，0模型／0費用，16:14:30雲端LOG1541不再改寫為HDMI。G8系列身分與S99ZZ999未知型號也0模型驗證通過。使用者最新明確要求「自己測不要叫我幫你測，有TestUI」：以AI真正Chrome TestUI＋正式health＋雲端LOG完成本批收尾，不再請使用者代測；手機v303已送達、v304未做手機，保持分列。不得把「使用者只說M7」當必須花LLM或要求自行輸入完整型號。

2026-09-05 最新：guarded release 已更新既有 Webhook 至 **@1484 / v29.6.303 [2026-09-05 16:05]**，local／HEAD／formal health 的版本及 build 一致，版本容量28/200。沒有新增deployment、沒有刪舊版本；@1483保留作程式回復。正式Prompt!C3及Rich Menu未改。

48項完整來源離線整合、static／contract／diff／DryRun通過。Chrome已實問：M7 HDMI→USB-C追問正確65W且零模型；M8 Netflix系列QA零模型；零售→App→睡眠最後一題Lite PDF；G9選型→115頁Core Lighting（保留依型號限制）→額度0時按手冊零費快取重播。選型轉手冊的一般題退款已有完整handler離線驗證，未冒稱手机驗收。

費用讀回驗證合計 **NT$1.58951296，reserved0**（含File Search embedding保守估算0.606816）；後續接孔／Netflix複驗全部0模型。兩份2026官方PDF已更新、六份完整頁索引啟用；共用權限已解除，不要再索取。File Search 10題A/B相容但品質門檻未過，不遷移；實驗資源已清。

本批依原計畫「分批發布」上線，不代表全案完成。全案20條旅程／5條保留題、全庫索引與完整PDF/index不可變原子切版仍待完成。手機與Git最新狀態以上方v304為準；保留全部工作樹、舊歷史及結果。事故與逐題時序詳見實測報告，不把早先「候選未發布」紀錄當成現在狀態。

Chrome可直接以Google Sheet `/htmlview?gid=174529670` 讀LOG表格文字，無需視覺模型或連接器。先定位最新列再擷取，不dump整份表格。費用逐筆見test_runner/results/v303_live_reliability_20260905.md。

先讀雲端 Spreadsheet `1RTjPac2aoURzlJKTVydapyJlLni4Y0VyQqeeIrHQOqQ` 的 LOG／所有紀錄，按時間串接原題、選型、答案、source/calls/cost，再決定最小重現。舊事件不代表最新版失敗；health綠不代表真人通過。
登入資料只用本機Chrome，不用Connector，不輸出維護密碼或token。正式 `exec?test=1` 與編輯者 `dev?test=1` 共用router，不能Mock冒充真人。

## 模組與發布

linebot.gs：事件／狀態／證據／回覆。manual_index_runtime.gs：完整頁檢索與SHA。manual_revision_maintenance.gs：lease/pending。provider_cost_gateway.gs：生成共同預留／結算。config/manual_registry.json、tools/build_manual_page_index.py：可追溯索引。test_runner/production_harness.js：完整正式來源，只模擬I/O。
禁止只 `clasp push` 後宣稱完成；禁止新建 deployment ID。唯一入口 tools\release_existing_webhook.ps1，先static/contract/diff/DryRun。正式ID `AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA`。
月seed、Cloud Cap幣別／服務、資料SHA、正式health、AI親自Chrome TestUI與雲端LOG核對後commit/push；手機未測就寫未測，不再要求使用者代測。
