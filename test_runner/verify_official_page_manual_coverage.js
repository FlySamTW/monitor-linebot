const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const linebot = fs.readFileSync(path.join(root, "linebot.gs"), "utf8");
const testUi = fs.readFileSync(path.join(root, "TestUI.html"), "utf8");
const classRules = fs.readFileSync(path.join(root, "CLASS_RULES.csv"), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert(start >= 0, `找不到函式 ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} 大括號不完整`);
}

const rows = classRules.split(/\r?\n/).map((line) => [line]);
const hPdfIndex = [
  "S27H704",
  "S32HG802",
  "S32HG806",
  "S27HG806",
  "S27HG802",
  "S27HG612",
  "S27H802",
];
const buildKbItems = (models) =>
  models.map((model) => ({
    name: `${model}.pdf`,
    uri: `files/${model.toLowerCase()}`,
    mimeType: "application/pdf",
  }));
const properties = new Map([
  ["KB_URI_LIST", JSON.stringify(buildKbItems(hPdfIndex))],
]);
const cache = new Map();
const context = {
  console,
  Utilities: {
    DigestAlgorithm: { SHA_256: "SHA_256" },
    computeDigest: () => Array(32).fill(0),
  },
  GAS_VERSION: "vTEST",
  SHEET_NAMES: { CLASS_RULES: "CLASS_RULES" },
  CACHE_KEYS: {
    KB_URI_LIST: "KB_URI_LIST",
    MANUAL_PDF_KB_LIST: "MANUAL_PDF_KB_LIST",
    KB_URI_LIST_BACKUP: "KB_URI_LIST_BACKUP",
    PDF_MODEL_INDEX_BACKUP: "PDF_MODEL_INDEX_BACKUP",
  },
  ss: {
    getSheetByName() {
      return {
        getLastRow() {
          return rows.length;
        },
        getRange() {
          return { getValues: () => rows };
        },
      };
    },
  },
  CacheService: {
    getScriptCache() {
      return {
        get: (key) => cache.get(key) || null,
        put: (key, value) => cache.set(key, String(value)),
      };
    },
  },
  PropertiesService: {
    getScriptProperties() {
      return {
        getProperty: (key) => properties.get(key) || null,
      };
    },
  },
  writeLog() {},
  isIncompleteModelRuleLine_() {
    return false;
  },
};

const functions = [
  "bytesToHex_",
  "normalizeModelForDisplay",
  "dedupDisplayModels",
  "extractFullModelLikeTokens",
  "isShortAliasModelToken",
  "isFullSamsungMonitorModelForOfficialPage_",
  "isSafeSamsungTwOfficialUrl_",
  "normalizePdfModelToken_",
  "isPdfSalesSuffix_",
  "isPdfModelTokenMatch_",
  "getPdfFileModelTokens_",
  "isPdfKbFile",
  "isKnownUnsafeLegacySharedManual_",
  "normalizeManualEvidenceModel_",
  "manualEvidenceModelMatchesTarget_",
  "readOfficialManualManifest_",
  "getOfficialManualManifestEntryByFileName_",
  "enrichPdfKbItemWithOfficialProvenance_",
  "extractPdfModelIndexFromKbList",
  "getSamsungOfficialModelPage_",
  "resolveSamsungOfficialModelPage_",
  "isKnowledgeMissingReply_",
  "shouldOfferSamsungOfficialPage_",
  "buildSamsungOfficialPageQuickReply_",
  "extractManualCoverageRuleIdentity_",
  "readManualCoverageRuleIdentities_",
  "readPdfModelIndexForCoverage_",
  "buildManualCoverageReport_",
];
vm.runInNewContext(
  functions.map((name) => extractFunction(linebot, name)).join("\n\n"),
  context,
);

const parserFixtureStart = rows.length;
rows.push(
  [
    "術語_偽完整型號,model=S88H888AAA；definition_only=true；不得證明型號支援",
  ],
  ["系列_偽完整型號,model=S89H999BBB；不得證明型號支援"],
  ["能力_G8,model=G8；capabilities=系列能力不得納入"],
  ["能力_S88H888AAA,model=S89H999BBB；capabilities=key 與 model 錯配"],
);
const parsedCoverageModels = context
  .readManualCoverageRuleIdentities_()
  .map((identity) => identity.model);
