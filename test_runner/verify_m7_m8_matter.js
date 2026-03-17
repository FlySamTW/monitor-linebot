const puppeteer = require("puppeteer");

const TEST_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";

function hasAny(lines, pattern) {
  return (lines || []).some((x) => pattern.test(String(x)));
}

function assertStep(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const userId = "TEST_M7_M8_MATTER_001";

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

    const turns = [
      "\u002f\u91cd\u555f",
      "M7 connect Matter devices, need SmartThings Hub?",
      "How about M8?",
      "#\u67e5\u624b\u518a M7 connect Matter devices, need SmartThings Hub?",
    ];

    await clearSession();

    const all = [];
    for (let i = 0; i < turns.length; i++) {
      const q = turns[i];
      const res = await send(q);
      const replies = Array.isArray(res && res.replies) ? res.replies : [];
      const logs = Array.isArray(res && res.logs) ? res.logs : [];
      all.push({ q, replies, logs });
      console.log(`\nTURN ${i + 1} USER: ${q}`);
      replies.forEach((r, idx) => console.log(`BOT#${idx + 1}: ${String(r)}`));
    }

    const t4 = all[3];
    const t4Text = (t4.replies || []).join("\n");

    assertStep(
      hasAny(t4.logs, /forceCurrentOnly=true/),
      "manual flow did not trigger forceCurrentOnly guard",
    );

    assertStep(
      t4Text.includes("PDF)"),
      "manual reply missing real PDF source tag",
    );

    assertStep(
      !/Smart Monitor M7/i.test(t4Text),
      "fake source title still appears",
    );

    assertStep(
      !/(\u67e5\u95b1.*\u624b\u518a|\u4e0a\u5b98\u7db2\u67e5\u8a62)/.test(t4Text),
      "manual reply still asks user to self-check manual/website",
    );

    console.log("\nPASS: verify_m7_m8_matter");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});
