/**
 * LINE Bot Assistant - 台灣三星電腦螢幕專屬客服 (Gemini 2.5 Flash-Lite)
 * Version: 24.1.2 (API 400 修復 - thinkingConfig 位置修正)
 * 
 * 🔥 v24.1.2 更新 - 修復 API 400 錯誤：
 * - 根本原因：thinkingConfig 參數位置錯誤（應在 generationConfig 內部，非 payload 頂層）
 * - 修復方案：將所有 thinkingConfig 移至 generationConfig 內部
 * - 恢復 Think Mode 功能：PDF Mode 開啟 thinkingBudget: 2048，Fast Mode 設為 0
 * - 解決「Invalid JSON payload received. Unknown name \"thinkingConfig\"」錯誤
 * 
 * 🔥 v24.1.1 更新 - 測試模式顯示 Token 用量：
 * - DEBUG_SHOW_TOKENS: 在回覆末尾顯示 In/Out/Total + NT$成本
 * - 匯率更新: 32 (原 30)
 * - 費率確認: Input $0.10/1M, Output $0.40/1M (含 thinking)
 * 
 * 🔥 v24.1.0 更新 - Token 優化 + PDF 閱讀理解提升：
 * 
 * 【Token 優化】
 * - QA/Rules 智慧搜尋：找到足夠就停 (上限 15 筆)，不再全撈
 * - Prompt.csv 精簡：65行 → 48行，保留所有規則但縮短用詞
 * - 預估 Fast Mode: ~2-3K Tokens (原 5K+)
 * 
 * 【Think Mode 策略】
 * - PDF Mode: 開啟 Think (thinkingBudget: 2048)，提升閱讀理解
 * - Fast Mode: 關閉 Think，QA/Rules 已是整理好的答案
 * - 成本增加 <10%，智商提升顯著
 * 
 * 【PDF 匹配修正】
 * - 術語 (Odyssey Hub, 3D) 不再參與 PDF 檔名匹配
 * - 只有「真正的型號」(G90XF, S27FG900) 才用於匹配 PDF
 * - 避免載入不相關的手冊
 * 
 * 【禁動區宣告】
 * - writeRecordDirectly: 欄位順序 [時間, ContextID, UserID, 訊息, Role, Flag] 禁止修改
 * - SHEET_NAMES: 結構禁止修改
 * 
 * 🔥 v24.0.0 更新 - 「準 > 聰明 > 省錢」深思熟慮版：
 * - 設計哲學：準確 > 聰明 > 省錢
 * - 恢復記憶：HISTORY_PAIR_LIMIT 10 / PDF_HISTORY_LIMIT 6
 * - 直通車空白容錯：「Odyssey Hub」=「OdysseyHub」
 * 
 * 🔥 v23.6.4 更新：
 * - 核心重構：導入「有大腦、有溫度、守紀律」三大準則 (Hybrid Knowledge Strategy)
 * - 記憶升級：實作 Rolling Summary (滾動式摘要)，保留長期記憶同時控制 Token
 * - 體驗優化：修正過期活動處理邏輯 (客觀中性)，移除惹人生氣的「溫馨提醒」
 * - 成本優化：維持 Dynamic Context 架構，Token 消耗穩定在低水位
 * 
 * 🔥 v23.5.4 更新：
 * - 修正：PDF 匹配邏輯增強，自動去除型號後綴 (如 SC, XC) 以匹配 PDF 檔名
 * - 範例：S32DG802SC -> 自動嘗試 S32DG802，解決 CSV 與 PDF 檔名不一致問題
 * 
 * 🔥 v23.5.3 更新：
 * - 修正：計價公式更新為 Gemini 2.5 Flash-Lite 正式費率 ($0.10/$0.40)
 * - 修正：Log 顯示明確標示費率基準，移除預估字樣
 * 
 * 🔥 v23.5.1 更新：
 * - 修正：直通車關鍵字邏輯 (嚴格模式，僅限 CLASS_RULES 定義的系列/術語)
 * 
 * 🔥 v23.5.0 更新：
 * - 新增：Token 用量紀錄 (Prompt/Candidate/Total)
 * - 新增：PDF 命中詳細紀錄 (命中型號與載入檔名)
 * - 修正：CLASS_RULES 格式相容性 (支援「型號：S...」在第一欄)
 * - 修正：關鍵字前綴處理 (正確移除「系列_」)
 * - 強化：型號偵測正則 (新增 ODYSSEY HUB, 3D)
 * 
 * 🔥 v23.4.2 更新：
 * - 修正：直通車關鍵字改為動態讀取 CLASS_RULES (不需改程式碼)
 * - 修正：M50F 陀螺儀 QA 描述 (需手動更新 QA.csv)
 * 
 * 🔥 v23.4.1 更新：
 * - 修正：QA 資料讀取邏輯 (包含第一行資料)
 * - 優化：別稱映射邏輯 (忽略僅後綴差異的無意義映射)
 * - 強化：System Prompt 強制優先遵循 QA 內容
 * 
 * 🔥 v23.4.0 更新：
 * - 模型升級：全面改用 Gemini 2.5 Flash-Lite (gemini-2.5-flash-lite)
 * - 性能提升：官方數據指出 2.5 Flash-Lite 在數學與推理能力顯著優於 2.0 版本
 * - 成本維持：維持高性價比策略，並移除 Thinking Mode 以節省 Output Tokens
 * 
 * 🔥 v23.3.0 更新：
 * - 移除 Thinking Mode：完全關閉思考預算 (thinkingBudget)
 * 
 * 🔥 v23.2.0 更新：
 * - 別稱映射只在真正有差異時才 Log
 * 
 * 版本保證：
 * 1. [絕對展開] 所有函式與邏輯判斷強制展開 (Block Style)。
 * 2. [上下文增強] getRelevantKBFiles 讀取雙方最近 6 句。
 * 3. [通用映射] 透過 CLASS_RULES 自動建立關鍵字關聯。
 * 4. [AUTO_SEARCH_PDF] AI 判斷資料不足時提示使用者選擇深度搜尋。
 * 5. [NEW_TOPIC] AI 判斷換題時自動退出 PDF 模式。
 * 6. [精準匹配] PDF 只載入完全匹配型號的手冊，不做模糊匹配。
 */

/**
 * 檢查是否命中直通車關鍵字 (強制開啟 PDF 模式)
 * 來源：CLASS_RULES 自動產生的 keywordMap (包含別稱與術語)
 */
function checkDirectDeepSearch(msg) {
    try {
        const upperMsg = msg.toUpperCase();
        const upperMsgNoSpace = upperMsg.replace(/\s+/g, '');

        // 1. 檢查 CLASS_RULES 的直通車關鍵字 (如果有的話)
        // 這些通常是「系列名」或「特殊術語」，用戶定義這些詞需要深度搜尋
        const listJson = PropertiesService.getScriptProperties().getProperty(CACHE_KEYS.STRONG_KEYWORDS);
        if (listJson) {
            const strongKeywords = JSON.parse(listJson);
            const hitStrong = strongKeywords.some(key => {
                if (key.length < 3) return false;
                // 2025-12-05 修正：同時檢查「原始字串」與「去空白字串」
                // 解決 CSV Key 為 "OdysseyHub" 但用戶輸入 "Odyssey Hub" 的問題
                return upperMsg.includes(key) || upperMsgNoSpace.includes(key);
            });
            if (hitStrong) {
                writeLog("[DirectDeep] 命中 CLASS_RULES 直通車關鍵字");
                return true;
            }
        }

        // 2025-12-05 修正：移除「命中 PDF 型號即強制開啟」的邏輯
        // 回歸 Brain-First 架構：優先使用 Fast Mode (QA/Rules)，
        // 只有當 LLM 判斷資料不足並輸出 [AUTO_SEARCH_PDF] 時，才進入 Deep Mode。
        // 避免簡單規格問題 (如 S57CG95 有沒有喇叭) 也浪費 Token 讀 PDF。
        
        return false;
    } catch (e) {
        writeLog("[Error] checkDirectDeepSearch: " + e.message);
        return false;
    }
}

// 輔助：字串分塊 (避免 Cache 單一 Key 超過 100KB)
function chunkString(str, size) {
    const numChunks = Math.ceil(str.length / size);
    const chunks = [];
    for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
        chunks.push(str.substr(o, size));
    }
    return chunks;
}

/**
 * 建立動態上下文 (Dynamic Context)
 * 根據用戶訊息，從 Cache 中撈取相關的 QA 和 Rules
 */
function buildDynamicContext(messages) {
    try {
        const cache = CacheService.getScriptCache();
        
        // 1. 組合用戶最近訊息 (用於關鍵字匹配)
        let combinedMsg = "";
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                combinedMsg += messages[i].content + " ";
                if (combinedMsg.length > 500) break; // 只看最近 500 字
            }
        }
        const upperMsg = combinedMsg.toUpperCase();
        
        // 2. 載入 QA
        let fullQA = "";
        const qaCount = parseInt(cache.get('KB_QA_COUNT') || '0');
        if (qaCount > 0) {
            for (let i = 0; i < qaCount; i++) {
                fullQA += (cache.get(`KB_QA_${i}`) || "");
            }
        } else {
            // Fallback: 若 Cache 失效，嘗試讀取 Sheet (雖然慢但保險)
            // 這裡簡化處理：若失效則回傳空，依賴 sync 觸發
            writeLog("[DynamicContext] ⚠️ QA Cache Miss");
        }
        
        // 3. 載入 Rules
        let fullRules = "";
        const rulesCount = parseInt(cache.get('KB_RULES_COUNT') || '0');
        if (rulesCount > 0) {
            for (let i = 0; i < rulesCount; i++) {
                fullRules += (cache.get(`KB_RULES_${i}`) || "");
            }
        } else {
            writeLog("[DynamicContext] ⚠️ Rules Cache Miss");
        }
        
        // 4. 載入 Guide
        const guide = cache.get('KB_GUIDE') || "";
        
        // 5. 篩選邏輯 (簡單關鍵字匹配)
        // 提取訊息中的潛在關鍵字 (英文數字組合 > 2碼, 或中文詞彙)
        // 這裡使用簡單策略：將 QA/Rules 依行分割，若該行包含訊息中的關鍵字則保留
        
        // 提取關鍵字 (型號、術語)
        const keywords = (upperMsg.match(/[A-Z0-9]{3,}/g) || []);
        
        // 2025-12-05: 改為「通用中文關鍵字擷取」，不再硬寫死特定詞彙
        // 擷取所有長度 >= 2 的中文詞彙，讓使用者說什麼就查什麼
        const cnKeywords = (upperMsg.match(/[\u4e00-\u9fa5]{2,}/g) || []);
        
        // 2025-12-05: 排除過於寬泛或無意義的關鍵字 (Stop Words)
        // 修正：保留重要產品系列名 (ODYSSEY, SMART, OLED, QLED)，避免過度過濾導致變笨
        const stopList = [
            "SAMSUNG", "MONITOR", "GAMING", "UHD", "WQHD",
            "請問", "可以", "什麼", "怎麼", "如何", "有沒有", "謝謝", "你好", "三星", "螢幕", "顯示器",
            "知道", "告訴", "問題", "一下", "這個", "那個", "因為", "所以", "但是", "如果"
        ];
        
        const filteredKeywords = keywords.filter(k => !stopList.includes(k));
        const filteredCnKeywords = cnKeywords.filter(k => !stopList.includes(k));
        
        const allKeywords = [...new Set([...filteredKeywords, ...filteredCnKeywords])];
        
        let relevantContext = "【精選 QA & 規格】\n";
        
        // 總是加入 Guide (型號識別指南)
        relevantContext += guide + "\n";
        
        // v24.0.0: 智慧搜尋策略 - 找到足夠就停止，節省 Token
        // 搜尋順序：QA (精準答案) → Rules (規格補充)
        // 目標：有關鍵字時最多 15 筆匹配；無關鍵字時最多 10 筆保底
        
        const MAX_KEYWORD_MATCHES = 15;  // 關鍵字匹配上限
        const MAX_FALLBACK = 10;          // 無關鍵字時的保底上限
        let totalMatches = 0;
        
        // 1️⃣ 先搜 QA (優先級最高，通常有完整答案)
        if (fullQA && totalMatches < MAX_KEYWORD_MATCHES) {
            const qaLines = fullQA.split('\n');
            
            if (allKeywords.length > 0) {
                // 有關鍵字：只抓匹配行，找到足夠就停
                for (const line of qaLines) {
                    if (!line.trim()) continue;
                    if (totalMatches >= MAX_KEYWORD_MATCHES) break;
                    
                    if (allKeywords.some(k => line.toUpperCase().includes(k))) {
                        relevantContext += line + "\n";
                        totalMatches++;
                    }
                }
            } else {
                // 無關鍵字：只抓前 N 行保底
                for (let i = 0; i < qaLines.length && totalMatches < MAX_FALLBACK; i++) {
                    if (!qaLines[i].trim()) continue;
                    relevantContext += qaLines[i] + "\n";
                    totalMatches++;
                }
            }
        }
        
        // 2️⃣ 再搜 Rules (補充規格，QA 不夠時才用)
        if (fullRules && allKeywords.length > 0 && totalMatches < MAX_KEYWORD_MATCHES) {
            const ruleLines = fullRules.split('\n');
            
            for (const line of ruleLines) {
                if (!line.trim()) continue;
                if (totalMatches >= MAX_KEYWORD_MATCHES) break;
                
                if (allKeywords.some(k => line.toUpperCase().includes(k))) {
                    relevantContext += line + "\n";
                    totalMatches++;
                }
            }
        }
        
        // 若篩選後內容太少，可能是關鍵字沒抓到，加入一些基礎定義?
        // 暫不加入，保持精簡
        
        return relevantContext;
        
    } catch (e) {
        writeLog(`[DynamicContext Error] ${e.message}`);
        return "";
    }
}

// ==========================================
// 1. 全域配置 (Global Configuration)
// ==========================================

const SHEET_NAMES = { 
  RECORDS: "所有紀錄",
  LOG: "LOG", 
  PROMPT: "Prompt", 
  LAST_CONVERSATION: "上次對話", 
  QA: "QA",
  CLASS_RULES: "CLASS_RULES" 
};

const CACHE_KEYS = { 
  KB_URI_LIST: 'kb_list_v15_0', 
  KEYWORD_MAP: 'keyword_map_v1', 
  STRONG_KEYWORDS: 'strong_keywords_v1',
  HISTORY_PREFIX: 'hist:', 
  ENTRY_DRAFT_PREFIX: 'entry_draft_', 
  PENDING_QUERY: 'pending_query_',
  PDF_MODE_PREFIX: 'pdf_mode_'
};

const CONFIG = {
  MODEL_NAME: 'models/gemini-2.5-flash-lite',  // Gemini 2.5 Flash-Lite (平衡性能與成本)
  MAX_OUTPUT_TOKENS: 8192, 
  HISTORY_PAIR_LIMIT: 10,      // v24.0.0: 恢復記憶長度，Fast Mode 用 (約 2K Tokens)
  PDF_HISTORY_LIMIT: 6,        // v24.0.0: PDF Mode 專用，縮減歷史以容納 PDF (約 1K Tokens)
  SUMMARY_THRESHOLD: 12,       // v24.0.0: 超過 12 對才觸發摘要 (避免過度摘要)
  CACHE_TTL_SEC: 3600,
  DRAFT_TTL_SEC: 300, 
  
  // 管理員與 VIP 設定
  ADMIN_USER_ID: PropertiesService.getScriptProperties().getProperty('ADMIN_USER_ID') || '', 
  VIP_IMAGE_USER: PropertiesService.getScriptProperties().getProperty('VIP_USER_ID') || 'U3526e3a6c4ad0561f4c29584f90dfebe', 
  
  DRIVE_FOLDER_ID: PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID') || '',
  API_ENDPOINT: 'https://generativelanguage.googleapis.com/v1beta'
};

