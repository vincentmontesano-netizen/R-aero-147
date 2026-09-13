import {beforeAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {getDb,updateTraining} from './db';
import {copyCourse} from './courseCopy';
import {canReadCourseMedia,validateCourseMediaReferences} from './courseMedia';
import {users,companies,affiliations,trainings,trainingModules,learningObjectives,slides,quizQuestions,courseMedia,courseCopies,copiedCourseMedia,enrollments} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('complete course copies · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 async function fixture(){
  const db=(await getDb())!;
  const [sourceOrg,targetOrg]=await db.insert(companies).values([{name:randomUUID()},{name:randomUUID()}]).returning();
  const [author,targetAuthor,outsider]=await db.insert(users).values([{openId:randomUUID(),role:'company_manager' as const},{openId:randomUUID(),role:'company_manager' as const},{openId:randomUUID(),role:'instructor' as const}]).returning();
  await db.insert(affiliations).values([{personId:author.id,orgId:sourceOrg.id,role:'MANAGER'},{personId:author.id,orgId:targetOrg.id,role:'MANAGER'},{personId:targetAuthor.id,orgId:targetOrg.id,role:'MANAGER'}]);
  const [source]=await db.insert(trainings).values({title:'Original',slug:randomUUID(),ownerUserId:author.id,ownerOrgId:sourceOrg.id,reviewStatus:'approved',isPublished:true,passingScore:80,examQuestionCount:2}).returning();
  const [module]=await db.insert(trainingModules).values({trainingId:source.id,title:'Chapter',quizPassingScore:85,quizMaxAttempts:2}).returning();
  const [objective]=await db.insert(learningObjectives).values({trainingId:source.id,moduleId:module.id,title:'Objective'}).returning();
  await db.update(trainingModules).set({objectiveId:objective.id}).where(eq(trainingModules.id,module.id));
  const key=`course-media/${source.id}/${randomUUID()}.png`;
  await db.insert(courseMedia).values({trainingId:source.id,createdBy:author.id,storageKey:key,byteSize:8,contentType:'image/png',sha256:'0'.repeat(64)});
  await db.insert(slides).values({trainingId:source.id,moduleId:module.id,objectiveId:objective.id,title:'Slide',imageUrl:`/storage/${key}`,quizQuestion:'Mini',quizOptions:['A','B'],quizCorrect:[0],videoCues:[{atSeconds:5,kind:'branch',branches:[{label:'Replay',seekTo:0}]}]});
  await db.insert(quizQuestions).values([{trainingId:source.id,moduleId:module.id,objectiveId:objective.id,question:'Chapter quiz',options:['A','B'],correctAnswer:[1]},{trainingId:source.id,question:'Final quiz',type:'matching',options:['L'],optionsRight:['R'],answerKey:{pairs:[[0,0]]}},{trainingId:source.id,question:'Archived question',archivedAt:new Date()}]);
  return {db,sourceOrg,targetOrg,author,targetAuthor,outsider,source,module,objective,key};
 }
 it('copies the complete active curriculum into an independent draft with remapped links',async()=>{
  const f=await fixture();const result=await copyCourse(f.author.id,{trainingId:f.source.id,title:'Copy',orgId:f.targetOrg.id});
  const [copy]=await f.db.select().from(trainings).where(eq(trainings.id,result.trainingId));
  expect(copy).toMatchObject({title:'Copy',ownerOrgId:f.targetOrg.id,isPublished:false,publishedVersionId:null,reviewStatus:'draft',version:1,passingScore:80,examQuestionCount:2});
  const [module]=await f.db.select().from(trainingModules).where(eq(trainingModules.trainingId,copy.id));
  const [objective]=await f.db.select().from(learningObjectives).where(eq(learningObjectives.trainingId,copy.id));
  expect(module).toMatchObject({title:'Chapter',quizPassingScore:85,quizMaxAttempts:2,objectiveId:objective.id});expect(module.id).not.toBe(f.module.id);expect(objective.moduleId).toBe(module.id);
  const [slide]=await f.db.select().from(slides).where(eq(slides.trainingId,copy.id));
  expect(slide).toMatchObject({moduleId:module.id,objectiveId:objective.id,quizCorrect:[0],videoCues:[{atSeconds:5,kind:'branch',branches:[{label:'Replay',seekTo:0}]}]});
  const questions=await f.db.select().from(quizQuestions).where(eq(quizQuestions.trainingId,copy.id));
  expect(questions).toHaveLength(2);expect(questions.find(q=>q.moduleId)).toMatchObject({moduleId:module.id,objectiveId:objective.id,correctAnswer:[1]});expect(questions.find(q=>!q.moduleId)).toMatchObject({answerKey:{pairs:[[0,0]]}});
  await f.db.update(trainingModules).set({title:'Changed copy'}).where(eq(trainingModules.id,module.id));
  expect((await f.db.select().from(trainingModules).where(eq(trainingModules.id,f.module.id)))[0].title).toBe('Chapter');
  expect(await f.db.execute(sql`select id from training_versions where "trainingId"=${copy.id}`)).toHaveLength(0);
  expect(await f.db.execute(sql`select id from enrollments where "trainingId"=${copy.id}`)).toHaveLength(0);
  await expect(f.db.delete(courseCopies).where(eq(courseCopies.trainingId,copy.id))).rejects.toThrow();
 });
 it('grants private media only through authorized copies, including copies of copies',async()=>{
  const f=await fixture();expect(await canReadCourseMedia(f.key,f.targetAuthor)).toBe(false);
  await f.db.update(trainings).set({type:'webinar'}).where(eq(trainings.id,f.source.id));
  const copy=await copyCourse(f.author.id,{trainingId:f.source.id,title:'With media',orgId:f.targetOrg.id});
  expect(await canReadCourseMedia(f.key,f.targetAuthor)).toBe(true);expect(await canReadCourseMedia(f.key,f.outsider)).toBe(false);
  await validateCourseMediaReferences(copy.trainingId,{imageUrl:`/storage/${f.key}`});
  const again=await copyCourse(f.targetAuthor.id,{trainingId:copy.trainingId,title:'Again',orgId:f.targetOrg.id});
  await validateCourseMediaReferences(again.trainingId,{imageUrl:`/storage/${f.key}`});
  await expect(f.db.delete(copiedCourseMedia).where(eq(copiedCourseMedia.trainingId,copy.trainingId))).rejects.toThrow();
  const [learner]=await f.db.insert(users).values({openId:randomUUID()}).returning();
  await f.db.insert(affiliations).values({personId:learner.id,orgId:f.targetOrg.id,role:'MEMBER'});
  expect(await canReadCourseMedia(f.key,learner)).toBe(false);
  await updateTraining(copy.trainingId,{isPublished:true});
  const [enrollment]=await f.db.insert(enrollments).values({userId:learner.id,trainingId:copy.trainingId,assignedOrgId:f.targetOrg.id}).returning();
  expect(await canReadCourseMedia(f.key,learner)).toBe(true);
  await f.db.update(enrollments).set({status:'expired'}).where(eq(enrollments.id,enrollment.id));
  expect(await canReadCourseMedia(f.key,learner)).toBe(false);
 });
 it('denies unauthorized source/destination and rolls back broken references without partial copies',async()=>{
  const f=await fixture();
  await expect(copyCourse(f.outsider.id,{trainingId:f.source.id,title:'Stolen',orgId:null})).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(copyCourse(f.targetAuthor.id,{trainingId:f.source.id,title:'Stolen',orgId:f.targetOrg.id})).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(copyCourse(f.author.id,{trainingId:f.source.id,title:'Unauthorized operator',orgId:null})).rejects.toMatchObject({code:'FORBIDDEN'});
  await f.db.update(slides).set({imageUrl:'/storage/course-media/999999/foreign.png'}).where(eq(slides.trainingId,f.source.id));
  await expect(copyCourse(f.author.id,{trainingId:f.source.id,title:'Foreign media',orgId:f.targetOrg.id})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
  await f.db.update(slides).set({imageUrl:`/storage/${f.key}`}).where(eq(slides.trainingId,f.source.id));
  await f.db.update(learningObjectives).set({archivedAt:new Date()}).where(eq(learningObjectives.id,f.objective.id));
  await expect(copyCourse(f.author.id,{trainingId:f.source.id,title:'Broken',orgId:f.targetOrg.id})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
  expect(await f.db.select().from(trainings).where(eq(trainings.ownerOrgId,f.targetOrg.id))).toHaveLength(0);

 });
});
