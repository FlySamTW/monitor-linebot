# Samsung LINE Bot 開發規範

正式候選已完成 JEV Router 遷移；最終發布以當次 health 為準。生成模型固定為 3.1 Flash-Lite（Fast／頁級 RAG／Polish）與 3.7 Flash（整本 PDF／Web）；條件式 Semantic Router 固定 `typesafe/jev-1.13`，只走 OpenRouter Decisions API，不使用 latest、不回答產品事實。Gemini 專用專案 `shining-sphinx-508304-f9` 維持既有帳單與月停止線；Gemini primary／standby 不自動 failover。OpenRouter key 只存在 ScriptProperties，禁止進 repo／URL／LOG。

一律台灣繁體中文，客觀、不得附和式開場。現行唯一契約：[Developer_Manual.md](Developer_Manual.md)；快速索引：[AI_CONTEXT.md](AI_CONTEXT.md)。[完整歷史快照](docs/history/v29.6.302/AGENTS.md) 的舊額度、技術限制及旁路不得套回正式系統。

接手先讀 [交接](docs/V307_HANDOFF.md)、[當次驗收](docs/V307_LIVE_ACCEPTANCE.md)、[快速索引](AI_CONTEXT.md) 與 [worker契約](Developer_Manual.md#v307-自動索引-worker-正式契約)。歷史失敗與修復保留證據，不當成現行待辦。

- 使用者報錯先讀雲端LOG／所有紀錄；TestUI、Mock、手機LINE分開驗收，不混稱。
- 保持main、不開分支、不清未追蹤結果、不升貴模型、不新增付費服務。QA/RULE→必要PDF→未解部分一次Web，不無證據編造。
- 按來源即授權，不重複確認；型號跨日保存，新限制不能丟失。Prompt不補單題特例，正式Prompt!C3非本機Prompt.csv，程式發布不覆寫。
- 生成前月預留，再來源扣次；重試每次算費，缺usage不填0。一般10／手冊2／網路5，補救3；程式月90元停止線仍保留，Cloud專案目前另有更嚴格的NT$50月封頂、預付餘額約NT$391且自動儲值關閉。封頂非即時阻斷，恢復服務後仍須核對幣別、服務與帳單。
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

## 唯一正式發布入口

改程式更新GAS_VERSION／文件／回歸案例，不為湊版本改Prompt。先在test_runner跑npm run test:static與test:contract，再git diff --check。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\release_existing_webhook.ps1 -DryRun
powershell -NoProfile -ExecutionPolicy Bypass -File tools\release_existing_webhook.ps1 -VersionDescription "v29.6.xxx 說明"
```

禁止自行拼接 `clasp push`、`clasp version`、未帶 -V 的deploy；禁止新增deployment或繞測。月seed／容量／正式health／真Chrome TestUI／雲端LOG验收後commit/push，付費驗收總上限NT$5。2026-09-05使用者明確指定由AI自行TestUI驗收，不再請使用者代測；手機LINE只在已有實測證據時標記通過，不得用TestUI冒充。保存部署版本與資料checksum可回復。
整合測試載入真正router／resolver／驗證器，只模擬I/O；關鍵安全全過、20旅程至少19正確終點。沒驗證不宣稱徹底完成。
