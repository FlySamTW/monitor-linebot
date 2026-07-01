const puppeteer = require("puppeteer");

const TEST_URL = "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));

  try {
    console.log(`Navigating to ${TEST_URL}`);
    await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });

    console.log("Waiting for UI Frame to spawn...");
    let frame = null;
    for (let i = 0; i < 10; i++) {
      await sleep(2000);
      for (const f of page.frames()) {
        try {
          const el = await f.$("#msg-input");
          if (el) {
            frame = f;
            break;
          }
        } catch (_) {}
      }
      if (frame) break;
    }

    if (!frame) {
      throw new Error("UI frame not found.");
    }
    console.log("UI Frame found.");

    const userId = "TEST_CURVE_VERIFY_" + Date.now();

    // Turn 1: Reboot
    console.log("Rebooting conversation...");
    await frame.evaluate(
      (uid) =>
        new Promise((resolve, reject) => {
          google.script.run
            .withSuccessHandler((res) => resolve(res))
            .withFailureHandler((err) => reject(err))
            .testMessage("/重啟", uid);
        }),
      userId,
    );
    await sleep(2000);

    // Turn 2: Query c34g55t wall mount
    const q1 = "c34g55t可以直接壁掛還是要轉接環";
    console.log(`Sending Turn 2 query: "${q1}"`);
    const res1 = await frame.evaluate(
      (m, uid) =>
        new Promise((resolve, reject) => {
          google.script.run
            .withSuccessHandler((res) => resolve(res))
            .withFailureHandler((err) => reject(err))
            .testMessage(m, uid);
        }),
      q1,
      userId,
    );

    console.log("\n--- Turn 2 Response ---");
    res1.replies.forEach((r, idx) => console.log(`BOT#${idx+1}: ${r}`));
    console.log("\n--- Turn 2 Server Logs ---");
    res1.logs.forEach(l => console.log(String(l)));

    await sleep(2000);

    // Turn 3: Ask for manual (#查手冊)
    const q2 = "#查手冊";
    console.log(`\nSending Turn 3 query: "${q2}"`);
    const res2 = await frame.evaluate(
      (m, uid) =>
        new Promise((resolve, reject) => {
          google.script.run
            .withSuccessHandler((res) => resolve(res))
            .withFailureHandler((err) => reject(err))
            .testMessage(m, uid);
        }),
      q2,
      userId,
    );

    console.log("\n--- Turn 3 Response ---");
    res2.replies.forEach((r, idx) => console.log(`BOT#${idx+1}: ${r}`));
    console.log("\n--- Turn 3 Server Logs ---");
    res2.logs.forEach(l => console.log(String(l)));

  } catch (e) {
    console.error("Verification failed:", e);
  } finally {
    await browser.close();
  }
}

run();
