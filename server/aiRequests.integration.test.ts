import {afterEach,beforeAll,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {getDb} from './db';
import {runAiRequest,aiRequestUsage} from './aiRequests';
import {users} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('persistent AI request control · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});afterEach(()=>vi.unstubAllEnvs());
 async function fixture(){const db=(await getDb())!;const [actor]=await db.insert(users).values({openId:randomUUID(),role:'instructor'}).returning();return {db,actor};}
 it('admits one concurrent operation per account before invoking a provider callback',async()=>{
  const f=await fixture();let release!:()=>void,start!:()=>void;const started=new Promise<void>(r=>start=r),pending=new Promise<void>(r=>release=r);
  const first=runAiRequest(f.actor.id,'outline',async()=>{start();await pending;return 'result';});await started;
  const callback=vi.fn(async()=> 'duplicate');
  await expect(runAiRequest(f.actor.id,'image',callback)).rejects.toMatchObject({code:'TOO_MANY_REQUESTS'});expect(callback).not.toHaveBeenCalled();
  expect((await aiRequestUsage(f.actor.id)).busyUntil).not.toBeNull();release();await expect(first).resolves.toBe('result');
  const usage=await aiRequestUsage(f.actor.id);expect(usage.used.text).toBe(1);expect(usage.busyUntil).toBeNull();
  await expect(f.db.execute(sql`delete from ai_requests where "userId"=${f.actor.id}`)).rejects.toThrow();
  await expect(f.db.execute(sql`update ai_requests set status='failed' where "userId"=${f.actor.id}`)).rejects.toThrow();
 });
 it('shares text quota across operations, counts failed requests and keeps account counters separate',async()=>{
  vi.stubEnv('AI_TEXT_REQUESTS_PER_HOUR','1');const f=await fixture(),other=await fixture();
  await expect(runAiRequest(f.actor.id,'quiz',async()=>{throw new Error('Provider fixture failure');})).rejects.toThrow('Provider fixture failure');
  const callback=vi.fn(async()=> 'should not run');await expect(runAiRequest(f.actor.id,'slide_text',callback)).rejects.toMatchObject({code:'TOO_MANY_REQUESTS'});expect(callback).not.toHaveBeenCalled();
  expect(await f.db.execute(sql`select status,"finishedAt" is not null as finished from ai_requests where "userId"=${f.actor.id}`)).toEqual([{status:'failed',finished:true}]);
  await expect(runAiRequest(other.actor.id,'outline',async()=> 'other account')).resolves.toBe('other account');
  await expect(runAiRequest(f.actor.id,'image',async()=> 'different category')).resolves.toBe('different category');
 });
 it('allows recovery after an expired reservation, preserves its unknown outcome and validates limits',async()=>{
  const f=await fixture();await f.db.execute(sql`insert into ai_requests (id,"userId",operation,category,"expiresAt") values (${randomUUID()},${f.actor.id},'outline','text',now()-interval '1 second')`);
  await expect(runAiRequest(f.actor.id,'quiz',async()=> 'retry')).resolves.toBe('retry');
  expect(await f.db.execute(sql`select status from ai_requests where "userId"=${f.actor.id} order by "startedAt"`)).toEqual([{status:'running'},{status:'succeeded'}]);
  vi.stubEnv('AI_IMAGE_REQUESTS_PER_HOUR','0');await expect(runAiRequest(f.actor.id,'image',async()=> 'disabled')).rejects.toMatchObject({code:'TOO_MANY_REQUESTS'});
  vi.stubEnv('AI_IMAGE_REQUESTS_PER_HOUR','invalid');await expect(runAiRequest(f.actor.id,'image',async()=> 'invalid')).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
 });
});
