const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', (err) => reject(err));
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

(async () => {
  try {
    const testEmail = `testuser+${Date.now()}@example.com`;
    const password = 'Test1234!';

    console.log('Registering user:', testEmail);
    const reg = await request({ hostname: 'localhost', port: 3001, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { email: testEmail, password });
    console.log('Register response:', reg.statusCode, reg.body);
    const regBody = JSON.parse(reg.body || '{}');
    const userId = regBody.user && regBody.user.id;
    if (userId) {
      console.log('Fetching stored user document (debug)...');
      const dbg = await request({ hostname: 'localhost', port: 3001, path: `/api/auth/__debug/user/${userId}`, method: 'GET', headers: { 'x-debug-secret': 'debug' } });
      console.log('Debug user fetch:', dbg.statusCode, dbg.body);
    }

    console.log('Logging in...');
    const login = await request({ hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { email: testEmail, password });
    console.log('Login response:', login.statusCode, login.body);

    const parsed = JSON.parse(login.body || '{}');
    const token = parsed.token;
    if (!token) {
      console.log('No token received; aborting protected request.');
      process.exit(0);
    }

    console.log('Calling protected /api/fast-history with token...');
    const protectedReq = await request({ hostname: 'localhost', port: 3001, path: '/api/fast-history', method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
    console.log('Protected response:', protectedReq.statusCode, protectedReq.body);
  } catch (err) {
    console.error('Error during auth test:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
