import {canReadPrivateFile} from './storageAccess';
import {requireEnrollment} from './learningAccess';
import {registerForSession,registerForWebinar} from './admissions';
import {beforeAll,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {getDb,erasePerson,surfaceCredentialForPerson} from './db';
import {hashPassword} from './auth';
import {appRouter} from './routers';
import {users,companies,employees,affiliations,credentials,credentialSharingEvents,accountClosures,quizAttempts,examSessions,certificates,trainings,enrollments,sessions,webinars} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('atomic profile closure with retained evidence · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 async function fixture(){
  const db=(await getDb())!,password='Synthetic closure password 102!';
  const [person]=await db.insert(users).values({openId:randomUUID(),email:`${randomUUID()}@example.test`,name:'Original identity',firstName:'First',lastName:'Last',bio:'Private biography',passwordHash:await hashPassword(password),passportShared:true,resetToken:'fixture'}).returning();
  const [org]=await db.insert(companies).values({name:'Closure company'}).returning();
  const [employee]=await db.insert(employees).values({userId:person.id,companyId:org.id,firstName:'First',lastName:'Last',email:`${randomUUID()}@example.test`}).returning();
  const [aff]=await db.insert(affiliations).values({personId:person.id,orgId:org.id,employeeId:employee.id}).returning();
  const proof=await surfaceCredentialForPerson(person.id,{orgId:org.id,label:'Retained shared proof'});
  return {db,person,org,employee,aff,proof:proof!,password};
 }
 it('reauthenticates, retains exams and proofs, revokes sessions and prevents reactivation',async()=>{
  const f=await fixture();
  const [attempt]=await f.db.insert(quizAttempts).values({userId:f.person.id,enrollmentId:-f.person.id,trainingId:-f.person.id,score:1,maxScore:1}).returning();
  const [exam]=await f.db.insert(examSessions).values({userId:f.person.id,enrollmentId:-f.person.id,trainingId:-f.person.id,expiresAt:new Date(Date.now()+60000)}).returning();
  const [course]=await f.db.insert(trainings).values({title:'Closure access',slug:randomUUID(),isPublished:true}).returning();
  const [enrollment]=await f.db.insert(enrollments).values({userId:f.person.id,trainingId:course.id}).returning();
  const key=`certificates/closure-${randomUUID()}.pdf`;
  await f.db.insert(certificates).values({userId:f.person.id,trainingId:course.id,enrollmentId:enrollment.id,certificateNumber:randomUUID(),verificationCode:randomUUID().replaceAll('-',''),pdfUrl:`/storage/${key}`});
  const [session]=await f.db.insert(sessions).values({title:'After closure',startDate:new Date(Date.now()+86400000),seats:10}).returning();
  const [webinar]=await f.db.insert(webinars).values({title:'After closure',scheduledAt:new Date(Date.now()+86400000),maxParticipants:10}).returning();
  expect(await canReadPrivateFile(key,f.person)).toBe(true);
  await expect(requireEnrollment(f.person.id,enrollment.id)).resolves.toMatchObject({id:enrollment.id});
  const clearCookie=vi.fn();const caller=appRouter.createCaller({user:f.person,req:{headers:{}},res:{clearCookie}} as any);
  await expect(caller.me.eraseAccount({password:'Wrong password'})).rejects.toMatchObject({code:'FORBIDDEN'});
  expect((await f.db.select().from(users).where(eq(users.id,f.person.id)))[0].status).toBe('active');
  expect(await caller.me.eraseAccount({password:f.password})).toEqual({closed:true,retainedCredentials:1});expect(clearCookie).toHaveBeenCalled();
  expect(await canReadPrivateFile(key,f.person)).toBe(false);
  await expect(requireEnrollment(f.person.id,enrollment.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(registerForSession(f.person.id,session.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(registerForWebinar(f.person.id,webinar.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  const [closed]=await f.db.select().from(users).where(eq(users.id,f.person.id));
  expect(closed).toMatchObject({status:'suspended',name:'Compte fermé',firstName:null,lastName:null,bio:null,email:null,passwordHash:null,resetToken:null,passportShared:false});expect(closed.sessionVersion).toBeGreaterThan(f.person.sessionVersion);
  expect((await f.db.select().from(credentials).where(eq(credentials.id,f.proof.id)))[0]).toMatchObject({state:'FROZEN',controller:'PERSON',affiliationId:f.aff.id});
  expect(await f.db.select().from(credentialSharingEvents).where(eq(credentialSharingEvents.personId,f.person.id))).toHaveLength(1);
  expect((await f.db.select().from(quizAttempts).where(eq(quizAttempts.id,attempt.id)))[0]).toEqual(attempt);
  expect((await f.db.select().from(examSessions).where(eq(examSessions.id,exam.id)))[0]).toEqual(exam);
  expect((await f.db.select().from(affiliations).where(eq(affiliations.id,f.aff.id)))[0].status).toBe('INACTIVE');
  expect((await f.db.select().from(employees).where(eq(employees.id,f.employee.id)))[0].userId).toBeNull();
  expect((await f.db.select().from(accountClosures).where(eq(accountClosures.personId,f.person.id)))[0]).toMatchObject({actorId:f.person.id,retainedCredentials:1});
  await expect(f.db.update(users).set({status:'active'}).where(eq(users.id,f.person.id))).rejects.toThrow();
  await expect(f.db.delete(accountClosures).where(eq(accountClosures.personId,f.person.id))).rejects.toThrow();
 });
 it('rolls back every profile and proof change on a closure journal failure',async()=>{
  const f=await fixture(),name='closure_test_'+randomUUID().replaceAll('-','');
  await f.db.execute(sql.raw(`create function ${name}() returns trigger language plpgsql as $$ begin if NEW."personId"=${f.person.id} then raise exception 'synthetic closure failure'; end if; return NEW; end $$`));
  try{
   await f.db.execute(sql.raw(`create trigger ${name} before insert on account_closures for each row execute function ${name}()`));
   await expect(erasePerson(f.person.id,f.person.id,f.password)).rejects.toThrow();
   expect((await f.db.select().from(users).where(eq(users.id,f.person.id)))[0]).toEqual(f.person);
   expect((await f.db.select().from(credentials).where(eq(credentials.id,f.proof.id)))[0]).toEqual(f.proof);
   expect((await f.db.select().from(affiliations).where(eq(affiliations.id,f.aff.id)))[0]).toEqual(f.aff);
   expect(await f.db.select().from(accountClosures).where(eq(accountClosures.personId,f.person.id))).toHaveLength(0);
  }finally{await f.db.execute(sql.raw(`drop trigger if exists ${name} on account_closures`));await f.db.execute(sql.raw(`drop function ${name}()`));}
 });
 it('rechecks the acting administrator and permits only one of two mutually closing administrators',async()=>{
  const db=(await getDb())!;const [a,b,outsider]=await db.insert(users).values([{openId:randomUUID(),role:'admin'},{openId:randomUUID(),role:'admin'},{openId:randomUUID()}]).returning();
  await expect(erasePerson(a.id,outsider.id)).rejects.toMatchObject({code:'FORBIDDEN'});
  const results=await Promise.allSettled([erasePerson(b.id,a.id),erasePerson(a.id,b.id)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
 });
});
