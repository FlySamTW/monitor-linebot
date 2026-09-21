/** Short atomic leases: slow sync must never hold the chat budget lock. */
let manualFolderWritePreflight_ = null;
function assertManualFolderWritable_() {
  if (!manualFolderWritePreflight_) {
    const folder = Drive.Files.get(CONFIG.DRIVE_FOLDER_ID, {
      fields: "id,mimeType,capabilities(canAddChildren)", supportsAllDrives: true,
    });
    manualFolderWritePreflight_ = {
      allowed: folder.mimeType === "application/vnd.google-apps.folder" &&
        Boolean(folder.capabilities && folder.capabilities.canAddChildren),
    };
  }
  if (!manualFolderWritePreflight_.allowed) {
    throw new Error("MANUAL_FOLDER_WRITE_REQUIRED: 手冊資料夾未授予執行帳號新增檔案權限；未送出模型驗證");
  }
}

function acquireManualMaintenanceLease_(name, oncePerDay) {
  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return null;
  try {
    const key = `MANUAL_JOB_${name}`;
    const previous = JSON.parse(props.getProperty(key) || "null");
    const day = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd");
    if (previous && (previous.expiresAt > Date.now() || (oncePerDay && previous.day === day && previous.status === "done"))) return null;
    const lease = {key: key, owner: Utilities.getUuid(), day: day, status: "running", expiresAt: Date.now() + 7 * 60 * 1000};
    props.setProperty(key, JSON.stringify(lease));
    return lease;
  } finally { lock.releaseLock(); }
}

function finishManualMaintenanceLease_(lease, success) {
  if (!lease) return;
  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const current = JSON.parse(props.getProperty(lease.key) || "null");
    if (current && current.owner === lease.owner) {
      props.setProperty(lease.key, JSON.stringify(Object.assign({}, lease, {expiresAt: 0, status: success ? "done" : "failed"})));
    }
  } finally { lock.releaseLock(); }
}

function savePendingManualRevision_(candidate, sha256, finalFileName, reason) {
  const props = PropertiesService.getScriptProperties();
  const key = `MANUAL_PENDING_${String(candidate.fullSku || "").toUpperCase()}`;
  props.setProperty(key, JSON.stringify({candidate: candidate, sourcePdfSha256: sha256,
    finalFileName: finalFileName, status: "PROMOTION_PENDING", reason: String(reason || ""),
    detectedAt: new Date().toISOString()}));
}

function readPendingManualIndexRevision_(fullSku, sha256) {
  try {
    const pending = JSON.parse(PropertiesService.getScriptProperties().getProperty(
      `MANUAL_PENDING_${String(fullSku || "").toUpperCase()}`) || "null");
    return pending && pending.candidate && pending.candidate.workerBinding &&
      String(pending.sourcePdfSha256).toLowerCase() === String(sha256).toLowerCase() ? pending : null;
  } catch (error) { return null; }
}

function isManualIndexPromotionReady_(candidate, sha256) {
  if (isReadyWorkerManualRevisionForCandidate_(candidate, sha256)) return true;
  const docs = typeof MANUAL_PAGE_RAG_DATA_ === "undefined" ? {} : MANUAL_PAGE_RAG_DATA_.documents;
  const matches = Object.keys(docs).filter(function (key) {
    return docs[key].models.some(function (model) { return manualEvidenceModelMatchesTarget_(model, candidate.fullSku); });
  });
  // Previously unindexed manuals retain the existing validated PDF route.
  if (!matches.length) return true;
  return matches.every(function (key) {
    const doc = docs[key];
    if (String(doc.sourcePdfSha256).toLowerCase() !== String(sha256).toLowerCase()) return false;
    // A compiled checksum alone is not evidence that its Drive package was
    // uploaded/read back. Do not promote against an old or missing pointer.
    let active;
    try { active = JSON.parse(PropertiesService.getScriptProperties().getProperty(`MANUAL_ACTIVE::${key}`) || "null"); }
    catch (error) { return false; }
    return Boolean(doc.pageIndex && doc.pageIndex.revision === String(sha256).toLowerCase() &&
      active && active.sha256 === String(sha256).toLowerCase() &&
      active.indexChecksum === doc.pageIndex.sha256 && active.indexFileId);
  });
}

function assertManualIndexPromotionReady_(candidate, sha256, finalFileName) {
  if (isManualIndexPromotionReady_(candidate, sha256)) return;
  savePendingManualRevision_(candidate, sha256, finalFileName, "PAGE_INDEX_BUILD_REQUIRED");
  writeLog(`[Manual Index Update] ${candidate.fullSku} PAGE_INDEX_BUILD_REQUIRED; previous PDF/index retained`);
  throw new Error("PAGE_INDEX_BUILD_REQUIRED");
}

function isReadyWorkerManualRevisionForCandidate_(candidate, sourceSha) {
  const bundle=getManualWorkerSnapshot_(), sha=String(sourceSha||'').toLowerCase();
  if(!bundle||!candidate||!candidate.fullSku||!/^[a-f0-9]{64}$/.test(sha)) return false;
  const keys=Object.keys(bundle.active||{}).filter(function(key){
    const doc=(bundle.documents||{})[key];
    return doc && (doc.models||[]).some(function(model){return normalizeModelForDisplay(model)===normalizeModelForDisplay(candidate.fullSku);});
  });
  if(keys.length!==1) return false;
  const key=keys[0],doc=bundle.documents[key],active=bundle.active[key];
  if(!active.pdfFileId||!active.indexFileId||String(active.sha256).toLowerCase()!==sha||
    String(doc.sourcePdfSha256).toLowerCase()!==sha) return false;
  const receipt=readManualJson_("MANUAL_PROGRESS_"+normalizeModelForDisplay(candidate.fullSku));
  if(!receipt || receipt.stage!=="verified_ready" || receipt.sourcePdfSha256!==sha || receipt.indexChecksum!==active.indexChecksum)return false;
  const revision=readManualRevision_(key,doc);
  return Boolean(revision && revision.sha256===sha && revision.indexChecksum===active.indexChecksum);
}

function readPendingManualIndexBuilds_() {
  const properties = PropertiesService.getScriptProperties().getProperties();
  return Object.keys(properties).filter(function (key) { return key.indexOf("MANUAL_PENDING_") === 0; })
    .map(function (key) { try { return JSON.parse(properties[key]); } catch (error) { return null; } })
    .filter(function (item) { return item && /PAGE_INDEX_BUILD_REQUIRED/.test(item.reason || ""); })
    .filter(function (item) {
      // Report unresolved work only. Retain the historical pending property;
      // a different/new source SHA must never disappear behind an old index.
      return !isReadyWorkerManualRevisionForCandidate_(item.candidate,item.sourcePdfSha256);
    })
    .map(function (item) { return { model: item.candidate.fullSku, sourcePdfSha256: item.sourcePdfSha256,
      finalFileName: item.finalFileName, downloadUrl: item.candidate.downloadUrl,
      status: "PENDING_PAGE_INDEX", detectedAt: item.detectedAt }; });
}
