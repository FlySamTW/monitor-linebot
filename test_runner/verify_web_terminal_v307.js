const assert = require('assert');
const {createProductionHarness} = require('./production_harness');
const h = createProductionHarness({quiet:true}), c=h.context;
for(const q of ['後面的燈可以跟畫面同步嗎？','藍牙喇叭怎麼連？','HDMI怎麼切換？']) {
  const answer=c.buildSafeNoEvidenceNextStep_(q,'S49DG952SC');
  assert(!/兩端重插|沒有靜音|更換線材/.test(answer),q+': '+answer);
}
assert(/兩端重插/.test(c.buildSafeNoEvidenceNextStep_('HDMI無訊號怎麼排除？','S49DG952SC')));
assert(c.isExactProductFactQuestion_('PBP怎麼開？那兩邊都能120Hz嗎？'));
for(const question of ['可以跟畫面同步嗎？','我要跟畫面同步']) {
  assert(c.isEllipticalEvidenceFollowUp_(question));
  assert(c.resolvePersistentFollowupQuestion_(question,'G9後面的燈怎麼開？').includes('後面的燈'));
}
assert(!c.isEllipticalEvidenceFollowUp_('那USB-C供电多少？'));
const generic=c.buildGroundedSupportedAnswer_([
 'S49CG932SC 多數G9類似型號在PBP兩邊都可達120Hz。'
], 'S49CG932SC','PBP怎麼開？那兩邊都能120Hz嗎？','',true,true);
assert(!generic || generic.coverage!=='full');
assert.strictEqual(h.fetches.length,0);
console.log('PASS terminal advice requires symptoms; scoped numerical claims reject generic extrapolation; providerCalls=0');
