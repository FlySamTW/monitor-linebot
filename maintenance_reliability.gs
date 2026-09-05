/** Editor-only private entry points. Trailing _ prevents google.script.run
 * exposure; neither doGet/doPost nor a scheduler dispatches these functions.
 * Uses existing editor authorization, without adding userinfo.email scope. */
function runReliabilityMaintenanceFromTestUi(action, token) {
  assertEditorOnlyTestUiMaintenance_(token);
  if (action === "repair") return adminRepairManualRevisionsV303_();
  if (action === "compare") {
    const lease = acquireManualMaintenanceLease_("FILESEARCH_LAB_V303", false);
    if (!lease) return {busy:true};
    try { return adminRunFileSearchComparisonV303_(); }
    finally { finishManualMaintenanceLease_(lease, true); }
  }
  if (action === "report") return readReliabilityReportV303_();
  throw new Error("UNKNOWN_RELIABILITY_ACTION");
}

function readReliabilityReportV303_() {
  const props = PropertiesService.getScriptProperties();
  const results = [];
  for (let i = 1; i <= 10; i++) {
    const receipt = JSON.parse(props.getProperty(`FILESEARCH_LAB_V303_Q${i}`) || "null");
    if (receipt && receipt.complete && receipt.artifactId) {
      results.push(JSON.parse(DriveApp.getFileById(receipt.artifactId).getBlob().getDataAsString()));
    }
  }
  return {repair:JSON.parse(props.getProperty("RELIABILITY_REPAIR_V303") || "null"),
    state:JSON.parse(props.getProperty("FILESEARCH_LAB_V303") || "null"),
    budget:JSON.parse(props.getProperty(providerMonthKey_()) || "null"),results:results};
}

function adminRepairManualRevisionsV303_() {
  assertManualFolderWritable_();
  IS_TEST_MODE = true; // Includes maintenance generation in the same NT$5 test cap.
  resetRequestAudit_();
  const report = {version:GAS_VERSION, documents:[], indexes:null};
  try {
    ["LS27H704EACXZW", "LS32HG806ESXZW"].forEach(function (sku) {
      try { report.documents.push({sku:sku, result:auditOfficialManualSkuMaintenance_(sku)}); }
      catch (error) { report.documents.push({sku:sku, error:String(error.message).slice(0,180)}); }
    });
    report.indexes = publishCompiledManualIndexes_();
    report.costTwd = currentRequestAudit ? currentRequestAudit.estimatedCostTwd : 0;
    PropertiesService.getScriptProperties().setProperty("RELIABILITY_REPAIR_V303", JSON.stringify(report));
    console.log(JSON.stringify(report));
  } finally { flushLogs(); }
  return report;
}

