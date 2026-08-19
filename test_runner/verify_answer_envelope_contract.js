const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const linebot = fs.readFileSync(path.join(root, "linebot.gs"), "utf8");

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
  GAS_VERSION: "vTEST",
  ANSWER_ENVELOPE_TTL_MS: 30 * 24 * 60 * 60 * 1000,
  Set,
  Date,
  computeReplyAnchor_: (text) => String(text || "").toUpperCase(),
  normalizeModelForDisplay: (text) => String(text || "").toUpperCase(),
  extractFullModelLikeTokens: (text) =>
    String(text || "").match(/\bS\d{2}[A-Z]{2}\d{3}[A-Z]{2}\b/gi) || [],
  extractShortAliasModelTokens: (text) =>
    String(text || "").match(/\b[MG]\d{1,2}\b/gi) || [],
  isLikelyLocalSpecRuleQuestion_: (text) => /有沒有|支援|規格|可以/.test(text),
  isOperationOrTroubleshootQuery: (text) => /怎麼|如何|連接|接第四台/.test(text),
  isManualVerificationRequiredQuery: (text) => /設定|操作|接第四台/.test(text),
  isKnowledgeMissingReply_: (text) => /資料不足|查無/.test(text),
  tokenizeForSourceInference: (text) =>
    String(text || "").toUpperCase().match(/[A-Z0-9]+|[\u4e00-\u9fff]{2,}/g) || [],
  loadQaRowsForSourceInference: () => [],
  buildDeterministicExactRuleReply_: (question, model) =>
    /OLED/i.test(question) && model === "S32FM902SC"
      ? "S32FM902SC 使用 OLED 面板。"
      : "",
  buildSourcePostbackQuickReply_: (label, data) => ({
    type: "action",
    action: { type: "postback", label, data },
  }),
  stripAnySourceTags: (text) => String(text || ""),
  formatForLineMobile: (text) => String(text || ""),
  toHalfWidth: (text) => String(text || ""),
};
vm.createContext(context);
vm.runInContext(
  [
    extractFunction(linebot, "normalizeAnswerEnvelope_"),
    extractFunction(linebot, "isGeneralComputingReasoningQuestion_"),
    extractFunction(linebot, "isFastEvidenceRequiredQuestion_"),
    extractFunction(linebot, "hasUnverifiedExternalClaim_"),
    extractFunction(linebot, "sanitizeUnverifiedExternalClaims_"),
    extractFunction(linebot, "getFastEvidenceRefs_"),
    extractFunction(linebot, "getSourceTagFromEvidenceRefs_"),
    extractFunction(linebot, "buildFastAnswerEnvelope_"),
    extractFunction(linebot, "buildEvidenceHandoffReply_"),
    extractFunction(linebot, "buildEvidenceActionQuickReplies_"),
    extractFunction(linebot, "buildAdvancedAnswerEnvelope_"),
    extractFunction(linebot, "compactGroundedWebAnswer_"),
    extractFunction(linebot, "getGroundedQuestionFocusTokens_"),
    extractFunction(linebot, "expandGroundedSupportToCompleteLine_"),
    extractFunction(linebot, "doesGroundedAnswerCompleteQuestion_"),
    extractFunction(linebot, "buildGroundedSupportedAnswer_"),
  ].join("\n\n"),
  context,
);

const unsupported = context.buildFastAnswerEnvelope_({
  originalQuestion: "M9可以接第四台嗎?",
  model: "S32FM902SC",
  answerText:
    "M9沒有調諧器，可以接機上盒，有些第四台業者可能提供 App。",
  sourceTag: "",
  hasManual: true,
  manualRecommended: false,
  webRecommended: false,
});
assert.strictEqual(unsupported.status, "unsupported");
assert.strictEqual(unsupported.expandable, false);
assert(unsupported.allowedActions.includes("manual"));
assert(unsupported.allowedActions.includes("web"));
assert.strictEqual(unsupported.evidenceRefs.length, 0);

const generalReasoningClean = context.buildFastAnswerEnvelope_({
  originalQuestion: "43吋 智慧聯網螢幕 M7 桌面的資料夾一列可以放幾個?一行可以放幾個?",
  model: "S43FM703UC",
  answerText:
    "S43FM703UC 為 4K UHD 解析度，桌面資料夾數量主要取決於 Windows 系統圖示大小與縮放設定，在最小圖示下可容納數百個資料夾。",
  sourceTag: "",
  hasManual: true,
  manualRecommended: false,
  webRecommended: false,
});
assert.strictEqual(generalReasoningClean.status, "supported");
assert.strictEqual(generalReasoningClean.expandable, true);

const actions = context.buildEvidenceActionQuickReplies_(unsupported);
assert.deepStrictEqual(
  Array.from(actions, (item) => item.action.label),
  ["📖 查官方手冊", "🌐 再查網路"],
);
assert(actions.every((item) => item.action.type === "postback"));

