// server/test/test_send_report_persistence.js
// Quick integration test: spawn the server with an in-memory MongoDB and verify
// that POST /api/send-report with autoEnableSchedule:true persists a ScheduledReport,
// that GET returns it, and that DELETE clears recipients and disables it.

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const http = require('http');
const https = require('https');
const jwt = require('jsonwebtoken');
const path = require('path');
const cp = require('child_process');

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  const env = Object.assign({}, process.env, { MONGO_URI: uri, NODE_ENV: 'test', JWT_SECRET: 'testsecret', DEBUG_LOGS: 'true' });
  const serverProc = cp.spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });

  serverProc.stdout.on('data', d => { try { process.stdout.write(`[server stdout] ${d.toString()}`); } catch (e) {} });
  serverProc.stderr.on('data', d => { try { process.stderr.write(`[server stderr] ${d.toString()}`); } catch (e) {} });

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

  try {
    const r = await httpRequest(base + '/api/health');
    if (r.statusCode !== 200) throw new Error('health check failed');
  } catch (e) {
    console.error('Server failed to start within timeout');
    try { serverProc.kill(); } catch (er) {}
    await mongod.stop();
    process.exit(1);
  }

  // Create a token for a fake userId. The server loads server/.env which may override JWT_SECRET,
  // so parse that file to sign the token with the same secret.
  const fs = require('fs');
  const envFile = path.join(__dirname, '..', '.env');
  let realJwtSecret = env.JWT_SECRET;
  try {
    const envContents = fs.readFileSync(envFile, 'utf8');
    const m = envContents.match(/^JWT_SECRET=(.+)$/m);
    if (m && m[1]) realJwtSecret = m[1].trim();
  } catch (e) {
    // fall back to env.JWT_SECRET already set above
  }
  const userId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign({ id: userId }, realJwtSecret);

  const startTime = new Date().toISOString();
  const extras = ['friend1@example.com', 'friend2@example.com'];

  // 1) POST /api/send-report with autoEnableSchedule:true
  const payload = { startTime, currentHours: 1.5, fastType: 'wet', notes: [], recipientEmail: 'owner@example.com', recipients: [ 'owner@example.com', ...extras ], autoEnableSchedule: true };
  const postResp = await httpRequest(base + '/api/send-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (postResp.statusCode !== 200) {
    console.error('POST /api/send-report failed', postResp.statusCode, postResp.body);
    cleanupAndExit(serverProc, mongod, 1);
  }
  // Some environments may not return the persisted schedule in the POST response.
  // We'll verify persistence in the subsequent GET below.

  // 2) GET schedule and verify recipients
  const getResp = await httpRequest(base + `/api/schedule-status-report?startTime=${encodeURIComponent(startTime)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (getResp.statusCode !== 200) {
    console.error('GET schedule failed', getResp.statusCode, getResp.body);
    cleanupAndExit(serverProc, mongod, 1);
  }
  const getBody = JSON.parse(getResp.body);
  const sched = getBody.schedule;
  if (!sched || !sched.enabled) {
    console.error('GET schedule missing or not enabled', getBody);
    cleanupAndExit(serverProc, mongod, 1);
  }
  // ensure recipients include extras
  for (const ex of extras) {
    if (!Array.isArray(sched.recipients) || !sched.recipients.includes(ex)) {
      console.error('Recipient missing from persisted schedule:', ex, sched.recipients);
      cleanupAndExit(serverProc, mongod, 1);
    }
  }

  // 3) DELETE to disable and clear recipients
  const delResp = await httpRequest(base + `/api/schedule-status-report?startTime=${encodeURIComponent(startTime)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (delResp.statusCode !== 200) {
    console.error('DELETE schedule failed', delResp.statusCode, delResp.body);
    cleanupAndExit(serverProc, mongod, 1);
  }

  // 4) GET schedule again to ensure disabled and recipients cleared
  const getResp2 = await httpRequest(base + `/api/schedule-status-report?startTime=${encodeURIComponent(startTime)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (getResp2.statusCode !== 200) {
    console.error('GET after delete failed', getResp2.statusCode, getResp2.body);
    cleanupAndExit(serverProc, mongod, 1);
  }
  const body2 = JSON.parse(getResp2.body);
  const sched2 = body2.schedule;
  if (!sched2) {
    console.error('Schedule not found after delete (expected existing record disabled)', body2);
    cleanupAndExit(serverProc, mongod, 1);
  }
  if (sched2.enabled) {
    console.error('Schedule still enabled after delete');
    cleanupAndExit(serverProc, mongod, 1);
  }
  if (Array.isArray(sched2.recipients) && sched2.recipients.length > 0) {
    console.error('Recipients were not cleared on delete', sched2.recipients);
    cleanupAndExit(serverProc, mongod, 1);
  }

  console.log('send-report persistence integration test passed');
  cleanupAndExit(serverProc, mongod, 0);

})();

function cleanupAndExit(serverProc, mongod, code) {
  try {
    const execSync = require('child_process').execSync;
    execSync(`taskkill /PID ${serverProc.pid} /F`);
  } catch (e) {
    try { serverProc.kill(); } catch (e) { /* ignore */ }
  }
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
