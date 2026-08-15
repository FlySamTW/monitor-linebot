const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const linebot = fs.readFileSync(path.join(root, "linebot.gs"), "utf8");
const testUi = fs.readFileSync(path.join(root, "TestUI.html"), "utf8");
const classRules = fs.readFileSync(path.join(root, "CLASS_RULES.csv"), "utf8");

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

const rows = classRules.split(/\r?\n/).map((line) => [line]);
const hPdfIndex = [
  "S27H704",
  "S32HG802",
  "S32HG806",
  "S27HG806",
  "S27HG802",
  "S27HG612",
];
const properties = new Map([["PDF_MODEL_INDEX", JSON.stringify(hPdfIndex)]]);
const cache = new Map();
const context = {
  console,
  GAS_VERSION: "vTEST",
  SHEET_NAMES: { CLASS_RULES: "CLASS_RULES" },
  CACHE_KEYS: { PDF_MODEL_INDEX_BACKUP: "PDF_MODEL_INDEX_BACKUP" },
  ss: {
    getSheetByName() {
      return {
        getLastRow() {
          return rows.length;
        },
        getRange() {
          return { getValues: () => rows };
        },
      };
    },
  },
  CacheService: {
    getScriptCache() {
      return {
        get: (key) => cache.get(key) || null,
        put: (key, value) => cache.set(key, String(value)),
      };
    },
  },
  PropertiesService: {
    getScriptProperties() {
      return {
        getProperty: (key) => properties.get(key) || null,
      };
    },
  },
  writeLog() {},
  isIncompleteModelRuleLine_() {
    return false;
  },
};

const functions = [
  "normalizeModelForDisplay",
  "dedupDisplayModels",
  "extractFullModelLikeTokens",
  "isShortAliasModelToken",
  "isFullSamsungMonitorModelForOfficialPage_",
  "isSafeSamsungTwOfficialUrl_",
  "normalizePdfModelToken_",
  "isPdfSalesSuffix_",
  "isPdfModelTokenMatch_",
  "getSamsungOfficialModelPage_",
  "resolveSamsungOfficialModelPage_",
  "isKnowledgeMissingReply_",
  "shouldOfferSamsungOfficialPage_",
  "buildSamsungOfficialPageQuickReply_",
  "extractManualCoverageRuleIdentity_",
  "readManualCoverageRuleIdentities_",
  "readPdfModelIndexForCoverage_",
  "buildManualCoverageReport_",
];
vm.runInNewContext(
  functions.map((name) => extractFunction(linebot, name)).join("\n\n"),
  context,
);

const explicitPage = context.getSamsungOfficialModelPage_("S27HG806EF");
assert(
  explicitPage &&
    explicitPage.source === "rule_pdp" &&
    /odyssey-g8-g80hf/i.test(explicitPage.uri),
  "RULE 有官網網址時必須直接使用該款 PDP",
);
const fallbackPage = context.getSamsungOfficialModelPage_("S32HG806ES");
assert(
  fallbackPage &&
    fallbackPage.source === "rule_support" &&
    /\/support\/model\/LS32HG806ESXZW\/$/i.test(fallbackPage.uri),
  "RULE 沒 PDP 網址時必須以同列完整料號建立官方支援頁",
);
assert.strictEqual(
  context.getSamsungOfficialModelPage_("G8"),
  null,
  "系列別稱不得產生單一機型官網連結",
);
assert.strictEqual(
  context.resolveSamsungOfficialModelPage_(
    "這個問題還有別的做法嗎？",
    null,
    ["S32HG806ES"],
    ["S32HG806ES"],
  ),
  null,
  "無型號的新題不得借 suggested/direct-search Cache 顯示上一款官網",
);
assert(
  context.resolveSamsungOfficialModelPage_(
    "S32HG806ES 的手冊還沒有直接證據",
    "S32HG806ES",
  ),
  "本題已明確解析完整型號時仍應提供該款官網",
);
assert(
  context.shouldOfferSamsungOfficialPage_("官方手冊未記載這項設定。"),
  "答案不足時應提供官網承接",
);
assert(
  !context.shouldOfferSamsungOfficialPage_("這款支援 4K 240Hz。"),
  "已完整回答時不得額外塞入官網按鈕",
);
const uriQuickReply = context.buildSamsungOfficialPageQuickReply_(explicitPage);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(uriQuickReply.action)),
  {
    type: "uri",
    label: "🔗 到這款官網",
    uri: explicitPage.uri,
  },
  "官網承接必須使用 LINE URI quick reply",
);

