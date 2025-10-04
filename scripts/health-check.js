const http = require('http');

function get(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? require('https') : http;
    const req = lib.get(url, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', (err) => resolve({ error: err && (err.message || err.code || String(err)), stack: err && err.stack }));
    req.setTimeout(3000, () => { req.abort(); resolve({ error: 'timeout' }); });
  });
}

(async () => {
  console.log('GET /api/health', await get('http://localhost:3001/api/health'));
  console.log('GET /api/ready', await get('http://localhost:3001/api/ready'));
})();