# 邏輯模擬測試 - 10 個真實問題分析

## 模擬環境設定
```javascript
// CLASS_RULES 關鍵字（strongKeywords）
const strongKeywords = [
  "ODYSSEY",           // 系列_Odyssey
  "VIEWFINITY",        // 系列_ViewFinity  
  "SMARTMONITOR",      // 系列_SmartMonitor
  "SMART系列",         // 術語_Smart系列
  "ODYSSEYHUB",        // 術語_OdysseyHub
  "ODYSSEY3D",         // 別稱_Odyssey3D
  "G9", "G8", "G7", "G6", "G5", "M9", "M8", "M7", "M5", "S9", "S8", "S6",  // 別稱
  "QD-OLED", "OLED", "MINILED", "GLAREEFREE", "DISPLAYHDR", ...
  "240HZ", "360HZ", "1000R", "4K", "2K", "5K", ... // 術語
];

// KEYWORD_MAP 範例（根據 CLASS_RULES）
const keywordMap = {
  "ODYSSEY": "電競系列，三星專為玩家打造...",
  "SMARTMONITOR": "智慧聯網螢幕，內建TizenOS...",
  "ODYSSEYHUB": "Odyssey 3D (G90XF) 專屬功能...",
  "ODYSSEY3D": "裸視3D電競螢幕(G90XF)，全球首款...",
  "G90XF": "S27FG900",  // 別稱映射
  "G80SD": "S32DG802SC", // 別稱映射
  "M70D": "S27FM703UC / S32FM703UC / S43FM703UC", // Smart Monitor M7
  "M80D": "S32FM803UC",  // Smart Monitor M8
  "OLED": "OLED自發光面板，特色是純黑表現...",
  "240HZ": "每秒刷新240張畫面，提供極高流暢度...",
  "1000R": "曲度半徑1000mm，最接近人眼視野...",
  "5K": "解析度5120x2880，提供極高像素密度...",
  "TYPE-C": "USB-C介面(含供電)，支援影像傳輸...",
};
```

---

## 問題 1: Odyssey 3D 遊戲體驗
```
用戶輸入：
"我想玩3D遊戲，聽說三星有特殊的螢幕可以不用眼鏡看3D，請問怎麼樣才能享受3D遊戲體驗？"

步驟 1: checkDirectDeepSearch()
  ├─ 輸入訊息轉大寫: "我想玩3D遊戲，聽說三星有特殊的螢幕可以不用眼鏡看3D..."
  ├─ 搜尋 strongKeywords: 
  │  ├─ "ODYSSEY3D"? ❌ (訊息中沒有「3D」完整片語)
  │  ├─ "3D"? ❌ (strongKeywords 沒有「3D」單獨項)
  │  └─ 全部檢查後: ❌ 沒有命中
  └─ ⚠️ 返回 false

步驟 2: getRelevantKBFiles()
  ├─ 讀取訊息: "我想玩3D遊戲，聽說三星有特殊的螢幕可以不用眼鏡看3D..."
  ├─ 提取型號正則: /\b(G\d{2}[A-Z]{1,2}|...)/g
  │  └─ ❌ 沒有提取到任何型號（訊息中沒有明確的型號代碼）
  ├─ 搜尋 KEYWORD_MAP:
  │  ├─ "3D" 包含在 "ODYSSEY3D"? ❌ (訊息中沒有「ODYSSEY3D」作為完整詞)
  │  └─ OLED, ODYSSEY? ❌ (沒有這些詞)
  └─ ❌ exactModels = [] (空)

步驟 3: 匹配 PDF
  └─ ❌ Tier0: 0, Tier1: 0 → Files: 0 / 56

步驟 4: AI 回應模式
  └─ FastMode: 使用 QA + CLASS_RULES 回答
  
【日誌預測】
  ✅ [DirectDeep] 未命中直通車
  ✅ [KB Select] Tier0: 0, Tier1: 0 (No Match: none), Total: 0
  ❌ [KB Load] Files: 0 / 56
  
【問題分析】
🔴 邏輯漏洞：用戶明確提到「3D遊戲」和「不用眼鏡看3D」，應該能識別出 Odyssey 3D
但因為：
  1. strongKeywords 中的 "ODYSSEY3D" 要求完整片語「ODYSSEY3D」，但訊息是「3D遊戲」
  2. 訊息中沒有完整的「ODYSSEYHUB」關鍵字
  3. 正則無法識別「G90XF」（訊息沒有提)

【建議修復】
  → 在 strongKeywords 中添加「3D」單獨項
  → 或改進 checkDirectDeepSearch() 的匹配邏輯，支持「3D」獨立匹配到 Odyssey3D
```

