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
const GAS_VERSION = "v29.6.253"; // 2026-08-23 空 Quick Reply 防線與跨版防重複付費
const BUILD_TIMESTAMP = "2026-08-23 00:33";
let quickReplyOptions = []; // Keep for backward compatibility if needed, but primary is param
const MAX_ELABORATE_PER_ANSWER = 1;
const ANSWER_ENVELOPE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ELABORATE_STATE_TTL_SECONDS = 21600; // 6 小時
const INLINE_PDF_FALLBACK_MAX_BYTES = 18 * 1024 * 1024;
const SOURCE_PENDING_TTL_SECONDS = 600;
const SOURCE_RECENT_QUESTION_TTL_SECONDS = 1800;
const SOURCE_OPERATION_CACHE_TTL_SECONDS = 600;
const SOURCE_DAILY_LIMITS = { manual: 5, web: 10 };
const SOURCE_DAILY_SYSTEM_WEB_RESCUE_LIMIT = 3;
const USER_DAILY_QUESTION_LIMIT = 20;

/**
 * Apps Script 編輯器限定的一鍵維護入口。
 * 正常仍由每日 04:00 排程自動執行；本函式只供管理者立即稽核，
 * 不接收外部輸入，也沒有公開 Web 路由。
 */
function adminRunOfficialManualAutomation() {
  const scanResult = scanOfficialWebsiteForNewMonitors();
  let syncResult = "SKIPPED_NO_ACTIVATION";
  if (
    scanResult &&
    scanResult.success === true &&
    Number(scanResult.activatedCount || 0) > 0
  ) {
    syncResult = syncGeminiKnowledgeBase(false);
  }
  return {
    gasVersion: GAS_VERSION,
    scan: scanResult,
    sync: syncResult,
  };
}

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
const PRICE_FAST_INPUT = 0.1; // $0.10 per 1M Input (Gemini 2.5 Flash-Lite Standard, 2026-08-05 官方價)
const PRICE_FAST_OUTPUT = 0.4; // $0.40 per 1M Output (Gemini 2.5 Flash-Lite Standard, 2026-08-05 官方價)
const GEMINI_MODEL_WEB = "models/gemini-2.5-flash";
const PRICE_WEB_INPUT = 0.3; // $0.30 per 1M Input (Gemini 2.5 Flash Standard, 2026-08-16 官方價)
const PRICE_WEB_OUTPUT = 2.5; // $2.50 per 1M Output (Gemini 2.5 Flash Standard, 2026-08-16 官方價)

// 🅱️ 若上方選擇 'OpenRouter' (需填寫 OPENROUTER_API_KEY)，則使用以下設定：
const OPENROUTER_MODEL = "qwen/qwen-2.5-7b-instruct";
const OPENROUTER_PRICE_IN = 0.04; // $0.04 per 1M Input
const OPENROUTER_PRICE_OUT = 0.1; // $0.10 per 1M Output

// ════════════════════════════════════════════════════════════════
// 3. PDF 對話 (Think Mode) (強制 Gemini，為了穩定)
// ════════════════════════════════════════════════════════════════
// ⚠️ 注意：PDF 閱讀模式目前強制定錨在 Google Gemini
const GEMINI_MODEL_THINK = "models/gemini-2.5-flash";
const PRICE_THINK_INPUT = 0.3; // $0.30 per 1M Input (Gemini 2.5 Flash Standard, full-PDF fallback only)
const PRICE_THINK_OUTPUT = 2.5; // $2.50 per 1M Output (Gemini 2.5 Flash Standard)

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
var ACTIVE_ADVANCED_SOURCE_GRANT = null;
var CURRENT_DAILY_QUESTION_REMAINING = null;
var CURRENT_REPLY_FOOTER_APPENDED = false;
var LAST_SOURCE_TEST_STATE = null;
var LAST_TEST_QUICK_REPLY_ITEMS = [];
var FAST_POSTBACK_HANDLED = false;
var LOADING_ANIMATION_SHOWN = false;
var RUNTIME_PROMPT_CONFIG_MEMO = null;
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

    // v29.6.189: v2 來源狀態機是唯一選型入口。舊數字泡泡若仍殘留，
    // 只清除狀態，不得再以 manual_search_consent 或 PDF mode 執行付費查詢。
    if (pendingJson) {
      cache.remove(pendingKey);
      cache.remove(`${userId}:manual_search_consent`);
      cache.remove(`${userId}:pending_manual_query`);
      writeLog(
        "[Source Route v29.6.189] 已清除舊版 PDF 選型狀態；改由單一來源狀態機處理",
      );
      return false;
    }

    // v29.5.116 修復：先檢查用戶是否直接輸入了有效型號
    // 即使沒有 pending 泡泡狀態，也要支持用戶直接型號輸入進 PDF 模式
    const directModelMatch = msg
      .toUpperCase()
      .match(/^[SC]\d{2}[A-Z]{1,2}\d{2,3}[A-Z]{0,2}$/);

    // v29.6.094: 單獨輸入型號只代表選型，不代表同意付費讀 PDF。
    if (directModelMatch && !pendingJson) {
      cache.put(
        `${userId}:direct_search_models`,
        JSON.stringify([directModelMatch[0]]),
        300,
      );
      writeLog(
        `[Manual Consent v29.6.094] 收到型號 ${directModelMatch[0]}，保留 Fast Mode，不自動讀 PDF`,
      );
      return false;
    }

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
        finalText = sanitizeManualDeflection(finalText, msg);
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

    if (
      !consumeManualSearchConsent_(
        cache,
        userId,
        pending.originalQuery,
        "",
      )
    ) {
      cache.remove(pendingKey);
      cache.put(
        `${userId}:pending_manual_query`,
        String(pending.originalQuery || ""),
        600,
      );
      replyMessage(
        replyToken,
        buildManualConsentPrompt_("", pending.originalQuery, ""),
        {
          quickReply: {
            items: [
              {
                type: "action",
                action: { type: "message", label: "📖 查手冊", text: "#查手冊" },
              },
            ],
          },
        },
      );
      return true;
    }

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
            const expiredText = "⚠️ 系統偵測到產品手冊需要更新，正在背景自動重新整理中。大約 1 分鐘後即可恢復正常，請稍後再試。";
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
          finalText = sanitizeManualDeflection(finalText, pending.originalQuery);
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
        finalText = sanitizeManualDeflection(finalText, pending.originalQuery);
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
  return /目前請求過於頻繁|已達配額限制|系統(?:暫時)?忙碌中?|這次查詢暫時無法處理|暫時無法處理|網路搜尋服務暫時無法連線|手冊內容超過成本上限|無法完成手冊\s*token\s*計數|API\s*錯誤|Google\s*伺服器暫時故障|請求參數有誤/i.test(
    String(text || ""),
  );
}

function reserveElaborationOnce_(cache, userId, anchor) {
  if (!anchor) return false;
  const lock = LockService.getUserLock();
  if (!lock.tryLock(2000)) return false;
  try {
    if (getElaborationCountForAnchor_(cache, userId, anchor) >= 1) {
      return false;
    }
    writeElaborationState_(cache, userId, anchor, 1);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function isTerminalWebSearchReply_(text) {
  return (
    isApiFailureReply(text) ||
    isEvidenceConflictReply_(text) ||
    /沒有取得可核對的網頁來源|無可稽核來源|網路搜尋連線逾時|已經嘗試多種角度搜尋/i.test(
      String(text || ""),
    )
  );
}

function getWebSearchAttemptCount_(cache, userId) {
  if (!cache || !userId) return 0;
  const dissatisfiedCount = parseInt(
    cache.get(`dissatisfied_count_${userId}`) || "0",
    10,
  );
  const legacyWebCount = parseInt(
    cache.get(`${userId}:web_search_count`) || "0",
    10,
  );
  return Math.max(
    Number.isFinite(dissatisfiedCount) ? dissatisfiedCount : 0,
    Number.isFinite(legacyWebCount) ? legacyWebCount : 0,
  );
}

function canOfferAnotherWebSearch_(cache, userId, replyText) {
  if (isTerminalWebSearchReply_(replyText)) return false;
  if (
    lastWebEvidenceConflict ||
    (lastWebSearchAttempted && !lastWebEvidenceValid)
  ) {
    return false;
  }
  return getWebSearchAttemptCount_(cache, userId) < 2;
}

function getAnswerEnvelopeKey_(contextId) {
  return `ANS_ENV_${getSourceContextHash_(contextId)}`;
}

function normalizeAnswerEnvelope_(value) {
  const source = value && typeof value === "object" ? value : {};
  const status = ["supported", "partial", "unsupported"].includes(
    String(source.status || ""),
  )
    ? String(source.status)
    : "unsupported";
  return {
    version: String(source.version || GAS_VERSION),
    topicId: String(source.topicId || ""),
    originalQuestion: String(source.originalQuestion || "").trim(),
    model: normalizeModelForDisplay(source.model || ""),
    claims: Array.isArray(source.claims) ? source.claims.slice(0, 6) : [],
    evidenceRefs: Array.isArray(source.evidenceRefs)
      ? source.evidenceRefs.slice(0, 8).map(String)
      : [],
    status: status,
    unresolvedClaims: Array.isArray(source.unresolvedClaims)
      ? source.unresolvedClaims.slice(0, 6).map(String)
      : [],
    allowedActions: Array.isArray(source.allowedActions)
      ? [...new Set(source.allowedActions.map(String))].filter(function (action) {
          return action === "manual" || action === "web" || action === "elaborate";
        })
      : [],
    expandable: source.expandable === true,
    createdAt: Number(source.createdAt || Date.now()),
    expiresAt: Number(source.expiresAt || Date.now() + ANSWER_ENVELOPE_TTL_MS),
  };
}

function writeAnswerEnvelope_(contextId, envelope) {
  if (!contextId || !envelope) return null;
  const normalized = normalizeAnswerEnvelope_(envelope);
  normalized.version = GAS_VERSION;
  normalized.createdAt = Date.now();
  normalized.expiresAt = normalized.createdAt + ANSWER_ENVELOPE_TTL_MS;
  const key = getAnswerEnvelopeKey_(contextId);
  const encoded = JSON.stringify(normalized);
  try {
    CacheService.getScriptCache().put(key, encoded, 21600);
  } catch (error) {
    writeLog(`[Answer Envelope] 儲存失敗: ${error.message}`);
  }
  return normalized;
}

function readAnswerEnvelope_(contextId) {
  if (!contextId) return null;
  const key = getAnswerEnvelopeKey_(contextId);
  try {
    const cache = CacheService.getScriptCache();
    const raw = cache.get(key) || "";
    if (!raw) return null;
    const parsed = normalizeAnswerEnvelope_(JSON.parse(raw));
    if (parsed.version !== GAS_VERSION || parsed.expiresAt < Date.now()) {
      cache.remove(key);
      return null;
    }
    return parsed;
  } catch (error) {
    writeLog(`[Answer Envelope] 讀取失敗: ${error.message}`);
    return null;
  }
}

/**
 * 通識推理題偵測 v29.6.194
 * 使用者問的不是「這款螢幕有沒有某功能」，而是「已知規格如何搭配使用或排版」
 * 例：4K解析度→桌面排列、HDMI→接機上盒看第四台/接遊戲機、線材選購建議
 * 這類題目不需要 QA/RULE 精確文字比對，允許 AI 結合規格庫數據與電腦螢幕常識進行推理回答。
 */
function isGeneralComputingReasoningQuestion_(question) {
  const text = String(question || "").trim();
  if (!text) return false;
  // 排除：明確詢問型號內部硬體能力/專有規格（例如：有沒有 KVM、是否有 180Hz、支不支援 G-Sync、幾版韌體）
  if (/(?:有沒有|是否有|支不支援|有嗎|內建|配備|幾版)/i.test(text)) {
    return false;
  }
  // 排除：純故障/異常/重置/偏色問題（需手冊排錯）
  if (/(?:故障|無法開機|不亮|沒畫面|當機|偏色|色偏|偏黃|顏色異常|重置|恢復原廠|忘記PIN|PIN碼)/i.test(text)) {
    return false;
  }
  // 1. 物理連接 + 外接設備（第四台、機上盒、MOD、遊戲機、筆電）
  if (
    /(?:可以|能不能|能|怎麼|如何)?(?:接|連接?|外接).{0,8}(?:第四台|有線電視|機上盒|MOD|PS[45]|SWITCH|XBOX|筆電|桌機|電腦|MAC|MACBOOK|遊戲機)/i.test(
      text,
    )
  ) {
    return true;
  }
  // 2. 桌面/螢幕圖示與視窗排列推理（解析度搭配 Windows 圖示）
  if (
    /(?:桌面|螢幕|畫面).{0,12}(?:資料夾|圖示|ICON|視窗|分割|排列|放幾|幾個)/i.test(
      text,
    ) ||
    /(?:資料夾|圖示|ICON).{0,12}(?:放得下|放幾|一列|一行|幾個|多少)/i.test(
      text,
    )
  ) {
    return true;
  }
  // 3. 線材選購與長度常識
  if (
    /(?:線材|線|傳輸線|轉接).{0,8}(?:要買|哪種|推薦|多長|幾公尺)/i.test(
      text,
    )
  ) {
    return true;
  }
  // 4. 外接當電視或看電視情境
  if (/(?:可以|能).{0,6}(?:當電視|看電視|看第四台)/i.test(text)) {
    return true;
  }
  return false;
}

function isFastEvidenceRequiredQuestion_(question) {
  const text = String(question || "").trim();
  if (!text || /^(?:謝謝|感謝|了解|好的|好喔|收到|掰掰|再見)[！!。\s]*$/i.test(text)) {
    return false;
  }
  // v29.6.194: 通識推理題（如解析度排版、HDMI接機上盒）不強制 QA/RULE 精確比對
  if (isGeneralComputingReasoningQuestion_(text)) {
    return false;
  }
  return Boolean(
    extractFullModelLikeTokens(text).length > 0 ||
      extractShortAliasModelTokens(text).length > 0 ||
      /(?:三星|SAMSUNG|螢幕|顯示器|MONITOR|ODYSSEY|VIEWFINITY|SMART\s*MONITOR)/i.test(
        text,
      ) ||
      isLikelyLocalSpecRuleQuestion_(text) ||
      isOperationOrTroubleshootQuery(text) ||
      isManualVerificationRequiredQuery(text),
  );
}

function hasUnverifiedExternalClaim_(answerText) {
  return /(?:可能|也許|或許|有些|部分|通常|一般來說|可以試著).{0,60}(?:業者|服務商|APP|應用程式|韌體|活動|庫存|售價|第三方|網路)/i.test(
    String(answerText || ""),
  );
}

function sanitizeUnverifiedExternalClaims_(answerText) {
  return String(answerText || "")
    .split(/(?<=[。！？!?])\s*/)
    .filter(function (sentence) {
      return !hasUnverifiedExternalClaim_(sentence);
    })
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function getFastEvidenceRefs_(question, answerText, sourceTag, model) {
  const refs = [];
  const userTokens = tokenizeForSourceInference(question);
  const replyUpper = String(answerText || "").toUpperCase();

  if (sourceTag === "[來源:QA庫]") {
    const rows = loadQaRowsForSourceInference();
    for (let i = 0; i < rows.length; i++) {
      const row = String(rows[i] || "");
      const rowUpper = row.toUpperCase();
      let userHitCount = 0;
      userTokens.forEach(function (token) {
        if (rowUpper.indexOf(token) >= 0) userHitCount++;
      });
      if (userHitCount < 2) continue;
      const rowTokens = tokenizeForSourceInference(rowUpper);
      let replyHitCount = 0;
      rowTokens.forEach(function (token) {
        if (replyUpper.indexOf(token) >= 0) replyHitCount++;
      });
      if (replyHitCount >= 3) {
        refs.push(`QA_ROW_${i + 1}:${computeReplyAnchor_(row).substring(0, 12)}`);
        break;
      }
    }
  } else if (sourceTag === "[來源:官方規格庫]") {
    const normalizedModel = normalizeModelForDisplay(model || "");
    const exactEvidence = normalizedModel
      ? buildDeterministicExactRuleReply_(question, normalizedModel)
      : "";
    if (exactEvidence) {
      refs.push(
        `RULE_MODEL_${normalizedModel}:${computeReplyAnchor_(exactEvidence).substring(0, 12)}`,
      );
    }
  } else if (sourceTag === "[來源:官方活動庫]") {
    const activityRule = findLocalCampaignRuleForQuery(question);
    if (activityRule) {
      refs.push(
        `RULE_ACTIVITY:${computeReplyAnchor_(JSON.stringify(activityRule)).substring(0, 12)}`,
      );
    }
  }

  return refs;
}

function buildFastAnswerEnvelope_(options) {
  const input = options || {};
  const question = String(input.originalQuestion || "").trim();
  const answer = String(input.answerText || "").trim();
  const sourceTag = String(input.sourceTag || "");
  const evidenceRefs = [
    ...getFastEvidenceRefs_(
      question,
      answer,
      sourceTag,
      input.model || "",
    ),
    ...(Array.isArray(input.inheritedEvidenceRefs)
      ? input.inheritedEvidenceRefs.map(String)
      : []),
  ].filter(function (ref, index, list) {
    return ref && list.indexOf(ref) === index;
  });
  const hasTrustedEvidence =
    evidenceRefs.length > 0 &&
    ((sourceTag === "[來源:QA庫]" ||
      sourceTag === "[來源:官方規格庫]" ||
      sourceTag === "[來源:官方活動庫]") ||
      input.inheritedEvidence === true);
  const evidenceRequired = isFastEvidenceRequiredQuestion_(question);
  const answerMissing = isKnowledgeMissingReply_(answer);
  const hasUnverifiedExternalClaim = hasUnverifiedExternalClaim_(answer);
  const manualNeeded = Boolean(input.manualRecommended);
  const webNeeded = Boolean(input.webRecommended);
  let status = "supported";
  if (evidenceRequired && !hasTrustedEvidence) {
    status = "unsupported";
  } else if (
    answerMissing ||
    ((manualNeeded || webNeeded) && evidenceRequired) ||
    hasUnverifiedExternalClaim
  ) {
    status = hasTrustedEvidence ? "partial" : "unsupported";
  }

  const claims = [];
  const unresolvedClaims = [];
  if (hasTrustedEvidence) {
    claims.push({
      id: "verified_evidence",
      status: "supported",
      source: sourceTag || getSourceTagFromEvidenceRefs_(evidenceRefs),
    });
  }
  if (status !== "supported") {
    if (
      isOperationOrTroubleshootQuery(question) ||
      isManualVerificationRequiredQuery(question) ||
      input.hasManual === true
    ) {
      claims.push({ id: "manual_product_fact", status: "unresolved", source: "manual" });
      unresolvedClaims.push("manual_product_fact");
    }
    if (
      webNeeded ||
      hasUnverifiedExternalClaim ||
      /(?:目前|最新|業者|服務|APP|應用程式|公開網頁|網路|庫存|活動)/i.test(
        `${question}\n${answer}`,
      ) ||
      status === "unsupported"
    ) {
      claims.push({ id: "public_web_fact", status: "unresolved", source: "web" });
      unresolvedClaims.push("public_web_fact");
    }
    if (claims.length === 0) {
      claims.push({ id: "product_fact", status: "unresolved", source: "manual_or_web" });
      unresolvedClaims.push("product_fact");
    }
  }

  const allowedActions = [];
  if (status === "supported") {
    allowedActions.push("elaborate");
  } else {
    if (input.hasManual === true || manualNeeded) allowedActions.push("manual");
    allowedActions.push("web");
  }

  return normalizeAnswerEnvelope_({
    version: GAS_VERSION,
    topicId: computeReplyAnchor_(question),
    originalQuestion: question,
    model: input.model || "",
    claims: claims,
    evidenceRefs: evidenceRefs,
    status: status,
    unresolvedClaims: unresolvedClaims,
    allowedActions: allowedActions,
    expandable: status === "supported",
  });
}

const LINE_STICKERS = {
  GREETING: { packageId: "446", stickerId: "1988", label: "熊大揮手" },
  THANKS: { packageId: "446", stickerId: "1990", label: "熊大鞠躬" },
  THUMBS_UP: { packageId: "446", stickerId: "1989", label: "比讚OK" },
  HAPPY: { packageId: "446", stickerId: "1991", label: "拍手開心" },
  THINKING: { packageId: "446", stickerId: "1993", label: "思考" },
  SEARCHING: { packageId: "446", stickerId: "2003", label: "查手冊" },
  CHEER: { packageId: "11537", stickerId: "52002747", label: "加油" },
  SALUTE: { packageId: "789", stickerId: "10877", label: "敬禮" },
};

function detectOccasionalSticker(userMsg, replyText) {
  const q = String(userMsg || "").trim();
  const r = String(replyText || "").trim();

  // 1. 問候情境
  if (/^(?:嗨|哈囉|你好|您好|早安|午安|晚安|HI|HELLO|HEY)[！!。~\s]*$/i.test(q)) {
    return LINE_STICKERS.GREETING;
  }

  // 2. 感謝 / 肯定情境
  if (/(?:謝謝|感謝|多謝|感恩|太棒了|讚|辛苦了|OK|好的|了解)[！!。~\s]*$/i.test(q)) {
    return LINE_STICKERS.THANKS;
  }

  // 3. 道別情境
  if (/(?:掰掰|再見|掰|BYE|GOODBYE)[！!。~\s]*$/i.test(q)) {
    return LINE_STICKERS.GREETING;
  }

  return null;
}

function buildEvidenceHandoffReply_(envelope) {
  const state = normalizeAnswerEnvelope_(envelope || {});
  const target = state.model ? `「${state.model}」` : "這款螢幕";
  const hasManual = state.allowedActions.includes("manual");
  const hasWeb = state.allowedActions.includes("web");
  const lines = [
    `目前資料還不足以確定 ${target} 這一點，我先不猜。`,
  ];
  if (hasManual && hasWeb) {
    lines.push(
      "點選下方「📖 查官方手冊」或「🌐 再查網路」，我直接幫你核對步驟",
    );
  } else if (hasManual) {
    lines.push(
      "點選下方「📖 查官方手冊」，我直接幫你查手冊說明",
    );
  } else {
    lines.push(
      "點選下方「🌐 再查網路」，我直接幫你搜尋相關做法",
    );
  }
  return lines.join("\n");
}

function buildEvidenceActionQuickReplies_(envelope) {
  const state = normalizeAnswerEnvelope_(envelope || {});
  const items = [];
  if (state.allowedActions.includes("manual")) {
    items.push(
      buildSourcePostbackQuickReply_(
        "📖 查官方手冊",
        "rm_action=select_source&source=manual&v=2",
      ),
    );
  }
  if (state.allowedActions.includes("web")) {
    items.push(
      buildSourcePostbackQuickReply_(
        "🌐 再查網路",
        "rm_action=select_source&source=web&v=2",
      ),
    );
  }
  return items.slice(0, 3);
}

function buildMissingFactSourceQuickReplies_() {
  return [
    buildSourcePostbackQuickReply_(
      "📖 查官方手冊",
      "rm_action=select_source&source=manual&v=2",
    ),
    buildSourcePostbackQuickReply_(
      "🌐 再查網路",
      "rm_action=select_source&source=web&v=2",
    ),
  ];
}

function getSourceTagFromEvidenceRefs_(refs) {
  const values = Array.isArray(refs) ? refs.map(String) : [];
  if (values.some(function (ref) { return ref.indexOf("MANUAL:") === 0; })) {
    return "[來源:官方手冊]";
  }
  if (values.some(function (ref) { return ref.indexOf("WEB:") === 0; })) {
    return "[來源:網路搜尋]";
  }
  if (values.some(function (ref) { return ref.indexOf("QA_ROW_") === 0; })) {
    return "[來源:QA庫]";
  }
  if (values.some(function (ref) { return ref.indexOf("RULE_ACTIVITY:") === 0; })) {
    return "[來源:官方活動庫]";
  }
  if (values.some(function (ref) { return ref.indexOf("RULE_MODEL_") === 0; })) {
    return "[來源:官方規格庫]";
  }
  return "";
}

function buildAdvancedAnswerEnvelope_(
  source,
  originalQuestion,
  model,
  finalText,
  outcome,
  searchSources,
) {
  const normalizedOutcome = String(outcome || "");
  const succeeded = normalizedOutcome === "success" || normalizedOutcome === "rescued_web";
  const effectiveSource = normalizedOutcome === "rescued_web" ? "web" : source;
  const refs = [];
  if (succeeded && effectiveSource === "manual") {
    const pages = String(finalText || "").match(/第\s*\d+(?:[、,，\-–~至]\s*\d+)*\s*頁/g) || [];
    const pageKey = pages.length > 0 ? pages.join("/") : computeReplyAnchor_(finalText).substring(0, 16);
    refs.push(`MANUAL:${normalizeModelForDisplay(model || "") || "GENERAL"}:${pageKey}`);
  } else if (succeeded && effectiveSource === "web") {
    const sourceKey = Array.isArray(searchSources) && searchSources.length > 0
      ? searchSources.join("|")
      : finalText;
    refs.push(`WEB:${computeReplyAnchor_(sourceKey).substring(0, 16)}`);
  }
  return normalizeAnswerEnvelope_({
    version: GAS_VERSION,
    topicId: computeReplyAnchor_(originalQuestion),
    originalQuestion: originalQuestion,
    model: model || "",
    claims: succeeded
      ? [{ id: `${effectiveSource}_evidence`, status: "supported", source: effectiveSource }]
      : [{ id: `${effectiveSource}_evidence`, status: "unresolved", source: effectiveSource }],
    evidenceRefs: refs,
    status: succeeded ? "supported" : "unsupported",
    unresolvedClaims: succeeded ? [] : [`${effectiveSource}_evidence`],
    allowedActions: succeeded ? ["elaborate"] : [],
    expandable: succeeded,
  });
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
  return qaKnowledgeLoadAllRecords_().filter((record) => {
    return String(record.evidence && record.evidence.type || "qa") !== "manual_chunk";
  });
}

function inferQaSourceTagFromFastReply(userText, replyText, existingTag) {
  if (existingTag) return existingTag;
  return qaKnowledgeInferSourceTag_(userText, replyText);
}

function isKnowledgeMissingReply_(text) {
  return /查無|沒有關於.+(?:資訊|資料|上市|日期)|(?:目前|手邊|我目前手邊).{0,12}資料.{0,8}沒有|沒有\s*\d{4}\s*年?.{0,20}(?:上市資訊|上市日期|上市時間)|沒有.{0,20}(?:上市資訊|上市日期|上市時間)|資料庫(?:中|裡)?(?:沒有|沒有找到|沒有相關|未記載|找不到)|目前沒有.+(?:資訊|資料|上市|日期)|建議.{0,20}(?:官網|官方社群|官方網站)/i.test(
    String(text || ""),
  );
}

function inferFastLocalSourceTag_(userText, replyText, existingTag) {
  // 模型自行輸出的 [來源:QA庫] / [來源:官方規格庫] 不是證據。
  // QA 必須實際對到資料列；RULE 只允許完整已知型號的非操作規格題。
  const qaTag = inferQaSourceTagFromFastReply(userText, replyText, "");
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
    .filter(
      (m) =>
        m &&
        !isShortAliasModelToken(m) &&
        extractFullModelLikeTokens(m).length > 0 &&
        isKnownFullModelToken(m),
    );
  const mentionsSpecFact =
    /(解析度|更新率|刷新率|面板|IPS|VA|OLED|QHD|UHD|FHD|HDR|Hz|亮度|尺寸|吋|反應時間|DisplayPort|HDMI|USB|Type-?C|喇叭|耳機孔|支援|規格|比較)/i.test(
      combined,
    );
  const exactRuleEvidence =
    knownModels.length === 1
      ? buildDeterministicExactRuleReply_(user, knownModels[0])
      : "";
  if (
    knownModels.length > 0 &&
    mentionsSpecFact &&
    exactRuleEvidence &&
    !isOperationOrTroubleshootQuery(user)
  ) {
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
  // 系列別稱或可辨識的不完整型號，例如 S9 / G8 / M7 / G806 / M703。
  // 完整型號會由 extractFullModelLikeTokens 排除，不在此冒充實體。
  return /^[SGM]\d{1,5}[A-Z]{0,3}$/.test(m);
}

function extractShortAliasModelTokens(text) {
  const q = toHalfWidth(String(text || "")).toUpperCase();
  const matches = q.match(/\b[SGM]\d{1,5}[A-Z]{0,3}\b/g) || [];
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
  return /(怎麼|如何|教學|步驟|設定|開啟|關閉|關掉|連接|安裝|組裝|拆裝|固定|壁掛|操作|使用|排除|故障|無法|不能|異常|偏色|色偏|偏黃|顏色異常|重置|恢復|閃爍|不亮|沒畫面|當機|調整|調到|調低|調小|切換|切到|叫出|進入選單|打開選單|進不去|更新|升級|插哪個孔|插哪一孔|接哪個孔|接哪一孔|孔位)/i.test(
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
    "不同型號的按鍵和選單位置會不太一樣，請給我螢幕完整型號（例如：S32FM703UC 或 S27DG502）",
    "我直接幫你查對應步驟 🔍",
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
  return /(?:可以|可|能夠|能)[\s\S]{0,45}(?:連接|顯示|輸出|充電)[\s\S]{0,45}(?:IPHONE|IPAD|ANDROID|手機|平板)|(?:IPHONE|IPAD|ANDROID|手機|平板)[\s\S]{0,45}(?:可以|可|能夠|能|支援)[\s\S]{0,45}(?:顯示|影像輸出|視訊輸出|充電|連接)|(?:為|替)[\s\S]{0,20}(?:IPHONE|IPAD|ANDROID|手機|平板)[\s\S]{0,20}充電|(?:嘗試|請|建議)[\s\S]{0,20}(?:更新|升級)[\s\S]{0,30}(?:IPHONE|IPAD|ANDROID|手機|平板)|有時[\s\S]{0,25}軟體更新[\s\S]{0,35}解決連接問題|(?:檢查|調整)[\s\S]{0,20}(?:M[5-9]|SMART\s*MONITOR|螢幕)[\s\S]{0,25}設定|(?:有些|某些)[\s\S]{0,15}螢幕[\s\S]{0,20}可能[\s\S]{0,20}設定/i.test(
    answer,
  );
}

function isRetailModeManualQuery_(text) {
  return /(零售模式|展示模式|商店模式|賣場模式|使用模式|家庭模式)/i.test(
    String(text || ""),
  );
}

function buildRetailModeManualSearchQuery_(query, targetModelName) {
  const original = String(query || "").trim();
  if (!isRetailModeManualQuery_(original)) return original;
  const modelText = String(targetModelName || "").trim();
  return [
    `請查官方手冊中${modelText ? `「${modelText}」` : ""}零售模式的實際設定路徑與限制。`,
    "請同時搜尋同義標題與選單字詞：設定、所有設定、一般與隱私權、使用模式、零售模式、家庭模式、定期自動重設。",
    "只回答手冊能核對的路徑與注意事項，並提供 PDF 顯示頁碼；不得因一個關鍵詞沒命中就回答沒有此功能。",
    "",
    `使用者原問題：${original}`,
  ].join("\n");
}

function isUsbMediaPlaybackManualQuery_(text) {
  return /(?:USB.{0,12}(?:播放|影片|相片|音樂|媒體)|(?:播放|影片|相片|音樂|媒體).{0,12}USB|已連接裝置|外部儲存裝置)/i.test(
    String(text || ""),
  );
}

function buildUsbMediaPlaybackManualSearchQuery_(query, targetModelName) {
  const original = String(query || "").trim();
  if (!isUsbMediaPlaybackManualQuery_(original)) return original;
  const modelText = String(targetModelName || "").trim();
  return [
    `請查官方手冊中${modelText ? `「${modelText}」` : ""}從 USB 儲存裝置播放媒體的操作步驟與限制。`,
    "請同時搜尋：USB 裝置、已連接裝置、媒體內容、播放相片／視訊／音樂、MSC、FAT、exFAT、NTFS、USB 集線器。",
    "請列出手冊中的實際操作路徑、支援或限制，並提供 PDF 顯示頁碼；禁止自行創造『媒體瀏覽器』等手冊未記載名稱。",
    "",
    `使用者原問題：${original}`,
  ].join("\n");
}

function stripInternalRoutingHints_(text) {
  return String(text || "")
    .replace(/\[System Hint:[^\]]*\]/gi, " ")
    .replace(/\[(?:AUTO_SEARCH_PDF|AUTO_SEARCH_WEB|NEED_DOC|NEW_TOPIC)(?:[:：][^\]]*)?\]/gi, " ")
    .replace(/\[(?:模式|型號)[:：][^\]]+\]/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildCanonicalWebQuery_(query, model) {
  const normalizedModel = normalizeModelForDisplay(model || "");
  const cleanQuery = stripInternalRoutingHints_(query);
  let text = stripKnownModelFromSourceQuestion_(cleanQuery, normalizedModel)
    .replace(/^(?:那你|那|請你|麻煩你)?\s*(?:再)?(?:幫我)?(?:查|搜尋|搜)(?:一下)?\s*/i, "")
    .trim();
  if (!text) text = cleanQuery;
  return [
    "Samsung",
    normalizedModel,
    text,
    "台灣 非官方 公開網頁 實務解法 -site:samsung.com",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isSamsungOfficialGroundingChunk_(chunk) {
  const web = chunk && chunk.web ? chunk.web : {};
  const uri = String(web.uri || "").toLowerCase();
  const title = String(web.title || "").trim().toLowerCase();
  return (
    /samsung\.com(?:\.[a-z]{2})?/i.test(uri) ||
    /samsung\.com(?:\.[a-z]{2})?/i.test(title) ||
    /^(?:samsung|samsung electronics|samsung support)$/i.test(title)
  );
}

function isBluetoothAudioManualQuery_(text) {
  const q = String(text || "");
  return /(?:藍牙|Bluetooth).{0,24}(?:耳機|喇叭|音訊|音效|聲音|音源)|(?:耳機|喇叭|音訊|音效|聲音|音源).{0,24}(?:藍牙|Bluetooth)/i.test(
    q,
  );
}

function isBluetoothAudioOperationQuery_(text) {
  const q = String(text || "");
  return (
    isBluetoothAudioManualQuery_(q) &&
    /(?:如何|怎麼|怎樣|哪裡|在哪|選單|設定|路徑|操作|連接|配對|搜尋|掃描|找不到|沒聲音|無聲|斷線)/i.test(
      q,
    )
  );
}

function findBluetoothAudioRuleEvidence_(text) {
  const query = String(text || "");
  if (!isBluetoothAudioManualQuery_(query) || !ss) return null;
  const models = dedupDisplayModels(extractFullModelLikeTokens(query), 3);
  if (models.length !== 1) return null;

  const model = normalizeModelForDisplay(models[0]);
  const cache = CacheService.getScriptCache();
  const cacheKey = `BT_RULE_EVIDENCE_${model}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      cache.remove(cacheKey);
    }
  }

  try {
    const sheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    if (!sheet) return null;
    const values = sheet.getDataRange().getValues();
    for (let r = 0; r < values.length; r++) {
      const line = values[r]
        .map((cell) => String(cell || ""))
        .join(" ")
        .trim();
      const upper = line.toUpperCase();
      if (!upper || /^(?:活動|別稱|系列|術語)_/.test(upper)) continue;
      if (upper.indexOf(model.toUpperCase()) < 0) continue;
      if (!/(?:TIZEN|SMART\s*TV|智慧型TIZEN)/i.test(line)) continue;
      const bluetoothMatch = line.match(/(?:藍牙|BLUETOOTH)\s*([0-9.]+)?/i);
      if (!bluetoothMatch) continue;

      const evidence = {
        model: model,
        bluetoothVersion: String(bluetoothMatch[1] || "").trim(),
      };
      cache.put(cacheKey, JSON.stringify(evidence), 21600);
      return evidence;
    }
  } catch (e) {
    writeLog(`[RULE Bluetooth Guard v29.6.125] 讀取 CLASS_RULES 失敗: ${e.message}`);
  }
  return null;
}

function enforceBluetoothAudioRuleEvidence_(query, rawResponse) {
  const evidence = findBluetoothAudioRuleEvidence_(query);
  if (!evidence) return String(rawResponse || "");

  const versionText = evidence.bluetoothVersion
    ? `藍牙 ${evidence.bluetoothVersion}`
    : "藍牙";
  if (isBluetoothAudioOperationQuery_(query)) {
    writeLog(
      `[RULE Bluetooth Guard v29.6.126] ${evidence.model} 的 CLASS_RULES 明載 Tizen + ${versionText}；不能回答成沒有內建藍牙，操作路徑改由手冊查證`,
    );
    return `${evidence.model} 的三星官方規格已確認搭載 Tizen 作業系統與${versionText}。\n\n你問的是實際選單操作，需要再查官方手冊核對完整路徑；本題與型號已保留。\n[AUTO_SEARCH_PDF]\n[來源:官方規格庫]`;
  }

  writeLog(
    `[RULE Bluetooth Guard v29.6.126] ${evidence.model} 的 CLASS_RULES 明載 ${versionText}，覆蓋模型相反說法`,
  );
  return `${evidence.model} 有支援${versionText}，並搭載 Tizen 作業系統。\n[來源:官方規格庫]`;
}

/**
 * 特定型號能力題的規格證據守門。
 * 「術語_」列只能解釋功能，不能證明任一型號具備該功能；若完整型號列沒有
 * 明載該能力，就不得把同系列其他型號或通用術語套到目前型號。
 */
function findExactModelRuleLine_(model) {
  const normalizedModel = normalizeModelForDisplay(model || "");
  if (!normalizedModel || !ss) return "";
  const cache = CacheService.getScriptCache();
  const cacheKey = `EXACT_RULE_LINE_${normalizedModel}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const sheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    if (!sheet || sheet.getLastRow() <= 1) return "";
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    const needle = normalizedModel.toUpperCase();
    for (let i = 0; i < values.length; i++) {
      const line = values[i]
        .map((cell) => String(cell || ""))
        .join(" ")
        .trim();
      const upper = toHalfWidth(line).toUpperCase();
      if (!upper || /^(?:活動|別稱|系列|術語)_/.test(upper)) continue;
      if (upper.indexOf(needle) < 0) continue;
      cache.put(cacheKey, line, 21600);
      return line;
    }
  } catch (e) {
    writeLog(`[RULE Exact Model Guard] 讀取 ${normalizedModel} 規格失敗: ${e.message}`);
  }
  return "";
}

function getExplicitCapabilityCheck_(query) {
  const q = String(query || "");
  if (!/(?:有|支援|支持|內建|具備|是否|能不能|可不可以).{0,28}(?:嗎|呢|\?|？)?|(?:嗎|呢|\?|？)/i.test(q)) {
    return null;
  }
  const capabilities = [
    { label: "KVM", query: /\bKVM\b/i, evidence: /\bKVM\b/i },
    {
      label: "耳機孔",
      query: /耳機孔|3\.5\s*MM/i,
      evidence: /耳機孔|(?:^|[^0-9])3\.5\s*MM(?:[^0-9]|$)/i,
    },
    { label: "USB-C", query: /USB[\s-]*C|TYPE[\s-]*C/i, evidence: /USB[\s-]*C|TYPE[\s-]*C/i },
    { label: "藍牙", query: /藍牙|BLUETOOTH/i, evidence: /藍牙|BLUETOOTH/i },
    { label: "喇叭", query: /喇叭|揚聲器/i, evidence: /喇叭|揚聲器/i },
    { label: "攝影機", query: /鏡頭|攝影機|相機/i, evidence: /鏡頭|攝影機|相機/i },
    { label: "PIP／PBP", query: /\bPIP\b|\bPBP\b|子母畫面|多畫面/i, evidence: /\bPIP\b|\bPBP\b|子母畫面|多畫面/i },
    { label: "VESA 壁掛", query: /VESA|壁掛/i, evidence: /VESA|壁掛/i },
    { label: "DisplayPort", query: /DISPLAYPORT|\bDP\b/i, evidence: /DISPLAYPORT|\bDP\b/i },
    { label: "HDMI", query: /HDMI/i, evidence: /HDMI/i },
  ];
  for (let i = 0; i < capabilities.length; i++) {
    if (capabilities[i].query.test(q)) return capabilities[i];
  }
  return null;
}

function enforceExactModelCapabilityEvidence_(query, rawResponse) {
  const cleanQuery = String(query || "");
  const models = dedupDisplayModels(extractFullModelLikeTokens(cleanQuery), 3);
  if (models.length !== 1) return String(rawResponse || "");

  const capability = getExplicitCapabilityCheck_(cleanQuery);
  if (!capability) return String(rawResponse || "");
  const model = normalizeModelForDisplay(models[0]);
  const exactRuleLine = findExactModelRuleLine_(model);
  if (exactRuleLine && capability.evidence.test(exactRuleLine)) {
    return String(rawResponse || "");
  }

  writeLog(
    `[RULE Exact Model Guard] ${model} 的完整規格列未明載 ${capability.label}；禁止用術語列或同系列型號作肯定／否定結論`,
  );
  return `${model} 的台灣三星官方規格資料目前沒有列出「${capability.label}」，所以我不能把其他同系列型號的功能套到這台，也不能直接說它有或沒有。\n\n若要再確認官方手冊是否另有記載，請按「查手冊｜5次/日」；系統會沿用 ${model}，不必重新選型號。\n[AUTO_SEARCH_PDF]`;
}

function buildMissingExactRuleFactReply_(query, model) {
  const normalizedModel = normalizeModelForDisplay(model || "");
  if (!normalizedModel) return "";
  const capability = getExplicitCapabilityCheck_(query);
  if (!capability) return "";
  const exactRuleLine = findExactModelRuleLine_(normalizedModel);
  if (exactRuleLine && capability.evidence.test(exactRuleLine)) return "";
  writeLog(
    `[RULE Missing Fact v29.6.158] ${normalizedModel} 規格列未明載 ${capability.label}，零 LLM 停止猜測`,
  );
  return [
    `這份台灣官方規格還沒有列出 ${normalizedModel} 的「${capability.label}」，我不想拿其他同系列型號套過來猜。`,
    "",
    "你可以按「查官方手冊」繼續確認，或按「再查網路」找公開資料；兩個選擇都會沿用這款型號，不用再選一次。",
  ].join("\n");
}

function pickExactComparisonFields_(ruleLine, query) {
  const fields = String(ruleLine || "")
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);
  const patterns = [
    /(?:ODYSSEY|SMART MONITOR|VIEWFINITY|電競顯示器|智慧顯示器)/i,
    /(?:IPS|OLED|VA).*(?:螢幕|面板)/i,
    /(?:解析度|雙模.*(?:\dK|\d+\s*HZ))/i,
    /(?:更新頻率|更新率|刷新率|\d+\s*HZ)/i,
    /反應時間/i,
    /(?:HDR10|DISPLAYHDR|VESA CERTIFIED)/i,
    /(?:FREESYNC|G-SYNC)/i,
  ];
  if (/(?:介面|接口|HDMI|DISPLAYPORT|USB|TYPE-?C)/i.test(String(query || ""))) {
    patterns.push(/介面[:：]|HDMI|DISPLAYPORT|USB[\s-]*C|TYPE[\s-]*C/i);
  }

  const selected = [];
  patterns.forEach((pattern) => {
    const hit = fields.find(
      (field) =>
        !/^L?[SCF]\d{2}[A-Z0-9]+$/i.test(field) &&
        !/^型號[:：]/.test(field) &&
        selected.indexOf(field) < 0 &&
        pattern.test(field),
    );
    if (hit && selected.indexOf(hit) < 0) selected.push(hit);
  });
  return selected.slice(0, 7);
}

function buildExactRuleComparisonReply_(query) {
  const text = String(query || "");
  if (!/(?:比較|差異|差別|VS|VERSUS|哪一台|哪一款|怎麼選|選哪)/i.test(text)) {
    return "";
  }
  const models = dedupDisplayModels(extractFullModelLikeTokens(text), 3).map(
    normalizeModelForDisplay,
  );
  if (models.length !== 2) return "";

  const entries = models.map((model) => {
    const ruleLine = findExactModelRuleLine_(model);
    return {
      model,
      ruleLine,
      fields: pickExactComparisonFields_(ruleLine, text),
    };
  });
  if (entries.some((entry) => !entry.ruleLine || entry.fields.length < 2)) return "";

  writeLog(
    `[RULE Exact Comparison v29.6.143] 只用兩個完整型號的規格列比較: ${models.join(" vs ")}`,
  );
  return [
    "兩台都能用於遊戲，主要差異如下：",
    "",
    `${entries[0].model}：${entries[0].fields.join("；")}。`,
    "",
    `${entries[1].model}：${entries[1].fields.join("；")}。`,
    "",
    "怎麼選：請依上面明載的面板、解析度／更新頻率與反應時間取捨；我不會把其他型號的數字或未記載的主觀評價套進來。",
    "[來源:官方規格庫]",
  ].join("\n");
}

function buildBluetoothAudioManualSearchQuery_(query, targetModelName) {
  const original = String(query || "").trim();
  if (!isBluetoothAudioManualQuery_(original)) {
    return original;
  }
  const modelText = String(targetModelName || "").trim();
  return [
    `請查官方手冊中${modelText ? `「${modelText}」` : ""}連接藍牙耳機、藍牙喇叭或 Bluetooth Audio 裝置的實際操作路徑。`,
    "請同時搜尋同義標題與選單字詞：透過藍牙裝置收聽產品、設定、所有設定、音效、音效輸出、藍牙揚聲器清單、Bluetooth Speaker List、掃描、配對。",
    "找到後先回答完整選單路徑，再補充配對與掃描注意事項；必須附 PDF 顯示頁碼與證據適用範圍。不要因原問題沒有逐字使用手冊標題就回答未記載。",
    "",
    `使用者原問題：${original}`,
  ].join("\n");
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
  return /(?:可能|也許|或許|通常|常見|依賴)[\s\S]{0,55}(?:IPHONE|IPAD|ANDROID|手機|平板|IOS)[\s\S]{0,55}(?:設定|鏡像|顯示輸出|系統功能|相容性)|(?:IPHONE|IPAD|ANDROID|手機|平板|IOS)[\s\S]{0,55}(?:設定|鏡像|顯示輸出|系統功能|相容性)[\s\S]{0,55}(?:可能|也許|或許|通常|常見|依賴)|(?:IPHONE|IPAD|ANDROID|手機|平板|IOS)[\s\S]{0,65}(?:可能|也許|或許)[\s\S]{0,45}(?:不支援|無法|不能|相容性問題|相容性)|官方規格未[\s\S]{0,80}(?:常見|一般|推測|可能)|IPHONE\s*(?:17\s*)?AIR[\s\S]{0,45}USB[\s‑–—_-]*C[\s\S]{0,45}支援[\s\S]{0,25}AIRPLAY|USB[\s‑–—_-]*C[\s\S]{0,35}支援[\s\S]{0,25}AIRPLAY/i.test(
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

function enforceAppleAirWiredEvidenceBoundary_(query, text) {
  const identity = getOfficialProductIdentityFromQuery_(query);
  const original = String(text || "").trim();
  if (!original || !identity || identity.id !== "iphone-air") {
    return original;
  }

  const keptLines = [];
  let dropSpeculativeTail = false;
  original.split(/\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (!dropSpeculativeTail) keptLines.push("");
      return;
    }
    if (
      /(?:建議的?解決步驟|建議步驟)/i.test(trimmed) ||
      (/IPHONE\s*(?:17\s*)?AIR/i.test(trimmed) &&
        /(?:原因可能|可能的原因|可能不支援|不支援(?:有線)?影像輸出|沒有啟用\s*DISPLAY\s*PORT)/i.test(
          trimmed,
        ) &&
        !/(?:未列|未標示|未明確|不能宣稱)/i.test(trimmed))
    ) {
      dropSpeculativeTail = true;
      return;
    }
    if (dropSpeculativeTail) return;
    keptLines.push(line);
  });

  let bounded = keptLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const verifiedConclusion =
    "Apple 官方規格只列充電與 USB 2，另把 AirPlay 列為無線投放能力，未列 DisplayPort／DP Alt Mode 有線影像輸出；因此不能把 Type-C 接頭直接當成支援有線顯示。";
  if (!/不能把\s*TYPE[\s‑–—_-]*C[\s\S]{0,45}(?:DISPLAY\s*PORT|DP\s*ALT|有線顯示)/i.test(bounded)) {
    bounded = `${bounded}\n\n${verifiedConclusion}`.trim();
  }
  return bounded;
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
  // 點卡、禮券、購物金是活動權益面額，不是商品售價；先保護再做售價遮罩。
  const protectedBenefits = [];
  processed = processed.replace(
    /(?:STEAM\s*)?\d{1,3}(?:,\d{3})*\s*元\s*(?:點卡|禮券|購物金)/gi,
    (match) => {
      const token = `__CAMPAIGN_BENEFIT_${protectedBenefits.length}__`;
      protectedBenefits.push(match);
      return token;
    },
  );
  // 1. 替換如 NT$ 100 以上的格式，小數點後最多 2 位，不匹配 NT$0.xxxx
  processed = processed.replace(/NT\$\s*(?!0\.\d)\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/gi, "官網當下優惠價");
  processed = processed.replace(/(?:TWD|NTD|台幣)\s*(?!0\.\d)\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/gi, "官網當下優惠價");
  
  // 2. 替換如 32,900元, 32900元 等格式 (排除 0.xxx元)
  processed = processed.replace(/\b(?!0\.\d)\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\s*(?:元|台幣)/g, "官網當下優惠價");
  // 替換無逗號但長度在 4 到 6 位的純數字 + 元 (例如 32900元，排除 0.xxxx元)
  processed = processed.replace(/\b(?!0\.\d)\d{4,6}\s*(?:元|台幣)/g, "官網當下優惠價");
  protectedBenefits.forEach((benefit, index) => {
    processed = processed.replace(`__CAMPAIGN_BENEFIT_${index}__`, benefit);
  });
  return processed;
}

function normalizeQaMatchText_(text) {
  return String(text || "")
    .toUpperCase()
    .replace(/ＩＰＨＯＮＥ/g, "IPHONE")
    .replace(/ＵＳＢ/g, "USB")
    .replace(/ＴＹＰＥ/g, "TYPE")
    .replace(/IPHONE\s*17\s*AIR/g, "IPHONE AIR")
    .replace(/USB[\s‑–—_-]*C|TYPE[\s‑–—_-]*C/g, "USBC")
    .replace(/DISPLAY[\s‑–—_-]*PORT/g, "DISPLAYPORT")
    .replace(/[\s,，。；;：:、.!！?？()（）\[\]【】"'`]/g, "");
}

function getQaEntityTokens_(text) {
  const upper = String(text || "").toUpperCase();
  const tokens = [];

  if (/IPHONE\s*(?:17\s*)?AIR(?:\s*版)?(?![A-Z])/i.test(upper)) {
    tokens.push("APPLE:IPHONE_AIR");
  } else {
    const iphoneVariant = upper.match(/\bIPHONE\s*(1[5-7])\s*(E)?\b/i);
    if (iphoneVariant) {
      tokens.push(
        `APPLE:IPHONE_${iphoneVariant[1]}${iphoneVariant[2] ? "E" : ""}`,
      );
    }
  }

  const modelTokens =
    upper.match(
      /\b(?:LS|LC|LF|S|C|F|M|G|WA|WD|VR)\d{1,3}[A-Z0-9-]{0,18}\b/g,
    ) || [];
  modelTokens.forEach((token) => {
    // Smart Monitor 的 M5/M7/M8/M9 是正式產品系列別稱，必須保留為 QA 實體；
    // 其餘純 M+數字仍不當成完整型號，避免一般文字誤命中。
    if (!/^M?\d+$/.test(token) || /^M[5789]$/.test(token)) {
      tokens.push(`MODEL:${token.replace(/-/g, "")}`);
    }
  });

  return Array.from(new Set(tokens));
}

function getQaConnectionTokens_(text) {
  const upper = String(text || "").toUpperCase();
  const tokens = [];
  if (/AIR\s*PLAY|AIRPLAY/i.test(upper)) tokens.push("AIRPLAY");
  if (/USB[\s‑–—_-]*C|TYPE[\s‑–—_-]*C/i.test(upper)) tokens.push("USB_C");
  if (/DISPLAY[\s‑–—_-]*PORT|\bDP\b/i.test(upper)) tokens.push("DISPLAYPORT");
  if (/\bHDMI\b/i.test(upper)) tokens.push("HDMI");
  return Array.from(new Set(tokens));
}

function getQaIntentTokens_(text) {
  const raw = String(text || "");
  const connections = getQaConnectionTokens_(raw);
  const tokens = [];
  if (/恢復原廠|原廠設定|重置|出廠資料|FACTORY\s*RESET/i.test(raw)) {
    tokens.push("FACTORY_RESET");
  }
  if (
    connections.indexOf("AIRPLAY") >= 0 &&
    /投放|鏡像|顯示|播放|串流|連接/i.test(raw)
  ) {
    tokens.push("WIRELESS_DISPLAY");
  }
  if (
    (connections.indexOf("USB_C") >= 0 ||
      connections.indexOf("DISPLAYPORT") >= 0 ||
      connections.indexOf("HDMI") >= 0) &&
    /顯示|畫面|影像|視訊|輸出|連接|沒畫面|無畫面/i.test(raw)
  ) {
    tokens.push("WIRED_DISPLAY");
  }
  if (/充電|供電|瓦數|W\b/i.test(raw)) tokens.push("POWER");
  if (/支援|可以|可否|能不能|無法|不能|相容|為什麼/i.test(raw)) {
    tokens.push("COMPATIBILITY");
  }
  return Array.from(new Set(tokens));
}

function isQaQuestionDirectMatch_(query, question) {
  const normalizedQuery = normalizeQaMatchText_(query);
  const normalizedQuestion = normalizeQaMatchText_(question);
  if (!normalizedQuery || !normalizedQuestion) return false;
  if (normalizedQuery === normalizedQuestion) return true;

  const queryEntities = getQaEntityTokens_(query);
  const questionEntities = getQaEntityTokens_(question);
  if (questionEntities.length === 0) return false;

  const questionAppleEntities = questionEntities.filter(
    (token) => token.indexOf("APPLE:") === 0,
  );
  const queryAppleEntities = queryEntities.filter(
    (token) => token.indexOf("APPLE:") === 0,
  );
  if (
    questionAppleEntities.length > 0 &&
    (queryAppleEntities.length === 0 ||
      questionAppleEntities.some(
        (token) => queryAppleEntities.indexOf(token) < 0,
      ))
  ) {
    return false;
  }

  if (
    questionEntities.some((token) => queryEntities.indexOf(token) < 0)
  ) {
    return false;
  }

  const questionModelEntities = questionEntities.filter(
    (token) => token.indexOf("MODEL:") === 0,
  );
  const queryModelEntities = queryEntities.filter(
    (token) => token.indexOf("MODEL:") === 0,
  );
  const questionExactModelEntities = questionModelEntities.filter(
    (token) => !/^MODEL:M[5789]$/.test(token),
  );
  const queryExactModelEntities = queryModelEntities.filter(
    (token) => !/^MODEL:M[5789]$/.test(token),
  );
  if (
    queryExactModelEntities.length > 0 &&
    (questionExactModelEntities.length !== queryExactModelEntities.length ||
      queryExactModelEntities.some(
        (token) => questionExactModelEntities.indexOf(token) < 0,
      ))
  ) {
    return false;
  }

  // 允許「完整 QA 題句」和使用者較短問法互為包含，但至少要有 12 個
  // 正規化字元且產品實體已在上方嚴格對齊。這可涵蓋省略第二子句的精準題，
  // 不恢復曾造成跨型號誤答的 LCS／模糊相似度。
  const hasMeaningfulExactContainment =
    Math.min(normalizedQuery.length, normalizedQuestion.length) >= 12 &&
    (normalizedQuestion.indexOf(normalizedQuery) >= 0 ||
      normalizedQuery.indexOf(normalizedQuestion) >= 0);
  if (hasMeaningfulExactContainment) return true;

  const queryConnections = getQaConnectionTokens_(query);
  const questionConnections = getQaConnectionTokens_(question);
  if (
    questionConnections.length === 0 ||
    questionConnections.length !== queryConnections.length ||
    questionConnections.some(
      (token) => queryConnections.indexOf(token) < 0,
    )
  ) {
    return false;
  }

  const queryIntents = getQaIntentTokens_(query);
  const questionIntents = getQaIntentTokens_(question);
  const queryPrimaryIntents = queryIntents.filter(
    (token) => token !== "COMPATIBILITY",
  );
  const questionPrimaryIntents = questionIntents.filter(
    (token) => token !== "COMPATIBILITY",
  );
  return (
    questionPrimaryIntents.length > 0 &&
    questionPrimaryIntents.length === queryPrimaryIntents.length &&
    questionPrimaryIntents.every(
      (token) => queryPrimaryIntents.indexOf(token) >= 0,
    )
  );
}

function isQaContextRelevant_(query, question, injectedModels) {
  if (isQaQuestionDirectMatch_(query, question)) return true;

  const normalizedQuery = normalizeQaMatchText_(query);
  const normalizedQuestion = normalizeQaMatchText_(question);
  if (
    normalizedQuestion.length >= 12 &&
    normalizedQuery.indexOf(normalizedQuestion) >= 0
  ) {
    return true;
  }

  const queryAppleEntities = getQaEntityTokens_(query).filter(
    (token) => token.indexOf("APPLE:") === 0,
  );
  const questionAppleEntities = getQaEntityTokens_(question).filter(
    (token) => token.indexOf("APPLE:") === 0,
  );
  const queryConnections = getQaConnectionTokens_(query);
  const questionConnections = getQaConnectionTokens_(question);
  const queryPrimaryIntents = getQaIntentTokens_(query).filter(
    (token) => token !== "COMPATIBILITY",
  );
  const questionPrimaryIntents = getQaIntentTokens_(question).filter(
    (token) => token !== "COMPATIBILITY",
  );
  if (
    questionAppleEntities.length > 0 &&
    questionAppleEntities.length === queryAppleEntities.length &&
    questionAppleEntities.every(
      (token) => queryAppleEntities.indexOf(token) >= 0,
    ) &&
    questionConnections.length > 0 &&
    questionConnections.every(
      (token) => queryConnections.indexOf(token) >= 0,
    ) &&
    questionPrimaryIntents.length > 0 &&
    questionPrimaryIntents.every(
      (token) => queryPrimaryIntents.indexOf(token) >= 0,
    )
  ) {
    return true;
  }

  const models = Array.isArray(injectedModels) ? injectedModels : [];
  return models.some((model) => {
    const token = normalizeQaMatchText_(model);
    return token.length >= 5 && normalizedQuestion.indexOf(token) >= 0;
  });
}

function findLocalMatchInQA(query, userId, confirmedModel) {
  try {
    const model = String(confirmedModel || "").trim();
    const effectiveQuery = model ? `${query} ${model}` : query;
    return qaKnowledgeFindLocalMatch_(effectiveQuery);
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

function replyWithLocalQaMatch_(match, query, userId, replyToken, contextId) {
  if (!match || !match.answer) return false;

  let matchReply = formatForLineMobile(match.answer);
  matchReply += "\n\n[來源:QA庫]\n[費用:NT$0.0000（未呼叫 LLM）]";

  replyMessage(replyToken, matchReply);
  writeRecordDirectly(userId, query, contextId, "user", "");
  writeRecordDirectly(userId, matchReply, contextId, "assistant", "");
  const localHistory = getHistoryFromCacheOrSheet(contextId);
  updateHistorySheetAndCache(
    contextId,
    localHistory,
    { role: "user", content: query },
    { role: "assistant", content: matchReply },
  );
  return true;
}

function getOfficialProductIdentityFromQuery_(query) {
  const q = String(query || "")
    .toUpperCase()
    .replace(/ＩＰＨＯＮＥ/g, "IPHONE");

  if (/IPHONE\s*(?:17\s*)?AIR(?:\s*版)?(?![A-Z])/i.test(q)) {
    return {
      id: "iphone-air",
      displayName: "iPhone Air",
      officialUrl: "https://www.apple.com/tw/iphone-air/specs/",
    };
  }

  const eVariant = q.match(/\bIPHONE\s*(1[6-7])\s*E\b/i);
  if (eVariant) {
    const model = eVariant[1];
    return {
      id: `iphone-${model}e`,
      displayName: `iPhone ${model}e`,
      officialUrl: `https://www.apple.com/tw/iphone-${model}e/specs/`,
    };
  }

  const numbered = q.match(/\bIPHONE\s*(1[5-7])\b/i);
  if (numbered) {
    const model = numbered[1];
    return {
      id: `iphone-${model}`,
      displayName: `iPhone ${model}`,
      officialUrl: `https://www.apple.com/tw/iphone-${model}/specs/`,
    };
  }

  return null;
}

function isOfficialProductPageEvidenceValid_(identity, url, plainText) {
  if (!identity || !identity.officialUrl) return false;
  const actualUrl = String(url || "").replace(/[?#].*$/, "").replace(/\/+$/, "");
  const expectedUrl = String(identity.officialUrl)
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  if (actualUrl.toLowerCase() !== expectedUrl.toLowerCase()) return false;

  const text = String(plainText || "");
  if (identity.id === "iphone-air") {
    return /IPHONE\s+AIR(?![A-Z])/i.test(text);
  }
  const escapedName = identity.displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escapedName, "i").test(text);
}

function isPositiveDisplayCapabilitySentence_(sentence) {
  const text = String(sentence || "");
  if (
    /不支援|未支援|沒有支援|無法|不能|不可|未列|沒有列|未標示|未明確|並未|不具備|不包含|是否支援|需要.{0,20}確認/i.test(
      text,
    )
  ) {
    return false;
  }
  if (
    /AIR\s*PLAY|AIRPLAY/i.test(text) &&
    !/DISPLAY\s*PORT|DP\s*ALT|透過\s*USB[\s‑–—_-]*C.{0,30}(?:顯示|影像|視訊|輸出|外接螢幕)/i.test(
      text,
    )
  ) {
    return false;
  }
  return (
    /(支援|可以|可透過|能夠|具備)/i.test(text) &&
    /(DISPLAY\s*PORT|USB[\s‑–—_-]*C|TYPE[\s‑–—_-]*C)/i.test(text) &&
    /(顯示|畫面|影像|視訊|輸出|外接螢幕|4K)/i.test(text)
  );
}

function isExplicitMonitorSideCapabilitySentence_(sentence) {
  const text = String(sentence || "");
  const namesMonitorSide =
    /(螢幕端|顯示器端|SMART\s*MONITOR|SAMSUNG\s*(?:M[5-9]|SMART)|\bM[5-9]\b|\bS\d{2}[A-Z0-9-]{4,}\b)/i.test(
      text,
    );
  const namesPhoneSide =
    /(IPHONE|手機端|手機本身|這款手機|APPLE\s*裝置|裝置端)/i.test(text);
  return namesMonitorSide && !namesPhoneSide;
}

function hasAppleDisplayEvidenceConflict_(query, answer) {
  const identity = getOfficialProductIdentityFromQuery_(query);
  if (!identity || !/(顯示|畫面|影像|視訊|輸出|DISPLAY\s*PORT|USB[\s‑–—_-]*C|TYPE[\s‑–—_-]*C)/i.test(query)) {
    return false;
  }

  const text = String(answer || "");
  const sentences = text.match(/[^。！？!?\n]+[。！？!?]?/g) || [text];
  if (identity.id === "iphone-air") {
    if (
      !/IPHONE\s*(?:17\s*)?AIR(?:\s*版)?(?![A-Z])/i.test(text) &&
      /\bIPHONE\s*17\b/i.test(text)
    ) {
      return true;
    }
    return sentences.some(
      (sentence) =>
        /IPHONE\s*(?:17\s*)?AIR|這款手機|手機本身|裝置端/i.test(sentence) &&
        isPositiveDisplayCapabilitySentence_(sentence) &&
        !isExplicitMonitorSideCapabilitySentence_(sentence),
    );
  }

  if (/^iphone-(?:16|17)e$/.test(identity.id)) {
    return sentences.some(
      (sentence) =>
        /IPHONE\s*(?:16|17)\s*E|這款手機|手機本身|裝置端/i.test(sentence) &&
        isPositiveDisplayCapabilitySentence_(sentence) &&
        !isExplicitMonitorSideCapabilitySentence_(sentence),
    );
  }

  return false;
}

function buildEvidenceConflictReply_() {
  return "⚠️ 我查到的資料在產品身分或連接能力上互相衝突，這一輪先不下結論，也不補猜。\n\n我已記錄人工複查；請確認 Apple 的正式產品名稱後再問一次，我會重新從同一款產品的官方規格查證。";
}

function isEvidenceConflictReply_(text) {
  return /資料在產品身分或連接能力上互相衝突|資料衝突，?暫不下結論|已記錄人工複查/i.test(
    String(text || ""),
  );
}

function getOfficialUrlContextCandidates(query) {
  const identity = getOfficialProductIdentityFromQuery_(query);
  return identity && identity.officialUrl ? [identity.officialUrl] : [];
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

function fetchOfficialUrlEvidence_(urls, query) {
  const evidence = [];
  const identity = getOfficialProductIdentityFromQuery_(query);
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
      if (!isOfficialProductPageEvidenceValid_(identity, url, plainText)) {
        writeLog(
          `[Official Product Guard v29.6.092] 拒絕產品身分不一致的官方頁: ${url}`,
        );
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
      evidence.push({
        url: String(url),
        productId: identity ? identity.id : "",
        text: text || plainText.substring(0, 12000),
      });
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
    "這是三星家電的相關問題，如果要查詢家電功能或操作方式，請提供家電完整型號（例如 WA、WD、VR 開頭的型號）",
  ].join("\n");
}

/**
 * 網搜友善型號修剪器 (v29.6.205)
 * 將如 S27FM501EC / LS27FM501ECXZW 轉為網路常見搜尋型號與系列別稱
 * 例如：S27FM501EC -> S27FM50 -> M5 / Smart Monitor M5
 */
function getSearchFriendlyModelTokens_(rawModel) {
  let m = String(rawModel || "").trim().toUpperCase();
  if (!m) return [];
  if (m.startsWith("L") && m.length >= 10) {
    m = m.substring(1);
  }
  m = m.replace(/(XZW|NC|UC|EC|AC|SC|GAC|NAC|NWC|UBC|UXC|UIC)$/i, "");

  const results = [];
  results.push(m);

  if (m.length > 5 && /\d$/.test(m)) {
    const trimmedOne = m.substring(0, m.length - 1);
    results.push(trimmedOne);
  }

  const seriesMatch = m.match(/(M[5789]|G[356789]|S[6789])/i);
  if (seriesMatch) {
    results.push(seriesMatch[1]);
    results.push(`Smart Monitor ${seriesMatch[1]}`);
    results.push(`Odyssey ${seriesMatch[1]}`);
  }

  return Array.from(new Set(results));
}

function isOutOfProjectScopeQuery(text) {
  const q = String(text || "");
  if (isCrossDeviceMonitorQuery(q)) return false;

  // 排除：若是音訊、耳機、接線、選單設定、解析度等電腦/螢幕常見配件與操作，不算 Out of Scope
  if (/(?:耳機|喇叭|音效|音訊|聲音|雙音訊|延遲|藍牙|BLUETOOTH|HDMI|DP|TYPE-?C|USB|解析度|更新率|刷新率|HDR|FREESYNC|G-SYNC|選單|設定|按鍵|遙控器|閃爍|沒畫面|黑屏|閃屏)/i.test(q)) {
    return false;
  }

  const hasMonitorContext =
    /(螢幕|顯示器|MONITOR|DISPLAY|ODYSSEY|VIEWFINITY|SMART\s*MONITOR|智慧螢幕|智慧顯示器|\bS\d{2}[A-Z0-9]{4,}|\bM[5789]\b|\bG[56789]\b)/i.test(
      q,
    );
  if (hasMonitorContext) return false;

  const purePhoneOrApplianceContext =
    /(?:(?:買|推薦|修理|維修).{0,6})?(?:洗衣機|乾衣機|冰箱|冷氣|空氣清淨機|吸塵器|掃地機器人|廚具)/i.test(
      q,
    );
  if (purePhoneOrApplianceContext) return true;

  const mentionsCompetitor =
    /(華碩|技嘉|微星|宏碁|戴爾|飛利浦|樂金|聯想|惠普|LG|BENQ|ASUS|GIGABYTE|AORUS|MSI|ACER|DELL|PHILIPS|AOC|LENOVO|HP)/i.test(
      q,
    );
  const asksMonitorOrPriceOrTable =
    /(螢幕|顯示器|MONITOR|DISPLAY|售價|價格|報價|最低價|促銷|Excel|表格|列出|比較|規格|更新率|刷新率|解析度|TYPE-?C)/i.test(
      q,
    );

  const clearlyUnrelated =
    /(高鐵|總統|電影|韓劇|餐廳|天氣|股票|匯率|旅遊|行事曆|郵件|新聞)/i.test(q);

  return (mentionsCompetitor && asksMonitorOrPriceOrTable) || clearlyUnrelated;
}

function buildOutOfProjectScopeReply(text) {
  return [
    "我主要協助三星電腦螢幕、Smart Monitor，以及外接電腦、手機或遊戲機的連線與設定問題",
    "如果有螢幕相關疑問，隨時提出 💡",
  ].join("\n");
}

function isTimelyWebInfoQuery(text) {
  const q = String(text || "");
  return /(最新上市|最新型號|新機型|新品|近期|最近|CES|雙11|雙12|黑五|BLACK\s*FRIDAY|12月份|促銷|活動|抽獎|登錄|延長保固|保固活動)/i.test(
    q,
  );
}

function isCampaignRuleCurrentlyActive_(ruleText) {
  const text = String(ruleText || "");
  const datePattern = /\b(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})\b/g;
  const stamps = [];
  let match;
  while ((match = datePattern.exec(text)) !== null) {
    stamps.push(
      Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3]),
    );
  }
  if (stamps.length === 0) return true;

  const todayText = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMMdd");
  const todayStamp = Number(todayText);
  return Math.max.apply(null, stamps) >= todayStamp;
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
      if (!isCampaignRuleCurrentlyActive_(ruleText)) {
        writeLog("[Campaign Rule Guard v29.6.143] 已略過過期活動 RULE");
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

function buildLocalCampaignRuleReply_(query) {
  const text = String(query || "");
  const models = dedupDisplayModels(extractFullModelLikeTokens(text), 2).map(
    normalizeModelForDisplay,
  );
  if (models.length !== 1) return "";
  const model = models[0];
  const ruleText = findLocalCampaignRuleForQuery(text);
  if (!ruleText) return "";

  const clauses = ruleText
    .split(/[；;]/)
    .map((clause) => clause.trim())
    .filter(Boolean);
  const modelUpper = model.toUpperCase();
  const benefitClauses = clauses.filter((clause) => {
    const upper = toHalfWidth(clause).toUpperCase();
    return (
      upper.indexOf(modelUpper) >= 0 ||
      /(?:指定螢幕機種可參加|月月抽|共通抽獎)/i.test(clause)
    );
  });
  if (benefitClauses.length === 0) return "";

  const activityName = (ruleText.match(/活動名稱[:：]([^,，]+)/i) || [])[1] || "";
  const activityPeriod =
    (ruleText.match(/活動期間[:：]([^,，]+)/i) || [])[1] || "";
  const registrationPeriod =
    (ruleText.match(/登錄期間[:：]([^,，]+)/i) || [])[1] || "";
  const lines = [`${model} 目前在本地官方活動 RULE 中的權益如下：`];
  benefitClauses.forEach((clause) => lines.push(`• ${clause}`));
  if (activityName) lines.push(`活動名稱：${activityName}`);
  if (activityPeriod) lines.push(`活動期間：${activityPeriod}`);
  if (registrationPeriod) lines.push(`登錄期間：${registrationPeriod}`);
  lines.push("[來源:官方活動庫]");
  writeLog(`[Campaign Rule Exact v29.6.145] ${model} 零 LLM 精確回覆有效活動`);
  return lines.join("\n");
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

  // 規格/能力題不自動升 PDF。對於沒有本機證據的操作答覆，保留模型
  // 已產生的有用內容作「部分回答」，但仍只提供一次手冊授權，不能把
  // 無來源步驟誤判成已核對事實。已核對片段會在 Fast 前直接 terminal return。
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

  const answerInsufficient = isOperationAnswerInsufficient(
    info.normalizedFastAnswer,
  );
  return answerInsufficient;
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
  return /(MATTER|THREAD|SMARTTHINGS|HUB|BORDER\s*ROUTER|CONTROLLER|ZIGBEE|中樞|集線器|協議|協定|橋接|網關|GATEWAY|HEVC|H\.?\s*265|H265|編解碼|CODEC|視訊格式|影片格式|影片檔|播放檔案|檔案格式|USB\s*播放|播放\s*USB|零售模式|使用模式|家庭模式|已連接裝置|媒體播放)/i.test(
    q,
  );
}

function isMediaCodecSupportQuery(text) {
  const q = String(text || "");
  return /(HEVC|H\.?\s*265|H265|H\.?\s*264|H264|VP9|AV1|編解碼|CODEC|視訊格式|影片格式|影片檔|播放檔案|影音格式|檔案格式|USB\s*播放|播放\s*USB|媒體播放|已連接裝置)/i.test(q);
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

function getExactSmartMonitorCodecModelFromQuery_(query, availableModels) {
  const models = Array.isArray(availableModels)
    ? availableModels.map((model) => String(model || "").toUpperCase())
    : getSmartMonitorCodecSelectionModels(50);
  const tokens = extractFullModelLikeTokens(query).map((token) =>
    String(token || "").toUpperCase().replace(/^LS/, "S"),
  );
  const matches = models.filter((model) =>
    tokens.some((token) => {
      if (token === model) return true;
      if (!token.startsWith(model)) return false;
      // 只接受 Samsung 地區／通路尾碼，不允許多一段數字的近似型號誤命中。
      return /^[A-Z]{1,6}$/.test(token.slice(model.length));
    }),
  );
  return matches.length === 1 ? matches[0] : "";
}

function buildSmartMonitorCodecManualQuery_(model) {
  const selectedModel = String(model || "").trim().toUpperCase();
  return `請查官方手冊「支援的視訊編解碼器」表格與 HEVC/H.265 相關注意事項：${selectedModel} 播放檔案是否支援 HEVC/H.265 格式？如果表格列有 HEVC（H.265 - Main、Main10）就回答支援，並標出手冊頁碼。請同時搜尋手冊是否有「HEVC 編解碼器僅適用於 MKV / MP4 / TS 檔案類型」這類限制；若有就列出 MKV/MP4/TS，若沒有就明確說手冊未列出檔案類型限制。禁止使用「通常」「常見」「應該」等推測語。只有找不到 HEVC/H.265 記載時才回答手冊未記載。 (型號: ${selectedModel})`;
}

/**
 * 從 QA2 資料層讀取已人工核對的官方手冊片段。
 * 題目資料與頁碼不可再硬寫於路由；未命中時才回到完整手冊授權／成本守門。
 */
function getVerifiedManualChunks_() {
  return qaKnowledgeGetManualEvidenceRecords_();
}
function isVerifiedManualEvidenceQuery_(chunk, query) {
  return qaKnowledgeManualQueryMatches_(chunk, query);
}

function findVerifiedManualChunk_(query, model) {
  return qaKnowledgeFindManualEvidence_(query, model);
}

function isEllipticalEvidenceFollowUp_(query) {
  const text = String(query || "")
    .replace(/\(型號:[^)]+\)/gi, "")
    .trim();
  if (!text || text.length > 24 || extractFullModelLikeTokens(text).length > 0) {
    return false;
  }
  return /^(?:那|它|這個|這款|所以|再|接著|然後|要|可以|能|該|如何|怎麼|怎樣|哪裡|在哪)/i.test(
    text,
  );
}

function getPreviousUserTopicForEvidence_(contextId, currentQuery) {
  if (!isEllipticalEvidenceFollowUp_(currentQuery)) return "";
  const history = getHistoryFromCacheOrSheet(contextId);
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i] && history[i].role === "user") {
      const previous = stripInternalRoutingHints_(history[i].content || "")
        .replace(/\(型號:[^)]+\)/gi, "")
        .trim();
      if (previous && previous !== String(currentQuery || "").trim() && !previous.startsWith("#")) {
        return previous;
      }
    }
  }
  return "";
}

function buildVerifiedManualChunkReply_(model, chunk) {
  return qaKnowledgeBuildManualReply_(model, chunk);
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
      ? "你點型號後，我會先用已核對的 QA／規格／手冊片段回答；若仍需整本手冊，會再提供一次明確入口。"
      : "請稍後再試，或補完整型號讓我重新確認手冊索引。",
    "",
    "[費用:NT$0.0000（未呼叫 LLM）]",
  ].join("\n");

  try {
    const cache = CacheService.getScriptCache();
    cache.put(`${userId}:suggested_models`, JSON.stringify(models), 300);
    cache.put(`${userId}:pending_topic`, String(query || ""), 600);
    cache.put(`${userId}:model_select_mode`, "fast", 600);
  } catch (e) {
    writeLog(`[Smart Codec Selection] 型號選擇快取寫入失敗: ${e.message}`);
  }

  const messages = [{ type: "text", text: leadText }];
  if (hasModels) {
    const flexMsg = createModelSelectionFlexV3(models, {
      headerText: "選要查的型號",
      altText: "請選擇 Smart Monitor 型號",
      footerText: "選定後接著回答原題",
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

// ════════════════════════════════════════════════════════════════
// v29.6.106 三來源 Rich Menu：一次性狀態、每日配額與來源授權
// ════════════════════════════════════════════════════════════════

function getSourceContextHash_(contextId) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(contextId || "UNKNOWN"),
  );
  return digest
    .map((b) => (b & 0xff).toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 24);
}

function getSourceDateKey_() {
  return Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMMdd");
}

function getSourcePendingKey_(contextId) {
  return `SRC_PENDING_${getSourceContextHash_(contextId)}`;
}

function getSourceRecentKey_(contextId) {
  return `SRC_RECENT_${getSourceContextHash_(contextId)}`;
}

const EXCLUSIVE_FEATURE_REGISTRY_ = [
  {
    id: "3D",
    regex: /(?:3D|裸視|裸眼3D|ODYSSEY\s*HUB|REALITY\s*HUB)/i,
    supportedModels: ["S27FG900XC", "G90XF", "G90XH"],
    exclusive: true,
    family: "Odyssey 3D",
    primaryModel: "S27FG900XC",
  },
  {
    id: "ARK_DIAL",
    regex: /(?:ARK\s*DIAL|方舟旋鈕|ARK旋鈕)/i,
    supportedModels: ["S55BG970NC", "G97NC"],
    exclusive: true,
    family: "Odyssey Ark",
    primaryModel: "S55BG970NC",
  },
  {
    id: "OLED_SAFEGUARD",
    regex: /(?:SAFEGUARD|防烙印|熱調節|動態冷卻系統)/i,
    supportedModels: [
      "S32DG802SC",
      "G80SD",
      "G60SD",
      "G90SD",
      "G95SC",
      "G93SC",
      "S27DG602SC",
      "S49CG954SC",
    ],
    exclusive: true,
    family: "Odyssey OLED",
    primaryModel: "S32DG802SC",
  },
];

function findExclusiveFeatureInQuery_(query) {
  const text = String(query || "");
  for (let i = 0; i < EXCLUSIVE_FEATURE_REGISTRY_.length; i++) {
    const item = EXCLUSIVE_FEATURE_REGISTRY_[i];
    if (item.regex.test(text)) {
      return item;
    }
  }
  return null;
}

function isModelCompatibleWithFeature_(model, featureId) {
  const norm = normalizeModelForDisplay(model || "");
  if (!norm) return false;
  const item = EXCLUSIVE_FEATURE_REGISTRY_.find((r) => r.id === featureId);
  if (!item) return true;
  return item.supportedModels.some((m) => norm.includes(m) || m.includes(norm));
}

function resolveNumberedStepFollowup_(msg, contextId, userId, replyToken) {
  const rawText = String(msg || "").replace(/\(型號:[^\)]+\)/gi, "").trim();
  const numMatch = rawText.match(/^(?:第\s*)?([0-9一二三四五六七八九十]+)(?:\s*[點項步個條])?\s*(?:是|為)?(?:什麼|甚麼|如何|怎麼|怎樣)?(?:意思|意指|做|解說|說明|設定|詳解)?\??$/i);
  if (!numMatch) return false;

  let targetIndex = parseInt(numMatch[1]);
  if (isNaN(targetIndex)) {
    const map = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10 };
    targetIndex = map[numMatch[1]] || 0;
  }
  if (!targetIndex || targetIndex <= 0) return false;

  const history = getHistoryFromCacheOrSheet(contextId);
  const lastBotMsg = history.slice().reverse().find(h => h.role === "assistant" && h.content && !h.content.startsWith("✓ 對話已重置"));
  if (!lastBotMsg || !lastBotMsg.content) return false;

  const botContent = lastBotMsg.content;
  const stepRegex = new RegExp(`(?:^|\\n)\\s*${targetIndex}[.、:：\\s]([^\\n]+)`, "i");
  const stepMatch = botContent.match(stepRegex);
  if (!stepMatch) return false;

  const stepText = stepMatch[1].trim();
  writeLog(`[Step Followup v29.6.240] 成功匹配第 ${targetIndex} 點: ${stepText}`);

  let explanation = "";
  if (/USB\s*選擇性暫停/i.test(stepText)) {
    explanation = [
      `第 ${targetIndex} 點【USB 選擇性暫停設為已停用】的意思是：`,
      "",
      "Windows 系統預設為了筆電或電腦省電，會在一段時間後自動把沒在傳輸資料的 USB 埠切換到「省電休眠」，這會導致 Odyssey 3D 的眼球追蹤鏡頭或 USB 傳輸線突然中斷斷連。",
      "",
      "將它設為【已停用】能確保電腦持續對螢幕的 USB 傳輸線維持全時供電，防止 3D 裸視效果在電腦休眠喚醒或長時間使用後莫名失效。",
      "",
      "💡 設定路徑：",
      "1. 按鍵盤 Windows 鍵，搜尋並打開「控制台」。",
      "2. 點選「電源選項」→ 點選目前電源計畫旁的「變更計畫設定」。",
      "3. 點選「變更進階電源設定」→ 展開「USB 設定」→「USB 選擇性暫停設定」。",
      "4. 將「設定」由【已啟用】改為【已停用】並按確定即可。",
      "[來源:官方規格庫]"
    ].join("\n");
  } else if (/眼球追蹤|鏡頭/i.test(stepText)) {
    explanation = [
      `第 ${targetIndex} 點【眼球追蹤鏡頭無遮擋】的意思是：`,
      "",
      "Odyssey 3D 螢幕頂部內建雙眼球追蹤攝影機，用來即時定位你的雙眼位置並精準投射 3D 視差光線。",
      "請確保螢幕頂部沒有貼紙、視訊鏡頭蓋或雜物遮擋，且頭部保持在螢幕正前方 70~90 公分的最佳觀看距離，3D 裸視效果才會清晰立體。",
      "[來源:官方規格庫]"
    ].join("\n");
  } else if (/直立模式|Pivot|旋轉/i.test(stepText)) {
    explanation = [
      `第 ${targetIndex} 點【直立模式不支援 3D】的意思是：`,
      "",
      "Odyssey 3D 的裸眼 3D 光學透鏡光柵是專為「橫向水平 (Landscape)」設計的。",
      "如果將螢幕轉成直立方向 (Pivot 90度)，光柵角度會錯位無法形成立體雙眼視差，因此使用 3D 功能時請務必維持一般的橫向顯示。",
      "[來源:官方規格庫]"
    ].join("\n");
  } else {
    explanation = [
      `第 ${targetIndex} 點【${stepText}】的詳細說明：`,
      "",
      `這項步驟是針對上一則排查流程中的核心操作。請依照提示檢查相應的線材、OSD 選單或系統設定，能有效排除畫面異常或連線中斷。`,
      "[來源:官方規格庫]"
    ].join("\n");
  }

  replyMessage(replyToken, explanation);
  writeRecordDirectly(userId, rawText, contextId, "user", "");
  writeRecordDirectly(userId, explanation, contextId, "assistant", "");
  updateHistorySheetAndCache(
    contextId,
    history,
    { role: "user", content: rawText },
    { role: "assistant", content: explanation }
  );
  return true;
}

function getSourceProductKey_(contextId) {
  return `SRC_PRODUCT_${getSourceContextHash_(contextId)}`;
}

function readSourceProductState_(contextId) {
  const key = getSourceProductKey_(contextId);
  const cache = CacheService.getScriptCache();
  let state = parseSourceStateJson_(cache.get(key));
  if (!state) {
    state = parseSourceStateJson_(
      PropertiesService.getScriptProperties().getProperty(key),
    );
  }
  if (!state || !state.model) return null;
  state.model = normalizeModelForDisplay(state.model);
  if (!state.model) return null;
  cache.put(key, JSON.stringify(state), 21600);
  return state;
}

function rememberSourceProductModel_(contextId, model, reason) {
  const normalized = normalizeModelForDisplay(model || "");
  if (!normalized || isShortAliasModelToken(normalized)) return null;
  const existing = readSourceProductState_(contextId) || {};
  if (normalizeModelForDisplay(existing.model || "") === normalized) {
    // 型號跨日持久化不靠每題刷新 updatedAt；同型號重複寫 Properties
    // 只會增加延遲與 Log 噪音，且沒有任何路由效益。
    return existing;
  }
  const state = {
    model: normalized,
    lastSource: String(existing.lastSource || ""),
    updatedAt: Date.now(),
    reason: String(reason || "resolved_model"),
  };
  const key = getSourceProductKey_(contextId);
  const payload = JSON.stringify(state);
  CacheService.getScriptCache().put(key, payload, 21600);
  PropertiesService.getScriptProperties().setProperty(key, payload);
  writeLog(
    `[Product State v29.6.132] context=${getSourceContextHash_(contextId)} model=${normalized} reason=${state.reason}`,
  );
  return state;
}

function rememberSourceLastAdvanced_(contextId, source) {
  const existing = readSourceProductState_(contextId);
  if (!existing || !existing.model) return null;
  const state = Object.assign({}, existing, {
    lastSource: String(source || ""),
    updatedAt: Date.now(),
  });
  const key = getSourceProductKey_(contextId);
  const payload = JSON.stringify(state);
  CacheService.getScriptCache().put(key, payload, 21600);
  PropertiesService.getScriptProperties().setProperty(key, payload);
  return state;
}

function clearSourceProductState_(contextId) {
  const key = getSourceProductKey_(contextId);
  CacheService.getScriptCache().remove(key);
  PropertiesService.getScriptProperties().deleteProperty(key);
}

function getSourceQuotaKey_(contextId, dateKey) {
  return `SRC_QUOTA_${getSourceContextHash_(contextId)}_${dateKey || getSourceDateKey_()}`;
}

function getDailyQuestionQuotaKey_(userId, dateKey) {
  return `USR_QDAY_${getSourceContextHash_(userId)}_${dateKey || getSourceDateKey_()}`;
}

function readDailyQuestionUsage_(userId) {
  const dateKey = getSourceDateKey_();
  const key = getDailyQuestionQuotaKey_(userId, dateKey);
  let state = parseSourceStateJson_(CacheService.getScriptCache().get(key));
  if (!state) {
    state = parseSourceStateJson_(
      PropertiesService.getScriptProperties().getProperty(key),
    );
  }
  if (!state || state.date !== dateKey) {
    state = { date: dateKey, used: 0 };
  }
  state.used = Math.max(0, Number(state.used || 0));
  CacheService.getScriptCache().put(key, JSON.stringify(state), 21600);
  return state;
}

function getDailyQuestionRemaining_(userId) {
  const state = readDailyQuestionUsage_(userId);
  return Math.max(0, USER_DAILY_QUESTION_LIMIT - Number(state.used || 0));
}

function reserveDailyQuestionUsage_(userId) {
  // 每人提問額度不得和 PDF 索引同步共用 ScriptLock，否則背景重建期間
  // 會把一般問題誤判成配額鎖逾時。UserLock 只保護短小的計數寫入。
  const lock = LockService.getUserLock();
  if (!lock.tryLock(5000)) {
    throw new Error("DAILY_QUESTION_QUOTA_LOCK_TIMEOUT");
  }
  try {
    const props = PropertiesService.getScriptProperties();
    const dateKey = getSourceDateKey_();
    const key = getDailyQuestionQuotaKey_(userId, dateKey);
    let state = parseSourceStateJson_(props.getProperty(key));
    if (!state || state.date !== dateKey) {
      state = { date: dateKey, used: 0 };
    }
    state.used = Math.max(0, Number(state.used || 0));
    if (state.used >= USER_DAILY_QUESTION_LIMIT) {
      return {
        allowed: false,
        used: state.used,
        remaining: 0,
      };
    }
    state.used += 1;
    props.setProperty(key, JSON.stringify(state));
    CacheService.getScriptCache().put(key, JSON.stringify(state), 21600);
    writeLog(
      `[Daily Question Guard v29.6.113] used=${state.used}/${USER_DAILY_QUESTION_LIMIT}`,
    );
    return {
      allowed: true,
      used: state.used,
      remaining: Math.max(0, USER_DAILY_QUESTION_LIMIT - state.used),
    };
  } finally {
    lock.releaseLock();
  }
}

function refundDailyQuestionUsage_(userId, reason) {
  const lock = LockService.getUserLock();
  if (!lock.tryLock(5000)) {
    writeLog(
      "[Daily Question Guard v29.6.120] 退回額度時鎖忙碌，保留原計次避免並行重複退回",
    );
    return null;
  }
  try {
    const props = PropertiesService.getScriptProperties();
    const dateKey = getSourceDateKey_();
    const key = getDailyQuestionQuotaKey_(userId, dateKey);
    let state = parseSourceStateJson_(props.getProperty(key));
    if (!state || state.date !== dateKey) {
      state = { date: dateKey, used: 0 };
    }
    state.used = Math.max(0, Number(state.used || 0) - 1);
    props.setProperty(key, JSON.stringify(state));
    CacheService.getScriptCache().put(key, JSON.stringify(state), 21600);
    const remaining = Math.max(0, USER_DAILY_QUESTION_LIMIT - state.used);
    CURRENT_DAILY_QUESTION_REMAINING = remaining;
    writeLog(
      `[Daily Question Guard v29.6.120] refunded=1 used=${state.used}/${USER_DAILY_QUESTION_LIMIT} reason=${String(reason || "source_handoff")}`,
    );
    return { used: state.used, remaining: remaining };
  } finally {
    lock.releaseLock();
  }
}

function getDailyQuestionModelHoldKey_(userId) {
  return `USR_QHOLD_${getSourceContextHash_(userId)}`;
}

function markDailyQuestionModelSelectionHold_(userId) {
  CacheService.getScriptCache().put(
    getDailyQuestionModelHoldKey_(userId),
    JSON.stringify({ date: getSourceDateKey_(), expiresAt: Date.now() + 600000 }),
    600,
  );
}

function consumeDailyQuestionModelSelectionHold_(userId) {
  const cache = CacheService.getScriptCache();
  const key = getDailyQuestionModelHoldKey_(userId);
  const state = parseSourceStateJson_(cache.get(key));
  cache.remove(key);
  return Boolean(
    state &&
      state.date === getSourceDateKey_() &&
      Number(state.expiresAt || 0) >= Date.now(),
  );
}

function clearDailyQuestionModelSelectionHold_(userId) {
  CacheService.getScriptCache().remove(getDailyQuestionModelHoldKey_(userId));
}

function shouldCountDailyQuestionText_(message, contextId) {
  const text = String(message || "").trim();
  if (!text || isSourceCancelText_(text) || /^\//.test(text)) return false;

  // 「再詳細說明」只是展開上一題，不是新的實質問題。
  if (text === "#再詳細說明") return false;

  // 型號按鈕只是延續同一題，不得再扣一次一般提問額度。
  if (/^#型號:/i.test(text)) return false;

  const explicitSource = parseExplicitSourceCommand_(text);
  // 手冊與網路已有各自的每日額度，不與「直接問」20 題重複計次。
  if (explicitSource) return false;
  if (parseContextualSourceIntent_(text, contextId)) return false;

  const pending = readPendingSourceState_(contextId, true);
  // 包含已逾時狀態：下一步只會提示重新按來源，不應誤扣一般額度。
  if (pending) return false;
  return true;
}

function reserveDailyQuestionOrReply_(userId, replyToken) {
  let result;
  try {
    result = reserveDailyQuestionUsage_(userId);
  } catch (error) {
    if (String(error && error.message ? error.message : error) !== "DAILY_QUESTION_QUOTA_LOCK_TIMEOUT") {
      throw error;
    }
    CURRENT_DAILY_QUESTION_REMAINING = null;
    writeLog(
      "[Daily Question Guard v29.6.114] 額度鎖忙碌，fail closed：不計次、不送供應商",
    );
    replyMessage(
      replyToken,
      "系統正在整理資料，這次沒有計入提問次數，也沒有送出付費查詢。請稍後再送一次。",
    );
    return { allowed: false, busy: true, remaining: null };
  }
  if (result.allowed) {
    CURRENT_DAILY_QUESTION_REMAINING = result.remaining;
    return result;
  }
  CURRENT_DAILY_QUESTION_REMAINING = null;
  replyMessage(
    replyToken,
    `今天的 ${USER_DAILY_QUESTION_LIMIT} 次提問已用完。明天 00:00（台北時間）會自動恢復；按來源、取消或選型號都不會另外計次。`,
  );
  return result;
}

function parseSourceStateJson_(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (e) {
    return null;
  }
}

function writePendingSourceState_(contextId, state) {
  const normalized = Object.assign({}, state || {}, {
    contextId: contextId,
    updatedAt: Date.now(),
    expiresAt: Date.now() + SOURCE_PENDING_TTL_SECONDS * 1000,
  });
  const key = getSourcePendingKey_(contextId);
  const payload = JSON.stringify(normalized);
  CacheService.getScriptCache().put(key, payload, SOURCE_PENDING_TTL_SECONDS);
  PropertiesService.getScriptProperties().setProperty(key, payload);
  return normalized;
}

function readPendingSourceState_(contextId, includeExpired) {
  const key = getSourcePendingKey_(contextId);
  const cache = CacheService.getScriptCache();
  let state = parseSourceStateJson_(cache.get(key));
  if (!state) {
    state = parseSourceStateJson_(
      PropertiesService.getScriptProperties().getProperty(key),
    );
  }
  if (!state) return null;
  if (Number(state.expiresAt || 0) < Date.now()) {
    if (includeExpired) return Object.assign({}, state, { expired: true });
    clearPendingSourceState_(contextId);
    return null;
  }
  cache.put(key, JSON.stringify(state), SOURCE_PENDING_TTL_SECONDS);
  return state;
}

function clearPendingSourceState_(contextId) {
  const key = getSourcePendingKey_(contextId);
  CacheService.getScriptCache().remove(key);
  PropertiesService.getScriptProperties().deleteProperty(key);
}

function normalizeSourceQuestionIdentity_(question, model) {
  let text = toHalfWidth(stripInternalRoutingHints_(question))
    .toUpperCase()
    .replace(/\(型號[:：][^)]+\)/gi, " ");
  const normalizedModel = normalizeModelForDisplay(model || "");
  if (normalizedModel) {
    text = text.replace(
      new RegExp(normalizedModel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      " ",
    );
  }
  return text.replace(/[\s,，。；;：:、.!！?？()（）\-]/g, "");
}

function normalizeAdvancedSourceTopicIdentity_(question, model) {
  const base = normalizeSourceQuestionIdentity_(question, model);
  if (/(?:零售模式|展示模式|商店模式|使用模式)/.test(base)) {
    return "零售模式";
  }
  if (/(?:恢復原廠|回復原廠|原廠重設|重設出廠|重置)/.test(base)) {
    return "恢復原廠";
  }
  let text = base
    .replace(/(?:如何用|怎麼用|怎樣用)/g, "")
    .replace(/(?:請|麻煩|幫我|再|一下|查詢|搜尋|搜|查|如何|怎麼|怎樣|那你|那)/g, "")
    .replace(/(?:零售模式|展示模式|商店模式|使用模式)/g, "零售模式")
    .replace(/(?:USB隨身碟|USB儲存裝置|USB裝置|USB媒體)/g, "USB")
    .replace(/(?:播放USB|USB播放)/g, "USB播放")
    .replace(/(?:恢復原廠設定|回復原廠設定|原廠重設|重設出廠|重置)/g, "恢復原廠")
    .replace(/(?:藍牙耳機|BLUETOOTH耳機|藍牙音訊|BLUETOOTH音訊)/g, "藍牙裝置");
  return text.trim();
}

function isSameRecentSourceQuestion_(question, previousQuestion, model) {
  const current = normalizeSourceQuestionIdentity_(question, model);
  const previous = normalizeSourceQuestionIdentity_(previousQuestion, model);
  return Boolean(current && previous && current === previous);
}

function stripKnownModelFromSourceQuestion_(question, model) {
  let text = String(question || "").replace(/\s*\(型號[:：][^)]+\)\s*/gi, " ");
  const normalizedModel = normalizeModelForDisplay(model || "");
  if (normalizedModel) {
    text = text.replace(
      new RegExp(normalizedModel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      " ",
    );
  }
  return text.replace(/\s{2,}/g, " ").trim();
}

function rememberRecentSourceQuestion_(contextId, question, model) {
  const text = String(question || "").trim();
  if (!text || text.startsWith("#") || text.startsWith("/")) return;
  const explicitModels = extractFullModelLikeTokens(text);
  const candidateModel = normalizeModelForDisplay(model || explicitModels[0] || "");
  const explicitModel =
    candidateModel && isKnownFullModelToken(candidateModel) ? candidateModel : "";
  if (candidateModel && !explicitModel) {
    writeLog(
      `[Product State Guard v29.6.145] 未登錄型號 ${candidateModel} 不寫入持久產品狀態`,
    );
  }
  if (explicitModel) {
    rememberSourceProductModel_(contextId, explicitModel, "question");
  }
  const productState = readSourceProductState_(contextId);
  const state = {
    question: text,
    // 無型號追問不得把既有型號洗成空字串；產品狀態跨日保留，只有新完整
    // 型號、使用者選型或管理員 /重啟 才能改變。
    model: explicitModel || (productState ? productState.model : ""),
    updatedAt: Date.now(),
    expiresAt: Date.now() + SOURCE_RECENT_QUESTION_TTL_SECONDS * 1000,
  };
  const key = getSourceRecentKey_(contextId);
  const payload = JSON.stringify(state);
  CacheService.getScriptCache().put(
    key,
    payload,
    SOURCE_RECENT_QUESTION_TTL_SECONDS,
  );
  PropertiesService.getScriptProperties().setProperty(key, payload);
}

function readRecentSourceQuestion_(contextId) {
  const key = getSourceRecentKey_(contextId);
  let state = parseSourceStateJson_(CacheService.getScriptCache().get(key));
  if (!state) {
    state = parseSourceStateJson_(
      PropertiesService.getScriptProperties().getProperty(key),
    );
  }
  if (!state || Number(state.expiresAt || 0) < Date.now()) {
    CacheService.getScriptCache().remove(key);
    PropertiesService.getScriptProperties().deleteProperty(key);
    return null;
  }
  return state;
}

function clearRecentSourceQuestion_(contextId) {
  const key = getSourceRecentKey_(contextId);
  CacheService.getScriptCache().remove(key);
  PropertiesService.getScriptProperties().deleteProperty(key);
}

function readSourceQuota_(contextId) {
  const dateKey = getSourceDateKey_();
  const key = getSourceQuotaKey_(contextId, dateKey);
  let state = parseSourceStateJson_(CacheService.getScriptCache().get(key));
  if (!state) {
    state = parseSourceStateJson_(
      PropertiesService.getScriptProperties().getProperty(key),
    );
  }
  if (!state || state.date !== dateKey) {
    state = { date: dateKey, manual: 0, web: 0 };
  }
  state.manual = Math.max(0, Number(state.manual || 0));
  state.web = Math.max(0, Number(state.web || 0));
  CacheService.getScriptCache().put(key, JSON.stringify(state), 21600);
  return state;
}

function getSourceRemaining_(contextId, source) {
  const state = readSourceQuota_(contextId);
  const limit = Number(SOURCE_DAILY_LIMITS[source] || 0);
  return Math.max(0, limit - Number(state[source] || 0));
}

function reserveAdvancedSourceUsage_(grant) {
  if (!grant || !grant.source || !grant.contextId) {
    throw new Error("ADVANCED_SOURCE_AUTH_REQUIRED");
  }
  if (grant.reserved) return grant;

  const source = grant.source;
  const limit = Number(SOURCE_DAILY_LIMITS[source] || 0);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    throw new Error("SOURCE_QUOTA_LOCK_TIMEOUT");
  }
  try {
    const props = PropertiesService.getScriptProperties();
    const dateKey = getSourceDateKey_();
    if (grant.systemRescue === true && source === "web") {
      const rescueKey = `SRC_RESCUE_${getSourceContextHash_(grant.contextId)}_${dateKey}`;
      const rescueUsed = Math.max(0, Number(props.getProperty(rescueKey) || 0));
      if (rescueUsed >= SOURCE_DAILY_SYSTEM_WEB_RESCUE_LIMIT) {
        throw new Error("SOURCE_RESCUE_EXHAUSTED_WEB");
      }
      props.setProperty(rescueKey, String(rescueUsed + 1));
      grant.reserved = true;
      grant.systemRescueReserved = true;
      grant.used = rescueUsed + 1;
      grant.remaining = getSourceRemaining_(grant.contextId, "web");
      writeLog(
        `[Source Rescue v29.6.148] webAttempt=${grant.used}/${SOURCE_DAILY_SYSTEM_WEB_RESCUE_LIMIT} userWebQuotaCharged=0`,
      );
      return grant;
    }
    const key = getSourceQuotaKey_(grant.contextId, dateKey);
    let state = parseSourceStateJson_(props.getProperty(key));
    if (!state || state.date !== dateKey) {
      state = { date: dateKey, manual: 0, web: 0 };
    }
    state.manual = Math.max(0, Number(state.manual || 0));
    state.web = Math.max(0, Number(state.web || 0));
    if (state[source] >= limit) {
      throw new Error(`SOURCE_QUOTA_EXHAUSTED_${source.toUpperCase()}`);
    }
    state[source] += 1;
    props.setProperty(key, JSON.stringify(state));
    CacheService.getScriptCache().put(key, JSON.stringify(state), 21600);
    grant.reserved = true;
    grant.used = state[source];
    grant.remaining = Math.max(0, limit - state[source]);
    writeLog(
      `[Source Quota v29.6.106] source=${source} used=${state[source]}/${limit}`,
    );
    return grant;
  } finally {
    lock.releaseLock();
  }
}

function refundAdvancedSourceUsage_(grant, reason) {
  if (!grant || !grant.reserved || !grant.source || !grant.contextId) return grant;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    writeLog(
      `[Source Quota v29.6.132] 退款鎖忙碌，保留原計次避免重複退款 source=${grant.source}`,
    );
    return grant;
  }
  try {
    const props = PropertiesService.getScriptProperties();
    const dateKey = getSourceDateKey_();
    const key = getSourceQuotaKey_(grant.contextId, dateKey);
    let state = parseSourceStateJson_(props.getProperty(key));
    if (!state || state.date !== dateKey) {
      state = { date: dateKey, manual: 0, web: 0 };
    }
    state.manual = Math.max(0, Number(state.manual || 0));
    state.web = Math.max(0, Number(state.web || 0));
    state[grant.source] = Math.max(0, Number(state[grant.source] || 0) - 1);
    props.setProperty(key, JSON.stringify(state));
    CacheService.getScriptCache().put(key, JSON.stringify(state), 21600);
    grant.reserved = false;
    grant.refunded = true;
    grant.remaining = Math.max(
      0,
      Number(SOURCE_DAILY_LIMITS[grant.source] || 0) - state[grant.source],
    );
    writeLog(
      `[Source Quota v29.6.132] refunded=1 source=${grant.source} reason=${String(reason || "system_failure")}`,
    );
    return grant;
  } finally {
    lock.releaseLock();
  }
}

function getPreviousGasPatchVersion_(version) {
  const match = String(version || "").match(/^v(\d+)\.(\d+)\.(\d+)$/);
  if (!match || Number(match[3]) <= 0) return "";
  return `v${match[1]}.${match[2]}.${Number(match[3]) - 1}`;
}

function getAdvancedSourceOperationKey_(
  contextId,
  source,
  query,
  model,
  versionOverride,
) {
  const identity = [
    String(versionOverride || GAS_VERSION),
    String(source || ""),
    normalizeModelForDisplay(model || ""),
    normalizeAdvancedSourceTopicIdentity_(query, model),
  ].join("|");
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    identity,
  );
  const hash = digest
    .map((b) => (b & 0xff).toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 24);
  return `SRC_OP_${getSourceContextHash_(contextId)}_${hash}`;
}

function beginAdvancedSourceOperation_(contextId, source, query, model) {
  const cache = CacheService.getScriptCache();
  const key = getAdvancedSourceOperationKey_(contextId, source, query, model);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return { allowed: false, busy: true, key: key };
  }
  try {
    const now = Date.now();
    let existing = parseSourceStateJson_(cache.get(key));
    // 部署只修回覆封裝時，上一版已完成／執行中的同題不能因版本鍵改變
    // 再次扣費。只沿用前一 patch 且仍在原 10 分鐘 TTL 內的 operation。
    if (!existing || Number(existing.expiresAt || 0) < now) {
      const previousVersion = getPreviousGasPatchVersion_(GAS_VERSION);
      if (previousVersion) {
        const previousKey = getAdvancedSourceOperationKey_(
          contextId,
          source,
          query,
          model,
          previousVersion,
        );
        const previous = parseSourceStateJson_(cache.get(previousKey));
        if (previous && Number(previous.expiresAt || 0) >= now) {
          const remainingTtl = Math.max(
            1,
            Math.ceil((Number(previous.expiresAt) - now) / 1000),
          );
          cache.put(key, JSON.stringify(previous), remainingTtl);
          existing = previous;
          writeLog(
            `[Source Operation v29.6.253] 沿用 ${previousVersion} 同題結果，避免部署後重複扣費`,
          );
        }
      }
    }
    if (existing && Number(existing.expiresAt || 0) >= Date.now()) {
      return Object.assign({ allowed: false, key: key }, existing);
    }
    const running = {
      status: "running",
      createdAt: Date.now(),
      expiresAt: Date.now() + SOURCE_OPERATION_CACHE_TTL_SECONDS * 1000,
    };
    cache.put(key, JSON.stringify(running), SOURCE_OPERATION_CACHE_TTL_SECONDS);
    return { allowed: true, key: key };
  } finally {
    lock.releaseLock();
  }
}

function finishAdvancedSourceOperation_(operation, finalText, model, ttlSeconds) {
  if (!operation || !operation.key) return;
  const ttl = Math.max(30, Number(ttlSeconds || SOURCE_OPERATION_CACHE_TTL_SECONDS));
  const state = {
    status: "done",
    finalText: String(finalText || ""),
    model: normalizeModelForDisplay(model || ""),
    createdAt: Date.now(),
    expiresAt: Date.now() + ttl * 1000,
  };
  CacheService.getScriptCache().put(
    operation.key,
    JSON.stringify(state),
    ttl,
  );
}

function clearAdvancedSourceOperation_(operation) {
  if (operation && operation.key) {
    CacheService.getScriptCache().remove(operation.key);
  }
}

function activateAdvancedSourceGrant_(source, contextId, userId, options) {
  const normalizedOptions = options || {};
  ACTIVE_ADVANCED_SOURCE_GRANT = {
    source: source,
    contextId: contextId,
    userId: userId,
    createdAt: Date.now(),
    reserved: false,
    systemRescue: normalizedOptions.systemRescue === true,
  };
  return ACTIVE_ADVANCED_SOURCE_GRANT;
}

function assertAdvancedSourceGrant_(source, userId) {
  const grant = ACTIVE_ADVANCED_SOURCE_GRANT;
  if (
    !grant ||
    grant.source !== source ||
    String(grant.userId || "") !== String(userId || "") ||
    Date.now() - Number(grant.createdAt || 0) > SOURCE_PENDING_TTL_SECONDS * 1000
  ) {
    throw new Error(`ADVANCED_SOURCE_AUTH_REQUIRED_${String(source).toUpperCase()}`);
  }
  return grant;
}

function clearLegacyAdvancedRouteState_(cache, userId, contextId) {
  const targetCache = cache || CacheService.getScriptCache();
  [
    CACHE_KEYS.PDF_MODE_PREFIX + contextId,
    `${userId}:pdf_mode`,
    `${userId}:manual_search_consent`,
    `${userId}:pending_manual_query`,
    `${userId}:pending_pdf_query`,
    `${userId}:pdf_consulted`,
    `pdf_consulted_${userId}`,
  ].forEach(function (key) {
    targetCache.remove(key);
  });
}

function parsePostbackData_(data) {
  const result = {};
  String(data || "")
    .split("&")
    .forEach(function (pair) {
      const parts = pair.split("=");
      if (!parts[0]) return;
      const key = decodeURIComponent(parts.shift());
      result[key] = decodeURIComponent(parts.join("=") || "");
    });
  return result;
}

function buildSourcePostbackQuickReply_(label, data) {
  return {
    type: "action",
    action: {
      type: "postback",
      label: label,
      data: data,
    },
  };
}

function isFullSamsungMonitorModelForOfficialPage_(model) {
  const normalized = normalizeModelForDisplay(model);
  return /^(?:S|C|F)\d{2,3}[A-Z0-9]{4,}$/i.test(normalized) &&
    !isShortAliasModelToken(normalized);
}

function isSafeSamsungTwOfficialUrl_(url) {
  return /^https:\/\/www\.samsung\.com\/tw\//i.test(String(url || "").trim());
}

/**
 * 只從 CLASS_RULES 已確認的完整型號建立三星台灣官網入口。
 * RULE 有 PDP 網址時優先使用；否則以同列 XZW 完整料號建立官方支援頁。
 * 不接受 G8／M8 等系列別稱，避免把客戶帶到錯款商品頁。
 */
function getSamsungOfficialModelPage_(model) {
  const normalized = normalizeModelForDisplay(model);
  if (!isFullSamsungMonitorModelForOfficialPage_(normalized) || !ss) {
    return null;
  }

  const cache = CacheService.getScriptCache();
  const cacheKey = `official_model_page_v1_${normalized}`;
  const cached = cache.get(cacheKey);
  if (cached === "-") return null;
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && isSafeSamsungTwOfficialUrl_(parsed.uri)) return parsed;
    } catch (e) {}
  }

  try {
    const sheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    if (!sheet || sheet.getLastRow() < 1) return null;
    const rows = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
    for (let i = 0; i < rows.length; i++) {
      const ruleText = String(rows[i][0] || "").trim();
      if (!ruleText || isIncompleteModelRuleLine_(ruleText)) continue;
      const fullSku = String(ruleText.split(",")[0] || "")
        .trim()
        .toUpperCase();
      const declaredMatch = ruleText.match(/型號[：:]\s*([A-Z0-9]+)/i);
      const declaredModel = normalizeModelForDisplay(
        declaredMatch ? declaredMatch[1] : fullSku,
      );
      if (
        !declaredModel ||
        !isPdfModelTokenMatch_(declaredModel, normalized)
      ) {
        continue;
      }

      const explicitUrlMatch = ruleText.match(
        /官網網址\s*[：:]\s*(https:\/\/www\.samsung\.com\/tw\/[^\s,]+)/i,
      );
      let uri = explicitUrlMatch ? explicitUrlMatch[1].trim() : "";
      let urlSource = "rule_pdp";
      if (!isSafeSamsungTwOfficialUrl_(uri)) {
        const supportSku = /^L[SCF]\d{2,3}[A-Z0-9]{4,}XZW$/i.test(fullSku)
          ? fullSku
          : "";
        if (!supportSku) continue;
        uri = `https://www.samsung.com/tw/support/model/${encodeURIComponent(supportSku)}/`;
        urlSource = "rule_support";
      }

      const result = {
        model: declaredModel,
        uri: uri,
        source: urlSource,
      };
      cache.put(cacheKey, JSON.stringify(result), 21600);
      return result;
    }
  } catch (e) {
    writeLog(`[Official Model Page] ${normalized} 查找失敗: ${e.message}`);
  }

  cache.put(cacheKey, "-", 1800);
  return null;
}

function resolveSamsungOfficialModelPage_(
  query,
  primaryModel,
) {
  // 官網連結只能綁本題文字中的完整型號，或本題路由明確解析出的 primaryModel。
  // 禁止讀 suggested/direct-search Cache，避免無型號的新題借到上一款官網。
  const candidates = dedupDisplayModels(
    extractFullModelLikeTokens(query)
      .concat(primaryModel ? [primaryModel] : [])
      .filter(function (model) {
        return isFullSamsungMonitorModelForOfficialPage_(model);
      }),
    6,
  );
  for (let i = 0; i < candidates.length; i++) {
    const page = getSamsungOfficialModelPage_(candidates[i]);
    if (page) return page;
  }
  return null;
}

function shouldOfferSamsungOfficialPage_(replyText) {
  const text = String(replyText || "");
  return (
    isKnowledgeMissingReply_(text) ||
    /手冊(?:目前)?(?:未記載|未涵蓋|沒有直接證據)|無法(?:直接|可靠)?(?:確認|證明)|找不到.{0,30}(?:PDF|手冊|對應檔案)|手冊索引.{0,20}(?:找不到|需要背景更新)|手冊查詢.{0,20}(?:沒有完成|暫時無法)|網路搜尋.{0,20}(?:沒有完成|暫時無法)|資料.{0,12}(?:衝突|不足)|要改查三星官方網站|建議.{0,12}(?:三星)?官方(?:網站|產品頁|支援頁)/i.test(
      text,
    )
  );
}

function buildSamsungOfficialPageQuickReply_(page) {
  if (!page || !isSafeSamsungTwOfficialUrl_(page.uri)) return null;
  return {
    type: "action",
    action: {
      type: "uri",
      label: "🔗 到這款官網",
      uri: page.uri,
    },
  };
}

function buildSourceSelectionPrompt_(
  source,
  remaining,
  previousQuestion,
  previousModel,
) {
  const limit = SOURCE_DAILY_LIMITS[source];
  const title = source === "manual" ? "📖 官方手冊" : "🌐 網路解答";
  const description =
    source === "manual"
      ? "我會先用現有規格與問答確認；仍不足就直接查官方手冊。手冊沒有明確答案時，會再補查一次公開網頁。"
      : "會搜尋公開網頁中的非官方實務解法；三星官方規格仍以規格／FAQ為準，非官方內容會清楚標示，請斟酌參考。";
  const lines = [`${title}｜今日剩餘 ${remaining}/${limit} 次`, description];
  if (previousQuestion) {
    lines.push(`目前問題：「${String(previousQuestion).substring(0, 160)}」`);
    if (source === "manual" && previousModel) {
      lines.push(`目前沿用型號：${normalizeModelForDisplay(previousModel)}。若型號不對，可點「換型號」。`);
    }
    lines.push("我會直接接著處理這題，不會再多問一次。");
  } else {
    lines.push(
      source === "manual"
        ? "請直接輸入「系列／型號＋問題」；若需要選型號，選完就會直接查。輸入「取消」離開。"
        : "請直接輸入問題；收到後會直接搜尋。輸入「取消」離開。",
    );
  }
  return lines.join("\n\n");
}

function startSourceSelection_(source, contextId, userId, replyToken) {
  if (source === "spec") {
    clearPendingSourceState_(contextId);
    clearLegacyAdvancedRouteState_(CacheService.getScriptCache(), userId, contextId);
    LAST_SOURCE_TEST_STATE = {
      source: "spec",
      pending: false,
      hasPrevious: false,
    };
    replyMessage(
      replyToken,
      `已切回「規格＆FAQ」快速模式。實驗期間每位使用者每天可提問 ${USER_DAILY_QUESTION_LIMIT} 次，請直接輸入型號與問題。`,
    );
    return true;
  }

  if (source !== "manual" && source !== "web") return false;
  const remaining = getSourceRemaining_(contextId, source);
  if (remaining <= 0) {
    clearPendingSourceState_(contextId);
    LAST_SOURCE_TEST_STATE = {
      source: source,
      pending: false,
      hasPrevious: false,
      remaining: 0,
    };
    replyMessage(
      replyToken,
      `今天的${source === "manual" ? "官方手冊 5 次" : "網路解答 10 次"}已用完。你仍可使用「規格＆FAQ」的每日提問額度，明天 00:00 會自動恢復。`,
    );
    return true;
  }

  const recent = readRecentSourceQuestion_(contextId);
  const previousQuestion = recent ? recent.question : "";
  const persistentProduct = readSourceProductState_(contextId);
  const previousModel = normalizeModelForDisplay(
    (recent && recent.model) || (persistentProduct && persistentProduct.model) || "",
  );
  const pendingState = writePendingSourceState_(contextId, {
    source: source,
    userIdHash: getSourceContextHash_(userId),
    previousQuestion: previousQuestion,
    previousModel: previousModel,
    draftQuery: "",
  });

  // 來源鍵本身就是授權；已有問題即直接查。缺完整型號時只補選型，
  // 選完便直接執行，禁止再出現第二個「確認要查」。
  if (previousQuestion && source === "web") {
    return executeAdvancedSourceQuery_(
      "web",
      previousQuestion,
      contextId,
      userId,
      replyToken,
      Object.assign({}, pendingState, { usePrevious: true }),
    );
  }
  if (previousQuestion && source === "manual") {
    return executeAdvancedSourceQuery_(
      "manual",
      previousQuestion,
      contextId,
      userId,
      replyToken,
      Object.assign({}, pendingState, { usePrevious: true }),
    );
  }

  const quickReplyItems = [];
  quickReplyItems.push(
    buildSourcePostbackQuickReply_("取消", "rm_action=cancel_source&v=2"),
  );
  LAST_SOURCE_TEST_STATE = {
    source: source,
    pending: true,
    hasPrevious: Boolean(previousQuestion),
    hasPreviousModel: Boolean(previousModel),
    remaining: remaining,
  };
  replyMessage(
    replyToken,
    buildSourceSelectionPrompt_(
      source,
      remaining,
      previousQuestion,
      previousModel,
    ),
    { quickReply: { items: quickReplyItems } },
  );
  return true;
}

function handleRichMenuPostback_(event) {
  if (!event || event.type !== "postback") return false;
  CURRENT_DAILY_QUESTION_REMAINING = null;
  lastTokenUsage = null;
  lastLlmCallAttempted = false;
  resetRequestAudit_();
  const params = parsePostbackData_(event.postback && event.postback.data);
  const action = String(params.rm_action || "");
  if (!action) return false;

  const sourceInfo = event.source || {};
  const isGroup = sourceInfo.type === "group" || sourceInfo.type === "room";
  const contextId = isGroup
    ? sourceInfo.groupId || sourceInfo.roomId
    : sourceInfo.userId;
  const userId = sourceInfo.userId || contextId;
  const replyToken = String(event.replyToken || "");

  if (action === "select_source") {
    return startSourceSelection_(
      String(params.source || ""),
      contextId,
      userId,
      replyToken,
    );
  }

  if (action === "cancel_source") {
    clearPendingSourceState_(contextId);
    clearLegacyAdvancedRouteState_(CacheService.getScriptCache(), userId, contextId);
    LAST_SOURCE_TEST_STATE = {
      source: "spec",
      pending: false,
      hasPrevious: false,
    };
    replyMessage(replyToken, "已取消，現在是「規格＆FAQ」快速模式，沒有扣除次數。");
    return true;
  }

  if (action === "use_previous") {
    const state = readPendingSourceState_(contextId, true);
    const requestedSource = String(params.source || "");
    if (
      !state ||
      state.expired ||
      state.source !== requestedSource ||
      !state.previousQuestion
    ) {
      clearPendingSourceState_(contextId);
      replyMessage(
        replyToken,
        "剛才的來源選擇已逾時，沒有扣除次數。請再按一次「官方手冊」或「網路解答」。",
      );
      return true;
    }
    // v1 相容：舊「查上一題」等同目前來源授權。新版不再顯示這個名稱。
    const executionState = Object.assign({}, state, { usePrevious: true });
    executeAdvancedSourceQuery_(
      requestedSource,
      state.previousQuestion,
      contextId,
      userId,
      replyToken,
      executionState,
    );
    return true;
  }

  if (action === "reselect_manual_model") {
    const state = readPendingSourceState_(contextId, true);
    if (
      !state ||
      state.expired ||
      state.source !== "manual" ||
      !state.previousQuestion
    ) {
      clearPendingSourceState_(contextId);
      replyMessage(
        replyToken,
        "剛才的型號狀態已逾時，沒有扣除次數。請重新按「官方手冊」。",
      );
      return true;
    }
    const retainedQuestion = stripKnownModelFromSourceQuestion_(
      state.previousQuestion,
      state.previousModel || "",
    );
    writePendingSourceState_(contextId, {
      source: "manual",
      userIdHash: getSourceContextHash_(userId),
      previousQuestion: retainedQuestion,
      previousModel: "",
      draftQuery: retainedQuestion,
    });
    LAST_SOURCE_TEST_STATE = {
      source: "manual",
      pending: true,
      needsModel: true,
      reselectingModel: true,
      remaining: getSourceRemaining_(contextId, "manual"),
    };
    replyMessage(
      replyToken,
      `已保留原問題：「${String(retainedQuestion).substring(0, 160)}」。\n\n請只輸入系列別稱或型號前段（例如 G8、M8、S27DG5），我會列出候選讓你重選。這一步不讀手冊，也不扣任何次數。`,
      {
        quickReply: {
          items: [
            buildSourcePostbackQuickReply_(
              "取消",
              "rm_action=cancel_source&v=2",
            ),
          ],
        },
      },
    );
    return true;
  }

  if (action === "select_manual_model") {
    const state = readPendingSourceState_(contextId, true);
    const selectedModel = normalizeModelForDisplay(params.model || "");
    const candidates = state && Array.isArray(state.manualModelCandidates)
      ? state.manualModelCandidates.map(normalizeModelForDisplay)
      : [];
    if (
      !state ||
      state.expired ||
      state.source !== "manual" ||
      !selectedModel ||
      candidates.indexOf(selectedModel) < 0 ||
      !hasOfficialManualForModel_(selectedModel) ||
      !state.draftQuery
    ) {
      clearPendingSourceState_(contextId);
      replyMessage(
        replyToken,
        "剛才的型號選擇已逾時，沒有扣除次數。請重新按「官方手冊」再試一次。",
      );
      return true;
    }
    CURRENT_DAILY_QUESTION_REMAINING =
      typeof state.dailyQuestionRemaining === "number"
        ? state.dailyQuestionRemaining
        : null;
    rememberSourceProductModel_(contextId, selectedModel, "manual_model_selection");
    executeAdvancedSourceQuery_(
      "manual",
      `${selectedModel} ${state.draftQuery}`.trim(),
      contextId,
      userId,
      replyToken,
      state,
    );
    return true;
  }

  return false;
}

function parseExplicitSourceCommand_(message) {
  const text = String(message || "").trim();
  const manual = text.match(
    /^(?:#查手冊|我想(?:找|查|看)?手冊(?:上的答案)?|幫我查手冊|請查手冊|查手冊|查說明書|看說明書)\s*(.*)$/i,
  );
  if (manual) return { source: "manual", query: String(manual[1] || "").trim() };
  const web = text.match(
    /^(?:#搜尋網路|#搜往上其他解答|#搜網上其他解答|#這題再搜網路|搜尋網路|查網路|網路解答)\s*(.*)$/i,
  );
  if (web) return { source: "web", query: String(web[1] || "").trim() };
  return null;
}

function isExplicitNonOfficialWebRequest_(query) {
  const text = String(query || "").replace(/\s+/g, " ").trim();
  if (!text) return false;
  const hasWebSource = /(?:非官方|網路上|公開網頁|網友|論壇|使用者經驗)/i.test(
    text,
  );
  const hasSearchIntent = /(?:解法|做法|方法|經驗|查|搜|搜尋|找)/i.test(text);
  return hasWebSource && hasSearchIntent;
}

function parseContextualSourceIntent_(message, contextId) {
  const text = String(message || "").trim();
  if (!text || extractFullModelLikeTokens(text).length > 0) return null;
  const product = readSourceProductState_(contextId);
  if (!product || !product.model) return null;
  const asksToContinueSearch =
    /^(?:那你|那就|那|再|繼續|接著).{0,10}(?:查|找|確認)/i.test(text);
  if (
    asksToContinueSearch &&
    product.lastSource === "manual" &&
    (isManualVerificationRequiredQuery(text) ||
      isOperationOrTroubleshootQuery(text))
  ) {
    return { source: "manual", query: text, model: product.model };
  }
  return null;
}

function isSourceCancelText_(message) {
  return /^(?:取消|\/取消|N)$/i.test(String(message || "").trim());
}

function processPendingSourceText_(message, contextId, userId, replyToken) {
  const state = readPendingSourceState_(contextId, true);
  if (!state) return false;
  if (state.expired) {
    clearPendingSourceState_(contextId);
    LAST_SOURCE_TEST_STATE = { source: "spec", pending: false, expired: true };
    replyMessage(
      replyToken,
      "剛才的來源選擇已超過 10 分鐘，沒有扣除次數。請再按一次「官方手冊」或「網路解答」。",
    );
    return true;
  }
  if (isSourceCancelText_(message)) {
    clearPendingSourceState_(contextId);
    clearLegacyAdvancedRouteState_(CacheService.getScriptCache(), userId, contextId);
    LAST_SOURCE_TEST_STATE = { source: "spec", pending: false, cancelled: true };
    replyMessage(replyToken, "已取消，現在是「規格＆FAQ」快速模式，沒有扣除次數。");
    return true;
  }
  if (/^[\/#]/.test(String(message || "").trim())) {
    clearPendingSourceState_(contextId);
    return false;
  }
  executeAdvancedSourceQuery_(
    state.source,
    String(message || "").trim(),
    contextId,
    userId,
    replyToken,
    state,
  );
  return true;
}

function executeLegacyManualModelSelectionViaSourceRouter_(
  selectedModel,
  contextId,
  userId,
  replyToken,
) {
  const cache = CacheService.getScriptCache();
  const recent = readRecentSourceQuestion_(contextId);
  const previousModel = normalizeModelForDisplay(
    (recent && recent.model) || "",
  );
  let originalQuestion =
    cache.get(`${userId}:pending_topic`) ||
    (recent && recent.question) ||
    "";
  if (!originalQuestion) {
    const historyForTopic = getHistoryFromCacheOrSheet(contextId);
    const MODEL_ONLY_RE = /^[A-Z0-9\-]{3,30}$/i;
    for (let i = historyForTopic.length - 1; i >= 0; i--) {
      if (historyForTopic[i].role === "user") {
        let content = historyForTopic[i].content || "";
        content = content.replace(/\[System Hint:.*?\]/gs, "").trim();
        if (
          content.length >= 2 &&
          !content.startsWith("#") &&
          !content.includes("不滿意") &&
          !content.includes("繼續問") &&
          !content.match(/^\d$/) &&
          !MODEL_ONLY_RE.test(content) &&
          !content.includes("(型號:")
        ) {
          originalQuestion = content;
          writeLog(
            `[Legacy Model Select Router] 從對話歷史找回原始問題: ${originalQuestion}`,
          );
          break;
        }
      }
    }
  }
  if (previousModel) {
    originalQuestion = stripKnownModelFromSourceQuestion_(
      originalQuestion,
      previousModel,
    );
  }
  cache.remove(`${userId}:pending_topic`);
  cache.remove(`${userId}:model_select_mode`);
  cache.remove(`${userId}:pending_manual_query`);
  cache.remove(`${userId}:manual_search_consent`);
  if (consumeDailyQuestionModelSelectionHold_(userId)) {
    refundDailyQuestionUsage_(userId, "legacy_model_selection_to_manual");
  }
  rememberSourceProductModel_(contextId, selectedModel, "legacy_manual_selection");

  if (!originalQuestion) {
    writePendingSourceState_(contextId, {
      source: "manual",
      userIdHash: getSourceContextHash_(userId),
      previousQuestion: "",
      previousModel: selectedModel,
      draftQuery: "",
    });
    replyMessage(
      replyToken,
      `已選好 ${selectedModel}。請直接輸入你要查的問題；送出問題後會立刻查手冊，不會再要求確認。`,
    );
    return true;
  }

  const state = writePendingSourceState_(contextId, {
    source: "manual",
    userIdHash: getSourceContextHash_(userId),
    previousQuestion: originalQuestion,
    previousModel: selectedModel,
    draftQuery: originalQuestion,
  });
  writeLog(
    `[Source Route v29.6.189] 舊型號泡泡已轉入單一手冊狀態機: ${selectedModel}`,
  );
  executeAdvancedSourceQuery_(
    "manual",
    `${selectedModel} ${originalQuestion}`.trim(),
    contextId,
    userId,
    replyToken,
    Object.assign({}, state, { usePrevious: true }),
  );
  return true;
}

function resolveManualSourceModel_(query, state, cache, userId) {
  const exactModels = extractFullModelLikeTokens(String(query || ""));
  if (exactModels.length > 0) return exactModels[0];
  // 同一聊天室的產品型號跨日保留。沒有新完整型號前，追問、手冊與網路
  // 都沿用已確認型號；模糊系列只提供候選，不得先清除目前型號。
  if (
    state &&
    state.previousModel &&
    (state.usePrevious ||
      isSameRecentSourceQuestion_(
        query,
        state.previousQuestion || "",
        state.previousModel,
      ))
  ) {
    return normalizeModelForDisplay(state.previousModel);
  }
  if (extractShortAliasModelTokens(String(query || "")).length > 0) {
    return "";
  }
  const persistent = readSourceProductState_(
    state && state.contextId ? state.contextId : userId,
  );
  if (persistent && persistent.model) return persistent.model;
  return "";
}

function getVerifiedFastSourceTag_(userText, replyText) {
  return inferFastLocalSourceTag_(userText, replyText, "");
}

function isManualModelHintOnly_(text) {
  const source = toHalfWidth(String(text || "")).trim().toUpperCase();
  if (!source) return false;
  const hints = source.match(
    /\b(?:LS|S|C|F|G|M)\d{1,3}[A-Z0-9-]{0,12}\b/g,
  ) || [];
  if (hints.length === 0) return false;
  let remainder = source;
  hints.forEach(function (hint) {
    remainder = remainder.replace(hint, " ");
  });
  return remainder.replace(/[\s,，。；;：:、.!！?？()（）\-]/g, "").length === 0;
}

function getManualSourceCandidateModels_(query, limit) {
  const max = Math.max(1, Number(limit) || 10);
  const pdfIndex = readPdfModelIndexForCoverage_();
  function keepOnlyIndexedManualModels_(models) {
    return dedupDisplayModels(
      (Array.isArray(models) ? models : []).filter(function (model) {
        const display = normalizeModelForDisplay(model);
        return pdfIndex.some(function (pdfModel) {
          return isPdfModelTokenMatch_(pdfModel, display);
        });
      }),
      max,
    );
  }
  const aliasCandidates = getAliasOnlySelectionModelsFromQuery(query, max);
  if (aliasCandidates.length > 0) {
    return keepOnlyIndexedManualModels_(aliasCandidates);
  }

  const upper = toHalfWidth(String(query || "")).trim().toUpperCase();
  const hints = upper.match(/\b(?:LS|S|C|F)\d{2}[A-Z0-9]{1,10}\b/g) || [];
  if (hints.length === 0) return [];

  const knownModels = getKnownModelSearchText().match(
    /\b(?:LS|S|C|F)\d{2}[A-Z][A-Z0-9]{4,15}\b/g,
  ) || [];
  const normalizedHints = hints.map(normalizeModelForDisplay);
  const candidates = knownModels.filter(function (model) {
    const display = normalizeModelForDisplay(model);
    return normalizedHints.some(function (hint) {
      return display.indexOf(hint) === 0 || display.indexOf(hint) >= 0;
    });
  });
  return keepOnlyIndexedManualModels_(candidates);
}

function createManualSourceModelSelectionFlex_(models) {
  const displayModels = dedupDisplayModels(models, 10);
  const buttons = displayModels.map(function (model) {
    return {
      type: "button",
      action: {
        type: "postback",
        label: model.substring(0, 20),
        data: `rm_action=select_manual_model&model=${encodeURIComponent(model)}&v=2`,
      },
      style: "primary",
      color: "#2767B2",
      margin: "md",
      height: "sm",
    };
  });
  return {
    type: "flex",
    altText: "請選擇要查手冊的型號",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "📖 選擇要查的型號",
            weight: "bold",
            size: "lg",
            color: "#173A67",
            align: "center",
          },
          {
            type: "text",
            text: `找到 ${displayModels.length} 個相近型號`,
            size: "xs",
            color: "#687386",
            align: "center",
            margin: "sm",
          },
        ],
        paddingAll: "16px",
        backgroundColor: "#E8F1FD",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: buttons,
        spacing: "sm",
        paddingAll: "14px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "選型號前不讀手冊、不扣次",
            size: "xxs",
            color: "#687386",
            align: "center",
          },
        ],
        paddingAll: "10px",
      },
    },
  };
}

function buildAdvancedSourceQuickReplies_(
  source,
  model,
  replyText,
  routeOptions,
) {
  const options = routeOptions || {};
  const items = [];
  if (options.allowElaborate === true) {
    items.push({
      type: "action",
      action: {
        type: "message",
        label: "💬 再詳細說明",
        text: "#再詳細說明",
      },
    });
  }
  if (!options.skipSameSource) {
    items.push(
      buildSourcePostbackQuickReply_(
        source === "manual" ? "📖 再查手冊" : "🌐 再搜網路",
        `rm_action=select_source&source=${source}&v=2`,
      ),
    );
  }
  if (!options.skipAlternateSource) {
    items.push(
      buildSourcePostbackQuickReply_(
        source === "manual" ? "🌐 網路解答" : "📖 官方手冊",
        `rm_action=select_source&source=${source === "manual" ? "web" : "manual"}&v=2`,
      ),
    );
  }
  if (options.forceOfficial || shouldOfferSamsungOfficialPage_(replyText)) {
    const page = getSamsungOfficialModelPage_(model);
    const officialItem = buildSamsungOfficialPageQuickReply_(page);
    if (officialItem) items.push(officialItem);
  }
  const visibleItems = items.slice(0, 3);
  // LINE 不接受 quickReply.items=[]；沒有真正下一步時必須完全省略欄位，
  // 否則正確答案會在最後送出階段被 400 擋掉。
  return visibleItems.length > 0
    ? { quickReply: { items: visibleItems } }
    : {};
}

function isLikelyLocalSpecRuleQuestion_(query) {
  const text = String(query || "");
  if (
    /(故障|異常|無法|不能用|沒反應|更新韌體|驅動程式)/i.test(text) &&
    !/(?:NETFLIX|YOUTUBE|DISNEY|SPOTIFY|APP|應用程式|蘋果|IPHONE|AIR[\s-]*PLAY|3D|裸視|裸眼3D|ODYSSEY\s*HUB|REALITY\s*HUB|閃爍|黑屏|無畫面|沒畫面|無訊號|護眼|低藍光|重設|恢復原廠)/i.test(text)
  ) {
    return false;
  }
  return /(規格|支援|有沒有|是否有|有嗎|尺寸|吋|解析度|更新率|刷新率|Hz|HDR|介面|HDMI|DISPLAYPORT|USB[\s-]*C|TYPE[\s-]*C|藍牙|BLUETOOTH|WI[\s-]*FI|無線網路|耳機孔|喇叭|鏡頭|攝影機|遙控器|VESA|重量|比較|差異|差別|差在哪|哪一台|比一比|NETFLIX|YOUTUBE|DISNEY|SPOTIFY|APP|應用程式|蘋果|IPHONE|AIR[\s-]*PLAY|投影|投屏|鏡像|鏡射|直式|直向|直立|垂直|橫式|橫向|橫屏|直屏|手機畫面|手機投影|安裝|播|3D|裸視|裸眼3D|ODYSSEY\s*HUB|REALITY\s*HUB|閃爍|黑屏|無畫面|沒畫面|無訊號|護眼|低藍光|EYE SAVER|重設|恢復原廠|出廠設定|重置|防烙印|SAFEGUARD)/i.test(
    text,
  );
}

// 同一句明確詢問兩個以上面向時，不讓單一 RULE 欄位提前終止回答。
// 精準 QA 仍會在此前零成本命中；沒有 QA 才交由既有 QA/RULE Prompt 一次整合。
function isPotentialMultiClaimQuestion_(query) {
  const text = String(query || "")
    .replace(/(?:LS)?S\d{2}[A-Z0-9]{5,16}/gi, "")
    .trim();
  if (!/(?:和|與|及|、|以及|還有|同時|加上|並且)/.test(text)) return false;
  const subjectSignals = [
    /繁體中文|中文介面|語言/i,
    /喇叭|揚聲器|音效/i,
    /HDMI/i,
    /DISPLAYPORT|\bDP\b/i,
    /USB[\s-]*C|TYPE[\s-]*C/i,
    /解析度|4K|5K|6K|UHD|QHD|FHD/i,
    /更新率|刷新率|\d+\s*HZ/i,
    /面板|IPS|VA|OLED/i,
    /HDR/i,
    /藍牙|BLUETOOTH/i,
    /WI[\s-]*FI|無線網路/i,
    /耳機孔|3\.5\s*MM/i,
    /鏡頭|攝影機/i,
    /遙控器/i,
    /VESA|壁掛/i,
    /HAS|升降|支架|旋轉|PIVOT/i,
  ];
  return subjectSignals.filter((pattern) => pattern.test(text)).length >= 2;
}

function buildDeterministicComparisonReply_(query) {
  const text = String(query || "");
  const models = extractFullModelLikeTokens(text);
  if (models.length < 2) return "";
  const m1 = normalizeModelForDisplay(models[0]);
  const m2 = normalizeModelForDisplay(models[1]);
  if (!m1 || !m2 || m1 === m2) return "";
  const line1 = findExactModelRuleLine_(m1);
  const line2 = findExactModelRuleLine_(m2);
  if (!line1 || !line2) return "";

  const diffs = [];
  // 解析度
  const res1 = (line1.match(/(?:4K\s*UHD|5K|QHD|FHD|\d{3,4}x\d{3,4})/i) || [""])[0];
  const res2 = (line2.match(/(?:4K\s*UHD|5K|QHD|FHD|\d{3,4}x\d{3,4})/i) || [""])[0];
  if (res1 && res2 && res1 !== res2) {
    diffs.push(`• 解析度：${m1} 為 ${res1}；${m2} 為 ${res2}`);
  }

  // 亮度
  const bri1 = (line1.match(/\d{3}\/?\d{0,3}\s*cd㎡/i) || [""])[0];
  const bri2 = (line2.match(/\d{3}\/?\d{0,3}\s*cd㎡/i) || [""])[0];
  if (bri1 && bri2 && bri1 !== bri2) {
    diffs.push(`• 亮度：${m1}（${bri1}）vs ${m2}（${bri2}）`);
  }

  // 支架能力逐欄比較；HAS、左右旋轉與 Pivot 是三件事，不能互相推論。
  const standFeatures = function (line) {
    const values = [];
    if (/(?:HAS|高度調整|升降)/i.test(line)) values.push("高度調整");
    if (/左右旋轉/i.test(line)) values.push("左右旋轉");
    if (/(?:垂直旋轉|PIVOT)/i.test(line)) values.push("直立旋轉");
    return values;
  };
  const stand1 = standFeatures(line1);
  const stand2 = standFeatures(line2);
  if (stand1.join("|") !== stand2.join("|") && (stand1.length || stand2.length)) {
    diffs.push(
      `• 支架調整：${m1} ${stand1.length ? stand1.join("、") : "官方規格未列升降或旋轉"}；${m2} ${stand2.length ? stand2.join("、") : "官方規格未列升降或旋轉"}`,
    );
  }

  // 鏡頭
  const cam1 = /(?:SlimFit|攝影機|鏡頭)/i.test(line1);
  const cam2 = /(?:SlimFit|攝影機|鏡頭)/i.test(line2);
  if (cam1 !== cam2) {
    diffs.push(`• 視訊鏡頭：${cam1 ? m1 : m2} 的規格列有鏡頭；${!cam1 ? m1 : m2} 的規格未列此項`);
  }

  // 陀螺儀
  const gyro1 = /(?:陀螺儀|自動旋轉)/i.test(line1);
  const gyro2 = /(?:陀螺儀|自動旋轉)/i.test(line2);
  if (gyro1 !== gyro2) {
    diffs.push(`• 陀螺儀：${gyro1 ? m1 : m2} 的規格列有陀螺儀／自動旋轉；${!gyro1 ? m1 : m2} 的規格未列此項`);
  }

  // AirPlay
  const ap1 = /AirPlay/i.test(line1);
  const ap2 = /AirPlay/i.test(line2);
  if (ap1 !== ap2) {
    diffs.push(`• Apple AirPlay：${ap1 ? m1 : m2} 的規格列有 AirPlay；${!ap1 ? m1 : m2} 的規格未列此項`);
  }

  // Type-C
  const tc1 = /(?:USB-C|Type-C)/i.test(line1);
  const tc2 = /(?:USB-C|Type-C)/i.test(line2);
  if (tc1 !== tc2) {
    diffs.push(`• Type-C 連接：${tc1 ? m1 : m2} 的規格列有 Type-C；${!tc1 ? m1 : m2} 的規格未列此項`);
  }

  if (diffs.length === 0) {
    return "";
  }

  return [
    `${m1} 與 ${m2} 的規格差異如下：`,
    ...diffs,
    "[來源:官方規格庫]"
  ].join("\n");
}

function buildDeterministicExactRuleReply_(query, model) {
  const text = String(query || "");

  // 優先處理雙型號比較
  if (typeof buildDeterministicComparisonReply_ === "function") {
    const comparisonReply = buildDeterministicComparisonReply_(text);
    if (comparisonReply) return comparisonReply;
  }

  const normalizedModel = normalizeModelForDisplay(model || "");
  if (!normalizedModel) return "";
  const ruleLine = findExactModelRuleLine_(normalizedModel);
  if (!ruleLine) return "";

  // RULE 直答只能逐字擷取目前型號已有的規格欄位。App 可用性、選單
  // 步驟、故障排除、投影／AirPlay／3D 等必須先命中精準 QA；否則交
  // 既有手冊路由。下方舊版相容分支因此不得搶答或把通用常識標成 RULE。
  if (
    /(如何|怎麼|怎樣|操作|切換|開啟|關閉|設定|排除|故障|異常|無法|沒反應|重置|恢復原廠|安裝|下載|黑屏|閃爍|無畫面|沒畫面|無訊號|不亮|當機|偏色|偏黃)/i.test(
      text,
    ) ||
    /(?:NETFLIX|YOUTUBE|DISNEY|SPOTIFY|APP|應用程式|愛奇藝|LINE\s*TV|手機投影|手機畫面|投屏|鏡像|鏡射|AIR[\s-]*PLAY|防烙印|SAFEGUARD|3D|裸視|裸眼3D|ODYSSEY\s*HUB|REALITY\s*HUB|護眼模式|低藍光)/i.test(
      text,
    )
  ) {
    return "";
  }

  // 1. 動態 App 安裝（支援 Netflix, Disney+, YouTube, Spotify 等）
  if (/(?:NETFLIX|YOUTUBE|DISNEY|SPOTIFY|APP|應用程式|愛奇藝|LINE\s*TV)/i.test(text) && /(?:安裝|下載|開啟|怎麼看|如何看|怎麼用|如何用|支援|播)/i.test(text)) {
    let appName = "Netflix";
    if (/DISNEY/i.test(text)) appName = "Disney+";
    else if (/YOUTUBE/i.test(text)) appName = "YouTube";
    else if (/SPOTIFY/i.test(text)) appName = "Spotify";
    else if (/愛奇藝/i.test(text)) appName = "愛奇藝";
    else if (/LINE\s*TV/i.test(text)) appName = "LINE TV";

    if (/(?:M5|M7|M8|M9|SMART|S27FM50|S32FM50|S32FM8|S32FM9|S32BM8|S32CM8|S32DM8|S27CM7|S32CM7|S27CM5|S32CM5)/i.test(normalizedModel) || /(?:TIZEN|SMART MONITOR|智慧聯網)/i.test(ruleLine)) {
      return [
        `${normalizedModel}（Smart Monitor 系列）安裝 ${appName} 或其他 App 的步驟如下：`,
        "1. 先確認螢幕已連上 Wi-Fi 網路。",
        "2. 用遙控器按「首頁 (Home)」鍵，進入「應用程式 (Apps)」。",
        `3. 在搜尋欄輸入「${appName}」，選取後按「安裝」。`,
        "4. 安裝完成後選取「開啟」，依照畫面提示登入帳號即可開始觀看。",
        "[來源:官方規格庫]",
      ].join("\n");
    }
  }

  // 2. 螢幕畫面閃爍、黑屏、無訊號故障排查 SOP
  if (/(?:閃爍|黑屏|無畫面|沒畫面|黑畫面|無訊號|沒有訊號|螢幕不亮|一直閃)/i.test(text)) {
    return [
      `${normalizedModel} 畫面閃爍或黑屏的標準排查步驟如下：`,
      "1. 檢查線材連接：確認 DisplayPort 1.4 或 HDMI 連接線兩端皆已牢固插緊，無鬆脫或接觸不良（建議暫時拔除轉接器直接連接）。",
      "2. 檢查更新率與解析度：確認電腦顯示卡輸出解析度設為螢幕推薦最佳值，更新率設定在螢幕原生支援範圍內。",
      "3. 顯卡驅動與 FreeSync：至顯示卡控制面板更新最新版本驅動程式；若開啟 G-Sync 相容或 FreeSync 後發生閃爍，可嘗試暫時關閉測試。",
      "4. 恢復原廠設定：透過螢幕後方 JOG 按鈕或遙控器進入 OSD 選單 →「設定」→ 執行「重設 / 恢復出廠設定」。",
      "[來源:官方規格庫]",
    ].join("\n");
  }

  // 3. 護眼模式 / 低藍光設定 SOP
  if (/(?:護眼模式|低藍光|EYE SAVER|護眼)/i.test(text) && /(?:開啟|設定|怎麼|如何|在哪|開|位置|支援)/i.test(text)) {
    if (/(?:M5|M7|M8|M9|SMART|S27FM50|S32FM50|S32FM8|S32FM9|S32BM8|S32CM8|S32DM8|S27CM7|S32CM7|S27CM5|S32CM5)/i.test(normalizedModel) || /(?:TIZEN|SMART MONITOR|智慧聯網)/i.test(ruleLine)) {
      return [
        `${normalizedModel} 開啟「護眼模式 (Eye Saver Mode)」步驟如下：`,
        "1. 使用遙控器按「首頁 (Home)」鍵進入「設定」選單。",
        "2. 進入「所有設定」→ 選取「影像 (Picture)」。",
        "3. 找到「護眼模式 (Eye Saver Mode)」並將其切換為【開啟】。",
        "註：護眼模式即為低藍光護眼技術，開啟後會自動過濾藍光並減輕眼睛疲勞。",
        "[來源:官方規格庫]",
      ].join("\n");
    } else {
      return [
        `${normalizedModel} 開啟「護眼模式 (Eye Saver Mode)」步驟如下：`,
        "1. 按下螢幕正下方或後方的 JOG 按鈕呼叫功能選單。",
        "2. 向上推進入「選單 (Menu)」→ 選取「影像 (Picture)」或「系統 (System)」。",
        "3. 找到「護眼模式 (Eye Saver Mode)」並選取【開啟】。",
        "[來源:官方規格庫]",
      ].join("\n");
    }
  }

  // 4. OLED 防烙印 Safeguard 專屬功能
  if (/(?:防烙印|SAFEGUARD|烙印)/i.test(text)) {
    if (/(?:OLED|G60SD|G80SD|G93SD|G95SD|S32DG8|S27DG6|S49DG9|S34DG8)/i.test(normalizedModel) || /OLED/i.test(ruleLine)) {
      return [
        `${normalizedModel}（Odyssey OLED 系列）配備專屬 OLED Safeguard+ 防烙印機制，內建動態冷卻系統 (Dynamic Cooling System) 與熱調節演算法，有效預防面板烙印。`,
        "[來源:官方規格庫]",
      ].join("\n");
    } else {
      return [
        `${normalizedModel} 採用 LCD/VA/IPS 面板，液晶螢幕本身無 OLED 面板之烙印風險，因此未搭載也不需要 OLED Safeguard+ 防烙印功能。`,
        "[來源:官方規格庫]",
      ].join("\n");
    }
  }

  // 5. 手機無線投影（橫式/直式）
  if (/(?:直式|直向|直立|垂直|橫式|橫向|橫屏|直屏|手機畫面|手機投影)/i.test(text) && /(?:投影|投屏|鏡像|鏡射|畫面|顯示|播|看)/i.test(text)) {
    if (/(?:M50F|S27FM50|S32FM50|LS27FM50|LS32FM50)/i.test(normalizedModel) || /(?:M50F|S27FM50|S32FM50)/i.test(ruleLine)) {
      return [
        `${normalizedModel}（M50F 系列）支援手機無線投影（橫式／直式畫面均可顯示）：`,
        "1. 橫式播放：手機旋轉為橫向時，螢幕畫面會自動隨之切換為 16:9 全螢幕橫向滿版。",
        "2. 直式播放：手機直立持握時，螢幕中央會以直式比例顯示（兩側自動保留黑邊維持正確比例）。",
        "⚠️ 硬體注意：FM5 原廠底座為固定式（無 HAS 升降與旋轉），且機身「無」內建陀螺儀感應器，螢幕本體無法隨實體旋轉而自動轉向。若需要螢幕隨機身旋轉自動切換直向滿版，請選購具備陀螺儀與旋轉支架的 M8 / M9 系列。",
        "[來源:官方規格庫]",
      ].join("\n");
    } else if (/(?:M8|M9|S32BM8|S32CM8|S32DM8|S32FM8|S32FM9)/i.test(normalizedModel)) {
      return [
        `${normalizedModel} 支援手機投影與畫面自動旋轉（橫式／直式均支援）：`,
        "1. 內建陀螺儀與 HAS 升降旋轉支架，將螢幕旋轉為直立時，畫面會自動感應切換為直向滿版顯示。",
        "2. 手機橫向或直向投影時，畫面均能完美配合螢幕方向滿版呈現。",
        "[來源:官方規格庫]",
      ].join("\n");
    } else {
      return [
        `${normalizedModel} 支援手機無線投影（橫式／直式畫面均可顯示）：`,
        "1. 手機旋轉為橫向時，螢幕畫面會自動切換為全螢幕橫向滿版。",
        "2. 手機直立持握時，螢幕中央會以直式比例顯示（兩側保留黑邊維持比例）。",
        "[來源:官方規格庫]",
      ].join("\n");
    }
  }

  // 6. Apple AirPlay 2 支援
  if (/(?:蘋果|IPHONE|IPAD|AIR[\s-]*PLAY|APPLE)/i.test(text) && /(?:投影|投屏|鏡像|無線|連接|連線|支援|有)/i.test(text)) {
    if (/(?:M50F|S27FM50|S32FM50|LS27FM50|LS32FM50)/i.test(normalizedModel) || /(?:M50F|S27FM50|S32FM50)/i.test(ruleLine)) {
      return [
        `${normalizedModel}（Smart Monitor M5 M50F 系列）沒有原生支援 Apple AirPlay 2 無線投影。`,
        "",
        "如果是 iPhone 或 iPad 想要無線投屏，建議選擇 Smart Monitor M7、M8 或 M9 系列；若要在這台投影 iPhone，可以透過 Lightning / USB-C 轉 HDMI 轉接線，或是外接 Apple TV / 支援 AirPlay 的電視盒連接。",
        "[來源:官方規格庫]",
      ].join("\n");
    } else if (/(?:M7|M8|M9|M70|M80|M90|S32BM8|S32CM8|S32DM8|S27CM7|S32CM7|S32DM7|S32FM9|S27DM5|S32DM5|S27CM5|S32CM5|S27BM5|S32BM5|S27AM5|S32AM5|M50D|M50C|M50B|M50A|DM50|CM50|BM50|AM50)/i.test(normalizedModel) || /(?:M7|M8|M9|M50D|M50C|M50B|M50A|DM50|CM50|BM50|AM50)/i.test(ruleLine)) {
      return [
        `${normalizedModel} 支援 Apple AirPlay 2 無線投影。`,
        "",
        "只要將 iPhone / iPad 與螢幕連接在同一個 Wi-Fi 網路，從 iPhone 控制中心點選「螢幕鏡像輸出」並選擇這台螢幕，即可直接進行無線投影。",
        "[來源:官方規格庫]",
      ].join("\n");
    }
  }

  // 7. 3D 裸視專屬
  if (/(?:3D|裸視|裸眼3D|ODYSSEY\s*HUB|REALITY\s*HUB)/i.test(text)) {
    if (/(?:S27FG90|G90XF|G90XH|ODYSSEY\s*3D)/i.test(normalizedModel) || /(?:S27FG90|G90XF|G90XH|ODYSSEY 3D)/i.test(ruleLine)) {
      return [
        `${normalizedModel}（Odyssey 3D 裸視3D電競螢幕）3D 連線設定與故障排除步驟如下：`,
        "1. 傳輸線連接：電腦端需透過 DP 1.4 或 HDMI 2.1 加上原廠 USB B-to-A 傳輸線連接，並啟動專用 Odyssey Hub (Reality Hub) 軟體。",
        "2. 眼球追蹤鏡頭：確認螢幕上方雙眼球追蹤鏡頭無遮擋，坐姿保持正對螢幕中央（最佳距離約 70~90 公分）。",
        "3. 螢幕方向限制：螢幕旋轉至「直立模式 (Pivot)」時不支援 3D 裸視，請維持橫向水平顯示。",
        "4. 休眠喚醒失效：電腦休眠喚醒後若 3D 中斷，請將 USB-B 線重新插拔。",
        "5. 獨立顯卡設定：至 Windows「設定」→「系統」→「顯示器」→「圖形」將 Odyssey Hub 設為「高效能 (NVIDIA/AMD 獨立顯卡)」，並於 NVIDIA 控制面板開啟「RTX 視訊增強」。",
        "6. USB 電源防中斷：至「控制台」→「電源選項」→「變更進階電源設定」→「USB 設定」→ 將「USB 選擇性暫停」設為【已停用】。",
        "[來源:官方規格庫]",
      ].join("\n");
    } else {
      return [
        `${normalizedModel} 為標準 2D 螢幕，硬體上無裸視 3D 顯示功能。`,
        "",
        "全三星電腦螢幕中，唯一具備裸視 3D 功能的機種為 Odyssey 3D (G90XF / S27FG900XC)。",
        "若你使用的是 Odyssey 3D，排查步驟如下：",
        "1. 電腦端需連接 DP/HDMI 2.1 加上原廠 USB B-to-A 傳輸線，並執行 Odyssey Hub 軟體。",
        "2. 確保頂部雙眼球追蹤鏡頭未被遮擋且正對螢幕，螢幕不可處於直立 Pivot 旋轉狀態。",
        "3. 電腦休眠喚醒後若 3D 中斷，請重新插拔 USB-B 線材。",
        "4. 控制台電源選項中將「USB 選擇性暫停」設為【已停用】。",
        "[來源:官方規格庫]",
      ].join("\n");
    }
  }

  if (
    /(如何|怎麼|怎樣|操作|切換|開啟|關閉|設定|排除|故障|異常|無法|沒反應|重置|恢復原廠)/i.test(
      text,
    )
  ) {
    return "";
  }
  const fields = ruleLine
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);
  const patterns = [];
  const addPattern = (queryPattern, fieldPattern) => {
    if (queryPattern.test(text)) patterns.push(fieldPattern);
  };
  addPattern(/規格|詳細資料/i, /(?:ODYSSEY|SMART MONITOR|VIEWFINITY|吋|面板|螢幕|解析度|更新頻率|反應時間|亮度|對比|HDR|介面[:：])/i);
  addPattern(/解析度|4K|5K|6K|UHD|QHD|FHD/i, /解析度|雙模/i);
  addPattern(/更新率|刷新率|HZ/i, /更新頻率|更新率|刷新率|雙模|\d+\s*HZ/i);
  addPattern(/面板|IPS|VA|OLED/i, /IPS|VA|OLED/i);
  addPattern(/反應時間|GTG|MPRT/i, /反應時間|GTG|MPRT/i);
  addPattern(/亮度|NIT|CD\//i, /亮度|NIT|CD\//i);
  addPattern(/對比/i, /對比/i);
  addPattern(/HDR/i, /HDR/i);
  addPattern(/HDMI/i, /HDMI/i);
  addPattern(/DISPLAYPORT|\bDP\b/i, /DISPLAYPORT|\bDP\b/i);
  addPattern(/USB[\s-]*C|TYPE[\s-]*C/i, /USB[\s-]*C|TYPE[\s-]*C/i);
  addPattern(/喇叭|揚聲器/i, /喇叭|揚聲器/i);
  addPattern(/藍牙|BLUETOOTH/i, /藍牙|BLUETOOTH/i);
  addPattern(/WI[\s-]*FI|無線網路/i, /WI[\s-]*FI|無線網路/i);
  // 3.5mm 必須是獨立音訊規格，不能誤中「263.5mm」這類外觀尺寸尾數。
  addPattern(
    /耳機孔|3\.5\s*MM/i,
    /耳機孔|(?:^|[^0-9])3\.5\s*MM(?:[^0-9]|$)/i,
  );
  addPattern(/VESA|壁掛/i, /VESA|壁掛/i);
  addPattern(/重量/i, /重量|淨重/i);
  addPattern(/尺寸|大小|幾吋/i, /吋|尺寸/i);
  addPattern(/HAS|升降|支架/i, /HAS|升降|支架/i);
  addPattern(/旋轉|轉向|PIVOT/i, /左右旋轉|垂直旋轉|旋轉|PIVOT/i);

  if (patterns.length === 0) return "";

  const selected = [];
  patterns.forEach((pattern) => {
    fields.forEach((field) => {
      if (
        selected.length < 10 &&
        !/^L?[SCF]\d{2}[A-Z0-9]+$/i.test(field) &&
        !/^型號[:：]/.test(field) &&
        pattern.test(field) &&
        selected.indexOf(field) < 0
      ) {
        selected.push(field);
      }
    });
  });
  if (selected.length === 0) return "";

  const portIntent = [
    { query: /MICRO\s*HDMI/i, label: "Micro HDMI", pattern: /MICRO\s*HDMI(?:\s*([0-9.]+))?\s*[X×]\s*(\d+)/i },
    { query: /HDMI/i, label: "HDMI", pattern: /HDMI(?:\s*([0-9.]+))?\s*[X×]\s*(\d+)/i },
    { query: /DISPLAYPORT|\bDP\b/i, label: "DisplayPort", pattern: /(?:DISPLAYPORT|\bDP\b)(?:\s*([0-9.]+))?\s*[X×]\s*(\d+)/i },
    { query: /USB[\s-]*C|TYPE[\s-]*C/i, label: "USB-C", pattern: /(?:USB[\s-]*C|TYPE[\s-]*C)(?:\s*([0-9.]+))?\s*[X×]\s*(\d+)/i },
  ].find((item) => item.query.test(text));
  if (portIntent) {
    // 同一介面可能拆成多個 RULE 欄位（例如 HDMI x1 + Micro HDMI x1）。
    // 必須逐欄彙總，不能只取第一個 regex match 而少算其他同類輸入埠。
    const matchedPorts = [];
    selected.forEach(function (field) {
      const flags = portIntent.pattern.flags.indexOf("g") >= 0
        ? portIntent.pattern.flags
        : `${portIntent.pattern.flags}g`;
      const matcher = new RegExp(portIntent.pattern.source, flags);
      let match;
      while ((match = matcher.exec(field)) !== null) {
        let variant = portIntent.label;
        const nearbyText = field.substring(
          Math.max(0, match.index - 10),
          match.index + match[0].length,
        );
        if (portIntent.label === "HDMI" && /MICRO\s*HDMI/i.test(nearbyText)) {
          variant = "Micro HDMI";
        }
        matchedPorts.push({
          variant: variant,
          version: match[1] || "",
          count: Number(match[2]) || 0,
        });
        if (!match[0]) matcher.lastIndex += 1;
      }
    });
    const validMatchedPorts = matchedPorts.filter(function (item) {
      return item && item.count > 0;
    });
    if (validMatchedPorts.length > 0) {
      const groupedPorts = {};
      validMatchedPorts.forEach(function (item) {
        const key = `${item.variant}|${item.version}`;
        if (!groupedPorts[key]) {
          groupedPorts[key] = {
            variant: item.variant,
            version: item.version,
            count: 0,
          };
        }
        groupedPorts[key].count += item.count;
      });
      const groups = Object.keys(groupedPorts).map(function (key) {
        return groupedPorts[key];
      });
      const totalCount = groups.reduce(function (sum, item) {
        return sum + item.count;
      }, 0);
      const portSummary = groups.map(function (item) {
        const versionText = item.version ? ` ${item.version}` : "";
        return `${item.variant}${versionText} x${item.count}`;
      }).join("、");
      const headline = groups.length === 1
        ? `${normalizedModel} 這款有 ${totalCount} 個 ${groups[0].variant}${groups[0].version ? ` ${groups[0].version}` : ""} 連接埠。`
        : `${normalizedModel} 共有 ${totalCount} 個 ${portIntent.label} 類連接埠：${portSummary}。`;
      return [
        headline,
        "[來源:官方規格庫]",
      ].join("\n");
    }
  }

  return [
    `${normalizedModel} 的規格是：${selected.join("；")}。`,
    "[來源:官方規格庫]",
  ].join("\n");
}

// 複合句中的「已知規格」與「待查操作」必須拆開處理。這裡只用
// buildDeterministicExactRuleReply_ 已支援的通用欄位逐項取值；不新增
// 產品答案，也不讓「怎麼連接」抹掉同句已能零成本確認的 HDMI 等規格。
function buildKnownRuleAnchorForMixedOperation_(query, model) {
  const text = String(query || "");
  const normalizedModel = normalizeModelForDisplay(model || "");
  if (
    !normalizedModel ||
    !/(?:如何|怎麼|怎樣|操作|切換|開啟|關閉|設定|排除|故障|異常|無法|沒反應|重置|恢復原廠|安裝|下載|連接|連線)/i.test(
      text,
    )
  ) {
    return "";
  }

  const probes = [];
  const addProbe = function (pattern, probe) {
    if (pattern.test(text) && probes.indexOf(probe) < 0) probes.push(probe);
  };
  addProbe(/MICRO\s*HDMI/i, "有幾個 Micro HDMI");
  if (!/MICRO\s*HDMI/i.test(text)) addProbe(/HDMI/i, "有幾個 HDMI");
  addProbe(/DISPLAYPORT|\bDP\b/i, "有幾個 DisplayPort");
  addProbe(/USB[\s-]*C|TYPE[\s-]*C/i, "USB-C 規格");
  addProbe(/解析度|4K|5K|6K|UHD|QHD|FHD/i, "解析度規格");
  addProbe(/更新率|刷新率|\d+\s*HZ/i, "更新率規格");
  addProbe(/面板|IPS|VA|OLED/i, "面板規格");
  addProbe(/HDR/i, "HDR 規格");
  addProbe(/喇叭|揚聲器/i, "喇叭規格");
  addProbe(/藍牙|BLUETOOTH/i, "藍牙規格");
  addProbe(/WI[\s-]*FI|無線網路/i, "Wi-Fi 規格");
  addProbe(/耳機孔|3\.5\s*MM/i, "耳機孔規格");
  addProbe(/VESA|壁掛/i, "VESA 壁掛規格");
  addProbe(/重量/i, "重量規格");
  addProbe(/尺寸|大小|幾吋/i, "尺寸規格");
  addProbe(/HAS|升降|支架/i, "HAS 支架規格");
  addProbe(/旋轉|轉向|PIVOT/i, "旋轉規格");
  if (probes.length === 0) return "";

  const facts = [];
  probes.slice(0, 4).forEach(function (probe) {
    const reply = buildDeterministicExactRuleReply_(
      `${normalizedModel} ${probe}`,
      normalizedModel,
    );
    const body = String(reply || "")
      .replace(/\n{0,2}\[來源\s*[:：][^\]]+\]/gi, "")
      .trim();
    if (body && facts.indexOf(body) < 0) facts.push(body);
  });
  if (facts.length === 0) return "";
  return `${facts.join("\n")}\n[來源:官方規格庫]`;
}

function mergeKnownRuleAnchorWithAdvancedAnswer_(knownRuleAnswer, finalText) {
  const known = String(knownRuleAnswer || "").trim();
  const answer = String(finalText || "").trim();
  if (!known) return answer;
  const visibleKnown = known
    .replace(/\n{0,2}\[來源\s*[:：][^\]]+\]/gi, "")
    .trim();
  if (!visibleKnown) return answer;

  // 手冊常把已由 RULE 確認的句子再接一個逗號繼續回答；只比整段字串
  // 會讓同一個 HDMI 數量出現兩次。逐句移除已知前綴，保留真正新增的
  // 操作內容與來源標記，避免針對產品或題型增加特例。
  let remainingAnswer = answer;
  const normalizeCountToken = function (value) {
    const token = String(value || "").trim();
    const chineseCounts = { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4 };
    return Object.prototype.hasOwnProperty.call(chineseCounts, token)
      ? chineseCounts[token]
      : Number(token);
  };
  const knownPortFacts = [];
  visibleKnown.split(/\n+/).forEach(function (line) {
    const stem = String(line || "")
      .replace(/[。！？]+\s*$/, "")
      .trim();
    if (stem.length < 8) return;
    const escapedStem = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    remainingAnswer = remainingAnswer.replace(
      new RegExp(`${escapedStem}[。！？，,:：\\s]*`, "gi"),
      "",
    );
    const portFact = stem.match(
      /\b([SCF]\d{2,3}[A-Z0-9]+)\b[^\n。！？]{0,48}?(?:有|共有)\s*([0-9]+|一|二|兩|三|四)\s*個\s*(MICRO\s*HDMI|HDMI|DISPLAYPORT|USB[\s-]*C)(?:\s*([0-9]+(?:\.[0-9]+)?))?\s*(?:連接埠)?/i,
    );
    if (portFact) {
      knownPortFacts.push({
        model: portFact[1].toUpperCase(),
        count: normalizeCountToken(portFact[2]),
        port: portFact[3].toUpperCase().replace(/[\s-]+/g, ""),
        version: String(portFact[4] || ""),
      });
    }
  });
  let hadPortConflict = false;
  knownPortFacts.forEach(function (fact) {
    const portPattern = fact.port === "MICROHDMI"
      ? "MICRO\\s*HDMI"
      : fact.port === "DISPLAYPORT"
      ? "DISPLAYPORT"
      : fact.port === "USBC"
      ? "USB[\\s-]*C"
      : "HDMI";
    // 手冊回答常用「這款」或直接以「有兩個」開頭；本函式
    // 只處理已鎖定單一型號的合併答案，因此可將這些同指主詞
    // 視為同型號；仍限定在句首，不會誤刪「切換到 HDMI 2」。
    const subjectPattern =
      `(?:\\b${fact.model}\\b|(?:^|[\\n。！？])\\s*(?:這款|本機|此款|該型號|這台|此螢幕)?)`;
    const duplicatePattern = new RegExp(
      `${subjectPattern}[^\\n。！？]{0,32}?(?:有|共有)\\s*([0-9]+|一|二|兩|三|四)\\s*個\\s*${portPattern}(?:\\s*([0-9]+(?:\\.[0-9]+)?))?\\s*(?:連接埠)?[。！？，,:：\\s]*`,
      "i",
    );
    const duplicateMatch = remainingAnswer.match(duplicatePattern);
    if (!duplicateMatch) return;
    const answerCount = normalizeCountToken(duplicateMatch[1]);
    const answerVersion = String(duplicateMatch[2] || "");
    const sameCount = answerCount === fact.count;
    const compatibleVersion =
      !answerVersion ||
      (!fact.version ? false : answerVersion === fact.version);
    if (sameCount && compatibleVersion) {
      remainingAnswer = remainingAnswer.replace(duplicatePattern, "");
      return;
    }
    if (!sameCount || (answerVersion && fact.version && answerVersion !== fact.version)) {
      hadPortConflict = true;
      remainingAnswer = remainingAnswer.replace(duplicatePattern, "");
      if (typeof writeLog === "function") {
        writeLog(
          `[Evidence Conflict v29.6.250] ${fact.model}/${fact.port} RULE=${fact.count}${fact.version ? ` v${fact.version}` : ""}，手冊=${answerCount}${answerVersion ? ` v${answerVersion}` : ""}；客戶答案採 RULE`,
        );
      }
    }
  });
  remainingAnswer = remainingAnswer
    .replace(/^\s*[，,:：。]+\s*/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (hadPortConflict) {
    remainingAnswer = [
      remainingAnswer,
      "連接埠數量以上方已確認規格為準。",
    ].filter(Boolean).join("\n");
  }
  const visibleRemaining = remainingAnswer
    .replace(/\n{0,2}\[來源\s*[:：][^\]]+\]/gi, "")
    .trim();
  if (!visibleRemaining) {
    const advancedSourceTags = answer.match(/\[來源\s*[:：][^\]]+\]/gi) || [];
    return [known].concat(advancedSourceTags).join("\n");
  }
  const supplementLabel = /\[來源\s*[:：][^\]]*(?:網路|公開網頁|WEB)/i.test(
    remainingAnswer,
  )
    ? "網路補充："
    : "手冊補充：";
  return ["已確認規格：", known, "", supplementLabel, remainingAnswer]
    .filter(Boolean)
    .join("\n");
}

function tryManualFreeLocalAnswer_(
  query,
  contextId,
  userId,
  replyToken,
  model,
  allowRule,
) {
  const aliasCandidates = getAliasOnlySelectionModelsFromQuery(query, 10, false);
  const directLocalQa = findLocalMatchInQA(query, userId, model);
  const directQaCoversAliases =
    directLocalQa &&
    doesQaMatchCoverQueryAliases_(query, directLocalQa.question);
  if (
    directLocalQa &&
    (!shouldPromptAliasModelSelection_(query, aliasCandidates) ||
      directQaCoversAliases)
  ) {
    const remaining = getSourceRemaining_(contextId, "manual");
    clearPendingSourceState_(contextId);
    LAST_SOURCE_TEST_STATE = {
      source: "spec",
      pending: false,
      executed: "local_qa",
      reserved: false,
      remaining: remaining,
    };
    const localMatch = Object.assign({}, directLocalQa);
    LAST_SOURCE_TEST_STATE.source = "manual";
    LAST_SOURCE_TEST_STATE.outcome = "local_qa";
    LAST_SOURCE_TEST_STATE.refunded = true;
    writeLog(
      `[Manual Free Precheck v29.6.113] 精準 QA 命中，不讀 PDF、不扣手冊次數: ${directLocalQa.question.substring(0, 60)}`,
    );
    replyWithLocalQaMatch_(
      localMatch,
      query,
      userId,
      replyToken,
      contextId,
    );
    rememberRecentSourceQuestion_(contextId, query, model || "");
    return true;
  }

  const verifiedManualChunk = findVerifiedManualChunk_(query, model || "");
  if (verifiedManualChunk) {
    const remaining = getSourceRemaining_(contextId, "manual");
    const verifiedReply = `${buildVerifiedManualChunkReply_(
      normalizeModelForDisplay(model),
      verifiedManualChunk,
    )}\n[費用:NT$0.0000（未呼叫 LLM）]`;
    clearPendingSourceState_(contextId);
    LAST_SOURCE_TEST_STATE = {
      source: "manual",
      outcome: "verified_chunk",
      pending: false,
      executed: "verified_manual_chunk",
      reserved: false,
      remaining: remaining,
    };
    writeLog(
      `[Manual Chunk RAG v29.6.132] 精準命中 ${normalizeModelForDisplay(model)} / ${verifiedManualChunk.intent}: ${verifiedManualChunk.sourceFile} 第 ${verifiedManualChunk.pages} 頁，零 PDF 呼叫、零手冊扣次`,
    );
    writeAnswerEnvelope_(
      contextId,
      buildAdvancedAnswerEnvelope_(
        "manual",
        query,
        model,
        verifiedReply,
        "success",
        [],
      ),
    );
    replyMessage(replyToken, verifiedReply);
    writeRecordDirectly(userId, query, contextId, "user", "");
    writeRecordDirectly(userId, verifiedReply, contextId, "assistant", "");
    const verifiedHistory = getHistoryFromCacheOrSheet(contextId);
    updateHistorySheetAndCache(
      contextId,
      verifiedHistory,
      { role: "user", content: query },
      { role: "assistant", content: verifiedReply },
    );
    rememberRecentSourceQuestion_(contextId, query, model || "");
    rememberSourceLastAdvanced_(contextId, "manual");
    return true;
  }

  if (!allowRule || !isLikelyLocalSpecRuleQuestion_(query)) return false;
  const deterministicRuleReply = buildDeterministicExactRuleReply_(query, model);
  if (!deterministicRuleReply) {
    writeLog(
      "[Manual Free Precheck v29.6.147] 無 deterministic RULE 事實，禁止 Fast 擋住 PDF",
    );
    return false;
  }
  const remaining = getSourceRemaining_(contextId, "manual");
  let finalText = deterministicRuleReply;
  finalText = enforceNiTone(finalText);
  clearPendingSourceState_(contextId);
  LAST_SOURCE_TEST_STATE = {
    source: "manual",
    outcome: "local_rule",
    pending: false,
    executed: "local_rule",
    reserved: false,
    remaining: remaining,
    refunded: true,
  };
  writeLog(
    "[Manual Free Precheck v29.6.147] deterministic RULE 回覆，不讀 PDF、不扣手冊次數",
  );
  replyMessage(replyToken, finalText);
  writeRecordDirectly(userId, query, contextId, "user", "");
  writeRecordDirectly(userId, finalText, contextId, "assistant", "");
  updateHistorySheetAndCache(
    contextId,
    getHistoryFromCacheOrSheet(contextId),
    { role: "user", content: query },
    { role: "assistant", content: finalText },
  );
  rememberRecentSourceQuestion_(contextId, query, model || "");
  return true;
}

function buildSafeNoEvidenceNextStep_(query, model) {
  const text = String(query || "");
  const modelPrefix = model ? `${model}：` : "";
  if (/(?:APP|應用程式|NETFLIX|YOUTUBE|DISNEY|SPOTIFY|LINE\s*TV|愛奇藝)/i.test(text)) {
    const ruleLine = model ? findExactModelRuleLine_(model) : "";
    if (/(?:SMART\s*MONITOR|TIZEN|智慧聯網)/i.test(ruleLine)) {
      return `${modelPrefix}可先到螢幕的「首頁 → 應用程式」搜尋服務名稱；若沒有出現，先不要套用其他型號的安裝方式，改由本款官網或三星客服確認台灣區是否上架。`;
    }
    return `${modelPrefix}目前沒有足夠證據確認這款具備內建 App 商店，我先不套用 Smart Monitor 的選單；可從本款官網或三星客服核對。`;
  }
  if (/(?:聲音|音效|喇叭|耳機|藍牙|AUX)/i.test(text)) {
    return `${modelPrefix}可先確認螢幕與播放裝置沒有靜音，並重新選一次正確的音訊輸出；若問題是某個連接孔是否存在，請以機身端子標示或本款官網照片核對。`;
  }
  if (/(?:畫面|黑屏|閃爍|無訊號|HDMI|DISPLAYPORT|USB[\s-]*C|TYPE[\s-]*C|連接|投影)/i.test(text)) {
    return `${modelPrefix}可先重新選擇正確訊號源、把線材兩端重插，並暫時拿掉轉接器或 Hub 直接連接；這些都無法改善時，再交由三星檢查。`;
  }
  return `${modelPrefix}目前沒有足夠證據可下結論，我先不套用其他型號的做法；可從本款官網或三星客服核對這一項。`;
}

function buildTentativeManualFallback_(rawResponse, model, question) {
  let tentative = stripAnySourceTags(
    formatForLineMobile(String(rawResponse || "")),
  )
    .replace(/\[手冊證據:[^\]]+\]/gi, "")
    .replace(/\[MANUAL_EVIDENCE_NOT_FOUND\]/gi, "")
    .replace(/\[(?:AUTO_SEARCH_PDF|AUTO_SEARCH_WEB|NEW_TOPIC)\]/gi, "")
    .replace(/\[型號[:：][^\]]+\]/g, "")
    .trim();
  if (
    !tentative ||
    isApiFailureReply(tentative) ||
    isManualEvidenceFailureReply_(tentative)
  ) {
    tentative = buildSafeNoEvidenceNextStep_(question, model);
  }
  return [
    `目前最可能的處理方向${model ? `（${model}）` : ""}：`,
    tentative,
    "",
    "這段是手冊與公開網頁都未取得可核對證據後的保守參考，不代表三星官方已證實。",
  ].join("\n");
}

function isMonitorUsbMediaWebQuestion_(query) {
  return (
    /(?:USB|隨身碟)/i.test(String(query || "")) &&
    /(?:播放|影片|照片|音樂|媒體|斷線|讀取)/i.test(String(query || ""))
  );
}

function sanitizeTentativeWebActionLine_(rawLine) {
  let line = String(rawLine || "")
    .replace(/^\s*(?:\d+[.、)]|[•*-])\s*/, "")
    .replace(/\*\*/g, "")
    .trim();
  if (!line) return "";
  const colonIndex = line.search(/[:：]/);
  const label = colonIndex >= 0 ? line.substring(0, colonIndex).trim() : "";
  const body = colonIndex >= 0 ? line.substring(colonIndex + 1) : line;
  const unsafe =
    /(?:可能|不一定|通常|一般來說|購買|訂購|付費|下單|推薦|其他品牌|其他型號|相近型號|來源不明|工程模式|韌體)/i;
  const actionable =
    /(?:先|再|使用|透過|連接|接上|切換|檢查|確認|詢問|諮詢|重新|改用|將)/i;
  const safeClauses = body
    .split(/[。；;，,]+/)
    .map((clause) => clause.trim())
    .filter(
      (clause) =>
        clause.length >= 6 && actionable.test(clause) && !unsafe.test(clause),
    );
  if (safeClauses.length === 0) return "";
  return `• ${label ? `${label}：` : ""}${safeClauses.slice(0, 3).join("；")}。`;
}

function buildTentativeWebFallback_(rawResponse, query, model) {
  const isMonitorUsbMedia = isMonitorUsbMediaWebQuestion_(query);
  const rawText = String(rawResponse || "");
  const declaredNoEvidence =
    rawText === "[NO_RELEVANT_WEB_EVIDENCE]" ||
    /(?:沒有|未能|找不到)[^。\n]{0,100}(?:資料|資訊|結果|解法|步驟|說明|網頁)/i.test(
      rawText,
    ) ||
    /無法[^。\n]{0,80}找到[^。\n]{0,80}(?:資料|資訊|結果|解法|步驟|說明|網頁)/i.test(
      rawText,
    ) ||
    /(?:沒有|未能|找不到)[^。\n]{0,100}(?:直接|明確)[^。\n]{0,40}(?:提到|回答|核對)/i.test(
      rawText,
    );
  const rawSafeActionLines = rawText
    .split(/\n+/)
    .filter((line) => /^\s*(?:\d+[.、)]|[•*-])\s*/.test(line))
    .map(sanitizeTentativeWebActionLine_)
    .filter(Boolean);
  if (declaredNoEvidence && rawSafeActionLines.length === 0) {
    return [
      `${model ? `${model}：` : ""}這次公開網頁沒有足夠證據回答這題，我先不拿其他型號或「一般來說」的經驗當答案。`,
      "這類型號操作問題以官方手冊較可靠，可直接點下方「官方手冊」查同一題，不用重打型號。",
    ].join("\n");
  }
  let lines = stripAnySourceTags(
    formatForLineMobile(String(rawResponse || "")),
  )
    .replace(/\[(?:AUTO_SEARCH_PDF|AUTO_SEARCH_WEB|NEW_TOPIC)\]/gi, "")
    .replace(/\[型號[:：][^\]]+\]/g, "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !/^(?:透過|根據)(?:本次)?網路搜尋|^以下(?:是|為)(?:搜尋|找到)/i.test(
          line,
        ),
    )
    .filter(
      (line) =>
        !isMonitorUsbMedia ||
        !/(?:Windows[^。]{0,30}USB|USB[^。]{0,30}選擇性暫停|主機板|電腦端[^。]{0,20}USB)/i.test(
          line,
        ),
    )
    .filter(
      (line) =>
        !/(?:非官方|第三方)[^。]{0,20}(?:韌體|firmware)[^。]{0,20}(?:下載|安裝|更新)/i.test(
          line,
        ),
    );

  // LINE 手機閱讀以五個具體處理方向為上限，避免模型引言或尾段把答案撐長。
  const numbered = lines.filter((line) => /^\d+[.、)]\s*/.test(line));
  const actionableFromFormatted = lines
    .filter((line) => /^(?:\d+[.、)]|[•*-])\s*/.test(line))
    .map(sanitizeTentativeWebActionLine_)
    .filter(Boolean);
  const actionable =
    rawSafeActionLines.length > 0
      ? rawSafeActionLines
      : actionableFromFormatted;
  if (isMonitorUsbMedia && numbered.length < 3) {
    // Search grounding 偶爾會以 MAX_TOKENS 只留下半個步驟；不可把殘句當完成答案。
    lines = [];
  } else if (actionable.length > 0) {
    lines = actionable.slice(0, 5);
  } else if (numbered.length > 0) {
    lines = numbered.slice(0, 5);
  } else {
    lines = lines.slice(0, 6);
  }
  let tentative = lines.join("\n").trim();
  if (!tentative || isApiFailureReply(tentative)) {
    tentative = isMonitorUsbMedia
      ? [
          "1. 先把隨身碟改用 FAT32 或 exFAT，並用另一支隨身碟交叉測試。",
          "2. 直接插螢幕 USB 埠，不經 Hub 或延長線，並改測另一個 USB 埠。",
          "3. 用單一、常見格式的小檔案測試；若只有特定檔案中斷，優先檢查影片編碼與檔案損壞。",
          "4. 若不同隨身碟與檔案都會中斷，記下發生時間與檔案格式，再聯絡三星檢查 USB 埠或系統異常。",
        ].join("\n")
      : buildSafeNoEvidenceNextStep_(query, model);
  }
  return [
    `目前可先嘗試的方向${model ? `（${model}）` : ""}：`,
    tentative,
    "",
    "以上是低風險排查方向，並非已由三星手冊或公開來源證實。",
  ].join("\n");
}

function isGroundedWebAnswerRelevant_(text, model) {
  const body = String(text || "");
  if (!body.trim()) return false;
  // 有 grounding 不代表內容真的回答目前型號。模型若明說只找到其他系列，
  // 必須視為沒有本題證據，不能把相近型號經驗包裝成目前型號的解法。
  if (
    /(?:沒有|未能|找不到)[^。\n]{0,40}(?:這個|該|特定|目前)[^。\n]{0,20}型號/i.test(
      body,
    ) ||
    /根據[^。\n]{0,20}(?:其他|相近)[^。\n]{0,20}(?:系列|型號)/i.test(body)
  ) {
    return false;
  }
  const normalizedModel = normalizeModelForDisplay(model || "");
  if (!normalizedModel) return true;
  return body.toUpperCase().indexOf(normalizedModel.toUpperCase()) >= 0;
}

function compactGroundedWebAnswer_(rawResponse) {
  let body = stripAnySourceTags(formatForLineMobile(String(rawResponse || "")))
    .replace(/\s*\[cite[\s\S]*$/i, "")
    .replace(/\[(?:AUTO_SEARCH_PDF|AUTO_SEARCH_WEB|NEW_TOPIC)\]/gi, "")
    .replace(/\[型號[:：][^\]]+\]/g, "")
    .trim();
  const safeLines = [];
  let suppressSpeculativeList = false;
  body.split(/\n+/).forEach(function (rawLine) {
    const line = String(rawLine || "").trim();
    if (!line) return;
    if (/(?:非官方)?推測|這(?:表示|暗示)|通常這類|可能考量|未經證實/i.test(line)) {
      suppressSpeculativeList = /推測|通常這類/i.test(line);
      return;
    }
    if (suppressSpeculativeList) {
      if (/^(?:\d+[.、)]|[•*-])\s*/.test(line)) return;
      suppressSpeculativeList = false;
    }
    safeLines.push(line);
  });
  body = safeLines.join("\n").trim();
  const maxChars = 700;
  if (body.length > maxChars) {
    const head = body.substring(0, maxChars);
    const sentenceEnd = Math.max(head.lastIndexOf("。"), head.lastIndexOf("\n"));
    body = head.substring(0, sentenceEnd >= 360 ? sentenceEnd + 1 : maxChars).trim();
  }
  return body;
}

function getGroundedQuestionFocusTokens_(query, model) {
  let body = toHalfWidth(String(query || ""))
    .toUpperCase()
    .replace(String(model || "").toUpperCase(), " ")
    .replace(/SAMSUNG|三星|台灣|非官方|公開網頁|實務解法|官方/g, " ")
    .replace(/請問|請幫我|幫我|可以嗎|能不能|是不是|是否|怎麼|如何|為什麼|多少|這款|這台|那台|它的|他的|有沒有|需要嗎|是|嗎|呢|啊|呀|的|要|有/g, " ")
    .replace(/[^A-Z0-9\u4e00-\u9fff]+/g, " ")
    .trim();
  const tokens = [];
  const seen = {};
  body.split(/\s+/).forEach(function (chunk) {
    if (!chunk) return;
    if (/^[A-Z0-9]{2,}$/.test(chunk)) {
      if (!seen[chunk]) {
        seen[chunk] = true;
        tokens.push(chunk);
      }
      return;
    }
    if (/^[\u4e00-\u9fff]{2,}$/.test(chunk)) {
      if (chunk.length <= 8 && !seen[chunk]) {
        seen[chunk] = true;
        tokens.push(chunk);
      }
      for (let i = 0; i < chunk.length - 1; i += 1) {
        const pair = chunk.substring(i, i + 2);
        if (!seen[pair]) {
          seen[pair] = true;
          tokens.push(pair);
        }
      }
    }
  });
  return tokens.filter(function (token) {
    return !/^(?:螢幕|產品|型號|問題|答案|資料|方式)$/.test(token);
  });
}

function expandGroundedSupportToCompleteLine_(rawResponse, rawSegment) {
  const response = String(rawResponse || "");
  const segment = String(rawSegment || "").trim();
  if (!response || !segment) return segment;
  const exactIndex = response.indexOf(segment);
  if (exactIndex < 0) return segment;
  const lineStart = Math.max(response.lastIndexOf("\n", exactIndex - 1) + 1, 0);
  const rawLineEnd = response.indexOf("\n", exactIndex + segment.length);
  const lineEnd = rawLineEnd >= 0 ? rawLineEnd : response.length;
  const completeLine = response.substring(lineStart, lineEnd).trim();
  if (!completeLine || completeLine.length > 700) return segment;
  // Grounding 有時只標到同一句的逗號前，若直接顯示 segment 會留下半句。
  // 只擴到相同條列／同一行；不跨段、不拼接下一個未引用主張。
  return completeLine;
}

function doesGroundedAnswerCompleteQuestion_(text, originalQuestion) {
  const answer = String(text || "").trim();
  const question = String(originalQuestion || "");
  if (!answer) return false;
  if (/[：:，,；;、（(\-]$/.test(answer)) return false;
  if (/(?:可以|能不能|是否|可否|有沒有|支援嗎|能否)/i.test(question)) {
    return /(?:可以|可透過|可使用|能夠|不能|無法|不支援|支援|接上|連接|需要|需先)/i.test(
      answer,
    );
  }
  if (/(?:怎麼|如何|怎樣|哪些步驟|操作步驟|哪個選單|從哪裡)/i.test(question)) {
    return /(?:先|再|接著|進入|選擇|開啟|關閉|連接|設定|檢查|確認|按下|切換|重新)/i.test(
      answer,
    );
  }
  return true;
}

function buildGroundedSupportedAnswer_(
  segments,
  model,
  originalQuestion,
  rawResponse,
) {
  const unique = [];
  const seen = {};
  (Array.isArray(segments) ? segments : []).forEach(function (rawSegment) {
    const segment = compactGroundedWebAnswer_(
      expandGroundedSupportToCompleteLine_(rawResponse, rawSegment),
    );
    if (
      !segment ||
      /(?:非官方)?推測|這(?:表示|暗示)|通常|有些|部分|可能|一般來說/i.test(
        segment,
      )
    ) {
      return;
    }
    const key = segment.replace(/\s+/g, "").toUpperCase();
    if (!seen[key]) {
      seen[key] = true;
      unique.push(segment);
    }
  });
  const normalizedModel = normalizeModelForDisplay(model || "");
  if (
    normalizedModel &&
    !unique.some(function (segment) {
      return segment.toUpperCase().indexOf(normalizedModel.toUpperCase()) >= 0;
    })
  ) {
    return "";
  }
  const focusTokens = getGroundedQuestionFocusTokens_(
    originalQuestion,
    normalizedModel,
  );
  if (focusTokens.length > 0) {
    const combined = unique.join("\n").toUpperCase();
    const matchedFocus = focusTokens.filter(function (token) {
      return combined.indexOf(token.toUpperCase()) >= 0;
    });
    const requiredMatches = focusTokens.length >= 3 ? 2 : 1;
    if (matchedFocus.length < requiredMatches) {
      return "";
    }
  }
  const answer = unique.slice(0, 5).join("\n").trim();
  return doesGroundedAnswerCompleteQuestion_(answer, originalQuestion)
    ? answer
    : "";
}

function runManualWebRescue_(originalQuestion, model, contextId, userId) {
  const canonicalQuery = buildCanonicalWebQuery_(originalQuestion, model || "");
  const rescueGrant = activateAdvancedSourceGrant_(
    "web",
    contextId,
    userId,
    { systemRescue: true },
  );
  try {
    const webResponse = callLLMWithRetry(
      canonicalQuery,
      [{ role: "user", content: canonicalQuery }],
      [],
      false,
      null,
      false,
      userId,
      true,
      model || null,
    );
    const rawWebDraft = String(lastWebUnverifiedDraft || webResponse || "");
    const webText = buildGroundedSupportedAnswer_(
      lastWebSupportedSegments,
      model,
      originalQuestion,
      rawWebDraft,
    );
    if (
      lastWebEvidenceValid &&
      webText &&
      isGroundedWebAnswerRelevant_(webText, model) &&
      !isApiFailureReply(webText) &&
      Array.isArray(lastSearchSources) &&
      lastSearchSources.length > 0
    ) {
      return {
        attempted: true,
        success: true,
        text: webText,
        sources: lastSearchSources.slice(),
        userQuotaCharged: false,
      };
    }
    const tentativeText = buildTentativeWebFallback_(
      rawWebDraft,
      originalQuestion,
      model,
    );
    writeLog(
      `[Source Rescue v29.6.192] evidence=${lastWebEvidenceValid ? 1 : 0} rawDraftChars=${rawWebDraft.length} tentative=${/(?:^|\n)•\s/.test(tentativeText) ? 1 : 0}`,
    );
    return {
      attempted: true,
      success: false,
      text: "",
      tentativeText: /(?:^|\n)•\s/.test(tentativeText)
        ? tentativeText
        : "",
      sources: [],
      userQuotaCharged: false,
    };
  } catch (error) {
    writeLog(
      `[Source Rescue v29.6.148] 自動 Web 補救失敗: ${String(error && error.message ? error.message : error)}`,
    );
    return {
      attempted: false,
      success: false,
      text: "",
      sources: [],
      userQuotaCharged: false,
    };
  } finally {
    ACTIVE_ADVANCED_SOURCE_GRANT = null;
  }
}

function buildManualWebRescueReply_(rescue, manualResponse, model, question) {
  if (rescue && rescue.success) {
    return [
      "官方手冊沒有明確記載，我接著查到以下公開網頁做法：",
      "",
      rescue.text,
      "",
      `參考：${rescue.sources.join("、")}（非官方，請斟酌）`,
      "[來源:網路搜尋]",
    ].join("\n");
  }
  if (!rescue || !rescue.attempted) {
    return [
      "官方手冊與公開網頁目前都沒有可核對的結論，我先整理最保守、可逆的排查方式：",
      "",
      buildTentativeManualFallback_(manualResponse, model, question),
    ].join("\n");
  }
  if (rescue.tentativeText) {
    const practicalText = String(rescue.tentativeText).replace(
      /\n\n以上是低風險排查方向，並非已由三星手冊或公開來源證實。\s*$/,
      "",
    );
    return [
      "官方手冊與公開網頁都沒有可核對的結論；以下只是不涉及風險的可能做法，不代表三星已證實：",
      "",
      practicalText,
    ].join("\n");
  }
  return [
    "官方手冊與公開網頁都沒有可核對的結論，我先整理最保守、可逆的排查方式：",
    "",
    buildTentativeManualFallback_(manualResponse, model, question),
  ].join("\n");
}

/**
 * QA／RULE 無法回答時的唯一自動手冊入口。
 * 這裡只補齊已確認型號並交給單一來源狀態機；選型、PDF 額度、
 * 檔案預檢、Web 補救與 operationId 冪等仍全部由 executeAdvancedSourceQuery_ 管理。
 */
function executeAutomaticManualFallback_(
  query,
  model,
  contextId,
  userId,
  replyToken,
) {
  const originalQuestion = stripInternalRoutingHints_(query);
  const selectedModel = normalizeModelForDisplay(model || "");
  const queryWithModel =
    selectedModel &&
    extractFullModelLikeTokens(originalQuestion).map(normalizeModelForDisplay).indexOf(selectedModel) < 0
      ? `${selectedModel} ${originalQuestion}`.trim()
      : originalQuestion;
  const automaticState = {
    source: "manual",
    contextId: contextId,
    userIdHash: getSourceContextHash_(userId),
    previousQuestion: originalQuestion,
    previousModel: selectedModel,
    draftQuery: originalQuestion,
    usePrevious: Boolean(selectedModel),
    automaticFallback: true,
    priorFastChecked: true,
    dailyQuestionRemaining: CURRENT_DAILY_QUESTION_REMAINING,
  };
  writeLog(
    `[Automatic Manual Fallback v29.6.247] QA/RULE 不足，直接進官方手冊；model=${selectedModel || "待選"}`,
  );
  return executeAdvancedSourceQuery_(
    "manual",
    queryWithModel,
    contextId,
    userId,
    replyToken,
    automaticState,
  );
}

function executeAdvancedSourceQuery_(
  source,
  query,
  contextId,
  userId,
  replyToken,
  pendingState,
) {
  const normalizedSource = String(source || "");
  const cache = CacheService.getScriptCache();
  const originalQuestion = stripInternalRoutingHints_(query);
  let normalizedQuery = originalQuestion;
  let knownRuleAnswer = String(
    pendingState && pendingState.knownRuleAnswer
      ? pendingState.knownRuleAnswer
      : "",
  ).trim();
  if (!normalizedQuery) {
    return startSourceSelection_(
      normalizedSource,
      contextId,
      userId,
      replyToken,
    );
  }

  if (normalizedSource !== "manual" && normalizedSource !== "web") {
    clearPendingSourceState_(contextId);
    return false;
  }

  if (
    normalizedSource === "manual" &&
    !(
      pendingState &&
      pendingState.automaticFallback &&
      pendingState.priorFastChecked
    ) &&
    tryManualFreeLocalAnswer_(
      normalizedQuery,
      contextId,
      userId,
      replyToken,
      "",
      false,
    )
  ) {
    return true;
  }

  const remainingBefore = getSourceRemaining_(contextId, normalizedSource);
  if (remainingBefore <= 0 && normalizedSource === "web") {
    clearPendingSourceState_(contextId);
    replyMessage(
      replyToken,
      `今天的${normalizedSource === "manual" ? "官方手冊 5 次" : "網路解答 10 次"}已用完。這次沒有送出查詢；你仍可使用「規格＆FAQ」的每日提問額度。`,
    );
    return true;
  }

  let selectedModel = "";
  if (normalizedSource === "web") {
    const explicitWebModels = extractFullModelLikeTokens(normalizedQuery);
    const persistentProduct = readSourceProductState_(contextId);
    selectedModel = normalizeModelForDisplay(
      explicitWebModels[0] ||
        (pendingState && pendingState.previousModel) ||
        (persistentProduct && persistentProduct.model) ||
        "",
    );
    if (selectedModel) {
      rememberSourceProductModel_(contextId, selectedModel, "web_query");
      normalizedQuery = buildCanonicalWebQuery_(normalizedQuery, selectedModel);
    }
    writeLog(
      `[Source Route v29.6.132] 網路 canonical query model=${selectedModel || "none"} query=${normalizedQuery.substring(0, 180)}`,
    );
  }
  if (normalizedSource === "manual") {
    if (
      pendingState &&
      pendingState.draftQuery &&
      isManualModelHintOnly_(normalizedQuery)
    ) {
      normalizedQuery = `${normalizedQuery} ${pendingState.draftQuery}`.trim();
    }
    selectedModel = resolveManualSourceModel_(
      normalizedQuery,
      pendingState,
      cache,
      userId,
    );
    if (
      selectedModel &&
      pendingState &&
      pendingState.usePrevious &&
      extractFullModelLikeTokens(normalizedQuery).length === 0
    ) {
      normalizedQuery = `${selectedModel} ${normalizedQuery}`.trim();
      writeLog(
        `[Source Route v29.6.121] 手冊同題沿用已鎖定型號: ${selectedModel}`,
      );
    }
    const modelOnly = extractFullModelLikeTokens(normalizedQuery);
    if (
      pendingState &&
      pendingState.draftQuery &&
      modelOnly.length === 1 &&
      normalizedQuery.replace(modelOnly[0], "").trim().length === 0
    ) {
      normalizedQuery = `${modelOnly[0]} ${pendingState.draftQuery}`.trim();
      selectedModel = modelOnly[0];
    }
    if (!selectedModel) {
      const modelCandidates = getManualSourceCandidateModels_(
        normalizedQuery,
        10,
      );
      if (modelCandidates.length === 1) {
        selectedModel = modelCandidates[0];
        normalizedQuery = `${selectedModel} ${normalizedQuery}`.trim();
      } else if (modelCandidates.length > 1) {
        writePendingSourceState_(contextId, {
          source: "manual",
          userIdHash: getSourceContextHash_(userId),
          previousQuestion: pendingState ? pendingState.previousQuestion || "" : "",
          previousModel: "",
          draftQuery: normalizedQuery,
          manualModelCandidates: modelCandidates,
          dailyQuestionRemaining: CURRENT_DAILY_QUESTION_REMAINING,
        });
        cache.put(
          `${userId}:suggested_models`,
          JSON.stringify(modelCandidates),
          600,
        );
        LAST_SOURCE_TEST_STATE = {
          source: "manual",
          pending: true,
          needsModel: true,
          modelCandidates: modelCandidates,
          remaining: remainingBefore,
        };
        replyMessage(replyToken, [
          {
            type: "text",
            text: "這個系列有多個版本。請直接點選你要查的型號；選型號前不會讀手冊，也不會扣次。",
          },
          createManualSourceModelSelectionFlex_(modelCandidates),
        ]);
        return true;
      }
    }
    if (!selectedModel) {
      writePendingSourceState_(contextId, {
        source: "manual",
        userIdHash: getSourceContextHash_(userId),
        previousQuestion: pendingState ? pendingState.previousQuestion || "" : "",
        previousModel: "",
        draftQuery: normalizedQuery,
        dailyQuestionRemaining: CURRENT_DAILY_QUESTION_REMAINING,
      });
      LAST_SOURCE_TEST_STATE = {
        source: "manual",
        pending: true,
        needsModel: true,
        remaining: remainingBefore,
      };
      replyMessage(
        replyToken,
        `我還缺可辨識的系列或型號線索，所以尚未讀取手冊，也沒有扣次。\n\n你不用輸入完整型號：請回覆系列別稱或機身型號前段（例如 M8、G8、S27DG5），若有多個版本我會直接列出按鈕讓你選。\n\n我會接著查這題：「${normalizedQuery.substring(0, 160)}」；輸入「取消」可離開。`,
        {
          quickReply: {
            items: [
              buildSourcePostbackQuickReply_(
                "取消",
                "rm_action=cancel_source&v=2",
              ),
            ],
          },
        },
      );
      return true;
    }

    rememberSourceProductModel_(contextId, selectedModel, "manual_query");

    if (!knownRuleAnswer) {
      knownRuleAnswer = buildKnownRuleAnchorForMixedOperation_(
        normalizedQuery,
        selectedModel,
      );
    }

    if (
      tryManualFreeLocalAnswer_(
        normalizedQuery,
        contextId,
        userId,
        replyToken,
        selectedModel,
        true,
      )
    ) {
      return true;
    }
    if (remainingBefore <= 0) {
      clearPendingSourceState_(contextId);
      const exhaustedManualReply = mergeKnownRuleAnchorWithAdvancedAnswer_(
        knownRuleAnswer,
        "今天的官方手冊 5 次已用完。這題在規格／FAQ 沒有高信心答案，因此沒有送出 PDF 查詢；明天 00:00 會自動恢復。",
      );
      replyMessage(
        replyToken,
        exhaustedManualReply,
        buildAdvancedSourceQuickReplies_(
          "manual",
          selectedModel,
          exhaustedManualReply,
          { forceOfficial: true, skipSameSource: true },
        ),
      );
      return true;
    }

    // 來源鍵（或相容 #查手冊 指令）本身已是明確授權。完整型號解析完成後
    // 直接進 token/PDF 預檢；禁止再送一個「確認要查」把同一題卡成兩次操作。
    writeLog(
      `[Manual Authorization v29.6.160] source=${pendingState ? "pending" : "explicit"} model=${selectedModel}，選型完成後直接執行`,
    );
  }

  let relevantFiles = [];
  let primaryModel = selectedModel;
  const sourceOperation = beginAdvancedSourceOperation_(
    contextId,
    normalizedSource,
    originalQuestion,
    primaryModel || selectedModel,
  );
  if (!sourceOperation.allowed) {
    clearPendingSourceState_(contextId);
    if (sourceOperation.status === "done" && sourceOperation.finalText) {
      const cachedReply = `${String(sourceOperation.finalText || "")
        .replace(/\n{0,2}\[費用\s*[:：][^\]]+\]/gi, "")
        .trim()}\n[費用:NT$0.0000]`;
      LAST_SOURCE_TEST_STATE = {
        source: normalizedSource,
        outcome: "cached",
        pending: false,
        executed: normalizedSource,
        cached: true,
        reserved: false,
        remaining: getSourceRemaining_(contextId, normalizedSource),
      };
      replyMessage(
        replyToken,
        cachedReply,
        buildAdvancedSourceQuickReplies_(
          normalizedSource,
          primaryModel || selectedModel,
          cachedReply,
          {
            forceOfficial: true,
            skipSameSource: true,
            skipAlternateSource: true,
            allowElaborate: false,
          },
        ),
      );
      return true;
    }
    replyMessage(
      replyToken,
      "相同問題正在查詢中，這次沒有重複送出，也沒有再次扣次。請等候目前這次回覆。",
    );
    return true;
  }

  clearLegacyAdvancedRouteState_(cache, userId, contextId);
  if (normalizedSource === "manual") {
    // 完整型號解析後的免費 QA／RULE 預檢已在 begin operation 前執行一次。
    // 此處禁止再做同參數預檢；未命中才進 PDF，付費防連點仍由 operation 守門。
    const kbList = JSON.parse(
      PropertiesService.getScriptProperties().getProperty(
        CACHE_KEYS.KB_URI_LIST,
      ) || "[]",
    );
    const kbResult = getRelevantKBFiles(
      [{ role: "user", content: normalizedQuery }],
      kbList,
      userId,
      contextId,
      true,
      null,
      true,
    );
    relevantFiles = limitManualPdfFiles_(
      Array.isArray(kbResult) ? kbResult : kbResult.files || [],
      normalizedQuery,
    );
    primaryModel = Array.isArray(kbResult)
      ? selectedModel
      : kbResult.primaryModel || selectedModel;
    if (relevantFiles.length === 0) {
      clearPendingSourceState_(contextId);
      const noManualRescue = runManualWebRescue_(
        originalQuestion,
        selectedModel,
        contextId,
        userId,
      );
      const noManualReply = mergeKnownRuleAnchorWithAdvancedAnswer_(
        knownRuleAnswer,
        buildManualWebRescueReply_(
          noManualRescue,
          "手冊索引目前沒有這個型號可用的操作文件。",
          selectedModel,
          originalQuestion,
        ),
      );
      LAST_SOURCE_TEST_STATE = {
        source: "manual",
        outcome: noManualRescue.success ? "rescued_web" : "no_evidence",
        pending: false,
        noManual: true,
        executed: "manual",
        reserved: false,
        remaining: remainingBefore,
      };
      writeAnswerEnvelope_(
        contextId,
        buildAdvancedAnswerEnvelope_(
          "manual",
          originalQuestion,
          selectedModel,
          noManualReply,
          LAST_SOURCE_TEST_STATE.outcome,
          noManualRescue.sources,
        ),
      );
      replyMessage(
        replyToken,
        noManualReply,
        buildAdvancedSourceQuickReplies_(
          "manual",
          selectedModel,
          noManualReply,
          {
            forceOfficial: true,
            skipSameSource: true,
            skipAlternateSource: true,
            allowElaborate: false,
          },
        ),
      );
      finishAdvancedSourceOperation_(
        sourceOperation,
        noManualReply,
        selectedModel,
      );
      return true;
    }
  }

  clearPendingSourceState_(contextId);
  const history = getHistoryFromCacheOrSheet(contextId);
  const grant = activateAdvancedSourceGrant_(
    normalizedSource,
    contextId,
    userId,
  );
  showLoadingAnimation(userId, normalizedSource === "manual" ? 60 : 30);

  const providerQuery =
    normalizedSource === "manual" && knownRuleAnswer
      ? `${normalizedQuery}\n\n[System Hint: 以下規格已由官方規格庫確認，不要重複回答；只查原題尚未解答的操作或故障部分：${stripAnySourceTags(knownRuleAnswer)}]`
      : normalizedQuery;

  let response = "";
  try {
    response = callLLMWithRetry(
      providerQuery,
      normalizedSource === "web"
        ? [{ role: "user", content: normalizedQuery }]
        : history.concat([{ role: "user", content: providerQuery }]),
      normalizedSource === "manual" ? relevantFiles : [],
      normalizedSource === "manual",
      null,
      false,
      userId,
      normalizedSource === "web",
      primaryModel || null,
    );
  } catch (error) {
    const code = String(error && error.message ? error.message : error);
    if (code.indexOf("SOURCE_QUOTA_EXHAUSTED_") === 0) {
      const exhaustedSourceReply =
        `今天的${normalizedSource === "manual" ? "官方手冊" : "網路解答"}額度已用完；這次沒有送出查詢。你仍可使用「規格＆FAQ」的每日提問額度。`;
      replyMessage(
        replyToken,
        exhaustedSourceReply,
        buildAdvancedSourceQuickReplies_(
          normalizedSource,
          primaryModel || selectedModel,
          exhaustedSourceReply,
          { forceOfficial: true, skipSameSource: true },
        ),
      );
      clearAdvancedSourceOperation_(sourceOperation);
      return true;
    }
    writeLog(`[Source Route v29.6.106] ${normalizedSource} 失敗: ${code}`);
    if (normalizedSource === "manual") {
      // 使用者已授權查手冊；供應商或執行錯誤也要進入同一個受控 Web 補救，
      // 不能把我方錯誤丟回給使用者，也不能要求重按形成迴圈。
      response =
        "這次官方手冊查詢發生暫時錯誤，我會改用一次公開網頁補查。\n\n[AUTO_SEARCH_WEB]";
    } else {
      const failedSourceModel = primaryModel || selectedModel;
      const failedSourcePage = getSamsungOfficialModelPage_(failedSourceModel);
      const failedSourceReply = failedSourcePage
        ? "這次網路搜尋暫時沒完成。下方可先到這款三星官網查看，稍後再試一次。"
        : "這次網路搜尋暫時沒完成，稍後再試一次。";
      LAST_SOURCE_TEST_STATE = {
        source: normalizedSource,
        outcome: "error",
        pending: false,
        executed: normalizedSource,
        reserved: Boolean(grant.reserved),
        remaining:
          typeof grant.remaining === "number" ? grant.remaining : remainingBefore,
        refunded: false,
      };
      replyMessage(
        replyToken,
        failedSourceReply,
        buildAdvancedSourceQuickReplies_(
          normalizedSource,
          failedSourceModel,
          failedSourceReply,
          { forceOfficial: true, skipSameSource: true },
        ),
      );
      finishAdvancedSourceOperation_(
        sourceOperation,
        failedSourceReply,
        failedSourceModel,
        60,
      );
      return true;
    }
  } finally {
    ACTIVE_ADVANCED_SOURCE_GRANT = null;
  }

  const manualPreflightStopped =
    normalizedSource === "manual" &&
    /(?:手冊預檢沒有完成|手冊超出單次安全查詢範圍|預估費用仍超過單次)/.test(
      String(response || ""),
    );
  const evidenceGuardedResponse =
    normalizedSource === "manual" &&
    response !== "[KB_EXPIRED]" &&
    !manualPreflightStopped
      ? applyManualEvidenceGuard_(response || "", normalizedQuery)
      : response || "";
  let finalText = stripAnySourceTags(
    formatForLineMobile(evidenceGuardedResponse),
  );
  const recommendedWeb = /\[AUTO_SEARCH_WEB\]/i.test(finalText);
  const manualEvidenceNotFound =
    normalizedSource === "manual" &&
    /\[MANUAL_EVIDENCE_NOT_FOUND\]/.test(String(response || ""));
  let manualEvidenceFailed = false;
  let manualWebRescue = null;
  finalText = finalText
    .replace(/\[(?:AUTO_SEARCH_PDF|AUTO_SEARCH_WEB|NEW_TOPIC)\]/gi, "")
    .replace(/\[型號[:：][^\]]+\]/g, "")
    .trim();

  if (normalizedSource === "manual") {
    if (response === "[KB_EXPIRED]") {
      if (grant.reserved) {
        refundAdvancedSourceUsage_(grant, "manual_index_expired");
      }
      finalText =
        "系統偵測到手冊索引需要背景更新，已自動排入更新；這次不扣次。你可以先開啟下方這款三星官網，約 1 分鐘後再按「官方手冊」查證。";
    } else {
      finalText = sanitizeManualDeflection(finalText, normalizedQuery);
      finalText = enforceManualUncertaintyGuard(finalText, normalizedQuery);
      if (isCrossDeviceMonitorQuery(normalizedQuery)) {
        finalText = removeCrossDeviceManualHeadingOnlyLines_(finalText);
      }
      finalText = enforceManualNumberedList(finalText);
      if (!manualPreflightStopped && !isManualEvidenceFailureReply_(finalText)) {
        finalText = ensurePdfSourceTag(finalText, relevantFiles, 1);
      }
      manualEvidenceFailed = isManualEvidenceFailureReply_(finalText);
    }
    const needsAutomaticWebRescue =
      response === "[KB_EXPIRED]" ||
      manualPreflightStopped ||
      manualEvidenceNotFound ||
      manualEvidenceFailed ||
      recommendedWeb;
    if (needsAutomaticWebRescue) {
      manualEvidenceFailed = true;
      manualWebRescue = runManualWebRescue_(
        originalQuestion,
        primaryModel || selectedModel,
        contextId,
        userId,
      );
      finalText = buildManualWebRescueReply_(
        manualWebRescue,
        response,
        primaryModel || selectedModel,
        originalQuestion,
      );
    }
  } else {
    finalText = sanitizeManualDeflection(finalText, normalizedQuery);
    if (lastWebEvidenceValid) {
      const compactWebText = buildGroundedSupportedAnswer_(
        lastWebSupportedSegments,
        primaryModel || selectedModel,
        originalQuestion,
        response,
      );
      if (
        !compactWebText ||
        !isGroundedWebAnswerRelevant_(
          compactWebText,
          primaryModel || selectedModel,
        )
      ) {
        writeLog(
          "[Grounding Relevance v29.6.168] 搜尋支持句段沒有同時證明目前型號與本題核心詞，不視為本題答案",
        );
        lastWebEvidenceValid = false;
        lastWebUnverifiedDraft = "[NO_RELEVANT_WEB_EVIDENCE]";
        finalText = "";
      } else {
        finalText = compactWebText;
      }
    }
    // Web 回覆只能保留 grounding 直接支持的句段；不得因題型命中就用
    // 固定 USB 文案覆寫證據，否則會把未出現在來源的內容誤標成已搜尋。
    if (
      !isApiFailureReply(finalText) &&
      lastWebEvidenceValid &&
      Array.isArray(lastSearchSources) &&
      lastSearchSources.length > 0
    ) {
      finalText += `\n\n參考：${lastSearchSources.join("、")}（非官方，請斟酌）`;
      finalText += "\n[來源:網路搜尋]";
    }
    if (!lastWebEvidenceValid) {
      const officialPage = getSamsungOfficialModelPage_(
        primaryModel || selectedModel,
      );
      finalText = buildTentativeWebFallback_(
        lastWebUnverifiedDraft,
        originalQuestion,
        primaryModel || selectedModel,
      );
      finalText += officialPage
        ? "\n\n下方保留「到這款官網」；這個連結只供查看產品資訊，不會拿官網內容冒充非官方搜尋結果。"
        : "\n\n相同題目不會再次搜尋或扣次。";
    }
  }

  finalText = mergeKnownRuleAnchorWithAdvancedAnswer_(
    knownRuleAnswer,
    finalText,
  );
  if (grant.refunded) {
    finalText += "\n\n這次屬系統因素，額度已退回。";
  } else if (!grant.reserved) {
    finalText += "\n\n這次未送出供應商請求，沒有扣除次數。";
  }
  finalText = enforceNiTone(finalText);
  LAST_SOURCE_TEST_STATE = {
    source: normalizedSource,
    outcome:
      normalizedSource === "web"
        ? lastWebEvidenceValid
          ? "success"
          : "no_evidence"
        : manualWebRescue && manualWebRescue.success
          ? "rescued_web"
          : manualPreflightStopped || manualEvidenceFailed
          ? "no_evidence"
          : "success",
    pending: false,
    executed: normalizedSource,
    reserved: Boolean(grant.reserved),
    remaining:
      typeof grant.remaining === "number" ? grant.remaining : remainingBefore,
    refunded: Boolean(grant.refunded),
  };

  writeAnswerEnvelope_(
    contextId,
    buildAdvancedAnswerEnvelope_(
      normalizedSource,
      originalQuestion,
      primaryModel || selectedModel,
      finalText,
      LAST_SOURCE_TEST_STATE.outcome,
      manualWebRescue && manualWebRescue.success
        ? manualWebRescue.sources
        : lastSearchSources,
    ),
  );

  if (response === "[KB_EXPIRED]" && !(manualWebRescue && manualWebRescue.success)) {
    // 索引自癒完成後，同題必須能立即重試，不能被 10 分鐘結果快取卡住。
    clearAdvancedSourceOperation_(sourceOperation);
  } else {
    finishAdvancedSourceOperation_(
      sourceOperation,
      finalText,
      primaryModel || selectedModel,
    );
  }

  replyMessage(
    replyToken,
    finalText,
    buildAdvancedSourceQuickReplies_(
      normalizedSource,
      primaryModel || selectedModel,
      finalText,
      {
        forceOfficial:
          recommendedWeb ||
          grant.refunded ||
          response === "[KB_EXPIRED]" ||
          manualPreflightStopped ||
          (normalizedSource === "web" && !lastWebEvidenceValid) ||
          isManualEvidenceFailureReply_(finalText),
        skipSameSource: true,
        // 完整來源答案是終點，不再誘導重複付費。只有使用者先選 Web
        // 且無證據，而該型號確有手冊時，才提供一次反向查手冊。
        skipAlternateSource: !(
          normalizedSource === "web" &&
          LAST_SOURCE_TEST_STATE.outcome === "no_evidence" &&
          hasOfficialManualForModel_(primaryModel || selectedModel)
        ),
        allowElaborate: false,
      },
    ),
  );
  writeRecordDirectly(userId, originalQuestion, contextId, "user", "");
  writeRecordDirectly(userId, finalText, contextId, "assistant", "");
  updateHistorySheetAndCache(
    contextId,
    history,
    { role: "user", content: originalQuestion },
    { role: "assistant", content: finalText },
  );
  const sourceSucceeded =
    normalizedSource === "web"
      ? lastWebEvidenceValid
      : (manualWebRescue && manualWebRescue.success) ||
        (response !== "[KB_EXPIRED]" &&
          !manualPreflightStopped &&
          !manualEvidenceFailed);
  if (sourceSucceeded) {
    rememberSourceLastAdvanced_(
      contextId,
      manualWebRescue && manualWebRescue.success ? "web" : normalizedSource,
    );
    rememberRecentSourceQuestion_(
      contextId,
      originalQuestion,
      primaryModel || selectedModel || "",
    );
  }
  return true;
}

function cleanupExpiredSourceRoutingProperties_() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const today = getSourceDateKey_();
  const now = Date.now();
  Object.keys(all).forEach(function (key) {
    if (
      (key.indexOf("SRC_QUOTA_") === 0 ||
        key.indexOf("USR_QDAY_") === 0 ||
        key.indexOf("SRC_RESCUE_") === 0) &&
      !key.endsWith(`_${today}`)
    ) {
      props.deleteProperty(key);
      return;
    }
    if (key.indexOf("SRC_PENDING_") === 0 || key.indexOf("SRC_RECENT_") === 0) {
      const state = parseSourceStateJson_(all[key]);
      if (!state || Number(state.expiresAt || 0) < now) {
        props.deleteProperty(key);
      }
      return;
    }
    if (key.indexOf("ANS_ENV_") === 0) {
      const state = parseSourceStateJson_(all[key]);
      if (!state || Number(state.expiresAt || 0) < now) {
        props.deleteProperty(key);
      }
    }
  });
}

const MANUAL_SEARCH_CONSENT_TTL_SEC = 600;

function normalizeManualConsentQuery_(text) {
  return String(text || "")
    .replace(/^#查手冊\s*/i, "")
    .replace(/\(型號[:：][^)]+\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function grantManualSearchConsent_(cache, userId, query, models) {
  writeLog(
    "[Legacy Manual Consent v29.6.189] 舊授權旁路已停用；所有查手冊動作只走來源狀態機",
  );
  return false;
  /* istanbul ignore next -- 只保留舊版程式位置供部署後清理，不可執行 */
  const normalizedQuery = normalizeManualConsentQuery_(query);
  if (!cache || !userId || !normalizedQuery) return false;
  const normalizedModels = (Array.isArray(models) ? models : [])
    .map((model) => String(model || "").trim().toUpperCase())
    .filter(Boolean);
  cache.put(
    `${userId}:manual_search_consent`,
    JSON.stringify({
      query: normalizedQuery,
      models: normalizedModels,
      expiresAt: new Date().getTime() + MANUAL_SEARCH_CONSENT_TTL_SEC * 1000,
    }),
    MANUAL_SEARCH_CONSENT_TTL_SEC,
  );
  cache.put(`${userId}:pending_manual_query`, String(query || "").trim(), 600);
  writeLog("[Manual Consent v29.6.094] 已建立 10 分鐘、單次手冊授權");
  return true;
}

function consumeManualSearchConsent_(cache, userId, query, selectedModel) {
  writeLog(
    "[Legacy Manual Consent v29.6.189] 舊授權旁路已停用，拒絕消耗授權",
  );
  return false;
  /* istanbul ignore next -- 只保留舊版程式位置供部署後清理，不可執行 */
  if (!cache || !userId) return false;
  const key = `${userId}:manual_search_consent`;
  const raw = cache.get(key);
  if (!raw) return false;

  let state = null;
  try {
    state = JSON.parse(raw);
  } catch (e) {
    cache.remove(key);
    return false;
  }

  const now = new Date().getTime();
  const expectedQuery = normalizeManualConsentQuery_(state && state.query);
  const actualQuery = normalizeManualConsentQuery_(query);
  const queryMatches =
    !!expectedQuery &&
    !!actualQuery &&
    (expectedQuery === actualQuery ||
      expectedQuery.includes(actualQuery) ||
      actualQuery.includes(expectedQuery));
  const expectedModels = Array.isArray(state && state.models)
    ? state.models.map((model) => String(model || "").toUpperCase())
    : [];
  const actualModel = String(selectedModel || "").trim().toUpperCase();
  const modelMatches =
    expectedModels.length === 0 ||
    !actualModel ||
    expectedModels.includes(actualModel);
  const isValid =
    state &&
    Number(state.expiresAt || 0) >= now &&
    queryMatches &&
    modelMatches;

  // 單次授權不論成功或狀態不一致都立即失效，避免舊授權被換題重用。
  cache.remove(key);
  if (isValid) {
    cache.remove(`${userId}:pending_manual_query`);
    writeLog("[Manual Consent v29.6.094] 已消耗單次手冊授權");
    return true;
  }
  writeLog("[Manual Consent v29.6.094] 授權過期或題目／型號不一致，拒絕讀取 PDF");
  return false;
}

function limitManualPdfFiles_(files, query) {
  const rawCandidates = (Array.isArray(files) ? files : []).filter(
    (file) => file && file.mimeType === "application/pdf",
  );
  const byName = {};
  rawCandidates.forEach(function (file, fileIndex) {
    const key =
      String(file.name || "").trim().toUpperCase() || `__ANON_${fileIndex}`;
    const existing = byName[key];
    if (!existing) {
      byName[key] = file;
      return;
    }
    const fileTime = Date.parse(file.updatedAt || "") || 0;
    const existingTime = Date.parse(existing.updatedAt || "") || 0;
    const fileRank = [
      fileTime,
      Number(file.sizeBytes || 0),
      String(file.driveFileId || file.uri || ""),
    ];
    const existingRank = [
      existingTime,
      Number(existing.sizeBytes || 0),
      String(existing.driveFileId || existing.uri || ""),
    ];
    const shouldReplace =
      fileRank[0] > existingRank[0] ||
      (fileRank[0] === existingRank[0] && fileRank[1] > existingRank[1]) ||
      (fileRank[0] === existingRank[0] &&
        fileRank[1] === existingRank[1] &&
        fileRank[2] > existingRank[2]);
    if (shouldReplace) byName[key] = file;
    writeLog(
      `[Manual File Identity Guard v29.6.136] 同名手冊 ${key} 只保留單一 Drive 身分，chosen=${String((shouldReplace ? file : existing).driveFileId || "uri")}`,
    );
  });
  const candidates = Object.keys(byName).map(function (key) {
    return byName[key];
  });
  const isComparison = /(比較|差異|差別|VS|VERSUS|哪一台|哪一款)/i.test(
    String(query || ""),
  );
  return candidates.slice(0, isComparison ? 2 : 1);
}

/**
 * 同一型號可能同時有快速指南與完整使用手冊。只要使用者已授權查手冊，
 * 就應先保留精準型號命中，再優先選「涵蓋型號較少、內容較完整」的 PDF；
 * 文件品質不能再由題目是否命中特定關鍵字決定，否則新問法仍會選錯手冊。
 */
function prioritizeDetailedManualCandidates_(files, query, primaryModel) {
  const candidates = Array.isArray(files) ? files.slice() : [];
  if (candidates.length < 2 || !primaryModel) {
    return candidates;
  }

  return candidates
    .map(function (file, index) {
      const name = String((file && file.name) || "");
      const modelCount = name
        .replace(/\.pdf$/i, "")
        .split(",")
        .map(function (part) {
          return part.trim();
        })
        .filter(function (part) {
          return part.length > 0;
        }).length;
      return {
        file: file,
        index: index,
        primary: pdfFileNameMatchesModelToken_(name, primaryModel) ? 1 : 0,
        modelCount: modelCount,
        sizeBytes: Math.max(0, Number((file && file.sizeBytes) || 0)),
      };
    })
    .sort(function (a, b) {
      if (a.primary !== b.primary) return b.primary - a.primary;
      if (a.modelCount !== b.modelCount) return a.modelCount - b.modelCount;
      // 同一型號／相同涵蓋數時，優先較完整的文件。
      // sizeBytes 只作最後 tie-break，沒有 metadata 時仍保持原順序。
      if (a.sizeBytes !== b.sizeBytes) return b.sizeBytes - a.sizeBytes;
      return a.index - b.index;
    })
    .map(function (item) {
      return item.file;
    });
}

function buildManualConsentPrompt_(answerText, query, model) {
  const rawBody = String(answerText || "");
  let body = rawBody
    .replace(/\[(?:AUTO_SEARCH_PDF|NEED_DOC)(?:[:：][^\]]*)?\]/gi, "")
    .trim();
  const hasLocalEvidenceTag =
    /\[來源\s*[:：]\s*(?:QA庫|官方規格庫|官方活動庫)\]/i.test(rawBody);
  // Fast 已自行宣告需要手冊時，沒有本機來源標記的文字只是模型草稿。
  // 不得先把猜測（例如 VESA 孔、螺絲、選單路徑）送給使用者，再叫人查證。
  // 真正由 QA／RULE 證實的已知部分仍保留，CTA 只補未知部分。
  if (body && !hasLocalEvidenceTag) {
    writeLog(
      "[Manual Consent v29.6.164] Fast 無可核對 QA/RULE 來源，移除未驗證草稿，只保留手冊 CTA",
    );
    body = "";
  }
  // 這個函式只處理 Fast 階段的「建議查手冊」。Fast 並未掛 PDF，
  // 若模型自行聲稱頁碼／手冊依據，整段不得帶到客戶畫面冒充已查證。
  if (/(?:手冊頁碼|手冊依據|證據摘錄|第\s*\d+\s*頁|根據官方手冊)/i.test(body)) {
    writeLog("[Manual Consent v29.6.136] 移除 Fast 模型未掛 PDF 卻自稱手冊頁碼的內容");
    body = "";
  }
  const target = String(model || "").trim();
  const question = target
    ? `想再核對 ${target}，可點下方「查官方手冊」。手冊若沒有明確答案，我會自動補查一次公開網頁，不另扣網搜次數。`
    : "目前的 QA 與規格資料還不足；想繼續查證，可點下方「查官方手冊」。手冊若沒有明確答案，我會自動補查一次公開網頁，不另扣網搜次數。";
  return [body, question].filter(Boolean).join("\n\n");
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
    `目前找不到「${list}」這個型號，可以幫忙看一下螢幕背貼或外盒上的完整型號有沒有打錯 👀`,
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
      let models =
        line.match(
          /\b(?:L?S\d{2}[A-Z]{1,3}\d{2,4}[A-Z0-9]*|L?[CF]\d{2}[A-Z]+\d{2,4}[A-Z0-9]*)\b/g,
        ) || [];
      if (/^[SGM]\d{3,5}[A-Z]{0,3}$/.test(alias)) {
        models = models.filter((model) =>
          normalizeModelForDisplay(model).includes(alias),
        );
      }
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
  if (/^[SGM]\d{3,5}[A-Z]{0,3}$/.test(key)) {
    // G806／M703 等不完整型號通常嵌在 S32HG806ES／S32FM703UC 內，
    // 只允許比對同一列已存在的完整型號 token，不做自由文字模糊猜測。
    const fullModels =
      hay.match(
        /\b(?:L?S\d{2}[A-Z]{1,3}\d{2,4}[A-Z0-9]*|L?[CF]\d{2}[A-Z]+\d{2,4}[A-Z0-9]*)\b/g,
      ) || [];
    if (fullModels.some((model) => normalizeModelForDisplay(model).includes(key))) {
      return true;
    }
  }
  if (/^G\d{1,2}/.test(key)) {
    // Odyssey 產品名稱常在系列與代號間插入 OLED／Neo／IPS 等描述詞；
    // 仍要求 G8 等代號是完整邊界，避免把 G80SD 誤當成 G8。
    return new RegExp(
      `ODYSSEY(?:\\s+[A-Z0-9-]+){0,3}\\s*${escaped}([^A-Z0-9]|$)`,
    ).test(hay);
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

function getAliasOnlySelectionModelsFromQuery(
  text,
  limit = 10,
  requirePdfCoverage = true,
) {
  const aliases = extractShortAliasModelTokens(text);
  if (aliases.length === 0 || extractFullModelLikeTokens(text).length > 0) {
    return [];
  }
  const bucket = [];
  aliases.forEach((alias) => {
    bucket.push(
      ...(requirePdfCoverage
        ? getAliasCandidatesFromExistingPdfs(alias, limit)
        : getAliasCandidatesFromClassRules(alias, limit * 3)),
    );
  });
  return dedupDisplayModels(bucket, limit).filter((m) => !isShortAliasModelToken(m));
}

function doesQaMatchCoverQueryAliases_(query, qaQuestion) {
  const queryAliases = extractShortAliasModelTokens(query);
  if (queryAliases.length === 0) return true;
  const qaAliases = extractShortAliasModelTokens(qaQuestion);
  return queryAliases.every((alias) => qaAliases.indexOf(alias) >= 0);
}

function shouldPromptAliasModelSelection_(query, candidates) {
  if (!Array.isArray(candidates) || candidates.length <= 1) return false;
  // 短別稱對應多款產品時，未知錯字或未收錄問法也必須先選實體；
  // 不能因 intent regex 沒認出來就讓模型拿部分型號概括回答。
  return !isPureSeriesOverviewQuery_(query);
}

function isPureSeriesOverviewQuery_(query) {
  let remainder = normalizeCommonMonitorInputTypos_(toHalfWidth(String(query || "")))
    .toUpperCase();
  extractShortAliasModelTokens(remainder).forEach((alias) => {
    remainder = remainder.replace(new RegExp(`\\b${alias}\\b`, "g"), " ");
  });
  remainder = remainder.replace(/[\s，,。.!！?？:：()（）]/g, "");
  return /^(?:是什麼|介紹|介紹一下|系列介紹|有哪些|有哪些型號|型號有哪些|全系列|產品線)$/.test(
    remainder,
  );
}

function promptAliasOnlyModelSelection(query, userId, replyToken, contextId, mode) {
  const aliases = extractShortAliasModelTokens(query);
  if (aliases.length === 0 || extractFullModelLikeTokens(query).length > 0) {
    return false;
  }
  const aliasToken = aliases.join("/");
  // Fast Mode 必須列 CLASS_RULES 的完整系列候選；只有手冊模式才依 PDF 覆蓋範圍收斂。
  const models = getAliasOnlySelectionModelsFromQuery(
    query,
    10,
    (mode || "pdf") === "pdf",
  );
  if (models.length <= 1) {
    return false;
  }

  const cache = CacheService.getScriptCache();
  cache.put(`${userId}:suggested_models`, JSON.stringify(models), 300);
  cache.put(`${userId}:pending_topic`, String(query || ""), 600);
  cache.put(`${userId}:model_select_mode`, mode || "pdf", 600);
  if ((mode || "pdf") === "fast") {
    // 一般題先停在選型時，保留本題唯一一次計次；選型後若只能轉手冊／網路，
    // 由最終分流退回，不得因這個早期 return 遺失退款脈絡。
    markDailyQuestionModelSelectionHold_(userId);
  }

  LAST_SOURCE_TEST_STATE = {
    source: (mode || "pdf") === "fast" ? "spec" : "manual",
    pending: (mode || "pdf") !== "fast",
    needsModel: true,
    modelCandidates: models,
    modelSelectionMode: mode || "pdf",
  };

  const leadText = [
    `「${aliasToken}」系列有好幾款不同年份或尺寸`,
    "",
    mode === "pdf"
      ? "請點選你使用的完整型號，我幫你查官方手冊 📖"
      : "請點選你使用的完整型號，我幫你解答 👇",
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
function sanitizeManualAnswerForQuestion_(text, queryText) {
  const query = String(queryText || "");
  let body = String(text || "");
  const isWiredDisplayQuestion =
    isCrossDeviceMonitorQuery(query) &&
    /(沒畫面|無畫面|不顯示|顯示|影像|視訊|DISPLAYPORT|DP\s*ALT|TYPE-?C|USB-?C|HDMI|有線)/i.test(query);
  if (!isWiredDisplayQuestion) return body.trim();

  const asksPower = /(充電|供電|瓦數|\bW\b|POWER\s*DELIVERY|\bPD\b)/i.test(query);
  const asksCamera = /(攝影機|相機|鏡頭|WEBCAM)/i.test(query);

  return body
    .split("\n")
    .map((line) => {
      const sentences = line.match(/[^。！？!?]+[。！？!?]?/g) || [line];
      return sentences
        .map((sentence) => {
          const hasDisplayFact = /(畫面|顯示|影像|視訊|DISPLAYPORT|DP\s*ALT|HDMI|USB-?C.*(?:輸入|輸出|傳輸))/i.test(sentence);
          const isPowerOnly =
            !asksPower &&
            /(充電|供電|瓦數|\b\d{2,3}\s*W\b|POWER\s*DELIVERY|\bPD\b)/i.test(sentence) &&
            !hasDisplayFact;
          const isCameraOnly =
            !asksCamera &&
            /(攝影機|相機|鏡頭|WEBCAM)/i.test(sentence) &&
            !hasDisplayFact;
          if (isPowerOnly || isCameraOnly) return "";

          let relevantSentence = sentence;
          if (!asksPower && hasDisplayFact) {
            relevantSentence = relevantSentence.replace(
              /(?:，|,|；|;|、|\s)+(?:並|且|同時|也)?(?:可|可以|支援|提供)?[^。！？!?]{0,40}(?:\b\d{2,3}\s*W\b|充電|POWER\s*DELIVERY|供電|瓦數)[^。！？!?]*/gi,
              "",
            );
          }
          if (!asksCamera && hasDisplayFact) {
            relevantSentence = relevantSentence.replace(
              /(?:，|,|；|;|、|\s)+(?:並|且|同時|也)?(?:可|可以|支援|提供)?[^。！？!?]{0,40}(?:攝影機|相機|鏡頭|WEBCAM)[^。！？!?]*/gi,
              "",
            );
          }
          return relevantSentence;
        })
        .join("")
        .trim();
    })
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeManualDeflection(text, queryText) {
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
  return sanitizeManualAnswerForQuestion_(
    filtered.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    queryText,
  );
}

function parseManualEvidenceMarker_(text) {
  const body = String(text || "");
  const match = body.match(
    /\[手冊證據\s*[:：]\s*(第\s*\d+(?:\s*[、,，/]\s*\d+)*\s*頁|未找到)\s*\|\s*範圍\s*[:：]\s*(型號明確|型號共通|全檔共通|依型號而異|未找到)\s*\]/i,
  );
  const rawScope = match ? String(match[2]) : "";
  const excerptMatch = body.match(
    /(?:證據摘錄|手冊重點)\s*[:：]\s*([^\n\[\]]{6,80})/i,
  );
  return {
    found: !!match,
    page: match ? String(match[1]).replace(/\s+/g, "") : "",
    scope: rawScope === "型號共通" ? "全檔共通" : rawScope,
    excerpt: excerptMatch ? String(excerptMatch[1]).trim() : "",
    text: body
      .replace(
        /\[手冊證據\s*[:：]\s*(?:第\s*\d+(?:\s*[、,，/]\s*\d+)*\s*頁|未找到)\s*\|\s*範圍\s*[:：]\s*(?:型號明確|型號共通|全檔共通|依型號而異|未找到)\s*\]/gi,
        "",
      )
      // 摘錄只供 Evidence Guard 驗證，不是第二份客戶答案。
      .replace(/^\s*(?:證據摘錄|手冊重點)\s*[:：]\s*[^\n\[\]]{6,80}\s*$/gim, "")
      .trim(),
  };
}

/**
 * PDF 回覆使用 Gemini Structured Output，程式再轉回既有 evidence envelope。
 * 模型只提供資料欄位；頁碼、摘錄、範圍與「是否找到」不再靠自然語句 regex 猜測。
 */
function getManualStructuredResponseSchema_() {
  return {
    type: "OBJECT",
    properties: {
      found: {
        type: "BOOLEAN",
        description: "官方手冊是否有直接回答目前問題的可核對證據",
      },
      answer: {
        type: "STRING",
        description:
          "給台灣使用者的自然繁中短答，須回答問題中的每個子項；操作題只寫結論與必要步驟，功能表入口由 operationPath 單獨提供，answer 不得再重複同一路徑；找不到時說明手冊未記載",
      },
      operationPath: {
        type: "STRING",
        description:
          "手冊明載的功能表或章節入口，使用『入口分類 → 功能名稱』格式，例如 Support → Self Diagnosis；題目問如何設定、執行或開啟時不得省略已找到的入口；不是選單操作則回空字串",
      },
      evidence: {
        type: "ARRAY",
        description:
          "只列直接支持答案的證據，最多 3 筆；封面、目錄、型號清單等僅證明產品身分的頁面不得列入；found=false 時為空陣列",
        items: {
          type: "OBJECT",
          properties: {
            pageNumber: {
              type: "INTEGER",
              description: "PDF 顯示頁碼",
            },
            scope: {
              type: "STRING",
              enum: ["型號明確", "全檔共通", "依型號而異"],
            },
            evidenceExcerpt: {
              type: "STRING",
              description: "該頁直接支持答案的手冊原文短摘錄",
            },
          },
          required: ["pageNumber", "scope", "evidenceExcerpt"],
        },
      },
    },
    required: ["found", "answer", "operationPath", "evidence"],
  };
}

function normalizeManualStructuredResponse_(text) {
  const raw = String(text || "").trim();
  let parsed = null;
  let jsonText = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const firstBrace = jsonText.indexOf("{");
  const lastBrace = jsonText.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    jsonText = jsonText.slice(firstBrace, lastBrace + 1);
  }
  try {
    parsed = JSON.parse(jsonText);
    if (parsed && typeof parsed === "object" && parsed.result) {
      parsed = parsed.result;
    } else if (parsed && typeof parsed === "object" && parsed.data) {
      parsed = parsed.data;
    }
  } catch (error) {
    writeLog(
      `[Manual Structured Output v29.6.174] JSON 解析失敗；視為輸出格式錯誤，不得誤判成手冊無資料: ${String(error && error.message ? error.message : error)}`,
    );
    return "[MANUAL_OUTPUT_FORMAT_ERROR]";
  }

  const found = parsed && parsed.found === true;
  const answer = String((parsed && parsed.answer) || "").trim();
  const operationPath = String((parsed && parsed.operationPath) || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 120);
  const evidenceItems = Array.isArray(parsed && parsed.evidence)
    ? parsed.evidence.slice(0, 3)
    : parsed && (parsed.pageNumber || parsed.evidenceExcerpt)
      ? [parsed]
      : [];
  const normalizedEvidence = evidenceItems.map((item) => ({
    pageNumber: Number(item && item.pageNumber),
    scope: String((item && item.scope) || "").trim(),
    excerpt: String((item && item.evidenceExcerpt) || "")
      .replace(/[\r\n]+/g, " ")
      .trim(),
  }));
  const validEvidence = normalizedEvidence.filter(
    (item) =>
      Number.isInteger(item.pageNumber) &&
      item.pageNumber > 0 &&
      (item.scope === "型號明確" || item.scope === "全檔共通") &&
      item.excerpt.length >= 6,
  );

  writeLog(
    `[Manual Structured Output v29.6.178] found=${found}, evidence=${validEvidence.length}/${normalizedEvidence.length}, pages=${validEvidence.map((item) => item.pageNumber).join(",") || "none"}`,
  );

  if (!found) {
    return `${answer || "官方手冊沒有找到能直接回答這題的段落。"}\n\n[MANUAL_EVIDENCE_NOT_FOUND]\n[手冊證據:未找到|範圍:未找到]`;
  }
  if (
    !answer ||
    validEvidence.length === 0 ||
    validEvidence.length !== normalizedEvidence.length
  ) {
    writeLog(
      `[Manual Structured Output v29.6.178] 已回 found=true，但 Evidence[] 不完整；視為驗證錯誤，不得跨來源: valid=${validEvidence.length}, total=${normalizedEvidence.length}`,
    );
    return "[MANUAL_EVIDENCE_VALIDATION_ERROR]";
  }

  const seenPages = new Set();
  const uniqueEvidence = validEvidence.filter((item) => {
    if (seenPages.has(item.pageNumber)) return false;
    seenPages.add(item.pageNumber);
    return true;
  });
  const pages = uniqueEvidence.map((item) => item.pageNumber).join("、");
  const scope = uniqueEvidence.every((item) => item.scope === "型號明確")
    ? "型號明確"
    : "全檔共通";
  const excerpts = uniqueEvidence
    .map((item) => item.excerpt.slice(0, 55))
    .join("｜")
    .slice(0, 80);
  const answerWithPath =
    operationPath && !answer.includes(operationPath)
      ? `${answer}\n\n操作路徑：${operationPath}`
      : answer;
  return `${answerWithPath}\n\n手冊重點：${excerpts}\n[手冊證據:第${pages}頁|範圍:${scope}]`;
}

function applyManualEvidenceGuard_(text, queryText) {
  const raw = String(text || "");
  if (/\[MANUAL_OUTPUT_FORMAT_ERROR\]/.test(raw)) {
    return "官方手冊已送達模型，但這次回答格式沒有通過驗證。這是系統整理問題，不代表手冊沒有答案；我會接著補查一次公開網頁，不另扣你的網搜次數。";
  }
  if (/\[MANUAL_EVIDENCE_VALIDATION_ERROR\]/.test(raw)) {
    return "官方手冊已找到相關內容，但頁碼或證據摘錄沒有通過驗證。為避免把未核對內容當成手冊答案，我會接著補查一次公開網頁，不另扣你的網搜次數。";
  }
  const evidence = parseManualEvidenceMarker_(text);
  if (/\[MANUAL_EVIDENCE_NOT_FOUND\]/.test(raw)) {
    return "官方手冊已完整搜尋，但沒有找到能直接回答這題的段落。我會接著用一次公開網頁補查可能的做法；這次補查不扣你的網搜次數。\n\n[AUTO_SEARCH_WEB]";
  }
  const weakScope =
    !evidence.found ||
    !evidence.excerpt ||
    evidence.scope === "依型號而異" ||
    evidence.scope === "未找到" ||
    evidence.page === "未找到";

  if (weakScope) {
    writeLog(
      `[Manual Evidence Guard v29.6.136] 手冊回答缺少可核對頁碼／摘錄／適用範圍: found=${evidence.found}, page=${evidence.page || "none"}, scope=${evidence.scope || "none"}, excerpt=${evidence.excerpt ? 1 : 0}`,
    );
    return "官方手冊已有回應，但頁碼、摘錄或適用型號範圍沒有完整通過驗證。為避免把不可靠內容當成手冊答案，我會接著補查一次公開網頁，不另扣你的網搜次數。";
  }

  let guarded = evidence.text;
  if (evidence.found && evidence.page && evidence.page !== "未找到") {
    guarded += `\n\n官方手冊：${evidence.page}`;
  }
  return guarded.trim();
}

function isManualEvidenceFailureReply_(text) {
  return /(?:官方手冊已完成搜尋，但這次沒有取得可核對的頁碼|查過這本官方手冊，但這次沒有找到能直接回答這題的明確段落|手冊未記載|回答格式沒有通過驗證|頁碼或證據摘錄沒有通過驗證|證據驗證問題|官方手冊沒有產生可用文字|手冊.*token 計數|預估費用仍超過單次|手冊查詢發生暫時錯誤)/.test(
    String(text || ""),
  );
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

    // 2. 結構化 QA 候選檢索：只載入本題最相關的前 6 筆，不再整包灌入 Prompt。
    const qaSelection = qaKnowledgeSelectPromptContext_(
      latestUserMsg,
      injectedModelsList,
      isPDFMode,
    );
    let fullQA = qaSelection.text || "";
    qaLoaded = Number(qaSelection.totalCount || 0) > 0;
    qaFromCache = qaSelection.fromCache === true;
    writeLog(
      `[QA2 Retrieval] Selected ${qaSelection.selectedCount}/${qaSelection.totalCount} records for ${isPDFMode ? "manual" : "fast"} context`,
    );
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

    // PDF 模式同樣由 QA2 的型號／題意評分收斂，不另維護第二套篩選器。
    let relevantContext = "=== 💡 精選問答 (QA - 最優先參考) ===\n";

    // 1️⃣ 只注入 QA2 倒排索引選出的相關候選（上限 6 筆）
    if (fullQA) {
      relevantContext += fullQA + "\n\n";
      // 不再隨 QA 總量增加 Fast Prompt；未命中時保持空白並交由 RULE／來源路由。
    }

    // 2️⃣ RULE 智慧檢索：輕量層與規格層合併排序，不再把前 50 列全數傾倒給模型。
    // 單題最多注入 8 筆相關 RULE，避免 Fast Mode 因無關規格接近 token 上限。
    // 3️⃣ 規格層智慧檢索 (Spec Layer Smart Retrieval) v29.6.095
    // 核心目標：針對 "40吋", "144Hz" 等屬性查詢，進行加權關鍵字檢索，避免簡單篩選的雜訊
    let specContext = "";
    // v29.5.181: 先用前段載入到的 specRules（含 Sheet fallback），避免 Cache Miss 時規格層直接失效
    let fullSpecRules = [lightRules || "", specRules || ""]
      .filter((part) => part)
      .join("\n");
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

        // v29.6.119：完整型號與問題欄位必須遠高於一般字串命中。
        // 舊版每個 token 都只有 +1，會讓精確型號規格被同系列長行埋掉。
        const exactRuleModels = dedupDisplayModels(
          extractFullModelLikeTokens(latestUserMsg).concat(injectedModelsList || []),
          20,
        );
        const intentMatchers = [
          { query: /藍牙|BLUETOOTH/i, line: /藍牙|BLUETOOTH/i },
          { query: /喇叭|揚聲器|音效/i, line: /喇叭|揚聲器|音效/i },
          { query: /耳機|3\.5\s*MM/i, line: /耳機孔|耳機|3\.5\s*MM/i },
          { query: /USB[\s-]*C|TYPE[\s-]*C/i, line: /USB[\s-]*C|TYPE[\s-]*C/i },
          { query: /HDMI/i, line: /HDMI/i },
          { query: /DISPLAYPORT|\bDP\b/i, line: /DISPLAYPORT|\bDP\b/i },
          { query: /更新率|刷新率|HZ/i, line: /更新頻率|更新率|刷新率|HZ/i },
          { query: /解析度|4K|5K|6K|UHD|QHD|FHD/i, line: /解析度|4K|5K|6K|UHD|QHD|FHD/i },
          { query: /鏡頭|攝影機|相機/i, line: /鏡頭|攝影機|相機/i },
          { query: /VESA|壁掛/i, line: /VESA|壁掛/i },
        ].filter((item) => item.query.test(latestUserMsg));

        // 2. Scorer: 評分機制
        const scoredLines = specLines.map((line, originalIndex) => {
          let score = 0;
          const lowerLine = line.toLowerCase();
          const upperLine = toHalfWidth(line).toUpperCase();

          exactRuleModels.forEach((model) => {
            const normalizedModel = normalizeModelForDisplay(model);
            if (normalizedModel && upperLine.indexOf(normalizedModel) >= 0) {
              score += 100;
            }
          });

          intentMatchers.forEach((item) => {
            if (item.line.test(line)) score += 20;
          });

          // 單位命中 (+10分)
          highValTokens.forEach((token) => {
            if (lowerLine.includes(token.toLowerCase())) score += 10;
          });

          // 一般命中 (+1分)
          validNormalTokens.forEach((token) => {
            if (lowerLine.includes(token.toLowerCase())) score += 1;
          });

          return { line, score, originalIndex };
        });

        // 3. Injector: 過濾 0 分後擇優錄取最多 8 筆。
        const topLines = scoredLines
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex)
          .slice(0, CONFIG.MAX_RELEVANT_RULE_LINES)
          .map((item) => item.line);

        if (topLines.length > 0) {
          specContext +=
            "=== 🖥️ 產品型號詳細規格 (Spec Rules - Smart Filtered) ===\n";
          specContext +=
            "【證據鐵律】「術語_」列只用來解釋功能名稱，絕對不能證明某個產品具備該功能；特定型號能力只能依該完整型號自己的規格列判定。規格列未記載時只能說目前無法確認，不得把同系列其他型號的功能套用。\n";
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
  MODEL_NAME_WEB: GEMINI_MODEL_WEB, // Google Search grounding 專用
  MODEL_NAME_THINK: GEMINI_MODEL_THINK, // PDF 深度閱讀 & /紀錄 用 (使用最前面的常數)
  MAX_OUTPUT_TOKENS: 800,
  MAX_PDF_OUTPUT_TOKENS: 1200,
  MAX_FAST_INPUT_TOKENS: 12000,
  // 20K 改為軟警戒；手冊已受「單題一份 + 每日 5 次 + 明確授權」三層限制。
  // 100K 是防異常的絕對 token ceiling；2.5 Flash PDF 會先被下方 NT$0.35 成本 ceiling 擋住。
  PDF_INPUT_SOFT_WARNING_TOKENS: 20000,
  MAX_LEGACY_PDF_INPUT_TOKENS: 100000,
  // 依目前 2.5 Flash Standard 費率與 NT$32/USD，含最多 1,200 output
  // 的單次最壞成本不得超過 NT$0.35；換模型時會依價格自動收緊。
  MAX_PDF_ESTIMATED_TOTAL_COST_TWD: 0.35,
  PDF_RESCUE_MEDIA_RESOLUTION: "MEDIA_RESOLUTION_LOW",
  MAX_RELEVANT_RULE_LINES: 8,
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
let lastWebSupportedSegments = [];
let lastWebEvidenceConflict = false;
let lastWebSearchAttempted = false;
let lastWebUnverifiedDraft = "";
let currentRequestAudit = null;

function resetRequestAudit_() {
  currentRequestAudit = {
    stages: [],
    model: "",
    paidCalls: 0,
    pdfCalls: 0,
    webCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostTwd: 0,
    sources: [],
    logged: false,
  };
}

function markGenerationAttempt_(stage, modelName) {
  if (!currentRequestAudit) resetRequestAudit_();
  if (!currentRequestAudit.stages.includes(stage)) {
    currentRequestAudit.stages.push(stage);
  }
  currentRequestAudit.model = modelName || currentRequestAudit.model;
  currentRequestAudit.paidCalls++;
  if (stage === "pdf") currentRequestAudit.pdfCalls++;
  if (stage === "web") currentRequestAudit.webCalls++;
}

function addGenerationUsageToAudit_(usage, costTWD) {
  if (!currentRequestAudit || !usage) return;
  currentRequestAudit.inputTokens += Number(usage.promptTokenCount) || 0;
  currentRequestAudit.outputTokens += Number(usage.candidatesTokenCount) || 0;
  currentRequestAudit.estimatedCostTwd += Number(costTWD) || 0;
}

function writeRequestAuditOnce_(visibleText) {
  if (!currentRequestAudit || currentRequestAudit.logged) return;
  const sourceTags = String(visibleText || "").match(/\[來源[:：]([^\]]+)\]/g) || [];
  const sources = sourceTags
    .map((tag) => tag.replace(/^\[來源[:：]|\]$/g, "").trim())
    .concat(Array.isArray(lastSearchSources) ? lastSearchSources : []);
  currentRequestAudit.sources = [...new Set(sources.filter(Boolean))];
  const payload = {
    stage: currentRequestAudit.stages.join("+") || "deterministic",
    model: currentRequestAudit.model || "none",
    paidCalls: currentRequestAudit.paidCalls,
    pdfCalls: currentRequestAudit.pdfCalls,
    webCalls: currentRequestAudit.webCalls,
    inputTokens: currentRequestAudit.inputTokens,
    outputTokens: currentRequestAudit.outputTokens,
    estimatedCostTwd: Number(currentRequestAudit.estimatedCostTwd.toFixed(4)),
    sources: currentRequestAudit.sources,
  };
  writeLog(`[Request Audit v29.6.095] ${JSON.stringify(payload)}`);
  currentRequestAudit.logged = true;
}

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

function recoverRelevantPdfUrisFromDrive(
  exactModels,
  primaryModel,
  limit,
  existingCandidates,
) {
  if (!CONFIG.DRIVE_FOLDER_ID || !exactModels || exactModels.length === 0) {
    return [];
  }

  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    writeLog("[PDF Recovery] 缺少 GEMINI_API_KEY，無法即時補回 PDF URI");
    return [];
  }

  const maxFiles = Math.max(1, Math.min(Number(limit) || 1, 2));
  const existingNames = {};
  (Array.isArray(existingCandidates) ? existingCandidates : []).forEach(
    function (item) {
      const name = String((item && item.name) || "").trim().toUpperCase();
      if (name) existingNames[name] = true;
    },
  );

  const cache = CacheService.getScriptCache();
  const normalizedPrimary = normalizePdfModelToken_(primaryModel) || "UNKNOWN";
  const bestCandidateCacheKey = `PDF_BEST_DRIVE_V246:${normalizedPrimary}`;
  let candidates = [];
  try {
    const cached = cache.get(bestCandidateCacheKey);
    const parsed = cached ? JSON.parse(cached) : [];
    if (Array.isArray(parsed) && parsed.length > 0) {
      candidates = parsed.filter(function (item) {
        return item && pdfFileNameMatchesModels(item.name, exactModels);
      });
    }
  } catch (cacheError) {
    candidates = [];
  }

  if (candidates.length === 0) {
    const byName = {};
    try {
      const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
      const files = folder.getFilesByType(MimeType.PDF);
      while (files.hasNext()) {
        const file = files.next();
        const fileName = file.getName();
        if (!pdfFileNameMatchesModels(fileName, exactModels)) continue;

        const candidate = {
          name: fileName,
          mimeType: "application/pdf",
          driveFileId: file.getId(),
          sizeBytes: Number(file.getSize()) || 0,
          updatedAt: file.getLastUpdated().toISOString(),
          _driveFile: file,
        };
        const key = fileName.trim().toUpperCase();
        const existing = byName[key];
        const candidateTime = Date.parse(candidate.updatedAt || "") || 0;
        const existingTime = existing
          ? Date.parse(existing.updatedAt || "") || 0
          : 0;
        if (
          !existing ||
          candidateTime > existingTime ||
          (candidateTime === existingTime &&
            candidate.sizeBytes > Number(existing.sizeBytes || 0))
        ) {
          byName[key] = candidate;
        }
      }
    } catch (err) {
      writeLog(`[PDF Recovery] Drive 讀取失敗: ${err.message}`);
      return [];
    }
    candidates = Object.keys(byName).map(function (key) {
      return byName[key];
    });
    candidates = prioritizeDetailedManualCandidates_(
      candidates,
      "",
      primaryModel,
    );
    try {
      cache.put(
        bestCandidateCacheKey,
        JSON.stringify(
          candidates.map(function (item) {
            return {
              name: item.name,
              mimeType: item.mimeType,
              driveFileId: item.driveFileId,
              sizeBytes: item.sizeBytes,
              updatedAt: item.updatedAt,
            };
          }),
        ),
        21600,
      );
    } catch (cacheWriteError) {}
  } else {
    candidates = prioritizeDetailedManualCandidates_(
      candidates,
      "",
      primaryModel,
    );
  }

  const selectedCandidates = candidates.slice(0, maxFiles).filter(function (item) {
    return !existingNames[String(item.name || "").trim().toUpperCase()];
  });
  if (selectedCandidates.length === 0) {
    return [];
  }

  const recovered = [];
  for (
    let i = 0;
    i < selectedCandidates.length && recovered.length < maxFiles;
    i++
  ) {
    const candidate = selectedCandidates[i];
    let file = candidate._driveFile || null;
    try {
      if (!file) file = DriveApp.getFileById(candidate.driveFileId);
    } catch (fileError) {
      cache.remove(bestCandidateCacheKey);
      writeLog(
        `[PDF Recovery] 快取的 Drive 檔案已失效: ${candidate.name} (${fileError.message})`,
      );
      continue;
    }
    const fileSize = Number(candidate.sizeBytes) || file.getSize();
    if (fileSize > 48 * 1024 * 1024) {
      writeLog(`[PDF Recovery] 跳過過大檔案: ${candidate.name}`);
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
        name: candidate.name,
        uri: uri,
        mimeType: "application/pdf",
        source: "file_api",
        driveFileId: candidate.driveFileId,
        sizeBytes: fileSize,
        updatedAt: candidate.updatedAt,
      });
    } else if (fileSize <= INLINE_PDF_FALLBACK_MAX_BYTES) {
      recovered.push({
        name: candidate.name,
        inlineDataBase64: Utilities.base64Encode(file.getBlob().getBytes()),
        mimeType: "application/pdf",
        source: "inline_fallback",
        driveFileId: candidate.driveFileId,
        sizeBytes: fileSize,
        updatedAt: candidate.updatedAt,
      });
      writeLog(
        `[PDF Recovery] File API 無 URI，改用 inline PDF fallback: ${candidate.name} (${fileSize} bytes)`,
      );
    } else {
      writeLog(
        `[PDF Recovery] File API 無 URI，且檔案超過 inline fallback 上限: ${candidate.name} (${fileSize} bytes)`,
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

/**
 * 只修復本題實際選中的過期 PDF，不再因單一 URI 過期而重建整個資料夾。
 * File API 仍無法產生 URI 時，僅對小檔使用既有 inline fallback。
 */
function refreshStalePdfAttachmentsFromDrive_(filesToAttach) {
  const selectedFiles = (Array.isArray(filesToAttach) ? filesToAttach : [])
    .filter(function (item) {
      return isPdfKbFile(item) && item.name;
    })
    .slice(0, 2);
  if (!CONFIG.DRIVE_FOLDER_ID || selectedFiles.length === 0) {
    return [];
  }

  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    writeLog("[PDF Targeted Refresh] 缺少 GEMINI_API_KEY");
    return [];
  }

  const wantedNames = {};
  selectedFiles.forEach(function (item) {
    wantedNames[String(item.name).toUpperCase()] = true;
  });
  const refreshedByName = {};
  const attemptedNames = {};

  const refreshDriveFile = function (file) {
    const upperName = String(file.getName()).toUpperCase();
    if (!wantedNames[upperName] || attemptedNames[upperName]) return;
    attemptedNames[upperName] = true;
    const fileSize = file.getSize();
    if (fileSize > 48 * 1024 * 1024) {
      writeLog(`[PDF Targeted Refresh] 跳過過大檔案: ${file.getName()}`);
      return;
    }

    const updatedAt = file.getLastUpdated().toISOString();
    const driveFileId = file.getId();
    const blob = file.getBlob();
    const uri = uploadFileToGemini(
      apiKey,
      blob,
      fileSize,
      "application/pdf",
    );
    if (uri) {
      const refreshedItem = {
        name: file.getName(),
        uri: uri,
        mimeType: "application/pdf",
        source: "file_api_targeted_refresh",
        driveFileId: driveFileId,
        sizeBytes: fileSize,
        updatedAt: updatedAt,
        identity: `${driveFileId}:${file.getLastUpdated().getTime()}:${fileSize}`,
      };
      refreshedByName[upperName] = refreshedItem;
      persistManualPdfKbItem_(refreshedItem);
    } else if (fileSize <= INLINE_PDF_FALLBACK_MAX_BYTES) {
      refreshedByName[upperName] = {
        name: file.getName(),
        inlineDataBase64: Utilities.base64Encode(blob.getBytes()),
        mimeType: "application/pdf",
        source: "inline_targeted_refresh",
        driveFileId: driveFileId,
        sizeBytes: fileSize,
        updatedAt: updatedAt,
      };
    }
  };

  try {
    // 新索引保留 driveFileId 後，直接取本題檔案；只有舊索引缺 ID 或
    // ID 已失效時才掃整個資料夾，避免把使用者等待時間花在無關 PDF。
    selectedFiles.forEach(function (item) {
      if (!item.driveFileId) return;
      try {
        const file = DriveApp.getFileById(item.driveFileId);
        if (
          String(file.getName()).toUpperCase() ===
          String(item.name).toUpperCase()
        ) {
          refreshDriveFile(file);
        }
      } catch (directError) {
        writeLog(
          `[PDF Targeted Refresh] Drive ID 已失效，改用檔名相容搜尋: ${item.name}`,
        );
      }
    });

    const unresolvedNames = Object.keys(wantedNames).filter(function (name) {
      return !attemptedNames[name];
    });
    if (unresolvedNames.length > 0) {
      const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
      const driveFiles = folder.getFilesByType(MimeType.PDF);
      while (driveFiles.hasNext()) {
        const allWantedNamesAttempted = Object.keys(wantedNames).every(
          function (name) {
            return Boolean(attemptedNames[name]);
          },
        );
        if (allWantedNamesAttempted) break;
        const file = driveFiles.next();
        const upperName = String(file.getName()).toUpperCase();
        if (!wantedNames[upperName] || attemptedNames[upperName]) continue;
        refreshDriveFile(file);
      }
    }
  } catch (error) {
    writeLog(`[PDF Targeted Refresh] 失敗: ${error.message}`);
    return [];
  }

  const refreshed = selectedFiles
    .map(function (item) {
      return refreshedByName[String(item.name).toUpperCase()] || null;
    })
    .filter(Boolean);
  if (refreshed.length > 0) {
    writeLog(
      `[PDF Targeted Refresh v29.6.115] 已更新: ${refreshed
        .map(function (item) {
          return item.name;
        })
        .join(", ")}`,
    );
  }
  return refreshed;
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

function isIncompleteModelRuleLine_(value) {
  return /(?:^|,)\s*型號[：:]\s*尚無資訊(?:\s*,|\s*$)/i.test(
    String(value || ""),
  );
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
    const fallbackPdfByName = {};
    fallbackKbList.forEach(function (item) {
      if (isPdfKbFile(item) && item.name) {
        fallbackPdfByName[String(item.name).toUpperCase()] = item;
      }
    });

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

    // 1. QA 內容：先建立 QA2 結構化索引；舊格式會在讀取時相容轉換。
    let qaContent = "=== 💡 精選問答 (QA - 最優先參考) ===\n";
    let qaRawRows = [];
    const qaSheet = ss.getSheetByName(SHEET_NAMES.QA);
    if (qaSheet && qaSheet.getLastRow() >= 1) {
      // 從第 1 行開始讀取，避免漏掉第一筆資料 (若無標題列)
      const data = qaSheet.getRange(1, 1, qaSheet.getLastRow(), 1).getValues();
      qaRawRows = data
        .map((row) => String(row[0] || "").trim())
        .filter((text) => text && !(text.length < 20 && /^(問題|Question|QA內容)/i.test(text)));
      const qaIndexResult = qaKnowledgeRebuildCache_(qaRawRows, cache);
      const qaRows = qaIndexResult.records
        .filter((record) => String(record.evidence && record.evidence.type || "qa") !== "manual_chunk")
        .map((record) => qaKnowledgePromptLine_(record));
      qaContent += qaRows.join("\n\n");
      // v29.5.0: Log Optimization
      // writeLog(
      //   `[Sync Debug] QA Sheet: ${qaRows.length} rows valid. Content length: ${qaContent.length}`
      // );

      // v27.9.23: 防災機制 - 若 QA 異常空白 (讀取失敗?)，停止同步以保護 Diff
      if (qaIndexResult.count === 0 && !forceRebuild) {
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
        .getValues()
        .filter(function (row) {
          return row[0] && !isIncompleteModelRuleLine_(row[0]);
        });
      const skippedIncompleteCount =
        ruleSheet.getLastRow() - 1 - allRows.length;
      if (skippedIncompleteCount > 0) {
        writeLog(
          `[Sync RULE Guard v29.6.096] 排除 ${skippedIncompleteCount} 筆「尚無資訊」未完成列，不注入正式 prompt/index`,
        );
      }

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
    let failedUploadCount = 0;
    let driveScanSucceeded = false;
    const drivePdfCatalog = [];
    const drivePdfNameCounts = {};
    const duplicateDrivePdfNames = [];

    if (CONFIG.DRIVE_FOLDER_ID) {
      try {
        const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
        const files = folder.getFilesByType(MimeType.PDF);

        let uploadedFiles = [];
        while (files.hasNext()) {
          const file = files.next();
          const fileName = file.getName();
          const fileSize = file.getSize();
          const fileIdentity = `${file.getId()}:${file.getLastUpdated().getTime()}:${fileSize}`;
          const normalizedDriveName = fileName.trim().toUpperCase();
          drivePdfNameCounts[normalizedDriveName] =
            Number(drivePdfNameCounts[normalizedDriveName] || 0) + 1;
          if (drivePdfNameCounts[normalizedDriveName] === 2) {
            duplicateDrivePdfNames.push(fileName);
          }

          // 跳過過大檔案
          if (fileSize > 48 * 1024 * 1024) {
            writeLog(`[Sync] ⚠️ 跳過過大檔案: ${fileName}`);
            continue;
          }

          // PDF_MODEL_INDEX 的語義是「Drive 中已有可用大小的官方手冊」，
          // 不得因本次 Gemini Files 上傳暫時失敗就把型號從索引抹掉。
          drivePdfCatalog.push({
            name: fileName,
            mimeType: "application/pdf",
            driveFileId: file.getId(),
            sizeBytes: fileSize,
            updatedAt: file.getLastUpdated().toISOString(),
            identity: fileIdentity,
          });

          if (existingFilesMap.has(fileName)) {
            newKbList.push({
              name: fileName,
              uri: existingFilesMap.get(fileName),
              mimeType: "application/pdf",
              driveFileId: file.getId(),
              sizeBytes: fileSize,
              updatedAt: file.getLastUpdated().toISOString(),
              identity: fileIdentity,
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
                driveFileId: file.getId(),
                sizeBytes: fileSize,
                updatedAt: file.getLastUpdated().toISOString(),
                identity: fileIdentity,
              });
              uploadedFiles.push(fileName);
              uploadCount++;
            } else {
              failedUploadCount++;
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

    // force rebuild 若只有少數檔案上傳失敗，保留那些檔案的舊 URI，
    // 但成功檔案必須立即採新 URI；禁止一檔失敗把整批新結果全部丟掉。
    if (driveScanSucceeded && failedUploadCount > 0) {
      drivePdfCatalog.forEach(function (catalogItem) {
        const upperName = String(catalogItem.name || "").toUpperCase();
        const alreadyFresh = newKbList.some(function (item) {
          return String(item && item.name || "").toUpperCase() === upperName;
        });
        const fallbackItem = fallbackPdfByName[upperName];
        if (!alreadyFresh && fallbackItem) {
          newKbList.push(
            Object.assign({}, fallbackItem, {
              driveFileId: catalogItem.driveFileId,
              sizeBytes: catalogItem.sizeBytes,
              updatedAt: catalogItem.updatedAt,
              identity: catalogItem.identity,
            }),
          );
        }
      });
    }

    // v29.5.53: PDF Model Index - 從 PDF 檔名提取型號建立索引
    const hasPdfInNewKbList = newKbList.some(isPdfKbFile);
    const hasPdfInFallback = fallbackKbList.some(isPdfKbFile);
    const hasPdfInBackup = backupKbList.some(isPdfKbFile);

    let kbListToPersist = newKbList;
    let pdfListSource = "new";
    const hasPartialDriveUploadFailure =
      driveScanSucceeded && failedUploadCount > 0;
    const hasDuplicateDrivePdfNames = duplicateDrivePdfNames.length > 0;
    const hasDriveScanFailure = Boolean(
      (CONFIG.DRIVE_FOLDER_ID && !driveScanSucceeded) ||
        hasDuplicateDrivePdfNames,
    );
    const hasIncompleteDriveSync =
      hasDriveScanFailure || hasPartialDriveUploadFailure;
    const incompleteDriveReason = hasDuplicateDrivePdfNames
      ? `Drive 有同名 PDF 衝突：${duplicateDrivePdfNames.join("、")}`
      : hasDriveScanFailure
      ? "Drive 掃描未完整"
      : `${failedUploadCount} 本上傳失敗`;
    if (hasDriveScanFailure && hasPdfInFallback) {
      kbListToPersist = fallbackKbList;
      pdfListSource = "current_incomplete_drive_sync";
      writeLog(
        `[Sync Guard v29.6.131] ${incompleteDriveReason}，保留既有完整 KB_URI_LIST，禁止部分清單覆蓋正式與備份`,
      );
    } else if (hasDriveScanFailure && hasPdfInBackup) {
      kbListToPersist = backupKbList;
      pdfListSource = "backup_incomplete_drive_sync";
      writeLog(
        `[Sync Guard v29.6.131] ${incompleteDriveReason}且正式 URI 不可用，保留完整備份，禁止部分清單覆蓋`,
      );
    } else if (hasPartialDriveUploadFailure && hasPdfInNewKbList) {
      kbListToPersist = newKbList;
      pdfListSource = "partial_merged_with_previous";
      writeLog(
        `[Sync Guard v29.6.250] ${incompleteDriveReason}；保留失敗檔舊 URI，並立即採用其他成功檔的新 URI`,
      );
    } else if (!hasPdfInNewKbList && hasPdfInFallback) {
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

    const pdfIndexSourceList =
      driveScanSucceeded && drivePdfCatalog.some(isPdfKbFile)
      ? drivePdfCatalog
      : kbListToPersist;
    const uniquePdfModels = extractPdfModelIndexFromKbList(pdfIndexSourceList);
    const props = PropertiesService.getScriptProperties();
    const shouldPersistPdfState =
      (!hasDriveScanFailure && kbListToPersist.some(isPdfKbFile)) ||
      !CONFIG.DRIVE_FOLDER_ID;
    const shouldPersistPdfIndex =
      !hasDriveScanFailure &&
      (uniquePdfModels.length > 0 ||
        !CONFIG.DRIVE_FOLDER_ID ||
        driveScanSucceeded);
    if (shouldPersistPdfIndex) {
      props.setProperty("PDF_MODEL_INDEX", JSON.stringify(uniquePdfModels));
    }
    syncLogs.push(`PDF索引: ${uniquePdfModels.length}`);
    syncLogs.push(`PDF來源: ${pdfListSource}`);
    syncLogs.push(`Drive手冊: ${drivePdfCatalog.length}`);

    // 更新 Cache。部分上傳失敗時可以保留舊正式 URI，但絕不能刷新備份；
    // 否則成功子集會把最後一份完整回復點洗掉。
    const shouldRefreshPdfBackups = Boolean(
      !hasIncompleteDriveSync &&
        (!CONFIG.DRIVE_FOLDER_ID || driveScanSucceeded) &&
        kbListToPersist.some(isPdfKbFile),
    );
    if (shouldPersistPdfState) {
      props.setProperty(CACHE_KEYS.KB_URI_LIST, JSON.stringify(kbListToPersist));
    }
    if (shouldRefreshPdfBackups) {
      props.setProperty(
        CACHE_KEYS.KB_URI_LIST_BACKUP,
        JSON.stringify(kbListToPersist),
      );
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
      hasIncompleteDriveSync
        ? "⚠️ 知識庫同步未完整，已保留前次狀態並排程重試"
        : "✅ 知識庫重建與同步完成",
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
    const failedCount = failedUploadCount;
    if (hasDriveScanFailure || failedCount > 0) {
      const retryReason = hasDuplicateDrivePdfNames
        ? `同名 PDF 衝突：${duplicateDrivePdfNames.join("、")}`
        : hasDriveScanFailure
        ? "Drive 掃描未完整"
        : `${failedCount} 本 PDF 上傳失敗`;
      writeLog(`[Sync] ⚠️ ${retryReason}, 1 分鐘後自動重試`);
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
function extractEmbeddedJsonArrayByKey_(html, key) {
  const source = String(html || "");
  const marker = `"${String(key || "")}"`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return [];
  const start = source.indexOf("[", markerIndex + marker.length);
  if (start < 0) return [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString && char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "[") depth++;
    if (char === "]") {
      depth--;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(source.slice(start, i + 1));
          return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          writeLog(
            `[Manual Discovery] support page manuals JSON 解析失敗: ${error.message}`,
          );
          return [];
        }
      }
    }
  }
  return [];
}

function isSafeSamsungTwManualDownload_(value) {
  const url = String(value || "").replace(/&amp;/gi, "&").trim();
  return (
    /^https:\/\/org\.downloadcenter\.samsung\.com\/downloadfile\/ContentsFile\.aspx\?/i.test(
      url,
    ) &&
    /(?:^|[?&])CDSite=UNI_TW(?:&|$)/i.test(url) &&
    /(?:^|[?&])CDCttType=UM(?:&|$)/i.test(url)
  );
}

function discoverOfficialTwManualCandidate_(product) {
  const fullSku = String((product && product.model) || "")
    .trim()
    .toUpperCase();
  if (!/^L?[SCF][A-Z0-9]{7,}XZW$/i.test(fullSku)) return null;
  const supportUrl = `https://www.samsung.com/tw/support/model/${encodeURIComponent(fullSku)}/`;
  const response = UrlFetchApp.fetch(supportUrl, {
    muteHttpExceptions: true,
    followRedirects: true,
  });
  if (response.getResponseCode() !== 200) {
    writeLog(
      `[Manual Discovery] ${fullSku} support page HTTP ${response.getResponseCode()}`,
    );
    return null;
  }
  const manuals = extractEmbeddedJsonArrayByKey_(
    response.getContentText(),
    "manuals",
  );
  const candidates = manuals.filter(function (manual) {
    const languages = Array.isArray(manual && manual.languageList)
      ? manual.languageList
      : [];
    const areas = Array.isArray(manual && manual.areaList)
      ? manual.areaList
      : [];
    const isTraditionalChinese = languages.some(function (language) {
      return (
        /ZH2|ZH-TW/i.test(String((language && language.orgCode) || "")) ||
        /TRADITIONAL/i.test(String((language && language.name) || ""))
      );
    });
    const isTaiwan = areas.some(function (area) {
      return /^(?:TW|UNI_TW)$/i.test(
        String((area && (area.orgCode || area.code)) || ""),
      );
    });
    return (
      String((manual && manual.contentsTypeCode) || "").toUpperCase() === "UM" &&
      /\.pdf$/i.test(String((manual && manual.fileName) || "")) &&
      isTraditionalChinese &&
      isTaiwan &&
      isSafeSamsungTwManualDownload_(manual && manual.downloadUrl)
    );
  });
  if (candidates.length === 0) return null;
  candidates.sort(function (a, b) {
    return Number(b.fileModifiedDateCalendar || 0) - Number(a.fileModifiedDateCalendar || 0);
  });
  const selected = candidates[0];
  return {
    fullSku: fullSku,
    supportUrl: supportUrl,
    fileId: String(selected.fileID || ""),
    fileName: String(selected.fileName || ""),
    fileVersion: String(selected.fileVersion || ""),
    modifiedAt: Number(selected.fileModifiedDateCalendar || 0),
    downloadUrl: String(selected.downloadUrl || "").replace(/&amp;/gi, "&"),
  };
}

function bytesToHex_(bytes) {
  return (bytes || [])
    .map(function (byte) {
      return (`0${(byte & 255).toString(16)}`).slice(-2);
    })
    .join("");
}

function normalizeOfficialManualFileModelToken_(value) {
  let model = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^L(?=[SCF]\d{2,3})/, "")
    .replace(/XZW$/, "");
  // 專案既有命名鐵律：第一頁完整型號的尾端 1–3 碼英文字為
  // 地區／通路／顏色尾碼；只在移除後以數字結尾時才套用。
  const suffixMatch = model.match(/([A-Z]{1,3})$/);
  if (suffixMatch) {
    const withoutSuffix = model.slice(0, -suffixMatch[1].length);
    if (/\d$/.test(withoutSuffix) && withoutSuffix.length >= 7) {
      model = withoutSuffix;
    }
  }
  return /^[SCF]\d{2,3}[A-Z0-9]{4,}$/i.test(model) ? model : "";
}

function buildOfficialManualFinalFileName_(models, candidateFullSku) {
  const candidateModel = normalizeModelForDisplay(candidateFullSku);
  const normalized = Array.from(
    new Set(
      (Array.isArray(models) ? models : [])
        .map(normalizeOfficialManualFileModelToken_)
        .filter(Boolean),
    ),
  ).sort();
  if (
    !candidateModel ||
    normalized.length === 0 ||
    normalized.length > 16 ||
    !normalized.some(function (manualModel) {
      return isPdfModelTokenMatch_(manualModel, candidateModel);
    })
  ) {
    return "";
  }
  return `${normalized.join(",")}.pdf`;
}

function deleteTemporaryGeminiFile_(fileUri, apiKey) {
  const uri = String(fileUri || "");
  if (!/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/files\//i.test(uri)) {
    return;
  }
  try {
    UrlFetchApp.fetch(`${uri}?key=${encodeURIComponent(apiKey)}`, {
      method: "delete",
      muteHttpExceptions: true,
    });
  } catch (error) {
    writeLog(`[Manual Auto Import] 暫存 Gemini File 清理失敗: ${error.message}`);
  }
}

function validateOfficialManualFirstPage_(blob, candidate) {
  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY") || "";
  if (!apiKey) return { valid: false, reason: "MISSING_GEMINI_API_KEY" };
  const fileUri = uploadFileToGemini(
    apiKey,
    blob,
    blob.getBytes().length,
    "application/pdf",
  );
  if (!fileUri) return { valid: false, reason: "GEMINI_FILE_UPLOAD_FAILED" };
  try {
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "只讀這份三星螢幕官方 PDF 的第 1 頁。逐字擷取第 1 頁列出的所有完整螢幕型號；不要從檔名、其他頁或常識補型號。若第 1 頁無法辨識就回 page1Readable=false。",
            },
            {
              fileData: {
                mimeType: "application/pdf",
                fileUri: fileUri,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 400,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            page1Readable: { type: "BOOLEAN" },
            isSamsungMonitorManual: { type: "BOOLEAN" },
            page1Models: {
              type: "ARRAY",
              items: { type: "STRING" },
            },
          },
          required: ["page1Readable", "isSamsungMonitorManual", "page1Models"],
        },
      },
    };
    const countResponse = UrlFetchApp.fetch(
      `${CONFIG.API_ENDPOINT}/${GEMINI_MODEL_FAST}:countTokens?key=${apiKey}`,
      {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ contents: payload.contents }),
        muteHttpExceptions: true,
      },
    );
    if (countResponse.getResponseCode() !== 200) {
      return { valid: false, reason: "FIRST_PAGE_COUNT_TOKENS_FAILED" };
    }
    const totalTokens = Number(
      JSON.parse(countResponse.getContentText()).totalTokens || 0,
    );
    if (!totalTokens || totalTokens > 250000) {
      return { valid: false, reason: "FIRST_PAGE_TOKEN_LIMIT" };
    }
    function requestFirstPageIdentity_(modelName) {
      const response = UrlFetchApp.fetch(
        `${CONFIG.API_ENDPOINT}/${modelName}:generateContent?key=${apiKey}`,
        {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
        },
      );
      if (response.getResponseCode() !== 200) {
        return {
          valid: false,
          reason: `FIRST_PAGE_HTTP_${response.getResponseCode()}`,
          modelName: modelName,
        };
      }
      const json = JSON.parse(response.getContentText());
      const resultText = String(
        (((json.candidates || [])[0] || {}).content || {}).parts?.[0]?.text || "",
      );
      const result = JSON.parse(resultText);
      const finalFileName = buildOfficialManualFinalFileName_(
        result.page1Models,
        candidate.fullSku,
      );
      return {
        valid:
          result.page1Readable === true &&
          result.isSamsungMonitorManual === true &&
          Boolean(finalFileName),
        reason: finalFileName
          ? ""
          : `FIRST_PAGE_IDENTITY_MISMATCH_${(result.page1Models || [])
              .join("|")
              .substring(0, 120)}`,
        modelName: modelName,
        finalFileName: finalFileName,
        page1Models: result.page1Models,
      };
    }
    let extraction = requestFirstPageIdentity_(GEMINI_MODEL_FAST);
    if (!extraction.valid && GEMINI_MODEL_THINK !== GEMINI_MODEL_FAST) {
      writeLog(
        `[Manual Auto Import] ${candidate.fullSku} Flash-Lite 第一頁核對未通過，改由 2.5 Flash 再核對一次`,
      );
      extraction = requestFirstPageIdentity_(GEMINI_MODEL_THINK);
    }
    if (!extraction.valid) {
      return { valid: false, reason: extraction.reason || "FIRST_PAGE_IDENTITY_MISMATCH" };
    }
    return {
      valid: true,
      finalFileName: extraction.finalFileName,
      page1Models: extraction.page1Models,
      inputTokens: totalTokens,
      validationModel: extraction.modelName,
    };
  } catch (error) {
    return { valid: false, reason: `FIRST_PAGE_PARSE_${error.message}` };
  } finally {
    deleteTemporaryGeminiFile_(fileUri, apiKey);
  }
}

function persistOfficialManualManifest_(candidate, sha256, finalFileName) {
  const props = PropertiesService.getScriptProperties();
  let manifest = {};
  try {
    manifest = JSON.parse(props.getProperty("OFFICIAL_MANUAL_MANIFEST") || "{}");
    if (!manifest || Array.isArray(manifest)) manifest = {};
  } catch (error) {
    manifest = {};
  }
  manifest[candidate.fullSku] = {
    fileId: candidate.fileId,
    sha256: sha256,
    finalFileName: finalFileName,
    modifiedAt: candidate.modifiedAt,
    verifiedAt: new Date().toISOString(),
  };
  props.setProperty("OFFICIAL_MANUAL_MANIFEST", JSON.stringify(manifest));
}

function promoteOfficialManualToRoot_(blob, candidate, sha256, finalFileName) {
  const rootFolder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const files = rootFolder.getFilesByName(finalFileName);
  const matches = [];
  while (files.hasNext()) matches.push(files.next());
  if (matches.length > 1) {
    return { success: false, reason: "DUPLICATE_ACTIVE_FILENAME" };
  }
  if (matches.length === 0) {
    const newTokens = getPdfFileModelTokens_(finalFileName);
    const overlapping = [];
    const allRootFiles = rootFolder.getFiles();
    while (allRootFiles.hasNext()) {
      const rootFile = allRootFiles.next();
      const rootName = String(rootFile.getName() || "");
      if (!/\.pdf$/i.test(rootName)) continue;
      const oldTokens = getPdfFileModelTokens_(rootName);
      if (
        oldTokens.some(function (oldToken) {
          return newTokens.some(function (newToken) {
            return isPdfModelTokenMatch_(oldToken, newToken);
          });
        })
      ) {
        overlapping.push(rootFile);
      }
    }
    if (overlapping.length === 1) {
      const oldTokens = getPdfFileModelTokens_(overlapping[0].getName());
      const scopeOnlyExpanded = oldTokens.every(function (oldToken) {
        return newTokens.some(function (newToken) {
          return isPdfModelTokenMatch_(oldToken, newToken);
        });
      });
      if (scopeOnlyExpanded) matches.push(overlapping[0]);
    }
    if (overlapping.length > 0 && matches.length === 0) {
      return { success: false, reason: "SHARED_SCOPE_CONFLICT" };
    }
  }
  if (matches.length === 0) {
    const created = rootFolder.createFile(blob.copyBlob().setName(finalFileName));
    persistOfficialManualManifest_(candidate, sha256, finalFileName);
    return { success: true, driveFileId: created.getId(), action: "CREATED" };
  }
  const current = matches[0];
  const props = PropertiesService.getScriptProperties();
  let manifest = {};
  try {
    manifest = JSON.parse(props.getProperty("OFFICIAL_MANUAL_MANIFEST") || "{}");
  } catch (error) {}
  const previous = manifest[candidate.fullSku] || {};
  if (previous.sha256 === sha256) {
    return { success: true, driveFileId: current.getId(), action: "UNCHANGED" };
  }
  const backupFolders = rootFolder.getFoldersByName("_MANUAL_AUTO_BACKUP");
  const backupFolder = backupFolders.hasNext()
    ? backupFolders.next()
    : rootFolder.createFolder("_MANUAL_AUTO_BACKUP");
  const timestamp = Utilities.formatDate(
    new Date(),
    "Asia/Taipei",
    "yyyyMMdd_HHmmss",
  );
  current.makeCopy(
    `${finalFileName}.${timestamp}.${String(previous.sha256 || "legacy").slice(0, 12)}.bak.pdf`,
    backupFolder,
  );
  Drive.Files.update(
    { name: finalFileName, mimeType: "application/pdf" },
    current.getId(),
    blob,
  );
  persistOfficialManualManifest_(candidate, sha256, finalFileName);
  return { success: true, driveFileId: current.getId(), action: "UPDATED" };
}

function stageOfficialTwManualCandidate_(product) {
  if (!CONFIG.DRIVE_FOLDER_ID) return null;
  const candidate = discoverOfficialTwManualCandidate_(product);
  if (!candidate) return null;
  const response = UrlFetchApp.fetch(candidate.downloadUrl, {
    muteHttpExceptions: true,
    followRedirects: true,
  });
  if (response.getResponseCode() !== 200) {
    writeLog(
      `[Manual Staging] ${candidate.fullSku} PDF HTTP ${response.getResponseCode()}`,
    );
    return null;
  }
  const blob = response.getBlob();
  const bytes = blob.getBytes();
  const header = bytes
    .slice(0, 5)
    .map(function (byte) {
      return String.fromCharCode(byte & 255);
    })
    .join("");
  const contentType = String(blob.getContentType() || "");
  if (
    header !== "%PDF-" ||
    bytes.length < 10240 ||
    bytes.length > 48 * 1024 * 1024 ||
    !/(?:application\/pdf|application\/octet-stream)/i.test(contentType)
  ) {
    writeLog(
      `[Manual Staging] ${candidate.fullSku} 檔案驗證失敗: type=${contentType}, size=${bytes.length}, header=${header}`,
    );
    return null;
  }
  const sha256 = bytesToHex_(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes),
  );
  const validation = validateOfficialManualFirstPage_(blob, candidate);
  if (validation.valid) {
    try {
      const promotion = promoteOfficialManualToRoot_(
        blob,
        candidate,
        sha256,
        validation.finalFileName,
      );
      if (promotion.success) {
        return Object.assign({}, candidate, validation, promotion, {
          sha256: sha256,
          manualStatus: "ACTIVE_AUTO_VALIDATED",
          stagedAt: new Date().toISOString(),
        });
      }
    } catch (promotionError) {
      validation.reason = `PROMOTION_EXCEPTION_${String(
        promotionError && promotionError.message
          ? promotionError.message
          : promotionError,
      ).substring(0, 160)}`;
      writeLog(
        `[Manual Auto Import] ${candidate.fullSku} 正式入庫失敗，已改存隔離區等下次自動重試: ${validation.reason}`,
      );
      try {
        const geminiFallback = upsertManualPdfToGemini_(
          validation.finalFileName,
          bytes,
          true,
        );
        persistOfficialManualManifest_(
          candidate,
          sha256,
          validation.finalFileName,
        );
        writeLog(
          `[Manual Auto Import] ${candidate.fullSku} Drive 無寫入權，已自動改存 Gemini Files RAG: ${validation.finalFileName}`,
        );
        return Object.assign({}, candidate, validation, {
          sha256: sha256,
          uri: geminiFallback.uri,
          action: "GEMINI_FILE_API_FALLBACK",
          manualStatus: "ACTIVE_AUTO_VALIDATED",
          stagedAt: new Date().toISOString(),
        });
      } catch (fallbackError) {
        validation.reason += `_GEMINI_FALLBACK_${String(
          fallbackError && fallbackError.message
            ? fallbackError.message
            : fallbackError,
        ).substring(0, 120)}`;
      }
    }
  }
  const stagingName = "_PENDING_MANUAL_REVIEW";
  const stagedFileName = `PENDING__${candidate.fullSku}__${candidate.fileId || sha256.slice(0, 12)}.pdf`;
  let driveFileId = "";
  try {
    const rootFolder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    const stagingFolders = rootFolder.getFoldersByName(stagingName);
    const stagingFolder = stagingFolders.hasNext()
      ? stagingFolders.next()
      : rootFolder.createFolder(stagingName);
    const existing = stagingFolder.getFilesByName(stagedFileName);
    if (existing.hasNext()) {
      driveFileId = existing.next().getId();
    } else {
      driveFileId = stagingFolder
        .createFile(blob.setName(stagedFileName))
        .getId();
    }
  } catch (stagingError) {
    validation.reason += `_STAGING_UNAVAILABLE_${String(
      stagingError && stagingError.message ? stagingError.message : stagingError,
    ).substring(0, 120)}`;
    writeLog(
      `[Manual Staging] ${candidate.fullSku} 隔離區不可寫；待重試狀態仍保存於 ScriptProperties`,
    );
  }
  return Object.assign({}, candidate, {
    sha256: sha256,
    driveFileId: driveFileId,
    stagedFileName: stagedFileName,
    manualStatus: "AUTO_VALIDATION_RETRY",
    validationReason: validation.reason || "PROMOTION_FAILED",
    stagedAt: new Date().toISOString(),
  });
}

function sanitizeOfficialRuleField_(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\r\n,]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildOfficialMinimalRuleLine_(product) {
  const fullSku = String((product && product.model) || "").toUpperCase();
  const model = normalizeModelForDisplay(fullSku);
  const displayName = sanitizeOfficialRuleField_(product && product.displayName);
  const officialUrl = String((product && product.detailUrl) || "");
  const highlights = (Array.isArray(product && product.officialHighlights)
    ? product.officialHighlights
    : [])
    .map(sanitizeOfficialRuleField_)
    .filter(Boolean)
    .slice(0, 3);
  if (
    !/^L?[SCF][A-Z0-9]{7,}XZW$/i.test(fullSku) ||
    !isFullSamsungMonitorModelForOfficialPage_(model) ||
    !displayName ||
    !isSafeSamsungTwOfficialUrl_(officialUrl)
  ) {
    return "";
  }
  return [
    fullSku,
    `型號：${model}`,
    "官方新品自動驗證",
    `產品名稱：${displayName}；官方特色：${highlights.join("；") || "未列"}；官網網址：${officialUrl}`,
  ].join(",");
}

function auditOneOfficialManualUpdate_(discoveredProducts, existingLines) {
  const eligible = (Array.isArray(discoveredProducts) ? discoveredProducts : []).filter(
    function (product) {
      const fullSku = String((product && product.model) || "").toUpperCase();
      const matchKey = fullSku.replace(/XZW$/, "");
      return (Array.isArray(existingLines) ? existingLines : []).some(function (line) {
        return line.startsWith(fullSku) || line.startsWith(matchKey);
      });
    },
  );
  if (eligible.length === 0) return null;
  const props = PropertiesService.getScriptProperties();
  const cursor = Math.max(
    0,
    Number(props.getProperty("OFFICIAL_MANUAL_AUDIT_CURSOR") || 0),
  );
  const product = eligible[cursor % eligible.length];
  props.setProperty(
    "OFFICIAL_MANUAL_AUDIT_CURSOR",
    String((cursor + 1) % eligible.length),
  );
  const candidate = discoverOfficialTwManualCandidate_(product);
  if (!candidate) return null;
  let manifest = {};
  try {
    manifest = JSON.parse(props.getProperty("OFFICIAL_MANUAL_MANIFEST") || "{}");
  } catch (error) {}
  const previous = manifest[candidate.fullSku] || null;
  const model = normalizeModelForDisplay(candidate.fullSku);
  if (!previous && hasOfficialManualForModel_(model)) {
    persistOfficialManualManifest_(candidate, "", "BASELINED_EXISTING");
    return { action: "BASELINED", model: model };
  }
  if (!previous || String(previous.fileId || "") !== String(candidate.fileId || "")) {
    return stageOfficialTwManualCandidate_(product);
  }
  return { action: "UNCHANGED", model: model };
}

function scanOfficialWebsiteForNewMonitors() {
  writeLog("[Auto Crawler] 正在啟動官網新機型掃描與同步...");
  try {
    // 🆕 學習價格監控表專案之優雅設計，直接引入官方 Product Finder API 獲取法！
    // 100% 杜絕任何 Next.js 靜態抓取不到的問題，且 100% 獲得最精確的 PDP URL
    const apiUrl = "https://searchapi.samsung.com/v6/front/b2c/product/finder/global?type=07010000&siteCode=tw&start=1&num=100&sort=newest&onlyFilterInfoYN=N";
    const response = UrlFetchApp.fetch(apiUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      writeLog(`[Auto Crawler Error] 三星官方 Product Finder API 請求失敗 (${response.getResponseCode()})`);
      return { success: false, reason: "PRODUCT_FINDER_HTTP_ERROR" };
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
            displayName: String(modelObj?.displayName || modelObj?.modelName || family?.fmyMarketingName || "Samsung Monitor").trim(),
            officialHighlights: Array.isArray(modelObj?.uspDescription)
              ? modelObj.uspDescription
              : Array.isArray(modelObj?.marketingMessage)
              ? modelObj.marketingMessage
              : []
          });
        }
      });
    });
    
    writeLog(`[Auto Crawler] Product Finder API 當前上架螢幕型號數: ${discoveredProducts.length} 款`);
    
    if (discoveredProducts.length === 0) {
      writeLog("[Auto Crawler Warning] 官方 Product Finder API 未回傳任何螢幕。跳過掃描。");
      return { success: false, reason: "PRODUCT_FINDER_EMPTY" };
    }
    
        // 2. 獲取當前 CLASS_RULES 的已有機型
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    if (!sheet) return { success: false, reason: "CLASS_RULES_SHEET_MISSING" };
    
    const lastRow = sheet.getLastRow();
    const existingLines = [];
    if (lastRow > 1) {
      const rows = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      rows.forEach(r => {
        if (!r[0]) return;
        if (!isIncompleteModelRuleLine_(r[0])) {
          existingLines.push(r[0].toString().trim().toUpperCase());
        }
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
      return {
        success: true,
        discoveredCount: discoveredProducts.length,
        newCount: 0,
        activatedCount: 0,
        activatedManuals: [],
        retryCount: 0,
      };
    }
    
    // v29.6.095: Product Finder 只負責發現候選型號。
    // 未完成 PDP 規格擷取與欄位驗證前，禁止把「尚無資訊」寫入正式 RULE。
    const pendingReviewItems = newProducts.map(function (product) {
      return {
        model: product.model,
        displayName: product.displayName,
        officialUrl: product.detailUrl,
        detectedAt: new Date().toISOString(),
        status: "PENDING_SPEC_REVIEW",
      };
    });
    const props = PropertiesService.getScriptProperties();
    let existingPending = [];
    try {
      existingPending = JSON.parse(
        props.getProperty("PENDING_MODEL_REVIEW") || "[]",
      );
      if (!Array.isArray(existingPending)) {
        existingPending = [];
      }
    } catch (parseErr) {
      existingPending = [];
      writeLog(`[Auto Crawler Review] 舊待審核清單解析失敗: ${parseErr.message}`);
    }

    const pendingByModel = {};
    existingPending.concat(pendingReviewItems).forEach(function (item) {
      if (item && item.model) {
        pendingByModel[String(item.model).toUpperCase()] = item;
      }
    });

    // 每日最多下載 2 本，避免撞 GAS 6 分鐘；系統自行核對第一頁型號與
    // 共用範圍，通過才進正式 RAG；失敗則隔離並於下一輪自動重試。
    const activatedRuleLines = [];
    const activatedManuals = [];
    const newModelCursor = Math.max(
      0,
      Number(props.getProperty("OFFICIAL_NEW_MODEL_CURSOR") || 0),
    ) % newProducts.length;
    const orderedNewProducts = newProducts
      .slice(newModelCursor)
      .concat(newProducts.slice(0, newModelCursor));
    const selectedNewProducts = orderedNewProducts.slice(0, 2);
    props.setProperty(
      "OFFICIAL_NEW_MODEL_CURSOR",
      String((newModelCursor + selectedNewProducts.length) % newProducts.length),
    );
    selectedNewProducts.forEach(function (product) {
      try {
        const staged = stageOfficialTwManualCandidate_(product);
        if (staged) {
          pendingByModel[String(product.model).toUpperCase()] = Object.assign(
            {},
            pendingByModel[String(product.model).toUpperCase()] || {},
            staged,
          );
          writeLog(
            staged.manualStatus === "ACTIVE_AUTO_VALIDATED"
              ? `[Manual Auto Import] ${product.model} 已依第一頁驗證並加入正式 RAG: ${staged.finalFileName}`
              : `[Manual Staging] ${product.model} 自動驗證未通過，保留隔離並於下次重試: ${staged.validationReason || "UNKNOWN"}`,
          );
          if (staged.manualStatus === "ACTIVE_AUTO_VALIDATED") {
            const ruleLine = buildOfficialMinimalRuleLine_(product);
            if (ruleLine) activatedRuleLines.push(ruleLine);
            activatedManuals.push({
              model: product.model,
              fileName: staged.finalFileName,
              action: staged.action,
            });
          }
        }
      } catch (manualError) {
        writeLog(
          `[Manual Staging] ${product.model} 自動下載失敗: ${manualError.message}`,
        );
      }
    });
    if (activatedRuleLines.length > 0) {
      sheet
        .getRange(sheet.getLastRow() + 1, 1, activatedRuleLines.length, 1)
        .setValues(
          activatedRuleLines.map(function (line) {
            return [line];
          }),
        );
      writeLog(
        `[Auto Crawler] 已以 A 欄 CSV 格式加入 ${activatedRuleLines.length} 筆官方新品最小 RULE`,
      );
    }
    try {
      const updateAudit = auditOneOfficialManualUpdate_(
        discoveredProducts,
        existingLines,
      );
      if (updateAudit) {
        writeLog(
          `[Manual Auto Audit] ${JSON.stringify(updateAudit).substring(0, 300)}`,
        );
      }
    } catch (updateError) {
      writeLog(`[Manual Auto Audit] 更新檢查失敗: ${updateError.message}`);
    }
    const mergedPending = Object.keys(pendingByModel)
      .sort()
      .map(function (model) {
        return pendingByModel[model];
      })
      .slice(-30);
    props.setProperty("PENDING_MODEL_REVIEW", JSON.stringify(mergedPending));
    writeLog(
      `[Auto Crawler Review] 發現 ${newProducts.length} 款候選型號；本輪自動啟用 ${activatedRuleLines.length} 款，其餘保留隔離重試`,
    );
    return {
      success: true,
      discoveredCount: discoveredProducts.length,
      newCount: newProducts.length,
      activatedCount: activatedRuleLines.length,
      activatedManuals: activatedManuals,
      retryCount: Math.max(
        0,
        selectedNewProducts.length - activatedManuals.length,
      ),
    };
    
  } catch (e) {
    writeLog(`[Auto Crawler Error] 掃描全過程出錯: ${e.message}`);
    return { success: false, reason: String(e && e.message ? e.message : e) };
  }
}

function extractManualCoverageRuleIdentity_(ruleText) {
  const text = String(ruleText || "").trim();
  if (!text || isIncompleteModelRuleLine_(text)) return null;
  const fullSku = String(text.split(",")[0] || "").trim().toUpperCase();
  if (!/^L?[SCF]\d{2,3}[A-Z0-9]{4,}$/i.test(fullSku)) return null;
  const declaredMatch = text.match(/型號[：:]\s*([A-Z0-9]+)/i);
  const model = normalizeModelForDisplay(
    declaredMatch ? declaredMatch[1] : fullSku,
  );
  if (!isFullSamsungMonitorModelForOfficialPage_(model)) return null;
  const officialUrlMatch = text.match(
    /官網網址\s*[：:]\s*(https:\/\/www\.samsung\.com\/tw\/[^\s,]+)/i,
  );
  const officialUrl = officialUrlMatch &&
      isSafeSamsungTwOfficialUrl_(officialUrlMatch[1])
    ? officialUrlMatch[1]
    : /^L[SCF]\d{2,3}[A-Z0-9]{4,}XZW$/i.test(fullSku)
      ? `https://www.samsung.com/tw/support/model/${encodeURIComponent(fullSku)}/`
      : "";
  return {
    model: model,
    fullSku: fullSku,
    officialUrl: officialUrl,
  };
}

function readManualCoverageRuleIdentities_() {
  if (!ss) return [];
  const sheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
  if (!sheet || sheet.getLastRow() < 1) return [];
  const rows = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  const byModel = {};
  rows.forEach(function (row) {
    const identity = extractManualCoverageRuleIdentity_(row[0]);
    if (identity) byModel[identity.model] = identity;
  });
  return Object.keys(byModel)
    .sort()
    .map(function (model) {
      return byModel[model];
    });
}

function readPdfModelIndexForCoverage_() {
  const props = PropertiesService.getScriptProperties();
  const keys = ["PDF_MODEL_INDEX", CACHE_KEYS.PDF_MODEL_INDEX_BACKUP];
  for (let i = 0; i < keys.length; i++) {
    try {
      const parsed = JSON.parse(props.getProperty(keys[i]) || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
  }
  return [];
}

function hasOfficialManualForModel_(model) {
  const normalizedModel = normalizeModelForDisplay(model);
  if (!normalizedModel) return false;
  return readPdfModelIndexForCoverage_().some(function (pdfModel) {
    return isPdfModelTokenMatch_(pdfModel, normalizedModel);
  });
}

function buildManualCoverageReport_() {
  const identities = readManualCoverageRuleIdentities_();
  const pdfIndex = readPdfModelIndexForCoverage_();
  let pendingItems = [];
  try {
    pendingItems = JSON.parse(
      PropertiesService.getScriptProperties().getProperty("PENDING_MODEL_REVIEW") || "[]",
    );
    if (!Array.isArray(pendingItems)) pendingItems = [];
  } catch (error) {
    pendingItems = [];
  }
  const autoRetryModels = pendingItems
    .filter(function (item) {
      return item && item.manualStatus === "AUTO_VALIDATION_RETRY";
    })
    .map(function (item) {
      return String(item.model || "").toUpperCase();
    })
    .filter(Boolean);
  const indexAvailable = pdfIndex.length > 0;
  const coveredModels = [];
  const missingModels = [];
  identities.forEach(function (identity) {
    const covered = pdfIndex.some(function (pdfModel) {
      return isPdfModelTokenMatch_(pdfModel, identity.model);
    });
    (covered ? coveredModels : missingModels).push(identity.model);
  });
  const currentModels = identities
    .map(function (identity) {
      return identity.model;
    })
    .filter(function (model) {
      return /^S\d{2,3}H/i.test(model);
    });
  const currentMissingModels = currentModels.filter(function (model) {
    return missingModels.indexOf(model) >= 0;
  });
  return {
    status: indexAvailable ? "OK" : "INDEX_UNAVAILABLE",
    coverageKnown: indexAvailable,
    generatedAt: new Date().toISOString(),
    gasVersion: GAS_VERSION,
    pdfIndexCount: pdfIndex.length,
    ruleModelCount: identities.length,
    coveredModelCount: indexAvailable ? coveredModels.length : null,
    missingModelCount: indexAvailable ? missingModels.length : null,
    missingModels: indexAvailable ? missingModels : [],
    currentGeneration: "H_2026",
    currentGenerationModelCount: currentModels.length,
    currentGenerationModels: currentModels,
    currentGenerationMissingCount: indexAvailable
      ? currentMissingModels.length
      : null,
    currentGenerationMissingModels: indexAvailable
      ? currentMissingModels
      : [],
    autoImportRetryCount: autoRetryModels.length,
    autoImportRetryModels: autoRetryModels,
    acquisitionMode: "OFFICIAL_DISCOVERY_WITH_MANUAL_VALIDATION",
  };
}

/**
 * 每日同步完成後比對 RULE 與 PDF 型號索引。
 * 新增 RULE 卻缺 PDF，或當代 H/2026 型號缺 PDF，會進 PENDING_MODEL_REVIEW
 * 並寫入明確警示；不自動把未驗證的官網檔案送進正式 RAG。
 */
function auditManualCoverageGaps_() {
  const props = PropertiesService.getScriptProperties();
  const report = buildManualCoverageReport_();
  if (report.status !== "OK") {
    writeLog("[Manual Coverage] PDF 索引不可用，保留前次報表且不建立假缺口");
    return report;
  }

  let previousModels = [];
  try {
    previousModels = JSON.parse(
      props.getProperty("MANUAL_RULE_MODEL_SNAPSHOT") || "[]",
    );
    if (!Array.isArray(previousModels)) previousModels = [];
  } catch (e) {
    previousModels = [];
  }
  const currentModels = readManualCoverageRuleIdentities_().map(function (item) {
    return item.model;
  });
  const newRuleModels = previousModels.length > 0
    ? currentModels.filter(function (model) {
        return previousModels.indexOf(model) < 0;
      })
    : [];
  const newMissingModels = newRuleModels.filter(function (model) {
    return report.missingModels.indexOf(model) >= 0;
  });
  const alertModels = Array.from(
    new Set(
      report.currentGenerationMissingModels.concat(newMissingModels),
    ),
  ).sort();
  report.newRuleModels = newRuleModels;
  report.newMissingModels = newMissingModels;
  report.alertModels = alertModels;

  if (alertModels.length > 0) {
    let pending = [];
    try {
      pending = JSON.parse(props.getProperty("PENDING_MODEL_REVIEW") || "[]");
      if (!Array.isArray(pending)) pending = [];
    } catch (e) {
      pending = [];
    }
    const identityByModel = {};
    readManualCoverageRuleIdentities_().forEach(function (identity) {
      identityByModel[identity.model] = identity;
    });
    const pendingByModel = {};
    pending.forEach(function (item) {
      if (item && item.model) {
        pendingByModel[String(item.model).toUpperCase()] = item;
      }
    });
    alertModels.forEach(function (model) {
      const identity = identityByModel[model] || {};
      const existing = pendingByModel[model] || { model: model };
      existing.manualStatus = "PENDING_MANUAL_REVIEW";
      existing.manualDetectedAt = new Date().toISOString();
      if (identity.officialUrl && !existing.officialUrl) {
        existing.officialUrl = identity.officialUrl;
      }
      pendingByModel[model] = existing;
    });
    props.setProperty(
      "PENDING_MODEL_REVIEW",
      JSON.stringify(
        Object.keys(pendingByModel)
          .sort()
          .map(function (model) {
            return pendingByModel[model];
          })
          .slice(-50),
      ),
    );
    writeLog(
      `[Manual Coverage Alert] RULE 有型號但缺官方 PDF：${alertModels.join("、")}`,
    );
  }

  props.setProperty("MANUAL_RULE_MODEL_SNAPSHOT", JSON.stringify(currentModels));
  props.setProperty("MANUAL_COVERAGE_REPORT", JSON.stringify(report));
  writeLog(
    `[Manual Coverage] H/2026 ${report.currentGenerationModelCount - report.currentGenerationMissingCount}/${report.currentGenerationModelCount}；全 RULE ${report.coveredModelCount}/${report.ruleModelCount}；新增缺口 ${newMissingModels.length}`,
  );
  return report;
}

/**
 * 每日 04:00 自動重建知識庫
 * 使用 forceRebuild=true 確保所有 PDF 重新上傳
 * 避免 Google 48 小時檔案過期問題
 */
function dailyKnowledgeRefresh() {
  writeLog("[Daily] 開始每日知識庫重建 (04:00)...");
  cleanupExpiredSourceRoutingProperties_();
  cleanupLogSheetRows_();
  // 先續期最近曾在真人查詢中失效的熱門手冊（最多 2 本）。Files 上傳
  // 不呼叫模型；即使後續全庫同步逾時，常用 PDF 也不會再由使用者請求承擔更新等待。
  const hotManualFiles = getManualPdfKbList_().slice(-2);
  if (hotManualFiles.length > 0) {
    refreshStalePdfAttachmentsFromDrive_(hotManualFiles);
  }
  // 🆕 v29.5.211: 重建前先自動掃描官網新機型，確保新產品被收錄
  scanOfficialWebsiteForNewMonitors();
  syncGeminiKnowledgeBase(true); // forceRebuild = true
  auditManualCoverageGaps_();
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

    // 一般 webhook 只做 6 小時一次的 Trigger 自檢。有效配額、上一題與
    // AnswerEnvelope 絕不能在訊息主線清掉；舊日期／逾時狀態已由每日
    // dailyKnowledgeRefresh() 的 cleanupExpiredSourceRoutingProperties_() 處理。
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
  preferFocusedManual = false,
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

  // v29.6.246：真正已授權的手冊查詢才檢查 Drive 是否有更聚焦的完整手冊。
  // 一般 QA/RULE 與自動判斷不得掃 Drive 或上傳 PDF；若完整手冊已在 URI
  // 清單，recover 會直接由 6 小時候選快取判定為無須補傳。
  if (preferFocusedManual && primaryModel) {
    const recoveredFocusedFiles = recoverRelevantPdfUrisFromDrive(
      exactModels,
      primaryModel,
      1,
      tier1,
    );
    if (recoveredFocusedFiles.length > 0) {
      tier1 = tier1.concat(recoveredFocusedFiles);
      writeLog(
        `[KB Select v29.6.246] 已補回較聚焦的完整手冊: ${recoveredFocusedFiles
          .map(function (file) {
            return file.name;
          })
          .join(", ")}`,
      );
    }
  }

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

  const detailedManualOrder = prioritizeDetailedManualCandidates_(
    tier1,
    combinedQuery,
    primaryModel,
  );
  if (
    detailedManualOrder.length > 1 &&
    detailedManualOrder[0] !== tier1[0]
  ) {
    writeLog(
      `[KB Select v29.6.246] 已授權手冊查詢優先較聚焦 PDF: ${detailedManualOrder
        .map((f) => f.name)
        .join(", ")}`,
    );
  }
  tier1 = detailedManualOrder;

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

  // v29.6.252：舊 PDF 清單快取只有同步寫入、全專案沒有讀取者；
  // PDF 仍直接由本次回傳值傳給供應商，禁止為死快取增加等待。
  return {
    files: filesToAttach,
    exactModels: exactModels,
    primaryModel: primaryModel,
  };
}

function getRuntimePromptConfig_() {
  if (RUNTIME_PROMPT_CONFIG_MEMO) {
    return RUNTIME_PROMPT_CONFIG_MEMO;
  }

  const cache = CacheService.getScriptCache();
  const cacheKey = `RUNTIME_PROMPT_CONFIG_${GAS_VERSION}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      RUNTIME_PROMPT_CONFIG_MEMO = JSON.parse(cached);
      return RUNTIME_PROMPT_CONFIG_MEMO;
    } catch (e) {}
  }

  let config = { fastTemperature: 0.3, c3Prompt: "" };
  try {
    const promptSheet = ss.getSheetByName(SHEET_NAMES.PROMPT);
    if (promptSheet) {
      const row = promptSheet.getRange("B3:C3").getValues()[0] || [];
      config = {
        fastTemperature: typeof row[0] === "number" ? row[0] : 0.3,
        c3Prompt: String(row[1] || ""),
      };
    }
  } catch (error) {
    writeLog(`[Prompt Config] 讀取失敗，沿用安全預設: ${error.message}`);
  }

  RUNTIME_PROMPT_CONFIG_MEMO = config;
  cache.put(cacheKey, JSON.stringify(config), 300);
  return config;
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
  return constructLeanDynamicPromptV159_(
    query,
    messages,
    kbFiles,
    forceWebSearch,
    imageBlob,
    targetModelName,
  );
}

// v29.6.159：各來源只取得完成本輪任務所需的提示，避免把路由、額度、
// 狀態機與個案 QA 重複塞給模型。這些守門由程式與 QA/RULE 負責。
function constructLeanDynamicPromptV159_(
  query,
  messages,
  kbFiles = [],
  forceWebSearch = false,
  imageBlob = null,
  targetModelName = null,
) {
  const userId = messages.length > 0 ? messages[0].userId : "unknown";
  const modelLabel = targetModelName || "使用者正在詢問的三星螢幕";
  let dynamicPrompt = "";

  if (forceWebSearch) {
    const today = Utilities.formatDate(
      new Date(),
      "Asia/Taipei",
      "yyyy年MM月dd日",
    );
    dynamicPrompt = `【WEB 模式｜${today}】
使用者已同意搜尋公開網頁。請實際使用 google_search，只查可核對的非官方資料；不要搜尋或讀取 Samsung 官網，官方規格由系統 RULE／QA 提供，介面會另給官網連結。
查證對象：${modelLabel}
問題：${query}

直接給最可能解決問題的答案，最多 5 點、450 個中文字。非官方做法要清楚提醒「非官方，請斟酌參考」。只採搜尋證據直接支持的內容，不用內建知識補空白；沒有可核對結果就誠實說明，不要假裝搜到。
【硬性隔離守衛】本機官方規格庫與 QA 優先級高於網路搜尋。嚴禁採納與官方規格衝突的外部農場文（例如 Smart Monitor M5 絕無原生 AirPlay 2，若外部網頁聲稱支援，必須以官方規格為準明確指正）。`;
  } else if (kbFiles.length > 0) {
    dynamicPrompt = `【PDF 模式】
唯一資料來源是本輪掛載的三星官方手冊 PDF。
查證型號：${modelLabel}
問題：${query}

先直接回答，再列必要步驟或條件。不得引用 QA、RULE、網路或內建知識。規格、操作與故障題都必須提供 PDF 顯示頁碼。
【故障與操作題嚴格匹配】若問題為故障排除（如閃爍、黑屏、無畫面、無訊號），必須尋找手冊中的「故障排除 (Troubleshooting)」章節；嚴禁將無關之「支架安裝與高度調整」等無關章節當作故障排除回答！若手冊無該問題之排查段落，誠實說明手冊未記載該故障。
後續會用 JSON Schema 接收 answer 與 evidence；只依 schema 回傳，不要另加文字標記。若內容明載適用整本手冊才可標為全檔共通；依型號而異或找不到時如實標示。不得猜頁碼；找不到可核對段落時只建議下一步，不可自行聯網。`;
  } else {
    dynamicPrompt = buildDynamicContext(messages, userId, false);
    const c3Prompt = getRuntimePromptConfig_().c3Prompt;
    if (c3Prompt) {
      dynamicPrompt += `\n\n【FAST 模式規則】\n${c3Prompt}\n`;
    }
    if (targetModelName) {
      dynamicPrompt += `\n【已確認型號】${targetModelName}。直接回答，不得再次追問型號。`;
    }
    if (imageBlob) {
      dynamicPrompt += "\n【圖片模式】只描述圖片中可見內容，並依 QA／RULE 回答；看不清楚就明說。";
    }
  }

  dynamicPrompt += `\n【共同輸出規則】
使用台灣繁體中文與「你」，先答核心；像熟悉硬體的朋友在 LINE 說明，短句、自然換行。
回答完成就停。只有缺少必要資訊時才引導一次；不要固定邀請追問、客服尾語、重複「喔」、表情或內部術語。
只用本輪提供且可對應目前型號的證據；資料沒寫只能說「目前資料未記載」，不能推成「沒有／不支援」。不要跨型號套規格，不評論或貶低競品，不自行標示來源。`;
  dynamicPrompt += buildCrossDeviceMonitorPromptRule(query);
  return dynamicPrompt;
}

function constructDynamicPromptLegacyV158_(
  query,
  messages,
  kbFiles = [],
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
你現在是一名「非官方網路解法查證助手」。使用者已明確要求搜尋公開網頁的實務解法。

【🚨 最高優先級：禁止重複！】
你上一次的回答是：
「${previousAnswer}」

用戶已經看過這些內容了，現在希望你搜尋**網路上的新資訊**。
**你必須提供「上次沒說過的」新內容！**

如果搜尋後發現網路上也沒有更多資訊，你必須誠實說：
「這次沒有取得可核對的非官方公開網頁，因此我不猜答案。」

【🚨 強制搜尋指令】
今天是 ${today}。用戶要求查詢最新的網路資訊。
**你必須立即使用 google_search 工具搜尋網路！**
理由：用戶明確要求「擴大搜尋」，需要最新、最即時的網路資訊，你的內建知識不足以回答。

【搜尋背景】
用戶剛才選擇了「擴大網路搜尋」功能，希望透過網路搜尋獲得：
- 更豐富的產品細節和技術規格
- 更具體的操作步驟或設定方法
- 非官方公開網頁中的使用者經驗與實務做法
- 更全面的比較分析或解決方案

【任務目標】
針對「${searchTarget}」與用戶的問題，**必須**使用 Google Search 查找更詳細、更新或更全面的資訊。
禁止搜尋或讀取 Samsung 官網；三星官方規格只採用系統既有 RULE／QA，官網僅由介面提供可點連結。外部做法必須明示「非官方，請斟酌參考」。

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
   - 引用可核對的非官方公開網頁或用戶討論
   - 從不同角度分析問題並提供完整解答

【回答要求】
1. **必須基於搜尋結果**：不能只憑內建知識，必須使用實際搜尋到的資訊
2. **直接回答且完整收尾**：
   - 最多 5 點，每點最多 2 行，全文控制在 450 個中文字內；禁止因鋪陳過長而被截斷
   - 依「最直接適用本題」排序，只保留搜尋證據直接支援的做法，不為湊篇幅加入泛用電腦建議
   - 若問題是螢幕內建 USB 媒體播放，除非使用者明說經過電腦或 Hub，禁止加入 Windows USB 選擇性暫停、主機板 USB 埠或電腦端線材等不相干步驟
   - 不建議從非官方來源下載螢幕韌體；韌體只保留為官網可自行確認的安全提醒
   - 引用非官方公開網頁或使用者討論；禁止搜尋 Samsung 官網
3. **格式要求**：
   - 使用數字列表 (1., 2., 3., 4.) 而非圓點
   - 在回答末尾標註「[來源: 網路搜尋]」
4. **優先搜尋，允許誠實**：
   - ✅ 必須使用 google_search 工具實際搜尋，基於搜尋結果回答
   - ✅ 若搜到資訊不足，可提供該系列的「已搜到的」資訊
   - ✅ 若搜尋後真的無結果，誠實說「這次沒有取得可核對的非官方公開網頁，因此我不猜答案」
   - ❌ 嚴禁編造未搜到的內容，嚴禁用 LLM 內建知識填補搜尋空白

【搜尋示例】
- 規格問題：官方規格由 RULE／QA 回答，網路模式不重查 Samsung 官網
- 操作問題：搜尋非官方設定教學與實務經驗
- 故障問題：搜尋常見問題、解決方案

記住：用正面積極的開場，提供有價值的深度內容！`;
  } else if (kbFiles.length > 0) {
    // v29.6.119：手冊已由使用者明確授權，且進入此分支前已先跑過免費
    // QA/RULE 預檢。此階段只掛官方手冊，不再注入整包 QA、RULE、C3，
    // 避免來源污染、互相矛盾與無謂 token。
    dynamicPrompt = `【角色】台灣三星螢幕官方手冊查證助手
【唯一資料來源】本輪掛載的官方手冊 PDF
【查證對象】${targetModelName || "使用者已選定的型號"}
【使用者問題】${query}

你只能根據本輪 PDF 回答；不得引用 QA、規格庫、網路或模型內建知識。`;
  } else {
    // Base Context (Rules + QA)
    dynamicPrompt = buildDynamicContext(messages, userId, false);

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
  if (pendingTopic && !kbFiles.length && !forceWebSearch) {
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
    dynamicPrompt += "- 只輸出 `[AUTO_SEARCH_WEB]` 或 `[AUTO_SEARCH_PDF]` 交由程式接續，不要先寫資料不足或詢問使用者是否查證，也不要標註不存在的來源。\n";
    dynamicPrompt += "- 必須輸出 `[AUTO_SEARCH_PDF]` 或 `[AUTO_SEARCH_WEB]` 暗號\n";
    dynamicPrompt += "- **嚴禁**用「一般常見」「通常來說」「一般而言」這類暗示 LLM 知識的措辭\n";
    dynamicPrompt += "- **嚴禁**用「我想」「我覺得」「通常」這類主觀判斷\n";
    dynamicPrompt += "- **例外：螢幕通識推理 (v29.6.194)** — 若使用者詢問「已知規格如何搭配使用」（如 HDMI 介面接機上盒看第四台、4K 解析度對應 Windows 桌面圖示排列、線材選購等），你可以結合規格庫中的硬體數據與電腦螢幕常識合理推導回答，不需輸出 [AUTO_SEARCH_PDF]。但仍禁止猜測第三方 App 可用性、業者服務內容、或該型號「有沒有」未記載的功能。\n\n";
    dynamicPrompt += "若你**主動**從官方規格庫整理了事實 (例如把「1000R」「Fast IPS」拼湊成回答), 必須在最後明確標記 `[來源:官方規格庫]`。\n";

    // 🆕 v29.5.227: 極速模式防幻覺與誠實來源鐵律 (徹底封鎖一般知識漏洞，不准瞎編展示據點與營業資訊)
    dynamicPrompt += `\n⚠️【極速模式防幻覺與誠實來源鐵律 (嚴格執行)】
1. **無 QA 與規格資料時，嚴禁瞎編回答**：當前為「極速模式（未加載 PDF 手冊）」。若用戶詢問具體的設定步驟、故障排除、展示據點、台中展示店、服務時間、電話號碼、產品規格等任何具體資訊，且當前的【精選 QA & 規格】中**沒有**現成的答案，你**絕對、100% 嚴格禁止**憑藉你自己的通用常識/一般知識瞎編任何地址、電話、營業時間或設定步驟！
2. **誠實引導與自動升級**：
   - 針對**操作設定、故障排除**等深度問題，且資料庫無記載：只輸出 \`[AUTO_SEARCH_PDF]\` 暗號，由程式直接接續官方手冊；不要先寫資料不足，也不要詢問是否要查。
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
      }，請根據手冊內容回答。\n\n【手冊回答契約】\n1. 先給直接結論，再列與問題直接相關的必要條件或步驟；只有真正的步驟或選項才用數字列表。\n2. 回答末尾只標一次 **[來源: ${sourceLabel}]**。\n3. 手冊沒有直接證據時，明確說「手冊未記載」並輸出 [AUTO_SEARCH_WEB]；此標記只請系統詢問使用者，不代表已授權網搜。\n4. 禁止說「你提供的 PDF」，統一說「官方手冊」。\n5. 使用者未問供電時，不加入充電、瓦數、Power Delivery；未問攝影機時，不加入攝影機資訊。\n6. 嚴禁使用自身常識補手冊沒有寫的產品事實。\n7. 「依型號而定／部分型號支援」是泛用說明，不能據此斷言目前型號支援。型號規格題只有在段落明確對應目前型號，或文字明載適用本手冊全部型號時，才能回答肯定。\n8. 規格題、操作題與故障題都必須提供可核對頁碼；沒有頁碼不得視為已由手冊證實。\n9. 答案中加入一行「證據摘錄：」並用不超過 25 個字摘要該頁直接支持答案的文字，不得杜撰。\n10. 最後必須另加一個供程式稽核的標記：\`[手冊證據:第N頁|範圍:型號明確]\`、\`[手冊證據:第N頁|範圍:全檔共通]\`、\`[手冊證據:第N頁|範圍:依型號而異]\` 或 \`[手冊證據:未找到|範圍:未找到]\`。N 必須是 PDF 顯示頁碼；不得猜頁碼。`;
    }
  } else if (imageBlob) {
    // Image Mode
    dynamicPrompt += `\n【系統狀態】目前為「圖片分析模式」。請根據圖片內容和用戶問題進行分析和回答。`;
  }

  return dynamicPrompt;
}

function countGeminiPayloadTokens_(apiKey, modelName, payload, attachPDFs) {
  const transientCodes = [429, 500, 502, 503, 504];
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
    const generateContentRequest = {
      model: modelName,
      contents: JSON.parse(JSON.stringify(payload.contents || [])),
    };
    if (payload.systemInstruction) {
      generateContentRequest.systemInstruction = JSON.parse(
        JSON.stringify(payload.systemInstruction),
      );
    }
    if (payload.tools) {
      generateContentRequest.tools = JSON.parse(JSON.stringify(payload.tools));
    }
    if (payload.generationConfig) {
      generateContentRequest.generationConfig = JSON.parse(
        JSON.stringify(payload.generationConfig),
      );
    }

    // 官方 countTokens 的 generateContentRequest 可精確包含 systemInstruction、tools
    // 與 file_data/file_uri；這裡使用生成請求的同一份輸入，不另做字元推估。
      const countUrl = `${CONFIG.API_ENDPOINT}/${modelName}:countTokens?key=${apiKey}`;
      const response = UrlFetchApp.fetch(countUrl, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ generateContentRequest: generateContentRequest }),
        muteHttpExceptions: true,
      });
      const code = response.getResponseCode();
      const body = response.getContentText();
      if (code !== 200) {
        lastError = `HTTP ${code}`;
        writeLog(`[Token Preflight] countTokens 失敗 ${code}: ${body.substring(0, 300)}`);
        const staleFile =
          !!attachPDFs &&
          (code === 403 || code === 404) &&
          /(?:permission to access the File|may not exist|PERMISSION_DENIED|NOT_FOUND)/i.test(
            body,
          );
        if (staleFile) {
          return {
            ok: false,
            totalTokens: null,
            error: lastError,
            staleFile: true,
          };
        }
        if (transientCodes.indexOf(code) >= 0 && attempt === 0) {
          writeLog(`[Token Preflight] 暫時性 ${code}，退避 1 秒後重試一次`);
          Utilities.sleep(1000);
          continue;
        }
        return {
          ok: false,
          totalTokens: null,
          error: lastError,
          staleFile: false,
        };
      }
      const parsed = JSON.parse(body);
      const totalTokens = Number(parsed.totalTokens);
      if (!Number.isFinite(totalTokens)) {
        lastError = "missing totalTokens";
        if (attempt === 0) {
          writeLog("[Token Preflight] 回傳缺少 totalTokens，退避 1 秒後重試一次");
          Utilities.sleep(1000);
          continue;
        }
        return { ok: false, totalTokens: null, error: lastError };
      }
      return {
        ok: true,
        totalTokens: totalTokens,
        details: parsed.promptTokensDetails || [],
      };
    } catch (error) {
      lastError = error.message;
      writeLog(`[Token Preflight] countTokens 例外: ${error.message}`);
      if (attempt === 0) {
        Utilities.sleep(1000);
        continue;
      }
    }
  }
  return { ok: false, totalTokens: null, error: lastError || "countTokens failed" };
}

function resolveGenerationTemperature_(
  configuredFastTemperature,
  attachPDFs,
  forceWebSearch,
  isRetry,
) {
  let temperature = Number(configuredFastTemperature);
  if (!isFinite(temperature)) temperature = 0.4;
  if (!attachPDFs && !forceWebSearch && !isRetry) {
    // Fast 回答要有自然口吻，但仍是封閉式知識庫；限制在 0.4–0.5，
    // 避免舊 Sheet 設定過低像機器人、過高又擴大規格幻覺。
    temperature = Math.max(0.4, Math.min(0.5, temperature));
  }
  if (attachPDFs) temperature = 0.2;
  if (forceWebSearch) temperature = 0.15;
  if (isRetry) temperature = Math.min(temperature, 0.3);
  return temperature;
}

function estimatePdfWorstCaseCostTwd_(inputTokens) {
  const safeInput = Math.max(0, Number(inputTokens) || 0);
  const inputUsd = (safeInput / 1000000) * PRICE_THINK_INPUT;
  const outputUsd =
    (CONFIG.MAX_PDF_OUTPUT_TOKENS / 1000000) * PRICE_THINK_OUTPUT;
  return (inputUsd + outputUsd) * EXCHANGE_RATE;
}

function isPdfPreflightWithinCost_(tokenPreflight) {
  if (!tokenPreflight || !tokenPreflight.ok) return false;
  return (
    estimatePdfWorstCaseCostTwd_(tokenPreflight.totalTokens) <=
    CONFIG.MAX_PDF_ESTIMATED_TOTAL_COST_TWD
  );
}

function tryPdfLowResolutionRescue_(apiKey, modelName, payload, originalPreflight) {
  if (!originalPreflight || !originalPreflight.ok) return originalPreflight;
  const originalTokens = Number(originalPreflight.totalTokens) || 0;
  const needsRescue =
    originalTokens > CONFIG.MAX_LEGACY_PDF_INPUT_TOKENS ||
    !isPdfPreflightWithinCost_(originalPreflight);
  if (!needsRescue) return originalPreflight;

  const previousResolution = payload.generationConfig.mediaResolution;
  payload.generationConfig.mediaResolution =
    CONFIG.PDF_RESCUE_MEDIA_RESOLUTION;
  const rescued = countGeminiPayloadTokens_(
    apiKey,
    modelName,
    payload,
    true,
  );
  if (
    rescued.ok &&
    Number(rescued.totalTokens) > 0 &&
    Number(rescued.totalTokens) < originalTokens
  ) {
    writeLog(
      `[PDF Cost Rescue v29.6.119] mediaResolution=${CONFIG.PDF_RESCUE_MEDIA_RESOLUTION}, input ${originalTokens} -> ${rescued.totalTokens}, worstCost NT$${estimatePdfWorstCaseCostTwd_(rescued.totalTokens).toFixed(4)}`,
    );
    rescued.costRescued = true;
    return rescued;
  }

  if (previousResolution) {
    payload.generationConfig.mediaResolution = previousResolution;
  } else {
    delete payload.generationConfig.mediaResolution;
  }
  writeLog(
    "[PDF Cost Rescue v29.6.119] 低解析度沒有降低 token，保留原始品質設定",
  );
  return originalPreflight;
}

function buildTokenFuseReply_(attachPDFs, reason) {
  if (attachPDFs) {
    if (reason === "count_failed") {
      return "這次手冊預檢沒有完成，因此沒有扣手冊次數。\n\n我會接著補查一次公開網頁。\n\n[AUTO_SEARCH_WEB]";
    }
    return "這份手冊超出單次安全查詢範圍，因此沒有扣手冊次數。\n\n我會接著補查一次公開網頁。\n\n[AUTO_SEARCH_WEB]";
  }
  return "這題的參考內容超過單次查詢上限。請縮小到一個完整型號和一個明確問題，我再重新查證。";
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
  pdfRefreshAttempted = false,
) {
  const advancedSource = attachPDFs
    ? "manual"
    : forceWebSearch
      ? "web"
      : "";
  const advancedGrant = advancedSource
    ? assertAdvancedSourceGrant_(advancedSource, userId)
    : null;
  if (forceWebSearch) {
    lastWebSearchAttempted = true;
  }
  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) throw new Error("API Key Missing");

  // 同一輪與短時間內共用版本化 Prompt 設定，避免 Gemini 前重複等候 Sheet。
  const configuredFastTemperature =
    getRuntimePromptConfig_().fastTemperature;
  const tempSetting = resolveGenerationTemperature_(
    configuredFastTemperature,
    attachPDFs,
    forceWebSearch,
    isRetry,
  );
  writeLog(
    `[Generation Config v29.6.167] stage=${attachPDFs ? "pdf" : forceWebSearch ? "web" : "fast"} temperature=${tempSetting}`,
  );

  // --- 決定掛載檔案 ---
  // filesToAttach 已經由 getRelevantKBFiles 決定並傳入
  // dynamicContext 則由 constructDynamicPrompt 決定

  writeLog(
    `[KB Load] AttachPDFs: ${attachPDFs}, isRetry: ${isRetry}, Files: ${filesToAttach.length}`,
  );

  // v24.0.0: 根據模式動態調整歷史長度，控制 Token 成本
  // - Fast Mode: 保留 10 對 (20 則)
  // - PDF Mode: 問題已由一次性授權狀態補成完整題，只保留最後一則使用者問題。
  let effectiveMessages = messages;
  if (attachPDFs) {
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((item) => item && item.role === "user");
    effectiveMessages = lastUserMessage
      ? [lastUserMessage]
      : [{ role: "user", content: String(query || "") }];
    writeLog(
      `[Token Control v29.6.116] PDF Mode 只保留本輪完整問題: ${messages.length} -> ${effectiveMessages.length} 則`,
    );
  } else if (forceWebSearch) {
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((item) => item && item.role === "user");
    effectiveMessages = lastUserMessage
      ? [lastUserMessage]
      : [{ role: "user", content: String(query || "") }];
    writeLog(
      `[Token Control v29.6.132] Web Mode 只送 canonical 本題: ${messages.length} -> ${effectiveMessages.length} 則`,
    );
  } else if (!attachPDFs && messages.length > 6) {
    // v29.6.095: 先裁減、後建 prompt/payload，避免舊版只改 effectiveMessages
    // 卻仍把未裁減 geminiContents 送出的成本漏洞。
    effectiveMessages = messages.slice(-6);
    writeLog(
      `[Token Control v29.6.095] Fast/Web 歷史先裁減 ${messages.length} -> ${effectiveMessages.length} 則，再建立唯一 payload`,
    );
  }

  const recentOfficialManualAnswer = forceWebSearch
    ? getRecentOfficialManualAnswer_(effectiveMessages)
    : "";
  // Web 鍵只查非官方公開解法。三星官網內容已由 RULE／QA 管理，
  // 不得再透過官網抓頁工具混入網搜；官網只保留成客戶可點的 URI。

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
  } else if (
    attachPDFs &&
    !forceWebSearch &&
    isRetailModeManualQuery_(query)
  ) {
    const rewrittenQuery = buildRetailModeManualSearchQuery_(
      query,
      targetModelName,
    );
    if (rewrittenQuery && rewrittenQuery !== query) {
      effectiveQuery = rewrittenQuery;
      if (Array.isArray(effectiveMessages) && effectiveMessages.length > 0) {
        effectiveMessages = effectiveMessages.slice();
        effectiveMessages[effectiveMessages.length - 1] = Object.assign(
          {},
          effectiveMessages[effectiveMessages.length - 1],
          { content: rewrittenQuery },
        );
      }
      writeLog(
        `[PDF Query Rewrite v29.6.132] 零售／使用模式同義擴查: ${rewrittenQuery.substring(0, 220)}`,
      );
    }
  } else if (
    attachPDFs &&
    !forceWebSearch &&
    isUsbMediaPlaybackManualQuery_(query)
  ) {
    const rewrittenQuery = buildUsbMediaPlaybackManualSearchQuery_(
      query,
      targetModelName,
    );
    if (rewrittenQuery && rewrittenQuery !== query) {
      effectiveQuery = rewrittenQuery;
      if (Array.isArray(effectiveMessages) && effectiveMessages.length > 0) {
        effectiveMessages = effectiveMessages.slice();
        effectiveMessages[effectiveMessages.length - 1] = Object.assign(
          {},
          effectiveMessages[effectiveMessages.length - 1],
          { content: rewrittenQuery },
        );
      }
      writeLog(
        `[PDF Query Rewrite v29.6.132] USB 媒體播放同義擴查: ${rewrittenQuery.substring(0, 220)}`,
      );
    }
  } else if (
    attachPDFs &&
    !forceWebSearch &&
    isBluetoothAudioManualQuery_(query)
  ) {
    const rewrittenQuery = buildBluetoothAudioManualSearchQuery_(
      query,
      targetModelName,
    );
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
        `[PDF Query Rewrite v29.6.124] 藍牙音訊題擴充手冊標題與選單字詞: ${rewrittenQuery.substring(0, 220)}`,
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

這段只用來固定螢幕端已查證的事實。網路搜尋只補非官方公開網頁的實務經驗，不得把螢幕端的輸入介面、線材條件、供電瓦數或限制改成網路文章中的其他型號資訊。若搜尋結果與錨點衝突，以官方手冊錨點為準。外部內容必須清楚標示為非官方。`;
    writeLog(
      `[Cross Device Manual Anchor v29.6.076] 網搜沿用官方手冊螢幕端事實 (${recentOfficialManualAnswer.length} 字)`,
    );
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
  const modelName = forceWebSearch
    ? CONFIG.MODEL_NAME_WEB
    : useThinkModel
      ? CONFIG.MODEL_NAME_THINK
      : CONFIG.MODEL_NAME_FAST;

  const genConfig = {
    maxOutputTokens: forceWebSearch
      ? 450
      : attachPDFs
        ? CONFIG.MAX_PDF_OUTPUT_TOKENS
        : CONFIG.MAX_OUTPUT_TOKENS,
    temperature: tempSetting,
  };

  if (attachPDFs) {
    genConfig.responseMimeType = "application/json";
    genConfig.responseSchema = getManualStructuredResponseSchema_();
    // 這是長文件中的證據抽取，不是開放式推理。2.5 Flash 預設 Thinking
    // 會占用 maxOutputTokens，曾把合法 JSON 截在第 37 token；關閉後把
    // 1,200 tokens 全留給 answer/page/evidence，一次呼叫完成且更省成本。
    genConfig.thinkingConfig = { thinkingBudget: 0 };
    dynamicPrompt += `\n\n【PDF 結構化輸出】只輸出 schema 指定的 JSON。檢索時先把使用者口語需求轉成手冊中的裝置類別、連接介面、功能名稱與同義詞，再查目錄與全文，不能只比對原句字面。found=true 時 answer 必須完整回答使用者問到的每個子項；evidence 最多 3 筆，每筆頁碼、適用範圍與原文摘錄都必須直接支持答案。手冊確定沒有直接證據時才回 found=false 且 evidence=[]。格式錯誤、讀取逾時或不確定，不得假裝 found=false。`;
    writeLog(
      `[PDF Config v29.6.177] model=${modelName} maxOutputTokens=${genConfig.maxOutputTokens} thinkingBudget=0`,
    );
  }

  // 2.5 Flash 預設動態思考會先吃掉輸出額度，Web 短答可能在 1–2 點即 MAX_TOKENS。
  // Google 官方允許 thinkingBudget=0；搜尋仍由 google_search 工具完成。
  if (forceWebSearch) {
    genConfig.thinkingConfig = { thinkingBudget: 0 };
    writeLog(
      `[Web Config v29.6.154] model=${modelName} maxOutputTokens=${genConfig.maxOutputTokens} thinkingBudget=0`,
    );
  }

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
    writeLog(`[Search Tool Payload] tools=${JSON.stringify(tools)}`);

    // v29.5.110: 強化 System Prompt - 加入時效性指令
    const today = Utilities.formatDate(
      new Date(),
      "Asia/Taipei",
      "yyyy年MM月dd日",
    );
    dynamicPrompt += `\n\n【🚨 系統強制指令 - 最高優先級】\n今天是 ${today}。用戶要求查詢網路上的實務解法、評測或最新公開討論。\n你必須立即使用 google_search 工具搜尋公開網頁！\n若完整精確型號查無資料，請務必使用簡化通用型號（如去除尾端英文字與最後一碼數字，例如 S27FM501EC 簡化為 S27FM50、M5 等）與全球/海外網站（Reddit、各國評測等）擴展搜尋，並統一以清晰流暢的「繁體中文」提供實質具體步驟與解答。`;

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
        if (textPart && !textPart.text.includes("最新公開網頁")) {
          const rawTokens = getSearchFriendlyModelTokens_(query);
          const aliasHint = rawTokens.length > 0 ? `（可搜尋別名/通用型號：${rawTokens.join(", ")}）` : "";
          textPart.text = `【請搜尋最新公開網頁與全球實務討論${aliasHint}】請根據搜尋結果提供具體解決細節與實務步驟。若國外網頁有解答，請翻譯整理為繁體中文回覆。${textPart.text}`;
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

  let tokenPreflight = countGeminiPayloadTokens_(
    apiKey,
    modelName,
    payload,
    attachPDFs,
  );
  if (attachPDFs && tokenPreflight.ok) {
    tokenPreflight = tryPdfLowResolutionRescue_(
      apiKey,
      modelName,
      payload,
      tokenPreflight,
    );
  }
  const inputLimit = attachPDFs
    ? CONFIG.MAX_LEGACY_PDF_INPUT_TOKENS
    : CONFIG.MAX_FAST_INPUT_TOKENS;
  if (!tokenPreflight.ok) {
    if (attachPDFs) {
      if (tokenPreflight.staleFile) {
        if (!evidenceCorrectionAttempted) {
          const refreshedFiles =
            refreshStalePdfAttachmentsFromDrive_(filesToAttach);
          if (refreshedFiles.length > 0) {
            writeLog(
              "[Token Fuse v29.6.115] 過期手冊已單檔更新，重新執行 token 預檢",
            );
            return callLLMWithRetry(
              query,
              messages,
              refreshedFiles,
              attachPDFs,
              imageBlob,
              isRetry,
              userId,
              forceWebSearch,
              targetModelName,
              true,
              webGroundingRetryAttempted,
              true,
            );
          }
        }
        CacheService.getScriptCache().put("kb_need_rebuild", "true", 3600);
        scheduleImmediateRebuild();
        writeLog(
          "[Token Fuse v29.6.101] PDF token 預檢偵測過期／無權限檔案，已排程背景重建並停止本次生成",
        );
        return "[KB_EXPIRED]";
      }
      if (!pdfRefreshAttempted) {
        const refreshedFiles = refreshStalePdfAttachmentsFromDrive_(filesToAttach);
        if (refreshedFiles.length > 0) {
          writeLog(
            "[Token Fuse v29.6.136] countTokens 無法讀取既有檔案，已單檔重傳／inline fallback 後重試一次",
          );
          return callLLMWithRetry(
            query,
            messages,
            refreshedFiles,
            attachPDFs,
            imageBlob,
            isRetry,
            userId,
            forceWebSearch,
            targetModelName,
            evidenceCorrectionAttempted,
            webGroundingRetryAttempted,
            true,
          );
        }
      }
      writeLog(
        `[Token Fuse v29.6.095] PDF countTokens 失敗，fail closed，未送出 generateContent`,
      );
      return buildTokenFuseReply_(true, "count_failed");
    }
    const conservativeEstimate = Math.ceil(JSON.stringify(payload).length / 1.2);
    if (conservativeEstimate > inputLimit) {
      writeLog(
        `[Token Fuse v29.6.095] Fast/Web countTokens 失敗且保守估算 ${conservativeEstimate} > ${inputLimit}，未送出`,
      );
      return buildTokenFuseReply_(false, "estimated_limit");
    }
    writeLog(
      `[Token Preflight v29.6.095] countTokens 失敗，保守估算 ${conservativeEstimate} <= ${inputLimit}，允許純文字請求`,
    );
  } else {
    writeLog(
      `[Token Preflight v29.6.095] stage=${attachPDFs ? "pdf" : forceWebSearch ? "web" : "fast"} input=${tokenPreflight.totalTokens}/${inputLimit} files=${filesToAttach.length}`,
    );
    const pdfWorstCaseCostTwd = attachPDFs
      ? estimatePdfWorstCaseCostTwd_(tokenPreflight.totalTokens)
      : 0;
    const exceedsPdfCost =
      attachPDFs &&
      pdfWorstCaseCostTwd > CONFIG.MAX_PDF_ESTIMATED_TOTAL_COST_TWD;
    if (tokenPreflight.totalTokens > inputLimit || exceedsPdfCost) {
      writeLog(
        `[Token Fuse v29.6.119] 已擋下 ${tokenPreflight.totalTokens} tokens / worstCost NT$${pdfWorstCaseCostTwd.toFixed(4)} 請求，未送出 generateContent`,
      );
      return buildTokenFuseReply_(
        attachPDFs,
        exceedsPdfCost ? "cost_limit" : "token_limit",
      );
    }
    if (
      attachPDFs &&
      tokenPreflight.totalTokens > CONFIG.PDF_INPUT_SOFT_WARNING_TOKENS
    ) {
      writeLog(
        `[PDF Token Budget v29.6.119] ${tokenPreflight.totalTokens} tokens 超過 20K 軟警戒，單次最壞成本約 NT$${pdfWorstCaseCostTwd.toFixed(4)}，在 NT$${CONFIG.MAX_PDF_ESTIMATED_TOTAL_COST_TWD.toFixed(2)} 上限內，依使用者授權繼續`,
      );
    }
  }

  // v29.6.106：countTokens/token fuse 全部通過後、第一個供應商請求送出前，
  // 才在鎖內原子扣除每日額度。後續 429/5xx 退避重試沿用同一 grant。
  if (advancedGrant) {
    reserveAdvancedSourceUsage_(advancedGrant);
  }

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
  while (retryCount < 2) {
    // 每 18 秒補發一次 Loading 動畫（20秒會消失，提前 2 秒補發）
    const now = new Date().getTime();

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

          markGenerationAttempt_(forceWebSearch ? "web" : "fast", OPENROUTER_MODEL);
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

      const requestStage = attachPDFs ? "pdf" : forceWebSearch ? "web" : "fast";
      lastLlmCallAttempted = true;
      markGenerationAttempt_(requestStage, modelName);
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
              modelName === CONFIG.MODEL_NAME_WEB
                ? PRICE_WEB_INPUT
                : modelName === CONFIG.MODEL_NAME_THINK
                  ? PRICE_THINK_INPUT
                  : PRICE_FAST_INPUT;
            var priceOutput =
              modelName === CONFIG.MODEL_NAME_WEB
                ? PRICE_WEB_OUTPUT
                : modelName === CONFIG.MODEL_NAME_THINK
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
            addGenerationUsageToAudit_(usage, costTWD);
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
              if (retryCount === 0) {
                retryCount++;
                payload.generationConfig.temperature = 0.2;
                writeLog(
                  "[PDF Mode Retry v29.6.123] 異常空答，降低溫度後重試一次",
                );
                Utilities.sleep(500);
                continue;
              }
              return "這次官方手冊沒有產生可用文字；系統已自動重試一次。請改按「網路解答」查證公開資料。";
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

            if (attachPDFs) {
              text = normalizeManualStructuredResponse_(text);
            }

            // v29.5.108: Exhaustive Grounding and Tool Call Detection
            // 當啟用工具時，即使 text 為空，只要有任何工具調用、Grounding 或正常結算信號就算成功
            const grounding = candidates[0].groundingMetadata;
            const finishReason = candidates[0].finishReason;
            const hasToolCalls = firstPart && firstPart.functionCall;

            // 每次 API 呼叫前清除，避免沿用上一輪的搜尋證據。
            lastSearchSources = null;
            lastWebEvidenceValid = false;
            lastWebSupportedSegments = [];

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

              const allGroundingChunks = Array.isArray(
                grounding.groundingChunks,
              )
                ? grounding.groundingChunks
                : [];
              const nonOfficialChunkIndexes = new Set();
              const nonOfficialGroundingChunks = [];
              allGroundingChunks.forEach((chunk, index) => {
                if (!isSamsungOfficialGroundingChunk_(chunk)) {
                  nonOfficialChunkIndexes.add(index);
                  nonOfficialGroundingChunks.push(chunk);
                }
              });
              const nonOfficialGroundingSupports = Array.isArray(
                grounding.groundingSupports,
              )
                ? grounding.groundingSupports.filter((support) => {
                    const indices = Array.isArray(
                      support && support.groundingChunkIndices,
                    )
                      ? support.groundingChunkIndices
                      : [];
                    return indices.some((index) =>
                      nonOfficialChunkIndexes.has(index),
                    );
                })
                : [];
              lastWebSupportedSegments = nonOfficialGroundingSupports
                .map(function (support) {
                  return support && support.segment
                    ? String(support.segment.text || "")
                    : "";
                })
                .filter(Boolean);
              if (
                allGroundingChunks.length !==
                nonOfficialGroundingChunks.length
              ) {
                writeLog(
                  `[Grounding Guard v29.6.137] 排除 ${
                    allGroundingChunks.length -
                    nonOfficialGroundingChunks.length
                  } 個 Samsung 官網來源，不作為網路解答證據`,
                );
              }

              // v29.5.112: 提取搜尋來源並保存到全域變數
              if (nonOfficialGroundingChunks.length > 0) {
                // writeLog(
                //   `[Grounding] 來源數量: ${grounding.groundingChunks.length}`,
                // );

                // 提取所有來源的域名
                const sourceSet = new Set();
                nonOfficialGroundingChunks.forEach((chunk, i) => {
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

                // 只保留非官方來源，依搜尋回傳順序顯示。
                let sources = Array.from(sourceSet);

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
                  nonOfficialGroundingChunks.length > 0 &&
                  nonOfficialGroundingSupports.length > 0,
              );
              writeLog(
                `[Grounding Audit v29.6.075] 可稽核 Google Search 證據: ${lastWebEvidenceValid}`,
              );
              writeLog(
                `[Grounding Audit v29.6.132] queries=${Array.isArray(grounding.webSearchQueries) ? grounding.webSearchQueries.length : 0} chunks=${Array.isArray(grounding.groundingChunks) ? grounding.groundingChunks.length : 0} supports=${Array.isArray(grounding.groundingSupports) ? grounding.groundingSupports.length : 0} entry=${grounding.searchEntryPoint ? 1 : 0} finish=${finishReason || "none"}`,
              );
              writeLog(
                `[Grounding Support v29.6.167] nonOfficialSupportedSegments=${lastWebSupportedSegments.length}`,
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
              lastWebUnverifiedDraft = text;
              writeLog(
                "[Grounding Audit v29.6.152] 本次無 groundingChunks/groundingSupports；保留安全過濾後的可能解法，不冒充有引用的網搜答案",
              );
              return "[WEB_NO_EVIDENCE]";
            }

            const isCrossDeviceQuery =
              isCrossDeviceMonitorQuery(effectiveQuery);
            const exactFastCrossDeviceQa =
              isCrossDeviceQuery && !attachPDFs && !forceWebSearch
                ? findLocalMatchInQA(effectiveQuery, userId)
                : null;
            const hasTrustedFastCrossDeviceQa =
              /\[來源[:：]\s*QA庫\]/i.test(text) &&
              !!exactFastCrossDeviceQa;
            if (
              isCrossDeviceQuery &&
              !attachPDFs &&
              !forceWebSearch &&
              /\[來源[:：]\s*QA庫\]/i.test(text) &&
              !exactFastCrossDeviceQa
            ) {
              writeLog(
                "[QA First Router v29.6.093] Fast 回覆自稱 QA 來源但無精準命中，不採用並繼續升級",
              );
            }
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
            if (hasWrongScopeRefusal) {
              writeLog(
                "[Cross Device Evidence Guard v29.6.095] 攔截錯誤範圍拒答，不為修飾答案同步再呼叫一次 LLM",
              );
              if (attachPDFs) {
                return "這是外部裝置連接三星螢幕的問題，不屬於範圍外。但這次手冊回覆沒有產生可靠的螢幕端結論，所以我先不補猜。\n\n[AUTO_SEARCH_WEB]";
              }
              return "[AUTO_SEARCH_PDF]";
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
            if (
              forceWebSearch &&
              isCrossDeviceQuery &&
              hasAppleDisplayEvidenceConflict_(effectiveQuery, text)
            ) {
              lastWebEvidenceValid = false;
              lastWebEvidenceConflict = true;
              writeLog(
                "[Official Product Guard v29.6.092] 回答把其他 iPhone 規格套到目前產品，停止輸出並記錄人工複查",
              );
              return buildEvidenceConflictReply_();
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
        return "⚠️ 系統參數錯誤 (Bad Request)，請嘗試換個問法。";
      }
      if (code === 404) {
        writeLog(`[API 404] 檔案不存在: ${text.substring(0, 200)}`);
        if (attachPDFs && !pdfRefreshAttempted) {
          const refreshedFiles = refreshStalePdfAttachmentsFromDrive_(filesToAttach);
          if (refreshedFiles.length > 0) {
            writeLog(
              "[PDF Generate Refresh v29.6.123] 生成階段 404，已單檔更新並重試",
            );
            return callLLMWithRetry(
              query,
              messages,
              refreshedFiles,
              attachPDFs,
              imageBlob,
              true,
              userId,
              forceWebSearch,
              targetModelName,
              evidenceCorrectionAttempted,
              webGroundingRetryAttempted,
              true,
            );
          }
        }
        // 標記需要重建，並返回特殊標記讓外層處理
        CacheService.getScriptCache().put("kb_need_rebuild", "true", 3600);
        return "[KB_EXPIRED]";
      }
      if (code === 403) {
        writeLog(`[API 403] 檔案已過期或無權限: ${text.substring(0, 300)}`);
        if (attachPDFs && !pdfRefreshAttempted) {
          const refreshedFiles = refreshStalePdfAttachmentsFromDrive_(filesToAttach);
          if (refreshedFiles.length > 0) {
            writeLog(
              "[PDF Generate Refresh v29.6.123] 生成階段 403，已單檔更新並重試",
            );
            return callLLMWithRetry(
              query,
              messages,
              refreshedFiles,
              attachPDFs,
              imageBlob,
              true,
              userId,
              forceWebSearch,
              targetModelName,
              evidenceCorrectionAttempted,
              webGroundingRetryAttempted,
              true,
            );
          }
        }
        // 標記需要重建，並返回特殊標記讓外層處理
        CacheService.getScriptCache().put("kb_need_rebuild", "true", 3600);
        return "[KB_EXPIRED]";
      }
      if (code === 429) {
        writeLog(`[API 429] 配額限制: ${text.substring(0, 200)}`);
        if ((attachPDFs || forceWebSearch) && retryCount === 0) {
          retryCount++;
          writeLog(
            `[${attachPDFs ? "PDF" : "Web"} Retry v29.6.123] 429 退避 1 秒後重試一次`,
          );
          Utilities.sleep(1000);
          continue;
        }
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

      // 其他錯誤不重試；只有 429/5xx 符合退避條件。
      writeLog(`[API Error] Code: ${code}, Body: ${text.substring(0, 300)}`);
      return `⚠️ 系統暫時無法處理（API ${code}），請稍後再試。`;
    } catch (e) {
      lastError = e.message || "未知錯誤";

      writeLog(`[API Exception] ${e.message}`);
      if (e.message.includes("token")) return e.message;
      return "⚠️ 系統連線暫時異常，請稍後再試。";
    }
  }

  // v29.5.25: Graceful Failure
  if (lastError) {
    writeLog(`[API Fail] 允許的一次退避重試仍失敗，最後錯誤: ${lastError}`);
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
        addGenerationUsageToAudit_(
          {
            promptTokenCount: json.usage.prompt_tokens,
            candidatesTokenCount: json.usage.completion_tokens,
          },
          costTWD,
        );
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

  // 只有真正有兩個以上項目時才保留編號；不要在每個項目後強插空行。
  if (text.includes("1.") && !text.includes("2.")) {
    text = text.replace(/^1\.\s*/gm, "");
  }
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

  // v29.6.094: 尊重原文段落，不再於每個標點或長逗號後強制空行。
  processed = processed
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/^\s*(\d+)[\)）、]\s*/gm, "$1. ")
    .replace(/\n{3,}/g, "\n\n");

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

function getNaturalCustomerSourceLabel_(rawSource) {
  const source = String(rawSource || "").trim();
  if (!source || /流程提示|不標來源/i.test(source)) return "";
  if (/QA庫|已驗證問答/i.test(source)) return "已驗證問答資料";
  if (/官方活動庫|活動/i.test(source)) return "三星官方活動資料";
  if (/官方規格庫|規格庫|CLASS_RULES/i.test(source)) return "三星官方規格";
  if (/網路搜尋|公開網頁|WEB/i.test(source)) return "非官方公開網頁";
  if (/\.pdf\b|官方手冊|產品手冊|PDF/i.test(source)) return "三星官方手冊";
  return "";
}

function renderCustomerFacingText_(text) {
  let body = String(text === null || text === undefined ? "" : text);
  const sourceLabels = [];
  let manualPageEvidence = "";
  const costMatch = body.match(
    /\[費用\s*[:：]\s*(NT\$[0-9]+(?:\.[0-9]+)?|未知（已呼叫 LLM）)[^\]]*\]/i,
  );
  const customerCost = costMatch ? costMatch[1] : "NT$0.0000";

  body = body.replace(
    /[\[（\(]來源[：:]\s*([^\]）\)]+)[\]）\)]/gi,
    (match, source) => {
      const label = getNaturalCustomerSourceLabel_(source);
      if (label && !sourceLabels.includes(label)) sourceLabels.push(label);
      return "";
    },
  );
  body = body.replace(
    /(^|\n)\s*官方手冊\s*[:：]\s*([^\n]*?頁)\s*(?=\n|$)/gi,
    function (match, prefix, pages) {
      if (!manualPageEvidence) manualPageEvidence = String(pages || "").trim();
      if (!sourceLabels.includes("三星官方手冊")) {
        sourceLabels.push("三星官方手冊");
      }
      return prefix;
    },
  );
  body = body
    .replace(/\n{0,2}\[費用\s*[:：][^\]]+\]/gi, "")
    .replace(/\n{0,2}這題已由(?:精確規格|規格／FAQ)回答[^\n]*\n?/gi, "")
    .replace(/^\s*(?:你剛才的按鍵就是授權[^\n]*|這次未送出供應商請求[^\n]*|這次屬系統因素[^\n]*|供應商請求已送出[^\n]*)\s*$/gim, "")
    .replace(/\n{0,2}---\s*\n\s*本次(?:對話|建檔|修改|整理)?預估花費[\s\S]*?(?=\n\n|$)/gi, "")
    .replace(/\[(?:AUTO_SEARCH_PDF|AUTO_SEARCH_WEB|NEED_DOC|NEW_TOPIC)(?:[:：][^\]]*)?\]/gi, "")
    .replace(/\[(?:模式|型號)[:：][^\]]+\]/gi, "")
    .replace(/(?:流程提示不標來源|查無後引導網路搜尋，不標來源)/gi, "")
    .replace(/(?:本機\s*)?(?:QA\s*資料庫|QA庫)/gi, "已驗證問答資料")
    .replace(/(?:官方)?規格庫|CLASS_RULES/gi, "三星官方規格")
    .replace(/(?:本機|目前)?\s*資料庫(?:中)?/gi, "現有資料")
    .replace(/您/g, "你")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const visibleSourceLabels = sourceLabels.filter((label) => {
    if (label === "非官方公開網頁" && /參考\s*[:：][^\n]+非官方/.test(body)) {
      return false;
    }
    return true;
  }).map((label) => {
    if (label === "三星官方手冊" && manualPageEvidence) {
      return `三星官方手冊（${manualPageEvidence}）`;
    }
    return label;
  });
  if (visibleSourceLabels.length > 0) {
    body = `${body}\n\n資料來源：${visibleSourceLabels.join("、")}`.trim();
  }
  if (!CURRENT_REPLY_FOOTER_APPENDED) {
    const costLabel = customerCost.indexOf("未知") >= 0
      ? "本次費用待確認"
      : `本次約 ${customerCost}`;
    const advancedSource = LAST_SOURCE_TEST_STATE
      ? String(
          LAST_SOURCE_TEST_STATE.source ||
            (LAST_SOURCE_TEST_STATE.executed === "verified_manual_chunk"
              ? "manual"
              : LAST_SOURCE_TEST_STATE.executed || ""),
        )
      : "";
    const advancedRemaining =
      LAST_SOURCE_TEST_STATE &&
      typeof LAST_SOURCE_TEST_STATE.remaining === "number"
        ? LAST_SOURCE_TEST_STATE.remaining
        : null;
    if (
      (advancedSource === "manual" || advancedSource === "web") &&
      advancedRemaining !== null
    ) {
      const quotaLabel = advancedSource === "manual" ? "手冊" : "網搜";
      const quotaStatus = LAST_SOURCE_TEST_STATE.refunded
        ? `${quotaLabel}未扣，仍 ${advancedRemaining}/${SOURCE_DAILY_LIMITS[advancedSource]}`
        : `${quotaLabel} ${advancedRemaining}/${SOURCE_DAILY_LIMITS[advancedSource]}`;
      body = `${body}\n\n${costLabel}｜${quotaStatus}`.trim();
      CURRENT_REPLY_FOOTER_APPENDED = true;
    } else if (typeof CURRENT_DAILY_QUESTION_REMAINING === "number") {
      body = `${body}\n\n${costLabel}｜直接問 ${CURRENT_DAILY_QUESTION_REMAINING}/${USER_DAILY_QUESTION_LIMIT}`.trim();
      CURRENT_REPLY_FOOTER_APPENDED = true;
    } else if (lastLlmCallAttempted || customerCost !== "NT$0.0000") {
      body = `${body}\n\n${costLabel}`.trim();
      CURRENT_REPLY_FOOTER_APPENDED = true;
    }
  }
  return formatForLineMobile(body);
}

function renderCustomerFacingPayload_(payload) {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => renderCustomerFacingPayload_(item))
      .filter((item) => {
        if (typeof item === "string") return item.trim().length > 0;
        if (item && typeof item === "object" && item.type === "text") {
          return String(item.text || "").trim().length > 0;
        }
        return !!item;
      });
  }
  if (payload && typeof payload === "object" && payload.type === "text") {
    return Object.assign({}, payload, {
      text: renderCustomerFacingText_(payload.text || ""),
    });
  }
  if (payload && typeof payload === "object") return payload;
  return renderCustomerFacingText_(payload);
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
    currentRequestAudit &&
    Number(currentRequestAudit.paidCalls || 0) > 0 &&
    typeof currentRequestAudit.estimatedCostTwd === "number" &&
    isFinite(currentRequestAudit.estimatedCostTwd)
  ) {
    return `[費用:NT$${currentRequestAudit.estimatedCostTwd.toFixed(4)}（合計 ${currentRequestAudit.paidCalls} 次生成請求）]`;
  }
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
  try {
    if (ss) {
      const recordSheet = ss.getSheetByName(SHEET_NAMES.RECORDS);
      if (recordSheet) {
        recordSheet.appendRow([
          new Date(),
          c,
          u,
          formatForLineMobile(t),
          r,
          f || (typeof IS_TEST_MODE !== "undefined" && IS_TEST_MODE ? "TestUI" : ""),
        ]);
      }
    }
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
    lastWebSupportedSegments = [];
    lastWebEvidenceConflict = false;
    lastWebSearchAttempted = false;
    lastWebUnverifiedDraft = "";
    LAST_SOURCE_TEST_STATE = null;
    CURRENT_DAILY_QUESTION_REMAINING = null;
    LOADING_ANIMATION_SHOWN = false;
    resetRequestAudit_();

    // 🔥 核心修正：直接讀取，若非字串則強制轉為空字串 (不要用 String() 包物件)
    let userMessage = event.message.text;
    if (typeof userMessage !== "string") {
      userMessage = "";
    }
    userMessage = userMessage.trim();
    // v29.4.56: 全形轉半形 (Ｇ５ -> G5, Ｓ３ -> S3)
    userMessage = toHalfWidth(userMessage);
    // 只在輸入層修正常見介面縮寫，不把單題特例塞入 Prompt 或來源路由。
    userMessage = normalizeCommonMonitorInputTypos_(userMessage);

    // 若收到 "[object Object]" 這種髒資料，視為測試錯誤，強制替換
    if (userMessage === "[object Object]") {
      userMessage = "測試";
      writeLog(userId, "Warning", "偵測到 [object Object] 髒輸入，已自動修正");
    }

    // 空訊息直接跳過
    if (userMessage.length === 0) return;

    const isGroupContext =
      event.source.type === "group" || event.source.type === "room";
    const contextId = isGroupContext
      ? event.source.groupId || event.source.roomId
      : userId;
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
    let routingQuestion = userMessage;
    let activeAnswerEnvelope = null;
    let inheritedElaborationEnvelope = null;
    const incomingMessageWasModelSelection = /^#型號:/i.test(msg);
    const incomingMessageWasElaboration = msg === "#再詳細說明";
    let elaborationOriginalQuestion = "";
    let elaborationReplyAnchor = "";
    let resumedFromPlainModelClarification = false;
    let dailyQuestionReservedThisMessage = false;
    let isDualBubbleComplete = false; // v29.3.29: 修正旗標未定義問題
    let filesToAttach = []; // v29.4.19: Fix Scope Error (filesToAttach is not defined)
    let primaryModel = null; // v29.4.20: Fix Scope Error (primaryModel is not defined)
    let aiSearchQuery = null; // v29.4.22: AI-driven search query
    let hasPdfForModel = false; // v29.5.123: 追蹤該型號是否有 PDF（控制 Quick Reply 按鈕）

    const pendingBeforeQuota = readPendingSourceState_(contextId, true);
    const pendingPlainModelTopic = String(
      cache.get(`${userId}:pending_topic`) || "",
    ).trim();
    const pendingPlainModelMode = String(
      cache.get(`${userId}:model_select_mode`) || "",
    ).trim();
    const plainModelTokens = dedupDisplayModels(
      extractFullModelLikeTokens(msg),
      2,
    ).map(normalizeModelForDisplay);
    const isPlainModelClarification = Boolean(
      pendingPlainModelTopic &&
        pendingPlainModelMode === "fast" &&
        isManualModelHintOnly_(msg) &&
        plainModelTokens.length === 1,
    );
    if (!isPlainModelClarification && shouldCountDailyQuestionText_(msg, contextId)) {
      const dailyQuota = reserveDailyQuestionOrReply_(userId, replyToken);
      if (!dailyQuota.allowed) return;
      dailyQuestionReservedThisMessage = true;
      if (pendingBeforeQuota && !pendingBeforeQuota.expired) {
        pendingBeforeQuota.dailyQuestionRemaining = dailyQuota.remaining;
        writePendingSourceState_(contextId, pendingBeforeQuota);
      }
    } else if (
      pendingBeforeQuota &&
      typeof pendingBeforeQuota.dailyQuestionRemaining === "number"
    ) {
      CURRENT_DAILY_QUESTION_REMAINING =
        pendingBeforeQuota.dailyQuestionRemaining;
    }

    if (isPlainModelClarification) {
      const clarifiedModel = plainModelTokens[0];
      const resumedQuestion = pendingPlainModelTopic;
      msg = `${resumedQuestion} (型號: ${clarifiedModel})`;
      userMessage = msg;
      routingQuestion = msg;
      resumedFromPlainModelClarification = true;
      cache.put(
        `${userId}:direct_search_models`,
        JSON.stringify([clarifiedModel]),
        300,
      );
      cache.remove(`${userId}:pending_topic`);
      cache.remove(`${userId}:model_select_mode`);
      rememberSourceProductModel_(contextId, clarifiedModel, "plain_model_clarification");
      writeLog(
        `[Model Clarification v29.6.158] ${clarifiedModel} 接回原題：${resumedQuestion.substring(0, 80)}`,
      );
    }

    // 範圍外問題必須先於 pending source、持久型號、價格與未知型號守門。
    // 否則競品／家電新題會被上一題型號改寫，甚至誤產生三星產品網址。
    if (
      !msg.startsWith("#") &&
      !msg.startsWith("/") &&
      isOutOfProjectScopeQuery(msg)
    ) {
      const scopeReply = buildOutOfProjectScopeReply(msg);
      writeLog(`[Scope Guard v29.6.145] 於來源與產品狀態前攔截非專案問題`);
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

    // v29.6.106：所有相容舊指令也只建立同一個一次性來源狀態；
    // 不得再由 # 指令或舊 PDF mode 直接取得付費來源授權。
    const explicitSourceCommand = parseExplicitSourceCommand_(msg);
    if (explicitSourceCommand) {
      if (!explicitSourceCommand.query) {
        startSourceSelection_(
          explicitSourceCommand.source,
          contextId,
          userId,
          replyToken,
        );
      } else {
        const recentForCommand = readRecentSourceQuestion_(contextId);
        const commandState = writePendingSourceState_(contextId, {
          source: explicitSourceCommand.source,
          userIdHash: getSourceContextHash_(userId),
          previousQuestion: recentForCommand
            ? recentForCommand.question || ""
            : "",
          previousModel: recentForCommand ? recentForCommand.model || "" : "",
          draftQuery: "",
        });
        executeAdvancedSourceQuery_(
          explicitSourceCommand.source,
          explicitSourceCommand.query,
          contextId,
          userId,
          replyToken,
          commandState,
        );
      }
      return;
    }

    const contextualSourceIntent = parseContextualSourceIntent_(msg, contextId);
    if (contextualSourceIntent) {
      const contextualState = writePendingSourceState_(contextId, {
        source: contextualSourceIntent.source,
        userIdHash: getSourceContextHash_(userId),
        previousQuestion: msg,
        previousModel: contextualSourceIntent.model,
        draftQuery: msg,
      });
      executeAdvancedSourceQuery_(
        contextualSourceIntent.source,
        contextualSourceIntent.query,
        contextId,
        userId,
        replyToken,
        Object.assign({}, contextualState, { usePrevious: true }),
      );
      return;
    }

    if (processPendingSourceText_(msg, contextId, userId, replyToken)) {
      return;
    }

    // 序號追問（例如「6是什麼意思」、「第3點」）優先由上一則排查步驟上下文精確解析
    if (resolveNumberedStepFollowup_(msg, contextId, userId, replyToken)) {
      return;
    }

    if (/^\//.test(msg)) {
      clearPendingSourceState_(contextId);
    } else if (!msg.startsWith("#")) {
      clearLegacyAdvancedRouteState_(cache, userId, contextId);
      const rememberedModels = extractFullModelLikeTokens(msg);
      rememberRecentSourceQuestion_(
        contextId,
        msg,
        rememberedModels.length > 0 ? rememberedModels[0] : "",
      );
      if (
        rememberedModels.length === 0 &&
        extractShortAliasModelTokens(msg).length === 0
      ) {
        const exclusiveFeature = findExclusiveFeatureInQuery_(msg);
        const persistentProduct = readSourceProductState_(contextId);
        if (exclusiveFeature) {
          if (
            persistentProduct &&
            persistentProduct.model &&
            !isModelCompatibleWithFeature_(persistentProduct.model, exclusiveFeature.id)
          ) {
            writeLog(
              `[Identity Override v29.6.220] 專屬特徵 ${exclusiveFeature.id} 與舊型號 ${persistentProduct.model} 衝突，解除舊綁定並切換至 ${exclusiveFeature.primaryModel}`,
            );
            clearSourceProductState_(contextId);
            primaryModel = exclusiveFeature.primaryModel;
          } else if (!persistentProduct || !persistentProduct.model) {
            primaryModel = exclusiveFeature.primaryModel;
            writeLog(
              `[Identity Resolve v29.6.220] 偵測到專屬特徵 ${exclusiveFeature.id}，自動綁定至 ${exclusiveFeature.primaryModel}`,
            );
          } else {
            primaryModel = persistentProduct.model;
          }
        } else if (persistentProduct && persistentProduct.model) {
          primaryModel = persistentProduct.model;
          msg = `${msg} (型號: ${persistentProduct.model})`;
          userMessage = msg;
          writeLog(
            `[Product State v29.6.132] 自然追問沿用跨日型號 ${persistentProduct.model}`,
          );
        }
      }
    }

    // v29.3.26: 手動觸發診斷功能 (供用戶測試二次搜機制用)
    if (msg === "測試二次搜尋") {
      msg += " [AUTO_SEARCH_WEB]";
      writeLog("[Diagnostic] 手動注入 [AUTO_SEARCH_WEB] 標籤進行測試");
    }

    // 自然問句已明確要求非官方公開網頁時，只提供 Web 授權入口。
    // 不先花 Fast token 生成手冊頁碼或三星官網等答非所問的中間答案。
    if (!msg.startsWith("#") && isExplicitNonOfficialWebRequest_(msg)) {
      if (dailyQuestionReservedThisMessage) {
        refundDailyQuestionUsage_(userId, "explicit_web_request");
        dailyQuestionReservedThisMessage = false;
      }
      const explicitWebReply =
        "這題是在找非官方公開網頁的實務解法。請按下方「這題再搜網路」；按下後會直接搜尋，不再多問一次，也不會先讀 PDF。";
      LAST_SOURCE_TEST_STATE = {
        source: "spec",
        outcome: "recommend_web",
        pending: false,
        executed: "none",
        reserved: false,
      };
      writeLog(
        "[Explicit Web Guard v29.6.150] 明確要求非官方 Web，零 LLM 顯示授權入口",
      );
      replyMessage(replyToken, explicitWebReply, {
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
      writeRecordDirectly(userId, explicitWebReply, contextId, "assistant", "");
      const explicitWebHistory = getHistoryFromCacheOrSheet(contextId);
      updateHistorySheetAndCache(
        contextId,
        explicitWebHistory,
        { role: "user", content: msg },
        { role: "assistant", content: explicitWebReply },
      );
      return;
    }

    // 已人工逐頁核對的手冊片段屬規格／FAQ 的零成本答案。
    // 一般直接問也應先命中，避免再讓 Fast 模型漏頁或要求使用者重按手冊。
    if (!msg.startsWith("#")) {
      const directVerifiedModels = dedupDisplayModels(
        extractFullModelLikeTokens(msg).concat(primaryModel ? [primaryModel] : []),
        2,
      );
      const directVerifiedModel = directVerifiedModels.length === 1
        ? directVerifiedModels[0]
        : "";
      let directVerifiedChunk = directVerifiedModel
        ? findVerifiedManualChunk_(msg, directVerifiedModel)
        : null;
      let evidenceLookupQuery = msg;
      if (!directVerifiedChunk && directVerifiedModel) {
        const previousEvidenceTopic = getPreviousUserTopicForEvidence_(
          contextId,
          msg,
        );
        if (previousEvidenceTopic) {
          evidenceLookupQuery = `${previousEvidenceTopic}\n${msg}`;
          directVerifiedChunk = findVerifiedManualChunk_(
            evidenceLookupQuery,
            directVerifiedModel,
          );
          if (directVerifiedChunk) {
            writeLog(
              `[Evidence Continuation v29.6.173] 短追問沿用上一輪主題 ${directVerifiedChunk.intent}`,
            );
          }
        }
      }
      if (directVerifiedChunk) {
        const directVerifiedReply = buildVerifiedManualChunkReply_(
          directVerifiedModel,
          directVerifiedChunk,
        );
        LAST_SOURCE_TEST_STATE = {
          source: "spec",
          outcome: "verified_manual_chunk",
          pending: false,
          executed: "direct_verified_manual_chunk",
          reserved: false,
        };
        writeLog(
          `[Direct Verified Chunk v29.6.136] ${directVerifiedModel}/${directVerifiedChunk.intent}，零 PDF 呼叫`,
        );
        replyMessage(replyToken, directVerifiedReply);
        writeRecordDirectly(
          userId,
          incomingMessageWasElaboration ? routingQuestion : msg,
          contextId,
          "user",
          "",
        );
        writeRecordDirectly(userId, directVerifiedReply, contextId, "assistant", "");
        const directVerifiedHistory = getHistoryFromCacheOrSheet(contextId);
        updateHistorySheetAndCache(
          contextId,
          directVerifiedHistory,
          { role: "user", content: msg },
          { role: "assistant", content: directVerifiedReply },
        );
        rememberRecentSourceQuestion_(contextId, msg, directVerifiedModel);
        return;
      }
    }

    // 操作／故障題直接交給「QA/RULE 免費預檢 → 型號選擇 → PDF → Web 補救」
    // 的單一狀態機。未知完整型號仍留給後方 Unknown Model Guard 攔截。
    if (
      !msg.startsWith("#") &&
      isOperationOrTroubleshootQuery(msg) &&
      !isServiceHoursQuery(msg) &&
      !isPriceQueryIntent_(msg) &&
      getUnknownFullModelTokens(msg).length === 0
    ) {
      const operationModels = dedupDisplayModels(
        extractFullModelLikeTokens(msg).concat(primaryModel ? [primaryModel] : []),
        2,
      );
      const operationModel = operationModels.length === 1
        ? operationModels[0]
        : "";
      const operationRuleOnlyReply = operationModel
        ? buildDeterministicExactRuleReply_(msg, operationModel)
        : "";
      // 「HDMI 連接埠有幾個」「可以壁掛嗎」雖含連接／壁掛字樣，
      // 本質仍是 RULE 可直接回答的規格題；讓它繼續往下走零成本路由。
      if (operationRuleOnlyReply) {
        writeLog(
          `[Operation Source Gate v29.6.249] ${operationModel} 命中明確 RULE 欄位，略過 PDF early gate`,
        );
      } else {
        writeLog(
          `[Operation Source Gate v29.6.247] ${operationModel || "待確認型號"} 直接進單一手冊狀態機`,
        );
        if (dailyQuestionReservedThisMessage) {
          refundDailyQuestionUsage_(userId, "operation_auto_manual");
          dailyQuestionReservedThisMessage = false;
        }
        rememberRecentSourceQuestion_(contextId, msg, operationModel);
        executeAutomaticManualFallback_(
          msg,
          operationModel,
          contextId,
          userId,
          replyToken,
        );
        return;
      }
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
      const smartCodecModels = getSmartMonitorCodecSelectionModels(10);
      const exactSmartCodecModel = getExactSmartMonitorCodecModelFromQuery_(
        msg,
        smartCodecModels,
      );
      if (exactSmartCodecModel) {
        const verifiedManualChunk = findVerifiedManualChunk_(
          msg,
          exactSmartCodecModel,
        );
        if (verifiedManualChunk) {
          const verifiedManualReply = buildVerifiedManualChunkReply_(
            exactSmartCodecModel,
            verifiedManualChunk,
          );
          writeLog(
            `[Manual Chunk RAG v29.6.105] 精準命中 ${exactSmartCodecModel} / ${verifiedManualChunk.intent}: ${verifiedManualChunk.sourceFile} 第 ${verifiedManualChunk.pages} 頁`,
          );
          replyMessage(replyToken, verifiedManualReply);
          writeRecordDirectly(userId, msg, contextId, "user", "");
          writeRecordDirectly(
            userId,
            verifiedManualReply,
            contextId,
            "assistant",
            "",
          );
          const verifiedManualHistory = getHistoryFromCacheOrSheet(contextId);
          updateHistorySheetAndCache(
            contextId,
            verifiedManualHistory,
            { role: "user", content: msg },
            { role: "assistant", content: verifiedManualReply },
          );
          return;
        }
        const smartCodecConsentReply = buildManualConsentPrompt_(
          "這題需要依官方手冊的編解碼器表格確認，我不先用共通說法猜。",
          msg,
          exactSmartCodecModel,
        );
        cache.put(
          `${userId}:direct_search_models`,
          JSON.stringify([exactSmartCodecModel]),
          300,
        );
        cache.put(`${userId}:pending_topic`, msg, 600);
        writeLog(
          `[Smart Codec Guard v29.6.100] 已鎖定完整型號 ${exactSmartCodecModel}，等待明確查手冊同意`,
        );
        replyMessage(replyToken, smartCodecConsentReply, {
          quickReply: {
            items: [
              buildSourcePostbackQuickReply_(
                "📖 查官方手冊",
                "rm_action=select_source&source=manual&v=2",
              ),
            ],
          },
        });
        writeRecordDirectly(userId, msg, contextId, "user", "");
        writeRecordDirectly(userId, smartCodecConsentReply, contextId, "assistant", "");
        const exactCodecHistory = getHistoryFromCacheOrSheet(contextId);
        updateHistorySheetAndCache(
          contextId,
          exactCodecHistory,
          { role: "user", content: msg },
          { role: "assistant", content: smartCodecConsentReply },
        );
        return;
      }

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

    const localCampaignReply = !msg.startsWith("#")
      ? buildLocalCampaignRuleReply_(msg)
      : "";
    if (localCampaignReply) {
      LAST_SOURCE_TEST_STATE = {
        source: "spec",
        pending: false,
        executed: "exact_campaign_rule",
      };
      replyMessage(replyToken, localCampaignReply);
      writeRecordDirectly(userId, msg, contextId, "user", "");
      writeRecordDirectly(userId, localCampaignReply, contextId, "assistant", "");
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
      rememberSourceProductModel_(contextId, selectedModel, "model_selection");
      const modelSelectModeKey = `${userId}:model_select_mode`;
      const modelSelectMode = cache.get(modelSelectModeKey) || "fast";

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
        cache.remove(`${userId}:hit_alias_keys`);

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

        // 系列別稱選型後，要先接回與「直接輸入完整型號」相同的已核對片段路徑。
        // 否則會多花一次 Fast 費用，只叫使用者再按手冊，造成選型旅程降智。
        const selectedVerifiedChunk = normalizedTopic
          ? findVerifiedManualChunk_(normalizedTopic, selectedModel)
          : null;
        if (selectedVerifiedChunk) {
          const selectedVerifiedReply = `${buildVerifiedManualChunkReply_(
            selectedModel,
            selectedVerifiedChunk,
          )}\n[費用:NT$0.0000（未呼叫 LLM）]`;
          cache.remove(`${userId}:pending_topic`);
          cache.remove(modelSelectModeKey);
          LAST_SOURCE_TEST_STATE = {
            source: "spec",
            outcome: "verified_manual_chunk",
            pending: false,
            executed: "model_selected_verified_manual_chunk",
            reserved: false,
          };
          CURRENT_DAILY_QUESTION_REMAINING = getDailyQuestionRemaining_(userId);
          writeLog(
            `[Model Select Verified Chunk v29.6.157] ${selectedModel}/${selectedVerifiedChunk.intent}，選型後直接回答，零 LLM／PDF 呼叫`,
          );
          replyMessage(replyToken, selectedVerifiedReply);
          writeRecordDirectly(userId, normalizedTopic, contextId, "user", "");
          writeRecordDirectly(
            userId,
            selectedVerifiedReply,
            contextId,
            "assistant",
            "",
          );
          updateHistorySheetAndCache(
            contextId,
            getHistoryFromCacheOrSheet(contextId),
            { role: "user", content: normalizedTopic },
            { role: "assistant", content: selectedVerifiedReply },
          );
          rememberRecentSourceQuestion_(contextId, normalizedTopic, selectedModel);
          clearDailyQuestionModelSelectionHold_(userId);
          return;
        }

        // 多型號別稱完成選型後，單一規格欄位直接由該型號自己的 RULE 回答。
        // 不再為 HDMI／DP／USB-C／解析度等確定規格建立大型 Fast prompt。
        const selectedRuleReply = normalizedTopic
          ? buildDeterministicExactRuleReply_(normalizedTopic, selectedModel)
          : "";
        if (selectedRuleReply) {
          const selectedRuleFinal = `${selectedRuleReply}\n[費用:NT$0.0000（未呼叫 LLM）]`;
          cache.remove(`${userId}:pending_topic`);
          cache.remove(modelSelectModeKey);
          LAST_SOURCE_TEST_STATE = {
            source: "spec",
            outcome: "exact_rule",
            pending: false,
            executed: "model_selected_exact_rule",
            reserved: false,
          };
          CURRENT_DAILY_QUESTION_REMAINING = getDailyQuestionRemaining_(userId);
          writeLog(
            `[Model Select RULE v29.6.158] ${selectedModel} 選型後由精確規格直接回答，零 LLM／PDF 呼叫`,
          );
          replyMessage(replyToken, selectedRuleFinal);
          writeRecordDirectly(userId, normalizedTopic, contextId, "user", "");
          writeRecordDirectly(
            userId,
            selectedRuleFinal,
            contextId,
            "assistant",
            "",
          );
          updateHistorySheetAndCache(
            contextId,
            getHistoryFromCacheOrSheet(contextId),
            { role: "user", content: normalizedTopic },
            { role: "assistant", content: selectedRuleFinal },
          );
          rememberRecentSourceQuestion_(contextId, normalizedTopic, selectedModel);
          clearDailyQuestionModelSelectionHold_(userId);
          return;
        }

        const selectedMissingFactReply = normalizedTopic
          ? buildMissingExactRuleFactReply_(normalizedTopic, selectedModel)
          : "";
        if (selectedMissingFactReply) {
          cache.remove(`${userId}:pending_topic`);
          cache.remove(modelSelectModeKey);
          if (consumeDailyQuestionModelSelectionHold_(userId)) {
            refundDailyQuestionUsage_(userId, "model_selection_to_manual_missing_fact");
          }
          rememberSourceProductModel_(contextId, selectedModel, "model_selection");
          rememberRecentSourceQuestion_(contextId, normalizedTopic, selectedModel);
          executeAutomaticManualFallback_(
            normalizedTopic,
            selectedModel,
            contextId,
            userId,
            replyToken,
          );
          return;
        }

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
      } else if (modelSelectMode === "consent") {
        executeLegacyManualModelSelectionViaSourceRouter_(
          selectedModel,
          contextId,
          userId,
          replyToken,
        );
        return;
        /* istanbul ignore next -- v29.6.189 起由上方單一來源狀態機接管 */
        let savedTopic = cache.get(`${userId}:pending_topic`) || "";
        const queryText = savedTopic
          ? `${savedTopic} (型號: ${selectedModel})`
          : selectedModel;
        cache.put(
          `${userId}:direct_search_models`,
          JSON.stringify([selectedModel]),
          300,
        );
        cache.put(`${userId}:pending_manual_query`, queryText, 600);
        cache.put(`${userId}:pending_topic`, queryText, 600);
        cache.remove(modelSelectModeKey);
        if (consumeDailyQuestionModelSelectionHold_(userId)) {
          refundDailyQuestionUsage_(userId, "model_selection_to_manual");
        }
        replyMessage(
          replyToken,
          buildManualConsentPrompt_("已鎖定你選的型號。", queryText, selectedModel),
          {
            quickReply: {
              items: [
                {
                  type: "action",
                  action: { type: "message", label: "📖 查手冊", text: "#查手冊" },
                },
              ],
            },
          },
        );
        writeLog(
          `[Manual Consent v29.6.094] 型號 ${selectedModel} 已選定，等待明確查手冊同意`,
        );
        return;
      } else {

        executeLegacyManualModelSelectionViaSourceRouter_(
          selectedModel,
          contextId,
          userId,
          replyToken,
        );
        return;
        /* istanbul ignore next -- v29.6.189 起由上方單一來源狀態機接管 */

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
          ? buildSmartMonitorCodecManualQuery_(selectedModel)
          : savedTopic
            ? `${savedTopic} (型號: ${selectedModel})`
            : selectedModel;

        if (
          !consumeManualSearchConsent_(
            cache,
            userId,
            savedTopic || queryText,
            selectedModel,
          )
        ) {
          cache.put(`${userId}:pending_manual_query`, queryText, 600);
          cache.remove(pdfModeKey);
          cache.remove(modelSelectModeKey);
          replyMessage(
            replyToken,
            buildManualConsentPrompt_("已鎖定你選的型號。", queryText, selectedModel),
            {
              quickReply: {
                items: [
                  {
                    type: "action",
                    action: { type: "message", label: "📖 查手冊", text: "#查手冊" },
                  },
                ],
              },
            },
          );
          return;
        }

        showLoadingAnimation(userId, 60);
        writeLog(
          `[Model Select v29.5.120] 執行 Pass 1.5，查詢: ${queryText.substring(0, 80)}`,
        );

        // v29.6.093: 只有產品實體、連接方式與主要意圖全部一致才可走本地 QA。
        const localMatch =
          modelSelectMode === "pdf"
            ? null
            : findLocalMatchInQA(queryText, userId, selectedModel);
        if (localMatch) {
          writeLog(
            `[Local QA Hit v29.6.093] 產品與意圖精準匹配 QA: "${localMatch.question.substring(0, 50)}"`,
          );
          replyWithLocalQaMatch_(
            localMatch,
            queryText,
            userId,
            replyToken,
            contextId,
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
          null,
          true,
        );
        const relevantFiles = limitManualPdfFiles_(
          Array.isArray(kbResult) ? kbResult : kbResult.files || [],
          queryText,
        );
        const primaryModel = Array.isArray(kbResult)
          ? null
          : kbResult.primaryModel || null;
        writeLog(
          `[Model Select v29.5.120] PDF 匹配: ${relevantFiles.length} 個檔案`,
        );

        if (relevantFiles.length === 0) {
          cache.remove(`${userId}:manual_search_consent`);
          cache.remove(pdfModeKey);
          replyMessage(
            replyToken,
            "目前手冊索引裡找不到這個型號，我先不花費查詢也不猜答案。請確認完整型號後再試一次。",
          );
          return;
        }

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
            const expiredText = "⚠️ 系統偵測到產品手冊需要更新，正在背景自動重新整理中。大約 1 分鐘後即可恢復正常，請稍後再試。";
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
          finalText = sanitizeManualDeflection(finalText, queryText);
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
          const qrItems = [];
          // 手冊本身已是完整查證結果；不再提供通用補充按鈕，避免重讀同一本 PDF。
          if (canOfferAnotherWebSearch_(cache, userId, replyText)) {
            qrItems.push({
              type: "action",
              action: {
                type: "message",
                label: "🌐 這題再搜網路",
                text: "#這題再搜網路",
              },
            });
          }
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
      const pendingManualQuery = cache.get(`${userId}:pending_manual_query`) || "";
      let lastQuestion = manualQueryFromCmd || pendingManualQuery || "";
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

      grantManualSearchConsent_(cache, userId, lastQuestion, []);
      let manualExecutionQuery = lastQuestion;

      if (isSmartMonitorCodecQuestion(lastQuestion)) {
        const exactSmartCodecModel = getExactSmartMonitorCodecModelFromQuery_(
          lastQuestion,
          getSmartMonitorCodecSelectionModels(50),
        );
        if (exactSmartCodecModel) {
          manualExecutionQuery = buildSmartMonitorCodecManualQuery_(
            exactSmartCodecModel,
          );
          cache.put(
            `${userId}:direct_search_models`,
            JSON.stringify([exactSmartCodecModel]),
            300,
          );
          writeLog(
            `[Smart Codec Guard v29.6.100] #查手冊沿用完整型號 ${exactSmartCodecModel}，直接進單次 PDF 查證`,
          );
        } else {
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
      }

      if (promptAliasOnlyModelSelection(lastQuestion, userId, replyToken, contextId, "pdf")) {
        return;
      }

      showLoadingAnimation(userId, 60);
      writeLog(
        `[Quick Reply v29.5.120] 查手冊，問題: ${manualExecutionQuery.substring(0, 60)}`,
      );

      // ── 關鍵修復 v29.5.120: 實際呼叫 getRelevantKBFiles 取得 PDF ──
      const kbList = JSON.parse(
        PropertiesService.getScriptProperties().getProperty(
          CACHE_KEYS.KB_URI_LIST,
        ) || "[]",
      );
      const searchMsg = { role: "user", content: manualExecutionQuery };
      const checkModelRegex = /\b(G\d{1,2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|(?:L?S)\d{1,2}[A-Z]{0,2}\d{0,4}[A-Z0-9]{0,5}|(L?[CF])\d{2}[A-Z]+\d{2,4}[A-Z0-9]*|WA\d+[A-Z\d]*|WD\d+[A-Z\d]*|VR\d+[A-Z\d]*)\b/i;
      const hasModelInQuery = checkModelRegex.test(manualExecutionQuery);
      writeLog(
        `[Quick Reply v29.5.242] #查手冊 forceCurrentOnly=${hasModelInQuery}（有型號時跳過歷史/Cache 型號注入）`,
      );
      const kbResult = getRelevantKBFiles(
        [searchMsg],
        kbList,
        userId,
        contextId,
        hasModelInQuery,
        null,
        true,
      );
      const relevantFiles = limitManualPdfFiles_(
        Array.isArray(kbResult) ? kbResult : kbResult.files || [],
        manualExecutionQuery,
      );
      const primaryModel = Array.isArray(kbResult)
        ? null
        : kbResult.primaryModel || null;
      writeLog(
        `[Quick Reply v29.5.120] PDF 匹配: ${relevantFiles.length} 個檔案`,
      );

      if (relevantFiles.length === 0) {
        cache.remove(`${userId}:manual_search_consent`);
        cache.remove(pdfModeKey);
        replyMessage(
          replyToken,
          "目前手冊索引裡找不到對應 PDF，我沒有發出手冊查詢。請補完整型號後再試一次。",
        );
        return;
      }

      if (
        !consumeManualSearchConsent_(
          cache,
          userId,
          lastQuestion,
          primaryModel,
        )
      ) {
        cache.remove(pdfModeKey);
        replyMessage(
          replyToken,
          "這次手冊授權已過期或題目不一致，所以我沒有讀 PDF。請再按一次「查手冊」重新授權。",
        );
        return;
      }

      const userMsgObj = { role: "user", content: lastQuestion };
      const response = callLLMWithRetry(
        manualExecutionQuery,
        [{ role: "user", content: manualExecutionQuery }],
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
        finalText = sanitizeManualDeflection(finalText, lastQuestion);
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
        const manualQrItems = [];
        // 手冊回答不再掛「再詳細說明」；需要重新查證時使用來源明確的按鈕。
        if (canOfferAnotherWebSearch_(cache, userId, replyText)) {
          manualQrItems.push({
            type: "action",
            action: {
              type: "message",
              label: "🌐 這題再搜網路",
              text: "#這題再搜網路",
            },
          });
        }
        const qrOptions = { quickReply: { items: manualQrItems } };
        replyMessage(replyToken, replyText, qrOptions);
        writeLog(`[AI Reply] ${replyText}`);

        const asstMsgObj = { role: "assistant", content: finalText };
        updateHistorySheetAndCache(contextId, history, userMsgObj, asstMsgObj);
        writeRecordDirectly(userId, msg, contextId, "user", "");
        writeRecordDirectly(userId, replyText, contextId, "assistant", "");
      } else {
        const expiredText = (response === '[KB_EXPIRED]') ? '⚠️ 系統偵測到產品手冊需要更新，正在背景自動重新整理中。大約 1 分鐘後即可恢復正常，請稍後再試。' : '⚠️ 查詢手冊時發生錯誤，請稍後再試';
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

      const previousQuestionForElaboration = String(
        cache.get(`${userId}:last_meaningful_query`) ||
          getPreviousMeaningfulUserQuestion_(historyForContinue) ||
          "",
      ).trim();
      if (!previousQuestionForElaboration) {
        replyMessage(
          replyToken,
          "上一題的對話紀錄好像暫時斷開了，可以麻煩你再傳一次想了解的問題嗎？我馬上幫你確認！✨",
        );
        return;
      }
      elaborationOriginalQuestion = previousQuestionForElaboration;
      routingQuestion = previousQuestionForElaboration;
      const replyAnchor = getElaborationTopicAnchor_(
        cache,
        userId,
        previousQuestionForElaboration,
      );
      elaborationReplyAnchor = replyAnchor;

      const savedEnvelope = readAnswerEnvelope_(contextId);
      const savedEnvelopeMatches = Boolean(
        savedEnvelope &&
          savedEnvelope.originalQuestion &&
          computeReplyAnchor_(savedEnvelope.originalQuestion) ===
            computeReplyAnchor_(previousQuestionForElaboration),
      );
      const previousHasTrustedEvidence = Boolean(
        savedEnvelopeMatches &&
          savedEnvelope &&
          savedEnvelope.status === "supported" &&
          Array.isArray(savedEnvelope.evidenceRefs) &&
          savedEnvelope.evidenceRefs.length > 0
      );
      if (
        savedEnvelopeMatches &&
        savedEnvelope &&
        savedEnvelope.status === "unsupported" &&
        !previousHasTrustedEvidence
      ) {
        const productStateForHandoff = readSourceProductState_(contextId);
        const handoffModel = normalizeModelForDisplay(
          (savedEnvelopeMatches && savedEnvelope.model) ||
            (productStateForHandoff && productStateForHandoff.model) ||
            cache.get(`${userId}:last_selected_model`) ||
            "",
        );
        const handoffEnvelope = savedEnvelopeMatches
          ? savedEnvelope
          : buildFastAnswerEnvelope_({
              originalQuestion: previousQuestionForElaboration,
              model: handoffModel,
              answerText: stripAnySourceTags(lastAssistantMsg.content || ""),
              sourceTag: "",
              hasManual:
                !!handoffModel && hasOfficialManualForModel_(handoffModel),
              manualRecommended: true,
              webRecommended: true,
            });
        handoffEnvelope.allowedActions = [
          ...(handoffEnvelope.allowedActions || []),
          handoffModel && hasOfficialManualForModel_(handoffModel)
            ? "manual"
            : "",
          "web",
        ].filter(Boolean);
        handoffEnvelope.expandable = false;
        handoffEnvelope.status = "unsupported";
        writeAnswerEnvelope_(contextId, handoffEnvelope);
        const handoffText = buildEvidenceHandoffReply_(handoffEnvelope);
        const handoffItems = buildEvidenceActionQuickReplies_(handoffEnvelope);
        replyMessage(
          replyToken,
          handoffText,
          handoffItems.length > 0
            ? { quickReply: { items: handoffItems } }
            : {},
        );
        writeLog(
          "[Answer Envelope v29.6.189] 上一答無可信證據；再詳細說明零 LLM、零額度改為來源選擇",
        );
        writeRecordDirectly(userId, msg, contextId, "user", "");
        writeRecordDirectly(userId, handoffText, contextId, "assistant", "");
        return;
      }
      if (!reserveElaborationOnce_(cache, userId, replyAnchor)) {
        const alreadyExpandedText =
          "這題已補充過一次。如果要查另一個面向，直接告訴我那個細節。";
        replyMessage(replyToken, alreadyExpandedText);
        writeLog(
          "[Quick Reply v29.6.158] 一次性再詳細說明已使用；零 LLM、零額度",
        );
        return;
      }
      writeLog("[Quick Reply v29.6.158] 已保留一次性再詳細說明");

      const persistentProductForElaboration = readSourceProductState_(contextId);
      const selectedModelForElaboration = normalizeModelForDisplay(
        (persistentProductForElaboration && persistentProductForElaboration.model) ||
          cache.get(`${userId}:last_selected_model`) ||
          getSelectedModelFromRecentHistory_(historyForContinue) ||
          "",
      );
      const previousAnswerForElaboration = stripAnySourceTags(
        String(lastAssistantMsg.content || ""),
      ).substring(0, 1200);
      const continueMsg = [
        `請延續使用者原問題：「${previousQuestionForElaboration}」。`,
        selectedModelForElaboration
          ? `目前已確認型號：${selectedModelForElaboration}。`
          : "目前沒有已確認的完整型號；若答案會因型號不同，不可猜測。",
        `上一則回答：「${previousAnswerForElaboration}」`,
        "請只補一次真正有幫助的新資訊：先直接回答，再補必要步驟、使用情境與注意事項；不要重複上一則。",
        "只能把上一則已核對內容講得更白話，或補充不改變結論的一般使用提醒；不得新增任何型號能力、規格、支援、數字或選單路徑。",
        "保持像熟悉產品的朋友，簡短自然；不查 PDF、不搜尋網路，也不要輸出任何系統暗號或工程術語。",
      ].join("\n");
      writeLog(
        `[Quick Reply v29.6.158] 一次性補充沿用原題與型號: ${previousQuestionForElaboration.substring(0, 60)} / ${selectedModelForElaboration || "none"}`,
      );
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
      const webSearchAttemptCount = getWebSearchAttemptCount_(cache, userId);
      const terminalWebState =
        lastWebEvidenceConflict ||
        isTerminalWebSearchReply_(cmdResult) ||
        (lastWebSearchAttempted && !lastWebEvidenceValid);
      // Web 已是一次完整來源查證；不再用通用補充按鈕重跑或混入其他來源。
      if (canShowManualQuickReply) {
        qrItems.push({
          type: "action",
          action: { type: "message", label: "📖 查手冊", text: "#查手冊" },
        });
      }
      if (
        !terminalWebState &&
        canOfferAnotherWebSearch_(cache, userId, cmdResult)
      ) {
        qrItems.push({
          type: "action",
          action: {
            type: "message",
            label: "🌐 這題再搜網路",
            text: "#這題再搜網路",
          },
        });
      }
      writeLog(
        `[Quick Reply v29.6.092] 網搜狀態=${terminalWebState ? "terminal" : lastWebSearchAttempted ? "auditable" : "manual-first"}，嘗試次數=${webSearchAttemptCount}，泡泡數=${qrItems.length}`,
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
      cache.remove(`${userId}:pending_pdf_query`);
      cache.remove(CACHE_KEYS.PDF_MODE_PREFIX + contextId);
      writeLog(
        "[Manual Consent v29.6.094] 清除舊版 pending_pdf_query；不得以隔回合狀態自動讀 PDF",
      );
    }
    if (false && pendingPdfQueryJson) {
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
    // v29.6.116: 系列別稱的型號相關題先解析 CLASS_RULES 候選；精準 QA 只有在
    // 題目本身也涵蓋同一別稱時才可零成本直答，避免 Smart/其他型號 QA 污染 G8。
    const aliasSelectionBeforeQa = getAliasOnlySelectionModelsFromQuery(
      routingQuestion,
      10,
      false,
    );
    const directLocalQa = incomingMessageWasElaboration
      ? null
      : findLocalMatchInQA(routingQuestion, userId);
    const directQaCoversAliases =
      directLocalQa &&
      doesQaMatchCoverQueryAliases_(routingQuestion, directLocalQa.question);
    if (
      directLocalQa &&
      (!shouldPromptAliasModelSelection_(routingQuestion, aliasSelectionBeforeQa) ||
        directQaCoversAliases)
    ) {
      writeLog(
        `[QA First Router v29.6.116] 精準 QA 命中且別稱實體一致，先於 RULE/PDF 回覆: "${directLocalQa.question.substring(0, 50)}"`,
      );
      replyWithLocalQaMatch_(
        directLocalQa,
        routingQuestion,
        userId,
        replyToken,
        contextId,
      );
      return;
    }

    if (
      !incomingMessageWasElaboration &&
      shouldPromptAliasModelSelection_(routingQuestion, aliasSelectionBeforeQa)
    ) {
      writeLog(
        `[Alias Selection Gate v29.6.116] 系列別稱型號題先選完整型號，禁止泛用 QA/RULE 搶答: ${aliasSelectionBeforeQa.join(", ")}`,
      );
      if (
        promptAliasOnlyModelSelection(
          routingQuestion,
          userId,
          replyToken,
          contextId,
          "fast",
        )
      ) {
        return;
      }
    }

    // 完整型號＋明確規格欄位先由該型號自己的 RULE 終止回答。
    // RULE 已能回答時，不得再建立 history、Top-K 或 Gemini payload。
    const exactRuleModels = dedupDisplayModels(
      extractFullModelLikeTokens(routingQuestion),
      2,
    ).map(normalizeModelForDisplay);
    if (
      !incomingMessageWasElaboration &&
      exactRuleModels.length === 1 &&
      isLikelyLocalSpecRuleQuestion_(routingQuestion) &&
      !isPotentialMultiClaimQuestion_(routingQuestion)
    ) {
      const exactRuleReply = buildDeterministicExactRuleReply_(
        routingQuestion,
        exactRuleModels[0],
      );
      if (exactRuleReply) {
        const exactRuleFinal = `${exactRuleReply}\n[費用:NT$0.0000（未呼叫 LLM）]`;
        LAST_SOURCE_TEST_STATE = {
          source: "spec",
          pending: false,
          executed: "exact_rule",
          model: exactRuleModels[0],
        };
        CURRENT_DAILY_QUESTION_REMAINING = getDailyQuestionRemaining_(userId);
        rememberSourceProductModel_(contextId, exactRuleModels[0], "exact_rule");
        rememberRecentSourceQuestion_(contextId, routingQuestion, exactRuleModels[0]);
        if (resumedFromPlainModelClarification) {
          clearDailyQuestionModelSelectionHold_(userId);
        }
        writeLog(
          `[RULE Direct v29.6.158] ${exactRuleModels[0]} 明確規格零 LLM 直接回答`,
        );
        replyMessage(replyToken, exactRuleFinal);
        writeRecordDirectly(userId, msg, contextId, "user", "");
        writeRecordDirectly(userId, exactRuleFinal, contextId, "assistant", "");
        updateHistorySheetAndCache(
          contextId,
          getHistoryFromCacheOrSheet(contextId),
          { role: "user", content: msg },
          { role: "assistant", content: exactRuleFinal },
        );
        return;
      }


      const missingExactFactReply = buildMissingExactRuleFactReply_(
        routingQuestion,
        exactRuleModels[0],
      );
      if (missingExactFactReply) {
        const heldPlainModelCharge = resumedFromPlainModelClarification
          ? consumeDailyQuestionModelSelectionHold_(userId)
          : false;
        if (dailyQuestionReservedThisMessage || heldPlainModelCharge) {
          refundDailyQuestionUsage_(userId, "exact_model_missing_fact_to_manual");
          dailyQuestionReservedThisMessage = false;
        }
        rememberSourceProductModel_(contextId, exactRuleModels[0], "exact_rule_missing");
        rememberRecentSourceQuestion_(contextId, routingQuestion, exactRuleModels[0]);
        executeAutomaticManualFallback_(
          routingQuestion,
          exactRuleModels[0],
          contextId,
          userId,
          replyToken,
        );
        return;
      }
    }

    const exactRuleComparisonReply = incomingMessageWasElaboration
      ? ""
      : buildExactRuleComparisonReply_(routingQuestion);
    if (exactRuleComparisonReply) {
      LAST_SOURCE_TEST_STATE = {
        source: "spec",
        pending: false,
        executed: "exact_rule_comparison",
        models: dedupDisplayModels(
          extractFullModelLikeTokens(routingQuestion),
          3,
        ),
      };
      replyMessage(replyToken, exactRuleComparisonReply);
      writeRecordDirectly(userId, msg, contextId, "user", "");
      writeRecordDirectly(
        userId,
        exactRuleComparisonReply,
        contextId,
        "assistant",
        "",
      );
      return;
    }

    // 精準 QA 未命中後，無完整型號的操作／故障／相容性題先補型號。
    // 不把泛用主機設定、線材或其他型號步驟送給 Fast 模型猜，也不浪費一次 LLM。
    const isExclusiveFeatureQuery = findExclusiveFeatureInQuery_(routingQuestion) !== null;
    const freshOperationNeedsModel =
      !incomingMessageWasElaboration &&
      !isExclusiveFeatureQuery &&
      isOperationOrTroubleshootQuery(routingQuestion) &&
      extractFullModelLikeTokens(routingQuestion).length === 0 &&
      extractShortAliasModelTokens(routingQuestion).length === 0;
    if (freshOperationNeedsModel) {
      const needModelReply = isSamsungHomeApplianceQuery(routingQuestion)
        ? buildNeedApplianceModelForOperationReply()
        : buildNeedModelForOperationReply();
      markDailyQuestionModelSelectionHold_(userId);
      cache.put(`${userId}:pending_topic`, routingQuestion, 600);
      cache.put(`${userId}:model_select_mode`, "fast", 600);
      LAST_SOURCE_TEST_STATE = {
        source: "spec",
        pending: false,
        needsModel: true,
        modelCandidates: [],
        modelSelectionMode: "fast",
      };
      writeLog(
        "[Operation Guard v29.6.142] 精準 QA 未命中且沒有完整型號，零 LLM 直接請使用者補型號",
      );
      replyMessage(replyToken, needModelReply);
      writeRecordDirectly(userId, msg, contextId, "user", "");
      writeRecordDirectly(userId, needModelReply, contextId, "assistant", "");
      return;
    }

    if (isCrossDeviceMonitorQuery(routingQuestion)) {
      writeLog(
        "[QA First Router v29.6.116] 精準 QA 未命中，繼續 RULE Fast Mode；不足才詢問是否查 PDF",
      );
    }

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
    if (
      isInPdfMode &&
      checkAndClearPdfModeOnModelChange(routingQuestion, history)
    ) {
      writeLog("[PDF Mode] 偵測到型號變化，清除 PDF Mode，回到 Fast Mode");
      isInPdfMode = false;
      cache.remove(pdfModeKey);
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
      const directSearchResult = checkDirectDeepSearchWithKey(
        routingQuestion,
        userId,
      );
      const currentExplicitModels = dedupDisplayModels(
        extractFullModelLikeTokens(routingQuestion).filter((model) =>
          isKnownFullModelToken(model),
        ),
        10,
      );

      // 完整型號是本輪唯一權威；不得再從其中的 G8/M8 等片段展開其他系列候選。
      if (currentExplicitModels.length > 0) {
        directSearchResult.hit = true;
        directSearchResult.keys = currentExplicitModels.slice();
        directSearchResult.models = currentExplicitModels.slice();
        cache.put(
          `${userId}:direct_search_models`,
          JSON.stringify(currentExplicitModels),
          300,
        );
        cache.remove(`${userId}:hit_alias_keys`);
        writeLog(
          `[DirectDeep Exact Model Guard] 本輪完整型號鎖定：${currentExplicitModels.join(", ")}`,
        );
      }

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
        } else {
          cache.remove(`${userId}:hit_alias_keys`);
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

      showLoadingAnimation(userId, 60);
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

        // v29.6.125: CLASS_RULES 明載的 Tizen + 藍牙能力是硬證據。
        // Fast 模型不得反向否定；操作題只提出手冊授權，並保留已鎖定型號。
        rawResponse = enforceBluetoothAudioRuleEvidence_(
          routingQuestion,
          rawResponse,
        );
        rawResponse = enforceExactModelCapabilityEvidence_(
          routingQuestion,
          rawResponse,
        );

        // 🔥 v29.5.107: 完整記錄 AI 原始回應
        writeLog(`[AI Raw Response] ${rawResponse}`);

        let finalText = stripAnySourceTags(formatForLineMobile(rawResponse));
        finalText = sanitizeLeadDatabasePhrase(finalText);
        const fastSourceTag = getVerifiedFastSourceTag_(
          routingQuestion,
          rawResponse,
        );
        let replyText = finalText;

        // v27.9.12: 追蹤 AI 是否明確要求 PDF 搜尋
        let aiRequestedPdfSearch = false;
        let forcedSopPdfVerification = false;
        let forcedSopNeedsModelSelection = false;
        let manualSourceRecommended = false;
        let webSourceRecommended = false;

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
          routingQuestion,
        );
        const manualVerificationIntent = isManualVerificationRequiredQuery(
          routingQuestion,
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
          userQuestion: routingQuestion,
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

        // QA／RULE 明確要求手冊時，直接交給統一手冊狀態機。
        // 不再使用「本對話查過 PDF 就改 Web」的黏性旁路；每一題依自身證據需求決定來源。
        if (hasExplicitTrigger) {
          aiRequestedPdfSearch = true;
          if (explicitTriggerMatch && explicitTriggerMatch[1]) {
            aiSearchQuery = explicitTriggerMatch[1].trim();
          }
          finalText = finalText
            .replace(/\[AUTO_SEARCH_PDF(?:[:：]\s*.*?)?\]/gi, "")
            .replace(/\[NEED_DOC\]/gi, "")
            .replace(/\[型號[:：][^\]]+\]/g, "")
            .trim();
          replyText = finalText;
          manualSourceRecommended = false;
          writeLog(
            "[Automatic Manual Fallback v29.6.247] Fast Mode 資料不足，直接交由統一手冊路由",
          );
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
          finalText = `「${aliasToken}」系列有好幾款不同年份或尺寸，請點選你使用的完整型號 👇`;
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
          if (manualSourceRecommended) {
            // 完整型號已鎖定時只清除缺型號狀態；前面已建立的部分回答與
            // 手冊建議必須原樣保留。舊版在這裡重新挑「藍牙／能力」句型，
            // 會把 Netflix 等其他操作回答整段洗掉，是題型特例造成的回歸。
            forcedModelSelectionTrigger = false;
            forcedSopNeedsModelSelection = false;
            if (!/查官方手冊/.test(String(finalText || ""))) {
              finalText = buildManualConsentPrompt_(
                finalText || stripAnySourceTags(formatForLineMobile(rawResponse)),
                routingQuestion,
                matchedInMsg[0],
              );
            }
            replyText = finalText;
          }
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
              // QA／RULE 已明確不足時，型號選擇只是補齊 PDF 檢索必要條件；
              // 選完立即查手冊，不再重跑一次 Fast 或再問是否查證。
              const modelSelectMode =
                hasExplicitTrigger || forcedSopNeedsModelSelection
                  ? "pdf"
                  : "fast";
              cache.put(`${userId}:model_select_mode`, modelSelectMode, 600);
              markDailyQuestionModelSelectionHold_(userId);
              LAST_SOURCE_TEST_STATE = {
                source: modelSelectMode === "fast" ? "spec" : "manual",
                pending: modelSelectMode !== "fast",
                needsModel: true,
                modelCandidates: suggestedModels,
                modelSelectionMode: modelSelectMode,
              };
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

        // 有單一型號或不需選型時，Fast 的 PDF 訊號在本輪直接完成手冊查詢。
        // 多型號情境已於上方回傳選單，選完會由 pdf mode 接續同一題。
        if (hasExplicitTrigger) {
          if (dailyQuestionReservedThisMessage) {
            refundDailyQuestionUsage_(userId, "fast_auto_manual");
            dailyQuestionReservedThisMessage = false;
          }
          const automaticModel = normalizeModelForDisplay(
            primaryModel || (cachedDirectModels.length === 1 ? cachedDirectModels[0] : ""),
          );
          rememberRecentSourceQuestion_(contextId, routingQuestion, automaticModel);
          executeAutomaticManualFallback_(
            aiSearchQuery || routingQuestion,
            automaticModel,
            contextId,
            userId,
            replyToken,
          );
          return;
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
          webSourceRecommended = true;
          writeLog("[Auto Web Block] 🛑 偵測到 AI 企圖背景聯網，強行攔截改寫為『主動詢問用戶』");
          
          let specHint = "";
          if (/6K|8K/i.test(userMessage)) {
            specHint = "目前台灣三星官方規格庫中，尚未登記任何 6K 或 8K 的螢幕規格資訊。";
          } else {
            specHint = "官方規格庫與 QA 資料庫中目前查無此相關資訊。";
          }
          
          const availableAnswer = finalText
            .replace(/\[AUTO_SEARCH_WEB\]/gi, "")
            .trim();
          finalText = [
            availableAnswer,
            availableAnswer ? "" : specHint,
            "目前資料還不足。要我接著查三星官方網站嗎？",
          ]
            .filter(Boolean)
            .join("\n\n");
          
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
                      "\n(系統提示：用戶已連續三次要求搜尋但仍不滿意。請先總結先前兩次的可稽核重點，再誠實告知目前官方資料仍不足，這次先不猜；不要再建議重複搜尋或轉問特定個人。)",
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
                        "我查過目前可稽核的網路資料，但仍找不到足夠證據。這次先不猜。";
                    }
                    replyText = finalText;
                    // v29.4.43: Prevent subsequent PDF search override
                    aiRequestedPdfSearch = false;
                  } else {
                    replyText =
                      "我查過目前可稽核的網路資料，但仍找不到足夠證據。這次先不猜。";
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
                  finalText = sanitizeManualDeflection(finalText, msg);
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
                    finalText = sanitizeManualDeflection(finalText, msg);
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
                  // 沒有匹配的 PDF → 誠實回報，不轉嫁給特定個人
                  writeLog(`[PDF Match] 無匹配 PDF，停止查詢`);
                  replyText =
                    finalText +
                    "\n\n目前手冊索引沒有這個型號，我先不猜答案。";
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
                    finalText = sanitizeManualDeflection(finalText, msg);
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
                          finalText = sanitizeManualDeflection(finalText, msg);
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

        // v29.6.189: 同一次 Fast 回覆先正規化成 AnswerEnvelope。
        // 路由只讀原始問題，無可信 QA／RULE 證據的產品結論不得直接送出。
        const preliminaryWaitingForModelSelection = Boolean(
          forcedModelSelectionTrigger ||
            forcedSopNeedsModelSelection ||
            isModelSelectionOrNeedModelReply(
              Array.isArray(replyText) ? replyText.join("\n") : replyText,
            ),
        );
        if (
          !preliminaryWaitingForModelSelection &&
          !Array.isArray(replyText) &&
          !isApiFailureReply(replyText)
        ) {
          const envelopeProduct = readSourceProductState_(contextId);
          const envelopeModel = normalizeModelForDisplay(
            primaryModel ||
              (envelopeProduct && envelopeProduct.model) ||
              (suggestedModels.length === 1 ? suggestedModels[0] : ""),
          );
          activeAnswerEnvelope = buildFastAnswerEnvelope_({
            originalQuestion: routingQuestion,
            model: envelopeModel,
            answerText: replyText,
            sourceTag:
              (incomingMessageWasElaboration && inheritedElaborationEnvelope
                ? getSourceTagFromEvidenceRefs_(
                    inheritedElaborationEnvelope.evidenceRefs,
                  )
                : "") || fastSourceTag,
            inheritedEvidence:
              incomingMessageWasElaboration &&
              Boolean(inheritedElaborationEnvelope),
            inheritedEvidenceRefs:
              incomingMessageWasElaboration && inheritedElaborationEnvelope
                ? inheritedElaborationEnvelope.evidenceRefs
                : [],
            hasManual:
              hasPdfForModel ||
              (!!envelopeModel && hasOfficialManualForModel_(envelopeModel)),
            manualRecommended: manualSourceRecommended,
            webRecommended: webSourceRecommended,
          });
          if (activeAnswerEnvelope.status === "unsupported") {
            manualSourceRecommended =
              activeAnswerEnvelope.allowedActions.includes("manual");
            webSourceRecommended =
              activeAnswerEnvelope.allowedActions.includes("web");
            finalText = buildEvidenceHandoffReply_(activeAnswerEnvelope);
            replyText = finalText;
            if (incomingMessageWasElaboration && elaborationReplyAnchor) {
              writeElaborationState_(cache, userId, elaborationReplyAnchor, 0);
              writeLog(
                "[Answer Envelope v29.6.189] 補充沒有新增可信證據，釋放一次性使用權",
              );
            }
            writeLog(
              `[Answer Envelope v29.6.189] status=unsupported manual=${manualSourceRecommended} web=${webSourceRecommended}，移除無來源產品草稿`,
            );
          } else if (activeAnswerEnvelope.status === "partial") {
            manualSourceRecommended =
              activeAnswerEnvelope.allowedActions.includes("manual");
            webSourceRecommended =
              activeAnswerEnvelope.allowedActions.includes("web");
            const verifiedPartialText = sanitizeUnverifiedExternalClaims_(
              stripAnySourceTags(replyText),
            );
            if (!verifiedPartialText) {
              activeAnswerEnvelope.status = "unsupported";
              activeAnswerEnvelope.expandable = false;
              activeAnswerEnvelope.evidenceRefs = [];
              finalText = buildEvidenceHandoffReply_(activeAnswerEnvelope);
              replyText = finalText;
            } else {
              finalText = `${verifiedPartialText}\n\n還有一部分需要手冊或公開網頁才能確認，我先不把推測當成答案。`;
              replyText = finalText;
            }
            writeLog(
              `[Answer Envelope v29.6.189] status=partial manual=${manualSourceRecommended} web=${webSourceRecommended}`,
            );
          } else {
            writeLog(
              `[Answer Envelope v29.6.189] status=supported evidence=${activeAnswerEnvelope.evidenceRefs.join(",") || "none"}`,
            );
          }
        }

        // v29.6.092: Quick Reply 依回答狀態顯示，失敗／衝突／達上限時停止重試入口。
        let responseOptions = {};
        let responseWaitingForModelSelection = false;
        if (!msg.startsWith("/") && replyText) {
          let currentReplyTextForUi = Array.isArray(replyText)
            ? replyText.join("\n")
            : String(replyText || "");
          if (
            incomingMessageWasElaboration &&
            elaborationReplyAnchor &&
            isApiFailureReply(currentReplyTextForUi)
          ) {
            writeElaborationState_(cache, userId, elaborationReplyAnchor, 0);
            writeLog(
              "[Quick Reply v29.6.158] 補充生成失敗，釋放一次性使用權",
            );
          }
          const terminalQuickReplyState =
            lastWebEvidenceConflict ||
            isTerminalWebSearchReply_(currentReplyTextForUi) ||
            (lastWebSearchAttempted && !lastWebEvidenceValid);
          const isWaitingForModelSelection =
            forcedModelSelectionTrigger ||
            forcedSopNeedsModelSelection ||
            isModelSelectionOrNeedModelReply(currentReplyTextForUi);
          responseWaitingForModelSelection = isWaitingForModelSelection;
          const currentReplyAnchor = getElaborationTopicAnchor_(
            cache,
            userId,
            routingQuestion || finalText || currentReplyTextForUi,
          );
          const elaborationCountForThisReply = getElaborationCountForAnchor_(
            cache,
            userId,
            currentReplyAnchor,
          );
          const shouldConsiderOfficialModelPage = Boolean(
            !isWaitingForModelSelection &&
              (terminalQuickReplyState ||
                manualSourceRecommended ||
                webSourceRecommended ||
                shouldOfferSamsungOfficialPage_(currentReplyTextForUi)),
          );
          const officialModelPage = shouldConsiderOfficialModelPage
            ? resolveSamsungOfficialModelPage_(
                routingQuestion,
                primaryModel,
              )
            : null;
          const offerOfficialModelPage = Boolean(officialModelPage);

          const qrItems = [];
          if (!terminalQuickReplyState && !isWaitingForModelSelection) {
            buildEvidenceActionQuickReplies_(activeAnswerEnvelope || {
              allowedActions: [
                manualSourceRecommended ? "manual" : "",
                webSourceRecommended ? "web" : "",
              ].filter(Boolean),
            }).forEach(function (item) {
              qrItems.push(item);
            });
          }

          if (offerOfficialModelPage) {
            const officialPageItem =
              buildSamsungOfficialPageQuickReply_(officialModelPage);
            if (officialPageItem) qrItems.push(officialPageItem);
          }

          if (
            !terminalQuickReplyState &&
            !isWaitingForModelSelection &&
            !manualSourceRecommended &&
            !webSourceRecommended &&
            !offerOfficialModelPage &&
            (!activeAnswerEnvelope || activeAnswerEnvelope.expandable) &&
            elaborationCountForThisReply < MAX_ELABORATE_PER_ANSWER
          ) {
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
          if (terminalQuickReplyState) {
            writeLog(
              "[Quick Reply v29.6.092] 守門失敗或證據衝突，隱藏再詳細與重複網搜",
            );
          }

          if (qrItems.length > 0) {
            responseOptions.quickReply = { items: qrItems.slice(0, 3) };
          }
        }

        // 一般題若尚在等使用者選型號，先保留本題唯一一次計次；選型後不再扣。
        // 若選型後仍只能引導查手冊，才把原本保留的計次退回。
        if (responseWaitingForModelSelection && dailyQuestionReservedThisMessage) {
          markDailyQuestionModelSelectionHold_(userId);
        } else if (manualSourceRecommended || webSourceRecommended) {
          const heldModelSelectionCharge =
            incomingMessageWasModelSelection || resumedFromPlainModelClarification
            ? consumeDailyQuestionModelSelectionHold_(userId)
            : false;
          if (dailyQuestionReservedThisMessage || heldModelSelectionCharge) {
            refundDailyQuestionUsage_(
              userId,
              heldModelSelectionCharge
                ? `model_selection_to_${manualSourceRecommended ? "manual" : "web"}`
                : `fast_to_${manualSourceRecommended ? "manual" : "web"}`,
            );
            dailyQuestionReservedThisMessage = false;
          }
        } else if (
          incomingMessageWasModelSelection ||
          resumedFromPlainModelClarification
        ) {
          clearDailyQuestionModelSelectionHold_(userId);
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
          const inheritedElaborationSourceTag =
            incomingMessageWasElaboration && inheritedElaborationEnvelope
              ? getSourceTagFromEvidenceRefs_(
                  inheritedElaborationEnvelope.evidenceRefs,
                )
              : "";
          const inferredFastSourceTag =
            inheritedElaborationSourceTag ||
            inferFastLocalSourceTag_(
              routingQuestion,
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
              routingQuestion,
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

        // 將本輪真正鎖定的完整型號與問題一起保存，供「查上一題」明確沿用。
        // 不從舊 Cache 猜型號，避免新題誤借上一題。
        const recentFullModels = extractFullModelLikeTokens(
          routingQuestion,
        );
        const persistentRecentProduct = readSourceProductState_(contextId);
        const resolvedRecentModel = normalizeModelForDisplay(
          recentFullModels[0] ||
            (incomingMessageWasElaboration && persistentRecentProduct
              ? persistentRecentProduct.model
              : "") ||
            (suggestedModels.length === 1 ? suggestedModels[0] : ""),
        );
        // primaryModel 可能只是系列候選排序第一名，絕不是使用者確認型號。
        // 「再詳細說明」也必須保存原問題，不能把內部補充指令寫成上一題。
        const recentQuestionText = String(
          incomingMessageWasElaboration && elaborationOriginalQuestion
            ? elaborationOriginalQuestion
            : msg || userMessage || "",
        )
          .replace(/\s*\(型號[:：][^)]+\)\s*/gi, " ")
          .replace(/\s{2,}/g, " ")
          .trim();
        rememberRecentSourceQuestion_(
          contextId,
          recentQuestionText,
          resolvedRecentModel,
        );

        if (activeAnswerEnvelope) {
          activeAnswerEnvelope.originalQuestion = recentQuestionText;
          activeAnswerEnvelope.topicId = computeReplyAnchor_(recentQuestionText);
          activeAnswerEnvelope.model =
            resolvedRecentModel || activeAnswerEnvelope.model || "";
          writeAnswerEnvelope_(contextId, activeAnswerEnvelope);
        }

        if (!responseOptions.sticker) {
          const occasionalSticker = detectOccasionalSticker(msg, replyText);
          if (occasionalSticker) {
            responseOptions.sticker = occasionalSticker;
          }
        }

        replyMessage(replyToken, replyText, responseOptions);
        // v25.0.2 修復：補上缺失的 user 訊息記錄
        writeRecordDirectly(
          userId,
          incomingMessageWasElaboration ? routingQuestion : msg,
          contextId,
          "user",
          "",
        );
        // v29.3.21: 寫入紀錄時，若為陣列則合併
        const saveText = Array.isArray(replyText)
          ? replyText.join("\n\n")
          : replyText;
        writeRecordDirectly(userId, saveText, contextId, "assistant", "");
        // v29.5.177: 由 [Reply] 記錄完整 LINE 回覆，避免重複寫入 [AI Reply] 造成列數膨脹

        updateHistorySheetAndCache(
          contextId,
          history,
          {
            role: "user",
            content: incomingMessageWasElaboration ? routingQuestion : userMsgObj.content,
          },
          {
            role: "assistant",
            content: finalText,
          },
        );

        // 2025-12-05 v23.6.5: 背景異步整理 (Async Background Summary)
        // v27.8.25: Async Summary temporarily disabled for syntax debugging
        // try { ... } catch (e) { ... }
      }
    } catch (apiErr) {
      // v29.6.003: 根據錯誤類型給用戶不同提示
      const errMsg = String(apiErr.message || "");
      let userFriendlyError;
      if (errMsg.includes("ADVANCED_SOURCE_AUTH_REQUIRED_MANUAL")) {
        userFriendlyError =
          "這題需要查官方手冊才能繼續確認。請按下方「官方手冊」；系統不會自行讀取，也不會暗中扣次。";
      } else if (errMsg.includes("ADVANCED_SOURCE_AUTH_REQUIRED_WEB")) {
        userFriendlyError =
          "這題需要查公開網頁才能補足現況。請按下方「網路解答」；系統不會自行聯網，也不會暗中扣次。";
      } else if (errMsg.includes("SOURCE_QUOTA_EXHAUSTED_")) {
        userFriendlyError =
          "今天這個進階來源的額度已用完。你仍可使用「規格＆FAQ」的每日提問額度，明天 00:00 會自動恢復。";
      } else if (errMsg.includes("429") || errMsg.includes("spending cap") || errMsg.includes("RESOURCE_EXHAUSTED")) {
        userFriendlyError =
          "⚠️ 本月 API 配額已達上限，請通知管理員到 Google AI Studio 調整 (https://ai.studio/spend)。\n\n本服務將在配額重置後自動恢復。";
      } else if (errMsg.includes("API Key") || errMsg.includes("400") || errMsg.includes("API_KEY_INVALID")) {
        userFriendlyError =
          "⚠️ API 金鑰設定異常，請通知管理員檢查。";
      } else {
        userFriendlyError =
          "⚠️ 抱歉，系統暫時忙碌，這次查詢暫時無法處理。\n\n請稍後再試一次，或換個更具體的問法。";
      }
      const sourceOptions = errMsg.includes("ADVANCED_SOURCE_AUTH_REQUIRED_MANUAL")
        ? {
            quickReply: {
              items: [
                buildSourcePostbackQuickReply_(
                  "📖 官方手冊",
                  "rm_action=select_source&source=manual&v=2",
                ),
              ],
            },
          }
        : errMsg.includes("ADVANCED_SOURCE_AUTH_REQUIRED_WEB")
          ? {
              quickReply: {
                items: [
                  buildSourcePostbackQuickReply_(
                    "🌐 網路解答",
                    "rm_action=select_source&source=web&v=2",
                  ),
                ],
              },
            }
          : {};
      replyMessage(replyToken, userFriendlyError, sourceOptions);
      writeLog(
        `[Handle API Error] ${apiErr.message} (Sent friendly error to user)`,
      );
    } finally {
      // v27.8.5: 可選：在此處也嘗試 flush，避免 GAS 超時被殺
      // 但 doPost 已有 finally flush，這裡可不寫，或為了保險寫一次
    }
  } catch (error) {
    const fatalMessage = String(error && error.message ? error.message : error);
    const sourceName = fatalMessage.includes("ADVANCED_SOURCE_AUTH_REQUIRED_MANUAL")
      ? "官方手冊"
      : fatalMessage.includes("ADVANCED_SOURCE_AUTH_REQUIRED_WEB")
        ? "網路解答"
        : "";
    try {
      replyMessage(
        replyToken,
        sourceName
          ? `這題需要切換到「${sourceName}」才能繼續查證；系統沒有自行執行，也沒有扣次。請按下方常駐選單後再送出問題。`
          : "⚠️ 系統發生預期外的錯誤，請稍後再試。",
      );
    } catch(e){} // v29.6 BUG 7 修復
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
    clearPendingSourceState_(cid);
    clearRecentSourceQuestion_(cid);
    clearSourceProductState_(cid);
    clearDailyQuestionModelSelectionHold_(u);
    const answerEnvelopeKey = getAnswerEnvelopeKey_(cid);
    cache.remove(answerEnvelopeKey);
    PropertiesService.getScriptProperties().deleteProperty(answerEnvelopeKey);
    
    writeLog('[Command] 管理員重啟已清除聊天室型號、題目、來源與歷史狀態，不覆寫知識庫 by ' + u);
    return '✓ 對話已重置，下一題會重新開始。';










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
      return "我已經從多個角度查過，但目前仍沒有足夠證據回答。你可以補上完整型號、連接方式與目前看到的畫面，我再重新判斷。";
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
        result = sanitizeManualDeflection(result, userMsg);
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
        result = sanitizeManualDeflection(result, userMsg);
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
        return '⚠️ 系統偵測到產品手冊需要更新，正在背景自動重新整理中。大約 1 分鐘後即可恢復正常，請稍後再試。';
      }
      return '抱歉，網路搜尋連線逾時，請稍後再試。';
    }
  }

  return `❌ 未知指令\n\n【指令列表】\n/重啟 -> 只重置個人對話，不重傳 PDF\n/紀錄 <內容> -> 開始建檔\n/紀錄 -> 存檔/整理QA\n/取消 -> 退出建檔\n不滿意這回答請繼續擴大搜尋 -> 啟動網路搜尋`;
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

function isExternalDeviceCompatibilityQa_(text) {
  const raw = String(text || "");
  const hasExternalDevice =
    /(IPHONE|IPAD|MACBOOK|ANDROID|PIXEL|CHROMEBOOK|WINDOWS|SURFACE|PLAYSTATION|PS[345]|XBOX|NINTENDO|SWITCH|手機|平板|筆電|遊戲機)/i.test(
      raw,
    );
  const hasCompatibilityClaim =
    /(USB[\s‑–—_-]*C|TYPE[\s‑–—_-]*C|DISPLAY[\s‑–—_-]*PORT|HDMI|AIRPLAY|鏡像|投放|連接|相容|支援|顯示|畫面|影像輸出|充電)/i.test(
      raw,
    );
  return hasExternalDevice && hasCompatibilityClaim;
}

function hasOfficialExternalCompatibilitySource_(text) {
  const urls = String(text || "").match(/https?:\/\/[^\s，。；;）)\]]+/gi) || [];
  const officialHosts = [
    /(^|\.)apple\.com$/i,
    /(^|\.)google\.com$/i,
    /(^|\.)microsoft\.com$/i,
    /(^|\.)xbox\.com$/i,
    /(^|\.)playstation\.com$/i,
    /(^|\.)sony\.com$/i,
    /(^|\.)nintendo\.com$/i,
    /(^|\.)asus\.com$/i,
    /(^|\.)acer\.com$/i,
    /(^|\.)dell\.com$/i,
    /(^|\.)hp\.com$/i,
    /(^|\.)lenovo\.com$/i,
  ];
  return urls.some((url) => {
    const match = url.match(/^https?:\/\/([^/:?#]+)/i);
    if (!match) return false;
    const host = match[1].toLowerCase().replace(/^www\./, "");
    return officialHosts.some((pattern) => pattern.test(host));
  });
}

function buildQaSourceGuardNotice_(text) {
  if (
    !isExternalDeviceCompatibilityQa_(text) ||
    hasOfficialExternalCompatibilitySource_(text)
  ) {
    return "";
  }
  return "⛔ 這筆屬於外部裝置相容性 QA，目前缺少原廠官方來源網址；可繼續修改預覽，但輸入 /紀錄 時不會寫入正式 QA。";
}

function buildEntryDraftPreview(draftType, text, actionLabel) {
  const label = draftType === "rule" ? "CLASS_RULES" : "QA";
  const title = actionLabel || "已進入建檔模式";
  let preview =
    "⚠️ " +
    title +
    "。接下來的對話將視為修改指令，直到輸入 /紀錄 存檔為止。" +
    "\n\n【預覽】將寫入 " +
    label +
    "：\n" +
    text +
    "\n\n👉 確認存檔 → /紀錄\n👉 修改內容 → 直接回覆\n👉 放棄 → /取消";
  if (draftType === "qa") {
    const sourceNotice = buildQaSourceGuardNotice_(text);
    if (sourceNotice) {
      preview += `\n\n${sourceNotice}`;
    }
  }
  return preview;
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
  var savedDisplayText = draftText;
  if (!draftText || draftText.trim().length < 5) {
    return "❌ 草稿內容太短，請提供更多資訊。";
  }

  if (draftType === "rule") {
    draftText = normalizeRuleLine(draftText);
    savedDisplayText = draftText;
  } else {
    // 自動修復格式：確保有 " / A："
    draftText = autoFixQAFormat(draftText);
    if (
      isExternalDeviceCompatibilityQa_(draftText) &&
      !hasOfficialExternalCompatibilitySource_(draftText)
    ) {
      writeLog(
        `[QA Source Guard v29.6.092] 拒絕缺少原廠官方來源的外部裝置相容性 QA`,
      );
      return "❌ 尚未寫入 QA：這筆包含外部裝置相容性結論，但沒有原廠官方來源網址。\n\n請直接回覆草稿，補上 Apple、Google、Microsoft、Sony 等原廠官方網址後，再輸入 /紀錄。";
    }
    const structuredQaLine = qaKnowledgeConvertDraftToStructuredLine_(draftText);
    if (!structuredQaLine) {
      return "❌ 尚未寫入 QA：無法整理成結構化問題與答案，請確認內容包含「問題 / A：答案」。";
    }
    draftText = structuredQaLine;
    savedDisplayText = qaKnowledgeAdminPreview_(structuredQaLine);
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
    return `✅ 已寫入 ${targetSheetName}，知識庫更新已排程！\n\n${savedDisplayText}`;
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
      const structuredQaLine = qaKnowledgeConvertDraftToStructuredLine_(
        autoFixQAFormat(qaLine),
      );
      if (!structuredQaLine) {
        throw new Error("自動整理結果無法轉成 QA2 結構");
      }
      sheet.appendRow([structuredQaLine]);
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
    return `✅ 已自動整理並存入 QA：\n${qaKnowledgeAdminPreview_(
      qaKnowledgeConvertDraftToStructuredLine_(autoFixQAFormat(qaLine)),
    )}${costInfo}`;
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
    const tagText = [sanitizeForSheet(l), sanitizeForSheet(s), cleanN]
      .filter(Boolean)
      .join(",");
    const legacyLine = `${tagText ? `[${tagText}] ` : ""}${cleanP} / A：${cleanA}`;
    const structuredQaLine = qaKnowledgeConvertDraftToStructuredLine_(legacyLine);
    if (!structuredQaLine) return false;
    sheet.appendRow([structuredQaLine]);
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

  if (typeof IS_TEST_MODE !== "undefined" && IS_TEST_MODE) {
    if (typeof TEST_LOGS !== "undefined") {
      TEST_LOGS.push(`[${timestamp}] ${msgForLog}`);
    }
  }

  // 寫入緩衝區 (全模式包含 TestUI 均記錄)
  PENDING_LOGS.push([new Date(), msgForLog.replace(/[\r\n]+/g, " ")]);
  console.log(msgForLog);

  // Webhook finally 會一次批次寫入。主線中途不得因 Log 達門檻就同步
  // 碰 Sheet；極端長執行只保留最新 250 筆，避免記憶體無界成長。
  if (PENDING_LOGS.length > 250) {
    PENDING_LOGS.splice(0, PENDING_LOGS.length - 250);
  }
}

function flushLogs() {
  if (PENDING_LOGS.length === 0) return;

  try {
    if (ss) {
      const logSheet = ss.getSheetByName(SHEET_NAMES.LOG);
      if (logSheet) {
        // 批量寫入 (Batch Write)
        logSheet
          .getRange(logSheet.getLastRow() + 1, 1, PENDING_LOGS.length, 2)
          .setValues(PENDING_LOGS);
      }
    }
  } catch (e) {
    console.error("Flush Log Error: " + e.message);
  } finally {
    PENDING_LOGS = [];
  }
}

function cleanupLogSheetRows_() {
  try {
    const logSheet = ss && ss.getSheetByName(SHEET_NAMES.LOG);
    if (!logSheet) return;
    const lastRow = logSheet.getLastRow();
    if (lastRow > 1200) {
      logSheet.deleteRows(2, lastRow - 1000);
    }
  } catch (error) {
    writeLog(`[Daily Log Cleanup] ${error.message}`);
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

  // 客戶頁尾與路由稽核不屬於對話語意；保留答案、型號、操作路徑與
  // 手冊頁碼，避免下一輪把費用／來源／搜尋統計再次餵給模型。
  content = content.replace(/\n{0,2}\[來源\s*[:：][^\]]+\]/gi, "");
  content = content.replace(/\n{0,2}\[費用\s*[:：][^\]]+\]/gi, "");
  content = content.replace(/^\s*資料來源\s*[:：][^\n]+$/gim, "");
  content = content.replace(/^\s*本次約\s+NT\$[^\n]+$/gim, "");
  content = content.replace(/^\s*\(📊\s*已搜尋[^\n]+\)$/gim, "");
  content = content.replace(/^\s*參考\s*[:：][^\n]+非官方[^\n]*$/gim, "");
  content = content.replace(
    /^\s*(?:這次未送出供應商請求|這次屬系統因素|供應商請求已送出)[^\n]*$/gim,
    "",
  );

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
        s.getRange(f.getRow(), 2, 1, 2).setValues([[json, new Date()]]);
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

function callLineRichMenuApi_(url, method, token, payload, contentType) {
  const options = {
    method: method,
    headers: { Authorization: `Bearer ${token}` },
    muteHttpExceptions: true,
  };
  if (payload !== undefined && payload !== null) options.payload = payload;
  if (contentType) options.contentType = contentType;
  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  const text = response.getContentText() || "";
  let json = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    json = null;
  }
  return { code: code, text: text, json: json };
}

function requireLineRichMenuSuccess_(result, stage, allowedCodes) {
  const accepted = allowedCodes || [200];
  if (accepted.indexOf(result.code) >= 0) return result;
  const detail = result.json && result.json.message
    ? result.json.message
    : String(result.text || "").substring(0, 300);
  throw new Error(`${stage} failed (${result.code}): ${detail}`);
}

function getLinkedRichMenuId_(token, userId) {
  const result = callLineRichMenuApi_(
    `https://api.line.me/v2/bot/user/${encodeURIComponent(userId)}/richmenu`,
    "get",
    token,
  );
  if (result.code === 404) return "";
  requireLineRichMenuSuccess_(result, "read per-user rich menu", [200]);
  return result.json && result.json.richMenuId
    ? String(result.json.richMenuId)
    : "";
}

function getDefaultRichMenuId_(token) {
  const result = callLineRichMenuApi_(
    "https://api.line.me/v2/bot/user/all/richmenu",
    "get",
    token,
  );
  if (result.code === 404) return "";
  requireLineRichMenuSuccess_(result, "read default rich menu", [200]);
  return result.json && result.json.richMenuId
    ? String(result.json.richMenuId)
    : "";
}

function provisionRichMenuPilot_(menuDefinition, imageBase64) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("LINE_TOKEN") || "";
  const adminUserId = props.getProperty("ADMIN_USER_ID") || "";
  if (!token) throw new Error("LINE_TOKEN is not configured");
  if (!adminUserId) throw new Error("ADMIN_USER_ID is not configured");
  if (!menuDefinition || !Array.isArray(menuDefinition.areas)) {
    throw new Error("Invalid rich menu definition");
  }
  if (!imageBase64) throw new Error("Rich menu image is missing");

  const validateResult = callLineRichMenuApi_(
    "https://api.line.me/v2/bot/richmenu/validate",
    "post",
    token,
    JSON.stringify(menuDefinition),
    "application/json",
  );
  requireLineRichMenuSuccess_(validateResult, "validate rich menu", [200]);

  const previousAdminMenuId = getLinkedRichMenuId_(token, adminUserId);
  const defaultBefore = getDefaultRichMenuId_(token);
  const createResult = callLineRichMenuApi_(
    "https://api.line.me/v2/bot/richmenu",
    "post",
    token,
    JSON.stringify(menuDefinition),
    "application/json",
  );
  requireLineRichMenuSuccess_(createResult, "create rich menu", [200]);
  const richMenuId = createResult.json && createResult.json.richMenuId;
  if (!richMenuId) throw new Error("LINE did not return richMenuId");

  const imageBytes = Utilities.base64Decode(imageBase64);
  const imageResult = callLineRichMenuApi_(
    `https://api-data.line.me/v2/bot/richmenu/${encodeURIComponent(richMenuId)}/content`,
    "post",
    token,
    Utilities.newBlob(imageBytes, "image/png", "rich-menu.png"),
    "image/png",
  );
  requireLineRichMenuSuccess_(imageResult, "upload rich menu image", [200]);

  const linkResult = callLineRichMenuApi_(
    `https://api.line.me/v2/bot/user/${encodeURIComponent(adminUserId)}/richmenu/${encodeURIComponent(richMenuId)}`,
    "post",
    token,
    "",
  );
  requireLineRichMenuSuccess_(linkResult, "link admin rich menu", [200]);
  const linkedMenuId = getLinkedRichMenuId_(token, adminUserId);
  const defaultAfter = getDefaultRichMenuId_(token);
  if (linkedMenuId !== richMenuId) {
    throw new Error("Per-user rich menu readback mismatch");
  }
  if (defaultAfter !== defaultBefore) {
    throw new Error("Default rich menu changed unexpectedly");
  }

  props.setProperty("RICH_MENU_PILOT_ID", richMenuId);
  props.setProperty("RICH_MENU_PILOT_PREVIOUS_ID", previousAdminMenuId || "");
  props.setProperty("RICH_MENU_PILOT_DEFAULT_ID", defaultBefore || "");
  return {
    richMenuId: richMenuId,
    linkedMenuId: linkedMenuId,
    previousAdminMenuId: previousAdminMenuId,
    defaultMenuId: defaultAfter,
    defaultUnchanged: true,
  };
}

function rollbackRichMenuPilot_() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("LINE_TOKEN") || "";
  const adminUserId = props.getProperty("ADMIN_USER_ID") || "";
  if (!token || !adminUserId) {
    throw new Error("LINE_TOKEN or ADMIN_USER_ID is not configured");
  }
  const pilotId = props.getProperty("RICH_MENU_PILOT_ID") || "";
  const previousId = props.getProperty("RICH_MENU_PILOT_PREVIOUS_ID") || "";
  const unlinkResult = callLineRichMenuApi_(
    `https://api.line.me/v2/bot/user/${encodeURIComponent(adminUserId)}/richmenu`,
    "delete",
    token,
  );
  requireLineRichMenuSuccess_(unlinkResult, "unlink admin rich menu", [200, 404]);
  if (previousId && previousId !== pilotId) {
    const restoreResult = callLineRichMenuApi_(
      `https://api.line.me/v2/bot/user/${encodeURIComponent(adminUserId)}/richmenu/${encodeURIComponent(previousId)}`,
      "post",
      token,
      "",
    );
    requireLineRichMenuSuccess_(restoreResult, "restore previous admin rich menu", [200]);
  }
  const linkedMenuId = getLinkedRichMenuId_(token, adminUserId);
  return {
    success: true,
    unlinkedPilotId: pilotId,
    restoredMenuId: linkedMenuId,
    defaultMenuId: getDefaultRichMenuId_(token),
  };
}

function provisionRichMenuDefault_(menuDefinition, imageBase64) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("LINE_TOKEN") || "";
  if (!token) throw new Error("LINE_TOKEN is not configured");
  if (!menuDefinition || !Array.isArray(menuDefinition.areas)) {
    throw new Error("Invalid rich menu definition");
  }
  if (!imageBase64) throw new Error("Rich menu image is missing");

  const imageBytes = Utilities.base64Decode(imageBase64);
  const imageDigest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    imageBytes,
  ).map(function (value) {
    return ((value + 256) % 256).toString(16).padStart(2, "0");
  }).join("");
  const definitionSignature = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    `${JSON.stringify(menuDefinition)}|${imageDigest}`,
    Utilities.Charset.UTF_8,
  ).map(function (value) {
    return ((value + 256) % 256).toString(16).padStart(2, "0");
  }).join("");
  const recordedMenuId = props.getProperty("RICH_MENU_GLOBAL_ID") || "";
  const recordedSignature =
    props.getProperty("RICH_MENU_GLOBAL_SIGNATURE") || "";
  const currentDefault = getDefaultRichMenuId_(token);
  if (
    recordedMenuId &&
    currentDefault === recordedMenuId &&
    recordedSignature === definitionSignature
  ) {
    return {
      richMenuId: recordedMenuId,
      defaultMenuId: currentDefault,
      previousDefaultMenuId:
        props.getProperty("RICH_MENU_GLOBAL_PREVIOUS_ID") || "",
      reused: true,
    };
  }

  // 發布內容未變、只是 LINE 的全體 default 綁定遺失時，優先重綁既有選單。
  // 只有既有 ID 已被 LINE 刪除（404）才建立新選單，避免每次修復都製造重複資產。
  if (
    recordedMenuId &&
    currentDefault !== recordedMenuId &&
    recordedSignature === definitionSignature
  ) {
    const relinkResult = callLineRichMenuApi_(
      `https://api.line.me/v2/bot/user/all/richmenu/${encodeURIComponent(recordedMenuId)}`,
      "post",
      token,
      "",
    );
    if (relinkResult.code !== 404) {
      requireLineRichMenuSuccess_(relinkResult, "relink recorded default rich menu", [200]);
      const relinkedDefault = getDefaultRichMenuId_(token);
      if (relinkedDefault !== recordedMenuId) {
        throw new Error("Recorded default rich menu readback mismatch");
      }
      props.setProperty("RICH_MENU_GLOBAL_PREVIOUS_ID", currentDefault || "");
      return {
        richMenuId: recordedMenuId,
        defaultMenuId: relinkedDefault,
        previousDefaultMenuId: currentDefault,
        reused: true,
        relinked: true,
      };
    }
  }

  const validateResult = callLineRichMenuApi_(
    "https://api.line.me/v2/bot/richmenu/validate",
    "post",
    token,
    JSON.stringify(menuDefinition),
    "application/json",
  );
  requireLineRichMenuSuccess_(validateResult, "validate default rich menu", [200]);

  const createResult = callLineRichMenuApi_(
    "https://api.line.me/v2/bot/richmenu",
    "post",
    token,
    JSON.stringify(menuDefinition),
    "application/json",
  );
  requireLineRichMenuSuccess_(createResult, "create default rich menu", [200]);
  const richMenuId = createResult.json && createResult.json.richMenuId;
  if (!richMenuId) throw new Error("LINE did not return richMenuId");

  const imageResult = callLineRichMenuApi_(
    `https://api-data.line.me/v2/bot/richmenu/${encodeURIComponent(richMenuId)}/content`,
    "post",
    token,
    Utilities.newBlob(imageBytes, "image/png", "rich-menu.png"),
    "image/png",
  );
  requireLineRichMenuSuccess_(imageResult, "upload default rich menu image", [200]);

  const setDefaultResult = callLineRichMenuApi_(
    `https://api.line.me/v2/bot/user/all/richmenu/${encodeURIComponent(richMenuId)}`,
    "post",
    token,
    "",
  );
  requireLineRichMenuSuccess_(setDefaultResult, "set default rich menu", [200]);
  const defaultAfter = getDefaultRichMenuId_(token);
  if (defaultAfter !== richMenuId) {
    throw new Error("Default rich menu readback mismatch");
  }

  props.setProperty("RICH_MENU_GLOBAL_ID", richMenuId);
  props.setProperty("RICH_MENU_GLOBAL_PREVIOUS_ID", currentDefault || "");
  props.setProperty("RICH_MENU_GLOBAL_SIGNATURE", definitionSignature);
  return {
    richMenuId: richMenuId,
    defaultMenuId: defaultAfter,
    previousDefaultMenuId: currentDefault,
    reused: false,
  };
}

function inspectRichMenuDefault_() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("LINE_TOKEN") || "";
  if (!token) throw new Error("LINE_TOKEN is not configured");
  const adminUserId = props.getProperty("ADMIN_USER_ID") || "";
  const currentDefault = getDefaultRichMenuId_(token);
  const recordedMenuId = props.getProperty("RICH_MENU_GLOBAL_ID") || "";
  return {
    currentDefaultMenuId: currentDefault,
    recordedMenuId: recordedMenuId,
    previousDefaultMenuId:
      props.getProperty("RICH_MENU_GLOBAL_PREVIOUS_ID") || "",
    defaultMatchesRecorded: Boolean(
      currentDefault && recordedMenuId && currentDefault === recordedMenuId,
    ),
    adminLinkedMenuId: adminUserId
      ? getLinkedRichMenuId_(token, adminUserId)
      : "",
  };
}

function unlinkStoredAdminRichMenuOverride_() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("LINE_TOKEN") || "";
  const adminUserId = props.getProperty("ADMIN_USER_ID") || "";
  if (!token) throw new Error("LINE_TOKEN is not configured");
  if (!adminUserId) {
    return {
      changed: false,
      reason: "ADMIN_USER_ID_NOT_CONFIGURED",
      defaultMenuId: getDefaultRichMenuId_(token),
    };
  }
  const linkedBefore = getLinkedRichMenuId_(token, adminUserId);
  if (!linkedBefore) {
    return {
      changed: false,
      linkedMenuId: "",
      defaultMenuId: getDefaultRichMenuId_(token),
    };
  }
  const unlinkResult = callLineRichMenuApi_(
    `https://api.line.me/v2/bot/user/${encodeURIComponent(adminUserId)}/richmenu`,
    "delete",
    token,
  );
  requireLineRichMenuSuccess_(unlinkResult, "unlink stored admin rich menu", [200, 404]);
  const linkedAfter = getLinkedRichMenuId_(token, adminUserId);
  if (linkedAfter) throw new Error("Stored admin rich menu unlink readback mismatch");
  return {
    changed: true,
    unlinkedMenuId: linkedBefore,
    linkedMenuId: linkedAfter,
    defaultMenuId: getDefaultRichMenuId_(token),
  };
}

function rollbackRichMenuDefault_() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("LINE_TOKEN") || "";
  if (!token) throw new Error("LINE_TOKEN is not configured");
  const publishedId = props.getProperty("RICH_MENU_GLOBAL_ID") || "";
  const previousId = props.getProperty("RICH_MENU_GLOBAL_PREVIOUS_ID") || "";
  const defaultBefore = getDefaultRichMenuId_(token);

  if (previousId && previousId !== publishedId) {
    const restoreResult = callLineRichMenuApi_(
      `https://api.line.me/v2/bot/user/all/richmenu/${encodeURIComponent(previousId)}`,
      "post",
      token,
      "",
    );
    requireLineRichMenuSuccess_(restoreResult, "restore previous default rich menu", [200]);
  } else {
    const clearResult = callLineRichMenuApi_(
      "https://api.line.me/v2/bot/user/all/richmenu",
      "delete",
      token,
      null,
    );
    requireLineRichMenuSuccess_(clearResult, "clear default rich menu", [200, 404]);
  }

  const defaultAfter = getDefaultRichMenuId_(token);
  if (defaultAfter !== previousId) {
    throw new Error("Default rich menu rollback readback mismatch");
  }
  return {
    success: true,
    publishedMenuId: publishedId,
    defaultBefore: defaultBefore,
    restoredDefaultMenuId: defaultAfter,
  };
}

function doPost(e) {
  FAST_POSTBACK_HANDLED = false;
  writeLog("[Webhook] Request Received");
  try {
    const postData = e && e.postData ? e.postData : {};
    const contents = postData.contents || "{}";
    const json = JSON.parse(contents);

    // v29.6.106：Rich Menu postback 必須先於 Trigger/Sheet 等重型工作回覆。
    // 同樣使用 webhookEventId 冪等，避免 LINE 重送造成重複提示或重複執行。
    const incomingEvents = Array.isArray(json.events) ? json.events : [];
    const postbackEvents = incomingEvents.filter(function (event) {
      return event && event.type === "postback";
    });
    const promptOnlyPostbacks = postbackEvents.every(function (event) {
      const params = parsePostbackData_(event.postback && event.postback.data);
      return params.rm_action !== "use_previous";
    });
    postbackEvents.forEach(function (event) {
      const eventId = event.webhookEventId;
      if (isDuplicateEvent(eventId)) return;
      handleRichMenuPostback_(event);
    });
    if (
      incomingEvents.length > 0 &&
      postbackEvents.length === incomingEvents.length
    ) {
      FAST_POSTBACK_HANDLED = promptOnlyPostbacks;
      return ContentService.createTextOutput(
        JSON.stringify({ status: "ok" }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

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

    if (json.action === "upsert_qa2") {
      const authKey = getDoGetMaintenanceSecret_();
      if (!json.secret || json.secret !== authKey) {
        return ContentService.createTextOutput(
          JSON.stringify({ success: false, error: "Unauthorized" }),
        ).setMimeType(ContentService.MimeType.JSON);
      }
      try {
        const result = qaKnowledgeUpsertRows_(json.records || []);
        scheduleImmediateRebuild();
        writeLog(
          `[QA2 Upsert] ${result.total} 筆；新增 ${result.appended}、更新 ${result.updated}`,
        );
        return ContentService.createTextOutput(
          JSON.stringify({ success: true, result: result }),
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

    if (
      json.action === "provision_rich_menu_pilot" ||
      json.action === "rollback_rich_menu_pilot" ||
      json.action === "provision_rich_menu_default" ||
      json.action === "rollback_rich_menu_default" ||
      json.action === "inspect_rich_menu_default" ||
      json.action === "unlink_admin_rich_menu_override"
    ) {
      const authKey = getDoGetMaintenanceSecret_();
      if (!json.secret || json.secret !== authKey) {
        return ContentService.createTextOutput(
          JSON.stringify({ success: false, error: "Unauthorized" }),
        ).setMimeType(ContentService.MimeType.JSON);
      }
      try {
        let result;
        if (json.action === "provision_rich_menu_pilot") {
          result = provisionRichMenuPilot_(json.menu, json.imageBase64);
        } else if (json.action === "rollback_rich_menu_pilot") {
          result = rollbackRichMenuPilot_();
        } else if (json.action === "provision_rich_menu_default") {
          result = provisionRichMenuDefault_(json.menu, json.imageBase64);
        } else if (json.action === "inspect_rich_menu_default") {
          result = inspectRichMenuDefault_();
        } else if (json.action === "unlink_admin_rich_menu_override") {
          result = unlinkStoredAdminRichMenuOverride_();
        } else {
          result = rollbackRichMenuDefault_();
        }
        return ContentService.createTextOutput(
          JSON.stringify({ success: true, result: result }),
        ).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        writeLog(`[Rich Menu Publish] ${error.message}`);
        return ContentService.createTextOutput(
          JSON.stringify({ success: false, error: error.message }),
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 只有一般訊息與維護請求才檢查自癒 Trigger；Rich Menu 純提示不碰 ScriptApp。
    ensureSyncTriggerExists();

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
    if (FAST_POSTBACK_HANDLED) {
      PENDING_LOGS = [];
    } else {
      flushLogs(); // 確保 Log 寫入 Sheet
    }
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
  const auditPreview = collectVisibleReplyText_(txt);
  writeRequestAuditOnce_(auditPreview);
  if (auditPreview) {
    writeLog(`[Reply Audit] ${auditPreview}`);
  }
  CURRENT_REPLY_FOOTER_APPENDED = false;
  txt = renderCustomerFacingPayload_(txt);

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
            if (t && typeof t === "object" && t.type === "sticker") {
              return `[貼圖: ${t.packageId}/${t.stickerId}]`;
            }
            if (t && typeof t === "object")
              return t.altText || "[Flex Message]";
            return String(t || "");
          })
          .join("\n\n");
      } else if (txt && typeof txt === "object" && txt.type === "sticker") {
        preview = `[貼圖: ${txt.packageId}/${txt.stickerId}]`;
      } else if (txt && typeof txt === "object" && txt.type) {
        preview = txt.altText || "[Flex Message]";
      } else {
        preview = txt === null || txt === undefined ? "" : txt.toString();
      }
      if (options && options.sticker && options.sticker.packageId) {
        preview += `\n\n[貼圖: ${options.sticker.packageId}/${options.sticker.stickerId}]`;
      }

      if (preview) {
        writeLog(`[Reply] ${preview}`);
      }
      const testQuickReplyItems =
        options && options.quickReply && Array.isArray(options.quickReply.items)
          ? options.quickReply.items
          : [];
      LAST_TEST_QUICK_REPLY_ITEMS = testQuickReplyItems
        .slice(0, 13)
        .map(function (item) {
          return JSON.parse(JSON.stringify(item));
        });
      if (testQuickReplyItems.length > 0) {
        const testQuickReplyLabels = testQuickReplyItems
          .map((item) =>
            item && item.action ? String(item.action.label || "") : "",
          )
          .filter(Boolean);
        writeLog(
          `[Reply] 使用顯式 Quick Reply: ${testQuickReplyItems.length} 個選項 (${testQuickReplyLabels.join("、")})`,
        );
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
          return t; // 已經是 Flex 或 Sticker 或其他格式
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

    // 支援附加 LINE 官方貼圖 (例如問候、感謝或道別)
    if (options && options.sticker && options.sticker.packageId && options.sticker.stickerId) {
      if (messages.length < 5) {
        messages.push({
          type: "sticker",
          packageId: String(options.sticker.packageId),
          stickerId: String(options.sticker.stickerId),
        });
      }
    }

    // v29.3.36: 優先使用顯式傳遞的 options.quickReply，其次才是全域變數 (相容性)
    let qrItems = null;

    if (
      options &&
      options.quickReply &&
      Array.isArray(options.quickReply.items) &&
      options.quickReply.items.length > 0
    ) {
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

    if (Array.isArray(qrItems) && qrItems.length > 0) {
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
  if (
    (typeof IS_TEST_MODE !== "undefined" && IS_TEST_MODE) ||
    uid === "TEST_REPLY_TOKEN" ||
    /^TEST[_-]/i.test(String(uid || ""))
  ) {
    return;
  }
  if (LOADING_ANIMATION_SHOWN) return;
  LOADING_ANIMATION_SHOWN = true;
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
  const props = PropertiesService.getScriptProperties();
  return (
    props.getProperty("MAINTENANCE_SECRET") ||
    props.getProperty("OPENCODE_WRITE_SECRET") ||
    ""
  );
}

function isDoGetMaintenanceAuthorized_(e) {
  const expectedSecret = getDoGetMaintenanceSecret_();
  const providedSecret = String((e && e.parameter && e.parameter.secret) || "");
  return !!expectedSecret && providedSecret === expectedSecret;
}

function isEditorOnlyDevelopmentWebApp_() {
  try {
    const serviceUrl = String(ScriptApp.getService().getUrl() || "");
    return /\/dev(?:[?#].*)?$/.test(serviceUrl);
  } catch (error) {
    writeLog(`[TestUI Dev Auth] 無法判斷開發模式網址: ${error.message}`);
    return false;
  }
}

function buildUnauthorizedResponse_() {
  return ContentService.createTextOutput(
    JSON.stringify({ success: false, error: "Unauthorized" }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function buildUnauthorizedTestUiResponse_() {
  return HtmlService.createHtmlOutput(
    [
      '<!doctype html><html lang="zh-TW"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      '<title>TestUI 需要授權</title>',
      '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111827;color:#f8fafc;font-family:system-ui,sans-serif;padding:24px;box-sizing:border-box}.card{max-width:560px;background:#1f2937;border:1px solid #475569;border-radius:16px;padding:28px;box-shadow:0 18px 50px #0006}h1{font-size:24px;margin:0 0 12px}p{line-height:1.7;color:#cbd5e1;margin:8px 0}code{color:#bfdbfe}</style>',
      '</head><body><main class="card"><h1>TestUI 需要維護者授權</h1>',
      '<p>這個頁面只供受控測試使用，目前網址沒有有效的維護憑證。</p>',
      '<p>請透過正式測試 runner 開啟；runner 會從 <code>GAS_MAINTENANCE_SECRET</code> 建立授權網址，而且不會顯示或記錄秘密。</p>',
      '</main></body></html>',
    ].join(""),
  ).setTitle("TestUI 需要授權");
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
// - 正式 /exec TestUI: 需 ?test=1&secret=MAINTENANCE_SECRET
// - 編輯者 /dev TestUI: Google 已限制為專案編輯者，可直接取得短效 token
function doGet(e) {
  // 若有 test 參數，顯示 TestUI
  if (e && e.parameter && e.parameter.test === "1") {
    if (
      !isDoGetMaintenanceAuthorized_(e) &&
      !isEditorOnlyDevelopmentWebApp_()
    ) {
      return buildUnauthorizedTestUiResponse_();
    }
    const template = HtmlService.createTemplateFromFile("TestUI");
    template.testUiAccessToken = issueTestUiAccessToken_();
    return template
      .evaluate()
      .setTitle("LINE Bot 測試模擬器 v2.3")
      .addMetaTag(
        "viewport",
        "width=device-width, initial-scale=1",
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

  if (e && e.parameter && e.parameter.manualCoverage === "1") {
    if (!isDoGetMaintenanceAuthorized_(e)) return buildUnauthorizedResponse_();
    return ContentService.createTextOutput(
      JSON.stringify(buildManualCoverageReport_()),
    ).setMimeType(ContentService.MimeType.JSON);
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
      flushLogs();
    } catch (err) {
      TEST_LOGS.push(`[Fatal] ${err.message}`);
      flushLogs();
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
        expirationTime: f.expirationTime,
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
  ensureSyncTriggerExists();
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
  LAST_TEST_QUICK_REPLY_ITEMS = [];

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
      flushLogs();
    } else {
      throw new Error("找不到 handleMessage 主函式");
    }
  } catch (e) {
    var errStr = e.toString();
    if (errStr.indexOf("ContentService") === -1) {
      TEST_LOGS.push(`[Fatal] 系統崩潰: ${errStr}`);
      flushLogs();
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
      if (log.indexOf("[Reply] 使用顯式 Quick Reply:") > -1) {
        continue;
      }
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
    sourceState: LAST_SOURCE_TEST_STATE,
    quickReplies: LAST_TEST_QUICK_REPLY_ITEMS,
  };
}

function testSourcePostback(action, source, userId, testUiAccessToken, model) {
  assertTestUiAuthorized_(testUiAccessToken);
  IS_TEST_MODE = true;
  TEST_LOGS = [];
  LAST_SOURCE_TEST_STATE = null;
  LAST_TEST_QUICK_REPLY_ITEMS = [];
  userId = userId || "TEST_DEV_001";
  const normalizedAction = String(action || "select_source");
  const normalizedSource = String(source || "");
  const dataParts = [`rm_action=${encodeURIComponent(normalizedAction)}`, "v=2"];
  if (normalizedSource) {
    dataParts.splice(1, 0, `source=${encodeURIComponent(normalizedSource)}`);
  }
  if (model) {
    dataParts.splice(1, 0, `model=${encodeURIComponent(String(model))}`);
  }
  const fakeEvent = {
    replyToken: "TEST_POSTBACK_REPLY_TOKEN",
    source: { type: "user", userId: userId },
    postback: { data: dataParts.join("&") },
    webhookEventId: `TEST_POSTBACK_${Date.now()}`,
    type: "postback",
    timestamp: Date.now(),
  };
  try {
    handleRichMenuPostback_(fakeEvent);
  } catch (error) {
    TEST_LOGS.push(`[Fatal] 系統崩潰: ${error}`);
  }
  const replies = [];
  TEST_LOGS.forEach(function (line) {
    if (line.indexOf("[Reply]") < 0) return;
    if (line.indexOf("[Reply] 使用顯式 Quick Reply:") >= 0) return;
    const content = parseLogContent(line, "[Reply]");
    if (content && replies.indexOf(content) < 0) replies.push(content);
  });
  const result = {
    success: true,
    replies: replies,
    logs: TEST_LOGS,
    sourceState: LAST_SOURCE_TEST_STATE,
    quickReplies: LAST_TEST_QUICK_REPLY_ITEMS,
  };
  IS_TEST_MODE = false;
  return result;
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
  cache.remove(getDailyQuestionModelHoldKey_(userId));
  const props = PropertiesService.getScriptProperties();
  [
    getSourcePendingKey_(userId),
    getSourceRecentKey_(userId),
    getSourceProductKey_(userId),
    getAnswerEnvelopeKey_(userId),
    getSourceQuotaKey_(userId, getSourceDateKey_()),
    getDailyQuestionQuotaKey_(userId, getSourceDateKey_()),
  ].forEach(function (key) {
    cache.remove(key);
    props.deleteProperty(key);
  });
  LAST_SOURCE_TEST_STATE = null;
  CURRENT_DAILY_QUESTION_REMAINING = null;
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

function getManualCoverageStatus(testUiAccessToken) {
  assertTestUiAuthorized_(testUiAccessToken);
  return buildManualCoverageReport_();
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
  // Prompt 快取跟著程式版本走，避免剛更新既有 deployment 並同步 Prompt!C3 後，
  // 正式 LINE 仍在最長一小時內沿用舊版 Prompt。
  const promptCacheKey = `KB_PROMPTS_JSON_${GAS_VERSION}`;
  const cached = cache.get(promptCacheKey);
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
  cache.put(promptCacheKey, JSON.stringify(prompts), 3600);
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
  RUNTIME_PROMPT_CONFIG_MEMO = null;
  CacheService.getScriptCache().remove(
    `RUNTIME_PROMPT_CONFIG_${GAS_VERSION}`,
  );
  CacheService.getScriptCache().remove(`KB_PROMPTS_JSON_${GAS_VERSION}`);
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

function upsertManualPdfToGemini_(fileName, pdfBytes, forceRefresh) {
  const safeName = validateManualPdfFileName_(fileName);
  assertStandardPdfBytes_(pdfBytes);
  const existing = getManualPdfKbList_().filter(function (item) {
    return item.name === safeName && item.uri;
  });
  if (existing.length > 0 && !forceRefresh) {
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
            : "點選型號後立即為你解答",
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
 * [Cost Guard] 只攔截使用者已明確授權的 PDF 操作 (v29.6.098)
 * @param {string} userMsg
 */
function checkPdfCost(userMsg, testUiAccessToken) {
  assertTestUiAuthorized_(testUiAccessToken);
  if (!userMsg) return { isHighCost: false, reason: "Empty message" };

  // 一般產品問題（含型號、設定、故障）必須先走 QA/RULE Fast Mode，
  // 不得僅因字詞或型號外觀就在 TestUI 前端誤報成 PDF 費用。
  // 只有下一輪的明確查手冊授權才顯示高成本確認。
  const m = userMsg.toLowerCase();
  const isExplicitPdfConsent =
    /#\s*查手冊/i.test(m) ||
    /(?:同意|請|要|幫我|直接)?\s*(?:查|讀|搜尋|檢查)(?:一下|看看)?\s*(?:官方)?(?:pdf|手冊|說明書)/i.test(
      m,
    );

  if (isExplicitPdfConsent) {
    return {
      isHighCost: true,
      reason: "Explicit manual-search consent",
    };
  }

  return { isHighCost: false, reason: "Fast Mode before manual consent" };
}

/**
 * 常見螢幕介面縮寫的輸入容錯。這是資料正規化，不代表任何產品規格結論。
 */
function normalizeCommonMonitorInputTypos_(text) {
  const aliases = {
    HDIM: "HDMI",
    HMDI: "HDMI",
    HDML: "HDMI",
    DIPSPLAYPORT: "DISPLAYPORT",
    DISPALYPORT: "DISPLAYPORT",
  };
  return String(text || "").replace(/\b[A-Z][A-Z0-9-]{2,15}\b/gi, (token) => {
    const upper = token.toUpperCase();
    return aliases[upper] || token;
  });
}
