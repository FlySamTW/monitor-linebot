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

  const userId = "TEST_JULY16_FIXES";
  console.log("Clearing session...");
  await clearTestSession(frame, userId);

  // Test 1: Record command
  const query1 = "/紀錄 iPhone 17 Air版,本身就不支援Type-c 影像輸出,因此無法使用type c連結我們Smart螢幕顯示。如果是iPhone 非Air版,那是有支援的。";
  console.log(`\n--- Test 1: Sending Record Query ---`);
  console.log(`Query: "${query1}"`);
  const res1 = await callTestMessage(frame, query1, userId);
  const replies1 = Array.isArray(res1 && res1.replies) ? res1.replies : [];
  replies1.forEach((r, idx) => {
    console.log(`BOT#${idx + 1}: ${r}`);
  });

  // Test 2: M7 short alias selector
  console.log("Clearing session again...");
  await clearTestSession(frame, userId);
  
  const query2 = "M7可以用iPhone 17透過USB-C連接並充電嗎?";
  console.log(`\n--- Test 2: Sending M7 Alias Query ---`);
  console.log(`Query: "${query2}"`);
  const res2 = await callTestMessage(frame, query2, userId);
  const replies2 = Array.isArray(res2 && res2.replies) ? res2.replies : [];
  replies2.forEach((r, idx) => {
    console.log(`BOT#${idx + 1}: ${r}`);
  });
  
  console.log("\n--- Server Logs from Turn 2 ---");
  const logs = Array.isArray(res2 && res2.logs) ? res2.logs : [];
  logs.slice(-30).forEach(l => {
    console.log(String(l).replace(/\r\n/g, "\n"));
  });

  await browser.close();
})();