---

## 問題 2: SmartMonitor 功能查詢
```
用戶輸入：
"我想要一台螢幕可以直接看Netflix，不需要接電腦，有推薦的嗎？"

步驟 1: checkDirectDeepSearch()
  ├─ 訊息轉大寫: "我想要一台螢幕可以直接看NETFLIX，不需要接電腦..."
  ├─ 搜尋 strongKeywords:
  │  ├─ "SMARTMONITOR"? ❌ (訊息沒有提)
  │  ├─ "SMART"? ❌ (strongKeywords 是 "SMART系列" 不是 "SMART")
  │  └─ 全部檢查: ❌ 沒有命中
  └─ ❌ 返回 false

步驟 2: getRelevantKBFiles()
  ├─ 訊息無型號提取
  ├─ KEYWORD_MAP 搜尋: "NETFLIX" 無匹配
  └─ ❌ exactModels = []

步驟 3: 匹配 PDF
  └─ ❌ Files: 0 / 56

【日誌預測】
  ❌ [DirectDeep] 未命中直通車 (SMART 匹配失敗)
  ❌ [KB Select] Tier0: 0, Tier1: 0 (No Match: none), Total: 0

【問題分析】
🔴 邏輯漏洞：
  1. CLASS_RULES 中是「系列_SmartMonitor」和「術語_Smart系列」
  2. strongKeywords 中會是「SMARTMONITOR」和「SMART系列」
  3. 但用戶只說「直接看Netflix」，沒有提「Smart」「Monitor」等關鍵字
  4. 系統無法識別用戶的隱含需求

【建議修復】
  → 需要在 QA.csv 中有「Netflix看串流」→ SmartMonitor 的關聯
  → 或改進 AI 理解邏輯
```

---

## 問題 3: OLED 技術差異
```
用戶輸入：
"OLED螢幕跟一般LCD螢幕差在哪裡？三星的OLED螢幕哪個型號最新？"

步驟 1: checkDirectDeepSearch()
  ├─ 訊息轉大寫: "OLED螢幕跟一般LCD螢幕差在哪裡？三星的OLED螢幕哪個型號最新？"
  ├─ 搜尋 strongKeywords:
  │  ├─ "OLED"? ✅ 命中！（strongKeywords 包含「OLED」）
  │  ├─ "LCD"? ❌ (不在 strongKeywords)
  │  └─ 找到 hitKey = "OLED"
  ├─ 查詢 KEYWORD_MAP["OLED"]
  │  └─ "OLED自發光面板，特色是純黑表現、無限對比度與極速0.03ms反應時間..."
  ├─ 提取型號: /\b(G\d{2}[A-Z]{1,2}|M\d{2}[A-Z]|S\d{2}[A-Z]{2}\d{3}[A-Z]{0,2}|...)/g
  │  ├─ 搜尋「OLED自發光面板...」中的型號: ❌ 沒有
  │  └─ models = [] (空)
  ├─ 由於 models.length === 0，不注入 Cache
  └─ ❌ 返回 true (但無型號注入)

步驟 2: getRelevantKBFiles()
  ├─ 檢查 Cache['direct_search_models']: ❌ 為空 (上步沒有注入)
  ├─ 訊息提取型號: ❌ 無
  ├─ KEYWORD_MAP 搜尋: "OLED" → "OLED自發光面板..."
  │  └─ 提取型號: ❌ 沒有
  └─ ❌ exactModels = []

步驟 3: 匹配 PDF
  └─ ❌ Files: 0 / 56

【日誌預測】
  ✅ [DirectDeep] 命中 OLED
  ✅ [DirectDeep] 查詢 KEYWORD_MAP[OLED] = OLED自發光面板...
  ✅ [DirectDeep] 從映射值提取型號: NONE
  ✅ [DirectDeep] ⚠️ 無法從映射值提取型號，跳過注入
  ❌ [KB Select] Tier0: 0, Tier1: 0 (No Match: none), Total: 0
  ✅ FastMode: 使用 CLASS_RULES 中的 OLED 定義回答

【分析】
✅ 符合預期行為！系統正確地：
  1. 命中「OLED」直通車關鍵字
  2. 識別出無型號可提取
  3. 降級到 FastMode 使用 CLASS_RULES 回答
```

