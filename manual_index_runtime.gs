/** Query-time page retrieval. No provider call and no product facts invented here. */
let manualIndexRequestCache_ = {};

function findManualPrintedTableParent_(page, pageMap) {
  for (let distance = 0; distance <= 3; distance++) {
    const candidate = pageMap[page.pdfPage - distance];
    if (!candidate) return null;
    const blocks = candidate.blocks || [];
    if (distance > 0 && blocks.some(function (block) { return block.layoutSection; })) return null;
    const header = blocks.findIndex(function (block) { return /第[23](?:第[23])?說明/.test(block.text.replace(/\s+/g, "")); });
    if (header < 0) return null;
    const prefix = blocks.slice(0, header);
    const heading = prefix.map(function (block) { return block.text.trim(); }).reverse().find(function (text) {
      return /^[A-Za-z][A-Za-z /+().-]{1,50}$/.test(text);
    });
    if (heading) return { heading: heading, pageNumber: candidate.pdfPage, text: prefix.map(function (block) { return block.text; }).join("\n") };
  }
  return null;
}

function hasReadyManualIndexForModel_(model) {
  if(typeof MANUAL_PAGE_RAG_DATA_ === "undefined") return false;
  const docs=getEffectiveManualDocuments_();
  const keys=Object.keys(docs).filter(function(key) { return docs[key].models.some(function(m) { return manualEvidenceModelMatchesTarget_(m,model); }); });
  if(keys.length!==1) return false;
  try {
    const key=keys[0], revision=readManualRevision_(key,docs[key]);
    if(!revision) return false;
    const active=getEffectiveManualActive_(key);
    return Boolean(active && active.sha256===revision.sha256 && active.indexChecksum===revision.indexChecksum && active.indexFileId);
  } catch(error) { return false; }
}

function readManualLibraryActivationReport_() {
  const docs=getEffectiveManualDocuments_(), props=PropertiesService.getScriptProperties().getProperties();
  const manifest=readOfficialManualManifest_();
  const active=[],missing=[];
  Object.keys(docs).forEach(function(key) {
    const revision=readManualRevision_(key,docs[key],manifest);
    const stored=getEffectiveManualActive_(key,props);
    if(revision && stored && stored.sha256===revision.sha256 && stored.indexChecksum===revision.indexChecksum && stored.indexFileId) active.push(key);
    else missing.push(key);
  });
  return {version:GAS_VERSION,registered:Object.keys(docs).length,active:active.length,missing:missing,
    models:[...new Set(active.reduce(function(all,key) {return all.concat(docs[key].models);},[]))].length,
    uniqueIndexes:[...new Set(active.map(function(key) {return docs[key].pageIndex.sha256;}))].length,
    pendingIndexRevisions:readPendingManualIndexBuilds_(),
    workerHealth:JSON.parse(props.MANUAL_WORKER_HEALTH||'null'),
    officialDocumentGaps:typeof OFFICIAL_MANUAL_ALTERNATIVES_==='undefined'?{}:Object.keys(OFFICIAL_MANUAL_ALTERNATIVES_).reduce(function(report,model){
      report[model]=Object.assign({},OFFICIAL_MANUAL_ALTERNATIVES_[model],{pageIndexReady:active.some(function(key){return docs[key].models.some(function(m){return normalizeModelForDisplay(m)===normalizeModelForDisplay(model);});})});
      return report;
    },{}),
    providerCalls:0,budget:JSON.parse(props[providerMonthKey_()]||"null")};
}

function readReadyManualIndexModels_() {
  if (typeof MANUAL_PAGE_RAG_DATA_ === "undefined") return [];
  const docs = getEffectiveManualDocuments_();
  const properties = PropertiesService.getScriptProperties().getProperties();
  const manifest = readOfficialManualManifest_();
  return [...new Set(Object.keys(docs).reduce(function (models, key) {
    let active;
    active = getEffectiveManualActive_(key,properties);
    const revision = readManualRevision_(key, docs[key], manifest);
    return revision && active && active.sha256 === revision.sha256 &&
      active.indexChecksum === revision.indexChecksum && active.indexFileId ? models.concat(docs[key].models) : models;
  }, []))];
}

