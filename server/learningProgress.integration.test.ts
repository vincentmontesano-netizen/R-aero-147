import {beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq} from 'drizzle-orm';
import {getDb,updateEnrollmentProgress} from './db';
import {users,trainings,enrollments} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('reading progress · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 it('keeps progress monotonic under late and concurrent writes, without granting assessment completion',async()=>{
  const db=(await getDb())!;
  const [user]=await db.insert(users).values({openId:randomUUID()}).returning();
  const [course]=await db.insert(trainings).values({title:'Progress',slug:randomUUID()}).returning();
  const [entry]=await db.insert(enrollments).values({userId:user.id,trainingId:course.id,progressPercent:null}).returning();
  const read=async()=>(await db.select().from(enrollments).where(eq(enrollments.id,entry.id)))[0];
  await updateEnrollmentProgress(entry.id,80,'in_progress');
  await updateEnrollmentProgress(entry.id,20,'not_started');
  expect(await read()).toMatchObject({progressPercent:80,status:'in_progress'});
  await Promise.all([10,95,30,85,0].map(p=>updateEnrollmentProgress(entry.id,p,'not_started')));
  expect(await read()).toMatchObject({progressPercent:95,status:'in_progress'});
  await updateEnrollmentProgress(entry.id,100);
  expect(await read()).toMatchObject({progressPercent:100,status:'in_progress',completedAt:null});
  for(const percent of [-1,101,1.5,NaN])await expect(updateEnrollmentProgress(entry.id,percent)).rejects.toMatchObject({code:'BAD_REQUEST'});
  await expect(updateEnrollmentProgress(entry.id,50,'completed')).rejects.toMatchObject({code:'BAD_REQUEST'});
  for(const status of ['completed','expired','failed'] as const){
   await db.update(enrollments).set({status,progressPercent:60}).where(eq(enrollments.id,entry.id));
   const before=await read();
   await updateEnrollmentProgress(entry.id,100,'in_progress');
   expect(await read()).toEqual(before);
  }
 });
});
