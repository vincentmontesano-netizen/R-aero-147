import {beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq} from 'drizzle-orm';
import {getDb} from './db';
import {roleRequirementHistory} from './roleRequirementHistory';
import {users,companies,affiliations,roleRequirements} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('archived requirement pages · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 it('pages retained rules without overlap, excludes other companies and rereads membership rights',async()=>{
  const db=(await getDb())!;
  const [company,other]=await db.insert(companies).values([{name:'Archive pages'},{name:'Other pages'}]).returning();
  const [actor]=await db.insert(users).values({openId:randomUUID(),companyId:company.id}).returning();
  const [aff]=await db.insert(affiliations).values({personId:actor.id,orgId:company.id,role:'MANAGER'}).returning();
  const rows=await db.insert(roleRequirements).values(Array.from({length:55},(_,i)=>({companyId:company.id,trainingId:1,periodMonths:12,label:`Retained ${i}`,archivedAt:new Date(),archivedBy:actor.id}))).returning();
  const [foreign,active]=await db.insert(roleRequirements).values([{companyId:other.id,trainingId:1,periodMonths:12,archivedAt:new Date(),archivedBy:actor.id},{companyId:company.id,trainingId:1,periodMonths:12}]).returning();
  const first=await roleRequirementHistory(actor.id);
  expect(first.entries.map(row=>row.id)).toEqual(rows.slice(5).reverse().map(row=>row.id));
  expect(first.entries.some(row=>row.id===foreign.id||row.id===active.id)).toBe(false);
  await db.insert(roleRequirements).values({companyId:company.id,trainingId:1,periodMonths:24,archivedAt:new Date(),archivedBy:actor.id});
  const second=await roleRequirementHistory(actor.id,first.nextBeforeId!);
  expect(second.entries.filter(row=>row.companyId===company.id).map(row=>row.id)).toEqual(rows.slice(0,5).reverse().map(row=>row.id));
  expect(second.entries.some(row=>first.entries.some(old=>old.id===row.id))).toBe(false);
  await db.update(affiliations).set({status:'INACTIVE'}).where(eq(affiliations.id,aff.id));
  await expect(roleRequirementHistory(actor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await db.update(users).set({role:'admin',status:'suspended'}).where(eq(users.id,actor.id));
  await expect(roleRequirementHistory(actor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
 });
});
