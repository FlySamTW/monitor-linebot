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

function inferRouteFromLogs(logs) {
  const rows = (logs || []).map((x) => String(x));
  const hasWeb =
    rows.some((x) => /AUTO_SEARCH_WEB|網路搜尋|Pass 2 \(Web\)|forceWebSearch/i.test(x)) ||
    rows.some((x) => /\[Command\].*Pass 2/i.test(x));
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

async function findUiFrame(page) {
  await new Promise((r) => setTimeout(r, 4000));
  for (const f of page.frames()) {
    const input = await f.$("#msg-input").catch(() => null);
    if (input) return f;
  }
  return null;
}

async function main() {
  const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, "utf8"));
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });
    const frame = await findUiFrame(page);
    if (!frame) throw new Error("TestUI frame not found");

    const call = (fn, ...args) =>
      frame.evaluate(
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

    const results = [];
    const runId = `TEST_ROUTE_17_${Date.now()}`;

    for (const item of dataset) {
      const userId = `${runId}_${String(item.id).padStart(2, "0")}`;
      await call("clearTestSession", userId);
      await call("testMessage", "/重啟", userId);
      const res = await call("testMessage", item.user_question, userId);
      const logs = Array.isArray(res && res.logs) ? res.logs : [];
      const replies = Array.isArray(res && res.replies) ? res.replies : [];
      const actual = inferRouteFromLogs(logs);
      const pass = actual === item.expected_route;

      results.push({
        id: item.id,
        expected_route: item.expected_route,
        actual_route: actual,
        pass,
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

