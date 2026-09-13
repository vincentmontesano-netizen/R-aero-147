import {registerForWebinar} from "./admissions";
import {beforeAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {getDb,getWebinars} from './db';
import {webinarHistory,updateWebinarMetadata,createAdminWebinar,rescheduleWebinar,setWebinarStatus,listAdminWebinars} from './adminWebinars';
import {users,webinars,webinarRegistrations,trainings,companies} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('admin webinar lifecycle · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 async function fixture(){const db=(await getDb())!;const [admin,learner]=await db.insert(users).values([{openId:randomUUID(),role:'admin' as const},{openId:randomUUID()}]).returning();return {db,admin,learner};}
 const input=()=>({title:randomUUID(),scheduledAt:'2027-02-10T09:00:00+01:00',durationMinutes:60,maxParticipants:50,trainingId:null});
 it('creates a timed public webinar and preserves its registrations through audited schedule and status changes',async()=>{
  const f=await fixture(),created=await createAdminWebinar(f.admin.id,input());
  await f.db.insert(webinarRegistrations).values({webinarId:created.id,userId:f.learner.id});
  expect((await getWebinars()).some(w=>w.id===created.id)).toBe(true);
  const change={id:created.id,scheduledAt:'2027-02-10T11:00:00Z',durationMinutes:90,reason:'Organizer update'};
  const results=await Promise.all([rescheduleWebinar(f.admin.id,change),rescheduleWebinar(f.admin.id,change)]);expect(results.filter(r=>r.changed)).toHaveLength(1);
  await setWebinarStatus(f.admin.id,{id:created.id,status:'cancelled',reason:'Instructor unavailable'});
  expect((await getWebinars()).some(w=>w.id===created.id)).toBe(false);
  expect((await listAdminWebinars(f.admin.id)).find(w=>w.id===created.id)).toMatchObject({status:'cancelled',durationMinutes:90});
  expect(await f.db.select().from(webinarRegistrations).where(eq(webinarRegistrations.webinarId,created.id))).toHaveLength(1);
  const events=await f.db.execute(sql`select action,previous,next from webinar_admin_events where "webinarId"=${created.id} order by id`);
  expect(events).toHaveLength(3);expect(events[0]).toMatchObject({action:'created',previous:null});expect(events[1]).toMatchObject({action:'rescheduled',previous:{durationMinutes:60},next:{durationMinutes:90}});
  await expect(f.db.delete(webinars).where(eq(webinars.id,created.id))).rejects.toThrow();
  await expect(f.db.execute(sql`delete from webinar_admin_events where "webinarId"=${created.id}`)).rejects.toThrow();
  await expect(rescheduleWebinar(f.admin.id,change)).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
  await expect(setWebinarStatus(f.admin.id,{id:created.id,status:'live',reason:'Reopen'})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
 });
 it('requires an active admin and valid bounded timing/capacity without partial writes',async()=>{
  const f=await fixture();
  await expect(createAdminWebinar(f.learner.id,input())).rejects.toMatchObject({code:'FORBIDDEN'});
  for(const patch of [{durationMinutes:0},{durationMinutes:1441},{durationMinutes:1.5},{maxParticipants:0},{scheduledAt:'invalid'}])await expect(createAdminWebinar(f.admin.id,{...input(),...patch})).rejects.toThrow();
  await f.db.update(users).set({status:'suspended'}).where(eq(users.id,f.admin.id));
  await expect(listAdminWebinars(f.admin.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(createAdminWebinar(f.admin.id,input())).rejects.toMatchObject({code:'FORBIDDEN'});
  expect(await f.db.execute(sql`select id from webinar_admin_events where "actorId"=${f.admin.id}`)).toHaveLength(0);
 });
 it('keeps internal and unpublished linked webinars out of the public catalogue and rejects archived courses',async()=>{
  const f=await fixture();const [company]=await f.db.insert(companies).values({name:randomUUID()}).returning();
  const [internal,draft,archived]=await f.db.insert(trainings).values([{title:'Internal',slug:randomUUID(),ownerOrgId:company.id,isPublished:true},{title:'Draft',slug:randomUUID()},{title:'Archive',slug:randomUUID(),archivedAt:new Date()}]).returning();
  for(const course of [internal,draft]){const created=await createAdminWebinar(f.admin.id,{...input(),trainingId:course.id});expect((await getWebinars()).some(w=>w.id===created.id)).toBe(false);}
  await expect(createAdminWebinar(f.admin.id,{...input(),trainingId:archived.id})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
 });
 it('audits metadata and refuses capacity below existing registrations without changing any field',async()=>{
  const f=await fixture(),created=await createAdminWebinar(f.admin.id,input());
  await registerForWebinar(f.learner.id,created.id);
  const patch={id:created.id,title:'Edited title',description:'Edited description',maxParticipants:1,reason:'Correct catalogue'};
  await updateWebinarMetadata(f.admin.id,patch);
  await updateWebinarMetadata(f.admin.id,patch);
  const events=await f.db.execute(sql`select action,previous,next from webinar_admin_events where "webinarId"=${created.id} and action='metadata'`);
  expect(events).toHaveLength(1);expect(events[0]).toMatchObject({previous:{maxParticipants:50},next:{maxParticipants:1,title:'Edited title'}});
  await expect(updateWebinarMetadata(f.learner.id,patch)).rejects.toMatchObject({code:'FORBIDDEN'});
  await updateWebinarMetadata(f.admin.id,{...patch,maxParticipants:null});
  const [second]=await f.db.insert(users).values({openId:randomUUID()}).returning();await registerForWebinar(second.id,created.id);
  await expect(updateWebinarMetadata(f.admin.id,{...patch,title:'Must roll back'})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
  expect((await listAdminWebinars(f.admin.id)).find(w=>w.id===created.id)).toMatchObject({title:'Edited title',maxParticipants:null,registeredCount:2});
  await setWebinarStatus(f.admin.id,{id:created.id,status:'completed',reason:'Finished'});
  await expect(updateWebinarMetadata(f.admin.id,{...patch,maxParticipants:3})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
 });
 it('serializes a capacity reduction against a concurrent admission',async()=>{
  const f=await fixture(),created=await createAdminWebinar(f.admin.id,{...input(),maxParticipants:2});
  await registerForWebinar(f.learner.id,created.id);
  const [second]=await f.db.insert(users).values({openId:randomUUID()}).returning();
  const results=await Promise.allSettled([updateWebinarMetadata(f.admin.id,{id:created.id,title:'One place',description:null,maxParticipants:1,reason:'Reduce seats'}),registerForWebinar(second.id,created.id)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  const room=(await listAdminWebinars(f.admin.id)).find(w=>w.id===created.id)!;
  expect(room.registeredCount).toBeLessThanOrEqual(room.maxParticipants!);
  expect([1,2]).toContain(room.registeredCount);
 });

 it('projects the audit without private room URLs or user secrets, including after cancellation',async()=>{
  const f=await fixture(),created=await createAdminWebinar(f.admin.id,input());
  await f.db.update(webinars).set({meetingUrl:'https://private.example.test/meeting-secret',replayUrl:'https://private.example.test/replay-secret',liveRoom:'private-room-secret'}).where(eq(webinars.id,created.id));
  await f.db.update(users).set({name:'Current admin',email:`${randomUUID()}@example.test`,passwordHash:'private-hash'}).where(eq(users.id,f.admin.id));
  await setWebinarStatus(f.admin.id,{id:created.id,status:'cancelled',reason:'Cancellation fixture'});
  const history=await webinarHistory(f.admin.id,{id:created.id});
  expect(history.webinar.status).toBe('cancelled');expect(history.events).toHaveLength(2);
  expect(history.events[0]).toMatchObject({actorId:f.admin.id,actorName:'Current admin',previous:{status:'scheduled'},next:{status:'cancelled'}});
  expect(history.events[1].previous).toBeNull();
  expect(Object.keys(history.events[0].next).sort()).toEqual(['title','description','scheduledAt','durationMinutes','maxParticipants','status','trainingId'].sort());
  expect(JSON.stringify(history)).not.toMatch(/meeting-secret|replay-secret|private-room-secret|private-hash|@example.test/);
  await expect(webinarHistory(f.learner.id,{id:created.id})).rejects.toMatchObject({code:'FORBIDDEN'});
  await f.db.update(users).set({status:'suspended'}).where(eq(users.id,f.admin.id));
  await expect(webinarHistory(f.admin.id,{id:created.id})).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('paginates the selected webinar consistently while new audit events arrive',async()=>{
  const f=await fixture(),created=await createAdminWebinar(f.admin.id,input()),other=await createAdminWebinar(f.admin.id,input());
  await f.db.execute(sql`insert into webinar_admin_events ("webinarId","actorId",action,previous,next,reason) select ${created.id},${f.admin.id},'metadata','{}'::jsonb,'{"title":"fixture"}'::jsonb,'Fixture pagination' from generate_series(1,52)`);
  await setWebinarStatus(f.admin.id,{id:other.id,status:'cancelled',reason:'Other room'});
  const first=await webinarHistory(f.admin.id,{id:created.id});expect(first.events).toHaveLength(50);expect(first.nextCursor).not.toBeNull();
  await rescheduleWebinar(f.admin.id,{id:created.id,scheduledAt:'2027-02-10T12:00:00Z',durationMinutes:90,reason:'Recent insertion'});
  const second=await webinarHistory(f.admin.id,{id:created.id,before:first.nextCursor!});expect(second.events).toHaveLength(3);expect(second.nextCursor).toBeNull();
  expect(new Set([...first.events,...second.events].map(e=>e.id)).size).toBe(53);
  expect([...first.events,...second.events].some(e=>e.reason==='Other room'||e.reason==='Recent insertion')).toBe(false);
  await expect(webinarHistory(f.admin.id,{id:created.id,before:2147483648})).rejects.toThrow();
 });

 it('counts registrations separately for each webinar in the administrative list',async()=>{
  const f=await fixture();const empty=await createAdminWebinar(f.admin.id,input());const occupied=await createAdminWebinar(f.admin.id,input());
  const people=await f.db.insert(users).values(Array.from({length:3},()=>({openId:randomUUID()}))).returning();
  await f.db.insert(webinarRegistrations).values(people.map(p=>({webinarId:occupied.id,userId:p.id})));
  const rows=await listAdminWebinars(f.admin.id);
  expect(rows.find(r=>r.id===empty.id)?.registeredCount).toBe(0);
  expect(rows.find(r=>r.id===occupied.id)?.registeredCount).toBe(3);
 });

});
