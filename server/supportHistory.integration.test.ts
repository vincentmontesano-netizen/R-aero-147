import {beforeAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {getDb,createSupportTicket,setTicketStatus,getTicketStatusHistory} from './db';
import {exportPersonData} from './access';
import {users,supportTickets,supportStatusEvents} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('retained support processing history · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 it('requires an explained privacy closure, retains the actor identity and pages only authorized history',async()=>{
  const db=(await getDb())!;const [owner,other,admin]=await db.insert(users).values([{openId:randomUUID()},{openId:randomUUID()},{openId:randomUUID(),role:'admin',name:'Initial operator'}]).returning();
  const ticket=await createSupportTicket(owner.id,{requestKind:'ERASURE',subject:'Review request',message:'Please examine my retained records.'});
  await Promise.all([setTicketStatus(ticket.id,'PENDING',admin.id),setTicketStatus(ticket.id,'PENDING',admin.id)]);
  expect((await getTicketStatusHistory(owner.id,ticket.id)).entries).toHaveLength(2);
  await expect(setTicketStatus(ticket.id,'CLOSED',admin.id)).rejects.toMatchObject({code:'BAD_REQUEST'});
  await setTicketStatus(ticket.id,'CLOSED',admin.id,'Synthetic review: retained records explained.');
  const [closed]=(await getTicketStatusHistory(owner.id,ticket.id)).entries;
  expect(closed).toMatchObject({actorName:'Initial operator',previousStatus:'PENDING',status:'CLOSED',reason:'Synthetic review: retained records explained.'});
  await db.update(users).set({name:'Renamed operator'}).where(eq(users.id,admin.id));
  expect((await getTicketStatusHistory(owner.id,ticket.id)).entries[0].actorName).toBe('Initial operator');
  await expect(getTicketStatusHistory(other.id,ticket.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(setTicketStatus(ticket.id,'OPEN',other.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(db.update(supportStatusEvents).set({reason:'Rewritten'}).where(eq(supportStatusEvents.id,closed.id))).rejects.toThrow();
  await expect(db.delete(supportStatusEvents).where(eq(supportStatusEvents.id,closed.id))).rejects.toThrow();
  for(let i=0;i<26;i++)await setTicketStatus(ticket.id,i%2===0?'OPEN':'PENDING',admin.id);
  const first=await getTicketStatusHistory(owner.id,ticket.id);const second=await getTicketStatusHistory(owner.id,ticket.id,first.nextCursor!);
  expect(first.entries).toHaveLength(25);expect(second.entries).toHaveLength(4);expect(second.nextCursor).toBeNull();
  expect(new Set([...first.entries,...second.entries].map(e=>e.id)).size).toBe(29);
  expect((await exportPersonData(owner.id))?.support.statusHistory).toHaveLength(29);
  expect((await exportPersonData(other.id))?.support.statusHistory).toEqual([]);
  await db.update(users).set({role:'user'}).where(eq(users.id,admin.id));
  await expect(setTicketStatus(ticket.id,'OPEN',admin.id)).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('rolls back status changes when their immutable event cannot be written',async()=>{
  const db=(await getDb())!;const [owner,admin]=await db.insert(users).values([{openId:randomUUID()},{openId:randomUUID(),role:'admin'}]).returning();
  const {replayed,...ticket}=await createSupportTicket(owner.id,{subject:'Rollback request'});const name='support_history_'+randomUUID().replaceAll('-','');
  await db.execute(sql.raw(`create function ${name}() returns trigger language plpgsql as $$ begin if NEW."ticketId"=${ticket.id} then raise exception 'synthetic history failure'; end if; return NEW; end $$`));
  try{
   await db.execute(sql.raw(`create trigger ${name} before insert on support_status_events for each row execute function ${name}()`));
   await expect(setTicketStatus(ticket.id,'CLOSED',admin.id)).rejects.toThrow();
   expect((await db.select().from(supportTickets).where(eq(supportTickets.id,ticket.id)))[0]).toEqual(ticket);
   expect((await getTicketStatusHistory(owner.id,ticket.id)).entries).toHaveLength(1);
  }finally{await db.execute(sql.raw(`drop trigger if exists ${name} on support_status_events`));await db.execute(sql.raw(`drop function ${name}()`));}
 });
});
