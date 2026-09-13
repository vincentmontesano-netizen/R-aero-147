import {storagePut} from "./storage";
import {beforeAll,beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
vi.mock('./storage',()=>({storagePut:vi.fn(async(key:string)=>({key,url:`/storage/${key}`}))}));
vi.mock('./veoProvider',async original=>({...await original<typeof import('./veoProvider')>(),startVideoGeneration:vi.fn(),checkVideoGeneration:vi.fn(),downloadGeneratedVideo:vi.fn()}));
import {startVideoGeneration,checkVideoGeneration,downloadGeneratedVideo} from './veoProvider';
import {getDb} from './db';
import {startAiVideo,listAiVideos,refreshAiVideo,processPendingAiVideos} from './aiVideoJobs';
import {users,companies,affiliations,trainings,aiVideoJobs,courseMedia} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('durable private video jobs · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});beforeEach(()=>{vi.mocked(storagePut).mockReset().mockImplementation(async(key:string)=>({key,url:`/storage/${key}`}));vi.stubEnv('GEMINI_API_KEY','fixture');vi.stubEnv('GEMINI_VIDEO_MODEL','veo-fixture');vi.stubEnv('AI_VIDEO_REQUESTS_PER_HOUR','2');vi.mocked(startVideoGeneration).mockReset().mockImplementation(async()=>({operationName:`operations/${randomUUID()}`,model:'veo-fixture'}));vi.mocked(checkVideoGeneration).mockReset().mockResolvedValue({state:'ready',uri:'fixture'});const bytes=Buffer.alloc(20);bytes.writeUInt32BE(20);bytes.write('ftyp',4);bytes.write('isom',8);vi.mocked(downloadGeneratedVideo).mockReset().mockResolvedValue(bytes);});afterEach(()=>vi.unstubAllEnvs());
 async function fixture(){const db=(await getDb())!;const [actor,other]=await db.insert(users).values([{openId:randomUUID(),role:'instructor'},{openId:randomUUID(),role:'instructor'}]).returning();const [course]=await db.insert(trainings).values({title:'Video',slug:randomUUID(),ownerUserId:actor.id}).returning();return {db,actor,other,course,input:{id:randomUUID(),trainingId:course.id,prompt:'Aircraft inspection'}};}
 it('reserves once under duplicate submissions and stores a single private media result under concurrent refresh',async()=>{
  const f=await fixture();const [a,b]=await Promise.all([startAiVideo(f.actor.id,f.input),startAiVideo(f.actor.id,f.input)]);expect(a).toEqual(b);expect(startVideoGeneration).toHaveBeenCalledTimes(1);
  await Promise.all([refreshAiVideo(f.actor.id,a.id),refreshAiVideo(f.actor.id,a.id)]);expect(checkVideoGeneration).toHaveBeenCalledTimes(1);expect(downloadGeneratedVideo).toHaveBeenCalledTimes(1);
  const list=await listAiVideos(f.actor.id,f.course.id);expect(list.used).toBe(1);expect(list.entries[0]).toMatchObject({id:a.id,status:'ready'});expect(list.entries[0].url).toMatch(/^\/storage\/course-media\//);expect(Object.keys(list.entries[0]).sort()).toEqual(['createdAt','durationSeconds','id','status','url']);expect(await f.db.select().from(courseMedia).where(eq(courseMedia.trainingId,f.course.id))).toHaveLength(1);
  await expect(f.db.execute(sql`delete from ai_video_jobs where id=${a.id}`)).rejects.toThrow();await expect(f.db.execute(sql`update ai_video_jobs set input='{}' where id=${a.id}`)).rejects.toThrow();
 });
 it('retains unknown submission outcomes and never resubmits the same request or changed parameters',async()=>{
  const f=await fixture();vi.mocked(startVideoGeneration).mockRejectedValueOnce(new Error('Lost provider reply'));await startAiVideo(f.actor.id,f.input);await startAiVideo(f.actor.id,f.input);expect(startVideoGeneration).toHaveBeenCalledTimes(1);expect((await listAiVideos(f.actor.id,f.course.id)).entries[0].status).toBe('unknown');
  await expect(startAiVideo(f.actor.id,{...f.input,prompt:'Different scene'})).rejects.toMatchObject({code:'CONFLICT'});await refreshAiVideo(f.actor.id,f.input.id);expect(checkVideoGeneration).not.toHaveBeenCalled();
  vi.stubEnv('AI_VIDEO_REQUESTS_PER_HOUR','1');await expect(startAiVideo(f.actor.id,{...f.input,id:randomUUID()})).rejects.toMatchObject({code:'TOO_MANY_REQUESTS'});
 });
 it('isolates jobs and rechecks organization membership before any polling or download',async()=>{
  const f=await fixture();const [org]=await f.db.insert(companies).values({name:randomUUID()}).returning();const [link]=await f.db.insert(affiliations).values({personId:f.actor.id,orgId:org.id,role:'MANAGER'}).returning();await f.db.update(trainings).set({ownerOrgId:org.id}).where(eq(trainings.id,f.course.id));await startAiVideo(f.actor.id,f.input);
  await expect(refreshAiVideo(f.other.id,f.input.id)).rejects.toMatchObject({code:'NOT_FOUND'});await f.db.update(affiliations).set({status:'INACTIVE'}).where(eq(affiliations.id,link.id));await expect(refreshAiVideo(f.actor.id,f.input.id)).rejects.toMatchObject({code:'FORBIDDEN'});await expect(listAiVideos(f.actor.id,f.course.id)).rejects.toMatchObject({code:'FORBIDDEN'});expect(checkVideoGeneration).not.toHaveBeenCalled();expect(downloadGeneratedVideo).not.toHaveBeenCalled();
 });
 it('keeps a known operation retryable after a download failure without another generation',async()=>{
  const f=await fixture();await startAiVideo(f.actor.id,f.input);vi.mocked(downloadGeneratedVideo).mockRejectedValueOnce(new Error('Temporary transport failure'));await expect(refreshAiVideo(f.actor.id,f.input.id)).resolves.toMatchObject({retry:true});await refreshAiVideo(f.actor.id,f.input.id);expect(downloadGeneratedVideo).toHaveBeenCalledTimes(1);expect((await listAiVideos(f.actor.id,f.course.id)).entries[0].status).toBe('running');expect(await f.db.select().from(courseMedia).where(eq(courseMedia.trainingId,f.course.id))).toHaveLength(0);
  await f.db.execute(sql`update ai_video_jobs set "checkedAt"=now()-interval '11 seconds' where id=${f.input.id}`);await refreshAiVideo(f.actor.id,f.input.id);expect((await listAiVideos(f.actor.id,f.course.id)).entries[0].status).toBe('ready');expect(startVideoGeneration).toHaveBeenCalledTimes(1);
 });
 it('collects in the background concurrently with manual refresh without duplicate media',async()=>{
  const f=await fixture();await startAiVideo(f.actor.id,f.input);
  await Promise.all([processPendingAiVideos(5,f.course.id),processPendingAiVideos(5,f.course.id),refreshAiVideo(f.actor.id,f.input.id)]);
  expect(checkVideoGeneration).toHaveBeenCalledTimes(1);expect(downloadGeneratedVideo).toHaveBeenCalledTimes(1);expect(startVideoGeneration).toHaveBeenCalledTimes(1);expect((await listAiVideos(f.actor.id,f.course.id)).entries[0].status).toBe('ready');
  expect(await f.db.select().from(courseMedia).where(eq(courseMedia.trainingId,f.course.id))).toHaveLength(1);
 });
 it('isolates a failed operation, processes the next one and never submits unknown requests',async()=>{
  const f=await fixture();const ids=[randomUUID(),randomUUID(),randomUUID(),randomUUID()];
  await f.db.insert(aiVideoJobs).values(ids.map((id,i)=>({id,userId:f.actor.id,trainingId:f.course.id,model:'veo-fixture',input:{prompt:'Fixture',aspectRatio:'16:9' as const,durationSeconds:8 as const},status:i<2?'running':i===2?'submitting':'unknown',operationName:i<2?`operations/${id}`:null})));
  vi.mocked(checkVideoGeneration).mockImplementation(async name=>{if(name===`operations/${ids[0]}`)throw new Error('Fixture failure');return {state:'ready',uri:'fixture'};});
  expect(await processPendingAiVideos(5,f.course.id)).toEqual({processed:1,failed:1});
  expect(startVideoGeneration).not.toHaveBeenCalled();expect(checkVideoGeneration).toHaveBeenCalledTimes(2);expect(await processPendingAiVideos(5,f.course.id)).toEqual({processed:0,failed:0});
  const rows=await f.db.select().from(aiVideoJobs).where(eq(aiVideoJobs.trainingId,f.course.id));expect(rows.find(r=>r.id===ids[0])).toMatchObject({status:'running'});expect(rows.find(r=>r.id===ids[1])).toMatchObject({status:'ready'});expect(rows.find(r=>r.id===ids[2])).toMatchObject({status:'submitting'});expect(rows.find(r=>r.id===ids[3])).toMatchObject({status:'unknown'});
 });
 it('does not bypass a suspended author during background collection and can resume after restoration',async()=>{
  const f=await fixture();await startAiVideo(f.actor.id,f.input);await f.db.update(users).set({status:'suspended'}).where(eq(users.id,f.actor.id));
  expect(await processPendingAiVideos(5,f.course.id)).toEqual({processed:0,failed:1});expect(checkVideoGeneration).not.toHaveBeenCalled();
  await f.db.update(users).set({status:'active'}).where(eq(users.id,f.actor.id));await f.db.execute(sql`update ai_video_jobs set "checkedAt"=now()-interval '31 seconds' where id=${f.input.id}`);
  expect(await processPendingAiVideos(5,f.course.id)).toEqual({processed:1,failed:0});expect((await listAiVideos(f.actor.id,f.course.id)).entries[0].status).toBe('ready');
 });

 it('rolls back a failed media SQL insert while advancing the other queued job',async()=>{
  const f=await fixture();const ids=[randomUUID(),randomUUID()];await f.db.insert(aiVideoJobs).values(ids.map(id=>({id,userId:f.actor.id,trainingId:f.course.id,model:'veo-fixture',input:{prompt:'Fixture',aspectRatio:'16:9' as const,durationSeconds:8 as const},status:'running',operationName:`operations/${id}`})));
  vi.mocked(storagePut).mockResolvedValueOnce({key:null as any,url:'/fixture'});
  expect(await processPendingAiVideos(5,f.course.id)).toEqual({processed:1,failed:1});expect(await f.db.select().from(courseMedia).where(eq(courseMedia.trainingId,f.course.id))).toHaveLength(1);
  const rows=await f.db.select().from(aiVideoJobs).where(eq(aiVideoJobs.trainingId,f.course.id));expect(rows.filter(r=>r.status==='running'&&r.mediaId==null&&r.checkedAt!=null)).toHaveLength(1);expect(rows.filter(r=>r.status==='ready'&&r.mediaId!=null)).toHaveLength(1);
 });

});
