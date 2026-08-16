const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const linebot = fs.readFileSync(path.join(root, "linebot.gs"), "utf8");
const testUi = fs.readFileSync(path.join(root, "TestUI.html"), "utf8");
const prompt = fs.readFileSync(path.join(root, "Prompt.csv"), "utf8");
const classRules = fs.readFileSync(path.join(root, "CLASS_RULES.csv"), "utf8");
const menu = JSON.parse(
  fs.readFileSync(
    path.join(root, "docs", "rich_menu", "samsung_source_menu_v1.json"),
    "utf8",
  ),
);
const publishDefaultScript = fs.readFileSync(
  path.join(root, "tools", "publish_rich_menu_default.ps1"),
  "utf8",
);
const rollbackDefaultScript = fs.readFileSync(
  path.join(root, "tools", "rollback_rich_menu_default.ps1"),
  "utf8",
);

const g8AliasLine = classRules
  .split(/\r?\n/)
  .find((line) => /^別稱_G8,/i.test(line));
const g8ModelLines = classRules
  .split(/\r?\n/)
  .filter((line) => /Odyssey\s+(?:OLED\s+|Neo\s+|IPS\s+)?G8(?:\s|,)/i.test(line));
const g8RuleModels = g8ModelLines
  .map((line) => {
    const match = line.match(/型號[：:]\s*([A-Z0-9]+)/i) || line.match(/^(?:L)?(S[A-Z0-9]+),/i);
    return match ? match[1].toUpperCase() : "";
  })
  .filter(Boolean);
