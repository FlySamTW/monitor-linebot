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
