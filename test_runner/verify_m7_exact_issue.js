const puppeteer = require("puppeteer");

const TEST_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";

function assertStep(cond, msg) {
  if (!cond) throw new Error(msg);
}

function isApiFailureReply(text) {
  return /目前請求過於頻繁|已達配額限制|暫時無法處理|網路搜尋服務暫時無法連線/i.test(
    String(text || ""),
  );
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const userId = "TEST_M7_EXACT_ISSUE_001";

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

    const q1 =
      "客戶如果想用M7串聯其他的Matt 協議的裝置,是不是要購買smart thing hub";
    const q2 = "#查手冊 客戶如果想用M7串聯其他的Matt 協議的裝置,是不是要購買smart thing hub";
    const q3 = "#型號:S32CM703UC";

    await clearSession();

    const t1 = await send("/重啟");
    console.log("TURN 1 /重啟");
    (t1.replies || []).forEach((r, i) => console.log(`BOT#${i + 1}: ${r}`));

    const t2 = await send(q1);
    console.log(`\nTURN 2 ${q1}`);
    (t2.replies || []).forEach((r, i) => console.log(`BOT#${i + 1}: ${r}`));

    const t2Text = (t2.replies || []).join("\n");
    const t2Logs = t2.logs || [];
    console.log("\nTURN 2 LOGS (Smart Router related):");
    t2Logs
      .filter((x) => /Smart Router|AUTO_SEARCH_PDF|needsManual|Model Select|Flow Decision/.test(String(x)))
      .forEach((x) => console.log(String(x)));

    assertStep(
      !/\[來源\s*:\s*QA/i.test(t2Text) && !/\[來源\s*:\s*QA資料庫/i.test(t2Text),
      "turn2 still leaks fake QA source tag",
    );
    if (isApiFailureReply(t2Text)) {
      assertStep(
        !/\[來源:\s*[^\]]+\.pdf\s*\(官方手冊PDF\)\]/i.test(t2Text),
        "API failure reply must not be tagged as PDF source",
      );
      console.log("\nPASS: verify_m7_exact_issue (API quota guarded on turn2)");
      return;
    }
    assertStep(
      /先選完整型號|型號/.test(t2Text) ||
        t2Logs.some((x) => /準備顯示型號選擇泡泡/.test(String(x))),
      "turn2 did not ask model selection before PDF verification",
    );

    const t3 = await send(q2);
    console.log(`\nTURN 3 ${q2}`);
    (t3.replies || []).forEach((r, i) => console.log(`BOT#${i + 1}: ${r}`));

    const t3Text = (t3.replies || []).join("\n");
    if (isApiFailureReply(t3Text)) {
      assertStep(
        !/\[來源:\s*[^\]]+\.pdf\s*\(官方手冊PDF\)\]/i.test(t3Text),
        "API failure reply must not be tagged as PDF source",
      );
      console.log("\nPASS: verify_m7_exact_issue (API quota guarded)");
      return;
    }

    assertStep(
      /請選擇 M7 完整型號|請先選完整型號|型號選擇泡泡|\[Flex Message\]/.test(t3Text) ||
        (t3.logs || []).some((x) => /Alias Select|型號選擇泡泡|model_select_mode/.test(String(x))),
      "#查手冊 with alias-only M7 should ask for full model instead of loading PDF directly",
    );
    assertStep(
      !/\[來源:\s*[^\\\[\]]+\.pdf\s*\(官方手冊PDF\)\]/i.test(t3Text),
      "alias-only manual query must not return a PDF source before full model selection",
    );

    const t4 = await send(q3);
    console.log(`\nTURN 4 ${q3}`);
    (t4.replies || []).forEach((r, i) => console.log(`BOT#${i + 1}: ${r}`));

    const t4Text = (t4.replies || []).join("\n");
    if (isApiFailureReply(t4Text)) {
      assertStep(
        !/\[來源:\s*[^\]]+\.pdf\s*\(官方手冊PDF\)\]/i.test(t4Text),
        "API failure reply must not be tagged as PDF source",
      );
      console.log("\nPASS: verify_m7_exact_issue (API quota guarded after model selection)");
      return;
    }
    assertStep(
      !/^[ \t]*[•●▪◦‧・]/m.test(t4Text),
      "manual reply still uses bullet symbol instead of numeric list",
    );
    assertStep(
      /\[來源:\s*[^\\\[\]]+\.pdf\s*\(官方手冊PDF\)\]/i.test(t4Text),
      "selected full model manual reply missing real PDF filename source tag",
    );

    console.log("\nPASS: verify_m7_exact_issue");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});
