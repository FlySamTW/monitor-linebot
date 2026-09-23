const assert=require('assert');
const {createProductionHarness}=require('./production_harness');
const h=createProductionHarness({quiet:true}),c=h.context;
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name);}
function claim(p={}){return Object.assign({id:'C1',question:'USB-C供電幾瓦？',scope:'model_specific',state:'answered',basis:'direct',answer:'USB-C 可供電 65W。',evidenceRefs:['RULE:M'],conditions:[],assumptions:[]},p);}

test('原題兩個明確子題只回答一題仍必須 partial',()=>{
 const ev=[{id:'RULE:M',kind:'product_facts',text:'USB-C 最高供電 65W。',scope:{models:['S32TEST']}}];
 const r=c.validateLocalClaims_({claims:[claim()]},ev,'USB-C供電幾瓦？；能同時顯示兩個輸入嗎？','S32TEST');
 assert.equal(r.complete,false);assert.equal(r.envelope.requestItems.length,2);assert(r.envelope.unresolvedClaims.length>=1);
});

test('數字必須完整匹配，65W 不得支持 5W 或 650W',()=>{
 const ev=[{id:'RULE:M',kind:'product_facts',text:'USB-C 最高供電 65W。',scope:{models:['S32TEST']}}];
 for(const answer of ['USB-C 可供電 5W。','USB-C 可供電 650W。']) assert.throws(()=>c.validateLocalClaims_({claims:[claim({answer})]},ev,'USB-C供電幾瓦？','S32TEST'),/VALIDATION/);
 assert(c.validateLocalClaims_({claims:[claim()]},ev,'USB-C供電幾瓦？','S32TEST').complete);
});

test('切換來源不能推出同時顯示',()=>{
 const ev=[{id:'QA:x',kind:'qa',text:'可在 HDMI 與 DisplayPort 之間切換輸入來源。',scope:{models:['S32TEST']}}];
 assert.throws(()=>c.validateLocalClaims_({claims:[claim({question:'可以同時顯示嗎？',answer:'可以同時顯示 HDMI 與 DisplayPort 畫面。',evidenceRefs:['QA:x']})]},ev,'可以同時顯示嗎？','S32TEST'),/VALIDATION/);
});

test('HDMI 影像連線不能推出 KVM',()=>{
 const ev=[{id:'QA:x',kind:'qa',text:'使用 HDMI 纜線連接電腦影像。',scope:{models:['S32TEST']}}];
 assert.throws(()=>c.validateLocalClaims_({claims:[claim({question:'KVM怎麼切？',answer:'可用 KVM 切換鍵盤滑鼠。',evidenceRefs:['QA:x']})]},ev,'KVM怎麼切？','S32TEST'),/VALIDATION/);
});

test('中文與英文必要限制都會被抽出',()=>{
 const got=c.localEvidenceRequiredConditions_({text:'切勿關閉電源。Do not change input source. This setting is available only depending on model.'});
 assert(got.some(x=>x.includes('切勿')));assert(got.some(x=>/Do not/i.test(x)));assert(got.some(x=>/depending on model/i.test(x)));
});

test('多子題 advanced success 缺 resolvedClaimIds 不得自動全數成功',()=>{
 const routeClaims=[{id:'A',question:'怎麼開？',evidenceNeed:'manual_model_specific'},{id:'B',question:'有什麼限制？',evidenceNeed:'manual_model_specific'}];
 const e=c.buildAdvancedAnswerEnvelope_('manual','怎麼開？；有什麼限制？','S32TEST','依手冊第 12 頁操作。','success',[],{routeClaims,targetClaimIds:['A','B']});
 assert.notEqual(e.status,'supported');assert(e.unresolvedClaims.length>=1);
});

console.log('PASS v325 answer integrity '+passed);