function manualIndexTerms_(text) {
  const normalized = manualPageRagNormalizeText_(text)
    .replace(/[slc]?\d{2,3}[a-z]{1,3}\d{2,4}[a-z]*/gi, " ")
    .replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, "$1");
  const stop = /^(怎麼|如何|可以|我要|哪裡|在哪|設定|使用|產品|功能|顯示|螢幕|選擇|進行|支援|依型|的是|的是它|它的|我說|能不能|請問)$/;
  const terms = (normalized.match(/[a-z0-9]+(?:[.][a-z0-9]+)?/g) || [])
    .filter(function (term) { return term.length >= 2; });
  (normalized.match(/[\u3400-\u9fff]+/g) || []).forEach(function (run) {
    [2, 3].forEach(function (size) {
      for (let i = 0; i + size <= run.length; i++) {
        const term = run.slice(i, i + size);
        if (!stop.test(term)) terms.push(term);
      }
    });
  });
  return [...new Set(terms)];
}

function canReuseSemanticFollowup_(question, previousTopic) {
  // Reuse requires the same requested action, not merely the same product.
  const questionText = String(question || "").trim();
  const scopeRestatement = questionText.replace(/^(?:那|它|這台|這款|所以)\s*/, "")
    .replace(/[呢嗎啊呀?？!！。\s]+$/g, "").replace(/兩邊/g, "兩側");
  // A pure restatement of an already planned scope introduces no new claim.
  // New values/features do not satisfy this containment check.
  if (scopeRestatement.length >= 2 && scopeRestatement.length <= 12 &&
      String(previousTopic || "").replace(/兩邊/g, "兩側").includes(scopeRestatement) &&
      /^(?:那|它|這台|這款|所以)/.test(questionText)) return true;
  if (!previousTopic || /\d|多少|幾個|兩邊|同時|限制|支援|相容|能否|能不能|可以嗎|有沒有|改成|不是|我說|另外|但是/i.test(questionText)) {
    return false;
  }
  if (!isManualActionPathQuestion_(questionText) ||
      !isManualActionPathQuestion_(previousTopic)) return false;
  // Only an actually elliptical restatement can reuse the prior plan. A named
  // new feature must undergo normal free-evidence / conditional routing.
  return /^(?:那|它|這個|這台|所以|請問|要|該|我)?\s*(?:要|該)?\s*(?:怎麼|如何|在哪裡?|哪裡)(?:開啟|開|操作|設定|切換|調整|用|使用)?[呢嗎啊呀?？!！。\s]*$/.test(questionText);
}

function resolvePersistentFollowupQuestion_(question, previousQuestion) {
  if (!previousQuestion || !isEllipticalEvidenceFollowUp_(question)) return question;
  if (canReuseSemanticFollowup_(question, previousQuestion)) return previousQuestion;
  const checks = getManualFeatureChecks_(question);
  // Naming a different feature is a new question; an added limit or pronoun
  // without a new feature must keep BOTH the established topic and new claim.
  if (checks.some(function (check) { return check.evidence && !check.evidence.test(previousQuestion); })) return question;
  return `${previousQuestion}；追問：${question}`;
}

function manualIndexDigest_(bytes) {
  return bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)).toLowerCase();
}

