// Offline integration: the deployed functions and real indexes/QA/RULE are
// loaded intact. Only GAS storage, clock, locks and external HTTP are faked.
const assert = require("assert");
const {createProductionHarness} = require("./production_harness");
const fs = require("fs");
const path = require("path");
const h = createProductionHarness({quiet:true, now:"2026-09-05T08:00:00Z"});
const c = h.context;
let passed = 0;
function test(name, fn) {
  try {fn(); passed++; console.log("PASS " + name);}
  catch(error) {console.error("FAIL " + name + ": " + error.message); process.exitCode = 1;}
}
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "manual_golden_cases.json"))).cases;
for (const item of cases) test("retrieval " + item.id + " / " + item.queries[0], () => {
  const plan = c.findManualPageRagPlan_(item.queries[0], item.model);
  assert(plan && plan.retrievalPolicy === "QueryTimeV1");
  assert(plan.fragments.some(page => item.expectedPages.includes(page.pageNumber)), JSON.stringify(plan.fragments.map(p=>p.pageNumber)));
});
test("陌生型號不借其他文件", () => assert.strictEqual(c.findManualPageRagPlan_("怎麼開雙模", "S99ZZ999"), null));
test("related 名稱不能授權等價完成", () => assert.strictEqual(c.findManualPageRagPlan_("PBP怎麼開", "S32DG802SC").allowRuleBackedAliasCompletion, false));

test("口語背燈召回手冊，完整功能名稱優先於共享單字", () => {
  for (const question of ["後方環形燈怎麼開？", "Core Lighting怎麼開？"]) {
    const plan=c.findManualPageRagPlan_(question,"S49DG952SC");
    assert.strictEqual(plan.fragments[0].pageNumber,115);
    assert.strictEqual(plan.allowRuleBackedAliasCompletion,false);
    assert(!plan.aliases.includes("Core Lighting"),"相關詞不可混進等價名稱");
    const answer=c.hydrateManualPageRagResponse_(JSON.stringify({found:true,coverage:"full",evidence:[{
      evidenceId:plan.fragments[0].evidenceId,
      supportedAnswer:"設定 → 所有設定 → 遊戲 → Core Lighting，可開啟或關閉產品背面的 LED 照明。"
    }]}),plan,question,"");
    assert(answer.includes("第115頁") && !answer.includes("ERROR"),answer);
    assert(answer.includes("依型號而異"),answer);
    assert(!answer.includes("Eclipse"),answer);
  }
});
test("藍牙口語操作＋真實頁面＋真實驗證器", () => {
  const plan = c.findManualPageRagPlan_("藍牙喇叭怎麼連", "S32DG802SC");
  const answer = c.hydrateManualPageRagResponse_(JSON.stringify({found:true,coverage:"full",evidence:[{
    evidenceId:"E1", supportedAnswer:"按左方向鍵，進入設定 → 所有設定 → 音效 → 音效輸出 → 藍牙喇叭清單。"
  }]}), plan, "藍牙喇叭怎麼連", "");
  assert(answer.includes("第150頁") && !answer.includes("ERROR"), answer);
});
test("模型不能偽造evidenceId或頁碼", () => {
  const plan = c.findManualPageRagPlan_("藍牙喇叭怎麼連", "S32DG802SC");
  const answer = c.hydrateManualPageRagResponse_(JSON.stringify({found:true,coverage:"full",evidence:[{
    evidenceId:"E999",pageNumber:150,supportedAnswer:"按左方向鍵，進入設定 → 藍牙喇叭清單。"
  }]}),plan,"藍牙喇叭怎麼連","");
  assert(answer.includes("VALIDATION_ERROR"));
});

test("原題動作不得被相關別名淹沒：安裝不是解除安裝", () => {
  const plan=c.findManualPageRagPlan_("如何安裝 App？","S32FM803UC");
  assert(plan.fragments.some(f=>f.pageNumber===69),JSON.stringify(plan.fragments.map(f=>f.pageNumber)));
});

