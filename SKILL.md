---
name: samsung-linebot-maintenance
description: 維護與發布 Samsung 台灣螢幕 LINE Bot。適用於三來源路由、QA/RULE、官方 PDF RAG、官網承接、RULE/PDF 缺口稽核、TestUI 真人驗收、成本守門與既有 Webhook 發布。
---

# Samsung LINE Bot 維護技能

## 不可破壞契約

- 通用 Prompt 只負責 FAST 證據邊界、回答方式與來源建議；產品個案放 QA，路由／授權／額度／補救／來源標籤由程式負責。Fast／PDF／Web 溫度固定為 0.3／0.2／0.15，不增加第二次潤飾呼叫。
- 螢幕通識推理（4K 解析度對應桌面排列、HDMI 接機上盒看第四台、線材選購）由 `isGeneralComputingReasoningQuestion_` 放行，不強制 QA/RULE 實體來源行；但仍嚴格攔截型號能力問句（有沒有 KVM 等）與第三方 App/業者服務推測。
- 預設只走 QA／CLASS_RULES。已確認完整型號跨日保存；手冊需「確認要查」，網路按鍵即授權。來源執行完不得黏住下一題，但不可清除產品型號。
- 手冊／網路 10 分鐘內相同來源＋型號＋問題只回傳操作快取，零供應商、零再次扣次。
- Web 優先採有 grounding supports/chunks 的非官方公開網頁；只有具可稽核證據時才能標為網路來源。Google 未回傳引用時仍須提供經安全過濾且明確標示未證實的可能方向。不得把 Samsung 官網送進模型、`url_context` 或直接抓頁；官網只保留 `🔗 到這款官網` URI 選項。
- 供應商 generate 請求一旦送出就計該來源 1 次；即使無證據或供應商回錯也不退款。相同題、標點差異與已知同義改寫必須由 operation cache 擋住，不能靠退款放任重燒成本。
- 只有來源成功才更新 `lastSource` 與最近題目；Web 無證據、來源錯誤與 canonical provider query 不得覆蓋前一次成功手冊鏈或使用者原句。
- G8 是 Odyssey 系列。短別稱先列 CLASS_RULES 完整型號；選型前零 PDF、零網路、零扣次。
- RULE 明載的規格是硬事實。模型不得把 Smart／Tizen 型號的藍牙、喇叭或介面答成相反結論。
- 系列別稱只是候選不是 confirmed model；規格欄位只能由完整型號自己的 RULE 終止回答。未明載就是 UNKNOWN，零 LLM 建議手冊，不得套用同系列。
- 「再詳細說明」每個答案最多一次，是零一般額度的 control action；必須保留原題與 confirmed model，不得把內部補充指令寫回最近題目。
- 系統要求補型號後，氣泡點選與直接輸入完整型號都要接回 pending original question，不新增 20 題計次。
- 使用者選定完整型號後，DirectDeep、RULE 與 PDF 候選只能使用該型號，不得由型號內的 G8／M8 片段重新展開同系列其他機種。
- `術語_` RULE 只能解釋名詞，不是型號能力證據；完整型號列未明載時不得回答支援或不支援，應保留型號並建議手冊查證。
- 能力守門的可見結論不得被手冊授權模板洗掉；正在建議手冊時不顯示 Web 入口，只有手冊仍無證據後才可推薦 Web。
- QA／RULE 成功答案不因型號有 PDF 就追加進階來源；手冊與 Web Quick Reply 分別只由明確的來源推薦狀態產生。
- 精準 QA 未命中的無型號操作／故障／跨裝置題要在 Fast 前 deterministic `ASK_MODEL`，零 LLM、不猜外部裝置設定；已有持久完整型號則照常沿用。
- 兩個完整型號的比較題須由程式直接抽取兩條精確 RULE 的差異，禁止讓模型混入其他型號數字；活動 RULE 回答前須依 Asia/Taipei 日期排除過期資料，舊活動只留歷史稽核。
- 範圍外問題先於來源、產品狀態與價格守門；競品／家電不得偷借上一題螢幕型號。未知完整型號不寫入持久狀態；有效活動權益只抽取本題型號條款與共通抽獎，禁止混用其他型號贈品。
- 售價遮罩不得改寫活動點卡、禮券或購物金面額；它們是 RULE 明載的贈品權益，不是商品報價。
- 手冊免費預檢禁止呼叫 LLM；只允許精準 QA、人工核對片段或程式擷取的精確型號 RULE。操作／設定沒有 deterministic 證據就繼續 PDF 確認，不得用 Fast 幻覺冒充已驗證問答。
- S32HG806ES 雙模操作只可命中官方手冊第 27／35／43 頁的精準片段；其他 G8 不得共用。PDF 已付費但無可核對證據時，系統可自動補搜一次非 Samsung 官網 Web，不扣使用者網搜額度，另以每聊天室每日 3 次限制供應商補救成本；仍無證據就提供明確標示未經證實的保守方向，不得叫使用者反覆重搜。
- 已核對 USB 播放片段只處理播放路徑／格式限制；含斷線、不穩、異常、無法、故障或明確非官方／網路意圖時不得因關鍵字重疊搶答。
- 問句已明確要求非官方／公開網頁解法時，在 Fast 前零成本顯示 Web 授權入口並退一般額度；不得先產生手冊頁碼或三星官網中間答案。
- Fast／Polish 使用 `models/gemini-2.5-flash-lite`；只有未命中 QA／RULE／已核對片段的整本 PDF fallback 使用 `models/gemini-2.5-flash`。PDF 送出前以同一 payload `countTokens`，單次最壞 NT$0.35，手冊模式不得聯網；低成本證據已達標時禁止再呼叫模型。
- Web grounding 獨立使用穩定版 `models/gemini-2.5-flash` 與 US$0.30／US$2.50 費率。較高費率只在整本 PDF、使用者按 Web 或 PDF 無證據的一次性補救發生，不得連 Fast／QA／RULE 一起升級。
- Web 最多 5 點／450 個中文字並必須完整收尾；只留直接適用本題的 grounding 做法。螢幕內建 USB 播放不得混入 Windows／主機板排錯，亦不得建議非官方韌體下載。
- PDF 成功答案必須同時具 PDF 顯示頁碼、型號適用範圍與可核對 Evidence[]；操作題另須以結構化 `operationPath` 呈現「入口分類 → 功能名稱」，不得只回注意事項。缺任一必要證據不得掛「三星官方手冊」來源；同頁證據去重。人工逐頁片段也要顯示 `NT$0.0000` 與未扣手冊額度。
- 禁止未授權 LINE Push。Rich Menu 與一般客服一律使用 reply；只有業主當次明確授權的單次通知可使用 Push，不得因此新增常駐推播路由或擴大授權。

