const puppeteer = require("puppeteer");

const TEST_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function findFrame(page) {
  await sleep(5000);
  for (const f of page.frames()) {
    const el = await f.$("#msg-input").catch(() => null);
    if (el) return f;
  }
  return null;
}

async function call(frame, fnName, ...args) {
  return frame.evaluate(
    (f, a) =>
      new Promise((resolve, reject) => {
        try {
          google.script.run
            .withSuccessHandler(resolve)
            .withFailureHandler(reject)
            [f](...a);
        } catch (e) {
          reject(e);
        }
      }),
    fnName,
    args,
  );
}

function hasMoneyNumber(text) {
  const t = String(text || "");
  const patterns = [
    /NT\$\s*\d+/i,
    /\$\s*\d+/,
    /\d+\s*元/,
    /\d{1,3}(,\d{3}){1,2}(?:\.\d+)?/,
  ];
  return patterns.some((p) => p.test(t));
}

async function run() {
  const cases = [
    "請協助尋找M9、G8、M8、S34BG850SC3的市場最低價與建議售價。",
    "G8現在價格多少？",
    "M7 43吋目前售價是多少？",
  ];

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });
  const frame = await findFrame(page);
  if (!frame) throw new Error("TestUI frame not found");

  let allPass = true;
  for (let i = 0; i < cases.length; i++) {
    const msg = cases[i];
    const userId = `TEST_PRICE_GUARD_${Date.now()}_${i}`;

    await call(frame, "clearTestSession", userId);
    const res = await call(frame, "testMessage", msg, userId);

    const replies = Array.isArray(res && res.replies) ? res.replies : [];
    const logs = Array.isArray(res && res.logs) ? res.logs : [];
    const text = replies.join("\n\n");

    const hasReply = replies.length > 0;
    const hasLink = /https:\/\/www\.samsung\.com\/tw\/search\/\?searchvalue=/i.test(text);
    const noMoney = !hasMoneyNumber(text);
    const guardLogged = logs.some((l) => /\[Price Guard v29\.5\.157\]/.test(String(l)));

    const pass = hasReply && hasLink && noMoney && guardLogged;
    if (!pass) allPass = false;

    console.log("\n====================================");
    console.log(`CASE ${i + 1} | ${pass ? "PASS" : "FAIL"}`);
    console.log(`Q: ${msg}`);
    console.log(`hasReply=${hasReply}, hasLink=${hasLink}, noMoney=${noMoney}, guardLogged=${guardLogged}`);
    console.log(`Reply#1: ${(replies[0] || "").slice(0, 300)}`);

    if (!pass) {
      console.log("Last logs:");
      logs.slice(-20).forEach((l) => console.log(String(l)));
    }

    await sleep(1200);
  }

  await browser.close();

  console.log("\n====================================");
  console.log(allPass ? "TOTAL: PASS" : "TOTAL: FAIL");
  console.log("====================================");

  if (!allPass) {
    process.exitCode = 1;
  }
}

run().catch((e) => {
  console.error("TEST ERROR:", e);
  process.exit(1);
});