test("共用手冊操作保留適用限制，不再把整頁有caveat當沒有答案", () => {
  const questions=[
    ["怎麼開啟零售模式？",170,"設定 → 所有設定 → 一般與隱私權 → 使用模式，選擇零售模式。"],
    ["Wi-Fi 要在哪裡連線？",9,"設定 → 所有設定 → 連線 → 網路 → 網路設定 → 無線。"],
    ["怎麼恢復原廠設定？",171,"設定 → 所有設定 → 一般與隱私權 → 出廠資料重設，輸入 PIN。所有設定將會重設。"],
    ["睡眠計時器在哪裡設定？",157,"設定 → 所有設定 → 一般與隱私權 → 省電和節能 → 睡眠計時器。"]
  ];
  for(const [question,page,supportedAnswer] of questions) {
    const plan=c.findManualPageRagPlan_(question,"S32FM803UC");
    const fragment=plan.fragments.find(f=>f.pageNumber===page);
    assert(fragment,question+JSON.stringify(plan.fragments.map(f=>f.pageNumber)));
    const answer=c.hydrateManualPageRagResponse_(JSON.stringify({found:true,coverage:"full",evidence:[{evidenceId:fragment.evidenceId,supportedAnswer}]}),plan,question,"");
    assert(!/VALIDATION_ERROR/.test(answer),question+answer);
    assert(answer.includes("依型號而異"),question+answer);
    assert(!answer.split("手冊重點：")[0].includes("立即嘗試"),question+answer);
  }
});

test("條件操作不能讓其他型號或數值能力過關", () => {
  assert.strictEqual(c.manualEvidenceSupportsTargetModel_({scope:"支援頁綁定",documentBound:true,conditionalProcedure:true,excerpt:"S32HG802SC USB-C：依型號可能不支援。"},"S32HG806ES"),false);
  const plan=c.findManualPageRagPlan_("PBP 兩邊都是120Hz嗎","S32DG802SC");
  assert(plan);
  const answer=c.hydrateManualPageRagResponse_(JSON.stringify({found:true,coverage:"full",evidence:[{evidenceId:"E1",supportedAnswer:"PBP兩邊都是120Hz。"}]}),plan,"PBP 兩邊都是120Hz嗎","");
  assert(/ERROR/.test(answer));
});
test("內部既有規格提示不能污染原題主張", () => {
  const plan = c.findManualPageRagPlan_("藍牙喇叭怎麼連", "S32DG802SC");
  const answer = c.hydrateManualPageRagResponse_(JSON.stringify({found:true,coverage:"full",evidence:[{
    evidenceId:"E1", supportedAnswer:"進入設定 → 所有設定 → 音效 → 音效輸出 → 藍牙喇叭清單。"
  }]}), plan, "藍牙喇叭怎麼連\n[System Hint: 已確認 HDR10+、OLED、HDMI 2，請勿重答。]", "");
  assert(!answer.includes("ERROR"), answer);
});
test("G9不能借Ark Eclipse證據", () => assert.strictEqual(c.manualEvidenceNamedFamilyMatchesTarget_("Odyssey Ark Eclipse Lighting，使用 Ark Dial 開啟", "S49DG952SC"),false));
test("PBP與120Hz分散存在不能推兩側120Hz", () => assert.strictEqual(c.manualSupportedAnswerMatchesExcerpt_("PBP兩邊各120Hz", "PBP：開啟雙畫面。HDMI最高120Hz。", "PBP兩邊都是120Hz嗎"), false));
test("答案同時提錯型號不能用其中一款命中放行", () => assert.strictEqual(c.manualSupportedAnswerTargetsModel_("S32DG802SC 和 S49DG952SC 都可以。", "S32DG802SC"),false));
test("SHA切版後禁止舊頁級索引", () => {
  h.properties.set("OFFICIAL_MANUAL_MANIFEST", JSON.stringify({LS32DG802SCXZW:{fullSku:"LS32DG802SCXZW",sha256:"A".repeat(64)}}));
  assert.strictEqual(c.findManualPageRagPlan_("藍牙喇叭怎麼連", "S32DG802SC"),null);
  h.properties.delete("OFFICIAL_MANUAL_MANIFEST");
});
test("補型號→原題→跨日→新增限制", () => {
  c.rememberSourceProductModel_("JOURNEY", "S32DG802SC", "selected");
  c.rememberSourceCanonicalTopic_("JOURNEY", "PBP怎麼開", "S32DG802SC", []);
  h.advanceTime(3*86400000); h.cache.clear();
  assert.strictEqual(c.readSourceCanonicalTopic_("JOURNEY").canonicalQuestion, "PBP怎麼開");
  c.rememberSourceCanonicalTopic_("JOURNEY", "那兩邊都能120Hz嗎", "S32DG802SC", []);
  const topic = c.readSourceCanonicalTopic_("JOURNEY");
  assert(topic.canonicalQuestion.includes("PBP") && topic.canonicalQuestion.includes("120Hz"));
  assert.strictEqual(c.canReuseSemanticFollowup_("那兩邊都能120Hz嗎", "PBP怎麼開"),false);
  assert.strictEqual(c.canReuseSemanticFollowup_("那怎麼開", "PBP怎麼開"),true);
  c.rememberSourceProductModel_("JOURNEY", "S32FM803UC", "new_model");
  assert.strictEqual(c.readSourceCanonicalTopic_("JOURNEY"),null);
});
test("明確新功能不沿用舊操作", () => assert.strictEqual(c.resolvePersistentFollowupQuestion_("怎麼連藍牙喇叭", "PBP怎麼開"),"怎麼連藍牙喇叭"));
test("操作已答不重貼整份規格", () => assert.strictEqual(c.mergeKnownRuleAnchorWithAdvancedAnswer_("這台支援藍牙。HDR10+。240Hz。", "設定 → 音效 → 藍牙。", {originalQuestion:"藍牙喇叭怎麼連？"}),"設定 → 音效 → 藍牙。"));

