import { describe, expect, it } from 'vitest';
import { securityHeaders } from './_core/securityHeaders';

const run = (secure: boolean) => {
  const headers: Record<string, string> = {};
  let nextCalled = false;
  securityHeaders({ secure } as any, { set: (k: string, v: string) => { headers[k] = v; } } as any, () => { nextCalled = true; });
  return { headers, nextCalled };
};

describe('security headers', () => {
  it('sets baseline headers and continues', () => {
    const { headers, nextCalled } = run(false);
    expect(nextCalled).toBe(true);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(headers['Strict-Transport-Security']).toBeUndefined();
  });
  it('adds HSTS only over HTTPS', () => {
    expect(run(true).headers['Strict-Transport-Security']).toContain('max-age=');
  });
});
