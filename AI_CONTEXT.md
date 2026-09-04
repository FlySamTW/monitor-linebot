# Samsung LINE Bot 專案 AI 協作指南 (Project Context for AI Agents)

## v29.6.291 現行最高優先契約：網搜不可空轉，也不可把猜測冒充答案

- 真正執行 Google Search 後，即使供應商沒有回傳可逐句綁定的非官方引用，也必須從本輪草稿中只保留低風險、可逆的排查動作；凡含「可能／通常」、購買、其他型號、工程模式、韌體、產品能力、規格或數值的整句全部淘汰，不能拆掉危險前提後留下半句。
- 若沒有任何安全動作，就依題型給不靠猜測的現場驗證方式、官網／三星客服或請 Sam 補 QA；不得顯示內部搜尋失敗，不得要求同來源重按。精確產品事實仍需 QA／RULE、正確 PDF 證據或 Web 同來源支持。
- PDF rescue 與直接 Web 共用相同終點；模型、Router 啟動頻率與來源呼叫數皆不增加。證據完成語意已變更，`ADVANCED_SOURCE_CACHE_SCHEMA=EvidenceV8`。

## v29.6.290 歷史契約：Grounded Web 安全有用終點

- `groundingChunks + groundingSupports` 已存在但 exact-model／完整主張驗證未通過時，不得說成「網路沒結果」。只能從支持句段抽取不含產品能力、規格、數值、購買、韌體、工程模式與推測的低風險操作動作，明示非官方且型號適用性未完全確認。
- 未驗證 `rawResponse` 仍不可轉交；精確產品事實仍需 exact-model 同來源支持。PDF rescue 與直接 Web 共用此降級契約，`ADVANCED_SOURCE_CACHE_SCHEMA=EvidenceV7`。

## v29.6.289：Router 最小啟動、實際模型與合計費用可見

- G8／M8／M7 等短稱一旦由 CLASS_RULES 解出系列與候選，`seriesAliasResolved=true`，不得呼叫 Router 重做產品身分分類。RULE 共識可直接答；型號相依題由確定性候選選單處理。
- 一般提問的完成鏈為 `QA／RULE／已驗證片段 → 可用手冊 → Web`。Fast 的 `[AUTO_SEARCH_WEB]`、AnswerEnvelope `unsupported/partial` 且無可直接執行手冊時，必須自動進唯一 Web SourceOperation，不再產生「是否搜尋」確認輪。正常自動 Web 計每日 5 次；PDF 失敗的同次 rescue 仍不扣使用者 Web 額度、每日最多 3 次。
- Web 有 grounding 才能把產品事實當答案；沒有精確證據時禁止假稱已證實，但使用者端不得只看到搜尋失敗。終點至少包含已確認部分、明確標示未證實的低風險排查方向、官網或請 Sam 補 QA，且不可顯示同來源重試形成迴圈。

- 每則正式回覆最後一行必須由 request audit 顯示合計費用與實際模型；零生成顯示 `未使用模型`。不得讓模型自行聲稱使用哪個模型，也不得只顯示最後一階段而漏掉 Router。
- 成本以 `usageMetadata` 的 input、candidate output 與 thinking（按 output 計價）累加。2026-09-04 官方 Standard 價格已複核：2.5 Flash-Lite 0.10／0.40、2.5 Flash 0.30／2.50、3.7 Flash 0.75／3.75 美元／百萬 tokens；3.7 優惠至 2026-12-31，屆時必須重新校價。台幣匯率 32 為近似值，對外固定顯示「約」。

## v29.6.288 歷史契約：Router 最小啟動、手冊命名與通用操作證據

- Router 不是每題必經站。完整型號的明確手冊題與明確時效 Web 題由程式直接決定來源，`routerCalls=0`；只有真正語意歧義、尚未規劃的省略追問、模糊產品或複合主張才用一次 3.7。
- 同一 canonical topic 已保存 claims 後，後續短句追問沿用既有規劃，不得每輪重叫 Router。Google Cloud 實帳 2026-07／08 分別為 NT$46.18／NT$21.95，成本評估必須用台幣月總額，不得把帳單 `$` 誤當美元或只用單次倍數製造錯誤印象。

- M7／`S32CM703UC` 只選 `S32CM703.pdf`；G95SD／`S49DG952SC` 只選 `S49DG952.pdf`。舊 `S32CM703,S49DG952.pdf` 為回復資產，不得進正式候選。
- 繁中 UM 永遠優先；Samsung 台灣支援頁沒有繁中時才可退到英文 UM，但 TW area、`UNI_TW`、UM、格式、首頁、SHA 與 provenance 仍全部必須通過。`S24F332.pdf` 是正例；封面 `S24F33*` 只能在官方 SKU/download `ModelName` 精確一致且星號只對應一碼時綁定，並標記 `exactModelInDocument=false`。
- `S27F612` 官方下載是 `NASCA DRM`、不是 PDF，禁止偽裝後進 RAG。`S27H802EFA` 完整型號能力列必須進 H 世代覆蓋稽核；系列、術語、短別稱與 key/model 錯配列不得污染 coverage。
- support-page-only 共用手冊的 structured evidence 必須帶 `pageHeading` 與 `applicabilityExcerpt`，並與摘錄一起做 family／model scope 驗證；其他系列、其他型號與 Odyssey Ark 專屬頁 fail-closed。
- 基本人工輸入切換可用通用「選擇已連接外部裝置／訊號源」段落回答使用者指定的 HDMI 1/2、DP 或 USB-C；不得藉此宣稱支援、埠數、版本、頻寬或任何規格，也不得套到 Auto Source、PIP／PBP、KVM。
- `Reset All／重設所有設定`屬非選配的通用手冊操作，可在 support-page family pattern 的 SHA 驗證文件中採用全檔共通段落；選配功能仍要求型號級 QA／RULE 或同段型號證據。
- 重設題的 PDF 搜尋詞必須依完整型號 RULE 分成 Tizen 與一般 OSD；未明載 Tizen 時不得注入 Smart Monitor 選單詞，也不得移除使用者原題。
- `Reset All` 契約以「重設／還原動作＋全部／所有設定」組合判定，不可列舉單一中文詞序。
- `ADVANCED_SOURCE_CACHE_SCHEMA=EvidenceV6`；清除舊的錯誤未完成快取，模型與呼叫數不變。