test("接孔數量摘要不得抹掉供電或版本規格", () => {
  for (const query of ["USB-C可以幫筆電充幾瓦？", "Type-C供電多少？", "USB-C有幾個和幾瓦？"]) {
    const reply=c.buildDeterministicExactRuleReply_(query,"S32FM703UC");
    assert(/65\s*W/i.test(reply),reply);
  }
  assert(/2 個 HDMI 2.0/.test(c.buildDeterministicExactRuleReply_("HDMI有幾個？","S32FM703UC")));
});

test("只有純換型號句能取代前題，新功能與注入型號不能改寫", () => {
  for (const query of ["那M8呢？", "換成 M8 的話？", "What about M8?"]) {
    assert(c.isShortModelContinuation(query),query);
    assert(c.expandShortModelContinuation(query,"M7有幾個HDMI？").includes("M8有幾個HDMI"),query);
  }
  for (const query of [
    "那usb-c充電有幾瓦 (型號: S32FM703UC)",
    "那USB-C可以幫筆電充幾瓦？ (型號: S32FM703UC)",
    "那M8怎麼連藍牙？", "那M8兩邊可以120Hz嗎？",
    "那M8的USB-C供電呢？", "M8睡眠計時器呢？",
  ]) {
    assert.strictEqual(c.isShortModelContinuation(query),false,query);
    assert.strictEqual(c.expandShortModelContinuation(query,"M7有幾個HDMI？"),query);
  }
});

test("完整手機短句兩輪：大小寫與沒有空格不會改回HDMI", () => {
  const journey=createProductionHarness({quiet:true}), jc=journey.context;
  journey.run("IS_TEST_MODE=true");
  for(const question of ["S32fm703uc有幾個hdmi", "那usb-c充電有幾瓦"]) {
    jc.handleMessage({type:"message",replyToken:"fixture",source:{type:"user",userId:"MOBILE_SHORT"},message:{type:"text",text:question}});
  }
  const replies=journey.logs.filter(x=>x.includes("[Reply Audit]")&&!x.includes("[Reply Audit Guard]"));
  assert.strictEqual(replies.length,2);
  assert(/2 個 HDMI/.test(replies[0]),replies[0]);
  assert(/USB-C 65W/.test(replies[1]),replies[1]);
  assert(!journey.logs.some(x=>x.includes("短追問展開")),journey.logs.join("\n"));
  assert.strictEqual(journey.fetches.length,0);
});

