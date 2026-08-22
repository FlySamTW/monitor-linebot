# Samsung LINE Bot 專案 AI 協作指南 (Project Context for AI Agents)

## v29.6.248 同類介面欄位彙總

- 精確 RULE 回答 HDMI／DisplayPort／USB-C 數量時，必須逐欄彙總所有同類介面，不能只取第一個 regex 命中。一般問 HDMI 要包含 Micro HDMI；明確問 Micro HDMI 則只回答該子類。
- 這是通用資料解析契約，不得為單一型號建立硬編碼答案。

## v29.6.247 自動手冊完成鏈、單次客戶答案與 Rich Menu 資產守門

- 本節取代 v29.6.245「資料不足只推薦手冊、等待使用者再次授權」：一般使用者已送出問題，就應走到可交付答案。先查精準 QA／CLASS_RULES／已核對片段；型號操作、故障排除或其他缺證據的產品題直接進對應 PDF，不得先花 Fast 後只回「要不要查手冊」。
- 已有唯一完整型號就直接查 PDF；模糊系列／前段型號只列 `PDF_MODEL_INDEX` 目前實際涵蓋的候選，使用者選定後以原題立即執行，不再確認、不重問型號。不得從 RULE 候選冒充有手冊的候選。
- 從一般題轉手冊時退回該次 20 題額度；真正送出 PDF 才計手冊 5 次。PDF `no_evidence` 或 pipeline error 自動做一次系統 Web rescue，不扣使用者 10 次 Web 額度；救援後仍不足可給「再查網路」與官網連結，但不能回到同一手冊來源迴圈。
- LINE 客戶輸出只保留一次結論、必要操作路徑、頁碼及簡潔來源／費用。Evidence excerpt、模型、token、provider calls、route／state／refund 等工程資訊只寫 LOG／TestUI；不得把自然答案、操作路徑與摘錄換標題重複三次。
- Rich Menu JSON 維持 `selected: true`；鍵盤會暫時取代選單，PC LINE 不顯示，均屬 LINE 平台行為。Rich Menu default 是獨立發布資產，Webhook release 不會自動建立或綁定；故障排查固定為 inspect default → publish → readback。per-user 綁定優先於全體 default，特定帳號異常要先查個別覆蓋。
- 模型與成本契約不變：Fast 使用 Gemini 2.5 Flash-Lite，PDF／Web 使用 Gemini 2.5 Flash；不得藉本次流程修正引入較貴模型、第二次潤飾或額外供應商階段。

## v29.6.246 完整手冊優先、候選自癒與檢索升級判準

- 當同型號有快速指南與完整手冊時，所有已授權手冊查詢一律依「完整型號命中 → 涵蓋型號較少 → 檔案較完整」排序；禁止以問題關鍵字或新增單題 regex 才決定選完整手冊。
- 正式雲端 LOG 已證實 S32FM803 睡眠計時題掛到 41 頁多型號快速指南，而答案實際在 245 頁完整手冊第 157 頁。這類問題修文件選擇與 Evidence，不把每個新題寫成 QA 或 route 特例。
- 使用者已授權 manual 且 URI 清單缺較聚焦文件時，可由 Drive 自癒補傳排序第一的完整手冊；一般 QA／RULE、未授權訊號與 presence check 禁止因此掃 Drive、上傳或扣次。
- Files API 是 Google 官方支援的 PDF 長文件提示，不是頁級 RAG；File Search 才會 chunk／embedding／semantic retrieval／citation。目前 File Search 僅支援 Gemini 3.x，且不能與 Google Search／URL Context 同請求，正式 2.5 路徑不可直接替換。
- 下一階段只做固定代表題 shadow A/B：正確文件 100%、錯來源 0、引用有效答案至少 95%、P95 不惡化超過 20%，並以每個有效答案成本決策。未達門檻維持「Evidence／頁級索引優先＋整本 PDF fallback」。

## v29.6.245 結構化 QA、零成本缺口守門、來源授權與規格邊界

- 精準 QA 必須先於 RULE 回覆完整主張；同句有兩個以上規格面向時，禁止單一 RULE 欄位提前終止。
- 數值規格正規式必須使用獨立邊界，禁止讓機身尺寸中的 `263.5mm` 冒充 `3.5mm` 耳機孔。
- 所有未授權自動 PDF 旁路已封閉；免費資料不足時提供 manual＋web，只有手冊 postback 才能送 PDF。
- capability evidence 與 RULE 抽取使用同一數字邊界；缺口題不得先花 Fast 費用再只回來源按鈕。

- `qa_knowledge.gs` 是唯一 QA knowledge layer。新資料用 `QA2:` JSON 存在 `QA!A:A`；舊 `[標籤] 問題 / A：答案` 僅作讀取相容。新 `/紀錄` 不再寫整段白話格式。
- `answer` 只保存 `conclusion/facts/steps/cautions/alternatives`，LINE 口吻與排版由 renderer 統一處理。產品特例放 QA2，不得在 `handleMessage`、Prompt 或新的 query regex 補題目。
- 同步時建立 record shards＋16 桶倒排索引；Fast 每題最多注入 6 筆候選。完整型號不相符即拒絕，短別稱與系列 scope 不相符也不得借答案。
- 原 `getVerifiedManualChunks_()` 的硬編碼片段已搬到 `QA.csv` 的 `evidence.type=manual_chunk`；執行時以型號＋題意＋排除詞查索引。手冊來源仍顯示頁碼／HTML 位置，命中為零 PDF、零扣次。
- `[AUTO_SEARCH_PDF]` 只能推薦來源，不能直接執行；使用者按「查官方手冊」才算授權。
- Gemini Files API 仍是官方對重複使用大型 PDF 的建議；File Search 雖能語意切塊與回傳頁碼引用，但目前只支援 Gemini 3.x、不能同次混用 Google Search。先做代表題 shadow A/B，不可直接替換正式 2.5 路徑。

