import {performance} from 'node:perf_hooks';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {eq,sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {users} from '../drizzle/schema';
import {appRouter} from '../server/routers';
import {collectComplianceReport} from '../shared/collectComplianceReport';
const configured=process.env.RAERO_TEST_DATABASE_URL;
if(!configured)throw new Error('Isolated database required');
const target=new URL(configured);
if(target.hostname!=='127.0.0.1'||target.port!=='55477'||target.pathname!=='/raero_test_isolated')throw new Error('Unexpected database target');
process.env.DATABASE_URL=configured;
const pageSize=Number(process.argv[3] ?? '50');
if(!Number.isInteger(pageSize)||pageSize<1||pageSize>250)throw new Error('Invalid page size');
const db=(await getDb())!;
const [admin]=await db.insert(users).values({openId:randomUUID(),role:'admin'}).returning();
try{
 const api=appRouter.createCaller({user:admin,req:{headers:{}},res:{}} as any);
 const counts=(await db.execute(sql`select (select count(*)::int from enrollments) as enrollments,(select count(*)::int from certificates) as certificates`))[0];
 async function run(){
  const began=performance.now();let pages=0,maxPageMs=0;
  const entries=await collectComplianceReport(async cursor=>{
   const start=performance.now();const page=await api.admin.complianceReport({cursor,pageSize});
   pages++;maxPageMs=Math.max(maxPageMs,performance.now()-start);return page;
  });
  const unique=new Set(entries.map(e=>e.enrollmentId)).size;
  if(unique!==entries.length||entries.length!==counts.enrollments)throw new Error('Incomplete or duplicate export');
  return {elapsedMs:Math.round(performance.now()-began),pages,entries:entries.length,maxPageMs:Math.round(maxPageMs),unique};
 }
 const sequential=[];for(let n=0;n<3;n++)sequential.push(await run());
 const started=performance.now();const concurrent=await Promise.all([run(),run(),run(),run()]);
 const result={observedAt:new Date().toISOString(),pageSize,scope:'Isolated PostgreSQL; in-process tRPC calls including access audit; no HTTP/browser/CSV serialization',counts,sequential,concurrent:{wallMs:Math.round(performance.now()-started),runs:concurrent}};
 await writeFile(process.argv[2] ?? 'docs/report-performance-current.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
}finally{await db.update(users).set({status:'suspended'}).where(eq(users.id,admin.id));}
process.exit(0);