## 官網承接

- 只有已鎖定完整型號，而且回答查無資料、手冊未記載、來源失敗或證據衝突時，才顯示 `🔗 到這款官網`。
- 官網連結只能採本題文字或本題路由確認的完整型號；不得借上一題 `direct_search_models`／suggested cache。
- 優先使用同一條 CLASS_RULES 的 `官網網址`；沒有時，用同列 `LS...XZW` 建立 `https://www.samsung.com/tw/support/model/<SKU>/`。
- 只允許 `https://www.samsung.com/tw/`。G8、M8 等系列別稱、等待選型與成功答案不顯示。

## 手冊生命週期與缺口

- 每日 04:00 `dailyKnowledgeRefresh()` 重新上傳 Drive 既有 PDF，再執行 `auditManualCoverageGaps_()`。
- `MANUAL_COVERAGE_REPORT` 保存 RULE/PDF 覆蓋；新 RULE 缺 PDF 或 H／2026 缺 PDF會寫入 `PENDING_MODEL_REVIEW.manualStatus` 與警示 LOG。
- 維護者用受保護的 `?manualCoverage=1` 或 TestUI 覆蓋徽章檢查。索引不可用時不得製造假缺口。
- 部分 PDF 上傳失敗時，保留前次完整 `KB_URI_LIST` 與備份；索引使用完整 Drive 檔名目錄。Drive 掃描中途失敗時，正式 URI、索引與備份都不得由部分清單覆蓋；兩種失敗均一分鐘後受控重試。
- Drive 出現同名 PDF 時不得隨機掛檔或刷新正式索引；同步守門保留前次完整狀態並持續警示，執行期再以檔名＋Drive fileId／updatedAt 唯一化，最多只掛一個確定身分。
- Product Finder 發現產品與 PDP；白名單內的 SKU、產品名稱、官方特色與台灣 PDP 可自動寫成 A 欄單一 CSV 最小 RULE，價格／庫存／未提供規格禁止寫入。
- 每日每輪最多處理 2 本 Samsung TW 繁中 UM。PDF 必須通過 HTTPS、MIME／`%PDF-`、SHA-256、Gemini 第 1 頁所有完整型號與支援頁 SKU 交叉驗證；正式檔名移除 `L`／`XZW`，再於移除後以數字結尾的前提下去尾端 1–3 個英文字銷售碼，排序後用半形逗號連接，不得維護逐尾碼白名單。矛盾才隔離並下輪重試。
- 每輪 2 本必須用持久游標輪替候選，避免兩本永久失敗讓其餘新品永遠飢餓；輪替不得放寬任何證據守門。
- 第一頁驗證先用 2.5 Flash-Lite；只有身分漏判才以 2.5 Flash 對同一檔再核對一次，兩者共用 250K token 上限且只升級一次。仍失敗才隔離，禁止用支援頁 SKU 單獨冒充 PDF 證據。
- 若執行身分無 Drive 寫權，驗證通過的手冊須以正式檔名自動改存 Gemini Files API 並持久合併手冊清單與 `PDF_MODEL_INDEX`；同名更新強制刷新 URI。Drive 與 Gemini 都失敗時仍保存可自動重試的 ScriptProperties 狀態。
- 手冊型號候選必須與正式 `PDF_MODEL_INDEX` 取交集；RULE-only、隔離中或舊按鈕帶入的無實檔型號不得執行 PDF、不得扣額度。
- 手冊經核准並移入正式 Drive 根目錄後，每日同步自動重新上傳 Gemini Files；一般使用者、管理員與新品維護都不需要 `/重啟`。
- `/重啟` 是管理員強制清除該對話、pending、最近題目與持久型號；不重建 PDF。正常 PDF 過期、同步與新手冊維護不需要人工 `/重啟`。