## v29.6.193 AnswerEnvelope、完整引用與可逆終點

- 正式回答、來源建議與 Quick Reply 以 `AnswerEnvelope` 為唯一完成狀態：原題、完整型號、claims、實際 evidence refs、supported/partial/unsupported、未解主張與允許動作必須一致。模型來源標籤不是證據。
- 路由只讀使用者 `originalQuestion`；`#再詳細說明` 的內部 instruction 只供 LLM，不得拿去判斷操作／手冊意圖。無可信證據的上一答按補充時零 LLM、零費用，直接提供手冊與 Web；補充每題最多一次。
- 無證據的產品斷言不得送 LINE；部分 RULE／QA 答案若夾帶業者、App、韌體、庫存等未查證句子，先移除未證實部分，再同時提供所需來源。QA evidence 綁實際列；RULE evidence 綁精確型號欄。
- `查官方手冊` 一按即授權。缺型號只列 `PDF_MODEL_INDEX` 的候選，選定後直接進 PDF；Rich Menu、Quick Reply、相容 `#` 指令與舊泡泡皆進同一 v2 狀態機。`manual_search_consent` 已 fail-closed，禁止二次確認與旁路扣費。
- 手冊失敗自動補查一次非 Samsung 公開網頁，不扣使用者 Web 額度、每日最多 3 次；回覆分「手冊結果／網路補充」。Web 不搜尋 Samsung 官網，僅保留「到這款官網」連結。
- 正式問題先讀 Google Sheet 最新 LOG；M9 第四台等複合題拆成個別主張，不得把沒有證據的「無調諧器／可能有業者 App」說成結論。未來新增資料與測試，不新增單句特例 route。
- Google `groundingSupports` 可能只標到同一句逗號前；Web 摘要只能在原始回答的同一條列／同一行擴回完整句，禁止跨段拼接。可以／能否類題須有明確結論，怎麼／如何類題須有實際動作；否則 fail closed，不能把半句掛成網路答案。
- PDF 檢索以一條通用 stage instruction 將口語需求轉成手冊的裝置類別、連接介面、功能名稱與同義詞，不以新題型 if/else 或全域 Prompt 特例補洞。
- Web 沒有 chunks/supports 時不得掛來源；但同次模型回應若有低風險、可逆的具體動作，可清楚標為「可能方向」後交付。排除可能、不一定、其他型號、來源不明韌體與工程模式；手冊 rescue 不得再把 `found=false` 原文冒充最可能答案。
- 無引用全文的權威資料流是 `lastWebUnverifiedDraft`；`[WEB_NO_EVIDENCE]` 只是控制標記，不得拿它取代草稿內容。手冊自動補救與直接 Web 都必須先取 raw draft，再做相同安全過濾。
- 未引用草稿必須按子句清理；購買、訂購、付費、通常、可能、不一定、其他型號與高風險操作全部排除，只交付連接、切換、確認、詢問等可逆步驟。

## v29.6.179 Evidence[]、操作路徑與有效答案成本契約

- 已確認完整型號的操作／設定題，若精準 QA、RULE、verified Evidence 都未命中，零 Fast 直接顯示手冊授權；不得先讓 Fast 猜一次、刪答案後仍收費。
- Fast／Polish 維持 Gemini 2.5 Flash-Lite。只有經使用者授權且無逐頁 Evidence 的整本 PDF fallback 使用 Gemini 2.5 Flash，因正式 48 頁手冊已兩次證明 Flash-Lite 可能漏頁。
- `G806／M703` 等不完整代碼先在 CLASS_RULES 的完整型號 token 中解析：多候選列選單、唯一候選鎖定、零候選才追問完整型號；不可讓操作題的缺型號 guard 搶先中斷既有候選流程。
- PDF Structured Output 固定 `thinkingBudget=0`，避免預設 Thinking 吃掉輸出額度而截斷 JSON；PDF→Web 已自動補查後不再顯示網路重搜，內部 evidence marker 不得外洩。
- PDF schema 統一 `{found, answer, evidence[]}`，最多 3 筆頁碼／範圍／摘錄；複合題需逐項回答，操作題有路徑或步驟時不可只回注意事項。
- 操作答案用「入口分類 → 功能名稱」呈現；Evidence[] 排除封面／目錄／型號清單。偏色、色偏、偏黃與顏色異常視為通用故障症狀，避免 Fast 無來源作答。
- PDF Flash 依官方 US$0.30/M input、US$2.50/M output 計費，仍受 NT$0.35 單次硬上限與 token 預檢；衡量指標是每個可核對答案的成本，不是單次 API 表面最便宜。

## v29.6.174 PDF evidence 與新手冊納管契約

