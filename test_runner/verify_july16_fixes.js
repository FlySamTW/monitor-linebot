const puppeteer = require("puppeteer");

const maintenanceSecret = process.env.LINEBOT_TEST_SECRET;
if (!maintenanceSecret) {
  throw new Error("LINEBOT_TEST_SECRET is required for formal TestUI access");
}
const TEST_URL =
  process.env.LINEBOT_TEST_URL ||
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1&secret=" +
    encodeURIComponent(maintenanceSecret);

function assertStep(condition, message, details = "") {
  if (!condition) {
    throw new Error(`${message}${details ? `\n${details}` : ""}`);
  }
}

function joined(result, key) {
  const rows = Array.isArray(result && result[key]) ? result[key] : [];
  return rows.map((item) => String(item || "")).join("\n");
}

function hasLog(result, pattern) {
  return pattern.test(joined(result, "logs"));
}

function isApiFailure(text) {
  return /系統(?:暫時)?忙碌中?|暫時無法處理|網路搜尋服務暫時無法連線|已達配額限制|沒有取得可核對的網頁來源/i.test(
    String(text || ""),
  );
}

function hasUnsupportedPositiveDisplayClaim(text) {
  const sentences =
    String(text || "").match(/[^。！？!?\n]+[。！？!?]?/g) || [];
  return sentences.some(
    (sentence) =>
      /IPHONE\s*(?:17\s*)?AIR|這款手機|手機本身/i.test(sentence) &&
      !/不支援|未支援|沒有支援|無法|不能|不可|未列|沒有列|並未|不具備|不包含/i.test(
        sentence,
      ) &&
      /(支援|可以|可透過|能夠|具備)/i.test(sentence) &&
      /(DISPLAY\s*PORT|USB[\s‑–—_-]*C|TYPE[\s‑–—_-]*C)/i.test(sentence) &&
      /(顯示|畫面|影像|視訊|輸出|外接螢幕|4K)/i.test(sentence),
  );
}

