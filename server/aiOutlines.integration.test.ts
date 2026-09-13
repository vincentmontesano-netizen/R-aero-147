import {beforeAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {getDb} from './db';
import {runAiRequest,aiRequestUsage} from './aiRequests';
import {saveAiOutline,pendingAiOutlines,createFromAiOutline} from './aiOutlines';
import {users,companies,affiliations,trainings,slides,aiOutlineDrafts} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
const output=()=>({title:randomUUID(),description:'Saved outline',slides:[{title:'Introduction',body:'Content'},{title:'Review',body:'Practice',quiz:{question:'Which answer?',options:['One','Two','Three','Four'],correct:[1],explanation:'The second answer.'}}]});
describe.skipIf(!url)('recoverable AI outlines · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 async function fixture(){const db=(await getDb())!;const [actor]=await db.insert(users).values({openId:randomUUID(),role:'instructor'}).returning();return {db,actor};}
 it('recovers a persisted result and serializes concurrent creation without another provider request',async()=>{
  const f=await fixture(),raw=output();await runAiRequest(f.actor.id,'outline',id=>saveAiOutline(f.actor.id,null,id,'ar',raw));
  const pending=await pendingAiOutlines(f.actor.id,{});expect(pending.entries).toHaveLength(1);expect(Object.keys(pending.entries[0]).sort()).toEqual(['createdAt','id','organizationName','ownerOrgId','title']);
  const id=pending.entries[0].id;const [a,b]=await Promise.all([createFromAiOutline(f.actor.id,id),createFromAiOutline(f.actor.id,id)]);expect(a).toEqual(b);
  const courses=await f.db.select().from(trainings).where(eq(trainings.ownerUserId,f.actor.id));expect(courses).toHaveLength(1);expect(courses[0]).toMatchObject({language:'ar',isPublished:false,reviewStatus:'draft',ownerOrgId:null});
  const deck=await f.db.select().from(slides).where(eq(slides.trainingId,a.trainingId)).orderBy(slides.sortOrder);expect(deck).toHaveLength(2);expect(deck[1].quizCorrect).toEqual([1]);
  expect((await pendingAiOutlines(f.actor.id,{})).entries).toHaveLength(0);expect((await aiRequestUsage(f.actor.id)).used.text).toBe(1);
  await expect(f.db.execute(sql`update ai_outline_drafts set output='{}'::jsonb where id=${id}`)).rejects.toThrow();await expect(f.db.execute(sql`delete from ai_outline_drafts where id=${id}`)).rejects.toThrow();
 });
 it('keeps outlines private and bound to the original active organization membership',async()=>{
  const f=await fixture(),other=await fixture();const [org]=await f.db.insert(companies).values({name:randomUUID()}).returning();const [link]=await f.db.insert(affiliations).values({personId:f.actor.id,orgId:org.id,role:'MANAGER'}).returning();
  const saved=await runAiRequest(f.actor.id,'outline',id=>saveAiOutline(f.actor.id,org.id,id,'fr',output()));
  expect((await pendingAiOutlines(other.actor.id,{})).entries).toHaveLength(0);await expect(createFromAiOutline(other.actor.id,saved.outlineId)).rejects.toMatchObject({code:'NOT_FOUND'});
  await f.db.update(affiliations).set({status:'INACTIVE'}).where(eq(affiliations.id,link.id));expect((await pendingAiOutlines(f.actor.id,{})).entries).toHaveLength(0);await expect(createFromAiOutline(f.actor.id,saved.outlineId)).rejects.toMatchObject({code:'FORBIDDEN'});
  await f.db.update(affiliations).set({status:'ACTIVE'}).where(eq(affiliations.id,link.id));const created=await createFromAiOutline(f.actor.id,saved.outlineId);const [course]=await f.db.select().from(trainings).where(eq(trainings.id,created.trainingId));expect(course.ownerOrgId).toBe(org.id);
 });
 it('keeps an unconsumed outline intact if conversion rejects its private media references',async()=>{
  const f=await fixture(),raw=output();raw.slides[1].body='<img src="/storage/course-media/999/foreign.png">';const saved=await runAiRequest(f.actor.id,'outline',id=>saveAiOutline(f.actor.id,null,id,'en',raw));
  await expect(createFromAiOutline(f.actor.id,saved.outlineId)).rejects.toMatchObject({code:'PRECONDITION_FAILED'});expect(await f.db.select().from(trainings).where(eq(trainings.ownerUserId,f.actor.id))).toHaveLength(0);
  const [record]=await f.db.select().from(aiOutlineDrafts).where(eq(aiOutlineDrafts.id,saved.outlineId));expect(record.trainingId).toBeNull();expect((await pendingAiOutlines(f.actor.id,{})).entries).toHaveLength(1);
  await expect(runAiRequest(f.actor.id,'quiz',id=>saveAiOutline(f.actor.id,null,id,'en',output()))).rejects.toMatchObject({code:'FORBIDDEN'});
 });
});