- Gemini Files PDF 回覆必須用 Structured Output JSON：`found／answer／pageNumber／scope／evidenceExcerpt`。程式組來源與頁碼；不得再以模型是否輸出某句自然語言標籤判定證據存在。
- v29.6.174 的舊 gate 只允許 `found=false` 進 Web；v29.6.189 已取代。格式、驗證、逾時、索引或供應商錯誤仍不得冒充「手冊沒有」，但要清楚標為手冊 pipeline 未取得可核對證據，再受控補查一次非 Samsung Web，不把我方失敗留給使用者。
- `HDMl／HDIM／HMDI` 等輸入錯字在正規化層修正；更新、升級、插哪個孔等屬通用操作意圖，不得被相鄰規格詞洗白成 RULE 結論。
- 新型號 discovery 全自動：Samsung TW Product Finder 的可信白名單欄位寫入 A 欄最小 RULE；新繁中 UM 經 PDF magic／MIME／SHA-256、Gemini 第 1 頁型號及支援頁 SKU 交叉驗證後，自動依舊檔名規則進正式 Drive/RAG。驗證矛盾才進 `_PENDING_MANUAL_REVIEW` 隔離重試；既有檔更新先自動備份，正常流程不需人工搬檔。
- 第一頁身分驗證先用 2.5 Flash-Lite，僅漏判時自動升級 2.5 Flash 一次；共用 250K token 上限，仍失敗才隔離。
- GAS 對 Drive 無寫權時，驗證通過的手冊以相同正式檔名自動改存 Gemini Files API，持久合併 `MANUAL_PDF_KB_LIST`、`KB_URI_LIST` 與 `PDF_MODEL_INDEX`；無須人工補搬。
- 手冊型號選單只能列正式 `PDF_MODEL_INDEX` 實際覆蓋的型號；RULE-only、隔離重試中或舊按鈕帶入的型號都不得執行 PDF 或扣額度。
- 已核准且內容不變的 Drive PDF 每日自動重傳 Gemini Files，使用者不需 `/重啟`；`/重啟` 只是管理員強制清理對話／快取狀態，不是日常維護步驟。

## v29.6.173 已核對證據的短追問契約

- `它支援雙模式嗎？ → 要怎麼切？` 這類省略主詞追問，若本句不能獨立命中 Evidence，須與歷史中上一則使用者主題合併後重查既有 Evidence。
- 命中既有 QA／RULE／已核對手冊片段即零生成回答；不得已經有答案卻再花 Fast token，最後只回手冊 CTA。
- 新完整型號代表獨立問題，不得借用上一題主題；來源仍維持 QA/RULE → PDF → Web，Evidence 承接不等於付費模式黏住。

## v29.6.172 模糊系列、錯字與證據來源契約

- 全形與常見介面縮寫錯字先在輸入正規化層處理，不以 Prompt 或逐題 route 特例修補。
- G8／M7 等短別稱對應多款實體時，除純系列介紹外必須先顯示完整型號候選；選型後才回答原題。
- 短別稱不是完整型號，禁止據此替模型概括回答補 `[來源:官方規格庫]`。

## v29.6.171 回答保留、PDF 證據與 Web 支持句段契約

- 正式 12:59 LOG 證實舊型號鎖定分支會在最後把 Fast 已產生的部分回答洗成純手冊 CTA；完整型號鎖定後只准清除缺型號狀態，不得再次依藍牙、能力題等特例重建答案。
- 客戶文案不解釋「不會再問一次」等內部狀態；按鍵與標籤已能表達動作，只說「想核對可點查官方手冊」。
- 手冊索引有同型號不代表能回答所有題目。`S32FM902SC` 現有 41 頁 PDF 是硬體安裝／規格手冊，App 操作位於三星繁中 HTML 使用者指南 v6.5.0；證據 metadata 必須保留文件種類與位置，不可把硬體 PDF 冒充智慧功能 e-Manual。
- 手冊授權後，缺檔、索引過期、token／費用預檢、供應商錯誤、缺頁碼證據或模型明示需 Web，全部進同一個每日最多 3 次的非 Samsung 公開網頁補救；不要求使用者重按、不扣 10 次網搜額度，也不得再跨回 PDF。
- Fast 實際溫度由程式限制在 0.4–0.5，PDF 0.2、Web 0.15，且每次生成寫入 stage／temperature LOG；溫度只改善口吻，不能取代來源與證據守門。

## v29.6.161 證據守門與單次手冊授權契約

- Rich Menu 是使用者主動指定來源的捷徑，不是自然問答的必經關卡。QA／RULE 或已核對手冊片段已有答案時，必須直接回答，禁止先生成再以「可查 PDF」為由丟棄答案。
- `查官方手冊` 這一個按鍵即完成授權。已有「本題＋完整型號」就直接查 PDF；缺完整型號時依系列／前段列實際 PDF 候選，選定後直接查；只有完全沒有題目才請使用者輸入題目。任何一路都不得再要求第二次確認。
- 手冊已人工核對的常見操作題應持續擴充為「完整型號＋意圖」片段，而非每出現一題就讓整本 PDF 機率式找頁。`S32FM702／703／803` 的串流 App（Netflix／YouTube 等）依第 68–72 頁先零成本回答：首頁 → 應用程式 → 開啟／登入；未安裝才安裝。不得套用到其他型號。
- 無本機證據的 Fast 操作答覆不得當成完成答案；依未解主張提供「查官方手冊」與／或「再查網路」。不得因步驟看似完整就當成已核對事實；按鍵後直接查，不得二次確認。
- 新增證據一律進統一的 `Evidence[]`／`findVerifiedManualChunk_` 資料索引（model scope、topic、頁碼、facts、同義錨點、排除條件），不准新增新的題型路由函式；型號 scope filter 必須先於任何同義字／語意命中。

## v29.6.159 Prompt 與模型呼叫契約

