const puppeteer = require("puppeteer");

const TEST_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";

function nowIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function formatReply(text) {
  if (text === null || text === undefined) return "";
  let t = String(text);
  t = t.replace(/\r\n/g, "\n");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

async function findUiFrame(page) {
  const inputSelector = "#msg-input";
  console.log("Waiting for UI Frame to spawn...");
  for (let i = 0; i < 10; i++) {
    await sleep(2000);
    for (const f of page.frames()) {
      try {
        const el = await f.$(inputSelector);
        if (el) return f;
      } catch (_) {}
    }
  }
  return null;
}

async function callTestMessage(frame, msg, userId) {
  return frame.evaluate(
    (m, uid) =>
      new Promise((resolve, reject) => {
        try {
          if (!window.google || !google.script || !google.script.run) {
            reject(new Error("google.script.run not available"));
            return;
          }
          google.script.run
            .withSuccessHandler((res) => resolve(res))
            .withFailureHandler((err) => reject(err))
            .testMessage(m, uid);
        } catch (e) {
          reject(e);
        }
      }),
    msg,
    userId,
  );
}

async function clearTestSession(frame, userId) {
  return frame.evaluate(
    (uid) =>
      new Promise((resolve, reject) => {
        try {
          google.script.run
            .withSuccessHandler((res) => resolve(res))
            .withFailureHandler((err) => reject(err))
            .clearTestSession(uid);
        } catch (e) {
          reject(e);
        }
      }),
    userId,
  );
}

async function runScenario(frame, scenario) {
  const { id, title, turns } = scenario;
  const userId = `TEST_QA_FLOW_${String(id).padStart(2, "0")}`;

  console.log("");
  console.log(`====================`);
  console.log(`Scenario ${id}: ${title}`);
  console.log(`UserId: ${userId}`);
  console.log(`Time: ${nowIso()}`);
  console.log(`====================`);

  // 確保對話隔離
  await clearTestSession(frame, userId);

  for (let i = 0; i < turns.length; i++) {
    const userMsg = turns[i];
    console.log("");
    console.log(`Turn ${i + 1} USER: ${userMsg}`);

    const res = await callTestMessage(frame, userMsg, userId);
    const replies = Array.isArray(res && res.replies) ? res.replies : [];

    if (replies.length === 0) {
      console.log(`Turn ${i + 1} BOT: (無回覆)`);
      const logs = Array.isArray(res && res.logs) ? res.logs : [];
      if (logs.length > 0) {
        console.log(`Turn ${i + 1} LOGS (last 10):`);
        logs.slice(-10).forEach((l) => console.log(String(l)));
      }
      continue;
    }

    for (let j = 0; j < replies.length; j++) {
      console.log(`Turn ${i + 1} BOT#${j + 1}: \n--------------------\n${formatReply(replies[j])}\n--------------------`);
    }
  }
}

async function run() {
  console.log("Starting QA Flow Scenario Runner...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  
  try {
    console.log(`Navigating to ${TEST_URL}`);
    await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });

    const frame = await findUiFrame(page);
    if (!frame) {
      throw new Error("UI frame not found (#msg-input missing).");
    }
    console.log(`Using UI frame: ${frame.url()}`);

    const scenarios = [
      {
        id: 1,
        title: "全新 QA 建檔與修改流程（不寫入正式 QA）",
        turns: [
          "/重啟",
          "/紀錄 ZTEST_QA_FLOW_01 可以正常建立 QA 草稿嗎？ A：可以，這是 QA flow 草稿測試。",
          "補充說明：此遙控器型號為 BN59-01386B。",
          "2", // 非合併選擇狀態下應被拒絕，不得污染草稿
          "/取消"
        ],
      },
      {
        id: 2,
        title: "QA 草稿純數字防污染流程（不寫入正式 QA）",
        turns: [
          "/重啟",
          "/紀錄 ZTEST_QA_FLOW_02 可以避免純數字污染嗎？ A：可以，純數字不應被寫入草稿。",
          "2",
          "/取消"
        ],
      },
      {
        id: 3,
        title: "防呆與取消建檔測試",
        turns: [
          "/重啟",
          "/紀錄 ZTEST_QA_FLOW_03 可以避免無關閒聊污染嗎？ A：可以，無關內容不應被寫入草稿。",
          "我想吃蘋果", // 模擬無意義的對話，看 AI 是否會錯亂將其融入
          "/取消"
        ]
      },
      {
        id: 4,
        title: "草稿取消流程（不寫入正式 QA）",
        turns: [
          "/重啟",
          "/紀錄 ZTEST_QA_FLOW_04 可以取消建檔嗎？ A：可以，取消後不應寫入 QA。",
          "/取消"
        ]
      }
    ];

    for (const s of scenarios) {
      await runScenario(frame, s);
      await sleep(15000); // 延長情境之間的延遲，給予 Google Apps Script 同步完成的時間，防止 Lock timeout
    }
  } catch (e) {
    console.error("TEST ERROR:", e);
  } finally {
    await browser.close();
  }
}

run();
