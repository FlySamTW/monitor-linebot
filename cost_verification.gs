/** Isolated, editor-authorized verification. Never used by chat or schedules. */
function readProviderCostReport_() {
  const props=PropertiesService.getScriptProperties(),month=providerMonthKey_();
  const ledger=JSON.parse(props.getProperty(month)||"null");
  const batch=ledger?.verifications?.[PROVIDER_VERIFICATION_BATCH]||{spent:0,reserved:0};
  return {version:GAS_VERSION,build:BUILD_TIMESTAMP,month:month,batch:PROVIDER_VERIFICATION_BATCH,cap:PROVIDER_VERIFICATION_CAP_TWD,
    verificationBatch:PROVIDER_VERIFICATION_BATCH,authorizedCapTwd:PROVIDER_VERIFICATION_CAP_TWD,
    spent:batch.spent,reserved:batch.reserved,remaining:Math.max(0,PROVIDER_VERIFICATION_CAP_TWD-batch.spent-batch.reserved),
    ledger:JSON.parse(props.getProperty(month)||"null"),models:{fast:GEMINI_MODEL_FAST,pdf:GEMINI_MODEL_THINK,web:GEMINI_MODEL_WEB,router:JEV_MODEL_ROUTER},
    strategy:LOCAL_EVIDENCE_STRATEGY,inspectionCount:listManualIdentityInspections_().length,
    pricesVerifiedAt:PROVIDER_PRICE_VERIFIED_AT,amountMeaning:"供應商回報或依用量估算；不是 Cloud 帳單實付"};
}
function probeLowCostModels_() {
  const results=[];
  ["models/gemini-2.5-flash","models/gemini-3.1-flash-lite"].forEach(function(model){
    resetRequestAudit_();
    try {
      const response=providerFetch_(CONFIG.API_ENDPOINT+"/"+model+":generateContent",{geminiApiKey:getGeminiApiKey_(),providerPurpose:"diagnostic",
        method:"post",contentType:"application/json",muteHttpExceptions:true,budgetInputTokens:16,
        payload:JSON.stringify({contents:[{parts:[{text:"Reply only OK"}]}],generationConfig:{maxOutputTokens:8,temperature:0,thinkingConfig:providerThinkingConfigForModel_(model)}})});
      const body=JSON.parse(response.getContentText());
      const answer=(((body.candidates||[])[0]||{}).content?.parts||[]).map(function(p){return p.text||"";}).join("");
      results.push({model:model,httpStatus:response.getResponseCode(),answered:/OK/.test(answer),
        outcome:currentRequestAudit.providerOutcome,receipts:currentRequestAudit.providerReceipts||[]});
    } catch(error){results.push({model:model,error:redactProviderSecrets_(error.message),receipts:currentRequestAudit.providerReceipts||[]});}
  });
  PropertiesService.getScriptProperties().setProperty("LOW_COST_MODEL_PROBE_V324",JSON.stringify({at:new Date().toISOString(),results:results}));
  return {results:results,report:readProviderCostReport_()};
}
// Google restricts the native /dev URL to project editors. No email scope,
// query-string credential, or anonymous token issuance is permitted here.
function buildProviderDiagnosticsPage_() {
  const serviceUrl=String(ScriptApp.getService().getUrl()||"");
  if(!/\/dev(?:[?#].*)?$/.test(serviceUrl))return buildUnauthorizedResponse_();
  const token=Utilities.getUuid(),template=HtmlService.createTemplateFromFile("Diagnostics");
  CacheService.getScriptCache().put("provider_diagnostic_"+token,BUILD_TIMESTAMP,900);
  template.diagnosticToken=token;
  return template.evaluate().setTitle("模型與費用診斷").addMetaTag("viewport","width=device-width, initial-scale=1");
}
function assertCostComparisonEditor_(token) {
  if(typeof token!=="string"||!token||CacheService.getScriptCache().get("provider_diagnostic_"+token)!==BUILD_TIMESTAMP)
    throw new Error("EDITOR_DIAGNOSTIC_SESSION_REQUIRED");
}
function runProviderCostReadback(token) {
  assertCostComparisonEditor_(token);
  return readProviderCostReport_();
}
function runGenerationModelComparison(token) {
  assertCostComparisonEditor_(token);
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(5000))throw new Error("COMPARISON_BUSY");
  const props=PropertiesService.getScriptProperties(),key="GENERATION_COMPARISON_V324";
  // Never repeat paid comparisons just because reading the browser log failed.
  let existing;
  try {
    existing=JSON.parse(props.getProperty(key)||"null");
    if(!existing||existing.build!==BUILD_TIMESTAMP)props.setProperty(key,JSON.stringify({
      version:GAS_VERSION,build:BUILD_TIMESTAMP,batch:PROVIDER_VERIFICATION_BATCH,status:"started",startedAt:new Date().toISOString()}));
  } finally {lock.releaseLock();}
  if(existing&&existing.build===BUILD_TIMESTAMP) {
    if(existing.chunks)existing.results=JSON.parse(Array.from({length:existing.chunks},(_,i)=>props.getProperty(key+"_"+i)||"").join(""));
    return {comparison:existing,report:readProviderCostReport_()};
  }
  const previous=IS_TEST_MODE;IS_TEST_MODE=true;
  const comparison={version:GAS_VERSION,build:BUILD_TIMESTAMP,batch:PROVIDER_VERIFICATION_BATCH,
    startedAt:new Date().toISOString(),status:"started",results:[],qualityAccepted:false,lineDelivered:false};
  const save=function(){
    const results=JSON.stringify(comparison.results),chunks=Math.ceil(results.length/2000);
    for(let i=0;i<chunks;i++)props.setProperty(key+"_"+i,results.slice(i*2000,(i+1)*2000));
    props.setProperty(key,JSON.stringify(Object.assign({},comparison,{results:undefined,chunks:chunks})));
  };
  save();
  try {
    const priorProbe=JSON.parse(props.getProperty("LOW_COST_MODEL_PROBE_V324")||"null");
    const probeAge=priorProbe ? Date.now()-Date.parse(priorProbe.at) : Infinity;
    if(probeAge>=0&&probeAge<60*60*1000&&Array.isArray(priorProbe.results)&&
      ["models/gemini-2.5-flash","models/gemini-3.1-flash-lite"].every(m=>priorProbe.results.some(p=>p.model===m))) {
      comparison.modelProbe=priorProbe.results;comparison.modelProbeReusedFrom=priorProbe.at;
    } else comparison.modelProbe=probeLowCostModels_().results;
    save();
    const models=comparison.modelProbe.filter(r=>r.httpStatus===200&&r.answered).map(r=>r.model);
    const cases=[
      {id:"H6",question:"S32FM803UC 要跟藍牙遊戲控制器配對，從哪開始？",model:"S32FM803UC"},
      {id:"H8",question:"USB-C 連接埠的瓦數，是代表每台筆電都會得到同樣功率嗎？",model:""},
      {id:"H10",question:"畫面分割與把視窗排在桌面上，是同一種功能嗎？",model:""}
    ];
    cases.forEach(function(item){
      const evidence=collectLocalAnswerEvidence_(item.question,item.model);
      const evidenceSha256=lineAcceptanceHash_(JSON.stringify(evidence));
      models.forEach(function(generationModel){
        resetRequestAudit_();const started=Date.now();
        const row={id:item.id,question:item.question,model:generationModel,evidenceSha256:evidenceSha256};
        try {row.result=decideLocalEvidence_(item.question,item.model,"","lite",{
          classifyScope:true,comparisonModel:generationModel,comparisonEvidence:evidence});}
        catch(error){row.error=redactProviderSecrets_(error.message);}
        row.latencyMs=Date.now()-started;row.receipts=currentRequestAudit.providerReceipts||[];
        comparison.results.push(row);save();
      });
    });
    comparison.status=models.length===2?"comparison_returned":"model_unavailable";
  } catch(error) {comparison.status="failed";comparison.error=redactProviderSecrets_(error.message);}
  finally {comparison.finishedAt=new Date().toISOString();save();IS_TEST_MODE=previous;flushLogs();}
  return {comparison:comparison,report:readProviderCostReport_()};
}
function compareLocalEvidenceFromTestUi(cases,token) {
  assertEditorOnlyTestUiMaintenance_(token);
  if(!Array.isArray(cases)||cases.length<1||cases.length>5)throw new Error("COMPARISON_CASE_LIMIT");
  const previous=IS_TEST_MODE;IS_TEST_MODE=true;
  try {
    const results=cases.map(function(item){
      if(typeof item.question!=="string"||item.question.length>500)throw new Error("COMPARISON_QUESTION");
      const model=normalizeModelForDisplay(item.model||"");
      const evidence=collectLocalAnswerEvidence_(item.question,model);
      const compared={question:item.question,model:model,evidence:evidence};
      ["jev","lite"].forEach(function(strategy){
        resetRequestAudit_();const started=Date.now();
        try {compared[strategy]=decideLocalEvidence_(item.question,model,"EDITOR_COMPARISON",strategy);}
        catch(error){compared[strategy]={failure:redactProviderSecrets_(error.message)};}
        compared[strategy].latencyMs=Date.now()-started;compared[strategy].receipts=currentRequestAudit.providerReceipts||[];
      });return compared;
    });
    writeLog("[Local Evidence Comparison] "+JSON.stringify(results.map(function(r){return {question:r.question,model:r.model,jev:r.jev,lite:r.lite};})));
    return {results:results,report:readProviderCostReport_()};
  } finally {IS_TEST_MODE=previous;flushLogs();}
}