// 初始化 Spreadsheet
let ss = null;
try { 
  ss = SpreadsheetApp.getActiveSpreadsheet(); 
} catch (e) {
  const fallbackId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (fallbackId) {
      try { 
          ss = SpreadsheetApp.openById(fallbackId); 
      } catch (e) {
          console.error("無法開啟試算表: " + e.message);
      }
  }
}

const ALLOW_PUSH = (PropertiesService.getScriptProperties().getProperty("ALLOW_PUSH") || "false") === "true";

// v24.1.0: 測試模式 - 在回覆末尾顯示 Token 用量和成本
const DEBUG_SHOW_TOKENS = (PropertiesService.getScriptProperties().getProperty("DEBUG_SHOW_TOKENS") || "true") === "true";

// 最後一次 API 呼叫的 Token 資訊 (用於測試模式顯示)
let lastTokenUsage = null;

/**
 * 從型號或關鍵字提取 LS 編號，產生三星官網搜尋連結
 * 例：G80SD -> LS32DG802SCXZW -> https://www.samsung.com/tw/search/?searchvalue=LS32DG802SCXZW
 */
function getProductUrl(modelOrKeyword) {
  if (!modelOrKeyword) return null;
  const upperKey = modelOrKeyword.toUpperCase().trim();
  
  // 如果已經是 LS 編號，直接使用
  if (upperKey.startsWith('LS') && upperKey.length > 10) {
    return `https://www.samsung.com/tw/search/?searchvalue=${upperKey}`;
  }
  
  // 從 KEYWORD_MAP 查找對應的 LS 編號
  try {
    const mapJson = PropertiesService.getScriptProperties().getProperty(CACHE_KEYS.KEYWORD_MAP);
    if (mapJson) {
      const keywordMap = JSON.parse(mapJson);
      // 查找關鍵字對應的完整規格文字
      const specText = keywordMap[upperKey] || '';
      // 從規格文字中提取 LS 編號 (格式: LS##XX###XXCXZW)
      const lsMatch = specText.match(/LS\d{2}[A-Z0-9]+CXZW/i);
      if (lsMatch) {
        return `https://www.samsung.com/tw/search/?searchvalue=${lsMatch[0]}`;
      }
    }
  } catch (e) {
    writeLog(`[getProductUrl] 查詢失敗: ${e.message}`);
  }
  
  // 找不到 LS 編號，使用原始關鍵字搜尋
  return `https://www.samsung.com/tw/search/?searchvalue=${encodeURIComponent(upperKey)}`;
}


// ==========================================
// 2. 核心：Gemini 知識庫同步 (Sync)
// ==========================================

function syncGeminiKnowledgeBase(forceRebuild = false) {
  const lock = LockService.getScriptLock();
  try {
    // 嘗試鎖定 2 分鐘
    if (!lock.tryLock(120000)) {
        return "系統忙碌中，請稍後再試";
    }
    
    // 檢查是否有標記需要重建
    const cache = CacheService.getScriptCache();
    const needRebuild = cache.get('kb_need_rebuild') === 'true';
    if (needRebuild) {
        forceRebuild = true;
        cache.remove('kb_need_rebuild');
        writeLog("[Sync] 偵測到 403/404 標記，強制重建");
    }

    writeLog(`[Sync] 開始執行知識庫同步... (forceRebuild: ${forceRebuild})`);
    
    const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    if (!apiKey) {
        throw new Error("缺少 GEMINI_API_KEY");
    }

    // 讀取舊的快取清單
    let oldKbList = [];
    const oldJson = PropertiesService.getScriptProperties().getProperty(CACHE_KEYS.KB_URI_LIST);
    
    // 如果強制重建，先清理 Gemini 上的舊檔案再清除本地快取
    if (forceRebuild) {
        writeLog("[Sync] 強制重建模式，先清理 Gemini 舊檔案...");
        cleanupOldGeminiFiles(apiKey);
        PropertiesService.getScriptProperties().deleteProperty(CACHE_KEYS.KB_URI_LIST);
        oldKbList = [];
    } else if (oldJson) { 
        try { 
            oldKbList = JSON.parse(oldJson); 
        } catch(e) {
            writeLog("[Sync] 舊快取解析失敗，將重建");
        } 
    }
    
    // 建立比對 Map
    const existingFilesMap = new Map();
    oldKbList.forEach(item => { 
        if (item.name) {
            existingFilesMap.set(item.name, item.uri); 
        }
    });

    const newKbList = []; 
    let keywordMap = {};
    let strongKeywords = [];

    // --- A. Sheet 資料處理 (QA優先 + 規則分離) ---
    
    // 1. QA 內容 (最優先)
    let qaContent = "=== 💡 精選問答 (QA - 最優先參考) ===\n";
    const qaSheet = ss.getSheetByName(SHEET_NAMES.QA);
    if (qaSheet && qaSheet.getLastRow() >= 1) {
      // 從第 1 行開始讀取，避免漏掉第一筆資料 (若無標題列)
      const data = qaSheet.getRange(1, 1, qaSheet.getLastRow(), 1).getValues();
      const qaRows = data.map(row => {
          if (!row[0]) return "";
          const text = row[0].toString();
          // 簡單過濾標題列
          if (text.length < 20 && text.match(/^(問題|Question|QA內容)/i)) return "";
          return `QA: ${text}`; 
      }).filter(line => line !== "");
      qaContent += qaRows.join("\n\n");
      writeLog(`[Sync] QA 內容預覽 (前 100 字): ${qaContent.substring(0, 100).replace(/\n/g, ' ')}`);
    }

    // 2. CLASS_RULES (定義與規格分離)
    let definitionsContent = "\n\n=== 📚 通用術語與系列定義 ===\n";
    let specsContent = "\n\n=== 📱 詳細機型規格資料庫 (硬體功能以這裡為準) ===\n";
    
    // 🆕 型號模式識別指南（讓 AI 能識別各種型號格式）
    let modelPatternGuide = `\n\n=== 🔤 型號模式識別指南 ===
【重要】三星螢幕型號有多種格式，以下是對照表：
* S27BM50x / S32BM50x = Smart Monitor M5 系列 (M50)
* S27CM50x / S32CM50x = Smart Monitor M5 系列 (M50)
* S27DM50x / S32DM50x = Smart Monitor M5 系列 (M50)
* S27BM70x / S32BM70x = Smart Monitor M7 系列 (M70)
* S27DG80x / S32DG80x = Odyssey OLED G8 系列 (G80SD/G81SF)
* S27DG60x = Odyssey OLED G6 系列 (G60SD)
* S27FG90x = Odyssey 3D G9 系列 (G90XF)
* S57CG95x = Odyssey G9 系列 (G95SC)
* S27C90x / S32C90x = ViewFinity S9 系列

【價格查詢原則】(最高優先級)
1. 若使用者問價格但資料庫沒有，一律引導到官網
2. 網址中的型號【必須】使用使用者提供的「原始型號」，不要改成系列名
3. 範例：
   - 問「S27BM50 價格」→ 回「價格可到官網確認→ https://www.samsung.com/tw/search/?searchvalue=S27BM50」
   - 問「G80SD 價格」→ 回「價格可到官網確認→ https://www.samsung.com/tw/search/?searchvalue=G80SD」
4. 嚴禁把 S27BM50 改成 M5 或 Smart Monitor，嚴禁繁中混用
`;
    
    const ruleSheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    if (ruleSheet && ruleSheet.getLastRow() > 1) {
      const data = ruleSheet.getRange(2, 1, ruleSheet.getLastRow() - 1, 1).getValues();
      
      data.forEach(row => {
          if (!row[0]) return;
          const text = row[0].toString();
          const parts = text.split(',');
          let rawKey = parts[0] ? parts[0].trim().toUpperCase() : "";
          
          // 收集直通車關鍵字 (僅限 系列/術語/別稱)
          if (rawKey.startsWith("系列_") || rawKey.startsWith("術語_") || rawKey.startsWith("別稱_")) {
              const cleanKey = rawKey.replace(/^(別稱|術語|系列)_/, '');
              if (cleanKey.length >= 3) {
                  strongKeywords.push(cleanKey);
              }
          }

          // 移除前綴 (別稱_, 術語_, 系列_) 以便正確匹配
          let key = rawKey.replace(/^(別稱|術語|系列)_/, '');
          
          // 分流邏輯
          let isModelRow = false;
          let sModel = "";
          
          // 判斷是否為型號規格行 (新格式: 型號：S... 或 舊格式: LS...)
          if (key.startsWith("型號：") || key.startsWith("型號:")) {
              isModelRow = true;
              sModel = key.replace(/^型號[：:]/, '').trim();
              key = sModel; // 將 key 更新為純型號 (S27DG602SC)
          } else if (key.startsWith("LS")) {
              isModelRow = true;
              sModel = key.replace(/^LS/, 'S').replace(/XZW$/, '');
          }

          if (isModelRow) {
              specsContent += `* ${text}\n`;
              
              // 提取別稱建立雙向映射 (G80SD ↔ S32DG802SC)
              // 掃描整行文字尋找可能的別稱 (Gxx, Mxx, Sxx...)
              const potentialAliases = text.match(/\b(G\d{2}[A-Z]{1,2}|M\d{2}[A-Z]|S\d{2}[A-Z]{2}\d{3}[A-Z]{2}|[CF]\d{2}[A-Z]\d{3})\b/g) || [];
              
              potentialAliases.forEach(alias => {
                  alias = alias.toUpperCase();
                  // 排除 S-Model 本身和 LS-Model (避免自我映射)
                  if (alias !== sModel && !alias.startsWith("LS")) {
                       // 排除只是 S-Model 的子字串 (例如 S32DG802SC 包含 S32) - 這裡的正則比較嚴格應該還好
                       // 建立映射: 別稱 -> S-Model
                       keywordMap[alias] = sModel;
                       // writeLog(`[Sync] 別稱映射: ${alias} → ${sModel}`);
                  }
              });
              
              // 確保 LS 型號也能映射到 S 型號
              const lsMatch = text.match(/\bLS\d{2}[A-Z]{2}\d{3}[A-Z]{2}XZW\b/);
              if (lsMatch) {
                  keywordMap[lsMatch[0]] = sModel;
              }

          } else {
              definitionsContent += `* ${text}\n`;
          }
          
          // 建立動態映射 (Map)
          if (key && text.length > key.length) {
              keywordMap[key] = text; 
          }
      });
    }
    
    // 儲存映射表
    PropertiesService.getScriptProperties().setProperty(CACHE_KEYS.KEYWORD_MAP, JSON.stringify(keywordMap));
    PropertiesService.getScriptProperties().setProperty(CACHE_KEYS.STRONG_KEYWORDS, JSON.stringify(strongKeywords));
    writeLog(`[Sync] 建立關鍵字映射: ${Object.keys(keywordMap).length} 筆, 直通車關鍵字: ${strongKeywords.length} 筆`);
    
    // 2025-12-05: 改為動態上下文注入 (Dynamic Context Injection)
    // 不再上傳 samsung_kb_priority.txt，改為將內容存入 Cache/Properties
    // 為了避免 ScriptProperties 9KB 限制，我們將內容分塊儲存或僅存入 CacheService (6小時)
    // 這裡選擇存入 CacheService，並在 getDynamicContext 中若快取失效則重新讀取 Sheet (Fallback)
    
    // const cache = CacheService.getScriptCache(); // 已在上方定義
    // 存入 QA (分塊儲存，每塊 90KB)
    const qaChunks = chunkString(qaContent, 90000);
    cache.put('KB_QA_COUNT', qaChunks.length.toString(), 21600); // 6小時
    qaChunks.forEach((chunk, index) => {
        cache.put(`KB_QA_${index}`, chunk, 21600);
    });
    
    // 存入 Rules (Definitions + Specs)
    const rulesContent = definitionsContent + "\n" + specsContent;
    const rulesChunks = chunkString(rulesContent, 90000);
    cache.put('KB_RULES_COUNT', rulesChunks.length.toString(), 21600);
    rulesChunks.forEach((chunk, index) => {
        cache.put(`KB_RULES_${index}`, chunk, 21600);
    });
    
    // 存入 Model Pattern Guide
    cache.put('KB_GUIDE', modelPatternGuide, 21600);

    /* 舊邏輯：上傳大檔案 (已停用)
    const finalContent = `【第一優先資料庫】\n請絕對優先參考以下資料。\n${qaContent}\n${modelPatternGuide}\n${definitionsContent}\n${specsContent}`;
    const textBlob = Utilities.newBlob(finalContent, 'text/plain', 'samsung_kb_priority.txt');
    const textUri = uploadFileToGemini(apiKey, textBlob, textBlob.getBytes().length, 'text/plain');
    if (textUri) {
        newKbList.push({ name: 'samsung_kb_priority.txt', uri: textUri, mimeType: "text/plain", isPriority: true });
    }
    */

    // --- B. Drive PDF 同步 --- 
    let uploadCount = 0;
    let skipCount = 0;

    if (CONFIG.DRIVE_FOLDER_ID) {
      try {
        const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
        const files = folder.getFilesByType(MimeType.PDF);

        while (files.hasNext()) {
          const file = files.next();
          const fileName = file.getName();
          const fileSize = file.getSize();
          
          // 跳過過大檔案
          if (fileSize > 48 * 1024 * 1024) { 
            writeLog(`[Sync] ⚠️ 跳過過大檔案: ${fileName}`);
            continue;
          }

          if (existingFilesMap.has(fileName)) {
              newKbList.push({ name: fileName, uri: existingFilesMap.get(fileName), mimeType: "application/pdf" });
              skipCount++;
          } else {
              writeLog(`[Sync] 正在上傳: ${fileName}`);
              const pdfUri = uploadFileToGemini(apiKey, file.getBlob(), fileSize, "application/pdf");
              
              if (pdfUri) {
                  newKbList.push({ name: fileName, uri: pdfUri, mimeType: "application/pdf" });
                  uploadCount++;
              } else {
                  writeLog(`[Sync] ❌ 上傳失敗: ${fileName}`);
              }
          }
        }
      } catch (driveErr) {
        writeLog(`[Sync] ⚠️ Drive 讀取失敗: ${driveErr.message}`);
      }
    }

    // 更新 Cache
    PropertiesService.getScriptProperties().setProperty(CACHE_KEYS.KB_URI_LIST, JSON.stringify(newKbList));
    
    const statusMsg = `✓ 重啟與同步完成\n- 新增上傳：${uploadCount} 本\n- 沿用舊檔：${skipCount} 本\n- Sheet 資料：已更新`;
    writeLog(statusMsg);
    
    // 預約下次同步
    scheduleNextSync();

    return statusMsg;

  } catch (e) {
    writeLog(`[Sync Error] ${e.message}`);
    return `系統錯誤: ${e.message}`;
  } finally {
    lock.releaseLock();
  }
}