- Fast、PDF、Web 只取得各自必要提示；路由、授權、額度與來源標籤由程式守門，不重複塞入 Prompt。
- 特定產品事實（含 iPhone Air／iPhone 17）放在 `QA.csv`，不得放進通用 Prompt。
- v29.6.162 起 Fast 為 0.4–0.5、PDF 0.2、Web 0.15；不增加第二次潤飾模型呼叫。
- Google 官方邊界：Files API 掛整本 PDF 是文件理解／長上下文，不等於 File Search RAG；真正 File Search 會 chunk、embedding、semantic retrieval 並可用 metadata filter。現行已核對片段與離線逐頁索引屬本專案自管 retrieval，但整本 PDF 路徑仍非真正檢索。M9 等智慧螢幕須以 `document_role` 區分硬體 PDF 與 HTML e-Manual；不得再以「同型號有 PDF」判定題目可被該文件回答。
- 不在 v29.6.162 熱修直接切 File Search：官方現行支援清單不含 2.5 Flash-Lite，且不可和 Google Search／URL Context 同請求；先以代表題 shadow pilot 比較引用成功率、正確文件召回率、有效答案成本與 P95 延遲，達標才另版遷移。
- PDF 模型的可稽核輸出固定包含 `answer／operationPath／Evidence[]`；操作題的功能表或章節入口由 `operationPath` 固定呈現，不得依自然回答碰運氣。Web 有 grounding 仍須通過本題型號相關性，明說只找到其他系列時不得當成功。任何截斷 `[cite` 或超長網搜草稿不得送上 LINE。

## v29.6.158 回答鏈與一次性補充契約

- 系列別稱只產生候選，不得把候選第一款寫入已確認型號。型號特定規格只能用該完整型號自己的 RULE；未明載等於 UNKNOWN，不可讓 Fast 猜測，直接建議手冊並退回一般額度。
- 規格欄位可由精確 RULE 回答時必須 terminal return：不建 history／Top-K／Fast prompt，`LLM=0`、PDF=0、Web=0。
- 「再詳細說明」是一次性 control action：保留 active question 與 confirmed model，不扣 20 題，使用後不再顯示；重點是友善表達，不得改寫型號事實或暗中跨到 PDF／Web。
- 系統請使用者補型號後，點選與直接輸入完整型號都必須接回原問題，而不是把型號當一題新問題。

## v29.6.157 回答鏈、精確型號證據與逐頁索引基線

- LINE 可見回答固定依「直接答案 → 必要步驟 → 必要限制 → 手冊重點 → 官方手冊頁碼 → 簡短費用／額度」排列。`RAG`、`BM25`、chunk、evidence ID、revision、token、grounding、適用範圍等只准留在後台；模型的原始證據欄位只供程式驗證，送 LINE 時僅保留去重後、可幫助實際操作的短「手冊重點」。
- 已核對手冊片段用確定性重排，不再呼叫第二次模型潤稿；只可刪贅詞、調整順序與換成台灣口語，型號、數字、單位、選單名稱及「僅／必須／不支援／可能／需要」等限制詞不可改寫或省略。
- `tools/build_manual_page_index.py` 是離線、零 API 的通用逐頁索引產生器；來源由 `config/manual_registry.json` 精確綁定手冊與型號，`config/manual_lexicon.json` 只做跨問法意圖擴詞。輸出採小型 meta、lexical index 與頁面 shards，不把整本索引塞進 GAS 熱路徑。
- v29.6.157 的正式回答仍以既有 QA／RULE、已核對片段與整本 PDF 為主；逐頁索引先完成 M8／G8 影子驗證，不得假稱已全面取代正式 PDF。正式切換需另版完成 Drive artifact、ScriptProperties active pointer、revision／SHA 原子發布與頁面 evidence ID 驗證。
- 系列別稱選型後必須重新進入與「直接輸入完整型號」相同的已核對片段入口；能回答時直接回頁碼與步驟，不能先花 Fast 費用再叫使用者按手冊。
- M8／M7 常見手冊題的已核對片段擴充為藍牙音訊、Wi-Fi、Smart View／AirPlay、藍牙鍵鼠／手把、App 管理、軟體更新與出廠重設；每個片段仍須同時命中精確手冊型號與操作意圖，不能跨型號套用。

- `S32FM702／S32FM703／S32FM803` 的藍牙喇叭／耳機操作已人工核對官方手冊第 151 頁：路徑為「設定 → 所有設定 → 音效 → 音效輸出 → 藍牙揚聲器清單」。進入手冊查詢後必須先命中這個確定性片段，直接回覆頁碼與操作步驟，`pdfCalls=0`、不扣手冊次數；不得再把整本 PDF 交給 Flash-Lite 機率式找頁後誤判未記載。
- 上述片段僅允許完整型號匹配與藍牙音訊操作意圖；其他型號仍走原有 PDF 查詢擴詞，不能借用 M8 手冊內容。

