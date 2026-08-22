# Samsung LINE Bot 完整流程解析 (v29.6.252)

## 2026-08-23（v29.6.252 / 移除 PDF 選檔死快取）

- v29.6.251 正式 LOG 顯示，混合手冊題後端約 17.3 秒，其中 Gemini 生成 5.03 秒；`KB Select` 到生成設定之間另有 3.37 秒空檔。
- 程式在選好本題 PDF 後同步寫入 `${userId}:last_kb_files`，但全專案沒有任何讀取者；真正 PDF 呼叫一直直接使用 `getRelevantKBFiles()` 的回傳值。現已移除這個死寫入與不必要的序列化。
- 這項修改不改選檔結果、歷史、來源狀態、配額、Prompt 或模型，也不增加任何供應商呼叫。靜態契約禁止 `last_kb_files` 再被加回。
- Prompt 本文沒有變更；僅將版號對齊 v29.6.252，正式同步後仍須讀回 782 字，避免程式與 Prompt 契約版本分離。
- 正式 TestUI 受影響旅程實測 17.35 秒；`KB Select` 到 `Generation Config` 為 0.87 秒（v29.6.251 當次為 3.37 秒）。只掛 1 份正確共用手冊，`pdfCalls=1 / webCalls=0`，2.5 Flash 生成 4.43 秒，成本 NT$0.1313；回答只出現一次 HDMI 規格並保留第 23、24 頁。

## 2026-08-23（v29.6.251 / 手冊單次免費預檢與 Prompt 發布守門）

### 正式 LOG 定位與決策

- v29.6.250 正式混合題在選定完整型號後、建立付費 operation 前已做一次 QA／RULE 免費預檢；建立 operation 後又用相同問題與型號重跑一次。兩次之間沒有新增任何證據，第二次只增加本機查詢、LOG 與等待，不能改善答案。
- 只移除 operation 後的重複預檢。保留「型號解析後、額度判斷與 operation 前」的第一次預檢，命中仍直接回覆、零扣次、零 PDF；未命中才建立 operation，防連點、快取與原子扣次契約不變。
- `sync_prompt_c3.ps1` 在 Windows PowerShell 5 傳送中文時曾被靜默截短。發布工具現在會先轉入 PowerShell 7，以 UTF-8 bytes 傳送，並回讀比對 Prompt 版號與字數；不同即失敗，禁止把殘缺 Prompt 當成功。
- 模型、費率、額度及來源順序不變：QA／RULE → PDF → 必要時 Web；Fast／Polish 仍為 Gemini 2.5 Flash-Lite，PDF／Web 仍為 Gemini 2.5 Flash，沒有新增模型呼叫。

## 2026-08-22（v29.6.250 / 單題快路徑、證據去重與 PDF 續期韌性）

### 正式實測後的決策原委

- v29.6.249 正式 TestUI 顯示，精準 RULE 本體約 1.5 秒即完成，但 TestUI 單題發送前又做一次 checkPdfCost RPC，使使用者體感多等約 12 秒。這是測試介面重複工作，不是 QA／RULE 慢或模型變笨。
- 「規格＋操作」複合題中，RULE 與官方手冊可能用「2 個」、「兩個」或省略版本號描述同一個介面。只比完整字串會重複；以模糊相似度刪文又可能誤刪操作步驟，因此採可稽核的「同型號＋同介面＋同數量／版本」決定式去重。
- Gemini Files 為 48 小時檔案；過期手冊若以檔名掃全 Drive，會把不相干檔案的時間加在客戶請求上。每日整庫重傳若單檔失敗，也不得把其他成功的新 URI 一併丟棄。

### v29.6.250 永久契約

1. TestUI 直接單題不再額外呼叫 checkPdfCost；正式後端的 PDF countTokens、NT$0.35 上限、每日額度與冪等保留不變。批次／排隊測試仍保留前端費用提示。
2. 一般問答已完成 QA／RULE 預檢後，自動進手冊不重跑第一次無型號預檢；解析出完整型號後的免費 QA／RULE 預檢仍必須早於扣額與 PDF 供應商請求。
3. RULE 與手冊合併只做決定式事實比對，不增加 LLM 與模糊相似度階段。同事實只顯示一次，手冊獨有的步驟與頁碼必須保留；同介面數值衝突時以經結構化解析的 RULE 為準、記錄 Evidence Conflict，禁止將兩個矛盾結論同時給客戶。
4. 客戶端只保留一個自然頁尾，例如「資料來源：三星官方規格、三星官方手冊（第 23、24 頁）」；不重複顯示內部證據段落或程式流程。
5. PDF 過期自癒先用索引的 driveFileId 直接取本題檔案；只有舊索引無 ID 才用檔名搜尋，找齊目標立即停止。新索引必須保留 Drive ID、大小、更新時間與 identity。
6. 每日同步單檔失敗時，只沿用該檔舊 URI，其他上傳成功的新 URI 立即生效；Drive 掃描本身不完整時才保留整份舊索引。維護稽核欄位使用 Gemini 正式 expirationTime，禁止使用不存在的 expireTime。
7. 模型、費率、額度與供應商不變：Fast／Polish 仍為 Gemini 2.5 Flash-Lite；PDF／Web 仍為 Gemini 2.5 Flash；LLM_PROVIDER 仍固定 Gemini，不新增潤飾、評分或第二次生成。

## 2026-08-22（v29.6.249 / 回應熱路徑、證據邊界與真人化終點）

### 決策原委

- 正式雲端 `LOG` 顯示，一題零 LLM 的精確 RULE 查詢從 webhook 收到到進入每日額度守門曾相隔約 35 秒；其間一般 webhook 會先掃描全部 ScriptProperties，且無條件刪除當日 20／5／10 額度、pending、上一題與 AnswerEnvelope。這同時造成慢、額度看似重置及追問狀態遺失，是本版 P0 根因。
- 同一題進 Gemini 前，核心路徑會同步讀 `Prompt!B3:C3`，Fast 組 Prompt 又讀一次 `Prompt!C3`；精確 QA／RULE 尚未判斷前還先呼叫 LINE loading API。TestUI 因假 userId 固定收到 400，零成本回答也因此白等。
- 正式回答雖正確，規格題固定追加「隨時告訴我」、完整 PDF／Web 成功後仍掛「再詳細＋另一來源」，歷史又保存費用、來源與搜尋統計；這會重複文字、增加下輪 token，並誘導沒有新增價值的付費查詢。
- 舊 deterministic RULE 另把 Tizen、HAS 或型號系列推成 App 可安裝、手機投影、Pivot、AirPlay 等資料庫未明載的結論；Web grounding 成功後也曾被固定 USB 排查文覆寫。兩者都違反「證據只支持實際輸出主張」。

### v29.6.249 永久契約

1. 一般 webhook 不得清除有效的 `SRC_QUOTA_`、`USR_QDAY_`、`SRC_PENDING_`、`SRC_RECENT_` 或 `ANS_ENV_`。只在每日 04:00 排程清除舊日期／已逾時狀態；`SRC_RESCUE_` 舊日鍵亦一併清除。禁止保留可一鍵全刪上述狀態或自動建立固定維護密鑰的 helper。
2. Prompt 溫度與 C3 採 `GAS_VERSION` 綁定的同次記憶＋5 分鐘 ScriptCache；一次 Sheet 讀取供 Fast/PDF/Web 與重試共用。同步 Prompt 後必須清掉此快取。
3. 精準 QA、RULE、指令與選型等零模型路徑不得呼叫 loading API。只有真正送 Gemini／PDF／Web 前才顯示，單一事件最多一次；TestUI 完全略過 LINE API。`writeLog()` 只存記憶體，Webhook `finally` 最多批次寫 Sheet 一次；同步 `flush` 與刪除舊 LOG 列只能放每日排程。
4. deterministic RULE 只逐字擷取目前型號明載欄位。App、操作、故障、投影、AirPlay、3D 等只有精準 QA 可免費回答；否則交既有 PDF。操作＋規格複合句必須先保留可確認的 RULE 事實，只把未解操作送 PDF；「HDMI 連接埠有幾個」等純規格不得因含「連接」誤進 PDF。HAS、高度、左右旋轉與 Pivot 分開判讀，沒有欄位只能說規格未列，不得推成「沒有」。
5. Web 回覆只能使用 grounding 支持句，不得以固定題型文案覆寫後仍掛來源。同題 operation identity 保留完整子意圖；USB 格式與斷線、藍牙配對與無聲不得共用快取。
6. 完整手冊／Web 成功即為終點，不再掛「再詳細」或無關來源；PDF 已自動 Web rescue 後不得再誘導同題 Web。只有 Web 無證據且型號確有手冊時，才提供一次反向手冊入口；終端失敗保留官網。
7. `#再詳細說明` 的可信度只認 `AnswerEnvelope.status=supported` 且有 `evidenceRefs`；「資料不足／請查來源」即使文字很長也不得再花 Fast。
8. 對話歷史只保存答案語意、型號、步驟與頁碼；來源、費用、配額、搜尋統計與補救流程頁尾必須移除。共同 Prompt 不提供固定客服尾語範例，PDF 只遵循既有 JSON Schema，不再同時要求文字證據標記。
9. 模型與費率不變：Fast／Polish 仍為 Gemini 2.5 Flash-Lite；PDF／Web 仍為 Gemini 2.5 Flash；沒有新增模型、第二次潤飾或供應商階段。
10. 無證據 App 終點只有該完整型號 RULE 明載 Smart Monitor／Tizen 時，才可提供「首頁 → 應用程式」；非 Smart 型號只說目前無法確認，禁止套用不存在的選單。

## 2026-08-22（v29.6.248 / 同類介面規格完整彙總）

- v29.6.247 正式 TestUI 驗收發現，`S49DG932SC` 的 RULE 同時列有 `HDMI 2.1 x1` 與 `Micro HDMI 2.1 x1`，舊解析器卻只取第一個 regex 命中，錯答成只有 1 個 HDMI。
- v29.6.248 改為逐欄收集並彙總同類介面；一般問 HDMI 時會同時列出標準 HDMI 與 Micro HDMI，明確問 Micro HDMI 時則只回答該子類。這是所有型號共用的資料解析規則，不是為 G932 加特例。

## 2026-08-22（v29.6.247 / 自動手冊完成鏈、客戶輸出收斂與 Rich Menu 發布契約）

### 決策原委與被取代的舊規則

- 正式雲端對話顯示：使用者問完整型號操作題時，系統先花一次 Fast、再回「資料不足，請按手冊或網路」，按手冊後才得到正確答案；最終又把同一內容以自然回答、操作路徑及 Evidence 摘錄重複三次。答案雖正確，旅程仍多一次無效等待，並把程式如何查證的細節丟給客戶。
- 因此 v29.6.247 **取代** v29.6.245「未授權只能推薦 PDF」的規則。一般提問本身即代表希望取得完整答案；只要 QA／RULE／已核對官方片段不足，且題目屬型號操作、設定、故障排除或其他需要手冊證據的產品事實，就直接進手冊完成鏈，不再先回「要不要查手冊」的 CTA。
- Rich Menu 仍保留三個常駐入口，作用是讓使用者主動指定來源或開始新問題；它不是一般回答鏈必經的同意閘門，也不能讓主流程停在「請再按一次」。

### 永久回答與計次契約

1. 回答順序固定為 `精準 QA／CLASS_RULES／已核對片段 → 對應型號 PDF → 必要時 Web`。前一層已有足夠證據就停止，禁止為了展示能力多叫一次模型。
2. 題目需要 PDF 且已有唯一完整型號時直接查；只有系列名、別稱或不完整型號時，候選必須取自正式 `PDF_MODEL_INDEX`，選完立即查原題，不再重問問題或確認來源。
3. 一般題若只完成到「轉手冊」，退回本次每日 20 題額度；真正送出 PDF 前才原子計手冊每日 5 次。不得同一題同時扣一般題與手冊兩種額度。
4. PDF `no_evidence`、格式驗證失敗、索引／供應商錯誤或其他我方因素，統一自動做一次受控 Web rescue；此救援不扣使用者每日 10 次 Web 額度。救援後仍不足，可顯示「再查網路」與「到這款官網」，但不得再提供同一手冊來源重試而形成迴圈。
5. 客戶只看一次整理後的結論、必要操作路徑、官方手冊頁碼，以及簡潔的資料來源／本次費用。Evidence 原文摘錄、模型名稱、token、供應商呼叫、路由判斷與內部狀態只留 LOG／TestUI 稽核，不得出現在 LINE 回答，也不得用不同標題重複同一內容。
6. 同題重按或同義改寫優先讀取 operation cache；不得因按鈕連點再次扣費或重新進同來源。

### Rich Menu 是否存在是獨立發布守門

- 正式 JSON 必須為 `selected: true`，但這只代表選單在 LINE App 初次開啟時預設展開；輸入鍵盤時選單會暫時被鍵盤取代，LINE 電腦版不顯示 Rich Menu，都是平台行為，不能當成發布失敗。
- Rich Menu 是 LINE 平台上的獨立資產。`release_existing_webhook.ps1` 更新 GAS Webhook **不代表** default Rich Menu 已建立或仍有綁定；每次選單異常須依序 inspect 目前 default → validate／publish → 回讀 default ID。
- 全體 default 只套用到沒有 per-user 綁定的帳號；個別綁定優先於 default。若特定帳號看不到或看到舊選單，先查其 per-user Rich Menu ID，解除失效覆蓋後再確認 default，不得反覆重發 Webhook。

### 模型與費率

- 本版沒有更換模型或新增供應商：Fast／一般整理仍使用 `gemini-2.5-flash-lite`，整本 PDF 與 Web 使用 `gemini-2.5-flash`。
- 費率表、NT$ 換算、單次成本上限與各來源每日額度均維持既有設定；本次只消除多餘 Fast、重複輸出與錯誤重試，不新增隱性付費階段。

## 2026-08-21（v29.6.246 / 完整手冊優先、PDF 候選自癒與檢索升級門檻）

### 這次不是補「睡眠計時器」特例

- 正式雲端 LOG 證實，`S32FM803UC 睡眠計時器要在哪裡設定？` 確實送出 `pdfCalls=1`，但掛到 41 頁、涵蓋 17 個型號的快速指南；Drive 另有 245 頁、只涵蓋 `S32FM702／703／803` 的完整手冊，且第 157 頁明載睡眠計時器。根因是同型號 PDF 排序錯誤，不是手冊沒有答案，也不是先補一條 QA 就能治本。
- 所有「已由使用者授權」的手冊查詢改採同一文件品質排序：完整型號命中優先，其次涵蓋型號較少，最後才以檔案大小判斷完整度；不得再用 HEVC、USB、睡眠計時等題目關鍵字決定要不要選完整手冊。
- 若 URI 清單只有快速指南，正式手冊操作會掃描 Drive 的同型號 PDF、只補傳排序第一的較聚焦文件並持久合併索引；六小時保存最佳候選，已有完整手冊時零上傳、零重複供應商動作。一般 QA／RULE 與未授權自動判斷不執行這個 Drive／PDF 動作。
- `config/manual_lexicon.json` 與 `manual_golden_cases.json` 新增睡眠計時器的跨問法黃金題，只用於驗證頁級檢索；正式答案沒有寫入 runtime QA，也沒有新增題型 route。離線索引目前 12 個情境、60 個自然改寫，Recall@5、改寫 Recall@5、negative pass 皆為 100%。
- 正式 TestUI 驗收已回讀 Google Sheet `LOG`：正確掛載 `S32FM702,S32FM703,S32FM803.pdf`，過期 URI 自動單檔更新，`pdfCalls=1 / webCalls=0`，第 154、157 頁證據通過；2.5 Flash 本題成本 NT$0.1827。這證明選對文件後現行模型可完成本題，日常不需 `/重啟`。

### Google 官方能力邊界（2026-08-21 查核）

