import {z} from 'zod';
import {eq,sql,getTableColumns} from 'drizzle-orm';
import {TRPCError} from '@trpc/server';
import {getDb} from './db';
import {webinars,users,trainings,webinarRegistrations} from '../drizzle/schema';
const timing={scheduledAt:z.string().datetime({offset:true}),durationMinutes:z.number().int().min(1).max(1440)};
export const webinarCreateInput=z.object({...timing,title:z.string().trim().min(1).max(255),description:z.string().max(10000).optional(),trainingId:z.number().int().positive().nullable(),maxParticipants:z.number().int().min(1).max(10000)}).strict();
export const webinarScheduleInput=z.object({...timing,id:z.number().int().positive(),reason:z.string().trim().min(3).max(1000)}).strict();
export const webinarStatusInput=z.object({id:z.number().int().positive(),status:z.enum(['live','completed','cancelled']),reason:z.string().trim().min(3).max(1000)}).strict();
async function requireAdmin(db:any,actorId:number){const [actor]=await db.select({role:users.role,status:users.status}).from(users).where(eq(users.id,actorId)).for('share');if(actor?.role!=='admin'||actor.status!=='active')throw new TRPCError({code:'FORBIDDEN'});}
export async function listAdminWebinars(actorId:number){const db=(await getDb())!;return db.transaction(async tx=>{await requireAdmin(tx,actorId);return tx.select({...getTableColumns(webinars),registeredCount:sql<number>`(select count(distinct r."userId")::int from webinar_registrations r where r."webinarId"=webinars.id)`}).from(webinars).orderBy(webinars.scheduledAt);});}
async function event(tx:any,actorId:number,id:number,action:string,previous:unknown,next:unknown,reason:string){await tx.execute(sql`insert into webinar_admin_events ("webinarId","actorId",action,previous,next,reason) values (${id},${actorId},${action},${JSON.stringify(previous)}::jsonb,${JSON.stringify(next)}::jsonb,${reason})`);}
export async function createAdminWebinar(actorId:number,raw:z.infer<typeof webinarCreateInput>){const input=webinarCreateInput.parse(raw),db=(await getDb())!;return db.transaction(async tx=>{
 await requireAdmin(tx,actorId);
 if(input.trainingId){const [course]=await tx.select().from(trainings).where(eq(trainings.id,input.trainingId)).for('share');if(!course||course.archivedAt)throw new TRPCError({code:'PRECONDITION_FAILED',message:'Formation introuvable ou archivée.'});}
 const [created]=await tx.insert(webinars).values({...input,scheduledAt:new Date(input.scheduledAt),status:'scheduled'}).returning();
 await event(tx,actorId,created.id,'created',null,created,'Creation');return {id:created.id};
 });}
export async function rescheduleWebinar(actorId:number,raw:z.infer<typeof webinarScheduleInput>){const input=webinarScheduleInput.parse(raw),db=(await getDb())!;return db.transaction(async tx=>{
 await requireAdmin(tx,actorId);const [record]=await tx.select().from(webinars).where(eq(webinars.id,input.id)).for('update');if(!record)throw new TRPCError({code:'NOT_FOUND'});
 if(record.status==='completed'||record.status==='cancelled')throw new TRPCError({code:'PRECONDITION_FAILED',message:'Les horaires d’un webinaire terminé ou annulé sont conservés.'});
 const scheduledAt=new Date(input.scheduledAt);if(record.scheduledAt.getTime()===scheduledAt.getTime()&&record.durationMinutes===input.durationMinutes)return {changed:false};
 const [next]=await tx.update(webinars).set({scheduledAt,durationMinutes:input.durationMinutes}).where(eq(webinars.id,input.id)).returning();await event(tx,actorId,input.id,'rescheduled',record,next,input.reason);return {changed:true};
 });}
export async function setWebinarStatus(actorId:number,raw:z.infer<typeof webinarStatusInput>){const input=webinarStatusInput.parse(raw),db=(await getDb())!;return db.transaction(async tx=>{
 await requireAdmin(tx,actorId);const [record]=await tx.select().from(webinars).where(eq(webinars.id,input.id)).for('update');if(!record)throw new TRPCError({code:'NOT_FOUND'});
 if(record.status===input.status)return {changed:false};
 if(record.status==='completed'||record.status==='cancelled')throw new TRPCError({code:'PRECONDITION_FAILED',message:'Le statut final du webinaire est conservé.'});
 const [next]=await tx.update(webinars).set({status:input.status}).where(eq(webinars.id,input.id)).returning();await event(tx,actorId,input.id,'status',record,next,input.reason);return {changed:true};
 });}

