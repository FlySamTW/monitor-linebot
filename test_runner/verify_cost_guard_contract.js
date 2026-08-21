const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const linebot = fs.readFileSync(path.join(root, "linebot.gs"), "utf8");
const qaKnowledge = fs.readFileSync(path.join(root, "qa_knowledge.gs"), "utf8");
const qaCsv = fs.readFileSync(path.join(root, "QA.csv"), "utf8");
const testUi = fs.readFileSync(path.join(root, "TestUI.html"), "utf8");
const paidRunner = fs.readFileSync(
  path.join(__dirname, "verify_10_questions_5_rounds.js"),
  "utf8",
);

const baseline = {
  generatedCalls: 190,
  inputTokens: 6519548,
  outputTokens: 25460,
  historicalInputUsdPerMillion: 0.1,
  historicalOutputUsdPerMillion: 0.4,
  exchangeRate: 32,
};

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

const historicalCostTwd =
  ((baseline.inputTokens / 1e6) * baseline.historicalInputUsdPerMillion +
    (baseline.outputTokens / 1e6) * baseline.historicalOutputUsdPerMillion) *
  baseline.exchangeRate;
const currentCostTwd = historicalCostTwd;

assert(baseline.generatedCalls === 190, "7/7 保存紀錄基線為 190 次生成");
assert(baseline.inputTokens === 6519548, "7/7 基線 input tokens 為 6,519,548");
assert(baseline.outputTokens === 25460, "7/7 基線 output tokens 為 25,460");
assert(
  Math.abs(historicalCostTwd - 21.1884416) < 1e-9,
  "舊費率對應歷史估算 NT$21.1884，不重寫基線",
);
assert(
  Math.abs(currentCostTwd - 21.1884416) < 1e-9,
  "2026-08-05 Standard 官方費率仍對應 NT$21.1884",
);

