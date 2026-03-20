const puppeteer = require("puppeteer");

const TEST_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";

function assertStep(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const userId = "TEST_LONG_ARTICLE_QA_MODE_001";

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

    const longArticle = [
      "來源：https://example.com/tech/m7-matter",
      "更新時間：2026-03-20",
      "廣告：立即訂閱獲得折扣，更多活動請點此。",
      "本文討論三星 Smart Monitor M7 與 SmartThings 及 Matter 生態整合。",
      "很多客服會遇到同一題：客戶如果想用 M7 串聯 Matter 協議裝置，是不是一定要購買 SmartThings Hub？",
      "也有人追問操作流程，例如要去哪裡開啟設定、是否需要額外接收器、以及如何確認型號支援清單。",
      "延伸閱讀：如何用 M8 與 Odyssey 系列做智慧家庭控制。",
      "以上內容常混雜促銷與導購文案，讀者不容易直接抓到可用重點。",
    ].join("\n");

    await clearSession();

    const t1 = await send("/重啟");
    console.log("TURN 1 /重啟");
    (t1.replies || []).forEach((r, i) => console.log(`BOT#${i + 1}: ${r}`));

    const t2 = await send(longArticle);
    console.log("\nTURN 2 長文輸入");
    (t2.replies || []).forEach((r, i) => console.log(`BOT#${i + 1}: ${r}`));
    const t2Text = (t2.replies || []).join("\n");

    assertStep(t2Text.includes("【重點摘要】"), "turn2 missing summary section");
    assertStep(
      t2Text.includes("【去廣告原文】"),
      "turn2 missing cleaned-original section",
    );
    assertStep(
      /要不要進入 QA 編輯模式/.test(t2Text),
      "turn2 missing QA mode offer",
    );
    assertStep(
      /【QA編輯模式操作方式】/.test(t2Text),
      "turn2 missing QA mode instruction block",
    );
    assertStep(
      /\/記錄 <內容>|\/紀錄 <內容>/.test(t2Text),
      "turn2 missing /記錄 command instructions",
    );

    const t3 = await send("要");
    console.log("\nTURN 3 要");
    (t3.replies || []).forEach((r, i) => console.log(`BOT#${i + 1}: ${r}`));
    const t3Text = (t3.replies || []).join("\n");
    assertStep(
      /已進入建檔模式|找到相似的現有 QA/.test(t3Text),
      "turn3 did not enter QA draft mode",
    );

    const t4 = await send(
      "這是一段很長很長的草稿修正內容，包含 SmartThings、Matter、M7、設定步驟、接收器與支援條件，請把語句改得更好讀，並保留可驗證的重點。",
    );
    console.log("\nTURN 4 草稿修正");
    (t4.replies || []).forEach((r, i) => console.log(`BOT#${i + 1}: ${r}`));
    const t4Text = (t4.replies || []).join("\n");
    const t4Logs = t4.logs || [];

    assertStep(
      !/【重點摘要】/.test(t4Text),
      "turn4 wrongly intercepted by ArticleClean",
    );
    assertStep(
      t4Logs.some((x) => /\[DraftMod\]/.test(String(x))),
      "turn4 did not run draft modification flow",
    );

    const t5 = await send("/取消");
    console.log("\nTURN 5 /取消");
    (t5.replies || []).forEach((r, i) => console.log(`BOT#${i + 1}: ${r}`));
    const t5Text = (t5.replies || []).join("\n");
    assertStep(/已取消建檔/.test(t5Text), "turn5 failed to leave draft mode");

    console.log("\nPASS: verify_long_article_qa_mode");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});
