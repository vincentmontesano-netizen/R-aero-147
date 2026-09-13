import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb, createSupportTicket, setTicketStatus } from './db';
import { users, messages, supportTickets, supportStatusEvents, supportCreationRequests } from '../drizzle/schema';
import { appRouter } from './routers';
import * as email from './email';
const url = process.env.RAERO_TEST_DATABASE_URL;
afterEach(() => vi.restoreAllMocks());
describe.skipIf(!url)('support request creation replay · PostgreSQL', () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  it('creates one ticket, initial message and history event, preserves subsequent treatment and rechecks the author', async () => {
    const db = (await getDb())!;
    const [owner,other,admin] = await db.insert(users).values([{openId:randomUUID()},{openId:randomUUID()},{openId:randomUUID(),role:'admin'}]).returning();
    const input = {requestId:randomUUID(),subject:'Data review',message:'Please review my records.',requestKind:'DATA_ACCESS' as const};
    const result = await Promise.all([
      createSupportTicket(owner.id,input),
      createSupportTicket(owner.id,{...input,requestId:input.requestId.toUpperCase(),subject:' Data review ',priority:'normal'}),
    ]);
    expect(result[0].id).toBe(result[1].id);
    expect(result.filter(r => r.replayed)).toHaveLength(1);
    const ticketId = result[0].id;
    expect(await db.select().from(supportTickets).where(eq(supportTickets.userId,owner.id))).toHaveLength(1);
    expect(await db.select().from(messages).where(eq(messages.ticketId,ticketId))).toHaveLength(1);
    expect(await db.select().from(supportStatusEvents).where(eq(supportStatusEvents.ticketId,ticketId))).toHaveLength(1);
    await setTicketStatus(ticketId,'PENDING',admin.id);
    const replay = await createSupportTicket(owner.id,input);
    expect(replay).toMatchObject({id:ticketId,status:'PENDING',replayed:true});
    expect(await db.select().from(supportStatusEvents).where(eq(supportStatusEvents.ticketId,ticketId))).toHaveLength(2);
    for (const change of [{subject:'Other'}, {message:'Different records request.'}, {requestKind:'ERASURE' as const}, {priority:'high' as const}]) {
      await expect(createSupportTicket(owner.id,{...input,...change})).rejects.toMatchObject({code:'CONFLICT'});
    }
    await expect(createSupportTicket(other.id,input)).rejects.toMatchObject({code:'CONFLICT'});
    await db.update(users).set({status:'suspended'}).where(eq(users.id,owner.id));
    await expect(createSupportTicket(owner.id,input)).rejects.toMatchObject({code:'FORBIDDEN'});
    await expect(db.update(supportCreationRequests).set({fingerprint:'changed'}).where(eq(supportCreationRequests.requestId,input.requestId))).rejects.toThrow();
    await expect(db.delete(supportCreationRequests).where(eq(supportCreationRequests.requestId,input.requestId))).rejects.toThrow();
  });
  it('keeps the public ticket response and sends only one notification for an identical retry', async () => {
    const db = (await getDb())!;
    const [owner] = await db.insert(users).values({openId:randomUUID()}).returning();
    vi.spyOn(email,'isEmailConfigured').mockReturnValue(true);
    vi.spyOn(email,'adminNotifyEmail').mockReturnValue('support-creation-fixture@example.test');
    const send = vi.spyOn(email,'sendEmail').mockResolvedValue({sent:true});
    const caller = appRouter.createCaller({user:owner,req:{headers:{}},res:{}} as any);
    const input = {requestId:randomUUID(),subject:'General help'};
    const first = await caller.support.create(input);
    expect(await caller.support.create({...input,message:'  ',requestKind:'GENERAL'})).toEqual(first);
    expect(first).not.toHaveProperty('replayed');
    expect(send).toHaveBeenCalledTimes(1);
    await expect(caller.support.create({...input,requestId:'invalid'})).rejects.toMatchObject({code:'BAD_REQUEST'});
    expect(await db.select().from(supportTickets).where(eq(supportTickets.userId,owner.id))).toHaveLength(1);
  });
});
