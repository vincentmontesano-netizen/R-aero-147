import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import { trustedProxies } from './_core/proxy';
import { getSessionCookieOptions } from './_core/cookies';
import { ipFromReq } from './access';

afterEach(() => vi.unstubAllEnvs());
async function request(proxy: string, headers: Record<string,string>) {
  const app = express();
  app.set('trust proxy', trustedProxies(proxy));
  app.get('/', (req, res) => res.json({ip: ipFromReq(req), cookie: getSessionCookieOptions(req)}));
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    return await (await fetch(`http://127.0.0.1:${(server.address() as {port:number}).port}`, {headers})).json();
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}

describe('trusted proxy and session boundaries', () => {
  it('rejects blanket trust, hop counts and invalid networks', () => {
    for (const value of ['true','1','0.0.0.0/0','::/0','127.0.0.1/33','::1/129','host.example','127.0.0.1,']) expect(() => trustedProxies(value)).toThrow();
    expect(trustedProxies('')).toBe(false);
    expect(trustedProxies('false')).toBe(false);
    expect(trustedProxies('127.0.0.1, 10.20.30.0/24, ::1')).toEqual(['127.0.0.1','10.20.30.0/24','::1']);
  });
  it('ignores forged forwarding headers from a direct client', async () => {
    vi.stubEnv('NODE_ENV','test');
    const result = await request('', {'x-forwarded-for':'203.0.113.99', 'x-forwarded-proto':'https'});
    expect(result.ip).toBe('127.0.0.1');
    expect(result.cookie).toMatchObject({secure:false,sameSite:'lax',httpOnly:true});
  });
  it('uses the nearest untrusted address behind a configured proxy', async () => {
    const result = await request('127.0.0.1', {'x-forwarded-for':'203.0.113.99, 198.51.100.24', 'x-forwarded-proto':'https'});
    expect(result.ip).toBe('198.51.100.24');
    expect(result.cookie).toMatchObject({secure:true,sameSite:'lax'});
  });
  it('does not search arbitrary forwarded protocol values for HTTPS', async () => {
    vi.stubEnv('NODE_ENV','test');
    expect((await request('127.0.0.1', {'x-forwarded-proto':'http, https'})).cookie.secure).toBe(false);
  });
  it('requires secure cookies in production even without a proxy setting', async () => {
    vi.stubEnv('NODE_ENV','production');
    expect((await request('', {})).cookie).toMatchObject({secure:true,sameSite:'lax',httpOnly:true});
  });
});