test("Web未解不得用全題無答案收尾否定已有手冊步驟", () => {
  const manual="設定 → 遊戲 → Core Lighting。\n[MANUAL_EVIDENCE_PARTIAL:此型號仍待核對]";
  const reply=c.buildManualWebRescueReply_({coverage:"none",groundingPresent:true,tentativeText:"目前沒有足夠證據可下結論"},manual,"S49DG952SC","後方環形燈怎麼開？");
  assert(reply.includes("Core Lighting") && reply.includes("Sam"),reply);
  assert(!reply.includes("目前沒有足夠證據可下結論"),reply);
  assert(reply.includes("還無法核對到這款"),reply);
});
test("NIT單位不可誤命中Infinity/ViewFinity品牌詞", () => {
  assert(!c.buildDeterministicExactRuleReply_("Infinity Core 是什麼？", "S49DG952SC").includes("亮度"));
  assert(!c.buildDeterministicExactRuleReply_("ViewFinity 是什麼？", "S49DG952SC").includes("亮度"));
  assert(c.buildDeterministicExactRuleReply_("這台多少nits？", "S49DG952SC").includes("250"));
});
test("Web維持螢幕型號與術語領域", () => {
  const query=c.buildCanonicalWebQuery_("Infinity Core阿?", "S49DG952SC");
  assert(query.includes("電腦螢幕") && query.includes("S49DG952SC") && query.includes("lighting"));
});
test("Web使用RULE唯一機型別名，不把系列當完整型號", () => {
  assert.strictEqual(c.matchGroundedModelIdentity_("Samsung G95SD 的設定", "S49DG952SC"), "exact");
  assert.strictEqual(c.matchGroundedModelIdentity_("Samsung Odyssey G9 的設定", "S49DG952SC"), "family");
  assert.notStrictEqual(c.matchGroundedModelIdentity_("Samsung G95SDX 的設定", "S49DG952SC"), "exact");
});
test("術語定義與機型能力分開，不解除操作或限制查證", () => {
  assert(c.isUnscopedRuleTermDefinition_("Infinity Core 是什麼？"));
  assert(c.isUnscopedRuleTermDefinition_("CoreSync是什麼？"));
  assert(!c.isUnscopedRuleTermDefinition_("S49DG952SC 有 Infinity Core 嗎？"));
  assert(!c.isUnscopedRuleTermDefinition_("這台 Infinity Core 怎麼開？"));
  assert(!c.isUnscopedRuleTermDefinition_("PBP 兩邊 120Hz 是什麼意思？"));
  assert.strictEqual(c.getExplicitCapabilityCheck_("Infinity Core 是什麼？"), null);
  assert.strictEqual(c.getAllExplicitCapabilityChecks_("Infinity Core 是什麼？ (型號: S32DG802SC)").length, 0);
  assert.strictEqual(c.buildMissingExactRuleFactReply_("Infinity Core 是什麼？ (型號: S32DG802SC)", "S32DG802SC"), "");
  assert(!c.buildCanonicalWebQuery_("Infinity Core 是什麼？", "S49DG952SC").includes("S49DG952SC"));
  const segments=[{text:"Infinity Core Lighting 是位於螢幕背面的 LED 燈效，用來營造環境光。",sourceIds:["0"],sourceLabels:["fixture.example"]}];
  assert(c.buildGroundedSupportedAnswer_(segments,"S49DG952SC","Infinity Core 是什麼？","",false,true).text.includes("LED"));
  assert.strictEqual(c.buildGroundedSupportedAnswer_(segments,"S49DG952SC","這台 Infinity Core 怎麼開？","",false,true).text, "");
  assert.strictEqual(c.sanitizeTentativeWebActionLine_("沉浸式體驗：Infinity Core Lighting 會自動發出與螢幕內容同步的環境燈光，將遊戲場景延伸到現實空間。"), "");
  assert(!c.buildTentativeWebFallback_("將燈光開啟。", "Infinity Core 是什麼？", "S32DG802SC").includes("三步"));
});
test("同步短鎖lease與每日成功去重", () => {
  const lease=c.acquireManualMaintenanceLease_("integration",true);
  assert(lease); assert.strictEqual(c.acquireManualMaintenanceLease_("integration",true),null);
  c.finishManualMaintenanceLease_(lease,true);
  assert.strictEqual(c.acquireManualMaintenanceLease_("integration",true),null);
  h.advanceTime(86400000); assert(c.acquireManualMaintenanceLease_("integration",true));
});

