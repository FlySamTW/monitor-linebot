const puppeteer = require("puppeteer");

const TEST_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertStep(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function findFrame(page) {
  for (let i = 0; i < 15; i++) {
    await sleep(1500);
    for (const frame of page.frames()) {
      const input = await frame.$("#msg-input").catch(() => null);
      if (input) {
        return frame;
      }
    }
  }
  return null;
}

async function call(frame, fnName, ...args) {
  return frame.evaluate(
    (name, params) =>
      new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          [name](...params);
      }),
    fnName,
    args,
  );
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });
    const frame = await findFrame(page);
    assertStep(frame, "TestUI frame not found");

    const userId = `TEST_UNKNOWN_MODEL_GUARD_${Date.now()}`;
    const question = "S32FD812 有耳機孔嗎？規格是什麼？";

    await call(frame, "clearTestSession", userId);
    const res = await call(frame, "testMessage", question, userId);
    const replies = Array.isArray(res && res.replies) ? res.replies : [];
    const logs = Array.isArray(res && res.logs) ? res.logs : [];
    const text = replies.join("\n\n");

    console.log(`Q: ${question}`);
    console.log(text);

    assertStep(replies.length > 0, "no reply returned");
    assertStep(/S32FD812/.test(text), "reply should name the unknown model");
    assertStep(/找不到|未登錄|確認型號/.test(text), "reply should ask to confirm the model");
    assertStep(
      /\[來源:專案型號驗證規則\]/.test(text),
      "reply should carry the project model-validation source tag",
    );
    assertStep(
      !/(有\s*3\.?5\s*mm|有耳機孔|內建.*耳機孔|OLED|IPS|VA|更新率|刷新率|解析度|HDR|Hz|毫秒)/i.test(
        text.replace(question, ""),
      ),
      "reply must not invent specs for an unknown model",
    );
    assertStep(
      logs.some((line) => /\[Unknown Model Guard v29\.5\.283\]/.test(String(line))),
      "log should show the unknown model guard, proving no LLM answer path was used",
    );
    assertStep(
      !logs.some((line) => /\[AI Stats\]|\[AI Raw Response\]/.test(String(line))),
      "unknown model guard should return before any Gemini call",
    );

    const priceUserId = `TEST_UNKNOWN_MODEL_PRICE_PRIORITY_${Date.now()}`;
    const priceQuestion = "S32FD812 現在價格多少？";
    await call(frame, "clearTestSession", priceUserId);
    const priceRes = await call(frame, "testMessage", priceQuestion, priceUserId);
    const priceReplies = Array.isArray(priceRes && priceRes.replies)
      ? priceRes.replies
      : [];
    const priceLogs = Array.isArray(priceRes && priceRes.logs) ? priceRes.logs : [];
    const priceText = priceReplies.join("\n\n");

    console.log(`Q: ${priceQuestion}`);
    console.log(priceText);

    assertStep(priceReplies.length > 0, "price-priority case returned no reply");
    assertStep(
      /samsung\.com\/tw\/search\/\?searchvalue=/i.test(priceText),
      "unknown model price question should still route to Samsung official search",
    );
    assertStep(
      !/\[來源:專案型號驗證規則\]/.test(priceText),
      "price question should not be intercepted by unknown-model validation first",
    );
    assertStep(
      priceLogs.some((line) => /\[Price Guard v29\.5\.157\]/.test(String(line))),
      "price guard should run before unknown-model validation for price questions",
    );
    assertStep(
      !priceLogs.some((line) => /\[Unknown Model Guard v29\.5\.283\]/.test(String(line))),
      "unknown-model guard should not run after price guard returns",
    );

    console.log("PASS: verify_unknown_model_guard");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
