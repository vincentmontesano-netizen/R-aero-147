import {z} from 'zod';
import {TRPCError} from '@trpc/server';
import {eq,sql} from 'drizzle-orm';
import {getDb} from './db';
import {sessions,users} from '../drizzle/schema';
export const scheduleInput=z.object({id:z.number().int().positive(),startDate:z.string().datetime({offset:true}),endDate:z.string().datetime({offset:true}),reason:z.string().trim().min(3).max(1000)}).strict().refine(v=>Date.parse(v.endDate)>Date.parse(v.startDate),{message:'La fin doit être après le début.',path:['endDate']});
export async function rescheduleSession(actorId:number,raw:z.infer<typeof scheduleInput>){
 const input=scheduleInput.parse(raw),db=(await getDb())!;
 return db.transaction(async tx=>{
  const [actor]=await tx.select().from(users).where(eq(users.id,actorId)).for('share');
  if(actor?.role!=='admin'||actor.status!=='active')throw new TRPCError({code:'FORBIDDEN'});
  const [session]=await tx.select().from(sessions).where(eq(sessions.id,input.id)).for('update');
  if(!session)throw new TRPCError({code:'NOT_FOUND'});
  if(session.status==='completed'||session.status==='cancelled')throw new TRPCError({code:'PRECONDITION_FAILED',message:'Les horaires d’une classe terminée ou annulée sont conservés.'});
  const startDate=new Date(input.startDate),endDate=new Date(input.endDate);
  if(session.startDate.getTime()===startDate.getTime()&&session.endDate?.getTime()===endDate.getTime())return {success:true,changed:false};
  await tx.update(sessions).set({startDate,endDate}).where(eq(sessions.id,input.id));
  await tx.execute(sql`insert into session_schedule_events ("sessionId","actorId","previousStart","previousEnd","nextStart","nextEnd",reason) values (${session.id},${actor.id},${session.startDate.toISOString()},${session.endDate?.toISOString() ?? null},${startDate.toISOString()},${endDate.toISOString()},${input.reason})`);
  return {success:true,changed:true};
 });
}

export const scheduleHistoryInput=z.object({id:z.number().int().positive(),before:z.number().int().positive().max(2147483647).optional()}).strict();
type ScheduleEvent={id:number;actorId:number;actorName:string|null;previousStart:string;previousEnd:string|null;nextStart:string;nextEnd:string;reason:string;createdAt:string};
export async function sessionScheduleHistory(actorId:number,raw:z.infer<typeof scheduleHistoryInput>){
 const input=scheduleHistoryInput.parse(raw),db=(await getDb())!;
 const [actor]=await db.select().from(users).where(eq(users.id,actorId));
 if(actor?.role!=='admin'||actor.status!=='active')throw new TRPCError({code:'FORBIDDEN'});
 const [session]=await db.select({id:sessions.id,title:sessions.title,status:sessions.status}).from(sessions).where(eq(sessions.id,input.id));
 if(!session)throw new TRPCError({code:'NOT_FOUND'});
 const rows=await db.execute<ScheduleEvent>(sql`select e.id,e."actorId",u.name as "actorName",e.reason,
 to_char(e."previousStart",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "previousStart",
 to_char(e."previousEnd",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "previousEnd",
 to_char(e."nextStart",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "nextStart",
 to_char(e."nextEnd",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "nextEnd",
 to_char(e."createdAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "createdAt"
 from session_schedule_events e left join users u on u.id=e."actorId"
 where e."sessionId"=${input.id} ${input.before?sql`and e.id<${input.before}`:sql``} order by e.id desc limit 51`);
 return {session,events:rows.slice(0,50),nextCursor:rows.length>50?rows[49]!.id:null};
}
