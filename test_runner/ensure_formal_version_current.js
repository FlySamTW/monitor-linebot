const fs = require("fs");
const path = require("path");
const https = require("https");

const DEFAULT_HEALTH_URL =
  "https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec?health=1";

const source = fs.readFileSync(path.join(__dirname, "..", "linebot.gs"), "utf8");
const localVersion = (source.match(/const GAS_VERSION = "([^"]+)"/) || [])[1];
const localBuild = (source.match(/const BUILD_TIMESTAMP = "([^"]+)"/) || [])[1];
const healthUrl = process.env.TESTUI_HEALTH_URL || DEFAULT_HEALTH_URL;

function requestText(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 60000 }, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        res.resume();
        if (redirectCount >= 5) {
          reject(new Error("too many redirects while checking health"));
          return;
        }
        const nextUrl = new URL(res.headers.location, url).toString();
        requestText(nextUrl, redirectCount + 1).then(resolve, reject);
        return;
      }

      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve(body.trim());
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error("health request timed out"));
    });
    req.on("error", reject);
  });
}

async function main() {
  if (!localVersion) {
    throw new Error("Could not read GAS_VERSION from linebot.gs");
  }

  const health = await requestText(healthUrl);
  const expected = `${localVersion}${localBuild ? ` [${localBuild}]` : ""}`;

  console.log(`Local version : ${expected}`);
  console.log(`Formal health : ${health}`);

  if (!health.includes(expected)) {
    console.error("");
    console.error("[BLOCKED] Formal deployment is not running the exact local version and build.");
    console.error("Do not run online TestUI regression tests yet, because they would validate an old deployment.");
    console.error("If this is a staged /dev candidate, keep formal acceptance pending. After release gates pass, use tools/release_existing_webhook.ps1 and rerun this guard. Do not delete versions or deploy via another entry point merely to satisfy this check.");
    process.exit(2);
  }

  console.log("[OK] Formal health version/build matches local linebot.gs; this is not a TestUI conversation or LINE delivery test.");
}

main().catch((error) => {
  console.error(`[ERROR] ${error.message}`);
  process.exit(1);
});
