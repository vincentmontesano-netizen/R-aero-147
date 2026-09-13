// Execute only inside a disposable all-in-one test container.
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
const secretFile = join(process.env.PGDATA, '.raero-password');
assert.equal(statSync(secretFile).mode & 0o777, 0o600);
const password = readFileSync(secretFile, 'utf8');
const sql = postgres({ host: '127.0.0.1', database: 'raero', username: 'raero', password, max: 1 });
try {
  const [role] = await sql`select rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls from pg_roles where rolname = current_user`;
  assert.deepEqual(Object.values(role), [false, false, false, false, false]);
  await assert.rejects(sql`select pg_read_file('/etc/passwd')`, error => error.code === '42501');
  await assert.rejects(sql`create role raero_forbidden_probe`, error => error.code === '42501');
  const [counts] = await sql`select (select count(*)::int from users) as users, (select count(*)::int from trainings) as trainings, (select count(*)::int from raero_migrations) as receipts`;
  assert.equal(counts.users, 1);
  assert.equal(counts.trainings, 0);
  assert.ok(counts.receipts >= 33);
  const old = postgres({ host: '127.0.0.1', database: 'raero', username: 'raero', password: 'raero', max: 1, connect_timeout: 3 });
  try { await assert.rejects(old`select 1`, error => error.code === '28P01'); }
  finally { await old.end(); }
  console.log('Embedded DB checks passed: restricted role, secret permissions, legacy password refused, records preserved.');
} finally { await sql.end(); }