## 驗證與發布

0. 使用者反映正式回答有問題時，先讀 Google Sheet `LOG` 的雲端完整紀錄，核對 user message、來源、掛檔、paid/pdf/web calls、grounding、quota 與最終 Reply；只有 LOG 無法區分原因時才做一次最低成本重現。

1. 更新 `GAS_VERSION` 與必要文件。
2. 在 `test_runner` 執行 `npm run test:static`、`npm run test:contract`，再跑 `git diff --check`。
3. 先確認 local／HEAD／正式 Webhook 版本一致，再用已登入且具有專案編輯權的 Chrome 開啟編輯者 TestUI：`https://script.google.com/macros/s/AKfycbxHQZ6VryRNELxhddhI9GiAyjj_H-AjjDYLs_0JZIsn/dev?test=1`。`/dev` 由 Google 限制只有編輯者可進入，程式確認 `/dev` 後才簽發短效 token；正式 `/exec?test=1` 仍必須帶維護密碼。TestUI 只驗收實際提問、來源按鈕、回覆文字、LOG、額度與費用，不把 Web viewport／響應式版面列為產品完成條件。Rich Menu 的常駐、收合與觸控只在手機 LINE App 驗收。
4. 執行 `tools\release_existing_webhook.ps1 -DryRun`。
5. 正式發布只用：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File tools\release_existing_webhook.ps1 `
     -VersionDescription "v29.x.xxx 功能描述"
   ```

6. 回讀正式 health、版本與 TestUI；最後 `git add`、`git commit`、`git push origin main`。

禁止自行拼接 `clasp push`、建立新 deployment、未指定 `-V` 的 deploy，或以綠燈腳本取代實際 TestUI 旅程。
