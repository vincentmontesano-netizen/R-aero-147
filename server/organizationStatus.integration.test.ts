import { organizationStatusHistory } from "./organizationHistory";
import { beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { getDb, adminSetOrganizationStatus, removeOrganizationManager } from './db';
import { getActiveAffiliations, assertActiveAffiliation, resolveActorAffiliationRole } from './access';
import { requireManagedCompany } from './companyTraining';
import { canReadPrivateFile } from './storageAccess';
import { appRouter } from './routers';
import { users, companies, affiliations, employees, passportDocuments, roleRequirements } from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('organization suspension preserves membership decisions · PostgreSQL',()=>{
  beforeAll(()=>{process.env.DATABASE_URL=url!;});
  async function fixture(){
    const db=(await getDb())!;
    const [company,other]=await db.insert(companies).values([{name:randomUUID()},{name:randomUUID()}]).returning();
    const [admin,manager,member,former,outsider]=await db.insert(users).values([
      {openId:randomUUID(),role:'admin' as const},
      {openId:randomUUID(),role:'company_manager' as const,companyId:company.id},
      {openId:randomUUID(),companyId:company.id,passportShared:true},
      {openId:randomUUID(),companyId:company.id},
      {openId:randomUUID(),role:'company_manager' as const,companyId:other.id},
    ]).returning();
    const endedAt=new Date('2026-01-01T00:00:00Z');
    const links=await db.insert(affiliations).values([
      {personId:manager.id,orgId:company.id,role:'MANAGER'},
      {personId:member.id,orgId:company.id,role:'MEMBER'},
      {personId:former.id,orgId:company.id,role:'MEMBER',status:'INACTIVE',endedAt},
      {personId:outsider.id,orgId:other.id,role:'MANAGER'},
    ]).returning();
    const [employee]=await db.insert(employees).values({companyId:company.id,userId:member.id,firstName:'Member',lastName:'Fixture',email:`${randomUUID()}@example.test`}).returning();
    const key=`passport/${member.id}/${randomUUID()}.pdf`;
    await db.insert(passportDocuments).values({personId:member.id,kind:'ID',title:'Fixture',fileUrl:`/storage/${key}`});
    return {db,company,other,admin,manager,member,former,outsider,links,employee,key};
  }
  const caller=(user:typeof users.$inferSelect)=>appRouter.createCaller({user,req:{headers:{}} as never,res:{} as never,affiliations:[]});
  it('blocks effective access during suspension without rewriting affiliation history',async()=>{
    const f=await fixture();
    expect(await canReadPrivateFile(f.key,f.manager)).toBe(true);
    await adminSetOrganizationStatus(f.company.id,'SUSPENDED',f.admin.id);
    expect(await f.db.select().from(affiliations).where(eq(affiliations.orgId,f.company.id))).toEqual(f.links.slice(0,3));
    expect(await getActiveAffiliations(f.manager.id)).toEqual([]);
    await expect(assertActiveAffiliation(f.member.id,f.company.id)).rejects.toMatchObject({code:'FORBIDDEN'});
    expect(await resolveActorAffiliationRole(f.manager.id,f.company.id)).toBeNull();
    await expect(requireManagedCompany(f.manager,f.company.id)).rejects.toMatchObject({code:'FORBIDDEN'});
    expect(await canReadPrivateFile(f.key,f.manager)).toBe(false);
    expect(await canReadPrivateFile(f.key,f.member)).toBe(true);
    expect(await resolveActorAffiliationRole(f.outsider.id,f.other.id)).toBe('MANAGER');
  });
  it('reactivates only access supported by individually active memberships and audits changes once',async()=>{
    const f=await fixture();
    await adminSetOrganizationStatus(f.company.id,'SUSPENDED',f.admin.id);
    await removeOrganizationManager(f.links[1].id);
    await adminSetOrganizationStatus(f.company.id,'ACTIVE',f.admin.id);
    await adminSetOrganizationStatus(f.company.id,'ACTIVE',f.admin.id);
    expect(await resolveActorAffiliationRole(f.manager.id,f.company.id)).toBe('MANAGER');
    expect(await getActiveAffiliations(f.member.id)).toEqual([]);
    expect(await getActiveAffiliations(f.former.id)).toEqual([]);
    expect((await f.db.select().from(affiliations).where(eq(affiliations.id,f.links[2].id)))[0]).toEqual(f.links[2]);
    const events=await f.db.execute(sql`select "actorId",status from organization_status_events where "companyId"=${f.company.id} order by id`);
    expect(events).toEqual([{actorId:f.admin.id,status:'SUSPENDED'},{actorId:f.admin.id,status:'ACTIVE'}]);
    await expect(f.db.execute(sql`delete from organization_status_events where "companyId"=${f.company.id}`)).rejects.toThrow();
  });
  it('denies legacy global-role fallbacks and foreign technician/signoff access',async()=>{
    const f=await fixture();
    const foreign=caller(f.outsider);
    await Promise.all([foreign.company.technicianFile({employeeId:f.employee.id}),foreign.company.signoffs({employeeId:f.employee.id}),foreign.company.signoff({requestId:randomUUID(),employeeId:f.employee.id})].map(request=>expect(request).rejects.toMatchObject({code:'FORBIDDEN'})));
    await adminSetOrganizationStatus(f.company.id,'SUSPENDED',f.admin.id);
    const blocked=caller(f.manager);
    await Promise.all([blocked.company.affiliates(),blocked.company.recurrencies(),blocked.company.consolidated(),blocked.company.roleRequirements(),blocked.company.runTNA(),blocked.company.upsert({name:'unauthorized'})].map(request=>expect(request).rejects.toMatchObject({code:'FORBIDDEN'})));
    await expect(caller(f.member).company.recurrencies()).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it('requires an active administrator and serializes duplicate status changes',async()=>{
    const f=await fixture();
    await expect(adminSetOrganizationStatus(f.company.id,'SUSPENDED',f.manager.id)).rejects.toMatchObject({code:'FORBIDDEN'});
    await Promise.all([adminSetOrganizationStatus(f.company.id,'SUSPENDED',f.admin.id),adminSetOrganizationStatus(f.company.id,'SUSPENDED',f.admin.id)]);
    expect(await f.db.execute(sql`select id from organization_status_events where "companyId"=${f.company.id}`)).toHaveLength(1);
  });
  it('exposes status history only to active administrators with a minimal actor projection',async()=>{
    const f=await fixture();
    await adminSetOrganizationStatus(f.company.id,'SUSPENDED',f.admin.id);
    await f.db.update(users).set({name:'Current admin name',email:`${randomUUID()}@example.test`,passwordHash:'private-fixture'}).where(eq(users.id,f.admin.id));
    const history=await organizationStatusHistory(f.admin.id,{companyId:f.company.id});
    expect(history.company).toMatchObject({id:f.company.id,status:'SUSPENDED'});
    expect(history.events).toHaveLength(1);
    expect(history.events[0]).toMatchObject({actorId:f.admin.id,actorName:'Current admin name',previousStatus:'ACTIVE',status:'SUSPENDED'});
    expect(history.events[0].createdAt).toMatch(/Z$/);
    expect(Object.keys(history.events[0]).sort()).toEqual(['id','actorId','actorName','previousStatus','status','createdAt'].sort());
    await expect(caller(f.manager).admin.organizations.statusHistory({companyId:f.company.id})).rejects.toMatchObject({code:'FORBIDDEN'});
    await f.db.update(users).set({status:'suspended'}).where(eq(users.id,f.admin.id));
    await expect(organizationStatusHistory(f.admin.id,{companyId:f.company.id})).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it('paginates only the selected organization without gaps or duplicate rows under new events',async()=>{
    const f=await fixture();
    await f.db.execute(sql`insert into organization_status_events ("companyId","actorId","previousStatus",status) select ${f.company.id},${f.admin.id},'ACTIVE','SUSPENDED' from generate_series(1,55)`);
    await adminSetOrganizationStatus(f.other.id,'SUSPENDED',f.admin.id);
    const first=await organizationStatusHistory(f.admin.id,{companyId:f.company.id});
    expect(first.events).toHaveLength(50);expect(first.nextCursor).not.toBeNull();
    await adminSetOrganizationStatus(f.company.id,'SUSPENDED',f.admin.id);
    const second=await organizationStatusHistory(f.admin.id,{companyId:f.company.id,before:first.nextCursor!});
    expect(second.events).toHaveLength(5);expect(second.nextCursor).toBeNull();
    expect(new Set([...first.events,...second.events].map(event=>event.id)).size).toBe(55);
    await expect(organizationStatusHistory(f.admin.id,{companyId:f.company.id,before:'9223372036854775808'})).rejects.toThrow();
  });

  it('refuses legacy deletion before changing organization dependencies',async()=>{
    const f=await fixture();
    const [rule]=await f.db.insert(roleRequirements).values({companyId:f.company.id,trainingId:1,periodMonths:12,label:'Retained fixture'}).returning();
    await adminSetOrganizationStatus(f.company.id,'SUSPENDED',f.admin.id);
    await expect(caller(f.admin).admin.organizations.delete({id:f.company.id})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
    expect(await f.db.select().from(affiliations).where(eq(affiliations.orgId,f.company.id))).toEqual(f.links.slice(0,3));
    expect(await f.db.select().from(roleRequirements).where(eq(roleRequirements.id,rule.id))).toEqual([rule]);
    expect((await organizationStatusHistory(f.admin.id,{companyId:f.company.id})).events).toHaveLength(1);
    await adminSetOrganizationStatus(f.company.id,'ACTIVE',f.admin.id);
    expect(await resolveActorAffiliationRole(f.manager.id,f.company.id)).toBe('MANAGER');
  });
  it('rejects direct SQL deletion even for an empty organization',async()=>{
    const db=(await getDb())!;
    const [company]=await db.insert(companies).values({name:randomUUID()}).returning();
    await expect(db.execute(sql`delete from companies where id=${company.id}`)).rejects.toMatchObject({cause:{message:'Organization records must be retained; suspend the organization instead'}});
    expect(await db.select().from(companies).where(eq(companies.id,company.id))).toEqual([company]);
    const triggers=await db.execute(sql`select tgname from pg_trigger where tgrelid='companies'::regclass and tgname in ('organization_no_delete','organization_no_truncate') and tgenabled='O' order by tgname`);
    expect(triggers).toEqual([{tgname:'organization_no_delete'},{tgname:'organization_no_truncate'}]);
  });

});
