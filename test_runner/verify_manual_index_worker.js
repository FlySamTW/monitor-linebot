const assert = require('assert');
const crypto = require('crypto');
const zlib = require('zlib');
const {createProductionHarness} = require('./production_harness');
const h = createProductionHarness({quiet: true});
const c = h.context, secret = 'ab'.repeat(32), files = new Map();
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
let failWrite = false;
c.Utilities.computeHmacSha256Signature = (message, key) => Array.from(crypto.createHmac('sha256', key).update(message).digest());
const driveWrites = [], folderIds = new Map();
c.Drive = {Files: {get: () => ({mimeType: 'application/vnd.google-apps.folder', capabilities: {canAddChildren: true}}),
  create(metadata, blob, options) {
  assert.equal(options.supportsAllDrives, true); assert.equal(options.fields, 'id');
  assert.equal(metadata.parents.length, 1); driveWrites.push({metadata,options});
  if (failWrite) throw new Error('fixture write failure');
  if (metadata.mimeType === 'application/vnd.google-apps.folder') {
    assert.equal(blob, null); const id = 'folder-' + (folderIds.size + 1);
    folderIds.set(metadata.parents[0] + '/' + metadata.name, id); return {id};
  }
  const id = String(files.size + 1), file = {getId: () => id, getBlob: () => blob,
    getName: () => blob.getName(), getSize: () => blob.getBytes().length, getLastUpdated: () => new Date()};
  files.set(id, file); return {id};
}}};
c.DriveApp.getFolderById = parentId => ({getFoldersByName: name => ({
  hasNext: () => folderIds.has(parentId + '/' + name), next: () => ({getId: () => folderIds.get(parentId + '/' + name)})
}), createFolder: () => {throw new Error('DriveApp writes forbidden');}, createFile: () => {throw new Error('DriveApp writes forbidden');}});
c.DriveApp.getFileById = id => { if (!files.has(id)) throw new Error('missing'); return files.get(id); };
h.properties.set('MANUAL_WORKER_SECRET', secret);
const pdf = Buffer.from('%PDF-' + ' '.repeat(12000)), sha = digest(pdf);
const pending = {reason: 'PAGE_INDEX_BUILD_REQUIRED', sourcePdfSha256: sha, finalFileName: 'S32TEST.pdf',
  candidate: {fullSku: 'S32TEST', modelBinding: 'pdf_first_page', exactModelInDocument: true,
    downloadUrl: 'https://downloadcenter.samsung.com/test.pdf', supportUrl: 'https://www.samsung.com/tw/support/model/S32TEST/',
    workerBinding: {schemaVersion: 1, sourcePdfSha256: sha, models: ['S32TEST'], documentRole: 'manual'}}};
h.properties.set('MANUAL_PENDING_S32TEST', JSON.stringify(pending));
h.setFetch(() => ({getResponseCode: () => 200, getBlob: () => c.Utilities.newBlob(Array.from(pdf), 'application/pdf')}));
const indexFixture = {lex: {schemaVersion: 1, N: 1, avgdl: 1, docLength: {'1': 1}, df: {test: 1}, postings: {test: [[1, 1]]}},
  pages: [{pdfPage: 1, pageHash: digest(Buffer.from('test')), normalizedText: 'test', headings: ['Test'],
    blocks: [{id: 'p001b001', text: 'test', normalizedText: 'test', hash: digest(Buffer.from('test'))}]}]};
const content = Buffer.from(JSON.stringify(indexFixture));
const payload = {pendingKey: 'MANUAL_PENDING_S32TEST', sourcePdfSha256: sha, indexChecksum: digest(content),
  gzip: zlib.gzipSync(content).toString('base64'), baseRevision: 'compiled'};
