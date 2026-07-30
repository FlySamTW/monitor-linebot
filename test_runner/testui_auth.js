const DEFAULT_TESTUI_BASE_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec";

function getMaintenanceSecret() {
  const secret = String(process.env.GAS_MAINTENANCE_SECRET || "").trim();
  if (!secret) {
    const error = new Error(
      "[BLOCKED] 缺少 GAS_MAINTENANCE_SECRET，正式 TestUI 測試未啟動。請在目前工作階段提供維護憑證後重跑。",
    );
    error.code = "TESTUI_AUTH_BLOCKED";
    throw error;
  }
  return secret;
}

function getAuthorizedTestUiUrl() {
  const baseUrl = String(
    process.env.TESTUI_BASE_URL || DEFAULT_TESTUI_BASE_URL,
  ).trim();
  const url = new URL(baseUrl);
  url.searchParams.set("test", "1");
  url.searchParams.set("secret", getMaintenanceSecret());
  return url.toString();
}

function getAuthorizedMaintenanceUrl(params = {}) {
  const baseUrl = String(
    process.env.TESTUI_BASE_URL || DEFAULT_TESTUI_BASE_URL,
  ).trim();
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  url.searchParams.set("secret", getMaintenanceSecret());
  return url.toString();
}

async function openAuthorizedTestUi(page, options = {}) {
  const timeout = Number(options.timeout || 90000);
  await page.goto(getAuthorizedTestUiUrl(), {
    waitUntil: options.waitUntil || "networkidle0",
    timeout,
  });

  const deadline = Date.now() + Number(options.frameTimeout || 15000);
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const input = await frame.$("#msg-input").catch(() => null);
      if (input) return frame;
    }
    const bodyText = await page
      .$eval("body", (body) => body.innerText)
      .catch(() => "");
    if (/需要維護者授權|Unauthorized/i.test(bodyText)) {
      throw new Error("[BLOCKED] TestUI 維護授權失敗；未執行任何對話測試。");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    "[BLOCKED] 已取得授權頁，但 TestUI 介面未在 15 秒內就緒；請檢查正式部署與瀏覽器 console。",
  );
}

function getRedactedTestUiTarget() {
  return String(process.env.TESTUI_BASE_URL || DEFAULT_TESTUI_BASE_URL).trim();
}

module.exports = {
  getAuthorizedMaintenanceUrl,
  getAuthorizedTestUiUrl,
  getMaintenanceSecret,
  getRedactedTestUiTarget,
  openAuthorizedTestUi,
};
