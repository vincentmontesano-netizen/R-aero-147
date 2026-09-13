import {afterEach,beforeAll,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {getDb,createSupportTicket,postTicketMessage,getTicketThread} from './db';
import {users,messages,supportTickets,supportMessageRequests,notifications,supportNotificationOutbox} from '../drizzle/schema';
import {appRouter} from './routers';
import * as email from './email';
const url=process.env.RAERO_TEST_DATABASE_URL;
afterEach(()=>vi.restoreAllMocks());
describe.skipIf(!url)('transactional private support replies · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 it('rechecks participant rights at the service boundary and rolls back replies on ticket update failure',async()=>{
  const db=(await getDb())!;const [owner,admin,other]=await db.insert(users).values([{openId:randomUUID()},{openId:randomUUID(),role:'admin'},{openId:randomUUID()}]).returning();
  const ticket=await createSupportTicket(owner.id,{subject:'Private conversation'});
  await postTicketMessage(ticket.id,owner.id,'Initial question');await postTicketMessage(ticket.id,admin.id,'Administrative reply');
  expect(await getTicketThread(ticket.id,owner.id)).toHaveLength(2);
  for(const method of [()=>postTicketMessage(ticket.id,other.id,'Foreign'),()=>getTicketThread(ticket.id,other.id)])await expect(method()).rejects.toMatchObject({code:'FORBIDDEN'});
  await db.update(users).set({role:'user'}).where(eq(users.id,admin.id));
  await expect(postTicketMessage(ticket.id,admin.id,'Stale admin')).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(getTicketThread(ticket.id,admin.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await db.update(users).set({status:'suspended'}).where(eq(users.id,owner.id));
  await expect(postTicketMessage(ticket.id,owner.id,'Suspended owner')).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(getTicketThread(ticket.id,owner.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await db.update(users).set({status:'active'}).where(eq(users.id,owner.id));
  const [before]=await db.select().from(supportTickets).where(eq(supportTickets.id,ticket.id));const name='reply_test_'+randomUUID().replaceAll('-','');
  await db.execute(sql.raw(`create function ${name}() returns trigger language plpgsql as $$ begin if NEW.id=${ticket.id} then raise exception 'synthetic ticket failure'; end if; return NEW; end $$`));
  try{
   await db.execute(sql.raw(`create trigger ${name} before update on support_tickets for each row execute function ${name}()`));
   const requestId=randomUUID();
   await expect(postTicketMessage(ticket.id,owner.id,'Must roll back',requestId)).rejects.toThrow();
   expect(await db.select().from(supportMessageRequests).where(eq(supportMessageRequests.requestId,requestId))).toHaveLength(0);
   expect(await db.select().from(messages).where(eq(messages.ticketId,ticket.id))).toHaveLength(2);
   expect((await db.select().from(supportTickets).where(eq(supportTickets.id,ticket.id)))[0]).toEqual(before);
  }finally{await db.execute(sql.raw(`drop trigger if exists ${name} on support_tickets`));await db.execute(sql.raw(`drop function ${name}()`));}
 });
 it('deduplicates concurrent replies, rejects changed reuse and rechecks access even for a replay',async()=>{
  const db=(await getDb())!;
  const [owner,admin]=await db.insert(users).values([{openId:randomUUID()},{openId:randomUUID(),role:'admin'}]).returning();
  const ticket=await createSupportTicket(owner.id,{subject:'Replay fixture'});
  const other=await createSupportTicket(owner.id,{subject:'Other replay fixture'});
  const requestId=randomUUID();
  const result=await Promise.all([postTicketMessage(ticket.id,owner.id,'  One reply  ',requestId.toUpperCase()),postTicketMessage(ticket.id,owner.id,'One reply',requestId)]);
  expect(result.map(r=>r.message.id)).toEqual([result[0].message.id,result[0].message.id]);
  expect(result.filter(r=>r.replayed)).toHaveLength(1);
  const [before]=await db.select().from(supportTickets).where(eq(supportTickets.id,ticket.id));
  expect((await postTicketMessage(ticket.id,owner.id,'One reply',requestId)).replayed).toBe(true);
  expect((await db.select().from(supportTickets).where(eq(supportTickets.id,ticket.id)))[0]).toEqual(before);
  for(const action of [()=>postTicketMessage(ticket.id,owner.id,'Changed',requestId),()=>postTicketMessage(other.id,owner.id,'One reply',requestId),()=>postTicketMessage(ticket.id,admin.id,'One reply',requestId)])await expect(action()).rejects.toMatchObject({code:'CONFLICT'});
  await db.update(users).set({status:'suspended'}).where(eq(users.id,owner.id));
  await expect(postTicketMessage(ticket.id,owner.id,'One reply',requestId)).rejects.toMatchObject({code:'FORBIDDEN'});
  expect(await db.select().from(messages).where(eq(messages.ticketId,ticket.id))).toHaveLength(1);
  await expect(db.update(supportMessageRequests).set({fingerprint:'x'}).where(eq(supportMessageRequests.requestId,requestId))).rejects.toThrow();
  await expect(db.delete(supportMessageRequests).where(eq(supportMessageRequests.requestId,requestId))).rejects.toThrow();
  for(const id of [0,1.5,2147483648])await expect(postTicketMessage(id,owner.id,'Message',randomUUID())).rejects.toMatchObject({code:'BAD_REQUEST'});
  await expect(postTicketMessage(ticket.id,owner.id,'Message','invalid')).rejects.toMatchObject({code:'BAD_REQUEST'});
 });
 it('returns the same API message without repeating the notification on replay',async()=>{
  const db=(await getDb())!;const [owner]=await db.insert(users).values({openId:randomUUID()}).returning();
  const ticket=await createSupportTicket(owner.id,{subject:'Notification replay fixture'});
  vi.spyOn(email,'isEmailConfigured').mockReturnValue(true);
  vi.spyOn(email,'adminNotifyEmail').mockReturnValue('support-fixture@example.test');
  const notify=vi.spyOn(email,'sendEmail').mockResolvedValue({sent:true});
  const caller=appRouter.createCaller({user:owner,req:{headers:{}},res:{}} as any);
  const input={ticketId:ticket.id,content:'Persisted before notification',requestId:randomUUID()};
  const original=await caller.support.reply(input);
  const message=await caller.support.reply(input);
  expect(message).toEqual(original);
  expect(message).toMatchObject({ticketId:ticket.id,content:input.content});
  expect(message).not.toHaveProperty('replayed');
  expect(notify).toHaveBeenCalledTimes(1);
  expect(await db.select().from(messages).where(eq(messages.ticketId,ticket.id))).toHaveLength(1);
 });

 it('commits reply, in-app notification and email intent together and retries the whole transaction safely',async()=>{
  const db=(await getDb())!;
  const [owner,admin]=await db.insert(users).values([{openId:randomUUID()},{openId:randomUUID(),role:'admin'}]).returning();
  const ticket=await createSupportTicket(owner.id,{subject:'Atomic notification fixture'});
  const requestId=randomUUID(),name=`support_in_app_fail_${owner.id}`;
  const [before]=await db.select().from(supportTickets).where(eq(supportTickets.id,ticket.id));
  await db.execute(sql.raw(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."userId"=${owner.id} AND NEW.type='support' THEN RAISE EXCEPTION 'fixture in-app failure'; END IF; RETURN NEW; END $$`));
  await db.execute(sql.raw(`CREATE TRIGGER ${name} BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION ${name}()`));
  try{
   await expect(postTicketMessage(ticket.id,admin.id,'Atomic reply',requestId)).rejects.toThrow();
   expect(await db.select().from(messages).where(eq(messages.ticketId,ticket.id))).toHaveLength(0);
   expect(await db.select().from(supportMessageRequests).where(eq(supportMessageRequests.requestId,requestId))).toHaveLength(0);
   expect(await db.select().from(notifications).where(eq(notifications.userId,owner.id))).toHaveLength(0);
   const emailIntents=await db.select().from(supportNotificationOutbox).where(eq(supportNotificationOutbox.ticketId,ticket.id));
   expect(emailIntents).toHaveLength(1);expect(emailIntents[0].key).toBe(`ticket:${ticket.id}`);
   expect((await db.select().from(supportTickets).where(eq(supportTickets.id,ticket.id)))[0]).toEqual(before);
  }finally{
   await db.execute(sql.raw(`DROP TRIGGER ${name} ON notifications`));
   await db.execute(sql.raw(`DROP FUNCTION ${name}()`));
  }
  const results=await Promise.all([postTicketMessage(ticket.id,admin.id,'Atomic reply',requestId),postTicketMessage(ticket.id,admin.id,'Atomic reply',requestId)]);
  expect(results.filter(result=>!result.replayed)).toHaveLength(1);
  const [notice]=await db.select().from(notifications).where(eq(notifications.userId,owner.id));
  expect(notice).toMatchObject({type:'support',body:'Atomic reply',link:`/support/ticket/${ticket.id}`,dedupeKey:`support-message:${results[0].message.id}`,isRead:false});
  await postTicketMessage(ticket.id,owner.id,'Owner follow-up',randomUUID());
  expect(await db.select().from(notifications).where(eq(notifications.userId,owner.id))).toHaveLength(1);
  expect(await db.select().from(notifications).where(eq(notifications.userId,admin.id))).toHaveLength(0);
 });
});
