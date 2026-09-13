import {beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {getDb,runTNA,deleteRoleRequirement} from './db';
import {companies,employees,trainings,roleRequirements,recurrencies,users,affiliations} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('company TNA concurrency · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 async function fixture(){
  const db=(await getDb())!;
  const [company]=await db.insert(companies).values({name:'TNA transaction'}).returning();
  const [actor]=await db.insert(users).values({openId:randomUUID(),companyId:company.id,role:'admin'}).returning();
  const [course]=await db.insert(trainings).values({title:'TNA target',slug:randomUUID(),isPublished:true}).returning();
  await db.insert(roleRequirements).values({companyId:company.id,trainingId:course.id,periodMonths:24});
  const staff=await db.insert(employees).values(['First','Second'].map(firstName=>({companyId:company.id,firstName,lastName:'Fixture',email:`${firstName}@example.com`}))).returning();
  const read=()=>db.select().from(recurrencies).where(eq(recurrencies.companyId,company.id)).orderBy(recurrencies.id);
  return {db,company,course,staff,read,actor};
 }
 it('serializes concurrent analyses and preserves existing deadlines on replay',async()=>{
  const f=await fixture();
  const results=await Promise.all([runTNA(f.company.id,f.actor.id),runTNA(f.company.id,f.actor.id),runTNA(f.company.id,f.actor.id)]);
  const rows=await f.read();
  expect(rows.filter(row=>row.trainingId===f.course.id)).toHaveLength(2);
  expect(results.filter(result=>result.created>0)).toHaveLength(1);
  expect(results.reduce((sum,result)=>sum+result.created,0)).toBe(rows.length);
  expect(await runTNA(f.company.id,f.actor.id)).toEqual({created:0});
  expect(await f.read()).toEqual(rows);
 });
 it('rolls back the entire analysis on insertion failure and allows a clean retry',async()=>{
  const f=await fixture(),name=`tna_fail_${f.company.id}`;
  await f.db.execute(sql.raw(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."companyId"=${f.company.id} AND NEW."employeeId"=${f.staff[1].id} THEN RAISE EXCEPTION 'synthetic TNA failure'; END IF; RETURN NEW; END $$`));
  await f.db.execute(sql.raw(`CREATE TRIGGER ${name} BEFORE INSERT ON recurrencies FOR EACH ROW EXECUTE FUNCTION ${name}()`));
  try{
   await expect(runTNA(f.company.id,f.actor.id)).rejects.toThrow();
   expect(await f.read()).toHaveLength(0);
  }finally{
   await f.db.execute(sql.raw(`DROP TRIGGER ${name} ON recurrencies`));
   await f.db.execute(sql.raw(`DROP FUNCTION ${name}()`));
  }
  await runTNA(f.company.id,f.actor.id);
  const rows=await f.read();
  expect(rows.filter(row=>row.trainingId===f.course.id)).toHaveLength(2);
  await f.db.update(companies).set({status:'SUSPENDED'}).where(eq(companies.id,f.company.id));
  await expect(runTNA(f.company.id,f.actor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  expect(await f.read()).toEqual(rows);
 });
 it('requires the current account and membership before writing, even for a formerly privileged caller',async()=>{
  const f=await fixture();
  const [other]=await f.db.insert(companies).values({name:'Changed TNA destination'}).returning();
  await f.db.update(users).set({companyId:other.id}).where(eq(users.id,f.actor.id));
  await expect(runTNA(f.company.id,f.actor.id)).rejects.toMatchObject({code:'CONFLICT'});
  await f.db.update(users).set({companyId:f.company.id,status:'suspended'}).where(eq(users.id,f.actor.id));
  await expect(runTNA(f.company.id,f.actor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await f.db.update(users).set({status:'active',role:'user'}).where(eq(users.id,f.actor.id));
  await expect(runTNA(f.company.id,f.actor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  const [aff]=await f.db.insert(affiliations).values({personId:f.actor.id,orgId:f.company.id,role:'MANAGER',status:'INACTIVE'}).returning();
  await expect(runTNA(f.company.id,f.actor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  expect(await f.read()).toHaveLength(0);
  await f.db.update(affiliations).set({status:'ACTIVE'}).where(eq(affiliations.id,aff.id));
  await runTNA(f.company.id,f.actor.id);
  expect((await f.read()).filter(row=>row.trainingId===f.course.id)).toHaveLength(2);
 });

 it('refuses conflicting new periods atomically, accepts equal periods and preserves existing tracking',async()=>{
  const f=await fixture();
  await f.db.update(employees).set({jobTitle:'Mechanic'}).where(eq(employees.id,f.staff[1].id));
  const [conflict]=await f.db.insert(roleRequirements).values({companyId:f.company.id,trainingId:f.course.id,periodMonths:12,jobTitleContains:'mechanic'}).returning();
  await expect(runTNA(f.company.id,f.actor.id)).rejects.toMatchObject({code:'PRECONDITION_FAILED',message:expect.stringContaining(`#${conflict.id}`)});
  expect(await f.read()).toHaveLength(0);
  await deleteRoleRequirement(conflict.id,f.actor.id);
  await f.db.insert(roleRequirements).values({companyId:f.company.id,trainingId:f.course.id,periodMonths:24,jobTitleContains:'mechanic'});
  await runTNA(f.company.id,f.actor.id);
  const rows=await f.read();
  expect(rows.filter(row=>row.trainingId===f.course.id)).toHaveLength(2);
  expect(rows.filter(row=>row.trainingId===f.course.id).every(row=>row.periodMonths===24)).toBe(true);
  await f.db.insert(roleRequirements).values({companyId:f.company.id,trainingId:f.course.id,periodMonths:6});
  expect(await runTNA(f.company.id,f.actor.id)).toEqual({created:0});
  expect(await f.read()).toEqual(rows);
 });

 it('refuses unavailable targets atomically and leaves previously recorded tracking unchanged',async()=>{
  for(const kind of ['draft','archived','foreign','missing']){
   const f=await fixture();
   const [foreign]=await f.db.insert(companies).values({name:'Other course owner'}).returning();
   const [target]=await f.db.insert(trainings).values({title:'Unavailable '+kind,slug:randomUUID(),isPublished:kind!=='draft',archivedAt:kind==='archived'?new Date():null,ownerOrgId:kind==='foreign'?foreign.id:null}).returning();
   const trainingId=kind==='missing'?2147483647:target.id;
   const [rule]=await f.db.insert(roleRequirements).values({companyId:f.company.id,trainingId,periodMonths:12}).returning();
   await expect(runTNA(f.company.id,f.actor.id)).rejects.toMatchObject({code:'PRECONDITION_FAILED',message:expect.stringContaining(`règle #${rule.id}`)});
   expect(await f.read()).toHaveLength(0);
   await deleteRoleRequirement(rule.id,f.actor.id);
   await runTNA(f.company.id,f.actor.id);
   const before=await f.read();
   await f.db.update(trainings).set({isPublished:false}).where(eq(trainings.id,f.course.id));
   expect(await runTNA(f.company.id,f.actor.id)).toEqual({created:0});
   expect(await f.read()).toEqual(before);
   await f.db.insert(employees).values({companyId:f.company.id,firstName:'New',lastName:'Person',email:'new@example.com'});
   await expect(runTNA(f.company.id,f.actor.id)).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
   expect(await f.read()).toEqual(before);
  }
 });

 it('rejects legacy invalid intervals before calculating dates and preserves existing tracking',async()=>{
  for(const periodMonths of [0,-1,121,2147483647]){
   const f=await fixture();
   const [course]=await f.db.insert(trainings).values({title:'Legacy period target',slug:randomUUID(),isPublished:true}).returning();
   const [rule]=await f.db.insert(roleRequirements).values({companyId:f.company.id,trainingId:course.id,periodMonths}).returning();
   await expect(runTNA(f.company.id,f.actor.id)).rejects.toMatchObject({code:'PRECONDITION_FAILED',message:expect.stringContaining(`Période invalide pour la règle #${rule.id}`)});
   expect(await f.read()).toHaveLength(0);
   // Historical tracking is evidence: an invalid current rule must not rewrite it.
   await f.db.insert(recurrencies).values(f.staff.map(employee=>({companyId:f.company.id,employeeId:employee.id,trainingId:course.id,periodMonths:12,status:'not_started' as const,nextDueAt:new Date('2028-01-31T12:00:00Z')})));
   const before=(await f.read()).filter(r=>r.trainingId===course.id);
   await runTNA(f.company.id,f.actor.id);
   expect((await f.read()).filter(r=>r.trainingId===course.id)).toEqual(before);
   await deleteRoleRequirement(rule.id,f.actor.id);
   expect(await runTNA(f.company.id,f.actor.id)).toEqual({created:0});
  }
 });

});
