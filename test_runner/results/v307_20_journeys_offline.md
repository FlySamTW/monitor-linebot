# v307 20 條連續旅程：離線，不是 TestUI／手機 LINE

2026-09-08。執行：`node test_runner/verify_20_journeys_v307.js`。

## 測試契約

- 20 條各自隔離聊天室；每條至少兩次真正 `handleMessage`／`handleRichMenuPostback_`，選型使用正式 `#型號:` 訊息入口。
- `production_harness` 載入所有 root `.gs`、真 router／resolver／validator，透過真正 editor importer 匯入47份索引。沒有替換正式產品、路由、驗證器或直接呼叫 helper 冒充旅程。
- 僅 Properties／Cache／Drive／Spreadsheet／clock／HTTP 是本機 I/O。Cache 加入以假時鐘驅動的 TTL；跨日只推進時鐘，不直接寫產品或主題。
- 已知型號 properties fixture 來自當次 `CLASS_RULES.csv` 全文，不自行列特例型號。
- 手冊替身採既有回歸答案或當次`evidenceCandidates`可核對段落，必須綁真實evidenceId；有線網路／多重視窗保留適用限制並回partial，不把未核實PBP／燈光同步寫full。無相關段落回none，不另添來源。
- Router替身依本輪originalQuestion／previousTopic／confirmedModel回真正`RouteAnalysisV1` JSON，只分類主張、不輸出產品事實、不換型號。Fast缺本機證據時用合法`AUTO_SEARCH_PDF`交真router；展開模式只把先前已核實警語整理為一般使用提醒，不添新能力／路徑。
- Web替身回明確無證據及空groundingChunks／groundingSupports，測真實安全終點、不捏造網址；未知provider schema仍BLOCKED_FIXTURE。這是在驗程式如何處理可合理出現的I/O，不能證明live模型一定選同答案。
- 真實供應商 HTTP 0，真實費用0；JSON 中 tokens／NT$ 是替身 usage 用於測正式成本核算，不是 live 消費。
- 每輪輸入、回覆、持久型號／canonicalTopic、來源、router/pdf/webCalls、tokens、fixture evidenceId／page／實際段落、驗證器trace及錯誤皆保存在`v307_20_journeys_offline.json`。`JOURNEY_IDS`僅供指定題號重現；最終20條數字必須清除該環境變數後完整重跑。

## 結果解讀

最終執行：**20條／49個事件，20條 PASS、0條 FAIL、0條 BLOCKED_FIXTURE**，真實供應商0次。通過：1、2、3、4、5、6、7、8、9、10、11、12、13、14、15、16、17、18、19、20；失敗：無；缺fixture：無。程序exit 0。PASS僅代表本報告的離線路由及終點斷言，不代表live／手機驗收。達到本次離線19/20門檻，仍須分列真人證據。

前輪J14第二輪曾BLOCKED；主責補未知型號承接後，最新兩輪均走未知型號安全入口。J13仍保留自然輸入「再詳細一點」，未偷換成UI指令；主責共通自然展開控制修復後，檢查診斷題保留、一般提醒有新增內容且不重讀PDF。

本轮加強J7/J8/J9/J13終點斷言：只有正確model或泛用「無法確認」不能自動算有回答。J7必須明示新同步要求未核實；J8須回到同款HDMI／訊號源；J9須說明PBP／相關多重視窗的證據界線；J13不能只是花費後重播第一答。

### 修正前揭露的終點缺口（歷史；修正後20條已完整重跑）

- J5：page8有線共用段落含「部分型號不支援」，保守partial fixture在model scope守門被拒；最終只generic未知，沒有說明原問有線網路的未核實項目。不能為通過而放寬型號守門。
- J7：第115頁Core Lighting已找回且追問topic保住；該頁沒有同步設定，fixture正確partial。最終保留開關答案卻將「同步未核實」泛化為網路補充未知，不能只因出現Core Lighting就算回答本輪。
- J8：第二輪已換S49DG952SC，但canonicalQuestion變成「改成 同功能呢?」，未沿用HDMI操作；不能只檢查沒出舊型號就算正確終點。
- J9：跨日型號正確；只有Multi View相關段落，fixture不把它當PBP同義，原始excerpt守門拒絕後只剩generic未知。不得為通過而捏造PBP操作或強制相關詞full。
- J13：自然展開已走正式elaboration並保存診斷topic；一般提醒fixture無新產品事實，但後處理再進Manual Authorization而重播舊cache，付了一次Fast却無新增內容。只測topic保留不夠。