- 完整型號一旦由使用者選定，本輪 DirectDeep、規格檢索與 PDF 可用性只能使用該完整型號；不得再從型號字串中的 G8／M8 片段展開其他系列候選或掛錯手冊。
- `術語_` RULE 只可解釋功能名稱，不是型號能力證據。能力題只有該完整型號自己的 CLASS_RULES 列明載才可肯定；未記載時須誠實說無法確認並提供手冊查證，不得把同系列其他型號套用。
- 程式守門產生的精確型號結論必須保留在最終手冊授權提示，不得被泛用模板洗掉；正在建議手冊時只顯示手冊與可選官網，不得同時提前顯示 Web 搜尋入口。
- QA／RULE 已完整回答時即停止，不因該型號「有 PDF」就在回答後追加手冊或 Web Quick Reply；只有 `manualSourceRecommended` 才推薦手冊，只有 `webSourceRecommended` 才推薦 Web。常駐 Rich Menu 仍可讓使用者主動指定來源。
- 全新對話的無型號操作／故障／跨裝置相容性題，在精準 QA 未命中後直接 deterministic `ASK_MODEL`；不得先讓 Fast 猜 PS5／PC 設定、HDMI 線材或其他型號步驟，也不得為單純補型號呼叫 LLM。已有持久完整型號時仍依使用者鐵律沿用，不誤判成缺型號。
- 兩個完整型號的比較題直接從各自的精確 `CLASS_RULES` 列抽取面板、解析度／更新頻率、反應時間、HDR 與同步規格；不交給模型混入第三台數字。活動 RULE 必須先以台北日期判斷仍有效，過期活動只留歷史資料，不可進回答。
- 範圍外題必須在 pending source、持久型號、價格與未知型號之前攔截；LG／HP／Lenovo 等競品與洗衣機等家電不得借用上一題螢幕型號。未登錄的完整型號不得寫入持久產品狀態。有效活動的指定型號權益由程式擷取該型號所在條款及共通抽獎，不交給模型混淆 Steam 點卡與延長保固。
- 商品售價仍一律遮罩並導官網；活動 RULE 明載的點卡、禮券或購物金面額屬贈品權益，不得被售價遮罩洗掉。
- 使用者選手冊後的免費前置檢查不得再呼叫 Fast 模型。只允許精準 QA、人工逐頁核對片段或程式從該完整型號 RULE 擷取的明載規格；操作／設定沒有現成證據時必須繼續顯示手冊確認並真的讀 PDF。
- `S32HG806ES` 的 Dual Mode 已由官方手冊第 27／35／43 頁人工核對：OSD `Game → Dual Mode`、可設自訂鍵、48–165Hz／48–330Hz 與 6K 165Hz 規格。僅精準命中該型號與雙模意圖時可零成本回答，不得套到其他 G8。
- USB 已核對片段只回答「如何播放」與格式限制；含斷線、中斷、不穩、異常、無法、故障或明確非官方／網路意圖時不得搶答，必須繼續到對應來源。
- 自然問句已同時明確出現非官方／公開網頁來源與查找解法意圖時，不先呼叫 Fast；零成本顯示「這題再搜網路」並退回一般 20 題額度。使用者按下後才由 Web 專用模型搜尋。
- 使用者確認 PDF 後若整本手冊生成仍取不到可核對證據，路由層自動做一次非 Samsung 官網的 Web 補救，不要求重按且不扣 10 次網搜額度；每聊天室每日最多 3 次系統補救。同題不得再次重試，Web 仍無證據時提供明確標示未經證實的保守操作方向與官網連結，禁止只回沒答案或形成迴圈。

- 完整型號是跨日產品狀態：沒有新完整型號前，數天後自然追問、手冊、網路都沿用。短系列名列候選，不覆蓋；只有換型號、新完整型號或管理員 `/重啟` 清除／取代。
- 手冊與網路按鍵本身就是授權：有上一題且有完整型號時直接執行；缺型號只顯示候選，選完立即執行，不做二次確認。
- 手冊與網路都先建立 canonical source operation；10 分鐘內同來源＋型號＋問題回傳快取，不再次呼叫／扣次。手冊索引過期不快取失敗，背景修復後可立即重試。
- 所有手冊回答都要有頁碼、適用範圍與證據摘錄；Fast 的 QA／RULE 來源只能由實際命中決定，模型自帶來源標籤不採信。網路只接受 grounding supports/chunks；禁止 Samsung 官網 URL Context／直接抓頁，官網只作可點 URI。
- provider query 與 originalQuestion 分離：System Hint、模型提示與 canonical 關鍵字不得寫回對話。只有來源成功才更新 lastSource；Web 無證據不得切斷既有 manual 追問鏈。供應商請求送出即計次，不以退款放任改寫重燒；同型號同意圖 10 分鐘 operation cache 去重。
- `S32FM702／703／803` 的零售模式與 USB 媒體播放已加入人工逐頁核對片段：第 170 頁使用模式、第 97／176 頁 USB 路徑與限制。精準命中時零 PDF 呼叫、零手冊扣次；其他型號／意圖不得套用。

- `到這款官網` 是回答不足時的情境 Quick Reply，不是第四個 Rich Menu。只有已鎖定 CLASS_RULES 完整型號，且回覆查無資料、手冊未記載、來源失敗或證據衝突時才顯示；成功的 QA／RULE 答案、G8/M8 等短別稱與選型中一律不顯示。RULE 內 PDP 優先，否則用同列 XZW 料號的 Samsung Taiwan support URL；只允許 `https://www.samsung.com/tw/`。
- 正式 `/exec?test=1` 仍需維護密碼；Google Apps Script 的 `/dev?test=1` 僅專案編輯者能進入，程式以 `ScriptApp.getService().getUrl()` 確認 `/dev` 後才簽發 15 分鐘 TestUI token。兩者都共用 `testMessage` 與正式事件 router，禁止 Mock 冒充真人驗收。
- 每日 04:00 PDF 重傳後必跑 `auditManualCoverageGaps_()`；新 RULE 缺 PDF 或 H／2026 型號缺 PDF 時，保存報表、待審狀態與警示 LOG。`?manualCoverage=1` 必須維護授權，TestUI 顯示簡短覆蓋徽章。
- 官網掃描可自動發現產品與手冊下載網址，但沒有第一頁完整型號、PDF magic/MIME、SHA-256 與檔名驗證就不得自動進正式 RAG。2026-08-15 正式索引回讀顯示 H／2026 的 6 款 RULE 型號全部覆蓋，缺口 0。

