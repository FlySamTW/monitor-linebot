const assert=require('assert'),fs=require('fs');
const {createProductionHarness}=require('./production_harness');
function harness(){
 const h=createProductionHarness({quiet:true,now:'2026-09-08T08:00:00Z',properties:{GEMINI_API_KEY:'fixture',keyword_map_v1:JSON.stringify({rules:fs.readFileSync(require('path').join(__dirname,'../CLASS_RULES.csv'),'utf8')})}});
 h.run('IS_TEST_MODE=true');h.context.initializeProviderBudget_(0,h.context.providerMonthKey_());
 h.setFetch((url)=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify(url.includes(':countTokens')?{totalTokens:100}:{candidates:[{content:{parts:[{text:'{}'}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:10}})}));return h;
}
function send(h,q,id='identity'){const before=h.logs.length,fetches=h.fetches.length;h.context.handleMessage({type:'message',replyToken:'TEST_REPLY_TOKEN',source:{type:'user',userId:id},message:{type:'text',text:q}});return {q,reply:h.logs.slice(before).filter(x=>String(x).includes('[Reply Audit]')).join('\n'),calls:h.fetches.length-fetches};}
const h=harness(), c=h.context;
const turns=['S32FM803UC Wi-Fi怎麼連？','那有線網路呢？','S99ZZ999支援PBP嗎？','那更新率呢？'].map(q=>send(h,q));
console.log(JSON.stringify(turns));
assert(turns[0].reply.includes('無線'));
assert.strictEqual(turns[2].calls,0);
assert.strictEqual(turns[3].calls,0);
assert(/型號|確認/.test(turns[3].reply));
assert(!/App|應用程式|S32FM803|60Hz|60 Hz/i.test(turns[3].reply),'unknown turn must suspend old model implicit followup');
assert.strictEqual(c.readSourceProductState_('identity').model,'S32FM803UC','preserve confirmed model storage');
const restored=send(h,'S32FM803UC更新率多少？');assert(/60/.test(restored.reply)&&!/應用程式/.test(restored.reply),restored.reply);
h.advanceTime(86400000);const crossday=send(h,'那USB-C能充幾瓦？');assert(/65W/.test(crossday.reply),crossday.reply);
assert.strictEqual(c.findVerifiedManualChunk_('那更新率呢？','S32FM803UC'),null);
assert.strictEqual(c.findVerifiedManualChunk_('刷新率多少？','S32FM803UC'),null);
assert(c.findVerifiedManualChunk_('App如何更新？','S32FM803UC'),'real app update remains eligible');
const cancelled=harness();
send(cancelled,'S32FM803UC Wi-Fi怎麼連？');send(cancelled,'S99ZZ999支援PBP嗎？');
const cancel=send(cancelled,'/取消');assert(cancel.reply.includes('已取消')&&cancel.calls===0);
const afterCancel=send(cancelled,'那更新率呢？');assert(!/App|應用程式/i.test(afterCancel.reply),afterCancel.reply);
console.log('PASS full Wi-Fi/web/unknown/followup/restored/crossday chain + update-rate lexical guards; realProviderCalls=0');