assert(
  /PRICE_FAST_INPUT\s*=\s*0\.1/.test(linebot) &&
    /PRICE_FAST_OUTPUT\s*=\s*0\.4/.test(linebot),
  "Gemini 2.5 Flash-Lite Standard 成本常數符合官方現價",
);
assert(
  /GEMINI_MODEL_WEB\s*=\s*"models\/gemini-2\.5-flash"/.test(linebot) &&
    /PRICE_WEB_INPUT\s*=\s*0\.3/.test(linebot) &&
    /PRICE_WEB_OUTPUT\s*=\s*2\.5/.test(linebot) &&
    /forceWebSearch[\s\S]{0,120}CONFIG\.MODEL_NAME_WEB/.test(linebot) &&
    /modelName === CONFIG\.MODEL_NAME_WEB[\s\S]{0,100}PRICE_WEB_INPUT/.test(
      linebot,
    ),
  "Web grounding 必須獨立使用 Gemini 2.5 Flash 並依官方費率估算",
);
assert(
  /GEMINI_MODEL_THINK\s*=\s*"models\/gemini-2\.5-flash"/.test(linebot) &&
    /PRICE_THINK_INPUT\s*=\s*0\.3/.test(linebot) &&
    /PRICE_THINK_OUTPUT\s*=\s*2\.5/.test(linebot) &&
    /useThinkModel[\s\S]{0,180}CONFIG\.MODEL_NAME_THINK/.test(linebot),
  "整本 PDF fallback 使用 Gemini 2.5 Flash 與官方費率；免費 Evidence 與一般 Fast 仍留在低成本路徑",
);
assert(
  /if \(attachPDFs\)[\s\S]{0,700}thinkingConfig\s*=\s*\{\s*thinkingBudget:\s*0\s*\}/.test(linebot),
  "PDF Structured Output 必須關閉預設 Thinking，避免思考 token 截斷 JSON 並浪費成本",
);
assert(
  /MAX_FAST_INPUT_TOKENS:\s*12000/.test(linebot) &&
    /PDF_INPUT_SOFT_WARNING_TOKENS:\s*20000/.test(linebot) &&
    /MAX_LEGACY_PDF_INPUT_TOKENS:\s*100000/.test(linebot) &&
    /MAX_PDF_ESTIMATED_TOTAL_COST_TWD:\s*0\.35/.test(linebot) &&
    /MAX_PDF_OUTPUT_TOKENS:\s*1200/.test(linebot),
  "Fast/PDF input、PDF output 與單次最壞費用上限已寫入程式",
);
assert(
  /PDF Mode 只保留本輪完整問題/.test(linebot) &&
    /const lastUserMessage = messages[\s\S]{0,220}effectiveMessages = lastUserMessage/.test(
      linebot,
    ) &&
    /PDF Token Budget v29\.6\.119/.test(linebot),
  "大型手冊必須先移除無關歷史，20K 只警告，100K 與 NT$0.35 雙重硬擋",
);
assert(
  /:countTokens\?key=/.test(linebot) &&
    /generateContentRequest: generateContentRequest/.test(linebot) &&
    /generateContentRequest\.generationConfig/.test(linebot) &&
    /file_data/.test(linebot) &&
    /file_uri/.test(linebot) &&
    /PDF countTokens 失敗，fail closed/.test(linebot),
  "PDF fuse 以含 file URI 的 countTokens 預檢且失敗時 fail closed",
);
assert(
  /function tryPdfLowResolutionRescue_/.test(linebot) &&
    /PDF_RESCUE_MEDIA_RESOLUTION:\s*"MEDIA_RESOLUTION_LOW"/.test(linebot) &&
    /estimatePdfWorstCaseCostTwd_/.test(linebot) &&
    /PDF Cost Rescue v29\.6\.119/.test(linebot),
  "PDF 超過 token 或費用上限時先降解析度重算，不能直接宣告無法讀取",
);
assert(
  /手冊已由使用者明確授權[\s\S]{0,260}不再注入整包 QA、RULE、C3/.test(
    linebot,
  ) &&
    /【唯一資料來源】本輪掛載的官方手冊 PDF/.test(linebot),
  "PDF 生成階段必須是手冊單一來源，避免 QA/RULE 污染與額外 token",
);
assert(
  /function applyManualEvidenceGuard_/.test(linebot) &&
    /範圍:型號明確/.test(linebot) &&
    /範圍:依型號而異/.test(linebot) &&
    /手冊回答缺少可核對頁碼／摘錄／適用範圍/.test(linebot) &&
    /evidence\.page === "未找到"/.test(linebot) &&
    /!evidence\.excerpt/.test(linebot) &&
    /證據摘錄\\s\*\[:：\]/.test(linebot) &&
      /官方手冊：\$\{evidence\.page\}/.test(linebot) &&
    /rawScope === "型號共通" \? "全檔共通"/.test(linebot),
  "所有手冊回答都必須具頁碼與型號適用範圍，泛用段落不得硬下結論",
);
assert(
  /staleFile:\s*true/.test(linebot) &&
    /tokenPreflight\.staleFile[\s\S]*?refreshStalePdfAttachmentsFromDrive_\(filesToAttach\)[\s\S]*?scheduleImmediateRebuild\(\)[\s\S]*?return "\[KB_EXPIRED\]"/.test(
      linebot,
    ) &&
    /if \(!evidenceCorrectionAttempted\)/.test(linebot),
  "PDF countTokens 的 403/404 過期檔必須只修復本題一次，仍失敗才 fail closed 並排程整庫重建",
);
assert(
  /const transientCodes = \[429, 500, 502, 503, 504\]/.test(linebot) &&
    /countTokens[\s\S]*?退避 1 秒後重試一次/.test(linebot) &&
    /\(attachPDFs \|\| forceWebSearch\) && retryCount === 0/.test(linebot),
  "countTokens 與進階來源 429/5xx 只做一次受控退避重試",
);
assert(
  /PDF Mode Retry v29\.6\.123/.test(linebot) &&
    /PDF Generate Refresh v29\.6\.123/.test(linebot) &&
    /pdfRefreshAttempted = false/.test(linebot),
  "PDF 空答與生成階段過期 URI 都有單次自癒且禁止無限循環",
);
assert(
  /function buildBluetoothAudioManualSearchQuery_/.test(linebot) &&
    /藍牙揚聲器清單/.test(linebot) &&
    /Bluetooth Speaker List/.test(linebot) &&
    /PDF Query Rewrite v29\.6\.124/.test(linebot) &&
    /"id":"manual-s32fm70x80x-bluetooth-audio"/.test(qaCsv) &&
    /"BLUETOOTH_AUDIO"/.test(qaCsv) &&
    /"pages":"151"/.test(qaCsv) &&
    /qaKnowledgeFindManualEvidence_/.test(qaKnowledge) &&
    /qaKnowledgeGetManualEvidenceRecords_/.test(linebot),
  "M8 藍牙音訊操作題須優先命中已核對第 151 頁；其他型號才使用正式標題與選單同義詞擴查",
);
assert(
  /function findBluetoothAudioRuleEvidence_/.test(linebot) &&
    /function enforceBluetoothAudioRuleEvidence_/.test(linebot) &&
    /CLASS_RULES 明載 Tizen \+/.test(linebot) &&
    /不能回答成沒有內建藍牙/.test(linebot) &&
    /三星官方規格已確認搭載 Tizen 作業系統與\$\{versionText\}/.test(
      linebot,
    ) &&
    /前面已建立的部分回答與[\s\S]*手冊建議必須原樣保留/.test(linebot) &&
    !/const bluetoothRuleIntroMatch/.test(linebot) &&
    /\[AUTO_SEARCH_PDF\]/.test(linebot),
  "CLASS_RULES 明載的 Smart/Tizen 藍牙能力不得被 Fast 模型反向否定，且通用回答鏈不得被藍牙特例覆寫",
);
assert(
  /let failedUploadCount = 0/.test(linebot) &&
    /failedUploadCount\+\+/.test(linebot) &&
    /const failedCount = failedUploadCount/.test(linebot),
  "每日重建能正確偵測 PDF 上傳失敗並排程背景重試",
);
assert(
  /單次上限約 NT\$0\.35/.test(testUi) &&
    !/即將讀取 PDF \(約 NT\$1\.5\)/.test(testUi),
  "TestUI PDF 成本提示與正式 NT$0.35 上限一致",
);
assert(
  /slice\(0, CONFIG\.MAX_RELEVANT_RULE_LINES\)/.test(linebot) &&
    /MAX_RELEVANT_RULE_LINES:\s*8/.test(linebot),
  "Fast Mode 最多注入 8 筆相關 RULE",
);
assert(
  /setProperty\("PENDING_MODEL_REVIEW"/.test(linebot) &&
    /function buildOfficialMinimalRuleLine_/.test(linebot) &&
    /官方新品自動驗證/.test(linebot) &&
    /validateOfficialManualFirstPage_/.test(linebot) &&
    /activatedRuleLines\.map/.test(linebot) &&
    /function isIncompleteModelRuleLine_/.test(linebot) &&
    /Sync RULE Guard v29\.6\.096/.test(linebot) &&
    !/const placeholderLine = `\$\{model\},型號：尚無資訊`/.test(linebot),
  "新品只有在官方欄位與手冊第一頁交叉驗證後才可寫入 A 欄最小 RULE；未完成型號仍不得注入",
);
assert(
  /function validateOfficialManualFirstPage_[\s\S]*?GEMINI_MODEL_FAST}:countTokens[\s\S]*?totalTokens > 250000[\s\S]*?requestFirstPageIdentity_\(GEMINI_MODEL_FAST\)[\s\S]*?GEMINI_MODEL_THINK !== GEMINI_MODEL_FAST[\s\S]*?requestFirstPageIdentity_\(GEMINI_MODEL_THINK\)/.test(
    linebot,
  ),
  "新品第一頁型號驗證先用 Flash-Lite；只有失敗才允許 2.5 Flash 再核對一次，並受 250K token 上限保護",
);
assert(
  /Fast\/Web 歷史先裁減/.test(linebot) &&
    !/effectiveMessages = recentMessages;[\s\S]{0,300}const payload = \{\s*contents: geminiContents/.test(
      linebot,
    ),
  "歷史在建立唯一 payload 前裁減",
);
assert(
  !/無 groundingChunks\/groundingSupports，重試一次/.test(linebot) &&
    /buildTentativeWebFallback_/.test(linebot) &&
    /保留安全過濾後的可能解法，不冒充有引用的網搜答案/.test(linebot),
  "網搜缺引用時不重複付費，改以明確未證實的保守答案完成回覆",
);
assert(
  /if \(forceWebSearch\)[\s\S]{0,100}thinkingBudget:\s*0/.test(linebot) &&
    /maxOutputTokens:\s*forceWebSearch\s*\?\s*450/.test(linebot) &&
    /numbered\.length < 3/.test(linebot) &&
    /buildSafeUsbMediaWebAnswer_/.test(linebot) &&
    /Web USB Media Guard v29\.6\.154/.test(linebot),
  "Web 關閉動態思考並限制輸出；USB 媒體題以 grounded 來源產生固定安全摘要",
);
assert(
  /--paid-live/.test(paidRunner) &&
    /MAX_PDF_CALLS > 3/.test(paidRunner) &&
    /MAX_COST_TWD > 0\.3/.test(paidRunner),
  "10x5 正式 runner 需明確 paid-live 且受 PDF/費用預算限制",
);

if (process.exitCode) process.exit(process.exitCode);
console.log("Cost guard contract passed.");
