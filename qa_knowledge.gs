// Samsung LINE Bot 結構化 QA / 手冊證據層
//
// 設計目標：
// 1. QA 與人工核對手冊片段共用同一種資料格式，不在 handleMessage 增加題型特例。
// 2. 舊版「[標籤] 問題 / A：答案」可直接讀；新資料一律寫成 QA2: JSON 單列。
// 3. 以倒排索引先縮小候選，再做型號、別稱、詞彙與題意評分；不把整份 QA 丟進 Prompt。
// 4. 資料保存的是可維護事實，LINE 白話與排版由 renderer 統一產生。

var QA_KNOWLEDGE_PREFIX_ = "QA2:";
var QA_KNOWLEDGE_SCHEMA_VERSION_ = 2;
var QA_KNOWLEDGE_CACHE_GENERATION_ = "V3";
var QA_KNOWLEDGE_CACHE_TTL_SECONDS_ = 21600;
// CacheService 每個值上限約 100 KB；中文在 UTF-8 可能佔 3 bytes。
// 保守以 8 筆/片及 24K 字元索引片段保存，避免資料量增加後才在正式環境爆掉。
var QA_KNOWLEDGE_RECORDS_PER_SHARD_ = 8;
var QA_KNOWLEDGE_INDEX_BUCKETS_ = 16;
var QA_KNOWLEDGE_CACHE_META_KEY_ = "QA2_META_V3";
var QA_KNOWLEDGE_INDEX_CHUNK_CHARS_ = 24000;