- [Document understanding](https://ai.google.dev/gemini-api/docs/document-processing) 說明 Files API 適合大型或重複使用文件，PDF 上限 50 MB／1,000 頁，檔案保留 48 小時；這條路徑會把文件交給模型理解，並不等於先做頁級語意檢索。
- [File Search](https://ai.google.dev/gemini-api/docs/file-search) 才會 import、chunk、embedding、semantic retrieval 並提供 citation；目前支援 Gemini 3.x（含 3.5 Flash／Flash-Lite），不含正式仍使用的 2.5，且同一請求不能和 Google Search 或 URL Context 併用。
- [官方價格](https://ai.google.dev/gemini-api/docs/pricing) 顯示 File Search 建索引 embedding 為 US$0.15／百萬 tokens，儲存與查詢 embedding 免費，實際取回片段仍按所選模型 input tokens 計費。它可能降低每題輸入量，但不能只看索引便宜就推論總成本一定下降。
- 結論：現行 Files API 是受支援但不具檢索保證的長文件 fallback，不能稱為最佳 RAG。近期正式方案是「正確文件選擇＋既有人工 Evidence／頁級索引＋整本 PDF fallback」；File Search 與自管頁級索引先做 shadow A/B，不直接換正式流量。

### 下一階段影子評估門檻

以至少 20 題、涵蓋快速指南／完整手冊並存、不同型號、選單路徑、規格表、故障排除與自然追問的固定題集，比較現行 Files API、自管頁級索引與 File Search：

1. 正確文件召回率必須 100%，錯型號／錯文件回答為 0。
2. 有效答案須含可核對頁碼與片段，成功率至少 95%；找不到不得把模型推測冒充手冊事實。
3. P95 延遲不得比「已選對文件」的現行基準惡化超過 20%。
4. 以「每個可核對有效答案」計算總成本，不以單次 token 或單次 API 價格決定；成本較高須有明確成功率收益並另行核准。
5. File Search 若通過，仍維持手冊與 Web 分成兩次 SourceOperation，不能因工具限制把來源混在同一請求。

## 2026-08-21（v29.6.245 / 結構化 QA、零成本缺口守門與來源授權）

- 正式 TestUI 實測發現「繁體中文介面與雙喇叭」被單一喇叭 RULE 提前截斷。現在精準 QA 先答完整；同一句有兩個以上規格面向且沒有精準 QA 時，不讓單一 RULE 欄位終止，改由既有 QA/RULE context 一次整合。
- 這是通用的多主張完整性守門，不是針對 S27FM501EC 寫死答案；產品事實已轉成 QA2 資料。
- G8 真人選型抓到 `263.5mm` 被舊正規式誤當 `3.5mm` 耳機孔；已改成獨立數值邊界判斷。這是所有尺寸／端子共用的單位解析修正，不是 G8 型號特例。
- 真人測試也抓到兩條 v29.6.217 遺留的自動 PDF 旁路。現已統一為：免費 QA／RULE／已核對片段先答；不足時同時提供手冊與網路，只有使用者按手冊才產生 PDF 請求。
- `getExplicitCapabilityCheck_` 與 RULE 欄位抽取現共用相同的 3.5mm 數字邊界；缺口題可在送 Gemini 前零成本停止，避免花錢只換到另一個 CTA。

### 為什麼重構

- 舊 QA 是「標籤＋自然問句 / A：整段白話」，每次 Fast 問答仍可能把整份 QA 放進 Prompt；資料越多，延遲、token 與錯誤借題機率都一起增加。
- 已人工核對的 PDF 片段原本以 `queryPatterns`、型號與事實陣列硬寫在 `linebot.gs`。這能救單題，卻會讓每個新問法都變成新的程式分支，長期必然回歸。
- v29.6.240 另曾讓模型的 `[AUTO_SEARCH_PDF]` 在型號明確時直接執行 PDF；這違反來源授權與成本守門。v29.6.241 恢復為只顯示手冊入口，必須由使用者按下才執行。

### 唯一 QA2 資料契約

- `qa_knowledge.gs` 是 QA 與人工核對手冊片段的唯一知識層。新資料以 `QA2:{...}` 單列 JSON 寫入 Google Sheet `QA!A:A`，仍符合既有 A 欄大字串架構。
- 必要欄位：`id`、`question`、`scope(models/aliases/families)`、`terms`、`answer`、`evidence`；`answer` 分為 `conclusion/facts/steps/cautions/alternatives`，不保存客服口吻或整段 Prompt。
- `evidence.type=qa` 代表精選 QA；`evidence.type=manual_chunk` 代表已人工核對的官方手冊頁面。手冊記錄另保存 `sourceFile/pages` 或 HTML `location`。
- 舊版 `[標籤] 問題 / A：答案` 不需一次性破壞遷移，讀取時會轉成相同 record；新的 `/紀錄`、`handleAutoQA` 與 `writeQA` 一律存 QA2。
- LINE 回覆由共用 renderer 白話化：先講結論，再列操作步驟、事實與提醒；資料列不需要也不得重複塞聊天口吻。

### 大量資料的檢索方式

1. 同步 QA 時先建立固定大小 record shards，並以詞彙、型號、系列與別稱建立 16 桶倒排索引。
2. 每題只讀取命中的索引桶與必要 shards，再用完整型號硬隔離、別稱／系列、關鍵詞與題意重疊加權排名。
3. 精準 QA 可直接零 LLM 回覆；需要 Fast 模型時最多只注入前 6 筆相關 QA，不再隨 QA 總量放大 Prompt。
4. `G8` 等模糊系列如果 QA scope 不相符，不得借用 Smart Monitor 或其他系列答案；多候選仍交由既有 CLASS_RULES 型號選單。
5. 人工核對手冊片段也走同一索引；型號與題意同時命中才可零成本回覆，錯型號、故障題與排除詞不得借用。

### 建檔與維運

- `/紀錄` 的管理者預覽仍顯示可讀問題與答案；正式寫入才轉成 QA2，不把 JSON 顯示給一般使用者。
- `tools/sync_qa2_evidence.ps1 -DryRun` 先列出本機 `QA.csv` 內的 QA2 IDs；發布後以 `-ConfirmWrite` 透過受維護密鑰保護的 `upsert_qa2` 端點依 `id` 新增或更新，不重複堆資料。
- 新特例的正確處理是：若為穩定產品事實或已核對手冊頁面，新增 QA2 資料與契約案例；只有跨題通用的來源、授權、型號隔離、證據與成本規則才可改路由。

### Gemini PDF / File Search 官方查核與決策

- Google 的 [Document understanding](https://ai.google.dev/gemini-api/docs/document-processing) 仍建議大型或重複使用 PDF 採 Files API；目前專案的「Drive 每日同步 → Files API URI → 單次掛一份完整 PDF」因此仍是官方支援路徑，不是錯誤 API。
- Google 2026-08-18 更新的 [File Search](https://ai.google.dev/gemini-api/docs/file-search) 會自動切塊、embedding 與語意檢索，並可回傳 PDF `page_number` citation；索引 embedding 為 US$0.15／百萬 tokens、儲存與查詢 embedding 免費，取回內容仍按模型 input token 計費。
- File Search 目前只支援 Gemini 3.x，且不能在同一請求與 Google Search／URL Context 併用。正式服務仍以 Gemini 2.5 Flash-Lite／Flash 為主，所以本版不直接切換供應路徑。
- 後續採「同一批代表性手冊題 shadow A/B」決策：比較可核對答案率、頁碼引用正確率、P95 延遲與每個有效答案成本；只有 File Search 明顯勝出且 PDF→Web 兩階段仍能保持來源隔離，才另案升級。不得以單次成功或模型較新直接換正式架構。

### 回歸守門

- `verify_structured_qa_contract.js` 驗證：舊 QA 相容、QA2 寫入、精確型號隔離、G8 不借錯系列、未知型號不借答案、Prompt 最多 6 筆、手冊頁面命中與排除詞。
- 既有 human/source/cost/AnswerEnvelope 契約仍必須全綠；正式 TestUI 只需重走受影響的 QA、模糊型號、手冊授權與自然追問，不做無關的多解析度版面測試。

## 2026-08-21 (v29.6.240 / 序號追問上下文解析、消除工程用語洩漏與再詳細說明白話展開)

1. **上一則條目序號追問精確解析 (`resolveNumberedStepFollowup_`)**：當使用者追問「6是什麼意思」、「第3點」、「最後一步」時，自動回溯上一則訊息對應的第 N 點（例如第 6 點：USB 選擇性暫停），直出白話原理（防止 Windows 休眠關閉 USB 供電導致 3D 斷連）與詳細控制台設定路徑，徹底根除瞎猜 165Hz 規格的失誤。
2. **徹底消除使用者端工程用語洩漏**：在輸出渲染器 `renderCustomerFacingText_` 中地毯式過濾 `[費用:...]`、`（合計 N 次生成請求）` 與後端配額提示行，保持純淨自然的朋友聊天畫面。
3. **重構「#再詳細說明」為實質深入白話解說**：點選「#再詳細說明」時不再彈出「不同版本有些許差異請點手冊」的甩鍋罐頭，而是帶著前 5 輪完整歷史直接深入白話展開。

1. **型號選單後精準找回原始問題**：在 `executeLegacyManualModelSelectionViaSourceRouter_` 中加入從對話歷史回溯原始問題邏輯，確保點選型號後絕對帶上原始問句（如「支援 AirPlay 嗎」），杜絕因問句遺失而盲目總結手冊第一頁規格表。
2. **手冊查詢入口優先執行本機確鑿規格**：在 `executeAdvancedSourceQuery_` 手冊查詢開頭調用 `tryManualFreeLocalAnswer_`，命中 AirPlay、直式/橫式投影等確鑿規格時立即 0 秒秒回（NT$0.0000），避免進入手冊後因手冊未寫而產生誤判。
2. **全面支援手機橫式/直式畫面投影**：在 `buildDeterministicExactRuleReply_`、`isLikelyLocalSpecRuleQuestion_` 與 `QA.csv` 中擴充支援橫式播放（自動 16:9 全螢幕滿版）與直式顯示（中央直向留黑邊）。
2. **FM5 無陀螺儀/固定底座硬體事實**：在 `buildDeterministicExactRuleReply_` 與 `QA.csv` 中精確載明 FM5 (M50F) 原廠底座為固定式且「無內建陀螺儀」，投影時直立手機兩側留黑邊，螢幕本身無法隨實體旋轉自動轉向；若需畫面隨實體旋轉滿版需選購具備陀螺儀與 HAS 旋轉支架的 M8/M9。
2. **修正型號選單底部文案**：將 `createModelSelectionFlexV3` 卡片底部的舊版「點選型號後會載入手冊（約30秒）」全面修正為「點選型號後立即為你解答」。
2. **Smart Monitor 直式手機投影確鑿判定**：在 `buildDeterministicExactRuleReply_`、`isLikelyLocalSpecRuleQuestion_` 與 `QA.csv` 中加入直式投影標準指引，秒回直式比例顯示與旋轉切換步驟，杜絕停滯等待手冊按鈕。
2. **歷代 M5 (DM5/CM5/BM5/AM5) 與 FM5 AirPlay 確鑿判定**：DM5 (2024 款 M50D)、CM5、BM5、AM5 判定為「支援 Apple AirPlay 2」；FM5 (2026 款 M50F) 判定為「無原生支援 Apple AirPlay 2」並提供外接線材建議。
2. **Smart Monitor App/Netflix 安裝確鑿判定**：在 `buildDeterministicExactRuleReply_` 與 `QA.csv` 中全面納入 Smart Monitor 系列（M5/M7/M8/M9 各型號），秒回標準操作步驟。
2. **M50F AirPlay 確鑿問答防護**：在 `buildDeterministicExactRuleReply_` 中加入 Apple AirPlay 投影專屬規則。針對 M50F (`S27FM500EC`, `S27FM501EC`, `S32FM500EC`, `S32FM501EC`) 明確標示「無原生支援 Apple AirPlay 2」，提供外接線材與 Apple TV 建議；針對 M7/M8/M9 標示支援 AirPlay 2 並給出操作方式。
2. **Web 搜尋全廣域與全球繁中解答**：在 `callLLMWithRetry` 進行網路搜尋時，注入 `getSearchFriendlyModelTokens_` 修剪後之型號別稱（如 `S27FM50`、`M5`），允許檢索全球公開網頁資源，並由 Gemini 綜合翻譯整理為繁體中文實質步驟。
3. **解除手冊阻礙與 SOP 合約相容**：修正 QA 匹配與實體過濾機制，確保多型號 QA 與前置中括號標籤格式 100% 通過靜態守門合約。

## 📋 核心哲學

本機 QA／RULE 優先 + 跨日產品狀態 + 使用者選擇單一來源 + 應用層每日配額 + 可核對來源

代表性真人題、成本與另一個 AI 題庫取捨統一記錄於 `TEST_ANSWER_COVERAGE.md`；不得以 80+ 題批次付費轟炸取代少量關鍵旅程。

### v29.6.204 消除無情句號並引入適配貼圖機制

- 消除生硬死板的「無情句號」，改採 LINE 聊天自然換行與自然流暢斷句，適當輔以 1-2 個自然 Emoji。
- 引入 LINE 官方貼圖機制 (`LINE_STICKERS` & `detectOccasionalSticker`)，於問候、道謝、道別及特定完成情境偶爾適配發送 LINE 貼圖。
- 更新 `Prompt.csv` 與動態 Prompt 指令，全面重塑自然溫暖的朋友通訊對話風格。

### v29.6.203 徹底去除客服腔、假熱情與句尾語助詞驚嘆號

- 全面修正所有引導與範例文案，全面移除「喔！」、「喔～」、「啦！」、「唷！」及氾濫的驚嘆號「！」。
- 改採平實、沉穩、乾脆的專業朋友對話風格，以正常句點「。」與分行結尾，禁止制式客服腔。
- 在 `Prompt.csv` 與動態 Prompt 中加入嚴格禁令，全面杜絕句尾贅字與客服套話。

### v29.6.202 全面人性化真人朋友口吻重塑與內部工程術語清除

- 徹底清查並重寫所有預設引導文案（`buildEvidenceHandoffReply_`、`buildNeedModelForOperationReply`、`buildOutOfProjectScopeReply`、`buildUnknownFullModelReply`、`buildAliasDisambiguationReply`）。
- 徹底移除「QA／規格資料」、「推測當成答案」、「我先不亂猜」、「你只提供別稱」等冷冰冰的工程師判斷術語，全量轉化為親切、自然且富同理心的真人朋友客服口吻。
- 修正 `isOutOfProjectScopeQuery` 對多輪耳機、音訊與配件接線提問的誤判。

### v29.6.201 測試模式全量寫入 Sheet LOG 與所有紀錄頁

- 修改 `writeRecordDirectly`、`writeLog` 與 `flushLogs`，讓 TestUI 與測試端點發生的所有真實問答與系統執行日誌全量寫入 Google Sheet 的 `所有紀錄` 與 `LOG` 頁。

### v29.6.200 通識推理與選單推薦條件相容性優化

- `buildFastAnswerEnvelope_` 將手冊與網搜建議狀態的降級判定綁定至 `evidenceRequired`，確保無須強制證據的通識推理題在包含建議選單時不會被 Answer Envelope 誤降為 `unsupported`。

### v29.6.199 通識推理過濾器解除連接操作關鍵字誤擋

- `isGeneralComputingReasoningQuestion_` 修正前置排除過濾器，精準鎖定純故障/異常/PIN碼，避免「接」關鍵字被 `isOperationOrTroubleshootQuery` 誤判而導致外接第四台情境被攔截。

### v29.6.198 強化維護端點雙重憑證驗證相容性（已由 v29.6.249 取代）

- 歷史版本曾接受 ScriptProperties 與固定預設密鑰；v29.6.249 已移除此旁路，只接受明確設定的維護密鑰。

### v29.6.197 維護授權自保機制與真機多輪對話穩定性優化（已由 v29.6.249 取代）

- 歷史版本曾在屬性缺失時使用固定預設密鑰；v29.6.249 改為 fail closed，未設定就不授權。

### v29.6.196 doGet 入口自動自檢清理與維護密碼保證（已由 v29.6.249 取代）

- 歷史版本曾在每次 `doGet` 清理狀態並自動初始化授權；v29.6.249 已移除，健康檢查與 TestUI 不得碰有效聊天室狀態。

### v29.6.195 淨化 ScriptProperties 並解鎖 UI 唯讀狀態（已由 v29.6.249 取代）

- 移除 `writeAnswerEnvelope_` 向 `PropertiesService.getScriptProperties()` 寫入 `ANS_ENV_` 暫存資料的行為，改純由 `CacheService` 管理短效狀態。
- 歷史版本曾新增全域 purge 與固定維護密鑰；兩者均已在 v29.6.249 刪除。現行只按日期／TTL 清舊狀態，維護密鑰必須由 ScriptProperties 明確設定。

### v29.6.194 通識推理放行

- 新增 `isGeneralComputingReasoningQuestion_()` 偵測函數，識別「已知規格如何搭配使用」（如 4K 解析度對應 Windows 桌面圖示排列、HDMI 接機上盒看第四台、線材選購）。
- 這類題目不要求 QA/RULE 實體來源索引行，`isFastEvidenceRequiredQuestion_` 判定為 false，Answer Envelope 不會因缺乏來源行而攔截為 unsupported。
- 仍禁止猜測第三方 App 可用性、業者服務或未記載的功能能力。

### v29.6.193 未引用答案不得引導消費

- 「未取得可核對連結」的可能方向不得叫使用者購買、訂購、付費或接受帶有通常／可能／不一定的設備能力。先把每個條列拆成短子句，只保留連接、切換、檢查、確認、詢問等低風險可逆動作。
- 安全子句可沿用原條列標題，但不得保留同一句中被剝除的購買前提或設備能力斷言。若清理後沒有實際動作，就不交付該條。

### v29.6.192 Web 無引用草稿資料流

- `callLLMWithRetry()` 在 Search 沒有 chunks/supports 時會把原始文字存入 `lastWebUnverifiedDraft`，並只回傳 `[WEB_NO_EVIDENCE]` 給呼叫端。手冊補救若拿回傳值做摘要，就永遠看不到同次的安全步驟。
- `runManualWebRescue_()` 現在以 `lastWebUnverifiedDraft || webResponse` 作唯一 raw draft；grounded 與 ungrounded 共用相同清理入口。LOG 只記草稿長度與是否產生安全動作，不記第二份全文。

### v29.6.191 無引用 Web 的友善終點

- Google Search 有時只回搜尋查詢與模型整理，沒有 `groundingChunks／groundingSupports`。這不算可引用答案，但若同次回應含可逆、低風險且不借用其他型號的具體動作，可保留為「可能方向」，清楚標示未獲網頁證實。
- 可能方向只保留含使用、連接、切換、檢查、確認或諮詢等動作的條列；含「可能／不一定／其他型號／一般來說／來源不明韌體／工程模式」者丟棄。沒有安全動作時才停在誠實無證據與官網／真人下一步。
- 手冊自動 Web 補救必須攜帶這個安全終點，不能丟回手冊原始 `found=false` 文案；也不得因此偽造網路來源或重新扣使用者 Web 額度。

### v29.6.190 Web 引用完整性守門

- `groundingSupports.segment.text` 可能只覆蓋同一句的一部分；有引用不等於已形成完整回答。摘要器可依原始 Web 回答把 support 擴回「同一條列／同一行」的完整句，但不得跨段吸入下一個未引用主張。
- 擴句後仍需做問題完成度檢查：可以／能否／是否類問題必須出現明確可行、不可行、支援、連接或必要條件；怎麼／如何類問題必須含實際動作。未達門檻就視為沒有可交付證據，絕不能把半句掛成網路答案。
- 此規則屬共通 Evidence 整理層，不得為 `M9`、第四台、HDMI 或其他單題增加 if/else。回歸測試需同時覆蓋「support 半句 + 原始完整條列」可安全恢復，以及只有半句時 fail closed。

### v29.6.189 AnswerEnvelope、補充與單一來源狀態機

#### 事故與判斷原委

- 2026-08-16 19:26 正式雲端 LOG 的 `M9可以接第四台嗎？` 旅程，第一輪與「再詳細說明」都只有 Fast：合計約 NT$0.0474，兩輪均為 `Files=0／pdfCalls=0／webCalls=0／sources=[]`。第二輪草稿又被程式刪掉，只剩手冊 CTA；附件結束前也沒有手冊 postback。因此事故不是 PDF 查不到，而是 PDF 根本尚未執行。
- 直接根因有三個：內部補充提示中的「必要步驟／選單路徑」被拿去當使用者原題分類；手冊與 Web Quick Reply 被寫成互斥；沒有 QA／RULE 證據的模型草稿仍可被當作完成答案。
- Rich Menu 本身不是根因，仍保留為來源捷徑。否決「移除來源鍵、回到模型自動決定」與「按手冊後再確認一次」；採用程式端 AnswerEnvelope 與單一來源狀態機，不把更多產品特例塞入 Prompt。

#### 唯一回答契約

- 每個 Fast 結果先建立 `AnswerEnvelope { originalQuestion, model, claims[], evidenceRefs[], status, unresolvedClaims[], allowedActions[], expandable }`。來源決策只讀 `originalQuestion`；LLM 補充指令不得回灌成意圖。
- `evidenceRefs` 必須綁到實際 QA 列、精確型號 RULE 欄或已驗證來源；模型自帶的來源標籤不算證據。沒有證據的型號能力、調諧器、App、業者支援等產品事實一律移除，不得以「可能」包裝後送出。
- 混合回答若只有部分有證據，保留有證據句並同時提供所需來源；未證實的業者／App／庫存／韌體等句子先剝除。完整證據答案才可顯示一次「再詳細說明」。
- `再詳細說明` 是每題最多一次的 control action：沿用原題、型號與既有證據。上一答無可信證據時零 LLM、零費用，直接列「查官方手冊」與「再查網路」；只有真正產生有證據的補充才消耗一次使用權。

#### 唯一來源契約

- Rich Menu、Quick Reply、`#查手冊`、`#這題再搜網路` 與舊型號泡泡一律匯入 `offered → authorized → needs_model → running → success/no_evidence/failed`。按「查官方手冊」就是授權；缺型號只做一次選型，選完立即執行，絕不再詢問確認。
- 手冊先做零成本 QA／RULE／verified Evidence 預檢；命中時明示未讀整本 PDF、不扣手冊次數。真正 PDF 成功必須有正確文件、`pdfCalls=1`、頁碼、適用範圍與可核對摘錄。
- 手冊缺檔、索引／token／供應商／格式／證據失敗時，自動補查一次非三星公開網頁；不扣使用者 10 次 Web 額度，沿用每聊天室每日 3 次系統補救上限。客戶回覆分成「手冊結果」與「網路補充」；Samsung 官網不作 Web 證據，只保留「到這款官網」連結。
- `operationId` 保護 running／cached：相同題連點不得重複呼叫或扣次。舊 `manual_search_consent` 已 fail-closed；部署前殘留型號泡泡只可遷移到新狀態機，不能再形成另一條付費路徑。
- `/重啟` 是管理員強制清除：會一併刪除產品、題目、pending source、AnswerEnvelope 與歷史；不重傳 PDF、不改 QA／RULE／手冊索引，一般使用者不需要操作。

#### M9 第四台的完成判準

- 題目需拆成可查證主張：同軸／選台器由手冊證據；HDMI 機上盒由 RULE 或手冊；目前業者 Tizen App 由 Web 引用。沒有個別證據不得直接說「沒有調諧器」或「業者可能有 App」。
- 無證據初答可同時顯示手冊與 Web；按「再詳細」不得再付 Fast 費用只得到 CTA；按手冊沿用 `S32FM902SC`，不重選、不再確認。PDF 無答案必須完成一次受控 Web 補救後停止，不得形成同來源重試迴圈。
- 這個決策的回歸指標是：無證據肯定回答為零、二次確認為零、同題重複扣費為零、控制提示污染原題為零。新增知識只補 QA／RULE／Evidence 與契約測試，不再為單一問句增加路由 if/else。

### v29.6.175 最低「有效答案」成本

- 完整型號操作題先依序查精準 QA、該型號 RULE 與 verified Evidence；全部未命中時直接顯示手冊授權並退一般題額度，禁止先呼叫 Fast 猜測再刪除。
- Fast／Polish 保持 `gemini-2.5-flash-lite`。只有使用者已授權、且沒有逐頁 Evidence 的整本 PDF fallback 使用 `gemini-2.5-flash`；理由是同一 48 頁官方手冊已實證 Flash-Lite 會漏掉明載第 36 頁的內容。
- 2026-08-16 Google Standard 官方價：Flash-Lite input/output 為 US$0.10／0.40 每百萬 tokens；Flash 為 US$0.30／2.50。48 頁案例約 12.9K input，Flash 約 NT$0.13，仍受 NT$0.35 單次硬上限。成本 KPI 是「得到可核對答案的總成本」，不是單次模型最低牌價。

### v29.6.176 不完整型號候選

- `G806／M703` 這類可辨識但不完整的代碼，不得直接要求使用者手打完整型號。程式只在 CLASS_RULES 的完整型號 token 中做包含比對：多個候選就列選單、唯一候選才可鎖定；完全找不到才追問背貼完整型號。選型不呼叫模型，也不另扣一般提問次數。

### v29.6.177 PDF 結構輸出與終止 UX

- 2.5 Flash 的預設 Thinking 會與可見回答共用輸出額度；正式黑畫面題曾只輸出 37 tokens，JSON 截在答案中途。PDF Structured Output 固定 `thinkingBudget=0`，將 1,200 tokens 全留給答案、頁碼與摘錄；不為格式補打一通 API。
- PDF→Web 自動補查已執行後，不再顯示「網路解答」讓使用者重複付費；只保留「到這款官網」。任何 `[MANUAL_EVIDENCE_NOT_FOUND]` 等內部標記都不得出現在 LINE。

### v29.6.178 Evidence[] 多證據回答

- PDF schema 不再只允許一頁：統一回 `{found, answer, evidence[]}`，每筆 evidence 含 PDF 顯示頁碼、型號適用範圍與原文摘錄，最多 3 筆。複合題要回答使用者問到的每個子項，操作題若證據有選單路徑／步驟就必須寫出；程式驗證全部 evidence 後才標示官方手冊。

### v29.6.179 操作路徑與證據精簡

- 操作答案必須把手冊章節／功能表整理成「入口分類 → 功能名稱」，不能只回注意事項；Evidence[] 不得拿封面、目錄或型號清單湊證據。偏色／色偏／偏黃／顏色異常屬通用顯示故障症狀，精準 QA／RULE 未命中時走手冊授權，不讓一般模型無來源猜測。
- 發布後必須用同一失敗題確認 Structured Output `found=true`、正確頁碼／摘錄、`pdfCalls=1`、`webCalls=0`；若沒有這組正式證據，不得宣稱換模型改善。

### v29.6.174 決策：PDF 證據存在、輸出格式與跨 Web 必須分離

- 事故原委：`S32HG806ES 韌體更新隨身碟要插哪個孔？` 已將正確 PDF 送入 2.5 Flash-Lite，模型也找到第 36 頁、SERVICE 埠與 `.bin／.img`，但漏了一行自由文字「證據摘錄」，舊程式便把 FORMAT_ERROR 誤當 NO_EVIDENCE，丟棄正確答案又自動 Web。這不是換模型能根治的問題。
- 立即架構：PDF `generateContent` 使用 Google 官方 Structured Output，固定欄位為 `found／answer／pageNumber／scope／evidenceExcerpt`。程式驗欄位後才組客戶文案；模型不再自行控制來源、頁碼 footer 或內部標籤。
- 歷史邊界（已由 v29.6.189 取代）：當時只有 PDF 明確 `found=false` 才進 Web，格式／逾時／索引錯誤停在 pipeline failure。v29.6.189 仍不把這些錯誤冒充「手冊沒有」，但會在同一回覆中清楚標示「手冊結果：系統未取得可核對證據」，再做一次受控非三星 Web 補救，避免把我方失敗丟給使用者。
- 長期架構：QA／RULE → verified chunks → 逐頁 BM25 top-K `Evidence[]` → Flash-Lite 只整理答案並回 evidence IDs → 程式驗證 IDs／page／SHA／原文；整本 Files PDF 只作索引未建或長上下文 fallback。不得再為單一問句新增路由特例。

### 新型號與新手冊每日納管

- Product Finder 新 SKU 先寫入 `PENDING_MODEL_REVIEW`；只有繁中官方手冊第一頁型號也通過交叉驗證後，才自動把白名單欄位寫成正式 A 欄最小 `CLASS_RULES`，不需人工複製。未驗證、錯地區或跨型號資料維持隔離。
- 每日掃描對待審 SKU 建立 `https://www.samsung.com/tw/support/model/<完整XZW料號>/`，只接受 `contentsTypeCode=UM`、繁中、台灣 area、`org.downloadcenter.samsung.com` 且 query 明載 `CDSite=UNI_TW／CDCttType=UM` 的 PDF。
- 下載後驗 `%PDF-`、MIME、10KB–48MB 與 SHA-256，每輪最多 2 本；再由 Gemini Structured Output 只讀第 1 頁抽出完整型號，必須與 Samsung TW 支援頁 SKU 交叉命中才能自動入庫。失敗才放 Drive `_PENDING_MANUAL_REVIEW` 隔離，下一輪重試，不要求管理員搬檔。
- 每輪 2 本以 `OFFICIAL_NEW_MODEL_CURSOR` 輪替候選；任何單本長期失敗都不能卡住後續新品，失敗本身仍保留並在之後輪次重試。
- 第一頁核對先使用 2.5 Flash-Lite；只有結構化身分驗證失敗時才以 2.5 Flash 對同一檔案再核對一次，且整體仍受 250K token 上限與單次升級限制。兩次都失敗才隔離，不得以支援頁 SKU 單獨取代 PDF 內證據。
- 正式檔名完全沿用既有規則：第一頁所有型號去 `L` 前綴與 `XZW`，再於「移除後仍是合法且以數字結尾的型號」前提下移除尾端 1–3 個英文字銷售／地區碼，排序去重後用半形逗號連接；不可維護逐尾碼白名單。新檔自動建立；同名內容更新先複製到 `_MANUAL_AUTO_BACKUP`，再保留原 Drive fileId 更新。共用範圍與既有 active 衝突時不覆蓋，保留隔離重試與 LOG。
- 若 GAS 執行身分對手冊 Drive 資料夾沒有寫入權，通過第一頁驗證的 PDF 會以相同正式檔名直接上傳 Gemini Files API，持久併入 `MANUAL_PDF_KB_LIST`、`KB_URI_LIST` 與 `PDF_MODEL_INDEX`；同名內容更新強制刷新 URI。Drive 與 Gemini 都失敗時，待重試資料仍保存在 ScriptProperties，不需要管理員搬檔。
- 使用者進入手冊流程時，系列／前段型號候選必須再與正式 `PDF_MODEL_INDEX` 取交集；RULE 有型號但無正式 PDF、仍在隔離區或舊按鈕已失效者一律不可選，也不得扣手冊額度。
- Product Finder 欄位通過 SKU、台灣 Samsung URL、產品名稱與官方特色白名單後，以既有 A 欄 CSV 大字串格式自動新增「最小可信 RULE」；不寫價格、庫存或未提供的詳細規格。詳細題仍依 RULE → PDF 路由查證。
- 已核准且內容未變的正式 Drive PDF，由每日 04:00 `syncGeminiKnowledgeBase(true)` 重新上傳 Gemini Files（官方保存 48 小時）；一般使用者與管理員都不需為此 `/重啟`。只有正式索引異常時由 403／404 自癒排程重建；`/重啟` 只用於管理員強制清除對話與來源狀態。

### v29.6.162 正式 12:59 回歸與共用修復

- 正式 LOG 顯示 `M9 可以接第四台嗎 → 那要怎麼安裝 Netflix` 已沿用 `S32FM902SC`，Fast 也產生操作內容，但後段完整型號分支又以藍牙／能力題特例重建文案，最後只剩手冊 CTA。修復後完整型號分支只清除缺型號旗標，不能覆寫前面已保留的部分回答。
- `不會再問一次` 屬內部流程解釋，對客戶沒有幫助且會讓人誤以為還有隱藏關卡；客戶文案只保留「想核對可點查官方手冊」。
- M9 本機 41 頁 PDF 是硬體安裝／規格文件，不含 Tizen App 操作；三星台灣另提供繁中 HTML 使用者指南 v6.5.0。已核對「首頁 → 應用程式 → 選 App → 安裝 → 開啟」並存成帶 `sourceType/location/model scope` 的證據資料，不把同型號硬體 PDF 冒充智慧功能手冊。
- 手冊已授權後的缺檔、索引過期、token／費用預檢、供應商錯誤、證據不足與手冊明示需 Web，統一自動補搜一次非 Samsung 公開網頁；不要求重按、不扣使用者 Web 額度，每聊天室每日最多 3 次，失敗後只提供明確標示的保守方向並停止。
- Fast 溫度限制在 0.4–0.5，PDF 0.2、Web 0.15；每次實際值寫入 LOG。提高 Fast 溫度只為自然口吻，不能放寬型號與來源證據。

## v29.6.161 決策紀錄：由題型特例轉為可稽核證據索引

> 歷史說明：本節保留當時的評估原委；其中「整本 PDF 必須等使用者另按授權」已由 v29.6.247 取代。現行規則以本文件最上方與 v29.6.247 不可回歸矩陣為準。

### 1. 觸發背景與已確認事實

- 2026-08-16 正式雲端 LOG 的 M7 旅程顯示：使用者先問「M7 可以接第四台嗎」，再追問「它要怎麼看 Netflix」；系統已鎖定 `S32FM703UC`，Fast 已產生可用的 Tizen／Netflix 操作答案，卻被「回答不足」判斷丟棄，改叫使用者按手冊，再要求第二次確認。這是來源狀態與答案保留的缺陷，不是 PDF 本身沒有能力。
- 先前為藍牙、USB、HEVC、零售模式、App、Dual Mode 等事故加上的程式分支，最初是為了保護已核對事實；若持續以「發現一題就增加一條路由」修復，會形成規則債，最後既難維護也無法保證改一題不傷另一題。
- 本次也交叉採納外部模型審查的共同結論作為設計輸入：產品身分、證據檢索、來源執行必須分層；但不因此更換供應商、導入向量資料庫或把產品事實塞進 Prompt。外部意見不是正式證據，正式問題仍一律先讀雲端 LOG。

### 2. 曾評估且明確否決的作法

| 作法 | 判定 | 原因 |
|---|---|---|
| 移除 Rich Menu，回到模型自動決定 PDF／Web | 否決 | 少了使用者授權與成本守門，會重演錯來源與意外付費。 |
| Rich Menu 變成必經入口，且按後再確認一次 | 否決 | 使用者直接打字會被打斷；已按來源卻還要二次確認，旅程不自然。 |
| Fast 只要語句流暢就直接當作正確答案 | 否決 | 型號特定規格、支援性與選單路徑會出現幻覺，不能以口吻取代來源。 |
| 每次漏答都在 `handleMessage()` 加題目特例 | 否決 | 路由會無限制成長，改一題就可能造成回歸。 |
| 採「型號範圍 → 證據紀錄 → 來源執行」三層契約 | 採用 | 能把新增知識收斂為資料與測試，成本、型號隔離與使用者旅程仍由共用邏輯保護。 |

### 3. 現行與目標架構

1. **產品身分層**：完整型號是跨日保存的產品狀態；新完整型號或明確「換型號」才取代它。M7／G8 等系列別稱只能提出候選，不能覆寫完整型號，也不能決定任何型號事實。
2. **證據層**：QA、RULE、已核對手冊片段都以「適用型號／型號範圍、主題、同義問法、排除問法、是否操作題、頁碼與原文事實」記錄。`queryPatterns` 只負責找候選；必須先通過完整型號範圍與原文事實核對，不能因別稱或語意相近就當成答案。
3. **來源層**：一般直接提問的自動回答順序是本機 QA／RULE、已核對官方片段、經使用者授權的整本 PDF、最後才是 Web；但使用者明確按手冊或網路時，以該來源為準，網路不得先做 PDF 預檢。每層只能做自己的工作：PDF 不自行聯網、Web 不先掛 PDF；來源權限、每日額度與供應商呼叫都在此層統一管理。
4. **證據強度**：EXACT（精確 QA／RULE）、SUFFICIENT（已核對官方片段）可直接答；PARTIAL 可保留已知部分並提供所需的「查官方手冊」與／或「再查網路」；NONE 才誠實要求缺少的型號線索或建議來源。證據較弱時，答案只能更保守，不能更肯定。

### 4. 不可破壞的使用者契約

- 使用者永遠可直接提問；常駐三鍵是指定來源的捷徑，不是問問題的前置條件。
- 有本題與完整型號時，按「查手冊」就是一次授權並直接執行；不得再問同一題「是否確認」。缺型號時僅選型，選完立即接回原題與選定來源。
- 一個已足夠、有明確本機依據的答案不得因為手冊也可能更詳細而被丟棄；只在證據不足時顯示單一、語意清楚的下一步。
- 已確認完整型號可跨日承接自然追問；不同新題不得靜默借用它作型號特定結論。使用者／管理員明確換型號才清除或取代；`/重啟` 僅是管理員強制工具，不是一般使用者流程。
- QA／RULE 與已核對片段均為零 PDF、零進階額度；手冊／Web 僅在真正發出供應商請求前各扣自己的額度。所有成功、失敗、退款與費用均由同一結果信封渲染，不能漏顯示或重複扣費。

### 5. 往後修復與優化方法

1. 使用者回報回答、PDF、Web、額度或費用異常時，**先讀雲端 Sheet 的最新 LOG／所有紀錄**，以同一段的訊息、型號、來源、PDF/Web calls、費用、額度與退款時序分類；本機快照、舊測試與猜測不能取代正式 LOG。
2. 分類只可落在：產品身分、證據召回、證據缺失、來源／供應商、費用／顯示、或使用者狀態。先修共用層；若是新手冊事實，新增含型號、頁碼、原文核對的證據資料與改寫測試，不可為一個問句新增路由 if/else。
3. Prompt 只承擔口吻、誠實邊界與輸出格式，不保存 iPhone／螢幕型號規格或題型修補。產品事實歸 QA／RULE／手冊證據；同義詞歸 lexicon／證據 metadata；流程歸狀態機。
4. 僅當正式 LOG 證明多型號、多問法皆因頁面召回能力不足，且資料化證據索引無法改善時，才重新評估逐頁索引、File Search 或其他服務。評估前必須查官方文件、相容性、成本、GAS 時限與專案 DNA；不可因單一失敗就換模型或重構供應商。

### 6. 每次變更必守的回歸矩陣

- **改寫一致性**：同一事實的自然問法與同義問法應命中同一組可核對證據，不因措辭不同而改走付費來源。
- **型號隔離**：完整型號 A 的事實不得回答給 B；系列別稱只列候選；群組中不同使用者不得互借產品狀態。
- **證據單調性**：拿掉或降低證據時，回答只能變保守或引導查證，不能變得更肯定。
- **成本升級**：QA／RULE／已核對片段不得叫 PDF；一次來源按鍵最多一個供應商階段；相同失敗不可因連點或同義改寫無限燒費。
- **多輪連續性**：完整型號與原題、一次性「再詳細說明」、選型、手冊／Web 切換都要保留正確主題；不得回頭回答上一題或陷入確認迴圈。

此決策的衡量標準不是「新增多少題型」，而是正式 LOG 中：錯型號為零、重複確認為零、無證據卻肯定回答為零，並以更高的本機／已核對證據直接回答率降低 PDF 與 Web 成本。任何未來優化都必須先證明能改善這些指標，且不破壞上述矩陣。

### v29.6.158 問題狀態、精確 RULE 與一次性補充契約

- 系列別稱（如 M7）只是型號候選，不是已確認型號。只要該規格欄位並非每個候選型號都明載且值一致，就必須先讓使用者選完整型號，不得把候選第一款靜默寫入產品狀態。
- 已確認完整型號的 HDMI／DP／USB-C／解析度／藍牙／Wi-Fi 等單一規格欄位，直接從該型號自己的 `CLASS_RULES` 列回答；`LLM=0`、prompt=0、PDF=0、Web=0。該列未明載就是 UNKNOWN，零模型建議手冊查證，不可從同系列或模型常識推論有／沒有。
- 系統請使用者補型號後，不論點型號氣泡或直接輸入完整型號，都要接回同一個原始問題；補型號不新增 20 題額度。只有回答完成才清除選型等待；若最後只能建議手冊，退回原題的一般額度。
- `再詳細說明` 是控制動作，不是新問題：每個答案最多一次、不扣 20 題、必須保留原問題與已確認型號，用過後按鈕消失。舊按鈕再點只回友善提示，不產生 LLM／PDF／Web 呼叫。
- 補充回答可用一般產品知識改善解釋與口吻，但不得新增、改寫或猜測型號特定規格、支援性、選單路徑或手冊結論。答不到時要像真人說明還缺哪個依據，不顯示內部術語。

### v29.6.157 已核對片段與逐頁索引基線

- 官方 PDF 已人工核對的「型號＋意圖＋頁碼」必須先由程式確定性回答，不得再把同題交給整本 PDF 的機率式檢索。M8／M7 現已涵蓋藍牙音訊、Wi-Fi、Smart View／AirPlay、藍牙輸入裝置、App、軟體更新、出廠重設、零售模式、USB 與 HEVC；G8 涵蓋 S32HG806ES Dual Mode。
- 只有完整型號與操作意圖同時命中才可使用；其他型號、純規格題或故障題不得借用。命中片段時 `pdfCalls=0`、不扣手冊額度，但仍須顯示官方手冊來源、頁碼與 NT$0.0000。
- 客戶回答不得顯示 RAG、BM25、chunk、evidence ID、revision、token、grounding、原始證據欄位或適用範圍。內部證據驗證完成後，LINE 只顯示「答案 → 步驟 → 限制 → 手冊重點 → 官方手冊第 N 頁 → 本次約 NT$…｜額度」；同頁證據必須去重，手冊重點只留對操作有幫助的短句。
- 確定性片段不再用第二次 LLM 潤稿。程式只做受限重排：選單名稱、數字、單位與「僅／必須／不支援／可能／需要」等限制詞必須原樣保留；資訊太長寧可保留必要條件，不得為縮短而變更意思。

### 通用逐頁手冊索引（v29.6.156 影子基線）

- 執行 `python tools/build_manual_page_index.py`，離線抽取 PDF 每頁 canonical blocks、內容 SHA、BM25 lexical index 與 40 頁一組的 gzip shards；不呼叫 Gemini、Drive 或網路，建置成本為 NT$0。
- `config/manual_registry.json` 是精確 model → manual 診斷登錄；`config/manual_lexicon.json` 是跨問法同義詞與意圖觸發器。新增同義詞是改善檢索，不得在程式碼依某一句測試題回傳答案。
- 目前 M8／G8 影子集須達成：首句與改寫 Recall@5 皆 100%、錯型號隔離 100%、失敗 0；輸出留在忽略版控的 `output/manual_page_index/`。
- 正式啟用前還需：把 artifacts 上傳 Drive；以 `MANUAL_ACTIVE::<docKey>` 作唯一 active pointer；候選 revision 完整驗證後在鎖內原子切換；生成模型只可回傳候選 evidence IDs，程式須核對 ID、頁碼、SHA 與原文。v29.6.157 不得宣稱已完成這段正式切換。
- 別稱選型完成後，先以原始問題＋所選完整型號查已核對片段；命中即直接回答，零 LLM／PDF 呼叫。不得像舊路徑先進 Fast、花費後再要求使用者按「官方手冊」。

### 三來源狀態機

`直接輸入 → SPEC/FAQ；按手冊 → 有題目與型號即 MANUAL、缺型號先選型後 MANUAL；按網路 → 直接 WEB。每次只執行一個來源，完成後仍保留已確認型號。`

- `doPost()` 在 `ensureSyncTriggerExists()` 前處理 postback 並套用 `webhookEventId` 冪等。
- ScriptProperties 保存 pending/recent/quota，ScriptCache 加速；key 使用 contextId SHA-256 前 24 碼與台北日期。
- `callLLMWithRetry()` 是強制邊界：PDF／Web 沒有 `ACTIVE_ADVANCED_SOURCE_GRANT` 立即拒絕；預檢通過後才由 `LockService` 原子扣次。
- 每則使用者訊息原則上最多一個進階來源；唯一例外是使用者已確認 PDF、PDF 付費生成卻無可核對證據時，系統可補搜一次非官方 Web。補救不扣使用者網搜額度、每日最多 3 次、不得再次重試或跨回 PDF。所有舊 `#` 指令只進入這套狀態機。
- Rich Menu 依業主 2026-08-14 最新決定，使用 `tools/publish_rich_menu_default.ps1` 設為全體預設；回復用 `tools/rollback_rich_menu_default.ps1`。工具會保存舊 default ID 並讀回確認。
- 新客資訊層級：`① 直接問問題` 是主入口，回答不足才用 `② 官方手冊重查`，需要現況或外部做法才用 `③ 網路解答重查`。
- 顯示契約：`selected: true`；主入口用 `openKeyboard` 直接進入輸入，兩個重查入口用 `openRichMenu` 保持選單展開。鍵盤與 Rich Menu 無法同時顯示，這是 LINE App 平台行為。
- 產品狀態契約：完整型號一經確認就跨日保存，直到使用者給新完整型號、明確按「換型號」，或管理員執行 `/重啟`。短系列名（如 G8）不得覆蓋既有型號，需列 CLASS_RULES 候選。
- 手冊選型契約：無完整型號時可用系列別稱或型號前段列候選；選型前不得讀 PDF、取得供應商授權或扣額度。手冊與網路按鍵本身就是授權；手冊選型後立即執行，不二次確認。

## 三來源使用者旅程與不可回歸矩陣（v29.6.247）

### 共同判定

- 最近題目保存 30 分鐘，用於判定「同一題」與免重複查詢；已確認完整型號另存為持久產品狀態，不受 30 分鐘限制。
- 沒有新完整型號前，數天後的自然追問、手冊、網路與跨來源查證都沿用已確認型號；只有「換型號」、新完整型號或管理員 `/重啟` 才清除／取代。
- Rich Menu 永遠只有三格。「換型號」是已知型號準備被沿用時才出現的情境 Quick Reply，不得變成第四個常駐格。
- 一般 20 題、手冊 5 次、網路 10 次是三個獨立額度。手冊已付費但無證據時可執行一次系統 Web 補救；補救不扣使用者網搜額度，另受每日 3 次供應商嘗試上限保護。

| 案例 | 使用者問法／操作 | 流程走向 | 計次與供應商 | 預期結果 |
|---|---|---|---|---|
| R01 | 進聊天室直接打字，或按「直接問」後輸入 | SPEC/FAQ | 只在形成實質一般答案時計一般 1 次 | 先查精準 QA／RULE；不讀 PDF、不上網 |
| R02 | 完整型號＋規格／FAQ 題 | SPEC/FAQ | 一般 1；手冊 0；網路 0 | 有可信 QA／RULE就直接答，保存完整型號 |
| R03 | 系列別稱（如 G8）＋型號相關題 | SPEC/FAQ → 型號候選 | 選型號不另扣；尚未讀 PDF／網路 | 從 CLASS_RULES 列 Odyssey G8 完整型號，不得猜成 Smart Monitor |
| R04 | R03 選型後本機可回答 | 型號鎖定 → SPEC/FAQ | 整題一般合計 1 次 | 回答所選型號；不得再次跳回系列選擇 |
| R05 | 一般題的 QA／RULE／已核對片段不足，且需要手冊證據 | SPEC/FAQ → MANUAL 執行 | 退回本題一般計次；送出 PDF 前才扣手冊 1 | 保存原題與型號並直接查，不先回手冊 CTA |
| R06 | 一般題最後只能建議網路 | SPEC/FAQ → WEB 建議 | 退回本題一般計次；網路 0 | 保存問題與型號，只顯示網路授權入口 |
| R07 | 按「官方手冊」，已有上一題與型號 | 上一題＋持久型號 → MANUAL | 不扣一般；送出 PDF 前才扣手冊 1 | 按鍵即授權與執行，不得再顯示確認泡泡 |
| R08 | 按手冊後缺完整型號 | 型號候選 → MANUAL | 選型 0；送出 PDF 前才扣手冊 1 | 選定後直接組回原題查詢，不得重問或再確認 |
| R09 | 按手冊後把上一題原句再打一遍 | 同題正規化命中 → MANUAL | 同 R08 | 視為同題並沿用型號，不得重問 |
| R10 | R07 點「換型號」 | 保留問題、清除 previousModel → 等系列／前段 | 全部 0 | 只需輸入 G8／M8／S27DG5，再列候選；不重問原問題 |
| R11 | 手冊 pending 直接輸入不同問題 | 新題＋持久型號 → MANUAL | 不扣一般；送出 PDF 前手冊 0 | 沒有新完整型號就沿用；新完整型號取代；短系列名列候選，解析完成即查 |
| R12 | 手冊流程遇精準 QA／RULE 已足夠 | MANUAL 預檢 → SPEC/FAQ 回答 | 手冊 0；不重複扣一般 | 直接回答，不對客戶解釋未讀 PDF 或內部預檢 |
| R13 | 型號無 PDF、URI 失效未修復、token／NT$0.35 守門擋下 | MANUAL 預檢失敗後系統 Web 補救 | 手冊 0；使用者 Web 0；系統補救最多 1 | 不猜；清楚標示手冊未送出，再查一次非三星公開網頁並到達終點 |
| R14 | PDF 預檢通過 | MANUAL 單一來源 | 手冊 1；PDF 1；Web 0 | 最多 1 份 PDF（比較題 2 份）；客戶只看一次答案、必要路徑、頁碼與簡版來源／費用，檔名、摘錄與適用範圍只留稽核 |
| R15 | 手冊只找到「依型號而定」、無直接證據或 pipeline error | MANUAL → 一次系統 Web 補救 | 已送出則手冊 1；系統補救不扣使用者 Web 額度 | 不下肯定結論；自動補搜一次非 Samsung 公開網頁，仍不足時可給「再查網路／到這款官網」，但不得重回手冊迴圈 |
| R16 | 按「網路解答／再搜網路」 | 原題＋持久型號 → WEB 直接執行 | 不扣一般；真正送出才扣網路 1 | 按鍵即授權；provider query 剝除 System Hint，只搜尋非官方公開網頁，不讀 PDF／Samsung 官網 |
| R17 | 手冊 → 網路 → 再手冊，同一題 | originalQuestion 與 providerQuery 分離 | 各次只扣所選來源 1 | 只有來源成功才更新 lastSource；網搜失敗不得洗掉型號、原句或既有手冊追問鏈 |
| R18 | 10 分鐘內重送相同來源＋型號＋同意圖問題 | 語意操作快取 | 0 新供應商、0 新扣次 | 標點、禮貌字與已知同義改寫回傳前次結果；只有明確新意圖才建立新操作 |
| R18A | Web 已送出但無 grounding supports/chunks | WEB no_evidence | 網路 1；不退款；paid attempt 1 | 拒絕模型內建答案；保留前次成功來源，顯示實際費用與剩餘額度，同題不再重燒 |
| R19 | pending 時按另一來源 | 新來源覆蓋舊 pending | 0 | 只保留最後選擇；不得同訊息執行兩來源 |
| R20 | 輸入「取消／N／n／／取消」 | pending → SPEC/FAQ | 0 | 清除 pending 與舊 PDF mode，不執行來源 |
| R21 | pending 超過 10 分鐘後再輸入 | expired → SPEC/FAQ | 0 | 只提示重新按來源；不得把這句算一般題 |
| R22 | 手冊 5／5、網路 10／10、一般 20／20 | 對應 quota guard | 0 新供應商呼叫 | 顯示台北時間跨日重置；其他來源不受牽連 |
| R23 | 舊文字指令查手冊／再搜網路 | 轉進相同 pending/router | 與 Rich Menu 完全同規則 | 不得走舊 PDF mode、舊自動 PDF→Web 旁路 |
| R24 | 不明型號（如 S99ZZ999） | deterministic guard | 依一般送出防濫用規則計次；PDF／Web 0 | 拒絕猜測，不顯示不存在的手冊證據 |
| R25 | 已選完整型號，問藍牙耳機能力／操作 | RULE 事實守門 → 規格回答或 MANUAL | RULE 足夠只算一般；不足則退一般、送出 PDF 前扣手冊 | 該型號 RULE 若明載 Tizen＋藍牙，絕不可回答「沒有內建藍牙」；需要操作路徑時直接沿用型號查手冊 |
| R26 | 已鎖定完整型號，但本機／手冊／網搜仍無足夠答案 | 原來源結束 → 官方頁承接 | 只開 URI；零 Gemini、零 PDF、零 Web、零計次 | 顯示 `到這款官網`；優先用 RULE 的 PDP，否則用同列 XZW 料號支援頁。短別稱、選型中與成功答案不得顯示 |
| R27 | `G8 有 KVM 嗎` → 選 `S32HG806ES` | 系列選型 → 精確型號 RULE → 必要時 MANUAL | 選型不另扣；RULE 未記載時退一般、送出 PDF 前扣手冊 | `術語_KVM` 不得當成該型號能力；完整規格列未記載時不能回答有／沒有，選型後直接查該型號手冊 |

### 狀態終止鐵律

- 使用者反映正式回答異常時，第一步必須讀 Google Sheet `LOG` 的雲端完整紀錄，核對 user message、掛檔、來源、paid/pdf/web calls、grounding、quota、refund 與最終 Reply；只有 LOG 無法區分時才做一次最低成本重現。

- 成功、失敗、取消、額度用完後都回到可直接提問狀態；來源授權不得黏住，但持久型號不可因此清除。
- 使用者換題、換來源或換型號時，舊 grant 立即失效；只有最近一次 pending 有權執行。
- 所有自然追問沿用持久型號；新完整型號直接取代。短系列名觸發候選而非偷用近似 PDF；不同題只可沿用產品型號，不可沿用舊答案或舊來源授權。
- 回覆若正在要求選型號，當下不能同時送出 PDF；選型、免費預檢、扣次、供應商請求必須依序發生，但選定後要自動接續，不得再要求手冊確認。
- `CLASS_RULES` 對完整型號明載的能力屬硬事實；Fast 模型若輸出相反結論，必須由程式層覆蓋。Smart／Tizen 機種的藍牙題仍逐型號檢查 RULE，不可只靠系列名稱猜測。
- 選定完整型號後，DirectDeep、規格上下文與 PDF 可用性只能保留本輪完整型號；清除系列複數候選 cache，禁止從 `S32HG806ES` 內的 `G8` 再展開或掛到別台 G8 手冊。
- `術語_` 只解釋能力名稱，不是型號支援證據。能力問句若該完整型號列未明載，程式必須攔截模型的肯定／否定答案並導向手冊查證。
- 精確型號守門結論不得被後段泛用提示覆蓋；需要手冊時直接執行，只有手冊或系統 Web rescue 仍不足後才顯示使用者可選的「再查網路／到這款官網」。
- 完整 QA／RULE 答案不得因型號有 PDF 就附加手冊／Web Quick Reply；常駐三格已提供主動入口，回答後 Quick Reply 只在路由判定下一來源必要時出現。
- 精準 QA 未命中的無型號操作／故障／跨裝置題必須在 Fast 前直接 `ASK_MODEL`，零 LLM 且不得提供泛用裝置設定；已有持久完整型號則沿用，兩者不可混淆。

### PDF 可用性、成本與自癒契約

- Fast／Polish 固定為 `models/gemini-2.5-flash-lite`（Standard US$0.10／US$0.40 每百萬 tokens）；整本 PDF fallback 與 Web grounding 使用 `models/gemini-2.5-flash`（US$0.30／US$2.50）。PDF 只在 QA／RULE／逐頁 Evidence 都不足時進入一次性 manual SourceOperation，並受 NT$0.35 單次上限約束。
- 模型決策必須看「有效答案成本」：本次 64,501 input 的 2.5 實際約 NT$0.2068；相同 token 改 3.5 約 NT$0.62。但精準手冊片段已讓同題以 NT$0 正確回答，因此不做 3.5 A/B、也不升級。鐵律是先用 QA／RULE、頁面收斂與已核對片段達成目標；只有未覆蓋題組的整體成功率仍不足，才另案比較 MANUAL 模型，Fast／QA／RULE 永遠不跟著升級。
- 每次 PDF 送出前，必須用同一份含 `file_uri` 的完整 payload 呼叫官方 `countTokens`。100K 是異常防護的絕對 token ceiling；以 2.5 Flash 費率估算的 NT$0.35 單次 ceiling 會更早生效。生成後再依 `usageMetadata` 顯示實際費用。
- `countTokens` 的 429／5xx／缺欄位／連線例外只退避重試一次；PDF generate 的 429／5xx、異常空答也只重試一次。403／404 先從 Drive 單獨重傳本題 PDF 後再試一次，不得直接叫使用者 `/重啟`。
- 每日 04:00（Asia/Taipei）由 `dailyKnowledgeRefresh()` 強制重新上傳 Drive PDF；同步上傳失敗必須以獨立 `failedUploadCount` 計數並排程一分鐘後背景重試。舊清單與備份不可被空清單覆蓋。
- `/重啟` 只清除該使用者的對話與 pending 狀態，不重建 PDF、不清空 QA／RULE／手冊索引。正常使用不需要人工 `/重啟`；只有對話卡在錯誤舊狀態時才使用。PDF 過期或上傳失敗由單檔更新、每日排程與背景重建自癒。
- 日常不需管理者啟動同步；每日 04:00 會自動掃描並重建。若要立即稽核，可在 Apps Script 編輯器執行無參數 `adminRunOfficialManualAutomation()`，它會回傳掃描與同步摘要；此函式沒有公開 Web route。
- 每日重傳完成後必須執行 `auditManualCoverageGaps_()`，比對 `CLASS_RULES` 完整型號與正式 `PDF_MODEL_INDEX`。新加入 RULE 卻缺 PDF，或當代 H／2026 型號缺 PDF 時，寫入 `MANUAL_COVERAGE_REPORT`、`PENDING_MODEL_REVIEW.manualStatus=PENDING_MANUAL_REVIEW` 與 `[Manual Coverage Alert]` LOG。
- `?manualCoverage=1` 與 TestUI 的覆蓋徽章提供人工維護入口，兩者都必須驗證維護憑證。索引空白時狀態為 `INDEX_UNAVAILABLE`，不得把所有型號誤報成缺口。
- 每日重傳若部分 Gemini Files 上傳失敗，`PDF_MODEL_INDEX` 仍以本次完整 Drive 檔名目錄建立；若 Drive 掃描中途例外，正式 URI、索引與備份一律保留前次完整狀態。兩種失敗都排程一分鐘後受控重試，且維運回覆不得假稱同步完成。
- `到這款官網` 只可採本題完整型號或本題路由產生的 `primaryModel`；不得讀取上一題 `direct_search_models` 或 suggested cache。
- 官網 Product Finder 負責發現新機與官方 PDP；Samsung TW 支援頁提供繁中 UM。只有 HTTPS、PDF MIME／magic bytes、SHA-256、Gemini 第 1 頁型號、支援頁 SKU 與既有逗號檔名規則全部一致才自動進正式 RAG；任何矛盾都保留舊 active 並隔離重試，不要求日常人工複製。
- 2026-08-15 正式 `PDF_MODEL_INDEX` 當次回讀 176 項；RULE 的 6 款 H／2026 世代完整型號全部被正式基型號索引覆蓋，當下缺口為 0。H=2026 是本專案年代碼判定，若日後資料來源新增明確年份欄位，應改用欄位而非繼續擴張正則。

- 固定順序：範圍／型號 → 精準 QA → QA＋CLASS_RULES／已核對片段 → 不足時單次 PDF → 無證據或錯誤時單次系統 Web rescue → 必要的後續選項 → 回到可直接提問狀態。
- `[AUTO_SEARCH_PDF]` 是內部「建立一次性 manual SourceOperation」信號；已有唯一型號就直接查，模糊型號先列正式 PDF 候選、選完即查。不得把信號顯示給客戶或只轉成 CTA。
- manual SourceOperation 綁定原問題與型號、單次使用；10 分鐘 pending 只用於等待題目或選型。一般題最多 1 份 PDF，比較題最多 2 份。
- 正式 LINE 與 TestUI 對話泡泡不顯示 token、paidCalls、`[AUTO_*]` 或內部來源標籤；LOG／所有紀錄保留完整稽核，客戶只看到自然來源與 `本次約 NT$...｜來源剩餘 N/上限` 簡版頁尾。
- 服務範圍只含三星電腦螢幕、Smart Monitor 與外部裝置連接螢幕；純手機、純家電、電視與其他領域轉為範圍外。
- 顯示／沒畫面題只保留影像協定、輸入來源與必要線材；未問供電或攝影機時不混入 65W、充電、Power Delivery 或攝影機資訊。
- Fast Mode 最多注入 8 筆相關 RULE，input 最多 12K、output 最多 800 tokens。完整 PDF 先移除無關歷史並以含 `file_uri` 的 `countTokens` 預檢；20K 僅記錄成本警戒，100K 是絕對 token ceiling，而 2.5 Flash 的 NT$0.35 成本 ceiling 通常更早拒絕送出；計數失敗仍 fail closed。
- PDF output 最多 1200 tokens；PDF 失敗不得拔掉手冊後改用 AI 內建知識回答，必須進一次受控 Web rescue，再以可核對結果或明確後續選項結束。
- `Request Audit` 以 JSON 保存 `stage/model/paidCalls/pdfCalls/webCalls/inputTokens/outputTokens/estimatedCostTwd/sources`；客戶版隱藏 token，只保留簡版 `本次約 NT$...｜今日提問剩餘 N/20`。
- `CLASS_RULES` 既有「型號：尚無資訊」未完成列會在同步時排除，不注入正式 prompt/index；Product Finder 會把對應型號轉進待審核清單，不直接刪除商用 Sheet 資料。

- Fast Mode 只能使用 QA 與 CLASS_RULES，不可用 LLM 自身知識補規格、步驟、價格、據點或官方資訊。
- QA/規格庫能明確回答的一般規格/能力題，應直接回答並標註真實來源，不可只因題目出現「是否/支援/內建/規格」就無條件查 PDF。
- 操作/故障/明確手冊查證題若 QA／RULE／已核對片段不足，就升級 `[AUTO_SEARCH_PDF]` 並接續 manual SourceOperation，不得停在詢問 CTA。
- 操作/故障題若沒有任何型號訊號且未命中可信 QA，不可用 LLM 泛用常識回答步驟；先從 `PDF_MODEL_INDEX` 列可用候選，完全無候選才請使用者提供背貼完整型號。
- 操作/故障/明確手冊查證題若有對應 PDF，Fast Mode 必須命中可信來源（QA 或規格庫）且答案足夠，才可停在 Fast Mode；沒有可信來源時不可把 AI 自行編出的步驟當作已解答。
- PDF 手冊仍未明載或 pipeline error 時，自動執行一次系統 Web rescue；仍不足才顯示「再查網路／到這款官網」，不得猜測、洩漏錯誤細節或回到手冊重試。
- 已進入手冊/PDF 查證時，回覆不得說「根據你提供的 PDF/手冊/文件」；客服視角一律改成「根據官方手冊」。
- 多型號/短別稱且需要精準規格或手冊查證時，先顯示型號選擇泡泡，再依所選型號查證。
- 比較/推薦題可以直接多型號回答；但若同時涉及操作、設定、故障或手冊查證，不可因「比較」二字跳過型號選擇。
- 型號選擇泡泡顯示前必須做顯示層正規化：`LS...XZW` 等區域完整料號要收斂為使用者熟悉的 `S...` 型號，且不得同時顯示互為同款的 `S...` 與 `LS...`。
- 型號選擇泡泡的前導文字必須是固定流程提示與朋友式語氣；純流程提示不硬湊來源，不可沿用 AI 尚未查證的回答當前導文字。
- 任何最終回答的來源標註必須與實際路由一致；API 配額/暫時失敗訊息不可標成 PDF 或 QA 來源。
- 內部稽核只允許 `[來源:QA庫]`、`[來源:官方規格庫]`、`[來源:官方活動庫]`、`[來源:官方手冊]`、`[來源:網路搜尋]`；LINE 客戶版只顯示自然來源頁尾，不得顯示內部標籤或 AI 內建資料庫名稱。
- API 配額/暫時失敗訊息必須是客服友善語氣，不可出現「升級付費方案」、供應商錯誤細節或「您的請求」這類不符合朋友式口吻的文字。
- 「查手冊」按鈕只在系統已確認目前型號有官方 PDF 手冊時顯示；模糊型號應直接列 `PDF_MODEL_INDEX` 候選，完全無候選才請使用者補背貼完整型號，不可先給可能落空的手冊按鈕。
- 純家電題屬範圍外，不呼叫 LLM、PDF 或網搜。
- 範圍外題（競品品牌清單、非三星市場報價/Excel 表格）要在價格防呆與 LLM 之前先攔截，避免誤導到三星官網或浪費 API。
- 價格題一律不得回覆數字金額；導向三星官方搜尋頁時必須保留使用者輸入的完整型號 token，不可把 `S34BG850SC` 截短成 `S34BG850`。
- 近期活動、上市資訊、CES、抽獎、延長保固等時效題，若完整型號命中已建檔的本地活動 RULE，可先由 Fast Mode 使用 CLASS_RULES 回答；未建檔或不完整型號則先導官方頁或網路搜尋。
- 當回覆正在要求使用者「選完整型號 / 補完整型號」時，不可同時追加「如果資訊不夠我可以查手冊」尾巴或查手冊按鈕，避免流程自相矛盾。
- `G5`、`M8`、`S9` 等短別稱不可直接拿來查 PDF；若題目需要手冊或精準型號，必須先從現有 PDF 覆蓋範圍列出完整型號讓使用者選。
- `/紀錄 <內容>` 必須支援 QA 與 RULE 自動分流；RULE 要寫入 `CLASS_RULES` A 欄單列字串，不可展開多欄。
- `/紀錄` 內容是 Samsung 活動網址時，必須先抓官方頁內容產生 RULE 草稿；即使 Gemini 429，也不可退化成只把網址存進 `CLASS_RULES`。
- 正式 Gemini 模型固定為 Fast／Think／Polish 的 `models/gemini-2.5-flash-lite`，以及整本 PDF／Web 的 `models/gemini-2.5-flash`；不可用會漂移的 `latest` alias，以免品質與成本估算失真。
- Smart Monitor／M 系列的 HEVC、H.265、影片格式、播放檔案支援題，不可先做固定手冊摘要或直接定論支援；必須先提供現有手冊庫內的 Smart Monitor 型號選擇泡泡，點選型號後才掛載該型號官方 PDF 由 LLM 回答。
- 只要本輪牽涉 LLM 呼叫，內部 LOG／所有紀錄必須保留真實 token 與費用；客戶版只顯示合計費用估值，不顯示 token。
- `#再詳細說明` 對同一主張必須重用上一輪 AnswerEnvelope／Evidence，不得重新掛 PDF、再次扣次或要求新的 `#查手冊`；只有新的未解主張才建立新 SourceOperation。
- `/重啟` 只可清除該使用者的對話與快取，絕不可清空、覆寫或還原全域 `CLASS_RULES`；`/紀錄` 建立的 QA/RULE 是 append-only 知識庫。
- TestUI、LOG、RULE、PDF 索引、同步與維運端點均為管理功能。正式 `/exec?test=1` 與維運端點必須以 `MAINTENANCE_SECRET` 或既有 `OPENCODE_WRITE_SECRET` 授權；編輯者專用 `/dev?test=1` 由 Google 帳號的專案編輯權守門，程式另以執行網址必須為 `/dev` 才簽發短效 token。絕不可拿 Gemini API 金鑰當維運密碼。
- 範圍判斷看問題主體：手機、平板、電腦、遊戲機等裝置連接三星螢幕，仍是螢幕問題，依本機庫 → 官方手冊 → 必要時 Web 回答；只有純裝置問題才屬範圍外。只有 429／5xx 可退避重試一次；客戶只看簡潔費用，模型、token 與呼叫明細留在內部 LOG。
- 跨裝置連接題若手冊只能確認螢幕端條件，必須保留手冊查到的內容並自動做一次系統 Web rescue；仍不足時可顯示「再查網路」查裝置端。完成 PDF 後要留下快取與來源證據，後續 Web 不得重跑 PDF。
- 官方手冊回答不得混入手冊未記載的手機設定、轉接器、上市狀態、換線測試等裝置端建議；若 LLM 越界、無證據或 pipeline error，不做第二次 PDF 付費重答，保留來源邊界後進一次系統 Web rescue。
- 跨裝置 PDF 階段不得注入外部裝置相容性 QA；Samsung 官方手冊只負責螢幕端能力。Apple 等外部裝置的官方規格只有已收錄 QA／RULE 才可作正式結論，網搜只補明確標示的非官方實務經驗。
- PDF 的「系統忙碌」與 API 暫時失敗先進一次受控 Web rescue；全部路徑都無法執行時才是終止狀態，且不得顯示無意義的「再詳細說明」。
- `isRetry` 只保留為舊呼叫介面相容參數，不可據此重入來源；PDF、系統 Web rescue 與使用者 Web 都只能由明確 SourceOperation 建立。
- 跨裝置手冊回答固定採「一句結論＋最多 3 個螢幕端條件」；若混入無來源裝置端建議，移除越界內容並進一次系統 Web rescue，不可改塞題型固定答案。
- Google Search 只有同時取得非 Samsung 官網的 `groundingChunks` 與對應 `groundingSupports` 才算有可稽核網頁證據；缺任一者立即停止，不得為補引用自動再生成，也不可標 `[來源:網路搜尋]`。
- 跨裝置連接題即使只提供 `M7`、`M8` 等短別稱，也必須先做精準 QA 比對，再進含 QA/CLASS_RULES 的 Fast Mode；只有本機庫不足時才顯示完整型號選擇並升級官方手冊。模型自稱 QA 來源不算命中，必須通過程式端產品實體、連接方式與意圖精準比對。
- 網搜不得啟用 Samsung 官網 URL Context、不得直接擷取 Samsung 官網，也不得把 Samsung grounding chunk 當成功證據；canonical query 必須排除 `samsung.com`。官網只由回答後的 `到這款官網` URI 交給使用者自行開啟。
- 跨裝置題完成官方手冊後再網搜時，必須把最近手冊回答當作螢幕端事實錨點；網搜只補非官方公開網頁的實務資料，不得改寫手冊中的介面、線材條件、供電瓦數或限制。整合回答分別標示官方手冊與非官方網頁。
- PDF 手冊未記載外部裝置端能力時，不得斷言手機一定可連接、顯示、輸出或充電；這類肯定句與無來源設定建議不得觸發同一本 PDF 的自動重答，改由下一輪明確網搜補充非官方實務經驗。
- 網搜只能回答非官方 grounding 證據直接支援的內容；所有外部做法都要標示「非官方，請斟酌參考」，不得以「可能／通常／常見／依賴」延伸出無證據的設定、鏡像選項、系統功能或相容性推測。
- 手冊後的網搜整合回答不得再叫使用者自行參考手冊或官網；既然系統已完成手冊查證，就應直接保留已查出的操作條件並移除推諉句。可見文案一律稱「官方手冊」。

## ✅ 現行鐵律 SOP（v29.6.252）

1. **先本機庫**：讀取 Google Sheet 的 QA、CLASS_RULES、官方活動 RULE 與 `Prompt!C3` 指令；`/紀錄` 會讓本機庫持續長大。只有產生規格／FAQ 實質回答才計入一般 20 題；若只引導查手冊則退回本次額度。
2. **再官方手冊**：QA／RULE／已核對片段不足時，自動建立一次性 manual SourceOperation；「查官方手冊」按鍵則是使用者主動指定同一路徑。缺完整型號不等於要求手打完整字串：先以系列／前段列出實際 PDF 索引候選，選完直接查；PDF 生成階段只讀手冊；單次最壞 NT$0.35，超限依既有頁面收斂／成本守門處理。已鎖定型號跨日沿用，直到新完整型號、換型號或管理員 `/重啟`。
3. **再網路搜尋**：價格/通路/活動/據點/最新資訊才由網路鍵直接查。使用者已確認 PDF 且 PDF 無證據時，系統自動補搜一次非官方 Web，不扣使用者網搜額度；結果必須標 `[來源:網路搜尋]`。
4. **無證據仍要收斂**：QA、RULE、PDF 與一次性 Web 補救都無證據時，提供清楚標示「未經三星官方證實」的保守操作方向與該款官網連結；不得編造具體產品能力、價格或服務資訊，也不得叫使用者反覆重搜。
5. **Prompt 真實來源**：正式 Prompt 在 Google Sheet `Prompt!C3`；本地 `Prompt.csv` 只是鏡像與貼回來源。修改 Prompt 後必須同步 `Prompt!C3`，否則 LINE Bot 不會讀到。
6. **部署真實入口**：每次程式修改後必須用既有 Deployment ID 更新部署，不可只 `clasp push`，也不可新建部署取代正式 Webhook。
7. **手冊按鈕防呆**：Quick Reply 的「📖 查手冊」只可在 `hasPdfForModel=true` 且本回合尚未查過 PDF 時顯示；操作題本身不能當成顯示手冊按鈕的理由。
8. **家電題防呆**：洗衣機、乾衣機、冰箱、吸塵器等三星家電題不得被誤導成螢幕型號補問；WA/WD/VR 等家電型號要可被辨識為型號訊號。
9. **範圍防呆優先**：若問題明顯是非三星/競品-only/競品即時報價表格，先回覆專案範圍，不進價格防呆、PDF 或 LLM。
10. **模型成本防呆**：Fast／Think／Polish 固定使用 `models/gemini-2.5-flash-lite`；整本 PDF fallback 與 Web grounding 使用 `models/gemini-2.5-flash`。兩者都必須固定穩定版，不得使用 `latest` alias，本版不得新增第二次潤飾或較貴模型。
10. **活動 RULE 例外**：近期促銷、活動、抽獎、延長保固等問題，若完整型號命中已建檔的本地活動 RULE，可先進 Fast Mode 使用 CLASS_RULES；別稱或未建檔活動仍導官方頁/網路搜尋。
11. **價格防呆優先**：價格、最低價、建議售價、通路價等問題在 LLM 前先攔截，不回覆數字金額，只導三星官方頁；型號搜尋目標必須保留完整尾碼。
12. **型號選擇回覆要乾淨**：任何要求使用者先選型號或補型號的回覆，不得追加查手冊提醒；等使用者選定型號後，再依 QA/規格 → PDF → WEB 流程處理。
13. **型號泡泡前導不可用 AI 中間稿**：顯示型號選擇時，前導文字必須是固定流程提示與朋友式語氣；純流程提示不標來源，不可把 Fast Mode 的未驗證回答一起送給使用者。
14. **型號顯示不可重複**：型號泡泡與文字候選一律使用 `normalizeModelForDisplay()` / `dedupDisplayModels()` 的顯示結果；`S49...` 與 `LS49...XZW` 這類同款料號不得同時列為兩個選項。
15. **比較題不得越過操作型號選擇**：比較/推薦/差異題若同時含操作、設定、故障、步驟或手冊查證意圖，仍必須保留型號選擇，不可直接清空候選型號。
16. **無型號操作題不可泛猜**：操作／故障題沒有型號時，只有可信 QA 可直接回答；否則先從正式 `PDF_MODEL_INDEX` 依系列／前段列候選，完全找不到才請使用者提供背貼完整型號。選型前不讀 PDF、不扣手冊次數。
17. **有型號操作題只交付有證據答案**：先命中 QA、RULE 或已核對手冊片段；缺可核對來源的 Fast 步驟不得當成完成答案，即使文字看似流暢也要自動進 manual SourceOperation。前一層已有可信完整答案則停止，不得多查 PDF。
18. **流程提示不硬湊來源**：選型、取消、範圍外與額度用完屬流程提示，不標來源；不得對客戶解釋 QA/RULE 命中、未呼叫 LLM、供應商、路由或退款。費用與技術細節依客戶版／LOG 契約分流。
19. **Fast Mode 來源精確白名單**：LLM 輸出的舊標籤會正規化成 `[來源:QA庫]`、`[來源:官方規格庫]` 或 `[來源:官方活動庫]`；模糊來源如 `[來源:QA資料庫]`、`[來源:產品規格表]` 一律丟棄，避免把未命中的內容洗成可信來源。
20. **手冊查證口吻**：手冊模式輸出一律以「官方手冊」稱呼來源，不得說「你提供的 PDF/手冊/文件」，避免客服身分錯位。
21. **API 失敗不外洩內部語句**：PDF 配額、逾時或供應商暫時失敗時，不得把錯誤碼、模型或供應商細節丟給客戶，也不得假標手冊來源；先做一次受控 Web rescue，仍不足才給簡短後續選項。只有全部受控路徑都無法執行時，才用朋友式語氣請稍後再試。
22. **版本上限處理**：若 Apps Script 達 200 版本上限，先到 Project History 批次刪除未被 active deployment 使用的舊版本，再重跑 `deploy.bat`；不可因此新建正式 deployment ID。可先執行 `tools/check_deploy_readiness.ps1` 確認正式 Webhook 版本、版本數與阻塞原因。
23. **長文轉 QA 草稿要先正規化**：長文去廣告摘要若判定可加入 QA，進入 QA 編輯模式前必須先整理成單行 `問題 / A：答案`；不得把「重點摘要／去廣告原文／操作說明」整包塞入草稿，也不得為已是問句的內容再硬補「嗎」。
24. **QA 建檔草稿不得被選項數字污染**：建檔模式只有在明確等待合併選擇時，`1/2/3` 才代表選項；一般草稿模式下單獨輸入 `1/2/3` 應提示目前沒有選項，不得寫入 QA 內容。使用者輸入 `問題？ A：答案` 也必須正規化成 `問題？ / A：答案`，不得出現 `A：A:`。
25. **QA 建檔草稿不得被無關閒聊污染**：一般草稿修改模式下，短句若沒有修改意圖且與目前 QA 草稿沒有關鍵詞重疊，應提示不寫入草稿；避免把「我想吃蘋果」這類閒聊寫進 QA。
26. **不存在完整型號早期攔截**：若使用者輸入看似完整型號（如 Sxx/LSxx/WA/WD/VR/G90XF 類型），但 QA/CLASS_RULES/PDF 型號索引都找不到，必須在 LLM 前先回覆請確認型號；這是流程提示，不標來源，不得進 LLM 猜規格，也不得假標 QA、規格庫或手冊來源。
27. **API 暫時失敗不可被包裝成有效補充**：上一則回答若是系統忙碌/API 失敗，`#再詳細說明` 應停止並提示稍後重試，不得重新生成泛用答案；`#這題再搜網路` 若搜尋失敗，也不得追加「網路搜尋補充資料」這類看似已有資料的標記。
28. **服務/營業時間不可誤判為現在時間**：使用者問「服務時間、客服時間、營業時間、今天有沒有營業」時，不得觸發 RealTime「現在幾點」捷徑；未即時搜尋前只引導官方頁或請使用者按網搜，不標來源；實際網搜後才標 `[來源:網路搜尋]`。
29. **短別稱不可直接查 PDF**：只命中 `G5`、`M8`、`S9` 等系列別稱時，不得鎖第一個 PDF；必須先列出現有 PDF 覆蓋的完整型號並請使用者選。
30. **建檔分流**：`/紀錄 <內容>` 先由系統判斷 QA/RULE。QA 寫 `QA`；促銷、活動、價格、規格規則寫 `CLASS_RULES`，並以背景排程更新知識庫，避免 webhook 超時。
31. **手冊追問先重用證據**：上一則若來自官方手冊，按「再詳細說明」先用同一 AnswerEnvelope／Evidence 白話補充，不能為相同主張重掛 PDF 或重扣次；只有使用者提出新的未解主張，才建立新的來源操作並顯示該輪真實費用。
32. **禁止無來源題型補丁**：不得因某一句測試題用字串比對硬塞「支援／不支援／可能需要」。只有綁定精確手冊 SHA、型號、意圖、頁碼與完整必要限制的已核對 evidence object，或正式逐頁索引核對通過的 canonical block，才可作確定性回答；事故止血片段必須逐步移入通用 artifact，不得無限增加散落分支。
33. **正式資料不可由測試變更**：TestUI 必須使用短效授權 token；測試模式只可預覽，嚴禁寫入 QA、CLASS_RULES 或覆寫既有資料。

---

## 🔄 完整流程圖

```mermaid
graph TD
    User[用戶發送訊息] --> API[1. 訊息入口 (doPost)]
    API --> Handle[2. 訊息分流 (handleMessage)]

    Handle -- 指令/建檔 --> Cmd[指令/建檔模式]
    Handle -- 一般對話 --> DirectCheck[3. 直通車偵測]

    DirectCheck -- 命中 CLASS_RULES --> CacheKey[注入型號至 Cache]
    DirectCheck --> FastMode[4. 極速模式]
    CacheKey --> FastMode

    subgraph Core[核心回答邏輯]
        FastMode -- 載入 QA + RULES --> LLM1[呼叫 LLM (無 PDF)]
        LLM1 --> Decision{證據足夠?}

        Decision -- YES --> Reply[直接回覆]
        Decision -- NO --> SignalCheck{輸出暗號?}

        SignalCheck -- AUTO_SEARCH_PDF --> ModelReady{唯一 PDF 型號?}
        ModelReady -- 否 --> ModelSelect[只列 PDF 索引候選]
        ModelSelect --> PDFMode[5. PDF 模式]
        ModelReady -- 是 --> PDFMode
        SignalCheck -- Web 類時效題 --> WebMode[6. 網路搜尋]

        subgraph PDFFlow[PDF 智慧流程]
            PDFMode --> PDFLoad[載入 PDF (Max 1-2本)]
            PDFLoad --> LLM2[LLM 重試]
            LLM2 --> PDFResult{有可核對證據?}
            PDFResult -- 是 --> Reply
            PDFResult -- 否/錯誤 --> WebMode
        end

        subgraph WebFlow[Web 搜尋流程]
            WebMode --> GoogleSearch[啟用 Google Search]
            GoogleSearch --> LLM3[LLM 重試]
            LLM3 --> Reply
        end
    end
```

---

## 📚 知識來源優先級 (鐵律)

1. 🥇 **最高優先: QA 資料庫 (QA.csv)**
   - 精選問答，高命中率常見問題
2. 🥈 **第二優先: CLASS_RULES (規格庫)**
   - 型號規格 + 術語定義
   - 自動生成 KEYWORD_MAP 供擴充
3. 🥉 **第三優先: PDF 手冊 (三星螢幕使用手冊/)**
   - 詳細操作步驟、OSD 路徑、故障排除
   - 觸發條件: QA／RULE／已核對片段不足且輸出 `[AUTO_SEARCH_PDF]`、使用者明確 `#查手冊`、或型號泡泡選擇後進入 `pdf` 模式；不再先回確認 CTA
   - **智慧過濾**: 若型號不在 `PDF_MODEL_INDEX` 中，會自動跳過此階以節省 Token。
4. 🏆 **最後手段: 網路搜尋 (Google Search)**
   - 完全無解時的備援
   - 觸發條件: `[AUTO_SEARCH_WEB]` 或用戶強制 /擴大搜尋

---

## 📖 實戰流程範例：以 "G5 怎麼設定" 為例

當用戶輸入關鍵字後，系統會自動評估路徑：

### 情境 A：型號無專屬手冊 (例：S27AG500NC)

1. **Pass 1 (規格)**：命中別稱 G5，AI 輸出 `[AUTO_SEARCH_PDF: G5]`。
2. **型號精確化**：系統彈出泡泡，用戶選擇 `S27AG500NC`。
3. **智慧分流 (SOP)**：系統檢查 `PDF_MODEL_INDEX` 發現無專屬手冊。
4. **自動降級**：直接使用 **規格庫** 內容回答基礎資訊，標註 `[來源: 規格庫]`。
5. **備援路徑**：若用戶點擊「不滿意」，則進入 **Pass 2 (Web Search)**。

### 情境 B：型號有專屬手冊 (例：S32DG502)

1. **Pass 1 (規格)**：同上，AI 輸出暗號。
2. **型號精確化**：用戶選擇 `S32DG502`。
3. **PDF 鎖定**：系統發現有專屬手冊，啟動 **Pass 1.5 (PDF Search)**。
4. **精準回答**：載入 PDF 並由 AI 產出詳細設定步驟，標註 `[來源:官方手冊]`。

---

## 🔑 關鍵暗號系統

| 暗號                | 觸發時機              | 系統行為                          |
| ------------------- | --------------------- | --------------------------------- |
| `[AUTO_SEARCH_PDF]` | 操作/故障/明確查證題在 QA/規格不足時需查手冊 | 載入對應 PDF，重新呼叫 LLM        |
| `[AUTO_SEARCH_WEB]` | PDF 也沒答案，需聯網  | 啟用 Google Search 工具，呼叫 LLM |
| `[NEW_TOPIC]`       | AI 判斷換題           | 清除 PDF Mode，重置上下文         |
| `[型號:xxx,yyy]`    | AI 建議多型號         | 自動生成 Quick Reply 選單         |

---

## 🎛️ Quick Reply 按鈕系統 (v29.5.140)

每次 AI 回覆後，LINE 訊息底部附帶 Quick Reply 按鈕。按鈕 text 以 `#` 開頭，由 handleMessage 中的 handler 攔截。

### 按鈕配置（動態，不是固定三顆）

| 按鈕 | text | 顯示條件 | 處理方式 |
|------|------|----------|----------|
| 💬 再詳細說明 | `#再詳細說明` | 該題展開次數 `< 2` | 改寫 msg 後**不 return**，走正常對話流程 |
| 📖 查手冊 | `#查手冊` | 一般回覆：`hasPdfForModel && !alreadyConsultedPdf`；Web 回合：有型號記憶 (`direct_search_models`) | 獨立 handler，從歷史找問題 → PDF → LLM |
| 🌐 這題再搜網路 | `#這題再搜網路` | 一般回覆永遠顯示；Web 回合也保留 | 呼叫 handleCommand 觸發同題 Web Search |

### 指令相容性（避免舊按鈕失效）

- 新指令：`#這題再搜網路`
- 相容舊指令：`#搜尋網路`、`#搜網上其他解答`、`#搜往上其他解答`

### 動態決策矩陣（實際行為）

- QA/規格回覆，且可查手冊：通常 3 顆（再詳細 / 查手冊 / 這題再搜網路）
- 已達「再詳細說明」上限：隱藏「再詳細說明」
- 無可用型號或無手冊：隱藏「查手冊」，並在**對話內容**提示「請提供完整型號」
- Web 回合：不再硬編碼只留 1 顆，會依上述條件動態保留 2~3 顆

### `#再詳細說明` 流程詳解

```
用戶按按鈕 → LINE 發送 "#再詳細說明"
  ↓
handler 改寫 msg = "請針對你剛才的回答再詳細說明..."
handler 改寫 userMessage = 同上
(⚠️ 禁止設 userMsgObj — TDZ 會報錯)
handler 不 return
  ↓
D. 一般對話:
  history = getHistoryFromCacheOrSheet(contextId) ← 5 輪歷史
  const userMsgObj = { role: "user", content: msg } ← 基於改寫後的 msg
  ↓
callLLMWithRetry(userMessage, [...history, userMsgObj], ...)
  AI 看到完整歷史 + 「請再詳細說明」指令 → 自然展開回答
```

**設計原則**: 系統已保留 5 輪對話歷史，AI 本來就看得到上次完整回答，不需要手動從歷史提取截斷。

### `hasPdfForModel` 與手冊按鈕控制邏輯

```
DirectDeep 命中關鍵字
  ↓
從 directSearchResult.models 取得型號列表
  ↓
對照 PDF_MODEL_INDEX (ScriptProperties)
  ↓
有 PDF → hasPdfForModel = true → 顯示「📖 查手冊」按鈕
無 PDF → hasPdfForModel = false → 隱藏按鈕
```

補充（v29.5.139）：

- 在「#這題再搜網路」回合，若同題已保留型號記憶 (`direct_search_models`)，仍保留「📖 查手冊」入口，避免泡泡縮到只剩 1 顆。

---

## 🎯 型號匹配邏輯 (Smart Router v29.5.48)

用戶輸入: "S27AG500NC 怎麼設定"

1. **直通車偵測**: 命中 "G5" (別稱)
   - 系統注入: G5, S27FG532EC, S27DG502EC...

2. **Smart Router 判斷 (v29.5.48 New)**:
   - **單一型號**: 自動鎖定，載入 1 本 PDF。
   - **多型號 (比較/列表題)**:
     - 若用戶問「哪一台...」、「推薦...」 (List Intent) → **跳過泡泡**，讓 AI 直接列出。
     - 若僅是模糊查詢 → 顯示 **型號選擇泡泡**。
   - **數量過多**: 若候選 > 10 個 → 跳過泡泡，避免洗版。

3. **精準匹配**:
   - 找到 `S27AG500NC.pdf`
   - 載入 PDF → LLM 回答設定步驟

---

## 🛡️ 安全防護機制

1. **源頭減量**
   - 非比較題: 強制 1 本 PDF
   - 比較題: 最多 2 本 PDF
2. **重試策略 (callLLMWithRetry)**
   - Retry 1: 移除第 2 本 PDF
   - Retry 2: 移除所有 PDF (終極降級)
   - Retry 3: 放棄，回傳錯誤訊息
3. **Token 熔斷**
   - 預估 > 40K tokens
   - 裁切歷史，保留最新 2 對對話
4. **事件去重**
   - 相同 eventId 60 秒內不重複處理
5. **來源誠實防呆**
   - `appendPdfSourceTag()` 只在有效 PDF 回答後補真實檔名來源。
   - 若 LLM/API 回傳配額限制、暫時失敗、API 錯誤，不得補 `[來源: xxx.pdf]`。
   - Fast Mode 不得臆測來源；未實際引用 QA，不得標 `[來源:QA庫]`。
6. **操作題型號防呆**
   - 操作/故障題若沒有型號且 Fast Mode 遇到 API/配額暫時失敗，不直接把 API 錯誤丟給使用者。
   - 此時改請使用者補完整型號，並說明後續仍會依 `QA/規格庫 → 官方手冊` 的順序查證。

---

## 🚀 部署與 Prompt 同步鐵律

### 程式部署

每次修改 `linebot.gs` 後，正式入口是：

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File tools\deploy_existing_webhook.ps1
```

注意：

- `clasp push` 只會推 HEAD，不會更新正式 LINE Webhook。
- `tools\deploy_existing_webhook.ps1` 會依序推送程式、建立 Apps Script 版本、用 `clasp deploy -i <既有DeploymentId> -V <新版本號>` 更新既有正式 Webhook，最後以 `?health=1` 驗證正式版本。
- 必須使用既有 Deployment ID 更新部署，除非使用者明確要求新建部署；不得為了繞過問題自行建立新部署。
- 健康檢查應回傳最新 `GAS_VERSION` 才算正式 Webhook 生效。
- `deploy.bat` 只是 Windows 雙擊入口，實際呼叫同一支 `tools\deploy_existing_webhook.ps1`，避免部署流程分裂。
- 部署流程**不會**修改 Google Sheet `Prompt!C3`，避免本地鏡像誤覆蓋正式 Prompt。
- 若 Apps Script 版本數已滿 200，部署腳本會在推送 HEAD 前停止並提醒先刪除未使用舊版本；此時不可改用新 deployment ID 逃避，也不可把 HEAD 已更新但正式 webhook 未更新視為完成。

### Prompt 同步

- 正式 Prompt 位於 Google Sheet `Prompt` 工作表的 `C3`。
- `Prompt.csv` 只能視為本地鏡像或人工備份，不是正式執行來源，也不會在部署時自動上傳。
- 修改 Prompt 後，必須由維護者明確更新 Google Sheet `Prompt!C3`，再由受保護維運流程清除 Prompt 快取並以正式 TestUI 驗證；`/重啟` 不負責 Prompt 或知識庫同步。
- Prompt 同步入口屬於維護工具，不屬於一般部署流程；除非明確要改 Prompt，否則不得用本地 `Prompt.csv` 覆蓋 `Prompt!C3`。
- 若必須用本機工具同步 Prompt，必須明確指定來源檔並加上確認旗標，例如：`powershell -NoProfile -ExecutionPolicy Bypass -File tools\sync_prompt_c3.ps1 -PromptPath .\Prompt.csv -ConfirmOverwrite`。

### 測試原則

- TestUI 測試應以實際使用者問題單輪/多輪驗證，而不是只看函式是否通過。
- 修改程式或部署工具後，至少先跑 `cd test_runner && npm run test:static`，確認 API 失敗來源、防 Prompt 覆蓋、TestUI 版本守門與查手冊提醒條件沒有退回舊錯誤。
- 執行線上 TestUI 回歸前，必須先跑 `cd test_runner && npm run check:webhook-version`，確認正式 Webhook `?health=1` 版本與本機 `linebot.gs` 相同。
- 線上 TestUI 回歸應透過 `cd test_runner && npm run test:current`，或用 `node run_current_test.js <verify_script.js>` 執行單支測試；不可直接執行打正式網址的 `verify_*.js` 後就宣稱新版通過。
- 17 題路由題庫可分批定位，例如 `node run_current_test.js verify_route_testset_17_single.js 1,2,3`；分批仍使用原題，不可為了通過測試改使用者問法。
- 若版本不同，不得用 TestUI 結果判定新版邏輯好壞，應先更新既有部署或標記為「正式部署尚未切換」。
- 若外部 Gemini 配額限制，測試應確認錯誤訊息不假標來源；不要把 API 配額當作產品路由失敗。
- 多型號題應驗證型號泡泡或明確選型提示，而不是為了測試方便改使用者問句。

---

## 📊 資料流動示意

```
Google Sheet ──────► Cache ──────► GAS
   │                   │            │
   ├─ QA              │            ├─ buildDynamicContext()
   ├─ CLASS_RULES     │            ├─ getRelevantKBFiles()
   └─ Prompt!C3       │            ├─ callLLMWithRetry()
                       │            └─ replyMessage()
                       │
Google Drive ──────► Gemini File API
   │                               │
   └─ PDF 手冊 ───────────────────┘
```

---

## 🗂️ 型號索引系統 (v29.5.53 新增)

每日 04:00 重建、受保護同步或單檔自癒會維護下列索引；`/重啟` 不參與索引建立：

| 索引名稱            | 來源               | 儲存位置         | 用途                          |
| ------------------- | ------------------ | ---------------- | ----------------------------- |
| `TOTAL_MODEL_COUNT` | CLASS_RULES 規格庫 | ScriptProperties | 統計有規格資料的型號總數      |
| `PDF_MODEL_INDEX`   | Drive PDF 手冊檔名 | ScriptProperties | 記錄 Drive 中有專屬 PDF 手冊的型號清單 |
| `KB_URI_LIST`       | Gemini File API URI | ScriptProperties | 記錄可直接掛載到 LLM 的 PDF URI |

### PDF 手冊檔名規則

- 上傳到 Drive 或放入 `三星螢幕使用手冊/new` 的 PDF，檔名必須依「PDF 第一頁實際顯示的所有型號」命名，不可依 Samsung 原始下載檔名或人工猜測命名。
- 多個型號共用同一本手冊時，檔名以半形逗號 `,` 分隔，格式為 `型號本體,型號本體.pdf`，逗號前後不加空白。
- 檔名只保留型號本體，尾端國家碼、銷售碼或顏色碼英文字尾墜必須移除；例如 `S27FG532EC` 命名為 `S27FG532.pdf`，`S49CG954EC S49FG916EC` 命名為 `S49CG954,S49FG916.pdf`，不可命名成 `S27FG532EC.pdf` 或 `S49CG954EC,S49FG916EC.pdf`。
- 若第一頁沒有可讀型號，或檔案不是標準 PDF 檔頭，不可直接上傳；必須先另外查證來源或重新下載官方 PDF。
- 代理人可用 `clasp run adminSetManualUploadToken` 設定短效 `MANUAL_UPLOAD_TOKEN`，再透過既有 WebApp `upload_manual_pdf` 批次補傳大型 PDF；完成後必須執行 `adminClearManualUploadToken`。後台與 WebApp 上傳都會拒絕不合規檔名、非標準 PDF，並在 Drive 已有同名檔案時跳過。
- 若 GAS 執行身分對 Drive 手冊資料夾只有讀取權、沒有新增檔案權限，`upload_manual_pdf` 會改把 PDF 上傳到 Gemini Files API，並把檔名/URI 寫入 `MANUAL_PDF_KB_LIST`、合併回 `KB_URI_LIST` 與 `PDF_MODEL_INDEX`；之後每日 04:00 或受保護 `?sync=1` 也會合併這批手動補傳 PDF，不會被 Drive 清單洗掉。
- `PDF_MODEL_INDEX` 必須支援 `S32BM80` 這類尾端兩位數的 S 系列型號，不可只吃 `Sxx + 英文 + 三位數`。
- PDF 選檔不得用 `fileName.includes(model)`；必須以檔名中的型號 token 比對，避免 `S32BM80` 誤中 `S32BM801`，也避免 `M8/G5` 這類別稱靠 substring 直接查 PDF。

### 應用場景

1. **避免載入錯誤 PDF**：
   - 若用戶查詢 `S27AG500NC`，但 `PDF_MODEL_INDEX` 中不存在該型號
   - 系統會 Log 警告：`⚠️ 型號 S27AG500NC 無專屬 PDF，將使用 Alias 匹配`
   - 程式可據此決定是否跳過 PDF 載入，或改用其他策略

2. **Smart Router 選項過濾**：
   - 在顯示型號選擇泡泡時，可剔除「無規格」或「無 PDF」的選項
   - 提升用戶體驗，避免選到無法回答的型號

3. **預先規劃搜尋路徑**：
   - 若型號同時存在於規格庫與 PDF 索引 → 優先用規格庫 (省 Token)
   - 若僅存在規格庫 → 跳過 PDF 載入步驟
   - 若僅存在 PDF 索引 → 直接進入 PDF 模式

### 同步防呆（v29.5.245）

- 同步流程若因 Drive/Gemini/API 狀態導致新 PDF 清單為 0，不得覆蓋既有 `KB_URI_LIST` 與 `PDF_MODEL_INDEX`；`/重啟` 完全不讀寫這些索引。
- 強制重建時不先刪除舊 Gemini URI；必須等新清單成功產生後才覆蓋。
- 每次成功取得 PDF 清單時，會同步寫入 `KB_URI_LIST_BACKUP` 與 `PDF_MODEL_INDEX_BACKUP`。
- 若新清單與既有清單都為 0，但備份仍有 PDF，會用備份回復正式索引。
- 若新清單、既有清單與備份都為 0，且專案有設定 Drive PDF 資料夾，程式不會把空索引寫回 ScriptProperties。
- 若正式 PDF URI 清單已經空掉，使用者查特定型號手冊時，系統會先從 Drive 針對該型號找 PDF，單本即時上傳至 Gemini File API 並回填 `KB_URI_LIST` / `PDF_MODEL_INDEX`，不等待整批 75 本手冊重建。
- `PDF_MODEL_INDEX` 的真實語義是「Drive 裡有沒有這個型號的官方手冊」，不得只依賴 Gemini File URI 是否已成功上傳；否則 File API 暫時失敗會誤判成「沒有手冊」。
- 若 Gemini File API 無法產生 URI，且單本 PDF 小於 `INLINE_PDF_FALLBACK_MAX_BYTES`，本回合可改用 Gemini 官方支援的 `inline_data` 掛載；inline PDF 不寫入 ScriptProperties，避免把大型 base64 塞進屬性儲存。

---

## 📜 版本更新紀錄

> 以下保留各版本當時的歷史行為。舊條目若寫到 `/重啟` 會同步、建立或保護 PDF 索引，均已被 v29.6.130 取代；現行 `/重啟` 只清個人對話與 pending，不讀寫任何全域知識庫。

### v29.6.061 (2026-07-07)

- **Fix (Reply Artifact Cleanup)**: `replyMessage()` 送出前會先清理來源標籤前殘留的孤立 `]`，避免 LINE/TestUI 顯示髒字元。
- **Test**: 10 題 5 輪測試每一輪都檢查來源前不可殘留孤立右括號。

### v29.6.060 (2026-07-07)

- **Fix (Smart Codec PDF Support Conclusion)**: Smart Monitor HEVC/H.265 選型後的 PDF 回答若只說「HEVC 有被記載／列出」但未明講支援，系統會在來源補標前補成明確支援結論。
- **Scope**: 只套用在 Smart Monitor codec 題的 `#型號:` PDF 流程，不影響一般手冊查詢。
- **Test**: `verify_smart_codec_guard.js` 與 10 題 5 輪測試改嚴，第三輪不能只靠出現 H.265 字樣通過，必須明確回答支援或未記載。

### v29.6.059 (2026-07-07)

- **Fix (Smart Codec Positive Guard)**: HEVC/H.265 支援與 MKV/MP4/TS 限制判斷會先正規化空白，支援跨換行、分號與列表格式，避免把已確認支援整理成未確認。
- **Fix (Smart Codec Limit List)**: 已明確列出 MKV、MP4、TS 的回答，`#再詳細說明` 會保留為已列出限制，不再退回「若未列出就不要補推」的保守句。
- **Test**: 10 題 5 輪測試新增 T3/T5、T4/T5 對照，若第三輪已確認支援或第四輪已明確列出限制，第五輪必須延續同一結論。

### v29.6.058 (2026-07-07)

- **Fix (Smart Codec Negative Guard)**: `#再詳細說明` 對 HEVC/H.265 支援與檔案類型限制先辨識「沒有／未記載／未列出」否定語，避免把「沒有記載是否支援」整理成支援。
- **Fix (Selected Model Cache)**: `#型號:` 分支會暫存 `last_selected_model`，後續 `#再詳細說明` 優先使用 cache 中的使用者選定型號。
- **Test**: 10 題 5 輪測試要求第 5 輪整理句本身包含所選型號，不可只靠 PDF 檔名通過。

### v29.6.057 (2026-07-07)

- **Fix (Smart Codec Elaboration Model Lock)**: `#再詳細說明` 會從對話歷史中的 `#型號:` 取得使用者實際選定型號，不再從 PDF 檔名第一個型號誤抓成其他機型。
- **Fix (Smart Codec Limit Polarity)**: HEVC 檔案類型限制整理時先判斷「未列出／未明確記載」否定語，不再把上一輪「未列出 MKV/MP4/TS 限制」改寫成「手冊列出 MKV/MP4/TS」。
- **Test**: `verify_10_questions_5_rounds.js` 第五輪加嚴，要求保留所選型號，且不得把上一輪未列出的限制反向改寫成已列出。

### v29.6.056 (2026-07-07)

- **Fix (Reply Source/Cost Guard)**: `replyMessage()` 出訊息前統一套用 `enforceReplyAuditTrail_()`；任何 LINE/TestUI 可見回覆若缺來源或費用，會補上可見審計資訊。
- **Fix (Cost Isolation)**: 每則 `handleMessage()` 新訊息一開始重置 `lastTokenUsage` 與 `lastSearchSources`，避免 GAS 重用執行環境時沿用上一題費用或搜尋來源。
- **Fix (No Reply Bypass)**: 型號選擇 Flex 與舊 `replyFlexMessage()` 改走 `replyMessage()`，避免任何回覆路徑繞過來源/費用守門。
- **Test**: `verify_sop_static_guards.js` 新增來源/費用總守門、每題費用重置、LINE reply endpoint 不可繞過 `replyMessage()` 的靜態檢查。

### v29.6.055 (2026-07-07)

- **Fix (Smart Codec Elaboration)**: `#再詳細說明` 若上一則是 Smart Monitor HEVC/H.265 官方 PDF 查證結果，會延續上一則 PDF 結論整理，不再掉回泛用操作題補型號流程。
- **Test**: `verify_10_questions_5_rounds.js` 第五輪加嚴，要求延續 HEVC/PDF 主題，禁止再次要求完整型號或轉成按鍵操作題。

### v29.6.054 (2026-07-07)

- **Fix (No Speculative Codec Format)**: Smart Monitor HEVC PDF 查證提示禁止「通常／常見／應該」推測，要求只引用手冊列出的檔案類型限制。
- **Test**: `verify_smart_codec_guard.js` 若選型後 PDF 答案出現推測語即失敗。

### v29.6.053 (2026-07-07)

- **Fix (Smart Codec PDF Prompt)**: Smart Monitor HEVC 選型後的 PDF 查詢明確要求查「支援的視訊編解碼器」表格與 HEVC/H.265 注意事項，避免 LLM 掛了正確 PDF 卻回答未記載。
- **Test**: `verify_smart_codec_guard.js` 要求 `#型號:S32FM703` 後必須回答 HEVC 支援結果，不能以未記載通過。

### v29.6.052 (2026-07-07)

- **Fix (Smart Codec Query Lock)**: Smart Monitor HEVC 選型後，送入 PDF 的查詢會改寫成指定型號問題，不再帶「Smart系列」廣義詞，避免候選型號紀錄混入 Odyssey/G90XF。
- **Test**: `verify_smart_codec_guard.js` 檢查 `#型號:S32FM703` 後的 PDF 查詢已鎖定 S32FM703，且 LOG 不得出現 G90XF/S27FG900XC。

### v29.6.051 (2026-07-07)

- **Fix (TestUI Mixed Reply Preview)**: TestUI 回覆擷取支援 `{type:"text", text:"..."}` + Flex 混合訊息，避免正式 LINE 有來源/費用但 TestUI 只顯示 `[Flex Message]`。
- **Test**: 靜態守門確認 `replyMessage()` 測試模式會顯示文字物件內容。

### v29.6.050 (2026-07-07)

- **Fix (No Fixed Manual Answer)**: 移除 Smart Monitor HEVC 固定手冊摘要；首答與 `#查手冊` 只顯示型號選擇，不先定論支援或限制。
- **Fix (Source/Cost)**: Smart Monitor PDF 型號選擇提示補上 `流程提示不標來源` 與 `[費用:NT$0.0000（未呼叫 LLM）]`。
- **Test**: `verify_smart_codec_guard.js` 改為禁止固定 HEVC 答案，並要求選型後 PDF 回答含 Smart Monitor PDF 來源與費用。

### v29.6.049 (2026-07-07)

- **Fix (Smart Codec PDF UX)**: Smart Monitor／M 系列 HEVC 題首答改為手冊共通摘要 + Smart Monitor PDF 型號選擇泡泡，不再只叫使用者提供完整型號。
- **Fix (Manual Route)**: `#查手冊` 遇到 Smart Monitor 編解碼題時，直接顯示可查 PDF 的 Smart Monitor 型號選擇；使用者點型號後才進入該型號 PDF LLM 查證。
- **Test**: `verify_smart_codec_guard.js` 擴充為三回合：原始提問、`#查手冊`、`#型號:S32FM703`，確認選型後真的掛載 Smart Monitor PDF。

### v29.6.048 (2026-07-07)

- **歷史作法（已於 v29.6.068 廢止）**：曾以程式固定回覆 Smart Monitor／M 系列 HEVC、H.265、播放檔案格式題；此作法會略過重新掛載 PDF 與 LLM 解釋，現已禁止。
- **Fix (Manual Route)**: `#查手冊` 遇到 Smart Monitor 編解碼題時，不再進入一般 PDF 選檔器，避免被歷史 S27FG900XC／Odyssey 型號污染。
- **Test**: `verify_sop_static_guards.js` 新增 Smart Monitor codec 靜態守門；`verify_smart_codec_guard.js` 透過正式 TestUI 驗證原始提問與 `#查手冊` 都不再進錯 PDF。

### v29.6.047 (2026-07-07)

- **Fix (PDF Selection)**: PDF 選檔改用檔名型號 token 比對，不再用 substring；`S32BM80` 不會誤載 `S32BM801,S43BM700.pdf`。
- **Guard (Alias Pollution)**: `M8/G5` 等短別稱不再因檔名 substring 被當成精準 PDF 命中。
- **Test**: `verify_sop_static_guards.js` 新增 PDF 檔名 token 比對守門。

### v29.6.046 (2026-07-07)

- **Fix (Manual PDF Fallback)**: `upload_manual_pdf` 在 Drive 寫入失敗時改走 Gemini Files API，並持久寫入 `MANUAL_PDF_KB_LIST`、`KB_URI_LIST`、`PDF_MODEL_INDEX`。
- **Fix (Sync Merge)**: 同步流程會合併手動補傳 PDF，避免重建時因 Drive 資料夾沒有該檔案而把新機手冊索引移除。
- **Fix (PDF Index Regex)**: `extractPdfModelIndexFromKbList()` 支援 `S32BM80` 這類尾端兩位數型號。
- **Test**: `verify_sop_static_guards.js` 新增 PDF 型號索引守門，覆蓋 `S32BM80`、`F22T450/F24T450/F27T450`、`S49FG916`。

### v29.6.043 (2026-07-07)

- **Ops (Execution API)**: `appsscript.json` 啟用 `executionApi.access = MYSELF`，讓代理人可用 `clasp run adminSetManualUploadToken` 設定短效手冊上傳 token。
- **Deploy Gate**: 手冊批次補傳前必須先確認 `clasp run` 能執行後台函式；否則 WebApp 端點會因沒有有效 `MANUAL_UPLOAD_TOKEN` 回 `Unauthorized`。

### v29.6.042 (2026-07-07)

- **Ops (Manual Upload Token)**: 新增 `adminSetManualUploadToken()` 與 `adminClearManualUploadToken()`，用 `clasp run` 設定短效手冊上傳 token，避免用命令列傳大型 PDF base64。
- **Fix (Manual Upload Endpoint)**: `upload_manual_pdf` 支援短效 token、檔名/PDF 檔頭驗證與同名檔案跳過，可用於批次補傳 `new` 資料夾 PDF。

### v29.6.041 (2026-07-07)

- **Fix (Clasp Ignore)**: `.claspignore` 新增 `logs/**`，避免查證暫存 HTML/PDF/JSON 被 `clasp push` 當成 GAS 專案檔推到雲端。
- **Deploy**: 重新推送並更新既有正式 Webhook，清掉前一版誤追蹤的 `logs\samsung_support_LS27F612EACXZW.html`。

### v29.6.040 (2026-07-07)

- **Ops (Manual Upload)**: 新增 `adminUploadManualPdfFromBase64()`，供 `clasp run` 以已授權 Apps Script 身分把本機標準 PDF 上傳到 Drive 手冊資料夾；不新增匿名 WebApp 上傳入口。
- **Guard (Manual Filename)**: 後台上傳會拒絕不合規 PDF 檔名、尾端仍有英文字尾墜的型號，以及非 `%PDF-` 標準檔頭。
- **Goal**: 用於補齊 `三星螢幕使用手冊/new` 中仍未進 Drive 的新機手冊，讓正式 `PDF_MODEL_INDEX` 可重建到新機型。

### v29.5.283 (2026-06-20)

- **Fix (Early Guard Priority)**: 調整早期防呆順序，範圍/時效/價格 guard 優先於不存在完整型號驗證；避免「未知型號價格題」被型號驗證搶先攔截，仍依價格鐵律導向三星官方搜尋且不報數字價格。
- **Test (Guard Priority)**: `verify_unknown_model_static.js` 新增順序檢查，確保 Scope/Timely/Price guard 都在 Unknown Model Guard 之前；`verify_unknown_model_guard.js` 新增正式 TestUI 價格優先案例。
- **Deploy**: 已更新既有正式 Webhook Deployment ID 至 `v29.5.283 @1063`；沒有新建 deployment，也沒有同步或覆蓋 `Prompt!C3`。
- **Prompt**: 未修改 Google Sheet `Prompt!C3`，也未同步或覆蓋本地 `Prompt.csv`；本次屬路由優先序與測試修正。

### v29.5.282 (2026-06-20)

- **Fix (Unknown Full Model Guard)**: 使用者輸入看似完整型號但專案 QA/規格庫/手冊索引找不到時，於 LLM 前先攔截，請使用者確認型號；避免不存在型號浪費 Gemini 呼叫或被模型猜規格。
- **Source (Model Validation)**: 攔截回覆固定標註 `流程提示不標來源`，不假標 QA、規格庫、PDF 或網路搜尋。
- **Test (Unknown Model Guard)**: 新增 `verify_unknown_model_static.js` 與 `verify_unknown_model_guard.js`，同時驗證本機 helper 與正式 TestUI 入口。
- **Deploy**: 已更新既有正式 Webhook Deployment ID 至 `v29.5.282 @1062`；沒有新建 deployment，也沒有同步或覆蓋 `Prompt!C3`。
- **Prompt**: 未修改 Google Sheet `Prompt!C3`，也未同步或覆蓋本地 `Prompt.csv`；本次屬流程防呆與測試修正。

### v29.5.281 (2026-06-20)

- **Fix (Service Hours Guard)**: 服務時間/營業時間/今天有沒有營業等問題先走官方服務資訊引導，不再被 RealTime「幾點」判定誤回目前時間。
- **Test (Service Hours Guard)**: 新增 `verify_service_hours_guard.js`，驗證服務時間問題不會回「現在是...」，且會標註 `流程提示不標來源`。
- **Prompt**: 未修改 Google Sheet `Prompt!C3`；本次是 RealTime 誤判防呆。

### v29.5.280 (2026-06-20)

- **Fix (API Failure Quick Reply Guard)**: 上一則回覆若是 API/配額/系統忙碌失敗，`#再詳細說明` 不再進 LLM 產生泛用補充，改提示尚未成功查到內容。
- **Fix (Web Search Failure Label)**: `#這題再搜網路` 若搜尋本身失敗，不再追加 `(🌐 網路搜尋補充資料)`，避免讓使用者誤以為有成功補資料。
- **Test (Failure Guard)**: `verify_web_qr_persistence.js` 與 `verify_odyssey_flow.js` 增加失敗狀態斷言。
- **Deploy**: 已更新既有正式 Webhook Deployment ID 至 `v29.5.280 @1060`；沒有新建 deployment，也沒有同步或覆蓋 `Prompt!C3`。
- **Prompt**: 未修改 Google Sheet `Prompt!C3`；本次是 API 失敗狀態回覆防呆。

### v29.5.279 (2026-06-20)

- **Fix (QA Draft Relevance Guard)**: QA 草稿修改模式新增通用相關性守門；短句若沒有修改意圖且與草稿無關，不會寫入 QA。
- **Test (QA Draft Guard)**: `verify_qa_draft_format_guard.js` 增加無關句測試，確認「我想吃蘋果」不會變成 `（用戶補充：...）`。
- **Test Hygiene**: `verify_qa_flow.js` 改為只驗證草稿與取消流程，不再把測試 QA 寫入正式 QA 工作表。
- **Deploy**: 已更新既有正式 Webhook Deployment ID 至 `v29.5.279 @1059`；沒有新建 deployment，也沒有同步或覆蓋 `Prompt!C3`。
- **Prompt**: 未修改 Google Sheet `Prompt!C3`；本次是 QA 建檔資料衛生防呆。

### v29.5.278 (2026-06-20)

- **Fix (QA Draft Format Guard)**: QA 建檔支援使用者常見的 `問題？ A：答案` 格式，會正規化為 `問題？ / A：答案`，避免預覽與存檔出現 `A：A:`。
- **Fix (Draft Choice Guard)**: 一般 QA 草稿模式下，單獨輸入 `1/2/3` 不再被當成補充內容；只有等待合併選擇時才視為選項。
- **Test (QA Draft Guard)**: 新增 `verify_qa_draft_format_guard.js`，驗證 QA 草稿格式與純數字防污染。
- **Prompt**: 未修改 Google Sheet `Prompt!C3`；本次是 QA 建檔流程防呆。

### v29.5.277 (2026-06-20)

- **Fix (Article QA Draft Seed)**: 長文去廣告摘要進入 QA 編輯模式前，先萃取成單行 `問題 / A：答案` 草稿，避免把 `【重點摘要】`、`【去廣告原文】` 或操作說明整包帶入 QA；若長文只有提問沒有可驗證答案，答案欄標成「待補」。
- **Fix (QA Polish Guard)**: 已經是單行 QA 格式的草稿會直接正規化，不再額外呼叫潤飾模型；降級格式化也不會把既有問句改成「SmartThings Hub嗎 / A：」這類怪格式。
- **Test (Long Article QA Quality)**: `verify_long_article_qa_mode.js` 新增 QA 草稿品質檢查，確認長文轉 QA 後不外洩摘要區塊，且問句/答案分隔格式正確。
- **Deploy**: 已更新既有正式 Webhook Deployment ID 至 `v29.5.277 @1057`；沒有新建 deployment，也沒有同步或覆蓋 `Prompt!C3`。
- **Prompt**: 未修改 Google Sheet `Prompt!C3`；本次是程式流程與測試修正。

### v29.5.276 (2026-06-20)

- **Fix (Trusted Fast Source For Operations)**: 操作/故障/明確手冊查證題若有對應 PDF，Fast Mode 必須有可信來源（`[來源:QA庫]` 或 `[來源:官方規格庫]`）且答案足夠才可直接回覆；無可信來源的通用步驟會升級官方手冊查證。
- **Test (Operation Escalation Guard)**: `verify_sop_static_guards.js` 新增執行測試，確認無可信來源的操作步驟會升 PDF、可信 QA/規格庫答案可停 Fast Mode、規格/能力題不因有 PDF 自動升級。
- **Ops (Deploy Version Parser)**: `tools/deploy_existing_webhook.ps1` 可正確解析 `clasp version` 的千分位版本號（例如 `1,055`），避免把版本誤判成 `1` 導致既有 deployment 更新失敗。
- **Deploy**: 已更新既有正式 Webhook Deployment ID 至 `v29.5.276 @1055`；沒有新建 deployment，也沒有同步或覆蓋 `Prompt!C3`。

### v29.5.275 (2026-06-20)

- **Fix (Appliance Source Tag)**: 家電操作/維護題需要補完整型號時，也會標註 `流程提示不標來源`，避免家電防呆回覆缺少來源。

### v29.5.274 (2026-06-20)

- **Fix (Model Selection Lead)**: 型號選擇泡泡前導文字改為固定流程提示並標註 `流程提示不標來源`，不再沿用 AI 未查證的 Fast Mode 中間稿。

### v29.5.273 (2026-06-20)

- **Fix (Operation Comparison Routing)**: 比較/推薦題若同時含操作、設定、故障、步驟或手冊查證意圖，仍保留型號選擇，不因比較意圖跳過泡泡。

### v29.5.272 (2026-06-20)

- **Fix (No-Model Operation Signals)**: 無型號操作/故障題若未命中可信 QA，會先要求補完整型號；AI 自行輸出的 `[AUTO_SEARCH_PDF]`、`[AUTO_SEARCH_WEB]` 或 `[NEED_DOC]` 不可越過補型號守門。

### v29.5.271 (2026-06-20)

- **Fix (Manual Reply Tone)**: `sanitizeManualDeflection()` 擴充清理「根據你/您提供的 PDF/手冊/文件/檔案」等變體，統一改成「根據官方手冊」。
- **Test (Manual Tone Guard)**: `verify_sop_static_guards.js` 新增手冊措辭清理函式測試，避免深度模式回覆再次出現使用者提供 PDF 的錯位語氣。

### v29.5.270 (2026-06-20)

- **Fix (Price Target Extraction)**: 價格防呆的型號解析保留完整尾碼，例如 `S34BG850SC` 不再被截短為 `S34BG850`。
- **Test (Price Guard)**: `verify_sop_static_guards.js` 新增本機價格防呆測試，確認價格題會導三星官方搜尋頁、不含數字金額，且保留完整型號 token。

### v29.5.269 (2026-06-20)

- **Fix (Fast Source Whitelist)**: `normalizeSourceTagFromRaw()` 改為精確白名單，只接受 `[來源:QA庫]`、`[來源:官方規格庫]`、`[來源:網路搜尋]`；`[來源:QA資料庫]`、`[來源:產品規格表]` 等模糊標籤不再被正規化為可信來源。
- **Test (Source Whitelist Guard)**: `verify_sop_static_guards.js` 新增來源標籤函式執行測試，確認精確來源仍可用、模糊 QA/規格來源與 Fast Mode 手冊來源會被拒絕。

### v29.5.268 (2026-06-20)

- **Fix (No-Model Operation Guard)**: 操作/故障題若沒有任何型號訊號，且 Fast Mode 沒有可信 QA 來源，系統會先請使用者補完整型號，不再讓 LLM 用泛用常識直接回答步驟。
- **Fix (Source Traceability)**: `buildNeedModelForOperationReply()` 補上 `流程提示不標來源`，讓補型號回覆也有真實來源。
- **Test (Operation Guard)**: `verify_sop_static_guards.js` 新增無型號操作題防呆位置檢查，確認攔截發生在 AI 文字 fallback 型號提取之前。

### v29.5.267 (2026-06-20)

- **Fix (Model Display Dedup)**: `createModelSelectionFlexV3()` 在產生按鈕前也會呼叫 `dedupDisplayModels()`，即使上游傳入 `S49...` 與 `LS49...XZW`，最終型號選擇泡泡仍只顯示使用者熟悉的 `S49...`。
- **Test (Model Display Guard)**: `verify_sop_static_guards.js` 直接執行 `normalizeModelForDisplay()` / `dedupDisplayModels()`，確認 `LS49C950UACXZW` 會收斂為 `S49C950UAC`，且不會與 `S49C950UAC` 重複出現在候選清單。

### v29.5.266 (2026-06-20)

- **Fix (Fast Source Guard)**: Fast Mode 未掛載 PDF 時，若 LLM 自行輸出「[來源:PDF] / [來源:手冊]」類標籤，系統不再正規化成 `[來源:官方手冊]`，避免假手冊來源被洗白。
- **Test (SOP Guard)**: `verify_sop_static_guards.js` 新增 Fast Mode 不可接受 AI 自帶 PDF/手冊來源的檢查。

### v29.5.265 (2026-06-20)

- **Fix (Source Guard)**: `isApiFailureReply()` 納入新的「系統暫時忙碌／這次查詢暫時無法處理」客服友善 API 失敗文案，避免 PDF 模式補上假的官方手冊來源。
- **Fix (Tone Cleanup)**: 型號選擇泡泡、網路搜尋提示與錯誤文案中殘留的「您／為您／幫您」改為「你」語氣。
- **Test (API Source Guard)**: 新增 `verify_api_failure_source_guard.js`，防止 API 失敗文案再次被補成 PDF 來源或回退成內部付費語句。

### v29.5.264 (2026-06-20)

- **Fix (API Fallback UX)**: API 429 與外層 API 例外回覆改為客服友善語氣；不再對 LINE 使用者顯示「升級付費方案」或「您的請求」。
- **Test (API Fallback Guard)**: 17 題路由測試新增內部 API 文案防回退檢查，避免配額保護訊息暴露內部付費/供應商語句。
- **Ops (Deploy Guard)**: `deploy.bat` 改為解析 `clasp version` 產生的新版本號並用 `-V` 更新既有 deployment；若遇 200 版本上限，明確提示刪舊版本後重跑，避免誤新建部署。
- **Ops (Deploy Readiness)**: 新增 `tools/check_deploy_readiness.ps1`，可快速比對本機版本、Apps Script 遠端 HEAD、正式 Webhook 健康檢查、GAS 版本數與 active deployments，並檢查 HEAD 是否仍含舊 API 失敗文案。

### v29.5.263 (2026-06-20)
- **Fix (Reply Consistency)**: 型號選擇/補型號階段不再追加「再幫你查查官方產品手冊」尾巴，也不顯示查手冊按鈕，避免使用者還沒選型號時流程自相矛盾。

### v29.5.262 (2026-06-20)
- **Fix (Timely Web Route)**: 近期活動、最新上市、CES、抽獎、延長保固等時效題改為早期路由至官方頁/網路搜尋引導，不再被型號直通車或 Gemini 配額錯誤覆蓋。
- **Test (Route Baseline)**: 17 題單輪路由測試改為支援 `MODEL_SELECT`、`ASK_MODEL`、`API_GUARDED`，讓測試符合現行 SOP：多型號先選型號、無型號操作題先補型號、配額失敗時只驗證來源誠實性。

### v29.5.261 (2026-06-20)
- **Fix (Scope Guard)**: 新增早期範圍防呆，競品-only、競品 Excel/價格表等問題會先回覆專案回答範圍，不再被價格防呆誤導到三星官網，也不浪費 LLM 調用。

### v29.5.260 (2026-06-20)
- **Fix (Appliance Guard)**: 新增家電型號辨識與家電題 API 暫失敗防呆；洗衣機等家電問題不再被回覆「請提供 S32/S27 螢幕型號」，避免違反「家電可回答」範圍。

### v29.5.259 (2026-06-20)
- **Fix (Quick Reply SOP)**: 「📖 查手冊」Quick Reply 改回只有已知型號有官方 PDF 手冊時才顯示；操作/故障題若尚未確認 PDF，先要求完整型號，避免使用者點擊後才發現無手冊。

### v29.5.258 (2026-06-20)
- **Fix (TestUI Dedupe)**: TestUI 截斷預覽與完整版在尾端標點正規化後完全相同時，優先保留完整版，移除截斷預覽。

### v29.5.257 (2026-06-20)
- **Fix (TestUI Dedupe)**: TestUI 截斷預覽去重改為正規化尾端標點後比對前綴，修正「。...」與「。」未被視為同一回覆的問題。

### v29.5.256 (2026-06-20)
- **Fix (TestUI Dedupe)**: TestUI 回覆收集在最終回傳前再次去除截斷預覽，避免 `/取消` 等指令被誤顯示成兩次回覆。

### v29.5.255 (2026-06-20)
- **Fix (TestUI Cleanup)**: `clearTestSession()` 補清 QA 建檔草稿、pending query、PDF selection、history cache 與 hit alias keys，避免測試回合被前一次草稿狀態污染。

### v29.5.254 (2026-06-20)
- **Fix (QA Edit)**: 長文去廣告摘要進入 QA 編輯模式時，草稿只使用整理後素材，不再把「要不要進入 QA 編輯模式」與操作說明一起寫入草稿。

### v29.5.253 (2026-06-20)
- **Fix (Operation Guard)**: 操作/故障題在沒有型號且 Fast Mode 遇到 API/配額暫時失敗時，改請使用者提供完整型號，不再直接回配額錯誤。
- **Fix (TestUI)**: TestUI 收集回覆時移除同一正式回覆的截斷預覽，避免 `/重啟` 這類長回覆被誤看成回了兩次。

### v29.5.252 (2026-06-20)
- **Fix (Cache Safety)**: inline PDF fallback 的 base64 只存在本回合記憶體，不寫入 Cache/ScriptProperties，避免 Apps Script 因快取值過大而中斷。

### v29.5.251 (2026-06-20)
- **Fix (PDF Fallback)**: Gemini File API 上傳失敗時記錄 HTTP 狀態碼與錯誤摘要。
- **Feat (PDF Inline)**: 單本 PDF 補回若 File API 無 URI 且檔案小於保守上限，當回合改用 `inline_data` 掛載 PDF，降低 File API URI 快取為 0 時的手冊查詢死路。

### v29.5.250 (2026-06-20)
- **UX (Truthful Status)**: `/重啟` 與 `/重設規格庫` 的前導文字依同步結果產生：只有 Gemini URI 快取大於 0 時才說已同步至 Gemini；若只有 Drive 手冊索引，改說 URI 會在查手冊時單本補回。

### v29.5.249 (2026-06-20)
- **Fix (PDF Index Semantics)**: `PDF_MODEL_INDEX` 改由 Drive PDF 手冊檔名建立，即使 Gemini File URI 快取為 0，也能知道哪些型號有官方手冊。
- **Fix (PDF Recovery)**: 若索引顯示有手冊但 `KB_URI_LIST` 沒有可掛載 URI，查手冊時會先從 Drive 單本補回 URI。
- **UX (Restart Status)**: `/重啟` 顯示分拆為 Drive 手冊數與 Gemini URI 快取數，避免把「Drive 有手冊但 URI 快取為 0」誤讀成沒有手冊。

### v29.5.248 (2026-06-20)
- **Fix (Fallback Flow)**: API 暫時失敗後顯示的型號選擇泡泡，選型後改走 PDF 查證模式，不再回到 Fast Mode 重複碰配額錯誤。

### v29.5.247 (2026-06-20)
- **Fix (Fallback UX)**: Fast Mode 因 API 配額/暫時錯誤失敗時，若 Smart Router 已有多個候選型號，不直接把使用者帶到死路錯誤訊息，而是保留型號選擇泡泡，讓使用者能繼續依型號查證。

### v29.5.246 (2026-06-20)
- **Ops (Diagnostics)**: 新增 `?kb=1` 知識庫健康檢查，只回傳 PDF 資料夾是否設定、Drive PDF 數量、`KB_URI_LIST` / 備份 / `PDF_MODEL_INDEX` 數量，不暴露密鑰或資料夾 ID。

### v29.5.245 (2026-06-20)
- **Fix (PDF Recovery)**: 當 `KB_URI_LIST` / `PDF_MODEL_INDEX` 已經是空狀態時，`getRelevantKBFiles()` 會依目前題目的型號從 Drive 找對應 PDF，單本即時上傳 Gemini File API 並回填索引。
- **Fix (Health)**: 更新 `BUILD_TIMESTAMP`，健康檢查可直接辨識本次部署。

### v29.5.244 (2026-06-20)
- **Fix (Token)**: 移除同步時 QA 內容重複注入，降低 Fast Mode token 浪費。
- **Fix (PDF Index)**: 新增 `KB_URI_LIST_BACKUP` / `PDF_MODEL_INDEX_BACKUP`，避免 PDF 同步異常時索引歸零後無法自救。
- **Ops**: 新增受保護的 `update_prompt_c3` 維護入口與 `tools/sync_prompt_c3.ps1`，供明確維護 Prompt 時使用；日常部署不得自動覆蓋 Google Sheet `Prompt!C3`，工具也必須指定來源檔並加上 `-ConfirmOverwrite` 才會執行。
- **Ops**: `deploy.bat` 改為四步驟：推送程式、建立版本、更新既有 Webhook、提示 Prompt 正式來源；不再同步或覆蓋 Prompt!C3。

### v29.5.243 (2026-06-20)
- **Fix (Critical)**: 同步失敗時 PDF 索引歸零保護。
  - 強制重建不再先刪除舊 `KB_URI_LIST`。
  - 新 PDF 清單為 0 且舊清單仍有 PDF 時，保留舊清單與 `PDF_MODEL_INDEX`。
  - 避免 `/重啟` 或 Gemini/Drive 暫時失敗把可用手冊索引覆蓋成 0。

### v29.5.242 (2026-06-20)
- **Fix (Source)**: API 配額/暫時失敗訊息不再補 PDF 來源標籤。
- **Fix (Traceability)**: `#查手冊` 有明確型號時，新增 `forceCurrentOnly=true` 防污染 log。

### v29.5.241 (2026-06-20)
- **Fix (Conversation)**: 短追問（如「那 M8 呢」「How about M8?」）會沿用上一題主題，只更換詢問對象。
- **目的**: 避免追問變成新型號的一般規格介紹。

### v29.5.240 (2026-06-20)
- **Fix (Critical)**: 修正 `callLLMWithRetry()` 中 `geminiContents` 未初始化導致 LLM/PDF 流程崩潰。
- **Fix (Source)**: 部分 PDF 分支改用實際掛載的 PDF 清單補來源，避免來源檔名缺失。

### v29.5.239 (2026-06-20)
- **Fix (Routing)**: 合併 v29.5.179/v29.5.181/v29.5.193 的 PDF 升級守門。
  - 規格/能力題不再因 `capabilityIntent` 無條件升級 PDF。
  - 只有操作/故障或明確手冊查證題，且 Fast Mode 回答不足時，才追加 `[AUTO_SEARCH_PDF]`。
- **Prompt**: `Prompt.csv` 更新為 `Prompt v29.5.239`，並同步至 Google Sheet `Prompt!C3`。

### v29.5.146 (2026-03-06)
- **Fix (Critical)**: 修復 `google_search` 外掛在 Web Search 回合時只輸出引言而無實質內容的問題，已加強 Prompt 強制模型回覆完整步驟。
- **Fix (UI)**: 放寬 `#查手冊` 氣泡的出現條件，當判定用戶意圖為「設定/故障/操作」時，即使初期型號識別為無 PDF，也強制出現手冊選項交由後續程序模糊搜尋。
- **Optimize (Log)**: 大幅移除了 `[Grounding] 來源數量` 及 `[Ctx Info]` 等重複且佔畫面的除錯資訊，保持 Log 清爽，同時保留計價與對話核心資訊。

### v29.5.145 (2026-03-03)
- **Fix (Critical)**: 修復 `PDF_MODEL_INDEX` 未提取 WA/WD/VR 型號的 Bug；修正 DirectDeep 的 `direct_search_models` Cache 清除邏輯以解決 3D 查詢 Cache 污染；放寬型號選單泡泡觸發條件，支援多型號家電查詢；擴充 `MODEL_REGEX` 以支援 4 碼數字 (如 S27FG900)。

### v29.5.141 (2026-03-02)

- **Fix (Critical)**: 同步全域 `MODEL_REGEX`，確保 `DirectDeep` 與相關邏輯能正確提取 `WA/WD/VR` 等家電型號，解決洗衣機提問無法觸發型號選擇泡泡的問題。
### v29.5.140 (2026-03-02)

- **Fix (Logic)**: 修復 `[型號:xxx]` 標籤在非暗號對話中外洩的問題（清理邏輯移出 Trigger 判斷）。
- **Feat (Prompt)**: 強制所有長度回答皆須標註來源。
- **Feat (Prompt)**: 系列導航增加明確反問引導語。
- **Feat (Prompt)**: 當 PDF 查無精確規格（如耗電量）時，強制轉入 `[AUTO_SEARCH_WEB]`。


### v29.5.139 (2026-02-12)

- **Fix (UX)**: Web 回合不再硬編碼只剩 1 顆泡泡，改為依條件動態顯示 2~3 顆。
- **Feat (UX)**: 「🌐 搜尋這題的網路解答」文案調整為「🌐 這題再搜網路」。
- **Compat**: 新增 `#這題再搜網路`，並保留舊指令 `#搜尋網路` / `#搜網上其他解答` / `#搜往上其他解答`。
- **Obs**: 新增 Web 回合泡泡數日誌：`[Quick Reply v29.5.139] 這題再搜網路回合泡泡數: N`。

### v29.5.129 (2026-02-09)

- **Fix (Critical)**: 修復 `#再詳細說明` handler 中 `userMsgObj = {...}` 在 `const userMsgObj` 宣告前賦值，V8 TDZ 導致 `ReferenceError`。移除多餘賦值行，只改寫 `msg` 和 `userMessage`。

### v29.5.127 (2026-02-09)

- **Feat (UX)**: `#繼續問` 更名為 `#再詳細說明`，語意更精確。
- **Feat (UX)**: `#查手冊` 按鈕加入 30 秒等待提示。
- **Fix (Logic)**: 修復 Web 搜尋回應中 `[來源: 網路搜尋]` 重複出現（LLM 加一次 + 程式加一次）。

### v29.5.126 (2026-02-09)

- **Fix (Critical)**: 修復不存在型號（如 S32FD812）被 AI 幻覺回答。在 Prompt.csv 新增【型號驗證】規則。

### v29.5.123 (2026-02-07)

- **Feat (UX)**: 「📖 查PDF手冊」按鈕改為條件顯示，只在 `hasPdfForModel = true` 時出現。DirectDeep 階段預載 PDF_MODEL_INDEX。

### v29.5.53 (2026-01-19 13:25)

- **Feat (Index)**: 新增「PDF 型號索引 (`PDF_MODEL_INDEX`)」機制。
  - 在 `/重啟` 時從所有 PDF 檔名中提取型號，建立索引。
  - 在 `getRelevantKBFiles` 中查詢索引，若型號無專屬 PDF 則 Log 警告。
  - 重啟訊息新增 `PDF索引: N` 顯示提取到的型號數量。

### v29.5.52 (2026-01-19 13:15)

- **Feat (UX)**: 優化 Quick Reply (擴大搜尋) 引導按鈕。
  - **情境感知**:
    - **Fast Mode (規格)**: 按鈕文字「不滿意 (查手冊)」，預告需虛耗 30 秒。
    - **PDF Mode**: 按鈕文字「不滿意 (搜網路)」，引導至外部搜尋。
    - **Web Mode**: 按鈕文字「不滿意 (繼續搜)」，嘗試更多網路來源。

### v29.5.51 (2026-01-19 13:10)

- **Fix (Logic)**: PDF 載入邏輯重大修正。
  - **Revert**: 撤銷 v29.5.49 的別名阻擋邏輯，確保 `G5` 別名能被擴展，避免因 PDF 檔名僅含別名而找不到檔案。
  - **New**: 新增「智慧權重排序 (Smart Prioritization)」，在 Tier 1 內若同時找到多個 PDF，優先選用包含「完整型號 (S27AG500NC)」的檔案，其次為「S開頭型號」，最後才選「別名 (G5)」。
- **Fix (UX)**: 修正 Web 搜尋失敗導致的回應空白問題（透過確保 PDF 載入成功來根治）。

### v29.5.50 (2026-01-19 13:05)

- **Feat (UX)**: 新增「動態泡泡 (Dynamic Bubble)」功能。
  - 根據用戶問句意圖（規格/手冊/價格），自動調整 Smart Router 泡泡的標題與說明文字。
  - 例如問「價格」，泡泡會顯示「查詢價格/通路」；問「設定」，顯示「查閱產品手冊」。

### v29.5.49 (2026-01-19 12:55)

- **Fix (Critical)**: 修復 `getRelevantKBFiles` 中 `primaryModel` 變數在初始化前被呼叫導致的 `ReferenceError` 崩潰問題。
- **Fix (UX)**: 修正型號選擇泡泡按鈕回傳值。由原本的「[型號] 怎麼設定」改為僅回傳「[型號]」，讓 AI 能正確銜接上下文回答用戶的原問題（如「寬度」），而非強制回答設定步驟。
- **Fix (Logic)**: 優化別名擴展邏輯。當用戶已指定明確型號（如 S27AG500NC）時，不再擴展寬泛別名（如 G5），避免載入錯誤的 PDF。

### v29.5.48 (2026-01-19 11:45)

- **Fix (UX)**: 針對通用問題（如「哪一台...」、「推薦...」或候選數 > 10），跳過 Smart Router 泡泡，讓 AI 直接列出清單。

### v29.5.160 (2026-03-17)
- 手冊模式修復：`#查手冊` 改為僅用當前問題 (`forceCurrentOnly=true` + `[userMsgObj]`) 避免型號污染。
- 來源標註修復：改為標示「實際掛載 PDF 檔名」，避免出現不存在的手冊名稱。
- SmartThings/Matter 題新增手冊查證防呆；手冊模式移除「自行查手冊/官網」甩鍋語句。
- Prompt 規則同步升級至 `Prompt v29.5.160`。

### v29.5.161 (2026-03-17)
- 修復追問型號記憶條件：isModelMismatch 只在命中別稱(hitAliasKeys.length > 0)時才保留既有型號，避免非別稱追問誤沿用舊型號。

### v29.5.162 (2026-03-17)
- 修復 SmartThings/Matter 題路由：觸發手冊查證時不再先回答 Fast Mode 再跳型號泡泡，改為先鎖定單一型號直送手冊流程。
- 新增來源防呆：移除 AI 自帶來源標籤，避免誤標 [來源:QA資料庫]。
- 新增手冊格式防呆：手冊回覆將條列符號統一轉為數字項次並保留空行。

### v29.5.163 (2026-03-17)
- 清理手冊路徑的 [型號:...] 內部標籤外洩。
- Prompt 升級為 v29.5.163，新增「來源與路由防呆」規則。

### v29.5.164 (2026-03-17)
- 手冊模式防呆擴充：過濾「建議聯絡客服/客服專線」等甩鍋語句。

### v29.5.165 (2026-03-17)
- 手冊模式防呆擴充：補強「詢問/聯絡/聯繫/直接詢問」等客服導流語句過濾。

### v29.5.166 (2026-03-17)
- 手冊模式防呆擴充：補強「官方網站/支援頁面」導流語句過濾，降低「請上官網查」回覆機率。

### v29.5.171 (2026-03-18)
- SmartThings/Matter/Hub 題型在手冊路徑新增統一收斂：
  - 強制朋友語氣（「你」）
  - 列表格式統一為 `1. 2. 3.` 並保留空行
  - 過長/破碎回覆改為三點結論
- 新增手冊來源保底 `ensurePdfSourceTag()`：
  - 即使中途被清理或重寫，最終仍會補上真實 PDF 檔名來源標籤
- Auto Deep / `#查手冊` 路徑補上 `pdf_consulted` 旗標：
  - 避免已經查完手冊還追加「再幫你查手冊」提示
- 新增雲端查證函式 `verifySmartThingsClaimFromCloudPdf()`：
  - 直接讀取 Drive 雲端 PDF 並回傳查證結果（頁碼、摘錄、檔案 ID）
  - 用於驗證「頁面 91-93 SmartThings 敘述」是否屬實

### v29.5.173 (2026-03-18)
- 修復短別稱功能題誤答（例如 `S9有內建KVM嗎`）：
  - 若為 `S9/G8/M7` 這類短別稱且屬功能二元題，系統不再直接下肯定規格結論。
  - 改為要求使用者提供完整型號後再精準回答。
- 修復 Fast Mode 來源遺失：
  - 保留並正規化 LLM 原始來源標籤，清理後補回（例如 `[來源:官方規格庫]`）。
- 目的：避免「別稱跨型號污染」與「最終回覆無來源」兩個同時發生的問題。

### v29.5.174 (2026-03-18)
- SOP 強化：短別稱歧義題（如 `S9/G8/M7 + 功能問題`）不只要求補型號，會直接列出候選完整型號供選擇。
- 新增 `getAliasCandidatesFromClassRules()`：
  - 從 `CLASS_RULES` 解析該別稱可能對應的完整型號，回覆使用數字條列。
- 實際效果：
  - `s9有內建kvm嗎` 會回「系列別稱」提示 + 候選型號清單，不再直接回「有」。
  - 回覆仍保留來源標籤 `[來源:官方規格庫]`。

### v29.5.175 (2026-03-18)
- SOP 修正：短別稱功能題改為「型號泡泡優先」而非純文字條列。
  - 例如 `s9有內建kvm嗎` 會進入型號選擇泡泡流程。
- 型號顯示正規化：
  - 新增 `normalizeModelForDisplay()`、`dedupDisplayModels()`，優先顯示 `S...` 完整型號，避免 `S49...`/`LS49...` 重複露出。
- `#型號:` 流程新增模式分流（`model_select_mode`）：
  - `fast`：選型後回一般 SOP（QA/RULE -> PDF -> WEB），不強制進 PDF。
  - `pdf`：維持既有 Pass 1.5 手冊流程。
- Smart Router 新增短別稱功能題強制選型：
  - 若命中短別稱且為功能二元題，強制觸發泡泡，不再直接輸出肯定規格結論。
- 防呆調整：
  - `applyAliasFeatureAmbiguityGuard()` 改為簡短提醒，避免回覆內容長得像「請輸入數字選項」造成誤操作。

#### 部署注意（2026-03-18）
- `clasp push -f` 可成功上傳到 HEAD。
- 但專案 GAS 版本數已達上限 200，`clasp version` 無法再建立新版本。
- 既有正式 deployment 目前為唯讀（`Read-only deployments may not be modified.`），因此無法直接把 `v29.5.175` 指到正式 Webhook。

### v29.5.176 (2026-03-18)
- 修復 `#型號:` 後的短別稱回圈問題：
  - 在 `fast` 分流下，會先移除原始問題中的短別稱（如 `S9`）再回一般流程，避免再次觸發別稱防呆。
  - 新增一次性旗標 `skipAliasFeatureGuard`，選型後當輪跳過短別稱防呆二次攔截。
- 實際效果：
  - `s9有內建kvm嗎` 先進型號泡泡（候選型號以 `S...` 顯示）。
  - `#型號:S27C900PAC` 後直接回覆該型號結論，不再回「請先選擇完整型號」。
- 部署：
  - Version `883`
  - 正式 Webhook Deployment 更新至 `@884`

### v29.5.177 (2026-03-18)
- 修復 SmartThings/Matter 題型「同回合二次呼叫覆蓋首答」：
  - 移除舊版 `v29.5.158` 的同回合強制 `[AUTO_SEARCH_PDF]` 行為。
  - 改為保留 Fast Mode 首答；需要手冊時由 `#查手冊` 顯式觸發。
- 成本與一致性改善：
  - 單題由「可能 2 次 LLM 呼叫」改為「1 次」。
  - 避免首輪答案被第二輪覆蓋，LINE 顯示內容與當輪回覆一致。
- 主流程 Log 去重：
  - `[Final Reply]` 改為摘要模式（字數/泡泡數），降低列數與重複內容。
  - 移除主流程重複 `[AI Reply]` 全文寫入，完整回覆由 `[Reply]` 保留。
- 部署：
  - Version `885`
  - 正式 Webhook Deployment 更新至 `@886`

### v29.5.178 (2026-03-18)
- 架構回歸：移除 SmartThings/Matter 個案硬編碼，改由 Prompt 控制路由與判定。
- 程式側只保留通用流程：
  - 不在同回合程式層強制二次查詢
  - 型號選擇/來源標註/QA→PDF→WEB 維持通用 SOP
- Prompt（`Prompt.csv`）更新：
  - `Prompt v29.5.178`
  - 將 SmartThings 專屬條款改為通用「聯網中樞/協議相容性」規則
- 部署：
  - Version `887`
  - 正式 Webhook Deployment 更新至 `@888`

### v29.5.179 / v29.5.179b (2026-03-18)
- 通用路由落地（無個案硬編碼）：
  - 先跑 QA/RULE
  - 只有在「操作/故障題且 Fast 回答不足」時才自動觸發 PDF
  - PDF 仍不足再交由 WEB
- 新增通用函式：
  - `isOperationOrTroubleshootQuery(text)`
  - `isOperationAnswerInsufficient(text)`
- 修正誤觸發：
  - `v29.5.179b` 移除過寬不確定詞判定（避免有完整步驟時仍錯誤升級 PDF）。
- 部署：
  - Version `889`, `891`
  - 正式 Webhook Deployment 更新至 `@892`

### v29.5.180 (2026-03-18)
- Log 精簡（不改主流程 SOP）：
  - 新增路由噪音壓縮器：`refreshLogFilterConfig_()`、`shouldSkipNoisyRoutingLog_()`
  - 針對 `DirectDeep/KB Select` 中間重複資訊進行減列
  - 保留關鍵可追溯 Log：`[HandleMsg]`、`[AI Stats]`、`[AI Raw Response]`、`[Flow Decision]`、`[Final Reply]`、`[Reply]`、`[DirectDeep 命中]`、`[KB Select 最終命中]`
- 可配置開關：
  - Script Property `LOG_COMPACT_ROUTING`（預設 `true`）
  - 若要恢復完整細節，設為 `false`

### v29.5.181 (2026-03-19)
- SOP 回歸修正（非個案）：
  - 修復 `buildDynamicContext` 的 Spec fallback 斷鏈：SmartRetrieval 改為優先使用 `specRules`（含 Sheet fallback），不再只依賴 Spec Cache chunk。
  - 新增 `CONTEXT_HEALTH_PREFIX`，記錄 `qa/light/spec` 載入健康度。
  - 主流程新增保守升級（歷史行為）：若上下文降級 (`degraded=true`) 且題型是操作/故障或規格能力判定，且有 PDF 可查，則自動追加 `[AUTO_SEARCH_PDF]`。此行為已於 v29.5.239 收斂為「操作/故障或明確手冊查證，且 Fast Mode 回答不足」才升級。
- 文案一致性：
  - 新增 `sanitizeLeadDatabasePhrase()`，避免回覆開頭出現「根據我的資料庫」。
- Prompt 同步：
  - `Prompt v29.5.181`
  - 統一來源標籤格式，移除互相矛盾的來源寫法與「資料庫起手式」要求。

### v29.5.182 (2026-03-19)
- SOP查證題守門（通用，不綁個案）：
  - 新增 `isManualVerificationRequiredQuery()`。
  - 當題目屬聯網協議/中樞能力判定，且 Fast 回答來源僅 QA、且型號有可查 PDF，主流程自動追加 `[AUTO_SEARCH_PDF]` 進手冊查證。
- 目標：
  - 避免 Fast 單點定論，強制回到可驗證的 SOP（QA/RULE → PDF → WEB）。

### v29.5.184 (2026-03-20)
- 長文機制調整為 `ArticleClean`（取代僅「總編模式」語義）：
  - 科技長文貼文會優先執行「去網頁廣告 + 重點摘要 + 去廣告原文」。
  - 不再直接走一般客服 QA 回答。
- 觸發條件：
  - `isLongArticle`（字數或貼文樣態命中）
  - 非 `/`、`#` 指令
  - `isValidTechContent(msg) || hasTechSignals(msg)` 命中科技訊號
- 回覆格式：
  - `【重點摘要】`
  - `【去廣告原文】`
  - 文末標示 `[模式:去廣告摘要] [模式: 去廣告摘要]`

### v29.5.185 (2026-03-20)
- 長文後 QA 題材判定與引導：
  - 系統在 `ArticleClean` 完成後判斷「是否本專案相關」與「是否可作 QA」。
  - 若是，會主動詢問是否進入 QA 編輯模式（加入 QA）。
- 指令與操作提示（會直接顯示給使用者）：
  - 回覆「要」：直接進入 QA 編輯模式
  - `/記錄 <內容>` 或 `/紀錄 <內容>`：手動開啟建檔；系統會自動判斷是 QA 還是 RULE。
  - QA 內容會預覽為 `QA`；活動、促銷、規格規則會預覽為 `CLASS_RULES` A 欄單列。
  - 建檔中可直接回覆文字修稿。
  - `/記錄` 或 `/紀錄`：確認存檔並排程背景更新知識庫。
  - `/取消`：離開建檔
- 流程快取：
  - 使用 `qa_offer_payload` 暫存草稿種子（18 分鐘）
  - 用戶回「要」時自動銜接 `startNewEntryDraft()`。

### v29.5.186 (2026-03-20)
- QA 草稿模式優先於長文模式：
  - 若使用者已在 QA 建檔草稿中，且輸入非 `/` 指令，系統會優先走 `handleDraftModification()`。
  - 不再讓 `ArticleClean` 長文機制攔截草稿修稿內容。
- QA 引導快取防重入：
  - `qa_offer_payload` 啟動「回覆要進 QA 編輯」前，先檢查 `draftCache`。
  - 已在草稿模式時不再重複觸發 QA 進入流程，避免重複建檔或流程打架。
- Prompt 檔清理：
  - `Prompt.csv` 標頭更新為 `Prompt v29.5.186`。
  - 移除長文規則前方誤植的 `\n` 字元，確保貼回 Google Sheet 時內容正常。

### v29.5.187 (2026-03-20)
- 長文流程移除舊總編回退：
  - `ArticleClean` 只使用 `長文去廣告摘要` Prompt。
  - 若該 Prompt 未設定，改用程式內建的去廣告摘要 fallback。
  - 不再回退到 `總編模式`，避免輸出偏離「摘要 + 去廣告原文」。
- 影響：
  - 非本專案科技長文仍維持長文整理輸出。
  - 是否進入 QA 編輯模式改由「本專案相關 + QA 題材」判定控制，不受舊 Prompt 影響。

### v29.5.188 (2026-03-20)
- 長文輸出硬規則補強：
  - 在 `ArticleClean` 發送給模型的 prompt 中，明確加入「即使非三星內容也要輸出摘要+原文」。
  - 禁止只回覆「內容無關」單句。
- 目的：
  - 提升長文清理模式一致性，避免被舊 Prompt 語句覆蓋掉固定輸出格式。

### v29.5.189 (2026-03-20)
- 新增長文格式保底器：
  - `ensureArticleCleanOutputFormat()` 會檢查 AI 回覆是否包含 `【重點摘要】` + `【去廣告原文】`。
  - 若格式缺失，系統改用本地保底流程生成固定結構。
- 新增本地整理輔助：
  - `buildHeuristicCleanArticleText()`：過濾常見廣告/導購行並重組原文。
  - `buildHeuristicSummaryPoints()`：抽取重點句並轉為數字列表。
- 效果：
  - 長文模式輸出格式穩定，不會再退化成單句「內容無關」。

### v29.5.190 (2026-03-20)
- 專案相關判定修正：
  - `isProjectRelevantLongContent()` 改為以三星品牌/系列/型號碼/SmartThings 脈絡判定。
  - 移除「僅靠通用品類詞（如螢幕）」就判定相關的舊規則。
- 影響：
  - 非三星科技長文仍可走長文清理模式，但不會誤觸「進入 QA 編輯模式」邀請。

### v29.5.191 (2026-03-20)
- SOP聯網能力查證題流程修正：
  - 命中 `isManualVerificationRequiredQuery()`（Matter/Thread/Zigbee/Hub/中樞/協議）時，
    不論 Fast 來源是 QA 或規格庫，皆強制升級至 PDF 查證。
- 防止流程被多型號泡泡打斷：
  - 強制升級時鎖定 `primaryModel`，Smart Router 直接沿用該型號進 Pass 1.5。
- 效果：
  - 避免 Fast Mode 直接輸出「不用買 Hub」等未經手冊查證的強結論。

### v29.5.192 (2026-03-20)
- 鐵律回歸：多型號先選型號
  - SOP查證題（Matter/Hub/中樞/協議）若命中多個型號，必須先顯示型號泡泡讓使用者選擇。
  - 不再自動鎖定 `primaryModel` 直接查證。
- 例外覆蓋：
  - 即便同時有列表意圖或數量偏多，此場景仍不得跳過型號泡泡。
- 目的：
  - 嚴格遵守「先確定型號，再做手冊查證」的既有 SOP。

### v29.5.193 (2026-03-20)
- Prompt 與流程鐵律對齊：
  - `Prompt.csv` 更新為 `Prompt v29.5.193`。
  - 將「QA命中禁止 [AUTO_SEARCH_PDF]」改為：
    - 規格/能力/操作題：QA 先答後仍須進手冊查證。
  - 新增鐵律條款：
    - 產品題固定 `QA/規格 → PDF → (不足才)外部資料`
    - 多型號先選型號。
- 程式路由語義調整：
  - 內部 Log/註解以「SOP鐵律查證」描述，避免主觀風險詞誤解。

### v29.5.194 (2026-03-20)
- 新增手冊不確定結論防呆：
  - `enforceManualUncertaintyGuard()` 會攔截「手冊未明確 + 直接定論」的矛盾回覆。
  - 題目命中協議/中樞能力判定時，改為保守敘述並提示可再搜網路補證據。
- 套用路徑：
  - `#型號:` PDF 查證
  - `#查手冊` 查證
  - AutoDeep/Pass 1.5 PDF 回覆

### v29.5.195 (2026-03-20)
- 鐵律語義定稿（移除主觀風險判定用語）：
  - 對外與 Log 文案統一使用「SOP查證題型／鐵律SOP」。
  - 不再以主觀風險詞描述路由判定，避免誤解為系統自行裁量題目重要性。
- 路由鐵律再次明文化：
  - 三星產品題固定 `QA/規格庫 → 官方手冊(PDF) → 仍不足才 WEB/其他資料`。
  - 多型號情境維持先選型號，再進 PDF 查證。
- Prompt 同步：
  - `Prompt.csv` 升級為 `Prompt v29.5.195`。
  - 將聯網中樞/協議題描述改為「SOP查證題」，維持來源與路由一致。

### v29.5.196 (2026-03-20)
- 手冊甩鍋句型防呆補強：
  - `sanitizeManualDeflection()` 新增變形句型過濾（如「建議你：」「如果你想確認」「最直接且準確」）。
  - 避免手冊模式仍把問題丟回使用者自行查官網/規格頁。
- 手冊未明確結論收斂：
  - `enforceManualUncertaintyGuard()` 新增「未明確 + 導向查官網/手冊」改寫分支。
  - 統一改為可執行下一步：引導 `🌐 這題再搜網路`。

### v29.5.197 (2026-03-20)
- 型號泡泡前導文字固定化：
  - 在「SOP手冊查證 + 多型號」場景，型號泡泡前導文字不再沿用 Fast 回答。
  - 固定顯示「這題需要先確認完整型號，我再依官方手冊查證給你。」。
- 目的：
  - 避免使用者先看到未查證結論，再看到型號泡泡造成矛盾感。

### v29.5.198 (2026-03-20)
- TestUI 泡泡回合判讀修正：
  - 命中 Flex 型號泡泡時，`testMessage()` 不再採用 `[AI Reply]` 中間稿作為最終回覆。
  - 改回傳「已送出型號選擇泡泡」提示，並盡可能顯示候選型號預覽。
- 目的：
  - 測試畫面與實際路由一致，避免誤判為「先亂答再追問型號」。

### v29.5.199 (2026-03-20)
- 手冊甩鍋同義句收斂：
  - `sanitizeManualDeflection()` 新增過濾「三星官方 / Samsung 官方」目標詞與「確認 / 求證」動詞。
  - `enforceManualUncertaintyGuard()` 新增「向三星官方確認 / 官方確認」判定，改寫為可執行下一步。
- 目的：
  - 避免手冊模式用同義句把查證責任交回使用者。

### v29.5.200 (2026-03-20)
- 手冊未明確回覆再收斂：
  - `enforceManualUncertaintyGuard()` 新增客服導流語句判定（`客服`、`客服人員`、`諮詢`）。
- 目的：
  - 在手冊未明確時，避免回覆導流到客服，統一改為可執行的「再搜網路」下一步。

### v29.5.201 (2026-03-20)
- 手冊口吻修正：
  - 新增口吻正規化，將「根據你提供的 PDF 文件」統一改為「根據官方手冊」。
  - Deep Mode 指令與 `Prompt.csv` 同步禁止該句型。
- 目的：
  - 維持三星客服語境一致，避免讓使用者誤以為 PDF 是由他提供。

### v29.5.202 (2026-03-24)
- 遙控器/音量操作題路由修正：
  - `isOperationOrTroubleshootQuery()` 改為使用更通用的操作動詞/句型判定。
  - 避免把單一題面的名詞直接硬編碼在程式中。
- AI 範例型號防誤導：
  - 只有在用戶原訊息本來就有型號/別稱訊號時，才允許從 AI 回答內文補抓型號。
  - 避免未指定型號時，因 AI 自舉範例而錯誤產生型號泡泡。

### v29.6.007 (2026-07-01)
- 還原重建清除快取舊清單機制：
  - 還原 `oldKbList = []`。確保 `forceRebuild` 自癒重建時確實清理快取舊 URI，打破 PDF 手冊 URI 過期導致「手冊需要更新，請等一分鐘」的永久死循環。

### v29.6.008 (2026-07-01)
- 修復官網 crawler 新機型比對 LS 前綴限制：
  - 修改 `scanOfficialWebsiteForNewMonitors` 中的防重複比對，移除過硬的 `startsWith("LS")` 限定，改為對齊 `AGENTS.md` 鐵律之 `existingLines.some(line => line.startsWith(model))` 比對，防止 `LC` 和 `LF` 系列機型每日重複寫入髒數據。

### v29.6.018 (2026-07-01)
- 解決平/曲面型號（如 C34G55T）識別正則與手冊加載錯誤系列優化：
  1. **型號識別正則拓寬**：將 `extractModelNumbers` (Pattern 1)、`MODEL_REGEX`、`checkModelRegex` 與 `hasExplicitModelPattern` 正則全系升級為支援 `L?` 前綴及 `C` / `F` 曲面基本系列的 `(?:L?[SCFG])` 等規則，並支援 2-4 位數字的非固定長度匹配（如 C34G55T 匹配 `C34G` + `55` 兩位數字）。
  2. **PDF 型號索引支援**：將 `extractPdfModelIndexFromKbList` 的 PDF 檔名型號提取正則與 `checkModelInPdfIndex` 模糊匹配規則全數拓寬為相容 `LC`/`LF`/`C`/`F` 全系型號。
  3. **提問型號前置與權重排序**：
     * 將原始提問中以正則直接匹配到的精準型號「前置（Prepend）」至 `exactModels` 陣列首位，確保其必為 `primaryModel`。
     * 將 `shortModels` 曲面縮寫支援（如 `C34G55T` 縮寫為 `C34G55`）納入，使 `isTier1` 與 `name.includes` 能匹配到如 `C27G55,C32G55,C34G55.pdf` 逗號分隔的說明書。
     * 排序權重 `getScore` 的 Priority 2 改為**陣列索引遞減計分 (80 - i)**，確保使用者親自提及的機型具有最高優先度。
  4. **調測端點優化**：新增 `?sync=1` 快取快速重構端點（避免 6 分鐘 GAS 超時），優化 `?driveFiles=1` 反應速度防止 timeout。

### v29.6.019 (2026-07-01)
- 修正 PDF 檔名型號提取正則：
  - 將 `extractPdfModelIndexFromKbList` 中針對 `S` 系列的 regex 由 `/S\d{2}[A-Z]{2}\d{3}[A-Z0-9]*/g` 修正為 `/S\d{2}[A-Z]{1,2}\d{3}[A-Z0-9]*/g`。
  - 這能成功抓取 `S32D806` 等單英文字母系列型號，避免其被當作無手冊型號而無法加載。

### v29.6.024 (2026-07-01)
- 三星官網手冊自動化抓取：
  - 新增本地 Python 爬蟲腳本 `download_manuals_locally.py`，全自動掃描缺失手冊的型號，下載其官方說明書並依專案規格命名（如 `S27AG500,S28AG700,S32AG500,S49AG950.pdf`，尾端國家碼/銷售碼英文字不入檔名）存入 `三星螢幕使用手冊`。
  - 將曾用於繞過 API 權限測試的 `TEMP_BYPASS` 密鑰及 `?downloadManual=1` GET 端點完全刪除，恢復生產環境的 100% 封閉與安全防護。

### v29.6.025 (2026-07-02)
- 型號匹配與雙重來源防重疊優化：
  1. **型號後綴清理包含比對**：優化 `Smart Router` 內針對使用者訊息中是否存在具體型號的判定。將原本的完整料號比對修改為「去除尾部英文字母後綴（如 `S49DG932SC` 清洗為 `S49DG932`）」後再進行子字串包含比對。使輸入 `s49dg932` 時能直接自動鎖定，不再重複跳出型號選擇選單。
  2. **徹底根治雙重來源標籤**：在 `appendSourceTagIfMissing` 函式最前端加入安全衛哨。只要 Body 中已含 any `[來源: 官方手冊]` 或相關標籤，便直接返回 body，防止尾部 fallback 邏輯造成 `[來源:手冊]` 與 `[來源:官方規格庫]` 同時並存的冗餘 Bug。

### v29.6.026 (2026-07-06)
- 維護 Webhook hardening：
  1. 修復 `doPost` 的 `write_rules` 授權失敗分支引用未定義 `results`，導致本應回傳 Unauthorized JSON 時反而進入總例外的 BUG。
  2. `write_rules` 的 POST / GET 維護入口新增 `fromRow`、空規則、空白規則與試算表不可用的明確 JSON 錯誤回應。
  3. 靜態守門新增檢查，避免維護端點再次出現未定義回傳物件或缺少參數防呆。

### v29.6.034 (2026-07-07)
- QA 來源推斷修正：
  1. Fast Mode 回答若沒有可信來源標籤，系統會用使用者問題與回答內容比對 QA 列。
  2. 同一 QA 列同時命中問題與回答內容時，才補 `[來源:QA庫]`。
  3. 已有 `[來源:QA庫]` 或 `[來源:官方規格庫]` 等可信來源時不覆蓋。

### v29.6.033 (2026-07-07)
- 查無資料 WEB 確認強化：
  1. 不只偵測 `查無後引導網路搜尋，不標來源`，也偵測「查無、資料庫沒有、沒有關於某資訊」這類查無資料文字。
  2. Fast Mode 查無資料但 LLM 忘記 WEB 暗號時，仍會改成「是否擴大搜尋網路」確認流程。

### v29.6.032 (2026-07-07)
- 活動權益與查無資料 WEB 確認修正：
  1. 活動 RULE 回答時，要求 LLM 列出同一活動列中該型號所有相關權益，包含共通月月抽 Galaxy S26 資格。
  2. Fast Mode 若輸出 `查無後引導網路搜尋，不標來源` 但忘記 `[AUTO_SEARCH_WEB]`，系統會改成「是否擴大搜尋網路」確認流程。
  3. WEB 確認改寫後保留 `查無後引導網路搜尋，不標來源`，避免誤補成 `[來源:官方規格庫]`。

### v29.6.031 (2026-07-07)
- 活動 RULE 路由修正：
  1. 已寫入 `CLASS_RULES` 的三星螢幕活動 RULE，若問題含完整型號並命中該 RULE，會放行 Fast Mode 使用本地資料回答。
  2. `G5` 等短別稱或未建檔活動仍不放行，維持官方頁/網路搜尋引導。
  3. 靜態守門新增活動 RULE bypass 檢查，避免時效資訊守門再次攔掉本地活動資料。

### v29.6.030 (2026-07-07)
- 模型成本控制：
  1. `GEMINI_MODEL_FAST`、`GEMINI_MODEL_THINK`、`GEMINI_MODEL_POLISH` 固定為 `models/gemini-2.5-flash-lite`。
  2. 移除生產對話對 `gemini-flash-lite-latest` alias 的依賴，避免 Google alias 漂移造成實際成本高於估算。
  3. 靜態守門新增 production Gemini model 檢查，禁止三個生產模型常數使用 `latest` alias。

### v29.6.029 (2026-07-07)
- `/紀錄` 活動網址 fallback 邊界：
  1. 只有官方頁文字明確含活動期間、登錄期間、Steam、延長保固或 Galaxy S26 活動資訊時，才用官方頁解析結果。
  2. 測試網址或無效活動頁不應丟掉使用者原文中的型號與促銷資訊。
  3. TestUI iframe 改成輪詢等待，降低正式頁載入慢造成的誤判。

### v29.6.028 (2026-07-07)
- `/紀錄` 活動網址 fallback：
  1. Samsung 活動網址會抓官方頁文字，整理成 `CLASS_RULES` 預覽，使用者確認 `/紀錄` 後才正式寫入。
  2. Gemini polish 回 429、空回覆或只回網址時，改用本機解析活動名稱、期間、登錄期間與各活動型號群組。
  3. 新增正式 TestUI 回歸，防止活動網址再次退化成只存 URL。

### v29.6.027 (2026-07-07)
- `/紀錄` 建檔分流：
  1. `/紀錄 <內容>` 會自動判斷 QA/RULE；RULE 預覽與存檔寫入 `CLASS_RULES`。
  2. 內容含 `promotion.twsamsungcampaign.com` 活動頁時，會嘗試抓取官方頁文字後整理螢幕活動 RULE。
  3. QA/RULE 存檔後改用背景排程重建知識庫，避免 LINE webhook 同步超時。
- 短別稱手冊查證：
  1. `#查手冊 G5` 或只有短別稱的手冊/操作題，先列出現有 PDF 覆蓋的完整型號，不再直接鎖第一本 PDF。
  2. 移除不存在的舊錯誤型號範例與特定競品品牌案例，改以真實型號與通用競品範圍防呆驗證。
- 規格資料：
  1. 新增 2026/5-2026/9 三星螢幕登錄送活動 RULE，來源為 `https://promotion.twsamsungcampaign.com/2026-mnt-q2-sp/rule.aspx`。

### v29.6.093 (2026-07-21)

- **QA/RULE 路由復原**：移除跨裝置短別稱在 Fast Mode 前直接進 PDF 選型的捷徑，恢復 `精準 QA → QA/CLASS_RULES Fast Mode → PDF → WEB`。
- **QA 來源可信化**：精準 QA 可零成本直答；Fast LLM 只有同時通過程式端精準 QA 比對時，才可把 `[來源:QA庫]` 當成完成答案，避免 iPhone Air 誤套 iPhone 17／17e。
- **範圍維持**：不修改 Prompt!C3、正式 QA／CLASS_RULES、PDF/WEB 證據邊界與模型設定。

### v29.6.092 (2026-07-20)

- **產品身分守門**：`iPhone Air`、`iPhone 17/16` 與 `17e/16e` 使用獨立官方規格網址；官方頁產品身分不一致時不得列為可稽核證據。
- **QA 防誤配**：移除 LCS 共同子字串捷徑；本地 QA 與 PDF context 只接受產品實體、連接方式與主要意圖一致的內容。
- **衝突終止**：Apple 官方頁、QA 與手冊出現產品身分或連接能力衝突時停止回答並記錄人工複查，不再產生韌體、定位或市場策略推測。
- **Quick Reply 狀態化**：無來源、衝突、API 失敗或達搜尋上限後，隱藏「再詳細說明」與重複網搜；TestUI LOG 會記錄實際按鈕數量與標籤。
- **QA 來源守門**：外部裝置相容性 QA 沒有原廠官方網址時只能預覽，不能寫入正式 QA；A 欄單列字串格式維持不變。
- **發布守門**：正式入口增加 `git diff --check`，並繼續由 `tools/release_existing_webhook.ps1` 建立一個有描述版本後用 `-V` 更新既有 Deployment ID。

### v29.6.091 (2026-07-16)
- 修復 Quick Reply 被句點之漏洞：
  1. 移除產生 Quick Reply 條件中對 `#` 開頭指令的限制 `!msg.startsWith("#")`。
  2. 這保證當用戶點選型號泡泡（`#型號:`）或進行網搜（`#這題再搜網路`）後，系統回覆底部依然會帶有「再詳細說明」與「這題再搜網路」等對話氣泡按鈕，徹底打破死胡同。

### v29.6.090 (2026-07-16)
- 實裝本機 QA 優先本地直通車與 LCS 匹配機制：
  1. 導入 Longest Common Substring (最長公共子字串) 演算法，去除標點與空格後比對，只要問句有連續 2 個字以上重疊，該 QA 即在 PDF 模式下精準保留，解決中文非英文/型號詞彙篩選遺漏問題。
  2. 實裝 Pass 1.5 入口處的「本地 QA 直通車攔截」：在進入 Files API 和 LLM 查手冊之前，優先用最長公共子字串進行本地匹配，若有精準命中 (LCS >= 6 或占問題的 70% 長度)，直接用程式回傳 QA 答覆，完全不呼叫 LLM，完美實現「QA 第一優先」且避開手冊過期崩潰。

### v29.6.089 (2026-07-16)
- 解決 PDF Mode 下新建 QA 庫失效之漏洞：
  1. 重構 `buildDynamicContext` 的過濾邏輯。在進入 `isPDFMode` 深度模式時，代碼不再無條件清空 `fullQA`。
  2. 實現「話題與型號精選 QA 保留」，自動透過 Regex 抓取與當前使用者對話或推斷型號相關的詞彙，僅精選保留與當前問題相關的 QA 項目，其餘不相關的予以過濾，以達到既省 Token 成本、又保證優先命中 QA 庫之目的。

### v29.6.088 (2026-07-16)
- 修復線上嚴重問答漏洞：
  1. 修復 Pass 1.5（選定型號後流程）中，由於缺少對 `[KB_EXPIRED]` 的攔截，當 PDF 403 檔案過期時，內部標記直接暴露給用戶的 Bug。已補上 `[KB_EXPIRED]` 攔截與背景自癒重建指引。
  2. 重構全局價格防呆，使用負向先行斷言 `(?!0\.\d)` 以排除與保護 `NT$0.0070` 等 Token 費用，防止調測費用被錯改為「官網當下優惠價」。

### v29.6.086 (2026-07-16)
- 全局防呆機制補強：
  1. 全局價格防呆：在最終發送前攔截所有金額數字，替換為「官網當下優惠價」，確保回覆中 100% 不外洩具體金額。
  2. 推諉句過濾：過濾「請自行參閱手冊/官網」之類的推諉句，直接句子級移除以維護機器人負責任的客服視角。
  3. 口吻錯位糾正：自動將「根據你/您提供的手冊/PDF」修正為「根據官方手冊」。

### v29.6.085 (2026-07-16)
- 修復型號泡泡與建檔指令 Bug：
  1. 修復型號選擇 Flex 訊息中，因 intentConfig.footerText 未定義導致 LINE API 400 崩潰的 Bug。
  2. 修復 `/紀錄` 指令建檔分析中，因未找到相似分支下調用了未定義的 alertMsg 變數導致分析失敗的 Bug。
  3. 安全地移除了臨時調測端點，維護生產環境安全性。
