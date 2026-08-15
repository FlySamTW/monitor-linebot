# LINE Rich Menu 三鍵常駐選單：AI 實作交接規格

> 建立日期：2026-08-14
> 目的：讓後續 AI 在 `D:\00_程式\20251125_GAS客服LineBot` 採用已驗證的三區 Rich Menu 視覺語言與互動原則。
> v29.6.118 已將三格改成雙排超大字版：第一排 `直接問`／`查手冊`／`搜網路`，第二排 `20題/日`／`5次/日`／`10次/日`。選單仍是全體預設且 `selected: true`；左鍵使用 `openKeyboard`，中、右鍵使用 `openRichMenu`。系列選型、額度與來源隔離契約不變。

## 一、先釐清：Rich Menu 不是 Quick Reply

- **Rich Menu**：手機版 LINE 官方帳號聊天室底部的常駐功能區，適合放 3 個固定入口。
- **Quick Reply**：附著在單則訊息下方的情境式快捷按鈕；新訊息出現後可能消失。
- `💬 再詳細說明` 保留為回答後的展開；`再查手冊／再搜網路` 只能重新進入相同來源狀態機，不得保留繞過每日配額的舊旁路。
- Rich Menu 只處理跨情境都成立的固定入口，避免把所有功能塞滿底部。
- Rich Menu 在 LINE 電腦版不顯示，驗收必須使用手機 LINE App。

官方依據：

- Rich Menu 規格與圖片限制：https://developers.line.biz/en/reference/messaging-api/
- Per-user Rich Menu：https://developers.line.biz/en/docs/messaging-api/use-per-user-rich-menus/
- Postback 不顯示使用者文字：https://developers.line.biz/en/docs/messaging-api/try-rich-menu/

## 二、沿用的視覺樣式

發票版檔案只保留作視覺參考，**不可部署**。正式客服資產為：

- `docs/rich_menu/samsung_source_menu_v1.svg`
- `docs/rich_menu/samsung_source_menu_v1.png`
- `docs/rich_menu/samsung_source_menu_v1.json`

參考檔：

- `docs/reference_rich_menu/REFERENCE_ONLY_three_panel_style.svg`
- `docs/reference_rich_menu/REFERENCE_ONLY_three_panel_style.png`
- `docs/reference_rich_menu/REFERENCE_ONLY_three_panel_template.json`

### 畫布與三區配置

| 項目 | 規格 |
|---|---|
| 原始畫布 | `2500 × 843 px` |
| 行動版檢查尺寸 | 至少檢查 `390 × 132 px` 的縮小結果 |
| 背景 | `#F2F6FA` |
| 三張卡片 | 白底、圓角 `44 px`、輕陰影 |
| 卡片座標 | `x=42 / 861 / 1680`、`y=42`、`w=778`、`h=759` |
| 點擊區 | `0–832`、`833–1666`、`1667–2499`，完整覆蓋高度 `843` |
| 主標 | 台灣繁中、`Microsoft JhengHei`／`Noto Sans TC`、約 `116 px`、粗體 |
| 副標 | 約 `44 px`、粗體；只能是短提示，手機縮圖仍須可辨識 |
| 主文字色 | `#142A3A` |

### 三色視覺系統

| 區域 | 主色 | 淺底色 | 用途語意 |
|---|---|---|---|
| 左側 | `#008F83` | `#E2F6F2` | 開始、輸入、主動操作 |
| 中間 | `#2767B2` | `#E8F1FD` | 文件、查詢、搜尋 |
| 右側 | `#C96A0A` | `#FFF0DE` | 更多功能、外部資源、列表 |

設計原則：

1. 每區只放一個大圖示、一個 4～6 字主標與一個極短副標。
2. 圖示採約 `336 px` 實心主色圓底與白色主題符號；聊天、開書、地球必須一眼可辨，禁止 emoji、細線或抽象圖形。
3. 左區是新客主 CTA，可用描邊或淡底提高辨識；中、右是回答後查證工具，不得與主入口爭奪同等語意。
4. 文字必須直接畫進 SVG／PNG，不使用 AI 生圖產生中文，避免錯字與字形漂移。
5. PNG 必須小於 LINE 官方上限 `1 MB`；參考 PNG 約 `81 KB`。
6. 更新圖片時不能覆蓋既有 Rich Menu 圖片，必須建立新的 Rich Menu ID。

