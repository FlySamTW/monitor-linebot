// OFFLINE ONLY: intact production router/resolver/validator; fake GAS I/O only.
const fs = require('fs'), path = require('path'), assert = require('assert');
const {createProductionHarness} = require('./production_harness');
const pack = JSON.parse(fs.readFileSync(path.join(__dirname, '../output/manual_library/editor_import.json'), 'utf8'));
const records = [];
const msg = text => ({text});
const button = source => ({postback:`rm_action=select_source&source=${source}&v=2`});
const response = body => ({getResponseCode:()=>200,getContentText:()=>JSON.stringify(body)});
// Curated fixtures use existing regression answers or the actual supplied
// official evidence text. Missing support remains partial/none; no source or
// validator is replaced. Router fixtures classify intent without product facts.
const fixtures = [
  {question:/自我診斷|診斷|切換輸入/, evidence:/Self Diagnosis/, answer:'進入 Support → Self Diagnosis。在自行診斷期間，切勿關閉電源，也不要變更輸入來源。'},
  {question:/PBP.*開|開.*PBP/i, evidence:/PIP\/PBP Mode/, answer:'PIP/PBP Mode 可開啟或關閉 PIP/PBP 模式。'},
  {question:/護眼/, evidence:/Eye Saver Mode/, answer:'Eye Saver Mode 設定讓眼睛放鬆的最佳畫質。'},
  {question:/藍牙/, evidence:/藍牙喇叭清單/, answer:'按左方向鍵，進入設定 → 所有設定 → 音效 → 音效輸出 → 藍牙喇叭清單。'},
  {question:/Wi-Fi|無線/, evidence:/網路設定/, answer:'設定 → 所有設定 → 連線 → 網路 → 網路設定 → 無線。'},
  {question:/零售/, evidence:/零售模式/, answer:'設定 → 所有設定 → 一般與隱私權 → 使用模式，選擇零售模式。'},
  {question:/睡眠/, evidence:/睡眠計時器/, answer:'設定 → 所有設定 → 一般與隱私權 → 省電和節能 → 睡眠計時器。'},
  {question:/燈/, evidence:/Core Lighting/, answer:'設定 → 所有設定 → 遊戲 → Core Lighting，可開啟或關閉產品背面的 LED 照明。'},
  {question:/網路線|有線網路/, evidence:/建立有線網路連線/, answer:'共用手冊記載：設定 → 所有設定 → 連線 → 網路 → 網路設定 → 有線。部分型號不支援有線網路，尚不能據此確認目前型號能接網路線。', coverage:'partial', unresolved:'目前型號是否支援有線網路仍需核對。'},
  {question:/HDMI.*切換|切換.*HDMI/i, evidence:/在連接.*外部裝置間切換/, answer:'按左方向鍵，選擇已連接裝置，再在訊號源畫面選擇已連接的 HDMI 外部裝置。'},
  {question:/PBP/i, evidence:/只能顯示一個外部輸入/, answer:'您可以透過多重視窗檢視多個內容項目。只能顯示一個外部輸入（包括 HDMI、DisplayPort、Type-C）和一個鏡像裝置螢幕。依型號而定，可能不支援此功能。', coverage:'partial', unresolved:'目前型號的 PBP 操作仍未確認，不能由多重視窗推論兩者相同。'},
];

