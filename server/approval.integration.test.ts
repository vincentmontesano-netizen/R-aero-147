import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { approvalRouter } from "./approval";
import { approvalDocuments, approvalEvents, users } from "../drizzle/schema";
import { canReadPrivateFile } from "./storageAccess";
import type { TrpcContext } from "./_core/context";

const url = process.env.RAERO_TEST_DATABASE_URL;
describe("approval API permissions", () => {
  it.each([null, "user", "instructor", "company_manager"])("blocks non-admin role %s", async role => {
    const caller = approvalRouter.createCaller({ user: role ? { id: 900, role, status: "active" } : null } as TrpcContext);
    await expect(caller.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.setStatus({ status: "approved", reason: "Test reason" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
describe.skipIf(!url)("approval register · PostgreSQL", () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  async function fixture() {
    const db = (await getDb())!;
    const [author, reviewer, learner] = await db.insert(users).values(["admin", "admin", "user"].map(role => ({ openId: randomUUID(), name: `Approval test ${role}`, role: role as "admin" | "user" }))).returning();
    const caller = approvalRouter.createCaller({ user: author } as TrpcContext);
    const checker = approvalRouter.createCaller({ user: reviewer } as TrpcContext);
    const profile = { legalName: "Test training organisation", authority: "Test authority", reference: "TEST.147.0001", scope: "Test theoretical course scope", locations: "Test training site", accountableManagerId: author.id, trainingManagerId: author.id, qualityManagerId: reviewer.id };
    return { db, author, reviewer, learner, caller, checker, profile };
  }
  const fileInput = { title: "Test documentary evidence", revision: "1", fileName: "proof.pdf", contentType: "application/pdf" as const, dataBase64: Buffer.from("%PDF-1.4\nTest fixture").toString("base64") };
  it('recovers concurrent uploads and refuses changed requests or revoked admins',async()=>{
    const {db,caller,author}=await fixture();
    const input={...fileInput,kind:'mtoe' as const,requestId:randomUUID()};
    const results=await Promise.all([caller.upload(input),caller.upload(input),caller.upload({...input,requestId:input.requestId.toUpperCase()})]);
    expect(new Set(results.map(r=>r.id)).size).toBe(1);
    expect(await db.select().from(approvalDocuments).where(eq(approvalDocuments.uploadedBy,author.id))).toHaveLength(1);
    expect(await db.select().from(approvalEvents).where(eq(approvalEvents.actorId,author.id))).toHaveLength(1);
    await expect(caller.upload({...input,title:'Other title'})).rejects.toMatchObject({code:'CONFLICT'});
    await expect(caller.upload({...input,dataBase64:'%%%'})).rejects.toMatchObject({code:'BAD_REQUEST'});
    expect((await caller.upload(Object.fromEntries(Object.entries(input).reverse()) as typeof input)).id).toBe(results[0].id);
    await db.update(users).set({status:'suspended'}).where(eq(users.id,author.id));
    await expect(caller.upload(input)).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it('rechecks every register operation against a revoked administrator context',async()=>{
    const {db,caller,author,profile}=await fixture();
    const actions=[
      ()=>caller.overview(),()=>caller.saveProfile(profile),
      ()=>caller.setStatus({status:'preparation',reason:'Revoked request'}),
      ()=>caller.upload({...fileInput,kind:'mtoe'}),
      ()=>caller.createFinding({title:'Test finding',reference:'TEST',severity:'level2',description:'Test finding description',ownerId:author.id,dueAt:new Date()}),
      ()=>caller.updateFinding({id:1,rootCause:'Test cause',correctiveAction:'Test action'}),
      ()=>caller.closeFinding({id:1,note:'Test closure'})
    ];
    for(const update of [{status:'suspended' as const},{status:'active' as const,role:'user' as const}]){
      await db.update(users).set(update).where(eq(users.id,author.id));
      for(const action of actions)await expect(action()).rejects.toMatchObject({code:'FORBIDDEN'});
    }
    expect(await db.select().from(approvalEvents).where(eq(approvalEvents.actorId,author.id))).toHaveLength(0);
    expect(await db.select().from(approvalDocuments).where(eq(approvalDocuments.uploadedBy,author.id))).toHaveLength(0);
  });
  it('rejects outdated organisation drafts without resetting a newer recorded status',async()=>{
    const {db,caller,author,profile}=await fixture();
    const first=await caller.saveProfile(profile);
    await caller.setStatus({status:'submitted',reason:'Submission recorded'});
    const current=(await caller.overview()).profile!;
    const before=await db.select().from(approvalEvents).where(eq(approvalEvents.actorId,author.id));
    await expect(caller.saveProfile({...profile,legalName:'Stale draft',expectedRevision:first.revision})).rejects.toMatchObject({code:'CONFLICT'});
    expect((await caller.overview()).profile).toEqual(current);
    expect(await db.select().from(approvalEvents).where(eq(approvalEvents.actorId,author.id))).toEqual(before);
    const saved=await caller.saveProfile({...profile,expectedRevision:current.revision});
    expect(saved.status).toBe('preparation');expect(saved.revision).toBe(current.revision+1);
    await expect(caller.saveProfile({...profile,expectedRevision:null})).rejects.toMatchObject({code:'CONFLICT'});
  });
  it('refuses a decision prepared before an organisation change and concurrent decisions',async()=>{
    const {db,caller,author,profile}=await fixture();
    const first=await caller.saveProfile(profile);
    const changed=await caller.saveProfile({...profile,scope:'Updated training scope'});
    const history=await db.select().from(approvalEvents).where(eq(approvalEvents.actorId,author.id));
    await expect(caller.setStatus({status:'submitted',reason:'Stale decision',expectedRevision:first.revision})).rejects.toMatchObject({code:'CONFLICT'});
    expect((await caller.overview()).profile).toEqual(changed);
    expect(await db.select().from(approvalEvents).where(eq(approvalEvents.actorId,author.id))).toEqual(history);
    const results=await Promise.allSettled(['submitted','withdrawn'].map(status=>caller.setStatus({status:status as 'submitted'|'withdrawn',reason:'Current decision',expectedRevision:changed.revision})));
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{code:'CONFLICT'}});
  });
  it('rejects competing action plans and closure of an outdated reviewed plan',async()=>{
    const {db,caller,checker,author,learner}=await fixture();
    const evidence=await caller.upload({...fileInput,kind:'evidence'});
    const finding=await caller.createFinding({title:'Concurrent finding',reference:'TEST',severity:'level2',description:'Concurrent action plan',ownerId:learner.id,dueAt:new Date()});
    const results=await Promise.allSettled(['First action','Second action'].map(correctiveAction=>caller.updateFinding({id:finding.id,rootCause:'Recorded root cause',correctiveAction,evidenceId:evidence.id,expectedRevision:finding.revision})));
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{code:'CONFLICT'}});
    const reviewed=(await checker.overview()).findings.find(f=>f.id===finding.id)!;
    const current=await caller.updateFinding({id:finding.id,rootCause:'Updated root cause',correctiveAction:'Updated corrective action',evidenceId:evidence.id,expectedRevision:reviewed.revision});
    const eventsBefore=await db.select().from(approvalEvents).where(eq(approvalEvents.entityId,finding.id));
    await expect(checker.closeFinding({id:finding.id,note:'Old effectiveness review',expectedRevision:reviewed.revision})).rejects.toMatchObject({code:'CONFLICT'});
    expect(await db.select().from(approvalEvents).where(eq(approvalEvents.entityId,finding.id))).toEqual(eventsBefore);
    expect((await checker.closeFinding({id:finding.id,note:'Current effectiveness review',expectedRevision:current.revision})).status).toBe('closed');
  });
  it('pages the audit history by stable IDs with fresh administrator access',async()=>{
    const {db,caller,author}=await fixture();
    const inserted=await db.insert(approvalEvents).values(Array.from({length:55},(_,i)=>({actorId:author.id,action:'profile_saved',entityId:1,current:{legalName:`History ${i}`},createdAt:new Date('2030-01-01')}))).returning();
    const first=await caller.historyPage({beforeId:inserted[54].id+1});expect(first.entries.map(e=>e.id)).toEqual(inserted.map(e=>e.id).reverse().slice(0,50));
    const [newer]=await db.insert(approvalEvents).values({actorId:author.id,action:'profile_saved',entityId:1,current:{legalName:'New entry'}}).returning();
    const second=await caller.historyPage({beforeId:first.nextCursor!});expect(second.entries.slice(0,5).map(e=>e.id)).toEqual(inserted.slice(0,5).map(e=>e.id).reverse());
    expect(second.entries.some(e=>first.entries.some(f=>f.id===e.id)||e.id===newer.id)).toBe(false);
    await db.update(users).set({status:'suspended'}).where(eq(users.id,author.id));await expect(caller.historyPage()).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it("enforces role independence and active nominated personnel", async () => {
    const { caller, profile, author } = await fixture();
    await expect(caller.saveProfile({ ...profile, qualityManagerId: author.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.saveProfile({ ...profile, qualityManagerId: 99999999 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await caller.saveProfile(profile)).status).toBe("preparation");
  });
  it("records an approval only with explicit authority evidence and MTOE; edits reset it", async () => {
    const { db, caller, profile, reviewer } = await fixture();
    await caller.saveProfile(profile);
    await expect(caller.setStatus({ status: "approved", reason: "Recorded decision" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const decision = await caller.upload({ ...fileInput, kind: "approval" });
    const mtoe = await caller.upload({ ...fileInput, kind: "mtoe" });
    const result = await caller.setStatus({ status: "approved", reason: "Recorded from authority decision", approvalDocumentId: decision.id, mtoeDocumentId: mtoe.id });
    expect(result).toMatchObject({ status: "approved", approvalDocumentId: decision.id, mtoeDocumentId: mtoe.id });
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, reviewer.id));
    await expect(caller.setStatus({ status: "approved", reason: "Recheck nominees", approvalDocumentId: decision.id, mtoeDocumentId: mtoe.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await db.update(users).set({ status: "active" }).where(eq(users.id, reviewer.id));
    expect((await caller.saveProfile({ ...profile, scope: "Changed scope under review" })).status).toBe("preparation");
  });
  it("protects document versions and audit history while blocking client downloads", async () => {
    const { db, author, learner, caller } = await fixture();
    const doc = await caller.upload({ ...fileInput, kind: "mtoe" });
    expect(await canReadPrivateFile(doc.fileUrl.slice(9), learner)).toBe(false);
    expect(await canReadPrivateFile(doc.fileUrl.slice(9), author)).toBe(true);
    await expect(db.update(approvalDocuments).set({ revision: "tampered" }).where(eq(approvalDocuments.id, doc.id))).rejects.toThrow();
    await expect(db.delete(approvalEvents).where(eq(approvalEvents.actorId, author.id))).rejects.toThrow();
  });
  it("requires evidence and independent closure of a corrective action", async () => {
    const { author, caller, checker } = await fixture();
    const finding = await caller.createFinding({ title: "Test exam control gap", reference: "147.A.130", severity: "level2", description: "Test finding requiring a corrective action", ownerId: author.id, dueAt: new Date(Date.now() + 86400000) });
    await expect(checker.closeFinding({ id: finding.id, note: "No evidence yet" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const evidence = await caller.upload({ ...fileInput, kind: "evidence" });
    await caller.updateFinding({ id: finding.id, rootCause: "Test cause analysis", correctiveAction: "Test action implemented", evidenceId: evidence.id });
    await expect(caller.closeFinding({ id: finding.id, note: "Self review denied" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await checker.closeFinding({ id: finding.id, note: "Evidence checked and action effective" })).status).toBe("closed");
    await expect(caller.updateFinding({ id: finding.id, rootCause: "Changed cause", correctiveAction: "Changed action" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("accepts only one concurrent closure", async () => {
    const { author, caller, checker } = await fixture();
    const finding = await caller.createFinding({ title: "Concurrent closure", reference: "Internal audit", severity: "observation", description: "Concurrent review test finding", ownerId: author.id, dueAt: new Date() });
    const proof = await caller.upload({ ...fileInput, kind: "audit" });
    await caller.updateFinding({ id: finding.id, rootCause: "Test cause", correctiveAction: "Test correction", evidenceId: proof.id });
    const result = await Promise.allSettled([checker.closeFinding({ id: finding.id, note: "Review one" }), checker.closeFinding({ id: finding.id, note: "Review two" })]);
    expect(result.filter(r => r.status === "fulfilled")).toHaveLength(1);
  });
});
