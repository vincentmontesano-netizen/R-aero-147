import {collectComplianceReport} from '../shared/collectComplianceReport';
import {beforeAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {getDb} from './db';
import {appRouter} from './routers';
import {users,trainings,enrollments,certificates} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('administrative certificate state report · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 it('separates learning access from certificate validity and flags foreign or duplicate links',async()=>{
  const db=(await getDb())!;
  const [holder,admin,other]=await db.insert(users).values([{openId:randomUUID()},{openId:randomUUID(),role:'admin'},{openId:randomUUID()}]).returning();
  const [course]=await db.insert(trainings).values({title:'Report course',slug:randomUUID()}).returning();
  const entries=await db.insert(enrollments).values(Array.from({length:6},()=>({userId:holder.id,trainingId:course.id,status:'completed' as const,expiresAt:new Date(0)}))).returning();
  const certificate=(index:number,extra={})=>({userId:holder.id,trainingId:course.id,enrollmentId:entries[index].id,certificateNumber:randomUUID(),verificationCode:randomUUID().replaceAll('-',''),isValid:true,expiresAt:new Date(Date.now()+86400000),...extra});
  const [valid,expired,revoked]=await db.insert(certificates).values([
   certificate(0),certificate(1,{expiresAt:new Date(0)}),certificate(2,{isValid:false}),
   certificate(4,{userId:other.id,certificateNumber:'FOREIGN-'+randomUUID()}),certificate(5),certificate(5),
  ]).returning();
  const caller=(user:typeof holder)=>appRouter.createCaller({user,req:{headers:{}},res:{}} as any);
  await expect(caller(holder).admin.complianceReport()).rejects.toMatchObject({code:'FORBIDDEN'});
  const all=await collectComplianceReport(cursor=>caller(admin).admin.complianceReport({cursor}));const rows=entries.map(e=>all.find(r=>r.enrollmentId===e.id)!);
  expect(rows.map(r=>r.certificateStatus)).toEqual(['valid','expired','revoked','missing','review','review']);
  expect(rows[0]).toMatchObject({status:'completed',expiresAt:new Date(0),certificateNumber:valid.certificateNumber,certificateExpiresAt:valid.expiresAt});
  expect(rows[1].certificateNumber).toBe(expired.certificateNumber);expect(rows[2].certificateNumber).toBe(revoked.certificateNumber);
  for(const row of rows.slice(3))expect(row).toMatchObject({certificateNumber:null,certificateHolderName:null,certificateExpiresAt:null});
  for(const e of entries)expect(all.filter(r=>r.enrollmentId===e.id)).toHaveLength(1);
 });
 it('pages by enrollment without duplicates and excludes new higher IDs from an ongoing traversal',async()=>{
  const db=(await getDb())!;
  const [admin]=await db.insert(users).values({openId:randomUUID(),role:'admin'}).returning();
  const [course]=await db.insert(trainings).values({title:'Paged report',slug:randomUUID()}).returning();
  const fixtures=await db.insert(enrollments).values(Array.from({length:255},()=>({userId:admin.id,trainingId:course.id}))).returning();
  const caller=appRouter.createCaller({user:admin,req:{headers:{}},res:{}} as any);
  expect((await caller.admin.complianceReport({})).entries).toHaveLength(50);
  for(const pageSize of [0,251,1.5])await expect(caller.admin.complianceReport({pageSize})).rejects.toMatchObject({code:'BAD_REQUEST'});
  const first=await caller.admin.complianceReport({pageSize:250});expect(first.entries).toHaveLength(250);expect(first.nextCursor).toBe(first.entries[249].enrollmentId);
  const [later]=await db.insert(enrollments).values({userId:admin.id,trainingId:course.id}).returning();
  const tail=await collectComplianceReport(cursor=>caller.admin.complianceReport({cursor:cursor??first.nextCursor!,pageSize:250}));
  const all=[...first.entries,...tail];
  expect(new Set(all.map(e=>e.enrollmentId)).size).toBe(all.length);
  expect(all.some(e=>e.enrollmentId===later.id)).toBe(false);
  for(const e of fixtures)expect(all.filter(r=>r.enrollmentId===e.id)).toHaveLength(1);
 });

});