## v29.6.284 歷史契約：精確手冊鎖、證據驗證與來源完成度

> 本節優先於下方全部歷史版本。v29.6.282 保留 PDF 選檔、provenance 與系列共識；手冊證據 validator 的 production dependency 與 Web 補救終點以本節為準。

- 手冊 feature validator 使用的 regex escape 必須由正式程式提供並納入測試，不得只在測試 VM 注入 stub。
- 任何手冊輸出格式、頁碼、摘錄或適用範圍驗證失敗，必須在同一輪觸發一次受控 Web rescue；禁止只回「接著補查」而沒有實際 `webCalls`。
- evidence validator／完成狀態契約變更時必須提高 `ADVANCED_SOURCE_CACHE_SCHEMA`；不可只提高 `GAS_VERSION`，因來源快取刻意可跨程式版號重用。

- 已確認完整型號是 PDF strict lock；KEYWORD_MAP／系列別稱不得再把兄弟機種加入附件。最終附件必須通過 exact-model allowlist，扁平 `PDF_MODEL_INDEX` 不得在實際 URI／inline 缺檔時宣稱可用。
- PDF URI 的 recovery、rolling refresh、full sync 與 manual merge 必須走相同 provenance 契約：manifest 綁定文件利用本輪 blob SHA 驗證並保存 `officialSha256`；重用 URI 保留既有已驗證 SHA；support-page-only 缺 SHA 或 mismatch 即拒絕。已知錯誤共用檔預設排除，不能因沒有 focused manual 又重新掛回。
- PDF evidence 驗證同時核對 original question：答案必須包含使用者明示的功能／介面編號、必要操作或數值；只有相近頁面或泛用控制說明不能算 full。
- Web rescue 的 `originalQuestion` 與 `searchQuery` 分離，輸出 `full / partial / none`、`groundingPresent` 與 rejection reasons。有來源的低風險通用排除可作 partial；精確型號能力／數值仍要求同來源 exact-model evidence。不得把 grounded-but-not-targeted 誤寫成完全搜尋不到。
- `系列_／別稱_` 只界定候選型號。系列技術／規格題只有在所有候選完整型號的精確 RULE 都有該欄且正規化值一致時才直答；任一缺值或不同即選型。操作、排障、模式限定與可選功能永遠不以系列共識代替 PDF／QA。
- 本版不更換任何模型、不增加 Router／PDF／Web 呼叫，也不遷移 File Search。

## v29.6.281 官方手冊來源鏈、術語本體與原子證據

### 2026-09-04 手冊治理補充

- 官網複核結果：G95SD／`S49DG952SC` 最新仍是 2024-10-02 v2312130 共用 e-Manual ZIP，繁中 PDF 與舊 `S32CM703,S49DG952.pdf` bytes 相同；舊合併檔保留回復，但正式選擇排除並以單型號文件優先。它未在內文明列 G95SD，不能作該型號 capability／operation 的專屬證據。
- M7／`S32CM703UC` 已有 2026-01-16 v2510220 新繁中 PDF，並已加入 `config/manual_registry.json`。空白封面手冊必須同時核對官方支援頁 SKU、下載網址 `ModelName` 與 SHA／provenance，且記為 `exactModelInDocument=false`。
- 「依型號可能不支援」只能在 QA／RULE 或同段型號明列另有正向證據時肯定；否則保留未知。ZIP 不得直接進 PDF index，須先解出並驗證 PDF。Registry/schema、唯一性、來源、PDF header、SHA 與來源綁定均 fail-closed，索引採 staging 驗證後原子發布。
- 日常自動查新與 Files URI 更新不需 `/重啟`；本次手冊治理不變更 Router、Fast、PDF、Web 模型與呼叫策略，沒有新增成本路徑。
- 所有會產生回覆的一對一 LINE 文字、圖片及來源 postback，都要在路由前啟動一次等待動畫；旗標必須每個 webhook 事件重設，不能只在 PDF／Web 分支啟動。群組／多人聊天室因 LINE API 不支援而略過，TestUI 不呼叫 LINE API；不得以 Push 模擬等待。
- v29.6.281 起現行每日額度為一般 10 題、官方手冊 2 次、網路解答 5 次；本列覆蓋下方歷史 20／5／10。三者仍獨立計數，轉進階來源會退回本輪一般額度，系統 Web rescue 的每日 3 次上限不變。

