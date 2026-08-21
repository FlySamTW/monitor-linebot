const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const linebot = fs.readFileSync(path.join(root, "linebot.gs"), "utf8");
const qaKnowledge = fs.readFileSync(path.join(root, "qa_knowledge.gs"), "utf8");
const qaRows = fs
  .readFileSync(path.join(root, "QA.csv"), "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

function extractFunction(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert(start >= 0, `missing function ${name}`);
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
  throw new Error(`unterminated function ${name}`);
}

const cacheStore = new Map();
const cache = {
  get(key) {
    return cacheStore.has(key) ? cacheStore.get(key) : null;
  },
  put(key, value) {
    cacheStore.set(key, String(value));
  },
  remove(key) {
    cacheStore.delete(key);
  },
};

const context = {
  console,
  QA_KNOWLEDGE_TEST_ROWS_: qaRows,
  CacheService: { getScriptCache: () => cache },
  writeLog: () => {},
  normalizeModelForDisplay: (model) =>
    String(model || "").toUpperCase().replace(/^LS/, "S").replace(/X[A-Z]{2,4}$/, ""),
  extractFullModelLikeTokens: (text) =>
    String(text || "").toUpperCase().match(/\b(?:LS)?S\d{2}[A-Z0-9]{5,16}\b/g) || [],
  extractShortAliasModelTokens: (text) =>
    [...new Set(String(text || "").toUpperCase().match(/\b[SGM]\d{1,5}[A-Z]{0,3}\b/g) || [])],
  isPdfModelTokenMatch_: (base, model) => {
    const left = String(base || "").toUpperCase();
    const right = String(model || "").toUpperCase();
    return left === right || right.startsWith(left) || left.startsWith(right);
  },
};
vm.createContext(context);
vm.runInContext(
  [
    `function isQaQuestionDirectMatch_(query, question) {
      const clean = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9\\u3400-\\u9FFF]/g, "");
      return clean(query) === clean(question);
    }`,
    qaKnowledge,
  ].join("\n\n"),
  context,
);

const built = context.qaKnowledgeRebuildCache_(qaRows, cache);
assert(built.count >= 30, "legacy QA and QA2 evidence rows must compile together");

const structured = context.qaKnowledgeConvertDraftToStructuredLine_(
  "[M7,藍牙] M7 怎麼連藍牙喇叭？ / A：先打開設定。再選藍牙輸出。",
);
assert(structured.startsWith("QA2:"), "new QA drafts must serialize as QA2");
const parsedStructured = context.qaKnowledgeParseRow_(structured, 1);
assert.strictEqual(parsedStructured.scope.aliases.includes("M7"), true);
assert.strictEqual(parsedStructured.answer.conclusion, "先打開設定");

const speaker = context.qaKnowledgeFindLocalMatch_("S27FM501EC 有雙喇叭嗎？");
assert(speaker && /10W/.test(speaker.answer), "generic QA ranking must retrieve exact-model speaker facts");
const languageAndSpeaker = context.qaKnowledgeFindLocalMatch_(
  "S27FM501EC 支援繁體中文介面與雙喇叭嗎？",
);
assert(
  languageAndSpeaker && /繁體中文/.test(languageAndSpeaker.answer) && /10W/.test(languageAndSpeaker.answer),
  "an exact multi-claim QA must answer every stored claim",
);
assert.strictEqual(
  context.qaKnowledgeFindLocalMatch_("這台有雙喇叭嗎？"),
  null,
  "product-scoped QA must not answer when the user has not supplied a product identity",
);
const wrongSpeaker = context.qaKnowledgeFindLocalMatch_("S32HG806ES 有雙喇叭嗎？");
assert(!wrongSpeaker || !/S27FM501EC/.test(wrongSpeaker.question), "exact model mismatch must not borrow another model QA");
const g8Prompt = context.qaKnowledgeSelectPromptContext_("G8 有耳機孔嗎？", [], false);
assert(
  !/Smart系列螢幕沒有耳機孔/.test(g8Prompt.text),
  "G8 alias questions must not borrow Smart Monitor headphone-jack QA",
);
assert.strictEqual(
  context.qaKnowledgeFindLocalMatch_("S99ZZ999 有雙喇叭嗎？"),
  null,
  "unknown exact models must not borrow another product QA",
);

const bluetooth = context.qaKnowledgeFindManualEvidence_(
  "那要怎麼連接藍牙喇叭？",
  "S32FM803UC",
);
assert(bluetooth && bluetooth.intent === "BLUETOOTH_AUDIO");
assert.strictEqual(bluetooth.pages, "151");
const bluetoothReply = context.qaKnowledgeBuildManualReply_("S32FM803UC", bluetooth);
assert(/音效輸出 → 藍牙揚聲器清單/.test(bluetoothReply));
assert(/第 151 頁/.test(bluetoothReply));

const usbFailure = context.qaKnowledgeFindManualEvidence_(
  "USB 播放一直斷線，想找非官方網路解法",
  "S32FM803UC",
);
assert.strictEqual(usbFailure, null, "manual evidence excludes must prevent topic contamination");

const selected = context.qaKnowledgeSelectPromptContext_("S27FM501EC 有雙喇叭嗎？", [], false);
assert(selected.selectedCount > 0 && selected.selectedCount <= 6);
assert(selected.totalCount >= 30);
assert(selected.text.includes("S27FM501EC"));
assert(!selected.text.includes("manual-s32fm70x80x-bluetooth-audio"));

cacheStore.delete("QA2_RECORDS_V3_0");
const rebuiltAfterEviction = context.qaKnowledgeLoadAllRecords_(cache);
assert.strictEqual(
  rebuiltAfterEviction.length,
  built.count,
  "partial CacheService eviction must rebuild from the QA sheet instead of silently losing rows",
);

assert(
  /qaKnowledgeSelectPromptContext_/.test(extractFunction(linebot, "buildDynamicContext")),
  "Fast dynamic context must use indexed QA candidates",
);
assert(
  !/queryPatterns\s*:/.test(extractFunction(linebot, "getVerifiedManualChunks_")) &&
    /qaKnowledgeGetManualEvidenceRecords_/.test(extractFunction(linebot, "getVerifiedManualChunks_")),
  "manual evidence must be data-driven instead of hardcoded question regex arrays",
);
assert(
  /qaKnowledgeConvertDraftToStructuredLine_/.test(extractFunction(linebot, "saveDraftToSheet")),
  "/紀錄 must persist structured QA2 rows",
);

vm.runInContext(extractFunction(linebot, "isPotentialMultiClaimQuestion_"), context);
assert.strictEqual(
  context.isPotentialMultiClaimQuestion_("S27FM501EC 支援繁體中文介面與雙喇叭嗎？"),
  true,
  "multi-claim specification questions must bypass a partial deterministic RULE reply",
);
assert.strictEqual(
  context.isPotentialMultiClaimQuestion_("S27FM501EC 有幾個 HDMI？"),
  false,
  "single-claim specification questions should keep the zero-cost RULE fast path",
);
assert(
  /!isPotentialMultiClaimQuestion_\(routingQuestion\)/.test(linebot),
  "the early deterministic RULE route must be guarded against partial multi-claim replies",
);

vm.runInContext(extractFunction(linebot, "getExplicitCapabilityCheck_"), context);
const headphoneCapability = context.getExplicitCapabilityCheck_("S32DG802SC 有耳機孔嗎？");
assert(headphoneCapability, "headphone capability questions must be recognized before LLM routing");
assert.strictEqual(
  headphoneCapability.evidence.test("尺寸含底座719.7x584.6x263.5mm"),
  false,
  "dimension decimals must not satisfy the missing-fact headphone evidence guard",
);
assert.strictEqual(
  headphoneCapability.evidence.test("耳機孔3.5mm x1"),
  true,
  "standalone 3.5mm audio evidence must satisfy the capability guard",
);

context.buildDeterministicComparisonReply_ = () => "";
context.findExactModelRuleLine_ = () =>
  "S32DG802SC,尺寸含底座719.7x584.6x263.5mm,HDMI 2.1 x2";
vm.runInContext(extractFunction(linebot, "buildDeterministicExactRuleReply_"), context);
assert.strictEqual(
  context.buildDeterministicExactRuleReply_("S32DG802SC 有耳機孔嗎？", "S32DG802SC"),
  "",
  "a 263.5mm chassis dimension must never be mistaken for a 3.5mm headphone jack",
);
context.findExactModelRuleLine_ = () =>
  "S32TEST001,耳機孔3.5mm x1,尺寸含底座700x500x200mm";
assert(
  /耳機孔3\.5mm/i.test(
    context.buildDeterministicExactRuleReply_("S32TEST001 有耳機孔嗎？", "S32TEST001"),
  ),
  "a real standalone 3.5mm headphone field must remain retrievable",
);

console.log("PASS verify_structured_qa_contract");