function readManualRevision_(docKey, document, manifestSnapshot) {
  const sourceSha = String(document.sourcePdfSha256 || "").toLowerCase();
  const index = document.pageIndex;
  if (!index || index.schemaVersion !== 2 || index.revision !== sourceSha ||
      !/^[a-f0-9]{64}$/.test(sourceSha)) return null;
  const workerVerified = isWorkerManualRevision_(docKey,document);
  const manifest = workerVerified ? {} : (manifestSnapshot || readOfficialManualManifest_());
  const applicable = Object.keys(manifest).map(function (sku) {
    return Object.assign({ fullSku: sku }, manifest[sku]);
  }).filter(function (entry) {
    return (document.models || []).some(function (model) {
      return normalizeModelForDisplay(entry.fullSku) === normalizeModelForDisplay(model);
    });
  });
  // Never answer from a stale compiled revision after official activation.
  if (applicable.some(function (entry) {
    const sha = String(entry.sourcePdfSha256 || entry.sha256 || "").toLowerCase();
    return sha && sha !== sourceSha;
  })) {
    writeLog(`[Manual Revision] ${docKey} page_index_stale; using current PDF path`);
    return null;
  }
  return { docKey: docKey, sha256: sourceSha, indexChecksum: index.sha256,
    models: document.models.slice(), documentRole: document.documentRole,
    supportUrl: document.supportUrl || "", pageIndexReady: true,
    indexStorage: "compiled_verified", revisionVerified: true };
}

function loadManualPageIndex_(docKey, document, revision) {
  const key = `${docKey}:${revision.indexChecksum}`;
  if (manualIndexRequestCache_[key]) return manualIndexRequestCache_[key];
  let compressed = compiledManualIndexData_(document);
  try {
    const active = getEffectiveManualActive_(docKey);
    if (active && active.sha256 === revision.sha256 &&
        active.indexChecksum === revision.indexChecksum && active.indexFileId) {
      const cache = CacheService.getScriptCache();
      const cacheKey = `MANUAL_INDEX_${revision.indexChecksum}`;
      const count = Number(cache.get(cacheKey) || 0);
      let pieces = [];
      for (let n = 0; n < count; n++) pieces.push(cache.get(`${cacheKey}_${n}`));
      if (!count || pieces.some(function (value) { return !value; })) {
        const bytes = DriveApp.getFileById(active.indexFileId).getBlob().getBytes();
        compressed = Utilities.base64Encode(bytes);
        pieces = compressed.match(/.{1,60000}/g) || [];
        pieces.forEach(function (value, n) { cache.put(`${cacheKey}_${n}`, value, 600); });
        cache.put(cacheKey, String(pieces.length), 600);
      } else compressed = pieces.join("");
      revision.indexStorage = "drive";
    }
  } catch (error) {
    writeLog(`[Manual Index] Drive read unavailable; using same verified compiled revision: ${docKey}`);
  }
  const unpacked = Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(compressed), "application/gzip", "pages.json.gz"));
  if (manualIndexDigest_(unpacked.getBytes()) !== revision.indexChecksum) {
    throw new Error("MANUAL_INDEX_CHECKSUM_MISMATCH");
  }
  const index = JSON.parse(unpacked.getDataAsString("UTF-8"));
  manualIndexRequestCache_[key] = index;
  return index;
}

function compiledManualIndexData_(document) {
  const index = document.pageIndex || {};
  if (index.data) return index.data;
  const owner = (MANUAL_PAGE_RAG_DATA_.documents || {})[index.dataRef];
  if (owner && owner.pageIndex && owner.pageIndex.sha256 === index.sha256 &&
      owner.sourcePdfSha256 === document.sourcePdfSha256) return owner.pageIndex.data;
  return null;
}

function manualRuleRetrievalPhrases_(question) {
  // Reuse the maintained RULE terminology dictionary across all documents.
  // Retrieval expansion is not a model-capability or equivalence assertion.
  const terms=loadRuleTermOntology_();
  const strict=findRuleTermOntologyMatches_(question);
  let keys=strict.map(function(term) { return term.canonical; });
  if (!keys.length) {
    const runs=String(question||"").match(/[\u3400-\u9fff]+/g)||[];
    const grams=[];
    runs.forEach(function(run) { for(let n=4;n<=8;n++) for(let i=0;i+n<=run.length;i++) grams.push(run.slice(i,i+n)); });
    const partial=terms.filter(function(term) {
      return term.aliases.some(function(alias) { return grams.some(function(gram) { return alias.includes(gram); }); });
    });
    // Ambiguous abbreviated terminology is left to normal safe routing.
    if(partial.length===1) keys=[partial[0].canonical];
  }
  return [...new Set(terms.filter(function(term) { return keys.includes(term.canonical); })
    .reduce(function(all,term) { return all.concat(term.aliases); },[]))].slice(0,24);
}

