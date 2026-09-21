/** Web only. Wire response is adapted inside the shared paid gateway. */
const PROVIDER_WEB_API = "interactions-v1beta";
const PROVIDER_INTERACTIONS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
function buildWebInteractionsPayload_(payload) {
  return {model:GEMINI_MODEL_WEB.replace(/^models\//,""),store:false,stream:false,background:false,
    system_instruction:(payload.systemInstruction?.parts||[]).map(p=>p.text||"").join("\n"),
    input:(payload.contents||[]).map(c=>({role:c.role==="model"?"model":"user",content:(c.parts||[]).filter(p=>typeof p.text==="string").map(p=>({type:"text",text:p.text}))})),
    tools:[{type:"google_search"}],generation_config:{max_output_tokens:800,thinking_level:"minimal",thinking_summaries:"none"}};
}
function utf8ByteOffsetToUtf16_(text,offset) {
  if(!Number.isSafeInteger(offset)||offset<0)return null;
  let bytes=0,index=0;
  for(const char of String(text)){
    if(bytes===offset)return index;
    bytes+=Utilities.newBlob(char).getBytes().length;index+=char.length;
    if(bytes>offset)return null;
  }
  return bytes===offset?index:null;
}
function normalizeWebInteraction_(body) {
  if(!body || typeof body!=="object" || !Array.isArray(body.steps))throw new Error("PROVIDER_INTERACTION_FORMAT_INVALID");
  const parts=[],chunks=[],supports=[],calls=[];
  let fullText="";
  body.steps.filter(Boolean).forEach(function(step){
    if(step.type==="google_search_call") {
      // The reference schema uses queries; the official example also shows singular query.
      const rawQueries=step.arguments?.queries??step.queries??(typeof step.arguments?.query==="string"?[step.arguments.query]:null);
      const queries=Array.isArray(rawQueries)?rawQueries.filter(q=>typeof q==="string"&&q.trim()).map(q=>q.trim()):[];
      calls.push({callId:String(step.id||""),queries:queries,queriesKnown:Array.isArray(rawQueries)&&queries.length>0&&queries.length===rawQueries.length});
    }
    if(step.type!=="model_output")return;
    (Array.isArray(step.content)?step.content:[]).filter(p=>p&&p.type==="text"&&p.thought!==true&&typeof p.text==="string").forEach(function(p){
      const base=fullText.length;fullText+=p.text;parts.push({text:p.text});
      (Array.isArray(p.annotations)?p.annotations:[]).forEach(function(a){
        if(!a || a.type!=="url_citation")return;
        const uri=String(a.url||""),start=utf8ByteOffsetToUtf16_(p.text,a.start_index),end=utf8ByteOffsetToUtf16_(p.text,a.end_index);
        if(!/^https:\/\//i.test(uri)||start===null||end===null||end<=start)return;
        let index=chunks.findIndex(c=>c.web.uri===uri);
        if(index<0){index=chunks.length;chunks.push({web:{uri:uri,title:String(a.title||uri)}});}
        supports.push({segment:{startIndex:base+start,endIndex:base+end,text:p.text.slice(start,end)},groundingChunkIndices:[index]});
      });
    });
  });
  const raw=body.usage||null;
  const validCount=n=>Number.isSafeInteger(n)&&n>=0;
  const usage=raw&&[raw.total_input_tokens,raw.total_output_tokens,raw.total_thought_tokens].every(validCount)&&
    (raw.total_cached_tokens==null||validCount(raw.total_cached_tokens)&&raw.total_cached_tokens<=raw.total_input_tokens)
    ? {promptTokenCount:raw.total_input_tokens,candidatesTokenCount:raw.total_output_tokens,thoughtsTokenCount:raw.total_thought_tokens,
      cachedContentTokenCount:Number(raw.total_cached_tokens||0),totalTokenCount:raw.total_tokens} : null;
  const occurrences=calls.flatMap(c=>c.queries),unique=Array.from(new Set(occurrences));
  const groundingCounts=(Array.isArray(raw?.grounding_tool_count)?raw.grounding_tool_count:[]).filter(c=>c&&c.type==="google_search").map(c=>c.count);
  const groundingCount=groundingCounts.length&&groundingCounts.every(validCount)?groundingCounts.reduce((a,b)=>a+b,0):null;
  const ambiguousCounts=calls.length!==1||calls.some(c=>!c.queriesKnown)||
    (groundingCounts.length>0&&groundingCount===null)||groundingCount!==null&&groundingCount!==unique.length;
  const metadata=body.status==="completed"&&chunks.length&&supports.length?{groundingChunks:chunks,groundingSupports:supports}:null;
  if(metadata&&calls.length&&!ambiguousCounts)metadata.webSearchQueries=unique;
  const audit={responseId:String(body.id||""),providerStatus:String(body.status||""),toolCalls:calls,
    queryOccurrences:occurrences,uniqueQueries:unique,providerGroundingCount:groundingCount,
    observedQueryCount:Math.max(occurrences.length,groundingCount||0),
    queryCount:calls.length&&!ambiguousCounts?unique.length:null,
    costStatus:usage&&!ambiguousCounts&&calls.length?"estimated":"unknown",
    errorKind:body.status!=="completed"?"provider_incomplete":!metadata?"missing_citations":""};
  const candidate={content:{parts:parts.concat(calls.map(c=>({toolCall:{toolType:"GOOGLE_SEARCH_WEB",args:{queries:c.queries}}})))},finishReason:body.status==="completed"?"STOP":"MAX_TOKENS"};
  if(metadata)candidate.groundingMetadata=metadata;
  return {responseId:audit.responseId,candidates:[candidate],usageMetadata:usage,webInteractionAudit:audit};
}
function adaptWebInteractionResponse_(response) {
  if(response.getResponseCode()!==200)return response;
  const body=normalizeWebInteraction_(JSON.parse(response.getContentText()));
  return {getResponseCode:()=>response.getResponseCode(),getContentText:()=>JSON.stringify(body)};
}