export const webinarMetadataInput=z.object({id:z.number().int().positive(),title:z.string().trim().min(1).max(255),description:z.string().max(10000).nullable(),maxParticipants:z.number().int().min(1).max(10000).nullable(),reason:z.string().trim().min(3).max(1000)}).strict();
export async function updateWebinarMetadata(actorId:number,raw:z.infer<typeof webinarMetadataInput>){const input=webinarMetadataInput.parse(raw),db=(await getDb())!;return db.transaction(async tx=>{
 await requireAdmin(tx,actorId);const [record]=await tx.select().from(webinars).where(eq(webinars.id,input.id)).for('update');if(!record)throw new TRPCError({code:'NOT_FOUND'});
 if(record.status==='completed'||record.status==='cancelled')throw new TRPCError({code:'PRECONDITION_FAILED',message:'Les données d’un webinaire terminé ou annulé sont conservées.'});
 // Admissions acquire the same webinar lock before counting and inserting.
 const [count]=await tx.select({total:sql<number>`count(distinct ${webinarRegistrations.userId})::int`}).from(webinarRegistrations).where(eq(webinarRegistrations.webinarId,input.id));
 if(input.maxParticipants!=null&&input.maxParticipants<count.total)throw new TRPCError({code:'PRECONDITION_FAILED',message:`La capacité ne peut pas être inférieure aux ${count.total} inscriptions existantes.`});
 if(record.title===input.title&&record.description===input.description&&record.maxParticipants===input.maxParticipants)return {changed:false};
 const [next]=await tx.update(webinars).set({title:input.title,description:input.description,maxParticipants:input.maxParticipants}).where(eq(webinars.id,input.id)).returning();
 await event(tx,actorId,input.id,'metadata',record,next,input.reason);return {changed:true};
 });}

export const webinarHistoryInput=z.object({id:z.number().int().positive(),before:z.number().int().positive().max(2147483647).optional()}).strict();
type WebinarHistoryState={title:string|null;description:string|null;scheduledAt:string|null;durationMinutes:number|null;maxParticipants:number|null;status:string|null;trainingId:number|null};
type WebinarHistoryEvent={id:number;action:string;actorId:number;actorName:string|null;reason:string;createdAt:string;previous:WebinarHistoryState|null;next:WebinarHistoryState};
export async function webinarHistory(actorId:number,raw:z.infer<typeof webinarHistoryInput>){const input=webinarHistoryInput.parse(raw),db=(await getDb())!;return db.transaction(async tx=>{
 await requireAdmin(tx,actorId);
 const [webinar]=await tx.select({id:webinars.id,title:webinars.title,status:webinars.status}).from(webinars).where(eq(webinars.id,input.id));if(!webinar)throw new TRPCError({code:'NOT_FOUND'});
 const previous=sql`case when jsonb_typeof(e.previous)='object' then jsonb_build_object('title',e.previous->'title','description',e.previous->'description','scheduledAt',e.previous->'scheduledAt','durationMinutes',e.previous->'durationMinutes','maxParticipants',e.previous->'maxParticipants','status',e.previous->'status','trainingId',e.previous->'trainingId') else null end`;
 const next=sql`jsonb_build_object('title',e.next->'title','description',e.next->'description','scheduledAt',e.next->'scheduledAt','durationMinutes',e.next->'durationMinutes','maxParticipants',e.next->'maxParticipants','status',e.next->'status','trainingId',e.next->'trainingId')`;
 const rows=await tx.execute<WebinarHistoryEvent>(sql`select e.id,e.action,e."actorId",u.name as "actorName",e.reason,to_char(e."createdAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "createdAt",${previous} as previous,${next} as next from webinar_admin_events e left join users u on u.id=e."actorId" where e."webinarId"=${input.id} ${input.before?sql`and e.id<${input.before}`:sql``} order by e.id desc limit 51`);
 return {webinar,events:rows.slice(0,50),nextCursor:rows.length>50?rows[49]!.id:null};
 });}
