import {beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {getDb,reorderSlides} from './db';
import {appRouter} from './routers';
import {users,trainings,slides} from '../drizzle/schema';
import type {TrpcContext} from './_core/context';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('slide reordering · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 async function fixture(){
  const db=(await getDb())!;
  const [actor]=await db.insert(users).values({openId:randomUUID(),role:'instructor'}).returning();
  const [course]=await db.insert(trainings).values({ownerUserId:actor.id,title:'Reorder course',slug:randomUUID()}).returning();
  const rows=await db.insert(slides).values([1,2,3].map(sortOrder=>({trainingId:course.id,sortOrder,title:`Slide ${sortOrder}`}))).returning();
  const api=appRouter.createCaller({user:actor,affiliations:[],req:{headers:{}},res:{}} as unknown as TrpcContext).maker;
  const read=()=>db.select().from(slides).where(eq(slides.trainingId,course.id)).orderBy(slides.sortOrder);
  return {db,actor,course,rows,api,read};
 }
 it('accepts only one concurrent order based on the same loaded revisions',async()=>{
  const f=await fixture();
  const results=await Promise.allSettled([[f.rows[1],f.rows[0],f.rows[2]],[f.rows[2],f.rows[1],f.rows[0]]].map(rows=>f.api.reorderSlides({orderedIds:rows.map(r=>r.id),expectedRevisions:rows.map(r=>r.revision)})));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{code:'CONFLICT'}});
  expect((await f.read()).map(r=>r.sortOrder)).toEqual([1,2,3]);
  const current=await f.read();await f.api.reorderSlides({orderedIds:current.map(r=>r.id),expectedRevisions:current.map(r=>r.revision)});expect(await f.read()).toEqual(current);
  await expect(f.api.reorderSlides({orderedIds:[f.rows[0].id,f.rows[0].id]})).rejects.toMatchObject({code:'BAD_REQUEST'});
  await expect(f.api.reorderSlides({orderedIds:[f.rows[0].id],expectedRevisions:[]})).rejects.toMatchObject({code:'BAD_REQUEST'});
 });
 it('rolls back the complete order and revisions when a later write fails',async()=>{
  const f=await fixture(),name=`fail_reorder_${f.rows[0].id}`;
  await f.db.execute(sql.raw(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id=${f.rows[0].id} THEN RAISE EXCEPTION 'synthetic reorder failure'; END IF; RETURN NEW; END $$`));
  await f.db.execute(sql.raw(`CREATE TRIGGER ${name} BEFORE UPDATE ON slides FOR EACH ROW EXECUTE FUNCTION ${name}()`));
  try{
   await expect(reorderSlides([f.rows[2].id,f.rows[1].id,f.rows[0].id])).rejects.toMatchObject({cause:{message:'synthetic reorder failure'}});
   expect(await f.read()).toEqual(f.rows);
  }finally{await f.db.execute(sql.raw(`DROP TRIGGER ${name} ON slides`));await f.db.execute(sql.raw(`DROP FUNCTION ${name}()`));}
  await reorderSlides([f.rows[2].id,f.rows[1].id,f.rows[0].id]);expect((await f.read()).map(r=>r.id)).toEqual([f.rows[2].id,f.rows[1].id,f.rows[0].id]);
  await f.api.deleteSlide({id:f.rows[0].id});await expect(reorderSlides(f.rows.map(r=>r.id))).rejects.toMatchObject({code:'CONFLICT'});
 });
});
