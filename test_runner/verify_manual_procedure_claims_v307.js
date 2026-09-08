// Actual page retrieval + hydrate + structured validator. No provider or router stubs.
const assert=require('assert');
const {createProductionHarness}=require('./production_harness');
const h=createProductionHarness({quiet:true}), c=h.context;
const model='S32FM803UC';
const positive=[
 'S32FM803UC 如何連接藍牙喇叭的操作步驟與設定路徑？',
 'S32FM803UC 如何連接藍牙揚聲器，設定路徑及操作方式？',
 'S32FM803UC 如何配對藍牙喇叭，操作方法和選單入口？',
];
function evidenceAnswer(question) {
 const plan=c.findManualPageRagPlan_(question,model);
 assert(plan&&plan.fragments.length);
 const fragment=plan.fragments.find(f=>f.pageNumber===151);
 assert(fragment,'actual retrieved printed151');
 const raw=JSON.stringify({found:true,coverage:'full',evidence:[{evidenceId:fragment.evidenceId,
  supportedAnswer:'向左方向按鈕 → 設定 → 所有設定 → 音效 → 音效輸出 → 藍牙揚聲器清單。'}]});
 return c.hydrateManualPageRagResponse_(raw,plan,question,'');
}
for(const question of positive) {
 assert(c.isPotentialMultiClaimQuestion_(question),'regression requires original conservative classifier');
 assert.strictEqual(c.isMultipleManualProcedureClaim_(question),false);
 const answer=evidenceAnswer(question);
 assert(!/VALIDATION_ERROR|AUTO_SEARCH_WEB|MANUAL_EVIDENCE_PARTIAL/.test(answer),answer);
 assert(answer.includes('151')&&answer.includes('藍牙揚聲器清單'),answer);
}
for(const question of [
 'S32FM803UC 如何連接藍牙喇叭和Wi-Fi，操作步驟與設定路徑？',
 'S32FM803UC HDMI和USB-C操作步驟與設定路徑？',
 'S32FM803UC 藍牙喇叭與耳機孔怎麼設定？',
]) assert.strictEqual(c.isMultipleManualProcedureClaim_(question),true,question);
const multiQuestion='S32FM803UC 如何連接藍牙喇叭和Wi-Fi，操作步驟與設定路徑？';
assert(/ERROR|PARTIAL/.test(evidenceAnswer(multiQuestion)),'one Bluetooth page cannot fulfill two real functions');
for(const question of [
 'S32FM803UC 如何連接藍牙喇叭的操作步驟與設定路徑，能同時接兩邊120Hz嗎？',
 'S32FM803UC 如何連接藍牙喇叭的操作步驟與設定路徑，可以接多少個？',
]) assert(/ERROR|PARTIAL/.test(evidenceAnswer(question)),'numerical/conditional request cannot use simple shared procedure: '+question);
assert.strictEqual(c.manualEvidenceSupportsTargetModel_({scope:'支援頁綁定',documentBound:true,conditionalProcedure:true,excerpt:'S32HG802SC USB-C：依型號可能不支援。'},'S32HG806ES'),false);
assert.strictEqual(h.fetches.length,0);
console.log('PASS 3 real-validator positive + 3 multi-function classifiers + 1 real-validator multi-function + 2 numerical/condition + 1 cross-model; providerCalls=0');
