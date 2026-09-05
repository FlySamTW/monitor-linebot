// Only GAS I/O is faked. All resolver, retrieval, route and evidence functions
// come from the deployable sources, not hand-extracted/simplified substitutes.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const zlib = require("zlib");
const root = path.resolve(__dirname, "..");

function createProductionHarness(options = {}) {
  const properties = new Map();
  Object.entries(options.properties || {}).forEach(([key, value]) => properties.set(key, String(value)));
  const cache = new Map();
  const logs = [], fetches = [];
  let now = options.now ? Date.parse(options.now) : Date.now();
  class FixtureDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  let fetchHandler = () => {throw new Error("Unscripted provider call");};
  let locked = false;
  let userLocked = false;
  const blob = (value, type = "application/octet-stream", name = "") => {
    const bytes = Buffer.isBuffer(value) ? value : Array.isArray(value) ? Buffer.from(value) : Buffer.from(String(value));
    return {getBytes: () => Array.from(bytes), getDataAsString: () => bytes.toString("utf8"), getContentType: () => type,
      getName: () => name, setName: n => blob(bytes, type, n), copyBlob: () => blob(bytes, type, name)};
  };
  const store = {
    getProperty: key => properties.get(key) || null,
    setProperty: (key, value) => {properties.set(key, String(value)); return store;},
    deleteProperty: key => properties.delete(key),
    getProperties: () => Object.fromEntries(properties),
    setProperties: values => Object.entries(values).forEach(([key, value]) => properties.set(key, String(value))),
  };
  const cacheApi = {get: key => cache.get(key) || null, put: (key, value) => cache.set(key, value), remove: key => cache.delete(key),
    getAll: keys => Object.fromEntries(keys.map(key => [key, cache.get(key)])),
    putAll: values => Object.entries(values).forEach(([key, value]) => cache.set(key, value)),
    removeAll: keys => keys.forEach(key => cache.delete(key))};
  const csv = name => fs.readFileSync(path.join(root, name + ".csv"), "utf8").split(/\r?\n/).filter(Boolean).map(line => [line]);
  const sheet = name => ({getName: () => name, getLastRow: () => csv(name).length,
    getDataRange: () => ({getValues: () => csv(name), getDisplayValues: () => csv(name)}),
    getRange: (row, col, count = 1) => ({getValues: () => csv(name).slice(row - 1, row - 1 + count),
      getValue: () => (csv(name)[row - 1] || [""])[0], setValue: () => {}, setValues: () => {}}),
    appendRow: row => logs.push(row)});
  const spreadsheet = {getSheetByName: name => fs.existsSync(path.join(root, name + ".csv")) ? sheet(name) : null};
  const context = {
    console: options.quiet ? {log: (...values) => logs.push(values.join(" ")), error: (...values) => logs.push(values.join(" "))} : console,
    Date: FixtureDate, PropertiesService: {getScriptProperties: () => store, getUserProperties: () => store},
    CacheService: {getScriptCache: () => cacheApi, getUserCache: () => cacheApi},
    LockService: {getScriptLock: () => ({tryLock: () => {if (locked) return false; locked = true; return true;},
      waitLock: () => {if (locked) throw new Error("fixture lock busy"); locked = true;}, releaseLock: () => {locked = false;}}),
      getUserLock: () => ({tryLock: () => {if (userLocked) return false; userLocked = true; return true;},
        waitLock: () => {if (userLocked) throw new Error("fixture user lock busy"); userLocked=true;},releaseLock:()=>{userLocked=false;}})},
    Utilities: {DigestAlgorithm: {SHA_256: "sha256", MD5: "md5"}, Charset: {UTF_8: "utf8"},
      newBlob: blob, base64Decode: value => Array.from(Buffer.from(value, "base64")),
      base64Encode: value => Buffer.from(value).toString("base64"),
      base64EncodeWebSafe: value => Buffer.from(value).toString("base64url"),
      ungzip: value => {
        if (value.getContentType() !== "application/gzip") throw new Error("GAS ungzip requires application/gzip");
        return blob(zlib.gunzipSync(Buffer.from(value.getBytes())));
      },
      gzip: value => blob(zlib.gzipSync(Buffer.from(value.getBytes()))),
      computeDigest: (algorithm, value) => Array.from(crypto.createHash(algorithm).update(typeof value === "string" ? value : Buffer.from(value)).digest()),
      getUuid: () => crypto.randomUUID(), sleep: () => {},
      formatDate: (date, zone, format) => {
        const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {timeZone: zone, year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date).map(x => [x.type,x.value]));
        return format === "yyyy-MM" ? `${p.year}-${p.month}` : `${p.year}-${p.month}-${p.day}`;
      }},
    SpreadsheetApp: {openById: () => spreadsheet, getActiveSpreadsheet: () => spreadsheet, flush: () => {}},
    ScriptApp: {getProjectTriggers: () => [], getScriptId: () => "fixture-script", getService: () => ({getUrl: () => "https://example.test/exec"})},
    Session: {getScriptTimeZone: () => "Asia/Taipei", getActiveUser: () => ({getEmail: () => ""})},
    DriveApp: {getFileById: () => {throw new Error("fixture Drive offline");}},
    UrlFetchApp: {fetch: (url, options) => {fetches.push({url, options}); return fetchHandler(url, options);}},
    ContentService: {MimeType: {JSON: "json"}},
  };
  vm.createContext(context);
  const files = fs.readdirSync(root).filter(name => name.endsWith(".gs"));
  vm.runInContext(files.map(name => fs.readFileSync(path.join(root, name), "utf8")).join("\n"), context, {timeout: 10000});
  return {context, properties, cache, logs, fetches, setFetch: handler => {fetchHandler = handler;},
    advanceTime: millis => {now += millis;}, run: code => vm.runInContext(code, context, {timeout: 10000})};
}
module.exports = {createProductionHarness};
