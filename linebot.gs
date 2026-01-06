// ⛔️ FATAL RULE: NEVER USE LINE PUSH MESSAGES. EVER.
// ════════════════════════════════════════════════════════════════
// 🔧 模型與計價設定 (要調整就改這裡！)
// ════════════════════════════════════════════════════════════════
const EXCHANGE_RATE = 32; // 匯率 USD -> TWD

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
      CACHE_KEYS.STRONG_KEYWORDS
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
          `[DirectDeep] 命中 CLASS_RULES 直通車關鍵字: ${hitKey} (長度: ${hitKey.length})`
        );

        // v24.1.9 新增：從 KEYWORD_MAP 提取該關鍵字對應的所有型號
        // 讓 getRelevantKBFiles() 能夠匹配相關 PDF
        try {
          const mapJson = PropertiesService.getScriptProperties().getProperty(
            CACHE_KEYS.KEYWORD_MAP
          );
          if (mapJson) {
            const keywordMap = JSON.parse(mapJson);
            const mappedValue = keywordMap[hitKey];
            writeLog(
              `[DirectDeep] 查詢 KEYWORD_MAP[${hitKey}] = ${
                mappedValue ? mappedValue.substring(0, 50) + "..." : "NOT FOUND"
              }`
            );

            if (mappedValue) {
              // 從映射值提取型號
              const MODEL_REGEX =
                /\b(G\d{2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|S\d{2}[A-Z]{2}\d{3}[A-Z]{0,2}|[CF]\d{2}[A-Z]\d{3})\b/g;
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
                }`
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
                  300
                );
                writeLog(
                  `[DirectDeep] ✅ 注入型號到 Cache (userId: ${userId}): ${models.join(
                    ", "
                  )}`
                );
              } else {
                writeLog(
                  `[DirectDeep] ⚠️  無法從映射值提取型號（術語無型號），跳過注入`
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
      CACHE_KEYS.STRONG_KEYWORDS
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
            ", "
          )} (共 ${hitKeys.length} 個)`
        );

        // 從 KEYWORD_MAP 提取所有命中關鍵字對應的型號
        const allModels = [];
        try {
          const mapJson = PropertiesService.getScriptProperties().getProperty(
            CACHE_KEYS.KEYWORD_MAP
          );
          if (mapJson) {
            const keywordMap = JSON.parse(mapJson);
            const MODEL_REGEX =
              /\b(G\d{2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|S\d{2}[A-Z]{2}\d{3}[A-Z]{0,2}|[CF]\d{2}[A-Z]\d{3})\b/g;

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
              } (共 ${allModels.length} 個)`
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
            300
          );
          writeLog(
            `[DirectDeep] ✅ 注入型號到 Cache (userId: ${userId}): ${allModels.join(
              ", "
            )}`
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
 * @param {string} aliasKey - 別稱關鍵字（如 M8, G9, ODYSSEYHUB）
 * @returns {Object} { pattern: string, matchedPdfs: [{name, models}], needAsk: boolean }
 */
function searchPdfByAliasPattern(aliasKey) {
  try {
    const kbListJson = PropertiesService.getScriptProperties().getProperty(
      CACHE_KEYS.KB_URI_LIST
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
      // 檢查是否為別稱行且包含此關鍵字
      if (
        firstCol.startsWith("別稱_") &&
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
            `[PDF Search] 從 CLASS_RULES 提取模式: ${aliasKey} → ${pdfPattern}`
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
              let prefix = model.substring(0, Math.min(7, model.length));
              // 確保結尾是數字或字母，不是半截
              if (prefix.length >= 6) {
                prefix = prefix.substring(0, 6);
              }

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
      `[PDF Search] 結果: ${matchedPdfs.length} 個匹配 (needAsk: ${needAsk})`
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
          `[PDF Select] 用戶選擇 ${choice}: ${selected.prefix} → ${selected.name}`
        );

        // 清除等待狀態
        cache.remove(pendingKey);

        // v24.4.1: 顯示 Loading 動畫（PDF 查詢可能需要 1-2 分鐘）
        showLoadingAnimation(userId, 60);

        // 注入選中的 PDF 型號到 Cache
        cache.put(
          `${userId}:direct_search_models`,
          JSON.stringify([selected.matchedModel]),
          300
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
              msg.role === "assistant" &&
              msg.content &&
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
            content: buildPdfSelectionMessage(
              pending.aliasKey,
              pending.options
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
          `[PDF Mode] 開始查詢手冊，可能需要 60 秒 (選擇: ${selected.matchedModel})`
        );
        const response = callChatGPTWithRetry(
          [...cleanedHistory, forceAskMsg],
          null,
          true,
          false,
          userId
        );

        if (response) {
          let finalText = formatForLineMobile(response);
          finalText = finalText.replace(/\[AUTO_SEARCH_PDF\]/g, "").trim();
          finalText = finalText.replace(/\[NEED_DOC\]/g, "").trim();
          finalText = finalText.replace(/\[NEW_TOPIC\]/g, "").trim();

          // v27.0.0: 修復費用顯示邏輯
          // 只在有有效回答和有 lastTokenUsage 時才顯示費用
          let replyText = finalText;
          if (DEBUG_SHOW_TOKENS && lastTokenUsage && lastTokenUsage.costTWD) {
            const tokenInfo = `\n\n---\n本次對話預估花費：\nNT$${lastTokenUsage.costTWD.toFixed(
              4
            )}\n(In:${lastTokenUsage.input}/Out:${lastTokenUsage.output}=${
              lastTokenUsage.total
            })`;
            replyText += tokenInfo;
          }

          replyMessage(replyToken, replyText);

          // v27.7.6: 回寫包含費用的完整回覆，方便 testMessage 顯示金額
          writeLog(
            `[AI Reply] ${replyText.substring(0, 2000)}${
              replyText.length > 2000 ? "..." : ""
            }`
          );
          writeLog(
            `[PDF Mode] 完成查詢手冊，花費 ${
              lastTokenUsage && lastTokenUsage.costTWD
                ? "NT$" + lastTokenUsage.costTWD.toFixed(4)
                : "未知成本"
            }`
          );

          // v25.0.3: 用戶選擇「3」後，新增該選擇和回答到歷史
          const selectMsgObj = { role: "user", content: msg }; // "3"
          const asstMsgObj = { role: "assistant", content: finalText };
          updateHistorySheetAndCache(
            contextId,
            cleanedHistory,
            selectMsgObj,
            asstMsgObj
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
        300
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
        `[PDF Mode] 開始查詢手冊，可能需要 60 秒 (完整型號: ${inputModel})`
      );
      const response = callChatGPTWithRetry(
        [...cleanedHistory, userMsgObj],
        null,
        true,
        false,
        userId
      );

      if (response) {
        let finalText = formatForLineMobile(response);
        finalText = finalText.replace(/\[AUTO_SEARCH_PDF\]/g, "").trim();
        finalText = finalText.replace(/\[NEW_TOPIC\]/g, "").trim();

        // v27.0.0: 修復費用顯示邏輯（同上，確保費用對應當前查詢）
        let replyText = finalText;
        if (DEBUG_SHOW_TOKENS && lastTokenUsage && lastTokenUsage.costTWD) {
          const tokenInfo = `\n\n---\n本次對話預估花費：\nNT$${lastTokenUsage.costTWD.toFixed(
            4
          )}\n(In:${lastTokenUsage.input}/Out:${lastTokenUsage.output}=${
            lastTokenUsage.total
          })`;
          replyText += tokenInfo;
        }

        replyMessage(replyToken, replyText);

        // v27.7.6: 回寫包含費用的完整回覆，方便 testMessage 顯示金額
        writeLog(
          `[AI Reply] ${replyText.substring(0, 2000)}${
            replyText.length > 2000 ? "..." : ""
          }`
        );
        writeLog(
          `[PDF Mode] 完成查詢手冊，花費 ${
            lastTokenUsage && lastTokenUsage.costTWD
              ? "NT$" + lastTokenUsage.costTWD.toFixed(4)
              : "未知成本"
          }`
        );

        // v24.4.3 修復：正確的參數順序 (cid, prev, uMsg, aMsg)
        const asstMsgObj = { role: "assistant", content: finalText };
        updateHistorySheetAndCache(
          contextId,
          cleanedHistory,
          userMsgObj,
          asstMsgObj
        );
        writeRecordDirectly(
          userId,
          pending.originalQuery,
          contextId,
          "user",
          ""
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
function buildPdfSelectionMessage(aliasName, matchedPdfs) {
  let msg = `${aliasName} 有幾個版本，請問你的螢幕型號開頭是？\n`;

  matchedPdfs.forEach((pdf, index) => {
    const num = index + 1;
    const emoji =
      ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"][index] ||
      `${num}.`;
    msg += `${emoji} ${pdf.prefix}...\n`;
  });

  msg += `\n都不是的話可以找 Sam 幫你查喔！\n`;
  msg += `或直接告訴我完整型號（通常在螢幕背面標籤）`;

  return msg;
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
        currentModels.some((cm) => pm === cm)
      );
      if (!isSameModel) {
        writeLog(
          `[ModelChange] 偵測到型號變化：${previousModels.join(
            ","
          )} → ${currentModels.join(",")}，清除 PDF Mode`
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

    // 1. 準備查核清單 (從 Cache 讀取 KEYWORD_MAP，獲得所有合法的短型號)
    let validKeywords = null;
    try {
      const mapJson = PropertiesService.getScriptProperties().getProperty(
        CACHE_KEYS.KEYWORD_MAP
      );
      if (mapJson) {
        const map = JSON.parse(mapJson);
        validKeywords = Object.keys(map); // 例如: ['M8', 'M9', 'G9', 'ODYSSEYHUB', ...]
      }
    } catch (e) {
      writeLog("[extractModelNumbers] KEYWORD_MAP 讀取失敗，使用離線模式");
    }

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

    // 3. 執行搜捕與查核
    modelPatterns.forEach((config) => {
      let match;
      while ((match = config.pattern.exec(upperText)) !== null) {
        let candidate = (match[1] || match[0]).trim();
        // 去除頭尾非英數字符（例如 "（M8" 會變成 "M8"）
        candidate = candidate.replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, "");

        if (!candidate || candidate.length < 2 || models.includes(candidate))
          continue;

        // 🔥 關鍵：短型號雙重認證 (Short Model Validation)
        if (config.needValidate && candidate.length < 4) {
          // 只有在 CLASS_RULES 裡有登記的短型號 (如 M8, G9) 才算數
          // 避免被「3M膠帶」的「3M」或「M3」騙到
          if (validKeywords) {
            // 完全匹配或包含匹配（例如 "M8" 或 "ODYSSEYHUB" 都要查）
            const isValid = validKeywords.some(
              (kw) => kw === candidate || kw.includes(candidate)
            );
            if (isValid) {
              models.push(candidate);
            }
          } else {
            // 離線模式：保守方案，短型號預設信任（因為無法查核）
            models.push(candidate);
          }
        } else {
          // 長型號直接放行（足夠特殊，不易誤判）
          models.push(candidate);
        }
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
        CACHE_KEYS.KEYWORD_MAP
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
 * 建立動態上下文 (Dynamic Context)
 * 根據用戶訊息，從 Cache 中撈取相關的 QA 和 Rules
 */
function buildDynamicContext(messages, userId) {
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
              ", "
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
      writeLog(
        `[DynamicContext Debug] Cache Hit: QA Count=${qaCount}, FullQA Length=${
          fullQA.length
        }, First 50 chars=${fullQA.substring(0, 50)}`
      );
    } else {
      // v27.8.7 Fallback: 若 Cache 失效，強制讀取 Sheet (防呆機制)
      writeLog(
        "[DynamicContext] ⚠️ QA Cache Miss - 啟動救援模式：直接讀取 Sheet"
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

    // 3. 載入 Rules
    let fullRules = "";
    const rulesCount = parseInt(cache.get("KB_RULES_COUNT") || "0");
    if (rulesCount > 0) {
      for (let i = 0; i < rulesCount; i++) {
        fullRules += cache.get(`KB_RULES_${i}`) || "";
      }
    } else {
      // v27.8.7 Fallback: 若 Cache 失效，強制讀取 Sheet (防呆機制)
      writeLog(
        "[DynamicContext] ⚠️ Rules Cache Miss - 啟動救援模式：直接讀取 Sheet"
      );
      try {
        const ruleSheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
        if (ruleSheet && ruleSheet.getLastRow() > 1) {
          const data = ruleSheet
            .getRange(2, 1, ruleSheet.getLastRow() - 1, 1)
            .getValues();
          fullRules = data
            .map((row) => {
              if (!row[0]) return "";
              return row[0].toString();
            })
            .join("\n");
        }
        // 也要讀 Definitions? 原始 sync 是分開拼的，這裡簡單全讀
        // 這裡的 fullRules 應該要包含 definitionsContent + specsContent
        // 上面的簡單讀取其實已經包含了整張表的內容，符合需求
      } catch (e) {
        writeLog(`[Fallback Error] Rules Read Failed: ${e.message}`);
      }
    }

    // 4. 載入 Guide
    const guide = cache.get("KB_GUIDE") || "";

    // 5. 篩選邏輯 (簡單關鍵字匹配)
    // 提取訊息中的潛在關鍵字 (英文數字組合 > 2碼, 或中文詞彙)
    // 這裡使用簡單策略：將 QA/Rules 依行分割，若該行包含訊息中的關鍵字則保留

    // 提取關鍵字 (型號、術語)
    const keywords = upperMsg.match(/[A-Z0-9]{3,}/g) || [];

    // 2025-12-05: 改為「通用中文關鍵字擷取」，不再硬寫死特定詞彙
    // v27.9.60: 增加「語意分詞 (Semantic Segmentation)」機制
    // 為了解決 "強力洗淨和一般洗" 被當作一個詞的問題，我們定義一組「分詞符號 (Particles)」
    // 在提取關鍵字前，先把這些虛詞換成空格，達到自然分詞的效果
    let processedMsg = upperMsg;
    const segmentList = [
      "和",
      "跟",
      "與",
      "的",
      "了",
      "嗎",
      "呢",
      "吧",
      "有",
      "是",
      "在",
      "對",
      "也",
      "就",
      "都",
      "及",
      "或",
      "等",
      "但",
      "去",
      "來",
      "看",
      "查",
      "問",
      "說",
      "想",
      "要",
      "能",
      "會",
    ];
    segmentList.forEach((particle) => {
      // 簡單全域替換為空格
      processedMsg = processedMsg.split(particle).join(" ");
    });

    // 擷取所有長度 >= 2 的中文詞彙，讓使用者說什麼就查什麼
    const cnKeywords = processedMsg.match(/[\u4e00-\u9fa5]{2,}/g) || [];

    // v27.9.62: 用戶要求完整保留日誌以便除錯，不進行截斷
    writeLog(
      `[General] [DynamicContext] 開始規格反查，中文關鍵字 (全): ${cnKeywords.join(
        ", "
      )}`
    );

    // v27.9.61: 洗衣機規則安全排除邏輯
    // 只有在用戶明確提到「洗」、「衣」、「機」、「強力洗淨」、"WA"、"WD" 等關鍵詞時，才允許注入洗衣機規則
    // 防止詢問「螢幕」時因為通用詞 (如 "系列") 而誤觸發洗衣機規則
    // v27.9.63: 修正為只檢查「最新用戶訊息」(upperLatestMsg)，避免歷史對話中的洗衣機關鍵字污染當前查詢
    const WASHING_MACHINE_TRIGGERS = ["洗", "衣", "機", "淨", "WA", "WD", "VR"];
    const isWashingMachineRelated = WASHING_MACHINE_TRIGGERS.some((trigger) =>
      upperLatestMsg.includes(trigger)
    );

    // 2025-12-05: 排除過於寬泛或無意義的關鍵字 (Stop Words)
    // 修正：保留重要產品系列名 (ODYSSEY, SMART, OLED, QLED)，避免過度過濾導致變笨
    const stopList = [
      "SAMSUNG",
      "MONITOR",
      "GAMING",
      "UHD",
      "WQHD",
      "請問",
      "可以",
      "什麼",
      "怎麼",
      "如何",
      "有沒有",
      "謝謝",
      "你好",
      "三星",
      "螢幕",
      "顯示器",
      "知道",
      "告訴",
      "問題",
      "一下",
      "這個",
      "那個",
      "因為",
      "所以",
      "但是",
      "如果",
    ];

    const filteredKeywords = keywords.filter((k) => !stopList.includes(k));
    const filteredCnKeywords = cnKeywords.filter((k) => !stopList.includes(k));

    // v27.8.12 Refactor: 真正實現 Data-Driven (資料驅動)
    // 使用者說得對：不應該用 Regex 硬刻 (如 [A-Z][0-9])，而應該直接去查 CLASS_RULES (即 KEYWORD_MAP)
    // 只要 User Input 包含 KEYWORD_MAP 中的任何 Key (別稱/型號)，就視為關鍵字命中
    // 這樣 "Odyssey3D", "G7", "M8" 都能被正確抓到，完全依照 Sheet 定義
    let sheetDefinedKeywords = [];
    let reverseMatchedModels = []; // v27.9.58: 規格內容反查型號
    try {
      const mapJson = PropertiesService.getScriptProperties().getProperty(
        CACHE_KEYS.KEYWORD_MAP
      );
      if (mapJson) {
        const keywordMap = JSON.parse(mapJson);
        Object.keys(keywordMap).forEach((key) => {
          // key 是 Sheet 裡的「別稱_XXX」或直接型號
          // 我們檢查 combinedQuery (User Input) 是否包含此 key
          if (upperMsg.includes(key.toUpperCase())) {
            sheetDefinedKeywords.push(key);
          }
        });

        // v27.9.58: 規格內容反查 (Reverse Lookup)
        // 掃描 Values 找出包含用戶說的關鍵字 (如「強力洗淨」) 的型號
        // v27.9.59: 移除「sheetDefinedKeywords.length === 0」限制，讓反查總是執行
        if (filteredCnKeywords.length > 0) {
          writeLog(
            `[DynamicContext] 開始規格反查，中文關鍵字: ${filteredCnKeywords.join(
              ", "
            )}`
          );
          Object.entries(keywordMap).forEach(([modelKey, specContent]) => {
            // specContent 是該型號的完整規格內容
            if (typeof specContent === "string") {
              const upperSpec = specContent.toUpperCase();
              // 檢查規格內容是否包含用戶說的任何中文關鍵字
              for (const cnKw of filteredCnKeywords) {
                if (upperSpec.includes(cnKw.toUpperCase())) {
                  // 找到了！把型號加入反查結果
                  if (!reverseMatchedModels.includes(modelKey)) {
                    reverseMatchedModels.push(modelKey);
                  }
                  break; // 一個型號只加一次
                }
              }
            }
          });
          if (reverseMatchedModels.length > 0) {
            const bestMatchModel = reverseMatchedModels[0];
            writeLog(
              `[DynamicContext] 規格反查命中: ${reverseMatchedModels.join(
                ", "
              )} (關鍵字: ${filteredCnKeywords.join(", ")})`
            );
            // v27.9.61: 將反查到的型號存入 Cache，供 PDF 搜尋使用 (TTL: 5分鐘)
            // v27.9.63 Debug: 強制記錄 userId 狀態
            // writeLog(`[DynamicContext Debug] UserId: ${userId} (${typeof userId})`);

            if (userId) {
              const cache = CacheService.getScriptCache();
              cache.put(`REVERSE_LOOKUP_MODEL:${userId}`, bestMatchModel, 300);
              writeLog(
                `[DynamicContext] 已暫存反查型號 ${bestMatchModel} 至 Cache (User: ${userId})`
              );
            } else {
              writeLog(
                `[DynamicContext Debug] ⚠️ UserId 為空，無法寫入 Cache!`
              );
            }
            // 將反查到的型號加入 sheetDefinedKeywords，讓後續流程正常運作
            sheetDefinedKeywords.push(...reverseMatchedModels);
          } else {
            writeLog(`[DynamicContext] 規格反查無命中`);
          }
        }
      }
    } catch (e) {
      writeLog(`[DynamicContext] Keyword Map Load Error: ${e.message}`);
    }

    // v27.9.64: Proactive Prompting (主動引導)
    // 若反查有結果，強制注入系統提示，要求 LLM 主動假設型號並查手冊
    let systemHint = "";
    if (reverseMatchedModels.length > 0) {
      const bestMatch = reverseMatchedModels[0];
      systemHint = `\n【系統強力提示】\n偵測到用戶的描述高度符合型號規格：${bestMatch}。\n請直接假設用戶正在詢問 ${bestMatch}。\n若 Rules 資料不足以回答其具體操作或差異，請直接輸出 [AUTO_SEARCH_PDF] 以查閱手冊，不要反問用戶是否為該型號。\n`;
      writeLog(`[DynamicContext] 已注入主動引導提示: ${bestMatch}`);
    }

    const shortModelPattern = /\b[A-Z][0-9]{1,2}\b/g;
    const shortModels = upperMsg.match(shortModelPattern) || [];

    // 整合：(Sheet 定義的關鍵字) + (Regex 輔助保底) + (原本的長關鍵字/中文)
    // 雖然 regex 被罵，但在 Cache Miss 時它是唯一的救命稻草，所以作為 Fallback 保留，但優先級低於 Sheet
    let finalKeywords = [
      ...new Set([
        ...filteredKeywords,
        ...filteredCnKeywords,
        ...sheetDefinedKeywords,
        ...shortModels,
      ]),
    ];

    const allKeywords = finalKeywords;

    let relevantContext = "【精選 QA & 規格】\n";

    // 注入推斷型號上下文
    if (inferredModelContext) {
      relevantContext += inferredModelContext + "\n";
    }

    // 總是加入 Guide (型號識別指南)
    relevantContext += guide + "\n";

    // v24.0.0: 智慧搜尋策略 - 找到足夠就停止，節省 Token
    // 搜尋順序：QA (精準答案) → Rules (規格補充)
    // 目標：有關鍵字時最多 15 筆匹配；無關鍵字時最多 10 筆保底

    const MAX_KEYWORD_MATCHES = 20; // v27.9.23: 稍微放寬 QA 上限
    const MAX_FALLBACK = 10; // 無關鍵字時的保底上限
    let totalMatches = 0;

    // 1️⃣ 先搜 QA (優先級最高，通常有完整答案)
    // v27.9.15: 全掃 + 排序機制 - 確保最相關的 QA 被選中，不論位置
    if (fullQA && totalMatches < MAX_KEYWORD_MATCHES) {
      const qaLines = fullQA.split("\n").filter((line) => line.trim());

      if (allKeywords.length > 0) {
        // 有關鍵字：全掃所有 QA，計算匹配分數，排序後取前 N 條
        const scoredQA = qaLines.map((line) => {
          const upperLine = line.toUpperCase();
          // 分數 = 匹配到的關鍵字數量
          const score = allKeywords.filter((k) => upperLine.includes(k)).length;

          // v27.9.27 修正: 通用 QA 召回機制 (Generic QA Recall)
          // 若 QA 內容包含「三星螢幕」或「SMART」等通用詞，即使沒有命中 M7，也給予保底分，確保通用知識能被注入
          if (
            score === 0 &&
            (upperLine.includes("三星螢幕") || upperLine.includes("SMART"))
          ) {
            // 確保至少有一點分數 (0.5)，這樣會被 filter(score > 0) 保留
            // 但排序時會排在精確匹配 (score >= 1) 的後面
            return { line, score: 0.5 };
          }
          return { line, score };
        });

        // 排序：分數高的排前面
        scoredQA.sort((a, b) => b.score - a.score);

        // 取前 N 條（只取有匹配的）
        const MAX_QA_RESULTS = 10; // QA 最多注入 10 條
        for (const item of scoredQA) {
          if (item.score === 0) break; // 沒匹配的不要
          if (totalMatches >= MAX_QA_RESULTS) break;
          relevantContext += item.line + "\n";
          totalMatches++;
        }

        writeLog(
          `[DynamicContext] QA 全掃完成: ${
            scoredQA.filter((q) => q.score > 0).length
          } 筆相關，注入 ${totalMatches} 筆`
        );
      } else {
        // 無關鍵字：只抓前 N 行保底
        for (
          let i = 0;
          i < qaLines.length && totalMatches < MAX_FALLBACK;
          i++
        ) {
          relevantContext += qaLines[i] + "\n";
          totalMatches++;
        }
      }
    }

    // 2️⃣ 再搜 Rules (v27.9.3: 每個關鍵字獨立配額，解決多型號比較時的資料截斷問題)
    // 確保「M8 和 M9」這類比較問題中，兩個型號的規格都能被注入
    if (fullRules && allKeywords.length > 0) {
      const ruleLines = fullRules.split("\n");
      const MAX_PER_KEYWORD = 15; // v27.9.23: 提高上限至 15 (避免 "Smart系列" 等定義類規則被 spec 擠掉)
      const MAX_TOTAL_RULES = 80; // v27.9.23: 提高總上限 (Flash 模型 Context 很大，多一點無妨)
      const MAX_KEYWORDS = 10; // 關鍵字上限，防止嵌套迴圈過多
      const keywordCounts = {}; // 記錄每個關鍵字已匹配的行數
      let totalRulesMatches = 0;

      // v27.9.3: 限制關鍵字數量，防止嵌套迴圈導致逾時
      const limitedKeywords = allKeywords.slice(0, MAX_KEYWORDS);
      if (allKeywords.length > MAX_KEYWORDS) {
        writeLog(
          `[DynamicContext] ⚠️ 關鍵字過多 (${allKeywords.length})，限制處理前 ${MAX_KEYWORDS} 個`
        );
      }

      // 初始化計數器
      limitedKeywords.forEach((k) => (keywordCounts[k] = 0));

      for (const line of ruleLines) {
        if (!line.trim()) continue;
        if (totalRulesMatches >= MAX_TOTAL_RULES) break;

        const upperLine = line.toUpperCase();
        let lineAdded = false;

        // 檢查這行匹配哪些關鍵字，且該關鍵字還有配額
        for (const keyword of limitedKeywords) {
          if (
            upperLine.includes(keyword) &&
            keywordCounts[keyword] < MAX_PER_KEYWORD
          ) {
            if (!lineAdded) {
              relevantContext += line + "\n";
              totalRulesMatches++;
              totalMatches++;
              lineAdded = true;
            }
            keywordCounts[keyword]++;
          }
        }
      }

      writeLog(
        `[DynamicContext] Rules 匹配: ${totalRulesMatches} 行 (配額: ${JSON.stringify(
          keywordCounts
        )})`
      );
    }

    // 若篩選後內容太少，可能是關鍵字沒抓到，加入一些基礎定義?
    // 暫不加入，保持精簡

    // Inject systemHint at the end to ensure it has high priority
    return relevantContext + (systemHint || "");
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
      CACHE_KEYS.KEYWORD_MAP
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
    upperKey
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

    writeLog(`[Sync] 開始執行知識庫同步... (forceRebuild: ${forceRebuild})`);

    const apiKey =
      PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("缺少 GEMINI_API_KEY");
    }

    // 讀取舊的快取清單
    let oldKbList = [];
    const oldJson = PropertiesService.getScriptProperties().getProperty(
      CACHE_KEYS.KB_URI_LIST
    );

    // 如果強制重建，先清理 Gemini 上的舊檔案再清除本地快取
    if (forceRebuild) {
      writeLog("[Sync] 強制重建模式，先清理 Gemini 舊檔案...");
      cleanupOldGeminiFiles(apiKey);
      PropertiesService.getScriptProperties().deleteProperty(
        CACHE_KEYS.KB_URI_LIST
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
      writeLog(
        `[Sync Debug] QA Sheet: ${qaRows.length} rows valid. Content length: ${qaContent.length}`
      );

      // v27.9.23: 防災機制 - 若 QA 異常空白 (讀取失敗?)，停止同步以保護 Diff
      if (qaRows.length === 0 && !forceRebuild) {
        writeLog(
          "[Sync Safety] ⚠️ QA 讀取筆數為 0，且非強制重建。判定為讀取異常，中止同步以保護快取。"
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

    const ruleSheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    if (ruleSheet && ruleSheet.getLastRow() > 1) {
      const data = ruleSheet
        .getRange(2, 1, ruleSheet.getLastRow() - 1, 1)
        .getValues();

      data.forEach((row) => {
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
          // v24.1.17: 放寬長度限制，允許 2 碼關鍵字 (如 S8, M7, G9)
          if (cleanKey.length >= 2) {
            strongKeywords.push(cleanKey);
          }
        }

        // 移除前綴 (別稱_, 術語_, 系列_) 以便正確匹配
        let key = rawKey.replace(/^(別稱|術語|系列)_/, "");

        // 分流邏輯
        let isModelRow = false;
        let sModel = "";

        // 判斷是否為型號規格行 (新格式: 型號：S... 或 舊格式: LS...)
        if (key.startsWith("型號：") || key.startsWith("型號:")) {
          isModelRow = true;
          sModel = key.replace(/^型號[：:]/, "").trim();
          key = sModel; // 將 key 更新為純型號 (S27DG602SC)
        } else if (key.startsWith("LS")) {
          isModelRow = true;
          sModel = key.replace(/^LS/, "S").replace(/XZW$/, "");
        }

        if (isModelRow) {
          specsContent += `* ${text}\n`;

          // 提取別稱建立雙向映射 (G80SD ↔ S32DG802SC)
          // 掃描整行文字尋找可能的別稱 (Gxx, Mxx, Sxx...)
          const potentialAliases =
            text.match(
              /\b(G\d{2}[A-Z]{1,2}|M\d{2}[A-Z]|S\d{2}[A-Z]{2}\d{3}[A-Z]{2}|[CF]\d{2}[A-Z]\d{3})\b/g
            ) || [];

          potentialAliases.forEach((alias) => {
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
    PropertiesService.getScriptProperties().setProperty(
      CACHE_KEYS.KEYWORD_MAP,
      JSON.stringify(keywordMap)
    );
    PropertiesService.getScriptProperties().setProperty(
      CACHE_KEYS.STRONG_KEYWORDS,
      JSON.stringify(strongKeywords)
    );
    writeLog(
      `[Sync] 建立關鍵字映射: ${
        Object.keys(keywordMap).length
      } 筆, 直通車關鍵字: ${strongKeywords.length} 筆`
    );

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
    writeLog(
      `[Sync Debug] QA Chunked into ${qaChunks.length} parts. Saved to Cache.`
    );

    // 存入 Rules (Definitions + Specs)
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
              "application/pdf"
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

    // 更新 Cache
    PropertiesService.getScriptProperties().setProperty(
      CACHE_KEYS.KB_URI_LIST,
      JSON.stringify(newKbList)
    );

    const statusMsg = `✓ 重啟與同步完成\n- 新增上傳：${uploadCount} 本\n- 沿用舊檔：${skipCount} 本\n- Sheet 資料：已更新`;
    writeLog(statusMsg);

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
      } catch (e) {
        writeLog(`[Lock Release Error] ${e.message}`);
      }
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
        `${CONFIG.API_ENDPOINT}/${fileRes.file.name}?key=${apiKey}`
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
      (t) => t.getHandlerFunction() === "dailyKnowledgeRefresh"
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
function getRelevantKBFiles(
  messages,
  kbList,
  userId = null,
  contextId = null,
  forceCurrentOnly = false
) {
  const MAX_PDF_COUNT = 2; // PDF 硬上限（不含 Tier 0）- 降低以加速回應
  const MAX_TIER1_COUNT = 2; // 精準匹配上限

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
      CACHE_KEYS.KEYWORD_MAP
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
      writeLog(
        `[KB Select] 從對話歷史提取型號: ${contextFromHistory.models.join(
          ", "
        )}`
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
              ", "
            )}`
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
  // ⚠️ 不包含 ODYSSEY HUB、3D 等術語 - 這些只用於觸發直通車，不用於 PDF 匹配
  const MODEL_REGEX =
    /\b(G\d{2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|S\d{2}[A-Z]{2}\d{3}[A-Z]{0,2}|[CF]\d{2}[A-Z]\d{3})\b/g;

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

        // 提取型號（包括 LS 型號和 M/G 系列型號代碼）
        const modelMatch = mappedValue.match(MODEL_REGEX);
        if (modelMatch) {
          exactModels = exactModels.concat(modelMatch);
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

  // 也從原始查詢提取型號
  const directModelMatch = combinedQuery.match(MODEL_REGEX);
  if (directModelMatch) {
    exactModels = exactModels.concat(directModelMatch);
  }

  // 從原始查詢提取 LS 系列
  const directLsMatch = combinedQuery.match(/LS(\d{2}[A-Z]{2}\d{3}[A-Z]{2})/g);
  if (directLsMatch) {
    directLsMatch.forEach((ls) => {
      const cleanModel = ls.replace(/^LS/, "S").replace(/XZW$/, "");
      exactModels.push(cleanModel);
    });
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
        `[KB Select] 當前訊息有型號，沿用已知型號: ${exactModels.join(", ")}`
      );
    } else if (forceCurrentOnly) {
      // forceCurrentOnly=true 且當前訊息無型號：清空歷史型號
      writeLog(
        `[KB Select] ⚠️ 當前訊息無型號且 forceCurrentOnly=true，清空歷史型號以避免不必要的 PDF 載入`
      );
      exactModels = [];
    } else {
      // forceCurrentOnly=false：保留歷史型號（用於漸進式解決流程）
      writeLog(
        `[KB Select] 當前訊息無型號但 forceCurrentOnly=false，保留歷史型號: ${exactModels.join(
          ", "
        )}`
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
      combinedQuery
    );

    if (isComparison && injectedModels.length > 1) {
      // 比較題：保留所有型號，但限制最多 2 個（預算控制）
      exactModels = injectedModels.slice(0, 2);
      writeLog(
        `[KB Select] 🔍 偵測到比較意圖，保留多型號: ${exactModels.join(
          ", "
        )} (限制前 2 款以控制預算)`
      );
    } else {
      // 一般問題：鎖定第一個型號，節省成本
      exactModels = [injectedModels[0]];
      writeLog(
        `[KB Select] 🔒 已鎖定直通車型號: ${exactModels[0]} (僅載入單一本 PDF)`
      );
    }
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
  exactModels = [...new Set([...exactModels, ...shortModels])]; // 合併並去重

  // 4. 分級載入（只用精準匹配，不做模糊匹配）
  const tier0 = []; // 必載 (QA + CLASS_RULES)
  const tier1 = []; // 精準匹配 (完整型號)

  kbList.forEach((file) => {
    // Tier 0: 必載
    if (file.isPriority) {
      tier0.push(file);
      return;
    }

    const fileName = file.name.toUpperCase();

    // Tier 1: 精準匹配 (完整型號如 G90XF, G80SD)
    const isTier1 = exactModels.some((model) => fileName.includes(model));
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
    const foundFiles = tier1.map((f) => f.name).join(", ");
    writeLog(
      `[KB Select] 🎯 命中型號: ${exactModels.join(
        ", "
      )} → 載入 PDF: ${foundFiles}`
    );
  } else {
    writeLog(
      `[KB Select] Tier0: ${tier0.length}, Tier1: 0 (No Match: ${
        exactModels.join(",") || "none"
      }), Total: ${result.length}`
    );
  }

  return result;
}

// v27.8.15: 新增 data-drive keyword detection, forceWebSearch 參數
// v27.9.51: Refactor Name (ChatGPT -> LLM)
function callLLMWithRetry(
  messages,
  imageBlob = null,
  attachPDFs = false,
  isRetry = false,
  userId = null,
  forceWebSearch = false
) {
  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) throw new Error("API Key Missing");

  let kbList = [];
  try {
    const json = PropertiesService.getScriptProperties().getProperty(
      CACHE_KEYS.KB_URI_LIST
    );
    if (json) {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) kbList = parsed;
    }
  } catch (e) {}

  const promptSheet = ss.getSheetByName(SHEET_NAMES.PROMPT);
  const configData = promptSheet.getRange("B3:C3").getValues()[0];
  let tempSetting = typeof configData[0] === "number" ? configData[0] : 0.6;
  const c3Prompt = configData[1] || "";

  // --- 決定掛載檔案 ---
  let filesToAttach = [];
  let dynamicContext = "";

  if (imageBlob) {
    // 圖片模式：仍使用舊邏輯 (或可優化)
    // 暫時維持原樣，但因為 samsung_kb_priority.txt 已不再生成，這裡需要注意
    // 圖片模式通常不需要太多文字 Context，或者我們也可以注入 Dynamic Context
    dynamicContext = buildDynamicContext(messages, userId);
  } else if (attachPDFs) {
    // PDF 模式：掛載 PDF + Dynamic Context
    // v24.3.1: 傳入 userId 以支援上下文提取
    filesToAttach = getRelevantKBFiles(messages, kbList, userId);
    dynamicContext = buildDynamicContext(messages, userId);
  } else {
    // 極速模式：只注入 Dynamic Context，不掛載任何檔案
    dynamicContext = buildDynamicContext(messages, userId);
  }

  writeLog(
    `[KB Load] AttachPDFs: ${attachPDFs}, isRetry: ${isRetry}, Files: ${filesToAttach.length} / ${kbList.length}`
  );

  // v24.0.0: 根據模式動態調整歷史長度，控制 Token 成本
  // - Fast Mode: 保留 10 對 (20 則)
  // - PDF Mode: 縮減至 6 對 (12 則)，節省約 800 Tokens 給 PDF
  let effectiveMessages = messages;
  if (attachPDFs && messages.length > CONFIG.PDF_HISTORY_LIMIT * 2) {
    // PDF 模式：只保留最近 6 對
    // v24.1.12 修復：若有摘要 (Summary)，必須保留摘要訊息，否則 AI 會失憶
    // 摘要通常在 index 0 (User) 和 1 (Assistant)
    const hasSummary =
      messages.length > 0 && messages[0].content.includes("【系統自動摘要】");

    if (hasSummary && messages.length > 2) {
      const summaryMsgs = messages.slice(0, 2); // 保留摘要對
      const recentMsgs = messages.slice(-(CONFIG.PDF_HISTORY_LIMIT * 2)); // 最近 6 對
      // 避免重複 (如果 recent 已經包含了 summary)
      if (recentMsgs[0] === summaryMsgs[0]) {
        effectiveMessages = recentMsgs;
      } else {
        effectiveMessages = [...summaryMsgs, ...recentMsgs];
      }
      writeLog(
        `[Token Control] PDF Mode: 保留摘要 + 最近歷史 (${effectiveMessages.length} 則)`
      );
    } else {
      effectiveMessages = messages.slice(-(CONFIG.PDF_HISTORY_LIMIT * 2));
      writeLog(
        `[Token Control] PDF Mode: 歷史縮減 ${messages.length} -> ${effectiveMessages.length}`
      );
    }
  }

  // --- 三段式邏輯注入 (v23.6.0 - Brainy, Warm & Disciplined) ---
  // v27.8.17: History Override (真相覆寫)
  // 明確告訴 AI：如果上下文 (Dynamic Context/Rules) 與歷史對話 (History) 衝突，以前者為準。
  // 這能解決「舊記憶曾瞎掰 M9 是 49 吋」導致 AI 一直錯下去的問題。
  let dynamicPrompt = `【Sheet C3 指令】\n${c3Prompt}\n`;
  dynamicPrompt += `\n【最高指導原則】\n1. 以下提供的【精選 QA & 規格】與【產品手冊】為唯一真理。\n2. 若過去的對話歷史 (History) 與目前的規格書衝突，請無視舊歷史，以目前的規格書為準。\n3. 切勿被舊對話中的錯誤資訊誤導。\n`;
  dynamicPrompt += `\n【語言絕對守則】\n1. **繁體中文 (台灣)**：所有回應必須使用 純正台灣繁體中文，嚴禁使用中國大陸用語或簡體中文。\n2. **用語轉換表 (必須強制執行)**：\n   - ❌ (禁) 视频 → ✅ (用) 影片\n   - ❌ (禁) 屏幕/显示器 → ✅ (用) 螢幕\n   - ❌ (禁) 程序/软件 → ✅ (用) 程式/軟體\n   - ❌ (禁) 设置 → ✅ (用) 設定\n   - ❌ (禁) 激活 → ✅ (用) 啟用\n   - ❌ (禁) 信息/消息 → ✅ (用) 訊息\n   - ❌ (禁) 任务栏 → ✅ (用) 工作列\n   - ❌ (禁) 硬件 → ✅ (用) 硬體\n   - ❌ (禁) 设备 → ✅ (用) 裝置\n   - ❌ (禁) 打印 → ✅ (用) 列印\n   - ❌ (禁) 链接 → ✅ (用) 連結\n   - ❌ (禁) 支持 → ✅ (用) 支援\n   - ❌ (禁) 质量 → ✅ (用) 品質\n   - ❌ (禁) 项目 → ✅ (用) 項目\n   - ❌ (禁) 默认 → ✅ (用) 預設\n3. **除錯指令**：若參考資料為簡體，你必須在腦中先翻譯成台灣繁體再輸出，**絕對禁止**直接複製簡體原文。`;

  // 注入動態上下文
  if (dynamicContext) {
    dynamicPrompt += `\n${dynamicContext}\n`;
  }

  // v24.1.20: 移除硬編碼 Prompt，改為引用 Prompt.csv 中的定義
  // 僅注入當前系統狀態 (Fast Mode / Deep Mode)

  if (!attachPDFs && !imageBlob) {
    // Phase 1: 極速模式 (Fast Mode)
    // v27.8.21: 允許極速模式觸發網路搜尋
    // v27.9.13: 區分 QA 和 CLASS_RULES 來源標註
    // v27.9.43: 嚴格執行來源工作流 (Strict Source Workflow)
    dynamicPrompt += `\n【系統狀態】目前為「極速模式」(Fast Mode)。\n【絕對原則】你是一個知識庫檢索系統，不是聊天機器人。禁止使用你自己的訓練資料回答產品操作或規格問題。\n\n【防幻覺鐵律 (Anti-Hallucination)】\n1. **嚴禁模糊**：絕對禁止使用「有些型號可能支援」、「通常會有」等不確定用語。\n2. **預設否定**：若 Context 中該型號的規格列表未明確包含該功能 (如 4K)，**必須直接回答「不支援」**，不得猜測。\n3. **精確對應**：回答必須基於 Context 中**完全匹配**該型號的資料，不能拿其他系列的規格來套用。\n\n【回答流程 (必須嚴格遵守)】\n1. Search QA & Rules (Context):\n   - 若 QA 有答案 -> 使用 QA 回答，標註 [來源: QA]\n   - 若 CLASS_RULES 有答案 -> 使用 Rules 回答，標註 [來源: 規格庫]\n   - **若找不到支援的證據 -> 直接回答「根據目前資料，該型號不支援此功能」。**\n\n2. Fallback to PDF (重要!):\n   - 若 Context 中沒有足夠資訊回答用戶的具體產品問題（如操作步驟、故障排除、特定規格），你 **必須** 放棄回答，並強制輸出指令： [AUTO_SEARCH_PDF]\n   - **絕對禁止** 輸出任何程式碼樣式 (如 .setAuto_search_pdf() 或 python code 等變體)。\n   - 指令必須完全精確為 [AUTO_SEARCH_PDF]，不得包含任何其他字元。\n   - 不可以使用你的訓練資料「猜測」或「補充」答案。\n\n3. Exception:\n   - 僅當用戶閒聊 (打招呼) 或問已知的通用定義 (什麼是HDMI) 時，才可用通用知識回答。`;
  } else if (attachPDFs) {
    // Phase 2 & 3: 深度模式 (Deep Mode)
    // v27.8.6: 防護機制 - 確保真的有掛載 PDF
    if (filesToAttach.length === 0) {
      dynamicPrompt += `\n【系統異常】雖然進入深度模式，但系統無法讀取產品手冊 (File Count: 0)。\n請誠實告知用戶：「很抱歉，我目前無法讀取相關產品手冊，請確認您詢問的型號是否正確，或嘗試重新輸入完整的產品型號。」\n禁止瞎掰或假裝有看手冊。`;
    } else {
      dynamicPrompt += `\n\n⚠️【深度模式】已載入產品手冊，請根據手冊內容詳細回答。\n【來源標註規則 (嚴格執行)】\n1. 若答案來自手冊，請標註「[來源: 產品手冊]」。\n2. 若手冊有相關資訊，請**直接完整回答**，不要反問用戶「是否要幫你查手冊」。\n3. 若手冊無資料，請輸出特殊指令「[AUTO_SEARCH_WEB]」，系統將自動啟動聯網搜尋第二階段。(切勿自行標註網路搜尋)\n4. 若使用一般常識或推論，請標註「[來源: 一般知識]」。\n5. 優先順序：手冊 > [AUTO_SEARCH_WEB] > 一般知識。`;
    }
  }

  // v27.8.16: Pass 2 (Force Web Search) Prompt Override
  // 如果是 Pass 2，代表 AI 已經在此刻擁有 Search Tool，prompt 必須改變
  if (forceWebSearch) {
    dynamicPrompt += `\n\n【網路與來源標註 (Pass 2)】\n系統已啟用 Google Search 工具。若手冊無資料，請直接使用 Search Tool 查詢，並在回答末尾標註「[來源: 網路搜尋]」。\n切勿再輸出 [AUTO_SEARCH_WEB]。`;
  }

  const geminiContents = [];
  if (imageBlob) {
    const imageBase64 = Utilities.base64Encode(imageBlob.getBytes());
    geminiContents.push({
      role: "user",
      parts: [
        { text: `【任務】分析圖片:\n${c3Prompt}` },
        {
          inline_data: {
            mime_type: imageBlob.getContentType(),
            data: imageBase64,
          },
        },
      ],
    });
  } else {
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
      parts.push({ text: msg.content });
      geminiContents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: parts,
      });
    });
    if (first) geminiContents.push({ role: "user", parts: [{ text: "你好" }] });
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
    tools = [{ google_search: {} }];
    writeLog(`[Search Tool] 🌐 啟用 Google 本地搜尋 (Pass 2)`);
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
      `[Token Fuse] ⚠️ 預估 Token 超過上限 (${totalTokens} > ${MAX_SAFE_TOKENS})，啟動熔斷機制`
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
      `[Token Fuse] 裁切後: ${effectiveMessages.length} 則訊息，預估 ${newTotal} Tokens`
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
    ],
    tools: tools,
  };

  const url = `${CONFIG.API_ENDPOINT}/${modelName}:generateContent?key=${apiKey}`;
  writeLog(
    `[API Call] Model: ${modelName}, PDF: ${attachPDFs}, Think: ${useThinkModel}, Retry: ${isRetry}`
  );

  // v27.2.5: PDF Debug Log
  // v27.9.0: 移除誤導性的「總內容長度」預估（無法反映 PDF 實際大小）
  //          實際 Token 用量將在 [Tokens] 日誌中顯示（API 呼叫後）
  if (attachPDFs) {
    writeLog(
      `[PDF Debug] 掛載 PDF 數量: ${filesToAttach.length}, 歷史: ${effectiveMessages.length} 則`
    );
  }

  const start = new Date().getTime();
  let lastLoadingTime = start; // 追蹤上次發送 Loading 的時間

  let retryCount = 0;
  let lastError = "";
  while (retryCount < 3) {
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

          const responseText = callOpenRouter(
            openRouterMessages,
            genConfig.temperature,
            undefined,
            useOnline
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
      writeLog(
        `[API End] ${
          (endTime - start) / 1000
        }s, Code: ${code}, Retry: ${retryCount}`
      );

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
              `[Tokens] In: ${usage.promptTokenCount}, Out: ${
                usage.candidatesTokenCount
              }, Total: ${usage.totalTokenCount} (約 NT$${costTWD.toFixed(
                4
              )} | 費率: ${
                modelName === CONFIG.MODEL_NAME_THINK ? "Think" : "Fast"
              })`
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
                json.promptFeedback
              ).substring(0, 500)}`
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
                `[PDF Mode ERROR] ⚠️ 異常短回應: In: ${usage.promptTokenCount}, Out: ${usage.candidatesTokenCount}, Content: "${responseText}"`
              );
              if (candidates[0].safetyRatings) {
                writeLog(
                  `[PDF Mode ERROR] Safety Ratings: ${JSON.stringify(
                    candidates[0].safetyRatings
                  ).substring(0, 500)}`
                );
              }
              writeLog(
                `[PDF Mode ERROR] 這通常表示 PDF 載入成功但 AI 無法生成完整回答，可能是 Gemini API 的安全阻擋或工具衝突`
              );
              return "⚠️ 讀取產品手冊時回覆異常，請再問一次或改述問題（PDF模式）";
            }
          }

          // v26.1.0: 完整 API 回傳紀錄，便於診斷空白回答問題
          if (candidates.length === 0) {
            writeLog(
              `[API Warning] 無候選回應: ${JSON.stringify(json).substring(
                0,
                500
              )}`
            );
          } else if (candidates[0].content && candidates[0].content.parts) {
            const firstPart = candidates[0].content.parts[0];
            if (!firstPart.text || firstPart.text.trim().length === 0) {
              writeLog(
                `[API Warning] 回應為空文本: parts=${JSON.stringify(
                  candidates[0].content.parts
                ).substring(0, 300)}`
              );
            }

            // v26.6.0: 記錄短回答（Out < 50 tokens）的實際內容
            if (usage && usage.candidatesTokenCount < 50) {
              const responseText = firstPart.text || "";
              writeLog(
                `[API Short Response] Out: ${
                  usage.candidatesTokenCount
                } tokens, Content: "${responseText.substring(0, 200)}"`
              );
            }
          }

          if (
            candidates.length > 0 &&
            candidates[0].content &&
            candidates[0].content.parts &&
            candidates[0].content.parts.length > 0
          ) {
            return (candidates[0].content.parts[0].text || "").trim();
          }
          return "";
        } catch (parseErr) {
          writeLog("[API Parse Error] " + parseErr.message);
          return "";
        }
      }

      // 特定錯誤處理
      if (code === 400) {
        if (
          text.includes("INVALID_ARGUMENT") ||
          text.includes("API_KEY_INVALID")
        ) {
          return "您的 API Key 無效，請檢查設定。";
        }
        if (text.includes("token")) {
          return "⚠️ 資料量過大，請提供關鍵字。";
        }
        writeLog(`[API 400] 參數錯誤: ${text.substring(0, 200)}`);
        lastError = "請求參數有誤";
        retryCount++;
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
  return `⚠️ 系統忙碌中 (${lastError})，請稍後再試`;
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
  isOnline = false
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
    `[OpenRouter Call] Model: ${payload.model}, Temp: ${temperature}, Online: ${isOnline}`
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
          }, Total: ${json.usage.total_tokens} (約 NT$${costTWD.toFixed(4)})`
        );
      }

      if (json.choices && json.choices.length > 0) {
        return json.choices[0].message.content || "";
      }
    } else {
      writeLog(
        `[OpenRouter Error] Code: ${code}, Body: ${text.substring(0, 300)}`
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
    ""
  );
  processed = processed.replace(/\[INTERNAL\].*?(?=\n\n|$)/gs, "");
  processed = processed.replace(/\[THINKING\].*?(?=\n\n|$)/gs, "");

  processed = processed.replace(/\*\*(.*?)\*\*/g, "$1");
  processed = processed.replace(/^\*\s+/gm, "• ");
  processed = processed.replace(/\*/g, "");
  processed = processed.replace(/(\d+)\.\s+/g, "$1.");
  processed = processed.replace(/->/g, "→");

  // 強制分段 (句尾換行)
  processed = processed.replace(/([。！？])\s*/g, "$1\n\n");
  // 列表前換行
  processed = processed.replace(/(\n|^)(\d+\.)/g, "\n\n$2");
  // 移除多餘換行
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

    // 若收到 "[object Object]" 這種髒資料，視為測試錯誤，強制替換
    if (userMessage === "[object Object]") {
      userMessage = "測試";
      writeLog(userId, "Warning", "偵測到 [object Object] 髒輸入，已自動修正");
    }

    // 空訊息直接跳過
    if (userMessage.length === 0) return;

    const contextId = userId; // 對話 ID 就是 userId
    const messageId = event.message.id || null;
    const msg = userMessage;

    // v24.3.0: 實時資訊快速回答（日期、時間）
    // 不需要問 AI，直接回答準確資訊
    // v24.3.0: 實時資訊快速回答（日期、時間）
    // v27.8.8: 修正觸發條件，避免 "浪費時間"、"時間不夠" 等日常用語誤觸
    // 只針對明確的問句 (幾點、幾號、現在時間)
    const timeQuery = msg.replace(/\s/g, ""); // 去空白
    // 嚴格匹配：必須包含 "現在"、"幾點"、"幾號"、"今天" 且長度短，或是 "現在幾點" 這樣的組合
    if (
      /^(現在幾點|幾點了|現在時間|今天幾號|今天是幾號|今天日期|星期幾)$/.test(
        timeQuery
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
          "RealTime"
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
          msg
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
    // 改用 20 秒，API 迴圈中會每 18 秒補發一次
    if (!hasRecentAnimation(userId)) {
      showLoadingAnimation(userId, 60);
      markAnimationShown(userId);
    }

    // v27.9.64: [Smart Editor Mode] 長文自動摘要與總編模式
    // 條件：長度 > 200 且 包含 Samsung 關鍵字 且 非指令
    // 目標：快速摘要長文資料，繞過標準 RAG 流程
    if (msg.length > 200 && !msg.startsWith("/")) {
      const isSamsung = isSamsungRelated(msg);
      if (isSamsung) {
        writeLog(
          `[SmartEditor] 偵測到長文 (${msg.length} 字)，且包含相關關鍵字，啟動總編模式`
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

          // 3. 加上強制註腳
          // [來源: 使用者提供長文] [費用: NT$...]
          const costStr = cost < 0.01 ? "0.01" : cost.toFixed(2); // 最低顯示 0.01
          const footer = `\n\n[來源: 使用者提供長文] [費用: NT$${costStr}]`;
          replyText += footer;

          // 4. 回傳 LINE
          replyMessage(replyToken, replyText);

          // 5. 寫入 Log & Record
          // 注意：不寫入 QA Cache，因為這是摘要
          writeRecordDirectly(
            userId,
            replyToken,
            contextId,
            msg,
            replyText,
            "SmartEditor"
          );
          writeLog(
            `[SmartEditor] 完成摘要，耗時 ${
              (new Date().getTime() - startTime) / 1000
            }s, Cost: ${costStr}`
          );

          return; // 結束，不走後面的 RAG
        } catch (e) {
          writeLog(`[SmartEditor] Error: ${e.message}`);
          // 若失敗，Fallthrough 到一般流程? 或者回報錯誤?
          // 為了保險，Fallthrough 到一般流程
        }
      } else {
        writeLog(`[SmartEditor] 長文但無三星關鍵字，忽略或進入一般流程`);
        // User 說「不回答」，但為了避免誤殺長問題，我們這裡選擇 Default:
        // 1. 若完全無關 -> 不回應 (to save token)?
        // 但 User 說 "然後門檻... 就可以"，這裡我們做個簡單的 Check
        // 若過濾掉，直接 Return?

        // User Requirement: "一律先判定是否為台灣三星產品相關(競品不回答)"
        // 這裡若 !isSamsung，則直接 return?
        // 風險：用戶問「請問哪裡買轉接頭」可能沒三星字眼。
        // 折衷：只攔截「超級長文(>500) 且 無關鍵字」？
        // User Set: >200. We stick to user rule.
        // If > 200 and NOT Samsung related => Ignore.
        if (msg.length > 200) {
          writeLog(
            "[SmartEditor] 長文 (>200) 但未偵測到三星產品關鍵字，視為無關內容或競品，不予處理。"
          );
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
        hitAliasKeys = directSearchResult.keys;
        writeLog(
          `[Direct Search] 命中直通車關鍵字: ${hitAliasKeys.join(
            ", "
          )}，先走 Fast Mode`
        );

        // 把關鍵字存到 Cache，供後續 [AUTO_SEARCH_PDF] 使用
        cache.put(`${userId}:hit_alias_key`, hitAliasKeys[0], 300); // 相容舊邏輯
        if (hitAliasKeys.length > 1) {
          cache.put(
            `${userId}:hit_alias_keys`,
            JSON.stringify(hitAliasKeys),
            300
          );
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
        `[Cache Parse Error] direct_search_models 轉換失敗: ${e.message}`
      );
    }

    const hasSelectedPdf = cachedDirectModels.length > 0; // 現在絕對安全

    try {
      // v24.5.0: 每題都先走 Fast Mode（不帶 PDF），讓 QA/CLASS_RULES 先嘗試回答
      // 這樣規格問題（如「M8 有附鏡頭嗎」）可以秒答，不用浪費 PDF Token
      let rawResponse = callLLMWithRetry(
        [...history, userMsgObj],
        null,
        false,
        false,
        userId
      );

      // === [KB_EXPIRED] 攔截：PDF 過期，靜默處理，用戶無感 ===
      if (rawResponse === "[KB_EXPIRED]") {
        writeLog("[KB Expired] PDF 過期，退出 PDF 模式，背景重建中");
        cache.remove(pdfModeKey); // 清除 PDF 模式

        // 自動預約 1 分鐘後背景重建
        scheduleImmediateRebuild();

        // 用極速模式重試（不帶 PDF），用戶完全無感
        rawResponse = callLLMWithRetry(
          [...history, userMsgObj],
          null,
          false,
          false,
          userId
        );
        // 不管成功失敗都不提示用戶「手冊更新中」，保持對話流暢
      }

      if (rawResponse) {
        let finalText = formatForLineMobile(rawResponse);
        let replyText = finalText;

        // v27.9.12: 追蹤 AI 是否明確要求 PDF 搜尋
        let aiRequestedPdfSearch = false;

        // === [AUTO_SEARCH_PDF] 或 [NEED_DOC] 攔截 ===
        // v27.9.48 fix: 增加對 hallucination (如 [.setAuto_search_pdf()]) 的容錯
        const pdfTriggerRegex =
          /\[(?:AUTO_SEARCH_PDF|\.?setAuto_search_pdf.*?)\]/i;
        if (
          pdfTriggerRegex.test(finalText) ||
          finalText.includes("[NEED_DOC]")
        ) {
          writeLog("[Auto Search] 偵測到搜尋暗號");
          aiRequestedPdfSearch = true; // v27.9.12: 標記 AI 要求 PDF 搜尋
          finalText = finalText
            .replace(new RegExp(pdfTriggerRegex, "gi"), "")
            .trim();
          finalText = finalText.replace(/\[NEED_DOC\]/g, "").trim();

          // v27.8.21: Fast Mode 觸發 [AUTO_SEARCH_WEB] 攔截
        } else if (finalText.includes("[AUTO_SEARCH_WEB]")) {
          writeLog("[Auto Web] Fast Mode 觸發 [AUTO_SEARCH_WEB] -> Pass 2");

          // v27.8.16 Cost Fix: 保存 Pass 1 費用以便累加
          const pass1Usage =
            typeof lastTokenUsage === "object"
              ? { ...lastTokenUsage }
              : { input: 0, output: 0, total: 0, costTWD: 0 };

          // 執行 Pass 2 (Force Web Search)
          const searchResponse = callLLMWithRetry(
            [...history, userMsgObj],
            null,
            false,
            false,
            userId,
            true
          );

          // 累加費用
          if (lastTokenUsage && pass1Usage.total > 0) {
            lastTokenUsage.input += pass1Usage.input;
            lastTokenUsage.output += pass1Usage.output;
            lastTokenUsage.total += pass1Usage.total;
            lastTokenUsage.costTWD += pass1Usage.costTWD;
            writeLog(
              `[Cost Accumulation] Total: NT$${lastTokenUsage.costTWD.toFixed(
                4
              )}`
            );
          }

          if (searchResponse && searchResponse !== "[KB_EXPIRED]") {
            finalText = formatForLineMobile(searchResponse);
            finalText = finalText.replace(/\[AUTO_SEARCH_WEB\]/g, "").trim();
            finalText += "\n\n(🔍 網路搜尋補充資料)";
          } else {
            finalText = finalText.replace(/\[AUTO_SEARCH_WEB\]/g, "").trim();
            finalText += "\n\n(⚠️ 網路搜尋連線逾時)";
          }
          replyText = finalText;

          // 跳過後續 PDF Logic
          writeLog("[Auto Web] 已完成搜尋，跳過 PDF Logic");
          // 這裡直接跳到底部
        }

        // 確保如果是 WEB Search 就不進入 PDF 判斷 (用簡單的方法: 檢查 replyText 是否已改變)
        // 或者將 PDF 邏輯包在 else 裡
        // 目前結構較平鋪直敘，我們用一個 flag 或結構調整

        if (
          !replyText.includes("(🔍 網路搜尋補充資料)") &&
          !replyText.includes("(⚠️ 網路搜尋連線逾時)")
        ) {
          // v24.5.4: 檢測是否為「不需要 PDF 的問題」
          // 包括：1) 硬體規格定義  2) 通識知識  3) 技術概念解釋
          // 這些問題 CLASS_RULES/QA 沒寫或 LLM 可用通用知識回答，不該查 PDF
          const nonPdfPatterns = [
            // 硬體規格問題
            /耳機孔|3\.5mm|音源孔|耳機插孔/i,
            /USB|HDMI|DP|DisplayPort|Type-C|連接埠|接口/i,
            /KVM|切換器/i,
            /喇叭|揚聲器|音響|音箱/i,
            /VESA|壁掛|架台/i,
            /解析度|Hz|更新率|刷新率|頻率/i,
            /尺寸|吋|英寸|大小/i,
            /曲面|平面|曲率|設計/i,
            /面板|panel|螢幕材質|VA|IPS|OLED|TN|LCD|LED/i,

            // 通識知識、技術概念（不是操作步驟）
            // v27.9.3: 移除「比較|差異|不同」攔截，允許比較題進入 PDF Mode
            /什麼是|什么是|定義|定义|優點|缺點/i,
            /HDR|色域|色溫|對比度|背光|LED背光|量子點/i,
            /Gsync|Freesync|垂直同步|V-Sync/i,
            /色準|色彩|Gamma|黑位/i,
            /PPI|密度|DPI/i,
          ];
          const isNonPdfQuestion = nonPdfPatterns.some((p) => p.test(msg));

          if (isNonPdfQuestion) {
            // 不需要 PDF 的問題：使用 CLASS_RULES 或 LLM 通用知識回答
            writeLog(
              "[Non-PDF Q] 通識/規格定義問題，不進 PDF，直接用極速模式答案"
            );
            // finalText 已經是極速模式的回答，直接用
            replyText = finalText;
          } else {
            // v24.5.0: 優先檢查是否有 PDF 記憶（已選過型號）
            // v27.2.9 修復：檢查型號是否衝突，避免 M8 記憶誤用到 M9 查詢
            const currentMsgModels = extractModelNumbers(msg);

            // 檢查是否提到了「不在」舊記憶裡的新型號（例如舊記憶是 M8，現在問 M9）
            const isModelMismatch =
              currentMsgModels.length > 0 &&
              currentMsgModels.some(
                (m) => !cachedDirectModels.some((old) => old === m)
              );

            if (hadPdfModeMemory && hasSelectedPdf && !isModelMismatch) {
              writeLog(
                `[Auto Search] 有 PDF 記憶且無型號衝突，直接使用已選的 PDF: ${cachedDirectModels}`
              );

              writeLog(
                "[Auto Deep] 觸發 [AUTO_SEARCH_PDF]，啟動 PDF Mode 重試"
              );
              isInPdfMode = true;
              cache.put(pdfModeKey, "true", 300);

              // v24.5.0: 顯示 Loading 動畫
              showLoadingAnimation(userId, 60);

              // v24.5.0: 顯示 Loading 動畫
              showLoadingAnimation(userId, 60);

              const deepResponse = callLLMWithRetry(
                [...history, userMsgObj],
                null,
                true,
                true,
                userId
              );

              if (deepResponse && deepResponse !== "[KB_EXPIRED]") {
                finalText = formatForLineMobile(deepResponse);
                finalText = finalText
                  .replace(/\[AUTO_SEARCH_PDF\]/g, "")
                  .trim();
                finalText = finalText.replace(/\[NEED_DOC\]/g, "").trim();

                // v27.8.15: Handle [AUTO_SEARCH_WEB] (Two-Pass Search)
                // AI 指示 PDF 沒資料，需要查網路 (Pass 1 -> Pass 2)
                if (deepResponse.includes("[AUTO_SEARCH_WEB]")) {
                  writeLog(
                    "[Auto Web] 觸發 [AUTO_SEARCH_WEB]，啟動 Pass 2 (Force Web Search)"
                  );

                  // v27.8.16 Cost Fix: 保存 Pass 1 費用以便累加
                  const pass1Usage =
                    typeof lastTokenUsage === "object"
                      ? { ...lastTokenUsage }
                      : { input: 0, output: 0, total: 0, costTWD: 0 };

                  // Pass 2: Force Web Search call
                  const searchResponse = callLLMWithRetry(
                    [...history, userMsgObj],
                    null,
                    true,
                    true,
                    userId,
                    true
                  );

                  // v27.8.16 Cost Fix: 累加費用 (Pass 1 + Pass 2)
                  if (lastTokenUsage && pass1Usage.total > 0) {
                    lastTokenUsage.input += pass1Usage.input;
                    lastTokenUsage.output += pass1Usage.output;
                    lastTokenUsage.total += pass1Usage.total;
                    lastTokenUsage.costTWD += pass1Usage.costTWD;
                    writeLog(
                      `[Cost Accumulation] Total: NT$${lastTokenUsage.costTWD.toFixed(
                        4
                      )} (Pass1: ${pass1Usage.costTWD.toFixed(4)} + Pass2)`
                    );
                  }

                  if (searchResponse && searchResponse !== "[KB_EXPIRED]") {
                    finalText = formatForLineMobile(searchResponse);
                    finalText = finalText
                      .replace(/\[AUTO_SEARCH_WEB\]/g, "")
                      .trim(); // Remove tag
                    writeLog("[Auto Web] Pass 2 搜尋完成");
                    finalText += "\n\n(🔍 網路搜尋補充資料)";
                  } else {
                    finalText = deepResponse
                      .replace(/\[AUTO_SEARCH_WEB\]/g, "")
                      .trim();
                    finalText += "\n\n(⚠️ 網路搜尋連線逾時，僅顯示初步回答)";
                  }
                }
              } else {
                finalText += "\n\n(⚠️ 自動查閱手冊失敗，請稍後再試)";
              }
              replyText = finalText;
            } else {
              // v27.2.9: 如果有型號衝突，記錄並清除舊記憶
              if (isModelMismatch) {
                writeLog(
                  `[Auto Search] ⚠️ 偵測到型號衝突: 當前問題提到 ${currentMsgModels.join(
                    ","
                  )}，舊記憶是 ${cachedDirectModels.join(
                    ","
                  )}，將重新進行 PDF 匹配`
                );
                cache.remove(pdfModeKey);
                // v27.3.2: 關鍵修正 - 同時清除舊直通車關鍵字與型號，避免 M8 記憶污染 M9 查詢
                cache.remove(`${userId}:hit_alias_key`);
                cache.remove(`${userId}:direct_search_models`);
              }

              // v24.4.1: 非硬體問題，需要查 PDF
              // 先檢查是否有命中直通車關鍵字（可用於 PDF 智慧匹配）
              const cachedAliasKey = cache.get(`${userId}:hit_alias_key`);

              // v27.9.4: 修正多型號攔截邏輯
              // 只有當 AI 明確要求查 PDF ([AUTO_SEARCH_PDF]) 且有多個型號時才攔截
              // 比較題（用 CLASS_RULES 回答）應該正常顯示 AI 的回答
              const cachedAliasKeysJson = cache.get(`${userId}:hit_alias_keys`);
              if (
                cachedAliasKeysJson &&
                finalText.includes("[AUTO_SEARCH_PDF]")
              ) {
                try {
                  const multipleKeys = JSON.parse(cachedAliasKeysJson);
                  if (multipleKeys.length > 1) {
                    // 有多個型號要查 PDF → 先顯示 Fast Mode 回答，再提示用戶
                    writeLog(
                      `[PDF Match] ⚠️ 偵測到多個型號需要查 PDF: ${multipleKeys.join(
                        ", "
                      )}，顯示 Fast Mode 回答並提示`
                    );

                    // 移除 [AUTO_SEARCH_PDF] 標記
                    finalText = finalText
                      .replace(/\[AUTO_SEARCH_PDF\]/g, "")
                      .trim();

                    // 如果 Fast Mode 有回答，就顯示；否則提示用戶選擇型號
                    if (finalText.length > 20) {
                      // 有實質回答，顯示並附加提示
                      finalText += `\n\n💡 若需要查詢詳細手冊，請分別詢問各型號喔！`;
                      replyText = finalText;
                    } else {
                      // 沒有實質回答，提示用戶選擇型號
                      const oneAtATimeMsg =
                        `目前一次只能查詢一款型號的產品手冊喔！😊\n\n` +
                        `你問的型號有：${multipleKeys.join("、")}\n\n` +
                        `請選擇其中一款，例如：\n` +
                        `「${multipleKeys[0]} 怎麼設定」`;
                      replyMessage(replyToken, oneAtATimeMsg);
                      writeRecordDirectly(userId, msg, contextId, "user", "");
                      writeRecordDirectly(
                        userId,
                        oneAtATimeMsg,
                        contextId,
                        "assistant",
                        ""
                      );
                      cache.remove(`${userId}:hit_alias_keys`);
                      return;
                    }
                    // 清除多型號記錄
                    cache.remove(`${userId}:hit_alias_keys`);
                  }
                } catch (e) {
                  writeLog(
                    `[PDF Match] 解析 hit_alias_keys 失敗: ${e.message}`
                  );
                }
              }

              // v27.9.43: Reverted manual trigger fix in favor of strict prompt engineering
              // if (cachedAliasKey && !aiRequestedPdfSearch && !isSimpleQuestion) { ... }

              // v27.9.12: 只有當 AI 明確要求 PDF 搜尋([AUTO_SEARCH_PDF])時，才進行 PDF 智慧匹配
              // 規格問題（如「M5有支援Smart嗎」）即使命中直通車，也不應觸發 PDF 匹配
              if (cachedAliasKey && aiRequestedPdfSearch) {
                // v27.9.65: 切換至 PDF 模式，屬於耗時操作，再次觸發 Loading 動畫以防過期
                showLoadingAnimation(userId, 60);

                // 有直通車關鍵字 + AI 要求 PDF → 使用 PDF 智慧匹配
                writeLog(
                  `[Auto Search] AI 要求 PDF 搜尋，使用直通車關鍵字進行 PDF 智慧匹配: ${cachedAliasKey}`
                );

                const pdfSearchResult = searchPdfByAliasPattern(cachedAliasKey);

                if (
                  pdfSearchResult.needAsk &&
                  pdfSearchResult.matchedPdfs.length > 1
                ) {
                  // 多個 PDF 匹配 → 反問用戶選擇
                  writeLog(
                    `[PDF Match] 找到 ${pdfSearchResult.matchedPdfs.length} 個匹配，需要反問用戶`
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
                    300
                  );

                  // v24.4.4: 直接發送反問訊息，不附加 Fast Mode 的錯誤回答
                  // （既然 AI 說需要查 PDF，Fast Mode 的回答就是不準確的）
                  const askMsg = buildPdfSelectionMessage(
                    pdfSearchResult.aliasName,
                    pdfSearchResult.matchedPdfs.slice(0, 9)
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
                    ""
                  );

                  // v24.5.2: 更新對話歷史（關鍵修復！）
                  const askMsgObj = { role: "assistant", content: askMsg };
                  updateHistorySheetAndCache(
                    contextId,
                    history,
                    userMsgObj,
                    askMsgObj
                  );

                  return; // 等待用戶回覆
                } else if (pdfSearchResult.matchedPdfs.length === 1) {
                  // 只有一個 PDF → 直接使用
                  writeLog(
                    `[PDF Match] 只有一個匹配: ${pdfSearchResult.matchedPdfs[0].name}，直接開啟 PDF Mode`
                  );
                  cache.put(
                    `${userId}:direct_search_models`,
                    JSON.stringify([
                      pdfSearchResult.matchedPdfs[0].matchedModel,
                    ]),
                    300
                  );

                  // 設定 PDF 模式並重試
                  isInPdfMode = true;
                  cache.put(pdfModeKey, "true", 300);

                  // 設定 PDF 模式並重試
                  isInPdfMode = true;
                  cache.put(pdfModeKey, "true", 300);

                  const deepResponse = callLLMWithRetry(
                    [...history, userMsgObj],
                    null,
                    true,
                    true,
                    userId
                  );

                  if (deepResponse && deepResponse !== "[KB_EXPIRED]") {
                    finalText = formatForLineMobile(deepResponse);
                    finalText = finalText
                      .replace(/\[AUTO_SEARCH_PDF\]/g, "")
                      .trim();
                    finalText = finalText.replace(/\[NEED_DOC\]/g, "").trim();
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
                writeLog(
                  "[Auto Search] AI 要求 PDF 搜尋，無直通車關鍵字，使用傳統 PDF 匹配"
                );

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
                          "GEMINI_API_KEY"
                        );
                      if (!apiKey) {
                        throw new Error("API Key not configured");
                      }

                      const topicCheckPrompt = `上一輪對話：「${lastAssistantMsg.content.substring(
                        0,
                        200
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
                        }
                      );

                      const topicResult = JSON.parse(
                        topicCheckResponse.getContentText()
                      );
                      const topicDecision =
                        topicResult.candidates?.[0]?.content?.parts?.[0]?.text
                          ?.trim()
                          .toUpperCase() || "NEW";
                      useHistory = topicDecision.includes("SAME");

                      writeLog(
                        `[Topic Check] LLM 判斷: ${topicDecision} -> useHistory=${useHistory}`
                      );
                    }
                  } catch (e) {
                    // 如果 LLM 判斷失敗，fallback 到關鍵字匹配
                    writeLog(
                      `[Topic Check] LLM 判斷失敗，使用關鍵字 fallback: ${e.message}`
                    );
                    const unresolvedSignals =
                      /不行|沒用|可是|但是|問題|仍然|依舊|還是|沒辦法|失效|異常|卡頓/i;
                    useHistory = unresolvedSignals.test(msg);
                  }
                }

                if (useHistory) {
                  writeLog(
                    "[Auto Search] 偵測到「同一話題」，使用對話歷史匹配 PDF"
                  );
                } else {
                  writeLog(
                    "[Auto Search] 偵測到「新話題」或無歷史，強制只用當前訊息避免歷史污染"
                  );
                }

                // 預測會用到哪些 PDF
                const kbList = JSON.parse(
                  PropertiesService.getScriptProperties().getProperty(
                    CACHE_KEYS.KB_URI_LIST
                  ) || "[]"
                );
                const relevantFiles = getRelevantKBFiles(
                  useHistory ? [...history, userMsgObj] : [userMsgObj],
                  kbList,
                  userId,
                  contextId,
                  !useHistory
                );
                const pdfNames = relevantFiles
                  .filter((f) => f.mimeType === "application/pdf")
                  .map((f) => f.name.replace(".pdf", ""));
                const productNames = pdfNames
                  .map((name) => getPdfProductName(name))
                  .slice(0, 3);

                if (productNames.length > 0) {
                  writeLog(
                    `[Auto Deep] 找到相關手冊: ${productNames.join(
                      "、"
                    )}，開始重試...`
                  );

                  isInPdfMode = true;
                  cache.put(pdfModeKey, "true", 300);

                  isInPdfMode = true;
                  cache.put(pdfModeKey, "true", 300);

                  const deepResponse = callLLMWithRetry(
                    [...history, userMsgObj],
                    null,
                    true,
                    true,
                    userId
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
                        "根據產品手冊"
                      );
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
                      `REVERSE_LOOKUP_MODEL:${userId}`
                    );
                    if (cachedReverseModel) {
                      // v27.9.65: 觸發 Rescue Mode，再次顯示 Loading 動畫
                      showLoadingAnimation(userId, 60);

                      writeLog(
                        `[Auto Search] 找不到 PDF，嘗試使用反查型號救援: ${cachedReverseModel}`
                      );
                      // 注入直通車 Cache，讓 getRelevantKBFiles 能讀到
                      cache.put(
                        `${userId}:direct_search_models`,
                        JSON.stringify([cachedReverseModel]),
                        300
                      );

                      // 重試搜尋 (強制使用當前訊息+Cache，或直接依賴Cache)
                      const rescueFiles = getRelevantKBFiles(
                        [userMsgObj],
                        kbList,
                        userId,
                        contextId,
                        true
                      );
                      const rescuePdfNames = rescueFiles
                        .filter((f) => f.mimeType === "application/pdf")
                        .map((f) => f.name.replace(".pdf", ""));
                      const rescueProductNames = rescuePdfNames
                        .map((name) => getPdfProductName(name))
                        .slice(0, 3);

                      if (rescueProductNames.length > 0) {
                        writeLog(
                          `[Auto Search] 救援成功! 找到: ${rescueProductNames.join(
                            "、"
                          )}，開始重試...`
                        );
                        rescueSuccess = true;

                        isInPdfMode = true;
                        cache.put(pdfModeKey, "true", 300);

                        const deepResponse = callLLMWithRetry(
                          [...history, userMsgObj],
                          null,
                          true,
                          true,
                          userId
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
                              "根據產品手冊"
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
                      "[Auto Search] 找不到相關 PDF，使用 Fast Mode 答案"
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
          const shouldExit = exitPatterns.some((p) => p.test(finalText));
          if (shouldExit) {
            writeLog("[PDF Mode] 回答不需 PDF (或查無資料)，自動退出");
            cache.remove(pdfModeKey);
          }
          replyText = finalText;
        }

        // v27.0.0: 修復費用顯示邏輯（確保費用正確對應當前查詢）
        if (DEBUG_SHOW_TOKENS && lastTokenUsage && lastTokenUsage.costTWD) {
          const tokenInfo = `\n\n---\n本次對話預估花費：\nNT$${lastTokenUsage.costTWD.toFixed(
            4
          )}\n(In:${lastTokenUsage.input}/Out:${lastTokenUsage.output}=${
            lastTokenUsage.total
          })`;
          replyText += tokenInfo;

          // v27.9.14: QA 庫滿警告 - 動態閾值：一般 20k，網路搜尋 40k
          // v27.9.32: 動態閾值 - 網路搜尋階段允許更高 Token 使用量
          const isWebSearchPhase =
            replyText.includes("🔍 網路搜尋補充資料") ||
            replyText.includes("[來源: 網路搜尋]");
          const tokenThreshold = isWebSearchPhase ? 40000 : 20000;

          if (lastTokenUsage.input > tokenThreshold) {
            replyText += `\n\n⚠️ 知識庫超載警告：輸入 Token 已達 ${lastTokenUsage.input}，請聯繫 Sam 優化 QA/CLASS_RULES 資料量。`;
            writeLog(
              `[Token Warning] Input tokens (${lastTokenUsage.input}) exceeded ${tokenThreshold} threshold`
            );
          }
        }

        replyMessage(replyToken, replyText);
        // v25.0.2 修復：補上缺失的 user 訊息記錄
        writeRecordDirectly(userId, msg, contextId, "user", "");
        writeRecordDirectly(userId, replyText, contextId, "assistant", "");
        // v24.1.24: 修正 Log 截斷問題，確保完整記錄 AI 回答
        // v27.7.6: Log 回覆時包含費用資訊，方便 testMessage 顯示成本
        var replyForLog = replyText || finalText;
        writeLog(
          `[AI Reply] ${replyForLog.substring(0, 2000)}${
            replyForLog.length > 2000 ? "..." : ""
          }`
        );

        updateHistorySheetAndCache(contextId, history, userMsgObj, {
          role: "assistant",
          content: finalText,
        });

        // 2025-12-05 v23.6.5: 背景異步整理 (Async Background Summary)
        // v27.8.25: Async Summary temporarily disabled for syntax debugging
        // try { ... } catch (e) { ... }
      }
    } catch (apiErr) {
      replyMessage(replyToken, `系統錯誤：${apiErr.message}`);
      writeLog(`[Handle API Error] ${apiErr.message}`);
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
    "[Deprecated] handleDeepSearch 被呼叫，但此功能已廢棄 (改為 Auto Deep Search)"
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
      { headers: { Authorization: "Bearer " + token } }
    ).getBlob();

    const analysis = callLLMWithRetry(null, blob, false, false, userId);
    const final = formatForLineMobile(analysis);
    replyMessage(replyToken, final);

    // writeRecordDirectly(userId, final, contextId, 'assistant', '');

    const history = getHistoryFromCacheOrSheet(contextId);
    updateHistorySheetAndCache(
      contextId,
      history,
      { role: "user", content: "[使用者傳送了一張圖片]" },
      { role: "assistant", content: `(針對圖片的分析結果) ${final}` }
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
    cache.remove(`anim_${u}`);
    // v27.2.2: 修復 forceRebuild = true 導致的不必要的完全重建
    // /重啟 只應清除用戶的對話記憶，不應清空知識庫檔案紀錄
    // 知識庫維護交由自動排程（每日 04:00）和錯誤自動修復機制
    const resultMsg = syncGeminiKnowledgeBase(false);
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
    const inputContent = cmd
      .replace(/^\/紀錄\s*/i, "")
      .replace(/^\/記錄\s*/i, "")
      .trim();

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
    writeLog(
      userId,
      "UserRecord",
      `[NewDraft] 開始建檔: ${content.substring(0, 150)}`
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
      `[NewDraft] 初版 QA: ${polishedText.substring(0, 150)}`
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
        `[NewDraft] 找到相似 QA: 行 ${similarResult.matchedRows.join(",")}`
      );

      // Step 3: LLM 合併產出合併版
      const mergedQA = callGeminiToMergeQA(
        similarResult.matchedQAs,
        polishedText
      );
      writeLog(
        userId,
        "UserRecord",
        `[NewDraft] 合併版 QA: ${mergedQA.substring(0, 150)}`
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
        CONFIG.DRAFT_TTL_SEC
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
          4
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
      CONFIG.DRAFT_TTL_SEC
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
        4
      )} (In:${totalInputTokens}/Out:${totalOutputTokens})`;
    }

    writeLog(
      userId,
      "UserRecord",
      `[NewDraft Reply] ${(alertMsg + preview).substring(0, 100)}...`
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
          CONFIG.DRAFT_TTL_SEC
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
          CONFIG.DRAFT_TTL_SEC
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
          CONFIG.DRAFT_TTL_SEC
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
          "請輸入 1, 2 或 3 選擇：\n1️⃣ 採用合併版（刪除舊的）\n2️⃣ 另開新條（保留舊的）\n3️⃣ 取代舊 QA（刪除舊的，用新的）"
        );
        writeLog(`[DraftMod Reply] 提醒用戶選擇 1/2`);
        return;
      }
    }

    // 正常修改模式
    writeLog(
      `[DraftMod] 原始內容: ${(currentDraft.originalContent || "").substring(
        0,
        500
      )}`
    );
    writeLog(
      `[DraftMod] 目前 QA: ${(currentDraft.currentQA || "").substring(0, 500)}`
    );

    // 累積對話歷史
    var conversation = currentDraft.conversation || [];
    conversation.push(feedback);

    // 帶完整上下文讓 LLM 重新產出 QA
    var newQA = callGeminiToRefineQA(
      currentDraft.originalContent,
      currentDraft.currentQA,
      conversation
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
      CONFIG.DRAFT_TTL_SEC
    );

    var preview =
      "🔄 已修正草稿：\n\n【預覽】將寫入 QA：\n" +
      newQA +
      "\n\n👉 確認存檔 → /紀錄\n👉 繼續修改 → 直接回覆\n👉 放棄 → /取消";

    // v27.9.17: 附加費用資訊
    if (lastTokenUsage && lastTokenUsage.costTWD) {
      preview += `\n\n---\n本次修改預估花費：NT$${lastTokenUsage.costTWD.toFixed(
        4
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
      }
    );

    var code = res.getResponseCode();
    var body = res.getContentText();
    writeLog(
      "[FindSimilar API] Code: " + code + ", Body: " + body.substring(0, 300)
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
          costTWD.toFixed(4)
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
      }
    );

    var code = res.getResponseCode();
    var body = res.getContentText();
    writeLog(
      "[MergeQA API] Code: " + code + ", Body: " + body.substring(0, 500)
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
        }, Total: ${usage.totalTokenCount} (約 NT$${costTWD.toFixed(4)})`
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
      }
    );

    const code = res.getResponseCode();
    const body = res.getContentText();
    writeLog(`[RefineQA API] Code: ${code}, Body: ${body.substring(0, 500)}`);

    if (code !== 200) {
      writeLog(`[RefineQA API Error] Code: ${code}`);
      // 降級：簡單合併
      return simpleModifyFallback(
        currentQA,
        conversation[conversation.length - 1]
      );
    }

    let json;
    try {
      json = JSON.parse(body);
    } catch (parseErr) {
      writeLog(`[RefineQA Parse Error] ${parseErr.message}`);
      return simpleModifyFallback(
        currentQA,
        conversation[conversation.length - 1]
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
        }, Total: ${usage.totalTokenCount} (約 NT$${costTWD.toFixed(4)})`
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
      `[RefineQA] finishReason: ${finishReason}, candidates: ${candidates.length}`
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
        conversation[conversation.length - 1]
      );
    }

    return rawText.trim().replace(/[\r\n]+/g, " ");
  } catch (e) {
    writeLog(`[RefineQA Error] ${e.message}`);
    return simpleModifyFallback(
      currentQA,
      conversation[conversation.length - 1]
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
      }
    );

    // v27.9.45: 模型回滾機制 (Model Fallback Strategy)
    // 若 Preview 模型失效 (404 Not Found 或 400 Bad Request)，自動切換至穩定的 Fast Mode
    // ⛔️ 禁止使用 Push Message! 改為在結果中附加警告訊息
    var warningMsg = "";

    if (res.getResponseCode() === 404 || res.getResponseCode() === 400) {
      const errBody = res.getContentText();
      writeLog(
        `[Polish Warning] ${GEMINI_MODEL_POLISH} 失效 (${res.getResponseCode()})，嘗試回滾... Err: ${errBody}`
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
        }
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
          4
        )} | Gemini 3 Flash)`
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
      `[Polish] finishReason: ${finishReason}, candidates: ${candidates.length}`
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
        `[Polish] AI 回傳為空，Body 前 300 字: ${body.substring(0, 300)}`
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
          `[Modify OpenRouter Fail] ${orErr.message}, Fallback to Gemini`
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
      }
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
        }, Total: ${usage.totalTokenCount} (約 NT$${costTWD.toFixed(4)})`
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
      `[Modify] finishReason: ${finishReason}, candidates: ${candidates.length}`
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
        `[Modify] AI 回傳為空，Body 前 300 字: ${body.substring(0, 300)}`
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
      ins.substring(0, 50)
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
      CACHE_KEYS.ENTRY_DRAFT_PREFIX + draft.userId
    );
    syncGeminiKnowledgeBase();

    writeLog(
      draft.userId || "UNKNOWN",
      "UserRecord",
      `[Draft Saved to QA] ${qaText.substring(0, 50)}...`
    );
    return `✅ 已寫入 QA 並更新知識庫！\n\n寫入內容：${qaText}`;
  } catch (e) {
    writeLog(
      draft.userId || "UNKNOWN",
      "Error",
      `[SaveDraft Error] ${e.message}`
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
      }
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
            }, Total: ${usage.totalTokenCount} (約 NT$${costTWD.toFixed(4)})`
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
        ", "
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
    "HH:mm:ss.SSS"
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

    // 合併最近 10 條訊息的內容
    const recentMsgs = history
      .slice(-10)
      .map((m) => m.content || "")
      .join(" ");

    // 提取型號
    const MODEL_REGEX =
      /\b([SG]\d{2}[A-Z]{2}\d{3}[A-Z]{0,2}|M\d{1,2}[A-Z]?|G\d{2}[A-Z]{0,2})\b/g;
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

function getHistoryFromCacheOrSheet(cid) {
  const c = CacheService.getScriptCache();
  const k = `${CACHE_KEYS.HISTORY_PREFIX}${cid}`;
  const v = c.get(k);
  if (v) {
    try {
      return JSON.parse(v);
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
      return JSON.parse(s.getRange(f.getRow(), 2).getValue());
    }
  } catch (e) {}
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
      writeLog(
        `[History] 超長對話 (${newHist.length} > ${SUMMARY_THRESHOLD})，啟動摘要...`
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
      CONFIG.CACHE_TTL_SEC
    );

    // 2025-12-05: 恢復 Sheet 寫入 (長期記憶備份)
    // 自動檢查並建立 Sheet，防止因刪除導致失效
    try {
      let s = ss.getSheetByName(SHEET_NAMES.LAST_CONVERSATION);
      if (!s) {
        s = ss.insertSheet(SHEET_NAMES.LAST_CONVERSATION);
        s.appendRow(["ContextID", "HistoryJSON", "LastUpdated"]); // 補標題
        writeLog(
          `[AutoCreate] 已自動重建 ${SHEET_NAMES.LAST_CONVERSATION} 工作表`
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
          `[Modify OpenRouter Fail] ${orErr.message}, Fallback to Gemini`
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
      }
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
        writeLog(`[ClearHistory] 已從 Sheet 清除 ${cid} 的歷史記錄`);
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

    writeLog(
      `[ClearHistory] ✅ 完全清除了 ${cid} 的對話記憶 (Sheet + Cache + PDF Mode)`
    );
  } catch (e) {
    writeLog(`[ClearHistory Error] ${e.message}`);
  }
}

// ========== 7. LINE Webhook 入口 ==========
// 注意：doGet 已移至區塊 9 (TEST UI) 並合併健康檢查功能

function doPost(e) {
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
                    ""
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
                contextId
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
      JSON.stringify({ status: "ok" })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error" })
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
          /\b(G\d{2}[A-Z]{0,2}|M\d{1,2}[A-Z]?|S\d{2}[A-Z]{2}\d{3}[A-Z]{0,2}|[CF]\d{2}[A-Z]\d{3})\b/g
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

function replyMessage(tk, txt) {
  // 🧪 TEST MODE: 不呼叫 LINE API (清除測試介面時請移除此判斷)
  if (IS_TEST_MODE || tk === "TEST_REPLY_TOKEN") {
    writeLog("[TEST MODE] 跳過 LINE API 呼叫");
    return;
  }

  try {
    const lineToken =
      PropertiesService.getScriptProperties().getProperty("LINE_TOKEN");
    writeLog(
      `[Reply Debug] LINE_TOKEN 前10字: ${
        lineToken ? lineToken.substring(0, 10) : "NULL"
      }`
    );

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
          // v27.9.61: 強制將 [來源] 與 [費用] 資訊拼接在訊息末尾，確保使用者可見
          // 注意：這裡假設 txt 已經包含了基本的 AI 回覆，若 txt 過長可能導致截斷，需注意 4000 字限制
          messages: [{ type: "text", text: txt.substring(0, 4000) }],
        }),
        muteHttpExceptions: true,
      }
    );

    const code = response.getResponseCode();
    if (code === 200) {
      writeLog(`[Reply] ✅ LINE 回覆成功 (${txt.substring(0, 50)}...)`);
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
    UrlFetchApp.fetch("https://api.line.me/v2/bot/chat/loading/start", {
      method: "post",
      headers: {
        Authorization:
          "Bearer " +
          PropertiesService.getScriptProperties().getProperty("LINE_TOKEN"),
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({ chatId: uid, loadingSeconds: sec }),
      muteHttpExceptions: true,
    });
  } catch (e) {}
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
  CacheService.getScriptCache().put(`anim_${id}`, "1", 20);
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
        "width=device-width, initial-scale=1, user-scalable=no"
      );
  }

  // 預設：返回健康檢查（給 LINE Verify 用）
  return ContentService.createTextOutput("OK - Trigger verified").setMimeType(
    ContentService.MimeType.TEXT
  );
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
        log.indexOf("[Reply]") > -1 ? "[Reply]" : "[AI Reply]"
      );
      if (content && !seenContent.has(content)) {
        botResponses.push(content);
        seenContent.add(content);
        hasOfficialReply = true;
      }
    }
  }

  // 1.5️⃣ 檢查是否有 PDF 選擇日誌（表示 handlePdfSelectionReply 已執行）
  if (!hasOfficialReply) {
    var hasPdfSelectLog = TEST_LOGS.some(
      (l) =>
        l.indexOf("[PDF Select] 用戶選擇") > -1 ||
        l.indexOf("[PDF Select] 用戶輸入完整型號") > -1
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
      (l) => l.indexOf("已發送型號選擇反問") > -1
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
              pending.options
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
 * [Smart Editor Mode] 檢查是否與三星產品相關 (動態版)
 * v27.9.64: 改為檢查 Cache 中的關鍵字或 CLASS_RULES，避免 Hardcode
 */
function isSamsungRelated(msg) {
  const upper = msg.toUpperCase();
  const cache = CacheService.getScriptCache();

  // 1. 嘗試從 Cache 取得關鍵字列表 (這是 syncGeminiKnowledgeBase 建立的)
  // 若沒有，則回退到基本關鍵字 (防止完全無 Cache 時失效)
  const basicKeywords = [
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
  ];

  try {
    const ruleSheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    // 簡單優化：若已經命中任何一個 Cache 中的 Rule Key，則 True
    if (upper.includes("SAMSUNG") || upper.includes("三星")) return true;

    // 否則，檢查是否包含 CLASS_RULES 中的「系列」名稱 (通常在第1欄)
    // 我們讀取 Sheet 的第一欄 (A欄)，取前 200 行
    // 為了不每次讀，應該 Cache 這份清單
    let productKeywords = cache.get("CORE_PRODUCT_KEYWORDS");
    if (!productKeywords) {
      if (ruleSheet) {
        const data = ruleSheet.getRange("A2:A200").getValues();
        // 解析：如果含有 "_" 取後面 (如 系列_Odyssey -> Odyssey)，否則取原字
        const keys = data
          .map((r) => {
            const txt = r[0].toString();
            if (!txt) return "";
            if (txt.includes("_")) return txt.split("_")[1];
            return txt;
          })
          .filter((k) => k && k.length > 1); // 過濾掉空值和單字
        productKeywords = JSON.stringify(keys);
        cache.put("CORE_PRODUCT_KEYWORDS", productKeywords, 21600); // 6小時
      } else {
        productKeywords = JSON.stringify(basicKeywords);
      }
    }

    const keywords = JSON.parse(productKeywords);
    // 檢查是否包含任何一個關鍵字
    return keywords.some((key) => upper.includes(key.toUpperCase()));
  } catch (e) {
    writeLog("[isSamsungRelated] Error: " + e.message);
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