---

## 問題 4: 5K + 設計用途
```
用戶輸入：
"我是圖片編輯設計師，需要5K高解析度的螢幕，有什麼推薦？"

步驟 1: checkDirectDeepSearch()
  ├─ 訊息轉大寫: "我是圖片編輯設計師，需要5K高解析度的螢幕..."
  ├─ 搜尋 strongKeywords:
  │  ├─ "5K"? ✅ 命中！
  │  └─ hitKey = "5K"
  ├─ 查詢 KEYWORD_MAP["5K"]
  │  └─ "解析度5120x2880，提供極高像素密度，適合細膩修圖與文字工作。"
  ├─ 提取型號: ❌ 無
  └─ ❌ 返回 true (無型號注入)

步驟 2: getRelevantKBFiles()
  ├─ Cache 無型號
  ├─ 訊息提取型號: ❌ 無（5K不是型號)
  ├─ KEYWORD_MAP["5K"]: 無型號
  └─ ❌ exactModels = []

步驟 3: 匹配 PDF
  └─ ❌ Files: 0 / 56

【日誌預測】
  ✅ [DirectDeep] 命中 5K
  ✅ [DirectDeep] 從映射值提取型號: NONE
  ❌ [KB Select] Tier0: 0, Tier1: 0 (No Match: none), Total: 0
  ✅ FastMode: 搜尋 QA（應該能找到 ViewFinity S9 相關內容）

【分析】
✅ 符合預期！系統應該用 QA 推薦 S90 (ViewFinity S9 5K)
```

---

## 問題 5: 型號直接查詢
```
用戶輸入：
"S27FG900這台螢幕的價格多少？有什麼特色？"

步驟 1: checkDirectDeepSearch()
  ├─ 訊息轉大寫: "S27FG900這台螢幕的價格多少？有什麼特色？"
  ├─ 搜尋 strongKeywords:
  │  └─ ❌ 沒有直通車關鍵字命中
  └─ ❌ 返回 false

步驟 2: getRelevantKBFiles()
  ├─ 提取型號: /\bS27FG900\b/
  │  └─ ✅ 命中 "S27FG900"
  ├─ exactModels = ["S27FG900"]
  ├─ 自動生成短型號: 
  │  ├─ S27FG900 不符合「10字」標準，跳過生成
  │  └─ exactModels = ["S27FG900"]
  ├─ 匹配 PDF:
  │  ├─ LS27FG900XCXZW? (對應 S27FG900)
  │  └─ ✅ Tier1: [S27FG900 手冊]
  └─ ✅ exactModels = ["S27FG900"]

步驟 3: 匹配 PDF
  └─ ✅ Tier1: 1 個 → Files: 1 / 56

【日誌預測】
  ✅ [DirectDeep] 未命中直通車
  ✅ [KB Select] 🎯 命中型號: S27FG900 → 載入 PDF
  ✅ [KB Load] AttachPDFs: true, Files: 1 / 56
  ✅ DeepMode: 使用 PDF 查詢價格和特色

【分析】
✅ 完美符合預期！系統能直接識別型號並載入 PDF
```

