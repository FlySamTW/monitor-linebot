const puppeteer = require("puppeteer");

function hasPattern(lines, regex) {
  return (lines || []).some((l) => regex.test(String(l)));
}

function assertStep(ok, message) {
  if (!ok) {
    throw new Error(message);
  }
}

async function main() {
  const TEST_URL =
    "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";
  const userId = "TEST_ELABORATION_LIMIT_001";

  const turns = [
    "/重啟",
    "我的3d螢幕該如何開啟Odyssey hub",
    "#再詳細說明",
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

    const all = [];
    for (let i = 0; i < turns.length; i++) {
      const q = turns[i];
      const res = await testMessage(q);
      const replies = Array.isArray(res && res.replies) ? res.replies : [];
      const logs = Array.isArray(res && res.logs) ? res.logs : [];
      all.push({ q, replies, logs });

      console.log("\n====================================");
      console.log(`TURN ${i + 1} USER: ${q}`);
      if (replies.length === 0) {
        console.log("BOT: (無回覆)");
      } else {
        replies.forEach((r, idx) => console.log(`BOT#${idx + 1}: ${r}`));
      }
    }

    const t3 = all[2];
    const t4 = all[3];
    const t5 = all[4];

    assertStep(
      hasPattern(t3.logs, /再詳細說明計數:\s*1\/2/) &&
        hasPattern(t4.logs, /再詳細說明計數:\s*2\/2/),
      "Step1 failed: 前兩次 #再詳細說明 計數紀錄不正確。",
    );

    assertStep(
      hasPattern(t5.logs, /再詳細說明達上限/) &&
        hasPattern(t5.replies, /已經補充到第\s*2\s*次|已經補充到第2次/),
      "Step2 failed: 第三次 #再詳細說明 未觸發上限保護。",
    );

    console.log("\nPASS: verify_elaboration_limit");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});

