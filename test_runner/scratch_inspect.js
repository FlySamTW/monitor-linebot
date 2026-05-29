const puppeteer = require("puppeteer");

async function run() {
  const url = "https://www.samsung.com/tw/monitors/high-resolution/s60a-24--24-inch-ips-uhd-4k-ls24a600nacxzw/";
  console.log("正在使用進階 DOM 解析器分析: " + url);
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    
    const extractedSpecs = await page.evaluate(() => {
      const results = {};
      
      // 三星官網規格排版通常在 .spec-table__row 或者是 table 中的 tr
      const rows = Array.from(document.querySelectorAll('.spec-table__row, tr, .spec-table__list-item'));
      rows.forEach(row => {
        // 如果是 .spec-table__row，通常裡面有兩個部分：規格項與規格值
        const text = row.innerText || "";
        const parts = text.split('\n').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          const key = parts[0];
          const val = parts[1]; // 取直接相鄰的值
          if (key && val && key.length < 50 && val.length < 300) {
            // 過濾一些廣告控制字元
            if (!results[key]) {
              results[key] = val;
            }
          }
        }
      });
      
      return results;
    });

    console.log("成功抓取到的完整 Key-Value 對數: ", Object.keys(extractedSpecs).length);
    console.log("完整規格詳情:\n", JSON.stringify(extractedSpecs, null, 2));

  } catch(err) {
    console.error("分析失敗:", err);
  } finally {
    await browser.close();
  }
}

run();