- 固定入口順序：控制／產品身分／精準 QA／完整 RULE／人工核對 Evidence 先行，完整命中立即結束，`routerCalls=0`。只有模糊型號或系列、複合 claims、省略式自然追問、部分覆蓋或規則衝突，才可呼叫一次條件式 Router。
- Router 為 `models/gemini-3.7-flash`，只用 `thinkingLevel: low`、Structured Output、短 context，無搜尋／PDF／Web／其他工具，也不允許 `answer` 欄位。它只能拆主張、判斷話題關係與從程式候選 index 選型；不能產生產品事實、決定扣次、指定文件或覆寫持久狀態。
- 回答模型維持分流：Fast=`models/gemini-2.5-flash-lite`；PDF／Web=`models/gemini-2.5-flash`。來源政策仍由程式按 `QA／RULE／verified Evidence → PDF → Web` 執行；本版未遷移 Google File Search、未增加背景搜尋或第二次潤飾。
- 已知完整型號的未解操作／手冊型問題，Router 高信心分類或安全 fallback 都只能交 manual，不得回 Fast 猜答案。精準 QA／RULE 已完整回答則不可再呼叫 Router、PDF 或 Web。
- 術語資料採三層契約：`definition` 只解釋名詞；系列／型號 `capability` 必須精確 scope；`operation` 必須再綁同一 canonical 型號的官方手冊路徑證據。CoreSync、Core Lighting+、Infinity Core Lighting、Eclipse Lighting／Eclipse Sync 不得互換，也不得由 definition 推論機種支援。
- 2026-09-04 Samsung 台灣官網盤點快照為 154 筆 `術語_` 與 9 筆 `能力_完整型號`；154 筆中包含 `術語_OdysseyHub`、`術語_MiniLED`、`術語_AIUpscaling` 三個舊雲端 key 的安全 legacy alias。術語列可新增正式名與口語 aliases，但不能回答型號支援；首頁的 FHD、更新率、反應時間、曲面、內建喇叭、Smart TV、USB-C 視訊等上位詞也是 definition-only。能力列必須含 canonical `model`、`capabilities`、`checkedAt` 與官方 `source`。Pro／Plus／Premium 等後綴及相似功能必須分列，系列 alias 只產生候選。
- 共用手冊 evidence 只要含「依型號而定／可能不支援／部分型號」而同段沒有正向綁定目標完整型號，即判為不適用，不能支持 capability 或 operation。功能名稱也須同一 canonical feature，不得用另一種燈效回答。
- Web support/chunk 必須保留來源 ID；只有同一來源同時支持 canonical 型號與本題主張才可輸出肯定結論。禁止用不同網站跨站拼 evidence，也禁止將無引用模型草稿改寫成「可能做法」交付。
- `SRC_PRODUCT` 跨日保留 confirmed model、canonical topic 與最近成功 advanced result；新完整型號或管理員 `/重啟` 清除。省略追問先還原持久型號與主題，不可只存問題文字或借錯前題。
- 進階結果的重用身分為 `Asia/Taipei 日期＋來源＋canonical 型號＋正規化主題＋Evidence schema＋來源 fingerprint`，不再以 `GAS_VERSION` 或臨時 route-plan hash 當內容身分。相同身分可跨輪免重複呼叫／扣次；新題、新型號、新日期、schema 或來源 fingerprint 變更即失效。
- PDF fingerprint 必須包含 Drive fileId、updatedAt、size／identity；同步時若 Drive 文件內容／時間／大小改變，即使檔名相同也須重新上傳並刷新 Gemini Files URI。禁止重用與 Drive 現況不一致的舊 URI 或舊回答。
- G9 後方燈效事故的 LOG 有五次 PDF 呼叫；根因是舊證據適用性與術語等價契約，不是 PDF 完全沒有執行或只靠模型升級即可解決。v29.6.280 目標是結構性阻斷這批已知錯誤類型，不得對外宣稱能根除所有幻覺；無足夠證據仍須明示未知並走安全終點。

## v29.6.279 競品範圍守門前移

- 競品螢幕比較是 deterministic 資料邊界，必須在一般「含螢幕／配件字樣即放行」之前攔截；跨裝置連接三星螢幕的問題仍屬專案範圍。
- 攔截後以店員同儕口吻說明缺乏可靠它牌資料，零 Router／Fast／PDF／Web 呼叫，且不得顯示「再查網路」形成無終點流程。這是全域分類修復，禁止再塞品牌或題目特例到 Prompt。

## v29.6.278 店員同儕角色一致化

- Fast、Router 與終端安全訊息的唯一使用者角色是三星螢幕門市店員的內部同儕助手，不得再以「台灣三星官方客服」自居或套客服道歉範本。
- 時效資訊缺本機證據時直接交程式既有 Web 守門，不再要求店員二次確認；此變更不新增模型、搜尋工具或來源呼叫。

## v29.6.277 條件式 RouteAnalysisV1 主張規劃器

> **v29.6.277 當時契約（歷史）**：保留當時設計背景；現行實作若有衝突，以最上方 v29.6.280 契約為準。

