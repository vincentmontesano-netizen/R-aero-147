import {beforeAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq} from 'drizzle-orm';
import {getDb,getCertificateByCode} from './db';
import {users,certificates,certificateRevocations} from '../drizzle/schema';
import {appRouter} from './routers';
import {revokeCertificate} from './certificateRevocation';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('audited certificate revocation · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 async function fixture(){
  const db=(await getDb())!;
  const [admin]=await db.insert(users).values({openId:randomUUID(),name:'Test administrator',role:'admin'}).returning();
  const [holder]=await db.insert(users).values({openId:randomUUID(),name:'Test holder',role:'user'}).returning();
  const [cert]=await db.insert(certificates).values({enrollmentId:-holder.id,userId:holder.id,trainingId:999999,certificateNumber:randomUUID(),verificationCode:randomUUID().replaceAll('-',''),pdfUrl:'/storage/certificates/retained-test.pdf'}).returning();
  const caller=(user:typeof admin)=>appRouter.createCaller({user,req:{headers:{},ip:'127.0.0.1'},res:{}} as any);
  return {db,admin,holder,cert,caller};
 }
 it('records one immutable reason under concurrent requests and retains the document',async()=>{
  const f=await fixture(),caller=f.caller(f.admin),input={certificateNumber:f.cert.certificateNumber,reason:'Test evidence invalidated'};
  await Promise.all([caller.admin.revokeCertificate(input),caller.admin.revokeCertificate({...input,reason:'Another test reason'})]);
  const events=await f.db.select().from(certificateRevocations).where(eq(certificateRevocations.certificateId,f.cert.id));
  expect(events).toHaveLength(1);expect(events[0].actorId).toBe(f.admin.id);
  const detail=await caller.admin.certificate({number:f.cert.certificateNumber});
  expect(detail?.status).toBe('revoked');expect(detail?.revocation?.reason).toBe(events[0].reason);
  expect((await getCertificateByCode(f.cert.verificationCode))?.status).toBe('revoked');
  expect((await f.db.select().from(certificates).where(eq(certificates.id,f.cert.id)))[0].pdfUrl).toBe(f.cert.pdfUrl);
  await expect(f.db.update(certificates).set({isValid:true}).where(eq(certificates.id,f.cert.id))).rejects.toThrow();
  await expect(f.db.update(certificateRevocations).set({reason:'Rewritten reason'}).where(eq(certificateRevocations.certificateId,f.cert.id))).rejects.toThrow();
  await expect(f.db.delete(certificateRevocations).where(eq(certificateRevocations.certificateId,f.cert.id))).rejects.toThrow();
 });
 it('rejects non-admins, suspended admins and short reasons without inventing legacy audit history',async()=>{
  const f=await fixture(),input={certificateNumber:f.cert.certificateNumber,reason:'Test revocation reason'};
  await expect(f.caller(f.holder).admin.revokeCertificate(input)).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(f.caller(f.holder).admin.certificate({number:f.cert.certificateNumber})).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(f.caller(f.admin).admin.revokeCertificate({...input,reason:'short'})).rejects.toMatchObject({code:'BAD_REQUEST'});
  await f.db.update(users).set({status:'suspended'}).where(eq(users.id,f.admin.id));
  await expect(revokeCertificate(f.admin.id,input)).rejects.toMatchObject({code:'FORBIDDEN'});
  expect(await f.db.select().from(certificateRevocations).where(eq(certificateRevocations.certificateId,f.cert.id))).toHaveLength(0);
  await f.db.update(users).set({status:'active'}).where(eq(users.id,f.admin.id));
  await f.db.update(certificates).set({isValid:false}).where(eq(certificates.id,f.cert.id));
  expect(await revokeCertificate(f.admin.id,input)).toEqual({revoked:true,alreadyRevoked:true});
  expect((await f.caller(f.admin).admin.certificate({number:f.cert.certificateNumber}))?.revocation).toBeNull();
 });
});
