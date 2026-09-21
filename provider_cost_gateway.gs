/** All generative requests, including maintenance, pass this single boundary. */
let lastProviderReceipt_ = null;
let pendingProviderAttempt_ = null;
let lastProviderOutcome_ = null;
const PROVIDER_PRICE_VERIFIED_AT = "2026-09-19";
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
    "gemini-3.1-flash-lite": {input: 0.25, output: 1.5, cached: 0.025},
    "gemini-3.7-flash": {input: nextYear ? 1.5 : 0.75, output: nextYear ? 7.5 : 3.75, cached: nextYear ? 0.15 : 0.075},
  };
  const price = rates[String(model || "").replace(/^models\//, "")];
  if (!price) throw new Error("PROVIDER_MODEL_NOT_APPROVED");
  return price;
}

function providerThinkingConfigForModel_(model) {
  const normalized = String(model || "").replace(/^models\//, "");
  if (normalized === "gemini-3.1-flash-lite") return { thinkingLevel: "minimal" };
  if (normalized === "gemini-3.7-flash") return { thinkingLevel: "low" };
  return { thinkingBudget: 0 };
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
        state.verifications = state.verifications || {};
        const testBudget = state.verifications[reservation.verificationBatch || PROVIDER_VERIFICATION_BATCH] || {spent: 0, reserved: 0};
        if (testBudget.spent + testBudget.reserved + reservation.amount > PROVIDER_VERIFICATION_CAP_TWD) throw new Error("PROVIDER_TEST_BUDGET_EXHAUSTED");
        testBudget.reserved += reservation.amount;
        state.verifications[reservation.verificationBatch || PROVIDER_VERIFICATION_BATCH] = testBudget;
      }
      if(reservation.purpose === "manual_cover") {
        const day=Utilities.formatDate(new Date(),"Asia/Taipei","yyyy-MM-dd");
        state.cover=state.cover||{spent:reservation.month==="PROVIDER_MONTH_2026-09"?2.657128:0,reserved:0,day:day,
          daySpent:day==="2026-09-19"?1.040632:0,dayReserved:0,openingSource:"2026-09-19 LOG estimate; not invoice"};
        if(state.cover.day!==day){state.cover.day=day;state.cover.daySpent=0;state.cover.dayReserved=0;}
        if(state.cover.spent+state.cover.reserved+reservation.amount>1 || state.cover.daySpent+state.cover.dayReserved+reservation.amount>0.10)
          throw new Error("PROVIDER_COVER_BUDGET_EXHAUSTED");
        state.cover.reserved+=reservation.amount;state.cover.dayReserved+=reservation.amount;
      }
      state.reserved += reservation.amount;
    } else {
      state.reserved = Math.max(0, state.reserved - reservation.amount);
      state.spent += Math.max(0, actualCost);
      if (uncertain) state.uncertain += Math.max(0, actualCost);
      state.requests += reservation.sent ? 1 : 0;
      if(reservation.purpose === "manual_cover" && state.cover) {
        state.cover.reserved=Math.max(0,state.cover.reserved-reservation.amount);
        state.cover.dayReserved=Math.max(0,state.cover.dayReserved-reservation.amount);
        state.cover.spent+=actualCost;state.cover.daySpent+=actualCost;
      }
      state.byPurpose=state.byPurpose||{};
      const role=reservation.purpose||"legacy";
      state.byPurpose[role]=(state.byPurpose[role]||0)+actualCost;
      if (reservation.verification && state.verifications) {
        const testBudget=state.verifications[reservation.verificationBatch || PROVIDER_VERIFICATION_BATCH];
        if(testBudget){testBudget.reserved=Math.max(0,testBudget.reserved-reservation.amount);testBudget.spent+=Math.max(0,actualCost);}
      }
    }
    props.setProperty(key, JSON.stringify(state));
    accountProviderCostScope_(reservation,actualCost,uncertain);
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
    .replace(/sk-or-v1-[0-9a-f]{20,}/gi, "[REDACTED_OPENROUTER_KEY]")
    .replace(/([?&](?:key|api_key)=)[^&\s"']+/gi, "$1[REDACTED]")
    .replace(/(Authorization\s*[:=]\s*Bearer\s+)[^\s,"']+/gi, "$1[REDACTED]")
    .replace(/((?:GEMINI_API_KEY|GOOGLE_API_KEY|OPENROUTER_API_KEY|apiKey|api_key)\s*[=:]\s*["']?)[^\s,"'}]+/gi, "$1[REDACTED]");
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

/**
 * Gemini cold-standby contract.
 *
 * GEMINI_API_KEY remains the legacy primary property so existing installs do
 * not break.  A standby credential is never selected automatically: a
 * credential/policy denial may apply beyond one key, and silently trying the
 * second key would risk disabling both projects and creating a second charge.
 */
function normalizeGeminiKeySlot_(slot) {
  return String(slot || "").toLowerCase() === "standby" ? "standby" : "primary";
}

function isAcceptedGeminiApiKeyFormat_(value) {
  const key = String(value || "").trim();
  // Legacy Gemini Developer API keys use AIza...; newer Cloud API keys bound
  // to a service account use AQ.... Keep this syntactic only: a health probe
  // is still mandatory before either format can become active.
  return /^(?:AIza[0-9A-Za-z_-]{30,}|AQ\.[0-9A-Za-z_-]{30,})$/.test(key);
}

function getGeminiKeyBySlot_(slot) {
  const props = PropertiesService.getScriptProperties();
  const normalized = normalizeGeminiKeySlot_(slot);
  if (normalized === "standby") {
    return String(props.getProperty("GEMINI_API_KEY_STANDBY") || "");
  }
  return String(
    props.getProperty("GEMINI_API_KEY_PRIMARY") ||
      props.getProperty("GEMINI_API_KEY") ||
      "",
  );
}

function getActiveGeminiKeySlot_() {
  return normalizeGeminiKeySlot_(
    PropertiesService.getScriptProperties().getProperty("GEMINI_ACTIVE_KEY_SLOT"),
  );
}

function getGeminiApiKey_() {
  return getGeminiKeyBySlot_(getActiveGeminiKeySlot_());
}

function geminiKeySlotHealthProperty_(slot, apiKey) {
  return `GEMINI_KEY_HEALTH_${normalizeGeminiKeySlot_(slot)}_${providerCredentialFingerprint_(apiKey)}`;
}

function readGeminiKeySlotStatus_() {
  const props = PropertiesService.getScriptProperties();
  const activeSlot = getActiveGeminiKeySlot_();
  const describe = function (slot) {
    const key = getGeminiKeyBySlot_(slot);
    const state = key ? readProviderCredentialState_(key) : null;
    return {
      configured: Boolean(key),
      fingerprint: key ? providerCredentialFingerprint_(key) : "",
      suspended: Boolean(state),
      healthVerifiedAt: key
        ? String(props.getProperty(geminiKeySlotHealthProperty_(slot, key)) || "")
        : "",
    };
  };
  return {
    activeSlot: activeSlot,
    primary: describe("primary"),
    standby: describe("standby"),
    automaticFailover: false,
  };
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

function providerOpenRouterDecisionFetch_(target, rawOptions, apiKey) {
  const options = Object.assign({}, rawOptions || {});
  const key = String(apiKey || "");
  if (!key) throw new Error("MISSING_OPENROUTER_API_KEY");
  if (String(target || "") !== JEV_DECISIONS_ENDPOINT) {
    throw new Error("PROVIDER_DECISION_ENDPOINT_NOT_APPROVED");
  }
  const costScope=providerCostScope_(options,JEV_MODEL_ROUTER,false);
  const payloadText = String(options.payload || "{}");
  let payload = {};
  try {
    payload = JSON.parse(payloadText);
  } catch (error) {
    throw new Error("PROVIDER_DECISION_PAYLOAD_INVALID");
  }
  if (String(payload.model || "") !== JEV_MODEL_ROUTER) {
    throw new Error("PROVIDER_MODEL_NOT_APPROVED");
  }

  const inputReserveTokens = Math.max(
    1,
    Utilities.newBlob(payloadText).getBytes().length,
  );
  const reservation = {
    month: providerMonthKey_(),
    amount:
      ((inputReserveTokens * PRICE_ROUTER_INPUT) / 1000000) * EXCHANGE_RATE,
    inputLimit:inputReserveTokens,outputLimit:0,sent: false,
    verification: isProviderVerificationRequest_(),
  };
  prepareProviderCostReservation_(reservation,costScope);
  try {
    changeProviderBudget_(reservation, null, false);
  } catch (error) {
    if (pendingProviderAttempt_ && currentRequestAudit) {
      currentRequestAudit.attemptedCalls = Math.max(
        0,
        currentRequestAudit.attemptedCalls - 1,
      );
      const attemptField = pendingProviderAttempt_.stage + "Calls";
      if (Object.prototype.hasOwnProperty.call(currentRequestAudit, attemptField)) {
        currentRequestAudit[attemptField] = Math.max(
          0,
          currentRequestAudit[attemptField] - 1,
        );
      }
    }
    pendingProviderAttempt_ = null;
    throw error;
  }

  let settled = false;
  let costRecorded = false;
  try {
    if (!pendingProviderAttempt_) {
      markGenerationAttempt_(costScope.purpose === "evidence_verify" ? "evidence_verify" : "router", JEV_MODEL_ROUTER);
    }
    pendingProviderAttempt_ = null;
    options.headers = Object.assign({}, options.headers || {}, {
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://script.google.com/",
      "X-Title": "Samsung Monitor LineBot Semantic Router",
    });
    reservation.sent = true;
    persistProviderAttemptReceipt_(reservation,"sent");
    const response = UrlFetchApp.fetch(target, options);
    const code = Number(response.getResponseCode());
    const responseText = String(response.getContentText() || "");
    let body = {};
    try {
      body = JSON.parse(responseText || "{}");
    } catch (_) {}

    if (code < 200 || code >= 300) {
      const uncertain = code >= 500;
      const failedCost = uncertain ? reservation.amount : 0;
      if (failedCost > 0) {
        recordUncertainProviderCost_(failedCost, JEV_MODEL_ROUTER);
      }
      changeProviderBudget_(reservation, failedCost, uncertain);
      settled = true;
      costRecorded = true;
      const errorMessage = redactProviderSecrets_(
        body && body.error && body.error.message
          ? body.error.message
          : `HTTP_${code}`,
      ).substring(0, 160);
      markProviderOutcome_({
        kind:
          code === 401 || code === 403
            ? "credential_denied"
            : uncertain
              ? "server_error"
              : "client_rejected",
        reason: errorMessage,
        httpStatus: code,
        costTwd: failedCost,
      });
      writeLog(
        `[Provider Outcome] provider=OpenRouter model=${JEV_MODEL_ROUTER} http=${code} costTwd=${failedCost.toFixed(6)}`,
      );
      return response;
    }

    const usage = body && body.usage ? body.usage : {};
    const inputTokens = Math.max(0, Number(usage.input_tokens) || 0);
    const reportedCostUsd = typeof usage.cost === "number" ? usage.cost : NaN;
    const exactCostUsd =
      Number.isFinite(reportedCostUsd) && reportedCostUsd >= 0
        ? reportedCostUsd
        : inputTokens > 0
          ? (inputTokens * PRICE_ROUTER_INPUT) / 1000000
          : null;
    const costTwd =
      exactCostUsd === null ? reservation.amount : exactCostUsd * EXCHANGE_RATE;
    const uncertain = exactCostUsd === null;
    reservation.costStatus=Number.isFinite(reportedCostUsd)&&reportedCostUsd>=0?"reported":(uncertain?"unknown":"estimated");
    reservation.responseId=String(body.id||"");
    reservation.usage=body.usage||null;
    if (uncertain) {
      recordUncertainProviderCost_(costTwd, JEV_MODEL_ROUTER);
    }
    changeProviderBudget_(reservation, costTwd, uncertain);
    settled = true;
    costRecorded = true;
    if (!uncertain) {
      const auditUsage={promptTokenCount:inputTokens,candidatesTokenCount:Math.max(0,Number(usage.output_tokens)||0),thoughtsTokenCount:0};
      // A receipt identifies an attempt; identical token counts on separate calls are still billed separately.
      lastProviderReceipt_={signature:providerUsageSignature_(auditUsage,JEV_MODEL_ROUTER),audited:false};
      addGenerationUsageToAudit_(auditUsage,costTwd,JEV_MODEL_ROUTER);
    }
    if (currentRequestAudit) {
      const field=costScope.purpose==="evidence_verify"?"evidenceVerifyCostTwd":"routerCostTwd";
      currentRequestAudit[field]=(currentRequestAudit[field]||0)+costTwd;
    }
    markProviderOutcome_({
      kind: "success",
      reason: "",
      httpStatus: code,
      costTwd: costTwd,
    });
    writeLog(
      `[Provider Cost] provider=OpenRouter model=${JEV_MODEL_ROUTER} costTwd=${costTwd.toFixed(6)} status=${reservation.costStatus} rateDate=2026-09-18`,
    );
    return response;
  } finally {
    if (!settled) {
      if (reservation.sent && !costRecorded) {
        recordUncertainProviderCost_(reservation.amount, JEV_MODEL_ROUTER);
      }
      changeProviderBudget_(
        reservation,
        reservation.sent ? reservation.amount : 0,
        reservation.sent,
      );
    }
  }
}

function providerFetch_(url, rawOptions) {
  let target = String(url || "");
  const options = Object.assign({}, rawOptions || {});
  let apiKey = String(options.geminiApiKey || "");
  const openRouterApiKey = String(options.openRouterApiKey || "");
  delete options.geminiApiKey;
  delete options.openRouterApiKey;
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
  if (/openrouter\.ai\/api\/alpha\/decisions/i.test(target)) {
    return providerOpenRouterDecisionFetch_(target, options, openRouterApiKey);
  }
  if (/openrouter\.ai\/api\/v1\/chat\/completions/i.test(target)) {
    throw new Error("PROVIDER_MODEL_NOT_APPROVED");
  }
  const modelDiscovery = target === "https://generativelanguage.googleapis.com/v1beta/models?pageSize=100";
  if (modelDiscovery) {
    if (String(options.providerPurpose || "") !== "diagnostic" || String(options.method || "get").toLowerCase() !== "get") {
      throw new Error("PROVIDER_NON_GENERATION_CONTRACT");
    }
    delete options.providerPurpose;
    delete options.providerJobId;
    return UrlFetchApp.fetch(target, options);
  }
  const interaction = target === PROVIDER_INTERACTIONS_ENDPOINT;
  let match = target.match(/^https:\/\/generativelanguage\.googleapis\.com\/v1(?:beta)?\/models\/([^/:?]+):generateContent(?:\?|$)/);
  if(interaction){const native=JSON.parse(options.payload||"{}");match=[target,String(native.model||"").replace(/^models\//,"")];
    if(native.store!==false||native.stream!==false||native.background!==false||options.providerPurpose!=="web")throw new Error("PROVIDER_INTERACTIONS_CONTRACT");}
  if (!match) {
    if (/generativelanguage\.googleapis\.com/i.test(target) && !/\/(?:upload\/)?v1(?:beta)?\/(?:files(?:\/|$|\?)|models\/[^/?]+:countTokens(?:\?|$))/.test(target))throw new Error("PROVIDER_ENDPOINT_NOT_APPROVED");
    delete options.providerPurpose;delete options.providerJobId;return UrlFetchApp.fetch(target, options);
  }
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
  const generation = interaction ? {maxOutputTokens:payload.generation_config?.max_output_tokens} : payload.generationConfig || {};
  const outputLimit=Number(generation.maxOutputTokens||2048);
  if(interaction){if(outputLimit!==800)throw new Error("PROVIDER_INTERACTIONS_OUTPUT_LIMIT");}
  else {if(!generation.thinkingConfig)generation.thinkingConfig=providerThinkingConfigForModel_(model);generation.maxOutputTokens=outputLimit;payload.generationConfig=generation;}
  options.payload=JSON.stringify(payload);
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
  const search = (payload.tools || []).some(function (tool) { return Boolean(tool.google_search || tool.googleSearch || tool.type === "google_search"); });
  if (search && ![GEMINI_MODEL_WEB.replace(/^models\//,""),"gemini-2.5-flash-lite","gemini-2.5-flash","gemini-3.1-flash-lite"].includes(model)) throw new Error("PROVIDER_SEARCH_MODEL_NOT_APPROVED");
  const costScope=providerCostScope_(options,model,search);
  const reservation = {month: providerMonthKey_(), amount: ((inputLimit * price.input + outputLimit * price.output) / 1e6) * EXCHANGE_RATE, sent: false,
    inputLimit:inputLimit,outputLimit:outputLimit,verification: isProviderVerificationRequest_()};
  // A shared free tier is not guaranteed to remain unused by other clients.
  // Reserve one potential 2.5 grounding charge; settle against the shared count.
  if (search) reservation.amount += providerSearchPrice_(model).usd * (providerSearchPrice_(model).unit === "query" ? 3 : 1) * EXCHANGE_RATE;
  prepareProviderCostReservation_(reservation,costScope);
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
    if (!pendingProviderAttempt_) markGenerationAttempt_(["pdf","web","router"].includes(costScope.purpose)?costScope.purpose:"fast", modelName);
    pendingProviderAttempt_ = null;
    reservation.sent = true;
    persistProviderAttemptReceipt_(reservation,"sent");
    const rawResponse = UrlFetchApp.fetch(target, options);
    const response = interaction ? adaptWebInteractionResponse_(rawResponse) : rawResponse;
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
    reservation.responseId=/^[A-Za-z0-9_-]{1,200}$/.test(body.responseId||"")?body.responseId:"";
    const rawUsage = body.usageMetadata;
    const usage = rawUsage && Number.isFinite(rawUsage.promptTokenCount) && rawUsage.promptTokenCount >= 0 &&
      ["candidatesTokenCount", "thoughtsTokenCount", "cachedContentTokenCount"].every(function (field) {
        return rawUsage[field] === undefined || (Number.isFinite(rawUsage[field]) && rawUsage[field] >= 0);
      }) ? rawUsage : null;
    let cost = reservation.amount;
    let searchUnknown = false;
    if (usage) {
      reservation.usage={inputTokens:usage.promptTokenCount,cachedTokens:Number(usage.cachedContentTokenCount||0),
        outputTokens:Number(usage.candidatesTokenCount||0),thoughtTokens:Number(usage.thoughtsTokenCount||0)};
      const cached = Math.min(Number(usage.cachedContentTokenCount || 0), Number(usage.promptTokenCount || 0));
      cost = ((Number(usage.promptTokenCount || 0) - cached) * price.input + cached * price.cached +
        (Number(usage.candidatesTokenCount || 0) + Number(usage.thoughtsTokenCount || 0)) * price.output) / 1e6 * EXCHANGE_RATE;
      if (search) {
        const observedSearch=providerSearchMetadata_(body);
        const result=settleProviderSearch_(model,observedSearch);
        cost+=result.costTwd;reservation.queryCount=result.queryCount;searchUnknown=Boolean(result.unknown);
        reservation.searchAllowanceKnown=result.allowanceKnown;
        reservation.searchCostTwd=result.costTwd;
        writeLog("[Search Execution Receipt] "+JSON.stringify({responseId:reservation.responseId,queryCount:result.queryCount,
          traceCalls:(((body.candidates||[])[0]||{}).content?.parts||[]).filter(function(p){return p.toolCall;}).length,
          groundingPresent:Boolean(((body.candidates||[])[0]||{}).groundingMetadata),costKnown:!result.unknown}));
        if(searchUnknown && currentRequestAudit)currentRequestAudit.uncertainCostTwd=(currentRequestAudit.uncertainCostTwd||0)+result.costTwd;
      }
      lastProviderReceipt_ = {signature: providerUsageSignature_(usage, modelName), audited: false};
      addGenerationUsageToAudit_(usage, cost, modelName);
      markProviderOutcome_({kind: "success", reason: "", httpStatus: response.getResponseCode(), costTwd: cost});
    } else {
      recordUncertainProviderCost_(cost, modelName);
      markProviderOutcome_({kind: httpOutcome.kind, reason: httpOutcome.reason, httpStatus: response.getResponseCode(), costTwd: cost});
    }
    costRecorded = true;
    reservation.costStatus=!usage||searchUnknown?"unknown":"estimated";
    changeProviderBudget_(reservation, cost, !usage||searchUnknown);
    settled = true;
    writeLog(`[Provider Cost] model=${model} costTwd=${cost.toFixed(6)} status=${usage&&!searchUnknown ? "usage_estimated" : "usage_pending"} rateDate=${PROVIDER_PRICE_VERIFIED_AT}`);
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
