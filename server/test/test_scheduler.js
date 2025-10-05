const assert = require('assert');
const { computeNextSend } = require('../utils/scheduler');

function iso(d) { return d.toISOString(); }

// Test 1: now before first anchor
const start = new Date('2025-10-01T00:00:00Z');
const now1 = new Date('2025-10-01T12:00:00Z');
const next1 = computeNextSend(iso(start), iso(now1));
assert.strictEqual(next1.toISOString(), new Date(start.getTime() + 24*60*60*1000).toISOString(), 'First anchor should be start+24h');

// Test 2: now after first anchor but before second anchor (between 24h and 30h)
const now2 = new Date('2025-10-02T05:30:00Z'); // start + 29.5h
const next2 = computeNextSend(iso(start), iso(now2));
assert.strictEqual(next2.toISOString(), new Date(start.getTime() + 30*60*60*1000).toISOString(), 'Next anchor should be start+30h');

// Test 3: now exactly on an anchor (e.g., 30h) -> next should be 36h
const now3 = new Date(start.getTime() + 30*60*60*1000);
const next3 = computeNextSend(iso(start), iso(now3));
assert.strictEqual(next3.toISOString(), new Date(start.getTime() + 36*60*60*1000).toISOString(), 'Next anchor should be start+36h');

console.log('All scheduler tests passed!');
process.exit(0);
