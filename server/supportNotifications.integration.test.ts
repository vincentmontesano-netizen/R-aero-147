import {afterEach,beforeAll,describe,expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {createSupportTicket,getDb,postTicketMessage} from './db';
import {supportNotificationOutbox,users,supportTickets,messages} from '../drizzle/schema';
import {dispatchSupportNotification,listSupportNotifications,sendPendingSupportNotification} from './supportNotifications';
import {appRouter} from './routers';
import * as email from './email';
const url=process.env.RAERO_TEST_DATABASE_URL;
afterEach(()=>vi.restoreAllMocks());
describe.skipIf(!url)('durable support email intent',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 it('retains pending requests without SMTP, claims once, and never automatically repeats uncertainty',async()=>{
  const db=(await getDb())!;
  const [owner]=await db.insert(users).values({openId:randomUUID()}).returning();
  const ticket=await createSupportTicket(owner.id,{subject:'Queued support',requestId:randomUUID()});
  const key=`ticket:${ticket.id}`;
  const read=async()=>(await db.select().from(supportNotificationOutbox).where(eq(supportNotificationOutbox.key,key)))[0];
  const configured=vi.spyOn(email,'isEmailConfigured').mockReturnValue(false);
  vi.spyOn(email,'adminNotifyEmail').mockReturnValue('fixture@example.test');
  const send=vi.spyOn(email,'sendEmail').mockResolvedValue({sent:true});
  await dispatchSupportNotification(key);
  expect(await read()).toMatchObject({state:'pending',claimedAt:null,recipient:null});expect(send).not.toHaveBeenCalled();
  configured.mockReturnValue(true);
  await Promise.all([dispatchSupportNotification(key),dispatchSupportNotification(key)]);
  expect(send).toHaveBeenCalledTimes(1);expect(await read()).toMatchObject({state:'accepted',recipient:'fixture@example.test'});
  const accepted=await read();
  await dispatchSupportNotification(key);expect(send).toHaveBeenCalledTimes(1);
  await expect(db.update(supportNotificationOutbox).set({state:'pending'}).where(eq(supportNotificationOutbox.key,key))).rejects.toThrow();
  await expect(db.delete(supportNotificationOutbox).where(eq(supportNotificationOutbox.key,key))).rejects.toThrow();
  await expect(db.execute(sql`truncate support_notification_outbox`)).rejects.toThrow();
  expect(await read()).toEqual(accepted);
  const reply=await postTicketMessage(ticket.id,owner.id,'Please help',randomUUID());
  send.mockResolvedValue({sent:false,error:'Transport uncertain'});
  const replyKey=`message:${reply.message.id}`;
  await dispatchSupportNotification(replyKey);await dispatchSupportNotification(replyKey);
  expect(send).toHaveBeenCalledTimes(2);
  expect((await db.select().from(supportNotificationOutbox).where(eq(supportNotificationOutbox.key,replyKey)))[0].state).toBe('unconfirmed');
 });
 it('queues owner replies, checks the current recipient, and rolls ticket creation back if queuing fails',async()=>{
  const db=(await getDb())!;
  const initialEmail=`owner-${randomUUID()}@example.test`,updatedEmail=`updated-${randomUUID()}@example.test`;
  const [owner,admin]=await db.insert(users).values([{openId:randomUUID(),email:initialEmail},{openId:randomUUID(),role:'admin'}]).returning();
  const ticket=await createSupportTicket(owner.id,{subject:'Recipient checks'});
  const reply=await postTicketMessage(ticket.id,admin.id,'Private support response',randomUUID());
  const key=`message:${reply.message.id}`;
  vi.spyOn(email,'isEmailConfigured').mockReturnValue(true);
  const send=vi.spyOn(email,'sendEmail').mockResolvedValue({sent:true});
  await db.update(users).set({status:'suspended'}).where(eq(users.id,owner.id));
  await dispatchSupportNotification(key);expect(send).not.toHaveBeenCalled();
  await db.update(users).set({status:'active',email:updatedEmail}).where(eq(users.id,owner.id));
  await dispatchSupportNotification(key);expect(send).toHaveBeenCalledWith(expect.objectContaining({to:updatedEmail}));
  expect(send.mock.calls[0][0].html).not.toContain('Private support response');
  const name='support_queue_fail_'+owner.id;
  await db.execute(sql.raw(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM support_tickets WHERE id=NEW."ticketId" AND "userId"=${owner.id} AND subject='Rollback queue fixture') THEN RAISE EXCEPTION 'fixture queue failure'; END IF; RETURN NEW; END $$`));
  await db.execute(sql.raw(`CREATE TRIGGER ${name} BEFORE INSERT ON support_notification_outbox FOR EACH ROW EXECUTE FUNCTION ${name}()`));
  try{
   await expect(createSupportTicket(owner.id,{subject:'Rollback queue fixture',message:'Should roll back',requestId:randomUUID()})).rejects.toThrow();
   const own=await db.select().from(supportTickets).where(eq(supportTickets.userId,owner.id));expect(own).toHaveLength(1);
   expect(await db.select().from(messages).where(eq(messages.fromUserId,owner.id))).toHaveLength(0);
  }finally{
   await db.execute(sql.raw(`DROP TRIGGER ${name} ON support_notification_outbox`));
   await db.execute(sql.raw(`DROP FUNCTION ${name}()`));
  }
 });

 it('pages the admin queue, confirms the current recipient, attributes one claim and rejects uncertain retries',async()=>{
  const db=(await getDb())!;
  const [owner,admin]=await db.insert(users).values([{openId:randomUUID()},{openId:randomUUID(),role:'admin'}]).returning();
  const ticket=await createSupportTicket(owner.id,{subject:'Admin queue fixture'});
  for(let n=0;n<54;n++)await postTicketMessage(ticket.id,owner.id,'Queue message '+n,randomUUID());
  const configured=vi.spyOn(email,'isEmailConfigured').mockReturnValue(true);
  const recipient=vi.spyOn(email,'adminNotifyEmail').mockReturnValue('queue-first@example.test');
  const send=vi.spyOn(email,'sendEmail').mockResolvedValue({sent:true});
  const api=appRouter.createCaller({user:admin,req:{headers:{}},res:{}} as any);
  const first=await api.support.notificationQueue({ticketId:ticket.id,state:'pending'});
  expect(first.entries).toHaveLength(50);expect(first.entries.every(row=>row.canSend&&row.currentRecipient==='queue-first@example.test')).toBe(true);
  await postTicketMessage(ticket.id,owner.id,'New arrival',randomUUID());
  const next=await api.support.notificationQueue({ticketId:ticket.id,state:'pending',beforeId:first.nextCursor!});
  expect(next.entries).toHaveLength(5);expect(next.nextCursor).toBeNull();
  expect(new Set([...first.entries,...next.entries].map(row=>row.id)).size).toBe(55);
  const item=first.entries[0];
  await expect(listSupportNotifications(owner.id,{})).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(sendPendingSupportNotification(owner.id,{id:item.id,expectedRecipient:'queue-first@example.test'})).rejects.toMatchObject({code:'FORBIDDEN'});
  recipient.mockReturnValue('queue-updated@example.test');
  await expect(api.support.sendNotification({id:item.id,expectedRecipient:'queue-first@example.test'})).rejects.toMatchObject({code:'CONFLICT'});
  configured.mockReturnValue(false);
  await expect(api.support.sendNotification({id:item.id,expectedRecipient:'queue-updated@example.test'})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
  expect(send).not.toHaveBeenCalled();configured.mockReturnValue(true);
  const input={id:item.id,expectedRecipient:'queue-updated@example.test'};
  let release!:(value:{sent:boolean})=>void;
  send.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  const pending=api.support.sendNotification(input).then(value=>({value}),error=>({error}));
  try{
   await vi.waitFor(()=>expect(send).toHaveBeenCalledTimes(1));
   await expect(api.support.sendNotification(input)).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
  }finally{release?.({sent:true});}
  expect(await pending).toEqual({value:{state:'accepted'}});
  expect(await api.support.sendNotification(input)).toEqual({state:'accepted'});
  expect(send).toHaveBeenCalledTimes(1);
  expect((await db.select().from(supportNotificationOutbox).where(eq(supportNotificationOutbox.id,item.id)))[0]).toMatchObject({claimedBy:admin.id,recipient:input.expectedRecipient});
  expect((await api.support.notificationQueue({ticketId:ticket.id,state:'accepted'})).entries.map(row=>row.id)).toEqual([item.id]);
  send.mockResolvedValue({sent:false});
  const uncertain={id:first.entries[1].id,expectedRecipient:input.expectedRecipient};
  expect(await api.support.sendNotification(uncertain)).toEqual({state:'unconfirmed'});
  await expect(api.support.sendNotification(uncertain)).rejects.toMatchObject({code:'PRECONDITION_FAILED'});expect(send).toHaveBeenCalledTimes(2);
  await db.update(users).set({status:'suspended'}).where(eq(users.id,admin.id));
  await expect(api.support.notificationQueue({})).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(api.support.sendNotification(input)).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(db.update(supportNotificationOutbox).set({claimedBy:owner.id}).where(eq(supportNotificationOutbox.id,item.id))).rejects.toThrow();
 });

 it('retains the committed claim when recording SMTP acceptance fails and refuses further transport',async()=>{
  const db=(await getDb())!;
  const [owner,admin]=await db.insert(users).values([{openId:randomUUID()},{openId:randomUUID(),role:'admin'}]).returning();
  const ticket=await createSupportTicket(owner.id,{subject:'SMTP outcome persistence fixture'});
  const key=`ticket:${ticket.id}`;
  const [item]=await db.select().from(supportNotificationOutbox).where(eq(supportNotificationOutbox.key,key));
  vi.spyOn(email,'isEmailConfigured').mockReturnValue(true);
  vi.spyOn(email,'adminNotifyEmail').mockReturnValue('outcome-fixture@example.test');
  const send=vi.spyOn(email,'sendEmail').mockResolvedValue({sent:true});
  const name=`support_outcome_fail_${item.id}`;
  await db.execute(sql.raw(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id=${item.id} AND NEW.state='accepted' THEN RAISE EXCEPTION 'fixture outcome persistence failure'; END IF; RETURN NEW; END $$`));
  await db.execute(sql.raw(`CREATE TRIGGER ${name} BEFORE UPDATE ON support_notification_outbox FOR EACH ROW EXECUTE FUNCTION ${name}()`));
  try{
   await expect(sendPendingSupportNotification(admin.id,{id:item.id,expectedRecipient:'outcome-fixture@example.test'})).rejects.toThrow();
   expect(send).toHaveBeenCalledTimes(1);
   const [retained]=await db.select().from(supportNotificationOutbox).where(eq(supportNotificationOutbox.id,item.id));
   expect(retained).toMatchObject({state:'sending',claimedBy:admin.id,recipient:'outcome-fixture@example.test',finishedAt:null});
   expect(retained.claimedAt).toBeInstanceOf(Date);
  }finally{
   await db.execute(sql.raw(`DROP TRIGGER ${name} ON support_notification_outbox`));
   await db.execute(sql.raw(`DROP FUNCTION ${name}()`));
  }
  await dispatchSupportNotification(key);
  await expect(sendPendingSupportNotification(admin.id,{id:item.id,expectedRecipient:'outcome-fixture@example.test'})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
  expect(send).toHaveBeenCalledTimes(1);
  const queue=await listSupportNotifications(admin.id,{ticketId:ticket.id,state:'sending'});
  expect(queue.entries).toHaveLength(1);
  expect(queue.entries[0]).toMatchObject({id:item.id,state:'sending',canSend:false,finishedAt:null});
 });
});
