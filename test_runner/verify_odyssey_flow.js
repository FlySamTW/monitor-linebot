const puppeteer = require("puppeteer");

async function main() {
  const TEST_URL =
    "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";
  const userId = "TEST_ODYSSEY_QA_FIRST_001";
  const turns = [
    "/重啟",
    "我的3d螢幕該如何開啟Odyssey hub",
    "#搜網上其他解答",
    "#再詳細說明",
    "#再詳細說明",
  ];

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 5000));

    let frame = null;
    for (const f of page.frames()) {
      const input = await f.$("#msg-input").catch(() => null);
      if (input) {
        frame = f;
        break;
      }
    }
    if (!frame) {
      throw new Error("TestUI frame not found");
    }

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

    const testMessage = (msg) =>
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

    await clearSession();

    const keyPatterns = [
      "[Direct Search]",
      "[DirectDeep",
      "[KB Load]",
      "[DynamicContext]",
      "[Ctx Info]",
      "[AI Raw Response]",
      "[Signal Check]",
      "[Flow Decision]",
      "[Final Reply]",
      "[Quick Reply",
    ];

    for (let i = 0; i < turns.length; i++) {
      const q = turns[i];
      let res = null;
      try {
        res = await testMessage(q);
      } catch (e) {
        console.log("\n====================================");
        console.log(`TURN ${i + 1} USER: ${q}`);
        console.log(`BOT: (呼叫失敗) ${e && e.message ? e.message : e}`);
        continue;
      }

      const replies = Array.isArray(res && res.replies) ? res.replies : [];
      const logs = Array.isArray(res && res.logs) ? res.logs : [];

      console.log("\n====================================");
      console.log(`TURN ${i + 1} USER: ${q}`);
      if (replies.length === 0) {
        console.log("BOT: (無回覆)");
      } else {
        replies.forEach((r, idx) => {
          console.log(`BOT#${idx + 1}: ${String(r).replace(/\n{3,}/g, "\n\n")}`);
        });
      }

      console.log("--- KEY LOGS ---");
      logs
        .filter((l) => keyPatterns.some((p) => String(l).includes(p)))
        .slice(-30)
        .forEach((l) => console.log(String(l)));
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
