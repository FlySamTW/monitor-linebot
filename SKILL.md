---
name: samsung-linebot-maintenance
description: 維護與發布 Samsung 台灣螢幕 LINE Bot。適用於三來源路由、QA/RULE、官方 PDF RAG、官網承接、RULE/PDF 缺口稽核、TestUI 真人驗收、成本守門與既有 Webhook 發布。
---

# Samsung LINE Bot 維護技能

## 不可破壞契約

- 預設只走 QA／CLASS_RULES。已確認完整型號跨日保存；手冊需「確認要查」，網路按鍵即授權。來源執行完不得黏住下一題，但不可清除產品型號。
- 手冊／網路 10 分鐘內相同來源＋型號＋問題只回傳操作快取，零供應商、零再次扣次。
- Web 只查有 grounding supports/chunks 的非官方公開網頁；不得把 Samsung 官網送進模型、`url_context` 或直接抓頁。官網只保留 `🔗 到這款官網` URI 選項。
- 供應商 generate 請求一旦送出就計該來源 1 次；即使無證據或供應商回錯也不退款。相同題、標點差異與已知同義改寫必須由 operation cache 擋住，不能靠退款放任重燒成本。
- 只有來源成功才更新 `lastSource` 與最近題目；Web 無證據、來源錯誤與 canonical provider query 不得覆蓋前一次成功手冊鏈或使用者原句。
- G8 是 Odyssey 系列。短別稱先列 CLASS_RULES 完整型號；選型前零 PDF、零網路、零扣次。
- RULE 明載的規格是硬事實。模型不得把 Smart／Tizen 型號的藍牙、喇叭或介面答成相反結論。
- PDF 生產只用 `models/gemini-2.5-flash-lite`，送出前以同一 payload `countTokens`；單次最壞 NT$0.35，手冊模式不得聯網。先以 QA／RULE、頁面收斂與已核對片段達成答案；低成本方法已達標時禁止再為模型比較花費。只有未覆蓋題組的整體成功率仍不足，才另案 A/B MANUAL；不得連 Fast／QA／RULE 一起換。
- PDF 成功答案必須同時具 PDF 顯示頁碼、型號適用範圍與可核對證據摘錄；缺任一者不得掛「三星官方手冊」來源。人工逐頁片段也要顯示 `NT$0.0000` 與未扣手冊額度。
- 禁止 LINE Push。Rich Menu 與一般客服一律使用 reply；沒有業主另案明確授權不得新增 Push API。

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
- Product Finder 只發現產品與 PDP。自動下載的 PDF 未通過 HTTPS、MIME／`%PDF-`、SHA-256、第一頁完整型號及既有逗號檔名驗證前，不得進正式 Drive/RAG。
- `/重啟` 是管理員強制清除該對話、pending、最近題目與持久型號；不重建 PDF。正常 PDF 過期、同步與新手冊維護不需要人工 `/重啟`。

## 驗證與發布

0. 使用者反映正式回答有問題時，先讀 Google Sheet `LOG` 的雲端完整紀錄，核對 user message、來源、掛檔、paid/pdf/web calls、grounding、quota 與最終 Reply；只有 LOG 無法區分原因時才做一次最低成本重現。

1. 更新 `GAS_VERSION` 與必要文件。
2. 在 `test_runner` 執行 `npm run test:static`、`npm run test:contract`，再跑 `git diff --check`。
3. 先確認 local／HEAD／正式 Webhook 版本一致，再用已登入且具有專案編輯權的 Chrome 開啟編輯者 TestUI：`https://script.google.com/macros/s/AKfycbxHQZ6VryRNELxhddhI9GiAyjj_H-AjjDYLs_0JZIsn/dev?test=1`。`/dev` 由 Google 限制只有編輯者可進入，程式確認 `/dev` 後才簽發短效 token；正式 `/exec?test=1` 仍必須帶維護密碼。以 390×844 實際輸入並點按，確認成功答案不顯示官網按鈕；答案不足且完整型號已鎖定時顯示並能開 Samsung Taiwan URL。
4. 執行 `tools\release_existing_webhook.ps1 -DryRun`。
5. 正式發布只用：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File tools\release_existing_webhook.ps1 `
     -VersionDescription "v29.x.xxx 功能描述"
   ```

6. 回讀正式 health、版本與 TestUI；最後 `git add`、`git commit`、`git push origin main`。

禁止自行拼接 `clasp push`、建立新 deployment、未指定 `-V` 的 deploy，或以綠燈腳本取代實際 TestUI 旅程。