rows.splice(parserFixtureStart);
assert(
  parsedCoverageModels.includes("S27H802EFA"),
  "能力_完整型號列的 model 必須納入手冊覆蓋統計",
);
assert(
  !parsedCoverageModels.includes("S88H888AAA") &&
    !parsedCoverageModels.includes("S89H999BBB") &&
    !parsedCoverageModels.includes("G8"),
  "術語、系列別稱與 key/model 錯配的能力列不得納入手冊覆蓋統計",
);

const explicitPage = context.getSamsungOfficialModelPage_("S27HG806EF");
assert(
  explicitPage &&
    explicitPage.source === "rule_pdp" &&
    /odyssey-g8-g80hf/i.test(explicitPage.uri),
  "RULE 有官網網址時必須直接使用該款 PDP",
);
const fallbackPage = context.getSamsungOfficialModelPage_("S32HG806ES");
assert(
  fallbackPage &&
    fallbackPage.source === "rule_support" &&
    /\/support\/model\/LS32HG806ESXZW\/$/i.test(fallbackPage.uri),
  "RULE 沒 PDP 網址時必須以同列完整料號建立官方支援頁",
);
assert.strictEqual(
  context.getSamsungOfficialModelPage_("G8"),
  null,
  "系列別稱不得產生單一機型官網連結",
);
assert.strictEqual(
  context.resolveSamsungOfficialModelPage_(
    "這個問題還有別的做法嗎？",
    null,
    ["S32HG806ES"],
    ["S32HG806ES"],
  ),
  null,
  "無型號的新題不得借 suggested/direct-search Cache 顯示上一款官網",
);
assert(
  context.resolveSamsungOfficialModelPage_(
    "S32HG806ES 的手冊還沒有直接證據",
    "S32HG806ES",
  ),
  "本題已明確解析完整型號時仍應提供該款官網",
);
assert(
  context.shouldOfferSamsungOfficialPage_("官方手冊未記載這項設定。"),
  "答案不足時應提供官網承接",
);
assert(
  !context.shouldOfferSamsungOfficialPage_("這款支援 4K 240Hz。"),
  "已完整回答時不得額外塞入官網按鈕",
);
const uriQuickReply = context.buildSamsungOfficialPageQuickReply_(explicitPage);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(uriQuickReply.action)),
  {
    type: "uri",
    label: "🔗 到這款官網",
    uri: explicitPage.uri,
  },
  "官網承接必須使用 LINE URI quick reply",
);

const officialDownloadUrl =
  "https://org.downloadcenter.samsung.com/downloadfile/ContentsFile.aspx?CDSite=UNI_TW&CDCttType=UM";
