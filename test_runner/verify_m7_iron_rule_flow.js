const puppeteer = require("puppeteer");

const TEST_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";

function assertStep(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const userId = "TEST_M7_IRON_RULE_001";

  try {
    await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 5000));

    let frame = null;
    for (const f of page.frames()) {
      const el = await f.$("#msg-input").catch(() => null);
      if (el) {
        frame = f;
        break;
      }
    }
    if (!frame) throw new Error("TestUI frame not found");

    const clearSession = () =>
      frame.evaluate(
        (uid) =>
          new Promise((resolve, reject) => {
            google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler(reject)
              .clearTestSession(uid);
          }),
        userId,
      );

    const send = (msg) =>
      frame.evaluate(
        (m, uid) =>
          new Promise((resolve, reject) => {
            google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler(reject)
              .testMessage(m, uid);
          }),
        msg,
        userId,
      );

    const q = "客戶如果想用M7串聯其他的Matt 協議的裝置,是不是要購買smart thing hub";

    await clearSession();

    const t1 = await send("/重啟");
    console.log("TURN1 /重啟");
    (t1.replies || []).forEach((r, i) => console.log(`BOT#${i + 1}: ${r}`));

    const t2 = await send(q);
    console.log(`\nTURN2 ${q}`);
    (t2.replies || []).forEach((r, i) => console.log(`BOT#${i + 1}: ${r}`));
    console.log("TURN2 related logs:");
    (t2.logs || [])
      .filter((x) => /Auto Search|Smart Router|Flow Decision|AUTO_SEARCH_PDF|型號選擇/.test(String(x)))
      .forEach((x) => console.log(String(x)));

    const t2Text = (t2.replies || []).join("\n");
    const t2Logs = t2.logs || [];
    const askedByText = /先選完整型號|型號|請回覆其中一個完整型號/.test(t2Text);
    const askedByBubbleLogs = t2Logs.some((x) =>
      /命中SOP手冊查證且多型號|準備顯示型號選擇泡泡/.test(String(x)),
    );
    assertStep(
      askedByText || askedByBubbleLogs,
      "turn2 did not trigger model selection before manual verification",
    );

    const t3 = await send("#型號:S32FM703UC");
    console.log("\nTURN3 #型號:S32FM703UC");
    (t3.replies || []).forEach((r, i) => console.log(`BOT#${i + 1}: ${r}`));

    const t3Text = (t3.replies || []).join("\n");
    assertStep(
      /\[來源:\s*[^\]]+\.pdf\s*\(官方手冊PDF\)\]/i.test(t3Text),
      "turn3 missing real pdf source tag",
    );
    assertStep(
      !/(建議你.*官網|自行查手冊|上官網查詢|最直接且準確)/.test(t3Text),
      "turn3 still contains manual/web self-check deflection",
    );

    console.log("\nPASS: verify_m7_iron_rule_flow");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});
