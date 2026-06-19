const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertStep(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const linebot = read("linebot.gs");
const deployBat = read("deploy.bat");
const syncPrompt = read("tools/sync_prompt_c3.ps1");
const packageJson = JSON.parse(read("test_runner/package.json"));

const dynamicPromptStart = linebot.indexOf("function constructDynamicPrompt");
const dynamicPromptEnd = linebot.indexOf("function callLLMWithRetry", dynamicPromptStart);
assertStep(dynamicPromptStart >= 0, "constructDynamicPrompt not found");
assertStep(dynamicPromptEnd > dynamicPromptStart, "constructDynamicPrompt section end not found");
const dynamicPromptSection = linebot.slice(dynamicPromptStart, dynamicPromptEnd);

assertStep(
  !/sync_prompt_c3|GAS_ADMIN_SECRET|Prompt\.csv\s+to\s+Google Sheet/i.test(deployBat),
  "deploy.bat must not sync Prompt.csv or depend on GAS_ADMIN_SECRET",
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