- 角色是店員內部同儕助手，不是對外客服。用台灣口語、可自然直呼 Sam，不使用制式敬語；稱呼要自然且節制。客戶不可看到 Router、claim、schema、confidence、fallback、token 或其他程式術語。
- 不得每題先呼叫 Router。指令、postback、明確來源按鍵、精準 QA、完整 RULE 與人工核對片段都由 deterministic path 直接完成，`routerCalls=0`；只有模糊型號／系列、自然追問、複合主張、局部覆蓋或規則衝突才可呼叫一次。
- Router 固定為 Gemini 2.5 Flash-Lite、thinking=0、Structured Output、無工具、無搜尋、無 PDF、無答案欄位、零重試。它只能從程式候選 index 選型與拆出 claims；逾時、429、格式錯誤、低信心或語意驗證失敗一律 fallback，不得自行回答、扣額度、授權來源或覆蓋型號狀態。
- 正式來源政策仍由程式執行：`身分／免費證據 → QA／RULE → PDF → Web`。`conditional` 接管後，舊 `[AUTO_SEARCH_PDF]`／`[AUTO_SEARCH_WEB]`／`[NEED_DOC]` 僅可作 fallback 或稽核，禁止成為第二決策者。
- 一般題在 `conditional` 模式若通過 schema、候選、信心與狀態驗證，由程式政策直接完成必要來源鏈，不再停在「請再按手冊／網路」；Router 本身仍無授權權力。明確來源按鍵直接執行該來源且 `routerCalls=0`，缺型號只選一次後續跑原題。
- 分類不確定時只能自然釐清一次，問題要讓店員看得懂且能立即回答；第二次仍不確定就安全收尾，可說「我先幫你記給 Sam」，但不可宣稱已通知或已建單。釐清／補型號 pending 保存原題 10 分鐘；期限內回覆必須沿用 originalQuestion，零新增一般額度，禁止把型號答案當新問題。
- `SEMANTIC_ROUTER_MODE` 僅允許 `off|shadow|conditional`，v29.6.277 正式預設為 `conditional`；Shadow 不改回答與額度，明確 `off` 才停用。TestUI 的 `?router=` 是 request-scoped 測試開關，不得改寫全域 ScriptProperties。
- 每個主張的答案必須綁定同筆來源、型號範圍、頁碼／網址、摘錄與限定條件。PBP「兩側＋120Hz」須在同一證據明文形成關係，禁止把 PBP 段落與另一處整機最大更新率拼接成結論；partial 只把未解 claim 送下一來源。
- Web 精確數值 evidence 必須命中 canonical 完整型號；系列名、同系列其他型號或相近產品只可支援低風險排除方向，不可證明本型號的更新率、尺寸、介面數量、功率或 PBP 每側數值。無 exact-model 關聯就標示未證實並停止肯定推論。
- 多 claim 執行固定為：先收集免費 QA／RULE／verified Evidence anchors；未解的 `manual_model_specific` 合併成一次同型號 PDF；`web_current` 與 PDF 隔離，Web-only 直接一次 Web，手冊＋Web 混合題則 PDF 完成後只將計畫性 Web claims 合併查一次。不得逐 claim 重複呼叫同一來源，也不得讓 Web claim 污染 PDF prompt。
- 配額固定為：Router／選型／preflight 零來源扣次；轉進階來源時一般 10 題 hold 只退一次；PDF 真送出扣手冊 1，計畫性 Web 真送出扣 Web 1。混合 plan 可扣手冊 1＋Web 1，但不可再扣一般題。手冊因無證據／缺檔／pipeline error 才產生的系統 Web rescue 不扣 Web 5 次，另受每日 3 次上限且不可回 PDF；原 plan 已有 `web_current` 時仍屬計畫性 Web，不能套用免額度。供應商送出後 no evidence 仍算一次；送出前守門失敗與 operation cache 命中不扣。
- 現況仍是 Gemini Files API 選定單一正確 PDF 後以 `file_data` 掛入 2.5 Flash，不是 File Search。本版不換模型、不新增搜尋工具；File Search 必須另案以固定手冊題 A/B，不能與 Router 同版遷移。
- 稽核需保留 `routerCalls、routerCacheHits、plannerLatencyMs、routerCostTwd、routePlanValid、claimRoutes、selectedModel、pdfCalls、webCalls、finalCoverage`。正式接管前須達 Router JSON 有效率 99%、單次成本不超過 NT$0.01、P95 額外延遲不超過 2 秒、固定 20 題至少 19 題到達正確終點，且所有安全關鍵題 100%。
- Router 輸入邊界為原題 500 字、上一主題 300 字、候選 20、evidence ID 8；最多 5 claims，輸出上限 384 tokens，目標約 800～1,500 input／50～100 output。Flash-Lite Standard 單價為 US$0.10／M input、US$0.40／M output，常見估算約 NT$0.003～0.006，實際以 `usageMetadata` 為準。
- Router cache 為 600 秒；相同題目＋前題＋型號＋候選＋本機覆蓋＋KB 版本命中時 `routerCalls=0 / routerCacheHits=1 / routerCostTwd=0`。HTTP 2xx 已生成但 schema／候選／低信心失敗仍依 usage 計成本後 fallback；送出前失敗或沒有 usage 時只記錯誤與延遲，不虛構費用。429／5xx 不重試，現行非 2xx 只記 HTTP error／latency，不自行推估費用。
- Apps Script 版本容量逼近 200；先以 HEAD／request-scoped TestUI 驗證，正式發布前盤點與保留回復版本，不得用 Shadow 測試反覆建立正式版本。
- 真人旅程已驗證：`零售模式 → 補完整型號` 在 10 分鐘 pending 內沿用原題、不重扣一般額度，最後以官方手冊第 170 頁完成回答；PBP 測試亦證明 exact-model Web guard 會拒絕系列／相近型號數值，只保留真正對應完整型號的證據。

## v29.6.276 PDF Evidence 數字與完整句契約

- `manualSupportedAnswerMatchesExcerpt_` 核對規格數字前，必須排除已由模型適用性函式另行驗證的完整型號／系列別稱數字；不得再因 `S57CG952NC` 的 57／952 未出現在共通章節摘錄而丟棄正確證據。真正回答主張中的 120Hz、98W 等數字仍必須逐字受摘錄支持。
- PDF 位置題必須先查目錄與命中章節，輸出 `功能分類 → 設定項目`；Web 未引用安全補救必須保留完整可執行句，禁止逗號切割造成無主詞殘句。
- 此修復不得演變成 PBP 或特定型號的答案 hard-code；模型與付費契約仍是 2.5 Flash-Lite（Fast）、2.5 Flash（PDF／Web）、thinking=0。

## v29.6.275 固定題庫、主張覆蓋與 Files URI 生命週期

- 回歸必須使用固定 20 題多輪題庫，分開記錄產品身分、檢索來源、證據覆蓋、答案品質、延遲與成本。不得看到某題失敗就新增該題字串、Prompt 特例或產品專屬路由。
- 系列共同身分可由所有候選 RULE 一致性直接回答；規格／操作會隨型號變動時才選完整型號。PBP、雙模等限定值只有 RULE 同欄明載兩組完整數值才可零成本回答，否則查手冊，不得拿整機最大值代答。
- 已核對 `manual_chunk` 數量小，固定掃描完整片段集合再依型號與意圖排序，避免倒排索引因地區尾碼差異漏件；回答覆蓋不足仍須進整本 PDF。
- PDF Structured Output 以 `coverage=full/partial/none` 表示每個明示主張是否完成。入口題沒有實際路徑、故障題只有預防資訊、比較題少一項，都只能 partial；Web rescue 必須保留已驗證的手冊部分，再補未解主張。
- PDF prompt 只保留單一 JSON 證據契約；移除同輪又要求自然文字、來源標記與 `[AUTO_*]` 的舊衝突。短追問只在有代稱／延續語或與上一答有實質主題重疊時帶前題，獨立短題不得污染。
- 正式仍用 `gemini-2.5-flash-lite`（Fast）與 `gemini-2.5-flash`（PDF／Web），thinking=0。現況是 Gemini Files API 精確型號選檔後整份 PDF `file_data`，不是 Google File Search store；本版未換模型或 API。
- Files URI 以每 4 小時 10 本輪替續期，約百本在 40 小時內完成一輪；每日 04:00 只做規格／索引增量同步。403／404 仍先修本題單檔，失敗只標記指定檔背景續期，不得為一檔重傳整庫。