const discoveryVm = {
  manualPayload: [],
  writeLog() {},
  UrlFetchApp: {
    fetch() {
      return {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({ manuals: discoveryVm.manualPayload }),
      };
    },
  },
};
vm.runInNewContext(
  [
    "extractEmbeddedJsonArrayByKey_",
    "isSafeSamsungTwManualDownload_",
    "inferManualPackageTypeFromFileName_",
    "getValidatedOfficialManualPackageType_",
    "discoverOfficialTwManualCandidate_",
  ]
    .map((name) => extractFunction(linebot, name))
    .join("\n\n"),
  discoveryVm,
);
discoveryVm.manualPayload = [
  {
    contentsTypeCode: "UM",
    languageList: [{ orgCode: "ZH2", name: "Traditional Chinese" }],
    areaList: [{ code: "TW" }],
    fileName: "older-manual.pdf",
    fileID: "pdf-old",
    fileVersion: "1.0",
    fileModifiedDateCalendar: 20260101,
    downloadUrl: officialDownloadUrl,
  },
  {
    contentsTypeCode: "UM",
    languageList: [{ orgCode: "ZH2", name: "Traditional Chinese" }],
    areaList: [{ code: "TW" }],
    fileName: "latest-manual.zip",
    fileID: "zip-new",
    fileVersion: "2.0",
    fileModifiedDateCalendar: 20260201,
    downloadUrl: officialDownloadUrl,
  },
];
const zipCandidate = discoveryVm.discoverOfficialTwManualCandidate_({
  model: "LS49DG952SCXZW",
});
assert(zipCandidate && zipCandidate.packageType === "ZIP");
assert.strictEqual(zipCandidate.fileId, "zip-new");
discoveryVm.manualPayload = [discoveryVm.manualPayload[0]];
const pdfCandidate = discoveryVm.discoverOfficialTwManualCandidate_({
  model: "LS49DG952SCXZW",
});
assert(pdfCandidate && pdfCandidate.packageType === "PDF");
assert.strictEqual(pdfCandidate.selectedLanguage, "zh-TW");
assert.strictEqual(pdfCandidate.languageFallback, false);
discoveryVm.manualPayload = [
  {
    contentsTypeCode: "UM",
    languageList: [{ orgCode: "EN", name: "English" }],
    areaList: [{ code: "TW" }],
    fileName: "newer-english.pdf",
    fileID: "en-new",
    fileModifiedDateCalendar: 20260701,
    downloadUrl: officialDownloadUrl,
  },
  {
    contentsTypeCode: "UM",
    languageList: [{ orgCode: "ZH2", name: "Traditional Chinese" }],
    areaList: [{ code: "TW" }],
    fileName: "older-traditional-chinese.pdf",
    fileID: "zh-old",
    fileModifiedDateCalendar: 20260101,
    downloadUrl: officialDownloadUrl,
  },
];
const traditionalFirst = discoveryVm.discoverOfficialTwManualCandidate_({
  model: "LS24F332EACXZW",
});
assert.strictEqual(
  traditionalFirst.fileId,
  "zh-old",
  "官方繁中 UM 即使較舊仍必須優先於英文 UM",
);
discoveryVm.manualPayload = [discoveryVm.manualPayload[0]];
const englishFallback = discoveryVm.discoverOfficialTwManualCandidate_({
  model: "LS24F332EACXZW",
});
assert(englishFallback, "台灣支援頁沒有繁中 UM 時應採官方英文 UM");
assert.strictEqual(englishFallback.selectedLanguage, "en");
assert.strictEqual(englishFallback.languageFallback, true);
discoveryVm.manualPayload = [
  Object.assign({}, discoveryVm.manualPayload[0], {
    areaList: [{ code: "US" }],
  }),
];
assert.strictEqual(
  discoveryVm.discoverOfficialTwManualCandidate_({
    model: "LS24F332EACXZW",
  }),
  null,
  "英文 fallback 仍必須是台灣 area",
);

const pdfGateProperties = new Map();
const pdfGateVm = {
  CACHE_KEYS: {
    KB_URI_LIST: "KB_URI_LIST",
    KB_URI_LIST_BACKUP: "KB_URI_LIST_BACKUP",
    PDF_MODEL_INDEX_BACKUP: "PDF_MODEL_INDEX_BACKUP",
  },
  PropertiesService: {
    getScriptProperties() {
      return {
        setProperty: (key, value) => pdfGateProperties.set(key, String(value)),
      };
    },
  },
};
vm.runInNewContext(
  ["isPdfKbFile", "extractPdfModelIndexFromKbList", "persistPdfKbState"]
    .map((name) => extractFunction(linebot, name))
    .join("\n\n"),
  pdfGateVm,
);
const standardPdfBlob = {
  getBytes: () => [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31],
};
const disguisedZipBlob = {
  getBytes: () => [0x50, 0x4b, 0x03, 0x04, 0x01, 0x02],
};
assert.strictEqual(
  pdfGateVm.isPdfKbFile({
    name: "S49DG952.pdf",
    mimeType: "application/pdf",
    packageType: "PDF",
    blob: standardPdfBlob,
  }),
  true,
);
[
  { name: "S49DG952.zip", mimeType: "application/pdf", packageType: "ZIP" },
  { name: "S49DG952.pdf", mimeType: "application/zip", packageType: "PDF" },
  { name: "S49DG952.pdf", mimeType: "application/pdf", packageType: "ZIP" },
  {
    name: "S49DG952.pdf",
    mimeType: "application/pdf",
    packageType: "PDF",
    blob: disguisedZipBlob,
  },
].forEach((item) => assert.strictEqual(pdfGateVm.isPdfKbFile(item), false));
pdfGateVm.persistPdfKbState([
  { name: "S49DG952.pdf", uri: "files/valid", mimeType: "application/pdf" },
  { name: "renamed-zip.pdf", uri: "files/fake", mimeType: "application/pdf", blob: disguisedZipBlob },
  { name: "manual.zip", uri: "files/zip", mimeType: "application/pdf", packageType: "ZIP" },
  { name: "samsung_kb_priority.txt", uri: "files/text", mimeType: "text/plain" },
]);
const persistedKbNames = JSON.parse(pdfGateProperties.get("KB_URI_LIST")).map(
  (item) => item.name,
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(persistedKbNames)),
  ["S49DG952.pdf", "samsung_kb_priority.txt"],
  "active KB 必須排除 ZIP、MIME/副檔名不一致與偽裝 PDF",
);

