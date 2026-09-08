const assert=require('assert');
const {createProductionHarness}=require('./production_harness');
const h=createProductionHarness({quiet:true}),c=h.context;
const q='S27F612EAC 自我診斷怎麼做？';
const base='執行自我診斷時，切勿關閉電源。切勿變更輸入來源。';
const cases=[
 ['一般提醒','開始前，先把目前的工作告一段落。',base,true],
 ['既有警語白話','不要關掉電源。也不要切換輸入來源。',base,true],
 ['數值注入','不要關閉電源；完成後支援 USB-C 90W 供電。',base,false],
 ['中文假路徑','到設定 > 系統 > 超頻開啟增強模式。',base,false],
 ['新引號標籤','開啟「超頻增強模式」。',base,false],
 ['其他完整型號','S32FM803UC 支援此功能。',base,false],
 ['負轉正','可以關閉電源。',base,false],
 ['正轉負','不支援 HDMI。','支援 HDMI。',false],
 ['負轉正能力','支援 HDMI。','不支援 HDMI。',false],
 ['中文新功能','不要關閉電源。也可以啟用超頻增強功能。',base,false],
 ['混合注入','開始前，先把目前的工作告一段落，並開啟超頻模式。',base,false],
 ['既有標籤','選擇「自我診斷」。','選擇「自我診斷」。',true],
];
for(const [name,answer,previous,expected] of cases) {
 const actual=c.isSafeEvidenceElaboration_(answer,previous,q);
 assert.strictEqual(actual,expected,name);console.log('PASS '+name);
}
assert.strictEqual(h.fetches.length,0);
console.log('PASS real guard; providerCalls=0; router integration not claimed');
const {runJourney,specs}=require('./verify_20_journeys_v307');
const normal=runJourney(specs[12],130,{writeReport:false});
assert.strictEqual(normal.status,'PASS',normal.failure);
for(const bad of ['完成後支援 USB-C 90W 供電。','到設定 > 系統 > 超頻開啟增強模式。']) {
 let beforeQuota,anchor;
 const result=runJourney({name:'拒絕不可信展開 '+bad,steps:[...specs[12].steps.slice(0,2),{text:'#再詳細說明',advance:61000}],check:turns=>{
  const last=turns[1],reply=last.replies.join('\n');
  assert(reply.includes('目前能確認的內容都在上一則'));
  assert(!reply.includes(bad));
  assert.strictEqual(last.audit.pdfCalls,0);assert.strictEqual(last.audit.webCalls,0);
  assert.strictEqual(last.audit.finalCoverage,'unsupported');
  assert(turns[2].replies.join('\n').includes('沒有更多已確認的補充'));
 }},bad.includes('90W')?131:132,{writeReport:false,elaborationAnswer:bad,observeStep:({c,h,id,step,newLogs,fetchBefore})=>{
  if(step.text===specs[12].steps[0].text) {
   beforeQuota=c.readDailyQuestionUsage_(id);
   anchor=c.getElaborationTopicAnchor_(c.CacheService.getScriptCache(),id,step.text);
  } else {
   assert.strictEqual(c.getElaborationCountForAnchor_(c.CacheService.getScriptCache(),id,anchor),0,'展開權應釋放');
   assert.deepStrictEqual(c.readDailyQuestionUsage_(id),beforeQuota,'一般額度退款');
   const generated=h.fetches.slice(fetchBefore).filter(f=>String(f.url||f[0]||'').includes(':generateContent'));
   assert.strictEqual(generated.length,newLogs.some(x=>x.includes('exhausted evidence'))?0:1,'首次僅 Fast；耗盡後零生成 '+newLogs.slice(-8).join('\n'));
  }
 }});
 assert.strictEqual(result.status,'PASS',result.failure);
}
console.log('PASS handleMessage elaboration: safe output + 2 rejected injections, quota/entitlement restored, no PDF/Web escalation');
