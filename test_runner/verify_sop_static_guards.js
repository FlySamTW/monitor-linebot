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
    /ensure_formal_version_current\.js/.test(packageJson.scripts["test:current"] || ""),
  "online TestUI regression script must run the formal-version guard first",
);

assertStep(
  packageJson.scripts &&
    packageJson.scripts["check:webhook-version"] === "node ensure_formal_version_current.js",
  "package.json must expose check:webhook-version",
);

console.log("PASS: verify_sop_static_guards");