---

## 問題 6: M7 vs M8 對比
```
用戶輸入：
"M7和M8有什麼差別？哪個更適合辦公室用？"

步驟 1: checkDirectDeepSearch()
  ├─ 訊息: "M7和M8有什麼差別？..."
  ├─ 搜尋 strongKeywords:
  │  ├─ "M7"? ✅ (別稱_M7 → strongKeywords = "M7")
  │  ├─ "M8"? ✅ (別稱_M8 → strongKeywords = "M8")
  │  └─ hitKey = "M7" (find 找到第一個)
  ├─ 查詢 KEYWORD_MAP["M7"]
  │  └─ "Smart Monitor M7，進階智慧螢幕，VA平面面板，4K解析度..."
  ├─ 提取型號:
  │  ├─ "M70D" ✅
  │  ├─ "S27M7" ✅
  │  ├─ "S32M7" ✅
  │  ├─ "S43M7" ✅
  │  └─ models = ["M70D", "S27M7", "S32M7", "S43M7"]
  └─ ✅ 注入 Cache: "M70D, S27M7, S32M7, S43M7"

步驟 2: getRelevantKBFiles()
  ├─ 讀取 Cache["direct_search_models"]: ["M70D", "S27M7", "S32M7", "S43M7"]
  │  └─ ✅ exactModels = ["M70D", "S27M7", "S32M7", "S43M7"]
  ├─ 訊息提取型號:
  │  └─ "M7", "M8" (但這些是別稱，不符合正則)
  ├─ 自動匹配 PDF:
  │  ├─ LS32FM703UCXZW (S32FM703UC) → M70D? ❓ 
  │  └─ 【問題】正則能否識別「S32FM703UC」→ 「M70D」的映射？
  └─ ⚠️ 需要檢查 PDF 檔名如何編排

步驟 3: 匹配 PDF
  └─ ⚠️ 不確定能否匹配（取決於 PDF 檔名）

【日誌預測】
  ✅ [DirectDeep] 命中 M7
  ✅ [DirectDeep] 從映射值提取型號: M70D, S27M7, S32M7, S43M7
  ⚠️ [KB Select] 需要查看是否能匹配對應 PDF

【問題分析】
🟡 風險點：
  1. 訊息中有「M8」但系統只命中「M7」(因為 find() 找第一個)
  2. 別稱「M7」「M8」無法直接映射到檔名（需要 KEYWORD_MAP）
  3. 需要確認 PDF 檔名是「S27FM703UC」還是「M70D」
```

---

## 問題 7: 240Hz 遊戲
```
用戶輸入：
"我想要一台240Hz的螢幕來玩FPS射擊遊戲，有推薦嗎？"

步驟 1: checkDirectDeepSearch()
  ├─ 訊息: "...240HZ的螢幕來玩FPS射擊..."
  ├─ 搜尋 strongKeywords:
  │  ├─ "240HZ"? ✅ 命中！
  │  └─ hitKey = "240HZ"
  ├─ 查詢 KEYWORD_MAP["240HZ"]
  │  └─ "每秒刷新240張畫面，提供極高流暢度，適合FPS射擊..."
  ├─ 提取型號: ❌ 無
  └─ ❌ 返回 true (無型號注入)

步驟 2: getRelevantKBFiles()
  ├─ Cache 無
  ├─ 訊息無型號
  ├─ KEYWORD_MAP["240HZ"]: 無型號
  └─ ❌ exactModels = []

步驟 3: 匹配 PDF
  └─ ❌ Files: 0 / 56

【日誌預測】
  ✅ [DirectDeep] 命中 240HZ
  ✅ [DirectDeep] 從映射值提取型號: NONE
  ❌ [KB Select] Tier0: 0, Tier1: 0 (No Match: none), Total: 0
  ✅ FastMode: 搜尋 QA（應該有相關內容）

【分析】
✅ 符合預期！FastMode 應能推薦支援 240Hz 的型號
```

