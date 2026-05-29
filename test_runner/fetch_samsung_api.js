const fs = require("fs");
const path = require("path");

const API_URL = "https://searchapi.samsung.com/v6/front/b2c/product/finder/global?type=07010000&siteCode=tw&start=1&num=100&sort=newest&onlyFilterInfoYN=N";

async function run() {
  console.log("正在請求三星官方 API: " + API_URL);
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const apiData = await response.json();
    const productList = apiData?.response?.resultData?.productList || [];
    
    console.log(`API 回傳了 ${productList.length} 個產品系列 (Family)`);
    
    const discoveredProducts = [];
    productList.forEach(family => {
      const modelList = family?.modelList || [];
      modelList.forEach(modelObj => {
        const sku = String(modelObj?.modelCode || "").trim().toUpperCase();
        let rawPdp = modelObj?.pdpUrl || modelObj?.originPdpUrl || "";
        if (rawPdp && !rawPdp.startsWith("http")) {
          rawPdp = "https://www.samsung.com" + (rawPdp.startsWith("/") ? "" : "/") + rawPdp;
        }
        // 去除 query 與 hash
        const qIdx = rawPdp.indexOf("?");
        if (qIdx !== -1) rawPdp = rawPdp.substring(0, qIdx);
        const hIdx = rawPdp.indexOf("#");
        if (hIdx !== -1) rawPdp = rawPdp.substring(0, hIdx);

        const displayName = String(modelObj?.displayName || modelObj?.modelName || family?.fmyMarketingName || "Samsung Monitor").trim();
        if (sku) {
          discoveredProducts.push({
            sku,
            displayName,
            pdp: rawPdp
          });
        }
      });
    });
    
    console.log(`共解析出 ${discoveredProducts.length} 個具體機型 (SKU)`);
    
    // 讀取本地的 CLASS_RULES.csv
    const csvPath = path.join(__dirname, "..", "CLASS_RULES.csv");
    let csvContent = fs.readFileSync(csvPath, "utf-8");
    const lines = csvContent.split("\n");
    
    const existingModels = [];
    lines.forEach(line => {
      const text = line.trim().toUpperCase();
      if (text.startsWith("LS")) {
        const match = text.match(/LS\d{2}[A-Z0-9]{3,20}XZW/i);
        if (match) {
          existingModels.push(match[0].toUpperCase());
        }
      }
    });
    
    console.log(`本地 CLASS_RULES.csv 中已存在的型號數 (LS...XZW): ${existingModels.length}`);
    
    // 開始比對
    const missingInCsv = [];
    discoveredProducts.forEach(p => {
      const sku = p.sku;
      const matchKey = sku.replace(/XZW$/, ""); // 統一比對鍵
      
      const isExisting = existingModels.some(existing => {
        const extKey = existing.replace(/XZW$/, "");
        return existing === sku || extKey === matchKey;
      });
      
      if (!isExisting) {
        missingInCsv.push(p);
      }
    });
    
    console.log(`\n🔍 比對結果：有 ${missingInCsv.length} 個型號在 CLASS_RULES.csv 中完全找不到！`);
    
    if (missingInCsv.length === 0) {
      console.log("🎉 本地與官網規格庫已完全同步，今日無新機型需要同步。");
      return;
    }

    // 格式化新機型資料
    const newLinesCsv = [];
    const newLinesGs = [];

    missingInCsv.forEach(p => {
      // CSV 格式：SKU,說明
      // 我們要把 displayName 和網址整理在說明中，逗號換成全形逗號防錯位
      const cleanName = p.displayName.replace(/,/g, "，");
      const csvLine = `${p.sku},型號：${cleanName}，規格網址： ${p.pdp} `;
      newLinesCsv.push(csvLine);

      // linebot.gs fullRules 陣列格式：雙引號包圍，後加逗號
      const gsLine = `        "${p.sku},型號：${cleanName}，規格網址： ${p.pdp} "`;
      newLinesGs.push(gsLine);
    });

    console.log(`\n正在將 ${missingInCsv.length} 款新機型寫入 CLASS_RULES.csv...`);
    // 移除 CSV 尾端多餘的空白行，並將新行以 \n 串接追加
    let cleanCsvContent = csvContent.trim();
    cleanCsvContent += "\n" + newLinesCsv.join("\n") + "\n";
    fs.writeFileSync(csvPath, cleanCsvContent, "utf-8");
    console.log("CLASS_RULES.csv 寫入完成！");

    // 寫入 linebot.gs 的 fullRules 中
    const gsPath = path.join(__dirname, "..", "linebot.gs");
    console.log(`正在將新機型同步寫入 linebot.gs 的 fullRules 陣列中...`);
    let gsContent = fs.readFileSync(gsPath, "utf-8");

    // 定位到 LS32FM501ECXZW
    const targetKey = `"LS32FM501ECXZW,型號：S32FM501EC,32吋 Smart Monitor M5 智慧聯網螢幕 M50F,32吋16:9 VA平面螢幕,FHD(1920x1080)解析度,最大60Hz更新頻率,4ms(GtG)反應時間,亮度典型250 cd/㎡/最小200 cd/㎡,原生對比3000:1(Typ),HDR10,178°寬廣視角,1670萬色彩支援,低藍光模式,零閃屏,影像尺寸調整,智慧偵測環境光源(Adaptive Picture),自動來源切換+,Tizen™作業系統,SmartThings支援,行動裝置鏡射,Wireless Display,WiFi5與藍牙5.2,介面：HDMI 2.0 x2、USB 2.0 x2,內建立體聲喇叭,前後傾斜-2.0°~22.0°,VESA 100x100mm壁掛,電源AC 100~240V內置電源,最大耗電50W,尺寸含底座716.1x517.0x193.5mm,不含底座716.1x424.5x41.8mm,包裝尺寸842x133x487mm,重量含底座6.2kg,不含底座5.0kg,包裝重量8.0kg,配件電源線、HDMI線、遙控器"`;
    
    if (gsContent.includes(targetKey)) {
      // 把 targetKey 改為加上逗號，後面接上新產生的 gsLines，且最後一行不要有逗號
      const replacement = targetKey + ",\n" + newLinesGs.join(",\n");
      gsContent = gsContent.replace(targetKey, replacement);
      
      // 更新版本號與 timestamp
      const prevVersion = 'const GAS_VERSION = "v29.5.229";';
      const newVersion = 'const GAS_VERSION = "v29.5.230";';
      gsContent = gsContent.replace(prevVersion, newVersion);

      const d = new Date();
      const p = (n) => String(n).padStart(2, "0");
      const nowStr = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
      const prevTimestamp = /const BUILD_TIMESTAMP = ".*";/;
      gsContent = gsContent.replace(prevTimestamp, `const BUILD_TIMESTAMP = "${nowStr}";`);

      fs.writeFileSync(gsPath, gsContent, "utf-8");
      console.log(`linebot.gs 寫入與版本號更新為 v29.5.230 完成！`);
    } else {
      console.error("❌ 找不到 linebot.gs 中的基準定位行，無法自動寫入！");
    }

  } catch (error) {
    console.error("執行出錯:", error);
  }
}

run();
