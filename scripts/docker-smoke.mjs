import { readFile, writeFile } from 'node:fs/promises';
const origin = 'http://127.0.0.1:3000';
const fail = message => { throw new Error(message); };
const home = await fetch(origin);
if (!home.ok || !(await home.text()).includes('id="root"')) fail('Frontend shell unavailable');
if ((await fetch(`${origin}/storage/.jwt_secret`)).status !== 404) fail('Operational secret path exposed');
const anonymous = await (await fetch(`${origin}/api/trpc/auth.me`)).json();
if (anonymous.result?.data?.json !== null) fail('Anonymous identity boundary failed');
let cookie;
if (process.env.RAERO_SMOKE_RESTART === 'true') cookie = await readFile('/tmp/raero-smoke-cookie', 'utf8');
else {
 const response = await fetch(`${origin}/api/trpc/auth.login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ json: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } }) });
 if (!response.ok) fail(`Admin login failed: HTTP ${response.status}`);
 const setCookie = response.headers.get('set-cookie');
 if (!setCookie || !setCookie.includes('HttpOnly')) fail('Session cookie missing or not HTTP-only');
 if (process.env.NODE_ENV === 'production' && (!setCookie.includes('Secure') || !setCookie.includes('SameSite=Lax'))) fail('Production session cookie attributes missing');
 cookie = setCookie.split(';')[0];
 await writeFile('/tmp/raero-smoke-cookie', cookie, { mode: 0o600 });
}
const authenticated = await fetch(`${origin}/api/trpc/auth.me`, { headers: { cookie } });
const data = await authenticated.json();
if (!authenticated.ok || data.result?.data?.json?.role !== 'admin') fail('Authenticated admin session unavailable');
if (JSON.stringify(data).includes('passwordHash')) fail('Authentication hash exposed');
console.log(process.env.RAERO_SMOKE_RESTART === 'true' ? 'HTTP checks passed; existing session survived restart.' : 'HTTP checks passed: frontend, anonymous boundary, admin login, cookie and secret-file protection.');
