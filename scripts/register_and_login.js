const http = require('http');
const email = `devtest+${Date.now()}@example.com`;
const password = 'password123';

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = { hostname: 'localhost', port: 3001, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = http.request(opts, (res) => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  const reg = await post('/api/auth/register', { email, password });
  console.log('REG', reg.status, reg.body);
  const login = await post('/api/auth/login', { email, password });
  console.log('LOGIN', login.status, login.body);
})();