// 上傳檔案至 Gemini
function uploadFileToGemini(apiKey, blob, fileSize, mimeType) {
  try {
    const initUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
    const headers = {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': fileSize.toString(), 
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json'
    };
    const metadata = { file: { display_name: blob.getName() } };
    
    const initReq = UrlFetchApp.fetch(initUrl, { method: 'post', headers: headers, payload: JSON.stringify(metadata), muteHttpExceptions: true });
    
    if (initReq.getResponseCode() !== 200) {
        return null;
    }
    
    const uploadUrl = initReq.getHeaders()['x-goog-upload-url'];
    
    const uploadReq = UrlFetchApp.fetch(uploadUrl, {
      method: 'post',
      headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
      payload: blob, 
      muteHttpExceptions: true
    });
    
    if (uploadReq.getResponseCode() !== 200) {
        return null;
    }
    
    const fileRes = JSON.parse(uploadReq.getContentText());
    let state = fileRes.file.state;
    let attempts = 0;
    
    while (state === 'PROCESSING' && attempts < 30) {
      Utilities.sleep(1000);
      const check = UrlFetchApp.fetch(`${CONFIG.API_ENDPOINT}/${fileRes.file.name}?key=${apiKey}`);
      state = JSON.parse(check.getContentText()).state;
      attempts++;
    }
    
    if (state === 'ACTIVE') {
        return fileRes.file.uri;
    } else {
        return null;
    }

  } catch (e) {
    writeLog(`上傳錯誤: ${e.message}`);
    return null;
  }
}

// 清理 Gemini 上的所有舊檔案（在 forceRebuild 時呼叫）
function cleanupOldGeminiFiles(apiKey) {
  try {
    writeLog("[Cleanup] 開始清理 Gemini 所有舊檔案...");
    
    let totalDeleted = 0;
    let hasMore = true;
    
    // 持續刪除直到沒有檔案為止（處理超過 100 個的情況）
    while (hasMore) {
      const listUrl = `${CONFIG.API_ENDPOINT}/files?key=${apiKey}&pageSize=100`;
      const listRes = UrlFetchApp.fetch(listUrl, { muteHttpExceptions: true });
      
      if (listRes.getResponseCode() !== 200) {
        writeLog(`[Cleanup] 無法列出檔案: ${listRes.getResponseCode()}`);
        break;
      }
      
      const data = JSON.parse(listRes.getContentText());
      const files = data.files || [];
      
      if (files.length === 0) {
        hasMore = false;
        break;
      }
      
      for (const file of files) {
        try {
          const deleteUrl = `${CONFIG.API_ENDPOINT}/${file.name}?key=${apiKey}`;
          UrlFetchApp.fetch(deleteUrl, { method: 'delete', muteHttpExceptions: true });
          totalDeleted++;
        } catch (delErr) {
          // 忽略單一檔案刪除錯誤
        }
      }
      
      // 如果這批刪完還有 nextPageToken，繼續刪
      hasMore = !!data.nextPageToken;
    }
    
    writeLog(`[Cleanup] 已清理 ${totalDeleted} 個舊檔案`);
    return totalDeleted;
  } catch (e) {
    writeLog(`[Cleanup] 清理失敗: ${e.message}`);
    return 0;
  }
}

function scheduleNextSync() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(t => { 
        if (t.getHandlerFunction() === 'syncGeminiKnowledgeBase') {
            ScriptApp.deleteTrigger(t);
        }
    });
    ScriptApp.newTrigger('syncGeminiKnowledgeBase').timeBased().after(47 * 60 * 60 * 1000).create();
    writeLog("🕒 已預約 47 小時後自動更新知識庫");
  } catch (e) { 
    writeLog(`⚠️ 排程設定失敗: ${e.message}`); 
  }
}

/**
 * 排程 1 分鐘後背景重建知識庫
 * 用於 403/404 過期時自動修復，用戶不需等待
 */
function scheduleImmediateRebuild() {
  try {
    const cache = CacheService.getScriptCache();
    const rebuildKey = 'REBUILD_SCHEDULED';
    
    // 如果近期已排程，不重複建立
    if (cache.get(rebuildKey)) {
      writeLog("[Rebuild] 已有背景重建排程，跳過");
      return;
    }
    
    // 清除現有的 immediateSync 觸發器（如果有）
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(t => { 
        if (t.getHandlerFunction() === 'immediateKnowledgeRebuild') {
            ScriptApp.deleteTrigger(t);
        }
    });
    
    // 建立 1 分鐘後執行的觸發器
    ScriptApp.newTrigger('immediateKnowledgeRebuild').timeBased().after(1 * 60 * 1000).create();
    
    // 標記已排程，10 分鐘內不重複
    cache.put(rebuildKey, 'true', 10 * 60);
    
    writeLog("🔧 已排程 1 分鐘後背景重建知識庫");
  } catch (e) {
    writeLog(`⚠️ 背景重建排程失敗: ${e.message}`);
  }
}

/**
 * 立即重建知識庫的觸發器入口
 * 由 scheduleImmediateRebuild 排程呼叫
 */
function immediateKnowledgeRebuild() {
  writeLog("[Rebuild] 開始背景重建知識庫...");
  try {
    const result = syncGeminiKnowledgeBase(true);  // forceRebuild = true
    writeLog(`[Rebuild] 背景重建完成: ${result.substring(0, 100)}`);
  } catch (e) {
    writeLog(`[Rebuild Error] ${e.message}`);
  }
}

/**
 * 檢查觸發器是否存在，不存在則自動建立
 * 使用快取避免每則訊息都檢查（快取 6 小時）
 */
function ensureSyncTriggerExists() {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'SYNC_TRIGGER_VERIFIED';
    
    // 快取存在 = 近期已確認過，跳過檢查
    if (cache.get(cacheKey)) return;
    
    const triggers = ScriptApp.getProjectTriggers();
    const hasSyncTrigger = triggers.some(t => t.getHandlerFunction() === 'syncGeminiKnowledgeBase');
    if (!hasSyncTrigger) {
      ScriptApp.newTrigger('syncGeminiKnowledgeBase').timeBased().after(47 * 60 * 60 * 1000).create();
      writeLog("🔄 偵測到無排程，已自動建立 47 小時後同步觸發器");
    }
    
    // 標記已確認，6 小時內不再檢查
    cache.put(cacheKey, 'true', 6 * 60 * 60);
  } catch (e) {
    // 靜默失敗，避免影響主流程
  }
}


// ==========================================
// 3. Gemini API (通用映射 + 上下文智慧搜尋)
// ==========================================

function getRelevantKBFiles(messages, kbList) {
    const MAX_PDF_COUNT = 2; // PDF 硬上限（不含 Tier 0）- 降低以加速回應
    const MAX_TIER1_COUNT = 2; // 精準匹配上限
    
    let combinedQuery = "";
    let userCount = 0;
    
    // 1. 讀取上下文 (User + AI, 最近 6 句)
    for (let i = messages.length - 1; i >= 0; i--) {
        combinedQuery += " " + messages[i].content.toUpperCase();
        userCount++;
        if (userCount >= 6) break; 
    }

    // 2. 讀取映射表
    let keywordMap = {};
    try {
        const mapJson = PropertiesService.getScriptProperties().getProperty(CACHE_KEYS.KEYWORD_MAP);
        if (mapJson) {
            keywordMap = JSON.parse(mapJson);
        }
    } catch(e) {}

    // 3. 關鍵字擴充 (查字典) + 提取完整型號
    let extendedQuery = combinedQuery;
    let exactModels = []; // 精準型號清單 (用於匹配 PDF 檔名)
    
    // v24.0.0: 型號正則 - 只匹配「真正的型號」，不匹配術語
    // G系列: G90XF, G80SD, G60F 等（G + 2位數 + 1~2字母）
    // M系列: M50F, M70F, M80F 等（M + 2位數 + 1字母）
    // S系列: S27DG602SC, S32DG802SC 等（S + 2位數 + 完整型號碼）
    // F/C系列 (舊款): F24T350, C24T550 (F/C + 2位數 + 1字母 + 3數字)
    // ⚠️ 不包含 ODYSSEY HUB、3D 等術語 - 這些只用於觸發直通車，不用於 PDF 匹配
    const MODEL_REGEX = /\b(G\d{2}[A-Z]{1,2}|M\d{2}[A-Z]|S\d{2}[A-Z]{2}\d{3}[A-Z]{0,2}|[CF]\d{2}[A-Z]\d{3})\b/g;
    
    Object.keys(keywordMap).forEach(key => {
        if (combinedQuery.includes(key)) {
            const mappedValue = keywordMap[key].toUpperCase();
            extendedQuery += " " + mappedValue;
            
            // 從映射值提取型號 (只提取真正的型號，不含術語)
            const modelMatch = mappedValue.match(MODEL_REGEX);
            if (modelMatch) {
                exactModels = exactModels.concat(modelMatch);
            }
            
            // 提取 LS 系列完整型號 (如 LS27DG602SCXZW → S27DG602SC)
            const lsMatch = mappedValue.match(/LS(\d{2}[A-Z]{2}\d{3}[A-Z]{2})/g);
            if (lsMatch) {
                lsMatch.forEach(ls => {
                    // 去掉 LS 前綴和 XZW 後綴
                    const cleanModel = ls.replace(/^LS/, 'S').replace(/XZW$/, '');
                    exactModels.push(cleanModel);
                });
            }
        }
    });
    
    // 也從原始查詢提取型號
    const directModelMatch = combinedQuery.match(MODEL_REGEX);
    if (directModelMatch) {
        exactModels = exactModels.concat(directModelMatch);
    }
    
    // 從原始查詢提取 LS 系列
    const directLsMatch = combinedQuery.match(/LS(\d{2}[A-Z]{2}\d{3}[A-Z]{2})/g);
    if (directLsMatch) {
        directLsMatch.forEach(ls => {
            const cleanModel = ls.replace(/^LS/, 'S').replace(/XZW$/, '');
            exactModels.push(cleanModel);
        });
    }
    
    exactModels = [...new Set(exactModels)]; // 去重

    // 自動產生短型號以匹配 PDF (S32DG802SC -> S32DG802)
    // 許多 PDF 檔名不包含最後兩碼後綴 (SC, XC, EC...)
    const shortModels = [];
    exactModels.forEach(m => {
        // 針對 S 開頭且長度為 10 的標準型號 (S + 2碼尺寸 + 2碼系列 + 3碼編號 + 2碼後綴)
        if (m.match(/^S\d{2}[A-Z]{2}\d{3}[A-Z]{2}$/)) {
            shortModels.push(m.substring(0, 8));
        }
    });
    exactModels = [...new Set([...exactModels, ...shortModels])]; // 合併並去重

    // 4. 分級載入（只用精準匹配，不做模糊匹配）
    const tier0 = []; // 必載 (QA + CLASS_RULES)
    const tier1 = []; // 精準匹配 (完整型號)
    
    kbList.forEach(file => {
        // Tier 0: 必載
        if (file.isPriority) {
            tier0.push(file);
            return;
        }
        
        const fileName = file.name.toUpperCase();
        
        // Tier 1: 精準匹配 (完整型號如 G90XF, G80SD)
        const isTier1 = exactModels.some(model => fileName.includes(model));
        if (isTier1 && tier1.length < MAX_TIER1_COUNT) {
            tier1.push(file);
            return;
        }
    });
    
    // 5. 純精準匹配策略：不啟用模糊匹配
    //    沒有精準匹配的 PDF？那就不載 PDF，避免載到不相關的手冊
    //    （例如問 G90XF 不應該載到 G80SD 的手冊）
    
    // 6. 組合結果：只有 Tier0（必載）+ Tier1（精準匹配）
    const result = [...tier0, ...tier1];
    
    // 📝 詳細紀錄找到的 PDF
    if (tier1.length > 0) {
        const foundFiles = tier1.map(f => f.name).join(', ');
        writeLog(`[KB Select] 🎯 命中型號: ${exactModels.join(', ')} → 載入 PDF: ${foundFiles}`);
    } else {
        writeLog(`[KB Select] Tier0: ${tier0.length}, Tier1: 0 (No Match: ${exactModels.join(',') || 'none'}), Total: ${result.length}`);
    }
    
    return result;
}

