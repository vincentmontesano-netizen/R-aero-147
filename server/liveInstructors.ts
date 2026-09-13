import {z} from 'zod';
import {and,eq,sql,ilike,or} from 'drizzle-orm';
import {TRPCError} from '@trpc/server';
import {getDb} from './db';
import {users,sessions,webinars,liveInstructorAssignments} from '../drizzle/schema';
export const instructorRoomInput=z.object({roomType:z.enum(['session','webinar']),roomId:z.number().int().positive()}).strict();
export const instructorAssignmentInput=instructorRoomInput.extend({userId:z.number().int().positive(),active:z.boolean(),reason:z.string().trim().min(3).max(1000)});
export const instructorSearchInput=z.object({search:z.string().trim().min(2).max(100)}).strict();
async function admin(tx:any,id:number){const [actor]=await tx.select().from(users).where(eq(users.id,id)).for('share');if(actor?.role!=='admin'||actor.status!=='active')throw new TRPCError({code:'FORBIDDEN'});}
async function room(tx:any,input:z.infer<typeof instructorRoomInput>){const table=input.roomType==='session'?sessions:webinars;const [value]=await tx.select().from(table).where(eq(table.id,input.roomId)).for('update');if(!value)throw new TRPCError({code:'NOT_FOUND'});return value;}
export async function searchLiveInstructors(actorId:number,raw:z.infer<typeof instructorSearchInput>){const input=instructorSearchInput.parse(raw),db=(await getDb())!;return db.transaction(async tx=>{await admin(tx,actorId);const term=`%${input.search.replace(/[\\%_]/g,'\\$&')}%`;return tx.select({id:users.id,name:users.name,email:users.email}).from(users).where(and(eq(users.role,'instructor'),eq(users.status,'active'),or(ilike(users.name,term),ilike(users.email,term)))).orderBy(users.id).limit(20);});}
export async function listLiveInstructors(actorId:number,raw:z.infer<typeof instructorRoomInput>){const input=instructorRoomInput.parse(raw),db=(await getDb())!;return db.transaction(async tx=>{await admin(tx,actorId);await room(tx,input);return tx.select({id:liveInstructorAssignments.id,userId:users.id,name:users.name,role:users.role,status:users.status,active:liveInstructorAssignments.active}).from(liveInstructorAssignments).innerJoin(users,eq(users.id,liveInstructorAssignments.userId)).where(and(eq(liveInstructorAssignments.roomType,input.roomType),eq(liveInstructorAssignments.roomId,input.roomId))).orderBy(liveInstructorAssignments.id);});}
export async function setLiveInstructor(actorId:number,raw:z.infer<typeof instructorAssignmentInput>){const input=instructorAssignmentInput.parse(raw),db=(await getDb())!;return db.transaction(async tx=>{
 await admin(tx,actorId);const currentRoom=await room(tx,input);
 const [instructor]=await tx.select().from(users).where(eq(users.id,input.userId)).for('share');
 if(!instructor)throw new TRPCError({code:'NOT_FOUND'});
 if(input.active&&(instructor.role!=='instructor'||instructor.status!=='active'||currentRoom.status==='cancelled'||currentRoom.status==='completed'))throw new TRPCError({code:'PRECONDITION_FAILED',message:'Choisissez un instructeur actif pour une classe non terminée.'});
 const [existing]=await tx.select().from(liveInstructorAssignments).where(and(eq(liveInstructorAssignments.roomType,input.roomType),eq(liveInstructorAssignments.roomId,input.roomId),eq(liveInstructorAssignments.userId,input.userId)));
 if((existing?.active??false)===input.active)return {changed:false};
 const assignment=existing??(await tx.insert(liveInstructorAssignments).values({roomType:input.roomType,roomId:input.roomId,userId:input.userId,active:false}).returning())[0];
 await tx.update(liveInstructorAssignments).set({active:input.active}).where(eq(liveInstructorAssignments.id,assignment.id));
 await tx.execute(sql`insert into live_instructor_events ("assignmentId","actorId","previousActive",active,reason) values (${assignment.id},${actorId},${existing?.active??false},${input.active},${input.reason})`);
 return {changed:true};
 });}

export const instructorHistoryInput=instructorRoomInput.extend({before:z.number().int().positive().max(2147483647).optional()});
type InstructorHistoryEvent={id:number;assignmentId:number;userId:number;instructorName:string|null;actorId:number;actorName:string|null;previousActive:boolean;active:boolean;reason:string;createdAt:string};
export async function liveInstructorHistory(actorId:number,raw:z.infer<typeof instructorHistoryInput>){const input=instructorHistoryInput.parse(raw),db=(await getDb())!;return db.transaction(async tx=>{
 await admin(tx,actorId);await room(tx,input);
 const rows=await tx.execute<InstructorHistoryEvent>(sql`select e.id,e."assignmentId",a."userId",i.name as "instructorName",e."actorId",u.name as "actorName",e."previousActive",e.active,e.reason,to_char(e."createdAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "createdAt" from live_instructor_events e join live_instructor_assignments a on a.id=e."assignmentId" left join users i on i.id=a."userId" left join users u on u.id=e."actorId" where a."roomType"=${input.roomType} and a."roomId"=${input.roomId} ${input.before?sql`and e.id<${input.before}`:sql``} order by e.id desc limit 51`);
 return {events:rows.slice(0,50),nextCursor:rows.length>50?rows[49]!.id:null};
 });}
