const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const assert = require("assert");
const { createProductionHarness } = require("./production_harness");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const hashBytes = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const hash = (file) => hashBytes(fs.readFileSync(path.join(root, file)));
const review = JSON.parse(read("config/provider_cost_review.json"));
const h = createProductionHarness({ quiet: true });

function hashBundle(files) {
  const digest = crypto.createHash("sha256");
  for (const file of files.slice().sort()) {
    const bytes = fs.readFileSync(path.join(root, file));
    digest.update(file.replace(/\\/g, "/"));
    digest.update("\0");
    digest.update(String(bytes.length));
    digest.update("\0");
    digest.update(bytes);
    digest.update("\0");
  }
  return digest.digest("hex");
}

const runtimeManifestFiles = fs
  .readdirSync(root)
  .filter((name) => name.endsWith(".gs") || name.endsWith(".html") || name === "appsscript.json")
  .sort();
const runtimeManifestSha256 = hashBundle(runtimeManifestFiles);
const policyChecksum = hashBundle([
  "provider_cost_policy.gs",
  "provider_cost_gateway.gs",
  "cost_verification.gs",
]);
const dataChecksum = hashBundle([
  "QA.csv",
  "CLASS_RULES.csv",
  "config/manual_lexicon.json",
]);

for (const role of ["FAST", "THINK", "WEB", "POLISH"]) {
  assert.equal(h.run("GEMINI_MODEL_" + role), review.generationModel, "模型變更必須比較與更新費用審查");
  assert(h.run("PRICE_" + role + "_INPUT") <= review.inputUsdPerM);
  assert(h.run("PRICE_" + role + "_OUTPUT") <= review.outputUsdPerM);
}
assert.equal(h.run("JEV_MODEL_ROUTER"), review.jevModel);
assert(h.run("PRICE_ROUTER_INPUT") <= review.routerInputUsdPerM);
assert(h.run("PRICE_ROUTER_OUTPUT") <= review.routerOutputUsdPerM);
assert(h.run("CONFIG.MAX_PDF_ESTIMATED_TOTAL_COST_TWD") <= review.pdfLimitTwd);
assert(h.run("PROVIDER_MONTH_LIMIT_TWD") <= review.monthLimitTwd);
assert.equal(h.run("PROVIDER_VERIFICATION_BATCH"), review.verificationBatch, "驗收 batch 必須與 runtime 一致");
assert.equal(h.run("PROVIDER_VERIFICATION_CAP_TWD"), review.authorizedCapTwd, "授權 cap 必須只有一個 runtime 真值");
assert.equal(h.run("MANUAL_WORKER_INDEX_POLICY"), review.indexPolicy);
assert.equal(review.version, h.run("GAS_VERSION"), "費用審查版本必須等於候選版本");
assert.equal(hash("tools/build_manual_page_index.py"), review.indexBuilderSha256, "抽取器修改須更新政策與相容性驗證");
assert.equal(hash("config/manual_lexicon.json"), review.lexiconSha256, "索引字典修改須更新政策");

const manifest = {
  version: h.run("GAS_VERSION"),
  build: h.run("BUILD_TIMESTAMP"),
  verificationBatch: review.verificationBatch,
  authorizedCapTwd: review.authorizedCapTwd,
  runtimeManifestSha256,
  policyChecksum,
  dataChecksum,
};

if (process.argv.includes('--user-line-test')) {
  const authorizationPath=process.argv[process.argv.indexOf('--user-line-test')+1];
  assert(authorizationPath,'使用者先發布後LINE測試授權紀錄不存在');
  const authorization=JSON.parse(fs.readFileSync(authorizationPath,'utf8').replace(/^\uFEFF/,''));
  const journeysReport=authorization.journeysReport||'test_runner/results/v324_20_journeys_offline.json';
  require('./verify_user_line_publication').validateUserLinePublication(authorization,manifest,review,
    JSON.parse(read(authorization.diagnosticReport||'test_runner/results/v324_generation_diagnostics_20260921.json')),
    JSON.parse(read(journeysReport)));
  console.log('PASS 使用者明確要求先切正式供LINE測試；不偽造liveAccepted或真人報告');
}

if (process.argv.includes("--formal")) {
  assert(review.liveAccepted, "正式發布前須完成 Chrome 模型/品質/費用驗收");
  assert(review.liveReport && fs.existsSync(path.join(root, review.liveReport)), "真人驗收檔不存在");
  assert(/^[a-f0-9]{64}$/.test(review.liveReportSha256 || ""), "真人驗收檔 SHA 尚未封存");
  assert.equal(hash(review.liveReport), review.liveReportSha256, "真人驗收檔 SHA 與費用審查不符");

  const live = JSON.parse(read(review.liveReport));
  require('./live_line_evidence').validateLiveLineEvidence(live);
  assert(live.modelProbe && live.comparison && live.qualityAccepted === true, "真人證據不完整");
  assert.equal(live.selectedModel, review.generationModel);
  assert.equal(live.version, manifest.version, "真人驗收版本不符");
  assert.equal(live.build, manifest.build, "候選已改動，須核對受影響真人證據");
  assert.equal(live.verificationBatch, manifest.verificationBatch, "真人驗收 batch 不符");
  assert.equal(Number(live.authorizedCapTwd), manifest.authorizedCapTwd, "真人驗收 cap 不符");
  assert.equal(live.runtimeManifestSha256, runtimeManifestSha256, "runtime manifest 已改動，真人證據失效");
  assert.equal(live.policyChecksum, policyChecksum, "費用/供應商政策已改動，真人證據失效");
  assert.equal(live.dataChecksum, dataChecksum, "QA/RULE/索引字典已改動，真人證據失效");

  const spent = Number(live.spent);
  const reserved = Number(live.reserved);
  const remaining = Number(live.remaining);
  assert(Number.isFinite(spent) && spent >= 0, "真人驗收 spent 無效");
  assert(Number.isFinite(reserved) && reserved >= 0, "真人驗收 reserved 無效");
  assert(Number.isFinite(remaining) && remaining >= 0, "真人驗收 remaining 無效");
  assert(spent + reserved <= manifest.authorizedCapTwd + 1e-9, "真人驗收累計已超過明確授權 cap");
  assert(Math.abs(remaining - Math.max(0, manifest.authorizedCapTwd - spent - reserved)) < 1e-6, "真人驗收餘額讀回不一致");
  if (live.costTwd !== undefined) {
    assert(Number(live.costTwd) <= manifest.authorizedCapTwd, "本次真人驗收費用超過授權 cap");
  }

  assert(Array.isArray(live.results) && live.results.length > 0, "真人驗收缺逐題結果");
  for (const result of live.results) {
    assert(result && typeof result.id === "string" && result.id.trim(), "逐題結果缺 id");
    assert(typeof result.outcome === "string" && result.outcome.trim(), "逐題結果缺 outcome");
    assert(result.costTwd === undefined || (Number.isFinite(Number(result.costTwd)) && Number(result.costTwd) >= 0), "逐題費用無效");
  }
}

console.log(
  "PASS 模型/費率/驗收批次/上限/索引政策守門" +
    (process.argv.includes("--formal") ? "與真人證據綁定" : "（候選可測；正式另核真人證據）"),
);
console.log(JSON.stringify(manifest));
