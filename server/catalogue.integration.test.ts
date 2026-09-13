import {beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {getDb,getPublicTrainings,getTrainingBySlug,getFeaturedTrainings} from './db';
import {trainings,companies,trainingCategories} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('public catalogue · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 it('filters in SQL without exposing internal, draft, archived courses or working metadata; searches literal characters',async()=>{
  const db=(await getDb())!;
  const tag=randomUUID();
  const [company]=await db.insert(companies).values({name:tag}).returning();
  const [category]=await db.insert(trainingCategories).values({name:tag,slug:tag}).returning();
  const base={title:tag+' 100%_match',description:'Maintenance ABC',isPublished:true,categoryId:category.id,language:'ar',type:'elearning' as const,domain:'b1' as const};
  const [publicCourse]=await db.insert(trainings).values({...base,slug:randomUUID(),reviewStatus:'internal-review',version:9}).returning();
  const [descriptionCourse]=await db.insert(trainings).values({...base,title:tag+' secondary',description:'Unique desc '+tag,slug:randomUUID(),language:'en'}).returning();
  const [draft,internal,archived]=await db.insert(trainings).values([
   {...base,slug:randomUUID(),isPublished:false},
   {...base,slug:randomUUID(),ownerOrgId:company.id,isFeatured:true},
   {...base,slug:randomUUID(),archivedAt:new Date(),isFeatured:true},
  ]).returning();
  const rows=await getPublicTrainings({search:' '+tag+' 100%_MATCH ',language:'ar',type:'elearning',domain:'b1',categoryId:category.id});
  expect(rows.map(r=>r.id)).toEqual([publicCourse.id]);
  expect((await getPublicTrainings({search:'Unique desc '+tag})).map(r=>r.id)).toEqual([descriptionCourse.id]);
  expect((await getPublicTrainings({categoryId:category.id,search:'%_'})).map(r=>r.id)).toEqual([publicCourse.id]);
  for(const patch of [{language:'fr'},{domain:'b2'},{type:'webinar'},{type:'unknown'}])expect(await getPublicTrainings({categoryId:category.id,...patch})).toEqual([]);
  const detail=await getTrainingBySlug(publicCourse.slug);
  expect(detail).toMatchObject({id:publicCourse.id,language:'ar'});
  for(const value of [rows[0],detail])for(const key of ['ownerUserId','ownerOrgId','reviewStatus','version','publishedVersionId','archivedAt','randomizeQuestions','examQuestionCount'])expect(value).not.toHaveProperty(key);
  for(const course of [draft,internal,archived])expect(await getTrainingBySlug(course.slug)).toBeNull();
  expect((await getFeaturedTrainings()).every(r=>r.id!==internal.id&&r.id!==archived.id)).toBe(true);
  for(const input of [{search:'x'.repeat(256)},{language:'x'.repeat(9)},{categoryId:0},{categoryId:1.5},{ownerOrgId:company.id}])await expect(getPublicTrainings(input)).rejects.toMatchObject({code:'BAD_REQUEST'});
  await expect(getTrainingBySlug('')).rejects.toMatchObject({code:'BAD_REQUEST'});
 });
});
