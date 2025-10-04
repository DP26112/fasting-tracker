const http = require('http');
function req(opts, data) {
  return new Promise((resolve, reject) => {
    const r = http.request(opts, (resp) => {
      let b = '';
      resp.on('data', (c) => b += c);
      resp.on('end', () => resolve({ statusCode: resp.statusCode, body: b }));
    });
    r.on('error', reject);
    if (data) r.write(JSON.stringify(data));
    r.end();
  });
}

(async () => {
  try {
    const email = `e2e+${Date.now()}@example.com`;
    const password = 'E2eTest123!';
    console.log('Registering', email);
    const reg = await req({ hostname: 'localhost', port: 3001, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { email, password });
    console.log('reg', reg.statusCode, reg.body.slice(0, 300));

    console.log('Logging in');
    const login = await req({ hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, { email, password });
    console.log('login', login.statusCode, login.body.slice(0, 300));
    const token = JSON.parse(login.body || '{}').token;
    if (!token) return console.error('No token received');

    const start = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    console.log('Posting active-fast');
    const af = await req({ hostname: 'localhost', port: 3001, path: '/api/active-fast', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } }, { startTime: start, fastType: 'wet', notes: [] });
    console.log('active-fast POST', af.statusCode, af.body.slice(0, 300));

    console.log('GET active-fast');
    const g = await req({ hostname: 'localhost', port: 3001, path: '/api/active-fast', method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
    console.log('GET active-fast', g.statusCode, g.body.slice(0, 300));

    console.log('Saving fast');
    const end = new Date().toISOString();
    const duration = ((new Date(end)).getTime() - (new Date(start)).getTime()) / 3600000;
    const save = await req({ hostname: 'localhost', port: 3001, path: '/api/save-fast', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } }, { startTime: start, endTime: end, durationHours: duration, fastType: 'wet', notes: [] });
    console.log('save', save.statusCode, save.body.slice(0, 300));

    console.log('GET active-fast after save');
    const g2 = await req({ hostname: 'localhost', port: 3001, path: '/api/active-fast', method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }).catch(e => ({ error: e.message }));
    console.log('GET active-fast after save', g2 && g2.statusCode ? (g2.statusCode + ' ' + g2.body) : JSON.stringify(g2));

    console.log('GET fast-history');
    const hist = await req({ hostname: 'localhost', port: 3001, path: '/api/fast-history', method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
    console.log('fast-history', hist.statusCode, 'entriesPreview:', hist.body.slice(0, 300));

  } catch (err) {
    console.error('E2E error', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
