const fs=require('fs'),path=require('path'),assert=require('assert');
const {createProductionHarness}=require('./production_harness');
const h=createProductionHarness({quiet:true}),c=h.context;
const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../output/manual_library/editor_import.json'),'utf8'));
c.ScriptApp.getService=()=>({getUrl:()=> 'https://example.test/dev'});
const files=new Map();let serial=0;
c.Drive={Files:{get:()=>({mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}}),create:(_,blob)=>{const id='switch-'+(++serial);files.set(id,blob);return{id};}}};
c.DriveApp.getFileById=id=>({getBlob:()=>files.get(id)});
const token=c.issueTestUiAccessToken_();
for(const record of pack.records)c.importManualIndexRecordFromTestUi(record,token);
for(const model of ['S32FM703UC','S49DG952SC']) {
 for(const question of ['HDMI怎麼切換？','自動訊號源切換怎麼設定？','Anynet+ HDMI-CEC怎麼設定？']) {
  const plan=c.findManualPageRagPlan_(question,model);
  assert(plan&&plan.fragments.length,model+question);
  const intent=c.getManualSourceSwitchIntent_(question);
  assert(plan.fragments.every(f=>c.manualSourceSwitchEvidenceMatches_(question,f.evidenceText,f.pageHeading)));
  if(intent==='manual') {
   assert(plan.fragments.some(f=>/外部裝置間切換/.test(f.pageHeading)));
   assert(plan.fragments.every(f=>!/Anynet|自動訊號源切換/i.test(f.pageHeading)));
   assert(!c.isManualSourceSwitchAnswerFaithful_(question,'透過 Anynet+ (HDMI-CEC) 來切換 HDMI。'));
   assert(!c.isManualSourceSwitchAnswerFaithful_(question,'使用自動訊號源切換來切換 HDMI。'));
   const evidence=plan.fragments.find(f=>/外部裝置間切換/.test(f.pageHeading));
   const answer='在訊號源畫面選擇連接的外部裝置，所選裝置的輸出會顯示在產品螢幕上。';
   const selected=[{pageHeading:evidence.pageHeading,excerpt:evidence.evidenceText,supportedAnswer:answer}];
   assert(c.isVerifiedGenericSourceSelectionCoverage_(answer,question,selected),'generic manual selection covers interface switch');
   for(const badQuestion of ['HDMI 2怎麼切換？','HDMI切換時支援120Hz嗎？','HDMI與PBP怎麼設定？'])
    assert(!c.isVerifiedGenericSourceSelectionCoverage_(answer,badQuestion,selected),badQuestion);
   assert(!c.isVerifiedGenericSourceSelectionCoverage_(answer,question,[{pageHeading:'Anynet+ (HDMI-CEC)',excerpt:'可以控制外部裝置'}]));
   assert(!c.isVerifiedGenericSourceSelectionCoverage_(answer+'支援90W供電。',question,selected));
   assert(!c.isVerifiedGenericSourceSelectionCoverage_('用 Anynet+ (HDMI-CEC) 切換訊號源。',question,selected));
   const hydrated=c.hydrateManualPageRagResponse_(JSON.stringify({found:true,coverage:'full',evidence:[{evidenceId:evidence.evidenceId,supportedAnswer:answer}]}),plan,question,'');
   assert(!/ERROR|NOT_FOUND/.test(hydrated),hydrated);
   assert(hydrated.includes('訊號源畫面選擇'));
   for(const natural of [
    '若要切換至已連接的外部裝置，請按下向左方向按鈕，然後選擇您要切換的裝置。',
    '在「訊號源」畫面中，選擇已連接的外部裝置。',
    '在訊號源畫面，選取已連接的外部裝置。',
    '在『訊號源』畫面中，切換至要使用的外部裝置。',
    '在訊號源畫面上，接著選擇已連接的外部裝置。',
    '選擇所需的輸入來源。',
   ]) {
    assert(c.isVerifiedGenericSourceSelectionCoverage_(natural,question,selected),natural);
    const result=c.hydrateManualPageRagResponse_(JSON.stringify({found:true,coverage:'full',evidence:[{evidenceId:evidence.evidenceId,supportedAnswer:natural}]}),plan,`${model}的HDMI怎麼切換?`,'');
    assert(!/ERROR|NOT_FOUND|PARTIAL/.test(result),natural+' '+result);
   }
   for(const wrong of ['在「訊號源」畫面中，透過 Anynet+ (HDMI-CEC) 切換裝置。','啟用自動訊號源切換，選擇輸入來源。','透過 Anynet+ (HDMI-CEC) 切換至已連接的外部裝置。','啟用自動訊號源切換，再選擇已連接的外部裝置。'])
    assert(!c.isVerifiedGenericSourceSelectionCoverage_(wrong,question,selected),wrong);
  }
  console.log(JSON.stringify({model,intent,pages:plan.fragments.map(f=>f.pageNumber)}));
 }
}
assert.strictEqual(h.fetches.length,0);
const permissionQuery='S27H704EAC進行自我診斷測試時是否可以切換輸入訊號源？';
assert.strictEqual(c.getManualSourceSwitchIntent_('可以告訴我HDMI怎麼切換嗎？'),'manual');
assert.strictEqual(c.getManualSourceSwitchIntent_('HDMI可以怎麼切換？'),'manual');
assert.strictEqual(c.getManualSourceSwitchIntent_('測試期間能不能選擇輸入來源？'),'');
const permissionPlan=c.findManualPageRagPlan_(permissionQuery,'S27H704EAC');
assert(permissionPlan,'permission question must retain page retrieval');
const diagnosis=permissionPlan.fragments.find(f=>f.pageNumber===41 && f.evidenceText.includes('不要變更輸入來源'));
assert(diagnosis,'permission evidence must be diagnosis section, not source selector');
const warning='在自行診斷期間，請勿關閉電源，也不要變更輸入來源。';
const permissionAnswer=c.hydrateManualPageRagResponse_(JSON.stringify({found:true,coverage:'full',unresolvedQuestion:'',evidence:[{evidenceId:diagnosis.evidenceId,supportedAnswer:warning}]}),permissionPlan,permissionQuery,'');
assert(!/ERROR|NOT_FOUND|PARTIAL/.test(permissionAnswer),permissionAnswer);
assert(permissionAnswer.includes('不要變更輸入來源'));
assert(!/選擇.*來源|按.*OK/.test(permissionAnswer));
const guardedPermission=c.applyManualEvidenceGuard_(permissionAnswer,permissionQuery);
let finalPermission=c.stripAnySourceTags(c.formatForLineMobile(guardedPermission));
assert(!/AUTO_SEARCH_WEB/.test(finalPermission),guardedPermission);
finalPermission=c.sanitizeManualDeflection(finalPermission,permissionQuery);
finalPermission=c.enforceManualUncertaintyGuard(finalPermission,permissionQuery);
finalPermission=c.enforceManualNumberedList(finalPermission);
assert(!c.isManualEvidenceFailureReply_(finalPermission),finalPermission);
assert(finalPermission.includes('不要變更輸入來源'));
console.log('PASS contextual permission question retains diagnosis page41 and full warning without Web handoff');
console.log('PASS manual/automatic/CEC intent-separated real retrieval and manual hydration; providerCalls=0');
const {runJourney,specs}=require('./verify_20_journeys_v307');
for(const followup of ['那測試時可以切換輸入嗎？','測試時可以切換輸入嗎？']) {
 const route=runJourney({...specs[14],name:'J15 permission '+followup,steps:[{text:'S27H704EAC怎麼自我診斷？'},{text:followup}],check:turns=>{
  const last=turns[1];assert.strictEqual(last.audit.webCalls,0);
  assert(last.replies.join('\n').includes('不要變更輸入來源'));
 }},followup.startsWith('那')?151:152,{writeReport:false,routerAnalysis:(input,result)=>{
  // Captured live planner rewrite, including the pronoun-free permission turn.
  if(/測試時可以切換輸入/.test(input.originalQuestion)) return {...result,topicRelation:'followup',claims:[{id:'C1',question:permissionQuery,intent:'operation',evidenceNeed:'manual_model_specific',answerShape:'steps'}]};
  return result;
 },observeStep:({h,step,fetchBefore})=>{
  if(step.text!==followup)return;
  const requests=h.fetches.slice(fetchBefore).map(f=>JSON.stringify(f));
  assert(!requests.some(r=>/fileData|file_data/.test(r)),'no whole-PDF attachments');
 }});
 assert.strictEqual(route.status,'PASS',route.failure);
 assert(route.providerEvidence.some(e=>e.page===41&&e.evidenceId),'actual retrieved evidence page41');
}
console.log('PASS J15 with/without pronoun true handleMessage; real page retrieval, no file_data and no Web');
