/** Discovery is isolated from publication. Only the signed local worker extracts pages. */
const MANUAL_COVER_EXTRACTOR = "pymupdf-page1-v1";
const MANUAL_IDENTITY_POLICY = "cover-v324-1";
const MANUAL_WORKER_INDEX_POLICY = "pages-v324-1";
// v323 uses the same page extractor/lexicon; legacy active indexes need a probe, not a rebuild.
const MANUAL_WORKER_LEGACY_INDEX_POLICY = "pages-v324-1";

function manualIdentityKey_(sha) {
  return "MANUAL_COVER_" + MANUAL_COVER_EXTRACTOR + "_" + MANUAL_IDENTITY_POLICY + "_" + String(sha).toLowerCase();
}
function readManualJson_(key) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(key) || "null"); }
  catch (_) { return null; }
}
function saveManualJson_(key, value) {
  const raw = JSON.stringify(value);
  if (Utilities.newBlob(raw).getBytes().length > 8500) throw new Error("WORKER_RECEIPT_SIZE");
  PropertiesService.getScriptProperties().setProperty(key, raw);
}
function queueManualIdentityInspection_(candidate, sha) {
  sha = String(sha).toLowerCase();
  if (!manualWorkerOfficialUrl_(candidate.downloadUrl) || !isOfficialSupportPageBoundManualCandidate_(candidate) ||
      !/^[a-f0-9]{64}$/.test(sha)) throw new Error("WORKER_INSPECTION_SOURCE");
  const key = "MANUAL_INSPECT_" + String(candidate.fullSku).toUpperCase();
  let job = readManualJson_(key);
  if (!job || job.sourcePdfSha256 !== sha || job.policy !== MANUAL_IDENTITY_POLICY) {
    job = {candidate:candidate, sourcePdfSha256:sha, policy:MANUAL_IDENTITY_POLICY,
      stage:"content_fetched", attempts:0, nextRetryAt:0, detectedAt:new Date().toISOString()};
    saveManualJson_(key, job);
  }
  const receipt = readManualJson_(manualIdentityKey_(sha));
  if (receipt && receipt.result && job.stage !== "sku_verified") applyManualIdentityReceipt_(key, job, receipt);
  return Object.assign({}, candidate, {sha256:sha, action:"INSPECTION_PENDING",
    manualStatus:job.stage === "blocked" ? "PENDING_MANUAL_REVIEW" : "PENDING_PAGE_INDEX",
    validationReason:job.reason || "LOCAL_FIRST_PAGE_INSPECTION_REQUIRED"});
}
function listManualIdentityInspections_() {
  const props = PropertiesService.getScriptProperties().getProperties();
  return Object.keys(props).filter(function(k){return k.indexOf("MANUAL_INSPECT_") === 0;}).map(function(k){
    const j=readManualJson_(k);
    if (!j || j.policy !== MANUAL_IDENTITY_POLICY || ["sku_verified","blocked"].includes(j.stage) ||
        Number(j.nextRetryAt || 0)>Date.now() || Number(j.attempts || 0)>=3) return null;
    return {inspectionKey:k, fullSku:j.candidate.fullSku, downloadUrl:j.candidate.downloadUrl,
      sourcePdfSha256:j.sourcePdfSha256, policy:j.policy};
  }).filter(Boolean).slice(0,20);
}
function evaluateManualCoverIdentity_(result, candidate) {
  const models = Array.isArray(result.page1Models) ? result.page1Models.slice(0,60) : [];
  let name = buildOfficialManualFinalFileName_(models, candidate.fullSku);
  let binding="pdf_first_page", exact=true;
  if (!name && result.page1Readable === true && result.isSamsungMonitorManual === true) {
    name=buildOfficialSupportPageFamilyPatternFileName_(models,candidate);
    if(name){binding="official_support_page_family_pattern";exact=false;}
  }
  if (!name && !models.length && result.page1Readable === true && result.isSamsungMonitorManual === true &&
      isOfficialSupportPageBoundManualCandidate_(candidate)) {
    name=buildOfficialManualFinalFileName_([normalizeModelForDisplay(candidate.fullSku)],candidate.fullSku);
    binding="official_support_page";exact=false;
  }
  return {valid:result.page1Readable === true && result.isSamsungMonitorManual === true && Boolean(name),
    finalFileName:name || "", modelBinding:binding, exactModelInDocument:exact};
}
function applyManualIdentityReceipt_(key, job, receipt) {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(3000))throw new Error("WORKER_BUSY");
  try {
  const current=readManualJson_(key);
  if(!current || current.sourcePdfSha256!==job.sourcePdfSha256 || current.policy!==job.policy ||
    JSON.stringify(current.candidate)!==JSON.stringify(job.candidate)) throw new Error("WORKER_INSPECTION_CHANGED");
  const identity=evaluateManualCoverIdentity_(receipt.result,job.candidate);
  if(identity.valid) {
    const candidate=Object.assign({},job.candidate,identity,{workerBinding:{schemaVersion:1,
      sourcePdfSha256:job.sourcePdfSha256, models:[normalizeModelForDisplay(job.candidate.fullSku)],
      documentRole:"manual", verifiedAt:new Date().toISOString()}});
    savePendingManualRevision_(candidate,job.sourcePdfSha256,identity.finalFileName,"PAGE_INDEX_BUILD_REQUIRED");
    job.stage="sku_verified"; job.reason="";
  } else {job.stage="blocked";job.reason="FIRST_PAGE_IDENTITY_NOT_VERIFIED";}
  job.identityReceipt=manualIdentityKey_(job.sourcePdfSha256);
  job.updatedAt=new Date().toISOString(); saveManualJson_(key,job);
  } finally {lock.releaseLock();}
}
function failManualWorkerInspection_(payload) {
  const lock=LockService.getScriptLock();if(!lock.tryLock(3000))throw new Error("WORKER_BUSY");
  try {
  const job=readManualJson_(payload.inspectionKey);
  if(!job || job.sourcePdfSha256!==payload.sourcePdfSha256)throw new Error("WORKER_INSPECTION_BINDING");
  job.attempts=Number(job.attempts||0)+1;job.nextRetryAt=Date.now()+86400000;
  job.stage=job.attempts>=3?"blocked":"retry_wait";
  job.reason=/^WORKER_[A-Z_]+$/.test(payload.error||"")?payload.error:"WORKER_LOCAL_EXTRACTION_FAILED";
  saveManualJson_(payload.inspectionKey,job);return {ok:true,stage:job.stage};
  } finally {lock.releaseLock();}
}
function inspectManualWorkerCover_(payload) {
  const job=readManualJson_(payload.inspectionKey);
  if(!job || job.policy!==MANUAL_IDENTITY_POLICY || job.sourcePdfSha256!==payload.sourcePdfSha256 ||
      !manualWorkerOfficialUrl_(job.candidate.downloadUrl) || !isOfficialSupportPageBoundManualCandidate_(job.candidate))
    throw new Error("WORKER_INSPECTION_BINDING");
  const receiptKey=manualIdentityKey_(job.sourcePdfSha256);
  let receipt=readManualJson_(receiptKey);
  if(receipt && receipt.result) {applyManualIdentityReceipt_(payload.inspectionKey,job,receipt);return {ok:true,reused:true,stage:job.stage};}
  if(job.stage==="blocked" || Number(job.nextRetryAt||0)>Date.now() || Number(job.attempts||0)>=3)
    throw new Error("WORKER_INSPECTION_BLOCKED");
  const lease=acquireManualMaintenanceLease_(receiptKey,false);
  if(!lease) throw new Error("WORKER_BUSY");
  let paidStartedHere=false;
  try {
    receipt=readManualJson_(receiptKey);
    if(receipt && receipt.result) {applyManualIdentityReceipt_(payload.inspectionKey,job,receipt);return {ok:true,reused:true,stage:job.stage};}
    if(receipt && receipt.paidAttempt) {job.stage="blocked";job.reason="COVER_PREVIOUS_ATTEMPT_UNCERTAIN";saveManualJson_(payload.inspectionKey,job);throw new Error("WORKER_INSPECTION_BLOCKED");}
    const text=String(payload.firstPageText||"");
    if(payload.sourcePages?.length!==1 || payload.sourcePages[0]!==1 || text.length>12000 ||
        !/^[a-f0-9]{64}$/.test(payload.derivedSha256||"")) throw new Error("WORKER_FIRST_PAGE_ONLY");
    const models=Array.from(new Set((text.toUpperCase().match(/\b(?:L?[SCFU][0-9]{2,3}[A-Z0-9]{2,}[*]?)/g)||[]))).slice(0,60);
    if(text.trim().length>=40 && manualIndexDigest_(Utilities.newBlob(text).getBytes())!==payload.derivedSha256)
      throw new Error("WORKER_FIRST_PAGE_TEXT_SHA");
    const manualTitle=/user[’']?s?\s*manual|使用[者用]?手冊|使用說明書|用户手册/i.test(text);
    const excluded=/quick\s*(?:setup|start)|product\s*guide|快速[安入]|產品指南/i.test(text);
    let result=null;
    if(manualTitle && !excluded && models.length) result={page1Readable:true,isSamsungMonitorManual:true,page1Models:models};
    if(excluded) result={page1Readable:true,isSamsungMonitorManual:false,page1Models:models};
    if(!result) {
      const parts=[{text:"辨識所附單頁手冊封面。只據這一頁輸出 JSON：page1Readable 布林、isSamsungMonitorManual 布林、page1Models 字串陣列（逐字保留型號尾端 *）。Product Guide／快速入門不是使用手冊。禁止由檔名或常識補型號。\n"+text}];
      if(text.trim().length<40) {
        if(typeof payload.firstPagePng!=="string" || payload.firstPagePng.length>900000) throw new Error("WORKER_FIRST_PAGE_IMAGE_REQUIRED");
        const bytes=Utilities.base64Decode(payload.firstPagePng);
        if(manualIndexDigest_(bytes)!==payload.derivedSha256 || bytes.slice(0,4).map(function(b){return b&255;}).join(",")!=="137,80,78,71") throw new Error("WORKER_FIRST_PAGE_IMAGE_SHA");
        parts.push({inlineData:{mimeType:"image/png",data:payload.firstPagePng}});
      } else if(manualIndexDigest_(Utilities.newBlob(text).getBytes())!==payload.derivedSha256) throw new Error("WORKER_FIRST_PAGE_TEXT_SHA");
      paidStartedHere=true;
      receipt={policy:MANUAL_IDENTITY_POLICY,sourcePdfSha256:job.sourcePdfSha256,paidAttempt:true,startedAt:new Date().toISOString()};
      saveManualJson_(receiptKey,receipt);
      lastProviderCostReservation_=null;
      const response=providerFetch_(`${CONFIG.API_ENDPOINT}/${GEMINI_MODEL_FAST}:generateContent`,{
        geminiApiKey:getGeminiApiKey_(),method:"post",contentType:"application/json",muteHttpExceptions:true,
        providerPurpose:"manual_cover",providerJobId:receiptKey,
        payload:JSON.stringify({contents:[{role:"user",parts:parts}],generationConfig:{temperature:0,maxOutputTokens:400,
          thinkingConfig:providerThinkingConfigForModel_(GEMINI_MODEL_FAST),responseMimeType:"application/json"}})});
      if(response.getResponseCode()!==200) throw new Error("WORKER_COVER_PROVIDER_FAILED");
      const body=JSON.parse(response.getContentText());
      const answer=(((body.candidates||[])[0]||{}).content?.parts||[]).filter(function(p){return p.text&&!p.thought;}).map(function(p){return p.text;}).join("");
      result=JSON.parse(answer);
      if(typeof result.page1Readable!=="boolean" || typeof result.isSamsungMonitorManual!=="boolean" ||
          !Array.isArray(result.page1Models) || result.page1Models.length>60 || result.page1Models.some(function(m){return typeof m!=="string"||m.length>40;})) throw new Error("WORKER_COVER_OUTPUT");
    }
    receipt=Object.assign({},receipt||{}, {policy:MANUAL_IDENTITY_POLICY,sourcePdfSha256:job.sourcePdfSha256,
      derivedSha256:payload.derivedSha256,sourcePages:[1],result:result,finishedAt:new Date().toISOString()});
    saveManualJson_(receiptKey,receipt); applyManualIdentityReceipt_(payload.inspectionKey,job,receipt);
    writeLog(`[Manual Identity] sha=${job.sourcePdfSha256} sku=${job.candidate.fullSku} stage=${job.stage} paid=${Boolean(receipt.paidAttempt)}`);
    return {ok:true,stage:job.stage};
  } catch(error) {
    if(String(error.message)==="WORKER_INSPECTION_CHANGED")throw error;
    const current=readManualJson_(payload.inspectionKey);
    if(!current || current.sourcePdfSha256!==job.sourcePdfSha256)throw error;
    job.reason=String(error.message||"WORKER_INSPECTION_FAILED").substring(0,100);
    const paid=readManualJson_(receiptKey);
    const notSent=paidStartedHere && !(lastProviderCostReservation_?.jobId===receiptKey && lastProviderCostReservation_.sent);
    const budgetWait=notSent && /BUDGET/.test(job.reason);
    if(!budgetWait)job.attempts=Number(job.attempts||0)+1;
    if(notSent && paid && !paid.result){PropertiesService.getScriptProperties().deleteProperty(receiptKey);}
    job.stage=(paid?.paidAttempt&&!notSent)||job.attempts>=3 ? "blocked" : "retry_wait";
    job.nextRetryAt=Date.now()+86400000; saveManualJson_(payload.inspectionKey,job); throw error;
  } finally {finishManualMaintenanceLease_(lease,true);}
}

function recordManualIndexFailure_(payload) {
  const lock=LockService.getScriptLock();if(!lock.tryLock(3000))throw new Error("WORKER_BUSY");
  try {
    const item=manualWorkerPending_().find(function(p){return p.pendingKey===payload.pendingKey && p.sourcePdfSha256===payload.sourcePdfSha256;});
    if(!item)throw new Error("WORKER_PENDING_BINDING");
    const key="MANUAL_PROGRESS_"+normalizeModelForDisplay(item.fullSku),old=readManualJson_(key);
    if(old?.sourcePdfSha256===item.sourcePdfSha256 && old.stage==="verified_ready")return {ok:true,stage:old.stage};
    const attempts=old?.sourcePdfSha256===item.sourcePdfSha256 && old.indexPolicy===MANUAL_WORKER_INDEX_POLICY?Number(old.attempts||0)+1:1;
    const receipt={sourcePdfSha256:item.sourcePdfSha256,indexPolicy:MANUAL_WORKER_INDEX_POLICY,
      stage:attempts>=3?"blocked":"index_retry_wait",attempts:attempts,nextRetryAt:Date.now()+86400000,
      failureStage:String(payload.stage||"local_build").slice(0,40),httpStatus:Number(payload.httpStatus||0),
      error:/^WORKER_[A-Z_]+$/.test(payload.error||"")?payload.error:"WORKER_BUILD_FAILED"};
    saveManualJson_(key,receipt);return {ok:true,stage:receipt.stage};
  } finally {lock.releaseLock();}
}
