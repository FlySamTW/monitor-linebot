const puppeteer = require("puppeteer");

function hasPattern(lines, regex) {
  return (lines || []).some((l) => regex.test(String(l)));
}

function getContextRepairLine(logs) {
  return (logs || []).find((l) => String(l).includes("[Context Repair"));
}

function assertStep(ok, message) {
  if (!ok) {
    throw new Error(message);
  }
}

async function main() {
  const TEST_URL =
    "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";
  const userId = "TEST_FIX_17_POINTS_001";

  const turns = [
    "/重啟",
    "我的3d螢幕該如何開啟Odyssey hub",
    "#再詳細說明",
    "#搜網上其他解答",
    "我想找手冊上的答案",
    "剛剛那台",
    "Odyssey 3d",
    "#查手冊",
    "查手冊 S27FG900XC 開啟 Odyssey Hub",
    "我想查手冊 S27FG900XC 開啟 Odyssey Hub",
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
              .clearTestSession(uid);
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
              .testMessage(m, uid);
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

    const t2 = all[1];
    const t3 = all[2];
    const t4 = all[3];
    const t5 = all[4];
    const t6 = all[5];
    const t7 = all[6];
    const t8 = all[7];
    const t9 = all[8];
    const t10 = all[9];

    const missingPdfRegex = /找不到相關.*PDF.*手冊|看起來像需要查手冊/;

    // 1~3: QA-first 行為
    assertStep(
      hasPattern(t2.logs, /先走 Fast Mode/) && hasPattern(t2.logs, /AttachPDFs:\s*false/),
      "01-02 failed: 首輪未維持 QA-first Fast Mode。",
    );
    assertStep(
      !hasPattern(t2.replies, missingPdfRegex) && !hasPattern(t2.logs, missingPdfRegex),
      "03 failed: 首輪仍掉到『找不到 PDF』回覆。",
    );

    // 4~7: 再詳細 + 搜網上上下文修復
    assertStep(
      hasPattern(t3.logs, /Quick Reply .*再詳細說明/) &&
        hasPattern(t3.logs, /Signal Check.*PDF暗號:false.*Web暗號:false/),
      "04 failed: #再詳細說明 仍誤觸 PDF/Web 暗號流程。",
    );
    assertStep(
      hasPattern(t4.logs, /Quick Reply .*搜網上其他解答/),
      "05 failed: #搜網上其他解答 指令未正確攔截。",
    );
    const repairLine = String(getContextRepairLine(t4.logs) || "");
    assertStep(
      !!repairLine &&
        !/請針對你剛才的回答再詳細說明|暗號|to check manuals/i.test(repairLine) &&
        /Odyssey|3d/i.test(repairLine),
      "06-07 failed: Context Repair 仍被模板污染，或未還原到原始主題。",
    );

    // 8~10: 自然語句「我想找手冊上的答案」應直接轉手冊流程
    assertStep(
      hasPattern(t5.logs, /自然語句轉換為手冊指令/) &&
        hasPattern(t5.logs, /查手冊，問題:/),
      "08-09 failed: 自然語句未轉為手冊流程。",
    );
    assertStep(
      !hasPattern(t5.replies, missingPdfRegex) && !hasPattern(t5.logs, missingPdfRegex),
      "10 failed: 我想找手冊上的答案 仍掉到『找不到 PDF』。",
    );

    // 11~13: 延續問句不該失憶
    assertStep(
      !hasPattern(t6.replies, missingPdfRegex) && !hasPattern(t6.logs, missingPdfRegex),
      "11 failed: 『剛剛那台』仍失憶。",
    );
    assertStep(
      !hasPattern(t7.replies, missingPdfRegex) && !hasPattern(t7.logs, missingPdfRegex),
      "12 failed: 『Odyssey 3d』仍誤判找不到 PDF。",
    );
    assertStep(
      hasPattern(t7.logs, /命中直通車|保留既有型號記憶|可查手冊但 Fast Mode 誤判/),
      "13 failed: Odyssey 3D 別稱記憶保留機制未生效。",
    );

    // 14~15: #查手冊 明確流程
    assertStep(
      hasPattern(t8.logs, /查手冊，問題:/) && hasPattern(t8.logs, /PDF 匹配:\s*\d+\s*個檔案/),
      "14 failed: #查手冊 未觸發 PDF 匹配流程。",
    );
    assertStep(
      hasPattern(t8.replies, /來源[:：].*手冊/) || hasPattern(t8.logs, /\[來源: .*手冊\]/),
      "15 failed: #查手冊 回覆未標示手冊來源。",
    );

    // 16~17: 自然語句查手冊（含 payload）可用
    assertStep(
      hasPattern(t9.logs, /自然語句轉換為手冊指令/) &&
        hasPattern(t9.logs, /#查手冊 S27FG900XC 開啟 ODYSSEY HUB/i),
      "16 failed: 『查手冊 S27FG900XC...』未正確轉換。",
    );
    assertStep(
      hasPattern(t10.logs, /自然語句轉換為手冊指令/) &&
        (hasPattern(t10.replies, /來源[:：].*手冊/) || hasPattern(t10.logs, /\[來源: .*手冊\]/)),
      "17 failed: 『我想查手冊 S27FG900XC...』未完成手冊回答。",
    );

    console.log("\nPASS: verify_17_points");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});

