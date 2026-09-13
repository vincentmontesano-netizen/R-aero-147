import {beforeAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {getDb} from './db';
import {rescheduleSession,sessionScheduleHistory} from './sessionSchedule';
import {appRouter} from './routers';
import {users,sessions,sessionRegistrations} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('audited session schedule · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 async function fixture(){const db=(await getDb())!;const [admin,learner]=await db.insert(users).values([{openId:randomUUID(),role:'admin' as const},{openId:randomUUID()}]).returning();const [session]=await db.insert(sessions).values({title:'Missing end',format:'virtual',startDate:new Date(Date.now()+86400000)}).returning();await db.insert(sessionRegistrations).values({sessionId:session.id,userId:learner.id});return {db,admin,learner,session};}
 const input=(id:number)=>({id,startDate:'2027-01-10T09:00:00+01:00',endDate:'2027-01-10T11:00:00+01:00',reason:'Organizer correction'});
 const caller=(user:typeof users.$inferSelect)=>appRouter.createCaller({user,req:{headers:{}} as never,res:{} as never,affiliations:[]});
 it('repairs a missing end atomically, keeps registrations and records one transition under duplicates',async()=>{
  const f=await fixture();const results=await Promise.all([rescheduleSession(f.admin.id,input(f.session.id)),rescheduleSession(f.admin.id,input(f.session.id))]);
  expect(results.filter(r=>r.changed)).toHaveLength(1);
  const [record]=await f.db.select().from(sessions).where(eq(sessions.id,f.session.id));expect(record.startDate.toISOString()).toBe('2027-01-10T08:00:00.000Z');expect(record.endDate?.toISOString()).toBe('2027-01-10T10:00:00.000Z');
  expect(await f.db.select().from(sessionRegistrations).where(eq(sessionRegistrations.sessionId,f.session.id))).toHaveLength(1);
  const events=await f.db.execute(sql`select "actorId","previousEnd",reason from session_schedule_events where "sessionId"=${f.session.id}`);expect(events).toEqual([{actorId:f.admin.id,previousEnd:null,reason:'Organizer correction'}]);
  await expect(f.db.execute(sql`delete from session_schedule_events where "sessionId"=${f.session.id}`)).rejects.toThrow();
 });
 it('refuses invalid dates, arbitrary fields, non-admin and terminal session edits',async()=>{
  const f=await fixture();
  await expect(caller(f.admin).admin.sessions.update({...input(f.session.id),endDate:'invalid'})).rejects.toMatchObject({code:'BAD_REQUEST'});
  await expect(caller(f.admin).admin.sessions.update({...input(f.session.id),startDate:'2028-01-01T00:00:00Z'})).rejects.toMatchObject({code:'BAD_REQUEST'});
  await expect(caller(f.admin).admin.sessions.update({...input(f.session.id),seatsTaken:0} as never)).rejects.toMatchObject({code:'BAD_REQUEST'});
  await expect(rescheduleSession(f.learner.id,input(f.session.id))).rejects.toMatchObject({code:'FORBIDDEN'});
  for(const status of ['completed','cancelled'] as const){await f.db.update(sessions).set({status}).where(eq(sessions.id,f.session.id));await expect(rescheduleSession(f.admin.id,input(f.session.id))).rejects.toMatchObject({code:'PRECONDITION_FAILED'});}
  expect(await f.db.execute(sql`select id from session_schedule_events where "sessionId"=${f.session.id}`)).toHaveLength(0);
 });
 it('requires explicit valid remote end times at creation while allowing in-person legacy scheduling',async()=>{
  const f=await fixture(),api=caller(f.admin);const base={title:randomUUID(),format:'virtual' as const,startDate:'2027-01-10T08:00:00Z'};
  await expect(api.admin.sessions.create(base)).rejects.toMatchObject({code:'BAD_REQUEST'});
  await expect(api.admin.sessions.create({...base,endDate:'2027-01-10T07:00:00Z'})).rejects.toMatchObject({code:'BAD_REQUEST'});
  await expect(api.admin.sessions.create({...base,endDate:'2027-01-10T10:00:00Z'})).resolves.toMatchObject({success:true});
  await expect(api.admin.sessions.create({...base,format:'in_person'})).resolves.toMatchObject({success:true});
 });
 it('exposes only schedule audit fields to active administrators, including terminal classes',async()=>{
  const f=await fixture();
  await rescheduleSession(f.admin.id,input(f.session.id));
  await f.db.update(users).set({name:'Current operator',email:`${randomUUID()}@example.test`,passwordHash:'private-fixture'}).where(eq(users.id,f.admin.id));
  await f.db.update(sessions).set({status:'completed'}).where(eq(sessions.id,f.session.id));
  const history=await caller(f.admin).admin.sessions.scheduleHistory({id:f.session.id});
  expect(history.session.status).toBe('completed');expect(history.events).toHaveLength(1);
  expect(history.events[0]).toMatchObject({actorId:f.admin.id,actorName:'Current operator',previousEnd:null,nextStart:'2027-01-10T08:00:00.000Z',nextEnd:'2027-01-10T10:00:00.000Z',reason:'Organizer correction'});
  expect(Object.keys(history.events[0]).sort()).toEqual(['id','actorId','actorName','previousStart','previousEnd','nextStart','nextEnd','reason','createdAt'].sort());
  await expect(caller(f.learner).admin.sessions.scheduleHistory({id:f.session.id})).rejects.toMatchObject({code:'FORBIDDEN'});
  await f.db.update(users).set({status:'suspended'}).where(eq(users.id,f.admin.id));
  await expect(sessionScheduleHistory(f.admin.id,{id:f.session.id})).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('paginates one class without shifting older pages under new events',async()=>{
  const f=await fixture(),other=await fixture();
  await f.db.execute(sql`insert into session_schedule_events ("sessionId","actorId","previousStart","nextStart","nextEnd",reason) select ${f.session.id},${f.admin.id},'2027-01-01','2027-01-02','2027-01-03','Fixture change' from generate_series(1,53)`);
  await rescheduleSession(other.admin.id,input(other.session.id));
  const first=await sessionScheduleHistory(f.admin.id,{id:f.session.id});
  expect(first.events).toHaveLength(50);expect(first.nextCursor).not.toBeNull();
  await rescheduleSession(f.admin.id,input(f.session.id));
  const second=await sessionScheduleHistory(f.admin.id,{id:f.session.id,before:first.nextCursor!});
  expect(second.events).toHaveLength(3);expect(second.nextCursor).toBeNull();
  expect(new Set([...first.events,...second.events].map(e=>e.id)).size).toBe(53);
  expect([...first.events,...second.events].every(e=>e.actorId===f.admin.id)).toBe(true);
  await expect(caller(f.admin).admin.sessions.scheduleHistory({id:f.session.id,before:2147483648})).rejects.toMatchObject({code:'BAD_REQUEST'});
 });

});
