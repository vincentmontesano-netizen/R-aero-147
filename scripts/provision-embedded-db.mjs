// Only for the bundled PostgreSQL cluster, before starting the application.
import { randomBytes } from 'node:crypto';
import { chmodSync, chownSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const dataDir = process.env.PGDATA || '/var/lib/postgresql/data';
const secretFile = join(dataDir, '.raero-password');
if (!existsSync(secretFile)) {
  writeFileSync(secretFile, randomBytes(48).toString('hex'), { flag: 'wx', mode: 0o600 });
}
chownSync(secretFile, 0, 0);
chmodSync(secretFile, 0o600);
const password = readFileSync(secretFile, 'utf8');
if (!/^[a-f0-9]{96}$/.test(password)) throw new Error('Invalid embedded database credential file');

function sql(statement) {
  // SQL goes through stdin, never command arguments or diagnostic output.
  try {
    return execFileSync('runuser', ['-u', 'postgres', '--', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-d', 'postgres'], {
      input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new Error('Embedded database provisioning failed; application was not started');
  }
}
if (sql("SELECT 1 FROM pg_roles WHERE rolname = 'raero'") !== '1') sql('CREATE ROLE raero LOGIN');
sql(`SET log_statement = 'none'; SET log_min_error_statement = 'panic'; SET password_encryption = 'scram-sha-256';
ALTER ROLE raero WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}';`);
if (sql("SELECT 1 FROM pg_database WHERE datname = 'raero'") !== '1') sql('CREATE DATABASE raero OWNER raero');
// This file belongs to the embedded cluster; external database configurations are not used here.
writeFileSync(join(dataDir, 'pg_hba.conf'), '# Managed by R-AERO embedded database startup\nlocal all all peer\nhost raero raero 127.0.0.1/32 scram-sha-256\n', { mode: 0o600 });
const postgresUid = Number(execFileSync('id', ['-u', 'postgres'], { encoding: 'utf8' }).trim());
const postgresGid = Number(execFileSync('id', ['-g', 'postgres'], { encoding: 'utf8' }).trim());
chownSync(join(dataDir, 'pg_hba.conf'), postgresUid, postgresGid);
if (sql('SELECT pg_reload_conf()') !== 't') throw new Error('Embedded database authentication reload failed');
console.log('[entrypoint] PostgreSQL: credential persisted; administrative privileges removed.');
