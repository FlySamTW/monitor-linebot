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
const GAS_VERSION = "v29.5.111"; // 2026-01-28 修復對話記憶：網路搜尋後保存原始問題而非指令文字
const BUILD_TIMESTAMP = "2026-01-27 22:10";
let quickReplyOptions = []; // Keep for backward compatibility if needed, but primary is param

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
const GEMINI_MODEL_FAST = "models/gemini-2.0-flash";
const PRICE_FAST_INPUT = 0.1; // $0.10 per 1M Input
const PRICE_FAST_OUTPUT = 0.4; // $0.40 per 1M Output

// 🅱️ 若上方選擇 'OpenRouter' (需填寫 OPENROUTER_API_KEY)，則使用以下設定：
const OPENROUTER_MODEL = "qwen/qwen-2.5-7b-instruct";
const OPENROUTER_PRICE_IN = 0.04; // $0.04 per 1M Input
const OPENROUTER_PRICE_OUT = 0.1; // $0.10 per 1M Output

// ════════════════════════════════════════════════════════════════
// 3. PDF 對話 (Think Mode) (強制 Gemini，為了穩定)
// ════════════════════════════════════════════════════════════════
// ⚠️ 注意：PDF 閱讀模式目前強制定錨在 Google Gemini
// ⚠️ 注意：PDF 閱讀模式恢復使用 Gemini 2.0 Flash (v29.5.43: Context Optimized, 2.0 Safe now)
const GEMINI_MODEL_THINK = "models/gemini-2.0-flash";
const PRICE_THINK_INPUT = 0.1;
const PRICE_THINK_OUTPUT = 0.4;

