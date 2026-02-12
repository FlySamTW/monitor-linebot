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
  const userId = "TEST_WEB_QR_PERSIST_001";

  const turns = [
    "/重啟",
    "我的3d螢幕該如何開啟Odyssey hub",
    "#這題再搜網路",
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

    assertStep(
      hasPattern(t3.logs, /Quick Reply v29\.5\.137.*這題再搜網路/),
      "Step1 failed: 新指令 #這題再搜網路 未正確攔截。",
    );

    assertStep(
      hasPattern(t3.logs, /這題再搜網路回合泡泡數:\s*3/) ||
        hasPattern(t3.logs, /\[Reply\] 使用顯式 Quick Reply:\s*3\s*個選項/),
      "Step2 failed: 網路搜尋後未保留 3 個泡泡（再詳細/查手冊/再搜網路）。",
    );

    assertStep(
      hasPattern(t3.logs, /Context Repair.*還原查詢:.*Odyssey|Context Repair.*Combined Query Sent to AI:.*Odyssey/i),
      "Step3 failed: #這題再搜網路 未保留當前題目脈絡。",
    );

    console.log("\nPASS: verify_web_qr_persistence");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});
