const puppeteer = require("puppeteer");

const TEST_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";

function assertStep(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function getTestFrame(page) {
  await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 4000));
  for (const f of page.frames()) {
    const el = await f.$("#msg-input").catch(() => null);
    if (el) return f;
  }
  throw new Error("TestUI frame not found");
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const userId = "TEST_M7_MUTE_001";

  try {
    const frame = await getTestFrame(page);
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
    const clear = () =>
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

    await clear();

    const reset = await send("/重啟");
    const resetReplies = reset.replies || [];
    console.log("TURN 1 /重啟");
    resetReplies.forEach((r, i) => console.log(`BOT#${i + 1}: ${r}`));
    assertStep(resetReplies.length === 1, "/重啟 should produce one TestUI reply");
    assertStep(/系統版本：v29\.5\.259/.test(resetReplies[0]), "reset did not show v29.5.259");

    const noModel = await send("沒有遙控器怎麼關聲音");
    const noModelText = (noModel.replies || []).join("\n");
    console.log("\nTURN 2 沒有遙控器怎麼關聲音");
    console.log(noModelText);
    assertStep(/完整型號/.test(noModelText), "no-model operation question should ask for full model");
    assertStep(!/目前請求過於頻繁|已達配額限制/.test(noModelText), "no-model operation question leaked API quota reply");
    assertStep(
      !(noModel.logs || []).some((line) => /使用顯式 Quick Reply:\s*3 個選項/.test(String(line))),
      "no-model operation question should not show manual quick reply before a PDF-backed model is known",
    );

    const aliasModel = await send("M7沒有遙控器 把聲音關掉");
    const aliasText = (aliasModel.replies || []).join("\n");
    console.log("\nTURN 3 M7沒有遙控器 把聲音關掉");
    console.log(aliasText);
    assertStep(/型號選擇泡泡|完整型號/.test(aliasText), "M7 operation question should request exact model selection");

    console.log("\nPASS: verify_m7_mute_current");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});
