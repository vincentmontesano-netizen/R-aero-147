import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { eq, sql } from 'drizzle-orm';
import { getDb } from './db';
import { users } from '../drizzle/schema';
import { createPasswordReset, resetPasswordWithToken, InvalidPasswordResetTokenError } from './auth';
import { passwordResetOrigin } from './authOrigin';
import { appRouter } from './routers';
import * as email from './email';
const url = process.env.RAERO_TEST_DATABASE_URL;
const hash = (value:string) => createHash('sha256').update(value).digest('hex');
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it('only permits a configured canonical HTTPS recovery origin in production', () => {
  vi.stubEnv('NODE_ENV','production'); vi.stubEnv('APP_ORIGIN','');
  for (const value of ['', 'http://localhost:3000','https://user:pass@example.test','https://example.test/path','https://example.test?query=yes','https://example.test/#fragment']) {
    vi.stubEnv('PUBLIC_APP_URL',value);
    expect(() => passwordResetOrigin()).toThrow();
  }
  vi.stubEnv('PUBLIC_APP_URL','https://academy.example.test');
  expect(passwordResetOrigin()).toBe('https://academy.example.test');
});

describe.skipIf(!url)('password recovery boundary · PostgreSQL', () => {
  beforeAll(() => { process.env.DATABASE_URL=url!; });
  async function fixture() {
    const db=(await getDb())!;
    const [user]=await db.insert(users).values({openId:randomUUID(),email:`${randomUUID()}@example.test`,name:'Recovery fixture'}).returning();
    const caller=appRouter.createCaller({user:null,req:{headers:{},ip:randomUUID()} as never,res:{} as never});
    return {db,user,caller};
  }
  it('ignores an attacker-supplied origin and never exposes the token in its API response', async () => {
    const {db,user,caller}=await fixture();
    vi.stubEnv('NODE_ENV','production'); vi.stubEnv('PUBLIC_APP_URL','https://academy.example.test');
    vi.spyOn(email,'isEmailConfigured').mockReturnValue(true);
    const send=vi.spyOn(email,'sendEmail').mockResolvedValue({sent:true});
    expect(await caller.auth.requestPasswordReset({email:user.email!,origin:'https://attacker.example.test'})).toEqual({ok:true});
    expect(send).toHaveBeenCalledTimes(1);
    const html=send.mock.calls[0][0].html;
    expect(html).not.toContain('attacker.example.test');
    expect(html).toContain('https://academy.example.test/reset-password?token=');
    const token=html.match(/reset-password\?token=([A-Za-z0-9_-]+)/)![1];
    const [stored]=await db.select().from(users).where(eq(users.id,user.id));
    expect(stored.resetToken).toBe(hash(token));
    expect(stored.resetToken).not.toBe(token);
    await expect(resetPasswordWithToken(stored.resetToken!,'new-password-fixture')).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);
    await expect(resetPasswordWithToken(token,'new-password-fixture')).resolves.toEqual({ok:true});
    await expect(caller.auth.resetPassword({token,password:'another-password-fixture'})).rejects.toMatchObject({code:'BAD_REQUEST',message:'Lien de réinitialisation invalide ou expiré.'});
  });
  it('keeps responses neutral and does not create links without valid delivery configuration', async () => {
    const {db,user,caller}=await fixture();
    vi.spyOn(console,'warn').mockImplementation(()=>{});
    vi.spyOn(email,'isEmailConfigured').mockReturnValue(true);
    const send=vi.spyOn(email,'sendEmail').mockResolvedValue({sent:true});
    vi.stubEnv('NODE_ENV','production'); vi.stubEnv('PUBLIC_APP_URL',''); vi.stubEnv('APP_ORIGIN','');
    expect(await caller.auth.requestPasswordReset({email:user.email!,origin:'https://attacker.example.test'})).toEqual({ok:true});
    vi.stubEnv('PUBLIC_APP_URL','https://academy.example.test');
    expect(await caller.auth.requestPasswordReset({email:`${randomUUID()}@example.test`})).toEqual({ok:true});
    vi.spyOn(email,'isEmailConfigured').mockReturnValue(false);
    expect(await caller.auth.requestPasswordReset({email:user.email!})).toEqual({ok:true});
    expect(send).not.toHaveBeenCalled();
    expect((await db.select().from(users).where(eq(users.id,user.id)))[0].resetToken).toBeNull();
  });
  it('preserves legacy pending links with the actual migration expression and hashes newly issued tokens', async () => {
    const {db,user}=await fixture();
    const legacy=randomUUID();
    await db.update(users).set({resetToken:legacy,resetTokenExpiresAt:new Date(Date.now()+60000)}).where(eq(users.id,user.id));
    const migration=await readFile(new URL('../drizzle/migrations/20260913_reset_token_hash.sql',import.meta.url),'utf8');
    // Scope the real migration to this fixture; do not rehash other workers' records.
    await db.execute(sql.raw(migration.replace(/;\s*$/,` AND id = ${user.id};`)));
    expect((await db.select().from(users).where(eq(users.id,user.id)))[0].resetToken).toBe(hash(legacy));
    await expect(resetPasswordWithToken(legacy,'legacy-recovery-fixture')).resolves.toEqual({ok:true});
    const next=await createPasswordReset(user.email!);
    expect((await db.select().from(users).where(eq(users.id,user.id)))[0].resetToken).toBe(hash(next!.token));
  });
});