function qaKnowledgeStableHash_(text) {
  var value = String(text || "");
  var hash = 2166136261;
  for (var i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function qaKnowledgeUniqueStrings_(values) {
  var seen = {};
  var result = [];
  (Array.isArray(values) ? values : []).forEach(function (value) {
    var text = String(value === null || value === undefined ? "" : value).trim();
    if (!text) return;
    var key = text.toUpperCase();
    if (seen[key]) return;
    seen[key] = true;
    result.push(text);
  });
  return result;
}

function qaKnowledgeToHalfWidth_(text) {
  if (typeof toHalfWidth === "function") {
    return toHalfWidth(String(text || ""));
  }
  return String(text || "")
    .replace(/[！-～]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
    })
    .replace(/　/g, " ");
}

function qaKnowledgeNormalizeText_(text) {
  return qaKnowledgeToHalfWidth_(text)
    .toUpperCase()
    .replace(/藍芽/g, "藍牙")
    .replace(/耳機插孔/g, "耳機孔")
    .replace(/應用程序/g, "應用程式")
    .replace(/恢復出廠|回復出廠|恢復原廠|回復原廠/g, "原廠重設")
    .replace(/重置/g, "重設")
    .replace(/USB[\s‑–—_-]*C|TYPE[\s‑–—_-]*C/g, "USBC")
    .replace(/DISPLAY[\s‑–—_-]*PORT/g, "DISPLAYPORT")
    .replace(/AIR\s*PLAY/g, "AIRPLAY")
    .replace(/[\s,，。；;：:、.!！?？()（）\[\]【】"'`/\\|]+/g, "");
}

function qaKnowledgeSearchTokens_(text) {
  var normalized = qaKnowledgeNormalizeText_(text);
  if (!normalized) return [];
  var tokens = [];
  var alphaNumeric = normalized.match(/[A-Z0-9]{2,}/g) || [];
  tokens = tokens.concat(alphaNumeric);
  var chineseRuns = normalized.match(/[\u3400-\u9fff]{2,}/g) || [];
  chineseRuns.forEach(function (run) {
    if (run.length <= 12) tokens.push(run);
    for (var size = 2; size <= 3; size++) {
      for (var i = 0; i <= run.length - size; i++) {
        tokens.push(run.substring(i, i + size));
      }
    }
  });
  return qaKnowledgeUniqueStrings_(tokens).filter(function (token) {
    return token.length >= 2 && !/^(?:三星|螢幕|顯示器|請問|可以|是否|什麼|怎麼|如何|功能|資訊|這台|這個)$/.test(token);
  });
}

function qaKnowledgeNormalizeModels_(values) {
  return qaKnowledgeUniqueStrings_(values).map(function (model) {
    if (typeof normalizeModelForDisplay === "function") {
      return normalizeModelForDisplay(model);
    }
    return String(model || "").trim().toUpperCase().replace(/^LS(?=S?\d{2})/, "S");
  });
}

function qaKnowledgeExtractModels_(text) {
  if (typeof extractFullModelLikeTokens === "function") {
    return qaKnowledgeNormalizeModels_(extractFullModelLikeTokens(text));
  }
  var matches = String(text || "").toUpperCase().match(/\b(?:LS)?S\d{2}[A-Z0-9]{5,16}\b/g) || [];
  return qaKnowledgeNormalizeModels_(matches);
}

function qaKnowledgeExtractAliases_(text) {
  if (typeof extractShortAliasModelTokens === "function") {
    return qaKnowledgeUniqueStrings_(extractShortAliasModelTokens(text)).map(function (value) {
      return value.toUpperCase();
    });
  }
  return qaKnowledgeUniqueStrings_(
    String(text || "").toUpperCase().match(/\b[SGM]\d{1,5}[A-Z]{0,3}\b/g) || [],
  );
}

function qaKnowledgeExtractFamilies_(values) {
  return qaKnowledgeUniqueStrings_(values).filter(function (value) {
    return /(?:MONITOR|ODYSSEY|VIEWFINITY|ARK|智慧螢幕|智慧顯示器|系列)/i.test(value);
  });
}

function qaKnowledgeNormalizeAnswer_(answer) {
  var source = answer && typeof answer === "object" ? answer : {};
  return {
    conclusion: String(source.conclusion || "").trim(),
    facts: qaKnowledgeUniqueStrings_(source.facts),
    steps: qaKnowledgeUniqueStrings_(source.steps),
    cautions: qaKnowledgeUniqueStrings_(source.cautions),
    alternatives: qaKnowledgeUniqueStrings_(source.alternatives),
    legacyText: String(source.legacyText || "").trim(),
  };
}

function qaKnowledgeStructureLegacyAnswer_(answerText) {
  var clean = String(answerText || "")
    .replace(/^A[:：]\s*/i, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  var result = {
    conclusion: "",
    facts: [],
    steps: [],
    cautions: [],
    alternatives: [],
    legacyText: "",
  };
  if (!clean) return result;

  var sentences = (clean.match(/[^。！？!?]+[。！？!?]?/g) || [])
    .map(function (item) {
      return String(item || "").replace(/[。；\s]+$/, "").trim();
    })
    .filter(Boolean);
  if (sentences.length === 0) sentences = [clean];

  sentences.forEach(function (sentence, index) {
    if (/提醒|注意|依型號|依地區|可能|切勿|執行前|僅供|無法|不支援/.test(sentence) && index > 0) {
      result.cautions.push(sentence);
    } else if (/→/.test(sentence) && /(?:設定|選單|首頁|控制台|路徑|進入|點選|選擇|開啟|連接)/.test(sentence)) {
      result.steps.push(sentence);
    } else if (index === 0) {
      result.conclusion = sentence;
    } else {
      result.facts.push(sentence);
    }
  });
  if (!result.conclusion && result.steps.length > 0) {
    result.conclusion = "可以照下面的步驟操作";
  }
  return qaKnowledgeNormalizeAnswer_(result);
}

function qaKnowledgeParseLegacyRow_(rawText, rowIndex) {
  var raw = String(rawText || "").replace(/^QA:\s*/i, "").trim();
  var parts = raw.split(/\/\s*A[:：]/i);
  if (parts.length < 2) return null;
  var questionSide = String(parts.shift() || "").trim();
  var answerText = parts.join(" / A：").trim();
  var tags = [];
  var tagMatch = questionSide.match(/^\s*\[([^\]]+)\]\s*/);
  if (tagMatch) {
    tags = tagMatch[1].split(/[,，、]/).map(function (item) {
      return item.trim();
    }).filter(Boolean);
    questionSide = questionSide.substring(tagMatch[0].length).trim();
  }
  if (!questionSide || !answerText) return null;
  var scopeText = tags.join(" ") + " " + questionSide;
  var record = {
    v: QA_KNOWLEDGE_SCHEMA_VERSION_,
    id: "legacy-" + qaKnowledgeStableHash_(questionSide),
    enabled: true,
    question: questionSide,
    scope: {
      models: qaKnowledgeExtractModels_(scopeText),
      aliases: qaKnowledgeExtractAliases_(scopeText),
      families: qaKnowledgeExtractFamilies_(tags),
    },
    intents: [],
    terms: qaKnowledgeUniqueStrings_(tags),
    excludeTerms: [],
    requiresAction: false,
    answer: {
      conclusion: "",
      facts: [],
      steps: [],
      cautions: [],
      alternatives: [],
      legacyText: answerText,
    },
    evidence: { type: "qa" },
    priority: 100,
    rowIndex: Number(rowIndex || 0),
    legacy: true,
  };
  return qaKnowledgeNormalizeRecord_(record, rowIndex, rawText);
}

function qaKnowledgeNormalizeRecord_(input, rowIndex, rawText) {
  if (!input || typeof input !== "object") return null;
  var scope = input.scope && typeof input.scope === "object" ? input.scope : {};
  var evidence = input.evidence && typeof input.evidence === "object" ? input.evidence : {};
  var question = String(input.question || "").trim();
  var answer = qaKnowledgeNormalizeAnswer_(input.answer);
  if (!question && !answer.conclusion && !answer.legacyText) return null;
  var record = {
    v: QA_KNOWLEDGE_SCHEMA_VERSION_,
    id: String(input.id || "qa-" + qaKnowledgeStableHash_(question + JSON.stringify(scope))).trim(),
    enabled: input.enabled !== false,
    question: question,
    scope: {
      models: qaKnowledgeNormalizeModels_(scope.models || input.models || []),
      aliases: qaKnowledgeUniqueStrings_(scope.aliases || input.aliases || []).map(function (value) {
        return value.toUpperCase();
      }),
      families: qaKnowledgeUniqueStrings_(scope.families || input.families || []),
    },
    intents: qaKnowledgeUniqueStrings_(input.intents || (input.intent ? [input.intent] : [])).map(function (value) {
      return value.toUpperCase();
    }),
    terms: qaKnowledgeUniqueStrings_(input.terms || input.tags || []),
    excludeTerms: qaKnowledgeUniqueStrings_(input.excludeTerms || []),
    requiresAction: input.requiresAction === true,
    answer: answer,
    evidence: {
      type: String(evidence.type || input.sourceType || "qa").toLowerCase(),
      sourceFile: String(evidence.sourceFile || input.sourceFile || "").trim(),
      pages: String(evidence.pages || input.pages || "").trim(),
      location: String(evidence.location || input.location || "").trim(),
      sourceUrl: String(evidence.sourceUrl || input.sourceUrl || "").trim(),
    },
    priority: Number(input.priority || 100),
    rowIndex: Number(rowIndex || input.rowIndex || 0),
    legacy: input.legacy === true,
    rawText: String(rawText || "").trim(),
  };
  // 舊呼叫端與稽核 LOG 的相容欄位；權威資料仍在 answer / evidence。
  record.intent = record.intents[0] || "";
  record.sourceFile = record.evidence.sourceFile;
  record.pages = record.evidence.pages;
  record.location = record.evidence.location;
  record.sourceType = record.evidence.type === "manual_chunk" && record.location
    ? "official_html_manual"
    : record.evidence.type;
  record.facts = [];
  if (record.answer.conclusion) record.facts.push(record.answer.conclusion);
  record.facts = record.facts.concat(record.answer.steps, record.answer.facts, record.answer.cautions);
  return record.enabled ? record : null;
}

function qaKnowledgeParseRow_(rawText, rowIndex) {
  var raw = String(rawText || "").trim();
  if (!raw || (/^(?:問題|QUESTION|QA內容)$/i.test(raw) && raw.length < 20)) return null;
  if (raw.indexOf(QA_KNOWLEDGE_PREFIX_) === 0) {
    try {
      return qaKnowledgeNormalizeRecord_(
        JSON.parse(raw.substring(QA_KNOWLEDGE_PREFIX_.length)),
        rowIndex,
        raw,
      );
    } catch (error) {
      if (typeof writeLog === "function") {
        writeLog("[QA2 Parse] 第 " + rowIndex + " 列 JSON 無效: " + error.message);
      }
      return null;
    }
  }
  return qaKnowledgeParseLegacyRow_(raw, rowIndex);
}

function qaKnowledgeSerializeRecord_(record) {
  var normalized = qaKnowledgeNormalizeRecord_(record, record && record.rowIndex, "");
  if (!normalized) return "";
  var stored = {
    v: QA_KNOWLEDGE_SCHEMA_VERSION_,
    id: normalized.id,
    enabled: normalized.enabled,
    question: normalized.question,
    scope: normalized.scope,
    intents: normalized.intents,
    terms: normalized.terms,
    excludeTerms: normalized.excludeTerms,
    requiresAction: normalized.requiresAction,
    answer: normalized.answer,
    evidence: normalized.evidence,
    priority: normalized.priority,
  };
  if (!stored.answer.legacyText) delete stored.answer.legacyText;
  if (stored.excludeTerms.length === 0) delete stored.excludeTerms;
  if (stored.intents.length === 0) delete stored.intents;
  if (!stored.requiresAction) delete stored.requiresAction;
  return QA_KNOWLEDGE_PREFIX_ + JSON.stringify(stored);
}

function qaKnowledgeConvertDraftToStructuredLine_(draftText) {
  var raw = String(draftText || "").trim();
  if (!raw) return "";
  if (raw.indexOf(QA_KNOWLEDGE_PREFIX_) === 0) {
    var existing = qaKnowledgeParseRow_(raw, 0);
    return existing ? qaKnowledgeSerializeRecord_(existing) : "";
  }
  var legacy = qaKnowledgeParseLegacyRow_(raw, 0);
  if (!legacy) return "";
  legacy.id = "qa-" + qaKnowledgeStableHash_(legacy.question);
  legacy.answer = qaKnowledgeStructureLegacyAnswer_(legacy.answer.legacyText);
  legacy.legacy = false;
  legacy.evidence = { type: "qa" };
  return qaKnowledgeSerializeRecord_(legacy);
}

function qaKnowledgeBuildRecords_(rows) {
  var records = [];
  (Array.isArray(rows) ? rows : []).forEach(function (row, index) {
    var raw = Array.isArray(row) ? row[0] : row;
    var record = qaKnowledgeParseRow_(raw, index + 1);
    if (record) records.push(record);
  });
  return records;
}

function qaKnowledgeIndexTokensForRecord_(record) {
  var parts = [record.question]
    .concat(record.terms || [])
    .concat(record.intents || [])
    .concat((record.scope && record.scope.models) || [])
    .concat((record.scope && record.scope.aliases) || [])
    .concat((record.scope && record.scope.families) || []);
  return qaKnowledgeSearchTokens_(parts.join(" "));
}

function qaKnowledgeCacheKey_(kind, suffix) {
  return "QA2_" + kind + "_" + QA_KNOWLEDGE_CACHE_GENERATION_ +
    (suffix === undefined ? "" : "_" + suffix);
}

function qaKnowledgeChunkString_(text, maxChars) {
  var source = String(text || "");
  var size = Math.max(1000, Number(maxChars || 70000));
  var chunks = [];
  for (var i = 0; i < source.length; i += size) {
    chunks.push(source.substring(i, i + size));
  }
  return chunks.length > 0 ? chunks : [""];
}

function qaKnowledgeRebuildCache_(rows, providedCache) {
  var records = qaKnowledgeBuildRecords_(rows);
  var cache = providedCache || (typeof CacheService !== "undefined" ? CacheService.getScriptCache() : null);
  if (!cache) return { records: records, count: records.length, fromCache: false };

  var oldMeta = null;
  try {
    oldMeta = JSON.parse(cache.get(QA_KNOWLEDGE_CACHE_META_KEY_) || "null");
  } catch (error) {}
  if (oldMeta) {
    for (var oldShard = 0; oldShard < Number(oldMeta.recordShards || 0); oldShard++) {
      cache.remove(qaKnowledgeCacheKey_("RECORDS", oldShard));
    }
    for (var oldBucket = 0; oldBucket < Number(oldMeta.indexBuckets || 0); oldBucket++) {
      var oldParts = Number(oldMeta.indexParts && oldMeta.indexParts[oldBucket] || 0);
      for (var oldPart = 0; oldPart < oldParts; oldPart++) {
        cache.remove(qaKnowledgeCacheKey_("INDEX_" + oldBucket, oldPart));
      }
    }
  }

  var recordShards = Math.ceil(records.length / QA_KNOWLEDGE_RECORDS_PER_SHARD_);
  for (var shard = 0; shard < recordShards; shard++) {
    var start = shard * QA_KNOWLEDGE_RECORDS_PER_SHARD_;
    cache.put(
      qaKnowledgeCacheKey_("RECORDS", shard),
      JSON.stringify(records.slice(start, start + QA_KNOWLEDGE_RECORDS_PER_SHARD_)),
      QA_KNOWLEDGE_CACHE_TTL_SECONDS_,
    );
  }

  var buckets = [];
  for (var b = 0; b < QA_KNOWLEDGE_INDEX_BUCKETS_; b++) buckets.push({});
  records.forEach(function (record, recordIndex) {
    qaKnowledgeIndexTokensForRecord_(record).forEach(function (token) {
      var bucketIndex = parseInt(qaKnowledgeStableHash_(token), 36) % QA_KNOWLEDGE_INDEX_BUCKETS_;
      var bucket = buckets[bucketIndex];
      if (!bucket[token]) bucket[token] = [];
      if (bucket[token].indexOf(recordIndex) < 0) bucket[token].push(recordIndex);
    });
  });

  var indexParts = [];
  buckets.forEach(function (bucket, bucketIndex) {
    var chunks = qaKnowledgeChunkString_(
      JSON.stringify(bucket),
      QA_KNOWLEDGE_INDEX_CHUNK_CHARS_,
    );
    indexParts[bucketIndex] = chunks.length;
    chunks.forEach(function (chunk, partIndex) {
      cache.put(
        qaKnowledgeCacheKey_("INDEX_" + bucketIndex, partIndex),
        chunk,
        QA_KNOWLEDGE_CACHE_TTL_SECONDS_,
      );
    });
  });

  var meta = {
    v: QA_KNOWLEDGE_SCHEMA_VERSION_,
    count: records.length,
    recordShards: recordShards,
    indexBuckets: QA_KNOWLEDGE_INDEX_BUCKETS_,
    indexParts: indexParts,
    builtAt: new Date().toISOString(),
  };
  cache.put(QA_KNOWLEDGE_CACHE_META_KEY_, JSON.stringify(meta), QA_KNOWLEDGE_CACHE_TTL_SECONDS_);
  cache.remove("qa_source_inference_rows_v1");
  if (typeof writeLog === "function") {
    writeLog("[QA2 Index] 建立 " + records.length + " 筆、" + recordShards + " 個資料分片與 " + QA_KNOWLEDGE_INDEX_BUCKETS_ + " 個索引桶");
  }
  return { records: records, count: records.length, fromCache: false, meta: meta };
}

function qaKnowledgeReadSheetRows_() {
  if (typeof QA_KNOWLEDGE_TEST_ROWS_ !== "undefined" && Array.isArray(QA_KNOWLEDGE_TEST_ROWS_)) {
    return QA_KNOWLEDGE_TEST_ROWS_.slice();
  }
  try {
    var spreadsheet = typeof ss !== "undefined" && ss
      ? ss
      : SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = typeof SHEET_NAMES !== "undefined" && SHEET_NAMES.QA ? SHEET_NAMES.QA : "QA";
    var sheet = spreadsheet && spreadsheet.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 1) return [];
    return sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().map(function (row) {
      return row[0];
    });
  } catch (error) {
    if (typeof writeLog === "function") writeLog("[QA2 Load] 讀取 Sheet 失敗: " + error.message);
    return [];
  }
}

function qaKnowledgeEnsureCache_(providedCache) {
  var cache = providedCache || (typeof CacheService !== "undefined" ? CacheService.getScriptCache() : null);
  if (!cache) {
    var directRecords = qaKnowledgeBuildRecords_(qaKnowledgeReadSheetRows_());
    return { cache: null, meta: { count: directRecords.length }, records: directRecords, fromCache: false };
  }
  try {
    var rawMeta = cache.get(QA_KNOWLEDGE_CACHE_META_KEY_);
    if (rawMeta) {
      var meta = JSON.parse(rawMeta);
      if (meta && meta.v === QA_KNOWLEDGE_SCHEMA_VERSION_) {
        return { cache: cache, meta: meta, records: null, fromCache: true };
      }
    }
  } catch (error) {}
  var rebuilt = qaKnowledgeRebuildCache_(qaKnowledgeReadSheetRows_(), cache);
  return { cache: cache, meta: rebuilt.meta || { count: rebuilt.count }, records: rebuilt.records, fromCache: false };
}

function qaKnowledgeLoadRecordShard_(cache, shardIndex) {
  if (!cache) return [];
  try {
    var raw = cache.get(qaKnowledgeCacheKey_("RECORDS", shardIndex));
    if (raw === null || raw === undefined || raw === "") return null;
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return null;
  }
}

function qaKnowledgeLoadAllRecords_(providedCache) {
  var state = qaKnowledgeEnsureCache_(providedCache);
  if (Array.isArray(state.records)) return state.records;
  var records = [];
  for (var shard = 0; shard < Number(state.meta.recordShards || 0); shard++) {
    var shardRecords = qaKnowledgeLoadRecordShard_(state.cache, shard);
    if (shardRecords === null) {
      return qaKnowledgeRebuildCache_(qaKnowledgeReadSheetRows_(), state.cache).records;
    }
    records = records.concat(shardRecords);
  }
  return records;
}

function qaKnowledgeCandidateIndexes_(query, state) {
  var count = Number(state.meta && state.meta.count || 0);
  if (!state.cache || count <= 0) {
    return Array.from({ length: count }, function (_, index) { return index; });
  }
  var tokens = qaKnowledgeSearchTokens_(query);
  var byBucket = {};
  tokens.forEach(function (token) {
    var bucketIndex = parseInt(qaKnowledgeStableHash_(token), 36) % QA_KNOWLEDGE_INDEX_BUCKETS_;
    if (!byBucket[bucketIndex]) byBucket[bucketIndex] = [];
    byBucket[bucketIndex].push(token);
  });
  var candidateSet = {};
  var cacheIncomplete = false;
  Object.keys(byBucket).forEach(function (bucketKey) {
    if (cacheIncomplete) return;
    var bucketIndex = Number(bucketKey);
    var raw = "";
    var partCount = Number(state.meta.indexParts && state.meta.indexParts[bucketIndex] || 0);
    for (var part = 0; part < partCount; part++) {
      var cachedPart = state.cache.get(qaKnowledgeCacheKey_("INDEX_" + bucketIndex, part));
      if (cachedPart === null || cachedPart === undefined || cachedPart === "") {
        cacheIncomplete = true;
        break;
      }
      raw += cachedPart;
    }
    if (cacheIncomplete || !raw) return;
    try {
      var index = JSON.parse(raw);
      byBucket[bucketIndex].forEach(function (token) {
        (index[token] || []).forEach(function (recordIndex) {
          candidateSet[recordIndex] = true;
        });
      });
    } catch (error) {
      cacheIncomplete = true;
    }
  });
  if (cacheIncomplete) return null;
  var candidates = Object.keys(candidateSet).map(Number);
  // 索引剛好無命中時，資料量小則安全掃描；大量資料避免退回整包 Prompt。
  if (candidates.length === 0 && count <= 200) {
    return Array.from({ length: count }, function (_, index) { return index; });
  }
  return candidates;
}

function qaKnowledgeLoadCandidates_(query, providedCache) {
  var state = qaKnowledgeEnsureCache_(providedCache);
  if (Array.isArray(state.records)) {
    return { records: state.records, totalCount: state.records.length, fromCache: false };
  }
  var indexes = qaKnowledgeCandidateIndexes_(query, state);
  if (indexes === null) {
    var rebuiltFromIndex = qaKnowledgeRebuildCache_(qaKnowledgeReadSheetRows_(), state.cache);
    return {
      records: rebuiltFromIndex.records,
      totalCount: rebuiltFromIndex.count,
      fromCache: false,
    };
  }
  var shardMap = {};
  indexes.forEach(function (recordIndex) {
    var shard = Math.floor(recordIndex / QA_KNOWLEDGE_RECORDS_PER_SHARD_);
    if (!shardMap[shard]) shardMap[shard] = [];
    shardMap[shard].push(recordIndex);
  });
  var records = [];
  var rebuiltDueToMissingShard = false;
  Object.keys(shardMap).forEach(function (shardKey) {
    if (rebuiltDueToMissingShard) return;
    var shardIndex = Number(shardKey);
    var shardRecords = qaKnowledgeLoadRecordShard_(state.cache, shardIndex);
    if (shardRecords === null) {
      var rebuiltFromShard = qaKnowledgeRebuildCache_(qaKnowledgeReadSheetRows_(), state.cache);
      records = rebuiltFromShard.records;
      rebuiltDueToMissingShard = true;
      return;
    }
    shardMap[shardIndex].forEach(function (recordIndex) {
      var localIndex = recordIndex % QA_KNOWLEDGE_RECORDS_PER_SHARD_;
      if (shardRecords[localIndex]) records.push(shardRecords[localIndex]);
    });
  });
  return {
    records: records,
    totalCount: Number(state.meta.count || 0),
    fromCache: state.fromCache,
  };
}

function qaKnowledgeModelMatches_(candidate, queryModel) {
  if (typeof isPdfModelTokenMatch_ === "function") {
    return isPdfModelTokenMatch_(candidate, queryModel);
  }
  var left = String(candidate || "").toUpperCase();
  var right = String(queryModel || "").toUpperCase();
  return left === right || left.indexOf(right) === 0 || right.indexOf(left) === 0;
}

function qaKnowledgeScoreRecord_(record, query, options) {
  var opts = options || {};
  if (!record || record.enabled === false) return null;
  var evidenceType = String(record.evidence && record.evidence.type || "qa").toLowerCase();
  if (opts.excludeManual && evidenceType === "manual_chunk") return null;
  if (opts.manualOnly && evidenceType !== "manual_chunk") return null;

  var normalizedQuery = qaKnowledgeNormalizeText_(query);
  var normalizedQuestion = qaKnowledgeNormalizeText_(record.question);
  if (!normalizedQuery) return null;
  var excluded = (record.excludeTerms || []).some(function (term) {
    var normalized = qaKnowledgeNormalizeText_(term);
    return normalized && normalizedQuery.indexOf(normalized) >= 0;
  });
  if (excluded) return null;

  var queryModels = qaKnowledgeNormalizeModels_(
    (opts.model ? [opts.model] : []).concat(qaKnowledgeExtractModels_(query)),
  );
  var recordModels = record.scope && Array.isArray(record.scope.models) ? record.scope.models : [];
  var modelHit = false;
  if (queryModels.length > 0 && recordModels.length > 0) {
    modelHit = queryModels.some(function (queryModel) {
      return recordModels.some(function (recordModel) {
        return qaKnowledgeModelMatches_(recordModel, queryModel);
      });
    });
    if (!modelHit) return null;
  } else if (opts.manualOnly && recordModels.length > 0) {
    return null;
  }

  var queryAliases = qaKnowledgeExtractAliases_(query);
  var recordAliases = record.scope && Array.isArray(record.scope.aliases) ? record.scope.aliases : [];
  var recordFamilies = record.scope && Array.isArray(record.scope.families) ? record.scope.families : [];
  var aliasHits = queryAliases.filter(function (alias) {
    return recordAliases.indexOf(alias) >= 0;
  }).length;
  var familyHits = recordFamilies.filter(function (family) {
    var normalizedFamily = qaKnowledgeNormalizeText_(family);
    return normalizedFamily && normalizedQuery.indexOf(normalizedFamily) >= 0;
  }).length;
  var hasProductScope = recordModels.length > 0 || recordAliases.length > 0 || recordFamilies.length > 0;
  var hasQueryProductIdentity = queryModels.length > 0 || queryAliases.length > 0 || familyHits > 0;
  if (hasProductScope && !hasQueryProductIdentity) {
    return null;
  }
  if (
    queryModels.length === 0 &&
    queryAliases.length > 0 &&
    (recordAliases.length > 0 || recordFamilies.length > 0 || recordModels.length > 0) &&
    aliasHits === 0 &&
    familyHits === 0
  ) {
    return null;
  }

  var termHits = 0;
  (record.terms || []).forEach(function (term) {
    var normalizedTerm = qaKnowledgeNormalizeText_(term);
    if (normalizedTerm && normalizedQuery.indexOf(normalizedTerm) >= 0) termHits++;
  });

  var queryTokens = qaKnowledgeSearchTokens_(query);
  var recordTokens = qaKnowledgeIndexTokensForRecord_(record);
  var tokenSet = {};
  queryTokens.forEach(function (token) { tokenSet[token] = true; });
  var overlap = recordTokens.filter(function (token) { return tokenSet[token]; }).length;
  var denominator = Math.max(1, Math.min(queryTokens.length, recordTokens.length));
  var overlapRatio = overlap / denominator;

  var score = Number(record.priority || 100) / 20;
  var exactQuestion = normalizedQuestion && normalizedQuestion === normalizedQuery;
  var deterministicQuestionMatch = false;
  if (typeof isQaQuestionDirectMatch_ === "function" && evidenceType !== "manual_chunk") {
    deterministicQuestionMatch = isQaQuestionDirectMatch_(query, record.question);
  }
  if (exactQuestion) score += 120;
  else if (deterministicQuestionMatch) score += 95;
  if (modelHit) score += 45;
  score += Math.min(36, aliasHits * 18);
  score += Math.min(24, familyHits * 12);
  score += Math.min(48, termHits * 12);
  score += Math.min(40, overlapRatio * 40);

  var strongSignal = exactQuestion || deterministicQuestionMatch || modelHit || aliasHits > 0 || familyHits > 0 || termHits >= 2;
  return {
    record: record,
    score: score,
    exactQuestion: exactQuestion,
    deterministicQuestionMatch: deterministicQuestionMatch,
    modelHit: modelHit,
    aliasHits: aliasHits,
    familyHits: familyHits,
    termHits: termHits,
    overlapRatio: overlapRatio,
    strongSignal: strongSignal,
  };
}

function qaKnowledgeRank_(query, options) {
  var opts = options || {};
  var loaded = qaKnowledgeLoadCandidates_(query, opts.cache);
  var ranked = loaded.records
    .map(function (record) { return qaKnowledgeScoreRecord_(record, query, opts); })
    .filter(Boolean)
    .sort(function (a, b) {
      return b.score - a.score || Number(b.record.priority || 0) - Number(a.record.priority || 0);
    });
  return {
    ranked: ranked,
    totalCount: loaded.totalCount,
    fromCache: loaded.fromCache,
  };
}

function qaKnowledgeFindLocalMatch_(query) {
  var result = qaKnowledgeRank_(query, { excludeManual: true });
  var best = result.ranked[0];
  if (!best || !best.strongSignal || best.score < 68) return null;
  return {
    question: best.record.question,
    answer: qaKnowledgeRenderAnswer_(best.record),
    record: best.record,
    qaId: best.record.id,
    score: best.score,
  };
}

function qaKnowledgeRenderAnswer_(record, options) {
  if (!record || !record.answer) return "";
  var opts = options || {};
  var answer = qaKnowledgeNormalizeAnswer_(record.answer);
  if (answer.legacyText) {
    return String(answer.legacyText).trim();
  }
  var lines = [];
  var conclusion = String(answer.conclusion || "").replace(/[。；]+$/, "").trim();
  if (conclusion) {
    lines.push((opts.modelPrefix ? String(opts.modelPrefix).trim() + "，" : "") + conclusion + "。");
  }
  if (answer.steps.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("你可以這樣做：");
    answer.steps.forEach(function (step, index) {
      lines.push((index + 1) + ". " + String(step).replace(/[。；]+$/, "") + "。");
    });
  }
  if (answer.facts.length > 0) {
    if (lines.length > 0) lines.push("");
    answer.facts.forEach(function (fact) {
      lines.push("• " + String(fact).replace(/[。；]+$/, "") + "。");
    });
  }
  if (answer.cautions.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("提醒你：" + answer.cautions.map(function (item) {
      return String(item).replace(/[。；]+$/, "");
    }).join("；") + "。");
  }
  if (answer.alternatives.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("也可以考慮：" + answer.alternatives.map(function (item) {
      return String(item).replace(/[。；]+$/, "");
    }).join("；") + "。");
  }
  return lines.join("\n").trim();
}

function qaKnowledgePromptLine_(record) {
  var scope = [];
  if (record.scope) {
    scope = scope.concat(record.scope.models || [], record.scope.aliases || [], record.scope.families || []);
  }
  var answer = qaKnowledgeRenderAnswer_(record).replace(/\n+/g, " ").trim();
  return [
    "QA#" + record.id,
    scope.length > 0 ? "適用=" + qaKnowledgeUniqueStrings_(scope).join("/") : "適用=通用",
    "問題=" + record.question,
    "答案=" + answer,
  ].join(" | ");
}

function qaKnowledgeSelectPromptContext_(query, injectedModels, isPdfMode) {
  var modelList = qaKnowledgeNormalizeModels_(injectedModels || []);
  var enrichedQuery = String(query || "") + (modelList.length > 0 ? " " + modelList.join(" ") : "");
  var result = qaKnowledgeRank_(enrichedQuery, { excludeManual: true });
  var selected = result.ranked.filter(function (item) {
    if (item.score < 18) return false;
    if (isPdfMode && !item.strongSignal) return false;
    if (
      isPdfMode &&
      typeof isExternalDeviceCompatibilityQa_ === "function" &&
      isExternalDeviceCompatibilityQa_(
        item.record.question + "\n" + qaKnowledgeRenderAnswer_(item.record),
      )
    ) {
      return false;
    }
    return true;
  }).slice(0, 6);
  return {
    text: selected.map(function (item) { return qaKnowledgePromptLine_(item.record); }).join("\n"),
    selectedCount: selected.length,
    totalCount: result.totalCount,
    fromCache: result.fromCache,
    records: selected.map(function (item) { return item.record; }),
  };
}

function qaKnowledgeInferSourceTag_(userText, replyText) {
  var result = qaKnowledgeRank_(userText, { excludeManual: true });
  var replyTokens = qaKnowledgeSearchTokens_(replyText);
  var replySet = {};
  replyTokens.forEach(function (token) { replySet[token] = true; });
  for (var i = 0; i < Math.min(5, result.ranked.length); i++) {
    var item = result.ranked[i];
    if (item.score < 30) continue;
    var answerTokens = qaKnowledgeSearchTokens_(qaKnowledgeRenderAnswer_(item.record));
    var hitCount = answerTokens.filter(function (token) { return replySet[token]; }).length;
    if (hitCount >= 3) {
      if (typeof writeLog === "function") {
        writeLog("[QA2 Source] 回覆命中 " + item.record.id + "，可稽核為 QA 來源");
      }
      return "[來源:QA庫]";
    }
  }
  return "";
}

function qaKnowledgeManualQueryMatches_(record, query) {
  var normalizedQuery = qaKnowledgeNormalizeText_(query);
  if (!normalizedQuery) return false;
  if ((record.excludeTerms || []).some(function (term) {
    var normalized = qaKnowledgeNormalizeText_(term);
    return normalized && normalizedQuery.indexOf(normalized) >= 0;
  })) {
    return false;
  }
  var termHits = (record.terms || []).filter(function (term) {
    var normalized = qaKnowledgeNormalizeText_(term);
    return normalized && normalizedQuery.indexOf(normalized) >= 0;
  }).length;
  if (termHits === 0) return false;
  if (record.requiresAction === true) {
    return /(?:如何|怎麼|怎樣|哪裡|在哪|設定|操作|連接|連線|配對|安裝|下載|刪除|移除|更新|升級|恢復|回復|還原|重設|投影|分享|鏡像|開啟|找不到|看|觀看|播放)/i.test(
      String(query || ""),
    );
  }
  return true;
}

function qaKnowledgeGetManualEvidenceRecords_() {
  return qaKnowledgeLoadAllRecords_().filter(function (record) {
    return String(record.evidence && record.evidence.type || "").toLowerCase() === "manual_chunk";
  });
}

function qaKnowledgeFindManualEvidence_(query, model) {
  var normalizedModel = String(model || "").trim().toUpperCase();
  if (!normalizedModel) return null;
  var ranked = qaKnowledgeRank_(String(query || "") + " " + normalizedModel, {
    manualOnly: true,
    model: normalizedModel,
  }).ranked;
  var candidates = ranked.map(function (item) {
    return item.record;
  }).filter(function (record) {
    return qaKnowledgeManualQueryMatches_(record, query);
  });
  candidates.sort(function (a, b) {
    var aHits = (a.terms || []).filter(function (term) {
      return qaKnowledgeNormalizeText_(query).indexOf(qaKnowledgeNormalizeText_(term)) >= 0;
    }).length;
    var bHits = (b.terms || []).filter(function (term) {
      return qaKnowledgeNormalizeText_(query).indexOf(qaKnowledgeNormalizeText_(term)) >= 0;
    }).length;
    return bHits - aHits || Number(b.priority || 0) - Number(a.priority || 0);
  });
  return candidates[0] || null;
}

function qaKnowledgeBuildManualReply_(model, record) {
  if (!record) return "";
  var body = qaKnowledgeRenderAnswer_(record, { modelPrefix: model });
  if (!body) return "";
  var evidence = record.evidence || {};
  var location = evidence.location
    ? "官方手冊：" + evidence.location
    : "官方手冊：第 " + evidence.pages + " 頁";
  return body + "\n\n" + location + "\n[來源:官方手冊]";
}

function qaKnowledgeAdminPreview_(recordOrLine) {
  var record = typeof recordOrLine === "string"
    ? qaKnowledgeParseRow_(recordOrLine, 0)
    : qaKnowledgeNormalizeRecord_(recordOrLine, 0, "");
  if (!record) return "";
  var scope = [].concat(record.scope.models || [], record.scope.aliases || [], record.scope.families || []);
  return [
    "ID：" + record.id,
    "適用：" + (scope.length > 0 ? qaKnowledgeUniqueStrings_(scope).join("、") : "通用"),
    "問題：" + record.question,
    "回答：" + qaKnowledgeRenderAnswer_(record),
    "證據：" + String(record.evidence.type || "qa"),
  ].join("\n");
}

function qaKnowledgeUpsertRows_(rows) {
  var inputs = Array.isArray(rows) ? rows : [];
  if (inputs.length === 0) throw new Error("No QA2 records provided");
  var normalizedLines = inputs.map(function (row, index) {
    var raw = typeof row === "string" ? row : QA_KNOWLEDGE_PREFIX_ + JSON.stringify(row);
    var record = qaKnowledgeParseRow_(raw, index + 1);
    if (!record || !record.id) throw new Error("Invalid QA2 record at index " + index);
    return { id: record.id, line: qaKnowledgeSerializeRecord_(record) };
  });
  var spreadsheet = typeof ss !== "undefined" && ss ? ss : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet && spreadsheet.getSheetByName(SHEET_NAMES.QA);
  if (!sheet) throw new Error("QA sheet not found");
  var lastRow = sheet.getLastRow();
  var existing = lastRow > 0 ? sheet.getRange(1, 1, lastRow, 1).getValues() : [];
  var idToRow = {};
  existing.forEach(function (row, index) {
    var record = qaKnowledgeParseRow_(row[0], index + 1);
    if (record && record.id) idToRow[record.id] = index + 1;
  });
  var appended = 0;
  var updated = 0;
  normalizedLines.forEach(function (item) {
    if (idToRow[item.id]) {
      sheet.getRange(idToRow[item.id], 1).setValue(item.line);
      updated++;
    } else {
      sheet.appendRow([item.line]);
      appended++;
    }
  });
  SpreadsheetApp.flush();
  qaKnowledgeRebuildCache_(qaKnowledgeReadSheetRows_(), CacheService.getScriptCache());
  return { appended: appended, updated: updated, total: normalizedLines.length };
}
