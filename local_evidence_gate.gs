/** QA/RULE candidate recall precedes paid document retrieval. No case-specific routes. */
const LOCAL_EVIDENCE_STRATEGY = "lite";
const LOCAL_EVIDENCE_POLICY = "qa-rule-v324-8";
let localEvidenceDecision_ = null;
function collectLocalAnswerEvidence_(question,model) {
  const qa=qaKnowledgeSelectPromptContext_(question,model?[model]:[],false,true);
  const evidence=qa.records.map(function(r){return {id:"QA:"+r.id,kind:r.claimKind||"qa",
    question:r.question,text:qaKnowledgeRenderAnswer_(r),scope:r.scope||{}};});
  const rule=model?findExactModelRuleLine_(model):"";
  if(rule) evidence.push({id:"RULE:"+model,kind:"product_facts",text:rule,scope:{models:[model]}});
  const tokens=qaKnowledgeSearchTokens_(question);
  try {
    const sheet=ss.getSheetByName(SHEET_NAMES.CLASS_RULES);
    const rows=sheet&&sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues():[];
    rows.map(function(r,i){return {id:"RULE:row:"+(i+2),text:String(r[0]||"")};}).filter(function(r){
      return /^(?:術語|活動)_/.test(r.text) && (!/^活動_/.test(r.text)||isCampaignRuleCurrentlyActive_(r.text));
    }).map(function(r){return Object.assign(r,{score:tokens.filter(function(t){return qaKnowledgeNormalizeText_(r.text).includes(t);}).length});})
      .filter(function(r){return r.score>0;}).sort(function(a,b){return b.score-a.score;}).slice(0,5)
      .forEach(function(r){evidence.push({id:r.id,kind:/^術語_/.test(r.text)?"definition":"campaign",text:r.text});});
  } catch(error) {writeLog("[Local Evidence] RULE candidates unavailable");}
  return evidence.filter(function(e){return e.text;}).slice(0,10);
}
function localEvidenceContains_(text,quote) {
  const normalize=function(v){return String(v).normalize("NFKC").replace(/\s+/g,"").toLowerCase();};
  return Boolean(quote && normalize(text).includes(normalize(quote)));
}
function validateLocalEvidenceDecision_(output,evidence,question,model) {
  model=normalizeModelForDisplay(model||"");
  if(!output || typeof output!=="object" || Array.isArray(output) || typeof output.complete!=="boolean" ||
    !Array.isArray(output.answers) || !Array.isArray(output.remainingQuestions) ||
    output.remainingQuestions.some(q=>typeof q!=="string"||!q.trim()) ||
    output.answers.some(a=>!a||typeof a.text!=="string"||!Array.isArray(a.evidenceIds)||!Array.isArray(a.quotes)) ||
    (output.complete && output.remainingQuestions.length) || (!output.complete && !output.remainingQuestions.length))throw new Error("LOCAL_OUTPUT_INVALID");
  const byId={};evidence.forEach(function(e){byId[e.id]=e;});
  const answers=[];
  (Array.isArray(output.answers)?output.answers:[]).forEach(function(a){
    const ids=Array.isArray(a.evidenceIds)?a.evidenceIds:[];
    if(!a.text || !ids.length || ids.some(function(id){
      const e=byId[id],models=e&&e.scope&&e.scope.models||[];
      return !e || (models.length && (!model || !models.some(function(m){return qaKnowledgeModelMatches_(m,model);})));
    })) return;
    const quotes=Array.isArray(a.quotes)?a.quotes:[];
    if(!quotes.length || ids.some(function(id){return !quotes.some(function(q){return q.id===id&&localEvidenceContains_(byId[id].text,q.quote);});})) return;
    if(quotes.some(function(q){return !byId[q.id]||!ids.includes(q.id)||!localEvidenceContains_(byId[q.id].text,q.quote);})) return;
    const quoted=quotes.map(function(q){return q.quote;}).join("\n");
    const withoutModels=extractFullModelLikeTokens(a.text).reduce(function(t,m){return t.replace(m,"");},String(a.text));
    const numbers=withoutModels.match(/\d+(?:\.\d+)?/g)||[];
    if(numbers.some(function(n){return !quoted.includes(n);})) return;
    const answerModels=extractFullModelLikeTokens(a.text).map(normalizeModelForDisplay);
    if(model&&answerModels.some(function(m){return m!==model;})) return;
    if(ids.every(function(id){return byId[id].kind==="definition";}) && model && output.complete===true && !isExplicitRuleTermDefinitionQuestion_(question)) return;
    // Existing factual answers are rendered from verified quotations, not an unverified paraphrase.
    const groups=[];
    quotes.forEach(function(q){
      let group=groups.find(function(g){return g.id===q.id;});
      if(!group){group={id:q.id,label:localEvidenceSubject_(byId[q.id]),quotes:[]};groups.push(group);}
      if(!group.quotes.includes(q.quote))group.quotes.push(q.quote);
    });
    answers.push({text:groups.map(function(g){return g.label?g.label+"："+g.quotes.join("；"):g.quotes.join("\n");}).join("\n"),evidenceIds:ids});
  });
  const remaining=Array.isArray(output.remainingQuestions)?output.remainingQuestions.filter(function(q){return typeof q==="string"&&q.trim();}):[question];
  const complete=output.complete===true && answers.length>0 && answers.length===(output.answers||[]).length && remaining.length===0;
  const result={answer:answers.map(function(a){return a.text;}).join("\n"),answers:answers,complete:complete,
    remainingQuestions:complete?[]:(remaining.length?remaining:[question]),evidenceIds:answers.flatMap(function(a){return a.evidenceIds;}),
    sourceTags:Array.from(new Set(answers.flatMap(function(a){return a.evidenceIds.map(function(id){
      const e=byId[id];return e.kind==="verified_manual"?"[來源:官方手冊]":e.kind==="campaign"?"[來源:官方活動庫]":id.startsWith("QA:")?"[來源:QA庫]":"[來源:官方規格庫]";
    });})))};
  if(output.answers.length>answers.length || (output.complete&&!answers.length)) {
    const error=new Error("LOCAL_EVIDENCE_VALIDATION_FAILED");error.partialResult=result;throw error;
  }
  return result;
}
function localEvidenceSubject_(evidence) {
  if(!evidence||evidence.kind!=="definition")return "";
  const text=String(evidence.text||""),aliases=text.match(/(?:^|[；;,，])aliases=([^；;]+)/);
  return aliases ? aliases[1].split(/[、|]/)[0].trim() : (text.match(/^術語_([^,，]+)/)||[])[1]||"";
}
function localEvidenceExcerpts_(evidence) {
  const excerpts=[];
  (Array.isArray(evidence)?evidence:[]).forEach(function(e){
    const raw=String(e&&e.text||"").trim();
    let parts=[raw];
    if(e&&e.kind==="definition") {
      const comma=raw.search(/[,，]/);
      const body=comma>=0?raw.slice(comma+1):raw;
      parts=body.split(/[；;]/).map(function(part){return part.trim();}).filter(function(part){
        return part && !/^(?:canonical|aliases|definition_only)\s*=/i.test(part);
      });
    }
    parts.filter(Boolean).forEach(function(text){
      excerpts.push({id:"Q"+excerpts.length,evidenceId:e.id,text:text,
        subject:localEvidenceSubject_(e),kind:e.kind,scope:e.scope||{},question:e.question||""});
    });
  });
  return excerpts;
}

