const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const TEST_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";
const DATASET_PATH = path.join(
  __dirname,
  "datasets",
  "route_testset_17_single_v1.json",
);
const CALL_TIMEOUT_MS = Number(process.env.TESTUI_CALL_TIMEOUT_MS || 180000);

function parseSelectedIds(argv) {
  const raw = argv
    .flatMap((x) => String(x || "").split(/[,，]/))
    .map((x) => x.trim())
    .filter(Boolean);
  if (raw.length === 0) return null;
  return new Set(raw.map((x) => Number(String(x).replace(/^Q/i, ""))));
}

function inferRoute(logs, replies) {
  const rows = (logs || []).map((x) => String(x));
  const replyText = (replies || []).join("\n");
  if (/請直接回覆完整型號|請補上完整型號|我需要先確認完整型號/i.test(replyText)) {
    return "ASK_MODEL";
  }

  const hasModelSelect =
    rows.some((x) => /型號選擇泡泡|準備顯示型號選擇泡泡|已送出型號選擇泡泡|保留型號選擇流程/i.test(x)) ||
    rows.some((x) => /model_select_mode|Model Select/i.test(x)) ||
    /已送出型號選擇泡泡|請先選完整型號|請先選型號/i.test(replyText);
  if (hasModelSelect) return "MODEL_SELECT";

  const hasWeb =
    rows.some((x) => /AUTO_SEARCH_WEB|網路搜尋|Pass 2 \(Web\)|forceWebSearch/i.test(x)) ||
    rows.some((x) => /\[Command\].*Pass 2/i.test(x)) ||
    rows.some((x) => /\[Force Web Intent|\[Price Guard|\[Scope Guard/i.test(x));
  const hasPdf =
    rows.some((x) => /AttachPDFs:\s*true/i.test(x)) ||
    rows.some((x) => /PDF Debug|Auto Deep|查手冊|Pass 1\.5 \(PDF\)/i.test(x));
  const hasFastOnly =
    rows.some((x) => /AttachPDFs:\s*false/i.test(x)) &&
    !hasPdf &&
    !hasWeb;

  if (hasWeb) return "WEB";
  if (hasPdf) return "PDF";
  if (hasFastOnly) return "QA";
  return "QA";
}

function isApiGuardedReply(replies) {
  return (replies || []).some((x) =>
    /目前請求過於頻繁|已達配額限制|暫時無法處理|網路搜尋服務暫時無法連線/i.test(
      String(x || ""),
    ),
  );
}

function hasFakeSourceOnApiGuard(replies) {
  const text = (replies || []).join("\n");
  return /\[來源:\s*(?:QA庫|官方規格庫|官方活動庫|官方手冊|網路搜尋|AI內建資料庫)\]/i.test(
    text,
  );
}

function hasPrematureManualReminder(replies) {
  return /再幫你查查「?官方產品手冊「?|如果以上資訊不夠.*查.*手冊/i.test(
    (replies || []).join("\n"),
  );
}

function hasInternalApiFailureText(replies) {
  return /升級付費方案|您的請求|AI\s*暫時無法處理/i.test(
    (replies || []).join("\n"),
  );
}

async function findUiFrame(page) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    for (const f of page.frames()) {
      const input = await f.$("#msg-input").catch(() => null);
      if (input) return f;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

async function main() {
  const selectedIds = parseSelectedIds(process.argv.slice(2));
  let dataset = JSON.parse(fs.readFileSync(DATASET_PATH, "utf8"));
  if (selectedIds) {
    dataset = dataset.filter((item) => selectedIds.has(Number(item.id)));
    if (dataset.length === 0) {
      throw new Error("No matching route-test cases for selected ids.");
    }
  }
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });
    const frame = await findUiFrame(page);
    if (!frame) throw new Error("TestUI frame not found");

    const call = (fn, ...args) => {
      const request = frame.evaluate(
        (name, argv) =>
          new Promise((resolve, reject) => {
            const runner = google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler(reject);
            runner[name](...argv);
          }),
        fn,
        args,
      );
      const timeout = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error(`${fn} timed out after ${CALL_TIMEOUT_MS}ms`)),
          CALL_TIMEOUT_MS,
        );
      });
      return Promise.race([request, timeout]);
    };

    const results = [];
    const runId = `TEST_ROUTE_17_${Date.now()}`;

    for (const item of dataset) {
      const userId = `${runId}_${String(item.id).padStart(2, "0")}`;
      console.log(`\nQ${item.id} RUN | expected=${item.expected_route}`);
      console.log(`Q${item.id} USER | ${item.user_question}`);
      await call("clearTestSession", userId);
      await call("testMessage", "/重啟", userId);
      const res = await call("testMessage", item.user_question, userId);
      const logs = Array.isArray(res && res.logs) ? res.logs : [];
      const replies = Array.isArray(res && res.replies) ? res.replies : [];
      let actual = inferRoute(logs, replies);
      const apiGuarded = isApiGuardedReply(replies);
      if (apiGuarded) {
        actual = "API_GUARDED";
      }
      const pass =
        (actual === item.expected_route ||
          (apiGuarded && item.accept_api_guarded === true && !hasFakeSourceOnApiGuard(replies))) &&
        !hasInternalApiFailureText(replies) &&
        !(
          (actual === "MODEL_SELECT" || actual === "ASK_MODEL") &&
          hasPrematureManualReminder(replies)
        );

      results.push({
        id: item.id,
        expected_route: item.expected_route,
        actual_route: actual,
        pass,
        api_guarded: apiGuarded,
        internal_api_failure_text: hasInternalApiFailureText(replies),
        premature_manual_reminder: hasPrematureManualReminder(replies),
        user_question: item.user_question,
        reply_preview: (replies[0] || "").slice(0, 200),
      });

      console.log(
        `Q${item.id} ${pass ? "PASS" : "FAIL"} | expected=${
          item.expected_route
        } actual=${actual}`,
      );
    }

    const passed = results.filter((r) => r.pass).length;
    const failed = results.length - passed;
    const summary = {
      total: results.length,
      passed,
      failed,
      pass_rate: `${((passed / results.length) * 100).toFixed(1)}%`,
    };

    const outDir = path.join(__dirname, "logs");
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .replace("Z", "");
    const outPath = path.join(outDir, `route_testset_17_single_${stamp}.json`);
    fs.writeFileSync(
      outPath,
      JSON.stringify({ summary, results }, null, 2),
      "utf8",
    );

    console.log("\n=== SUMMARY ===");
    console.log(summary);
    console.log(`report: ${outPath}`);

    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});
