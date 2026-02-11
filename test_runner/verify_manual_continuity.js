const puppeteer = require("puppeteer");

function hasPattern(lines, regex) {
  return lines.some((l) => regex.test(String(l)));
}

function assertStep(ok, message) {
  if (!ok) {
    throw new Error(message);
  }
}

async function main() {
  const TEST_URL =
    "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";
  const userId = "TEST_MANUAL_CONTINUITY_001";

  const turns = [
    "/重啟",
    "我的3d螢幕該如何開啟Odyssey hub",
    "我想找手冊上的答案",
    "剛剛那台",
    "Odyssey 3d",
    "#查手冊 S27FG900XC 開啟 Odyssey Hub",
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

    const t2 = all[1];
    const t3 = all[2];
    const t4 = all[3];
    const t5 = all[4];
    const t6 = all[5];

    assertStep(
      !hasPattern(t3.logs, /找不到相關 PDF 手冊檔案/) &&
        !hasPattern(t3.replies, /找不到相關 PDF 手冊檔案/),
      "Step3 failed: '我想找手冊上的答案' 仍掉到找不到 PDF。",
    );

    assertStep(
      !hasPattern(t4.logs, /找不到相關 PDF 手冊檔案/) &&
        !hasPattern(t4.replies, /找不到相關 PDF 手冊檔案/),
      "Step4 failed: '剛剛那台' 未延續上下文。",
    );

    assertStep(
      !hasPattern(t5.logs, /找不到相關 PDF 手冊檔案/) &&
        !hasPattern(t5.replies, /找不到相關 PDF 手冊檔案/),
      "Step5 failed: Odyssey 3D alias 仍誤判。",
    );

    assertStep(
      hasPattern(t6.logs, /Quick Reply v29\.5\.120.*查手冊/) &&
        (hasPattern(t6.replies, /來源[:：].*手冊/) ||
          hasPattern(t6.logs, /\[來源: .*手冊\]/)),
      "Step6 failed: #查手冊 <內容> 沒有走手冊答案。",
    );

    console.log("\nPASS: verify_manual_continuity");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});

