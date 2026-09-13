import {z} from 'zod';
import {and,eq,sql,asc} from 'drizzle-orm';
import {TRPCError} from '@trpc/server';
import {getDb,type DatabaseTransaction} from './db';
import {users,trainings,companies,affiliations,aiVideoJobs,courseMedia} from '../drizzle/schema';
import {videoGenerationInput,videoProviderModel,videoProviderConfigured,startVideoGeneration,checkVideoGeneration,downloadGeneratedVideo} from './veoProvider';
import {saveCourseMedia} from './courseMedia';
export const startVideoInput=videoGenerationInput.extend({id:z.string().uuid(),trainingId:z.number().int().positive()});
function limit(){const raw=process.env.AI_VIDEO_REQUESTS_PER_HOUR??'2';if(!/^\d+$/.test(raw)||Number(raw)>20)throw new TRPCError({code:'PRECONDITION_FAILED',message:'Limite vidéo invalide.'});return Number(raw);}
async function access(tx:DatabaseTransaction,userId:number,trainingId:number){
 const [actor]=await tx.select().from(users).where(eq(users.id,userId)).for('share');const [course]=await tx.select().from(trainings).where(eq(trainings.id,trainingId)).for('share');
 if(actor?.status!=='active'||!course||course.archivedAt)throw new TRPCError({code:'FORBIDDEN'});
 if(course.ownerOrgId!=null){const [org]=await tx.select().from(companies).where(eq(companies.id,course.ownerOrgId)).for('share');const [link]=await tx.select().from(affiliations).where(and(eq(affiliations.personId,userId),eq(affiliations.orgId,course.ownerOrgId),eq(affiliations.role,'MANAGER'),eq(affiliations.status,'ACTIVE'))).for('share');if(org?.status!=='ACTIVE'||(actor.role!=='admin'&&!link))throw new TRPCError({code:'FORBIDDEN'});}
 else if(actor.role!=='admin'&&(actor.role!=='instructor'||course.ownerUserId!==userId))throw new TRPCError({code:'FORBIDDEN'});
 return {actor,course};
}
export async function startAiVideo(userId:number,raw:z.input<typeof startVideoInput>){
 const {id,trainingId,...input}=startVideoInput.parse(raw),db=(await getDb())!;
 const reservation=await db.transaction(async tx=>{
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ai-video:${userId}`}))`);const {course}=await access(tx,userId,trainingId);
  const [existing]=await tx.select().from(aiVideoJobs).where(eq(aiVideoJobs.id,id));if(existing){if(existing.userId!==userId||existing.trainingId!==trainingId||existing.ownerOrgId!==course.ownerOrgId)throw new TRPCError({code:'NOT_FOUND'});if(JSON.stringify(existing.input)!==JSON.stringify(input)&& (existing.input.prompt!==input.prompt||existing.input.aspectRatio!==input.aspectRatio||existing.input.durationSeconds!==input.durationSeconds))throw new TRPCError({code:'CONFLICT',message:'Cette demande vidéo possède déjà ses paramètres.'});return {fresh:false,model:existing.model};}
  const maximum=limit(),model=videoProviderModel();const [counts]=await tx.execute<{used:number;active:number}>(sql`select count(*) filter(where "createdAt">now()-interval '1 hour')::int as used,count(*) filter(where (status='submitting' and "createdAt">now()-interval '5 minutes') or (status='running' and "createdAt">now()-interval '24 hours'))::int as active from ai_video_jobs where "userId"=${userId}`);
  if(counts.used>=maximum||counts.active)throw new TRPCError({code:'TOO_MANY_REQUESTS',message:'Une vidéo est en cours ou la limite horaire est atteinte.'});
  await tx.insert(aiVideoJobs).values({id,userId,trainingId,ownerOrgId:course.ownerOrgId,model,input});return {fresh:true,model};
 });
 if(!reservation.fresh)return {id};
 try{const operation=await startVideoGeneration(input,reservation.model);await db.update(aiVideoJobs).set({status:'running',operationName:operation.operationName}).where(and(eq(aiVideoJobs.id,id),eq(aiVideoJobs.status,'submitting')));}
 catch{await db.update(aiVideoJobs).set({status:'unknown'}).where(and(eq(aiVideoJobs.id,id),eq(aiVideoJobs.status,'submitting')));}
 return {id};
}
export async function listAiVideos(userId:number,trainingId:number){const db=(await getDb())!;return db.transaction(async tx=>{
 const {course}=await access(tx,userId,trainingId);const rows=await tx.execute<{id:string;status:string;createdAt:string;durationSeconds:number;url:string|null}>(sql`select j.id,case when j.status='submitting' and j."createdAt"<now()-interval '5 minutes' then 'unknown' else j.status end as status,to_char(j."createdAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "createdAt",(j.input->>'durationSeconds')::int as "durationSeconds",case when m.id is not null then '/storage/'||m."storageKey" else null end as url from ai_video_jobs j left join course_media m on m.id=j."mediaId" where j."userId"=${userId} and j."trainingId"=${trainingId} and j."ownerOrgId" is not distinct from ${course.ownerOrgId} order by j."createdAt" desc,j.id desc limit 50`);
 const [count]=await tx.execute<{used:number}>(sql`select count(*)::int as used from ai_video_jobs where "userId"=${userId} and "createdAt">now()-interval '1 hour'`);return {entries:rows,used:count.used,limit:limit(),configured:videoProviderConfigured()};
 });}
