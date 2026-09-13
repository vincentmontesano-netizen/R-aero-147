import {beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq} from 'drizzle-orm';
import {getDb,getMyQuotes} from './db';
import {users,quoteRequests} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('client quote pages · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 it('filters by current account/email before paging, projects only list fields and keeps cursor pages stable on new arrivals',async()=>{
  const db=(await getDb())!;
  const email=randomUUID()+'@example.com';
  const [owner]=await db.insert(users).values({openId:randomUUID(),email}).returning();
  const [other]=await db.insert(users).values({openId:randomUUID(),email:randomUUID()+'@example.com',role:'admin'}).returning();
  const base={companyName:'Paged '+randomUUID(),contactName:'Private name',contactEmail:email.toUpperCase(),message:'Private message',contactPhone:'Private phone'};
  const rows=await db.insert(quoteRequests).values(Array.from({length:55},(_,i)=>({...base,userId:i%2?owner.id:null,contactEmail:i%2?'different@example.com':base.contactEmail}))).returning();
  const [foreign]=await db.insert(quoteRequests).values({...base,userId:other.id,contactEmail:other.email!}).returning();
  const first=await getMyQuotes(owner.id);
  expect(first.entries.map(q=>q.id)).toEqual(rows.slice().reverse().slice(0,50).map(q=>q.id));
  expect(first.entries.every(q=>Object.keys(q).sort().join(',')==='companyName,createdAt,id,status,trainingTypes')).toBe(true);
  const [arrival]=await db.insert(quoteRequests).values({...base,userId:owner.id}).returning();
  const next=await getMyQuotes(owner.id,{beforeId:first.nextBeforeId});
  expect(next.entries.map(q=>q.id)).toEqual(rows.slice(0,5).reverse().map(q=>q.id));
  expect(next.nextBeforeId).toBeNull();
  expect(new Set([...first.entries,...next.entries].map(q=>q.id)).size).toBe(55);
  expect((await getMyQuotes(owner.id)).entries[0].id).toBe(arrival.id);
  // Admin's personal list must remain personal; admin global listing is a different route.
  expect((await getMyQuotes(other.id)).entries.map(q=>q.id)).toEqual([foreign.id]);
  await db.update(users).set({email:randomUUID()+'@example.com'}).where(eq(users.id,owner.id));
  expect((await getMyQuotes(owner.id)).entries.map(q=>q.id)).toEqual([arrival.id,...rows.filter(q=>q.userId===owner.id).reverse().map(q=>q.id)]);
  for(const input of [{beforeId:0},{beforeId:1.5},{beforeId:2147483648},{email}])await expect(getMyQuotes(owner.id,input)).rejects.toMatchObject({code:'BAD_REQUEST'});
  await db.update(users).set({status:'suspended'}).where(eq(users.id,owner.id));
  await expect(getMyQuotes(owner.id)).rejects.toMatchObject({code:'FORBIDDEN'});
 });
});