function callChatGPTWithRetry(messages, imageBlob = null, attachPDFs = false, isRetry = false, userId = null) {
    const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    if (!apiKey) throw new Error("API Key Missing");

    let kbList=[]; 
    try {
        kbList = JSON.parse(PropertiesService.getScriptProperties().getProperty(CACHE_KEYS.KB_URI_LIST));
    } catch(e) {}

    const promptSheet = ss.getSheetByName(SHEET_NAMES.PROMPT);
    const configData = promptSheet.getRange("B3:C3").getValues()[0];
    let tempSetting = (typeof configData[0] === 'number') ? configData[0] : 0.6;
    const c3Prompt = configData[1] || "";

    // --- 決定掛載檔案 ---
    let filesToAttach = [];
    let dynamicContext = "";

    if (imageBlob) {
        // 圖片模式：仍使用舊邏輯 (或可優化)
        // 暫時維持原樣，但因為 samsung_kb_priority.txt 已不再生成，這裡需要注意
        // 圖片模式通常不需要太多文字 Context，或者我們也可以注入 Dynamic Context
        dynamicContext = buildDynamicContext(messages);
    } else if (attachPDFs) {
        // PDF 模式：掛載 PDF + Dynamic Context
        filesToAttach = getRelevantKBFiles(messages, kbList);
        dynamicContext = buildDynamicContext(messages);
    } else {
        // 極速模式：只注入 Dynamic Context，不掛載任何檔案
        dynamicContext = buildDynamicContext(messages);
    }

    writeLog(`[KB Load] AttachPDFs: ${attachPDFs}, isRetry: ${isRetry}, Files: ${filesToAttach.length} / ${kbList.length}`);

    // v24.0.0: 根據模式動態調整歷史長度，控制 Token 成本
    // - Fast Mode: 保留 10 對 (20 則)
    // - PDF Mode: 縮減至 6 對 (12 則)，節省約 800 Tokens 給 PDF
    let effectiveMessages = messages;
    if (attachPDFs && messages.length > CONFIG.PDF_HISTORY_LIMIT * 2) {
        // PDF 模式：只保留最近 6 對
        effectiveMessages = messages.slice(-(CONFIG.PDF_HISTORY_LIMIT * 2));
        writeLog(`[Token Control] PDF Mode: 歷史縮減 ${messages.length} -> ${effectiveMessages.length}`);
    }

    // --- 三段式邏輯注入 (v23.6.0 - Brainy, Warm & Disciplined) ---
    let dynamicPrompt = `【Sheet C3 指令】\n${c3Prompt}\n`;
    
    // 注入動態上下文
    if (dynamicContext) {
        dynamicPrompt += `\n${dynamicContext}\n`;
    }

    dynamicPrompt += `\n【⚠️ 最高準則：有大腦、有溫度、守紀律】
1. **角色與語氣**：
   - 請嚴格遵守 [Sheet C3 指令] 中的角色設定（新手專員/朋友口吻/使用「你」）。
   - **禁止**自稱「資深專家」或使用「您」。
   - 雖然是新手朋友，但面對「查無資料」的情況，請展現**遺憾但熱心**的態度（例如：「這個我手邊剛好沒資料，真不好意思，建議你...」），絕對禁止冷漠句點。

2. **知識運用策略 (Hybrid Mode)**：
   - **硬體規格 (Strict)**：關於「有沒有喇叭/耳機孔/Type-C」、「解析度」、「Hz」等硬體規格，**必須**嚴格依據 [CLASS_RULES] 或 [QA] 回答。若資料庫沒寫，視為「沒有」，禁止瞎掰。
   - **一般知識 (Flexible)**：關於「推薦哪台」、「適合玩PS5嗎」、「什麼是OLED」等軟性問題，若資料庫無直接答案，**允許並鼓勵**使用你的通用知識庫進行回答。
   - **時效性資訊處理**：
     - 若使用者**未提及**特定活動，**請勿主動**提及已過期的優惠（例如雙11），以免造成誤會。
     - 若使用者**主動詢問**（如「不是有雙11嗎？」），則**必須**依據資料回答該活動內容，並以**客觀、中性**的方式說明活動期間（例如：「該活動時間為...」），讓使用者自行判斷，**嚴禁**使用「溫馨提醒」等可能引起反感的贅詞。

3. **查無資料處理**：
   - **規格題**：若查無規格，回答「這台型號目前資料庫還沒有詳細規格，建議你直接聯繫 Sam 確認，以免資訊有誤。」
   - **操作題**：若查無步驟，回答「資料庫中暫無此操作手冊，但我根據一般三星螢幕的經驗，通常是在... (提供通用建議)」。

4. **型號稱呼**：
   - 提及型號時，請盡量使用完整型號（如 S32DG802SC），避免只用短代碼，以示專業。

5. **禁止事項**：
   - 禁止說「我是AI」、「我沒有大腦」。
   - 禁止在沒有嘗試回答前就直接叫人找 Sam。
`;
    
    if (!attachPDFs && !imageBlob) {
        // Phase 1: 極速模式 (Fast Mode)
        dynamicPrompt += `\n【🚀 極速模式 - 快速回應】
        你目前使用「精選 QA」與「規格表」進行快速服務。
        
        1. **操作步驟/故障排除**：
           - 若 QA 中有答案 -> 直接回答。
           - 若 QA 中無答案 -> **必須**在回答最後加上暗號 [AUTO_SEARCH_PDF]，系統會自動幫你翻閱 PDF 手冊。
           - 在觸發 [AUTO_SEARCH_PDF] 前，你可以先給出一個簡短的通用建議，並說「稍等，我幫您翻閱詳細手冊...」。
        
        2. **保持對話溫度**：
           - 不要只丟出答案就結束。
           - 例如：「這台有支援 4K 喔！拿來接 PS5 效果很棒，您是打算接主機用的嗎？」`;
    } else if (attachPDFs) {
        // Phase 2 & 3: 深度模式 (Deep Mode)
        dynamicPrompt += `\n【📚 深度搜尋模式 - 已掛載 PDF 手冊】
        系統已為你掛載了 PDF 手冊，請優先從 PDF 中尋找答案。
        
        1. **回答格式**：
           - 請詳細列出步驟（Step-by-Step）。
           - 若 PDF 有多種解法，請全部列出。
           - 引用 PDF 內容時，請轉化為口語化的教學，不要像機器人讀稿。
        
        2. **禁止行為**：
           - 禁止再輸出 [AUTO_SEARCH_PDF] 暗號 (避免無窮迴圈)。
           - 若 PDF 真的沒寫，請用通用知識回答，並註明「手冊未記載，以上憑經驗建議」。
        
        3. **換題偵測**：
           - 如果使用者的新問題與之前主題明顯無關，請在回答最後加上 [NEW_TOPIC] 暗號。`;
        
        // 重試模式額外提醒
        if (isRetry) {
            dynamicPrompt += `\n        4. 【系統重試中】這是自動觸發的深度搜尋，請直接給出最完整的答案，不需要解釋「我剛剛去查了手冊」。`;
        }
    }

    const geminiContents = [];
    if (imageBlob) {
        const imageBase64 = Utilities.base64Encode(imageBlob.getBytes());
        geminiContents.push({ 
            role: "user", 
            parts: [{ text: `【任務】分析圖片:\n${c3Prompt}` }, { inline_data: { mime_type: imageBlob.getContentType(), data: imageBase64 } }] 
        });
    } else {
        let first=true;
        effectiveMessages.forEach(msg => {
            if (msg.role === 'system') return; 
            const parts = [];
            if (msg.role === 'user' && first) {
                if (filesToAttach.length > 0) {
                    filesToAttach.forEach(k => parts.push({ file_data: { mime_type: k.mimeType || "text/plain", file_uri: k.uri } }));
                }
                first=false;
            }
            parts.push({ text: msg.content });
            geminiContents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts: parts });
        });
        if (first) geminiContents.push({ role: 'user', parts: [{ text: "你好" }] });
    }

    const payload = {
        contents: geminiContents,
        systemInstruction: imageBlob ? undefined : { parts: [{ text: dynamicPrompt }] },
        // v24.0.0: Think Mode 條件開啟
        // - PDF 模式：開啟 Think (提升閱讀理解，成本增加 <10%)
        // - Fast 模式：關閉 Think (QA/Rules 已是整理好的答案，不需思考)
        generationConfig: { 
            maxOutputTokens: CONFIG.MAX_OUTPUT_TOKENS, 
            temperature: tempSetting,
            thinkingConfig: attachPDFs ? { thinkingBudget: 2048 } : { thinkingBudget: 0 }
        },
        safetySettings: [{category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE"}]
    };

    const url = `${CONFIG.API_ENDPOINT}/${CONFIG.MODEL_NAME}:generateContent?key=${apiKey}`;
    const start = new Date().getTime();
    let lastLoadingTime = start; // 追蹤上次發送 Loading 的時間
    
    let retryCount = 0;
    let lastError = "";
    while (retryCount < 3) {
        // 每 18 秒補發一次 Loading 動畫（20秒會消失，提前 2 秒補發）
        const now = new Date().getTime();
        if (userId && now - lastLoadingTime > 18000) {
            try { showLoadingAnimation(userId, 20); } catch(e) {}
            lastLoadingTime = now;
        }
        try {
            const response = UrlFetchApp.fetch(url, { method: 'post', headers: { 'Content-Type': 'application/json' }, payload: JSON.stringify(payload), muteHttpExceptions: true });
            const endTime = new Date().getTime();
            const code = response.getResponseCode();
            writeLog(`[API End] ${(endTime - start)/1000}s, Code: ${code}, Retry: ${retryCount}`);
            
            const text = response.getContentText();
            
            // 成功
            if (code === 200) {
                try {
                    const json = JSON.parse(text);
                    
                    // 📊 Token 用量紀錄
                    if (json.usageMetadata) {
                        const usage = json.usageMetadata;
                        // Gemini 2.5 Flash-Lite 定價 (2025-12 官網確認): Input $0.10/1M, Output $0.40/1M
                        // 包含 thinking tokens
                        const costUSD = (usage.promptTokenCount / 1000000 * 0.10) + (usage.candidatesTokenCount / 1000000 * 0.40);
                        const costTWD = costUSD * 32;  // 匯率更新為 32
                        writeLog(`[Tokens] In: ${usage.promptTokenCount}, Out: ${usage.candidatesTokenCount}, Total: ${usage.totalTokenCount} (約 NT$${costTWD.toFixed(4)} | 費率: 2.5 Flash-Lite)`);
                        
                        // v24.1.0: 儲存到全域變數，供測試模式顯示
                        lastTokenUsage = {
                            input: usage.promptTokenCount,
                            output: usage.candidatesTokenCount,
                            total: usage.totalTokenCount,
                            costTWD: costTWD
                        };
                    }

                    const candidates = json && json.candidates ? json.candidates : [];
                    if (candidates.length > 0 && candidates[0].content && candidates[0].content.parts && candidates[0].content.parts.length > 0) {
                        return (candidates[0].content.parts[0].text || '').trim();
                    }
                    return '';
                } catch (parseErr) {
                    writeLog('[API Parse Error] ' + parseErr.message);
                    return '';
                }
            }
            
            // 特定錯誤處理
            if (code === 400 && text.includes("token")) {
                return "⚠️ 資料量過大，請提供關鍵字。";
            }
            if (code === 404) { 
                writeLog(`[API 404] 檔案不存在: ${text.substring(0, 200)}`);
                // 標記需要重建，並返回特殊標記讓外層處理
                CacheService.getScriptCache().put('kb_need_rebuild', 'true', 3600);
                return "[KB_EXPIRED]"; 
            }
            if (code === 403) { 
                writeLog(`[API 403] ${text.substring(0, 300)}`);
                // 標記需要重建，並返回特殊標記讓外層處理
                CacheService.getScriptCache().put('kb_need_rebuild', 'true', 3600);
                return "[KB_EXPIRED]"; 
            }
            if (code === 429) {
                writeLog(`[API 429] 配額限制，等待重試...`);
                lastError = "API 配額限制";
                retryCount++;
                Utilities.sleep(5000 * retryCount); // 429 要等久一點
                continue;
            }
            if (code === 500 || code === 503) {
                writeLog(`[API ${code}] 伺服器錯誤，重試中...`);
                lastError = `伺服器錯誤 ${code}`;
                retryCount++;
                Utilities.sleep(2000 * retryCount);
                continue;
            }
            
            // 其他錯誤
            lastError = `API ${code}`;
            writeLog(`[API Error] Code: ${code}, Body: ${text.substring(0, 300)}`);
            retryCount++;
            Utilities.sleep(1000 * Math.pow(2, retryCount));
            
        } catch (e) {
            lastError = e.message;
            writeLog(`[API Exception] ${e.message}`);
            if (e.message.includes("token")) return e.message;
            retryCount++; 
            Utilities.sleep(1000 * Math.pow(2, retryCount));
        }
    }
    return `⚠️ 系統忙碌中 (${lastError})，請稍後再試`;
}

// ==========================================
// 4. 訊息處理 (AI-Driven Trigger)
// ==========================================

// 強制列表排版 (List Formatting)
function formatListSpacing(text) {
    if (!text) return "";
    
    // 移除單一點編號
    if (text.includes("1.") && !text.includes("2.")) {
        text = text.replace(/^1\.\s*/gm, "");
    }
    
    let lines = text.split('\n');
    let formattedLines = [];
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        formattedLines.push(line);
        
        // 列表項目後加空行
        if (/^\d+\./.test(line) && i < lines.length - 1 && lines[i+1].trim() !== "") {
            formattedLines.push(""); 
        }
    }
    return formattedLines.join('\n');
}

function formatForLineMobile(text) {
  if (!text) return "";
  let processed = text;
  
  // === 過濾 Thinking Mode 洩漏 ===
  // 移除可能洩漏的內部思考 (Gemini 2.5 Flash Thinking Mode)
  processed = processed.replace(/SPECIAL INSTRUCTION:.*?(?=\n\n|\n[A-Z]|$)/gs, '');
  processed = processed.replace(/\[INTERNAL\].*?(?=\n\n|$)/gs, '');
  processed = processed.replace(/\[THINKING\].*?(?=\n\n|$)/gs, '');
  
  processed = processed.replace(/\*\*(.*?)\*\*/g, '$1'); 
  processed = processed.replace(/^\*\s+/gm, '• '); 
  processed = processed.replace(/\*/g, ''); 
  processed = processed.replace(/(\d+)\.\s+/g, '$1.');
  processed = processed.replace(/->/g, '→'); 
  
  // 強制分段 (句尾換行)
  processed = processed.replace(/([。！？])\s*/g, '$1\n\n');
  // 列表前換行
  processed = processed.replace(/(\n|^)(\d+\.)/g, '\n\n$2');
  // 移除多餘換行
  processed = processed.replace(/\n{3,}/g, '\n\n');
  
  processed = formatListSpacing(processed);
  return processed.trim();
}

function writeRecordDirectly(u,t,c,r,f) {
  try { 
    ss.getSheetByName(SHEET_NAMES.RECORDS).appendRow([new Date(), c, u, formatForLineMobile(t), r, f]); 
    SpreadsheetApp.flush(); 
  } catch(e) {
    console.error("Record Error: " + e.message);
  }
}

