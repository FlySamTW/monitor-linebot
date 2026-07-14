const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertStep(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function extractFunction(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assertStep(start >= 0, `${functionName} not found`);
  const braceStart = source.indexOf("{", start);
  assertStep(braceStart > start, `${functionName} opening brace not found`);
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    if (depth === 0) {
      return source.slice(start, i + 1);
    }
  }
  throw new Error(`${functionName} closing brace not found`);
}

function stripNonExecutableComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const linebot = read("linebot.gs");
const deployBat = read("deploy.bat");
const deployExistingWebhook = read("tools/deploy_existing_webhook.ps1");
const releaseExistingWebhook = read("tools/release_existing_webhook.ps1");
const syncPrompt = read("tools/sync_prompt_c3.ps1");
const developmentLog = read("DEVELOPMENT_LOG.md");
const developerManual = read("程式編寫開發及功能手冊.md");
const aiContext = read("AI_CONTEXT.md");
const copilotInstructions = read(".github/copilot-instructions.md");
const toolsReadme = read("tools/README.md");
const packageJson = JSON.parse(read("test_runner/package.json"));
const localVersion = (linebot.match(/const GAS_VERSION = "(v[\d.]+)"/) || [])[1];

assertStep(localVersion, "linebot.gs must expose GAS_VERSION");

const doPostSection = extractFunction(linebot, "doPost");
const doGetSection = extractFunction(linebot, "doGet");

assertStep(
    /function getDoGetMaintenanceSecret_/.test(linebot) &&
    /function isDoGetMaintenanceAuthorized_/.test(linebot) &&
    /function buildUnauthorizedResponse_/.test(linebot) &&
    /MAINTENANCE_SECRET/.test(linebot) &&
    /OPENCODE_WRITE_SECRET/.test(linebot) &&
    !/getDoGetMaintenanceSecret_[\s\S]{0,400}GEMINI_API_KEY/.test(linebot),
  "doGet maintenance helpers must require a real secret before sensitive operations",
);

const productionGeminiModels = [
  "GEMINI_MODEL_FAST",
  "GEMINI_MODEL_THINK",
  "GEMINI_MODEL_POLISH",
];

const providerMatch = linebot.match(/const\s+LLM_PROVIDER\s*=\s*"([^"]+)"/);
assertStep(providerMatch, "LLM_PROVIDER must be defined");
assertStep(
  providerMatch[1] === "Gemini",
  "production LLM_PROVIDER must stay on Gemini unless a new cost review intentionally updates this guard",
);

const openRouterModelMatch = linebot.match(/const\s+OPENROUTER_MODEL\s*=\s*"([^"]+)"/);
assertStep(openRouterModelMatch, "OPENROUTER_MODEL must be defined");
assertStep(
  openRouterModelMatch[1] === "qwen/qwen-2.5-7b-instruct",
  "inactive OpenRouter fallback must not drift to an unreviewed or high-cost model",
);

for (const constantName of productionGeminiModels) {
  const match = linebot.match(
    new RegExp(`const\\s+${constantName}\\s*=\\s*"([^"]+)"`),
  );
  assertStep(match, `${constantName} must be defined`);
  assertStep(
    match[1] === "models/gemini-2.5-flash-lite",
    `${constantName} must be pinned to models/gemini-2.5-flash-lite, not a drifting latest alias`,
  );
}

assertStep(
  !/const\s+GEMINI_MODEL_(FAST|THINK|POLISH)\s*=\s*"[^"]*latest"/.test(linebot),
  "production Gemini model constants must not use latest aliases",
);

const executableLinebot = stripNonExecutableComments(linebot);

