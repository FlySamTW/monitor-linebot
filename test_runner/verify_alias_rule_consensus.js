const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "linebot.gs"), "utf8");

function extractFunction(name) {
  const start = source.indexOf(`function ${name}`);
  assert(start >= 0, `缺少函式：${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`函式未正常結束：${name}`);
}

let ruleRows = [];
const cache = new Map();
const context = {
  console,
  SHEET_NAMES: { CLASS_RULES: "CLASS_RULES" },
  ss: {
    getSheetByName: () => ({
      getLastRow: () => ruleRows.length + 1,
      getRange: () => ({ getValues: () => ruleRows.map((line) => [line]) }),
    }),
  },
  CacheService: {
    getScriptCache: () => ({
      get: (key) => cache.get(key) || null,
      put: (key, value) => cache.set(key, String(value)),
    }),
  },
  toHalfWidth: (value) => String(value || ""),
  normalizeModelForDisplay: (value) =>
    String(value || "")
      .trim()
      .toUpperCase()
      .replace(/^LS(?=\d{2})/, "S")
      .replace(/X[A-Z]{2,4}$/, ""),
  dedupDisplayModels: (values, limit = 10) =>
    [...new Set((values || []).map((value) => context.normalizeModelForDisplay(value)).filter(Boolean))].slice(0, limit),
  buildModelLookupVariants: (value) => {
    const normalized = context.normalizeModelForDisplay(value);
    return normalized ? [normalized, `L${normalized}`] : [];
  },
  extractShortAliasModelTokens: (value) =>
    (String(value || "").toUpperCase().match(/\b(?:G8|M7|S9)\b/g) || []),
  isOperationOrTroubleshootQuery: (value) =>
    /(?:怎麼|如何|步驟|設定|開啟|切換|故障|無法|連接)/i.test(String(value || "")),
  isExplicitRuleTermDefinitionQuestion_: () => false,
  isModeQualifiedDisplaySpecQuestion_: () => false,
  isPriceQueryIntent_: (value) => /(?:價格|多少錢)/.test(String(value || "")),
  findRuleTermOntologyMatches_: () => [],
  sanitizeExactRuleReplyField_: (value) => String(value || "").trim(),
  writeLog: () => {},
};
vm.createContext(context);
vm.runInContext(
  [
    "splitClassRuleFields_",
    "getAliasConsensusRuleRequests_",
    "ruleLineContainsExactModel_",
    "getAliasConsensusRuleLineMap_",
    "normalizeAliasConsensusRawValue_",
    "extractAliasConsensusRuleValue_",
    "buildAliasRuleConsensusReply_",
  ].map(extractFunction).join("\n\n"),
  context,
);

const models = ["S27AA111NC", "S32BB222SC"];
function setRows(rows) {
  ruleRows = rows;
  cache.clear();
}
function reply(question) {
  return context.buildAliasRuleConsensusReply_(question, models);
}

setRows([
  "別稱_G8,型號模式：G8,S27AA111NC,S32BB222SC,HDMI 2.1 x2",
  "LS27AA111NCXZW,型號：S27AA111NC,27吋,4K UHD (3840 x 2160)解析度,HDMI 2.1 x2,OLED面板,KVM支援",
  "LS32BB222SCXZW,型號：S32BB222SC,32吋,4K UHD(3840×2160)解析度,HDMI 2.1 x2,OLED面板,KVM支援",
]);
assert.match(reply("G8 解析度是多少？"), /3840 × 2160/,
  "同一解析度即使空白與乘號不同，正規化後也應免選型直答");
assert.match(reply("G8 有幾個 HDMI？"), /HDMI 2\.1 x2/,
  "每個候選的 HDMI 版本與數量一致時應直答");
assert.match(reply("G8 是 OLED 面板嗎？"), /面板：OLED/,
  "尺寸不同不影響本題面板欄位的保守共識");
assert.match(reply("G8 有 KVM 嗎？"), /KVM：支援/,
  "所有完整型號都明載功能時才可回答支援");
assert.strictEqual(reply("G8 規格"), "",
  "只問泛稱規格時不得把部分共同欄位當成整系列答案");
assert.strictEqual(reply("G8 怎麼開啟 PBP？"), "",
  "選單步驟題不可以規格共識跳過選型");
assert.strictEqual(reply("G8 HDMI 連接後無畫面怎麼辦？"), "",
  "故障排除題不可以規格共識跳過選型");

setRows([
  "LS27AA111NCXZW,型號：S27AA111NC,HDMI 2.1 x2",
  "LS32BB222SCXZW,型號：S32BB222SC,HDMI 2.0 x2",
]);
assert.strictEqual(reply("G8 有幾個 HDMI？"), "",
  "同欄位版本不一致必須維持選型");

setRows([
  "別稱_G8,共同 HDMI 2.1 x2,S27AA111NC,S32BB222SC",
  "LS27AA111NCXZW,型號：S27AA111NC,HDMI 2.1 x2",
  "LS32BB222SCXZW,型號：S32BB222SC,OLED面板",
]);
assert.strictEqual(reply("G8 有幾個 HDMI？"), "",
  "任一完整型號缺欄位時，別稱列的說明不得充當證據");

setRows([
  "LS27AA111NC2XZW,型號：S27AA111NC2,HDMI 2.1 x2",
  "LS32BB222SCXZW,型號：S32BB222SC,HDMI 2.1 x2",
]);
assert.strictEqual(reply("G8 有幾個 HDMI？"), "",
  "互為前綴的其他型號不得被當成精確型號 RULE");

const routeStart = source.indexOf("const aliasSelectionBeforeQa");
const consensusRoute = source.indexOf("buildAliasRuleConsensusReply_", routeStart);
const selectionRoute = source.indexOf("shouldPromptAliasModelSelection_", consensusRoute);
assert(routeStart >= 0 && consensusRoute > routeStart && selectionRoute > consensusRoute,
  "共識直答必須位於別稱選型守門之前");
assert.match(source.slice(routeStart, routeStart + 220), /routingQuestion,\s*50,\s*false/,
  "共識必須檢查完整候選集，不可只看前 10 款");

console.log("PASS: alias RULE consensus is all-candidates, exact-model, and field-conservative");