async function findUiFrame(page) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      if (await frame.$("#msg-input").catch(() => null)) {
        return frame;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return null;
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const userId = `TEST_IPHONE_AIR_V296092_${Date.now()}`;

  try {
    await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });
    const frame = await findUiFrame(page);
    assertStep(frame, "TestUI frame not found");

    const accessToken = await frame.evaluate(() => eval("TEST_UI_ACCESS_TOKEN"));
    assertStep(accessToken, "TestUI access token is unavailable");

    const call = (functionName, ...args) =>
      frame.evaluate(
        (name, callArgs) =>
          new Promise((resolve, reject) => {
            google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler(reject)
              [name](...callArgs);
          }),
        functionName,
        args,
      );
    const clearSession = () =>
      call("clearTestSession", userId, accessToken);
    const send = (message) =>
      call("testMessage", message, userId, accessToken);

    await clearSession();
    const turns = [];
    const messages = [
      "/重啟",
      "客人的 iPhone Air 為什麼 Type-C 連接 M8 不能顯示？",
      "#型號:S32FM803UC",
      "#這題再搜網路",
      "DisplayPort 不就是 Type-C 嗎？為什麼剛才會說法不一致？",
    ];
    for (let index = 0; index < messages.length; index++) {
      const message = messages[index];
      let result = await send(message);
      if (
        index === messages.length - 1 &&
        isApiFailure(joined(result, "replies"))
      ) {
        console.log("RETRY: follow-up hit a transient API failure");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        result = await send(message);
      }
      turns.push({ message, result });
      console.log("\n====================================");
      console.log(`USER: ${message}`);
      console.log(joined(result, "replies") || "(無回覆)");
      console.log("KEY LOGS:");
      joined(result, "logs")
        .split("\n")
        .filter((line) =>
          /Model Select|PDF 匹配|Official Product Guard|Official Page Fetch|URL Context|Grounding|Local QA Hit|Quick Reply v29\.6\.092|使用顯式 Quick Reply|來源/i.test(
            line,
          ),
        )
        .forEach((line) => console.log(line));
    }

    const initialText = joined(turns[1].result, "replies");
    assertStep(
      /M8 型號確認|請選擇 M8 完整型號|請先選完整型號|S32FM803UC/i.test(
        initialText + joined(turns[1].result, "logs"),
      ),
      "M8 cross-device question did not request the exact monitor model",
      initialText,
    );

    const manualText = joined(turns[2].result, "replies");
    assertStep(
      !isApiFailure(manualText),
      "manual lookup failed; cannot approve the iPhone Air flow",
      manualText,
    );
    assertStep(
      /\[來源:官方手冊\]/.test(manualText),
      "selected M8 answer did not include the official-manual source",
      manualText,
    );
    assertStep(
      !hasUnsupportedPositiveDisplayClaim(manualText),
      "manual answer invented iPhone Air display support",
      manualText,
    );
    assertStep(
      !/APPLE\s*官方規格|IPHONE\s*AIR\s*的\s*USB-C\s*(?:僅列|未列|不支援)/i.test(
        manualText,
      ),
      "Samsung manual stage leaked phone-side QA facts under the manual source label",
      manualText,
    );
    assertStep(
      !/更新\s*IPHONE|有些螢幕可能|檢查\s*M8\s*螢幕.{0,30}設定/i.test(
        manualText,
      ),
      "manual answer still contains unsupported device or monitor-setting guesses",
      manualText,
    );

    const webText = joined(turns[3].result, "replies");
    assertStep(
      !isApiFailure(webText),
      "official web verification failed; cannot approve the iPhone Air flow",
      webText,
    );
    assertStep(
      /IPHONE\s*AIR/i.test(webText),
      "web answer lost the iPhone Air product identity",
      webText,
    );
    assertStep(
      !hasUnsupportedPositiveDisplayClaim(webText),
      "web answer still claims that iPhone Air supports wired DisplayPort output",
      webText,
    );
    assertStep(
      /\[來源:網路搜尋\]/.test(webText) &&
        hasLog(
          turns[3].result,
          /iphone-air\/specs|Official Product Guard v29\.6\.092|直接官方頁證據有效/i,
        ),
      "web answer lacks validated iPhone Air official-page evidence",
      `${webText}\n${joined(turns[3].result, "logs")}`,
    );
    assertStep(
      !/韌體|產品定位|市場定位|市場策略|可能是 iOS|依賴 iOS/i.test(webText),
      "web answer still contains unsupported speculation",
      webText,
    );
    assertStep(
      !/USB[\s‑–—_-]*C.{0,40}支援.{0,25}AIRPLAY|IPHONE\s*AIR.{0,70}可能.{0,45}(?:不支援|相容性)/i.test(
        webText,
      ),
      "web answer conflated AirPlay with USB-C or kept a speculative wired conclusion",
      webText,
    );
    assertStep(
      /未列\s*DISPLAY\s*PORT|未列\s*DisplayPort|未明確提及.{0,45}DISPLAY\s*PORT/i.test(
        webText,
      ) &&
        /不能把\s*TYPE[\s‑–—_-]*C[\s\S]{0,45}(?:DISPLAY\s*PORT|DP\s*ALT|有線顯示)/i.test(
          webText,
        ),
      "web answer did not preserve the verified Apple evidence boundary",
      webText,
    );

    const followUpText = joined(turns[4].result, "replies");
    assertStep(
      !isApiFailure(followUpText),
      "follow-up remained unavailable after one controlled retry",
      followUpText,
    );
    assertStep(
      !hasUnsupportedPositiveDisplayClaim(followUpText),
      "follow-up answer contradicted the verified iPhone Air conclusion",
      followUpText,
    );
    assertStep(
      !/韌體|產品定位|市場定位|市場策略|依賴 iOS|IPHONE\s*AIR.{0,80}可能.{0,50}(?:DISPLAYPORT|影像輸出|沒有啟用)/i.test(
        followUpText,
      ),
      "follow-up answer invented an explanation for the prior contradiction",
      followUpText,
    );

    const negativeUser = `${userId}_NEGATIVE`;
    await call("clearTestSession", negativeUser, accessToken);
    const negativeInitial = await call(
      "testMessage",
      "iPhone 17e 可以用 USB-C 接 M8 顯示嗎？",
      negativeUser,
      accessToken,
    );
    const negativeSelect = await call(
      "testMessage",
      "#型號:S32FM803UC",
      negativeUser,
      accessToken,
    );
    assertStep(
      !hasLog(negativeSelect, /Local QA Hit v29\.6\.092/),
      "iPhone 17e incorrectly hit the iPhone Air QA",
      joined(negativeSelect, "logs"),
    );
    assertStep(
      /M8 型號確認|請選擇 M8 完整型號|S32FM803UC/i.test(
        joined(negativeInitial, "replies") + joined(negativeInitial, "logs"),
      ),
      "negative iPhone 17e scenario did not preserve the model-selection flow",
    );

    console.log("\nPASS: verify_july16_fixes");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
