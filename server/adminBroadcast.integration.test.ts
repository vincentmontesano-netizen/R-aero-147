import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
vi.mock('./email', async original => ({...await original<typeof import('./email')>(), isEmailConfigured: vi.fn(() => true), sendEmail: vi.fn()}));
import { sendEmail, isEmailConfigured } from './email';
import { getDb } from './db';
import { appRouter } from './routers';
import { users, companies, affiliations, notifications, broadcastRuns, broadcastOutcomes, broadcastRecipients, broadcastRecipientOutcomes, broadcastPayloads, broadcastRetries } from '../drizzle/schema';
const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('admin broadcast outcomes · PostgreSQL, simulated SMTP', () => {
  beforeAll(() => {process.env.DATABASE_URL = url!;});
  beforeEach(() => {vi.mocked(sendEmail).mockReset().mockResolvedValue({sent: true}); vi.mocked(isEmailConfigured).mockReturnValue(true);});
  async function fixture() {
    const db = (await getDb())!;
    const [admin, member, missing, revoked, suspended, outsider] = await db.insert(users).values(Array.from({length: 6}, (_, index) => ({openId: randomUUID(), role: index === 0 ? 'admin' as const : 'user' as const, email: index === 2 ? null : `${randomUUID()}@example.test`, status: index === 4 ? 'suspended' as const : 'active' as const}))).returning();
    const [company] = await db.insert(companies).values({name: 'Broadcast fixture'}).returning();
    await db.insert(affiliations).values([member, missing, revoked, suspended, member].map(person => ({personId: person.id, orgId: company.id, status: person.id === revoked.id ? 'INACTIVE' : 'ACTIVE'})));
    await db.update(users).set({companyId: company.id}).where(eq(users.id, outsider.id));
    const api = appRouter.createCaller({user: admin, req:{headers:{}}, res:{}} as any).admin;
    return {db, admin, member, missing, revoked, suspended, outsider, company, api};
  }
  it('reconstructs a missing final summary without repeating email or notifications',async()=>{
    const f=await fixture(),name=`fail_broadcast_summary_${f.admin.id}`;
    const input={audience:`company:${f.company.id}`,title:randomUUID(),email:true,requestId:randomUUID()};
    await f.db.execute(sql.raw(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM broadcast_runs WHERE id=NEW."runId" AND "actorId"=${f.admin.id}) THEN RAISE EXCEPTION 'synthetic summary failure'; END IF; RETURN NEW; END $$`));
    await f.db.execute(sql.raw(`CREATE TRIGGER ${name} BEFORE INSERT ON broadcast_outcomes FOR EACH ROW EXECUTE FUNCTION ${name}()`));
    try{await expect(f.api.broadcast(input)).rejects.toThrow();}
    finally{await f.db.execute(sql.raw(`DROP TRIGGER ${name} ON broadcast_outcomes`));await f.db.execute(sql.raw(`DROP FUNCTION ${name}()`));}
    const [run]=await f.db.select().from(broadcastRuns).where(eq(broadcastRuns.requestId,input.requestId));
    expect(await f.db.select().from(broadcastOutcomes).where(eq(broadcastOutcomes.runId,run.id))).toHaveLength(0);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const results=await Promise.all([f.api.broadcast(input),f.api.broadcast(input)]);
    for(const result of results)expect(result).toEqual({sent:2,recipients:2,email:{requested:true,accepted:1,failed:0,skipped:1}});
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(await f.db.select().from(notifications).where(eq(notifications.title,input.title))).toHaveLength(2);
    expect(await f.db.select().from(broadcastOutcomes).where(eq(broadcastOutcomes.runId,run.id))).toHaveLength(1);
  });
  it('allows explicit summary recovery only for complete journals and active administrators',async()=>{
    const f=await fixture();
    const [run]=await f.db.insert(broadcastRuns).values({actorId:f.admin.id,title:'Recovery fixture',userId:f.member.id,recipients:1,sent:0,emailRequested:true}).returning();
    const [recipient]=await f.db.insert(broadcastRecipients).values({runId:run.id,userId:f.member.id}).returning();
    await expect(f.api.recoverBroadcastOutcome({runId:run.id})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
    expect(await f.db.select().from(broadcastOutcomes).where(eq(broadcastOutcomes.runId,run.id))).toHaveLength(0);
    await f.db.insert(broadcastRecipientOutcomes).values({recipientId:recipient.id,status:'skipped_configuration'});
    expect(await f.api.recoverBroadcastOutcome({runId:run.id})).toMatchObject({accepted:0,failed:0,skipped:1});
    expect(sendEmail).not.toHaveBeenCalled();
    await f.db.update(users).set({status:'suspended'}).where(eq(users.id,f.admin.id));
    await expect(f.api.recoverBroadcastOutcome({runId:run.id})).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it('uses the same distinct active company members for both channels and reports failed/missing emails', async () => {
    const f = await fixture(); vi.mocked(sendEmail).mockResolvedValue({sent:false, error:'simulated'});
    const title = randomUUID();
    const result = await f.api.broadcast({audience:`company:${f.company.id}`, title, email:true});
    expect(result).toEqual({sent:2, recipients:2, email:{requested:true, accepted:0, failed:1, skipped:1}});
    expect((await f.db.select().from(notifications).where(eq(notifications.title,title))).map(row=>row.userId).sort()).toEqual([f.member.id,f.missing.id].sort());
    expect(sendEmail).toHaveBeenCalledTimes(1);expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({to:f.member.email}));
  });
  it('supports a single recipient without an audience and email-only dispatch, and never reports skipped mail as sent', async () => {
    const f = await fixture();const title = randomUUID();
    expect(await f.api.broadcast({userId:f.member.id,title,email:true,inApp:false})).toEqual({sent:0,recipients:1,email:{requested:true,accepted:1,failed:0,skipped:0}});
    expect(await f.db.select().from(notifications).where(eq(notifications.title,title))).toHaveLength(0);
    vi.mocked(isEmailConfigured).mockReturnValue(false);
    expect(await f.api.broadcast({userId:f.member.id,title,email:true})).toMatchObject({sent:1,email:{accepted:0,failed:0,skipped:1}});
    expect(sendEmail).toHaveBeenCalledTimes(1);
    vi.mocked(isEmailConfigured).mockReturnValue(true);vi.mocked(sendEmail).mockRejectedValue(new Error('simulated transport exception'));
    expect(await f.api.broadcast({userId:f.member.id,title,email:true,inApp:false})).toMatchObject({email:{failed:1}});
  });
  it('records the dispatch before SMTP and retains an immutable complete outcome', async () => {
    const f = await fixture(); const title = randomUUID();
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>(resolve => {entered = resolve;});
    const gate = new Promise<void>(resolve => {release = resolve;});
    vi.mocked(sendEmail).mockImplementationOnce(async () => {entered(); await gate; return {sent:false};});
    const pending = f.api.broadcast({userId:f.member.id,title,email:true});
    await started;
    let during;
    try { during = (await f.api.broadcastHistory({})).entries.find(row => row.run.title === title); }
    finally {release();}
    await pending;
    expect(during).toMatchObject({run:{title,recipients:1,sent:1,emailRequested:true},outcome:null});
    const [run] = await f.db.select().from(broadcastRuns).where(eq(broadcastRuns.title,title));
    expect((await f.api.broadcastHistory({})).entries.find(row => row.run.id === run.id)).toMatchObject({outcome:{accepted:0,failed:1,skipped:0}});
    expect(Object.keys(run).sort()).toEqual(['id','actorId','title','audience','userId','recipients','sent','emailRequested','createdAt','requestId','fingerprint'].sort());
    await expect(f.db.update(broadcastRuns).set({title:'rewrite'}).where(eq(broadcastRuns.id,run.id))).rejects.toThrow();
    await expect(f.db.update(broadcastOutcomes).set({accepted:1}).where(eq(broadcastOutcomes.runId,run.id))).rejects.toThrow();
    await expect(f.db.delete(broadcastRuns).where(eq(broadcastRuns.id,run.id))).rejects.toThrow();
    await expect(f.db.delete(broadcastOutcomes).where(eq(broadcastOutcomes.runId,run.id))).rejects.toThrow();
    await expect(f.db.execute(sql`truncate broadcast_outcomes`)).rejects.toThrow();
    const [incomplete] = await f.db.insert(broadcastRuns).values({actorId:f.admin.id,title:'Inconsistent outcome test',audience:'all',recipients:2,sent:2,emailRequested:true}).returning();
    await expect(f.db.insert(broadcastOutcomes).values({runId:incomplete.id,accepted:1,failed:0,skipped:0})).rejects.toThrow();
  });
  it('paginates history by stable cursor and rechecks admin access', async () => {
    const f = await fixture();
    const records = await f.db.insert(broadcastRuns).values(Array.from({length:55},(_,index)=>({actorId:f.admin.id,title:`History ${index}`,audience:'all',recipients:0,sent:0,emailRequested:false}))).returning();
    const first = await f.api.broadcastHistory({});expect(first.entries).toHaveLength(50);expect(first.nextCursor).toBeTruthy();
    await f.db.insert(broadcastRuns).values({actorId:f.admin.id,title:'New arrival',audience:'all',recipients:0,sent:0,emailRequested:false});
    const next = await f.api.broadcastHistory({beforeId:first.nextCursor!});
    expect(next.entries.some(row => first.entries.some(previous => previous.run.id === row.run.id))).toBe(false);
    expect(next.entries.filter(row=>records.slice(0,5).some(record=>record.id===row.run.id))).toHaveLength(5);
    await expect(f.api.broadcastHistory({beforeId:-1})).rejects.toMatchObject({code:'BAD_REQUEST'});
    const outsider = appRouter.createCaller({user:f.member,req:{headers:{}},res:{}} as any);
    await expect(outsider.admin.broadcastHistory({})).rejects.toMatchObject({code:'FORBIDDEN'});
    await f.db.update(users).set({status:'suspended'}).where(eq(users.id,f.admin.id));
    await expect(f.api.broadcastHistory({})).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it('claims a request once before SMTP and returns the recorded result on retry', async () => {
    const f = await fixture();const title = randomUUID(); const input = {userId:f.member.id,title,email:true,requestId:randomUUID()};
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>(resolve => {entered = resolve;});const gate = new Promise<void>(resolve => {release = resolve;});
    vi.mocked(sendEmail).mockImplementationOnce(async () => {entered();await gate;return {sent:true};});
    const pending = f.api.broadcast(input);await started;
    try {
      await expect(f.api.broadcast({...input,requestId:input.requestId.toUpperCase()})).rejects.toMatchObject({code:'CONFLICT'});
      expect(sendEmail).toHaveBeenCalledTimes(1);
    } finally {release();}
    const result = await pending;
    expect(await f.api.broadcast(input)).toEqual(result);
    expect(await f.api.broadcast(Object.fromEntries(Object.entries(input).reverse()) as typeof input)).toEqual(result);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(await f.db.select().from(notifications).where(eq(notifications.title,title))).toHaveLength(1);
    expect(await f.db.select().from(broadcastRuns).where(eq(broadcastRuns.requestId,input.requestId))).toHaveLength(1);
    await expect(f.api.broadcast({...input,body:'Different message'})).rejects.toMatchObject({code:'CONFLICT'});
    await expect(f.api.broadcast({...input,email:false})).rejects.toMatchObject({code:'CONFLICT'});
    await f.db.update(users).set({status:'suspended'}).where(eq(users.id,f.member.id));
    expect(await f.api.broadcast(input)).toEqual(result);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    await f.db.update(users).set({role:'user'}).where(eq(users.id,f.admin.id));
    await expect(f.api.broadcast(input)).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it('keeps request identities separate per administrator and excludes them from history', async () => {
    const f = await fixture();const input = {userId:f.member.id,title:randomUUID(),email:true,requestId:randomUUID()};
    await f.api.broadcast(input);
    const [peer] = await f.db.insert(users).values({openId:randomUUID(),role:'admin'}).returning();
    const peerApi = appRouter.createCaller({user:peer,req:{headers:{}},res:{}} as any).admin;
    await peerApi.broadcast(input);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(await f.db.select().from(broadcastRuns).where(eq(broadcastRuns.requestId,input.requestId))).toHaveLength(2);
    const history = await f.api.broadcastHistory({});
    expect(history.entries.find(row=>row.run.title===input.title)?.run).not.toHaveProperty('requestId');
    expect(history.entries.find(row=>row.run.title===input.title)?.run).not.toHaveProperty('fingerprint');
    await expect(f.api.broadcast({...input,requestId:'invalid'})).rejects.toMatchObject({code:'BAD_REQUEST'});
  });
  it('retains per-recipient states and never creates new deliveries during request recovery', async () => {
    const f = await fixture();const input = {audience:`company:${f.company.id}`,title:randomUUID(),email:true,requestId:randomUUID()};
    vi.mocked(sendEmail).mockResolvedValueOnce({sent:false});
    await f.api.broadcast(input);
    const [run] = await f.db.select().from(broadcastRuns).where(eq(broadcastRuns.title,input.title));
    const detail = await f.api.broadcastRecipients({runId:run.id});
    expect(detail.entries).toHaveLength(2);
    expect(detail.entries.find(row=>row.recipient.userId===f.member.id)?.outcome?.status).toBe('unconfirmed');
    expect(detail.entries.find(row=>row.recipient.userId===f.missing.id)?.outcome?.status).toBe('skipped_missing_email');
    await f.api.broadcast(input);expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(await f.api.broadcastRecipients({runId:run.id})).toEqual(detail);
    await expect(f.db.update(broadcastRecipients).set({userId:f.admin.id}).where(eq(broadcastRecipients.runId,run.id))).rejects.toThrow();
    const id = detail.entries[0].recipient.id;
    await expect(f.db.update(broadcastRecipientOutcomes).set({status:'accepted'}).where(eq(broadcastRecipientOutcomes.recipientId,id))).rejects.toThrow();
    await expect(f.db.delete(broadcastRecipientOutcomes).where(eq(broadcastRecipientOutcomes.recipientId,id))).rejects.toThrow();
    await expect(f.db.execute(sql`truncate broadcast_recipient_outcomes`)).rejects.toThrow();
    for(const entry of detail.entries) expect(entry.recipient).not.toHaveProperty('email');
  });
  it('paginates recorded recipients and leaves missing outcomes explicitly unknown', async () => {
    const f = await fixture();
    const people = await f.db.insert(users).values(Array.from({length:55},()=>({openId:randomUUID()}))).returning();
    const [run] = await f.db.insert(broadcastRuns).values({actorId:f.admin.id,title:'Recipients pagination',audience:'all',recipients:55,sent:55,emailRequested:true}).returning();
    await f.db.insert(broadcastRecipients).values(people.map(person=>({runId:run.id,userId:person.id})));
    const first = await f.api.broadcastRecipients({runId:run.id});expect(first.entries).toHaveLength(50);expect(first.entries.every(row=>row.outcome===null)).toBe(true);
    const next = await f.api.broadcastRecipients({runId:run.id,beforeId:first.nextCursor!});expect(next.entries).toHaveLength(5);expect(next.nextCursor).toBeNull();
    expect(new Set([...first.entries,...next.entries].map(row=>row.recipient.id)).size).toBe(55);
    const outsider = appRouter.createCaller({user:f.member,req:{headers:{}},res:{}} as any);
    await expect(outsider.admin.broadcastRecipients({runId:run.id})).rejects.toMatchObject({code:'FORBIDDEN'});
    await expect(f.api.broadcastRecipients({runId:2147483647})).rejects.toMatchObject({code:'NOT_FOUND'});
    await f.db.update(users).set({status:'suspended'}).where(eq(users.id,f.admin.id));
    await expect(f.api.broadcastRecipients({runId:run.id})).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it('rechecks account, address, company and affiliation changes before later SMTP calls', async () => {
    for(const change of ['recipient_status','recipient_email','affiliation','company','actor_role','actor_status']) {
      const f = await fixture(); const secondEmail = `${randomUUID()}@example.test`;
      await f.db.update(users).set({email:secondEmail}).where(eq(users.id,f.missing.id));
      vi.mocked(sendEmail).mockClear();
      vi.mocked(sendEmail).mockImplementationOnce(async opts => {
        const otherId = opts.to === f.member.email ? f.missing.id : f.member.id;
        if(change==='recipient_status') await f.db.update(users).set({status:'suspended'}).where(eq(users.id,otherId));
        if(change==='recipient_email') await f.db.update(users).set({email:`${randomUUID()}@example.test`}).where(eq(users.id,otherId));
        if(change==='affiliation') await f.db.update(affiliations).set({status:'INACTIVE'}).where(eq(affiliations.personId,otherId));
        if(change==='company') await f.db.update(companies).set({status:'SUSPENDED'}).where(eq(companies.id,f.company.id));
        if(change==='actor_role') await f.db.update(users).set({role:'user'}).where(eq(users.id,f.admin.id));
        if(change==='actor_status') await f.db.update(users).set({status:'suspended'}).where(eq(users.id,f.admin.id));
        return {sent:true};
      });
      const title = randomUUID();
      expect(await f.api.broadcast({audience:`company:${f.company.id}`,title,email:true})).toMatchObject({sent:2,recipients:2,email:{accepted:1,failed:0,skipped:1}});
      expect(sendEmail).toHaveBeenCalledTimes(1);
      const [run] = await f.db.select().from(broadcastRuns).where(eq(broadcastRuns.title,title));
      const states = await f.db.select({status:broadcastRecipientOutcomes.status}).from(broadcastRecipients)
        .innerJoin(broadcastRecipientOutcomes,eq(broadcastRecipientOutcomes.recipientId,broadcastRecipients.id)).where(eq(broadcastRecipients.runId,run.id));
      expect(states.map(row=>row.status).sort()).toEqual(['accepted','skipped_access']);
    }
  });
  it('previews retained content and retries one skipped recipient once without new in-app notifications', async () => {
    const f = await fixture();const title=randomUUID(),body='Original <content> & details';
    vi.mocked(isEmailConfigured).mockReturnValue(false);
    await f.api.broadcast({audience:`company:${f.company.id}`,title,body,email:true});
    const [run]=await f.db.select().from(broadcastRuns).where(eq(broadcastRuns.title,title));
    const recipient=(await f.api.broadcastRecipients({runId:run.id})).entries.find(row=>row.recipient.userId===f.member.id)!.recipient;
    expect(await f.api.previewBroadcastRetry({recipientId:recipient.id})).toMatchObject({title,body,email:f.member.email,reason:'configuration'});
    vi.mocked(isEmailConfigured).mockReturnValue(true);
    expect(await f.api.previewBroadcastRetry({recipientId:recipient.id})).toMatchObject({reason:null,scopeOrgId:f.company.id});
    let entered!:()=>void,release!:()=>void;const started=new Promise<void>(resolve=>{entered=resolve;});const gate=new Promise<void>(resolve=>{release=resolve;});
    vi.mocked(sendEmail).mockImplementationOnce(async()=>{entered();await gate;return {sent:true};});
    const input={recipientId:recipient.id,expectedEmail:f.member.email!,requestId:randomUUID()};
    const pending=f.api.retryBroadcastRecipient(input);await started;
    try {await expect(f.api.retryBroadcastRecipient({...input,requestId:randomUUID()})).rejects.toMatchObject({code:'CONFLICT'});} finally {release();}
    const result=await pending;expect(result).toMatchObject({sent:0,recipients:1,email:{accepted:1,failed:0,skipped:0}});
    expect(await f.api.retryBroadcastRecipient({...input,requestId:randomUUID()})).toEqual(result);
    expect(sendEmail).toHaveBeenCalledTimes(1);expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({to:f.member.email,html:expect.stringContaining('Original &lt;content&gt; &amp; details')}));
    expect(await f.db.select().from(notifications).where(eq(notifications.title,title))).toHaveLength(2);
    const links=await f.db.select().from(broadcastRetries).where(eq(broadcastRetries.sourceRecipientId,recipient.id));expect(links).toHaveLength(1);expect(links[0].scopeOrgId).toBe(f.company.id);
    await expect(f.db.update(broadcastPayloads).set({body:'rewrite'}).where(eq(broadcastPayloads.runId,run.id))).rejects.toThrow();
    await expect(f.db.delete(broadcastRetries).where(eq(broadcastRetries.sourceRecipientId,recipient.id))).rejects.toThrow();
  });
  it('excludes accepted, unconfirmed and historical payload-less messages from targeted retries', async () => {
    const f=await fixture();
    for(const sent of [true,false]) {
      vi.mocked(sendEmail).mockResolvedValueOnce({sent});const title=randomUUID();
      await f.api.broadcast({userId:f.member.id,title,email:true});
      const [run]=await f.db.select().from(broadcastRuns).where(eq(broadcastRuns.title,title));
      const [recipient]=await f.db.select().from(broadcastRecipients).where(eq(broadcastRecipients.runId,run.id));
      await expect(f.api.previewBroadcastRetry({recipientId:recipient.id})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
      await expect(f.api.retryBroadcastRecipient({recipientId:recipient.id,expectedEmail:f.member.email!,requestId:randomUUID()})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
    }
    const [legacy]=await f.db.insert(broadcastRuns).values({actorId:f.admin.id,title:'Legacy missing payload',userId:f.member.id,recipients:1,sent:0,emailRequested:true}).returning();
    const [recipient]=await f.db.insert(broadcastRecipients).values({runId:legacy.id,userId:f.member.id}).returning();
    await expect(f.api.previewBroadcastRetry({recipientId:recipient.id})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
    await f.db.insert(broadcastRecipientOutcomes).values({recipientId:recipient.id,status:'skipped_configuration'});
    await expect(f.api.previewBroadcastRetry({recipientId:recipient.id})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });
  it('rejects a changed preview address and preserves company scope across skipped retries', async () => {
    const f=await fixture();vi.mocked(isEmailConfigured).mockReturnValue(false);
    const title=randomUUID();await f.api.broadcast({audience:`company:${f.company.id}`,title,email:true});
    const [run]=await f.db.select().from(broadcastRuns).where(eq(broadcastRuns.title,title));
    const source=(await f.api.broadcastRecipients({runId:run.id})).entries.find(row=>row.recipient.userId===f.member.id)!.recipient;
    vi.mocked(isEmailConfigured).mockReturnValue(true);
    await f.api.previewBroadcastRetry({recipientId:source.id});
    const changedEmail=`${randomUUID()}@example.test`;await f.db.update(users).set({email:changedEmail}).where(eq(users.id,f.member.id));
    await expect(f.api.retryBroadcastRecipient({recipientId:source.id,expectedEmail:f.member.email!,requestId:randomUUID()})).rejects.toMatchObject({code:'CONFLICT'});
    // SMTP becomes unavailable after preview validation, before the actual send.
    vi.mocked(isEmailConfigured).mockReturnValueOnce(true).mockReturnValue(false);
    expect(await f.api.retryBroadcastRecipient({recipientId:source.id,expectedEmail:changedEmail,requestId:randomUUID()})).toMatchObject({email:{accepted:0,skipped:1}});
    const [link]=await f.db.select().from(broadcastRetries).where(eq(broadcastRetries.sourceRecipientId,source.id));
    const [child]=await f.db.select().from(broadcastRecipients).where(eq(broadcastRecipients.runId,link.runId));
    vi.mocked(isEmailConfigured).mockReturnValue(true);await f.db.update(affiliations).set({status:'INACTIVE'}).where(eq(affiliations.personId,f.member.id));
    expect(await f.api.previewBroadcastRetry({recipientId:child.id})).toMatchObject({reason:'access',scopeOrgId:f.company.id});
    await expect(f.api.retryBroadcastRecipient({recipientId:child.id,expectedEmail:changedEmail,requestId:randomUUID()})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
    await f.db.update(users).set({role:'user'}).where(eq(users.id,f.admin.id));
    await expect(f.api.previewBroadcastRetry({recipientId:source.id})).rejects.toMatchObject({code:'FORBIDDEN'});
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it('rejects invalid targets and inactive actors before any dispatch', async () => {
    const f = await fixture();
    for(const input of [{title:'Invalid'}, {title:'Both',userId:f.member.id,audience:'all'}, {title:'Bad',audience:'company:bad'}, {title:'No channel',userId:f.member.id,inApp:false}, {title:'Bad link',userId:f.member.id,link:'javascript:alert(1)'}]) await expect(f.api.broadcast(input as any)).rejects.toMatchObject({code:'BAD_REQUEST'});
    await expect(f.api.broadcast({userId:f.suspended.id,title:'Suspended'})).rejects.toMatchObject({code:'NOT_FOUND'});
    await f.db.update(companies).set({status:'SUSPENDED'}).where(eq(companies.id,f.company.id));
    await expect(f.api.broadcast({audience:`company:${f.company.id}`,title:'Closed company'})).rejects.toMatchObject({code:'NOT_FOUND'});
    await f.db.update(users).set({role:'user'}).where(eq(users.id,f.admin.id));
    await expect(f.api.broadcast({userId:f.member.id,title:'Former admin'})).rejects.toMatchObject({code:'FORBIDDEN'});
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
