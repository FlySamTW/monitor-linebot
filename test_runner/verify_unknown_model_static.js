const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const linebot = fs.readFileSync(path.join(root, "linebot.gs"), "utf8");

function assertStep(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function extractFunction(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assertStep(start >= 0, `${functionName} not found`);
  const braceStart = source.indexOf("{", start);
  assertStep(braceStart > start, `${functionName} opening brace not found`);
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    if (depth === 0) {
      return source.slice(start, i + 1);
    }
  }
  throw new Error(`${functionName} closing brace not found`);
}

const guardIndex = linebot.indexOf("[Unknown Model Guard v29.5.283]");
const scopeGuardIndex = linebot.indexOf("[Scope Guard v29.5.156]");
const timelyGuardIndex = linebot.indexOf("[Force Web Intent v29.5.156]");
const priceGuardIndex = linebot.indexOf("[Price Guard v29.5.157]");
const firstLlmIndex = linebot.indexOf("callLLMWithRetry", linebot.indexOf("function handleMessage"));
assertStep(guardIndex > 0, "unknown model guard log marker must exist");
assertStep(scopeGuardIndex > 0, "scope guard marker must exist");
assertStep(timelyGuardIndex > 0, "timely web-info guard marker must exist");
assertStep(priceGuardIndex > 0, "price guard marker must exist");
assertStep(
  scopeGuardIndex < guardIndex &&
    timelyGuardIndex < guardIndex &&
    priceGuardIndex < guardIndex,
  "scope/timely/price guards must run before unknown full-model validation",
);
assertStep(
  firstLlmIndex > guardIndex,
  "unknown full model guard must run before the first LLM call in handleMessage",
);

const code = [
  `
  const CACHE_KEYS = {
    KEYWORD_MAP: "keyword_map_v1",
    PDF_MODEL_INDEX_BACKUP: "pdf_model_index_backup_v1",
    KB_URI_LIST: "kb_list_v15_0",
    KB_URI_LIST_BACKUP: "kb_list_v15_0_backup"
  };
  const knownData = JSON.stringify({
    M7: "Smart Monitor M7 S32FM703UC S32FM702UC LS32FM703UCXZW",
    G8: "Odyssey OLED G8 S32DG802SC S32FG812SC LS32DG802SCXZW",
    S9: "ViewFinity S9 S27C900PAC LS27C900PACXZW"
  });
  const PropertiesService = {
    getScriptProperties() {
      return {
        getProperty(key) {
          if (
            key === CACHE_KEYS.KEYWORD_MAP ||
            key === "PDF_MODEL_INDEX" ||
            key === CACHE_KEYS.PDF_MODEL_INDEX_BACKUP ||
            key === CACHE_KEYS.KB_URI_LIST ||
            key === CACHE_KEYS.KB_URI_LIST_BACKUP
          ) {
            return knownData;
          }
          return "";
        }
      };
    }
  };
  `,
  extractFunction(linebot, "isShortAliasModelToken"),
  extractFunction(linebot, "normalizeModelForDisplay"),
  extractFunction(linebot, "dedupDisplayModels"),
  extractFunction(linebot, "extractFullModelLikeTokens"),
  extractFunction(linebot, "getKnownModelSearchText"),
  extractFunction(linebot, "buildModelLookupVariants"),
  extractFunction(linebot, "isKnownFullModelToken"),
  extractFunction(linebot, "getUnknownFullModelTokens"),
  extractFunction(linebot, "buildUnknownFullModelReply"),
  `
  globalThis.__unknownModelResult = {
    extractedUnknown: extractFullModelLikeTokens("S32FD812 有耳機孔嗎？規格是什麼？"),
    extractedAlias: extractFullModelLikeTokens("M7 有 SmartThings Hub 嗎？"),
    unknown: getUnknownFullModelTokens("S32FD812 有耳機孔嗎？規格是什麼？"),
    knownS: getUnknownFullModelTokens("S32DG802SC 有耳機孔嗎？"),
    knownLs: getUnknownFullModelTokens("LS27C900PACXZW 可以接 Thunderbolt 4 嗎？"),
    reply: buildUnknownFullModelReply(["S32FD812"])
  };
  `,
].join("\n\n");

const context = {};
vm.createContext(context);
vm.runInContext(code, context);

const result = context.__unknownModelResult;

assertStep(
  JSON.stringify(result.extractedUnknown) === JSON.stringify(["S32FD812"]),
  "full unknown model token should be extracted",
);
assertStep(
  JSON.stringify(result.extractedAlias) === JSON.stringify([]),
  "short aliases like M7 must not be treated as unknown full model tokens",
);
assertStep(
  JSON.stringify(result.unknown) === JSON.stringify(["S32FD812"]),
  "unknown full model should be rejected when it is not in project indexes",
);
assertStep(
  JSON.stringify(result.knownS) === JSON.stringify([]),
  "known S model should not be rejected",
);
assertStep(
  JSON.stringify(result.knownLs) === JSON.stringify([]),
  "known LS regional model should not be rejected after display normalization",
);
assertStep(
  /S32FD812/.test(result.reply) &&
    /找不到/.test(result.reply) &&
    !/\[來源:/.test(result.reply),
  "unknown model reply should name the model, avoid specs, and not invent a source tag",
);

console.log("PASS: verify_unknown_model_static");
