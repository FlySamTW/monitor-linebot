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
  const userId = "TEST_S9_KVM_ALIAS_001";

  try {
    await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 90000 });
    await new Promise((r) => setTimeout(r, 4000));

    let frame = null;
    for (const f of page.frames()) {
      const el = await f.$("#msg-input").catch(() => null);
      if (el) {
        frame = f;
        break;
      }
    }
    if (!frame) throw new Error("TestUI frame not found");

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
    const res = await send("s9有內建kvm嗎");
    const text = (res.replies || []).join("\n");
    console.log(text);

    assertStep(
      /型號選擇泡泡|完整型號|請先選/.test(text),
      "S9 alias KVM question should ask for exact model before answering",
    );
    assertStep(
      !/S9[^\n。！]*內建\s*KVM|支援內建\s*KVM|是支援內建\s*KVM/i.test(text),
      "S9 alias KVM question must not assert KVM support before exact model",
    );
    assertStep(
      !/\[來源:\s*規格庫\]/i.test(text) || /完整型號|請先選|型號選擇/.test(text),
      "source tag must not make an unsupported KVM claim look verified",
    );

    console.log("\nPASS: verify_s9_kvm_alias_guard");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});
