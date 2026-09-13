import {verifyCertificateBytes} from "./certificateArchive";
import {afterEach,beforeAll,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import QRCode from 'qrcode';
import {getDb,getAdminComplianceReport,createCredentialForIssuedCertificate,getCertificateByCode,getUserCertificates,getUserEnrollments} from './db';
import {users,trainings,enrollments,quizAttempts,certificates,credentials,certificateObjectives,learningObjectives,certificateArchives,trainingVersions} from '../drizzle/schema';
import {issueCertificate} from './certificate';
import {storagePut} from './storage';
vi.mock('./storage',()=>({storagePut:vi.fn(async(key:string)=>({key,url:`/storage/${key}`}))}));
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('certificate canonical links · PostgreSQL',()=>{
  beforeAll(()=>{process.env.DATABASE_URL=url!;});
  afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();vi.mocked(storagePut).mockClear();});
  async function fixture(){
    const db=(await getDb())!;
    const [user]=await db.insert(users).values({openId:randomUUID(),name:'SPECIMEN'}).returning();
    const [course]=await db.insert(trainings).values({title:'SPECIMEN sans valeur',slug:randomUUID()}).returning();
    const [enrollment]=await db.insert(enrollments).values({userId:user.id,trainingId:course.id,status:'completed',completedAt:new Date()}).returning();
    await db.insert(quizAttempts).values({userId:user.id,trainingId:course.id,enrollmentId:enrollment.id,isPassed:true,score:1,maxScore:1});
    return {db,enrollment};
  }
  it('lists only the holder documents with archive, pinned version and legacy title precedence',async()=>{
    const f=await fixture(), other=await fixture();
    const [course]=await f.db.select().from(trainings).where(eq(trainings.id,f.enrollment.trainingId));
    const [version]=await f.db.insert(trainingVersions).values({trainingId:course.id,version:1,snapshot:{training:{...course,title:'PINNED_TITLE'},modules:[],questions:[],slides:[],objectives:[]}}).returning();
    const [legacy]=await f.db.insert(enrollments).values({userId:f.enrollment.userId,trainingId:course.id}).returning();
    await f.db.update(trainings).set({publishedVersionId:version.id}).where(eq(trainings.id,course.id));
    const [pinned]=await f.db.insert(enrollments).values({userId:f.enrollment.userId,trainingId:course.id}).returning();
    expect(pinned.trainingVersionId).toBe(version.id);
    const issuedAt=new Date();
    const created=await f.db.insert(certificates).values([f.enrollment,pinned,legacy,other.enrollment].map(enrollment=>({
      enrollmentId:enrollment.id,userId:enrollment.userId,trainingId:enrollment.trainingId,certificateNumber:randomUUID(),verificationCode:randomUUID().replaceAll('-',''),issuedAt,
    }))).returning();
    await f.db.insert(certificateArchives).values({certificateId:created[0].id,storageKey:`certificates/${randomUUID()}.pdf`,sha256:'0'.repeat(64),byteSize:1,
      snapshot:{learnerName:'SPECIMEN',training:{title:'ARCHIVED_TITLE',part147Reference:null,durationHours:null},completedAt:issuedAt.toISOString(),trainingVersionId:null,passedAttemptId:1,verificationUrl:'https://example.test/verification/specimen',objectives:[]}});
    await f.db.update(trainings).set({title:'CURRENT_TITLE'}).where(eq(trainings.id,course.id));
    const result=await getUserCertificates(f.enrollment.userId);
    expect(result.map(row=>row.id)).toEqual([created[2].id,created[1].id,created[0].id]);
    expect(result.map(row=>row.training?.title)).toEqual(['CURRENT_TITLE','PINNED_TITLE','ARCHIVED_TITLE']);
    expect(result.every(row=>row.userId===f.enrollment.userId)).toBe(true);
    expect(result.every(row=>!('versionTraining' in row)&&!('archivedTraining' in row)&&!('snapshot' in row))).toBe(true);
    const enrolled=await getUserEnrollments(f.enrollment.userId);
    expect(enrolled).toHaveLength(3);
    expect(enrolled.find(row=>row.id===pinned.id)?.training?.title).toBe('PINNED_TITLE');
    expect(enrolled.find(row=>row.id===legacy.id)?.training?.title).toBe('CURRENT_TITLE');
    expect(enrolled.every(row=>row.userId===f.enrollment.userId&&!('versionTraining' in row)&&!('snapshot' in row))).toBe(true);
  });

  it('encodes only the configured origin and returns an existing document without regenerating',async()=>{
    const f=await fixture();vi.stubEnv('NODE_ENV','production');vi.stubEnv('PUBLIC_APP_URL','https://academy.example.test');
    const qr=vi.spyOn(QRCode,'toDataURL');
    const issued=await issueCertificate(f.enrollment.id,'https://attacker.example.test');
    expect(issued).not.toBeNull();expect(qr.mock.calls[0][0]).toBe(`https://academy.example.test/verification/${issued!.verificationCode}`);
    expect(storagePut).toHaveBeenCalledTimes(1);
    vi.stubEnv('PUBLIC_APP_URL','');vi.stubEnv('APP_ORIGIN','');
    expect(await issueCertificate(f.enrollment.id,'https://other.example.test')).toEqual(issued);
    expect(qr).toHaveBeenCalledTimes(1);
  });
  it('refuses a missing or unsafe production origin before writing a new certificate',async()=>{
    const f=await fixture();vi.stubEnv('NODE_ENV','production');vi.stubEnv('APP_ORIGIN','');
    for(const origin of ['', 'http://localhost:3000','https://name:secret@example.test','https://example.test/path']){
      vi.stubEnv('PUBLIC_APP_URL',origin);
      await expect(issueCertificate(f.enrollment.id,'https://browser.example.test')).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
    }
    expect(storagePut).not.toHaveBeenCalled();
    expect(await f.db.select().from(certificates).where(eq(certificates.enrollmentId,f.enrollment.id))).toHaveLength(0);
  });
  it('serializes concurrent issuance with one certificate, objective mapping and credential',async()=>{
    const f=await fixture();vi.stubEnv('PUBLIC_APP_URL','https://academy.example.test');
    const [objective]=await f.db.insert(learningObjectives).values({trainingId:f.enrollment.trainingId,title:'Test objective'}).returning();
    const results=await Promise.all([issueCertificate(f.enrollment.id),issueCertificate(f.enrollment.id),issueCertificate(f.enrollment.id)]);
    expect(results[0]).not.toBeNull();expect(results[1]).toEqual(results[0]);expect(results[2]).toEqual(results[0]);expect(storagePut).toHaveBeenCalledTimes(1);
    const rows=await f.db.select().from(certificates).where(eq(certificates.enrollmentId,f.enrollment.id));expect(rows).toHaveLength(1);
    expect(await f.db.select().from(certificateObjectives).where(eq(certificateObjectives.certificateId,rows[0].id))).toHaveLength(1);
    const proofs=await f.db.select().from(credentials).where(eq(credentials.certificateId,rows[0].id));expect(proofs).toHaveLength(1);expect(proofs[0].part66Coverage).toEqual([objective.id]);
  });
  it('rolls back certificate and objectives on a credential SQL failure and allows a complete retry',async()=>{
    const f=await fixture();vi.stubEnv('PUBLIC_APP_URL','https://academy.example.test');
    const [objective]=await f.db.insert(learningObjectives).values({trainingId:f.enrollment.trainingId,title:'Rollback objective'}).returning();
    const name='certificate_test_'+randomUUID().replaceAll('-','');
    await f.db.execute(sql.raw(`create function ${name}() returns trigger language plpgsql as $$ begin if NEW."personId"=${f.enrollment.userId} then raise exception 'synthetic credential failure'; end if; return NEW; end $$`));
    try{
      await f.db.execute(sql.raw(`create trigger ${name} before insert on credentials for each row execute function ${name}()`));
      await expect(issueCertificate(f.enrollment.id)).rejects.toMatchObject({cause:{message:'synthetic credential failure'}});
      expect(await f.db.select().from(certificates).where(eq(certificates.enrollmentId,f.enrollment.id))).toHaveLength(0);
      expect(await f.db.select().from(certificateObjectives).where(eq(certificateObjectives.objectiveId,objective.id))).toHaveLength(0);
      expect(await f.db.select().from(credentials).where(eq(credentials.personId,f.enrollment.userId))).toHaveLength(0);
      expect(await f.db.select().from(certificateArchives).where(sql`${certificateArchives.snapshot}->>'passedAttemptId' = (select id::text from quiz_attempts where \"enrollmentId\"=${f.enrollment.id} limit 1)`)).toHaveLength(0);
    }finally{await f.db.execute(sql.raw(`drop trigger if exists ${name} on credentials`));await f.db.execute(sql.raw(`drop function ${name}()`));}
    expect(await issueCertificate(f.enrollment.id)).not.toBeNull();
    expect(await f.db.select().from(certificates).where(eq(certificates.enrollmentId,f.enrollment.id))).toHaveLength(1);
    expect(await f.db.select().from(credentials).where(eq(credentials.personId,f.enrollment.userId))).toHaveLength(1);
  });

  it('serializes concurrent creation of a missing historical credential',async()=>{
    const f=await fixture();
    const [certificate]=await f.db.insert(certificates).values({enrollmentId:f.enrollment.id,userId:f.enrollment.userId,trainingId:f.enrollment.trainingId,certificateNumber:randomUUID(),verificationCode:randomUUID().replaceAll('-','')}).returning();
    const [a,b]=await Promise.all([createCredentialForIssuedCertificate(certificate.id),createCredentialForIssuedCertificate(certificate.id)]);
    expect(a?.id).toBe(b?.id);expect(a).not.toBeNull();
    expect(await f.db.select().from(credentials).where(eq(credentials.certificateId,certificate.id))).toHaveLength(1);
  });

  it('retains issued identity and PDF integrity after profile/catalogue changes',async()=>{
    const f=await fixture();vi.stubEnv('PUBLIC_APP_URL','https://academy.example.test');
    await f.db.update(enrollments).set({completedAt:new Date('2032-02-29T12:00:00Z')}).where(eq(enrollments.id,f.enrollment.id));
    await f.db.update(trainings).set({recurrencyMonths:12}).where(eq(trainings.id,f.enrollment.trainingId));
    const result=(await issueCertificate(f.enrollment.id))!;
    const [cert]=await f.db.select().from(certificates).where(eq(certificates.enrollmentId,f.enrollment.id));
    const [archive]=await f.db.select().from(certificateArchives).where(eq(certificateArchives.certificateId,cert.id));
    expect(cert.expiresAt?.toISOString()).toBe('2033-02-28T12:00:00.000Z');
    expect(archive.snapshot).toMatchObject({learnerName:'SPECIMEN',training:{title:'SPECIMEN sans valeur'},trainingVersionId:null});
    expect(archive.snapshot.passedAttemptId).toBeGreaterThan(0);
    const bytes=vi.mocked(storagePut).mock.calls[0][1] as Buffer;
    expect(await verifyCertificateBytes(archive.storageKey,bytes)).toBe(true);
    expect(await verifyCertificateBytes(archive.storageKey,Buffer.from('modified'))).toBe(false);
    await f.db.update(users).set({name:'Changed holder'}).where(eq(users.id,f.enrollment.userId));
    await f.db.update(trainings).set({title:'Changed course'}).where(eq(trainings.id,f.enrollment.trainingId));
    const publicResult=await getCertificateByCode(result.verificationCode);
    expect(publicResult?.user?.name).toBe('SPECIMEN');expect(publicResult?.training?.title).toBe('SPECIMEN sans valeur');
    expect((await getUserCertificates(f.enrollment.userId))[0].training?.title).toBe('SPECIMEN sans valeur');
    const [reportAdmin]=await f.db.insert(users).values({openId:randomUUID(),role:'admin'}).returning();
    expect((await getAdminComplianceReport(reportAdmin.id,f.enrollment.id+1)).entries.find(r=>r.enrollmentId===f.enrollment.id)).toMatchObject({userName:'Changed holder',trainingTitle:'SPECIMEN sans valeur',certificateHolderName:'SPECIMEN',certificateStatus:'valid'});
    await expect(f.db.update(certificates).set({pdfUrl:'/storage/certificates/other.pdf'}).where(eq(certificates.id,cert.id))).rejects.toThrow();
    await expect(f.db.update(certificateArchives).set({sha256:'changed'}).where(eq(certificateArchives.certificateId,cert.id))).rejects.toThrow();
    await expect(f.db.delete(certificateArchives).where(eq(certificateArchives.certificateId,cert.id))).rejects.toThrow();
    await expect(f.db.delete(certificates).where(eq(certificates.id,cert.id))).rejects.toThrow();
    await f.db.update(certificates).set({isValid:false}).where(eq(certificates.id,cert.id));
    expect((await getCertificateByCode(result.verificationCode))?.status).toBe('revoked');
  });

  it('does not invent a completion date when the historical record is incomplete',async()=>{
    const f=await fixture();vi.stubEnv('PUBLIC_APP_URL','https://academy.example.test');
    await f.db.update(enrollments).set({completedAt:null}).where(eq(enrollments.id,f.enrollment.id));
    await expect(issueCertificate(f.enrollment.id)).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
    expect(storagePut).not.toHaveBeenCalled();
  });

  it('archives the pinned training language and never regenerates an issued certificate after a language change',async()=>{
    const f=await fixture();vi.stubEnv('PUBLIC_APP_URL','https://academy.example.test');
    const [course]=await f.db.select().from(trainings).where(eq(trainings.id,f.enrollment.trainingId));
    const [version]=await f.db.insert(trainingVersions).values({trainingId:course.id,version:1,snapshot:{training:{...course,language:'ar'},modules:[],questions:[],slides:[],objectives:[]}}).returning();
    await f.db.update(trainings).set({publishedVersionId:version.id,language:'en'}).where(eq(trainings.id,course.id));
    const [enrollment]=await f.db.insert(enrollments).values({userId:f.enrollment.userId,trainingId:course.id,status:'completed',completedAt:new Date()}).returning();
    await f.db.insert(quizAttempts).values({userId:enrollment.userId,trainingId:course.id,enrollmentId:enrollment.id,isPassed:true,score:1,maxScore:1});
    const result=await issueCertificate(enrollment.id);
    const [certificate]=await f.db.select().from(certificates).where(eq(certificates.enrollmentId,enrollment.id));
    const [archive]=await f.db.select().from(certificateArchives).where(eq(certificateArchives.certificateId,certificate.id));
    expect(archive.snapshot).toMatchObject({language:'ar',trainingVersionId:version.id});
    await f.db.update(trainings).set({language:'fr'}).where(eq(trainings.id,course.id));
    vi.mocked(storagePut).mockClear();expect(await issueCertificate(enrollment.id)).toEqual(result);expect(storagePut).not.toHaveBeenCalled();
    expect((await f.db.select().from(certificateArchives).where(eq(certificateArchives.certificateId,certificate.id)))[0].snapshot.language).toBe('ar');
  });
  it('refuses an existing certificate with an inconsistent enrollment identity',async()=>{
    const f=await fixture();
    const [other]=await f.db.insert(users).values({openId:randomUUID()}).returning();
    await f.db.insert(certificates).values({enrollmentId:f.enrollment.id,userId:other.id,trainingId:f.enrollment.trainingId,certificateNumber:randomUUID(),verificationCode:randomUUID().replaceAll('-','')});
    await expect(issueCertificate(f.enrollment.id)).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
    expect(storagePut).not.toHaveBeenCalled();
  });

});