assert(
  g8AliasLine && /Odyssey G8/i.test(g8AliasLine) && g8ModelLines.length >= 2,
  "G8 必須由 CLASS_RULES 定義為 Odyssey 系列，且保留多個完整型號候選",
);

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
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
    if (char === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} 大括號不完整`);
}

const aliasVmSource = [
  extractFunction(linebot, "toHalfWidth"),
  extractFunction(linebot, "isShortAliasModelToken"),
  extractFunction(linebot, "extractShortAliasModelTokens"),
  extractFunction(linebot, "extractFullModelLikeTokens"),
  extractFunction(linebot, "normalizeModelForDisplay"),
  extractFunction(linebot, "dedupDisplayModels"),
  extractFunction(linebot, "isClassRuleLineMatchedAlias"),
  extractFunction(linebot, "getAliasCandidatesFromClassRules"),
  extractFunction(linebot, "getAliasOnlySelectionModelsFromQuery"),
  extractFunction(linebot, "stripInternalRoutingHints_"),
  extractFunction(linebot, "normalizeSourceQuestionIdentity_"),
  extractFunction(linebot, "normalizeAdvancedSourceTopicIdentity_"),
  extractFunction(linebot, "isSameRecentSourceQuestion_"),
  extractFunction(linebot, "stripKnownModelFromSourceQuestion_"),
  extractFunction(linebot, "resolveManualSourceModel_"),
  `globalThis.__g8Candidates = getAliasOnlySelectionModelsFromQuery("G8 有耳機孔嗎？", 10, false);`,
  `globalThis.__g8SelectedAgain = getAliasOnlySelectionModelsFromQuery("S27FG812SC G8 有耳機孔嗎？", 10, false);`,
  `globalThis.__sameQuestion = isSameRecentSourceQuestion_("G8 如何連接藍牙耳機?", "S32DG802SC G8 如何連接藍牙耳機？", "S32DG802SC");`,
  `globalThis.__differentQuestion = isSameRecentSourceQuestion_("G8 如何恢復原廠設定?", "S32DG802SC G8 如何連接藍牙耳機？", "S32DG802SC");`,
  `globalThis.__sameQuestionModel = resolveManualSourceModel_("G8 如何連接藍牙耳機?", {previousQuestion:"S32DG802SC G8 如何連接藍牙耳機？", previousModel:"S32DG802SC"}, null, "U1");`,
  `globalThis.__differentQuestionModel = resolveManualSourceModel_("G8 如何恢復原廠設定?", {previousQuestion:"S32DG802SC G8 如何連接藍牙耳機？", previousModel:"S32DG802SC"}, null, "U1");`,
  `globalThis.__reselectQuestion = stripKnownModelFromSourceQuestion_("S32DG802SC G8 如何連接藍牙耳機？", "S32DG802SC");`,
  `globalThis.__sameWebTopic = normalizeAdvancedSourceTopicIdentity_("那你再幫我搜尋一下 S32FM803UC 如何播放 USB？ [System Hint: hidden]", "S32FM803UC") === normalizeAdvancedSourceTopicIdentity_("USB 隨身碟播放怎麼用", "S32FM803UC");`,
].join("\n\n");
const aliasVmContext = {
  SHEET_NAMES: { CLASS_RULES: "CLASS_RULES" },
  ss: {
    getSheetByName() {
      return {
        getDataRange() {
          return {
            getValues() {
              return classRules.split(/\r?\n/).filter(Boolean).map((line) => [line]);
            },
          };
        },
      };
    },
  },
  writeLog() {},
};
vm.runInNewContext(aliasVmSource, aliasVmContext);
assert(
  aliasVmContext.__g8Candidates.includes("S27FG812SC") &&
    aliasVmContext.__g8Candidates.includes("S32DG802SC") &&
    aliasVmContext.__g8Candidates.length === Math.min(g8RuleModels.length, 10) &&
    g8RuleModels
      .slice(0, 10)
      .every((model) => aliasVmContext.__g8Candidates.includes(model)) &&
    !aliasVmContext.__g8Candidates.some((model) => /^M[5789]$/i.test(model)),
  "G8 功能題必須從 Odyssey CLASS_RULES 解析出全部完整型號候選",
);
assert.deepStrictEqual(
  Array.from(aliasVmContext.__g8SelectedAgain),
  [],
  "選完完整型號後不得再次進入 G8 選型迴圈",
);
assert.strictEqual(
  aliasVmContext.__sameQuestion,
  true,
  "同題重打必須忽略已鎖定完整型號與標點差異",
);
assert.strictEqual(aliasVmContext.__differentQuestion, false);
assert.strictEqual(aliasVmContext.__sameQuestionModel, "S32DG802SC");
assert.strictEqual(
  aliasVmContext.__differentQuestionModel,
  "",
  "內容不同的新題不得借用 previousModel",
);
assert.strictEqual(
  aliasVmContext.__reselectQuestion,
  "G8 如何連接藍牙耳機？",
  "換型號時保留問題但必須移除字串內的舊完整型號",
);
assert.strictEqual(
  aliasVmContext.__sameWebTopic,
  true,
  "同型號同意圖改寫不得重複送出 Web／PDF 供應商請求",
);

const exactRuleCache = new Map();
const exactRuleVmSource = [
  extractFunction(linebot, "toHalfWidth"),
  extractFunction(linebot, "isShortAliasModelToken"),
  extractFunction(linebot, "extractFullModelLikeTokens"),
  extractFunction(linebot, "normalizeModelForDisplay"),
  extractFunction(linebot, "dedupDisplayModels"),
  extractFunction(linebot, "findExactModelRuleLine_"),
  extractFunction(linebot, "getExplicitCapabilityCheck_"),
  extractFunction(linebot, "enforceExactModelCapabilityEvidence_"),
  extractFunction(linebot, "buildMissingExactRuleFactReply_"),
  extractFunction(linebot, "buildDeterministicExactRuleReply_"),
  `globalThis.__kvmGuarded = enforceExactModelCapabilityEvidence_("G8 有 KVM 嗎？ (型號: S32HG806ES)", "有，S32HG806ES 內建 KVM Switch。");`,
  `globalThis.__headphonePreserved = enforceExactModelCapabilityEvidence_("那它有耳機孔嗎？ (型號: S32HG806ES)", "有，S32HG806ES 具備耳機孔。");`,
  `globalThis.__m7HdmiExact = buildDeterministicExactRuleReply_("M7 有幾個 HDMI 埠？", "S32FM703UC");`,
  `globalThis.__m7HdmiMissing = buildMissingExactRuleFactReply_("M7 有幾個 HDMI 埠？", "S27CM703UC");`,
].join("\n\n");
const exactRuleVmContext = {
  SHEET_NAMES: { CLASS_RULES: "CLASS_RULES" },
  ss: {
    getSheetByName() {
      const rows = classRules.split(/\r?\n/).filter(Boolean).map((line) => [line]);
      return {
        getLastRow() { return rows.length + 1; },
        getRange() { return { getValues() { return rows; } }; },
      };
    },
  },
  CacheService: {
    getScriptCache() {
      return {
        get(key) { return exactRuleCache.get(key) || null; },
        put(key, value) { exactRuleCache.set(key, String(value)); },
      };
    },
  },
  writeLog() {},
};
vm.runInNewContext(exactRuleVmSource, exactRuleVmContext);
assert(
  /沒有列出「KVM」/.test(exactRuleVmContext.__kvmGuarded) &&
    !/內建 KVM Switch/.test(exactRuleVmContext.__kvmGuarded),
  "通用術語_KVM 不得變成 S32HG806ES 的型號能力證據",
);
assert.strictEqual(
  exactRuleVmContext.__headphonePreserved,
  "有，S32HG806ES 具備耳機孔。",
  "完整型號規格明載耳機孔時不得被能力守門誤擋",
);
assert(
  /S32FM703UC 這款有 2 個 HDMI 2\.0 連接埠/.test(
    exactRuleVmContext.__m7HdmiExact,
  ),
  "M7 選定 S32FM703UC 後必須由精確 RULE 零模型回答 HDMI 數量",
);
assert(
  /S27CM703UC/.test(exactRuleVmContext.__m7HdmiMissing) &&
    /不想拿其他同系列型號套過來猜/.test(
      exactRuleVmContext.__m7HdmiMissing,
    ) &&
    /查手冊/.test(exactRuleVmContext.__m7HdmiMissing),
  "精確型號 RULE 未明載 HDMI 時必須零模型停止猜測並建議手冊",
);

assert(
  /const MAX_ELABORATE_PER_ANSWER = 1;/.test(linebot) &&
    /function reserveElaborationOnce_/.test(linebot) &&
    /if \(text === "#再詳細說明"\) return false;/.test(linebot) &&
    /一次性再詳細說明已使用；零 LLM、零額度/.test(linebot) &&
    /incomingMessageWasElaboration && elaborationOriginalQuestion/.test(linebot) &&
    /!isWaitingForModelSelection[\s\S]{0,100}!manualSourceRecommended[\s\S]{0,100}!webSourceRecommended/.test(
      linebot,
    ) &&
    /補充生成失敗，釋放一次性使用權/.test(linebot),
  "再詳細說明必須每個答案只能一次、零一般額度並保留原題",
);
assert(
  /const isPlainModelClarification = Boolean\(/.test(linebot) &&
    /\[Model Clarification v29\.6\.158\]/.test(linebot) &&
    /cache\.put\(`\$\{userId\}:pending_topic`, msg, 600\);/.test(linebot) &&
    /resumedFromPlainModelClarification/.test(linebot),
  "系統請使用者補型號後，直接輸入完整型號也必須接回原題且不重複扣額度",
);

const directDeepRouteText = linebot.slice(
  linebot.indexOf("const directSearchResult = checkDirectDeepSearchWithKey"),
  linebot.indexOf("// 智慧退出：簡單問題不需要 PDF"),
);
assert(
  /currentExplicitModels/.test(directDeepRouteText) &&
    /directSearchResult\.models = currentExplicitModels\.slice\(\)/.test(directDeepRouteText) &&
    /DirectDeep Exact Model Guard/.test(directDeepRouteText),
  "選定完整型號後 DirectDeep/PDF 候選必須只保留本輪完整型號，不得重新展開 G8 系列",
);
assert(
  /exactCapabilityIntroMatch/.test(linebot) &&
    /const verifiedRuleIntro = bluetoothRuleIntro \|\|/.test(linebot) &&
    /buildManualConsentPrompt_\(\s*verifiedRuleIntro/.test(linebot),
  "精確型號能力守門結論必須保留到最終手冊授權泡泡，不得被泛用模板洗掉",
);
assert(
  /!manualSourceRecommended &&\s*webSourceRecommended &&\s*canOfferAnotherWebSearch_/.test(
      linebot,
    ) &&
    /if \(\s*manualSourceRecommended &&\s*!alreadyConsultedPdf/.test(linebot) &&
    !/\(hasPdfForModel \|\| manualSourceRecommended\)/.test(linebot),
  "正在建議手冊時不得同輪提前顯示 Web 搜尋；手冊無證據後才可進 Web",
);

const doPostText = extractFunction(linebot, "doPost");
assert(
  doPostText.indexOf("handleRichMenuPostback_(event)") <
    doPostText.indexOf("ensureSyncTriggerExists()"),
  "postback 必須早於 Trigger 自癒與一般路由",
);
assert(
  /if \(FAST_POSTBACK_HANDLED\)[\s\S]{0,120}PENDING_LOGS = \[\]/.test(doPostText),
  "純提示 postback 不得在 finally 觸碰 Sheet log flush",
);

const generalRouterStart = linebot.indexOf("// D. 一般對話");
assert(generalRouterStart >= 0, "找不到一般對話路由");
const aliasLookupBeforeQaIndex = linebot.indexOf(
  "const aliasSelectionBeforeQa",
  generalRouterStart,
);
const directQaIndex = linebot.indexOf(
  "const directLocalQa = findLocalMatchInQA(msg, userId)",
  generalRouterStart,
);
const aliasGateIndex = linebot.indexOf(
  "shouldPromptAliasModelSelection_(msg, aliasSelectionBeforeQa)",
  directQaIndex,
);
const historyIndex = linebot.indexOf(
  "const history = getHistoryFromCacheOrSheet(contextId)",
  directQaIndex,
);
const freshOperationGuardIndex = linebot.indexOf(
  "const freshOperationNeedsModel",
  directQaIndex,
);
const generalRouterText = linebot.slice(generalRouterStart, historyIndex + 200);
assert(
  aliasLookupBeforeQaIndex >= 0 &&
    aliasLookupBeforeQaIndex < directQaIndex &&
    aliasGateIndex > directQaIndex &&
    aliasGateIndex < historyIndex &&
    /doesQaMatchCoverQueryAliases_\(msg, directLocalQa\.question\)/.test(
      generalRouterText,
    ) &&
    /promptAliasOnlyModelSelection\([\s\S]{0,180}"fast"/.test(generalRouterText),
  "系列別稱型號題必須在泛用 QA／RULE 前先完成實體一致檢查並顯示完整型號選單",
);
assert(
  freshOperationGuardIndex > directQaIndex &&
    freshOperationGuardIndex < historyIndex &&
    /freshOperationNeedsModel[\s\S]{0,900}markDailyQuestionModelSelectionHold_\(userId\)[\s\S]{0,900}replyMessage\(replyToken, needModelReply\)[\s\S]{0,400}return;/.test(
      generalRouterText,
    ),
  "精準 QA 未命中的無型號操作／跨裝置題必須在 Fast 前零 LLM 進入 ASK_MODEL",
);
const aliasCandidateText = extractFunction(
  linebot,
  "getAliasOnlySelectionModelsFromQuery",
);
assert(
  /requirePdfCoverage\s*=\s*true/.test(aliasCandidateText) &&
    /getAliasCandidatesFromExistingPdfs/.test(aliasCandidateText) &&
    /getAliasCandidatesFromClassRules/.test(aliasCandidateText) &&
    /extractFullModelLikeTokens\(text\)\.length\s*>\s*0/.test(
      aliasCandidateText,
    ),
  "Fast Mode 必須從 CLASS_RULES 列系列候選；選完完整型號後不得再次進入選型迴圈",
);
const postbackText = extractFunction(linebot, "handleRichMenuPostback_");
assert(
  /action === "select_manual_model"/.test(postbackText) &&
    /`\$\{selectedModel\} \$\{state\.draftQuery\}`/.test(postbackText) &&
    /executeAdvancedSourceQuery_/.test(postbackText),
  "手冊型號選定後必須把完整型號鎖回原題並直接續跑同一手冊流程",
);
assert(
  /action === "reselect_manual_model"/.test(postbackText) &&
    /previousModel:\s*""/.test(postbackText) &&
    /stripKnownModelFromSourceQuestion_/.test(postbackText) &&
    /draftQuery:\s*retainedQuestion/.test(postbackText) &&
    /這一步不讀手冊，也不扣任何次數/.test(postbackText),
  "換型號必須保留原問題、清除舊型號，且零來源呼叫零扣次",
);

const llmText = extractFunction(linebot, "callLLMWithRetry");
const targetedPdfRefreshText = extractFunction(
  linebot,
  "refreshStalePdfAttachmentsFromDrive_",
);
const manualModelResolverText = extractFunction(
  linebot,
  "resolveManualSourceModel_",
);
assert(
  manualModelResolverText.includes("extractFullModelLikeTokens") &&
    manualModelResolverText.includes("state.usePrevious") &&
    manualModelResolverText.includes("state.previousModel") &&
    manualModelResolverText.includes("readSourceProductState_") &&
    manualModelResolverText.includes("extractShortAliasModelTokens") &&
    !manualModelResolverText.includes("last_selected_model") &&
    !manualModelResolverText.includes("direct_search_models"),
  "已確認型號必須跨日保留；新完整型號取代、短系列名則重新列候選",
);
assert(
  /function getManualSourceCandidateModels_/.test(linebot) &&
    /getAliasOnlySelectionModelsFromQuery/.test(
      extractFunction(linebot, "getManualSourceCandidateModels_"),
    ) &&
    /manualModelCandidates/.test(linebot) &&
    /rm_action=select_manual_model/.test(linebot),
  "手冊新題必須支援系列／前段型號候選與同源 postback 選型",
);
assert(
  /選型號前不讀手冊、不扣次/.test(linebot) &&
    /你不用輸入完整型號/.test(linebot),
  "候選選型前必須零扣次，且不得強迫使用者自行找完整型號",
);
assert(
  llmText.indexOf("assertAdvancedSourceGrant_") <
    llmText.indexOf('getProperty("GEMINI_API_KEY")'),
  "PDF/Web 必須在載入供應商設定前驗證本輪來源授權",
);
assert(
  llmText.indexOf("reserveAdvancedSourceUsage_(advancedGrant)") <
    llmText.indexOf(":generateContent?key="),
  "配額必須在 generateContent 前原子保留",
);
assert(
  /refreshStalePdfAttachmentsFromDrive_\(filesToAttach\)/.test(llmText) &&
    llmText.indexOf("refreshStalePdfAttachmentsFromDrive_(filesToAttach)") <
      llmText.indexOf("reserveAdvancedSourceUsage_(advancedGrant)") &&
    /persistManualPdfKbItem_\(refreshedItem\)/.test(targetedPdfRefreshText) &&
    /wantedNames\[upperName\]/.test(targetedPdfRefreshText),
  "過期手冊必須只按本題檔名更新，重跑預檢成功後才扣額度",
);
assert(
  /if \(!evidenceCorrectionAttempted\)/.test(llmText) &&
    /targetModelName,[\s\S]*?true,[\s\S]*?webGroundingRetryAttempted/.test(
      llmText,
    ),
  "單檔修復只允許嘗試一次，避免過期 URI 無限重送",
);
assert(
  /SOURCE_DAILY_LIMITS\s*=\s*\{\s*manual:\s*5,\s*web:\s*10\s*\}/.test(linebot),
  "手冊 5 次、網路 10 次額度不可漂移",
);
assert(
  /PDF_INPUT_SOFT_WARNING_TOKENS:\s*20000/.test(linebot) &&
    /MAX_LEGACY_PDF_INPUT_TOKENS:\s*100000/.test(linebot) &&
    /PDF Mode 只保留本輪完整問題/.test(linebot),
  "官方手冊不得再被舊 20K 任意上限終止；仍須保留可解釋的 100K 單次成本硬上限",
);
assert(
  /USER_DAILY_QUESTION_LIMIT\s*=\s*20/.test(linebot) &&
    /function reserveDailyQuestionUsage_/.test(linebot) &&
    /getUserLock\(\)/.test(extractFunction(linebot, "reserveDailyQuestionUsage_")) &&
    /USR_QDAY_/.test(linebot),
  "每位使用者每日 20 次提問必須持久化並以鎖原子保留",
);
const dailyQuestionClassifierText = extractFunction(
  linebot,
  "shouldCountDailyQuestionText_",
);
assert(
  /if \(explicitSource\) return false/.test(dailyQuestionClassifierText) &&
    /if \(pending\) return false/.test(
      dailyQuestionClassifierText,
    ) &&
    /\^#型號:/.test(dailyQuestionClassifierText) &&
    /refundDailyQuestionUsage_/.test(linebot) &&
    /fast_to_\$\{manualSourceRecommended \? "manual" : "web"\}/.test(linebot) &&
    !/const dailyQuota = reserveDailyQuestionOrReply_/.test(
      extractFunction(linebot, "handleRichMenuPostback_"),
    ),
  "手冊／網路不得重複扣一般 20 題；只引導手冊時必須退回一般額度",
);
assert(
  /function getSourceProductKey_/.test(linebot) &&
    /function rememberSourceProductModel_/.test(linebot) &&
    /function readSourceProductState_/.test(linebot) &&
    /explicitModel \|\| \(productState \? productState\.model : ""\)/.test(
      extractFunction(linebot, "rememberRecentSourceQuestion_"),
    ) &&
    /buildCanonicalWebQuery_/.test(
      extractFunction(linebot, "executeAdvancedSourceQuery_"),
    ),
  "手冊／網路追問必須使用同一份跨日產品狀態並把完整型號帶入查詢",
);
assert(
  /額度鎖忙碌，fail closed/.test(linebot) &&
    /這次沒有計入提問次數，也沒有送出付費查詢/.test(linebot),
  "提問額度鎖忙碌不得 Fatal，必須零計次、零供應商並友善回覆",
);
assert(
  /function tryManualFreeLocalAnswer_/.test(linebot) &&
    /findLocalMatchInQA/.test(extractFunction(linebot, "tryManualFreeLocalAnswer_")) &&
    /未讀取手冊/.test(extractFunction(linebot, "tryManualFreeLocalAnswer_")) &&
    /reserved:\s*false/.test(extractFunction(linebot, "tryManualFreeLocalAnswer_")),
  "手冊模式必須先做高信心 QA/RULE 預檢，命中時零 PDF、零手冊扣點",
);
assert(
  /本次約 \$\{customerCost\}/.test(linebot) &&
    /直接問 \$\{CURRENT_DAILY_QUESTION_REMAINING\}\/\$\{USER_DAILY_QUESTION_LIMIT\}/.test(linebot) &&
    /advancedSource === "manual" \? "手冊" : "網搜"/.test(linebot) &&
    /currentRequestAudit\.estimatedCostTwd/.test(
      extractFunction(linebot, "buildReplyCostAuditText_"),
    ),
  "正式 LINE 必須顯示簡版合計費用與今日剩餘，詳細 token 僅留稽核",
);
assert(
  /SOURCE_PENDING_TTL_SECONDS\s*=\s*600/.test(linebot) &&
    /SOURCE_RECENT_QUESTION_TTL_SECONDS\s*=\s*1800/.test(linebot) &&
    /PropertiesService\.getScriptProperties\(\)\.setProperty/.test(
      extractFunction(linebot, "rememberSourceProductModel_"),
    ),
  "pending 10 分鐘、上一題 30 分鐘，已確認型號另以持久狀態跨日保存",
);
assert(
  /if \(manualSourceRecommended\) \{[\s\S]*?forcedModelSelectionTrigger = false;[\s\S]*?forcedSopNeedsModelSelection = false;[\s\S]*?buildManualConsentPrompt_/.test(
    linebot,
  ),
  "完整型號已鎖定時必須清除缺型號旗標並恢復手冊推薦",
);

const propertyValues = new Map();
const cacheValues = new Map();
let taipeiDate = "20260814";
const cache = {
  get: (key) => cacheValues.get(key) || null,
  put: (key, value) => cacheValues.set(key, String(value)),
  remove: (key) => cacheValues.delete(key),
};
const props = {
  getProperty: (key) => propertyValues.get(key) || null,
  setProperty: (key, value) => propertyValues.set(key, String(value)),
  deleteProperty: (key) => propertyValues.delete(key),
  getProperties: () => Object.fromEntries(propertyValues.entries()),
};
const context = {
  SOURCE_PENDING_TTL_SECONDS: 600,
  SOURCE_RECENT_QUESTION_TTL_SECONDS: 1800,
  SOURCE_OPERATION_CACHE_TTL_SECONDS: 600,
  SOURCE_DAILY_LIMITS: { manual: 5, web: 10 },
  USER_DAILY_QUESTION_LIMIT: 20,
  CURRENT_DAILY_QUESTION_REMAINING: null,
  Utilities: {
    DigestAlgorithm: { SHA_256: "sha256" },
    computeDigest: (_algorithm, value) => [...crypto.createHash("sha256").update(value).digest()],
    formatDate: () => taipeiDate,
  },
  CacheService: { getScriptCache: () => cache },
  PropertiesService: { getScriptProperties: () => props },
  LockService: {
    getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }),
    getUserLock: () => ({ tryLock: () => true, releaseLock: () => {} }),
  },
  writeLog: () => {},
};
vm.createContext(context);
vm.runInContext(
  [
    extractFunction(linebot, "toHalfWidth"),
    extractFunction(linebot, "isShortAliasModelToken"),
    extractFunction(linebot, "normalizeModelForDisplay"),
    extractFunction(linebot, "stripInternalRoutingHints_"),
    extractFunction(linebot, "normalizeSourceQuestionIdentity_"),
    extractFunction(linebot, "normalizeAdvancedSourceTopicIdentity_"),
    extractFunction(linebot, "getSourceContextHash_"),
    extractFunction(linebot, "getSourceDateKey_"),
    extractFunction(linebot, "getSourcePendingKey_"),
    extractFunction(linebot, "getSourceRecentKey_"),
    extractFunction(linebot, "getSourceQuotaKey_"),
    extractFunction(linebot, "getDailyQuestionQuotaKey_"),
    extractFunction(linebot, "getSourceProductKey_"),
    extractFunction(linebot, "parseSourceStateJson_"),
    extractFunction(linebot, "readSourceProductState_"),
    extractFunction(linebot, "rememberSourceProductModel_"),
    extractFunction(linebot, "rememberSourceLastAdvanced_"),
    extractFunction(linebot, "clearSourceProductState_"),
    extractFunction(linebot, "writePendingSourceState_"),
    extractFunction(linebot, "readPendingSourceState_"),
    extractFunction(linebot, "clearPendingSourceState_"),
    extractFunction(linebot, "readSourceQuota_"),
    extractFunction(linebot, "getSourceRemaining_"),
    extractFunction(linebot, "reserveAdvancedSourceUsage_"),
    extractFunction(linebot, "refundAdvancedSourceUsage_"),
    extractFunction(linebot, "getAdvancedSourceOperationKey_"),
    extractFunction(linebot, "beginAdvancedSourceOperation_"),
    extractFunction(linebot, "finishAdvancedSourceOperation_"),
    extractFunction(linebot, "clearAdvancedSourceOperation_"),
    extractFunction(linebot, "readDailyQuestionUsage_"),
    extractFunction(linebot, "getDailyQuestionRemaining_"),
    extractFunction(linebot, "reserveDailyQuestionUsage_"),
    extractFunction(linebot, "refundDailyQuestionUsage_"),
  ].join("\n\n"),
  context,
);

for (let index = 0; index < 5; index += 1) {
  context.reserveAdvancedSourceUsage_({ source: "manual", contextId: "C1" });
}
assert.strictEqual(context.getSourceRemaining_("C1", "manual"), 0);
assert.throws(
  () => context.reserveAdvancedSourceUsage_({ source: "manual", contextId: "C1" }),
  /SOURCE_QUOTA_EXHAUSTED_MANUAL/,
  "第 6 次手冊查詢必須被擋下",
);
for (let index = 0; index < 10; index += 1) {
  context.reserveAdvancedSourceUsage_({ source: "web", contextId: "C1" });
}
assert.strictEqual(context.getSourceRemaining_("C1", "web"), 0);
taipeiDate = "20260815";
assert.strictEqual(context.getSourceRemaining_("C1", "manual"), 5);
assert.strictEqual(context.getSourceRemaining_("C1", "web"), 10);

for (let index = 0; index < 20; index += 1) {
  const result = context.reserveDailyQuestionUsage_("U1");
  assert.strictEqual(result.allowed, true);
}
assert.strictEqual(context.getDailyQuestionRemaining_("U1"), 0);
assert.strictEqual(context.reserveDailyQuestionUsage_("U1").allowed, false);
assert.strictEqual(
  context.getDailyQuestionRemaining_("U2"),
  20,
  "提問額度必須按使用者分開，不得由群組共用",
);
taipeiDate = "20260816";
assert.strictEqual(context.getDailyQuestionRemaining_("U1"), 20);
context.reserveDailyQuestionUsage_("U3");
assert.strictEqual(context.getDailyQuestionRemaining_("U3"), 19);
context.refundDailyQuestionUsage_("U3", "contract_test");
assert.strictEqual(
  context.getDailyQuestionRemaining_("U3"),
  20,
  "只引導進階來源時必須可原子退回一般提問額度",
);

context.rememberSourceProductModel_("C3", "S32FM803UC");
cache.remove(context.getSourceProductKey_("C3"));
assert.strictEqual(
  context.readSourceProductState_("C3").model,
  "S32FM803UC",
  "已確認完整型號必須由持久屬性跨快取／跨日保存",
);
context.rememberSourceLastAdvanced_("C3", "manual");
assert.strictEqual(context.readSourceProductState_("C3").lastSource, "manual");

const operation = context.beginAdvancedSourceOperation_(
  "C3",
  "manual",
  "如何播放 USB？",
  "S32FM803UC",
);
assert.strictEqual(operation.allowed, true);
context.finishAdvancedSourceOperation_(operation, "已核對第 97 頁", "S32FM803UC");
const duplicateOperation = context.beginAdvancedSourceOperation_(
  "C3",
  "manual",
  "如何播放USB",
  "S32FM803UC",
);
assert.strictEqual(duplicateOperation.allowed, false);
assert.strictEqual(duplicateOperation.status, "done");
assert.strictEqual(duplicateOperation.finalText, "已核對第 97 頁");
context.clearSourceProductState_("C3");
assert.strictEqual(context.readSourceProductState_("C3"), null);

const pending = context.writePendingSourceState_("C2", { source: "manual" });
pending.expiresAt = Date.now() - 1;
const pendingKey = context.getSourcePendingKey_("C2");
cache.put(pendingKey, JSON.stringify(pending));
props.setProperty(pendingKey, JSON.stringify(pending));
assert.strictEqual(context.readPendingSourceState_("C2", false), null);

assert(/function testSourcePostback\(/.test(linebot), "TestUI 有正式 postback 模擬入口");
assert(
  /selectSource\('manual'\)/.test(testUi) &&
    /confirmManualSource\(\)/.test(testUi) &&
    /runSourcePostback\("confirm_manual", "manual"\)/.test(testUi),
  "TestUI 可按三來源，手冊以確認要查授權且網路不二次確認",
);
assert(
  /id="reselect-manual-model"/.test(testUi) &&
    /function reselectManualModel\(\)/.test(testUi) &&
    /runSourcePostback\("reselect_manual_model", "manual"\)/.test(testUi) &&
    /hasPreviousModel/.test(linebot),
  "TestUI 必須能走與正式 webhook 相同的情境式換型號 postback",
);
assert(
  /source-model-bar/.test(testUi) &&
    /select_manual_model/.test(testUi) &&
    /modelCandidates/.test(testUi),
  "TestUI 必須能顯示並點選手冊候選型號",
);
assert(
  /modelSelectionMode:\s*mode \|\| "pdf"/.test(
    extractFunction(linebot, "promptAliasOnlyModelSelection"),
  ) &&
    /markDailyQuestionModelSelectionHold_\(userId\)/.test(
      extractFunction(linebot, "promptAliasOnlyModelSelection"),
    ) &&
    /modelSelectionMode === "manual"/.test(testUi) &&
    /addToQueue\("#型號:" \+ model\)/.test(testUi),
  "一般 G8 選型必須在 TestUI 顯示候選並走同一個 #型號 訊息 router",
);
const modelHoldOccurrences = (
  linebot.match(/markDailyQuestionModelSelectionHold_\(userId\)/g) || []
).length;
const consentSelectionStart = linebot.indexOf(
  '} else if (modelSelectMode === "consent")',
);
const consentSelectionText = linebot.slice(
  consentSelectionStart,
  consentSelectionStart + 1800,
);
assert(
  modelHoldOccurrences >= 2 &&
    /consumeDailyQuestionModelSelectionHold_\(userId\)/.test(
      consentSelectionText,
    ) &&
    consentSelectionText.indexOf("refundDailyQuestionUsage_") <
      consentSelectionText.indexOf("replyMessage("),
  "後段 Smart Router 選型也必須保留計次；consent 只導向手冊時立即退回一般額度",
);
assert.strictEqual(menu.size.width, 2500);
assert.strictEqual(menu.size.height, 843);
assert.strictEqual(menu.areas.length, 3);
assert.strictEqual(menu.areas.reduce((sum, area) => sum + area.bounds.width, 0), 2500);
assert(menu.areas.every((area) => area.action.type === "postback" && !area.action.displayText));
assert(menu.selected === true, "Rich Menu 必須在進入聊天室時預設展開");
assert(
  menu.chatBarText === "先提問・再查證",
  "聊天列必須直接告訴新使用者先提問、需要時再查證",
);
assert(
  menu.areas[0].action.inputOption === "openKeyboard" &&
    menu.areas.slice(1).every((area) => area.action.inputOption === "openRichMenu"),
  "直接提問需開鍵盤；兩個重查入口需保持 Rich Menu 展開",
);
assert(
  /source-menu-title">直接問</.test(testUi) &&
    /source-menu-quota">20題\/日</.test(testUi) &&
    /source-menu-title">查手冊</.test(testUi) &&
    /source-menu-quota">5次\/日</.test(testUi) &&
    /source-menu-title">搜網路</.test(testUi) &&
    /source-menu-quota">10次\/日</.test(testUi),
  "TestUI 必須用雙排大字呈現功能與每日額度",
);
for (const manualText of [
  fs.readFileSync(path.join(root, "Developer_Manual.md"), "utf8"),
  fs.readFileSync(path.join(root, "程式編寫開發及功能手冊.md"), "utf8"),
]) {
  assert(
      /三來源使用者旅程與不可回歸矩陣/.test(manualText) &&
      /\| R01 \|/.test(manualText) &&
      /\| R24 \|/.test(manualText) &&
      /手冊 → 網路 → 再手冊/.test(manualText) &&
      /按鍵即授權與執行/.test(manualText),
    "開發手冊必須保存完整三來源流程矩陣與換型號例外",
  );
}
assert(
  /min-height:\s*124px/.test(testUi) &&
    /\.source-menu-title[\s\S]{0,180}font-size:\s*19px/.test(testUi) &&
    /\.source-menu-quota[\s\S]{0,180}font-size:\s*16px/.test(testUi) &&
    !/source-menu-subtitle/.test(testUi),
  "TestUI 下方三格必須保留雙排大字與足夠觸控高度",
);
assert(
  /function provisionRichMenuDefault_/.test(linebot) &&
    /user\/all\/richmenu\/\$\{encodeURIComponent\(richMenuId\)\}/.test(linebot) &&
    /Default rich menu readback mismatch/.test(linebot),
  "全體 Rich Menu 發布必須設定 default 並讀回確認",
);
assert(
  /RICH_MENU_GLOBAL_PREVIOUS_ID/.test(linebot) &&
    /function rollbackRichMenuDefault_/.test(linebot) &&
    /rollback readback mismatch/.test(linebot),
  "全體 Rich Menu 必須保存舊 default 並提供讀回式回復",
);
assert(
  /provision_rich_menu_default/.test(publishDefaultScript) &&
    /rollback_rich_menu_default/.test(rollbackDefaultScript),
  "全體 Rich Menu 發布與回復腳本必須存在",
);
const gasVersionMatch = linebot.match(
  /const\s+GAS_VERSION\s*=\s*"(v\d+\.\d+\.\d+)"/,
);
assert(gasVersionMatch, "linebot.gs 必須宣告 GAS_VERSION");
assert(
  prompt.includes(`【Prompt ${gasVersionMatch[1]}】`),
  "Prompt.csv 版本必須與 linebot.gs GAS_VERSION 一致",
);
assert(
  !/一次受控的非官方 Web 補救|補救不扣使用者網搜額度|不得再次重試或跨回 PDF/.test(
    prompt,
  ) && /標記只代表建議下一來源，不代表已執行/.test(prompt),
  "Prompt 不得承擔 PDF/Web 補救狀態機；只可輸出來源建議",
);

const webCanonicalText = extractFunction(linebot, "buildCanonicalWebQuery_");
const advancedRouteText = extractFunction(linebot, "executeAdvancedSourceQuery_");
const handleMessageStart = linebot.indexOf("function handleMessage(event)");
const handleMessageEnd = linebot.indexOf(
  "function handleDeepSearch(",
  handleMessageStart,
);
assert(handleMessageStart >= 0 && handleMessageEnd > handleMessageStart);
const handleMessageText = linebot.slice(handleMessageStart, handleMessageEnd);
assert(
  /stripInternalRoutingHints_\(query\)/.test(webCanonicalText) &&
    /台灣 非官方 公開網頁 實務解法 -site:samsung\.com/.test(
      webCanonicalText,
    ) &&
    /isSamsungOfficialGroundingChunk_/.test(linebot) &&
    /nonOfficialGroundingSupports/.test(linebot),
  "Web provider query 必須剝除 System Hint、排除 Samsung 網域，且只接受非官方證據 support",
);
assert(
  /tools\s*=\s*\[\{ google_search: \{\} \}\]/.test(llmText) &&
    !/url_context/.test(llmText) &&
    !/getOfficialUrlContextCandidates\(query\)/.test(llmText),
  "網路來源不得讀 Samsung 官網或 URL Context；官網只能保留客戶可點連結",
);
assert(
  /最多 5 點/.test(linebot) &&
    /450 個中文字內/.test(linebot) &&
    /禁止加入 Windows USB 選擇性暫停/.test(linebot) &&
    /不建議從非官方來源下載螢幕韌體/.test(linebot),
  "Web 回答必須聚焦、完整收尾，且內建 USB 播放不得混入電腦端排錯或非官方韌體",
);
assert(
  !/refundAdvancedSourceUsage_\(grant,\s*"web_no_verifiable_evidence"\)/.test(
    advancedRouteText,
  ) &&
    /buildTentativeWebFallback_/.test(advancedRouteText) &&
    /本次已啟動網路搜尋，但 Google 沒有回傳可核對連結/.test(linebot),
  "Web 已送供應商但無引用時仍須計一次，且不得用退款繞過成本上限",
);
assert(
  /function isExplicitNonOfficialWebRequest_/.test(linebot) &&
    /refundDailyQuestionUsage_\(userId, "explicit_web_request"\)/.test(
      handleMessageText,
    ) &&
    handleMessageText.indexOf("isExplicitNonOfficialWebRequest_(msg)") <
      handleMessageText.indexOf("每題都先走 Fast Mode"),
  "自然問句已明確要求非官方 Web 時，必須在 Fast LLM 前零成本顯示授權入口並退一般額度",
);
assert(
  /LAST_SOURCE_TEST_STATE\.source/.test(
    extractFunction(linebot, "renderCustomerFacingText_"),
  ) && /executed === "verified_manual_chunk"/.test(linebot),
  "人工核對手冊片段也必須走統一來源／NT$0.0000／剩餘額度尾註",
);
const verifiedManualVm = {
  isPdfModelTokenMatch_: (item, model) =>
    String(model).toUpperCase().startsWith(String(item).toUpperCase()),
  isRetailModeManualQuery_: () => false,
  isUsbMediaPlaybackManualQuery_: (text) => /USB/i.test(String(text)),
  isBluetoothAudioOperationQuery_: (text) =>
    /(?:藍牙|Bluetooth).*(?:喇叭|耳機)|(?:喇叭|耳機).*(?:藍牙|Bluetooth)/i.test(
      String(text),
    ) && /(?:如何|怎麼|連接|配對|設定)/i.test(String(text)),
};
vm.createContext(verifiedManualVm);
vm.runInContext(
  `${extractFunction(linebot, "getVerifiedManualChunks_")}\n${extractFunction(linebot, "isVerifiedManualEvidenceQuery_")}\n${extractFunction(linebot, "findVerifiedManualChunk_")}\n${extractFunction(linebot, "buildVerifiedManualChunkReply_")}\n` +
    `globalThis.hit = findVerifiedManualChunk_("S32HG806ES 如何切換 6K 165Hz 和 3K 330Hz 雙模？", "S32HG806ES");\n` +
    `globalThis.wrongModel = findVerifiedManualChunk_("如何切換 Dual Mode？", "S32HG802SC");\n` +
    `globalThis.usbHowTo = findVerifiedManualChunk_("如何播放 USB？", "S32FM803UC");\n` +
    `globalThis.usbFailure = findVerifiedManualChunk_("USB 播放時常斷線，網路上有沒有非官方解法？", "S32FM803UC");\n` +
    `globalThis.bluetoothHowTo = findVerifiedManualChunk_("怎麼連接藍牙喇叭？", "S32FM803UC");\n` +
    `globalThis.bluetoothWrongModel = findVerifiedManualChunk_("怎麼連接藍牙喇叭？", "S32DM803UC");\n` +
    `globalThis.bluetoothReply = buildVerifiedManualChunkReply_("S32FM803UC", globalThis.bluetoothHowTo);`,
  verifiedManualVm,
);
assert(
  verifiedManualVm.hit &&
    verifiedManualVm.hit.intent === "DUAL_MODE" &&
    verifiedManualVm.hit.pages === "27、35、43" &&
    verifiedManualVm.wrongModel === null &&
    verifiedManualVm.usbHowTo &&
    verifiedManualVm.usbFailure === null &&
    verifiedManualVm.bluetoothHowTo &&
    verifiedManualVm.bluetoothHowTo.intent === "BLUETOOTH_AUDIO" &&
    verifiedManualVm.bluetoothHowTo.pages === "151" &&
    verifiedManualVm.bluetoothWrongModel === null &&
    /音效輸出 → 藍牙揚聲器清單/.test(verifiedManualVm.bluetoothReply) &&
    /第 151 頁/.test(verifiedManualVm.bluetoothReply) &&
    /\[來源:官方手冊\]/.test(verifiedManualVm.bluetoothReply),
  "手冊片段須精準匹配型號與意圖：M8 藍牙題須回第 151 頁；錯型號與 USB 故障題不得借用",
);
assert(
  /查官方手冊確認/.test(linebot) &&
    !/官方手冊」再點「確認要查/.test(linebot) &&
    /選完就會直接查，不會再問一次/.test(linebot) &&
    /Manual Authorization v29\.6\.160/.test(
      extractFunction(linebot, "executeAdvancedSourceQuery_"),
    ) &&
    !/confirmationReady:\s*true/.test(
      extractFunction(linebot, "executeAdvancedSourceQuery_"),
    ),
  "手冊按鍵必須是單次授權；缺型號只選型，不得形成第二次確認迴圈",
);
assert(
  /systemRescue:\s*true/.test(
    extractFunction(linebot, "runManualWebRescue_"),
  ) &&
    /userWebQuotaCharged=0/.test(linebot) &&
    /SOURCE_DAILY_SYSTEM_WEB_RESCUE_LIMIT\s*=\s*3/.test(linebot) &&
    /buildTentativeManualFallback_/.test(advancedRouteText),
  "PDF 無證據後只能自動補搜一次受控 Web；不扣使用者網搜額度，且仍須提供保守參考方向",
);
const exactComparisonText = extractFunction(
  linebot,
  "buildExactRuleComparisonReply_",
);
assert(
  /models\.length !== 2/.test(exactComparisonText) &&
    /findExactModelRuleLine_\(model\)/.test(exactComparisonText) &&
    !/callLLMWithRetry|UrlFetchApp\.fetch/.test(exactComparisonText) &&
    /buildExactRuleComparisonReply_\(msg\)[\s\S]{0,700}replyMessage\(replyToken, exactRuleComparisonReply\)[\s\S]{0,500}return;/.test(
      linebot,
    ),
  "兩完整型號比較必須只讀各自精確 RULE 並在 Fast LLM 前零成本回覆",
);
const exactComparisonVm = {
  writeLog: () => {},
  extractFullModelLikeTokens: () => ["S32HG806ES", "S32HG802SC"],
  dedupDisplayModels: (models) => models,
  normalizeModelForDisplay: (model) => model,
  findExactModelRuleLine_: (model) =>
    model === "S32HG806ES"
      ? "LS32HG806ESXZW,型號：S32HG806ES,32吋 Odyssey IPS G8 雙模平面電競顯示器 G80HS,32吋16:9 IPS平面螢幕,雙模 6K 165Hz / 3K 330Hz,1ms(GtG)反應時間,HDR10+ Gaming,FreeSync Premium Pro"
      : "LS32HG802SCXZW,型號：S32HG802SC,32吋 Odyssey OLED G8 平面電競顯示器 G80SD,32吋16:9 OLED平面螢幕,4K UHD(3840x2160)解析度,最大240Hz更新頻率,0.03ms(GtG)反應時間,HDR10+ Gaming,AMD FreeSync Premium Pro",
};
vm.createContext(exactComparisonVm);
vm.runInContext(
  `${extractFunction(linebot, "pickExactComparisonFields_")}\n${exactComparisonText}\nglobalThis.result = buildExactRuleComparisonReply_("S32HG806ES 跟 S32HG802SC 哪一台比較適合打遊戲？");`,
  exactComparisonVm,
);
assert(
  /雙模 6K 165Hz \/ 3K 330Hz/.test(exactComparisonVm.result) &&
    /最大240Hz更新頻率/.test(exactComparisonVm.result) &&
    !/600Hz|1040Hz/.test(exactComparisonVm.result),
  "比較回答必須完整保留兩台各自的更新頻率，且不得再出現跨型號幻覺數字",
);
assert(
  /function isCampaignRuleCurrentlyActive_/.test(linebot) &&
    /Utilities\.formatDate\(new Date\(\), "Asia\/Taipei", "yyyyMMdd"\)/.test(
      linebot,
    ) &&
    /!isCampaignRuleCurrentlyActive_\(ruleText\)/.test(
      extractFunction(linebot, "findLocalCampaignRuleForQuery"),
    ),
  "活動 RULE 必須以台北日期排除過期資料",
);
const handleScopeOrderText = linebot.slice(
  linebot.indexOf("function handleMessage"),
  generalRouterStart,
);
assert(
  /Scope Guard v29\.6\.145/.test(handleScopeOrderText) &&
    handleScopeOrderText.indexOf("Scope Guard v29.6.145") <
      handleScopeOrderText.indexOf("parseExplicitSourceCommand_(msg)") &&
    handleScopeOrderText.indexOf("Scope Guard v29.6.145") <
      handleScopeOrderText.indexOf("rememberRecentSourceQuestion_("),
  "競品／家電 Scope Guard 必須先於來源 pending 與持久產品狀態",
);
assert(
  /candidateModel && isKnownFullModelToken\(candidateModel\)/.test(
    extractFunction(linebot, "rememberRecentSourceQuestion_"),
  ),
  "未知完整型號不得寫入持久產品狀態",
);
const campaignReplyVm = {
  dedupDisplayModels: (models) => models,
  extractFullModelLikeTokens: () => ["S27HG806EF"],
  normalizeModelForDisplay: (model) => model,
  toHalfWidth: (text) => text,
  writeLog: () => {},
  findLocalCampaignRuleForQuery: () =>
    "活動_202605_202609螢幕登錄送,電腦螢幕活動RULE,活動名稱：高解析度6K螢幕強勢登場,活動期間：即日起至2026/9/30 23:59,登錄期間：2026/5/1至2026/10/2,活動內容：購買指定機種；S27HG806EF、S32HG806ES 登錄送 Steam 1,000元點卡；指定高階螢幕如 S34BG850SC 登錄送全機延長保固兩年；指定螢幕機種可參加月月抽 Galaxy S26",
};
vm.createContext(campaignReplyVm);
vm.runInContext(
  `${extractFunction(linebot, "buildLocalCampaignRuleReply_")}\nglobalThis.result = buildLocalCampaignRuleReply_("S27HG806EF 最近有沒有促銷、登錄送或延長保固？");`,
  campaignReplyVm,
);
assert(
  /Steam 1,000元點卡/.test(campaignReplyVm.result) &&
    /月月抽 Galaxy S26/.test(campaignReplyVm.result) &&
    !/延長保固兩年/.test(campaignReplyVm.result),
  "有效活動只能回本題型號條款與共通抽獎，不得混入其他型號贈品",
);
const priceSanitizerVm = {};
vm.createContext(priceSanitizerVm);
vm.runInContext(
  `${extractFunction(linebot, "sanitizePriceNumbers_")}\nglobalThis.result = sanitizePriceNumbers_("登錄送 Steam 1,000元點卡；產品售價 32,900元");`,
  priceSanitizerVm,
);
assert(
  /Steam 1,000元點卡/.test(priceSanitizerVm.result) &&
    !/32,900元/.test(priceSanitizerVm.result) &&
    /官網當下優惠價/.test(priceSanitizerVm.result),
  "售價遮罩必須保留活動點卡面額，但仍遮罩真正產品售價",
);
const manualFreePrecheckText = extractFunction(
  linebot,
  "tryManualFreeLocalAnswer_",
);
assert(
  /buildDeterministicExactRuleReply_\(query, model\)/.test(
    manualFreePrecheckText,
  ) &&
    !/callLLMWithRetry|UrlFetchApp\.fetch/.test(manualFreePrecheckText),
  "手冊免費預檢只能用 deterministic QA／RULE／人工片段，不得呼叫 Fast LLM 擋住 PDF",
);
const deterministicRuleVm = {
  normalizeModelForDisplay: (model) => model,
  findExactModelRuleLine_: () =>
    "LS32HG806ESXZW,型號：S32HG806ES,32吋 Odyssey IPS G8,雙模 6K 165Hz / 3K 330Hz,1ms反應時間",
};
vm.createContext(deterministicRuleVm);
vm.runInContext(
  `${extractFunction(linebot, "buildDeterministicExactRuleReply_")}\nglobalThis.operation = buildDeterministicExactRuleReply_("S32HG806ES 如何切換雙模？", "S32HG806ES");\nglobalThis.fact = buildDeterministicExactRuleReply_("S32HG806ES 更新率是多少？", "S32HG806ES");`,
  deterministicRuleVm,
);
assert(
  deterministicRuleVm.operation === "" &&
    /雙模 6K 165Hz \/ 3K 330Hz/.test(deterministicRuleVm.fact),
  "操作步驟不得被 RULE 支援事實冒充；明載規格題仍可零成本回答",
);

console.log("三來源狀態、配額、postback 與 TestUI 契約通過。");
