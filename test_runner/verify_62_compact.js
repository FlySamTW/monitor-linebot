const puppeteer = require("puppeteer");

const TEST_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function findFrame(page) {
  await sleep(5000);
  for (const f of page.frames()) {
    const el = await f.$("#msg-input").catch(() => null);
    if (el) {
      return f;
    }
  }
  return null;
}

async function call(frame, fnName, ...args) {
  return frame.evaluate(
    (f, a) =>
      new Promise((resolve, reject) => {
        try {
          google.script.run
            .withSuccessHandler(resolve)
            .withFailureHandler(reject)
            [f](...a);
        } catch (e) {
          reject(e);
        }
      }),
    fnName,
    args,
  );
}

function hasPattern(lines, regex) {
  return (lines || []).some((l) => regex.test(String(l)));
}

function hasFatal(lines) {
  return hasPattern(lines, /\[Fatal\]/);
}

function hasAutoTagLeak(replies) {
  return hasPattern(replies, /\[AUTO_SEARCH_(?:PDF|WEB)\]/i);
}

async function run() {
  const cases = [
    {
      id: "Q1_QA_COMPARE",
      msg: "S32FG812SC與S32DG802SC是否有耳機孔?兩者在功能上有何差異?S32FG812SC是IPS面板嗎?G5呢?",
      expectScope: false,
      expectForceWeb: false,
    },
    {
      id: "Q2_ODYSSEY3D",
      msg: "使用Odyssey 3D或G90XF從Odyssey Hub開啟遊戲後視窗在背景且無法3D該如何解決?",
      expectScope: false,
      expectForceWeb: false,
    },
    {
      id: "Q5_M9_SPEC",
      msg: "M9是OLED面板嗎?屬於Smart系列還是電競螢幕?有支援HDR/HDR10嗎?解析度是多少?",
      expectScope: false,
      expectForceWeb: false,
    },
    {
      id: "Q6_PRICE",
      msg: "請協助尋找M9、G8、M8、S34BG850SC3的市場最低價與建議售價。",
      expectScope: false,
      expectForceWeb: true,
    },
    {
      id: "Q9_PROMO",
      msg: "雙11、雙12、黑五或12月份近期促銷活動有什麼?G7有延長保固兩年活動嗎?",
      expectScope: false,
      expectForceWeb: true,
    },
    {
      id: "Q26_LATEST",
      msg: "目前最新上市的螢幕型號是哪款?2026年有什麼新機型嗎?CES有新資訊嗎?",
      expectScope: false,
      expectForceWeb: true,
    },
    {
      id: "Q45_APPLIANCE_ALLOWED",
      msg: "三星洗衣機21公斤款快速清洗和一般洗有何不同?",
      expectScope: false,
      expectForceWeb: false,
    },
    {
      id: "Q4_SCOPE_SANYO",
      msg: "三洋有哪些螢幕支援G-Sync?哪一台有300Hz且0.03毫秒?",
      expectScope: true,
      expectForceWeb: false,
    },
    {
      id: "Q25_SCOPE_EXCEL",
      msg: "請以Excel表格列出市售華碩、技嘉及微星32吋高刷新率且有Type-C的機型與售價。",
      expectScope: true,
      expectForceWeb: false,
    },
  ];

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });
  const frame = await findFrame(page);
  if (!frame) {
    throw new Error("TestUI frame not found");
  }

  const results = [];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const userId = `TEST_62_COMPACT_${Date.now()}_${i}`;

    await call(frame, "clearTestSession", userId);
    const res = await call(frame, "testMessage", c.msg, userId);

    const replies = Array.isArray(res && res.replies) ? res.replies : [];
    const logs = Array.isArray(res && res.logs) ? res.logs : [];

    const scopeLog = hasPattern(logs, /\[Scope Guard v29\.5\.156\]/);
    const forceWebLog =
      hasPattern(logs, /\[Force Web Intent v29\.5\.156\]/) ||
      hasPattern(logs, /\[Price Guard v29\.5\.157\]/);

    const checks = [];
    checks.push({ ok: replies.length > 0, name: "has_reply" });
    checks.push({ ok: !hasFatal(logs), name: "no_fatal" });
    checks.push({ ok: !hasAutoTagLeak(replies), name: "no_auto_tag_leak" });

    if (c.expectScope) {
      checks.push({ ok: scopeLog, name: "scope_guard_triggered" });
      checks.push({ ok: !forceWebLog, name: "no_force_web_when_scope" });
    } else {
      checks.push({ ok: !scopeLog, name: "scope_guard_not_triggered" });
    }

    if (c.expectForceWeb) {
      checks.push({ ok: forceWebLog, name: "force_web_triggered" });
    }
    if (c.id === "Q45_APPLIANCE_ALLOWED") {
      const replyText = replies.join("\n");
      checks.push({
        ok: !/S32FM703UC|S27FG812SC|螢幕.*完整型號|完整型號.*S32|完整型號.*S27/i.test(
          replyText,
        ),
        name: "appliance_not_forced_to_monitor_model",
      });
    }

    const pass = checks.every((x) => x.ok);
    results.push({ id: c.id, pass, checks, replies, logs, msg: c.msg });

    console.log("\n====================================");
    console.log(`${c.id} | ${pass ? "PASS" : "FAIL"}`);
    console.log(`Q: ${c.msg}`);
    console.log(`ReplyCount: ${replies.length}`);
    if (replies[0]) {
      console.log(`Reply#1: ${String(replies[0]).slice(0, 240)}`);
    }
    const failedChecks = checks.filter((x) => !x.ok).map((x) => x.name);
    if (failedChecks.length > 0) {
      console.log(`FailedChecks: ${failedChecks.join(", ")}`);
      const sampleLogs = logs.slice(-20).map((l) => String(l));
      console.log("LastLogs:");
      sampleLogs.forEach((l) => console.log(l));
    }

    await sleep(1200);
  }

  await browser.close();

  const passCount = results.filter((r) => r.pass).length;
  console.log("\n====================================");
  console.log(`TOTAL: ${passCount}/${results.length} PASS`);
  console.log("====================================");

  if (results.some((r) => !r.pass)) {
    process.exitCode = 1;
  }
}

run().catch((e) => {
  console.error("TEST ERROR:", e);
  process.exit(1);
});
