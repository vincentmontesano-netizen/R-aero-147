import * as emailService from "./email";
import { afterEach, afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { eq, sql } from 'drizzle-orm';
import { getDb } from './db';
import { users } from '../drizzle/schema';
import { beginTwoFactorChange, confirmTwoFactorChange, revokeAllSessions, hashPassword, resetPasswordWithToken, startTwoFactor, verifyTwoFactorCode } from './auth';
import { sdk } from './_core/sdk';
import { ENV } from './_core/env';
import { createContext } from './_core/context';
import { COOKIE_NAME } from '../shared/const';
import { appRouter } from './routers';
const url = process.env.RAERO_TEST_DATABASE_URL;

describe.skipIf(!url)('session revocation and single-use credentials · PostgreSQL', () => {
  const previousSecret = ENV.cookieSecret;
  beforeAll(() => { process.env.DATABASE_URL = url!; ENV.cookieSecret = 'isolated-session-signing-fixture-32-bytes'; });
  afterAll(() => { ENV.cookieSecret = previousSecret; vi.unstubAllEnvs(); });
  afterEach(() => vi.restoreAllMocks());
  async function fixture(enabled = true) {
    const db = (await getDb())!;
    const password = 'isolated-password-fixture';
    const [user] = await db.insert(users).values({openId:randomUUID(),email:`${randomUUID()}@example.test`,name:'Session fixture',passwordHash:await hashPassword(password),twoFactorEnabled:enabled}).returning();
    return {db,user,password};
  }
  const tokenFor = (user: typeof users.$inferSelect) => sdk.createSessionToken(user.openId, {name:user.name!,sessionVersion:user.sessionVersion});
  const contextFor = (token: string) => createContext({req:{headers:{cookie:`${COOKIE_NAME}=${token}`}} as never,res:{} as never,info:{} as never});

  it('atomically consumes a reset link, revokes old/legacy sessions and clears pending second factors', async () => {
    const {db,user} = await fixture();
    const token = await tokenFor(user);
    const legacy = await new SignJWT({openId:user.openId,appId:ENV.appId,name:user.name}).setProtectedHeader({alg:'HS256'}).setExpirationTime('1h').sign(new TextEncoder().encode(ENV.cookieSecret));
    expect((await contextFor(token)).user?.id).toBe(user.id);
    expect((await contextFor(legacy)).user?.id).toBe(user.id);
    const reset = randomUUID();
    await db.update(users).set({resetToken:createHash("sha256").update(reset).digest("hex"),resetTokenExpiresAt:new Date(Date.now()+60000),twoFactorCode:'123456',twoFactorExpiresAt:new Date(Date.now()+60000)}).where(eq(users.id,user.id));
    const results = await Promise.allSettled([resetPasswordWithToken(reset,'new-password-one'),resetPasswordWithToken(reset,'new-password-two')]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    expect(results.filter(result=>result.status==='rejected')).toHaveLength(1);
    expect((await contextFor(token)).user).toBeNull();
    expect((await contextFor(legacy)).user).toBeNull();
    const [updated] = await db.select().from(users).where(eq(users.id,user.id));
    expect(updated).toMatchObject({sessionVersion:1,resetToken:null,twoFactorCode:null,twoFactorExpiresAt:null});
    expect((await contextFor(await tokenFor(updated))).user?.id).toBe(user.id);
    const events = await db.execute(sql`select * from session_security_events where "userId"=${user.id}`);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({previousVersion:0,sessionVersion:1,reason:'password_changed'});
    await expect(db.execute(sql`delete from session_security_events where "userId"=${user.id}`)).rejects.toThrow();
    await expect(startTwoFactor(user.id,0)).rejects.toThrow();
  });

  it('does not revive prior cookies after account suspension is lifted', async () => {
    const {db,user}=await fixture();
    const token=await tokenFor(user);
    await db.update(users).set({status:'suspended'}).where(eq(users.id,user.id));
    expect((await contextFor(token)).user).toBeNull();
    await db.update(users).set({status:'active'}).where(eq(users.id,user.id));
    expect((await contextFor(token)).user).toBeNull();
    const [active]=await db.select().from(users).where(eq(users.id,user.id));
    expect(active.sessionVersion).toBe(2);
    expect((await contextFor(await tokenFor(active))).user?.id).toBe(user.id);
    await expect(db.update(users).set({sessionVersion:0}).where(eq(users.id,user.id))).rejects.toThrow();
  });

  it('consumes a second factor once and refuses disabled, expired or suspended challenges', async () => {
    const {db,user}=await fixture();
    const code=await startTwoFactor(user.id,user.sessionVersion);
    const results=await Promise.allSettled([verifyTwoFactorCode(user.email!,code),verifyTwoFactorCode(user.email!,code)]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    expect(results.filter(result=>result.status==='rejected')).toHaveLength(1);
    for (const patch of [{twoFactorEnabled:false},{twoFactorExpiresAt:new Date(0)},{status:'suspended' as const}]) {
      await db.update(users).set({twoFactorEnabled:true,twoFactorCode:createHmac('sha256',ENV.cookieSecret).update(`raero:email-2fa:v1:${user.id}:${user.sessionVersion}:123456`).digest('hex'),twoFactorExpiresAt:new Date(Date.now()+60000),...patch}).where(eq(users.id,user.id));
      await expect(verifyTwoFactorCode(user.email!,'123456')).rejects.toThrow();
    }
  });

  it('does not bypass an enabled second factor when SMTP is unavailable', async () => {
    const {user,password}=await fixture();
    vi.stubEnv('SMTP_HOST',''); vi.stubEnv('SMTP_USER',''); vi.stubEnv('SMTP_PASS','');
    const cookie=vi.fn();
    const caller=appRouter.createCaller({user:null,req:{headers:{},ip:'127.0.0.1'} as never,res:{cookie} as never});
    await expect(caller.auth.login({email:user.email!,password})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
    expect(cookie).not.toHaveBeenCalled();
    const wrongApp=await sdk.signSession({openId:user.openId,name:user.name!,appId:'another-app',sessionVersion:0});
    expect(await sdk.verifySession(wrongApp)).toBeNull();
  });
  it('reauthenticates self-revocation, clears the cookie and leaves other accounts intact', async () => {
    const {db,user,password}=await fixture();
    const other=await fixture();
    const ownToken=await tokenFor(user), otherToken=await tokenFor(other.user);
    const clearCookie=vi.fn();
    const caller=appRouter.createCaller({user,req:{headers:{},protocol:'https'} as never,res:{clearCookie} as never});
    await startTwoFactor(user.id,user.sessionVersion);
    await expect(caller.auth.revokeAllSessions({password:'incorrect'})).rejects.toMatchObject({code:'UNAUTHORIZED'});
    expect(clearCookie).not.toHaveBeenCalled();
    expect((await contextFor(ownToken)).user?.id).toBe(user.id);
    await expect(caller.auth.revokeAllSessions({password})).resolves.toEqual({ok:true});
    expect(clearCookie).toHaveBeenCalledWith(COOKIE_NAME,expect.objectContaining({maxAge:-1,httpOnly:true,sameSite:'lax'}));
    expect((await contextFor(ownToken)).user).toBeNull();
    expect((await contextFor(otherToken)).user?.id).toBe(other.user.id);
    const [updated]=await db.select().from(users).where(eq(users.id,user.id));
    expect(updated).toMatchObject({passwordHash:user.passwordHash,sessionVersion:1,twoFactorCode:null});
    const events=await db.execute(sql`select reason from session_security_events where "userId"=${user.id}`);
    expect(events).toEqual([{reason:'sessions_revoked'}]);
  });

  it('does not allow a stale or concurrent session to repeat revocation', async () => {
    const {db,user,password}=await fixture();
    const outcomes=await Promise.allSettled([revokeAllSessions(user.id,0,password),revokeAllSessions(user.id,0,password)]);
    expect(outcomes.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    expect(outcomes.filter(result=>result.status==='rejected')).toHaveLength(1);
    const [updated]=await db.select().from(users).where(eq(users.id,user.id));
    expect(updated.sessionVersion).toBe(1);
    expect((await contextFor(await tokenFor(updated))).user?.id).toBe(user.id);
  });

  it('persists a keyed digest and caps concurrent guesses across requests at eight', async () => {
    const {db,user}=await fixture();
    const code=await startTwoFactor(user.id,user.sessionVersion);
    const [issued]=await db.select().from(users).where(eq(users.id,user.id));
    expect(issued.twoFactorCode).toMatch(/^[a-f0-9]{64}$/);
    expect(issued.twoFactorCode).not.toBe(code);
    const wrong=code==='100000'?'100001':'100000';
    const failures=await Promise.allSettled(Array.from({length:16},()=>verifyTwoFactorCode(user.email!,wrong)));
    expect(failures.every(result=>result.status==='rejected')).toBe(true);
    const [blocked]=await db.select().from(users).where(eq(users.id,user.id));
    expect(blocked).toMatchObject({twoFactorAttempts:8,twoFactorCode:null,twoFactorExpiresAt:null});
    await expect(verifyTwoFactorCode(user.email!,code)).rejects.toThrow();
    await expect(startTwoFactor(user.id,user.sessionVersion)).rejects.toThrow();
    await db.update(users).set({twoFactorSentAt:new Date(Date.now()-61000)}).where(eq(users.id,user.id));
    const next=await startTwoFactor(user.id,user.sessionVersion);
    expect((await db.select().from(users).where(eq(users.id,user.id)))[0].twoFactorAttempts).toBe(0);
    expect((await verifyTwoFactorCode(user.email!,next)).id).toBe(user.id);
  });

  it('allows the correct code before the limit and binds stored digests to their account', async () => {
    const {db,user}=await fixture();
    const other=await fixture();
    const code=await startTwoFactor(user.id,user.sessionVersion);
    const [issued]=await db.select().from(users).where(eq(users.id,user.id));
    await db.update(users).set({twoFactorCode:issued.twoFactorCode,twoFactorExpiresAt:issued.twoFactorExpiresAt}).where(eq(users.id,other.user.id));
    await expect(verifyTwoFactorCode(other.user.email!,code)).rejects.toThrow();
    const wrong=code==='100000'?'100001':'100000';
    for (let attempt=0;attempt<7;attempt++) await expect(verifyTwoFactorCode(user.email!,wrong)).rejects.toThrow();
    expect((await verifyTwoFactorCode(user.email!,code)).id).toBe(user.id);
    await expect(verifyTwoFactorCode(user.email!,code)).rejects.toThrow();
  });

  it('only activates after password and purpose-bound code verification, revoking prior sessions', async () => {
    const {db,user,password}=await fixture(false);
    const oldToken=await tokenFor(user);
    await expect(beginTwoFactorChange(user.id,0,'incorrect',true)).rejects.toThrow();
    const challenge=await beginTwoFactorChange(user.id,0,password,true);
    expect((await db.select().from(users).where(eq(users.id,user.id)))[0].twoFactorEnabled).toBe(false);
    await expect(verifyTwoFactorCode(user.email!,challenge.code)).rejects.toThrow();
    const results=await Promise.allSettled([confirmTwoFactorChange(user.id,0,true,challenge.code),confirmTwoFactorChange(user.id,0,true,challenge.code)]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    expect(results.filter(result=>result.status==='rejected')).toHaveLength(1);
    const [updated]=await db.select().from(users).where(eq(users.id,user.id));
    expect(updated).toMatchObject({twoFactorEnabled:true,sessionVersion:1,twoFactorCode:null});
    expect((await contextFor(oldToken)).user).toBeNull();
    expect((await contextFor(await tokenFor(updated))).user?.id).toBe(user.id);
    expect(await db.execute(sql`select reason from session_security_events where "userId"=${user.id}`)).toEqual([{reason:'two_factor_changed'}]);
  });

  it('keeps 2FA enabled after failed disable codes and rejects cross-purpose reuse', async () => {
    const {db,user,password}=await fixture();
    const challenge=await beginTwoFactorChange(user.id,0,password,false);
    await expect(verifyTwoFactorCode(user.email!,challenge.code)).rejects.toThrow();
    await expect(confirmTwoFactorChange(user.id,0,true,challenge.code)).rejects.toThrow();
    const wrong=challenge.code==='100000'?'100001':'100000';
    for (let attempt=0;attempt<8;attempt++) await expect(confirmTwoFactorChange(user.id,0,false,wrong)).rejects.toThrow();
    await expect(confirmTwoFactorChange(user.id,0,false,challenge.code)).rejects.toThrow();
    expect((await db.select().from(users).where(eq(users.id,user.id)))[0]).toMatchObject({twoFactorEnabled:true,twoFactorAttempts:8});
    await db.update(users).set({twoFactorSentAt:new Date(0)}).where(eq(users.id,user.id));
    const next=await beginTwoFactorChange(user.id,0,password,false);
    expect(await confirmTwoFactorChange(user.id,0,false,next.code)).toMatchObject({twoFactorEnabled:false,sessionVersion:1});
  });

  it('requires delivery configuration and renews only the proven caller session after confirmation', async () => {
    const {db,user,password}=await fixture(false);
    const cookie=vi.fn();
    const caller=appRouter.createCaller({user,req:{headers:{},protocol:'https'} as never,res:{cookie} as never});
    const configured=vi.spyOn(emailService,'isEmailConfigured').mockReturnValue(false);
    const send=vi.spyOn(emailService,'sendEmail').mockResolvedValue({sent:true});
    await expect(caller.auth.beginTwoFactorChange({enabled:true,password})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
    expect(send).not.toHaveBeenCalled();
    expect((await db.select().from(users).where(eq(users.id,user.id)))[0].twoFactorCode).toBeNull();
    configured.mockReturnValue(true);
    expect(await caller.auth.beginTwoFactorChange({enabled:true,password})).toEqual({ok:true});
    const message=send.mock.calls[0][0];
    const code=message.html.match(/>([0-9]{6})<\/p>/)![1];
    expect(message.subject).not.toContain(code);
    expect(message.html).toContain('activation de la double authentification');
    expect(await caller.auth.confirmTwoFactorChange({enabled:true,code})).toEqual({ok:true});
    expect(cookie).toHaveBeenCalledTimes(1);
    expect((await contextFor(cookie.mock.calls[0][1])).user).toMatchObject({id:user.id,twoFactorEnabled:true,sessionVersion:1});
  });

  it('does not change the setting or issue a cookie when configuration email delivery fails', async () => {
    const {db,user,password}=await fixture(false);
    vi.spyOn(emailService,'isEmailConfigured').mockReturnValue(true);
    vi.spyOn(emailService,'sendEmail').mockResolvedValue({sent:false,error:'fixture transport failure'});
    const cookie=vi.fn();
    const caller=appRouter.createCaller({user,req:{headers:{}} as never,res:{cookie} as never});
    await expect(caller.auth.beginTwoFactorChange({enabled:true,password})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
    expect((await db.select().from(users).where(eq(users.id,user.id)))[0]).toMatchObject({twoFactorEnabled:false,sessionVersion:0});
    expect(cookie).not.toHaveBeenCalled();
  });

});