function hydrateLocalEvidenceSelections_(output,excerpts) {
  if(!output||!Array.isArray(output.answers))throw new Error("LOCAL_OUTPUT_INVALID");
  const byId={};excerpts.forEach(function(e){byId[e.id]=e;});
  return Object.assign({},output,{answers:output.answers.map(function(a){
    if(!a||!Array.isArray(a.excerptIds)||!a.excerptIds.length||a.excerptIds.some(function(id){return !byId[id];}))throw new Error("LOCAL_EXCERPT_ID_INVALID");
    const selected=Array.from(new Set(a.excerptIds)).map(function(id){return byId[id];});
    return {text:selected.map(function(e){return e.text;}).join("\n"),
      evidenceIds:Array.from(new Set(selected.map(function(e){return e.evidenceId;}))),
      quotes:selected.map(function(e){return {id:e.evidenceId,quote:e.text};})};
  })});
}
function localEvidenceResponseSchema_(evidence,classifyScope) {
  const ids=localEvidenceExcerpts_(evidence).map(function(e){return e.id;});
  const id=ids.length?{type:"STRING",enum:ids}:{type:"STRING"};
  const schema={type:"OBJECT",required:["complete","answers","remainingQuestions"],properties:{
    complete:{type:"BOOLEAN"},answers:{type:"ARRAY",maxItems:ids.length?5:0,items:{type:"OBJECT",required:["excerptIds"],properties:{
      excerptIds:{type:"ARRAY",minItems:1,maxItems:8,items:id}
    }}},remainingQuestions:{type:"ARRAY",maxItems:5,items:{type:"STRING"}}
  }};
  if(classifyScope){schema.required.push("questionScope");schema.properties.questionScope={type:"STRING",enum:["general","model_specific","non_product"]};}
  return schema;
}
function decideLocalEvidence_(question,model,contextId,strategy,options) {
  const classifyScope=Boolean(options&&options.classifyScope);
  const comparisonModel=options&&options.comparisonModel;
  if(comparisonModel && (!IS_TEST_MODE || !["models/gemini-2.5-flash","models/gemini-3.1-flash-lite"].includes(comparisonModel)))throw new Error("COMPARISON_MODEL_NOT_ALLOWED");
  const generationModel=comparisonModel||GEMINI_MODEL_FAST;
  model=normalizeModelForDisplay(model||"");
  let evidence=comparisonModel&&Array.isArray(options.comparisonEvidence)?options.comparisonEvidence.slice():collectLocalAnswerEvidence_(question,model);
  const topic=readSourceCanonicalTopic_(contextId);
  const prior=readReusableLocalManualEvidence_(contextId,model);
  if(prior && currentRequestAudit?.routePlan?.topicRelation==="followup")evidence.unshift(prior);
  const recalled=evidence.length;
  evidence=evidence.slice(0,10);
  let used=0;
  evidence=evidence.filter(e=>{const size=Utilities.newBlob(JSON.stringify(e)).getBytes().length;if(used+size>CONFIG.MAX_FAST_INPUT_TOKENS)return false;used+=size;return true;});
  if(recalled!==evidence.length)writeLog("[Local Evidence] retrievalTruncated=true recalled="+recalled+" sent="+evidence.length);
  if(!evidence.length&&!classifyScope) return {complete:false,answer:"",remainingQuestions:[question],skipped:true};
  const excerpts=localEvidenceExcerpts_(evidence);
  const state={question:question,model:model,canonicalTopic:topic?.canonicalQuestion||"",previousQuestion:readRecentSourceQuestion_(contextId)?.question||"",
    today:Utilities.formatDate(new Date(),"Asia/Taipei","yyyy-MM-dd"),evidence:evidence};
  let output;
  if(strategy==="jev") {
    // JEV selects existing quotations per explicit subquestion; it never writes product facts.
    // QA and RULE have the same evidence pool as the Lite comparison.
    const options=excerpts.map(function(e,i){return {key:"E"+i,evidenceId:e.evidenceId,text:e.text,subject:e.subject,question:e.question};});
    const parts=question.split(/[?？;；\n]+/).map(function(q){return q.trim();}).filter(Boolean).slice(0,5);
    const criteria={NONE:"Evidence does not fully answer this subquestion with the required product scope and conditions."};
    options.forEach(function(o){criteria[o.key]={evidenceId:o.evidenceId,subject:o.subject,question:o.question,quote:o.text};});
    const questions={};
    parts.forEach(function(part,i){questions["part"+i]={type:"choice",instructions:
      "Choose the existing quotation that completely answers this subquestion: "+part+
      ". Use the full original question for the product and conditions. A definition cannot prove product capability. Choose NONE for unsupported or partial answers.",criteria:criteria};});
    const response=providerFetch_(JEV_DECISIONS_ENDPOINT,{openRouterApiKey:PropertiesService.getScriptProperties().getProperty("OPENROUTER_API_KEY"),
      providerPurpose:"qa_candidate",method:"post",contentType:"application/json",muteHttpExceptions:true,
      payload:JSON.stringify({model:JEV_MODEL_ROUTER,state:state,questions:questions})});
    if(response.getResponseCode()!==200)throw new Error("LOCAL_PROVIDER_FAILED");
    const answers=JSON.parse(response.getContentText()).answers||{},selected=[],remaining=[],selectionAudit=[];
    parts.forEach(function(part,i){
      const key="part"+i,id=getJevChoiceAnswer_(answers,key,Object.keys(criteria),"NONE"),confidence=getJevChoiceConfidence_(answers,key);
      const option=options.find(function(o){return o.key===id;});
      selectionAudit.push({question:part,choice:id,confidence:confidence,evidenceId:option&&option.evidenceId||""});
      if(!option || confidence<0.85){remaining.push(part);return;}
      if(!selected.some(function(a){return a.text===option.text;}))selected.push({text:option.text,evidenceIds:[option.evidenceId],quotes:[{id:option.evidenceId,quote:option.text}]});
    });
    output={complete:remaining.length===0&&selected.length>0,remainingQuestions:remaining,answers:selected};
    if(!output.complete&&!remaining.length)output.remainingQuestions=[question];
    const result=validateLocalEvidenceDecision_(output,evidence,question,model);
    result.selectionAudit=selectionAudit;
    return result;
  } else {
    const instruction="你是 QA／RULE 證據回答器。一次完成逐子題理解與自然回答，不輸出片段堆疊。完整保留原問句每個對象、條件、比較及操作要求。逐項產生唯一 id、question、scope(general或model_specific)、state(answered/missing_evidence/needs_clarification)、basis(direct/derived/none)、answer、evidenceRefs、conditions、assumptions。只使用 evidence 的 id；來源中的 requiredConditions 必須逐字保存在 conditions 並在答案保留。general只是問題範圍，不允許無證據生成；derived只限general、有證據前提及明列假設，不得推論型號未記載的能力、選單、數值或官方支援。缺資料時answer為空、basis=none並保留未解問題；缺必要型號或使用條件才澄清。術語不能證明型號能力；沒有記載不代表不支援。不要輸出全域complete。上一題只補主詞，不能丟本題新條件。回答第一句直接解答，接短說明或必要步驟；不得輸出費用或模型名稱。"+
      (classifyScope?"另填questionScope=general/model_specific/non_product；依整句需求判斷，不以操作詞要求型號。":"");
    const selectionState=Object.assign({},state,{evidence:evidence.map(e=>Object.assign({},e,{requiredConditions:localEvidenceRequiredConditions_(e)}))});
    const request=function(){
      const prompt=selectionState;
      const response=providerFetch_(`${CONFIG.API_ENDPOINT}/${generationModel}:generateContent`,{geminiApiKey:getGeminiApiKey_(),
        providerPurpose:comparisonModel?"diagnostic":"qa_semantic",method:"post",contentType:"application/json",muteHttpExceptions:true,
        payload:JSON.stringify({systemInstruction:{parts:[{text:instruction}]},contents:[{role:"user",parts:[{text:JSON.stringify(prompt)}]}],
          generationConfig:{temperature:0,maxOutputTokens:1200,thinkingConfig:providerThinkingConfigForModel_(generationModel),responseMimeType:"application/json",responseSchema:localClaimsResponseSchema_(classifyScope)}})});
      if(response.getResponseCode()!==200)throw new Error("LOCAL_PROVIDER_FAILED");
      const body=JSON.parse(response.getContentText()),candidate=(body.candidates||[])[0]||{};
      if(candidate.finishReason&&candidate.finishReason!=="STOP")throw new Error("LOCAL_OUTPUT_INCOMPLETE");
      return (candidate.content?.parts||[]).filter(p=>p.text&&!p.thought).map(p=>p.text).join("");
    };
    const text=request();let result;
        output=JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g,""));
        result=validateLocalClaims_(output,evidence,question,model);
        if(classifyScope && !["general","model_specific","non_product"].includes(output.questionScope))throw new Error("LOCAL_SCOPE_INVALID");
        result.questionScope=output.questionScope;
        if(shouldVerifyGeneratedEvidence_())result=verifyLocalEvidenceSemantics_(result,evidence,question,model);
        if(contextId)writeAnswerEnvelope_(contextId,result.envelope);
        return result;
    // Invalid output preserves the validator's partial result and stops. Never
    // spend a second call (or escalate to PDF/Web) to repair the same generation.
  }
  const result=validateLocalEvidenceDecision_(output,evidence,question,model);
  writeLog("[Local Evidence Decision] "+JSON.stringify({strategy:strategy,complete:result.complete,questionScope:result.questionScope,evidenceIds:result.evidenceIds,remainingQuestions:result.remainingQuestions}));
  return result;
}
function readReusableLocalManualEvidence_(contextId,model) {
  if(!contextId||!model)return null;
  const prior=getPersistedAdvancedSourceOperation_(readSourceProductState_(contextId),"manual");
  if(!prior||prior.status!=="done"||prior.codeVersion!==GAS_VERSION||prior.model!==model||
    prior.sourceFingerprint!==getAdvancedSourceKnowledgeFingerprint_("manual",model)||
    prior.expiresAt<Date.now()||!String(prior.finalText||"").includes("[來源:官方手冊]"))return null;
  return {id:"PREVIOUS_MANUAL:"+computeReplyAnchor_(prior.key),kind:"verified_manual",question:prior.canonicalQuery,
    text:String(prior.finalText).replace(/\n{0,2}\[費用[^\]]+\]/g,"").trim(),scope:{models:[model]}};
}
function ensureLocalEvidenceDecision_(question,model,contextId,options) {
  if(localEvidenceDecision_)return localEvidenceDecision_;
  // A failed Fast answer saw only precise prompt candidates. Before escalation, check the broader evidence pool.
  try {localEvidenceDecision_=decideLocalEvidence_(question,model,contextId,LOCAL_EVIDENCE_STRATEGY,options);}
  catch(error){
    const failure=String(error.message||"LOCAL_OUTPUT_INVALID");
    localEvidenceDecision_=Object.assign({complete:false,answer:"",remainingQuestions:[question]},error.partialResult||{},{failure:failure,complete:false});
    if(localEvidenceDecision_.envelope){localEvidenceDecision_.envelope.execution={state:/BUDGET/.test(failure)?"budget_blocked":/PROVIDER/.test(failure)?"provider_error":/VALIDATION/.test(failure)?"validation_error":"format_error",code:failure};}
    writeLog("[Local Evidence Failure] "+JSON.stringify({failure:failure,preservedEvidenceIds:localEvidenceDecision_.evidenceIds||[]}));
  }
  if(currentRequestAudit)currentRequestAudit.localEvidenceDecision=localEvidenceDecision_;
  return localEvidenceDecision_;
}
function replyLocalEvidenceDecision_(result,question,model,contextId,userId,replyToken) {
  const text=(result.complete || result.needsClarification) ? result.answer+"\n"+(result.sourceTags||[]).join("\n")+(result.needsClarification?"\n\n請補充："+result.remainingQuestions[0]:"") :
    (result.answer?result.answer+"\n\n":"")+"這次資料判讀暫時無法完成，請稍後再試；已確認的規格仍可查詢。";
  if(model)rememberSourceProductModel_(contextId,model,"qa_rule_semantic");
  rememberRecentSourceQuestion_(contextId,question,model);
  LAST_SOURCE_TEST_STATE={source:"qa_rule",outcome:result.complete?"success":"provider_failed",executed:"semantic_local"};
  replyMessage(replyToken,text);writeRecordDirectly(userId,question,contextId,"user","");writeRecordDirectly(userId,text,contextId,"assistant","");
  updateHistorySheetAndCache(contextId,getHistoryFromCacheOrSheet(contextId),{role:"user",content:question},{role:"assistant",content:text});
}
