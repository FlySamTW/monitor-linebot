const puppeteer = require("puppeteer");

const TEST_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function findUiFrame(page) {
  const inputSelector = "#msg-input";
  console.log("Waiting for UI Frame to spawn...");
  for (let i = 0; i < 10; i++) {
    await sleep(2000);
    for (const f of page.frames()) {
      try {
        const el = await f.$(inputSelector);
        if (el) return f;
      } catch (_) {}
    }
  }
  return null;
}

async function callTestMessage(frame, msg, userId) {
  return frame.evaluate(
    (m, uid) =>
      new Promise((resolve, reject) => {
        try {
          if (!window.google || !google.script || !google.script.run) {
            reject(new Error("google.script.run not available"));
            return;
          }
          google.script.run
            .withSuccessHandler((res) => resolve(res))
            .withFailureHandler((err) => reject(err))
            .testMessage(m, uid);
        } catch (e) {
          reject(e);
        }
      }),
    msg,
    userId,
  );
}

async function clearTestSession(frame, userId) {
  return frame.evaluate(
    (uid) =>
      new Promise((resolve, reject) => {
        try {
          google.script.run
            .withSuccessHandler((res) => resolve(res))
            .withFailureHandler((err) => reject(err))
            .clearTestSession(uid);
        } catch (e) {
          reject(e);
        }
      }),
    userId,
  );
}

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("Navigating to " + TEST_URL);
  await page.goto(TEST_URL, { waitUntil: "networkidle2" });

  const frame = await findUiFrame(page);
  if (!frame) {
    console.error("❌ UI Frame not found!");
    await browser.close();
    return;
  }
  console.log("✅ UI Frame found.");

  const userId = "TEST_S49DG932_PBP";
  console.log("Clearing session...");
  await clearTestSession(frame, userId);

  const query1 = "s49dg932 這台我們要用二個播放器HDMI 輸入,要開啟PBP 詳細步驟寫給我好嗎";
  console.log(`Sending Turn 1 query: "${query1}"`);
  const res1 = await callTestMessage(frame, query1, userId);
  console.log("Turn 1 Response received.");
  
  const query2 = "#查手冊";
  console.log(`Sending Turn 2 query: "${query2}"`);
  const res2 = await callTestMessage(frame, query2, userId);
  
  console.log("\n--- Turn 2 Bot Response ---");
  const replies = Array.isArray(res2 && res2.replies) ? res2.replies : [];
  replies.forEach((r, idx) => {
    console.log(`BOT#${idx + 1}: ${r}`);
  });
  
  console.log("\n--- Turn 2 Server Logs ---");
  const logs = Array.isArray(res2 && res2.logs) ? res2.logs : [];
  logs.forEach(l => {
    console.log(String(l).replace(/\r\n/g, "\n"));
  });

  await browser.close();
})();
