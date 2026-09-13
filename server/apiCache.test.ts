import { afterAll, beforeAll, expect, it } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { initTRPC, TRPCError } from '@trpc/server';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { preventApiCaching } from './_core/apiCache';

let server: Server;
let base: string;
beforeAll(async () => {
  const t = initTRPC.create();
  const router = t.router({
    me: t.procedure.query(() => ({ id: 1, name: 'Private fixture' })),
    catalogue: t.procedure.query(() => ['Public fixture']),
    denied: t.procedure.query(() => { throw new TRPCError({ code: 'UNAUTHORIZED' }); }),
  });
  const app = express();
  app.use('/api/trpc', preventApiCaching);
  app.use(express.json());
  app.use('/api/trpc', createExpressMiddleware({ router }));
  app.get('/', (_req, res) => res.send('Static fixture'));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(400).send('Bad body'); });
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test address');
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

it('disables caching for account reads and mixed public/private batches without changing static responses', async () => {
  for (const path of ['/api/trpc/me', '/api/trpc/me,catalogue?batch=1']) {
    const response = await fetch(base + path);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.text()).toContain('Private fixture');
  }
  const page = await fetch(base + '/');
  expect(page.headers.get('cache-control')).toBeNull();
  await page.text();
});
it('keeps no-store on authorization errors and malformed request bodies', async () => {
  const denied = await fetch(base + '/api/trpc/denied');
  expect(denied.status).toBe(401);
  expect(denied.headers.get('cache-control')).toBe('private, no-store');
  await denied.text();
  const malformed = await fetch(base + '/api/trpc/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
  expect(malformed.status).toBe(400);
  expect(malformed.headers.get('cache-control')).toBe('private, no-store');
  await malformed.text();
});
