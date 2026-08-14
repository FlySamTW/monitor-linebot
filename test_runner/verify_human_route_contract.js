const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const linebot = fs.readFileSync(path.join(root, "linebot.gs"), "utf8");
const testUi = fs.readFileSync(path.join(root, "TestUI.html"), "utf8");
const prompt = fs.readFileSync(path.join(root, "Prompt.csv"), "utf8");
const authHelper = fs.readFileSync(path.join(__dirname, "testui_auth.js"), "utf8");

function extractFunction(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert(start >= 0, `找不到函式 ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`函式 ${name} 大括號不完整`);
}

const renderContext = {
  sanitizePriceNumbers_: (text) => String(text || ""),
};
vm.createContext(renderContext);
vm.runInContext(
  [
    extractFunction(linebot, "formatListSpacing"),
    extractFunction(linebot, "formatForLineMobile"),
    extractFunction(linebot, "getNaturalCustomerSourceLabel_"),
    extractFunction(linebot, "renderCustomerFacingText_"),
  ].join("\n\n"),
  renderContext,
);

const formatted = renderContext.formatForLineMobile(
  "先說結論。這是同一段說明，不該一句一段！接著補必要條件：完成。",
);
assert(!/。\n\n這是/.test(formatted), "標點後仍被強制空行");
assert(!/！\n\n接著/.test(formatted), "驚嘆號後仍被強制空行");

const customerReply = renderContext.renderCustomerFacingText_(
  "根據本機 QA資料庫，您可以先切到 USB-C。\n\n[來源:S32BM801.pdf]\n[費用:NT$0.1234（In:100/Out:20=120）]\n[AUTO_SEARCH_PDF]",
);
assert(!/您|\[費用|In:|\[AUTO_|\[來源|QA庫|QA資料庫|CLASS_RULES|規格庫/.test(customerReply), "客戶回覆仍外洩內部資訊");
assert(/資料來源：三星官方手冊/.test(customerReply), "手冊來源沒有轉成自然頁尾");

const relevanceContext = { isCrossDeviceMonitorQuery: () => true };
vm.createContext(relevanceContext);
vm.runInContext(
  extractFunction(linebot, "sanitizeManualAnswerForQuestion_"),
  relevanceContext,
);
const relevantOnly = relevanceContext.sanitizeManualAnswerForQuestion_(
  "M8 的 USB-C 支援影像輸入，也能提供 65W 充電。另有攝影機連接埠。請確認裝置支援 DisplayPort 輸出。",
  "iPhone 17 接 M8 沒畫面",
);
assert(/影像輸入|DisplayPort/.test(relevantOnly), "顯示題的必要影像條件被誤刪");
assert(!/65W|充電|攝影機/.test(relevantOnly), "顯示題仍混入供電或攝影機資訊");

const consentContext = { writeLog: () => {} };
vm.createContext(consentContext);
vm.runInContext(
  [
    "const MANUAL_SEARCH_CONSENT_TTL_SEC = 600;",
    extractFunction(linebot, "normalizeManualConsentQuery_"),
    extractFunction(linebot, "grantManualSearchConsent_"),
    extractFunction(linebot, "consumeManualSearchConsent_"),
    extractFunction(linebot, "limitManualPdfFiles_"),
  ].join("\n\n"),
  consentContext,
);
const values = new Map();
const cache = {
  put: (key, value) => values.set(key, value),
  get: (key) => values.get(key) || null,
  remove: (key) => values.delete(key),
};
assert(consentContext.grantManualSearchConsent_(cache, "U1", "M8 沒畫面", []));
assert(consentContext.consumeManualSearchConsent_(cache, "U1", "M8 沒畫面", "S32BM801"));
assert(!consentContext.consumeManualSearchConsent_(cache, "U1", "M8 沒畫面", "S32BM801"));
consentContext.grantManualSearchConsent_(cache, "U1", "M8 沒畫面", []);
assert(!consentContext.consumeManualSearchConsent_(cache, "U1", "G5 重置", "S27DG502"));
const pdfs = [1, 2, 3].map((id) => ({ id, mimeType: "application/pdf" }));
assert.strictEqual(consentContext.limitManualPdfFiles_(pdfs, "M8 沒畫面").length, 1);
assert.strictEqual(consentContext.limitManualPdfFiles_(pdfs, "M7 與 M8 比較").length, 2);

const detailedManualContext = {
  isManualVerificationRequiredQuery: (query) => /HEVC|編解碼/i.test(query),
  pdfFileNameMatchesModelToken_: (name, model) =>
    String(name).toUpperCase().split(/[,\.]/).includes(String(model).toUpperCase()),
};
vm.createContext(detailedManualContext);
vm.runInContext(
  extractFunction(linebot, "prioritizeDetailedManualCandidates_"),
  detailedManualContext,
);
const broadQuickGuide = {
  name: "S27DM502,S27FM500,S27FM501,S32DM702,S32DM703,S32DM803,S32FM500,S32FM501,S32FM702,S32FM703,S32FM803,S32FM902,S43DM702,S43DM703,S43FM702,S43FM703.pdf",
};
const focusedFullManual = { name: "S32FM702,S32FM703,S32FM803.pdf" };
const detailedOrder = detailedManualContext.prioritizeDetailedManualCandidates_(
  [broadQuickGuide, focusedFullManual],
  "S32FM703 是否支援 HEVC",
  "S32FM703",
);
assert.strictEqual(
  detailedOrder[0].name,
  focusedFullManual.name,
  "編解碼器題沒有在同型號 PDF 中優先完整手冊",
);
const normalOrder = detailedManualContext.prioritizeDetailedManualCandidates_(
  [broadQuickGuide, focusedFullManual],
  "S32FM703 如何接上腳架",
  "S32FM703",
);
assert.strictEqual(normalOrder[0].name, broadQuickGuide.name, "一般題不應被詳細手冊排序改寫");

const manualChunkContext = {};
vm.createContext(manualChunkContext);
vm.runInContext(
  [
    extractFunction(linebot, "isMediaCodecSupportQuery"),
    extractFunction(linebot, "getVerifiedManualChunks_"),
    extractFunction(linebot, "findVerifiedManualChunk_"),
    extractFunction(linebot, "buildVerifiedManualChunkReply_"),
  ].join("\n\n"),
  manualChunkContext,
);
const hevcChunk = manualChunkContext.findVerifiedManualChunk_(
  "S32FM703UC 是否支援 HEVC？",
  "S32FM703",
);
assert(hevcChunk, "已驗證的 S32FM703 HEVC 手冊片段沒有被精準取回");
const hevcChunkReply = manualChunkContext.buildVerifiedManualChunkReply_(
  "S32FM703",
  hevcChunk,
);
assert(
  /Main10/.test(hevcChunkReply) &&
    /MKV、MP4、TS/.test(hevcChunkReply) &&
    /第 180、187 頁/.test(hevcChunkReply) &&
    /\[來源:官方手冊\]/.test(hevcChunkReply),
  "可稽核手冊片段缺少 HEVC 結論、容器限制、頁碼或來源",
);
assert.strictEqual(
  manualChunkContext.findVerifiedManualChunk_("S32FM703 如何恢復原廠設定？", "S32FM703"),
  null,
  "非 HEVC 題不應誤用編解碼器片段",
);
assert.strictEqual(
  manualChunkContext.findVerifiedManualChunk_("S32FM799 是否支援 HEVC？", "S32FM799"),
  null,
  "未驗證型號不應套用其他型號的手冊片段",
);

assert(
  /Fast Mode 資料不足，已改為詢問使用者，不呼叫 PDF/.test(linebot) &&
    /aiRequestedPdfSearch = false;/.test(linebot) &&
    /\? "consent"\s*:\s*"fast"/.test(linebot),
  "Fast Mode 的 PDF 暗號仍可能代表直接查手冊",
);
assert(
  /consumeManualSearchConsent_\([\s\S]{0,500}callLLMWithRetry/.test(linebot),
  "明確查手冊路徑沒有在 LLM 前消耗單次授權",
);
assert(
  /const directLocalQa = findLocalMatchInQA\(msg, userId\)/.test(linebot) &&
    /QA First Router v29\.6\.116/.test(linebot) &&
    /Alias Selection Gate v29\.6\.116/.test(linebot) &&
    !/callLLMWithRetry|UrlFetchApp/.test(
      extractFunction(linebot, "replyWithLocalQaMatch_"),
    ),
  "精準 QA 零成本捷徑或系列別稱實體守門遺失",
);
assert(
  /function checkPdfCost[\s\S]{0,900}isExplicitPdfConsent/.test(linebot) &&
    !/Potential Model Number \(Loads PDF\)/.test(linebot) &&
    !/"設定"|"故障"|"無法"|"不能"/.test(
      extractFunction(linebot, "checkPdfCost"),
    ),
  "TestUI 仍會把一般型號、設定或故障題誤判為 PDF 高成本操作",
);
assert(
  /function getExactSmartMonitorCodecModelFromQuery_/.test(linebot) &&
    /function buildSmartMonitorCodecManualQuery_/.test(linebot) &&
    /function findVerifiedManualChunk_/.test(linebot) &&
    /Manual Chunk RAG v29\.6\.105/.test(linebot) &&
    /Smart Codec Guard v29\.6\.100.*等待明確查手冊同意/.test(linebot) &&
    /Smart Codec Guard v29\.6\.100.*直接進單次 PDF 查證/.test(linebot) &&
    /manualExecutionQuery = buildSmartMonitorCodecManualQuery_/.test(linebot) &&
    /callLLMWithRetry\(\s*manualExecutionQuery/.test(linebot),
  "Smart Codec 完整型號仍可能反覆要求選型號，無法進入單次手冊查證",
);
assert(
  /#這題再搜網路/.test(linebot) && /AUTO_SEARCH_WEB/.test(linebot),
  "網搜明確同意入口遺失",
);
assert(
  /function replyMessage[\s\S]{0,500}renderCustomerFacingPayload_\(txt\)/.test(linebot),
  "LINE 共用送出邊界沒有套用客戶版 renderer",
);
assert(
  /TEST_USER_ID_KEY/.test(testUi) &&
    /crypto\.randomUUID/.test(testUi) &&
    /aria-label="送出訊息"/.test(testUi) &&
    !/transform:\s*scale\(0\.76\)/.test(testUi),
  "TestUI 工作階段或 RWD／可存取性契約未完成",
);
assert(
  /GAS_MAINTENANCE_SECRET/.test(authHelper) &&
    /\[BLOCKED\]/.test(authHelper) &&
    !/console\.log\([^\n]*(?:secret|TEST_URL)/i.test(authHelper),
  "線上 runner 授權 helper 不符合 fail-fast／不洩密契約",
);
assert(
  /Prompt v29\.6\.106/.test(prompt) &&
    /純手機、平板、手錶、耳機、電視、家電、筆電/.test(prompt) &&
    /只表示「建議使用者按常駐選單的官方手冊」/.test(prompt) &&
    /同一訊息不得自動跨來源/.test(prompt) &&
    !/建議[^\n]{0,20}(?:問|聯絡)\s*Sam|問問\s*Sam|必須使用表情|智慧家電（/.test(prompt),
  "Prompt 仍含範圍、手冊授權或轉問 Sam 的矛盾規則",
);

const scenarioCoverage = [
  "iPhone Air 連 M8",
  "iPhone 17 連 M8",
  "G5 重置",
  "M7 靜音",
  "Smart Monitor HEVC",
  "價格",
  "服務時間",
  "未知型號",
  "模糊追問",
  "換題",
  "謝謝",
  "API 暫時失敗",
];
assert.strictEqual(scenarioCoverage.length, 12, "使用者情境矩陣不完整");

console.log("PASS: verify_human_route_contract");
