const http = require('http');
const email = `devtest+${Date.now()}@example.com`;
const body = JSON.stringify({ email, password: 'password123' });
const opts = { hostname: 'localhost', port: 3001, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
const req = http.request(opts, (res) => {
  let b = '';
  res.on('data', d => b += d);
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    console.log('BODY', b);
  });
});
req.on('error', e => console.error('ERR', e.message));
req.write(body);
req.end();
