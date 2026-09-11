/** All generative requests, including maintenance, pass this single boundary. */
let lastProviderReceipt_ = null;
let pendingProviderAttempt_ = null;
let lastProviderOutcome_ = null;
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

function redactProviderSecrets_(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_API_KEY]")
    .replace(/([?&](?:key|api_key)=)[^&\s"']+/gi, "$1[REDACTED]")
    .replace(/(Authorization\s*[:=]\s*Bearer\s+)[^\s,"']+/gi, "$1[REDACTED]")
    .replace(/((?:GEMINI_API_KEY|GOOGLE_API_KEY|apiKey|api_key)\s*[=:]\s*["']?)[^\s,"'}]+/gi, "$1[REDACTED]");
}

function providerCredentialFingerprint_(apiKey) {
  const key = String(apiKey || "");
  if (!key) return "missing";
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    key,
    Utilities.Charset.UTF_8,
  );
  return digest
    .slice(0, 8)
    .map(function (value) {
      return ((Number(value) + 256) % 256).toString(16).padStart(2, "0");
    })
    .join("");
}

function providerCredentialStateKey_(apiKey) {
  return `PROVIDER_CREDENTIAL_STATE_${providerCredentialFingerprint_(apiKey)}`;
}

function readProviderCredentialState_(apiKey) {
  const raw = PropertiesService.getScriptProperties().getProperty(
    providerCredentialStateKey_(apiKey),
  );
  if (!raw) return null;
  try {
    const state = JSON.parse(raw);
    return state && state.suspended === true ? state : null;
  } catch (_) {
    return { suspended: true, reason: "invalid_state" };
  }
}

function suspendProviderCredential_(apiKey, outcome) {
  const safeOutcome = outcome || {};
  const state = {
    suspended: true,
    fingerprint: providerCredentialFingerprint_(apiKey),
    reason: String(safeOutcome.reason || "credential_denied").slice(0, 80),
    httpStatus: Number(safeOutcome.httpStatus || 0),
    detectedAt: new Date().toISOString(),
  };
  PropertiesService.getScriptProperties().setProperty(
    providerCredentialStateKey_(apiKey),
    JSON.stringify(state),
  );
  return state;
}

function clearProviderCredentialSuspensionAfterHealthCheck_(apiKey) {
  PropertiesService.getScriptProperties().deleteProperty(
    providerCredentialStateKey_(apiKey),
  );
}

function assertProviderCredentialUsable_(apiKey) {
  const state = readProviderCredentialState_(apiKey);
  if (!state) return true;
  lastProviderOutcome_ = {
    kind: "credential_denied",
    reason: state.reason || "credential_suspended",
    httpStatus: Number(state.httpStatus || 0),
    circuitOpen: true,
    costTwd: 0,
  };
  if (currentRequestAudit) {
    currentRequestAudit.providerOutcome = "credential_denied";
    currentRequestAudit.providerFailureCode = String(state.reason || "credential_suspended");
  }
  throw new Error("PROVIDER_CREDENTIAL_SUSPENDED");
}

function classifyProviderHttpOutcome_(httpStatus, responseBody, requestPayload) {
  const status = Number(httpStatus || 0);
  const body = String(responseBody || "");
  const payload = String(requestPayload || "");
  let reason = "";
  try {
    const parsed = JSON.parse(body || "{}");
    const details = parsed && parsed.error && Array.isArray(parsed.error.details)
      ? parsed.error.details
      : [];
    const errorInfo = details.find(function (item) {
      return item && (item.reason || item["@type"]);
    });
    reason = String((errorInfo && errorInfo.reason) || (parsed.error && parsed.error.status) || "");
  } catch (_) {}
  const credentialPattern = /CONSUMER_SUSPENDED|API_KEY_INVALID|API\s*KEY[^\n]{0,80}(?:SUSPENDED|BLOCKED|LEAKED|INVALID)|REPORTED\s+AS\s+LEAKED|CREDENTIAL[^\n]{0,40}(?:REVOKED|DISABLED)/i;
  if (status >= 200 && status < 300) return { kind: "success", reason: "", httpStatus: status };
  if (status === 401 || credentialPattern.test(`${reason}\n${body}`)) {
    return { kind: "credential_denied", reason: reason || "authentication", httpStatus: status };
  }
  if (status === 403) {
    const hasFileAttachment = /"(?:file_data|fileData)"/.test(payload);
    return {
      kind: hasFileAttachment ? "resource_denied" : "permission_denied",
      reason: reason || "permission_denied",
      httpStatus: status,
    };
  }
  if (status === 404) return { kind: "resource_not_found", reason: reason || "not_found", httpStatus: status };
  if (status === 400) return { kind: "client_rejected", reason: reason || "invalid_argument", httpStatus: status };
  if (status === 408 || status === 429 || status >= 500) {
    return { kind: "transient", reason: reason || `http_${status}`, httpStatus: status };
  }
  return { kind: "unknown_failure", reason: reason || `http_${status}`, httpStatus: status };
}

function markProviderOutcome_(outcome) {
  lastProviderOutcome_ = Object.assign({ costTwd: 0 }, outcome || {});
  if (!currentRequestAudit) return;
  currentRequestAudit.providerOutcome = String(lastProviderOutcome_.kind || "");
  currentRequestAudit.providerFailureCode = String(lastProviderOutcome_.reason || "");
}

function refundProviderSourceGrant_(grant, reason) {
  if (grant && grant.reserved && typeof refundAdvancedSourceUsage_ === "function") {
    refundAdvancedSourceUsage_(grant, reason);
  }
}

function providerFetch_(url, rawOptions) {
  let target = String(url || "");
  const options = Object.assign({}, rawOptions || {});
  let apiKey = String(options.geminiApiKey || "");
  delete options.geminiApiKey;
  const legacyApiKeyMatch = target.match(/[?&]key=([^&]+)/i);
  if (!apiKey && legacyApiKeyMatch) {
    apiKey = decodeURIComponent(legacyApiKeyMatch[1]);
  }
  // API keys must not leave Apps Script in a URL. Keep the legacy normalizer
  // temporarily so an overlooked caller is still protected at the boundary.
  target = target
    .replace(/([?&])key=[^&]*/i, "$1")
    .replace(/\?&/, "?")
    .replace(/&&+/g, "&")
    .replace(/[?&]$/, "");
  if (/^https:\/\/generativelanguage\.googleapis\.com\//i.test(target) && apiKey) {
    options.headers = Object.assign({}, options.headers || {}, {
      "x-goog-api-key": apiKey,
    });
  }
  if (/openrouter\.ai\/api\/v1\/chat\/completions/i.test(target)) {
    throw new Error("PROVIDER_MODEL_NOT_APPROVED");
  }
  const match = target.match(/^https:\/\/generativelanguage\.googleapis\.com\/v1(?:beta)?\/models\/([^/:?]+):generateContent(?:\?|$)/);
  if (!match) return UrlFetchApp.fetch(target, options);
  const grant = options.sourceGrant;
  delete options.sourceGrant;
  let knownInput = Number(options.budgetInputTokens || 0);
  delete options.budgetInputTokens;
  const model = match[1];
  const modelName = `models/${model}`;
  if (!apiKey) throw new Error("MISSING_GEMINI_API_KEY");
  try {
    assertProviderCredentialUsable_(apiKey);
  } catch (error) {
    if (pendingProviderAttempt_ && currentRequestAudit) {
      currentRequestAudit.attemptedCalls = Math.max(0, currentRequestAudit.attemptedCalls - 1);
      const pendingField = pendingProviderAttempt_.stage + "Calls";
      if (Object.prototype.hasOwnProperty.call(currentRequestAudit, pendingField)) {
        currentRequestAudit[pendingField] = Math.max(0, currentRequestAudit[pendingField] - 1);
      }
    }
    pendingProviderAttempt_ = null;
    throw error;
  }
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
      headers: {"x-goog-api-key": apiKey},
      payload: JSON.stringify({generateContentRequest: Object.assign({model: modelName}, payload)}),
    });
    if (response.getResponseCode() !== 200) {
      const estimateOutcome = classifyProviderHttpOutcome_(
        response.getResponseCode(),
        response.getContentText(),
        options.payload,
      );
      markProviderOutcome_(estimateOutcome);
      if (estimateOutcome.kind === "credential_denied") {
        suspendProviderCredential_(apiKey, estimateOutcome);
        throw new Error("PROVIDER_CREDENTIAL_SUSPENDED");
      }
      if (estimateOutcome.kind === "permission_denied") {
        throw new Error("PROVIDER_PERMISSION_DENIED");
      }
      throw new Error("PROVIDER_INPUT_ESTIMATE_UNAVAILABLE");
    }
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
    const response = UrlFetchApp.fetch(target, options);
    const responseText = response.getContentText() || "";
    const httpOutcome = classifyProviderHttpOutcome_(
      response.getResponseCode(),
      responseText,
      options.payload,
    );
    if (httpOutcome.kind !== "success" &&
        ["credential_denied", "permission_denied", "resource_denied", "resource_not_found", "client_rejected"].indexOf(httpOutcome.kind) >= 0) {
      markProviderOutcome_(httpOutcome);
      refundProviderSourceGrant_(grant, httpOutcome.kind);
      changeProviderBudget_(reservation, 0, false);
      settled = true;
      costRecorded = true;
      writeLog(
        `[Provider Outcome] kind=${httpOutcome.kind} http=${httpOutcome.httpStatus} reason=${redactProviderSecrets_(httpOutcome.reason) || "none"} costTwd=0`,
      );
      if (httpOutcome.kind === "credential_denied") {
        suspendProviderCredential_(apiKey, httpOutcome);
        throw new Error("PROVIDER_CREDENTIAL_SUSPENDED");
      }
      if (httpOutcome.kind === "permission_denied") {
        throw new Error("PROVIDER_PERMISSION_DENIED");
      }
      return response;
    }
    let body = {};
    try { body = JSON.parse(responseText || "{}"); } catch (_) {}
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
      markProviderOutcome_({kind: "success", reason: "", httpStatus: response.getResponseCode(), costTwd: cost});
    } else {
      recordUncertainProviderCost_(cost, modelName);
      markProviderOutcome_({kind: httpOutcome.kind, reason: httpOutcome.reason, httpStatus: response.getResponseCode(), costTwd: cost});
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
