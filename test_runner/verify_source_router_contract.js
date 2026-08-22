const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const linebot = fs.readFileSync(path.join(root, "linebot.gs"), "utf8");
const qaKnowledge = fs.readFileSync(path.join(root, "qa_knowledge.gs"), "utf8");
const qaRows = fs
  .readFileSync(path.join(root, "QA.csv"), "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);
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
  /function adminRunOfficialManualAutomation\(\)/.test(linebot) &&
    /scanOfficialWebsiteForNewMonitors\(\)/.test(
      extractFunction(linebot, "adminRunOfficialManualAutomation"),
    ) &&
    /syncGeminiKnowledgeBase\(false\)/.test(
      extractFunction(linebot, "adminRunOfficialManualAutomation"),
    ),
  "編輯者須有不接受外部參數的一鍵新品手冊同步入口，日常仍由排程自動執行",
);
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
  extractFunction(linebot, "normalizeCommonMonitorInputTypos_"),
  extractFunction(linebot, "isShortAliasModelToken"),
  extractFunction(linebot, "extractShortAliasModelTokens"),
  extractFunction(linebot, "extractFullModelLikeTokens"),
  extractFunction(linebot, "normalizeModelForDisplay"),
  extractFunction(linebot, "dedupDisplayModels"),
  extractFunction(linebot, "isClassRuleLineMatchedAlias"),
  extractFunction(linebot, "getAliasCandidatesFromClassRules"),
  extractFunction(linebot, "getAliasOnlySelectionModelsFromQuery"),
  extractFunction(linebot, "isPureSeriesOverviewQuery_"),
  extractFunction(linebot, "shouldPromptAliasModelSelection_"),
  extractFunction(linebot, "stripInternalRoutingHints_"),
  extractFunction(linebot, "normalizeSourceQuestionIdentity_"),
  extractFunction(linebot, "normalizeAdvancedSourceTopicIdentity_"),
  extractFunction(linebot, "isEllipticalEvidenceFollowUp_"),
  extractFunction(linebot, "isSameRecentSourceQuestion_"),
  extractFunction(linebot, "stripKnownModelFromSourceQuestion_"),
  extractFunction(linebot, "resolveManualSourceModel_"),
  `globalThis.__g8Candidates = getAliasOnlySelectionModelsFromQuery("G8 有耳機孔嗎？", 10, false);`,
  `globalThis.__g806Candidates = getAliasOnlySelectionModelsFromQuery("G806 雙模怎麼開？", 10, false);`,
  `globalThis.__g8SelectedAgain = getAliasOnlySelectionModelsFromQuery("S27FG812SC G8 有耳機孔嗎？", 10, false);`,
  `globalThis.__sameQuestion = isSameRecentSourceQuestion_("G8 如何連接藍牙耳機?", "S32DG802SC G8 如何連接藍牙耳機？", "S32DG802SC");`,
  `globalThis.__differentQuestion = isSameRecentSourceQuestion_("G8 如何恢復原廠設定?", "S32DG802SC G8 如何連接藍牙耳機？", "S32DG802SC");`,
  `globalThis.__sameQuestionModel = resolveManualSourceModel_("G8 如何連接藍牙耳機?", {previousQuestion:"S32DG802SC G8 如何連接藍牙耳機？", previousModel:"S32DG802SC"}, null, "U1");`,
  `globalThis.__differentQuestionModel = resolveManualSourceModel_("G8 如何恢復原廠設定?", {previousQuestion:"S32DG802SC G8 如何連接藍牙耳機？", previousModel:"S32DG802SC"}, null, "U1");`,
  `globalThis.__reselectQuestion = stripKnownModelFromSourceQuestion_("S32DG802SC G8 如何連接藍牙耳機？", "S32DG802SC");`,
  `globalThis.__sameWebTopic = normalizeAdvancedSourceTopicIdentity_("那你再幫我搜尋一下 S32FM803UC 如何播放 USB？ [System Hint: hidden]", "S32FM803UC") === normalizeAdvancedSourceTopicIdentity_("USB 隨身碟播放怎麼用", "S32FM803UC");`,
  `globalThis.__differentUsbTopic = normalizeAdvancedSourceTopicIdentity_("USB 支援哪些格式？", "S32FM803UC") !== normalizeAdvancedSourceTopicIdentity_("USB 播放會斷線？", "S32FM803UC");`,
  `globalThis.__differentBluetoothTopic = normalizeAdvancedSourceTopicIdentity_("藍牙耳機如何配對？", "S32FM803UC") !== normalizeAdvancedSourceTopicIdentity_("藍牙耳機已連線但沒聲音？", "S32FM803UC");`,
  `globalThis.__normalizedTypo = normalizeCommonMonitorInputTypos_(toHalfWidth("Ｇ８有幾個 hdim？"));`,
  `globalThis.__normalizedLowerLTypo = normalizeCommonMonitorInputTypos_("S32HG806ES 有幾個 HDMl？");`,
  `globalThis.__typoNeedsSelection = shouldPromptAliasModelSelection_("G8有幾個 hdim？", __g8Candidates);`,
  `globalThis.__overviewSkipsSelection = shouldPromptAliasModelSelection_("G8 有哪些型號？", __g8Candidates);`,
  `globalThis.__ellipticalFollowUp = isEllipticalEvidenceFollowUp_("要怎麼切？ (型號: S32HG806ES)");`,
  `globalThis.__standaloneFullModel = isEllipticalEvidenceFollowUp_("S32HG806ES 要怎麼切？");`,
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
assert(
  aliasVmContext.__g806Candidates.includes("S27HG806EF") &&
    aliasVmContext.__g806Candidates.includes("S32HG806ES") &&
    aliasVmContext.__g806Candidates.length === 2,
  "G806 等不完整型號必須從完整型號 token 列出精準候選，不能只要求手打完整型號",
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
assert.strictEqual(
  aliasVmContext.__differentUsbTopic,
  true,
  "USB 格式與播放斷線是不同問題，不得誤用同一個付費結果快取",
);
assert.strictEqual(
  aliasVmContext.__differentBluetoothTopic,
  true,
  "藍牙配對與已連線沒聲音是不同問題，不得誤用同一個付費結果快取",
);
assert.strictEqual(aliasVmContext.__normalizedTypo, "G8有幾個 HDMI?");
assert.strictEqual(
  aliasVmContext.__normalizedLowerLTypo,
  "S32HG806ES 有幾個 HDMI？",
  "HDMl 最後小寫 L 也必須正規化成 HDMI，避免免費 RULE 題誤花 Fast 成本",
);
assert.strictEqual(
  aliasVmContext.__typoNeedsSelection,
  true,
  "G8 加未知／錯字問法仍須先選完整型號，不能讓 intent regex 漏接",
);
assert.strictEqual(
  aliasVmContext.__overviewSkipsSelection,
  false,
  "純系列介紹可直接列出產品線，不強迫先選單一型號",
);
assert.strictEqual(aliasVmContext.__ellipticalFollowUp, true);
assert.strictEqual(
  aliasVmContext.__standaloneFullModel,
  false,
  "含完整型號的獨立新題不得偷借上一題主題",
);

const exactRuleCache = new Map();
const exactRuleVmSource = [
  extractFunction(linebot, "toHalfWidth"),
  extractFunction(linebot, "isShortAliasModelToken"),
  extractFunction(linebot, "extractFullModelLikeTokens"),
  extractFunction(linebot, "normalizeModelForDisplay"),
  extractFunction(linebot, "dedupDisplayModels"),
  extractFunction(linebot, "findExactModelRuleLine_"),
  extractFunction(linebot, "buildDeterministicComparisonReply_"),
  extractFunction(linebot, "getExplicitCapabilityCheck_"),
  extractFunction(linebot, "enforceExactModelCapabilityEvidence_"),
  extractFunction(linebot, "buildDeterministicExactRuleReply_"),
  `globalThis.__kvmGuarded = enforceExactModelCapabilityEvidence_("G8 有 KVM 嗎？ (型號: S32HG806ES)", "有，S32HG806ES 內建 KVM Switch。");`,
  `globalThis.__headphonePreserved = enforceExactModelCapabilityEvidence_("那它有耳機孔嗎？ (型號: S32HG806ES)", "有，S32HG806ES 具備耳機孔。");`,
  `globalThis.__m7HdmiExact = buildDeterministicExactRuleReply_("M7 有幾個 HDMI 埠？", "S32FM703UC");`,
  `globalThis.__m7HdmiConnector = buildDeterministicExactRuleReply_("S32FM703UC 有幾個 HDMI 連接埠？", "S32FM703UC");`,
  `globalThis.__g932HdmiExact = buildDeterministicExactRuleReply_("S49DG932SC 有幾個 HDMI？", "S49DG932SC");`,
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
  ) &&
    /S32FM703UC 這款有 2 個 HDMI 2\.0 連接埠/.test(
      exactRuleVmContext.__m7HdmiConnector,
    ),
  "M7 選定 S32FM703UC 後，HDMI 埠／HDMI 連接埠兩種問法都必須由精確 RULE 零模型回答",
);
assert(
  /共有 2 個 HDMI 類連接埠/.test(exactRuleVmContext.__g932HdmiExact) &&
    /HDMI 2\.1 x1/.test(exactRuleVmContext.__g932HdmiExact) &&
    /Micro HDMI 2\.1 x1/.test(exactRuleVmContext.__g932HdmiExact),
  "同一型號的標準 HDMI 與 Micro HDMI 必須逐欄彙總，不能只回第一個介面",
);
const automaticManualFallbackText = extractFunction(
  linebot,
  "executeAutomaticManualFallback_",
);
assert(
  /executeAdvancedSourceQuery_\(\s*"manual"/.test(
    automaticManualFallbackText,
  ),
  "QA／RULE 缺證據的操作題必須統一自動進手冊",
);
assert(
  /operationRuleOnlyReply[\s\S]{0,900}略過 PDF early gate/.test(linebot) &&
    /knownRuleAnswer = buildKnownRuleAnchorForMixedOperation_/.test(linebot) &&
    /const providerQuery =[\s\S]{0,500}只查原題尚未解答的操作或故障部分/.test(
      linebot,
    ) &&
    /mergeKnownRuleAnchorWithAdvancedAnswer_\(\s*knownRuleAnswer,\s*finalText/.test(
      linebot,
    ) &&
    /automaticFallback:\s*true,[\s\S]{0,100}priorFastChecked:\s*true/.test(
      linebot,
    ),
  "純規格不得被操作 early gate 誤送 PDF；混合題須把已知 RULE 與待查操作拆開後合併",
);
assert(
  /selectedMissingFactReply[\s\S]{0,600}refundDailyQuestionUsage_[\s\S]{0,600}executeAutomaticManualFallback_/.test(
    linebot,
  ) &&
    /missingExactFactReply[\s\S]{0,800}refundDailyQuestionUsage_[\s\S]{0,800}executeAutomaticManualFallback_/.test(
      linebot,
    ),
  "精確型號與選型後的 RULE 缺項不得停在 CTA；退回一般題額度後必須直接查對應手冊",
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
  /前面已建立的部分回答與[\s\S]*手冊建議必須原樣保留/.test(linebot) &&
    /if \(!\/查官方手冊\//.test(linebot) &&
    !/const verifiedRuleIntro = bluetoothRuleIntro/.test(linebot),
  "完整型號鎖定後必須保留所有題型的部分回答，不得再由藍牙等題型特例洗掉",
);
assert(
  /function buildFastAnswerEnvelope_/.test(linebot) &&
    /function buildEvidenceActionQuickReplies_/.test(linebot) &&
    /allowedActions\.includes\("manual"\)/.test(linebot) &&
    /allowedActions\.includes\("web"\)/.test(linebot) &&
    /items\.slice\(0, 3\)/.test(linebot) &&
    !/!manualSourceRecommended &&\s*webSourceRecommended/.test(linebot),
  "部分／無證據回答必須可同時提供手冊與 Web，並將 Quick Reply 限制在三個內",
);
assert(
  !/finalText\s*=\s*buildSafeUsbMediaWebAnswer_/.test(linebot),
  "Web grounding 成功後不得用固定 USB 文案覆寫實際支持句",
);
assert(
  /allowElaborate:\s*false/.test(linebot) &&
    /LAST_SOURCE_TEST_STATE\.outcome === "no_evidence"/.test(linebot) &&
    !/finishAdvancedSourceOperation_\([\s\S]{0,100}"Free Local Answer"/.test(linebot),
  "來源成功後不得再誘導無意義生成；免費預檢也不得把內部佔位字串存成答案",
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
const triggerGuardText = extractFunction(linebot, "ensureSyncTriggerExists");
assert(
  !/purgeEphemeralScriptProperties_\(/.test(triggerGuardText) &&
    triggerGuardText.indexOf("cache.get(cacheKey)") <
      triggerGuardText.indexOf("ScriptApp.getProjectTriggers"),
  "一般 webhook 不得掃描或刪除有效配額／上一題；Trigger 快取必須先行",
);
assert(
  /SRC_RESCUE_/.test(extractFunction(linebot, "cleanupExpiredSourceRoutingProperties_")),
  "每日清理必須一併移除舊日系統 Web rescue 計數",
);
assert(
  /function getRuntimePromptConfig_/.test(linebot) &&
    !/getRange\("B3:C3"\)/.test(extractFunction(linebot, "callLLMWithRetry")) &&
    !/getRange\("C3"\)/.test(extractFunction(linebot, "constructLeanDynamicPromptV159_")),
  "Fast/PDF/Web 呼叫前不得重複同步讀 Prompt Sheet",
);
const loadingText = extractFunction(linebot, "showLoadingAnimation");
assert(
  /IS_TEST_MODE/.test(loadingText) &&
    /LOADING_ANIMATION_SHOWN/.test(loadingText) &&
    /function handleMessage\(event\)[\s\S]{0,1800}LOADING_ANIMATION_SHOWN = false;/.test(linebot) &&
    !/⭐ 立即顯示 Loading 動畫（去重後、處理前）/.test(linebot),
  "零成本路由不得先呼叫 LINE 動畫；同一事件動畫最多一次且 TestUI 完全略過",
);
assert(
  !/flushLogs\(\)/.test(extractFunction(linebot, "writeLog")) &&
    !/SpreadsheetApp\.flush|deleteRows/.test(
      extractFunction(linebot, "flushLogs"),
    ) &&
    /cleanupLogSheetRows_\(\)/.test(
      extractFunction(linebot, "dailyKnowledgeRefresh"),
    ),
  "Log 只能在 webhook finally 批次寫一次；同步 flush 與刪舊列必須移出回答熱路徑",
);

const generalRouterStart = linebot.indexOf("// D. 一般對話");
assert(generalRouterStart >= 0, "找不到一般對話路由");
const aliasLookupBeforeQaIndex = linebot.indexOf(
  "const aliasSelectionBeforeQa",
  generalRouterStart,
);
const directQaIndex = linebot.indexOf(
  "const directLocalQa = incomingMessageWasElaboration",
  generalRouterStart,
);
const aliasGateIndex = linebot.indexOf(
  "shouldPromptAliasModelSelection_(routingQuestion, aliasSelectionBeforeQa)",
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
    /doesQaMatchCoverQueryAliases_\(routingQuestion, directLocalQa\.question\)/.test(
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
    /executeAutomaticManualFallback_/.test(linebot) &&
    !/const dailyQuota = reserveDailyQuestionOrReply_/.test(
      extractFunction(linebot, "handleRichMenuPostback_"),
    ),
  "手冊／網路不得重複扣一般 20 題；自動轉手冊時必須退回一般額度",
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
    !/這題已由[^\n]*(?:未讀取手冊|未呼叫 LLM|供應商請求)/.test(
      extractFunction(linebot, "tryManualFreeLocalAnswer_"),
    ) &&
    /reserved:\s*false/.test(extractFunction(linebot, "tryManualFreeLocalAnswer_")),
  "手冊模式必須先做高信心 QA/RULE 預檢，命中時零 PDF、零扣點，且不可對客戶解釋內部流程",
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
  /forcedModelSelectionTrigger\s*=\s*false/.test(linebot) &&
    /forcedSopNeedsModelSelection\s*=\s*false/.test(linebot) &&
    /executeAutomaticManualFallback_/.test(linebot) &&
    !/已改為詢問使用者，不呼叫 PDF/.test(linebot),
  "完整型號已鎖定且 QA／RULE 不足時，必須直接進手冊，不可再詢問是否要查",
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
  GAS_VERSION: "v29.6.171-test",
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
    extractFunction(linebot, "isGroundedWebAnswerRelevant_"),
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

assert.strictEqual(
  context.isGroundedWebAnswerRelevant_(
    "沒有找到針對這個特定型號的步驟，以下根據其他 Odyssey G 系列經驗。",
    "S32HG802SC",
  ),
  false,
  "有 grounding 但明說只找到其他系列時，不得冒充目前型號的有效答案",
);
assert.strictEqual(
  context.isGroundedWebAnswerRelevant_(
    "S32HG802SC 可先檢查連接器是否鎖緊。",
    "S32HG802SC",
  ),
  true,
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
    !/confirmManualSource\(\)/.test(testUi) &&
    !/confirm_manual/.test(testUi) &&
    !/action === "confirm_manual"/.test(linebot),
  "TestUI 與正式 webhook 都必須一按即授權，不能保留第二次手冊確認死狀態",
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
assert(
  modelHoldOccurrences >= 2 &&
    /const modelSelectMode\s*=\s*\(?\s*hasExplicitTrigger\s*\|\|\s*forcedSopNeedsModelSelection\s*\)?\s*\?\s*"pdf"\s*:\s*"fast"/.test(
      linebot,
    ) &&
    /\} else \{\s*executeLegacyManualModelSelectionViaSourceRouter_/.test(
      linebot,
    ) &&
    /舊授權旁路已停用/.test(extractFunction(linebot, "grantManualSearchConsent_")) &&
    /return false;/.test(extractFunction(linebot, "consumeManualSearchConsent_")),
  "Fast 已判定需手冊時，多型號選型 mode 必須是 pdf，點完型號直接查手冊；舊 consent 旁路仍 fail closed",
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
  ) &&
    /需要手冊證據時，只輸出 \[AUTO_SEARCH_PDF\]/.test(prompt) &&
    /不要先寫「資料不足」或詢問是否要查；程式會自動接續/.test(
      prompt,
    ),
  "Prompt 只可輸出簡單來源訊號；PDF/Web 補救與扣點狀態機仍由程式負責",
);

const webCanonicalText = extractFunction(linebot, "buildCanonicalWebQuery_");
const advancedRouteText = extractFunction(linebot, "executeAdvancedSourceQuery_");
assert(
  !/last_kb_files/.test(linebot),
  "PDF 選檔結果不得同步寫入沒有讀取者的 last_kb_files 死快取",
);
assert.strictEqual(
  (advancedRouteText.match(/tryManualFreeLocalAnswer_\(/g) || []).length,
  2,
  "手冊狀態機只可保留一次無型號預檢與一次選型後預檢；禁止在建立 operation 後重跑相同免費查詢",
);
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
    /這次公開網頁沒有足夠證據回答這題/.test(linebot),
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
const verifiedManualCacheStore = new Map();
const verifiedManualVm = {
  QA_KNOWLEDGE_TEST_ROWS_: qaRows,
  CacheService: {
    getScriptCache: () => ({
      get: (key) => verifiedManualCacheStore.get(key) || null,
      put: (key, value) => verifiedManualCacheStore.set(key, String(value)),
      remove: (key) => verifiedManualCacheStore.delete(key),
    }),
  },
  writeLog: () => {},
  normalizeModelForDisplay: (model) => String(model || "").toUpperCase().replace(/^LS/, "S"),
  extractFullModelLikeTokens: (text) =>
    String(text || "").toUpperCase().match(/\b(?:LS)?S\d{2}[A-Z0-9]{5,16}\b/g) || [],
  extractShortAliasModelTokens: (text) =>
    [...new Set(String(text || "").toUpperCase().match(/\b[SGM]\d{1,5}[A-Z]{0,3}\b/g) || [])],
  isQaQuestionDirectMatch_: () => false,
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
  `${qaKnowledge}\n${extractFunction(linebot, "getVerifiedManualChunks_")}\n${extractFunction(linebot, "isVerifiedManualEvidenceQuery_")}\n${extractFunction(linebot, "findVerifiedManualChunk_")}\n${extractFunction(linebot, "buildVerifiedManualChunkReply_")}\n` +
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
  /查官方手冊/.test(linebot) &&
    !/官方手冊」再點「確認要查/.test(linebot) &&
    /選完就會直接查/.test(linebot) &&
    !/不會再問一次/.test(linebot) &&
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
    /lastWebUnverifiedDraft \|\| webResponse/.test(
      extractFunction(linebot, "runManualWebRescue_"),
    ) &&
    /buildTentativeWebFallback_\(\s*rawWebDraft/.test(
      extractFunction(linebot, "runManualWebRescue_"),
    ) &&
    /userWebQuotaCharged=0/.test(linebot) &&
    /SOURCE_DAILY_SYSTEM_WEB_RESCUE_LIMIT\s*=\s*3/.test(linebot) &&
    /buildTentativeManualFallback_/.test(
      extractFunction(linebot, "buildManualWebRescueReply_"),
    ) &&
    /function isGroundedWebAnswerRelevant_/.test(linebot) &&
    /(?:沒有\|未能\|找不到)/.test(
      extractFunction(linebot, "isGroundedWebAnswerRelevant_"),
    ) &&
    /replace\(\/\\s\*\\\[cite\[\\s\\S\]\*\$\/i/.test(
      extractFunction(linebot, "compactGroundedWebAnswer_"),
    ) &&
    /Grounding Relevance v29\.6\.168/.test(advancedRouteText) &&
    extractFunction(linebot, "compactGroundedWebAnswer_").includes(
      "通常這類",
    ) &&
    extractFunction(linebot, "compactGroundedWebAnswer_").includes(
      "suppressSpeculativeList",
    ) &&
    /function getGroundedQuestionFocusTokens_/.test(linebot) &&
    /function buildGroundedSupportedAnswer_/.test(linebot) &&
    /groundingSupports[\s\S]*support\.segment[\s\S]*lastWebSupportedSegments/.test(
      linebot,
    ) &&
    /Grounding Support v29\.6\.167/.test(linebot) &&
    /lastWebSupportedSegments/.test(advancedRouteText) &&
    /lastWebEvidenceValid = false;[\s\S]*lastWebUnverifiedDraft = "\[NO_RELEVANT_WEB_EVIDENCE\]"/.test(
      advancedRouteText,
    ) &&
    advancedRouteText.indexOf("beginAdvancedSourceOperation_(") <
      advancedRouteText.indexOf("getRelevantKBFiles(") &&
    /noManualReply[\s\S]*finishAdvancedSourceOperation_\([\s\S]*sourceOperation,[\s\S]*noManualReply/.test(
      advancedRouteText,
    ) &&
    /const needsAutomaticWebRescue =/.test(advancedRouteText) &&
    /manualPreflightStopped \|\|[\s\S]*recommendedWeb \|\|[\s\S]*manualEvidenceFailed/.test(advancedRouteText),
  "PDF 無證據後只能自動補搜一次受控 Web；不扣使用者網搜額度，同一缺檔結果也不得重複呼叫",
);

const groundedSupportContext = {
  compactGroundedWebAnswer_: (value) => String(value || "").trim(),
  normalizeModelForDisplay: (value) => String(value || "").trim(),
  toHalfWidth: (value) => String(value || ""),
};
vm.createContext(groundedSupportContext);
vm.runInContext(
  `${extractFunction(linebot, "getGroundedQuestionFocusTokens_")}
   ${extractFunction(linebot, "expandGroundedSupportToCompleteLine_")}
   ${extractFunction(linebot, "doesGroundedAnswerCompleteQuestion_")}
   ${extractFunction(linebot, "buildGroundedSupportedAnswer_")}
   globalThis.exactSupported = buildGroundedSupportedAnswer_([
     "S32HG802SC 的底座採免工具安裝。",
     "通常這類螢幕可能需要螺絲起子。"
   ], "S32HG802SC", "S32HG802SC 底座是免工具安裝嗎？");
   globalThis.otherModelRejected = buildGroundedSupportedAnswer_([
     "S32HG806ES 的底座可免工具安裝。"
   ], "S32HG802SC", "S32HG802SC 底座是免工具安裝嗎？");
   globalThis.irrelevantExactModelRejected = buildGroundedSupportedAnswer_([
     "S32HG802SC 是 32 吋電競螢幕，支援旋轉。",
     "購物網站有販售 S32HG802SC。"
   ], "S32HG802SC", "S32HG802SC 底座是免工具安裝嗎？");`,
  groundedSupportContext,
);
assert(
  /S32HG802SC/.test(groundedSupportContext.exactSupported) &&
    !/通常|可能|螺絲起子/.test(groundedSupportContext.exactSupported) &&
    groundedSupportContext.otherModelRejected === "" &&
    groundedSupportContext.irrelevantExactModelRejected === "",
  `Web 最終回答只能使用 groundingSupports 同時支持完整型號與本題核心詞的句段: ${JSON.stringify({ exactSupported: groundedSupportContext.exactSupported, otherModelRejected: groundedSupportContext.otherModelRejected, irrelevantExactModelRejected: groundedSupportContext.irrelevantExactModelRejected })}`,
);

const webFallbackContext = {
  isMonitorUsbMediaWebQuestion_: () => false,
  stripAnySourceTags: (value) => String(value || ""),
  formatForLineMobile: (value) => String(value || ""),
  isApiFailureReply: () => false,
};
vm.createContext(webFallbackContext);
vm.runInContext(
  `${extractFunction(linebot, "sanitizeTentativeWebActionLine_")}
   ${extractFunction(linebot, "buildTentativeWebFallback_")}
   globalThis.noEvidence = buildTentativeWebFallback_(
     "沒有找到這個型號的明確資料。一般來說，可能採免工具設計。",
     "底座需要工具嗎？",
     "S32HG802SC"
   );
   globalThis.noRelevantSupport = buildTentativeWebFallback_(
     "[NO_RELEVANT_WEB_EVIDENCE]",
     "底座需要工具嗎？",
     "S32HG802SC"
   );
   globalThis.safeTerminal = buildTentativeWebFallback_(
     "很抱歉，無法找到直接解法。\\n* **使用數位機上盒：** 若機上盒有 HDMI 輸出，可用 HDMI 線連接螢幕並切換輸入源。\\n* 其他型號可能有類似方法。\\n* **諮詢業者：** 確認機上盒提供 HDMI 輸出。",
     "M9 可以接第四台嗎？",
     "S32FM902SC"
   );
   globalThis.noPurchase = buildTentativeWebFallback_(
     "沒有找到直接解法。\\n* **外接數位電視盒：** 你可以購買市面上的電視盒，它通常有第四台輸入，並透過 HDMI 線連接到 S32FM902SC。",
     "M9 可以接第四台嗎？",
     "S32FM902SC"
   );`,
  webFallbackContext,
);
assert(
  /沒有足夠證據/.test(webFallbackContext.noEvidence) &&
    /官方手冊/.test(webFallbackContext.noEvidence) &&
    !/可能採免工具/.test(webFallbackContext.noEvidence) &&
    /沒有足夠證據/.test(webFallbackContext.noRelevantSupport) &&
    /使用數位機上盒/.test(webFallbackContext.safeTerminal) &&
    /諮詢業者/.test(webFallbackContext.safeTerminal) &&
    !/其他型號可能/.test(webFallbackContext.safeTerminal) &&
    /並非已由三星手冊或公開來源證實/.test(webFallbackContext.safeTerminal) &&
    /HDMI 線連接/.test(webFallbackContext.noPurchase) &&
    !/購買|通常/.test(webFallbackContext.noPurchase),
  "Web 無支持證據時不得把模型的『一般來說／可能』猜測回送給使用者",
);

assert(
  /組裝/.test(extractFunction(linebot, "isOperationOrTroubleshootQuery")) &&
    /更新/.test(extractFunction(linebot, "isOperationOrTroubleshootQuery")) &&
    /插哪個孔/.test(extractFunction(linebot, "isOperationOrTroubleshootQuery")) &&
    /!isOperationOrTroubleshootQuery\(user\)/.test(
      extractFunction(linebot, "inferFastLocalSourceTag_"),
    ),
  "組裝、韌體更新、插孔等操作題不得因相鄰規格詞而被洗白成官方規格答案",
);
assert(
  /Operation Source Gate v29\.6\.247/.test(handleMessageText) &&
    /tryManualFreeLocalAnswer_\(/.test(advancedRouteText) &&
    /normalizedSource === "manual"/.test(advancedRouteText) &&
    /refundDailyQuestionUsage_\(userId, "operation_auto_manual"\)/.test(
      handleMessageText,
    ) &&
    /executeAutomaticManualFallback_\([\s\S]{0,260}operationModel/.test(
      handleMessageText,
    ) &&
    !/operation_source_handoff/.test(handleMessageText),
  "完整型號操作題先免費查 QA／RULE／Evidence；未命中退回一般題額度並直接讀 PDF，不可停在來源 CTA",
);
assert(
  /getPreviousUserTopicForEvidence_\([\s\S]*contextId,[\s\S]*msg/.test(
    handleMessageText,
  ) &&
    /evidenceLookupQuery = `\$\{previousEvidenceTopic\}\\n\$\{msg\}`/.test(
      handleMessageText,
    ) &&
    /Evidence Continuation v29\.6\.173/.test(handleMessageText),
  "短追問必須先拿上一輪使用者主題重查既有 Evidence，不得再花 Fast 費用後只回 CTA",
);
assert(
  /!isShortAliasModelToken\(m\)/.test(
    extractFunction(linebot, "inferFastLocalSourceTag_"),
  ) &&
    /extractFullModelLikeTokens\(m\)\.length > 0/.test(
      extractFunction(linebot, "inferFastLocalSourceTag_"),
    ),
  "G8／M7 等系列別稱不得冒充完整型號，替模型概括答案補官方規格來源",
);

assert(
  /const identity = \[\s*GAS_VERSION,/.test(
    extractFunction(linebot, "getAdvancedSourceOperationKey_"),
  ),
  "PDF／Web 結果快取鍵必須包含 GAS_VERSION，證據規則更新後不得沿用舊答案",
);

const manualUiContext = { writeLog: () => {} };
vm.createContext(manualUiContext);
vm.runInContext(
  `${extractFunction(linebot, "buildManualConsentPrompt_")}
   ${extractFunction(linebot, "isManualEvidenceFailureReply_")}
   ${extractFunction(linebot, "parseManualEvidenceMarker_")}
   ${extractFunction(linebot, "getManualStructuredResponseSchema_")}
   ${extractFunction(linebot, "normalizeManualStructuredResponse_")}
   ${extractFunction(linebot, "applyManualEvidenceGuard_")}
   globalThis.preserved = buildManualConsentPrompt_("已確認搭載 Tizen。\\n[來源:官方規格庫]", "問題", "S32FM902SC");
   globalThis.unsourcedRemoved = buildManualConsentPrompt_("請把支架鎖到 VESA 孔。", "問題", "S32FM902SC");
   globalThis.newFailureDetected = isManualEvidenceFailureReply_("我已經查過這本官方手冊，但這次沒有找到能直接回答這題的明確段落，所以先不亂猜。");
   globalThis.structuredManual = applyManualEvidenceGuard_(normalizeManualStructuredResponse_(JSON.stringify({found:true,answer:"請把隨身碟插到 SERVICE 埠，再到軟體更新。",operationPath:"Support → Software Update",evidence:[{pageNumber:36,scope:"型號明確",evidenceExcerpt:"將 USB 裝置連接至顯示器上的連接埠"}]})), "問題");
   globalThis.structuredMultiple = applyManualEvidenceGuard_(normalizeManualStructuredResponse_(JSON.stringify({found:true,answer:"先開 Dual Mode，再用 Aim Point。",operationPath:"Game → Dual Mode",evidence:[{pageNumber:27,scope:"型號明確",evidenceExcerpt:"Game → Dual Mode"},{pageNumber:28,scope:"型號明確",evidenceExcerpt:"Aim Point"}]})), "問題");
   globalThis.structuredDeduped = applyManualEvidenceGuard_(normalizeManualStructuredResponse_(JSON.stringify({found:true,answer:"執行 Self Diagnosis。",operationPath:"Support → Self Diagnosis",evidence:[{pageNumber:36,scope:"型號明確",evidenceExcerpt:"Support → Self Diagnosis"},{pageNumber:36,scope:"型號明確",evidenceExcerpt:"自我診斷期間不要關閉電源"},{pageNumber:37,scope:"型號明確",evidenceExcerpt:"依照畫面指示檢查畫面"}]})), "問題");
   globalThis.structuredNotFound = applyManualEvidenceGuard_(normalizeManualStructuredResponse_(JSON.stringify({found:false,answer:"手冊未記載第三方顯卡驅動衝突。",operationPath:"",evidence:[]})), "問題");
   globalThis.formatError = applyManualEvidenceGuard_("[MANUAL_OUTPUT_FORMAT_ERROR]", "問題");`,
  manualUiContext,
);
assert(
  /已確認搭載 Tizen/.test(manualUiContext.preserved) &&
    /查官方手冊/.test(manualUiContext.preserved) &&
    !/VESA 孔/.test(manualUiContext.unsourcedRemoved) &&
    /查官方手冊/.test(manualUiContext.unsourcedRemoved) &&
    !/不會再問一次/.test(manualUiContext.preserved) &&
    manualUiContext.newFailureDetected === true &&
    /第36頁/.test(manualUiContext.structuredManual) &&
    !/(?:手冊重點|證據摘錄)/.test(manualUiContext.structuredManual) &&
    /操作路徑：Support → Software Update/.test(manualUiContext.structuredManual) &&
    (manualUiContext.structuredManual.match(/Support → Software Update/g) || []).length === 1 &&
    /第27、28頁/.test(manualUiContext.structuredMultiple) &&
    /第36、37頁/.test(manualUiContext.structuredDeduped) &&
    /操作路徑：Support → Self Diagnosis/.test(manualUiContext.structuredDeduped) &&
    !/第36、36、37頁/.test(manualUiContext.structuredDeduped) &&
    /AUTO_SEARCH_WEB/.test(manualUiContext.structuredNotFound) &&
    /補查一次公開網頁/.test(manualUiContext.formatError),
  "手冊 Evidence 摘錄只供程式驗證，客戶只看簡潔答案、單一操作路徑與頁碼；NOT_FOUND 與格式失敗都進受控 Web 補救",
);
assert(
  /const manualEvidenceNotFound =/.test(linebot) &&
    /manualEvidenceNotFound \|\|\s*manualEvidenceFailed \|\|\s*recommendedWeb/.test(linebot),
  "PDF NOT_FOUND、格式或證據驗證失敗都必須進同一次受控 Web 補救",
);
const finalAdvancedQuickReplyStart = advancedRouteText.lastIndexOf(
  "buildAdvancedSourceQuickReplies_(",
);
const finalAdvancedQuickReplyText = advancedRouteText.slice(
  finalAdvancedQuickReplyStart,
  finalAdvancedQuickReplyStart + 1800,
);
assert(
  /skipSameSource:\s*true/.test(finalAdvancedQuickReplyText) &&
    !/skipAlternateSource:\s*Boolean\([\s\S]{0,120}manualWebRescue/.test(
      finalAdvancedQuickReplyText,
    ) &&
    /forceOfficial/.test(finalAdvancedQuickReplyText) &&
    /🌐 網路解答/.test(extractFunction(linebot, "buildAdvancedSourceQuickReplies_")) &&
    /🔗 到這款官網/.test(linebot),
  "PDF 無證據或自動補救後必須保留網路或官網終點，且不得再跑同一手冊來源",
);
const exactComparisonText = extractFunction(
  linebot,
  "buildExactRuleComparisonReply_",
);
assert(
  /models\.length !== 2/.test(exactComparisonText) &&
    /findExactModelRuleLine_\(model\)/.test(exactComparisonText) &&
    !/callLLMWithRetry|UrlFetchApp\.fetch/.test(exactComparisonText) &&
    /buildExactRuleComparisonReply_\(routingQuestion\)[\s\S]{0,700}replyMessage\(replyToken, exactRuleComparisonReply\)[\s\S]{0,500}return;/.test(
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
const manualDiscoveryVm = {
  writeLog: () => {},
  normalizeModelForDisplay: (model) =>
    String(model).replace(/^LS/, "S").replace(/XZW$/, ""),
  isPdfModelTokenMatch_: (manualModel, candidateModel) =>
    manualModel === candidateModel ||
    (candidateModel.startsWith(manualModel) &&
      /^[A-Z]{1,4}$/.test(candidateModel.slice(manualModel.length))),
};
vm.createContext(manualDiscoveryVm);
vm.runInContext(
  `${extractFunction(linebot, "extractEmbeddedJsonArrayByKey_")}
   ${extractFunction(linebot, "isSafeSamsungTwManualDownload_")}
   ${extractFunction(linebot, "normalizeOfficialManualFileModelToken_")}
   ${extractFunction(linebot, "buildOfficialManualFinalFileName_")}
   globalThis.manuals = extractEmbeddedJsonArrayByKey_('{"manuals":[{"contentsTypeCode":"UM","languageList":[{"orgCode":"ZH2"}],"areaList":[{"code":"TW"}],"downloadUrl":"https://org.downloadcenter.samsung.com/downloadfile/ContentsFile.aspx?CDSite=UNI_TW&CDCttType=UM"}],"softwares":[]}', "manuals");
   globalThis.safe = isSafeSamsungTwManualDownload_(manuals[0].downloadUrl);
   globalThis.wrongMarket = isSafeSamsungTwManualDownload_("https://org.downloadcenter.samsung.com/downloadfile/ContentsFile.aspx?CDSite=UNI_UK&CDCttType=UM");
   globalThis.wrongType = isSafeSamsungTwManualDownload_("https://org.downloadcenter.samsung.com/downloadfile/ContentsFile.aspx?CDSite=UNI_TW&CDCttType=FM");
   globalThis.sharedName = buildOfficialManualFinalFileName_(["S32HG806ES","S27HG806EF"], "LS32HG806ESXZW");
   globalThis.singleName = buildOfficialManualFinalFileName_(["S27FG532EC"], "LS27FG532ECXZW");
   globalThis.hSeriesName = buildOfficialManualFinalFileName_(["S27H704EAC","S32H704EAC","S27H802UAC","S32H802UAC","S27H802EFA","S40H850TAC"], "LS40H850TACXZW");
   globalThis.mismatchName = buildOfficialManualFinalFileName_(["S27FG532EC"], "LS32HG806ESXZW");`,
  manualDiscoveryVm,
);
assert(
  manualDiscoveryVm.manuals.length === 1 &&
    manualDiscoveryVm.safe === true &&
    manualDiscoveryVm.wrongMarket === false &&
    manualDiscoveryVm.wrongType === false &&
    manualDiscoveryVm.sharedName === "S27HG806,S32HG806.pdf" &&
    manualDiscoveryVm.singleName === "S27FG532.pdf" &&
    manualDiscoveryVm.hSeriesName === "S27H704,S27H802,S32H704,S32H802,S40H850.pdf" &&
    manualDiscoveryVm.mismatchName === "" &&
    /_PENDING_MANUAL_REVIEW/.test(
      extractFunction(linebot, "stageOfficialTwManualCandidate_"),
    ) &&
    /validateOfficialManualFirstPage_/.test(
      extractFunction(linebot, "stageOfficialTwManualCandidate_"),
    ) &&
    /promoteOfficialManualToRoot_/.test(
      extractFunction(linebot, "stageOfficialTwManualCandidate_"),
    ) &&
    /Drive\.Files\.update/.test(
      extractFunction(linebot, "promoteOfficialManualToRoot_"),
    ) &&
    /getRange\(sheet\.getLastRow\(\) \+ 1, 1, activatedRuleLines\.length, 1\)/.test(
      extractFunction(linebot, "scanOfficialWebsiteForNewMonitors"),
    ) &&
    /OFFICIAL_NEW_MODEL_CURSOR/.test(
      extractFunction(linebot, "scanOfficialWebsiteForNewMonitors"),
    ) &&
    /selectedNewProducts = orderedNewProducts\.slice\(0, 2\)/.test(
      extractFunction(linebot, "scanOfficialWebsiteForNewMonitors"),
    ) &&
    /PROMOTION_EXCEPTION_/.test(
      extractFunction(linebot, "stageOfficialTwManualCandidate_"),
    ) &&
    /upsertManualPdfToGemini_\([\s\S]*true/.test(
      extractFunction(linebot, "stageOfficialTwManualCandidate_"),
    ) &&
    /GEMINI_FILE_API_FALLBACK/.test(
      extractFunction(linebot, "stageOfficialTwManualCandidate_"),
    ) &&
    /readPdfModelIndexForCoverage_/.test(
      extractFunction(linebot, "getManualSourceCandidateModels_"),
    ) &&
    /isPdfModelTokenMatch_/.test(
      extractFunction(linebot, "getManualSourceCandidateModels_"),
    ) &&
    /!hasOfficialManualForModel_\(selectedModel\)/.test(
      extractFunction(linebot, "handleRichMenuPostback_"),
    ),
  "新手冊須以台灣三星 UM、第一頁型號與舊尾碼規則自動命名入庫；失敗才隔離重試，且每日限量",
);
const autoRuleVm = {
  normalizeModelForDisplay: (model) =>
    String(model).replace(/^LS/, "S").replace(/XZW$/, ""),
  isFullSamsungMonitorModelForOfficialPage_: (model) => /^S\d{2}[A-Z0-9]{6,}$/.test(model),
  isSafeSamsungTwOfficialUrl_: (url) => /^https:\/\/www\.samsung\.com\/tw\//.test(url),
};
vm.createContext(autoRuleVm);
vm.runInContext(
  `${extractFunction(linebot, "sanitizeOfficialRuleField_")}
   ${extractFunction(linebot, "buildOfficialMinimalRuleLine_")}
   globalThis.ruleLine = buildOfficialMinimalRuleLine_({model:"LS32HG732SCXZW",displayName:"32吋 Odyssey, OLED G7",detailUrl:"https://www.samsung.com/tw/monitors/gaming/example/",officialHighlights:["4K OLED","雙模式：4K 或 330Hz"]});`,
  autoRuleVm,
);
assert(
  autoRuleVm.ruleLine.startsWith(
    "LS32HG732SCXZW,型號：S32HG732SC,官方新品自動驗證,",
  ) &&
    /產品名稱：32吋 Odyssey OLED G7/.test(autoRuleVm.ruleLine) &&
    /官方特色：4K OLED；雙模式：4K 或 330Hz/.test(autoRuleVm.ruleLine) &&
    /官網網址：https:\/\/www\.samsung\.com\/tw\//.test(autoRuleVm.ruleLine),
  "新品最小 RULE 必須保持 A 欄 CSV 架構，且只使用已驗證官方欄位",
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
    "LS32HG806ESXZW,型號：S32HG806ES,32吋 Odyssey IPS G8,雙模 6K 165Hz / 3K 330Hz,1ms反應時間,HDMI 2.1 x2,VESA 100x100mm壁掛,HAS人體工學升降底座(120mm),左右旋轉-30.0°~30.0°,垂直旋轉-92.0°~92.0°",
};
vm.createContext(deterministicRuleVm);
vm.runInContext(
  `${extractFunction(linebot, "buildDeterministicExactRuleReply_")}\n${extractFunction(linebot, "buildKnownRuleAnchorForMixedOperation_")}\n${extractFunction(linebot, "mergeKnownRuleAnchorWithAdvancedAnswer_")}\nglobalThis.operation = buildDeterministicExactRuleReply_("S32HG806ES 如何切換雙模？", "S32HG806ES");\nglobalThis.fact = buildDeterministicExactRuleReply_("S32HG806ES 更新率是多少？", "S32HG806ES");\nglobalThis.mount = buildDeterministicExactRuleReply_("S32HG806ES 可以壁掛嗎？VESA 幾乘幾？支架能旋轉嗎？", "S32HG806ES");\nglobalThis.mixedAnchor = buildKnownRuleAnchorForMixedOperation_("S32HG806ES 怎麼連接？有幾個 HDMI？", "S32HG806ES");\nglobalThis.operationOnlyAnchor = buildKnownRuleAnchorForMixedOperation_("S32HG806ES 怎麼恢復原廠？", "S32HG806ES");\nglobalThis.mixedFinal = mergeKnownRuleAnchorWithAdvancedAnswer_(globalThis.mixedAnchor, "S32HG806ES 這款有兩個 HDMI 連接埠，請用 HDMI 線接到訊號源。\\n官方手冊：第23頁\\n[來源:官方手冊]");\nglobalThis.mixedConflict = mergeKnownRuleAnchorWithAdvancedAnswer_(globalThis.mixedAnchor, "S32HG806ES 這款有 1 個 HDMI 2.0 連接埠，請切換到正確輸入來源。\\n官方手冊：第23頁\\n[來源:官方手冊]");`,
  deterministicRuleVm,
);
vm.runInContext(
  'globalThis.mixedPronoun = mergeKnownRuleAnchorWithAdvancedAnswer_(globalThis.mixedAnchor, "這款有兩個 HDMI 連接埠，請用 HDMI 線接到訊號源。\\n官方手冊：第23頁\\n[來源:官方手冊]");',
  deterministicRuleVm,
);
assert(
  deterministicRuleVm.operation === "" &&
    /雙模 6K 165Hz \/ 3K 330Hz/.test(deterministicRuleVm.fact),
  "操作步驟不得被 RULE 支援事實冒充；明載規格題仍可零成本回答",
);
assert(
  /VESA 100x100mm/.test(deterministicRuleVm.mount) &&
    /左右旋轉-30\.0°~30\.0°/.test(deterministicRuleVm.mount) &&
    /垂直旋轉-92\.0°~92\.0°/.test(deterministicRuleVm.mount),
  "同一 RULE 複合規格題必須逐項回答 VESA 與旋轉，不得只回第一個欄位",
);
assert(
  /HDMI/.test(deterministicRuleVm.mixedAnchor) &&
    deterministicRuleVm.operationOnlyAnchor === "" &&
    /已確認規格/.test(deterministicRuleVm.mixedFinal) &&
    /手冊補充/.test(deterministicRuleVm.mixedFinal) &&
    (deterministicRuleVm.mixedFinal.match(/2 個 HDMI/g) || []).length === 1 &&
    !/兩個 HDMI/.test(deterministicRuleVm.mixedPronoun) &&
    /請用 HDMI 線接到訊號源/.test(
      deterministicRuleVm.mixedPronoun,
    ) &&
    !/1 個 HDMI/.test(deterministicRuleVm.mixedConflict) &&
    /以上方已確認規格為準/.test(deterministicRuleVm.mixedConflict),
  "操作＋規格複合題必須保留 RULE 已知事實、去除 PDF 重複句，只把未解操作交手冊",
);
const unsafeRuleVm = {
  normalizeModelForDisplay: (model) => model,
  buildDeterministicComparisonReply_: () => "",
  findExactModelRuleLine_: (model) =>
    model === "S24D300GAC"
      ? "LS24D300GACXZW,型號：S24D300GAC,24吋 IPS,FHD,HDMI x1"
      : "LS32FM501ECXZW,型號：S32FM501EC,Smart Monitor,Tizen,HDMI x2",
};
vm.createContext(unsafeRuleVm);
vm.runInContext(
  `${extractFunction(linebot, "buildDeterministicExactRuleReply_")}\nglobalThis.phoneCast = buildDeterministicExactRuleReply_("S24D300GAC 可以手機無線投影嗎？", "S24D300GAC");\nglobalThis.lineTv = buildDeterministicExactRuleReply_("S32FM501EC 可以安裝 LINE TV 嗎？", "S32FM501EC");\nglobalThis.blackScreen = buildDeterministicExactRuleReply_("S24D300GAC 黑屏怎麼排除？", "S24D300GAC");`,
  unsafeRuleVm,
);
assert.strictEqual(unsafeRuleVm.phoneCast, "");
assert.strictEqual(unsafeRuleVm.lineTv, "");
assert.strictEqual(
  unsafeRuleVm.blackScreen,
  "",
  "RULE 沒有直接證據的投影、App 與故障題必須交給 QA／手冊，不得硬編答案",
);
const safeNoEvidenceVm = {
  findExactModelRuleLine_: (model) =>
    model === "S32FM501EC"
      ? "LS32FM501ECXZW,型號：S32FM501EC,Smart Monitor,Tizen,HDMI x2"
      : "LS24D300GACXZW,型號：S24D300GAC,24吋 IPS,FHD,HDMI x1",
};
vm.createContext(safeNoEvidenceVm);
vm.runInContext(
  `${extractFunction(linebot, "buildSafeNoEvidenceNextStep_")}\nglobalThis.nonSmartApp = buildSafeNoEvidenceNextStep_("可以安裝 Netflix 嗎？", "S24D300GAC");\nglobalThis.smartApp = buildSafeNoEvidenceNextStep_("可以安裝 Netflix 嗎？", "S32FM501EC");`,
  safeNoEvidenceVm,
);
assert(
  !/首頁 → 應用程式/.test(safeNoEvidenceVm.nonSmartApp) &&
    /沒有足夠證據確認這款具備內建 App 商店/.test(
      safeNoEvidenceVm.nonSmartApp,
    ) &&
    /首頁 → 應用程式/.test(safeNoEvidenceVm.smartApp),
  "無證據 App 終點只有 RULE 明載 Smart/Tizen 才可提供 Apps 選單，非 Smart 型號不得捏造路徑",
);
const operationIntentVm = {};
vm.createContext(operationIntentVm);
vm.runInContext(
  `${extractFunction(linebot, "isOperationOrTroubleshootQuery")}\nglobalThis.colorSymptom = isOperationOrTroubleshootQuery("S32HG806ES 開 Eye Saver 後畫面偏黃正常嗎？");`,
  operationIntentVm,
);
assert.strictEqual(
  operationIntentVm.colorSymptom,
  true,
  "偏色／偏黃等顯示故障必須走操作證據路由，不能由 Fast 無來源猜測",
);

console.log("三來源狀態、配額、postback 與 TestUI 契約通過。");
