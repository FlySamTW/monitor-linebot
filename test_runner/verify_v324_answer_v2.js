const assert = require('assert');
const {createProductionHarness} = require('./production_harness');
const h = createProductionHarness({quiet:true}), c=h.context;
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
const evidence=[{id:'QA:test',kind:'qa',text:'連接前須先關閉電源。可接外部裝置。',scope:{}}];
const claim=(patch={})=>Object.assign({id:'C1',question:'如何連接？',scope:'general',state:'answered',basis:'direct',answer:'先關閉電源，再連接外部裝置。',evidenceRefs:['QA:test'],conditions:['連接前須先關閉電源。'],assumptions:[]},patch);
test('同次判讀輸出自然答案並保留條件',()=>{
 const r=c.validateLocalClaims_({claims:[claim()]},evidence,'如何連接？','');
 assert(r.answer.startsWith(claim().answer));assert(r.answer.includes(claim().conditions[0]));assert(r.complete);assert.equal(r.envelope.schemaVersion,2);
});
test('完整由逐項計算，不信任complete',()=>{
 const r=c.validateLocalClaims_({complete:true,claims:[claim(),claim({id:'C2',question:'未知事項？',state:'missing_evidence',basis:'none',answer:'',evidenceRefs:[],conditions:[]})]},evidence,'如何連接？未知事項？','');
 assert(!r.complete);assert.deepEqual(Array.from(r.envelope.unresolvedClaims),['C2']);
});

test('遺漏來源條件以原文零模型補回，不犧牲來源驗證',()=>{
 const before=h.fetches.length;
 const r=c.validateLocalClaims_({claims:[claim({conditions:[]})]},evidence,'如何連接？','');
 assert(r.complete);assert(r.answer.includes('連接前須先關閉電源'));assert.equal(h.fetches.length,before);
 const duplicate=c.validateLocalClaims_({claims:[claim({conditions:['連接前須先關閉電源。','連接前須先關閉電源']})]},evidence,'如何連接？','');
 assert.equal(duplicate.envelope.claims[0].conditions.length,1,'句尾標點不同不可重複顯示來源限制');
 assert.throws(()=>c.validateLocalClaims_({claims:[claim({conditions:['憑空捏造條件']})]},evidence,'如何連接？',''),/VALIDATION/);
 assert.throws(()=>c.validateLocalClaims_({claims:[claim({conditions:[],answer:'可接999個裝置'})]},evidence,'如何連接？',''),/VALIDATION/);
});

test('格式或來源失敗最多一次付費候選判讀，不自動修復重付',()=>{
 const x=createProductionHarness({quiet:true,properties:{GEMINI_API_KEY:'fixture'}}),api=x.context;
 api.initializeProviderBudget_(0,api.providerMonthKey_());
 api.collectLocalAnswerEvidence_=()=>evidence;
 let calls=0;
 x.setFetch(()=>{calls++;return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({candidates:[{content:{parts:[{text:'{broken'}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:20,candidatesTokenCount:4}})};});
 assert.throws(()=>api.decideLocalEvidence_('如何連接？','','','lite'));
 assert.equal(calls,1);
});
test('錯來源保留合法部分並停止來源升級',()=>{
 let error;try{c.validateLocalClaims_({claims:[claim(),claim({id:'C2',evidenceRefs:['invented']})]},evidence,'兩個問題','');}catch(e){error=e;}
 assert(error&&error.partialResult);assert(error.partialResult.answer.includes('關閉電源'));assert.equal(error.partialResult.envelope.execution.state,'validation_error');
});
test('通論與推論都不能自帶無證據生成權限',()=>{
 for(const patch of [{evidenceRefs:[]},{basis:'derived',assumptions:[]}])assert.throws(()=>c.validateLocalClaims_({claims:[claim(patch)]},evidence,'問題',''),/VALIDATION/);
});
test('完整證據不切掉尾端限制',()=>{
 const text='既有內容。'.repeat(400)+'僅限已關閉電源時。';
 const ex=c.localEvidenceExcerpts_([{id:'RULE:x',kind:'definition',text}]);assert.equal(ex.length,1);assert(ex[0].text.endsWith('僅限已關閉電源時。'));
});
test('v2 不截第七項；舊快取不能升格',()=>{
 const e=c.normalizeAnswerEnvelope_({schemaVersion:2,claims:Array.from({length:7},(_,i)=>claim({id:'C'+i})),execution:{state:'ok'}});
 assert.equal(e.claims.length,7);assert.equal(e.status,'supported');
 const old=c.normalizeAnswerEnvelope_({status:'supported',claims:[{id:'legacy',status:'supported'}]});assert.notEqual(old.schemaVersion,2);
});
console.log('PASS v324 answer v2 '+passed);
