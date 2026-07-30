const puppeteer = require("puppeteer");
const { openAuthorizedTestUi } = require("./testui_auth");

const VERSION = "v29.6.094";
const RUN_ID = Date.now();
const PDF_LOG_RE = /AttachPDFs\s*[:=]\s*true|PDF 匹配:\s*[1-9]|掛載(?:了)?\s*[1-9].*PDF/i;
const WEB_LOG_RE = /Official Page Fetch|Google Search|Grounding.*(?:搜尋|Query)|網路搜尋已啟動/i;
const API_FAILURE_RE = /API_GUARDED|系統(?:暫時)?忙碌|暫時無法處理|已達配額|連線逾時|沒有取得可核對的/i;

function assertStep(condition, message, details = "") {
  if (!condition) throw new Error(`${message}${details ? `\n${details}` : ""}`);
}

function joined(result, key) {
  return (Array.isArray(result && result[key]) ? result[key] : [])
    .map((item) => String(item || ""))
    .join("\n");
}

function assertCustomerClean(label, result) {
  const reply = joined(result, "replies");
  assertStep(reply.trim(), `${label} 沒有客戶回覆`);
  assertStep(
    !/您|\[費用|\bIn:\s*\d+|\[AUTO_|\[來源|QA庫|QA資料庫|CLASS_RULES|規格庫/.test(reply),
    `${label} 外洩內部資訊或敬語`,
    reply,
  );
  assertStep(
    !/(?:。|！|？)\n\n[^\n]+(?:。|！|？)\n\n[^\n]+/.test(reply),
    `${label} 仍像機器一樣每句強制空行`,
    reply,
  );
}

function isApiFailure(result) {
  return API_FAILURE_RE.test(`${joined(result, "replies")}\n${joined(result, "logs")}`);
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  let pdfCalls = 0;

  try {
    const frame = await openAuthorizedTestUi(page, { timeout: 90000 });
    const accessToken = await frame.evaluate(() => eval("TEST_UI_ACCESS_TOKEN"));
    assertStep(accessToken, "[BLOCKED] TestUI access token 不存在");

    const rpc = (name, ...args) =>
      frame.evaluate(
        (functionName, callArgs) =>
          new Promise((resolve, reject) => {
            google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler(reject)
              [functionName](...callArgs);
          }),
        name,
        args,
      );

    async function newSession(label) {
      const userId = `TEST_${VERSION.replace(/\W/g, "_")}_${label}_${RUN_ID}`;
      await rpc("clearTestSession", userId, accessToken);
      return userId;
    }

    async function send(userId, message, label, allowRetry = true) {
      let result = await rpc("testMessage", message, userId, accessToken);
      if (isApiFailure(result) && allowRetry) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        result = await rpc("testMessage", message, userId, accessToken);
      }
      assertStep(
        !isApiFailure(result),
        `${label} 一次退避重試後仍為 API_GUARDED／API 失敗，不能算對話品質通過`,
        `${joined(result, "replies")}\n${joined(result, "logs")}`,
      );
      assertCustomerClean(label, result);
      if (PDF_LOG_RE.test(joined(result, "logs"))) pdfCalls += 1;
      return result;
    }

    async function verifyExactQa(label, question, expected) {
      const userId = await newSession(label);
      const result = await send(userId, question, label);
      const reply = joined(result, "replies");
      const logs = joined(result, "logs");
      assertStep(expected.test(reply), `${label} 沒有回答核心結論`, reply);
      assertStep(/QA First Router v29\.6\.093.*精準 QA 命中/.test(logs), `${label} 未走精準 QA`, logs);
      assertStep(!PDF_LOG_RE.test(logs) && !WEB_LOG_RE.test(logs), `${label} 精準 QA 卻呼叫 PDF／網路`, logs);
      return result;
    }

    await verifyExactQa(
      "IPHONE_AIR",
      "客人的 iPhone Air 為什麼 Type-C 連接 M8 不能顯示？",
      /未列|沒有列|不支援|無法|不能/i,
    );
    const iphone17User = await newSession("IPHONE_17");
    const iphone17 = await send(
      iphone17User,
      "iPhone 17 用 USB-C 接 M8 可以顯示嗎？",
      "IPHONE_17",
    );
    assertStep(/DISPLAYPORT|顯示|影像/i.test(joined(iphone17, "replies")), "IPHONE_17 沒有回答有線顯示核心結論", joined(iphone17, "replies"));
    assertStep(!PDF_LOG_RE.test(joined(iphone17, "logs")) && !WEB_LOG_RE.test(joined(iphone17, "logs")), "IPHONE_17 未同意卻呼叫 PDF／網路", joined(iphone17, "logs"));

    const noAutoPdfUser = await newSession("NO_AUTO_PDF");
    const noAutoPdf = await send(noAutoPdfUser, "S27DG502EC 怎麼恢復原廠設定？", "未同意手冊");
    assertStep(!PDF_LOG_RE.test(joined(noAutoPdf, "logs")), "未同意手冊卻讀取 PDF", joined(noAutoPdf, "logs"));

    let manual = await send(noAutoPdfUser, "#查手冊", "G5 明確查手冊");
    if (!PDF_LOG_RE.test(joined(manual, "logs"))) {
      manual = await send(noAutoPdfUser, "#型號:S27DG502EC", "G5 手冊選型");
    }
    const manualReply = joined(manual, "replies");
    assertStep(PDF_LOG_RE.test(joined(manual, "logs")), "G5 明確同意後沒有讀取唯一手冊", joined(manual, "logs"));
    assertStep(/資料來源：三星官方手冊/.test(manualReply), "G5 手冊來源未轉成自然頁尾", manualReply);
    assertStep(/重設|原廠|出廠|設定/i.test(manualReply), "G5 手冊回答偏離重設問題", manualReply);

    const codecUser = await newSession("HEVC");
    const codecFast = await send(codecUser, "S32FM703 是否支援 HEVC？", "HEVC Fast Mode");
    assertStep(!PDF_LOG_RE.test(joined(codecFast, "logs")), "HEVC Fast Mode 未同意卻讀取 PDF", joined(codecFast, "logs"));
    let codecManual = await send(codecUser, "#查手冊", "HEVC 明確查手冊");
    if (!PDF_LOG_RE.test(joined(codecManual, "logs"))) {
      codecManual = await send(codecUser, "#型號:S32FM703", "HEVC 手冊選型");
    }
    assertStep(PDF_LOG_RE.test(joined(codecManual, "logs")), "HEVC 明確同意後沒有讀手冊", joined(codecManual, "logs"));
    assertStep(/HEVC|H\.265/i.test(joined(codecManual, "replies")), "HEVC 手冊回答沒有核心格式資訊", joined(codecManual, "replies"));

    const displayUser = await newSession("DISPLAY_RELEVANCE");
    const display = await send(displayUser, "iPhone 17 接 M8 沒畫面，要檢查什麼？", "顯示題內容相關性");
    assertStep(!/65\s*W|充電|攝影機/.test(joined(display, "replies")), "顯示題混入 65W、充電或攝影機", joined(display, "replies"));

    const guardCases = [
      ["M7_MUTE", "M7 靜音怎麼解除？", /靜音|音量|型號|查手冊/i],
      ["PRICE", "S32FM703 現在售價多少？", /售價|價格|通路|官網/i],
      ["SERVICE", "三星螢幕客服服務時間？", /服務|客服|時間|查證/i],
      ["UNKNOWN", "S99ZZ9999 怎麼恢復原廠設定？", /完整型號|找不到|未登錄|確認/i],
      ["SCOPE", "Galaxy 手機怎麼重置？", /螢幕|服務範圍/i],
      ["THANKS", "謝謝", /不客氣|有需要|可以再問|沒問題/i],
    ];
    for (const [label, question, expected] of guardCases) {
      const userId = await newSession(label);
      const result = await send(userId, question, label);
      assertStep(expected.test(joined(result, "replies")), `${label} 回覆不符合情境`, joined(result, "replies"));
      assertStep(!PDF_LOG_RE.test(joined(result, "logs")) && !WEB_LOG_RE.test(joined(result, "logs")), `${label} 發生未授權 PDF／網路呼叫`, joined(result, "logs"));
      if (label === "UNKNOWN") {
        assertStep(!/確定支援|請依序進入|按下.{0,20}重設/i.test(joined(result, "replies")), "未知型號編造操作步驟", joined(result, "replies"));
      }
    }

    const followUser = await newSession("FOLLOWUP_SWITCH");
    const first = await send(followUser, "M8 怎麼用？", "模糊問題");
    assertStep(/型號|想設定|功能|連接|哪一項/i.test(joined(first, "replies")), "模糊問題沒有先釐清", joined(first, "replies"));
    const switched = await send(followUser, "改問 M7 靜音", "換題");
    assertStep(/M7|靜音|型號/i.test(joined(switched, "replies")), "換題後仍黏在舊主題", joined(switched, "replies"));
    assertStep(!PDF_LOG_RE.test(joined(first, "logs") + joined(switched, "logs")), "模糊追問／換題發生未授權 PDF", joined(first, "logs") + joined(switched, "logs"));

    assertStep(pdfCalls <= 3, `整輪 PDF 呼叫 ${pdfCalls} 次，超過 3 次上限`);
    console.log(`PASS: ${VERSION} 正式人味／路由回歸；PDF 呼叫 ${pdfCalls} 次，未授權網搜 0 次`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