## v29.6.274 結構化 QA 可信命中不得被選型攔截

- QA scorer 除原本 68 分門檻外，允許「完整型號或系列別稱命中＋至少兩個結構化意圖詞＋分數至少 55＋領先第二名至少 8 分」直接回答。這是資料驅動契約，禁止為單題新增路由或 Prompt 特例。
- 身分解析不是一律先問完整型號；精準 QA 能以系列層級安全回答時應直接完成。只有 QA／RULE／已核對片段確實不足，才進完整型號選擇與 PDF。
- Fast 仍為 Gemini 2.5 Flash-Lite；PDF／Web 仍為 Gemini 2.5 Flash、thinking=0，本版不增加呼叫或費用。

## v29.6.273 產品身分解析先於 QA、RULE 與來源

- 身分優先序固定為：本輪完整型號 → 型號前段 → 系列別稱 → 具名家族 → 比較脈絡 → 跨日持久型號。明講 Smart／Odyssey／ViewFinity 或新別稱時，不得先把舊產品附加進題目；衝突只暫停本輪沿用，直到選定新完整型號才覆寫。
- 句首 `Smart` 且未給 M5/M7/M8/M9 時，只補問一次系列代號並保留原題；回覆代號與後續完整型號選擇均不得重複計入每日 20 題。相容別稱可直接沿用已鎖定完整型號，不相容時必須重新選型。
- 不完整型號由 CLASS_RULES 全集合收斂；候選狀態保存最多 50 款、LINE 每頁 8 款。一般問答候選不要求 PDF，手冊來源候選必須再與正式 PDF 索引取交集。
- 操作題不可在 QA 前直接升級。順序為精準 QA／精確 RULE／已核對片段，仍不足才進整本 PDF；`priorFastChecked` 不得只是沒有證據的 true。這是通用路由修復，不得新增題目特例或 Prompt 補丁。
- 模型與費率不變：Fast 2.5 Flash-Lite，PDF／Web 2.5 Flash、thinking=0；未新增供應商呼叫。正式 `Prompt!C3` 與本機 Prompt 內容仍為 v29.6.272，因本版沒有 Prompt 行為變更。

## v29.6.272 規格比較需回答選擇意圖，但不可越過證據

- 問「怎麼選」時，在逐欄 RULE 後補零模型選擇摘要；只使用同答已列的明列／未列與可解析數字，不引入面板偏好等外部常識。
- 不得為單一型號配對硬寫推薦；新比較維度先進通用 claims 與測試，再決定是否有安全摘要規則。
- v29.6.272 正式證據：規格比較零呼叫完成；S32D806 自然 KVM 追問只掛正確單一 PDF，命中第 17、19、21、33 頁，`pdfCalls=1 / webCalls=0 / thinking=0`。本輪總成本約 NT$1.9696。

## v29.6.271 候選縮選不得忽略年份

- 型號世代 T/A/B/C/D/F/H 可用於 2020–2026 年份比對，RULE 明文年份優先。年份與既有規格信號同為 AND，不得留下已知錯年份候選。
- 同一年仍有多個版本時讓使用者選，禁止用排序猜。新增年份應擴資料映射與契約，不要新增系列特例或 Prompt。

## v29.6.270 正式 TestUI 載入是唯讀，不得自動清聊天室

- TestUI reload 需保留同一 sessionStorage `TEST_USER_ID` 的產品、比較、來源與配額狀態；不得在 `window.onload` 呼叫 `clearTestSession()`。
- 需要隔離案例時由 runner 顯式呼叫清除，真人驗收則由「重置」或 `/重啟` 明確執行。不要再用重新整理假冒新聊天室。

## v29.6.269 PDF 單訊息成本控制與自然追問不可二選一

- 自然省略追問只附前一個 user turn 的精簡主題，仍維持單訊息與低 token；獨立新題禁止帶舊歷史。不要恢復整段 PDF 歷史，也不要再次把前題功能術語全部裁掉。
- 手冊 evidence 的完整尾碼只可對齊裸核心 target；兩個已有完整尾碼的型號不得用前綴視為相同。
- 操作語境的 DP／HDMI／Type-C 不等於使用者重新索取規格；沒有明確規格問詞時不得把 RULE 長文合併到手冊回答。

## v29.6.268 手冊證據有效仍要符合本題資訊需求

- 純問選單／設定入口時，只顯示已驗證的入口或必要進入步驟，最多 2 筆；不要把圖示 OCR、模式限制或未問細節當成「越多越好」。
- 故障排除題不得套用入口精簡，以免刪掉必要步驟。篩選只在 Evidence Guard 之後進行，不能讓未驗證內容回來。
- 禁止為單一產品功能加路由；此規則由自然問題意圖驅動，且不得增加模型呼叫或重新讀 PDF。

## v29.6.267 PDF 回答只能由逐筆已驗證 evidence 組成

- Structured Output 的每筆 evidence 同時承載一項 `supportedAnswer`、頁碼、scope 與同頁摘錄；禁止重新使用頂層 answer／operationPath，否則主張與證據會再次脫鉤。
- 部分有效時只丟棄無效主張，不得因 1 筆錯型號 evidence 把其餘正確答案一起丟掉。只有 0 筆有效才啟動既有 Web 補救。
- 同頁多主張按答案內容去重，頁碼獨立彙整。摘錄外數值、無直接證據的否定句、錯型號、網址、內部 marker 與矛盾 `found=false + evidence` 都必須拒絕。
- 此契約不得增加模型呼叫或改用較貴模型；Fast/PDF/Web 的既有模型與 thinking 設定維持不變。

## v29.6.266 自然追問解析出的型號不得在來源授權時倒退

