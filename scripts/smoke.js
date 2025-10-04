const http = require('http');
const https = require('https');

function get(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
      resolve({ statusCode: res.statusCode, headers: res.headers });
    });
    req.on('error', (err) => resolve({ error: err.message }));
    req.setTimeout(3000, () => { req.abort(); resolve({ error: 'timeout' }); });
  });
}

function postJson(url, body = {}) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const lib = url.startsWith('https') ? https : http;
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 3000,
    };

    const req = lib.request(options, (res) => {
      resolve({ statusCode: res.statusCode });
    });
    req.on('error', (err) => resolve({ error: err.message }));
    req.write(data);
    req.end();
  });
}

(async () => {
  console.log('Checking frontend http://localhost:5173');
  console.log(await get('http://localhost:5173'));

  console.log('Checking backend http://localhost:3001');
  console.log(await get('http://localhost:3001'));

  console.log('Checking protected GET /api/fast-history (expect 401)');
  console.log(await get('http://localhost:3001/api/fast-history'));

  console.log('POST /api/email-history with empty body (expect 400)');
  console.log(await postJson('http://localhost:3001/api/email-history', {}));
})();