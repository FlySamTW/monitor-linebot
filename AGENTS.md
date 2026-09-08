# Samsung LINE Bot 開發規範

一律台灣繁體中文，客觀、不得附和式開場。現行唯一契約：[Developer_Manual.md](Developer_Manual.md)；快速索引：[AI_CONTEXT.md](AI_CONTEXT.md)。[完整歷史快照](docs/history/v29.6.302/AGENTS.md) 的舊額度、技術限制及旁路不得套回正式系統。

v306 接手先讀 [具體操作單](docs/V306_HANDOFF.md) 與 [本次實測](test_runner/results/v306_live_20260908.md)：分開已修／實測／外部限制；禁止把待建索引佇列說成已無人建索引、把20條設計題庫說成20條全過。

- 使用者報錯先讀雲端LOG／所有紀錄；TestUI、Mock、手機LINE分開驗收，不混稱。
- 保持main、不開分支、不清未追蹤結果、不升貴模型、不新增付費服務。QA/RULE→必要PDF→未解部分一次Web，不無證據編造。
- 按來源即授權，不重複確認；型號跨日保存，新限制不能丟失。Prompt不補單題特例，正式Prompt!C3非本機Prompt.csv，程式發布不覆寫。
- 生成前月預留，再來源扣次；重試每次算費，缺usage不填0。一般10／手冊2／網路5，補救3；月90元應用停止線。**首次月帳seed未完成禁止發布**。Cloud cap實際9/5讀回NT$90，不依名稱100判斷；幣別／服務另核對，非即時阻斷。
- 一般LINE禁止Push；等待動畫尽早。RichMenu不任意重建。
- 型號／文件角色／官方來源／SHA／頁碼共同守門，檔名非範圍證據。更新失敗保留有效版，不拿暫存URI當成功。
- root .gs才是正式來源；.claspignore排除 **/*.js、tools/**、test_runner/**、output/**。Webhook不掃整庫，改背景排程。全庫完整索引禁止整包嵌入正式程式；用已登錄SHA的編輯者分包匯入，讀回後才啟用。
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
