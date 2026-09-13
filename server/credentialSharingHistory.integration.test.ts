import {beforeAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {getDb,surfaceCredentialForPerson,unsurfaceCredentialForPerson} from './db';
import {appRouter} from './routers';
import {users,companies,affiliations,credentials,credentialSharingEvents} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('retained credential sharing history · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 it('paginates only the owner’s immutable history and rolls back sharing or withdrawal when its audit cannot be written',async()=>{
  const db=(await getDb())!;
  const [person,other]=await db.insert(users).values([{openId:randomUUID()},{openId:randomUUID()}]).returning();
  const [org]=await db.insert(companies).values({name:'Original destination'}).returning();
  await db.insert(affiliations).values({personId:person.id,orgId:org.id});
  const caller=(user:typeof person)=>appRouter.createCaller({user,req:{headers:{}},res:{}} as any);
  const proofs=await Promise.all(Array.from({length:26},(_,i)=>surfaceCredentialForPerson(person.id,{orgId:org.id,label:`Proof ${i}`})));
  const first=await caller(person).me.credentialSharingHistory({});expect(first.entries).toHaveLength(25);expect(first.nextCursor).not.toBeNull();
  const second=await caller(person).me.credentialSharingHistory({cursor:first.nextCursor!});expect(second.entries).toHaveLength(1);expect(second.nextCursor).toBeNull();
  expect(new Set([...first.entries,...second.entries].map(e=>e.id)).size).toBe(26);
  expect((await caller(other).me.credentialSharingHistory({cursor:first.nextCursor!})).entries).toEqual([]);
  await db.update(companies).set({name:'Renamed destination'}).where(eq(companies.id,org.id));
  expect((await caller(person).me.credentialSharingHistory({})).entries.every(e=>e.orgName==='Original destination')).toBe(true);
  const event=first.entries[0];
  await expect(db.update(credentialSharingEvents).set({action:'WITHDRAWN'}).where(eq(credentialSharingEvents.id,event.id))).rejects.toThrow();
  await expect(db.delete(credentialSharingEvents).where(eq(credentialSharingEvents.id,event.id))).rejects.toThrow();
  const name='sharing_test_'+randomUUID().replaceAll('-','');
  await db.execute(sql.raw(`create function ${name}() returns trigger language plpgsql as $$ begin if NEW."personId"=${person.id} then raise exception 'synthetic audit failure'; end if; return NEW; end $$`));
  try{
   await db.execute(sql.raw(`create trigger ${name} before insert on credential_sharing_events for each row execute function ${name}()`));
   await expect(unsurfaceCredentialForPerson(person.id,proofs[0]!.id)).rejects.toThrow();
   expect((await db.select().from(credentials).where(eq(credentials.id,proofs[0]!.id)))[0].surfacedByPersonAt).not.toBeNull();
   await expect(surfaceCredentialForPerson(person.id,{orgId:org.id,label:'Must roll back'})).rejects.toThrow();
   expect(await db.select().from(credentials).where(eq(credentials.personId,person.id))).toHaveLength(26);
  }finally{
   await db.execute(sql.raw(`drop trigger if exists ${name} on credential_sharing_events`));await db.execute(sql.raw(`drop function ${name}()`));
  }
  await expect(unsurfaceCredentialForPerson(person.id,proofs[0]!.id)).resolves.toEqual({ok:true});
  const latest=(await caller(person).me.credentialSharingHistory({})).entries[0];
  expect(latest).toMatchObject({action:'WITHDRAWN',credentialId:proofs[0]!.id,personId:person.id,orgName:'Renamed destination',proofLabel:'Proof 0'});
  await expect(db.delete(credentials).where(eq(credentials.id,proofs[0]!.id))).rejects.toThrow();
 });
});
