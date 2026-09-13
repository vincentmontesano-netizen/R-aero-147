import type { Express } from 'express';
import { sql } from 'drizzle-orm';
import { getDb } from '../db';

async function databaseReady(): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable');
  // Exercise the same pool and an application table, not only a TCP connection.
  await db.execute(sql`select id from users limit 0`);
}

export function registerHealthRoutes(app: Express, check = databaseReady, timeoutMs = 2000) {
  let pending: Promise<boolean> | undefined;
  let cached: { ready: boolean; until: number } | undefined;
  function readiness() {
    if (cached && cached.until > Date.now()) return Promise.resolve(cached.ready);
    if (!pending) {
      // Keep one check in flight even after an HTTP timeout; repeated requests must
      // not accumulate queries in a stalled application pool.
      pending = Promise.resolve().then(check).then(() => true, () => false).finally(() => { pending = undefined; });
    }
    const current = pending;
    return new Promise<boolean>(resolve => {
      const finish = (ready: boolean) => {
        clearTimeout(timer);
        cached = { ready, until: Date.now() + 1000 };
        resolve(ready);
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      void current.then(finish);
    });
  }
  app.get('/health/live', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ status: 'alive' });
  });
  app.get('/health/ready', async (_req, res) => {
    const ready = await readiness();
    res.set('Cache-Control', 'no-store').status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'unavailable' });
  });
}
