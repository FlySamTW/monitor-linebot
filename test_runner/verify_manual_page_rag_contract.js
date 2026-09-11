const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const linebot = fs.readFileSync(path.join(root, "linebot.gs"), "utf8");
const runtimeData = fs.readFileSync(
  path.join(root, "manual_page_rag_data.gs"),
  "utf8",
);

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`找不到函式：${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`函式未結束：${name}`);
}

const context = {
  addManualActionGuidance_: require('./production_harness').createProductionHarness({quiet:true}).context.addManualActionGuidance_,
  console,
  JSON,
  Math,
  Date,
  Set,
  Number,
  String,
  Array,
  Object,
  RegExp,
  writeLog: () => {},
  escapeRegExp: (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  normalizeManualEvidenceModel_: (value) =>
    String(value || "").toUpperCase().replace(/^LS/, "S"),
  manualEvidenceModelMatchesTarget_: (candidate, target) =>
    String(candidate || "").toUpperCase().replace(/^LS/, "S") ===
    String(target || "").toUpperCase().replace(/^LS/, "S"),
  manualEvidenceNamedFamilyMatchesTarget_: (text) =>
    !/ODYSSEY\s*ARK|ARK DIAL|方舟/i.test(String(text || "")),
  extractManualEvidenceModels_: () => [],
  isManualActionPathQuestion_: (value) => /怎麼|如何|哪裡|在哪/.test(String(value || "")),
  isPotentialMultiClaimQuestion_: (value) => /而且|以及|還要|最高|限制/.test(String(value || "")),
  normalizeManualStructuredResponse_: (
    text,
    model,
    question,
    provenance,
    validationOptions,
  ) =>
    JSON.stringify({
      hydrated: JSON.parse(text),
      model,
      question,
      provenance,
      validationOptions,
    }),
  computeReplyAnchor_: (value) =>
    require("crypto").createHash("sha256").update(String(value)).digest("hex").slice(0, 16),
};
vm.createContext(context);
vm.runInContext(runtimeData, context);
[
  "manualPageRagNormalizeText_",
  "manualPageRagPhraseMatches_",
  "findManualPageRagPlan_",
  "isManualPageRagRuleBackedAliasCompletion_",
  "humanizeManualPageRagAnswer_",
  "getManualPageRagResponseSchema_",
  "getManualPageRagApplicabilityExcerpt_",
  "getManualPageRagKnowledgeFingerprint_",
  "hydrateManualPageRagResponse_",
].forEach((name) => vm.runInContext(extractFunction(linebot, name), context));

const plan = context.findManualPageRagPlan_(
  "S32DG802SC 的 G8 PBP 怎麼開？",
  "S32DG802SC",
);
assert(plan && plan.groupId === "multi_view", "G80SD PBP 命中資料驅動 multi_view 群組");
assert(
  plan && plan.fragments[0].pageNumber === 101,
  "G80SD PBP 第一證據為官方手冊第 101 頁的多重視窗入口",
);
assert(
  plan && plan.allowRuleBackedAliasCompletion === true,
  "只有人工核定的詞彙群可使用 RULE 支持的同義完成判定",
);
assert(
  plan && !plan.fragments.some((fragment) => fragment.pageNumber === 30),
  "共用手冊中的 Odyssey Ark 專屬頁面不得套給 G80SD",
);
assert(
  context.findManualPageRagPlan_("S32DG802SC 的 Dual Mode 怎麼開？", "S32DG802SC") === null,
  "手冊未命名的功能不得因 BM25 最近鄰硬塞無關頁面",
);
assert(
  context.findManualPageRagPlan_("PBP 怎麼開？", "S99ZZ999") === null,
  "未知型號不得借用其他型號頁級索引",
);

const hydrated = JSON.parse(
  context.hydrateManualPageRagResponse_(
    JSON.stringify({
      found: true,
      coverage: "partial",
      unresolvedQuestion: "PBP 名稱未直接出現",
      notFoundReason: "",
      evidence: [
        {
          supportedAnswer:
            "官方手冊中可查到的相近操作是「多重視窗」：到設定 → 多重視窗，從新增檢視選擇內容。",
          evidenceId: "E1",
          pageNumber: 999,
          evidenceExcerpt: "模型不得覆寫這段",
        },
      ],
    }),
    plan,
    "G8 的 PBP 怎麼開？",
    "S32DG802SC 的規格是：PIP/PBP多畫面分割。\n[來源:官方規格庫]",
  ),
);
assert(
  hydrated.hydrated.evidence[0].pageNumber === 101 &&
    hydrated.hydrated.evidence[0].evidenceExcerpt.includes("多重視窗"),
  "頁碼與官方原文只能由編譯索引回填，模型無法偽造",
);
assert(
  /^[A-F0-9]{64}$/i.test(hydrated.provenance.entries[0].sha256),
  "每次頁級回答都綁定已驗證的官方 PDF SHA-256",
);
assert(
  hydrated.hydrated.coverage === "full" &&
    hydrated.hydrated.unresolvedQuestion === "" &&
    hydrated.validationOptions.allowRuleBackedAliasCompletion === true,
  "精確型號 RULE 已證實功能時，PBP 與手冊「多重視窗」名稱差異不再白跑 Web",
);
assert(
  context.isManualPageRagRuleBackedAliasCompletion_(
    plan,
    "G8 的 PBP 怎麼開？",
    "S32DG802SC 的規格是：PIP/PBP多畫面分割。\n[來源:官方規格庫]",
  ) === true &&
    context.isManualPageRagRuleBackedAliasCompletion_(
      plan,
      "G8 的 PBP 怎麼開？",
      "網路文章說這款可用 PBP",
    ) === false,
  "同義完成必須有官方規格庫錨點，網路或模型自述不能解鎖",
);
const badId = JSON.parse(
  context.hydrateManualPageRagResponse_(
    JSON.stringify({
      found: true,
      coverage: "full",
      unresolvedQuestion: "",
      notFoundReason: "",
      evidence: [{ supportedAnswer: "假的答案", evidenceId: "E999" }],
    }),
    plan,
    "G8 的 PBP 怎麼開？",
  ),
);
assert(badId.hydrated.evidence.length === 0, "不存在的 evidenceId 必須被丟棄");

const executeSource = extractFunction(linebot, "executeAdvancedSourceQuery_");
assert(
  executeSource.indexOf("findManualPageRagPlan_") <
    executeSource.indexOf("getRelevantKBFiles("),
  "手冊路由必須先做零 API 頁級檢索，再考慮整本 PDF",
);
assert(
  /callManualPageRag_\([\s\S]{0,220}manualPageRagPlan/.test(executeSource) &&
    /pageRagResult && pageRagResult\.handled/.test(executeSource),
  "頁級命中時只走頁級回答，不得再把整本 PDF 重複送出",
);

let requestedUrl = "";
let requestedPayload = null;
let markedStage = null;
let reservedGrant = null;
const callContext = {
  console,
  JSON,
  Math,
  Date,
  Number,
  String,
  Array,
  Object,
  GEMINI_MODEL_FAST: "models/gemini-3.1-flash-lite",
  PRICE_FAST_INPUT: 0.25,
  PRICE_FAST_OUTPUT: 1.5,
  CONFIG: { API_ENDPOINT: "https://generativelanguage.googleapis.com/v1beta" },
  PropertiesService: {
    getScriptProperties: () => ({ getProperty: () => "test-key" }),
  },
  UrlFetchApp: {
    fetch: (url, options) => {
      requestedUrl = url;
      requestedPayload = JSON.parse(options.payload);
      return {
        getResponseCode: () => 200,
        getContentText: () =>
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "{}" }] } }],
            usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 80 },
          }),
      };
    },
  },
  stripAnySourceTags: (value) => String(value || ""),
  stripInternalRoutingHints_: (value) => String(value || ""),
  getManualPageRagResponseSchema_: () => ({}),
  providerThinkingConfigForModel_: () => ({thinkingLevel:"minimal"}),
  getGeminiApiKey_: () => "test-key",
  findManualPageRagPlan_: () => plan,
  reserveAdvancedSourceUsage_: (grant) => {
    reservedGrant = grant;
    grant.reserved = true;
    grant.remaining = 1;
    return grant;
  },
  markGenerationAttempt_: (stage) => {
    markedStage = stage;
  },
  calculateGeminiUsageCost_: () => ({ costTWD: 0.006, input: 1200, output: 80 }),
  addGenerationUsageToAudit_: () => {},
  hydrateManualPageRagResponse_: () => "[手冊證據:第101頁|範圍:全檔共通]",
  writeLog: () => {},
  lastLlmCallAttempted: false,
  lastTokenUsage: null,
};
// This isolated transport unit checks the forwarded grant. The real gateway,
// resolver and validator are separately exercised by the production harness.
callContext.providerFetch_ = (url, options) => {
  callContext.reserveAdvancedSourceUsage_(options.sourceGrant);
  return callContext.UrlFetchApp.fetch(url, options);
};
vm.createContext(callContext);
vm.runInContext(extractFunction(linebot, "isManualActionPathQuestion_"), callContext);
vm.runInContext(extractFunction(linebot, "callManualPageRag_"), callContext);
const callResult = callContext.callManualPageRag_(
  "G8 的 PBP 怎麼開？",
  "S32DG802SC",
  "支援 PIP/PBP",
  plan,
  { source: "manual", contextId: "TEST", reserved: false },
);
assert(callResult.handled && markedStage === "pdf", "頁級生成仍正確計入一次 PDF 額度／稽核");
assert(
  reservedGrant && reservedGrant.reserved === true,
  "頁級供應商請求送出前必須共用手冊原子配額保留",
);
assert(
  requestedUrl.includes("models/gemini-3.1-flash-lite:generateContent"),
  "頁級證據整理固定使用新專案最低費用的 3.1 Flash-Lite",
);
assert(
  requestedPayload.generationConfig.temperature === 0 &&
    requestedPayload.generationConfig.thinkingConfig.thinkingLevel === "minimal",
  "頁級證據整理固定最小思考與低溫度",
);
assert(
  !JSON.stringify(requestedPayload).includes("fileData") &&
    !JSON.stringify(requestedPayload).includes("file_data") &&
    !JSON.stringify(requestedPayload).includes("fileUri"),
  "頁級命中不得再附整本 PDF URI 或產生 PDF 視覺 token",
);

if (process.exitCode) process.exit(process.exitCode);
