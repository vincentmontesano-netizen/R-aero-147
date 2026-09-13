import {beforeAll,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
vi.mock('./email',async original=>({...await original<typeof import('./email')>(),sendEmail:vi.fn(),isEmailConfigured:()=>false}));
import {getDb,createSupportTicket} from './db';
import {appRouter} from './routers';
import {users,supportTickets,messages,supportCreationRequests} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('privacy requests through private support · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 it('records typed requests privately without changing the account and retains the original category',async()=>{
  const db=(await getDb())!;const [person,other,admin]=await db.insert(users).values([{openId:randomUUID(),name:randomUUID()},{openId:randomUUID()},{openId:randomUUID(),role:'admin'}]).returning();
  const caller=(user:typeof person)=>appRouter.createCaller({user,req:{headers:{}},res:{}} as any);
  for(const requestKind of ['DATA_ACCESS','RECTIFICATION','ERASURE'] as const){
   const ticket=await caller(person).support.create({requestKind,subject:'Personal data request',message:'Please review my personal records.'});
   expect(ticket).toMatchObject({userId:person.id,requestKind,status:'OPEN'});
   expect((await caller(person).support.thread({ticketId:ticket.id}))[0].content).toBe('Please review my personal records.');
   await expect(caller(other).support.thread({ticketId:ticket.id})).rejects.toMatchObject({code:'FORBIDDEN'});
   expect((await caller(admin).support.adminList({search:person.name!})).entries.find(t=>t.id===ticket.id)?.requestKind).toBe(requestKind);
   await expect(db.update(supportTickets).set({requestKind:'GENERAL'}).where(eq(supportTickets.id,ticket.id))).rejects.toThrow();
  }
  expect((await caller(person).support.myList()).entries.map(t=>t.requestKind).sort()).toEqual(['DATA_ACCESS','ERASURE','RECTIFICATION']);
  expect((await db.select().from(users).where(eq(users.id,person.id)))[0]).toEqual(person);
  await expect(caller(person).support.create({requestKind:'ERASURE',subject:'Incomplete',message:'short'})).rejects.toMatchObject({code:'BAD_REQUEST'});
  expect((await createSupportTicket(person.id,{subject:'Ordinary support'})).requestKind).toBe('GENERAL');
 });
 it('rolls back ticket creation when its initial message fails and refuses inactive authors',async()=>{
  const db=(await getDb())!;const [person]=await db.insert(users).values({openId:randomUUID()}).returning();const name='privacy_test_'+randomUUID().replaceAll('-','');
  await db.execute(sql.raw(`create function ${name}() returns trigger language plpgsql as $$ begin if NEW."fromUserId"=${person.id} then raise exception 'synthetic message failure'; end if; return NEW; end $$`));
  try{
   await db.execute(sql.raw(`create trigger ${name} before insert on messages for each row execute function ${name}()`));
   const requestId=randomUUID();
   await expect(createSupportTicket(person.id,{requestId,requestKind:'DATA_ACCESS',subject:'Records',message:'Please provide my records.'})).rejects.toThrow();
   expect(await db.select().from(supportCreationRequests).where(eq(supportCreationRequests.requestId,requestId))).toHaveLength(0);
   expect(await db.select().from(supportTickets).where(eq(supportTickets.userId,person.id))).toHaveLength(0);
   expect(await db.select().from(messages).where(eq(messages.fromUserId,person.id))).toHaveLength(0);
  }finally{await db.execute(sql.raw(`drop trigger if exists ${name} on messages`));await db.execute(sql.raw(`drop function ${name}()`));}
  await db.update(users).set({status:'suspended'}).where(eq(users.id,person.id));
  await expect(createSupportTicket(person.id,{subject:'Blocked'})).rejects.toMatchObject({code:'FORBIDDEN'});
 });
});
