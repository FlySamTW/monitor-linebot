const assert = require('assert');

// Artifact sealing is checked by the caller. Transport success alone is insufficient.
function validateLiveLineEvidence(live) {
  assert.equal(live.acceptanceSurface, 'line', 'TestUI/fixture cannot replace actual LINE acceptance');
  assert(live.coreJourneys && live.coreJourneys.total === 20 && live.coreJourneys.passed >= 19 &&
    live.coreJourneys.criticalFailures === 0, 'Core journey release threshold not met');
  assert(Array.isArray(live.results) && live.results.length > 0, 'Missing LINE results');
  for (const row of live.results) {
    assert(row.surface === 'line' && row.visibleAnswerVerified === true, 'Visible LINE answer not verified');
    assert(typeof row.visibleAnswer === 'string' && row.visibleAnswer.trim(), 'Missing visible answer');
    assert(row.transport && row.transport.kind === 'real_line_reply' && row.transport.state === 'accepted_by_line', 'Missing real LINE transport receipt');
    assert(row.transport.eventId && row.transport.windowValid === true, 'Missing event or expired acceptance window');
    assert.equal(row.transport.version, live.version);
    assert.equal(row.transport.build, live.build);
    assert.equal(row.transport.verificationBatch, live.verificationBatch);
    assert.equal(row.transport.authorizedCapTwd, live.authorizedCapTwd);
    assert(/^[a-f0-9]{64}$/.test(row.transport.inputSha256 || '') &&
      /^[a-f0-9]{64}$/.test(row.transport.replySha256 || ''), 'Missing input/reply binding');
    assert(Array.isArray(row.receipts), 'Every LINE result needs explicit provider receipts (empty for free answers)');
    assert.deepEqual(row.receipts.map(r => r.id).sort(), [...row.transport.providerReceiptIds].sort(), 'Provider receipts do not match LINE event');
    assert.equal(row.receipts.filter(r => r.sent).length, row.transport.providerCalls, 'Provider call count mismatch');
    for (const receipt of row.receipts) {
      assert.equal(receipt.verificationBatch, live.verificationBatch);
      assert(Number.isFinite(receipt.costTwd) && receipt.costTwd >= 0 && receipt.status, 'Missing cost status');
      assert(!['unknown', 'pending'].includes(receipt.status), 'Unsettled/unknown provider cost cannot pass final acceptance');
    }
  }
}
module.exports = { validateLiveLineEvidence };