---

## 問題 8: 27吋 1000R 曲面
```
用戶輸入：
"我要一台27吋曲面的電競螢幕，聽說有1000R曲度，請問有哪些型號？"

步驟 1: checkDirectDeepSearch()
  ├─ 訊息: "...1000R曲度..."
  ├─ 搜尋 strongKeywords:
  │  ├─ "1000R"? ✅ 命中！
  │  └─ hitKey = "1000R"
  ├─ 查詢 KEYWORD_MAP["1000R"]
  │  └─ "曲度半徑1000mm，最接近人眼視野的曲度..."
  ├─ 提取型號: ❌ 無
  └─ ❌ 返回 true (無型號注入)

步驟 2: getRelevantKBFiles()
  ├─ 訊息無型號提取
  ├─ KEYWORD_MAP["1000R"]: 無型號
  └─ ❌ exactModels = []

【日誌預測】
  ✅ [DirectDeep] 命中 1000R
  ✅ [DirectDeep] 從映射值提取型號: NONE
  ❌ [KB Select] Tier0: 0, Tier1: 0 (No Match: none), Total: 0
  ✅ FastMode: 搜尋 QA（應該能找到 G55C、G65B 等 1000R 型號）

【分析】
✅ 符合預期！QA 應有「1000R曲面 27吋」的推薦
```

---

## 問題 9: USB-C 充電功能
```
用戶輸入：
"我需要一台有USB-C充電功能的螢幕，可以邊充邊工作，你們有這種嗎？"

步驟 1: checkDirectDeepSearch()
  ├─ 訊息: "...USB-C充電功能..."
  ├─ 搜尋 strongKeywords:
  │  ├─ "TYPE-C"? ❓ (訊息中是「USB-C」，strongKeywords 是「TYPE-C」?)
  │  ├─ "USB-C"? ❌ (strongKeywords 是「TYPE-C」不是「USB-C」)
  │  └─ 關鍵字不匹配!
  └─ ❌ 返回 false

步驟 2: getRelevantKBFiles()
  ├─ 訊息無型號
  ├─ KEYWORD_MAP 無匹配
  └─ ❌ exactModels = []

【日誌預測】
  ❌ [DirectDeep] 未命中直通車 (USB-C 無法匹配 TYPE-C)
  ❌ [KB Select] Tier0: 0, Tier1: 0 (No Match: none), Total: 0
  ✅ FastMode: 搜尋 QA（應有相關內容）

【問題分析】
🔴 邏輯漏洞：
  1. CLASS_RULES 中是「術語_Type-C」(大寫 TYPE-C)
  2. 但用戶說「USB-C」
  3. 系統無法識別這個變體

【建議修復】
  → 在 KEYWORD_MAP 中添加「USB-C」→「TYPE-C」的別稱映射
```

---

## 問題 10: 促銷 + 型號
```
用戶輸入：
"最近有什麼活動或促銷嗎？S27FG900有折扣嗎？"

步驟 1: checkDirectDeepSearch()
  ├─ 訊息: "...促銷...S27FG900..."
  ├─ 搜尋 strongKeywords:
  │  ├─ "促銷"? ❌ (非 strongKeywords)
  │  ├─ "活動"? ❌ (非 strongKeywords)
  │  └─ 無直通車命中
  └─ ❌ 返回 false

步驟 2: getRelevantKBFiles()
  ├─ 提取型號: "S27FG900" ✅
  ├─ exactModels = ["S27FG900"]
  └─ ✅ 匹配 PDF

步驟 3: 匹配 PDF
  └─ ✅ Tier1: [S27FG900 手冊] → Files: 1 / 56

步驟 4: AI 查詢活動
  ├─ PDF 搜尋「促銷」「2025年」「雙11」
  ├─ CLASS_RULES 中「活動_2025雙11限時特價」
  │  └─ S27FG900XC($59,900→$49,900)
  └─ ✅ AI 應能識別並回覆促銷資訊

【日誌預測】
  ✅ [DirectDeep] 未命中直通車（促銷非 strongKeywords）
  ✅ [KB Select] 🎯 命中型號: S27FG900 → 載入 PDF
  ✅ [KB Load] Files: 1 / 56
  ✅ [QA/Rules] 從活動欄提取促銷資訊

【分析】
✅ 應該能正確識別型號並回覆促銷資訊
```

