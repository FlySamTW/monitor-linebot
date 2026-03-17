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
  const userId = "TEST_M7_EXACT_ISSUE_001";

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

    const q1 =
      "客戶如果想用M7串聯其他的Matt 協議的裝置,是不是要購買smart thing hub";
    const q2 = "#查手冊 客戶如果想用M7串聯其他的Matt 協議的裝置,是不是要購買smart thing hub";

    await clearSession();

    const t1 = await send("/重啟");
    console.log("TURN 1 /重啟");
    (t1.replies || []).forEach((r, i) => console.log(`BOT#${i + 1}: ${r}`));

    const t2 = await send(q1);
    console.log(`\nTURN 2 ${q1}`);
    (t2.replies || []).forEach((r, i) => console.log(`BOT#${i + 1}: ${r}`));

    const t2Text = (t2.replies || []).join("\n");
    const t2Logs = t2.logs || [];
    console.log("\nTURN 2 LOGS (Smart Router related):");
    t2Logs
      .filter((x) => /Smart Router|AUTO_SEARCH_PDF|needsManual|Model Select|Flow Decision/.test(String(x)))
      .forEach((x) => console.log(String(x)));

    assertStep(
      !/\[來源\s*:\s*QA/i.test(t2Text) && !/\[來源\s*:\s*QA資料庫/i.test(t2Text),
      "turn2 still leaks fake QA source tag",
    );
    assertStep(
      !t2Logs.some((x) => /準備顯示型號選擇泡泡/.test(String(x))),
      "turn2 still triggered model selection bubble",
    );

    const t3 = await send(q2);
    console.log(`\nTURN 3 ${q2}`);
    (t3.replies || []).forEach((r, i) => console.log(`BOT#${i + 1}: ${r}`));

    const t3Text = (t3.replies || []).join("\n");
    assertStep(
      !/^[ \t]*[•●▪◦‧・]/m.test(t3Text),
      "manual reply still uses bullet symbol instead of numeric list",
    );
    assertStep(
      /\[來源:\s*[^\\\[\]]+\.pdf\s*\(官方手冊PDF\)\]/i.test(t3Text),
      "manual reply missing real PDF filename source tag",
    );

    console.log("\nPASS: verify_m7_exact_issue");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});