## 三、客服專案建議的三鍵語意

以下為已確認的三來源契約：

| 位置 | 建議主標 | 建議副標 | Postback data | 點擊後只做什麼 |
|---|---|---|---|---|
| 左 | `直接問` | `20題/日` | `rm_action=select_source&source=spec&v=2` | 清除來源 pending、保留型號、切回預設來源並開啟鍵盤 |
| 中 | `查手冊` | `5次/日` | `rm_action=select_source&source=manual&v=2` | 顯示剩餘次數、目前問題／型號與「確認要查」 |
| 右 | `搜網路` | `10次/日` | `rm_action=select_source&source=web&v=2` | 有目前問題就直接搜尋；無問題才要求輸入 |

重要限制：

- 左鍵只切回直接問；手冊鍵只準備確認，不讀 PDF。網路鍵本身即授權：有目前問題時直接建立一次 Web 操作，無問題才建立 10 分鐘 pending。
- 每位 userId 每日 20 次只在有效問題送出時原子保留；群組不共用。來源 postback、取消、型號提示與型號按鈕不得重複計次。
- 手冊 pending 先做精準 QA 與高信心 CLASS_RULES 預檢；命中即回到規格／FAQ，PDF 配額維持不變。
- `到這款官網` 只能是答案不足且本題已鎖定完整型號後的情境 Quick Reply，不得增為第四個常駐 Rich Menu。它使用 URI action，優先開 RULE 已記錄的 Samsung Taiwan PDP，否則開同列 XZW 完整料號支援頁；選型中、成功答案或只有上一題型號 Cache 時不顯示。
- 手冊確認使用 `rm_action=confirm_manual&source=manual&v=2`；取消使用 `rm_action=cancel_source&v=2`。不再使用「查上一題」文案。
- 已確認完整型號跨日保存；短系列名觸發候選。10 分鐘內相同來源＋型號＋問題回傳快取，不重新扣次。
- 網路鍵只搜尋有可核對引用的非官方公開網頁，不讀 PDF，也不把 Samsung 官網送入模型；`到這款官網` 僅是回答不足後的 URI Quick Reply。供應商請求已送出即計 1 次，無引用也不退款；同題／同義改寫由 10 分鐘 operation cache 防重燒。
- `#查手冊`／`#搜尋網路` 僅供 LINE 電腦版相容，必須進同一 pending、授權與配額服務。

## 四、Rich Menu JSON 要點

- `selected: true`：聊天室開啟時顯示選單。
- `chatBarText` 最多 14 字；本版使用 `先提問・再查證`。
- 三個區域使用 `postback`，並**省略 `displayText`**，避免聊天室出現「使用者自己說了一句指令」的雜訊。
- `data` 使用穩定、可版本化的英文 action；不要把顯示文字當路由條件。
- `spec` 使用 `inputOption: openKeyboard`；`manual`、`web` 使用 `inputOption: openRichMenu`。鍵盤與 Rich Menu 不能同時顯示是 LINE 平台限制，不得宣稱真正永不消失。
- 建立前先呼叫 `POST /v2/bot/richmenu/validate`。

參考：`docs/reference_rich_menu/REFERENCE_ONLY_three_panel_template.json`。

## 五、GAS 接法：必須走快速路徑

截至本文件建立時，`linebot.gs` 已有大量 Quick Reply，但未找到正式的 Rich Menu postback 路由。實作時要再次確認最新版，並將 postback 放在 `doPost(e)` 的前段：

```javascript
function handleRichMenuPostback_(event) {
  const replyToken = String(event.replyToken || "");
  const params = parsePostbackData_(String((event.postback || {}).data || ""));

  if (params.rm_action === "select_source") {
    return startSourceSelection_(
      params.source,
      resolveContextId_(event.source),
      event.source.userId,
      replyToken,
    );
  }

  return false;
}
```

