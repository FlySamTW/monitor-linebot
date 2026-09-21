// Offline safety contracts. Provider answers are fixtures, never evidence of JEV accuracy.
const assert=require('assert');
const {createProductionHarness}=require('./production_harness');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
function fixture(){
  const h=createProductionHarness({quiet:true,now:'2026-10-01T00:00:00Z',properties:{GEMINI_API_KEY:'fixture',OPENROUTER_API_KEY:'fixture'}});
  h.context.initializeProviderBudget_(0,h.context.providerMonthKey_());h.context.resetRequestAudit_();return h;
}
const response=(value,status=200)=>({getResponseCode:()=>status,getContentText:()=>JSON.stringify(value)});
const h=fixture(),c=h.context;
const question='能同時顯示 HDMI 與 DisplayPort 嗎？';
const evidence=[{id:'QA:switch',kind:'qa',text:'可在選單切換 HDMI 與 DisplayPort 訊號來源。',scope:{models:['S27H704EAC']}}];
const claim={id:'display',question,scope:'model_specific',state:'answered',basis:'direct',answer:'可以同時顯示 HDMI 與 DisplayPort 的畫面。',evidenceRefs:['QA:switch'],conditions:[],assumptions:[]};
const verdict=(choice,confidence=.99)=>({type:'choice',choice,confidence,probabilities:{[choice]:.99}});
function jev(answers){return response({id:'jev-fixture',model:'typesafe/jev-1.13',answers,usage:{input_tokens:1000,output_tokens:0,cost:null}});}

