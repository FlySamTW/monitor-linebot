const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {createProductionHarness}=require('./production_harness');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'linebot.gs'),'utf8');
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name);}
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const h=createProductionHarness({quiet:true,now:'2026-10-01T00:00:00Z',properties:{GEMINI_API_KEY:'fixture',OPENROUTER_API_KEY:'fixture'}}),c=h.context;
c.initializeProviderBudget_(0,c.providerMonthKey_());
const body=(value,status=200)=>({getResponseCode:()=>status,getContentText:()=>JSON.stringify(value)});
const url='https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';
const options={geminiApiKey:'fixture',providerPurpose:'fast',method:'post',payload:JSON.stringify({contents:[{parts:[{text:'資料'}]}],generationConfig:{maxOutputTokens:40}})};
test('沒有用途的生成在送出前阻擋',()=>{const n=h.fetches.length;assert.throws(()=>c.providerFetch_(url,{...options,providerPurpose:''}),/PURPOSE/);assert.equal(h.fetches.length,n);});
test('QA 維護不能共用高價模型',()=>assert.throws(()=>c.providerFetch_(url.replace('3.1-flash-lite','3.7-flash'),{...options,providerPurpose:'qa_merge'}),/ROLE_MODEL/));
test('JEV null cost 保留估算而非零',()=>{c.resetRequestAudit_();h.setFetch(()=>body({answers:{},usage:{input_tokens:1000,cost:null}}));c.providerFetch_('https://openrouter.ai/api/alpha/decisions',{providerPurpose:'qa_candidate',openRouterApiKey:'fixture',method:'post',payload:JSON.stringify({model:'typesafe/jev-1.13',state:{question:'test'},questions:{}})});const r=h.run('currentRequestAudit.providerReceipts[0]');assert(r.costTwd>0);assert.notEqual(r.status,'reported');});
test('搜尋缺 metadata 不能歸零',()=>{const r=c.settleProviderSearch_('gemini-3.1-flash-lite',{});assert.equal(r.queryCount,null);assert(r.costTwd>0&&r.unknown);});
test('一次生成多個 query 分項計費',()=>{const r=c.settleProviderSearch_('gemini-3.1-flash-lite',{webSearchQueries:['q1','q2']});assert.equal(r.queryCount,2);assert(Math.abs(r.costTwd-.896)<1e-9);});
test('同題重試共用預算，不可取得另一份全額',()=>{c.resetRequestAudit_();h.setFetch(()=>{throw Error('timeout')});for(let i=0;i<5;i++)assert.throws(()=>c.providerFetch_(url,options),/timeout/);const n=h.fetches.length;assert.throws(()=>c.providerFetch_(url,options),/TURN_BUDGET/);assert.equal(h.fetches.length,n);assert(h.run('currentRequestAudit.uncertainCostTwd')>0);});
function candidate(model){return {fullSku:model,supportUrl:'https://www.samsung.com/tw/support/model/'+model+'/',downloadUrl:'https://org.downloadcenter.samsung.com/downloadfile/ContentsFile.aspx?ModelName='+model+'&CDSite=UNI_TW&CDCttType=UM&VPath=UM%2Ftest.pdf'};}
const pdfSha='a'.repeat(64),model1='LS27H704EACXZW',model2='LS32H704EACXZW',cover='SAMSUNG USER MANUAL S27H704EAC S32H704EAC Please read this user manual before using the monitor.';
function inspection(model,hash=pdfSha,text=cover){return {inspectionKey:'MANUAL_INSPECT_'+model,sourcePdfSha256:hash,firstPageText:text,sourcePages:[1],derivedSha256:sha(text)};}
test('首頁本機文字核驗與同 SHA 跨 SKU 共用，零模型',()=>{const n=h.fetches.length;c.queueManualIdentityInspection_(candidate(model1),pdfSha);assert(c.inspectManualWorkerCover_(inspection(model1)).ok);c.queueManualIdentityInspection_(candidate(model2),pdfSha);assert(c.inspectManualWorkerCover_(inspection(model2)).reused);assert.equal(h.fetches.length,n);assert.equal(c.readManualJson_('MANUAL_INSPECT_'+model1).stage,'sku_verified');assert.equal(c.readManualJson_('MANUAL_INSPECT_'+model2).stage,'sku_verified');});
test('同 SHA 的錯 SKU 獨立阻擋，不借其他型號',()=>{const model='LS27FG532ECXZW';c.queueManualIdentityInspection_(candidate(model),pdfSha);assert.equal(c.readManualJson_('MANUAL_INSPECT_'+model).stage,'blocked');});
test('整本 PDF／錯誤來源頁數不得進首頁辨識',()=>{const hash='b'.repeat(64);c.queueManualIdentityInspection_(candidate(model1),hash);const n=h.fetches.length;assert.throws(()=>c.inspectManualWorkerCover_({...inspection(model1,hash),sourcePages:[1,2]}),/FIRST_PAGE_ONLY/);assert.equal(h.fetches.length,n);});
test('已抽取收據不因後段索引失敗遺失',()=>{const result=c.readManualJson_(c.manualIdentityKey_(pdfSha));assert(result.result&&result.sourcePages[0]===1);assert(!result.paidAttempt);});
test('暫時抽取錯誤三次、跨排程重試後停止',()=>{const hash='c'.repeat(64);c.queueManualIdentityInspection_(candidate(model1),hash);for(let i=0;i<3;i++){c.failManualWorkerInspection_(inspection(model1,hash));if(i<2)h.advanceTime(86400000);}assert.equal(c.readManualJson_('MANUAL_INSPECT_'+model1).stage,'blocked');assert(!c.listManualIdentityInspections_().some(j=>j.sourcePdfSha256===hash));});
test('未知付費嘗試收據不可被刪除後重送',()=>{const hash='d'.repeat(64);c.queueManualIdentityInspection_(candidate(model1),hash);c.saveManualJson_(c.manualIdentityKey_(hash),{paidAttempt:true});const n=h.fetches.length;assert.throws(()=>c.inspectManualWorkerCover_(inspection(model1,hash)),/BLOCKED/);assert(c.readManualJson_(c.manualIdentityKey_(hash)).paidAttempt);assert.equal(h.fetches.length,n);});
const evidence=[{id:'QA:x',kind:'qa',text:'這個型號不支援藍牙。HDMI：2 個。'}];
test('答案不能從型號借數字',()=>assert.throws(()=>c.validateLocalEvidenceDecision_({complete:true,answers:[{text:'有32個HDMI',evidenceIds:['QA:x'],quotes:[{id:'QA:x',quote:'HDMI：2 個。'}]}],remainingQuestions:[]},evidence,'HDMI幾個','S32FM703UC'),/VALIDATION/));
test('引用否定資料，不輸出模型反向改寫',()=>{const r=c.validateLocalEvidenceDecision_({complete:true,answers:[{text:'支援藍牙',evidenceIds:['QA:x'],quotes:[{id:'QA:x',quote:'這個型號不支援藍牙。'}]}],remainingQuestions:[]},evidence,'支援藍牙嗎','S32FM703UC');assert(r.answer.includes('不支援'));});
test('同 SHA 新政策不能沿用舊抽取收據',()=>assert(c.manualIdentityKey_(pdfSha).includes('pymupdf-page1-v1_cover-v324-1')));
test('格式失敗不能聲稱已搜尋或呼叫 Web',()=>{const answer=c.applyManualEvidenceGuard_('[MANUAL_OUTPUT_FORMAT_ERROR]','怎麼操作');assert(!/補查|AUTO_SEARCH_WEB/.test(answer));assert(source.includes('!executionFailure && (manualEvidenceNotFound || manualEvidencePartial || recommendedWeb)'));});
test('首次核驗只排程，不包含整本生成與貴模型',()=>{const section=source.slice(source.indexOf('function validateOfficialManualFirstPage_'),source.indexOf('function stageOfficialTwManualCandidate_'));assert(!/generateContent|250000|GEMINI_MODEL_THINK/.test(section));});
test('個案覆寫與空答重送保持移除',()=>{assert(!/PDF Mode Retry v29.6.123|Fake.Source.*6K/.test(source));assert(!/第四台|6K|8K/.test(fs.readFileSync(path.join(root,'local_evidence_gate.gs'),'utf8')));});
test('語意判讀缺欄位不能升下一付費來源',()=>{for(const bad of [{},{complete:false,answers:'bad',remainingQuestions:[]},{complete:false,answers:[],remainingQuestions:'bad'}])assert.throws(()=>c.validateLocalEvidenceDecision_(bad,evidence,'問題',''),/LOCAL_OUTPUT_INVALID/);});
test('一般回答服務與格式失敗為終止狀態',()=>{for(const marker of ['[PROVIDER_FAILED]','[MANUAL_OUTPUT_FORMAT_ERROR]','[MANUAL_EVIDENCE_VALIDATION_ERROR]'])assert(c.isApiFailureReply(marker));assert(!/AUTO_SEARCH_WEB/.test(c.applyManualEvidenceGuard_('不完整手冊回答','問題')));});
test('付費嘗試包含持久狀態與輸出上限',()=>{const receipts=Object.entries(c.PropertiesService.getScriptProperties().getProperties()).filter(([k])=>k.startsWith('PROVIDER_ATTEMPT_')).map(([,v])=>JSON.parse(v));assert(receipts.length>0);assert(receipts.every(r=>r.stage==='settled'&&Number.isFinite(r.outputLimit)));assert(receipts.some(r=>r.status==='unknown'&&r.sent));});
test('語意候選包含已存手冊，暖快取也不能漏掉',()=>{for(let i=0;i<2;i++){const list=c.collectLocalAnswerEvidence_('S32FM803UC 要拿去店頭長時間展示，怎樣開展示用的模式？','S32FM803UC');assert(list.some(e=>e.id==='QA:manual-s32fm70x80x-retail-mode'));}});
test('一般系列問題不能借某個型號的 QA',()=>{const list=c.collectLocalAnswerEvidence_('Smart Monitor 能不能用手機直立顯示？','');assert(list.every(e=>!(e.scope&&e.scope.models&&e.scope.models.length)));});
test('引用驗證重新檢查型號適用範圍',()=>assert.throws(()=>c.validateLocalEvidenceDecision_({complete:true,answers:[{text:'支援',evidenceIds:['QA:s'],quotes:[{id:'QA:s',quote:'支援'}]}],remainingQuestions:[]},[{id:'QA:s',text:'支援',scope:{models:['S27H704EAC']}}],'支援嗎','S32FM703UC'),/VALIDATION/));
test('引用來源由證據種類決定，規格不能誤標活動',()=>{
  const kinds=[['RULE:model','product_facts','官方規格庫'],['RULE:campaign','campaign','官方活動庫'],['PREVIOUS_MANUAL:x','verified_manual','官方手冊']];
  for(const [id,kind,label] of kinds){
    const r=c.validateLocalEvidenceDecision_({complete:true,answers:[{text:'既有證據',evidenceIds:[id],quotes:[{id,quote:'既有證據'}]}],remainingQuestions:[]},[{id,kind,text:'既有證據'}],'一般問題','');
    assert.deepEqual(Array.from(r.sourceTags),['[來源:'+label+']']);
  }
  assert.equal(c.normalizeAllowedSourceTag_('RULE',''),'[來源:官方規格庫]');
});
test('上一題手冊證據只在型號、程式與來源版本有效時共用',()=>{
  const contextId='v324-proof-reuse',model='S27H704EAC';
  c.rememberSourceProductModel_(contextId,model,'fixture');
  c.finishAdvancedSourceOperation_({key:'proof-reuse',source:'manual',contextId,canonicalQuery:'操作條件'},'操作期間不得切換。\n[來源:官方手冊]',model);
  assert(c.readReusableLocalManualEvidence_(contextId,model));
  assert.equal(c.readReusableLocalManualEvidence_(contextId,'S32FM703UC'),null);
  const original=c.readSourceProductState_(contextId);
  for(const patch of [{codeVersion:'old'},{sourceFingerprint:'old'},{expiresAt:1},{finalText:'一般規格\n[來源:官方規格庫]'}]){
    const state=JSON.parse(JSON.stringify(original));Object.assign(state.advancedBySource.manual,patch);c.persistSourceProductState_(contextId,state);
    assert.equal(c.readReusableLocalManualEvidence_(contextId,model),null);
  }
});
test('部分引文失敗仍保存已驗證內容，不能整包丟棄',()=>{
  let error;try{c.validateLocalEvidenceDecision_({complete:false,answers:[{text:'HDMI：2 個。',evidenceIds:['QA:x'],quotes:[{id:'QA:x',quote:'HDMI：2 個。'}]},{text:'其他內容',evidenceIds:['QA:x'],quotes:[{id:'QA:x',quote:'不存在的引文'}]}],remainingQuestions:['其他問題']},evidence,'兩個子題','');}catch(e){error=e;}
  assert(error&&error.partialResult);assert.equal(error.partialResult.answer,'HDMI：2 個。');assert.equal(error.partialResult.complete,false);
});
test('語意輸出只選既有片段 ID，原文由程式回填',()=>{
  const schema=c.localEvidenceResponseSchema_(evidence);assert.deepEqual(Array.from(schema.required),['complete','answers','remainingQuestions']);
  assert.deepEqual(Array.from(schema.properties.answers.items.properties.excerptIds.items.enum),['Q0']);
  const excerpts=c.localEvidenceExcerpts_(evidence);
  const output=c.hydrateLocalEvidenceSelections_({complete:true,answers:[{excerptIds:['Q0']}],remainingQuestions:[]},excerpts);
  assert.equal(output.answers[0].quotes[0].quote,evidence[0].text);
  assert.throws(()=>c.hydrateLocalEvidenceSelections_({answers:[{excerptIds:['invented']}]},excerpts),/EXCERPT_ID/);
});