// ════════════════════════════════════════════════════════════════
// 4. QA 生成 (Polish Mode) (強制 Gemini 3 Flash)
// ════════════════════════════════════════════════════════════════
// ⚠️ 注意：/記錄 功能目前強制使用 Gemini 3 Flash Preview 以確保品質
const GEMINI_MODEL_POLISH = "models/gemini-3-flash-preview";
const PRICE_POLISH_INPUT = 0.5;
const PRICE_POLISH_OUTPUT = 3.0;
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
// ════════════════════════════════════════════════════════════════

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
 *   - 4. QA 生成 (Polish Mode) - 強制 Gemini 3 Flash
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
 * - 新增：區分「[來源: 規格庫]」(CLASS_RULES) 和「[來源: QA]」(QA Sheet) 標籤
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
 *   └─ 修正：在 Prompt 中強制要求 AI 若非引用手冊，必須明確標註「[來源: 網路搜尋]」或「[來源: 一般知識]」。
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
 * 🔧 模型設定 (未來升級請只改這裡 - 第 271-281 行)
 * ════════════════════════════════════════════════════════════════
 *
 * 【一般對話】models/gemini-2.0-flash - 穩定可靠 (Input $0.10/M, Output $0.40/M)
 * 【深度思考】models/gemini-2.0-flash - 相同模型，穩定優先
 *
 * ⚠️ 重要警告：模型名稱必須是 Google 官方存在的名稱！
 * ⚠️ 使用不存在的名稱可能導致 API 靜默 fallback 到更貴的模型！
 * ⚠️ 參考文件：https://ai.google.dev/gemini-api/docs/models/gemini
 *
 * - gemini-2.0-flash: Input $0.10/1M, Output $0.40/1M (穩定、便宜)
 * - gemini-2.5-flash: Input $0.30/1M, Output $2.50/1M (太貴！GA 版大幅漲價)
 * - gemini-2.5-flash-lite: Input $0.10/1M, Output $0.40/1M (便宜替代方案)
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
                /\b(G\d{1,2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|S\d{2}[A-Z]{2}\d{3}[A-Z]{0,2}|S\d{1,2}|[CF]\d{2}[A-Z]\d{3})\b/g;
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
              /\b(G\d{1,2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|S\d{2}[A-Z]{2}\d{3}[A-Z]{0,2}|S\d{1,2}|[CF]\d{2}[A-Z]\d{3})\b/g;

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

        // v27.9.1: 移除 tooMany 檢查（型號比較用 CLASS_RULES 就夠了）
        // 注入所有型號到 Cache（供後續 PDF 查詢時使用）
        if (allModels.length > 0) {
          const cache = CacheService.getScriptCache();
          cache.put(
            `${userId}:direct_search_models`,
            JSON.stringify(allModels),
            300,
          );
          writeLog(
            `[DirectDeep] ✅ 注入型號到 Cache (userId: ${userId}): ${allModels.join(
              ", ",
            )}`,
          );
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
            content: createModelSelectionFlexV2(
              pending.aliasKey,
              pending.options,
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
          let finalText = formatForLineMobile(response);
          finalText = finalText.replace(/\[AUTO_SEARCH_PDF\]/g, "").trim();
          finalText = finalText.replace(/\[NEED_DOC\]/g, "").trim();
          finalText = finalText.replace(/\[NEW_TOPIC\]/g, "").trim();
          // v29.3.51: 補上 [AUTO_SEARCH_WEB] 清理，防止暗號外洩
          finalText = finalText.replace(/\[AUTO_SEARCH_WEB\]/g, "").trim();

          // v27.0.0: 修復費用顯示邏輯
          // 只在有有效回答和有 lastTokenUsage 時才顯示費用
          let replyText = finalText;
          if (DEBUG_SHOW_TOKENS && lastTokenUsage && lastTokenUsage.costTWD) {
            const tokenInfo = `\n\n---\n本次對話預估花費：\nNT$${lastTokenUsage.costTWD.toFixed(
              4,
            )}\n(In:${lastTokenUsage.input}/Out:${lastTokenUsage.output}=${
              lastTokenUsage.total
            })`;
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
        let finalText = formatForLineMobile(response);
        finalText = finalText.replace(/\[AUTO_SEARCH_PDF\]/g, "").trim();
        finalText = finalText.replace(/\[NEW_TOPIC\]/g, "").trim();

        // v27.0.0: 修復費用顯示邏輯（同上，確保費用對應當前查詢）
        let replyText = finalText;
        if (DEBUG_SHOW_TOKENS && lastTokenUsage && lastTokenUsage.costTWD) {
          const tokenInfo = `\n\n---\n本次對話預估花費：\nNT$${lastTokenUsage.costTWD.toFixed(
            4,
          )}\n(In:${lastTokenUsage.input}/Out:${lastTokenUsage.output}=${
            lastTokenUsage.total
          })`;
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
    altText: `請選擇您的 ${aliasName} 型號`,
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
            text: "請點擊您的型號開頭：",
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
        pattern:
          /(?:^|[^A-Z0-9])([SG]\d{2}[A-Z]+[CDEFGHKLMNPSTX]{0,3})(?:$|[^A-Z0-9])/g,
        needValidate: false,
      }, // 長型號直接放行
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
    if (userId) {
      const cachedModels = cache.get(`${userId}:direct_search_models`);
      if (cachedModels) {
        try {
          const models = JSON.parse(cachedModels);
          if (models && models.length > 0) {
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
    } else {
      // Fallback: 若無 Spec Cache，嘗試讀取 Sheet (後半部)
      try {
        const ruleSheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
        if (ruleSheet && ruleSheet.getLastRow() > 50) {
          const data = ruleSheet
            .getRange(52, 1, ruleSheet.getLastRow() - 51, 1)
            .getValues();
          specRules = data.map((r) => r[0]).join("\n");
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

    // v29.5.42: Optimization for PDF Mode (Compromise Solution)
    // Clear QA to save tokens, BUT Retain Light Rules (Definitions/Specs) to prevent "Spec Blindness"
    if (isPDFMode) {
      fullQA = ""; // Cleared (Save ~6k chars)
      // lightRules = ""; // RESTORED (Don't clear Rules!)
      writeLog(
        `[DynamicContext] PDF Mode Enabled: QA Cleared. Rules Kept (${lightRules.length}c).`,
      );
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
    let fullSpecRules = "";
    let chunkIndex = 0;
    while (true) {
      const chunk = cache.get(
        `${CACHE_KEYS.KB_RULES_SPEC_PREFIX}${chunkIndex}`,
      );
      if (!chunk) break;
      fullSpecRules += chunk;
      chunkIndex++;
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

        // 3. Injector: 擇優錄取 Top 20
        // 過濾掉 0 分的，並按分數排序，取前 20 筆
        const topLines = scoredLines
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 20)
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

    // 記錄總 Context 大小
    // v29.5.0: Consolidate Context Logs
    writeLog(
      `[Ctx Info] QA: ${fullQA ? fullQA.length : 0}c | Light: ${
        lightRules ? lightRules.length : 0
      }c | Total: ${relevantContext.length}c`,
    );

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

    // 如果強制重建，先清理 Gemini 上的舊檔案再清除本地快取
    if (forceRebuild) {
      writeLog("[Sync] 強制重建模式，先清理 Gemini 舊檔案...");
      cleanupOldGeminiFiles(apiKey);
      PropertiesService.getScriptProperties().deleteProperty(
        CACHE_KEYS.KB_URI_LIST,
      );
      oldKbList = [];
    } else if (oldJson) {
      try {
        oldKbList = JSON.parse(oldJson);
      } catch (e) {
        writeLog("[Sync] 舊快取解析失敗，將重建");
      }
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
            skipCount++;
          } else {
            // writeLog(`[Sync] 正在上傳: ${fileName}`); // 移除單行 Log
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
      } catch (driveErr) {
        writeLog(`[Sync] ⚠️ Drive 讀取失敗: ${driveErr.message}`);
      }
    }

    // v29.5.53: PDF Model Index - 從 PDF 檔名提取型號建立索引
    let pdfModels = [];
    newKbList.forEach((file) => {
      if (file.mimeType === "application/pdf") {
        const fileName = file.name.toUpperCase();

        // v29.5.78: 改進 Regex 以支援逗號分隔與不定長度後綴
        // 原本: /S\d{2}[A-Z]{2}\d{3}[A-Z]{0,2}/g (限制後綴最多2碼)
        // 修正: /S\d{2}[A-Z]{2}\d{3}[A-Z0-9]*/g (允許更長後綴，並確保逗號不會截斷識別)
        const sModels = fileName.match(/S\d{2}[A-Z]{2}\d{3}[A-Z0-9]*/g) || [];

        // 提取 G-models (e.g. G90XF, G80SD, G5)
        const gModels = fileName.match(/G\d{1,2}[A-Z]*/g) || [];
        // 提取 M-models (e.g. M70D, M50F)
        const mModels = fileName.match(/M\d{1,2}[A-Z]*/g) || [];

        pdfModels = pdfModels.concat(sModels, gModels, mModels);
      }
    });
    const uniquePdfModels = [...new Set(pdfModels)];
    PropertiesService.getScriptProperties().setProperty(
      "PDF_MODEL_INDEX",
      JSON.stringify(uniquePdfModels),
    );
    syncLogs.push(`PDF索引: ${uniquePdfModels.length}`);

    // 更新 Cache
    PropertiesService.getScriptProperties().setProperty(
      CACHE_KEYS.KB_URI_LIST,
      JSON.stringify(newKbList),
    );

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
      `📁 PDF 索引：${uniquePdfModels.length} 本`,
      `📄 規格型號：${allExistModels.length} 組`,
      `📑 雲端手冊：${uploadCount + skipCount} 本`,
      "━━━━━━━━",
      "💡 對話記憶已清空...",
    ].join("\n");
    writeLog(`[Sync Summary] ${syncLogs.join(" | ")}`);
    // writeLog(statusMsg);

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
 * 每日 04:00 自動重建知識庫
 * 使用 forceRebuild=true 確保所有 PDF 重新上傳
 * 避免 Google 48 小時檔案過期問題
 */
function dailyKnowledgeRefresh() {
  writeLog("[Daily] 開始每日知識庫重建 (04:00)...");
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
  if (userId) {
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
  }

  // v24.0.0: 型號正則 - 只匹配「真正的型號」，不匹配術語
  // G系列: G90XF, G80SD, G60F 等（G + 2位數 + 1~2字母）
  // M系列: M50F, M70F, M80F 等（M + 2位數 + 1字母）
  // S系列: S27DG602SC, S32DG802SC 等（S + 2位數 + 完整型號碼）
  // F/C系列 (舊款): F24T350, C24T550 (F/C + 2位數 + 1字母 + 3數字)
  // v29.4.24: Broaden Regex to support Appliances (WA/WD/VR) and full range
  const MODEL_REGEX =
    /\b(G\d{1,2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|S\d{2}[A-Z]{2}\d{3}[A-Z]{0,2}|S\d{1,2}|[CF]\d{2}[A-Z]\d{3}|WA\d+[A-Z\d]*|WD\d+[A-Z\d]*|VR\d+[A-Z\d]*)\b/g;

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
      exactModels = exactModels.concat(directModelMatch);
    }

    // 從原始查詢提取 LS 系列
    directLsMatch = combinedQuery.match(/LS(\d{2}[A-Z]{2}\d{3}[A-Z]{2})/g);
    if (directLsMatch) {
      directLsMatch.forEach((ls) => {
        const cleanModel = ls.replace(/^LS/, "S").replace(/XZW$/, "");
        exactModels.push(cleanModel);
      });
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

  // v29.5.53: PDF Model Index Check - 確認型號是否有專屬 PDF
  let hasDedicatedPdf = false;
  if (primaryModel) {
    try {
      const pdfIndexJson =
        PropertiesService.getScriptProperties().getProperty("PDF_MODEL_INDEX");
      const pdfModelIndex = pdfIndexJson ? JSON.parse(pdfIndexJson) : [];
      hasDedicatedPdf = pdfModelIndex.some((m) => {
        // v29.5.59: Strict Dedicated Check
        // 如果 m 是 S-model (長度足夠且 S 開頭)，則允許子字串匹配 (例如 S27FG502 匹配 S27FG502SC)
        if (m.startsWith("S") && m.length >= 7) {
          // v29.5.77: Size-Agnostic Match (跨尺寸匹配)
          // 將 S32DG502EC 簡化為 DG502EC，將 S27DG502EC 簡化為 DG502EC，然後比對
          // 邏輯：移除前3碼 (S + 2碼數字)，比對後續核心型號
          const corePrimary = primaryModel.replace(/^S\d{2}/, "");
          const coreIndex = m.replace(/^S\d{2}/, "");
          // 如果核心型號相同 (DG502EC === DG502EC)，視為命中
          if (
            coreIndex.includes(corePrimary) ||
            corePrimary.includes(coreIndex)
          ) {
            // writeLog(`[KB Select] 🎯 跨尺寸命中: ${primaryModel} (Core: ${corePrimary}) matches ${m}`);
            return true;
          }
          return m.includes(primaryModel) || primaryModel.includes(m);
        }
        // 如果是像 G5 這種別稱，必須與鎖定的型號完全一致才算「專屬 PDF」
        // (這能防止 S27AG500NC 誤判含有 G5 而載入手冊)
        return m === primaryModel;
      });
      if (!hasDedicatedPdf) {
        writeLog(
          `[KB Select] ⚠️ 型號 ${primaryModel} 無專屬 PDF (Index Match Failed)`,
        );
      }
    } catch (e) {
      // 靜默失敗
    }
  }

  // v29.5.57: 關鍵修復 - 若 primaryModel 沒有專屬 PDF，不載入任何 PDF
  // 避免載入錯誤的 Alias PDF 導致 API 空回應
  if (!hasDedicatedPdf && primaryModel) {
    writeLog(
      `[KB Select] 🚫 型號 ${primaryModel} 無專屬 PDF，跳過 PDF 載入，改用規格庫回答`,
    );
    // 直接返回空結果，不載入任何 PDF
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
    const isTier1 = exactModels.some((model) => fileName.includes(model));
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
        if (primaryModel && name.includes(primaryModel)) return 100;
        // Priority 2: Any "S-Model" in exactModels
        if (exactModels.some((m) => m.match(/^S\d{2}/) && name.includes(m)))
          return 50;
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
      f.name.toUpperCase().includes(primaryModel.toUpperCase()),
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

  cache.put(`${userId}:last_kb_files`, JSON.stringify(filesToAttach), 600);
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
    // v29.5.110: 強化時效性 Prompt，強制觸發 Google Search
    // 關鍵策略：讓 AI 認為這是「需要即時資訊」的問題，才會主動搜尋
    const today = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy年MM月dd日");
    dynamicPrompt = `【角色設定】
你現在是一名「網路搜尋專家」。用戶希望進行擴大搜尋，獲得**更詳細、更全面或不同角度**的資訊。

【🚨 強制搜尋指令 - 最高優先級】
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
4. **嚴禁推託**：
   - ❌ 禁止說「查無資料」、「無法確認」
   - ❌ 禁止反問用戶更多細節
   - ✅ 必須提供基於搜尋的具體答案
   - ✅ 若特定型號資訊少，提供該系列或品牌的通用解答

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

  // System Protocols
  dynamicPrompt += `\n【最高指導原則】\n1. 以下提供的【精選 QA & 規格】與【產品手冊】為唯一真理。\n2. 若過去的對話歷史 (History) 與目前的規格書衝突，請無視舊歷史，以目前的規格書為準。\n3. 切勿被舊對話中的錯誤資訊誤導。\n`;
  dynamicPrompt += `\n【語言絕對守則】\n1. **繁體中文 (台灣)**：所有回應必須使用 純正台灣繁體中文，嚴禁使用中國大陸用語或簡體中文。\n2. **用語轉換表 (必須強制執行)**：\n   - ❌ (禁) 视频 → ✅ (用) 影片\n   - ❌ (禁) 屏幕/显示器 → ✅ (用) 螢幕\n   - ❌ (禁) 程序/软件 → ✅ (用) 程式/軟體\n   - ❌ (禁) 设置 → ✅ (用) 設定\n   - ❌ (禁) 激活 → ✅ (用) 啟用\n   - ❌ (禁) 信息/消息 → ✅ (用) 訊息\n   - ❌ (禁) 任务栏 → ✅ (用) 工作列\n   - ❌ (禁) 硬件 → ✅ (用) 硬體\n   - ❌ (禁) 设备 → ✅ (用) 裝置\n   - ❌ (禁) 打印 → ✅ (用) 列印\n   - ❌ (禁) 链接 → ✅ (用) 連結\n   - ❌ (禁) 支持 → ✅ (用) 支援\n   - ❌ (禁) 质量 → ✅ (用) 品質\n   - ❌ (禁) 项目 → ✅ (用) 項目\n   - ❌ (禁) 默认 → ✅ (用) 預設\n3. **除錯指令**：若參考資料為簡體，你必須在腦中先翻譯成台灣繁體再輸出，**絕對禁止**直接複製簡體原文。`;

  // v24.1.20: 移除硬編碼 Prompt，改為引用 Prompt.csv 中的定義
  // 僅注入當前系統狀態 (Fast Mode / Deep Mode)

  if (!kbFiles.length && !imageBlob && !forceWebSearch) {
    // Phase 1: 極速模式 (Fast Mode)
    // v29.5.105: 強化型號追問機制
    dynamicPrompt += `\n【系統狀態】目前為「極速模式」(Fast Mode)。
【絕對原則】你是一個知識庫檢索系統，不是聊天機器人。禁止使用你自己的訓練資料回答產品操作或規格問題。

【🚨 型號追問機制 (最高優先級)】
當用戶使用「模糊別稱」(如 G5、G8、M7、M8) 詢問「操作/設定/故障」類問題時：
1. **必須先檢查** Context 中該別稱是否包含多個實體型號 (看「請優先引導用戶確認型號」提示)
2. **若有多款型號**：必須先列出所有型號讓用戶選擇，格式如下：
   「G5 系列有多款型號，請問你是哪一款？
   1. S27CG552EC (27吋曲面)
   2. S32CG552EC (32吋曲面)
   3. S27DG502EC (27吋平面)
   4. S32DG502EC (32吋平面)
   請直接回覆數字或型號～」
3. **禁止直接回答**：在用戶未確認型號前，禁止直接給操作步驟，因為不同型號操作可能不同
4. **例外**：若用戶問的是「通用規格」(如「G5有4K嗎」)且所有G5型號答案相同，可直接回答

【防幻覺鐵律 (Anti-Hallucination)】
1. **嚴禁模糊**：絕對禁止使用「有些型號可能支援」、「通常會有」等不確定用語。
2. **呈現選項**：若你需要提供多個選項、規格列表或步驟，**必須一律使用數字列表 (1., 2., 3., 4.)**，**嚴禁使用圓點 (•) 或其他符號**。
3. **規格題與功能題分流**：
   - **硬體規格題 (如：有沒有4K、面板類型)**：若 Context 未明確提及，**必須**回答「根據目前資料，該型號不支援此規格」，不得猜測。
   - **功能/操作/保養題 (如：零售模式、重置、清潔、上蓋是否要開)**：若 Context 無資料，**必須**輸出 \`[AUTO_SEARCH_PDF: 關鍵字]\` 觸發手冊搜尋。
4. **精確對應**：回答必須基於 Context 中**完全匹配**該型號的資料，不能拿其他系列的規格來套用。
5. **嚴禁推託客服**：絕對禁止說「聯絡三星客服」、「撥打 0800」、「聯繫客服專線」。若真的查無資料，請建議「直接問問 Sam」。

【回答流程 (必須嚴格遵守)】
1. **型號確認** (最優先)：
   - 用戶用模糊別稱 + 問操作問題 → 先反問確認型號
   - 用戶給了完整型號 (如 S32CG552EC) → 直接回答
2. **Search QA & Rules**：
   - QA/Rules 有答案 → 使用該資料回答，標註 [來源: QA/規格庫]
   - 找不到資料 → 輸出 [AUTO_SEARCH_PDF: <型號或關鍵字>]
3. **Exception**：
   - 僅當用戶閒聊或問通用名詞定義 (如：什麼是HDMI) 時，才可用通用知識回答。`;
  } else if (kbFiles.length > 0) {
    // Phase 2 & 3: 深度模式 (Deep Mode)
    // v27.8.6: 防護機制 - 確保真的有掛載 PDF
    const sourceLabel = targetModelName
      ? `${targetModelName} 產品手冊`
      : "產品手冊";
    if (kbFiles.length === 0) {
      dynamicPrompt += `\n【系統異常】雖然進入深度模式，但系統無法讀取產品手冊 (File Count: 0)。\n請誠實告知用戶：「很抱歉，我目前無法讀取相關產品手冊，請確認您詢問的型號是否正確，或嘗試重新輸入完整的產品型號。」\n禁止瞎掰或假裝有看手冊。`;
    } else {
      dynamicPrompt += `\n\n⚠️【深度模式】已載入產品手冊${
        targetModelName ? ` (${targetModelName})` : ""
      }，請根據手冊內容詳細回答。\n\n【回答格式優化 (嚴格執行)】\n1. **呈現選項/步驟**: 若你需要提供多個選項或步驟，**必須一律使用數字列表 (1., 2., 3., 4.)**，嚴禁使用圓點 (•) 或其他符號。\n2. **引用來源**: 若回答內容來自手冊，請在**整段回答的最後**統一標註 **[來源: ${sourceLabel}]** 即可，**嚴禁**在每一行或每一個列表項後面重複標註。\n3. **網路搜尋**: 若手冊無資料，請輸出特殊指令「[AUTO_SEARCH_WEB]」，系統將自動啟動聯網搜尋第二階段。\n\n【內容優先級】\n1. 若手冊有相關資訊，請**直接完整回答**，不要反問用戶「是否要幫你查手冊」。\n2. 若手冊無資料，請輸出 [AUTO_SEARCH_WEB]。(切勿自行標註網路搜尋)\n3. 若使用一般常識或推論，請標註「[來源: 一般知識]」。\n4. 優先順序：手冊 > [AUTO_SEARCH_WEB] > 一般知識。`;
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
) {
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

  // 1. 建構 Prompt
  let dynamicPrompt = constructDynamicPrompt(
    query,
    effectiveMessages,
    filesToAttach,
    forceWebSearch,
    imageBlob, // imageBlob is handled separately
    targetModelName,
  );

  const geminiContents = [];
  // if (imageBlob) { // imageBlob is handled outside this function now
  //   const imageBase64 = Utilities.base64Encode(imageBlob.getBytes());
  //   geminiContents.push({
  //     role: "user",
  //     parts: [
  //       { text: `【任務】分析圖片:\n${c3Prompt}` },
  //       {
  //         inline_data: {
  //           mime_type: imageBlob.getContentType(),
  //           data: imageBase64,
  //         },
  //       },
  //     ],
  //   });
  // } else {
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
  // }

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
    writeLog(`[Search Tool Payload] tools=${JSON.stringify(tools)}`);
    
    // v29.5.110: 強化 System Prompt - 加入時效性指令
    const today = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy年MM月dd日");
    dynamicPrompt +=
      `\n\n【🚨 系統強制指令 - 最高優先級】\n今天是 ${today}。用戶要求查詢「最新」的網路資訊。\n你必須立即使用 google_search 工具搜尋網路！\n理由：這是「需要即時資訊」的問題，你的內建知識截止日期已過時，必須搜尋最新網路資料。\n禁止僅用自身知識回答，必須引用網路來源。`;
    
    // v29.5.110: 修改 user message - 加入時效性關鍵詞觸發搜尋
    // Gemini 會判斷「最新」「今天」這類詞彙為需要即時資訊，從而強制搜尋
    if (geminiContents && geminiContents.length > 0) {
      const lastContent = geminiContents[geminiContents.length - 1];
      if (lastContent.role === "user" && lastContent.parts && lastContent.parts.length > 0) {
        const textPart = lastContent.parts.find(p => p.text);
        if (textPart && !textPart.text.includes("最新")) {
          // 在問題前加上時效性詞彙
          textPart.text = `【請搜尋最新網路資訊】${textPart.text}`;
          writeLog(`[Search Query Inject] 已加入時效性關鍵詞: ${textPart.text.substring(0, 100)}`);
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
            "\n\n(系統自動降級：因參考文件過大導致讀取失敗，已切換為無文件模式，請依據您的知識庫回答)";
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
            
            // v29.5.109: 完整記錄 Grounding Metadata (Web Search 結果)
            if (grounding) {
              // 記錄完整的 grounding 物件（限制長度避免過大）
              const groundingKeys = Object.keys(grounding);
              writeLog(`[Grounding] 🌐 偵測到 groundingMetadata, 包含欄位: ${groundingKeys.join(', ')}`);
              
              if (grounding.webSearchQueries && grounding.webSearchQueries.length > 0) {
                writeLog(`[Grounding] 搜尋查詢: ${JSON.stringify(grounding.webSearchQueries)}`);
              } else {
                writeLog(`[Grounding] webSearchQueries 不存在或為空`);
              }
              
              if (grounding.groundingChunks && grounding.groundingChunks.length > 0) {
                writeLog(`[Grounding] 來源數量: ${grounding.groundingChunks.length}`);
                grounding.groundingChunks.slice(0, 3).forEach((chunk, i) => {
                  if (chunk.web) writeLog(`[Grounding] 來源 ${i+1}: ${chunk.web.title || 'N/A'} - ${chunk.web.uri || 'N/A'}`);
                });
              } else {
                writeLog(`[Grounding] groundingChunks 不存在或為空`);
              }
              
              if (grounding.searchEntryPoint) {
                writeLog(`[Grounding] 有 searchEntryPoint (搜尋建議 Widget)`);
              }
              
              // 記錄 AI 回應文字 (Web Search 結果)
              if (text.length > 0) {
                writeLog(`[Grounding] AI 搜尋回應: ${text}`);
              }
            } else if (forceWebSearch) {
              writeLog(`[Grounding] ⚠️ forceWebSearch=true 但無 groundingMetadata，可能 API 未啟用搜尋`);
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
          return "您的 API Key 無效，請檢查設定。";
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
        return "目前請求過於頻繁或已達配額限制，請稍後再試，或考慮升級付費方案。";
      }
      if (code === 500 || code === 503) {
        writeLog(`[API ${code}] Google 伺服器錯誤，重試中...`);
        lastError = `Google 伺服器暫時故障`;
        retryCount++;
        Utilities.sleep(2000 * retryCount);
        continue;
      }

      // 其他錯誤
      lastError = `API 錯誤 ${code}`;
      writeLog(`[API Error] Code: ${code}, Body: ${text.substring(0, 300)}`);
      retryCount++;
      Utilities.sleep(1000 * Math.pow(2, retryCount));
    } catch (e) {
      lastError = e.message || "未知錯誤";

      writeLog(`[API Exception] ${e.message}`);
      if (e.message.includes("token")) return e.message;
      retryCount++;
      Utilities.sleep(1000 * Math.pow(2, retryCount));
    }
  }

  // v29.5.25: Graceful Failure
  if (lastError) {
    writeLog(`[API Fail] 重試 3 次仍失敗，最後錯誤: ${lastError}`);
    if (forceWebSearch) {
      return "非常抱歉，網路搜尋服務暫時無法連線。您可以參考上方提供的資料，或稍後再試。";
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
  processed = processed.replace(/([，])(\s*)([^，。！？；：\n]{15,})/g, "$1\n\n$3");
  
  // 4. 數字列表項前強制換行
  processed = processed.replace(/(\n|^)(\d+\.)/g, "\n\n$2");
  
  // 5. 移除多餘換行 (3個以上換行合併為2個)
  processed = processed.replace(/\n{3,}/g, "\n\n");

  processed = formatListSpacing(processed);
  return processed.trim();
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
    const messageId = event.message.id || null;
    let msg = userMessage;
    let isDualBubbleComplete = false; // v29.3.29: 修正旗標未定義問題
    let filesToAttach = []; // v29.4.19: Fix Scope Error (filesToAttach is not defined)
    let primaryModel = null; // v29.4.20: Fix Scope Error (primaryModel is not defined)
    let aiSearchQuery = null; // v29.4.22: AI-driven search query

    // v29.3.26: 手動觸發診斷功能 (供用戶測試二次搜機制用)
    if (msg === "測試二次搜尋") {
      msg += " [AUTO_SEARCH_WEB]";
      writeLog("[Diagnostic] 手動注入 [AUTO_SEARCH_WEB] 標籤進行測試");
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
          replyToken,
          contextId,
          msg,
          response + " [RealTime]",
          "RealTime",
        ); // 補上對話紀錄
        writeLog(`[RealTime] 實時資訊快速回答: ${response}`);
        return;
      }
    }

    // 短時間內同內容去重 (60 秒內同用戶同訊息只處理一次)
    // 但指令類別不做去重，因為用戶可能需要重試
    const cache = CacheService.getScriptCache();
    const isCommand = msg.startsWith("/");

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

    // ⭐ 立即顯示 Loading 動畫（去重後、處理前）
    // v29.3.25: 移除 hasRecentAnimation 判定，強制每一題都發送動畫請求，
    // 因為 LINE 會自動處理 5s 內的重複請求，我們端點保持最高靈敏度。
    showLoadingAnimation(userId, 60);

    // v27.9.64: [Smart Editor Mode] 長文自動摘要與總編模式
    // 條件：長度 > 200 且 包含 Samsung 關鍵字 且 非指令
    // 目標：快速摘要長文資料，繞過標準 RAG 流程
    if (msg.length > 200 && !msg.startsWith("/")) {
      // v27.9.67: 放寬至「科技新聞」，不再侷限三星
      const validContent = isValidTechContent(msg);
      if (validContent) {
        writeLog(
          `[SmartEditor] 偵測到長文 (${msg.length} 字)，且包含相關關鍵字，啟動總編模式`,
        );

        // 1. 取得總編 Persona
        let editorPersona = "";
        try {
          // 嘗試從 Prompt.csv 讀取 (雖然 User 說會自己貼，但我們會先讀 Cache 或預設)
          const prompts = getPromptsFromCacheOrSheet();
          editorPersona = prompts["總編模式"] || "";
        } catch (e) {
          writeLog(`[SmartEditor] Prompt Load Failed: ${e.message}`);
        }

        // 若沒有設定，使用預設值 (雖User會貼，但防呆)
        if (!editorPersona) {
          editorPersona = `你現在是專業科技編輯。用戶提供「原始長文」(可能含廣告/時間軸/廢話)。任務：1.去蕪存菁(移除廣告/訂閱提醒/無關閒聊)。2.邏輯重整(分段/下標題/列點)。3.提取關於「三星產品」的技術重點與操作步驟。4.保持客觀，不加主觀評論。輸出格式：【重點摘要】(3點)→【詳細內容】(分層結構)。若內容與三星產品無關，請回「內容似乎與三星產品無關，請提供相關資料」。`;
        }

        const editorSystemPrompt = `${editorPersona}\n\n[用戶原始長文]:\n${msg}`;

        // 2. 呼叫 LLM (不查 QA, 不查 PDF)
        // 這裡需要直接呼叫 chatWithGemini 但要繞過 context 組合
        // 我們直接構造一個假的 context
        const editorContext = `[System] ${editorPersona}`;

        // 為了使用統一的 callGeminiApi，我們直接組裝
        const modelName = "models/gemini-2.0-flash"; // 為了速度，用 Flash
        const payload = {
          contents: [
            {
              role: "user",
              parts: [{ text: editorSystemPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.3, // 摘要需要穩定
            maxOutputTokens: 2000,
          },
        };

        const startTime = new Date().getTime();
        const GEMINI_API_KEY =
          PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

        try {
          const response = UrlFetchApp.fetch(apiUrl, {
            method: "post",
            contentType: "application/json",
            payload: JSON.stringify(payload),
            muteHttpExceptions: true,
          });
          const resCode = response.getResponseCode();
          const resText = response.getContentText();
          const result = JSON.parse(resText);

          let replyText = "";
          let inputTokens = 0;
          let outputTokens = 0;
          let cost = 0;

          if (result.candidates && result.candidates[0].content) {
            replyText = result.candidates[0].content.parts[0].text;
          }
          // 計算 Token (若 API 有回傳 usageMetadata)
          if (result.usageMetadata) {
            inputTokens = result.usageMetadata.promptTokenCount || 0;
            outputTokens = result.candidatesTokenCount || 0; // Gemini API 命名可能不同，視版本
            if (!outputTokens && result.usageMetadata.candidatesTokenCount)
              outputTokens = result.usageMetadata.candidatesTokenCount;

            // 估算費用 (Flash Rate: In $0.1/1M, Out $0.4/1M -> NTD 32)
            // NTD: In ~ 0.0000032, Out ~ 0.0000128
            cost = inputTokens * 0.0000032 + outputTokens * 0.0000128;
          } else {
            // 模擬計算 (1 char ~ 1 token for Chinese context safety estimate)
            inputTokens = msg.length;
            outputTokens = replyText.length;
            cost = inputTokens * 0.0000032 + outputTokens * 0.0000128;
          }

          // 3. 格式化輸出 (移除 **, 調整排版)
          if (replyText) {
            replyText = formatForLineMobile(replyText);
          }

          // 4. 加上強制註腳
          // [來源: 使用者提供長文] [費用: NT$...]
          const costStr = cost < 0.01 ? "0.01" : cost.toFixed(2); // 最低顯示 0.01
          const footer = `\n\n[來源: 使用者提供長文] [費用: NT$${costStr}]`;
          replyText += footer;

          // v29.3.36: 設定預設 Quick Reply (不滿意按鈕) - 使用 explicit options
          let responseOptions = {};
          if (!msg.startsWith("/") && isDualBubbleComplete !== undefined) {
            responseOptions.quickReply = {
              items: [
                {
                  type: "action",
                  action: {
                    type: "message",
                    label: "對以上回答不滿意",
                    text: "不滿意這回答請繼續擴大搜尋",
                  },
                },
              ],
            };
          }

          // v29.3.17: 使用 replyText 變數 (支援 Array)
          // v29.3.36: 傳遞 options
          replyMessage(replyToken, replyText, responseOptions);

          // 5. 寫入 Log & Record
          // 注意：不寫入 QA Cache，因為這是摘要
          // v27.9.71: 修復欄位錯位問題 (Correct args: u, t, c, r, f)
          // F欄回歸 Empty String (Boolean compatible)
          writeRecordDirectly(userId, msg, contextId, "user", "");
          writeRecordDirectly(userId, replyText, contextId, "SmartEditor", "");
          writeLog(
            `[SmartEditor] 完成摘要，耗時 ${
              (new Date().getTime() - startTime) / 1000
            }s, Cost: ${costStr}`,
          );

          return; // 結束，不走後面的 RAG
        } catch (e) {
          writeLog(`[SmartEditor] Error: ${e.message}`);
          // 若失敗，Fallthrough 到一般流程? 或者回報錯誤?
          // 為了保險，Fallthrough 到一般流程
        }
      } else {
        // v27.9.67: 長文但無科技/三星關鍵字，拒絕處理
        writeLog(`[SmartEditor] 長文但無科技/三星關鍵字，拒絕處理`);

        // User v27.9.67 Requirement: 就算不符合也要回覆婉拒
        if (msg.length > 200) {
          writeLog(
            "[SmartEditor] 長文 (>200) 但未偵測到科技或三星關鍵字，發送婉拒訊息。",
          );
          replyMessage(
            replyToken,
            "抱歉，我目前只能處理與「科技新聞」或「三星產品」相關的長文摘要與分析。\n\n若您分享的是一般生活新聞或非科技類內容，請原諒我無法提供服務。🙇‍♂️",
          );
          // 這裡必須 Return，否則會繼續往下走 RAG
          return;
        }
      }
    }

    // v27.8.8: 將 Log 移到去重之後、處理之前，確保每條通過去重的訊息都有紀錄
    writeLog(`[HandleMsg] 收到: ${msg}`);
    const draftCache = cache.get(CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId);
    // v24.1.23: 移除 PENDING_QUERY 相關邏輯 (Auto Deep Search 取代)
    // const pendingQuery = cache.get(CACHE_KEYS.PENDING_QUERY + userId);

    // A. 建檔模式
    if (draftCache && !msg.startsWith("/")) {
      handleDraftModification(msg, userId, replyToken, JSON.parse(draftCache));
      return;
    }

    // v29.3.39: 攔截「不滿意...擴大搜尋」按鈕，強制觸發網路搜尋 (Pass 2)
    // 用戶明確指出：這顆按鈕是「網路搜尋」，不是 PDF 搜尋，也不是反問
    // v29.5.22: 修復匹配問題 - "不太滿意" 也要能匹配
    // v29.5.54: 修復匹配問題 - 支援「網路搜尋」和「擴大搜尋」兩種觸發詞
    // v29.5.55: 分離 Web Search 和 PDF Search 觸發邏輯
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
        msg.includes("繼續查詢使用手冊"));

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
          )}，將強制 AI 進行 PDF 搜索 (Fast Mode Hint)`,
        );

        // v29.4.28: Force AI to trigger Auto-Search for Direct Keywords
        // "M7" should behave like "Search M7"
        // We append a System Hint to the message content passed to LLM (but not to User Log/Record?)
        // Actually, callLLMWithRetry formatting might expose it if we aren't careful?
        // No, callLLMWithRetry constructs the prompt. We can modify `userMessage` here?
        // But `userMessage` is used for caching and recording.
        // Better to handle this inside the prompt construction or just append here and record the raw message.
        // Let's rely on the prompt's ability to see this hint.

        // Note: We don't change `msg` (which is used for logic), but `userMessage` (passed to LLM).
        // BUT wait, `userMessage` is passed to `callLLMWithRetry` as the first arg.

        // We will append a hidden hint.
        // We will append a hidden hint.
        userMessage += `\n\n[System Hint: User mentioned keyword '${hitKeys[0]}'. You MUST output [AUTO_SEARCH_PDF: ${hitKeys[0]}] to check manuals.]`;

        // v29.4.29 Fix: Update userMsgObj so LLM actually sees the hint!
        userMsgObj.content = userMessage;

        // 把關鍵字存到 Cache，供後續 [AUTO_SEARCH_PDF] 使用
        cache.put(`${userId}:hit_alias_key`, hitKeys[0], 300); // 相容舊邏輯
        if (hitKeys.length > 1) {
          cache.put(`${userId}:hit_alias_keys`, JSON.stringify(hitKeys), 300);
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

      let rawResponse = callLLMWithRetry(
        userMessage,
        [...history, userMsgObj],
        filesToAttach,
        false, // attachPDFs
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
        // 🔥 v29.5.107: 完整記錄 AI 原始回應
        writeLog(`[AI Raw Response] ${rawResponse}`);
        
        let finalText = formatForLineMobile(rawResponse);
        let replyText = finalText;

        // v27.9.12: 追蹤 AI 是否明確要求 PDF 搜尋
        let aiRequestedPdfSearch = false;

        // 🔥 v29.5.106: 詳細 LOG - 檢測暗號
        const hasAutoPdf = /\[AUTO_SEARCH_PDF/i.test(rawResponse);
        const hasAutoWeb = /\[AUTO_SEARCH_WEB\]/i.test(rawResponse);
        const hasNeedDoc = /\[NEED_DOC\]/i.test(rawResponse);
        writeLog(`[Signal Check] PDF暗號:${hasAutoPdf}, Web暗號:${hasAutoWeb}, NeedDoc:${hasNeedDoc}`);

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

        // v29.5.06: Priority 3 - Fallback extraction from AI text
        if (suggestedModels.length === 0) {
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
          }
        }

        // 去重
        suggestedModels = [...new Set(suggestedModels)];

        // v29.5.13: Smart Filtering - 打破無限迴圈 & 移除多餘短別稱
        let autoLocked = false;

        // Step 1: Filter out short aliases if specific models exist
        const specificModels = suggestedModels.filter((m) => m.length > 3);
        if (specificModels.length > 0) {
          suggestedModels = specificModels;
        }

        // Step 2: Auto-Lock if user message contains the model
        const normalizedMsg = userMessage.toUpperCase().replace(/\s+/g, "");
        const matchedInMsg = suggestedModels.filter((m) =>
          normalizedMsg.includes(m.toUpperCase().replace(/\s+/g, "")),
        );

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
            const needSpecificModelIntent =
              /(怎麼|如何|設定|故障|無法|不能|操作|步驟|重置|reset|閃爍|亮燈|不亮|連接|安裝|調整|開啟|關閉|使用|方法|教學)/i.test(
                userMessage,
              );
            const tooMany = suggestedModels.length > 10;

            // 只有在「純列表意圖」且「非操作問題」時才跳過泡泡
            const shouldSkipBubble = (listIntent && !needSpecificModelIntent) || tooMany;

            if (shouldSkipBubble) {
              writeLog(
                `[Smart Router v29.5.105] 偵測到列表意圖(${listIntent})/數量過多(${suggestedModels.length})，且無操作需求，跳過選單泡泡。`,
              );
              suggestedModels = []; // 清空以跳過泡泡生成
            } else if (listIntent && needSpecificModelIntent) {
              writeLog(
                `[Smart Router v29.5.105] 偵測到列表意圖但同時有操作需求，保留型號選單泡泡。`,
              );
            }

            // Re-check length (if cleared, this block won't run)
            if (suggestedModels.length > 1) {
              writeLog(
                `[Smart Router v29.4.14] 準備顯示型號選擇泡泡 (Trigger: ${hasExplicitTrigger}, Models: ${suggestedModels.length})`,
              );
              cache.put(
                `${userId}:suggested_models`,
                JSON.stringify(suggestedModels),
                300,
              );

              // 生成 Flex Message (使用 V2 去重版)
              // v29.5.50: Determine Search Intent for Dynamic Bubble Text
              const searchIntent = determineSearchIntent(
                userMessage,
                suggestedModels,
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
              if (finalText && finalText.length > 0) {
                messages.push({ type: "text", text: finalText });
              }
              messages.push({
                type: "flex",
                altText: "請選擇您要查詢的型號",
                contents: flexMsg.contents
                  ? flexMsg
                  : { type: "carousel", contents: [flexMsg] }, // Ensure container format
              });

              // 使用 replyToken 一次發送
              const url = "https://api.line.me/v2/bot/message/reply";
              // v29.5.12: Correct key is LINE_TOKEN
              let accessToken =
                PropertiesService.getScriptProperties().getProperty(
                  "LINE_TOKEN",
                );
              if (accessToken) accessToken = accessToken.trim();
              if (!accessToken) {
                writeLog("[Fatal Error] 找不到 LINE_TOKEN，Flex 發送中止");
                return;
              }
              const res = UrlFetchApp.fetch(url, {
                method: "post",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: "Bearer " + accessToken,
                },
                payload: JSON.stringify({
                  replyToken: replyToken,
                  messages: messages,
                }),
                muteHttpExceptions: true,
              });

              // v29.5.05: Check response code to catch silent failures
              if (res.getResponseCode() === 200) {
                writeLog(
                  `[Smart Router v29.4.14] 已發送 Flex Selection (含前導文字)`,
                );
              } else {
                writeLog(
                  `[Flex Error] 發送失敗 (${res.getResponseCode()}): ${res.getContentText()}`,
                );
              }
              return; // 結束
            }
          }
        }

        // 🔥 v29.5.106: 詳細 LOG - 進入主要判斷邏輯
        writeLog(`[Flow Decision] hasExplicitTrigger:${hasExplicitTrigger}, containsWebSignal:${finalText.includes("[AUTO_SEARCH_WEB]")}`);

        // 若沒有 suggestedModels (或已被 auto-redirect 清空)，繼續原本邏輯
        if (hasExplicitTrigger) {
          // 只有 Trigger 但沒型號? (可能是 AI 忘了給型號，或依賴 Context)
          // 這裡維持原本邏輯 (可能後續會走 Auto Search Web)
          writeLog(`[Flow] hasExplicitTrigger=true，進入 PDF 觸發邏輯`);
        } else if (finalText.includes("[AUTO_SEARCH_WEB]")) {
          writeLog("[Auto Web] 🌐 Fast Mode 觸發 [AUTO_SEARCH_WEB] -> 開始 Pass 2 網路搜尋");

          // v27.8.16 Cost Fix: 保存 Pass 1 費用以便累加
          const pass1Usage =
            typeof lastTokenUsage === "object"
              ? { ...lastTokenUsage }
              : { input: 0, output: 0, total: 0, costTWD: 0 };

          // 執行 Pass 2 (Force Web Search)
          const searchResponse = callLLMWithRetry(
            userMessage,
            [...history, userMsgObj],
            [], // filesToAttach
            false, // attachPDFs
            null, // imageBlob
            true, // isRetry (Pass 2 treated as retry/deep)
            userId,
            true, // forceWebSearch
          );

          // 累加費用
          if (lastTokenUsage && pass1Usage.total > 0) {
            lastTokenUsage.input += pass1Usage.input;
            lastTokenUsage.output += pass1Usage.output;
            lastTokenUsage.total += pass1Usage.total;
            lastTokenUsage.costTWD += pass1Usage.costTWD;
            writeLog(
              `[Cost Accumulation] Total: NT$${lastTokenUsage.costTWD.toFixed(
                4,
              )}`,
            );
          }

          if (searchResponse && searchResponse !== "[KB_EXPIRED]") {
            // v29.4.9: Fast Mode 也要支援二次泡泡
            // Fix: 若 Pass 1 僅包含標籤 (replace 後為空)，則只發送 Pass 2，避免 LINE API 400 Error
            const pass2Bubble =
              formatForLineMobile(searchResponse) + "\n\n(🔍 網路搜尋補充資料)";

            let pass1Bubble = formatForLineMobile(rawResponse)
              .replace(/\[AUTO_SEARCH_WEB\]/g, "")
              .trim();

            if (pass1Bubble.length > 0) {
              replyText = [pass1Bubble, pass2Bubble];
            } else {
              replyText = pass2Bubble;
              writeLog("[Auto Web] Pass 1 為空，僅發送 Pass 2");
            }

            isDualBubbleComplete = true; // v29.3.29: 標記已完成雙泡泡賦值
            writeLog("[Auto Web] Fast Mode 二次泡泡賦值成功");
          } else {
            finalText = rawResponse.replace(/\[AUTO_SEARCH_WEB\]/g, "").trim();
            finalText += "\n\n(⚠️ 網路搜尋連線逾時)";
            replyText = finalText;
          }

          // 跳過後續 PDF Logic
          writeLog("[Auto Web] 已完成搜尋，跳過 PDF Logic");
          // 這裡直接跳到底部
        }

        // 確保如果是 WEB Search 就不進入 PDF 判斷 (用簡單的方法: 檢查 replyText 是否已改變)
        // 或者將 PDF 邏輯包在 else 裡
        // 目前結構較平鋪直敘，我們用一個 flag 或結構調整

        if (
          !isDualBubbleComplete &&
          !replyText.toString().includes("(🔍 網路搜尋補充資料)") &&
          !replyText.toString().includes("(⚠️ 網路搜尋連線逾時)")
        ) {
          // v24.5.4: 檢測是否為「不需要 PDF 的問題」
          // 包括：1) 硬體規格定義  2) 通識知識  3) 技術概念解釋
          // 這些問題 CLASS_RULES/QA 沒寫或 LLM 可用通用知識回答，不該查 PDF
          // v29.4 Cleanup: 移除硬編碼過濾，讓 Smart Router 決定
          // const nonPdfPatterns = [...];
          const isNonPdfQuestion = false; // 強制放行

          if (isNonPdfQuestion) {
            // 不需要 PDF 的問題：使用 CLASS_RULES 或 LLM 通用知識回答
            writeLog(
              "[Non-PDF Q] 通識/規格定義問題，不進 PDF，直接用極速模式答案",
            );
            // finalText 已經是極速模式的回答，直接用
            replyText = finalText;
          } else {
            // v24.5.0: 優先檢查是否有 PDF 記憶（已選過型號）
            // v27.2.9 修復：檢查型號是否衝突，避免 M8 記憶誤用到 M9 查詢
            const currentMsgModels = extractModelNumbers(msg);

            // v29.3.20: 強化型號衝突判定，支援別稱 (Alias) 解析
            // 避免 G6 比對 S27FG6... 時誤判為衝突
            let isModelMismatch = false;
            if (currentMsgModels.length > 0 && cachedDirectModels.length > 0) {
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
                  finalText = formatForLineMobile(deepResponse);
                  finalText = finalText
                    .replace(/\[AUTO_SEARCH_PDF\]/g, "")
                    .trim();
                  finalText = finalText.replace(/\[NEED_DOC\]/g, "").trim();
                  // v29.3.53: 補上 [AUTO_SEARCH_WEB] 清理，防止暗號外洩
                  finalText = finalText
                    .replace(/\[AUTO_SEARCH_WEB\]/g, "")
                    .trim();

                  // v29.4.33: 設置 PDF 已查詢標記
                  cache.put(`${userId}:pdf_consulted`, "true", 600);
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
                  const askMsg = createModelSelectionFlexV2(
                    pdfSearchResult.aliasName,
                    pdfSearchResult.matchedPdfs.slice(0, 9),
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
                    finalText = formatForLineMobile(deepResponse);
                    finalText = finalText
                      .replace(/\[AUTO_SEARCH_PDF\]/g, "")
                      .trim();
                    finalText = finalText.replace(/\[NEED_DOC\]/g, "").trim();
                    // v29.3.53: 補上 [AUTO_SEARCH_WEB] 清理，防止暗號外洩
                    finalText = finalText
                      .replace(/\[AUTO_SEARCH_WEB\]/g, "")
                      .trim();

                    // v29.4.33: 設置 PDF 已查詢標記，下次追問將升級至 Web Search
                    cache.put(`${userId}:pdf_consulted`, "true", 600); // 10 分鐘有效
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

                // 只有在有對話歷史時才需要判斷
                if (history && history.length > 0) {
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

                      const topicCheckResponse = UrlFetchApp.fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
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
                      /不行|沒用|可是|但是|問題|仍然|依舊|還是|沒辦法|失效|異常|卡頓/i;
                    useHistory = unresolvedSignals.test(msg);
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
                    finalText = formatForLineMobile(deepResponse);
                    finalText = finalText
                      .replace(/```tool_code/g, "")
                      .replace(/tool_code/g, "")
                      .replace(/```/g, "")
                      .replace(/\[AUTO_SEARCH_PDF\]/g, "")
                      .trim();
                    finalText = finalText.replace(/\[NEED_DOC\]/g, "").trim();

                    if (finalText.startsWith("根據我的資料庫")) {
                      finalText = finalText.replace(
                        /^根據我的資料庫/,
                        "根據產品手冊",
                      );
                    }

                    // v27.9.80: 移除 LLM 可能自行加入的重複來源標籤
                    // 清除 [來源:...] 和 (來源:...) 兩種格式
                    finalText = finalText
                      .replace(/[\[（\(]來源[：:][^\]）\)]*[\]）\)]/g, "")
                      .trim();

                    // v27.9.73: 加入 PDF 來源型號標註（只保留一個）
                    if (productNames.length > 0) {
                      finalText += `\n\n[來源: ${productNames[0]} 使用手冊]`;
                    }
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
                          finalText = formatForLineMobile(deepResponse);
                          finalText = finalText
                            .replace(/```tool_code/g, "")
                            .replace(/tool_code/g, "")
                            .replace(/```/g, "")
                            .replace(/\[AUTO_SEARCH_PDF\]/g, "")
                            .trim();
                          finalText = finalText
                            .replace(/\[NEED_DOC\]/g, "")
                            .trim();

                          if (finalText.startsWith("根據我的資料庫")) {
                            finalText = finalText.replace(
                              /^根據我的資料庫/,
                              "根據產品手冊",
                            );
                          }
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
                      finalText =
                        "抱歉，雖然這看起來像需要查手冊的問題，但我找不到相關的 PDF 手冊檔案。😅\n請確認您的型號是否正確（例如包含完整型號），或是問得更具體一點喔！";
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
          const tokenInfo = `\n\n---\n本次對話預估花費：\nNT$${lastTokenUsage.costTWD.toFixed(
            4,
          )}\n(In:${lastTokenUsage.input}/Out:${lastTokenUsage.output}=${
            lastTokenUsage.total
          })`;
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
            checkText.includes("[來源: 網路搜尋]");
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

        // v29.5.52: Dynamic Quick Reply Text based on Search Context
        let responseOptions = {};
        if (!msg.startsWith("/") && replyText) {
          // Determine Context
          const isWebSearchPhase =
            replyText.includes("[來源: 網路搜尋]") ||
            replyText.includes("🔍 網路搜尋補充資料");
          const isPdfModePhase =
            isInPdfMode ||
            (replyText.includes("[來源:") && replyText.includes("手冊]"));

          let qrText = "對以上回答不滿意，請改搜尋網路資料";
          let qrLabel = "對以上回答不滿意"; // Standardized Label

          if (isWebSearchPhase) {
            // 1. Web Phase -> Continue Web
            qrText = "對以上答案不理想，換個關鍵字再搜";
            qrLabel = "對以上回答不滿意";
          } else if (isPdfModePhase) {
            // 2. PDF Phase -> Go to Web
            qrText = "手冊沒解答，改搜尋網路資料";
            qrLabel = "對以上回答不滿意";
          } else {
            // 3. Fast Mode (Spec/QA)
            // v29.5.64: 檢查該型號是否有專屬 PDF，沒有就不建議查手冊
            let hasDedicatedPdf = false;
            try {
              const pdfIndexJson =
                PropertiesService.getScriptProperties().getProperty(
                  "PDF_MODEL_INDEX",
                );
              const pdfModelIndex = pdfIndexJson
                ? JSON.parse(pdfIndexJson)
                : [];
              const lockedModel = cache.get(`${userId}:locked_model`);
              if (lockedModel) {
                hasDedicatedPdf = pdfModelIndex.some((m) => {
                  // v29.5.59: Strict Dedicated Check
                  if (m.startsWith("S") && m.length >= 7) {
                    return m.includes(lockedModel) || lockedModel.includes(m);
                  }
                  return m === lockedModel;
                });
              }
            } catch (e) {}

            const intent = determineSearchIntent(msg);
            if (
              hasDedicatedPdf &&
              (intent.headerText.includes("查閱產品手冊") ||
                intent.headerText.includes("查詢規格"))
            ) {
              // 有 PDF，建議查手冊
              qrText = "對以上回答不滿意，請繼續查詢手冊";
              qrLabel = "對以上回答不滿意";
            } else {
              // 無 PDF 或一般問題 -> Go to Web
              qrText = "對以上回答不滿意，請改搜尋網路資料";
              qrLabel = "對以上回答不滿意";
            }
          }

          responseOptions.quickReply = {
            items: [
              {
                type: "action",
                action: {
                  type: "message",
                  // v29.5.63: Force limit label to 20 chars but keep it same as text
                  // v29.5.88: Ensure label is explicitly set and valid
                  label: qrLabel,
                  text: qrText,
                },
              },
            ],
          };
        }

        // 🔥 v29.5.109: 詳細 LOG - 完整記錄最終回覆內容
        const replyFull = Array.isArray(replyText) 
          ? `[多泡泡回覆 ${replyText.length}則] ` + replyText.join(' ||| ')
          : (replyText || '');
        writeLog(`[Final Reply] 即將回覆: ${replyFull.replace(/\n/g, ' ')}`);

        replyMessage(replyToken, replyText, responseOptions);
        // v25.0.2 修復：補上缺失的 user 訊息記錄
        writeRecordDirectly(userId, msg, contextId, "user", "");
        // v29.3.21: 寫入紀錄時，若為陣列則合併
        const saveText = Array.isArray(replyText)
          ? replyText.join("\n\n")
          : replyText;
        writeRecordDirectly(userId, saveText, contextId, "assistant", "");
        // v24.1.24: 修正 Log 截斷問題，確保完整記錄 AI 回答
        // v27.7.6: Log 回覆時包含費用資訊，方便 testMessage 顯示成本
        // v29.5.103: 移除截斷限制，完整記錄 AI 回覆
        var replyForLog = replyText || finalText;
        writeLog(`[AI Reply] ${replyForLog}`);

        updateHistorySheetAndCache(contextId, history, userMsgObj, {
          role: "assistant",
          content: finalText,
        });

        // 2025-12-05 v23.6.5: 背景異步整理 (Async Background Summary)
        // v27.8.25: Async Summary temporarily disabled for syntax debugging
        // try { ... } catch (e) { ... }
      }
    } catch (apiErr) {
      // v29.5.83: User-Friendly Error Message (Hide technical details)
      const userFriendlyError =
        "⚠️ 抱歉，AI 暫時無法處理您的請求。\n(可能原因：網路連線逾時或系統忙碌)\n\n請稍後再試一次，或嘗試換個更具體的問法！💪";
      replyMessage(replyToken, userFriendlyError);
      writeLog(
        `[Handle API Error] ${apiErr.message} (Sent friendly error to user)`,
      );
    } finally {
      // v27.8.5: 可選：在此處也嘗試 flush，避免 GAS 超時被殺
      // 但 doPost 已有 finally flush，這裡可不寫，或為了保險寫一次
    }
  } catch (error) {
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

    const analysis = callLLMWithRetry(
      null, // query
      [{ role: "user", content: "分析圖片" }], // messages stub
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

    const history = getHistoryFromCacheOrSheet(contextId);
    updateHistorySheetAndCache(
      contextId,
      history,
      { role: "user", content: "[使用者傳送了一張圖片]" },
      { role: "assistant", content: `(針對圖片的分析結果) ${final}` },
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
    // v24.1.7: 清除動畫計時器，讓重啟後第一次詢問能顯示動畫
    const cache = CacheService.getScriptCache();
    // v29.5.27: 清除不滿意計數器與 PDF 狀態，避免測試時卡住
    cache.remove(`dissatisfied_count_${u}`);
    cache.remove(`pdf_consulted_${u}`);

    // v27.2.2: 修復 forceRebuild = true 導致的不必要的完全重建
    // /重啟 只應清除用戶的對話記憶，不應清空知識庫檔案紀錄
    // 知識庫維護交由自動排程（每日 04:00）和錯誤自動修復機制
    const resultMsg = syncGeminiKnowledgeBase(false);
    writeLog(`[Command] 重啟完成: ${resultMsg.split("\n")[0]}`);
    return `✓ 重啟完成 (對話已重置)\n${resultMsg}`;
  }

  if (cmd === "/取消") {
    CacheService.getScriptCache().remove(draftKey);
    CacheService.getScriptCache().remove(CACHE_KEYS.PENDING_QUERY + u);
    return "❌ 已取消建檔，回到一般對話模式。";
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

    // 取得最後一題 (通常是 Assistant 前的 User Message)
    // v29.5.79: 強話上下文組合。若上一題只是型號 (User 點選 Flex)，則必須再往前找問題內容
    let userMsg = history[history.length - 2]
      ? history[history.length - 2].content
      : history[0].content;

    // 簡單判斷：如果 userMsg 看起來像純型號 (長度<15 且含數字)
    if (userMsg.length < 15 && /\d/.test(userMsg) && history.length >= 4) {
      // 嘗試往前找上一則 User Message (History: U1(Q) -> A1 -> U2(Model) -> A2(Spec) -> Cmd)
      // Cmd 觸發時，History 尚未包含 Cmd。
      // A2 是 Spec Reply.
      // U2 是 Model (history[history.length - 2])
      // A1 是 Select Hint
      // U1 是 Question (history[history.length - 4])
      // v29.5.91: Use iterative search for previous user message instead of hardcoded index
      let prevUserMsg = "";
      // Start from index -3 (skip current U2, A2) -> Look for U1
      for (let i = history.length - 3; i >= 0; i--) {
        const h = history[i];
        // v29.5.93: Context Repair Hardening
        // Ignore messages with brackets [] (likely logs/tags) or non-user roles
        if (
          h.role === "user" &&
          !h.content.includes("[") &&
          !h.content.includes("]")
        ) {
          prevUserMsg = h.content;
          break;
        }
      }

      if (prevUserMsg) {
        writeLog(
          `[Command] 偵測到純型號上下文，組合前一題: ${prevUserMsg} + ${userMsg}`,
        );
        userMsg = `${userMsg} ${prevUserMsg}`; // S27AG500NC G5 怎麼設定
      }
    }

    // 處理計數器 (dissatisfied_count)
    const cache = CacheService.getScriptCache();
    const countKey = `dissatisfied_count_${u}`;
    let count = parseInt(cache.get(countKey) || "0") + 1;
    cache.put(countKey, count.toString(), 600); // 10 分鐘內有效

    if (count > 3) {
      writeLog(`[Command] 三振出局: ${u} 已重試 ${count} 次`);
      return "抱歉，我已經嘗試多種角度搜尋但似乎仍未找到完美答案。😅 建議你可以將問題描述得更具體，或直接聯繫 Sam 協助喔！";
    }

    // v29.5.27: SOP Enforcement (QA -> PDF -> Web)
    // 檢查是否已查過 PDF，若未查過且有型號，優先執行 PDF Search
    const pdfConsulted = cache.get(`pdf_consulted_${u}`) === "true";
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
            if (kbResult.files.length > 0) {
              triggerPDF = true;
              filesToAttach = kbResult.files;
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
      "", // targetModelName
    );

    if (triggerPDF) {
      cache.put(`pdf_consulted_${u}`, "true", 600);
    }

    if (searchResponse && searchResponse !== "[KB_EXPIRED]") {
      let result =
        formatForLineMobile(searchResponse) + "\n\n(🔍 網路搜尋補充資料)";

      // v29.5.85: Append Token Cost for Manual Web Search
      if (DEBUG_SHOW_TOKENS && lastTokenUsage && lastTokenUsage.costTWD) {
        result += `\n\n---\n本次對話預估花費：\nNT$${lastTokenUsage.costTWD.toFixed(4)}\n(In:${lastTokenUsage.input}/Out:${lastTokenUsage.output}=${lastTokenUsage.total})`;
      }
      // v29.5.111: 修復對話記憶問題
      // 🔥 關鍵修正：保存原始問題 (userMsg) 而非指令文字 (cmd)
      // 這樣用戶問「那 M8 呢」時，AI 能看到之前在討論什麼主題（如「線材」）
      // 而不是看到「不滿意這回答請繼續擴大搜尋」這種無意義的上下文
      updateHistorySheetAndCache(
        cid,
        history,
        { role: "user", content: userMsg },  // v29.5.111: 改為保存原始問題
        { role: "assistant", content: searchResponse },
      );
      writeLog(`[History Fix v29.5.111] 保存原始問題至歷史: ${userMsg.substring(0, 50)}...`);
      return result;
    } else {
      return "抱歉，網路搜尋連線逾時，請稍後再試。";
    }
  }

  return `❌ 未知指令\n\n【指令列表】\n/重啟 -> 重置對話+同步\n/紀錄 <內容> -> 開始建檔\n/紀錄 -> 存檔/整理QA\n/取消 -> 退出建檔\n不滿意這回答請繼續擴大搜尋 -> 啟動網路搜尋`;
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

    // Step 1: AI 產生初版 QA
    // v27.9.45: 傳入 userId 以便在模型失效時通知
    const polishedText = callGeminiToPolish(content, userId);
    writeLog(
      userId,
      "UserRecord",
      `[NewDraft] 初版 QA: ${polishedText.substring(0, 150)}`,
    );

    // 累計費用
    if (lastTokenUsage && lastTokenUsage.costTWD) {
      totalCostTWD += lastTokenUsage.costTWD;
      totalInputTokens += lastTokenUsage.input || 0;
      totalOutputTokens += lastTokenUsage.output || 0;
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
        originalContent: content,
        conversation: [],
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
        replyMsg += `\n\n---\n本次建檔預估花費：NT$${totalCostTWD.toFixed(
          4,
        )} (In:${totalInputTokens}/Out:${totalOutputTokens})`;
      }

      writeLog(userId, "UserRecord", `[NewDraft Reply] 等待用戶選擇 1/2/3`);
      return replyMsg;
    }

    // 沒找到相似，直接進入正常建檔模式
    var draft = {
      originalContent: content,
      conversation: [],
      currentQA: polishedText,
      userId: userId,
      pendingMergeChoice: false,
    };
    CacheService.getScriptCache().put(
      CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId,
      JSON.stringify(draft),
      CONFIG.DRAFT_TTL_SEC,
    );

    var alertMsg =
      "⚠️ 已進入建檔模式。接下來的對話將視為修改指令，直到輸入 /紀錄 存檔為止。";
    var preview =
      "\n\n【預覽】將寫入 QA：\n" +
      polishedText +
      "\n\n👉 確認存檔 → /紀錄\n👉 修改內容 → 直接回覆\n👉 放棄 → /取消";

    // v27.9.16: 附加費用資訊
    if (totalCostTWD > 0) {
      preview += `\n\n---\n本次建檔預估花費：NT$${totalCostTWD.toFixed(
        4,
      )} (In:${totalInputTokens}/Out:${totalOutputTokens})`;
    }

    writeLog(
      userId,
      "UserRecord",
      `[NewDraft Reply] ${(alertMsg + preview).substring(0, 100)}...`,
    );
    return alertMsg + preview;
  } catch (e) {
    writeLog(userId, "Error", `[NewDraft Error] ${e.message}`);
    return "❌ 分析失敗：" + e.message;
  }
}

function handleDraftModification(feedback, userId, replyToken, currentDraft) {
  try {
    writeLog(`[DraftMod] 用戶說: ${feedback}`);

    // 檢查是否在等待選擇 1/2
    if (currentDraft.pendingMergeChoice === true) {
      var choice = feedback.trim();

      if (choice === "1" || choice === "１") {
        // 選擇合併版，刪除舊 QA
        writeLog(`[DraftMod] 用戶選擇 1: 採用合併版`);
        deleteQARows(currentDraft.matchedQARows);

        var newDraft = {
          originalContent: currentDraft.originalContent,
          conversation: [],
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
      } else if (choice === "2" || choice === "２") {
        // 選擇純新版，保留舊 QA
        writeLog(`[DraftMod] 用戶選擇 2: 另開新條`);

        var newDraft = {
          originalContent: currentDraft.originalContent,
          conversation: [],
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
      } else if (choice === "3" || choice === "３") {
        // 選擇 3: 取代舊 QA
        // 邏輯: 刪除舊 QA (同選項1)，但寫入 freshVersion (而非 mergedVersion)
        writeLog(`[DraftMod] 用戶選擇 3: 取代舊 QA`);
        deleteQARows(currentDraft.matchedQARows);

        var newDraft = {
          originalContent: currentDraft.originalContent,
          conversation: [],
          currentQA: currentDraft.freshVersion, // 注意這裡用 freshVersion
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
        // 不是 1, 2 或 3，提醒用戶
        replyMessage(
          replyToken,
          "請輸入 1, 2 或 3 選擇：\n1️⃣ 採用合併版（刪除舊的）\n2️⃣ 另開新條（保留舊的）\n3️⃣ 取代舊 QA（刪除舊的，用新的）",
        );
        writeLog(`[DraftMod Reply] 提醒用戶選擇 1/2`);
        return;
      }
    }

    // 正常修改模式
    writeLog(
      `[DraftMod] 原始內容: ${(currentDraft.originalContent || "").substring(
        0,
        500,
      )}`,
    );
    writeLog(
      `[DraftMod] 目前 QA: ${(currentDraft.currentQA || "").substring(0, 500)}`,
    );

    // 累積對話歷史
    var conversation = currentDraft.conversation || [];
    conversation.push(feedback);

    // 帶完整上下文讓 LLM 重新產出 QA
    var newQA = callGeminiToRefineQA(
      currentDraft.originalContent,
      currentDraft.currentQA,
      conversation,
    );

    writeLog(`[DraftMod] 新 QA: ${newQA.substring(0, 500)}`);

    // 更新 draft
    var newDraft = {
      originalContent: currentDraft.originalContent,
      conversation: conversation,
      currentQA: newQA,
      userId: userId,
      pendingMergeChoice: false,
    };
    CacheService.getScriptCache().put(
      CACHE_KEYS.ENTRY_DRAFT_PREFIX + userId,
      JSON.stringify(newDraft),
      CONFIG.DRAFT_TTL_SEC,
    );

    var preview =
      "🔄 已修正草稿：\n\n【預覽】將寫入 QA：\n" +
      newQA +
      "\n\n👉 確認存檔 → /紀錄\n👉 繼續修改 → 直接回覆\n👉 放棄 → /取消";

    // v27.9.17: 附加費用資訊
    if (lastTokenUsage && lastTokenUsage.costTWD) {
      preview += `\n\n---\n本次修改預估花費：NT$${lastTokenUsage.costTWD.toFixed(
        4,
      )} (In:${lastTokenUsage.input}/Out:${lastTokenUsage.output})`;
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
        )} | Gemini 3 Flash)`,
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
    return warningMsg + rawText.trim().replace(/[\r\n]+/g, " ");
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
        return responseText.trim().replace(/[\r\n]+/g, " ");
      } catch (orErr) {
        writeLog(
          `[Modify OpenRouter Fail] ${orErr.message}, Fallback to Gemini`,
        );
      }
    }

    // v24.2.3: 簡單格式化用 Fast 模型
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

    return rawText.trim().replace(/[\r\n]+/g, " ");
  } catch (e) {
    writeLog(`[Modify Error] ${e.message}`);
    return simpleModifyFallback(currentText, instruction);
  }
}

// 降級：將使用者輸入快速轉為「問題 / A：答案」
function simplePolishFallback(input) {
  var text = (input || "").trim();
  if (!text) return "問題 / A：請補充內容";
  // 嘗試以第一個問句切分
  var qMatch = text.match(/^[^?！？。]+[?？]/);
  if (qMatch) {
    var q = qMatch[0].replace(/[。]/g, "").trim();
    var a = text.substring(q.length).trim() || "待補";
    return q.replace(/[?？]$/, "") + "嗎 / A：" + a;
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
  const base = (currentText || "").trim();
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

  const lock = LockService.getScriptLock();
  let hasLock = false;

  try {
    lock.waitLock(10000);
    hasLock = true;

    const sheet = ss.getSheetByName(SHEET_NAMES.QA);
    if (!sheet) {
      return "❌ 找不到 QA 工作表";
    }

    // 直接寫入 QA 文字
    sheet.appendRow([qaText]);
    SpreadsheetApp.flush();

    // 提早釋放鎖定，避免與 syncGeminiKnowledgeBase 發生死鎖
    if (hasLock) {
      try {
        lock.releaseLock();
      } catch (e) {}
      hasLock = false;
    }

    // 清除快取並同步知識庫
    CacheService.getScriptCache().remove(
      CACHE_KEYS.ENTRY_DRAFT_PREFIX + draft.userId,
    );
    syncGeminiKnowledgeBase();

    writeLog(
      draft.userId || "UNKNOWN",
      "UserRecord",
      `[Draft Saved to QA] ${qaText.substring(0, 50)}...`,
    );
    return `✅ 已寫入 QA 並更新知識庫！\n\n寫入內容：${qaText}`;
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
          costInfo = `\n\n---\n本次整理預估花費：NT$${costTWD.toFixed(4)} (In:${
            usage.promptTokenCount
          }/Out:${usage.candidatesTokenCount})`;
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
      /\b([SG]\d{2}[A-Z]{2}\d{3}[A-Z]{0,2}|M\d{1,2}[A-Z]?|G\d{1,2}[A-Z]{0,2}|S\d{1,2})\b/g;
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
      return sanitizeHistoryArray(
        JSON.parse(s.getRange(f.getRow(), 2).getValue()),
      );
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

      const summary = callGeminiToSummarize(oldMsgs);

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
    const events = json.events || [];

    events.forEach(function (event) {
      if (event.type === "message") {
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
      }
    });
    return ContentService.createTextOutput(
      JSON.stringify({ status: "ok" }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
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
  // 🧪 TEST MODE: 不呼叫 LINE API (清除測試介面時請移除此判斷)
  if (IS_TEST_MODE || tk === "TEST_REPLY_TOKEN") {
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
        ? txt.replace(/\n/g, ' ')
        : (txt.altText || "[Flex Message]");
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

// 1. 網頁入口（合併版：健康檢查 + TestUI）
// - LINE Verify: 不帶參數，返回 200 OK
// - TestUI: 訪問 ?test=1，返回測試介面
function doGet(e) {
  // 確保觸發器存在
  ensureSyncTriggerExists();

  // 若有 test 參數，顯示 TestUI
  if (e && e.parameter && e.parameter.test === "1") {
    return HtmlService.createTemplateFromFile("TestUI")
      .evaluate()
      .setTitle("LINE Bot 測試模擬器 v2.3")
      .addMetaTag(
        "viewport",
        "width=device-width, initial-scale=1, user-scalable=no",
      );
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
function testMessage(msg, userId) {
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

  // 1️⃣ 優先找 [Reply] 和 [AI Reply]
  for (var i = 0; i < TEST_LOGS.length; i++) {
    var log = TEST_LOGS[i];
    if (log.indexOf("[Reply]") > -1 || log.indexOf("[AI Reply]") > -1) {
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
function clearTestSession(userId) {
  var cache = CacheService.getScriptCache();
  userId = userId || "TEST_DEV_001";
  cache.remove(`${userId}:context`);
  cache.remove(`${userId}:pdf_mode`);
  cache.remove(`${userId}:direct_search_models`);
  cache.remove(`${userId}:hit_alias_key`);
  return { success: true, msg: "✅ 髒資料已清除" };
}

// --- 雲端歷史紀錄功能 ---

function getCloudHistory() {
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

function saveCloudHistory(historyArray) {
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
    version: "v27.9.64",
    description: `Back: ${LLM_PROVIDER} | Smart Editor Mode: ON | Dynamic Rules`,
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
        footerText: "點選型號後AI將為您深入分析",
      };
    }
  }

  // 2. Price / Web Intent
  if (m.match(/多少錢|價格|價錢|售價|哪裡買|costco|pchome|momo|通路/)) {
    return {
      headerText: "🔍 請選擇型號以查詢價格/通路",
      footerText: "將為您搜尋網路公開資訊",
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
  // 1. Strict Deduplication (Case Insensitive)
  const uniqueModels = [];
  const seen = new Set();

  models.forEach((m) => {
    const key = m.trim().toUpperCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      uniqueModels.push(m.trim());
    }
  });

  // v29.5.23: 降冪排列（Z-A）
  uniqueModels.sort((a, b) => b.localeCompare(a));

  const displayModels = uniqueModels.slice(0, 10);
  const remainingCount = uniqueModels.length - displayModels.length;

  // 建立型號按鈕 - 使用 primary 風格
  const buttons = displayModels.map((model, index) => {
    const label = `${model}`.substring(0, 20);
    return {
      type: "button",
      action: {
        type: "message",
        label: label,
        text: `${model}`,
      },
      style: "primary",
      color: "#4A90D9", // 清爲藍色
      margin: "md", // v29.5.16: 增加間距
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
          text: intentConfig ? intentConfig.headerText : "🔍 請選擇型號",
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
          text: intentConfig
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

  return {
    type: "carousel",
    contents: [bubble],
  };
}

/**
 * 發送 Flex Message
 */
function replyFlexMessage(replyToken, flexContainer, altText) {
  // 🧪 TEST MODE START (v29.5.98 Fixed)
  if ((typeof IS_TEST_MODE !== 'undefined' && IS_TEST_MODE) || replyToken === "TEST_REPLY_TOKEN") {
    writeLog(`[Flex Reply] Alt: ${altText}, JSON: ${JSON.stringify(flexContainer)}`);
    return 200;
  }
  // 🧪 TEST MODE END

  const url = "https://api.line.me/v2/bot/message/reply";
  // v29.5.12: Correct key is LINE_TOKEN
  const accessToken =
    PropertiesService.getScriptProperties().getProperty("LINE_TOKEN");

  const payload = {
    replyToken: replyToken,
    messages: [
      {
        type: "flex",
        altText: altText || "請查看選單",
        contents: flexContainer,
      },
    ],
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const resCode = response.getResponseCode();
    const resBody = response.getContentText();

    if (resCode !== 200) {
      writeLog(`[Reply Flex Error] ${resCode}: ${resBody}`);
    }
    // v29.5.0: Simplify Reply Log (Silent Success)
    // else { writeLog(`[Reply Flex Success]`); }

    return resCode;
  } catch (e) {
    writeLog(`[Reply Flex Exception] ${e.message}`);
    return 500;
  }
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
function checkPdfCost(userMsg) {
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
