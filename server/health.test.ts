import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import { registerHealthRoutes } from './_core/health';

async function withHealth(check: () => Promise<void>, run: (origin: string) => Promise<void>, timeout = 100) {
  const app = express();
  registerHealthRoutes(app, check, timeout);
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as {port: number};
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

describe('operational health HTTP', () => {
  it('keeps liveness separate from readiness and conceals failures', async () => {
    const check = vi.fn(async () => { throw new Error('secret database diagnostic'); });
    await withHealth(check, async origin => {
      expect((await fetch(`${origin}/health/live`)).status).toBe(200);
      expect(check).not.toHaveBeenCalled();
      const ready = await fetch(`${origin}/health/ready`);
      expect(ready.status).toBe(503);
      expect(ready.headers.get('cache-control')).toBe('no-store');
      expect(await ready.json()).toEqual({status: 'unavailable'});
    });
  });
  it('reports an available database and briefly reuses the result', async () => {
    const check = vi.fn(async () => {});
    await withHealth(check, async origin => {
      for (let i = 0; i < 3; i++) expect((await fetch(`${origin}/health/ready`)).status).toBe(200);
      expect(check).toHaveBeenCalledTimes(1);
    });
  });
  it('bounds requests without accumulating stalled pool queries', async () => {
    let release!: () => void;
    const check = vi.fn(() => new Promise<void>(resolve => { release = resolve; }));
    await withHealth(check, async origin => {
      const results = await Promise.all(Array.from({length: 5}, () => fetch(`${origin}/health/ready`)));
      expect(results.map(result => result.status)).toEqual([503,503,503,503,503]);
      expect(check).toHaveBeenCalledTimes(1);
      release();
    }, 25);
  });
});
