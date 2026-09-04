const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const linebot = fs.readFileSync(path.join(root, "linebot.gs"), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert(start >= 0, `找不到函式 ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`函式 ${name} 不完整`);
}

const sha = "A".repeat(64);
const manifest = {
  LS49DG952SCXZW: {
    finalFileName: "S49DG952.pdf",
    sha256: sha,
    modelBinding: "official_support_page_archive_entry",
    exactModelInDocument: false,
  },
  LS24F332EACXZW: {
    finalFileName: "S24F332.pdf",
    sha256: sha,
    modelBinding: "official_support_page_family_pattern",
    exactModelInDocument: false,
  },
};

const context = {
  writeLog: () => {},
  Utilities: {
    DigestAlgorithm: { SHA_256: "SHA_256" },
    computeDigest: () => Array(32).fill(0xaa),
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (key) =>
        key === "OFFICIAL_MANUAL_MANIFEST" ? JSON.stringify(manifest) : "",
    }),
  },
  escapeRegExp: (value) =>
    String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  extractFullModelLikeTokens: (value) =>
    String(value || "").match(/\b(?:LS)?S\d{2}[A-Z0-9]{4,16}\b/gi) || [],
  getAllExplicitCapabilityChecks_: (question) => {
    const checks = [];
    if (/CORE\s*SYNC/i.test(question)) {
      checks.push({ label: "CoreSync", evidence: /CORE\s*SYNC/i });
    }
    return checks;
  },
  getExplicitCapabilityCheck_: (question) => {
    if (/CORE\s*SYNC/i.test(question)) {
      return { label: "CoreSync", evidence: /CORE\s*SYNC/i };
    }
    return null;
  },
  findExactModelRuleLine_: (model) =>
    /S49DG952/i.test(model)
      ? "能力_S49DG952SC,model=S49DG952SC；capabilities=CoreSync"
      : "",
  getGroundedModelIdentityProfile_: (model) =>
    /S49DG952/i.test(model)
      ? { familyKind: "odyssey", familyAlias: "G9" }
      : { familyKind: "", familyAlias: "" },
  findLocalMatchInQA: () => null,
};
vm.createContext(context);

[
  "bytesToHex_",
  "normalizePdfModelToken_",
  "isPdfSalesSuffix_",
  "isPdfModelTokenMatch_",
  "getPdfFileModelTokens_",
  "isPdfKbFile",
  "isKnownUnsafeLegacySharedManual_",
  "readOfficialManualManifest_",
  "getOfficialManualManifestEntryByFileName_",
  "normalizeManualEvidenceModel_",
  "getManualEvidenceRegionalBase_",
  "extractManualEvidenceModels_",
  "manualEvidenceModelMatchesTarget_",
  "getManualAttachmentProvenance_",
  "manualEvidenceExplicitlyTargetsModel_",
  "isModelIndependentManualOperation_",
  "buildManualNamedFeatureCheck_",
  "getManualFeatureChecks_",
  "exactQaEvidenceSupportsManualFeature_",
  "manualLocalEvidenceSupportsFeature_",
  "manualEvidenceAllowedByAttachmentProvenance_",
  "manualEvidenceHasModelApplicabilityCaveat_",
  "manualEvidenceNamedFamilyMatchesTarget_",
  "getManualEvidenceScopeText_",
  "manualEvidenceSupportsTargetModel_",
  "manualSupportedAnswerTargetsModel_",
  "isGenericManualInputTargetBinding_",
  "isManualActionPathQuestion_",
  "isDirectManualActionEvidence_",
  "isExplicitManualAlternativeAnswer_",
  "manualEvidenceRelationMatchesExcerpt_",
  "manualSupportedAnswerMatchesExcerpt_",
  "manualAnswerCoversQuestionFeatures_",
  "selectManualEvidenceForQuestion_",
  "normalizeManualStructuredResponse_",
  "enrichPdfKbItemWithOfficialProvenance_",
].forEach((name) => vm.runInContext(extractFunction(linebot, name), context));

const supportPageOnlyMissingHash =
  context.enrichPdfKbItemWithOfficialProvenance_({
    name: "S49DG952.pdf",
    uri: "files/g95sd",
    mimeType: "application/pdf",
  });
assert.strictEqual(
  supportPageOnlyMissingHash,
  null,
  "support-page-only URI 缺 manifest SHA 核對資訊時不得進入正式 KB",
);
const supportPageOnlyVerified = context.enrichPdfKbItemWithOfficialProvenance_(
  {
    name: "S49DG952.pdf",
    uri: "files/g95sd",
    mimeType: "application/pdf",
  },
  { getBytes: () => [1, 2, 3] },
);
assert.strictEqual(
  supportPageOnlyVerified.officialSha256,
  sha,
  "從本輪 PDF bytes 驗證後必須把 officialSha256 寫回 URI metadata",
);
assert.strictEqual(
  context.enrichPdfKbItemWithOfficialProvenance_({
    name: "S49DG952.pdf",
    uri: "files/g95sd",
    mimeType: "application/pdf",
    officialSha256: "B".repeat(64),
  }),
  null,
  "已保存 SHA 與 manifest 不符時必須 fail closed",
);
assert.strictEqual(
  context.enrichPdfKbItemWithOfficialProvenance_(
    {
      name: "S32CM703,S49DG952.pdf",
      uri: "files/legacy-shared",
      mimeType: "application/pdf",
    },
    null,
    null,
    ["S49DG952SC"],
  ),
  null,
  "known-unsafe 舊共用檔即使只剩 G95SD 候選也不得靠檔名掛載",
);

const provenance = context.getManualAttachmentProvenance_(
  [{ name: "S49DG952.pdf", sha256: sha, mimeType: "application/pdf" }],
  "S49DG952SC",
);
assert.strictEqual(provenance.found, true, "應命中目標型號與正式檔名的 manifest");
assert.strictEqual(
  provenance.supportPageOnly,
  true,
  "exactModelInDocument=false 必須進入 support-page-only 守門",
);
assert.strictEqual(
  provenance.entries[0].hashVerifiedAgainstAttachment,
  true,
  "掛載檔雜湊與 manifest 一致時應留下可稽核訊號",
);

function normalize(evidence, question, state = provenance) {
  const normalizedEvidence = Object.assign(
    {
      pageHeading: "Odyssey G9",
      applicabilityExcerpt: "",
    },
    evidence,
  );
  return context.normalizeManualStructuredResponse_(
    JSON.stringify({
      found: true,
      coverage: "full",
      unresolvedQuestion: "",
      notFoundReason: "",
      evidence: [normalizedEvidence],
    }),
    "S49DG952SC",
    question,
    state,
  );
}

const croppedCaveat = normalize(
  {
    supportedAnswer:
      "到 遊戲 → Core Lighting 開啟機背 LED 照明。",
    pageNumber: 115,
    scope: "全檔共通",
    evidenceExcerpt:
      "遊戲 → Core Lighting；開啟或關閉產品正面和背面的 LED 照明。",
  },
  "Core Lighting 在哪裡開？",
);
assert(
  /MANUAL_EVIDENCE_VALIDATION_ERROR/.test(croppedCaveat),
  "即使模型裁掉「依型號可能不支援」，support-page-only 泛用段落也不得證明 Core Lighting 存在",
);

const ruleBackedPath = normalize(
  {
    supportedAnswer: "到 遊戲 → CoreSync 開啟機背燈效。",
    pageNumber: 115,
    scope: "全檔共通",
    evidenceExcerpt: "遊戲 → CoreSync；開啟或關閉機背燈效。",
  },
  "CoreSync 在哪裡開？",
);
assert(
  /CoreSync/.test(ruleBackedPath) &&
    !/MANUAL_EVIDENCE_VALIDATION_ERROR/.test(ruleBackedPath),
  "精確型號 RULE 已證明 CoreSync 時，可用共用手冊補實際路徑",
);

const generalReset = normalize(
  {
    supportedAnswer: "到 一般與隱私權 → 重設。",
    pageNumber: 180,
    scope: "全檔共通",
    evidenceExcerpt: "一般與隱私權 → 重設；將所有設定恢復為出廠預設值。",
  },
  "如何恢復出廠設定？",
);
assert(
  /重設/.test(generalReset) &&
    !/MANUAL_EVIDENCE_VALIDATION_ERROR/.test(generalReset),
  "一般原廠重設等非選配通用操作應可使用共用手冊",
);

const s24FamilyPatternProvenance = context.getManualAttachmentProvenance_(
  [{ name: "S24F332.pdf", sha256: sha, mimeType: "application/pdf" }],
  "S24F332EAC",
);
assert.strictEqual(
  s24FamilyPatternProvenance.entries[0].modelBinding,
  "official_support_page_family_pattern",
  "封面單碼 wildcard 通過官方 SKU、download ModelName 與 SHA 守門後，必須保留 family-pattern provenance",
);
assert.strictEqual(
  context.isModelIndependentManualOperation_(
    "S24F332EAC 要怎麼重設所有設定？",
  ),
  true,
  "「重設所有設定」與「恢復出廠設定」是同一類非選配通用操作，不得因措辭不同誤殺證據",
);
assert.strictEqual(
  context.isModelIndependentManualOperation_(
    "S24F332EAC 要怎麼把螢幕設定全部重設？",
  ),
  true,
  "全部設定與重設動作的中文詞序不得影響通用操作判定",
);
const s24ResetAll = context.normalizeManualStructuredResponse_(
  JSON.stringify({
    found: true,
    coverage: "full",
    unresolvedQuestion: "",
    notFoundReason: "",
    evidence: [
      {
        supportedAnswer: "到 Support → Reset All，就能把所有設定恢復成出廠預設值。",
        pageNumber: 22,
        scope: "全檔共通",
        evidenceExcerpt:
          "Support / Reset All / Return all the settings for the product to the default factory settings.",
        pageHeading: "Support",
        applicabilityExcerpt: "",
      },
    ],
  }),
  "S24F332EAC",
  "S24F332EAC 要怎麼重設所有設定？",
  s24FamilyPatternProvenance,
);
assert(
  /Reset All/.test(s24ResetAll) &&
    !/MANUAL_EVIDENCE_VALIDATION_ERROR/.test(s24ResetAll),
  "安全 family wildcard 手冊內的 Reset All 共通操作證據應通過，不得回 provenance=0",
);

const s24OptionalFeature = context.normalizeManualStructuredResponse_(
  JSON.stringify({
    found: true,
    coverage: "full",
    unresolvedQuestion: "",
    notFoundReason: "",
    evidence: [
      {
        supportedAnswer: "到 Picture → Eye Saver Mode 開啟護眼模式。",
        pageNumber: 20,
        scope: "全檔共通",
        evidenceExcerpt: "Picture / Eye Saver Mode / Set to an optimum picture quality suitable for eye relaxation.",
        pageHeading: "Picture",
        applicabilityExcerpt: "",
      },
    ],
  }),
  "S24F332EAC",
  "S24F332EAC 的 Eye Saver Mode 在哪裡開？",
  s24FamilyPatternProvenance,
);
assert(
  /MANUAL_EVIDENCE_VALIDATION_ERROR/.test(s24OptionalFeature),
  "family wildcard 不能被整體放寬；未有精確 RULE／QA 的選配功能仍須 fail closed",
);

const hashMismatch = context.getManualAttachmentProvenance_(
  [{ name: "S49DG952.pdf", sha256: "B".repeat(64) }],
  "S49DG952SC",
);
assert.strictEqual(hashMismatch.hashMismatch, true, "掛載檔與 manifest SHA 不符必須失敗封閉");
const mismatchedResult = normalize(
  {
    supportedAnswer: "到 一般與隱私權 → 重設。",
    pageNumber: 180,
    scope: "全檔共通",
    evidenceExcerpt: "一般與隱私權 → 重設；恢復出廠預設值。",
  },
  "如何恢復出廠設定？",
  hashMismatch,
);
assert(
  /MANUAL_EVIDENCE_VALIDATION_ERROR/.test(mismatchedResult),
  "SHA 不符時即使是通用操作也不得使用該 PDF",
);

const missingHash = context.getManualAttachmentProvenance_(
  [{ name: "S49DG952.pdf", mimeType: "application/pdf" }],
  "S49DG952SC",
);
assert.strictEqual(missingHash.hashMissing, true, "support-page-only 附件缺 SHA 時必須可辨識");
const missingHashResult = normalize(
  {
    supportedAnswer: "到 一般與隱私權 → 重設。",
    pageNumber: 180,
    scope: "全檔共通",
    evidenceExcerpt: "一般與隱私權 → 重設；恢復出廠預設值。",
  },
  "如何恢復出廠設定？",
  missingHash,
);
assert(
  /MANUAL_EVIDENCE_VALIDATION_ERROR/.test(missingHashResult),
  "support-page-only 手冊未能與 manifest SHA 核對時必須 fail closed",
);

assert(
  /getManualAttachmentProvenance_\(filesToAttach, targetModelName\)/.test(linebot) &&
    /normalizeManualStructuredResponse_\([\s\S]{0,180}manualAttachmentProvenance/.test(
      linebot,
    ),
  "callLLMWithRetry 必須把本輪掛載檔 provenance 傳給結構化 Evidence Guard",
);

[
  "recoverRelevantPdfUrisFromDrive",
  "refreshManualPdfUriBatch_",
  "syncGeminiKnowledgeBase",
  "readPdfModelIndexForCoverage_",
  "enforcePdfAttachmentModelScope_",
].forEach((name) => {
  assert(
    /enrichPdfKbItemWithOfficialProvenance_/.test(extractFunction(linebot, name)),
    `${name} 必須共用同一個 PDF provenance helper`,
  );
});
assert(
  /extractPdfModelIndexFromKbList\(kbListToPersist\)/.test(
    extractFunction(linebot, "syncGeminiKnowledgeBase"),
  ),
  "完整同步的 PDF coverage 只能來自實際可掛載且 provenance 通過的 KB 清單",
);

console.log("Manual provenance guard contract passed");
