const puppeteer = require("puppeteer");

const TEST_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function findFrame(page) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    for (const f of page.frames()) {
      const el = await f.$("#msg-input").catch(() => null);
      if (el) return f;
    }
    await sleep(1000);
  }
  return null;
}

async function call(frame, fnName, ...args) {
  return frame.evaluate(
    (f, a) =>
      new Promise((resolve, reject) => {
        try {
          google.script.run
            .withSuccessHandler(resolve)
            .withFailureHandler(reject)
            [f](...a);
        } catch (e) {
          reject(e);
        }
      }),
    fnName,
    args,
  );
}

function joined(res, key) {
  const arr = Array.isArray(res && res[key]) ? res[key] : [];
  return arr.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("\n");
}

function assertStep(condition, message, details = "") {
  if (!condition) {
    throw new Error(`${message}${details ? `\n${details}` : ""}`);
  }
}

async function run() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });
  const frame = await findFrame(page);
  if (!frame) throw new Error("TestUI frame not found");

  const ruleUser = `TEST_RULE_DRAFT_${Date.now()}`;
  await call(frame, "clearTestSession", ruleUser);

  const ruleMsg =
    "/紀錄 本期三星螢幕活動：S27FG532EC 建議售價 5490 促銷價 4990，活動期間 2026/07/01-2026/07/31，來源：https://promotion.twsamsungcampaign.com/test.aspx";
  const ruleRes = await call(frame, "testMessage", ruleMsg, ruleUser);
  const ruleReplies = joined(ruleRes, "replies");
  const ruleLogs = joined(ruleRes, "logs");

  assertStep(/CLASS_RULES/.test(ruleReplies), "RULE draft should preview CLASS_RULES", ruleReplies);
  assertStep(!/將寫入 QA/.test(ruleReplies), "RULE draft must not preview as QA", ruleReplies);
  assertStep(/S27FG532EC/.test(ruleReplies), "RULE draft should preserve full model", ruleReplies);
  assertStep(!/\[Fatal\]/.test(ruleLogs), "RULE draft should not produce fatal logs", ruleLogs);

  const numberRes = await call(frame, "testMessage", "2", ruleUser);
  const numberReplies = joined(numberRes, "replies");
  assertStep(
    /沒有等待 1\/2\/3 選項|目前這份草稿沒有等待/.test(numberReplies),
    "Standalone number must not be written into a normal RULE draft",
    numberReplies,
  );

  const irrelevantRes = await call(frame, "testMessage", "我想吃蘋果", ruleUser);
  const irrelevantReplies = joined(irrelevantRes, "replies");
  assertStep(
    /不像是在修改目前這筆 RULE/.test(irrelevantReplies),
    "Irrelevant short text must not pollute RULE draft",
    irrelevantReplies,
  );
  await call(frame, "testMessage", "/取消", ruleUser);

  const campaignUser = `TEST_CAMPAIGN_URL_${Date.now()}`;
  await call(frame, "clearTestSession", campaignUser);
  const campaignRes = await call(
    frame,
    "testMessage",
    "/紀錄 https://promotion.twsamsungcampaign.com/2026-mnt-q2-sp/rule.aspx",
    campaignUser,
  );
  const campaignReplies = joined(campaignRes, "replies");
  assertStep(/CLASS_RULES/.test(campaignReplies), "Campaign URL should preview CLASS_RULES", campaignReplies);
  assertStep(
    /ViewFinity|Odyssey|Steam|延長保固|Galaxy S26/.test(campaignReplies),
    "Campaign URL should be expanded into official page content, not only stored as a URL",
    campaignReplies,
  );
  assertStep(
    !/活動_手動建檔,電腦螢幕活動RULE,https:\/\/promotion\.twsamsungcampaign\.com/i.test(
      campaignReplies,
    ),
    "Campaign URL fallback must not save only the URL",
    campaignReplies,
  );
  await call(frame, "testMessage", "/取消", campaignUser);

  const aliasUser = `TEST_ALIAS_G5_${Date.now()}`;
  await call(frame, "clearTestSession", aliasUser);
  const aliasRes = await call(frame, "testMessage", "#查手冊 G5 怎麼重置", aliasUser);
  const aliasReplies = joined(aliasRes, "replies");
  const aliasLogs = joined(aliasRes, "logs");
  assertStep(
    /請先選完整型號|請選擇 G5 完整型號|型號選擇泡泡|G5 型號確認/.test(
      aliasReplies + "\n" + aliasLogs,
    ),
    "Short alias manual query should ask user to select a full model first",
    aliasReplies + "\n---LOGS---\n" + aliasLogs,
  );
  assertStep(
    !/已鎖定直通車型號: G5|載入 PDF: G5/i.test(aliasLogs),
    "Short alias must not be used directly as the PDF lookup model",
    aliasLogs,
  );
  assertStep(
    !/S32FM702UC|S32FM703UC|SMART\s*MONITOR/i.test(aliasLogs),
    "G5 alias candidates must not be polluted by non-G5 Smart Monitor models",
    aliasLogs,
  );

  await browser.close();
  console.log("PASS: verify_rule_draft_and_alias");
}

run().catch(async (e) => {
  console.error("TEST ERROR:", e);
  process.exit(1);
});