const supportBindingVm = {};
vm.runInNewContext(
  [
    "normalizeModelForDisplay",
    "normalizeOfficialManualFileModelToken_",
    "isSafeSamsungTwManualDownload_",
    "isOfficialSupportPageBoundManualCandidate_",
    "normalizeOfficialManualFamilyPattern_",
    "buildOfficialSupportPageFamilyPatternFileName_",
  ]
    .map((name) => extractFunction(linebot, name))
    .join("\n\n"),
  supportBindingVm,
);
const boundCandidate = {
  fullSku: "LS32CM703UCXZW",
  supportUrl: "https://www.samsung.com/tw/support/model/LS32CM703UCXZW/",
  downloadUrl:
    "https://org.downloadcenter.samsung.com/downloadfile/ContentsFile.aspx?CDSite=UNI_TW&ModelName=S32CM703UC&CttFileID=11238283&CDCttType=UM",
};
assert.strictEqual(
  supportBindingVm.isOfficialSupportPageBoundManualCandidate_(boundCandidate),
  true,
  "第一頁未列型號時，只有支援頁 SKU 與 download ModelName 都一致才可建立共用手冊綁定",
);
assert.strictEqual(
  supportBindingVm.isOfficialSupportPageBoundManualCandidate_(
    Object.assign({}, boundCandidate, {
      downloadUrl: boundCandidate.downloadUrl.replace(
        "ModelName=S32CM703UC",
        "ModelName=S49DG952SC",
      ),
    }),
  ),
  false,
  "download ModelName 不一致必須 fail closed",
);
const familyPatternCandidate = {
  fullSku: "LS24F332EACXZW",
  supportUrl: "https://www.samsung.com/tw/support/model/LS24F332EACXZW/",
  downloadUrl:
    "https://org.downloadcenter.samsung.com/downloadfile/ContentsFile.aspx?CDSite=UNI_TW&ModelName=S24F332EAC&CttFileID=11512139&CDCttType=UM",
};
assert.strictEqual(
  supportBindingVm.buildOfficialSupportPageFamilyPatternFileName_(
    ["S24F33*", "S24F330EAE", "S24F330EAM"],
    familyPatternCandidate,
  ),
  "S24F332.pdf",
  "封面明示 S24F33* 且支援頁與 download ModelName 精確綁定時，可安全產生單型號檔名",
);
assert.strictEqual(
  supportBindingVm.buildOfficialSupportPageFamilyPatternFileName_(
    ["S24F33*"],
    Object.assign({}, familyPatternCandidate, {
      downloadUrl: familyPatternCandidate.downloadUrl.replace(
        "ModelName=S24F332EAC",
        "ModelName=S24F330EAE",
      ),
    }),
  ),
  "",
  "family wildcard 不得繞過 download ModelName 精確綁定",
);
assert.strictEqual(
  supportBindingVm.buildOfficialSupportPageFamilyPatternFileName_(
    ["S24F3*"],
    familyPatternCandidate,
  ),
  "",
  "過短家族 wildcard 必須 fail closed",
);
const firstPageValidationSource = extractFunction(
  linebot,
  "validateOfficialManualFirstPage_",
);
assert(
  /page1Models\.length === 0[\s\S]*isOfficialSupportPageBoundManualCandidate_\(candidate\)/.test(
    firstPageValidationSource,
  ) &&
    /modelBinding = "official_support_page"/.test(firstPageValidationSource) &&
    /exactModelInDocument = false/.test(firstPageValidationSource),
  "空白型號封面只可降級成 official_support_page 綁定，不得假裝型號出現在 PDF",
);
assert(
  /buildOfficialSupportPageFamilyPatternFileName_\([\s\S]*?modelBinding = "official_support_page_family_pattern"[\s\S]*?exactModelInDocument = false/.test(
    firstPageValidationSource,
  ),
  "family wildcard 只可降級成 official_support_page_family_pattern，不得假裝為精確封面型號",
);
assert(
  /S24F33\*[\s\S]*?保留 \* 原樣輸出/.test(firstPageValidationSource),
  "第一頁型號擷取必須保留官方 family wildcard",
);

let zipDownloadFetchCount = 0;
const zipStageVm = {
  CONFIG: { DRIVE_FOLDER_ID: "" },
  discoverOfficialTwManualCandidate_() {
    return Object.assign({}, zipCandidate);
  },
  UrlFetchApp: {
    fetch() {
      zipDownloadFetchCount += 1;
      throw new Error("ZIP 不得由 GAS 下載");
    },
  },
  writeLog() {},
};
vm.runInNewContext(
  [
    "inferManualPackageTypeFromFileName_",
    "getValidatedOfficialManualPackageType_",
    "stageOfficialTwManualCandidate_",
  ]
    .map((name) => extractFunction(linebot, name))
    .join("\n\n"),
  zipStageVm,
);
const stagedZip = zipStageVm.stageOfficialTwManualCandidate_({
  model: "LS49DG952SCXZW",
});
assert.strictEqual(zipDownloadFetchCount, 0);
assert.strictEqual(stagedZip.manualStatus, "PENDING_OFFLINE_INGEST");
assert.strictEqual(stagedZip.packageType, "ZIP");
assert.strictEqual(stagedZip.offlineIngestRequired, true);
zipStageVm.discoverOfficialTwManualCandidate_ = () =>
  Object.assign({}, zipCandidate, { packageType: "PDF" });
const mismatchedCandidate = zipStageVm.stageOfficialTwManualCandidate_({
  model: "LS49DG952SCXZW",
});
assert.strictEqual(mismatchedCandidate, null);
assert.strictEqual(zipDownloadFetchCount, 0, "格式不一致的候選不得發出下載請求");
zipStageVm.discoverOfficialTwManualCandidate_ = () => {
  const missingType = Object.assign({}, zipCandidate);
  delete missingType.packageType;
  return missingType;
};
assert.strictEqual(
  zipStageVm.stageOfficialTwManualCandidate_({ model: "LS49DG952SCXZW" }),
  null,
  "packageType 缺失時不得默認為 PDF 或 ZIP",
);
assert.strictEqual(zipDownloadFetchCount, 0);
assert(
  !/PDF_MODEL_INDEX/.test(
    extractFunction(linebot, "stageOfficialTwManualCandidate_"),
  ),
  "ZIP 候選只能留下離線匯入 metadata，不得污染正式 PDF 索引",
);

const auditProperties = new Map([
  ["OFFICIAL_MANUAL_AUDIT_CURSOR", "0"],
  ["OFFICIAL_MANUAL_MANIFEST", "{}"],
]);
let pdfStageCount = 0;
let fakeBaselineCount = 0;
const updateAuditVm = {
  PropertiesService: {
    getScriptProperties() {
      return {
        getProperty: (key) => auditProperties.get(key) || null,
        setProperty: (key, value) => auditProperties.set(key, String(value)),
      };
    },
  },
  discoverOfficialTwManualCandidate_() {
    return Object.assign({}, pdfCandidate);
  },
  normalizeModelForDisplay: (model) =>
    String(model).replace(/^LS/, "S").replace(/XZW$/, ""),
  hasOfficialManualForModel_: () => true,
  persistOfficialManualManifest_() {
    fakeBaselineCount += 1;
  },
  stageOfficialTwManualCandidate_(product, candidate) {
    pdfStageCount += 1;
    assert(candidate && candidate.packageType === "PDF");
    return { action: "UPDATED", model: product.model };
  },
};
vm.runInNewContext(
  [
    "inferManualPackageTypeFromFileName_",
    "getValidatedOfficialManualPackageType_",
    "auditOneOfficialManualUpdate_",
  ]
    .map((name) => extractFunction(linebot, name))
    .join("\n\n"),
  updateAuditVm,
);
const auditedPdf = updateAuditVm.auditOneOfficialManualUpdate_(
  [{ model: "LS49DG952SCXZW" }],
  ["LS49DG952SCXZW,型號：S49DG952SC"],
);
assert.strictEqual(auditedPdf.action, "UPDATED");
assert.strictEqual(pdfStageCount, 1);
assert.strictEqual(fakeBaselineCount, 0);
assert(
  !/persistOfficialManualManifest_\([\s\S]{0,180}BASELINED_EXISTING/.test(
    extractFunction(linebot, "auditOneOfficialManualUpdate_"),
  ) &&
    !/hasOfficialManualForModel_/.test(
      extractFunction(linebot, "auditOneOfficialManualUpdate_"),
    ),
  "既有 PDF 索引不等於官網最新版；未知舊檔必須實際驗證，不得假基準化",
);

const scanProperties = new Map([["PENDING_MODEL_REVIEW", "[]"]]);
const scanRows = [["header"], ["LS49DG952SCXZW,型號：S49DG952SC"]];
const scanVm = {
  SHEET_NAMES: { CLASS_RULES: "CLASS_RULES" },
  writeLog() {},
  isIncompleteModelRuleLine_: () => false,
  stageOfficialTwManualCandidate_() {
    throw new Error("沒有新機型時不應走新品下載");
  },
  buildOfficialMinimalRuleLine_: () => "",
  auditOneOfficialManualUpdate_() {
    return Object.assign({}, zipCandidate, {
      manualStatus: "PENDING_OFFLINE_INGEST",
      offlineIngestRequired: true,
    });
  },
  UrlFetchApp: {
    fetch() {
      return {
        getResponseCode: () => 200,
        getContentText: () =>
          JSON.stringify({
            response: {
              resultData: {
                productList: [
                  {
                    modelList: [
                      {
                        modelCode: "LS49DG952SCXZW",
                        pdpUrl: "/tw/monitors/gaming/example/",
                        displayName: "Odyssey OLED G9",
                      },
                    ],
                  },
                ],
              },
            },
          }),
      };
    },
  },
  SpreadsheetApp: {
    getActiveSpreadsheet() {
      return {
        getSheetByName() {
          return {
            getLastRow: () => scanRows.length,
            getRange() {
              return {
                getValues: () => scanRows.slice(1),
                setValues() {},
              };
            },
          };
        },
      };
    },
  },
  PropertiesService: {
    getScriptProperties() {
      return {
        getProperty: (key) => scanProperties.get(key) || null,
        setProperty: (key, value) => scanProperties.set(key, String(value)),
      };
    },
  },
};
vm.runInNewContext(
  extractFunction(linebot, "scanOfficialWebsiteForNewMonitors"),
  scanVm,
);
const scanResult = scanVm.scanOfficialWebsiteForNewMonitors();
assert.strictEqual(scanResult.success, true);
assert.strictEqual(scanResult.newCount, 0);
const persistedPending = JSON.parse(
  scanProperties.get("PENDING_MODEL_REVIEW") || "[]",
);
assert(
  persistedPending.some(
    (item) =>
      item.model === "LS49DG952SCXZW" &&
      item.manualStatus === "PENDING_OFFLINE_INGEST" &&
      item.packageType === "ZIP",
  ),
  "既有機型的 ZIP 更新候選也必須寫入 PENDING_MODEL_REVIEW",
);

properties.set(
  "KB_URI_LIST",
  JSON.stringify(
    buildKbItems(hPdfIndex.filter((model) => model !== "S27H802")),
  ),
);
const abilityOnlyMissingCoverage = context.buildManualCoverageReport_();
assert(
  abilityOnlyMissingCoverage.currentGenerationMissingModels.includes(
    "S27H802EFA",
  ),
  "能力列的完整型號缺少 PDF 時必須成為手冊覆蓋缺口",
);
properties.set("KB_URI_LIST", JSON.stringify(buildKbItems(hPdfIndex)));
const coverage = context.buildManualCoverageReport_();
assert.strictEqual(coverage.currentGenerationModelCount, 7);
assert.strictEqual(coverage.currentGenerationMissingCount, 0);
assert(
  coverage.currentGenerationModels.includes("S27H802EFA"),
  "S27H802EFA 只有能力列時仍須出現在 H 世代手冊覆蓋報表",
);
properties.set(
  "PENDING_MODEL_REVIEW",
  JSON.stringify([{ model: "LS32ZZ999XZW", manualStatus: "AUTO_VALIDATION_RETRY" }]),
);
const retryCoverage = context.buildManualCoverageReport_();
assert.strictEqual(retryCoverage.autoImportRetryCount, 1);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(retryCoverage.autoImportRetryModels)),
  ["LS32ZZ999XZW"],
  "自動驗證失敗須顯示為系統重試，不要求管理員手動搬檔",
);
properties.set(
  "PENDING_MODEL_REVIEW",
  JSON.stringify([
    { model: "LS32ZZ999XZW", manualStatus: "AUTO_VALIDATION_RETRY" },
    {
      model: "LS49DG952SCXZW",
      manualStatus: "PENDING_OFFLINE_INGEST",
      packageType: "ZIP",
    },
  ]),
);
const zipPendingCoverage = context.buildManualCoverageReport_();
assert.strictEqual(zipPendingCoverage.offlineZipPendingCount, 1);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(zipPendingCoverage.offlineZipPendingModels)),
  ["LS49DG952SCXZW"],
  "覆蓋報表必須明列待離線解壓匯入的官方 ZIP 手冊",
);
properties.delete("PENDING_MODEL_REVIEW");
properties.set(
  "KB_URI_LIST",
  JSON.stringify(
    buildKbItems(hPdfIndex.filter((model) => model !== "S27HG806")),
  ),
);
const missingCoverage = context.buildManualCoverageReport_();
assert(
  missingCoverage.currentGenerationMissingModels.includes("S27HG806EF"),
  "2026 RULE 有型號但 PDF 索引缺少時必須出現在報表",
);
properties.delete("KB_URI_LIST");
properties.delete("MANUAL_PDF_KB_LIST");
properties.delete("KB_URI_LIST_BACKUP");
const unavailableCoverage = context.buildManualCoverageReport_();
assert.strictEqual(unavailableCoverage.status, "INDEX_UNAVAILABLE");
assert.strictEqual(unavailableCoverage.currentGenerationMissingCount, null);
assert(
  Array.isArray(unavailableCoverage.currentGenerationMissingModels) &&
    unavailableCoverage.currentGenerationMissingModels.length === 0,
  "索引不可用不得把所有 2026 型號誤報為缺手冊",
);

