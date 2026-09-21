/** One shared answer contract. Validation is structural, not a semantic proof. */
const ANSWER_EVIDENCE_POLICY = "qa-rule-v324-9";
function uniqueAnswerStrings_(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map(function (value) { return String(value || "").trim(); })
        .filter(Boolean),
    ),
  );
}
function normalizeAnswerEnvelopeV2_(source) {
  if (!Array.isArray(source.claims)) throw new Error("ANSWER_CLAIMS_REQUIRED");
  const ids = new Set();
  const claims = source.claims.map(function(c) {
    if (!c || !c.id || ids.has(c.id) || typeof c.question !== "string" ||
        !["general","model_specific"].includes(c.scope) ||
        !["answered","missing_evidence","needs_clarification"].includes(c.state) ||
        !["direct","derived","none"].includes(c.basis) ||
        ![c.evidenceRefs,c.conditions,c.assumptions].every(Array.isArray)) throw new Error("ANSWER_CLAIM_INVALID");
    ids.add(c.id);
    let state=String(c.state),basis=String(c.basis),answer=String(c.answer||"").trim();
    const evidenceRefs=uniqueAnswerStrings_(c.evidenceRefs);
    const conditions=uniqueAnswerStrings_(c.conditions);
    let assumptions=uniqueAnswerStrings_(c.assumptions);
    if(basis==="none")answer="";
    const invalidDirect=state==="answered"&&basis==="direct"&&!evidenceRefs.length;
    const invalidDerived=state==="answered"&&basis==="derived"&&(!evidenceRefs.length||!assumptions.length);
    if(invalidDirect||invalidDerived||state==="answered"&&basis==="none"||state==="answered"&&!answer) {
      state="missing_evidence";basis="none";answer="";assumptions=[];
    } else if(state!=="answered") {
      basis="none";answer="";assumptions=[];
    }
    return {id:String(c.id),question:c.question,scope:c.scope,state:state,basis:basis,
      answer:answer,evidenceRefs:evidenceRefs,conditions:conditions,assumptions:assumptions};
  });
  const unresolved=claims.filter(c=>c.state!=="answered").map(c=>c.id);
  const answered=claims.filter(c=>c.state==="answered");
  const execution=source.execution || {state:"ok",code:""};
  if(!["ok","provider_error","format_error","validation_error","budget_blocked"].includes(execution.state))throw new Error("ANSWER_EXECUTION_INVALID");
  const envelope={schemaVersion:2,evidencePolicyVersion:ANSWER_EVIDENCE_POLICY,version:String(source.version||GAS_VERSION),
    topicId:String(source.topicId||""),originalQuestion:String(source.originalQuestion||""),model:normalizeModelForDisplay(source.model||""),
    claims:claims,evidenceRefs:Array.from(new Set(answered.flatMap(c=>c.evidenceRefs))),unresolvedClaims:unresolved,
    status:answered.length ? (!unresolved.length?"supported":"partial") : "unsupported",
    execution:{state:execution.state,code:String(execution.code||"")},
    allowedActions:Array.isArray(source.allowedActions)?Array.from(new Set(source.allowedActions.filter(a=>["manual","web","elaborate"].includes(a)))):[],
    expandable:source.expandable===true,createdAt:Number(source.createdAt||Date.now()),expiresAt:Number(source.expiresAt||Date.now()+ANSWER_ENVELOPE_TTL_MS)};
  if(Utilities.newBlob(JSON.stringify(envelope)).getBytes().length>80*1024)throw new Error("ANSWER_ENVELOPE_CAPACITY");
  return envelope;
}
function mergeAdvancedAnswerEnvelopeV2_(baseRaw, options) {
  if(!baseRaw||Number(baseRaw.schemaVersion)!==2)throw new Error("ANSWER_V2_BASE_REQUIRED");
  const base=normalizeAnswerEnvelopeV2_(baseRaw);
  const input=options||{};
  const resolvedIds=new Set(uniqueAnswerStrings_(input.resolvedClaimIds));
  const failedIds=new Set(uniqueAnswerStrings_(input.failedClaimIds));
  const refs=uniqueAnswerStrings_(input.evidenceRefs);
  const answerById=input.answerById&&typeof input.answerById==="object"?input.answerById:{};
  const conditionsById=input.conditionsById&&typeof input.conditionsById==="object"?input.conditionsById:{};
  const assumptionsById=input.assumptionsById&&typeof input.assumptionsById==="object"?input.assumptionsById:{};
  const claims=base.claims.map(function(claim) {
    if(resolvedIds.has(claim.id)) {
      return {
        id:claim.id,
        question:claim.question,
        scope:claim.scope,
        state:"answered",
        basis:String(input.basis||"direct"),
        answer:String(answerById[claim.id]||claim.answer||"").trim(),
        evidenceRefs:uniqueAnswerStrings_([].concat(claim.evidenceRefs||[],refs)),
        conditions:uniqueAnswerStrings_([].concat(claim.conditions||[],conditionsById[claim.id]||[])),
        assumptions:uniqueAnswerStrings_([].concat(claim.assumptions||[],assumptionsById[claim.id]||[])),
      };
    }
    if(failedIds.has(claim.id))return claim;
    return claim;
  });
  return normalizeAnswerEnvelopeV2_({
    schemaVersion:2,
    version:input.version||base.version||GAS_VERSION,
    topicId:input.topicId||base.topicId||"",
    originalQuestion:input.originalQuestion||base.originalQuestion||"",
    model:input.model||base.model||"",
    claims:claims,
    execution:{
      state:String(input.executionState||"ok"),
      code:String(input.executionCode||""),
    },
    allowedActions:Array.isArray(input.allowedActions)?input.allowedActions:base.allowedActions,
    expandable:input.expandable===true,
    createdAt:base.createdAt,
    expiresAt:base.expiresAt,
  });
}
function localEvidenceRequiredConditions_(e) {
  return String(e.text||"").split(/[。；;\n]+/).map(s=>s.trim()).filter(s=>
    /僅限|僅適用|不得|不能|不支援|必須|須先|需先|依型號|視型號|部分型號|可能不支援/.test(s));
}
function validateLocalClaims_(output,evidence,question,model) {
  if(!output || !Array.isArray(output.claims) || !output.claims.length)throw new Error("LOCAL_OUTPUT_INVALID");
  const byId={};evidence.forEach(e=>byId[e.id]=e);
  const structuralValidationFailed=output.claims.some(function(c){
    if(!c||c.state!=="answered")return false;
    const refs=Array.isArray(c.evidenceRefs)?c.evidenceRefs.filter(Boolean):[];
    const assumptions=Array.isArray(c.assumptions)?c.assumptions.filter(Boolean):[];
    return !String(c.answer||"").trim()||c.basis==="none"||!refs.length||
      (c.basis==="derived"&&!assumptions.length);
  });
  const envelope=normalizeAnswerEnvelopeV2_({schemaVersion:2,originalQuestion:question,model:model,claims:output.claims});
  let invalid=structuralValidationFailed;
  envelope.claims=envelope.claims.map(function(c) {
    if(c.state!=="answered")return Object.assign({},c,{answer:"",basis:"none",evidenceRefs:[]});
    const refs=c.evidenceRefs.map(id=>byId[id]);
    let valid=Boolean(c.answer.trim()&&refs.length&&refs.every(Boolean)&&c.basis!=="none");
    if(valid) {
      valid=refs.every(e=>!(e.scope?.models||[]).length || (model&&(e.scope.models||[]).some(m=>qaKnowledgeModelMatches_(m,model))));
      if(c.scope==="model_specific" && !model)valid=false;
      if(c.scope==="model_specific" && refs.every(e=>e.kind==="definition"))valid=false;
      const raw=refs.map(e=>e.text).join("\n");
      let prose=c.answer.replace(/^\s*\d+[.)、]\s*/gm,"");
      const models=extractFullModelLikeTokens(prose);
      models.forEach(m=>prose=prose.replace(m,""));
      if((prose.match(/\d+(?:\.\d+)?/g)||[]).some(n=>!raw.includes(n)))valid=false;
      if(models.some(m=>model ? normalizeModelForDisplay(m)!==normalizeModelForDisplay(model) : !raw.includes(m)))valid=false;
      const required=refs.flatMap(localEvidenceRequiredConditions_);
      // The source already supplies these restrictions. Copy them deterministically
      // instead of paying another generation to repeat text we already possess.
      const conditionKeys=new Set();
      c.conditions=uniqueAnswerStrings_(c.conditions.concat(required)).filter(function(condition){
        const key=condition.replace(/[。.!！?？；;，,\s]+$/g,"");
        if(conditionKeys.has(key))return false;
        conditionKeys.add(key);return true;
      });
      if(c.conditions.some(t=>!localEvidenceContains_(raw,t)))valid=false;
      if(c.basis==="derived"&&(!c.assumptions.length||c.scope!=="general"))valid=false;
    }
    if(valid)return c;
    invalid=true;
    return Object.assign({},c,{state:"missing_evidence",basis:"none",answer:"",evidenceRefs:[]});
  });
  if(invalid)envelope.execution={state:"validation_error",code:"LOCAL_EVIDENCE_VALIDATION_FAILED"};
  const result=renderLocalClaimsResult_(envelope,evidence);
  if(invalid){const error=new Error("LOCAL_EVIDENCE_VALIDATION_FAILED");error.partialResult=result;throw error;}
  return result;
}
function renderLocalClaimsResult_(envelope,evidence) {
  const byId={};evidence.forEach(e=>byId[e.id]=e);
  const normalized=normalizeAnswerEnvelopeV2_(envelope);
  const answers=normalized.claims.filter(c=>c.state==="answered").map(function(c) {
    let text=(c.basis==="derived"?"依上述條件推論：":"")+c.answer;
    const conditions=Array.from(new Set(c.conditions||[])).filter(condition=>!localEvidenceContains_(text,condition));
    if(conditions.length)text+="\n適用條件："+conditions.join("；");
    if(c.basis==="derived")text+="\n前提："+c.assumptions.join("；");
    return {text:text,evidenceIds:c.evidenceRefs};
  });
  const sourceTags=Array.from(new Set(normalized.evidenceRefs.map(id=>{
    const e=byId[id];return e.kind==="verified_manual"?"[來源:官方手冊]":e.kind==="campaign"?"[來源:官方活動庫]":id.startsWith("QA:")?"[來源:QA庫]":"[來源:官方規格庫]";
  })));
  const result={envelope:normalized,answer:answers.map(a=>a.text).join("\n\n"),answers:answers,
    complete:normalized.status==="supported"&&normalized.execution.state==="ok",needsClarification:normalized.claims.some(c=>c.state==="needs_clarification"),
    remainingQuestions:normalized.claims.filter(c=>c.state!=="answered").map(c=>c.question),evidenceIds:normalized.evidenceRefs,sourceTags:sourceTags};
  return result;
}
function localClaimsResponseSchema_(classifyScope) {
  const strings={type:"ARRAY",items:{type:"STRING"}};
  const schema={type:"OBJECT",required:["claims"],properties:{claims:{type:"ARRAY",minItems:1,items:{type:"OBJECT",
    required:["id","question","scope","state","basis","answer","evidenceRefs","conditions","assumptions"],properties:{
      id:{type:"STRING"},question:{type:"STRING"},scope:{type:"STRING",enum:["general","model_specific"]},
      state:{type:"STRING",enum:["answered","missing_evidence","needs_clarification"]},basis:{type:"STRING",enum:["direct","derived","none"]},
      answer:{type:"STRING"},evidenceRefs:strings,conditions:strings,assumptions:strings}}}}};
  if(classifyScope){schema.required.push("questionScope");schema.properties.questionScope={type:"STRING",enum:["general","model_specific","non_product"]};}
  return schema;
}
