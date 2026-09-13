import {randomUUID} from 'node:crypto';
import {sql,eq} from 'drizzle-orm';
import {TRPCError} from '@trpc/server';
import {getDb} from './db';
import {users} from '../drizzle/schema';
type Category='text'|'image'|'speech';
type Operation='outline'|'slide_text'|'quiz'|'image'|'speech';
function limits(){const result={text:30,image:10,speech:20};for(const key of Object.keys(result) as Category[]){const raw=process.env[`AI_${key.toUpperCase()}_REQUESTS_PER_HOUR`];if(raw!==undefined){if(!/^\d+$/.test(raw)||Number(raw)>1000)throw new TRPCError({code:'PRECONDITION_FAILED',message:'La configuration des limites IA doit être vérifiée.'});result[key]=Number(raw);}}return result;}
export async function aiRequestUsage(userId:number){const db=(await getDb())!;const rows=await db.execute<{category:Category;used:number}>(sql`select category,count(*)::int as used from ai_requests where "userId"=${userId} and "startedAt">now()-interval '1 hour' group by category`);const active=await db.execute<{expiresAt:string}>(sql`select to_char("expiresAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "expiresAt" from ai_requests where "userId"=${userId} and status='running' and "expiresAt">now() order by "expiresAt" desc limit 1`);return {limits:limits(),used:{text:rows.find(r=>r.category==='text')?.used??0,image:rows.find(r=>r.category==='image')?.used??0,speech:rows.find(r=>r.category==='speech')?.used??0},busyUntil:active[0]?.expiresAt??null};}
export async function runAiRequest<T>(userId:number,operation:Operation,generate:(requestId:string)=>Promise<T>):Promise<T>{
 const db=(await getDb())!,category:Category=operation==='image'?'image':operation==='speech'?'speech':'text',maximum=limits()[category],id=randomUUID();
 await db.transaction(async tx=>{
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ai-requests:${userId}`}))`);
  const [user]=await tx.select({status:users.status}).from(users).where(eq(users.id,userId)).for('share');if(user?.status!=='active')throw new TRPCError({code:'FORBIDDEN'});
  const active=await tx.execute(sql`select id from ai_requests where "userId"=${userId} and status='running' and "expiresAt">now() limit 1`);
  if(active.length)throw new TRPCError({code:'TOO_MANY_REQUESTS',message:'Une génération IA est déjà en cours pour votre compte. Attendez sa fin avant de réessayer.'});
  const [count]=await tx.execute<{used:number}>(sql`select count(*)::int as used from ai_requests where "userId"=${userId} and category=${category} and "startedAt">now()-interval '1 hour'`);
  if(count.used>=maximum)throw new TRPCError({code:'TOO_MANY_REQUESTS',message:'La limite horaire de générations IA est atteinte. Réessayez plus tard.'});
  await tx.execute(sql`insert into ai_requests (id,"userId",operation,category) values (${id},${userId},${operation},${category})`);
 });
 let result:T;
 try{result=await generate(id);}catch(error){await db.execute(sql`update ai_requests set status='failed',"finishedAt"=now() where id=${id} and status='running'`);throw error;}
 await db.execute(sql`update ai_requests set status='succeeded',"finishedAt"=now() where id=${id} and status='running'`);
 return result;
}
