import {z} from 'zod';
import {eq,sql} from 'drizzle-orm';
import {TRPCError} from '@trpc/server';
import {getDb} from './db';
import {users} from '../drizzle/schema';
export const instructorAgendaInput=z.object({from:z.string().datetime({offset:true}),to:z.string().datetime({offset:true}),after:z.object({startsAt:z.string().datetime({offset:true}),assignmentId:z.number().int().positive()}).optional()}).strict().refine(v=>Date.parse(v.to)>Date.parse(v.from)&&Date.parse(v.to)-Date.parse(v.from)<=93*86400000,{message:'Choisissez une période de 93 jours maximum.'});
type AgendaRow={assignmentId:number;roomType:'session'|'webinar';roomId:number;title:string;startsAt:string;endsAt:string|null;status:string|null};
export async function instructorAgenda(actorId:number,raw:z.infer<typeof instructorAgendaInput>){
 const input=instructorAgendaInput.parse(raw),db=(await getDb())!;
 const [actor]=await db.select({role:users.role,status:users.status}).from(users).where(eq(users.id,actorId));
 if(actor?.role!=='instructor'||actor.status!=='active')throw new TRPCError({code:'FORBIDDEN'});
 const from=new Date(input.from).toISOString(),to=new Date(input.to).toISOString();
 const rows=await db.execute<AgendaRow>(sql`with assigned as (
 select a.id as "assignmentId",a."roomType",a."roomId",coalesce(s.title,w.title) as title,
 coalesce(s."startDate",w."scheduledAt") as "startsAt",
 case when a."roomType"='session' then s."endDate" else w."scheduledAt"+w."durationMinutes"*interval '1 minute' end as "endsAt",
 coalesce(s.status::text,w.status::text) as status
 from live_instructor_assignments a
 left join sessions s on a."roomType"='session' and s.id=a."roomId"
 left join webinars w on a."roomType"='webinar' and w.id=a."roomId"
 left join trainings t on t.id=coalesce(s."trainingId",w."trainingId")
 left join companies c on c.id=t."ownerOrgId"
 where a."userId"=${actorId} and a.active and (s.id is not null or w.id is not null)
 and (coalesce(s."trainingId",w."trainingId") is null or (t.id is not null and t."archivedAt" is null and (t."ownerOrgId" is null or c.status='ACTIVE')))
 ) select "assignmentId","roomType","roomId",title,status,
 to_char("startsAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "startsAt",
 to_char("endsAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "endsAt"
 from assigned where "startsAt"<${to}::timestamp and coalesce("endsAt","startsAt")>=${from}::timestamp
 ${input.after?sql`and ("startsAt","assignmentId")>(${new Date(input.after.startsAt).toISOString()}::timestamp,${input.after.assignmentId})`:sql``}
 order by "startsAt","assignmentId" limit 51`);
 const entries=rows.slice(0,50),last=entries[entries.length-1];
 return {entries,nextCursor:rows.length>50?{startsAt:last.startsAt,assignmentId:last.assignmentId}:null};
}
