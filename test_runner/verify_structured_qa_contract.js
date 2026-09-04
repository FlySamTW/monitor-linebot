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
const classRuleRows = fs
  .readFileSync(path.join(root, "CLASS_RULES.csv"), "utf8")
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
  SHEET_NAMES: { CLASS_RULES: "CLASS_RULES" },
  ss: {
    getSheetByName(name) {
      if (name !== "CLASS_RULES") return null;
      return {
        getDataRange() {
          return { getValues: () => classRuleRows.map((line) => [line]) };
        },
      };
    },
  },
  writeLog: () => {},
  toHalfWidth: (value) => String(value || ""),
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
assert.strictEqual(
  context.qaKnowledgeFindLocalMatch_("G8 可以用 USB-C 同時顯示與充電嗎？"),
  null,
  "ambiguous G8 must still ask the user to choose a full model",
);
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
const m8Netflix = context.qaKnowledgeFindLocalMatch_("M8 怎麼安裝 Netflix？");
assert(
  m8Netflix && m8Netflix.qaId === "qa-smart-monitor-app-install",
  "M8 Netflix 安裝題必須命中跨世代精準 QA，不得先要求完整型號或讀 PDF",
);
const lightingDefinition = context.qaKnowledgeFindLocalMatch_(
  "CoreSync 和 Eclipse Lighting 有什麼差別？",
);
assert(
  lightingDefinition && lightingDefinition.qaId === "qa-odyssey-lighting-terminology",
  "純術語問題可用 definition QA 解釋，但不得證明特定型號能力",
);
assert.strictEqual(
  context.qaKnowledgeFindLocalMatch_("G9 有 Infinity Core Lighting 嗎？"),
  null,
  "一對多 G9 別稱不得借用通用術語列回答型號能力",
);
const g95CoreSync = context.qaKnowledgeFindLocalMatch_(
  "S49DG952SC 支援 CoreSync 嗎？",
);
assert(
  g95CoreSync && g95CoreSync.qaId === "qa-s49dg952-core-sync-capability",
  "完整型號能力題必須命中精確產品頁證據",
);
assert.strictEqual(
  context.qaKnowledgeFindLocalMatch_("S49DG952SC 要去哪個選單開啟 CoreSync？"),
  null,
  "capability QA 沒有操作路徑時不得冒充 operation 證據",
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

const appManagementManual = context.qaKnowledgeFindManualEvidence_(
  "S32FM803UC 如果找不到 Netflix，要去哪裡搜尋？",
  "S32FM803UC",
);
assert(
  appManagementManual &&
    appManagementManual.id === "manual-s32fm70x80x-app-management" &&
    /首頁 → 應用程式/.test(
      context.qaKnowledgeBuildManualReply_("S32FM803UC", appManagementManual),
    ),
  "完整型號必須傳入手冊免費預檢；既有已核對 App 片段不得誤讀整本 PDF",
);

const dualModeBothMetrics = context.qaKnowledgeFindManualEvidence_(
  "那兩個模式最高解析度和更新率各是多少？",
  "S32HG806ES",
);
assert(
  dualModeBothMetrics === null,
  "片段若沒有同時列出兩種模式的解析度與更新率，不得只重複半套答案",
);

const usbFailure = context.qaKnowledgeFindManualEvidence_(
  "USB 播放一直斷線，想找非官方網路解法",
  "S32FM803UC",
);
assert.strictEqual(usbFailure, null, "manual evidence excludes must prevent topic contamination");

const hg806Manual = context.qaKnowledgeFindManualEvidence_(
  "想用一條 USB-C 連 MacBook 顯示又充電",
  "S32HG806ES",
);
assert(hg806Manual && hg806Manual.id === "manual-hg806-no-usbc");
const hg802Manual = context.qaKnowledgeFindManualEvidence_(
  "USB-C 可以幫 MacBook 充電嗎？",
  "S32HG802SC",
);
assert(hg802Manual && hg802Manual.id === "manual-hg802-usbc-98w");

const selected = context.qaKnowledgeSelectPromptContext_("S27FM501EC 有雙喇叭嗎？", [], false);
assert(selected.selectedCount > 0 && selected.selectedCount <= 6);
assert(selected.totalCount >= 30);
assert(selected.text.includes("S27FM501EC"));
assert(!selected.text.includes("manual-s32fm70x80x-bluetooth-audio"));

cacheStore.delete("QA2_RECORDS_V4_0");
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

vm.runInContext(extractFunction(linebot, "isInterfaceDisplayTimingQuery_"), context);
vm.runInContext(extractFunction(linebot, "isModeQualifiedDisplaySpecQuestion_"), context);
vm.runInContext(extractFunction(linebot, "hasDirectModeQualifiedRuleEvidence_"), context);
vm.runInContext(extractFunction(linebot, "loadRuleTermOntology_"), context);
vm.runInContext(extractFunction(linebot, "buildRuleTermAliasRegex_"), context);
vm.runInContext(extractFunction(linebot, "findRuleTermOntologyMatches_"), context);
vm.runInContext(extractFunction(linebot, "findRuleTermOntologyMatch_"), context);
vm.runInContext(extractFunction(linebot, "isPotentialMultiClaimQuestion_"), context);
assert.strictEqual(
  context.buildRuleTermAliasRegex_(["UHD"]).test("WUHD"),
  false,
  "short English aliases must not match inside a longer product term",
);
assert.strictEqual(
  context.buildRuleTermAliasRegex_(["UHD"]).test("支援 UHD 嗎？"),
  true,
  "English alias boundaries must still work next to Chinese text",
);
assert.strictEqual(
  context
    .findRuleTermOntologyMatches_("G9 has PBP?")
    .some((item) => item.canonical === "ergonomics.has"),
  false,
  "the English verb has must not be interpreted as the HAS stand capability",
);
assert.strictEqual(
  context
    .findRuleTermOntologyMatches_("G9 有 HAS 高度調整嗎？")
    .some((item) => item.canonical === "ergonomics.has"),
  true,
  "an explicit uppercase HAS term must remain searchable",
);
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
vm.runInContext(extractFunction(linebot, "getAllExplicitCapabilityChecks_"), context);
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
const coreSyncCapability = context.getExplicitCapabilityCheck_(
  "S49DG952SC 支援 CoreSync 嗎？",
);
const infinityCoreCapability = context.getExplicitCapabilityCheck_(
  "S49DG952SC 有 Infinity Core Lighting 嗎？",
);
const eclipseCapability = context.getExplicitCapabilityCheck_(
  "S49DG952SC 支援 Eclipse Lighting 嗎？",
);
assert(
  coreSyncCapability && coreSyncCapability.evidence.test("Core Sync"),
  "CoreSync capability must be verified against the exact model RULE",
);
assert(
  infinityCoreCapability &&
    infinityCoreCapability.evidence.test("Core Sync") === false,
  "CoreSync in an exact model RULE must not prove Infinity Core Lighting",
);
assert(
  eclipseCapability && eclipseCapability.evidence.test("Core Lighting+") === false,
  "Core Lighting+ must not prove Eclipse Lighting",
);
const maptCapability = context.getExplicitCapabilityCheck_(
  "S27H802EFA 支援 MAC Address Pass Through 嗎？",
);
assert(
  maptCapability && maptCapability.canonical === "network.mapt",
  "new Samsung feature terms must be recognized from CLASS_RULES aliases without a per-term route regex",
);
const upscalingProCapability = context.getExplicitCapabilityCheck_(
  "S32FM902SC 支援 4K AI Upscaling Pro 嗎？",
);
assert(
  upscalingProCapability &&
    upscalingProCapability.canonical === "image.ai_upscaling_4k_pro" &&
    upscalingProCapability.evidence.test("4K AI Upscaling") === false,
  "a Pro feature request must not be proven by the base feature name",
);
assert.deepStrictEqual(
  Array.from(
    context
      .findRuleTermOntologyMatches_("S32FM902SC 有 Samsung Vision AI 和 Knox Vault 嗎？")
      .map((item) => item.canonical)
      .sort(),
  ),
  ["security.knox_vault", "smart.samsung_vision_ai"],
  "two requested Samsung features must remain two claims instead of returning only the first ontology match",
);
assert.strictEqual(
  context.getAllExplicitCapabilityChecks_(
    "S32FM902SC 有 Samsung Vision AI 和 Knox Vault 嗎？",
  ).length,
  2,
  "the evidence guard must validate every requested ontology capability",
);
const samsungTwHomepageCanonicalTerms = [
  "category.ultrawide_monitor",
  "shape.curved_display",
  "resolution.screen_resolution",
  "resolution.full_hd",
  "display.aspect_ratio",
  "timing.refresh_rate",
  "timing.response_time",
  "audio.built_in_speakers",
  "panel.ips",
  "panel.va",
  "hdr.high_dynamic_range",
  "sync.gsync",
  "smart.smart_tv",
  "smart.streaming_services",
  "voice.voice_control",
  "smart.iot_integration",
  "connection.network_connectivity",
  "connection.usb_c_video",
  "connection.hdmi",
  "connection.displayport",
  "ergonomics.adjustability",
];
const termRows = classRuleRows.filter((line) => line.startsWith("術語_"));
assert(
  termRows.length >= 151 &&
    classRuleRows.some((line) => /canonical=game\.dual_mode/.test(line)) &&
    classRuleRows.some((line) => /canonical=oled\.safeguard_plus/.test(line)) &&
    classRuleRows.some((line) => /canonical=software\.samsung_display_manager/.test(line)) &&
    classRuleRows.some((line) => /canonical=oled\.screen_protection_mode/.test(line)) &&
    classRuleRows.some((line) => /canonical=smart\.multi_device_experience/.test(line)),
  "the Samsung TW monitor term ontology must cover the main gaming, OLED, smart, connection, and software features",
);
assert(
  samsungTwHomepageCanonicalTerms.every((canonical) =>
    termRows.some(
      (line) =>
        line.includes(`canonical=${canonical}`) &&
        /definition_only=true/.test(line) &&
        /https:\/\/www\.samsung\.com\/tw\/monitors\//.test(line),
    ),
  ),
  "every user-facing feature concept on the Samsung TW monitors homepage must exist as definition-only ontology data",
);
assert(
  classRuleRows.some(
    (line) =>
      line.startsWith("能力_S49DG952SC,") &&
      /capabilities=CoreSync/.test(line) &&
      /official_product_page/.test(line),
  ) &&
    classRuleRows.some(
      (line) =>
        line.startsWith("能力_S27H802EFA,") &&
        /Samsung Display Manager/.test(line) &&
        /MAPT/.test(line),
    ),
  "official feature names must be separated from exact-model capability evidence",
);
assert(
  !qaRows.some((line) => /其畫面同步模式叫 Eclipse Sync/.test(line)),
  "the curated QA must not promote an unverified Eclipse Sync name ahead of the conservative ontology",
);

context.buildDeterministicComparisonReply_ = () => "";
context.findExactModelRuleLine_ = () =>
  "S32DG802SC,尺寸含底座719.7x584.6x263.5mm,HDMI 2.1 x2";
vm.runInContext(extractFunction(linebot, "splitClassRuleFields_"), context);
vm.runInContext(extractFunction(linebot, "sanitizeExactRuleReplyField_"), context);
vm.runInContext(extractFunction(linebot, "buildDeterministicExactRuleReply_"), context);
assert.deepStrictEqual(
  Array.from(context.splitClassRuleFields_("S27TEST001,原生對比1,000:1,HAS升降底座")),
  ["S27TEST001", "原生對比1000:1", "HAS升降底座"],
  "CLASS_RULES 千分位逗號不得被誤切成兩個欄位",
);
assert.strictEqual(
  context.buildDeterministicExactRuleReply_(
    "S57CG952NC PBP 分割後兩邊最高都能跑 120Hz 嗎？",
    "S57CG952NC",
  ),
  "",
  "PBP／雙模限定值不得拿整機最高更新率直接回答",
);
context.findExactModelRuleLine_ = () =>
  "S32HG806ES,雙模 6K 165Hz / 3K 330Hz,最大165Hz更新頻率";
const dualModeRuleReply = context.buildDeterministicExactRuleReply_(
  "S32HG806ES 兩個模式最高解析度和更新率各是多少？",
  "S32HG806ES",
);
assert(
  /雙模 6K 165Hz \/ 3K 330Hz/.test(dualModeRuleReply),
  "RULE 本身明載兩種模式完整數值時應零成本回答，不必讀 PDF",
);
context.findExactModelRuleLine_ = () =>
  "S32DG802SC,尺寸含底座719.7x584.6x263.5mm,HDMI 2.1 x2";
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
context.findExactModelRuleLine_ = () =>
  "S27FG812SC,27吋 OLED,能力_S27FG812SC,model=S27FG812SC；aliases=G81SF；capabilities=QD-OLED、Glare Free、CoreSync、PIP；evidence=official_product_page；checkedAt=2026-09-04；source=https://www.samsung.com/tw/";
const cleanCapabilityReply = context.buildDeterministicExactRuleReply_(
  "S27FG812SC 支援 CoreSync 嗎？",
  "S27FG812SC",
);
assert(
  /CoreSync/.test(cleanCapabilityReply) &&
    !/(?:capabilities=|checkedAt=|evidence=|source=|https?:\/\/)/i.test(
      cleanCapabilityReply,
    ),
  "exact-model capability answers must not expose internal evidence metadata",
);
assert.strictEqual(
  context.buildDeterministicExactRuleReply_(
    "S27FG812SC 支援 PBP 嗎？",
    "S27FG812SC",
  ),
  "",
  "a PIP-only capability row must not be treated as evidence for PBP",
);
assert(
  /PIP/.test(
    context.buildDeterministicExactRuleReply_(
      "S27FG812SC 支援 PIP 嗎？",
      "S27FG812SC",
    ),
  ),
  "the matching PIP capability must remain directly answerable",
);

context.computeReplyAnchor_ = (value) => String(value || "").trim();
vm.runInContext(extractFunction(linebot, "isNonProductConversationTurn_"), context);
vm.runInContext(extractFunction(linebot, "getPreviousMeaningfulUserQuestion_"), context);
vm.runInContext(extractFunction(linebot, "getElaborationTopicAnchor_"), context);
assert.strictEqual(
  context.getPreviousMeaningfulUserQuestion_([
    { role: "user", content: "S49DG952SC 支援 CoreSync 嗎？" },
    { role: "assistant", content: "支援。" },
    { role: "user", content: "謝謝" },
  ]),
  "S49DG952SC 支援 CoreSync 嗎？",
  "acknowledgements must not replace the product question used by elaboration",
);
cache.put("elab-user:last_meaningful_query", "收到");
assert.strictEqual(
  context.getElaborationTopicAnchor_(
    cache,
    "elab-user",
    "S49DG952SC 支援 CoreSync 嗎？",
  ),
  "S49DG952SC 支援 CoreSync 嗎？",
  "a stale acknowledgement cache must not replace the elaboration fallback topic",
);
cache.put("elab-user:last_meaningful_query", "較舊的產品問題");
assert.strictEqual(
  context.getElaborationTopicAnchor_(cache, "elab-user", "本輪 AnswerEnvelope 問題"),
  "本輪 AnswerEnvelope 問題",
  "the selected AnswerEnvelope/canonical question must outrank a legacy cache entry",
);

console.log("PASS verify_structured_qa_contract");
