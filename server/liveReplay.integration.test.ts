import {beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {eq,sql} from 'drizzle-orm';
import {getDb} from './db';
import {setReplayUrl,getReplayHistory} from './live';
import {appRouter} from './routers';
import {companies,users,trainings,sessions,webinars,liveInstructorAssignments} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('replay closure permissions',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 for(const roomType of ['session','webinar'] as const)it(`checks current rights and closes ${roomType} atomically`,async()=>{
  const db=(await getDb())!;
  const [instructor,admin,learner]=await db.insert(users).values((['instructor','admin','user'] as const).map(role=>({openId:randomUUID(),role}))).returning();
  const [company]=await db.insert(companies).values({name:'Replay fixture'}).returning();
  const [course]=await db.insert(trainings).values({title:'Replay fixture',slug:randomUUID(),ownerOrgId:company.id}).returning();
  const table=roomType==='session'?sessions:webinars;
  const room=roomType==='session'
   ?(await db.insert(sessions).values({title:'Replay',trainingId:course.id,startDate:new Date(),endDate:new Date(Date.now()+3600000)}).returning())[0]
   :(await db.insert(webinars).values({title:'Replay',trainingId:course.id,scheduledAt:new Date(),durationMinutes:60}).returning())[0];
  const read=async()=>(await db.select().from(table).where(eq(table.id,room.id)))[0];
  const history=()=>db.execute(sql`select * from live_replay_events where "roomType"=${roomType} and "roomId"=${room.id} order by id`);
  const original=await read(),replay='https://example.test/replay.mp4';
  const close=async(id:number,value=replay)=>setReplayUrl(roomType,room.id,value,id,(await read()).replayRevision);
  await expect(close(learner.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(close(instructor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  const [assignment]=await db.insert(liveInstructorAssignments).values({roomType,roomId:room.id,userId:instructor.id,active:true}).returning();
  for(const invalid of ['http://example.test/video','javascript:alert(1)','invalid','https://example.test/'+ 'x'.repeat(512)])await expect(close(instructor.id,invalid)).rejects.toMatchObject({code:'BAD_REQUEST'});
  await db.update(users).set({status:'suspended'}).where(eq(users.id,instructor.id));
  await expect(close(instructor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await db.update(users).set({status:'active'}).where(eq(users.id,instructor.id));
  await db.update(companies).set({status:'SUSPENDED'}).where(eq(companies.id,company.id));
  await expect(close(instructor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await db.update(companies).set({status:'ACTIVE'}).where(eq(companies.id,company.id));
  await db.update(liveInstructorAssignments).set({active:false}).where(eq(liveInstructorAssignments.id,assignment.id));
  await expect(close(instructor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  expect(await read()).toEqual(original);
  await db.update(liveInstructorAssignments).set({active:true}).where(eq(liveInstructorAssignments.id,assignment.id));
  const triggerName=`replay_failure_${roomType}_${room.id}`;
  await db.execute(sql.raw(`CREATE FUNCTION ${triggerName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."roomType"='${roomType}' AND NEW."roomId"=${room.id} THEN RAISE EXCEPTION 'fixture journal failure'; END IF; RETURN NEW; END $$`));
  await db.execute(sql.raw(`CREATE TRIGGER ${triggerName} BEFORE INSERT ON live_replay_events FOR EACH ROW EXECUTE FUNCTION ${triggerName}()`));
  try {
   await expect(close(instructor.id)).rejects.toThrow();
   expect(await read()).toEqual(original);
   expect(await history()).toHaveLength(0);
  } finally {
   await db.execute(sql.raw(`DROP TRIGGER ${triggerName} ON live_replay_events`));
   await db.execute(sql.raw(`DROP FUNCTION ${triggerName}()`));
  }
  await expect(close(instructor.id)).resolves.toEqual({success:true});
  await Promise.all([close(instructor.id),close(admin.id)]);
  expect(await history()).toHaveLength(1);
  expect((await history())[0]).toMatchObject({actorId:instructor.id,previousStatus:original.status,previousUrl:original.replayUrl,status:'completed',url:replay});
  expect(await read()).toMatchObject({replayUrl:replay,status:'completed'});
  await expect(close(admin.id,replay+'?corrected=1')).resolves.toEqual({success:true});
  const events=await history();
  expect(events).toHaveLength(2);
  expect(events[1]).toMatchObject({actorId:admin.id,previousStatus:'completed',previousUrl:replay,url:replay+'?corrected=1'});
  await expect(db.execute(sql`update live_replay_events set url='https://example.test/tampered' where id=${events[0].id}`)).rejects.toThrow();
  await expect(db.execute(sql`delete from live_replay_events where id=${events[0].id}`)).rejects.toThrow();
  await expect(db.execute(sql`truncate live_replay_events`)).rejects.toThrow();
  expect(await history()).toEqual(events);
  const input={roomType,roomId:room.id};
  const api=appRouter.createCaller({user:instructor,req:{headers:{}},res:{}} as any);
  expect((await api.live.replayHistory(input)).entries.map(e=>e.id)).toEqual(events.map(e=>e.id).reverse());
  await expect(getReplayHistory(learner.id,input)).rejects.toMatchObject({code:'FORBIDDEN'});
  await db.update(liveInstructorAssignments).set({active:false}).where(eq(liveInstructorAssignments.id,assignment.id));
  await expect(api.live.replayHistory(input)).rejects.toMatchObject({code:'FORBIDDEN'});
  await db.update(liveInstructorAssignments).set({active:true}).where(eq(liveInstructorAssignments.id,assignment.id));
  await db.update(companies).set({status:'SUSPENDED'}).where(eq(companies.id,company.id));
  await expect(api.live.replayHistory(input)).rejects.toMatchObject({code:'FORBIDDEN'});
  await db.update(companies).set({status:'ACTIVE'}).where(eq(companies.id,company.id));
  await db.update(users).set({status:'suspended'}).where(eq(users.id,instructor.id));
  await expect(api.live.replayHistory(input)).rejects.toMatchObject({code:'FORBIDDEN'});
  await db.update(users).set({status:'active'}).where(eq(users.id,instructor.id));
  for(let n=0;n<53;n++)await close(admin.id,replay+'?revision='+n);
  const foreign=roomType==='session'
   ?(await db.insert(webinars).values({title:'Other replay scope',scheduledAt:new Date(),durationMinutes:60}).returning())[0]
   :(await db.insert(sessions).values({title:'Other replay scope',startDate:new Date(),endDate:new Date(Date.now()+3600000)}).returning())[0];
  await db.execute(sql`insert into live_replay_events ("roomType","roomId","actorId",status,url) values (${roomType==='session'?'webinar':'session'},${foreign.id},${admin.id},'completed','https://example.test/other-scope')`);
  const first=await api.live.replayHistory(input);expect(first.entries).toHaveLength(50);
  await close(admin.id,replay+'?latest');
  const next=await api.live.replayHistory({...input,beforeId:first.nextCursor!});
  expect(next.entries).toHaveLength(5);expect(next.nextCursor).toBeNull();
  const all=[...first.entries,...next.entries];
  expect(new Set(all.map(e=>e.id)).size).toBe(55);
  expect(all.every(e=>e.roomId===room.id&&e.roomType===roomType&&!e.url.includes('latest')&&!e.url.includes('other-scope'))).toBe(true);
  await expect(api.live.replayHistory({...input,beforeId:0})).rejects.toMatchObject({code:'BAD_REQUEST'});
  const base=(await read()).replayRevision;
  const races=await Promise.allSettled([
   setReplayUrl(roomType,room.id,replay+'?race=a',instructor.id,base),
   setReplayUrl(roomType,room.id,replay+'?race=b',admin.id,base),
  ]);
  expect(races.filter(result=>result.status==='fulfilled')).toHaveLength(1);
  expect(races.find(result=>result.status==='rejected')).toMatchObject({reason:{code:'CONFLICT'}});
  const winner=await read();expect(winner.replayRevision).toBe(base+1);
  const recorded=await history();
  await expect(setReplayUrl(roomType,room.id,winner.replayUrl!,admin.id,base)).resolves.toEqual({success:true});
  expect(await history()).toEqual(recorded);
  await expect(db.update(table).set({replayRevision:0}).where(eq(table.id,room.id))).rejects.toThrow();
  await db.update(table).set({status:'cancelled'}).where(eq(table.id,room.id));
  await expect(close(admin.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  expect(await read()).toMatchObject({status:'cancelled',replayUrl:winner.replayUrl,replayRevision:base+2});
  await expect(api.live.replayHistory(input)).rejects.toMatchObject({code:'FORBIDDEN'});
 });

 it('retains authorization and class locks through journal insertion, then honors revocation',async()=>{
  const db=(await getDb())!;
  const [company]=await db.insert(companies).values({name:'Concurrent replay fixture'}).returning();
  const [actor]=await db.insert(users).values({openId:randomUUID(),role:'instructor'}).returning();
  const [course]=await db.insert(trainings).values({title:'Concurrent replay',slug:randomUUID(),ownerOrgId:company.id}).returning();
  const [room]=await db.insert(sessions).values({title:'Concurrent replay',trainingId:course.id,startDate:new Date(),endDate:new Date(Date.now()+3600000)}).returning();
  const [assignment]=await db.insert(liveInstructorAssignments).values({roomType:'session',roomId:room.id,userId:actor.id,active:true}).returning();
  const name=`replay_wait_${room.id}`,control=postgres(url!,{max:1});
  let pending:Promise<unknown>|undefined;
  await db.execute(sql.raw(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."roomType"='session' AND NEW."roomId"=${room.id} THEN PERFORM pg_advisory_xact_lock(${room.id},297); END IF; RETURN NEW; END $$`));
  await db.execute(sql.raw(`CREATE TRIGGER ${name} BEFORE INSERT ON live_replay_events FOR EACH ROW EXECUTE FUNCTION ${name}()`));
  try{
   await control`SELECT pg_advisory_lock(${room.id},297)`;
   pending=setReplayUrl('session',room.id,'https://example.test/concurrent-replay',actor.id,room.replayRevision).then(value=>({value}),error=>({error}));
   let waiting=false;
   for(let attempt=0;attempt<100;attempt++){
    const locks=await control`SELECT pid FROM pg_locks WHERE locktype='advisory' AND classid=${room.id}::oid AND objid=297::oid AND objsubid=2 AND NOT granted`;
    if(locks.length){waiting=true;break;}
    await new Promise(resolve=>setTimeout(resolve,20));
   }
   expect(waiting,'cloture must reach journal insertion before the concurrent mutations').toBe(true);
   expect((await db.select().from(sessions).where(eq(sessions.id,room.id)))[0]).toMatchObject({status:room.status,replayUrl:room.replayUrl});
   await control`SET lock_timeout='100ms'`;
   await expect(control`UPDATE users SET status='suspended' WHERE id=${actor.id}`).rejects.toMatchObject({code:'55P03'});
   await expect(control`UPDATE companies SET status='SUSPENDED' WHERE id=${company.id}`).rejects.toMatchObject({code:'55P03'});
   await expect(control`UPDATE live_instructor_assignments SET active=false WHERE id=${assignment.id}`).rejects.toMatchObject({code:'55P03'});
   await expect(control`UPDATE trainings SET title='Concurrent edit' WHERE id=${course.id}`).rejects.toMatchObject({code:'55P03'});
   await expect(control`UPDATE sessions SET status='cancelled' WHERE id=${room.id}`).rejects.toMatchObject({code:'55P03'});
   await control`SELECT pg_advisory_unlock(${room.id},297)`;
   expect(await pending).toEqual({value:{success:true}});
   await control`UPDATE live_instructor_assignments SET active=false WHERE id=${assignment.id}`;
   await expect(setReplayUrl('session',room.id,'https://example.test/denied',actor.id,room.replayRevision)).rejects.toMatchObject({code:'FORBIDDEN'});
   await expect(getReplayHistory(actor.id,{roomType:'session',roomId:room.id})).rejects.toMatchObject({code:'FORBIDDEN'});
   const events=await db.execute(sql`select * from live_replay_events where "roomType"='session' and "roomId"=${room.id}`);
   expect(events).toHaveLength(1);expect(events[0]).toMatchObject({actorId:actor.id,url:'https://example.test/concurrent-replay'});
   expect((await db.select().from(sessions).where(eq(sessions.id,room.id)))[0]).toMatchObject({status:'completed',replayUrl:'https://example.test/concurrent-replay'});
  }finally{
   await control`SELECT pg_advisory_unlock_all()`;
   await pending;
   await db.execute(sql.raw(`DROP TRIGGER ${name} ON live_replay_events`));
   await db.execute(sql.raw(`DROP FUNCTION ${name}()`));
   await control.end();
  }
 },10000);
});
