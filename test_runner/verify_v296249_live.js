const puppeteer = require("puppeteer");
const { openAuthorizedTestUi } = require("./testui_auth");

const VERSION = "v29.6.254";

function assertStep(condition, message, details = "") {
  if (!condition) {
    throw new Error(`${message}${details ? `\n${details}` : ""}`);
  }
}

function normalize(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

async function sendThroughUi(frame, question) {
  const beforeBotCount = await frame.$$eval(
    ".msg-row.bot .msg-bubble",
    (items) => items.length,
  );
  const startedAt = Date.now();

  await frame.focus("#msg-input");
  await frame.type("#msg-input", question);
  await frame.click("#send-btn");

  await new Promise((resolve) => setTimeout(resolve, 800));
  const costModalVisible = await frame.$eval(
    "#cost-modal",
    (el) => getComputedStyle(el).display !== "none",
  );
  if (costModalVisible) {
    await frame.click("#cost-modal .btn-agree");
  }

  await frame.waitForFunction(
    (expectedQuestion, previousBotCount) => {
      const userTexts = Array.from(
        document.querySelectorAll(".msg-row.user .msg-bubble"),
      ).map((el) => el.textContent || "");
      const botTexts = Array.from(
        document.querySelectorAll(".msg-row.bot .msg-bubble"),
      ).map((el) => el.textContent || "");
      return (
        userTexts.includes(expectedQuestion) &&
        botTexts.length > previousBotCount &&
        !botTexts.includes("Reading...") &&
        !window.isBotProcessing
      );
    },
    { timeout: 120000 },
    question,
    beforeBotCount,
  );

  const result = await frame.evaluate((previousBotCount) => {
    const botRows = Array.from(
      document.querySelectorAll(".msg-row.bot"),
    ).slice(previousBotCount);
    const replies = botRows
      .map((row) => row.querySelector(".msg-bubble")?.textContent || "")
      .filter(Boolean);
    const quickReplies = Array.from(
      botRows.at(-1)?.querySelectorAll(".quick-reply-btn") || [],
    ).map((el) => el.textContent || "");
    const logs = Array.from(document.querySelectorAll("#log-box .log-line"))
      .map((el) => el.getAttribute("title") || el.textContent || "")
      .filter(Boolean);
    return { replies, quickReplies, logs };
  }, beforeBotCount);

  return {
    question,
    durationMs: Date.now() - startedAt,
    costModalVisible,
    ...result,
  };
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    const frame = await openAuthorizedTestUi(page, { timeout: 90000 });
    const badge = await frame.$eval(
      "#mock-badge",
      (el) => getComputedStyle(el).display,
    );
    assertStep(badge === "none", "正式 TestUI 誤入 MOCK 模式");

    let exactRule = null;
    if (process.env.LIVE_ONLY_MIXED !== "1") {
      exactRule = await sendThroughUi(
        frame,
        "S32FM703UC 有幾個 HDMI 連接埠？",
      );
      const exactReply = normalize(exactRule.replies.join("\n"));
      const exactLogs = exactRule.logs.join("\n");
      assertStep(/HDMI/i.test(exactReply) && /2|兩/.test(exactReply), "零成本規格題沒有直接回答 HDMI 數量", exactReply);
      assertStep(!/AttachPDFs\s*[:=]\s*true|google_search|pdfCalls\"?:1|webCalls\"?:1/i.test(exactLogs), "零成本規格題誤用 PDF／Web", exactLogs);
      assertStep(!/模型|token|程式|路由|CLASS_RULES|QA資料庫/i.test(exactReply), "規格回答外洩內部運作", exactReply);
    }

    const mixed = await sendThroughUi(
      frame,
      "S32FM501EC 怎麼連接？有幾個 HDMI？",
    );
    const mixedReply = normalize(mixed.replies.join("\n"));
    const mixedLogs = mixed.logs.join("\n");
    assertStep(/HDMI/i.test(mixedReply) && /2|兩/.test(mixedReply), "混合題遺失已知 HDMI 規格", mixedReply);
    const hdmiQuantityMentions =
      mixedReply.match(/(?:2\s*個|兩個|二個)\s*HDMI/gi) || [];
    assertStep(
      hdmiQuantityMentions.length === 1,
      "RULE 與手冊把同一個 HDMI 數量重複回答",
      mixedReply,
    );
    assertStep(!/請.*完整型號|型號是什麼|重新.*型號/i.test(mixedReply), "混合題已給完整型號卻重問型號", mixedReply);
    assertStep(!/模型|token|程式|路由|CLASS_RULES|QA資料庫/i.test(mixedReply), "混合題外洩內部運作", mixedReply);
    assertStep(
      /資料來源：三星官方規格、三星官方手冊（第[^\n]*頁）/.test(mixedReply),
      "RULE／PDF 沒有收斂成單一自然來源頁尾",
      mixedReply,
    );
    assertStep(/AttachPDFs\s*[:=]\s*true|pdfCalls\"?:1|官方手冊/i.test(`${mixedLogs}\n${mixedReply}`), "混合操作題沒有手冊證據", `${mixedReply}\n${mixedLogs}`);

    const manualFreePrechecks = mixed.logs.filter((line) =>
      /Manual Free Precheck v29\.6\.147/.test(line),
    );
    assertStep(
      manualFreePrechecks.length === 1,
      `同一手冊題免費 QA／RULE 預檢應只跑一次，實際為 ${manualFreePrechecks.length} 次`,
      manualFreePrechecks.join("\n"),
    );

    const compact = [exactRule, mixed].filter(Boolean).map((item) => ({
      question: item.question,
      durationMs: item.durationMs,
      costModalVisible: item.costModalVisible,
      reply: normalize(item.replies.join("\n")),
      quickReplies: item.quickReplies,
      audit: item.logs.filter((line) =>
        /Request Audit|AttachPDFs|Stats|Exact Rule|Deterministic|Manual Free Precheck|PDF/i.test(line),
      ),
    }));
    console.log(JSON.stringify({ version: VERSION, tests: compact }, null, 2));
    console.log(
      exactRule
        ? `PASS: ${VERSION} 正式 TestUI 真人規格題與混合手冊題`
        : `PASS: ${VERSION} 正式 TestUI 真人混合手冊題`,
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
