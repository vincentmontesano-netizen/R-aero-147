import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllEnvs());

it('reports unavailable learning records instead of an empty dashboard or missing enrollment', async () => {
  vi.stubEnv('DATABASE_URL', '');
  const db = await import('./db');
  expect(await db.getDb()).toBeNull();
  for (const read of [
    () => db.getUserEnrollments(1),
    () => db.getEnrollmentById(1, 1),
    () => db.getUserCertificates(1),
  ]) {
    await expect(read()).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  }
});