路由守門：

1. `event.type === "postback"` 時，先交給 `handleRichMenuPostback_()`。
2. 成功處理後立刻結束該事件，不能再掉入一般 AI 對話主流程。
3. 同一個 `replyToken` 只能 Reply 一次。
4. Rich Menu 快速入口不得使用 Push；除非業主另有明確、單次授權。
5. 不能把 TOKEN、userId 或完整 postback payload 寫進一般除錯訊息。
6. 現有 Quick Reply 與 `#查手冊`、`#再詳細說明`、`#搜尋網路` 行為不可回歸。

## 六、效能避雷：這是必要交付條件

另一個已上線專案曾因每次 Rich Menu 點擊都執行完整 Sheet 初始化、紀錄掃描與同意資料掃描，正式 Apps Script 實測每次 `doPost` 耗時 **3.857～8.496 秒**；三種按鈕都慢，並非單筆資料異常。

本客服專案不得重犯：

- 不要在 Rich Menu 快速路徑執行 Sheet schema 初始化、資料遷移或 Drive 同步。
- 不要在 Reply 前掃描整張紀錄表去重。
- 必要設定使用 `CacheService`／`PropertiesService`；必要資料只讀最小範圍。
- 稽核紀錄應在使用者 Reply 完成後才寫入，或採既有記憶體暫存／批次落盤機制。
- 對 1～2 秒內的相同 `webhookEventId`／postback 做冪等與防連點，不能重複回覆。
- 每個 action 都記錄分段耗時，但不得記錄 token 或敏感內容。

效能門檻：

- Rich Menu 簡單入口：正式手機 LINE 點擊至看到 Reply，目標中位數 `≤ 1.5 秒`。
- P95 目標 `≤ 3 秒`。
- 任一快速入口不得觸碰本專案 AGENTS.md 規定的 5 秒 Webhook 紅線。

### 已落地參考：發票 Bot v0.5.1 的快速路徑

`D:\00_程式\20260813_消費者發票辨識&連結國稅局` 已在 2026-08-14 將相同三鍵模式改成以下架構；客服 Bot 的 AI 應沿用原則，但要依客服 action 重新命名，不得複製發票文案：

1. Worker 驗證 LINE 簽章後立即分類事件，不把所有 postback 都塞進通用 GAS 路由。
2. 純提示／純網址按鈕由 Worker 直接呼叫 LINE Reply API；**先 Reply、後寫稽核**。
3. 必須讀 Sheet 的按鈕改呼叫獨立 `fastPostback` operation；GAS 在任何 schema 初始化、資料遷移與通用事件處理之前先攔截。
4. 快速查詢用單次精準 `getRange()` 讀最後 10 個實體列及必要欄位，不用 `getDataRange()`，也不把整張表讀進 JavaScript 再篩選。
5. 使用者狀態採 `ScriptCache` ＋ `PropertiesService` 持久鏡像；有效狀態最多快取 6 小時、無效狀態短暫快取 60 秒，狀態更新時同步覆寫兩層。
6. 防連點有兩層：Worker 用同容器跨 gunicorn worker 的原子標記，GAS 再用 Cache；主選單同一使用者／聊天室 2 秒內只接受第一個操作。
7. 有上下層關係的動作要分開防抖。例如「取得清單」與「開啟清單第 1 筆」不能共用同一 key，否則正常的第二步會被誤擋。
8. 快速查詢不可自動 retry：LINE reply token 只能使用一次；GAS 回應不明時重送可能造成重複 Reply 或失敗噪音。
9. 進站紀錄以短期 Cache 依 webhook event ID 去重後直接 append；不在 Reply 前掃描完整 eventKey 欄，也不等待 3 秒全域鎖。
10. 每段記錄 `webhook acknowledged`、`direct reply sent`、`GAS fast postback completed` 毫秒數；log 只記 action 與耗時，不記 token、userId 或完整 payload。

