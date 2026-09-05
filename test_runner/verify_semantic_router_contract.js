const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const linebot = fs.readFileSync(path.join(root, "linebot.gs"), "utf8") + "\n" + fs.readFileSync(path.join(root, "manual_index_runtime.gs"), "utf8");
const fixture = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "datasets", "semantic_router_cases_v1.json"),
    "utf8",
  ),
);

function extractFunction(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert(start >= 0, `缺少 RouteAnalysisV1 契約函式：${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`函式未正常結束：${name}`);
}

const requiredFunctions = [
  "getSemanticRouterMode_",
  "getRouteAnalysisSchema_",
  "shouldRunSemanticRouter_",
  "normalizeRouteAnalysis_",
  "validateRouteAnalysis_",
  "buildSemanticRouterCacheKey_",
  "runConditionalRouteAnalysis_",
  "getSemanticRouteExecution_",
];

// 先一次列出所有缺漏，避免開發時逐個補函式才看到下一個紅燈。
const missingFunctions = requiredFunctions.filter(
  (name) => linebot.indexOf(`function ${name}`) < 0,
);
assert.deepStrictEqual(
  missingFunctions,
  [],
  `RouteAnalysisV1 尚未完成，缺少：${missingFunctions.join(", ")}`,
);

const propertyStore = new Map();
const cacheStore = new Map();
const context = {
  console,
  GAS_VERSION: "v29.6.277",
  SEMANTIC_ROUTER_VERSION: "RouteAnalysisV1",
  SEMANTIC_ROUTER_POLICY_VERSION: "GatePolicyV2",
  SEMANTIC_ROUTER_MODE_DEFAULT: "conditional",
  SEMANTIC_ROUTER_MAX_CLAIMS: 5,
  GEMINI_MODEL_ROUTER: "models/gemini-3.7-flash",
  stripInternalRoutingHints_: (value) => String(value || ""),
  normalizeModelForDisplay: (value) =>
    String(value || "").toUpperCase().replace(/^LS/, "S"),
  dedupDisplayModels: (values, limit) =>
    [...new Set((values || []).filter(Boolean))].slice(0, limit || 20),
  isPotentialMultiClaimQuestion_: (value) => /而且|以及|同時|、/.test(String(value || "")),
  isEllipticalEvidenceFollowUp_: (value) => /^(那|它|這|怎麼|哪裡)/.test(String(value || "")),
  isLikelyLocalSpecRuleQuestion_: (value) => /規格|支援|HDMI|PBP/i.test(String(value || "")),
  isOperationOrTroubleshootQuery: (value) => /怎麼|如何|故障|切換|開啟/i.test(String(value || "")),
  isManualVerificationRequiredQuery: (value) =>
    /PBP|選單|步驟|零售模式|使用模式/i.test(String(value || "")),
  computeReplyAnchor_: (value) => {
    let hash = 2166136261;
    for (const ch of String(value || "")) {
      hash ^= ch.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (key) =>
        propertyStore.has(String(key)) ? propertyStore.get(String(key)) : null,
    }),
  },
  CacheService: {
    getScriptCache: () => ({
      get: (key) => (cacheStore.has(String(key)) ? cacheStore.get(String(key)) : null),
      put: (key, value) => cacheStore.set(String(key), String(value)),
      remove: (key) => cacheStore.delete(String(key)),
    }),
  },
  writeLog: () => {},
};
vm.createContext(context);
vm.runInContext(
  ["buildSemanticRouterInput_", "canReuseSemanticFollowup_", "isManualActionPathQuestion_", ...requiredFunctions]
    .map((name) => extractFunction(linebot, name))
    .join("\n\n"),
  context,
);

function validationPassed(result) {
  return Boolean(result && typeof result === "object" && result.valid === true);
}

function validationFailed(result) {
  return Boolean(
    result &&
      typeof result === "object" &&
      result.valid === false &&
      Array.isArray(result.errors) &&
      result.errors.length > 0,
  );
}

// 正式接管後預設 conditional；只有明確 off 才能關閉，亂填則回正式預設。
propertyStore.clear();
assert.strictEqual(context.getSemanticRouterMode_(), "conditional");
propertyStore.set("SEMANTIC_ROUTER_MODE", "off");
assert.strictEqual(context.getSemanticRouterMode_(), "off");
propertyStore.set("SEMANTIC_ROUTER_MODE", "shadow");
assert.strictEqual(context.getSemanticRouterMode_(), "shadow");
propertyStore.set("SEMANTIC_ROUTER_MODE", "conditional");
assert.strictEqual(context.getSemanticRouterMode_(), "conditional");
propertyStore.set("SEMANTIC_ROUTER_MODE", "always_on");
assert.strictEqual(context.getSemanticRouterMode_(), "conditional");
assert(
  /const\s+SEMANTIC_ROUTER_MODE_DEFAULT\s*=\s*["']conditional["']/.test(linebot),
  "正式 production default 必須是 conditional；不能只在測試 VM 假裝接管",
);

const schema = context.getRouteAnalysisSchema_();
assert(
  schema && String(schema.type).toLowerCase() === "object",
  "RouteAnalysisV1 schema 必須是 object",
);
assert(
  !Object.prototype.hasOwnProperty.call(schema, "additionalProperties"),
  "Gemini responseSchema 不得使用 API 不支援的 additionalProperties",
);
assert(schema.properties && !schema.properties.answer, "Router schema 禁止 answer 欄位");
for (const field of [
  "topicRelation",
  "productAction",
  "candidateIndex",
  "claims",
  "confidence",
  "reasonCode",
]) {
  assert(
    Array.isArray(schema.required) && schema.required.includes(field),
    `RouteAnalysisV1 schema 缺少 required 欄位：${field}`,
  );
}
assert.deepStrictEqual(
  Array.from(schema.properties.topicRelation.enum || []),
  ["new", "followup", "ambiguous"],
);
assert.deepStrictEqual(
  Array.from(schema.properties.productAction.enum || []),
  ["keep_confirmed", "choose_candidate", "none"],
);
assert(
  schema.properties.topicRelation.description &&
    schema.properties.productAction.description &&
    schema.properties.claims.items.properties.intent.description &&
    schema.properties.claims.items.properties.evidenceNeed.description,
  "Structured Output 關鍵欄位需有簡短語意描述，不能只靠 enum 名稱猜測",
);
assert(
  schema.properties.claims &&
    String(schema.properties.claims.type).toLowerCase() === "array" &&
    schema.properties.claims.items &&
    !Object.prototype.hasOwnProperty.call(
      schema.properties.claims.items,
      "additionalProperties",
    ),
  "claims[] schema 必須維持 Gemini 支援子集；封閉欄位由應用端 validator 負責",
);

const invocationById = new Map(
  fixture.invocationCases.map((testCase) => [testCase.id, testCase]),
);
assert(
  fixture.invocationCases.length >= 20,
  "Router 啟動契約至少覆蓋 20 種真實提問／追問情境",
);
propertyStore.set("SEMANTIC_ROUTER_MODE", "conditional");
for (const testCase of fixture.invocationCases) {
  assert.strictEqual(
    context.shouldRunSemanticRouter_(testCase.input),
    testCase.expected,
    `shouldRunSemanticRouter_ 路由錯誤：${testCase.id}`,
  );
}
assert.strictEqual(
  context.shouldRunSemanticRouter_({
    mode: "conditional",
    question: "零售模式是什麼？",
    localCoverage: "none",
  }),
  true,
  "QA／RULE 無法分類的手冊型用語必須先交 Router，不得直接讓 Fast 猜答案",
);
assert.strictEqual(
  context.shouldRunSemanticRouter_({
    mode: "conditional",
    question: "S49DG952SC 的 PBP 怎麼開？",
    confirmedModel: "S49DG952SC",
    candidateModels: ["S49DG952SC"],
    localCoverage: "partial",
    routeConflict: true,
  }),
  false,
  "完整型號與手冊來源都明確時必須直接查證，不得先多叫一次 3.7 Router",
);
assert.strictEqual(
  context.shouldRunSemanticRouter_({
    mode: "conditional",
    question: "那兩邊呢？",
    previousTopic: "S57CG952NC 的 PBP 兩側更新率限制",
    confirmedModel: "S57CG952NC",
    candidateModels: ["S57CG952NC"],
    possibleFollowUp: true,
    priorRoutePlanAvailable: true,
  }),
  false,
  "同一主題已由 Router 規劃後，省略式連續追問必須沿用 claims，不得逐輪付費",
);
assert.strictEqual(
  context.shouldRunSemanticRouter_({
    mode: "conditional",
    question: "G8 的 PBP 怎麼開？",
    candidateModels: ["S32DG802SC", "S32HG806ES"],
    identityKind: "alias",
    ambiguousAlias: true,
    seriesAliasResolved: true,
    localCoverage: "none",
  }),
  false,
  "G8 等已由 CLASS_RULES 解析的系列別稱應直接走 RULE 共識或型號選單，不得多叫 Router",
);

for (const testCase of fixture.validAnalyses) {
  const routeInput = invocationById.get(testCase.inputCaseId).input;
  const normalized = context.normalizeRouteAnalysis_(
    JSON.stringify(testCase.analysis),
    routeInput,
  );
  assert(normalized && typeof normalized === "object", `無法正規化：${testCase.id}`);
  const validation = context.validateRouteAnalysis_(normalized, routeInput);
  assert(
    validationPassed(validation),
    `合法 RouteAnalysisV1 被拒絕：${testCase.id} ${JSON.stringify(validation)}`,
  );
  assert(
    validation.analysis && !Object.prototype.hasOwnProperty.call(validation.analysis, "answer"),
    `Router 驗證結果不得含 answer：${testCase.id}`,
  );
}

for (const testCase of fixture.invalidAnalyses) {
  const routeInput = invocationById.get(testCase.inputCaseId).input;
  const validation = context.validateRouteAnalysis_(testCase.analysis, routeInput);
  assert(
    validationFailed(validation),
    `不安全 RouteAnalysisV1 未被拒絕：${testCase.id} ${JSON.stringify(validation)}`,
  );
}
const retailModeInput = {
  mode: "conditional",
  question: "零售模式是什麼？",
  confirmedModel: "",
  candidateModels: [],
  localCoverage: "none",
};
const retailModeMisclassified = context.normalizeRouteAnalysis_(
  {
    version: "RouteAnalysisV1",
    topicRelation: "new",
    productAction: "none",
    candidateIndex: null,
    claims: [
      {
        id: "retail_mode",
        question: "零售模式是什麼？",
        intent: "general_reasoning",
        evidenceNeed: "general_reasoning",
        answerShape: "fact",
      },
    ],
    confidence: "high",
    reasonCode: "other",
  },
  retailModeInput,
);
const retailModeValidation = context.validateRouteAnalysis_(
  retailModeMisclassified,
  retailModeInput,
);
assert(
  retailModeValidation.analysis.claims[0].evidenceNeed ===
    "manual_model_specific" &&
    retailModeValidation.errors.includes("manual_model_unresolved"),
  "產品模式／功能被 Router 誤分成一般知識時，應用端必須改回手冊證據；缺型號則只問完整型號",
);

const confirmedChooseNullInput = {
  ...invocationById.get("elliptical_followup_invoke").input,
  confirmedModel: "S57CG952NC",
  candidateModels: ["S57CG952NC", "S49CG934SC"],
};
const confirmedChooseNull = context.normalizeRouteAnalysis_(
  {
    version: "RouteAnalysisV1",
    topicRelation: "followup",
    productAction: "choose_candidate",
    candidateIndex: null,
    claims: [
      {
        id: "claim_1",
        question: "S57CG952NC 的 PBP 兩側最高更新率是多少？",
        intent: "spec",
        evidenceNeed: "manual_model_specific",
        answerShape: "fact",
      },
    ],
    confidence: "high",
    reasonCode: "elliptical_followup",
  },
  confirmedChooseNullInput,
);
const confirmedChooseNullValidation = context.validateRouteAnalysis_(
  confirmedChooseNull,
  confirmedChooseNullInput,
);
assert(
  validationPassed(confirmedChooseNullValidation) &&
    confirmedChooseNullValidation.analysis.productAction === "keep_confirmed" &&
    confirmedChooseNullValidation.analysis.candidateIndex === null,
  "已確認完整型號時，應用程式必須把 Router 的重選要求校正為沿用原型號",
);

const currentInfoMisclassified = context.normalizeRouteAnalysis_(
  {
    version: "RouteAnalysisV1",
    topicRelation: "new",
    productAction: "keep_confirmed",
    candidateIndex: 0,
    claims: [
      {
        id: "stock",
        question: "S32FM703UC 現在有庫存嗎？",
        intent: "current_info",
        evidenceNeed: "local_stable",
        answerShape: "fact",
      },
    ],
    confidence: "high",
    reasonCode: "current_info",
  },
  invocationById.get("current_info_deterministic_bypass").input,
);
const currentInfoValidation = context.validateRouteAnalysis_(
  currentInfoMisclassified,
  invocationById.get("current_info_deterministic_bypass").input,
);
assert(
  validationPassed(currentInfoValidation) &&
    currentInfoValidation.analysis.claims[0].evidenceNeed === "web_current",
  "時效資訊即使被 Router 錯標本機資料，也必須由應用程式改回 Web",
);

const operationMisclassified = context.normalizeRouteAnalysis_(
  {
    version: "RouteAnalysisV1",
    topicRelation: "new",
    productAction: "none",
    candidateIndex: null,
    claims: [
      {
        id: "pbp_steps",
        question: "S32DG802SC 的 PBP 怎麼開？",
        intent: "operation",
        evidenceNeed: "general_reasoning",
        answerShape: "steps",
      },
    ],
    confidence: "high",
    reasonCode: "other",
  },
  {
    question: "S32DG802SC 的 PBP 怎麼開？",
    confirmedModel: "S32DG802SC",
    candidateModels: ["S32DG802SC"],
    localCoverage: "none",
  },
);
const operationValidation = context.validateRouteAnalysis_(
  operationMisclassified,
  {
    question: "S32DG802SC 的 PBP 怎麼開？",
    confirmedModel: "S32DG802SC",
    candidateModels: ["S32DG802SC"],
    localCoverage: "none",
  },
);
assert(
  validationPassed(operationValidation) &&
    operationValidation.analysis.productAction === "keep_confirmed" &&
    operationValidation.analysis.claims[0].evidenceNeed ===
      "manual_model_specific",
  "型號操作題不得被 general_reasoning 放行，且已確認型號不得被洗掉",
);

const orphanFollowup = context.normalizeRouteAnalysis_(
  {
    version: "RouteAnalysisV1",
    topicRelation: "followup",
    productAction: "none",
    candidateIndex: null,
    claims: [
      {
        id: "orphan",
        question: "那兩邊呢？",
        intent: "spec",
        evidenceNeed: "local_stable",
        answerShape: "fact",
      },
    ],
    confidence: "high",
    reasonCode: "elliptical_followup",
  },
  { question: "那兩邊呢？", previousTopic: "" },
);
const orphanFollowupValidation = context.validateRouteAnalysis_(
  orphanFollowup,
  { question: "那兩邊呢？", previousTopic: "" },
);
assert(
  validationFailed(orphanFollowupValidation) &&
    orphanFollowupValidation.errors.includes("followup_topic_missing"),
  "沒有 previousTopic 時不得把孤立短句冒充成可承接追問",
);

const mediumConfidenceAction = context.getSemanticRouteExecution_(
  {
    valid: true,
    analysis: {
      confidence: "medium",
      productAction: "keep_confirmed",
      candidateIndex: 0,
      claims: [{ evidenceNeed: "manual_model_specific" }],
    },
  },
  invocationById.get("elliptical_followup_invoke").input,
);
assert.strictEqual(
  mediumConfidenceAction.action,
  "continue_fast",
  "中低信心 Router 不得直接啟動付費來源",
);

const ambiguousMeaningAction = context.getSemanticRouteExecution_(
  {
    valid: true,
    error: "",
    analysis: {
      topicRelation: "ambiguous",
      reasonCode: "intent_conflict",
      confidence: "medium",
      productAction: "none",
      candidateIndex: null,
      claims: [{ evidenceNeed: "general_reasoning" }],
    },
  },
  {
    question: "零售模式是什麼？",
    confirmedModel: "",
    candidateModels: [],
  },
);
assert.strictEqual(
  ambiguousMeaningAction.action,
  "clarify",
  "無法判定是產品設定或價格／通路時，應先用一句話澄清，不得硬猜或直接啟動付費來源",
);
const routerTransportFailureAction = context.getSemanticRouteExecution_(
  { valid: false, error: "http_503", analysis: null },
  { question: "零售模式是什麼？" },
);
assert.strictEqual(
  routerTransportFailureAction.action,
  "continue_fast",
  "Router HTTP／格式失敗不得冒充語意歧義或把使用者卡在澄清迴圈",
);
const missingManualModelAction = context.getSemanticRouteExecution_(
  {
    valid: false,
    error: "manual_model_unresolved",
    analysis: {
      topicRelation: "new",
      reasonCode: "other",
      confidence: "high",
      productAction: "none",
      candidateIndex: null,
      claims: [{ evidenceNeed: "manual_model_specific" }],
    },
  },
  {
    question: "零售模式怎麼設定？",
    confirmedModel: "",
    candidateModels: [],
  },
);
assert.strictEqual(
  missingManualModelAction.action,
  "ask_full_model",
  "Router 已辨識為手冊功能但沒有任何型號候選時，應承接原題只問完整型號",
);

const sequentialClaims = [
  {
    id: "manual_claim",
    question: "M9 能否直接接同軸線選台？",
    intent: "operation",
    evidenceNeed: "manual_model_specific",
    answerShape: "fact",
  },
  {
    id: "web_claim",
    question: "目前有哪些第四台業者提供相容 App？",
    intent: "current_info",
    evidenceNeed: "web_current",
    answerShape: "fact",
  },
];
const sequentialExecution = context.getSemanticRouteExecution_(
  {
    valid: true,
    analysis: {
      confidence: "high",
      productAction: "keep_confirmed",
      candidateIndex: 0,
      claims: sequentialClaims,
    },
  },
  {
    question: "M9 可以接第四台，也可以直接裝業者 App 嗎？",
    confirmedModel: "S32FM902SC",
    candidateModels: ["S32FM902SC"],
  },
);
assert.strictEqual(
  sequentialExecution.action,
  "manual",
  "手冊＋Web 複合主張必須先依專案順序查手冊",
);
assert.deepStrictEqual(
  Array.from(sequentialExecution.sourceSequence || []),
  ["manual", "web"],
  "手冊先行時仍須保存後續 Web intent，不得因 action=manual 丟失第二個來源",
);
assert(
  Array.isArray(sequentialExecution.deferredClaims) &&
    sequentialExecution.deferredClaims.some((claim) =>
      /web_claim/.test(String((claim && claim.id) || claim || "")),
    ),
  "sequential execution 必須保留尚未執行的 Web claim",
);

const keyInput = {
  ...invocationById.get("elliptical_followup_invoke").input,
  kbVersion: "kb-v1",
};
const sameKey = context.buildSemanticRouterCacheKey_(keyInput);
const whitespaceKey = context.buildSemanticRouterCacheKey_({
  ...keyInput,
  question: "  那兩邊呢？  ",
});
const otherModelKey = context.buildSemanticRouterCacheKey_({
  ...keyInput,
  confirmedModel: "S49CG934SC",
  candidateModels: ["S49CG934SC"],
});
const otherKbKey = context.buildSemanticRouterCacheKey_({
  ...keyInput,
  kbVersion: "kb-v2",
});
assert.strictEqual(sameKey, whitespaceKey, "快取鍵必須正規化問題前後空白");
assert.notStrictEqual(sameKey, otherModelKey, "不同確認型號不得共用 Router 快取");
assert.notStrictEqual(sameKey, otherKbKey, "不同 KB 版本不得共用 Router 快取");

// off 與不需 Router 的 deterministic 命中都不得碰供應商。
propertyStore.set("SEMANTIC_ROUTER_MODE", "off");
let runResult = context.runConditionalRouteAnalysis_(
  invocationById.get("ambiguous_g8_invoke").input,
);
assert.strictEqual(runResult.mode, "off");
assert.strictEqual(runResult.attempted, false);

propertyStore.set("SEMANTIC_ROUTER_MODE", "conditional");
runResult = context.runConditionalRouteAnalysis_(
  invocationById.get("exact_rule_bypass").input,
);
assert.strictEqual(runResult.attempted, false);

const runnerSource = `${extractFunction(linebot, "runConditionalRouteAnalysis_")}\n${extractFunction(linebot, "callSemanticRouter_")}`;
assert(
  /GEMINI_MODEL_ROUTER/.test(runnerSource) &&
    /models\/gemini-3\.7-flash/.test(linebot) &&
    /PRICE_ROUTER_INPUT\s*=[^\n]*2027-01-01[^\n]*0\.75\s*:\s*1\.5/.test(linebot) &&
    /PRICE_ROUTER_OUTPUT\s*=[^\n]*2027-01-01[^\n]*3\.75\s*:\s*7\.5/.test(linebot),
  "Router 必須使用獨立 Gemini 3.7 Flash 模型常數，不得偷換 PDF／Web 模型",
);
assert(
  /calculateGeminiUsageCost_\(\s*usage,\s*PRICE_ROUTER_INPUT,\s*PRICE_ROUTER_OUTPUT/s.test(
    runnerSource,
  ) && /routerCostTwd/.test(linebot),
  "Router 必須使用自己的官方費率並獨立留下 routerCostTwd",
);
assert(
  /const\s+SEMANTIC_ROUTER_POLICY_VERSION\s*=\s*["']GatePolicyV3["']/.test(
    linebot,
  ) &&
    /policyVersion:\s*SEMANTIC_ROUTER_POLICY_VERSION/.test(
      extractFunction(linebot, "buildSemanticRouterCacheKey_"),
    ) &&
    /const\s+SEMANTIC_ROUTER_COST_ALERT_TWD\s*=\s*0\.1/.test(linebot) &&
    /cost\.costTWD[\s\S]*SEMANTIC_ROUTER_COST_ALERT_TWD/.test(runnerSource),
  "Router 語意政策變更必須汰換舊快取，並以實際 usage 超過 NT$0.10 記錄警示",
);
assert(
  /thinkingLevel\s*:\s*["']low["']/.test(runnerSource) &&
    !/thinkingBudget\s*[:=]/.test(runnerSource),
  "3.7 Router 必須使用 low thinkingLevel，不得沿用 2.5 thinkingBudget",
);
assert(
  !/google_search|googleSearch|grounding|FileSearch|file_data/i.test(runnerSource),
  "Router 不得掛網搜、File Search 或 PDF",
);
assert(
  !/AUTO_SEARCH_PDF|AUTO_SEARCH_WEB/.test(runnerSource),
  "RouteAnalysisV1 不得再以舊暗號作正式決策輸出",
);

const handleStart = linebot.indexOf("function handleMessage");
const handleEnd = linebot.indexOf("\nfunction handleDeepSearch", handleStart);
assert(handleStart >= 0 && handleEnd > handleStart, "找不到完整 handleMessage 區段");
const handleSource = linebot.slice(handleStart, handleEnd);
assert(
  /runConditionalRouteAnalysis_\(semanticRouterInput\)/.test(handleSource) &&
    /getSemanticRouteExecution_\(/.test(handleSource),
  "RouteAnalysisV1 必須接入唯一 handleMessage 回答鏈",
);
const semanticClarificationSource = extractFunction(
  linebot,
  "promptSemanticRouterClarification_",
);
const semanticFullModelSource = extractFunction(
  linebot,
  "promptSemanticRouterFullModel_",
);
assert(
  /action === "clarify"/.test(handleSource) &&
    /promptSemanticRouterClarification_\(/.test(handleSource) &&
    /getSemanticClarificationKey_/.test(semanticClarificationSource) &&
    /600000/.test(semanticClarificationSource) &&
    /Sam/.test(semanticClarificationSource) &&
    /action === "ask_full_model"/.test(handleSource) &&
    /promptSemanticRouterFullModel_\(/.test(handleSource) &&
    /不用重打問題/.test(semanticFullModelSource) &&
    /Sam/.test(semanticFullModelSource) &&
    /resumedFromSemanticClarification/.test(handleSource) &&
    /consumeDailyQuestionModelSelectionHold_/.test(handleSource),
  "語意歧義必須可澄清並在 10 分鐘內接回同一題；補充訊息不得再扣一般題額度，店內缺詞需提示交給 Sam 補 FAQ",
);

const terminalToneContext = {
  stripInternalRoutingHints_: (value) => String(value || ""),
  buildDeterministicExactRuleReply_: () => "整機最高更新率為 240Hz。",
  findExactModelRuleLine_: () => "",
};
vm.createContext(terminalToneContext);
vm.runInContext(
  `${extractFunction(linebot, "isExactProductFactQuestion_")}
   ${extractFunction(linebot, "buildSafeNoEvidenceNextStep_")}
   globalThis.terminalReply = buildSafeNoEvidenceNextStep_(
     "S49DG932SC 的 PBP 兩邊各自最高幾 Hz？",
     "S49DG932SC"
   );`,
  terminalToneContext,
);
const terminalSafetySource = [
  semanticClarificationSource,
  semanticFullModelSource,
  extractFunction(linebot, "buildSafeNoEvidenceNextStep_"),
  extractFunction(linebot, "buildTentativeManualFallback_"),
  extractFunction(linebot, "buildTentativeWebFallback_"),
  extractFunction(linebot, "buildManualWebRescueReply_"),
].join("\n");
assert(
  /Sam/.test(terminalToneContext.terminalReply) &&
    !/(?:尊敬的客戶|造成不便(?:，|,|\s)*敬請見諒)/.test(
      terminalToneContext.terminalReply,
    ) &&
    !/(?:尊敬的客戶|造成不便(?:，|,|\s)*敬請見諒)/.test(
      terminalSafetySource,
    ),
  `終端安全訊息可以自然提 Sam，但不得退回制式客服道歉語氣：${terminalToneContext.terminalReply}`,
);
assert(
  !/你是「台灣三星官方客服」/.test(linebot) &&
    !/必須\*\*婉轉拒答\*\*:\s*「不好意思,\s*我是三星螢幕客服/.test(
      linebot,
    ) &&
    /你是「三星螢幕門市店員的內部同儕助手」/.test(linebot) &&
    /不要再問店員是否要搜尋/.test(linebot),
  "Fast 主提示不得殘留對外客服角色或要求店員再次確認 Web；角色必須是門市同儕助手",
);
assert(
  /semanticExecution\.action === "manual"/.test(handleSource) &&
    /executeAutomaticManualFallback_\(/.test(handleSource) &&
    /semanticExecution\.action === "web"/.test(handleSource) &&
    /executeAutomaticWebFallback_\(/.test(handleSource),
  "Router 結果只能交由既有手冊／Web 狀態機執行",
);
assert(
  /semanticRouterControlsThisTurn/.test(handleSource) &&
    /忽略 Fast 舊暗號/.test(handleSource) &&
    /!semanticRouterControlsThisTurn\s*&&\s*shouldSopPdfEscalate/.test(
      handleSource,
    ),
  "conditional 接管後舊 AUTO_SEARCH／SOP 暗號不得成為第二個決策者",
);
assert(
  /const hasExplicitTrigger\s*=\s*!semanticRouterControlsThisTurn\s*&&/s.test(
    handleSource,
  ) &&
    /if\s*\(\s*!semanticRouterControlsThisTurn\s*&&\s*finalText\.includes\("\[AUTO_SEARCH_WEB\]"\)/s.test(
      handleSource,
    ) &&
    /\[Auto Web v29\.6\.289\][\s\S]{0,700}executeAutomaticWebFallback_\(/.test(
      handleSource,
    ),
  "conditional 接管後舊 parser 不得重跑；非 Router 的 AUTO_SEARCH_WEB 必須直接進唯一 Web SourceOperation",
);
assert(
  /activeAnswerEnvelope\.status === "unsupported"[\s\S]{0,2600}executeAutomaticWebFallback_\(/.test(
    handleSource,
  ) &&
    /activeAnswerEnvelope\.status === "partial"[\s\S]{0,3000}executeAutomaticWebFallback_\(/.test(
      handleSource,
    ),
  "Fast 無證據或部分證據且手冊無法直接完成時，必須自動 Web 到達終點，不得只回來源按鈕",
);

const semanticExecutionStart = handleSource.indexOf(
  'semanticExecution.action === "manual" ||',
);
const semanticExecutionEnd = handleSource.indexOf(
  "return;",
  handleSource.indexOf("executeAutomaticWebFallback_(", semanticExecutionStart),
);
const semanticHandoffBlock = handleSource.slice(
  semanticExecutionStart,
  semanticExecutionEnd + 20,
);
assert(
  /executeAutomaticManualFallback_\([\s\S]{0,500}dailyQuestionCharge\s*:/s.test(
    semanticHandoffBlock,
  ) &&
    /executeAutomaticWebFallback_\([\s\S]{0,500}dailyQuestionCharge\s*:/s.test(
      semanticHandoffBlock,
    ) &&
    !/refundDailyQuestionUsage_\(/.test(semanticHandoffBlock),
  "handle 只能把一般題 charge 交給 advanced executor；不得在型號解析與免費本機證據完成前直接退款",
);
const automaticWebSource = extractFunction(linebot, "executeAutomaticWebFallback_");
assert(
  /executeAdvancedSourceQuery_\(/.test(automaticWebSource) &&
    !/callLLMWithRetry\(/.test(automaticWebSource),
  "Router Web 路徑必須沿用既有額度與冪等守門，不能自建供應商旁路",
);
const advancedSourceQuery = extractFunction(linebot, "executeAdvancedSourceQuery_");
const localPrecheckIndexes = [];
for (
  let index = advancedSourceQuery.indexOf("tryManualFreeLocalAnswer_(");
  index >= 0;
  index = advancedSourceQuery.indexOf("tryManualFreeLocalAnswer_(", index + 1)
) {
  localPrecheckIndexes.push(index);
}
const lastLocalPrecheckIndex = Math.max(...localPrecheckIndexes);
const transferredRefundIndex = advancedSourceQuery.indexOf(
  "refundTransferredDailyQuestion_(",
);
const readDoneIndex = advancedSourceQuery.indexOf(
  "readDoneAdvancedSourceOperation_(",
);
const firstQuotaStopIndex = advancedSourceQuery.indexOf("remainingBefore <= 0");
assert(
  localPrecheckIndexes.length === 2 &&
    transferredRefundIndex > lastLocalPrecheckIndex &&
    readDoneIndex > transferredRefundIndex &&
    firstQuotaStopIndex > readDoneIndex &&
    /if \(!selectedModel\)[\s\S]{0,2400}return true;[\s\S]*refundTransferredDailyQuestion_/s.test(
      advancedSourceQuery,
    ),
  "executor 必須完成兩次免費 local precheck 與型號解析後才 consume-once 退款；缺型號等待不得退款",
);
assert(
  /function refundTransferredDailyQuestion_/.test(linebot) &&
    /dailyQuestionRefunded\s*===\s*true/.test(
      extractFunction(linebot, "refundTransferredDailyQuestion_"),
    ) &&
    /dailyQuestionCharge\s*=\s*""/.test(
      extractFunction(linebot, "refundTransferredDailyQuestion_"),
    ),
  "advanced 一般題退款必須 consume-once，manual→web 或重入不得重複退回",
);
assert(
  readDoneIndex >= 0 && firstQuotaStopIndex > readDoneIndex,
  "來源剩餘 0 次時仍須先查 operation done cache；同題已完成答案可零成本重播，不能先被額度訊息擋掉",
);
const testMessageSource = extractFunction(linebot, "testMessage");
assert(
  /semanticRouterMode/.test(testMessageSource) &&
    /fakeEvent\.semanticRouterMode/.test(testMessageSource),
  "TestUI 必須提供 request-scoped Router 模式，不能改共用 ScriptProperty",
);
const devTestRunSection = linebot.slice(
  linebot.indexOf('e.parameter.testRun === "1"'),
  linebot.indexOf('v29.6.005: 從「所有紀錄」Sheet'),
);
assert(
  /\["off", "shadow", "conditional"\]\.indexOf\(requestedRouterMode\)/.test(
    devTestRunSection,
  ) &&
    /fakeEvent\.semanticRouterMode = requestedRouterMode/.test(devTestRunSection) &&
    !/setProperty\(\s*["']SEMANTIC_ROUTER_MODE/.test(devTestRunSection) &&
    /requestAudit: requestAudit/.test(devTestRunSection) &&
    /routeAnalysis: LAST_SEMANTIC_ROUTE_ANALYSIS/.test(devTestRunSection) &&
    /sourceState: LAST_SOURCE_TEST_STATE/.test(devTestRunSection),
  "開發版真實 probe 必須以單次 allowlist 模式執行並回傳 compact Router／來源稽核",
);

const followUpGuardContext = {
  extractFullModelLikeTokens: (text) =>
    /S\d{2}[A-Z0-9]{4,}/i.test(String(text || "")) ? ["MODEL"] : [],
  extractShortAliasModelTokens: (text) =>
    /(?:^|\s)(?:G|M)\d{1,3}(?:\s|$)/i.test(String(text || ""))
      ? ["ALIAS"]
      : [],
};
vm.createContext(followUpGuardContext);
vm.runInContext(
  `${extractFunction(linebot, "isEllipticalEvidenceFollowUp_")}\n${extractFunction(linebot, "shouldDeferLocalEvidenceForSemanticFollowUp_")}`,
  followUpGuardContext,
);
assert.strictEqual(
  followUpGuardContext.shouldDeferLocalEvidenceForSemanticFollowUp_(
    "那兩邊各自最高幾 Hz？ (型號: S49DG932SC)",
    "S49DG932SC 怎麼開啟 PBP？",
    "conditional",
  ),
  true,
  "沒有新產品主詞的省略追問必須先交 Router，不能被整機 RULE 搶答",
);
assert.strictEqual(
  followUpGuardContext.shouldDeferLocalEvidenceForSemanticFollowUp_(
    "那兩邊各自最高幾 Hz？",
    "S49DG932SC 怎麼開啟 PBP？",
    "shadow",
  ),
  false,
  "shadow 模式不得改變既有正式回答路徑",
);
assert.strictEqual(
  followUpGuardContext.shouldDeferLocalEvidenceForSemanticFollowUp_(
    "那 M8 呢",
    "S49DG932SC 有幾個 HDMI？",
    "conditional",
  ),
  false,
  "本輪明講新系列時不得偷借上一型號，應由既有系列選型守門處理",
);
const routeSchemaSource = extractFunction(linebot, "getRouteAnalysisSchema_");
assert(
  !/additionalProperties/.test(routeSchemaSource) &&
    /responseSchema: getRouteAnalysisSchema_\(\)/.test(
      extractFunction(linebot, "callSemanticRouter_"),
    ),
  "Router 必須使用 Gemini responseSchema 支援的子集；額外欄位改由應用端 validator 拒絕",
);
assert(
  (linebot.match(/deferLocalEvidenceForSemanticFollowUp/g) || []).length >= 8 &&
    /earlySemanticPreviousTopic\s*\|\|\s*getPreviousMeaningfulUserQuestion_\(history\)/.test(
      linebot,
    ),
  "QA／RULE／操作早退與 Planner 必須共用省略追問 guard 與上一題主題",
);
for (const auditField of [
  "routerCalls",
  "routerCacheHits",
  "plannerLatencyMs",
  "routerCostTwd",
  "claimRoutes",
  "selectedModel",
  "finalCoverage",
]) {
  assert(linebot.includes(auditField), `Request Audit 缺少 ${auditField}`);
}

// PBP 關係證據：只讓數字和關鍵字各自出現在同一摘錄仍不夠，必須明文綁定。
const relationContext = {};
vm.createContext(relationContext);
vm.runInContext(
  `${extractFunction(linebot, "isModelIndependentManualOperation_")}\n${extractFunction(linebot, "isGenericManualInputTargetBinding_")}\n${extractFunction(linebot, "isExplicitManualAlternativeAnswer_")}\n${extractFunction(linebot, "manualEvidenceRelationMatchesExcerpt_")}\n${extractFunction(linebot, "manualSupportedAnswerMatchesExcerpt_")}`,
  relationContext,
);
const unboundPbpRate = relationContext.manualSupportedAnswerMatchesExcerpt_(
  "S57CG952NC：PBP 兩側最高都可到 120Hz。",
  "PIP/PBP Mode 可開啟或關閉 PIP/PBP 模式。HDMI 1 的最大解析度為 7680 × 2160 @ 120Hz。",
  "PBP 分割後兩邊最高都能跑 120Hz 嗎？",
);
const explicitlyBoundPbpRate = relationContext.manualSupportedAnswerMatchesExcerpt_(
  "S57CG952NC：PBP 左右兩側各最高 120Hz。",
  "在 PBP 模式下，左右兩側畫面各自最高支援 120Hz。",
  "PBP 分割後兩邊最高都能跑 120Hz 嗎？",
);
const directlyBoundHdmiRate = relationContext.manualSupportedAnswerMatchesExcerpt_(
  "HDMI 1 最高支援 120Hz。",
  "HDMI 1 的最大解析度為 7680 × 2160 @ 120Hz。",
  "HDMI 1 最高更新率是多少？",
);
const wrongInterfaceRate = relationContext.manualSupportedAnswerMatchesExcerpt_(
  "DisplayPort 最高支援 120Hz。",
  "HDMI 1 的最大解析度為 7680 × 2160 @ 120Hz。",
  "HDMI 1 最高更新率是多少？",
);
const validSeparateInterfaceRates =
  relationContext.manualSupportedAnswerMatchesExcerpt_(
    "HDMI 1 最高支援 120Hz；DisplayPort 最高支援 165Hz。",
    "HDMI 1 的最大更新率為 120Hz。DisplayPort 的最大更新率為 165Hz。",
    "HDMI 1 和 DisplayPort 的最高更新率各是多少？",
  );
const swappedSeparateInterfaceRates =
  relationContext.manualSupportedAnswerMatchesExcerpt_(
    "HDMI 1 最高支援 165Hz；DisplayPort 最高支援 120Hz。",
    "HDMI 1 的最大更新率為 120Hz。DisplayPort 的最大更新率為 165Hz。",
    "HDMI 1 和 DisplayPort 的最高更新率各是多少？",
  );
assert.strictEqual(
  unboundPbpRate,
  false,
  "PBP 與 120Hz 各自出現、但沒有『兩側各 120Hz』直接關係時必須拒絕",
);
assert.strictEqual(
  explicitlyBoundPbpRate,
  true,
  "摘錄明文綁定 PBP 左右兩側與 120Hz 時應保留",
);
assert.strictEqual(
  directlyBoundHdmiRate,
  true,
  "關係守門不得誤殺明文綁定的單一 HDMI 更新率",
);
assert.strictEqual(
  wrongInterfaceRate,
  false,
  "回答宣稱的介面與摘錄不同時，即使數值相同也必須拒絕",
);
assert.strictEqual(
  validSeparateInterfaceRates,
  true,
  "HDMI 120Hz／DP 165Hz 分別有同句直接證據時必須通過，不能要求兩個數值擠在同一句",
);
assert.strictEqual(
  swappedSeparateInterfaceRates,
  false,
  "介面與數值交換配對時，即使所有 token 都出現在摘錄中也必須拒絕",
);

console.log("PASS verify_semantic_router_contract");
