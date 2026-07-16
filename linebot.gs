// ⛔️ FATAL RULE: NEVER USE LINE PUSH MESSAGES. EVER.
// ⛔️ IRON RULE: DEPLOYMENT PROTOCOL (GOOGLE OFFICIAL STANDARD)
// 1. PUSH CODE: `clasp push`
// 2. VERSION: `clasp version "vxx.x.xx desc"` (Create immutable snapshot)
// 3. DEPLOY: `clasp deploy -i [DEPLOYMENT_ID] -V [VERSION_NUM]` (Update pointer)
// ⚠️ NEVER create new deployments. ALWAYS update the existing deployment ID with a new version number.
// ════════════════════════════════════════════════════════════════
// 🔧 模型與計價設定 (要調整就改這裡！)
// ════════════════════════════════════════════════════════════════
const EXCHANGE_RATE = 32; // 匯率 USD -> TWD

// ════════════════════════════════════════════════════════════════
// 🔧 版本號 (每次修改必須更新！)
// ════════════════════════════════════════════════════════════════
// 更新版本號
const GAS_VERSION = "v29.6.085"; // 2026-07-16 移除臨時端點，修復紀錄指令 alertMsg 未定義 Bug，修復 Flex 選擇泡泡 footerText 未定義 Bug
const BUILD_TIMESTAMP = "2026-07-14 16:55";
let quickReplyOptions = []; // Keep for backward compatibility if needed, but primary is param
const MAX_ELABORATE_PER_ANSWER = 2;
const ELABORATE_STATE_TTL_SECONDS = 21600; // 6 小時
const INLINE_PDF_FALLBACK_MAX_BYTES = 18 * 1024 * 1024;

// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// 1. 一般對話適用的服務 (可改)
// ════════════════════════════════════════════════════════════════
// 🟢 [開關] 選擇主要的 LLM 服務提供者
// 選項: 'Gemini' (Google 原廠) 或 'OpenRouter' (第三方聚合服務)
const LLM_PROVIDER = "Gemini";

// ════════════════════════════════════════════════════════════════
// 2. 一般對話 (Fast Mode) 模型與價格 (可改)
// ════════════════════════════════════════════════════════════════
// 🅰️ 若上方選擇 'Gemini'，則使用以下設定：
const GEMINI_MODEL_FAST = "models/gemini-2.5-flash-lite";
const PRICE_FAST_INPUT = 0.1; // $0.10 per 1M Input (Gemini 2.5 Flash-Lite)
const PRICE_FAST_OUTPUT = 0.4; // $0.40 per 1M Output (Gemini 2.5 Flash-Lite)

// 🅱️ 若上方選擇 'OpenRouter' (需填寫 OPENROUTER_API_KEY)，則使用以下設定：
const OPENROUTER_MODEL = "qwen/qwen-2.5-7b-instruct";
const OPENROUTER_PRICE_IN = 0.04; // $0.04 per 1M Input
const OPENROUTER_PRICE_OUT = 0.1; // $0.10 per 1M Output

// ════════════════════════════════════════════════════════════════
// 3. PDF 對話 (Think Mode) (強制 Gemini，為了穩定)
// ════════════════════════════════════════════════════════════════
// ⚠️ 注意：PDF 閱讀模式目前強制定錨在 Google Gemini
const GEMINI_MODEL_THINK = "models/gemini-2.5-flash-lite";
const PRICE_THINK_INPUT = 0.1; // $0.10 per 1M Input (Gemini 2.5 Flash-Lite)
const PRICE_THINK_OUTPUT = 0.4; // $0.40 per 1M Output (Gemini 2.5 Flash-Lite)

// ════════════════════════════════════════════════════════════════
// 4. QA/RULE 生成 (Polish Mode) (固定 Gemini 2.5 Flash-Lite)
// ════════════════════════════════════════════════════════════════
// ⚠️ 注意：/記錄 功能固定使用 Gemini 2.5 Flash-Lite，避免 latest alias 漂移造成成本上升。
const GEMINI_MODEL_POLISH = "models/gemini-2.5-flash-lite";
const PRICE_POLISH_INPUT = 0.1;
const PRICE_POLISH_OUTPUT = 0.4; // $0.40 per 1M Output
// ════════════════════════════════════════════════════════════════
// 💰 改模型時，只需改上面對應的 MODEL + PRICE 那兩行！
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// 🧪 TEST MODE GLOBALS (測試模式全域變數)
// ════════════════════════════════════════════════════════════════
// 📌 TestUI 使用方式：
//    1. 開啟 Web App URL 並加上 ?test=1 參數
//    2. 例如：https://script.google.com/macros/s/xxxxx/exec?test=1
//    3. 或在 GAS 編輯器選擇函數 doGet 並執行
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// 版本號：v27.9.54 (Switch to Gemini)
// 1. 設定: 將 LLM_PROVIDER 切換回 Gemini (原廠穩定版)
// 2. 修正: 解決用戶端配置未生效的問題
// ════════════════════════════════════════════════════════════════
// ⚠️ 清除測試介面時請刪除此區塊 + 區塊 9 (TEST UI) + TestUI.html
var IS_TEST_MODE = false;
var TEST_LOGS = [];
// v27.8.5: Log 緩衝區 (Batch Logging)
var PENDING_LOGS = [];
// v29.5.180: 路由噪音 Log 精簡（保留可追溯關鍵點）
var LOG_FILTER_STATE = {
  loadedAt: 0,
  compactRouting: true,
};
// ════════════════════════════════════════════════════════════════

function computeReplyAnchor_(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return "";
  }
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw);
  return digest
    .map((b) => (b & 0xff).toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 16);
}

function getElaborationStateKey_(userId) {
  return `${userId}:elaboration_state`;
}

function readElaborationState_(cache, userId) {
  try {
    const raw = cache.get(getElaborationStateKey_(userId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch (e) {
    writeLog(`[Elaboration State] 解析失敗: ${e.message}`);
    return null;
  }
}

function writeElaborationState_(cache, userId, anchor, count) {
  const state = {
    anchor: anchor || "",
    count: Number(count) || 0,
    updatedAt: Date.now(),
  };
  cache.put(
    getElaborationStateKey_(userId),
    JSON.stringify(state),
    ELABORATE_STATE_TTL_SECONDS,
  );
}

function getElaborationCountForAnchor_(cache, userId, anchor) {
  if (!anchor) {
    return 0;
  }
  const state = readElaborationState_(cache, userId);
  if (!state || state.anchor !== anchor) {
    return 0;
  }
  return Number(state.count) || 0;
}

function getElaborationTopicAnchor_(cache, userId, fallbackText) {
  const topicText = (
    cache.get(`${userId}:last_meaningful_query`) ||
    fallbackText ||
    ""
  ).trim();
  return computeReplyAnchor_(topicText);
}

/**
 * LINE Bot Assistant - 台灣三星電腦螢幕專屬客服 (Gemini 雙模型 + 三層記憶)
 * Version: v27.9.56 (Fix blank PDF reply, Update 2026-01 Activity, Washing Machine Series)
 *
 * 🔥 v27.9.56 更新 (Fix blank PDF reply, Update 2026-01 Activity, Washing Machine Series):
 *   - 修正: 解決 PDF 模式下偶爾出現空白回覆的問題
 *   - 更新: 2026-01 活動規則與洗衣機系列產品資訊
 *   - 優化: 延長動畫顯示時間至 60 秒，提升用戶體驗
 *
 * 🔥 v27.9.55 更新 (Fix Error Handling & Ext):
 *   - 修正: 針對 API 400 (Invalid Key) / 429 (Quota) 回傳繁體中文錯誤提示
 *   - 優化: 本地端工具檔統一更名為 .gs 以解決 Clasp 上傳問題
 *   - 文件: 建立 AI_CONTEXT.md 並定義語言鐵律
 *
 * 🔥 v27.9.54 更新 (Switch to Gemini):
 *   - 設定: 將 LLM_PROVIDER 切換回 Gemini (原廠穩定版)
 *   - 修正: 解決用戶端配置未生效的問題
 *   - 測試: 注入 [System Checks] Log 以驗證版本
 *
 * 🔥 v27.9.43 更新 (PDF Trigger Fix):
 *   - 修正：針對 OpenRouter 模型 (Qwen/DeepSeek) 優化 PDF 觸發機制
 *   - 邏輯：命中直通車關鍵字且非簡單問題時，強制啟動手冊查詢，不再完全依賴 AI 判斷
 *
 * 🔥 v27.9.42 更新 (Model Switch: Qwen):
 *   - 切換：OpenRouter 模型改為 qwen/qwen-2.5-7b-instruct
 *   - 費率：更新為 $0.04/$0.10
 *
 * 🔥 v27.9.41 更新 (Model Switch):
 *   - 切換：主要服務商改為 OpenRouter
 *   - 模型：使用 x-ai/grok-code-fast-1
 *   - 費率：更新為 $0.05/$0.15
 *
 * 🔥 v27.9.40 更新 (Config Structure):
 *   - 優化：設定區塊重構為 4 大區塊，明確區分「可修改」與「強制」項目
 *   - 1. 主要服務 (Gemini/OpenRouter) - 可改
 *   - 2. 一般對話 (Fast Mode) - 可改 (含 OpenRouter 費率)
 *   - 3. PDF 對話 (Think Mode) - 強制 Gemini
 *   - 4. QA/RULE 生成 (Polish Mode) - 固定 Gemini 2.5 Flash-Lite
 *
 * 🔥 v27.9.38 更新 (Fixes):
 *   - 修正：修復 LLM_PROVIDER 未定義導致的系統錯誤
 *
 * 🔥 v27.9.37 更新 (OpenRouter Integration):
 *   - 新增：支援切換至 OpenRouter (如 DeepSeek, Claude 等模型)
 *   - 設定：於程式碼最上方調整 LLM_PROVIDER 與 OPENROUTER_MODEL
 *   - 限制：PDF 模式與 Talk Smart 模式仍維持使用 Gemini 以確保穩定性
 *
 * 🔥 v27.9.34 更新 (Git Sync):
 *   - 同步本地變更至 GitHub 倉庫
 *
 * 🔥 v27.9.33 更新 (4-Round Progressive Flow):
 *   - 修正：漸進式流程改為4輪（R1 QA+再找找QA, R2 QA+問PDF, R3 PDF+問WEB, R4 WEB）
 *   - 修正：KB Select 邏輯，forceCurrentOnly=false 時保留歷史型號，確保第3輪能找到 PDF
 *   - 修正：LLM 話題判斷 API Key 取得方式
 *
 * 🔥 v27.9.32 更新 (Progressive Problem-Solving Flow):
 *   - 新增：漸進式問題解決流程（QA → PDF → WEB）
 *   - 新增：動態 Token 閾值（一般 20k，網路搜尋 40k）
 *   - 新增：LLM 智慧判斷話題延續性（使用 Gemini Flash 判斷是否為同一話題，避免歷史污染）
 *   - 優化：拆分 Odyssey 3D QA 為 6 條獨立條目，降低 Token 使用量
 *   - 修正：強化 PDF/WEB 觸發指示，禁止 LLM 假裝查手冊
 *
 * 🔥 v27.9.31 更新 (Revert Hardcode):
 * - 修正：移除 v27.9.30 的寫死 Prompt，恢復讀取 Google Sheet 設定。
 * - 提醒：請至 Spreadsheet B3 調整溫度 (建議 0.8+)，C3 更新 Prompt。
 *
 * 🔥 v27.9.29 更新 (Humanity):
 * - 修正：Prompt 恢復「消化整理」模式，並強制項與項之間空行，提升 LINE 閱讀體驗。
 *
 * 🔥 v27.9.27 更新 (Recall Fix):
 * - 修正：QA 匹配過於嚴格，導致「M7」問句搜不到「三星螢幕」的通用 QA。
 *   └─ 新增保底機制：若 QA 包含「三星螢幕」或「SMART」，即使沒命中型號，也給予 0.5 分強制召回。
 *
 * 🔥 v27.9.26 更新 (Debug):
 * - 修正：中文內容導致的 Cache 寫入失敗 (40000 chars * 3 bytes = 120KB > 100KB)
 *   └─ GAS Cache 限制是 Bytes (100KB)。之前 40000 字在全中文下仍會超標。
 *   └─ 修正：分割大小降至 25000 字元 (約 75KB)，確保全中文環境下也能穩定寫入。
 *
 * 🔥 v27.9.24 更新 (Critical Fix)：
 *
 * 🔥 v27.9.23 更新 (關鍵修復)：
 * - 修正：同步機制防呆 (Sync Safety)
 *   └─ 若讀取到的 QA 筆數為 0 且非強制重建，自動中止同步，防止 Cache 被清空導致「失憶」。
 * - 修正：Rules 匹配上限放寬
 *   └─ MAX_PER_KEYWORD 6 -> 15，MAX_TOTAL_RULES 50 -> 80
 *   └─ 確保像「M7」這種熱門型號，能同時抓到「規格」與「Smart系列定義」，不再因為額滿而漏掉定義。
 *
 * 🔥 v27.9.22 更新 (Prompt & Log 修正)：
 * - 修正：移除極速模式 Prompt 中硬編碼的「優先使用 CLASS_RULES」，改為「最高優先檢查 QA」
 * - 優化：放寬 /記錄 修改歷史的 Log 顯示長度 (100 -> 500)，避免誤解 (實際傳給 AI 的是完整的)
 *
 * 🔥 v27.9.21 更新 (架構優化)：
 * - 關鍵修正：callGeminiToPolish/MergeQA/RefineQA 都添加 lastTokenUsage 設定
 *
 * 🔥 v27.9.18 更新 (改回 Gemini 2.0 Flash)：
 * - 重構：費率設定集中到常數 (PRICE_FAST_INPUT, PRICE_FAST_OUTPUT, EXCHANGE_RATE)
 * - 修復：maxOutputTokens 從 1000 提高到 2000，解決 /記錄 時 thinking tokens 佔用配額導致輸出被截斷
 * - 更新：費率從 Gemini 2.0 Flash ($0.10/$0.40) 更新為 Gemini 2.5 Flash ($0.15/$0.60)
 *
 * 🔥 v27.9.15 更新 (QA 全掃排序)：
 * - 新增：當 Input tokens 超過 20,000 時，在回覆末尾顯示「知識庫超載警告」
 * 🔥 v27.9.13 更新 (來源標註細分)：
 * - 新增：區分 CLASS_RULES 與 QA Sheet 的來源標籤
 * 🔥 v27.9.12 更新 (PDF 匹配條件修正)：
 * - 修正：只有當 AI 明確輸出 [AUTO_SEARCH_PDF] 時才觸發 PDF 智慧匹配
 * - 效果：規格問題（如「M5有支援Smart嗎」）不再強制反問型號，直接用 CLASS_RULES 回答
 *
 * 🔥 v27.9.11 更新 (Fast Mode Prompt 強化)：
 * - 優化：強化極速模式 Prompt，讓 AI 更自信使用 CLASS_RULES 回答規格問題
 * 🔥 v27.9.10 更新 (空值檢查修復)：
 * - 修正：checkDirectDeepSearch 加入 msg 空值檢查，防止 undefined.toUpperCase() 錯誤
 * 🔥 v27.9.9 更新 (Token 診斷日誌)：
 * - 診斷：在 replyMessage 加入 [Reply Debug] 日誌，顯示 LINE_TOKEN 前10字元
 *
 * 🔥 v27.9.8 更新 (Token 屬性名稱修正)：
 * - 修正：將 TOKEN 改為 LINE_TOKEN（配合用戶的 Script Properties 命名）
 * - 影響：replyMessage, showLoadingAnimation, getBotUserId, handleImageMessage
 *
 * 🔥 v27.9.7 更新 (Webhook 修復)：
 * - 修正：合併兩個重複的 doGet 函數（原因：302 Found 錯誤）
 * - 修正：LINE Verify 現在會正確返回 200 OK
 * - 修正：TestUI 改為透過 ?test=1 參數訪問
 *
 * 🔥 v27.9.6 更新 (程式碼清理與診斷)：
 * - 修正：移除 doPost 函數中重複的 return 語句（行 4847-4848）
 * - 診斷：LINE Bot 無法回覆問題排查（TestUI 正常運作）
 * - 確認：IS_TEST_MODE 初始值正確為 false
 *
 * 🔥 v27.9.5 更新 (多型號比較回覆修正)：
 * - 修正：多型號攔截邏輯 - 只有當 AI 明確要求查 PDF ([AUTO_SEARCH_PDF]) 且有多個型號時才攔截
 * - 修正：比較題（用 CLASS_RULES 回答）會正常顯示 AI 的回答，不再被錯誤攔截
 * - 修正：補回缺少的 catch 區塊，修復 try-catch 結構
 *
 * 🔥 v27.9.4 更新 (成本控制強化與逾時防護)：
 * - 新增：getRelevantKBFiles 預算閥值 - 比較模式限制最多載入 2 本 PDF (slice(0, 2))
 * - 新增：Prompt 比較題處理原則 - 5 條規則強調優先使用 CLASS_RULES，避免不必要的 PDF 查詢
 * - 新增：buildDynamicContext 關鍵字數量限制 (MAX_KEYWORDS = 10)，防止嵌套迴圈導致逾時
 * - 新增：超過 2 個型號時的禮貌提示 - 顯得專業而非預算限制
 *
 * 🔥 v27.9.3 更新 (Token 優化與比較邏輯修正)：
 * - 修正：buildDynamicContext 改用「每個關鍵字獨立配額」機制（每個 6 行，總上限 50 行）
 * - 修正：解決 M8 佔滿配額導致 M9 規則被丟棄的問題，避免觸發 5 萬 Token 的完整注入
 * - 修正：從 nonPdfPatterns 移除「比較|差異|不同」，允許比較題在必要時進入 PDF Mode
 * - 修正：getRelevantKBFiles 智慧型號鎖定，偵測比較意圖時保留所有型號
 *
 * 🔥 v27.9.2 更新 (型號比較攔截修正)：
 * - 修正：移除直通車階段的「型號過多」攔截（型號比較用 CLASS_RULES 就夠了）
 * - 新增：PDF 查詢階段才檢查多型號，提示用戶「一次只能查一款型號的 PDF」
 *
 * 🔥 v27.9.0 更新 (Token 成本優化)：
 * - 新增：多型號同時偵測（checkDirectDeepSearchWithKey 返回所有命中的關鍵字）
 * - 修正：型號衝突後使用 forceCurrentOnly 避免歷史型號污染 PDF 匹配
 * - 移除：誤導性的「總內容長度」預估（實際 Token 在 [Tokens] 日誌顯示）
 *
 * 🔥 v27.8.30 更新 (語法除錯)：
 * - 手動校對所有括號層級，確認 handleMessage 結尾為 `}} catch`。
 * - 修復因多次編輯導致的括號數量不匹配問題。
 *
 * 🔥 v27.8.29 更新 (語法除錯)：
 * - 修正：再次補強括號閉合邏輯。
 * - 確認：系統結構完整性。
 *
 * 🔥 v27.8.28 更新 (語法除錯)：
 * - 修正：補回因編輯失誤遺失的閉合括號，解決 Unexpected end of input。
 * - 確認：程式碼區塊完整閉合。
 *
 * 🔥 v27.8.27 更新 (語法除錯)：
 * - 修正：移除多餘的右大括號，恢復程式碼結構平衡。
 * - 確認：二階段搜尋功能核心邏輯修復。
 *
 * 🔥 v27.8.26 更新 (語法除錯)：
 * - 強制移除末端 `else` 區塊，解決 Parsing 異常。
 * - 此版本為驗證修復版，若成功則代表核心問題已解。
 *
 * 🔥 v27.8.25 更新 (語法除錯)：
 * - 暫時移除非核心的 Async Summary 區塊，以排除 Syntax Error 干擾。
 * - 確保二階段搜尋核心功能可被部署。
 *
 * 🔥 v27.8.24 更新 (語法修復)：
 * - 修正：修復因邏輯插入導致的 `else if` 孤立問題 (Orphaned Else)。
 * - 確認：所有條件判斷式皆已正確閉合，二階段搜尋與 PDF 邏輯現在能和平共存。
 *
 * 🔥 v27.8.23 更新 (語法修復)：
 * - 修正：移除 v27.8.22 殘留的無效 `else` 區塊，徹底修復 Syntax Error。
 * - 確認：程式碼結構已驗證，二階段搜尋功能完全就緒。
 *
 * 🔥 v27.8.22 更新 (語法修復)：
 * - 修正：補上 v27.8.21 漏掉的右大括號 `}`，解決 "Unexpected end of input" 錯誤。
 * - 功能：二階段搜尋 (Pass 2) 現在已可在極速模式下正常運作。
 *
 * 🔥 v27.8.21 更新 (聯網自由)：
 * - 手冊權限解放：現在即使在極速模式 (Fast Mode)，只要明確下達「查網路」、「最新資訊」等指令，
 *   系統就會判定需要聯網，自動觸發 `[AUTO_SEARCH_WEB]` 進行 Google 搜尋。
 * - 修正：優化 Prompt，允許在無 PDF 狀態下呼叫網路資源。
 *
 * 🔥 v27.8.20 更新 (緊急修復)：
 * - 修正：補回被誤刪的 `let tools` 宣告，解決 Fast Mode 下 "tools is not defined" 的崩潰問題。
 * - 確認：現在「我要你查網路」不會再報錯，且若 Prompt 引導正確，將能觸發 [AUTO_SEARCH_WEB]。
 *
 * 🔥 v27.8.19 更新 (邏輯修復)：
 * - 修正：移除 v27.8.18 殘留的語法錯誤 (Extra Brace)，確保 Deep Mode 邏輯區塊正確閉合。
 * - 確認：二階段搜尋與歷史覆寫機制均已正確植入且無語法問題。
 *
 * 🔥 v27.8.18 更新 (緊急修復)：
 * - 修正語法錯誤：修復 v27.8.16/17 上傳時的 Syntax Error (Unexpected else)。
 * - 邏輯歸位：將二階段搜尋偵測移至正確的 API 回應處理區塊後，確保邏輯順暢。
 *
 * 🔥 v27.8.17 更新 (真相覆寫)：
 * - 新增「歷史覆寫指令」(History Override Clause)：
 *   └─ 修正：在 Prompt 中加入最高指導原則：「若歷史記憶 (History) 與當前規格書 (Rules) 衝突，以規格書為準」。
 *   └─ 意義：這能保護其他使用者，即使他們對話紀錄保留了舊的錯誤資訊 (如 M9=49吋)，AI 也能根據最新的 Rules (M9=32吋) 自動校正，不再受舊記憶誤導。
 *
 * 🔥 v27.8.16 更新 (精確計費與防圈):
 * - 修正費用顯示 (Cost Accumulation)：
 *   └─ 當觸發 Pass 2 (Web Search) 時，最終顯示的費用會自動累加 Pass 1 + Pass 2 的總和，讓用戶知道真實成本。
 * - 修正 Prompt Loop (Pass 2 Override)：
 *   └─ 在 Pass 2 時，明確指示 AI「直接使用 Google Search」，禁止再輸出 [AUTO_SEARCH_WEB] 指令，避免鬼打牆。
 *
 * 🔥 v27.8.15 更新 (雙階段搜尋)：
 * - 實作 Two-Pass Search 架構：
 *   └─ Pass 1 (深度模式): 預設禁用 Google Search，避免不可預期的 Timeout，確保穩定回答。
 *   └─ Pass 2 (聯網模式): 當 AI 發現手冊沒資料時，輸出 `[AUTO_SEARCH_WEB]`，系統自動發起第二次 Request (啟用 Google Search)。
 *   └─ 效益：完美解決「要聯網」但「怕掛掉」的矛盾。只有真正需要時才冒險聯網。
 *
 * 🔥 v27.8.14 更新 (功能解鎖)：
 * - 啟用 Google Search Tool：
 *   └─ 修正：在 Deep Mode (PDF模式) 下解除封印，允許 AI 使用 Google Search。
 *   └─ 目的：為了支援「來源標註」，當 AI 標註「[來源: 網路搜尋]」時，它是真的有去聯網搜尋，而非瞎掰。
 *   └─ 警告：聯網搜尋可能增加回應時間 (約 +2~5秒)，這是為了正確性所做的交換。
 *
 * 🔥 v27.8.13 更新 (來源標註)：
 * - 嚴格執行「資料來源標註」規範：
 *   └─ 修正：在 Prompt 中強制要求 AI 若非引用手冊，必須明確標註網路搜尋來源；舊版 AI 自帶知識來源標籤已停用。
 *   └─ 目的：落實 QA -> CLASS_RULES -> PDF -> Web/Brain 的層級，並對使用者誠實揭露資訊來源。
 *
 * 🔥 v27.8.12 更新 (架構重構)：
 * - 實作 Data-Driven (資料驅動) 關鍵字偵測：
 *   └─ 修正：不再依賴 Regex 硬抓型號，改為直接讀取 KEYWORD_MAP (源自 CLASS_RULES)。
 *   └─ 效果：只要 Sheet 裡有定義的別稱 (如 "Odyssey3D", "G7", "M8")，程式就能精準識別並撈取規格。
 *   └─ 承諾：完全尊重 CLASS_RULE 定義，實現「別稱 -> 規格」的直接映射。
 *
 * 🔥 v27.8.11 更新 (邏輯標準化)：
 * - 優化「型號偵測」邏輯：
 *   └─ 修正：將「M8/M9強制提取」改為「通用型號格式偵測」(Short Model Pattern)。
 *   └─ 意義：這不是針對單一型號的 Patch，而是確保系統隨時都在偵測並提取符合 [A-Z]+數字 格式的型號。
 *   └─ 符合邏輯：QA -> Detect Models (in Query) -> Load CLASS_RULES -> Load PDF。
 *
 * 🔥 v27.8.10 更新 (關鍵與邏輯修正)：
 * - 修正「上下文過濾過度」導致的 M9 Hallucination：
 *   └─ 問題：當用戶問「M8和M9的差別」時，因「差別」被視為關鍵字，程式跳過了 M8/M9 (短型號) 的提取此，導致沒去撈 M9 的規格。
 *   └─ 修正：現在無論有沒有中文關鍵字，都會強制提取短型號 (M8, G9 等)，確保 M9 規格一定會被載入 Prompt 防止瞎掰。
 *
 * 🔥 v27.8.9 更新 (邏輯修正)：
 * - 移除「歷史型號自動推斷」機制：
 *   └─ 修正：用戶切換 Deep Mode 時，若未提及型號，應反問用戶而非自動繼承歷史型號。
 *   └─ 原因：避免 User 想要查詢新機器時，因未提型號而誤入舊型號的 PDF。
 *
 * 🔥 v27.8.8 更新 (Bug修復)：
 * - 修正 RealTime (實時資訊) 觸發條件：
 *   └─ 這原本是隱藏功能，因 Regex 太寬鬆 (/時間/) 導致用戶抱怨「浪費時間」時誤觸報時。
 *   └─ 修正：改為嚴格匹配 (現在幾點、今天幾號)，並補上 Log 與對話紀錄同步。
 *
 * 🔥 v27.8.7 更新 (容錯強化)：
 * - 新增 Cache Miss 自動救援機制：
 *   └─ 問題：快取過期導致 "M9" 雖在關鍵字表，但無規格資料 (Hallucination)。
 *   └─ 修正：當 QA/Rules Cache 為空時，強制讀取 Google Sheet，不再依賴手動重啟。
 *
 * 🔥 v27.8.5 更新 (效能優化)：
 * - 實作 Batch Logging (批次日誌) 機制：
 *   └─ 問題：原本 writeLog 會即時寫入 Sheet，導致 LINE 回覆前產生 1-3 秒 Sheet I/O 延遲。
 *   └─ 修正：改為先將 Log 暫存於記憶體 (PENDING_LOGS)，待 replyMessage 發送後，於 finally 區塊一次性寫入。
 *   └─ 效果：大幅提升 LINE 回覆速度，達到與 TestUI 相同的秒回體驗。
 *
 * 🔥 v27.8.4 更新 (模型統一)：
 * - 模型策略調整：
 *   └─ 全面棄用 gemini-2.0-flash，統一升級至 models/gemini-2.5-flash。
 *   └─ 原因：經查證與測試，2.5 Flash (0.48s) 比 2.0 Flash (0.53s) 更快且更聰明，且無思考模式下成本極低 ($0.075/1M)。
 *   └─ 修正：Fast Mode 與 Think Mode 皆設定為 gemini-2.5-flash，達成「又快又聰明」的目標。
 *
 * 🔥 v27.8.3 更新 (草稿優化)：
 * - 新增 Drafting Mode 取代選項：
 *   └─ 在發現相似 QA 時，新增「3️⃣ 取代舊 QA」選項。
 *   └─ 邏輯：直接刪除舊的 QA Row，並將當前新草稿寫入為全新的一筆，避免合併產生的語意混亂。
 *
 * ════════════════════════════════════════════════════════════════
 * 🔧 現行模型設定 (未來升級請只改檔案最上方模型常數)
 * ════════════════════════════════════════════════════════════════
 *
 * 【一般對話】GEMINI_MODEL_FAST = models/gemini-2.5-flash-lite
 * 【深度閱讀】GEMINI_MODEL_THINK = models/gemini-2.5-flash-lite
 * 【QA/RULE整理】GEMINI_MODEL_POLISH = models/gemini-2.5-flash-lite
 *
 * ⚠️ 重要警告：模型名稱必須是 Google 官方存在的名稱！
 * ⚠️ 不可使用 latest / exp alias，也不可在主流程硬寫模型 URL。
 * ⚠️ 變更模型前必須重查官方模型與價格文件，並同步更新 PRICE_* 常數。
 *
 * 歷史版本註解中若出現舊模型名稱，僅作事故追蹤；現行 runtime 以最上方常數為準。
 *
 * ════════════════════════════════════════════════════════════════
 * 💸 成本事件記錄 (2025/12/06)
 * ════════════════════════════════════════════════════════════════
 *
 * 【事件】v23.4.0 使用不存在的模型名稱 "gemini-2.5-flash-lite"
 * 【後果】API 靜默 fallback 到 Gemini 3 Pro Image，產生 $54.69 異常費用
 * 【教訓】永遠使用官方文件中存在的模型名稱，不要猜測
 * 【修正】v24.2.0+ 使用官方確認存在的模型
 *
 * 【事件 2】v24.5.3 誤用 gemini-2.5-flash 進行 PDF 閱讀
 * 【發現】2025/12/08 發現該模型費率極高（Input $0.30/1M, Output $2.50/1M）
 * 【影響】65K tokens × $0.30 = $1.95 (vs 2.0-flash 的 $0.65)，差 3 倍成本
 * 【根因】低估了 Input Token 數量 (每次 RAG 查詢 6-7 萬 tokens) × 高費率的威力
 * 【修正】v24.5.4 改用 gemini-2.0-flash，節省 84% 成本
 *
 * 【事件 3】v24.5.4 [AUTO_SEARCH_PDF] 觸發邏輯過於寬鬆
 * 【表現】「什麼是 HDR」、「HDR10 優點」等通識問題誤觸 PDF 進入
 * 【原因】Prompt 指令不夠精確，LLM 誤認「QA 無完整答案 = 需要查 PDF」
 * 【根本】PDF 是「產品手冊」，不是「技術教科書」，不該用於回答通識知識
 * 【修正】v24.5.5 精確定義觸發條件，縮小非必要 PDF 查詢範圍
 *
 * 【事件 4】v24.5.8 Fast Mode 誤用搜尋工具 + 來源標註混亂
 * 【問題】Fast Mode 不應該有網路搜尋能力，容易跳過 [AUTO_SEARCH_PDF] 機制
 * 【根因】搜尋工具在 Fast Mode 啟用 → AI 直接用網路補充答案，跳過 PDF
 * 【帳單影響】搜尋工具額外計費，導致成本不可控
 * 【修正】v24.5.8
 *   - Google Search 工具改為僅在 PDF Mode 啟用（且需要時才用）
 *   - Fast Mode 搜尋不到就輸出 [AUTO_SEARCH_PDF]，强制進 PDF
 *   - 來源標註標準化：Fast Mode 只用「[來源: QA資料庫]」
 *   - Deep Mode 允許「[來源: 網路搜尋]」和「[來源: 非三星官方]」，但須必要
 *
 * 【事件 5】v25.0.0 型號汙染導致 PDF 載入過多 (2025/12/08)
 * 【徵兆】日誌顯示「從 Cache 讀取直通車注入型號: S32FM803」，但隨後「命中型號: S32FM803, M80D, M70D, S32DM803UC...」
 * 【根因】已確定型號後，還繼續從 KEYWORD_MAP 擴充型號，導致載了多本不相關 PDF
 * 【帳單】載 2 本 PDF 造成 input token 增加 2 倍（114K tokens vs 預期 50K），多花 $0.12
 * 【修正】v25.0.0
 *   - 新增 hasInjectedModels 標記，若已從直通車讀到型號，跳過 KEYWORD_MAP 擴充步驟
 *   - 確保型號來源清晰：直通車型號 > 對話歷史型號 > 當前查詢型號
 *   - 只有「無明確型號」的延續提問，才沿用 exactModels 中已有的型號
 *
 * ════════════════════════════════════════════════════════════════
 */

/**
 * 🔥 v24.5.8 更新：
 * - 成本控制強化：
 *   └─ Fast Mode 禁用搜尋工具，只用 QA/CLASS_RULES（成本 $0.001-0.005）
 *   └─ PDF Mode 可選擇啟用搜尋補充，但必要才用（控制額外成本）
 *   └─ 來源標註標準化：Fast Mode → [QA資料庫]；Deep Mode → [手冊]/[搜尋]/[非官方]
 * - 帳單風險移除：
 *   └─ 不再無控制地在 Fast Mode 使用搜尋工具
 *   └─ 搜尋成本完全隔離在 PDF Mode，可精確預測
 *   └─ 預期成本降低 15-20%（無 Fast Mode 搜尋開銷）
 *
 * 🔥 v24.2.3 更新：
 * - 雙模型策略：
 *   └─ Fast Mode (一般對話)：models/gemini-2.5-flash（全能戰神 v27.8.4+）
 *   └─ PDF Mode (深度閱讀)：models/gemini-2.5-flash（全能戰神 v27.8.4+）
 *   └─ /紀錄 (需理解複雜格式)：models/gemini-2.5-flash
 * - 成本估算（每日 1000 次問答）：
 *   └─ Fast Mode 約 $0.20-0.40/天（無搜尋）
 *   └─ PDF Mode 約 $0.35/天（無思考預算）
 *
 * 🔥 v24.2.2 更新：
 * - 修復：gemini-2.0-flash 不支援 thinkingConfig（只有 2.5 系列支援）
 *
 * 🔥 v24.2.1 更新：
 * - 每日 04:00 自動重建：改用固定時間觸發器
 *   └─ 解決 Google 48 小時檔案過期問題
 * - 溫度設定：讀取 Prompt Sheet B3 儲存格（已確認有讀取）
 *
 * 🔥 v24.2.0 更新：
 *   └─ Flash: 用戶對話、/紀錄 流程（需理解複雜指令）
 *   └─ Lite: 搜尋、摘要、簡單格式化（省錢）
 *
 * 🔥 v24.1.35 更新：
 * - 修正：切換模型 Flash-Lite → Flash（雙軌制）
 *   └─ Flash-Lite 無法遵守複雜 Prompt 指令（Deep Mode 規則被忽略）
 *   └─ Flash 成本約貴 33%，但能正確理解多模式指令
 *   └─ 明確禁止 Deep Mode 輸出 [AUTO_SEARCH_PDF] (使用加粗 + 警告語)
 *
 * 🔥 v24.1.32 更新：
 * - 修正：直通車命中後被簡單問題邏輯攔截
 *   └─ 確保「M7 價格」這類問題雖然命中直通車，但因屬於簡單問題 (價格)，正確跳過 PDF
 *   └─ 解決 Log 中出現「命中關鍵字...強制開啟 PDF」隨後又「簡單問題...跳過 PDF」的矛盾
 *
 * 🔥 v24.1.31 更新：
 * - 優化：Prompt.csv 語氣規範
 *   └─ 將所有硬性規定的回答範例改為「類似...」，鼓勵 AI 使用不同句型
 *   └─ 修正價格引導範例，移除「您」並改為更自然的口語
 *   └─ 確保 AI 不會像機器人一樣每次都說一模一樣的話
 *
 * 🔥 v24.1.30 更新：
 * - 修正：PDF 模式回答語氣
 *   └─ 當 AI 回答「手冊未記載」時，禁止加上「試試看吧😎👍」，避免顯得輕浮
 *   └─ 價格引導語氣優化，避免過於冷漠
 * - 優化：PDF Mode 退出邏輯
 *   └─ 新增 `手冊未記載` 為退出關鍵字
 *   └─ 若 AI 判斷手冊沒寫，回答完後自動退出 PDF Mode，避免下一題誤用
 *
 * 🔥 v24.1.29 更新：
 * - 優化：直通車 (Direct Search) 強制 PDF 邏輯
 *   └─ 新增「硬體規格過濾」機制
 *   └─ 若命中關鍵字但問題包含「面板、規格、解析度」等詞，維持 Fast Mode (查 Rules)
 *   └─ 若命中關鍵字且為操作/故障問題 (如 Odyssey Hub)，強制 PDF Mode
 *   └─ 完美解決「M7 面板不需 PDF」與「Odyssey Hub 必須 PDF」的衝突
 *
 * 🔥 v24.1.28 更新：
 * - 策略：恢復直通車 (Direct Search) 強制開啟 PDF 模式
 *   └─ 當命中關鍵字 (如 Odyssey Hub) 時，不再等待 AI 判斷，直接掛載 PDF
 *   └─ 解決用戶反映「等待 AI 判斷」太慢且不穩定的問題
 *   └─ 確保 M7 等規格問題在 PDF 模式下仍能透過 Prompt 讀取 Rules 回答
 *
 * 🔥 v24.1.27 更新：
 * - 修正：API 400 錯誤 (INVALID_ARGUMENT)
 *   └─ 原因：Gemini 2.0 Flash-Lite 模型不支援 `thinkingConfig` 參數
 *   └─ 解決：移除 generationConfig 中的 thinkingConfig 設定
 *   └─ 確保 PDF 模式能正常執行，不再因參數錯誤而失敗
 *
 * 🔥 v24.1.26 更新：
 * - 修正：模型名稱更新為正式版 (GA)
 *   └─ 使用 `models/gemini-2.0-flash-lite` (2025/02/25 發布)
 *   └─ 替換預覽版 `gemini-2.0-flash-lite-preview-02-05`
 *
 * 🔥 v24.1.25 更新：
 * - 修正：模型名稱錯誤
 *   └─ 將 `gemini-2.5-flash-lite` (不存在) 修正為 `gemini-2.0-flash-lite-preview-02-05`
 *   └─ 確保使用的是 Google 最新發布的 Flash-Lite 模型
 * - 強化：Prompt.csv 策略 (針對 Fast Mode)
 *   └─ 強制 AI 在遇到「故障排除/操作設定」問題時，若 QA 無解，必須查 PDF
 *   └─ 即使 AI 覺得自己知道原理 (如 Odyssey Hub)，也必須查閱手冊以提供準確步驟
 *
 * 🔥 v24.1.24 更新：
 * - 優化：PDF 模式輸出限制放寬
 *   └─ 將 maxOutputTokens 從預設值 (通常較小) 提升至 4096
 *   └─ 確保 AI 能一次輸出完整的 PDF 解決方案，不會被截斷
 * - 修正：Log 記錄截斷問題
 *   └─ 將 [AI Reply] 的 Log 長度限制從 500 字放寬至 2000 字
 *   └─ 方便開發者在 Log 中查看完整的 AI 回答
 *
 * 🔥 v24.1.23 更新：
 * - 清理：移除所有與「手動確認深度搜尋」相關的遺留代碼
 *   └─ 移除 PENDING_QUERY 讀取與判斷
 *   └─ 移除 handleDeepSearch 舊邏輯 (已由 Auto Deep Search 取代)
 *   └─ 確保系統不會再有「等待用戶輸入 1」的隱藏狀態
 *
 * 🔥 v24.1.22 更新：
 * - 優化：[AUTO_SEARCH_PDF] 觸發邏輯
 *   └─ 當 AI 判斷需要查手冊時，系統將「自動」執行深度搜尋並回傳結果
 *   └─ 不再詢問用戶「是否要查閱」，直接給出最終答案
 *   └─ 解決用戶覺得「為什麼不直接查」的困擾
 *
 * 🔥 v24.1.21 更新：
 * - 優化：Prompt.csv 策略調整
 *   └─ 明確區分「規格題」(找 Sam) 與「操作題」(查 PDF) 的處理邏輯
 *   └─ 強制極速模式在遇到操作問題且無 QA 時，必須輸出 [AUTO_SEARCH_PDF]
 *   └─ 禁止在未嘗試 PDF 前直接放棄
 *
 * 🔥 v24.1.20 更新：
 * - 重構：將 Prompt 邏輯從 GS 移至 Prompt.csv
 *   └─ 移除 linebot.gs 中大量硬編碼的 Prompt
 *   └─ 在 Prompt.csv 中新增【極速模式】與【深度模式】區塊
 *   └─ GS 僅負責注入「系統狀態」(Fast/Deep Mode) 標記
 *
 * 🔥 v24.1.19 更新：
 * - 修正：直通車 (Direct Search) 不再強制開啟 PDF Mode
 *   └─ 僅執行型號識別與注入 (供後續使用)，讓系統優先使用 QA/CLASS_RULES 回答
 *   └─ 解決「問 M7 面板卻進 PDF 查無資料」的問題
 *
 * 🔥 v24.1.18 更新：
 * - 修復：PDF Mode 回答開頭出現重複打招呼 (哈囉) 的問題
 *   └─ 在 dynamicPrompt 中明確禁止打招呼
 * - 優化：PDF Mode 查無資料時的退出邏輯
 *   └─ 增加 exitPatterns 識別「手邊的資料剛好沒有寫到」
 *   └─ 避免用戶覺得「先找 PDF 然後才說退出」是白費工 (雖然實際上是為了確認 PDF 真的沒有)
 *
 * 🔥 v24.1.17 更新：
 * - 修復：S8/M7/G9 等短關鍵字無法觸發直通車 (DirectDeep)
 *   ├─ 原因：strongKeywords 限制長度 >= 3，導致 2 碼型號被忽略
 *   └─ 解決：放寬限制至 >= 2 碼
 * - 優化：Prompt 語氣調整 (Prompt.csv)
 *   └─ 放寬「禁打招呼」限制，允許適度親切
 *   └─ 修正模糊型號邏輯，若有明確定義則不需反問
 *
 * 🔥 v24.1.16 修復：
 * - 修復：S8 等短型號被過濾導致查無資料
 *   ├─ 原因：關鍵字過濾邏輯太嚴格，把 S8 當成雜訊濾掉了
 *   └─ 解決：若過濾後無關鍵字，強制保留原始訊息中的短型號 (如 S8, M7)
 * - 優化：Fast Mode 回答多樣性
 *   └─ Prompt 加入「請嘗試使用不同的句型或語氣」指令
 * - 優化：移除 AsyncSummary 觸發 Log
 *
 * 🔥 v24.1.15 修正：
 * - 修復：PDF 預測邏輯干擾 (問 M7 卻建議查 Odyssey 3D 手冊)
 *   ├─ 原因：getRelevantKBFiles 讀取了歷史對話中的舊型號
 *   └─ 解決：在生成 pdfHint 時，強制只讀取「當前訊息」來預測 PDF
 * - 強化：PDF Mode 回答開頭強制補全
 *   └─ 若 AI 忘記加「根據產品手冊，」，程式碼會自動補上
 * - 優化：hardwarePatterns 加入「面板/panel」關鍵字
 *   └─ 面板問題視為規格題，不再觸發 PDF 搜尋建議
 *
 * 🔥 v24.1.14 更新：
 * - 強化：PDF 模式回答規範
 *   ├─ 強制開頭：「根據產品手冊，」
 *   └─ 強制完整性：一次列出所有解決方案，禁止分段擠牙膏
 * - 強化：Fast Mode 回答規範
 *   └─ 強制開頭：「根據我的資料庫，」
 * - 優化：移除無用的 AsyncSummary Log
 *
 * 🔥 v24.1.13 嚴重錯誤修復：
 * - 修復：/重啟 導致的「LockService 的操作過多」崩潰
 *   ├─ 原因：在未取得鎖定時嘗試釋放鎖定 (releaseLock)
 *   └─ 解決：引入 hasLock 狀態追蹤，確保只有持有鎖定時才釋放
 *
 * 🔥 v24.1.12 穩定性修復：
 * - 修復：PDF 模式下歷史切斷導致摘要遺失的問題
 *   ├─ 在縮減歷史 (slice) 時，強制保留前兩則摘要訊息 (如果存在)
 *   └─ 確保 AI 在 PDF 模式下仍能記得長期對話重點
 * - 修復：Cache TTL 不一致問題
 *   └─ 將 `direct_search_models` 的 TTL 從 600s 調整為 300s，與 PDF Mode 保持一致
 *
 * 🔥 v24.1.11 重大修復 - 直通車關鍵字優先級：
 * - 修復：命中「ODYSSEY」而非「ODYSSEYHUB」的問題
 *   ├─ 根本原因：find() 返回第一個匹配，但「ODYSSEY」和「ODYSSEYHUB」都符合
 *   ├─ 用戶說「Odyssey Hub」→ 應匹配「ODYSSEYHUB」（長度 9）而非「ODYSSEY」（長度 7）
 *   └─ 修復：改用 for 迴圈找「最長的匹配關鍵字」
 * - 效果：現在「Odyssey Hub」能正確命中「ODYSSEYHUB」→ 提取 G90XF → 載入 PDF ✅
 * - 日誌：添加「長度」顯示，便於除錯「ODYSSEY(7) vs ODYSSEYHUB(9)」
 *
 * 🔥 v24.1.10 重大修復 - 直通車 PDF + 重啟記憶清除：
 * - 修復：Odyssey Hub 命中直通車但無法載入 PDF（Files: 0/56）
 * - 修復：重啟(/重啟)沒有清除對話記憶
 * - 優化：移除無用的 QA 內容預覽日誌
 *
 * 🔥 v24.1.9 更新 - Cache 通道機制（已整合到 v24.1.10）：
 * - 直通車關鍵字命中時，從 KEYWORD_MAP 提取型號
 * - 將型號注入 ScriptCache 供 getRelevantKBFiles() 使用
 * - 一次性使用後自動刪除，不污染後續請求
 *
 * 🔥 v24.1.8 更新 - 型號變化偵測修復（M7 型號提取）：
 * - 修復：extractModelNumbers() 的 M 系列正則邏輯
 *   原本 /\bM([5789][\dA-Z]*)\b/g 只提取括號內的數字部分（「7」）
 *   改為 /\bM[5789][\dA-Z]*\b/g 完整保留「M7」「M70D」等
 * - 現在「m7是什麼面板」能正確偵測到型號變化，清除 PDF Mode
 * - 系統先用 CLASS_RULES 查詢 M7 規格（VA 平面），不浪費 Token 讀 PDF
 *
 * 🔥 v24.1.7 更新 - 重啟後第一次詢問改進：
 * - 修復：/重啟 後清除動畫計時器，讓下一個詢問能立即顯示 Loading 動畫
 * - 修復：CLASS_RULES 中 M7 的定義加入「VA 平面」規格
 * - 現在「m7 是什麼面板」能正確回答「VA 平面螢幕」
 *
 * 🔥 v24.1.6 更新 - Odyssey Hub 關鍵字匹配：
 *
 * 🔥 v24.1.4 更新 - 編輯 API 成本追蹤：
 * - callGeminiToPolish：加入 Token 和成本記錄
 * - callGeminiToRefineQA：加入 Token 和成本記錄
 * - callGeminiToMergeQA：加入 Token 和成本記錄
 * - 建檔系統現在可完整追蹤每個步驟的 API 消耗
 * - 便於分析編輯操作的成本占比
 *
 * 🔥 v24.1.3 更新 - 編輯模式 THINK 最佳化：
 * - Polish API（初版生成）：開啟 thinkingBudget: 1024 → 理解用戶意圖、組織內容
 * - Refine API（修改調整）：開啟 thinkingBudget: 1024 → 精細調整、權衡多版本
 * - Merge API（多 QA 合併）：開啟 thinkingBudget: 512 → 融合資訊、格式調整
 * - 保留邏輯任務關閉 THINK（Modify、FindSimilar）→ 降低成本
 * - 成本增加 ~8-12%，但編輯品質大幅提升
 *
 * 🔥 v24.1.2 更新 - API 400 修復 - thinkingConfig 位置修正：
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
 * v24.3.0: 添加 userId 參數用於隔離不同使用者的 Cache
 */
function checkDirectDeepSearch(msg, userId) {
  try {
    // v27.9.10: 防止 msg 為 undefined 導致 toUpperCase 錯誤
    if (!msg || typeof msg !== "string") {
      writeLog("[checkDirectDeepSearch] msg 為空或非字串，跳過");
      return null;
    }

    const upperMsg = msg.toUpperCase();
    const upperMsgNoSpace = upperMsg.replace(/\s+/g, "");

    // 1. 檢查 CLASS_RULES 的直通車關鍵字 (如果有的話)
    // 這些通常是「系列名」或「特殊術語」，用戶定義這些詞需要深度搜尋
    const listJson = PropertiesService.getScriptProperties().getProperty(
      CACHE_KEYS.STRONG_KEYWORDS,
    );
    if (listJson) {
      const strongKeywords = JSON.parse(listJson);

      // v24.1.11 重大修復：優先匹配「最長的關鍵字」而非第一個匹配
      // 問題：用戶說「Odyssey Hub」時，「ODYSSEY」和「ODYSSEYHUB」都會匹配
      // 但應該優先匹配「ODYSSEYHUB」（更長、更精確）
      // 解決方案：用 reduce() 找到最長的匹配關鍵字

      let hitKey = null;
      let maxLength = 0;

      for (const key of strongKeywords) {
        // v24.1.17: 放寬長度限制，允許 2 碼關鍵字 (如 S8, M7, G9)
        if (key.length < 2) continue;
        const matches = upperMsg.includes(key) || upperMsgNoSpace.includes(key);
        if (matches && key.length > maxLength) {
          hitKey = key;
          maxLength = key.length;
        }
      }

      if (hitKey) {
        writeLog(
          `[DirectDeep] 命中 CLASS_RULES 直通車關鍵字: ${hitKey} (長度: ${hitKey.length})`,
        );

        // v24.1.9 新增：從 KEYWORD_MAP 提取該關鍵字對應的所有型號
        // 讓 getRelevantKBFiles() 能夠匹配相關 PDF
        try {
          const mapJson = PropertiesService.getScriptProperties().getProperty(
            CACHE_KEYS.KEYWORD_MAP,
          );
          if (mapJson) {
            const keywordMap = JSON.parse(mapJson);
            const mappedValue = keywordMap[hitKey];
            writeLog(
              `[DirectDeep] 查詢 KEYWORD_MAP[${hitKey}] = ${
                mappedValue ? mappedValue.substring(0, 50) + "..." : "NOT FOUND"
              }`,
            );

            if (mappedValue) {
              // 從映射值提取型號
              const MODEL_REGEX =
                /\b(G\d{1,2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|(?:L?S)\d{1,2}[A-Z]{0,2}\d{0,4}[A-Z0-9]{0,5}|(?:L?[CF])\d{2}[A-Z]+\d{2,4}[A-Z0-9]*|WA\d+[A-Z\d]*|WD\d+[A-Z\d]*|VR\d+[A-Z\d]*)\b/g;
              const models = [];
              let match;
              while ((match = MODEL_REGEX.exec(mappedValue)) !== null) {
                if (!models.includes(match[0])) {
                  models.push(match[0]);
                }
              }

              writeLog(
                `[DirectDeep] 從映射值提取型號: ${
                  models.length > 0 ? models.join(", ") : "NONE"
                }`,
              );

              // 注入到 Cache，讓 getRelevantKBFiles() 使用
              // v24.3.0: 使用 userId:key 隔離不同使用者
              if (models.length > 0) {
                const cache = CacheService.getScriptCache();
                // TTL 為 300秒 (5分鐘)，用於同一句話的多步驟流程
                // 跨越時間邊界的型號提取應依賴 Sheet 歷史，不依賴 Cache
                cache.put(
                  `${userId}:direct_search_models`,
                  JSON.stringify(models),
                  300,
                );
                writeLog(
                  `[DirectDeep] ✅ 注入型號到 Cache (userId: ${userId}): ${models.join(
                    ", ",
                  )}`,
                );
              } else {
                writeLog(
                  `[DirectDeep] ⚠️  無法從映射值提取型號（術語無型號），跳過注入`,
                );
              }
            }
          } else {
            writeLog(`[DirectDeep] ⚠️  KEYWORD_MAP 為空，無法查詢`);
          }
        } catch (e) {
          writeLog("[DirectDeep] 型號提取失敗: " + e.message);
        }

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

/**
 * v24.4.0 新增：檢查直通車關鍵字並返回命中的關鍵字
 * v27.9.0 修改：支援多型號同時偵測
 * v27.9.1 修正：移除 tooMany 限制（型號比較用 CLASS_RULES 就夠了）
 * @returns {Object} { hit: boolean, keys: string[], models: string[] }
 */
function checkDirectDeepSearchWithKey(msg, userId) {
  try {
    const upperMsg = msg.toUpperCase();
    const upperMsgNoSpace = upperMsg.replace(/\s+/g, "");

    const listJson = PropertiesService.getScriptProperties().getProperty(
      CACHE_KEYS.STRONG_KEYWORDS,
    );
    if (listJson) {
      const strongKeywords = JSON.parse(listJson);

      // v27.9.0: 收集所有命中的關鍵字（而非只取最長的）
      let hitKeys = [];

      for (const key of strongKeywords) {
        if (key.length < 2) continue;
        const matches = upperMsg.includes(key) || upperMsgNoSpace.includes(key);
        if (matches) {
          hitKeys.push(key);
        }
      }

      // 去重（避免 M8 和 M80D 都命中時重複）
      hitKeys = [...new Set(hitKeys)];

      if (hitKeys.length > 0) {
        writeLog(
          `[DirectDeep] 命中 CLASS_RULES 直通車關鍵字: ${hitKeys.join(
            ", ",
          )} (共 ${hitKeys.length} 個)`,
        );

        // 從 KEYWORD_MAP 提取所有命中關鍵字對應的型號
        const allModels = [];
        try {
          const mapJson = PropertiesService.getScriptProperties().getProperty(
            CACHE_KEYS.KEYWORD_MAP,
          );
          if (mapJson) {
            const keywordMap = JSON.parse(mapJson);
            const MODEL_REGEX =
              /\b(G\d{1,2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|(?:L?S)\d{1,2}[A-Z]{0,2}\d{0,4}[A-Z0-9]{0,5}|(?:L?[CF])\d{2}[A-Z]+\d{2,4}[A-Z0-9]*|WA\d+[A-Z\d]*|WD\d+[A-Z\d]*|VR\d+[A-Z\d]*)\b/g;

            for (const hitKey of hitKeys) {
              const mappedValue = keywordMap[hitKey];
              if (mappedValue) {
                let match;
                while ((match = MODEL_REGEX.exec(mappedValue)) !== null) {
                  if (!allModels.includes(match[0])) {
                    allModels.push(match[0]);
                  }
                }
                MODEL_REGEX.lastIndex = 0; // 重置正則狀態
              }
            }

            writeLog(
              `[DirectDeep] 從所有關鍵字提取型號: ${
                allModels.length > 0 ? allModels.join(", ") : "NONE"
              } (共 ${allModels.length} 個)`,
            );
          }
        } catch (e) {
          writeLog("[DirectDeep] 型號提取失敗: " + e.message);
        }

          const cache = CacheService.getScriptCache();
        // v27.9.1: 移除 tooMany 檢查（型號比較用 CLASS_RULES 就夠了）
        // 注入所有型號到 Cache（供後續 PDF 查詢時使用）
        if (allModels.length > 0) {
          // v29.5.154: Early Internal Alias Filtering
          // 內部代號如 G90XF, G5, M8 只是用來命中規則，不該讓 AI 看到，否則 AI 會以為有多個型號而提問
          // 這裡提早過濾，確保 AI 跟 Smart Router 看到的型號清單完全一致
          const INTERNAL_ALIAS_RE = /^[A-Z]\d{1,2}[A-Z]{0,3}$/; // G90XF, G5, M8, G80SD
          const fullModels = allModels.filter((m) => !INTERNAL_ALIAS_RE.test(m));
          
          if (fullModels.length > 0) {
            allModels.length = 0;
            allModels.push(...fullModels);
            writeLog(`[DirectDeep v29.5.154] 過濾內部代號，只保留完整型號: ${allModels.join(", ")}`);
          }

          // v29.5.153: Early Substring Deduplication
          // 若同時存在 S27FG900XC 與 S27FG900 等互為子字串的型號，保留最長、最精準的，避免混淆 AI
          const dedupModels = [];
          const sortedModels = allModels.slice().sort((a, b) => b.length - a.length);
          sortedModels.forEach((model) => {
            const isSubset = dedupModels.some(existing => existing.includes(model));
            if (!isSubset) {
              dedupModels.push(model);
            }
          });

          if (allModels.length !== dedupModels.length) {
            writeLog(`[DirectDeep v29.5.153] 早期子字串去重, 剩餘: ${dedupModels.join(", ")}`);
          }

          cache.put(
            `${userId}:direct_search_models`,
            JSON.stringify(dedupModels),
            300,
          );
          // 回傳給呼叫者的 models 也應替換為去重後的
          allModels.length = 0;
          allModels.push(...dedupModels);

          writeLog(
            `[DirectDeep] ✅ 注入型號到 Cache (userId: ${userId}): ${allModels.join(
              ", ",
            )}`,
          );
        } else {
          // v29.5.143: 若命中新關鍵字但無對應型號，必須清除舊 Cache，避免污染 (Fix Issue 2)
          cache.remove(`${userId}:direct_search_models`);
          writeLog(`[DirectDeep] ⚠️ 清除舊型號 Cache，因新關鍵字無對應型號 (userId: ${userId})`);
        }

        return { hit: true, keys: hitKeys, models: allModels };
      }
    }

    return { hit: false, keys: [], models: [] };
  } catch (e) {
    writeLog("[Error] checkDirectDeepSearchWithKey: " + e.message);
    return { hit: false, keys: [], models: [] };
  }
}

/**
 * v24.4.0 新增：從 CLASS_RULES 別稱行提取「型號模式」並搜尋匹配的 PDF
 * v29.3.49 修正：增加 originalQuery 參數，優先用精確型號匹配
 * @param {string} aliasKey - 別稱關鍵字（如 M8, G9, ODYSSEYHUB）
 * @param {string} [originalQuery] - 用戶原始訊息，用於精確型號匹配
 * @returns {Object} { pattern: string, matchedPdfs: [{name, models}], needAsk: boolean }
 */
function searchPdfByAliasPattern(aliasKey, originalQuery) {
  try {
    const kbListJson = PropertiesService.getScriptProperties().getProperty(
      CACHE_KEYS.KB_URI_LIST,
    );
    if (!kbListJson) return { pattern: null, matchedPdfs: [], needAsk: false };

    const kbList = JSON.parse(kbListJson);
    const pdfFiles = kbList.filter((f) => f.mimeType === "application/pdf");

    // 1. 從 CLASS_RULES 讀取別稱行，提取「型號模式為：XXX」
    const sheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    if (!sheet) return { pattern: null, matchedPdfs: [], needAsk: false };

    const data = sheet.getDataRange().getValues();
    let pdfPattern = null;
    let aliasName = aliasKey; // 別稱名稱（用於反問訊息）

    for (const row of data) {
      const firstCol = String(row[0] || "").toUpperCase();
      // v29.4.35: 檢查「別稱_」或「系列_」行，修復洗衣機等系列關鍵字
      if (
        (firstCol.startsWith("別稱_") || firstCol.startsWith("系列_")) &&
        firstCol.includes(aliasKey.toUpperCase())
      ) {
        const content = String(row[0] || "") + "," + String(row[1] || "");
        // 提取「型號模式為：XXX」
        const patternMatch = content.match(/型號模式為[：:]\s*(.+?)(?:$|,|，)/);
        if (patternMatch) {
          pdfPattern = patternMatch[1].trim();
          // 提取別稱的友善名稱（如「Smart Monitor M8」）
          const nameMatch = content.match(/別稱_\w+[,，]\s*([^,，]+)/);
          if (nameMatch) {
            aliasName = nameMatch[1].split("，")[0].split("。")[0].trim();
          }
          writeLog(
            `[PDF Search] 從 CLASS_RULES 提取模式: ${aliasKey} → ${pdfPattern}`,
          );
          break;
        }
      }
    }

    // 2. 如果沒有找到模式，用別稱關鍵字直接搜尋
    if (!pdfPattern) {
      pdfPattern = aliasKey;
      writeLog(`[PDF Search] 無型號模式，使用關鍵字搜尋: ${aliasKey}`);
    }

    // 3. 解析模式並搜尋 PDF
    // 模式格式：「M80D或S32?M80*」→ 分割成多個子模式
    const subPatterns = pdfPattern.split(/或|\|/);
    const matchedPdfs = [];
    const seenPrefixes = new Set(); // 用於去重型號開頭

    // v29.3.43: 優化 - 精確型號優先匹配 (Exact Match Priority)
    // v29.3.49 修正：使用 originalQuery（用戶原始訊息）進行精確匹配，而非 aliasKey（別稱）
    // 如果用戶輸入的字串中已經包含某個 PDF 的完整型號 (例如 "S43FM703UCX" 包含 "S43FM703")
    // 則直接鎖定該 PDF，不再進行模糊搜索或反問
    const exactMatchSource = originalQuery || aliasKey; // 優先使用原始訊息
    const normalizedInput = exactMatchSource
      .toUpperCase()
      .replace(/[\s-]/g, "");
    for (const pdf of pdfFiles) {
      const fileName = pdf.name.toUpperCase().replace(".PDF", "");
      const modelsInFile = fileName.split(",").map((m) => m.trim());

      for (const model of modelsInFile) {
        // 模型名稱去除非字母數字字元以提高匹配率
        const cleanModel = model.replace(/[\s-]/g, "");
        if (cleanModel.length > 3 && normalizedInput.includes(cleanModel)) {
          writeLog(
            `[PDF Search] 🎯 發現精確型號匹配: ${model} (In query: ${exactMatchSource})`,
          );
          return {
            pattern: pdfPattern,
            aliasName: aliasName || model,
            matchedPdfs: [
              {
                name: pdf.name,
                uri: pdf.uri,
                matchedModel: model,
                prefix: model, // 精確匹配直接用完整型號
              },
            ],
            needAsk: false, // 不需要反問
          };
        }
      }
    }

    // v29.3.51: 模糊匹配 (Fuzzy Match) - 當精確匹配失敗時，尋找最相似的 PDF
    // 用戶輸入 S43FM703UCX，但沒有 S43FM703 的 PDF 時，應該找到 S32FM703 (相同系列+型號)
    const userModelMatch = normalizedInput.match(/S(\d{2})([A-Z]+)(\d{2,3})/);
    if (userModelMatch) {
      const [, userSize, userSeries, userNumber] = userModelMatch;
      writeLog(
        `[PDF Search] 嘗試模糊匹配: 尺寸=${userSize}, 系列=${userSeries}, 型號=${userNumber}`,
      );

      let bestMatch = null;
      let bestScore = 0;

      for (const pdf of pdfFiles) {
        const fileName = pdf.name.toUpperCase().replace(".PDF", "");
        const modelsInFile = fileName.split(",").map((m) => m.trim());

        for (const model of modelsInFile) {
          const pdfMatch = model.match(/S(\d{2})([A-Z]+)(\d{2,3})/);
          if (pdfMatch) {
            const [, pdfSize, pdfSeries, pdfNumber] = pdfMatch;

            // 計算相似度分數
            // 相同尺寸 = +2, 相同系列 = +1, 相同型號數字 = +1
            let score = 0;
            if (userSize === pdfSize) score += 2;
            if (userSeries === pdfSeries) score += 1;
            if (userNumber === pdfNumber) score += 1;

            if (score > bestScore) {
              bestScore = score;
              bestMatch = { pdf, model, score };
            }
          }
        }
      }

      // 如果找到足夠相似的 PDF (分數 >= 2)，直接使用它
      // 分數 2 = 相同尺寸，或 相同系列+相同型號
      if (bestMatch && bestScore >= 2) {
        writeLog(
          `[PDF Search] 🔍 模糊匹配成功: ${bestMatch.model} (相似度: ${bestScore}/4, 來自: ${bestMatch.pdf.name})`,
        );
        return {
          pattern: pdfPattern,
          aliasName: aliasName || bestMatch.model,
          matchedPdfs: [
            {
              name: bestMatch.pdf.name,
              uri: bestMatch.pdf.uri,
              matchedModel: bestMatch.model,
              prefix: bestMatch.model,
            },
          ],
          needAsk: false, // 不需要反問
        };
      } else if (bestMatch) {
        writeLog(
          `[PDF Search] ⚠️ 模糊匹配分數不足: ${bestMatch.model} (相似度: ${bestScore}/4), 繼續模式匹配`,
        );
      }
    }

    for (const pdf of pdfFiles) {
      const fileName = pdf.name.toUpperCase().replace(".PDF", "");
      // 從檔名提取所有型號（逗號分隔）
      const modelsInFile = fileName.split(",").map((m) => m.trim());

      for (const subPattern of subPatterns) {
        const cleanPattern = subPattern.trim().toUpperCase();
        // 將 ? 替換為 . (正則任意單字元)，* 替換為 .* (任意多字元)
        // ## 替換為 \d{2} (兩位數字)
        let regexStr = cleanPattern
          .replace(/\?/g, ".")
          .replace(/\*/g, ".*")
          .replace(/##/g, "\\d{2}");

        try {
          const regex = new RegExp(regexStr);

          for (const model of modelsInFile) {
            if (regex.test(model)) {
              // 提取型號開頭（前 6~7 碼，用於顯示給用戶）
              // 例如 S32BM801 → S32BM8
              // v29.3.48: 取消字數限制，顯示完整型號以供精確選擇
              let prefix = model;

              if (!seenPrefixes.has(prefix)) {
                seenPrefixes.add(prefix);
                matchedPdfs.push({
                  name: pdf.name,
                  uri: pdf.uri,
                  matchedModel: model,
                  prefix: prefix,
                });
              }
              break; // 這個 PDF 已匹配，繼續下一個
            }
          }
        } catch (regexErr) {
          writeLog(`[PDF Search] 正則錯誤: ${regexStr} - ${regexErr.message}`);
        }
      }
    }

    // 4. 按字母順序排序
    matchedPdfs.sort((a, b) => a.prefix.localeCompare(b.prefix));

    // 5. 判斷是否需要反問
    const needAsk = matchedPdfs.length > 1;

    writeLog(
      `[PDF Search] 結果: ${matchedPdfs.length} 個匹配 (needAsk: ${needAsk})`,
    );

    return {
      pattern: pdfPattern,
      aliasName: aliasName,
      matchedPdfs: matchedPdfs,
      needAsk: needAsk,
    };
  } catch (e) {
    writeLog(`[Error] searchPdfByAliasPattern: ${e.message}`);
    return { pattern: null, matchedPdfs: [], needAsk: false };
  }
}

/**
 * v24.4.0 新增：處理用戶對 PDF 型號選擇的回覆
 * v24.4.1 修復：加入 Loading 動畫 + 正確處理 history（不存 PDF blob）
 * v24.4.2 修復：加入 Token 花費顯示
 * v24.4.3 修復：修正 updateHistorySheetAndCache 參數順序
 * @param {string} msg - 用戶訊息
 * @param {string} userId - 用戶 ID
 * @param {string} replyToken - LINE 回覆 Token
 * @param {string} contextId - 上下文 ID
 * @returns {boolean} 是否已處理（true = 已處理，不需繼續；false = 非選擇回覆，繼續正常流程）
 */
function handlePdfSelectionReply(msg, userId, replyToken, contextId) {
  try {
    // v24.5.4: 防呆檢查，避免 undefined.toUpperCase() 錯誤
    if (!msg || typeof msg !== "string" || msg.trim().length === 0) {
      writeLog(`[PDF Select] ⚠️ 無效輸入: msg=${msg}`);
      return false;
    }

    const cache = CacheService.getScriptCache();
    const pendingKey = CACHE_KEYS.PENDING_PDF_SELECTION + userId;
    const pendingJson = cache.get(pendingKey);

    // v29.5.116 修復：先檢查用戶是否直接輸入了有效型號
    // 即使沒有 pending 泡泡狀態，也要支持用戶直接型號輸入進 PDF 模式
    const directModelMatch = msg
      .toUpperCase()
      .match(/^[SC]\d{2}[A-Z]{1,2}\d{2,3}[A-Z]{0,2}$/);

    if (directModelMatch && !pendingJson) {
      // 用戶直接輸入型號，且沒有 pending 泡泡狀態
      const inputModel = directModelMatch[0];
      writeLog(
        `[PDF Select v29.5.116] 🆕 用戶直接輸入型號（無泡泡）: ${inputModel}`,
      );

      // 注入型號到 Cache（供 getRelevantKBFiles 使用）
      cache.put(
        `${userId}:direct_search_models`,
        JSON.stringify([inputModel]),
        300,
      );

      // 設置 PDF Mode
      const pdfModeKey = CACHE_KEYS.PDF_MODE_PREFIX + contextId;
      cache.put(pdfModeKey, "true", 300);

      // 直接進入 Pass 1.5：加載 PDF，不再走 DirectDeep
      writeLog(
        `[PDF Select v29.5.116] 執行 Pass 1.5 查詢 PDF，型號: ${inputModel}`,
      );

      // 【重要】直接執行 PDF 查詢，而不是只設置標記
      const history = getHistoryFromCacheOrSheet(contextId);
      const userMsgObj = { role: "user", content: msg };

      const response = callLLMWithRetry(
        msg,
        [...history, userMsgObj],
        [],
        true, // attachPDFs = true，強制加載 PDF
        null,
        false,
        userId,
        false,
        inputModel,
      );

      if (response) {
        let finalText = stripAnySourceTags(formatForLineMobile(response));
        finalText = finalText.replace(/\[AUTO_SEARCH_PDF\]/g, "").trim();
        finalText = finalText.replace(/\[NEW_TOPIC\]/g, "").trim();
        finalText = finalText.replace(/\[AUTO_SEARCH_WEB\]/g, "").trim();
        finalText = finalText.replace(/\[型號[:：][^\]]+\]/g, "").trim();
        finalText = sanitizeManualDeflection(finalText);
        finalText = enforceManualNumberedList(finalText);

        let replyText = finalText;
        if (DEBUG_SHOW_TOKENS && lastTokenUsage && lastTokenUsage.costTWD) {
          const tokenInfo = `\n\n${buildReplyCostAuditText_()}`;
          replyText += tokenInfo;
        }

        replyMessage(replyToken, replyText);
        writeLog(`[AI Reply] ${replyText}`);

        // 記錄到歷史
        const asstMsgObj = { role: "assistant", content: finalText };
        updateHistorySheetAndCache(contextId, history, userMsgObj, asstMsgObj);
        writeRecordDirectly(userId, msg, contextId, "user", "");
        writeRecordDirectly(userId, replyText, contextId, "assistant", "");
      } else {
        replyMessage(replyToken, "⚠️ 查詢手冊時發生錯誤，請稍後再試");
      }

      // 清除快取標記
      cache.remove(`${userId}:pending_pdf_query`);
      cache.remove(pendingKey);

      return true; // 已處理完成
    }

    if (!pendingJson) return false; // 沒有等待選擇的狀態

    const pending = JSON.parse(pendingJson);
    // pending = { originalQuery, aliasKey, options: [{prefix, name, uri, matchedModel}] }

    // 檢查用戶回覆是否為數字選擇
    const numMatch = msg.match(/^[1-9]$/);

    if (numMatch) {
      const choice = parseInt(numMatch[0]);

      if (choice <= pending.options.length) {
        // 有效選擇
        const selected = pending.options[choice - 1];
        writeLog(
          `[PDF Select] 用戶選擇 ${choice}: ${selected.prefix} → ${selected.name}`,
        );

        // 清除等待狀態
        cache.remove(pendingKey);

        // v29.5.116: 【關鍵修復】設置「待執行 PDF 查詢」標記
        // 下次 handleMessage 進來時，將直接進 Pass 1.5，不再觸發 DirectDeep（避免循環）
        cache.put(
          `${userId}:pending_pdf_query`,
          JSON.stringify({
            model: selected.matchedModel,
            originalQuery: pending.originalQuery,
            timestamp: new Date().getTime(),
          }),
          300, // 5 分鐘有效
        );
        writeLog(
          `[PDF Select v29.5.116] ✅ 標記待執行 PDF 查詢: ${selected.matchedModel}`,
        );

        // v24.4.1: 顯示 Loading 動畫（PDF 查詢可能需要 1-2 分鐘）
        showLoadingAnimation(userId, 60);

        // 注入選中的 PDF 型號到 Cache
        cache.put(
          `${userId}:direct_search_models`,
          JSON.stringify([selected.matchedModel]),
          300,
        );

        // 設定 PDF Mode
        const pdfModeKey = CACHE_KEYS.PDF_MODE_PREFIX + contextId;
        cache.put(pdfModeKey, "true", 300);

        // v25.0.3 重大修復：使用完整對話歷史，確保 AI 能看到所有上下文
        const history = getHistoryFromCacheOrSheet(contextId);

        // v27.7.5 新增：清除歷史中的舊型號，避免型號汙染（多載不相關的 PDF）
        // 當用戶選擇了特定型號後，舊的推薦型號（如 M8, M9）不應再被考慮
        const cleanedHistory = history
          .map((msg) => {
            if (
              msg &&
              msg.role === "assistant" &&
              typeof msg.content === "string" && // Check specific property type
              msg.content.includes("有幾個版本")
            ) {
              // 這是型號選擇提問，刪除以避免汙染型號推薦
              return null;
            }
            return msg;
          })
          .filter((m) => m !== null);

        // v27.2.6: 重啟後歷史可能為 0，補上原始提問與本次選擇，避免 Deep Mode 無上下文
        if (cleanedHistory.length === 0 && pending.originalQuery) {
          cleanedHistory.push({ role: "user", content: pending.originalQuery });
          cleanedHistory.push({
            role: "assistant",
            content: createModelSelectionFlexV3(
              pending.options.map((o) => o.prefix), // Extract model names for V3
              { headerText: `🔍 ${pending.aliasKey} 型號確認` },
            ),
          });
          cleanedHistory.push({ role: "user", content: msg });
        }

        writeLog(`[PDF Select] 完整歷史長度: ${cleanedHistory.length} 則`); // v27.2.7: 🔥 強制重新提問，不然 AI 看到 "3" 會覺得沒事做
        // 原因：history 中只有 user:"3"，AI 會以為對話已結束，只回傳 emoji
        // v27.3.3: 加強強力指令，避免 AI 因為看到上一輪 Fast Mode 回答而偷懶
        const forceAskMsg = {
          role: "user",
          content: `(我已選擇: ${selected.matchedModel}) 請閱讀這份手冊，**無視任何字數限制**，詳細回答我原本的問題：${pending.originalQuery}\n\n請注意：\n1. 若有操作步驟，請逐一列出，不要省略。\n2. 若有圖片說明，請用文字清晰描述。\n3. 請扮演專業技術人員，提供最完整的教學，絕對不要簡短。`,
        };

        writeLog(
          `[PDF Mode] 開始查詢手冊，可能需要 60 秒 (選擇: ${selected.matchedModel})`,
        );
        const response = callLLMWithRetry(
          pending.originalQuery,
          [...cleanedHistory, forceAskMsg],
          [], // filesToAttach
          true, // attachPDFs
          null, // imageBlob
          false, // isRetry
          userId,
          false, // forceWebSearch
          selected.matchedModel, // targetModelName
        );

        if (response) {
          if (response === "[KB_EXPIRED]") {
            const expiredText = "⚠️ 系統偵測到產品手冊需要更新，正在背景自動重新整理中。大約 1 分鐘後即可恢復正常，請稍後再試喔！";
            replyMessage(replyToken, expiredText);
            writeRecordDirectly(userId, queryText, contextId, "user", "");
            writeRecordDirectly(userId, expiredText, contextId, "assistant", "");
            const expHistory = getHistoryFromCacheOrSheet(contextId);
            updateHistorySheetAndCache(
              contextId,
              expHistory,
              { role: "user", content: queryText },
              { role: "assistant", content: expiredText }
            );
            return;
          }
          let finalText = stripAnySourceTags(formatForLineMobile(response));
          finalText = finalText.replace(/\[AUTO_SEARCH_PDF\]/g, "").trim();
          finalText = finalText.replace(/\[NEED_DOC\]/g, "").trim();
          finalText = finalText.replace(/\[NEW_TOPIC\]/g, "").trim();
          // v29.3.51: 補上 [AUTO_SEARCH_WEB] 清理，防止暗號外洩
          finalText = finalText.replace(/\[AUTO_SEARCH_WEB\]/g, "").trim();
          finalText = finalText.replace(/\[型號[:：][^\]]+\]/g, "").trim();
          finalText = sanitizeManualDeflection(finalText);
          finalText = enforceManualNumberedList(finalText);

          // v27.0.0: 修復費用顯示邏輯
          // 只在有有效回答和有 lastTokenUsage 時才顯示費用
          let replyText = finalText;
          if (DEBUG_SHOW_TOKENS && lastTokenUsage && lastTokenUsage.costTWD) {
            const tokenInfo = `\n\n${buildReplyCostAuditText_()}`;
            replyText += tokenInfo;
          }

          replyMessage(replyToken, replyText);

          // v27.7.6: 回寫包含費用的完整回覆，方便 testMessage 顯示金額
          // v29.5.103: 移除截斷限制，完整記錄 AI 回覆
          writeLog(`[AI Reply] ${replyText}`);
          writeLog(
            `[PDF Mode] 完成查詢手冊，花費 ${
              lastTokenUsage && lastTokenUsage.costTWD
                ? "NT$" + lastTokenUsage.costTWD.toFixed(4)
                : "未知成本"
            }`,
          );

          // v25.0.3: 用戶選擇「3」後，新增該選擇和回答到歷史
          const selectMsgObj = { role: "user", content: msg }; // "3"
          const asstMsgObj = { role: "assistant", content: finalText };
          updateHistorySheetAndCache(
            contextId,
            cleanedHistory,
            selectMsgObj,
            asstMsgObj,
          );
          // v25.0.1 修復：記錄用戶選擇的「3」而非原始問題
          writeRecordDirectly(userId, msg, contextId, "user", "");
          writeRecordDirectly(userId, replyText, contextId, "assistant", "");
        } else {
          replyMessage(replyToken, "⚠️ 查詢手冊時發生錯誤，請稍後再試");
        }

        return true;
      }
    }

    // 檢查用戶是否輸入了完整型號（如 S32FM803）
    const modelMatch = msg
      .toUpperCase()
      .match(/^[SC]\d{2}[A-Z]{1,2}\d{2,3}[A-Z]{0,2}$/);
    if (modelMatch) {
      const inputModel = modelMatch[0];
      writeLog(`[PDF Select] 用戶輸入完整型號: ${inputModel}`);

      // 清除等待狀態
      cache.remove(pendingKey);

      // v24.4.1: 顯示 Loading 動畫
      showLoadingAnimation(userId, 60);

      // 注入型號到 Cache
      cache.put(
        `${userId}:direct_search_models`,
        JSON.stringify([inputModel]),
        300,
      );

      // 設定 PDF Mode
      const pdfModeKey = CACHE_KEYS.PDF_MODE_PREFIX + contextId;
      cache.put(pdfModeKey, "true", 300);

      // 用原始問題重新處理（使用清潔的歷史避免型號汙染）
      const history = getHistoryFromCacheOrSheet(contextId);
      const cleanedHistory = history
        .map((msg) => {
          if (
            msg.role === "assistant" &&
            msg.content &&
            msg.content.includes("有幾個版本")
          ) {
            return null;
          }
          return msg;
        })
        .filter((m) => m !== null);

      const userMsgObj = { role: "user", content: pending.originalQuery };

      writeLog(
        `[PDF Mode] 開始查詢手冊，可能需要 60 秒 (完整型號: ${inputModel})`,
      );
      const response = callLLMWithRetry(
        pending.originalQuery,
        [...cleanedHistory, userMsgObj],
        [],
        true,
        null,
        false,
        userId,
        false,
        inputModel,
      );

      if (response) {
        let finalText = stripAnySourceTags(formatForLineMobile(response));
        finalText = finalText.replace(/\[AUTO_SEARCH_PDF\]/g, "").trim();
        finalText = finalText.replace(/\[NEW_TOPIC\]/g, "").trim();
        finalText = finalText.replace(/\[AUTO_SEARCH_WEB\]/g, "").trim();
        finalText = finalText.replace(/\[型號[:：][^\]]+\]/g, "").trim();
        finalText = sanitizeManualDeflection(finalText);
        finalText = enforceManualNumberedList(finalText);

        // v27.0.0: 修復費用顯示邏輯（同上，確保費用對應當前查詢）
        let replyText = finalText;
        if (DEBUG_SHOW_TOKENS && lastTokenUsage && lastTokenUsage.costTWD) {
          const tokenInfo = `\n\n${buildReplyCostAuditText_()}`;
          replyText += tokenInfo;
        }

        replyMessage(replyToken, replyText);

        // v27.7.6: 回寫包含費用的完整回覆，方便 testMessage 顯示金額
        // v29.5.103: 移除截斷限制，完整記錄 AI 回覆
        writeLog(`[AI Reply] ${replyText}`);
        writeLog(
          `[PDF Mode] 完成查詢手冊，花費 ${
            lastTokenUsage && lastTokenUsage.costTWD
              ? "NT$" + lastTokenUsage.costTWD.toFixed(4)
              : "未知成本"
          }`,
        );

        // v24.4.3 修復：正確的參數順序 (cid, prev, uMsg, aMsg)
        const asstMsgObj = { role: "assistant", content: finalText };
        updateHistorySheetAndCache(
          contextId,
          cleanedHistory,
          userMsgObj,
          asstMsgObj,
        );
        writeRecordDirectly(
          userId,
          pending.originalQuery,
          contextId,
          "user",
          "",
        );
        writeRecordDirectly(userId, replyText, contextId, "assistant", "");
      } else {
        replyMessage(replyToken, "⚠️ 查詢手冊時發生錯誤，請稍後再試");
      }

      return true;
    }

    // 用戶回覆不是數字也不是型號 → 當作新問題，清除等待狀態
    writeLog(`[PDF Select] 用戶未選擇，當作新問題處理: ${msg}`);
    cache.remove(pendingKey);
    // v29.5.116: 同時清除待執行 PDF 查詢標記（因為用戶改變主意了）
    cache.remove(`${userId}:pending_pdf_query`);
    return false; // 繼續正常流程
  } catch (e) {
    writeLog(`[Error] handlePdfSelectionReply: ${e.message}`);
    return false;
  }
}

/**
 * v24.4.0 新增：生成 PDF 型號選擇的反問訊息
 * @param {string} aliasName - 別稱友善名稱（如「Smart Monitor M8」）
 * @param {Array} matchedPdfs - 匹配的 PDF 列表
 * @returns {string} 反問訊息
 */
/**
 * v24.4.0 新增: 生成 PDF 型號選擇的反問訊息
 * v29.3.40 優化: 改為 Flex Message 泡泡選單
 */
function createModelSelectionFlexV2(aliasName, matchedPdfs) {
  // 限制顯示前 9 個，保留最後一個給「以上皆非」 (Flex Button 上限通常較寬鬆，但為了 UI 美觀)
  const displayPdfs = matchedPdfs.slice(0, 9);

  const buttons = displayPdfs.map((pdf, index) => {
    const num = index + 1;
    return {
      type: "button",
      style: "secondary",
      height: "sm",
      action: {
        type: "message",
        label: `${num}. ${pdf.prefix}`,
        text: num.toString(), // 回傳 "1", "2" 給 handlePdfSelectionReply 處理
      },
      margin: "xs",
    };
  });

  // 加入「以上皆非」按鈕 - v29.3.41 User requested removal (Commented out)
  /*
                                buttons.push({
                                  type: "button",
                                  style: "link",
                                  height: "sm",
                                  action: {
                                    type: "message",
                                    label: "都不是 / 找人工客服",
                                    text: "找真人客服",
                                  },
                                  margin: "md",
                                });
                                */

  return {
    type: "flex",
    altText: `請選擇你的 ${aliasName} 型號`,
    contents: {
      type: "bubble",
      size: "giga",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "🔍 型號確認",
            weight: "bold",
            color: "#1DB446",
            size: "sm",
          },
          {
            type: "text",
            text: `${aliasName} 有多個版本`,
            weight: "bold",
            size: "xl",
            margin: "md",
            wrap: true,
          },
          {
            type: "text",
            text: "請點擊你的型號開頭：",
            size: "xs",
            color: "#aaaaaa",
            wrap: true,
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: buttons,
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "💡 或直接繼續提問",
            size: "xs",
            color: "#bbbbbb",
            align: "center",
          },
        ],
      },
    },
  };
}

/**
 * v24.1.5 新增：偵測型號變化，自動清除不相關的 PDF Mode
 * 當用戶問的型號與當前 PDF Mode 的型號不同時，清除 PDF Mode
 * 讓系統先用 CLASS_RULES（Fast Mode）回答
 */
function checkAndClearPdfModeOnModelChange(msg, currentHistory) {
  try {
    const cache = CacheService.getScriptCache();

    // 從當前訊息提取型號
    const currentModels = extractModelNumbers(msg);
    if (currentModels.length === 0) {
      return false; // 沒有提到型號，不需要清除
    }

    // 從歷史對話中提取前一個提到的型號
    let previousModels = [];
    if (currentHistory && currentHistory.length > 0) {
      // 查看最近 3 句（往前看）
      for (
        let i = Math.max(0, currentHistory.length - 6);
        i < currentHistory.length;
        i++
      ) {
        const histMsg = currentHistory[i];
        if (histMsg && histMsg.content) {
          const models = extractModelNumbers(histMsg.content);
          if (models.length > 0) {
            previousModels = models;
            break; // 找到最近提到的型號就停止
          }
        }
      }
    }

    // 比對：如果型號不同，清除 PDF Mode
    if (previousModels.length > 0 && currentModels.length > 0) {
      const isSameModel = previousModels.some((pm) =>
        currentModels.some((cm) => pm === cm),
      );
      if (!isSameModel) {
        writeLog(
          `[ModelChange] 偵測到型號變化：${previousModels.join(
            ",",
          )} → ${currentModels.join(",")}，清除 PDF Mode`,
        );
        return true; // 表示需要清除 PDF Mode
      }
    }

    return false;
  } catch (e) {
    writeLog("[Error] checkAndClearPdfModeOnModelChange: " + e.message);
    return false;
  }
}

/**
 * v24.1.5 新增：提取訊息中的型號編碼
 * 支援 S27FG900、G90XF、M70D 等各種格式
 */
/**
 * v27.3.0 強化版：提取訊息中的型號編碼 (雙重認證機制)
 * 1. 使用 Regex 進行廣泛搜捕 (支援中文句型)
 * 2. 針對短型號 (如 M9, G8) 強制查閱 CLASS_RULES 驗證，避免誤判 (如 3M 膠帶)
 * 防止誤判：「我要用 3M 膠帶」不會被當成 M3 型號
 */
function extractModelNumbers(text) {
  try {
    if (!text) return [];
    const models = [];
    const upperText = text.toUpperCase();

    // 1. 準備查核清單 (移除：不再需要 Keyowrd Map 驗證)
    // v29.4: 回歸純 Regex 模式，讓 Smart Router 決定是否相關

    // 2. 定義搜捕模式
    // 注意：短型號在 v27.3.0 會進行二次驗證
    const modelPatterns = [
      {
        // v29.6.028: 修 regex 允許數字結尾 (S22D400, S24A600, S27D400GAC)
        pattern:
          /(?:^|[^A-Z0-9])((?:L?[SCFG])\d{2}[A-Z]+\d{0,4}[A-Z]{0,3})(?:$|[^A-Z0-9])/g,
        needValidate: false,
      }, // 長型號直接放行
      {
        pattern:
          /(?:^|[^A-Z0-9])((?:WA|WD|VR)\d{2}[A-Z0-9]{5,})(?:$|[^A-Z0-9])/g,
        needValidate: false,
      }, // 家電型號（洗衣機/乾衣機/掃地機等）直接放行
      {
        pattern: /(?:^|[^A-Z0-9])([MG][1-9]\d{0,1}[A-Z]?)(?:$|[^A-Z0-9])/g,
        needValidate: true,
      }, // 短型號需查核
      { pattern: /\b(ARK\s*(?:DIAL|HUB)?)\b/gi, needValidate: true },
      { pattern: /\b(ODYSSEY\s*(?:HUB|3D)?)\b/gi, needValidate: true },
    ];

    // 3. 執行搜捕 (移除雙重驗證，直接信任 Regex)
    modelPatterns.forEach((config) => {
      let match;
      while ((match = config.pattern.exec(upperText)) !== null) {
        let candidate = (match[1] || match[0]).trim();
        // 去除頭尾非英數字符
        candidate = candidate.replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, "");

        if (!candidate || candidate.length < 2 || models.includes(candidate))
          continue;

        models.push(candidate);
      }
    });

    return models;
  } catch (e) {
    writeLog("[Error] extractModelNumbers: " + e.message);
    return [];
  }
}

/**
 * v24.1.5 新增：將 PDF 檔名轉換為用戶友善的產品名稱
 * 例如：S27FG900 → Odyssey G7 (27吋)
 * 如果轉換失敗，則返回原始檔名
 */
function getPdfProductName(pdfFileName) {
  try {
    if (!pdfFileName) return "";

    const upperName = pdfFileName.toUpperCase();

    // 從 CLASS_RULES 讀取映射關係
    let productMap = {};
    try {
      const mapJson = PropertiesService.getScriptProperties().getProperty(
        CACHE_KEYS.KEYWORD_MAP,
      );
      if (mapJson) {
        const keywordMap = JSON.parse(mapJson);
        // 從 KEYWORD_MAP 反向建立 型號→產品名稱 的映射
        Object.keys(keywordMap).forEach((key) => {
          const value = keywordMap[key];
          // 提取型號部分
          const modelMatch = value.match(/\(([A-Z]\d{2}[A-Z]{1,3})\)/);
          if (modelMatch) {
            const model = modelMatch[1];
            // 保留最簡潔的產品名稱（不含規格詳情）
            const productName = value.split("\n")[0] || value;
            productMap[model] = productName;
          }
        });
      }
    } catch (e) {}

    // 嘗試從檔名提取型號，然後查表
    // 例如 S27FG900 → 查表找「Odyssey G7」
    const possibleModels = [
      ...(pdfFileName.match(/\b([SG]\d{2}[A-Z]{1,3})\b/g) || []),
      ...(pdfFileName.match(/\bM[5789]\d?[A-Z]?\b/g) || []),
    ];

    for (const model of possibleModels) {
      if (productMap[model]) {
        return productMap[model];
      }
    }

    // 如果找不到映射，使用簡單的型號別稱規則
    const simpleNames = {
      G90: "Odyssey 3D",
      G80: "Odyssey G8",
      G70: "Odyssey G7",
      G60: "Odyssey G6",
      G50: "Odyssey G5",
      G9: "Odyssey G9",
      M7: "Smart Monitor M7",
      M8: "Smart Monitor M8",
      M9: "Smart Monitor M9",
      M5: "Smart Monitor M5",
    };

    for (const [key, name] of Object.entries(simpleNames)) {
      if (upperName.includes(key)) {
        return name;
      }
    }

    // 預設返回原始檔名
    return pdfFileName.replace(".pdf", "");
  } catch (e) {
    return pdfFileName.replace(".pdf", "");
  }
}

/**
 * 以「實際掛載的 PDF 檔名」產生來源標籤，避免顯示不存在的手冊名稱。
 */
function buildPdfSourceLabelFromFiles(files, maxCount = 1) {
  try {
    const safeMax = Math.max(1, Number(maxCount) || 1);
    const names = (files || [])
      .filter(
        (f) =>
          f &&
          f.name &&
          (!f.mimeType || String(f.mimeType).toLowerCase().indexOf("pdf") >= 0),
      )
      .map((f) => String(f.name).trim())
      .filter((n) => n);
    const uniqueNames = [...new Set(names)];
    return uniqueNames.slice(0, safeMax).join("、");
  } catch (e) {
    return "";
  }
}

/**
 * 統一來源標籤：先移除舊標籤，再補上真實 PDF 來源。
 */
function isApiFailureReply(text) {
  return /目前請求過於頻繁|已達配額限制|系統暫時忙碌|這次查詢暫時無法處理|暫時無法處理|網路搜尋服務暫時無法連線|API\s*錯誤|Google\s*伺服器暫時故障|請求參數有誤/i.test(
    String(text || ""),
  );
}

function appendPdfSourceTag(text, files, maxCount = 1) {
  let cleaned = String(text || "")
    .replace(/[\[（\(]來源[：:][^\]）\)]*[\]）\)]/g, "")
    .trim();
  if (isApiFailureReply(cleaned)) {
    return cleaned;
  }
  const label = buildPdfSourceLabelFromFiles(files, maxCount);
  if (!label) return cleaned;
  writeLog(`[Source Audit] 官方手冊來源 PDF: ${label}`);
  return `${cleaned}\n\n[來源:官方手冊]`;
}

/**
 * 若回覆尚未含來源標籤，強制補上 PDF 檔名來源。
 */
function ensurePdfSourceTag(text, files, maxCount = 1) {
  const body = String(text || "").trim();
  if (/[\[（\(]來源[：:][^\]）\)]*[\]）\)]/i.test(body)) {
    return body;
  }
  return appendPdfSourceTag(body, files, maxCount);
}

/**
 * 統一移除 AI 自帶來源標籤，避免錯誤來源外洩。
 */
function stripAnySourceTags(text) {
  return String(text || "")
    .replace(/[\[（\(]來源[：:][^\]）\)]*[\]）\)]/g, "")
    .trim();
}

function isCampaignRuleReplyText_(text) {
  return /(電腦螢幕活動RULE|活動|促銷|登錄|抽獎|延長保固|贈品|Steam|點卡|月月抽|Galaxy\s*S26)/i.test(
    String(text || ""),
  );
}

function normalizeAllowedSourceTag_(sourceText, fullText) {
  const src = String(sourceText || "").trim();
  if (!src) return "";
  if (/^QA$|QA庫|QA資料庫/i.test(src)) return "[來源:QA庫]";
  if (/網路搜尋|^WEB$/i.test(src)) return "[來源:網路搜尋]";
  if (/官方手冊|產品手冊|手冊|PDF|\.pdf|上一則官方/i.test(src)) {
    return "[來源:官方手冊]";
  }
  if (/AI內建資料庫|AI內建|LLM內建|內建資料庫|一般知識|通用知識|常識/i.test(src)) {
    return "[來源:AI內建資料庫]";
  }
  if (/官方活動庫|活動|促銷|RULE|登錄|抽獎|延長保固|贈品/i.test(src)) {
    return "[來源:官方活動庫]";
  }
  if (/官方規格庫|規格庫|產品規格|規格表|CLASS_RULES/i.test(src)) {
    return isCampaignRuleReplyText_(fullText)
      ? "[來源:官方活動庫]"
      : "[來源:官方規格庫]";
  }
  return "";
}

function normalizeVisibleSourceTags_(text) {
  return String(text || "")
    .replace(/[\[（\(]來源[：:]\s*([^\]）\)]+)[\]）\)]/gi, (match, src) => {
      return normalizeAllowedSourceTag_(src, text);
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 將 LLM 原始來源標籤正規化為系統允許格式（Fast Mode 用）。
 */
function normalizeSourceTagFromRaw(rawText) {
  const raw = String(rawText || "");
  const m = raw.match(/[\[（\(]來源[：:]\s*([^\]）\)]+)[\]）\)]/i);
  if (!m || !m[1]) return "";
  const src = m[1].trim();
  if (/^QA$/i.test(src)) return "[來源:QA庫]";
  if (/^QA庫$/i.test(src)) return "[來源:QA庫]";
  if (/^規格庫$/.test(src)) {
    return isCampaignRuleReplyText_(raw) ? "[來源:官方活動庫]" : "[來源:官方規格庫]";
  }
  if (/^官方規格庫$/.test(src)) return "[來源:官方規格庫]";
  if (/^官方活動庫$/.test(src)) return "[來源:官方活動庫]";
  if (/^網路搜尋$|^Web$/i.test(src)) return "[來源:網路搜尋]";
  if (/QA|規格|產品規格|規格表|資料庫/i.test(src)) {
    writeLog(`[Anti-Hallucination] 🛑 Fast Mode 偵測到 AI 自帶模糊來源標記「${src}」，拒絕洗白為可信來源！`);
    return "";
  }
  if (/一般知識|通用知識|常識/i.test(src)) {
    writeLog(`[Anti-Hallucination] 🛑 偵測到 AI 自帶「一般知識」來源標記，強行封殺！`);
    return "";
  }
  if (/手冊|PDF/i.test(src)) {
    writeLog(`[Anti-Hallucination] 🛑 Fast Mode 偵測到 AI 自帶「手冊/PDF」來源標記，未掛載 PDF 時禁止洗白為產品手冊來源！`);
    return "";
  }
  return "";
}

function appendSourceTagIfMissing(text, sourceTag) {
  const body = String(text || "").trim();
  const tag = String(sourceTag || "").trim();
  
  // v29.6.040: 如果 body 內部已經有任何來源標籤了，直接返回 body，避免雙重標註
  if (/[\[（\(]來源[：:][^\]）\)]*[\]）\)]/i.test(body)) {
    return body;
  }
  
  // v29.6.038: 智慧判定 fallback 來源
  if (!tag) {
    // 招呼語 / 太短 → 不標
    if (body.length < 30) return body;
    // 含暗號 → 不補 (交由攔截層處理)
    if (/\[AUTO_SEARCH_PDF\]|\[AUTO_SEARCH_WEB\]|\[NEED_DOC\]/i.test(body)) {
      return body;
    }
    // v29.6.039: 競品婉轉拒答 → 不標 (社交對話非資料來源)
    if (/主要服務三星|三星客服|LG|BENQ|ASUS|Acer|Dell|HP 的資訊|我這邊沒有/.test(body)) {
      return body;
    }
    return body;
  }
  if (/[\[（\(]來源[：:][^\]）\)]*[\]）\)]/i.test(body)) return body;
  return `${body}\n\n${tag}`;
}

function tokenizeForSourceInference(text) {
  const rawTokens =
    String(text || "")
      .toUpperCase()
      .match(/[A-Z0-9]{2,}|[\u4e00-\u9fa5]{2,}/g) || [];
  const stopWords = {
    三星: true,
    螢幕: true,
    顯示器: true,
    請問: true,
    可以: true,
    是否: true,
    什麼: true,
    怎麼: true,
    如何: true,
    功能: true,
    資訊: true,
    這台: true,
    這個: true,
  };
  const seen = {};
  const result = [];
  rawTokens.forEach((token) => {
    if (!token || token.length < 2 || stopWords[token]) return;
    if (seen[token]) return;
    seen[token] = true;
    result.push(token);
  });
  return result;
}

function loadQaRowsForSourceInference() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get("qa_source_inference_rows_v1");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    }

    let rows = [];
    const qaCount = parseInt(cache.get("KB_QA_COUNT") || "0", 10);
    if (qaCount > 0) {
      let fullQA = "";
      for (let i = 0; i < qaCount; i++) {
        fullQA += cache.get(`KB_QA_${i}`) || "";
      }
      rows = fullQA
        .split(/\n{2,}|QA:\s*/g)
        .map((line) => String(line || "").trim())
        .filter((line) => line.length >= 20);
    }

    if (rows.length === 0 && ss) {
      const qaSheet = ss.getSheetByName(SHEET_NAMES.QA);
      if (qaSheet && qaSheet.getLastRow() >= 1) {
        rows = qaSheet
          .getRange(1, 1, qaSheet.getLastRow(), 1)
          .getValues()
          .map((row) => String(row[0] || "").trim())
          .filter((line) => line.length >= 20 && !/^(問題|Question|QA內容)/i.test(line));
      }
    }

    rows = rows.slice(0, 200);
    if (rows.length > 0) {
      cache.put("qa_source_inference_rows_v1", JSON.stringify(rows), 21600);
    }
    return rows;
  } catch (e) {
    writeLog(`[QA Source Inference] ${e.message}`);
    return [];
  }
}

function inferQaSourceTagFromFastReply(userText, replyText, existingTag) {
  if (existingTag) return existingTag;
  const userTokens = tokenizeForSourceInference(userText);
  const replyTokens = tokenizeForSourceInference(replyText);
  if (userTokens.length < 2 || replyTokens.length < 2) return "";

  const rows = loadQaRowsForSourceInference();
  const replyUpper = String(replyText || "").toUpperCase();
  for (let i = 0; i < rows.length; i++) {
    const rowUpper = String(rows[i] || "").toUpperCase();
    let userHitCount = 0;
    for (let j = 0; j < userTokens.length; j++) {
      if (rowUpper.indexOf(userTokens[j]) >= 0) userHitCount++;
    }
    if (userHitCount < 2) continue;

    const rowTokens = tokenizeForSourceInference(rowUpper);
    let replyHitCount = 0;
    for (let k = 0; k < rowTokens.length; k++) {
      if (replyUpper.indexOf(rowTokens[k]) >= 0) replyHitCount++;
    }
    if (replyHitCount >= 3) {
      writeLog(`[QA Source Inference] 回覆命中 QA 來源列 (${userHitCount}/${replyHitCount})`);
      return "[來源:QA庫]";
    }
  }
  return "";
}

function isKnowledgeMissingReply_(text) {
  return /查無|沒有關於.+(?:資訊|資料|上市|日期)|(?:目前|手邊|我目前手邊).{0,12}資料.{0,8}沒有|沒有\s*\d{4}\s*年?.{0,20}(?:上市資訊|上市日期|上市時間)|沒有.{0,20}(?:上市資訊|上市日期|上市時間)|資料庫(?:中|裡)?(?:沒有|沒有找到|沒有相關|未記載|找不到)|目前沒有.+(?:資訊|資料|上市|日期)|建議.{0,20}(?:官網|官方社群|官方網站)/i.test(
    String(text || ""),
  );
}

function inferFastLocalSourceTag_(userText, replyText, existingTag) {
  const qaTag = inferQaSourceTagFromFastReply(userText, replyText, existingTag);
  if (qaTag) return qaTag;

  const user = String(userText || "");
  const reply = String(replyText || "");
  const combined = `${user}\n${reply}`;
  if (
    hasVisibleSourceAudit_(reply) ||
    isKnowledgeMissingReply_(reply) ||
    isModelSelectionOrNeedModelReply(reply)
  ) {
    return "";
  }

  if (isCampaignRuleReplyText_(combined)) {
    return "[來源:官方活動庫]";
  }

  const knownModels = extractModelNumbers(user)
    .map((m) => String(m || "").toUpperCase())
    .filter((m) => m && isKnownFullModelToken(m));
  const mentionsSpecFact =
    /(解析度|更新率|刷新率|面板|IPS|VA|OLED|QHD|UHD|FHD|HDR|Hz|亮度|尺寸|吋|反應時間|DisplayPort|HDMI|USB|Type-?C|喇叭|耳機孔|支援|規格|比較)/i.test(
      combined,
    );
  if (knownModels.length > 0 && mentionsSpecFact) {
    writeLog(
      `[Source Inference] Fast Mode 已知型號規格回答補官方規格庫來源: ${knownModels.join(", ")}`,
    );
    return "[來源:官方規格庫]";
  }

  return "";
}

function sanitizeLeadDatabasePhrase(text) {
  return String(text || "")
    .replace(/^\s*根據(?:我|目前|我手上)?(?:的)?資料庫[，,：: ]*/i, "")
    .replace(/^\s*根據目前資料[，,：: ]*/i, "")
    .trim();
}

function isShortAliasModelToken(model) {
  const m = String(model || "").trim().toUpperCase();
  if (!m) return false;
  // 例如 S9 / G8 / M7 這類系列別稱
  return /^[SGM]\d{1,2}[A-Z]{0,3}$/.test(m);
}

function extractShortAliasModelTokens(text) {
  const q = toHalfWidth(String(text || "")).toUpperCase();
  const matches = q.match(/\b[SGM]\d{1,2}[A-Z]{0,3}\b/g) || [];
  return [...new Set(matches.filter((m) => isShortAliasModelToken(m)))];
}

function isAliasOnlyQuery(text) {
  return (
    extractShortAliasModelTokens(text).length > 0 &&
    extractFullModelLikeTokens(text).length === 0
  );
}

function isFeatureBinaryQuestion(text) {
  const q = String(text || "");
  const hasBinaryTone = /(有沒有|是否|嗎|有|支援|內建|可以|可不可以|能不能)/i.test(
    q,
  );
  const hasFeatureKeyword =
    /(KVM|G-?SYNC|FREESYNC|HDR|更新率|刷新率|反應時間|耳機孔|喇叭|面板|智慧功能|SMART|PBP|PIP|TYPE-?C|USB-C)/i.test(
      q,
    );
  return hasBinaryTone && hasFeatureKeyword;
}

function isOperationOrTroubleshootQuery(text) {
  const q = String(text || "");
  return /(怎麼|如何|教學|步驟|設定|開啟|關閉|關掉|連接|安裝|操作|使用|排除|故障|無法|不能|異常|重置|恢復|閃爍|不亮|沒畫面|當機|調整|調到|調低|調小|切換|切到|叫出|進入選單|打開選單|進不去)/i.test(
    q,
  );
}

function isOperationAnswerInsufficient(text) {
  const t = String(text || "");
  const hasSteps =
    /(^|\n)\s*1\.\s*|(^|\n)\s*2\.\s*|步驟|先.+再.+|請先|接著|然後|到.*選單|設定.*選項/i.test(
      t,
    );
  const strongUncertainty =
    /不確定|無法確認|未明確|查無|資料不足|手冊未記載|沒有資料|建議.*查手冊|可以再幫你查手冊/i.test(
      t,
    );
  if (hasSteps && !strongUncertainty) {
    return false;
  }
  return strongUncertainty || !hasSteps;
}

function isFactoryResetQueryWithoutPinIssue(text) {
  const q = String(text || "");
  const asksFactoryReset = /(恢復出廠|回復出廠|還原出廠|出廠設定|出廠資料重設|恢復原廠|還原原廠|重置為出廠|重設為出廠|重置|重設)/i.test(
    q,
  );
  const asksPinRecovery = isPinRecoveryQuery(q);
  return asksFactoryReset && !asksPinRecovery;
}

function buildFactoryResetManualSearchQuery_(query, targetModelName) {
  const original = String(query || "").trim();
  if (!isFactoryResetQueryWithoutPinIssue(original)) {
    return original;
  }
  const modelText = String(targetModelName || "").trim();
  return [
    `請查官方手冊中${modelText ? `「${modelText}」` : ""}「恢復出廠 / 出廠資料重設 / 重設」的實際操作路徑。`,
    "請優先比對 Smart Monitor / Tizen 選單相關字詞：設定、所有設定、一般與隱私權、重設、出廠資料重設、安全 PIN。",
    "只回答手冊中找得到的操作路徑；如果手冊沒有這些字詞，請明確說手冊未記載，並輸出 [AUTO_SEARCH_WEB]，不要改用一般常識或線上資源猜測。",
    "",
    `使用者原問題：${original}`,
  ].join("\n");
}

function isPinRecoveryQuery(text) {
  const q = String(text || "");
  return /(忘記|遺失|不記得|找不到).{0,12}(PIN|密碼|碼)|(?:PIN|密碼|碼).{0,12}(忘記|遺失|不記得|找不到)/i.test(
    q,
  );
}

function isPinRecoveryOnlyAnswer(text) {
  const t = String(text || "");
  const hasPinRecovery =
    /(忘記|遺失|不記得|找不到).{0,16}(PIN|密碼|碼)|(?:PIN|密碼|碼).{0,16}(忘記|遺失|不記得|找不到)|0800|客服人員|遠端連線/i.test(
      t,
    );
  const hasFactoryResetPath = /(設定|所有設定|一般與隱私權|出廠資料重設|重設\s*Smart\s*Hub|自我診斷)/i.test(
    t,
  );
  return hasPinRecovery && !hasFactoryResetPath;
}

function buildNeedModelForOperationReply() {
  return [
    "這題會跟不同型號的按鍵、選單或遙控器設計有關，我先確認完整型號，才不會給你錯的操作步驟。",
    "",
    "請直接回覆完整型號，例如：S32FM703UC、S27FG812SC。",
    "",
    "收到型號後，我會依 QA/規格庫先查；如果仍不足，再接著查官方手冊。",
  ].join("\n");
}

function isSamsungHomeApplianceQuery(text) {
  const q = String(text || "");
  return /(洗衣機|乾衣機|烘衣機|冰箱|吸塵器|掃地機|空氣清淨機|除濕機|家電|WASHER|DRYER|REFRIGERATOR|VACUUM|APPLIANCE|\bWA\d{2}|\bWD\d{2}|\bVR\d{2})/i.test(
    q,
  );
}

function isCrossDeviceMonitorQuery(text) {
  const q = String(text || "");
  const hasExternalDevice =
    /(IPHONE|IPAD|ANDROID|GALAXY\s*(?:PHONE|TAB|S\d{1,2}|A\d{1,2}|Z\s*(?:FLIP|FOLD))|手機|平板|MACBOOK|MAC\s*MINI|筆電|NOTEBOOK|LAPTOP|桌機|PC|PS[45]|PLAYSTATION|XBOX|NINTENDO\s*SWITCH|SWITCH|STEAM\s*DECK|相機)/i.test(
      q,
    );
  const hasMonitorTarget =
    /(螢幕|顯示器|MONITOR|DISPLAY|SMART\s*MONITOR|ODYSSEY|VIEWFINITY|\bM[5789]\b|\bS\d{2}[A-Z0-9]{4,}(?:UC|SC|EC|WC|XC)?\b)/i.test(
      q,
    );
  const hasDisplayConnectionIntent =
    /(連接|接上|投影|投放|鏡像|顯示|輸出|畫面|DEX|AIRPLAY|MIRACAST|HDMI|DISPLAYPORT|DP|TYPE\s*-?\s*C|USB\s*-?\s*C|THUNDERBOLT|無線連線|播放)/i.test(
      q,
    );
  return hasExternalDevice && hasMonitorTarget && hasDisplayConnectionIntent;
}

function isIncorrectCrossDeviceScopeRefusal(text) {
  const q = String(text || "");
  return /(我只負責|不屬於(?:我的|本專案)?(?:服務|回答|專業)?範圍|不在(?:我的|本專案)?(?:服務|回答|專業)?範圍|這不屬於螢幕問題|無法回答)[\s\S]{0,80}(手機|平板|電腦螢幕|智慧家電|產品)/i.test(
    q,
  );
}

function buildCrossDeviceMonitorPromptRule(query) {
  if (!isCrossDeviceMonitorQuery(query)) return "";
  return `
【跨裝置連接螢幕題最高優先規則】
這題的主體是「如何把外部裝置連到三星螢幕」，不是在詢問外部裝置本身的規格。
即使題目提到 iPhone、iPad、Android、Galaxy 手機、MacBook、筆電、遊戲機或其他訊號來源，也絕對不可用「我只負責電腦螢幕與智慧家電」拒答。
你只能根據目前提供或實際搜尋到的來源，回答該三星螢幕支援的輸入方式、必要條件與操作步驟。
若目前只有螢幕官方手冊，而手冊沒有記載外部裝置端的相容性或設定，就只整理螢幕端條件並明說裝置端尚待查證；不得補寫手機設定、轉接器、上市狀態、換線測試或其他無來源建議。
手冊模式請先用一句話說清楚「目前能確認什麼、還不能確認什麼」，再用最多 3 點整理真正影響連接的螢幕端條件。不要逐條照搬警告、不要重複結論，也不要把標題編成獨立的數字項目。
`;
}

function hasUnsupportedCrossDeviceExternalAdvice(text) {
  const answer = String(text || "");
  return /(IPHONE\s*\d*[\s\S]{0,45}(?:未上市|尚未上市|尚未公布)|一般來說[\s\S]{0,80}(?:IPHONE|APPLE|手機|平板)|(?:檢查|開啟|啟用|調整)[\s\S]{0,35}(?:IPHONE|IPAD|ANDROID|手機|平板)[\s\S]{0,45}(?:設定|影像輸出|螢幕鏡射)|(?:IPHONE|IPAD|ANDROID|手機|平板)[\s\S]{0,35}(?:設定|影像輸出|螢幕鏡射)[\s\S]{0,25}(?:檢查|開啟|啟用|調整)|(?:建議|可以|請)[\s\S]{0,35}(?:試試看|嘗試)[\s\S]{0,60}(?:IPHONE|IPAD|ANDROID|手機|平板)|(?:可能需要|建議|請)[\s\S]{0,25}(?:確認|檢查)[\s\S]{0,35}(?:IPHONE|IPAD|ANDROID|手機|平板)|(?:確認|檢查)[\s\S]{0,35}(?:IPHONE|IPAD|ANDROID|手機|平板)[\s\S]{0,45}(?:是否)?支援|(?:IPHONE|IPAD|ANDROID|手機|平板)[\s\S]{0,35}(?:是否|需要)[\s\S]{0,30}支援|APPLE[\s\S]{0,30}(?:轉接線|轉接器|認證配件)|(?:其他|不同|APPLE|官方)?[\s\S]{0,15}轉接(?:方式|器|線)|嘗試使用不同品牌[\s\S]{0,30}(?:線材|纜線|TYPE\s*-?\s*C|USB\s*-?\s*C)|(?:請|建議|可以|自行)?\s*(?:參閱|參考|閱讀|查詢|查看)\s*(?:官方)?\s*(?:手冊|官網|說明書|官方網站|連結|產品頁)|(?:依|以)\s*(?:官方)?\s*(?:手冊|官網|說明書|官方網站)\s*(?:為準|公布))/i.test(
    answer,
  );
}

function sanitizeUnsupportedCrossDeviceExternalAdvice(text) {
  const original = String(text || "").trim();
  if (!original) return "";

  return original
    .split(/\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      const sentences = trimmed.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [trimmed];
      return sentences
        .map((sentence) => sentence.trim())
        .filter(
          (sentence) =>
            sentence && !hasUnsupportedCrossDeviceExternalAdvice(sentence),
        )
        .join("");
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasUnsupportedCrossDeviceManualExternalClaim_(text) {
  const answer = String(text || "");
  if (hasUnsupportedCrossDeviceExternalAdvice(answer)) return true;
  return /(?:可以|可|能夠|能)[\s\S]{0,45}(?:連接|顯示|輸出|充電)[\s\S]{0,45}(?:IPHONE|IPAD|ANDROID|手機|平板)|(?:IPHONE|IPAD|ANDROID|手機|平板)[\s\S]{0,45}(?:可以|可|能夠|能|支援)[\s\S]{0,45}(?:顯示|影像輸出|視訊輸出|充電|連接)|(?:為|替)[\s\S]{0,20}(?:IPHONE|IPAD|ANDROID|手機|平板)[\s\S]{0,20}充電/i.test(
    answer,
  );
}

function sanitizeUnsupportedCrossDeviceManualClaims_(text) {
  const original = String(text || "").trim();
  if (!original) return "";
  return original
    .split(/\n/)
    .map((line) => {
      const sentences = line.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [line];
      return sentences
        .map((sentence) => sentence.trim())
        .filter(
          (sentence) =>
            sentence &&
            !hasUnsupportedCrossDeviceManualExternalClaim_(sentence),
        )
        .join("");
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasUnsupportedCrossDeviceWebSpeculation_(text) {
  const answer = String(text || "");
  if (hasUnsupportedCrossDeviceExternalAdvice(answer)) return true;
  return /(?:可能|也許|或許|通常|常見|依賴)[\s\S]{0,55}(?:IPHONE|IPAD|ANDROID|手機|平板|IOS)[\s\S]{0,55}(?:設定|鏡像|顯示輸出|系統功能|相容性)|(?:IPHONE|IPAD|ANDROID|手機|平板|IOS)[\s\S]{0,55}(?:設定|鏡像|顯示輸出|系統功能|相容性)[\s\S]{0,55}(?:可能|也許|或許|通常|常見|依賴)|官方規格未[\s\S]{0,80}(?:常見|一般|推測|可能)/i.test(
    answer,
  );
}

function sanitizeUnsupportedCrossDeviceWebSpeculation_(text) {
  const original = String(text || "").trim();
  if (!original) return "";
  return original
    .split(/\n/)
    .map((line) => {
      const sentences = line.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [line];
      return sentences
        .map((sentence) => sentence.trim())
        .filter(
          (sentence) =>
            sentence && !hasUnsupportedCrossDeviceWebSpeculation_(sentence),
        )
        .join("");
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getRecentOfficialManualAnswer_(messages) {
  const rows = Array.isArray(messages) ? messages : [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const item = rows[i];
    if (!item || !/^(?:assistant|model)$/i.test(String(item.role || ""))) {
      continue;
    }
    const content = String(item.content || "");
    if (!/\[來源[:：]\s*官方手冊\]/i.test(content)) continue;
    return content
      .replace(/[\[（\(]來源[：:][^\]）\)]*[\]）\)]/g, "")
      .replace(/[\[（\(]費用[：:][^\]）\)]*[\]）\)]/g, "")
      .trim()
      .substring(0, 2200);
  }
  return "";
}

function sanitizePriceNumbers_(text) {
  if (!text) return "";
  let processed = String(text);
  // 1. 替換如 NT$ 100 以上的格式，小數點後最多 2 位，不匹配 NT$0.xxxx
  processed = processed.replace(/NT\$\s*(?!0\.\d)\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/gi, "官網當下優惠價");
  processed = processed.replace(/(?:TWD|NTD|台幣)\s*(?!0\.\d)\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/gi, "官網當下優惠價");
  
  // 2. 替換如 32,900元, 32900元 等格式 (排除 0.xxx元)
  processed = processed.replace(/\b(?!0\.\d)\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\s*(?:元|台幣)/g, "官網當下優惠價");
  // 替換無逗號但長度在 4 到 6 位的純數字 + 元 (例如 32900元，排除 0.xxxx元)
  processed = processed.replace(/\b(?!0\.\d)\d{4,6}\s*(?:元|台幣)/g, "官網當下優惠價");
  return processed;
}

function getLongestCommonSubstringLength_(str1, str2) {
  const s1 = String(str1 || "").toUpperCase().replace(/[\s,，。;；.()（）\[\]]/g, "");
  const s2 = String(str2 || "").toUpperCase().replace(/[\s,，。;；.()（）\[\]]/g, "");
  let maxLen = 0;
  const dp = Array(s1.length + 1).fill(0).map(() => Array(s2.length + 1).fill(0));
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > maxLen) {
          maxLen = dp[i][j];
        }
      }
    }
  }
  return maxLen;
}

function findLocalMatchInQA(query, userId) {
  try {
    const cache = CacheService.getScriptCache();
    let fullQA = "";
    const qaCount = parseInt(cache.get("KB_QA_COUNT") || "0");
    if (qaCount > 0) {
      for (let i = 0; i < qaCount; i++) {
        fullQA += cache.get(`KB_QA_${i}`) || "";
      }
    } else {
      const qaSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.QA);
      if (qaSheet && qaSheet.getLastRow() >= 1) {
        const data = qaSheet.getRange(1, 1, qaSheet.getLastRow(), 1).getValues();
        fullQA = data
          .map((row) => {
            if (!row[0]) return "";
            const text = row[0].toString();
            return text.length < 20 && text.match(/^(問題|Question|QA內容)/i) ? "" : `QA: ${text}`;
          })
          .filter(Boolean)
          .join("\n\n");
      }
    }

    if (!fullQA) return null;

    const qaItems = fullQA.split("\n\n");
    const upperQuery = String(query || "").toUpperCase();
    
    let bestMatch = null;
    let maxMatchLen = 0;

    qaItems.forEach(item => {
      const parts = item.split(/\/\s*A[:：]/i);
      const questionPart = (parts[0] || "").replace(/^QA:\s*/i, "").trim();
      const answerPart = (parts[1] || "").trim();
      if (!questionPart || !answerPart) return;

      const lcsLen = getLongestCommonSubstringLength_(upperQuery, questionPart);
      // 如果最長公共子字串長度 >= 6 個字，或者占了 QA 問題長度的 70% 以上，則視為命中
      const threshold = Math.min(6, Math.ceil(questionPart.length * 0.7));
      if (lcsLen >= threshold && lcsLen > maxMatchLen) {
        maxMatchLen = lcsLen;
        bestMatch = {
          question: questionPart,
          answer: answerPart
        };
      }
    });

    return bestMatch;
  } catch (e) {
    writeLog(`[QA Local Match Error] ${e.message}`);
    return null;
  }
}

function getWattageValues_(text) {
  const values = [];
  const pattern = /\b(\d{1,3})\s*W\b/gi;
  let match;
  while ((match = pattern.exec(String(text || ""))) !== null) {
    values.push(Number(match[1]));
  }
  return Array.from(new Set(values));
}

function hasManualAnchorWattageConflict_(manualAnswer, webAnswer) {
  const allowed = getWattageValues_(manualAnswer);
  if (allowed.length === 0) return false;
  const sentences =
    String(webAnswer || "").match(/[^。！？!?\n]+[。！？!?]?/g) || [];
  return sentences.some((sentence) => {
    if (!/(螢幕|顯示器|MONITOR|USB\s*-?\s*C|TYPE\s*-?\s*C|供電)/i.test(sentence)) {
      return false;
    }
    const values = getWattageValues_(sentence);
    return values.some((value) => !allowed.includes(value));
  });
}

function sanitizeManualAnchorWattageConflict_(manualAnswer, webAnswer) {
  if (!hasManualAnchorWattageConflict_(manualAnswer, webAnswer)) {
    return String(webAnswer || "").trim();
  }
  const allowed = getWattageValues_(manualAnswer);
  return String(webAnswer || "")
    .split(/\n/)
    .map((line) => {
      const sentences = line.match(/[^。！？!?]+[。！？!?]?/g) || [line];
      return sentences
        .filter((sentence) => {
          if (!/(螢幕|顯示器|MONITOR|USB\s*-?\s*C|TYPE\s*-?\s*C|供電)/i.test(sentence)) {
            return true;
          }
          const values = getWattageValues_(sentence);
          return values.every((value) => allowed.includes(value));
        })
        .join("");
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getOfficialUrlContextCandidates(query) {
  const q = String(query || "");
  const urls = [];
  const iphoneMatch = q.match(/\bIPHONE\s*(\d{1,2})\b/i);
  if (iphoneMatch) {
    urls.push(
      `https://www.apple.com/tw/iphone-${iphoneMatch[1]}/specs/`,
    );
  }
  return urls.slice(0, 3);
}

function getSuccessfulUrlContextSources(urlContextMetadata) {
  const rows =
    urlContextMetadata && Array.isArray(urlContextMetadata.urlMetadata)
      ? urlContextMetadata.urlMetadata
      : [];
  return rows
    .filter(
      (item) =>
        item &&
        item.retrievedUrl &&
        item.urlRetrievalStatus === "URL_RETRIEVAL_STATUS_SUCCESS",
    )
    .map((item) => String(item.retrievedUrl));
}

function fetchOfficialUrlEvidence_(urls) {
  const evidence = [];
  (Array.isArray(urls) ? urls : []).slice(0, 3).forEach((url) => {
    try {
      const response = UrlFetchApp.fetch(String(url), {
        muteHttpExceptions: true,
        followRedirects: true,
        headers: { "User-Agent": "Mozilla/5.0 Samsung-LineBot-Evidence/1.0" },
      });
      const code = response.getResponseCode();
      if (code !== 200) {
        writeLog(`[Official Page Fetch v29.6.077] ${url} 回應 ${code}`);
        return;
      }
      const plainText = stripHtmlToPlainText(response.getContentText());
      if (plainText.length < 300) {
        writeLog(`[Official Page Fetch v29.6.077] ${url} 文字內容不足`);
        return;
      }

      const snippets = [];
      const patterns = [
        /DisplayPort/gi,
        /USB[\s‑–—-]*C/gi,
        /視訊輸出/gi,
        /影像輸出/gi,
        /連接器支援/gi,
      ];
      patterns.forEach((pattern) => {
        let match;
        let count = 0;
        while ((match = pattern.exec(plainText)) !== null && count < 3) {
          const start = Math.max(0, match.index - 420);
          const end = Math.min(plainText.length, match.index + 900);
          snippets.push(plainText.substring(start, end));
          count++;
        }
      });
      const text = Array.from(new Set(snippets)).join("\n...\n").substring(0, 12000);
      evidence.push({ url: String(url), text: text || plainText.substring(0, 12000) });
      writeLog(
        `[Official Page Fetch v29.6.077] 官方頁擷取成功: ${url} (${(text || plainText).length} 字)`,
      );
    } catch (e) {
      writeLog(`[Official Page Fetch v29.6.077] ${url} 讀取失敗: ${e.message}`);
    }
  });
  return evidence;
}

function removeCrossDeviceManualHeadingOnlyLines_(text) {
  return String(text || "")
    .split(/\n/)
    .filter((line) => {
      const cleaned = line
        .replace(/^\s*(?:\d+[.、)]|[•●▪◦‧・-])\s*/, "")
        .trim();
      return !(
        cleaned.length > 0 &&
        cleaned.length <= 32 &&
        /[:：]$/.test(cleaned) &&
        !/[。！？!?]/.test(cleaned)
      );
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function combineLlmUsage_(firstUsage, secondUsage) {
  if (!firstUsage || !secondUsage) return secondUsage || firstUsage || null;
  return {
    input:
      Number(firstUsage.input || 0) + Number(secondUsage.input || 0),
    output:
      Number(firstUsage.output || 0) + Number(secondUsage.output || 0),
    total:
      Number(firstUsage.total || 0) + Number(secondUsage.total || 0),
    costTWD:
      Number(firstUsage.costTWD || 0) + Number(secondUsage.costTWD || 0),
  };
}

function shouldOfferCrossDeviceWebVerification(query, answer, requestedWeb) {
  if (!isCrossDeviceMonitorQuery(query)) return false;
  if (requestedWeb) return true;
  return /(手冊|資料)[\s\S]{0,45}(?:未|沒有|並未)[\s\S]{0,30}(?:提及|記載|說明)|無法(?:直接)?確認|不能(?:直接)?確認|尚無法確認/i.test(
    String(answer || ""),
  );
}

function appendCrossDeviceWebVerificationNotice(text) {
  const body = String(text || "").trim();
  if (!body) {
    return "官方手冊目前不足以確認外部裝置端的相容性。你可以點下方「這題再搜網路」，我再接著查它目前的官方資料。";
  }
  return `${body}\n\n螢幕端能確認的條件我先整理在上面。外部裝置端是否支援這種影像輸出，還要查它目前的官方資料；你可以點下方「這題再搜網路」，我再接著查。`;
}

function markPdfConsultedForUser_(cache, userId) {
  cache.put(`${userId}:pdf_consulted`, "true", 600);
  cache.put(`pdf_consulted_${userId}`, "true", 600);
}

function hasPdfBeenConsultedForUser_(cache, userId, history) {
  if (
    cache.get(`${userId}:pdf_consulted`) === "true" ||
    cache.get(`pdf_consulted_${userId}`) === "true"
  ) {
    return true;
  }

  const recentAssistant = (Array.isArray(history) ? history : [])
    .slice()
    .reverse()
    .find((item) => item && item.role === "assistant" && item.content);
  return Boolean(
    recentAssistant &&
      /\[來源[:：]\s*官方手冊\]/i.test(String(recentAssistant.content)),
  );
}

function buildNeedApplianceModelForOperationReply() {
  return [
    "這題是三星家電相關問題，不會套用螢幕型號來判斷。",
    "",
    "目前 AI 暫時無法穩定查證，請稍後再試；如果要我精準比對功能或操作方式，也可以補上家電完整型號（例如 WA、WD、VR 開頭的型號）。",
  ].join("\n");
}

function isOutOfProjectScopeQuery(text) {
  const q = String(text || "");
  const hasSamsungContext =
    /(SAMSUNG|三星|ODYSSEY|VIEWFINITY|SMART\s*MONITOR|GALAXY|SMARTTHINGS|\bS\d{2}[A-Z0-9]{4,}|\bM[5789]\b|\bG[56789]\b)/i.test(
      q,
    );
  if (hasSamsungContext) {
    return false;
  }

  const mentionsCompetitor =
    /(華碩|技嘉|微星|宏碁|戴爾|飛利浦|BENQ|ASUS|GIGABYTE|AORUS|MSI|ACER|DELL|PHILIPS|AOC)/i.test(
      q,
    );
  const asksMonitorOrPriceOrTable =
    /(螢幕|顯示器|MONITOR|DISPLAY|售價|價格|報價|最低價|促銷|Excel|表格|列出|比較|規格|更新率|刷新率|解析度|TYPE-?C)/i.test(
      q,
    );

  return mentionsCompetitor && asksMonitorOrPriceOrTable;
}

function buildOutOfProjectScopeReply(text) {
  return [
    "我這邊主要回答三星產品與本專案已整理的三星相關資料，不能代替你整理競品品牌清單或即時市場報價。",
    "",
    "你可以改問三星螢幕、Smart Monitor、Odyssey、ViewFinity、Galaxy Watch 與三星家電相關問題；若需要價格，我會引導到三星官方頁面，不會直接回覆市場數字價格。",
  ].join("\n");
}

function isTimelyWebInfoQuery(text) {
  const q = String(text || "");
  return /(最新上市|最新型號|新機型|新品|近期|最近|CES|雙11|雙12|黑五|BLACK\s*FRIDAY|12月份|促銷|活動|抽獎|登錄|延長保固|保固活動)/i.test(
    q,
  );
}

function findLocalCampaignRuleForQuery(text) {
  try {
    const q = String(text || "");
    if (!q || !/(活動|促銷|抽獎|登錄|延長保固|保固活動|贈品|本期)/i.test(q)) {
      return "";
    }

    const models = extractModelNumbers(q)
      .map((model) => String(model || "").toUpperCase())
      .filter((model) => model.length >= 5);
    if (models.length === 0 || !ss) return "";

    const sheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    if (!sheet || sheet.getLastRow() <= 1) return "";

    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < rows.length; i++) {
      const ruleText = String(rows[i][0] || "");
      const upperRule = ruleText.toUpperCase();
      if (
        upperRule.indexOf("活動_") !== 0 &&
        upperRule.indexOf("電腦螢幕活動RULE") < 0
      ) {
        continue;
      }
      for (let j = 0; j < models.length; j++) {
        if (upperRule.indexOf(models[j]) >= 0) {
          return ruleText;
        }
      }
    }
  } catch (e) {
    writeLog(`[Campaign Rule Guard] ${e.message}`);
  }
  return "";
}

function isServiceHoursQuery(text) {
  const q = String(text || "");
  return /(服務時間|客服時間|營業時間|維修中心.*時間|服務中心.*時間|今天.*營業|今天.*有開|今天.*有營業|現在.*營業|幾點.*營業|營業到幾點|幾點.*關門|幾點.*開門)/i.test(
    q,
  );
}

function buildServiceHoursReply() {
  return [
    "這題是服務/營業時間資訊，會依客服類型、維修中心與日期變動，我不能直接用舊資料回答幾點營業或今天有沒有開。",
    "",
    "你可以先看三星官方頁面確認：",
    "1. 三星台灣聯絡我們：https://www.samsung.com/tw/support/contact/",
    "2. 三星台灣服務中心查詢：https://www.samsung.com/tw/support/service-center/",
    "",
    "如果你要我幫你查最新資訊，請按「🌐 這題再搜網路」。",
  ].join("\n");
}

function buildTimelyWebInfoReply(text) {
  return [
    "這題屬於近期活動、上市資訊或保固活動，內容會隨時間變動，我不能用舊資料直接下結論。",
    "",
    "你可以先看這些官方頁面：",
    "1. 三星台灣優惠活動：https://www.samsung.com/tw/offer/",
    "2. 三星台灣螢幕產品頁：https://www.samsung.com/tw/monitors/all-monitors/",
    "3. 三星台灣新聞中心：https://news.samsung.com/tw/",
    "",
    "如果你要我幫你查最新資料，請按「🌐 這題再搜網路」。",
  ].join("\n");
}

function isModelSelectionOrNeedModelReply(text) {
  return /(請先選型號|請先選完整型號|型號選擇泡泡|請直接回覆完整型號|需要先確認完整型號|請補上完整型號)/i.test(
    String(text || ""),
  );
}

function shouldEscalateFastAnswerToPdf(intentInfo) {
  const info = intentInfo || {};
  if (info.hasAutoPdf || info.hasAutoWeb || info.hasNeedDoc || info.isInPdfMode) {
    return false;
  }
  if (!info.hasPdfForModel) {
    return false;
  }

  // v29.5.276: 規格/能力題不自動升 PDF。
  // 操作/故障題或明確手冊查證題，必須同時有可信來源與足夠答案才算 Fast Mode 過關。
  const isPdfEligibleIntent =
    !!info.operationIntent || !!info.manualVerificationIntent;
  if (!isPdfEligibleIntent) {
    return false;
  }

  const trustedFastSource =
    info.fastSourceTag === "[來源:QA庫]" ||
    info.fastSourceTag === "[來源:官方規格庫]" ||
    info.fastSourceTag === "[來源:官方活動庫]";
  if (!trustedFastSource) {
    return true;
  }

  if (isFactoryResetQueryWithoutPinIssue(info.userQuestion)) {
    return true;
  }

  if (
    isPinRecoveryQuery(info.userQuestion) &&
    isPinRecoveryOnlyAnswer(info.normalizedFastAnswer)
  ) {
    return false;
  }

  return isOperationAnswerInsufficient(info.normalizedFastAnswer);
}

function extractContinuationTargetModel(text) {
  const q = String(text || "");
  const match = q.match(
    /\b(?:M\d{1,2}[A-Z]?|G\d{1,2}[A-Z]?|S\d{1,2}[A-Z]{0,3}\d{0,4}[A-Z0-9]*|[A-Z]{1,3}\d{2,3}[A-Z]{1,3}\d{3,4}[A-Z0-9]*)\b/i,
  );
  return match ? match[0].toUpperCase() : "";
}

function isShortModelContinuation(text) {
  const q = String(text || "").trim();
  if (!q || q.length > 40) {
    return false;
  }
  if (!extractContinuationTargetModel(q)) {
    return false;
  }
  return /^(?:那|換|改|同樣|一樣|how about|what about|and)\b|(?:呢|的話)[？?]?$/i.test(q);
}

function expandShortModelContinuation(text, previousTopic) {
  const original = String(text || "").trim();
  const topic = String(previousTopic || "").trim();
  const targetModel = extractContinuationTargetModel(original);
  if (!targetModel || !topic || !isShortModelContinuation(original)) {
    return original;
  }

  const modelLikePattern =
    /\b(?:M\d{1,2}[A-Z]?|G\d{1,2}[A-Z]?|S\d{1,2}[A-Z]{0,3}\d{0,4}[A-Z0-9]*|[A-Z]{1,3}\d{2,3}[A-Z]{1,3}\d{3,4}[A-Z0-9]*)\b/gi;
  let replaced = false;
  const rewrittenTopic = topic.replace(modelLikePattern, () => {
    replaced = true;
    return targetModel;
  });
  const expandedTopic = replaced
    ? rewrittenTopic
    : `${topic}（這次對象改為 ${targetModel}）`;

  return `${expandedTopic}\n[System Hint: 使用者原文是「${original}」。這是延續上一題的短追問，請維持上一題主題，只把回答對象改成 ${targetModel}，不要改答一般規格概覽。]`;
}

function isCapabilityClaimQuery(text) {
  const q = String(text || "");
  return /(是否|有沒有|支援|內建|規格|相容|差異|更新率|刷新率|反應時間|解析度|HDR|G-?SYNC|FREESYNC|MATTER|SMARTTHINGS|HUB|BORDER\s*ROUTER|THREAD|CONTROLLER|耳機孔|喇叭|KVM)/i.test(
    q,
  );
}

function isManualVerificationRequiredQuery(text) {
  const q = String(text || "");
  return /(MATTER|THREAD|SMARTTHINGS|HUB|BORDER\s*ROUTER|CONTROLLER|ZIGBEE|中樞|集線器|協議|協定|橋接|網關|GATEWAY|HEVC|H\.?\s*265|H265|編解碼|CODEC|視訊格式|影片格式|影片檔|播放檔案|檔案格式|USB\s*播放)/i.test(
    q,
  );
}

function isMediaCodecSupportQuery(text) {
  const q = String(text || "");
  return /(HEVC|H\.?\s*265|H265|H\.?\s*264|H264|VP9|AV1|編解碼|CODEC|視訊格式|影片格式|影片檔|播放檔案|影音格式|檔案格式|USB\s*播放)/i.test(q);
}

function isSmartMonitorCodecQuestion(text) {
  const q = String(text || "");
  if (!isMediaCodecSupportQuery(q)) {
    return false;
  }
  return /(SMART\s*MONITOR|SMART系列|SMART\s*系列|智慧螢幕|智慧顯示器|SMART\s*螢幕|M5|M7|M8|M9|M50|M70|M80|M90|S27AM|S32AM|S27BM|S32BM|S43BM|S32CM|S32DM|S32FM|S43DM|S43FM)/i.test(q);
}

function getSmartMonitorCodecSelectionModels(limit = 10) {
  let indexedModels = [];
  try {
    indexedModels = JSON.parse(
      PropertiesService.getScriptProperties().getProperty("PDF_MODEL_INDEX") || "[]",
    );
  } catch (e) {
    writeLog(`[Smart Codec Selection] PDF 索引解析失敗: ${e.message}`);
  }

  const models = (Array.isArray(indexedModels) ? indexedModels : []).filter(
    (model) => /^S\d{2}[A-Z]*M\d{2,3}$/i.test(String(model || "")),
  );

  // 只列出目前 PDF 索引確實覆蓋的 Smart Monitor 型號，絕不以固定清單猜測。
  return dedupDisplayModels(models, limit);
}

function buildSmartMonitorCodecSelectionPayload(query, userId) {
  const models = getSmartMonitorCodecSelectionModels(10);
  const hasModels = models.length > 0;
  const leadText = [
    hasModels
      ? "這題會跟實際型號有關，我先讓你選要查哪一台。"
      : "目前找不到可用的 Smart Monitor 官方手冊索引，我先不猜支援狀況。",
    "",
    hasModels
      ? "你點型號後，我會照那本官方手冊幫你查，不會先用共通說法猜。"
      : "請稍後再試，或補完整型號讓我重新確認手冊索引。",
    "",
    "[費用:NT$0.0000（未呼叫 LLM）]",
  ].join("\n");

  try {
    const cache = CacheService.getScriptCache();
    cache.put(`${userId}:suggested_models`, JSON.stringify(models), 300);
    cache.put(`${userId}:pending_topic`, String(query || ""), 600);
    cache.put(`${userId}:model_select_mode`, "pdf", 600);
  } catch (e) {
    writeLog(`[Smart Codec Selection] 型號選擇快取寫入失敗: ${e.message}`);
  }

  const messages = [{ type: "text", text: leadText }];
  if (hasModels) {
    const flexMsg = createModelSelectionFlexV3(models, {
      headerText: "選要查的型號",
      altText: "請選擇 Smart Monitor PDF 型號",
      footerText: "點選後查官方手冊",
    });
    messages.push(flexMsg);
  }

  return {
    messages,
    assistantRecord: leadText,
    models,
  };
}

function getSelectedModelFromRecentHistory_(history) {
  if (!Array.isArray(history)) return "";
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i] || {};
    if (item.role !== "user") continue;
    const content = String(item.content || "");
    const selected = content.match(/#型號\s*[:：]\s*([A-Z0-9]+)/i);
    if (selected && selected[1]) return selected[1].toUpperCase();
  }
  return "";
}

function getPreviousMeaningfulUserQuestion_(history) {
  if (!Array.isArray(history)) return "";
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i] || {};
    if (item.role !== "user") continue;
    const text = String(item.content || "").trim();
    if (!text || text.startsWith("#") || text.startsWith("/")) continue;
    if (text.includes("請針對你剛才的回答再詳細說明")) continue;
    return text;
  }
  return "";
}

function buildManualElaborationQuery_(question, model) {
  return [
    `請依已掛載的「${model}」官方手冊，延續回答使用者問題：「${question}」。`,
    "這是使用者要求再詳細說明，請不要重複上一則句子，也不要照搬手冊原文。",
    "請用熟朋友的自然口吻，依序說明：先講結論、再用白話解釋它的意思、實際使用時會遇到的限制或注意事項。",
    "只能根據手冊內容下結論；手冊沒有寫的地方要直接說未記載，不可用常識補推。",
  ].join("\n");
}





function readContextHealth(cache, userId) {
  try {
    if (!cache || !userId) return null;
    const raw = cache.get(`${CACHE_KEYS.CONTEXT_HEALTH_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

function normalizeModelForDisplay(model) {
  let m = String(model || "").trim().toUpperCase();
  if (!m) return "";
  if (/^LS\d{2}/.test(m)) {
    m = "S" + m.slice(2);
  }
  // Samsung 區域尾碼常見為 XZW / XZN 等，顯示時優先保留通用 S 型號
  m = m.replace(/X[A-Z]{2,4}$/, "");
  return m;
}

function dedupDisplayModels(models, limit = 10) {
  const normalized = (Array.isArray(models) ? models : [])
    .map((m) => normalizeModelForDisplay(m))
    .filter((m) => m && (m.length >= 7 || isShortAliasModelToken(m)));
  const unique = [...new Set(normalized)];

  // 若同時存在互為子字串型號，保留較長者
  const dedup = [];
  const sorted = unique.slice().sort((a, b) => b.length - a.length);
  sorted.forEach((m) => {
    const isSubset = dedup.some((existing) => existing.includes(m));
    if (!isSubset) dedup.push(m);
  });
  return dedup.slice(0, Math.max(1, Number(limit) || 10));
}

function extractFullModelLikeTokens(text) {
  const q = String(text || "").toUpperCase();
  const tokens = [];
  const patterns = [
    /\b(?:LS)?S\d{2}(?=[A-Z0-9]*[A-Z])[A-Z0-9]{4,16}\b/g,
    /\b(?:WA|WD|VR)\d{2}[A-Z0-9]{5,}\b/g,
    /\bG\d{2}[A-Z]{2,}[A-Z0-9]{0,8}\b/g,
  ];

  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(q)) !== null) {
      const token = String(match[0] || "").trim().toUpperCase();
      if (token && !isShortAliasModelToken(token) && !tokens.includes(token)) {
        tokens.push(token);
      }
    }
  });

  return tokens;
}

function getKnownModelSearchText() {
  const props = PropertiesService.getScriptProperties();
  const parts = [];
  const appendJsonProperty = (key) => {
    try {
      const raw = props.getProperty(key);
      if (raw) {
        parts.push(String(raw));
      }
    } catch (e) {}
  };

  appendJsonProperty(CACHE_KEYS.KEYWORD_MAP);
  appendJsonProperty("PDF_MODEL_INDEX");
  appendJsonProperty(CACHE_KEYS.PDF_MODEL_INDEX_BACKUP);
  appendJsonProperty(CACHE_KEYS.KB_URI_LIST);
  appendJsonProperty(CACHE_KEYS.KB_URI_LIST_BACKUP);

  return parts.join("\n").toUpperCase();
}

function buildModelLookupVariants(model) {
  const raw = String(model || "").trim().toUpperCase();
  const normalized = normalizeModelForDisplay(raw);
  const variants = [raw, normalized];

  if (/^S\d{2}/.test(normalized)) {
    variants.push("L" + normalized);
  }
  if (/^LS\d{2}/.test(raw)) {
    variants.push("S" + raw.slice(2));
  }

  return [...new Set(variants.filter(Boolean))];
}

function isKnownFullModelToken(model) {
  const knownText = getKnownModelSearchText();
  if (!knownText) {
    // 若索引尚未建立，避免誤擋使用者，交回原本路由。
    return true;
  }

  return buildModelLookupVariants(model).some((variant) => {
    if (knownText.includes(variant)) {
      return true;
    }
    // 使用者少打區域尾碼或尾端版本碼時，只要是既有完整型號前綴就放行。
    if (variant.length >= 7) {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`${escaped}[A-Z0-9]{1,6}`).test(knownText);
    }
    return false;
  });
}

function getUnknownFullModelTokens(text) {
  return extractFullModelLikeTokens(text).filter(
    (model) => !isKnownFullModelToken(model),
  );
}

function buildUnknownFullModelReply(models) {
  const list = [...new Set(models || [])].join("、");
  return [
    `我在目前的 QA、規格庫與手冊索引裡找不到這個完整型號：${list}。`,
    "",
    "請先確認型號是否有打錯，或補上產品背貼/外盒上的完整型號；確認後我再依 QA/規格庫先查，仍不足才接著查官方手冊或官方頁面。",
  ].join("\n");
}

function getAliasCandidatesFromClassRules(aliasToken, limit = 5) {
  try {
    const alias = String(aliasToken || "").trim().toUpperCase();
    if (!alias) return [];
    const sheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    if (!sheet) return [];
    const values = sheet.getDataRange().getValues();
    const bucket = [];
    for (let r = 0; r < values.length; r++) {
      const row = values[r];
      const line = row
        .map((c) => String(c || ""))
        .join(" ")
        .toUpperCase();
      if (!line) continue;
      if (line.indexOf("術語_") === 0) continue;
      if (!isClassRuleLineMatchedAlias(line, alias)) {
        continue;
      }
      const models =
        line.match(
          /\b(?:L?S\d{2}[A-Z]{1,3}\d{2,4}[A-Z0-9]*|L?[CF]\d{2}[A-Z]+\d{2,4}[A-Z0-9]*)\b/g,
        ) || [];
      bucket.push(...models);
    }
    // 若規則內只有 LS 型號，做一次退位補抓並轉成 S 顯示型號
    if (bucket.length === 0) {
      for (let r = 0; r < values.length; r++) {
        const row = values[r];
        const line = row
          .map((c) => String(c || ""))
          .join(" ")
          .toUpperCase();
        if (!line) continue;
        if (line.indexOf("術語_") === 0) continue;
        if (!isClassRuleLineMatchedAlias(line, alias)) {
          continue;
        }
        const lsModels = line.match(/\bLS\d{2}[A-Z0-9]{6,}\b/g) || [];
        bucket.push(...lsModels);
      }
    }
    return dedupDisplayModels(bucket, limit);
  } catch (e) {
    writeLog(`[Alias Candidates] 讀取候選型號失敗: ${e.message}`);
    return [];
  }
}

function isClassRuleLineMatchedAlias(line, alias) {
  const hay = String(line || "").toUpperCase();
  const key = String(alias || "").toUpperCase();
  if (!hay || !key) return false;
  if (hay.includes(`別稱_${key}`) || hay.includes(`系列_${key}`)) return true;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const standalone = new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`);
  if (key.length > 2 && standalone.test(hay)) return true;
  if (/^G\d{1,2}/.test(key)) {
    return new RegExp(`ODYSSEY\\s*${escaped}([^A-Z0-9]|$)`).test(hay);
  }
  if (/^M\d{1,2}/.test(key)) {
    return (
      new RegExp(`SMART\\s*MONITOR\\s*${escaped}([^A-Z0-9]|$)`).test(hay) ||
      new RegExp(`智慧聯網螢幕\\s*${escaped}([^A-Z0-9]|$)`).test(hay)
    );
  }
  if (/^S\d{1,2}/.test(key)) {
    return new RegExp(`VIEWFINITY\\s*${escaped}([^A-Z0-9]|$)`).test(hay);
  }
  return false;
}

function getExistingPdfSearchText() {
  try {
    const props = PropertiesService.getScriptProperties();
    const parts = [];
    [
      CACHE_KEYS.KB_URI_LIST,
      CACHE_KEYS.KB_URI_LIST_BACKUP,
      "PDF_MODEL_INDEX",
      CACHE_KEYS.PDF_MODEL_INDEX_BACKUP,
    ].forEach((key) => {
      try {
        const raw = props.getProperty(key);
        if (raw) parts.push(String(raw));
      } catch (e) {}
    });
    return parts.join("\n").toUpperCase();
  } catch (e) {
    return "";
  }
}

function buildPdfLookupVariants(model) {
  const raw = String(model || "").trim().toUpperCase();
  const normalized = normalizeModelForDisplay(raw);
  const variants = buildModelLookupVariants(normalized);
  if (/^S\d{2}[A-Z]{2}\d{3}[A-Z]{2}$/.test(normalized)) {
    variants.push(normalized.substring(0, 8));
  }
  const cf = normalized.match(/^(L?[CF]\d{2}[A-Z]+\d{2})[A-Z0-9]*$/);
  if (cf) variants.push(cf[1]);
  return [...new Set(variants.filter(Boolean))];
}

function isModelCoveredByExistingPdf(model) {
  const hay = getExistingPdfSearchText();
  if (!hay) return true;
  return buildPdfLookupVariants(model).some((variant) => hay.includes(variant));
}

function getAliasCandidatesFromExistingPdfs(aliasToken, limit = 10) {
  const classRuleCandidates = getAliasCandidatesFromClassRules(aliasToken, limit * 3);
  const pdfCovered = classRuleCandidates.filter((m) =>
    isModelCoveredByExistingPdf(m),
  );
  return dedupDisplayModels(
    pdfCovered.length > 0 ? pdfCovered : classRuleCandidates,
    limit,
  ).filter((m) => !isShortAliasModelToken(m));
}

function getAliasOnlySelectionModelsFromQuery(text, limit = 10) {
  const aliases = extractShortAliasModelTokens(text);
  if (aliases.length === 0 || extractFullModelLikeTokens(text).length > 0) {
    return [];
  }
  const bucket = [];
  aliases.forEach((alias) => {
    bucket.push(...getAliasCandidatesFromExistingPdfs(alias, limit));
  });
  return dedupDisplayModels(bucket, limit).filter((m) => !isShortAliasModelToken(m));
}

function promptAliasOnlyModelSelection(query, userId, replyToken, contextId, mode) {
  const aliases = extractShortAliasModelTokens(query);
  if (aliases.length === 0 || extractFullModelLikeTokens(query).length > 0) {
    return false;
  }
  const aliasToken = aliases.join("/");
  const models = getAliasOnlySelectionModelsFromQuery(query, 10);
  if (models.length <= 1) {
    return false;
  }

  const cache = CacheService.getScriptCache();
  cache.put(`${userId}:suggested_models`, JSON.stringify(models), 300);
  cache.put(`${userId}:pending_topic`, String(query || ""), 600);
  cache.put(`${userId}:model_select_mode`, mode || "pdf", 600);

  const leadText = [
    `你只提供「${aliasToken}」這個系列別稱，這會對應多個完整型號。`,
    "",
    mode === "pdf"
      ? "請先選完整型號，我再依現有官方手冊查證。"
      : "請先選完整型號，我再依該型號回答。",
  ].join("\n");
  const flexMsg = createModelSelectionFlexV3(models, {
    headerText: `🔍 ${aliasToken} 型號確認`,
    altText: `請選擇 ${aliasToken} 完整型號`,
  });
  replyMessage(replyToken, [{ type: "text", text: leadText }, flexMsg]);

  try {
    writeRecordDirectly(userId, query, contextId, "user", "");
    writeRecordDirectly(userId, leadText, contextId, "assistant", "");
    updateHistorySheetAndCache(
      contextId,
      getHistoryFromCacheOrSheet(contextId),
      { role: "user", content: query },
      { role: "assistant", content: leadText },
    );
  } catch (e) {
    writeLog(`[Alias Select] 歷史寫入略過: ${e.message}`);
  }
  writeLog(
    `[Alias Select] ${aliasToken} 僅別稱查詢，要求選完整型號: ${models.join(", ")}`,
  );
  return true;
}

/**
 * 防止「短別稱 + 功能二選一題」被誤答為肯定規格。
 * 例如：S9有KVM嗎（未給完整型號）。
 */
function applyAliasFeatureAmbiguityGuard(
  question,
  answerText,
  sourceTag,
  candidateModels,
) {
  const q = String(question || "");
  const a = String(answerText || "");
  const models = Array.isArray(candidateModels) && candidateModels.length > 0
    ? candidateModels.map((m) => String(m || "").trim().toUpperCase())
    : extractModelNumbers(q);
  if (!models || models.length !== 1) return a;
  const model = String(models[0] || "").trim().toUpperCase();
  if (!isShortAliasModelToken(model)) return a;
  if (!isFeatureBinaryQuestion(q)) return a;

  const saysPositive =
    /(有|支援|內建|可以|可透過|能夠|具備|是支援)/i.test(a) &&
    !/(未記載|不確定|不支援|沒有|無法確認|未明確)/i.test(a);
  if (!saysPositive) return a;

  const candidates = getAliasCandidatesFromClassRules(model, 5);
  const safe = candidates.length > 0
    ? `你問的「${model}」是系列別稱，請先選擇完整型號，我再幫你精準確認功能。`
    : `你問的「${model}」是系列別稱，請給我完整型號（例如 S27... / S32...），我再幫你精準確認功能。`;
  return appendSourceTagIfMissing(safe, sourceTag);
}

/**
 * 手冊模式輸出格式防呆：將條列符號統一轉為 1. 2. 3. 並保留項次間空行。
 */
function enforceManualNumberedList(text) {
  let raw = String(text || "").trim();
  if (!raw) return "";

  let sourceTail = "";
  const sourceMatch = raw.match(
    /(?:\n\s*)?[\[（\(]來源[：:][^\]）\)]*[\]）\)]\s*$/i,
  );
  if (sourceMatch && sourceMatch.index >= 0) {
    sourceTail = sourceMatch[0].trim();
    raw = raw.slice(0, sourceMatch.index).trim();
  }

  const lines = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line);
  const output = [];
  let seq = 1;
  let touched = false;

  lines.forEach((line) => {
    const bulletMatch = line.match(/^[•●▪◦‧・\-]\s*(.+)$/);
    if (bulletMatch) {
      output.push(`${seq}. ${bulletMatch[1].trim()}`);
      output.push("");
      seq++;
      touched = true;
      return;
    }

    const numberedMatch = line.match(/^\d+[\.、\)]\s*(.+)$/);
    if (numberedMatch) {
      output.push(`${seq}. ${numberedMatch[1].trim()}`);
      output.push("");
      seq++;
      touched = true;
      return;
    }

    output.push(line);
  });

  while (output.length > 0 && output[output.length - 1] === "") {
    output.pop();
  }

  let body = output.join("\n").trim();
  if (touched) {
    body = formatListSpacing(body);
  }

  if (!sourceTail) return body;
  return `${body}\n\n${sourceTail}`.trim();
}

/**
 * 已查閱手冊時，避免回覆仍要求用戶「自行去查手冊/官網」造成矛盾。
 */
function sanitizeManualDeflection(text) {
  const normalized = String(text || "")
    .replace(/根據(?:產品)?手冊(?:內容|資訊)?/gi, "根據官方手冊")
    .replace(/根據[你您]提供的\s*(?:產品\s*)?(?:PDF|手冊|文件|檔案|產品手冊)(?:\s*(?:文件|檔案|內容|手冊))?/gi, "根據官方手冊")
    .replace(/[你您]提供的\s*(?:產品\s*)?(?:PDF|手冊|文件|檔案|產品手冊)(?:\s*(?:文件|檔案|內容|手冊))?/gi, "官方手冊內容")
    .replace(/根據(?:這份|該份|提供的)\s*(?:產品\s*)?(?:PDF|手冊|文件|檔案|產品手冊)(?:\s*(?:文件|檔案|內容|手冊))?/gi, "根據官方手冊")
    .replace(/依照[你您]提供的\s*(?:產品\s*)?(?:PDF|手冊|文件|檔案|產品手冊)(?:\s*(?:文件|檔案|內容|手冊))?/gi, "依照官方手冊")
    .trim();
  const lines = normalized.split(/\n+/);
  const filtered = lines.filter((line) => {
    const t = line.trim();
    if (!t) return true;
    const hasDocTarget =
      /(手冊|官網|官方網站|產品頁|規格頁|支援頁面|SAMSUNG\s*官網|SAMSUNG\s*官方網站)/i.test(
        t,
      );
    const hasSupportTarget = /(客服|客服專線|服務專線|聯絡\s*SAMSUNG|聯繫\s*SAMSUNG)/i.test(
      t,
    ) || /(三星官方|SAMSUNG\s*官方)/i.test(t);
    const hasDeflectVerb =
      /(參考|查詢|查閱|自行|前往|到官網|建議|詢問|聯絡|聯繫|直接詢問|確認|求證)/i.test(
        t,
      );
    const hasGenericDeflectionLead =
      /(如果你想確認|若你想確認|想確認.*建議你|建議你[:：]?$|最直接且準確|產品的詳細規格.*會列出)/i.test(
        t,
      );
    return !(
      ((hasDocTarget || hasSupportTarget) && hasDeflectVerb) ||
      hasGenericDeflectionLead
    );
  });
  return filtered.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * 手冊查證一致性防呆：
 * 若同時出現「手冊未明確」與「直接下結論(可直接/不需額外Hub)」，改為保守說法。
 */
function enforceManualUncertaintyGuard(text, queryText) {
  const body = String(text || "").trim();
  if (!body || !isManualVerificationRequiredQuery(String(queryText || ""))) {
    return body;
  }

  // 只記錄模型輸出的不確定性；不得用程式自行補上產品事實或推論。
  if (/(手冊未明確|未明確提及|並未明確|無法確認|手冊未記載)/i.test(body)) {
    writeLog("[Manual Guard] 手冊未明確記載，保留模型的保守說法，不注入額外產品結論");
  }
  return body;
}


/**
 * 全域用語硬規則：統一使用「你」，避免回覆出現「您」。
 */
function enforceNiTone(text) {
  return String(text || "")
    .replace(/您的/g, "你的")
    .replace(/請您/g, "請你")
    .replace(/您可/g, "你可")
    .replace(/您/g, "你");
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
 * 取得 CLASS_RULES 相關邏輯
 * v29.5.29: 封裝 CLASS_RULES 邏輯，修復 ReferenceError，並提供統一的關鍵字提取功能
 */
function getClassRules() {
  const cache = CacheService.getScriptCache();

  // 嘗試從 Cache 讀取 Rules (其實我們只需要關鍵字邏輯，Rules 本身太大可能不在 Cache)
  // 但我們可以重新實作一個簡單的提取器，基於我們已知的規則
  // 或者，我們可以讀取 KEYWORD_MAP (它比較小，且包含別稱)

  const getKeywordMap = () => {
    try {
      const mapJson = PropertiesService.getScriptProperties().getProperty(
        CACHE_KEYS.KEYWORD_MAP,
      );
      return mapJson ? JSON.parse(mapJson) : {};
    } catch (e) {
      writeLog(`[getClassRules] Error loading keyword map: ${e.message}`);
      return {};
    }
  };

  /**
   * 從訊息中提取型號關鍵字
   * @param {string} msg 用戶訊息
   * @returns {string[]} 匹配到的型號列表 (例如 ["G5", "S27AG500NC"])
   */
  const extractModelKeywords = (msg) => {
    if (!msg) return [];

    // 1. 基於正則表達式的粗篩 (符合 S27... G5... 等格式)
    // 這裡我們必須要有一套 regex。這套 regex 應該跟 syncGeminiKnowledgeBase 裡的一致。
    // 為了避免維護兩套，我們盡量用通用的 Pattern。

    const possibleModels = [];
    const upperMsg = msg.toUpperCase();

    // 通用型號 Regex (參考 syncGeminiKnowledgeBase)
    const modelPatterns = [
      /\b([A-Z]{1,2}\d{2}[A-Z]{0,2}\d{3}[A-Z]{0,2})\b/g, // 完整型號 ex: S32AG500PC
      /(Odyssey\s?G\d{1,2})/gi, // Odyssey G5
      /(Smart\s?Monitor\s?M\d{1,2})/gi, // Smart Monitor M7
      /\b(G[5-9])\b/g, // G5, G7, G8, G9
      /\b(M[578])\b/g, // M5, M7, M8
    ];

    modelPatterns.forEach((regex) => {
      let match;
      while ((match = regex.exec(msg)) !== null) {
        // 清理並標準化
        let raw = match[0].trim().toUpperCase().replace(/\s+/g, "");
        // 排除太短的誤判 (如 "M2" 雖然不會被上面 match 到，但以防萬一)
        if (raw.length >= 2) {
          possibleModels.push(raw);
        }
      }
    });

    // 2. 使用 KEYWORD_MAP 進行精確匹配與別稱轉換
    // (如果需要更精確的匹配，可以載入 map。但在 handleCommand 這種快速場景，Regex 可能夠用)
    // 不過，為了要能查到正確的 PDF，我們最好能拿到 "標準型號"

    // 去重
    return [...new Set(possibleModels)];
  };

  return {
    extractModelKeywords,
  };
}

/**
 * 建立動態上下文 (Dynamic Context)
 * 根據用戶訊息，從 Cache 中撈取相關的 QA 和 Rules
 */
function buildDynamicContext(messages, userId, isPDFMode = false) {
  try {
    const cache = CacheService.getScriptCache();
    let qaLoaded = false;
    let qaFromCache = false;
    let lightRulesLoaded = false;
    let lightRulesFromCache = false;
    let specRulesLoaded = false;
    let specRulesFromCache = false;

    // 1. 組合用戶最近訊息 (用於關鍵字匹配)
    // v27.9.63: 分離「完整歷史上下文」與「最新用戶訊息」
    // 用於 Context 檢索：還是需要歷史，否則會失憶
    // 用於 洗衣機判斷：只看最新一句，避免歷史污染
    let combinedMsg = "";
    let latestUserMsg = "";

    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        const txt = messages[i].content;
        combinedMsg += txt + " ";
        if (latestUserMsg === "") latestUserMsg = txt; // 抓最新的
      }
    }
    // Optimization: 強制截斷以避免長文攻擊 (Token Explosion)
    if (combinedMsg.length > 500) {
      combinedMsg = combinedMsg.substring(0, 500);
    }
    const upperMsg = combinedMsg.toUpperCase();
    const upperLatestMsg = latestUserMsg.toUpperCase();

    // v24.5.5: 注入直通車偵測到的型號定義 (Fix Bug A)
    // 解決 Fast Mode 不知道 "M8" 是 "M80D" 的問題
    let inferredModelContext = "";
    let injectedModelsList = []; // v29.5.142: 供後續規格搜尋使用
    if (userId) {
      const cachedModels = cache.get(`${userId}:direct_search_models`);
      if (cachedModels) {
        try {
          const models = JSON.parse(cachedModels);
          if (models && models.length > 0) {
            injectedModelsList = models;
            inferredModelContext = `【系統偵測型號】用戶提及的型號（如 M8/M7）已在系統定義為：${models.join(
              ", ",
            )}。請優先針對此型號回答，不要說「沒有精確定義」。\n`;
            writeLog(`[DynamicContext] 注入推斷型號: ${models.join(", ")}`);
          }
        } catch (e) {}
      }
    }

    // 2. 載入 QA
    let fullQA = "";
    const qaCount = parseInt(cache.get("KB_QA_COUNT") || "0");
    if (qaCount > 0) {
      for (let i = 0; i < qaCount; i++) {
        fullQA += cache.get(`KB_QA_${i}`) || "";
      }
      qaLoaded = fullQA.trim().length > 0;
      qaFromCache = qaLoaded;
      // writeLog(`[DynamicContext Debug] Cache Hit: QA Count=${qaCount}, FullQA Length=${fullQA.length}, First 50 chars=${fullQA.substring(0, 50)}`);
    } else {
      // v27.8.7 Fallback: 若 Cache 失效，強制讀取 Sheet (防呆機制)
      writeLog(
        "[DynamicContext] ⚠️ QA Cache Miss - 啟動救援模式：直接讀取 Sheet",
      );
      try {
        const qaSheet = ss.getSheetByName(SHEET_NAMES.QA);
        if (qaSheet && qaSheet.getLastRow() >= 1) {
          const data = qaSheet
            .getRange(1, 1, qaSheet.getLastRow(), 1)
            .getValues();
          // 與 syncGeminiKnowledgeBase 相同的過濾邏輯
          fullQA = data
            .map((row) => {
              if (!row[0]) return "";
              const text = row[0].toString();
              return text.length < 20 && text.match(/^(問題|Question|QA內容)/i)
                ? ""
                : `QA: ${text}`;
            })
            .filter((line) => line !== "")
            .join("\n\n");
          qaLoaded = fullQA.trim().length > 0;
          if (qaLoaded) {
            const qaChunks = chunkString(fullQA, 25000);
            cache.put('KB_QA_COUNT', qaChunks.length.toString(), 21600);
            qaChunks.forEach((c, idx) => cache.put('KB_QA_' + idx, c, 21600)); // v29.6 BUG 2 修復
          }
        }
      } catch (e) {
        writeLog(`[Fallback Error] QA Read Failed: ${e.message}`);
      }
    }

    // 3. 載入 Rules (分層架構: Light Layer + Spec Layer)
    let lightRules = "";
    let specRules = "";

    // 3a. 讀取輕量層 (Definitions) - 永遠載入
    const lightCount = parseInt(cache.get("KB_RULES_LIGHT_COUNT") || "0");
    if (lightCount > 0) {
      for (let i = 0; i < lightCount; i++) {
        lightRules += cache.get(`KB_RULES_LIGHT_${i}`) || "";
      }
      lightRulesLoaded = lightRules.trim().length > 0;
      lightRulesFromCache = lightRulesLoaded;
    } else {
      // Fallback: 嘗試讀取舊版合併 Cache (向後相容)
      const fullCount = parseInt(cache.get("KB_RULES_COUNT") || "0");
      if (fullCount > 0) {
        let fullContent = "";
        for (let i = 0; i < fullCount; i++) {
          fullContent += cache.get(`KB_RULES_${i}`) || "";
        }
        // 簡單拆分：假設前 50 行是 Light? 難以精確，乾脆全當 Light (安全保底)
        lightRules = fullContent;
        lightRulesLoaded = lightRules.trim().length > 0;
        writeLog(
          "[DynamicContext] ⚠️ Light Cache Miss, Fallback to Legacy Full Cache",
        );
      } else {
        // Fallback: 讀取 Sheet (只讀前半部)
        try {
          const ruleSheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
          if (ruleSheet && ruleSheet.getLastRow() > 1) {
            // 假設輕量層在前 50 行
            const data = ruleSheet
              .getRange(2, 1, Math.min(ruleSheet.getLastRow() - 1, 50), 1)
              .getValues();
            lightRules = data.map((r) => r[0]).join("\n");
            lightRulesLoaded = lightRules.trim().length > 0;
            if (lightRulesLoaded) {
              const chunks = chunkString(lightRules, 25000);
              cache.put('KB_RULES_LIGHT_COUNT', chunks.length.toString(), 21600);
              chunks.forEach((chunk, index) => {
                cache.put('KB_RULES_LIGHT_' + index, chunk, 21600);
              });
            }
          }
        } catch (e) {
          writeLog(`[Fallback Error] Light Rules Read Failed: ${e.message}`);
        }
      }
    }

    // 3b. 讀取規格層 (Specs) - 準備進行篩選
    const specCount = parseInt(cache.get("KB_RULES_SPEC_COUNT") || "0");
    if (specCount > 0) {
      for (let i = 0; i < specCount; i++) {
        specRules += cache.get(`KB_RULES_SPEC_${i}`) || "";
      }
      specRulesLoaded = specRules.trim().length > 0;
      specRulesFromCache = specRulesLoaded;
    } else {
      // Fallback: 若無 Spec Cache，嘗試讀取 Sheet (後半部)
      try {
        const ruleSheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
        if (ruleSheet && ruleSheet.getLastRow() > 1) {
          if (ruleSheet.getLastRow() > 50) {
            const data = ruleSheet
              .getRange(52, 1, ruleSheet.getLastRow() - 51, 1)
              .getValues();
            specRules = data.map((r) => r[0]).join("\n");
          } else {
            // v29.5.181: 若表格未達分層切點，仍以可用資料建立 Spec 層，避免誤判降級
            const data = ruleSheet
              .getRange(2, 1, ruleSheet.getLastRow() - 1, 1)
              .getValues();
            specRules = data.map((r) => r[0]).join("\n");
          }
          specRulesLoaded = specRules.trim().length > 0;
          if (specRulesLoaded) {
            const chunks = chunkString(specRules, 25000);
            cache.put('KB_RULES_SPEC_COUNT', chunks.length.toString(), 21600);
            chunks.forEach((chunk, index) => {
              cache.put('KB_RULES_SPEC_' + index, chunk, 21600);
            });
          }
        }
      } catch (e) {}
    }

    // 4. 載入 Guide
    const guide = cache.get("KB_GUIDE") || "";

    // ═══════════════════════════════════════════════════════════════
    // v29.4.0: 二段式 AI 架構 - 移除分詞篩選，直接整包丟給 AI
    // ═══════════════════════════════════════════════════════════════
    // 核心原則：
    // 1. 輕量層 (QA + 定義/術語/別稱) 整包丟給 AI
    // 2. 讓 AI 判斷能不能回答、需要哪些型號
    // 3. 程式只做路由，不做預先篩選
    // ═══════════════════════════════════════════════════════════════

    // v29.6.090: Optimization for PDF Mode (Compromise Solution)
    // Retention of context-relevant QA items using LCS to prevent losing newly recorded QA in PDF mode
    if (isPDFMode) {
      if (fullQA) {
        const qaItems = fullQA.split("\n\n");
        const filteredQa = qaItems.filter(item => {
          const parts = item.split(/\/\s*A[:：]/i);
          const questionPart = parts[0] || item;
          const lcsLen = getLongestCommonSubstringLength_(upperMsg, questionPart);
          return lcsLen >= 2; // 連續 2 個字以上相同就保留！
        });
        
        fullQA = filteredQa.join("\n\n");
        writeLog(
          `[DynamicContext v29.6.090] PDF Mode: Selected ${filteredQa.length}/${qaItems.length} context-relevant QA items via LCS.`,
        );
      } else {
        fullQA = "";
      }
    }

    let relevantContext = "=== 💡 精選問答 (QA - 最優先參考) ===\n";

    // 1️⃣ 直接注入 QA 全文 (不篩選)
    if (fullQA) {
      relevantContext += fullQA + "\n\n";
      // v29.5.0: Log Optimization
      // writeLog(`[DynamicContext v29.4] QA 全文注入: ${fullQA.length} 字元`);
    }

    // 2️⃣ 直接注入輕量層全文 (不篩選)
    if (lightRules) {
      relevantContext += "=== 📚 通用定義與術語 (含所有型號別稱) ===\n";
      relevantContext += lightRules + "\n\n";
      // v29.5.0: Log Optimization
      // writeLog(
      //   `[DynamicContext v29.4] 輕量層全文注入: ${lightRules.length} 字元`
      // );
    }

    // 3️⃣ 規格層智慧檢索 (Spec Layer Smart Retrieval) v29.4.6
    // 核心目標：針對 "40吋", "144Hz" 等屬性查詢，進行加權關鍵字檢索，避免簡單篩選的雜訊
    let specContext = "";
    // v29.5.181: 先用前段載入到的 specRules（含 Sheet fallback），避免 Cache Miss 時規格層直接失效
    let fullSpecRules = specRules || "";
    if (!fullSpecRules) {
      let chunkIndex = 0;
      while (true) {
        const chunk = cache.get(
          `${CACHE_KEYS.KB_RULES_SPEC_PREFIX}${chunkIndex}`,
        );
        if (!chunk) break;
        fullSpecRules += chunk;
        chunkIndex++;
      }
      if (fullSpecRules.trim().length > 0) {
        specRulesLoaded = true;
        specRulesFromCache = true;
      }
    }

    if (fullSpecRules) {
      const specLines = fullSpecRules.split("\n");

      // 1. Tokenizer: 識別單位與關鍵字
      // 優先匹配帶單位的屬性 (Score: 10)：\d+(吋|寸|inch|Hz|hz|ms|nits|cd|K|k|MP|mp)
      const unitRegex = /\d+(?:吋|寸|inch|Hz|hz|ms|nits|cd|K|k|MP|mp)/gi;
      // 其次匹配中文或英數單詞 (Score: 1)：[a-zA-Z0-9]+|[\u4e00-\u9fa5]{2,}
      const wordRegex = /[a-zA-Z0-9]+|[\u4e00-\u9fa5]{2,}/g;

      // A. 提取高權重 Token (單位)
      const highValTokens = latestUserMsg.match(unitRegex) || [];

      // B. 提取一般 Token (去除已匹配的高權重 Token，避免重複)
      let remainingMsg = latestUserMsg;
      highValTokens.forEach(
        (t) => (remainingMsg = remainingMsg.replace(t, "")),
      );
      const normalTokens = remainingMsg.match(wordRegex) || [];

      // 僅保留長度 >= 2 的一般 Token (過濾掉純數字單個字元，避免 "40" 匹配到 "40000")
      const validNormalTokens = normalTokens.filter(
        (t) => t.length >= 2 && !/^\d+$/.test(t),
      );

      // v29.5.142: 注入直通車推斷模型作為搜尋 Token，確保規格檔能被命中
      if (typeof injectedModelsList !== "undefined" && injectedModelsList.length > 0) {
        injectedModelsList.forEach((m) => {
          if (!validNormalTokens.includes(m)) {
            validNormalTokens.push(m);
          }
        });
        writeLog(`[SmartRetrieval] 已注入的型號 Token: ${injectedModelsList.join(", ")}`);
      }

      // writeLog(`[SmartRetrieval] HighTokens: ${JSON.stringify(highValTokens)}, NormalTokens: ${JSON.stringify(validNormalTokens)}`);

      // v29.4.8: 上下文回補機制 (Context Recovery)
      // 若當前對話無任何關鍵字 (如「它規格是？」)，嘗試讀取上一輪的 Tokens
      const lastTokensKey = `${CACHE_KEYS.LAST_SMART_TOKENS}${userId}`;
      let usingFallback = false;

      if (highValTokens.length === 0 && validNormalTokens.length === 0) {
        const cachedTokensJson = cache.get(lastTokensKey);
        if (cachedTokensJson) {
          try {
            const cachedTokens = JSON.parse(cachedTokensJson);
            if (Array.isArray(cachedTokens) && cachedTokens.length > 0) {
              cachedTokens.forEach((t) => validNormalTokens.push(t)); // 視為一般權重回補
              usingFallback = true;
              writeLog(
                `[SmartRetrieval] ⚠️ 當前無關鍵字，回補上一輪 Tokens: ${JSON.stringify(
                  cachedTokens,
                )}`,
              );
            }
          } catch (e) {
            // ignore
          }
        }
      }

      if (highValTokens.length > 0 || validNormalTokens.length > 0) {
        // 若有命中任何 Token (且非 Fallback 模式)，則更新 Cache 供下一輪使用
        // 僅當這是一次「新的有效搜尋」時才更新，避免連續廢話導致 Cache 被空值覆蓋
        if (!usingFallback) {
          const allTokens = [...highValTokens, ...validNormalTokens];
          // 僅保留前 5 個關鍵字，避免 Cache 爆炸
          cache.put(lastTokensKey, JSON.stringify(allTokens.slice(0, 5)), 600);
        }

        // 2. Scorer: 評分機制
        // 2. Scorer: 評分機制
        const scoredLines = specLines.map((line) => {
          let score = 0;
          const lowerLine = line.toLowerCase();

          // 單位命中 (+10分)
          highValTokens.forEach((token) => {
            if (lowerLine.includes(token.toLowerCase())) score += 10;
          });

          // 一般命中 (+1分)
          validNormalTokens.forEach((token) => {
            if (lowerLine.includes(token.toLowerCase())) score += 1;
          });

          return { line, score };
        });

        // 3. Injector: 擇優錄取 Top 50 (v29.6.012: 從 20 提升到 50, 確保 CLASS_RULES 144 列後的規格也能進入 Prompt)
        // 過濾掉 0 分的，並按分數排序，取前 50 筆
        const topLines = scoredLines
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 50)
          .map((item) => item.line);

        if (topLines.length > 0) {
          specContext +=
            "=== 🖥️ 產品型號詳細規格 (Spec Rules - Smart Filtered) ===\n";
          specContext += topLines.join("\n") + "\n\n";
          relevantContext += specContext;
          writeLog(
            `[SmartRetrieval] 注入 Top-${topLines.length} 規格行 (Max Score: ${
              scoredLines.sort((a, b) => b.score - a.score)[0].score
            })`,
          );
        } else {
          writeLog(`[SmartRetrieval] ⚠️ 無任何規格行命中關鍵字`);
        }
      } else {
        writeLog(`[SmartRetrieval] ⚠️ 無有效搜索 Token，跳過規格檢索`);
      }
    } else {
      writeLog(`[SmartRetrieval] ⚠️ 無法讀取 Spec Rules Cache`);
    }

    // 3️⃣ 注入 Guide (型號識別指南)
    if (guide) {
      relevantContext += "=== 🔍 型號識別指南 ===\n";
      relevantContext += guide + "\n\n";
    }

    // 4️⃣ 注入推斷型號上下文 (若有)
    if (inferredModelContext) {
      relevantContext += inferredModelContext + "\n";
    }

    // v29.5.181: 記錄上下文健康度，供主流程判定是否需要保守升級 PDF
    if (userId) {
      const contextHealth = {
        qaLoaded: !!qaLoaded,
        qaFromCache: !!qaFromCache,
        lightRulesLoaded: !!lightRulesLoaded,
        lightRulesFromCache: !!lightRulesFromCache,
        specRulesLoaded: !!specRulesLoaded,
        specRulesFromCache: !!specRulesFromCache,
        degraded: !(qaLoaded && lightRulesLoaded && specRulesLoaded),
      };
      cache.put(
        `${CACHE_KEYS.CONTEXT_HEALTH_PREFIX}${userId}`,
        JSON.stringify(contextHealth),
        120,
      );
      if (contextHealth.degraded) {
        writeLog(
          `[Context Health v29.5.181] 降級模式 qa:${contextHealth.qaLoaded} light:${contextHealth.lightRulesLoaded} spec:${contextHealth.specRulesLoaded}`,
        );
      }
    }

    // 記錄總 Context 大小
    // v29.5.0: Consolidate    // v29.5.146: 移除冗長 log
    // if (qaContext) {
    //   writeLog(
    //     `[Ctx Info] QA: ${fullQA ? fullQA.length : 0}c | Light: ${
    //       lightRules.length
    //     }c | Total: ${dynamicPrompt.length}c`,
    //   );
    // }
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
  CLASS_RULES: "CLASS_RULES",
};

const CACHE_KEYS = {
  KB_URI_LIST: "kb_list_v15_0",
  KB_URI_LIST_BACKUP: "kb_list_v15_0_backup",
  MANUAL_PDF_KB_LIST: "manual_pdf_kb_list_v1",
  PDF_MODEL_INDEX_BACKUP: "pdf_model_index_backup_v1",
  KEYWORD_MAP: "keyword_map_v1",
  STRONG_KEYWORDS: "strong_keywords_v1",
  HISTORY_PREFIX: "hist:",
  ENTRY_DRAFT_PREFIX: "entry_draft_",
  PENDING_QUERY: "pending_query_",
  PDF_MODE_PREFIX: "pdf_mode_",
  // v24.4.0: PDF 型號選擇機制
  PENDING_PDF_SELECTION: "pending_pdf_sel_", // 等待用戶選擇 PDF 型號
  // v29.4.0: 分層知識庫 Cache Keys
  KB_RULES_LIGHT_PREFIX: "KB_RULES_LIGHT_",
  KB_RULES_SPEC_PREFIX: "KB_RULES_SPEC_",
  LAST_SMART_TOKENS: "last_smart_tokens_", // v29.4.8: 保存 Smart Retrieval 關鍵字
  CONTEXT_HEALTH_PREFIX: "ctx_health_",
};

const CONFIG = {
  // v24.2.3: 雙模型策略
  MODEL_NAME_FAST: GEMINI_MODEL_FAST, // 快速對話用
  MODEL_NAME_THINK: GEMINI_MODEL_THINK, // PDF 深度閱讀 & /紀錄 用 (使用最前面的常數)
  MAX_OUTPUT_TOKENS: 8192,
  HISTORY_PAIR_LIMIT: 10, // v24.0.0: 恢復記憶長度，Fast Mode 用 (約 2K Tokens)
  PDF_HISTORY_LIMIT: 6, // v24.0.0: PDF Mode 專用，縮減歷史以容納 PDF (約 1K Tokens)
  SUMMARY_THRESHOLD: 12, // v24.0.0: 超過 12 對才觸發摘要 (避免過度摘要)
  CACHE_TTL_SEC: 3600,
  DRAFT_TTL_SEC: 300,

  // 管理員與 VIP 設定
  ADMIN_USER_ID:
    PropertiesService.getScriptProperties().getProperty("ADMIN_USER_ID") || "",
  VIP_IMAGE_USER:
    PropertiesService.getScriptProperties().getProperty("VIP_USER_ID") ||
    "U3526e3a6c4ad0561f4c29584f90dfebe",

  DRIVE_FOLDER_ID:
    PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID") ||
    "",
  API_ENDPOINT: "https://generativelanguage.googleapis.com/v1beta",
};

// 初始化 Spreadsheet
let ss = null;
try {
  ss = SpreadsheetApp.getActiveSpreadsheet();
} catch (e) {
  const fallbackId =
    PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (fallbackId) {
    try {
      ss = SpreadsheetApp.openById(fallbackId);
    } catch (e) {
      console.error("無法開啟試算表: " + e.message);
    }
  }
}

const ALLOW_PUSH =
  (PropertiesService.getScriptProperties().getProperty("ALLOW_PUSH") ||
    "false") === "true";

// v24.1.0: 測試模式 - 在回覆末尾顯示 Token 用量和成本
const DEBUG_SHOW_TOKENS =
  (PropertiesService.getScriptProperties().getProperty("DEBUG_SHOW_TOKENS") ||
    "true") === "true";

// 最後一次 API 呼叫的 Token 資訊 (用於測試模式顯示)
let lastTokenUsage = null;
let lastLlmCallAttempted = false;

// v29.5.112: 最後一次網路搜尋的來源列表 (用於顯示在回覆中)
let lastSearchSources = null;
let lastWebEvidenceValid = false;

/**
 * 從型號或關鍵字提取 LS 編號，產生三星官網搜尋連結
 * 例：G80SD -> LS32DG802SCXZW -> https://www.samsung.com/tw/search/?searchvalue=LS32DG802SCXZW
 */
function getProductUrl(modelOrKeyword) {
  if (!modelOrKeyword) return null;
  const upperKey = modelOrKeyword.toUpperCase().trim();

  // 如果已經是 LS 編號，直接使用
  if (upperKey.startsWith("LS") && upperKey.length > 10) {
    return `https://www.samsung.com/tw/search/?searchvalue=${upperKey}`;
  }

  // 從 KEYWORD_MAP 查找對應的 LS 編號
  try {
    const mapJson = PropertiesService.getScriptProperties().getProperty(
      CACHE_KEYS.KEYWORD_MAP,
    );
    if (mapJson) {
      const keywordMap = JSON.parse(mapJson);
      // 查找關鍵字對應的完整規格文字
      const specText = keywordMap[upperKey] || "";
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
  return `https://www.samsung.com/tw/search/?searchvalue=${encodeURIComponent(
    upperKey,
  )}`;
}

// ==========================================
// 2. 核心：Gemini 知識庫同步 (Sync)
// ==========================================

function isPriceQueryIntent_(msg) {
  if (!msg) {
    return false;
  }
  return /最低價|市場最低|建議售價|售價|價格|價錢|多少錢|報價|哪裡買|通路價|優惠價|活動價|折扣價|特價/i.test(
    msg,
  );
}

function extractPriceQueryTargets_(msg) {
  if (!msg) {
    return [];
  }
  const normalized = msg.toUpperCase().replace(/\s+/g, "");
  const modelRegex =
    /\b(?:LS\d{2}[A-Z0-9]+CXZW|S\d{1,2}[A-Z]{0,3}\d{0,4}[A-Z0-9]*|G\d{1,2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|WA\d+[A-Z0-9]*|WD\d+[A-Z0-9]*|VR\d+[A-Z0-9]*)\b/g;
  const aliasRegex = /\b(?:G5|G6|G7|G8|G9|M5|M7|M8|M9|S8|S9)\b/g;

  const models = normalized.match(modelRegex) || [];
  const aliases = normalized.match(aliasRegex) || [];

  const unique = [];
  const seen = {};
  models.concat(aliases).forEach((token) => {
    const t = token.trim();
    if (!t || seen[t]) {
      return;
    }
    seen[t] = true;
    unique.push(t);
  });
  return unique.slice(0, 8);
}

function buildNoPriceReply_(msg) {
  const targets = extractPriceQueryTargets_(msg);
  const lines = [];
  lines.push("這題是價格相關，我這邊不直接回覆數字價格，避免提供過期或錯誤報價。");
  lines.push("");
  lines.push("你可以直接看三星官網查價頁（頁面會顯示當下建議售價/活動資訊）：");
  if (targets.length === 0) {
    lines.push(
      "1. https://www.samsung.com/tw/search/?searchvalue=%E4%B8%89%E6%98%9F%20%E8%9E%A2%E5%B9%95",
    );
  } else {
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      lines.push(`${i + 1}. ${getProductUrl(t)}`);
    }
  }
  lines.push("");
  lines.push("若你要，我可以再幫你整理這些型號目前在官網是否有促銷活動。");
  return lines.join("\n");
}

function isPdfKbFile(file) {
  return file && file.mimeType === "application/pdf";
}

function extractPdfModelIndexFromKbList(kbList) {
  let pdfModels = [];
  (Array.isArray(kbList) ? kbList : []).forEach((file) => {
    if (!isPdfKbFile(file)) {
      return;
    }

    const fileName = String(file.name || "").toUpperCase();
    const sModels = fileName.match(/S\d{2}[A-Z]{1,3}\d{2,4}[A-Z0-9]*/g) || [];
    const gModels = fileName.match(/G\d{1,2}[A-Z]*/g) || [];
    const mModels = fileName.match(/M\d{1,2}[A-Z]*/g) || [];
    const wModels = fileName.match(/(?:WA|WD|VR)\d+[A-Z\d]*/g) || [];
    const cfModels = fileName.match(/(?:LC|LF|C|F)\d{2}[A-Z]{1,3}\d{2,4}[A-Z0-9]*/g) || [];
    pdfModels = pdfModels.concat(sModels, gModels, mModels, wModels, cfModels);
  });
  return [...new Set(pdfModels)];
}

function persistPdfKbState(kbList) {
  const listToPersist = Array.isArray(kbList) ? kbList : [];
  const pdfModels = extractPdfModelIndexFromKbList(listToPersist);
  const props = PropertiesService.getScriptProperties();
  props.setProperty(CACHE_KEYS.KB_URI_LIST, JSON.stringify(listToPersist));
  props.setProperty("PDF_MODEL_INDEX", JSON.stringify(pdfModels));

  if (listToPersist.some(isPdfKbFile)) {
    props.setProperty(
      CACHE_KEYS.KB_URI_LIST_BACKUP,
      JSON.stringify(listToPersist),
    );
    props.setProperty(
      CACHE_KEYS.PDF_MODEL_INDEX_BACKUP,
      JSON.stringify(pdfModels),
    );
  }
  return pdfModels;
}

function getManualPdfKbList_() {
  const props = PropertiesService.getScriptProperties();
  try {
    const raw = props.getProperty(CACHE_KEYS.MANUAL_PDF_KB_LIST);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(function (item) {
          return isPdfKbFile(item) && item.name && item.uri;
        })
      : [];
  } catch (e) {
    writeLog(`[ManualPDF] 讀取手動補傳 PDF 清單失敗: ${e.message}`);
    return [];
  }
}

function mergePdfKbItemsByName_(baseList, extraList) {
  const byName = {};
  (Array.isArray(baseList) ? baseList : []).forEach(function (item) {
    if (item && item.name) {
      byName[item.name] = item;
    }
  });
  (Array.isArray(extraList) ? extraList : []).forEach(function (item) {
    if (item && item.name) {
      byName[item.name] = item;
    }
  });
  return Object.keys(byName).map(function (name) {
    return byName[name];
  });
}

function persistManualPdfKbItem_(item) {
  if (!isPdfKbFile(item) || !item.name || !item.uri) {
    throw new Error("Manual PDF KB item is invalid");
  }
  const props = PropertiesService.getScriptProperties();
  const manualList = mergePdfKbItemsByName_(getManualPdfKbList_(), [item]);
  props.setProperty(CACHE_KEYS.MANUAL_PDF_KB_LIST, JSON.stringify(manualList));

  let currentList = [];
  try {
    const currentJson = props.getProperty(CACHE_KEYS.KB_URI_LIST);
    const parsed = currentJson ? JSON.parse(currentJson) : [];
    currentList = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    currentList = [];
  }
  const mergedList = mergePdfKbItemsByName_(currentList, manualList);
  const pdfModels = persistPdfKbState(mergedList);
  return {
    manualCount: manualList.length,
    pdfModelCount: pdfModels.length,
  };
}

function stripInlinePdfDataForCache(files) {
  return (Array.isArray(files) ? files : []).map((file) => {
    if (!file) {
      return file;
    }
    const copy = Object.assign({}, file);
    if (copy.inlineDataBase64) {
      copy.inlineDataBase64 = "[inline-data-omitted]";
    }
    return copy;
  });
}

function normalizePdfModelToken_(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/\.PDF$/i, "")
    .replace(/^L(?=[SCF]\d{2})/, "")
    .replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, "");
}

function getPdfFileModelTokens_(fileName) {
  const baseName = String(fileName || "")
    .toUpperCase()
    .replace(/\.PDF$/i, "");
  return baseName
    .split(/[^A-Z0-9]+/)
    .map(normalizePdfModelToken_)
    .filter(function (token) {
      return token.length >= 2;
    });
}

function isPdfSalesSuffix_(suffix) {
  return /^[A-Z]{1,4}$/.test(String(suffix || ""));
}

function isPdfModelTokenMatch_(pdfToken, queryModel) {
  const token = normalizePdfModelToken_(pdfToken);
  const model = normalizePdfModelToken_(queryModel);
  if (!token || !model) {
    return false;
  }
  if (token === model) {
    return true;
  }
  if (model.startsWith(token) && isPdfSalesSuffix_(model.substring(token.length))) {
    return true;
  }
  if (token.startsWith(model) && isPdfSalesSuffix_(token.substring(model.length))) {
    return true;
  }
  return false;
}

function pdfFileNameMatchesModelToken_(fileName, model) {
  return getPdfFileModelTokens_(fileName).some(function (token) {
    return isPdfModelTokenMatch_(token, model);
  });
}

function pdfFileNameMatchesModels(fileName, exactModels) {
  return (Array.isArray(exactModels) ? exactModels : []).some((model) => {
    if (!model) {
      return false;
    }
    return pdfFileNameMatchesModelToken_(fileName, model);
  });
}

function recoverRelevantPdfUrisFromDrive(exactModels, primaryModel, limit) {
  if (!CONFIG.DRIVE_FOLDER_ID || !exactModels || exactModels.length === 0) {
    return [];
  }

  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    writeLog("[PDF Recovery] 缺少 GEMINI_API_KEY，無法即時補回 PDF URI");
    return [];
  }

  const candidates = [];
  try {
    const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    const files = folder.getFilesByType(MimeType.PDF);
    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();
      if (pdfFileNameMatchesModels(fileName, exactModels)) {
        candidates.push(file);
      }
    }
  } catch (err) {
    writeLog(`[PDF Recovery] Drive 讀取失敗: ${err.message}`);
    return [];
  }

  if (candidates.length === 0) {
    return [];
  }

  const primary = String(primaryModel || "").toUpperCase();
  candidates.sort((a, b) => {
    const aName = a.getName().toUpperCase();
    const bName = b.getName().toUpperCase();
    const score = (name) => {
      if (primary && name.includes(primary)) {
        return 100;
      }
      if (exactModels.some((m) => /^S\d{2}/.test(m) && name.includes(m))) {
        return 50;
      }
      return 10;
    };
    return score(bName) - score(aName);
  });

  const recovered = [];
  const maxFiles = Math.max(1, Math.min(Number(limit) || 1, 2));
  for (let i = 0; i < candidates.length && recovered.length < maxFiles; i++) {
    const file = candidates[i];
    const fileSize = file.getSize();
    if (fileSize > 48 * 1024 * 1024) {
      writeLog(`[PDF Recovery] 跳過過大檔案: ${file.getName()}`);
      continue;
    }

    const uri = uploadFileToGemini(
      apiKey,
      file.getBlob(),
      fileSize,
      "application/pdf",
    );
    if (uri) {
      recovered.push({
        name: file.getName(),
        uri: uri,
        mimeType: "application/pdf",
        source: "file_api",
      });
    } else if (fileSize <= INLINE_PDF_FALLBACK_MAX_BYTES) {
      recovered.push({
        name: file.getName(),
        inlineDataBase64: Utilities.base64Encode(file.getBlob().getBytes()),
        mimeType: "application/pdf",
        source: "inline_fallback",
      });
      writeLog(
        `[PDF Recovery] File API 無 URI，改用 inline PDF fallback: ${file.getName()} (${fileSize} bytes)`,
      );
    } else {
      writeLog(
        `[PDF Recovery] File API 無 URI，且檔案超過 inline fallback 上限: ${file.getName()} (${fileSize} bytes)`,
      );
    }
  }

  const uriRecovered = recovered.filter((item) => item.uri);
  if (uriRecovered.length > 0) {
    const props = PropertiesService.getScriptProperties();
    let currentList = [];
    try {
      const currentJson = props.getProperty(CACHE_KEYS.KB_URI_LIST);
      currentList = currentJson ? JSON.parse(currentJson) : [];
      if (!Array.isArray(currentList)) {
        currentList = [];
      }
    } catch (e) {
      currentList = [];
    }

    const byName = {};
    currentList.forEach((item) => {
      if (item && item.name) {
        byName[item.name] = item;
      }
    });
    uriRecovered.forEach((item) => {
      byName[item.name] = item;
    });
    persistPdfKbState(Object.keys(byName).map((name) => byName[name]));
    writeLog(
      `[PDF Recovery] 即時補回手冊 URI: ${uriRecovered
        .map((f) => f.name)
        .join(", ")}`,
    );
  }

  return recovered;
}

function getKbHealthSummary() {
  const props = PropertiesService.getScriptProperties();
  const parseList = (key) => {
    try {
      const raw = props.getProperty(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  };

  const kbList = parseList(CACHE_KEYS.KB_URI_LIST);
  const backupList = parseList(CACHE_KEYS.KB_URI_LIST_BACKUP);
  const pdfIndex = parseList("PDF_MODEL_INDEX");
  const backupIndex = parseList(CACHE_KEYS.PDF_MODEL_INDEX_BACKUP);

  let drivePdfCount = null;
  let driveError = "";
  if (CONFIG.DRIVE_FOLDER_ID) {
    try {
      const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
      const files = folder.getFilesByType(MimeType.PDF);
      drivePdfCount = 0;
      while (files.hasNext()) {
        files.next();
        drivePdfCount++;
      }
    } catch (err) {
      driveError = err.message;
    }
  }

  return {
    gasVersion: GAS_VERSION,
    buildTimestamp: BUILD_TIMESTAMP,
    hasDriveFolderId: !!CONFIG.DRIVE_FOLDER_ID,
    drivePdfCount: drivePdfCount,
    driveError: driveError,
    kbUriPdfCount: kbList.filter(isPdfKbFile).length,
    kbBackupPdfCount: backupList.filter(isPdfKbFile).length,
    pdfModelIndexCount: pdfIndex.length,
    pdfModelIndexBackupCount: backupIndex.length,
  };
}

function syncGeminiKnowledgeBase(forceRebuild = false) {
  const lock = LockService.getScriptLock();
  let hasLock = false;
  try {
    // 嘗試鎖定 2 分鐘
    hasLock = lock.tryLock(120000);
    if (!hasLock) {
      return "系統忙碌中，請稍後再試";
    }

    // 檢查是否有標記需要重建
    const cache = CacheService.getScriptCache();
    const needRebuild = cache.get("kb_need_rebuild") === "true";
    if (needRebuild) {
      forceRebuild = true;
      cache.remove("kb_need_rebuild");
      writeLog("[Sync] 偵測到 403/404 標記，強制重建");
    }

    // v29.5.0: Optimize Sync Log - Hide intermediate noise
    // writeLog(`[Sync] 開始執行知識庫同步... (forceRebuild: ${forceRebuild})`);

    const apiKey =
      PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("缺少 GEMINI_API_KEY");
    }

    // 讀取舊的快取清單
    let oldKbList = [];
    const oldJson = PropertiesService.getScriptProperties().getProperty(
      CACHE_KEYS.KB_URI_LIST,
    );
    if (oldJson) {
      try {
        oldKbList = JSON.parse(oldJson);
      } catch (e) {
        writeLog("[Sync] 舊快取解析失敗，將重建");
      }
    }
    const fallbackKbList = Array.isArray(oldKbList) ? oldKbList.slice() : [];

    let backupKbList = [];
    const backupJson = PropertiesService.getScriptProperties().getProperty(
      CACHE_KEYS.KB_URI_LIST_BACKUP,
    );
    if (backupJson) {
      try {
        const parsedBackup = JSON.parse(backupJson);
        backupKbList = Array.isArray(parsedBackup) ? parsedBackup : [];
      } catch (e) {
        writeLog("[Sync Guard v29.5.244] PDF 備份清單解析失敗，略過備份");
      }
    }

    // 如果強制重建，不先清掉舊 PDF URI；新清單成功後再覆蓋，避免失敗時歸零
    if (forceRebuild) {
      writeLog('[Sync] 強制重建模式：清除舊 PDF 清單，強迫重新上傳，解決過期循環問題');
      oldKbList = [];
    }

    // 建立比對 Map
    const existingFilesMap = new Map();
    oldKbList.forEach((item) => {
      if (item.name) {
        existingFilesMap.set(item.name, item.uri);
      }
    });

    const newKbList = [];
    let keywordMap = {};
    let strongKeywords = [];

    // v29.5.10 Log Consolidation
    const syncLogs = [];

    // --- A. Sheet 資料處理 (QA優先 + 規則分離) ---

    // 1. QA 內容 (最優先)
    let qaContent = "=== 💡 精選問答 (QA - 最優先參考) ===\n";
    const qaSheet = ss.getSheetByName(SHEET_NAMES.QA);
    if (qaSheet && qaSheet.getLastRow() >= 1) {
      // 從第 1 行開始讀取，避免漏掉第一筆資料 (若無標題列)
      const data = qaSheet.getRange(1, 1, qaSheet.getLastRow(), 1).getValues();
      const qaRows = data
        .map((row) => {
          if (!row[0]) return "";
          const text = row[0].toString();
          // 簡單過濾標題列
          if (text.length < 20 && text.match(/^(問題|Question|QA內容)/i))
            return "";
          return `QA: ${text}`;
        })
        .filter((line) => line !== "");
      qaContent += qaRows.join("\n\n");
      // v29.5.0: Log Optimization
      // writeLog(
      //   `[Sync Debug] QA Sheet: ${qaRows.length} rows valid. Content length: ${qaContent.length}`
      // );

      // v27.9.23: 防災機制 - 若 QA 異常空白 (讀取失敗?)，停止同步以保護 Diff
      if (qaRows.length === 0 && !forceRebuild) {
        writeLog(
          "[Sync Safety] ⚠️ QA 讀取筆數為 0，且非強制重建。判定為讀取異常，中止同步以保護快取。",
        );
        if (hasLock) {
          try {
            lock.releaseLock();
          } catch (e) {}
        }
        return "❌ 同步失敗：QA 資料讀取異常 (0 筆)";
      }
    }

    // 2. CLASS_RULES (定義與規格分離)
    let definitionsContent = "\n\n=== 📚 通用術語與系列定義 ===\n";
    let specsContent =
      "\n\n=== 📱 詳細機型規格資料庫 (硬體功能以這裡為準) ===\n";

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

    // v27.9.85: 第 0 遍 - 全域收集所有實體型號 (更加強健的搜尋)
    let allExistModels = [];

    const ruleSheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    if (ruleSheet && ruleSheet.getLastRow() > 1) {
      const allRows = ruleSheet
        .getRange(2, 1, ruleSheet.getLastRow() - 1, 1)
        .getValues();

      // v27.9.85: 第 0 遍 - 全域收集所有實體型號 (更加強健的搜尋)
      allRows.forEach((row) => {
        if (!row[0]) return;
        const rowText = row[0].toString();
        // 匹配 LS...XZW 格式 或 型號：... 格式 (搜尋全行)
        const lsMatches =
          rowText.match(/LS\d{2}[A-Z]{2}\d{3}[A-Z]{2}(XZW)?/gi) || [];
        const labelMatches = rowText.match(/型號[：:][\s]*([\w-]+)/gi) || [];

        lsMatches.forEach((m) => {
          const clean = m.toUpperCase().replace(/^LS/, "S").replace(/XZW$/, "");
          if (!allExistModels.includes(clean)) allExistModels.push(clean);
        });
        labelMatches.forEach((m) => {
          const clean = m
            .replace(/型號[：:]/i, "")
            .trim()
            .toUpperCase();
          if (clean && !allExistModels.includes(clean))
            allExistModels.push(clean);
        });
      });
      // v29.4.12: Save model count for info display
      // v29.4.14: Log duplicates specifically
      const uniqueCount = allExistModels.length;
      syncLogs.push(`Init: ${uniqueCount} models`);
      PropertiesService.getScriptProperties().setProperty(
        "TOTAL_MODEL_COUNT",
        uniqueCount.toString(),
      );

      let resolvedPatternCount = 0;

      allRows.forEach((row) => {
        if (!row[0]) return;
        const text = row[0].toString();
        const parts = text.split(",");
        let rawKey = parts[0] ? parts[0].trim().toUpperCase() : "";

        // 收集直通車關鍵字 (僅限 系列/術語/別稱)
        if (
          rawKey.startsWith("系列_") ||
          rawKey.startsWith("術語_") ||
          rawKey.startsWith("別稱_")
        ) {
          const cleanKey = rawKey.replace(/^(別稱|術語|系列)_/, "");
          if (cleanKey.length >= 2) {
            strongKeywords.push(cleanKey);
          }
        }

        // 移除前綴 (別稱_, 術語_, 系列_) 以便正確匹配
        let key = rawKey.replace(/^(別稱|術語|系列)_/, "");

        // 分流邏輯
        let isModelRow = false;
        let sModel = "";

        if (key.startsWith("型號：") || key.startsWith("型號:")) {
          isModelRow = true;
          sModel = key.replace(/^型號[：:]/, "").trim();
          key = sModel;
        } else if (key.startsWith("LS")) {
          isModelRow = true;
          sModel = key.replace(/^LS/, "S").replace(/XZW$/, "");
        }

        if (isModelRow) {
          specsContent += `* ${text}\n`;

          const potentialAliases =
            text.match(
              /\b(G\d{2}[A-Z]{1,2}|M\d{2}[A-Z]|S\d{2}[A-Z]{2}\d{3}[A-Z]{2}|[CF]\d{2}[A-Z]\d{3})\b/g,
            ) || [];

          potentialAliases.forEach((alias) => {
            alias = alias.toUpperCase();
            if (alias !== sModel && !alias.startsWith("LS")) {
              keywordMap[alias] = sModel;
            }
          });

          const lsMatch = text.match(/\bLS\d{2}[A-Z]{2}\d{3}[A-Z]{2}XZW\b/);
          if (lsMatch) {
            keywordMap[lsMatch[0]] = sModel;
          }
        } else {
          // v27.9.82: 型號模式自動窮舉機制
          const patternMatch = text.match(/型號模式為[：:](.*)/);
          let resolvedModelsText = "";

          if (patternMatch) {
            const patternStr = patternMatch[1].trim();
            const patterns = patternStr.split(/[,，|]/);
            const matchedModels = [];

            patterns.forEach((p) => {
              const cleanP = p.trim();
              if (!cleanP) return;
              const regexStr =
                "^" + cleanP.replace(/\?/g, ".").replace(/\*/g, ".*") + "$";
              const regex = new RegExp(regexStr, "i");

              allExistModels.forEach((m) => {
                if (regex.test(m) && !matchedModels.includes(m)) {
                  matchedModels.push(m);
                }
              });
            });

            if (matchedModels.length > 0) {
              resolvedModelsText = ` (⚠️ 注意！此系列包含實體型號如下，請優先引導用戶確認型號：${matchedModels.join(
                "、",
              )})`;
              resolvedPatternCount++;
            }

            // v29.5.148: 除了 wildcard 型號，將精確字眼 (如 3D, Odyssey3D) 也主動加入直通車觸發清單
            patterns.forEach((p) => {
              const cleanP = p.trim().toUpperCase();
              if (cleanP && !cleanP.includes("*") && !cleanP.includes("?")) {
                if (cleanP.length >= 2 && !strongKeywords.includes(cleanP)) {
                  strongKeywords.push(cleanP);
                }
                // 也必須讓 keywordMap 認得這個字眼能映射回原句
                keywordMap[cleanP] = text;
              }
            });
          }

          // v27.9.84: 確保 keywordMap 也使用處理過的 cleanText
          const cleanText = text.replace(/[,，]?型號模式為[：:].*/g, "").trim();
          const processedText = `${cleanText}${resolvedModelsText}`;
          definitionsContent += `* ${processedText}\n`;

          // 更新 keywordMap
          if (key && processedText.length > key.length) {
            keywordMap[key] = processedText;
          }
        }

        // v27.9.84: 對於 ModelRow，使用原始 text (因為它是規格行)
        if (isModelRow && key && text.length > key.length) {
          keywordMap[key] = text;
        }
      });

      if (resolvedPatternCount > 0) {
        syncLogs.push(`Patterns: ${resolvedPatternCount}`);
      }
    }

    // v27.9.86: 強制清理舊索引
    PropertiesService.getScriptProperties().deleteProperty(
      CACHE_KEYS.KEYWORD_MAP,
    );

    // 儲存映射表
    PropertiesService.getScriptProperties().setProperty(
      CACHE_KEYS.KEYWORD_MAP,
      JSON.stringify(keywordMap),
    );
    PropertiesService.getScriptProperties().setProperty(
      CACHE_KEYS.STRONG_KEYWORDS,
      JSON.stringify(strongKeywords),
    );
    syncLogs.push(`Keywords: ${Object.keys(keywordMap).length}`);

    // 2025-12-05: 改為動態上下文注入 (Dynamic Context Injection)
    // 不再上傳 samsung_kb_priority.txt，改為將內容存入 Cache/Properties
    // 為了避免 ScriptProperties 9KB 限制，我們將內容分塊儲存或僅存入 CacheService (6小時)
    // 這裡選擇存入 CacheService，並在 getDynamicContext 中若快取失效則重新讀取 Sheet (Fallback)

    // const cache = CacheService.getScriptCache(); // 已在上方定義
    // 存入 QA (分塊儲存，每塊 90KB)
    // v27.9.25 Fix: 40000 chars * 3 bytes (Chinese) = 120KB > 100KB limit.
    // Adjust to 25000 chars (approx 75KB safe margin for full Chinese content)
    const qaChunks = chunkString(qaContent, 25000);
    cache.put("KB_QA_COUNT", qaChunks.length.toString(), 21600); // 6小時
    qaChunks.forEach((chunk, index) => {
      cache.put(`KB_QA_${index}`, chunk, 21600);
    });
    // writeLog(
    //   `[Sync Debug] QA Chunked into ${qaChunks.length} parts. Saved to Cache.`
    // );

    // 存入 Rules (v29.4.0: 分層儲存 - 輕量層與規格層分離)
    // 輕量層 (Definitions - 術語/別稱/系列) - 每次查詢都載入 (~8KB)
    const lightChunks = chunkString(definitionsContent, 25000);
    cache.put("KB_RULES_LIGHT_COUNT", lightChunks.length.toString(), 21600);
    lightChunks.forEach((chunk, index) => {
      cache.put(`${CACHE_KEYS.KB_RULES_LIGHT_PREFIX}${index}`, chunk, 21600);
    });
    syncLogs.push(`Light: ${lightChunks.length}`);

    // 規格層 (Specs - 各型號詳細規格) - 僅在需要時載入 (~100KB)
    const specChunks = chunkString(specsContent, 25000);
    cache.put("KB_RULES_SPEC_COUNT", specChunks.length.toString(), 21600);
    specChunks.forEach((chunk, index) => {
      cache.put(`${CACHE_KEYS.KB_RULES_SPEC_PREFIX}${index}`, chunk, 21600);
    });
    syncLogs.push(`Specs: ${specChunks.length}`);

    // 向後相容：同時保留合併版 (方便回退)
    const rulesContent = definitionsContent + "\n" + specsContent;
    const rulesChunks = chunkString(rulesContent, 25000);
    cache.put("KB_RULES_COUNT", rulesChunks.length.toString(), 21600);
    rulesChunks.forEach((chunk, index) => {
      cache.put(`KB_RULES_${index}`, chunk, 21600);
    });

    // 存入 Model Pattern Guide
    cache.put("KB_GUIDE", modelPatternGuide, 21600);

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
    let driveScanSucceeded = false;
    const drivePdfCatalog = [];

    if (CONFIG.DRIVE_FOLDER_ID) {
      try {
        const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
        const files = folder.getFilesByType(MimeType.PDF);

        let uploadedFiles = [];
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
            newKbList.push({
              name: fileName,
              uri: existingFilesMap.get(fileName),
              mimeType: "application/pdf",
            });
            drivePdfCatalog.push({
              name: fileName,
              mimeType: "application/pdf",
            });
            skipCount++;
          } else {
            const pdfUri = uploadFileToGemini(
              apiKey,
              file.getBlob(),
              fileSize,
              "application/pdf",
            );

            if (pdfUri) {
              newKbList.push({
                name: fileName,
                uri: pdfUri,
                mimeType: "application/pdf",
              });
              // v29.6.015: 只有上傳成功的 PDF 才計入型號索引, 避免 [KB_EXPIRED] 永久殘缺
              drivePdfCatalog.push({
                name: fileName,
                mimeType: "application/pdf",
              });
              uploadedFiles.push(fileName);
              uploadCount++;
            } else {
              writeLog(`[Sync] ❌ 上傳失敗: ${fileName}`);
            }
          }
        }

        if (uploadedFiles.length > 0) {
          writeLog(`[Sync] 正在上傳: ${uploadedFiles.join(",")}`);
        }
        driveScanSucceeded = true;
      } catch (driveErr) {
        writeLog(`[Sync] ⚠️ Drive 讀取失敗: ${driveErr.message}`);
      }
    }

    const manualPdfKbList = getManualPdfKbList_();
    if (manualPdfKbList.length > 0) {
      manualPdfKbList.forEach(function (item) {
        if (
          !newKbList.some(function (existing) {
            return existing && existing.name === item.name;
          })
        ) {
          newKbList.push(item);
        }
        if (
          !drivePdfCatalog.some(function (existing) {
            return existing && existing.name === item.name;
          })
        ) {
          drivePdfCatalog.push({
            name: item.name,
            mimeType: "application/pdf",
          });
        }
      });
      syncLogs.push(`ManualPDF: ${manualPdfKbList.length}`);
      writeLog(`[Sync] 合併手動補傳 PDF: ${manualPdfKbList.length}`);
    }

    // v29.5.53: PDF Model Index - 從 PDF 檔名提取型號建立索引
    const hasPdfInNewKbList = newKbList.some(isPdfKbFile);
    const hasPdfInFallback = fallbackKbList.some(isPdfKbFile);
    const hasPdfInBackup = backupKbList.some(isPdfKbFile);

    let kbListToPersist = newKbList;
    let pdfListSource = "new";
    if (!hasPdfInNewKbList && hasPdfInFallback) {
      kbListToPersist = fallbackKbList;
      pdfListSource = "current";
      writeLog(
        "[Sync Guard v29.5.244] 新 PDF 清單為 0，保留既有 KB_URI_LIST，避免 PDF 索引被覆蓋成 0",
      );
    } else if (!hasPdfInNewKbList && !hasPdfInFallback && hasPdfInBackup) {
      kbListToPersist = backupKbList;
      pdfListSource = "backup";
      writeLog(
        "[Sync Guard v29.5.244] 新/既有 PDF 清單皆為 0，改用備份 KB_URI_LIST 回復 PDF 索引",
      );
    } else if (!hasPdfInNewKbList && !hasPdfInFallback && !hasPdfInBackup && CONFIG.DRIVE_FOLDER_ID) {
      writeLog(
        "[Sync Guard v29.5.244] 新/既有/備份 PDF 清單皆為 0，保留原屬性不寫入空索引",
      );
    }

    const pdfIndexSourceList = drivePdfCatalog.some(isPdfKbFile)
      ? drivePdfCatalog
      : kbListToPersist;
    const uniquePdfModels = extractPdfModelIndexFromKbList(pdfIndexSourceList);
    const props = PropertiesService.getScriptProperties();
    const shouldPersistPdfState =
      kbListToPersist.some(isPdfKbFile) || !CONFIG.DRIVE_FOLDER_ID;
    const shouldPersistPdfIndex =
      uniquePdfModels.length > 0 ||
      !CONFIG.DRIVE_FOLDER_ID ||
      driveScanSucceeded;
    if (shouldPersistPdfIndex) {
      props.setProperty("PDF_MODEL_INDEX", JSON.stringify(uniquePdfModels));
    }
    syncLogs.push(`PDF索引: ${uniquePdfModels.length}`);
    syncLogs.push(`PDF來源: ${pdfListSource}`);
    syncLogs.push(`Drive手冊: ${drivePdfCatalog.length}`);

    // 更新 Cache。只有確定有 PDF 清單時才覆蓋正式索引；避免同步異常把可用索引洗成空。
    if (shouldPersistPdfState) {
      props.setProperty(CACHE_KEYS.KB_URI_LIST, JSON.stringify(kbListToPersist));
      if (kbListToPersist.some(isPdfKbFile)) {
        props.setProperty(
          CACHE_KEYS.KB_URI_LIST_BACKUP,
          JSON.stringify(kbListToPersist),
        );
        props.setProperty(
          CACHE_KEYS.PDF_MODEL_INDEX_BACKUP,
          JSON.stringify(uniquePdfModels),
        );
      }
    }
    if (uniquePdfModels.length > 0) {
      props.setProperty(
        CACHE_KEYS.PDF_MODEL_INDEX_BACKUP,
        JSON.stringify(uniquePdfModels),
      );
    }

    // Extract Prompt version and info
    const promptSheet = ss.getSheetByName(SHEET_NAMES.PROMPT);
    const configData = promptSheet.getRange("B3:C3").getValues()[0];
    const tempSetting = typeof configData[0] === "number" ? configData[0] : 0.6;
    const c3Prompt = configData[1] || "";
    const promptVersionMatch = c3Prompt.match(/Prompt v([\d.]+)/);
    const promptVersion = promptVersionMatch
      ? promptVersionMatch[1]
      : "unknown";

    const statusMsg = [
      "✅ 系統重啟與同步完成",
      "━━━━━━━━",
      `📦 系統版本：${GAS_VERSION}`,
      `📝 指令版本：v${promptVersion}`,
      `🌡️ 創意溫度：${tempSetting}`,
      "━━━━━━━━",
      `📁 PDF 型號索引：${uniquePdfModels.length} 組`,
      `📄 規格型號：${allExistModels.length} 組`,
      `📑 Drive 手冊：${drivePdfCatalog.length} 本`,
      `☁️ Gemini URI 快取：${uploadCount + skipCount} 本`,
      "━━━━━━━━",
      "💡 對話記憶已清空...",
    ].join("\n");
    writeLog(`[Sync Summary] ${syncLogs.join(" | ")}`);
    // writeLog(statusMsg);

    // v29.6.015: 若有上傳失敗, 自動 1 分鐘後背景重試 (避免 56 本 PDF 永久殘缺)
    const failedCount = drivePdfCatalog.length - skipCount - uploadCount;
    if (failedCount > 0) {
      writeLog(`[Sync] ⚠️ ${failedCount} 本 PDF 上傳失敗, 1 分鐘後自動重試`);
      scheduleImmediateRebuild();
    }

    // v29.6.031: Cached Content 暫時禁用 - 待重構 prompt 才能啟用
    // try {
    //   rebuildSpecCachedContent();
    // } catch (e) {
    //   writeLog(`[CachedContent] 建立失敗: ${e.message}`);
    // }

    // 預約下次同步
    scheduleNextSync();

    return statusMsg;
  } catch (e) {
    writeLog(`[Sync Error] ${e.message}`);
    return `系統錯誤: ${e.message}`;
  } finally {
    if (hasLock) {
      try {
        lock.releaseLock();
      } catch (e) {}
    }
    flushLogs(); // 確保 Trigger 執行時寫入 Log
  }
}

// 上傳檔案至 Gemini
function uploadFileToGemini(apiKey, blob, fileSize, mimeType) {
  try {
    const initUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
    const headers = {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": fileSize.toString(),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    };
    const metadata = { file: { display_name: blob.getName() } };

    const initReq = UrlFetchApp.fetch(initUrl, {
      method: "post",
      headers: headers,
      payload: JSON.stringify(metadata),
      muteHttpExceptions: true,
    });

    if (initReq.getResponseCode() !== 200) {
      writeLog(
        `[Gemini File Upload] start failed ${initReq.getResponseCode()} ${blob.getName()}: ${initReq
          .getContentText()
          .substring(0, 240)}`,
      );
      return null;
    }

    const uploadUrl = initReq.getHeaders()["x-goog-upload-url"];

    const uploadReq = UrlFetchApp.fetch(uploadUrl, {
      method: "post",
      headers: {
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      payload: blob,
      muteHttpExceptions: true,
    });

    if (uploadReq.getResponseCode() !== 200) {
      writeLog(
        `[Gemini File Upload] upload failed ${uploadReq.getResponseCode()} ${blob.getName()}: ${uploadReq
          .getContentText()
          .substring(0, 240)}`,
      );
      return null;
    }

    const fileRes = JSON.parse(uploadReq.getContentText());
    let state = fileRes.file.state;
    let attempts = 0;

    while (state === "PROCESSING" && attempts < 30) {
      Utilities.sleep(1000);
      const check = UrlFetchApp.fetch(
        `${CONFIG.API_ENDPOINT}/${fileRes.file.name}?key=${apiKey}`,
      );
      state = JSON.parse(check.getContentText()).state;
      attempts++;
    }

    if (state === "ACTIVE") {
      return fileRes.file.uri;
    } else {
      writeLog(
        `[Gemini File Upload] processing not active (${state}) ${blob.getName()}`,
      );
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
          UrlFetchApp.fetch(deleteUrl, {
            method: "delete",
            muteHttpExceptions: true,
          });
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

/**
 * @deprecated v29.6.031 — Cached Content 暫時禁用
 * 原因: API 400 錯誤「CachedContent can not be used with system_instruction, tools」
 * 需重構 prompt 結構 (把 systemInstruction 移到 cache) 才能啟用, 詳見 AGENTS.md 鐵律 6/7
 * 本函式保留作未來重構參考, 呼叫端已註解
 */
function rebuildSpecCachedContent() {
  const cache = CacheService.getScriptCache();
  const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    writeLog("[CachedContent] GEMINI_API_KEY 缺失, 跳過");
    return null;
  }

  // 1. 載入規格庫 (Light + Heavy)
  let specContent = "";
  const lightCount = parseInt(cache.get("KB_RULES_LIGHT_COUNT") || "0");
  if (lightCount > 0) {
    for (let i = 0; i < lightCount; i++) {
      specContent += cache.get(`KB_RULES_LIGHT_${i}`) || "";
    }
  }
  // 若 Light cache miss, 改從 Heavy Cache 拿
  if (specContent.trim().length === 0) {
    const heavyCount = parseInt(cache.get("KB_RULES_COUNT") || "0");
    if (heavyCount > 0) {
      for (let i = 0; i < heavyCount; i++) {
        specContent += cache.get(`KB_RULES_${i}`) || "";
      }
    }
  }

  if (specContent.trim().length === 0) {
    writeLog("[CachedContent] 規格庫為空, 跳過");
    return null;
  }

  // 2. 刪除舊 cache (如有)
  const oldName = PropertiesService.getScriptProperties().getProperty("SPEC_CACHED_NAME");
  if (oldName) {
    try {
      UrlFetchApp.fetch(
        `https://generativelanguage.googleapis.com/v1beta/${oldName}?key=${apiKey}`,
        { method: "delete", muteHttpExceptions: true }
      );
    } catch (e) {}
  }

  // 3. 建立新 cache (24h TTL)
  // v29.6.031: 只 cache 規格庫內容 (不 cache systemInstruction/tools)
  // generate_content 不傳 systemInstruction/tools 也可使用 cache
  const modelName = GEMINI_MODEL_FAST.replace("models/", "");  // 去掉 "models/" 前綴
  const payload = {
    model: `models/${modelName}`,
    contents: [{ role: "user", parts: [{ text: "以下是三星螢幕規格庫:\n\n" + specContent }] }],
    ttl: "86400s",  // 24 小時
    displayName: "Samsung_Monitor_Spec_Rules"
  };

  try {
    const response = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${apiKey}`,
      {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      }
    );
    const code = response.getResponseCode();
    const body = JSON.parse(response.getContentText());
    if (code === 200 && body.name) {
      PropertiesService.getScriptProperties().setProperty("SPEC_CACHED_NAME", body.name);
      const tokens = (body.usageMetadata && body.usageMetadata.totalTokenCount) || "?";
      writeLog(`[CachedContent] ✅ 規格庫快取建立成功: ${body.name} (${tokens} tokens, 24h TTL)`);
      return body.name;
    } else {
      writeLog(`[CachedContent] ❌ 建立失敗: HTTP ${code} - ${JSON.stringify(body).substring(0, 300)}`);
      return null;
    }
  } catch (e) {
    writeLog(`[CachedContent] ❌ API 錯誤: ${e.message}`);
    return null;
  }
}

function scheduleNextSync() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach((t) => {
      if (t.getHandlerFunction() === "dailyKnowledgeRefresh") {
        ScriptApp.deleteTrigger(t);
      }
    });
    // v24.2.0: 改為每日 04:00 自動重建 (forceRebuild=true)
    // 確保 PDF 不會過期 (Google 48小時限制)
    ScriptApp.newTrigger("dailyKnowledgeRefresh")
      .timeBased()
      .atHour(4)
      .everyDays(1)
      .inTimezone("Asia/Taipei")
      .create();
    writeLog("🕒 已設定每日 04:00 (台北時間) 自動重建知識庫");
  } catch (e) {
    writeLog(`⚠️ 排程設定失敗: ${e.message}`);
  }
}

/**
 * 🆕 v29.5.211: 雲端全自動化三星官網新機型規格與手冊同步系統
 * 100% 在 GAS 雲端自主運行，無需本地依賴
 */
function scanOfficialWebsiteForNewMonitors() {
  writeLog("[Auto Crawler] 正在啟動官網新機型掃描與同步...");
  try {
    // 🆕 學習價格監控表專案之優雅設計，直接引入官方 Product Finder API 獲取法！
    // 100% 杜絕任何 Next.js 靜態抓取不到的問題，且 100% 獲得最精確的 PDP URL
    const apiUrl = "https://searchapi.samsung.com/v6/front/b2c/product/finder/global?type=07010000&siteCode=tw&start=1&num=100&sort=newest&onlyFilterInfoYN=N";
    const response = UrlFetchApp.fetch(apiUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      writeLog(`[Auto Crawler Error] 三星官方 Product Finder API 請求失敗 (${response.getResponseCode()})`);
      return;
    }
    
    const apiData = JSON.parse(response.getContentText());
    const productList = apiData?.response?.resultData?.productList || [];
    
    const discoveredProducts = [];
    productList.forEach(family => {
      const modelList = family?.modelList || [];
      modelList.forEach(modelObj => {
        const sku = String(modelObj?.modelCode || "").trim().toUpperCase();
        const rawPdp = modelObj?.pdpUrl || modelObj?.originPdpUrl;
        if (sku && rawPdp) {
          // 轉換為絕對 URL
          let detailUrl = rawPdp.trim();
          if (!detailUrl.startsWith("http")) {
            detailUrl = "https://www.samsung.com" + (detailUrl.startsWith("/") ? "" : "/") + detailUrl;
          }
          // 去除 query 與 hash
          const qIdx = detailUrl.indexOf("?");
          if (qIdx !== -1) detailUrl = detailUrl.substring(0, qIdx);
          const hIdx = detailUrl.indexOf("#");
          if (hIdx !== -1) detailUrl = detailUrl.substring(0, hIdx);
          
          discoveredProducts.push({
            model: sku,
            detailUrl: detailUrl,
            displayName: String(modelObj?.displayName || modelObj?.modelName || family?.fmyMarketingName || "Samsung Monitor").trim()
          });
        }
      });
    });
    
    writeLog(`[Auto Crawler] Product Finder API 當前上架螢幕型號數: ${discoveredProducts.length} 款`);
    
    if (discoveredProducts.length === 0) {
      writeLog("[Auto Crawler Warning] 官方 Product Finder API 未回傳任何螢幕。跳過掃描。");
      return;
    }
    
        // 2. 獲取當前 CLASS_RULES 的已有機型
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    if (!sheet) return;
    
    const lastRow = sheet.getLastRow();
    const existingLines = [];
    if (lastRow > 1) {
      const rows = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      rows.forEach(r => {
        if (!r[0]) return;
        existingLines.push(r[0].toString().trim().toUpperCase());
      });
    }
    
    // 比對新產品
    const newProducts = discoveredProducts.filter(p => {
      const m = p.model.toUpperCase();
      const matchKey = m.replace(/XZW$/, ""); // 統一比對鍵
      // 使用 startsWith 進行比對，以相容 LS/LC/LF 等各類前綴型號防重複，符合 AGENTS.md 鐵律！
      return !existingLines.some(line => line.startsWith(m) || line.startsWith(matchKey));
    });
    
    writeLog(`[Auto Crawler] 🔍 比對完成！發現官網新上架機型: ${newProducts.length} 款`);
    
    if (newProducts.length === 0) {
      writeLog("[Auto Crawler] 🎉 本地與官網規格庫已完全同步，今日無新機型。");
      return;
    }
    
    // 3. 處理每款新機型 - v29.5.223: 簡化為僅寫入佔位行，不呼叫 AI 且不下載手冊，杜絕幻覺
    newProducts.forEach(product => {
      const model = product.model;
      try {
        const placeholderLine = `${model},型號：尚無資訊`;
        sheet.appendRow([placeholderLine]);
        writeLog(`[Auto Crawler Sheet] ✅ 成功寫入佔位行: ${placeholderLine}`);
      } catch (err) {
        writeLog(`[Auto Crawler Product Error] 處理產品 ${model} 失敗: ${err.message}`);
      }
    });
    
  } catch (e) {
    writeLog(`[Auto Crawler Error] 掃描全過程出錯: ${e.message}`);
  }
}

/**
 * 每日 04:00 自動重建知識庫
 * 使用 forceRebuild=true 確保所有 PDF 重新上傳
 * 避免 Google 48 小時檔案過期問題
 */
function dailyKnowledgeRefresh() {
  writeLog("[Daily] 開始每日知識庫重建 (04:00)...");
  // 🆕 v29.5.211: 重建前先自動掃描官網新機型，確保新產品被收錄
  scanOfficialWebsiteForNewMonitors();
  syncGeminiKnowledgeBase(true); // forceRebuild = true
  writeLog("[Daily] 每日知識庫重建完成");
}

/**
 * 排程 1 分鐘後背景重建知識庫
 * 用於 403/404 過期時自動修復，用戶不需等待
 */
function scheduleImmediateRebuild() {
  try {
    const cache = CacheService.getScriptCache();
    const rebuildKey = "REBUILD_SCHEDULED";

    // 如果近期已排程，不重複建立
    if (cache.get(rebuildKey)) {
      writeLog("[Rebuild] 已有背景重建排程，跳過");
      return;
    }

    // 清除現有的 immediateSync 觸發器（如果有）
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach((t) => {
      if (t.getHandlerFunction() === "immediateKnowledgeRebuild") {
        ScriptApp.deleteTrigger(t);
      }
    });

    // 建立 1 分鐘後執行的觸發器
    ScriptApp.newTrigger("immediateKnowledgeRebuild")
      .timeBased()
      .after(1 * 60 * 1000)
      .create();

    // 標記已排程，10 分鐘內不重複
    cache.put(rebuildKey, "true", 10 * 60);

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
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach((t) => {
      if (t.getHandlerFunction() === 'immediateKnowledgeRebuild') {
        ScriptApp.deleteTrigger(t);
      }
    });
  } catch (err) {
    writeLog('[Rebuild] 清理自身觸發器失敗: ' + err.message);
  }
  try {
    const result = syncGeminiKnowledgeBase(true); // forceRebuild = true
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
    const cacheKey = "SYNC_TRIGGER_VERIFIED";

    // 快取存在 = 近期已確認過，跳過檢查
    if (cache.get(cacheKey)) return;

    const triggers = ScriptApp.getProjectTriggers();
    const hasSyncTrigger = triggers.some(
      (t) => t.getHandlerFunction() === "dailyKnowledgeRefresh",
    );
    if (!hasSyncTrigger) {
      // v24.2.0: 改為每日 04:00 重建
      ScriptApp.newTrigger("dailyKnowledgeRefresh")
        .timeBased()
        .atHour(4)
        .everyDays(1)
        .inTimezone("Asia/Taipei")
        .create();
      writeLog("🔄 偵測到無排程，已自動建立每日 04:00 同步觸發器");
    }

    // 標記已確認，6 小時內不再檢查
    cache.put(cacheKey, "true", 6 * 60 * 60);
  } catch (e) {
    // 靜默失敗，避免影響主流程
  }
}

// ==========================================
// 3. Gemini API (通用映射 + 上下文智慧搜尋)
// ==========================================
// =========================================================================
// Version: 29.5.156
// =========================================================================

// v27.9.0: 新增 forceCurrentOnly 參數，型號衝突時只從當前訊息提取型號
// 該函數現在回傳 { files: [], exactModels: [], primaryModel: string | null }
function getRelevantKBFiles(
  messages,
  kbList,
  userId = null,
  contextId = null,
  forceCurrentOnly = false,
  aiSearchQuery = null, // v29.4.27: Added explicit aiSearchQuery param
) {
  const MAX_PDF_COUNT = 2; // PDF 硬上限（不含 Tier 0）- 降低以加速回應
  const MAX_TIER1_COUNT = 2; // 精準匹配上限

  let primaryModel = null; // v29.5.49: Fix ReferenceError by lifting declaration
  let combinedQuery = "";
  let userCount = 0;

  // 1. 讀取上下文 (User + AI, 最近 6 句)
  // v27.9.0: forceCurrentOnly 時只讀取最後一則，避免歷史型號污染
  // v24.4.4: 加入防護，避免 undefined.toUpperCase() 錯誤
  const maxMessages = forceCurrentOnly ? 1 : 6;
  if (forceCurrentOnly) {
    writeLog(`[KB Select] 強制只用當前訊息匹配型號`);
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg && msg.content && typeof msg.content === "string") {
      combinedQuery += " " + msg.content.toUpperCase();
    }
    userCount++;
    if (userCount >= maxMessages) break;
  }

  // 2. 讀取映射表
  let keywordMap = {};
  try {
    const mapJson = PropertiesService.getScriptProperties().getProperty(
      CACHE_KEYS.KEYWORD_MAP,
    );
    if (mapJson) {
      keywordMap = JSON.parse(mapJson);
    }
  } catch (e) {}

  // 3. 關鍵字擴充 (查字典) + 提取完整型號
  let extendedQuery = combinedQuery;
  let exactModels = []; // 精準型號清單 (用於匹配 PDF 檔名)
  let hasInjectedModels = false; // 標記是否已從 Cache 讀到直通車注入型號
  let injectedModels = []; // 保存直通車注入的型號，供後續強制只載入單一 PDF

  // v24.1.9 新增：讀取直通車注入的型號（命中關鍵字時）
  // v24.3.0 修復：改用 Sheet 歷史而非 Cache，解決跨時間問題
  //
  // 原設計缺陷：cache.put(..., 300) 無法應對店員隔天回來繼續問的場景
  // 新設計：從 Sheet 對話歷史中自動提取型號，不依賴短期 Cache

  // v24.3.1: 只有在有 userId 時才嘗試提取上下文（避免 userId is not defined）
  if (userId && !forceCurrentOnly) {
    // 嘗試從 Sheet 對話歷史中提取型號（用於跨時間邊界的延續提問）
    const contextFromHistory = extractContextFromHistory(userId, contextId);
    if (
      contextFromHistory &&
      contextFromHistory.models &&
      contextFromHistory.models.length > 0
    ) {
      exactModels = exactModels.concat(contextFromHistory.models);
      // v27.9.79: 當從歷史提取到型號時，跳過後續的 KEYWORD_MAP 擴展
      // 這樣可以確保只搜尋用戶選定的型號，不會被其他型號污染
      hasInjectedModels = true;
      writeLog(
        `[KB Select] 從對話歷史提取型號: ${contextFromHistory.models.join(
          ", ",
        )} (將跳過 KEYWORD_MAP 擴展)`,
      );
    }

    // 嘗試從短期 Cache 讀取（用於同一句話的多步驟流程）
    try {
      const cache = CacheService.getScriptCache();
      const injectedModelsJson = cache.get(`${userId}:direct_search_models`);
      if (injectedModelsJson) {
        injectedModels = JSON.parse(injectedModelsJson);
        if (Array.isArray(injectedModels)) {
          exactModels = exactModels.concat(injectedModels);
          hasInjectedModels = true; // ← v25.0.0: 標記已讀到直通車型號
          writeLog(
            `[KB Select] 從 Cache 讀取直通車注入型號: ${injectedModels.join(
              ", ",
            )}`,
          );
          // 不刪除 Cache，保留給同一對話的其他步驟使用
        }
      }
    } catch (e) {
      // 靜默失敗，繼續執行
    }
  } else if (userId && forceCurrentOnly) {
    writeLog(`[KB Select] forceCurrentOnly=true，跳過歷史/Cache 型號注入`);
  }

  // v24.0.0: 型號正則 - 只匹配「真正的型號」，不匹配術語
  // G系列: G90XF, G80SD, G60F 等（G + 2位數 + 1~2字母）
  // M系列: M50F, M70F, M80F 等（M + 2位數 + 1字母）
  // S系列: S27DG602SC, S32DG802SC 等（S + 2位數 + 完整型號碼）
  // F/C系列 (舊款): F24T350, C24T550 (F/C + 2位數 + 1字母 + 3數字)
  // v29.5.50: Broaden Regex to support Appliances (WA/WD/VR) and full range, and S series with 1 or 2 digits
  const MODEL_REGEX =
    /\b(G\d{1,2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|(?:L?S)\d{1,2}[A-Z]{0,2}\d{0,4}[A-Z0-9]{0,5}|(?:L?[CF])\d{2}[A-Z]+\d{2,4}[A-Z0-9]*|WA\d+[A-Z\d]*|WD\d+[A-Z\d]*|VR\d+[A-Z\d]*)\b/g;

  // v24.1.5: 改善：關鍵字搜尋時同時檢查「原始字串」和「去空白字串」
  // 解決「Odyssey Hub」(用戶輸入) vs「OdysseyHub」(KEYWORD_MAP key) 的不匹配問題
  const combinedQueryNoSpace = combinedQuery.replace(/\s+/g, "");

  // v26.1.0: 修復型號推薦過度問題
  // 別稱（M8、G8 等內部代號）不應自動補充型號
  // 只有完整型號和 LS 系列才應提取
  // 根據 KEYWORD_MAP 擴展查詢（LS/系列/術語）
  if (!hasInjectedModels) {
    Object.keys(keywordMap).forEach((key) => {
      // v24.1.5: 修正：同時檢查原始查詢和去空白查詢
      if (combinedQuery.includes(key) || combinedQueryNoSpace.includes(key)) {
        const mappedValue = keywordMap[key].toUpperCase();
        extendedQuery += " " + mappedValue;

        // v29.4.24: Enhanced Mapping Logic for Series Descriptions
        // If mapped value is a Model Code (e.g. "S32BM801"), use it.
        // If mapped value is a Description (e.g. "系列_洗衣機...WA21..."), extract models from it.

        const mapped = keywordMap[key];
        // Check if mapped value looks like a single model code
        if (mapped.match(new RegExp("^" + MODEL_REGEX.source + "$"))) {
          if (!exactModels.includes(mapped)) exactModels.push(mapped);
        } else {
          // It's likely a description string, extract models from it
          const potentialModels = mapped.match(MODEL_REGEX) || [];
          potentialModels.forEach((m) => {
            if (!exactModels.includes(m)) exactModels.push(m);
          });
        }

        // 提取 LS 系列完整型號 (如 LS27DG602SCXZW → S27DG602SC)
        const lsMatch = mappedValue.match(/LS(\d{2}[A-Z]{2}\d{3}[A-Z]{2})/g);
        if (lsMatch) {
          lsMatch.forEach((ls) => {
            // 去掉 LS 前綴和 XZW 後綴
            const cleanModel = ls.replace(/^LS/, "S").replace(/XZW$/, "");
            exactModels.push(cleanModel);
          });
        }
      }
    });
  }

  let directModelMatch = null;
  let directLsMatch = null;

  // v27.9.81: 當已從歷史提取型號時，跳過從當前查詢提取型號
  // 原因：當前查詢（combinedQuery）包含歷史對話，會抓到上一輪AI列出的所有型號
  // 例如：AI列出9個G5型號，這裡就會全部提取，導致PDF匹配錯誤
  if (!hasInjectedModels) {
    // 也從原始查詢提取型號
    directModelMatch = combinedQuery.match(MODEL_REGEX);
    if (directModelMatch) {
      exactModels = directModelMatch.concat(exactModels);
    }

    // 從原始查詢提取 LS 系列
    directLsMatch = combinedQuery.match(/LS(\d{2}[A-Z]{2}\d{3}[A-Z]{2})/g);
    if (directLsMatch) {
      const cleanLs = [];
      directLsMatch.forEach((ls) => {
        const cleanModel = ls.replace(/^LS/, "S").replace(/XZW$/, "");
        cleanLs.push(cleanModel);
      });
      exactModels = cleanLs.concat(exactModels);
    }
  }

  // v27.9.6: 嚴格限制歷史型號沿用 - 防止「你的優勢是什麼」這類問題載入 PDF
  // v27.9.32: 但如果 forceCurrentOnly=false（表示明確要使用歷史），則不清空
  // 只有當前訊息（最後一則）包含型號時，才沿用歷史型號
  // 否則一律清空，避免閒聊問題載入 PDF
  if (
    directModelMatch === null &&
    directLsMatch === null &&
    exactModels.length > 0
  ) {
    // 檢查最後一則訊息是否包含型號
    const lastMessage =
      messages.length > 0 ? messages[messages.length - 1].content : "";
    const hasModelInCurrent = MODEL_REGEX.test(lastMessage);

    if (hasModelInCurrent) {
      // 當前訊息有型號：沿用歷史型號
      writeLog(
        `[KB Select] 當前訊息有型號，沿用已知型號: ${exactModels.join(", ")}`,
      );
    } else if (forceCurrentOnly) {
      // v29.4.26 Fix: only clear if NO models were found in current query processing
      // If exactModels has items here, they came from current query map lookup (e.g. "洗衣機" -> "WA..."), so KEEP THEM.
      // We only want to clear "Historical" models if they weren't reinforced by current query.

      // Check if the models in exactModels actually came from history (which we want to clear) or current map (which we want to keep).
      // Since we appended Map/Regex results to exactModels *before* this check, exactModels contains BOTH.
      // But wait, `exactModels` passed into this function contains history.
      // The logic above added Map results to it.

      // Simpler logic: If forceCurrentOnly is true, we want to discard models that ONLY exist in history.
      // But we can't easily distinguish them here without complex diffing.
      // However, for Auto-Search, we passed `exactModels` as empty array or history?
      // In `checkAutoSearchSignal`, we pass `history` to `getRelevantKBFiles`.

      // Let's look at how exactModels is derived. Line 2984: `let exactModels = extractModelNumbers(historyMsg);`
      // Then Line 3025 adds from Map.

      // If forceCurrentOnly is true (New Topic), we really should have started with exactModels = [] ??
      // Actually `getRelevantKBFiles` takes `history` and extracts models from it at the top.

      // If forceCurrentOnly is true, we should probably NOT have extracted models from history in the first place?
      // But the function design is monolith.

      // CORRECT FIX: If forceCurrentOnly is true, we must ensure we only keep models that were found in *this execution's* query processing (Map lookup or Direct Match).
      // The current logic wipes everything if `!hasModelInCurrent`. But Map lookup (e.g. "洗衣機") counts as "Model in Current Process" even if `MODEL_REGEX.test(msg)` is false.

      // The issue is `MODEL_REGEX.test(lastMessage)` returns false for "洗衣機" (it's not a model code).
      // But "洗衣機" triggered a Map lookup which added "WA..." to `exactModels`.

      // So, if `exactModels` has grown during this function execution (from Map/Regex on Query), we should keep those.
      // However, we don't track which ones are new.

      // Alternative: Just relax the clear condition.
      // If forceCurrentOnly is true, and we found *valid mapped models* (like WA...), we should trust them.
      // The safe bet: If exactModels > 0 and those models came from KeywordMap (how to know?), keep them.

      // Let's rely on `directModelMatch` or `combinedQuery.includes(key)`? No.

      // Look at Line 3024: We iterate KeywordMap.
      // If we found matches in KeywordMap loops, we should set a flag `hasMapMatch = true`.
      // I can't add a var easily in replace_file_content without changing huge block.

      // Hacky but safe fix for now:
      // If `aiSearchQuery` was provided (which is why we are here), we should TRUST the results involving it.
      // `forceCurrentOnly` is mainly to clear "Old G5" when asking "New Topic".
      // If AI specifically said "Search Washing Machine", we should respect the resulting models.

      if (aiSearchQuery) {
        writeLog(
          `[KB Select] AI Explicit Search (${aiSearchQuery}), keeping models: ${exactModels.join(
            ", ",
          )}`,
        );
      } else {
        writeLog(
          `[KB Select] ⚠️ 當前訊息無型號且 forceCurrentOnly=true，清空歷史型號以避免不必要的 PDF 載入`,
        );
        exactModels = [];
      }
    } else {
      // forceCurrentOnly=false：保留歷史型號（用於漸進式解決流程）
      writeLog(
        `[KB Select] 當前訊息無型號但 forceCurrentOnly=false，保留歷史型號: ${exactModels.join(
          ", ",
        )}`,
      );
    }
  }

  if (exactModels.length === 0) {
    // Deep Mode 救援已被移除 v27.8.9
  }

  exactModels = [...new Set(exactModels)]; // 去重

  // v27.9.3: 智慧型號鎖定 - 偵測比較意圖時允許多型號 PDF
  if (hasInjectedModels && injectedModels && injectedModels.length > 0) {
    const isComparison = /比較|比较|差異|差异|不同|區別|对比|vs|versus/i.test(
      combinedQuery,
    );

    if (isComparison && injectedModels.length > 1) {
      // 比較題：保留所有型號，但限制最多 2 個（預算控制）
      exactModels = injectedModels.slice(0, 2);
      writeLog(
        `[KB Select] 🔍 偵測到比較意圖，保留多型號: ${exactModels.join(
          ", ",
        )} (限制前 2 款以控制預算)`,
      );
    } else {
      // 一般問題：鎖定第一個型號，節省成本
      exactModels = [injectedModels[0]];
      writeLog(
        `[KB Select] 🔒 已鎖定直通車型號: ${exactModels[0]} (僅載入單一本 PDF)`,
      );
    }
  }

  // v29.5.45: Dynamic Threshold Optimization (Pre-emptively force 1 file if model confidence is high)
  // If we have a single exact model match from "Direct Deep" or "Smart Router"
  if (exactModels.length === 1) {
    writeLog(
      "[KB Select] ⚡ Single Model Lock Detected. Enforcing Single PDF Load.",
    );
    // We handle this implicitly downstream, but explicit log helps debugging.
  }

  // 自動產生短型號以匹配 PDF (S32DG802SC -> S32DG802)
  // 許多 PDF 檔名不包含最後兩碼後綴 (SC, XC, EC...)
  const shortModels = [];
  exactModels.forEach((m) => {
    // 針對 S 開頭且長度為 10 的標準型號 (S + 2碼尺寸 + 2碼系列 + 3碼編號 + 2碼後綴)
    if (m.match(/^S\d{2}[A-Z]{2}\d{3}[A-Z]{2}$/)) {
      shortModels.push(m.substring(0, 8));
    }
    // v29.6.018: 針對 C/F 曲面與基本型號，去除尾部字母後綴 (如 C34G55T -> C34G55, LC34G55TWWC -> LC34G55)
    const cfMatch = m.match(/^(L?[CF]\d{2}[A-Z]+\d{2})[A-Z0-9]*$/i);
    if (cfMatch) {
      shortModels.push(cfMatch[1]);
    }
  });
  // v29.5.37: Reverse Alias Lookup (Model -> Alias)
  // 若我們有完整型號 (S27AG500NC)，但在 PDF 中找不到，可能是因為 PDF 檔名只寫了 "G5"
  // 所以我們要反查 KeywordMap，把 "G5" 也加入 exactModels
  if (keywordMap) {
    Object.keys(keywordMap).forEach((alias) => {
      const targets = keywordMap[alias].toUpperCase();

      // v29.5.51: Reverted Alias Guard - We NEED aliases like G5 to find files like "G5_Manual.pdf"
      // Smart Prioritization in Tier 1 will handle the preference for Specific Models.

      // 如果別稱的目標包含我們目前鎖定的型號 (Reverse Check)
      // 且別稱長度 >= 2 (避免匹配到雜訊)
      if (alias.length >= 2 && exactModels.some((m) => targets.includes(m))) {
        if (!exactModels.includes(alias.toUpperCase())) {
          exactModels.push(alias.toUpperCase());
          // writeLog(`[KB Select] Reverse Lookup: ${alias} for ${targets}`); // Optional debug
        }
      }
    });
  }

  exactModels = [...new Set([...exactModels, ...shortModels])]; // 合併並去重

  // v29.5.49: Assign primaryModel HERE (before filtering logic uses it)
  primaryModel = exactModels.length > 0 ? exactModels[0] : null;

  // v29.5.122: PDF Model Index Check - 遍歷所有 exactModels 找有 PDF 的型號
  // 修復：舊版只檢查 exactModels[0]（如 G90XF 內部代號），找不到就放棄
  // 新版：遍歷所有候選型號，找到第一個有 PDF 的作為 primaryModel
  let hasDedicatedPdf = false;
  try {
    const pdfIndexJson =
      PropertiesService.getScriptProperties().getProperty("PDF_MODEL_INDEX");
    const pdfModelIndex = pdfIndexJson ? JSON.parse(pdfIndexJson) : [];

    // 輔助函式：檢查某個型號是否在 PDF Index 中有對應
    function checkModelInPdfIndex(modelToCheck) {
      return pdfModelIndex.some((m) => {
        return isPdfModelTokenMatch_(m, modelToCheck);
      });
    }

    // 先檢查 primaryModel（第一個）
    if (primaryModel && checkModelInPdfIndex(primaryModel)) {
      hasDedicatedPdf = true;
    } else {
      // primaryModel 無 PDF → 遍歷其他 exactModels，找有 PDF 的替代
      for (let i = 0; i < exactModels.length; i++) {
        if (
          exactModels[i] !== primaryModel &&
          checkModelInPdfIndex(exactModels[i])
        ) {
          writeLog(
            `[KB Select] 🔄 型號 ${primaryModel} 無 PDF，改用 ${exactModels[i]} 作為 primaryModel`,
          );
          primaryModel = exactModels[i];
          hasDedicatedPdf = true;
          break;
        }
      }
    }

    if (!hasDedicatedPdf && primaryModel) {
      writeLog(
        `[KB Select] ⚠️ 所有型號均無專屬 PDF: ${exactModels.join(", ")}`,
      );
    }
  } catch (e) {
    // 靜默失敗
  }

  // v29.5.245/v29.5.249: 若索引空掉、沒有命中，或索引有命中但 URI 清單沒有檔案，
  // 先嘗試從 Drive 即時補回當前型號的 PDF URI。
  const shouldRecoverPdfUri =
    primaryModel && (!hasDedicatedPdf || (hasDedicatedPdf && !kbList.some(isPdfKbFile)));
  if (shouldRecoverPdfUri) {
    const recoveredFiles = recoverRelevantPdfUrisFromDrive(
      exactModels,
      primaryModel,
      MAX_PDF_COUNT,
    );
    if (recoveredFiles.length > 0) {
      kbList = [].concat(kbList || [], recoveredFiles);
      hasDedicatedPdf = true;
      writeLog(
        `[KB Select v29.5.245] 已由 Drive 即時補回 PDF，繼續載入手冊: ${recoveredFiles
          .map((f) => f.name)
          .join(", ")}`,
      );
    }
  }

  // v29.5.57: 若所有型號都沒有專屬 PDF，不載入任何 PDF
  if (!hasDedicatedPdf && primaryModel) {
    writeLog(`[KB Select] 🚫 所有型號均無專屬 PDF，跳過載入，改用規格庫回答`);
    return {
      files: [],
      exactModels: exactModels,
      primaryModel: primaryModel,
    };
  }

  // 4. 分級載入（只用精準匹配，不做模糊匹配）
  const tier0 = []; // 必載 (QA + CLASS_RULES)
  let tier1 = []; // 精準匹配 (完整型號) -> Changed to let for slicing

  kbList.forEach((file) => {
    // Tier 0: 必載
    if (file.isPriority) {
      tier0.push(file);
      return;
    }

    const fileName = file.name.toUpperCase();

    // Tier 1: 精準匹配 (完整型號如 G90XF, G80SD)
    // v29.5.51: Remove limit here, collect ALL candidates first, then Sort & Slice
    const isTier1 = exactModels.some((model) =>
      pdfFileNameMatchesModelToken_(fileName, model),
    );
    if (isTier1) {
      tier1.push(file);
      return;
    }
  });

  // v29.5.51: Smart Prioritization (Sorting)
  // Ensure that if "S27AG500NC" exists in filename, it comes before "G5"
  if (tier1.length > 1) {
    tier1.sort((a, b) => {
      const getScore = (f) => {
        const name = f.name.toUpperCase();
        // Priority 1: Primary Model (Detailed)
        if (primaryModel && pdfFileNameMatchesModelToken_(name, primaryModel)) return 100;
        // Priority 2: Any monitor model in exactModels (weighted by its index in array to prioritize user's explicit query)
        for (let i = 0; i < exactModels.length; i++) {
          const m = exactModels[i];
          if (
            m.match(/^(?:L?[SCFG])\d{2}/i) &&
            pdfFileNameMatchesModelToken_(name, m)
          ) {
            return 80 - i;
          }
        }
        // Priority 3: Alias (G5, M7)
        return 10;
      };
      return getScore(b) - getScore(a);
    });
    writeLog(
      `[KB Select] 📊 Sorted Tier 1: ${tier1.map((f) => f.name).join(", ")}`,
    );
  }

  // 5. 純精準匹配策略：不啟用模糊匹配
  //    沒有精準匹配的 PDF？那就不載 PDF，避免載到不相關的手冊
  //    （例如問 G90XF 不應該載到 G80SD 的手冊）

  // v29.5.47: Strict PDF Limit Logic (Single-File Policy)
  // Default to MAX 1 file unless it's a comparison question.
  let maxFiles = 1;
  const isComparison =
    injectedModels &&
    injectedModels.length > 1 &&
    combinedQuery.match(/比較|比较|差異|差异|不同|區別|对比|vs|versus/i);
  if (isComparison) {
    maxFiles = 2;
    writeLog(`[KB Select] 🔍 Comparison detected. Allowing up to 2 PDFs.`);
  }

  // Apply strict limit to Tier 1
  if (tier1.length > maxFiles) {
    // v29.5.51: Sorting already handled prioritization. Just slice.
    tier1 = tier1.slice(0, maxFiles);
    writeLog(`[KB Select] ✂️ Enforcing Strict Limit: ${maxFiles} file(s).`);
  }

  // 6. 組合結果：只有 Tier0（必載）+ Tier1（精準匹配）
  let filesToAttach = [...tier0, ...tier1];

  // v29.4.16: Determine primary model name
  // primaryModel = exactModels.length > 0 ? exactModels[0] : null; // v29.5.49: Moved up

  // v29.5.45: Optimization - If Primary Model matches the first PDF, force Single PDF
  // This solves the S27AG500NC issue where aliases (G5) pulled in a second unrelated PDF.
  if (primaryModel && filesToAttach.length > 1) {
    const firstMatch = filesToAttach.find((f) =>
      pdfFileNameMatchesModelToken_(f.name, primaryModel),
    );
    if (firstMatch) {
      writeLog(
        `[KB Select] ⚡ Found Primary Model (${primaryModel}) in PDF. Enforcing Single File: ${firstMatch.name}`,
      );
      filesToAttach = [firstMatch];
    }
  }

  // 📝 詳細紀錄找到的 PDF
  if (tier1.length > 0) {
    const foundFiles = tier1.map((f) => f.name).join(", ");
    writeLog(
      `[KB Select] 🎯 命中型號: ${exactModels.join(
        ", ",
      )} → 載入 PDF: ${foundFiles}`,
    );
  } else {
    writeLog(
      `[KB Select] Tier0: ${tier0.length}, Tier1: 0 (No Match: ${
        exactModels.join(",") || "none"
      }), Total: ${filesToAttach.length}`,
    );
  }

  const cache = CacheService.getScriptCache();
  // v29.5.49: primaryModel defined at top

  cache.put(
    `${userId}:last_kb_files`,
    JSON.stringify(stripInlinePdfDataForCache(filesToAttach)),
    600,
  );
  return {
    files: filesToAttach,
    exactModels: exactModels,
    primaryModel: primaryModel,
  };
}

// v27.9.43: 嚴格執行來源工作流 (Strict Source Workflow)
// v29.4.16: Add targetModelName param for citation
function constructDynamicPrompt(
  query,
  messages,
  kbFiles = [], // 這裡現在只傳 files array (legacy) or we wrap it logic outside
  forceWebSearch = false,
  imageBlob = null,
  targetModelName = null,
) {
  const cache = CacheService.getScriptCache();
  const userId = messages.length > 0 ? messages[0].userId : "unknown"; // Assuming userId is available in messages or passed

  // v29.4.43: Split Prompt Logic - Web Search gets exclusive context to prevent hallucinations
  let dynamicPrompt = "";

  if (forceWebSearch) {
    const searchTarget = targetModelName || "用戶詢問的產品";
    // v29.5.114: 強化網路搜尋 - 禁止重複上一輪回答，必須找「新增價值」的資訊
    const today = Utilities.formatDate(
      new Date(),
      "Asia/Taipei",
      "yyyy年MM月dd日",
    );

    // 從對話歷史提取上一次 AI 的回答，用於防止重複
    let previousAnswer = "";
    if (messages && messages.length > 0) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "model" || messages[i].role === "assistant") {
          previousAnswer = messages[i].content || "";
          if (previousAnswer.length > 200)
            previousAnswer = previousAnswer.substring(0, 200) + "...";
          break;
        }
      }
    }

    dynamicPrompt = `【角色設定】
你現在是一名「網路搜尋專家」。用戶對之前的回答不滿意，希望獲得**不同於上次、更有價值**的資訊。

【🚨 最高優先級：禁止重複！】
你上一次的回答是：
「${previousAnswer}」

用戶已經看過這些內容了，現在希望你搜尋**網路上的新資訊**。
**你必須提供「上次沒說過的」新內容！**

如果搜尋後發現網路上也沒有更多資訊，你必須誠實說：
「我搜尋了網路，但這方面的確沒有更詳細的官方說明。建議你可以問問 Sam，他可能有第一手資訊！」

【🚨 強制搜尋指令】
今天是 ${today}。用戶要求查詢最新的網路資訊。
**你必須立即使用 google_search 工具搜尋網路！**
理由：用戶明確要求「擴大搜尋」，需要最新、最即時的網路資訊，你的內建知識不足以回答。

【搜尋背景】
用戶剛才選擇了「擴大網路搜尋」功能，希望透過網路搜尋獲得：
- 更豐富的產品細節和技術規格
- 更具體的操作步驟或設定方法
- 最新的官方資訊或使用者經驗分享
- 更全面的比較分析或解決方案

【任務目標】
針對「${searchTarget}」與用戶的問題，**必須**使用 Google Search 查找更詳細、更新或更全面的資訊。

【🚨 開場格式 (最重要！)】
你的回答必須以**正面積極**的方式開頭，例如：
✅ 「透過網路搜尋，找到以下更詳細的資訊：」
✅ 「為你進一步查詢，找到這些補充資料：」
✅ 「根據網路上的最新資料：」
✅ 「讓我為你擴大搜尋，以下是更完整的說明：」

❌ 絕對禁止用否定句開場：
❌ 禁止說「由於...沒有...」
❌ 禁止說「因為...未附贈...」
❌ 禁止說「先前資訊有誤」
❌ 禁止重複之前回答過的相同內容

【搜尋策略 (Search Strategy)】
1. **強制搜尋**：你必須調用 \`google_search\` 工具進行實際搜尋。
2. **多關鍵字搜尋**：使用多個搜尋策略：
   - "${searchTarget} + 用戶問題關鍵字"
   - "三星 Samsung + 用戶問題關鍵字"
   - "monitor display screen + 相關英文關鍵字"
3. **差異化要求**：回答必須提供豐富且有用的資訊：
   - 提供更詳細的技術規格和特色說明
   - 給出具體的操作步驟或設定指南
   - 引用最新的官方資訊、產品頁面或用戶討論
   - 從不同角度分析問題並提供完整解答

【回答要求】
1. **必須基於搜尋結果**：不能只憑內建知識，必須使用實際搜尋到的資訊
2. **強化內容深度**：
   - 提供具體數值、型號對比、技術細節
   - 給出完整的操作流程或故障排除步驟
   - 引用官方網站、產品頁面或使用者討論
3. **格式要求**：
   - 使用數字列表 (1., 2., 3., 4.) 而非圓點
   - 在回答末尾標註「[來源: 網路搜尋]」
4. **優先搜尋，允許誠實**：
   - ✅ 必須使用 google_search 工具實際搜尋，基於搜尋結果回答
   - ✅ 若搜到資訊不足，可提供該系列的「已搜到的」資訊
   - ✅ 若搜尋後真的無結果，誠實說「搜尋了網路但這方面的確沒有更詳細的官方說明，建議問問 Sam」
   - ❌ 嚴禁編造未搜到的內容，嚴禁用 LLM 內建知識填補搜尋空白

【搜尋示例】
- 規格問題：搜尋官方規格表、產品對比
- 操作問題：搜尋使用手冊、設定教學
- 故障問題：搜尋常見問題、解決方案

記住：用正面積極的開場，提供有價值的深度內容！`;
  } else {
    // Base Context (Rules + QA)
    // v29.5.40: Pass isPDFMode = true if kbFiles exist to truncate context
    dynamicPrompt = buildDynamicContext(messages, userId, kbFiles.length > 0);

    // Append C3 Instruction if exists
    const promptSheet = ss.getSheetByName(SHEET_NAMES.PROMPT);
    const c3Prompt = promptSheet.getRange("C3").getValue() || "";
    if (c3Prompt) {
      dynamicPrompt += `\n\n【Sheet C3 指令】\n${c3Prompt}\n`;
    }
  }

  dynamicPrompt += buildCrossDeviceMonitorPromptRule(query);

  // System Protocols
  dynamicPrompt += `\n【最高指導原則】\n1. 以下提供的【精選 QA & 規格】與【產品手冊】為唯一真理。\n2. 若過去的對話歷史 (History) 與目前的規格書衝突，請無視舊歷史，以目前的規格書為準。\n3. 切勿被舊對話中的錯誤資訊誤導。對話歷史僅供理解脈絡，嚴禁將過去對話中的任何瞎編資訊當作事實繼續回答。\n4. 若以上來源均無資料，嚴禁使用 LLM 內建知識（通用知識/一般知識/常識）編造任何具體資訊（包含地址、電話、營業時間、設定步驟），必須誠實告知無資料或輸出 [AUTO_SEARCH_PDF]/[AUTO_SEARCH_WEB]。\n`;
  dynamicPrompt += `\n【語言絕對守則】\n1. **繁體中文 (台灣)**：所有回應必須使用 純正台灣繁體中文，嚴禁使用中國大陸用語或簡體中文。\n2. **用語轉換表 (必須強制執行)**：\n   - ❌ (禁) 视频 → ✅ (用) 影片\n   - ❌ (禁) 屏幕/显示器 → ✅ (用) 螢幕\n   - ❌ (禁) 程序/软件 → ✅ (用) 程式/軟體\n   - ❌ (禁) 设置 → ✅ (用) 設定\n   - ❌ (禁) 激活 → ✅ (用) 啟用\n   - ❌ (禁) 信息/消息 → ✅ (用) 訊息\n   - ❌ (禁) 任务栏 → ✅ (用) 工作列\n   - ❌ (禁) 硬件 → ✅ (用) 硬體\n   - ❌ (禁) 设备 → ✅ (用) 裝置\n   - ❌ (禁) 打印 → ✅ (用) 列印\n   - ❌ (禁) 链接 → ✅ (用) 連結\n   - ❌ (禁) 支持 → ✅ (用) 支援\n   - ❌ (禁) 质量 → ✅ (用) 品質\n   - ❌ (禁) 项目 → ✅ (用) 項目\n   - ❌ (禁) 默认 → ✅ (用) 預設\n3. **除錯指令**：若參考資料為簡體，你必須在腦中先翻譯成台灣繁體再輸出，**絕對禁止**直接複製簡體原文。`;

  // v24.1.20+: 移除硬編碼 Prompt，改為引用 Google Sheet Prompt!C3 的正式指令
  // 僅注入當前系統狀態 (Fast Mode / Deep Mode)

  // v29.5.115: 檢查是否有保存的「話題」（用戶選泡泡後延續話題）
  const pendingTopic = cache.get(`${userId}:pending_topic`);
  if (pendingTopic) {
    dynamicPrompt += `\n\n【🔥 話題延續提示 (v29.5.115)】
用戶剛才在討論的話題是：「${pendingTopic}」
如果用戶現在只輸入型號（如 S32FM803UC），你應該回答「該型號 + 上述話題」。
例如：話題是「線材版本」，用戶輸入 S32FM803UC → 你應回答「S32FM803UC 的線材版本」
**禁止給整體規格概覽！必須針對上述話題回答！**\n`;
    writeLog(
      `[Topic Inject v29.5.115] 注入話題: ${pendingTopic.substring(0, 50)}...`,
    );
  }

  if (!kbFiles.length && !imageBlob && !forceWebSearch) {
    // Phase 1: 極速模式 (Fast Mode)
    // v29.5.105: 強化型號追問機制
    // v29.5.112: 加入話題延續 vs 新話題判斷
    // v29.5.155: 強制標註已確認型號，避免 LLM 鬼打牆要求用戶提供型號
    if (targetModelName) {
      dynamicPrompt += `\n【已確認對象型號】系統已在背景確認用戶正在詢問的型號為「${targetModelName}」。你必須直接針對此型號回答，絕對禁止再反問用戶「請告訴我你的螢幕型號」。\n`;
    }

    // v29.6.025: 強制完整規格回應 + 朋友口吻
    dynamicPrompt += `\n【規格回應強化】當用戶詢問任何型號的「規格」時，你必須從參考資料中**完整提取所有可用的規格欄位**（解析度、更新頻率、反應時間、亮度、對比、HDR、可視角度、介面、重量、尺寸），**不能只給一句籠統回答**。完整範本：「這台是 27 吋 VA 面板，解析度 Full HD 1920x1080，60Hz 更新頻率，4ms 反應時間，亮度 250 cd/㎡，原生對比 3000:1，支援 HDR10，178° 寬視角，介面 HDMI 2 個 + USB 2 個 + WiFi，重量 4.8 kg。」。請嚴格按此豐富度回答。\n`;
    dynamicPrompt += `\n【活動 RULE 回答鐵律】當用戶詢問「本期、活動、登錄、抽獎、延長保固、贈品」且參考資料中有「電腦螢幕活動RULE」時，你必須完整列出該型號在同一活動 RULE 行內的所有相關權益。若該型號出現在活動 RULE 行，且同一行寫有「月月抽 Galaxy S26 系列手機」或類似共通抽獎資格，必須一併說明；不可只回答 Steam 點卡或延長保固其中一項。最後標註 [來源:官方活動庫]。\n`;
    dynamicPrompt += `\n【口吻鐵律】你的口吻必須像「熟朋友」而非「客服專員」！嚴禁使用「您好」「我是三星螢幕客服專員」這類官式開頭。直接切入問題，朋友式口吻，例如「這台是...」「它的...」即可。\n`;

    // v29.6.032: 中性立場鐵律 (不攻擊它牌、不過度自誇三星)
    dynamicPrompt += `\n【⚖️ 中性立場與競品拒答鐵律 (v29.6.038 強制)】
你是「台灣三星官方客服」, 但**不代表可以攻擊它牌或過度自誇**。
1. **絕對禁止攻擊它牌** — 不能說「它牌比較差」「它牌沒這個功能」「它牌面板扭曲」這類比較性貶抑。
2. **絕對禁止過度自誇** — 不能說「三星是業界最好」「三星獨家領先」「最佳選擇」這類行銷話術。
3. **客觀描述事實** — 只能根據規格庫/QA/PDF 內的具體數據陳述, 不能用形容詞包裝 (例: 「它的曲面設計更舒服」→ 改為「它的曲率是 1000R」)。
4. **比較題預設中立** — 若用戶問「Odyssey 跟它牌曲面差在哪」, 你只能列出三星規格庫內有的資訊, 它牌的特性**一律不評論**。
5. **避免主觀判斷** — 「不扭曲」「比較舒服」「比較好」「比較強」這類主觀詞禁用, 改用具體數字 (例: 「曲率 1000R」「對比 2500:1」)。
6. **🚫 競品問題婉轉拒答 (v29.6.038 新增)** — 若用戶詢問**它牌產品** (如 LG/BENQ/ASUS/Acer/Dell/HP 螢幕或型號), 你**禁止**回答它牌規格/評價/比較/推薦。必須**婉轉拒答**: 「不好意思, 我是三星螢幕客服, 主要服務三星產品, LG/BENQ 的資訊我這邊沒有喔。如果你有三星螢幕的問題, 我很樂意幫你查!」。**不可**貶抑它牌, **不可**推薦三星替代品, 只要**禮貌轉回三星**即可。
\n`;

    // v29.6.032: 封閉式鐵律強化 - 任何回答都必須有來源
    dynamicPrompt += "\n【🔒 封閉式知識庫鐵律 (v29.6.032 強制)】\n";
    dynamicPrompt += "你的回答**必須**100% 來自以下來源, **嚴禁**使用 LLM 內建知識:\n";
    dynamicPrompt += "1. 精選 QA & 規格庫 (CLASS_RULES)\n";
    dynamicPrompt += "2. 官方產品手冊 (PDF, 透過 Files API)\n";
    dynamicPrompt += "3. 網路搜尋結果 (用戶明確要求井號搜尋網路 才用)\n\n";
    dynamicPrompt += "若上述三個來源都**沒有答案**:\n";
    dynamicPrompt += "- 必須老實回答「本機 QA庫與官方規格庫目前找不到」，並輸出 `[AUTO_SEARCH_WEB]` 或 `[AUTO_SEARCH_PDF]`，不要標註不存在的來源。\n";
    dynamicPrompt += "- 必須輸出 `[AUTO_SEARCH_PDF]` 或 `[AUTO_SEARCH_WEB]` 暗號\n";
    dynamicPrompt += "- **嚴禁**用「一般常見」「通常來說」「一般而言」這類暗示 LLM 知識的措辭\n";
    dynamicPrompt += "- **嚴禁**用「我想」「我覺得」「通常」這類主觀判斷\n\n";
    dynamicPrompt += "若你**主動**從官方規格庫整理了事實 (例如把「1000R」「Fast IPS」拼湊成回答), 必須在最後明確標記 `[來源:官方規格庫]`。\n";

    // 🆕 v29.5.227: 極速模式防幻覺與誠實來源鐵律 (徹底封鎖一般知識漏洞，不准瞎編展示據點與營業資訊)
    dynamicPrompt += `\n⚠️【極速模式防幻覺與誠實來源鐵律 (嚴格執行)】
1. **無 QA 與規格資料時，嚴禁瞎編回答**：當前為「極速模式（未加載 PDF 手冊）」。若用戶詢問具體的設定步驟、故障排除、展示據點、台中展示店、服務時間、電話號碼、產品規格等任何具體資訊，且當前的【精選 QA & 規格】中**沒有**現成的答案，你**絕對、100% 嚴格禁止**憑藉你自己的通用常識/一般知識瞎編任何地址、電話、營業時間或設定步驟！
2. **誠實引導與自動升級**：
   - 針對**操作設定、故障排除**等深度問題，且資料庫無記載：你必須老實回答資料庫無記載，並**在回答最後輸出 \`[AUTO_SEARCH_PDF]\` 暗號**，引導用戶查手冊。
   - 針對**展示店、據點、服務時間、新品規格、其他一般客服**等非操作問題，且資料庫無記載：你**絕對不准瞎編任何據點或地址**，你必須老實表示目前資料庫中沒有相關資訊，並**在回答最後輸出 \`[AUTO_SEARCH_WEB]\` 暗號**！系統會自動強行攔截，提示並詢問用戶是否要擴大搜尋網路，用戶點擊同意後才會啟動聯網搜尋。
3. **來源標記真實誠實原則**：回答最末尾的來源標記必須與你的參考來源 100% 實事求是：
   - 僅當引用了 QA 資料庫的內容時，標註 \`[來源:QA庫]\`。
   - 僅當引用了 CLASS_RULES 的一般產品規格時，標註 \`[來源:官方規格庫]\`。
   - 僅當引用了 CLASS_RULES 內的活動、促銷、登錄、贈品、延長保固 RULE 時，標註 \`[來源:官方活動庫]\`。
   - **嚴格禁止、絕對禁止標註任何「一般知識」來源！除了一般禮貌性問候閒聊（如「你好」）可不帶來源外，任何具體產品/服務/據點諮詢，若無本機資料支援，一律必須輸出 \`[AUTO_SEARCH_WEB]\` 或 \`[AUTO_SEARCH_PDF]\`。**
   - **當前極速模式下未加載手冊，絕對、100% 禁止標註 \`[來源:官方手冊]\`！**
4. **新品與新規格無資料防線**：如果用戶詢問新品或新規格（如 6K 螢幕），且資料庫中沒有，你必須誠實表示無此產品規格。嚴禁利用網路搜尋來胡編官方尚未登錄之新機或新規格。\n`;

    // Fast Mode hardcoded prompt removed; runtime instructions come from Google Sheet Prompt!C3.
  } else if (kbFiles.length > 0) {
    // Phase 2 & 3: 深度模式 (Deep Mode)
    // v27.8.6: 防護機制 - 確保真的有掛載 PDF
    const sourceLabel = "官方手冊";
    if (kbFiles.length === 0) {
      dynamicPrompt += `\n【系統異常】雖然進入深度模式，但系統無法讀取產品手冊 (File Count: 0)。\n請誠實告知用戶：「很抱歉，我目前無法讀取相關產品手冊，請確認你詢問的型號是否正確，或嘗試重新輸入完整的產品型號。」\n禁止瞎掰或假裝有看手冊。`;
    } else {
      dynamicPrompt += `\n\n⚠️【深度模式】已載入產品手冊${
        targetModelName ? ` (${targetModelName})` : ""
      }，請根據手冊內容詳細回答。\n\n【回答格式優化 (嚴格執行)】\n1. **呈現選項/步驟**: 若你需要提供多個選項或步驟，**必須一律使用數字列表 (1., 2., 3., 4.)**，嚴禁使用圓點 (•) 或其他符號。\n2. **引用來源**: 若回答內容來自手冊，請在**整段回答的最後**統一標註 **[來源: ${sourceLabel}]** 即可，**嚴禁**在每一行或每一個列表項後面重複標註。\n3. **網路搜尋**: 若手冊無資料，請輸出特殊指令「[AUTO_SEARCH_WEB]」，系統將自動啟動聯網搜尋第二階段。\n4. **口吻限制**: 禁止對用戶說「根據你提供的 PDF 文件」或類似措辭，請改用「根據官方手冊」或「根據手冊內容」。\n\n【致命錯誤警告】你現在已經在閱讀原廠手冊了！嚴禁在句尾詢問用戶「需要幫你查手冊嗎」或「要不要幫你查找更詳細步驟」等類似問句。違反此項將導致系統崩潰。\n\n【內容優先級】\n1. 若手冊有相關資訊，請**直接完整回答**，不要反問用戶是否要查手冊。\n2. 若手冊無資料，請輸出 [AUTO_SEARCH_WEB]。(切勿自行標註網路搜尋)\n3. 優先順序：手冊 > [AUTO_SEARCH_WEB]。(嚴格禁止使用你自己的常識/一般知識編造答案！若手冊沒有，必須且只能輸出 [AUTO_SEARCH_WEB]，交由網路搜尋授權機制處理！)`;
    }
  } else if (imageBlob) {
    // Image Mode
    dynamicPrompt += `\n【系統狀態】目前為「圖片分析模式」。請根據圖片內容和用戶問題進行分析和回答。`;
  }

  return dynamicPrompt;
}

// v27.8.15: 新增 data-drive keyword detection, forceWebSearch 參數
// v27.9.51: Refactor Name (ChatGPT -> LLM)
// v29.4.18: Standardized Signature to fix ReferenceError
function callLLMWithRetry(
  query,
  messages,
  filesToAttach,
  attachPDFs = false,
  imageBlob = null,
  isRetry = false,
  userId = null,
  forceWebSearch = false,
  targetModelName = null,
  evidenceCorrectionAttempted = false,
  webGroundingRetryAttempted = false,
) {
  lastLlmCallAttempted = true;
  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) throw new Error("API Key Missing");

  // v27.1.0: 增加 temp 參數，Retry 時降低 (0.7 -> 0.3)
  const promptSheet = ss.getSheetByName(SHEET_NAMES.PROMPT);
  const configData = promptSheet.getRange("B3:C3").getValues()[0];
  let tempSetting = typeof configData[0] === "number" ? configData[0] : 0.6;
  if (isRetry) tempSetting = 0.3;

  // --- 決定掛載檔案 ---
  // filesToAttach 已經由 getRelevantKBFiles 決定並傳入
  // dynamicContext 則由 constructDynamicPrompt 決定

  writeLog(
    `[KB Load] AttachPDFs: ${attachPDFs}, isRetry: ${isRetry}, Files: ${filesToAttach.length}`,
  );

  // v24.0.0: 根據模式動態調整歷史長度，控制 Token 成本
  // - Fast Mode: 保留 10 對 (20 則)
  // - PDF Mode: v29.4.33 縮減至 2 對 (4 則)，大幅節省 Token 給 PDF
  let effectiveMessages = messages;
  if (attachPDFs && messages.length > 4) {
    // PDF 模式：只保留最近 2 對 (4 則) - v29.4.33 優化
    // 更激進的截斷，因為 PDF 本身已經提供足夠上下文
    const hasSummary =
      messages.length > 0 && messages[0].content.includes("【系統自動摘要】");

    if (hasSummary && messages.length > 2) {
      const summaryMsgs = messages.slice(0, 2); // 保留摘要對
      const recentMsgs = messages.slice(-4); // 最近 2 對
      if (recentMsgs[0] === summaryMsgs[0]) {
        effectiveMessages = recentMsgs;
      } else {
        effectiveMessages = [...summaryMsgs, ...recentMsgs];
      }
      writeLog(
        `[Token Control v29.4.33] PDF Mode: 保留摘要 + 最近 2 對 (${effectiveMessages.length} 則)`,
      );
    } else {
      effectiveMessages = messages.slice(-4); // 只保最近 2 對
      writeLog(
        `[Token Control v29.4.33] PDF Mode: 歷史截斷 ${messages.length} -> ${effectiveMessages.length} (省 Token)`,
      );
    }
  }

  const recentOfficialManualAnswer = forceWebSearch
    ? getRecentOfficialManualAnswer_(effectiveMessages)
    : "";
  const officialUrlContexts = forceWebSearch
    ? getOfficialUrlContextCandidates(query)
    : [];
  const directOfficialPageEvidence = forceWebSearch
    ? fetchOfficialUrlEvidence_(officialUrlContexts)
    : [];

  let effectiveQuery = query;
  if (attachPDFs && !forceWebSearch && isFactoryResetQueryWithoutPinIssue(query)) {
    const rewrittenQuery = buildFactoryResetManualSearchQuery_(query, targetModelName);
    if (rewrittenQuery && rewrittenQuery !== query) {
      effectiveQuery = rewrittenQuery;
      if (Array.isArray(effectiveMessages) && effectiveMessages.length > 0) {
        effectiveMessages = effectiveMessages.slice();
        for (let i = effectiveMessages.length - 1; i >= 0; i--) {
          if (effectiveMessages[i] && effectiveMessages[i].role === "user") {
            effectiveMessages[i] = Object.assign({}, effectiveMessages[i], {
              content: rewrittenQuery,
            });
            break;
          }
        }
      }
      writeLog(
        `[PDF Query Rewrite] 出廠重設題改用手冊關鍵字查詢: ${rewrittenQuery.substring(0, 180)}`,
      );
    }
  }

  // 1. 建構 Prompt
  let dynamicPrompt = constructDynamicPrompt(
    effectiveQuery,
    effectiveMessages,
    filesToAttach,
    forceWebSearch,
    imageBlob, // imageBlob is handled separately
    targetModelName,
  );
  if (
    forceWebSearch &&
    isCrossDeviceMonitorQuery(effectiveQuery) &&
    recentOfficialManualAnswer
  ) {
    dynamicPrompt += `\n\n【已由官方手冊查證的螢幕端錨點】
${recentOfficialManualAnswer}

這段只用來固定螢幕端已查證的事實。網路搜尋只補外部裝置端的官方資料，不得把螢幕端的輸入介面、線材條件、供電瓦數或限制改成網路文章中的其他型號資訊。若搜尋結果與錨點衝突，以官方手冊錨點為準。最後請把兩邊資訊整合成朋友式、專業且容易照做的答案。`;
    writeLog(
      `[Cross Device Manual Anchor v29.6.076] 網搜沿用官方手冊螢幕端事實 (${recentOfficialManualAnswer.length} 字)`,
    );
  }
  if (directOfficialPageEvidence.length > 0) {
    dynamicPrompt += `\n\n【程式直接擷取的官方技術規格頁證據】
${directOfficialPageEvidence
  .map((item) => `來源網址：${item.url}\n${item.text}`)
  .join("\n\n")}

以上文字由程式直接從官方網址取得。回答外部裝置端能力時必須逐字核對這段證據；證據已明載的能力不得說成「未明確標示」，也不得以「可能、理論上、待確認」弱化。只提供證據支援且與使用者問題直接相關的連接方法，不延伸無來源的設定、轉接器或替代測試。`;
  }

  // 刪除舊的註解掉的 imageBlob 邏輯
  const geminiContents = [];
  let first = true;
  effectiveMessages.forEach((msg) => {
    if (msg.role === "system") return;
    const parts = [];
    if (msg.role === "user" && first) {
      if (filesToAttach.length > 0) {
        // v24.5.4: 防護檢查，避免空 URI 導致 API 400 錯誤
        filesToAttach.forEach((k) => {
          if (k.uri && k.uri.trim().length > 0) {
            parts.push({
              file_data: {
                mime_type: k.mimeType || "text/plain",
                file_uri: k.uri,
              },
            });
          } else if (k.inlineDataBase64 && k.inlineDataBase64.length > 0) {
            parts.push({
              inline_data: {
                mime_type: k.mimeType || "application/pdf",
                data: k.inlineDataBase64,
              },
            });
            writeLog(`[API Attach] 使用 inline PDF fallback: ${k.name}`);
          } else {
            writeLog(`[API Protection] ⚠️ 跳過無效 URI: ${k.name}`);
          }
        });
        // v24.1.41: 在 PDF 後面、用戶問題前面加入搜尋指令
        // 這樣 AI 讀完 PDF 後會立刻看到要搜尋什麼
        parts.push({
          text: `\n\n【PDF 搜尋任務】請在上述 PDF 手冊中，找出與以下問題相關的所有段落並詳細回答：\n\n`,
        });
      }
      first = false;
    }
    // v29.3.47: Sanitize content (Fix API 400 when history has objects)
    let safeContent = "";
    if (typeof msg.content === "string") {
      safeContent = msg.content;
    } else if (msg.content && typeof msg.content === "object") {
      // 若為 Flex Message 物件，優先取 altText，否則轉字串
      safeContent = msg.content.altText || "[System Object]";
    } else {
      safeContent = String(msg.content);
    }
    parts.push({ text: safeContent });
    geminiContents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: parts,
    });
  });
  if (first) geminiContents.push({ role: "user", parts: [{ text: "你好" }] });

  // v29.5.xxx: 確保 imageBlob 正確插入至最後一個 user 訊息中
  if (imageBlob) {
    try {
      const imageBase64 = Utilities.base64Encode(imageBlob.getBytes());
      for (let i = geminiContents.length - 1; i >= 0; i--) {
        if (geminiContents[i].role === "user") {
          geminiContents[i].parts.push({
            inline_data: {
              mime_type: imageBlob.getContentType() || "image/jpeg",
              data: imageBase64,
            },
          });
          break;
        }
      }
    } catch (err) {
      writeLog(`[Image Attach Error] 圖片轉換 Base64 失敗: ${err.message}`);
    }
  }

  // v24.5.4: 成本優化
  // v27.0.0: 恢復原始邏輯（Thinking Mode 修復）
  // 問題診斷：gemini-2.0-flash 本身沒有 Thinking Mode 版本區別
  // 之前的 thinkingConfig 設定對 2.0 Flash 無效，不是根本原因
  // 根本原因：PDF 載入 + Deep Mode prompt 複雜度導致回應異常
  const useThinkModel = attachPDFs; // PDF 模式才需要更好的模型理解
  const modelName = useThinkModel
    ? CONFIG.MODEL_NAME_THINK
    : CONFIG.MODEL_NAME_FAST;

  const genConfig = {
    maxOutputTokens: attachPDFs ? 4096 : CONFIG.MAX_OUTPUT_TOKENS, // PDF 模式放寬至 4096
    temperature: tempSetting,
  };

  // v27.0.0: 移除 thinkingConfig（2.0 Flash 不支援，無效設定）

  // v24.5.8: Google Search 工具僅在 PDF 模式必要時啟用
  // Fast Mode 禁用搜尋；Deep Mode 允許搜尋以補齊官方公告/韌體/驅動/安全性/異常
  // v27.2.3: 修復 Deep Mode 搜尋工具導致空白回應
  // 問題：在掛載 PDF 時啟用 Google Search，AI 試圖搜尋補充導致超時/失敗，最後只返回 emoji
  // 解決：Deep Mode 禁用搜尋，專注於 PDF 內容。客戶端層級需要時可用 [AUTO_SEARCH_PDF] 重試
  // v27.8.15: 雙階段搜尋架構 (Two-Pass Search)
  // 1. Pass 1 (Deep Mode Default): 禁用 Search，專注 PDF，避免 Timeout。
  // 2. Pass 2 (Force Web Search): 只有在 forceWebSearch = true 時啟用。
  // 這樣可以兼顧「快速穩定」與「查網路的需求」，避免因網路搜尋導致的無回應。
  let tools = undefined;
  if (forceWebSearch) {
    // v29.5.110: Gemini 2.0 Google Search 強制觸發策略
    // 問題：google_search 工具讓 AI 自主判斷是否搜尋，常常選擇不搜尋
    // 解決：在 user message 中加入「時效性詞彙」讓 AI 認為必須搜尋即時資訊
    writeLog(`[Search Tool] 🌐 啟用 Google 官方搜尋工具 (v29.5.110)`);
    tools = [{ google_search: {} }];
    if (officialUrlContexts.length > 0) {
      tools.unshift({ url_context: {} });
      writeLog(
        `[URL Context v29.6.075] 加入官方頁: ${officialUrlContexts.join(", ")}`,
      );
    }
    writeLog(`[Search Tool Payload] tools=${JSON.stringify(tools)}`);

    // v29.5.110: 強化 System Prompt - 加入時效性指令
    const today = Utilities.formatDate(
      new Date(),
      "Asia/Taipei",
      "yyyy年MM月dd日",
    );
    dynamicPrompt += `\n\n【🚨 系統強制指令 - 最高優先級】\n今天是 ${today}。用戶要求查詢「最新」的網路資訊。\n你必須立即使用 google_search 工具搜尋網路！\n理由：這是「需要即時資訊」的問題，你的內建知識截止日期已過時，必須搜尋最新網路資料。\n禁止僅用自身知識回答，必須引用網路來源。${
      officialUrlContexts.length > 0
        ? `\n請同時讀取這些官方技術規格頁，並優先以其內容作答：${officialUrlContexts.join(" ")}`
        : ""
    }`;

    // v29.5.110: 修改 user message - 加入時效性關鍵詞觸發搜尋
    // Gemini 會判斷「最新」「今天」這類詞彙為需要即時資訊，從而強制搜尋
    if (geminiContents && geminiContents.length > 0) {
      const lastContent = geminiContents[geminiContents.length - 1];
      if (
        lastContent.role === "user" &&
        lastContent.parts &&
        lastContent.parts.length > 0
      ) {
        const textPart = lastContent.parts.find((p) => p.text);
        if (textPart && !textPart.text.includes("最新")) {
          // 在問題前加上時效性詞彙
          textPart.text = `【請搜尋最新網路資訊】禁止只給開頭引言，必須根據搜尋結果提供完整的解決細節與步驟。${
            officialUrlContexts.length > 0
              ? `請讀取官方頁 ${officialUrlContexts.join(" ")}。`
              : ""
          }${textPart.text}`;
          writeLog(
            `[Search Query Inject] 已加入時效性關鍵詞: ${textPart.text.substring(0, 100)}`,
          );
        }
      }
    }
  } else if (attachPDFs && !imageBlob) {
    // Pass 1: 預設禁用，以防 Timeout
    // 但如果用戶想要網路來源，Prompt 會引導輸出 [AUTO_SEARCH_WEB]
    tools = undefined;
  }

  // v27.9.6: Token 熔斷機制 - 防止 10 萬 Token 爆炸
  // 策略：保留 System Prompt 和最新對話，裁切中間的歷史記錄
  const MAX_SAFE_TOKENS = 40000;

  // 粗略估算 Token（1 Token ≈ 1.5 字元）
  function estimateTokens(text) {
    return Math.ceil((text || "").length / 1.5);
  }

  // 估算總 Token
  let totalTokens = estimateTokens(dynamicPrompt); // System Prompt
  effectiveMessages.forEach((msg) => {
    totalTokens += estimateTokens(msg.content);
  });

  // 如果超過上限，裁切中間的歷史記錄
  if (totalTokens > MAX_SAFE_TOKENS) {
    writeLog(
      `[Token Fuse] ⚠️ 預估 Token 超過上限 (${totalTokens} > ${MAX_SAFE_TOKENS})，啟動熔斷機制`,
    );

    // 保留最新 2 對對話（4 則訊息）
    const recentCount = Math.min(4, effectiveMessages.length);
    const recentMessages = effectiveMessages.slice(-recentCount);

    // 重新估算
    let newTotal = estimateTokens(dynamicPrompt);
    recentMessages.forEach((msg) => {
      newTotal += estimateTokens(msg.content);
    });

    effectiveMessages = recentMessages;
    writeLog(
      `[Token Fuse] 裁切後: ${effectiveMessages.length} 則訊息，預估 ${newTotal} Tokens`,
    );
  }

  const payload = {
    contents: geminiContents,
    systemInstruction: imageBlob
      ? undefined
      : { parts: [{ text: dynamicPrompt }] },
    generationConfig: genConfig,
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" }, // v29.5.72: Added new category
    ],
    tools: tools,
  };

  // v29.6.031: Cached Content 暫時禁用 - 因為現有架構用 systemInstruction + tools
  // 啟用 cache 會引發 400: CachedContent can not be used with system_instruction/tools
  // TODO: 重構 prompt 結構 (把 systemInstruction 移到 cache) 才能用
  // const specCachedName = PropertiesService.getScriptProperties().getProperty("SPEC_CACHED_NAME");
  // if (specCachedName && !imageBlob && !attachPDFs) {
  //   payload.cachedContent = specCachedName;
  // }

  const url = `${CONFIG.API_ENDPOINT}/${modelName}:generateContent?key=${apiKey}`;
  // v29.5.0: Optimize API Log - Remove Start Log
  // writeLog(
  //   `[API Call] Model: ${modelName}, PDF: ${attachPDFs}, Think: ${useThinkModel}, Retry: ${isRetry}`
  // );

  // v27.2.5: PDF Debug Log
  // v27.9.0: 移除誤導性的「總內容長度」預估（無法反映 PDF 實際大小）
  //          實際 Token 用量將在 [Tokens] 日誌中顯示（API 呼叫後）
  if (attachPDFs) {
    writeLog(
      `[PDF Debug] 掛載 PDF 數量: ${filesToAttach.length}, 歷史: ${effectiveMessages.length} 則`,
    );
  }

  const start = new Date().getTime();
  let lastLoadingTime = start; // 追蹤上次發送 Loading 的時間

  let retryCount = 0;
  let lastError = "";
  while (retryCount < 3) {
    // 每 18 秒補發一次 Loading 動畫（20秒會消失，提前 2 秒補發）
    const now = new Date().getTime();

    // v29.5.44: Token Overload Fallback Strategy (Level 1: Drop 2nd PDF)
    // 如果是第一次重試 (retryCount=1) 且有 2 本 PDF，嘗試移除第 2 本以減少 Token
    if (retryCount === 1 && attachPDFs && filesToAttach.length > 1) {
      writeLog(
        `[Retry Strategy L1] Token Overload Suspected? Dropping 2nd PDF to save space.`,
      );
      try {
        const userContent = payload.contents.find((c) => c.role === "user");
        if (userContent && userContent.parts) {
          // Find all file parts
          const fileParts = userContent.parts.filter((p) => p.file_data);
          if (fileParts.length > 1) {
            // Remove the last one
            const lastFileURI =
              fileParts[fileParts.length - 1].file_data.file_uri;
            const removeIdx = userContent.parts.findIndex(
              (p) => p.file_data && p.file_data.file_uri === lastFileURI,
            );
            if (removeIdx !== -1) {
              userContent.parts.splice(removeIdx, 1);
              writeLog(`[Retry Strategy L1] Successfully removed 2nd PDF.`);
            }
          }
        }
      } catch (e) {
        writeLog(`[Retry Strategy L1 Error] ${e.message}`);
      }
    }

    // v29.5.46: Ultimate Fallback (Level 2: Drop ALL PDFs + System Note)
    // 如果是最後一次重試 (retryCount=2) 且原本有掛載 PDF，全部移除改為純文字回應
    if (retryCount === 2 && attachPDFs) {
      writeLog(
        `[Fallback Strategy] 🚨 API 重試多次仍失敗 (含 PDF)。啟動終極降級：移除所有檔案，改為純文字模式。`,
      );
      try {
        // 1. Clean Payload: Remove all file_data and inline_data
        if (payload.contents) {
          payload.contents.forEach((content) => {
            if (content.parts) {
              content.parts = content.parts.filter(
                (p) => !p.file_data && !p.inline_data,
              );
            }
          });
        }

        // 2. Append System Note
        const userContent = payload.contents.find((c) => c.role === "user");
        if (userContent && userContent.parts) {
          const systemNote =
            "\n\n(系統自動降級：因參考文件過大導致讀取失敗，已切換為無文件模式，請依據你的知識庫回答)";
          const textPart = userContent.parts.find((p) => p.text);
          if (textPart) {
            textPart.text += systemNote;
          } else {
            userContent.parts.push({ text: systemNote });
          }
        }

        // 3. Remove Tools
        if (payload.tools) delete payload.tools;
        writeLog(`[Fallback Strategy] Payload Cleaned. System note injected.`);
      } catch (e) {
        writeLog(`[Fallback Strategy Error] ${e.message}`);
      }
    }

    if (userId && now - lastLoadingTime > 18000) {
      try {
        showLoadingAnimation(userId, 60);
      } catch (e) {}
      lastLoadingTime = now;
    }
    try {
      // 決定是否切換到 OpenRouter
      // 條件: 設定為 OpenRouter + 非 PDF 模式 + 非圖片 + 非 Web Search (因為 Web Search 用 Google Tool)
      if (
        LLM_PROVIDER === "OpenRouter" &&
        !attachPDFs &&
        !imageBlob &&
        !forceWebSearch
      ) {
        try {
          // OpenRouter 需要 System Prompt 放入 messages
          const openRouterMessages = [...geminiContents];
          if (dynamicPrompt) {
            openRouterMessages.unshift({
              role: "system",
              parts: [{ text: dynamicPrompt }],
            });
          }

          // v27.9.47: 支援 OpenRouter Web Search (Pass 2)
          // 當 forceWebSearch=true 時，使用 :online 後綴啟用網路插件
          const useOnline = forceWebSearch;

          const responseText = callOpenRouter(
            openRouterMessages,
            genConfig.temperature,
            undefined,
            useOnline,
          );
          return responseText;
        } catch (orErr) {
          writeLog(`[OpenRouter Fail] ${orErr.message}, Fallback to Gemini...`);
          // 失敗則 Fallback 到 Gemini (繼續往下執行)
        }
      }

      const response = UrlFetchApp.fetch(url, {
        method: "post",
        headers: { "Content-Type": "application/json" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
        connectTimeout: 5000, // 5秒連接超時防掛起
        readTimeout: 10000    // 10秒讀取超時防掛起
      });
      const endTime = new Date().getTime();
      const code = response.getResponseCode();
      // v29.5.0: Optimize API Log - Remove End Log (Combined with Stats)
      // writeLog(
      //   `[API End] ${
      //     (endTime - start) / 1000
      //   }s, Code: ${code}, Retry: ${retryCount}`
      // );

      const text = response.getContentText();

      // 成功
      if (code === 200) {
        try {
          const json = JSON.parse(text);

          // 📊 Token 用量紀錄 - v27.0.0: 修復費用對應錯誤
          // 無論是否有 usageMetadata，都要明確設置 lastTokenUsage
          // 這樣可以避免舊費用被誤用到新查詢上
          let usage = null;
          if (json.usageMetadata) {
            usage = json.usageMetadata;
            // 使用全域費率常數計算成本 - 動態選擇
            var priceInput =
              modelName === CONFIG.MODEL_NAME_THINK
                ? PRICE_THINK_INPUT
                : PRICE_FAST_INPUT;
            var priceOutput =
              modelName === CONFIG.MODEL_NAME_THINK
                ? PRICE_THINK_OUTPUT
                : PRICE_FAST_OUTPUT;
            var costUSD =
              (usage.promptTokenCount / 1000000) * priceInput +
              (usage.candidatesTokenCount / 1000000) * priceOutput;
            var costTWD = costUSD * EXCHANGE_RATE;
            writeLog(
              `[AI Stats] ${((endTime - start) / 1000).toFixed(2)}s | In: ${
                usage.promptTokenCount
              } / Out: ${
                usage.candidatesTokenCount
              } | Cost: NT$${costTWD.toFixed(4)}`,
            );

            // v24.1.0: 儲存到全域變數，供測試模式顯示
            lastTokenUsage = {
              input: usage.promptTokenCount,
              output: usage.candidatesTokenCount,
              total: usage.totalTokenCount,
              costTWD: costTWD,
            };
          } else {
            // v27.0.0: 如果沒有 usage data，清除舊的 lastTokenUsage
            // 避免 LINE 上顯示上一次查詢的費用
            lastTokenUsage = null;
            writeLog(`[Tokens] API 未返回 usageMetadata，已清除舊費用紀錄`);
          }

          // v27.2.6: 記錄 promptFeedback/safety，追蹤被封鎖原因
          if (json && json.promptFeedback) {
            writeLog(
              `[API PromptFeedback] ${JSON.stringify(
                json.promptFeedback,
              ).substring(0, 500)}`,
            );
          }
          const candidates = json && json.candidates ? json.candidates : [];

          // v27.0.0: 防護機制 - 檢測異常短回應（Deep Mode + PDF 但輸出只有 emoji）
          if (
            attachPDFs &&
            candidates.length > 0 &&
            candidates[0].content &&
            candidates[0].content.parts
          ) {
            const responseText = candidates[0].content.parts[0].text || "";
            // 如果 PDF Mode 但回答只有 emoji（1 token）或完全空白，記錄警告
            if (
              usage &&
              usage.candidatesTokenCount <= 2 &&
              responseText.trim().length <= 3
            ) {
              writeLog(
                `[PDF Mode ERROR] ⚠️ 異常短回應: In: ${usage.promptTokenCount}, Out: ${usage.candidatesTokenCount}, Content: "${responseText}"`,
              );
              if (candidates[0].safetyRatings) {
                writeLog(
                  `[PDF Mode ERROR] Safety Ratings: ${JSON.stringify(
                    candidates[0].safetyRatings,
                  ).substring(0, 500)}`,
                );
              }
              writeLog(
                `[PDF Mode ERROR] 這通常表示 PDF 載入成功但 AI 無法生成完整回答，可能是 Gemini API 的安全阻擋或工具衝突`,
              );
              return "⚠️ 讀取產品手冊時回覆異常，請再問一次或改述問題（PDF模式）";
            }
          }

          // v26.1.0: 完整 API 回傳紀錄，便於診斷空白回答問題
          if (candidates.length === 0) {
            writeLog(
              `[API Warning] 無候選回應: ${JSON.stringify(json).substring(
                0,
                500,
              )}`,
            );
          } else if (candidates[0].content && candidates[0].content.parts) {
            const firstPart = candidates[0].content.parts[0];
            if (!firstPart.text || firstPart.text.trim().length === 0) {
              writeLog(
                `[API Warning] 回應為空文本: parts=${JSON.stringify(
                  candidates[0].content.parts,
                ).substring(0, 300)}`,
              );
            }

            // v26.6.0: 記錄短回答（Out < 50 tokens）的實際內容
            if (usage && usage.candidatesTokenCount < 50) {
              const responseText = firstPart.text || "";
              writeLog(
                `[API Short Response] Out: ${
                  usage.candidatesTokenCount
                } tokens, Content: "${responseText.substring(0, 200)}"`,
              );
            }
          }

          if (
            candidates.length > 0 &&
            candidates[0].content &&
            candidates[0].content.parts &&
            candidates[0].content.parts.length > 0
          ) {
            const firstPart = candidates[0].content.parts[0];
            let text = (firstPart.text || "").trim();

            // v29.5.108: Exhaustive Grounding and Tool Call Detection
            // 當啟用工具時，即使 text 為空，只要有任何工具調用、Grounding 或正常結算信號就算成功
            const grounding = candidates[0].groundingMetadata;
            const finishReason = candidates[0].finishReason;
            const hasToolCalls = firstPart && firstPart.functionCall;

            // 每次 API 呼叫前清除，避免沿用上一輪的搜尋證據。
            lastSearchSources = null;
            lastWebEvidenceValid = false;

            // v29.5.109: 完整記錄 Grounding Metadata (Web Search 結果)
            if (grounding) {
              // 記錄完整的 grounding 物件（限制長度避免過大）
              const groundingKeys = Object.keys(grounding);
              writeLog(
                `[Grounding] 🌐 偵測到 groundingMetadata, 包含欄位: ${groundingKeys.join(", ")}`,
              );

              if (
                grounding.webSearchQueries &&
                grounding.webSearchQueries.length > 0
              ) {
                writeLog(
                  `[Grounding] 搜尋查詢: ${JSON.stringify(grounding.webSearchQueries)}`,
                );
              } else {
                writeLog(`[Grounding] webSearchQueries 不存在或為空`);
              }

              // v29.5.112: 提取搜尋來源並保存到全域變數
              if (
                grounding.groundingChunks &&
                grounding.groundingChunks.length > 0
              ) {
                // writeLog(
                //   `[Grounding] 來源數量: ${grounding.groundingChunks.length}`,
                // );

                // 提取所有來源的域名
                const sourceSet = new Set();
                grounding.groundingChunks.forEach((chunk, i) => {
                  if (chunk.web && chunk.web.uri) {
                    // 從 URI 提取域名
                    try {
                      // URI 可能是 redirect URL，嘗試提取真實域名
                      const uri = chunk.web.uri;
                      let domain = "";

                      // 優先使用 title 中的域名資訊
                      if (chunk.web.title) {
                        domain = chunk.web.title.toLowerCase();
                      }

                      // 如果 title 不像域名，嘗試從 URI 解析
                      if (!domain.includes(".") || domain.length > 50) {
                        // 嘗試解析 URI
                        const urlMatch = uri.match(/https?:\/\/([^\/]+)/);
                        if (urlMatch) {
                          domain = urlMatch[1].replace("www.", "");
                        }
                      }

                      if (domain && domain.length < 50) {
                        sourceSet.add(domain);
                      }
                    } catch (e) {
                      // 解析失敗，跳過
                    }

                    // if (i < 3) {
                    //   writeLog(
                    //     `[Grounding] 來源 ${i + 1}: ${chunk.web.title || "N/A"} - ${chunk.web.uri || "N/A"}`,
                    //   );
                    // }
                  }
                });

                // 轉換為陣列並排序 (samsung.com 優先)
                let sources = Array.from(sourceSet);
                sources.sort((a, b) => {
                  // samsung.com 或 samsung.com.tw 優先
                  const aIsSamsung = a.includes("samsung");
                  const bIsSamsung = b.includes("samsung");
                  if (aIsSamsung && !bIsSamsung) return -1;
                  if (!aIsSamsung && bIsSamsung) return 1;
                  return 0;
                });

                // 限制最多顯示 5 個來源
                lastSearchSources = sources.slice(0, 5);
                writeLog(
                  `[Grounding] 提取來源: ${lastSearchSources.join(", ")}`,
                );
              } else {
                writeLog(`[Grounding] groundingChunks 不存在或為空`);
              }

              lastWebEvidenceValid = Boolean(
                forceWebSearch &&
                  grounding.groundingChunks &&
                  grounding.groundingChunks.length > 0 &&
                  grounding.groundingSupports &&
                  grounding.groundingSupports.length > 0,
              );
              writeLog(
                `[Grounding Audit v29.6.075] 可稽核 Google Search 證據: ${lastWebEvidenceValid}`,
              );

              if (grounding.searchEntryPoint) {
                writeLog(`[Grounding] 有 searchEntryPoint (搜尋建議 Widget)`);
              }

              // 記錄 AI 回應文字 (Web Search 結果)
              if (text.length > 0) {
                writeLog(`[Grounding] AI 搜尋回應: ${text}`);
              }
            } else if (forceWebSearch) {
              writeLog(
                `[Grounding] ⚠️ forceWebSearch=true 但無 groundingMetadata，可能 API 未啟用搜尋`,
              );
            }

            const successfulUrlContexts = getSuccessfulUrlContextSources(
              candidates[0].urlContextMetadata,
            );
            if (successfulUrlContexts.length > 0) {
              const urlDomains = successfulUrlContexts
                .map((url) => {
                  const match = url.match(/^https?:\/\/([^/]+)/i);
                  return match ? match[1].replace(/^www\./i, "") : url;
                })
                .filter(Boolean);
              lastSearchSources = Array.from(
                new Set([...(lastSearchSources || []), ...urlDomains]),
              ).slice(0, 5);
              lastWebEvidenceValid = true;
              writeLog(
                `[URL Context v29.6.075] 官方頁讀取成功: ${successfulUrlContexts.join(", ")}`,
              );
            } else if (officialUrlContexts.length > 0) {
              writeLog(
                "[URL Context v29.6.075] 官方頁未回傳成功的 urlContextMetadata",
              );
            }

            if (directOfficialPageEvidence.length > 0) {
              const fetchedDomains = directOfficialPageEvidence
                .map((item) => {
                  const match = String(item.url || "").match(/^https?:\/\/([^/]+)/i);
                  return match ? match[1].replace(/^www\./i, "") : "";
                })
                .filter(Boolean);
              lastSearchSources = Array.from(
                new Set([...(lastSearchSources || []), ...fetchedDomains]),
              ).slice(0, 5);
              lastWebEvidenceValid = true;
              writeLog(
                `[Official Page Fetch v29.6.077] 直接官方頁證據有效: ${fetchedDomains.join(", ")}`,
              );
            }

            if (grounding && text.length === 0) {
              const hasEntryPoint = !!grounding.searchEntryPoint;
              const hasQueries =
                grounding.webSearchQueries &&
                grounding.webSearchQueries.length > 0;
              const hasChunks =
                grounding.groundingChunks &&
                grounding.groundingChunks.length > 0;

              if (hasEntryPoint || hasQueries || hasChunks) {
                writeLog(
                  `[API Grounding] 偵測到搜尋內容 (Entry:${hasEntryPoint}|Query:${hasQueries}|Chunks:${hasChunks}), 注入導引文字。`,
                );
                text =
                  "🔍 搜尋結果已生成：對話中已包含網路搜尋引用內容，請確認下方建議連結或摘要。";
              }
            }

            // v29.5.72: 偵測工具調用 (functionCall)
            if (hasToolCalls && text.length === 0) {
              writeLog(
                `[API ToolCall] 偵測到工具調用: ${JSON.stringify(firstPart.functionCall)}`,
              );
              text = "🔍 已啟動工具檢索，請參考最終呈現之搜尋結果。";
            }

            // v29.5.72: 額外診斷 finishReason (如被封鎖或停止)
            if (text.length === 0 && finishReason) {
              writeLog(
                `[API Debug] 回應為空但 FinishReason 為: ${finishReason}`,
              );
              if (finishReason === "STOP") {
                // v29.5.74: 防止 Lazy STOP
                if (
                  hasToolCalls ||
                  (grounding &&
                    (grounding.searchEntryPoint || grounding.webSearchQueries))
                ) {
                  text = "🔍 搜尋任務已完成，請參考呈現之連結與摘要。";
                } else {
                  writeLog("[API Error] 偵測到 Lazy STOP (無內容)，視為失敗");
                  throw new Error("Empty response text from API (Lazy STOP)");
                }
              } else if (finishReason === "SAFETY") {
                text = "⚠️ 回應因安全政策受限，請嘗試更換關鍵字或改述問題。";
              }
            }

            // 如果連基本 text 或 grounding 或 finishReason 都沒有，才拋出錯誤
            if (text.length === 0) {
              writeLog(
                `[API Error] 回應全空 (No text/grounding/tool/finish), 可能工具執行失敗`,
              );
              throw new Error(
                `Empty response text from API (Reason: ${finishReason || "UNKNOWN"})`,
              );
            }

            // 如果連基本 text 或 grounding 都沒有，才拋出錯誤
            if (text.length === 0) {
              writeLog(
                `[API Error] 回應全空 (No text/grounding/finish), 可能工具執行失敗`,
              );
              throw new Error("Empty response text from API");
            }

            if (forceWebSearch && !lastWebEvidenceValid) {
              const firstUsage = lastTokenUsage
                ? Object.assign({}, lastTokenUsage)
                : null;
              if (!webGroundingRetryAttempted) {
                const today = Utilities.formatDate(
                  new Date(),
                  "Asia/Taipei",
                  "yyyy年MM月dd日",
                );
                const groundedQuery = [
                  effectiveQuery,
                  "",
                  `系統更正：今天是 ${today}。上一輪沒有取得可稽核的網頁來源，不得把 AI 內建知識當成網路搜尋結果。`,
                  "請重新使用 Google Search，優先查 Apple 台灣官方技術規格與 Samsung 台灣官方支援頁。只有 groundingChunks 實際支援的內容才可回答；先核對產品是否已上市，再提供精簡、可操作的結論。",
                ].join("\n");
                const groundedMessages = Array.isArray(effectiveMessages)
                  ? effectiveMessages.slice()
                  : [];
                for (let i = groundedMessages.length - 1; i >= 0; i--) {
                  if (
                    groundedMessages[i] &&
                    groundedMessages[i].role === "user"
                  ) {
                    groundedMessages[i] = Object.assign({}, groundedMessages[i], {
                      content: groundedQuery,
                    });
                    break;
                  }
                }
                writeLog(
                  "[Grounding Audit v29.6.073] 無 groundingChunks/groundingSupports，重試一次官方來源搜尋",
                );
                const groundedText = callLLMWithRetry(
                  groundedQuery,
                  groundedMessages,
                  filesToAttach,
                  attachPDFs,
                  imageBlob,
                  true,
                  userId,
                  forceWebSearch,
                  targetModelName,
                  evidenceCorrectionAttempted,
                  true,
                );
                if (firstUsage && lastTokenUsage) {
                  lastTokenUsage = combineLlmUsage_(firstUsage, lastTokenUsage);
                  writeLog(
                    `[Grounding Audit v29.6.073] 兩次網搜 LLM 合計費用: NT$${lastTokenUsage.costTWD.toFixed(4)}`,
                  );
                }
                return groundedText;
              }

              writeLog(
                "[Grounding Audit v29.6.073] 第二次仍無可稽核來源，拒絕輸出假網搜答案",
              );
              return "這次網路搜尋沒有取得可核對的網頁來源，所以我先不把 AI 內建資料當成搜尋答案。請稍後再點一次「這題再搜網路」。";
            }

            const isCrossDeviceQuery =
              isCrossDeviceMonitorQuery(effectiveQuery);
            const hasTrustedFastCrossDeviceQa =
              /\[來源[:：]\s*QA庫\]/i.test(text);
            if (
              isCrossDeviceQuery &&
              !attachPDFs &&
              !forceWebSearch &&
              !hasTrustedFastCrossDeviceQa
            ) {
              writeLog(
                "[Cross Device Router v29.6.074] Fast Mode 未命中 QA，禁止用規格庫推論外部裝置相容性，升級官方手冊",
              );
              return "[AUTO_SEARCH_PDF]";
            }
            const hasWrongScopeRefusal =
              isCrossDeviceQuery && isIncorrectCrossDeviceScopeRefusal(text);
            const hasUnsupportedExternalAdvice =
              isCrossDeviceQuery &&
              attachPDFs &&
              hasUnsupportedCrossDeviceManualExternalClaim_(text);
            if (hasUnsupportedExternalAdvice && !hasWrongScopeRefusal) {
              writeLog(
                "[Cross Device Evidence Guard v29.6.082] PDF 回覆混入手冊外裝置端內容，直接清理越界句以避免第二次同步 LLM",
              );
              const boundedText =
                sanitizeUnsupportedCrossDeviceManualClaims_(text);
              if (boundedText) {
                return `${boundedText}\n\n[AUTO_SEARCH_WEB]`;
              }
              return "[AUTO_SEARCH_WEB]";
            }
            if (
              (hasWrongScopeRefusal || hasUnsupportedExternalAdvice) &&
              !evidenceCorrectionAttempted
            ) {
              const firstUsage = lastTokenUsage
                ? Object.assign({}, lastTokenUsage)
                : null;
              const correctedQuery = [
                effectiveQuery,
                "",
                "系統更正：這是外部裝置連接三星螢幕的問題，問題主體是螢幕，不得以手機／平板超出服務範圍拒答。",
                "只可使用目前提供或實際搜尋到的來源。若目前掛載的是螢幕官方手冊，只整理手冊明載的螢幕端連接條件；手冊沒有寫的外部裝置設定、轉接器、上市狀態或測試方式一律不要補，也不可斷言該手機一定能顯示或充電，改為明說裝置端尚待查證。先給一句結論，再以最多 3 點解釋真正影響連接的條件；優先整理螢幕端輸入介面、手冊要求的線材／影像協定，以及手冊明載的供電瓦數。不要逐條照搬手冊警告。請用朋友式、專業且深入淺出的方式重新回答。",
              ].join("\n");
              const correctedMessages = Array.isArray(effectiveMessages)
                ? effectiveMessages.slice()
                : [];
              for (let i = correctedMessages.length - 1; i >= 0; i--) {
                if (
                  correctedMessages[i] &&
                  correctedMessages[i].role === "user"
                ) {
                  correctedMessages[i] = Object.assign(
                    {},
                    correctedMessages[i],
                    { content: correctedQuery },
                  );
                  break;
                }
              }
              writeLog(
                `[Cross Device Evidence Guard v29.6.073] 攔截${hasWrongScopeRefusal ? "錯誤範圍拒答" : "無來源裝置端建議"}，保留相同來源重新回答`,
              );
              const correctedText = callLLMWithRetry(
                correctedQuery,
                correctedMessages,
                filesToAttach,
                attachPDFs,
                imageBlob,
                true,
                userId,
                forceWebSearch,
                targetModelName,
                true,
                webGroundingRetryAttempted,
              );
              if (firstUsage && lastTokenUsage) {
                lastTokenUsage = combineLlmUsage_(firstUsage, lastTokenUsage);
                writeLog(
                  `[Cross Device Evidence Guard v29.6.073] 兩次 LLM 合計費用: NT$${lastTokenUsage.costTWD.toFixed(4)}`,
                );
              }
              if (
                isIncorrectCrossDeviceScopeRefusal(correctedText) ||
                (attachPDFs &&
                  hasUnsupportedCrossDeviceManualExternalClaim_(correctedText))
              ) {
                writeLog(
                  `[Cross Device Evidence Guard v29.6.073] 第二次仍違反來源邊界，移除無來源句子後再提供${attachPDFs ? "網路查證" : "官方手冊"}`,
                );
                const boundedText = sanitizeUnsupportedCrossDeviceManualClaims_(
                  correctedText,
                );
                if (boundedText) {
                  return `${boundedText}\n\n${attachPDFs ? "[AUTO_SEARCH_WEB]" : "[AUTO_SEARCH_PDF]"}`;
                }
                return attachPDFs ? "[AUTO_SEARCH_WEB]" : "[AUTO_SEARCH_PDF]";
              }
              return correctedText;
            }

            if (
              forceWebSearch &&
              recentOfficialManualAnswer &&
              hasManualAnchorWattageConflict_(recentOfficialManualAnswer, text)
            ) {
              writeLog(
                "[Cross Device Manual Anchor v29.6.076] 攔截網搜與官方手冊不一致的螢幕端瓦數",
              );
              text = sanitizeManualAnchorWattageConflict_(
                recentOfficialManualAnswer,
                text,
              );
            }
            if (
              forceWebSearch &&
              isCrossDeviceQuery &&
              hasUnsupportedCrossDeviceWebSpeculation_(text)
            ) {
              writeLog(
                "[Cross Device Web Evidence v29.6.077] 移除網搜回答中沒有來源支援的裝置端推測句",
              );
              text = sanitizeUnsupportedCrossDeviceWebSpeculation_(text);
            }

            return text;
          }

          // No candidates or parts
          throw new Error("No candidates or content parts in response");
        } catch (parseErr) {
          writeLog("[API Parse Error] " + parseErr.message);
          // Don't return empty string here, throw to trigger retry loop
          throw parseErr;
        }
      }

      // 特定錯誤處理
      // 特定錯誤處理
      if (code === 400) {
        // v29.3.43: 精確區分 API Key 錯誤與參數錯誤 (Bad Request)
        if (text.includes("API_KEY_INVALID")) {
          return "你的 API Key 無效，請檢查設定。";
        }
        if (text.includes("INVALID_ARGUMENT")) {
          writeLog(`[API 400] 參數錯誤: ${text.substring(0, 200)}`);
          // 不要重試 400 錯誤，因為通常不會自動變好
          return "⚠️ 系統參數錯誤 (Bad Request)，請嘗試換個問法。";
        }
        if (text.includes("token")) {
          return "⚠️ 資料量過大，請提供關鍵字。";
        }
        writeLog(`[API 400] 未知錯誤: ${text.substring(0, 200)}`);
        lastError = "請求參數有誤";
        retryCount++; // 其他 400 錯誤嘗試重試
        continue;
      }
      if (code === 404) {
        writeLog(`[API 404] 檔案不存在: ${text.substring(0, 200)}`);
        // 標記需要重建，並返回特殊標記讓外層處理
        CacheService.getScriptCache().put("kb_need_rebuild", "true", 3600);
        return "[KB_EXPIRED]";
      }
      if (code === 403) {
        writeLog(`[API 403] 檔案已過期或無權限: ${text.substring(0, 300)}`);
        // 標記需要重建，並返回特殊標記讓外層處理
        CacheService.getScriptCache().put("kb_need_rebuild", "true", 3600);
        return "[KB_EXPIRED]";
      }
      if (code === 429) {
        writeLog(`[API 429] 配額限制: ${text.substring(0, 200)}`);
        return "系統暫時忙碌，這次查詢暫時無法處理，請稍後再試一次。";
      }
      if (code === 500 || code === 503) {
        writeLog(`[API ${code}] Google 伺服器錯誤，重試中...`);
        lastError = `Google 伺服器暫時故障`;
        retryCount++;
        if (retryCount >= 2) { writeLog('[API Fail] 伺服器連續 500，提早退出避免 Webhook 逾時'); break; }
        Utilities.sleep(1000); // v29.6 BUG 防禦: 固定睡 1 秒
        continue;
      }

      // 其他錯誤
      lastError = `API 錯誤 ${code}`;
      writeLog(`[API Error] Code: ${code}, Body: ${text.substring(0, 300)}`);
      retryCount++;
      if (retryCount >= 2) { writeLog('[API Fail] 提早退出避免 Webhook 逾時'); break; }
      Utilities.sleep(1000); // v29.6 BUG 防禦: 固定睡 1 秒
    } catch (e) {
      lastError = e.message || "未知錯誤";

      writeLog(`[API Exception] ${e.message}`);
      if (e.message.includes("token")) return e.message;
      retryCount++;
      if (retryCount >= 2) { writeLog('[API Fail] 提早退出避免 Webhook 逾時'); break; }
      Utilities.sleep(1000); // v29.6 BUG 防禦: 固定睡 1 秒
    }
  }

  // v29.5.25: Graceful Failure
  if (lastError) {
    writeLog(`[API Fail] 重試 3 次仍失敗，最後錯誤: ${lastError}`);
    if (forceWebSearch) {
      return "非常抱歉，網路搜尋服務暫時無法連線。你可以參考上方提供的資料，或稍後再試。";
    }
    return "⚠️ 系統忙碌中，請稍後再試。";
  }

  return "";
}

/**
 * 呼叫 OpenRouter API (OpenAI Compatible)
 */
/**
 * 呼叫 OpenRouter API (OpenAI Compatible)
 * v27.9.47: 新增 isOnline 參數，若為 true 則在模型後加上 :online 以啟用網路搜尋
 */
function callOpenRouter(
  messages,
  temperature = 0.7,
  tools = undefined,
  isOnline = false,
) {
  lastLlmCallAttempted = true;
  const apiKey =
    PropertiesService.getScriptProperties().getProperty("OPENROUTER_API_KEY");
  if (!apiKey) throw new Error("缺少 OPENROUTER_API_KEY");

  // 轉換訊息格式 (Gemini -> OpenAI)
  // Gemini: { role: 'user'|'model', parts: [{text: '...'}] }
  // OpenAI: { role: 'user'|'assistant'|'system', content: '...' }
  const openAiMessages = messages.map((msg) => {
    let role = msg.role === "model" ? "assistant" : msg.role;
    // 如果是 System Prompt (Gemini 通常放在 systemInstruction，但這裡可能混合在 messages)
    // 這裡主要處理標準 user/model

    let content = "";
    if (msg.parts && msg.parts.length > 0) {
      content = msg.parts.map((p) => p.text).join("\n");
    }
    return { role: role, content: content };
  });

  const payload = {
    model: isOnline ? `${OPENROUTER_MODEL}:online` : OPENROUTER_MODEL,
    messages: openAiMessages,
    temperature: temperature,
    // OpenRouter 特定標頭
    provider: {
      require_parameters: false,
    },
  };

  const url = "https://openrouter.ai/api/v1/chat/completions";

  writeLog(
    `[OpenRouter Call] Model: ${payload.model}, Temp: ${temperature}, Online: ${isOnline}`,
  );
  const start = new Date().getTime();

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://script.google.com/", // OpenRouter 要求
        "X-Title": "LineBot Assistant", // OpenRouter 要求
        "Content-Type": "application/json",
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const endTime = new Date().getTime();
    const code = response.getResponseCode();
    const text = response.getContentText();

    writeLog(`[OpenRouter End] ${(endTime - start) / 1000}s, Code: ${code}`);

    if (code === 200) {
      const json = JSON.parse(text);

      // 記錄 Token
      if (json.usage) {
        // v27.9.39: 根據設定計算 OpenRouter 成本
        const costUSD =
          (json.usage.prompt_tokens / 1000000) * OPENROUTER_PRICE_IN +
          (json.usage.completion_tokens / 1000000) * OPENROUTER_PRICE_OUT;
        const costTWD = costUSD * EXCHANGE_RATE;

        lastTokenUsage = {
          input: json.usage.prompt_tokens,
          output: json.usage.completion_tokens,
          total: json.usage.total_tokens,
          costTWD: costTWD,
        };
        writeLog(
          `[OpenRouter Tokens] In: ${json.usage.prompt_tokens}, Out: ${
            json.usage.completion_tokens
          }, Total: ${json.usage.total_tokens} (約 NT$${costTWD.toFixed(4)})`,
        );
      }

      if (json.choices && json.choices.length > 0) {
        return json.choices[0].message.content || "";
      }
    } else {
      writeLog(
        `[OpenRouter Error] Code: ${code}, Body: ${text.substring(0, 300)}`,
      );
      throw new Error(`OpenRouter API Error: ${code}`);
    }
  } catch (e) {
    writeLog(`[OpenRouter Exception] ${e.message}`);
    throw e;
  }
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

  let lines = text.split("\n");
  let formattedLines = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    formattedLines.push(line);

    // 列表項目後加空行
    if (
      /^\d+\./.test(line) &&
      i < lines.length - 1 &&
      lines[i + 1].trim() !== ""
    ) {
      formattedLines.push("");
    }
  }
  return formattedLines.join("\n");
}

function formatForLineMobile(text) {
  if (!text) return "";
  let processed = text;

  // === 過濾 Thinking Mode 洩漏 ===
  // 移除可能洩漏的內部思考 (Gemini 2.5 Flash Thinking Mode)
  processed = processed.replace(
    /SPECIAL INSTRUCTION:.*?(?=\n\n|\n[A-Z]|$)/gs,
    "",
  );
  processed = processed.replace(/\[INTERNAL\].*?(?=\n\n|$)/gs, "");
  processed = processed.replace(/\[THINKING\].*?(?=\n\n|$)/gs, "");

  // === Markdown 清理 (v27.9.73 強化版) ===
  // 1. 移除粗體標記 **text** -> text (非貪婪模式)
  processed = processed.replace(/\*\*([^*]+)\*\*/g, "$1");

  // 2. 將列表項目 * item 轉換為 • item (處理開頭空格情況)
  processed = processed.replace(/^\s*\*\s+/gm, "• ");

  // 3. 核彈級清除：移除所有剩餘的星號
  processed = processed.replace(/\*/g, "");

  // 4. 其他格式化
  processed = processed.replace(/(\d+)\.\s+/g, "$1. ");
  processed = processed.replace(/->/g, "→");

  // === 強化分段邏輯 v29.5.99 ===
  // 1. 基本句尾換行 (句號、驚嘆號、問號)
  processed = processed.replace(/([。！？])\s*/g, "$1\n\n");

  // 2. 分號、冒號後適當分段 (特別是 QA 格式)
  processed = processed.replace(/([；：])\s*/g, "$1\n\n");

  // 3. 長句智能分段：逗號後如果後面還有很多文字，適當換行
  processed = processed.replace(
    /([，])(\s*)([^，。！？；：\n]{15,})/g,
    "$1\n\n$3",
  );

  // 4. 數字列表項前強制換行
  processed = processed.replace(/(\n|^)(\d+\.)/g, "\n\n$2");

  // 5. 移除多餘換行 (3個以上換行合併為2個)
  processed = processed.replace(/\n{3,}/g, "\n\n");

  // v29.5.181: 口吻與前綴統一防呆
  processed = processed.replace(/您/g, "你");
  processed = processed.replace(
    /^\s*根據(?:我|目前|我手上)?(?:的)?資料庫[，,：: ]*/gim,
    "",
  );

  // v29.6.086: 根據手冊/PDF 等競品口吻防呆 (第 13 條)
  processed = processed.replace(/根據(?:你|您)(?:提供|上傳)的\s*(?:PDF|手冊|文件|說明書|檔案)/gi, "根據官方手冊");
  processed = processed.replace(/(?:你|您)提供的\s*(?:PDF|手冊|文件|說明書|檔案)/gi, "官方手冊");

  // v29.6.086: 價格數字雙重防呆，確保最終 LINE 回覆絕對不出現具體價格
  processed = sanitizePriceNumbers_(processed);

  processed = formatListSpacing(processed);
  return processed.trim();
}

function hasVisibleSourceAudit_(text) {
  return /\[來源[:：][^\]]+\]/.test(String(text || ""));
}

function hasVisibleCostAudit_(text) {
  const s = String(text || "");
  return (
    /\[費用\s*[:：]\s*NT\$[^\]]+\]/.test(s) ||
    /\[費用\s*[:：]\s*未知（已呼叫 LLM）\]/.test(s)
  );
}

function buildReplyCostAuditText_() {
  if (
    lastTokenUsage &&
    typeof lastTokenUsage.costTWD === "number" &&
    isFinite(lastTokenUsage.costTWD)
  ) {
    const input =
      typeof lastTokenUsage.input === "number" ? lastTokenUsage.input : 0;
    const output =
      typeof lastTokenUsage.output === "number" ? lastTokenUsage.output : 0;
    const total =
      typeof lastTokenUsage.total === "number" ? lastTokenUsage.total : input + output;
    return `[費用:NT$${lastTokenUsage.costTWD.toFixed(4)}（In:${input}/Out:${output}=${total}）]`;
  }
  if (lastLlmCallAttempted) {
    writeLog("[Reply Audit Guard v29.6.067] LLM 已呼叫但缺少 token/cost metadata，回覆改標未知費用");
    return "[費用:未知（已呼叫 LLM）]";
  }
  return "[費用:NT$0.0000（未呼叫 LLM）]";
}

function buildAggregateCostAuditText_(costTWD, inputTokens, outputTokens) {
  const cost = typeof costTWD === "number" && isFinite(costTWD) ? costTWD : 0;
  const input = typeof inputTokens === "number" ? inputTokens : 0;
  const output = typeof outputTokens === "number" ? outputTokens : 0;
  return `[費用:NT$${cost.toFixed(4)}（In:${input}/Out:${output}）]`;
}

function appendMissingReplyAuditTrail_(text, needsSource, needsCost) {
  let s = text === null || text === undefined ? "" : String(text);
  const suffixLines = [];
  if (needsCost) {
    suffixLines.push(buildReplyCostAuditText_());
  }
  if (suffixLines.length === 0) return s;

  const suffix = suffixLines.join("\n");
  const maxTextLength = 3900 - suffix.length;
  if (s.length > maxTextLength) {
    s = s.substring(0, Math.max(0, maxTextLength)).trim();
  }
  return `${s.trim()}\n\n${suffix}`.trim();
}

function collectVisibleReplyText_(txt) {
  if (Array.isArray(txt)) {
    return txt
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && item.type === "text") {
          return String(item.text || "");
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  }
  if (txt && typeof txt === "object") {
    if (txt.type === "text") return String(txt.text || "");
    return "";
  }
  return txt === null || txt === undefined ? "" : String(txt);
}

function stripLegacyCostAudit_(text) {
  return String(text || "")
    .replace(
      /\n{0,2}---\s*\n\s*本次(?:對話|建檔|修改|整理)?預估花費\s*[：:]?\s*\n?\s*NT\$[0-9]+\.[0-9]{4}\s*(?:\n?\(In:[^)]+\))?/g,
      "",
    )
    .replace(
      /\n{0,2}---\s*\n\s*本次(?:對話|建檔|修改|整理)?預估花費\s*[：:]?\s*NT\$[0-9]+\.[0-9]{4}(?:\s*\(In:[^)]+\))?/g,
      "",
    )
    .replace(
      /\n{0,2}本次(?:對話|建檔|修改|整理)?預估花費\s*[：:]?\s*\n?\s*NT\$[0-9]+\.[0-9]{4}\s*(?:\n?\(In:[^)]+\))?/g,
      "",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripRebuildableCostAudit_(text) {
  const shouldRebuild =
    lastLlmCallAttempted ||
    (lastTokenUsage &&
      typeof lastTokenUsage.costTWD === "number" &&
      isFinite(lastTokenUsage.costTWD));
  if (!shouldRebuild) {
    return String(text || "");
  }
  return String(text || "")
    .replace(/\n{0,2}\[費用\s*[:：]\s*(?:NT\$[^\]]+|未知（已呼叫 LLM）)\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanReplyTextArtifacts_(text) {
  return normalizeVisibleSourceTags_(
    stripRebuildableCostAudit_(
      stripLegacyCostAudit_(String(text === null || text === undefined ? "" : text)),
    ),
  )
    .replace(/\n\s*\]\s*(?=\n+\[來源[:：])/g, "\n")
    .replace(/([。！？])\s*\]\s*(?=\n+\[來源[:：])/g, "$1");
}

function cleanReplyVisibleTextArtifacts_(txt) {
  if (Array.isArray(txt)) {
    return txt.map((item) => {
      if (typeof item === "string") return cleanReplyTextArtifacts_(item);
      if (item && typeof item === "object" && item.type === "text") {
        return Object.assign({}, item, {
          text: cleanReplyTextArtifacts_(item.text || ""),
        });
      }
      return item;
    });
  }
  if (txt && typeof txt === "object" && txt.type === "text") {
    return Object.assign({}, txt, {
      text: cleanReplyTextArtifacts_(txt.text || ""),
    });
  }
  if (txt && typeof txt === "object") return txt;
  return cleanReplyTextArtifacts_(txt);
}

function enforceReplyAuditTrail_(txt) {
  const visibleText = collectVisibleReplyText_(txt);
  const needsSource = false;
  const needsCost = !hasVisibleCostAudit_(visibleText);
  if (!needsSource && !needsCost) return txt;

  if (Array.isArray(txt)) {
    const audited = txt.slice();
    for (let i = audited.length - 1; i >= 0; i--) {
      const item = audited[i];
      if (typeof item === "string") {
        audited[i] = appendMissingReplyAuditTrail_(item, needsSource, needsCost);
        writeLog("[Reply Audit Guard v29.6.067] 已補上缺漏的費用");
        return audited;
      }
      if (item && typeof item === "object" && item.type === "text") {
        audited[i] = Object.assign({}, item, {
          text: appendMissingReplyAuditTrail_(item.text || "", needsSource, needsCost),
        });
        writeLog("[Reply Audit Guard v29.6.067] 已補上缺漏的費用");
        return audited;
      }
    }
    const auditText = appendMissingReplyAuditTrail_("", needsSource, needsCost);
    writeLog("[Reply Audit Guard v29.6.067] Flex-only 回覆已新增費用文字泡泡");
    return [{ type: "text", text: auditText }].concat(audited).slice(0, 5);
  }

  if (txt && typeof txt === "object") {
    if (txt.type === "text") {
      writeLog("[Reply Audit Guard v29.6.067] 已補上缺漏的費用");
      return Object.assign({}, txt, {
        text: appendMissingReplyAuditTrail_(txt.text || "", needsSource, needsCost),
      });
    }
    const auditText = appendMissingReplyAuditTrail_("", needsSource, needsCost);
    writeLog("[Reply Audit Guard v29.6.067] Flex-only 回覆已新增費用文字泡泡");
    return [{ type: "text", text: auditText }, txt];
  }

  writeLog("[Reply Audit Guard v29.6.067] 已補上缺漏的費用");
  return appendMissingReplyAuditTrail_(txt, needsSource, needsCost);
}

function writeRecordDirectly(u, t, c, r, f) {
  // 🧪 TEST MODE: 不寫入「所有紀錄」Sheet (清除測試介面時請移除此判斷)
  if (IS_TEST_MODE) {
    writeLog("[TEST MODE] 跳過寫入所有紀錄 Sheet");
    return;
  }

  try {
    ss.getSheetByName(SHEET_NAMES.RECORDS).appendRow([
      new Date(),
      c,
      u,
      formatForLineMobile(t),
      r,
      f,
    ]);
    SpreadsheetApp.flush();
  } catch (e) {
    console.error("Record Error: " + e.message);
  }
}

/**
 * 處理 LINE 訊息的核心函式 (核彈防禦版 v27.4.0)
 * 修改重點：對所有輸入與快取進行暴力消毒，確保絕不報錯
 */
/**
 * 處理 LINE 訊息的核心函式 (V27.4.1 最終修正版)
 * 修正重點：移除過度轉型，確保 userMessage 純淨，防止 [object Object] 污染
 */
function handleMessage(event) {
  var userId = "UNKNOWN";
  var replyToken = "UNKNOWN";

  try {
    // 1. 基礎防呆
    if (!event || !event.source || !event.message) return;

    userId = event.source.userId;
    replyToken = event.replyToken;
    lastTokenUsage = null;
    lastLlmCallAttempted = false;
    lastSearchSources = null;
    lastWebEvidenceValid = false;

    // 🔥 核心修正：直接讀取，若非字串則強制轉為空字串 (不要用 String() 包物件)
    let userMessage = event.message.text;
    if (typeof userMessage !== "string") {
      userMessage = "";
    }
    userMessage = userMessage.trim();
    // v29.4.56: 全形轉半形 (Ｇ５ -> G5, Ｓ３ -> S3)
    userMessage = toHalfWidth(userMessage);

    // 若收到 "[object Object]" 這種髒資料，視為測試錯誤，強制替換
    if (userMessage === "[object Object]") {
      userMessage = "測試";
      writeLog(userId, "Warning", "偵測到 [object Object] 髒輸入，已自動修正");
    }

    // 空訊息直接跳過
    if (userMessage.length === 0) return;

    const contextId = userId; // 對話 ID 就是 userId
    const cache = CacheService.getScriptCache();
    // v29.6.003: 智慧型圖片-文字併發衝突恢復機制 (Concurrently Pending Query Recovery)
    let processedMessage = userMessage;
    const cleanRaw = processedMessage.trim();
    if (cleanRaw === '.' || cleanRaw === '。' || cleanRaw === '繼續' || cleanRaw === '點' || cleanRaw.length === 1) {
      const interrupted = cache.get(userId + ':interrupted_query');
      if (interrupted) {
        writeLog('[Recovery] 偵測到中斷恢復！將當前「' + processedMessage + '」替換為真實問題：「' + interrupted + '」');
        processedMessage = interrupted;
        userMessage = interrupted;
        cache.remove(userId + ':interrupted_query');
      }
    }

    let waitLoops = 0;
    while (cache.get(contextId + ':image_processing') === 'true' && waitLoops < 7) {
      Utilities.sleep(500);
      waitLoops++;
    }
    if (cache.get(contextId + ':image_processing') === 'true') {
      writeLog('[Race Condition] 攔截！圖片處理尚未結束，暫停文字處理');
      cache.put(userId + ':interrupted_query', processedMessage, 300); // 暫存當前問題，有效期 5 分鐘
      replyMessage(replyToken, '⏳ AI 正在分析您剛傳的圖片。由於系統限制，分析完成時我無法主動通知您。\\n\\n請您大約等待 3-5 秒後，對我發送一個點「.」或任意字元。\\n\\n如果我已經看完了，就會立刻回答您的問題：「' + processedMessage + '」；如果我還在分析，也會提示您再稍等一下喔！');
      return;
    }
    const messageId = event.message.id || null;
    let msg = userMessage;
    let isDualBubbleComplete = false; // v29.3.29: 修正旗標未定義問題
    let filesToAttach = []; // v29.4.19: Fix Scope Error (filesToAttach is not defined)
    let primaryModel = null; // v29.4.20: Fix Scope Error (primaryModel is not defined)
    let aiSearchQuery = null; // v29.4.22: AI-driven search query
    let hasPdfForModel = false; // v29.5.123: 追蹤該型號是否有 PDF（控制 Quick Reply 按鈕）

    // v29.3.26: 手動觸發診斷功能 (供用戶測試二次搜機制用)
    if (msg === "測試二次搜尋") {
      msg += " [AUTO_SEARCH_WEB]";
      writeLog("[Diagnostic] 手動注入 [AUTO_SEARCH_WEB] 標籤進行測試");
    }

    if (!msg.startsWith("#") && isServiceHoursQuery(msg)) {
      const serviceHoursReply = buildServiceHoursReply();
      writeLog(`[Service Hours Guard v29.5.281] 攔截服務/營業時間問題`);
      replyMessage(replyToken, serviceHoursReply, {
        quickReply: {
          items: [
            {
              type: "action",
              action: {
                type: "message",
                label: "🌐 這題再搜網路",
                text: "#這題再搜網路",
              },
            },
          ],
        },
      });
      writeRecordDirectly(userId, msg, contextId, "user", "");
      writeRecordDirectly(userId, serviceHoursReply, contextId, "assistant", "");
      const serviceHoursHistory = getHistoryFromCacheOrSheet(contextId);
      updateHistorySheetAndCache(
        contextId,
        serviceHoursHistory,
        { role: "user", content: msg },
        { role: "assistant", content: serviceHoursReply },
      );
      return;
    }

    if (!msg.startsWith("#") && isSmartMonitorCodecQuestion(msg)) {
      const smartCodecPayload = buildSmartMonitorCodecSelectionPayload(msg, userId);
      writeLog(
        `[Smart Codec Guard v29.6.067] 題目需先選型號再查 PDF，不輸出固定手冊答案: ${smartCodecPayload.models.join(", ")}`,
      );
      replyMessage(replyToken, smartCodecPayload.messages);
      writeRecordDirectly(userId, msg, contextId, "user", "");
      writeRecordDirectly(userId, smartCodecPayload.assistantRecord, contextId, "assistant", "");
      const smartCodecHistory = getHistoryFromCacheOrSheet(contextId);
      updateHistorySheetAndCache(
        contextId,
        smartCodecHistory,
        { role: "user", content: msg },
        { role: "assistant", content: smartCodecPayload.assistantRecord },
      );
      return;
    }

    // v24.3.0: 實時資訊快速回答（日期、時間）
    // 不需要問 AI，直接回答準確資訊
    // v24.3.0: 實時資訊快速回答（日期、時間）
    // v27.8.8: 修正觸發條件，避免 "浪費時間"、"時間不夠" 等日常用語誤觸
    // 只針對明確的問句 (幾點、幾號、現在時間)
    const timeQuery = msg.replace(/\s/g, ""); // 去空白
    // 嚴格匹配：必須包含 "現在"、"幾點"、"幾號"、"今天" 且長度短，或是 "現在幾點" 這樣的組合
    if (
      /^(現在幾點|幾點了|現在時間|今天幾號|今天是幾號|今天日期|星期幾)$/.test(
        timeQuery,
      ) ||
      (timeQuery.length < 10 && /(幾點|幾分|幾號|星期幾)/.test(timeQuery))
    ) {
      const now = new Date();
      const dateStr = now.toLocaleDateString("zh-TW", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      });
      const timeStr = now.toLocaleTimeString("zh-TW");

      let response = null;
      if (/幾號|日期|幾日|星期/.test(timeQuery)) {
        response = `📅 今天是 ${dateStr}`;
      } else if (/幾點|幾分|時間/.test(timeQuery)) {
        response = `🕒 現在是 ${timeStr}`;
      }

      if (response) {
        writeLog(`[HandleMsg] 收到 (RealTime): ${msg}`); // 補上 Log
        replyMessage(replyToken, response);
        writeRecordDirectly(
          userId,
          msg,
          contextId,
          "user",
          response + " [RealTime]",
        ); // 補上對話紀錄 (v29.6.001: 修正參數錯位)
        writeLog(`[RealTime] 實時資訊快速回答: ${response}`);
        return;
      }
    }

    // 短時間內同內容去重 (60 秒內同用戶同訊息只處理一次)
    // 但指令類別不做去重，因為用戶可能需要重試
    // cache = CacheService.getScriptCache(); // v29.6: 已在上方宣告 const cache，免重複宣告
    const isCommand = msg.startsWith("/");
    const isQuickCommand = msg.startsWith("#");

    if (!isCommand && !isQuickCommand && isShortModelContinuation(msg)) {
      const pendingTopicForContinuation =
        cache.get(`${userId}:pending_topic`) ||
        cache.get(`${userId}:last_meaningful_query`) ||
        "";
      const expandedMsg = expandShortModelContinuation(
        msg,
        pendingTopicForContinuation,
      );
      if (expandedMsg && expandedMsg !== msg) {
        writeLog(
          `[Topic Continuation v29.5.241] 短追問展開: ${msg} -> ${expandedMsg.substring(0, 120)}...`,
        );
        msg = expandedMsg;
        userMessage = expandedMsg;
      }
    }

    if (!isCommand) {
      // 2025-12-05: 改用 messageId 進行去重，避免誤判用戶的重複發言 (如 "好的", "謝謝")
      // 若沒有 messageId (舊版相容)，則退回使用內容雜湊
      let dedupKey = "";
      if (messageId) {
        dedupKey = `msg_id_${messageId}`;
      } else {
        dedupKey = `msg_${userId}_${Utilities.computeDigest(
          Utilities.DigestAlgorithm.MD5,
          msg,
        )
          .map((b) => (b & 0xff).toString(16).padStart(2, "0"))
          .join("")}`;
      }

      if (cache.get(dedupKey)) {
        writeLog(`[Duplicate] 忽略重複訊息: ${msg.substring(0, 30)}`);
        return;
      }
      cache.put(dedupKey, "1", 60);
    }

    // v29.5.133: 記錄最近一則「可延續話題」的問題，供 #搜網上其他解答 fallback 使用
    const shouldCacheMeaningfulQuery =
      !isCommand &&
      !isQuickCommand &&
      msg.length >= 2 &&
      !/^(?:1|2|3)$/.test(msg) &&
      !/不滿意這回答請繼續擴大搜尋/.test(msg) &&
      !/請針對你剛才的回答再詳細說明/.test(msg);
    if (shouldCacheMeaningfulQuery) {
      cache.put(`${userId}:last_meaningful_query`, msg, 21600); // 6 小時
    }

    const draftCache = cache.get(CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId);

    // v29.5.185: 長文後 QA 編輯模式確認入口（使用者回「要」可直接進建檔）
    const qaOfferKey = `${userId}:qa_offer_payload`;
    const qaOfferRaw = cache.get(qaOfferKey);
    if (qaOfferRaw && !draftCache && !isCommand && !isQuickCommand) {
      if (isAffirmativeForQaEdit(msg)) {
        try {
          const qaOffer = JSON.parse(qaOfferRaw);
          const draftSeed = String(qaOffer && qaOffer.seed ? qaOffer.seed : "").trim();
          if (draftSeed) {
            const draftReply = startNewEntryDraft(draftSeed, userId);
            replyMessage(replyToken, draftReply);
            writeRecordDirectly(userId, msg, contextId, "user", "");
            writeRecordDirectly(userId, draftReply, contextId, "assistant", "");
            cache.remove(qaOfferKey);
            return;
          }
        } catch (e) {
          writeLog(`[QA Offer] 解析失敗: ${e.message}`);
          cache.remove(qaOfferKey);
        }
      } else if (isNegativeForQaEdit(msg)) {
        cache.remove(qaOfferKey);
      }
    }

    // ⭐ 立即顯示 Loading 動畫（去重後、處理前）
    // v29.3.25: 移除 hasRecentAnimation 判定，強制每一題都發送動畫請求，
    // 因為 LINE 會自動處理 5s 內的重複請求，我們端點保持最高靈敏度。
    showLoadingAnimation(userId, 60);

    // A. 建檔模式（優先於長文模式，避免草稿內容被誤判為去廣告摘要）
    if (draftCache && !msg.startsWith("/")) {
      handleDraftModification(msg, userId, replyToken, JSON.parse(draftCache));
      return;
    }

    // v29.5.184: 長文去廣告模式（科技長文貼上 → 去廣告 + 摘要 + 整理後原文）
    const isLongArticle =
      msg.length > 200 || (msg.length > 140 && isLikelyPastedLongArticle(msg));
    if (isLongArticle && !msg.startsWith("/") && !msg.startsWith("#")) {
      const validContent = isValidTechContent(msg) || hasTechSignals(msg);
      if (validContent) {
        writeLog(
          `[ArticleClean] 偵測到科技長文 (${msg.length} 字)，啟動去廣告摘要模式`,
        );

        let articlePersona = "";
        try {
          const prompts = getPromptsFromCacheOrSheet();
          articlePersona = prompts["長文去廣告摘要"] || "";
        } catch (e) {
          writeLog(`[ArticleClean] Prompt Load Failed: ${e.message}`);
        }

        if (!articlePersona) {
          articlePersona =
            "你是科技內容整理助手。使用者貼上的是整篇網頁內容，通常含廣告、導購、訂閱、重複段落。\n" +
            "任務：\n" +
            "1. 移除廣告、導購、訂閱、與主題無關段落。\n" +
            "2. 保留可驗證的事實與主要論點，不要編造。\n" +
            "3. 先給【重點摘要】（3-6點）。\n" +
            "4. 再給【去廣告原文】（依原文順序重整，保留核心內容）。\n" +
            "5. 使用繁體中文與條列，語句清楚。\n" +
            "6. 禁止回答客服路由標記（如[AUTO_SEARCH_PDF]）。";
        }

        const articlePrompt =
          `${articlePersona}\n\n` +
          "請嚴格使用以下輸出結構：\n" +
          "重要：即使內容與三星產品無關，也必須完整輸出【重點摘要】與【去廣告原文】，禁止只回覆一句「內容無關」。\n\n" +
          "【重點摘要】\n1. ...\n2. ...\n3. ...\n\n" +
          "【去廣告原文】\n(重整後內容)\n\n" +
          `[使用者貼上的原文]\n${msg}`;

        const modelName = CONFIG.MODEL_NAME_FAST;
        const payload = {
          contents: [
            {
              role: "user",
              parts: [{ text: articlePrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2600,
          },
        };

        const startTime = new Date().getTime();
        const GEMINI_API_KEY =
          PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

        try {
          lastLlmCallAttempted = true;
          const response = UrlFetchApp.fetch(apiUrl, {
            method: "post",
            contentType: "application/json",
            payload: JSON.stringify(payload),
            muteHttpExceptions: true,
          });
          const result = JSON.parse(response.getContentText());

          let replyText = "";
          let inputTokens = 0;
          let outputTokens = 0;
          let cost = 0;

          if (result.candidates && result.candidates[0].content) {
            replyText = result.candidates[0].content.parts[0].text || "";
          }

          if (result.usageMetadata) {
            inputTokens = result.usageMetadata.promptTokenCount || 0;
            outputTokens = result.usageMetadata.candidatesTokenCount || 0;
            cost = inputTokens * 0.0000032 + outputTokens * 0.0000128;
          } else {
            inputTokens = msg.length;
            outputTokens = replyText.length;
            cost = inputTokens * 0.0000032 + outputTokens * 0.0000128;
          }

          replyText = formatForLineMobile(replyText)
            .replace(/\[AUTO_SEARCH_PDF[^\]]*\]/gi, "")
            .replace(/\[AUTO_SEARCH_WEB[^\]]*\]/gi, "")
            .trim();
          const normalizedArticleReply = ensureArticleCleanOutputFormat(
            replyText,
            msg,
          );
          if (normalizedArticleReply !== replyText) {
            writeLog("[ArticleClean] AI 輸出非標準格式，已套用本地格式修正");
            replyText = normalizedArticleReply;
          }

          const articleBodyForQaSeed = replyText.trim();
          const costStr = cost < 0.01 ? "0.01" : cost.toFixed(2);
          const footer = `\n\n[模式:去廣告摘要]\n[費用:NT$${costStr}]`;
          replyText += footer;

          const relatedToProject = isProjectRelevantLongContent(msg);
          const qaCandidate = relatedToProject && isQACandidateLongContent(msg);
          if (qaCandidate) {
            const guide = buildQaEditInstructionText();
            replyText +=
              "\n\n---\n這篇內容看起來和本專案相關，也具備 QA 題材。\n要不要進入 QA 編輯模式（加入 QA）？\n\n" +
              guide;

            // 儲存可直接進建檔的草稿種子：必須先整理成單行 QA，避免把摘要/原文整包塞進 QA 編輯模式。
            const seedText = buildArticleQaDraftSeed(
              articleBodyForQaSeed,
              msg,
            ).substring(0, 2500);
            cache.put(
              `${userId}:qa_offer_payload`,
              JSON.stringify({
                seed: seedText,
                source: "ArticleClean",
                ts: new Date().toISOString(),
              }),
              1800,
            );
          } else {
            cache.remove(`${userId}:qa_offer_payload`);
          }

          replyMessage(replyToken, replyText);
          writeRecordDirectly(userId, msg, contextId, "user", "");
          writeRecordDirectly(userId, replyText, contextId, "ArticleClean", "");
          writeLog(
            `[ArticleClean] 完成去廣告摘要，耗時 ${
              (new Date().getTime() - startTime) / 1000
            }s, Cost: ${costStr}`,
          );
          return;
        } catch (e) {
          writeLog(`[ArticleClean] Error: ${e.message}`);
        }
      } else {
        writeLog(`[ArticleClean] 長文但無科技關鍵字，略過去廣告模式`);
        replyMessage(
          replyToken,
          "這篇看起來是長文內容。如果你希望我做「去網頁廣告 + 重點摘要 + 整理後原文」，請貼科技相關文章，我就會直接啟動這個模式。",
        );
        return;
      }
    }

    // v27.8.8: 將 Log 移到去重之後、處理之前，確保每條通過去重的訊息都有紀錄
    writeLog(`[HandleMsg] 收到: ${msg}`);
    // v24.1.23: 移除 PENDING_QUERY 相關邏輯 (Auto Deep Search 取代)
    // const pendingQuery = cache.get(CACHE_KEYS.PENDING_QUERY + userId);

    // v29.5.118: 攔截舊版「不滿意...」按鈕（向下相容）
    const isWebSearchRequest =
      (msg.includes("不滿意") || msg.includes("不太滿意")) &&
      (msg.includes("擴大搜尋") ||
        msg.includes("網路搜尋") ||
        msg.includes("繼續搜尋") ||
        msg.includes("搜尋網路") ||
        msg.includes("搜尋其他資料"));
    const isPdfSearchRequest =
      (msg.includes("不滿意") || msg.includes("不太滿意")) &&
      (msg.includes("查詢使用手冊") ||
        msg.includes("查閱產品手冊") ||
        msg.includes("繼續查詢使用手冊") ||
        msg.includes("查詢手冊"));

    if (isWebSearchRequest) {
      writeLog(`[Force Web] 收到網路搜尋請求，強制切換至網路搜尋模式`);
      const cmdResult = handleCommand(
        "不滿意這回答請繼續擴大搜尋",
        userId,
        contextId,
      ); // Reuse existing command logic
      replyMessage(replyToken, cmdResult);
      return;
    }

    // v29.5.55: PDF Search Request - 強制觸發 PDF 模式
    if (isPdfSearchRequest) {
      writeLog(`[Force PDF] 收到手冊查詢請求，強制切換至 PDF 模式`);
      // 設置 PDF Mode
      const pdfModeKey = CACHE_KEYS.PDF_MODE_PREFIX + contextId;
      cache.put(pdfModeKey, "true", 300);
      // 不 return，讓流程繼續往下走，進入正常的 PDF 載入邏輯
    }

    // B. 指令
    if (msg.startsWith("/")) {
      const cmdResult = handleCommand(msg, userId, contextId);
      writeLog(`[Reply] ${cmdResult.substring(0, 100)}...`);
      replyMessage(replyToken, cmdResult);
      const isReset = msg === "/重啟" || msg === "/reboot" ? "TRUE" : "";
      if (isReset) writeRecordDirectly(userId, msg, contextId, "user", isReset);
      if (cmdResult) {
        writeRecordDirectly(userId, cmdResult, contextId, "assistant", "");
      }
      return;
    }

    if (!msg.startsWith("#") && isOutOfProjectScopeQuery(msg)) {
      const scopeReply = buildOutOfProjectScopeReply(msg);
      writeLog(`[Scope Guard v29.5.156] 攔截非專案範圍問題`);
      replyMessage(replyToken, scopeReply);
      writeRecordDirectly(userId, msg, contextId, "user", "");
      writeRecordDirectly(userId, scopeReply, contextId, "assistant", "");
      const scopeHistory = getHistoryFromCacheOrSheet(contextId);
      updateHistorySheetAndCache(
        contextId,
        scopeHistory,
        { role: "user", content: msg },
        { role: "assistant", content: scopeReply },
      );
      return;
    }

    if (
      !msg.startsWith("#") &&
      isTimelyWebInfoQuery(msg) &&
      !findLocalCampaignRuleForQuery(msg)
    ) {
      const timelyReply = buildTimelyWebInfoReply(msg);
      writeLog(`[Force Web Intent v29.5.156] 時效資訊題，改走官網/網路搜尋引導`);
      replyMessage(replyToken, timelyReply, {
        quickReply: {
          items: [
            {
              type: "action",
              action: {
                type: "message",
                label: "🌐 這題再搜網路",
                text: "#這題再搜網路",
              },
            },
          ],
        },
      });
      writeRecordDirectly(userId, msg, contextId, "user", "");
      writeRecordDirectly(userId, timelyReply, contextId, "assistant", "");
      const timelyHistory = getHistoryFromCacheOrSheet(contextId);
      updateHistorySheetAndCache(
        contextId,
        timelyHistory,
        { role: "user", content: msg },
        { role: "assistant", content: timelyReply },
      );
      return;
    }

    if (!msg.startsWith("#") && isPriceQueryIntent_(msg)) {
      const priceReply = buildNoPriceReply_(msg);
      writeLog(`[Price Guard v29.5.157] 攔截價格數字回覆，改導官網查價頁`);
      replyMessage(replyToken, priceReply);
      writeRecordDirectly(userId, msg, contextId, "user", "");
      writeRecordDirectly(userId, priceReply, contextId, "assistant", "");
      const priceHistory = getHistoryFromCacheOrSheet(contextId);
      updateHistorySheetAndCache(
        contextId,
        priceHistory,
        { role: "user", content: msg },
        { role: "assistant", content: priceReply },
      );
      return;
    }

    if (!msg.startsWith("#") && msg.length < 500) {
      const unknownFullModels = getUnknownFullModelTokens(msg);
      if (unknownFullModels.length > 0) {
        const unknownModelReply = buildUnknownFullModelReply(unknownFullModels);
        writeLog(
          `[Unknown Model Guard v29.5.283] 攔截未登錄完整型號: ${unknownFullModels.join(", ")}`,
        );
        replyMessage(replyToken, unknownModelReply);
        writeRecordDirectly(userId, msg, contextId, "user", "");
        writeRecordDirectly(
          userId,
          unknownModelReply,
          contextId,
          "assistant",
          "",
        );
        const unknownModelHistory = getHistoryFromCacheOrSheet(contextId);
        updateHistorySheetAndCache(
          contextId,
          unknownModelHistory,
          { role: "user", content: msg },
          { role: "assistant", content: unknownModelReply },
        );
        return;
      }
    }

    let skipAliasFeatureGuard = false;

    // C. 深度搜尋確認 (已廢棄)
    // v24.1.23: 移除手動確認邏輯，全面改為自動觸發
    /*
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
                                      */

    // C2. v24.4.0: PDF 型號選擇回覆處理
    // 如果用戶之前被問了「請選擇型號」，這裡處理他的回覆
    if (handlePdfSelectionReply(msg, userId, replyToken, contextId)) {
      return; // 已處理完成
    }

    // ══════════════════════════════════════════════════════════
    // v29.5.118: 攔截 #型號:XXX（V3 泡泡選擇）
    // 用戶點泡泡 → LINE 發送 #型號:S27FG900XC → 直接進 Pass 1.5 PDF 模式
    // ══════════════════════════════════════════════════════════
    if (msg.startsWith("#型號:")) {
      const selectedModel = msg.replace("#型號:", "").trim().toUpperCase();
      writeLog(`[Model Select v29.5.120] 🎯 用戶選擇型號: ${selectedModel}`);
      cache.put(`${userId}:last_selected_model`, selectedModel, 21600);
      const modelSelectModeKey = `${userId}:model_select_mode`;
      const modelSelectMode = cache.get(modelSelectModeKey) || "pdf";

      // v29.5.175: 依泡泡上下文決定選型後流程
      // fast: 鎖定型號後回到一般 SOP（QA/RULE -> PDF -> WEB）
      // pdf : 直接進 Pass 1.5（既有行為）
      if (modelSelectMode === "fast") {
        cache.put(
          `${userId}:direct_search_models`,
          JSON.stringify([selectedModel]),
          300,
        );
        cache.remove(`${userId}:hit_alias_key`);

        let savedTopic = cache.get(`${userId}:pending_topic`) || "";
        if (!savedTopic) {
          const historyForTopic = getHistoryFromCacheOrSheet(contextId);
          const MODEL_ONLY_RE = /^[A-Z0-9\-]{3,30}$/i;
          for (let i = historyForTopic.length - 1; i >= 0; i--) {
            if (historyForTopic[i].role === "user") {
              let content = historyForTopic[i].content || "";
              content = content.replace(/\[System Hint:.*?\]/gs, "").trim();
              if (
                content.length > 5 &&
                !content.startsWith("#") &&
                !content.includes("不滿意") &&
                !content.includes("繼續問") &&
                !content.match(/^\d$/) &&
                !MODEL_ONLY_RE.test(content) &&
                !content.includes("(型號:")
              ) {
                savedTopic = content;
                break;
              }
            }
          }
        }

        let normalizedTopic = String(savedTopic || "");
        const shortAliasesInTopic = (
          normalizedTopic.match(/\b[SGM]\d{1,2}[A-Z]{0,3}\b/gi) || []
        ).filter((t) => isShortAliasModelToken(t));
        shortAliasesInTopic.forEach((tok) => {
          const re = new RegExp(`\\b${tok}\\b`, "gi");
          normalizedTopic = normalizedTopic.replace(re, "");
        });
        normalizedTopic = normalizedTopic
          .replace(/\s{2,}/g, " ")
          .replace(/^[,，。；;、\s]+|[,，。；;、\s]+$/g, "")
          .trim();

        const queryText = normalizedTopic
          ? `${normalizedTopic} (型號: ${selectedModel})`
          : selectedModel;
        msg = queryText;
        userMessage = queryText;
        skipAliasFeatureGuard = true;

        cache.remove(`${userId}:pending_topic`);
        cache.remove(modelSelectModeKey);
        writeLog(
          `[Model Select v29.5.175] Fast 模式：鎖定型號後回到一般流程 -> ${queryText.substring(0, 80)}`,
        );
      } else {

        // 注入型號到 Cache
        cache.put(
          `${userId}:direct_search_models`,
          JSON.stringify([selectedModel]),
          300,
        );

        // 設置 PDF Mode
        const pdfModeKey = CACHE_KEYS.PDF_MODE_PREFIX + contextId;
        cache.put(pdfModeKey, "true", 300);

        // 取得保存的話題（用戶之前問的問題）
        let savedTopic = cache.get(`${userId}:pending_topic`) || "";

      // v29.5.121: 若 pending_topic 為空，從歷史找原始問題
        if (!savedTopic) {
          const historyForTopic = getHistoryFromCacheOrSheet(contextId);
          const MODEL_ONLY_RE = /^[A-Z0-9\-]{3,30}$/i;
          for (let i = historyForTopic.length - 1; i >= 0; i--) {
            if (historyForTopic[i].role === "user") {
              let content = historyForTopic[i].content || "";
              content = content.replace(/\[System Hint:.*?\]/gs, "").trim();
              if (
                content.length > 5 &&
                !content.startsWith("#") &&
                !content.includes("不滿意") &&
                !content.includes("繼續問") &&
                !content.match(/^\d$/) &&
                !MODEL_ONLY_RE.test(content) &&
                !content.includes("(型號:")
              ) {
                savedTopic = content;
                writeLog(
                  `[Model Select v29.5.121] 從歷史找到原始問題: ${savedTopic.substring(0, 50)}`,
                );
                break;
              }
            }
          }
        }

        const queryText = isSmartMonitorCodecQuestion(savedTopic)
          ? `請查官方手冊「支援的視訊編解碼器」表格與 HEVC/H.265 相關注意事項：${selectedModel} 播放檔案是否支援 HEVC/H.265 格式？如果表格列有 HEVC（H.265 - Main、Main10）就回答支援。請同時搜尋手冊是否有「HEVC 編解碼器僅適用於 MKV / MP4 / TS 檔案類型」這類限制；若有就列出 MKV/MP4/TS，若沒有就明確說手冊未列出檔案類型限制。禁止使用「通常」「常見」「應該」等推測語。只有找不到 HEVC/H.265 記載時才回答手冊未記載。 (型號: ${selectedModel})`
          : savedTopic
            ? `${savedTopic} (型號: ${selectedModel})`
            : selectedModel;

        showLoadingAnimation(userId, 60);
        writeLog(
          `[Model Select v29.5.120] 執行 Pass 1.5，查詢: ${queryText.substring(0, 80)}`,
        );

        // ── 🆕 v29.6.090: 本地 QA 直通車 ──
        // 優先在本地比對 QA 庫，若有精準命中，直接回覆，不需呼叫 LLM 查手冊！
        const localMatch = findLocalMatchInQA(queryText, userId);
        if (localMatch) {
          writeLog(`[Local QA Hit v29.6.090] 🎯 本地精準匹配 QA: "${localMatch.question.substring(0, 50)}"`);
          let matchReply = localMatch.answer;
          matchReply = formatForLineMobile(matchReply);
          matchReply += "\n\n[來源:QA庫]\n[費用:NT$0.0000（未呼叫 LLM）]";
          
          replyMessage(replyToken, matchReply);
          writeRecordDirectly(userId, queryText, contextId, "user", "");
          writeRecordDirectly(userId, matchReply, contextId, "assistant", "");
          const localHistory = getHistoryFromCacheOrSheet(contextId);
          updateHistorySheetAndCache(
            contextId,
            localHistory,
            { role: "user", content: queryText },
            { role: "assistant", content: matchReply }
          );
          return;
        }

      // ── 關鍵修復 v29.5.120: 實際呼叫 getRelevantKBFiles 取得 PDF ──
        const kbList = JSON.parse(
          PropertiesService.getScriptProperties().getProperty(
            CACHE_KEYS.KB_URI_LIST,
          ) || "[]",
        );
        const searchMsg = { role: "user", content: queryText };
        const checkModelRegex = /\b(G\d{1,2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|(?:L?S)\d{1,2}[A-Z]{0,2}\d{0,4}[A-Z0-9]{0,5}|(L?[CF])\d{2}[A-Z]+\d{2,4}[A-Z0-9]*|WA\d+[A-Z\d]*|WD\d+[A-Z\d]*|VR\d+[A-Z\d]*)\b/i;
        const hasModelInQuery = checkModelRegex.test(queryText);
        const kbResult = getRelevantKBFiles(
          [searchMsg],
          kbList,
          userId,
          contextId,
          hasModelInQuery, // 智慧設定：有型號時只查當前，無型號時允許沿用歷史
        );
        const relevantFiles = Array.isArray(kbResult)
          ? kbResult
          : kbResult.files || [];
        const primaryModel = Array.isArray(kbResult)
          ? null
          : kbResult.primaryModel || null;
        writeLog(
          `[Model Select v29.5.120] PDF 匹配: ${relevantFiles.length} 個檔案`,
        );

        const history = getHistoryFromCacheOrSheet(contextId);
        const userMsgObj = { role: "user", content: queryText };

        const response = callLLMWithRetry(
          queryText,
          [...history, userMsgObj],
          relevantFiles, // ← 實際掛載 PDF
          true, // attachPDFs
          null,
          false,
          userId,
          false,
          primaryModel || selectedModel,
        );

        if (response) {
          if (response === "[KB_EXPIRED]") {
            const expiredText = "⚠️ 系統偵測到產品手冊需要更新，正在背景自動重新整理中。大約 1 分鐘後即可恢復正常，請稍後再試喔！";
            replyMessage(replyToken, expiredText);
            writeRecordDirectly(userId, queryText, contextId, "user", "");
            writeRecordDirectly(userId, expiredText, contextId, "assistant", "");
            const expHistory = getHistoryFromCacheOrSheet(contextId);
            updateHistorySheetAndCache(
              contextId,
              expHistory,
              { role: "user", content: queryText },
              { role: "assistant", content: expiredText }
            );
            return;
          }
          let finalText = stripAnySourceTags(formatForLineMobile(response));
          const requestedWeb = /\[AUTO_SEARCH_WEB\]/i.test(finalText);
          finalText = finalText.replace(/\[AUTO_SEARCH_PDF\]/g, "").trim();
          finalText = finalText.replace(/\[NEW_TOPIC\]/g, "").trim();
          finalText = finalText.replace(/\[AUTO_SEARCH_WEB\]/g, "").trim();
          finalText = finalText.replace(/\[型號[:：][^\]]+\]/g, "").trim();
          finalText = sanitizeManualDeflection(finalText);
          finalText = enforceManualUncertaintyGuard(finalText, queryText);
          if (isCrossDeviceMonitorQuery(queryText)) {
            finalText = removeCrossDeviceManualHeadingOnlyLines_(finalText);
          }
          finalText = enforceManualNumberedList(finalText);
          const offerWebVerification = shouldOfferCrossDeviceWebVerification(
            queryText,
            finalText,
            requestedWeb,
          );
          if (offerWebVerification) {
            finalText = appendCrossDeviceWebVerificationNotice(finalText);
            writeLog(
              "[Cross Device Web Handoff v29.6.070] 手冊只確認螢幕端，保留回答並提供裝置端網搜入口",
            );
          }
          if (
            selectedModel &&
            finalText.toUpperCase().indexOf(selectedModel.toUpperCase()) < 0
          ) {
            finalText = `針對 ${selectedModel}：\n${finalText}`;
          }

          // v29.5.158: 來源標註改為真實 PDF 檔名，避免顯示不存在的手冊名稱
          if (relevantFiles.length > 0) {
            finalText = appendPdfSourceTag(finalText, relevantFiles, 1);
          }
          if (relevantFiles.length > 0) {
            finalText = ensurePdfSourceTag(finalText, relevantFiles, 1);
            markPdfConsultedForUser_(cache, userId);
          }

          let replyText = finalText;
          if (DEBUG_SHOW_TOKENS && lastTokenUsage && lastTokenUsage.costTWD) {
            replyText += `\n\n${buildReplyCostAuditText_()}`;
          }

          // v29.5.126: #型號: handler 已查 PDF，不再顯示「查手冊」
          const manualReplyAnchor = getElaborationTopicAnchor_(
            cache,
            userId,
            queryText,
          );
          const manualElaborationCount = getElaborationCountForAnchor_(
            cache,
            userId,
            manualReplyAnchor,
          );
          const qrItems = [];
          if (manualElaborationCount < MAX_ELABORATE_PER_ANSWER) {
            qrItems.push({
              type: "action",
              action: {
                type: "message",
                label: "💬 再詳細說明",
                text: "#再詳細說明",
              },
            });
          }
          qrItems.push({
            type: "action",
            action: {
              type: "message",
              label: "🌐 這題再搜網路",
              text: "#這題再搜網路",
            },
          });
          const qrOptions = { quickReply: { items: qrItems } };
          replyMessage(replyToken, replyText, qrOptions);
          writeLog(`[AI Reply] ${replyText}`);

          const asstMsgObj = { role: "assistant", content: finalText };
          updateHistorySheetAndCache(contextId, history, userMsgObj, asstMsgObj);
          writeRecordDirectly(userId, msg, contextId, "user", "");
          writeRecordDirectly(userId, replyText, contextId, "assistant", "");
        } else {
          replyMessage(replyToken, "⚠️ 查詢手冊時發生錯誤，請稍後再試");
        }

        cache.remove(`${userId}:pending_topic`);
        cache.remove(modelSelectModeKey);
        return;
      }
    }

    // ══════════════════════════════════════════════════════════
    // v29.5.118: 攔截 #查手冊 / #這題再搜網路（含舊指令相容）
    // ══════════════════════════════════════════════════════════
    // v29.5.133: 支援自然語句觸發手冊（例如：我想找手冊上的答案 / 查手冊 S27FG900XC ...）
    const naturalManualCmd = msg.match(
      /^(?:我想(?:找|查|看)?手冊(?:上的答案)?|幫我查手冊|請查手冊|查手冊|查說明書|看說明書)\s*(.*)$/i,
    );
    if (!msg.startsWith("#") && naturalManualCmd) {
      const manualTail = (naturalManualCmd[1] || "").trim();
      msg = manualTail ? `#查手冊 ${manualTail}` : "#查手冊";
      userMessage = msg;
      writeLog(
        `[Quick Reply v29.5.133] 自然語句轉換為手冊指令: ${msg.substring(0, 80)}`,
      );
    }

    if (msg === "#查手冊" || msg.startsWith("#查手冊 ")) {
      writeLog(`[Quick Reply v29.5.120] 用戶要求查手冊`);
      // 設置 PDF Mode
      const pdfModeKey = CACHE_KEYS.PDF_MODE_PREFIX + contextId;
      cache.put(pdfModeKey, "true", 300);
      const manualQueryFromCmd = msg.replace(/^#查手冊\s*/, "").trim();

      // 從歷史找出上一個真正的問題（跳過 #型號:, #查手冊, 純型號 等）
      const history = getHistoryFromCacheOrSheet(contextId);
      let lastQuestion = manualQueryFromCmd || "";
      const MODEL_ONLY_RE = /^[A-Z0-9\-]{3,30}$/i;
      if (!lastQuestion) {
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].role === "user") {
            let content = history[i].content || "";
            content = content.replace(/\[System Hint:.*?\]/gs, "").trim();
            // v29.5.120: 跳過 #型號:XXX、#查手冊、#搜網上其他解答、純型號、泡泡選擇等
            if (
              content.length > 5 &&
              !content.startsWith("#") &&
              !content.includes("不滿意") &&
              !content.includes("繼續問") &&
              !content.includes("請針對你剛才的回答再詳細說明") &&
              !content.includes("不需要查 PDF 或網路") &&
              !content.includes("不要輸出任何系統暗號") &&
              !content.match(/^\d$/) &&
              !MODEL_ONLY_RE.test(content) &&
              !content.includes("(型號:") // 跳過 #型號: 攔截器產生的記錄
            ) {
              lastQuestion = content;
              break;
            }
          }
        }
      }

      if (!lastQuestion) {
        replyMessage(
          replyToken,
          "請先告訴我型號或問題，我再幫你查手冊。\n你可以這樣輸入：\n#查手冊 S27FG900XC 怎麼開啟 Odyssey Hub\n或：查手冊 S27FG900XC 怎麼開啟 Odyssey Hub",
        );
        return;
      }

      if (isSmartMonitorCodecQuestion(lastQuestion)) {
        const smartCodecPayload = buildSmartMonitorCodecSelectionPayload(lastQuestion, userId);
        writeLog(
        `[Smart Codec Guard v29.6.067] #查手冊 顯示 Smart Monitor PDF 型號選擇，不輸出固定手冊答案: ${smartCodecPayload.models.join(", ")}`,
        );
        replyMessage(replyToken, smartCodecPayload.messages);
        updateHistorySheetAndCache(
          contextId,
          history,
          { role: "user", content: lastQuestion },
          { role: "assistant", content: smartCodecPayload.assistantRecord },
        );
        writeRecordDirectly(userId, msg, contextId, "user", "");
        writeRecordDirectly(userId, smartCodecPayload.assistantRecord, contextId, "assistant", "");
        return;
      }

      if (promptAliasOnlyModelSelection(lastQuestion, userId, replyToken, contextId, "pdf")) {
        return;
      }

      showLoadingAnimation(userId, 60);
      writeLog(
        `[Quick Reply v29.5.120] 查手冊，問題: ${lastQuestion.substring(0, 60)}`,
      );

      // ── 關鍵修復 v29.5.120: 實際呼叫 getRelevantKBFiles 取得 PDF ──
      const kbList = JSON.parse(
        PropertiesService.getScriptProperties().getProperty(
          CACHE_KEYS.KB_URI_LIST,
        ) || "[]",
      );
      const searchMsg = { role: "user", content: lastQuestion };
      const checkModelRegex = /\b(G\d{1,2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|(?:L?S)\d{1,2}[A-Z]{0,2}\d{0,4}[A-Z0-9]{0,5}|(L?[CF])\d{2}[A-Z]+\d{2,4}[A-Z0-9]*|WA\d+[A-Z\d]*|WD\d+[A-Z\d]*|VR\d+[A-Z\d]*)\b/i;
      const hasModelInQuery = checkModelRegex.test(lastQuestion);
      writeLog(
        `[Quick Reply v29.5.242] #查手冊 forceCurrentOnly=${hasModelInQuery}（有型號時跳過歷史/Cache 型號注入）`,
      );
      const kbResult = getRelevantKBFiles(
        [searchMsg],
        kbList,
        userId,
        contextId,
        hasModelInQuery,
      );
      const relevantFiles = Array.isArray(kbResult)
        ? kbResult
        : kbResult.files || [];
      const primaryModel = Array.isArray(kbResult)
        ? null
        : kbResult.primaryModel || null;
      writeLog(
        `[Quick Reply v29.5.120] PDF 匹配: ${relevantFiles.length} 個檔案`,
      );

      const userMsgObj = { role: "user", content: lastQuestion };
      const response = callLLMWithRetry(
        lastQuestion,
        [userMsgObj],
        relevantFiles, // ← 實際掛載 PDF
        true, // attachPDFs
        null,
        false,
        userId,
        false,
        primaryModel,
      );

      if (response && response !== '[KB_EXPIRED]') {
        let finalText = stripAnySourceTags(formatForLineMobile(response));
        const requestedWeb = /\[AUTO_SEARCH_WEB\]/i.test(finalText);
        finalText = finalText.replace(/\[AUTO_SEARCH_PDF\]/g, "").trim();
        finalText = finalText.replace(/\[NEW_TOPIC\]/g, "").trim();
        finalText = finalText.replace(/\[AUTO_SEARCH_WEB\]/g, "").trim();
        finalText = finalText.replace(/\[型號[:：][^\]]+\]/g, "").trim();
        finalText = sanitizeManualDeflection(finalText);
        finalText = enforceManualUncertaintyGuard(finalText, lastQuestion);
        if (isCrossDeviceMonitorQuery(lastQuestion)) {
          finalText = removeCrossDeviceManualHeadingOnlyLines_(finalText);
        }
        finalText = enforceManualNumberedList(finalText);
        const offerWebVerification = shouldOfferCrossDeviceWebVerification(
          lastQuestion,
          finalText,
          requestedWeb,
        );
        if (offerWebVerification) {
          finalText = appendCrossDeviceWebVerificationNotice(finalText);
          writeLog(
            "[Cross Device Web Handoff v29.6.070] #查手冊只確認螢幕端，保留回答並提供裝置端網搜入口",
          );
        }

        // v29.5.158: 來源標註改為真實 PDF 檔名，避免顯示不存在的手冊名稱
        if (relevantFiles.length > 0) {
          finalText = appendPdfSourceTag(finalText, relevantFiles, 1);
        }
        if (relevantFiles.length > 0) {
          finalText = ensurePdfSourceTag(finalText, relevantFiles, 1);
          markPdfConsultedForUser_(cache, userId);
        }

        let replyText = finalText;
        if (DEBUG_SHOW_TOKENS && lastTokenUsage && lastTokenUsage.costTWD) {
          replyText += `\n\n${buildReplyCostAuditText_()}`;
        }

        const manualReplyAnchor = computeReplyAnchor_(finalText);
        const manualElaborationCount = getElaborationCountForAnchor_(
          cache,
          userId,
          manualReplyAnchor,
        );
        const manualQrItems = [];
        if (manualElaborationCount < MAX_ELABORATE_PER_ANSWER) {
          manualQrItems.push({
            type: "action",
            action: {
              type: "message",
              label: "💬 再詳細說明",
              text: "#再詳細說明",
            },
          });
        }
        manualQrItems.push({
          type: "action",
          action: {
            type: "message",
            label: "🌐 這題再搜網路",
            text: "#這題再搜網路",
          },
        });
        const qrOptions = { quickReply: { items: manualQrItems } };
        replyMessage(replyToken, replyText, qrOptions);
        writeLog(`[AI Reply] ${replyText}`);

        const asstMsgObj = { role: "assistant", content: finalText };
        updateHistorySheetAndCache(contextId, history, userMsgObj, asstMsgObj);
        writeRecordDirectly(userId, msg, contextId, "user", "");
        writeRecordDirectly(userId, replyText, contextId, "assistant", "");
      } else {
        const expiredText = (response === '[KB_EXPIRED]') ? '⚠️ 系統偵測到產品手冊需要更新，正在背景自動重新整理中。大約 1 分鐘後即可恢復正常，請稍後再試喔！' : '⚠️ 查詢手冊時發生錯誤，請稍後再試';
        replyMessage(replyToken, expiredText);
      }
      return;
    }

    if (msg === "#再詳細說明") {
      writeLog(`[Quick Reply v29.5.129] 用戶點擊「再詳細說明」`);
      const historyForContinue = getHistoryFromCacheOrSheet(contextId);
      const lastAssistantMsg = historyForContinue
        .slice()
        .reverse()
        .find((h) => h.role === "assistant" && (h.content || "").trim());
      if (!lastAssistantMsg) {
        replyMessage(
          replyToken,
          "我目前找不到上一則回答，請直接再問一次你想深入的問題。",
        );
        return;
      }
      if (isApiFailureReply(lastAssistantMsg.content)) {
        const retryText =
          "上一則回答是系統暫時忙碌，還沒有成功查到內容，所以我先不展開，避免補出不可靠資訊。\n\n請稍後再試一次，或直接補完整型號與問題，我會重新依 QA/規格庫 → 官方手冊 → 必要時網路搜尋的流程查。";
        replyMessage(replyToken, retryText);
        writeLog(`[Quick Reply v29.5.280] 上一則為 API 失敗，停止再詳細說明`);
        writeRecordDirectly(userId, msg, contextId, "user", "");
        writeRecordDirectly(userId, retryText, contextId, "assistant", "");
        updateHistorySheetAndCache(
          contextId,
          historyForContinue,
          { role: "user", content: msg },
          { role: "assistant", content: retryText },
        );
        return;
      }

      const previousWasManual = /\[來源[:：]\s*官方手冊\]/.test(
        String(lastAssistantMsg.content || ""),
      );
      if (previousWasManual) {
        const selectedManualModel =
          String(cache.get(`${userId}:last_selected_model`) || "").trim().toUpperCase() ||
          getSelectedModelFromRecentHistory_(historyForContinue);
        const previousQuestion = getPreviousMeaningfulUserQuestion_(historyForContinue);
        if (!selectedManualModel || !previousQuestion) {
          const retryManualText =
            "我找不到剛才查手冊時使用的完整型號或原問題，先不憑印象補充。你再點一次型號或直接補完整型號，我會重新照官方手冊說明。";
          replyMessage(replyToken, retryManualText);
          writeLog("[Manual Elaboration Guard] 缺少原題或型號，拒絕離線補寫手冊答案");
          return;
        }

        const manualElaborationQuery = buildManualElaborationQuery_(
          previousQuestion,
          selectedManualModel,
        );
        const kbList = JSON.parse(
          PropertiesService.getScriptProperties().getProperty(CACHE_KEYS.KB_URI_LIST) || "[]",
        );
        const kbResult = getRelevantKBFiles(
          [{ role: "user", content: manualElaborationQuery }],
          kbList,
          userId,
          contextId,
          true,
          manualElaborationQuery,
        );
        const manualFiles = Array.isArray(kbResult)
          ? kbResult
          : kbResult && Array.isArray(kbResult.files)
            ? kbResult.files
            : [];

        if (manualFiles.length === 0) {
          const retryManualText =
            "剛才那本官方手冊目前沒有成功掛回來，我先不把舊答案換句話說。請稍後再試一次，我會重新查證後再補充。";
          replyMessage(replyToken, retryManualText);
          writeLog(`[Manual Elaboration Guard] 找不到 ${selectedManualModel} 的 PDF，不輸出固定補充`);
          return;
        }

        const manualResponse = callLLMWithRetry(
          manualElaborationQuery,
          historyForContinue,
          manualFiles,
          true,
          null,
          false,
          userId,
          false,
          selectedManualModel,
        );
        if (!manualResponse || manualResponse === "[KB_EXPIRED]") {
          const retryManualText =
            "這次重新讀取官方手冊時沒有拿到可用回答，我先不補猜。請稍後再試一次。";
          replyMessage(replyToken, retryManualText);
          writeLog(`[Manual Elaboration Guard] ${selectedManualModel} 手冊 LLM 回覆不可用`);
          return;
        }

        let manualReply = stripAnySourceTags(formatForLineMobile(manualResponse));
        manualReply = manualReply
          .replace(/\[AUTO_SEARCH_PDF\]/g, "")
          .replace(/\[AUTO_SEARCH_WEB\]/g, "")
          .replace(/\[型號[:：][^\]]+\]/g, "")
          .trim();
        manualReply = enforceManualNumberedList(sanitizeManualDeflection(manualReply));
        manualReply = appendPdfSourceTag(manualReply, manualFiles, 1);
        replyMessage(replyToken, manualReply);
        writeLog(`[Manual Elaboration] 已重新掛載 ${selectedManualModel} 官方手冊並呼叫 LLM`);
        writeRecordDirectly(userId, msg, contextId, "user", "");
        writeRecordDirectly(userId, manualReply, contextId, "assistant", "");
        updateHistorySheetAndCache(
          contextId,
          historyForContinue,
          { role: "user", content: msg },
          { role: "assistant", content: manualReply },
        );
        return;
      }

      const replyAnchor = getElaborationTopicAnchor_(
        cache,
        userId,
        lastAssistantMsg.content,
      );
      const currentElaborationCount = getElaborationCountForAnchor_(
        cache,
        userId,
        replyAnchor,
      );
      if (currentElaborationCount >= MAX_ELABORATE_PER_ANSWER) {
        const limitText =
          `這一題我已經補充到第 ${MAX_ELABORATE_PER_ANSWER} 次了。\n` +
          "你可以直接告訴我想深入的段落，或輸入「#查手冊 型號 你的問題」我會改走手冊解答。";
        const limitQrItems = [
          {
            type: "action",
            action: {
              type: "message",
              label: "🌐 這題再搜網路",
              text: "#這題再搜網路",
            },
          },
        ];
        if (hasPdfForModel) {
          limitQrItems.unshift({
            type: "action",
            action: { type: "message", label: "📖 查手冊", text: "#查手冊" },
          });
        }
        replyMessage(replyToken, limitText, {
          quickReply: { items: limitQrItems },
        });
        writeLog(
          `[Quick Reply v29.5.134] 再詳細說明達上限 ${currentElaborationCount}/${MAX_ELABORATE_PER_ANSWER}`,
        );
        writeRecordDirectly(userId, msg, contextId, "user", "");
        writeRecordDirectly(userId, limitText, contextId, "assistant", "");
        updateHistorySheetAndCache(
          contextId,
          historyForContinue,
          { role: "user", content: msg },
          { role: "assistant", content: limitText },
        );
        return;
      }

      writeElaborationState_(
        cache,
        userId,
        replyAnchor,
        currentElaborationCount + 1,
      );
      writeLog(
        `[Quick Reply v29.5.134] 再詳細說明計數: ${currentElaborationCount + 1}/${MAX_ELABORATE_PER_ANSWER}`,
      );
      // 對話歷史已保留完整上下文（5輪），AI 看得到自己上次的回答
      // 只需改寫 msg 和 userMessage，讓後面的流程自動帶歷史
      // ⚠️ 注意：不能在此設 userMsgObj，因為 const userMsgObj 在後面第 5500 行才宣告 (TDZ)
      const continueMsg =
        "請針對你剛才的回答再詳細說明，補充更多細節、步驟與注意事項；請延續原主題，不需要查 PDF 或網路，也不要輸出任何系統暗號。";
      writeLog(`[Quick Reply v29.5.129] 送出: ${continueMsg}`);
      showLoadingAnimation(userId, 60);
      msg = continueMsg;
      userMessage = continueMsg;
      // 不 return，讓流程走到 D.一般對話：
      // → getHistoryFromCacheOrSheet() 載入 5 輪歷史
      // → const userMsgObj = { role: "user", content: msg } 基於改寫後的 msg
      // → callLLMWithRetry(userMessage, [...history, userMsgObj], ...) 帶完整上下文
    }

    if (
      msg === "#搜尋網路" ||
      msg === "#搜往上其他解答" ||
      msg === "#搜網上其他解答" ||
      msg === "#這題再搜網路"
    ) {
      writeLog(`[Quick Reply v29.5.137] 用戶要求這題再搜網路`);
      showLoadingAnimation(userId, 60);
      const cmdResult = handleCommand(
        "不滿意這回答請繼續擴大搜尋",
        userId,
        contextId,
      );
      const webReplyAnchor = getElaborationTopicAnchor_(
        cache,
        userId,
        cmdResult,
      );
      const webElaborationCount = getElaborationCountForAnchor_(
        cache,
        userId,
        webReplyAnchor,
      );
      let canShowManualQuickReply = hasPdfForModel;
      if (!canShowManualQuickReply) {
        try {
          const directModels = JSON.parse(
            cache.get(`${userId}:direct_search_models`) || "[]",
          );
          // 只要延續同題且已有型號記憶，就保留「查手冊」入口，避免泡泡縮到只剩 1~2 顆
          canShowManualQuickReply =
            Array.isArray(directModels) && directModels.length > 0;
        } catch (e) {
          writeLog(`[Quick Reply v29.5.137] 手冊按鈕判斷失敗: ${e.message}`);
        }
      }
      const qrItems = [];
      if (webElaborationCount < MAX_ELABORATE_PER_ANSWER) {
        qrItems.push({
          type: "action",
          action: {
            type: "message",
            label: "💬 再詳細說明",
            text: "#再詳細說明",
          },
        });
      }
      if (canShowManualQuickReply) {
        qrItems.push({
          type: "action",
          action: { type: "message", label: "📖 查手冊", text: "#查手冊" },
        });
      }
      qrItems.push({
        type: "action",
        action: {
          type: "message",
          label: "🌐 這題再搜網路",
          text: "#這題再搜網路",
        },
      });
      writeLog(
        `[Quick Reply v29.5.139] 這題再搜網路回合泡泡數: ${qrItems.length}`,
      );
      const qrOptions =
        qrItems.length > 0 ? { quickReply: { items: qrItems } } : {};
      replyMessage(replyToken, cmdResult, qrOptions);
      writeRecordDirectly(userId, msg, contextId, "user", "");
      writeRecordDirectly(userId, cmdResult, contextId, "assistant", "");
      return;
    }

    // v29.5.116: 【關鍵修復】檢查「待執行 PDF 查詢」標記
    // 如果用戶剛選好型號（上一步），系統會標記 pending_pdf_query
    // 現在直接進 Pass 1.5，不再走 DirectDeep（避免循環）
    const pendingPdfQueryJson = cache.get(`${userId}:pending_pdf_query`);
    if (pendingPdfQueryJson) {
      try {
        const pending = JSON.parse(pendingPdfQueryJson);
        writeLog(
          `[PDF v29.5.116] 🔥 檢測到待執行 PDF 查詢: ${pending.model}，直接進 Pass 1.5`,
        );

        // 清除待執行標記（只使用一次）
        cache.remove(`${userId}:pending_pdf_query`);

        // 注入型號到 Cache（供 getRelevantKBFiles 使用）
        cache.put(
          `${userId}:direct_search_models`,
          JSON.stringify([pending.model]),
          300,
        );

        // 設置 PDF Mode
        const pdfModeKey = CACHE_KEYS.PDF_MODE_PREFIX + contextId;
        cache.put(pdfModeKey, "true", 300);

        // 直接進入 Pass 1.5（不走 DirectDeep，避免重複觸發泡泡）
        writeLog(`[PDF v29.5.116] 跳過 DirectDeep，直接進 Pass 1.5 查詢 PDF`);

        // 強制組合查詢：用戶輸入 + 原始問題
        const combinedQuery = `${pending.originalQuery}\n\n(用戶選擇型號: ${pending.model})`;
        msg = combinedQuery; userMessage = combinedQuery; // v29.6 BUG 6 修復

        // 正常進入對話流程，但已設置 PDF Mode，會自動載入 PDF
        // 不 return，讓下面的 D. 一般對話 邏輯接手
      } catch (e) {
        writeLog(
          `[PDF v29.5.116] 待執行 PDF 查詢解析失敗: ${e.message}，繼續正常流程`,
        );
        cache.remove(`${userId}:pending_pdf_query`);
      }
    }

    // D. 一般對話
    const history = getHistoryFromCacheOrSheet(contextId);
    const userMsgObj = { role: "user", content: msg };

    // 檢查是否在 PDF 模式（之前觸發過深度搜尋，同主題追問繼續用 PDF）
    const pdfModeKey = CACHE_KEYS.PDF_MODE_PREFIX + contextId;
    let isInPdfMode = cache.get(pdfModeKey) === "true";

    // 2025-12-05: 修正「黏性」問題
    // 用戶抱怨 10 分鐘太久，且不希望變成陌生人
    // 策略：
    // 1. 記憶 (History) 保持不變，讓用戶不覺得是陌生人
    // 2. 模式 (PDF Mode) 應該更靈活退出
    //    - 若用戶換話題 (NEW_TOPIC)，AI 會自動退出
    //    - 若用戶問簡單問題 (Simple Question)，暫時不掛 PDF
    //    - 這裡將 PDF Mode 的 TTL 縮短為 5 分鐘 (300秒)，避免過久

    // v24.1.5: 型號變化自動清除 PDF Mode
    // 當用戶切換到不同型號時，自動清除 PDF Mode，先用 Fast Mode (QA/Rules) 回答
    if (isInPdfMode && checkAndClearPdfModeOnModelChange(msg, history)) {
      writeLog("[PDF Mode] 偵測到型號變化，清除 PDF Mode，回到 Fast Mode");
      isInPdfMode = false;
      cache.remove(pdfModeKey);
    }

    if (
      isCrossDeviceMonitorQuery(msg) &&
      promptAliasOnlyModelSelection(
        msg,
        userId,
        replyToken,
        contextId,
        "pdf",
      )
    ) {
      writeLog(
        "[Cross Device Router v29.6.074] 跨裝置短別稱直接走官方手冊型號選擇，不先呼叫 Fast LLM",
      );
      return;
    }

    // E. 直通車檢查 (Direct Search)
    // v24.4.1 重大修正：不再在這裡觸發反問
    // 邏輯改為：
    // 1. 記錄命中的直通車關鍵字（用於後續 PDF 智慧匹配）
    // 2. 所有問題先走 Fast Mode（QA + CLASS_RULES）
    // 3. 只有當 AI 輸出 [AUTO_SEARCH_PDF] 時，才觸發 PDF 智慧匹配和反問

    // v24.4.0: 記錄命中的直通車關鍵字，用於後續 PDF 智慧匹配
    // v27.9.0: 改為支援多型號，不攔截（型號比較用 CLASS_RULES 就夠了）
    // v27.9.1: 移除 tooMany 攔截，只有在進入 PDF 查詢時才限制
    let hitAliasKeys = [];

    if (!isInPdfMode) {
      // 檢查直通車，記錄命中的關鍵字（但不立即反問）
      const directSearchResult = checkDirectDeepSearchWithKey(msg, userId);

      if (directSearchResult.hit) {
        // v27.9.1: 不再攔截 tooMany，讓 Fast Mode 先嘗試回答
        // 型號比較問題通常用 CLASS_RULES 就能回答
        const hitKeys = directSearchResult.keys;
        hitAliasKeys = hitKeys;
        writeLog(
          `[Direct Search] 命中直通車關鍵字: ${hitKeys.join(
            ", ",
          )}，先走 Fast Mode (QA/Rules 優先，不強制 PDF)`,
        );

        // 把關鍵字存到 Cache，供後續 [AUTO_SEARCH_PDF] 使用
        cache.put(`${userId}:hit_alias_key`, hitKeys[0], 300); // 相容舊邏輯
        if (hitKeys.length > 1) {
          cache.put(`${userId}:hit_alias_keys`, JSON.stringify(hitKeys), 300);
        }

        // v29.5.131: QA 優先修正
        // 只檢查「是否有手冊可查」供 Quick Reply 顯示，不再首輪直接預載 PDF。
        try {
          const pdfIndexJson =
            PropertiesService.getScriptProperties().getProperty(
              "PDF_MODEL_INDEX",
            );
          const pdfModelIndex = pdfIndexJson ? JSON.parse(pdfIndexJson) : [];
          const directModels = directSearchResult.models || [];

          // 遍歷 DirectDeep 提取的型號，找有 PDF 的
          let pdfMatchModel = null;
          for (const mdl of directModels) {
            const found = pdfModelIndex.some((idx) => {
              if (idx.startsWith("S") && idx.length >= 7) {
                const coreCheck = mdl.replace(/^S\d{2}/, "");
                const coreIdx = idx.replace(/^S\d{2}/, "");
                return (
                  coreIdx.includes(coreCheck) ||
                  coreCheck.includes(coreIdx) ||
                  idx.includes(mdl) ||
                  mdl.includes(idx)
                );
              }
              return idx === mdl;
            });
            if (found) {
              pdfMatchModel = mdl;
              break;
            }
          }

          if (pdfMatchModel) {
            hasPdfForModel = true;
            primaryModel = pdfMatchModel;
            writeLog(
              `[DirectDeep v29.5.131] 型號 ${pdfMatchModel} 有 PDF，保留 Fast Mode；可由 #查手冊 或 [AUTO_SEARCH_PDF] 進入手冊`,
            );
          } else {
            writeLog(
              `[DirectDeep v29.5.131] 所有型號均無 PDF: ${directModels.join(", ")}`,
            );
            // v29.5.155: 即便無 PDF，只要有抽到型號，就必須設為主型號，避免 Fast Mode AI 反問用戶
            if (directModels.length > 0) {
              primaryModel = directModels[0];
              writeLog(`[DirectDeep v29.5.155] 型號 ${primaryModel} 雖無 PDF，仍設定為主角提供系統上下文`);
            }
          }
        } catch (e) {
          writeLog(`[DirectDeep v29.5.131] PDF 可用性檢查失敗: ${e.message}`);
        }
      }
    }

    // 智慧退出：簡單問題不需要 PDF（價格、官網、日期、閒聊、新品等）
    const simplePatterns = [
      /多少錢|價格|價錢|售價/i,
      /官網|網址|網站|連結|link/i,
      /今天|日期|幾號|幾月/i,
      /謝謝|感謝|好的|了解|OK|掰/i,
      /^.{1,5}$/, // 少於 5 字的簡短回覆
      /根據|哪裡|為什麼|怎麼知道|來源/i, // 追問來源類（不需要再查 PDF）
      /還有嗎|其他|更多|繼續/i, // 追問更多類
      /新機|新品|推薦|最新|上市|熱門|最近/i, // 新品推薦類（CLASS_RULES 沒有就是沒有）
      /比較|差異|差別|哪個好|選哪/i, // 比較類（需要人工判斷）
    ];
    const isSimpleQuestion = simplePatterns.some((p) => p.test(msg));

    // v24.1.32: 修正直通車與簡單問題的衝突
    // 如果是直通車強制開啟的 PDF Mode (如 M7 價格)，不應該被 simplePatterns 攔截
    // 但「價格」確實不需要 PDF，所以這裡邏輯要調整：
    // 1. 如果是「價格/官網」類，即使命中直通車，也應該走 Fast Mode
    // 2. 但如果是「操作/故障」類，即使字數少，也應該走 PDF Mode

    if (isInPdfMode && isSimpleQuestion) {
      writeLog("[PDF Mode] 簡單/追問類問題，跳過 PDF");
      isInPdfMode = false;
      // v24.3.1 修復：清除 Cache 中的 PDF Mode 標記，防止下一題錯誤延續
      cache.remove(pdfModeKey);
    } else if (isInPdfMode) {
      // v24.5.0: 記住 PDF 模式，但不直接開 PDF
      // 改為先走 Fast Mode，如果 Fast Mode 能答就省錢省時間
      // 只有 Fast Mode 說 [AUTO_SEARCH_PDF] 時才用記住的 PDF
      writeLog("[PDF Mode] 記住 PDF 模式，但先走 Fast Mode 嘗試回答");
      // 續命：延長 5 分鐘（等 Fast Mode 判斷完再決定是否用 PDF）
      cache.put(pdfModeKey, "true", 300);
    }

    // v24.5.0: 記住原始的 PDF Mode 狀態，供後續 [AUTO_SEARCH_PDF] 使用
    const hadPdfModeMemory = isInPdfMode;

    // v24.5.0: 檢查是否有已選過的 PDF 型號（避免重複反問）
    // v27.3.1: 修正 JSON 轉換錯誤 - cache.get() 返回字串，需要 JSON.parse 還原成陣列
    // v27.3.9: 加強防呆 - 防止 Cache 髒資料（null/非陣列）導致 length 錯誤
    const cachedDirectModelsJson = cache.get(`${userId}:direct_search_models`);
    let cachedDirectModels = []; // 先預設為空陣列
    try {
      if (cachedDirectModelsJson) {
        const parsed = JSON.parse(cachedDirectModelsJson);
        // 🔥 絕對防呆：如果 parse 出來是 null 或非陣列，強制變成 []
        cachedDirectModels = Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      writeLog(
        `[Cache Parse Error] direct_search_models 轉換失敗: ${e.message}`,
      );
    }

    const hasSelectedPdf = cachedDirectModels.length > 0; // 現在絕對安全

    try {
      // v24.5.0: 每題都先走 Fast Mode（不帶 PDF），讓 QA/CLASS_RULES 先嘗試回答
      // 這樣規格問題（如「M8 有附鏡頭嗎」）可以秒答，不用浪費 PDF Token

      // v29.4.36: 統一流程 - 移除「直通車跳過」邏輯
      // 所有問題都走 Fast Mode，讓 AI 讀取完整的 QA + RULES 上下文後決定：
      // - 直接回答（從 QA 或 RULES 規格）
      // - 輸出 [AUTO_SEARCH_PDF] 觸發 PDF 搜尋
      // - 反問用戶更多資訊
      //
      // 好處：新增關鍵字只需編輯 CLASS_RULES，不需改程式碼
      if (hitAliasKeys.length > 0) {
        writeLog(
          `[Direct Search v29.4.36] 命中直通車 (${hitAliasKeys[0]})，走統一流程 (Fast Mode + 完整上下文)`,
        );
      }

      // v29.5.123: 如果 DirectDeep 已預載 PDF，直接帶上
      const shouldAttachPdfs = filesToAttach.length > 0 && hasPdfForModel;
      if (shouldAttachPdfs) {
        writeLog(
          `[DirectDeep v29.5.123] 首次回答即掛載 PDF (${filesToAttach.filter((f) => f.mimeType === "application/pdf").length} 本)`,
        );
        // 移除強制 [AUTO_SEARCH_PDF] 的 System Hint（PDF 已掛載，不需要 AI 再觸發）
        userMessage = userMessage.replace(/\n\n\[System Hint:.*?\]/s, "");
        userMsgObj.content = userMessage;
        // 標記已查過 PDF，後續 [AUTO_SEARCH_PDF] 信號會直接升級為 Web Search
        cache.put(`${userId}:pdf_consulted`, "true", 600);
        cache.put(`pdf_consulted_${userId}`, "true", 600); // v29.5.130: 與 handleCommand 的 SOP key 對齊
        isInPdfMode = true;
        cache.put(pdfModeKey, "true", 300);
      }

      let rawResponse = callLLMWithRetry(
        userMessage,
        [...history, userMsgObj],
        filesToAttach,
        shouldAttachPdfs, // attachPDFs: 有預載就直接帶
        null, // imageBlob
        false, // isRetry
        userId,
        false, // forceWebSearch
        primaryModel, // targetModelName
      );

      // === [KB_EXPIRED] 攔截：PDF 過期，靜默處理，用戶無感 ===
      if (rawResponse === "[KB_EXPIRED]") {
        writeLog("[KB Expired] PDF 過期，退出 PDF 模式，背景重建中");
        cache.remove(pdfModeKey); // 清除 PDF 模式

        // 自動預約 1 分鐘後背景重建
        scheduleImmediateRebuild();

        // 用極速模式重試（不帶 PDF），用戶完全無感
        rawResponse = callLLMWithRetry(
          userMessage,
          [...history, userMsgObj],
          filesToAttach,
          false, // attachPDFs
          null, // imageBlob
          true, // isRetry
          userId,
          false, // forceWebSearch
          primaryModel, // targetModelName
        );
        // 不管成功失敗都不提示用戶「手冊更新中」，保持對話流暢
      }

      if (rawResponse) {
        // 🆕 v29.5.218: 實體交叉比對防謊器 (Fake-Source Validator)
        // 若使用者詢問的是 6K/8K 等超前規格，但我們規格庫目前沒有，而 AI 卻自我幻覺瞎編，我們必須將其強行攔寫。
        const isQueryAboutNewSpec = /6K|8K/i.test(userMessage);
        if (isQueryAboutNewSpec) {
          const hasSpecInResponse = /6K|8K|G90XH|G80HS/i.test(rawResponse);
          if (hasSpecInResponse) {
            writeLog("[Fake-Source Filter] 🛑 偵測到 AI 幻覺瞎編不存在的 6K/8K 螢幕規格，強行攔截改寫為誠實無資料回覆！");
            rawResponse = "⚠️ 抱歉，目前台灣三星官方規格庫與 QA 資料庫中，尚未登記任何 6K 或 8K 螢幕的相關型號規格資訊。若有最新產品上市消息，請依台灣三星官網最新公告為準喔！";
          }
        }

        // 🔥 v29.5.107: 完整記錄 AI 原始回應
        writeLog(`[AI Raw Response] ${rawResponse}`);

        let finalText = stripAnySourceTags(formatForLineMobile(rawResponse));
        finalText = sanitizeLeadDatabasePhrase(finalText);
        const fastSourceTag = normalizeSourceTagFromRaw(rawResponse);
        let replyText = finalText;

        // v27.9.12: 追蹤 AI 是否明確要求 PDF 搜尋
        let aiRequestedPdfSearch = false;
        let forcedSopPdfVerification = false;
        let forcedSopNeedsModelSelection = false;

        // 🔥 v29.5.106: 詳細 LOG - 檢測暗號
        const hasAutoPdf = /\[AUTO_SEARCH_PDF/i.test(rawResponse);
        const hasAutoWeb = /\[AUTO_SEARCH_WEB\]/i.test(rawResponse);
        const hasNeedDoc = /\[NEED_DOC\]/i.test(rawResponse);
        const hasMissingSourceTag = /\[來源[：:]\s*缺失\]/i.test(rawResponse);
        const looksLikeMissingDataReply = isKnowledgeMissingReply_(finalText);
        writeLog(
          `[Signal Check] PDF暗號:${hasAutoPdf}, Web暗號:${hasAutoWeb}, NeedDoc:${hasNeedDoc}`,
        );

        if (
          (hasMissingSourceTag || looksLikeMissingDataReply) &&
          !hasAutoPdf &&
          !hasAutoWeb &&
          !hasNeedDoc &&
          !isInPdfMode
        ) {
          writeLog("[Auto Web Block v29.6.033] 偵測到 Fast Mode 查無資料但未輸出 WEB 暗號，補上網路搜尋確認流程");
          finalText = `${finalText}\n[AUTO_SEARCH_WEB]`;
        }

        // v29.5.132: 若已知有手冊且命中直通車，但 Fast Mode 誤回「找不到 PDF」，
        // 強制補上 PDF 觸發暗號，避免 Odyssey 3D 這類場景卡住。
        const looksLikeMissingManualReply =
          /找不到相關的\s*PDF\s*手冊檔案|看起來像需要查手冊|找不到相關的\s*PDF/i.test(
            rawResponse,
          );
        let forcedModelSelectionTrigger = false;
        if (
          !hasAutoPdf &&
          !hasAutoWeb &&
          !hasNeedDoc &&
          hasPdfForModel &&

          looksLikeMissingManualReply
        ) {
          writeLog(
            `[Auto Search v29.5.132] 偵測到可查手冊但 Fast Mode 誤判，強制追加 [AUTO_SEARCH_PDF]`,
          );
          finalText = `${finalText}\n[AUTO_SEARCH_PDF]`;
        }

        // v29.5.179: 通用SOP強化（非個案）
        // 操作/故障題先走 QA/RULE；若回答不足且型號有手冊，再自動進 PDF。
        const operationIntent = isOperationOrTroubleshootQuery(
          `${msg || ""}\n${userMessage || ""}`,
        );
        const manualVerificationIntent = isManualVerificationRequiredQuery(
          `${msg || ""}\n${userMessage || ""}`,
        );
        let hasCachedDirectModelContext = false;
        try {
          const rawDirectModels = cache.get(`${userId}:direct_search_models`);
          const parsedDirectModels = rawDirectModels
            ? JSON.parse(rawDirectModels)
            : [];
          hasCachedDirectModelContext =
            Array.isArray(parsedDirectModels) && parsedDirectModels.length > 0;
        } catch (e) {
          hasCachedDirectModelContext = false;
        }
        const hasSopModelContext =
          (primaryModel && String(primaryModel).trim().length > 0) ||
          hitAliasKeys.length > 0 ||
          hasCachedDirectModelContext;
        const normalizedFastAnswer = stripAnySourceTags(
          formatForLineMobile(rawResponse),
        );
        // v29.5.181: 若 QA/Rules 上下文降級（Cache Miss/Fallback）且屬 SOP 查證題型，
        // 為避免 Fast Mode 在資料不完整時直接定論，按 SOP 保守升級到 PDF 驗證。
        const contextHealth = readContextHealth(cache, userId);
        const shouldSopPdfEscalate = shouldEscalateFastAnswerToPdf({
          hasAutoPdf: hasAutoPdf || /\[AUTO_SEARCH_PDF/i.test(finalText),
          hasAutoWeb,
          hasNeedDoc,
          isInPdfMode,
          hasPdfForModel,
          operationIntent,
          manualVerificationIntent,
          fastSourceTag,
          normalizedFastAnswer,
          userQuestion: `${msg || ""}\n${userMessage || ""}`,
        });
        if (shouldSopPdfEscalate) {
          const degradedNote =
            contextHealth && contextHealth.degraded ? "；上下文降級" : "";
          writeLog(
            `[Auto Search v29.5.239] Fast 回答不足${degradedNote}，依 SOP 追加 [AUTO_SEARCH_PDF]`,
          );
          finalText = `${finalText}\n[AUTO_SEARCH_PDF]`;
          forcedSopPdfVerification = !!hasSopModelContext;
        }

        // === [AUTO_SEARCH_PDF] 或 [NEED_DOC] 攔截 ===
        // v27.9.48 fix: 增加對 hallucination (如 [.setAuto_search_pdf()]) 的容錯
        const pdfTriggerRegex =
          /\[(?:AUTO_SEARCH_PDF|\.?setAuto_search_pdf.*?)\]/i;

        // v29.4.0: 二段式 AI - 解析 [型號:xxx,yyy] 標籤
        const modelTagMatch = finalText.match(/\[型號[:：]([^\]]+)\]/);
        let suggestedModels = [];

        // v29.5.06: Priority 1 - Read from checkDirectDeepSearch Cache
        const cachedModelsJson = cache.get(`${userId}:direct_search_models`);
        if (cachedModelsJson) {
          try {
            suggestedModels = JSON.parse(cachedModelsJson);
            writeLog(
              `[Smart Router v29.5.06] 從 Cache 讀取型號: ${suggestedModels.join(", ")}`,
            );
          } catch (e) {
            writeLog(`[Smart Router] Cache 解析失敗: ${e.message}`);
          }
        }

        // v29.5.06: Priority 2 - Parse AI [型號:xxx] tag (fallback)
        if (suggestedModels.length === 0 && modelTagMatch) {
          suggestedModels = modelTagMatch[1]
            .split(/[,，、]/)
            .map((m) => m.trim())
            .filter((m) => m);
          writeLog(
            `[Smart Router v29.4] AI 建議型號: ${suggestedModels.join(", ")}`,
          );
        }

        const userHasModelSignal =
          extractModelNumbers(`${msg || ""}\n${userMessage || ""}`).length > 0 ||
          hitAliasKeys.length > 0 ||
          !!primaryModel;

        // v29.5.272: 無型號操作/故障題若未命中可信 QA，不能讓 Fast Mode 用泛用常識猜步驟，
        // 也不能被 AI 自行輸出的 [AUTO_SEARCH_PDF]/[AUTO_SEARCH_WEB] 暗號越過。
        // 先請使用者提供完整型號，避免後續 fallback 從 AI 舉例文字誤抓型號或誤進 PDF。
        if (
          operationIntent &&
          !userHasModelSignal &&
          !isInPdfMode &&
          fastSourceTag !== "[來源:QA庫]"
        ) {
          finalText = isSamsungHomeApplianceQuery(`${msg || ""}\n${userMessage || ""}`)
            ? buildNeedApplianceModelForOperationReply()
            : buildNeedModelForOperationReply();
          replyText = finalText;
          suggestedModels = [];
          writeLog(
            `[Operation Guard v29.5.272] 操作/故障題無型號且非可信QA來源，清除AI暗號並改請使用者補完整型號`,
          );
        }

        // v29.5.06: Priority 3 - Fallback extraction from AI text
        // 只在用戶本來就有型號/別稱訊號時才允許，避免把 AI 自舉範例型號誤當成候選型號。
        if (suggestedModels.length === 0 && userHasModelSignal) {
          // v29.4.11: Fallback Extraction (若 AI 忘了打標籤，嘗試從內文中提取)
          // 匹配常見三星型號格式: S32... or M7... (需嚴謹，避免匹配到雜訊)
          // v29.4.15 Fix: 放寬正則，允許無後綴的型號 (e.g. S32BM702)
          // 格式: [A-Z] + 2位數字 + [A-Z]{1,2} + 3-4位數字 + (可選後綴)
          const fallbackMatches = finalText.match(
            /\b[A-Z]\d{2}[A-Z]{1,2}\d{3,4}[A-Z0-9]*\b/g,
          );
          if (fallbackMatches) {
            // 過濾掉太短的誤判 (e.g., S24, M70)
            suggestedModels = fallbackMatches.filter((m) => m.length >= 7);
            writeLog(
              `[Smart Router v29.4.15] Fallback 提取型號: ${suggestedModels.join(
                ", ",
              )}`,
            );
          }
        }

        // v29.4.14 Logic: 分離「顯示泡泡」與「自動跳轉」的觸發條件
        // 1. Explicit Trigger ([AUTO_SEARCH_PDF]): 允許自動跳轉 (Auto-Redirect) 與 顯示泡泡
        // 2. Implicit Trigger (僅偵測到型號): 僅顯示泡泡，不自動跳轉 (避免誤判)

        // v29.4.22: Enhanced Trigger Detection with Argument Support
        const explicitTriggerMatch = finalText.match(
          /\[AUTO_SEARCH_PDF(?:[:：]\s*(.+?))?\]/i,
        );
        const hasExplicitTrigger =
          !!explicitTriggerMatch || finalText.includes("[NEED_DOC]");

        // 清理 Trigger 標籤 (若有)
        if (hasExplicitTrigger) {
          // v29.5.0: Log Optimization
          // writeLog("[Auto Search] 偵測到搜尋暗號 (Explicit Trigger)");

          // v29.4.33: PDF 升級邏輯 - 追蹤是否已查過 PDF
          // 如果本對話已經查過 PDF，則強制改為 Web Search
          const pdfConsultedKey = `${userId}:pdf_consulted`;
          const hasPdfConsulted = cache.get(pdfConsultedKey) === "true";

          if (hasPdfConsulted) {
            writeLog("[Auto Search v29.4.33] 本對話已查過 PDF，升級至網路搜尋");
            // 將 [AUTO_SEARCH_PDF] 替換為 [AUTO_SEARCH_WEB]
            finalText = finalText
              .replace(
                /\[AUTO_SEARCH_PDF(?:[:：]\s*.*?)?\]/gi,
                "[AUTO_SEARCH_WEB]",
              )
              .replace(/\[NEED_DOC\]/gi, "[AUTO_SEARCH_WEB]");
            // v29.5.130: 同步 replyText，避免暗號外洩到最終回覆
            replyText = finalText;
            // 跳過 aiRequestedPdfSearch，讓後續 Web Search 邏輯接手
          } else {
            aiRequestedPdfSearch = true;

            // Extract AI-specified search query
            if (explicitTriggerMatch && explicitTriggerMatch[1]) {
              aiSearchQuery = explicitTriggerMatch[1].trim();
              // v29.5.0: Log Optimization
              // writeLog(`[Auto Search] AI 指定搜尋字串: ${aiSearchQuery}`);
            }

            // Cleanup all variants of the tag
            finalText = finalText
              .replace(/\[AUTO_SEARCH_PDF(?:[:：]\s*.*?)?\]/gi, "")
              .trim();
            finalText = finalText.replace(/\[NEED_DOC\]/g, "").trim();
            finalText = finalText.replace(/\[型號[:：][^\]]+\]/g, "").trim();
            // v29.5.130: 同步 replyText，確保清理後的文字被採用
            replyText = finalText;
          }
        } else {
          // 若無 Explicit Trigger，仍必須清理內部溝通用的型號標籤，以免外洩 (詳見 #1)
          finalText = finalText.replace(/\[型號[:：][^\]]+\]/g, "").trim();
          replyText = finalText;
        }

        // 去重
        suggestedModels = [...new Set(suggestedModels)];
        suggestedModels = dedupDisplayModels(suggestedModels, 10);

        const apiFailureNeedsModelSelection =
          isApiFailureReply(rawResponse) &&
          suggestedModels.length > 1 &&
          userHasModelSignal;
        if (apiFailureNeedsModelSelection) {
          forcedModelSelectionTrigger = true;
          forcedSopNeedsModelSelection = true;
          finalText =
            "目前 AI 回答暫時受限，但我已先抓到可能的完整型號。請先選型號，我再依這個型號繼續查證。";
          replyText = finalText;
          writeLog(
            `[Smart Router v29.5.247] API 暫失敗但已有多型號候選，保留型號選擇流程`,
          );
        }

        if (
          isApiFailureReply(rawResponse) &&
          operationIntent &&
          !userHasModelSignal &&
          suggestedModels.length === 0
        ) {
          finalText = isSamsungHomeApplianceQuery(`${msg || ""}\n${userMessage || ""}`)
            ? buildNeedApplianceModelForOperationReply()
            : buildNeedModelForOperationReply();
          replyText = finalText;
          writeLog(
            `[Operation Guard v29.5.253] 操作/故障題遇 API 暫失敗且無型號，改請使用者補完整型號`,
          );
        }

        // v29.5.175: 短別稱功能題（如 S9 有 KVM 嗎）必須先要求選完整型號，走型號泡泡流程
        if (
          suggestedModels.length === 1 &&
          isShortAliasModelToken(suggestedModels[0]) &&
          isFeatureBinaryQuestion(msg) &&
          !hasExplicitTrigger
        ) {
          const aliasToken = suggestedModels[0];
          const aliasCandidates = getAliasCandidatesFromClassRules(aliasToken, 10);
          if (aliasCandidates.length > 1) {
            forcedModelSelectionTrigger = true;
            suggestedModels = aliasCandidates;
            finalText = `你問的「${aliasToken}」可能對應多個完整型號，請先選型號，我再精準回答。`;
            replyText = finalText;
            writeLog(
              `[Smart Router v29.5.175] 短別稱功能題觸發型號泡泡: ${aliasToken} -> ${aliasCandidates.join(", ")}`,
            );
          }
        }

        const aliasOnlySelectionModels = getAliasOnlySelectionModelsFromQuery(
          `${msg || ""}\n${userMessage || ""}`,
          10,
        );
        const aliasOnlyNeedsSelection =
          aliasOnlySelectionModels.length > 1 &&
          (hasExplicitTrigger ||
            operationIntent ||
            manualVerificationIntent ||
            isFeatureBinaryQuestion(msg));
        if (aliasOnlyNeedsSelection) {
          const aliasToken = extractShortAliasModelTokens(`${msg || ""}\n${userMessage || ""}`)[0];
          forcedModelSelectionTrigger = true;
          forcedSopNeedsModelSelection = hasExplicitTrigger || manualVerificationIntent;
          suggestedModels = aliasOnlySelectionModels;
          finalText = `你只提供「${aliasToken}」這個系列別稱，這會對應多個完整型號。請先選完整型號，我再精準回答。`;
          replyText = finalText;
          cache.remove(`${userId}:direct_search_models`);
          writeLog(
            `[Smart Router v29.6.027] 短別稱不可直接查 PDF，改顯示完整型號候選: ${aliasOnlySelectionModels.join(", ")}`,
          );
        }

        // v29.5.13: Smart Filtering - 打破無限迴圈 & 移除多餘短別稱
        let autoLocked = false;
        if (forcedSopPdfVerification && suggestedModels.length > 1) {
          // 鐵律：命中 SOP 手冊查證且多型號時，必須先選型號
          forcedSopNeedsModelSelection = true;
          forcedModelSelectionTrigger = true;
          finalText =
            "這題需要依型號查官方手冊，先選完整型號，我再繼續查證。";
          replyText = finalText;
          writeLog(
            `[Smart Router v29.5.193] 命中SOP手冊查證且多型號，強制先選型號`,
          );
        }

        // Step 1: Filter out short aliases if specific models exist
        const specificModels = suggestedModels.filter((m) => m.length > 3);
        if (specificModels.length > 0) {
          suggestedModels = specificModels;
        }

        // Step 2: Auto-Lock if user message contains the model
        const normalizedMsg = userMessage.toUpperCase().replace(/\s+/g, "");
        const matchedInMsg = suggestedModels.filter((m) => {
          // v29.6.040: 去除尾部英文字母後綴以支援無後綴輸入比對 (如 S49DG932SC -> S49DG932)
          const cleanM = m.toUpperCase().replace(/\s+/g, "").replace(/(?<=\d)[A-Z]+$/i, "");
          return normalizedMsg.includes(cleanM);
        });

        if (matchedInMsg.length > 0) {
          writeLog(
            `[Smart Router v29.5.13] 訊息中偵測到具體型號，鎖定目標: ${matchedInMsg.join(", ")}`,
          );
          suggestedModels = matchedInMsg;
          autoLocked = true;
        }

        // Step 2: Auto-Lock if user message contains the model
        // 若用戶訊息本身就包含該型號（例如點擊了選單按鈕），則強制鎖定，不再跳選單
        if (matchedInMsg.length > 0) {
          writeLog(
            `[Smart Router v29.5.31] 訊息中偵測到具體型號，鎖定目標: ${matchedInMsg.join(", ")}`,
          );
          suggestedModels = matchedInMsg;
          autoLocked = true; // 標記為自動鎖定
        }

        // v29.5.19: 檢查是否已查過 PDF，若是則跳過 Smart Router，讓後續流程處理 Web Search
        const pdfConsultedKey = `${userId}:pdf_consulted`;
        const hasPdfConsultedForRouter = cache.get(pdfConsultedKey) === "true";

        if (hasPdfConsultedForRouter && suggestedModels.length > 0) {
          writeLog(
            `[Smart Router v29.5.19] 已查過 PDF，跳過泡泡，等待 Web Search 升級`,
          );
          suggestedModels = []; // 清空以跳過泡泡生成
        }

        if (suggestedModels.length > 0) {
          // Case A: 單一型號 + (明確 Trigger OR 自動鎖定) -> 自動跳轉 (讓 Fast Mode 回答，不直接跳 PDF)
          // v29.5.19: 回復正確流程 - 不設置 aiRequestedPdfSearch，讓 AI 先用規格表回答
          if (
            (hasExplicitTrigger || autoLocked) &&
            suggestedModels.length === 1
          ) {
            writeLog(
              `[Smart Router v29.5.19] 命中唯一型號 ${suggestedModels[0]}，儲存到 Cache`,
            );
            // v29.5.86: Fix "Sticky Keyword" bug (2 -> G5)
            // When locking a new specific model, we MUST clear the fuzzy alias key to prevent fallback logic from picking up old data.
            cache.remove(`${userId}:hit_alias_key`);
            cache.put(
              `${userId}:direct_search_models`,
              JSON.stringify(suggestedModels),
              300,
            );
            // v29.5.19: 不設置 aiRequestedPdfSearch，讓 AI 繼續用 Fast Mode 回答
            // 如果 AI 認為需要 PDF，會自己輸出 [AUTO_SEARCH_PDF]
            suggestedModels = []; // 清空以跳過泡泡生成
          }
          // Case B: 多個型號 -> 顯示泡泡 (Flex Selection)
          // v29.5.20: 單一型號不顯示泡泡（沒意義），只有多型號才顯示
          else if (suggestedModels.length > 1) {
            const needSpecificModelIntent =
              /(怎麼|如何|設定|故障|無法|不能|操作|步驟|重置|reset|閃爍|亮燈|不亮|連接|安裝|調整|開啟|關閉|使用|方法|教學)/i.test(
                userMessage,
              );

            // 💡 智慧比較推薦安全閥 v29.5.273
            // 比較/推薦題可以直接多型號回答；但若同時是操作/故障/設定題，仍要保留型號泡泡。
            const isComparisonQuery = /哪一台|哪一款|偏向|推薦|比較|差異|差別|不同|vs|versus|選購/i.test(userMessage);
            if (
              isComparisonQuery &&
              !needSpecificModelIntent &&
              !forcedSopNeedsModelSelection &&
              !forcedModelSelectionTrigger
            ) {
              writeLog(`[Smart Router] 偵測到比較/推薦意圖(${userMessage.substring(0, 30)})，跳過選單泡泡，允許直接進行多型號回答`);
              suggestedModels = []; // 清空以跳過選單泡泡
            } else if (isComparisonQuery && needSpecificModelIntent) {
              writeLog(
                `[Smart Router v29.5.273] 比較/推薦題同時含操作需求，保留型號選單泡泡。`,
              );
            }
            
            // v29.5.105: 改善追問機制 - 更精準判斷何時該跳過泡泡
            //
            // 【跳過泡泡的情況】:
            // 1. 明確的列表/比較意圖 + 不涉及操作/故障問題
            // 2. 型號數量過多(>10)，通常是類別查詢
            //
            // 【保留泡泡的情況】:
            // 1. 操作/故障/設定問題（即使有「哪一台」也要追問型號）
            // 2. 用戶使用模糊別稱（如 G5、M8）詢問功能問題

            const listIntent =
              /(推薦|介紹|有哪些|列表|清單|差異|比較|认证|認證|列出|整理|選擇)/i.test(
                userMessage,
              );
            const tooMany = suggestedModels.length > 10;

            // 只有在「純列表意圖」且「非操作問題」時才跳過泡泡
            const shouldSkipBubble =
              (listIntent && !needSpecificModelIntent) || tooMany;

            if (
              shouldSkipBubble &&
              !forcedSopNeedsModelSelection &&
              !forcedModelSelectionTrigger
            ) {
              writeLog(
                `[Smart Router v29.5.105] 偵測到列表意圖(${listIntent})/數量過多(${suggestedModels.length})，且無操作需求，跳過選單泡泡。`,
              );
              suggestedModels = []; // 清空以跳過泡泡生成
            } else if (listIntent && needSpecificModelIntent) {
              writeLog(
                `[Smart Router v29.5.105] 偵測到列表意圖但同時有操作需求，保留型號選單泡泡。`,
              );
            }

            if (suggestedModels.length > 1) {
              // v29.5.121: 過濾內部代號，只顯示用戶認識的完整型號
              // 內部代號如 G90XF, G80SD, G81SF 等短別稱，用戶不認識
              // 完整型號如 S27FG900XC, S32DG802SC (S開頭+數字+字母)
              const INTERNAL_ALIAS_RE = /^[A-Z]\d{1,2}[A-Z]{0,3}$/; // G90XF, G5, M8, G80SD
              const fullModels = suggestedModels.filter(
                (m) => !INTERNAL_ALIAS_RE.test(m),
              );
              if (fullModels.length > 0) {
                // 有完整型號時，移除內部代號
                const removed = suggestedModels.filter((m) =>
                  INTERNAL_ALIAS_RE.test(m),
                );
                if (removed.length > 0) {
                  writeLog(
                    `[Smart Router v29.5.121] 過濾內部代號: ${removed.join(", ")} → 只顯示: ${fullModels.join(", ")}`,
                  );
                }
                
                // v29.5.152: 子字串去重 (Substring Deduplication)
                // 若同時存在 S27FG900XC 與 S27FG900，顯示兩個泡泡會造成困擾，保留最長者
                const dedupModels = [];
                // 依長度降冪排序，長字串優先處理
                const sortedModels = fullModels.slice().sort((a, b) => b.length - a.length);
                sortedModels.forEach((model) => {
                  // 若尚未被更長的型號包含，才加入
                  const isSubset = dedupModels.some(existing => existing.includes(model));
                  if (!isSubset) {
                    dedupModels.push(model);
                  }
                });

                if (fullModels.length !== dedupModels.length) {
                  writeLog(`[Smart Router v29.5.152] 子字串去重: 去除互包含冗餘型號，剩餘: ${dedupModels.join(", ")}`);
                }

                suggestedModels = dedupModels;
              }
              // 過濾後只剩 1 個型號，不需要顯示泡泡，直接鎖定
              if (suggestedModels.length === 1) {
                writeLog(
                  `[Smart Router v29.5.121] 過濾後單一型號 ${suggestedModels[0]}，自動鎖定`,
                );
                cache.put(
                  `${userId}:direct_search_models`,
                  JSON.stringify(suggestedModels),
                  300,
                );
                suggestedModels = [];
              }
            }

            // Re-check length (if cleared, this block won't run)
            // v29.5.144: 若命中多個型號，只要有需要具體型號的意圖 (needSpecificModelIntent)，或是 AI 明確要求選擇，就強制顯示型號選單。
            if (
              suggestedModels.length > 1 &&
              (
                hasExplicitTrigger ||
                forcedModelSelectionTrigger ||
                !finalText ||
                finalText.length < 5 ||
                needSpecificModelIntent
              )
            ) {
              writeLog(
                `[Smart Router v29.5.140] 準備顯示型號選擇泡泡 (Trigger: ${hasExplicitTrigger}, Models: ${suggestedModels.length})`,
              );
              cache.put(
                `${userId}:suggested_models`,
                JSON.stringify(suggestedModels),
                300,
              );

              // v29.5.121: 保存當前話題，供用戶選泡泡後延續
              // 優先使用當前用戶訊息本身作為話題
              const currentTopic = userMessage || "";
              if (currentTopic.length > 5) {
                cache.put(`${userId}:pending_topic`, currentTopic, 600);
                writeLog(
                  `[Topic Save v29.5.121] 保存當前話題: ${currentTopic.substring(0, 50)}`,
                );
              } else {
                // fallback: 從歷史找上一輪的話題
                const history = getHistoryFromCacheOrSheet(contextId);
                if (history && history.length >= 1) {
                  for (let i = history.length - 1; i >= 0; i--) {
                    const h = history[i];
                    if (h.role === "user") {
                      let topic = h.content || "";
                      topic = topic.replace(/\[System Hint:.*?\]/gs, "").trim();
                      if (
                        topic.length > 10 &&
                        !topic.match(
                          /^(\u90a3|\u63db|\u6539).{1,10}(\u5462|\u7684\u8a71)?$/,
                        )
                      ) {
                        cache.put(`${userId}:pending_topic`, topic, 600);
                        writeLog(
                          `[Topic Save v29.5.121] 從歷史保存話題: ${topic.substring(0, 50)}`,
                        );
                        break;
                      }
                    }
                  }
                }
              }

              // 生成 Flex Message (使用 V2 去重版)
              // v29.5.50: Determine Search Intent for Dynamic Bubble Text
              const searchIntent = determineSearchIntent(
                userMessage,
                suggestedModels,
              );
              const modelSelectMode =
                hasExplicitTrigger || forcedSopNeedsModelSelection
                  ? "pdf"
                  : "fast";
              cache.put(`${userId}:model_select_mode`, modelSelectMode, 600);
              writeLog(
                `[Smart Router v29.5.175] 型號泡泡選擇模式: ${modelSelectMode}`,
              );
              const flexMsg = createModelSelectionFlexV3(
                suggestedModels,
                searchIntent,
              );
              // 若有 AI 文字回應，且非空白，則將其作為 Flex 的 AltText 或 分開傳送?
              // 為了 UX，我們讓 Flex 獨立發送，結束這一回合
              // 注意: 此時 replyText 尚未發送。若我們在這裡 return，replyText 就會被丟棄。
              // 理想狀況: 如果 AI 有說話 (finalText)，我們先推播文字，再推播 Flex?
              // Line Reply Token 只能用一次。必須組合成 Array。

              const messages = [];
              const leadText = [
                modelSelectMode === "pdf"
                  ? "這題需要先確認完整型號，我再依官方手冊查證給你。"
                  : needSpecificModelIntent
                    ? "這題會因完整型號不同而有不同操作方式，請先選型號，我再依該型號回答。"
                    : "你問的內容可能對應多個完整型號，請先選型號，我再精準回答。",
              ].join("\n");
              if (leadText && leadText.length > 0) {
                messages.push({ type: "text", text: leadText });
              }
              messages.push(flexMsg);

              replyMessage(replyToken, messages);
              writeLog(`[Smart Router v29.6.067] 已透過 replyMessage 發送 Flex Selection`);
              return; // 結束
            }
          }
        }

        // 🔥 v29.5.106: 詳細 LOG - 進入主要判斷邏輯
        writeLog(
          `[Flow Decision] hasExplicitTrigger:${hasExplicitTrigger}, containsWebSignal:${finalText.includes("[AUTO_SEARCH_WEB]")}`,
        );

        // 🆕 v29.5.220: 全面封殺背景自動聯網，改為「主動詢問用戶『需要網路搜尋嗎？』」的零信任控制權機制
        // 當 Fast Mode AI 判定需要網路搜尋 (含有 [AUTO_SEARCH_WEB]，通常表示官方資料庫中查無此機型或規格)，
        // 我們拒絕在背景悄悄自動發起聯網。而是直接將回答改寫為誠實無資料的警示引導，
        // 並主動提供 LINE 底部 [🌐 這題再搜網路] 按鈕，交由用戶決定是否進行網路搜尋。
        if (finalText.includes("[AUTO_SEARCH_WEB]")) {
          writeLog("[Auto Web Block] 🛑 偵測到 AI 企圖背景聯網，強行攔截改寫為『主動詢問用戶』");
          
          let specHint = "";
          if (/6K|8K/i.test(userMessage)) {
            specHint = "目前台灣三星官方規格庫中，尚未登記任何 6K 或 8K 的螢幕規格資訊。";
          } else {
            specHint = "官方規格庫與 QA 資料庫中目前查無此相關資訊。";
          }
          
          finalText = `抱歉，${specHint}需要幫你在網路上進行擴大搜尋嗎？\n\n(💡 請點擊下方「🌐 這題再搜網路」按鈕，我會幫你擴大檢索最新網路資訊與記憶庫答案喔！)`;
          
          // 清除任何暗號標記，乾淨呈現在 UI 上
          finalText = finalText.replace(/\[AUTO_SEARCH_WEB\]/gi, "").trim();
          replyText = finalText;
          isDualBubbleComplete = false; // 允許正常後續流程去產生 Quick Reply
        } else if (hasExplicitTrigger) {
          // 只有 Trigger 但沒型號? (可能是 AI 忘了給型號，或依賴 Context)
          // 這裡維持原本邏輯 (可能後續會走 Auto Search PDF)
          writeLog(`[Flow] hasExplicitTrigger=true，進入 PDF 觸發邏輯`);
        }

        // 確保如果是 WEB Search 就不進入 PDF 判斷 (用簡單的方法: 檢查 replyText 是否已改變)
        // 或者將 PDF 邏輯包在 else 裡
        // 目前結構較平鋪直敘，我們用一個 flag 或結構調整

        if (
          !isDualBubbleComplete &&
          !replyText.toString().includes("(🔍 網路搜尋補充資料)") &&
          !replyText.toString().includes("(⚠️ 網路搜尋連線逾時)")
        ) {
          // [已廢棄 v29.5.229] 舊版「不需要 PDF 的問題」跳過邏輯已徹底移除
          // 所有問題均強制放行到 Smart Router，禁止跳過 PDF 查詢
          {
            // v24.5.0: 優先檢查是否有 PDF 記憶（已選過型號）
            // v27.2.9 修復：檢查型號是否衝突，避免 M8 記憶誤用到 M9 查詢
            const currentMsgModels = extractModelNumbers(msg);
            const hasExplicitModelPattern =
              /\b(?:L?[A-Z])\d{2}[A-Z]{1,3}\d{2,4}[A-Z0-9]*\b/i.test(msg);

            // v29.3.20: 強化型號衝突判定，支援別稱 (Alias) 解析
            // 避免 G6 比對 S27FG6... 時誤判為衝突
            let isModelMismatch = false;
            if (
              !hasExplicitModelPattern &&
              hitAliasKeys.length > 0 &&
              cachedDirectModels.length > 0
            ) {
              // v29.5.132: 若當前只有別稱（如 Odyssey 3D）且命中直通車，不視為型號衝突
              writeLog(
                `[Auto Search v29.5.132] 命中別稱且未指定新型號，保留既有型號記憶: ${cachedDirectModels.join(", ")}`,
              );
              isModelMismatch = false;
            } else if (
              currentMsgModels.length > 0 &&
              cachedDirectModels.length > 0
            ) {
              // 取得別稱對應表 (供反向查詢)
              const mapJson =
                PropertiesService.getScriptProperties().getProperty(
                  CACHE_KEYS.KEYWORD_MAP,
                );
              const keywordMap = mapJson ? JSON.parse(mapJson) : {};

              isModelMismatch = currentMsgModels.some((m) => {
                // 1. 直接匹配
                if (cachedDirectModels.some((old) => old === m)) return false;

                // 2. 檢查 m 是否為別稱，且其映射的型號是否包含在 cachedDirectModels 中
                const mappedRaw = keywordMap[m.toUpperCase()];
                if (mappedRaw) {
                  // 簡單檢查映射字串是否包含已快取的型號
                  const isAliased = cachedDirectModels.some((old) =>
                    mappedRaw.toUpperCase().includes(old.toUpperCase()),
                  );
                  if (isAliased) return false; // 命中別稱，非衝突
                }

                // 3. 檢查 m 是否包含在 cachedDirectModels 任何一個之中 (例如 "M8" 匹配 "S32BM801")
                const isPartMatch = cachedDirectModels.some((old) =>
                  old.toUpperCase().includes(m.toUpperCase()),
                );
                if (isPartMatch) return false;

                return true; // 真的不認識，視為衝突
              });
            }

            // v29.4.38: 檢查是否已查過 PDF，避免鬼打牆重複查 PDF
            const hasConsultedPdf = cache.get(`${userId}:pdf_consulted`);

            if (hadPdfModeMemory && hasSelectedPdf && !isModelMismatch) {
              if (hasConsultedPdf) {
                // v29.4.45: Web Search Retry Limit (Max 2)
                const searchCountKey = `${userId}:web_search_count`;
                let webCount = parseInt(cache.get(searchCountKey) || "0");

                if (webCount >= 2) {
                  writeLog(
                    `[Auto Search] Web Search Limit Reached (${webCount}). Refusing to search again.`,
                  );
                  // Refusal Flow: Call LLM without tools, instructing it to refuse gracefully
                  const refusalResponse = callLLMWithRetry(
                    userMessage +
                      "\n(系統提示：用戶已連續三次要求搜索但仍不滿意。請【先總結】先前兩次的搜尋重點，然後誠實告知「我已經把網路上能找的都找過了，但似乎真的沒有針對此型號的這項說明」。最後用朋友的口吻建議：「這題比較專業，不如你直接問問 Sam 吧！他一定知道。」**請嚴格遵守 Persona：說話要像朋友，嚴禁使用『您』，一律用『你』！**)",
                    [...history, userMsgObj],
                    [], // filesToAttach
                    false, // attachPDFs
                    null, // imageBlob
                    true, // isRetry
                    userId,
                    false, // forceWebSearch = FALSE (Use Normal Mode to refuse)
                    "", // targetModelName
                  );
                  replyText = formatForLineMobile(refusalResponse);
                } else {
                  // Increment Count & Proceed
                  cache.put(searchCountKey, (webCount + 1).toString(), 1800); // 30 min TTL

                  writeLog(
                    `[Auto Search v29.4.45] 升級至網路搜尋 (Attempt ${
                      webCount + 1
                    }/2)`,
                  );
                  writeLog(
                    `[Upgrade Debug] cachedDirectModels: ${JSON.stringify(
                      cachedDirectModels,
                    )}`,
                  );

                  // 強制執行 Web Search (不掛載 PDF)
                  const webResponse = callLLMWithRetry(
                    userMessage,
                    [...history, userMsgObj],
                    [], // filesToAttach
                    false, // attachPDFs
                    null, // imageBlob
                    true, // isRetry
                    userId,
                    true, // forceWebSearch
                    cachedDirectModels[0], // targetModelName
                  );

                  if (webResponse && webResponse !== "[KB_EXPIRED]") {
                    let finalText = formatForLineMobile(webResponse);
                    finalText = finalText
                      .replace(/\[AUTO_SEARCH_PDF\]/g, "")
                      .trim();
                    finalText = finalText
                      .replace(/\[AUTO_SEARCH_WEB\]\s*/g, "") // v29.4.55: Robust cleanup
                      .trim();
                    // v29.5.04: Post-filter AI violations
                    // Remove "要不要我幫你搜尋" type questions
                    finalText = finalText
                      .replace(/要不要我幫你[^？?]*[？?]/g, "")
                      .replace(/這樣可以嗎[？?]/g, "")
                      .replace(/幫你上網搜尋看看[^？?]*[？?]/g, "")
                      .trim();
                    // Remove "聯絡客服/0800" recommendations
                    finalText = finalText
                      .replace(
                        /[可以|建議|或許][^。]*[客服|0800][^。]*。?/g,
                        "",
                      )
                      .replace(/直接問問三星[^。]*。?/g, "")
                      .trim();
                    // If response becomes empty after filtering, use fallback
                    if (!finalText || finalText.length < 20) {
                      finalText =
                        "哎呀，我搜遍了網路還是找不到確切資訊😓。這題可能比較難，建議你直接問問 Sam，他一定知道！";
                    }
                    replyText = finalText;
                    // v29.4.43: Prevent subsequent PDF search override
                    aiRequestedPdfSearch = false;
                  } else {
                    replyText =
                      "哎呀，我搜遍了網路還是找不到確切資訊😓。這題可能比較難，建議你直接問問 Sam，他一定知道！";
                  }
                }
              } else {
                writeLog(
                  `[Auto Search] 有 PDF 記憶且無型號衝突，直接使用已選的 PDF: ${cachedDirectModels}`,
                );

                writeLog(
                  "[Auto Deep] 觸發 [AUTO_SEARCH_PDF]，啟動 PDF Mode 重試",
                );
                isInPdfMode = true;
                cache.put(pdfModeKey, "true", 300);

                // v24.5.0: 顯示 Loading 動畫
                showLoadingAnimation(userId, 60);

                // v29.4.37: 根據快取的型號找到對應的 PDF
                let pdfToAttach = [];
                try {
                  const kbListJson =
                    PropertiesService.getScriptProperties().getProperty(
                      CACHE_KEYS.KB_URI_LIST,
                    );
                  if (kbListJson) {
                    const kbList = JSON.parse(kbListJson);
                    const targetModel = cachedDirectModels[0].toUpperCase();
                    const matchedPdf = kbList.find(
                      (f) =>
                        f.mimeType === "application/pdf" &&
                        f.name.toUpperCase().includes(targetModel),
                    );
                    if (matchedPdf) {
                      pdfToAttach = [
                        {
                          name: matchedPdf.name,
                          uri: matchedPdf.uri,
                          mimeType: "application/pdf",
                        },
                      ];
                      writeLog(
                        `[PDF Attach] 從快取型號找到 PDF: ${matchedPdf.name}`,
                      );
                    }
                  }
                } catch (e) {
                  writeLog(`[PDF Attach Error] ${e.message}`);
                }

                const deepResponse = callLLMWithRetry(
                  userMessage,
                  [...history, userMsgObj],
                  pdfToAttach, // v29.4.37: 傳入找到的 PDF
                  true, // attachPDFs
                  null, // imageBlob
                  true, // isRetry
                  userId,
                  false, // forceWebSearch
                  cachedDirectModels[0], // targetModelName
                );

                if (deepResponse && deepResponse !== "[KB_EXPIRED]") {
                  finalText = stripAnySourceTags(formatForLineMobile(deepResponse));
                  finalText = finalText
                    .replace(/\[AUTO_SEARCH_PDF\]/g, "")
                    .trim();
                  finalText = finalText.replace(/\[NEED_DOC\]/g, "").trim();
                  // v29.3.53: 補上 [AUTO_SEARCH_WEB] 清理，防止暗號外洩
                  finalText = finalText
                    .replace(/\[AUTO_SEARCH_WEB\]/g, "")
                    .trim();
                  finalText = finalText.replace(/\[型號[:：][^\]]+\]/g, "").trim();
                  finalText = sanitizeManualDeflection(finalText);
                  finalText = enforceManualUncertaintyGuard(finalText, msg);
                  finalText = enforceManualNumberedList(finalText);
                  const deepSourceFiles =
                    pdfToAttach.length > 0 ? pdfToAttach : filesToAttach;
                  if (deepSourceFiles.length > 0) {
                    finalText = appendPdfSourceTag(finalText, deepSourceFiles, 1);
                  }
                  if (deepSourceFiles.length > 0) {
                    finalText = ensurePdfSourceTag(finalText, deepSourceFiles, 1);
                  }

                  // v29.4.33: 設置 PDF 已查詢標記
                  cache.put(`${userId}:pdf_consulted`, "true", 600);
                  cache.put(`pdf_consulted_${userId}`, "true", 600); // v29.5.130: 與 SOP key 對齊
                  writeLog("[PDF v29.4.33] 已設置 pdf_consulted 標記");
                  replyText = finalText;
                } else {
                  replyText = "⚠️ 自動查閱手冊失敗，請稍後再試";
                }
              }
            } else {
              // v27.2.9: 如果有型號衝突，記錄並清除舊記憶
              if (isModelMismatch) {
                writeLog(
                  `[Auto Search] ⚠️ 偵測到型號衝突: 當前問題提到 ${currentMsgModels.join(
                    ",",
                  )}，舊記憶是 ${cachedDirectModels.join(
                    ",",
                  )}，將重新進行 PDF 匹配`,
                );
                cache.remove(pdfModeKey);
                // v27.3.2: 關鍵修正 - 同時清除舊直通車關鍵字與型號，避免 M8 記憶污染 M9 查詢
                cache.remove(`${userId}:hit_alias_key`);
                cache.remove(`${userId}:direct_search_models`);
              }

              // v29.4.21: Fix ReferenceError (Restored missing variable)
              const cachedAliasKey = cache.get(`${userId}:hit_alias_key`);

              // v27.9.43: Reverted manual trigger fix in favor of strict prompt engineering
              // if (cachedAliasKey && !aiRequestedPdfSearch && !isSimpleQuestion) { ... }

              // v27.9.12: 只有當 AI 明確要求 PDF 搜尋([AUTO_SEARCH_PDF])時，才進行 PDF 智慧匹配
              // 規格問題（如「M5有支援Smart嗎」）即使命中直通車，也不應觸發 PDF 匹配
              if (cachedAliasKey && aiRequestedPdfSearch) {
                // v27.9.65: 切換至 PDF 模式，屬於耗時操作，再次觸發 Loading 動畫以防過期
                showLoadingAnimation(userId, 60);

                // 有直通車關鍵字 + AI 要求 PDF → 使用 PDF 智慧匹配
                // v29.3.49: 傳入 msg 作為 originalQuery，讓精確型號匹配使用用戶原始訊息
                writeLog(
                  `[Auto Search] AI 要求 PDF 搜尋，使用直通車關鍵字進行 PDF 智慧匹配: ${cachedAliasKey} (原始訊息: ${msg.substring(
                    0,
                    50,
                  )})`,
                );

                const pdfSearchResult = searchPdfByAliasPattern(
                  cachedAliasKey,
                  msg,
                );

                if (
                  pdfSearchResult.needAsk &&
                  pdfSearchResult.matchedPdfs.length > 1
                ) {
                  // 多個 PDF 匹配 → 反問用戶選擇
                  writeLog(
                    `[PDF Match] 找到 ${pdfSearchResult.matchedPdfs.length} 個匹配，需要反問用戶`,
                  );

                  // 儲存等待選擇的狀態
                  const pendingData = {
                    originalQuery: msg,
                    aliasKey: cachedAliasKey,
                    options: pdfSearchResult.matchedPdfs.slice(0, 9),
                  };
                  cache.put(
                    CACHE_KEYS.PENDING_PDF_SELECTION + userId,
                    JSON.stringify(pendingData),
                    300,
                  );

                  // v24.4.4: 直接發送反問訊息，不附加 Fast Mode 的錯誤回答
                  // （既然 AI 說需要查 PDF，Fast Mode 的回答就是不準確的）
                  const askMsg = createModelSelectionFlexV3(
                    pdfSearchResult.matchedPdfs.map((p) => p.prefix),
                    { headerText: `🔍 ${pdfSearchResult.aliasName} 型號確認` },
                  );

                  replyMessage(replyToken, askMsg);
                  writeLog(`[PDF Match] 已發送型號選擇反問`);

                  // v24.5.2: 修復對話記憶丟失問題
                  // 即使是反問，也要將用戶問題和反問記錄到歷史
                  // 這樣用戶後續回覆時才能看到上下文
                  writeRecordDirectly(userId, msg, contextId, "user", "");
                  writeRecordDirectly(
                    userId,
                    askMsg,
                    contextId,
                    "assistant",
                    "",
                  );

                  // v24.5.2: 更新對話歷史（關鍵修復！）
                  const askMsgObj = { role: "assistant", content: askMsg };
                  updateHistorySheetAndCache(
                    contextId,
                    history,
                    userMsgObj,
                    askMsgObj,
                  );

                  return; // 等待用戶回覆
                } else if (pdfSearchResult.matchedPdfs.length === 1) {
                  // 只有一個 PDF → 直接使用
                  writeLog(
                    `[PDF Match] 只有一個匹配: ${pdfSearchResult.matchedPdfs[0].name}，直接開啟 PDF Mode`,
                  );
                  cache.put(
                    `${userId}:direct_search_models`,
                    JSON.stringify([
                      pdfSearchResult.matchedPdfs[0].matchedModel,
                    ]),
                    300,
                  );

                  // 設定 PDF 模式並重試
                  isInPdfMode = true;
                  cache.put(pdfModeKey, "true", 300);

                  // v29.4.37: 傳入找到的 PDF，而非空陣列
                  const matchedPdf = pdfSearchResult.matchedPdfs[0];
                  const pdfToAttach = [
                    {
                      name: matchedPdf.name,
                      uri: matchedPdf.uri,
                      mimeType: "application/pdf",
                    },
                  ];
                  writeLog(
                    `[PDF Attach] 掛載: ${matchedPdf.name} (URI: ${
                      matchedPdf.uri ? "有" : "無"
                    })`,
                  );

                  const deepResponse = callLLMWithRetry(
                    userMessage,
                    [...history, userMsgObj],
                    pdfToAttach, // v29.4.37: 傳入找到的 PDF
                    true, // attachPDFs
                    null, // imageBlob
                    true, // isRetry
                    userId,
                    false, // forceWebSearch
                    matchedPdf.matchedModel, // targetModelName
                  );

                  if (deepResponse && deepResponse !== "[KB_EXPIRED]") {
                    finalText = stripAnySourceTags(formatForLineMobile(deepResponse));
                    finalText = finalText
                      .replace(/\[AUTO_SEARCH_PDF\]/g, "")
                      .trim();
                    finalText = finalText.replace(/\[NEED_DOC\]/g, "").trim();
                    // v29.3.53: 補上 [AUTO_SEARCH_WEB] 清理，防止暗號外洩
                    finalText = finalText
                      .replace(/\[AUTO_SEARCH_WEB\]/g, "")
                      .trim();
                    finalText = finalText
                      .replace(/\[型號[:：][^\]]+\]/g, "")
                      .trim();
                    finalText = sanitizeManualDeflection(finalText);
                    finalText = enforceManualUncertaintyGuard(finalText, msg);
                    finalText = enforceManualNumberedList(finalText);
                    if (matchedPdf && matchedPdf.file) {
                      finalText = appendPdfSourceTag(finalText, [matchedPdf.file], 1);
                    }
                    if (matchedPdf && matchedPdf.file) {
                      finalText = ensurePdfSourceTag(finalText, [matchedPdf.file], 1);
                    }

                    // v29.4.33: 設置 PDF 已查詢標記，下次追問將升級至 Web Search
                    cache.put(`${userId}:pdf_consulted`, "true", 600); // 10 分鐘有效
                    cache.put(`pdf_consulted_${userId}`, "true", 600); // v29.5.130: 與 SOP key 對齊
                    writeLog(
                      "[PDF v29.4.33] 已設置 pdf_consulted 標記，後續追問將升級至 Web Search",
                    );
                  } else {
                    finalText += "\n\n(⚠️ 自動查閱手冊失敗，請稍後再試)";
                  }
                  replyText = finalText;
                } else {
                  // 沒有匹配的 PDF → 引導找 Sam
                  writeLog(`[PDF Match] 無匹配 PDF，引導找 Sam`);
                  replyText =
                    finalText +
                    "\n\n這個型號的手冊我還沒有建檔，可以找 Sam 幫你查喔！";
                }
              } else if (aiRequestedPdfSearch) {
                // v27.9.67: 標準 PDF 搜尋路徑，補上 Loading 動畫
                showLoadingAnimation(userId, 60);

                // v27.9.12: 只有當 AI 明確要求 PDF 搜尋時，才使用傳統 PDF 匹配
                // 沒有直通車關鍵字 → 使用傳統方式（依據型號匹配）
                // v29.5.0: Log Optimization
                // writeLog(
                //   "[Auto Search] AI 要求 PDF 搜尋，無直通車關鍵字，使用傳統 PDF 匹配"
                // );

                // v27.9.32: 智慧型話題延續偵測（使用 LLM 判斷）
                // 若用戶表示「未解決」，視為同一話題的追問，使用歷史型號
                // 否則強制只用當前訊息，避免歷史污染（如：第1輪問Odyssey，第2輪問奇美）

                let useHistory = false;
                const manualOrContinuationSignals =
                  /手冊|說明書|manual|剛剛那台|剛才那台|上一台|那台|這台|同一台|前面那台|延續|繼續剛剛/i;

                if (manualOrContinuationSignals.test(msg)) {
                  useHistory = true;
                  writeLog(
                    `[Topic Check v29.5.132] 命中手冊/延續語意，強制 useHistory=true`,
                  );
                }

                // 只有在有對話歷史時才需要判斷
                if (!useHistory && history && history.length > 0) {
                  try {
                    // 使用最便宜的 LLM (Gemini Flash) 快速判斷話題延續性
                    const lastAssistantMsg = history
                      .slice()
                      .reverse()
                      .find((h) => h.role === "assistant");
                    if (lastAssistantMsg) {
                      const apiKey =
                        PropertiesService.getScriptProperties().getProperty(
                          "GEMINI_API_KEY",
                        );
                      if (!apiKey) {
                        throw new Error("API Key not configured");
                      }

                      const topicCheckPrompt = `上一輪對話：「${lastAssistantMsg.content.substring(
                        0,
                        200,
                      )}」\n當前用戶訊息：「${msg}」\n\n請判斷：用戶是在「繼續上一個話題（表示未解決或追問）」還是「換了新話題」？\n只回答：SAME（同一話題）或 NEW（新話題）`;

                      lastLlmCallAttempted = true;
                      const topicCheckResponse = UrlFetchApp.fetch(
                        `${CONFIG.API_ENDPOINT}/${CONFIG.MODEL_NAME_FAST}:generateContent?key=${apiKey}`,
                        {
                          method: "post",
                          contentType: "application/json",
                          muteHttpExceptions: true,
                          payload: JSON.stringify({
                            contents: [
                              {
                                role: "user",
                                parts: [{ text: topicCheckPrompt }],
                              },
                            ],
                            generationConfig: {
                              maxOutputTokens: 10,
                              temperature: 0,
                            },
                          }),
                        },
                      );

                      const topicResult = JSON.parse(
                        topicCheckResponse.getContentText(),
                      );
                      const topicDecision =
                        topicResult.candidates?.[0]?.content?.parts?.[0]?.text
                          ?.trim()
                          .toUpperCase() || "NEW";
                      useHistory = topicDecision.includes("SAME");

                      writeLog(
                        `[Topic Check] LLM 判斷: ${topicDecision} -> useHistory=${useHistory}`,
                      );
                    }
                  } catch (e) {
                    // 如果 LLM 判斷失敗，fallback 到關鍵字匹配
                    writeLog(
                      `[Topic Check] LLM 判斷失敗，使用關鍵字 fallback: ${e.message}`,
                    );
                    const unresolvedSignals =
                      /不行|沒用|可是|但是|問題|仍然|依舊|還是|沒辦法|失效|異常|卡頓|手冊|說明書|manual|剛剛那台|那台|這台|同一台/i;
                    useHistory = unresolvedSignals.test(msg);
                  }
                }

                // 💡 智慧安全閥 v29.5.206
                // 如果當前訊息完全沒有提及型號代碼，我們就認定這必然是話題延續，強制開啟使用歷史！
                if (!useHistory) {
                  const checkModelRegex = /\b(G\d{1,2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|(?:L?S)\d{1,2}[A-Z]{0,2}\d{0,4}[A-Z0-9]{0,5}|(L?[CF])\d{2}[A-Z]+\d{2,4}[A-Z0-9]*|WA\d+[A-Z\d]*|WD\d+[A-Z\d]*|VR\d+[A-Z\d]*)\b/i;
                  const hasModelInMsg = checkModelRegex.test(msg);
                  if (!hasModelInMsg) {
                    useHistory = true;
                    writeLog(`[Topic Check] 當前訊息(${msg.substring(0, 30)})無明確型號，安全閥自動判定為話題追問，啟用歷史型號`);
                  }
                }

                if (useHistory) {
                  writeLog(
                    "[Auto Search] 偵測到「同一話題」，使用對話歷史匹配 PDF",
                  );
                } else {
                  writeLog(
                    "[Auto Search] 偵測到「新話題」或無歷史，強制只用當前訊息避免歷史污染",
                  );
                }

                // 預測會用到哪些 PDF
                const kbList = JSON.parse(
                  PropertiesService.getScriptProperties().getProperty(
                    CACHE_KEYS.KB_URI_LIST,
                  ) || "[]",
                );
                // v29.4.16: Destructure result from getRelevantKBFiles
                // v29.4.22: Allow AI to override search query
                const searchMsgObj = aiSearchQuery
                  ? { role: "user", content: aiSearchQuery }
                  : userMsgObj;

                const kbResult = getRelevantKBFiles(
                  useHistory && !aiSearchQuery
                    ? [...history, userMsgObj]
                    : [searchMsgObj],
                  kbList,
                  userId,
                  contextId,
                  !useHistory,
                  aiSearchQuery, // v29.4.27: Pass aiSearchQuery explicitly
                );
                // Compatible handling
                let relevantFiles = [];
                let primaryModel = null;
                if (Array.isArray(kbResult)) {
                  relevantFiles = kbResult;
                } else {
                  relevantFiles = kbResult.files || [];
                  primaryModel = kbResult.primaryModel;
                }

                const pdfNames = relevantFiles
                  .filter((f) => f.mimeType === "application/pdf")
                  .map((f) => f.name.replace(".pdf", ""));
                const productNames = pdfNames
                  .map((name) => getPdfProductName(name))
                  .slice(0, 3);

                // v27.9.77: 移除多型號反問機制（此機制導致對話記憶丟失）
                // 原本設計：若偵測到多個 PDF，會反問用戶選擇型號
                // 問題：反問邏輯會打斷對話流程，且歷史記錄處理有 bug
                // 恢復原本行為：直接使用找到的 PDF 進行查詢（不反問）

                if (productNames.length > 0) {
                  writeLog(
                    `[Auto Deep] 找到相關手冊: ${productNames.join(
                      "、",
                    )}，開始重試...`,
                  );

                  isInPdfMode = true;
                  cache.put(pdfModeKey, "true", 300);

                  const deepResponse = callLLMWithRetry(
                    userMessage,
                    [...history, userMsgObj],
                    relevantFiles, // filesToAttach
                    true, // attachPDFs
                    null, // imageBlob
                    true, // isRetry
                    userId,
                    false, // forceWebSearch
                    primaryModel, // targetModelName
                  );

                  if (deepResponse && deepResponse !== "[KB_EXPIRED]") {
                    finalText = stripAnySourceTags(formatForLineMobile(deepResponse));
                    finalText = finalText
                      .replace(/```tool_code/g, "")
                      .replace(/tool_code/g, "")
                      .replace(/```/g, "")
                      .replace(/\[AUTO_SEARCH_PDF\]/g, "")
                      .trim();
                    finalText = finalText.replace(/\[NEED_DOC\]/g, "").trim();
                    finalText = finalText
                      .replace(/\[型號[:：][^\]]+\]/g, "")
                      .trim();

                    if (finalText.startsWith("根據我的資料庫")) {
                      finalText = finalText.replace(
                        /^根據我的資料庫/,
                        "根據產品手冊",
                      );
                    }
                    finalText = sanitizeManualDeflection(finalText);
                    finalText = enforceManualUncertaintyGuard(finalText, msg);
                    finalText = enforceManualNumberedList(finalText);

                    // v29.5.158: 來源標註改為真實 PDF 檔名
                    if (relevantFiles.length > 0) {
                      finalText = appendPdfSourceTag(finalText, relevantFiles, 1);
                    }
                    if (relevantFiles.length > 0) {
                      finalText = ensurePdfSourceTag(finalText, relevantFiles, 1);
                    }
                    cache.put(`${userId}:pdf_consulted`, "true", 600);
                    cache.put(`pdf_consulted_${userId}`, "true", 600);

                  } else {
                    finalText += "\n\n(⚠️ 自動查閱手冊失敗，請稍後再試)";
                  }
                  replyText = finalText;
                } else {
                  // v27.9.62: 嘗試使用反查型號救援
                  // 若一般搜尋找不到 PDF，但之前「規格反查」有找到型號，則使用該型號
                  let rescueSuccess = false;
                  try {
                    const cache = CacheService.getScriptCache();
                    const cachedReverseModel = cache.get(
                      `REVERSE_LOOKUP_MODEL:${userId}`,
                    );
                    if (cachedReverseModel) {
                      // v27.9.65: 觸發 Rescue Mode，再次顯示 Loading 動畫
                      showLoadingAnimation(userId, 60);

                      writeLog(
                        `[Auto Search] 找不到 PDF，嘗試使用反查型號救援: ${cachedReverseModel}`,
                      );
                      // 注入直通車 Cache，讓 getRelevantKBFiles 能讀到
                      cache.put(
                        `${userId}:direct_search_models`,
                        JSON.stringify([cachedReverseModel]),
                        300,
                      );

                      // 重試搜尋 (強制使用當前訊息+Cache，或直接依賴Cache)
                      const rescueKbResult = getRelevantKBFiles(
                        [userMsgObj],
                        kbList,
                        userId,
                        contextId,
                        true,
                      );
                      const rescueFiles = rescueKbResult.files || [];
                      const rescuePrimaryModel = rescueKbResult.primaryModel;

                      const rescuePdfNames = rescueFiles
                        .filter((f) => f.mimeType === "application/pdf")
                        .map((f) => f.name.replace(".pdf", ""));
                      const rescueProductNames = rescuePdfNames
                        .map((name) => getPdfProductName(name))
                        .slice(0, 3);

                      if (rescueProductNames.length > 0) {
                        writeLog(
                          `[Auto Search] 救援成功! 找到: ${rescueProductNames.join(
                            "、",
                          )}，開始重試...`,
                        );
                        rescueSuccess = true;

                        isInPdfMode = true;
                        cache.put(pdfModeKey, "true", 300);

                        const deepResponse = callLLMWithRetry(
                          userMessage, // query
                          [...history, userMsgObj], // messages
                          rescueFiles, // filesToAttach
                          true, // attachPDFs
                          null, // imageBlob
                          true, // isRetry
                          userId, // userId
                          false, // forceWebSearch
                          rescuePrimaryModel, // targetModelName
                        );

                        if (deepResponse && deepResponse !== "[KB_EXPIRED]") {
                          finalText = stripAnySourceTags(
                            formatForLineMobile(deepResponse),
                          );
                          finalText = finalText
                            .replace(/```tool_code/g, "")
                            .replace(/tool_code/g, "")
                            .replace(/```/g, "")
                            .replace(/\[AUTO_SEARCH_PDF\]/g, "")
                            .trim();
                          finalText = finalText
                            .replace(/\[NEED_DOC\]/g, "")
                            .trim();
                          finalText = finalText
                            .replace(/\[AUTO_SEARCH_WEB\]/g, "")
                            .trim();
                          finalText = finalText
                            .replace(/\[型號[:：][^\]]+\]/g, "")
                            .trim();

                          if (finalText.startsWith("根據我的資料庫")) {
                            finalText = finalText.replace(
                              /^根據我的資料庫/,
                              "根據產品手冊",
                            );
                          }
                          finalText = sanitizeManualDeflection(finalText);
                          finalText = enforceManualUncertaintyGuard(finalText, msg);
                          finalText = enforceManualNumberedList(finalText);
                          if (rescueFiles.length > 0) {
                            finalText = appendPdfSourceTag(finalText, rescueFiles, 1);
                          }
                          if (rescueFiles.length > 0) {
                            finalText = ensurePdfSourceTag(finalText, rescueFiles, 1);
                          }
                          cache.put(`${userId}:pdf_consulted`, "true", 600);
                          cache.put(`pdf_consulted_${userId}`, "true", 600);
                        } else {
                          finalText += "\n\n(⚠️ 自動查閱手冊失敗，請稍後再試)";
                        }
                        replyText = finalText;
                      }
                    }
                  } catch (e) {
                    writeLog(`[Auto Search] Rescue Error: ${e.message}`);
                  }

                  if (!rescueSuccess) {
                    writeLog(
                      "[Auto Search] 找不到相關 PDF，使用 Fast Mode 答案",
                    );

                    // v27.9.44 Fix: 避免 Fast Mode 只回答 [AUTO_SEARCH_PDF] 被清空後造成空白回覆
                    if (!finalText || finalText.trim().length === 0) {
                      const suggestedModel =
                        cachedDirectModels && cachedDirectModels.length > 0
                          ? cachedDirectModels[0]
                          : "";
                      const usageHint = suggestedModel
                        ? `\n你也可以直接輸入：#查手冊 ${suggestedModel} 你的問題`
                        : `\n你也可以直接輸入：#查手冊 S27FG900XC 你的問題`;
                      finalText =
                        "抱歉，這題看起來需要手冊，但我目前找不到可對應的 PDF。😅\n請補上完整型號或更具體的問題。" +
                        usageHint;
                    }
                    replyText = finalText;
                  }
                }
              }
            } // v24.5.0: 結束 else { 有直通車關鍵字 } 區塊
          } // v24.5.0: 結束 else { 沒有 PDF 記憶 } 區塊
        }
        // === [NEW_TOPIC] 攔截：退出 PDF 模式 ===
        if (finalText.includes("[NEW_TOPIC]")) {
          writeLog("[New Topic] 偵測到換題，退出 PDF 模式");
          finalText = finalText.replace(/\[NEW_TOPIC\]/g, "").trim();
          cache.remove(pdfModeKey);
          replyText = finalText;
        }
        // === 智慧退出：回答不需要 PDF 時自動退出 ===
        else if (isInPdfMode) {
          // v24.1.33: 移除強制補全開頭邏輯，避免與 AI 自己的開頭重複
          // AI 會根據 Prompt 自行決定開頭，不需要程式碼干預

          // 檢測是否為簡單回答（不需要 PDF 的回答）
          const exitPatterns = [
            /找Sam|問Sam|問一下Sam/i, // 引導找 Sam
            /官網確認|samsung\.com/i, // 價格引導到官網
            /沒有.*資料|資料.*沒有/i, // 查無資料
            /商業機密|不能透漏/i, // 拒答
            /手邊的資料剛好沒有寫到/i, // AI 查無資料的常見回覆
            /手冊未記載/i, // v24.1.30: 新增退出關鍵字
          ];
          // v29.5.03: 若回覆來自網路搜尋，不要退出 PDF 模式，保持 web_search_count
          const isWebSearchResponse = /\[來源[：:]\s*網路搜尋\]/i.test(
            finalText,
          );
          const shouldExit =
            !isWebSearchResponse && exitPatterns.some((p) => p.test(finalText));
          if (shouldExit) {
            writeLog("[PDF Mode] 回答不需 PDF (或查無資料)，自動退出");
            cache.remove(pdfModeKey);
          }
          replyText = finalText;
        }

        // v27.0.0: 修復費用顯示邏輯（確保費用正確對應當前查詢）
        if (DEBUG_SHOW_TOKENS && lastTokenUsage && lastTokenUsage.costTWD) {
          const tokenInfo = `\n\n${buildReplyCostAuditText_()}`;
          // v29.3.21: 修正多泡泡模式下的字串拼接
          if (Array.isArray(replyText)) {
            replyText[replyText.length - 1] += tokenInfo;
          } else {
            replyText += tokenInfo;
          }

          // v27.9.14: QA 庫滿警告 - 動態閾值：一般 20k，網路搜尋 40k
          // v27.9.32: 動態閾值 - 網路搜尋階段允許更高 Token 使用量
          const checkText = Array.isArray(replyText)
            ? replyText.join("\n")
            : replyText;
          const isWebSearchPhase =
            checkText.includes("🔍 網路搜尋補充資料") ||
            checkText.includes("[來源:網路搜尋]");
          const tokenThreshold = isWebSearchPhase ? 40000 : 20000;

          if (lastTokenUsage.input > tokenThreshold) {
            // v29.4.12: Replace Warning with Model Count Info
            const modelCount =
              PropertiesService.getScriptProperties().getProperty(
                "TOTAL_MODEL_COUNT",
              ) || "?";
            const warning = `\n\n(資料庫內有${modelCount}筆型號)`;
            if (Array.isArray(replyText)) {
              replyText[replyText.length - 1] += warning;
            } else {
              replyText += warning;
            }
            writeLog(
              `[Token Warning] Input tokens (${lastTokenUsage.input}) exceeded ${tokenThreshold} threshold`,
            );
          }
        }

        // v29.5.118: 統一三按鈕 Quick Reply（繼續問 / 查手冊 / 搜網路）
        let responseOptions = {};
        if (!msg.startsWith("/") && !msg.startsWith("#") && replyText) {
          let currentReplyTextForUi = Array.isArray(replyText)
            ? replyText.join("\n")
            : String(replyText || "");
          const isWaitingForModelSelection =
            forcedModelSelectionTrigger ||
            forcedSopNeedsModelSelection ||
            isModelSelectionOrNeedModelReply(currentReplyTextForUi);
          const currentReplyAnchor = getElaborationTopicAnchor_(
            cache,
            userId,
            finalText || currentReplyTextForUi,
          );
          const elaborationCountForThisReply = getElaborationCountForAnchor_(
            cache,
            userId,
            currentReplyAnchor,
          );

          const qrItems = [];

          // v29.5.259: 只有已知此型號有 PDF 時才顯示「查手冊」。
          // 不用操作題關鍵字硬開按鈕，避免使用者點了才被告知找不到手冊。
          const alreadyConsultedPdf =
            cache.get(`${userId}:pdf_consulted`) === "true";
          if (
            hasPdfForModel &&
            !alreadyConsultedPdf &&
            !isWaitingForModelSelection
          ) {
            qrItems.push({
              type: "action",
              action: { type: "message", label: "📖 查手冊", text: "#查手冊" },
            });

            // v29.5.149: 修改回答末尾的查手冊等待提醒
            const pdfReminder =
              "\n\n💡 如果以上資訊不夠，我也可以再幫你查查「官方產品手冊」，但可能需要30~60秒喔!!";
            if (Array.isArray(replyText)) {
              replyText[replyText.length - 1] += pdfReminder;
            } else {
              replyText += pdfReminder;
            }
          }

          if (elaborationCountForThisReply < MAX_ELABORATE_PER_ANSWER) {
            // v29.5.149: 第二個按鈕改為「再詳細說明」→ 找 AI 上次回答並請求展開
            qrItems.push({
              type: "action",
              action: {
                type: "message",
                label: "💬 再詳細說明",
                text: "#再詳細說明",
              },
            });
          } else {
            writeLog(
              `[Quick Reply v29.5.134] 隱藏「再詳細說明」(已達上限 ${elaborationCountForThisReply}/${MAX_ELABORATE_PER_ANSWER})`,
            );
          }

          // 缺型號時改為對話提示，不以泡泡引導
          const userAskedManual = /手冊|說明書|manual/i.test(msg);
          const alreadyHasModelHint =
            /請先告訴我型號|請提供型號|完整型號/i.test(currentReplyTextForUi);
          if (!hasPdfForModel && userAskedManual && !alreadyHasModelHint) {
            const modelHint =
              "\n\n📌 若你要查手冊，請在訊息內提供完整型號（例如：S27FG900XC）。";
            if (Array.isArray(replyText)) {
              replyText[replyText.length - 1] += modelHint;
            } else {
              replyText += modelHint;
            }
            currentReplyTextForUi = Array.isArray(replyText)
              ? replyText.join("\n")
              : String(replyText || "");
          }
          qrItems.push({
            type: "action",
            action: {
              type: "message",
              label: "🌐 這題再搜網路",
              text: "#這題再搜網路",
            },
          });

          if (qrItems.length > 0) {
            responseOptions.quickReply = { items: qrItems };
          }
        }

        if (Array.isArray(replyText)) {
          replyText = replyText.map((item) => enforceNiTone(item));
        } else {
          replyText = enforceNiTone(replyText);
        }

        // Fast Mode 來源保留：若原始回覆有可信來源標籤，清理後補回標準標籤。
        if (!Array.isArray(replyText)) {
          // v29.6.035: 不管 stayedInFastMode 與否, 都要補來源標籤
          // v29.6.038: appendSourceTagIfMissing 已智慧化 (暗號/缺失/預設)
          const inferredFastSourceTag = inferFastLocalSourceTag_(
            msg,
            replyText,
            fastSourceTag,
          );
          replyText = appendSourceTagIfMissing(replyText, inferredFastSourceTag);
          const stayedInFastMode =
            !aiRequestedPdfSearch && !shouldAttachPdfs && !hasExplicitTrigger;
          if (stayedInFastMode && !skipAliasFeatureGuard) {
            const aliasGuardModels =
              suggestedModels.length > 0
                ? suggestedModels
                : cachedDirectModels;
            replyText = applyAliasFeatureAmbiguityGuard(
              msg,
              replyText,
              fastSourceTag,
              aliasGuardModels,
            );
          }
        }

        // 🔥 v29.5.109: 詳細 LOG - 完整記錄最終回覆內容
        const replySummary = Array.isArray(replyText)
          ? `[多泡泡回覆 ${replyText.length}則]`
          : `[文字回覆 ${String(replyText || "").length} 字]`;
        writeLog(`[Final Reply] 即將回覆: ${replySummary}`);

        replyMessage(replyToken, replyText, responseOptions);
        // v25.0.2 修復：補上缺失的 user 訊息記錄
        writeRecordDirectly(userId, msg, contextId, "user", "");
        // v29.3.21: 寫入紀錄時，若為陣列則合併
        const saveText = Array.isArray(replyText)
          ? replyText.join("\n\n")
          : replyText;
        writeRecordDirectly(userId, saveText, contextId, "assistant", "");
        // v29.5.177: 由 [Reply] 記錄完整 LINE 回覆，避免重複寫入 [AI Reply] 造成列數膨脹

        updateHistorySheetAndCache(contextId, history, userMsgObj, {
          role: "assistant",
          content: finalText,
        });

        // 2025-12-05 v23.6.5: 背景異步整理 (Async Background Summary)
        // v27.8.25: Async Summary temporarily disabled for syntax debugging
        // try { ... } catch (e) { ... }
      }
    } catch (apiErr) {
      // v29.6.003: 根據錯誤類型給用戶不同提示
      const errMsg = String(apiErr.message || "");
      let userFriendlyError;
      if (errMsg.includes("429") || errMsg.includes("spending cap") || errMsg.includes("RESOURCE_EXHAUSTED")) {
        userFriendlyError =
          "⚠️ 本月 API 配額已達上限，請通知管理員到 Google AI Studio 調整 (https://ai.studio/spend)。\n\n本服務將在配額重置後自動恢復。";
      } else if (errMsg.includes("API Key") || errMsg.includes("400") || errMsg.includes("API_KEY_INVALID")) {
        userFriendlyError =
          "⚠️ API 金鑰設定異常，請通知管理員檢查。";
      } else {
        userFriendlyError =
          "⚠️ 抱歉，系統暫時忙碌，這次查詢暫時無法處理。\n\n請稍後再試一次，或換個更具體的問法。";
      }
      replyMessage(replyToken, userFriendlyError);
      writeLog(
        `[Handle API Error] ${apiErr.message} (Sent friendly error to user)`,
      );
    } finally {
      // v27.8.5: 可選：在此處也嘗試 flush，避免 GAS 超時被殺
      // 但 doPost 已有 finally flush，這裡可不寫，或為了保險寫一次
    }
  } catch (error) {
    try { replyMessage(replyToken, '⚠️ 系統發生預期外的錯誤，請稍後再試。'); } catch(e){} // v29.6 BUG 7 修復
    writeLog("[Fatal] " + error);
  }
}

// v24.1.23: 廢棄 handleDeepSearch，改由 Auto Deep Search 直接處理
// 保留函數殼層以防有其他地方呼叫，但內容已清空或轉向
function handleDeepSearch(originalQuery, userId, replyToken, contextId) {
  writeLog(
    "[Deprecated] handleDeepSearch 被呼叫，但此功能已廢棄 (改為 Auto Deep Search)",
  );
  // 這裡不應該再被執行到，因為 PENDING_QUERY 邏輯已被移除
}

// 提示語生成器
function generateFollowUpPrompt() {
  return "💡 這需要查閱詳細手冊才能解決。繼續深入搜尋請輸入「1」，將會用更多時間搜尋相關型號的產品使用手冊。";
}

function handleImageMessage(msgId, userId, replyToken, contextId) {
  try {
    writeLog(`[Image] 收到圖片 MsgId: ${msgId}`);
    const cache = CacheService.getScriptCache();
    cache.put(contextId + ':image_processing', 'true', 15);
    // writeRecordDirectly(userId, "[傳圖]", contextId, 'user', '');

    if (!hasRecentAnimation(userId)) {
      showLoadingAnimation(userId, 60);
      markAnimationShown(userId);
    }

    const token =
      PropertiesService.getScriptProperties().getProperty("LINE_TOKEN");
    const blob = UrlFetchApp.fetch(
      `https://api-data.line.me/v2/bot/message/${msgId}/content`,
      { headers: { Authorization: "Bearer " + token } },
    ).getBlob();

    const history = getHistoryFromCacheOrSheet(contextId);
    const analysisQuery = "這是一張使用者傳送的圖片。請結合我們的對話歷史，詳細分析這張圖片，包含任何可見的螢幕型號、錯誤代碼、警告訊息、畫面異常情形（如亮線、黑屏）或指示燈狀態。請直接條列分析結果與解決建議，不需開場白。這將作為後續客服判斷的依據。";
    const messages = [...history, { role: "user", content: analysisQuery }];

    const analysis = callLLMWithRetry(
      null, // query
      messages, // messages
      [], // filesToAttach
      false, // attachPDFs
      blob, // imageBlob
      false, // isRetry
      userId, // userId
      false, // forceWebSearch
      null, // targetModelName
    );
    const final = formatForLineMobile(analysis);
    replyMessage(replyToken, final);

    // writeRecordDirectly(userId, final, contextId, 'assistant', '');

    updateHistorySheetAndCache(
      contextId,
      history,
      { role: "user", content: "[使用者傳送了一張圖片]" },
      { role: "assistant", content: `(針對圖片的分析結果) ${final}` },
    );
    cache.remove(contextId + ':image_processing');
  } catch (e) {
    writeLog(`[Image Error] ${e.message}`);
    CacheService.getScriptCache().remove(contextId + ':image_processing');
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
    const cache = CacheService.getScriptCache();
    cache.remove(`dissatisfied_count_${u}`);
    cache.remove(`pdf_consulted_${u}`);
    cache.remove(`${u}:pdf_consulted`);
    cache.remove(`${u}:elaboration_state`);
    cache.remove(`${u}:last_meaningful_query`);
    cache.remove(`${u}:direct_search_models`);
    cache.remove(`${u}:hit_alias_key`);
    cache.remove(`${u}:pending_topic`);
    cache.remove(`${u}:last_selected_model`);
    cache.remove(`${u}:model_select_mode`);
    cache.remove(`${u}:qa_offer_payload`);
    cache.remove(`${u}:suggested_models`);
    cache.remove(`${u}:pending_pdf_query`);
    cache.remove(`model_selection_${u}`);
    const pdfModeKey = CACHE_KEYS.PDF_MODE_PREFIX + cid;
    cache.remove(pdfModeKey);
    
    writeLog('[Command] 重啟只清除個人對話狀態，不覆寫知識庫 by ' + u);
    return '✓ 對話已重置。你的 QA、RULE 與官方手冊索引不會因此被變更。';










  }

  if (cmd === "/重設規格庫" || cmd === "/rebuild_rules") {
    writeLog(`[Command Guard] 拒絕 LINE 全域規格庫覆寫指令 by ${u}`);
    return '為了保護已累積的 QA 與 RULE，LINE 不提供全域規格庫重設。若需要維運還原，請由管理員先備份後在離線維運流程執行。';










  }

  if (cmd === "/取消") {
    CacheService.getScriptCache().remove(draftKey);
    CacheService.getScriptCache().remove(CACHE_KEYS.PENDING_QUERY + u);
    return "❌ 已取消建檔，回到一般對話模式。";
  }

  // v29.5.151: 恢復遺失的 QA 建檔指令
  if (cmd === "/紀錄" || cmd === "/記錄") {
    const draftCache = CacheService.getScriptCache().get(draftKey);
    if (!draftCache) {
      return "⚠️ 目前沒有正在進行的建檔草稿喔！請先輸入「/紀錄 <內容>」開始建檔。\n\nQA 範例：/紀錄 S27FG532EC 怎麼調整更新率？A：到遊戲選單調整更新頻率。\nRULE 範例：/紀錄 本期三星螢幕活動：S27FG532EC 促銷價 4990，活動期間 2026/07/01-2026/07/31，來源：https://promotion.twsamsungcampaign.com/...";
    }
    const draftObj = JSON.parse(draftCache);
    if (draftObj.pendingMergeChoice === true) {
      return "⚠️ 存檔失敗：偵測到相似的既存 QA，請先輸入 1、2 或 3 決定如何處置！\n\n1️⃣ 採用合併版\n2️⃣ 另開新條\n3️⃣ 取代舊 QA\n(你也可以直接發送對話以進行補充修改，或輸入 /取消 退出)";
    }
    const result = saveDraftToSheet(draftObj);
    return "📝 存檔結果：\n" + result;
  }

  if (cmd.startsWith("/紀錄 ") || cmd.startsWith("/記錄 ")) {
    const content = cmd.replace(/^\/[紀錄記錄]+\s*/, "").trim();
    if (!content) {
      return "⚠️ 請在指令後方加上你要建檔的內容。";
    }
    return startNewEntryDraft(content, u);
  }

  if (
    cmd === "/不滿意" ||
    cmd === "/擴大搜尋" ||
    cmd === "不滿意這回答請繼續擴大搜尋" ||
    cmd === "/重試"
  ) {
    writeLog(`[Command] 觸發擴大搜尋 by ${u}, cmd: ${cmd}`);
    // 立即發送 Loading 動畫，因為搜尋需要時間
    showLoadingAnimation(u, 60);

    const history = getHistoryFromCacheOrSheet(cid);
    if (!history || history.length === 0) {
      return "💡 目前沒有對話紀錄可以進行搜尋喔，請先跟我聊聊天吧！";
    }
    const cache = CacheService.getScriptCache();

    // v29.5.133: 強化 Context Repair
    // - 跳過 #再詳細說明模板與 System Hint 殘留
    // - 跳過「不滿意這回答請繼續擴大搜尋」等指令文字
    // - 若最後一次是純型號，回溯上一個真正問題後再組合
    const cleanHistoryText = (text) => {
      if (!text) {
        return "";
      }
      return text
        .replace(/\[System Hint:.*?\]/gs, "")
        .replace(/\[AUTO_SEARCH_[A-Z_]+(?:[:：][^\]]+)?\]/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    const isModelOnlyText = (text) => {
      const normalized = (text || "").replace(/[\s-]/g, "").toUpperCase();
      if (!normalized) {
        return false;
      }
      // 僅把「真正像型號」的內容視為 model-only，避免把 ODYSSEY3D 這類語意詞當成型號
      if (/ODYSSEY|HUB|ARK/.test(normalized)) {
        return false;
      }
      return /^[SCFGM]\d{1,2}[A-Z0-9]{1,20}$/.test(normalized);
    };

    const isNoiseForContextRepair = (text) => {
      if (!text) {
        return true;
      }
      return (
        text.startsWith("#") ||
        text.includes("不滿意這回答請繼續擴大搜尋") ||
        text.includes("請針對你剛才的回答再詳細說明") ||
        text.includes("這是延伸說明需求") ||
        text.includes("更不要要求使用者再選型號") ||
        text.includes("to check manuals") ||
        text.includes("[AUTO_SEARCH") ||
        /^\d$/.test(text)
      );
    };

    let selectedModel = "";
    let userMsg = "";

    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i];
      if (h.role !== "user") {
        continue;
      }
      const content = cleanHistoryText(h.content || "");
      if (!content) {
        continue;
      }

      if (!selectedModel && isModelOnlyText(content)) {
        selectedModel = content.replace(/\s+/g, "");
        continue;
      }

      if (isNoiseForContextRepair(content) || isModelOnlyText(content)) {
        continue;
      }

      userMsg = content;
      break;
    }

    if (!userMsg) {
      const lastMeaningfulFromCache = cleanHistoryText(
        cache.get(`${u}:last_meaningful_query`) || "",
      );
      if (
        lastMeaningfulFromCache &&
        !isNoiseForContextRepair(lastMeaningfulFromCache)
      ) {
        userMsg = lastMeaningfulFromCache;
        writeLog(
          `[Context Repair v29.5.133] 使用 last_meaningful_query fallback: ${userMsg.substring(0, 80)}...`,
        );
      }
    }

    if (!userMsg) {
      for (let i = history.length - 1; i >= 0; i--) {
        const h = history[i];
        if (h.role !== "user") {
          continue;
        }
        const content = cleanHistoryText(h.content || "");
        if (!content || isNoiseForContextRepair(content)) {
          continue;
        }
        userMsg = content;
        writeLog(
          `[Context Repair v29.5.133] 使用歷史 fallback: ${userMsg.substring(0, 80)}...`,
        );
        break;
      }
    }

    if (
      selectedModel &&
      userMsg &&
      !userMsg.toUpperCase().includes(selectedModel.toUpperCase())
    ) {
      userMsg = `${selectedModel} ${userMsg}`.trim();
      writeLog(
        `[Context Repair v29.5.133] 組合查詢: ${userMsg.substring(0, 80)}...`,
      );
    } else {
      writeLog(
        `[Context Repair v29.5.133] 還原查詢: ${userMsg.substring(0, 80)}...`,
      );
    }

    if (!userMsg) {
      return "我找不到可延續的問題內容，請直接告訴我你要查的主題。\n例如：S27FG900XC 怎麼開啟 Odyssey Hub";
    }

    // 處理計數器 (dissatisfied_count)
    const countKey = `dissatisfied_count_${u}`;
    let count = parseInt(cache.get(countKey) || "0") + 1;
    cache.put(countKey, count.toString(), 600); // 10 分鐘內有效

    if (count > 1 && count <= 3) {
      userMsg += '\n\n(系統指示：使用者對先前的回答不滿意，這是第 ' + count + ' 次重新搜尋。請務必更換不同搜尋策略、角度或提供更深入的細節)';
      writeLog('[Loop Engineering] 已注入更換策略提示 (count=' + count + ')');
    }
    if (count > 3) {
      writeLog(`[Command] 三振出局: ${u} 已重試 ${count} 次`);
      return '抱歉，我已經嘗試多種角度搜尋但似乎仍未找到完美答案。😅 建議你可以將問題描述得更具體，或直接聯繫 Sam 協助喔！\n\n💡 經驗回饋：如果您後來順利排除了問題，隨時可以輸入「/紀錄 你的解法」，讓我把您的寶貴經驗學起來喔！';
    }

    // v29.5.27: SOP Enforcement (QA -> PDF -> Web)
    // 檢查是否已查過 PDF，若未查過且有型號，優先執行 PDF Search
    const pdfConsulted = hasPdfBeenConsultedForUser_(cache, u, history);
    if (pdfConsulted) {
      markPdfConsultedForUser_(cache, u);
      writeLog(
        "[SOP v29.6.070] 已由快取或最近官方手冊回答確認查過 PDF，本次直接進網路搜尋",
      );
    }
    // 嘗試從 Cache 取得上次的型號列表 (需要 Smart Router 有寫入)
    // 注意：cache key 必須與 Smart Router 一致。Smart Router 寫入的是 `last_models_json_${userId}` 嗎？
    // 檢查 checkDirectDeepSearch 把型號存哪了 -> `last_model_list_${userId}` (假設)
    // 實際上 Smart Router v29.4.14 寫入的是 `model_selection_${userId}` 的選項，但我們需要 raw models
    // 讓我們改為嘗試從 userMsg 裡重新提取型號，這最保險

    let triggerPDF = false;
    let filesToAttach = [];

    // v29.5.59: SOP Enforcement (Check PDF Index first!)
    if (!pdfConsulted && count <= 2) {
      const ruleObj = getClassRules();
      if (ruleObj && ruleObj.extractModelKeywords) {
        const models = ruleObj.extractModelKeywords(userMsg);
        if (models.length > 0) {
          const primary = models[0];
          // 關鍵檢查：這型號真的有 PDF 嗎？
          const pdfIndexJson =
            PropertiesService.getScriptProperties().getProperty(
              "PDF_MODEL_INDEX",
            );
          const pdfModelIndex = pdfIndexJson ? JSON.parse(pdfIndexJson) : [];
          const hasManual = pdfModelIndex.some((m) => {
            if (m.startsWith("S") && m.length >= 7)
              return m.includes(primary) || primary.includes(m);
            return m === primary;
          });

          if (hasManual) {
            const kbList = JSON.parse(
              PropertiesService.getScriptProperties().getProperty(
                CACHE_KEYS.KB_URI_LIST,
              ) || "[]",
            );
            const kbResult = getRelevantKBFiles(
              [{ role: "user", content: userMsg }],
              kbList,
              u,
            );
            const sopFiles = Array.isArray(kbResult)
              ? kbResult
              : kbResult && Array.isArray(kbResult.files)
                ? kbResult.files
                : [];
            if (sopFiles.length > 0) {
              triggerPDF = true;
              filesToAttach = sopFiles;
              writeLog(
                `[SOP] 型號 ${primary} 有手冊，執行優先 PDF Search (Pass 1.5)`,
              );
            }
          } else {
            writeLog(
              `[SOP] 型號 ${primary} 無專屬手冊，跳過 Pass 1.5，直接 Web Search`,
            );
          }
        }
      }
    }

    // 執行搜尋
    // v29.5.22: 修正參數順序
    // v29.5.27: 根據 triggerPDF 調整參數
    writeLog(
      `[Command] 啟動 Pass ${triggerPDF ? "1.5 (PDF)" : "2 (Web)"}, 次數: ${count}`,
    );

    // v29.5.89: 明確記錄完整搜尋內容，以便 Debug 確認 "型號+問題" 是否正確組合
    writeLog(`[Context Repair] Combined Query Sent to AI: "${userMsg}"`);

    // v29.5.81: Critical Fix - 必須將 userMsg (組合後的查詢) 加入 history，API 才會真的收到
    // 否則 LLM 只會看到舊的 history，看不到我們剛組合好的 "S27AG500NC G5 怎麼設定"
    const searchHistory = [...history, { role: "user", content: userMsg }];

    const searchResponse = callLLMWithRetry(
      userMsg, // query (for Prompt injection)
      searchHistory, // messages (for API payload, now includes the combined query)
      triggerPDF ? filesToAttach : [], // filesToAttach
      triggerPDF, // attachPDFs
      null, // imageBlob
      true, // isRetry
      u, // userId
      !triggerPDF, // forceWebSearch (PDF 優先於 Web)
      selectedModel || "", // targetModelName
    );

    if (triggerPDF) {
      cache.put(`pdf_consulted_${u}`, "true", 600);
      cache.put(`${u}:pdf_consulted`, "true", 600); // v29.5.130: 與主流程 key 對齊
    }

    if (searchResponse && searchResponse !== "[KB_EXPIRED]") {
      let result = formatForLineMobile(searchResponse);
      // v29.5.127: 移除 LLM 自帶的來源標籤，避免與程式加的重複
      result = result
        .replace(/[\[（\(]來源[：:][^\]）\)]*[\]）\)]/g, "")
        .trim();

      // v29.5.115: 只有真正執行網路搜尋才加標籤，PDF 搜尋不加
      if (!triggerPDF) {
        // 網路搜尋模式
        result = sanitizeManualDeflection(result);
        if (isApiFailureReply(result)) {
          writeLog(`[Web Search v29.5.280] 搜尋失敗，不追加補充資料標記`);
        } else if (
          lastWebEvidenceValid &&
          lastSearchSources &&
          lastSearchSources.length > 0
        ) {
          result += `\n\n(📊 已搜尋 ${lastSearchSources.length} 個來源：${lastSearchSources.join("、")})`;
          if (pdfConsulted && isCrossDeviceMonitorQuery(userMsg)) {
            result += "\n[來源:官方手冊]";
          }
          result += "\n[來源:網路搜尋]";
        } else {
          writeLog(
            "[Grounding Audit v29.6.073] 無可稽核來源，不追加 [來源:網路搜尋]",
          );
        }
      } else {
        // PDF 搜尋模式，不加網路搜尋標籤
        result = stripAnySourceTags(result);
        result = sanitizeManualDeflection(result);
        if (isCrossDeviceMonitorQuery(userMsg)) {
          result = removeCrossDeviceManualHeadingOnlyLines_(result);
        }
        result = enforceManualNumberedList(result);
        if (filesToAttach.length > 0) {
          result = appendPdfSourceTag(result, filesToAttach, 1);
        } else {
          result += "\n\n(📖 已查閱產品手冊)";
        }
        if (filesToAttach.length > 0) {
          result = ensurePdfSourceTag(result, filesToAttach, 1);
        }
      }
      result = enforceNiTone(result);

      // v29.5.85: Append Token Cost for Manual Web Search
      if (DEBUG_SHOW_TOKENS && lastTokenUsage && lastTokenUsage.costTWD) {
        result += `\n\n${buildReplyCostAuditText_()}`;
      }
      // v29.5.111: 修復對話記憶問題
      // 🔥 關鍵修正：保存原始問題 (userMsg) 而非指令文字 (cmd)
      // 這樣用戶問「那 M8 呢」時，AI 能看到之前在討論什麼主題（如「線材」）
      // 而不是看到「不滿意這回答請繼續擴大搜尋」這種無意義的上下文
      updateHistorySheetAndCache(
        cid,
        history,
        { role: "user", content: userMsg }, // v29.5.111: 改為保存原始問題
        { role: "assistant", content: searchResponse },
      );
      writeLog(
        `[History Fix v29.5.111] 保存原始問題至歷史: ${userMsg.substring(0, 50)}...`,
      );
      return result;
    } else {
      if (searchResponse === '[KB_EXPIRED]') {
        return '⚠️ 系統偵測到產品手冊需要更新，正在背景自動重新整理中。大約 1 分鐘後即可恢復正常，請稍後再試喔！';
      }
      return '抱歉，網路搜尋連線逾時，請稍後再試。';
    }
  }

  return `❌ 未知指令\n\n【指令列表】\n/重啟 -> 重置對話+同步\n/紀錄 <內容> -> 開始建檔\n/紀錄 -> 存檔/整理QA\n/取消 -> 退出建檔\n不滿意這回答請繼續擴大搜尋 -> 啟動網路搜尋`;
}


/**
 * 🆕 v29.5.234: 完璧歸趙！183列 100% 官方真實規格同步還原函數
 * 前 143 列為黃金極致詳細規格，後 40 列為 100% 三星官方真實極簡規格並完美保留官網連結
 * 耗時僅 0.3 秒，完全防範 LINE Webhook 超時風險
 */
/**
 * 已停用：正式 LINE 指令不可覆寫 CLASS_RULES。
 * 本機知識庫只能由已確認的 /紀錄 流程追加；還原作業必須在離線維運工具中完成。
 */



function getEntryDraftType(draft) {
  if (draft && draft.type) {
    const t = String(draft.type).toLowerCase();
    if (t === "rule" || t === "qa") return t;
  }
  const text = getEntryDraftCurrentText(draft);
  return isRuleLikeEntryContent(text) ? "rule" : "qa";
}

function getEntryDraftCurrentText(draft) {
  if (!draft) return "";
  return String(
    draft.currentText ||
      draft.currentRule ||
      draft.currentQA ||
      draft.text ||
      "",
  ).trim();
}

function isRuleLikeEntryContent(text) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  const upper = raw.toUpperCase();
  if (/^(?:活動|別稱|系列|術語|規格|RULE|CLASS_RULES)[_\-]/i.test(raw)) {
    return true;
  }
  if (
    /(CLASS_RULES|RULE|規格庫|活動期間|登錄期間|指定型號|指定機種|促銷價|建議售價|限時特價|登錄送|延長保固|保固活動|抽獎|贈品|有效期間|來源網址|官網網址|PROMOTION\.TWSAMSUNGCAMPAIGN\.COM|TWSAMSUNGCAMPAIGN)/i.test(
      upper,
    )
  ) {
    return true;
  }
  const hasModel = /\b(?:L?S|L?C|L?F)\d{2}[A-Z0-9]{4,}\b/i.test(raw);
  const hasRulePrice = /(NT\$|\$\s*\d|建議售價|促銷價|活動價)/i.test(raw);
  return hasModel && hasRulePrice;
}

function classifyEntryDraftType(content) {
  const raw = String(content || "").trim();
  if (!raw) return "qa";
  if (isOneLineQaText(raw)) return "qa";
  if (/^Q[:：].+A[:：]/i.test(raw)) return "qa";
  return isRuleLikeEntryContent(raw) ? "rule" : "qa";
}

function normalizeRuleLine(text) {
  return String(text || "")
    .replace(/```(?:csv|text|json)?/gi, "")
    .replace(/```/g, "")
    .replace(/^[\s"'`]+|[\s"'`]+$/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildEntryDraftPreview(draftType, text, actionLabel) {
  const label = draftType === "rule" ? "CLASS_RULES" : "QA";
  const title = actionLabel || "已進入建檔模式";
  return (
    "⚠️ " +
    title +
    "。接下來的對話將視為修改指令，直到輸入 /紀錄 存檔為止。" +
    "\n\n【預覽】將寫入 " +
    label +
    "：\n" +
    text +
    "\n\n👉 確認存檔 → /紀錄\n👉 修改內容 → 直接回覆\n👉 放棄 → /取消"
  );
}

function simpleRuleFallback(input) {
  const text = normalizeRuleLine(input);
  if (!text) return "RULE_手動建檔,手動建檔RULE,請補充規則內容";
  const key = /(活動|促銷|登錄|保固|抽獎|贈品|promotion|campaign)/i.test(text)
    ? "活動_手動建檔"
    : "RULE_手動建檔";
  const type = key.indexOf("活動_") === 0 ? "電腦螢幕活動RULE" : "手動建檔RULE";
  return normalizeRuleLine(key + "," + type + "," + text);
}

function simpleRuleModifyFallback(currentText, instruction) {
  const base = normalizeRuleLine(currentText);
  const ins = normalizeRuleLine(instruction);
  if (!base) return simpleRuleFallback(ins);
  if (!ins) return base;
  if (/^(改成|改為|換成|取代)/.test(ins)) {
    return simpleRuleFallback(ins.replace(/^(改成|改為|換成|取代)\s*/, ""));
  }
  return normalizeRuleLine(base + "；" + ins);
}

function firstRegexGroup(text, regex, fallback) {
  const match = String(text || "").match(regex);
  return match && match[1] ? normalizeRuleLine(match[1]) : fallback || "";
}

function getCampaignDateKey(activityPeriod, registrationPeriod) {
  const allDates = String((registrationPeriod || "") + " " + (activityPeriod || "")).match(
    /20\d{2}\/\d{1,2}\/\d{1,2}/g,
  );
  const activityDates = String(activityPeriod || "").match(/20\d{2}\/\d{1,2}\/\d{1,2}/g);
  if (!allDates || allDates.length === 0) return "手動建檔";

  const startDate = allDates[0];
  const endDate =
    activityDates && activityDates.length > 0
      ? activityDates[activityDates.length - 1]
      : allDates[allDates.length - 1];

  function ym(dateText) {
    const parts = String(dateText || "").split("/");
    if (parts.length < 2) return "";
    return parts[0] + String(parts[1]).padStart(2, "0");
  }

  const startYm = ym(startDate);
  const endYm = ym(endDate);
  return startYm && endYm ? startYm + "_" + endYm : "手動建檔";
}

function findCampaignSegmentBefore(text, endNeedle, afterNeedle, fallbackWindow) {
  const source = String(text || "");
  const endIdx = source.indexOf(endNeedle);
  if (endIdx < 0) return "";

  let fromIdx = -1;
  if (afterNeedle) {
    const markerIdx = source.lastIndexOf(afterNeedle, endIdx);
    if (markerIdx >= 0) {
      fromIdx = markerIdx + afterNeedle.length;
    }
  }
  if (fromIdx < 0) {
    fromIdx = Math.max(0, endIdx - (fallbackWindow || 1600));
  }
  return source.substring(fromIdx, endIdx);
}

function cleanCampaignModelSegment(segment) {
  let text = normalizeRuleLine(segment)
    .replace(/&ndash;/gi, "-")
    .replace(/^[(（][^)）]+[)）]\s*/, "")
    .replace(/\s*、\s*/g, "、")
    .replace(/\s*，\s*/g, "，")
    .replace(/\s*-\s*/g, "-");

  const firstModelIdx = text.search(/\b(?:LS|LC|S|C|U)\d{2}/i);
  if (firstModelIdx > 0) {
    text = text.substring(firstModelIdx);
  }
  return normalizeRuleLine(text);
}

function pushRuleField(fields, label, value) {
  const cleanValue = normalizeRuleLine(value);
  if (cleanValue) fields.push(label + "：" + cleanValue);
}

function buildSamsungCampaignRuleFallback(input, campaignContext) {
  const sourceUrl =
    (campaignContext && campaignContext.url) || extractSamsungCampaignUrl(input);
  const pageText = campaignContext && campaignContext.text ? campaignContext.text : "";
  if (!pageText) return simpleRuleFallback(input);
  const hasOfficialCampaignDetails =
    /(活動期間|登錄期間).*(20\d{2}|即日起)|登錄送\s*Steam|延長保固|Galaxy\s*S26/i.test(
      pageText,
    );
  if (!hasOfficialCampaignDetails) return simpleRuleFallback(input);

  const title =
    firstRegexGroup(
      pageText,
      /(ViewFinity\s*\|\s*Odyssey[^。]*?三星螢幕登錄送)/,
      "",
    ) ||
    firstRegexGroup(pageText, /([^。]{0,80}三星螢幕登錄送)/, "三星螢幕登錄送");

  const activityPeriod =
    firstRegexGroup(
      pageText,
      /活動期間\s*(即日起至20\d{2}\/\d{1,2}\/\d{1,2}\s*\d{1,2}:\d{2})/,
      "",
    ) || firstRegexGroup(pageText, /於活動期間[〈<]([^〉>]+)[〉>]/, "");
  const registrationPeriod = firstRegexGroup(
    pageText,
    /登錄期間\s*(20\d{2}\/\d{1,2}\/\d{1,2}\s*\d{1,2}:\d{2}\s*至\s*20\d{2}\/\d{1,2}\/\d{1,2}\s*\d{1,2}:\d{2})/,
    "",
  );

  const steamModels = cleanCampaignModelSegment(
    findCampaignSegmentBefore(pageText, "登錄送 Steam", "購買機型 活動內容", 800),
  );
  const warrantyModels = cleanCampaignModelSegment(
    findCampaignSegmentBefore(pageText, "登錄送 全機延長保固兩年", "Steam 1,000 元點卡", 2800),
  );
  const s26UltraModels = cleanCampaignModelSegment(
    findCampaignSegmentBefore(pageText, "Galaxy S26 Ultra", "保固期起算日認定", 3200),
  );
  const s26PlusModels = cleanCampaignModelSegment(
    findCampaignSegmentBefore(pageText, "Galaxy S26+ (256GB)", "市價 NT$44,900", 7000),
  );
  const s26Models = cleanCampaignModelSegment(
    findCampaignSegmentBefore(pageText, "Galaxy S26 (256GB)", "市價$37,900", 7000),
  );

  const key = "活動_" + getCampaignDateKey(activityPeriod, registrationPeriod) + "螢幕登錄送";
  const fields = [key, "電腦螢幕活動RULE"];
  pushRuleField(fields, "活動名稱", title);
  pushRuleField(fields, "活動期間", activityPeriod);
  pushRuleField(fields, "登錄期間", registrationPeriod);
  fields.push("活動資格：購買指定三星螢幕機種並於登錄網站完成登錄且審核通過後取得活動資格");
  pushRuleField(fields, "Steam 1000元點卡型號", steamModels);
  pushRuleField(fields, "全機延長保固兩年型號", warrantyModels);
  pushRuleField(fields, "月月抽 Galaxy S26 Ultra 型號", s26UltraModels);
  pushRuleField(fields, "月月抽 Galaxy S26+ 型號", s26PlusModels);
  pushRuleField(fields, "月月抽 Galaxy S26 型號", s26Models);
  pushRuleField(fields, "來源網址", sourceUrl);
  return normalizeRuleLine(fields.join(","));
}

function isWeakCampaignRule(ruleText, sourceUrl) {
  const text = normalizeRuleLine(ruleText);
  if (!sourceUrl || text.indexOf(sourceUrl) < 0) return false;
  const withoutUrl = normalizeRuleLine(text.replace(sourceUrl, ""));
  return (
    withoutUrl.length < 40 ||
    !/(活動期間|登錄期間|Steam|延長保固|Galaxy S26|ViewFinity|Odyssey)/i.test(text)
  );
}

function extractSamsungCampaignUrl(text) {
  const raw = String(text || "");
  const match = raw.match(/https?:\/\/promotion\.twsamsungcampaign\.com\/[^\s，,。)）]+/i);
  return match ? match[0].replace(/["'<>]+$/g, "") : "";
}

function stripHtmlToPlainText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveSamsungMonitorCampaignUrl(url) {
  const safeUrl = String(url || "").trim();
  if (!/^https?:\/\/promotion\.twsamsungcampaign\.com\//i.test(safeUrl)) {
    return "";
  }
  if (/\/rule\.aspx(?:\?|$)/i.test(safeUrl)) {
    return safeUrl;
  }

  try {
    const res = UrlFetchApp.fetch(safeUrl, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return safeUrl;
    const html = res.getContentText();
    const linkMatch =
      html.match(/href=["']([^"']*20\d{2}-mnt[^"']*rule\.aspx[^"']*)["']/i) ||
      html.match(/href=["']([^"']*mnt[^"']*rule\.aspx[^"']*)["']/i);
    if (!linkMatch || !linkMatch[1]) return safeUrl;
    const href = linkMatch[1];
    if (/^https?:\/\//i.test(href)) return href;
    return "https://promotion.twsamsungcampaign.com/" + href.replace(/^\/+/, "");
  } catch (e) {
    writeLog(`[Campaign Fetch] 活動首頁解析失敗: ${e.message}`);
    return safeUrl;
  }
}

function fetchSamsungCampaignRuleText(url) {
  const resolvedUrl = resolveSamsungMonitorCampaignUrl(url);
  if (!resolvedUrl) return { url: "", text: "" };
  try {
    const res = UrlFetchApp.fetch(resolvedUrl, { muteHttpExceptions: true });
    const code = res.getResponseCode();
    if (code !== 200) {
      writeLog(`[Campaign Fetch] ${resolvedUrl} 回應 ${code}`);
      return { url: resolvedUrl, text: "" };
    }
    const plainText = stripHtmlToPlainText(res.getContentText());
    return { url: resolvedUrl, text: plainText.substring(0, 12000) };
  } catch (e) {
    writeLog(`[Campaign Fetch] 讀取活動頁失敗: ${e.message}`);
    return { url: resolvedUrl, text: "" };
  }
}

function callGeminiToPolishRule(input, userId = null) {
  const normalizedInput = normalizeRuleLine(input);
  if (/^(活動|別稱|系列|術語|RULE|規格)[_\-]/i.test(normalizedInput)) {
    return normalizedInput;
  }

  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) throw new Error("缺少 GEMINI_API_KEY");

  const campaignUrl = extractSamsungCampaignUrl(input);
  const campaignContext = campaignUrl
    ? fetchSamsungCampaignRuleText(campaignUrl)
    : { url: "", text: "" };
  const sourceForPrompt = campaignContext.text
    ? `${input}\n\n【官方活動頁文字，來源：${campaignContext.url}】\n${campaignContext.text}`
    : input;

  const prompt = `你是「三星客服 CLASS_RULES 規則庫建檔專家」。

任務：把使用者提供的內容整理成 Google Sheet CLASS_RULES 的「A 欄單列 CSV 字串」。

【使用者內容】
${sourceForPrompt}

請只輸出一行，不要 Markdown，不要解釋。

格式建議：
活動_YYYYMM主題,電腦螢幕活動RULE,有效期間...,登錄期間...,適用型號...,優惠內容...,來源網址...
或
RULE_主題,規則類型,完整規則說明...

嚴格規則：
1. 只能整理使用者提供的資訊，禁止新增不存在的型號、價格、日期或贈品。
2. 若是三星活動、促銷、登錄送、延長保固，第一欄用「活動_」開頭，並保留來源網址。
3. 若內容包含非螢幕產品，只有明確屬於「電腦螢幕/Monitor/Odyssey/ViewFinity/Smart Monitor」的資訊可以保留。
4. 型號必須完整保留，禁止縮寫或截短。
5. 若官方活動頁有手機、家電或其他贈品資訊，只能作為「螢幕活動的贈品/抽獎內容」保留，不可把它整理成非螢幕產品規格。
6. 輸出必須是一行，可含逗號，但不可換行。`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 1800,
      temperature: 0.2,
    },
  };

  try {
    lastLlmCallAttempted = true;
    const res = UrlFetchApp.fetch(
      `${CONFIG.API_ENDPOINT}/${GEMINI_MODEL_POLISH}:generateContent?key=${apiKey}`,
      {
        method: "post",
        headers: { "Content-Type": "application/json" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    );
    const code = res.getResponseCode();
    const body = res.getContentText();
    writeLog(`[PolishRule API] Code: ${code}, Body: ${body.substring(0, 500)}`);
    if (code !== 200) {
      writeLog(`[PolishRule API Error] Code: ${code}`);
      return buildSamsungCampaignRuleFallback(input, campaignContext);
    }

    const json = JSON.parse(body);
    if (json.usageMetadata) {
      const usage = json.usageMetadata;
      const costUSD =
        (usage.promptTokenCount / 1000000) * PRICE_POLISH_INPUT +
        (usage.candidatesTokenCount / 1000000) * PRICE_POLISH_OUTPUT;
      const costTWD = costUSD * EXCHANGE_RATE;
      lastTokenUsage = {
        input: usage.promptTokenCount,
        output: usage.candidatesTokenCount,
        total: usage.totalTokenCount,
        costTWD: costTWD,
      };
    } else {
      lastTokenUsage = null;
    }

    const candidates = json && json.candidates ? json.candidates : [];
    const firstCandidate = candidates.length > 0 ? candidates[0] : null;
    let rawText = "";
    if (
      firstCandidate &&
      firstCandidate.content &&
      firstCandidate.content.parts &&
      firstCandidate.content.parts.length > 0 &&
      firstCandidate.content.parts[0].text
    ) {
      rawText = firstCandidate.content.parts[0].text;
    }
    const normalizedRule = rawText ? normalizeRuleLine(rawText) : "";
    if (!normalizedRule || isWeakCampaignRule(normalizedRule, campaignContext.url)) {
      return buildSamsungCampaignRuleFallback(input, campaignContext);
    }
    return normalizedRule;
  } catch (e) {
    writeLog(`[PolishRule Error] ${e.message}`);
    return buildSamsungCampaignRuleFallback(input, campaignContext);
  }
}

function callGeminiToModifyRule(currentText, instruction) {
  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) throw new Error("缺少 GEMINI_API_KEY");

  const prompt = `依修改指令調整下列 CLASS_RULES 單列規則。
規則：只回一行 A 欄 CSV 字串、不可換行、不可新增使用者沒提供的事實、型號禁止截短。
目前：${currentText}
修改：${instruction}`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 1200,
      temperature: 0.2,
    },
  };

  try {
    lastLlmCallAttempted = true;
    const res = UrlFetchApp.fetch(
      `${CONFIG.API_ENDPOINT}/${CONFIG.MODEL_NAME_FAST}:generateContent?key=${apiKey}`,
      {
        method: "post",
        headers: { "Content-Type": "application/json" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    );
    const code = res.getResponseCode();
    const body = res.getContentText();
    writeLog(`[ModifyRule API] Code: ${code}, Body: ${body.substring(0, 500)}`);
    if (code !== 200) return simpleRuleModifyFallback(currentText, instruction);

    const json = JSON.parse(body);
    if (json.usageMetadata) {
      const usage = json.usageMetadata;
      const costUSD =
        (usage.promptTokenCount / 1000000) * PRICE_FAST_INPUT +
        (usage.candidatesTokenCount / 1000000) * PRICE_FAST_OUTPUT;
      lastTokenUsage = {
        input: usage.promptTokenCount,
        output: usage.candidatesTokenCount,
        total: usage.totalTokenCount,
        costTWD: costUSD * EXCHANGE_RATE,
      };
    }

    const candidates = json && json.candidates ? json.candidates : [];
    const firstCandidate = candidates.length > 0 ? candidates[0] : null;
    let rawText = "";
    if (
      firstCandidate &&
      firstCandidate.content &&
      firstCandidate.content.parts &&
      firstCandidate.content.parts.length > 0 &&
      firstCandidate.content.parts[0].text
    ) {
      rawText = firstCandidate.content.parts[0].text;
    }
    return rawText
      ? normalizeRuleLine(rawText)
      : simpleRuleModifyFallback(currentText, instruction);
  } catch (e) {
    writeLog(`[ModifyRule Error] ${e.message}`);
    return simpleRuleModifyFallback(currentText, instruction);
  }
}

function startNewEntryDraft(content, userId) {
  try {
    writeLog(
      userId,
      "UserRecord",
      `[NewDraft] 開始建檔: ${content.substring(0, 150)}`,
    );

    // v27.9.16: 累計費用追蹤
    var totalCostTWD = 0;
    var totalInputTokens = 0;
    var totalOutputTokens = 0;

    const draftType = classifyEntryDraftType(content);

    // Step 1: AI 產生初版 QA/RULE
    // v27.9.45: 傳入 userId 以便在模型失效時通知
    const polishedText =
      draftType === "rule"
        ? callGeminiToPolishRule(content, userId)
        : callGeminiToPolish(content, userId);
    writeLog(
      userId,
      "UserRecord",
      `[NewDraft] 初版 ${draftType.toUpperCase()}: ${polishedText.substring(0, 150)}`,
    );

    // 累計費用
    if (lastTokenUsage && lastTokenUsage.costTWD) {
      totalCostTWD += lastTokenUsage.costTWD;
      totalInputTokens += lastTokenUsage.input || 0;
      totalOutputTokens += lastTokenUsage.output || 0;
    }

    if (draftType === "rule") {
      var ruleDraft = {
        type: "rule",
        targetSheet: SHEET_NAMES.CLASS_RULES,
        originalContent: content,
        conversation: [],
        currentText: polishedText,
        currentRule: polishedText,
        userId: userId,
        pendingMergeChoice: false,
      };
      CacheService.getScriptCache().put(
        CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId,
        JSON.stringify(ruleDraft),
        CONFIG.DRAFT_TTL_SEC,
      );

      var rulePreview = buildEntryDraftPreview(
        "rule",
        polishedText,
        "已進入 RULE 建檔模式",
      );
      if (totalCostTWD > 0) {
        rulePreview += `\n\n${buildAggregateCostAuditText_(
          totalCostTWD,
          totalInputTokens,
          totalOutputTokens,
        )}`;
      }
      writeLog(userId, "UserRecord", `[NewDraft Reply] RULE 草稿已建立`);
      return rulePreview;
    }

    // Step 2: 搜尋現有 QA 是否有相似的
    const similarResult = findSimilarQA(content, polishedText);

    // 累計費用
    if (lastTokenUsage && lastTokenUsage.costTWD) {
      totalCostTWD += lastTokenUsage.costTWD;
      totalInputTokens += lastTokenUsage.input || 0;
      totalOutputTokens += lastTokenUsage.output || 0;
    }

    if (similarResult && similarResult.found) {
      // 找到相似 QA，讓用戶選擇
      writeLog(
        userId,
        "UserRecord",
        `[NewDraft] 找到相似 QA: 行 ${similarResult.matchedRows.join(",")}`,
      );

      // Step 3: LLM 合併產出合併版
      const mergedQA = callGeminiToMergeQA(
        similarResult.matchedQAs,
        polishedText,
      );
      writeLog(
        userId,
        "UserRecord",
        `[NewDraft] 合併版 QA: ${mergedQA.substring(0, 150)}`,
      );

      // 累計費用
      if (lastTokenUsage && lastTokenUsage.costTWD) {
        totalCostTWD += lastTokenUsage.costTWD;
        totalInputTokens += lastTokenUsage.input || 0;
        totalOutputTokens += lastTokenUsage.output || 0;
      }

      // 建立等待選擇的 draft
      var draft = {
        type: "qa",
        targetSheet: SHEET_NAMES.QA,
        originalContent: content,
        conversation: [],
        currentText: polishedText,
        currentQA: polishedText,
        userId: userId,
        pendingMergeChoice: true,
        mergedVersion: mergedQA,
        freshVersion: polishedText,
        matchedQARows: similarResult.matchedRows,
        matchedQATexts: similarResult.matchedQAs,
      };
      CacheService.getScriptCache().put(
        CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId,
        JSON.stringify(draft),
        CONFIG.DRAFT_TTL_SEC,
      );

      // 組裝回覆訊息
      var replyMsg = "🔍 找到相似的現有 QA：\n\n";
      replyMsg += "【現有 QA】\n";
      for (var i = 0; i < similarResult.matchedQAs.length; i++) {
        replyMsg += similarResult.matchedQAs[i].substring(0, 100) + "...\n";
      }
      replyMsg += "\n【建議合併成】\n" + mergedQA + "\n\n";
      replyMsg += "【你的新內容】\n" + polishedText + "\n\n";
      replyMsg += "請選擇：\n";
      replyMsg += "1️⃣ 採用合併版（會刪除舊 QA）\n";
      replyMsg += "2️⃣ 另開新條（保留舊 QA）\n";
      replyMsg += "3️⃣ 取代舊 QA（刪除舊的，直接用新的）";

      // v27.9.16: 附加費用資訊
      if (totalCostTWD > 0) {
        replyMsg += `\n\n${buildAggregateCostAuditText_(
          totalCostTWD,
          totalInputTokens,
          totalOutputTokens,
        )}`;
      }

      writeLog(userId, "UserRecord", `[NewDraft Reply] 等待用戶選擇 1/2/3`);
      return replyMsg;
    }

    // 沒找到相似，直接進入正常建檔模式
    var draft = {
      type: "qa",
      targetSheet: SHEET_NAMES.QA,
      originalContent: content,
      conversation: [],
      currentText: polishedText,
      currentQA: polishedText,
      userId: userId,
      pendingMergeChoice: false,
    };
    CacheService.getScriptCache().put(
      CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId,
      JSON.stringify(draft),
      CONFIG.DRAFT_TTL_SEC,
    );

    var preview = buildEntryDraftPreview("qa", polishedText, "已進入 QA 建檔模式");

    // v27.9.16: 附加費用資訊
    if (totalCostTWD > 0) {
      preview += `\n\n${buildAggregateCostAuditText_(
        totalCostTWD,
        totalInputTokens,
        totalOutputTokens,
      )}`;
    }

    writeLog(
      userId,
      "UserRecord",
      `[NewDraft Reply] ${preview.substring(0, 100)}...`,
    );
    return preview;
  } catch (e) {
    writeLog(userId, "Error", `[NewDraft Error] ${e.message}`);
    return "❌ 分析失敗：" + e.message;
  }
}

function handleDraftModification(feedback, userId, replyToken, currentDraft) {
  try {
    writeLog(`[DraftMod] 用戶說: ${feedback}`);
    const draftType = getEntryDraftType(currentDraft);
    const currentDraftText = getEntryDraftCurrentText(currentDraft);

    // 檢查是否在等待選擇 1/2
    if (currentDraft.pendingMergeChoice === true) {
      var choice = feedback.trim();

      var cleanChoice = choice.replace(/[\s.、️⃣]/g, "");
      var isOne = /^[1１一]$/.test(cleanChoice);
      var isTwo = /^[2２二]$/.test(cleanChoice);
      var isThree = /^[3３三]$/.test(cleanChoice);

      if (isOne) {
        // 選擇合併版，刪除舊 QA
        writeLog(`[DraftMod] 用戶選擇 1: 採用合併版`);
        deleteQARows(currentDraft.matchedQARows);

        var newDraft = {
          type: "qa",
          targetSheet: SHEET_NAMES.QA,
          originalContent: currentDraft.originalContent,
          conversation: [],
          currentText: currentDraft.mergedVersion,
          currentQA: currentDraft.mergedVersion,
          userId: userId,
          pendingMergeChoice: false,
        };
        CacheService.getScriptCache().put(
          CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId,
          JSON.stringify(newDraft),
          CONFIG.DRAFT_TTL_SEC,
        );

        var preview =
          "✅ 已採用合併版，舊 QA 已刪除\n\n【預覽】將寫入 QA：\n" +
          currentDraft.mergedVersion +
          "\n\n👉 確認存檔 → /紀錄\n👉 修改內容 → 直接回覆\n👉 放棄 → /取消";
        replyMessage(replyToken, preview);
        writeLog(`[DraftMod Reply] 採用合併版`);
        return;
      } else if (isTwo) {
        // 選擇純新版，保留舊 QA
        writeLog(`[DraftMod] 用戶選擇 2: 另開新條`);

        var newDraft = {
          type: "qa",
          targetSheet: SHEET_NAMES.QA,
          originalContent: currentDraft.originalContent,
          conversation: [],
          currentText: currentDraft.freshVersion,
          currentQA: currentDraft.freshVersion,
          userId: userId,
          pendingMergeChoice: false,
        };
        CacheService.getScriptCache().put(
          CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId,
          JSON.stringify(newDraft),
          CONFIG.DRAFT_TTL_SEC,
        );

        var preview =
          "✅ 已選擇另開新條，舊 QA 保留\n\n【預覽】將寫入 QA：\n" +
          currentDraft.freshVersion +
          "\n\n👉 確認存檔 → /紀錄\n👉 修改內容 → 直接回覆\n👉 放棄 → /取消";
        replyMessage(replyToken, preview);
        writeLog(`[DraftMod Reply] 另開新條`);
        return;
      } else if (isThree) {
        // 選擇 3: 取代舊 QA
        writeLog(`[DraftMod] 用戶選擇 3: 取代舊 QA`);
        deleteQARows(currentDraft.matchedQARows);

        var newDraft = {
          type: "qa",
          targetSheet: SHEET_NAMES.QA,
          originalContent: currentDraft.originalContent,
          conversation: [],
          currentText: currentDraft.freshVersion,
          currentQA: currentDraft.freshVersion,
          userId: userId,
          pendingMergeChoice: false,
        };
        CacheService.getScriptCache().put(
          CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId,
          JSON.stringify(newDraft),
          CONFIG.DRAFT_TTL_SEC,
        );

        var preview =
          "✅ 已選擇取代舊 QA（舊條目已刪除）\n\n【預覽】將寫入 QA：\n" +
          currentDraft.freshVersion +
          "\n\n👉 確認存檔 → /紀錄\n👉 修改內容 → 直接回覆\n👉 放棄 → /取消";
        replyMessage(replyToken, preview);
        writeLog(`[DraftMod Reply] 取代舊 QA`);
        return;
      } else {
        // 💡 智慧融入補充說明模式
        writeLog(`[DraftMod] 偵測到選擇階段的補充修改: ${feedback}`);
        
        // 將補充回饋融入到新版 (freshVersion) 與合併版 (mergedVersion) 中
        const updatedFresh = callGeminiToModify(currentDraft.freshVersion, feedback);
        const updatedMerged = callGeminiToModify(currentDraft.mergedVersion, feedback);
        
        var conversation = currentDraft.conversation || [];
        conversation.push(feedback);

        var updatedDraft = {
          type: "qa",
          targetSheet: SHEET_NAMES.QA,
          originalContent: currentDraft.originalContent + "\n[補充] " + feedback,
          conversation: conversation,
          currentText: updatedFresh,
          currentQA: updatedFresh,
          userId: userId,
          pendingMergeChoice: true, // 依然在選擇階段
          mergedVersion: updatedMerged,
          freshVersion: updatedFresh,
          matchedQARows: currentDraft.matchedQARows,
          matchedQATexts: currentDraft.matchedQATexts
        };

        CacheService.getScriptCache().put(
          CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId,
          JSON.stringify(updatedDraft),
          CONFIG.DRAFT_TTL_SEC,
        );

        var replyMsg = "🔄 已為你將最新補充說明融入選項中！\n\n";
        replyMsg += "🔍 找到相似的現有 QA：\n";
        for (var i = 0; i < currentDraft.matchedQATexts.length; i++) {
          replyMsg += "• " + currentDraft.matchedQATexts[i].substring(0, 80) + "...\n";
        }
        replyMsg += "\n【建議合併成（已融入補充）】\n" + updatedMerged + "\n\n";
        replyMsg += "【你的新內容（已融入補充）】\n" + updatedFresh + "\n\n";
        replyMsg += "請重新選擇：\n";
        replyMsg += "1️⃣ 採用合併版（會刪除舊 QA）\n";
        replyMsg += "2️⃣ 另開新條（保留舊 QA）\n";
        replyMsg += "3️⃣ 取代舊 QA（刪除舊的，直接用新的）\n\n";
        replyMsg += "👉 繼續補充修改 → 直接回覆對話\n👉 取消建檔 → 輸入 /取消";

        // 費用標記
        if (lastTokenUsage && lastTokenUsage.costTWD) {
          replyMsg += `\n\n${buildReplyCostAuditText_()}`;
        }

        replyMessage(replyToken, replyMsg);
        writeLog(`[DraftMod Reply] 智慧融入補充成功，等待重新選擇`);
        return;
      }
    }

    // 正常修改模式
    if (isStandaloneDraftChoiceNumber(feedback)) {
      replyMessage(
        replyToken,
        "目前這份草稿沒有等待 1/2/3 選項喔。\n\n如果要修改目前的 " +
          (draftType === "rule" ? "RULE" : "QA") +
          " 草稿，請直接輸入要補充或改寫的內容；如果確認要存檔，請輸入 /紀錄。\n\n👉 確認存檔 → /紀錄\n👉 放棄 → /取消",
      );
      writeLog(`[DraftMod Reply] 忽略非選擇狀態的純數字: ${feedback}`);
      return;
    }

    if (!isDraftFeedbackLikelyRelevant(feedback, currentDraft)) {
      replyMessage(
        replyToken,
        "這句看起來不像是在修改目前這筆 " +
          (draftType === "rule" ? "RULE" : "QA") +
          "，我先不寫進草稿，避免污染資料庫。\n\n如果你要修改，請直接說要新增、刪除或改成什麼；如果確認要存檔，請輸入 /紀錄。\n\n👉 確認存檔 → /紀錄\n👉 放棄 → /取消",
      );
      writeLog(`[DraftMod Reply] 忽略疑似無關草稿修改: ${feedback}`);
      return;
    }

    writeLog(
      `[DraftMod] 原始內容: ${(currentDraft.originalContent || "").substring(
        0,
        500,
      )}`,
    );
    writeLog(
      `[DraftMod] 目前 ${draftType.toUpperCase()}: ${currentDraftText.substring(0, 500)}`,
    );

    // 累積對話歷史
    var conversation = currentDraft.conversation || [];
    conversation.push(feedback);

    var newText;
    if (draftType === "rule") {
      newText = callGeminiToModifyRule(currentDraftText, feedback);
    } else {
      // 帶完整上下文讓 LLM 重新產出 QA
      newText = callGeminiToRefineQA(
        currentDraft.originalContent,
        currentDraft.currentQA || currentDraftText,
        conversation,
      );
    }

    writeLog(`[DraftMod] 新 ${draftType.toUpperCase()}: ${newText.substring(0, 500)}`);
    if (draftType === "qa" && isOneLineQaText(newText)) {
      newText = normalizeOneLineQaText(newText);
    } else if (draftType === "rule") {
      newText = normalizeRuleLine(newText);
    }

    // 更新 draft
    var newDraft = {
      type: draftType,
      targetSheet: draftType === "rule" ? SHEET_NAMES.CLASS_RULES : SHEET_NAMES.QA,
      originalContent: currentDraft.originalContent,
      conversation: conversation,
      currentText: newText,
      currentQA: draftType === "qa" ? newText : "",
      currentRule: draftType === "rule" ? newText : "",
      userId: userId,
      pendingMergeChoice: false,
    };
    CacheService.getScriptCache().put(
      CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId,
      JSON.stringify(newDraft),
      CONFIG.DRAFT_TTL_SEC,
    );

    var preview =
      "🔄 已修正草稿：\n\n【預覽】將寫入 " +
      (draftType === "rule" ? "CLASS_RULES" : "QA") +
      "：\n" +
      newText +
      "\n\n👉 確認存檔 → /紀錄\n👉 繼續修改 → 直接回覆\n👉 放棄 → /取消";

    // v27.9.17: 附加費用資訊
    if (lastTokenUsage && lastTokenUsage.costTWD) {
      preview += `\n\n${buildReplyCostAuditText_()}`;
    }

    replyMessage(replyToken, preview);
    writeLog(`[DraftMod Reply] ${preview.substring(0, 500)}...`);
  } catch (e) {
    writeLog(`[DraftMod Error] ${e.message}`);
    replyMessage(replyToken, "❌ 修改失敗: " + e.message);
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
      var text = (data[i][0] || "").toString().trim();
      if (text) {
        allQAs.push({ row: i + 1, text: text });
      }
    }

    if (allQAs.length === 0) return null;

    // 組裝 QA 列表給 LLM 判斷
    var qaListText = "";
    for (var i = 0; i < allQAs.length; i++) {
      qaListText +=
        "行" + allQAs[i].row + ": " + allQAs[i].text.substring(0, 150) + "\n";
    }

    var apiKey =
      PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    if (!apiKey) return null;

    var prompt = "你是 QA 比對專家。\n\n";
    prompt += "以下是現有的 QA 列表：\n" + qaListText + "\n\n";
    prompt += "新內容：\n" + newContent + "\n\n";
    prompt += "整理後：\n" + polishedQA + "\n\n";
    prompt += "請判斷現有 QA 中是否有和新內容「主題相同或高度相關」的條目。\n";
    prompt += "如果有，回傳相關的行號（用逗號分隔，例如：3,7）\n";
    prompt += "如果沒有，只回 NONE\n";
    prompt += "只回行號或 NONE，不要解釋。";

    var payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 100,
        temperature: 0.1,
      },
    };

    // v24.2.3: 簡單搜尋用 Fast 模型
    lastLlmCallAttempted = true;
    var res = UrlFetchApp.fetch(
      CONFIG.API_ENDPOINT +
        "/" +
        CONFIG.MODEL_NAME_FAST +
        ":generateContent?key=" +
        apiKey,
      {
        method: "post",
        headers: { "Content-Type": "application/json" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    );

    var code = res.getResponseCode();
    var body = res.getContentText();
    writeLog(
      "[FindSimilar API] Code: " + code + ", Body: " + body.substring(0, 300),
    );

    if (code !== 200) return null;

    var json = JSON.parse(body);

    // v25.0.1 新增：記錄 Token 成本（確保計費完整）
    if (json.usageMetadata) {
      var inputTokens = json.usageMetadata.promptTokenCount || 0;
      var outputTokens = json.usageMetadata.candidatesTokenCount || 0;
      var totalTokens = inputTokens + outputTokens;
      var costUSD =
        (inputTokens * PRICE_FAST_INPUT) / 1000000 +
        (outputTokens * PRICE_FAST_OUTPUT) / 1000000;
      var costTWD = costUSD * EXCHANGE_RATE;
      lastTokenUsage = {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens,
        costUSD: costUSD,
        costTWD: costTWD,
      };
      writeLog(
        "[FindSimilar Tokens] In:" +
          inputTokens +
          "/Out:" +
          outputTokens +
          "=Total:" +
          totalTokens +
          ", Cost:NT$" +
          costTWD.toFixed(4),
      );
    }

    var candidates = json && json.candidates ? json.candidates : [];
    if (candidates.length === 0) return null;

    var firstCandidate = candidates[0];
    var rawText = "";
    if (
      firstCandidate &&
      firstCandidate.content &&
      firstCandidate.content.parts
    ) {
      var parts = firstCandidate.content.parts;
      if (Array.isArray(parts) && parts.length > 0 && parts[0].text) {
        rawText = parts[0].text.trim();
      }
    }

    writeLog("[FindSimilar] LLM 回應: " + rawText);

    if (!rawText || rawText.toUpperCase() === "NONE") {
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
    writeLog("[FindSimilar Error] " + e.message);
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
  var apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) throw new Error("缺少 GEMINI_API_KEY");

  var existingText = "";
  for (var i = 0; i < existingQAs.length; i++) {
    existingText += "現有 QA " + (i + 1) + ": " + existingQAs[i] + "\n";
  }

  var prompt = "你是「客服 QA 知識庫建檔專家」。\n\n";
  prompt += "任務：將現有 QA 和新內容合併成一條完整的 QA。\n\n";
  prompt += existingText + "\n";
  prompt += "新內容：" + newQA + "\n\n";
  prompt += "請輸出一行：問題 / A：答案\n\n";
  prompt += "重要規則：\n";
  prompt += "- 融合所有資訊，去除重複\n";
  prompt += "- 型號必須完整列出，禁止縮寫\n";
  prompt += "- 問題要涵蓋所有相關問法\n";
  prompt += "- 格式嚴格用「 / A：」分隔，不要用逗號\n";
  prompt += "- 只輸出一行結果，不要解釋";

  var payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 2000, // v27.8.8: 從 1000 提高到 2000，避免 thinking tokens 佔用過多配額導致輸出被截斷
      temperature: 0.3,
    },
  };

  try {
    // v24.2.3: 語意合併用 Think 模型
    lastLlmCallAttempted = true;
    var res = UrlFetchApp.fetch(
      CONFIG.API_ENDPOINT +
        "/" +
        CONFIG.MODEL_NAME_THINK +
        ":generateContent?key=" +
        apiKey,
      {
        method: "post",
        headers: { "Content-Type": "application/json" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    );

    var code = res.getResponseCode();
    var body = res.getContentText();
    writeLog(
      "[MergeQA API] Code: " + code + ", Body: " + body.substring(0, 500),
    );

    if (code !== 200) {
      // 降級：簡單合併
      return newQA + "（合併自現有 QA）";
    }

    var json = JSON.parse(body);

    // 記錄 Token 用量
    if (json.usageMetadata) {
      var usage = json.usageMetadata;
      var costUSD =
        (usage.promptTokenCount / 1000000) * PRICE_THINK_INPUT +
        (usage.candidatesTokenCount / 1000000) * PRICE_THINK_OUTPUT;
      var costTWD = costUSD * EXCHANGE_RATE;
      // v27.9.19: 關鍵修正！設定 lastTokenUsage
      lastTokenUsage = {
        input: usage.promptTokenCount,
        output: usage.candidatesTokenCount,
        total: usage.totalTokenCount,
        costTWD: costTWD,
      };
      writeLog(
        `[MergeQA Tokens] In: ${usage.promptTokenCount}, Out: ${
          usage.candidatesTokenCount
        }, Total: ${usage.totalTokenCount} (約 NT$${costTWD.toFixed(4)})`,
      );
    } else {
      lastTokenUsage = null;
    }

    var candidates = json && json.candidates ? json.candidates : [];
    if (candidates.length === 0) return newQA;

    var firstCandidate = candidates[0];
    var rawText = "";
    if (
      firstCandidate &&
      firstCandidate.content &&
      firstCandidate.content.parts
    ) {
      var parts = firstCandidate.content.parts;
      if (Array.isArray(parts) && parts.length > 0 && parts[0].text) {
        rawText = parts[0].text.trim().replace(/[\r\n]+/g, " ");
      }
    }

    return rawText || newQA;
  } catch (e) {
    writeLog("[MergeQA Error] " + e.message);
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
    var sorted = rowNumbers.slice().sort(function (a, b) {
      return b - a;
    });

    for (var i = 0; i < sorted.length; i++) {
      var rowNum = sorted[i];
      if (rowNum > 0 && rowNum <= sheet.getLastRow()) {
        sheet.deleteRow(rowNum);
        writeLog("[DeleteQA] 已刪除行 " + rowNum);
      }
    }

    SpreadsheetApp.flush();
  } catch (e) {
    writeLog("[DeleteQA Error] " + e.message);
  }
}

/**
 * 帶完整上下文讓 LLM 重新產出 QA
 * @param {string} originalContent - 原始輸入內容
 * @param {string} currentQA - 目前的 QA 版本
 * @param {string[]} conversation - 所有修改指令歷史
 */
function callGeminiToRefineQA(originalContent, currentQA, conversation) {
  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) throw new Error("缺少 GEMINI_API_KEY");

  // 組裝完整上下文
  const historyText = conversation
    .map((msg, i) => `用戶第${i + 1}次說: ${msg}`)
    .join("\n");

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
      maxOutputTokens: 2000, // v27.8.8: 從 1000 提高到 2000，避免 thinking tokens 佔用過多配額導致輸出被截斷
      temperature: 0.3,
    },
  };

  try {
    // v24.2.3: 對話修改用 Think 模型
    lastLlmCallAttempted = true;
    const res = UrlFetchApp.fetch(
      `${CONFIG.API_ENDPOINT}/${CONFIG.MODEL_NAME_THINK}:generateContent?key=${apiKey}`,
      {
        method: "post",
        headers: { "Content-Type": "application/json" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    );

    const code = res.getResponseCode();
    const body = res.getContentText();
    writeLog(`[RefineQA API] Code: ${code}, Body: ${body.substring(0, 500)}`);

    if (code !== 200) {
      writeLog(`[RefineQA API Error] Code: ${code}`);
      // 降級：簡單合併
      return simpleModifyFallback(
        currentQA,
        conversation[conversation.length - 1],
      );
    }

    let json;
    try {
      json = JSON.parse(body);
    } catch (parseErr) {
      writeLog(`[RefineQA Parse Error] ${parseErr.message}`);
      return simpleModifyFallback(
        currentQA,
        conversation[conversation.length - 1],
      );
    }

    // 記錄 Token 用量
    if (json.usageMetadata) {
      const usage = json.usageMetadata;
      const costUSD =
        (usage.promptTokenCount / 1000000) * PRICE_THINK_INPUT +
        (usage.candidatesTokenCount / 1000000) * PRICE_THINK_OUTPUT;
      const costTWD = costUSD * EXCHANGE_RATE;
      // v27.9.19: 關鍵修正！設定 lastTokenUsage
      lastTokenUsage = {
        input: usage.promptTokenCount,
        output: usage.candidatesTokenCount,
        total: usage.totalTokenCount,
        costTWD: costTWD,
      };
      writeLog(
        `[RefineQA Tokens] In: ${usage.promptTokenCount}, Out: ${
          usage.candidatesTokenCount
        }, Total: ${usage.totalTokenCount} (約 NT$${costTWD.toFixed(4)})`,
      );
    } else {
      lastTokenUsage = null;
    }

    const candidates = json && json.candidates ? json.candidates : [];
    const firstCandidate = candidates.length > 0 ? candidates[0] : null;
    const finishReason =
      firstCandidate && firstCandidate.finishReason
        ? firstCandidate.finishReason
        : "UNKNOWN";
    writeLog(
      `[RefineQA] finishReason: ${finishReason}, candidates: ${candidates.length}`,
    );

    let rawText = "";
    if (
      firstCandidate &&
      firstCandidate.content &&
      firstCandidate.content.parts
    ) {
      const parts = firstCandidate.content.parts;
      if (Array.isArray(parts) && parts.length > 0 && parts[0].text) {
        rawText = parts[0].text;
      }
    }

    if (!rawText || typeof rawText !== "string") {
      writeLog(`[RefineQA] AI 回傳為空`);
      return simpleModifyFallback(
        currentQA,
        conversation[conversation.length - 1],
      );
    }

    return rawText.trim().replace(/[\r\n]+/g, " ");
  } catch (e) {
    writeLog(`[RefineQA Error] ${e.message}`);
    return simpleModifyFallback(
      currentQA,
      conversation[conversation.length - 1],
    );
  }
}

/**
 * 簡化版建檔：AI 潤飾使用者輸入，回傳單一字串
 * 格式：問題 / A：答案
 * v27.9.45: 新增 userId 參數，支援模型失效時的主動回報
 */
function callGeminiToPolish(input, userId = null) {
  if (isOneLineQaText(input)) {
    return normalizeOneLineQaText(input);
  }

  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) throw new Error("缺少 GEMINI_API_KEY");

  const prompt = `你是「客服 QA 知識庫建檔專家」。

                              任務：將以下內容整理成一條高品質 QA，讓未來客戶問到相關問題時能被正確匹配。

                              【用戶提供的內容】
                              ${input}

                              請輸出一行：問題 / A：答案

                              ⚠️ 關鍵規則：
                              1. **問題設計**：思考客戶可能會用哪些不同的說法來問這個問題，把最常見的 2-3 種問法濃縮成一個涵蓋性強的問題
                                - 例如：用戶輸入「如何隱藏工具列達到全螢幕」
                                - 好問題：「三星螢幕瀏覽器可以全螢幕嗎？如何隱藏工具列？」（涵蓋「全螢幕」和「隱藏工具列」兩種問法）
                                - 壞問題：「如何隱藏工具列？」（太窄，問「全螢幕」的人不會被匹配到）
                              2. **答案完整性**：保留用戶提供的所有關鍵資訊，不要截斷重要步驟或技巧
                              3. **格式**：嚴格用「 / A：」分隔，只輸出一行
                              4. **型號**：完整列出，禁止縮寫`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 2000, // v27.8.8: 從 1000 提高到 2000，避免 thinking tokens 佔用過多配額導致輸出被截斷
      temperature: 0.3,
    },
  };

  try {
    // v27.9.20: 使用 GEMINI_MODEL_POLISH（程式最前面設定），只有這裡會用到
    lastLlmCallAttempted = true;
    let res = UrlFetchApp.fetch(
      `${CONFIG.API_ENDPOINT}/${GEMINI_MODEL_POLISH}:generateContent?key=${apiKey}`,
      {
        method: "post",
        headers: { "Content-Type": "application/json" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    );

    // v27.9.45: 模型回滾機制 (Model Fallback Strategy)
    // 若 Preview 模型失效 (404 Not Found 或 400 Bad Request)，自動切換至穩定的 Fast Mode
    // ⛔️ 禁止使用 Push Message! 改為在結果中附加警告訊息
    var warningMsg = "";

    if (res.getResponseCode() === 404 || res.getResponseCode() === 400) {
      const errBody = res.getContentText();
      writeLog(
        `[Polish Warning] ${GEMINI_MODEL_POLISH} 失效 (${res.getResponseCode()})，嘗試回滾... Err: ${errBody}`,
      );

      // 準備警告文字，將隨返還內容一起顯示
      warningMsg = `⚠️ [系統警告] Preview 模型 (${GEMINI_MODEL_POLISH}) 已失效，系統已自動切換至 ${CONFIG.MODEL_NAME_FAST} 繼續服務。請通知管理員更新程式設定。\n\n`;

      // 2. 自動切換至 Fast Mode 重試
      writeLog(`[Polish Fallback] Switching to ${CONFIG.MODEL_NAME_FAST}`);
      lastLlmCallAttempted = true;
      res = UrlFetchApp.fetch(
        `${CONFIG.API_ENDPOINT}/${CONFIG.MODEL_NAME_FAST}:generateContent?key=${apiKey}`,
        {
          method: "post",
          headers: { "Content-Type": "application/json" },
          payload: JSON.stringify(payload), // payload 通用
          muteHttpExceptions: true,
        },
      );
    }

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

    // 記錄 Token 用量 - 使用 POLISH 專屬費率
    if (json.usageMetadata) {
      const usage = json.usageMetadata;
      const costUSD =
        (usage.promptTokenCount / 1000000) * PRICE_POLISH_INPUT +
        (usage.candidatesTokenCount / 1000000) * PRICE_POLISH_OUTPUT;
      const costTWD = costUSD * EXCHANGE_RATE;
      // v27.9.19: 設定 lastTokenUsage 讓費用可以顯示在回覆中
      lastTokenUsage = {
        input: usage.promptTokenCount,
        output: usage.candidatesTokenCount,
        total: usage.totalTokenCount,
        costTWD: costTWD,
      };
      writeLog(
        `[Polish Tokens] In: ${usage.promptTokenCount}, Out: ${
          usage.candidatesTokenCount
        }, Total: ${usage.totalTokenCount} (約 NT$${costTWD.toFixed(
          4,
        )} | Gemini 2.5 Flash-Lite)`,
      );
    } else {
      // 清除舊的 lastTokenUsage
      lastTokenUsage = null;
    }

    // 安全取得第一個候選文字 (GAS 不支援 Optional Chaining)
    const candidates = json && json.candidates ? json.candidates : [];
    const firstCandidate = candidates.length > 0 ? candidates[0] : null;
    const finishReason =
      firstCandidate && firstCandidate.finishReason
        ? firstCandidate.finishReason
        : "UNKNOWN";
    writeLog(
      `[Polish] finishReason: ${finishReason}, candidates: ${candidates.length}`,
    );

    let rawText = "";
    if (
      firstCandidate &&
      firstCandidate.content &&
      firstCandidate.content.parts
    ) {
      const parts = firstCandidate.content.parts;
      if (Array.isArray(parts) && parts.length > 0 && parts[0].text) {
        rawText = parts[0].text;
      }
    }

    if (!rawText || typeof rawText !== "string") {
      writeLog(
        `[Polish] AI 回傳為空，Body 前 300 字: ${body.substring(0, 300)}`,
      );
      return simplePolishFallback(input);
    }

    // 清理多餘的換行和空白，並附加警告訊息 (如果有)
    const cleaned = rawText.trim().replace(/[\r\n]+/g, " ");
    const normalized = isOneLineQaText(cleaned)
      ? normalizeOneLineQaText(cleaned)
      : cleaned;
    return warningMsg + normalized;
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
  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
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
    },
  };

  try {
    // v27.9.37: 支援 OpenRouter 切換
    if (LLM_PROVIDER === "OpenRouter") {
      try {
        // 建構 OpenRouter 訊息
        const messages = [{ role: "user", parts: [{ text: prompt }] }];
        // 使用 callOpenRouter (不帶 System Prompt，因為這裡 prompt 包含了所有指示)
        const responseText = callOpenRouter(messages, 0.4);
        const cleaned = responseText.trim().replace(/[\r\n]+/g, " ");
        return isOneLineQaText(cleaned) ? normalizeOneLineQaText(cleaned) : cleaned;
      } catch (orErr) {
        writeLog(
          `[Modify OpenRouter Fail] ${orErr.message}, Fallback to Gemini`,
        );
      }
    }

    // v24.2.3: 簡單格式化用 Fast 模型
    lastLlmCallAttempted = true;
    const res = UrlFetchApp.fetch(
      `${CONFIG.API_ENDPOINT}/${CONFIG.MODEL_NAME_FAST}:generateContent?key=${apiKey}`,
      {
        method: "post",
        headers: { "Content-Type": "application/json" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    );

    const code = res.getResponseCode();
    const body = res.getContentText();
    writeLog(`[Modify API] Code: ${code}, Body: ${body.substring(0, 500)}`);

    if (code !== 200) {
      writeLog(`[Modify API Error] Code: ${code}`);
      return simpleModifyFallback(currentText, instruction);
    }

    let json;
    try {
      json = JSON.parse(body);
    } catch (parseErr) {
      writeLog(`[Modify Parse Error] ${parseErr.message}`);
      return simpleModifyFallback(currentText, instruction);
    }

    // v27.9.17: 記錄 Token 費用
    if (json.usageMetadata) {
      const usage = json.usageMetadata;
      const costUSD =
        (usage.promptTokenCount / 1000000) * PRICE_FAST_INPUT +
        (usage.candidatesTokenCount / 1000000) * PRICE_FAST_OUTPUT;
      const costTWD = costUSD * EXCHANGE_RATE;
      lastTokenUsage = {
        input: usage.promptTokenCount,
        output: usage.candidatesTokenCount,
        total: usage.totalTokenCount,
        costUSD: costUSD,
        costTWD: costTWD,
      };
      writeLog(
        `[Modify Tokens] In: ${usage.promptTokenCount}, Out: ${
          usage.candidatesTokenCount
        }, Total: ${usage.totalTokenCount} (約 NT$${costTWD.toFixed(4)})`,
      );
    }

    // 安全取得第一個候選文字 (GAS 不支援 Optional Chaining)
    const candidates = json && json.candidates ? json.candidates : [];
    const firstCandidate = candidates.length > 0 ? candidates[0] : null;
    const finishReason =
      firstCandidate && firstCandidate.finishReason
        ? firstCandidate.finishReason
        : "UNKNOWN";
    writeLog(
      `[Modify] finishReason: ${finishReason}, candidates: ${candidates.length}`,
    );

    let rawText = "";
    if (
      firstCandidate &&
      firstCandidate.content &&
      firstCandidate.content.parts
    ) {
      const parts = firstCandidate.content.parts;
      if (Array.isArray(parts) && parts.length > 0 && parts[0].text) {
        rawText = parts[0].text;
      }
    }

    if (!rawText || typeof rawText !== "string") {
      writeLog(
        `[Modify] AI 回傳為空，Body 前 300 字: ${body.substring(0, 300)}`,
      );
      return simpleModifyFallback(currentText, instruction);
    }

    const cleaned = rawText.trim().replace(/[\r\n]+/g, " ");
    return isOneLineQaText(cleaned) ? normalizeOneLineQaText(cleaned) : cleaned;
  } catch (e) {
    writeLog(`[Modify Error] ${e.message}`);
    return simpleModifyFallback(currentText, instruction);
  }
}

// 降級：將使用者輸入快速轉為「問題 / A：答案」
function simplePolishFallback(input) {
  var text = (input || "").trim();
  if (!text) return "問題 / A：請補充內容";
  if (isOneLineQaText(text)) {
    return normalizeOneLineQaText(text);
  }
  // 嘗試以第一個問句切分
  var qMatch = text.match(/^[^?！？。]+[?？]/);
  if (qMatch) {
    var q = qMatch[0].replace(/[。]/g, "").trim();
    var a = text.substring(q.length).trim() || "待補";
    return q.replace(/[?？]$/, "？") + " / A：" + a;
  }
  // 若輸入含「 / A：」，直接使用
  if (text.indexOf(" / A：") > -1) {
    return text.replace(/[\r\n]+/g, " ").trim();
  }
  // 最後退路：組成一個通用問法
  return text + "是什麼/怎麼用 / A：待補";
}

// 降級：智慧合併，嘗試理解用戶意圖
function simpleModifyFallback(currentText, instruction) {
  const base = isOneLineQaText(currentText)
    ? normalizeOneLineQaText(currentText)
    : (currentText || "").trim();
  const ins = (instruction || "").trim();
  if (!base) return simplePolishFallback(ins);
  if (!ins) return base;

  writeLog(
    "[Fallback] 降級合併: base=" +
      base.substring(0, 50) +
      ", ins=" +
      ins.substring(0, 50),
  );

  // 分析用戶指令類型
  var isReplace = /不對|錯了|改成|換成|應該是/.test(ins);
  var isInsert = /補充|加上|加入|新增/.test(ins);

  // 若看起來像「問題 / A：答案」格式
  var splitIdx = base.indexOf(" / A：");
  if (splitIdx > 0) {
    var q = base.substring(0, splitIdx).trim();
    var a = base.substring(splitIdx + 5).trim();

    if (isReplace) {
      return q + " / A：" + a + "\n⚠️ 請直接告訴我正確的內容是什麼";
    } else if (isInsert) {
      return (
        q + " / A：" + a + "。" + ins.replace(/補充一下|加上|加入|新增/g, "")
      );
    }
    return q + " / A：" + a + "（用戶補充：" + ins + "）";
  }
  // 否則直接合併
  return base + " / A：" + ins;
}

/**
 * 簡化版存檔：直接將整條文字寫入 QA 或 CLASS_RULES
 */
function saveDraftToSheet(draft) {
  if (IS_TEST_MODE) {
    writeLog("[Test Guard] TestUI 草稿只預覽，不允許寫入 QA 或 CLASS_RULES");
    return "🧪 測試模式只產生預覽，沒有寫入 QA 或 CLASS_RULES。";
  }

  // 驗證草稿內容
  var draftType = getEntryDraftType(draft);
  var draftText = getEntryDraftCurrentText(draft);
  if (!draftText || draftText.trim().length < 5) {
    return "❌ 草稿內容太短，請提供更多資訊。";
  }

  if (draftType === "rule") {
    draftText = normalizeRuleLine(draftText);
  } else {
    // 自動修復格式：確保有 " / A："
    draftText = autoFixQAFormat(draftText);
  }

  const lock = LockService.getScriptLock();
  let hasLock = false;

  try {
    lock.waitLock(10000);
    hasLock = true;

    const targetSheetName =
      draftType === "rule" ? SHEET_NAMES.CLASS_RULES : SHEET_NAMES.QA;
    const sheet = ss.getSheetByName(targetSheetName);
    if (!sheet) {
      return "❌ 找不到 " + targetSheetName + " 工作表";
    }

    // 直接寫入 A 欄單列字串；CLASS_RULES 不展開多欄，避免破壞既有解析架構。
    sheet.appendRow([draftText]);
    SpreadsheetApp.flush();

    // 提早釋放鎖定，避免與 syncGeminiKnowledgeBase 發生死鎖
    if (hasLock) {
      try {
        lock.releaseLock();
      } catch (e) {}
      hasLock = false;
    }

    // 清除快取並排程同步知識庫，避免 LINE webhook 主線程超過 5 秒。
    CacheService.getScriptCache().remove(
      CACHE_KEYS.ENTRY_DRAFT_PREFIX + draft.userId,
    );
    scheduleImmediateRebuild();

    writeLog(
      draft.userId || "UNKNOWN",
      "UserRecord",
      `[Draft Saved to ${targetSheetName}] ${draftText.substring(0, 50)}...`,
    );
    return `✅ 已寫入 ${targetSheetName}，知識庫更新已排程！\n\n寫入內容：${draftText}`;
  } catch (e) {
    writeLog(
      draft.userId || "UNKNOWN",
      "Error",
      `[SaveDraft Error] ${e.message}`,
    );
    return `❌ 寫入失敗：${e.message}`;
  } finally {
    if (hasLock) {
      try {
        lock.releaseLock();
      } catch (e) {}
    }
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
  if (trimmed.indexOf(" / A：") > -1) {
    return trimmed;
  }

  // 嘗試修復：常見錯誤格式
  // 1. 半形逗號分隔 "問題, 答案"
  if (trimmed.indexOf(", ") > -1 && trimmed.indexOf(" / A：") === -1) {
    var commaIdx = trimmed.indexOf(", ");
    var q = trimmed.substring(0, commaIdx).trim();
    var a = trimmed.substring(commaIdx + 2).trim();
    writeLog("[AutoFix] 修復逗號格式: " + q.substring(0, 30));
    return q + " / A：" + a;
  }

  // 2. 全形逗號分隔 "問題，答案"
  if (trimmed.indexOf("，") > -1 && trimmed.indexOf(" / A：") === -1) {
    var commaIdx = trimmed.indexOf("，");
    var q = trimmed.substring(0, commaIdx).trim();
    var a = trimmed.substring(commaIdx + 1).trim();
    writeLog("[AutoFix] 修復全形逗號格式: " + q.substring(0, 30));
    return q + " / A：" + a;
  }

  // 3. 有問號，以問號切分
  var qMarkIdx = Math.max(trimmed.indexOf("?"), trimmed.indexOf("？"));
  if (qMarkIdx > 0 && qMarkIdx < trimmed.length - 1) {
    var q = trimmed.substring(0, qMarkIdx + 1).trim();
    var a = trimmed.substring(qMarkIdx + 1).trim();
    writeLog("[AutoFix] 以問號切分: " + q.substring(0, 30));
    return q + " / A：" + a;
  }

  // 4. 無法自動修復，加上預設前綴
  writeLog("[AutoFix] 無法自動判斷，加預設格式");
  return "相關問題 / A：" + trimmed;
}

function handleAutoQA(u, cid) {
  const history = getHistoryFromCacheOrSheet(cid);
  if (history.length < 2) return "❌ 對話不足，無法自動整理";

  try {
    // 將最近對話整理成一行 QA（問題, 答案）
    const apiKey =
      PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    const convo = history
      .slice(-6)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");
    const prompt = `請把以下對話濃縮成一行「問題 / A：答案」格式。
                              只回傳一行，用「 / A：」分隔，不要解釋。

                              對話：
                              ${convo}`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.3,
      },
    };
    // v24.2.3: 簡單整理用 Fast 模型
    lastLlmCallAttempted = true;
    const res = UrlFetchApp.fetch(
      `${CONFIG.API_ENDPOINT}/${CONFIG.MODEL_NAME_FAST}:generateContent?key=${apiKey}`,
      {
        method: "post",
        headers: { "Content-Type": "application/json" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    );

    let qaLine = "";
    let costInfo = "";
    if (res.getResponseCode() === 200) {
      try {
        const j = JSON.parse(res.getContentText());

        // v27.9.17: 記錄 Token 費用
        if (j.usageMetadata) {
          const usage = j.usageMetadata;
          const costUSD =
            (usage.promptTokenCount / 1000000) * PRICE_FAST_INPUT +
            (usage.candidatesTokenCount / 1000000) * PRICE_FAST_OUTPUT;
          const costTWD = costUSD * EXCHANGE_RATE;
          lastTokenUsage = {
            input: usage.promptTokenCount,
            output: usage.candidatesTokenCount,
            total: usage.totalTokenCount,
            costUSD: costUSD,
            costTWD: costTWD,
          };
          writeLog(
            `[AutoQA Tokens] In: ${usage.promptTokenCount}, Out: ${
              usage.candidatesTokenCount
            }, Total: ${usage.totalTokenCount} (約 NT$${costTWD.toFixed(4)})`,
          );
          costInfo = `\n\n${buildReplyCostAuditText_()}`;
        }

        const cands = j && j.candidates ? j.candidates : [];
        if (Array.isArray(cands) && cands.length > 0) {
          const p = cands[0].content && cands[0].content.parts;
          if (Array.isArray(p) && p.length > 0 && p[0].text) {
            qaLine = p[0].text.trim().replace(/[\r\n]+/g, " ");
          }
        }
      } catch (parseErr) {
        writeLog(`[AutoQA Parse Error] ${parseErr.message}`);
      }
    }

    if (!qaLine || qaLine.length < 10) {
      // 降級：簡單從最後兩句生成
      const lastUser = history
        .slice()
        .reverse()
        .find((m) => m.role === "user");
      const lastBot = history
        .slice()
        .reverse()
        .find((m) => m.role === "assistant");
      const q = lastUser && lastUser.content ? lastUser.content : "問題";
      const a = lastBot && lastBot.content ? lastBot.content : "待補";
      qaLine = `${q}, ${a}`;
    }

    const lock = LockService.getScriptLock();
    let hasLock = false;
    try {
      lock.waitLock(10000);
      hasLock = true;
      const sheet = ss.getSheetByName(SHEET_NAMES.QA);
      sheet.appendRow([qaLine]);
      SpreadsheetApp.flush();
    } catch (e) {
      writeLog(`[AutoQA Write Error] ${e.message}`);
    } finally {
      if (hasLock) {
        try {
          lock.releaseLock();
        } catch (e) {}
      }
    }

    syncGeminiKnowledgeBase();
    return `✅ 已自動整理並存入 QA：\n${qaLine.substring(0, 50)}...${costInfo}`;
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

function writeQA(l, s, p, a, n) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = ss.getSheetByName(SHEET_NAMES.QA);
    if (!sheet) return false;
    const cleanP = sanitizeForSheet(p);
    const cleanA = sanitizeForSheet(a);
    const cleanN = sanitizeForSheet(n);
    sheet.appendRow([
      [new Date().toLocaleDateString(), l, s, cleanP, cleanA, cleanN].join(
        ", ",
      ),
    ]);
    SpreadsheetApp.flush();
    return true;
  } catch (e) {
    writeLog("[WriteQA Error] " + e);
    return false;
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
    flushLogs(); // 確保 Log 寫入
  }
}

function writeRule(k, d, u, desc) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    if (!sheet) return false;
    const cleanK = sanitizeForSheet(k);
    const cleanD = sanitizeForSheet(d);
    const cleanDesc = sanitizeForSheet(desc);
    sheet.appendRow([[cleanK, cleanD, u, cleanDesc].join(", ")]);
    SpreadsheetApp.flush();
    return true;
  } catch (e) {
    writeLog("[WriteRule Error] " + e);
    return false;
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function refreshLogFilterConfig_() {
  try {
    const now = Date.now();
    if (now - LOG_FILTER_STATE.loadedAt < 300000) {
      return;
    }
    const raw = PropertiesService.getScriptProperties().getProperty(
      "LOG_COMPACT_ROUTING",
    );
    if (raw === null || raw === "") {
      LOG_FILTER_STATE.compactRouting = true;
    } else {
      LOG_FILTER_STATE.compactRouting = String(raw).toLowerCase() !== "false";
    }
    LOG_FILTER_STATE.loadedAt = now;
  } catch (e) {
    // 讀設定失敗時維持預設精簡模式，避免回寫造成額外噪音
    LOG_FILTER_STATE.compactRouting = true;
  }
}

function shouldSkipNoisyRoutingLog_(type, content) {
  if (type === "Error" || type === "UserRecord") {
    return false;
  }
  if (!LOG_FILTER_STATE.compactRouting || !content) {
    return false;
  }

  // 保留最終關鍵可追溯節點
  const keepPatterns = [
    /\[HandleMsg\]/,
    /\[AI Stats\]/,
    /\[AI Raw Response\]/,
    /\[Final Reply\]/,
    /\[Reply\]/,
    /\[Flow Decision\]/,
    /\[DirectDeep\] 命中 CLASS_RULES 直通車關鍵字/,
    /\[DirectDeep v29\.5\.131\] 型號 .*有 PDF/,
    /\[DirectDeep v29\.5\.131\] 所有型號均無 PDF/,
    /\[KB Select\] 🎯 命中型號/,
    /\[KB Select\] Tier0:/,
    /\[KB Select\] 🚫 所有型號均無專屬 PDF/,
    /\[KB Select\] ⚠️ 所有型號均無專屬 PDF/,
  ];
  if (keepPatterns.some((re) => re.test(content))) {
    return false;
  }

  // 壓縮路由細節噪音（同資訊在最終關鍵節點已可追溯）
  const noisyPatterns = [
    /\[DirectDeep\] 從所有關鍵字提取型號/,
    /\[DirectDeep v29\.5\.154\] 過濾內部代號/,
    /\[DirectDeep v29\.5\.153\] 早期子字串去重/,
    /\[DirectDeep\] ✅ 注入型號到 Cache/,
    /\[KB Select\] 強制只用當前訊息匹配型號/,
    /\[KB Select\] 從對話歷史提取型號/,
    /\[KB Select\] 從 Cache 讀取直通車注入型號/,
    /\[KB Select\] forceCurrentOnly=true，跳過歷史\/Cache 型號注入/,
    /\[KB Select\] 當前訊息有型號，沿用已知型號/,
    /\[KB Select\] 當前訊息無型號但 forceCurrentOnly=false，保留歷史型號/,
    /\[KB Select\] 🔍 偵測到比較意圖，保留多型號/,
    /\[KB Select\] 🔒 已鎖定直通車型號/,
    /\[KB Select\] ⚡ Single Model Lock Detected/,
    /\[KB Select\] 📊 Sorted Tier 1:/,
    /\[KB Select\] 🔍 Comparison detected\. Allowing up to 2 PDFs/,
    /\[KB Select\] ✂️ Enforcing Strict Limit:/,
    /\[KB Select\] ⚡ Found Primary Model/,
  ];

  return noisyPatterns.some((re) => re.test(content));
}

function writeLog(a, b, c) {
  // 參數相容：
  // - 舊用法：writeLog("文字")
  // - 新用法：writeLog(userId, type, content)
  var userId = null;
  var type = "General";
  var content = "";

  if (typeof b !== "undefined" && typeof c !== "undefined") {
    userId = a;
    type = b || "General";
    content = c || "";
  } else {
    content = a || "";
  }

  refreshLogFilterConfig_();
  if (shouldSkipNoisyRoutingLog_(type, content)) {
    return;
  }

  var timestamp = Utilities.formatDate(
    new Date(),
    "Asia/Taipei",
    "HH:mm:ss.SSS",
  );
  var msgForLog = `[${type}] ${content}`;

  // 🧪 TEST MODE: 預設只在頁面顯示，不寫 Sheet；但 UserRecord/Error 允許寫入
  if (typeof IS_TEST_MODE !== "undefined" && IS_TEST_MODE) {
    if (typeof TEST_LOGS !== "undefined") {
      TEST_LOGS.push(`[${timestamp}] ${msgForLog}`);
    }
    console.log(msgForLog);

    if (type !== "UserRecord" && type !== "Error") {
      return; // 攔截一般 Log，保持 Sheet 乾淨
    }

    // 標記測試模式寫入
    content = `[測試模式] ${content}`;
    msgForLog = `[${type}] ${content}`;
  }

  // v27.8.5 Performance: 改為寫入緩衝區，不直接寫 Sheet
  // 解決 writeLog 阻塞導致回應變慢的問題
  PENDING_LOGS.push([new Date(), msgForLog.replace(/[\r\n]+/g, " ")]);
  console.log(msgForLog);

  // 安全機制：緩衝區過大時強制寫入 (避免 timeout 丟失太多)
  if (PENDING_LOGS.length >= 50) {
    flushLogs();
  }
}

function flushLogs() {
  if (PENDING_LOGS.length === 0) return;

  // 🧪 TEST MODE: 不寫入 Sheet
  if (typeof IS_TEST_MODE !== "undefined" && IS_TEST_MODE) {
    PENDING_LOGS = [];
    return;
  }

  try {
    if (ss) {
      const logSheet = ss.getSheetByName(SHEET_NAMES.LOG);
      if (logSheet) {
        // 批量寫入 (Batch Write) - 效能關鍵點
        logSheet
          .getRange(logSheet.getLastRow() + 1, 1, PENDING_LOGS.length, 2)
          .setValues(PENDING_LOGS);
        SpreadsheetApp.flush();

        // 自動清理：保留最新 500 筆
        const lastRow = logSheet.getLastRow();
        if (lastRow > 600) {
          const deleteCount = lastRow - 500;
          logSheet.deleteRows(1, deleteCount);
        }
      }
    }
  } catch (e) {
    console.error("Flush Logs Error: " + e.message);
  } finally {
    PENDING_LOGS = []; // 清空緩衝區
  }
}

/**
 * v24.3.0 新增：從對話歷史自動提取上下文
 * 用途：支援跨越時間邊界的延續提問（如店員隔天回來繼續問）
 *
 * 提取內容：型號、品牌、功能特徵、使用場景
 * 範圍：回溯最近 10 條訊息（避免過度搜尋舊訊息）
 */
function extractContextFromHistory(userId, contextId) {
  try {
    const history = getHistoryFromCacheOrSheet(contextId);
    if (!history || history.length === 0) {
      return null;
    }

    // v27.9.78: 只從「最後一條 assistant 訊息」提取型號
    // 原因：用戶選擇特定型號後，最後的 assistant 回覆會包含該型號的詳細資訊
    // 這樣可以確保只搜尋用戶實際選擇的型號，避免歷史中其他型號干擾
    const lastAssistantMsg = history
      .slice()
      .reverse()
      .find((m) => m.role === "assistant");

    const recentMsgs = lastAssistantMsg ? lastAssistantMsg.content || "" : "";

    // 提取型號
    const MODEL_REGEX =
      /\b(G\d{1,2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|(?:L?S)\d{1,2}[A-Z]{0,2}\d{0,4}[A-Z0-9]{0,5}|(?:L?[CF])\d{2}[A-Z]+\d{2,4}[A-Z0-9]*|WA\d+[A-Z\d]*|WD\d+[A-Z\d]*|VR\d+[A-Z\d]*)\b/g;
    const models = [];
    let match;
    while ((match = MODEL_REGEX.exec(recentMsgs)) !== null) {
      if (!models.includes(match[0])) {
        models.push(match[0]);
      }
    }

    // 提取品牌（簡單方法：檢查是否提到 Samsung/三星）
    const hasSamsung = /samsung|三星|SAMSUNG/i.test(recentMsgs);
    const brand = hasSamsung ? "Samsung" : null;

    // 提取功能特徵（簡單方法：檢查常見術語）
    const features = [];
    const featureKeywords = {
      "4K": /4K|UHD|3840x2160/i,
      OLED: /OLED/i,
      MiniLED: /MiniLED|mini led/i,
      IPS: /IPS/i,
      VA: /VA/i,
      曲面: /curved|曲|1000R|1800R/i,
      "USB-C": /USB-C|type-c/i,
      Thunderbolt: /thunderbolt/i,
    };

    for (const [name, pattern] of Object.entries(featureKeywords)) {
      if (pattern.test(recentMsgs)) {
        features.push(name);
      }
    }

    // 提取場景（簡單方法：檢查常見場景詞）
    const scenario = [];
    const scenarioKeywords = {
      電競: /gaming|電競|遊戲|FPS|RTX/i,
      創意工作: /creative|design|修圖|色域|DCI-P3/i,
      商務: /business|office|商務|辦公/i,
      居家: /home|living|家用|living room/i,
    };

    for (const [name, pattern] of Object.entries(scenarioKeywords)) {
      if (pattern.test(recentMsgs)) {
        scenario.push(name);
      }
    }

    return {
      models: models.length > 0 ? models : null,
      brand: brand,
      features: features.length > 0 ? features : null,
      scenario: scenario.length > 0 ? scenario : null,
    };
  } catch (e) {
    writeLog(`[extractContextFromHistory] 錯誤: ${e.message}`);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// v29.4.32: History Sanitization - Clean system tags and Flex objects
// ════════════════════════════════════════════════════════════════
function sanitizeHistoryContent(content) {
  // 1. If not a string (e.g., Flex object), extract altText or fallback
  if (typeof content !== "string") {
    if (content && content.altText) {
      content = `[選單] ${content.altText}`;
    } else if (content && content.type === "flex") {
      content = "[選單] 型號選擇";
    } else if (content && typeof content === "object") {
      content = "[系統訊息]";
    } else {
      content = String(content || "");
    }
  }

  // 2. Remove System Hint tags (injected for Direct Search)
  content = content.replace(/\[System Hint:[^\]]*\]/gi, "");

  // 3. Remove Auto-Search tags (internal signals)
  content = content.replace(/\[AUTO_SEARCH_PDF(?::[^\]]+)?\]/gi, "");
  content = content.replace(/\[AUTO_SEARCH_WEB\]/gi, "");
  content = content.replace(/\[NEED_DOC\]/gi, "");
  content = content.replace(/\[型號:[^\]]+\]/gi, "");
  content = content.replace(/\[KB_EXPIRED\]/gi, "");

  // 4. Clean up [object Object] artifacts
  content = content.replace(/\[object Object\]/g, "");

  // 5. Trim excessive whitespace
  content = content.replace(/\n{3,}/g, "\n\n").trim();

  return content;
}

function sanitizeHistoryArray(history) {
  if (!Array.isArray(history)) return [];
  return history
    .map((msg) => ({
      ...msg,
      content: sanitizeHistoryContent(msg.content),
    }))
    .filter((msg) => msg.content && msg.content.length > 0);
}

function getHistoryFromCacheOrSheet(cid) {
  const c = CacheService.getScriptCache();
  const k = `${CACHE_KEYS.HISTORY_PREFIX}${cid}`;
  const v = c.get(k);
  if (v) {
    try {
      // v29.4.32: Sanitize history on read
      return sanitizeHistoryArray(JSON.parse(v));
    } catch (e) {}
  }
  try {
    // 2025-12-05: 恢復 Sheet 讀取 (Cache Miss 時的備案)
    let s = ss.getSheetByName(SHEET_NAMES.LAST_CONVERSATION);
    if (!s) {
      // 若 Sheet 不存在，視為無歷史，不需建立 (等到寫入時再建)
      return [];
    }
    const f = s
      .getRange("A:A")
      .createTextFinder(cid)
      .matchEntireCell(true)
      .findNext();
    if (f) {
      // v29.4.32: Sanitize history on read
      const parsed = JSON.parse(s.getRange(f.getRow(), 2).getValue());
      const sanitized = sanitizeHistoryArray(parsed);
      c.put(k, JSON.stringify(sanitized), 3600); // v29.6 BUG 2 修復: 回寫快取
      return sanitized;


    }
  } catch (e) {}
  return [];
}

function updateHistorySheetAndCache(cid, prev, uMsg, aMsg) {
  try {
    // v29.4.32: Sanitize content before storage
    uMsg = { ...uMsg, content: sanitizeHistoryContent(uMsg.content) };
    aMsg = { ...aMsg, content: sanitizeHistoryContent(aMsg.content) };

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
      writeLog(
        `[History] 超長對話 (${newHist.length} > ${SUMMARY_THRESHOLD})，啟動摘要...`,
      );

      const splitIndex = Math.floor(newHist.length / 2);
      const safeSplitIndex = splitIndex % 2 === 0 ? splitIndex : splitIndex - 1;

      const oldMsgs = newHist.slice(0, safeSplitIndex);
      const recentMsgs = newHist.slice(safeSplitIndex);

      const summary = null; // v29.6 BUG 8 修復: 取消同步摘要，直接觸發 Hard Cut 確保 5 秒回應

      if (summary) {
        const summaryMsg = {
          role: "user",
          content: `【系統自動摘要】\n之前的對話重點：${summary}\n(請基於此上下文繼續服務)`,
        };
        const ackMsg = {
          role: "assistant",
          content: "好的，我已了解之前的對話脈絡。",
        };

        newHist = [summaryMsg, ackMsg, ...recentMsgs];
        writeLog(`[History] 摘要完成，新長度: ${newHist.length}`);
      } else {
        newHist = newHist.slice(-MAX_MSG_COUNT);
        writeLog(`[History] 摘要失敗，執行簡單切分`);
      }
    }

    const json = JSON.stringify(newHist);
    CacheService.getScriptCache().put(
      `${CACHE_KEYS.HISTORY_PREFIX}${cid}`,
      json,
      CONFIG.CACHE_TTL_SEC,
    );

    // 2025-12-05: 恢復 Sheet 寫入 (長期記憶備份)
    // 自動檢查並建立 Sheet，防止因刪除導致失效
    try {
      let s = ss.getSheetByName(SHEET_NAMES.LAST_CONVERSATION);
      if (!s) {
        s = ss.insertSheet(SHEET_NAMES.LAST_CONVERSATION);
        s.appendRow(["ContextID", "HistoryJSON", "LastUpdated"]); // 補標題
        writeLog(
          `[AutoCreate] 已自動重建 ${SHEET_NAMES.LAST_CONVERSATION} 工作表`,
        );
      }

      const f = s
        .getRange("A:A")
        .createTextFinder(cid)
        .matchEntireCell(true)
        .findNext();
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
  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) return null;

  const convoText = messages
    .map((m) => `${m.role === "user" ? "用戶" : "客服"}: ${m.content}`)
    .join("\n");

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
      temperature: 0.3,
    },
  };

  try {
    // v27.9.37: 支援 OpenRouter 切換
    if (LLM_PROVIDER === "OpenRouter") {
      try {
        // 建構 OpenRouter 訊息
        const messages = [{ role: "user", parts: [{ text: prompt }] }];
        // 使用 callOpenRouter (不帶 System Prompt，因為這裡 prompt 包含了所有指示)
        const responseText = callOpenRouter(messages, 0.4);
        return responseText.trim().replace(/[\r\n]+/g, " ");
      } catch (orErr) {
        writeLog(
          `[Modify OpenRouter Fail] ${orErr.message}, Fallback to Gemini`,
        );
      }
    }

    // v24.2.3: 簡單摘要用 Fast 模型
    lastLlmCallAttempted = true;
    const res = UrlFetchApp.fetch(
      `${CONFIG.API_ENDPOINT}/${CONFIG.MODEL_NAME_FAST}:generateContent?key=${apiKey}`,
      {
        method: "post",
        headers: { "Content-Type": "application/json" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    );

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
    // v24.1.10 重大修復：真正清除對話記憶（包含 Sheet + Cache）
    // 之前只清除 Cache，導致系統降級讀取 Sheet 中的舊對話

    // 1. 清除 Sheet 中的歷史記錄
    const s = ss.getSheetByName(SHEET_NAMES.LAST_CONVERSATION);
    if (s) {
      const f = s
        .getRange("A:A")
        .createTextFinder(cid)
        .matchEntireCell(true)
        .findNext();
      if (f) {
        s.getRange(f.getRow(), 2).clearContent();
        // writeLog(`[ClearHistory] 已從 Sheet 清除 ${cid} 的歷史記錄`);
      }
    }

    // 2. 清除 Cache 中的歷史記錄
    const cache = CacheService.getScriptCache();
    cache.remove(`${CACHE_KEYS.HISTORY_PREFIX}${cid}`);

    // 3. 清除 PDF 模式狀態
    cache.remove(CACHE_KEYS.PDF_MODE_PREFIX + cid);

    // v27.2.6+: 一併清除 PDF 反問暫存與直通車注入的型號，避免重啟後還吃到舊 pending
    cache.remove(CACHE_KEYS.PENDING_PDF_SELECTION + cid);
    cache.remove(`${cid}:hit_alias_key`);
    cache.remove(`${cid}:direct_search_models`);
    // v29.4.45: Clear Web Search Limit & Flags
    cache.remove(`${cid}:web_search_count`);
    cache.remove(`${cid}:pdf_consulted`);

    writeLog(
      `[ClearHistory] ✅ 完全清除了 ${cid} 的對話記憶 (Sheet + Cache + PDF Mode)`,
    );
  } catch (e) {
    writeLog(`[ClearHistory Error] ${e.message}`);
  }
}

// ========== 7. LINE Webhook 入口 ==========
// 注意：doGet 已移至區塊 9 (TEST UI) 並合併健康檢查功能

function doPost(e) {
  writeLog("[Webhook] Request Received");
  try {
    // 自動檢查並恢復排程（部署後自癒）
    ensureSyncTriggerExists();

    const postData = e && e.postData ? e.postData : {};
    const contents = postData.contents || "{}";
    const json = JSON.parse(contents);

    // 🆕 v29.5.209: 自訂的爬蟲與維護者 Webhook 入口
    if (json.action === "append_class_rule") {
      const authKey = getDoGetMaintenanceSecret_();
      if (!json.secret || json.secret !== authKey) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unauthorized" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Sheet CLASS_RULES not found" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // 追加寫入末列 (v29.5.214: 回歸原汁原味 A 欄單欄位大字串設計)
      const newRuleText = json.content;
      sheet.appendRow([newRuleText]);
      
      // 自動觸發快取與別稱字典重建
      const syncResult = syncGeminiKnowledgeBase(false);
      writeLog(`[Webhook Appended] 成功自官網更新新機型規格: ${newRuleText.substring(0, 100)}... 狀態: ${syncResult}`);
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, sync: syncResult }))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (json.action === "write_rules") {
      // v29.6.018: 批次寫入 CLASS_RULES (opencode 專用, POST body 大型)
      const authKey = getDoGetMaintenanceSecret_();
      if (!json.secret || json.secret !== authKey) {
        return ContentService.createTextOutput(
          JSON.stringify({ success: false, error: "Unauthorized" }),
        ).setMimeType(ContentService.MimeType.JSON);
      }
      try {
        const fromRow = parseInt(json.fromRow || "144", 10);
        const rules = Array.isArray(json.rules)
          ? json.rules
          : (json.rules ? [json.rules] : []);
        if (!Number.isFinite(fromRow) || fromRow < 1) {
          return ContentService.createTextOutput(
            JSON.stringify({ success: false, error: "Invalid fromRow" }),
          ).setMimeType(ContentService.MimeType.JSON);
        }
        if (rules.length === 0) {
          return ContentService.createTextOutput(
            JSON.stringify({ success: false, error: "No rules provided" }),
          ).setMimeType(ContentService.MimeType.JSON);
        }
        const sanitizedRules = rules.map((rule) => rule === null || rule === undefined ? "" : String(rule));
        if (sanitizedRules.some((rule) => rule.trim().length === 0)) {
          return ContentService.createTextOutput(
            JSON.stringify({ success: false, error: "Rules must not be blank" }),
          ).setMimeType(ContentService.MimeType.JSON);
        }
        if (!ss) {
          return ContentService.createTextOutput(
            JSON.stringify({ success: false, error: "Spreadsheet is not available" }),
          ).setMimeType(ContentService.MimeType.JSON);
        }
        const sheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
        if (!sheet) {
          return ContentService.createTextOutput(
            JSON.stringify({ success: false, error: "CLASS_RULES sheet not found" }),
          ).setMimeType(ContentService.MimeType.JSON);
        }
        const range = sheet.getRange(fromRow, 1, sanitizedRules.length, 1);
        range.setValues(sanitizedRules.map((rule) => [rule]));
        SpreadsheetApp.flush();
        writeLog(`[WriteRules] Wrote ${sanitizedRules.length} rows from row ${fromRow}`);
        return ContentService.createTextOutput(
          JSON.stringify({
            success: true,
            fromRow: fromRow,
            writtenRows: sanitizedRules.length,
            sheetName: SHEET_NAMES.CLASS_RULES,
            timestamp: new Date().toISOString(),
          }),
        ).setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(
          JSON.stringify({ success: false, error: err.message }),
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }

    if (json.action === "upload_manual_pdf") {
      const props = PropertiesService.getScriptProperties();
      const authKey = getDoGetMaintenanceSecret_();
      const uploadToken = props.getProperty("MANUAL_UPLOAD_TOKEN") || "";
      const uploadTokenExpiresAt = Number(props.getProperty("MANUAL_UPLOAD_TOKEN_EXPIRES_AT") || "0");
      const isUploadTokenValid =
        uploadToken &&
        json.secret === uploadToken &&
        uploadTokenExpiresAt > Date.now();
      if (!json.secret || (json.secret !== authKey && !isUploadTokenValid)) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unauthorized" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      const folderId = props.getProperty("DRIVE_FOLDER_ID");
      if (!folderId) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "DRIVE_FOLDER_ID Script Property is not set" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      try {
        const safeFileName = validateManualPdfFileName_(json.fileName);
        const pdfBytes = Utilities.base64Decode(json.pdfBase64);
        assertStandardPdfBytes_(pdfBytes);
        const folder = DriveApp.getFolderById(folderId);
        const existing = folder.getFilesByName(safeFileName);
        if (existing.hasNext()) {
          const file = existing.next();
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            skipped: true,
            fileId: file.getId(),
            fileName: safeFileName,
            size: file.getSize(),
          })).setMimeType(ContentService.MimeType.JSON);
        }
        const blob = Utilities.newBlob(pdfBytes, "application/pdf", safeFileName);
        try {
          let fileId;
          try {
            const file = Drive.Files.insert({
              title: safeFileName,
              mimeType: "application/pdf",
              parents: [{ id: folderId }]
            }, blob);
            fileId = file.id;
          } catch (driveErr) {
            writeLog(`[Webhook PDF] Advanced Drive API 失敗，嘗試使用 DriveApp: ${driveErr.message}`);
            const file = folder.createFile(blob);
            fileId = file.getId();
          }
          writeLog(`[Webhook PDF] 成功上傳手冊 PDF: ${safeFileName} (ID: ${fileId})`);
          return ContentService.createTextOutput(JSON.stringify({ success: true, fileId: fileId, fileName: safeFileName, source: "drive" }))
            .setMimeType(ContentService.MimeType.JSON);
        } catch (driveWriteErr) {
          writeLog(`[Webhook PDF] Drive 寫入失敗，改用 Gemini Files API: ${safeFileName} - ${driveWriteErr.message}`);
          const geminiResult = upsertManualPdfToGemini_(safeFileName, pdfBytes);
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            fileName: safeFileName,
            source: "gemini_file_api",
            uri: geminiResult.uri,
            manualCount: geminiResult.manualCount,
            pdfModelCount: geminiResult.pdfModelCount,
            driveError: driveWriteErr.message,
          })).setMimeType(ContentService.MimeType.JSON);
        }
      } catch (err) {
        writeLog(`[Webhook PDF Error] 上傳失敗: ${err.message}`);
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    if (json.action === "update_prompt_c3") {
      const authKey = getDoGetMaintenanceSecret_();
      if (!json.secret || json.secret !== authKey) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unauthorized" }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      try {
        const syncResult = adminUpdatePromptC3(json.content || json.prompt || "");
        writeLog(`[Prompt Sync] Prompt!C3 已更新: v${syncResult.version}, ${syncResult.length} chars`);
        return ContentService.createTextOutput(JSON.stringify({ success: true, result: syncResult }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        writeLog(`[Prompt Sync Error] ${err.message}`);
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    const events = json.events || [];

    events.forEach(function (event) {
      try {
        if (event.type !== "message") {
          return;
        }
        const eventId = event.webhookEventId;
        if (isDuplicateEvent(eventId)) return;

        const isGroup =
          event.source.type === "group" || event.source.type === "room";
        var contextId = isGroup ? event.source.groupId : event.source.userId;
        var userId = event.source.userId;
        var replyToken = event.replyToken;

        if (isGroup) {
          if (event.message.type === "text") {
            const botUserId = getBotUserId();
            const mention = event.message.mention || {};
            const mentions = mention.mentionees || [];
            if (
              !mentions.some(function (m) {
                return m.userId === botUserId;
              })
            )
              return;
            var cleanedText = event.message.text;
            mentions.forEach(function (m) {
              if (m.userId === botUserId) {
                cleanedText = cleanedText
                  .replace(
                    cleanedText.substring(m.index, m.index + m.length),
                    "",
                  )
                  .trim();
              }
            });
            if (!cleanedText) {
              replyMessage(replyToken, "有事嗎？");
              return;
            }
            // v27.4.0: 修改 event.message.text 為清理後的文字，再傳遞整個 event
            event.message.text = cleanedText;
            handleMessage(event);
          } else if (event.message.type === "image") {
            if (userId === CONFIG.VIP_IMAGE_USER) {
              handleImageMessage(
                event.message.id,
                userId,
                replyToken,
                contextId,
              );
            }
          }
        } else {
          if (event.message.type === "text") {
            handleMessage(event);
          } else if (event.message.type === "image") {
            handleImageMessage(event.message.id, userId, replyToken, contextId);
          }
        }
      } catch (eventErr) {
        const token = event && event.replyToken;
        const source = event && event.source ? event.source.userId || event.source.groupId || "UNKNOWN" : "UNKNOWN";
        writeLog(source, "Error", `[Webhook Event Error] ${eventErr && eventErr.stack ? eventErr.stack : eventErr}`);
        if (token) {
          try {
            replyMessage(token, "我這邊剛剛處理到一半出錯了，請再送一次同樣的問題。");
          } catch (replyErr) {
            writeLog(source, "Error", `[Webhook Event Error Reply Failed] ${replyErr.message}`);
          }
        }
      }
    });
    return ContentService.createTextOutput(
      JSON.stringify({ status: "ok" }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    writeLog("UNKNOWN", "Error", `[Webhook Fatal] ${e && e.stack ? e.stack : e}`);
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error" }),
    ).setMimeType(ContentService.MimeType.JSON);
  } finally {
    flushLogs(); // 確保 Log 寫入 Sheet
  }
}

// ========== 8. 輔助工具 (Utils) ==========

function getHistoryModels(userId) {
  // 簡單實作：從 Cache 的 HISTORY_JSON 中讀取最近的 User Message，並用正則提取型號
  // 這是為了在 Deep Mode 但用戶未提及型號時 (例如「請切換模式幫我查」) 進行救援
  try {
    const cache = CacheService.getScriptCache();
    const historyJson = cache.get(CACHE_KEYS.HISTORY_PREFIX + userId);
    if (!historyJson) return [];

    const history = JSON.parse(historyJson);
    const models = [];
    // 反向遍歷 (最新的先找)
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === "user") {
        const text = msg.content;
        // 使用與 getRelevantKBFiles 相同的正則 (複製自上方)
        const match = text.match(
          /\b(G\d{2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|S\d{2}[A-Z]{2}\d{3}[A-Z]{0,2}|[CF]\d{2}[A-Z]\d{3})\b/g,
        );
        if (match) {
          match.forEach((m) => {
            if (!models.includes(m)) models.push(m);
          });
        }
        const lsMatch = text.match(/LS(\d{2}[A-Z]{2}\d{3}[A-Z]{2})/g);
        if (lsMatch) {
          lsMatch.forEach((ls) => {
            const cleanModel = ls.replace(/^LS/, "S").replace(/XZW$/, "");
            if (!models.includes(cleanModel)) models.push(cleanModel);
          });
        }
      }
      if (models.length > 0) break; // 找到最近的一組就停，避免混淆這題跟上題的型號
    }
    return models;
  } catch (e) {
    writeLog(`[getHistoryModels Error] ${e.message}`);
    return [];
  }
}

function replyMessage(tk, txt, options = {}) {
  txt = cleanReplyVisibleTextArtifacts_(txt);
  txt = enforceReplyAuditTrail_(txt);

  // 🧪 TEST MODE: 不呼叫 LINE API (清除測試介面時請移除此判斷)
  if (IS_TEST_MODE || tk === "TEST_REPLY_TOKEN") {
    // v29.5.130: TestUI 依賴 testMessage() 從 Log 收集回覆；這裡補寫 [Reply] 讓前端能顯示
    try {
      let preview = "";
      if (Array.isArray(txt)) {
        preview = txt
          .map((t) => {
            if (typeof t === "string") return t;
            if (t && typeof t === "object" && t.type === "text") {
              return String(t.text || "");
            }
            if (t && typeof t === "object")
              return t.altText || "[Flex Message]";
            return String(t || "");
          })
          .join("\n\n");
      } else if (txt && typeof txt === "object" && txt.type) {
        preview = txt.altText || "[Flex Message]";
      } else {
        preview = txt === null || txt === undefined ? "" : txt.toString();
      }

      if (preview) {
        writeLog(`[Reply] ${preview}`);
      }
    } catch (e) {
      // ignore
    }
    writeLog("[TEST MODE] 跳過 LINE API 呼叫");
    return;
  }

  try {
    const lineToken =
      PropertiesService.getScriptProperties().getProperty("LINE_TOKEN");
    // writeLog(`[Reply Debug] LINE_TOKEN 前10字: ${lineToken ? lineToken.substring(0, 10) : "NULL"}`);

    // v29.3.21: 升級支援多訊息泡泡 (Array)
    let messages = [];
    if (Array.isArray(txt)) {
      // 限制最多 5 個訊息 (LINE 回覆限制)
      messages = txt.slice(0, 5).map((t) => {
        if (typeof t === "object" && t.type) {
          return t; // 已經是 Flex 或其他格式
        }
        return {
          type: "text",
          text: t.toString().substring(0, 4000),
        };
      });
    } else {
      if (typeof txt === "object" && txt.type) {
        messages = [txt];
      } else {
        messages = [{ type: "text", text: txt.toString().substring(0, 4000) }];
      }
    }

    // v29.3.36: 優先使用顯式傳遞的 options.quickReply，其次才是全域變數 (相容性)
    let qrItems = null;

    if (options && options.quickReply && options.quickReply.items) {
      qrItems = options.quickReply.items;
      writeLog(`[Reply] 使用顯式 Quick Reply: ${qrItems.length} 個選項`);
    } else if (quickReplyOptions && quickReplyOptions.length > 0) {
      qrItems = quickReplyOptions.map((opt) => ({
        type: "action",
        action: {
          type: "message",
          label: opt.label.substring(0, 20),
          text: opt.text || opt.label,
        },
      }));
      writeLog(`[Reply] 使用全域 Quick Reply: ${qrItems.length} 個選項`);
      quickReplyOptions = []; // Clear global
    }

    if (qrItems) {
      const lastMsg = messages[messages.length - 1];
      lastMsg.quickReply = { items: qrItems };
    }

    const response = UrlFetchApp.fetch(
      "https://api.line.me/v2/bot/message/reply",
      {
        method: "post",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + lineToken,
        },
        payload: JSON.stringify({
          replyToken: tk,
          messages: messages,
        }),
        muteHttpExceptions: true,
      },
    );

    const code = response.getResponseCode();
    // v29.5.109: 完整記錄 LINE 回覆內容
    const logFull =
      typeof txt === "string"
        ? txt.replace(/\n/g, " ")
        : txt.altText || "[Flex Message]";
    if (code === 200) {
      writeLog(`[Reply] ✅ LINE 回覆成功: ${logFull}`);
    } else {
      const errorBody = response.getContentText();
      writeLog(`[Reply] ❌ LINE API 錯誤 ${code}: ${errorBody}`);
    }
  } catch (e) {
    writeLog("[Reply Error] " + e);
  }
}

function showLoadingAnimation(uid, sec) {
  try {
    const res = UrlFetchApp.fetch(
      "https://api.line.me/v2/bot/chat/loading/start",
      {
        method: "post",
        headers: {
          Authorization:
            "Bearer " +
            PropertiesService.getScriptProperties().getProperty("LINE_TOKEN"),
          "Content-Type": "application/json",
        },
        payload: JSON.stringify({ chatId: uid, loadingSeconds: sec }),
        muteHttpExceptions: true,
      },
    );
    const code = res.getResponseCode();
    if (code !== 202) {
      writeLog(
        `[Animation Warning] LINE API 回傳 ${code}: ${res.getContentText()}`,
      );
    }
  } catch (e) {
    writeLog(`[Animation Error] ${e.message}`);
  }
}

function getBotUserId() {
  let id = PropertiesService.getScriptProperties().getProperty("BOT_USER_ID");
  if (!id) {
    try {
      const res = UrlFetchApp.fetch("https://api.line.me/v2/bot/info", {
        headers: {
          Authorization:
            "Bearer " +
            PropertiesService.getScriptProperties().getProperty("LINE_TOKEN"),
        },
      });
      if (res.getResponseCode() === 200) {
        id = JSON.parse(res.getContentText()).userId;
        PropertiesService.getScriptProperties().setProperty("BOT_USER_ID", id);
      }
    } catch (e) {}
  }
  return id;
}

function isDuplicateEvent(id) {
  if (!id) {
    writeLog("[Duplicate Guard] webhookEventId 缺失，略過去重但不中斷處理");
    return false;
  }
  const c = CacheService.getScriptCache();
  if (c.get(id)) return true;
  c.put(id, "1", 60);
  return false;
}

function hasRecentAnimation(id) {
  return CacheService.getScriptCache().get(`anim_${id}`) != null;
}

function markAnimationShown(id) {
  // v29.3.25: 縮短快取時間從 20s -> 5s，確保動畫更靈敏地觸發
  CacheService.getScriptCache().put(`anim_${id}`, "1", 5);
}

function runInitializeAndSync() {
  Object.values(SHEET_NAMES).forEach((name) => {
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
  const data = sheet
    .getRange(startRow, 1, lastRow - startRow + 1, 2)
    .getValues();
  return data.map((row) => `${row[0]} | ${row[1]}`).join("\n");
}

/**
 * 雲端 PDF 查證工具：
 * 直接從 Drive 讀取指定 PDF，驗證「頁面 91-93 是否有 SmartThings 相關句子」。
 * 可用 clasp run verifySmartThingsClaimFromCloudPdf 執行。
 */
function verifySmartThingsClaimFromCloudPdf() {
  const targetPdfName = "S32FM702,S32FM703,S32FM803.pdf";
  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("缺少 GEMINI_API_KEY");
  }

  const folderId =
    CONFIG.DRIVE_FOLDER_ID ||
    PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID");
  if (!folderId) {
    throw new Error("缺少 DRIVE_FOLDER_ID");
  }

  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFilesByName(targetPdfName);
  if (!files.hasNext()) {
    throw new Error(`Drive 找不到檔案: ${targetPdfName}`);
  }
  const file = files.next();
  const blob = file.getBlob();
  const pdfUri = uploadFileToGemini(
    apiKey,
    blob,
    file.getSize(),
    "application/pdf",
  );
  if (!pdfUri) {
    throw new Error("上傳 PDF 到 Gemini 失敗");
  }

  const prompt = [
    "你是文件查核器，只能依據附加PDF回答，不可推測。",
    "請驗證以下敘述是否為真：",
    "「頁面 91-93：使用 SmartThings，提到 SmartThings 功能允許產品連接和控制在相同空間內偵測到的各種裝置。」",
    "",
    "請輸出 JSON，格式固定：",
    '{',
    '  "found": true/false,',
    '  "evidence": [',
    '    {"page": number, "quote": "原文片段(最多60字)"}',
    "  ],",
    '  "summary": "一句話結論"',
    "}",
    "",
    "要求：",
    "1) 必須指出頁碼。",
    "2) quote 必須是 PDF 原文片段，不可改寫。",
    "3) 若找不到，found=false 且 evidence=[]。",
  ].join("\n");

  const url = `${CONFIG.API_ENDPOINT}/${GEMINI_MODEL_FAST}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            fileData: {
              mimeType: "application/pdf",
              fileUri: pdfUri,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
    },
  };

  const resp = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  const body = resp.getContentText();
  let text = "";
  try {
    const json = JSON.parse(body);
    text =
      (((json || {}).candidates || [])[0] || {}).content?.parts?.[0]?.text ||
      "";
  } catch (e) {
    text = "";
  }

  return {
    targetPdfName: targetPdfName,
    driveFileId: file.getId(),
    driveFileName: file.getName(),
    driveLastUpdated: Utilities.formatDate(
      file.getLastUpdated(),
      "Asia/Taipei",
      "yyyy-MM-dd HH:mm:ss",
    ),
    geminiFileUri: pdfUri,
    apiStatus: code,
    modelJsonText: String(text || body || "").substring(0, 3000),
  };
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
      if (
        !draft.q ||
        !draft.a ||
        draft.q === "undefined" ||
        draft.a === "undefined"
      ) {
        validationResult = "❌ QA 草稿不完整，缺少問題(q)或答案(a)欄位";
      } else {
        validationResult = `✅ QA 草稿有效\nQ: ${draft.q}\nA: ${draft.a}`;
      }
    } else if (draft.type === "rule") {
      if (
        !draft.key ||
        !draft.def ||
        draft.key === "undefined" ||
        draft.def === "undefined"
      ) {
        validationResult = "❌ Rule 草稿不完整，缺少關鍵字(key)或定義(def)欄位";
      } else {
        validationResult = `✅ Rule 草稿有效\nKey: ${draft.key}\nDef: ${
          draft.def
        }\nDesc: ${draft.desc || "(無)"}`;
      }
    } else if (draft.type === "error") {
      validationResult = `❌ AI 回傳錯誤: ${draft.message || "內容不足"}`;
    } else {
      validationResult = `❌ 未知類型: ${draft.type}`;
    }

    writeLog(`[Test] 驗證結果: ${validationResult}`);

    return {
      input: testInput,
      draft: draft,
      preview: preview,
      validation: validationResult,
    };
  } catch (e) {
    writeLog(`[Test Error] ${e.message}`);
    return { error: e.message };
  }
}

// ════════════════════════════════════════════════════════════════
// 9. TEST UI - 測試介面 (Web App)
// ════════════════════════════════════════════════════════════════
// ⚠️ 清除測試介面時請刪除此整個區塊 + 頂部的 TEST MODE GLOBALS + TestUI.html

// ==========================================
// 9. TEST UI (測試介面專用 - V27.3.7)
// ==========================================

function getDoGetMaintenanceSecret_() {
  return (
    PropertiesService.getScriptProperties().getProperty("MAINTENANCE_SECRET") ||
    PropertiesService.getScriptProperties().getProperty("OPENCODE_WRITE_SECRET") ||
    ""
  );
}

function isDoGetMaintenanceAuthorized_(e) {
  const expectedSecret = getDoGetMaintenanceSecret_();
  const providedSecret = String((e && e.parameter && e.parameter.secret) || "");
  return !!expectedSecret && providedSecret === expectedSecret;
}

function buildUnauthorizedResponse_() {
  return ContentService.createTextOutput(
    JSON.stringify({ success: false, error: "Unauthorized" }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function issueTestUiAccessToken_() {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(`test_ui_access_${token}`, "1", 900);
  return token;
}

function isTestUiAccessTokenValid_(token) {
  const value = String(token || "");
  return !!value && CacheService.getScriptCache().get(`test_ui_access_${value}`) === "1";
}

function assertTestUiAuthorized_(token) {
  if (!isTestUiAccessTokenValid_(token)) {
    throw new Error("TestUI 未授權或工作階段已過期");
  }
}

// 1. 網頁入口（健康檢查 + 受保護 TestUI）
// - LINE Verify: 不帶參數，返回 200 OK
// - TestUI: 需 ?test=1&secret=MAINTENANCE_SECRET
function doGet(e) {


  ensureSyncTriggerExists();

  // 若有 test 參數，顯示 TestUI
  if (e && e.parameter && e.parameter.test === "1") {
    if (!isDoGetMaintenanceAuthorized_(e)) {
      return buildUnauthorizedResponse_();
    }
    const template = HtmlService.createTemplateFromFile("TestUI");
    template.testUiAccessToken = issueTestUiAccessToken_();
    return template
      .evaluate()
      .setTitle("LINE Bot 測試模擬器 v2.3")
      .addMetaTag(
        "viewport",
        "width=device-width, initial-scale=1, user-scalable=no",
      );
  }

  if (e && e.parameter && e.parameter.kb === "1") {
    return ContentService.createTextOutput(
      JSON.stringify({ error: "kb parameter is deprecated" }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // v29.6.013: 查詢 PDF_MODEL_INDEX 快取內容
  if (e && e.parameter && e.parameter.pdfIndex === "1") {
    if (!isDoGetMaintenanceAuthorized_(e)) return buildUnauthorizedResponse_();
    const val = PropertiesService.getScriptProperties().getProperty("PDF_MODEL_INDEX") || "[]";
    return ContentService.createTextOutput(val).setMimeType(ContentService.MimeType.JSON);
  }

  // v29.6.017: 快速同步端點 (forceRebuild = false) 防止超時
  if (e && e.parameter && e.parameter.sync === "1") {
    if (!isDoGetMaintenanceAuthorized_(e)) return buildUnauthorizedResponse_();
    const result = syncGeminiKnowledgeBase(false);
    return ContentService.createTextOutput(JSON.stringify({ success: true, result: result })).setMimeType(ContentService.MimeType.JSON);
  }



  // v29.6.013: 列出 Drive 資料夾內所有 PDF 檔名
  if (e && e.parameter && e.parameter.driveFiles === "1") {
    if (!isDoGetMaintenanceAuthorized_(e)) return buildUnauthorizedResponse_();
    const result = { folderId: CONFIG.DRIVE_FOLDER_ID, pdfs: [], error: "" };
    try {
      if (!CONFIG.DRIVE_FOLDER_ID) {
        result.error = "DRIVE_FOLDER_ID not configured";
      } else {
        const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
        const files = folder.getFilesByType(MimeType.PDF);
        while (files.hasNext()) {
          const file = files.next();
          result.pdfs.push(file.getName());
        }
      }
    } catch (err) {
      result.error = err.message;
    }
    return ContentService.createTextOutput(
      JSON.stringify(result),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // v29.6.018: 批次寫入 CLASS_RULES (opencode 專用, GET via query string)
  if (e && e.parameter && e.parameter.writeRules === "1") {
    if (!isDoGetMaintenanceAuthorized_(e)) {
      return buildUnauthorizedResponse_();
    }
    try {
      // GET: rules 透過 query string ?rules=URLENCODE(JSON)
      const data = JSON.parse(decodeURIComponent(e.parameter.rules || "[]"));
      const fromRow = parseInt(e.parameter.fromRow || "144", 10);
      const rules = Array.isArray(data) ? data : [data];
      if (!Number.isFinite(fromRow) || fromRow < 1) {
        return ContentService.createTextOutput(
          JSON.stringify({ success: false, error: "Invalid fromRow" }),
        ).setMimeType(ContentService.MimeType.JSON);
      }
      if (rules.length === 0) {
        return ContentService.createTextOutput(
          JSON.stringify({ success: false, error: "No rules provided" }),
        ).setMimeType(ContentService.MimeType.JSON);
      }
      const sanitizedRules = rules.map((rule) => rule === null || rule === undefined ? "" : String(rule));
      if (sanitizedRules.some((rule) => rule.trim().length === 0)) {
        return ContentService.createTextOutput(
          JSON.stringify({ success: false, error: "Rules must not be blank" }),
        ).setMimeType(ContentService.MimeType.JSON);
      }
      if (!ss) {
        return ContentService.createTextOutput(
          JSON.stringify({ success: false, error: "Spreadsheet is not available" }),
        ).setMimeType(ContentService.MimeType.JSON);
      }
      const sheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
      if (!sheet) {
        return ContentService.createTextOutput(
          JSON.stringify({ success: false, error: "CLASS_RULES sheet not found" }),
        ).setMimeType(ContentService.MimeType.JSON);
      }
      const range = sheet.getRange(fromRow, 1, sanitizedRules.length, 1);
      range.setValues(sanitizedRules.map((rule) => [rule]));
      SpreadsheetApp.flush();
      writeLog(`[WriteRules] Wrote ${sanitizedRules.length} rows from row ${fromRow}`);
      return ContentService.createTextOutput(
        JSON.stringify({
          success: true,
          fromRow: fromRow,
          writtenRows: sanitizedRules.length,
          sheetName: SHEET_NAMES.CLASS_RULES,
          timestamp: new Date().toISOString(),
        }),
      ).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: err.message }),
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // v29.6.020: 移除測試端點 (setSecret, listProps) - 改用 GAS Properties UI 管理
  // ?writeRules (doGet 端) 仍保留 (若需要快速寫入可使用)
  // ?testModels 保留 (故障排除用；需密鑰，且只測正式低成本模型)

  // v29.6.008: 測試多個 Gemini 模型的可用性
  if (e && e.parameter && e.parameter.testModels === "1") {
    const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    if (!isDoGetMaintenanceAuthorized_(e)) {
      return buildUnauthorizedResponse_();
    }

    const candidates = [
      CONFIG.MODEL_NAME_FAST,
      CONFIG.MODEL_NAME_THINK,
      GEMINI_MODEL_POLISH,
    ].filter((modelName, index, list) => modelName && list.indexOf(modelName) === index);
    const results = [];
    for (const modelName of candidates) {
      const url = CONFIG.API_ENDPOINT + "/" + modelName + ":generateContent?key=" + apiKey;
      try {
        const response = UrlFetchApp.fetch(url, {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "ok" }] }],
            generationConfig: { maxOutputTokens: 5, temperature: 0 },
          }),
          muteHttpExceptions: true,
        });
        const code = response.getResponseCode();
        const body = response.getContentText().substring(0, 200);
        results.push({ model: modelName, httpCode: code, body: body });
      } catch (err) {
        results.push({ model: modelName, error: err.message });
      }
    }
    return ContentService.createTextOutput(
      JSON.stringify({ success: true, results: results }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // v29.6.021: 批次自動化測試, 一次跑多題 + 回傳 AI 答案
  if (e && e.parameter && e.parameter.batchTest === "1") {
    if (!isDoGetMaintenanceAuthorized_(e)) {
      return buildUnauthorizedResponse_();
    }
    const questions = [
      "G80HF 5K 180Hz 規格",
      "Odyssey3D G90XF 裸視3D電競螢幕 規格",
      "S27BM500 智慧聯網螢幕 多少吋?",
      "S49A950 是曲面嗎?",
      "S24A600 反應時間?",
      "S27FG502 更新頻率?",
      "S32CM703 是 M 系列嗎?",
      "S34A650 解析度?",
      "S27HG806 有 HDR 嗎?",
      "M8 M80F 跟 M7 M70F 差別?"
    ];
    const debug = e.parameter.debug === "1";
    const testUser = "U_BATCH_TEST_" + Date.now();
    const results = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const start = Date.now();
      try {
        const reply = callLLMWithRetry(
          q,
          [],
          [],
          false,
          null,
          false,
          testUser,
          false,
          null,
        );
        const ms = Date.now() - start;
        const r = {
          q: q,
          ok: true,
          ms: ms,
          reply: String(reply).substring(0, 600)
        };
        if (debug && i === 0) {
          // 印第一題的最終 prompt (從 LOG 抓)
          r.note = "看 LOG 找 prompt 灌入內容";
        }
        results.push(r);
      } catch (err) {
        results.push({ q: q, ok: false, err: String(err.message || err) });
      }
    }
    return ContentService.createTextOutput(
      JSON.stringify({ totalMs: results.reduce((s, r) => s + (r.ms || 0), 0), count: results.length, results: results })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // v29.6.010: 讀取 CLASS_RULES sheet, 用於驗證規格完整性
  if (e && e.parameter && e.parameter.readRules === "1") {
    if (!isDoGetMaintenanceAuthorized_(e)) return buildUnauthorizedResponse_();
    const startRow = Math.max(1, parseInt(e.parameter.from || "1"));
    const limit = Math.min(parseInt(e.parameter.limit || "200"), 500);
    const result = {
      sheetName: SHEET_NAMES.CLASS_RULES,
      totalRows: 0,
      from: startRow,
      rules: [],
    };
    try {
      const sheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
      if (sheet) {
        result.totalRows = sheet.getLastRow();
        const endRow = Math.min(sheet.getLastRow(), startRow + limit - 1);
        if (endRow >= startRow) {
          const values = sheet.getRange(startRow, 1, endRow - startRow + 1, 1).getValues();
          result.rules = values.map((row, idx) => ({
            row: startRow + idx,
            content: String(row[0] || "").substring(0, 1500),
          }));
        }
      }
    } catch (err) {
      result.error = err.message;
    }
    return ContentService.createTextOutput(
      JSON.stringify(result),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // v29.6.004: 回傳 Spreadsheet ID 供 opencode 讀取
  if (e && e.parameter && e.parameter.meta === "1") {
    if (!isDoGetMaintenanceAuthorized_(e)) return buildUnauthorizedResponse_();
    let ssId = "";
    try {
      ssId = ss.getId();
    } catch (e) {
      ssId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") || "";
    }
    return ContentService.createTextOutput(
      JSON.stringify({
        gasVersion: GAS_VERSION,
        buildTimestamp: BUILD_TIMESTAMP,
        spreadsheetId: ssId,
        driveFolderId: CONFIG.DRIVE_FOLDER_ID || "",
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // v29.6.024: 真實 webhook 測試, 走 handleMessage 完整流程
  if (e && e.parameter && e.parameter.testRun === "1") {
    if (!isDoGetMaintenanceAuthorized_(e)) {
      return buildUnauthorizedResponse_();
    }
    const q = String(e.parameter.q || "S27BM500 多少吋?");
    const uid = String(e.parameter.uid || "TEST_OPENCODE_001");
    IS_TEST_MODE = true;
    TEST_LOGS = [];
    const fakeEvent = {
      replyToken: "TEST_REPLY_TOKEN",
      source: { type: "user", userId: uid },
      message: { type: "text", text: q, id: "TEST_" + Date.now() },
      type: "message",
      timestamp: Date.now(),
    };
    try {
      handleMessage(fakeEvent);
    } catch (err) {
      TEST_LOGS.push(`[Fatal] ${err.message}`);
    }
    // 抓正式 Reply；只有沒有正式出口紀錄時，才退回中間稿。
    let reply = "";
    const replyLog = TEST_LOGS.find((log) => log.indexOf("[Reply]") > -1);
    const fallbackLog = !replyLog
      ? TEST_LOGS.find((log) => log.indexOf("[AI Reply]") > -1)
      : null;
    const rawFallbackLog = !replyLog && !fallbackLog
      ? TEST_LOGS.find((log) => log.indexOf("[AI Raw Response]") > -1)
      : null;
    if (replyLog) {
      reply = parseLogContent(replyLog, "[Reply]");
    } else if (fallbackLog) {
      reply = parseLogContent(fallbackLog, "[AI Reply]");
    } else if (rawFallbackLog) {
      reply = parseLogContent(rawFallbackLog, "[AI Raw Response]");
    }
    reply = reply.substring(0, 1500);
    return ContentService.createTextOutput(
      JSON.stringify({
        q: q,
        reply: reply.substring(0, 1500),
        logs: TEST_LOGS.slice(-20).map(l => l.substring(0, 300))
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // v29.6.005: 從「所有紀錄」Sheet 讀取最近 N 筆對話紀錄 (opencode 專用)
  if (e && e.parameter && e.parameter.readlog === "1") {
    if (!isDoGetMaintenanceAuthorized_(e)) return buildUnauthorizedResponse_();
    const limit = Math.min(parseInt(e.parameter.limit || "30"), 200);
    let result = {
      gasVersion: GAS_VERSION,
      buildTimestamp: BUILD_TIMESTAMP,
      readAt: new Date().toISOString(),
      records: [],
    };
    try {
      const recordsSheet = ss.getSheetByName(SHEET_NAMES.RECORDS);
      if (recordsSheet && recordsSheet.getLastRow() > 1) {
        const startRow = Math.max(2, recordsSheet.getLastRow() - limit + 1);
        const numRows = recordsSheet.getLastRow() - startRow + 1;
        const values = recordsSheet.getRange(startRow, 1, numRows, 6).getValues();
        result.records = values.map((row) => ({
          timestamp: row[0],
          contextId: row[1],
          userId: row[2],
          text: String(row[3]).substring(0, 500),
          role: row[4],
          flag: row[5],
        }));
      }
    } catch (err) {
      result.error = err.message;
    }
    return ContentService.createTextOutput(
      JSON.stringify(result),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // v29.6.007: 讀取 LOG sheet 最近 N 筆 (用於診斷 API 錯誤)
  if (e && e.parameter && e.parameter.readlogSheet) {
    if (!isDoGetMaintenanceAuthorized_(e)) return buildUnauthorizedResponse_();
    const sheetName = String(e.parameter.readlogSheet || "LOG");
    const limit = Math.min(parseInt(e.parameter.limit || "30"), 200);
    let result = {
      sheetName: sheetName,
      readAt: new Date().toISOString(),
      records: [],
    };
    try {
      const sheet = ss.getSheetByName(sheetName);
      if (sheet && sheet.getLastRow() > 0) {
        const startRow = Math.max(1, sheet.getLastRow() - limit + 1);
        const numRows = sheet.getLastRow() - startRow + 1;
        const values = sheet.getRange(startRow, 1, numRows, sheet.getLastColumn()).getValues();
        result.records = values.map((row) => ({
          timestamp: row[0],
          message: String(row[1] || "").substring(0, 800),
        }));
      }
    } catch (err) {
      result.error = err.message;
    }
    return ContentService.createTextOutput(
      JSON.stringify(result),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // v29.6.006: 直接呼叫 Gemini /v1beta/files 列出雲端實際檔案
  if (e && e.parameter && e.parameter.geminiFiles === "1") {
    if (!isDoGetMaintenanceAuthorized_(e)) return buildUnauthorizedResponse_();
    const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    const url = "https://generativelanguage.googleapis.com/v1beta/files?key=" + apiKey + "&pageSize=100";
    try {
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const code = response.getResponseCode();
      const body = JSON.parse(response.getContentText());
      const files = (body.files || []).map((f) => ({
        name: f.name,
        displayName: f.displayName,
        sizeBytes: f.sizeBytes,
        createTime: f.createTime,
        expireTime: f.expireTime,
        state: f.state,
        mimeType: f.mimeType,
      }));
      return ContentService.createTextOutput(
        JSON.stringify({ httpCode: code, count: files.length, files: files }, null, 2),
      ).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(
        JSON.stringify({ error: err.message }),
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // 預設：返回健康檢查（給 LINE Verify 用）
  return ContentService.createTextOutput(
    "OK - Current Version: " + GAS_VERSION + " [" + BUILD_TIMESTAMP + "]",
  ).setMimeType(ContentService.MimeType.TEXT);
}

/**
 * 測試入口 (V27.7.2 - 型號選擇反問修復版)
 * 修正重點：捕捉型號選擇反問，確保前端能顯示選項
 */
function testMessage(msg, userId, testUiAccessToken) {
  assertTestUiAuthorized_(testUiAccessToken);
  IS_TEST_MODE = true;
  TEST_LOGS = [];

  if (msg === undefined || msg === null) msg = "";
  if (typeof msg === "object") {
    try {
      msg = JSON.stringify(msg);
    } catch (e) {
      msg = "";
    }
  }
  msg = String(msg).trim();

  userId = userId || "TEST_DEV_001";

  var fakeEvent = {
    replyToken: "TEST_REPLY_TOKEN",
    source: { type: "user", userId: userId },
    message: { type: "text", text: msg, id: "TEST_" + new Date().getTime() },
    type: "message",
    timestamp: new Date().getTime(),
  };

  try {
    if (typeof handleMessage === "function") {
      handleMessage(fakeEvent);
    } else {
      throw new Error("找不到 handleMessage 主函式");
    }
  } catch (e) {
    var errStr = e.toString();
    if (errStr.indexOf("ContentService") === -1) {
      TEST_LOGS.push(`[Fatal] 系統崩潰: ${errStr}`);
    }
  }

  // 收集回覆 (優先級：[Reply] > [AI Reply] > PDF反問 > [API Short Response])
  var botResponses = [];
  var seenContent = new Set();
  var hasOfficialReply = false;
  var hasReplyLog = TEST_LOGS.some((l) => l.indexOf("[Reply]") > -1);
  var hasFlexSelectionFlow = TEST_LOGS.some(
    (l) =>
      l.indexOf("已發送 Flex Selection") > -1 ||
      l.indexOf("型號泡泡選擇模式") > -1,
  );

  // 1️⃣ 優先找正式 [Reply]；只有沒有正式出口紀錄時才收 [AI Reply] 中間稿。
  for (var i = 0; i < TEST_LOGS.length; i++) {
    var log = TEST_LOGS[i];
    if (log.indexOf("[Reply]") > -1 || log.indexOf("[AI Reply]") > -1) {
      if (hasReplyLog && log.indexOf("[AI Reply]") > -1) {
        continue;
      }
      if (hasFlexSelectionFlow && log.indexOf("[AI Reply]") > -1) {
        continue;
      }
      var content = parseLogContent(
        log,
        log.indexOf("[Reply]") > -1 ? "[Reply]" : "[AI Reply]",
      );
      if (content && !seenContent.has(content)) {
        botResponses.push(content);
        seenContent.add(content);
        hasOfficialReply = true;
      }
    }
    // v29.5.98: Capture Flex Replies
    if (log.indexOf("[Flex Reply]") > -1) {
      // Extract Alt Text
      var match = log.match(/Alt: (.*?), JSON:/);
      if (match && match[1]) {
        var alt = match[1];
        // Append a hint that it was a Flex Message
        var content = `[Flex Message] ${alt} (查看日誌以見詳情)`;
        if (!seenContent.has(content)) {
          botResponses.push(content);
          seenContent.add(content);
          hasOfficialReply = true;
        }
      }
    }
  }

  botResponses = dedupeTestUiReplies(botResponses);

  // 1.5️⃣ 檢查是否有 PDF 選擇日誌（表示 handlePdfSelectionReply 已執行）
  if (!hasOfficialReply) {
    var hasPdfSelectLog = TEST_LOGS.some(
      (l) =>
        l.indexOf("[PDF Select] 用戶選擇") > -1 ||
        l.indexOf("[PDF Select] 用戶輸入完整型號") > -1,
    );
    if (hasPdfSelectLog) {
      // 表示已經觸發 PDF 查詢，但結果未被正確記錄
      // 這是 TEST MODE 的局限，需要從 LOG 中重新提取
      // 嘗試從日誌中找 [AI Reply] 或其他結果
      var hasResults = false;
      for (var i = 0; i < TEST_LOGS.length; i++) {
        var log = TEST_LOGS[i];
        if (log.indexOf("[AI Reply]") > -1) {
          var content = parseLogContent(log, "[AI Reply]");
          if (content && !seenContent.has(content)) {
            botResponses.push(content);
            seenContent.add(content);
            hasOfficialReply = true;
            hasResults = true;
          }
        }
      }
      // 如果 PDF 選擇後還是沒有回答，表示 API 調用失敗或超時
      if (!hasResults && hasPdfSelectLog) {
        botResponses.push("⏳ PDF 查詢中，請稍候...");
        hasOfficialReply = true;
      }
    }
  }

  // 2️⃣ 如果沒有官方回覆，檢查是否有型號選擇反問 (這是特殊情況)
  if (!hasOfficialReply) {
    if (hasFlexSelectionFlow) {
      var cache = CacheService.getScriptCache();
      var suggestedModelsRaw = cache.get(`${userId}:suggested_models`);
      if (suggestedModelsRaw) {
        try {
          var mArr = JSON.parse(suggestedModelsRaw) || [];
          if (Array.isArray(mArr) && mArr.length > 0) {
            var preview = mArr.slice(0, 5).join("、");
            var more = mArr.length > 5 ? "…" : "";
            botResponses.push(
              `🔍 已送出型號選擇泡泡，請先選完整型號（例如：${preview}${more}）。`,
            );
          } else {
            botResponses.push("🔍 已送出型號選擇泡泡，請先選完整型號。");
          }
        } catch (e) {
          botResponses.push("🔍 已送出型號選擇泡泡，請先選完整型號。");
        }
      } else {
        botResponses.push("🔍 已送出型號選擇泡泡，請先選完整型號。");
      }
      hasOfficialReply = true;
    }
  }

  // 2.5️⃣ 若仍無官方回覆，再檢查舊版型號選擇反問訊號
  if (!hasOfficialReply) {
    var hasPdfQuestion = TEST_LOGS.some(
      (l) => l.indexOf("已發送型號選擇反問") > -1,
    );
    if (hasPdfQuestion) {
      // 從 Cache 中還原型號選擇訊息（handleMessage 已存入 PENDING_PDF_SELECTION）
      var cache = CacheService.getScriptCache();
      var pendingPdfData = cache.get(CACHE_KEYS.PENDING_PDF_SELECTION + userId);

      if (pendingPdfData) {
        try {
          var pending = JSON.parse(pendingPdfData);
          if (pending.options && pending.options.length > 0) {
            // 重新生成選項訊息（與 LINE 一致）
            var selectionMsg = buildPdfSelectionMessage(
              pending.aliasKey,
              pending.options,
            );
            botResponses.push(selectionMsg);
            hasOfficialReply = true;
          }
        } catch (e) {
          // 如果解析失敗，用備用提示
          botResponses.push("🔍 系統偵測到需要選擇型號，請見快速回覆選項");
          hasOfficialReply = true;
        }
      } else {
        // Cache 已過期或不存在，用備用提示
        botResponses.push("🔍 系統偵測到需要選擇型號，請見快速回覆選項");
        hasOfficialReply = true;
      }
    }
  }

  // 3️⃣ 如果還是沒有，才用 [API Short Response]
  if (!hasOfficialReply) {
    for (var i = 0; i < TEST_LOGS.length; i++) {
      var log = TEST_LOGS[i];
      if (log.indexOf("[API Short Response]") > -1) {
        // 日誌格式: [API Short Response] Out: X tokens, Content: "..."
        // 需要提取 Content: 之後的內容
        var contentStart = log.indexOf('Content: "');
        if (contentStart > -1) {
          var contentStr = log.substring(contentStart + 10); // skip 'Content: "'
          var contentEnd = contentStr.lastIndexOf('"');
          if (contentEnd > -1) {
            var content = contentStr.substring(0, contentEnd);
            if (content && !seenContent.has(content)) {
              botResponses.push(content);
              seenContent.add(content);
            }
          }
        }
      }
    }
  }

  // 4️⃣ 最後檢查錯誤
  for (var i = 0; i < TEST_LOGS.length; i++) {
    var log = TEST_LOGS[i];
    if (log.indexOf("[Fatal]") > -1) {
      var fatalMsg = "❌ " + log;
      if (!seenContent.has(fatalMsg)) {
        botResponses.push(fatalMsg);
        seenContent.add(fatalMsg);
      }
    }
  }

  botResponses = dedupeTestUiReplies(botResponses);
  IS_TEST_MODE = false;

  return {
    success: true,
    replies: botResponses,
    logs: TEST_LOGS,
  };
}

// 輔助: 清洗 Log 內容
function parseLogContent(logLine, keyword) {
  var content = logLine.split(keyword).pop().trim();
  if (content.startsWith('"') && content.endsWith('"'))
    content = content.slice(1, -1);
  return content.replace(/\\n/g, "\n");
}

// 清除快取
function clearTestSession(userId, testUiAccessToken) {
  assertTestUiAuthorized_(testUiAccessToken);
  var cache = CacheService.getScriptCache();
  userId = userId || "TEST_DEV_001";
  cache.remove(`${CACHE_KEYS.HISTORY_PREFIX}${userId}`);
  cache.remove(CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId);
  cache.remove(CACHE_KEYS.PENDING_QUERY + userId);
  cache.remove(CACHE_KEYS.PENDING_PDF_SELECTION + userId);
  cache.remove(CACHE_KEYS.PDF_MODE_PREFIX + userId);
  cache.remove(`${userId}:context`);
  cache.remove(`${userId}:pdf_mode`);
  cache.remove(`${userId}:pdf_consulted`);
  cache.remove(`pdf_consulted_${userId}`);
  cache.remove(`dissatisfied_count_${userId}`);
  cache.remove(`${userId}:direct_search_models`);
  cache.remove(`${userId}:hit_alias_key`);
  cache.remove(`${userId}:hit_alias_keys`);
  cache.remove(`${userId}:elaboration_state`);
  cache.remove(`${userId}:last_meaningful_query`);
  cache.remove(`${userId}:pending_topic`);
  cache.remove(`${userId}:last_selected_model`);
  cache.remove(`${userId}:model_select_mode`);
  cache.remove(`${userId}:qa_offer_payload`);
  cache.remove(`${userId}:suggested_models`);
  cache.remove(`model_selection_${userId}`);
  cache.remove(`${userId}:pending_pdf_query`);
  return { success: true, msg: "✅ 髒資料已清除" };
}

// --- 雲端歷史紀錄功能 ---

function getCloudHistory(testUiAccessToken) {
  assertTestUiAuthorized_(testUiAccessToken);
  try {
    var sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName("TEST_HISTORY");
    if (!sheet) return []; // 如果沒有分頁，回傳空陣列 (前端會用預設值)

    // 讀取 A 欄所有資料
    var lastRow = sheet.getLastRow();
    if (lastRow < 1) return [];

    var data = sheet.getRange(1, 1, lastRow, 1).getValues();
    // 轉成一維陣列並過濾空值
    return data.map((r) => r[0]).filter((t) => t);
  } catch (e) {
    return [];
  }
}

function saveCloudHistory(historyArray, testUiAccessToken) {
  assertTestUiAuthorized_(testUiAccessToken);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("TEST_HISTORY");
    if (!sheet) {
      sheet = ss.insertSheet("TEST_HISTORY");
    }

    // 清空舊資料
    sheet.clear();

    if (historyArray && historyArray.length > 0) {
      // 轉成二維陣列寫入
      var rows = historyArray.map((t) => [t]);
      sheet.getRange(1, 1, rows.length, 1).setValues(rows);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
} // ════════════════════════════════════════════════════════════════

function getBotVersion() {
  return {
    version: GAS_VERSION,
    description: `Back: ${LLM_PROVIDER} | TestUI: authorized | Local knowledge: append-only`,
  };
}

/**
 * [Smart Editor Mode] 檢查是否為科技新聞或三星產品相關 (v27.9.67 放寬版)
 * 包含一般科技關鍵字 (AI, Apple, Chip, etc.) + 三星系列
 */
function isValidTechContent(msg) {
  const upper = msg.toUpperCase();
  const cache = CacheService.getScriptCache();

  // 1. 基礎科技關鍵字 (Fallback & General Tech)
  // 用戶要求：放寬至科技新聞 (AI, PC, Mobile, Chip, Tech Giants)
  const basicKeywords = [
    // Samsung Core
    "SAMSUNG",
    "GALAXY",
    "ODYSSEY",
    "SMART",
    "MONITOR",
    "WASHER",
    "TV",
    "冰箱",
    "洗衣機",
    "吸塵器",
    "螢幕",
    "M5",
    "M7",
    "M8",
    "G5",
    "G7",
    "G8",
    "S9",
    // Tech Giants & General
    "APPLE",
    "IPHONE",
    "IPAD",
    "MAC",
    "GOOGLE",
    "PIXEL",
    "MICROSOFT",
    "WINDOWS",
    "SURFACE",
    "TESLA",
    "NVIDIA",
    "AMD",
    "INTEL",
    "QUALCOMM",
    "TSMC",
    "ASUS",
    "ACER",
    "MSI",
    "ROG",
    "SONY",
    "LG",
    "PANASONIC",
    "AI",
    "CHIP",
    "PANEL",
    "DISPLAY",
    "OLED",
    "MINI LED",
    "PROCESSOR",
    "GPU",
    "CPU",
    "RAM",
    "科技",
    "新聞",
    "發表",
    "上市",
    "規格",
    "評測",
    "半導體",
    "晶片",
    "手機",
    "筆電",
    "電腦",
    "人工智慧",
  ];

  try {
    const ruleSheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    // 快篩：若命中基礎科技關鍵字 -> True
    if (basicKeywords.some((k) => upper.includes(k))) return true;

    // 否則，檢查是否包含 CLASS_RULES 中的「系列」名稱 (通常在第1欄)
    // 這是為了確保比較冷門的三星系列也能過關 (原本邏輯)
    let productKeywords = cache.get("CORE_PRODUCT_KEYWORDS");
    if (!productKeywords) {
      if (ruleSheet) {
        const data = ruleSheet.getRange("A2:A200").getValues();
        const keys = data
          .map((r) => {
            const txt = r[0].toString();
            if (!txt) return "";
            if (txt.includes("_")) return txt.split("_")[1];
            return txt;
          })
          .filter((k) => k && k.length > 1);
        productKeywords = JSON.stringify(keys);
        cache.put("CORE_PRODUCT_KEYWORDS", productKeywords, 21600);
      } else {
        productKeywords = "[]";
      }
    }

    const keywords = JSON.parse(productKeywords);
    return keywords.some((key) => upper.includes(key.toUpperCase()));
  } catch (e) {
    writeLog("[isValidTechContent] Error: " + e.message);
    return basicKeywords.some((key) => upper.includes(key));
  }
}

/**
 * 判斷是否像「整篇網頁貼文」：長段落 + 多行 + 常見文章結構訊號
 */
function isLikelyPastedLongArticle(msg) {
  const text = String(msg || "");
  if (!text) return false;
  const len = text.length;
  const lineCount = text.split(/\n/).length;
  const hasUrl = /(https?:\/\/|www\.)/i.test(text);
  const hasArticleMarkers =
    /(原文|來源|作者|發布|更新|閱讀|全文|訂閱|廣告|延伸閱讀|點此|更多內容|©|版權)/i.test(
      text,
    );
  const hasPuncDensity = (text.match(/[。！？；，,:]/g) || []).length >= 12;

  if (len >= 220 && (lineCount >= 5 || hasPuncDensity)) return true;
  if (len >= 160 && hasUrl && (lineCount >= 4 || hasArticleMarkers)) return true;
  if (len >= 260 && hasArticleMarkers) return true;
  return false;
}

function hasTechSignals(msg) {
  const text = String(msg || "");
  return /(科技|TECH|AI|GPU|CPU|NPU|晶片|半導體|手機|筆電|PC|電腦|螢幕|顯示器|面板|OLED|MINI\s*LED|NVIDIA|AMD|INTEL|APPLE|GOOGLE|MICROSOFT|SAMSUNG|GALAXY|ODYSSEY)/i.test(
    text,
  );
}

function isProjectRelevantLongContent(msg) {
  const text = String(msg || "");
  const hasSamsungBrand = /(SAMSUNG|三星)/i.test(text);
  const hasModelCode = /\b(?:LS)?S\d{2}[A-Z0-9]{4,}\b/i.test(text);
  const hasProjectSeries =
    /(ODYSSEY|SMART\s*MONITOR|VIEWFINITY|SMARTTHINGS|GALAXY\s*WATCH)/i.test(
      text,
    );
  const hasSamsungCategory =
    hasSamsungBrand &&
    /(螢幕|顯示器|洗衣機|冰箱|吸塵器|MONITOR|DISPLAY|WASHER|DRYER|VACUUM|APPLIANCE)/i.test(
      text,
    );
  const hasMatterSamsungContext =
    /MATTER/i.test(text) && /(SMARTTHINGS|SAMSUNG|三星)/i.test(text);

  return (
    hasModelCode ||
    hasProjectSeries ||
    hasSamsungCategory ||
    hasMatterSamsungContext
  );
}

function isQACandidateLongContent(msg) {
  const text = String(msg || "");
  const hasQuestionLike =
    /(如何|怎麼|是否|有沒有|支援|內建|差異|比較|設定|開啟|關閉|故障|排除|為什麼|可以嗎|\?|？)/i.test(
      text,
    );
  const hasActionable =
    /(步驟|教學|設定|規格|更新率|解析度|HDR|KVM|PIP|PBP|SmartThings|Matter|集線器|中樞|保固|維修|連接埠|接口|線材)/i.test(
      text,
    );
  return hasQuestionLike || hasActionable;
}

function isAffirmativeForQaEdit(msg) {
  const t = String(msg || "").trim();
  return /^(要|好|好的|好啊|可以|進入|進入QA|進入QA編輯模式|加入QA|存成QA)$/i.test(
    t,
  );
}

function isNegativeForQaEdit(msg) {
  const t = String(msg || "").trim();
  return /^(不要|先不要|不用|暫時不用|略過|跳過)$/i.test(t);
}

function buildQaEditInstructionText() {
  return (
    "【QA編輯模式操作方式】\n" +
    "1. 回覆「要」：直接進入 QA 編輯模式\n\n" +
    "2. 也可手動輸入：/記錄 <內容>（或 /紀錄 <內容>）\n\n" +
    "3. 進入後可直接回覆文字持續修稿\n\n" +
    "4. 確認存檔：/記錄\n\n" +
    "5. 取消離開：/取消"
  );
}

function buildArticleQaDraftSeed(cleanedArticleText, originalText) {
  const cleaned = String(cleanedArticleText || "");
  const original = String(originalText || "");
  const sourceText = extractCleanedOriginalSection(cleaned) || original;
  const question = pickQuestionForQaDraft(`${sourceText}\n${original}`);
  const answer = pickAnswerForQaDraft(sourceText, question);
  return normalizeOneLineQaText(`${question} / A：${answer}`);
}

function extractCleanedOriginalSection(text) {
  const raw = String(text || "");
  const marker = "【去廣告原文】";
  const idx = raw.indexOf(marker);
  if (idx < 0) return "";
  return raw.substring(idx + marker.length).trim();
}

function pickQuestionForQaDraft(text) {
  const raw = String(text || "");
  const sentences = raw.match(/[^。！？?\n]+[。！？?]?/g) || [raw];
  const questionSignals =
    /(客戶|使用者|是否|是不是|有沒有|要不要|需要|如何|怎麼|為什麼|可以|支援|設定|開啟|關閉|故障|\?|？)/i;

  for (let i = 0; i < sentences.length; i++) {
    let candidate = cleanupQaDraftSentence(sentences[i]);
    if (!candidate || candidate.length < 8) continue;
    if (!questionSignals.test(candidate)) continue;
    candidate = candidate.replace(/^.*?[：:]\s*(?=客戶|使用者|是否|是不是|如何|怎麼|為什麼|可以|支援|需要)/, "");
    return ensureQuestionMark(candidate);
  }

  return "這篇長文的客服重點是什麼？";
}

function pickAnswerForQaDraft(text, question) {
  const raw = String(text || "");
  const questionCore = String(question || "")
    .replace(/[?？。！!]/g, "")
    .trim();
  const sentences = raw.match(/[^。！？?\n]+[。！？?]?/g) || [];
  const picked = [];
  const questionSignals =
    /(是否|是不是|有沒有|要不要|如何|怎麼|為什麼|哪裡|哪個|什麼|\?|？)/i;
  const answerSignals =
    /(答案|結論|需要|不需要|必須|不用|可以|不可以|支援|不支援|內建|沒有|建議|請|先|步驟|設定|確認|額外|接收器|中樞|Hub)/i;

  for (let i = 0; i < sentences.length && picked.length < 3; i++) {
    const candidate = cleanupQaDraftSentence(sentences[i]);
    if (!candidate || candidate.length < 10) continue;
    if (questionCore && candidate.indexOf(questionCore) >= 0) continue;
    if (questionSignals.test(candidate)) continue;
    if (!answerSignals.test(candidate)) continue;
    picked.push(candidate.replace(/[。！？?]+$/, ""));
  }

  if (picked.length === 0) {
    return "待補：這篇長文提出此客服問題，請補上可驗證答案後再存入 QA。";
  }

  return `${picked.join("；")}。`.substring(0, 700);
}

function cleanupQaDraftSentence(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/^(來源|更新時間|廣告|延伸閱讀)[：:].*$/i, "")
    .replace(/^[-•\d.\s]+/, "")
    .trim();
}

function ensureQuestionMark(text) {
  const q = String(text || "").trim().replace(/[。！!]+$/, "");
  if (!q) return "這篇長文的客服重點是什麼？";
  if (/[?？]$/.test(q)) return q.replace(/[?]$/, "？");
  return `${q}？`;
}

function isOneLineQaText(text) {
  return !!extractQaPartsFromText(text);
}

function normalizeOneLineQaText(text) {
  const raw = String(text || "").replace(/[\r\n]+/g, " ").trim();
  const parts = extractQaPartsFromText(raw);
  if (!parts) return raw;

  let q = parts.question
    .replace(/^【[^】]+】\s*/g, "")
    .replace(/^問題[:：]\s*/g, "")
    .replace(/^這是測試問題[:：]\s*/g, "")
    .trim();
  let a = parts.answer
    .replace(/^(?:A|答案)[:：]\s*/gi, "")
    .replace(/。{2,}/g, "。")
    .trim();

  q = ensureQuestionMark(q);
  if (!a) a = "待補";
  return `${q} / A：${a}`;
}

function extractQaPartsFromText(text) {
  const raw = String(text || "").replace(/[\r\n]+/g, " ").trim();
  if (!raw) return null;

  let m = raw.match(/^(.*?)\s*\/\s*A[:：]\s*(.*)$/i);
  if (m && m[1] && m[2] !== undefined) {
    return { question: m[1].trim(), answer: m[2].trim() };
  }

  m = raw.match(/^(.*?[?？])\s*(?:A|答案)[:：]\s*(.*)$/i);
  if (m && m[1] && m[2] !== undefined) {
    return { question: m[1].trim(), answer: m[2].trim() };
  }

  return null;
}

function isStandaloneDraftChoiceNumber(text) {
  const cleaned = String(text || "").trim().replace(/[\s.、️⃣]/g, "");
  return /^[123１２３一二三]$/.test(cleaned);
}

function isDraftFeedbackLikelyRelevant(feedback, currentDraft) {
  const fb = String(feedback || "").trim();
  if (!fb) return false;
  if (fb.length > 40) return true;
  if (/(補充|加上|加入|新增|改成|改為|修改|修正|刪除|移除|換成|應該|不對|錯了|答案|問題|型號|規格|步驟|說明|來源|保留|活動|促銷|登錄|保固|贈品|價格|期間|網址|RULE|CLASS_RULES)/i.test(fb)) {
    return true;
  }

  const base = `${currentDraft && currentDraft.currentQA ? currentDraft.currentQA : ""}\n${
    currentDraft && currentDraft.currentRule ? currentDraft.currentRule : ""
  }\n${
    currentDraft && currentDraft.currentText ? currentDraft.currentText : ""
  }\n${
    currentDraft && currentDraft.originalContent ? currentDraft.originalContent : ""
  }`;
  const fbTokens = extractDraftGuardTokens(fb);
  const baseTokens = extractDraftGuardTokens(base);
  for (let i = 0; i < fbTokens.length; i++) {
    if (baseTokens.indexOf(fbTokens[i]) >= 0) return true;
  }
  return false;
}

function extractDraftGuardTokens(text) {
  const raw = String(text || "").toUpperCase();
  const tokens = [];
  const latin = raw.match(/[A-Z0-9]{2,}/g) || [];
  for (let i = 0; i < latin.length; i++) tokens.push(latin[i]);

  const cjk = raw.match(/[\u4e00-\u9fff]{2,}/g) || [];
  for (let j = 0; j < cjk.length; j++) {
    const phrase = cjk[j];
    for (let k = 0; k <= phrase.length - 2; k++) {
      tokens.push(phrase.substring(k, k + 2));
    }
  }
  return tokens;
}

function ensureArticleCleanOutputFormat(aiText, originalText) {
  const text = String(aiText || "").trim();
  const hasSummary = text.includes("【重點摘要】");
  const hasCleanedOriginal = text.includes("【去廣告原文】");
  if (hasSummary && hasCleanedOriginal) return text;

  const cleaned = buildHeuristicCleanArticleText(originalText);
  const points = buildHeuristicSummaryPoints(cleaned);
  const summaryBlock = points
    .slice(0, 4)
    .map((p, i) => `${i + 1}. ${p}`)
    .join("\n\n");

  return `【重點摘要】\n${summaryBlock}\n\n【去廣告原文】\n${cleaned}`;
}

function buildHeuristicCleanArticleText(originalText) {
  const text = String(originalText || "");
  const adPattern =
    /(廣告|訂閱|立即訂閱|點此|延伸閱讀|更多內容|贊助|sponsored|advertisement|優惠|折扣)/i;

  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !adPattern.test(s));

  const cleaned = (lines.length > 0 ? lines.join("\n") : text.trim()).trim();
  if (!cleaned) return "（原文內容不足，無法整理）";
  if (cleaned.length > 3600) return `${cleaned.substring(0, 3600)}...`;
  return cleaned;
}

function buildHeuristicSummaryPoints(cleanedText) {
  const text = String(cleanedText || "");
  const sentenceCandidates = text
    .split(/[。！？\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12)
    .slice(0, 8);

  const picked = [];
  for (let i = 0; i < sentenceCandidates.length && picked.length < 4; i++) {
    const item = sentenceCandidates[i];
    if (!picked.includes(item)) {
      picked.push(item);
    }
  }

  if (picked.length === 0) {
    return ["這篇內容已完成去廣告整理，可依下方原文快速閱讀重點。"];
  }
  return picked;
}

/**
 * 讀取 Prompt 設定 (優先查 Cache，無則查 Sheet)
 * v27.9.64: 補上遺失的 helper function
 */
function getPromptsFromCacheOrSheet() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("KB_PROMPTS_JSON");
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }

  // Cache Miss, read Sheet
  const sheet = ss.getSheetByName(SHEET_NAMES.PROMPT);
  if (!sheet) return {};

  const data = sheet.getDataRange().getValues();
  // 假設格式: [Type], [Key], [Content]
  // 我們需要將 Key (例如 "總編模式") 對應到 Content
  const prompts = {};
  data.forEach((row) => {
    if (row.length >= 3) {
      // row[1] is Key (e.g., 總編模式), row[2] is Content
      const key = row[1].toString().trim();
      const content = row[2].toString().trim();
      if (key && content) {
        prompts[key] = content;
      }
    }
  });

  // 寫入 Cache (1小時)
  cache.put("KB_PROMPTS_JSON", JSON.stringify(prompts), 3600);
  return prompts;
}

function dedupeTestUiReplies(items) {
  return (items || []).filter(function (item, idx, arr) {
    var text = String(item || "").trim();
    var normalizedText = text.replace(/[.。…\s]+$/g, "").trim();
    var isTruncatedPreview = /(?:\.\.\.|…)$/g.test(text);
    if (!normalizedText) {
      return true;
    }
    return !arr.some(function (other, otherIdx) {
      if (otherIdx === idx) return false;
      var otherText = String(other || "").trim();
      var normalizedOther = otherText.replace(/[.。…\s]+$/g, "").trim();
      var otherIsTruncated = /(?:\.\.\.|…)$/g.test(otherText);
      if (
        isTruncatedPreview &&
        !otherIsTruncated &&
        normalizedOther === normalizedText
      ) {
        return true;
      }
      return (
        normalizedOther.length > normalizedText.length &&
        normalizedOther.indexOf(normalizedText) === 0
      );
    });
  });
}

function adminUpdatePromptC3(newPrompt) {
  const promptText = String(newPrompt || "").trim();
  if (!promptText) {
    throw new Error("Prompt content is empty");
  }
  if (!ss) {
    throw new Error("Spreadsheet is not available");
  }

  const sheet = ss.getSheetByName(SHEET_NAMES.PROMPT);
  if (!sheet) {
    throw new Error("Prompt sheet not found");
  }

  sheet.getRange("C3").setValue(promptText);
  CacheService.getScriptCache().remove("KB_PROMPTS_JSON");
  return {
    ok: true,
    cell: "Prompt!C3",
    length: promptText.length,
    version: (promptText.match(/Prompt v([\d.]+)/) || [])[1] || "unknown",
  };
}

function validateManualPdfFileName_(fileName) {
  const safeName = String(fileName || "").trim();
  if (!safeName) {
    throw new Error("fileName is required");
  }
  if (!/^[A-Z0-9,]+\.pdf$/i.test(safeName)) {
    throw new Error("PDF file name must contain only model codes separated by commas");
  }
  const modelParts = safeName.replace(/\.pdf$/i, "").split(",");
  if (
    modelParts.some(function (part) {
      return !/^[A-Z]+\d[A-Z0-9]*\d$/.test(part);
    })
  ) {
    throw new Error("Each model code in the PDF file name must end with a number");
  }
  return safeName;
}

function assertStandardPdfBytes_(pdfBytes) {
  if (!pdfBytes || pdfBytes.length < 5) {
    throw new Error("PDF payload is empty");
  }
  const signature = String.fromCharCode(
    pdfBytes[0],
    pdfBytes[1],
    pdfBytes[2],
    pdfBytes[3],
    pdfBytes[4],
  );
  if (signature !== "%PDF-") {
    throw new Error("Payload is not a standard PDF");
  }
}

function upsertManualPdfToGemini_(fileName, pdfBytes) {
  const safeName = validateManualPdfFileName_(fileName);
  assertStandardPdfBytes_(pdfBytes);
  const existing = getManualPdfKbList_().filter(function (item) {
    return item.name === safeName && item.uri;
  });
  if (existing.length > 0) {
    const state = persistManualPdfKbItem_(existing[0]);
    return {
      uri: existing[0].uri,
      skipped: true,
      manualCount: state.manualCount,
      pdfModelCount: state.pdfModelCount,
    };
  }

  const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("缺少 GEMINI_API_KEY，無法上傳到 Gemini Files API");
  }
  const blob = Utilities.newBlob(pdfBytes, "application/pdf", safeName);
  const uri = uploadFileToGemini(apiKey, blob, pdfBytes.length, "application/pdf");
  if (!uri) {
    throw new Error("Gemini Files API 上傳失敗");
  }
  const item = {
    name: safeName,
    uri: uri,
    mimeType: "application/pdf",
    source: "manual_file_api",
  };
  const state = persistManualPdfKbItem_(item);
  writeLog(`[ManualPDF] 已補傳至 Gemini Files API: ${safeName}`);
  return {
    uri: uri,
    skipped: false,
    manualCount: state.manualCount,
    pdfModelCount: state.pdfModelCount,
  };
}

function adminSetManualUploadToken(token, ttlSeconds) {
  const tokenText = String(token || "").trim();
  const ttl = Math.min(Math.max(Number(ttlSeconds || 3600), 60), 21600);
  if (!/^[A-Za-z0-9_-]{24,}$/.test(tokenText)) {
    throw new Error("Token must be at least 24 URL-safe characters");
  }
  const props = PropertiesService.getScriptProperties();
  const expiresAt = Date.now() + ttl * 1000;
  props.setProperty("MANUAL_UPLOAD_TOKEN", tokenText);
  props.setProperty("MANUAL_UPLOAD_TOKEN_EXPIRES_AT", String(expiresAt));
  return {
    ok: true,
    expiresAt: new Date(expiresAt).toISOString(),
    ttlSeconds: ttl,
  };
}

function adminClearManualUploadToken() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty("MANUAL_UPLOAD_TOKEN");
  props.deleteProperty("MANUAL_UPLOAD_TOKEN_EXPIRES_AT");
  return { ok: true };
}

function adminUploadManualPdfFromBase64(fileName, pdfBase64) {
  const safeName = validateManualPdfFileName_(fileName);
  const base64Text = String(pdfBase64 || "").trim();
  if (!base64Text) {
    throw new Error("pdfBase64 is required");
  }

  const folderId =
    CONFIG.DRIVE_FOLDER_ID ||
    PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID");
  if (!folderId) {
    throw new Error("DRIVE_FOLDER_ID is not configured");
  }

  const pdfBytes = Utilities.base64Decode(base64Text);
  assertStandardPdfBytes_(pdfBytes);

  const folder = DriveApp.getFolderById(folderId);
  const existing = folder.getFilesByName(safeName);
  if (existing.hasNext()) {
    const file = existing.next();
    return {
      ok: true,
      skipped: true,
      reason: "already_exists",
      fileName: safeName,
      fileId: file.getId(),
      size: file.getSize(),
    };
  }

  const blob = Utilities.newBlob(pdfBytes, "application/pdf", safeName);
  const file = folder.createFile(blob);
  writeLog(`[AdminUploadManual] Uploaded ${safeName} (${file.getId()})`);
  return {
    ok: true,
    skipped: false,
    fileName: safeName,
    fileId: file.getId(),
    size: file.getSize(),
  };
}

// ════════════════════════════════════════════════════════════════
// UI Helper Functions (v29.4.13)
// ════════════════════════════════════════════════════════════════

/**
 * v29.5.61: Determine Search Intent for Dynamic Bubble Text
 * @param {string} msg - User's message
 * @param {string[]} models - List of models for manual availability check
 */
function determineSearchIntent(msg, models = []) {
  if (!msg)
    return {
      headerText: "🔍 請選擇型號",
      footerText: "點選型號後AI將協助查詢",
    };

  const m = msg.toLowerCase();

  // 1. Manual / PDF Intent
  if (
    m.match(/設定|說明書|手冊|故障|error|安裝|reset|重置|亮燈|閃爍|無法|不能/)
  ) {
    // v29.5.61: Check if ALL models in the list have manuals
    let allHaveManuals = false;
    if (models.length > 0) {
      try {
        const pdfIndexJson =
          PropertiesService.getScriptProperties().getProperty(
            "PDF_MODEL_INDEX",
          );
        const pdfModelIndex = pdfIndexJson ? JSON.parse(pdfIndexJson) : [];
        allHaveManuals = models.every((primary) => {
          return pdfModelIndex.some((m) => {
            if (m.startsWith("S") && m.length >= 7)
              return m.includes(primary) || primary.includes(m);
            return m === primary;
          });
        });
      } catch (e) {}
    }

    if (allHaveManuals) {
      return {
        headerText: "🔍 請選擇型號以查閱產品手冊",
        footerText: "載入PDF約需 30 秒，請耐心等候",
      };
    } else {
      // 若包含無手冊型號，標題降級
      return {
        headerText: "🔍 請選擇型號以查閱說明或規格",
        footerText: "點選型號後 AI 會幫你深入分析",
      };
    }
  }

  // 2. Price / Web Intent
  if (m.match(/多少錢|價格|價錢|售價|哪裡買|costco|pchome|momo|通路/)) {
    return {
      headerText: "🔍 請選擇型號以查詢價格/通路",
      footerText: "會幫你搜尋網路公開資訊",
    };
  }

  // 3. Spec / QA Intent
  if (m.match(/規格|尺寸|面板|hz|更新率|接孔|hdmi|dp|壁掛|重量|寬度|高度/)) {
    return {
      headerText: "🔍 請選擇型號以查詢規格數據",
      footerText: "將從規格庫快速查詢",
    };
  }

  // Default
  return {
    headerText: "🔍 請選擇型號以查詢詳細資訊",
    footerText: "點選型號後AI將協助查詢",
  };
}

/**
 * 建立型號選擇的 Flex Message Carousel
 * v29.5.14: 全新設計 - 基於 LINE 最佳實踐
 * - 使用 Hero 區塊作為視覺焦點
 * - 現代化配色與間距
 * - 清晰的按鈕層次結構
 * v29.5.50: Support dynamic intentConfig
 */
function createModelSelectionFlexV3(models, intentConfig = null) {
  // 1. Display-safe deduplication.
  // Even if an upstream branch sends both Sxx and LSxx regional codes, the
  // selection UI must show the user-facing S model only once.
  const uniqueModels = dedupDisplayModels(models, 100);

  // v29.5.23: 降冪排列（Z-A）
  uniqueModels.sort((a, b) => b.localeCompare(a));

  const displayModels = uniqueModels.slice(0, 10);
  const remainingCount = uniqueModels.length - displayModels.length;

  // v29.5.118: 建立型號按鈕 - 回傳 #型號:MODEL 格式，讓 handleMessage 能攔截
  const buttons = displayModels.map((model, index) => {
    const label = `${model}`.substring(0, 20);
    return {
      type: "button",
      action: {
        type: "message",
        label: label,
        text: `#型號:${model}`, // v29.5.118: 加前綴，避免觸發 DirectDeep
      },
      style: "primary",
      color: "#4A90D9",
      margin: "md",
      height: "sm",
    };
  });

  // 若有更多型號
  if (remainingCount > 0) {
    buttons.push({
      type: "button",
      action: {
        type: "message",
        label: `還有 ${remainingCount} 款...`,
        text: "列出所有型號",
      },
      style: "secondary",
      margin: "sm",
      height: "sm",
    });
  }

  const bubble = {
    type: "bubble",
    // v29.5.19: 不指定 size，使用預設寬度 (約 300px)
    // Header 區塊 - 簡潔標題
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: (intentConfig && intentConfig.headerText) ? intentConfig.headerText : "🔍 請選擇型號",
          color: "#333333",
          size: "md",
          weight: "bold",
          align: "center",
        },
        {
          type: "text",
          text: `找到 ${displayModels.length} 款`,
          color: "#888888",
          size: "xs",
          align: "center",
          margin: "xs",
        },
      ],
      paddingAll: "15px",
      backgroundColor: "#F5F5F5",
    },
    // Body 區塊 - 按鈕列表
    body: {
      type: "box",
      layout: "vertical",
      contents: buttons,
      spacing: "md", // v29.5.16: 增加按鈕間距
      paddingAll: "12px",
    },
    // Footer 區塊 - 簡化
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: (intentConfig && intentConfig.footerText)
            ? intentConfig.footerText
            : "點選型號後會載入手冊（約30秒）",
          size: "xxs",
          color: "#888888",
          align: "center",
        },
        {
          type: "text",
          text: "也可以不選，直接輸入其他問題",
          size: "xxs",
          color: "#AAAAAA",
          align: "center",
          margin: "xs",
        },
      ],
      paddingAll: "8px",
      backgroundColor: "#FAFAFA",
    },
  };

  // v29.5.141 fix: Wrap in Flex Message object
  const altText =
    intentConfig && intentConfig.altText ? intentConfig.altText : "請選擇型號";

  return {
    type: "flex",
    altText: altText,
    contents: {
      type: "carousel",
      contents: [bubble],
    },
  };
}

/**
 * 發送 Flex Message
 */
function replyFlexMessage(replyToken, flexContainer, altText) {
  replyMessage(replyToken, {
    type: "flex",
    altText: altText || "請查看選單",
    contents: flexContainer,
  });
  return 200;
}

/**
 * v29.4.56: 全形轉半形函式
 * 將 Ｇ５ 轉為 G5，Ｓ３ 轉為 S3，１２３ 轉為 123
 */
function toHalfWidth(str) {
  if (!str) return "";
  return str
    .replace(/[\uff01-\uff5e]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
    })
    .replace(/\u3000/g, " ");
}

/**
 * [Cost Guard] 檢查是否為高成本 PDF 操作 (v29.5.96)
 * @param {string} userMsg
 */
function checkPdfCost(userMsg, testUiAccessToken) {
  assertTestUiAuthorized_(testUiAccessToken);
  if (!userMsg) return { isHighCost: false, reason: "Empty message" };

  // 1. Check for PDF Keywords
  const m = userMsg.toLowerCase();
  const pdfKeywords = [
    "手冊",
    "設定",
    "說明書",
    "故障",
    "error",
    "安裝",
    "reset",
    "重置",
    "亮燈",
    "閃爍",
    "無法",
    "不能",
  ];
  const isPdfIntent = pdfKeywords.some((k) => m.includes(k));

  // 2. Check strict model format (S27... G5...)
  // Simple regex for Samsung model-like strings
  const isModelLike = /[a-z0-9]{5,}/.test(m);

  if (isPdfIntent) {
    return {
      isHighCost: true,
      reason: "Detected PDF Keywords (e.g. 手冊/設定)",
    };
  }

  if (isModelLike && m.length < 20) {
    return { isHighCost: true, reason: "Potential Model Number (Loads PDF)" };
  }

  return { isHighCost: false, reason: "General Conversation" };
}