- RULE 事實守門：完整型號的 `CLASS_RULES` 若明載 `Tizen` 與藍牙版本，Fast 模型不得回答「沒有內建藍牙」或「不支援藍牙」。純規格題直接用 RULE 回答；藍牙耳機的選單／配對操作題要在最終可見提示保留 RULE 肯定事實與已選型號，再建議使用者授權查官方手冊，禁止被後段模板洗掉。
- 手冊證據標記：模型輸出 `範圍:型號共通` 時正規化為既有契約的 `全檔共通`；若同一回覆已有有效第 N 頁，不得再追加「未取得可核對頁碼」，內部標記不得外洩。

- 藍牙耳機／喇叭操作題在 PDF 階段必須擴查手冊正式標題與選單同義詞（音效輸出、藍牙揚聲器清單、Bluetooth Speaker List、掃描、配對），不得因使用者用語不同就誤回「手冊未記載」。

- Fast／Polish 固定 `models/gemini-2.5-flash-lite`（US$0.10/M input、US$0.40/M output）；整本 PDF fallback 與實際 Google Search grounding 使用穩定版 `models/gemini-2.5-flash`（US$0.30/M、US$2.50/M）。PDF 只在 QA／RULE／逐頁 Evidence 不足且使用者授權後啟用，並受 NT$0.35 單次上限約束。
- Web 回答最多 5 點、每點最多 2 行、450 個中文字內並須完整收尾。螢幕內建 USB 媒體播放題不得混入 Windows USB 省電、主機板 USB 埠或電腦端線材；非官方韌體下載不得列為解法。
- 成本比較看有效答案而非單次單價：先用精準 QA／RULE、頁面收斂與已核對手冊片段。只有未覆蓋題組的整體正確率仍不足，才另案 A/B MANUAL；不得在低成本方法已達標後繼續為模型比較花費。
- PDF 先以官方 `countTokens` 精算同一 payload，單次硬上限 NT$0.35；生成後以 `usageMetadata` 記實際費用。TestUI 不得再顯示舊的「約 NT$1.5」。
- `countTokens` 暫時錯誤、PDF 429／5xx、異常空答只受控重試一次；403／404 先單檔重傳再試。每日 04:00 強制重傳仍存在，失敗本數必須正確計數並排程背景重試。
- `/重啟` 只清使用者對話狀態；一般 PDF 過期、上傳失敗與同步不需要人工 `/重啟`。
- 官網 URI 只能使用本題完整型號或本題明確解析的 `primaryModel`；不得借上一題 `direct_search_models`／suggested cache。
- 每日重傳若部分 PDF 上傳失敗，保留前次完整 URI 與備份；Drive 掃描完整時以完整檔名目錄建立索引，掃描中途失敗則連正式索引也不覆蓋。兩種失敗都排程一分鐘後重試，TestUI／稽核不得把暫時失敗誤報成手冊缺口。

- 「直接問」20 題只計規格／FAQ 實質回答；手冊與網路使用各自額度，不得雙重計次。
- 一般回答若只產生手冊授權引導，必須退回該次一般提問額度。
- 一般流程已鎖定的完整型號必須寫入持久產品狀態；內容不同的新題仍沿用產品型號，但不得沿用舊答案與來源授權。手冊、網路、再手冊跨來源都不得洗掉型號。
- 常駐 Rich Menu 維持三格；只有準備沿用已知型號時，才顯示情境 Quick Reply「換型號」。換型號保留原問題、零計次、零來源呼叫。

- Rich Menu 與 TestUI 三格使用雙排超大字：第一排 `直接問`／`查手冊`／`搜網路`，第二排 `20題/日`／`5次/日`／`10次/日`。禁止縮回單行小字或塞入長句。

- `G8` 是 `CLASS_RULES` 已定義的 Odyssey 系列別稱。系列別稱遇到型號相關功能／操作／手冊題時，先從 RULE 列完整型號按鈕；只有涵蓋相同別稱的精準 QA 可直接回答，禁止泛用 Smart／其他型號資料搶答。選定完整型號後不得再次進入選型迴圈。
- 手冊 `countTokens` 的 20K 是成本警戒而非拒絕線；先刪除無關歷史，只保留本輪完整問題。100K 是絕對 token ceiling，2.5 Flash 依現價計算的 NT$0.35 成本 ceiling 通常更早生效；超限先用 `MEDIA_RESOLUTION_LOW` 重算，仍超標才停止且不扣次。
- 免費 QA／RULE 預檢未命中後，PDF 生成階段只能載入官方手冊，不得再混入 QA、RULE、Prompt!C3 或網路。型號規格結論必須附 PDF 頁碼與「型號明確／全檔共通」證據範圍；「依型號而定」不能當肯定證據。

- 手冊 URI 過期時，只更新本題實際選中的 1～2 份 PDF 並重跑 token 預檢；成功後才送出生成請求與扣除手冊額度。單檔更新仍失敗才使用既有背景整庫重建，禁止因一份手冊過期就先同步全部 PDF。

