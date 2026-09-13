import {beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {getDb,reorderObjectives,adminUpdateObjective} from './db';
import {appRouter} from './routers';
import {users,trainings,learningObjectives} from '../drizzle/schema';
import type {TrpcContext} from './_core/context';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('objective reordering · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 async function fixture(){
  const db=(await getDb())!;
  const [actor]=await db.insert(users).values({openId:randomUUID(),role:'instructor'}).returning();
  const [course]=await db.insert(trainings).values({ownerUserId:actor.id,title:'Reorder course',slug:randomUUID()}).returning();
  const rows=await db.insert(learningObjectives).values([0,1,2].map(sortOrder=>({trainingId:course.id,sortOrder,title:`Module ${sortOrder}`}))).returning();
  const api=appRouter.createCaller({user:actor,affiliations:[],req:{headers:{}},res:{}} as unknown as TrpcContext).maker.content.objectives;
  const read=()=>db.select().from(learningObjectives).where(eq(learningObjectives.trainingId,course.id)).orderBy(learningObjectives.sortOrder);
  return {db,actor,course,rows,api,read};
 }
 it('rolls back every position on SQL failure and supports a successful retry',async()=>{
  const f=await fixture(),name=`fail_objective_reorder_${f.rows[0].id}`;
  await f.db.execute(sql.raw(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id=${f.rows[0].id} THEN RAISE EXCEPTION 'synthetic reorder failure'; END IF; RETURN NEW; END $$`));
  await f.db.execute(sql.raw(`CREATE TRIGGER ${name} BEFORE UPDATE ON learning_objectives FOR EACH ROW EXECUTE FUNCTION ${name}()`));
  const ids=[f.rows[2].id,f.rows[1].id,f.rows[0].id];
  try{
   await expect(f.api.reorder({orderedIds:ids})).rejects.toMatchObject({cause:{cause:{message:'synthetic reorder failure'}}});
   expect(await f.read()).toEqual(f.rows);
  }finally{await f.db.execute(sql.raw(`DROP TRIGGER ${name} ON learning_objectives`));await f.db.execute(sql.raw(`DROP FUNCTION ${name}()`));}
  await f.api.reorder({orderedIds:ids});expect((await f.read()).map(r=>r.id)).toEqual(ids);
 });
 it('rejects invalid, archived, missing and cross-course objectives before writing',async()=>{
  const f=await fixture(),other=await fixture();
  for(const ids of [[],[f.rows[0].id,f.rows[0].id],[-1]])await expect(reorderObjectives(ids)).rejects.toMatchObject({code:'BAD_REQUEST'});
  for(const ids of [[f.rows[0].id,2147483647],[f.rows[0].id,other.rows[0].id]])await expect(reorderObjectives(ids)).rejects.toMatchObject({code:'CONFLICT'});
  await expect(other.api.reorder({orderedIds:f.rows.map(r=>r.id)})).rejects.toMatchObject({code:'FORBIDDEN'});
  expect(await f.read()).toEqual(f.rows);
  await f.api.delete({id:f.rows[0].id});const archived=await f.read();
  await expect(reorderObjectives(f.rows.map(r=>r.id))).rejects.toMatchObject({code:'CONFLICT'});expect(await f.read()).toEqual(archived);
 });
 it('rejects stale orders and incomplete lists, then accepts a fresh order',async()=>{
  const f=await fixture();
  const orders=[[f.rows[1],f.rows[0],f.rows[2]],[f.rows[2],f.rows[1],f.rows[0]]];
  const results=await Promise.allSettled(orders.map(rows=>f.api.reorder({orderedIds:rows.map(r=>r.id),expectedSortOrders:rows.map(r=>r.sortOrder)})));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{code:'CONFLICT'}});
  const current=await f.read();expect(current.map(r=>r.sortOrder)).toEqual([0,1,2]);
  await expect(f.api.reorder({orderedIds:[current[0].id],expectedSortOrders:[0]})).rejects.toMatchObject({code:'CONFLICT'});
  await expect(f.api.reorder({orderedIds:current.map(r=>r.id),expectedSortOrders:[]})).rejects.toMatchObject({code:'BAD_REQUEST'});
  const reversed=[...current].reverse();await f.api.reorder({orderedIds:reversed.map(r=>r.id),expectedSortOrders:reversed.map(r=>r.sortOrder)});
  expect((await f.read()).map(r=>r.id)).toEqual(reversed.map(r=>r.id));
  await f.db.insert(learningObjectives).values({trainingId:f.course.id,title:'New objective',sortOrder:3});
  await expect(f.api.reorder({orderedIds:reversed.map(r=>r.id),expectedSortOrders:[0,1,2]})).rejects.toMatchObject({code:'CONFLICT'});
 });

 it('normalizes legacy null positions using their exact loaded state',async()=>{
  const f=await fixture();await f.db.update(learningObjectives).set({sortOrder:null}).where(eq(learningObjectives.id,f.rows[0].id));
  await f.api.reorder({orderedIds:f.rows.map(r=>r.id),expectedSortOrders:[null,1,2]});
  expect((await f.read()).map(r=>r.sortOrder)).toEqual([0,1,2]);
 });

 it('preserves the first saved edit and refuses stale or archived objective drafts',async()=>{
  const f=await fixture(),id=f.rows[0].id;
  const results=await Promise.allSettled(['First edit','Second edit'].map(title=>f.api.update({id,title,expectedRevision:0})));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{code:'CONFLICT'}});
  const current=(await f.read()).find(r=>r.id===id)!;expect(current.revision).toBe(1);
  await expect(f.api.update({id,title:'Stale',expectedRevision:0})).rejects.toMatchObject({code:'CONFLICT'});
  expect((await f.read()).find(r=>r.id===id)).toEqual(current);
  await f.api.update({id,title:'Fresh edit',expectedRevision:1});
  await f.db.update(learningObjectives).set({sortOrder:5}).where(eq(learningObjectives.id,id));
  await expect(f.api.update({id,title:'Stale after move',expectedRevision:2})).rejects.toMatchObject({code:'CONFLICT'});
  await expect(f.api.update({id,title:'Invalid',expectedRevision:-1})).rejects.toMatchObject({code:'BAD_REQUEST'});
  await f.api.update({id,title:'Legacy compatible'});
  await f.api.delete({id});const archived=(await f.read()).find(r=>r.id===id)!;
  await expect(adminUpdateObjective(id,{title:'Archived edit'},archived.revision)).rejects.toMatchObject({code:'CONFLICT'});
  expect((await f.read()).find(r=>r.id===id)).toEqual(archived);
 });

});
