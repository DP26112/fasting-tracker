// server/test/test_send_report_auto_enable.js
// Integration test: verify that /api/send-report with autoEnableSchedule:true
// creates a ScheduledReport with enabled:true and the provided recipients.

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const cp = require('child_process');
const http = require('http');
const https = require('https');
const jwt = require('jsonwebtoken');

(async () => {
  let mongod;
  try {
    mongod = await MongoMemoryServer.create();
  } catch (err) {
    console.error('Could not start MongoMemoryServer, skipping integration test. Error:', err && err.message ? err.message : err);
    process.exit(0); // treat as skipped rather than failed to avoid blocking local dev
  }
  const uri = mongod.getUri();

  // Start server with in-memory mongo and test JWT secret
  const env = Object.assign({}, process.env, { MONGO_URI: uri, NODE_ENV: 'test', JWT_SECRET: 'testsecret', DEBUG_LOGS: 'false' });
  const serverProc = cp.spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });

  serverProc.stdout.on('data', d => { /* swallow */ });
  serverProc.stderr.on('data', d => { console.error('server stderr:', d.toString()); });

  const base = 'http://localhost:3001';
  const maxWait = 10000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const r = await httpRequest(base + '/api/health');
      if (r.statusCode === 200) break;
    } catch (e) { }
    await new Promise(r => setTimeout(r, 200));
  }

  // Register a user via the server to get a valid token
  const uniqueEmail = `intuser+${Date.now()}@example.com`;
  const registerBody = JSON.stringify({ email: uniqueEmail, password: 'password123' });
  const regResp = await httpRequest(base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: registerBody
  });
  if (regResp.statusCode !== 201) {
    console.error('Registration failed in test:', regResp.statusCode, regResp.body);
    cleanupAndExit(serverProc, mongod, 1);
    return;
  }
  const regBody = JSON.parse(regResp.body || '{}');
  const token = regBody.token;

  // Build a send-report payload with recipients and autoEnableSchedule:true
  const startTime = new Date().toISOString();
  const payload = {
    startTime,
    currentHours: 5.5,
    fastType: 'wet',
    notes: [],
    recipientEmail: 'owner@example.com',
    recipients: ['owner@example.com', 'friend@example.com'],
    autoEnableSchedule: true
  };

  const postResp = await httpRequest(base + '/api/send-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  });

  if (postResp.statusCode !== 200) {
    console.error('send-report failed:', postResp.statusCode, postResp.body);
    cleanupAndExit(serverProc, mongod, 1);
    return;
  }

  // If send-report didn't include a schedule in its response, query the schedule endpoint to verify persistence
  const getResp = await httpRequest(base + `/api/schedule-status-report?startTime=${encodeURIComponent(startTime)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (getResp.statusCode !== 200) {
    console.error('GET schedule failed after send-report:', getResp.statusCode, getResp.body);
    cleanupAndExit(serverProc, mongod, 1);
    return;
  }
  const getBody = JSON.parse(getResp.body || '{}');
  const sched = getBody.schedule;
  if (!sched) {
    console.error('No schedule found after send-report');
    cleanupAndExit(serverProc, mongod, 1);
    return;
  }
  if (!sched.enabled) {
    console.error('Expected schedule.enabled === true but got', sched.enabled);
    cleanupAndExit(serverProc, mongod, 1);
    return;
  }
  const recs = Array.isArray(sched.recipients) ? sched.recipients : String(sched.recipients || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!recs.includes('friend@example.com')) {
    console.error('Persisted recipients did not include friend@example.com', recs);
    cleanupAndExit(serverProc, mongod, 1);
    return;
  }

  console.log('send-report auto-enable integration test passed');
  cleanupAndExit(serverProc, mongod, 0);

})();

function cleanupAndExit(serverProc, mongod, code) {
  try { require('child_process').execSync(`taskkill /PID ${serverProc.pid} /F`); } catch (e) { try { serverProc.kill(); } catch (e) {} }
  mongod.stop().catch(() => {});
  process.exit(code);
}

function httpRequest(urlStr, opts = {}) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;
      const reqOpts = { method: opts.method || 'GET', headers: opts.headers || {}, hostname: url.hostname, port: url.port || (isHttps ? 443 : 80), path: url.pathname + url.search };
      const req = lib.request(reqOpts, (res) => {
        let data = '';
        res.on('data', d => data += d.toString());
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
      });
      req.on('error', reject);
      if (opts.body) req.write(opts.body);
      req.end();
    } catch (e) { reject(e); }
  });
}