assertStep(
  !/["']models\/gemini-(?!2\.5-flash-lite["'])[^"']+["']/i.test(executableLinebot),
  "executable GAS code must not hard-code Gemini models other than models/gemini-2.5-flash-lite",
);

assertStep(
  !/gemini-[^"']*(latest|exp)/i.test(executableLinebot),
  "executable GAS code must not use Gemini latest or experimental aliases",
);

assertStep(
  !/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-/i.test(executableLinebot),
  "Gemini generateContent URLs must use CONFIG model constants instead of hard-coded model paths",
);

const campaignRuleGuardCode = [
  "const writeLog = () => {};",
  "const SHEET_NAMES = { CLASS_RULES: 'CLASS_RULES' };",
  `const ss = {
    getSheetByName(name) {
      if (name !== SHEET_NAMES.CLASS_RULES) return null;
      const values = [
        [
          "活動_202605_202609螢幕登錄送,電腦螢幕活動RULE,活動內容：S27HG806EF、S32HG806ES 登錄送 Steam 1,000元點卡；指定高階螢幕如 S34BG850SC 登錄送全機延長保固兩年；指定螢幕機種可參加月月抽 Galaxy S26 系列手機"
        ],
        [
          "別稱_G5,Odyssey G5入門電競，型號模式為：G5,S27?G5*,S32?G5*"
        ]
      ];
      return {
        getLastRow: () => values.length + 1,
        getRange: () => ({ getValues: () => values })
      };
    }
  };`,
  extractFunction(linebot, "extractModelNumbers"),
  extractFunction(linebot, "findLocalCampaignRuleForQuery"),
  `
  globalThis.__campaignRuleGuardResult = {
    exactSteam: !!findLocalCampaignRuleForQuery("S27HG806EF 本期三星螢幕登錄活動送什麼？"),
    exactWarranty: !!findLocalCampaignRuleForQuery("S34BG850SC 本期登錄活動有什麼資格或贈品？"),
    aliasOnly: !!findLocalCampaignRuleForQuery("G5 活動有哪些？"),
    specOnly: !!findLocalCampaignRuleForQuery("S27HG806EF 解析度是多少？")
  };
  `,
].join("\n\n");
const campaignRuleGuardContext = {};
vm.createContext(campaignRuleGuardContext);
vm.runInContext(campaignRuleGuardCode, campaignRuleGuardContext);

assertStep(
  campaignRuleGuardContext.__campaignRuleGuardResult.exactSteam === true &&
    campaignRuleGuardContext.__campaignRuleGuardResult.exactWarranty === true,
  "known local Samsung monitor campaign RULE rows must bypass the timely-web guard",
);

assertStep(
  campaignRuleGuardContext.__campaignRuleGuardResult.aliasOnly === false,
  "alias-only campaign questions must not bypass the timely-web guard as if they were exact model RULE hits",
);

assertStep(
  campaignRuleGuardContext.__campaignRuleGuardResult.specOnly === false,
  "non-campaign spec questions must not be treated as local campaign RULE hits",
);

const handleMessageSection = extractFunction(linebot, "handleMessage");
assertStep(
  /isTimelyWebInfoQuery\(msg\)\s*&&\s*!\s*findLocalCampaignRuleForQuery\(msg\)/.test(
    handleMessageSection,
  ),
  "timely-web guard must let existing local campaign RULE matches proceed into Fast Mode",
);

assertStep(
  /looksLikeMissingDataReply[\s\S]*Auto Web Block v29\.6\.033[\s\S]*AUTO_SEARCH_WEB/.test(
    handleMessageSection,
  ),
  "Fast Mode missing-data answers must be converted into the web-search confirmation flow",
);

assertStep(
  /需要幫你在網路上進行擴大搜尋嗎/.test(handleMessageSection) &&
    !/\[來源:缺失\]/.test(handleMessageSection),
  "web-search confirmation rewrite must not invent a missing-data source tag",
);

assertStep(
  !/JSON\.stringify\(results\)/.test(doPostSection + doGetSection),
  "maintenance webhook endpoints must not stringify undefined results objects",
);

const testModelsStart = doGetSection.indexOf('e.parameter.testModels === "1"');
const testModelsEnd = doGetSection.indexOf("v29.6.021: 批次自動化測試", testModelsStart);
assertStep(testModelsStart >= 0, "doGet testModels branch not found");
assertStep(testModelsEnd > testModelsStart, "doGet testModels branch end not found");
const testModelsSection = doGetSection.slice(testModelsStart, testModelsEnd);

assertStep(
  /isDoGetMaintenanceAuthorized_\(e\)/.test(testModelsSection) &&
    /buildUnauthorizedResponse_\(\)/.test(testModelsSection),
  "doGet testModels must require a secret before making any LLM calls",
);

assertStep(
  /CONFIG\.MODEL_NAME_FAST/.test(testModelsSection) &&
    /CONFIG\.MODEL_NAME_THINK/.test(testModelsSection) &&
    /GEMINI_MODEL_POLISH/.test(testModelsSection) &&
    !/models\/gemini-(?!2\.5-flash-lite)/i.test(stripNonExecutableComments(testModelsSection)) &&
    !/gemini-[^"']*(latest|exp)/i.test(stripNonExecutableComments(testModelsSection)),
  "doGet testModels must only test the pinned production Flash Lite model constants",
);

const batchTestStart = doGetSection.indexOf('e.parameter.batchTest === "1"');
const batchTestEnd = doGetSection.indexOf("v29.6.010: 讀取 CLASS_RULES", batchTestStart);
assertStep(batchTestStart >= 0, "doGet batchTest branch not found");
assertStep(batchTestEnd > batchTestStart, "doGet batchTest branch end not found");
const batchTestSection = doGetSection.slice(batchTestStart, batchTestEnd);

assertStep(
  /isDoGetMaintenanceAuthorized_\(e\)/.test(batchTestSection) &&
    /buildUnauthorizedResponse_\(\)/.test(batchTestSection) &&
    /callLLMWithRetry/.test(batchTestSection),
  "doGet batchTest must require a secret before running multiple LLM calls",
);

const testRunStart = doGetSection.indexOf('e.parameter.testRun === "1"');
const testRunEnd = doGetSection.indexOf("v29.6.005: 從「所有紀錄」Sheet", testRunStart);
assertStep(testRunStart >= 0, "doGet testRun branch not found");
assertStep(testRunEnd > testRunStart, "doGet testRun branch end not found");
const testRunSection = doGetSection.slice(testRunStart, testRunEnd);

assertStep(
  /isDoGetMaintenanceAuthorized_\(e\)/.test(testRunSection) &&
    /buildUnauthorizedResponse_\(\)/.test(testRunSection) &&
    /handleMessage\(fakeEvent\)/.test(testRunSection),
  "doGet testRun must require a secret before running the full LINEBot LLM flow",
);

const postWriteRulesStart = doPostSection.indexOf('json.action === "write_rules"');
const postWriteRulesEnd = doPostSection.indexOf('json.action === "upload_manual_pdf"', postWriteRulesStart);
assertStep(postWriteRulesStart >= 0, "doPost write_rules branch not found");
assertStep(postWriteRulesEnd > postWriteRulesStart, "doPost write_rules branch end not found");
const postWriteRulesSection = doPostSection.slice(postWriteRulesStart, postWriteRulesEnd);

assertStep(
  /getDoGetMaintenanceSecret_\(\)/.test(postWriteRulesSection) &&
    /Unauthorized/.test(postWriteRulesSection) &&
    !/GEMINI_API_KEY/.test(postWriteRulesSection) &&
    /Array\.isArray\(json\.rules\)/.test(postWriteRulesSection) &&
    /No rules provided/.test(postWriteRulesSection) &&
    /Rules must not be blank/.test(postWriteRulesSection) &&
    /Spreadsheet is not available/.test(postWriteRulesSection),
  "doPost write_rules must return clean JSON for auth, empty payload, blank rules, and missing spreadsheet errors",
);

const getWriteRulesStart = doGetSection.indexOf('e.parameter.writeRules === "1"');
const getWriteRulesEnd = doGetSection.indexOf("v29.6.020: 移除測試端點", getWriteRulesStart);
assertStep(getWriteRulesStart >= 0, "doGet writeRules branch not found");
assertStep(getWriteRulesEnd > getWriteRulesStart, "doGet writeRules branch end not found");
const getWriteRulesSection = doGetSection.slice(getWriteRulesStart, getWriteRulesEnd);

assertStep(
  /No rules provided/.test(getWriteRulesSection) &&
    /Rules must not be blank/.test(getWriteRulesSection) &&
    /Spreadsheet is not available/.test(getWriteRulesSection),
  "doGet writeRules must return clean JSON for empty payload, blank rules, and missing spreadsheet errors",
);

for (const staleMainFile of [
  "linebot.js",
  "linebot.gs.bak",
  "linebot.gs.pre_v295158.bak",
]) {
  assertStep(
    !fs.existsSync(path.join(root, staleMainFile)),
    `${staleMainFile} must not be kept in the repository; linebot.gs is the only authoritative main GAS source`,
  );
}

assertStep(
  developerManual.includes(`完整流程解析 (${localVersion})`) &&
    developerManual.includes(`現行鐵律 SOP（${localVersion}）`),
  "developer manual headline and SOP version must match linebot.gs GAS_VERSION",
);

assertStep(
  developmentLog.includes(localVersion),
  "DEVELOPMENT_LOG.md must mention the current linebot.gs GAS_VERSION",
);

assertStep(
  /CONF-001\s*\|\s*Prompt!C3\s*\|/.test(aiContext) &&
    /Prompt\.csv[\s\S]*本地鏡像\/人工備份/.test(aiContext) &&
    /部署流程不會自動把它上傳到 Google Sheet/.test(aiContext),
  "AI_CONTEXT.md must document Google Sheet Prompt!C3 as the runtime prompt source and Prompt.csv as a local mirror only",
);

assertStep(
  /QA 資料庫[\s\S]*CLASS_RULES[\s\S]*官方 PDF 手冊[\s\S]*網路搜尋\/官方頁[\s\S]*誠實告知無資料/.test(
    aiContext,
  ) && !/LLM 通用知識\s*>\s*PDF 手冊/.test(aiContext),
  "AI_CONTEXT.md must preserve the current QA/RULES -> PDF -> WEB/no-data routing order and must not put LLM knowledge before PDF",
);

assertStep(
  /禁止只 `clasp push` 後宣稱完成/.test(aiContext) &&
    /禁止新建 deployment ID/.test(aiContext) &&
    /Prompt 維護鐵律/.test(aiContext) &&
    /除非使用者明確要求，程式部署不得同步或覆蓋 `Prompt!C3`/.test(aiContext),
  "AI_CONTEXT.md must document the current deployment and Prompt maintenance iron rules",
);

assertStep(
  /正式 Prompt 位於 Google Sheet `Prompt!C3`/.test(copilotInstructions) &&
    /`Prompt\.csv` 只是本地鏡像\/人工備份/.test(copilotInstructions) &&
    /部署流程不得自動同步或覆蓋 `Prompt!C3`/.test(copilotInstructions),
  ".github/copilot-instructions.md must not direct IDE agents to treat Prompt.csv as the runtime prompt",
);

assertStep(
  /deploy_existing_webhook\.ps1/.test(copilotInstructions) &&
    /clasp deploy -i AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA -V <新版本>/.test(
      copilotInstructions,
    ) &&
    /不可只 `clasp push`/.test(copilotInstructions) &&
    /不可新建正式 deployment/.test(copilotInstructions),
  ".github/copilot-instructions.md must require updating the existing formal deployment, not creating a new one",
);

assertStep(
  /QA Sheet[\s\S]*CLASS_RULES[\s\S]*官方 PDF 手冊[\s\S]*WEB \/ 官方頁[\s\S]*誠實告知無資料/.test(
    copilotInstructions,
  ) &&
    !/LLM 通用知識\s*>\s*PDF/.test(copilotInstructions) &&
    /不可用 LLM 通用知識編造產品規格/.test(copilotInstructions),
  ".github/copilot-instructions.md must preserve the project routing SOP and forbid product hallucination",
);

assertStep(
  /版本數已滿\s*200[\s\S]*推送\s*`HEAD`\s*前停止/.test(toolsReadme) &&
    /不可為了繞過版本上限新建正式 deployment ID/.test(toolsReadme),
  "tools README must document the 200-version deployment blocker and forbid new deployment IDs",
);

const dynamicPromptStart = linebot.indexOf("function constructDynamicPrompt");
const dynamicPromptEnd = linebot.indexOf("function callLLMWithRetry", dynamicPromptStart);
assertStep(dynamicPromptStart >= 0, "constructDynamicPrompt not found");
assertStep(dynamicPromptEnd > dynamicPromptStart, "constructDynamicPrompt section end not found");
const dynamicPromptSection = linebot.slice(dynamicPromptStart, dynamicPromptEnd);

assertStep(
  !/sync_prompt_c3|GAS_ADMIN_SECRET|Prompt\.csv\s+to\s+Google Sheet/i.test(
    deployBat + deployExistingWebhook,
  ),
  "deployment scripts must not sync Prompt.csv or depend on GAS_ADMIN_SECRET",
);

assertStep(
  /deploy_existing_webhook\.ps1/.test(deployBat),
  "deploy.bat should delegate to the non-interactive existing-webhook deploy script",
);

assertStep(
  /clasp",\s*"-i",\s*\$DeploymentId,\s*"-V"/.test(deployExistingWebhook) ||
    /"deploy",\s*"-i",\s*\$DeploymentId,\s*"-V"/.test(deployExistingWebhook),
  "deploy_existing_webhook.ps1 must update an existing deployment with -i and -V",
);

assertStep(
  !/"deploy"\s*\)/.test(deployExistingWebhook),
  "deploy_existing_webhook.ps1 must not create a new deployment without -i",
);

assertStep(
  /Prompt source\s*:\s*Google Sheet Prompt!C3/.test(deployExistingWebhook) &&
    /Prompt was not modified/.test(deployExistingWebhook),
  "deploy_existing_webhook.ps1 must explicitly preserve Google Sheet Prompt!C3",
);

assertStep(
  /deploy_existing_webhook\.ps1/.test(releaseExistingWebhook) &&
    /check_deploy_readiness\.ps1/.test(releaseExistingWebhook) &&
    /npm run test:static/.test(releaseExistingWebhook) &&
    /npm run check:webhook-version/.test(releaseExistingWebhook) &&
    /\[switch\]\$DryRun/.test(releaseExistingWebhook),
  "release_existing_webhook.ps1 must orchestrate static guards, existing deployment update, readiness check, and formal version guard",
);

assertStep(
  /Prompt source\s*:\s*Google Sheet Prompt!C3/.test(releaseExistingWebhook) &&
    /Prompt sync\s*:\s*skipped by design/.test(releaseExistingWebhook) &&
    !/sync_prompt_c3/.test(releaseExistingWebhook),
  "release_existing_webhook.ps1 must not sync or overwrite Google Sheet Prompt!C3",
);

assertStep(
  /Cannot create more versions/.test(deployExistingWebhook) &&
    /Do not create a new deployment ID/.test(deployExistingWebhook),
  "deploy_existing_webhook.ps1 must block safely at the Apps Script version limit",
);

assertStep(
  /Created version\\s\+\(\[\\d,\]\+\)/.test(deployExistingWebhook) &&
    /-replace\s+",",\s*""/.test(deployExistingWebhook),
  "deploy_existing_webhook.ps1 must parse clasp version numbers that include thousands separators",
);

assertStep(
  /Get-ClaspVersionCount/.test(deployExistingWebhook) &&
    /Check Apps Script version capacity before pushing HEAD/.test(deployExistingWebhook),
  "deploy_existing_webhook.ps1 must preflight version capacity before pushing HEAD",
);

assertStep(
  deployExistingWebhook.indexOf("Check Apps Script version capacity before pushing HEAD") <
    deployExistingWebhook.indexOf('Invoke-Clasp -Arguments @("push", "-f")'),
  "deploy_existing_webhook.ps1 must not push HEAD before checking the 200-version limit",
);

assertStep(
  /PromptPath is required/.test(syncPrompt) && /ConfirmOverwrite/.test(syncPrompt),
  "sync_prompt_c3.ps1 must require explicit PromptPath and ConfirmOverwrite",
);

assertStep(
  !/Prompt\.csv/.test(dynamicPromptSection),
  "active dynamic prompt comments/instructions must not point to Prompt.csv",
);

assertStep(
  /Google Sheet Prompt!C3/.test(dynamicPromptSection),
  "active dynamic prompt section should document Prompt!C3 as the runtime prompt source",
);

const normalizeStart = linebot.indexOf("function normalizeSourceTagFromRaw");
const normalizeEnd = linebot.indexOf("function appendSourceTagIfMissing", normalizeStart);
assertStep(normalizeStart >= 0, "normalizeSourceTagFromRaw not found");
assertStep(normalizeEnd > normalizeStart, "normalizeSourceTagFromRaw section end not found");
const normalizeSourceSection = linebot.slice(normalizeStart, normalizeEnd);

assertStep(
  !/手冊\|PDF[\s\S]*return\s+"\[來源:產品手冊\]"/.test(normalizeSourceSection),
  "Fast Mode must not normalize AI-provided PDF/manual source tags into product-manual sources",
);

assertStep(
  /手冊\|PDF[\s\S]*return\s+""/.test(normalizeSourceSection),
  "Fast Mode should discard AI-provided PDF/manual source tags when no PDF is attached",
);

const sourceNormalizeCode = [
  "const writeLog = () => {};",
  extractFunction(linebot, "isCampaignRuleReplyText_"),
  extractFunction(linebot, "normalizeSourceTagFromRaw"),
  `
  globalThis.__sourceNormalizeResult = {
    exactQa: normalizeSourceTagFromRaw("[來源:QA]"),
    exactQaDb: normalizeSourceTagFromRaw("[來源:QA庫]"),
    exactRules: normalizeSourceTagFromRaw("[來源:規格庫]"),
    exactOfficialRules: normalizeSourceTagFromRaw("[來源:官方規格庫]"),
    exactCampaign: normalizeSourceTagFromRaw("[來源:規格庫]\\n這次活動有 Steam 點卡與延長保固。"),
    exactOfficialCampaign: normalizeSourceTagFromRaw("[來源:官方活動庫]"),
    fuzzyQaDb: normalizeSourceTagFromRaw("[來源:QA資料庫]"),
    fuzzySpecTable: normalizeSourceTagFromRaw("[來源:產品規格表]"),
    manual: normalizeSourceTagFromRaw("[來源:產品手冊]")
  };
  `,
].join("\n\n");
const sourceNormalizeContext = {};
vm.createContext(sourceNormalizeContext);
vm.runInContext(sourceNormalizeCode, sourceNormalizeContext);

assertStep(
  sourceNormalizeContext.__sourceNormalizeResult.exactQa === "[來源:QA庫]",
  "Fast Mode should normalize exact QA source into [來源:QA庫]",
);

assertStep(
  sourceNormalizeContext.__sourceNormalizeResult.exactQaDb === "[來源:QA庫]",
  "Fast Mode should preserve exact [來源:QA庫] labels",
);

assertStep(
  sourceNormalizeContext.__sourceNormalizeResult.exactRules === "[來源:官方規格庫]",
  "Fast Mode should normalize exact rules source into [來源:官方規格庫]",
);

assertStep(
  sourceNormalizeContext.__sourceNormalizeResult.exactOfficialRules === "[來源:官方規格庫]",
  "Fast Mode should preserve exact [來源:官方規格庫] labels",
);

assertStep(
  sourceNormalizeContext.__sourceNormalizeResult.exactCampaign === "[來源:官方活動庫]",
  "campaign RULE answers should normalize into [來源:官方活動庫]",
);

assertStep(
  sourceNormalizeContext.__sourceNormalizeResult.exactOfficialCampaign === "[來源:官方活動庫]",
  "Fast Mode should preserve exact [來源:官方活動庫] labels",
);

assertStep(
  sourceNormalizeContext.__sourceNormalizeResult.fuzzyQaDb === "",
  "Fast Mode must reject fuzzy [來源:QA資料庫] labels",
);

assertStep(
  sourceNormalizeContext.__sourceNormalizeResult.fuzzySpecTable === "",
  "Fast Mode must reject fuzzy product-spec-table labels",
);

assertStep(
  sourceNormalizeContext.__sourceNormalizeResult.manual === "",
  "Fast Mode must reject manual/PDF source labels when no PDF is attached",
);

const qaSourceInferenceCode = [
  "const writeLog = () => {};",
  "const SHEET_NAMES = { QA: 'QA' };",
  `const CacheService = {
    getScriptCache() {
      const store = {};
      return {
        get: (key) => store[key] || null,
        put: (key, value) => { store[key] = value; }
      };
    }
  };`,
  `const ss = {
    getSheetByName(name) {
      if (name !== SHEET_NAMES.QA) return null;
      const rows = [
        ["請問 M8 和 M9 有陀螺儀和 HAS 嗎？畫面會隨著螢幕而直式或橫式顯示嗎？ / A：是的，M8 和 M9 有陀螺儀和 HAS，並且畫面會隨著螢幕而自動切換直式或橫式顯示。"]
      ];
      return {
        getLastRow: () => rows.length,
        getRange: () => ({ getValues: () => rows })
      };
    }
  };`,
  extractFunction(linebot, "tokenizeForSourceInference"),
  extractFunction(linebot, "loadQaRowsForSourceInference"),
  extractFunction(linebot, "inferQaSourceTagFromFastReply"),
  `
  globalThis.__qaSourceInferenceResult = {
    inferred: inferQaSourceTagFromFastReply(
      "M8 和 M9 有陀螺儀和 HAS 嗎？畫面會跟著轉嗎？",
      "是的，M8 和 M9 都有內建陀螺儀和 HAS。畫面會自動跟著旋轉，變成直向或橫向顯示。",
      ""
    ),
    preservesExisting: inferQaSourceTagFromFastReply(
      "S27FG532EC 的解析度是什麼？",
      "S27FG532EC 是 QHD 解析度。",
      "[來源:官方規格庫]"
    )
  };
  `,
].join("\n\n");
const qaSourceInferenceContext = {};
vm.createContext(qaSourceInferenceContext);
vm.runInContext(qaSourceInferenceCode, qaSourceInferenceContext);

assertStep(
  qaSourceInferenceContext.__qaSourceInferenceResult.inferred === "[來源:QA庫]",
  "source fallback should infer QA when an untagged Fast Mode answer matches a QA row",
);

assertStep(
  qaSourceInferenceContext.__qaSourceInferenceResult.preservesExisting === "[來源:官方規格庫]",
  "source fallback must not override an existing trusted source tag",
);

const fastEscalationCode = [
  extractFunction(linebot, "isOperationAnswerInsufficient"),
  extractFunction(linebot, "isPinRecoveryQuery"),
  extractFunction(linebot, "isFactoryResetQueryWithoutPinIssue"),
  extractFunction(linebot, "isPinRecoveryOnlyAnswer"),
  extractFunction(linebot, "shouldEscalateFastAnswerToPdf"),
  `
  const genericStepAnswer = "1. 進入螢幕選單\\n2. 找到聲音或音量選項\\n3. 將音量調低或靜音";
  const pinRecoveryOnlyAnswer = "S32FM703 智慧聯網螢幕如果忘記 PIN 碼，可以撥打三星客服專線 0800-329-999，請客服人員協助遠端連線重設。";
  globalThis.__fastEscalationResult = {
    noTrustedSource: shouldEscalateFastAnswerToPdf({
      userQuestion: "S32FM703 如何調整音量？",
      hasPdfForModel: true,
      operationIntent: true,
      fastSourceTag: "",
      normalizedFastAnswer: genericStepAnswer
    }),
    trustedQa: shouldEscalateFastAnswerToPdf({
      userQuestion: "M8 和 M9 有陀螺儀嗎？",
      hasPdfForModel: true,
      operationIntent: true,
      fastSourceTag: "[來源:QA庫]",
      normalizedFastAnswer: genericStepAnswer
    }),
    trustedRules: shouldEscalateFastAnswerToPdf({
      userQuestion: "S27FG532EC 如何調整刷新率？",
      hasPdfForModel: true,
      operationIntent: true,
      fastSourceTag: "[來源:官方規格庫]",
      normalizedFastAnswer: genericStepAnswer
    }),
    capabilityOnly: shouldEscalateFastAnswerToPdf({
      userQuestion: "S27FG532EC 有 HDR 嗎？",
      hasPdfForModel: true,
      operationIntent: false,
      manualVerificationIntent: false,
      fastSourceTag: "",
      normalizedFastAnswer: genericStepAnswer
    }),
    factoryResetPinOnlyQa: shouldEscalateFastAnswerToPdf({
      userQuestion: "S32FM703如何恢復出廠",
      hasPdfForModel: true,
      operationIntent: true,
      fastSourceTag: "[來源:QA庫]",
      normalizedFastAnswer: pinRecoveryOnlyAnswer
    }),
    factoryResetGenericQaSteps: shouldEscalateFastAnswerToPdf({
      userQuestion: "S32FM703如何恢復出廠",
      hasPdfForModel: true,
      operationIntent: true,
      fastSourceTag: "[來源:QA庫]",
      normalizedFastAnswer: "1. 開啟螢幕選單。\\n2. 進入支援。\\n3. 選擇自我診斷。\\n4. 選擇重設。"
    }),
    pinForgotQa: shouldEscalateFastAnswerToPdf({
      userQuestion: "S32FM703 PIN碼忘記如何恢復出廠",
      hasPdfForModel: true,
      operationIntent: true,
      fastSourceTag: "[來源:QA庫]",
      normalizedFastAnswer: pinRecoveryOnlyAnswer
    })
  };
  `,
].join("\n\n");
const fastEscalationContext = {};
vm.createContext(fastEscalationContext);
vm.runInContext(fastEscalationCode, fastEscalationContext);

assertStep(
  fastEscalationContext.__fastEscalationResult.noTrustedSource === true,
  "operation/manual questions with PDF available must not trust generic Fast Mode steps without a trusted source",
);

assertStep(
  fastEscalationContext.__fastEscalationResult.trustedQa === false,
  "operation/manual questions may stay in Fast Mode when a trusted QA answer is sufficient",
);

assertStep(
  fastEscalationContext.__fastEscalationResult.trustedRules === false,
  "operation/manual questions may stay in Fast Mode when a trusted rules answer is sufficient",
);

assertStep(
  fastEscalationContext.__fastEscalationResult.capabilityOnly === false,
  "capability/spec questions must not auto-escalate to PDF only because a PDF exists",
);

assertStep(
  fastEscalationContext.__fastEscalationResult.factoryResetPinOnlyQa === true,
  "factory-reset operation questions must escalate to PDF when Fast Mode only returns PIN-forgotten recovery guidance",
);

assertStep(
  fastEscalationContext.__fastEscalationResult.factoryResetGenericQaSteps === true,
  "factory-reset operation questions must escalate to PDF even when Fast Mode returns generic QA/RULE reset steps",
);

assertStep(
  fastEscalationContext.__fastEscalationResult.pinForgotQa === false,
  "PIN-forgotten questions may stay in QA when the QA answer specifically addresses forgotten PIN recovery",
);

assertStep(
  !/const capabilityIntent\s*=/.test(linebot),
  "capability/spec intent must not remain as a PDF-escalation control variable",
);

const modelDisplayCode = [
  extractFunction(linebot, "isShortAliasModelToken"),
  extractFunction(linebot, "normalizeModelForDisplay"),
  extractFunction(linebot, "dedupDisplayModels"),
  `
  globalThis.__modelDisplayResult = {
    normalizedLs49: normalizeModelForDisplay("LS49C950UACXZW"),
    normalizedS49: normalizeModelForDisplay("S49C950UAC"),
    deduped: dedupDisplayModels([
      "S49C950UAC",
      "LS49C950UACXZW",
      "S27C900PAC",
      "LS27C900PACXZW"
    ], 10)
  };
  `,
].join("\n\n");
const modelDisplayContext = {};
vm.createContext(modelDisplayContext);
vm.runInContext(modelDisplayCode, modelDisplayContext);

assertStep(
  modelDisplayContext.__modelDisplayResult.normalizedLs49 === "S49C950UAC",
  "LS regional model codes should display as user-facing S model codes",
);

assertStep(
  modelDisplayContext.__modelDisplayResult.normalizedS49 === "S49C950UAC",
  "S model codes should remain stable after display normalization",
);

assertStep(
  JSON.stringify(modelDisplayContext.__modelDisplayResult.deduped) ===
    JSON.stringify(["S49C950UAC", "S27C900PAC"]),
  "model display deduplication should not show S and LS variants as separate choices",
);

const modelSelectionStart = linebot.indexOf("function createModelSelectionFlexV3");
const modelSelectionEnd = linebot.indexOf("function replyFlex", modelSelectionStart);
assertStep(modelSelectionStart >= 0, "createModelSelectionFlexV3 not found");
assertStep(modelSelectionEnd > modelSelectionStart, "createModelSelectionFlexV3 section end not found");
const modelSelectionSection = linebot.slice(modelSelectionStart, modelSelectionEnd);

assertStep(
  /const uniqueModels\s*=\s*dedupDisplayModels\(models,\s*100\)/.test(
    modelSelectionSection,
  ),
  "model selection UI must normalize and deduplicate model display names before rendering buttons",
);

const smartRouterMultiModelStart = linebot.indexOf("// Case B: 多個型號 -> 顯示泡泡");
const smartRouterMultiModelEnd = linebot.indexOf("// Re-check length", smartRouterMultiModelStart);
assertStep(smartRouterMultiModelStart >= 0, "multi-model smart router block not found");
assertStep(smartRouterMultiModelEnd > smartRouterMultiModelStart, "multi-model smart router block end not found");
const smartRouterMultiModelSection = linebot.slice(
  smartRouterMultiModelStart,
  smartRouterMultiModelEnd,
);

assertStep(
  smartRouterMultiModelSection.indexOf("const needSpecificModelIntent") <
    smartRouterMultiModelSection.indexOf("const isComparisonQuery"),
  "multi-model routing must decide operation-specific intent before comparison skip logic",
);

assertStep(
  /isComparisonQuery\s*&&\s*!\s*needSpecificModelIntent[\s\S]*suggestedModels\s*=\s*\[\]/.test(
    smartRouterMultiModelSection,
  ),
  "comparison/recommendation skip must not clear model choices when the question needs a specific model",
);

assertStep(
  /isComparisonQuery\s*&&\s*needSpecificModelIntent[\s\S]*保留型號選單泡泡/.test(
    smartRouterMultiModelSection,
  ),
  "comparison questions with operation/setup intent must keep the model-selection bubble",
);

assertStep(
  /const leadText\s*=\s*\[[\s\S]*\]\.join\("\\n"\)/.test(linebot) &&
    !/const leadText\s*=\s*\[[\s\S]*\[來源:專案流程規則\][\s\S]*\]\.join\("\\n"\)/.test(
      linebot,
    ),
  "model-selection lead text must be deterministic and must not invent a project-flow source tag",
);

const modelChosenPdfStart = linebot.indexOf('if (msg.startsWith("#型號:"))');
const modelChosenPdfEnd = linebot.indexOf("// ══════════════════════════════════════════════════════════", modelChosenPdfStart + 1);
assertStep(modelChosenPdfStart >= 0, "#型號 model-selection branch not found");
assertStep(modelChosenPdfEnd > modelChosenPdfStart, "#型號 model-selection branch end not found");
const modelChosenPdfSection = linebot.slice(modelChosenPdfStart, modelChosenPdfEnd);

assertStep(
  /finalText\.toUpperCase\(\)\.indexOf\(selectedModel\.toUpperCase\(\)\)\s*<\s*0/.test(
    modelChosenPdfSection,
  ) && /針對 \$\{selectedModel\}/.test(modelChosenPdfSection),
  "selected-model PDF answers must preserve the selected full model in the visible reply",
);

assertStep(
  !/const leadText\s*=\s*forcedSopNeedsModelSelection[\s\S]*:\s*finalText/.test(
    linebot,
  ),
  "model-selection lead text must not reuse an unverified AI finalText answer",
);

const operationGuardIndex = linebot.indexOf("v29.5.272: 無型號操作/故障題");
const fallbackExtractionIndex = linebot.indexOf("Priority 3 - Fallback extraction from AI text");
assertStep(operationGuardIndex >= 0, "no-model operation guard not found");
assertStep(fallbackExtractionIndex > operationGuardIndex, "fallback extraction marker should appear after no-model operation guard");

const operationGuardSection = linebot.slice(
  Math.max(0, operationGuardIndex - 900),
  Math.min(linebot.length, operationGuardIndex + 900),
);

assertStep(
  /operationIntent[\s\S]*!\s*userHasModelSignal[\s\S]*fastSourceTag\s*!==\s*"\[來源:QA庫\]"/.test(
    operationGuardSection,
  ),
  "no-model operation guard must ask for a model unless Fast Mode used a trusted QA source",
);

assertStep(
  !/!\s*hasAutoPdf|!\s*hasAutoWeb|!\s*hasNeedDoc/.test(operationGuardSection),
  "no-model operation guard must not let AI AUTO_SEARCH_PDF/AUTO_SEARCH_WEB/NEED_DOC bypass the model request",
);

assertStep(
  /buildNeedModelForOperationReply\(\)/.test(operationGuardSection),
  "no-model operation guard should reuse the standard monitor full-model request reply",
);

assertStep(
  /isSamsungHomeApplianceQuery[\s\S]*buildNeedApplianceModelForOperationReply[\s\S]*buildNeedModelForOperationReply/.test(
    operationGuardSection,
  ),
  "no-model operation guard should ask appliance questions for appliance model numbers, not monitor model numbers",
);

assertStep(
  /function buildNeedModelForOperationReply/.test(linebot) &&
    !/function buildNeedModelForOperationReply[\s\S]*?\n}\s*[\s\S]*?\[來源:專案流程規則\]/.test(
      extractFunction(linebot, "buildNeedModelForOperationReply"),
    ),
  "full-model request reply must not carry an invented project-flow source tag",
);

assertStep(
  /function buildNeedApplianceModelForOperationReply/.test(linebot) &&
    !/\[來源:專案流程規則\]/.test(
      extractFunction(linebot, "buildNeedApplianceModelForOperationReply"),
    ),
  "appliance full-model request reply must not carry an invented project-flow source tag",
);

const manualDeflectionCode = [
  extractFunction(linebot, "sanitizeManualDeflection"),
  `
  globalThis.__manualDeflectionResult = [
    sanitizeManualDeflection("根據你提供的 PDF 文件，請照以下步驟操作。"),
    sanitizeManualDeflection("根據您提供的PDF，內容如下。"),
    sanitizeManualDeflection("依照你提供的手冊內容，可以這樣處理。"),
    sanitizeManualDeflection("根據這份 PDF 檔案，功能如下。"),
    sanitizeManualDeflection("根據手冊內容，螢幕支援 USB-C。具體操作方式請參考 S32FM703UC 的使用者手冊。")
  ].join("\\n");
  `,
].join("\n\n");
const manualDeflectionContext = {};
vm.createContext(manualDeflectionContext);
vm.runInContext(manualDeflectionCode, manualDeflectionContext);

assertStep(
  !/[你您]提供的\s*(PDF|手冊|文件|檔案)/i.test(
    manualDeflectionContext.__manualDeflectionResult,
  ),
  "manual/PDF replies must not speak as if the user provided the manual",
);

assertStep(
  /官方手冊/.test(manualDeflectionContext.__manualDeflectionResult) &&
    !/具體操作方式請參考/.test(manualDeflectionContext.__manualDeflectionResult),
  "manual/PDF deflection sanitizer should rewrite user-provided-manual phrasing to official-manual phrasing",
);

assertStep(
  /網路搜尋模式[\s\S]{0,120}result = sanitizeManualDeflection\(result\)/.test(linebot),
  "manual-to-web integrated replies must remove instructions that send the user back to the manual",
);

const priceGuardCode = [
  `
  const CACHE_KEYS = { KEYWORD_MAP: "keyword_map" };
  const PropertiesService = {
    getScriptProperties() {
      return {
        getProperty() {
          return "";
        }
      };
    }
  };
  const writeLog = () => {};
  `,
  extractFunction(linebot, "getProductUrl"),
  extractFunction(linebot, "isPriceQueryIntent_"),
  extractFunction(linebot, "extractPriceQueryTargets_"),
  extractFunction(linebot, "buildNoPriceReply_"),
  `
  const priceReply = buildNoPriceReply_("請協助尋找M9、G8、M8、S34BG850SC的市場最低價與建議售價。");
  globalThis.__priceGuardResult = {
    isPrice: isPriceQueryIntent_("G8現在價格多少？"),
    targets: extractPriceQueryTargets_("請協助尋找M9、G8、M8、S34BG850SC的市場最低價與建議售價。"),
    reply: priceReply
  };
  `,
].join("\n\n");
const priceGuardContext = {};
vm.createContext(priceGuardContext);
vm.runInContext(priceGuardCode, priceGuardContext);

assertStep(
  priceGuardContext.__priceGuardResult.isPrice === true,
  "price guard should detect price questions before LLM routing",
);

assertStep(
  priceGuardContext.__priceGuardResult.targets.includes("S34BG850SC"),
  "price guard should preserve full model tokens like S34BG850SC",
);

assertStep(
  /samsung\.com\/tw\/search\/\?searchvalue=/i.test(
    priceGuardContext.__priceGuardResult.reply,
  ),
  "price guard reply should route users to Samsung official search pages",
);

assertStep(
  !/NT\$\s*\d+|\$\s*\d+|\d+\s*元|\d{1,3}(,\d{3}){1,2}/i.test(
    priceGuardContext.__priceGuardResult.reply,
  ),
  "price guard reply must not include numeric money prices",
);

assertStep(
  /const alreadyConsultedPdf\s*=\s*[\s\S]*?cache\.get\(`\$\{userId\}:pdf_consulted`\)\s*===\s*"true"/.test(
    linebot,
  ),
  "quick reply logic must track whether PDF was already consulted",
);

assertStep(
  /hasPdfForModel\s*&&\s*!\s*alreadyConsultedPdf\s*&&\s*!\s*isWaitingForModelSelection/.test(
    linebot,
  ),
  "manual quick reply/reminder must be hidden after PDF consult or during model selection",
);

assertStep(
  packageJson.scripts &&
    /run_current_test\.js\s+verify_route_testset_17_single\.js/.test(
      packageJson.scripts["test:current"] || "",
    ),
  "online TestUI regression script must use run_current_test.js",
);

assertStep(
  packageJson.scripts &&
    /run_current_test\.js\s+verify_m7_exact_issue\.js/.test(
      packageJson.scripts["test:m7"] || "",
    ),
  "M7 online regression script must use run_current_test.js",
);

assertStep(
  packageJson.scripts &&
    /run_current_test\.js\s+verify_price_no_number\.js/.test(
      packageJson.scripts["test:price"] || "",
    ),
  "price online regression script must use run_current_test.js",
);

assertStep(
  packageJson.scripts &&
    packageJson.scripts["check:webhook-version"] === "node ensure_formal_version_current.js",
  "package.json must expose check:webhook-version",
);

const entryDraftCode = [
  extractFunction(linebot, "extractQaPartsFromText"),
  extractFunction(linebot, "isOneLineQaText"),
  extractFunction(linebot, "normalizeRuleLine"),
  extractFunction(linebot, "isRuleLikeEntryContent"),
  extractFunction(linebot, "classifyEntryDraftType"),
  `
  globalThis.__entryDraftResult = {
    qaType: classifyEntryDraftType("S27FG532EC 怎麼調整更新率？ / A：到遊戲選單調整更新頻率。"),
    ruleType: classifyEntryDraftType("本期三星螢幕活動：S27FG532EC 建議售價 5490 促銷價 4990，活動期間 2026/07/01-2026/07/31，來源：https://promotion.twsamsungcampaign.com/test.aspx"),
    normalizedRule: normalizeRuleLine("活動_測試,電腦螢幕活動RULE\\nS27FG532EC 促銷價 4990\\n來源網址：https://promotion.twsamsungcampaign.com/test.aspx")
  };
  `,
].join("\n\n");
const entryDraftContext = {};
vm.createContext(entryDraftContext);
vm.runInContext(entryDraftCode, entryDraftContext);

assertStep(
  entryDraftContext.__entryDraftResult.qaType === "qa",
  "/紀錄 QA content should stay in QA draft mode",
);

assertStep(
  entryDraftContext.__entryDraftResult.ruleType === "rule",
  "/紀錄 promotion or activity content should enter RULE draft mode",
);

assertStep(
  !/[\r\n]/.test(entryDraftContext.__entryDraftResult.normalizedRule) &&
    /promotion\.twsamsungcampaign\.com/.test(entryDraftContext.__entryDraftResult.normalizedRule),
  "RULE draft text must stay as one CLASS_RULES row and preserve source URL",
);

const saveDraftSection = extractFunction(linebot, "saveDraftToSheet");
assertStep(
  /SHEET_NAMES\.CLASS_RULES/.test(saveDraftSection) &&
    /scheduleImmediateRebuild\(\)/.test(saveDraftSection) &&
    !/syncGeminiKnowledgeBase\(\)/.test(saveDraftSection),
  "/紀錄 saveDraftToSheet must support CLASS_RULES and use background rebuild instead of synchronous sync",
);

assertStep(
  /promptAliasOnlyModelSelection\(lastQuestion,\s*userId,\s*replyToken,\s*contextId,\s*"pdf"\)/.test(
    linebot,
  ),
  "#查手冊 must ask for full model when the query only contains a short alias such as G5",
);

assertStep(
  /getAliasCandidatesFromExistingPdfs/.test(linebot) &&
    /PDF_MODEL_INDEX/.test(linebot) &&
    /短別稱不可直接查 PDF/.test(linebot),
  "short aliases must be expanded to full-model candidates from existing PDF coverage before PDF search",
);

const aliasMatchCode = [
  extractFunction(linebot, "isClassRuleLineMatchedAlias"),
  `
  globalThis.__aliasMatchResult = {
    g5Product: isClassRuleLineMatchedAlias("LS27DG502ECXZW,型號：S27DG502EC,27吋Odyssey G5 IPS 平面電競顯示器 G50D", "G5"),
    g5SubstringOnly: isClassRuleLineMatchedAlias("活動_測試,S27FG502SC 登錄送", "G5"),
    m7GenericTerm: isClassRuleLineMatchedAlias("術語_Smart系列,主要是Smart Monitor系列(M5、M7、M8、M9)，也有Odyssey 3D G90XF", "M7"),
    g95Product: isClassRuleLineMatchedAlias("LS49CG954SCXZW,型號：S49CG954SC,49吋Odyssey OLED G9 曲面電競顯示器 G95SC", "G95SC")
  };
  `,
].join("\n\n");
const aliasMatchContext = {};
vm.createContext(aliasMatchContext);
vm.runInContext(aliasMatchCode, aliasMatchContext);

assertStep(
  aliasMatchContext.__aliasMatchResult.g5Product === true &&
    aliasMatchContext.__aliasMatchResult.g5SubstringOnly === false &&
    aliasMatchContext.__aliasMatchResult.m7GenericTerm === false &&
    aliasMatchContext.__aliasMatchResult.g95Product === true,
  "alias candidate matching must avoid substring/generic-term pollution while supporting product aliases",
);

const smartCodecGuardCode = [
  extractFunction(linebot, "isMediaCodecSupportQuery"),
  extractFunction(linebot, "isSmartMonitorCodecQuestion"),
  `
  globalThis.__smartCodecGuardResult = {
    smartSeriesHevc: isSmartMonitorCodecQuestion("Smart系列播放檔案有沒有支援hevc格式"),
    m7Hevc: isSmartMonitorCodecQuestion("M7 支援 H.265 影片檔嗎"),
    odysseyOnly: isSmartMonitorCodecQuestion("Odyssey 3D 支援 HEVC 嗎")
  };
  `,
].join("\n\n");
const smartCodecGuardContext = {};
vm.createContext(smartCodecGuardContext);
vm.runInContext(smartCodecGuardCode, smartCodecGuardContext);

assertStep(
  smartCodecGuardContext.__smartCodecGuardResult.smartSeriesHevc === true &&
    smartCodecGuardContext.__smartCodecGuardResult.m7Hevc === true &&
    smartCodecGuardContext.__smartCodecGuardResult.odysseyOnly === false,
  "Smart Monitor codec guard must catch Smart/M-series HEVC questions without overreaching to Odyssey-only questions",
);

assertStep(
  !/所以可支援 HEVC 影片播放/.test(linebot) &&
    !/buildSmartMonitorCodecManualReply/.test(linebot),
  "Smart Monitor codec guard must not contain a fixed HEVC answer before exact PDF search",
);

assertStep(
  /function getSmartMonitorCodecSelectionModels/.test(linebot) &&
    /function buildSmartMonitorCodecSelectionPayload/.test(linebot) &&
    /PDF_MODEL_INDEX/.test(extractFunction(linebot, "getSmartMonitorCodecSelectionModels")) &&
    /\^S\\d\{2\}\[A-Z\]\*M\\d\{2,3\}/.test(extractFunction(linebot, "getSmartMonitorCodecSelectionModels")) &&
    /createModelSelectionFlexV3/.test(extractFunction(linebot, "buildSmartMonitorCodecSelectionPayload")) &&
    !/\[來源:專案流程規則\]/.test(extractFunction(linebot, "buildSmartMonitorCodecSelectionPayload")) &&
    /這題會跟實際型號有關/.test(extractFunction(linebot, "buildSmartMonitorCodecSelectionPayload")) &&
    /\[費用:NT\$0\.0000/.test(extractFunction(linebot, "buildSmartMonitorCodecSelectionPayload")),
  "Smart Monitor codec guard must provide natural model-selection bubbles with zero-cost disclosure and no fake source",
);

assertStep(
  /\[Smart Codec Guard v[\d.]+\].*#查手冊 顯示 Smart Monitor PDF 型號選擇/.test(linebot),
  "#查手冊 must route Smart Monitor codec questions to model choices before exact PDF search",
);

assertStep(
  /isSmartMonitorCodecQuestion\(savedTopic\)[\s\S]{0,520}支援的視訊編解碼器[\s\S]{0,360}HEVC 編解碼器僅適用於 MKV \/ MP4 \/ TS[\s\S]{0,180}禁止使用/.test(linebot),
  "selected Smart Monitor codec model must use a cleaned exact-model PDF query with no speculative file-format claims",
);

assertStep(
    !/function buildSmartCodecElaborationFromPreviousPdf/.test(linebot) &&
    !/function enforceSmartCodecPdfSupportConclusion_/.test(linebot) &&
    !/HEVC\/PDF 再詳細說明沿用上一則手冊結果/.test(linebot) &&
    /function buildManualElaborationQuery_/.test(linebot) &&
    /previousWasManual/.test(linebot) &&
    /manualResponse\s*=\s*callLLMWithRetry/.test(linebot) &&
    /manualFiles,\s*true/.test(linebot) &&
    !/未呼叫 LLM/.test(extractFunction(linebot, "buildManualElaborationQuery_")),
  "manual #再詳細說明 must reattach the same PDF and call the LLM; fixed HEVC answers are forbidden",
);

assertStep(
  /t\.type === "text"[\s\S]{0,120}return String\(t\.text \|\| ""\)/.test(linebot),
  "TestUI reply preview must display text objects in mixed text+Flex replies",
);

assertStep(
    /function enforceReplyAuditTrail_/.test(linebot) &&
    /function hasVisibleCostAudit_/.test(linebot) &&
    /lastLlmCallAttempted/.test(linebot) &&
    /function cleanReplyVisibleTextArtifacts_/.test(linebot) &&
    /function replyMessage\(tk,\s*txt,\s*options\s*=\s*\{\}\)\s*\{\s*txt\s*=\s*cleanReplyVisibleTextArtifacts_\(txt\);\s*txt\s*=\s*enforceReplyAuditTrail_\(txt\)/.test(linebot) &&
    /\[Reply Audit Guard v[\d.]+\]/.test(linebot),
  "all LINE/TestUI replies must pass the final visible cost audit guard",
);

assertStep(
  /lastTokenUsage\s*=\s*null;\s*lastLlmCallAttempted\s*=\s*false;\s*lastSearchSources\s*=\s*null;\s*lastWebEvidenceValid\s*=\s*false;/.test(
    extractFunction(linebot, "handleMessage"),
  ),
  "each new user message must reset token/search/LLM usage before calculating the current reply cost",
);

const crossDeviceScopeCode = [
  extractFunction(linebot, "isCrossDeviceMonitorQuery"),
  extractFunction(linebot, "isIncorrectCrossDeviceScopeRefusal"),
  extractFunction(linebot, "hasUnsupportedCrossDeviceExternalAdvice"),
  extractFunction(linebot, "sanitizeUnsupportedCrossDeviceExternalAdvice"),
  extractFunction(linebot, "hasUnsupportedCrossDeviceManualExternalClaim_"),
  extractFunction(linebot, "sanitizeUnsupportedCrossDeviceManualClaims_"),
  extractFunction(linebot, "hasUnsupportedCrossDeviceWebSpeculation_"),
  extractFunction(linebot, "sanitizeUnsupportedCrossDeviceWebSpeculation_"),
  extractFunction(linebot, "getRecentOfficialManualAnswer_"),
  extractFunction(linebot, "getWattageValues_"),
  extractFunction(linebot, "hasManualAnchorWattageConflict_"),
  extractFunction(linebot, "sanitizeManualAnchorWattageConflict_"),
  extractFunction(linebot, "removeCrossDeviceManualHeadingOnlyLines_"),
  extractFunction(linebot, "getOfficialUrlContextCandidates"),
  extractFunction(linebot, "getSuccessfulUrlContextSources"),
  extractFunction(linebot, "combineLlmUsage_"),
  extractFunction(linebot, "shouldOfferCrossDeviceWebVerification"),
  extractFunction(linebot, "appendCrossDeviceWebVerificationNotice"),
  extractFunction(linebot, "markPdfConsultedForUser_"),
  extractFunction(linebot, "hasPdfBeenConsultedForUser_"),
  `
  const values = new Map();
  const fakeCache = {
    put: (key, value) => values.set(key, value),
    get: (key) => values.has(key) ? values.get(key) : null
  };
  markPdfConsultedForUser_(fakeCache, "u1");
  globalThis.__crossDeviceScopeResult = {
    iphoneM7: isCrossDeviceMonitorQuery("iPhone 17要如何以type c連接M7顯示"),
    androidMonitor: isCrossDeviceMonitorQuery("Android手機怎麼投放到Smart Monitor"),
    macbookViewFinity: isCrossDeviceMonitorQuery("MacBook用USB-C接ViewFinity沒有畫面"),
    ps5Odyssey: isCrossDeviceMonitorQuery("PS5用HDMI連Odyssey螢幕如何設定"),
    phoneOnly: isCrossDeviceMonitorQuery("iPhone 17怎麼恢復原廠設定"),
    refusal: isIncorrectCrossDeviceScopeRefusal("我只負責電腦螢幕與智慧家電喔😅"),
    unsupportedPhoneSetting: hasUnsupportedCrossDeviceExternalAdvice(
      "請檢查 iPhone 17 的設定，確認是否啟用 USB 影像輸出。"
    ),
    unsupportedCableGuess: hasUnsupportedCrossDeviceExternalAdvice(
      "你可以嘗試使用不同品牌的 USB-C 纜線。"
    ),
    unsupportedTryPhone: hasUnsupportedCrossDeviceExternalAdvice(
      "建議你可以試試看用 USB-C 纜線連接 iPhone 17。"
    ),
    unsupportedAdapterGuess: hasUnsupportedCrossDeviceExternalAdvice(
      "如果不行，可能需要確認 iPhone 17，或改用其他轉接方式。"
    ),
    unsupportedManualDisplayClaim: hasUnsupportedCrossDeviceManualExternalClaim_(
      "透過 USB Type-C 連接，你的 iPhone 17 畫面可以顯示在螢幕上。"
    ),
    unsupportedManualChargeClaim: hasUnsupportedCrossDeviceManualExternalClaim_(
      "USB Type-C 連接埠可以為你的 iPhone 17 充電。"
    ),
    sanitizedManualClaims: sanitizeUnsupportedCrossDeviceManualClaims_(
      "螢幕端支援 USB-C 影像輸入。你的 iPhone 17 可以顯示在螢幕上。\\n手冊記載最大供電為 65W。"
    ),
    unsupportedWebSettingGuess: hasUnsupportedCrossDeviceWebSpeculation_(
      "若沒有畫面，可能需要在 iPhone 的設定中尋找螢幕鏡像選項，這是常見邏輯。"
    ),
    webOfficialFactSafe: hasUnsupportedCrossDeviceWebSpeculation_(
      "Apple 官方規格明載 iPhone 17 支援原生 DisplayPort 輸出，最高可達 4K HDR。"
    ),
    sanitizedWebAnswer: sanitizeUnsupportedCrossDeviceWebSpeculation_(
      "iPhone 17 支援 DisplayPort 輸出。\\n可能需要在 iPhone 設定中找鏡像選項。\\n請使用支援影像的 USB-C 線材。"
    ),
    manualOnlySafe: hasUnsupportedCrossDeviceExternalAdvice(
      "手冊記載螢幕端 USB-C 連接埠支援影像輸入，但未記載 iPhone 17 的設定。"
    ),
    sanitizedManual: sanitizeUnsupportedCrossDeviceExternalAdvice(
      "1. 手冊記載螢幕端 USB-C 支援影像輸入。建議你可以試試看用 USB-C 纜線連接 iPhone 17。\\n\\n2. 手冊記載最大供電為 65W。"
    ),
    manualAnchor: getRecentOfficialManualAnswer_([
      { role: "assistant", content: "舊回答" },
      { role: "assistant", content: "螢幕端最大供電為 65W。\\n[來源:官方手冊]\\n[費用:NT$0.1]" }
    ]),
    wattConflict: hasManualAnchorWattageConflict_(
      "螢幕端最大供電為 65W。",
      "iPhone 充電為 20W。螢幕 USB-C 最大供電為 90W。"
    ),
    wattSanitized: sanitizeManualAnchorWattageConflict_(
      "螢幕端最大供電為 65W。",
      "iPhone 充電為 20W。\\n螢幕 USB-C 最大供電為 90W。\\n請使用可傳影像的線材。"
    ),
    cleanedManualList: removeCrossDeviceManualHeadingOnlyLines_(
      "1. USB Type-C 連接埠：\\n2. 螢幕支援影像傳輸。\\n3. 連接要求：\\n4. 最大供電為 65W。"
    ),
    iphoneOfficialUrl: getOfficialUrlContextCandidates(
      "iPhone 17要如何以type c連接M7顯示"
    )[0],
    successfulUrlSources: getSuccessfulUrlContextSources({
      urlMetadata: [
        {
          retrievedUrl: "https://www.apple.com/tw/iphone-17/specs/",
          urlRetrievalStatus: "URL_RETRIEVAL_STATUS_SUCCESS"
        },
        {
          retrievedUrl: "https://example.com/fail",
          urlRetrievalStatus: "URL_RETRIEVAL_STATUS_ERROR"
        }
      ]
    }),
    combinedCost: combineLlmUsage_(
      { input: 10, output: 2, total: 12, costTWD: 0.1 },
      { input: 20, output: 3, total: 23, costTWD: 0.2 }
    ),
    manualNeedsWeb: shouldOfferCrossDeviceWebVerification(
      "iPhone 17要如何以type c連接M7顯示",
      "手冊中並未明確提及 iPhone 17，因此無法直接確認。",
      false
    ),
    completeManualDoesNotNeedWeb: shouldOfferCrossDeviceWebVerification(
      "iPhone 17要如何以type c連接M7顯示",
      "USB Type-C 連接後可以顯示畫面。",
      false
    ),
    noticeIsNatural: appendCrossDeviceWebVerificationNotice("螢幕端支援 USB-C。").includes("這題再搜網路"),
    cacheMarksPdf: hasPdfBeenConsultedForUser_(fakeCache, "u1", []),
    historyMarksPdf: hasPdfBeenConsultedForUser_(
      { get: () => null },
      "u2",
      [{ role: "assistant", content: "已查到。\\n[來源:官方手冊]" }]
    )
  };
  `,
].join("\n\n");
const crossDeviceScopeContext = {};
vm.createContext(crossDeviceScopeContext);
vm.runInContext(crossDeviceScopeCode, crossDeviceScopeContext);

assertStep(
  crossDeviceScopeContext.__crossDeviceScopeResult.iphoneM7 === true &&
    crossDeviceScopeContext.__crossDeviceScopeResult.androidMonitor === true &&
    crossDeviceScopeContext.__crossDeviceScopeResult.macbookViewFinity === true &&
    crossDeviceScopeContext.__crossDeviceScopeResult.ps5Odyssey === true &&
    crossDeviceScopeContext.__crossDeviceScopeResult.phoneOnly === false &&
    crossDeviceScopeContext.__crossDeviceScopeResult.refusal === true &&
    crossDeviceScopeContext.__crossDeviceScopeResult.unsupportedPhoneSetting === true &&
    crossDeviceScopeContext.__crossDeviceScopeResult.unsupportedCableGuess === true &&
    crossDeviceScopeContext.__crossDeviceScopeResult.unsupportedTryPhone === true &&
    crossDeviceScopeContext.__crossDeviceScopeResult.unsupportedAdapterGuess === true &&
    crossDeviceScopeContext.__crossDeviceScopeResult.unsupportedManualDisplayClaim === true &&
    crossDeviceScopeContext.__crossDeviceScopeResult.unsupportedManualChargeClaim === true &&
    /螢幕端支援 USB-C 影像輸入/.test(crossDeviceScopeContext.__crossDeviceScopeResult.sanitizedManualClaims) &&
    /65W/.test(crossDeviceScopeContext.__crossDeviceScopeResult.sanitizedManualClaims) &&
    !/iPhone 17 可以顯示/.test(crossDeviceScopeContext.__crossDeviceScopeResult.sanitizedManualClaims) &&
    crossDeviceScopeContext.__crossDeviceScopeResult.unsupportedWebSettingGuess === true &&
    crossDeviceScopeContext.__crossDeviceScopeResult.webOfficialFactSafe === false &&
    /DisplayPort 輸出/.test(crossDeviceScopeContext.__crossDeviceScopeResult.sanitizedWebAnswer) &&
    !/鏡像選項/.test(crossDeviceScopeContext.__crossDeviceScopeResult.sanitizedWebAnswer) &&
    /USB-C 線材/.test(crossDeviceScopeContext.__crossDeviceScopeResult.sanitizedWebAnswer) &&
    crossDeviceScopeContext.__crossDeviceScopeResult.manualOnlySafe === false &&
    /螢幕端 USB-C 支援影像輸入/.test(crossDeviceScopeContext.__crossDeviceScopeResult.sanitizedManual) &&
    /最大供電為 65W/.test(crossDeviceScopeContext.__crossDeviceScopeResult.sanitizedManual) &&
    !/試試看/.test(crossDeviceScopeContext.__crossDeviceScopeResult.sanitizedManual) &&
    /65W/.test(crossDeviceScopeContext.__crossDeviceScopeResult.manualAnchor) &&
    !/來源|費用/.test(crossDeviceScopeContext.__crossDeviceScopeResult.manualAnchor) &&
    crossDeviceScopeContext.__crossDeviceScopeResult.wattConflict === true &&
    /iPhone 充電為 20W/.test(crossDeviceScopeContext.__crossDeviceScopeResult.wattSanitized) &&
    !/90W/.test(crossDeviceScopeContext.__crossDeviceScopeResult.wattSanitized) &&
    /可傳影像的線材/.test(crossDeviceScopeContext.__crossDeviceScopeResult.wattSanitized) &&
    !/連接埠：|連接要求：/.test(crossDeviceScopeContext.__crossDeviceScopeResult.cleanedManualList) &&
    /影像傳輸/.test(crossDeviceScopeContext.__crossDeviceScopeResult.cleanedManualList) &&
    /65W/.test(crossDeviceScopeContext.__crossDeviceScopeResult.cleanedManualList) &&
    crossDeviceScopeContext.__crossDeviceScopeResult.iphoneOfficialUrl === "https://www.apple.com/tw/iphone-17/specs/" &&
    crossDeviceScopeContext.__crossDeviceScopeResult.successfulUrlSources.length === 1 &&
    crossDeviceScopeContext.__crossDeviceScopeResult.combinedCost.total === 35 &&
    Math.abs(crossDeviceScopeContext.__crossDeviceScopeResult.combinedCost.costTWD - 0.3) < 0.000001 &&
    crossDeviceScopeContext.__crossDeviceScopeResult.manualNeedsWeb === true &&
    crossDeviceScopeContext.__crossDeviceScopeResult.completeManualDoesNotNeedWeb === false &&
    crossDeviceScopeContext.__crossDeviceScopeResult.noticeIsNatural === true &&
    crossDeviceScopeContext.__crossDeviceScopeResult.cacheMarksPdf === true &&
    crossDeviceScopeContext.__crossDeviceScopeResult.historyMarksPdf === true,
  "cross-device monitor questions must remain in scope while pure phone questions stay out of scope",
);

assertStep(
  /buildCrossDeviceMonitorPromptRule\(query\)/.test(linebot) &&
    /Cross Device Evidence Guard v29\.6\.073/.test(linebot) &&
    /correctedText\s*=\s*callLLMWithRetry/.test(linebot) &&
    /evidenceCorrectionAttempted\s*=\s*false/.test(linebot) &&
    /!evidenceCorrectionAttempted/.test(linebot) &&
    /targetModelName,\s*true,\s*webGroundingRetryAttempted,\s*\)/.test(linebot) &&
    /兩次 LLM 合計費用/.test(linebot) &&
    /第二次仍違反來源邊界/.test(linebot) &&
    /sanitizeUnsupportedCrossDeviceExternalAdvice/.test(linebot) &&
    /hasUnsupportedCrossDeviceManualExternalClaim_/.test(linebot) &&
    /sanitizeUnsupportedCrossDeviceManualClaims_/.test(linebot) &&
    !/若詢問手機\/平板，回覆「我只負責電腦螢幕與智慧家電喔/.test(
      fs.readFileSync(path.join(root, "Prompt.csv"), "utf8"),
    ),
  "cross-device monitor scope guard must override bad refusals without hiding retry cost",
);

assertStep(
  /Cross Device Manual Anchor v29\.6\.076/.test(linebot) &&
    /getRecentOfficialManualAnswer_\(effectiveMessages\)/.test(linebot) &&
    /hasManualAnchorWattageConflict_\(recentOfficialManualAnswer, text\)/.test(linebot) &&
    /pdfConsulted && isCrossDeviceMonitorQuery\(userMsg\)/.test(linebot) &&
    /result \+= "\\n\[來源:官方手冊\]"/.test(linebot),
  "cross-device web continuation must preserve manual facts and expose both real sources",
);

assertStep(
  /Official Page Fetch v29\.6\.077/.test(linebot) &&
    /fetchOfficialUrlEvidence_\(officialUrlContexts\)/.test(linebot) &&
    /程式直接擷取的官方技術規格頁證據/.test(linebot) &&
    /directOfficialPageEvidence\.length > 0[\s\S]{0,700}lastWebEvidenceValid = true/.test(linebot) &&
    /Cross Device Web Evidence v29\.6\.077/.test(linebot),
  "known official URLs must be fetched as auditable evidence before cross-device web answers",
);

assertStep(
  /hasUnsupportedCrossDeviceWebSpeculation_/.test(linebot) &&
    /sanitizeUnsupportedCrossDeviceWebSpeculation_/.test(linebot) &&
    /Cross Device Web Evidence v29\.6\.077/.test(linebot),
  "web answers must remove unsupported device-setting speculation without deleting official facts",
);

assertStep(
  /let lastWebEvidenceValid = false;/.test(linebot) &&
    /grounding\.groundingChunks[\s\S]{0,180}grounding\.groundingSupports/.test(linebot) &&
    /webGroundingRetryAttempted\s*=\s*false/.test(linebot) &&
    /Grounding Audit v29\.6\.075/.test(linebot) &&
    /第二次仍無可稽核來源，拒絕輸出假網搜答案/.test(linebot) &&
    /lastWebEvidenceValid\s*&&[\s\S]{0,160}lastSearchSources/.test(linebot) &&
    /tools\.unshift\(\{ url_context: \{\} \}\)/.test(linebot) &&
    /URL_RETRIEVAL_STATUS_SUCCESS/.test(linebot) &&
    /官方頁讀取成功/.test(linebot),
  "web answers must require auditable grounding chunks and supports before showing the web-search source",
);

assertStep(
  /Cross Device Web Handoff v29\.6\.070/.test(linebot) &&
    (linebot.match(/markPdfConsultedForUser_\(cache, userId\)/g) || []).length >= 2 &&
    /const pdfConsulted = hasPdfBeenConsultedForUser_\(cache, u, history\)/.test(linebot) &&
    /本次直接進網路搜尋/.test(linebot),
  "a completed manual lookup must be remembered so explicit web follow-up cannot rerun the PDF stage",
);

assertStep(
  /Cross Device Router v29\.6\.074/.test(linebot) &&
    /isCrossDeviceMonitorQuery\(msg\)[\s\S]{0,180}promptAliasOnlyModelSelection\([\s\S]{0,180}"pdf"/.test(
      extractFunction(linebot, "handleMessage"),
    ) &&
    /hasTrustedFastCrossDeviceQa[\s\S]{0,260}return "\[AUTO_SEARCH_PDF\]"/.test(
      extractFunction(linebot, "callLLMWithRetry"),
    ),
  "cross-device alias questions must deterministically select a PDF model before Fast LLM speculation",
);

assertStep(
  (linebot.match(/https:\/\/api\.line\.me\/v2\/bot\/message\/reply/g) || [])
    .length === 1 &&
    /replyMessage\(replyToken,\s*messages\);[\s\S]{0,120}已透過 replyMessage 發送 Flex Selection/.test(
      linebot,
    ) &&
    /function replyFlexMessage[\s\S]{0,260}replyMessage\(replyToken/.test(linebot),
  "no LINE reply path may bypass replyMessage source/cost enforcement",
);

const pdfModelIndexCode = [
  extractFunction(linebot, "isPdfKbFile"),
  extractFunction(linebot, "extractPdfModelIndexFromKbList"),
  `
  globalThis.__pdfModelIndexResult = extractPdfModelIndexFromKbList([
    { name: "S27BM500,S32BM80,S32BM702,S32BM703,S32BM801,S43BM700.pdf", mimeType: "application/pdf" },
    { name: "F22T450,F24T450,F27T450.pdf", mimeType: "application/pdf" },
    { name: "S49CG954,S49FG916.pdf", mimeType: "application/pdf" }
  ]);
  `,
].join("\n\n");
const pdfModelIndexContext = {};
vm.createContext(pdfModelIndexContext);
vm.runInContext(pdfModelIndexCode, pdfModelIndexContext);

assertStep(
  ["S32BM80", "F22T450", "F24T450", "F27T450", "S49FG916"].every((model) =>
    pdfModelIndexContext.__pdfModelIndexResult.includes(model),
  ),
  "PDF model index extraction must include two-digit suffix and F-series manual filenames",
);

const pdfFileMatchCode = [
  extractFunction(linebot, "normalizePdfModelToken_"),
  extractFunction(linebot, "getPdfFileModelTokens_"),
  extractFunction(linebot, "isPdfSalesSuffix_"),
  extractFunction(linebot, "isPdfModelTokenMatch_"),
  extractFunction(linebot, "pdfFileNameMatchesModelToken_"),
  `
  globalThis.__pdfFileMatchResult = {
    exactTwoDigit: pdfFileNameMatchesModelToken_("S27BM500,S32BM80,S32BM702.pdf", "S32BM80"),
    rejectExtraDigit: pdfFileNameMatchesModelToken_("S32BM801,S43BM700.pdf", "S32BM80"),
    allowSalesSuffix: pdfFileNameMatchesModelToken_("S27FG532.pdf", "S27FG532EC"),
    rejectShortAlias: pdfFileNameMatchesModelToken_("S27FG532.pdf", "G5")
  };
  `,
].join("\n\n");
const pdfFileMatchContext = {};
vm.createContext(pdfFileMatchContext);
vm.runInContext(pdfFileMatchCode, pdfFileMatchContext);

assertStep(
  pdfFileMatchContext.__pdfFileMatchResult.exactTwoDigit === true &&
    pdfFileMatchContext.__pdfFileMatchResult.rejectExtraDigit === false &&
    pdfFileMatchContext.__pdfFileMatchResult.allowSalesSuffix === true &&
    pdfFileMatchContext.__pdfFileMatchResult.rejectShortAlias === false,
  "PDF file matching must use model tokens, reject extra digits, allow sales suffixes, and reject short aliases",
);

assertStep(
  fs.existsSync(path.join(root, "test_runner", "run_current_test.js")),
  "run_current_test.js must exist as the guarded online TestUI wrapper",
);

console.log("PASS: verify_sop_static_guards");