test('真實 router 路徑的 null 費用與帳本一致，不重複記帳',()=>{
  c.resetRequestAudit_();h.setFetch(()=>jev({topic_relation:verdict('new'),dominant_intent:verdict('spec'),multi_claim:{noul:.1},needs_manual:{noul:.9},needs_web:{noul:.1},needs_clarification:{noul:.1}}));
  c.callSemanticRouter_({originalQuestion:'S27H704EAC 如何操作？',confirmedModel:'S27H704EAC',localCoverage:'partial',manualAvailable:true});
  const audit=h.run('currentRequestAudit'),r=audit.providerReceipts[0];
  assert(r.costTwd>0);assert.equal(r.status,'estimated');assert.equal(audit.routerCostTwd,r.costTwd);
  assert.equal(audit.estimatedCostTwd,r.costTwd);assert.equal(audit.billableCalls,1);assert.equal(r.responseId,'jev-fixture');
});
test('null、字串 Noul 不得成為確定否定',()=>{
  for(const noul of [null,'0',false,undefined,-1,1.1])assert.equal(c.getJevNoulProbability_({x:{noul}},'x'),null);
  for(const confidence of [-1,1.1,Infinity,'0.99'])assert.equal(c.getJevChoiceConfidence_({x:{confidence}},'x'),0);
});
test('來源機率中間值與非法Choice不得被高信心接管',()=>{
  const answers={topic_relation:verdict('new'),dominant_intent:verdict('spec'),multi_claim:{noul:.1},needs_manual:{noul:.1},needs_web:{noul:.1},needs_clarification:{noul:.1}};
  const input={originalQuestion:'說明面板差異',localCoverage:'none',manualAvailable:false};
  assert.equal(c.buildRouteAnalysisFromJev_(answers,input).confidence,'high');
  for(const key of ['multi_claim','needs_manual','needs_web','needs_clarification']){
    assert.notEqual(c.buildRouteAnalysisFromJev_({...answers,[key]:{noul:.51}},input).confidence,'high');
  }
  assert.notEqual(c.buildRouteAnalysisFromJev_({...answers,dominant_intent:verdict('INVALID')},input).confidence,'high');
});
test('必要條件必須在最終可見答案出現，已包含時不重複',()=>{
  const condition='連接前須先關閉電源。';
  const source=[{id:'QA:condition',kind:'qa',text:condition+'可接外部裝置。',scope:{models:[]}}];
  const item={...claim,scope:'general',question:'怎麼連接？',answer:'可接外部裝置。',evidenceRefs:['QA:condition'],conditions:[condition]};
  const result=c.validateLocalClaims_({claims:[item]},source,item.question,'');
  assert(result.complete);assert(result.answer.includes(condition));
  const repeated=c.validateLocalClaims_({claims:[{...item,answer:condition+item.answer}]},source,item.question,'');
  assert.equal(repeated.answer.split(condition).length-1,1);
});
test('引文存在不代表支持：拒絕主張而非重試或轉 Web',()=>{
  c.resetRequestAudit_();const input=c.validateLocalClaims_({claims:[claim]},evidence,question,'S27H704EAC');
  assert(input.complete,'fixture demonstrates the structural-only gap');
  const before=h.fetches.length;h.setFetch((url,options)=>{
    assert(url.includes('/alpha/decisions'));const payload=JSON.parse(options.payload);
    assert.equal(payload.state.originalQuestion,question);assert.equal(payload.state.evidence[0].text,evidence[0].text);
    return jev({coverage:verdict('complete'),claim_0:verdict('insufficient')});
  });
  let error;try{c.verifyLocalEvidenceSemantics_(input,evidence,question,'S27H704EAC');}catch(e){error=e;}
  assert.equal(error.message,'SEMANTIC_VALIDATION_FAILED');assert.equal(error.partialResult.answer,'');
  assert.equal(error.partialResult.envelope.execution.state,'validation_error');assert.equal(h.fetches.length-before,1);
  assert.equal(h.run('currentRequestAudit.webCalls'),0);assert.equal(h.run('currentRequestAudit.evidence_verifyCalls'),1);
});
test('完整性拒絕保留已支持答案，但不宣稱整題完成',()=>{
  c.resetRequestAudit_();h.setFetch(()=>jev({coverage:verdict('incomplete'),claim_0:verdict('supported')}));
  const input=c.validateLocalClaims_({claims:[{...claim,answer:evidence[0].text}]},evidence,question,'S27H704EAC');
  let error;try{c.verifyLocalEvidenceSemantics_(input,evidence,question,'S27H704EAC');}catch(e){error=e;}
  assert(error.partialResult.answer.includes('切換'));assert.equal(error.partialResult.complete,false);
  assert.equal(error.partialResult.envelope.claims.length,2);assert(error.partialResult.remainingQuestions.includes(question));
});
test('低信心或缺 confidence 的 supported 不得通過',()=>{
  for(const confidence of [null,undefined,'0.99',.84,-1,1.1])assert(!c.readJevEvidenceVerdict_({choice:'supported',confidence},['supported']).accepted);
});
test('一般流量未通過實測前不擴大 JEV 付費用途',()=>{
  assert.equal(c.shouldVerifyGeneratedEvidence_(),false);
  const before=h.fetches.length;assert.throws(()=>c.verifyGeneratedClaims_(question,'',[claim],[]),/SOURCE_MISSING/);
  assert.equal(before,h.fetches.length);
});
test('頁級驗證送原始片段及限制，拒絕後保留其他支持主張',()=>{
  c.resetRequestAudit_();h.setFetch(()=>jev({coverage:verdict('complete'),claim_0:verdict('supported'),claim_1:verdict('contradicted')}));
  const source=[{pageNumber:13,evidenceText:'可以切換來源。不得於自行診斷期間切換。',pageHeading:'來源',menuPath:'功能表 → 來源'}];
  const selected=[{pageNumber:13,excerpt:source[0].evidenceText,supportedAnswer:'請到功能表 → 來源切換。'},
    {pageNumber:13,excerpt:source[0].evidenceText,supportedAnswer:'自行診斷時也可以切換來源。'}];
  const result=c.verifyManualEvidenceSemantics_(selected,source,'如何切換？診斷期間也可以嗎？','S27H704EAC','');
  assert.equal(result.selectedEvidence.length,1);assert(result.failed);
  const payload=JSON.parse(h.fetches[h.fetches.length-1].options.payload);
  assert(payload.state.evidence[0].text.includes('不得於自行診斷期間切換'));
});

function nativeInteraction(){return {id:'native-interaction',status:'completed',steps:[
  {type:'google_search_call',id:'s1',arguments:{queries:['PDF 使用條件']}},
  {type:'model_output',content:[{type:'thought',text:'不可顯示'},
    {type:'text',text:'前言。'},
    {type:'text',text:'螢幕😀可用。',annotations:[{type:'url_citation',url:'https://example.org/manual',title:'手冊',start_index:6,end_index:16}]}]},
],usage:{total_input_tokens:100,total_output_tokens:20,total_thought_tokens:7,total_cached_tokens:10,
  grounding_tool_count:[{type:'google_search',count:1}]}};}