const handoff = context.buildEvidenceHandoffReply_(unsupported);
assert(/查官方手冊|再查網路/.test(handoff));
assert(!/沒有調諧器|業者可能提供/.test(handoff));

const supported = context.buildFastAnswerEnvelope_({
  originalQuestion: "S32FM902SC 是 OLED 嗎?",
  model: "S32FM902SC",
  answerText: "這款使用 OLED 面板。",
  sourceTag: "[來源:官方規格庫]",
  hasManual: true,
});
assert.strictEqual(supported.status, "supported");
assert.strictEqual(supported.expandable, true);
assert.deepStrictEqual(Array.from(supported.allowedActions), ["elaborate"]);
assert.strictEqual(supported.evidenceRefs.length, 1);

const mixedEvidence = context.buildFastAnswerEnvelope_({
  originalQuestion: "S32FM902SC 是 OLED 嗎，第四台業者有 App 嗎?",
  model: "S32FM902SC",
  answerText: "這款使用 OLED 面板。有些第四台業者可能提供 App。",
  sourceTag: "[來源:官方規格庫]",
  hasManual: true,
});
assert.strictEqual(mixedEvidence.status, "partial");
const safePartial = context.sanitizeUnverifiedExternalClaims_(
  "這款使用 OLED 面板。有些第四台業者可能提供 App。",
);
assert(/OLED/.test(safePartial));
assert(!/業者|App/i.test(safePartial));

const manualEvidence = context.buildAdvancedAnswerEnvelope_(
  "manual",
  "S32FM902SC 如何接第四台",
  "S32FM902SC",
  "手冊第 12 頁說明操作方式。",
  "success",
  [],
);
assert.strictEqual(manualEvidence.status, "supported");
assert.strictEqual(manualEvidence.expandable, true);
assert.strictEqual(
  context.getSourceTagFromEvidenceRefs_(manualEvidence.evidenceRefs),
  "[來源:官方手冊]",
);
const inheritedManual = context.buildFastAnswerEnvelope_({
  originalQuestion: "S32FM902SC 如何接第四台",
  model: "S32FM902SC",
  answerText: "換句話說，先依手冊頁面的連接順序操作。",
  sourceTag: "[來源:官方手冊]",
  inheritedEvidence: true,
  inheritedEvidenceRefs: manualEvidence.evidenceRefs,
  hasManual: true,
});
assert.strictEqual(inheritedManual.status, "supported");
assert.strictEqual(inheritedManual.evidenceRefs[0], manualEvidence.evidenceRefs[0]);

const elaborationStart = linebot.indexOf('if (msg === "#再詳細說明")');
const elaborationEnd = linebot.indexOf("if (\n      msg === \"#搜尋網路\"", elaborationStart);
const elaborationBlock = linebot.slice(elaborationStart, elaborationEnd);
assert(
  elaborationBlock.indexOf("readAnswerEnvelope_(contextId)") <
    elaborationBlock.indexOf("reserveElaborationOnce_"),
  "再詳細說明必須先驗證上一答證據，再保留一次使用權",
);
assert(/上一答無可信證據；再詳細說明零 LLM、零額度/.test(elaborationBlock));
assert(/routingQuestion = previousQuestionForElaboration/.test(elaborationBlock));
assert(!/上一則已經用過一次手冊授權/.test(elaborationBlock));

assert(
  /const operationIntent = isOperationOrTroubleshootQuery\(\s*routingQuestion/.test(
    linebot,
  ),
  "操作意圖只能讀原始問題，不得讀內部補充 prompt",
);
assert(!/action === "confirm_manual"/.test(linebot));
assert(
  /manualEvidenceNotFound \|\|\s*manualEvidenceFailed \|\|\s*recommendedWeb/.test(
    linebot,
  ),
  "手冊無證據或格式驗證失敗必須進自動 Web 補救",
);

const groundedRaw = [
  "1. **外接數位機上盒**：",
  "* 由於 Samsung S32FM902SC M9 具備 HDMI 輸入介面，你可以將第四台業者提供的機上盒透過 HDMI 線連接到螢幕上。",
  "* 連接後，將螢幕輸入源切換到對應 HDMI，即可觀看。",
].join("\n");
const groundedSegment =
  "由於 Samsung S32FM902SC M9 具備 HDMI 輸入介面";
const completeGrounded = context.buildGroundedSupportedAnswer_(
  [groundedSegment],
  "S32FM902SC",
  "M9可以接第四台嗎？",
  groundedRaw,
);
assert(/可以將第四台業者提供的機上盒/.test(completeGrounded));
assert(!/輸入介面$/.test(completeGrounded));
assert.strictEqual(
  context.buildGroundedSupportedAnswer_(
    [groundedSegment],
    "S32FM902SC",
    "M9可以接第四台嗎？",
    "",
  ),
  "",
  "只有半段引用時必須拒絕，不能把半句當成完成答案",
);

console.log("PASS: AnswerEnvelope、再詳細說明與來源按鈕契約");
