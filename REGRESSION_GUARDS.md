# 回歸不可退化事項

- QA/RULE 精準答案零模型；候選找得到不代表可直答，語意判讀須看到完整相關內容；PDF/Web 額度不應擋既有 QA 候選。
- 已存手冊 QA 必須進召回；完整 canonical 問句必須傳給後續判讀。上輪手冊重用需核對型號、版本、資料指紋與有效期，不能把一般功能當指定操作狀態的許可。
- 來源由引用證據種類決定；RULE 規格不能誤標活動，已驗證手冊重用仍標手冊。
- JEV 候選選擇沿用既有摘錄；Lite v2 依 evidenceRefs／conditions 回答，必要條件必須出現在可見答案，不能只存在內部 JSON。同一已登錄型號的表示法在邊界統一，不借相似SKU。
- 術語拆段必須保留 subject／原始別名，模型輸入與最終答案均不可丟掉主詞；相關定義先召回再判讀，不能只留下相同關鍵詞的軟體描述。實際呈現支離破碎，即使 complete=true 也驗收失敗。
- 無型號通論先完成語意範圍與候選判讀，不得靠操作詞要求型號。缺口只查一次 Web，零 PDF、零前置無證據 Fast；`questionScope` 缺漏／格式失敗不得升來源。個別產品問題仍先補必要身分，未知完整型號仍零模型拒猜。
- Web 多段回覆的工具 parts 不得遮掉後方答案；只合併非 thought 文字。工具 trace 可補查詢數，不能代替 grounding 證據。missing metadata/trace 仍未知，不能歸零。術語原文可選定義／限制，不能輸出 canonical、aliases 等內部欄位。
- PDF/RAG 是核心能力；驗收須分列實際頁級生成、PDF 直讀與既有手冊證據重用。模型宣稱 full 不代表通過驗證；零有效證據不可標 supported，錯誤提示不能被清理成空白後補上官方來源。
- 供應商失敗、空回應、格式錯誤不能誤算成缺資料，不得再翻 PDF 或搜 Web；只有缺口升來源，已有答案保留。
- 型號、來源角色、原 PDF SHA、頁碼與摘錄共同核對。通用方法不能假裝特定型號規格；禁止 6K/8K 或單題詞彙覆寫。
- 首頁核驗不接受整本 PDF URI；相同 SHA 抽取共用而適用性各自驗證。已付費階段收據永不因後段失敗重做。
- 只有 probe 雙 SHA 讀回完成才 ready，active 指標／pending／health 不算。已成功覆蓋舊索引不報 stale；真的新 SHA 缺索引不能被舊 ready 掩蓋。
- 一題預算／總月帳／背景分類／驗收批次共同預留；未知費用不能變零，成本按用途而非模型推猜。
- 費用驗證涵蓋輸入、快取、輸出、思考與TWD匯率；單階段／整題／整批分開，PDF頁段與整本不可混比。歷史整本0.5155、頁級0.04936三次合計及整批1.36的歸因教訓見Developer_Manual.md；歷史數字不當當期預算或帳單。
- 400/404 不換貴模型重送；有限重試同一階段最多三次、至少一個排程週期。
- 新模型或調價必須費用與品質比較；執行 verify_cost_remediation_v324.js、verify_cost_policy_release.js。

- JEV `cost:null`／缺 usage 保守計費，不能 `Number(null)` 當零；gateway 收據與 request audit 不得重複加總。confidence 缺漏／低於門檻不能當通過；信心值不是實測正確率。
- Choice 必須為有效列舉，confidence 與 Noul 僅接受 0～1 數值；任一來源 Noul 落在 0.15～0.85 中間區間不得高信心接管。政策變更汰換舊 Router 快取。
- 新增 JEV 證據驗證僅限明確驗收視窗，收到原問題、完整引用片段與條件；不把模型自己的摘要當來源。僅拒絕無法支持的主張，保留已核實部分；判讀失敗不盲重送或升 Web。
- 原生 Interactions 引用須為 `url_citation` 並通過 UTF-8 位元組邊界及 HTTPS 檢查，未完成回覆不得當引用完成。搜尋數未知時預留不得少於已觀測查詢數，思考文字不得呈現成答案。
- LINE 驗收指定使用者／版本／build／批次／時窗，同批舊支出保留；過期指定請求不可轉一般支出繞額度。API 接受送出與使用者可見回答分開記錄，其他使用者不套用測試模式。
- Files API 續期是免費附件的到期管理；不能把上傳當 RAG 建索引或模型生成。保留免儲存費及舊有效版本，不因改用持久索引就每日重建付費 embedding。
- 上傳 HEAD 前備份正式版本／health 與雲端完整原始碼，備份按檔 SHA 固定；回復同時還原既有 deployment 與 HEAD 並讀回。health 必須匹配版本及 build。
- 編輯者模型比較限定 2.5 Flash 與 3.1 Flash-Lite，同題同一份證據；先試可用性，404 不重試，既有比較即使中斷亦只能讀回，不自動重付。所有探測與失敗保留原批總帳。
- 診斷頁僅原生 `/dev` 核發15分鐘、綁定build的token；`/exec` 不核發，不依賴新增Email權限。以鎖保護比較開始狀態，重開不得增加provider呼叫或費用；模型診斷不冒充LINE旅程。
- 正式守門要求 LINE 可見答案、事件／版本／build／收據對齊與核心20條至少19條且關鍵失敗0；HTTP200、TestUI、離線 fixture 或空收據不能取代實際 LINE 證據。

最小必要驗證：npm --prefix test_runner run test:static、test:contract、test:production-contract；20核心旅程（fixture 僅模擬 I/O）；本次以真實 LINE 對應受影響旅程、受影響 worker 實際兩 SHA、雲端費用收據。依使用者要求不先跑 TestUI。fixture 結果與真正供應商／LINE 證據分列；費用、引用和驗收時窗新增案例見 verify_takeover_v324.js。

- 候選格式／範圍錯誤最多一次付費生成，必要條件由同一引用原文回填；禁止藉修復重送或改判資料缺口轉 Web。測試必查呼叫數、捏造條件與數字仍被拒絕。
- 相同 query 重複出現不能去重少算，未知估算至少涵蓋觀測次數；一般正式流量不擴大 JEV 付費用途。
- 使用者明確先發布後自行 LINE 測試時，須保存原指示及 runtime 綁定，仍檢查當次診斷、帳本、20旅程、cloud health；只能記「已發布／LINE待驗」，不得更改 liveAccepted。必要守門測試 verify_user_line_publication.js。
