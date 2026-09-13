// Destructive availability exercise: ONLY inside an isolated disposable test container.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
const origin = 'http://127.0.0.1:3000';
const version = readdirSync('/usr/lib/postgresql').sort((a,b) => Number(b)-Number(a))[0];
const ctl = `/usr/lib/postgresql/${version}/bin/pg_ctl`;
const command = args => execFileSync('runuser', ['-u', 'postgres', '--', ctl, '-D', process.env.PGDATA, ...args], {stdio:'pipe'});
const status = async path => (await fetch(origin + path, {signal: AbortSignal.timeout(4000)})).status;
assert.equal(await status('/health/ready'), 200);
try {
  command(['-m','fast','-w','-t','20','stop']);
  await setTimeout(1200); // Let the one-second readiness cache expire.
  assert.equal(await status('/health/live'), 200);
  assert.equal(await status('/'), 200);
  assert.equal(await status('/health/ready'), 503);
  console.log('Database stopped: frontend/live=200; readiness=503.');
} finally {
  command(['-l','/tmp/raero-health-postgres.log','-o','-c listen_addresses=127.0.0.1 -p 5432','-w','-t','20','start']);
}
let recovered = false;
for (let attempt = 0; attempt < 10; attempt++) {
  await setTimeout(1100);
  if (await status('/health/ready') === 200) { recovered = true; break; }
}
assert.ok(recovered, 'Readiness did not recover after PostgreSQL restart');
console.log('Database restarted: readiness recovered to 200 without restarting Node.');