test('型號表示法在候選驗證邊界統一，但不同型號仍拒絕',()=>{
  const e=[{id:'QA:scoped',kind:'qa',scope:{models:['F24T350FHC']},text:'F24T350FHC 的操作說明。'}];
  const output={complete:true,answers:[{text:e[0].text,evidenceIds:['QA:scoped'],quotes:[{id:'QA:scoped',quote:e[0].text}]}],remainingQuestions:[]};
  assert(c.validateLocalEvidenceDecision_(output,e,'操作說明','LF24T350FHC').complete);
  assert.throws(()=>c.validateLocalEvidenceDecision_(output,e,'操作說明','S27H704EAC'),/VALIDATION/);
});

test('無候選仍可判讀問題範圍，schema 不產生空 enum 或允許編造片段',()=>{
  const schema=c.localEvidenceResponseSchema_([],true);
  assert.equal(schema.properties.answers.maxItems,0);
  assert(!schema.properties.answers.items.properties.excerptIds.items.enum);
  assert(schema.required.includes('questionScope'));
  assert.deepEqual(Array.from(schema.properties.questionScope.enum),['general','model_specific','non_product']);
});

test('通論由語意判讀決定範圍：不問型號、不讀 PDF、不先生成無證據 Fast',()=>{
  const {runJourney}=require('./verify_20_journeys_v307');
  for(const question of ['USB-C 連接埠的瓦數，是代表每台筆電都會得到同樣功率嗎？','畫面分割與把視窗排在桌面上，是同一種功能嗎？']) {
    const result=runJourney({name:'通論範圍與來源',steps:[{text:question}],check(turns){
      const t=turns[0];assert.equal(t.audit.pdfCalls,0);assert.equal(t.audit.webCalls,1);
      assert(!/不同型號的按鍵和選單位置/.test(t.replies.join('\n')));
      assert.equal(t.audit.paidCalls,2,'只有候選判讀與一次Web，不加無證據Fast');
    }},'GENERAL',{writeReport:false,singleTurn:true,localEvidenceResponse:(state,result)=>({...result,questionScope:'general'})});
    assert.equal(result.status,'PASS',result.failure);
  }
});