發票 Bot 當次證據：44 個 Python／GAS 回歸通過；正式 GAS deployment 更新到 `@15`；Zeabur `/health` 回報 `0.5.1`；同意鏡像預熱成功 1 筆。部署後 warm health 探測為 `183～365 ms`，一次已授權 LINE Push 的 API 往返為 `113 ms`；這兩個數字只能確認網路與服務基線，不能冒充 Rich Menu Reply 的手機端耗時。這些證據只證明參考專案已部署，**不代表客服 Bot 已修改或已通過真人 LINE 驗收**。

客服 Bot 實作時的最小骨架：

```javascript
function doPost(e) {
  const event = parseAndVerifyLineEvent_(e);

  // 必須在 initialize / migration / AI routing 之前。
  if (event.type === "postback" && handleRichMenuFastPath_(event)) {
    return okOutput_();
  }

  return handleExistingWebhook_(event);
}
```

若客服 Bot 仍是 LINE → GAS 直連、沒有 Zeabur Worker，則三個純提示 action 全部應在 GAS `doPost` 最前段直接 Reply；不要為了照抄架構而新增一個沒有實際效益的中介服務。

## 七、部署策略：全體預設（業主明確核准）

業主已明確要求所有使用者直接看到，因此不再要求 `ADMIN_USER_ID`。

1. 讀取並保存目前全體預設 Rich Menu ID，沒有預設時保存空值。
2. 建立新 Rich Menu、上傳 PNG。
3. 設定全體預設：

   `POST /v2/bot/user/all/richmenu/{richMenuId}`

4. 立即回讀：

   `GET /v2/bot/user/all/richmenu`

5. 設為全體預設後立即回讀，必須與新建 Rich Menu ID 相同：

   `GET /v2/bot/user/all/richmenu`

6. 保留舊 default ID 與 `tools/rollback_rich_menu_default.ps1`；手機 LINE App 實機目視列為發布後驗收，不得以桌面版冒充。

全體 default 設定後會對沒有個別 Rich Menu 的使用者生效；LINE API 回傳成功仍不等於手機真人旅程已驗收。

## 八、最小充分驗收清單

- [ ] JSON 通過 LINE Rich Menu validate endpoint。
- [ ] PNG 為 `2500 × 843`、JPEG／PNG、`≤ 1 MB`。
- [ ] 390px 寬縮圖仍看得清三個主標，沒有裁切、重疊或過小文字。
- [ ] 三個點擊 bounds 無縫覆蓋整張圖，沒有死區或互相重疊。
- [ ] 使用手機 viewport 與真實 touch 事件逐一點擊三區。
- [ ] 手機 LINE App 真人逐一點擊三區，確認路由、Reply、焦點與選單收合／展開。
- [ ] Postback 沒有 `displayText`，聊天室不會冒出假裝是使用者送出的指令。
- [ ] 既有 Quick Reply、一般問答、`#查手冊`、`#再詳細說明`、`#搜尋網路` 全部回歸通過。
- [ ] 連點同一區不會重複 Reply 或造成重型任務併發。
- [ ] 正式執行紀錄符合中位數與 P95 延遲門檻。
- [ ] Per-user 綁定回讀正確，default Rich Menu ID 未變。
- [ ] 實作完成後依 `AGENTS.md` 使用唯一正式發布入口：`tools\release_existing_webhook.ps1`；不得只執行 `clasp push`。

## 九、明確禁止事項

- 不得把本參考圖中的「辨識發票／查詢單張／所有列表」直接部署到客服 Bot。
- 不得把 Quick Reply 說成常駐選單。
- 不得以 message action 冒充 postback，造成聊天室充滿 `#指令`。
- 不得硬編碼 Channel Access Token。
- 不得只看桌機截圖或單元測試就宣稱手機 LINE 完成。
- 不得在未經業主核准前替換全體 default Rich Menu。
- 不得為文件交接本身部署正式服務；只有實際程式變更完成並通過驗收後才發布。