- 正式 TestUI 真人提問驗收守門：完整型號操作題不得誤判為缺型號；QA／RULE／已核對片段不足時要直接執行手冊完成鏈，不能只推薦「官方手冊」。真正送出 PDF 前才扣手冊次數。
- 使用者直接輸入文字是新問題，但在沒有新完整型號前仍沿用持久產品型號。手冊可輸入系列別稱或型號前段；多個候選時顯示可點選型號，選型均零扣次。
- 使用者雖選官方手冊，仍須先做高信心 QA／CLASS_RULES 預檢；本機答案足夠時直接回答，零 PDF、零手冊扣點。只有不足時才進已授權 PDF。
- 實驗期每位 LINE 使用者每天 20 次有效提問；來源 postback、取消、補型號與型號選擇不重複計次。群組內仍按 userId 個別計算。
- LINE 客戶版只顯示 `本次約 NT$...｜今日提問剩餘 N/20`；token、paidCalls 與詳細成本仍只留 Request Audit／TestUI Logs。
- 每人 20 題使用短 UserLock，不得與 PDF 索引同步共用 ScriptLock；鎖忙碌時 fail closed，必須零計次、零供應商呼叫並顯示友善重試訊息。

- 一般訊息永遠先走 `規格＆FAQ`；精準 QA、CLASS_RULES 與人工驗證片段優先回答，但實驗期間每位使用者每天最多送出 20 題。
- `官方手冊` 可由一般提問的自動完成鏈、Rich Menu postback 或相容舊指令建立一次性 SourceOperation；`網路解答` 除 PDF 的一次系統 rescue 外，仍由網路按鍵或相容指令啟動。pending 10 分鐘只用於等待題目或型號，查完、失敗或取消後回到可直接提問狀態，但持久型號保留。
- 每聊天室每日（Asia/Taipei）手冊 5 次、網路 10 次；只有 token／檔案等預檢通過、第一個生成請求送出前才原子扣次。
- `[AUTO_SEARCH_PDF]` 在 QA／RULE／已核對片段不足且型號可解析時，必須匯入一次性 manual SourceOperation；缺型號只列正式 PDF 候選，選完即查。`[AUTO_SEARCH_WEB]` 不得讓 PDF 自行聯網，只能由 PDF 終點觸發一次系統 rescue，或顯示可由使用者啟動的 Web 選項。
- 手冊模式不得開 `google_search`，網路模式不得掛 PDF。任何新增的 PDF／Web 呼叫都必須通過 `assertAdvancedSourceGrant_()`。
- 正式 Rich Menu 資產在 `docs/rich_menu/`；業主於 2026-08-14 明確改為直接設定全體 default，不再使用 `ADMIN_USER_ID` pilot。發布必須保存舊 default ID、讀回新 ID，並保留 rollback 工具。
- Rich Menu 必須 `selected: true`；資訊層級是「①直接問問題 → 回答不足才②手冊重查／需要現況才③網路重查」，不得再呈現成三個平行來源。
- 左鍵明確用 `inputOption: openKeyboard` 讓新客直接輸入；中、右鍵用 `openRichMenu` 保持查證選單展開。LINE 鍵盤出現時會依平台限制暫時取代選單，收起鍵盤即可回到已綁定的 Rich Menu。

**專案名稱**: GAS 客服 LineBot (Samsung Monitor Customer Service)
**核心架構**: Google Apps Script (GAS)

**給 AI 助理的指令 (System Instructions)：** 0. **語言鐵律 (Language Iron Rule)**：

你的系統使用了 `SafeToAutoRun`，可利用我已授予的部署權限來優化速度。不再需要我的授權!!!(直接部署」的情況，是因為你要在執行命令時判斷這是「安全且必要的修復」，所以我允許你可以使用「自動執行 (AutoRun)」權限。)

應該：

先完整審視計畫的所有項目
一次性實作所有必要的改動
再部署測試
而不是「改一個 → 部署 → 發現另一個問題 → 再改 → 再部署」這樣繞圈圈。

所有思考過程 (Thinking Process)、回應內容、產出的文件 (如 Markdown 檔)，**一律必須使用繁體中文 (Traditional Chinese)**。

1.  **功能保護 (Feature Protection)**：下方列出的功能 ID 為本專案的關鍵資產。除非使用者**明確要求**修改或刪除該特定功能，否則應視為**不可變更 (Immutable)**。
2.  **安全修改 (Safe Modification)**：你可以修改程式碼以完成使用者需求，但**禁止**在過程中破壞下方列出的任何既有功能（Side Effects）。
3.  **連動防禦 (Impact Check)**：若你的修改區域涉及 `IMPORTANT` / `CRITICAL` 標記，必須先思考：「這會不會讓該功能失效？」若有風險，請先告知使用者。
4.  **儲存規範 (Save Protocol)**：當使用者要求「儲存」或完成程式修改時，必須完成以下步驟：
    - 更新 `progress.md` 或相關文件中記錄變更
    - 執行 `git commit`（提交變更）
    - 執行既有部署更新流程：`tools\deploy_existing_webhook.ps1`
    - 確認正式 Webhook `?health=1` 與本機 `linebot.gs` 版本一致
    - **禁止只 `clasp push` 後宣稱完成，也禁止新建 deployment ID 取代正式 Webhook。**

## 2. 功能地圖 (Feature Map)