主責已修正共通未解主張顯示、換型號後routingQuestion同步、自然展開沿用已核實Evidence契約；J5/J9沒有放寬型號／相關詞驗證，改為明確說出待確認問題。完整重跑20/20後，此節保留事故原因，不代表仍有5項未修。JSON保存最新實際段落、reply及trace。這些離線結果仍不等於每次live模型都成功。

最終逐條狀態以同名 JSON 及下方執行完成摘要為準。`PASS` 只代表指定離線斷言；`BLOCKED_FIXTURE` 代表本次不能驗供應商語意，不代表正式路由錯答。任何 BLOCKED／FAIL 都令 runner exit 1，不能拿它說20條19條正確終點已過。

| 旅程 | 驗證內容 |
|---|---|
| 1 | M7 → 選型 → HDMI → USB-C65W |
| 2 | G8 → 選型 → 更新率 → G-Sync |
| 3 | G932 PBP → 新增兩邊120Hz限制 |
| 4 | M8藍牙能力 → 選型 → 連線操作 |
| 5 | M8 Wi-Fi → 有線網路 |
| 6 | M8 App → 零售模式 |
| 7 | G9燈效 → 選型 → 畫面同步 |
| 8 | M7 HDMI操作 → 換G9同功能 |
| 9 | G8 → 選型 → 假時鐘跨日PBP |
| 10 | 手冊入口 → 取消 → M7規格 |
| 11 | 無PDF型號 → 手冊 → 網路來源切換 |
| 12 | G932已答 → 重按手冊零生成 |
| 13 | H704已答 → 再詳細 → 重按手冊 |
| 14 | 未知S99ZZ999 → 更新率追問 |
| 15 | H704診斷 → 測試時切輸入警語 |
| 16 | F24護眼 → 更新率 |
| 17 | 無型號iPhone17 FAQ → Air FAQ |
| 18 | M7 → 非產品題 → USB-C追問 |
| 19 | 無上下文價格 → 補型號價格 |
| 20 | 洗衣機範圍外 → 取消 |

## 初輪異常排除：未知型號不是已證實正式 bug

初輪 harness 未設 `keyword_map_v1`／PDF model properties。`linebot.gs` 的 `isKnownFullModelToken`（查核時12761行附近）在所有 known-text 空白時刻意回 true，以免空索引誤擋使用者；因此 S99ZZ999 被當已知並進 Web。修正的是測試初始資料：用真 CLASS_RULES CSV 建 known-map properties。

獨立以完整 handleMessage 對照「S99ZZ999支援PBP嗎？」與「S99ZZ999 有PBP嗎？」後，兩句皆 `[Unknown Model Guard v29.5.283]`、fetches=0、持久產品state=null。**不需增加問句字典，不據此修改正式guard**。初輪3 HTTP其實是2次 countTokens +1次generate，不能報3次生成。

另已修正兩個測試誤判：回覆含引述原題「兩邊都能120Hz嗎」不等於肯定；「藍牙揚聲器清單」與預期原文用語一致，不應只接受「藍牙喇叭清單」字面。兩者都沒有改正式答案。

## 官方資料缺口與來源案例

完整可查 URL／SHA／下載原始證據見 [V307_OFFICIAL_GAPS](../../docs/V307_OFFICIAL_GAPS.md)。不把以下項目當離線20條已補齊：

- S27D392GAC、S32D392GAC、S27F612EAC：台灣官方下載 NASCA DRM，不是標準PDF，禁止繞過。
- S32AM703UC：官方120頁PDF封面精確型號不含M703，已渲染檢視，維持適用矛盾拒收。
- S32FM902SC：官方繁中HTML使用者指南已核實入口／目錄／第一章；不能當原生PDF頁級索引ready。可用HTML入口與其章節引用需另外驗收。

## 未驗證界線

未做本報告內的真實供應商、真人 Chrome 或手機 LINE；主責的 live 紀錄需另存。harness 的 Spreadsheet history sheet 並非完整GAS實作，記錄中 `ss.insertSheet is not a function` 是已知I/O fixture限制；不能宣稱歷史工作表落盤驗收。
