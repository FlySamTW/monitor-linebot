// Deployment gate using real generated artifacts. Only GAS I/O is simulated;
// importer, checksum verification, model resolution and BM25 remain production.
const fs=require('fs'),path=require('path'),assert=require('assert');
const {createProductionHarness}=require('./production_harness');
const h=createProductionHarness({quiet:true}),c=h.context;
const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../output/manual_library/editor_import.json'),'utf8'));
c.ScriptApp.getService=()=>({getUrl:()=>"https://example.test/dev"});
const token=c.issueTestUiAccessToken_(),files=new Map();let created=0;
c.Drive={Files:{get:()=>({mimeType:"application/vnd.google-apps.folder",capabilities:{canAddChildren:true}}),
  create:(_,blob)=>{const id='immutable-'+(++created);files.set(id,blob);return {id};}}};
c.DriveApp.getFileById=id=>({getBlob:()=>files.get(id)});
for(const record of pack.records) c.importManualIndexRecordFromTestUi(record,token);
let bound=0;
for(const [key,doc] of Object.entries(c.MANUAL_PAGE_RAG_DATA_.documents)) {
  const revision=c.readManualRevision_(key,doc),index=c.loadManualPageIndex_(key,doc,revision);
  assert(index.pages.length && index.pages.length===index.lex.N,key);
  for(const model of doc.models) {
    const owners=Object.values(c.MANUAL_PAGE_RAG_DATA_.documents).filter(d=>d.models.some(m=>c.manualEvidenceModelMatchesTarget_(m,model)));
    assert.strictEqual(owners.length,1,model+' must have a single document owner');bound++;
    assert.strictEqual(c.hasReadyManualIndexForModel_(model),true,model+' active index must enable manual entry');
  }
}
const questions=[
 ['S49DG932SC','PBP要怎麼開啟'],
 ['S27H704EAC','怎麼做自我診斷'],
 ['S27D606UAC','兩台電腦怎麼切換鍵盤滑鼠 KVM'],
 ['C24T550FDC','HDMI沒有畫面怎麼辦'],
 ['LF24T350FHC','護眼模式怎麼開'],
 ['S27DG602SC','螢幕怎麼做像素重新整理'],
];
for(const [model,question] of questions) {
  const plan=c.findManualPageRagPlan_(question,model);
  assert(plan && plan.fragments.length,model+question);
  if(model==='S49DG932SC') {
    const entry=plan.fragments.find(f=>String(f.menuPath).includes('PIP/PBP Mode'));
    assert(entry,'printed PBP setting hierarchy must survive retrieval: '+JSON.stringify(plan.fragments[0]));
    const raw={found:true,coverage:'partial',unresolvedQuestion:'如何開啟PBP',evidence:[{
      evidenceId:entry.evidenceId,supportedAnswer:'PIP/PBP Mode 可開啟或關閉 PIP/PBP 模式。'
    }]};
    const answer=c.hydrateManualPageRagResponse_(JSON.stringify(raw),plan,question,'');
    assert(answer.includes('→') && !/ERROR|AUTO_SEARCH_WEB/.test(answer),answer);
    const restricted=c.hydrateManualPageRagResponse_(JSON.stringify(raw),plan,'PBP怎麼開，兩邊都能120Hz嗎？','');
    assert(/PARTIAL|ERROR/.test(restricted),'table entry must not prove an added numerical condition');
  }
  if(model==='S27H704EAC') {
    const diagnosis=plan.fragments.find(f=>f.pageNumber===41 && f.evidenceText.includes('Self Diagnosis'));
    assert(diagnosis && diagnosis.evidenceText.includes('不要變更輸入來源'));
    assert(!diagnosis.evidenceText.includes('Software Update'),'next setting must not contaminate diagnosis scope');
    assert(!diagnosis.evidenceText.includes('S40H850TAC'),'left column restrictions must not move onto right column');
    const answer=c.hydrateManualPageRagResponse_(JSON.stringify({found:true,coverage:'full',unresolvedQuestion:'',evidence:[{
      evidenceId:diagnosis.evidenceId,supportedAnswer:'Self Diagnosis 在顯示器的圖片發生問題時執行此測試。'
    }]}),plan,question,'');
    assert(!/ERROR|AUTO_SEARCH_WEB/.test(answer),answer);
    assert(answer.includes('Support → Self Diagnosis'),answer);
    assert(answer.includes('不要變更輸入來源'),answer);
    assert(answer.includes('小提醒：'),answer);
    const alreadyComplete=c.hydrateManualPageRagResponse_(JSON.stringify({found:true,coverage:'full',unresolvedQuestion:'',evidence:[{
      evidenceId:diagnosis.evidenceId,supportedAnswer:'進入 Support → Self Diagnosis。在自行診斷期間，切勿關閉電源，也不要變更輸入來源。'
    }]}),plan,question,'');
    assert.strictEqual((alreadyComplete.match(/不要變更輸入來源/g)||[]).length,1,alreadyComplete);
  }
  if(model==='LF24T350FHC') {
    const entry=plan.fragments.find(f=>f.menuPath==='Picture → Eye Saver Mode');
    assert(entry,'continued menu table must retain Picture parent, not Color');
    assert.deepStrictEqual(Array.from(entry.evidencePages),[18,20]);
    const answer=c.hydrateManualPageRagResponse_(JSON.stringify({found:true,coverage:'full',unresolvedQuestion:'',evidence:[{
      evidenceId:entry.evidenceId,supportedAnswer:'Eye Saver Mode 設定讓眼睛放鬆的最佳畫質。'
    }]}),plan,question,'');
    assert(answer.includes('Picture → Eye Saver Mode') && answer.includes('18、20'),answer);
    assert(!/ERROR|AUTO_SEARCH_WEB/.test(answer),answer);
  }
  if(process.argv.includes('--inspect-h704') && model==='S27H704EAC') console.log(JSON.stringify(plan.fragments));
  console.log(JSON.stringify({model,question,docKey:plan.docKey,sha:plan.sourcePdfSha256,pages:plan.fragments.map(f=>f.pageNumber),heading:plan.fragments[0].pageHeading}));
}
assert.strictEqual(h.fetches.length,0);
const activeReport=c.readManualLibraryActivationReport_();
assert.strictEqual(activeReport.active,81);
assert.strictEqual(activeReport.models,136);
assert.strictEqual(activeReport.uniqueIndexes,47);
assert.strictEqual(activeReport.missing.length,0);
assert.strictEqual(c.readReadyManualIndexModels_().length,136);
const manifestReader=c.readOfficialManualManifest_; let manifestReads=0;
c.readOfficialManualManifest_=()=>{manifestReads++;return manifestReader();};
c.readReadyManualIndexModels_();
assert.strictEqual(manifestReads,1,'coverage must not read remote manifest once per registered document');
c.readOfficialManualManifest_=manifestReader;
const sample=Object.values(c.MANUAL_PAGE_RAG_DATA_.documents)[0];
const candidate={fullSku:sample.models[0],downloadUrl:'https://downloadcenter.samsung.com/test.pdf'};
assert.strictEqual(c.isManualIndexPromotionReady_(candidate,sample.sourcePdfSha256),true);
const sampleKey=Object.keys(c.MANUAL_PAGE_RAG_DATA_.documents)[0],pointerKey='MANUAL_ACTIVE::'+sampleKey;
const savedPointer=h.properties.get(pointerKey);
h.properties.delete(pointerKey);
assert.strictEqual(c.isManualIndexPromotionReady_(candidate,sample.sourcePdfSha256),false,'compiled metadata without read-back active pointer is not ready');
h.properties.set(pointerKey,savedPointer);
const before=created;
assert.throws(()=>c.assertManualIndexPromotionReady_(candidate,'f'.repeat(64),'test.pdf'),/PAGE_INDEX_BUILD_REQUIRED/);
assert.strictEqual(created,before,'changed revision must be stopped before any Drive write');
c.savePendingManualRevision_(candidate,'f'.repeat(64),'test.pdf','PROMOTION_EXCEPTION_PAGE_INDEX_BUILD_REQUIRED');
assert(c.readPendingManualIndexRevision_(candidate.fullSku,'f'.repeat(64)),'promotion wrapper must not defeat dedup');
assert.strictEqual(c.readPendingManualIndexRevision_(candidate.fullSku,'e'.repeat(64)),null);
assert.strictEqual(c.readPendingManualIndexBuilds_().length,1);
assert.strictEqual(c.hasReadyManualIndexForModel_(candidate.fullSku),true,'old active revision remains usable');
assert.strictEqual(c.hasReadyManualIndexForModel_('S99ZZ999'),false);
assert.strictEqual(c.findManualPageRagPlan_('HDMI沒有畫面怎麼辦','C24F390FHC'),null,'not registered in current RULE must not borrow another model');
console.log(JSON.stringify({registrations:Object.keys(c.MANUAL_PAGE_RAG_DATA_.documents).length,boundModels:bound,uniqueIndexes:created,providerCalls:0}));
