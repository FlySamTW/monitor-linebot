/** Signed, bounded maintenance ingress. Never call from ordinary LINE messages. */
function manualWorkerEqual_(a, b) {
  a = String(a); b = String(b); let difference = a.length ^ b.length;
  for (let n = 0; n < 64; n++) difference |= (a.charCodeAt(n) || 0) ^ (b.charCodeAt(n) || 0);
  return difference === 0;
}
function manualWorkerOfficialUrl_(url) {
  return /^https:\/\/(?:downloadcenter\.samsung\.com|downloadcenter2\.samsung\.com|org\.downloadcenter\.samsung\.com)\/[^\s#]*$/i.test(String(url || ""));
}
function manualWorkerSafeArchiveEntry_(name) {
  return typeof name === 'string' && name.length > 0 && name.length <= 512 && !/[\\\x00-\x1f:]/.test(name) &&
    !name.startsWith('/') && name.split('/').every(function (part) { return part && part !== '.' && part !== '..'; }) && /\.pdf$/i.test(name);
}
function extractManualWorkerZipPdf_(bytes, entryName, archiveSha) {
  if (bytes.length > 48 * 1024 * 1024) throw new Error('WORKER_ARCHIVE_LIMIT');
  if (manualIndexDigest_(bytes) !== archiveSha) throw new Error('WORKER_ARCHIVE_SHA');
  if (!manualWorkerSafeArchiveEntry_(entryName)) throw new Error('WORKER_ZIP_ENTRY');
  const u16=function(p){return (bytes[p]&255)+(bytes[p+1]&255)*256;};
  const u32=function(p){return u16(p)+u16(p+2)*65536;};
  let eocd=-1;
  for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--) {
    if(u32(p)===0x06054b50 && p+22+u16(p+20)===bytes.length){eocd=p;break;}
  }
  if(eocd<0 || u16(eocd+4)!==0 || u16(eocd+6)!==0 || u16(eocd+8)!==u16(eocd+10)) throw new Error('WORKER_ZIP_FORMAT');
  const count=u16(eocd+10), length=u32(eocd+12), start=u32(eocd+16);
  if(!count || count>512 || start+length!==eocd || start===0xffffffff) throw new Error('WORKER_ZIP_LIMIT');
  let cursor=start, selected=null; const names={};
  for(let n=0;n<count;n++) {
    if(cursor+46>eocd || u32(cursor)!==0x02014b50) throw new Error('WORKER_ZIP_FORMAT');
    const nameSize=u16(cursor+28), extra=u16(cursor+30), comment=u16(cursor+32), end=cursor+46+nameSize+extra+comment;
    if(end>eocd) throw new Error('WORKER_ZIP_FORMAT');
    const name=Utilities.newBlob(bytes.slice(cursor+46,cursor+46+nameSize)).getDataAsString('UTF-8');
    if(!name || /[\\\x00-\x1f:]/.test(name) || name.startsWith('/') || name.split('/').some(function(p){return p==='..'||p==='.';})) throw new Error('WORKER_ZIP_PATH');
    if(names[name]) throw new Error('WORKER_ZIP_DUPLICATE'); names[name]=true;
    const flags=u16(cursor+8), method=u16(cursor+10), compressed=u32(cursor+20), size=u32(cursor+24), offset=u32(cursor+42);
    if((flags&1)||u16(cursor+34)!==0||[compressed,size,offset].includes(0xffffffff)) throw new Error('WORKER_ZIP_FORMAT');
    if(name===entryName) selected={name:name,flags:flags,method:method,compressed:compressed,size:size,offset:offset,crc:bytes.slice(cursor+16,cursor+20),sizeBytes:bytes.slice(cursor+24,cursor+28)};
    cursor=end;
  }
  if(cursor!==eocd || !selected) throw new Error('WORKER_ZIP_ENTRY');
  const s=selected;
  if(!s.size || s.size>48*1024*1024 || !s.compressed || s.size/s.compressed>200 || ![0,8].includes(s.method)) throw new Error('WORKER_ZIP_EXPANSION_LIMIT');
  if(s.offset+30>start || u32(s.offset)!==0x04034b50 || u16(s.offset+6)!==s.flags || u16(s.offset+8)!==s.method) throw new Error('WORKER_ZIP_FORMAT');
  const localNameSize=u16(s.offset+26), localExtra=u16(s.offset+28), dataStart=s.offset+30+localNameSize+localExtra;
  if(dataStart+s.compressed>start || Utilities.newBlob(bytes.slice(s.offset+30,s.offset+30+localNameSize)).getDataAsString('UTF-8')!==entryName) throw new Error('WORKER_ZIP_ENTRY');
  const compressedBytes=bytes.slice(dataStart,dataStart+s.compressed);
  // Wrap the ONE selected raw-deflate member as gzip; never inflate all languages.
  const pdf=s.method===0?compressedBytes:Utilities.ungzip(Utilities.newBlob([31,139,8,0,0,0,0,0,0,3].concat(compressedBytes,s.crc,s.sizeBytes),'application/gzip')).getBytes();
  if(pdf.length!==s.size || pdf.slice(0,5).map(function(b){return String.fromCharCode(b&255);}).join('')!=='%PDF-') throw new Error('WORKER_ZIP_PDF');
  return pdf;
}
let manualWorkerBundleCache_ = null;
function readManualWorkerBundle_() {
  const raw = PropertiesService.getScriptProperties().getProperty("MANUAL_WORKER_BUNDLE");
  if (!raw) return null;
  if (manualWorkerBundleCache_ && manualWorkerBundleCache_.pointer === raw) return manualWorkerBundleCache_.bundle;
  const pointer = JSON.parse(raw), bytes = DriveApp.getFileById(pointer.fileId).getBlob().getBytes();
  if (manualIndexDigest_(bytes) !== pointer.sha256) throw new Error("WORKER_BUNDLE_CHECKSUM");
  const bundle = JSON.parse(Utilities.newBlob(bytes).getDataAsString());
  if (bundle.revision !== pointer.revision) throw new Error("WORKER_BUNDLE_REVISION");
  manualWorkerBundleCache_ = { pointer: raw, bundle: bundle };
  return bundle;
}
function manualWorkerPending_() {
  const props = PropertiesService.getScriptProperties().getProperties();
  return Object.keys(props).filter(function (key) { return key.indexOf("MANUAL_PENDING_") === 0; }).map(function (key) {
    try {
      const p = JSON.parse(props[key]), c = p.candidate, b = c.workerBinding;
      let reviewed = null;
      if (c.reviewedDocKey) {
        reviewed = reviewedManualWorkerRegistration_(c.reviewedDocKey);
        if (Object.keys(reviewed).some(function (field) { return JSON.stringify(c[field]) !== JSON.stringify(reviewed[field]); }) ||
            c.reviewedFingerprint !== manualIndexDigest_(Utilities.newBlob(JSON.stringify(reviewed)).getBytes()) ||
            p.finalFileName !== reviewed.sourceFileName || p.sourcePdfSha256 !== reviewed.sourcePdfSha256) return null;
      }
      if (!/PAGE_INDEX_BUILD_REQUIRED/.test(p.reason) || !b || b.schemaVersion !== 1 ||
          b.sourcePdfSha256 !== p.sourcePdfSha256 || (reviewed ? b.documentRole !== reviewed.documentRole : b.documentRole !== "manual") ||
          !Array.isArray(b.models) || b.models.length !== 1 ||
          normalizeModelForDisplay(c.fullSku) !== normalizeModelForDisplay(b.models[0]) ||
          !manualWorkerOfficialUrl_(c.downloadUrl) || (!reviewed && !/^https:\/\/www\.samsung\.com\/tw\//i.test(c.supportUrl || "")) ||
          !/^[a-f0-9]{64}$/.test(p.sourcePdfSha256)) return null;
      const sourceFormat = c.sourceFormat || 'pdf', archiveEntry = c.archiveEntry || '', archiveSha256 = String(c.archiveSha256 || '').toLowerCase();
      if (!['pdf','zip_entry_pdf'].includes(sourceFormat) || (sourceFormat === 'zip_entry_pdf' &&
          (!manualWorkerSafeArchiveEntry_(archiveEntry) || !/^[a-f0-9]{64}$/.test(archiveSha256)))) return null;
      return { pendingKey: key, fullSku: c.fullSku, downloadUrl: c.downloadUrl,
        sourcePdfSha256: p.sourcePdfSha256, models: b.models, documentRole: b.documentRole,
        supportUrl: c.supportUrl, sourceFileName: p.finalFileName,
        modelBinding: c.modelBinding, exactModelInDocument: c.exactModelInDocument !== false,
        sourceFormat:sourceFormat,archiveEntry:archiveEntry,archiveSha256:archiveSha256,
        reviewedDocKey:reviewed ? c.reviewedDocKey : '',expectedIndexChecksum:reviewed ? reviewed.expectedIndexChecksum : '',
        language:reviewed ? reviewed.language : '',sourceRegion:reviewed ? reviewed.sourceRegion : '',
        applicabilityNote:reviewed ? reviewed.applicabilityNote : '' };
    } catch (error) { return null; }
  }).filter(Boolean);
}
function handleManualWorkerRequest_(raw) {
  try {
    if (typeof raw !== "string" || raw.length > 12 * 1024 * 1024) throw new Error("WORKER_BODY_LIMIT");
    const e = JSON.parse(raw), props = PropertiesService.getScriptProperties(), secret = props.getProperty("MANUAL_WORKER_SECRET");
    if (!secret || !/^[a-f0-9]{64}$/i.test(secret) || e.protocol !== "manual-index-worker-v1" ||
        !Number.isSafeInteger(e.timestamp) || Math.abs(Date.now() - e.timestamp) > 300000 ||
        !/^[a-f0-9]{32}$/.test(e.nonce || "") || !/^(list|inspect|inspect_failure|index_failure|prepare|probe|health)$/.test(e.action || "") ||
        typeof e.payload !== "string" || !/^[a-f0-9]{64}$/.test(e.signature || "")) throw new Error("WORKER_AUTH");
    const message = [e.protocol, e.timestamp, e.nonce, e.action, e.payload].join("\n");
    const expected = bytesToHex_(Utilities.computeHmacSha256Signature(message, secret)).toLowerCase();
    if (!manualWorkerEqual_(expected, e.signature)) throw new Error("WORKER_AUTH");
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(3000)) throw new Error("WORKER_BUSY");
    try {
      const nonces = JSON.parse(props.getProperty("MANUAL_WORKER_NONCES") || "{}");
      Object.keys(nonces).forEach(function (key) { if (nonces[key] < Date.now() - 300000) delete nonces[key]; });
      if (nonces[e.nonce] || Object.keys(nonces).length >= 100) throw new Error("WORKER_REPLAY_OR_RATE");
      nonces[e.nonce] = e.timestamp; props.setProperty("MANUAL_WORKER_NONCES", JSON.stringify(nonces));
    } finally { lock.releaseLock(); }
    const payload = JSON.parse(e.payload);
    if(e.action==='health') {
      const status={seenAt:new Date().toISOString(),ok:payload.ok===true,
        completed:Math.max(0,Math.min(20,Number(payload.completed)||0)),failed:Math.max(0,Math.min(20,Number(payload.failed)||0))};
      props.setProperty('MANUAL_WORKER_HEALTH',JSON.stringify(status));
      return {ok:true};
    }
    if (e.action === "list") {
      const bundle = readManualWorkerBundle_();
      const active = bundle ? bundle.active : {};
      const pending=manualWorkerPending_().map(function(p){
        const entry = active["worker_" + normalizeModelForDisplay(p.fullSku)];
        const receipt=readManualJson_("MANUAL_PROGRESS_"+normalizeModelForDisplay(p.fullSku));
        if(receipt?.sourcePdfSha256===p.sourcePdfSha256 && receipt.indexPolicy===MANUAL_WORKER_INDEX_POLICY &&
          (receipt.stage==="blocked"||Number(receipt.nextRetryAt||0)>Date.now())) return null;
        const activePolicy=entry?.indexPolicy || MANUAL_WORKER_LEGACY_INDEX_POLICY;
        if(entry && entry.sha256===p.sourcePdfSha256 && activePolicy===MANUAL_WORKER_INDEX_POLICY &&
          receipt?.stage==="verified_ready" && receipt.sourcePdfSha256===p.sourcePdfSha256 && receipt.indexChecksum===entry.indexChecksum) return null;
        return Object.assign({},p,{indexPolicy:MANUAL_WORKER_INDEX_POLICY,
          probeOnly:Boolean(entry && entry.sha256===p.sourcePdfSha256 && activePolicy===MANUAL_WORKER_INDEX_POLICY),
          activeIndexChecksum:entry?.indexChecksum || ""});
      }).filter(Boolean);
      return {
        ok:true,
        contractVersion:2,
        protocol:"manual-index-worker-v1",
        gasVersion:GAS_VERSION,
        build:BUILD_TIMESTAMP,
        indexPolicy:MANUAL_WORKER_INDEX_POLICY,
        capabilities:["inspect","inspect_failure","index_failure","prepare","probe","probeOnly"],
        revision:bundle?bundle.revision:"compiled",
        pending:pending,
        inspections:listManualIdentityInspections_()
      };
    }
    if (e.action === "inspect") return inspectManualWorkerCover_(payload);
    if (e.action === "index_failure") return recordManualIndexFailure_(payload);
    if (e.action === "inspect_failure") return failManualWorkerInspection_(payload);
    if (e.action === "probe") return probeManualWorkerRevision_(payload);
    return prepareManualWorkerRevision_(payload);
  } catch (error) {
    // Never echo signed request bodies, URLs with credentials, or secret material.
    const code = String(error.message || "");
    return { ok: false, error: /^WORKER_[A-Z_]+$/.test(code) ? code : "WORKER_FAILED" };
  }
}
function prepareManualWorkerRevision_(payload) {
  if (!payload || !/^[a-f0-9]{64}$/.test(payload.indexChecksum || "") ||
      typeof payload.gzip !== "string" || payload.gzip.length > 5500000) throw new Error("WORKER_PACKAGE");
  const pending = manualWorkerPending_().find(function (p) { return p.pendingKey === payload.pendingKey; });
  if (!pending || payload.sourcePdfSha256 !== pending.sourcePdfSha256) throw new Error("WORKER_PENDING_BINDING");
  if (pending.expectedIndexChecksum && payload.indexChecksum !== pending.expectedIndexChecksum) throw new Error('WORKER_REGISTERED_INDEX_CHECKSUM');
  if(payload.indexPolicy!==MANUAL_WORKER_INDEX_POLICY) throw new Error("WORKER_INDEX_POLICY");
  const revision = manualIndexDigest_(Utilities.newBlob(JSON.stringify([pending, payload.indexChecksum, payload.indexPolicy])).getBytes());
  const prior = readManualWorkerBundle_();
  if (prior && prior.revision === revision) return { ok: true, revision: revision, reused: true,docKey:"worker_"+normalizeModelForDisplay(pending.fullSku) };
  if (payload.baseRevision !== (prior ? prior.revision : "compiled")) throw new Error("WORKER_STALE_BASE");
  const bytes = Utilities.base64Decode(payload.gzip);
  // gzip ISIZE bounds the expansion before ungzip; reject absurd/unbounded packs.
  if (bytes.length < 18 || (bytes[0] & 255) !== 31 || (bytes[1] & 255) !== 139) throw new Error("WORKER_GZIP");
  const tail = bytes.slice(-4), size = (tail[0] & 255) + (tail[1] & 255) * 256 + (tail[2] & 255) * 65536 + (tail[3] & 255) * 16777216;
  if (!size || size > 24000000) throw new Error("WORKER_EXPANSION_LIMIT");
  const unpacked = Utilities.ungzip(Utilities.newBlob(bytes, "application/gzip"));
  if (unpacked.getBytes().length !== size || manualIndexDigest_(unpacked.getBytes()) !== payload.indexChecksum) throw new Error("WORKER_INDEX_CHECKSUM");
  const index = JSON.parse(unpacked.getDataAsString());
  validateManualWorkerIndex_(index);
  assertManualFolderWritable_();
  let pdfBytes;
  if (payload.pdfData !== undefined) {
    // Oversized official ZIPs cannot be fetched by GAS. The editor-reviewed
    // immutable registration already authorizes exact PDF AND index hashes.
    // Local worker verifies archive+entry; GAS verifies these registered bytes.
    if (!pending.reviewedDocKey || pending.sourceFormat !== 'zip_entry_pdf' || !pending.expectedIndexChecksum ||
        typeof payload.pdfData !== 'string' || payload.pdfData.length > 11200000) throw new Error('WORKER_PDF_UPLOAD_NOT_REGISTERED');
    pdfBytes=Utilities.base64Decode(payload.pdfData);
    if(pdfBytes.length>8*1024*1024) throw new Error('WORKER_PDF_UPLOAD_LIMIT');
  } else {
  // Recheck official bytes on the server; the signed worker cannot swap the PDF.
  let pdfResponse, sourceUrl = pending.downloadUrl;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (!manualWorkerOfficialUrl_(sourceUrl)) throw new Error("WORKER_DOWNLOAD_HOST");
    pdfResponse = UrlFetchApp.fetch(sourceUrl, { muteHttpExceptions: true, followRedirects: false });
    const code = pdfResponse.getResponseCode();
    if (code === 200) break;
    if ([301, 302, 303, 307, 308].indexOf(code) < 0) throw new Error("WORKER_PDF_HTTP");
    const headers = pdfResponse.getAllHeaders();
    sourceUrl = String(headers.Location || headers.location || "");
    pdfResponse = null;
  }
  if (!pdfResponse || pdfResponse.getResponseCode() !== 200) throw new Error("WORKER_PDF_HTTP");
  const sourceBytes = pdfResponse.getBlob().getBytes();
  pdfBytes = pending.sourceFormat === 'zip_entry_pdf' ? extractManualWorkerZipPdf_(sourceBytes,pending.archiveEntry,pending.archiveSha256) : sourceBytes;
  }
  if (pdfBytes.length < 10240 || pdfBytes.length > 48 * 1024 * 1024 ||
      pdfBytes.slice(0, 5).map(function (b) { return String.fromCharCode(b & 255); }).join("") !== "%PDF-" ||
      manualIndexDigest_(pdfBytes) !== pending.sourcePdfSha256) throw new Error("WORKER_PDF_SHA");
  const revisionsFolderId = manualWorkerFolderId_(CONFIG.DRIVE_FOLDER_ID, "_MANUAL_WORKER_REVISIONS");
  const shaFolderId = manualWorkerFolderId_(revisionsFolderId, pending.sourcePdfSha256);
  if (!/^[^\\/\r\n]+\.pdf$/i.test(pending.sourceFileName)) throw new Error("WORKER_PDF_FILENAME");
  const pdfFile = manualWorkerCreateFile_(shaFolderId, Utilities.newBlob(pdfBytes, "application/pdf", pending.sourceFileName));
  if (manualIndexDigest_(pdfFile.getBlob().getBytes()) !== pending.sourcePdfSha256) throw new Error("WORKER_PDF_READBACK");
  const file = manualWorkerCreateFile_(CONFIG.DRIVE_FOLDER_ID, Utilities.newBlob(bytes, "application/gzip", "_worker_" + revision + ".json.gz"));
  if (manualIndexDigest_(Utilities.ungzip(file.getBlob()).getBytes()) !== payload.indexChecksum) throw new Error("WORKER_READBACK");
  // Store only overrides: a later compiled release must never be frozen out.
  const catalog = JSON.parse(JSON.stringify(prior ? prior.documents : {}));
  const active = prior ? Object.assign({}, prior.active) : {};
  Object.keys(catalog).forEach(function (key) {
    catalog[key].models = catalog[key].models.filter(function (m) { return !pending.models.some(function (target) { return normalizeModelForDisplay(m) === normalizeModelForDisplay(target); }); });
    if (!catalog[key].models.length) { delete catalog[key]; delete active[key]; }
  });
  const key = "worker_" + normalizeModelForDisplay(pending.fullSku);
  catalog[key] = { models: pending.models, sourceFileName: pending.sourceFileName,
    sourcePdfSha256: pending.sourcePdfSha256, documentRole: pending.documentRole, modelBinding: pending.modelBinding,
    exactModelInDocument: pending.exactModelInDocument, supportUrl: pending.supportUrl,
    downloadUrl: pending.downloadUrl, sourceFormat:pending.sourceFormat,archiveEntryName:pending.archiveEntry,
    officialArchiveSha256:pending.archiveSha256,language:pending.language,sourceRegion:pending.sourceRegion,
    applicabilityNote:pending.applicabilityNote,groups: {},
    pageIndex: { schemaVersion: 2, revision: pending.sourcePdfSha256, encoding: "gzip-base64", sha256: payload.indexChecksum, storage: "drive" } };
  active[key] = { sha256: pending.sourcePdfSha256, indexChecksum: payload.indexChecksum, indexFileId: file.getId(),
    pdfFileId: pdfFile.getId(), sourceUrl: pending.downloadUrl,indexPolicy:payload.indexPolicy };
  const bundle = { schemaVersion: 1, revision: revision, previousRevision: payload.baseRevision, documents: catalog, active: active };
  // No page contents in bundle: compiled fallback data is obtained from compiled catalog.
  Object.keys(catalog).forEach(function (k) { if (catalog[k].pageIndex) delete catalog[k].pageIndex.data; });
  const bundleBlob = Utilities.newBlob(JSON.stringify(bundle), "application/json", "_worker_bundle_" + revision + ".json");
  const bundleFile = manualWorkerCreateFile_(CONFIG.DRIVE_FOLDER_ID, bundleBlob), checksum = manualIndexDigest_(bundleBlob.getBytes());
  if (manualIndexDigest_(bundleFile.getBlob().getBytes()) !== checksum) throw new Error("WORKER_BUNDLE_READBACK");
  const props = PropertiesService.getScriptProperties(), lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) throw new Error("WORKER_BUSY");
  try {
    const current = JSON.parse(props.getProperty("MANUAL_WORKER_BUNDLE") || "null");
    if ((current ? current.revision : "compiled") !== payload.baseRevision) throw new Error("WORKER_STALE_BASE");
    const latest = manualWorkerPending_().find(function (p) { return p.pendingKey === payload.pendingKey; });
    if (JSON.stringify(latest) !== JSON.stringify(pending)) throw new Error("WORKER_PENDING_CHANGED");
    // One pointer is the only activation commit. Prior pointer embedded for rollback.
    props.setProperty("MANUAL_WORKER_BUNDLE", JSON.stringify({revision: revision, fileId: bundleFile.getId(), sha256: checksum, previous: current ? {revision: current.revision, fileId: current.fileId, sha256: current.sha256} : null}));
    saveManualJson_("MANUAL_PROGRESS_"+normalizeModelForDisplay(pending.fullSku),{stage:"activated_pending_probe",
      sourcePdfSha256:pending.sourcePdfSha256,indexChecksum:payload.indexChecksum,indexPolicy:payload.indexPolicy,revision:revision});
  } finally { lock.releaseLock(); }
  return { ok: true, revision: revision, docKey: key, indexChecksum: payload.indexChecksum };
}
function manualWorkerFolderId_(parentId, name) {
  const folders = DriveApp.getFolderById(parentId).getFoldersByName(name);
  if (folders.hasNext()) return folders.next().getId();
  const created = Drive.Files.create({name:name, mimeType:'application/vnd.google-apps.folder', parents:[parentId]},
    null, {fields:'id', supportsAllDrives:true});
  if (!created || !created.id) throw new Error('WORKER_FOLDER_CREATE');
  return created.id;
}
function manualWorkerCreateFile_(parentId, blob) {
  const created = Drive.Files.create({name:blob.getName(), parents:[parentId]}, blob, {fields:'id', supportsAllDrives:true});
  if (!created || !created.id) throw new Error('WORKER_FILE_CREATE');
  return DriveApp.getFileById(created.id);
}
function probeManualWorkerRevision_(payload) {
  const bundle = readManualWorkerBundle_();
  if (!bundle) return { ok: true, revision: "compiled", verified: [] };
  const keys = Object.keys(bundle.active).filter(function (key) { return !payload || !payload.docKey || payload.docKey === key; });
  if (keys.length > 20) throw new Error("WORKER_PROBE_SELECT_DOC");
  const verified = keys.map(function (key) {
    const active = bundle.active[key];
    const pdfSha = manualIndexDigest_(DriveApp.getFileById(active.pdfFileId).getBlob().getBytes());
    const indexSha = manualIndexDigest_(Utilities.ungzip(DriveApp.getFileById(active.indexFileId).getBlob()).getBytes());
    if (pdfSha !== active.sha256 || indexSha !== active.indexChecksum) throw new Error("WORKER_PROBE_READBACK");
    (bundle.documents[key].models||[]).forEach(function(model){
      saveManualJson_("MANUAL_PROGRESS_"+normalizeModelForDisplay(model),{stage:"verified_ready",sourcePdfSha256:pdfSha,
        indexChecksum:indexSha,indexPolicy:active.indexPolicy||MANUAL_WORKER_LEGACY_INDEX_POLICY,revision:bundle.revision,verifiedAt:new Date().toISOString()});
    });
    return { docKey: key, sourcePdfSha256: pdfSha, indexChecksum: indexSha };
  });
  return { ok: true, revision: bundle.revision, verified: verified };
}
function validateManualWorkerIndex_(index) {
  const fail = function () { throw new Error("WORKER_INDEX_SCHEMA"); };
  if (!index || !index.lex || !Array.isArray(index.pages) || !index.pages.length || index.pages.length > 3000) fail();
  const lex = index.lex;
  if (lex.schemaVersion !== 1 || lex.N !== index.pages.length || !Number.isFinite(lex.avgdl) || lex.avgdl <= 0 ||
      !lex.docLength || !lex.df || !lex.postings || !Object.keys(lex.postings).length) fail();
  let textPages = 0;
  index.pages.forEach(function (p, n) {
    if (!p || p.pdfPage !== n + 1 || !Array.isArray(p.blocks) || typeof p.normalizedText !== "string" ||
        !/^[a-f0-9]{64}$/.test(p.pageHash || "") || !Array.isArray(p.headings) ||
        !Number.isFinite(lex.docLength[String(n + 1)]) || lex.docLength[String(n + 1)] < 0) fail();
    if (manualIndexDigest_(Utilities.newBlob(p.normalizedText).getBytes()) !== p.pageHash) fail();
    if (p.blocks.length) textPages++;
    else if (p.normalizedText.trim()) fail(); // Blank/image-only pages may legitimately lack text.
    p.blocks.forEach(function (b, j) {
      if (!b || typeof b.text !== "string" || !b.text.trim() || typeof b.normalizedText !== "string" ||
          !b.normalizedText.trim() || typeof b.id !== "string" || !b.id || !/^[a-f0-9]{64}$/.test(b.hash || "")) fail();
    });
  });
  if (!textPages) fail();
  Object.keys(lex.postings).forEach(function (term) {
    const rows = lex.postings[term];
    if (!term || !Array.isArray(rows) || !rows.length || lex.df[term] !== rows.length || rows.length > lex.N) fail();
    const seen = {};
    rows.forEach(function (row) {
      if (!Array.isArray(row) || row.length !== 2 || !Number.isInteger(row[0]) || row[0] < 1 || row[0] > lex.N ||
          !Number.isFinite(row[1]) || row[1] <= 0 || seen[row[0]]) fail();
      seen[row[0]] = true;
    });
  });
}
