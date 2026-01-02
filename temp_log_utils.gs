var PENDING_LOGS = [];

function flushLogs() {
    if (PENDING_LOGS.length === 0) return;
    
    // 🧪 TEST MODE: 不寫入 Sheet
    if (IS_TEST_MODE) {
        PENDING_LOGS = [];
        return;
    }

    try {
        if (ss) {
             const logSheet = ss.getSheetByName(SHEET_NAMES.LOG);
             if (logSheet) {
                 // 批量寫入 (Batch Write)
                 logSheet.getRange(logSheet.getLastRow() + 1, 1, PENDING_LOGS.length, 2).setValues(PENDING_LOGS);
                 SpreadsheetApp.flush();
                 
                 // 自動清理：保留最新 500 筆
                 const lastRow = logSheet.getLastRow();
                 if (lastRow > 600) {
                     const deleteCount = lastRow - 500;
                     logSheet.deleteRows(1, deleteCount);
                 }
             }
        }
    } catch(e) {
        console.error("Flush Logs Error: " + e.message);
    } finally {
        PENDING_LOGS = []; // 清空緩衝區
    }
}
