/** A request observes one immutable revision bundle; never mix two generations. */
let manualWorkerSnapshot_;
function getManualWorkerSnapshot_() {
  if (manualWorkerSnapshot_ !== undefined) return manualWorkerSnapshot_;
  try { manualWorkerSnapshot_ = readManualWorkerBundle_(); }
  catch (error) { writeLog('[Manual Worker] bundle unavailable; retaining compiled verified routes'); manualWorkerSnapshot_ = null; }
  return manualWorkerSnapshot_;
}
function getEffectiveManualDocuments_() {
  const bundle = getManualWorkerSnapshot_();
  if (!bundle) return MANUAL_PAGE_RAG_DATA_.documents;
  const documents = {};
  const overrides = Object.keys(bundle.active || {});
  const replaced = overrides.reduce(function (all, key) { return all.concat((bundle.documents[key] || {}).models || []); }, []);
  Object.keys(MANUAL_PAGE_RAG_DATA_.documents).forEach(function (key) {
    const original = MANUAL_PAGE_RAG_DATA_.documents[key];
    const models = original.models.filter(function (model) {
      return !replaced.some(function (target) { return normalizeModelForDisplay(model) === normalizeModelForDisplay(target); });
    });
    if (models.length) documents[key] = Object.assign({}, original, {models:models});
  });
  overrides.forEach(function (key) {
    const doc=bundle.documents[key], reviewed=findRegisteredPrintedCoverBinding_(doc);
    documents[key]=reviewed ? Object.assign({},doc,{bindingPolicy:reviewed.bindingPolicy,
      coverPatterns:reviewed.coverPatterns.slice(),reviewedDocKey:reviewed.docKey}) : doc;
  });
  return documents;
}

