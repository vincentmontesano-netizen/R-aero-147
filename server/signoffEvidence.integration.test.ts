import {beforeAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq} from 'drizzle-orm';
import {getDb,createSignoff,getSignoffsForSubject,unsurfaceCredentialForPerson} from './db';
import {appRouter} from './routers';
import {users,companies,employees,affiliations,trainings,certificates,credentials,signoffs} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('signoff evidence boundary · PostgreSQL',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 it('rejects foreign, private, expired, mismatched and revoked proof before signing',async()=>{
  const db=(await getDb())!;
  const [org]=await db.insert(companies).values({name:'Signoff fixture'}).returning();
  const [manager,holder,outsider]=await db.insert(users).values([{openId:randomUUID(),name:'Manager initial',role:'company_manager',companyId:org.id},{openId:randomUUID(),name:'Holder initial'},{openId:randomUUID()}]).returning();
  const [,holderAff]=await db.insert(affiliations).values([{personId:manager.id,orgId:org.id,role:'MANAGER'},{personId:holder.id,orgId:org.id,role:'MEMBER'}]).returning();
  const [employee]=await db.insert(employees).values({companyId:org.id,userId:holder.id,firstName:'Test',lastName:'Holder',email:`${randomUUID()}@example.test`}).returning();
  const [course]=await db.insert(trainings).values({title:'Signoff course',slug:randomUUID()}).returning();
  const [cert]=await db.insert(certificates).values({userId:holder.id,trainingId:course.id,enrollmentId:-holder.id,certificateNumber:randomUUID(),verificationCode:randomUUID().replaceAll('-',''),isValid:false}).returning();
  const values={affiliationId:holderAff.id,personId:holder.id,trainingId:course.id,state:'LIVING',origin:'INDEPENDENT',surfacedByPersonAt:new Date()};
  const [foreign,hidden,expired,revoked,valid,unknownOrg]=await db.insert(credentials).values([
   {...values,personId:outsider.id},{...values,surfacedByPersonAt:null},{...values,expiresAt:new Date(0)},
   {...values,certificateId:cert.id},{...values},{...values,affiliationId:null,origin:'ORG_ASSIGNED',surfacedByPersonAt:null},
  ]).returning();
  const caller=appRouter.createCaller({user:manager,req:{headers:{}},res:{}} as any);
  for(const [proof,code] of [[foreign,'FORBIDDEN'],[hidden,'FORBIDDEN'],[expired,'PRECONDITION_FAILED'],[revoked,'PRECONDITION_FAILED'],[unknownOrg,'FORBIDDEN']] as const)await expect(caller.company.signoff({requestId:randomUUID(),employeeId:employee.id,credentialId:proof.id,decision:'VALIDATED'})).rejects.toMatchObject({code});
  await expect(caller.company.signoff({requestId:randomUUID(),employeeId:employee.id,credentialId:valid.id,trainingId:course.id+999999})).rejects.toMatchObject({code:'BAD_REQUEST'});
  expect(await db.select().from(signoffs).where(eq(signoffs.subjectPersonId,holder.id))).toHaveLength(0);
  await caller.company.technicianFile({employeeId:employee.id});
  for(const proof of [expired,revoked,valid])expect((await db.select().from(credentials).where(eq(credentials.id,proof.id)))[0].lockedInOrgViewUntil).toBeNull();
  const request={requestId:randomUUID(),employeeId:employee.id,credentialId:valid.id,decision:'VALIDATED' as const,note:'Assessment fixture'};
  const [signed,retried]=await Promise.all([caller.company.signoff(request),caller.company.signoff(request)]);
  expect(retried?.id).toBe(signed?.id);
  await expect(caller.company.signoff({...request,note:'Different decision'})).rejects.toMatchObject({code:'CONFLICT'});
  expect(signed).toMatchObject({credentialId:valid.id,trainingId:course.id,subjectPersonId:holder.id,managerPersonId:manager.id});
  const rejected=await caller.company.signoff({requestId:randomUUID(),employeeId:employee.id,credentialId:revoked.id,decision:'REJECTED',note:'Certificate revoked'});
  expect(rejected?.decision).toBe('REJECTED');
  expect(signed?.snapshot).toMatchObject({managerName:'Manager initial',subjectName:'Holder initial',trainingTitle:'Signoff course',proof:{id:valid.id,state:'LIVING'}});
  expect(rejected?.snapshot?.proof?.certificate?.status).toBe('revoked');
  await db.update(users).set({name:'Renamed manager'}).where(eq(users.id,manager.id));
  await db.update(trainings).set({title:'Renamed course'}).where(eq(trainings.id,course.id));
  await db.update(certificates).set({isValid:true}).where(eq(certificates.id,cert.id));
  expect((await caller.company.signoff(request))?.snapshot).toEqual(signed?.snapshot);
  const history=await getSignoffsForSubject(holder.id,org.id);
  expect(history.find(row=>row.id===signed!.id)).toMatchObject({managerName:'Manager initial',trainingTitle:'Signoff course'});
  expect(history.find(row=>row.id===rejected!.id)?.snapshot?.proof?.certificate?.status).toBe('revoked');
  await expect(db.update(signoffs).set({note:'Rewritten'}).where(eq(signoffs.id,signed!.id))).rejects.toThrow();
  await expect(db.delete(signoffs).where(eq(signoffs.id,signed!.id))).rejects.toThrow();
  expect((await db.select().from(credentials).where(eq(credentials.id,valid.id)))[0].lockedInOrgViewUntil).not.toBeNull();
  for(const untouched of [expired,revoked])expect((await db.select().from(credentials).where(eq(credentials.id,untouched.id)))[0].lockedInOrgViewUntil).toBeNull();
  await expect(unsurfaceCredentialForPerson(holder.id,valid.id)).resolves.toEqual({ok:false,reason:'locked'});
  await expect(unsurfaceCredentialForPerson(outsider.id,revoked.id)).resolves.toEqual({ok:false,reason:'not_found'});
  await expect(unsurfaceCredentialForPerson(holder.id,revoked.id)).resolves.toEqual({ok:true});
  expect((await db.select().from(credentials).where(eq(credentials.id,revoked.id)))[0]).toMatchObject({surfacedByPersonAt:null,certificateId:cert.id});
  expect((await getSignoffsForSubject(holder.id,org.id)).find(row=>row.id===rejected!.id)?.snapshot?.proof?.certificate?.status).toBe('revoked');
  await expect(caller.company.signoff({requestId:randomUUID(),employeeId:employee.id,credentialId:revoked.id,decision:'VALIDATED'})).rejects.toMatchObject({code:'FORBIDDEN'});
  const [racingProof]=await db.insert(credentials).values(values).returning();
  const [raceSign,raceWithdrawal]=await Promise.allSettled([
   caller.company.signoff({requestId:randomUUID(),employeeId:employee.id,credentialId:racingProof.id,decision:'VALIDATED'}),
   unsurfaceCredentialForPerson(holder.id,racingProof.id),
  ]);
  const [raceStored]=await db.select().from(credentials).where(eq(credentials.id,racingProof.id));
  if(raceSign.status==='fulfilled'){
   expect(raceWithdrawal).toMatchObject({status:'fulfilled',value:{ok:false,reason:'locked'}});
   expect(raceStored.surfacedByPersonAt).not.toBeNull();
   expect(raceStored.lockedInOrgViewUntil).not.toBeNull();
  }else{
   expect(raceSign.reason).toMatchObject({code:'FORBIDDEN'});
   expect(raceWithdrawal).toMatchObject({status:'fulfilled',value:{ok:true}});
   expect(raceStored.surfacedByPersonAt).toBeNull();
   expect(raceStored.lockedInOrgViewUntil).toBeNull();
  }
  const staleRequest={requestId:randomUUID(),employeeId:employee.id,managerPersonId:manager.id,subjectPersonId:holder.id,orgId:org.id,credentialId:valid.id};
  await db.update(affiliations).set({role:'MEMBER'}).where(eq(affiliations.personId,manager.id));
  await expect(createSignoff(staleRequest)).rejects.toMatchObject({code:'FORBIDDEN'});
  await db.update(affiliations).set({role:'MANAGER'}).where(eq(affiliations.personId,manager.id));
  await db.update(employees).set({isActive:false}).where(eq(employees.id,employee.id));
  await expect(createSignoff(staleRequest)).rejects.toMatchObject({code:'FORBIDDEN'});
  await db.update(employees).set({isActive:true}).where(eq(employees.id,employee.id));
  await db.update(users).set({status:'suspended'}).where(eq(users.id,holder.id));
  await expect(createSignoff(staleRequest)).rejects.toMatchObject({code:'FORBIDDEN'});
  await db.update(users).set({status:'active'}).where(eq(users.id,holder.id));
  await db.update(affiliations).set({status:'INACTIVE'}).where(eq(affiliations.personId,holder.id));
  await expect(createSignoff(staleRequest)).rejects.toMatchObject({code:'FORBIDDEN'});
  expect(await db.select().from(signoffs).where(eq(signoffs.subjectPersonId,holder.id))).toHaveLength(raceSign.status==='fulfilled'?3:2);
 });
});
