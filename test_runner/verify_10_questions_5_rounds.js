const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const TEST_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";

const SCENARIOS = [
  { id: "smart_series_hevc", question: "Smart系列播放檔案有沒有支援hevc格式", model: "S32FM703" },
  { id: "m7_h265", question: "M7支援H.265影片檔嗎", model: "S32BM80" },
  { id: "smart_monitor_main10", question: "Smart Monitor USB播放支援HEVC Main10嗎", model: "S32AM703" },
  { id: "s32fm703_hevc", question: "S32FM703播放檔案支援HEVC嗎", model: "S32FM703" },
  { id: "s32bm80_h265", question: "S32BM80播放影片支援H.265嗎", model: "S32BM80" },
  { id: "s32am700_hevc", question: "S32AM700能播放HEVC影片嗎", model: "S32AM700" },
  { id: "m8_main10", question: "M8播放檔案支援H.265 Main10嗎", model: "S32BM80" },
  { id: "m5_hevc", question: "M5可以播放HEVC影片檔嗎", model: "S32AM500" },
  { id: "smart_screen_h265", question: "Smart螢幕支援H265影片格式嗎", model: "S27AM500" },
  { id: "s32fm803_hevc", question: "S32FM803支援HEVC影片嗎", model: "S32FM803" },
];

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
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          [f](...a);
      }),
    fnName,
    args,
  );
}

function joined(res, key) {
  const arr = Array.isArray(res && res[key]) ? res[key] : [];
  return arr.map((x) => String(x || "")).join("\n");
}

function hasSource(text) {
  return /\[來源[:：][^\]]+\]/.test(String(text || ""));
}

function hasCost(text) {
  const s = String(text || "");
  return (
    /\[費用\s*[:：]\s*NT\$[^\]]+\]/.test(s) ||
    /本次對話預估花費\s*[:：]?\s*\n?NT\$[0-9]+\.[0-9]{4}/.test(s)
  );
}

function addCheck(checks, pass, message, details = "") {
  checks.push({ pass: !!pass, message, details: pass ? "" : details.slice(0, 1200) });
}