test('個別產品缺型號只澄清，語意格式失敗不能當資料缺口送 Web',()=>{
  const {runJourney}=require('./verify_20_journeys_v307');
  for(const scope of ['model_specific',null]){
    const result=runJourney({name:'範圍澄清與失敗隔離',steps:[{text:'我的螢幕應該從哪個選單開啟這個模式？'}],check(turns){
      const t=turns[0];assert.equal(t.audit.pdfCalls,0);assert.equal(t.audit.webCalls,0);
      assert.equal(t.audit.paidCalls,1,'格式無效時不得自動增加付費修復或升來源');
      assert((scope?/完整型號/:/資料判讀暫時無法完成/).test(t.replies.join('\n')));
    }},'SCOPE',{writeReport:false,singleTurn:true,localEvidenceResponse:(state,result)=>({...result,questionScope:scope})});
    assert.equal(result.status,'PASS',result.failure);
  }
});
test('無型號通論的有來源條件句保留為部分證據',()=>{
  const text='日常清潔通常可先使用乾燥軟布，先關閉設備電源。';
  const result=c.buildGroundedSupportedAnswer_([{text,sourceIds:['chunk:0'],sourceLabels:['example.org']}],'','清潔時應注意什麼？',text,true,true);
  assert.equal(result.coverage,'partial');assert(result.text.includes('乾燥軟布'));assert.equal(result.sources[0],'example.org');
});
test('PDF 驗證失敗提示及已確認手冊內容不能被清理器刪掉',()=>{
  for(const marker of ['[MANUAL_EVIDENCE_VALIDATION_ERROR]','[MANUAL_OUTPUT_FORMAT_ERROR]']) {
    const answer=c.applyManualEvidenceGuard_(marker,'一般操作');
    assert.equal(c.sanitizeManualDeflection(answer,'一般操作'),answer);
    assert(!c.ensurePdfSourceTag(answer,[{name:'official.pdf'}]).includes('[來源:官方手冊]'));
  }
  assert.equal(c.ensurePdfSourceTag('',[{name:'official.pdf'}]),'');
  assert.equal(c.sanitizeManualDeflection('官方手冊已確認這項操作的條件。','操作條件'),'官方手冊已確認這項操作的條件。');
});
test('整條手冊旅程：模型宣稱 full 但證據全被拒絕，不得空答或成功',()=>{
  const {runJourney}=require('./verify_20_journeys_v307');
  const result=runJourney({name:'PDF 全部證據被拒絕',steps:[{text:'S27H704EAC怎麼自我診斷？'},{postback:'rm_action=select_source&source=manual&v=2'}],check(turns){
    for(const t of turns){
      const reply=t.replies.join('\n');assert(/沒有通過驗證/.test(reply),reply);
      assert(!/資料來源：三星官方手冊|\[來源:官方手冊\]/.test(reply));
      assert.notEqual(t.audit.finalCoverage,'supported');assert.equal(t.audit.webCalls,0);
    }
  }},'REJECTED',{writeReport:false,manualProviderResponse:(input,result)=>({...result,found:true,coverage:'full',evidence:[{evidenceId:'nonexistent',supportedAnswer:'這段不屬於任何已提供證據。'}]})});
  assert.equal(result.status,'PASS',result.failure);assert(result.turns[0].audit.pdfCalls>0);
});
test('手冊費按實際用量、快取與思考換算新台幣，不因模型同名記成一般回答',()=>{
  const p=createProductionHarness({quiet:true,now:'2026-10-01T00:00:00Z',properties:{GEMINI_API_KEY:'fixture'}}),ctx=p.context;
  ctx.initializeProviderBudget_(0,ctx.providerMonthKey_());ctx.resetRequestAudit_();
  p.setFetch(()=>body({candidates:[{content:{parts:[{text:'{}'}]}}],usageMetadata:{promptTokenCount:2000,cachedContentTokenCount:250,candidatesTokenCount:100,thoughtsTokenCount:200}}));
  ctx.providerFetch_(url,{...options,providerPurpose:'pdf',budgetInputTokens:2000,payload:JSON.stringify({contents:[{parts:[{text:'手冊原文'}]}],generationConfig:{maxOutputTokens:400}})});
  const receipt=p.run('currentRequestAudit.providerReceipts[0]');
  const expected=(1750*.25+250*.025+300*1.5)/1e6*32;
  assert(Math.abs(receipt.costTwd-expected)<1e-10);assert.equal(receipt.purpose,'pdf');assert.equal(receipt.inputKind,'text');
  assert.equal(p.run('currentRequestAudit.pdfCalls'),1);assert.equal(p.run('currentRequestAudit.routerCalls'),0);
  assert.equal(receipt.status,'estimated');
});
test('術語可引用說明和限制，不把內部索引欄位當答案',()=>{
  const e=[{id:'RULE:def',kind:'definition',text:'術語_測試,這是通用說明；canonical=Example；aliases=例子；definition_only=true；不代表每台產品具備此功能。'}];
  const excerpts=c.localEvidenceExcerpts_(e);
  assert.deepEqual(Array.from(excerpts,x=>x.text),['這是通用說明','不代表每台產品具備此功能。']);
  for(const excerpt of excerpts)assert(c.localEvidenceContains_(e[0].text,excerpt.text));
  assert(excerpts.every(x=>x.subject==='例子'));
  const hydrated=c.hydrateLocalEvidenceSelections_({complete:true,answers:[{excerptIds:excerpts.map(x=>x.id)}],remainingQuestions:[]},excerpts);
  const answer=c.validateLocalEvidenceDecision_(hydrated,e,'一般概念','').answer;
  assert.equal(answer,'例子：這是通用說明；不代表每台產品具備此功能。');
});
test('通論比較候選保留概念身分並召回相關模式，不只軟體描述',()=>{
  const e=c.collectLocalAnswerEvidence_('畫面分割與把視窗排在桌面上，是同一種功能嗎？','');
  assert(e.some(x=>c.localEvidenceSubject_(x)==='PBP'));
  assert(e.some(x=>c.localEvidenceSubject_(x)==='Easy Setting Box'));
});
test('搜尋次數採官方 metadata 或實際工具 trace，缺兩者仍未知',()=>{
  const traced={candidates:[{content:{parts:[{toolCall:{toolType:'GOOGLE_SEARCH_WEB',args:{queries:['q1','q2']}}}]}}]};
  assert.deepEqual(Array.from(c.providerSearchMetadata_(traced).webSearchQueries),['q1','q2']);
  traced.candidates[0].groundingMetadata={webSearchQueries:['authoritative']};
  assert.deepEqual(Array.from(c.providerSearchMetadata_(traced).webSearchQueries),['authoritative']);
  assert.equal(c.providerSearchMetadata_({candidates:[{content:{parts:[{toolCall:{toolType:'OTHER',args:{queries:['q']}}}]}}]}),null);
  assert(c.settleProviderSearch_('gemini-3.1-flash-lite',c.providerSearchMetadata_({})).unknown);
});
test('工具 trace 在前、最終文字在後仍保留有來源答案，不洩漏思考文字',()=>{
  const {runJourney}=require('./verify_20_journeys_v307');
  const answer='一般清潔可以先關閉電源，再使用乾燥柔軟的布輕拭表面。';
  const result=runJourney({name:'多段工具搜尋回覆',steps:[{text:'一般螢幕清潔時應注意什麼？'}],check(turns){
    const t=turns[0];assert(t.replies.join('\n').includes('乾燥柔軟'));assert(!t.replies.join('\n').includes('PRIVATE_THOUGHT'));
    assert.equal(t.audit.webCalls,1);assert.equal(t.audit.pdfCalls,0);
    const receipt=t.audit.providerReceipts.find(r=>r.purpose==='web');
    assert.equal(receipt.queryCount,1);assert.equal(receipt.responseId,'fixture-response-123');assert.equal(receipt.usage.inputTokens,100);
  }},'WEB_PARTS',{writeReport:false,singleTurn:true,localEvidenceResponse:(state,result)=>({...result,questionScope:'general'}),webProviderResponse:request=>{
    assert.equal(request.toolConfig.includeServerSideToolInvocations,true);
    return {responseId:'fixture-response-123',candidates:[{finishReason:'STOP',content:{parts:[
      {toolCall:{toolType:'GOOGLE_SEARCH_WEB',args:{queries:['螢幕清潔注意事項']}}},
      {text:'PRIVATE_THOUGHT',thought:true},{text:answer}
    ]},groundingMetadata:{webSearchQueries:['螢幕清潔注意事項'],groundingChunks:[{web:{uri:'https://example.org/cleaning',title:'example.org'}}],groundingSupports:[{segment:{text:answer},groundingChunkIndices:[0]}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:30}};
  }});
  assert.equal(result.status,'PASS',result.failure);
});
console.log(JSON.stringify({passed,providerCalls:0,note:'Only provider I/O fixtures; no real provider requests.'}));
