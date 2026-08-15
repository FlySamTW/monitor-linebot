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
  extractFunction(linebot, "normalizeSourceQuestionIdentity_"),
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
    !manualModelResolverText.includes("last_selected_model") &&
    !manualModelResolverText.includes("direct_search_models"),
  "只有明確查上一題可沿用已鎖定型號；手冊新題不得借用舊路由快取",
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
  /網路同題沿用已鎖定型號/.test(linebot) &&
    /手冊同題沿用已鎖定型號/.test(linebot) &&
    /model:\s*normalizeModelForDisplay\(model \|\| explicitModels\[0\]/.test(
      extractFunction(linebot, "rememberRecentSourceQuestion_"),
    ),
  "同題手冊／網路重查都必須保留並帶入完整型號",
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
    /今日提問剩餘 \$\{CURRENT_DAILY_QUESTION_REMAINING\}/.test(linebot) &&
    /currentRequestAudit\.estimatedCostTwd/.test(
      extractFunction(linebot, "buildReplyCostAuditText_"),
    ),
  "正式 LINE 必須顯示簡版合計費用與今日剩餘，詳細 token 僅留稽核",
);
assert(
  /SOURCE_PENDING_TTL_SECONDS\s*=\s*600/.test(linebot) &&
    /SOURCE_RECENT_QUESTION_TTL_SECONDS\s*=\s*1800/.test(linebot),
  "pending 10 分鐘與上一題 30 分鐘契約存在",
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
    extractFunction(linebot, "getSourceContextHash_"),
    extractFunction(linebot, "getSourceDateKey_"),
    extractFunction(linebot, "getSourcePendingKey_"),
    extractFunction(linebot, "getSourceRecentKey_"),
    extractFunction(linebot, "getSourceQuotaKey_"),
    extractFunction(linebot, "getDailyQuestionQuotaKey_"),
    extractFunction(linebot, "parseSourceStateJson_"),
    extractFunction(linebot, "writePendingSourceState_"),
    extractFunction(linebot, "readPendingSourceState_"),
    extractFunction(linebot, "clearPendingSourceState_"),
    extractFunction(linebot, "readSourceQuota_"),
    extractFunction(linebot, "getSourceRemaining_"),
    extractFunction(linebot, "reserveAdvancedSourceUsage_"),
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

const pending = context.writePendingSourceState_("C2", { source: "manual" });
pending.expiresAt = Date.now() - 1;
const pendingKey = context.getSourcePendingKey_("C2");
cache.put(pendingKey, JSON.stringify(pending));
props.setProperty(pendingKey, JSON.stringify(pending));
assert.strictEqual(context.readPendingSourceState_("C2", false), null);

assert(/function testSourcePostback\(/.test(linebot), "TestUI 有正式 postback 模擬入口");
assert(/selectSource\('manual'\)/.test(testUi) && /usePreviousSource\(\)/.test(testUi), "TestUI 可按三來源與查上一題");
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
      /查上一題／換型號／取消/.test(manualText),
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
assert(/【Prompt v29\.6\.106】/.test(prompt));
assert(/同一訊息不得自動跨來源/.test(prompt));

console.log("三來源狀態、配額、postback 與 TestUI 契約通過。");
