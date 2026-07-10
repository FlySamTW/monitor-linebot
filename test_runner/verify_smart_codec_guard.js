const puppeteer = require("puppeteer");

const testSecret = process.env.LINEBOT_TEST_SECRET;
if (!testSecret) {
  throw new Error("LINEBOT_TEST_SECRET is required for formal TestUI access");
}
const TEST_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1&secret=" +
  encodeURIComponent(testSecret);
let testUiAccessToken = "";

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
    args.concat(testUiAccessToken),
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
    testUiAccessToken = await frame.evaluate(() => TEST_UI_ACCESS_TOKEN);
    if (!testUiAccessToken) throw new Error("TestUI access token missing");

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

    assertStep(/這題會跟實際型號有關/.test(firstReplies), "first answer should use natural model-selection wording before exact PDF search", firstReplies);
    assertStep(/請選擇 Smart Monitor PDF 型號/.test(firstReplies), "first answer must offer Smart Monitor PDF model choices", firstReplies);
    assertStep(!/\[來源:/.test(firstReplies) && /\[費用:NT\$0\.0000（未呼叫 LLM）\]/.test(firstReplies), "first model-selection answer must not invent a source and must include zero-cost disclosure", firstReplies);
    assertStep(!/所以可支援 HEVC|HEVC 編解碼器僅適用於 MKV|通常|Plex|Kodi/i.test(firstReplies), "first answer must not use fixed, vague, or invented playback claims", firstReplies);
    assertStep(/Smart Codec Guard v[\d.]+/.test(firstLogs) && /S32FM703/.test(firstLogs), "first answer must be routed by the Smart codec guard with selectable models", firstLogs);
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

    assertStep(/這題會跟實際型號有關/.test(manualReplies), "#查手冊 should use natural model-selection wording", manualReplies);
    assertStep(/請選擇 Smart Monitor PDF 型號/.test(manualReplies), "#查手冊 must offer Smart Monitor PDF model choices", manualReplies);
    assertStep(!/\[來源:/.test(manualReplies) && /\[費用:NT\$0\.0000（未呼叫 LLM）\]/.test(manualReplies), "#查手冊 model-selection reply must not invent a source and must include zero-cost disclosure", manualReplies);
    assertStep(/#查手冊 顯示 Smart Monitor PDF 型號選擇/.test(manualLogs), "#查手冊 must be routed to Smart Monitor model choices", manualLogs);
    assertStep(!/PDF 匹配|S27FG502/i.test(manualLogs), "#查手冊 must not enter the wrong PDF selection route", manualLogs);

    const selected = await call(frame, "testMessage", "#型號:S32FM703", userId);
    const selectedReplies = joined(selected, "replies");
    const selectedLogs = joined(selected, "logs");

    console.log("\nTURN 3 USER: #型號:S32FM703");
    console.log(`TURN 3 BOT:\n${selectedReplies}`);
    console.log("\nTURN 3 PDF LOGS:");
    selectedLogs
      .split("\n")
      .filter((line) => /Model Select|PDF 匹配|載入 PDF|S27FG502|S32FM702/i.test(line))
      .forEach((line) => console.log(line));

    assertStep(/Model Select v29\.5\.120/.test(selectedLogs), "selected model must enter the existing PDF model-selection route", selectedLogs);
    assertStep(/支援的視訊編解碼器/.test(selectedLogs) && /S32FM703.*HEVC\/H\.265/.test(selectedLogs), "selected model query must target the official codec table", selectedLogs);
    assertStep(/PDF 匹配:\s*[1-9]/.test(selectedLogs), "selected model must match at least one PDF", selectedLogs);
    assertStep(!/S27FG502|S27FG900XC|G90XF/i.test(selectedLogs), "selected Smart Monitor model must not load or expand to Odyssey/G-series PDF candidates", selectedLogs);
    assertStep(
      /\[來源:官方手冊\]/.test(selectedReplies) && /S32FM703.*\.pdf/.test(selectedLogs),
      "selected model PDF answer must show official-manual source and log the S32FM703 Smart Monitor manual",
      selectedReplies + "\n---LOGS---\n" + selectedLogs,
    );
    assertStep(
      (/支援[\s\S]{0,120}(HEVC|H\.265|H265)|(HEVC|H\.265|H265)[\s\S]{0,120}(有被列出|支援)/i.test(selectedReplies)) &&
        !/(不支援|無法支援|不可以播放)/.test(selectedReplies),
      "selected model PDF answer must answer the HEVC support result from the manual",
      selectedReplies,
    );
    assertStep(!/通常|常見|應該/.test(selectedReplies), "selected model PDF answer must not speculate beyond the manual", selectedReplies);
    assertStep(/\[費用\s*[:：]\s*(?:NT\$[^\]]+|未知（已呼叫 LLM）)\]/.test(selectedReplies), "selected model PDF answer must include bracketed cost disclosure", selectedReplies);

    const elaborated = await call(frame, "testMessage", "#再詳細說明", userId);
    const elaboratedReplies = joined(elaborated, "replies");
    const elaboratedLogs = joined(elaborated, "logs");
    console.log("\nTURN 4 USER: #再詳細說明");
    console.log(`TURN 4 BOT:\n${elaboratedReplies}`);
    assertStep(/\[來源:官方手冊\]/.test(elaboratedReplies), "manual elaboration must retain the official-manual source", elaboratedReplies);
    assertStep(/\[費用:NT\$(?!0\.0000)|\[費用:未知（已呼叫 LLM）\]/.test(elaboratedReplies), "manual elaboration must disclose a real LLM cost", elaboratedReplies);
    assertStep(/AttachPDFs:\s*true/.test(elaboratedLogs) && /\[Manual Elaboration\].*呼叫 LLM/.test(elaboratedLogs), "manual elaboration must reattach PDF and call the LLM", elaboratedLogs);
    assertStep(
      selectedReplies.replace(/\[費用:[^\]]+\]/g, "").trim() !== elaboratedReplies.replace(/\[費用:[^\]]+\]/g, "").trim(),
      "manual elaboration must not repeat the previous answer verbatim",
      elaboratedReplies,
    );

    console.log("\nPASS: verify_smart_codec_guard");
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
