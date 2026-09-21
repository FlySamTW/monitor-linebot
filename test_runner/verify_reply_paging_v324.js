const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createProductionHarness } = require("./production_harness");

const harness = createProductionHarness({ quiet: true });
const c = harness.context;

function json(value) {
  return JSON.parse(JSON.stringify(value));
}

c.IS_TEST_MODE = true;
c.CURRENT_REPLY_USER_ID = "TEST_USER_A";
c.CURRENT_REPLY_CONTEXT_ID = "TEST_USER_A";
c.CURRENT_REPLY_FOOTER_APPENDED = false;

// Unicode / URL splitting: never cut a grapheme cluster, and keep a short URL intact.
const family = "👨‍👩‍👧‍👦";
const longUrl = "https://example.com/" + "a".repeat(180);
const unicodeText = "甲".repeat(1170) + family + " " + longUrl + "\n" + "乙".repeat(1400);
const chunks = json(c.splitReplyTextForLine_(unicodeText));
const maxLineUnits = harness.run("REPLY_TEXT_MAX_UTF16");
assert(chunks.length >= 2, "long text should split");
assert(chunks.every((part) => part.length <= maxLineUnits), "each LINE text must stay <=5000 UTF-16 units");
assert(chunks.some((part) => part.includes(longUrl)), "URL must stay intact when it fits one LINE message");
assert(!chunks.some((part) => /\u200d$/.test(part)), "chunk must not end with ZWJ");
assert(!chunks.some((part) => /^[\u0300-\u036f]/.test(part)), "chunk must not start with a combining mark");

// Six message objects => first 5 only, with a continuation postback; final actions remain on last page.
const originalAction = {
  type: "action",
  action: { type: "message", label: "原本動作", text: "原本動作" },
};
const six = [
  { type: "text", text: "第一則" },
  { type: "text", text: "第二則" },
  { type: "text", text: "第三則" },
  { type: "text", text: "第四則" },
  { type: "text", text: "第五則" },
  { type: "text", text: "第六則\n\n資料來源：三星官方手冊（第 12 頁）\n\n本次約 NT$0.1234\n模型：Gemini 3.1 Flash-Lite\n剩餘：直接問 9/10" },
];
const assembled = json(c.assembleReplyMessages_(six, { quickReply: { items: [originalAction] } }));
assert.equal(assembled.paginated, true, "6 messages must paginate");
assert.equal(assembled.messages.length, 5, "first LINE reply batch must contain at most 5 message objects");
const firstLast = assembled.messages[assembled.messages.length - 1];
assert(firstLast.quickReply && firstLast.quickReply.items.length === 1, "non-final batch needs one continuation action");
const continueData = firstLast.quickReply.items[0].action.data;
assert(/^rm_action=reply_page&answer_id=[A-Za-z0-9]+&page=2&v=1$/.test(continueData), "continuation postback must preserve answer_id/page/v");
assert(assembled.messages.some((m) => m.type === "text" && /資料來源：三星官方手冊/.test(m.text)), "first batch keeps source metadata");
assert(assembled.messages.some((m) => m.type === "text" && /本次約 NT\$0\.1234\n模型：Gemini 3\.1 Flash-Lite\n剩餘：直接問 9\/10/.test(m.text)), "first batch keeps cost/model/remaining as separate footer lines");

