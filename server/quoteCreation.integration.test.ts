import {beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq} from 'drizzle-orm';
import {getDb,createQuoteRequest} from './db';
import {quoteRequests,quoteCreationRequests,users} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('quote persistence · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 it('returns the persisted reference, retains normalized input and rejects invalid direct calls before writing',async()=>{
  const db=(await getDb())!;
  const [user]=await db.insert(users).values({openId:randomUUID()}).returning();
  const companyName=`Quote ${randomUUID()}`;
  const data={companyName:` ${companyName} `,contactName:' Contact ',contactEmail:' contact@example.com ',employeeCount:12,userId:user.id};
  for(const patch of [{employeeCount:0},{companyId:1},{status:'accepted'},{contactName:''}])await expect(createQuoteRequest({...data,...patch})).rejects.toMatchObject({code:'BAD_REQUEST'});
  expect(await db.select().from(quoteRequests).where(eq(quoteRequests.userId,user.id))).toHaveLength(0);
  const result=await createQuoteRequest(data);
  expect(result.success).toBe(true);
  const [row]=await db.select().from(quoteRequests).where(eq(quoteRequests.id,result.quoteId));
  expect(row).toMatchObject({companyName,contactName:'Contact',contactEmail:'contact@example.com',employeeCount:12,userId:user.id,status:'received'});
  const anonymous=await createQuoteRequest({companyName,contactName:'Contact',contactEmail:'anonymous@example.com'});
  expect((await db.select().from(quoteRequests).where(eq(quoteRequests.id,anonymous.quoteId)))[0].userId).toBeNull();
 });
 it('serializes simultaneous retries, binds the original payload and actor, and preserves later quote changes',async()=>{
  const db=(await getDb())!;
  const requestId=randomUUID();
  const data={requestId,companyName:`Retry ${randomUUID()}`,contactName:'Contact',contactEmail:'retry@example.com'};
  const results=await Promise.all(Array.from({length:5},()=>createQuoteRequest(data)));
  expect(new Set(results.map(r=>r.quoteId)).size).toBe(1);
  expect(results.filter(r=>!r.replayed)).toHaveLength(1);
  const quoteId=results[0].quoteId;
  expect(await db.select().from(quoteRequests).where(eq(quoteRequests.companyName,data.companyName))).toHaveLength(1);
  await db.update(quoteRequests).set({status:'in_progress'}).where(eq(quoteRequests.id,quoteId));
  const replay=await createQuoteRequest({contactEmail:data.contactEmail,contactName:' Contact ',companyName:data.companyName,requestId:requestId.toUpperCase()});
  expect(replay).toMatchObject({quoteId,replayed:true});
  expect((await db.select().from(quoteRequests).where(eq(quoteRequests.id,quoteId)))[0].status).toBe('in_progress');
  const [user]=await db.insert(users).values({openId:randomUUID()}).returning();
  for(const patch of [{message:'changed'},{userId:user.id}]) await expect(createQuoteRequest({...data,...patch})).rejects.toMatchObject({code:'CONFLICT'});
  await expect(db.update(quoteCreationRequests).set({fingerprint:'x'.repeat(64)}).where(eq(quoteCreationRequests.requestId,requestId))).rejects.toThrow();
  await expect(db.delete(quoteCreationRequests).where(eq(quoteCreationRequests.requestId,requestId))).rejects.toThrow();
  expect((await db.select().from(quoteCreationRequests).where(eq(quoteCreationRequests.requestId,requestId)))[0].quoteId).toBe(quoteId);
 });

});