async function refreshLockedVideo(tx:DatabaseTransaction,job:typeof aiVideoJobs.$inferSelect){
 const userId=job.userId,id=job.id;
 const {actor,course}=await access(tx,userId,job.trainingId);if(course.ownerOrgId!==job.ownerOrgId)throw new TRPCError({code:'FORBIDDEN'});
 if(job.status==='submitting'){if(Date.now()-job.createdAt.getTime()>300000)await tx.update(aiVideoJobs).set({status:'unknown'}).where(eq(aiVideoJobs.id,id));return {id};}
 if(job.status!=='running')return {id};
 if(job.checkedAt&&Date.now()-job.checkedAt.getTime()<10000)return {id};
 if(Date.now()-job.createdAt.getTime()>86400000){await tx.update(aiVideoJobs).set({status:'unknown',checkedAt:new Date()}).where(eq(aiVideoJobs.id,id));return {id};}
 let result:Awaited<ReturnType<typeof checkVideoGeneration>>,bytes:Buffer|undefined;
 try{result=await checkVideoGeneration(job.operationName!);if(result.state==='ready')bytes=await downloadGeneratedVideo(result.uri);}
 catch{await tx.update(aiVideoJobs).set({checkedAt:new Date()}).where(eq(aiVideoJobs.id,id));return {id,retry:true};}
 if(result.state==='ready'){const media=await saveCourseMedia(actor,job.trainingId,bytes!,'video/mp4','generated',tx);await tx.update(aiVideoJobs).set({status:'ready',mediaId:media.mediaId,checkedAt:new Date()}).where(eq(aiVideoJobs.id,id));}
 else await tx.update(aiVideoJobs).set({status:result.state==='failed'?'failed':'running',checkedAt:new Date()}).where(eq(aiVideoJobs.id,id));
 return {id};

}
export async function refreshAiVideo(userId:number,id:string){const db=(await getDb())!;return db.transaction(async tx=>{
 const [job]=await tx.select().from(aiVideoJobs).where(and(eq(aiVideoJobs.id,id),eq(aiVideoJobs.userId,userId))).for('update');if(!job)throw new TRPCError({code:'NOT_FOUND'});
 return refreshLockedVideo(tx,job);
});}
/** Bounded drain; optional course scope also supports targeted maintenance. */
export async function processPendingAiVideos(maxJobs=5,trainingId?:number){
 z.number().int().min(1).max(20).parse(maxJobs);if(trainingId!=null)z.number().int().positive().parse(trainingId);
 const db=(await getDb())!;let processed=0,failed=0;
 for(let i=0;i<maxJobs;i++){
  const outcome=await db.transaction(async tx=>{
   const [job]=await tx.select().from(aiVideoJobs).where(and(eq(aiVideoJobs.status,'running'),sql`("checkedAt" is null or "checkedAt"<now()-interval '30 seconds')`,trainingId==null?undefined:eq(aiVideoJobs.trainingId,trainingId))).orderBy(sql`"checkedAt" asc nulls first`,asc(aiVideoJobs.createdAt),asc(aiVideoJobs.id)).limit(1).for('update',{skipLocked:true});
   if(!job)return null;
   try{const result=await tx.transaction(inner=>refreshLockedVideo(inner,job));return 'retry' in result&&result.retry?'failed':'processed';}
   catch{await tx.update(aiVideoJobs).set({checkedAt:new Date()}).where(eq(aiVideoJobs.id,job.id));return 'failed';}
  });
  if(outcome==null)break;if(outcome==='failed')failed++;else processed++;
 }
 return {processed,failed};
}