function handleMessage(userMessage, userId, replyToken, contextId, messageId) {
  try {
    if (!userMessage || !userMessage.trim()) return;
    const msg = userMessage.trim();
    
    // 短時間內同內容去重 (60 秒內同用戶同訊息只處理一次)
    // 但指令類別不做去重，因為用戶可能需要重試
    const cache = CacheService.getScriptCache();
    const isCommand = msg.startsWith('/');
    
    if (!isCommand) {
      // 2025-12-05: 改用 messageId 進行去重，避免誤判用戶的重複發言 (如 "好的", "謝謝")
      // 若沒有 messageId (舊版相容)，則退回使用內容雜湊
      let dedupKey = "";
      if (messageId) {
          dedupKey = `msg_id_${messageId}`;
      } else {
          dedupKey = `msg_${userId}_${Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, msg).map(b => (b & 0xFF).toString(16).padStart(2, '0')).join('')}`;
      }

      if (cache.get(dedupKey)) {
          writeLog(`[Duplicate] 忽略重複訊息: ${msg.substring(0, 30)}`);
          return;
      }
      cache.put(dedupKey, '1', 60);
    }
    
    // ⭐ 立即顯示 Loading 動畫（去重後、處理前）
    // 改用 20 秒，API 迴圈中會每 18 秒補發一次
    if (!hasRecentAnimation(userId)) { 
        showLoadingAnimation(userId, 20); 
        markAnimationShown(userId); 
    }
    
    writeLog(`[HandleMsg] 收到: ${msg}`);
    const draftCache = cache.get(CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId);
    const pendingQuery = cache.get(CACHE_KEYS.PENDING_QUERY + userId);

    // A. 建檔模式
    if (draftCache && !msg.startsWith('/')) {
        handleDraftModification(msg, userId, replyToken, JSON.parse(draftCache));
        return;
    }

    // B. 指令
    if (msg.startsWith('/')) {
        const cmdResult = handleCommand(msg, userId, contextId);
        writeLog(`[Reply] ${cmdResult.substring(0, 100)}...`);
        replyMessage(replyToken, cmdResult);
        const isReset = (msg === '/重啟' || msg === '/reboot') ? 'TRUE' : '';
        if (isReset) writeRecordDirectly(userId, msg, contextId, 'user', isReset);
        if (cmdResult) { writeRecordDirectly(userId, cmdResult, contextId, 'assistant', ''); }
        return;
    }
    
    // C. 深度搜尋確認 (嚴格鎖定)
    const deepSearchAffirmative = msg.match(/^(1|深度|查)$/i); 
    const isCancelCommand = msg.startsWith("/取消"); 

    if (pendingQuery && !isCancelCommand) {
        if (deepSearchAffirmative) {
            handleDeepSearch(pendingQuery, userId, replyToken, contextId);
            return;
        } else {
             cache.remove(CACHE_KEYS.PENDING_QUERY + userId); 
        }
    }
    
    // D. 一般對話
    const history = getHistoryFromCacheOrSheet(contextId);
    const userMsgObj = { role: "user", content: msg };
    
    // 檢查是否在 PDF 模式（之前觸發過深度搜尋，同主題追問繼續用 PDF）
    const pdfModeKey = CACHE_KEYS.PDF_MODE_PREFIX + contextId;
    let isInPdfMode = cache.get(pdfModeKey) === 'true';

    // 2025-12-05: 修正「黏性」問題
    // 用戶抱怨 10 分鐘太久，且不希望變成陌生人
    // 策略：
    // 1. 記憶 (History) 保持不變，讓用戶不覺得是陌生人
    // 2. 模式 (PDF Mode) 應該更靈活退出
    //    - 若用戶換話題 (NEW_TOPIC)，AI 會自動退出
    //    - 若用戶問簡單問題 (Simple Question)，暫時不掛 PDF
    //    - 這裡將 PDF Mode 的 TTL 縮短為 5 分鐘 (300秒)，避免過久
    
    // E. 直通車檢查 (Direct Search) - 命中關鍵字強制進 PDF
    // 2025-12-05: 恢復直通車邏輯，確保 Odyssey Hub 等術語能觸發 PDF
    if (!isInPdfMode) {
        if (checkDirectDeepSearch(msg)) {
            writeLog("[Direct Search] 命中直通車關鍵字，強制開啟 PDF 模式");
            isInPdfMode = true;
            cache.put(pdfModeKey, 'true', 300); // 改為 5 分鐘
        }
    }
    
    // 智慧退出：簡單問題不需要 PDF（價格、官網、日期、閒聊、新品等）
    const simplePatterns = [
        /多少錢|價格|價錢|售價/i,
        /官網|網址|網站|連結|link/i,
        /今天|日期|幾號|幾月/i,
        /謝謝|感謝|好的|了解|OK|掰/i,
        /^.{1,5}$/,  // 少於 5 字的簡短回覆
        /根據|哪裡|為什麼|怎麼知道|來源/i,  // 追問來源類（不需要再查 PDF）
        /還有嗎|其他|更多|繼續/i,  // 追問更多類
        /新機|新品|推薦|最新|上市|熱門|最近/i,  // 新品推薦類（CLASS_RULES 沒有就是沒有）
        /比較|差異|差別|哪個好|選哪/i  // 比較類（需要人工判斷）
    ];
    const isSimpleQuestion = simplePatterns.some(p => p.test(msg));
    if (isInPdfMode && isSimpleQuestion) {
        writeLog("[PDF Mode] 簡單/追問類問題，跳過 PDF");
        isInPdfMode = false;  // 這次不掛 PDF，但不清除模式（下次複雜問題還會用）
    } else if (isInPdfMode) {
        writeLog("[PDF Mode] 延續 PDF 模式");
        // 續命：若還在 PDF 模式且問了複雜問題，延長 5 分鐘
        cache.put(pdfModeKey, 'true', 300);
    }

    try {
        // 第一次呼叫：如果在 PDF 模式就帶 PDF，否則極速模式
        let rawResponse = callChatGPTWithRetry([...history, userMsgObj], null, isInPdfMode, false, userId); 
        
        // === [KB_EXPIRED] 攔截：PDF 過期，靜默處理，用戶無感 ===
        if (rawResponse === "[KB_EXPIRED]") {
            writeLog("[KB Expired] PDF 過期，退出 PDF 模式，背景重建中");
            cache.remove(pdfModeKey);  // 清除 PDF 模式
            
            // 自動預約 1 分鐘後背景重建
            scheduleImmediateRebuild();
            
            // 用極速模式重試（不帶 PDF），用戶完全無感
            rawResponse = callChatGPTWithRetry([...history, userMsgObj], null, false, false, userId);
            // 不管成功失敗都不提示用戶「手冊更新中」，保持對話流暢
        }
        
        if (rawResponse) {
          let finalText = formatForLineMobile(rawResponse);
          let replyText = finalText;
          
          // === [AUTO_SEARCH_PDF] 或 [NEED_DOC] 攔截 ===
          if (finalText.includes("[AUTO_SEARCH_PDF]") || finalText.includes("[NEED_DOC]")) {
              writeLog("[Auto Search] 偵測到搜尋暗號");
              finalText = finalText.replace(/\[AUTO_SEARCH_PDF\]/g, "").trim();
              finalText = finalText.replace(/\[NEED_DOC\]/g, "").trim();
              
              // 檢測是否為硬體規格問題（這類問題 CLASS_RULES 沒寫就是沒有，不該查 PDF）
              const hardwarePatterns = [
                  /耳機孔|3\.5mm|音源孔|耳機插孔/i,
                  /USB|HDMI|DP|DisplayPort|Type-C|連接埠/i,
                  /KVM|切換器/i,
                  /喇叭|揚聲器|音響/i,
                  /VESA|壁掛/i,
                  /解析度|Hz|更新率|刷新率/i,
                  /尺寸|吋|英寸/i,
                  /曲面|平面|曲率/i
              ];
              const isHardwareQuestion = hardwarePatterns.some(p => p.test(msg));
              
              if (isHardwareQuestion) {
                  // 硬體規格問題：CLASS_RULES 沒寫就是沒有，不查 PDF
                  writeLog("[Hardware Q] 硬體規格問題，不進 PDF，直接用極速模式答案");
                  // finalText 已經是極速模式的回答，直接用
                  replyText = finalText;
              } else {
                  // 操作步驟類問題：詢問使用者要不要深度搜尋
                  writeLog("[Operation Q] 操作類問題，詢問使用者是否深度搜尋");
                  
                  // 預測會用到哪些 PDF
                  const kbList = JSON.parse(PropertiesService.getScriptProperties().getProperty(CACHE_KEYS.KB_URI_LIST) || '[]');
                  const relevantFiles = getRelevantKBFiles([...history, userMsgObj], kbList);
                  const pdfNames = relevantFiles.filter(f => f.mimeType === 'application/pdf').map(f => f.name.replace('.pdf', '')).slice(0, 3);
                  const pdfHint = pdfNames.length > 0 ? `\n📖 將查閱：${pdfNames.join('、')}` : '';
                  
                  // 儲存待查詢，等使用者確認
                  cache.put(CACHE_KEYS.PENDING_QUERY + userId, msg, 300);  // 5 分鐘有效
                  
                  finalText += `\n\n---\n💡 需要查閱產品手冊嗎？（約需 30 秒）${pdfHint}\n👉 回覆「1」或「深度」繼續搜尋`;
                  replyText = finalText;
              }
          }
          // === [NEW_TOPIC] 攔截：退出 PDF 模式 ===
          else if (finalText.includes("[NEW_TOPIC]")) {
              writeLog("[New Topic] 偵測到換題，退出 PDF 模式");
              finalText = finalText.replace(/\[NEW_TOPIC\]/g, "").trim();
              cache.remove(pdfModeKey);
              replyText = finalText;
          }
          // === 智慧退出：回答不需要 PDF 時自動退出 ===
          else if (isInPdfMode) {
              // 檢測是否為簡單回答（不需要 PDF 的回答）
              const exitPatterns = [
                  /找Sam|問Sam|問一下Sam/i,           // 引導找 Sam
                  /官網確認|samsung\.com/i,            // 價格引導到官網
                  /沒有.*資料|資料.*沒有/i,            // 查無資料
                  /商業機密|不能透漏/i                  // 拒答
              ];
              const shouldExit = exitPatterns.some(p => p.test(finalText));
              if (shouldExit) {
                  writeLog("[PDF Mode] 回答不需 PDF，自動退出");
                  cache.remove(pdfModeKey);
              }
              replyText = finalText;
          }
          else {
              replyText = finalText;
          }

          // v24.1.0: 測試模式 - 在回覆末尾附加 Token 資訊
          if (DEBUG_SHOW_TOKENS && lastTokenUsage) {
              const tokenInfo = `\n\n---\n📊 In:${lastTokenUsage.input} Out:${lastTokenUsage.output} = ${lastTokenUsage.total} (NT$${lastTokenUsage.costTWD.toFixed(4)})`;
              replyText += tokenInfo;
          }

          replyMessage(replyToken, replyText);
          writeRecordDirectly(userId, replyText, contextId, 'assistant', '');
          writeLog(`[AI Reply] ${finalText.substring(0, 500)}${finalText.length > 500 ? '...' : ''}`); 
          
          updateHistorySheetAndCache(contextId, history, userMsgObj, { role: 'assistant', content: finalText });

          // 2025-12-05 v23.6.5: 背景異步整理 (Async Background Summary)
          try {
              const currentHistory = getHistoryFromCacheOrSheet(contextId);
              if (currentHistory.length > 5) {
                  writeLog(`[AsyncSummary] 觸發背景整理，目前長度: ${currentHistory.length}`);
                  const summary = callGeminiToSummarize(currentHistory);
                  
                  if (summary) {
                      const lastTwo = currentHistory.slice(-2);
                      const summaryMsg = { 
                          role: 'user', 
                          content: `【系統自動摘要】\n之前的對話重點：${summary}\n(請基於此上下文繼續服務)` 
                      };
                      const ackMsg = {
                          role: 'assistant',
                          content: '好的，我已了解之前的對話脈絡。'
                      };
                      
                      const newHist = [summaryMsg, ackMsg, ...lastTwo];
                      const cache = CacheService.getScriptCache();
                      const json = JSON.stringify(newHist);
                      cache.put(`${CACHE_KEYS.HISTORY_PREFIX}${contextId}`, json, CONFIG.CACHE_TTL_SEC);
                      writeLog(`[AsyncSummary] 整理完成，新長度: ${newHist.length}`);
                  }
              }
          } catch (e) {
              writeLog(`[AsyncSummary Error] ${e.message}`);
          }

        } else {
            writeLog(`[Error] AI 回傳為空`);
            replyMessage(replyToken, "系統忙碌中 (AI Empty)");
        }
    } catch (apiErr) {
        replyMessage(replyToken, `系統錯誤：${apiErr.message}`);
        writeLog(`[Handle API Error] ${apiErr.message}`);
    }
  } catch (error) { writeLog("[Fatal] " + error); }
}

function handleDeepSearch(originalQuery, userId, replyToken, contextId) {
    const cache = CacheService.getScriptCache();
    cache.remove(CACHE_KEYS.PENDING_QUERY + userId); 

    if (!hasRecentAnimation(userId)) { showLoadingAnimation(userId, 60); markAnimationShown(userId); }
    Utilities.sleep(500); 

    const history = getHistoryFromCacheOrSheet(contextId);
    const userMsgObj = { role: "user", content: originalQuery }; 

    try {
        // 預測使用的 PDF（在呼叫前計算，用於回報）
        const kbList = JSON.parse(PropertiesService.getScriptProperties().getProperty(CACHE_KEYS.KB_URI_LIST) || '[]');
        const relevantFiles = getRelevantKBFiles([...history, userMsgObj], kbList);
        const pdfNames = relevantFiles.filter(f => f.mimeType === 'application/pdf').map(f => f.name.replace('.pdf', ''));
        const pdfHint = pdfNames.length > 0 ? `\n📖 參考：${pdfNames.slice(0, 3).join('、')}` : '';
        
        // 深度呼叫
        const rawResponse = callChatGPTWithRetry([...history, userMsgObj], null, true, false, userId); 
        
        if (rawResponse) {
            let finalText = formatForLineMobile(rawResponse);
            replyMessage(replyToken, `🚀 深度搜尋結果：\n\n${finalText}${pdfHint}`);
            
            // writeRecordDirectly(userId, `[深度] ${originalQuery}`, contextId, 'user', '');
            // writeRecordDirectly(userId, finalText, contextId, 'assistant', 'DEEP_SEARCH');
            writeLog(`[Deep Reply] PDF: ${pdfNames.slice(0, 3).join(', ')} | ${finalText.substring(0, 200)}`);
            updateHistorySheetAndCache(contextId, history, { role: 'user', content: originalQuery }, { role: 'assistant', content: `(深度搜尋) ${finalText}` });
        }
    } catch (e) { 
        replyMessage(replyToken, "深度搜尋失敗"); 
        writeLog("[DeepSearch Error] " + e); 
    }
}

// 提示語生成器
function generateFollowUpPrompt() {
    return "💡 這需要查閱詳細手冊才能解決。繼續深入搜尋請輸入「1」，將會用更多時間搜尋相關型號的產品使用手冊。";
}

function handleImageMessage(msgId, userId, replyToken, contextId) {
  try {
    writeLog(`[Image] 收到圖片 MsgId: ${msgId}`);
    // writeRecordDirectly(userId, "[傳圖]", contextId, 'user', '');

    if (!hasRecentAnimation(userId)) { showLoadingAnimation(userId, 20); markAnimationShown(userId); }

    const token = PropertiesService.getScriptProperties().getProperty("TOKEN");
    const blob = UrlFetchApp.fetch(`https://api-data.line.me/v2/bot/message/${msgId}/content`, { headers: { "Authorization": "Bearer " + token } }).getBlob();

    const analysis = callChatGPTWithRetry(null, blob, false, false, userId);
    const final = formatForLineMobile(analysis);
    replyMessage(replyToken, final);
    
    // writeRecordDirectly(userId, final, contextId, 'assistant', '');
    
    const history = getHistoryFromCacheOrSheet(contextId);
    updateHistorySheetAndCache(contextId, history, 
        { role: 'user', content: "[使用者傳送了一張圖片]" }, 
        { role: 'assistant', content: `(針對圖片的分析結果) ${final}` }
    );
  } catch (e) {
    writeLog(`[Image Error] ${e.message}`);
    replyMessage(replyToken, "抱歉，我看圖片出了點問題，請稍後再試 🔧");
  }
}

// ==========================================
// 5. 建檔與指令流程
// ==========================================

function handleCommand(c, u, cid) {
  const cmd = c.trim();
  const draftKey = CACHE_KEYS.ENTRY_DRAFT_PREFIX + u;
  
  if (cmd === "/重啟" || cmd === "/reboot") {
      writeLog(`[Command] /重啟 by ${u}`);
      clearHistorySheetAndCache(cid); 
      const resultMsg = syncGeminiKnowledgeBase(); 
      writeLog(`[Command] 重啟完成: ${resultMsg.substring(0, 100)}`);
      return `✓ 重啟完成 (對話已重置)\n${resultMsg}`;
  }

  if (cmd === "/取消") {
      CacheService.getScriptCache().remove(draftKey);
      CacheService.getScriptCache().remove(CACHE_KEYS.PENDING_QUERY + u); 
      return "❌ 已取消建檔，回到一般對話模式。";
  }
  
  if (cmd.startsWith("/記錄") || cmd.startsWith("/紀錄")) {
      const pendingDraft = CacheService.getScriptCache().get(draftKey);
      const inputContent = cmd.replace(/^\/紀錄\s*/i, "").replace(/^\/記錄\s*/i, "").trim();

      if (pendingDraft && inputContent === "") {
          return saveDraftToSheet(JSON.parse(pendingDraft));
      }

      if (inputContent !== "") {
          return startNewEntryDraft(inputContent, u);
      }

      return handleAutoQA(u, cid);
  }

  return `❌ 未知指令\n\n【指令列表】\n/重啟 -> 重置對話+更新\n/紀錄 <內容> -> 開始建檔\n/紀錄 -> 存檔/整理QA\n/取消 -> 退出建檔`;
}

