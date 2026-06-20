# Copilot Instructions - Samsung LINE Bot (GAS)

本檔是給 GitHub Copilot / IDE 代理讀取的專案規則。若與 `程式編寫開發及功能手冊.md` 衝突，以開發手冊與 `linebot.gs` 現況為準。

## 開發鐵律

1. 程式主檔只有 `linebot.gs`；不要新增或修改 `linebot.js`、`*.bak` 這類舊主程式副本。
2. 修改 `linebot.gs` 後必須更新 `GAS_VERSION` 與 `BUILD_TIMESTAMP`。
3. 修改 GAS 程式後必須更新既有正式 Deployment ID，不可只 `clasp push`，也不可新建正式 deployment。
4. 正式 Prompt 位於 Google Sheet `Prompt!C3`；`Prompt.csv` 只是本地鏡像/人工備份。
5. 部署流程不得自動同步或覆蓋 `Prompt!C3`。只有使用者明確要求改 Prompt 時，才可用受保護工具同步，且必須告知使用者。
6. 不要把產品規格、價格、通路、活動、服務時間等具體答案硬寫在程式；程式只做通用路由、防呆、來源與格式守門。
7. 回答邏輯與測試要以實際 TestUI / 正式 Webhook 行為為準，不要只看本機函式就宣稱完成。

## 正式部署流程

使用既有部署腳本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\deploy_existing_webhook.ps1 -VersionLabel "v29.x.xxx 說明"
```

部署腳本必須做到：

1. `clasp push -f`
2. `clasp version`
3. `clasp deploy -i AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA -V <新版本>`
4. 驗證正式 `?health=1`

部署後至少執行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\check_deploy_readiness.ps1
cd test_runner
npm run check:webhook-version
```

## Prompt 與 Google Sheet

- 正式執行 Prompt：Google Sheet `Prompt` 工作表 `C3`。
- 本地 `Prompt.csv`：只作鏡像、備份或人工貼回來源。
- 一般程式部署不會、也不應該同步 Prompt。
- 若明確要同步 Prompt，使用：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\sync_prompt_c3.ps1 -PromptPath .\Prompt.csv -ConfirmOverwrite
```

同步 Prompt 後必須讓使用者知道，並用 `/重啟` 或相關健康檢查確認指令版本。

## 回答路由 SOP

核心順序：

1. QA Sheet
2. CLASS_RULES / 規格庫
3. 官方 PDF 手冊
4. WEB / 官方頁
5. 誠實告知無資料

規則：

1. Fast Mode 先用 QA + CLASS_RULES。
2. 操作、故障、設定、明確查手冊題，若 Fast Mode 沒有可信 QA/規格答案，才升級 PDF。
3. 規格/能力題不可只因為「有 PDF」就自動查 PDF；若 QA/規格庫可回答，應避免多餘二次 API 成本。
4. 需要精準型號而使用者只問系列別稱時，先讓使用者選完整型號。
5. PDF 模式已查手冊時，文末不可再問「要不要幫你查手冊」。
6. 不可用 LLM 通用知識編造產品規格、操作步驟、價格、通路、服務時間或官方活動。
7. 回覆必須標註真實來源，例如 `[來源:QA]`、`[來源:規格庫]`、`[來源:xxx.pdf (官方手冊PDF)]`、`[來源:網路搜尋]`、`[來源:專案流程規則]`。

## 測試守門

修改後至少跑：

```powershell
cd test_runner
npm run test:static
```

若有部署正式 Webhook，線上測試必須透過版本守門：

```powershell
cd test_runner
node run_current_test.js <verify_script.js>
```

不要直接跑正式網址測試後就宣稱新版通過；必須先確認正式 health 版本等於本機 `linebot.gs`。

## 資料檔角色

- `QA.csv`：本地鏡像；正式 QA 在 Google Sheet `QA`。
- `CLASS_RULES.csv`：本地鏡像；正式規格/關鍵字在 Google Sheet `CLASS_RULES`。
- `Prompt.csv`：本地鏡像；正式 Prompt 在 Google Sheet `Prompt!C3`。
- `TestUI.html`：正式測試介面，部署到 GAS 後供 TestUI 回歸使用。

若修改 CSV 鏡像，必須告知使用者需要貼回或同步到對應 Google Sheet，否則正式 LINE Bot 不一定會讀到。
