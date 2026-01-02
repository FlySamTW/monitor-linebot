function getHistoryModels(userId) {
    // 簡單實作：從 Cache 的 HISTORY_JSON 中讀取最近的 User Message，並用正則提取型號
    try {
        const cache = CacheService.getScriptCache();
        const historyJson = cache.get(CACHE_KEYS.HISTORY_PREFIX + userId);
        if (!historyJson) return [];
        
        const history = JSON.parse(historyJson);
        const models = [];
        // 反向遍歷 (最新的先找)
        for (let i = history.length - 1; i >= 0; i--) {
            const msg = history[i];
            if (msg.role === 'user') {
                const text = msg.content;
                // 使用與 getRelevantKBFiles 相同的正則
                const match = text.match(/\b(G\d{2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|S\d{2}[A-Z]{2}\d{3}[A-Z]{0,2}|[CF]\d{2}[A-Z]\d{3})\b/g);
                if (match) {
                    match.forEach(m => {
                        if (!models.includes(m)) models.push(m);
                    });
                }
                // 也要找 LS
                const lsMatch = text.match(/LS(\d{2}[A-Z]{2}\d{3}[A-Z]{2})/g);
                 if (lsMatch) {
                    lsMatch.forEach(ls => {
                        const cleanModel = ls.replace(/^LS/, 'S').replace(/XZW$/, '');
                        if (!models.includes(cleanModel)) models.push(cleanModel);
                    });
                }
            }
            if (models.length > 0) break; // 找到最近的一組就停，避免混淆
        }
        return models;
    } catch (e) {
        writeLog(`[getHistoryModels Error] ${e.message}`);
        return [];
    }
}