- `msg`、`routingQuestion`、`SRC_RECENT.model` 與 manual/web pending 必須指向同一個本輪已確認完整型號。比較代稱或跨日產品狀態解析成功後，不得再讓舊 `suggested_models` 覆寫。
- 操作分類必須涵蓋自然語序，不可只認「打開選單」而漏掉「哪個選單打開」；完整型號操作題仍走零成本 QA/RULE 預檢，未命中就自動 PDF。
- `SRC_OP` 只在同版本去重；新 `GAS_VERSION` 必須重新建立證據，禁止重播上一版快取。不得用升級模型、加 Prompt 特例或增加呼叫掩蓋狀態錯誤。

## v29.6.265 手冊 schema 與證據驗證不得互相矛盾

- `getManualStructuredResponseSchema_()` 允許 `型號明確／全檔共通／依型號而異`；normalizer 必須接受同一集合，但後兩者的安全語意不可混淆。
- `依型號而異` 只有在 evidence excerpt 可直接核對目前 target model 時才有效；錯型號或未摘入型號仍回 validation error。混合共通與型號專屬證據的輸出 scope 必須是「型號明確」。
- 不得因部分證據無效就任意保留整段 answer；在沒有 claim-to-evidence 對應前仍維持全證據通過才完成。這版只修正 schema 已允許但 validator 誤拒的合法目標證據。

## v29.6.264 選型、比較與追問必須共用資料狀態

- 系列候選要先從完整 CLASS_RULES 集合取回，再用首句規格描述縮選，最後才截畫面數量；手冊候選額外要求實際 PDF 索引覆蓋。禁止恢復「先取前 10 款」或無 PDF 時退回全部 RULE 候選。
- 顯示候選後，純描述可在當前候選內縮小；完整功能新題必須結束舊 pending。`#型號:` 只接受本輪候選，合法點擊不可被前置清理，舊泡泡也不可清掉目前題目的退款 hold。候選、題目、模式 TTL 統一 600 秒。
- 比較回答依原題要求的每一欄輸出兩款的明文 RULE 值或「官方規格未列此項」，不得再用固定少數欄位提前返回。比較後前者／後者與唯一尺寸描述可直接解析；「這台／它」不明確時沿用既有 fast 選型狀態，列原兩款並接回追問。
- 跨日單一產品記憶仍保留；比較暫存只有 30 分鐘且不覆寫單一產品，落到單一型號或 `/重啟` 即清除。不得用 Prompt 或題型特例取代這套狀態契約。
- 模型與成本分工不變：一般 Fast 為 Gemini 2.5 Flash-Lite；PDF／Web 為 Gemini 2.5 Flash、thinking=0。任何後續改動都要證明沒有新增供應商呼叫。

## v29.6.263 共用 PDF 必須驗證目前型號適用範圍

- 「正確掛載手冊」不等於手冊內每一圖表都適用目前型號；多型號共用 PDF 的每筆型號明確 evidence 必須在摘錄中可核對目前完整型號或去區域尾碼本體。
- 摘錄出現其他型號而無目前型號時必須拒絕；封面型號清單不是功能證據。全檔共通只能用於無型號專屬限定的公用內容。
- HG802／HG806 USB-C 差異已存成 QA2 `manual_chunk` 資料與頁碼；這是資料層證據，不得再增題型特例或放寬型號守門。
- 修正不得變更 2.5 Flash-Lite／2.5 Flash 分工、呼叫次數、額度或價格公式。

## v29.6.262 Web 系列身分不得綁死字詞順序

- 外部內容的 `Smart Monitor M8`、`M8 Smart Monitor`、`智慧螢幕 M8`、`M8 智慧螢幕` 視為同一候選身分，但仍須由目前完整型號自己的 CLASS_RULES 精確列確認 M8。
- 近距離正反語序相容不能放寬成單獨 `M8`；錯家族、M7 與其他型號仍拒絕。

## v29.6.261 Web 外部系列名稱必須綁定精確 RULE

- grounding 支持內容可用完整型號、去地區尾碼型號，或目前完整型號的 CLASS_RULES 精確列明載之正式系列身分。
- `Smart Monitor M8` 只可對上 RULE 明載 M8 的型號；不得接受 `Odyssey G8`、M7 或其他相近系列。
- 系列只出現在完整搜尋回應時，僅低風險故障排查可銜接引用步驟；拆機、刷機、破解及非官方韌體永遠拒絕。
- 此為本機證據驗證修正，不得因此增加 Gemini／Web 呼叫、改模型或降低 grounding／focus 守門。

## v29.6.260 已知型號的操作題不再先花 Fast

- 操作問法覆蓋在哪、哪裡開、去哪、位置、怎麼開等說法。
- 精準 QA 與精確 RULE 未完成，且完整型號已知時，操作題要退回一般額度，零 Fast 直接進手冊。
- 規格 RULE 必須先有終止機會，否則 VESA 等純規格題會回歸成 PDF。

## v29.6.259 介面時序題必須略過無關手冊片段

- 已驗證的 Dual Mode 操作片段不能回答特定 HDMI／DP／USB-C 的最高輸入時序。
- 介面×解析度／更新率題需要完整 PDF 訊號表；精準 QA 未命中時，禁止片段提前 terminal return。

## v29.6.258 介面訊號時序不得用獨立 RULE 拼答

- HDMI／DP／USB-C／Thunderbolt 的版本、最高解析度與最高更新率，不代表可在該介面下同時達成。
- 精準 QA 未命中後，指定介面的解析度／更新率題必須零 Fast 直接查 PDF 訊號時序表，並退回一般題額度。
- 純端子數量題仍由精確 RULE 零成本回答。

## v29.6.256 手冊候選可用自然規格描述選型

- pending 已有 `manualModelCandidates` 與 `draftQuery` 時，先辨識使用者是否在描述候選（尺寸、解析度、面板、平／曲面、更新率、雙模等），不得直接把描述覆蓋成新問題。
- 只在實際有 PDF 的 pending 候選內，以 CLASS_RULES 精確列做 AND 交集；唯一命中才自動選型，零／多重命中保留原題與候選，不猜型號。
- 描述選型零模型、零來源呼叫、零扣次；真正執行必須沿用共用 `executePendingManualModelSelection_()`，以「完整型號＋原 draftQuery」續跑。

## v29.6.255 Gemini usage 費用必須包含思考 token

