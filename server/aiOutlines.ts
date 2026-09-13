import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {and,eq,sql} from 'drizzle-orm';
import {TRPCError} from '@trpc/server';
import {getDb,createCourseWithSlides,type DatabaseTransaction} from './db';
import {users,companies,affiliations,aiOutlineDrafts} from '../drizzle/schema';
import {generatedOutlineSchema} from './ai';
async function workspace(tx:DatabaseTransaction,userId:number,orgId:number|null){
 const [actor]=await tx.select().from(users).where(eq(users.id,userId)).for('share');if(actor?.status!=='active')throw new TRPCError({code:'FORBIDDEN'});
 if(orgId!=null){const [company]=await tx.select().from(companies).where(eq(companies.id,orgId)).for('share');const [manager]=await tx.select().from(affiliations).where(and(eq(affiliations.personId,userId),eq(affiliations.orgId,orgId),eq(affiliations.role,'MANAGER'),eq(affiliations.status,'ACTIVE'))).for('share');if(company?.status!=='ACTIVE'||(actor.role!=='admin'&&!manager))throw new TRPCError({code:'FORBIDDEN'});}
 else if(actor.role!=='admin'&&actor.role!=='instructor')throw new TRPCError({code:'FORBIDDEN'});
}
export async function saveAiOutline(userId:number,orgId:number|null,requestId:string,language:string,raw:unknown){const output=generatedOutlineSchema.parse(raw),db=(await getDb())!;return db.transaction(async tx=>{
 await workspace(tx,userId,orgId);
 const request=await tx.execute(sql`select id from ai_requests where id=${requestId} and "userId"=${userId} and operation='outline' and status='running'`);if(!request.length)throw new TRPCError({code:'FORBIDDEN'});
 const [record]=await tx.insert(aiOutlineDrafts).values({ownerUserId:userId,ownerOrgId:orgId,requestId,language,output}).returning({id:aiOutlineDrafts.id});return {...output,outlineId:record.id};
 });}
export const pendingOutlineInput=z.object({before:z.number().int().positive().max(2147483647).optional()}).strict();
export async function pendingAiOutlines(userId:number,raw:z.infer<typeof pendingOutlineInput>){const input=pendingOutlineInput.parse(raw),db=(await getDb())!;
 const rows=await db.execute<{id:number;title:string;ownerOrgId:number|null;organizationName:string|null;createdAt:string}>(sql`select o.id,o.output->>'title' as title,o."ownerOrgId",c.name as "organizationName",to_char(o."createdAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "createdAt" from ai_outline_drafts o join users u on u.id=o."ownerUserId" left join companies c on c.id=o."ownerOrgId" where o."ownerUserId"=${userId} and u.status='active' and o."trainingId" is null and ((o."ownerOrgId" is null and u.role in ('admin','instructor')) or (c.status='ACTIVE' and (u.role='admin' or exists(select 1 from affiliations a where a."personId"=${userId} and a."orgId"=o."ownerOrgId" and a.role='MANAGER' and a.status='ACTIVE')))) ${input.before?sql`and o.id<${input.before}`:sql``} order by o.id desc limit 51`);
 return {entries:rows.slice(0,50),nextCursor:rows.length>50?rows[49]!.id:null};
}
export async function createFromAiOutline(userId:number,id:number){const db=(await getDb())!;return db.transaction(async tx=>{
 const [record]=await tx.select().from(aiOutlineDrafts).where(and(eq(aiOutlineDrafts.id,id),eq(aiOutlineDrafts.ownerUserId,userId))).for('update');if(!record)throw new TRPCError({code:'NOT_FOUND'});
 await workspace(tx,userId,record.ownerOrgId);
 if(record.trainingId)return {trainingId:record.trainingId};
 const output=generatedOutlineSchema.parse(record.output);
 const result=await createCourseWithSlides({ownerUserId:userId,ownerOrgId:record.ownerOrgId,title:output.title,slug:`ai-${randomUUID()}`,description:output.description,language:record.language,slides:output.slides.map(s=>({title:s.title,body:s.body,imagePrompt:s.imagePrompt,quizQuestion:s.quiz?.question,quizOptions:s.quiz?.options,quizCorrect:s.quiz?.correct,quizExplanation:s.quiz?.explanation}))},tx);
 await tx.update(aiOutlineDrafts).set({trainingId:result.trainingId}).where(eq(aiOutlineDrafts.id,id));return result;
 });}