function startNewEntryDraft(content, userId) {
    try {
        writeLog(`[NewDraft] 開始建檔: ${content.substring(0, 150)}`);
        
        // Step 1: AI 產生初版 QA
        const polishedText = callGeminiToPolish(content);
        writeLog(`[NewDraft] 初版 QA: ${polishedText.substring(0, 150)}`);
        
        // Step 2: 搜尋現有 QA 是否有相似的
        const similarResult = findSimilarQA(content, polishedText);
        
        if (similarResult && similarResult.found) {
            // 找到相似 QA，讓用戶選擇
            writeLog(`[NewDraft] 找到相似 QA: 行 ${similarResult.matchedRows.join(',')}`);
            
            // Step 3: LLM 合併產出合併版
            const mergedQA = callGeminiToMergeQA(similarResult.matchedQAs, polishedText);
            writeLog(`[NewDraft] 合併版 QA: ${mergedQA.substring(0, 150)}`);
            
            // 建立等待選擇的 draft
            var draft = {
                originalContent: content,
                conversation: [],
                currentQA: polishedText,
                userId: userId,
                pendingMergeChoice: true,
                mergedVersion: mergedQA,
                freshVersion: polishedText,
                matchedQARows: similarResult.matchedRows,
                matchedQATexts: similarResult.matchedQAs
            };
            CacheService.getScriptCache().put(CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId, JSON.stringify(draft), CONFIG.DRAFT_TTL_SEC);
            
            // 組裝回覆訊息
            var replyMsg = '🔍 找到相似的現有 QA：\n\n';
            replyMsg += '【現有 QA】\n';
            for (var i = 0; i < similarResult.matchedQAs.length; i++) {
                replyMsg += similarResult.matchedQAs[i].substring(0, 100) + '...\n';
            }
            replyMsg += '\n【建議合併成】\n' + mergedQA + '\n\n';
            replyMsg += '【你的新內容】\n' + polishedText + '\n\n';
            replyMsg += '請選擇：\n';
            replyMsg += '1️⃣ 採用合併版（會刪除舊 QA）\n';
            replyMsg += '2️⃣ 另開新條（保留舊 QA）';
            
            writeLog(`[NewDraft Reply] 等待用戶選擇 1/2`);
            return replyMsg;
        }
        
        // 沒找到相似，直接進入正常建檔模式
        var draft = { 
            originalContent: content,
            conversation: [],
            currentQA: polishedText,
            userId: userId,
            pendingMergeChoice: false
        };
        CacheService.getScriptCache().put(CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId, JSON.stringify(draft), CONFIG.DRAFT_TTL_SEC);
        
        var alertMsg = '⚠️ 已進入建檔模式。接下來的對話將視為修改指令，直到輸入 /紀錄 存檔為止。';
        var preview = '\n\n【預覽】將寫入 QA：\n' + polishedText + '\n\n👉 確認存檔 → /紀錄\n👉 修改內容 → 直接回覆\n👉 放棄 → /取消';
        
        writeLog(`[NewDraft Reply] ${(alertMsg + preview).substring(0, 100)}...`);
        return alertMsg + preview;
    } catch (e) { 
        writeLog(`[NewDraft Error] ${e.message}`);
        return '❌ 分析失敗：' + e.message; 
    }
}

function handleDraftModification(feedback, userId, replyToken, currentDraft) {
    try {
        writeLog(`[DraftMod] 用戶說: ${feedback}`);
        
        // 檢查是否在等待選擇 1/2
        if (currentDraft.pendingMergeChoice === true) {
            var choice = feedback.trim();
            
            if (choice === '1' || choice === '１') {
                // 選擇合併版，刪除舊 QA
                writeLog(`[DraftMod] 用戶選擇 1: 採用合併版`);
                deleteQARows(currentDraft.matchedQARows);
                
                var newDraft = {
                    originalContent: currentDraft.originalContent,
                    conversation: [],
                    currentQA: currentDraft.mergedVersion,
                    userId: userId,
                    pendingMergeChoice: false
                };
                CacheService.getScriptCache().put(CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId, JSON.stringify(newDraft), CONFIG.DRAFT_TTL_SEC);
                
                var preview = '✅ 已採用合併版，舊 QA 已刪除\n\n【預覽】將寫入 QA：\n' + currentDraft.mergedVersion + '\n\n👉 確認存檔 → /紀錄\n👉 修改內容 → 直接回覆\n👉 放棄 → /取消';
                replyMessage(replyToken, preview);
                writeLog(`[DraftMod Reply] 採用合併版`);
                return;
            } 
            else if (choice === '2' || choice === '２') {
                // 選擇純新版，保留舊 QA
                writeLog(`[DraftMod] 用戶選擇 2: 另開新條`);
                
                var newDraft = {
                    originalContent: currentDraft.originalContent,
                    conversation: [],
                    currentQA: currentDraft.freshVersion,
                    userId: userId,
                    pendingMergeChoice: false
                };
                CacheService.getScriptCache().put(CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId, JSON.stringify(newDraft), CONFIG.DRAFT_TTL_SEC);
                
                var preview = '✅ 已選擇另開新條，舊 QA 保留\n\n【預覽】將寫入 QA：\n' + currentDraft.freshVersion + '\n\n👉 確認存檔 → /紀錄\n👉 修改內容 → 直接回覆\n👉 放棄 → /取消';
                replyMessage(replyToken, preview);
                writeLog(`[DraftMod Reply] 另開新條`);
                return;
            }
            else {
                // 不是 1 或 2，提醒用戶
                replyMessage(replyToken, '請輸入 1 或 2 選擇：\n1️⃣ 採用合併版（會刪除舊 QA）\n2️⃣ 另開新條（保留舊 QA）');
                writeLog(`[DraftMod Reply] 提醒用戶選擇 1/2`);
                return;
            }
        }
        
        // 正常修改模式
        writeLog(`[DraftMod] 原始內容: ${(currentDraft.originalContent || '').substring(0, 100)}`);
        writeLog(`[DraftMod] 目前 QA: ${(currentDraft.currentQA || '').substring(0, 100)}`);
        
        // 累積對話歷史
        var conversation = currentDraft.conversation || [];
        conversation.push(feedback);
        
        // 帶完整上下文讓 LLM 重新產出 QA
        var newQA = callGeminiToRefineQA(
            currentDraft.originalContent,
            currentDraft.currentQA,
            conversation
        );
        
        writeLog(`[DraftMod] 新 QA: ${newQA.substring(0, 150)}`);
        
        // 更新 draft
        var newDraft = { 
            originalContent: currentDraft.originalContent,
            conversation: conversation,
            currentQA: newQA,
            userId: userId,
            pendingMergeChoice: false
        };
        CacheService.getScriptCache().put(CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId, JSON.stringify(newDraft), CONFIG.DRAFT_TTL_SEC);
        
        var preview = '🔄 已修正草稿：\n\n【預覽】將寫入 QA：\n' + newQA + '\n\n👉 確認存檔 → /紀錄\n👉 繼續修改 → 直接回覆\n👉 放棄 → /取消';
        replyMessage(replyToken, preview);
        writeLog(`[DraftMod Reply] ${preview.substring(0, 100)}...`);
    } catch (e) { 
        writeLog(`[DraftMod Error] ${e.message}`);
        replyMessage(replyToken, '❌ 修改失敗: ' + e.message); 
    }
}

/**
 * 搜尋現有 QA 是否有相似的條目
 * @param {string} newContent - 用戶輸入的新內容
 * @param {string} polishedQA - AI 整理後的 QA
 * @returns {Object|null} { found: boolean, matchedRows: number[], matchedQAs: string[] }
 */
function findSimilarQA(newContent, polishedQA) {
    try {
        var sheet = ss.getSheetByName(SHEET_NAMES.QA);
        if (!sheet) return null;
        
        var lastRow = sheet.getLastRow();
        if (lastRow < 1) return null;
        
        var data = sheet.getRange(1, 1, lastRow, 1).getValues();
        var allQAs = [];
        for (var i = 0; i < data.length; i++) {
            var text = (data[i][0] || '').toString().trim();
            if (text) {
                allQAs.push({ row: i + 1, text: text });
            }
        }
        
        if (allQAs.length === 0) return null;
        
        // 組裝 QA 列表給 LLM 判斷
        var qaListText = '';
        for (var i = 0; i < allQAs.length; i++) {
            qaListText += '行' + allQAs[i].row + ': ' + allQAs[i].text.substring(0, 150) + '\n';
        }
        
        var apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
        if (!apiKey) return null;
        
        var prompt = '你是 QA 比對專家。\n\n';
        prompt += '以下是現有的 QA 列表：\n' + qaListText + '\n\n';
        prompt += '新內容：\n' + newContent + '\n\n';
        prompt += '整理後：\n' + polishedQA + '\n\n';
        prompt += '請判斷現有 QA 中是否有和新內容「主題相同或高度相關」的條目。\n';
        prompt += '如果有，回傳相關的行號（用逗號分隔，例如：3,7）\n';
        prompt += '如果沒有，只回 NONE\n';
        prompt += '只回行號或 NONE，不要解釋。';
        
        var payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { 
                maxOutputTokens: 100, 
                temperature: 0.1,
                thinkingConfig: { thinkingBudget: 0 }
            }
        };
        
        var res = UrlFetchApp.fetch(CONFIG.API_ENDPOINT + '/' + CONFIG.MODEL_NAME + ':generateContent?key=' + apiKey, {
            method: 'post',
            headers: { 'Content-Type': 'application/json' },
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        });
        
        var code = res.getResponseCode();
        var body = res.getContentText();
        writeLog('[FindSimilar API] Code: ' + code + ', Body: ' + body.substring(0, 300));
        
        if (code !== 200) return null;
        
        var json = JSON.parse(body);
        var candidates = (json && json.candidates) ? json.candidates : [];
        if (candidates.length === 0) return null;
        
        var firstCandidate = candidates[0];
        var rawText = '';
        if (firstCandidate && firstCandidate.content && firstCandidate.content.parts) {
            var parts = firstCandidate.content.parts;
            if (Array.isArray(parts) && parts.length > 0 && parts[0].text) {
                rawText = parts[0].text.trim();
            }
        }
        
        writeLog('[FindSimilar] LLM 回應: ' + rawText);
        
        if (!rawText || rawText.toUpperCase() === 'NONE') {
            return { found: false, matchedRows: [], matchedQAs: [] };
        }
        
        // 解析行號
        var rowNumbers = [];
        var matches = rawText.match(/\d+/g);
        if (matches) {
            for (var i = 0; i < matches.length; i++) {
                var num = parseInt(matches[i], 10);
                if (num > 0 && num <= lastRow) {
                    rowNumbers.push(num);
                }
            }
        }
        
        if (rowNumbers.length === 0) {
            return { found: false, matchedRows: [], matchedQAs: [] };
        }
        
        // 取得匹配的 QA 內容
        var matchedQAs = [];
        for (var i = 0; i < rowNumbers.length; i++) {
            var rowNum = rowNumbers[i];
            for (var j = 0; j < allQAs.length; j++) {
                if (allQAs[j].row === rowNum) {
                    matchedQAs.push(allQAs[j].text);
                    break;
                }
            }
        }
        
        return { found: true, matchedRows: rowNumbers, matchedQAs: matchedQAs };
        
    } catch (e) {
        writeLog('[FindSimilar Error] ' + e.message);
        return null;
    }
}

/**
 * 讓 LLM 合併現有 QA 和新內容
 * @param {string[]} existingQAs - 現有的相似 QA
 * @param {string} newQA - 新整理的 QA
 * @returns {string} 合併後的 QA
 */
function callGeminiToMergeQA(existingQAs, newQA) {
    var apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    if (!apiKey) throw new Error("缺少 GEMINI_API_KEY");
    
    var existingText = '';
    for (var i = 0; i < existingQAs.length; i++) {
        existingText += '現有 QA ' + (i + 1) + ': ' + existingQAs[i] + '\n';
    }
    
    var prompt = '你是「客服 QA 知識庫建檔專家」。\n\n';
    prompt += '任務：將現有 QA 和新內容合併成一條完整的 QA。\n\n';
    prompt += existingText + '\n';
    prompt += '新內容：' + newQA + '\n\n';
    prompt += '請輸出一行：問題 / A：答案\n\n';
    prompt += '重要規則：\n';
    prompt += '- 融合所有資訊，去除重複\n';
    prompt += '- 型號必須完整列出，禁止縮寫\n';
    prompt += '- 問題要涵蓋所有相關問法\n';
    prompt += '- 格式嚴格用「 / A：」分隔，不要用逗號\n';
    prompt += '- 只輸出一行結果，不要解釋';
    
    var payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { 
            maxOutputTokens: 1000, 
            temperature: 0.3,
            thinkingConfig: { thinkingBudget: 0 }
        }
    };
    
    try {
        var res = UrlFetchApp.fetch(CONFIG.API_ENDPOINT + '/' + CONFIG.MODEL_NAME + ':generateContent?key=' + apiKey, {
            method: 'post',
            headers: { 'Content-Type': 'application/json' },
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        });
        
        var code = res.getResponseCode();
        var body = res.getContentText();
        writeLog('[MergeQA API] Code: ' + code + ', Body: ' + body.substring(0, 500));
        
        if (code !== 200) {
            // 降級：簡單合併
            return newQA + '（合併自現有 QA）';
        }
        
        var json = JSON.parse(body);
        var candidates = (json && json.candidates) ? json.candidates : [];
        if (candidates.length === 0) return newQA;
        
        var firstCandidate = candidates[0];
        var rawText = '';
        if (firstCandidate && firstCandidate.content && firstCandidate.content.parts) {
            var parts = firstCandidate.content.parts;
            if (Array.isArray(parts) && parts.length > 0 && parts[0].text) {
                rawText = parts[0].text.trim().replace(/[\r\n]+/g, ' ');
            }
        }
        
        return rawText || newQA;
        
    } catch (e) {
        writeLog('[MergeQA Error] ' + e.message);
        return newQA;
    }
}

/**
 * 刪除指定行的 QA
 * @param {number[]} rowNumbers - 要刪除的行號（從大到小刪除避免位移問題）
 */
function deleteQARows(rowNumbers) {
    if (!rowNumbers || rowNumbers.length === 0) return;
    
    try {
        var sheet = ss.getSheetByName(SHEET_NAMES.QA);
        if (!sheet) return;
        
        // 從大到小排序，避免刪除後行號位移
        var sorted = rowNumbers.slice().sort(function(a, b) { return b - a; });
        
        for (var i = 0; i < sorted.length; i++) {
            var rowNum = sorted[i];
            if (rowNum > 0 && rowNum <= sheet.getLastRow()) {
                sheet.deleteRow(rowNum);
                writeLog('[DeleteQA] 已刪除行 ' + rowNum);
            }
        }
        
        SpreadsheetApp.flush();
    } catch (e) {
        writeLog('[DeleteQA Error] ' + e.message);
    }
}

/**
 * 帶完整上下文讓 LLM 重新產出 QA
 * @param {string} originalContent - 原始輸入內容
 * @param {string} currentQA - 目前的 QA 版本
 * @param {string[]} conversation - 所有修改指令歷史
 */
