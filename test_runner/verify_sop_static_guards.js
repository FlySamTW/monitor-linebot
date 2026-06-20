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

const linebot = read("linebot.gs");
const deployBat = read("deploy.bat");
const deployExistingWebhook = read("tools/deploy_existing_webhook.ps1");
const syncPrompt = read("tools/sync_prompt_c3.ps1");
const packageJson = JSON.parse(read("test_runner/package.json"));

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
  /Cannot create more versions/.test(deployExistingWebhook) &&
    /Do not create a new deployment ID/.test(deployExistingWebhook),
  "deploy_existing_webhook.ps1 must block safely at the Apps Script version limit",
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
  extractFunction(linebot, "normalizeSourceTagFromRaw"),
  `
  globalThis.__sourceNormalizeResult = {
    exactQa: normalizeSourceTagFromRaw("[來源:QA]"),
    exactRules: normalizeSourceTagFromRaw("[來源:規格庫]"),
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
  sourceNormalizeContext.__sourceNormalizeResult.exactQa === "[來源:QA]",
  "Fast Mode should still accept exact [來源:QA]",
);

assertStep(
  sourceNormalizeContext.__sourceNormalizeResult.exactRules === "[來源:規格庫]",
  "Fast Mode should still accept exact [來源:規格庫]",
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

const fastEscalationCode = [
  extractFunction(linebot, "isOperationAnswerInsufficient"),
  extractFunction(linebot, "shouldEscalateFastAnswerToPdf"),
  `
  const genericStepAnswer = "1. 進入螢幕選單\\n2. 找到聲音或音量選項\\n3. 將音量調低或靜音";
  globalThis.__fastEscalationResult = {
    noTrustedSource: shouldEscalateFastAnswerToPdf({
      hasPdfForModel: true,
      operationIntent: true,
      fastSourceTag: "",
      normalizedFastAnswer: genericStepAnswer
    }),
    trustedQa: shouldEscalateFastAnswerToPdf({
      hasPdfForModel: true,
      operationIntent: true,
      fastSourceTag: "[來源:QA]",
      normalizedFastAnswer: genericStepAnswer
    }),
    trustedRules: shouldEscalateFastAnswerToPdf({
      hasPdfForModel: true,
      operationIntent: true,
      fastSourceTag: "[來源:規格庫]",
      normalizedFastAnswer: genericStepAnswer
    }),
    capabilityOnly: shouldEscalateFastAnswerToPdf({
      hasPdfForModel: true,
      operationIntent: false,
      manualVerificationIntent: false,
      fastSourceTag: "",
      normalizedFastAnswer: genericStepAnswer
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
  /const leadText\s*=\s*\[[\s\S]*\[來源:專案流程規則\][\s\S]*\]\.join\("\\n"\)/.test(
    linebot,
  ),
  "model-selection lead text must be deterministic and carry a project-flow source tag",
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
  /operationIntent[\s\S]*!\s*userHasModelSignal[\s\S]*fastSourceTag\s*!==\s*"\[來源:QA\]"/.test(
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
  /function buildNeedModelForOperationReply[\s\S]*\[來源:專案流程規則\]/.test(
    linebot,
  ),
  "full-model request reply should carry a true project-flow source tag",
);

assertStep(
  /function buildNeedApplianceModelForOperationReply[\s\S]*\[來源:專案流程規則\]/.test(
    linebot,
  ),
  "appliance full-model request reply should carry a true project-flow source tag",
);

const manualDeflectionCode = [
  extractFunction(linebot, "sanitizeManualDeflection"),
  `
  globalThis.__manualDeflectionResult = [
    sanitizeManualDeflection("根據你提供的 PDF 文件，請照以下步驟操作。"),
    sanitizeManualDeflection("根據您提供的PDF，內容如下。"),
    sanitizeManualDeflection("依照你提供的手冊內容，可以這樣處理。"),
    sanitizeManualDeflection("根據這份 PDF 檔案，功能如下。")
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
  /官方手冊/.test(manualDeflectionContext.__manualDeflectionResult),
  "manual/PDF deflection sanitizer should rewrite user-provided-manual phrasing to official-manual phrasing",
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
  const priceReply = buildNoPriceReply_("請協助尋找M9、G8、M8、S34BG850SC3的市場最低價與建議售價。");
  globalThis.__priceGuardResult = {
    isPrice: isPriceQueryIntent_("G8現在價格多少？"),
    targets: extractPriceQueryTargets_("請協助尋找M9、G8、M8、S34BG850SC3的市場最低價與建議售價。"),
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
  priceGuardContext.__priceGuardResult.targets.includes("S34BG850SC3"),
  "price guard should preserve full model tokens like S34BG850SC3",
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

assertStep(
  fs.existsSync(path.join(root, "test_runner", "run_current_test.js")),
  "run_current_test.js must exist as the guarded online TestUI wrapper",
);

console.log("PASS: verify_sop_static_guards");
