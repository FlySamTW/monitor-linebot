/** Real LINE verification keeps real delivery and normal user quotas enabled. */
const LINE_ACCEPTANCE_PROPERTY = "LINE_ACCEPTANCE_V324";
let lineAcceptanceRequest_ = null;

function lineAcceptanceHash_(value) {
  return manualIndexDigest_(Utilities.newBlob(String(value || "")).getBytes()).toLowerCase();
}

function bindLineAcceptanceEvent_(event) {
  lineAcceptanceRequest_ = null;
  if (IS_TEST_MODE || !event || event.source?.type !== "user" || !event.source.userId) return;
  const raw = PropertiesService.getScriptProperties().getProperty(LINE_ACCEPTANCE_PROPERTY);
  if (!raw) return;
  let window;
  try { window = JSON.parse(raw); } catch (_) { throw new Error("LINE_ACCEPTANCE_CONFIG_INVALID"); }
  const actorHash = lineAcceptanceHash_(event.source.userId);
  if (window.actorHash !== actorHash) return;
  const startsAt = Date.parse(window.startsAt), expiresAt = Date.parse(window.expiresAt);
  const valid = window.version === GAS_VERSION && window.build === BUILD_TIMESTAMP &&
    window.batch === PROVIDER_VERIFICATION_BATCH && window.cap === PROVIDER_VERIFICATION_CAP_TWD &&
    /^[a-f0-9]{64}$/.test(window.actorHash) && Number.isFinite(startsAt) && Number.isFinite(expiresAt) &&
    expiresAt > startsAt && expiresAt - startsAt <= 30 * 60 * 1000 &&
    Date.now() >= startsAt && Date.now() < expiresAt;
  lineAcceptanceRequest_ = {
    actorHash: actorHash, eventId: String(event.webhookEventId || ""),
    eventType: String(event.type || ""),
    inputSha256: lineAcceptanceHash_(event.message?.text || event.postback?.data || ""),
    replyTokenSha256: lineAcceptanceHash_(event.replyToken),
    version: GAS_VERSION, build: BUILD_TIMESTAMP, expiresAt: expiresAt,
    verifyEvidence: window.verifyEvidence === true, valid: valid,
  };
}

function isProviderVerificationRequest_() {
  if (typeof IS_TEST_MODE !== "undefined" && IS_TEST_MODE === true) return true;
  if (!lineAcceptanceRequest_) return false;
  // An expired acceptance request cannot quietly turn into unrestricted production spending.
  if (!lineAcceptanceRequest_.valid || Date.now() >= lineAcceptanceRequest_.expiresAt) {
    throw new Error("PROVIDER_LINE_ACCEPTANCE_BUDGET_WINDOW_CLOSED");
  }
  return true;
}

function recordLineAcceptanceDelivery_(replyToken, messages, state, httpStatus) {
  const request = lineAcceptanceRequest_;
  if (!request || IS_TEST_MODE || request.replyTokenSha256 !== lineAcceptanceHash_(replyToken)) return;
  const audit = currentRequestAudit || {};
  const receipts = audit.providerReceipts || [];
  const record = {
    kind: "real_line_reply", version: request.version, build: request.build,
    eventId: request.eventId, eventType: request.eventType, actorHash: request.actorHash,
    inputSha256: request.inputSha256, replySha256: lineAcceptanceHash_(JSON.stringify(messages)),
    state: state, httpStatus: httpStatus || null, windowValid: request.valid && Date.now() < request.expiresAt,
    verificationBatch: PROVIDER_VERIFICATION_BATCH, authorizedCapTwd: PROVIDER_VERIFICATION_CAP_TWD,
    providerReceiptIds: receipts.map(r => r.id), providerCalls: receipts.filter(r => r.sent).length,
    queryCount: receipts.some(r => r.purpose === "web" && r.queryCount === null) ? null :
      receipts.reduce((n, r) => n + (r.queryCount || 0), 0),
    at: new Date().toISOString(),
  };
  // LINE API acceptance proves transport only. The live report must separately record the visible answer.
  writeLog("[LINE Acceptance] " + JSON.stringify(record));
}
