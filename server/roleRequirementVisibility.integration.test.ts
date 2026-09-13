import {beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {getDb,getRoleRequirements,deleteRoleRequirement} from './db';
import {users,companies,trainings,roleRequirements} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('rule training visibility · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 it('retains scoped rules without exposing a foreign or withdrawn public course, and projects only course identification/status',async()=>{
  const db=(await getDb())!;
  const [own,other]=await db.insert(companies).values([{name:'Own rules'},{name:'Other rules'}]).returning();
  const [admin]=await db.insert(users).values({openId:randomUUID(),role:'admin',companyId:own.id}).returning();
  const courses=await db.insert(trainings).values([
   {title:'Public',slug:randomUUID(),isPublished:true,description:'Unneeded public body'},
   {title:'Own private',slug:randomUUID(),ownerOrgId:own.id,isPublished:true,description:'Private body'},
   {title:'Foreign secret',slug:randomUUID(),ownerOrgId:other.id,isPublished:true,description:'Foreign secret body'},
   {title:'Withdrawn public',slug:randomUUID(),isPublished:false},
   {title:'Archived own',slug:randomUUID(),ownerOrgId:own.id,isPublished:true,archivedAt:new Date()},
  ]).returning();
  const rules=await db.insert(roleRequirements).values(courses.map(course=>({companyId:own.id,trainingId:course.id,periodMonths:12}))).returning();
  const [foreignRule]=await db.insert(roleRequirements).values({companyId:other.id,trainingId:courses[0].id,periodMonths:12}).returning();
  const [global]=await db.insert(roleRequirements).values({companyId:null,trainingId:courses[2].id,periodMonths:12,jobTitleContains:randomUUID()}).returning();
  try{
   const rows=await getRoleRequirements(own.id);
   expect(rows.some(r=>r.id===foreignRule.id)).toBe(false);
   expect(rows.find(r=>r.id===global.id)?.training).toBeNull();
   for(const i of [0,1,4]){
    const course=rows.find(r=>r.id===rules[i].id)?.training;
    expect(course).toMatchObject({id:courses[i].id,title:courses[i].title});
    expect(Object.keys(course!).sort()).toEqual(['archivedAt','id','isPublished','title']);
   }
   for(const i of [2,3])expect(rows.find(r=>r.id===rules[i].id)?.training).toBeNull();
   expect(JSON.stringify(rows)).not.toContain('Foreign secret');
   const globalOnly=await getRoleRequirements(null);
   expect(globalOnly.every(r=>r.companyId===null)).toBe(true);
   expect(globalOnly.find(r=>r.id===global.id)?.training).toBeNull();
   await deleteRoleRequirement(rules[0].id,admin.id);
   expect((await getRoleRequirements(own.id)).some(r=>r.id===rules[0].id)).toBe(false);
  }finally{await deleteRoleRequirement(global.id,admin.id);}
 });
});
