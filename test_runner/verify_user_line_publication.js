const assert=require('assert');
function validateUserLinePublication(a,m,review,diagnostic,journeys){
  assert(a.publishBeforeLineAcceptance===true&&a.requestedTester==='user'&&typeof a.userInstruction==='string'&&a.userInstruction.trim().length>=10,'EXPLICIT_USER_PUBLICATION_REQUIRED');
  assert(a.version===m.version&&a.build===m.build&&a.runtimeManifestSha256===m.runtimeManifestSha256,'AUTHORIZED_RUNTIME_MISMATCH');
  const age=Date.now()-Date.parse(a.recordedAt);
  assert(Number.isFinite(age)&&age>=0&&age<3600000,'AUTHORIZATION_NOT_FRESH');
  assert(diagnostic.version===m.version&&diagnostic.build===m.build,'DIAGNOSTIC_BUILD_MISMATCH');
  assert(diagnostic.verificationBatch===m.verificationBatch&&diagnostic.authorizedCapTwd===m.authorizedCapTwd,'DIAGNOSTIC_BUDGET_MISMATCH');
  assert(Number.isFinite(diagnostic.batchAfterTwd)&&Number.isFinite(diagnostic.reservedTwd)&&diagnostic.batchAfterTwd>=0&&diagnostic.reservedTwd>=0&&diagnostic.batchAfterTwd+diagnostic.reservedTwd<m.authorizedCapTwd,'VERIFICATION_BUDGET_EXHAUSTED');
  assert(diagnostic.modelProbe.some(p=>p.model===review.generationModel&&p.httpStatus===200&&p.answered===true),'SELECTED_MODEL_NOT_AVAILABLE');
  assert(Array.isArray(journeys)&&journeys.length===20&&journeys.filter(j=>j.status==='PASS').length>=19&&!journeys.some(j=>j.criticalFailure===true),'CORE_JOURNEYS_NOT_READY');
  assert(a.priorChecksPassed===true&&a.acceptanceStatus==='pending','PRIOR_CHECKS_OR_PENDING_STATUS_REQUIRED');
}
module.exports={validateUserLinePublication};
if(require.main===module){
  const m={version:'test',build:'build',runtimeManifestSha256:'hash',verificationBatch:'batch',authorizedCapTwd:10};
  const r={generationModel:'lite'},a={publishBeforeLineAcceptance:true,requestedTester:'user',userInstruction:'請先切換正式部署，讓我在LINE測試',recordedAt:new Date().toISOString(),...m,priorChecksPassed:true,acceptanceStatus:'pending'};
  const d={version:'test',build:'build',verificationBatch:'batch',authorizedCapTwd:10,batchAfterTwd:3.94,reservedTwd:0,modelProbe:[{model:'lite',httpStatus:200,answered:true}]};
  const j=Array.from({length:20},()=>({status:'PASS'}));
  validateUserLinePublication(a,m,r,d,j);
  for(const patch of [{publishBeforeLineAcceptance:false},{runtimeManifestSha256:'other'},{acceptanceStatus:'passed'},{priorChecksPassed:false},{recordedAt:'2000-01-01'}])assert.throws(()=>validateUserLinePublication({...a,...patch},m,r,d,j));
  assert.throws(()=>validateUserLinePublication(a,m,r,{...d,batchAfterTwd:11},j));
  assert.throws(()=>validateUserLinePublication(a,m,r,{...d,modelProbe:[]},j));
  assert.throws(()=>validateUserLinePublication(a,m,r,d,j.slice(1)));
  console.log('PASS 明確先發布授權、候選綁定、費用、模型與20旅程守門；不偽造LINE驗收');
}
