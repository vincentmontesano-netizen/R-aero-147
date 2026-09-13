// Run as root in a disposable container to inspect the actual serving process.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
let serverPid;
for (const pid of readdirSync('/proc').filter(name => /^\d+$/.test(name))) {
  try {
    const args = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0');
    if (args[0] === 'node' && args[1] === 'dist/index.js') serverPid = pid;
  } catch { /* A process may exit while enumerating. */ }
}
assert.ok(serverPid, 'Serving process absent');
const status = readFileSync(`/proc/${serverPid}/status`, 'utf8');
assert.match(status, /^Uid:\s+1000\s+1000\s+1000\s+1000$/m);
assert.match(status, /^NoNewPrivs:\s+1$/m);
assert.match(status, /^CapEff:\s+0+$/m);
assert.match(status, /^Umask:\s+0077$/m);
const result = spawnSync('setpriv', ['--reuid=node', '--regid=node', '--init-groups', '--no-new-privs', 'node', '--input-type=module'], {
  input: `import assert from 'node:assert/strict';
import {accessSync, constants, writeFileSync, readFileSync, unlinkSync} from 'node:fs';
import {join} from 'node:path';
for (const path of ['/app/dist/index.js', '/app/docker-entrypoint.sh']) assert.throws(() => accessSync(path, constants.W_OK));
for (const path of ['/var/lib/postgresql/data/.raero-password', '/etc/shadow']) assert.throws(() => readFileSync(path));
assert.ok(!readFileSync('/proc/${serverPid}/environ', 'utf8').split(String.fromCharCode(0)).some(value => value.startsWith('ADMIN_PASSWORD=')));
const file = join(process.env.STORAGE_DIR, '.runtime-permission-probe');
try { writeFileSync(file, 'isolated runtime check', {flag:'wx', mode:0o600}); assert.equal(readFileSync(file, 'utf8'), 'isolated runtime check'); }
finally { try {unlinkSync(file)} catch {} }
`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
});
assert.equal(result.status, 0, 'Runtime filesystem boundaries failed');
console.log('Runtime checks passed: uid 1000, no new privileges/capabilities, private umask, bootstrap password absent, source/database protected, storage writable.');
