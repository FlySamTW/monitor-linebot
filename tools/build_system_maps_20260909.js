const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'deliverables','system_maps_20260909');fs.mkdirSync(out,{recursive:true});
const deck=path.join(out,'Samsung_LINE_Bot_功能全貌與技術架構.pptx');
const ops=[],sources=[],geometries=[]; const colors=['1428A0','087D85','45546C'];
function add(slide,type,props){ops.push({command:'add',parent:`/slide[${slide}]`,type,props});}
function box(s,n,t,x,y,w,h,fill='FFFFFF',color='17243B',size=26,bold=false){add(s,'shape',{name:n,text:t,x:x+'cm',y:y+'cm',width:w+'cm',height:h+'cm',fill,line:fill==='none'?'none':'D8E0EB:0.7',font:'Microsoft JhengHei',size:String(size),color,bold:String(bold),valign:'middle',align:'left',margin:'0.3cm'});geometries.push({slide:s,name:n,text:t,x,y,w,h});}
function line(s,n,x,y,w,h,color='8B9AB0',arrow=false){add(s,'connector',{name:n,shape:'straight',x:x+'cm',y:y+'cm',width:w+'cm',height:h+'cm',color,lineWidth:'1.6pt',tailEnd:arrow?'triangle':'none'});}
function source(id,label,file,anchor,section,group){const text=fs.readFileSync(path.join(root,file),'utf8');const i=text.indexOf(anchor);if(i<0)throw Error('Missing source '+anchor);sources.push({id,label,section,group,file,line:text.slice(0,i).split('\n').length,anchor,evidenceType:'current source or verified project record'});}
function slide(title){ops.push({command:'add',parent:'/',type:'slide',props:{layout:'blank',background:'F7F9FC'}});const s=ops.filter(x=>x.type==='slide').length;box(s,'root',title,2,1.4,68,3.2,'none','1428A0',52,true);return s;}
const groups=[
 ['店員問答',[
  ['產品與選購',['查規格、接孔與功能','比較機型與系列差異','辨識系列並引導選型']],
  ['操作與解決問題',['查手冊操作步驟與限制','不足時補查公開網路解答','查看來源與本款官網']],
  ['連續對話',['承接追問與已確認型號','同題跨來源查證、快取重用','補充一次詳細說明']]]],
 ['知識與手冊維護',[
  ['基礎知識',['維護常見問答與規格','整理系列對照與功能術語','記錄問答供後續補強']],
  ['官方手冊',['發現並核實新版官方文件','自動產生完整逐頁索引','失敗保留前一有效版本']],
  ['資料品質',['核對型號與文件適用範圍','保留頁碼、步驟及限制條件','區分可用手冊與參考文件']]]],
 ['管理與費用控管',[
  ['使用管理',['一般／手冊／網搜每日額度','取消、選型不扣進階次數','限制重複送出與來源連點']],
  ['費用透明',['回覆附估算費用與使用模型','達月停止線後保留免費回答','所有生成與重試納入計費']],
  ['維運與驗收',['查詢雲端對話與執行紀錄','使用 TestUI 驗證真實問答','檢查索引更新與版本健康']]]]
];
const anchors=[
 ['linebot.gs','function buildDeterministicExactRuleReply_'],['Developer_Manual.md','系列共通規格'],['linebot.gs','function shouldRunSemanticRouter_'],
 ['linebot.gs','function applyManualEvidenceGuard_'],['linebot.gs','function runManualWebRescue_'],['manual_official_alternatives.gs','function'],
 ['Developer_Manual.md','型號跨日'],['Developer_Manual.md','operationId'],['linebot.gs','MAX_ELABORATE_PER_ANSWER'],
 ['Developer_Manual.md','CLASS_RULES'],['config/manual_lexicon.json','aliases'],['linebot.gs','function updateHistorySheetAndCache'],
 ['linebot.gs','function stageOfficialTwManualCandidate_'],['tools/manual_index_worker.py','build_document'],['manual_index_worker.gs','previous'],
 ['manual_answer_quality.gs','isRegisteredPrintedCoverEvidence_'],['manual_index_runtime.gs','menuPath'],['manual_official_alternatives.gs','referenceIsModelEvidence'],
 ['linebot.gs','SOURCE_DAILY_LIMITS'],['Developer_Manual.md','取消／選型'],['linebot.gs','function beginAdvancedSourceOperation_'],
 ['Developer_Manual.md','約 NT$'],['provider_cost_gateway.gs','90'],['provider_cost_gateway.gs','function providerFetch_'],
 ['Developer_Manual.md','雲端LOG'],['TestUI.html','getCloudHistory'],['maintenance_reliability.gs','library_report']
];
slide('Samsung LINE Bot｜功能全貌');
line(1,'tree-root',36,4.6,0,1.7,colors[0]);line(1,'tree-branches',12.7,6.3,46.6,0,colors[0]);
let item=0;
groups.forEach(([section,gs],c)=>{const x=2+c*23.4,col=colors[c];line(1,`headlink${c}`,x+10.7,6.3,0,1.4,col);box(1,`section${c}`,section,x,7.7,21.4,2.7,col,'FFFFFF',34,true);line(1,`trunk${c}`,x+.65,10.4,0,33.2,col);
gs.forEach(([group,items],g)=>{const y=12+g*11;line(1,`groupbranch${c}${g}`,x+.65,y+1.1,.85,0,col);box(1,`group${c}${g}`,group,x+1.5,y,19.9,2.2,c===0?'E6EBFF':c===1?'E2F2F2':'E8ECF2',col,29,true);
 items.forEach((label,k)=>{const yy=y+3+k*2.35;line(1,`leafbranch${c}${g}${k}`,x+.65,yy+.9,1.65,0,col);const id=`F${String(++item).padStart(2,'0')}`;box(1,id,label,x+2.3,yy,19.1,1.85,'FFFFFF','17243B',25);source(id,label,...anchors[item-1],section,group);});});});
