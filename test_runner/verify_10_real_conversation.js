const fs = require("fs");
const path = require("path");
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
        try {
          google.script.run
            .withSuccessHandler(resolve)
            .withFailureHandler(reject)
            [f](...a);
        } catch (error) {
          reject(error);
        }
      }),
    fnName,
    args,
  );
}

function textOf(res, key) {
  const arr = Array.isArray(res && res[key]) ? res[key] : [];
  return arr
    .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
    .join("\n\n");
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function hasAll(text, patterns) {
  return patterns.every((pattern) => pattern.test(text));
}

function hasRealLlmLog(logs) {
  return /\[AI Stats\]|\[AI Raw Response\]|\[Gemini\]/i.test(logs);
}

function hasNoHardFailure(logs, reply) {
  const combined = `${logs}\n${reply}`;
  return !/\[Fatal\]|ReferenceError|TypeError|Exception|429 Too Many Requests|API 暫時達到使用上限|系統忙碌中/i.test(
    combined,
  );
}

const cases = [
  {
    id: "spec-rule",
    title: "一般規格/RULE",
    question: "S27FG532EC 的解析度、更新率、面板是什麼？",
    requireLlm: true,
    check(reply, logs) {
      return {
        pass:
          hasAll(reply, [/S27FG532EC/i, /QHD|2560\s*x\s*1440/i, /200\s*Hz/i, /IPS/i, /\[來源:\s*規格庫\]/]) &&
          hasRealLlmLog(logs) &&
          hasNoHardFailure(logs, reply),
        reason: "需回答 QHD/200Hz/IPS 並標註規格庫來源",
      };
    },
  },
  {
    id: "compare-rule",
    title: "規格比較/RULE",
    question: "請比較 S27DG502EC 和 S27FG532EC 的差異，重點列出適合誰",
    requireLlm: true,
    check(reply, logs) {
      return {
        pass:
          hasAll(reply, [/S27DG502EC/i, /S27FG532EC/i, /180\s*Hz/i, /200\s*Hz/i, /\[來源:\s*規格庫\]/]) &&
          hasRealLlmLog(logs) &&
          hasNoHardFailure(logs, reply),
        reason: "需比較兩台並分別提到 180Hz/200Hz",
      };
    },
  },
  {
    id: "qa-gyro",
    title: "QA庫命中/M8 M9",
    question: "M8 和 M9 有陀螺儀和 HAS 嗎？畫面會跟著轉嗎？",
    requireLlm: true,
    check(reply, logs) {
      return {
        pass:
          hasAll(reply, [/M8/i, /M9/i, /陀螺儀/, /HAS/i, /自動|跟著|切換/, /\[來源:\s*QA\]/]) &&
          hasRealLlmLog(logs) &&
          hasNoHardFailure(logs, reply),
        reason: "需命中 QA，說明陀螺儀、HAS 與畫面旋轉",
      };
    },
  },
  {
    id: "qa-reality-hub",
    title: "QA庫命中/Odyssey 3D",
    question: "Odyssey 3D Reality Hub 可以用 Mac 嗎？連接方式要注意什麼？",
    requireLlm: true,
    check(reply, logs) {
      return {
        pass:
          hasAll(reply, [/Mac/i, /不支援|不能|不行/, /Windows/i, /DisplayPort|DP|HDMI\s*2\.1/i, /USB/i, /\[來源:\s*QA\]/]) &&
          hasRealLlmLog(logs) &&
          hasNoHardFailure(logs, reply),
        reason: "需命中 QA，指出 Mac 不支援、Windows 與連接方式",
      };
    },
  },
  {
    id: "campaign-steam",
    title: "本檔促銷/RULE Steam",
    question: "S27HG806EF 本期三星螢幕登錄活動送什麼？",
    requireLlm: true,
    check(reply, logs) {
      const blockedByTimelyGuard = /\[Force Web Intent|即時資訊路由|我不能用舊資料直接下結論/.test(
        `${logs}\n${reply}`,
      );
      return {
        pass:
          hasAll(reply, [/S27HG806EF/i, /Steam/i, /1,?000\s*元?點卡/i, /\[來源:\s*規格庫\]/]) &&
          !blockedByTimelyGuard &&
          hasRealLlmLog(logs) &&
          hasNoHardFailure(logs, reply),
        reason: "需用本地活動 RULE 回答 Steam 1,000 元點卡，不可被時效守門擋下",
      };
    },
  },
  {
    id: "campaign-warranty",
    title: "本檔促銷/RULE 延長保固",
    question: "S34BG850SC 本期登錄活動有什麼資格或贈品？",
    requireLlm: true,
    check(reply, logs) {
      const blockedByTimelyGuard = /\[Force Web Intent|即時資訊路由|我不能用舊資料直接下結論/.test(
        `${logs}\n${reply}`,
      );
      return {
        pass:
          hasAll(reply, [/S34BG850SC/i, /延長保固|保固兩年|兩年保固/, /Galaxy\s*S26|月月抽/i, /\[來源:\s*規格庫\]/]) &&
          !blockedByTimelyGuard &&
          hasRealLlmLog(logs) &&
          hasNoHardFailure(logs, reply),
        reason: "需用本地活動 RULE 回答延長保固與月月抽資格，不可被時效守門擋下",
      };
    },
  },
  {
    id: "price-web",
    title: "價格/官方頁導向",
    question: "S34BG850SC 多少錢？",
    requireLlm: false,
    check(reply, logs) {
      return {
        pass:
          /https:\/\/www\.samsung\.com\/tw\/search\/\?searchvalue=S34BG850SC/i.test(reply) &&
          /\[Price Guard/.test(logs) &&
          hasNoHardFailure(logs, reply),
        reason: "價格題不得報價，需導三星官方搜尋頁並保留完整型號",
      };
    },
  },
  {
    id: "alias-manual-selection",
    title: "短別稱手冊防呆與選型後查PDF",
    question: "#查手冊 G5 怎麼重置？",
    requireLlm: false,
    check(reply, logs) {
      const combined = `${reply}\n${logs}`;
      return {
        pass:
          /請選擇 G5 完整型號|請先選完整型號|型號選擇泡泡/.test(combined) &&
          !/已鎖定直通車型號: G5|載入 PDF: G5/i.test(logs) &&
          hasNoHardFailure(logs, reply),
        reason: "G5 只有別稱時必須先列完整型號讓使用者選，不可直接查 PDF",
      };
    },
    followUp: {
      question: "#型號:S27DG502EC",
      check(reply, logs) {
        return {
          pass:
            hasAll(reply, [/S27DG502EC/i, /出廠資料重設|出廠預設值|安全\s*PIN/i, /\[來源:.*官方手冊PDF.*\]/]) &&
            /AttachPDFs:\s*true|PDF 匹配|官方手冊PDF|Files API/i.test(logs) &&
            hasRealLlmLog(logs) &&
            hasNoHardFailure(logs, reply),
          reason: "選定 S27DG502EC 後必須繼續掛載 PDF，回答出廠資料重設步驟並標註官方手冊PDF",
        };
      },
    },
  },
  {
    id: "factory-reset-auto-pdf",
    title: "恢復出廠自動查PDF",
    question: "S32FM703如何恢復出廠",
    requireLlm: true,
    check(reply, logs) {
      return {
        pass:
          hasAll(reply, [/S32FM703/i, /設定|所有設定/i, /一般與隱私權/i, /出廠資料重設|出廠預設值/i, /安全\s*PIN|PIN/i, /\[來源:.*S32FM702,S32FM703,S32FM803\.pdf.*官方手冊PDF.*\]/]) &&
          /Fast 回答不足|AUTO_SEARCH_PDF|AttachPDFs:\s*true|載入 PDF|官方手冊PDF|Files API/i.test(logs) &&
          hasRealLlmLog(logs) &&
          hasNoHardFailure(logs, reply),
        reason: "一般恢復出廠題不可停在 PIN 忘記 QA，需自動掛載 S32FM703 官方手冊PDF回答一般出廠資料重設路徑",
      };
    },
  },
  {
    id: "unknown-web-offer",
    title: "查無資料/詢問是否WEB",
    question: "三星 2027 年 Odyssey G10 台灣上市日期是什麼時候？",
    requireLlm: true,
    check(reply, logs) {
      return {
        pass:
          hasAny(reply, [/查無|沒有相關資訊|無資料|需要.*網路|擴大搜尋|官方資料庫中目前查無/]) &&
          !hasAny(reply, [/2027\/\d+\/\d+|2027年\d+月\d+日|已上市|即將上市日期是/]) &&
          hasRealLlmLog(logs) &&
          hasNoHardFailure(logs, reply),
        reason: "未知未來上市題不可編日期，需誠實查無並詢問是否擴大搜尋",
      };
    },
  },
];

async function run() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });
  const frame = await findFrame(page);
  if (!frame) throw new Error("TestUI frame not found");

  const runId = `REAL10_${Date.now()}`;
  const records = [];
  let allPass = true;

  for (let i = 0; i < cases.length; i++) {
    const testCase = cases[i];
    const userId = `${runId}_${String(i + 1).padStart(2, "0")}_${testCase.id}`;

    await call(frame, "clearTestSession", userId);
    const res = await call(frame, "testMessage", testCase.question, userId);
    const reply = textOf(res, "replies");
    const logs = textOf(res, "logs");
    const check = testCase.check(reply, logs);
    let pass = !!check.pass;
    const followUps = [];
    if (pass && testCase.followUp) {
      const followRes = await call(frame, "testMessage", testCase.followUp.question, userId);
      const followReply = textOf(followRes, "replies");
      const followLogs = textOf(followRes, "logs");
      const followCheck = testCase.followUp.check(followReply, followLogs);
      const followPass = !!followCheck.pass;
      pass = pass && followPass;
      followUps.push({
        question: testCase.followUp.question,
        pass: followPass,
        reason: followCheck.reason,
        reply: followReply,
        logs: followLogs.split("\n").filter(Boolean),
      });
    }
    if (!pass) allPass = false;

    const record = {
      index: i + 1,
      id: testCase.id,
      title: testCase.title,
      question: testCase.question,
      pass,
      requireLlm: testCase.requireLlm,
      reason: check.reason,
      reply,
      logs: logs.split("\n").filter(Boolean),
      followUps,
    };
    records.push(record);

    console.log("\n====================================");
    console.log(`CASE ${record.index} | ${pass ? "PASS" : "FAIL"} | ${record.title}`);
    console.log(`Q: ${record.question}`);
    console.log(`requireLlm=${record.requireLlm}, realLlmLog=${hasRealLlmLog(logs)}`);
    console.log(`check: ${record.reason}`);
    console.log("A:");
    console.log(reply);

    for (let j = 0; j < followUps.length; j++) {
      console.log(`\nFOLLOW-UP ${j + 1} | ${followUps[j].pass ? "PASS" : "FAIL"}`);
      console.log(`Q: ${followUps[j].question}`);
      console.log(`check: ${followUps[j].reason}`);
      console.log("A:");
      console.log(followUps[j].reply);
    }

    if (!pass) {
      console.log("---- Last logs ----");
      logs
        .split("\n")
        .filter(Boolean)
        .slice(-40)
        .forEach((line) => console.log(line));
      followUps
        .flatMap((item) => item.logs || [])
        .slice(-40)
        .forEach((line) => console.log(line));
    }

    await sleep(1200);
  }

  await browser.close();

  const logsDir = path.join(__dirname, "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  const outPath = path.join(
    logsDir,
    `verify_10_real_conversation_${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  fs.writeFileSync(
    outPath,
    JSON.stringify({ runId, testUrl: TEST_URL, cases: records }, null, 2),
    "utf8",
  );

  console.log("\n====================================");
  console.log(allPass ? "TOTAL: PASS" : "TOTAL: FAIL");
  console.log(`Report: ${outPath}`);
  console.log("====================================");

  if (!allPass) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("TEST ERROR:", error);
  process.exit(1);
});
