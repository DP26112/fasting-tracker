// server/test/test_schedule_endpoints.js
// Integration test: run the express server against an in-memory MongoDB and exercise schedule endpoints

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

  // Start the server as a child process with MONGO_URI pointing to the in-memory server
  const env = Object.assign({}, process.env, { MONGO_URI: uri, NODE_ENV: 'test', JWT_SECRET: 'testsecret', DEBUG_LOGS: 'false' });
  const serverProc = cp.spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });

  serverProc.stdout.on('data', d => { /* swallow or print for debugging */ });
  serverProc.stderr.on('data', d => { console.error('server stderr:', d.toString()); });

  // Wait for server to listen (simple retry loop)
  const base = 'http://localhost:3001';
  const maxWait = 10000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    try {
      const r = await httpRequest(base + '/api/health');
      if (r.statusCode === 200) break;
    } catch (e) { /* ignore */ }
    await new Promise(r => setTimeout(r, 200));
  }

  // If server didn't become ready, dump startup logs and fail fast
  try {
    const r = await httpRequest(base + '/api/health');
    if (r.statusCode !== 200) throw new Error('health check failed');
  } catch (e) {
    console.error('Server failed to start within timeout. Capturing server stdout/stderr:');
    try { serverProc.stdout.on('data', d => console.error('[server stdout]', d.toString())); } catch (e) { /* ignore */ }
    try { serverProc.stderr.on('data', d => console.error('[server stderr]', d.toString())); } catch (e) { /* ignore */ }
    try { serverProc.kill(); } catch (er) {}
    await mongod.stop();
    process.exit(1);
  }

  // Create a JWT for test user
  const userId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign({ id: userId }, env.JWT_SECRET);

  // POST /api/schedule-status-report
  const startTime = new Date().toISOString();
  const postResp = await httpRequest(base + '/api/schedule-status-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ startTime, recipients: 'x@y.com' })
  });
  if (postResp.statusCode !== 200) {
    console.error('POST schedule failed:', postResp.statusCode, postResp.body);
    serverProc.kill();
    process.exit(1);
  }
  const postBody = JSON.parse(postResp.body);
  if (!postBody.schedule) {
    console.error('POST returned no schedule object');
    serverProc.kill();
    process.exit(1);
  }

  // GET schedule
  const getResp = await httpRequest(base + `/api/schedule-status-report?startTime=${encodeURIComponent(startTime)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (getResp.statusCode !== 200) {
    console.error('GET schedule failed:', getResp.statusCode, getResp.body);
    serverProc.kill();
    process.exit(1);
  }
  const getBody = JSON.parse(getResp.body);
  if (!getBody.schedule) {
    console.error('GET returned null schedule');
    serverProc.kill();
    process.exit(1);
  }

  // DELETE schedule
  const delResp = await httpRequest(base + `/api/schedule-status-report?startTime=${encodeURIComponent(startTime)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (delResp.statusCode !== 200) {
    console.error('DELETE schedule failed:', delResp.statusCode, delResp.body);
    serverProc.kill();
    process.exit(1);
  }

  console.log('Schedule endpoints integration test passed');
  try {
    // On Windows child.kill may not terminate the process reliably; use taskkill as a fallback
    const execSync = require('child_process').execSync;
    execSync(`taskkill /PID ${serverProc.pid} /F`);
  } catch (e) {
    try { serverProc.kill(); } catch (e) { /* ignore */ }
  }
  await mongod.stop();
  process.exit(0);

})();

// small helper for http requests
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
