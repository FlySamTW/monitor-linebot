---
name: samsung-linebot-maintenance
description: 維護與發布 Samsung 台灣螢幕 LINE Bot。適用於三來源路由、QA/RULE、官方 PDF RAG、官網承接、RULE/PDF 缺口稽核、TestUI 真人驗收、成本守門與既有 Webhook 發布。
---

# Samsung LINE Bot 維護技能

## 不可破壞契約

- 預設只走 QA／CLASS_RULES；官方手冊與網路各自需要本輪一次性授權，查完回到 SPEC/FAQ。
- G8 是 Odyssey 系列。短別稱先列 CLASS_RULES 完整型號；選型前零 PDF、零網路、零扣次。
- RULE 明載的規格是硬事實。模型不得把 Smart／Tizen 型號的藍牙、喇叭或介面答成相反結論。
- PDF 只用 `models/gemini-2.5-flash-lite`，送出前以同一 payload `countTokens`；單次最壞 NT$0.35，手冊模式不得聯網。
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
- Product Finder 只發現產品與 PDP。自動下載的 PDF 未通過 HTTPS、MIME／`%PDF-`、SHA-256、第一頁完整型號及既有逗號檔名驗證前，不得進正式 Drive/RAG。
- `/重啟` 只清使用者對話與 pending；正常 PDF 過期、同步與新手冊維護不需要人工 `/重啟`。

## 驗證與發布

1. 更新 `GAS_VERSION` 與必要文件。
2. 在 `test_runner` 執行 `npm run test:static`、`npm run test:contract`，再跑 `git diff --check`。
3. TestUI 以正式部署、390×844 觸控旅程實際提問。確認成功答案不顯示官網按鈕；答案不足且完整型號已鎖定時顯示並能開 Samsung Taiwan URL。
4. 執行 `tools\release_existing_webhook.ps1 -DryRun`。
5. 正式發布只用：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File tools\release_existing_webhook.ps1 `
     -VersionDescription "v29.x.xxx 功能描述"
   ```

6. 回讀正式 health、版本與 TestUI；最後 `git add`、`git commit`、`git push origin main`。

禁止自行拼接 `clasp push`、建立新 deployment、未指定 `-V` 的 deploy，或以綠燈腳本取代實際 TestUI 旅程。