- Gemini API 的計費輸出必須使用 `candidatesTokenCount + thoughtsTokenCount`；不得只用畫面可見的回答 token 估價。
- 全專案 Gemini `usageMetadata` 計價統一呼叫 `calculateGeminiUsageCost_()`，並分開保留 candidate、thought 與 billed output，避免後續模型預設值改變時再次漏算。
- Request Audit 同步記錄 `outputTokens`、`thoughtTokens`、`billedOutputTokens` 與估算台幣；固定匯率仍是估算，真正帳單以 Google Cloud Billing 為準。
- 本版不換模型、不改 Prompt 本文、不改 `generationConfig`、不增加供應商呼叫；只是把既有呼叫的費用顯示算完整。

## v29.6.254 自然追問的型號與 RULE 證據不得斷鏈

- 自然追問即使沒有重打完整型號，精確 RULE 路由仍須使用已鎖定的 `primaryModel`；能由本型號規格回答時，必須在 Fast／PDF 前零模型完成。
- 標準 HDMI 與 Micro HDMI 接頭互插題採資料驅動：先確認本型號實際有 Micro HDMI，再讀同列配件欄；只有欄位明載 HDMI 轉 Micro HDMI 線時，才可說盒內隨附。
- 不可讓 Fast 已答對後因原句缺型號而被 AnswerEnvelope 刪除，也不可把沒有配件證據的線材說成隨附。

## v29.6.253 LINE 回覆封裝與跨版冪等

- `quickReply.items` 為空時必須完全省略 `quickReply`；builder 與 `replyMessage()` 最後出口都要 fail closed。TestUI 不呼叫 LINE API，故必須有獨立契約測試，不能以 TestUI 顯示正常取代正式 payload 驗證。
- 已完成的 PDF／Web operation 在原 10 分鐘 TTL 內只可沿用前一 patch，避免純回覆修復部署後重複付費；版本跨度更大或 TTL 到期不得沿用。

## v29.6.252 PDF 選檔熱路徑禁止死快取

- `getRelevantKBFiles()` 的回傳值會在同一請求直接交給 PDF 階段；不得另把整份清單寫入沒有消費者的 `last_kb_files`。新增快取前必須先有實際讀取者與失效契約。
- 本版只刪除同步 ScriptCache 死寫入，不更動手冊檔案排序、operation 快取、對話歷史、Prompt、模型或費用。
- Prompt 本文保持不變；依版本一致契約只更新標頭為 v29.6.252，正式 `Prompt!C3` 仍須以 UTF-8 工具同步並讀回 782 字。

## v29.6.251 手冊單次免費預檢與 Prompt UTF-8 守門

- `executeAdvancedSourceQuery_` 的手冊路徑只可有兩個免費預檢呼叫點：一次供未解析型號情境、一次供完整型號解析後情境。完整型號預檢必須在額度與 `beginAdvancedSourceOperation_` 前，operation 後不得以相同參數重跑。
- 免費預檢命中必須直接完成，零 operation、零扣次、零 PDF；未命中才開始付費 operation，既有冪等與配額鎖不可移除。
- 正式 `Prompt!C3` 只能用 `tools/sync_prompt_c3.ps1` 同步；工具必須使用 PowerShell 7、UTF-8 bytes，並比對雲端回傳版號與字數。不可繞過讀回守門。
- 模型與成本契約不變：2.5 Flash-Lite（Fast／Polish）、2.5 Flash（PDF／Web），不得因回應品質調整另加潤飾或評分呼叫。

## v29.6.250 單題快路徑、混合證據收斂與 PDF 韌性

- TestUI 直接單題不再先做 checkPdfCost RPC；批次仍保留，後端 PDF countTokens、NT$0.35 上限、額度與冪等守門不變。
- 自動進手冊只可略過已由一般路由完成的第一次無型號預檢；解析出完整型號後的免費 QA／RULE 預檢仍要早於扣額與 PDF 呼叫。
- RULE／PDF 合併以同型號、同介面、同數值／版本決定式去重；數值衝突採 RULE 並記錄 Evidence Conflict。客戶端只顯示一個「資料來源」頁尾，操作與頁碼不可被刪。
- 過期 PDF 優先以 Drive ID 直取，舊索引才掃檔名，找齊即停。整庫同步部分失敗只沿用失敗檔舊 URI，其他新 URI 保留；欄位使用 expirationTime。
- 模型、費率、額度與供應商不變：2.5 Flash-Lite（Fast／Polish）、2.5 Flash（PDF／Web）、LLM_PROVIDER=Gemini。

## v29.6.249 回應熱路徑、證據邊界與真人化終點