function runJourney(spec, index, journeyOptions={}) {
  const ruleLines=fs.readFileSync(path.join(__dirname,'../CLASS_RULES.csv'),'utf8').split(/\r?\n/).filter(Boolean);
  const keywordMap=Object.fromEntries(ruleLines.map(line=>[line.split(',')[0],line]));
  const h=createProductionHarness({quiet:true,now:'2026-09-08T06:00:00Z',properties:{GEMINI_API_KEY:'offline-fixture',keyword_map_v1:JSON.stringify(keywordMap)}}), c=h.context;
  // CacheService TTL is I/O: expire on the fake clock, no clear-state shortcuts.
  const expires=new Map(), cacheApi={
    get:key=>{if(expires.has(key)&&h.run('Date.now()')>=expires.get(key)){h.cache.delete(key);expires.delete(key);}return h.cache.get(key)||null;},
    put:(key,value,seconds=600)=>{h.cache.set(key,value);expires.set(key,h.run('Date.now()')+seconds*1000);},
    remove:key=>{h.cache.delete(key);expires.delete(key);},
    getAll:keys=>Object.fromEntries(keys.map(key=>[key,cacheApi.get(key)])),
    putAll:(values,seconds)=>Object.entries(values).forEach(([key,value])=>cacheApi.put(key,value,seconds)),
    removeAll:keys=>keys.forEach(key=>cacheApi.remove(key)),
  };
  c.CacheService.getScriptCache=()=>cacheApi;c.CacheService.getUserCache=()=>cacheApi;
  h.run('IS_TEST_MODE=true'); c.initializeProviderBudget_(0,c.providerMonthKey_());
  // Simulated immutable Drive storage; the real importer checks each checksum.
  c.ScriptApp.getService=()=>({getUrl:()=> 'https://example.test/dev'});
  const files=new Map(); let serial=0;
  c.Drive={Files:{get:()=>({mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}}),create:(_,blob)=>{const id='offline-'+(++serial);files.set(id,blob);return {id};}}};
  c.DriveApp.getFileById=id=>({getBlob:()=>files.get(id)});
  const token=c.issueTestUiAccessToken_();
  for (const record of pack.records) c.importManualIndexRecordFromTestUi(record,token);
  const unsupported=[], providerEvidence=[];
  h.setFetch((url, options)=>{
    assert(url.startsWith('https://generativelanguage.googleapis.com/'),'unexpected external I/O: '+url);
    const request=JSON.parse(options.payload||'{}');
    if(url.includes(':countTokens')) return response({totalTokens:500});
    let input;
    try {input=JSON.parse(request.contents[0].parts[0].text);} catch (_) {input={};}
    if (Array.isArray(input.evidenceCandidates)) {
      const fixture=fixtures.find(f=>f.question.test(input.question)&&input.evidenceCandidates.some(e=>f.evidence.test(e.officialManualText)));
      const evidence=fixture&&input.evidenceCandidates.find(e=>fixture.evidence.test(e.officialManualText));
      providerEvidence.push({question:input.question,model:input.model,evidenceId:evidence&&evidence.evidenceId,page:evidence&&evidence.pageNumber,fixture:!!fixture,selectedText:evidence&&evidence.officialManualText});
      const result=fixture ? {found:true,coverage:fixture.coverage||'full',unresolvedQuestion:fixture.unresolved||'',evidence:[{evidenceId:evidence.evidenceId,supportedAnswer:fixture.answer}]} : {found:false,coverage:'none',evidence:[]};
      if(fixture && /同步/.test(input.question) && /Core Lighting/.test(evidence.officialManualText) && !/Core Sync/.test(evidence.officialManualText)) {
        result.coverage='partial'; result.unresolvedQuestion='後方燈與畫面同步的設定仍未核實。';
      }
      if(!fixture) {
        const knownInsufficient=(/畫面同步/.test(input.question)&&!input.evidenceCandidates.some(e=>/Core Lighting|Core Sync/.test(e.officialManualText))) ||
          (/再詳細/.test(input.question)&&!input.evidenceCandidates.some(e=>/Self Diagnosis/.test(e.officialManualText)));
        if(!knownInsufficient) unsupported.push('No existing answer fixture: '+input.question);
        providerEvidence.push({fixtureKind:knownInsufficient?'manual-no-relevant-evidence':'unmatched-manual',unmatchedManual:input});
      }
      return response({candidates:[{content:{parts:[{text:JSON.stringify(result)}]}}],usageMetadata:{promptTokenCount:500,candidatesTokenCount:100}});
    }
    if (request.generationConfig&&request.generationConfig.responseSchema&&request.generationConfig.responseSchema.properties.version) {
      assert.equal(request.generationConfig.responseSchema.properties.version.enum[0],'RouteAnalysisV1');
      const followup=Boolean(input.previousTopic&&/^(那|這|它|兩|再|我要跟|可以跟)/.test(input.originalQuestion));
      const result={version:'RouteAnalysisV1',topicRelation:followup?'followup':'new',
        productAction:input.confirmedModel?'keep_confirmed':input.candidates.length?'choose_candidate':'none',candidateIndex:null,
        claims:[{id:'C1',question:followup?input.previousTopic+'；'+input.originalQuestion:input.originalQuestion,
          intent:'operation',evidenceNeed:'manual_model_specific',answerShape:'steps'}],confidence:'high',reasonCode:followup?'elliptical_followup':'partial_local'};
      if(journeyOptions.routerAnalysis) Object.assign(result,journeyOptions.routerAnalysis(input,result));
      providerEvidence.push({fixtureKind:'router-classification-only',input,result});
      return response({candidates:[{content:{parts:[{text:JSON.stringify(result)}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:40}});
    }
    if ((request.tools||[]).some(tool=>tool.google_search)) {
      providerEvidence.push({fixtureKind:'web-empty-grounding',question:request.contents});
      return response({candidates:[{content:{parts:[{text:'目前沒有可核對的公開網頁證據，無法確認這項操作或限制。'}]},groundingMetadata:{groundingChunks:[],groundingSupports:[]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:30}});
    }
    if (/共同輸出規則/.test(JSON.stringify(request.systemInstruction||{})) && !request.tools && !request.generationConfig.responseSchema) {
      const latest=request.contents[request.contents.length-1].parts.map(p=>p.text||'').join('\n');
      if(latest.includes('請只補一次真正有幫助的新資訊')&&latest.includes('切勿關閉電源')&&latest.includes('不要變更輸入來源')) {
        providerEvidence.push({fixtureKind:'elaboration-no-new-product-facts',question:latest});
        return response({candidates:[{content:{parts:[{text:journeyOptions.elaborationAnswer||'測試前，先把目前的工作告一段落。'}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:50}});
      }
      // A valid insufficient-local-evidence response, not a fabricated product
      // answer. The actual source router decides whether/how to continue.
      providerEvidence.push({fixtureKind:'local-insufficient-manual-required',question:request.contents,providedContext:request.systemInstruction});
      return response({candidates:[{content:{parts:[{text:'[AUTO_SEARCH_PDF]'}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:10}});
    }
    // Unknown provider schema remains blocked rather than inventing an answer.
    unsupported.push('Unscripted provider request: '+url.split('?')[0]);
    providerEvidence.push({unmatchedProvider:{modelUrl:url.split('?')[0],schema:request.generationConfig&&request.generationConfig.responseSchema,
      tools:request.tools,content:request.contents,system:request.systemInstruction}});
    return response({candidates:[{content:{parts:[{text:'{}'}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:10}});
  });
  const id='OFFLINE_J'+index, turns=[];
  for(const step of spec.steps) {
    if(step.advance) h.advanceTime(step.advance); // only fake clock; no model/topic setters
    const before=h.logs.length, fetchBefore=h.fetches.length;
    let error='';
    const event={replyToken:'TEST_REPLY_TOKEN',source:{type:'user',userId:id}};
    try {
      if(step.postback) c.handleRichMenuPostback_({...event,type:'postback',postback:{data:step.postback}});
      else c.handleMessage({...event,type:'message',message:{type:'text',text:step.text}});
    } catch(e) {error=e.stack;}
    const newLogs=h.logs.slice(before).map(String);
    if(journeyOptions.observeStep) journeyOptions.observeStep({c,h,id,step,newLogs,fetchBefore});
    turns.push({input:step.text||step.postback,clockAdvanced:step.advance||0,replies:newLogs.filter(x=>x.includes('[Reply Audit]')),model:c.readSourceProductState_(id),canonicalTopic:c.readSourceCanonicalTopic_(id),calls:h.fetches.length-fetchBefore,audit:JSON.parse(JSON.stringify(h.run('currentRequestAudit'))),error,fatal:newLogs.filter(x=>/\[Fatal\]|Error|失敗/.test(x)),evidenceTrace:newLogs.filter(x=>/Manual|Evidence|Grounding|Semantic Router|Canonical/.test(x))});
  }
  let failure='';
  try {
    assert(turns.length>=2);
    assert(turns.every(t=>!t.error && t.replies.length), '每輪須有回覆且無未捕捉例外');
    spec.check(turns,c,id);
  } catch(e) {failure=e.message;}
  const status=unsupported.length?'BLOCKED_FIXTURE':failure?'FAIL':'PASS';
  const result={id:index,name:spec.name,status,failure,unsupported,providerEvidence,turns}; records.push(result);
  if(journeyOptions.writeReport!==false) fs.writeFileSync(path.join(__dirname,'results/v307_20_journeys_offline.json'),JSON.stringify(records,null,2));
  console.log(`${status} J${index} ${spec.name}${failure?' / '+failure:''}`);
  return result;
}
const textOf=t=>t.replies.join('\n');
const has=(t,re)=>assert(re.test(textOf(t)), 'reply missing '+re+': '+textOf(t).slice(0,260));
const model=(t,value)=>assert.strictEqual(t.model&&t.model.model,value,'confirmed model');
const specs=[
 {name:'M7選型接回HDMI再追USB-C',steps:[msg('M7有幾個HDMI？'),msg('#型號:S32FM703UC'),msg('那USB-C能幫筆電充幾瓦？')],check:t=>{has(t[0],/型號|選擇/);has(t[1],/2 個 HDMI/);has(t[2],/65W/);model(t[2],'S32FM703UC');}},
 {name:'G8選型更新率再追G-Sync',steps:[msg('G8更新率多少？'),msg('#型號:S32DG802SC'),msg('支援G-Sync嗎？')],check:t=>{has(t[0],/型號|選擇/);has(t[1],/240/);model(t[2],'S32DG802SC');has(t[2],/G-Sync|G-SYNC|GSync/);}},
 {name:'G932 PBP再加兩邊120Hz限制',steps:[msg('G932如何開啟PBP？'),msg('那兩邊都能120Hz嗎？')],check:t=>{has(t[0],/PIP\/PBP/);model(t[1],'S49DG932SC');assert(/不.*(猜|證據|可靠)|無法|不能|未確認/.test(textOf(t[1])),'新增120Hz限制須有證據或明確不確定');}},
 {name:'M8選型藍牙能力再操作',steps:[msg('M8可以接藍牙喇叭嗎？'),msg('#型號:S32FM803UC'),msg('怎麼連藍牙喇叭？')],check:t=>{model(t[2],'S32FM803UC');has(t[2],/藍牙(喇叭|揚聲器)清單/);}},
 {name:'M8 Wi-Fi再改有線網路',steps:[msg('S32FM803UC Wi-Fi怎麼連？'),msg('改接網路線呢？')],check:t=>{has(t[0],/網路設定|無線/);model(t[1],'S32FM803UC');has(t[1],/網路線|有線|LAN/);}},
 {name:'M8 App切換再問零售模式',steps:[msg('S32FM803UC內建App怎麼切？'),msg('零售模式在哪？')],check:t=>{model(t[1],'S32FM803UC');has(t[1],/零售模式/);}},
 {name:'G9選型後方燈再加畫面同步',steps:[msg('G9後方那圈燈怎麼開？'),msg('#型號:S49DG952SC'),msg('我要跟畫面同步。')],check:t=>{has(t[1],/Core Lighting/);model(t[2],'S49DG952SC');has(t[2],/Core|燈/);has(t[2],/同步/);assert(!/Eclipse/i.test(textOf(t[2])),'不能借Ark');}},
 {name:'M7 HDMI換G9同功能不混款',steps:[msg('S32FM703UC HDMI怎麼切換？'),msg('改成S49DG952SC同功能呢？')],check:t=>{model(t[1],'S49DG952SC');has(t[0],/已連接裝置|訊號源/);has(t[1],/已連接裝置|訊號源|HDMI/);assert(!/S32FM703UC/.test(textOf(t[1])),'不得沿用M7答案');}},
 {name:'G8選型跨日PBP保留身分',steps:[msg('G8更新率多少？'),msg('#型號:S32DG802SC'),{text:'昨天那台怎麼開PBP？',advance:86400000}],check:t=>{model(t[2],'S32DG802SC');has(t[2],/PBP|多重視窗/);assert(!/請.*提供.*型號/.test(textOf(t[2])),'跨日不得遺失確認型號');}},
 {name:'手冊按鈕取消再M7規格',steps:[button('manual'),{postback:'rm_action=cancel_source&v=2'},msg('S32FM703UC有幾個HDMI？')],check:t=>{has(t[1],/已取消/);assert.strictEqual(t[1].calls,0);has(t[2],/2 個 HDMI/);}},
 {name:'DRM無PDF型號手冊轉網路安全終點',steps:[msg('S27D392GAC怎麼自我診斷？'),button('manual'),button('web')],check:t=>{model(t[1],'S27D392GAC');assert(!/第\d+頁/.test(textOf(t[1])),'不得借其他PDF頁碼');has(t[2],/沒有足夠證據|還沒有足夠資料可以確認|無法確認/);has(t[2],/官網|Sam/);assert(t.every(x=>x.audit.webCalls<=1),'每輪不能迴圈Web');assert(!/AUTO_SEARCH|NEED_DOC/.test(textOf(t[2])));}},
 {name:'同款同題同資料版本重按手冊',steps:[msg('G932如何開啟PBP？'),button('manual')],check:t=>{has(t[0],/PIP\/PBP/);assert.strictEqual(t[1].calls,0,'重播不生成');has(t[1],/PIP\/PBP/);}},
 {name:'已證據回答再詳細再重按',steps:[msg('S27H704EAC怎麼自我診斷？'),msg('再詳細一點'),button('manual')],check:t=>{has(t[0],/Self Diagnosis/);has(t[1],/Self Diagnosis|自行診斷|測試/);has(t[1],/工作告一段落/);assert.strictEqual(t[1].audit.pdfCalls,0,'白話展開不應重新查PDF');assert.strictEqual(t[2].calls,0,'同題再次按手冊不生成');model(t[2],'S27H704EAC');}},
 {name:'未知型號兩輪拒猜',steps:[msg('S99ZZ999支援PBP嗎？'),msg('那更新率呢？')],check:t=>{has(t[0],/型號/);assert.strictEqual(t[0].calls,0);assert(!/S32DG802|S49DG952/.test(textOf(t[1])),'不得偷借已知型號');}},
 {name:'H704自我診斷再問切輸入警語',steps:[msg('S27H704EAC怎麼自我診斷？'),msg('那測試時能切換輸入嗎？')],check:t=>{has(t[0],/Support.*Self Diagnosis/);has(t[1],/不要變更輸入來源|不.*切換/);assert.strictEqual(t[1].audit.webCalls,0);}},
 {name:'另款F24護眼再基本規格',steps:[msg('LF24T350FHC護眼模式怎麼開？'),msg('這台更新率多少？')],check:t=>{has(t[0],/Picture.*Eye Saver Mode/);model(t[1],'F24T350FHC');has(t[1],/75/);}},
 {name:'無型號一般FAQ兩款手機不混答',steps:[msg('iPhone 17可以用USB-C接Smart螢幕嗎？'),msg('iPhone Air可以用USB-C接Smart螢幕嗎？')],check:t=>{has(t[0],/4K HDR/);has(t[1],/無法有線顯示/);assert(t.every(x=>x.calls===0));}},
 {name:'插入非產品題後續問',steps:[msg('S32FM703UC有幾個HDMI？'),msg('今天台北天氣如何？'),msg('那USB-C能充幾瓦？')],check:t=>{model(t[2],'S32FM703UC');has(t[2],/65W/);}},
 {name:'無上下文價格再補型號',steps:[msg('多少錢？'),msg('S32FM703UC多少錢？')],check:t=>{assert(!/NT\$\s*\d{3,}/.test(textOf(t[1])),'不得捏造商品售價');has(t[1],/價格|報價|Sam|售價/);}},
 {name:'洗衣機範圍外接取消',steps:[msg('三星洗衣機怎麼用？'),msg('取消')],check:t=>{assert.strictEqual(t[0].calls,0);has(t[1],/已取消/);assert.strictEqual(t[1].calls,0);}},
];
module.exports={runJourney,specs};
if(require.main===module) {
specs.forEach((spec,i)=>{if(!process.env.JOURNEY_IDS || process.env.JOURNEY_IDS.split(',').map(Number).includes(i+1))runJourney(spec,i+1);});
fs.writeFileSync(path.join(__dirname,'results/v307_20_journeys_offline.json'),JSON.stringify(records,null,2));
const counts=Object.fromEntries(['PASS','FAIL','BLOCKED_FIXTURE'].map(k=>[k,records.filter(r=>r.status===k).length]));
if(records.length===20) {
  const reportPath=path.join(__dirname,'results/v307_20_journeys_offline.md');
  const current=fs.readFileSync(reportPath,'utf8');
  const ids=status=>records.filter(r=>r.status===status).map(r=>r.id).join('、')||'無';
  const summary=`最終執行：**20條／${records.reduce((n,r)=>n+r.turns.length,0)}個事件，${counts.PASS}條 PASS、${counts.FAIL}條 FAIL、${counts.BLOCKED_FIXTURE}條 BLOCKED_FIXTURE**，真實供應商0次。通過：${ids('PASS')}；失敗：${ids('FAIL')}；缺fixture：${ids('BLOCKED_FIXTURE')}。程序exit ${counts.FAIL||counts.BLOCKED_FIXTURE?1:0}。PASS僅代表本報告的離線路由及終點斷言，不代表live／手機驗收。${counts.PASS<19?'未達19/20門檻。':'達到本次離線19/20門檻，仍須分列真人證據。'}`;
  fs.writeFileSync(reportPath,current.replace(/最終執行：[^\n]*/,summary));
}
console.log(JSON.stringify({offline:true,realProviderCalls:0,...counts}));
if(counts.FAIL||counts.BLOCKED_FIXTURE) process.exitCode=1;
}
