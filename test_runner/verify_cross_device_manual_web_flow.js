const puppeteer = require("puppeteer");

const TEST_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";

function assertStep(condition, message) {
  if (!condition) throw new Error(message);
}

function hasLog(logs, pattern) {
  return (logs || []).some((line) => pattern.test(String(line)));
}

function isApiFailure(text) {
  return /系統暫時忙碌|暫時無法處理|網路搜尋服務暫時無法連線|已達配額限制/i.test(
    String(text || ""),
  );
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const userId = `TEST_CROSS_DEVICE_${Date.now()}`;

  try {
    await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });
    await new Promise((resolve) => setTimeout(resolve, 4000));

    let frame = null;
    for (const candidate of page.frames()) {
      if (await candidate.$("#msg-input").catch(() => null)) {
        frame = candidate;
        break;
      }
    }
    assertStep(frame, "TestUI frame not found");

    const token = await frame.evaluate(() => eval("TEST_UI_ACCESS_TOKEN"));
    assertStep(token, "TestUI access token is unavailable");

    const clearSession = () =>
      frame.evaluate(
        (uid, accessToken) =>
          new Promise((resolve, reject) => {
            google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler(reject)
              .clearTestSession(uid, accessToken);
          }),
        userId,
        token,
      );

    const send = (message) =>
      frame.evaluate(
        (text, uid, accessToken) =>
          new Promise((resolve, reject) => {
            google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler(reject)
              .testMessage(text, uid, accessToken);
          }),
        message,
        userId,
        token,
      );

    await clearSession();
    const turns = [
      "iPhone 17要如何以type c連接M7顯示",
      "#型號:S32FM703UC",
      "#這題再搜網路",
    ];
    const results = [];

    for (const message of turns) {
      const result = await send(message);
      const replies = Array.isArray(result && result.replies)
        ? result.replies
        : [];
      const logs = Array.isArray(result && result.logs) ? result.logs : [];
      results.push({ message, replies, logs });

      console.log("\n====================================");
      console.log(`USER: ${message}`);
      replies.forEach((reply, index) =>
        console.log(`BOT#${index + 1}: ${reply}`),
      );
      console.log("KEY LOGS:");
      logs
        .filter((line) =>
          /Model Select|PDF 匹配|命中型號|AttachPDFs|API Stats|Cross Device|SOP v29\.6\.070|啟動 Pass|Google Search|grounding|已搜尋|\[Reply\]/i.test(
            String(line),
          ),
        )
        .forEach((line) => console.log(String(line)));
    }

    const firstText = results[0].replies.join("\n");
    assertStep(
      !/我只負責電腦螢幕與智慧家電/.test(firstText),
      "initial cross-device question was still rejected as out of scope",
    );
    assertStep(
      hasLog(results[0].logs, /型號選擇|Model Selection|準備顯示型號選擇泡泡/i),
      "initial M7 alias did not request an exact model",
    );

    const manualText = results[1].replies.join("\n");
    if (isApiFailure(manualText)) {
      throw new Error("manual LLM call failed; cannot approve the live flow");
    }
    assertStep(
      /\[來源:官方手冊\]/.test(manualText),
      "selected model answer is missing the official-manual source",
    );
    assertStep(
      /\[費用:NT\$0\.(?!0000)\d+/.test(manualText),
      "selected model answer is missing a non-zero LLM cost",
    );
    assertStep(
      hasLog(results[1].logs, /S32FM703[\s\S]*\.pdf|\.pdf[\s\S]*S32FM703/i) &&
        hasLog(results[1].logs, /AttachPDFs:\s*true|PDF 匹配:\s*1/i),
      "selected model answer did not actually attach the matching PDF",
    );
    assertStep(
      /螢幕端能確認的條件[\s\S]*這題再搜網路/.test(manualText),
      "manual-only answer did not preserve facts and offer device-side web verification",
    );
    assertStep(
      /(USB\s*-?\s*C|Type-C)[\s\S]*(DisplayPort|ALT|10G|65W)|(DisplayPort|ALT|10G|65W)[\s\S]*(USB\s*-?\s*C|Type-C)/i.test(manualText),
      "manual-only answer was over-sanitized and lost the useful monitor-side conditions",
    );
    assertStep(
      !/我只負責電腦螢幕與智慧家電/.test(manualText),
      "manual answer still contains the incorrect scope refusal",
    );
    assertStep(
      !/一般來說|尚未公布|尚未上市|檢查 iPhone|啟用 USB 影像|不同品牌|其他轉接方式|試試看用[^。]*iPhone|iPhone[^。]{0,40}(?:可以|可|能夠|支援)[^。]{0,40}(?:顯示|影像輸出|充電)|(?:可以|可)[^。]{0,40}(?:連接|顯示)[^。]{0,40}iPhone/i.test(
        manualText,
      ),
      "manual answer still contains unsupported external-device advice",
    );

    const webText = results[2].replies.join("\n");
    if (isApiFailure(webText)) {
      throw new Error("web-search LLM call failed; cannot approve the live flow");
    }
    assertStep(
      hasLog(results[2].logs, /SOP v29\.6\.070.*直接進網路搜尋/) &&
        hasLog(results[2].logs, /啟動 Pass 2 \(Web\)/),
      "explicit web follow-up did not skip the already-completed PDF stage",
    );
    assertStep(
      !hasLog(results[2].logs, /啟動 Pass 1\.5 \(PDF\)/),
      "explicit web follow-up incorrectly ran the PDF stage again",
    );
    assertStep(
      /\[來源:網路搜尋\]/.test(webText),
      "web follow-up is missing the web-search source",
    );
    assertStep(
      /\[來源:官方手冊\]/.test(webText),
      "integrated web follow-up is missing the prior official-manual source",
    );
    assertStep(
      /\[費用:NT\$0\.(?!0000)\d+/.test(webText),
      "web follow-up is missing a non-zero LLM cost",
    );
    assertStep(
      hasLog(
        results[2].logs,
        /可稽核 Google Search 證據:\s*true|官方頁讀取成功/i,
      ) &&
        hasLog(
          results[2].logs,
          /groundingChunks|提取來源|URL Context|已搜尋\s*\d+\s*個來源/i,
        ),
      "web follow-up has no auditable Google Search grounding evidence",
    );
    assertStep(
      !/尚未公布|尚未上市|預計將/i.test(webText),
      "web follow-up used stale built-in knowledge for an already released product",
    );
    assertStep(
      /DisplayPort/i.test(webText) &&
        !/DisplayPort[^。！？]{0,70}(未明確|待確認|無法確認)|是否支援\s*DisplayPort/i.test(webText),
      "web follow-up failed to use the directly fetched Apple DisplayPort evidence",
    );
    assertStep(
      !/檢查 iPhone|iPhone[^。]{0,30}設定|設定中[^。]{0,30}鏡像|其他已知支援|實際連接的相容性仍需|理論上可以|常見的連接邏輯|依賴 iPhone|依賴 iOS/i.test(webText),
      "web follow-up still contains unsupported device-side speculation",
    );
    assertStep(
      !/請參考[^。]{0,40}(?:手冊|官網|官方網站)/i.test(webText),
      "integrated web follow-up deflected the user back to a source the bot already checked",
    );
    assertStep(
      !/90\s*W/i.test(webText) && (/65\s*W/i.test(webText) || !/\d{2,3}\s*W/i.test(webText)),
      "web follow-up contradicted the official manual's monitor-side power value",
    );

    console.log("\nPASS: verify_cross_device_manual_web_flow");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
