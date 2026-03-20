const puppeteer = require("puppeteer");

const TEST_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";

function assertStep(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const userId = "TEST_LONG_ARTICLE_NON_PROJECT_007";

  try {
    await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 5000));

    let frame = null;
    for (const f of page.frames()) {
      const el = await f.$("#msg-input").catch(() => null);
      if (el) {
        frame = f;
        break;
      }
    }
    if (!frame) throw new Error("TestUI frame not found");

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

    const send = (msg) =>
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

    const longArticle = [
      "來源：https://example.com/cloud-ai-report-2026",
      "廣告：立即訂閱，解鎖完整分析。",
      "本文整理 2026 年全球雲端與 AI 基礎設施的趨勢，包含 GPU、CPU、NPU 的供應鏈變化與企業採購策略。",
      "多家資料中心業者在訓練叢集上調整網路拓樸，並比較 NVLink、Infiniband 與 Ethernet 的成本結構。",
      "文章也分析電動車與機器人公司如何共用大型模型推論平台，並評估散熱、機櫃密度、功耗效率。",
      "同時提到企業端對私有雲與混合雲部署的要求，重點放在資安、可觀測性、彈性擴縮與維運成本。",
      "延伸閱讀：更多雲端 AI 趨勢與市場預測。",
      "以上內容與汽車、雲端與資料中心產業相關，無特定消費性螢幕產品段落。",
    ].join("\n");

    await clearSession();
    await send("/重啟");

    const t = await send(longArticle);
    const text = (t.replies || []).join("\n");
    console.log(text);

    assertStep(text.includes("【重點摘要】"), "missing summary block");
    assertStep(text.includes("【去廣告原文】"), "missing cleaned-original block");
    assertStep(
      !/要不要進入 QA 編輯模式/.test(text),
      "non-project article should not trigger QA mode offer",
    );

    console.log("\nPASS: verify_long_article_non_project");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
});
