import {orgScopedViewForSubject} from "./access";
import {roleRequirementHistory} from './roleRequirementHistory';
import {appRouter} from "./routers";
import type {TrpcContext} from "./_core/context";
import {beforeAll, describe, expect, it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import postgres from 'postgres';
import {getDb, createRoleRequirement, deleteRoleRequirement, getRoleRequirements, runTNA} from './db';
import {users, companies, affiliations, roleRequirements, trainings, employees, recurrencies} from '../drizzle/schema';
const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('role requirement archive · PostgreSQL', () => {
 beforeAll(() => {process.env.DATABASE_URL = url!;});
 it('retains the rule and existing deadlines, excludes it from later analyses and locks archived evidence', async () => {
  const db = (await getDb())!;
  const [company] = await db.insert(companies).values({name:'Rule archive'}).returning();
  const [actor, outsider] = await db.insert(users).values([{openId:randomUUID(),companyId:company.id},{openId:randomUUID()}]).returning();
  await db.insert(affiliations).values({personId:actor.id,orgId:company.id,role:'MANAGER'});
  const [course] = await db.insert(trainings).values({title:'Rule fixture',slug:randomUUID(),isPublished:true}).returning();
  const [rule] = await db.insert(roleRequirements).values({companyId:company.id,trainingId:course.id,periodMonths:12}).returning();
  const [employee] = await db.insert(employees).values({companyId:company.id,firstName:'A',lastName:'B',email:'a@example.com'}).returning();
  await runTNA(company.id,actor.id);
  const deadlines = await db.select().from(recurrencies).where(eq(recurrencies.employeeId,employee.id));
  expect(deadlines.some(row => row.trainingId === course.id)).toBe(true);
  await expect(deleteRoleRequirement(rule.id,outsider.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await Promise.all([deleteRoleRequirement(rule.id,actor.id),deleteRoleRequirement(rule.id,actor.id)]);
  const [archived] = await db.select().from(roleRequirements).where(eq(roleRequirements.id,rule.id));
  expect(archived).toEqual({...rule,archivedAt:expect.any(Date),archivedBy:actor.id});
  expect((await getRoleRequirements(company.id)).some(row => row.id === rule.id)).toBe(false);
  const [later] = await db.insert(employees).values({companyId:company.id,userId:outsider.id,firstName:'C',lastName:'D',email:'c@example.com'}).returning();
  await db.insert(affiliations).values({personId:outsider.id,orgId:company.id,employeeId:later.id,role:'MEMBER'});
  expect((await orgScopedViewForSubject(company.id,outsider.id)).requiredModules.some(row=>row.trainingId===course.id)).toBe(false);
  await runTNA(company.id,actor.id);
  expect((await db.select().from(recurrencies).where(eq(recurrencies.employeeId,later.id))).some(row => row.trainingId === course.id)).toBe(false);
  expect(await db.select().from(recurrencies).where(eq(recurrencies.employeeId,employee.id))).toEqual(deadlines);
  await expect(db.delete(roleRequirements).where(eq(roleRequirements.id,rule.id))).rejects.toThrow();
  await expect(db.update(roleRequirements).set({archivedAt:null,archivedBy:null}).where(eq(roleRequirements.id,rule.id))).rejects.toThrow();
  await expect(db.update(roleRequirements).set({label:'Changed'}).where(eq(roleRequirements.id,rule.id))).rejects.toThrow();
  await db.update(users).set({status:'suspended'}).where(eq(users.id,actor.id));
  await expect(deleteRoleRequirement(rule.id,actor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('refuses invalid or unavailable training targets and foreign/global use of an internal course', async () => {
  const db = (await getDb())!;
  const [company,other] = await db.insert(companies).values([{name:'Rule target'},{name:'Other rule target'}]).returning();
  const [course] = await db.insert(trainings).values({title:'Internal target',slug:randomUUID(),ownerOrgId:company.id}).returning();
  const [actor] = await db.insert(users).values({openId:randomUUID(),role:'admin',companyId:company.id}).returning();
  const data = {companyId:company.id,trainingId:course.id,periodMonths:24};
  await expect(createRoleRequirement({...data,periodMonths:0},actor.id)).rejects.toMatchObject({code:'BAD_REQUEST'});
  await expect(createRoleRequirement({...data,trainingId:2147483647},actor.id)).rejects.toMatchObject({code:'BAD_REQUEST'});
  await expect(createRoleRequirement(data,actor.id)).rejects.toMatchObject({code:'BAD_REQUEST'});
  await db.update(trainings).set({isPublished:true}).where(eq(trainings.id,course.id));
  await expect(createRoleRequirement({...data,companyId:other.id},actor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(createRoleRequirement({...data,companyId:null},actor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  expect(await db.select().from(roleRequirements).where(eq(roleRequirements.trainingId,course.id))).toHaveLength(0);
  await createRoleRequirement(data,actor.id);
  await db.update(trainings).set({archivedAt:new Date()}).where(eq(trainings.id,course.id));
  await expect(createRoleRequirement(data,actor.id)).rejects.toMatchObject({code:'BAD_REQUEST'});
  expect(await db.select().from(roleRequirements).where(eq(roleRequirements.trainingId,course.id))).toHaveLength(1);
 });

 it('rechecks the creator, selected company and manager affiliation inside creation', async () => {
  const db=(await getDb())!;
  const [company,other]=await db.insert(companies).values([{name:'Current manager scope'},{name:'Changed manager scope'}]).returning();
  const [actor]=await db.insert(users).values({openId:randomUUID(),role:'user',companyId:company.id}).returning();
  const [membership]=await db.insert(affiliations).values({personId:actor.id,orgId:company.id,role:'MANAGER',status:'ACTIVE'}).returning();
  const [course]=await db.insert(trainings).values({title:'Fresh creation permissions',slug:randomUUID(),isPublished:true}).returning();
  const input={companyId:company.id,trainingId:course.id,periodMonths:12};
  await createRoleRequirement(input,actor.id);
  await db.update(affiliations).set({status:'INACTIVE'}).where(eq(affiliations.id,membership.id));
  await expect(createRoleRequirement(input,actor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await db.update(affiliations).set({status:'ACTIVE'}).where(eq(affiliations.id,membership.id));
  await db.update(users).set({companyId:other.id}).where(eq(users.id,actor.id));
  await expect(createRoleRequirement(input,actor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await db.update(users).set({companyId:company.id,role:'admin',status:'suspended'}).where(eq(users.id,actor.id));
  await expect(createRoleRequirement(input,actor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await db.update(users).set({status:'active'}).where(eq(users.id,actor.id));
  await db.update(companies).set({status:'SUSPENDED'}).where(eq(companies.id,company.id));
  await expect(createRoleRequirement(input,actor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await db.update(users).set({companyId:null,role:'user'}).where(eq(users.id,actor.id));
  await expect(createRoleRequirement({...input,companyId:null},actor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  expect(await db.select().from(roleRequirements).where(eq(roleRequirements.trainingId,course.id))).toHaveLength(1);
 });

 it('holds account, company, affiliation and course locks until creation commits, then honors revocation', async () => {
  const db=(await getDb())!;
  const [company]=await db.insert(companies).values({name:'Concurrent rule creation'}).returning();
  const [actor]=await db.insert(users).values({openId:randomUUID(),companyId:company.id}).returning();
  const [membership]=await db.insert(affiliations).values({personId:actor.id,orgId:company.id,role:'MANAGER',status:'ACTIVE'}).returning();
  const [course]=await db.insert(trainings).values({title:'Concurrent rule target',slug:randomUUID(),isPublished:true}).returning();
  const input={companyId:company.id,trainingId:course.id,periodMonths:12};
  const name=`rule_wait_${company.id}`;
  const control=postgres(url!,{max:1});
  let pending:Promise<unknown>|undefined;
  await db.execute(sql.raw(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."companyId"=${company.id} THEN PERFORM pg_advisory_xact_lock(${company.id},284); END IF; RETURN NEW; END $$`));
  await db.execute(sql.raw(`CREATE TRIGGER ${name} BEFORE INSERT ON role_requirements FOR EACH ROW EXECUTE FUNCTION ${name}()`));
  try {
   await control`SELECT pg_advisory_lock(${company.id},284)`;
   pending=createRoleRequirement(input,actor.id).then(value=>({value}),error=>({error}));
   let waiting=false;
   for(let attempt=0;attempt<100;attempt++){
    const rows=await control`SELECT pid FROM pg_locks WHERE locktype='advisory' AND classid=${company.id}::oid AND objid=284::oid AND objsubid=2 AND NOT granted`;
    if(rows.length){waiting=true;break;}
    await new Promise(resolve=>setTimeout(resolve,20));
   }
   expect(waiting,'creation must reach insertion while retaining its authorization locks').toBe(true);
   await control`SET lock_timeout='100ms'`;
   await expect(control`UPDATE users SET status='suspended' WHERE id=${actor.id}`).rejects.toMatchObject({code:'55P03'});
   await expect(control`UPDATE companies SET status='SUSPENDED' WHERE id=${company.id}`).rejects.toMatchObject({code:'55P03'});
   await expect(control`UPDATE affiliations SET status='INACTIVE' WHERE id=${membership.id}`).rejects.toMatchObject({code:'55P03'});
   await expect(control`UPDATE trainings SET "isPublished"=false WHERE id=${course.id}`).rejects.toMatchObject({code:'55P03'});
   await control`SELECT pg_advisory_unlock(${company.id},284)`;
   expect(await pending).toEqual({value:{success:true}});
   await control`UPDATE affiliations SET status='INACTIVE' WHERE id=${membership.id}`;
   await expect(createRoleRequirement(input,actor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
   const rules=await db.select().from(roleRequirements).where(eq(roleRequirements.companyId,company.id));
   expect(rules).toHaveLength(1);
   expect(rules[0].createdBy).toBe(actor.id);
  } finally {
   await control`SELECT pg_advisory_unlock_all()`;
   await pending;
   await db.execute(sql.raw(`DROP TRIGGER ${name} ON role_requirements`));
   await db.execute(sql.raw(`DROP FUNCTION ${name}()`));
   await control.end();
  }
 },10000);

 it('records the creator separately from archival attribution and prevents rewriting it', async () => {
  const db=(await getDb())!;
  const [company]=await db.insert(companies).values({name:'Creator attribution'}).returning();
  const [creator,archiver]=await db.insert(users).values([{openId:randomUUID(),role:'admin',companyId:company.id},{openId:randomUUID(),role:'admin',companyId:company.id}]).returning();
  const [course]=await db.insert(trainings).values({title:'Attribution course',slug:randomUUID(),isPublished:true}).returning();
  await createRoleRequirement({companyId:company.id,trainingId:course.id,periodMonths:12},creator.id);
  const [rule]=await db.select().from(roleRequirements).where(eq(roleRequirements.trainingId,course.id));
  expect(rule.createdBy).toBe(creator.id);
  expect((await getRoleRequirements(company.id)).find(r=>r.id===rule.id)?.createdBy).toBe(creator.id);
  await expect(db.update(roleRequirements).set({createdBy:archiver.id,archivedBy:archiver.id,archivedAt:new Date()}).where(eq(roleRequirements.id,rule.id))).rejects.toThrow();
  await deleteRoleRequirement(rule.id,archiver.id);
  const archived=(await roleRequirementHistory(archiver.id)).entries.find(r=>r.id===rule.id)!;
  expect(archived).toMatchObject({createdBy:creator.id,archivedBy:archiver.id,createdAt:rule.createdAt});
  await expect(db.update(roleRequirements).set({createdBy:null}).where(eq(roleRequirements.id,rule.id))).rejects.toThrow();
  const [unattributed]=await db.insert(roleRequirements).values({companyId:company.id,trainingId:course.id,periodMonths:24}).returning();
  expect(unattributed.createdBy).toBeNull();
  await deleteRoleRequirement(unattributed.id,archiver.id);
  expect((await roleRequirementHistory(archiver.id)).entries.find(r=>r.id===unattributed.id)).toMatchObject({createdBy:null,archivedBy:archiver.id});
 });

 it('scopes admin creations to the selected company and preserves explicit absence of a company for legacy global administration', async () => {
  const db=(await getDb())!;
  const [company,other]=await db.insert(companies).values([{name:'Admin selected company'},{name:'Unrelated company'}]).returning();
  const [admin]=await db.insert(users).values({openId:randomUUID(),role:'admin',companyId:company.id}).returning();
  const [course]=await db.insert(trainings).values({title:'Scope target',slug:randomUUID(),isPublished:true}).returning();
  const caller=(user:typeof admin)=>appRouter.createCaller({user,affiliations:[],req:{headers:{}},res:{}} as unknown as TrpcContext).company;
  const input={trainingId:course.id,periodMonths:24,jobTitleContains:randomUUID()};
  await caller(admin).createRoleRequirement(input);
  const [rule]=await db.select().from(roleRequirements).where(eq(roleRequirements.trainingId,course.id));
  expect(rule.companyId).toBe(company.id);
  expect((await getRoleRequirements(other.id)).some(row=>row.id===rule.id)).toBe(false);
  await db.update(companies).set({status:'SUSPENDED'}).where(eq(companies.id,company.id));
  await expect(caller(admin).createRoleRequirement(input)).rejects.toMatchObject({code:'FORBIDDEN'});
  const [globalAdmin]=await db.update(users).set({companyId:null}).where(eq(users.id,admin.id)).returning();
  await caller(globalAdmin).createRoleRequirement(input);
  const rows=await db.select().from(roleRequirements).where(eq(roleRequirements.trainingId,course.id));
  expect(rows).toHaveLength(2);
  expect(rows.filter(row=>row.companyId===null)).toHaveLength(1);
  await deleteRoleRequirement(rows.find(row=>row.companyId===null)!.id,globalAdmin.id);
 });

});
