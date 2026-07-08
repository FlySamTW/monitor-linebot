const puppeteer = require("puppeteer");

const TEST_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";

function assertStep(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function findUiFrame(page) {
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    for (const f of page.frames()) {
      const el = await f.$("#msg-input").catch(() => null);
      if (el) return f;
    }
  }
  return null;
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });
    const frame = await findUiFrame(page);
    if (!frame) throw new Error("TestUI frame not found");

    const userId = "TEST_SERVICE_HOURS_GUARD_001";
    const send = (msg) =>
      frame.evaluate(
        (message, uid) =>
          new Promise((resolve, reject) => {
            google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler(reject)
              .testMessage(message, uid);
          }),
        msg,
        userId,
      );
    await frame.evaluate(
      (uid) =>
        new Promise((resolve, reject) => {
          google.script.run
            .withSuccessHandler(resolve)
            .withFailureHandler(reject)
            .clearTestSession(uid);
        }),
      userId,
    );

    await send("/重啟");
    const questions = ["請問服務時間是幾點", "請問今天有營業嗎？"];

    for (const q of questions) {
      const res = await send(q);
      const text = (res.replies || []).join("\n");
      console.log(`Q: ${q}\n${text}\n`);
      assertStep(!/^🕒\s*現在是/m.test(text), "service-hours query was misrouted to current-time reply");
      assertStep(/服務\/營業時間資訊|三星台灣聯絡我們|服務中心查詢/.test(text), "missing service-hours official guidance");
      assertStep(!/\[來源:/.test(text), "service-hours routing prompt must not invent a source tag");
    }

    console.log("PASS: verify_service_hours_guard");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});