test('原生 Interactions 的中文字及 emoji byte offsets 正確回填',()=>{
  const out=c.normalizeWebInteraction_(nativeInteraction()),candidate=out.candidates[0],s=candidate.groundingMetadata.groundingSupports[0].segment;
  assert.equal(candidate.content.parts.filter(p=>p.text).map(p=>p.text).join(''),'前言。螢幕😀可用。');
  assert.deepEqual(JSON.parse(JSON.stringify(s)),{startIndex:5,endIndex:9,text:'😀可用'});
  assert.equal(out.usageMetadata.thoughtsTokenCount,7);assert.equal(out.webInteractionAudit.queryCount,1);
});
test('非 URL citation、切斷 UTF-8 或未完成回應不能冒充有效引用',()=>{
  for(const patch of [{type:'file_citation'},{start_index:7},{end_index:999}]){
    const body=nativeInteraction();Object.assign(body.steps[1].content[2].annotations[0],patch);
    assert(!c.normalizeWebInteraction_(body).candidates[0].groundingMetadata);
  }
  const incomplete=nativeInteraction();incomplete.status='in_progress';assert(!c.normalizeWebInteraction_(incomplete).candidates[0].groundingMetadata);
});
test('多次搜尋或缺 query 保留未知費用，已知五次不得只估三次',()=>{
  const body=nativeInteraction();body.steps.push({type:'google_search_call',id:'s2',arguments:{queries:['q2','q3','q4','q5']}});
  body.usage.grounding_tool_count[0].count=5;
  const out=c.normalizeWebInteraction_(body),cost=c.settleProviderSearch_('gemini-3.1-flash-lite',c.providerSearchMetadata_(out));
  assert.equal(out.webInteractionAudit.queryCount,null);assert(cost.unknown);assert(Math.abs(cost.costTwd-2.24)<1e-9);
  const missing=nativeInteraction();missing.steps[0].arguments={};assert.equal(c.normalizeWebInteraction_(missing).webInteractionAudit.queryCount,null);
});
test('負數或缺失 usage 不得變成零費；官方單 query 範例可辨識',()=>{
  for(const value of [-1,null,undefined]){const body=nativeInteraction();body.usage.total_input_tokens=value;assert.equal(c.normalizeWebInteraction_(body).usageMetadata,null);}
  const body=nativeInteraction();body.steps[0].arguments={query:'PDF 使用條件'};assert.equal(c.normalizeWebInteraction_(body).webInteractionAudit.queryCount,1);
});
test('重複搜尋字串不可去重後低估費用',()=>{
  const body=nativeInteraction();body.steps[0].arguments={queries:['same','same','same','same']};
  delete body.usage.grounding_tool_count;
  const out=c.normalizeWebInteraction_(body),cost=c.settleProviderSearch_('gemini-3.1-flash-lite',c.providerSearchMetadata_(out));
  assert.equal(out.webInteractionAudit.queryCount,null);assert(cost.unknown);
  assert.equal(out.webInteractionAudit.observedQueryCount,4);assert(Math.abs(cost.costTwd-1.792)<1e-9);
});

