# 🏛️ 系統天律 (System Laws)

**建立日期**: 2025/12/06  
**版本**: v24.3.0  
**適用範圍**: 所有回答邏輯、API 整合、提示詞設計

---

## 核心天律 (5 項不可違反)

### ✋ 天律 #1: 不能頭痛醫頭腳痛醫腳

**原則**: 
- 針對使用者需求要全盤考量
- 不能只修補單個問題，要解決根本原因
- 優先考慮架構層面，再考慮具體實作

**違反案例**:
```
❌ 只修固定 M7 型號 Cache → 忽略其他延續性問題
❌ 只改 300s TTL → 忽略跨時間邊界場景
✅ 建立三層記憶架構 → 解決所有延續性問題
```

**檢查清單**: 改動前問自己
- [ ] 這個問題的根本原因是什麼？
- [ ] 這個解決方案會影響其他功能嗎？
- [ ] 有沒有其他相似問題也需要同步修復？

---

### 🚫 天律 #2: 競品、股價類問題

**原則**:
- **競品相關問題**: 不能直接回答 → 轉向官網或告知「無此資訊」
- **股價/匯率**: 絕對不能回答 → 可能涉及投資建議（違法）

**回答範本**:

**競品問題** (如「dell 螢幕怎樣」):
```
抱歉，我只能回答 Samsung 產品相關問題。
如您對 Dell 感興趣，請查詢 Dell 官網。
```

**股價/匯率問題**:
```
抱歉，我無法提供股價或投資相關建議。
請查詢金融相關網站（如 Yahoo 股市）。
```

**實作檢查**:
```javascript
// 檢測競品關鍵字
const competitorKeywords = ['dell', 'asus', 'lg', 'acer', 'hp'];
if (competitorKeywords.some(k => msg.includes(k))) {
    replyMessage(replyToken, "抱歉，我只能回答 Samsung 產品相關問題。");
    return;
}

// 檢測股價/匯率
const forbiddenKeywords = ['股價', '股票', '匯率', '報酬', '投資'];
if (forbiddenKeywords.some(k => msg.includes(k))) {
    replyMessage(replyToken, "抱歉，我無法提供股價或投資相關建議。");
    return;
}
```

**違反後果**: 
- ❌ 提供競品資訊 → 違反三星品牌忠誠度
- ❌ 提供股價建議 → 違反金融法規

---

### 📊 天律 #3: 實時資訊 vs 產品資訊分離

**原則**:
- **實時資訊** (日期、時間、天氣、股票、匯率): 直接調用 API，**不問 AI**
- **產品資訊** (規格、功能、使用指南): 查詢知識庫 + AI 回答
- 必須清楚標記來源（「此為實時資訊」vs「根據手冊」）

**實時資訊清單** (直接 API):
```javascript
// ✅ 直接回答（不問 AI）
"今天幾號" → new Date().toLocaleDateString('zh-TW')
"現在幾點" → new Date().toLocaleTimeString('zh-TW')
"天氣如何" → 調用氣象 API
"台北天氣" → 調用氣象 API

// ❌ 不回答（轉向外部來源）
"股票價格" → 「請查詢 Yahoo 股市」
"匯率多少" → 「請查詢 XE.com」
```

**產品資訊清單** (查知識庫 + AI):
```javascript
"M7 規格" → 查 CLASS_RULES + 查 PDF 手冊
"怎麼組裝" → 查 PDF 手冊 (PDF Mode)
"有沒有喇叭" → 查 CLASS_RULES
"支援什麼介面" → 查 CLASS_RULES + PDF
```

**實作位置**:
```javascript
// linebot.gs 第 ~1835 行
if (/今天|現在|幾月|幾號|幾點|幾分|時間|日期/i.test(msg)) {
    // 直接 API 回答
}
```

---

### 🧠 天律 #4: 三層記憶架構

**原則**: 
- Layer 1 (Cache, 300s): 同句話的多步驟流程
- Layer 2 (Sheet, 永久): 完整對話歷史，自動提取上下文
- Layer 3 (API, 實時): 日期、時間等需要實時更新的內容

**關鍵實作**:
```javascript
// Layer 2: 自動從 Sheet 歷史提取上下文
const context = extractContextFromHistory(userId, contextId);
// → 自動提取型號、品牌、功能、場景

// 不依賴時間限制的 Cache
// 而是依賴 Sheet 永久記錄
```

**跨越時間邊界** (店員隔天回來):
```
14:30 店員A: "M7 多少錢" → Sheet 記錄 + Cache 注入
16:00 店員A: "那它是什麼面板" → Sheet 歷史自動提取 M70D → 查詢 → 正確回答
```

---

### 👥 天律 #5: 使用者隔離

**原則**:
- 同一 Bot 多個使用者時，不能互相干擾
- Cache 鍵必須包含 userId 前綴
- Sheet 查詢必須按 userId 過濾

**實作方式**:
```javascript
// ✅ 正確
const cacheKey = `${userId}:direct_search_models`;
cache.put(cacheKey, data, 300);

// ❌ 錯誤
cache.put('direct_search_models', data, 300);
```

---

## 實作檢查清單

### 每次改動前
- [ ] 是否違反「天律 #1」(頭痛醫頭)?
- [ ] 是否涉及競品/股價 (天律 #2)?
- [ ] 是否正確區分實時資訊/產品資訊 (天律 #3)?
- [ ] 是否使用了三層記憶架構 (天律 #4)?
- [ ] 是否有使用者隔離 (天律 #5)?

### 代碼檢查
```bash
# 檢查是否有競品關鍵字洩露
grep -i "dell\|asus\|lg\|acer" linebot.gs

# 檢查是否有 userId 前綴隔離
grep "cache.put" linebot.gs | grep -v "${userId}"

# 檢查版本號是否更新
head -5 linebot.gs | grep "Version"
```

---

## 違反記錄

| 日期 | 事件 | 天律 | 影響 | 改善 |
|------|------|------|------|------|
| 2025/12/06 | 版本號未更新 v24.2.3→v24.3.0 | #1 | 難以追蹤版本 | ✅ 已修正 |
| 2025/12/06 | 直通車 Cache 只用 300s | #1, #4 | 店員隔天無法繼續問 | ✅ 改用 Sheet 歷史 |
| 2025/12/05 | 型號 Cache 無 userId 隔離 | #5 | 多使用者會互相干擾 | ✅ 已隔離 |

---

## 參考資源

- 架構設計文檔: `SYSTEM_REDESIGN_v24.3.md`
- 版本歷程: `LLM_LOGIC_HISTORY.md`
- 模型設定: `linebot.gs` 第 1-40 行
- 三層記憶實作: `linebot.gs` 第 ~3210 行
