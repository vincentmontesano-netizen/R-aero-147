import {instructorAgenda} from "./instructorAgenda";
import {beforeAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {getDb} from './db';
import {getLiveAccess,requireLiveRoom,createLivePoll} from './live';
import {requireAuthorCourse} from './makerAccess';
import {liveInstructorHistory,setLiveInstructor,listLiveInstructors,searchLiveInstructors} from './liveInstructors';
import {users,trainings,sessions,webinars,liveInstructorAssignments,companies} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('explicit class instructors · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 async function fixture(){const db=(await getDb())!;const [admin,author,instructor,learner]=await db.insert(users).values([{openId:randomUUID(),role:'admin' as const},{openId:randomUUID(),role:'instructor' as const},{openId:randomUUID(),role:'instructor' as const,name:`Instructor ${randomUUID()}`},{openId:randomUUID()}]).returning();const [course]=await db.insert(trainings).values({title:'Class',slug:randomUUID(),ownerUserId:author.id}).returning();const [session]=await db.insert(sessions).values({title:'Class',trainingId:course.id,startDate:new Date(),endDate:new Date(Date.now()+3600000)}).returning();const [webinar]=await db.insert(webinars).values({title:'Other room',scheduledAt:new Date(),durationMinutes:60}).returning();return {db,admin,author,instructor,learner,course,session,webinar};}
 it('requires explicit assignment, grants only class moderation and revokes it on removal',async()=>{
  const f=await fixture(),room={roomType:'session' as const,roomId:f.session.id};
  expect((await getLiveAccess('session',f.session.id,f.author))?.isModerator).toBe(false);
  expect((await getLiveAccess('session',f.session.id,f.admin))?.isModerator).toBe(true);
  await setLiveInstructor(f.admin.id,{...room,userId:f.instructor.id,active:true,reason:'Assigned instructor'});
  expect((await requireLiveRoom('session',f.session.id,f.instructor.id,true)).isModerator).toBe(true);
  await expect(requireAuthorCourse(f.instructor,f.course.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  expect((await getLiveAccess('webinar',f.webinar.id,f.instructor))?.isModerator).toBe(false);
  await createLivePoll({...room,kind:'poll',question:'Ready?',options:['Yes','No']},f.instructor.id);
  await setLiveInstructor(f.admin.id,{...room,userId:f.instructor.id,active:false,reason:'Replacement scheduled'});
  await expect(requireLiveRoom('session',f.session.id,f.instructor.id,true)).rejects.toMatchObject({code:'FORBIDDEN'});
  const links=await listLiveInstructors(f.admin.id,room);expect(links).toHaveLength(1);expect(links[0].active).toBe(false);
  const events=await f.db.execute(sql`select "previousActive",active from live_instructor_events where "assignmentId"=${links[0].id} order by id`);expect(events).toEqual([{previousActive:false,active:true},{previousActive:true,active:false}]);
  await expect(f.db.delete(liveInstructorAssignments).where(eq(liveInstructorAssignments.id,links[0].id))).rejects.toThrow();
  await expect(f.db.execute(sql`delete from live_instructor_events where "assignmentId"=${links[0].id}`)).rejects.toThrow();
 });
 it('serializes duplicate assignments and rejects invalid roles, inactive users and terminal room activation',async()=>{
  const f=await fixture(),input={roomType:'webinar' as const,roomId:f.webinar.id,userId:f.instructor.id,active:true,reason:'Webinar instructor'};
  await expect(setLiveInstructor(f.author.id,input)).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(setLiveInstructor(f.admin.id,{...input,userId:f.learner.id})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
  const results=await Promise.all([setLiveInstructor(f.admin.id,input),setLiveInstructor(f.admin.id,input)]);expect(results.filter(r=>r.changed)).toHaveLength(1);
  const [link]=await listLiveInstructors(f.admin.id,{roomType:input.roomType,roomId:input.roomId});expect(await f.db.execute(sql`select id from live_instructor_events where "assignmentId"=${link.id}`)).toHaveLength(1);
  await f.db.update(users).set({status:'suspended'}).where(eq(users.id,f.instructor.id));
  await expect(requireLiveRoom('webinar',f.webinar.id,f.instructor.id,true)).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(setLiveInstructor(f.admin.id,input)).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
  await setLiveInstructor(f.admin.id,{...input,active:false,reason:'Inactive instructor removal'});
  await f.db.update(users).set({status:'active'}).where(eq(users.id,f.instructor.id));
  await f.db.update(webinars).set({status:'completed'}).where(eq(webinars.id,f.webinar.id));
  await expect(setLiveInstructor(f.admin.id,input)).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
 });
 it('limits candidate lookup and denies company-suspended moderation without erasing the assignment',async()=>{
  const f=await fixture(),room={roomType:'session' as const,roomId:f.session.id};
  expect(await searchLiveInstructors(f.admin.id,{search:f.instructor.name!})).toEqual([{id:f.instructor.id,name:f.instructor.name,email:null}]);
  await expect(searchLiveInstructors(f.learner.id,{search:'Instructor'})).rejects.toMatchObject({code:'FORBIDDEN'});
  await setLiveInstructor(f.admin.id,{...room,userId:f.instructor.id,active:true,reason:'Company class'});
  const [company]=await f.db.insert(companies).values({name:randomUUID(),status:'SUSPENDED'}).returning();
  await f.db.update(trainings).set({ownerOrgId:company.id}).where(eq(trainings.id,f.course.id));
  await expect(requireLiveRoom('session',f.session.id,f.instructor.id,true)).rejects.toMatchObject({code:'FORBIDDEN'});
  expect((await listLiveInstructors(f.admin.id,room))[0].active).toBe(true);
 });
 it('lists only the caller’s active permitted teaching assignments without private URLs',async()=>{
  const f=await fixture(),range={from:new Date(Date.now()-86400000).toISOString(),to:new Date(Date.now()+86400000).toISOString()};
  await setLiveInstructor(f.admin.id,{roomType:'session',roomId:f.session.id,userId:f.instructor.id,active:true,reason:'Agenda class'});
  await f.db.update(sessions).set({meetingUrl:'https://private.example.test/secret',liveRoom:'secret-room',replayUrl:'https://private.example.test/replay'}).where(eq(sessions.id,f.session.id));
  const agenda=await instructorAgenda(f.instructor.id,range);expect(agenda.entries).toHaveLength(1);expect(agenda.entries[0]).toMatchObject({roomType:'session',roomId:f.session.id,title:'Class'});
  expect(Object.keys(agenda.entries[0]).sort()).toEqual(['assignmentId','roomType','roomId','title','status','startsAt','endsAt'].sort());
  expect(JSON.stringify(agenda)).not.toContain('secret');
  expect((await instructorAgenda(f.author.id,range)).entries).toHaveLength(0);
  await expect(instructorAgenda(f.learner.id,range)).rejects.toMatchObject({code:'FORBIDDEN'});
  await setLiveInstructor(f.admin.id,{roomType:'session',roomId:f.session.id,userId:f.instructor.id,active:false,reason:'Removed agenda class'});
  expect((await instructorAgenda(f.instructor.id,range)).entries).toHaveLength(0);
 });
 it('includes overlapping sessions, calculates webinar end and filters inactive company assignments',async()=>{
  const f=await fixture(),range={from:'2027-01-10T00:00:00Z',to:'2027-01-11T00:00:00Z'};
  await f.db.update(sessions).set({startDate:new Date('2027-01-09T12:00:00Z'),endDate:new Date('2027-01-10T12:00:00Z')}).where(eq(sessions.id,f.session.id));
  await f.db.update(webinars).set({scheduledAt:new Date('2027-01-10T10:00:00Z'),durationMinutes:90}).where(eq(webinars.id,f.webinar.id));
  for(const room of [{roomType:'session' as const,roomId:f.session.id},{roomType:'webinar' as const,roomId:f.webinar.id}])await setLiveInstructor(f.admin.id,{...room,userId:f.instructor.id,active:true,reason:'Agenda fixture'});
  const first=await instructorAgenda(f.instructor.id,range);expect(first.entries).toHaveLength(2);expect(first.entries[1].endsAt).toBe('2027-01-10T11:30:00.000Z');
  const [company]=await f.db.insert(companies).values({name:randomUUID(),status:'SUSPENDED'}).returning();await f.db.update(trainings).set({ownerOrgId:company.id}).where(eq(trainings.id,f.course.id));
  expect((await instructorAgenda(f.instructor.id,range)).entries.map(e=>e.roomType)).toEqual(['webinar']);
  await f.db.update(users).set({status:'suspended'}).where(eq(users.id,f.instructor.id));
  await expect(instructorAgenda(f.instructor.id,range)).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('paginates tied dates without loss and validates the requested period',async()=>{
  const f=await fixture(),range={from:'2027-01-01T00:00:00Z',to:'2027-02-01T00:00:00Z'};
  const rooms=await f.db.insert(sessions).values(Array.from({length:53},()=>({title:'Agenda pagination',startDate:new Date('2027-01-10T12:00:00Z'),endDate:new Date('2027-01-10T13:00:00Z')}))).returning();
  await f.db.insert(liveInstructorAssignments).values(rooms.map(r=>({roomType:'session',roomId:r.id,userId:f.instructor.id,active:true})));
  const first=await instructorAgenda(f.instructor.id,range);expect(first.entries).toHaveLength(50);
  const second=await instructorAgenda(f.instructor.id,{...range,after:first.nextCursor!});expect(second.entries).toHaveLength(3);expect(second.nextCursor).toBeNull();
  expect(new Set([...first.entries,...second.entries].map(e=>e.assignmentId)).size).toBe(53);
  await expect(instructorAgenda(f.instructor.id,{...range,to:'2028-01-01T00:00:00Z'})).rejects.toThrow();
  await expect(instructorAgenda(f.instructor.id,{from:range.to,to:range.from})).rejects.toThrow();
 });

 it('exposes scoped assignment history with minimal actor and instructor fields after withdrawal',async()=>{
  const f=await fixture(),room={roomType:'session' as const,roomId:f.session.id};
  await setLiveInstructor(f.admin.id,{...room,userId:f.instructor.id,active:true,reason:'Initial assignment'});
  await setLiveInstructor(f.admin.id,{...room,userId:f.instructor.id,active:false,reason:'Instructor replacement'});
  await f.db.update(users).set({name:'Current instructor',email:`${randomUUID()}@example.test`,passwordHash:'instructor-secret'}).where(eq(users.id,f.instructor.id));
  await f.db.update(users).set({name:'Current administrator',email:`${randomUUID()}@example.test`,passwordHash:'admin-secret'}).where(eq(users.id,f.admin.id));
  await f.db.update(sessions).set({status:'completed'}).where(eq(sessions.id,f.session.id));
  const history=await liveInstructorHistory(f.admin.id,room);expect(history.events).toHaveLength(2);
  expect(history.events[0]).toMatchObject({actorId:f.admin.id,actorName:'Current administrator',userId:f.instructor.id,instructorName:'Current instructor',previousActive:true,active:false,reason:'Instructor replacement'});
  expect(Object.keys(history.events[0]).sort()).toEqual(['id','assignmentId','userId','instructorName','actorId','actorName','previousActive','active','reason','createdAt'].sort());
  expect(JSON.stringify(history)).not.toMatch(/@example.test|instructor-secret|admin-secret/);
  await expect(liveInstructorHistory(f.instructor.id,room)).rejects.toMatchObject({code:'FORBIDDEN'});
  await f.db.update(users).set({status:'suspended'}).where(eq(users.id,f.admin.id));
  await expect(liveInstructorHistory(f.admin.id,room)).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('paginates assignment events without mixing classes or duplicating older entries',async()=>{
  const f=await fixture(),room={roomType:'session' as const,roomId:f.session.id};
  await setLiveInstructor(f.admin.id,{...room,userId:f.instructor.id,active:true,reason:'Initial assignment'});
  const [link]=await listLiveInstructors(f.admin.id,room);
  await f.db.execute(sql`insert into live_instructor_events ("assignmentId","actorId","previousActive",active,reason) select ${link.id},${f.admin.id},false,true,'Pagination fixture' from generate_series(1,52)`);
  await setLiveInstructor(f.admin.id,{roomType:'webinar',roomId:f.webinar.id,userId:f.instructor.id,active:true,reason:'Other class'});
  const first=await liveInstructorHistory(f.admin.id,room);expect(first.events).toHaveLength(50);expect(first.nextCursor).not.toBeNull();
  await setLiveInstructor(f.admin.id,{...room,userId:f.instructor.id,active:false,reason:'Recent withdrawal'});
  const second=await liveInstructorHistory(f.admin.id,{...room,before:first.nextCursor!});expect(second.events).toHaveLength(3);expect(second.nextCursor).toBeNull();
  expect(new Set([...first.events,...second.events].map(e=>e.id)).size).toBe(53);
  expect([...first.events,...second.events].every(e=>e.assignmentId===link.id&&e.reason!=='Recent withdrawal')).toBe(true);
  await expect(liveInstructorHistory(f.admin.id,{...room,before:2147483648})).rejects.toThrow();
 });

});
