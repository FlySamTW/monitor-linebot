const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "..", "linebot.gs"), "utf8");

function assertStep(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function extractApiFailureRegex() {
  const fnMatch = source.match(
    /function\s+isApiFailureReply\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/,
  );
  assertStep(fnMatch, "isApiFailureReply function not found");

  const regexMatch = fnMatch[1].match(/return\s+\/([\s\S]*?)\/([a-z]*)\.test\(/);
  assertStep(regexMatch, "isApiFailureReply regex not found");

  return new RegExp(regexMatch[1], regexMatch[2]);
}

const apiFailureRegex = extractApiFailureRegex();

assertStep(
  /const GAS_VERSION = "v29\.5\.269"/.test(source),
  "linebot.gs version should be v29.5.269",
);

assertStep(
  apiFailureRegex.test("系統暫時忙碌，這次查詢暫時無法處理，請稍後再試一次。"),
  "new customer-friendly API busy reply must be treated as API failure",
);

assertStep(
  /if\s*\(\s*isApiFailureReply\(cleaned\)\s*\)\s*\{\s*return\s+cleaned;\s*\}/.test(
    source,
  ),
  "appendPdfSourceTag must return API failure replies before adding PDF source tags",
);

assertStep(
  !/升級付費方案|AI\s*暫時無法處理您的請求/.test(source),
  "linebot.gs must not contain old internal API failure wording",
);

assertStep(
  !/請選擇您的|請點擊您的|幫您在網路上|將為您搜尋|為您深入分析/.test(source),
  "linebot.gs must not contain known user-facing formal-pronoun UI phrases",
);

console.log("PASS: verify_api_failure_source_guard");
