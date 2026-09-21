const assert = require('assert');
const {validateLiveLineEvidence: validate} = require('./live_line_evidence');
const fixture = () => ({acceptanceSurface:'line',version:'v-fixture',build:'fixture',verificationBatch:'test',authorizedCapTwd:10,
  coreJourneys:{total:20,passed:19,criticalFailures:0},results:[{surface:'line',visibleAnswerVerified:true,visibleAnswer:'既有來源回答',receipts:[],
    transport:{kind:'real_line_reply',state:'accepted_by_line',eventId:'fixture',windowValid:true,version:'v-fixture',build:'fixture',
      verificationBatch:'test',authorizedCapTwd:10,inputSha256:'a'.repeat(64),replySha256:'b'.repeat(64),providerReceiptIds:[],providerCalls:0}}]});
validate(fixture());
for(const mutate of [x=>x.acceptanceSurface='testui',x=>x.results[0].visibleAnswerVerified=false,
  x=>x.coreJourneys.passed=18,x=>x.coreJourneys.criticalFailures=1,x=>x.results[0].transport.build='old',
  x=>x.results[0].transport.windowValid=false,x=>x.results[0].transport.providerReceiptIds=['missing'],
  x=>x.results[0].transport.providerCalls=1]) {
  const x=fixture();mutate(x);assert.throws(()=>validate(x));
}
console.log('PASS LINE final evidence rejects TestUI, missing visible answer, stale build, expired window and missing receipts; fixture only');
