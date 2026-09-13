import {beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {getDb,reorderModules} from './db';
import {appRouter} from './routers';
import {users,trainings,trainingModules} from '../drizzle/schema';
import type {TrpcContext} from './_core/context';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('module reordering · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 async function fixture(){
  const db=(await getDb())!;
  const [actor]=await db.insert(users).values({openId:randomUUID(),role:'instructor'}).returning();
  const [course]=await db.insert(trainings).values({ownerUserId:actor.id,title:'Reorder course',slug:randomUUID()}).returning();
  const rows=await db.insert(trainingModules).values([1,2,3].map(sortOrder=>({trainingId:course.id,sortOrder,title:`Module ${sortOrder}`}))).returning();
  const api=appRouter.createCaller({user:actor,affiliations:[],req:{headers:{}},res:{}} as unknown as TrpcContext).maker.content.modules;
  const read=()=>db.select().from(trainingModules).where(eq(trainingModules.trainingId,course.id)).orderBy(trainingModules.sortOrder);
  return {db,actor,course,rows,api,read};
 }
 it('accepts only one concurrent order based on the same loaded revisions',async()=>{
  const f=await fixture();
  const results=await Promise.allSettled([[f.rows[1],f.rows[0],f.rows[2]],[f.rows[2],f.rows[1],f.rows[0]]].map(rows=>f.api.reorder({orderedIds:rows.map(r=>r.id),expectedRevisions:rows.map(r=>r.revision)})));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{code:'CONFLICT'}});
  expect((await f.read()).map(r=>r.sortOrder)).toEqual([1,2,3]);
  const current=await f.read();await f.api.reorder({orderedIds:current.map(r=>r.id),expectedRevisions:current.map(r=>r.revision)});expect(await f.read()).toEqual(current);
  await expect(f.api.reorder({orderedIds:[f.rows[0].id,f.rows[0].id],expectedRevisions:[0,0]})).rejects.toMatchObject({code:'BAD_REQUEST'});
  await expect(f.api.reorder({orderedIds:[f.rows[0].id],expectedRevisions:[]})).rejects.toMatchObject({code:'BAD_REQUEST'});
 });
 it('rolls back the complete order and revisions when a later write fails',async()=>{
  const f=await fixture(),name=`fail_module_reorder_${f.rows[0].id}`;
  await f.db.execute(sql.raw(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id=${f.rows[0].id} THEN RAISE EXCEPTION 'synthetic reorder failure'; END IF; RETURN NEW; END $$`));
  await f.db.execute(sql.raw(`CREATE TRIGGER ${name} BEFORE UPDATE ON training_modules FOR EACH ROW EXECUTE FUNCTION ${name}()`));
  try{
   await expect(reorderModules([f.rows[2].id,f.rows[1].id,f.rows[0].id],[0,0,0])).rejects.toMatchObject({cause:{message:'synthetic reorder failure'}});
   expect(await f.read()).toEqual(f.rows);
  }finally{await f.db.execute(sql.raw(`DROP TRIGGER ${name} ON training_modules`));await f.db.execute(sql.raw(`DROP FUNCTION ${name}()`));}
  await reorderModules([f.rows[2].id,f.rows[1].id,f.rows[0].id],[0,0,0]);expect((await f.read()).map(r=>r.id)).toEqual([f.rows[2].id,f.rows[1].id,f.rows[0].id]);
  await f.api.delete({id:f.rows[0].id});await expect(reorderModules(f.rows.map(r=>r.id),f.rows.map(r=>r.revision))).rejects.toMatchObject({code:'CONFLICT'});
 });
 it('requires the complete current course list and rejects other authors',async()=>{
  const f=await fixture();
  await expect(f.api.reorder({orderedIds:[f.rows[0].id],expectedRevisions:[0]})).rejects.toMatchObject({code:'CONFLICT'});
  const [extra]=await f.db.insert(trainingModules).values({trainingId:f.course.id,title:'New chapter',sortOrder:4}).returning();
  await expect(f.api.reorder({orderedIds:f.rows.map(r=>r.id),expectedRevisions:[0,0,0]})).rejects.toMatchObject({code:'CONFLICT'});
  const [stranger]=await f.db.insert(users).values({openId:randomUUID(),role:'instructor'}).returning();
  const other=appRouter.createCaller({user:stranger,affiliations:[],req:{headers:{}},res:{}} as unknown as TrpcContext);
  await expect(other.maker.content.modules.reorder({orderedIds:[...f.rows.map(r=>r.id),extra.id],expectedRevisions:[0,0,0,0]})).rejects.toMatchObject({code:'FORBIDDEN'});
  expect((await f.read()).map(r=>r.sortOrder)).toEqual([1,2,3,4]);
 });

});
