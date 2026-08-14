const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const linebot = fs.readFileSync(path.join(root, "linebot.gs"), "utf8");
const testUi = fs.readFileSync(path.join(root, "TestUI.html"), "utf8");
const prompt = fs.readFileSync(path.join(root, "Prompt.csv"), "utf8");
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

const llmText = extractFunction(linebot, "callLLMWithRetry");
const manualModelResolverText = extractFunction(
  linebot,
  "resolveManualSourceModel_",
);
assert(
  manualModelResolverText.includes("extractFullModelLikeTokens") &&
    !manualModelResolverText.includes("previousModel") &&
    !manualModelResolverText.includes("last_selected_model") &&
    !manualModelResolverText.includes("direct_search_models"),
  "手冊新題不得沿用上一題或舊路由快取",
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
  /SOURCE_DAILY_LIMITS\s*=\s*\{\s*manual:\s*5,\s*web:\s*10\s*\}/.test(linebot),
  "手冊 5 次、網路 10 次額度不可漂移",
);
assert(
  /USER_DAILY_QUESTION_LIMIT\s*=\s*20/.test(linebot) &&
    /function reserveDailyQuestionUsage_/.test(linebot) &&
    /getUserLock\(\)/.test(extractFunction(linebot, "reserveDailyQuestionUsage_")) &&
    /USR_QDAY_/.test(linebot),
  "每位使用者每日 20 次提問必須持久化並以鎖原子保留",
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

const pending = context.writePendingSourceState_("C2", { source: "manual" });
pending.expiresAt = Date.now() - 1;
const pendingKey = context.getSourcePendingKey_("C2");
cache.put(pendingKey, JSON.stringify(pending));
props.setProperty(pendingKey, JSON.stringify(pending));
assert.strictEqual(context.readPendingSourceState_("C2", false), null);

assert(/function testSourcePostback\(/.test(linebot), "TestUI 有正式 postback 模擬入口");
assert(/selectSource\('manual'\)/.test(testUi) && /usePreviousSource\(\)/.test(testUi), "TestUI 可按三來源與查上一題");
assert(
  /source-model-bar/.test(testUi) &&
    /select_manual_model/.test(testUi) &&
    /modelCandidates/.test(testUi),
  "TestUI 必須能顯示並點選手冊候選型號",
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
  /① 直接問問題/.test(testUi) &&
    /② 官方手冊重查/.test(testUi) &&
    /③ 網路解答重查/.test(testUi),
  "TestUI 必須呈現先提問、再依需要重查的資訊層級",
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