const dailyFunction = extractFunction(linebot, "dailyKnowledgeRefresh");
const syncFunction = extractFunction(linebot, "syncGeminiKnowledgeBase");
assert(
  /refreshManualPdfUriBatch_\(10\)[\s\S]*syncGeminiKnowledgeBase\(false\)[\s\S]*auditManualCoverageGaps_\(\)/.test(
    dailyFunction,
  ) &&
    /function manualPdfRollingRefresh/.test(linebot) &&
    /everyHours\(4\)/.test(linebot) &&
    /file_api_rolling_refresh/.test(linebot) &&
    /fileApiUploadedAt/.test(syncFunction),
  "每日 04:00 必須做增量同步與缺口稽核；Files URI 另以 4 小時輪替續期，不得單次重傳整庫",
);
assert(
  /const drivePdfCatalogItem\s*=\s*\{[\s\S]*?identity:\s*fileIdentity[\s\S]*?drivePdfCatalog\.push\(drivePdfCatalogItem\)/.test(
    syncFunction,
  ) &&
    /duplicateDrivePdfNames\.push\(fileName\)/.test(syncFunction) &&
    /hasDriveScanFailure && hasPdfInFallback/.test(syncFunction) &&
    /hasPartialDriveUploadFailure && hasPdfInNewKbList/.test(syncFunction) &&
    /partial_merged_with_previous/.test(syncFunction) &&
    /fallbackPdfByName\[upperName\]/.test(syncFunction) &&
    /extractPdfModelIndexFromKbList\(kbListToPersist\)/.test(
      syncFunction,
    ) &&
    /const shouldPersistPdfState[\s\S]{0,400}!hasDriveScanFailure/.test(
      syncFunction,
    ) &&
    /const shouldRefreshPdfBackups[\s\S]{0,400}!hasIncompleteDriveSync/.test(
      syncFunction,
    ) &&
    /if \(hasDriveScanFailure \|\| failedCount > 0\)[\s\S]{0,600}scheduleImmediateRebuild\(\)/.test(
      syncFunction,
    ) &&
    /知識庫同步未完整，已保留前次狀態並排程重試/.test(syncFunction),
  "PDF 部分失敗只沿用失敗檔舊 URI；Drive 掃描未完整才保留全舊狀態，且兩者都必須受控背景重試",
);
assert(
  /manualCoverage === "1"[\s\S]{0,220}isDoGetMaintenanceAuthorized_/.test(
    linebot,
  ),
  "手冊覆蓋端點必須受維護憑證保護",
);
assert(
  /manual-coverage-badge/.test(testUi) &&
    /action\.type === "uri"/.test(testUi) &&
    /res\.quickReplies/.test(testUi) &&
    /control\.target = "_top"/.test(testUi) &&
    /report\.status !== "OK"[\s\S]{0,220}手冊覆蓋：待檢查/.test(testUi) &&
    /手冊自動重試/.test(testUi) &&
    /不需要手動搬檔/.test(testUi),
  "TestUI 必須顯示維護覆蓋狀態，並讓 Apps Script sandbox 內的 URI quick reply 可實際開啟",
);

const targetedRefreshSource = extractFunction(
  linebot,
  "refreshStalePdfAttachmentsFromDrive_",
);
const testUiAuditSource = extractFunction(
  linebot,
  "auditOfficialManualSkuFromTestUi",
);
const manualAuditCoreSource = extractFunction(
  linebot,
  "auditOfficialManualSkuMaintenance_",
);
const reviewedAliasSource = extractFunction(
  linebot,
  "registerReviewedOfficialManualAliasFromTestUi",
);
const reviewedAliasCoreSource = extractFunction(
  linebot,
  "registerReviewedOfficialManualAliasMaintenance_",
);
const doPostSource = extractFunction(linebot, "doPost");
const manualMaintenanceStart = doPostSource.indexOf(
  'json.action === "audit_official_manual_sku"',
);
const manualMaintenanceEnd = doPostSource.indexOf(
  'json.action === "upload_manual_pdf"',
  manualMaintenanceStart,
);
const manualMaintenancePostSection = doPostSource.slice(
  manualMaintenanceStart,
  manualMaintenanceEnd,
);
assert(
  /assertEditorOnlyTestUiMaintenance_\(testUiAccessToken\)/.test(
    testUiAuditSource,
  ) &&
    /auditOfficialManualSkuMaintenance_\(fullSku\)/.test(testUiAuditSource) &&
    /discoverOfficialTwManualCandidate_\(product\)/.test(
      manualAuditCoreSource,
    ) &&
    /stageOfficialTwManualCandidate_\(product, candidate\)/.test(
      manualAuditCoreSource,
    ),
  "單 SKU 手冊查核只能從已授權 /dev TestUI 執行，並且必須走官網 discovery/stage 同一套守門",
);
assert(
  /assertEditorOnlyTestUiMaintenance_\(testUiAccessToken\)/.test(
    reviewedAliasSource,
  ) &&
    /registerReviewedOfficialManualAliasMaintenance_\(payload\)/.test(
      reviewedAliasSource,
    ) &&
    /isOfficialSupportPageBoundManualCandidate_\(candidate\)/.test(
      reviewedAliasCoreSource,
    ) &&
    /actualSha256 !== expectedSha256/.test(reviewedAliasCoreSource) &&
    /upsertManualPdfToGemini_\(finalFileName, bytes, true\)/.test(
      reviewedAliasCoreSource,
    ) &&
    /exactModelInDocument:\s*false/.test(reviewedAliasCoreSource) &&
    !/(?:setTrashed|removeFile|deleteFile)/.test(reviewedAliasCoreSource),
  "離線擷取手冊建 alias 前必須核對官方 SKU 與 SHA，只上傳 Gemini，不刪舊 Drive 檔",
);
assert(
  manualMaintenanceStart >= 0 &&
    manualMaintenanceEnd > manualMaintenanceStart &&
    /json\.secret !== authKey/.test(manualMaintenancePostSection) &&
    /auditOfficialManualSkuMaintenance_\(json\.fullSku\)/.test(
      manualMaintenancePostSection,
    ) &&
    /registerReviewedOfficialManualAliasMaintenance_\(json\.manual \|\| json\)/.test(
      manualMaintenancePostSection,
    ),
  "正式手冊維護 POST 必須受維護憑證保護，且只能呼叫同一套已驗證核心",
);
assert(
  /driveSourceFileName/.test(targetedRefreshSource) &&
    /file_api_reviewed_alias_refresh/.test(targetedRefreshSource) &&
    /packageType \|\| ""\)\.toUpperCase\(\) !== "PDF"/.test(
      targetedRefreshSource,
    ) &&
    /file_api_official_download_refresh/.test(targetedRefreshSource) &&
    /actualSha !== expectedSha/.test(targetedRefreshSource),
  "單型號 alias 與官網直接 PDF 在 URI 過期時必須可依 manifest 自癒，ZIP 不得當 PDF 重傳",
);

console.log("PASS: 官網承接與 RULE/PDF 缺口契約");
