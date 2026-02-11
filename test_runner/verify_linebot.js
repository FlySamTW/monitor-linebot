
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
  await sleep(5000); // iframes may spawn late

  for (const f of page.frames()) {
    try {
      const el = await f.$(inputSelector);
      if (el) return f;
    } catch (_) {}
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
  const userId = `TEST_SCEN_${String(id).padStart(2, "0")}`;

  console.log("");
  console.log(`====================`);
  console.log(`Scenario ${id}: ${title}`);
  console.log(`UserId: ${userId}`);
  console.log(`Time: ${nowIso()}`);
  console.log(`====================`);

  // Ensure isolation between scenarios.
  await clearTestSession(frame, userId);

  for (let i = 0; i < turns.length; i++) {
    const userMsg = turns[i];
    console.log("");
    console.log(`Turn ${i + 1} USER: ${userMsg}`);

    const res = await callTestMessage(frame, userMsg, userId);
    const replies = Array.isArray(res && res.replies) ? res.replies : [];

    if (replies.length === 0) {
      console.log(`Turn ${i + 1} BOT: (無回覆)`);

      // Debug: Print last logs to understand silent returns.
      const logs = Array.isArray(res && res.logs) ? res.logs : [];
      const fatals = logs.filter((l) => String(l).includes("[Fatal]"));
      if (fatals.length > 0) {
        console.log(`Turn ${i + 1} BOT: (Fatal)`);
        fatals.slice(0, 3).forEach((l) => console.log(String(l)));
      } else if (logs.length > 0) {
        console.log(`Turn ${i + 1} LOGS (last 25):`);
        logs
          .slice(-25)
          .forEach((l) => console.log(String(l).replace(/\r\n/g, "\n")));
      } else {
        console.log(`Turn ${i + 1} LOGS: (none)`);
      }
      continue;
    }

    for (let j = 0; j < replies.length; j++) {
      console.log(`Turn ${i + 1} BOT#${j + 1}: ${formatReply(replies[j])}`);
    }
  }
}

async function run() {
  console.log("Starting Scenario Runner (TestUI -> testMessage direct call)...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));

  try {
    console.log(`Navigating to ${TEST_URL}`);
    await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });

    const frame = await findUiFrame(page);
    if (!frame) {
      console.log("Dumping frames...");
      page.frames().forEach((f) => console.log(f.url()));
      throw new Error("UI frame not found (#msg-input missing).");
    }
    console.log(`Using UI frame: ${frame.url()}`);

    const filter = (process.env.SCENARIOS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => parseInt(s, 10))
      .filter((n) => !Number.isNaN(n));

    // Pick 10 representative scenarios from real user questions, with follow-ups.
    const scenariosAll = [
      {
        id: 1,
        title: "高規格需求 (4K/200Hz/340Hz)",
        turns: [
          "/重啟",
          "我們有HD340HZ，4K200Hz的螢幕嗎",
          "#再詳細說明",
        ],
      },
      {
        id: 2,
        title: "型號比較 (S27F612 vs S27B610)",
        turns: [
          "/重啟",
          "S27f612 s27b610差別",
          "如果我要接筆電Type-C一線連接，你會偏向哪一台？原因？",
        ],
      },
      {
        id: 3,
        title: "查規格 (S27B610)",
        turns: [
          "/重啟",
          "給我s27b610 規格",
          "它有支援PBP/PIP嗎？有的話怎麼開？",
        ],
      },
      {
        id: 4,
        title: "耗電量 (M7 43吋) + 追問",
        turns: [
          "/重啟",
          "請問m7 43吋耗電量多大",
          "那待機耗電大概多少？如果找不到精確值，你會怎麼建議我估算？",
        ],
      },
      {
        id: 5,
        title: "新品/是否有新 S8 + 追問",
        turns: [
          "/重啟",
          "請問有新的s8嗎？",
          "如果你不確定有沒有新款，請直接說你需要我提供哪些線索（型號/通路/年份）你才查得到。",
        ],
      },
      {
        id: 6,
        title: "服務時間/今天是否營業 + 追問",
        turns: [
          "/重啟",
          "請問服務時間是幾點",
          "請問今天有營業嗎？",
        ],
      },
      {
        id: 7,
        title: "台中 FollowMe 展示點 + 追問 (可能觸發網搜)",
        turns: [
          "/重啟",
          "請問台中哪裡有followme 的展示",
          "#搜網上其他解答",
        ],
      },
      {
        id: 8,
        title: "G5 型號列表 + 推薦",
        turns: [
          "/重啟",
          "請問G5有那些",
          "請問G5哪一台比較好",
          "我主要玩PS5跟PC，想要27吋，偏好高刷新但也希望畫質好，你會怎麼選？",
        ],
      },
      {
        id: 9,
        title: "概念題 (HDR/HDR10) + 追問",
        turns: [
          "/重啟",
          "什麼是HDR",
          "HDR10的優點有什麼？",
          "HDR400跟HDR1000差別會很大嗎？如果我是一般玩家值得多花錢嗎？",
        ],
      },
      {
        id: 10,
        title: "疑難排解 (S27FG532 + DP 只有 60Hz)",
        turns: [
          "/重啟",
          "請問s27fg532 為什麼客人的顯示卡5090接dp他的更新率只有60",
          "螢幕是S27FG532EC，顯示卡是RTX 5090，用DP線。你先列出你要我確認的清單，然後再給可能原因排序。",
          "#查手冊",
        ],
      },
    ];

    const scenarios = filter.length
      ? scenariosAll.filter((s) => filter.includes(s.id))
      : scenariosAll;

    for (const s of scenarios) {
      await runScenario(frame, s);
      // Avoid hammering the web-app too aggressively.
      await sleep(1500);
    }
  } catch (e) {
    console.error("TEST ERROR:", e);
  } finally {
    await browser.close();
  }
}

run();

