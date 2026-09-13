import {beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq} from 'drizzle-orm';
import {getDb} from './db';
import {roleRequirementCourses} from './roleRequirementCourses';
import {users,companies,affiliations,trainings} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('TNA course choices · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 it('offers own published internal courses and public courses with minimal fields, never foreign or unavailable courses',async()=>{
  const db=(await getDb())!;
  const [company,other]=await db.insert(companies).values([{name:'Course choices'},{name:'Foreign choices'}]).returning();
  const [actor]=await db.insert(users).values({openId:randomUUID(),companyId:company.id}).returning();
  const [aff]=await db.insert(affiliations).values({personId:actor.id,orgId:company.id,role:'MANAGER'}).returning();
  const [own,pub,foreign,draft,archived]=await db.insert(trainings).values([
   {ownerOrgId:company.id,isPublished:true},{ownerOrgId:null,isPublished:true},
   {ownerOrgId:other.id,isPublished:true},{ownerOrgId:company.id,isPublished:false},
   {ownerOrgId:company.id,isPublished:true,archivedAt:new Date()},
  ].map((values,i)=>({title:`Choice ${i}`,slug:randomUUID(),description:'Private extended description',...values}))).returning();
  const options=await roleRequirementCourses(actor.id);
  expect(options.find(row=>row.id===own.id)).toEqual({id:own.id,title:own.title,ownerOrgId:company.id});
  expect(options.find(row=>row.id===pub.id)).toEqual({id:pub.id,title:pub.title,ownerOrgId:null});
  for(const course of [foreign,draft,archived])expect(options.some(row=>row.id===course.id)).toBe(false);
  await db.update(affiliations).set({status:'INACTIVE'}).where(eq(affiliations.id,aff.id));
  await expect(roleRequirementCourses(actor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await db.update(users).set({role:'admin'}).where(eq(users.id,actor.id));
  expect((await roleRequirementCourses(actor.id)).some(row=>row.id===foreign.id)).toBe(false);
  await db.update(users).set({status:'suspended'}).where(eq(users.id,actor.id));
  await expect(roleRequirementCourses(actor.id)).rejects.toMatchObject({code:'FORBIDDEN'});
 });
});