---

## 總結邏輯檢查結果

| 問題 | 直通車命中 | 型號提取 | PDF 載入 | 預期模式 | ✅/❌/⚠️ |
|------|----------|---------|---------|---------|----------|
| 1. Odyssey 3D 遊戲 | ❌ | ❌ | ❌ | FastMode | ❌ (應命中) |
| 2. SmartMonitor | ❌ | ❌ | ❌ | FastMode | ❌ (應命中) |
| 3. OLED 技術 | ✅ | ❌ | ❌ | FastMode | ✅ 符合 |
| 4. 5K 設計 | ✅ | ❌ | ❌ | FastMode | ✅ 符合 |
| 5. S27FG900 型號 | ❌ | ✅ | ✅ | DeepMode | ✅ 符合 |
| 6. M7 vs M8 | ✅ | ✅ | ⚠️ | DeepMode | ⚠️ 需驗證 |
| 7. 240Hz 遊戲 | ✅ | ❌ | ❌ | FastMode | ✅ 符合 |
| 8. 1000R 曲面 | ✅ | ❌ | ❌ | FastMode | ✅ 符合 |
| 9. USB-C 充電 | ❌ | ❌ | ❌ | FastMode | ❌ (TYPE-C 不匹配) |
| 10. 促銷 + S27FG900 | ❌ | ✅ | ✅ | DeepMode | ✅ 符合 |

---

## 🔴 發現的邏輯漏洞

### 高優先級
1. **問題 1:** 用戶說「3D遊戲」，無法命中「ODYSSEY3D」直通車
   - 原因：訊息中缺少完整的「ODYSSEY3D」片語
   - 修復：添加「3D」作為獨立關鍵字，或改進匹配邏輯

2. **問題 2:** 用戶說「Netflix」，無法識別 SmartMonitor
   - 原因：用戶沒有提「Smart」「Monitor」等關鍵字
   - 修復：需要在 QA 中添加「Netflix → SmartMonitor」的映射

3. **問題 9:** 用戶說「USB-C」，無法命中「TYPE-C」
   - 原因：keyword 不匹配（USB-C vs TYPE-C）
   - 修復：在 KEYWORD_MAP 中添加「USB-C」別稱

### 中優先級
4. **問題 6:** M7、M8 別稱映射到 S 型號時，PDF 檔名是否能正確匹配？
   - 需要驗證：KEYWORD_MAP 中「M70D」是否映射到正確的 S 型號，以及 PDF 檔名

5. **問題 2:** 活動欄（「活動_2025雙11限時特價」）不在 strongKeywords，無法被直通車識別
   - 可能需要改進活動推薦邏輯

---

## 修復建議清單

```javascript
// v24.1.11 建議改進

1. 添加「3D」作為獨立關鍵字
   strongKeywords.push("3D");
   KEYWORD_MAP["3D"] = "裸視3D電競螢幕(G90XF)...";

2. 改進 USB-C 匹配
   KEYWORD_MAP["USB-C"] = KEYWORD_MAP["TYPE-C"];

3. 檢查 M7/M8 的別稱映射
   驗證 KEYWORD_MAP["M70D"] 是否正確映射到 S 型號

4. 改進 SmartMonitor 識別
   在 QA 中添加：「Netflix/YouTube/串流→SmartMonitor」

5. 改進活動識別
   監測訊息中的「活動」「促銷」「折扣」關鍵字
```
