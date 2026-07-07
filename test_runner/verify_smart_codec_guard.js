const puppeteer = require("puppeteer");

const TEST_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findFrame(page) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const input = await frame.$("#msg-input").catch(() => null);
      if (input) return frame;
    }
    await sleep(1000);
  }
  return null;
}

async function call(frame, fnName, ...args) {
  return frame.evaluate(
    (f, a) =>
      new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          [f](...a);
      }),
    fnName,
    args,
  );
}

function joined(res, key) {
  const arr = Array.isArray(res && res[key]) ? res[key] : [];
  return arr.map((x) => String(x || "")).join("\n");
}

function assertStep(condition, message, details = "") {
  if (!condition) {
    throw new Error(`${message}${details ? `\n${details}` : ""}`);
  }
}

async function run() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });
    const frame = await findFrame(page);
    if (!frame) throw new Error("TestUI frame not found");

    const userId = `TEST_SMART_CODEC_${Date.now()}`;
    await call(frame, "clearTestSession", userId);

    const question = "Smart系列播放檔案有沒有支援hevc格式";
    const first = await call(frame, "testMessage", question, userId);
    const firstReplies = joined(first, "replies");
    const firstLogs = joined(first, "logs");

    console.log(`TURN 1 USER: ${question}`);
    console.log(`TURN 1 BOT:\n${firstReplies}`);
    console.log("\nTURN 1 GUARD LOGS:");
    firstLogs
      .split("\n")
      .filter((line) => /Smart Codec Guard|AI Raw Response|PDF 匹配|S27FG502/i.test(line))
      .forEach((line) => console.log(line));

    assertStep(/HEVC/.test(firstReplies), "first answer must mention HEVC", firstReplies);
    assertStep(/MKV/.test(firstReplies) && /MP4/.test(firstReplies) && /TS/.test(firstReplies), "first answer must mention HEVC file-type limits", firstReplies);
    assertStep(/S32FM702,S32FM703,S32FM803\.pdf/.test(firstReplies), "first answer must cite the Smart Monitor manual files", firstReplies);
    assertStep(!/通常|Plex|Kodi/i.test(firstReplies), "first answer must not use vague or invented playback claims", firstReplies);
    assertStep(/Smart Codec Guard v29\.6\.048/.test(firstLogs), "first answer must be routed by the Smart codec guard", firstLogs);
    assertStep(!/AI Raw Response|PDF 匹配|S27FG502/i.test(firstLogs), "first answer must not call the LLM or wrong Odyssey PDF route", firstLogs);

    const manual = await call(frame, "testMessage", "#查手冊", userId);
    const manualReplies = joined(manual, "replies");
    const manualLogs = joined(manual, "logs");

    console.log("\nTURN 2 USER: #查手冊");
    console.log(`TURN 2 BOT:\n${manualReplies}`);
    console.log("\nTURN 2 GUARD LOGS:");
    manualLogs
      .split("\n")
      .filter((line) => /Smart Codec Guard|AI Raw Response|PDF 匹配|S27FG502/i.test(line))
      .forEach((line) => console.log(line));

    assertStep(/HEVC/.test(manualReplies), "manual answer must mention HEVC", manualReplies);
    assertStep(/S32FM702,S32FM703,S32FM803\.pdf/.test(manualReplies), "manual answer must cite the Smart Monitor manual files", manualReplies);
    assertStep(/#查手冊 改用 Smart Monitor 官方手冊固定回覆/.test(manualLogs), "#查手冊 must be routed by the Smart codec guard", manualLogs);
    assertStep(!/PDF 匹配|S27FG502/i.test(manualLogs), "#查手冊 must not enter the wrong PDF selection route", manualLogs);

    console.log("\nPASS: verify_smart_codec_guard");
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