test("真實歷史讀取：新功能與新限制不可被免費舊片段搶答", () => {
  const cid="REAL_TOPIC_GUARD";
  h.cache.set(h.run("CACHE_KEYS.HISTORY_PREFIX")+cid,JSON.stringify([
    {role:"user",content:"那 App 要怎麼安裝？"},{role:"assistant",content:"從應用程式首頁安裝。"}
  ]));
  assert.strictEqual(c.getPreviousUserTopicForEvidence_(cid,"那睡眠計時器在哪裡設定？"),"");
  assert.strictEqual(c.getPreviousUserTopicForEvidence_(cid,"那兩邊都能120Hz嗎？"),"");
  h.cache.set(h.run("CACHE_KEYS.HISTORY_PREFIX")+cid,JSON.stringify([
    {role:"user",content:"雙畫面怎麼開？"},{role:"assistant",content:"開啟多重視窗。"}
  ]));
  assert.strictEqual(c.getPreviousUserTopicForEvidence_(cid,"那怎麼開？"),"雙畫面怎麼開？");
});

const g=createProductionHarness({quiet:true,now:"2026-09-05T08:00:00Z"}), p=g.context;
const url="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=fixture";
const usage={promptTokenCount:1000,candidatesTokenCount:100,thoughtsTokenCount:50,cachedContentTokenCount:200,totalTokenCount:1150};
const opts={method:"post",payload:JSON.stringify({contents:[{parts:[{text:"fixture"}]}],generationConfig:{maxOutputTokens:1000}})};
const response=(body,code=200)=>({getResponseCode:()=>code,getContentText:()=>JSON.stringify(body)});
test("未初始化預算0付費呼叫",()=>assert.throws(()=>p.providerFetch_(url,opts),/NOT_INITIALIZED/));
test("usage含thinking/cache只結算一次",()=>{
  p.initializeProviderBudget_(5.59,p.providerMonthKey_()); p.resetRequestAudit_();
  g.setFetch(()=>response({usageMetadata:usage}));
  p.providerFetch_(url,opts);
  p.addGenerationUsageToAudit_(usage,999,"models/gemini-2.5-flash-lite");
  const audit=g.run("currentRequestAudit");
  assert(Math.abs(audit.estimatedCostTwd-0.004544)<1e-10,JSON.stringify(audit));
  assert.strictEqual(audit.billableCalls,1);
});
test("來源2次配額、重試成本各算但次數不重扣",()=>{
  const grant={contextId:"QUOTA",source:"manual"};
  const sourceOptions={...opts,sourceGrant:grant};
  p.providerFetch_(url,sourceOptions);p.providerFetch_(url,sourceOptions);
  assert.strictEqual(p.readSourceQuota_("QUOTA").manual,1);
  p.providerFetch_(url,{...opts,sourceGrant:{contextId:"QUOTA",source:"manual"}});
  const before=g.fetches.length;
  assert.throws(()=>p.providerFetch_(url,{...opts,sourceGrant:{contextId:"QUOTA",source:"manual"}}),/QUOTA_EXHAUSTED/);
  assert.strictEqual(g.fetches.length,before);
});
test("缺usage與送出後連線失敗不能零元",()=>{
  p.resetRequestAudit_();g.setFetch(()=>response({error:{code:503}},503));p.providerFetch_(url,opts);
  assert(g.run("currentRequestAudit.uncertainCostTwd")>0);
  assert(p.buildReplyCostAuditText_().includes("待確認") || p.buildReplyCostAuditText_().includes("待"));
  const before=g.run("currentRequestAudit.estimatedCostTwd");
  g.setFetch(()=>{throw Error("transport timeout");});
  assert.throws(()=>p.providerFetch_(url,opts),/timeout/);
  assert(g.run("currentRequestAudit.estimatedCostTwd")>before);
});
test("月90元含在途保留、耗盡0生成且不扣來源",()=>{
  const key=p.providerMonthKey_();g.properties.set(key,JSON.stringify({spent:89.99,reserved:0.009,uncertain:0,requests:0}));
  const count=g.fetches.length;
  assert.throws(()=>p.providerFetch_(url,{...opts,sourceGrant:{contextId:"BUDGET",source:"manual"}}),/BUDGET_EXHAUSTED/);
  assert.strictEqual(g.fetches.length,count);assert.strictEqual(p.readSourceQuota_("BUDGET").manual,0);
});
test("未核准模型零請求",()=>assert.throws(()=>p.providerFetch_(url.replace("2.5-flash-lite","3.8-flash"),opts),/MODEL_NOT_APPROVED/));

