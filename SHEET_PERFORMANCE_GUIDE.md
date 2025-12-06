# 📊 Sheet 記憶性能分析與最佳化方案

**分析日期**: 2025/12/06  
**版本**: v24.3.0

---

## 問題 1: Sheet 讀取會不會變慢？

### 性能指標

| 操作 | 時間 | 代價 |
|------|------|------|
| **Cache 讀取** | ~5ms | 0 Token |
| **Sheet 讀取（冷啟）** | ~500-1000ms | 0 Token |
| **Sheet 讀取（已打開）** | ~100-200ms | 0 Token |
| **Gemini API 呼叫** | ~2-3s | $$ Token |

### 結論
```
❌ 直接從 Sheet 讀取每個訊息 → 會變慢 50-200ms/訊息

✅ 混合策略：
   Layer 1 (Cache) → 同句話多步驟（快）
   Layer 2 (Sheet) → 只在 Cache Miss 時讀取（罕見）
   → 平均延遲 < 50ms（可接受）
```

---

## 問題 2: 存儲位置怎麼放最好？

### 方案比較

#### ❌ 方案 A: 把完整對話歷史放一個 Sheet 的 A:Z
**問題**:
- 用戶多時，Sheet 會有 10,000+ 行
- 每次查詢都要掃整個 Sheet（O(n)）
- Google Sheets API 有 100 QPS 限制

#### ❌ 方案 B: 每個用戶一個 Sheet
**問題**:
- Spreadsheet 最多 200 個 Sheet（限制）
- Sheet 切換成本高
- 無法批量查詢多用戶統計

#### ✅ 方案 C: 混合分層（推薦）

```
┌─ Spreadsheet (已有)
│
├─ Sheet: "LAST_CONVERSATION" (已有，保留)
│  ├─ A 欄: contextId (用戶 + 時間戳)
│  ├─ B 欄: 完整對話歷史 JSON
│  └─ 用途: 最新 1 個對話（快速查詢）
│
├─ Sheet: "CONTEXT_METADATA" (新增)
│  ├─ A 欄: userId
│  ├─ B 欄: lastContextId (最新對話 ID)
│  ├─ C 欄: models (逗號分隔)
│  ├─ D 欄: brand
│  ├─ E 欄: features (逗號分隔)
│  ├─ F 欄: scenario (逗號分隔)
│  ├─ G 欄: lastUpdate (時戳)
│  └─ 用途: 快速查詢用戶歷史上下文（秒級）
│
└─ Sheet: "ARCHIVE_CONVERSATION" (長期)
   ├─ 每月輪轉一次（如 ARCHIVE_202512）
   ├─ 儲存已結束的完整對話
   └─ 用途: 統計分析、長期參考
```

#### 性能對比

| 操作 | 方案 C 時間 | 代價 |
|------|-----------|------|
| 讀最新對話 | ~100ms (Cache) | 0 |
| 提取上下文 | ~50ms (Cache) | 0 |
| 提取歷史上下文 | ~200ms (Sheet) | 0 |
| 存新訊息 | ~500ms (Sheet) | 0 |
| **平均總時間** | **~50-200ms** | **可接受** |

---

## 實作步驟

### Step 1: 建立 CONTEXT_METADATA Sheet（立即）

```
A1: userId          B1: lastContextId    C1: models
A2: U1234567890     B2: 2025120615001    C2: S27DG602SC,S32DG802SC
A3: U9876543210     B3: 2025120614550    C3: M70D
```

### Step 2: 修改 `extractContextFromHistory()`

```javascript
// v24.3.0: 優化版本（先查快取層，再查 Sheet 慢層）
function extractContextFromHistory(userId, contextId) {
    // Step 1: 檢查 CONTEXT_METADATA（快速查詢）
    const metadata = getContextMetadataFromSheet(userId);
    if (metadata && metadata.models) {
        return metadata;
    }
    
    // Step 2: Fallback 到完整歷史解析（較慢）
    const history = getHistoryFromCacheOrSheet(contextId);
    const context = parseContextFromHistory(history);
    
    // Step 3: 寫回 CONTEXT_METADATA（下次更快）
    updateContextMetadata(userId, context);
    
    return context;
}
```

### Step 3: 實作 `getContextMetadataFromSheet()`

```javascript
function getContextMetadataFromSheet(userId) {
    try {
        const sheet = ss.getSheetByName("CONTEXT_METADATA");
        if (!sheet) return null;
        
        const data = sheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
            if (data[i][0] === userId) {
                return {
                    userId: data[i][0],
                    lastContextId: data[i][1],
                    models: (data[i][2] || "").split(",").filter(x => x),
                    brand: data[i][3],
                    features: (data[i][4] || "").split(",").filter(x => x),
                    scenario: (data[i][5] || "").split(",").filter(x => x),
                    lastUpdate: data[i][6]
                };
            }
        }
    } catch(e) {
        writeLog(`[getContextMetadata] 錯誤: ${e.message}`);
    }
    return null;
}
```

### Step 4: 修改 `updateHistorySheetAndCache()`

在寫完 LAST_CONVERSATION 後，也更新 CONTEXT_METADATA：

```javascript
function updateHistorySheetAndCache(cid, prev, uMsg, aMsg) {
    // ... 既有邏輯 ...
    
    // 新增: 同時更新 CONTEXT_METADATA
    const context = extractContextFromHistory(userId, cid);
    updateContextMetadata(userId, context);
}
```

---

## 性能最佳化建議

### 1️⃣ 預熱機制（可選）
```javascript
// Sheet 在 /同步 時預先載入到 Cache
// 避免首次查詢時的 Sheet 讀取延遲
function syncAllContextMetadata() {
    const sheet = ss.getSheetByName("CONTEXT_METADATA");
    const cache = CacheService.getScriptCache();
    
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        const userId = data[i][0];
        cache.put(`metadata_${userId}`, JSON.stringify(data[i]), 3600); // 1h
    }
}
```

### 2️⃣ 定期歸檔（每月）
```javascript
function archiveOldConversations() {
    // 每月 1 號執行
    // 將 LAST_CONVERSATION 中超過 30 天的記錄移至 ARCHIVE_CONVERSATION
    // 清理 CONTEXT_METADATA 中已無效的條目
}
```

### 3️⃣ 讀寫批量化
```javascript
// 不要逐筆寫，改成批量更新
function batchUpdateContextMetadata(updates) {
    const sheet = ss.getSheetByName("CONTEXT_METADATA");
    
    // 只在對話結束時執行一次
    // 而不是每條訊息都寫
}
```

---

## 答案總結

**Q: 會影響時間嗎？**

```
否，如果按此方案實作：
- 同句話內：使用 Cache → ~50ms
- 跨時間邊界：讀 Sheet 快取層 → ~200ms
- 平均延遲：< 100ms（用戶無感知）
```

**Q: 放哪？**

```
建立新 Sheet: CONTEXT_METADATA
- 存 userId + 上下文摘要（型號、品牌、功能、場景）
- 快速查詢，不需掃整個歷史
- 定期歸檔，保持性能
```

---

## 檢查清單

- [ ] 建立 CONTEXT_METADATA Sheet
- [ ] 實作 `getContextMetadataFromSheet()`
- [ ] 實作 `updateContextMetadata()`
- [ ] 修改 `extractContextFromHistory()` 版本
- [ ] 修改 `updateHistorySheetAndCache()` 版本
- [ ] 測試性能（應 < 100ms 延遲）
- [ ] 設定定期歸檔任務
- [ ] 文檔更新
