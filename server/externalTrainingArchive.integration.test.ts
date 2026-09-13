import { beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { getDb, getTechnicianFile, adminSetOrganizationStatus } from './db';
import { archiveExternalTraining } from './externalTrainingArchive';
import { appRouter } from './routers';
import { users, companies, affiliations, employees, externalTrainings } from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('external training locked archive · PostgreSQL',()=>{
  beforeAll(()=>{process.env.DATABASE_URL=url!;});
  async function fixture(){
    const db=(await getDb())!;
    const [company,other]=await db.insert(companies).values([{name:randomUUID()},{name:randomUUID()}]).returning();
    const [admin,manager,outsider]=await db.insert(users).values([
      {openId:randomUUID(),role:'admin' as const},
      {openId:randomUUID(),role:'company_manager' as const,companyId:other.id},
      {openId:randomUUID(),role:'company_manager' as const,companyId:company.id},
    ]).returning();
    await db.insert(affiliations).values([{personId:manager.id,orgId:company.id,role:'MANAGER'},{personId:outsider.id,orgId:other.id,role:'MANAGER'}]);
    const [employee]=await db.insert(employees).values({companyId:company.id,firstName:'Archive',lastName:'Fixture',email:`${randomUUID()}@example.test`}).returning();
    const [record]=await db.insert(externalTrainings).values({companyId:company.id,employeeId:employee.id,title:'Historical evidence',certNumber:'FIXTURE',docUrl:'/storage/fixture.pdf'}).returning();
    return {db,company,other,admin,manager,outsider,employee,record};
  }
  it('retains original evidence with one immutable archive decision under concurrent requests',async()=>{
    const f=await fixture();
    const results=await Promise.all([archiveExternalTraining(f.manager.id,{id:f.record.id,reason:'Superseded evidence'}),archiveExternalTraining(f.manager.id,{id:f.record.id,reason:'Concurrent reason'})]);
    expect(results.filter(x=>!x.alreadyArchived)).toHaveLength(1);
    const [archived]=await f.db.select().from(externalTrainings).where(eq(externalTrainings.id,f.record.id));
    expect(archived).toMatchObject({...f.record,archivedAt:expect.any(Date),archivedBy:f.manager.id,archiveReason:expect.any(String)});
    expect((await getTechnicianFile(f.employee.id))?.externalTrainings).toContainEqual(archived);
    await expect(f.db.update(externalTrainings).set({title:'Changed'}).where(eq(externalTrainings.id,f.record.id))).rejects.toThrow();
    await expect(f.db.update(externalTrainings).set({archivedAt:null,archivedBy:null,archiveReason:null}).where(eq(externalTrainings.id,f.record.id))).rejects.toThrow();
    await expect(f.db.execute(sql`delete from external_trainings where id=${f.record.id}`)).rejects.toThrow();
    expect(await f.db.select().from(externalTrainings).where(eq(externalTrainings.id,f.record.id))).toEqual([archived]);
  });
  it('denies foreign, suspended and inconsistent memberships regardless of global role/companyId',async()=>{
    const f=await fixture();
    await expect(archiveExternalTraining(f.outsider.id,{id:f.record.id,reason:'Forbidden foreign'})).rejects.toMatchObject({code:'FORBIDDEN'});
    await adminSetOrganizationStatus(f.company.id,'SUSPENDED',f.admin.id);
    await expect(archiveExternalTraining(f.manager.id,{id:f.record.id,reason:'Forbidden suspended'})).rejects.toMatchObject({code:'FORBIDDEN'});
    await adminSetOrganizationStatus(f.company.id,'ACTIVE',f.admin.id);
    await f.db.update(employees).set({companyId:f.other.id}).where(eq(employees.id,f.employee.id));
    await expect(archiveExternalTraining(f.manager.id,{id:f.record.id,reason:'Forbidden reassignment'})).rejects.toMatchObject({code:'FORBIDDEN'});
    expect(await f.db.select().from(externalTrainings).where(eq(externalTrainings.id,f.record.id))).toEqual([f.record]);
    await expect(archiveExternalTraining(f.admin.id,{id:f.record.id,reason:'Reviewed historical mismatch'})).resolves.toMatchObject({success:true});
  });
  it('refuses legacy deletion and edits, requires a reason and an active actor',async()=>{
    const f=await fixture();
    const caller=appRouter.createCaller({user:f.admin,req:{headers:{}} as never,res:{} as never,affiliations:[]});
    await expect(caller.company.deleteExternalTraining({id:f.record.id})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
    await expect(caller.company.archiveExternalTraining({id:f.record.id,reason:'  '})).rejects.toMatchObject({code:'BAD_REQUEST'});
    await expect(f.db.update(externalTrainings).set({certNumber:'overwrite'}).where(eq(externalTrainings.id,f.record.id))).rejects.toThrow();
    await f.db.update(users).set({status:'suspended'}).where(eq(users.id,f.admin.id));
    await expect(archiveExternalTraining(f.admin.id,{id:f.record.id,reason:'Suspended actor'})).rejects.toMatchObject({code:'FORBIDDEN'});
    expect(await f.db.select().from(externalTrainings).where(eq(externalTrainings.id,f.record.id))).toEqual([f.record]);
  });
});