const answerId = new URLSearchParams(continueData).get("answer_id");
c.LAST_TEST_MESSAGES = [];
c.LAST_TEST_QUICK_REPLY_ITEMS = [];
c.LAST_TEST_SEND_RESULT = "";
const beforeFetches = harness.fetches.length;
assert.equal(c.handleReplyPagePostback_({ answer_id: answerId, page: "2" }, "TEST_USER_A", "TEST_USER_A", "TEST_POSTBACK_REPLY_TOKEN"), true);
const page2a = json(c.LAST_TEST_MESSAGES);
assert.equal(harness.fetches.length, beforeFetches, "continuation must not call any provider or LINE in test mode");
assert(page2a.some((m) => m.type === "text" && /第 2\/2 批/.test(m.text)), "continuation shows batch number");
assert(page2a.some((m) => m.type === "text" && /續看既有答案：NT\$0｜未呼叫模型｜未扣次/.test(m.text)), "continuation must show zero-cost/no-model footer");
assert(page2a.some((m) => m.type === "text" && /資料來源：三星官方手冊/.test(m.text)), "continuation keeps required source");
const finalQr = page2a[page2a.length - 1].quickReply;
assert(finalQr && finalQr.items[0].action.label === "原本動作", "final batch restores original actions");

// Same page may be reread; no shared cursor and no extra provider call.
c.LAST_TEST_MESSAGES = [];
assert.equal(c.handleReplyPagePostback_({ answer_id: answerId, page: "2" }, "TEST_USER_A", "TEST_USER_A", "TEST_POSTBACK_REPLY_TOKEN"), true);
assert.deepStrictEqual(json(c.LAST_TEST_MESSAGES), page2a, "same continuation page must be reread deterministically");
assert.equal(harness.fetches.length, beforeFetches, "reread remains zero provider calls");

// Binding prevents another user from reading the cached answer.
c.LAST_TEST_MESSAGES = [];
assert.equal(c.handleReplyPagePostback_({ answer_id: answerId, page: "2" }, "TEST_USER_B", "TEST_USER_B", "TEST_POSTBACK_REPLY_TOKEN"), true);
assert(c.LAST_TEST_MESSAGES.some((m) => m.type === "text" && /續看資料已失效/.test(m.text)), "cross-user continuation must fail closed");
assert.equal(harness.fetches.length, beforeFetches, "cross-user rejection must not regenerate");

// More than 20 messages is a partial display, never a fake continuation button.
c.CURRENT_REPLY_USER_ID = "TEST_USER_C";
c.CURRENT_REPLY_CONTEXT_ID = "TEST_USER_C";
const tooMany = Array.from({ length: 21 }, (_, i) => ({ type: "text", text: "第" + (i + 1) + "則" }));
const partial = json(c.assembleReplyMessages_(tooMany, {}));
assert.equal(partial.partial, true, "more than 4 batches must mark partial display");
assert(partial.messages.length <= 5, "partial display still respects LINE max messages");
assert(!partial.messages.some((m) => m.quickReply && (m.quickReply.items || []).some((item) => /rm_action=reply_page/.test(item.action && item.action.data || ""))), "partial display must not expose a fake continuation");
assert(harness.logs.some((line) => /PARTIAL_DISPLAY/.test(String(line))), "capacity failure must be auditable as PARTIAL_DISPLAY");

// TestUI must submit the complete postback data and render final messages[].
const testUi = fs.readFileSync(path.resolve(__dirname, "..", "TestUI.html"), "utf8");
assert(/\.testSourcePostbackData\(String\(data \|\| ""\), TEST_USER_ID, TEST_UI_ACCESS_TOKEN\)/.test(testUi), "TestUI must pass full postback data");
assert(/Array\.isArray\(res\.messages\)/.test(testUi) && /message\.quickReply/.test(testUi), "TestUI must render final messages payload");
assert(!/txt\.slice\(0,\s*5\)/.test(fs.readFileSync(path.resolve(__dirname, "..", "linebot.gs"), "utf8")), "reply path must not silently slice to 5");
const linebotSource = fs.readFileSync(path.resolve(__dirname, "..", "linebot.gs"), "utf8");
assert(!/txt\.toString\(\)\.substring\(0,\s*4000\)/.test(linebotSource), "reply path must not silently truncate at 4000");
assert(/\$\{costLabel\}\\n\$\{modelLabel\}\\n剩餘：/.test(linebotSource), "customer footer must display cost/model/remaining on separate lines");

console.log("PASS verify_reply_paging_v324");