add(1,'notes',{text:'查核2026-09-09。本機v29.6.311、Git aa42454；最近正式驗收為2026-09-08 @1492，非本日重新執行全案驗收。來源對照見function-source-map.json。四層：系統→三大分區→功能群組→末端功能。QA/RULE人工維護；新增手冊需官方來源與適用範圍核實。Windows排程需開機、登入、連網；抽頁本身零LLM，不代表首頁驗證或回答免費。F612官方英文已可用；M9為HTML入口；D392兩款及M703只有外區參考，不代表台灣適用。20條離線與Chrome代表性驗收不等於手機LINE送達驗收。'});
slide('Samsung LINE Bot｜回答邏輯與技術架構');
box(2,'early-exit','任一來源證據足夠即回覆；只有不足才往下查。中欄為共用控制，不是每題都呼叫模型。',2,4.6,68,1.1,'none','45546C',21);
box(2,'line-client','LINE｜店員文字、選型、來源按鍵',2,6,25,3,'1428A0','FFFFFF',28,true);
box(2,'test-client','Chrome TestUI\nHTML／JavaScript；共用路由',30,6,19,3,'45546C','FFFFFF',24,true);
box(2,'worker-schedule','Windows 排程\n每日 09:30＋登入時\n須開機、登入、連網',52,6,18,4.5,'087D85','FFFFFF',25,true);
box(2,'gas-entry','Apps Script V8｜事件入口\n指令、去重、型號及對話狀態\n明確選來源直接執行，不再確認',2,11,25,4,'E6EBFF','17243B',25,true);
box(2,'local','優先：QA／RULE／已驗證片段\n完整命中直接答：不叫守門、不讀 PDF\n一般生成才使用 2.5 Flash-Lite',2,17,25,4,'FFFFFF','17243B',25);
box(2,'manual','必要時：對應型號手冊\n先按題意檢索完整頁索引 → 2.5 Flash-Lite\n無可靠文字時：Files API＋2.5 Flash 備援\n不得混型號、文件修訂或模式限制',2,23,25,5,'FFFFFF','17243B',24);
box(2,'web','僅未解部分：公開網頁補救一次\n2.5 Flash＋Google Search；不附 PDF\n排除三星網頁證據；保留官網連結',2,30,25,4,'FFFFFF','17243B',25);
box(2,'reply','答案完成 → LINE Reply（不 Push）\n必要步驟／限制＋精簡來源＋費用／模型\n無證據不猜；保留已知、給安全下一步',2,36,25,4,'1428A0','FFFFFF',25,true);
box(2,'planner','條件式守門｜Gemini 3.7 Flash\n僅指涉不明、衝突、複合或新限制\n每輪最多一次；只拆主張、選候選\n不回答產品事實、不掛搜尋工具\n精準 QA、系列解析、明確來源跳過\n低信心／格式失敗不重試，安全退回',30,11,19,8,'E6EBFF','17243B',23);
box(2,'cost','生成共同入口｜費用守門\n模型白名單 → 月預留 → 來源扣次\n收到 usage 後結算；重試另算成本\n缺 usage 留保守估算，不能填零\n月 NT$90 停新增付費；免費仍可答\n每日一般10／手冊2／網搜5；補救3',30,21,19,7,'E8ECF2','17243B',23);
box(2,'evidence','證據與完成判定｜程式守門\n核型號、SHA、頁碼、主張與條件\n找到片段 ≠ 足以回答這一題\n部分成立只補未解，不重複整題\n原題＋型號＋證據一起延續\n同題同資料快取；再詳細最多一次',30,30,19,8,'E8ECF2','17243B',23);
box(2,'discovery','GAS 背景維護\n三星官方支援頁／下載\n核角色、適用型號、PDF SHA\n驗證通過才排入待建索引',52,13,18,5,'E2F2F2','17243B',24);
box(2,'worker','Python worker｜requests＋PyMuPDF\n下載核 SHA、抽完整頁文／表格\n產生檢索索引；抽頁不呼叫 LLM\nHMAC 簽章送既有 GAS 入口',52,20,18,5,'FFFFFF','17243B',23);
box(2,'atomic','GAS＋Drive API v3\nPDF／索引不可變存檔、雙 SHA 讀回\n單一版本指標切換；同版重送去重\n失敗保留有效版，不用暫存冒充成功',52,27,18,5,'FFFFFF','17243B',23);
box(2,'boundary','技術取捨\n自建頁級 RAG 優先、整本讀取備援\nGoogle File Search 尚未正式採用\n不加第二個回答模型作每題評審',52,34,18,5,'E2F2F2','17243B',23);
box(2,'sheets','Google Sheets｜共同知識與稽核\nQA／CLASS_RULES／正式 Prompt!C3\n雲端對話、執行 LOG',2,42,22,4.5,'E8ECF2','17243B',23);
box(2,'state','ScriptProperties／Cache／Lock\n持久型號、來源狀態、額度與月預算\n版本指標、快取、防重複與原子預留',27,42,22,4.5,'E8ECF2','17243B',23);
box(2,'drive','Google Drive｜共同文件層\n核實 PDF＋逐頁索引／分片\n供 GAS 檢索、原檔備援與版本回復',52,42,18,4.5,'E2F2F2','17243B',23);
// Main execution flow. Labels occupy the inter-node gaps, never the boxes.
[[9,2],[15,2],[21,2],[28,2],[34,2]].forEach(([y,h],i)=>line(2,'main'+i,14.5,y,0,h,'1428A0',true));
box(2,'flow-in','Webhook HTTPS',15,9.2,11,1.3,'none','45546C',20);
box(2,'flow-pdf','不足才往下查',15,21.2,11,1.3,'none','45546C',20);
box(2,'flow-web','只帶未解主張',15,28.2,11,1.3,'none','45546C',20);
line(2,'test-route-a',28.5,7.5,1.5,0,'45546C');line(2,'test-route-b',28.5,7.5,0,4.5,'45546C');
add(2,'connector',{name:'test-route-c',shape:'straight',x:'27cm',y:'12cm',width:'1.5cm',height:'0cm',color:'45546C',headEnd:'triangle'});
line(2,'entry-planner',27,13,3,0,'1428A0',true);
line(2,'manual-budget',27,25,3,0,'45546C',true);
line(2,'web-evidence',27,32,3,0,'45546C',true);
line(2,'sched-worker-a',50.5,8.5,1.5,0,'087D85');line(2,'sched-worker-b',50.5,8.5,0,14,'087D85');line(2,'sched-worker-c',50.5,22.5,1.5,0,'087D85',true);
add(2,'connector',{name:'discover-worker',shape:'straight',x:'53cm',y:'18cm',width:'0cm',height:'2cm',color:'087D85',headEnd:'triangle'});
box(2,'worker-poll','worker 主動讀取待辦',54,18.3,16,1.4,'none','087D85',19);
line(2,'worker-atomic',61,25,0,2,'087D85',true);
line(2,'atomic-data-a',70,29.5,.7,0,'087D85');line(2,'atomic-data-b',70.7,29.5,0,14,'087D85');
add(2,'connector',{name:'atomic-data-c',shape:'straight',x:'70cm',y:'43.5cm',width:'0.7cm',height:'0cm',color:'087D85',headEnd:'triangle'});
line(2,'reply-sheet',13,40,0,2,'45546C',true);line(2,'evidence-state',38,38,0,4,'45546C',true);
add(2,'notes',{text:'查核2026-09-09；本機v29.6.311／aa42454。模型名稱表示專案配置與既有驗收，不宣稱本日官方價格或模型可用性再查證。左欄是一般未解問題的主要順序；任何來源已完整支持即可直接到Reply，不需走完PDF與Web。使用者明確指定來源可直接走該來源；守門只分析，不自行授權或編答案。中欄為GAS內共用模組，不是另架服務。所有Gemini生成皆經providerFetch_：月預留、來源配額、usage結算；圖中入口箭頭為代表關係，包含Fast、PDF、Web、Router及背景驗證。GAS背景發現由Apps Script trigger啟動；Windows只啟動本機worker，輪詢GAS已核實pending，並非Windows呼叫GAS發現排程。右欄需區分此兩種排程。Google Sheets、Properties、Drive皆被GAS直接讀写；下方為共用資料層，不是新增中介服務。檢索使用BM25＋詞彙對照及段落／表格，Files API為整本備援；File Search曾隔離A/B，未採正式遷移。月90為應用停止線，不保證Google帳單即時封頂。來源與適用範圍缺口詳交付說明。'});
for(const [id,file,anchor] of [['planner','linebot.gs','function shouldRunSemanticRouter_'],['cost','provider_cost_gateway.gs','function providerFetch_'],['manual','manual_index_runtime.gs','function'],['worker','tools/manual_index_worker.py','build_document'],['atomic','manual_index_worker.gs','function'],['state','linebot.gs','PropertiesService'],['reply','linebot.gs','function replyMessage'],['gas-entry','appsscript.json','runtimeVersion']])source('T-'+id,id,file,anchor,'技術架構','回答邏輯與技術');
for(const n of ['early-exit','flow-in','flow-pdf','flow-web','worker-poll'])ops.push({command:'set',path:`/slide[2]/shape[@name=${n}]`,props:{margin:'0.03cm'}});
for(const [id,file,anchor] of [['line-client','linebot.gs','function doPost'],['test-client','TestUI.html','google.script.run'],['sheets','linebot.gs','function updateHistorySheetAndCache'],['discovery','linebot.gs','function stageOfficialTwManualCandidate_'],['boundary','manual_index_runtime.gs','function'],['drive','manual_index_worker.gs','Drive'],['local','linebot.gs','function buildDeterministicExactRuleReply_'],['web','linebot.gs','function runManualWebRescue_']])source('T-'+id,id,file,anchor,'技術架構','服務與資料');
fs.writeFileSync(path.join(out,'build-commands.json'),JSON.stringify(ops,null,2));fs.writeFileSync(path.join(out,'function-source-map.json'),JSON.stringify({reviewedAt:'2026-09-09',basis:'local source v29.6.311 / aa42454; formal verification record 2026-09-08',items:sources},null,2));fs.writeFileSync(path.join(out,'layout-manifest.json'),JSON.stringify(geometries,null,2));
if(process.argv.includes('--metadata-only'))process.exit(0);
function run(args){let r=cp.spawnSync('officecli',args,{encoding:'utf8',shell:false,maxBuffer:16e6});if(r.status!==0)throw Error(r.stdout+r.stderr);return r.stdout;}
if(fs.existsSync(deck))throw Error('Refuse overwrite; use officecli patch for revisions');
run(['create',deck]);run(['set',deck,'/','--prop','slideWidth=72cm','--prop','slideHeight=48cm']);
fs.writeFileSync(path.join(out,'build-result.json'),run(['batch',deck,'--input',path.join(out,'build-commands.json'),'--json']));run(['close',deck]);console.log(deck);
