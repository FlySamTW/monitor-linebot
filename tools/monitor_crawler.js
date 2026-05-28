const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// 預設參數與配置
const CONFIG = {
  CSV_PATH: path.join(__dirname, "../CLASS_RULES.csv"),
  MONITOR_LIST_URL: "https://www.samsung.com/tw/monitors/all-monitors/",
  WEBHOOK_URL: "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec",
  GEMINI_MODEL: "models/gemini-2.0-flash", // 推薦使用快速且穩定的 2.0-flash
  DRY_RUN: false
};

// 輔助函式：載入目前已有的型號
function getExistingModels() {
  if (!fs.existsSync(CONFIG.CSV_PATH)) {
    console.log(`[Warning] 找不到本地 CSV: ${CONFIG.CSV_PATH}，將視為空規格庫`);
    return [];
  }
  const content = fs.readFileSync(CONFIG.CSV_PATH, "utf-8");
  const models = [];
  const lines = content.split("\n");
  lines.forEach(line => {
    const parts = line.split(",");
    if (parts[0]) {
      const raw = parts[0].trim().toUpperCase();
      // 只要是 LS 開頭的型號即為螢幕實體型號
      if (raw.startsWith("LS")) {
        models.push(raw.replace(/XZW$/, "")); // 統一去掉後綴以便比對
      }
    }
  });
  console.log(`[Setup] 自本地規格庫載入 ${models.length} 組現有機型`);
  return models;
}

// 輔助函式：追加寫入本地 CSV
function appendToLocalCsv(newLine) {
  try {
    fs.appendFileSync(CONFIG.CSV_PATH, "\n" + newLine, "utf-8");
    console.log(`[Local CSV] 成功追加寫入新規格至 CLASS_RULES.csv`);
  } catch (e) {
    console.error(`[Local CSV Error] 追加寫入失敗: ${e.message}`);
  }
}

// 調用 Gemini API 進行去蕪存菁
async function askGeminiToRefine(apiKey, specsText, url) {
  console.log(`[Gemini AI] 正在調用 Gemini 對齊規格...`);
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${CONFIG.GEMINI_MODEL}:generateContent?key=${apiKey}`;
  
  const prompt = `
你是三星電腦顯示器規格對齊與提取專家。
任務：
請閱讀以下三星螢幕產品詳情頁的雜亂宣傳與細部規格文字，將其去蕪存菁，提取出核心有用規格，並輸出為「一整行 CSV 格式的規格行」。

必須遵守的規則：
1. 第一部分必須是完整型號後綴大寫，格式為：LS[型號]XZW，例如：LS32DG802SCXZW
2. 第二部分必須以「型號：S[型號]」開始，例如：型號：S32DG802SC
3. 第三部分是中文品名與詳細硬體規格。
4. 【超級重要】所有規格特徵必須以半形逗號「,」分隔，絕對不可以有任何換行或多餘的引號！
5. 規格順序請高度對齊三星經典格式，依序包含：[尺寸面板比例] [解析度/更新率] [亮度/對比/HDR] [反應時間/可視角/色彩/色域] [特色功能: FreeSync/G-Sync/護眼] [自動來源切換/電競UX/PBP-PIP] [Tizen智慧系統/智慧功能] [傳輸介面: DP/HDMI/Type-C/USB Hub] [人體工學與安裝: HAS高度/前後傾斜/左右旋轉/垂直旋轉/VESA壁掛] [電源與耗電/機身尺寸/淨重/配件]。
6. 不要編造任何規格，僅根據以下給予的網頁內容提取。

經典格式範例：
LS32DG802SCXZW,型號：S32DG802SC,32吋Odyssey OLED G8 平面電競顯示器 G80SD,32吋16:9 OLED平面螢幕,4K UHD(3840x2160),亮度典型250 cd㎡/最低200 cd㎡,原生對比1,000,000:1,動態對比Mega DCR,HDR10+ Gaming,更新頻率最高240Hz,反應時間0.03ms(GtG),可視角度178°(H)/178°(V),色彩支援10.7億色,色域覆蓋99%(CIE1976),低藍光模式,零閃屏,金屬量子點顯色技術,PIP/PBP多畫面分割,Windows 11認證,AMD FreeSync Premium Pro支援,G-Sync相容,Off Timer Plus,虛擬準心,Core Sync,Game Bar 2.0,HDMI-CEC,自動來源切換 Auto Source Switch+,智慧偵測環境光源,超寬遊戲螢幕支援,Tizen作業系統,Bixby語音助理,SmartThings Hub，多重視窗及遠端存取功能,WiFi5與藍牙5.2,10W立體聲喇叭,Adaptive Sound Pro智慧音效,操作溫度0~40℃,濕度10~80%,銀色機身與HAS PIVOT底座(120mm高),前後傾斜-2°~25°,左右旋轉-30°~+30°,垂直旋轉-92°~+92°,VESA壁掛100x100mm,再生資源塑料含量,電源AC 100~240V外接變壓器,最大耗電180W,尺寸含底座719.7x584.6x263.5mm,不含底座719.7x414.7x49.2mm,包裝尺寸815x200x530mm,重量含底座8.4kg,不含底座5.3kg,包裝重量12.0kg,配件含1.5m電源線、HDMI線、DP線、USB 3.0線及太陽能智慧遙控器。

待處理的網頁規格內容：
---
產品網址: ${url}
${specsText}
---

請直接輸出最終的 CSV 單行文字，不要包含 \`\`\`csv 或 \`\`\` 標記，也不要有任何前導或後續文字。
`;

  try {
    const res = await axios.post(apiUrl, {
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1, // 低溫度以保證精確性
        maxOutputTokens: 2000
      }
    });

    const resultText = res.data.candidates[0].content.parts[0].text || "";
    return resultText.trim().replace(/\n/g, ""); // 保證絕對單行
  } catch (e) {
    console.error(`[Gemini Error] 調用失敗: ${e.message}`);
    throw e;
  }
}

