# 系統重設計 v24.3 - 完整對話上下文管理

**原則：不能頭痛醫頭腳痛醫腳，針對使用者需求要全盤考量**

## 問題根源分析

### 現狀問題
1. **型號問題只是冰山一角** - M7 面板問題不是型號 Cache 問題，而是缺乏完整上下文管理
2. **設計導向錯誤** - 用短期 Cache (300s) 管理可能跨半天的對話
3. **資訊層級混淆** - 沒有區分「產品記憶」vs「實時資訊」vs「對話歷史」

### 核心缺陷
```
現有架構：
  User Question → Extract Model → Cache (300s) → PDF Search
  
  問題：
  - 只能記住型號，無法記住「使用者在討論什麼場景」
  - 店員半小時後回來繼續問 → Cache 過期 → 型號丟失
  - 其他延續性問題（如「那這個功能怎麼用」）也會失敗
```

## 設計原則 (5 項)

### 1. 三層記憶架構
```
┌─ Layer 1: 對話快取 (Cache, 300s)
│  用途：同一個句子的多步驟流程
│  例子：「M7 怎麼組裝」→ 提取型號 → 檢查是否需要 PDF
│
├─ Layer 2: 對話歷史 (Firestore/Sheet, 永久)
│  用途：記錄使用者完整對話，跨越時間邊界
│  內容：用戶 ID, 型號, 品牌, 功能, 場景, 時戳
│  回收：對話長度超過 20 句或超過 24h 時清理
│
└─ Layer 3: 即時資訊 (API/計算, 實時)
   用途：日期、時間、天氣、股票等需要實時更新的內容
   來源：系統 API，不經由 AI 回答
```

### 2. 上下文自動提取
```javascript
// 每次訊息進來時：
const context = {
  models: extractModels(history),        // 本對話提及的所有型號
  brands: extractBrands(history),        // 品牌
  features: extractFeatures(history),    // 功能特徵
  scenario: extractScenario(history),    // 使用場景
  lastQuestion: lastMsg.content,         // 上一個問題
  conversationTopic: detectTopic(history) // 對話主題
};

// 傳給 AI 上下文
const systemPrompt = buildContextPrompt(context);
```

### 3. 實時資訊 vs 產品資訊分離
```
實時資訊（直接回答，不問 AI）：
  ✅ 日期、時間
  ✅ 天氣
  ✅ 股票、匯率（但要標記「截至時間」）
  ✅ 系統日誌、營運狀態

產品資訊（查詢知識庫 + AI）：
  ✅ 規格、功能
  ✅ 使用指南
  ✅ 故障排除
```

### 4. 使用者身份隔離
```
問題：同一個 LINE Bot 可能有多個店員使用
目前：型號注入到全域 Cache → 店員 A 的型號被店員 B 覆蓋

解決方案：
  userId + conversationId 作為隔離鍵
  
  Cache 鍵：`{userId}:direct_search_models`
  Sheet 鍵：`{userId}` 作為 Row 查詢條件
```

### 5. 對話結束邊界清晰
```
對話結束時機：
  1️⃣ 執行 /重啟 (用戶主動)
  2️⃣ 24h 無互動自動清理 (系統)
  
清理內容：
  - 該使用者的 Sheet 對話歷史（移至歸檔）
  - 該使用者的 Cache 快取
  - 但保留統計資訊供分析
```

## 實作路線圖

### Phase 1: 完整對話歷史（立即實作）
```
目標：所有對話內容持久化到 Sheet（已有）

修改：
  1. 確保每個訊息都記錄完整上下文
  2. 增加「提取字段」(models, features, scenario)
  3. Sheet 按 userId 分組查詢
```

### Phase 2: 上下文自動提取（1-2 天）
```
目標：每次訊息自動提取型號、品牌、功能、場景

實作：
  1. 創建 `extractContextFromHistory()` 函數
  2. 從對話歷史中智能提取 metadata
  3. 在 AI Prompt 中注入完整上下文
```

### Phase 3: 實時資訊 API（1 天）
```
目標：日期、時間、天氣等直接回答，不問 AI

實作：
  1. 檢測「日期」、「時間」、「天氣」等關鍵詞
  2. 直接調用系統 API
  3. 標記「此為實時資訊」
```

### Phase 4: 使用者隔離（1 天）
```
目標：多使用者場景下不互相干擾

修改：
  1. 所有 Cache 鍵加上 userId 前綴
  2. 所有 Sheet 查詢加上 userId 過濾
  3. 測試多使用者並發
```

## 對現有代碼的改動

### 立即修復（v24.2.5 已做，但不完整）
```
❌ 當前：cache.remove('direct_search_models')
✅ 改為：不刪除，讓 Layer 2 (Sheet) 管理生命周期
```

### 需要做但沒做
```
❌ 缺少：extractContextFromHistory() 函數
❌ 缺少：智能場景檢測
❌ 缺少：實時資訊 API 整合
❌ 缺少：多使用者隔離
```

## 對現有 M7 問題的完整解決

```
情景：
  14:30 店員 A: 「m7 多少錢」
        → 注入 M70D 到 Cache
        
  16:00 店員 A 回來: 「那它是使用什麼面板」
        → Cache 已過期 (>300s)
        → 但 Sheet 歷史記錄中仍有 M70D
        → 自動從歷史中提取 M70D
        → 查詢 CLASS_RULES → 回答正確
```

## 成本影響

| 方案 | Token 增加 | 頻率 |
|------|-----------|------|
| Layer 2 (Sheet) | +100 tokens (查詢) | 每個訊息 1 次 |
| 上下文提取 | +500 tokens (完整歷史) | 每 5 個訊息 1 次 |
| **總計** | **~+100/msg** | - |
| **月成本增加** | **~NT$300** | - |

**可接受** ✅

## 檢查清單

- [ ] Phase 1: 對話歷史完整記錄
- [ ] Phase 2: 上下文自動提取函數
- [ ] Phase 3: 實時資訊 API
- [ ] Phase 4: 使用者隔離
- [ ] 測試：店員隔離場景
- [ ] 測試：跨越時間邊界的延續提問
- [ ] 文檔：更新天律和架構文檔
