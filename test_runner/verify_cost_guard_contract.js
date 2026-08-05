const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const linebot = fs.readFileSync(path.join(root, "linebot.gs"), "utf8");
const paidRunner = fs.readFileSync(
  path.join(__dirname, "verify_10_questions_5_rounds.js"),
  "utf8",
);

const baseline = {
  generatedCalls: 190,
  inputTokens: 6519548,
  outputTokens: 25460,
  historicalInputUsdPerMillion: 0.1,
  historicalOutputUsdPerMillion: 0.4,
  exchangeRate: 32,
};

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

const historicalCostTwd =
  ((baseline.inputTokens / 1e6) * baseline.historicalInputUsdPerMillion +
    (baseline.outputTokens / 1e6) * baseline.historicalOutputUsdPerMillion) *
  baseline.exchangeRate;
const currentCostTwd = historicalCostTwd;

assert(baseline.generatedCalls === 190, "7/7 保存紀錄基線為 190 次生成");
assert(baseline.inputTokens === 6519548, "7/7 基線 input tokens 為 6,519,548");
assert(baseline.outputTokens === 25460, "7/7 基線 output tokens 為 25,460");
assert(
  Math.abs(historicalCostTwd - 21.1884416) < 1e-9,
  "舊費率對應歷史估算 NT$21.1884，不重寫基線",
);
assert(
  Math.abs(currentCostTwd - 21.1884416) < 1e-9,
  "2026-08-05 Standard 官方費率仍對應 NT$21.1884",
);

assert(
  /PRICE_FAST_INPUT\s*=\s*0\.1/.test(linebot) &&
    /PRICE_FAST_OUTPUT\s*=\s*0\.4/.test(linebot),
  "Gemini 2.5 Flash-Lite Standard 成本常數符合官方現價",
);
assert(
  /MAX_FAST_INPUT_TOKENS:\s*12000/.test(linebot) &&
    /MAX_LEGACY_PDF_INPUT_TOKENS:\s*20000/.test(linebot) &&
    /MAX_PDF_OUTPUT_TOKENS:\s*1200/.test(linebot),
  "Fast/PDF input 與 PDF output 硬上限已寫入程式",
);
assert(
  /:countTokens\?key=/.test(linebot) &&
    /generateContentRequest: generateContentRequest/.test(linebot) &&
    /file_data/.test(linebot) &&
    /file_uri/.test(linebot) &&
    /PDF countTokens 失敗，fail closed/.test(linebot),
  "PDF fuse 以含 file URI 的 countTokens 預檢且失敗時 fail closed",
);
assert(
  /slice\(0, CONFIG\.MAX_RELEVANT_RULE_LINES\)/.test(linebot) &&
    /MAX_RELEVANT_RULE_LINES:\s*8/.test(linebot),
  "Fast Mode 最多注入 8 筆相關 RULE",
);
assert(
  /setProperty\("PENDING_MODEL_REVIEW"/.test(linebot) &&
    /未寫入 CLASS_RULES/.test(linebot) &&
    /function isIncompleteModelRuleLine_/.test(linebot) &&
    /Sync RULE Guard v29\.6\.096/.test(linebot) &&
    !/const placeholderLine = `\$\{model\},型號：尚無資訊`/.test(linebot),
  "新舊未完成型號只進待審核且不注入正式 RULE prompt/index",
);
assert(
  /Fast\/Web 歷史先裁減/.test(linebot) &&
    !/effectiveMessages = recentMessages;[\s\S]{0,300}const payload = \{\s*contents: geminiContents/.test(
      linebot,
    ),
  "歷史在建立唯一 payload 前裁減",
);
assert(
  !/無 groundingChunks\/groundingSupports，重試一次/.test(linebot) &&
    /不為補引用自動再生成/.test(linebot),
  "網搜缺引用時停止，不自動付費再生成",
);
assert(
  /--paid-live/.test(paidRunner) &&
    /MAX_PDF_CALLS > 3/.test(paidRunner) &&
    /MAX_COST_TWD > 0\.3/.test(paidRunner),
  "10x5 正式 runner 需明確 paid-live 且受 PDF/費用預算限制",
);

if (process.exitCode) process.exit(process.exitCode);
console.log("Cost guard contract passed.");
