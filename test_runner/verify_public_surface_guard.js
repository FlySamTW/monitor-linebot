const fs = require("fs");
const path = require("path");

const linebot = fs.readFileSync(path.join(__dirname, "..", "linebot.gs"), "utf8");
const testUi = fs.readFileSync(path.join(__dirname, "..", "TestUI.html"), "utf8");

function assertStep(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

[
  "pdfIndex",
  "sync",
  "driveFiles",
  "readRules",
  "meta",
  "testRun",
  "readlog",
  "readlogSheet",
  "geminiFiles",
].forEach((name) => {
  const marker = `e.parameter.${name}`;
  const index = linebot.indexOf(marker);
  assertStep(index >= 0, `${name} endpoint exists for guarded maintenance use`);
  const window = linebot.slice(index, index + 220);
  assertStep(
    /isDoGetMaintenanceAuthorized_\(e\)/.test(window),
    `${name} endpoint requires maintenance authorization`,
  );
});

assertStep(
  /MAINTENANCE_SECRET/.test(linebot) &&
    !/getProperty\("GEMINI_API_KEY"\) \|\|\s*""/.test(linebot.slice(linebot.indexOf("function getDoGetMaintenanceSecret_"), linebot.indexOf("function buildUnauthorizedResponse_"))) &&
    !/sam2026/.test(linebot),
  "maintenance authorization never falls back to the Gemini API key",
);

assertStep(
  !/json\.secret\s*!==\s*PropertiesService\.getScriptProperties\(\)\.getProperty\("GEMINI_API_KEY"\)/.test(linebot) &&
    !/OPENCODE_WRITE_SECRET or GEMINI_API_KEY/.test(linebot) &&
    !/testtesttest/.test(linebot),
  "POST maintenance actions never accept Gemini credentials or a built-in fallback password",
);

assertStep(
  /assertTestUiAuthorized_\(testUiAccessToken\)/.test(linebot) &&
    /function testMessage\(msg, userId, testUiAccessToken\)/.test(linebot) &&
    /function clearTestSession\(userId, testUiAccessToken\)/.test(linebot) &&
    /function saveDraftToSheet\(draft\)[\s\S]{0,260}IS_TEST_MODE/.test(linebot),
  "TestUI requests require a short-lived token and cannot write QA or RULE data",
);

assertStep(
  /function isEditorOnlyDevelopmentWebApp_\(\)/.test(linebot) &&
    /ScriptApp\.getService\(\)\.getUrl\(\)/.test(linebot) &&
    /\/\\\/dev\(\?:\[\?#\]\.\*\)\?\$\//.test(linebot) &&
    /!isDoGetMaintenanceAuthorized_\(e\)[\s\S]{0,120}!isEditorOnlyDevelopmentWebApp_\(\)/.test(
      linebot,
    ),
  "editor-only /dev TestUI may issue a short token while public /exec remains secret-guarded",
);

assertStep(
  /TEST_UI_ACCESS_TOKEN/.test(testUi) &&
    /TEST_USER_ID_KEY/.test(testUi) &&
    /testMessage\(text, TEST_USER_ID, TEST_UI_ACCESS_TOKEN\)/.test(testUi) &&
    /clearTestSession\(TEST_USER_ID, TEST_UI_ACCESS_TOKEN\)/.test(testUi),
  "TestUI forwards its authorized session token to the backend",
);

assertStep(
  (testUi.match(/<\?/g) || []).length === 1 &&
    /<\?!=\s*testUiAccessToken\s*\?>/.test(testUi) &&
    !/includes\(["']<\?["']\)/.test(testUi),
  "TestUI HtmlService template only contains the intended token scriptlet",
);

assertStep(
  /var messageIdSequence = 0;/.test(testUi) &&
    (testUi.match(/\+ \+\+messageIdSequence/g) || []).length >= 2 &&
    !/var id = "msg-" \+ new Date\(\)\.getTime\(\);/.test(testUi),
  "TestUI message bubbles use collision-free ids so Reading placeholders are removed",
);

assertStep(
  !/function restoreClassRulesToSheet/.test(linebot) &&
    !/clearContents\(\)[\s\S]{0,180}CLASS_RULES/.test(linebot) &&
    !/restoreClassRulesToSheet/.test(
      fs.readFileSync(path.join(__dirname, "..", "test_runner", "package.json"), "utf8"),
    ),
  "no production or runner path can restore CLASS_RULES by clearing the knowledge base",
);

console.log("PASS: verify_public_surface_guard");
