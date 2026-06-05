const http = require('http');

const API_BASE = process.env.API_URL || 'http://localhost:3001';

function request(path, method = 'GET', body = null, cookies = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const isHttps = url.protocol === 'https:';
    const opts = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(cookies ? { Cookie: cookies } : {}),
      },
    };

    const lib = isHttps ? require('https') : require('http');
    const req = lib.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        resolve({ status: res.statusCode, headers: res.headers, body: raw });
      });
    });

    req.on('error', (err) => reject(err));
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  try {
    const email = process.argv[2] || 'teste@inpe.br';
    const password = process.argv[3] || '#Admin123';

    console.log('Logging in as', email);
    const loginBody = JSON.stringify({ email, password });
    const loginRes = await request('/api/auth/login/password', 'POST', loginBody);
    console.log('Login status:', loginRes.status);
    if (loginRes.status >= 400) {
      console.error('Login failed:', loginRes.body);
      process.exit(1);
    }

    const setCookieHeader = loginRes.headers['set-cookie'] || loginRes.headers['Set-Cookie'];
    if (!setCookieHeader) {
      console.error('No set-cookie header received from login.');
      process.exit(1);
    }
    const cookies = Array.isArray(setCookieHeader)
      ? setCookieHeader.map((s) => s.split(';')[0]).join('; ')
      : String(setCookieHeader).split(';')[0];

    console.log('Fetching profile...');
    const profileRes = await request('/api/users/profile', 'GET', null, cookies);
    console.log('Profile status:', profileRes.status);
    if (profileRes.status >= 400) {
      console.error('Failed to fetch profile:', profileRes.body);
      process.exit(1);
    }

    const profile = JSON.parse(profileRes.body);
    console.log('Profile:', JSON.stringify(profile, null, 2));

    // Prefer a non-admin group (so we can modify permissions); fall back to first group
    const groupId = (profile.data?.groups || []).find((g) => g.role !== 'admin')?.id || profile.data?.groups?.[0]?.id;
    if (!groupId) {
      console.error('No groupId found for the user.');
      process.exit(1);
    }
    console.log('Using groupId:', groupId);

    const permBody = JSON.stringify({ groupId, resource: 'products', action: 'view', enabled: true });
    console.log('Updating permission products:view for group', groupId);
    const updRes = await request('/api/groups/permissions', 'PUT', permBody, cookies);
    console.log('Update status:', updRes.status);
    console.log('Update response body:', updRes.body);

    console.log('Fetching profile again to verify...');
    const profileAfter = await request('/api/users/profile', 'GET', null, cookies);
    console.log('Profile after status:', profileAfter.status);
    console.log('Profile after body:', profileAfter.body);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
