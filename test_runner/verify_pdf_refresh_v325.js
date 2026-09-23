const assert=require('assert');
const {createProductionHarness}=require('./production_harness');
const h=createProductionHarness({quiet:true}),c=h.context;
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name);}
const now=Date.now();
function file(name,id,hoursAgo=0){const updated=new Date(now-hoursAgo*3600000);return {getName:()=>name,getId:()=>id,getSize:()=>1234,getLastUpdated:()=>updated};}

test('逐檔到期狀態可區分 expired expiring valid unknown',()=>{
 assert.equal(c.getManualPdfUriExpiryState_({fileApiExpiresAt:new Date(now-1).toISOString()},now).status,'expired');
 assert.equal(c.getManualPdfUriExpiryState_({fileApiExpiresAt:new Date(now+6*3600000).toISOString()},now).status,'expiring');
 assert.equal(c.getManualPdfUriExpiryState_({fileApiExpiresAt:new Date(now+20*3600000).toISOString()},now).status,'valid');
 assert.equal(c.getManualPdfUriExpiryState_({},now).status,'unknown');
});

test('缺 provider expiry 時以 uploadedAt + 48h 保守推定',()=>{
 const x=c.getManualPdfUriExpiryState_({fileApiUploadedAt:new Date(now-40*3600000).toISOString()},now);
 assert.equal(x.status,'expiring');assert.equal(x.expirationSource,'estimated_48h');
});

test('排程優先過期與十二小時內到期，再公平輪替',()=>{
 const catalog=[file('A.pdf','a'),file('B.pdf','b'),file('C.pdf','c'),file('D.pdf','d')];
 const current={
  'A.PDF':{uri:'u',fileApiExpiresAt:new Date(now+30*3600000).toISOString()},
  'B.PDF':{uri:'u',fileApiExpiresAt:new Date(now-1000).toISOString()},
  'C.PDF':{uri:'u',fileApiExpiresAt:new Date(now+4*3600000).toISOString()},
  'D.PDF':{uri:'u',fileApiExpiresAt:new Date(now+30*3600000).toISOString()}
 };
 const picked=c.selectManualPdfRefreshCandidates_(catalog,current,3,3,{}).map(f=>f.getName());
 assert.deepEqual(Array.from(picked.slice(0,2)),['B.pdf','C.pdf']);assert.equal(picked.length,3);
});

test('永久 provenance 拒絕只跳過同一 Drive identity',()=>{
 const a=file('A.pdf','a'),id=c.buildDrivePdfIdentity_(a.getId(),a.getLastUpdated(),a.getSize());
 assert.equal(c.selectManualPdfRefreshCandidates_([a],{},0,10,{'A.PDF':id}).length,0);
 const changed=file('A.pdf','a',1);
 assert.equal(c.selectManualPdfRefreshCandidates_([changed],{},0,10,{'A.PDF':id}).length,1);
});

test('過期 URI 不再被視為 fresh，未過期同 identity 可沿用',()=>{
 const f=file('A.pdf','a'),base={uri:'u',identity:c.buildDrivePdfIdentity_(f.getId(),f.getLastUpdated(),f.getSize()),fileApiUploadedAt:new Date(now+1000).toISOString()};
 assert.equal(c.isKbPdfUriFreshForDriveCandidate_(Object.assign({},base,{fileApiExpiresAt:new Date(now-1000).toISOString()}),{driveFileId:'a',updatedAtMs:f.getLastUpdated().getTime(),sizeBytes:1234}),false);
 assert.equal(c.isKbPdfUriFreshForDriveCandidate_(Object.assign({},base,{fileApiExpiresAt:new Date(now+24*3600000).toISOString()}),{driveFileId:'a',updatedAtMs:f.getLastUpdated().getTime(),sizeBytes:1234}),true);
});
console.log('PASS v325 pdf refresh '+passed);
