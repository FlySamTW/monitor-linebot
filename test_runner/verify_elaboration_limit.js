const puppeteer = require("puppeteer");
const { getAuthorizedTestUiUrl } = require("./testui_auth");

function hasPattern(lines, regex) {
  return (lines || []).some((l) => regex.test(String(l)));
}

function assertStep(ok, message) {
  if (!ok) {
    throw new Error(message);
  }
}

function isApiGuardedReply(replies) {
  return (replies || []).some((line) =>
    /系統暫時忙碌|目前請求過於頻繁|已達配額限制|暫時無法處理|網路搜尋服務暫時無法連線/i.test(
      String(line || ""),
    ),
  );
}

async function main() {
  const TEST_URL = getAuthorizedTestUiUrl();
  const userId = "TEST_ELABORATION_LIMIT_001";

  const turns = [
    "/重啟",
    "我的3d螢幕該如何開啟Odyssey hub",
    "#再詳細說明",
    "#再詳細說明",
    "#再詳細說明",
  ];

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 5000));

    let frame = null;
    for (const f of page.frames()) {
      const input = await f.$("#msg-input").catch(() => null);
      if (input) {
        frame = f;
        break;
      }
    }
    if (!frame) {
      throw new Error("TestUI frame not found");
    }

    const clearSession = () =>
      frame.evaluate(
        (uid) =>
          new Promise((resolve, reject) => {
            google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler(reject)
              .clearTestSession(uid, TEST_UI_ACCESS_TOKEN);
          }),
        userId,
      );

    const testMessage = (msg) =>
      frame.evaluate(
        (m, uid) =>
          new Promise((resolve, reject) => {
            google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler(reject)
              .testMessage(m, uid, TEST_UI_ACCESS_TOKEN);
          }),
        msg,
        userId,
      );

    await clearSession();

    const all = [];
    for (let i = 0; i < turns.length; i++) {
      const q = turns[i];
      const res = await testMessage(q);
      const replies = Array.isArray(res && res.replies) ? res.replies : [];
      const logs = Array.isArray(res && res.logs) ? res.logs : [];
      all.push({ q, replies, logs });

      console.log("\n====================================");
      console.log(`TURN ${i + 1} USER: ${q}`);
      if (replies.length === 0) {
        console.log("BOT: (無回覆)");
      } else {
        replies.forEach((r, idx) => console.log(`BOT#${idx + 1}: ${r}`));
      }
    }

    const t3 = all[2];
    const t4 = all[3];
    const t5 = all[4];
    const firstAnswer = all[1];

    if (isApiGuardedReply(firstAnswer.replies)) {
      assertStep(
        [t3, t4, t5].every((turn) =>
          hasPattern(turn.replies, /上一則回答是系統暫時忙碌|還沒有成功查到內容|避免補出不可靠資訊/),
        ),
        "API guarded branch failed: #再詳細說明 should refuse to expand unavailable content.",
      );
      assertStep(
        [t3, t4, t5].every((turn) =>
          hasPattern(turn.logs, /上一則為 API 失敗，停止再詳細說明/),
        ),
        "API guarded branch failed: logs should record that elaboration was stopped.",
      );
      assertStep(
        ![t3, t4, t5].some((turn) => hasPattern(turn.logs, /再詳細說明計數:/)),
        "API guarded branch failed: unavailable content must not consume elaboration quota.",
      );
      console.log("\nPASS: verify_elaboration_limit (API quota guarded)");
      return;
    }

    assertStep(
      hasPattern(t3.logs, /已保留一次性再詳細說明/) &&
        [t4, t5].every(
          (turn) =>
            hasPattern(turn.logs, /一次性再詳細說明已使用/) &&
            hasPattern(turn.replies, /這題我已經補充過一次/),
        ),
      "Step1 failed: 第一次必須展開，後續舊按鈕必須零 LLM 友善停止。",
    );

    assertStep(
      ![t3, t4, t5].some((turn) =>
        hasPattern(turn.logs, /Daily Question Guard.*used=/),
      ),
      "Step2 failed: #再詳細說明 不得重複扣一般 20 題額度。",
    );

    console.log("\nPASS: verify_elaboration_limit");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});
