const puppeteer = require("puppeteer");
const https = require("https");

const TEST_URL = "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?test=1";
const INDEX_URL = "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?pdfIndex=1";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchIndex(targetUrl) {
  return new Promise((resolve, reject) => {
    https.get(targetUrl, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        fetchIndex(res.headers.location).then(resolve).catch(reject);
      } else {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }
    }).on("error", reject);
  });
}

async function run() {
  console.log("Launching browser to trigger rebuild...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  try {
    console.log(`Navigating to ${TEST_URL}`);
    await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });

    let frame = null;
    for (let i = 0; i < 10; i++) {
      await sleep(2000);
      for (const f of page.frames()) {
        try {
          if (await f.$("#msg-input")) {
            frame = f;
            break;
          }
        } catch (_) {}
      }
      if (frame) break;
    }

    if (!frame) throw new Error("Frame not found");

    const userId = "REBUILD_TEST_" + Date.now();
    console.log("Sending /重啟 command...");
    await frame.evaluate(
      (uid) =>
        new Promise((resolve, reject) => {
          google.script.run
            .withSuccessHandler((res) => resolve(res))
            .withFailureHandler((err) => reject(err))
            .testMessage("/重啟", uid);
        }),
      userId,
    );

    console.log("Rebuild scheduled. Waiting 70 seconds for background sync task to complete...");
    await sleep(70000);

    console.log("Sync finished. Querying pdfIndex=1...");
    const indexData = await fetchIndex(INDEX_URL);
    console.log("INDEX DATA RETRIEVED:\n", indexData);

    const index = JSON.parse(indexData);
    const hasCurve = index.includes("LC34G55T") || index.includes("C34G55T") || index.includes("LC34G55TWWCXZW");
    if (hasCurve) {
      console.log("SUCCESS: Curved G5 monitor model successfully found in PDF index!");
    } else {
      console.log("FAILURE: G5 curve model not found in index yet. Check logs.");
    }

  } catch (e) {
    console.error("Failed:", e);
  } finally {
    await browser.close();
  }
}

run();