function validateTurn({
  scenario,
  turnIndex,
  user,
  replies,
  logs,
  previousReplies = "",
  pdfReplies = "",
}) {
  const checks = [];
  const allText = `${replies}\n${logs}`;

  addCheck(checks, hasSource(replies), `Q${scenario.index}T${turnIndex} 回覆有來源`, replies);
  addCheck(checks, hasCost(replies), `Q${scenario.index}T${turnIndex} 回覆有費用`, replies);
  addCheck(
    checks,
    !/(\n|\s)\]\s*(\n|\s)*\[來源[:：]/.test(replies),
    `Q${scenario.index}T${turnIndex} 來源前不可殘留孤立右括號`,
    replies,
  );

  if (turnIndex === 1 || turnIndex === 2) {
    addCheck(
      checks,
      /請選擇 Smart Monitor PDF 型號/.test(replies),
      `Q${scenario.index}T${turnIndex} 先顯示 Smart Monitor 型號選擇`,
      replies,
    );
    addCheck(
      checks,
      /未呼叫 LLM/.test(replies) && !/AI Raw Response|PDF 匹配/.test(logs),
      `Q${scenario.index}T${turnIndex} 選型提示不呼叫 LLM/PDF`,
      allText,
    );
    addCheck(
      checks,
      !/所以可支援 HEVC|HEVC 編解碼器僅適用於 MKV|通常|常見|應該|Plex|Kodi/i.test(replies),
      `Q${scenario.index}T${turnIndex} 不輸出固定或推測答案`,
      replies,
    );
  }

  if (turnIndex === 3) {
    addCheck(checks, /PDF 匹配:\s*[1-9]/.test(logs), `Q${scenario.index}T3 已進 PDF 查證`, logs);
    addCheck(checks, new RegExp(scenario.model, "i").test(allText), `Q${scenario.index}T3 鎖定所選型號 ${scenario.model}`, allText);
    addCheck(
      checks,
      /支援[\s\S]{0,120}(HEVC|H\.265|H265)|(HEVC|H\.265|H265)[\s\S]{0,120}支援/i.test(replies) ||
        /(未|沒有|並未)[\s\S]{0,120}(支援|記載|列出)[\s\S]{0,120}(HEVC|H\.265|H265)/i.test(replies),
      `Q${scenario.index}T3 回答 HEVC/H.265 支援或未記載結果`,
      replies,
    );
    addCheck(checks, /\(官方手冊PDF\)/.test(replies), `Q${scenario.index}T3 使用官方手冊 PDF 來源`, replies);
    addCheck(checks, !/S27FG900XC|G90XF|S27FG502/i.test(logs), `Q${scenario.index}T3 不混入 Odyssey/G 系列錯誤候選`, logs);
    addCheck(checks, !/通常|常見|應該|Plex|Kodi/i.test(replies), `Q${scenario.index}T3 不推測手冊外內容`, replies);
  }

  if (turnIndex === 4) {
    addCheck(checks, !/通常|常見|應該|Plex|Kodi/i.test(replies), `Q${scenario.index}T4 不推測限制`, replies);
    addCheck(checks, /HEVC|H\.265|檔案|格式|未記載|未列出/i.test(replies), `Q${scenario.index}T4 有回應限制追問`, replies);
  }

  if (turnIndex === 5) {
    addCheck(checks, !/目前請求過於頻繁|已達配額限制|暫時無法處理/.test(replies), `Q${scenario.index}T5 沒有配額或暫時失敗`, replies);
    addCheck(checks, !/請針對你剛才的回答再詳細說明/.test(replies), `Q${scenario.index}T5 沒有洩漏系統提示`, replies);
    addCheck(checks, /HEVC|H\.265|檔案|格式|視訊編解碼器/i.test(replies), `Q${scenario.index}T5 延續 HEVC/PDF 主題`, replies);
    addCheck(
      checks,
      new RegExp(`延續上一則[\\s\\S]{0,80}${scenario.model}`, "i").test(replies),
      `Q${scenario.index}T5 沿用使用者選定型號 ${scenario.model}`,
      replies,
    );
    addCheck(
      checks,
      !/需要先確認完整型號|請直接回覆完整型號|不同型號的按鍵配置|操作步驟/.test(replies),
      `Q${scenario.index}T5 不得倒退要求補型號或轉成操作題`,
      replies,
    );
    const previousReply = previousReplies;
    const pdfReply = pdfReplies;
    if (
      /(支援[\s\S]{0,120}(HEVC|H\.265|H265))|((HEVC|H\.265|H265)[\s\S]{0,120}支援)/i.test(pdfReply) &&
      !/(並未|未|沒有)[\s\S]{0,80}(支援|記載|列出)[\s\S]{0,80}(HEVC|H\.265|H265)/i.test(pdfReply)
    ) {
      addCheck(
        checks,
        /支援[\s\S]{0,80}(HEVC|H\.265|H265)|(HEVC|H\.265|H265)[\s\S]{0,80}支援/i.test(replies) &&
          !/沒有確認到 HEVC／H\.265 支援結果/.test(replies),
        `Q${scenario.index}T5 不得把第三輪已確認支援改成未確認`,
        `T3:\n${pdfReply}\n\nT5:\n${replies}`,
      );
    }
    if (/(未(?:明確)?(?:列出|提及|記載)|未找到[\s\S]{0,20}明確列出)[\s\S]{0,120}(MKV|MP4|TS|檔案類型|限制)/.test(previousReply)) {
      addCheck(
        checks,
        /(未(?:明確)?(?:列出|提及|記載)|未找到[\s\S]{0,20}明確列出)[\s\S]{0,140}(MKV|MP4|TS|檔案類型|限制)/.test(replies) &&
          !/手冊列出的 HEVC 檔案類型限制包含 MKV、MP4、TS/.test(replies),
        `Q${scenario.index}T5 不得把上一輪「未列出限制」改寫成已列出 MKV/MP4/TS`,
        `T4:\n${previousReply}\n\nT5:\n${replies}`,
      );
    }
    if (
      !/(未(?:明確)?(?:列出|提及|記載)|未找到[\s\S]{0,20}明確列出)[\s\S]{0,120}(MKV|MP4|TS|檔案類型|限制)/.test(previousReply) &&
      /(明確|僅適用|僅支援|限制)[\s\S]{0,160}MKV[\s\S]{0,80}MP4[\s\S]{0,80}TS/.test(previousReply)
    ) {
      addCheck(
        checks,
        /手冊列出[\s\S]{0,120}MKV[\s\S]{0,80}MP4[\s\S]{0,80}TS/.test(replies),
        `Q${scenario.index}T5 必須保留上一輪已列出的 MKV/MP4/TS 限制`,
        `T4:\n${previousReply}\n\nT5:\n${replies}`,
      );
    }
  }

  return checks;
}

