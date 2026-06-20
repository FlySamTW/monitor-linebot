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

    const userId = "TEST_QA_DRAFT_FORMAT_GUARD_001";
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

    await send("/重啟");

    const uniqueId = "ZTEST_QA_FORMAT_GUARD_20260620";
    const t2 = await send(
      `/紀錄 ${uniqueId} 可以正常建立 QA 草稿嗎？ A：可以，這是格式守門測試。`,
    );
    const t2Text = (t2.replies || []).join("\n");
    console.log("TURN 2", t2Text);
    assertStep(/已進入建檔模式|找到相似的現有 QA/.test(t2Text), "did not enter QA draft mode");
    assertStep(!/\/\s*A：\s*A[:：]/i.test(t2Text), "draft duplicated A marker");
    assertStep(
      new RegExp(`${uniqueId}.*可以正常建立 QA 草稿嗎[？?]\\s*/\\s*A：可以`).test(t2Text),
      "draft did not preserve one-line QA format",
    );

    const t3 = await send("2");
    const t3Text = (t3.replies || []).join("\n");
    console.log("TURN 3", t3Text);
    if (!/找到相似的現有 QA/.test(t2Text)) {
      assertStep(
        /目前這份草稿沒有等待 1\/2\/3 選項/.test(t3Text),
        "standalone 2 should be rejected when no merge choice is pending",
      );
      assertStep(!/用戶補充：2/.test(t3Text), "standalone 2 polluted draft content");
    }

    const t4 = await send("我想吃蘋果");
    const t4Text = (t4.replies || []).join("\n");
    console.log("TURN 4", t4Text);
    assertStep(
      /不像是在修改目前這筆 QA|避免污染資料庫/.test(t4Text),
      "irrelevant draft feedback should be rejected",
    );
    assertStep(!/用戶補充：我想吃蘋果/.test(t4Text), "irrelevant feedback polluted draft content");

    await send("/取消");
    console.log("PASS: verify_qa_draft_format_guard");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});