// 主執行流程
async function run() {
  const args = process.argv.slice(2);
  const apiKeyArg = args.find(a => a.startsWith("--api-key="));
  const webhookArg = args.find(a => a.startsWith("--webhook-url="));
  const dryRunArg = args.find(a => a === "--dry-run");

  const GEMINI_API_KEY = apiKeyArg ? apiKeyArg.split("=")[1] : process.env.GEMINI_API_KEY;
  const WEBHOOK_URL = webhookArg ? webhookArg.split("=")[1] : CONFIG.WEBHOOK_URL;
  CONFIG.DRY_RUN = !!dryRunArg;

  if (!GEMINI_API_KEY && !CONFIG.DRY_RUN) {
    console.error("❌ 錯誤: 必須提供 --api-key=<GEMINI_API_KEY> 參數或設置 GEMINI_API_KEY 環境變數！");
    process.exit(1);
  }

  console.log("==========================================");
  console.log("🚀 三星台灣官網新機型比對與自動維護 AI 爬蟲");
  console.log(`👉 Webhook: ${WEBHOOK_URL}`);
  console.log(`👉 Mode: ${CONFIG.DRY_RUN ? "🔍 僅模擬 (Dry Run)" : "⚡ 真實同步 (Active)"}`);
  console.log("==========================================");

  const existingModels = getExistingModels();
  
  console.log("[Crawler] 正在啟動 Puppeteer 瀏覽器...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  try {
    console.log(`[Crawler] 正在導航至官網總覽頁: ${CONFIG.MONITOR_LIST_URL}`);
    await page.goto(CONFIG.MONITOR_LIST_URL, { waitUntil: "networkidle2", timeout: 60000 });

    // 模擬動態向下滾動以加載全頁 Lazy-load 的螢幕卡片
    console.log("[Crawler] 正在進行網頁動態加載比對...");
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1500)));
    }

    // 抓取頁面上所有產品連結，並解析型號
    const candidates = await page.evaluate(() => {
      const links = [];
      const anchors = Array.from(document.querySelectorAll("a"));
      anchors.forEach(a => {
        const href = a.href || "";
        const text = (a.innerText || "").trim().replace(/\n/g, " ");
        // 比對 URL 結尾，過濾出 LS 開頭與 xzw 結尾的型號
        const modelMatch = href.match(/-(ls\d+[a-z\d]+xzw)\/?$/i);
        if (modelMatch) {
          const modelName = modelMatch[1].toUpperCase();
          links.push({
            model: modelName,
            href: href,
            title: text
          });
        }
      });
      return links;
    });

    // 去重
    const uniqueCandidatesMap = new Map();
    candidates.forEach(c => uniqueCandidatesMap.set(c.model, c));
    const uniqueCandidates = Array.from(uniqueCandidatesMap.values());

    console.log(`[Crawler] 官網當前上架螢幕總數: ${uniqueCandidates.length} 款`);

    // 比對哪些是本地規格庫沒有的「新機型」
    const newProducts = uniqueCandidates.filter(c => {
      const matchKey = c.model.replace(/XZW$/, ""); // 統一比對鍵
      return !existingModels.includes(matchKey);
    });

    console.log(`[Compare] 🔍 比對完成！發現新上架機型共: ${newProducts.length} 款`);
    newProducts.forEach((p, idx) => {
      console.log(`   [${idx + 1}] 型號: ${p.model} -> ${p.href}`);
    });

    if (newProducts.length === 0) {
      console.log("[Done] 🎉 本地與官網規格庫已完全同步，今日無新上架機型。");
      return;
    }

    // 對於每款新機型，導航詳情頁並進行規格整理
    for (let i = 0; i < newProducts.length; i++) {
      const prod = newProducts[i];
      console.log(`\n------------------------------------------`);
      console.log(`[Process ${i + 1}/${newProducts.length}] 正在處理新產品: ${prod.model}`);
      console.log(`------------------------------------------`);
      
      console.log(`[Details] 正在加載產品詳情頁: ${prod.href}`);
      await page.goto(prod.href, { waitUntil: "networkidle2", timeout: 60000 });
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 5000)));

      // 1. 複製全頁規格文字
      const detailsText = await page.evaluate(() => document.body.innerText);
      
      // 2. 尋找手冊下載連結 (PDF)
      const downloadInfo = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a"));
        // 優先找 CDCttType=UM 且包含 _ZW 繁體中文手冊的 pdf 下載
        let bestLink = null;
        for (const a of anchors) {
          const href = a.href || "";
          const text = (a.innerText || "").trim().toLowerCase();
          
          if (href.toLowerCase().includes(".pdf")) {
            if (href.includes("CDCttType=UM") && (href.includes("_ZW_") || href.includes("_ZW"))) {
              return { text: a.innerText, href: href }; // 最完美匹配
            }
            if (!bestLink || text.includes("下載") || text.includes("manual")) {
              bestLink = { text: a.innerText, href: href };
            }
          }
        }
        return bestLink;
      });

      console.log(`[Details] 複製網頁文字長度: ${detailsText.length} 字`);
      if (downloadInfo) {
        console.log(`[Details] 🎯 找到產品繁體中文使用手冊連結: ${downloadInfo.href}`);
      } else {
        console.log(`[Details] ⚠️ 未能找到該機型專屬的 PDF 手冊連結`);
      }

      // 3. 調用 Gemini AI 整理去蕪存菁
      let refinedCsvRow = "";
      if (CONFIG.DRY_RUN) {
        console.log(`[AI DryRun] 模擬發送 specsText 至 Gemini`);
        refinedCsvRow = `${prod.model},型號：${prod.model.replace(/XZW$/, "")},[模擬] 三星新機型 ${prod.model.replace(/XZW$/, "")} 27吋平面顯示器,QHD,180Hz,IPS面板,Type-C,HAS支架`;
      } else {
        refinedCsvRow = await askGeminiToRefine(GEMINI_API_KEY, detailsText.substring(0, 15000), prod.href);
      }

      console.log(`[AI Refined Output]:\n${refinedCsvRow}`);

      // 4. 下載手冊 PDF 並透過 Webhook 上傳 (Active Mode 且有下載連結時)
      let googleDriveFileId = null;
      if (downloadInfo && !CONFIG.DRY_RUN) {
        console.log(`[PDF Download] 正在下載手冊 PDF...`);
        try {
          const pdfRes = await axios.get(downloadInfo.href, { responseType: "arraybuffer" });
          const pdfBase64 = Buffer.from(pdfRes.data).toString("base64");
          const fileName = `${prod.model.replace(/XZW$/, "")}_User_Manual_ZW.pdf`;
          
          console.log(`[PDF Upload] 正在透過 Webhook 上傳 PDF 至 Google Drive...`);
          const uploadRes = await axios.post(WEBHOOK_URL, {
            action: "upload_manual_pdf",
            secret: GEMINI_API_KEY,
            fileName: fileName,
            pdfBase64: pdfBase64
          });

          if (uploadRes.data && uploadRes.data.success) {
            googleDriveFileId = uploadRes.data.fileId;
            console.log(`[PDF Upload] ✅ 上傳成功！Google Drive 檔案 ID: ${googleDriveFileId}`);
          } else {
            console.warn(`[PDF Upload Warning] Webhook 上傳失敗: ${uploadRes.data.error}`);
          }
        } catch (err) {
          console.error(`[PDF Error] 下載或上傳失敗: ${err.message}`);
        }
      }

      // 5. 透過 Webhook 寫入雲端 Sheet A 欄末行
      if (!CONFIG.DRY_RUN) {
        console.log(`[Sheet Sync] 正在透過 Webhook 寫入新規格列至 Google Sheet...`);
        try {
          const syncRes = await axios.post(WEBHOOK_URL, {
            action: "append_class_rule",
            secret: GEMINI_API_KEY,
            content: refinedCsvRow
          });

          if (syncRes.data && syncRes.data.success) {
            console.log(`[Sheet Sync] ✅ 成功寫入 Google Sheet！ 狀態: ${syncRes.data.sync}`);
            // 6. 同步寫入本地 CSV
            appendToLocalCsv(refinedCsvRow);
          } else {
            console.error(`[Sheet Sync Error] 寫入失敗: ${syncRes.data.error}`);
          }
        } catch (err) {
          console.error(`[Sheet Sync Error] Webhook 呼叫失敗: ${err.message}`);
        }
      } else {
        console.log(`[DryRun Done] 新規格模擬處理完成`);
      }
    }

    console.log(`\n==========================================`);
    console.log(`🎉 [Success] 所有新機型處理完畢，規格庫與手冊同步成功！`);
    console.log(`==========================================`);

  } catch (e) {
    console.error("❌ 執行過程出錯:", e);
  } finally {
    await browser.close();
  }
}

run();