function envelope(action, payload, changes = {}) {
  const e = Object.assign({protocol: 'manual-index-worker-v1', timestamp: c.Date.now(), nonce: crypto.randomBytes(16).toString('hex'),
    action, payload: JSON.stringify(payload)}, changes);
  e.signature = crypto.createHmac('sha256', secret).update([e.protocol, e.timestamp, e.nonce, e.action, e.payload].join('\n')).digest('hex');
  return e;
}
const call = (action, payload) => c.handleManualWorkerRequest_(JSON.stringify(envelope(action, payload)));
let passed = 0;
function test(label, fn) { fn(); passed++; console.log('PASS ' + label); }
test('authenticated list', () => assert.equal(call('list', {}).pending.length, 1));
test('bad signature rejected', () => {
  const e = envelope('list', {}); e.signature = '0'.repeat(64);
  assert.equal(c.handleManualWorkerRequest_(JSON.stringify(e)).error, 'WORKER_AUTH');
});
test('expired request rejected', () => assert.equal(c.handleManualWorkerRequest_(JSON.stringify(envelope('list', {}, {timestamp: c.Date.now() - 300001}))).error, 'WORKER_AUTH'));
test('persistent replay rejected', () => {
  const raw = JSON.stringify(envelope('list', {})); assert.equal(c.handleManualWorkerRequest_(raw).ok, true);
  assert.equal(c.handleManualWorkerRequest_(raw).error, 'WORKER_REPLAY_OR_RATE');
});
test('changed PDF SHA rejected before write', () => {
  assert.equal(call('prepare', {...payload, sourcePdfSha256: '0'.repeat(64)}).error, 'WORKER_PENDING_BINDING'); assert.equal(files.size, 0);
});
test('changed index checksum rejected before write', () => {
  assert.equal(call('prepare', {...payload, indexChecksum: '0'.repeat(64)}).error, 'WORKER_INDEX_CHECKSUM'); assert.equal(files.size, 0);
});
test('missing/new model scope and wrong role fail closed', () => {
  const changed = JSON.parse(JSON.stringify(pending)); changed.candidate.workerBinding.documentRole = 'product_guide';
  h.properties.set('MANUAL_PENDING_S32TEST', JSON.stringify(changed)); assert.equal(call('list', {}).pending.length, 0);
  changed.candidate.workerBinding.documentRole = 'manual'; changed.candidate.workerBinding.models = ['WRONG'];
  h.properties.set('MANUAL_PENDING_S32TEST', JSON.stringify(changed)); assert.equal(call('list', {}).pending.length, 0);
  h.properties.set('MANUAL_PENDING_S32TEST', JSON.stringify(pending));
});
test('failed Drive write leaves prior activation untouched', () => {
  failWrite = true; assert.equal(call('prepare', payload).ok, false); failWrite = false;
  assert.equal(h.properties.has('MANUAL_WORKER_BUNDLE'), false);
});
test('successful PDF/index/bundle readback then atomic activation', () => {
  const result = call('prepare', payload); assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(files.size, 3); const probe = call('probe', {});
  assert.ok(driveWrites.some(w => w.metadata.mimeType === 'application/vnd.google-apps.folder'));
  assert.equal(driveWrites.filter(w => w.metadata.name.endsWith('.pdf')).length, 1);
  assert.equal(probe.ok, true); assert.equal(probe.verified[0].sourcePdfSha256, sha);
  assert.equal(probe.verified[0].indexChecksum, digest(content));
  assert.equal(call('list', {}).pending.length, 0);
});
test('same revision is idempotent despite old base', () => {
  assert.equal(call('prepare', payload).reused, true); assert.equal(files.size, 3);
});
test('stale base cannot overwrite complete revision', () => {
  const before = h.properties.get('MANUAL_WORKER_BUNDLE');
  assert.equal(call('prepare', {...payload, indexChecksum: '1'.repeat(64)}).error, 'WORKER_STALE_BASE');
  assert.equal(h.properties.get('MANUAL_WORKER_BUNDLE'), before);
});
test('bundle contains only scoped override and immutable file IDs', () => {
  const bundle = c.readManualWorkerBundle_(); assert.deepEqual(Object.keys(bundle.documents), ['worker_S32TEST']);
  assert.ok(bundle.active.worker_S32TEST.pdfFileId); assert.ok(bundle.active.worker_S32TEST.indexFileId);
  assert.equal(bundle.documents.worker_S32TEST.pageIndex.data, undefined);
});
test('official changed bytes cannot activate even with signed index', () => {
  const before = h.properties.get('MANUAL_WORKER_BUNDLE');
  const next = JSON.parse(JSON.stringify(pending)); next.sourcePdfSha256 = '2'.repeat(64);
  next.candidate.workerBinding.sourcePdfSha256 = next.sourcePdfSha256;
  h.properties.set('MANUAL_PENDING_S32TEST', JSON.stringify(next));
  assert.equal(call('prepare', {...payload, sourcePdfSha256: next.sourcePdfSha256,
    baseRevision: JSON.parse(before).revision}).error, 'WORKER_PDF_SHA');
  assert.equal(h.properties.get('MANUAL_WORKER_BUNDLE'), before);
  h.properties.set('MANUAL_PENDING_S32TEST', JSON.stringify(pending));
});
test('new SHA atomically replaces complete revision and retains previous pointer', () => {
  const before = JSON.parse(h.properties.get('MANUAL_WORKER_BUNDLE'));
  const nextPdf = Buffer.from('%PDF-' + 'next'.repeat(4000)), nextSha = digest(nextPdf);
  const next = JSON.parse(JSON.stringify(pending)); next.sourcePdfSha256 = nextSha;
  next.candidate.workerBinding.sourcePdfSha256 = nextSha;
  h.properties.set('MANUAL_PENDING_S32TEST', JSON.stringify(next));
  h.setFetch(() => ({getResponseCode: () => 200, getBlob: () => c.Utilities.newBlob(Array.from(nextPdf), 'application/pdf')}));
  const result = call('prepare', {...payload, sourcePdfSha256: nextSha, baseRevision: before.revision});
  assert.equal(result.ok, true); const pointer = JSON.parse(h.properties.get('MANUAL_WORKER_BUNDLE'));
  assert.equal(pointer.previous.revision, before.revision); assert.ok(files.has(before.fileId));
  assert.equal(call('probe', {}).verified[0].sourcePdfSha256, nextSha);
});
test('schema rejects mismatched page count, empty text document and malformed postings', () => {
  [x => {x.lex.N = 2;}, x => {x.pages[0].blocks = [];}, x => {x.pages[0].pageHash = '0'.repeat(64);},
    x => {x.lex.postings.test = [[2, 1]];}].forEach(change => {
      const index = JSON.parse(JSON.stringify(indexFixture)); change(index);
      assert.throws(() => c.validateManualWorkerIndex_(index), /WORKER_INDEX_SCHEMA/);
    });
});
const coldRequest = () => {
  h.run('manualWorkerSnapshot_ = undefined; manualWorkerBundleCache_ = null; manualIndexRequestCache_ = {};');
  h.cache.clear();
};
let integratedKey, integratedSha;
test('activate overlapping compiled model: effective catalog and real retrieval use worker only', () => {
  const model = 'S32CM703UC', source = Buffer.from('%PDF-' + 'integration'.repeat(2000));
  const next = JSON.parse(JSON.stringify(pending)); next.sourcePdfSha256 = digest(source);
  next.finalFileName = model + '.pdf'; next.candidate.fullSku = model;
  next.candidate.workerBinding.models = [model]; next.candidate.workerBinding.sourcePdfSha256 = next.sourcePdfSha256;
  h.properties.set('MANUAL_PENDING_' + model, JSON.stringify(next));
  h.setFetch(() => ({getResponseCode: () => 200, getBlob: () => c.Utilities.newBlob(Array.from(source), 'application/pdf')}));
  const result = call('prepare', {...payload, pendingKey: 'MANUAL_PENDING_' + model,
    sourcePdfSha256: next.sourcePdfSha256, baseRevision: JSON.parse(h.properties.get('MANUAL_WORKER_BUNDLE')).revision});
  assert.equal(result.ok, true); integratedKey = result.docKey; integratedSha = next.sourcePdfSha256;
  coldRequest();
  const docs = c.getEffectiveManualDocuments_();
  assert.deepEqual(Object.keys(docs).filter(k => docs[k].models.includes(model)), [integratedKey]);
  assert.equal(c.hasReadyManualIndexForModel_(model), true);
  const plan = c.findIndexedManualPagePlan_('test', model);
  assert.ok(plan); assert.equal(plan.docKey, integratedKey); assert.equal(plan.sha256, integratedSha);
  assert.equal(plan.fragments[0].evidenceText, 'test');
  const doc = docs[integratedKey], revision = c.readManualRevision_(integratedKey, doc);
  assert.equal(c.loadManualPageIndex_(integratedKey, doc, revision).pages[0].normalizedText, 'test');
});
test('cold request retains immutable worker generation and PDF candidate points at same SHA', () => {
  coldRequest();
  const plan = c.findIndexedManualPagePlan_('test', 'S32CM703UC'); assert.equal(plan.sha256, integratedSha);
  const candidates = c.workerPdfCandidates_(['S32CM703UC']); assert.equal(candidates.length, 1);
  assert.equal(digest(Buffer.from(candidates[0]._driveFile.getBlob().getBytes())), plan.sha256);
  const manifest = c.mergeWorkerManualManifest_({});
  assert.equal(manifest.S32CM703UC.sourcePdfSha256, plan.sha256);
});
test('missing active index never falls back to different compiled source SHA', () => {
  coldRequest();
  const active = c.getEffectiveManualActive_(integratedKey), file = files.get(active.indexFileId);
  files.delete(active.indexFileId); coldRequest();
  assert.equal(c.findIndexedManualPagePlan_('test', 'S32CM703UC'), null);
  assert.equal(c.workerPdfCandidates_(['S32CM703UC']).length, 1);
  files.set(active.indexFileId, file);
});
test('real PDF recovery uses immutable active bytes with same SHA after index loss', () => {
  coldRequest(); h.properties.set('GEMINI_API_KEY', 'fixture-only'); h.run('CONFIG.DRIVE_FOLDER_ID = "fixture-root";');
  h.setFetch(() => ({getResponseCode: () => 503, getContentText: () => 'fixture Files unavailable'}));
  const recovered = c.recoverRelevantPdfUrisFromDrive(['S32CM703UC'], 'S32CM703UC', 1, []);
  assert.equal(recovered.length, 1, JSON.stringify(h.logs.slice(-6)));
  assert.equal(recovered[0].officialSha256.toLowerCase(), integratedSha);
  assert.equal(digest(Buffer.from(recovered[0].inlineDataBase64, 'base64')), integratedSha);
  assert.equal(recovered[0].driveFileId, c.getEffectiveManualActive_(integratedKey).pdfFileId);
});
test('next overlapping-model SHA switches retrieval and PDF together across cold requests', () => {
  const next = JSON.parse(h.properties.get('MANUAL_PENDING_S32CM703UC'));
  const nextPdf = Buffer.from('%PDF-' + 'updated'.repeat(3000)), nextSha = digest(nextPdf);
  next.sourcePdfSha256 = nextSha; next.candidate.workerBinding.sourcePdfSha256 = nextSha;
  h.properties.set('MANUAL_PENDING_S32CM703UC', JSON.stringify(next));
  const nextIndex = JSON.parse(JSON.stringify(indexFixture));
  nextIndex.lex.postings = {updated: [[1, 1]]}; nextIndex.lex.df = {updated: 1};
  nextIndex.pages[0].normalizedText = 'updated'; nextIndex.pages[0].pageHash = digest(Buffer.from('updated'));
  Object.assign(nextIndex.pages[0].blocks[0], {text: 'updated', normalizedText: 'updated', hash: digest(Buffer.from('updated'))});
  const content = Buffer.from(JSON.stringify(nextIndex));
  h.setFetch(() => ({getResponseCode: () => 200, getBlob: () => c.Utilities.newBlob(Array.from(nextPdf), 'application/pdf')}));
  const result = call('prepare', {...payload, pendingKey: 'MANUAL_PENDING_S32CM703UC', sourcePdfSha256: nextSha,
    indexChecksum: digest(content), gzip: zlib.gzipSync(content).toString('base64'), baseRevision: JSON.parse(h.properties.get('MANUAL_WORKER_BUNDLE')).revision});
  assert.equal(result.ok, true);
  coldRequest();
  const plan = c.findIndexedManualPagePlan_('updated', 'S32CM703UC');
  assert.equal(plan.sha256, nextSha); assert.equal(plan.fragments[0].evidenceText, 'updated');
  assert.equal(c.findIndexedManualPagePlan_('test', 'S32CM703UC'), null);
  const candidates = c.workerPdfCandidates_(['S32CM703UC']);
  assert.equal(digest(Buffer.from(candidates[0]._driveFile.getBlob().getBytes())), nextSha);
  integratedSha = nextSha;
});
test('final attachment guard rejects old SHA, old alternate filename and missing SHA', () => {
  coldRequest();
  const active = c.getEffectiveManualActive_(integratedKey);
  const base = {name: 'S32CM703UC.pdf', mimeType: 'application/pdf', uri: 'https://fixture/old', source: 'file_api'};
  [{...base}, {...base, officialSha256: sha}, {...base, name: 'S32CM703UC,S43CM703UC.pdf', officialSha256: sha},
    {...base, driveFileId: active.pdfFileId}].forEach(file => {
      assert.equal(c.enforcePdfAttachmentModelScope_([file], ['S32CM703UC']).length, 0);
    });
  const current = {...base, officialSha256: integratedSha, driveFileId: active.pdfFileId};
  const accepted = c.enforcePdfAttachmentModelScope_([current], ['S32CM703UC']);
  assert.equal(accepted.length, 1);
  const provenance = c.getManualAttachmentProvenance_(accepted, 'S32CM703UC');
  assert.equal(provenance.found, true); assert.equal(provenance.hashMismatch, false); assert.equal(provenance.hashMissing, false);
});
test('missing immutable PDF recovery fails closed without falling back to root old PDF', () => {
  coldRequest(); const active = c.getEffectiveManualActive_(integratedKey), original = files.get(active.pdfFileId);
  files.delete(active.pdfFileId); coldRequest();
  assert.equal(c.recoverRelevantPdfUrisFromDrive(['S32CM703UC'], 'S32CM703UC', 1, []).length, 0);
  files.set(active.pdfFileId, original);
});
test('signed worker health is bounded, durable and exposed separately from activation', () => {
  const before = h.properties.get('MANUAL_WORKER_BUNDLE');
  assert.equal(call('health', {ok: true, completed: 999, failed: -1, secret: 'must-not-store'}).ok, true);
  const health = JSON.parse(h.properties.get('MANUAL_WORKER_HEALTH'));
  assert.equal(health.completed, 20); assert.equal(health.failed, 0); assert.equal(health.secret, undefined);
  assert.equal(h.properties.get('MANUAL_WORKER_BUNDLE'), before);
  coldRequest(); const report = c.readManualLibraryActivationReport_();
  assert.equal(report.workerHealth.ok, true); assert.equal(report.workerHealth.completed, 20);
});
test('unauthorized health cannot spoof successful scheduler status', () => {
  const before = h.properties.get('MANUAL_WORKER_HEALTH'), e = envelope('health', {ok: false, failed: 1});
  e.signature = '0'.repeat(64);
  assert.equal(c.handleManualWorkerRequest_(JSON.stringify(e)).error, 'WORKER_AUTH');
  assert.equal(h.properties.get('MANUAL_WORKER_HEALTH'), before);
  assert.equal(call('health', {ok: false, failed: 1}).ok, true);
  assert.equal(JSON.parse(h.properties.get('MANUAL_WORKER_HEALTH')).ok, false);
});
test('local CLI writes sanitized report and sends health after isolated download failures', () => {
  const script = `import sys,os,json,tempfile\nfrom pathlib import Path\nsys.path.insert(0,'tools')\nimport manual_index_worker as w\nseen=[]\nitems=[{'fullSku':'A','downloadUrl':'https://invalid.test/a','sourcePdfSha256':'0'*64},{'fullSku':'B','downloadUrl':'https://invalid.test/b','sourcePdfSha256':'1'*64}]\ndef io(endpoint,secret,action,payload):\n seen.append((action,payload))\n return {'ok':True,'revision':'compiled','pending':items} if action=='list' else {'ok':True}\nw.request=io\nos.environ['WORKER_FIXTURE_SECRET']='ab'*32\nwith tempfile.TemporaryDirectory() as d:\n report=Path(d)/'last-run.json'\n sys.argv=['worker','--endpoint','https://script.google.com/macros/s/fixture/exec','--secret-env','WORKER_FIXTURE_SECRET','--report',str(report)]\n code=w.main()\n result=json.loads(report.read_text(encoding='utf-8'))\n assert code==1 and len(result['failed'])==2 and result['completed']==[]\n assert seen[-1][0]=='health' and seen[-1][1]['failed']==2\n assert 'abababab' not in report.read_text(encoding='utf-8')\n print('PYTHON_REPORT_PASS')\n`;
  const result = require('child_process').spawnSync('python', ['-c', script.replace('w.request=io', "for item in items: item['pendingKey']='PENDING_'+item['fullSku']\nw.request=io")], {cwd: require('path').resolve(__dirname, '..'), encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr); assert.ok(result.stdout.includes('PYTHON_REPORT_PASS'));
});
test('true library recalls natural spatial phrasing without lighting equivalence or PBP regression', () => {
  const fs = require('fs'), path = require('path'), lib = createProductionHarness({quiet: true}), runtime = lib.context;
  const pack = JSON.parse(fs.readFileSync(path.join(__dirname, '../output/manual_library/editor_import.json'), 'utf8'));
  runtime.ScriptApp.getService = () => ({getUrl: () => 'https://example.test/dev'});
  const token = runtime.issueTestUiAccessToken_(), store = new Map(); let id = 0;
  runtime.Drive = {Files: {get: () => ({mimeType: 'application/vnd.google-apps.folder', capabilities: {canAddChildren: true}}),
    create: (_, blob) => {const key = 'library-' + (++id); store.set(key, blob); return {id: key};}}};
  runtime.DriveApp.getFileById = key => ({getBlob: () => store.get(key)});
  for (const record of pack.records) runtime.importManualIndexRecordFromTestUi(record, token);
  for (const question of ['G9後面的燈怎麼開', '後面燈怎麼開', '背面的燈怎麼開', '後方的環形燈怎麼開', 'G9後方那圈燈怎麼開']) {
    const plan = runtime.findIndexedManualPagePlan_(question, 'S49DG952SC');
    assert.ok(plan && plan.fragments.some(f => f.pageNumber === 115 && /Core Lighting/i.test(f.evidenceText)), question + ': ' + JSON.stringify(plan && plan.fragments.map(f => f.pageNumber)));
    assert.equal(plan.allowRuleBackedAliasCompletion, false);
  }
  const pbp = runtime.findIndexedManualPagePlan_('PBP要怎麼開啟', 'S49DG932SC');
  assert.ok(pbp.fragments.some(f => /PIP\/PBP Mode/.test(f.menuPath)));
  assert.equal(pbp.groupId.includes('rear_lighting'), false);
  const diagnosis = runtime.findIndexedManualPagePlan_('怎麼做自我診斷', 'S27H704EAC');
  assert.ok(diagnosis.fragments.some(f => f.pageNumber === 41 && f.evidenceText.includes('不要變更輸入來源')));
  assert.equal(runtime.normalizeManualRetrievalQuery_('兩邊都能120Hz嗎'), '兩邊都能120hz嗎');
  assert.equal(runtime.normalizeManualRetrievalQuery_('前面那個按鈕'), '前方按鈕');
  assert.equal(lib.fetches.length, 0);
});
test('more than twenty failed candidates rotate so later entries are not starved', () => {
  const script = `import sys\nfrom pathlib import Path\nsys.path.insert(0,'tools')\nimport manual_index_worker as w\nitems=[{'pendingKey':'PENDING_'+str(i),'fullSku':'MODEL_'+str(i),'downloadUrl':'https://invalid.test/manual','sourcePdfSha256':'0'*64} for i in range(25)]\ndef io(endpoint,secret,action,payload):\n return {'ok':True,'revision':'compiled','pending':items} if action=='list' else {'ok':True}\nw.request=io\nfirst=w.run('fixture','fixture',Path('config/manual_lexicon.json'))\nassert len(first['failed'])==20 and first['lastAttempted']=='PENDING_19'\nsecond=w.run('fixture','fixture',Path('config/manual_lexicon.json'),first['lastAttempted'])\nassert second['failed'][0]['model']=='MODEL_20'\nassert {x['model'] for x in first['failed']+second['failed']}=={x['fullSku'] for x in items}\nprint('ROTATION_PASS')\n`;
  const result = require('child_process').spawnSync('python', ['-c', script], {cwd: require('path').resolve(__dirname, '..'), encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr); assert.ok(result.stdout.includes('ROTATION_PASS'));
});
test('real ZIP decoding rejects wrong entry, traversal, duplicate and expansion bombs on both workers', () => {
  const script = `import sys,io,zipfile,base64,json,tempfile,hashlib\nfrom pathlib import Path\nsys.path.insert(0,'tools')\nimport manual_index_worker as w\npdf=b'%PDF-'+bytes(range(256))*60\ndef make(names,data=pdf):\n b=io.BytesIO()\n with zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED) as z:\n  for name in names: z.writestr(name,data)\n return b.getvalue()\nfixtures={'good':make(['folder/manual.pdf']),'traversal':make(['../bad.pdf','folder/manual.pdf']),'duplicate':make(['folder/manual.pdf','folder/manual.pdf']),'bomb':make(['folder/manual.pdf'],b'%PDF-'+b' '*200000)}\nwith tempfile.TemporaryDirectory() as d:\n for key,data in fixtures.items():\n  src=Path(d)/'source.zip';src.write_bytes(data)\n  try:\n   w.extract_zip_pdf(src,Path(d)/'out.pdf','folder/manual.pdf',hashlib.sha256(pdf).hexdigest())\n   assert key=='good'\n  except RuntimeError:\n   assert key!='good'\n src.write_bytes(fixtures['good'])\n try: w.extract_zip_pdf(src,Path(d)/'out.pdf','wrong.pdf',hashlib.sha256(pdf).hexdigest());raise AssertionError('accepted wrong entry')\n except RuntimeError: pass\nprint(json.dumps({k:base64.b64encode(v).decode() for k,v in fixtures.items()}))`;
  const result = require('child_process').spawnSync('python', ['-c', script], {cwd: require('path').resolve(__dirname, '..'), encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  const fixtures = JSON.parse(result.stdout), good = Buffer.from(fixtures.good, 'base64');
  assert.equal(Buffer.from(c.extractManualWorkerZipPdf_(Array.from(good), 'folder/manual.pdf', digest(good))).length, 15365);
  assert.throws(() => c.extractManualWorkerZipPdf_(Array.from(good), 'wrong.pdf', digest(good)), /WORKER_ZIP_ENTRY/);
  assert.throws(() => c.extractManualWorkerZipPdf_(Array.from(good), 'folder/manual.pdf', '0'.repeat(64)), /WORKER_ARCHIVE_SHA/);
  for (const key of ['traversal','duplicate','bomb']) {
    const bytes = Buffer.from(fixtures[key], 'base64');
    assert.throws(() => c.extractManualWorkerZipPdf_(Array.from(bytes), 'folder/manual.pdf', digest(bytes)), /WORKER_ZIP_/);
  }
});
test('reviewed registered EU ZIP atomically replaces old manifest using actual F612 PDF and index', () => {
  const fs = require('fs'), path = require('path'), key = 'S61F_F612_EN_PRINTED_FAMILY_241113';
  c.ScriptApp.getService = () => ({getUrl: () => 'https://example.test/dev'});
  const token = c.issueTestUiAccessToken_();
  assert.throws(() => c.queueReviewedRegisteredManualFromTestUi(key, 'invalid'));
  assert.throws(() => c.queueReviewedRegisteredManualFromTestUi('not_registered', token), /WORKER_REVIEWED_REGISTRATION/);
  const registration = c.reviewedManualWorkerRegistration_(key);
  h.properties.set('OFFICIAL_MANUAL_MANIFEST', JSON.stringify({S27F612EAC:{fullSku:'S27F612EAC',sourcePdfSha256:'d'.repeat(64)}}));
  const oldManifest = h.properties.get('OFFICIAL_MANUAL_MANIFEST');
  assert.equal(c.readManualRevision_(key, c.getEffectiveManualDocuments_()[key]), null);
  assert.equal(c.queueReviewedRegisteredManualFromTestUi(key, token).ok, true);
  let state = call('list', {}), item = state.pending.find(p => p.reviewedDocKey === key);
  assert.ok(item, JSON.stringify(state));
  const originalPending = h.properties.get(item.pendingKey), changed = JSON.parse(originalPending);
  changed.candidate.downloadUrl += '?tampered'; h.properties.set(item.pendingKey, JSON.stringify(changed));
  assert.equal(call('list', {}).pending.some(p => p.reviewedDocKey === key), false);
  h.properties.set(item.pendingKey, originalPending);
  const pack = JSON.parse(fs.readFileSync(path.join(__dirname, '../output/manual_library/editor_import.json'), 'utf8'));
  const record = pack.records.find(r => r.docKeys.includes(key));
  const bytes = fs.readFileSync(path.join(__dirname, '../三星螢幕使用手冊/verified/7f45f96c4bd8834d/S27F612.pdf'));
  assert.equal(digest(bytes), registration.sourcePdfSha256);
  const input = {pendingKey:item.pendingKey,sourcePdfSha256:item.sourcePdfSha256,indexChecksum:record.sha256,gzip:record.data,
    baseRevision:state.revision,pdfData:bytes.toString('base64')};
  assert.equal(call('prepare', {...input,indexChecksum:'0'.repeat(64)}).error, 'WORKER_REGISTERED_INDEX_CHECKSUM');
  assert.equal(call('prepare', {...input,pdfData:Buffer.alloc(8*1024*1024+1).toString('base64')}).ok, false);
  h.setFetch(() => {throw new Error('reviewed ZIP must not fetch 60MB archive in GAS');});
  const result = call('prepare', input); assert.equal(result.ok, true, JSON.stringify(result));
  coldRequest();
  const effective = c.getEffectiveManualDocuments_(), workerKey = Object.keys(effective).find(k => k.startsWith('worker_') && effective[k].models.includes('S27F612EAC'));
  assert.ok(workerKey); assert.equal(effective[workerKey].sourcePdfSha256, registration.sourcePdfSha256);
  assert.equal(effective[workerKey].sourceRegion, 'EU');
  assert.equal(h.properties.get('OFFICIAL_MANUAL_MANIFEST'), oldManifest);
  assert.equal(call('probe', {docKey:workerKey}).ok, true);
  assert.equal(call('list', {}).pending.some(p => p.reviewedDocKey === key), false);
});
test('reviewed Python package is pinned to approved index despite current lexicon changes', () => {
  const script = `import sys,hashlib\nsys.path.insert(0,'tools')\nimport manual_index_worker as w\nsha='1de245a1c37998a06a77160b381946333177dbfebeff7d867687ca79de7f7b4f'\nassert hashlib.sha256(w.reviewed_index_content(sha)).hexdigest()==sha\ntry: w.reviewed_index_content('0'*64);raise AssertionError('unregistered accepted')\nexcept RuntimeError as e: assert str(e)=='WORKER_REGISTERED_INDEX_MISSING'\nprint('PINNED_INDEX_PASS')`;
  const result = require('child_process').spawnSync('python', ['-c', script], {cwd: require('path').resolve(__dirname, '..'), encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr); assert.ok(result.stdout.includes('PINNED_INDEX_PASS'));
});
console.log(JSON.stringify({passed, providerCalls: 0}));
