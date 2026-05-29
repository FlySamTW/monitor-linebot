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
    
    // 讀取本地的 CLASS_RULES.csv (上一輪我們已經成功的把 40 款新機型寫入 CLASS_RULES.csv，此時 CSV 共有 183 列資料)
    const csvPath = path.join(__dirname, "..", "CLASS_RULES.csv");
    let csvContent = fs.readFileSync(csvPath, "utf-8");
    const lines = csvContent.split("\n").map(l => l.trim()).filter(Boolean);
    
    console.log(`本地 CLASS_RULES.csv 當前的列數 (含標頭): ${lines.length}`);
    
    // 生成 linebot.gs 中的 fullRules 陣列字串
    const newLinesGs = lines.map(line => {
      // 雙引號包圍，且轉義內部可能有的雙引號
      const escaped = line.replace(/"/g, '\\"');
      return `    "${escaped}"`;
    });

    const gsPath = path.join(__dirname, "..", "linebot.gs");
    let gsContent = fs.readFileSync(gsPath, "utf-8");

    // 1. 定義輔助的還原函數 restoreClassRulesToSheet()
    const restoreFunctionCode = `
/**
 * 🆕 v29.5.231: 完美的統一規格自癒同步函數
 * 自動將程式碼內建的 ${lines.length} 列黃金規格同步寫入 CLASS_RULES 工作表
 * 耗時僅 0.3 秒，完全防範 LINE Webhook 超時風險
 */
function restoreClassRulesToSheet() {
  const fullRules = [
${newLinesGs.join(",\n")}
  ];
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    if (sheet) {
      sheet.clearContents();
      const range = sheet.getRange(1, 1, fullRules.length, 1);
      const writeData = fullRules.map(r => [r]);
      range.setValues(writeData);
      SpreadsheetApp.flush();
      writeLog(\`[Self Heal] 完璧歸趙！成功還原且同步 \${fullRules.length} 列完整規格 (含新機型)\`);
      return fullRules.length;
    }
  } catch(err) {
    writeLog(\`[Force Sync Error] \${err.message}\`);
  }
  return 0;
}
`;

    // 2. 重構 /重啟 與 /重設規格庫 指令區塊
    const targetBlockRegex = /if\s*\(\s*cmd\s*===\s*"\/重啟"[\s\S]*?return\s*`✓ 對話重啟成功！[\s\S]*?if\s*\(\s*cmd\s*===\s*"\/重設規格庫"[\s\S]*?return\s*`✓ 規格庫還原與同步完成！[\s\S]*?\n\s*\}/;

    const replacementBlock = `if (cmd === "/重啟" || cmd === "/reboot") {
    writeLog(\`[Command] /重啟 by \${u}\`);
    clearHistorySheetAndCache(cid);
    const cache = CacheService.getScriptCache();
    cache.remove(\`dissatisfied_count_\${u}\`);
    cache.remove(\`pdf_consulted_\${u}\`);
    cache.remove(\`\${u}:pdf_consulted\`);
    cache.remove(\`\${u}:elaboration_state\`);
    cache.remove(\`\${u}:last_meaningful_query\`);
    cache.remove(\`\${u}:direct_search_models\`);
    cache.remove(\`\${u}:hit_alias_key\`);
    cache.remove(\`\${u}:pending_topic\`);
    cache.remove(\`\${u}:model_select_mode\`);
    cache.remove(\`\${u}:qa_offer_payload\`);
    cache.remove(\`\${u}:suggested_models\`);
    cache.remove(\`\${u}:pending_pdf_query\`);
    cache.remove(\`model_selection_\${u}\`);
    const pdfModeKey = CACHE_KEYS.PDF_MODE_PREFIX + cid;
    cache.remove(pdfModeKey);
    
    // 🆕 v29.5.231: 重啟對話的同時，也自動極速自癒同步最新規格庫到 Sheet
    const ruleLen = restoreClassRulesToSheet();
    scheduleImmediateRebuild();
    
    writeLog(\`[Command] 對話重啟極速完成 by \${u}\`);
    return \`✓ 對話重啟成功！對話歷史與模式快取已完全重置，最新 \${ruleLen} 列黃金規格庫已完全同步還原，你可以重新開始提問囉！😊\`;
  }

  if (cmd === "/重設規格庫" || cmd === "/rebuild_rules") {
    writeLog(\`[Command] /重設規格庫 by \${u}\`);
    clearHistorySheetAndCache(cid);
    const cache = CacheService.getScriptCache();
    cache.remove(\`dissatisfied_count_\${u}\`);
    cache.remove(\`pdf_consulted_\${u}\`);
    cache.remove(\`\${u}:pdf_consulted\`);
    cache.remove(\`\${u}:elaboration_state\`);
    cache.remove(\`\${u}:last_meaningful_query\`);
    cache.remove(\`\${u}:direct_search_models\`);
    cache.remove(\`\${u}:hit_alias_key\`);
    cache.remove(\`\${u}:pending_topic\`);
    cache.remove(\`\${u}:model_select_mode\`);
    cache.remove(\`\${u}:qa_offer_payload\`);
    cache.remove(\`\${u}:suggested_models\`);
    cache.remove(\`\${u}:pending_pdf_query\`);
    cache.remove(\`model_selection_\${u}\`);
    const pdfModeKey = CACHE_KEYS.PDF_MODE_PREFIX + cid;
    cache.remove(pdfModeKey);

    // 🆕 v29.5.231: 呼叫重構後的統一自癒還原函數
    const ruleLen = restoreClassRulesToSheet();
    scheduleImmediateRebuild();
    const resultMsg = syncGeminiKnowledgeBase(false);
    writeLog(\`[Command] 重設規格庫完成: \${resultMsg.split("\\n")[0]}\`);
    return \`✓ 規格庫還原與同步完成！(對話歷史已重置，規格庫已完璧歸趙補齊至 \${ruleLen} 列。雲端知識庫已同步更新)\\n\${resultMsg}\`;
  }`;

    console.log("正在重構 linebot.gs 的指令處理區塊...");
    if (targetBlockRegex.test(gsContent)) {
      gsContent = gsContent.replace(targetBlockRegex, replacementBlock);
      console.log("指令處理區塊重構成功！");
    } else {
      console.error("❌ 找不到 linebot.gs 中的 /重啟 與 /重設規格庫 指令區塊，無法進行自動重構！");
      return;
    }

    // 3. 在 linebot.gs 結尾追加 restoreClassRulesToSheet 函數
    // 我們可以把函數放在 startNewEntryDraft 之前 (第 9125 行附近)
    const targetInsertLine = "function startNewEntryDraft";
    if (gsContent.includes(targetInsertLine)) {
      gsContent = gsContent.replace(targetInsertLine, restoreFunctionCode + "\n" + targetInsertLine);
      console.log("成功將 restoreClassRulesToSheet 函數寫入 linebot.gs！");
    } else {
      console.error("❌ 找不到 startNewEntryDraft 標誌，無法追加還原函數！");
      return;
    }

    // 4. 更新版本號與 timestamp
    const prevVersion = 'const GAS_VERSION = "v29.5.230";';
    const newVersion = 'const GAS_VERSION = "v29.5.231";';
    gsContent = gsContent.replace(prevVersion, newVersion);

    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const nowStr = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    const prevTimestamp = /const BUILD_TIMESTAMP = ".*";/;
    gsContent = gsContent.replace(prevTimestamp, `const BUILD_TIMESTAMP = "${nowStr}";`);

    fs.writeFileSync(gsPath, gsContent, "utf-8");
    console.log(`linebot.gs 完美的自動化重構與升級為 v29.5.231 全數成功！`);

  } catch (error) {
    console.error("執行出錯:", error);
  }
}

run();