- 正式雲端 LOG 已定位：精確 RULE 題的主要等待並非 Gemini，而是每則訊息先掃描並刪除 ScriptProperties、重複讀取 `Prompt!B3:C3`、以及 TestUI 仍送出無效 LINE loading request。一般訊息不得再執行全域狀態 purge；過期配額、pending、recent、AnswerEnvelope 與 Web rescue 只由每日清理按日期／TTL 刪除。
- Prompt 執行設定採同次記憶＋版本化 ScriptCache，Fast／PDF／Web 共用一次 Sheet 讀取；載入動畫只在真正送 Gemini／PDF／Web 前顯示，同一事件最多一次，TestUI 不呼叫 LINE loading API。QA／RULE 零供應商答案不等待外部 HTTP；Log 僅在 webhook `finally` 批次寫一次，刪除舊列移至每日排程。
- deterministic RULE 僅能逐字整理該完整型號已有欄位。App 可用性、操作路徑、故障排除、投影、AirPlay、3D 與其他資料庫未證實主張一律交既有 PDF 路由；操作＋規格複合句先保留 RULE 已知事實，只把未解操作送 PDF，純「HDMI 連接埠數量」不得因含「連接」誤升級。HAS、升降、左右旋轉與 Pivot 分開判定，未列即寫「官方規格未列」，不得推論成沒有或支援。
- Web 答案只保留 grounding 實際支持的句子，不得用固定 USB／重開機文字覆寫後仍掛原來源。無引用方向依 App／音訊／連接顯示等風險類別只給可逆檢查；無法分類就停止猜測。
- 手冊或 Web 已完成即為終點，不再追加「再詳細說明」或無關的另一來源；手冊不足才由同次系統 Web rescue 完成，成功後不再提供同題 Web 重搜。Fast 的「再詳細」只有 AnswerEnvelope 為 `supported` 且有 evidence refs 才可使用一次。
- 同題 operation 身分保留具體意圖；USB 格式與播放中斷、藍牙配對與已連線無聲不得共用快取。免費預檢不得把內部占位文字存成客戶答案。
- 對話歷史只保留答案、型號、必要步驟與手冊頁碼；來源、費用、搜尋統計、provider／route 術語不餵回下一輪。Prompt 不要求固定邀請句、emoji 或與 Structured JSON 衝突的文字標記。
- 無證據 App 題只有該完整型號 RULE 明載 Smart Monitor／Tizen 才可提供「首頁 → 應用程式」；非 Smart 型號不得借用此選單。
- 模型與費率契約不變：Fast 仍為 Gemini 2.5 Flash-Lite，PDF／Web 仍為 Gemini 2.5 Flash；本版沒有新增模型呼叫、第二次潤飾、File Search、背景搜尋或其他付費機制。

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
- 自然問句已同時明確出現非官方／公開網頁來源與查找解法意圖時，不先呼叫 Fast；零成本顯示「這題再搜網路」並退回一般 10 題額度。使用者按下後才由 Web 專用模型搜尋。
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

- 「直接問」10 題只計規格／FAQ 實質回答；手冊與網路使用各自額度，不得雙重計次。
- 一般回答若只產生手冊授權引導，必須退回該次一般提問額度。
- 一般流程已鎖定的完整型號必須寫入持久產品狀態；內容不同的新題仍沿用產品型號，但不得沿用舊答案與來源授權。手冊、網路、再手冊跨來源都不得洗掉型號。
- 常駐 Rich Menu 維持三格；只有準備沿用已知型號時，才顯示情境 Quick Reply「換型號」。換型號保留原問題、零計次、零來源呼叫。

- Rich Menu 與 TestUI 三格使用雙排超大字：第一排 `直接問`／`查手冊`／`搜網路`，第二排 `10題/日`／`2次/日`／`5次/日`。禁止縮回單行小字或塞入長句。

- `G8` 是 `CLASS_RULES` 已定義的 Odyssey 系列別稱。系列別稱遇到型號相關功能／操作／手冊題時，先從 RULE 列完整型號按鈕；只有涵蓋相同別稱的精準 QA 可直接回答，禁止泛用 Smart／其他型號資料搶答。選定完整型號後不得再次進入選型迴圈。
- 手冊 `countTokens` 的 20K 是成本警戒而非拒絕線；先刪除無關歷史，只保留本輪完整問題。100K 是絕對 token ceiling，2.5 Flash 依現價計算的 NT$0.35 成本 ceiling 通常更早生效；超限先用 `MEDIA_RESOLUTION_LOW` 重算，仍超標才停止且不扣次。
- 免費 QA／RULE 預檢未命中後，PDF 生成階段只能載入官方手冊，不得再混入 QA、RULE、Prompt!C3 或網路。型號規格結論必須附 PDF 頁碼與「型號明確／全檔共通」證據範圍；「依型號而定」不能當肯定證據。

- 手冊 URI 過期時，只更新本題實際選中的 1～2 份 PDF 並重跑 token 預檢；成功後才送出生成請求與扣除手冊額度。單檔更新仍失敗才使用既有背景整庫重建，禁止因一份手冊過期就先同步全部 PDF。

- 正式 TestUI 真人提問驗收守門：完整型號操作題不得誤判為缺型號；QA／RULE／已核對片段不足時要直接執行手冊完成鏈，不能只推薦「官方手冊」。真正送出 PDF 前才扣手冊次數。
- 使用者直接輸入文字是新問題，但在沒有新完整型號前仍沿用持久產品型號。手冊可輸入系列別稱或型號前段；多個候選時顯示可點選型號，選型均零扣次。
- 使用者雖選官方手冊，仍須先做高信心 QA／CLASS_RULES 預檢；本機答案足夠時直接回答，零 PDF、零手冊扣點。只有不足時才進已授權 PDF。
- 實驗期每位 LINE 使用者每天 10 次有效提問；來源 postback、取消、補型號與型號選擇不重複計次。群組內仍按 userId 個別計算。
- LINE 使用者只顯示 `本次約 NT$...｜今日提問剩餘 N/10`；token、paidCalls 與詳細成本仍只留 Request Audit／TestUI Logs。
- 每人 10 題使用短 UserLock，不得與 PDF 索引同步共用 ScriptLock；鎖忙碌時 fail closed，必須零計次、零供應商呼叫並顯示友善重試訊息。

- 一般訊息永遠先走 `規格＆FAQ`；精準 QA、CLASS_RULES 與人工驗證片段優先回答，但實驗期間每位使用者每天最多送出 10 題。
- `官方手冊` 可由一般提問的自動完成鏈、Rich Menu postback 或相容舊指令建立一次性 SourceOperation；`網路解答` 除 PDF 的一次系統 rescue 外，仍由網路按鍵或相容指令啟動。pending 10 分鐘只用於等待題目或型號，查完、失敗或取消後回到可直接提問狀態，但持久型號保留。
- 每聊天室每日（Asia/Taipei）手冊 2 次、網路 5 次；只有 token／檔案等預檢通過、第一個生成請求送出前才原子扣次。
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
## v29.6.257 一般／手冊候選的自然描述選型統一

- 一般 G8 候選的後續描述不得當成新問題。用當前候選 + CLASS_RULES 做 AND 比對，唯一命中後接回原題。
- 這條路徑不扣第二次直接問額度，不呼叫 Gemini。多解／無解保留原題與候選。
- 一般候選不要限於 PDF 機型；手冊候選仍要限於實際 PDF 索引。
