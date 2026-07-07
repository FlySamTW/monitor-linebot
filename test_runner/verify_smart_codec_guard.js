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

    assertStep(/不能只用 Smart\/Tizen 規格或共通摘要直接定論/.test(firstReplies), "first answer must not provide a fixed codec answer before exact PDF search", firstReplies);
    assertStep(/請選擇 Smart Monitor PDF 型號/.test(firstReplies), "first answer must offer Smart Monitor PDF model choices", firstReplies);
    assertStep(/\[來源:專案流程規則\]/.test(firstReplies) && /\[費用:NT\$0\.0000（未呼叫 LLM）\]/.test(firstReplies), "first answer must include source and zero-cost disclosure", firstReplies);
    assertStep(!/所以可支援 HEVC|HEVC 編解碼器僅適用於 MKV|通常|Plex|Kodi/i.test(firstReplies), "first answer must not use fixed, vague, or invented playback claims", firstReplies);
    assertStep(/Smart Codec Guard v29\.6\.054/.test(firstLogs) && /S32FM703/.test(firstLogs), "first answer must be routed by the Smart codec guard with selectable models", firstLogs);
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

    assertStep(/不能只用 Smart\/Tizen 規格或共通摘要直接定論/.test(manualReplies), "#查手冊 should explain why exact PDF search is required", manualReplies);
    assertStep(/請選擇 Smart Monitor PDF 型號/.test(manualReplies), "#查手冊 must offer Smart Monitor PDF model choices", manualReplies);
    assertStep(/\[來源:專案流程規則\]/.test(manualReplies) && /\[費用:NT\$0\.0000（未呼叫 LLM）\]/.test(manualReplies), "#查手冊 model-selection reply must include source and zero-cost disclosure", manualReplies);
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
      /S32FM703.*\.pdf/.test(selectedReplies + "\n" + selectedLogs),
      "selected model PDF answer must use the S32FM703 Smart Monitor manual",
      selectedReplies + "\n---LOGS---\n" + selectedLogs,
    );
    assertStep(/支援.*HEVC|HEVC.*支援|H\.265/.test(selectedReplies) && !/未明確記載|未記載/.test(selectedReplies), "selected model PDF answer must answer the HEVC support result from the manual", selectedReplies);
    assertStep(!/通常|常見|應該/.test(selectedReplies), "selected model PDF answer must not speculate beyond the manual", selectedReplies);
    assertStep(/本次對話預估花費|本次.*費用|NT\$[0-9]+\.[0-9]{4}/.test(selectedReplies), "selected model PDF answer must include cost disclosure", selectedReplies);

    console.log("\nPASS: verify_smart_codec_guard");
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
