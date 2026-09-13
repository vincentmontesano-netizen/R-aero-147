import {beforeAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq} from 'drizzle-orm';
import {getDb,createCourseWithSlides,createSlide,updateSlide} from './db';
import {users,slides} from '../drizzle/schema';
import {appRouter} from './routers';
import type {TrpcContext} from './_core/context';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('slide activity writes · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 async function fixture(){const db=(await getDb())!;const [actor]=await db.insert(users).values({openId:randomUUID(),role:'instructor'}).returning();const course=await createCourseWithSlides({ownerUserId:actor.id,title:'Activities',slug:randomUUID(),slides:[]});const created=(await createSlide({trainingId:course.trainingId,quizQuestion:'Choose',quizOptions:['A','B','C'],quizCorrect:[2]}))!;const read=async()=> (await db.select().from(slides).where(eq(slides.id,created.id)))[0];const api=appRouter.createCaller({user:actor,affiliations:[],req:{headers:{}},res:{}} as unknown as TrpcContext);return {db,course,id:created.id,read,api};}
 it('rejects concurrent stale edits and detects direct writes and reorder changes',async()=>{
  const f=await fixture(),initial=await f.read();
  const edits=await Promise.allSettled(['First edit','Second edit'].map(title=>f.api.maker.updateSlide({id:f.id,title,expectedRevision:initial.revision})));
  expect(edits.filter(e=>e.status==='fulfilled')).toHaveLength(1);
  expect(edits.find(e=>e.status==='rejected')).toMatchObject({reason:{code:'CONFLICT'}});
  const saved=await f.read();expect(saved.revision).toBe(initial.revision+1);
  await expect(f.api.maker.updateSlide({id:f.id,body:'Stale',expectedRevision:initial.revision})).rejects.toMatchObject({code:'CONFLICT'});
  expect((await f.read()).body).toBe(saved.body);
  await f.db.update(slides).set({sortOrder:99}).where(eq(slides.id,f.id));
  await expect(f.api.maker.updateSlide({id:f.id,title:'Overwrite',expectedRevision:saved.revision})).rejects.toMatchObject({code:'CONFLICT'});
  const current=await f.read();await f.api.maker.updateSlide({id:f.id,title:'Reconciled',expectedRevision:current.revision});
  expect((await f.read()).title).toBe('Reconciled');
  await f.api.maker.updateSlide({id:f.id,body:'Legacy patch'});expect((await f.read()).revision).toBe(current.revision+2);
  for(const expectedRevision of [-1,1.5,2147483648])await expect(f.api.maker.updateSlide({id:f.id,title:'Invalid',expectedRevision})).rejects.toMatchObject({code:'BAD_REQUEST'});
  await f.api.maker.deleteSlide({id:f.id});
  await expect(updateSlide(f.id,{title:'Archived overwrite'})).rejects.toMatchObject({code:'CONFLICT'});
 });
 it('preserves answer positions and rejects blank options or incomplete partial corrections',async()=>{
  const f=await fixture();await expect(f.api.maker.updateSlide({id:f.id,quizOptions:['A','','C'],quizCorrect:[2]})).rejects.toMatchObject({code:'BAD_REQUEST'});expect((await f.read()).quizOptions).toEqual(['A','B','C']);
  await expect(f.api.maker.updateSlide({id:f.id,quizOptions:['A','B']})).rejects.toMatchObject({code:'BAD_REQUEST'});
  await f.api.maker.updateSlide({id:f.id,quizOptions:[' A ',' B '],quizCorrect:[1]});expect(await f.read()).toMatchObject({quizOptions:['A','B'],quizCorrect:[1]});
  await expect(f.api.maker.updateSlide({id:f.id,quizQuestion:null})).rejects.toMatchObject({code:'BAD_REQUEST'});
  await f.api.maker.updateSlide({id:f.id,quizQuestion:null,quizOptions:null,quizCorrect:null,quizExplanation:null});expect(await f.read()).toMatchObject({quizQuestion:null,quizOptions:null,quizCorrect:null});
 });
 it('rejects invalid video interactions through the free-form update route and on creation',async()=>{
  const f=await fixture(),cue={atSeconds:10,question:'Choose',options:['A','B'],correct:[]};await expect(f.api.maker.updateSlide({id:f.id,videoCues:[cue]})).rejects.toMatchObject({code:'BAD_REQUEST'});expect((await f.read()).videoCues).toBeNull();
  await expect(createSlide({trainingId:f.course.trainingId,videoCues:[cue]})).rejects.toMatchObject({code:'BAD_REQUEST'});await expect(createSlide({trainingId:f.course.trainingId,quizQuestion:'Missing answers'})).rejects.toMatchObject({code:'BAD_REQUEST'});
  await f.api.maker.updateSlide({id:f.id,videoCues:[{...cue,correct:[0]}]});expect((await f.read()).videoCues).toHaveLength(1);
 });
 it('serializes partial changes so concurrent valid patches cannot combine into an invalid quiz',async()=>{
  const f=await fixture();await updateSlide(f.id,{quizCorrect:[0]});
  const results=await Promise.allSettled([updateSlide(f.id,{quizOptions:['A','B']}),updateSlide(f.id,{quizCorrect:[2]})]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
  const final=await f.read();expect(final.quizCorrect!.every(i=>i<final.quizOptions!.length)).toBe(true);
 });
});
