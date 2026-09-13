import { beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { getDb, getAdminComplianceReport } from './db';
import { appRouter } from './routers';
import { collectComplianceReport } from '../shared/collectComplianceReport';
import { users, trainings, enrollments, accessLogs } from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('compliance export current rights and mandatory audit · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 async function fixture(){
  const db=(await getDb())!;
  const [admin]=await db.insert(users).values({openId:randomUUID(),role:'admin'}).returning();
  const [course]=await db.insert(trainings).values({title:'Report access fixture',slug:randomUUID()}).returning();
  await db.insert(enrollments).values(Array.from({length:2},()=>({userId:admin.id,trainingId:course.id})));
  const caller=appRouter.createCaller({user:admin,req:{headers:{},ip:'192.0.2.30'},res:{}} as any);
  const logs=()=>db.select().from(accessLogs).where(and(eq(accessLogs.actorId,admin.id),eq(accessLogs.action,'READ_COMPLIANCE_REPORT')));
  return {db,admin,caller,logs};
 }
 it('discards an export when its admin is downgraded or suspended between pages, including stale caller contexts',async()=>{
  for(const change of [{role:'user' as const},{status:'suspended' as const}]){
   const f=await fixture();let calls=0;
   const exportRows=collectComplianceReport(async cursor=>{
    calls++;
    const page=await f.caller.admin.complianceReport({cursor,pageSize:1});
    if(calls===1)await f.db.update(users).set(change).where(eq(users.id,f.admin.id));
    return page;
   });
   await expect(exportRows).rejects.toMatchObject({code:'FORBIDDEN'});
   expect(calls).toBe(2);
   await expect(getAdminComplianceReport(f.admin.id)).rejects.toMatchObject({code:'FORBIDDEN'});
   const logs=await f.logs();expect(logs).toHaveLength(1);
   expect(logs[0]).toMatchObject({actorId:f.admin.id,actorRole:'admin',ip:'192.0.2.30',dataAccessed:{cursor:null,pageSize:1}});
  }
 });
 it('refuses a page if the access journal cannot be committed and succeeds after recovery',async()=>{
  const f=await fixture(),name=`report_audit_fail_${f.admin.id}`;
  await f.db.execute(sql.raw(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."actorId"=${f.admin.id} AND NEW.action='READ_COMPLIANCE_REPORT' THEN RAISE EXCEPTION 'fixture report audit unavailable'; END IF; RETURN NEW; END $$`));
  await f.db.execute(sql.raw(`CREATE TRIGGER ${name} BEFORE INSERT ON access_logs FOR EACH ROW EXECUTE FUNCTION ${name}()`));
  try{
   await expect(f.caller.admin.complianceReport({pageSize:1})).rejects.toThrow();
   expect(await f.logs()).toHaveLength(0);
  }finally{
   await f.db.execute(sql.raw(`DROP TRIGGER ${name} ON access_logs`));
   await f.db.execute(sql.raw(`DROP FUNCTION ${name}()`));
  }
  expect((await f.caller.admin.complianceReport({pageSize:1})).entries).toHaveLength(1);
  expect(await f.logs()).toHaveLength(1);
 });
});
