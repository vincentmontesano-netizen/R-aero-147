import {beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq} from 'drizzle-orm';
import {getDb,createQuoteRequest,updateQuoteRequestStatus,getQuoteStatusHistory} from './db';
import {users,quoteRequests,quoteStatusEvents} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('quote status history · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 it('rejects concurrent stale decisions and records only committed changes with their actor',async()=>{
  const db=(await getDb())!;
  const [admin]=await db.insert(users).values({openId:randomUUID(),role:'admin'}).returning();
  const {quoteId:id}=await createQuoteRequest({companyName:'Status '+randomUUID(),contactName:'Contact',contactEmail:'status@example.com'});
  const results=await Promise.allSettled(['in_progress','refused'].map(status=>updateQuoteRequestStatus({id,status,expectedRevision:0},admin.id)));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{code:'CONFLICT'}});
  const [row]=await db.select().from(quoteRequests).where(eq(quoteRequests.id,id));
  expect(row.revision).toBe(1);
  const history=await getQuoteStatusHistory(id);
  expect(history.entries).toHaveLength(1);
  expect(history.entries[0]).toMatchObject({previousStatus:'received',status:row.status,revision:1,actorId:admin.id});
  await updateQuoteRequestStatus({id,status:row.status,expectedRevision:1},admin.id);
  expect((await getQuoteStatusHistory(id)).entries).toHaveLength(1);
  // Returning to an earlier status must not make a stale version valid again.
  await updateQuoteRequestStatus({id,status:'received',expectedRevision:1},admin.id);
  await expect(updateQuoteRequestStatus({id,status:'accepted',expectedRevision:0},admin.id)).rejects.toMatchObject({code:'CONFLICT'});
  await expect(updateQuoteRequestStatus({id,status:'accepted'},admin.id)).rejects.toMatchObject({code:'BAD_REQUEST'});
  await db.update(users).set({status:'suspended'}).where(eq(users.id,admin.id));
  await expect(updateQuoteRequestStatus({id,status:'accepted',expectedRevision:2},admin.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(db.update(quoteStatusEvents).set({actorId:null}).where(eq(quoteStatusEvents.quoteId,id))).rejects.toThrow();
  await expect(db.delete(quoteStatusEvents).where(eq(quoteStatusEvents.quoteId,id))).rejects.toThrow();
 });
 it('records direct changes without invented attribution and paginates within the selected quote',async()=>{
  const db=(await getDb())!;
  const make=()=>createQuoteRequest({companyName:'History '+randomUUID(),contactName:'Contact',contactEmail:'history@example.com'});
  const {quoteId:id}=await make();const {quoteId:other}=await make();
  for(let i=0;i<55;i++)await db.update(quoteRequests).set({status:i%2?'received':'in_progress'}).where(eq(quoteRequests.id,id));
  await db.update(quoteRequests).set({status:'accepted'}).where(eq(quoteRequests.id,other));
  const first=await getQuoteStatusHistory(id);
  expect(first.entries).toHaveLength(50);expect(first.nextBeforeId).not.toBeNull();
  const second=await getQuoteStatusHistory(id,first.nextBeforeId!);
  expect(second.entries).toHaveLength(5);expect(second.nextBeforeId).toBeNull();
  const all=[...first.entries,...second.entries];
  expect(new Set(all.map(e=>e.id)).size).toBe(55);
  expect(all.every(e=>e.quoteId===id&&e.actorId===null)).toBe(true);
 });
});