const coverage = context.buildManualCoverageReport_();
assert.strictEqual(coverage.currentGenerationModelCount, 6);
assert.strictEqual(coverage.currentGenerationMissingCount, 0);
properties.set(
  "PDF_MODEL_INDEX",
  JSON.stringify(hPdfIndex.filter((model) => model !== "S27HG806")),
);
const missingCoverage = context.buildManualCoverageReport_();
assert(
  missingCoverage.currentGenerationMissingModels.includes("S27HG806EF"),
  "2026 RULE 有型號但 PDF 索引缺少時必須出現在報表",
);
properties.delete("PDF_MODEL_INDEX");
properties.delete("PDF_MODEL_INDEX_BACKUP");
const unavailableCoverage = context.buildManualCoverageReport_();
assert.strictEqual(unavailableCoverage.status, "INDEX_UNAVAILABLE");
assert.strictEqual(unavailableCoverage.currentGenerationMissingCount, null);
assert(
  Array.isArray(unavailableCoverage.currentGenerationMissingModels) &&
    unavailableCoverage.currentGenerationMissingModels.length === 0,
  "索引不可用不得把所有 2026 型號誤報為缺手冊",
);

const dailyFunction = extractFunction(linebot, "dailyKnowledgeRefresh");
const syncFunction = extractFunction(linebot, "syncGeminiKnowledgeBase");
assert(
  /syncGeminiKnowledgeBase\(true\)[\s\S]*auditManualCoverageGaps_\(\)/.test(
    dailyFunction,
  ),
  "每日 04:00 重傳後必須執行 RULE/PDF 缺口稽核",
);
assert(
  /drivePdfCatalog\.push\(\{[\s\S]*?identity:\s*fileIdentity[\s\S]*?if \(existingFilesMap\.has\(fileName\)\)/.test(
    syncFunction,
  ) &&
    /duplicateDrivePdfNames\.push\(fileName\)/.test(syncFunction) &&
    /hasIncompleteDriveSync && hasPdfInFallback/.test(syncFunction) &&
    /driveScanSucceeded && drivePdfCatalog\.some\(isPdfKbFile\)/.test(
      syncFunction,
    ) &&
    /const shouldPersistPdfState[\s\S]{0,400}!hasDriveScanFailure/.test(
      syncFunction,
    ) &&
    /const shouldRefreshPdfBackups[\s\S]{0,400}!hasIncompleteDriveSync/.test(
      syncFunction,
    ) &&
    /if \(hasDriveScanFailure \|\| failedCount > 0\)[\s\S]{0,600}scheduleImmediateRebuild\(\)/.test(
      syncFunction,
    ) &&
    /知識庫同步未完整，已保留前次狀態並排程重試/.test(syncFunction),
  "部分 PDF 上傳失敗或 Drive 掃描未完整時，不得覆蓋正式狀態，且必須受控背景重試",
);
assert(
  /manualCoverage === "1"[\s\S]{0,220}isDoGetMaintenanceAuthorized_/.test(
    linebot,
  ),
  "手冊覆蓋端點必須受維護憑證保護",
);
assert(
  /manual-coverage-badge/.test(testUi) &&
    /action\.type === "uri"/.test(testUi) &&
    /res\.quickReplies/.test(testUi) &&
    /control\.target = "_top"/.test(testUi) &&
    /report\.status !== "OK"[\s\S]{0,220}手冊覆蓋：待檢查/.test(testUi),
  "TestUI 必須顯示維護覆蓋狀態，並讓 Apps Script sandbox 內的 URI quick reply 可實際開啟",
);

console.log("PASS: 官網承接與 RULE/PDF 缺口契約");