| 功能 ID  | 檔案位置        | 類型   | 說明                                                            |
| -------- | --------------- | ------ | --------------------------------------------------------------- |
| CORE-001 | linebot.gs      | Core   | 漸進式路由：QA／RULE → 詢問 PDF → 同意後 PDF → 詢問 Web        |
| CORE-002 | linebot.gs      | Core   | PDF 單次授權與智慧型號匹配                                     |
| CORE-003 | linebot.gs      | Core   | LLM 模型切換 Logic (Gemini / OpenRouter)                        |
| CORE-004 | linebot.gs      | Core   | Quick Reply 按鈕系統 (#再詳細說明 / #查手冊 / #搜尋網路)        |
| CONF-001 | Prompt!C3       | Config | 正式提示詞來源，位於 Google Sheet `Prompt` 工作表 C3            |
| CONF-002 | CLASS_RULES.csv | Config | 規格定義與直通車關鍵字 (讀取自 Spreadsheet)                     |
| UI-001   | TestUI.html     | UI     | 網頁版模擬器 (Mock Mode & Cloud History)                        |
| UI-002   | TestUI.html     | UI     | 手機版 RWD 支援 (Viewport settings)                             |
| OPS-001  | deploy.bat      | Ops    | 自動化部署腳本                                                  |
| OPS-003  | tools/release_existing_webhook.ps1 | Ops | 發布總控：守門測試、GAS 上傳、既有 Webhook 更新、正式版本驗證 |
| OPS-002  | .clasp.json     | Ops    | Clasp 設定檔                                                    |

## 3. 重要變數與儲存格映射 (Spreadsheet Mapping)

- **Prompt!C3**: 正式執行中的 System Prompt，位於 Google Sheet `Prompt` 工作表的 `C3`。
- **Prompt.csv**: 只可視為本地鏡像/人工備份；部署流程不會自動把它上傳到 Google Sheet。
- **CLASS_RULES.csv**: 對應 Spreadsheet 的 `CLASS_RULES` 工作表 (存放產品規格與關鍵字)。
- **QA.csv**: 對應 Spreadsheet 的 `QA` 工作表 (存放歷史問答快取)。

## 4. 特殊代碼處理 (Error Handling)

- **400 Bad Request**: 視為無效 Key，應回傳「API Key 無效」訊息。
- **429 Too Many Requests**: 視為額度限制 (Quota Limit) 或頻率限制 (Rate Limit)，應回傳「系統忙碌中 (429)」訊息。

## 5. 架構原則與開發鐵律 (Architecture & Iron Rules)

### 核心原則 (Brain-First)

優先級順序：**QA 資料庫 (最優先) > CLASS_RULES (規格/術語) > 官方 PDF 手冊 > 網路搜尋/官方頁 > 誠實告知無資料**

產品、規格、操作、故障、通路、價格、服務資訊等具體問題，禁止用 LLM 通用知識自行補答案。只有一般寒暄或非事實性文字整理，才可不帶資料來源。

### 開發鐵律 (Do's and Don'ts)

1.  **Fast Mode 優先**: 所有問題必須先走 Fast Mode (QA + RULES)。只有 Fast Mode 答案不足、使用者明確要求查手冊、或型號選擇後進入手冊流程時，才允許進入 Deep Mode。
2.  **禁止盲目與官方搜尋**:
    - **禁止**搜尋官方公告、韌體更新、驅動程式 (由使用者在 QA 維護)。
    - **禁止**在「什麼是 HDR」等通識問題進入 PDF Mode。
3.  **防止型號汙染**: 必須嚴格遵守 `hasInjectedModels` 邏輯，避免一次載入多個不相關型號的 PDF。
4.  **源頭淨化**: 在 `handleMessage` 與 `testMessage` 入口處，必須強制檢查並轉型輸入資料，防止 `[object Object]` 或非字串導致的崩潰。
5.  **型號驗證**: Context 中找不到的型號必須拒答或要求補完整型號，嚴禁用 LLM 通用知識編造規格。
6.  **Quick Reply 按鈕命令以 # 開頭**: 所有按鈕 text 必須以 `#` 前綴開頭（如 `#再詳細說明`、`#查手冊`、`#搜尋網路`），讓 handler 能正確攔截。
7.  **變數作用域注意 (TDZ)**: V8 引擎中 `const` 有暫時性死區 (TDZ)，在同一 block 中 `const` 宣告前賦值會拋出 `ReferenceError`。Quick Reply handler 如不 `return` 而是讓流程繼續，禁止提前設定後面用 `const` 宣告的變數。
8.  **Prompt 維護鐵律**: 修改 Prompt 時必須明確告知使用者，並由維護者更新 Google Sheet `Prompt!C3`；除非使用者明確要求，程式部署不得同步或覆蓋 `Prompt!C3`。
9.  **正式部署鐵律**: 更新 GAS 時必須更新既有正式 Deployment ID，不得新建正式 deployment；部署後必須用 `check_deploy_readiness.ps1` 或 `check:webhook-version` 驗證正式版本。
10. **發布總控鐵律**: 若要完成一輪正式發布，優先使用 `tools\release_existing_webhook.ps1`；它會先跑靜態守門，再呼叫既有部署更新流程，最後驗證正式 Webhook 版本。此流程不得同步或覆蓋 Google Sheet `Prompt!C3`。

## 6. 檔案整併說明 (File Consolidation)

本專案已將歷史文檔整併，所有開發邏輯請以本文件 (`AI_CONTEXT.md`) 與 `程式編寫開發及功能手冊.md` 為準。以下舊文件已廢棄：

- `LLM_LOGIC_HISTORY.md`
- `PRIORITY_LOGIC_ARCHITECTURE.md`
- `progress.md`
- `v27.3.3_INTEGRATION.md`