function normalizeManualRetrievalQuery_(question) {
  // Retrieval-only grammatical variants: do not rewrite the canonical question
  // or equate two different feature names. Existing curated aliases still decide
  // which evidence to recall; model/scope/numeric guards stay unchanged.
  return manualPageRagNormalizeText_(question)
    .replace(/([前後左右上下])(?:面|側|方)\s*(?:的\s*)?/g, "$1方")
    .replace(/(背面|背後|機背|底部|頂部|中央)\s*的\s*/g, "$1")
    .replace(/([前後左右上下]方|背面|背後|機背|底部|頂部|中央)\s*[這那](?:一)?[個圈條排顆片塊]\s*(?=[\u3400-\u9fff])/g, "$1");
}

function findIndexedManualPagePlan_(question, targetModel) {
  const catalog = Object.assign({}, MANUAL_PAGE_RAG_DATA_, {documents:getEffectiveManualDocuments_()});
  const model = normalizeManualEvidenceModel_(targetModel);
  const matches = Object.keys(catalog.documents || {}).filter(function (key) {
    return catalog.documents[key].models.some(function (candidate) {
      return manualEvidenceModelMatchesTarget_(candidate, model);
    });
  });
  if (matches.length !== 1) return null;
  const docKey = matches[0];
  const document = catalog.documents[docKey];
  const revision = readManualRevision_(docKey, document);
  if (!revision) return null;
  let index;
  try { index = loadManualPageIndex_(docKey, document, revision); }
  catch (error) { writeLog(`[Manual Index] ${error.message}`); return null; }
  const query = normalizeManualRetrievalQuery_(question);
  const weights = {};
  manualIndexTerms_(query).forEach(function (term) { weights[term] = 1; });
  const groups = ((catalog.lexicon || {}).groups || []).filter(function (group) {
    if ((group.excludeAny || []).some(function (term) { return manualPageRagPhraseMatches_(query, term); })) return false;
    return (group.aliases || []).concat(group.triggers || [], group.relatedTerms || []).some(function (term) {
      return manualPageRagPhraseMatches_(query, term);
    });
  });
  const aliases = [];
  const retrievalPhrases = [];
  const relatedPhrases = [];
  manualRuleRetrievalPhrases_(question).forEach(function(phrase) {
    retrievalPhrases.push(phrase);
    relatedPhrases.push(phrase);
    manualIndexTerms_(phrase).forEach(function(term) { weights[term]=Math.max(weights[term]||0,2); });
  });
  groups.forEach(function (group) {
    relatedPhrases.push.apply(relatedPhrases, group.relatedTerms || []);
    (group.aliases || []).concat(group.relatedTerms || []).forEach(function (alias) {
      retrievalPhrases.push(alias);
      // Related names retrieve candidates only; never issue an equivalence grant.
      if ((group.aliases || []).includes(alias)) aliases.push(alias);
      const direct = manualPageRagPhraseMatches_(query, alias);
      weights[manualPageRagNormalizeText_(alias)] = direct ? 4 : 2;
      manualIndexTerms_(alias).forEach(function (term) { weights[term] = Math.max(weights[term] || 0, direct ? 2 : 1); });
    });
  });
  const scores = {};
  const lex = index.lex;
  Object.keys(weights).forEach(function (term) {
    const postings = lex.postings[term] || [];
    const df = Number(lex.df[term] || postings.length);
    if (!df) return;
    const idf = Math.log(1 + (lex.N - df + 0.5) / (df + 0.5));
    postings.forEach(function (posting) {
      const page = posting[0], tf = posting[1];
      const dl = lex.docLength[String(page)] || 1;
      const score = idf * (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * dl / Math.max(lex.avgdl, 1)));
      scores[page] = (scores[page] || 0) + score * weights[term];
    });
  });
  const pageMap = {};
  index.pages.forEach(function (page) { pageMap[page.pdfPage] = page; });
  Object.keys(scores).forEach(function (number) {
    const page = pageMap[number];
    const title = ((page || {}).headings || [])[0] || "";
    const pageText = manualPageRagNormalizeText_((page || {}).normalizedText || "");
    let phraseBonus = 0;
    retrievalPhrases.forEach(function (phrase) {
      // A full technical name must outrank a shared word in another heading.
      if (manualPageRagPhraseMatches_(pageText, phrase)) {
        const compoundName = /^[a-z]+(?:\s+[a-z]+)+$/i.test(phrase.trim());
        const bonus = compoundName && manualPageRagPhraseMatches_(query, phrase)
          ? 80 : relatedPhrases.includes(phrase) ? 30 : 0;
        phraseBonus = Math.max(phraseBonus, bonus);
      }
    });
    scores[number] += phraseBonus;
    if (aliases.some(function (alias) { return manualPageRagPhraseMatches_(manualPageRagNormalizeText_(title), alias); })) {
      scores[number] += 30;
    }
    // Preserve the requested action (install vs remove, connect vs play).
    // Expanded aliases help recall but cannot outrank every original title hit.
    const titleTerms = manualIndexTerms_(title);
    manualIndexTerms_(query).forEach(function (term) {
      if (titleTerms.includes(term)) scores[number] += 20;
    });
  });
  const ranked = Object.keys(scores).map(Number).sort(function (a, b) { return scores[b] - scores[a] || a - b; });
  const fragments = [];
  for (let i = 0; i < ranked.length && fragments.length < 5; i++) {
    const page = pageMap[ranked[i]];
    if (!page) continue;
    const heading = (page.headings || [])[0] || "";
    const blocks = page.blocks || [];
    if (!manualEvidenceNamedFamilyMatchesTarget_(heading, model)) continue;
    // An explicit exception for another family must not erase the surrounding
    // common procedure, nor become evidence for the current model.
    const scopedBlocks = blocks.filter(function (block) {
      return manualEvidenceNamedFamilyMatchesTarget_(block.text, model);
    });
    const sectionMap = {};
    scopedBlocks.forEach(function (block) {
      if (!block.layoutSection) return;
      const section = sectionMap[block.layoutSection.id] || { heading: block.layoutSection.heading || "", blocks: [] };
      section.blocks.push(block.text);
      sectionMap[block.layoutSection.id] = section;
    });
    const sectionUnits = Object.keys(sectionMap).map(function (key) {
      const section = sectionMap[key];
      const commonHeaders = scopedBlocks.filter(function (block) {
        return !block.layoutSection && !/^\s*\d+\s*$/.test(block.text);
      }).map(function (block) { return block.text; });
      return { heading: section.heading || heading, text: commonHeaders.concat([section.heading], section.blocks).filter(Boolean).join("\n") };
    });
    const units = sectionUnits.length ? sectionUnits : [{ heading: heading, text: scopedBlocks.map(function (block) { return block.text; }).join("\n") }];
    let selectedOnPage = 0;
    units.forEach(function (unit) {
      if (!manualSourceSwitchEvidenceMatches_(question,unit.text,unit.heading)) return;
      if (fragments.length >= 5 || selectedOnPage >= 2) return;
      let text = unit.text;
      const unitTerms = manualIndexTerms_(text);
      // Related names expand recall, never model applicability or equivalence.
      const anchored = retrievalPhrases.some(function (alias) {
        return manualPageRagPhraseMatches_(manualPageRagNormalizeText_(text), alias);
      }) || manualIndexTerms_(query).some(function (term) {
        return unitTerms.includes(term) && (lex.postings[term] || []).some(function (row) { return row[0] === page.pdfPage; }) &&
          Number(lex.df[term] || 0) < Math.max(3, lex.N * 0.25);
      });
      if (!anchored) return;
      // Keep a whole setting row/section with following notes, never just its title.
      if (text.length > 12000) return;
      const tableText = blocks.map(function (block) { return block.text; }).join(" ").replace(/\s+/g, "");
      let settingRow = text.match(/^([A-Za-z][A-Za-z0-9 /+().-]{2,55}?)\s+\1(?:\s|$)/m);
      const headerIndex = blocks.findIndex(function (block) { return /第[23](?:第[23])?說明/.test(block.text.replace(/\s+/g, "")); });
      const headingIndex = blocks.findIndex(function (block) { return block.text.trim() === unit.heading; });
      // A continuation page's first setting is not its parent menu. Without
      // a printed parent before the table header, do not invent a hierarchy.
      const printedParent = sectionUnits.length > 0 ? null : findManualPrintedTableParent_(page, pageMap);
      const menuHeading = printedParent ? printedParent.heading : unit.heading;
      const parentVerified = sectionUnits.length > 0 || Boolean(printedParent) || (headingIndex >= 0 && headingIndex < headerIndex);
      if (!settingRow && parentVerified) {
        const lines = text.split("\n");
        const tableStart = lines.findIndex(function (line) { return /第[23](?:第[23])?說明/.test(line.replace(/\s+/g, "")); });
        const label = lines.slice(Math.max(0, tableStart + 1)).map(function (line) {
          const prefix = line.match(/^([A-Za-z][A-Za-z0-9 /+().-]{2,55})(?:[\u3400-\u9fff]|$)/);
          return prefix ? prefix[1].trim() : "";
        }).find(function (line) {
          return line && line !== unit.heading &&
            retrievalPhrases.some(function (phrase) { return manualPageRagPhraseMatches_(manualPageRagNormalizeText_(line), phrase); });
        });
        if (label) settingRow = [label, label];
      }
      const menuPath = /第[23](?:第[23])?說明/.test(tableText) && parentVerified && settingRow && menuHeading &&
        manualPageRagNormalizeText_(menuHeading) !== manualPageRagNormalizeText_(settingRow[1])
        ? `${menuHeading} → ${settingRow[1].trim()}` : "";
      const evidencePages = menuPath && printedParent && printedParent.pageNumber !== page.pdfPage
        ? [printedParent.pageNumber, page.pdfPage] : [page.pdfPage];
      if (evidencePages.length > 1) text = `【第${printedParent.pageNumber}頁的接續表格標題】\n${printedParent.text}\n【第${page.pdfPage}頁設定列】\n${text}`;
      fragments.push({ evidenceId: `E${fragments.length + 1}`, pageNumber: page.pdfPage,
        pageHeading: unit.heading, evidenceText: text, pageHash: page.pageHash,
        menuPath: menuPath,
        evidencePages: evidencePages,
        excludedFamilyBlocks: blocks.length - scopedBlocks.length });
      selectedOnPage++;
    });
  }
  if (!fragments.length) return null;
  if (isManualActionPathQuestion_(query)) {
    fragments.sort(function (a, b) {
      return Number(Boolean(b.menuPath)) - Number(Boolean(a.menuPath));
    });
  }
  return Object.assign({}, revision, {
    model: model, groupId: groups.map(function (group) { return group.id; }).join("+") || "query_time",
    retrievalPolicy: "QueryTimeV1", sourceFileName: document.sourceFileName,
    sourcePdfSha256: revision.sha256.toUpperCase(), modelBinding: document.modelBinding,
    language: document.language || "", sourceRegion: document.sourceRegion || "",
    exactModelInDocument: document.exactModelInDocument !== false,
    aliases: aliases, allowRuleBackedAliasCompletion: false, fragments: fragments,
  });
}