test("超過一元的實際API費用不可被商品價格遮罩改寫",()=>{
  p.resetRequestAudit_();
  g.run('currentRequestAudit.estimatedCostTwd=1.2295; currentRequestAudit.uncertainCostTwd=1.189; currentRequestAudit.billableModels=["models/gemini-2.5-flash"]');
  const fee=p.buildReplyCostAuditText_();
  const result=p.sanitizePriceNumbers_("商品 NT$12,900\n"+fee);
  assert(result.includes(fee),result);assert(!result.includes("12,900"),result);
  g.run("CURRENT_REPLY_FOOTER_APPENDED=false");
  const visible=p.renderCustomerFacingText_("商品 NT$12,900\n"+fee);
  assert(visible.includes("NT$1.2295"),visible);
  assert(!visible.includes("12,900"),visible);
});
test("隔離維護拒絕無token與正式exec，零供應商",()=>{
  const before=g.fetches.length;
  assert.throws(()=>p.runReliabilityMaintenanceFromTestUi("repair","invalid"),/未授權/);
  const token=p.issueTestUiAccessToken_();
  assert.throws(()=>p.runReliabilityMaintenanceFromTestUi("repair",token),/編輯者/);
  assert.strictEqual(g.fetches.length,before);
});
test("無Drive新增權限先停止，不花模型費且pending不能標成功",()=>{
  p.Drive={Files:{get:()=>({mimeType:"application/vnd.google-apps.folder",capabilities:{canAddChildren:false}})}};
  const before=g.fetches.length;
  assert.throws(()=>p.adminRepairManualRevisionsV303_(),/MANUAL_FOLDER_WRITE_REQUIRED/);
  assert.throws(()=>p.adminRunFileSearchComparisonV303_(),/MANUAL_FOLDER_WRITE_REQUIRED/);
  assert.strictEqual(g.fetches.length,before);
  assert.strictEqual(p.sanitizeOfficialManualMaintenanceResult_({action:"PROMOTION_PENDING",manualStatus:"PENDING_MANUAL_REVIEW"}).ok,false);
});
test("完整handleMessage三輪：零售→App→睡眠，僅外部供應商替身", () => {
  const journey=createProductionHarness({quiet:true,properties:{GEMINI_API_KEY:"fixture"}});
  const jc=journey.context;
  journey.run("IS_TEST_MODE=true");
  jc.initializeProviderBudget_(0,jc.providerMonthKey_());
  journey.setFetch((target,options)=>{
    const request=JSON.parse(options.payload||"{}");
    let answer;
    if(target.includes("gemini-3.7-flash")) {
      answer={topicRelation:"new",productAction:"keep_confirmed",candidateIndex:0,claims:[{id:"c1",question:"睡眠計時器在哪裡設定？",intent:"operation",evidenceNeed:"manual_model_specific",answerShape:"menu_path"}],confidence:"high",reasonCode:"MODEL_SPECIFIC_OPERATION"};
    } else {
      assert(target.includes("gemini-2.5-flash-lite"),target);
      const input=JSON.parse(request.contents[0].parts[0].text);
      assert(input.question.includes("睡眠計時器"));
      const fragment=input.evidenceCandidates.find(x=>x.pageNumber===157);
      assert(fragment);
      answer={found:true,coverage:"full",evidence:[{evidenceId:fragment.evidenceId,supportedAnswer:"設定 → 所有設定 → 一般與隱私權 → 省電和節能 → 睡眠計時器。"}]};
    }
    return response({candidates:[{content:{parts:[{text:JSON.stringify(answer)}]}}],usageMetadata:{promptTokenCount:1000,candidatesTokenCount:100}});
  });
  for(const question of ["S32FM803UC 怎麼開啟零售模式？","那 App 要怎麼安裝？","那睡眠計時器在哪裡設定？"]) {
    jc.handleMessage({type:"message",replyToken:"fixture",source:{type:"user",userId:"TEST_CHAIN"},message:{type:"text",text:question}});
  }
  const replies=journey.logs.filter(x=>x.includes("[Reply Audit]")&&!x.includes("[Reply Audit Guard]"));
  assert.strictEqual(replies.length,3,JSON.stringify(journey.logs.slice(-10)));
  assert(replies[0].includes("零售模式"));assert(replies[1].includes("應用程式"));
  assert(replies[2].includes("睡眠計時器")&&!replies[2].includes("Netflix"),replies[2]+journey.logs.join("\n"));
  assert(replies[2].includes("157"),replies[2]);
  assert.strictEqual(journey.fetches.filter(x=>x.url.includes("gemini-3.7-flash")).length,0,"已明講睡眠功能的追問不需再問Router");
  assert.strictEqual(journey.fetches.filter(x=>x.url.includes(":generateContent")).length,1,"兩題免費、一題手冊；無多餘Web");
  assert(!journey.logs.some(x=>x.includes("[Fatal]")),journey.logs.join("\n"));
});

