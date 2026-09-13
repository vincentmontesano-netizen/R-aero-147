import {beforeAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq} from 'drizzle-orm';
import {getDb,updateTraining,gradeQuizAnswer} from './db';
import {courseReadiness} from './courseReadiness';
import {requestPedagogicalReview,reviewSnapshot} from './pedagogicalReview';
import {users,trainings,trainingModules,quizQuestions,slides,pedagogicalReviews,trainingVersions} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('activity publication readiness · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 async function fixture(){const db=(await getDb())!;const [author]=await db.insert(users).values({openId:randomUUID(),role:'instructor'}).returning();const [course]=await db.insert(trainings).values({title:'Readiness',slug:randomUUID(),ownerUserId:author.id}).returning();const [chapter]=await db.insert(trainingModules).values({trainingId:course.id,title:'Chapter',content:'Lesson'}).returning();await db.insert(quizQuestions).values([chapter.id,null].map(moduleId=>({trainingId:course.id,moduleId,question:'Choose',options:['A','B'],correctAnswer:[0]})));const [slide]=await db.insert(slides).values({trainingId:course.id,moduleId:chapter.id,title:'Activity'}).returning();return {db,author,course,slide};}
 it('reports legacy invalid mini-quizzes and blocks both review request and publication',async()=>{
  const f=await fixture();expect((await courseReadiness(f.course.id)).ready).toBe(true);
  await f.db.update(slides).set({quizQuestion:'Choose',quizOptions:['A','B'],quizCorrect:[2]}).where(eq(slides.id,f.slide.id));
  expect((await courseReadiness(f.course.id)).issues).toEqual([{code:'slideQuiz',label:'Activity',slideId:f.slide.id}]);
  await expect(requestPedagogicalReview(f.author,f.course.id)).rejects.toMatchObject({code:'PRECONDITION_FAILED'});await expect(updateTraining(f.course.id,{isPublished:true},f.author.id)).rejects.toThrow('Formation incomplète');
  expect(await f.db.select().from(pedagogicalReviews).where(eq(pedagogicalReviews.trainingId,f.course.id))).toHaveLength(0);expect(await f.db.select().from(trainingVersions).where(eq(trainingVersions.trainingId,f.course.id))).toHaveLength(0);
  await f.db.update(slides).set({quizCorrect:[1]}).where(eq(slides.id,f.slide.id));expect((await courseReadiness(f.course.id)).ready).toBe(true);await expect(requestPedagogicalReview(f.author,f.course.id)).resolves.toHaveProperty('id');
 });
 it('requires keyword-only free-text corrections for publication and reviews the replacement',async()=>{
  const f=await fixture();
  const [question]=await f.db.select().from(quizQuestions).where(eq(quizQuestions.trainingId,f.course.id));
  await f.db.update(quizQuestions).set({type:'free_text',options:[],correctAnswer:[],answerKey:{keywords:['hydraulique'],regex:'legacy-expression'}}).where(eq(quizQuestions.id,question.id));
  expect((await courseReadiness(f.course.id)).issues).toContainEqual({code:'question',label:question.question,questionId:question.id});
  await expect(requestPedagogicalReview(f.author,f.course.id)).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
  const answerKey={keywords:['hydraulique','électrique']};
  await f.db.update(quizQuestions).set({answerKey}).where(eq(quizQuestions.id,question.id));
  expect((await courseReadiness(f.course.id)).ready).toBe(true);
  const review=await requestPedagogicalReview(f.author,f.course.id);
  expect((await reviewSnapshot(f.author,review.id)).snapshot.questions.find(q=>q.id===question.id)?.answerKey).toEqual(answerKey);
  expect(gradeQuizAnswer({type:'free_text',answerKey},'Circuit ELECTRIQUE')).toBe(true);
  expect(gradeQuizAnswer({type:'free_text',answerKey},'Circuit hydraulique')).toBe(true);
  expect(gradeQuizAnswer({type:'free_text',answerKey},'Circuit pneumatique')).toBe(false);
 });
 it('blocks review for a keyword empty after grading normalization, including mixed alternatives',async()=>{
  const f=await fixture();
  const [question]=await f.db.select().from(quizQuestions).where(eq(quizQuestions.trainingId,f.course.id));
  for(const keywords of [['\u0301'],['hydraulique',' \u0301 ']]){
   await f.db.update(quizQuestions).set({type:'free_text',options:[],correctAnswer:[],answerKey:{keywords}}).where(eq(quizQuestions.id,question.id));
   expect((await courseReadiness(f.course.id)).issues).toContainEqual({code:'question',label:question.question,questionId:question.id});
   await expect(requestPedagogicalReview(f.author,f.course.id)).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
  }
  expect(await f.db.select().from(pedagogicalReviews).where(eq(pedagogicalReviews.trainingId,f.course.id))).toHaveLength(0);
  await f.db.update(quizQuestions).set({answerKey:{keywords:['électrique','محرك']}}).where(eq(quizQuestions.id,question.id));
  expect((await courseReadiness(f.course.id)).ready).toBe(true);
 });
 it('requires valid cues and a video source while allowing slides without interactions',async()=>{
  const f=await fixture();const cue={atSeconds:5,kind:'branch' as const,branches:[{label:'Replay',seekTo:0}]};await f.db.update(slides).set({videoCues:[cue]}).where(eq(slides.id,f.slide.id));expect((await courseReadiness(f.course.id)).issues).toEqual([{code:'videoActivities',label:'Activity',slideId:f.slide.id}]);
  await f.db.update(slides).set({videoUrl:'https://example.invalid/video.mp4',videoCues:[{...cue,branches:[]}]}).where(eq(slides.id,f.slide.id));expect((await courseReadiness(f.course.id)).ready).toBe(false);
  await f.db.update(slides).set({videoCues:[cue]}).where(eq(slides.id,f.slide.id));expect((await courseReadiness(f.course.id)).ready).toBe(true);
  await f.db.update(slides).set({videoUrl:null,videoCues:[]}).where(eq(slides.id,f.slide.id));expect((await courseReadiness(f.course.id)).ready).toBe(true);
 });
});