/** Editor/daily maintenance only; no publicly callable deployment mutation. */
function publishCompiledManualIndexes_(maxWrites) {
  const result = { active: [], failed: [], pending: [], written: 0 };
  const started = Date.now();
  const limit = Math.max(1, Math.min(Number(maxWrites) || 3, 6));
  const catalog = typeof MANUAL_PAGE_RAG_DATA_ !== "undefined" ? MANUAL_PAGE_RAG_DATA_ : null;
  if (!catalog || catalog.retrievalPolicy !== "QueryTimeV1") return result;
  try { assertManualFolderWritable_(); }
  catch (error) {
    result.failed = Object.keys(catalog.documents);
    result.reason = String(error.message);
    writeLog(`[Manual Index Publish] ${error.message}; compiled verified index retained`);
    return result;
  }
  const props = PropertiesService.getScriptProperties();
  const reusable = {};
  const verifiedUploads = {};
  const stored = props.getProperties();
  Object.keys(stored).filter(function (key) { return key.indexOf("MANUAL_ACTIVE::") === 0; }).forEach(function (key) {
    try {
      const active = JSON.parse(stored[key]);
      if (active.indexFileId && active.indexChecksum && active.sha256) reusable[`${active.sha256}:${active.indexChecksum}`] = active.indexFileId;
    } catch (error) { /* An invalid pointer is not a reusable artifact. */ }
  });
  Object.keys(catalog.documents).forEach(function (docKey) {
    const document = catalog.documents[docKey];
    const revision = readManualRevision_(docKey, document);
    if (!revision) { result.failed.push(docKey); return; }
    try {
      const old = JSON.parse(props.getProperty(`MANUAL_ACTIVE::${docKey}`) || "null");
      if (old && old.sha256 === revision.sha256 && old.indexChecksum === revision.indexChecksum) {
        result.active.push(docKey); return;
      }
      if (result.written >= limit || Date.now() - started > 120000) {
        result.pending.push(docKey); return;
      }
      const compiledData = compiledManualIndexData_(document);
      const reusableKey = `${revision.sha256}:${revision.indexChecksum}`;
      let indexFileId = reusable[reusableKey];
      if (!indexFileId) {
        if (!compiledData) throw new Error("INDEX_STAGING_DATA_REQUIRED");
        loadManualPageIndex_(docKey, document, revision);
        const blob = Utilities.newBlob(Utilities.base64Decode(compiledData), "application/gzip", `${docKey}.${revision.indexChecksum}.pages.json.gz`);
        indexFileId = Drive.Files.create({ name: blob.getName(), parents: [CONFIG.DRIVE_FOLDER_ID] }, blob, { fields: "id", supportsAllDrives: true }).id;
        result.written++;
      }
      // Read back before activation; do not silently bind partially uploaded data.
      if (!verifiedUploads[indexFileId]) {
        const check = Utilities.ungzip(DriveApp.getFileById(indexFileId).getBlob());
        if (manualIndexDigest_(check.getBytes()) !== revision.indexChecksum) throw new Error("INDEX_UPLOAD_READBACK_FAILED");
        verifiedUploads[indexFileId] = true;
      }
      reusable[reusableKey] = indexFileId;
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(5000)) throw new Error("INDEX_ACTIVATION_LOCK_BUSY");
      try {
        const latestRevision = readManualRevision_(docKey, document);
        if (!latestRevision || latestRevision.sha256 !== revision.sha256) throw new Error("INDEX_ACTIVATION_REVISION_CHANGED");
        const current = props.getProperty(`MANUAL_ACTIVE::${docKey}`);
        if (current) props.setProperty(`MANUAL_PREVIOUS::${docKey}`, current);
        props.setProperty(`MANUAL_ACTIVE::${docKey}`, JSON.stringify(Object.assign({}, revision, { indexFileId: indexFileId, activatedAt: new Date().toISOString() })));
      } finally { lock.releaseLock(); }
      result.active.push(docKey);
    } catch (error) {
      result.failed.push(docKey);
      writeLog(`[Manual Index Publish] ${docKey}: ${error.message}; previous revision retained`);
    }
  });
  return result;
}
