const fs=require('fs'),path=require('path'),assert=require('assert');
const {createProductionHarness}=require('./production_harness');
const h=createProductionHarness({quiet:true}),c=h.context,key='S61F_F612_EN_PRINTED_FAMILY_241113';
const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../output/manual_library/v307_f612/editor_import.json'),'utf8'));
assert.strictEqual(pack.records.length,1);assert.strictEqual(c.hasReadyManualIndexForModel_('S27F612EAC'),false);
c.ScriptApp.getService=()=>({getUrl:()=> 'https://example.test/dev'});
let writes=0;const files=new Map();
c.Drive={Files:{get:()=>({mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}}),create:(_,blob)=>{let id='f612-'+(++writes);files.set(id,blob);return{id};}}};
c.DriveApp.getFileById=id=>({getBlob:()=>files.get(id)});
const token=c.issueTestUiAccessToken_();
const result=c.importManualIndexRecordFromTestUi(pack.records[0],token);assert.strictEqual(result.active.length,1);
assert.strictEqual(c.hasReadyManualIndexForModel_('S27F612EAC'),true);
const doc=c.MANUAL_PAGE_RAG_DATA_.documents[key];assert(!doc.pageIndex.data&&!doc.pageIndex.dataRef);
const index=c.loadManualPageIndex_(key,doc,c.readManualRevision_(key,doc));assert.strictEqual(index.pages.length,38);
for(const [q,page] of [['Self Diagnosis',28],['SelfDiagnosis',28],['自我診斷怎麼做？',28],['自行診斷怎麼做？',28],['Eye Saver Mode',23]]) {
 const plan=c.findManualPageRagPlan_(q,'S27F612EAC');
 assert(plan&&plan.fragments.some(f=>f.pageNumber===page),q+JSON.stringify(plan&&plan.fragments.map(f=>f.pageNumber)));
 console.log(JSON.stringify({q,pages:plan.fragments.map(f=>f.pageNumber),docKey:plan.docKey}));
}
c.importManualIndexRecordFromTestUi(pack.records[0],token);assert.strictEqual(writes,1);
for(const q of ['自我診斷怎麼做？','護眼模式怎麼開？']) {
 const plan=c.findManualPageRagPlan_(q,'S27F612EAC');
 console.log(JSON.stringify({chineseQuery:q,pages:plan?plan.fragments.map(f=>f.pageNumber):[],diagnosticOnly:true}));
}
for(const model of ['S27D392GAC','S32D392GAC','S32AM703UC']) {
 assert.strictEqual(c.hasReadyManualIndexForModel_(model),false,'external reference cannot become evidence');
 const action=c.buildOfficialAlternativeQuickReply_(model);assert(action&&action.action.label.includes('參考'));
 assert.strictEqual(action.action.type,'uri');
}
assert(c.buildOfficialAlternativeQuickReply_('S32FM902SC').action.label.includes('HTML'));
assert.strictEqual(h.fetches.length,0);
// Actual importer must reject a known stale manifest, not silently bypass it.
const stale=createProductionHarness({quiet:true}),s=stale.context;
s.ScriptApp.getService=()=>({getUrl:()=> 'https://example.test/dev'});
s.Drive={Files:{get:()=>({mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}})}};
s.PropertiesService.getScriptProperties().setProperty('OFFICIAL_MANUAL_MANIFEST',JSON.stringify({LS27F612EACXZW:{fullSku:'LS27F612EACXZW',sourcePdfSha256:'e11c64d5666a7fabfc0a69c4cc2a5f84dd57429bb4bb189cab2cd262257ab268'}}));
assert.strictEqual(s.readManualRevision_(key,s.MANUAL_PAGE_RAG_DATA_.documents[key]),null);
assert.throws(()=>s.importManualIndexRecordFromTestUi(pack.records[0],s.issueTestUiAccessToken_()),/INDEX_SOURCE_REVISION_CHANGED/);
assert.strictEqual(s.hasReadyManualIndexForModel_('S27F612EAC'),false);
console.log('PASS stale DRM manifest blocks importer; requires reviewed atomic PDF+index promotion, not standalone index import');
console.log('PASS F612 checksum/readback/38pages/retrieval/idempotency + 3 non-evidence external references; realProviderCalls=0');