function callGeminiToRefineQA(originalContent, currentQA, conversation) {
    const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    if (!apiKey) throw new Error("缺少 GEMINI_API_KEY");
    
    // 組裝完整上下文
    const historyText = conversation.map((msg, i) => `用戶第${i+1}次說: ${msg}`).join('\n');
    
    const prompt = `你是「客服 QA 知識庫建檔專家」。

任務：根據用戶的修改指令，重新整理出一條 QA。

【原始素材】
${originalContent}

【目前版本】
${currentQA}

【用戶修改指令】
${historyText}

請輸出一行：問題 / A：答案

重要規則：
- 型號必須完整列出，禁止縮寫（例：寫 M50A、M50B、M50C，不可寫 M50A/B/C）
- 問題要像客戶會問的話
- 答案要融合所有資訊，不是疊加
- 格式嚴格用「 / A：」分隔，不要用逗號
- 只輸出一行結果，不要解釋`;

    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { 
            maxOutputTokens: 1000, 
            temperature: 0.3,
            thinkingConfig: { thinkingBudget: 0 }
        }
    };
    
    try {
        const res = UrlFetchApp.fetch(`${CONFIG.API_ENDPOINT}/${CONFIG.MODEL_NAME}:generateContent?key=${apiKey}`, {
            method: 'post',
            headers: { 'Content-Type': 'application/json' },
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        });

        const code = res.getResponseCode();
        const body = res.getContentText();
        writeLog(`[RefineQA API] Code: ${code}, Body: ${body.substring(0, 500)}`);
        
        if (code !== 200) {
            writeLog(`[RefineQA API Error] Code: ${code}`);
            // 降級：簡單合併
            return simpleModifyFallback(currentQA, conversation[conversation.length - 1]);
        }

        let json;
        try { json = JSON.parse(body); } catch (parseErr) {
            writeLog(`[RefineQA Parse Error] ${parseErr.message}`);
            return simpleModifyFallback(currentQA, conversation[conversation.length - 1]);
        }

        const candidates = (json && json.candidates) ? json.candidates : [];
        const firstCandidate = (candidates.length > 0) ? candidates[0] : null;
        const finishReason = (firstCandidate && firstCandidate.finishReason) ? firstCandidate.finishReason : 'UNKNOWN';
        writeLog(`[RefineQA] finishReason: ${finishReason}, candidates: ${candidates.length}`);

        let rawText = '';
        if (firstCandidate && firstCandidate.content && firstCandidate.content.parts) {
            const parts = firstCandidate.content.parts;
            if (Array.isArray(parts) && parts.length > 0 && parts[0].text) {
                rawText = parts[0].text;
            }
        }

        if (!rawText || typeof rawText !== 'string') {
            writeLog(`[RefineQA] AI 回傳為空`);
            return simpleModifyFallback(currentQA, conversation[conversation.length - 1]);
        }

        return rawText.trim().replace(/[\r\n]+/g, ' ');

    } catch (e) {
        writeLog(`[RefineQA Error] ${e.message}`);
        return simpleModifyFallback(currentQA, conversation[conversation.length - 1]);
    }
}

/**
 * 簡化版建檔：AI 潤飾使用者輸入，回傳單一字串
 * 格式：問題 / A：答案
 */
function callGeminiToPolish(input) {
    const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    if (!apiKey) throw new Error("缺少 GEMINI_API_KEY");
    
    const prompt = `你是「客服 QA 知識庫建檔專家」。

任務：將以下內容整理成一條 QA。

【用戶提供的內容】
${input}

請輸出一行：問題 / A：答案

重要規則：
- 型號必須完整列出，禁止縮寫（例：寫 M50A、M50B、M50C，不可寫 M50A/B/C）
- 問題要像客戶會問的話
- 答案要精簡正確
- 格式嚴格用「 / A：」分隔，不要用逗號
- 只輸出一行結果，不要解釋
- 若內容不適合轉 QA，回「[需確認] 原文摘要」`;

    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { 
            maxOutputTokens: 1000, 
            temperature: 0.3,
            thinkingConfig: { thinkingBudget: 0 }
        }
    };
    
    try {
        const res = UrlFetchApp.fetch(`${CONFIG.API_ENDPOINT}/${CONFIG.MODEL_NAME}:generateContent?key=${apiKey}`, {
            method: 'post',
            headers: { 'Content-Type': 'application/json' },
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        });

        const code = res.getResponseCode();
        const body = res.getContentText();
        writeLog(`[Polish API] Code: ${code}, Body: ${body.substring(0, 500)}`);
        
        if (code !== 200) {
            writeLog(`[Polish API Error] Code: ${code}`);
            return simplePolishFallback(input);
        }

        let json;
        try {
            json = JSON.parse(body);
        } catch (parseErr) {
            writeLog(`[Polish Parse Error] ${parseErr.message}`);
            return simplePolishFallback(input);
        }

        // 安全取得第一個候選文字 (GAS 不支援 Optional Chaining)
        const candidates = (json && json.candidates) ? json.candidates : [];
        const firstCandidate = (candidates.length > 0) ? candidates[0] : null;
        const finishReason = (firstCandidate && firstCandidate.finishReason) ? firstCandidate.finishReason : 'UNKNOWN';
        writeLog(`[Polish] finishReason: ${finishReason}, candidates: ${candidates.length}`);
        
        let rawText = '';
        if (firstCandidate && firstCandidate.content && firstCandidate.content.parts) {
            const parts = firstCandidate.content.parts;
            if (Array.isArray(parts) && parts.length > 0 && parts[0].text) {
                rawText = parts[0].text;
            }
        }

        if (!rawText || typeof rawText !== 'string') {
            writeLog(`[Polish] AI 回傳為空，Body 前 300 字: ${body.substring(0, 300)}`);
            return simplePolishFallback(input);
        }

        // 清理多餘的換行和空白
        return rawText.trim().replace(/[\r\n]+/g, ' ');

    } catch (e) {
        writeLog(`[Polish Error] ${e.message}`);
        // 任何例外都以降級格式化繼續流程
        return simplePolishFallback(input);
    }
}

/**
 * 簡化版修改：AI 根據指令修改現有文字
 */
function callGeminiToModify(currentText, instruction) {
    const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    if (!apiKey) throw new Error("缺少 GEMINI_API_KEY");
    
    const prompt = `依修改指令調整下列QA，產生一行「問題 / A：答案」。
規則：只回一行、用「 / A：」分隔、保留原意但套用修改。
目前：${currentText}
修改：${instruction}`;

    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { 
            maxOutputTokens: 500, 
            temperature: 0.4,
            thinkingConfig: { thinkingBudget: 0 }
        }
    };
    
    try {
        const res = UrlFetchApp.fetch(`${CONFIG.API_ENDPOINT}/${CONFIG.MODEL_NAME}:generateContent?key=${apiKey}`, {
            method: 'post',
            headers: { 'Content-Type': 'application/json' },
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        });

        const code = res.getResponseCode();
        const body = res.getContentText();
        writeLog(`[Modify API] Code: ${code}, Body: ${body.substring(0, 500)}`);
        
        if (code !== 200) {
            writeLog(`[Modify API Error] Code: ${code}`);
            return simpleModifyFallback(currentText, instruction);
        }

        let json;
        try { json = JSON.parse(body); } catch (parseErr) {
            writeLog(`[Modify Parse Error] ${parseErr.message}`);
            return simpleModifyFallback(currentText, instruction);
        }

        // 安全取得第一個候選文字 (GAS 不支援 Optional Chaining)
        const candidates = (json && json.candidates) ? json.candidates : [];
        const firstCandidate = (candidates.length > 0) ? candidates[0] : null;
        const finishReason = (firstCandidate && firstCandidate.finishReason) ? firstCandidate.finishReason : 'UNKNOWN';
        writeLog(`[Modify] finishReason: ${finishReason}, candidates: ${candidates.length}`);

        let rawText = '';
        if (firstCandidate && firstCandidate.content && firstCandidate.content.parts) {
            const parts = firstCandidate.content.parts;
            if (Array.isArray(parts) && parts.length > 0 && parts[0].text) {
                rawText = parts[0].text;
            }
        }

        if (!rawText || typeof rawText !== 'string') {
            writeLog(`[Modify] AI 回傳為空，Body 前 300 字: ${body.substring(0, 300)}`);
            return simpleModifyFallback(currentText, instruction);
        }

        return rawText.trim().replace(/[\r\n]+/g, ' ');

    } catch (e) {
        writeLog(`[Modify Error] ${e.message}`);
        return simpleModifyFallback(currentText, instruction);
    }
}

// 降級：將使用者輸入快速轉為「問題 / A：答案」
function simplePolishFallback(input) {
    var text = (input || '').trim();
    if (!text) return '問題 / A：請補充內容';
    // 嘗試以第一個問句切分
    var qMatch = text.match(/^[^?！？。]+[?？]/);
    if (qMatch) {
        var q = qMatch[0].replace(/[。]/g, '').trim();
        var a = text.substring(q.length).trim() || '待補';
        return q.replace(/[?？]$/, '') + '嗎 / A：' + a;
    }
    // 若輸入含「 / A：」，直接使用
    if (text.indexOf(' / A：') > -1) {
        return text.replace(/[\r\n]+/g, ' ').trim();
    }
    // 最後退路：組成一個通用問法
    return text + '是什麼/怎麼用 / A：待補';
}

// 降級：智慧合併，嘗試理解用戶意圖
function simpleModifyFallback(currentText, instruction) {
    const base = (currentText || '').trim();
    const ins = (instruction || '').trim();
    if (!base) return simplePolishFallback(ins);
    if (!ins) return base;
    
    writeLog('[Fallback] 降級合併: base=' + base.substring(0,50) + ', ins=' + ins.substring(0,50));
    
    // 分析用戶指令類型
    var isReplace = /不對|錯了|改成|換成|應該是/.test(ins);
    var isInsert = /補充|加上|加入|新增/.test(ins);
    
    // 若看起來像「問題 / A：答案」格式
    var splitIdx = base.indexOf(' / A：');
    if (splitIdx > 0) {
        var q = base.substring(0, splitIdx).trim();
        var a = base.substring(splitIdx + 5).trim();
        
        if (isReplace) {
            return q + ' / A：' + a + '\n⚠️ 請直接告訴我正確的內容是什麼';
        } else if (isInsert) {
            return q + ' / A：' + a + '。' + ins.replace(/補充一下|加上|加入|新增/g, '');
        }
        return q + ' / A：' + a + '（用戶補充：' + ins + '）';
    }
    // 否則直接合併
    return base + ' / A：' + ins;
}

/**
 * 簡化版存檔：直接將整條文字寫入 QA
 */
function saveDraftToSheet(draft) {
    // 驗證草稿內容
    var qaText = draft.currentQA || draft.text; // 相容舊格式
    if (!qaText || qaText.trim().length < 5) {
        return "❌ 草稿內容太短，請提供更多資訊。";
    }
    
    // 自動修復格式：確保有 " / A："
    qaText = autoFixQAFormat(qaText);
    
    try {
        const lock = LockService.getScriptLock();
        lock.waitLock(10000);
        
        const sheet = ss.getSheetByName(SHEET_NAMES.QA);
        if (!sheet) {
            lock.releaseLock();
            return "❌ 找不到 QA 工作表";
        }
        
        // 直接寫入 QA 文字
        sheet.appendRow([qaText]);
        SpreadsheetApp.flush();
        lock.releaseLock();
        
        // 清除快取並同步知識庫
        CacheService.getScriptCache().remove(CACHE_KEYS.ENTRY_DRAFT_PREFIX + draft.userId);
        syncGeminiKnowledgeBase();
        
        writeLog(`[Draft Saved to QA] ${qaText.substring(0, 50)}...`);
        return `✅ 已寫入 QA 並更新知識庫！\n\n寫入內容：${qaText}`;
        
    } catch (e) {
        writeLog(`[SaveDraft Error] ${e.message}`);
        return `❌ 寫入失敗：${e.message}`;
    }
}

/**
 * 自動修復 QA 格式，確保有 " / A："
 * @param {string} text - 原始 QA 文字
 * @returns {string} 修復後的 QA 文字
 */
function autoFixQAFormat(text) {
    if (!text) return text;
    var trimmed = text.trim();
    
    // 已經有正確格式，直接返回
    if (trimmed.indexOf(' / A：') > -1) {
        return trimmed;
    }
    
    // 嘗試修復：常見錯誤格式
    // 1. 半形逗號分隔 "問題, 答案"
    if (trimmed.indexOf(', ') > -1 && trimmed.indexOf(' / A：') === -1) {
        var commaIdx = trimmed.indexOf(', ');
        var q = trimmed.substring(0, commaIdx).trim();
        var a = trimmed.substring(commaIdx + 2).trim();
        writeLog('[AutoFix] 修復逗號格式: ' + q.substring(0, 30));
        return q + ' / A：' + a;
    }
    
    // 2. 全形逗號分隔 "問題，答案"
    if (trimmed.indexOf('，') > -1 && trimmed.indexOf(' / A：') === -1) {
        var commaIdx = trimmed.indexOf('，');
        var q = trimmed.substring(0, commaIdx).trim();
        var a = trimmed.substring(commaIdx + 1).trim();
        writeLog('[AutoFix] 修復全形逗號格式: ' + q.substring(0, 30));
        return q + ' / A：' + a;
    }
    
    // 3. 有問號，以問號切分
    var qMarkIdx = Math.max(trimmed.indexOf('?'), trimmed.indexOf('？'));
    if (qMarkIdx > 0 && qMarkIdx < trimmed.length - 1) {
        var q = trimmed.substring(0, qMarkIdx + 1).trim();
        var a = trimmed.substring(qMarkIdx + 1).trim();
        writeLog('[AutoFix] 以問號切分: ' + q.substring(0, 30));
        return q + ' / A：' + a;
    }
    
    // 4. 無法自動修復，加上預設前綴
    writeLog('[AutoFix] 無法自動判斷，加預設格式');
    return '相關問題 / A：' + trimmed;
}

function handleAutoQA(u, cid) {
    const history = getHistoryFromCacheOrSheet(cid);
    if (history.length < 2) return "❌ 對話不足，無法自動整理";

    try {
        // 將最近對話整理成一行 QA（問題, 答案）
        const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
        const convo = history.slice(-6).map(m => `${m.role}: ${m.content}`).join("\n");
        const prompt = `請把以下對話濃縮成一行「問題 / A：答案」格式。
只回傳一行，用「 / A：」分隔，不要解釋。

對話：
${convo}`;

        const payload = { 
            contents: [{ role: 'user', parts: [{ text: prompt }] }], 
            generationConfig: { 
                maxOutputTokens: 300, 
                temperature: 0.3,
                thinkingConfig: { thinkingBudget: 0 }
            } 
        };
        const res = UrlFetchApp.fetch(`${CONFIG.API_ENDPOINT}/${CONFIG.MODEL_NAME}:generateContent?key=${apiKey}`, { method: 'post', headers: { 'Content-Type': 'application/json' }, payload: JSON.stringify(payload), muteHttpExceptions: true });

        let qaLine = '';
        if (res.getResponseCode() === 200) {
            try {
                const j = JSON.parse(res.getContentText());
                const cands = j && j.candidates ? j.candidates : [];
                if (Array.isArray(cands) && cands.length > 0) {
                    const p = cands[0].content && cands[0].content.parts;
                    if (Array.isArray(p) && p.length > 0 && p[0].text) {
                        qaLine = p[0].text.trim().replace(/[\r\n]+/g, ' ');
                    }
                }
            } catch (parseErr) {
                writeLog(`[AutoQA Parse Error] ${parseErr.message}`);
            }
        }

        if (!qaLine || qaLine.length < 10) {
            // 降級：簡單從最後兩句生成
            const lastUser = history.slice().reverse().find(m => m.role === 'user');
            const lastBot = history.slice().reverse().find(m => m.role === 'assistant');
            const q = (lastUser && lastUser.content) ? lastUser.content : '問題';
            const a = (lastBot && lastBot.content) ? lastBot.content : '待補';
            qaLine = `${q}, ${a}`;
        }

        const sheet = ss.getSheetByName(SHEET_NAMES.QA);
        sheet.appendRow([qaLine]);
        SpreadsheetApp.flush();
        syncGeminiKnowledgeBase();
        return `✅ 已自動整理並存入 QA：\n${qaLine.substring(0, 50)}...`;

    } catch (e) {
        writeLog(`[AutoQA Error] ${e.message}`);
        return "❌ 整理失敗";
    }
}

// ==========================================
// 6. 資料寫入與工具函式 (全展開)
// ==========================================

