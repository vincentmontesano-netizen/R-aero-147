import {beforeAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {getDb,createCourseWithSlides} from './db';
import {courseOwnership} from './makerAccess';
import {users,companies,affiliations,trainings,slides} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('atomic course draft creation · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 async function fixture(){const db=(await getDb())!;const [actor]=await db.insert(users).values({openId:randomUUID(),role:'instructor'}).returning();return {db,actor};}
 it('creates a complete independent unpublished draft with ordered slides and validated mini-quizzes',async()=>{
  const f=await fixture();const created=await createCourseWithSlides({ownerUserId:f.actor.id,title:'New draft',slug:randomUUID(),language:'ar',slides:[{title:'First',body:'Body',quizQuestion:'Choose',quizOptions:['One','Two'],quizCorrect:[1],quizExplanation:'Second option'},{title:'Second'}]});
  const [course]=await f.db.select().from(trainings).where(eq(trainings.id,created.trainingId));expect(course).toMatchObject({ownerUserId:f.actor.id,ownerOrgId:null,reviewStatus:'draft',isPublished:false,publishedVersionId:null,language:'ar'});
  const deck=await f.db.select().from(slides).where(eq(slides.trainingId,created.trainingId)).orderBy(slides.sortOrder);expect(deck).toHaveLength(2);expect(deck[0]).toMatchObject({sortOrder:1,quizCorrect:[1]});expect(deck[1]).toMatchObject({sortOrder:2,title:'Second'});
 });
 it('rolls back the course and already-inserted slides when a later SQL write fails',async()=>{
  const f=await fixture(),slug=randomUUID();
  await expect(createCourseWithSlides({ownerUserId:f.actor.id,title:'Atomic failure',slug,slides:[{title:'First valid slide'},{title:'Second',body:'Invalid PostgreSQL text: \u0000'}]})).rejects.toThrow();
  expect(await f.db.select().from(trainings).where(eq(trainings.slug,slug))).toHaveLength(0);
  expect(await f.db.execute(sql`select s.id from slides s left join trainings t on t.id=s."trainingId" where t.id is null and s.title='First valid slide'`)).toHaveLength(0);
 });
 it('rechecks organization membership after ownership resolution and rejects foreign private media',async()=>{
  const f=await fixture();const [company]=await f.db.insert(companies).values({name:randomUUID()}).returning();const [link]=await f.db.insert(affiliations).values({personId:f.actor.id,orgId:company.id,role:'MANAGER'}).returning();
  const owner=await courseOwnership(f.actor,company.id);await f.db.update(affiliations).set({status:'INACTIVE'}).where(eq(affiliations.id,link.id));
  const slug=randomUUID();await expect(createCourseWithSlides({...owner,title:'Denied',slug,slides:[]})).rejects.toMatchObject({code:'FORBIDDEN'});expect(await f.db.select().from(trainings).where(eq(trainings.slug,slug))).toHaveLength(0);
  await expect(createCourseWithSlides({ownerUserId:f.actor.id,title:'Foreign media',slug:randomUUID(),slides:[{body:'<img src="/storage/course-media/999/file.png">'}]})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
 });
 it('rejects incomplete quiz payloads and oversized drafts before creating a course',async()=>{
  const f=await fixture();const base={ownerUserId:f.actor.id,title:'Invalid quiz',slug:randomUUID()};
  for(const invalid of [{quizQuestion:'Question',quizOptions:['A','B'],quizCorrect:[2]},{quizQuestion:'Question'},{quizOptions:['A','B'],quizCorrect:[0]}])await expect(createCourseWithSlides({...base,slides:[invalid]})).rejects.toThrow();
  await expect(createCourseWithSlides({...base,slides:Array.from({length:201},()=>({title:'Excess'}))})).rejects.toThrow();
  expect(await f.db.select().from(trainings).where(eq(trainings.slug,base.slug))).toHaveLength(0);
 });
});
