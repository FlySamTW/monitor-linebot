/** All generative requests, including maintenance, pass this single boundary. */
let lastProviderReceipt_ = null;
let pendingProviderAttempt_ = null;
const PROVIDER_PRICE_VERIFIED_AT = "2026-09-05";
const PROVIDER_MONTH_LIMIT_TWD = 90;
// Read back in Chrome, 2026-09-05: Sam-Paid-Project / Gemini API gross TWD5.58,
// spend cap TWD90 enforced. Round UP to TWD6; never seed an unrelated script.
const PROVIDER_OPENING_READBACK_ = {
  scriptId: "1ieO3l3iFRuP3TxKkRTllVEoWmCOAOCx7hsiMhVxbaYEZ2iIovWkrPsCQ",
  month: "PROVIDER_MONTH_2026-09", observedGrossTwd: 5.58, openingTwd: 6,
  observedAt: "2026-09-05T05:05:00Z", expiresAt: "2026-09-06T05:05:00Z",
};

function providerPrice_(model) {
  const nextYear = new Date().getTime() >= Date.parse("2027-01-01T00:00:00Z");
  const rates = {
    "gemini-2.5-flash-lite": {input: 0.1, output: 0.4, cached: 0.01},
    "gemini-2.5-flash": {input: 0.3, output: 2.5, cached: 0.03},
    "gemini-3.7-flash": {input: nextYear ? 1.5 : 0.75, output: nextYear ? 7.5 : 3.75, cached: nextYear ? 0.15 : 0.075},
  };
  const price = rates[String(model || "").replace(/^models\//, "")];
  if (!price) throw new Error("PROVIDER_MODEL_NOT_APPROVED");
  return price;
}

function providerMonthKey_() {
  // Cloud Billing calendar; per-chat daily quotas remain Asia/Taipei.
  return "PROVIDER_MONTH_" + Utilities.formatDate(new Date(), "America/Los_Angeles", "yyyy-MM");
}

function changeProviderBudget_(reservation, actualCost, uncertain) {
  const props = PropertiesService.getScriptProperties();
  const key = reservation.month || providerMonthKey_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("PROVIDER_BUDGET_LOCK_BUSY");
  try {
    let state = JSON.parse(props.getProperty(key) || "null");
    if (!state) {
      // First installation is explicitly seeded from the billing readback.
      // Fail closed for paid work until that seed is present; never pretend
      // pre-installation spend was zero. New months may start at zero.
      if (props.getProperty("PROVIDER_BUDGET_INITIALIZED") !== "true") {
        const opening = PROVIDER_OPENING_READBACK_;
        if (key !== opening.month || ScriptApp.getScriptId() !== opening.scriptId ||
            Date.now() > Date.parse(opening.expiresAt) || Date.now() < Date.parse(opening.observedAt)) {
          throw new Error("PROVIDER_BUDGET_NOT_INITIALIZED");
        }
        state = {spent: opening.openingTwd, reserved: 0, uncertain: 0, requests: 0,
          openingCostTwd: opening.openingTwd, readbackGrossTwd: opening.observedGrossTwd, readbackAt: opening.observedAt};
        // Both writes occur within this same script lock before any new fetch.
        props.setProperty(key, JSON.stringify(state));
        props.setProperty("PROVIDER_BUDGET_INITIALIZED", "true");
      }
      if (!state) state = {spent: 0, reserved: 0, uncertain: 0, requests: 0};
    }
    if (actualCost === null) {
      if (state.spent + state.reserved + reservation.amount > PROVIDER_MONTH_LIMIT_TWD) {
        throw new Error("PROVIDER_MONTH_BUDGET_EXHAUSTED");
      }
      if (reservation.verification) {
        const testBudget = state.verificationV303 || {spent: 0, reserved: 0};
        if (testBudget.spent + testBudget.reserved + reservation.amount > 5) throw new Error("PROVIDER_TEST_BUDGET_EXHAUSTED");
        testBudget.reserved += reservation.amount;
        state.verificationV303 = testBudget;
      }
      state.reserved += reservation.amount;
    } else {
      state.reserved = Math.max(0, state.reserved - reservation.amount);
      state.spent += Math.max(0, actualCost);
      if (uncertain) state.uncertain += Math.max(0, actualCost);
      state.requests += reservation.sent ? 1 : 0;
      if (reservation.verification && state.verificationV303) {
        state.verificationV303.reserved = Math.max(0, state.verificationV303.reserved - reservation.amount);
        state.verificationV303.spent += Math.max(0, actualCost);
      }
    }
    props.setProperty(key, JSON.stringify(state));
    return state;
  } finally { lock.releaseLock(); }
}

function providerUsageSignature_(usage, model) {
  return [model, usage.promptTokenCount, usage.candidatesTokenCount,
    usage.thoughtsTokenCount, usage.cachedContentTokenCount, usage.totalTokenCount].join(":");
}

function providerBudgetReply_(code) {
  if (code && !/MONTH_BUDGET_EXHAUSTED/.test(code)) {
    return "這次進階查詢暫時無法啟動，沒有送出或扣次。已確認的規格和常見問答仍可以查，其他部分請找 Sam 幫忙確認。";
  }
  return "這個月的查詢預算暫時用完了，已確認的規格和常見問答仍然可以查。需要進一步確認的部分，請找 Sam 幫忙。";
}

function recordUncertainProviderCost_(amount, modelName) {
  if (!currentRequestAudit) return;
  currentRequestAudit.estimatedCostTwd += amount;
  currentRequestAudit.uncertainCostTwd = Number(currentRequestAudit.uncertainCostTwd || 0) + amount;
  if (!currentRequestAudit.billableModels.includes(modelName)) currentRequestAudit.billableModels.push(modelName);
}

function providerFetch_(url, rawOptions) {
  const target = String(url || "");
  if (/openrouter\.ai\/api\/v1\/chat\/completions/i.test(target)) {
    throw new Error("PROVIDER_MODEL_NOT_APPROVED");
  }
  const match = target.match(/^https:\/\/generativelanguage\.googleapis\.com\/v1(?:beta)?\/models\/([^/:?]+):generateContent(?:\?|$)/);
  if (!match) return UrlFetchApp.fetch(url, rawOptions);
  const options = Object.assign({}, rawOptions || {});
  const grant = options.sourceGrant;
  delete options.sourceGrant;
  let knownInput = Number(options.budgetInputTokens || 0);
  delete options.budgetInputTokens;
  const model = match[1];
  const modelName = `models/${model}`;
  const price = providerPrice_(model);
  const payload = JSON.parse(options.payload || "{}");
  const generation = payload.generationConfig || {};
  const outputLimit = Number(generation.maxOutputTokens || 2048);
  if (!generation.maxOutputTokens) {
    payload.generationConfig = Object.assign({}, generation, {maxOutputTokens: outputLimit});
    options.payload = JSON.stringify(payload);
  }
  // Unicode byte count is an intentionally conservative reservation, not the
  // displayed bill. Attached PDFs use the free official countTokens result.
  if (!knownInput && /"(?:file_data|fileData|inline_data|inlineData)"/.test(options.payload)) {
    const response = UrlFetchApp.fetch(target.replace(":generateContent", ":countTokens"), {
      method: "post", contentType: "application/json", muteHttpExceptions: true,
      payload: JSON.stringify({generateContentRequest: Object.assign({model: modelName}, payload)}),
    });
    if (response.getResponseCode() !== 200) throw new Error("PROVIDER_INPUT_ESTIMATE_UNAVAILABLE");
    knownInput = Number(JSON.parse(response.getContentText()).totalTokens || 0);
    if (!knownInput) throw new Error("PROVIDER_INPUT_ESTIMATE_UNAVAILABLE");
  }
  const inputLimit = knownInput || Utilities.newBlob(options.payload).getBytes().length;
  const search = (payload.tools || []).some(function (tool) { return Boolean(tool.google_search || tool.googleSearch); });
  if (search && model !== "gemini-2.5-flash") throw new Error("PROVIDER_SEARCH_MODEL_NOT_APPROVED");
  const reservation = {month: providerMonthKey_(), amount: ((inputLimit * price.input + outputLimit * price.output) / 1e6) * EXCHANGE_RATE, sent: false,
    verification: typeof IS_TEST_MODE !== "undefined" && IS_TEST_MODE === true};
  // A shared free tier is not guaranteed to remain unused by other clients.
  // Reserve one potential 2.5 grounding charge; settle against the shared count.
  if (search) reservation.amount += 0.035 * EXCHANGE_RATE;
  try { changeProviderBudget_(reservation, null, false); }
  catch (error) {
    if (pendingProviderAttempt_ && currentRequestAudit) {
      currentRequestAudit.attemptedCalls = Math.max(0, currentRequestAudit.attemptedCalls - 1);
      const field = pendingProviderAttempt_.stage + "Calls";
      if (Object.prototype.hasOwnProperty.call(currentRequestAudit, field)) currentRequestAudit[field] = Math.max(0, currentRequestAudit[field] - 1);
    }
    pendingProviderAttempt_ = null;
    throw error;
  }
  let settled = false;
  let costRecorded = false;
  try {
    if (grant) reserveAdvancedSourceUsage_(grant);
    if (!pendingProviderAttempt_) markGenerationAttempt_(search ? "web" : model === "gemini-3.7-flash" ? "router" : "fast", modelName);
    pendingProviderAttempt_ = null;
    reservation.sent = true;
    const response = UrlFetchApp.fetch(url, options);
    let body = {};
    try { body = JSON.parse(response.getContentText() || "{}"); } catch (_) {}
    const rawUsage = body.usageMetadata;
    const usage = rawUsage && Number.isFinite(rawUsage.promptTokenCount) && rawUsage.promptTokenCount >= 0 &&
      ["candidatesTokenCount", "thoughtsTokenCount", "cachedContentTokenCount"].every(function (field) {
        return rawUsage[field] === undefined || (Number.isFinite(rawUsage[field]) && rawUsage[field] >= 0);
      }) ? rawUsage : null;
    let cost = reservation.amount;
    if (usage) {
      const cached = Math.min(Number(usage.cachedContentTokenCount || 0), Number(usage.promptTokenCount || 0));
      cost = ((Number(usage.promptTokenCount || 0) - cached) * price.input + cached * price.cached +
        (Number(usage.candidatesTokenCount || 0) + Number(usage.thoughtsTokenCount || 0)) * price.output) / 1e6 * EXCHANGE_RATE;
      if (search) {
        const metadata = (((body.candidates || [])[0] || {}).groundingMetadata || {});
        if ((metadata.webSearchQueries || []).length) {
          const props = PropertiesService.getScriptProperties();
          const key = "PROVIDER_SEARCH_" + Utilities.formatDate(new Date(), "America/Los_Angeles", "yyyy-MM-dd");
          const lock = LockService.getScriptLock();
          if (!lock.tryLock(5000)) throw new Error("SEARCH_LEDGER_LOCK_BUSY");
          try {
            const count = Number(props.getProperty(key) || 0) + 1;
            props.setProperty(key, String(count));
            if (count > 1500) cost += 0.035 * EXCHANGE_RATE;
          } finally { lock.releaseLock(); }
        }
      }
      lastProviderReceipt_ = {signature: providerUsageSignature_(usage, modelName), audited: false};
      addGenerationUsageToAudit_(usage, cost, modelName);
    } else {
      recordUncertainProviderCost_(cost, modelName);
    }
    costRecorded = true;
    changeProviderBudget_(reservation, cost, !usage);
    settled = true;
    writeLog(`[Provider Cost] model=${model} costTwd=${cost.toFixed(6)} status=${usage ? "usage_estimated" : "usage_pending"} rateDate=${PROVIDER_PRICE_VERIFIED_AT}`);
    return response;
  } finally {
    if (!settled) {
      // Sent/unknown requests retain their reservation as conservative spend.
      // Pre-send failures return the reservation, never charging a chat quota.
      if (reservation.sent && !costRecorded) recordUncertainProviderCost_(reservation.amount, modelName);
      changeProviderBudget_(reservation, reservation.sent ? reservation.amount : 0, reservation.sent);
    }
  }
}

function initializeProviderBudget_(openingCostTwd, billingMonth) {
  if (billingMonth !== providerMonthKey_() || !Number.isFinite(openingCostTwd) || openingCostTwd < 0 || openingCostTwd > 1000) {
    throw new Error("INVALID_BILLING_OPENING_BALANCE");
  }
  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("BUDGET_INITIALIZE_BUSY");
  try {
    if (props.getProperty(billingMonth)) throw new Error("BILLING_MONTH_ALREADY_INITIALIZED");
    props.setProperty(billingMonth, JSON.stringify({spent: openingCostTwd, reserved: 0, uncertain: 0, requests: 0, openingCostTwd: openingCostTwd}));
    props.setProperty("PROVIDER_BUDGET_INITIALIZED", "true");
  } finally { lock.releaseLock(); }
}