function sanitizeForSheet(text) {
  if (!text) return "";
  let s = text.toString();
  s = s.replace(/[\r\n]+/g, " "); 
  s = s.replace(/,/g, "，");
  s = s.replace(/:/g, "：");
  return s.trim();
}

function writeQA(l,s,p,a,n) {
  const lock = LockService.getScriptLock();
  try { 
    lock.waitLock(10000);
    const sheet = ss.getSheetByName(SHEET_NAMES.QA);
    if (!sheet) return false;
    const cleanP = sanitizeForSheet(p);
    const cleanA = sanitizeForSheet(a);
    const cleanN = sanitizeForSheet(n);
    sheet.appendRow([[new Date().toLocaleDateString(),l,s,cleanP,cleanA,cleanN].join(", ")]);
    SpreadsheetApp.flush();
    return true;
  } catch (e) { 
      writeLog("[WriteQA Error] " + e);
      return false; 
  } finally { 
      try { lock.releaseLock(); } catch (e) {} 
  }
}

function writeRule(k,d,u,desc) {
  const lock = LockService.getScriptLock();
  try { 
    lock.waitLock(10000);
    const sheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    if (!sheet) return false;
    const cleanK = sanitizeForSheet(k);
    const cleanD = sanitizeForSheet(d);
    const cleanDesc = sanitizeForSheet(desc);
    sheet.appendRow([[cleanK,cleanD,u,cleanDesc].join(", ")]);
    SpreadsheetApp.flush();
    return true;
  } catch (e) { 
      writeLog("[WriteRule Error] " + e);
      return false; 
  } finally { 
      try { lock.releaseLock(); } catch (e) {} 
  }
}

function writeLog(msg) {
  if(ss) {
      try { 
          // 移除換行，確保 Log 單行
          const cleanMsg = msg.replace(/[\r\n]+/g, " ");
          const logSheet = ss.getSheetByName(SHEET_NAMES.LOG);
          logSheet.appendRow([new Date(), cleanMsg]); 
          SpreadsheetApp.flush(); 
          
          // 自動清理：保留最新 500 筆
          const lastRow = logSheet.getLastRow();
          if (lastRow > 600) {
              const deleteCount = lastRow - 500;
              logSheet.deleteRows(1, deleteCount);
              SpreadsheetApp.flush();
          }
      } catch(e){} 
  }
  console.log(msg);
}

function getHistoryFromCacheOrSheet(cid) {
  const c = CacheService.getScriptCache();
  const k = `${CACHE_KEYS.HISTORY_PREFIX}${cid}`;
  const v = c.get(k);
  if (v) {
      try { return JSON.parse(v); } catch(e) {}
  }
  try {
    // 2025-12-05: 恢復 Sheet 讀取 (Cache Miss 時的備案)
    let s = ss.getSheetByName(SHEET_NAMES.LAST_CONVERSATION);
    if (!s) {
        // 若 Sheet 不存在，視為無歷史，不需建立 (等到寫入時再建)
        return [];
    }
    const f = s.getRange("A:A").createTextFinder(cid).matchEntireCell(true).findNext();
    if (f) {
        return JSON.parse(s.getRange(f.getRow(), 2).getValue());
    }
  } catch(e) {}
  return [];
}

function updateHistorySheetAndCache(cid, prev, uMsg, aMsg) {
  try {
    let base = Array.isArray(prev) ? prev.slice() : [];
    if (base.length % 2 !== 0) {
        base.shift();
    }
    
    // 合併新訊息
    let newHist = [...base, uMsg, aMsg];
    
    // v24.0.0: 智慧摘要機制 (Rolling Summary)
    // 只在超長對話 (>12對=24則) 才觸發摘要，避免過度壓縮導致失憶
    const SUMMARY_THRESHOLD = CONFIG.SUMMARY_THRESHOLD * 2; // 24
    const MAX_MSG_COUNT = CONFIG.HISTORY_PAIR_LIMIT * 2; // 20 (Fast Mode 上限)
    
    if (newHist.length > SUMMARY_THRESHOLD) {
        writeLog(`[History] 超長對話 (${newHist.length} > ${SUMMARY_THRESHOLD})，啟動摘要...`);
        
        const splitIndex = Math.floor(newHist.length / 2);
        const safeSplitIndex = splitIndex % 2 === 0 ? splitIndex : splitIndex - 1;
        
        const oldMsgs = newHist.slice(0, safeSplitIndex);
        const recentMsgs = newHist.slice(safeSplitIndex);
        
        const summary = callGeminiToSummarize(oldMsgs);
        
        if (summary) {
            const summaryMsg = { 
                role: 'user', 
                content: `【系統自動摘要】\n之前的對話重點：${summary}\n(請基於此上下文繼續服務)` 
            };
            const ackMsg = {
                role: 'assistant',
                content: '好的，我已了解之前的對話脈絡。'
            };
            
            newHist = [summaryMsg, ackMsg, ...recentMsgs];
            writeLog(`[History] 摘要完成，新長度: ${newHist.length}`);
        } else {
            newHist = newHist.slice(-MAX_MSG_COUNT);
            writeLog(`[History] 摘要失敗，執行簡單切分`);
        }
    }
    
    const json = JSON.stringify(newHist);
    CacheService.getScriptCache().put(`${CACHE_KEYS.HISTORY_PREFIX}${cid}`, json, CONFIG.CACHE_TTL_SEC);

    // 2025-12-05: 恢復 Sheet 寫入 (長期記憶備份)
    // 自動檢查並建立 Sheet，防止因刪除導致失效
    try {
        let s = ss.getSheetByName(SHEET_NAMES.LAST_CONVERSATION);
        if (!s) {
            s = ss.insertSheet(SHEET_NAMES.LAST_CONVERSATION);
            s.appendRow(["ContextID", "HistoryJSON", "LastUpdated"]); // 補標題
            writeLog(`[AutoCreate] 已自動重建 ${SHEET_NAMES.LAST_CONVERSATION} 工作表`);
        }
        
        const f = s.getRange("A:A").createTextFinder(cid).matchEntireCell(true).findNext();
        if (f) {
            s.getRange(f.getRow(), 2).setValue(json);
            s.getRange(f.getRow(), 3).setValue(new Date());
        } else {
            s.appendRow([cid, json, new Date()]);
        }
    } catch (sheetErr) {
        writeLog(`[History Sheet Error] ${sheetErr.message}`);
    }

  } catch (e) {
      writeLog(`[UpdateHistory Error] ${e.message}`);
  }
}

/**
 * 呼叫 Gemini 摘要對話紀錄
 */
function callGeminiToSummarize(messages) {
    const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    if (!apiKey) return null;
    
    const convoText = messages.map(m => `${m.role === 'user' ? '用戶' : '客服'}: ${m.content}`).join('\n');
    
    // 2025-12-05 v23.6.5: 強化摘要 Prompt，強制保留關鍵實體
    const prompt = `請將以下客服對話摘要成 300 字以內的重點。
【強制保留關鍵實體 (Key Entities)】
1. 產品型號 (如 G90XF, S32DG802) - 這是最重要的資訊，絕對不能遺漏！
2. 故障代碼或具體問題 (如 3D 無法開啟, 螢幕閃爍)
3. 用戶偏好或特殊需求
4. 已嘗試過的解決方案

請以第三人稱客觀描述，例如：「用戶詢問 G90XF 的 3D 功能...」。

${convoText}`;

    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { 
            maxOutputTokens: 500, 
            temperature: 0.3
        }
    };
    
    try {
        const res = UrlFetchApp.fetch(`${CONFIG.API_ENDPOINT}/${CONFIG.MODEL_NAME}:generateContent?key=${apiKey}`, {
            method: 'post',
            headers: { 'Content-Type': 'application/json' },
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        });
        
        if (res.getResponseCode() !== 200) return null;
        
        const json = JSON.parse(res.getContentText());
        if (json.candidates && json.candidates[0].content) {
            return json.candidates[0].content.parts[0].text.trim();
        }
        return null;
    } catch (e) {
        writeLog(`[Summarize Error] ${e.message}`);
        return null;
    }
}

function clearHistorySheetAndCache(cid) {
  try {
    // const s = ss.getSheetByName(SHEET_NAMES.LAST_CONVERSATION);
    // const f = s.getRange("A:A").createTextFinder(cid).matchEntireCell(true).findNext();
    // if (f) {
    //     s.getRange(f.getRow(), 2).clearContent();
    // }
    const cache = CacheService.getScriptCache();
    cache.remove(`${CACHE_KEYS.HISTORY_PREFIX}${cid}`);
    // 同時清除 PDF 模式
    cache.remove(CACHE_KEYS.PDF_MODE_PREFIX + cid);
  } catch (e) {}
}

// ========== 7. LINE Webhook 入口 ==========

/**
 * GET 請求處理（健康檢查 + 自動恢復觸發器）
 * 部署後瀏覽器訪問一次 Web App URL 即可啟動排程
 */
function doGet(e) {
  ensureSyncTriggerExists();
  return ContentService.createTextOutput("OK - Trigger verified").setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    // 自動檢查並恢復排程（部署後自癒）
    ensureSyncTriggerExists();
    
    const postData = e && e.postData ? e.postData : {};
    const contents = postData.contents || '{}';
    const json = JSON.parse(contents);
    const events = json.events || [];
    
    events.forEach(function(event) {
      if (event.type === 'message') {
        const eventId = event.webhookEventId;
        if (isDuplicateEvent(eventId)) return;
        
        const isGroup = event.source.type === 'group' || event.source.type === 'room';
        var contextId = isGroup ? event.source.groupId : event.source.userId;
        var userId = event.source.userId;
        var replyToken = event.replyToken;

        if (isGroup) {
            if (event.message.type === 'text') {
                const botUserId = getBotUserId();
                const mention = event.message.mention || {};
                const mentions = mention.mentionees || [];
                if (!mentions.some(function(m) { return m.userId === botUserId; })) return;
                var cleanedText = event.message.text;
                mentions.forEach(function(m) { 
                    if (m.userId === botUserId) {
                        cleanedText = cleanedText.replace(cleanedText.substring(m.index, m.index + m.length), '').trim(); 
                    }
                });
                if (!cleanedText) { replyMessage(replyToken, "有事嗎？"); return; }
                handleMessage(cleanedText, userId, replyToken, contextId, event.message.id);
            } else if (event.message.type === 'image') {
                if (userId === CONFIG.VIP_IMAGE_USER) {
                    handleImageMessage(event.message.id, userId, replyToken, contextId);
                }
            }
        } else {
            if (event.message.type === 'text') {
                handleMessage(event.message.text, userId, replyToken, contextId, event.message.id);
            } else if (event.message.type === 'image') {
                handleImageMessage(event.message.id, userId, replyToken, contextId);
            }
        }
      }
    });
    return ContentService.createTextOutput(JSON.stringify({ status: "ok" })).setMimeType(ContentService.MimeType.JSON);
  } catch (e) { return ContentService.createTextOutput(JSON.stringify({ status: "error" })).setMimeType(ContentService.MimeType.JSON); }
}

// ========== 8. 輔助工具 (Utils) ==========

function replyMessage(tk, txt) {
  try {
    UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", {
      method: "post",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + PropertiesService.getScriptProperties().getProperty("TOKEN") },
      payload: JSON.stringify({ replyToken: tk, messages: [{ type: "text", text: txt.substring(0, 4000) }] }),
      muteHttpExceptions: true
    });
  } catch (e) {
      writeLog("[Reply Error] " + e);
  }
}

function showLoadingAnimation(uid, sec) {
  try {
    UrlFetchApp.fetch("https://api.line.me/v2/bot/chat/loading/start", {
      method: "post",
      headers: { "Authorization": "Bearer " + PropertiesService.getScriptProperties().getProperty("TOKEN"), "Content-Type": "application/json" },
      payload: JSON.stringify({ chatId: uid, loadingSeconds: sec }),
      muteHttpExceptions: true
    });
  } catch (e) {}
}

function getBotUserId() {
  let id = PropertiesService.getScriptProperties().getProperty("BOT_USER_ID");
  if (!id) {
    try {
      const res = UrlFetchApp.fetch("https://api.line.me/v2/bot/info", { headers: { "Authorization": "Bearer " + PropertiesService.getScriptProperties().getProperty("TOKEN") } });
      if (res.getResponseCode() === 200) { 
          id = JSON.parse(res.getContentText()).userId; 
          PropertiesService.getScriptProperties().setProperty("BOT_USER_ID", id); 
      }
    } catch (e) {}
  }
  return id;
}

function isDuplicateEvent(id) {
  const c = CacheService.getScriptCache();
  if(c.get(id)) return true;
  c.put(id,'1',60);
  return false;
}

function hasRecentAnimation(id) { 
    return CacheService.getScriptCache().get(`anim_${id}`) != null; 
}

function markAnimationShown(id) { 
    CacheService.getScriptCache().put(`anim_${id}`, '1', 20); 
}

function runInitializeAndSync() { 
    Object.values(SHEET_NAMES).forEach(name => { 
        if (!ss.getSheetByName(name)) {
            ss.insertSheet(name); 
        }
    }); 
    syncGeminiKnowledgeBase(); 
}

// 讀取最近 LOG（供 CLASP 呼叫）
function getRecentLogs(count = 50) {
    const sheet = ss.getSheetByName(SHEET_NAMES.LOG);
    if (!sheet) return "LOG sheet not found";
    const lastRow = sheet.getLastRow();
    const startRow = Math.max(1, lastRow - count + 1);
    const data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 2).getValues();
    return data.map(row => `${row[0]} | ${row[1]}`).join('\n');
}

// 測試 /紀錄 功能（供 CLASP 呼叫）
function testDraftFunction(inputText) {
    try {
        const testInput = inputText || "M50A,M50B,M50C有內建陀螺儀";
        writeLog(`[Test] 測試輸入: ${testInput}`);
        
        // Step 1: 呼叫 callGeminiToDraft
        const draft = callGeminiToDraft(testInput, "initial", null);
        writeLog(`[Test] AI 產出 Draft: ${JSON.stringify(draft)}`);
        
        // Step 2: 產生預覽訊息
        const preview = generatePreviewMsg(draft);
        writeLog(`[Test] 預覽訊息: ${preview.substring(0, 200)}...`);
        
        // Step 3: 模擬驗證 (不實際寫入)
        let validationResult = "";
        if (draft.type === "qa") {
            if (!draft.q || !draft.a || draft.q === 'undefined' || draft.a === 'undefined') {
                validationResult = "❌ QA 草稿不完整，缺少問題(q)或答案(a)欄位";
            } else {
                validationResult = `✅ QA 草稿有效\nQ: ${draft.q}\nA: ${draft.a}`;
            }
        } else if (draft.type === "rule") {
            if (!draft.key || !draft.def || draft.key === 'undefined' || draft.def === 'undefined') {
                validationResult = "❌ Rule 草稿不完整，缺少關鍵字(key)或定義(def)欄位";
            } else {
                validationResult = `✅ Rule 草稿有效\nKey: ${draft.key}\nDef: ${draft.def}\nDesc: ${draft.desc || '(無)'}`;
            }
        } else if (draft.type === "error") {
            validationResult = `❌ AI 回傳錯誤: ${draft.message || '內容不足'}`;
        } else {
            validationResult = `❌ 未知類型: ${draft.type}`;
        }
        
        writeLog(`[Test] 驗證結果: ${validationResult}`);
        
        return {
            input: testInput,
            draft: draft,
            preview: preview,
            validation: validationResult
        };
    } catch (e) {
        writeLog(`[Test Error] ${e.message}`);
        return { error: e.message };
    }
}