test("完整來源入口：G9選型轉手冊退款，額度耗盡仍免費重播", () => {
  const journey=createProductionHarness({quiet:true,properties:{GEMINI_API_KEY:"fixture"}}), jc=journey.context;
  const cid="TEST_G9_REPLAY";
  journey.run("IS_TEST_MODE=true");
  jc.initializeProviderBudget_(0,jc.providerMonthKey_());
  journey.setFetch((target,options)=>{
    assert(target.includes("gemini-2.5-flash-lite"),target);
    const input=JSON.parse(JSON.parse(options.payload).contents[0].parts[0].text);
    const fragment=input.evidenceCandidates.find(x=>x.pageNumber===115);
    assert(fragment);
    return response({candidates:[{content:{parts:[{text:JSON.stringify({found:true,coverage:"full",evidence:[{
      evidenceId:fragment.evidenceId,supportedAnswer:"設定 → 所有設定 → 遊戲 → Core Lighting，可開啟或關閉產品背面的 LED 照明。"
    }]})}]}}],usageMetadata:{promptTokenCount:500,candidatesTokenCount:100}});
  });
  for(const question of ["G9 後方環形燈怎麼開？", "#型號:S49DG952SC"]) {
    jc.handleMessage({type:"message",replyToken:"fixture",source:{type:"user",userId:cid},message:{type:"text",text:question}});
  }
  assert.strictEqual(jc.getDailyQuestionRemaining_(cid),10,"選型只是同一題，轉手冊後退款");
  assert.strictEqual(journey.fetches.filter(x=>x.url.includes(":generateContent")).length,1);
  // Simulate the other daily manual slot already used; do not stub the router.
  const key=jc.getSourceQuotaKey_(cid,jc.getSourceDateKey_());
  const quota=jc.readSourceQuota_(cid);quota.manual=2;
  journey.properties.set(key,JSON.stringify(quota));journey.cache.delete(key);
  const before=journey.fetches.length;
  jc.handleRichMenuPostback_({type:"postback",replyToken:"replay",source:{type:"user",userId:cid},postback:{data:"rm_action=select_source&source=manual&v=1"}});
  assert.strictEqual(journey.fetches.length,before);
  assert.strictEqual(journey.run("LAST_SOURCE_TEST_STATE.cached"),true,journey.logs.slice(-12).join("\n"));
  assert.strictEqual(jc.readSourceQuota_(cid).manual,2);
});

console.log(`Offline assertions passed=${passed}; paid provider calls=0. Not LINE/TestUI acceptance.`);