function findRegisteredPrintedCoverBinding_(document) {
  if (!document || typeof MANUAL_PAGE_RAG_DATA_==='undefined') return null;
  const sha=String(document.sourcePdfSha256||'').toLowerCase();
  const models=(document.models||[]).map(function(m){return String(m).toUpperCase();}).sort().join(',');
  const docs=MANUAL_PAGE_RAG_DATA_.documents||{};
  const matches=Object.keys(docs).filter(function(key){
    const d=docs[key];
    if(d.bindingPolicy!=='unique_printed_cover_v1'||d.modelBinding!=='official_family_cover'||
      String(d.sourcePdfSha256||'').toLowerCase()!==sha||
      d.models.map(function(m){return String(m).toUpperCase();}).sort().join(',')!==models) return false;
    return d.models.every(function(model){return (d.coverPatterns||[]).some(function(pattern){
      const escaped=String(pattern).replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*');
      return new RegExp('^'+escaped+'$','i').test(model);
    });});
  });
  return matches.length===1 ? Object.assign({docKey:matches[0]},docs[matches[0]]) : null;
}
function getEffectiveManualActive_(key, properties) {
  const bundle = getManualWorkerSnapshot_();
  if (bundle && bundle.active && bundle.active[key]) return bundle.active[key];
  try { return JSON.parse((properties ? properties['MANUAL_ACTIVE::'+key] :
    PropertiesService.getScriptProperties().getProperty('MANUAL_ACTIVE::'+key)) || 'null'); }
  catch (error) { return null; }
}
function isWorkerManualRevision_(key, document) {
  const bundle = getManualWorkerSnapshot_();
  const active = bundle && bundle.active && bundle.active[key];
  return Boolean(active && bundle.documents[key] && active.pdfFileId &&
    active.sha256 === document.sourcePdfSha256 && active.indexChecksum === document.pageIndex.sha256);
}
function mergeWorkerManualManifest_(manifest) {
  const bundle = getManualWorkerSnapshot_();
  if (!bundle) return manifest;
  const result = Object.assign({},manifest);
  Object.keys(bundle.active).forEach(function (key) {
    const doc=bundle.documents[key], active=bundle.active[key];
    doc.models.forEach(function (model) {
      // Keep canonical existing SKU keys so a worker cannot create a second,
      // contradictory alias for the same regionally-normalized model.
      const sku=Object.keys(result).find(function(k){return normalizeModelForDisplay(k)===normalizeModelForDisplay(model);}) || model;
      result[sku]=Object.assign({},result[sku]||{}, {fullSku:sku,sha256:active.sha256,sourcePdfSha256:active.sha256,
        finalFileName:doc.sourceFileName,downloadUrl:doc.downloadUrl,supportUrl:doc.supportUrl,
        modelBinding:doc.modelBinding,exactModelInDocument:doc.exactModelInDocument,packageType:'PDF',driveFileId:active.pdfFileId});
    });
  });
  return result;
}
function workerPdfCandidates_(models) {
  const bundle=getManualWorkerSnapshot_();
  if(!bundle) return [];
  return Object.keys(bundle.active).filter(function(key){return bundle.documents[key].models.some(function(model){
    return models.some(function(target){return normalizeModelForDisplay(target)===normalizeModelForDisplay(model);});
  });}).map(function(key){
    const active=bundle.active[key], doc=bundle.documents[key], file=DriveApp.getFileById(active.pdfFileId);
    return {name:doc.sourceFileName,mimeType:'application/pdf',driveFileId:active.pdfFileId,sizeBytes:file.getSize(),
      updatedAt:file.getLastUpdated().toISOString(),updatedAtMs:file.getLastUpdated().getTime(),_driveFile:file};
  });
}
function validateWorkerPdfAttachment_(file,models) {
  const bundle=getManualWorkerSnapshot_();
  if(!bundle) return true;
  const keys=Object.keys(bundle.active).filter(function(key){return bundle.documents[key].models.some(function(model){
    return models.some(function(target){return normalizeModelForDisplay(target)===normalizeModelForDisplay(model);});
  });});
  if(!keys.length) return true;
  return keys.some(function(key){return bundle.active[key].sha256===String(file.sha256||file.officialSha256||file.manualSha256||'').toLowerCase();});
}
function configureManualWorkerFromTestUi(secret, token) {
  assertEditorOnlyTestUiMaintenance_(token);
  if (!/^[a-f0-9]{64}$/.test(secret || '')) throw new Error('WORKER_SECRET_FORMAT');
  PropertiesService.getScriptProperties().setProperty('MANUAL_WORKER_SECRET', secret);
  return {ok:true, endpoint:'https://script.google.com/macros/s/AKfycbz7qWb7th3y33e2fwv0YTZwc4elxIYf1Bh1iOfk5pENoM3rIwC0zth5oZjAnSf4MaYXQA/exec'};
}
function queueVerifiedManualWorkerCanaryFromTestUi(docKey, token) {
  assertEditorOnlyTestUiMaintenance_(token);
  // Canary can ONLY reuse an already registered, verified revision and scope.
  const doc = MANUAL_PAGE_RAG_DATA_.documents[docKey];
  if (!doc || !readManualRevision_(docKey, doc)) throw new Error('WORKER_CANARY_NOT_REGISTERED');
  const model = doc.models.find(function (m) { return /[A-Z]{2,3}$/.test(m); }) || doc.models[0];
  const manifest=readOfficialManualManifest_();
  const entry=Object.keys(manifest).map(function(k){return manifest[k];}).find(function(e){
    return normalizeModelForDisplay(e.fullSku)===normalizeModelForDisplay(model) &&
      String(e.sourcePdfSha256||e.sha256).toLowerCase()===doc.sourcePdfSha256.toLowerCase();
  }) || {};
  const candidate = {fullSku:model, downloadUrl:doc.downloadUrl||entry.downloadUrl, supportUrl:doc.supportUrl||entry.supportUrl,
    modelBinding:doc.modelBinding || 'pdf_first_page', exactModelInDocument:doc.exactModelInDocument !== false,
    workerBinding:{schemaVersion:1,sourcePdfSha256:doc.sourcePdfSha256.toLowerCase(),models:[model],documentRole:'manual',verifiedAt:new Date().toISOString()}};
  if(!manualWorkerOfficialUrl_(candidate.downloadUrl)||!candidate.supportUrl) throw new Error('WORKER_CANARY_SOURCE_MISSING');
  savePendingManualRevision_(candidate, doc.sourcePdfSha256.toLowerCase(), buildOfficialManualFinalFileName_([model], model), 'PAGE_INDEX_BUILD_REQUIRED');
  return {ok:true,model:model,sourcePdfSha256:doc.sourcePdfSha256,providerCalls:0};
}
function reviewedManualWorkerRegistration_(docKey) {
  const doc = MANUAL_PAGE_RAG_DATA_.documents[docKey];
  if (!doc || !Array.isArray(doc.models) || doc.models.length !== 1 ||
      doc.bindingPolicy !== 'unique_printed_cover_v1' || !Array.isArray(doc.coverPatterns) || !doc.coverPatterns.length ||
      !['manual','user_manual'].includes(doc.documentRole) || !manualWorkerOfficialUrl_(doc.downloadUrl) ||
      !/^https:\/\/www\.samsung\.com\/[a-z]{2}(?:_[a-z]{2})?\/support\/model\//i.test(doc.supportUrl || '') ||
      !/^[a-f0-9]{64}$/i.test(doc.sourcePdfSha256 || '') || !doc.pageIndex ||
      !/^[a-f0-9]{64}$/i.test(doc.pageIndex.sha256 || '') ||
      String(doc.pageIndex.revision).toLowerCase() !== doc.sourcePdfSha256.toLowerCase()) throw new Error('WORKER_REVIEWED_REGISTRATION');
  const registration = {reviewedDocKey:docKey, fullSku:doc.models[0], models:doc.models.slice(),
    sourcePdfSha256:doc.sourcePdfSha256.toLowerCase(), sourceFileName:String(doc.sourceFileName).split(/[\\/]/).pop(),
    downloadUrl:doc.downloadUrl, supportUrl:doc.supportUrl, documentRole:doc.documentRole, modelBinding:doc.modelBinding,
    exactModelInDocument:doc.exactModelInDocument !== false, sourceFormat:doc.sourceFormat || 'pdf',
    archiveEntry:doc.archiveEntryName || '', archiveSha256:String(doc.officialArchiveSha256 || '').toLowerCase(),
    expectedIndexChecksum:doc.pageIndex.sha256.toLowerCase(), bindingPolicy:doc.bindingPolicy,
    coverPatterns:doc.coverPatterns, language:doc.language || '', sourceRegion:doc.sourceRegion || '', applicabilityNote:doc.applicabilityNote || ''};
  if (registration.sourceFormat === 'zip_entry_pdf' && (!manualWorkerSafeArchiveEntry_(registration.archiveEntry) ||
      !/^[a-f0-9]{64}$/.test(registration.archiveSha256))) throw new Error('WORKER_REVIEWED_REGISTRATION');
  if (!['pdf','zip_entry_pdf'].includes(registration.sourceFormat)) throw new Error('WORKER_REVIEWED_REGISTRATION');
  return registration;
}
function queueReviewedRegisteredManualFromTestUi(docKey, token) {
  assertEditorOnlyTestUiMaintenance_(token);
  // Deliberately not readManualRevision_: old manifest can differ until this
  // already-reviewed registration is committed as one complete worker bundle.
  const registration = reviewedManualWorkerRegistration_(docKey);
  const fingerprint = manualIndexDigest_(Utilities.newBlob(JSON.stringify(registration)).getBytes());
  const candidate = Object.assign({},registration,{reviewedFingerprint:fingerprint,
    workerBinding:{schemaVersion:1,sourcePdfSha256:registration.sourcePdfSha256,models:registration.models.slice(),
      documentRole:registration.documentRole,verifiedAt:new Date().toISOString()}});
  savePendingManualRevision_(candidate,registration.sourcePdfSha256,registration.sourceFileName,'PAGE_INDEX_BUILD_REQUIRED');
  return {ok:true,docKey:docKey,model:registration.fullSku,sourcePdfSha256:registration.sourcePdfSha256,providerCalls:0};
}
