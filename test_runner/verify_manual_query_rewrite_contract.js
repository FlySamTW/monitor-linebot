const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const linebot = fs.readFileSync(path.join(root, "linebot.gs"), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert(start >= 0, `找不到函式 ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`函式 ${name} 不完整`);
}

const rules = {
  S24F332EAC:
    "LS24F332EACXZW,型號：S24F332EA,24吋平面商用螢幕 SF33E,HDMI 1.4x1",
  S32CM703UC:
    "LS32CM703UCXZW,型號：S32CM703UC,32吋智慧聯網螢幕 M7,Tizen 作業系統",
  S49DG952SC:
    "LS49DG952SCXZW,型號：S49DG952SC,Odyssey OLED G9,智慧型 Tizen 作業系統",
  S27DG502EC:
    "LS27DG502ECXZW,型號：S27DG502EC,Odyssey G5 IPS 電競螢幕",
};

const context = {
  normalizeModelForDisplay: (value) =>
    String(value || "").trim().toUpperCase().replace(/^LS/, "S"),
  findExactModelRuleLine_: (model) => rules[String(model || "").toUpperCase()] || "",
  isPinRecoveryQuery: (value) => /忘記.{0,12}(?:PIN|密碼)/i.test(String(value || "")),
  writeLog: () => {},
};
vm.createContext(context);
[
  "isFactoryResetQueryWithoutPinIssue",
  "getManualInterfaceVocabularyProfile_",
  "buildFactoryResetManualSearchQuery_",
].forEach((name) => vm.runInContext(extractFunction(linebot, name), context));

const generalQuestion = "怎麼把螢幕設定全部重設";
const general = context.buildFactoryResetManualSearchQuery_(
  generalQuestion,
  "S24F332EAC",
);
assert.match(general, /Reset All/,
  "一般顯示器重設題必須擴寫英文 OSD 正式詞 Reset All");
assert.match(general, /System、Setup & Reset/,
  "一般顯示器必須搜尋中性 OSD 章節，不能只搜中文原句");
assert.match(general, new RegExp(generalQuestion),
  "擴寫後必須保留使用者原題");
assert.doesNotMatch(general, /Smart Monitor|Tizen|All Settings|General & Privacy|\u6240\u6709\u8a2d\u5b9a、\u4e00\u822c\u8207\u96b1\u79c1\u6b0a/,
  "非 Tizen 型號的實際查詢內容不得出現 Smart Monitor 詞彙污染");

const smart = context.buildFactoryResetManualSearchQuery_(
  "M7 怎麼恢復出廠設定",
  "S32CM703UC",
);
assert.match(smart, /All Settings、General & Privacy/,
  "RULE 明載 Tizen 時才應擴寫 Smart Monitor 選單詞");
assert.match(smart, /使用者原問題：M7 怎麼恢復出廠設定/,
  "Tizen 擴寫也不得取代原題");

const odysseyTizen = context.getManualInterfaceVocabularyProfile_("S49DG952SC");
assert.strictEqual(odysseyTizen.usesTizen, true,
  "介面分類必須依精確 RULE 能力，不能把 Odyssey 全部當成非 Tizen");
const odysseyOsd = context.getManualInterfaceVocabularyProfile_("S27DG502EC");
assert.strictEqual(odysseyOsd.usesTizen, false,
  "產品系列不能直接推導介面；只有 RULE 明載才可用 Tizen 詞彙");

const unknown = context.buildFactoryResetManualSearchQuery_(
  "請幫我重設所有設定",
  "S99ZZ999",
);
assert.match(unknown, /中性 OSD 詞彙|Reset All/,
  "未知介面必須 fail-safe 回中性檢索詞，不可猜 Tizen");

assert.strictEqual(
  context.isFactoryResetQueryWithoutPinIssue("我忘記 PIN，怎麼重設？"),
  false,
  "PIN 復原題不可誤進一般重設 Query Rewrite",
);

console.log("✓ PDF Query Rewrite 已依精確 RULE 介面分流，一般 OSD 不再被 Tizen 詞彙污染");