function fileSearchLabRequest_(path, method, body) {
  if (!/^(?:fileSearchStores(?:\/[-a-zA-Z0-9]+(?:\/operations\/[-a-zA-Z0-9]+)?)?(?::importFile)?|files\/[-a-zA-Z0-9]+)(?:\?force=true)?$/.test(path)) throw new Error("LAB_RESOURCE_INVALID");
  const key = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  const response = UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/v1beta/${path}${path.indexOf("?")<0 ? "?" : "&"}key=${key}`, {
    method:method, contentType:"application/json", muteHttpExceptions:true,
    ...(body ? {payload:JSON.stringify(body)} : {}),
  });
  if (response.getResponseCode() >= 300) throw new Error(`LAB_HTTP_${response.getResponseCode()}: ${response.getContentText().slice(0,250)}`);
  return JSON.parse(response.getContentText() || "{}");
}

function adminRunFileSearchComparisonV303_() {
  assertManualFolderWritable_();
  IS_TEST_MODE = true;
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty("GEMINI_API_KEY");
  const stateKey = "FILESEARCH_LAB_V303";
  let state = JSON.parse(props.getProperty(stateKey) || "null");
  if (state && (state.done || state.failed)) { console.log(JSON.stringify(state)); return state; }
  const started = Date.now();
  const model = "S32FM803UC";
  const doc = MANUAL_PAGE_RAG_DATA_.documents.M8_FM70X_FM803;
  const questions = ["怎麼開啟零售模式？", "插隨身碟後怎麼播放影片？", "藍牙喇叭怎麼連？", "Wi-Fi 要在哪裡連線？", "手機畫面怎麼投影？", "藍牙鍵盤怎麼配對？", "如何安裝 App？", "韌體要怎麼更新？", "怎麼恢復原廠設定？", "睡眠計時器在哪裡設定？"];
  resetRequestAudit_();
  try {
    if (!state) {
      const files = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID).getFilesByName(doc.sourceFileName);
      if (!files.hasNext()) throw new Error("LAB_EXACT_PDF_MISSING");
      const file = files.next();
      if (files.hasNext()) throw new Error("LAB_DUPLICATE_PDF");
      const blob = file.getBlob();
      if (manualIndexDigest_(blob.getBytes()) !== doc.sourcePdfSha256.toLowerCase()) throw new Error("LAB_PDF_SHA_MISMATCH");
      const uri = uploadFileToGemini(key, blob, blob.getBytes().length, "application/pdf");
      if (!uri) throw new Error("LAB_UPLOAD_FAILED");
      const fileName = (uri.match(/files\/[-a-zA-Z0-9]+/) || [])[0];
      if (!fileName) throw new Error("LAB_UPLOAD_RESOURCE_INVALID");
      state = {fileName:fileName, cursor:0, done:false, sha:doc.sourcePdfSha256};
      props.setProperty(stateKey,JSON.stringify(state));
      const countResponse = UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:countTokens?key=${key}`, {
        method:"post",contentType:"application/json",payload:JSON.stringify({contents:[{parts:[{fileData:{fileUri:uri,mimeType:"application/pdf"}}]}]}),muteHttpExceptions:true,
      });
      const fullTokens = Number(JSON.parse(countResponse.getContentText()).totalTokens || 0);
      if (!fullTokens || fullTokens > 150000) throw new Error("LAB_TOKEN_PREFLIGHT_FAILED");
      const store = fileSearchLabRequest_("fileSearchStores", "post", {displayName:"Samsung-v303-isolated-M8-comparison",embeddingModel:"models/gemini-embedding-001"});
      state = {store:store.name, fileName:fileName, fullTokens:fullTokens, cursor:0, done:false, sha:doc.sourcePdfSha256};
      props.setProperty(stateKey,JSON.stringify(state));
      // Import embedding usage is not returned as generateContent usage. Keep
      // a conservative 2x full-document estimate (including overlap), never 0.
      const reservation = {month:providerMonthKey_(),amount:fullTokens*2*0.15/1e6*EXCHANGE_RATE,verification:true,sent:false};
      changeProviderBudget_(reservation,null,false);
      try {
        reservation.sent=true;
        const operation=fileSearchLabRequest_(`${store.name}:importFile`,"post",{fileName:fileName,customMetadata:[{key:"canonical_model",stringValue:model},{key:"sha256",stringValue:doc.sourcePdfSha256}]});
        state.operation=operation.name; state.ingestionDone=operation.done===true;
        if(operation.error) throw new Error(`LAB_IMPORT_${operation.error.code}`);
      } finally {
        changeProviderBudget_(reservation,reservation.sent?reservation.amount:0,reservation.sent);
        state.embeddingConservativeTwd=reservation.amount;
        props.setProperty(stateKey,JSON.stringify(state));
      }
    }
    if (!state.ingestionDone) {
      const operation=fileSearchLabRequest_(state.operation,"get");
      if(operation.error) throw new Error(`LAB_IMPORT_${operation.error.code}`);
      if(!operation.done) {console.log("LAB_IMPORT_PENDING; no generation started");return state;}
      state.ingestionDone=true;props.setProperty(stateKey,JSON.stringify(state));
    }
    while(state.cursor<questions.length && Date.now()-started<210000) {
      const index=state.cursor, question=questions[index];
      const resultKey=`FILESEARCH_LAB_V303_Q${index+1}`;
      let result=JSON.parse(props.getProperty(resultKey)||"null") || {question:question,model:model};
      if (result.complete) {
        state.cursor++;
        props.setProperty(stateKey,JSON.stringify(state));
        continue;
      }
      if(!result.page) {
        resetRequestAudit_(); const t=Date.now();
        const response=callManualPageRag_(question,model,"",null,null);
        result.page={answer:String(response.response||""),attempted:response.attempted,cost:currentRequestAudit.estimatedCostTwd,ms:Date.now()-t};
        props.setProperty(resultKey,JSON.stringify(result));
      }
      resetRequestAudit_(); const t=Date.now();
      const response=providerFetch_(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`, {
        budgetInputTokens:state.fullTokens,method:"post",contentType:"application/json",muteHttpExceptions:true,
        payload:JSON.stringify({contents:[{parts:[{text:`只依這本 ${model} 官方手冊回答：${question}。請提供操作步驟、頁碼與限制，找不到就明說，勿借其他型號。`}]}],tools:[{fileSearch:{fileSearchStoreNames:[state.store]}}],generationConfig:{temperature:0,maxOutputTokens:700,thinkingConfig:{thinkingBudget:0}}}),
      });
      const body=JSON.parse(response.getContentText()||"{}");
      result.fileSearch={http:response.getResponseCode(),answer:((((body.candidates||[])[0]||{}).content||{}).parts||[]).map(p=>p.text||"").join(""),grounding:((body.candidates||[])[0]||{}).groundingMetadata||null,cost:currentRequestAudit.estimatedCostTwd,ms:Date.now()-t};
      // Full citations may exceed ScriptProperties' per-value size. Keep the
      // complete result in Drive and only a compact, resumable receipt here.
      const artifact = Drive.Files.create({name:`v303_file_search_ab_${index+1}.json`,parents:[CONFIG.DRIVE_FOLDER_ID],mimeType:"application/json"},Utilities.newBlob(JSON.stringify(result),"application/json"),{fields:"id"});
      props.setProperty(resultKey,JSON.stringify({question:question,model:model,artifactId:artifact.id,complete:true,costTwd:result.page.cost+result.fileSearch.cost}));
      console.log(JSON.stringify({question:question,page:result.page,fileSearch:result.fileSearch}));
      if(response.getResponseCode()>=300) throw new Error(`LAB_QUERY_HTTP_${response.getResponseCode()}: ${String(body.error&&body.error.message||"").slice(0,200)}`);
      state.cursor++;props.setProperty(stateKey,JSON.stringify(state));
    }
    state.done=state.cursor===questions.length;
  } catch(error) {
    state=state||{};state.failed=String(error.message).slice(0,300);
    console.log(JSON.stringify({failure:state.failed}));
  } finally {
    if(state&&(state.done||state.failed)) {
      try {if(state.store)fileSearchLabRequest_(`${state.store}?force=true`,"delete");if(state.fileName)fileSearchLabRequest_(state.fileName,"delete");state.cleaned=true;}
      catch(error){state.cleanupPending=String(error.message).slice(0,200);}
    }
    if(state)props.setProperty(stateKey,JSON.stringify(state));
    flushLogs();
  }
  console.log(JSON.stringify(state));return state;
}
