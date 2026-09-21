/** Explicit purposes, conservative reservations and immutable per-attempt receipts. */
const PROVIDER_VERIFICATION_BATCH = "v324-cost-remediation";
const PROVIDER_VERIFICATION_CAP_TWD = 10;
const PROVIDER_TURN_LIMIT_TWD = 2;
const PROVIDER_TURN_MAX_ATTEMPTS = 5;
let providerTurnBudget_ = null;
let lastProviderCostReservation_ = null;

function providerCostScope_(options, model, search) {
  const purpose=String(options.providerPurpose || (pendingProviderAttempt_ && pendingProviderAttempt_.stage) || "");
  const jobId=String(options.providerJobId || "");
  delete options.providerPurpose; delete options.providerJobId;
  const roles=["fast","pdf","web","router","evidence_verify","qa_semantic","qa_candidate","qa_merge","qa_refine","qa_polish",
    "qa_match","qa_modify","qa_auto","rule_polish","rule_modify","history_summary","message_helper","diagnostic","manual_cover"];
  if(purpose==="manual_cover" && /application\/pdf|file_uri|fileUri/.test(options.payload||""))throw new Error("PROVIDER_COVER_SINGLE_PAGE_ONLY");
  if(!roles.includes(purpose)) throw new Error("PROVIDER_PURPOSE_REQUIRED");
  const normalized=String(model).replace(/^models\//,"");
  const approved=purpose==="diagnostic" ? ["gemini-2.5-flash-lite","gemini-2.5-flash","gemini-3.1-flash-lite"] :
    purpose==="router"||purpose==="qa_candidate"||purpose==="evidence_verify" ? [JEV_MODEL_ROUTER] :
    purpose==="web" ? [GEMINI_MODEL_WEB.replace(/^models\//,"")] :
    purpose==="pdf" ? [GEMINI_MODEL_FAST.replace(/^models\//,""),GEMINI_MODEL_THINK.replace(/^models\//,"")] :
    [GEMINI_MODEL_FAST.replace(/^models\//,""),GEMINI_MODEL_POLISH.replace(/^models\//,"")];
  if(!approved.includes(normalized)) throw new Error("PROVIDER_ROLE_MODEL_NOT_APPROVED");
  if(search && !["web","diagnostic"].includes(purpose)) throw new Error("PROVIDER_PURPOSE_TOOL_MISMATCH");
  return {purpose:purpose,jobId:jobId,model:normalized,receiptId:Utilities.getUuid(),
    payloadSha:manualIndexDigest_(Utilities.newBlob(options.payload||"").getBytes()),search:search,
    inputKind:/"(?:fileData|file_data|inlineData|inline_data)"/.test(options.payload||"") ? "attachment" : "text"};
}
function prepareProviderCostReservation_(reservation,scope) {
  Object.assign(reservation,scope);
  lastProviderCostReservation_=reservation;
  reservation.verificationBatch=PROVIDER_VERIFICATION_BATCH;
  if(scope.purpose==="manual_cover" && (!scope.jobId || reservation.amount>0.05)) throw new Error("PROVIDER_COVER_BUDGET_EXHAUSTED");
  if(scope.purpose==="pdf" && reservation.amount>CONFIG.MAX_PDF_ESTIMATED_TOTAL_COST_TWD) throw new Error("PROVIDER_PDF_BUDGET_EXHAUSTED");
  const isTurn=typeof currentRequestAudit!=="undefined" && currentRequestAudit && scope.purpose!=="manual_cover";
  if(isTurn) {
    if(!providerTurnBudget_) providerTurnBudget_={id:Utilities.getUuid(),spent:0,reserved:0,attempts:0};
    if(providerTurnBudget_.attempts>=PROVIDER_TURN_MAX_ATTEMPTS ||
        providerTurnBudget_.spent+providerTurnBudget_.reserved+reservation.amount>PROVIDER_TURN_LIMIT_TWD)
      throw new Error("PROVIDER_TURN_BUDGET_EXHAUSTED");
    reservation.turnId=providerTurnBudget_.id;
  }
}
function accountProviderCostScope_(reservation,actualCost,uncertain) {
  persistProviderAttemptReceipt_(reservation,actualCost===null?"reserved":"settled",actualCost,uncertain);
  if(reservation.turnId && providerTurnBudget_?.id===reservation.turnId) {
    if(actualCost===null) {providerTurnBudget_.reserved+=reservation.amount;providerTurnBudget_.attempts++;}
    else {providerTurnBudget_.reserved=Math.max(0,providerTurnBudget_.reserved-reservation.amount);providerTurnBudget_.spent+=actualCost;}
  }
  if(actualCost!==null && reservation.receiptId) {
    const receipt={id:reservation.receiptId,turnId:reservation.turnId||"",jobId:reservation.jobId||"",
      purpose:reservation.purpose,model:reservation.model,inputKind:reservation.inputKind,payloadSha:reservation.payloadSha,
      inputLimit:reservation.inputLimit,outputLimit:reservation.outputLimit,
      searchCostTwd:reservation.searchCostTwd??null,reservedTwd:reservation.amount,costTwd:actualCost,status:reservation.costStatus||(uncertain?"unknown":"estimated"),
      sent:Boolean(reservation.sent),queryCount:reservation.queryCount??null,responseId:reservation.responseId||"",usage:reservation.usage||null,
      verificationBatch:reservation.verification?reservation.verificationBatch:"",at:new Date().toISOString()};
    if(typeof currentRequestAudit!=="undefined" && currentRequestAudit) {
      if(!currentRequestAudit.providerReceipts) currentRequestAudit.providerReceipts=[];
      currentRequestAudit.providerReceipts.push(receipt);
    }
    try{writeLog("[Provider Receipt] "+JSON.stringify(receipt));}catch(_){console.log("[Provider Receipt] "+JSON.stringify(receipt));}
  }
}
function providerSearchPrice_(model) {
  return String(model).includes("gemini-2.5-") ? {unit:"grounded_prompt",period:"day",free:1500,usd:0.035} :
    {unit:"query",period:"month",free:5000,usd:0.014};
}
function providerSearchMetadata_(body) {
  if(body.webInteractionAudit){const audit=body.webInteractionAudit;return audit.queryCount===null?
    {queryCountUnknown:true,observedQueryCount:audit.observedQueryCount||0}:{webSearchQueries:audit.uniqueQueries};}
  const candidate=(body.candidates||[])[0]||{},metadata=candidate.groundingMetadata;
  if(metadata&&Array.isArray(metadata.webSearchQueries))return metadata;
  const calls=(candidate.content?.parts||[]).map(function(part){return part.toolCall;}).filter(function(call){
    return call&&/^GOOGLE_SEARCH(?:_WEB)?$/.test(call.toolType||"")&&Array.isArray(call.args?.queries);
  });
  // Absence of metadata or trace is still unknown, never assumed to be zero queries.
  return calls.length ? {webSearchQueries:calls.flatMap(function(call){return call.args.queries;})} : null;
}
function settleProviderSearch_(model,metadata) {
  if(!metadata || metadata.queryCountUnknown || !Array.isArray(metadata.webSearchQueries)) return {costTwd:providerSearchPrice_(model).usd*(providerSearchPrice_(model).unit==="query"?Math.max(3,Number(metadata?.observedQueryCount)||0):1)*EXCHANGE_RATE,
    queryCount:null,allowanceKnown:false,unknown:true};
  const rate=providerSearchPrice_(model),queries=Array.from(new Set((metadata?.webSearchQueries||[])
    .filter(function(q){return typeof q==="string"&&q.trim();}).map(function(q){return q.trim();})));
  const quantity=rate.unit==="query" ? queries.length : (queries.length?1:0);
  const props=PropertiesService.getScriptProperties(),lock=LockService.getScriptLock();
  if(!lock.tryLock(5000)) throw new Error("SEARCH_LEDGER_LOCK_BUSY");
  try {
    const period=Utilities.formatDate(new Date(),"America/Los_Angeles",rate.period==="day"?"yyyy-MM-dd":"yyyy-MM");
    const key="PROVIDER_SEARCH_V324_"+rate.unit+"_"+period;
    const previous=Number(props.getProperty(key)||0);props.setProperty(key,String(previous+quantity));
    // Only an editor-confirmed project-wide opening count authorizes free allowance.
    const known=props.getProperty(key+"_OPENING_VERIFIED")==="true";
    const billable=known ? Math.max(0,previous+quantity-rate.free)-Math.max(0,previous-rate.free) : quantity;
    return {costTwd:billable*rate.usd*EXCHANGE_RATE,queryCount:queries.length,allowanceKnown:known};
  } finally {lock.releaseLock();}
}

// Unsettled attempts survive GAS termination; never expire or auto-refund them.
function persistProviderAttemptReceipt_(r,stage,cost,uncertain) {
  if(!r.receiptId)return;
  const props=PropertiesService.getScriptProperties(),key="PROVIDER_ATTEMPT_"+r.receiptId;
  const receipt={id:r.receiptId,stage:stage,month:r.month,purpose:r.purpose,model:r.model,jobId:r.jobId||"",turnId:r.turnId||"",
    inputKind:r.inputKind,payloadSha:r.payloadSha,inputLimit:r.inputLimit,outputLimit:r.outputLimit,
    reservedTwd:r.amount,costTwd:cost===undefined||cost===null?null:cost,status:stage!=="settled"?"pending":(r.costStatus||(uncertain?"unknown":"estimated")),
    queryCount:r.queryCount??null,responseId:r.responseId||"",usage:r.usage||null,sent:Boolean(r.sent),verificationBatch:r.verification?r.verificationBatch:"",at:new Date().toISOString()};
  props.setProperty(key,JSON.stringify(receipt));
  if(stage==="settled") {
    const all=props.getProperties(),finalized=Object.keys(all).filter(k=>k.indexOf("PROVIDER_ATTEMPT_")===0).map(k=>{try{return {key:k,value:JSON.parse(all[k])};}catch(_){return null;}})
      .filter(x=>x&&x.value.stage==="settled").sort((a,b)=>String(b.value.at).localeCompare(String(a.value.at)));
    finalized.slice(80).forEach(x=>props.deleteProperty(x.key));
  }
}