test('真實 LINE 不開 TEST_MODE，沿用原批費用及真實 reply API',()=>{
  const x=fixture(),api=x.context,props=api.PropertiesService.getScriptProperties();
  const actor='fixture-actor',event={type:'message',webhookEventId:'evt-fixture',source:{type:'user',userId:actor},replyToken:'real-fixture-token',message:{text:'驗收題'}};
  props.setProperty('LINE_ACCEPTANCE_V324',JSON.stringify({actorHash:api.lineAcceptanceHash_(actor),version:x.run('GAS_VERSION'),build:x.run('BUILD_TIMESTAMP'),
    batch:'v324-cost-remediation',cap:10,startsAt:'2026-09-30T23:59:00Z',expiresAt:'2026-10-01T00:20:00Z',verifyEvidence:true}));
  const ledger=JSON.parse(props.getProperty(api.providerMonthKey_()));ledger.verifications={'v324-cost-remediation':{spent:3.849683392,reserved:0}};
  props.setProperty(api.providerMonthKey_(),JSON.stringify(ledger));api.bindLineAcceptanceEvent_(event);
  assert.equal(x.run('IS_TEST_MODE'),false);assert(api.isProviderVerificationRequest_());assert(api.shouldVerifyGeneratedEvidence_());
  x.setFetch((url)=>url.includes('openrouter')?jev({}):response({}));
  api.providerFetch_('https://openrouter.ai/api/alpha/decisions',{openRouterApiKey:'fixture',providerPurpose:'evidence_verify',method:'post',payload:JSON.stringify({model:'typesafe/jev-1.13',state:{},questions:{}})});
  const after=JSON.parse(props.getProperty(api.providerMonthKey_()));assert(after.verifications['v324-cost-remediation'].spent>3.849683392);
  assert.equal(api.sendReplyMessages_(event.replyToken,[{type:'text',text:'回覆'}]).state,'accepted_by_line');
  assert(x.fetches.some(f=>f.url==='https://api.line.me/v2/bot/message/reply'));
  x.advanceTime(30*60*1000);assert.throws(()=>api.isProviderVerificationRequest_(),/WINDOW_CLOSED/);
  api.bindLineAcceptanceEvent_({...event,source:{type:'user',userId:'different-user'}});assert.equal(api.isProviderVerificationRequest_(),false);
});
test('模型比較不得改一般流量模型，重開編輯者入口只讀既有結果',()=>{
  const x=fixture(),api=x.context;
  assert.throws(()=>api.decideLocalEvidence_('問題','','','lite',{comparisonModel:'models/gemini-2.5-flash'}),/COMPARISON_MODEL_NOT_ALLOWED/);
  x.run('IS_TEST_MODE=true');
  assert.throws(()=>api.decideLocalEvidence_('問題','','','lite',{comparisonModel:'models/gemini-pro'}),/COMPARISON_MODEL_NOT_ALLOWED/);
  api.Session.getActiveUser=()=>{throw Error('EMAIL_SCOPE_NOT_GRANTED');};
  api.CacheService.getScriptCache().put('provider_diagnostic_editor-token',x.run('BUILD_TIMESTAMP'));
  api.PropertiesService.getScriptProperties().setProperty('GENERATION_COMPARISON_V324',JSON.stringify({build:x.run('BUILD_TIMESTAMP'),status:'started',chunks:1}));
  api.PropertiesService.getScriptProperties().setProperty('GENERATION_COMPARISON_V324_0','[]');
  const before=x.fetches.length;const report=api.runGenerationModelComparison('editor-token');assert.equal(x.fetches.length,before);
  assert.equal(report.comparison.status,'started');
  assert.throws(()=>api.runProviderCostReadback(),/EDITOR_DIAGNOSTIC_SESSION_REQUIRED/);
  assert.throws(()=>api.runGenerationModelComparison('invented'),/EDITOR_DIAGNOSTIC_SESSION_REQUIRED/);
  api.CacheService.getScriptCache().put('provider_diagnostic_editor-token','old-build');
  assert.throws(()=>api.runProviderCostReadback('editor-token'),/EDITOR_DIAGNOSTIC_SESSION_REQUIRED/);
});
test('診斷 token 只能由原生 editor-only dev 核發；exec 不放行',()=>{
  const x=fixture(),api=x.context;
  api.buildUnauthorizedResponse_=()=>({error:'Unauthorized'});
  api.Session.getActiveUser=()=>{throw Error('EMAIL_SCOPE_NOT_GRANTED');};
  assert.equal(api.doGet({parameter:{diagnostics:'1'}}).error,'Unauthorized');
  api.ScriptApp.getService=()=>({getUrl:()=> 'https://script.google.com/macros/s/fixture/dev'});
  let template;api.HtmlService={createTemplateFromFile:()=>template={evaluate(){return {setTitle(){return this;},addMetaTag(){return this;}};}}};
  api.doGet({parameter:{diagnostics:'1'}});
  assert(template.diagnosticToken);api.assertCostComparisonEditor_(template.diagnosticToken);
  assert.equal(x.fetches.length,0);
});
console.log(JSON.stringify({passed,realProviderCalls:0,jevQualityValidated:false,lineDelivered:false}));