function summarizeRecord(records) {
  const lines = [];
  records.forEach((scenario) => {
    lines.push(`## Q${scenario.index}. ${scenario.question}（選型 ${scenario.model}）`);
    scenario.turns.forEach((turn) => {
      lines.push(`### T${turn.turnIndex} 使用者`);
      lines.push("```text");
      lines.push(turn.user);
      lines.push("```");
      lines.push(`### T${turn.turnIndex} Bot`);
      lines.push("```text");
      lines.push(turn.replies.trim() || "(無回覆)");
      lines.push("```");
      const failed = turn.checks.filter((c) => !c.pass);
      lines.push(`審核：${failed.length === 0 ? "通過" : `失敗 ${failed.length} 項`}`);
      failed.forEach((f) => lines.push(`- ${f.message}`));
      lines.push("");
    });
  });
  return lines.join("\n");
}

async function run() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const records = [];
  try {
    const page = await browser.newPage();
    await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });
    const frame = await findFrame(page);
    if (!frame) throw new Error("TestUI frame not found");

    for (let i = 0; i < SCENARIOS.length; i++) {
      const scenario = { ...SCENARIOS[i], index: i + 1 };
      const userId = `TEST_10Q5R_${Date.now()}_${i + 1}`;
      await call(frame, "clearTestSession", userId);
      const turns = [
        scenario.question,
        "#查手冊",
        `#型號:${scenario.model}`,
        "請確認檔案類型限制，不要推測",
        "#再詳細說明",
      ];
      const scenarioRecord = { ...scenario, userId, turns: [] };
      console.log(`\n=== Q${scenario.index}: ${scenario.question} / ${scenario.model} ===`);

      for (let t = 0; t < turns.length; t++) {
        const user = turns[t];
        const res = await call(frame, "testMessage", user, userId);
        const replies = joined(res, "replies");
        const logs = joined(res, "logs");
        const checks = validateTurn({
          scenario,
          turnIndex: t + 1,
          user,
          replies,
          logs,
          previousReplies: scenarioRecord.turns[t - 1]
            ? scenarioRecord.turns[t - 1].replies
            : "",
          pdfReplies: scenarioRecord.turns[2]
            ? scenarioRecord.turns[2].replies
            : "",
        });
        const failed = checks.filter((c) => !c.pass);
        console.log(`T${t + 1} USER: ${user}`);
        console.log(`T${t + 1} BOT: ${replies.replace(/\s+/g, " ").slice(0, 360)}`);
        console.log(`T${t + 1} REVIEW: ${failed.length === 0 ? "PASS" : `FAIL ${failed.length}`}`);
        failed.forEach((f) => console.log(`  - ${f.message}`));
        scenarioRecord.turns.push({
          turnIndex: t + 1,
          user,
          replies,
          logs,
          checks,
        });
      }
      records.push(scenarioRecord);
    }
  } finally {
    await browser.close();
  }

  const outDir = path.join(__dirname, "..", "logs");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `verify_10_questions_5_rounds_${stamp}.json`);
  const mdPath = path.join(outDir, `verify_10_questions_5_rounds_${stamp}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2), "utf8");
  fs.writeFileSync(mdPath, summarizeRecord(records), "utf8");

  const failures = [];
  records.forEach((scenario) => {
    scenario.turns.forEach((turn) => {
      turn.checks.filter((c) => !c.pass).forEach((check) => {
        failures.push({ scenario: scenario.index, turn: turn.turnIndex, message: check.message });
      });
    });
  });

  console.log(`\nRecord JSON: ${jsonPath}`);
  console.log(`Record MD  : ${mdPath}`);
  console.log(`Total turns: ${records.length * 5}`);
  console.log(`Failures   : ${failures.length}`);
  failures.forEach((f) => console.log(`- Q${f.scenario}T${f.turn}: ${f.message}`));

  if (failures.length > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
