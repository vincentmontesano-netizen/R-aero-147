import { beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { users, companies, affiliations, verificationCases, verificationDocuments, verificationEvents } from "../drizzle/schema";
import { addVerificationDocument, changeVerificationStatus, readVerification, readVerificationHistory, readVerificationDocuments, saveVerification, validateVerificationFile, verificationRouter } from "./verification";
import * as storage from "./storage";
import { canReadPrivateFile } from "./storageAccess";
import type { TrpcContext } from "./_core/context";

const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)("KYC / KYB · PostgreSQL", () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  async function fixture() {
    const db = (await getDb())!;
    const people = await db.insert(users).values(["user", "user", "admin"].map(role => ({ openId: randomUUID(), name: "Verification test", role: role as "user" | "admin" }))).returning();
    const [owner, stranger, reviewer] = people;
    return { db, owner, stranger, reviewer };
  }
  const draft = { kind: "kyc" as const, legalName: "Test Person", country: "FR", address: "10 Test Street" };
  const pdf = Buffer.from("%PDF-1.4\nTest fixture").toString("base64");
  const add = (actor: Parameters<typeof addVerificationDocument>[0], id: number, kind = "identity") => addVerificationDocument(actor, { caseId: id, kind, fileName: "proof.pdf", contentType: "application/pdf", dataBase64: pdf });
  it('versions actual evidence changes but not upload replays or repeated archives',async()=>{
    const {db,owner}=await fixture();const record=await saveVerification(owner,draft);
    const input={caseId:record.id,kind:'identity',fileName:'proof.pdf',contentType:'application/pdf',dataBase64:pdf,requestId:randomUUID()};
    const document=await addVerificationDocument(owner,input);
    expect((await readVerification(owner,record.id)).revision).toBe(record.revision+1);
    await addVerificationDocument(owner,input);expect((await readVerification(owner,record.id)).revision).toBe(record.revision+1);
    await expect(changeVerificationStatus(owner,record.id,'submitted',undefined,record.revision)).rejects.toMatchObject({code:'CONFLICT'});
    const api=verificationRouter.createCaller({user:owner} as TrpcContext);
    await Promise.all([api.archiveDocument({id:document.id}),api.archiveDocument({id:document.id})]);
    expect((await readVerification(owner,record.id)).revision).toBe(record.revision+2);
    const history=await db.select().from(verificationEvents).where(eq(verificationEvents.caseId,record.id));
    expect(history.filter(e=>e.action==='document_archived')).toHaveLength(1);
    await addVerificationDocument(owner,input);expect((await readVerification(owner,record.id)).revision).toBe(record.revision+2);
  });
  it('refuses stale submission and a decision from an earlier review cycle',async()=>{
    const {db,owner,reviewer}=await fixture();
    const record=await saveVerification(owner,draft);await add(owner,record.id);
    await saveVerification(owner,{...draft,legalName:'Updated name'});
    await expect(changeVerificationStatus(owner,record.id,'submitted',undefined,record.revision)).rejects.toMatchObject({code:'CONFLICT'});
    const current=await readVerification(owner,record.id);
    const submitted=await changeVerificationStatus(owner,record.id,'submitted',undefined,current.revision);
    await changeVerificationStatus(reviewer,record.id,'needs_information','More details required',submitted.revision);
    const changed=await saveVerification(owner,{...draft,address:'20 Corrected Street'});
    const resubmitted=await changeVerificationStatus(owner,record.id,'submitted',undefined,changed.revision);
    const before=await db.select().from(verificationEvents).where(eq(verificationEvents.caseId,record.id));
    await expect(changeVerificationStatus(reviewer,record.id,'approved','Old review note',submitted.revision)).rejects.toMatchObject({code:'CONFLICT'});
    expect(await readVerification(reviewer,record.id)).toEqual(resubmitted);
    expect(await db.select().from(verificationEvents).where(eq(verificationEvents.caseId,record.id))).toEqual(before);
    expect((await changeVerificationStatus(reviewer,record.id,'approved','Current review note',resubmitted.revision)).status).toBe('approved');
  });
  it('rejects competing dossier edits without writing a misleading history event',async()=>{
    const {db,owner}=await fixture();
    const api=verificationRouter.createCaller({user:owner} as TrpcContext);
    const record=await api.save({...draft,expectedRevision:null});
    const results=await Promise.allSettled(['First legal name','Second legal name'].map(legalName=>api.save({...draft,legalName,expectedRevision:record.revision})));
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{code:'CONFLICT'}});
    const current=await api.detail({id:record.id});expect(current.revision).toBe(1);
    const history=await db.select().from(verificationEvents).where(eq(verificationEvents.caseId,record.id));expect(history).toHaveLength(2);
    await expect(api.save({...draft,expectedRevision:null})).rejects.toMatchObject({code:'CONFLICT'});
    expect(await api.detail({id:record.id})).toEqual(current);
    await api.save({...draft,legalName:'Fresh name',expectedRevision:current.revision});
    expect((await api.detail({id:record.id})).revision).toBe(2);
    await expect(api.save({...draft,expectedRevision:-1})).rejects.toMatchObject({code:'BAD_REQUEST'});
  });
  it('keeps legacy list responses bounded and excludes dossier details',async()=>{
    const {db,owner,stranger,reviewer}=await fixture();
    const orgs=await db.insert(companies).values(Array.from({length:205},()=>({name:'Legacy list company'}))).returning();
    await db.insert(affiliations).values(orgs.map(org=>({personId:owner.id,orgId:org.id,role:'MANAGER' as const})));
    const records=await db.insert(verificationCases).values(orgs.map(org=>({...draft,kind:'kyb',companyId:org.id,personId:owner.id,subjectKey:`kyb:${org.id}`,reviewNote:'Private decision note'}))).returning();
    const api=verificationRouter.createCaller({user:owner} as TrpcContext);
    const rows=await api.mine();expect(rows).toHaveLength(200);
    expect(rows.map(r=>r.id)).toEqual(records.map(r=>r.id).reverse().slice(0,200));
    for(const row of rows)expect(Object.keys(row).sort()).toEqual(['id','kind','legalName','status']);
    expect((await api.detail({id:records[0].id})).address).toBe(draft.address);
    const admin=verificationRouter.createCaller({user:reviewer} as TrpcContext);
    const queue=await admin.queue();expect(queue).toHaveLength(200);
    for(const row of queue)expect(Object.keys(row).sort()).toEqual(['id','kind','legalName','status']);
    const outsider=verificationRouter.createCaller({user:stranger} as TrpcContext);
    expect(await outsider.mine()).toEqual([]);await expect(outsider.queue()).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it('pages personal files with minimal fields and fresh company access',async()=>{
    const {db,owner,stranger}=await fixture();
    const organizations=await db.insert(companies).values(Array.from({length:55},()=>({name:'Managed company'}))).returning();
    await db.insert(affiliations).values(organizations.map(org=>({personId:owner.id,orgId:org.id,role:'MANAGER' as const})));
    const inserted=await db.insert(verificationCases).values(organizations.map(org=>({...draft,kind:'kyb',companyId:org.id,personId:owner.id,subjectKey:`kyb:${org.id}`}))).returning();
    await db.insert(verificationCases).values({...draft,personId:stranger.id,subjectKey:`kyc:${stranger.id}`});
    const api=verificationRouter.createCaller({user:owner} as TrpcContext);
    const first=await api.minePage();expect(first.entries).toHaveLength(50);
    expect(Object.keys(first.entries[0]).sort()).toEqual(['id','kind','legalName','status']);
    const [newer]=await db.insert(verificationCases).values({...draft,personId:owner.id,subjectKey:`kyc:${owner.id}`}).returning();
    const second=await api.minePage({beforeId:first.nextCursor!});expect(second.entries).toHaveLength(5);
    expect([...first.entries,...second.entries].map(r=>r.id)).toEqual(inserted.map(r=>r.id).reverse());
    expect((await api.minePage()).entries[0].id).toBe(newer.id);
    const [company]=await db.insert(companies).values({name:'Pagination company'}).returning();
    await db.insert(affiliations).values({personId:owner.id,orgId:company.id,role:'MANAGER'});
    const [kyb]=await db.insert(verificationCases).values({...draft,kind:'kyb',personId:stranger.id,companyId:company.id,subjectKey:`kyb:${company.id}`}).returning();
    expect((await api.minePage()).entries.some(r=>r.id===kyb.id)).toBe(true);
    await db.update(affiliations).set({status:'INACTIVE'}).where(eq(affiliations.personId,owner.id));
    expect((await api.minePage()).entries.some(r=>r.id===kyb.id)).toBe(false);
    await db.update(users).set({status:'suspended'}).where(eq(users.id,owner.id));
    await expect(api.minePage()).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it("pages immutable case history and exposes only decision notes with fresh access", async () => {
    const {db,owner,stranger,reviewer}=await fixture();
    const record=await saveVerification(owner,draft);
    const existing=(await readVerificationHistory(owner,record.id)).entries;
    const added=await db.insert(verificationEvents).values(Array.from({length:55},(_,i)=>({caseId:record.id,actorId:reviewer.id,action:i%2?'updated':'needs_information',current:{reviewNote:'Historical reason',address:'Private snapshot'}}))).returning();
    const caller=verificationRouter.createCaller({user:owner} as TrpcContext);
    const first=await caller.history({id:record.id});
    expect(first.entries).toHaveLength(50);
    expect(Object.keys(first.entries[0]).sort()).toEqual(['action','actorId','createdAt','id','reviewNote']);
    expect(first.entries.find(e=>e.action==='needs_information')?.reviewNote).toBe('Historical reason');
    expect(first.entries.find(e=>e.action==='updated')?.reviewNote).toBeNull();
    const [newer]=await db.insert(verificationEvents).values({caseId:record.id,actorId:owner.id,action:'updated'}).returning();
    const second=await caller.history({id:record.id,beforeId:first.nextCursor!});
    expect(second.nextCursor).toBeNull();
    expect([...first.entries,...second.entries].map(e=>e.id)).toEqual([...existing,...added].map(e=>e.id).sort((a,b)=>b-a));
    expect((await caller.history({id:record.id})).entries[0].id).toBe(newer.id);
    expect(await readVerification(owner,record.id)).not.toHaveProperty('events');
    await expect(readVerificationHistory(stranger,record.id)).rejects.toMatchObject({code:'FORBIDDEN'});
    for(const beforeId of [0,-1,1.5,2147483648]) await expect(caller.history({id:record.id,beforeId})).rejects.toMatchObject({code:'BAD_REQUEST'});
    await db.update(users).set({status:'suspended'}).where(eq(users.id,owner.id));
    await expect(caller.history({id:record.id,beforeId:first.nextCursor!})).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it("pages active and archived evidence without exposing archived URLs or upload metadata",async()=>{
    const {db,owner,stranger}=await fixture();
    const record=await saveVerification(owner,draft);
    const rows=await db.insert(verificationDocuments).values(Array.from({length:55},(_,i)=>({caseId:record.id,kind:'identity',fileName:`proof-${i}.pdf`,fileUrl:`/storage/verification/${randomUUID()}.pdf`,contentType:'application/pdf',uploadedBy:owner.id}))).returning();
    const caller=verificationRouter.createCaller({user:owner} as TrpcContext);
    const first=await caller.documentsPage({id:record.id});
    expect(first.entries).toHaveLength(50);
    const last=await caller.documentsPage({id:record.id,beforeId:first.nextCursor!});
    expect(last.nextCursor).toBeNull();
    expect([...first.entries,...last.entries].map(d=>d.id)).toEqual(rows.map(d=>d.id).reverse());
    const target=rows[54];
    await caller.archiveDocument({id:target.id});
    const archived=await caller.documentsPage({id:record.id,archived:true});
    expect(archived.entries).toHaveLength(1);
    expect(archived.entries[0]).toMatchObject({id:target.id,fileUrl:null,fileName:target.fileName});
    expect(Object.keys(archived.entries[0]).sort()).toEqual(['archivedAt','contentType','createdAt','fileName','fileUrl','id','kind']);
    expect((await caller.documentsPage({id:record.id})).entries.map(d=>d.id)).not.toContain(target.id);
    expect(await canReadPrivateFile(target.fileUrl.slice(9),owner)).toBe(false);
    await expect(changeVerificationStatus(owner,record.id,'submitted')).resolves.toMatchObject({status:'submitted'});
    await expect(readVerificationDocuments(stranger,record.id,true)).rejects.toMatchObject({code:'FORBIDDEN'});
    for(const beforeId of [0,-1,1.5,2147483648]) await expect(caller.documentsPage({id:record.id,beforeId})).rejects.toMatchObject({code:'BAD_REQUEST'});
    await db.update(users).set({status:'suspended'}).where(eq(users.id,owner.id));
    await expect(caller.documentsPage({id:record.id,archived:true})).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it("runs draft → submit → information request → resubmit → approval, preserving history", async () => {
    const { db, owner, reviewer } = await fixture();
    const record = await saveVerification(owner, draft);
    await expect(changeVerificationStatus(owner, record.id, "submitted")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await add(owner, record.id);
    await changeVerificationStatus(owner, record.id, "submitted");
    await expect(saveVerification(owner, draft)).rejects.toMatchObject({ code: "CONFLICT" });
    await changeVerificationStatus(reviewer, record.id, "needs_information", "Please confirm your address.");
    await saveVerification(owner, { ...draft, address: "20 Test Street" });
    await changeVerificationStatus(owner, record.id, "submitted");
    expect((await changeVerificationStatus(reviewer, record.id, "approved", "Evidence reviewed and consistent.")).status).toBe("approved");
    const result = await readVerification(owner, record.id);
    expect((await readVerificationHistory(owner, record.id)).entries.map(e => e.action)).toContain("needs_information");
    await expect(db.update(verificationEvents).set({ action: "tampered" }).where(eq(verificationEvents.caseId, record.id))).rejects.toThrow();
    await expect(db.delete(verificationEvents).where(eq(verificationEvents.caseId, record.id))).rejects.toThrow();
  });
  it("isolates personal files, documents and admin decisions", async () => {
    const { owner, stranger } = await fixture();
    const record = await saveVerification(owner, draft);
    const file = await add(owner, record.id);
    await expect(readVerification(stranger, record.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await canReadPrivateFile(file.fileUrl.slice(9), stranger)).toBe(false);
    expect(await canReadPrivateFile(file.fileUrl.slice(9), owner)).toBe(true);
    await expect(add(stranger, record.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(changeVerificationStatus(owner, record.id, "approved", "Own approval")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("requires active company management and both KYB proofs; revoked membership loses access", async () => {
    const { db, owner, stranger } = await fixture();
    const [company] = await db.insert(companies).values({ name: "KYB test" }).returning();
    const form = { ...draft, kind: "kyb" as const, companyId: company.id, registrationNumber: "REG-123" };
    await expect(saveVerification(owner, form)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.insert(affiliations).values({ personId: owner.id, orgId: company.id, role: "MANAGER" });
    const record = await saveVerification(owner, form);
    await add(owner, record.id, "registration");
    await expect(changeVerificationStatus(owner, record.id, "submitted")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await add(owner, record.id, "authority");
    await changeVerificationStatus(owner, record.id, "submitted");
    await db.update(affiliations).set({ status: "INACTIVE" }).where(eq(affiliations.personId, owner.id));
    await expect(readVerification(owner, record.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(readVerificationHistory(owner, record.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(readVerificationDocuments(owner, record.id, true)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(readVerification(stranger, record.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("archives a document without destroying it and denies the old download URL", async () => {
    const { db, owner } = await fixture();
    const record = await saveVerification(owner, draft);
    const file = await add(owner, record.id);
    const caller = verificationRouter.createCaller({ user: owner } as TrpcContext);
    await caller.archiveDocument({ id: file.id });
    expect((await db.select().from(verificationDocuments).where(eq(verificationDocuments.id, file.id)))[0].archivedAt).toBeTruthy();
    expect(await canReadPrivateFile(file.fileUrl.slice(9), owner)).toBe(false);
    await expect(caller.submit({id:record.id})).rejects.toMatchObject({code:"BAD_REQUEST"});
  });
  it("denies self-review and review by an administrator affiliated to the company", async () => {
    const { db, owner, reviewer } = await fixture();
    const own = await saveVerification(reviewer, draft);
    await add(reviewer, own.id);
    await changeVerificationStatus(reviewer, own.id, "submitted");
    await expect(changeVerificationStatus(reviewer, own.id, "approved", "Reviewed.")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const [company] = await db.insert(companies).values({ name: "Independent review test" }).returning();
    await db.insert(affiliations).values([{ personId: owner.id, orgId: company.id, role: "MANAGER" }, { personId: reviewer.id, orgId: company.id, role: "MEMBER" }]);
    const companyCase = await saveVerification(owner, { ...draft, kind: "kyb", companyId: company.id, registrationNumber: "REG-456" });
    await add(owner, companyCase.id, "registration"); await add(owner, companyCase.id, "authority");
    await changeVerificationStatus(owner, companyCase.id, "submitted");
    await expect(changeVerificationStatus(reviewer, companyCase.id, "approved", "Reviewed.")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("restricts the administrator queue and decision API", async () => {
    const { owner } = await fixture();
    const caller = verificationRouter.createCaller({ user: owner } as TrpcContext);
    await expect(caller.queue()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.review({ id: 1, status: "approved", note: "Reviewed" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("uses current account rights instead of stale active/admin fields", async () => {
    const { db, owner, stranger, reviewer } = await fixture();
    const record = await saveVerification(owner, draft);
    const file = await add(owner, record.id);
    await expect(readVerification({ ...stranger, role: 'admin' }, record.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, owner.id));
    const ownerCaller = verificationRouter.createCaller({ user: owner } as TrpcContext);
    for (const operation of [
      () => readVerification(owner, record.id), () => saveVerification(owner, draft),
      () => add(owner, record.id), () => changeVerificationStatus(owner, record.id, 'submitted'),
      () => ownerCaller.mine(), () => ownerCaller.archiveDocument({ id: file.id }),
    ]) await expect(operation()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await db.select().from(verificationDocuments).where(eq(verificationDocuments.caseId, record.id)))).toHaveLength(1);
    expect((await db.select().from(verificationDocuments).where(eq(verificationDocuments.id, file.id)))[0].archivedAt).toBeNull();
    await db.update(users).set({ status: 'active' }).where(eq(users.id, owner.id));
    await changeVerificationStatus(owner, record.id, 'submitted');
    await db.update(users).set({ role: 'user' }).where(eq(users.id, reviewer.id));
    const reviewerCaller = verificationRouter.createCaller({ user: reviewer } as TrpcContext);
    await expect(reviewerCaller.queue()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(readVerification(reviewer, record.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(changeVerificationStatus(reviewer, record.id, 'approved', 'Reviewed fixture')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await readVerification(owner, record.id)).status).toBe('submitted');
  });

  it("recovers concurrent upload requests without extra files or events, preserving archived evidence", async () => {
    const { db, owner, stranger, reviewer } = await fixture();
    const record = await saveVerification(owner, draft);
    const input = { caseId: record.id, kind: 'identity', fileName: 'proof.pdf', contentType: 'application/pdf', dataBase64: pdf, requestId: randomUUID() };
    const put = vi.spyOn(storage, 'storagePut');
    try {
      await expect(addVerificationDocument(owner, {...input,dataBase64:Buffer.from('%PDF-').toString('base64')+'='})).rejects.toMatchObject({code:'BAD_REQUEST'});
      expect(put).not.toHaveBeenCalled();
      expect(await db.select().from(verificationDocuments).where(eq(verificationDocuments.caseId,record.id))).toHaveLength(0);
      expect((await readVerificationHistory(owner,record.id)).entries.map(e=>e.action)).toEqual(['created']);
      const results = await Promise.all([addVerificationDocument(owner, input), addVerificationDocument(owner, input), addVerificationDocument(owner, { ...input, requestId: input.requestId.toUpperCase() })]);
      const document = results[0];
      expect(new Set(results.map(row => row.id)).size).toBe(1);
      expect(put).toHaveBeenCalledTimes(1);
      expect(await db.select().from(verificationDocuments).where(eq(verificationDocuments.caseId, record.id))).toHaveLength(1);
      expect((await readVerificationHistory(owner, record.id)).entries.filter(e => e.action === 'document_added')).toHaveLength(1);
      for (const changes of [{ kind: 'supporting' }, { fileName: 'other.pdf' }, { dataBase64: Buffer.from('%PDF-1.4 different').toString('base64') }]) {
        await expect(addVerificationDocument(owner, { ...input, ...changes })).rejects.toMatchObject({ code: 'CONFLICT' });
      }
      await expect(addVerificationDocument(stranger, input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(addVerificationDocument(owner, { ...input, requestId: 'invalid' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      await changeVerificationStatus(owner, record.id, 'submitted');
      expect((await addVerificationDocument(owner, input)).id).toBe(document.id);
      await expect(addVerificationDocument(owner, { ...input, requestId: randomUUID() })).rejects.toMatchObject({ code: 'CONFLICT' });
      await changeVerificationStatus(reviewer, record.id, 'needs_information', 'Please replace this proof.');
      for (const values of [{ requestId: randomUUID() }, { sha256: '0'.repeat(64) }]) {
        await expect(db.update(verificationDocuments).set(values).where(eq(verificationDocuments.id, document.id))).rejects.toThrow();
      }
      const caller = verificationRouter.createCaller({ user: owner } as TrpcContext);
      await caller.archiveDocument({ id: document.id });
      const eventCount = (await readVerificationHistory(owner, record.id)).entries.length;
      expect((await caller.upload(input)).archivedAt).toBeTruthy();
      expect((await readVerificationDocuments(owner, record.id)).entries).toHaveLength(0);
      expect((await readVerificationHistory(owner, record.id)).entries).toHaveLength(eventCount);
      expect(put).toHaveBeenCalledTimes(1);
      await expect(db.update(verificationDocuments).set({ archivedAt: null }).where(eq(verificationDocuments.id, document.id))).rejects.toThrow();
      await expect(db.delete(verificationDocuments).where(eq(verificationDocuments.id, document.id))).rejects.toThrow();
      await db.update(users).set({ status: 'suspended' }).where(eq(users.id, owner.id));
      await expect(addVerificationDocument(owner, input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(put).toHaveBeenCalledTimes(1);
    } finally { put.mockRestore(); }
  });

  it("scopes upload identities to the uploader and rechecks KYB membership on retries", async () => {
    const { db, owner, stranger } = await fixture();
    const [company] = await db.insert(companies).values({ name: 'Upload retry company' }).returning();
    await db.insert(affiliations).values([owner, stranger].map(person => ({ personId: person.id, orgId: company.id, role: 'MANAGER' as const })));
    const record = await saveVerification(owner, { ...draft, kind: 'kyb', companyId: company.id, registrationNumber: 'REG-RETRY' });
    const input = { caseId: record.id, kind: 'supporting', fileName: 'proof.pdf', contentType: 'application/pdf', dataBase64: pdf, requestId: randomUUID() };
    const first = await addVerificationDocument(owner, input);
    const second = await addVerificationDocument(stranger, input);
    expect(second.id).not.toBe(first.id);
    const personal = await saveVerification(owner, draft);
    await expect(addVerificationDocument(owner, { ...input, caseId: personal.id })).rejects.toMatchObject({ code: 'CONFLICT' });
    await db.update(affiliations).set({ status: 'INACTIVE' }).where(eq(affiliations.personId, owner.id));
    await expect(addVerificationDocument(owner, input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await addVerificationDocument(stranger, input)).id).toBe(second.id);
    expect(await db.select().from(verificationDocuments).where(eq(verificationDocuments.caseId, record.id))).toHaveLength(2);
  });

  it("pages the admin queue beyond 200 files with status filtering and current admin rights", async () => {
    const { db, owner, reviewer } = await fixture();
    const prefix = randomUUID();
    const records = await db.insert(verificationCases).values(Array.from({ length: 205 }, (_, i) => ({
      subjectKey: `queue:${prefix}:${i}`, kind: 'kyc', personId: owner.id, status: 'rejected', legalName: 'Queue fixture', country: 'FR', address: 'Test address',
    }))).returning();
    const expected = records.map(r => r.id).sort((a, b) => b - a);
    const caller = verificationRouter.createCaller({ user: reviewer } as TrpcContext);
    await expect(verificationRouter.createCaller({ user: owner } as TrpcContext).queuePage()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const first = await caller.queuePage({ status: 'rejected', beforeId: expected[0] + 1 });
    expect(first.entries.map(r => r.id)).toEqual(expected.slice(0, 50));
    expect(Object.keys(first.entries[0]).sort()).toEqual(['id', 'kind', 'legalName', 'status']);
    const [recent] = await db.insert(verificationCases).values({ subjectKey: `queue:${prefix}:new`, kind: 'kyc', personId: owner.id, status: 'rejected', legalName: 'New arrival', country: 'FR', address: 'Test address' }).returning();
    await db.update(verificationCases).set({ status: 'approved' }).where(eq(verificationCases.id, expected[0]));
    const seen = first.entries.map(r => r.id);
    let cursor = first.nextCursor;
    for (let page = 0; page < 4; page++) {
      expect(cursor).not.toBeNull();
      const next = await caller.queuePage({ status: 'rejected', beforeId: cursor! });
      expect(next.entries.length).toBeLessThanOrEqual(50);
      expect(next.entries.every(r => r.status === 'rejected')).toBe(true);
      seen.push(...next.entries.map(r => r.id)); cursor = next.nextCursor;
    }
    expect(seen.slice(0, 205)).toEqual(expected);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).not.toContain(recent.id);
    expect((await caller.queuePage({ status: 'rejected' })).entries[0].id).toBe(recent.id);
    expect((await caller.queuePage({ status: 'approved', beforeId: expected[0] + 1 })).entries[0].id).toBe(expected[0]);
    expect(await caller.queuePage({ beforeId: 1 })).toEqual({ entries: [], nextCursor: null });
    expect(await caller.queue()).toHaveLength(200);
    for (const beforeId of [0, -1, 1.5, 2147483648]) await expect(caller.queuePage({ beforeId })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await db.update(users).set({ role: 'user' }).where(eq(users.id, reviewer.id));
    await expect(caller.queuePage()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await db.update(users).set({ role: 'admin', status: 'suspended' }).where(eq(users.id, reviewer.id));
    await expect(caller.queuePage()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it("serializes duplicate creation and review decisions", async () => {
    const { db, owner, reviewer } = await fixture();
    const records = await Promise.all([saveVerification(owner, draft), saveVerification(owner, draft)]);
    expect(records[0].id).toBe(records[1].id);
    await add(owner, records[0].id);
    await changeVerificationStatus(owner, records[0].id, "submitted");
    const results = await Promise.allSettled([changeVerificationStatus(reviewer, records[0].id, "approved", "Reviewed."), changeVerificationStatus(reviewer, records[0].id, "rejected", "Rejected.")]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((await db.select().from(verificationCases).where(eq(verificationCases.id, records[0].id)))[0].reviewedBy).toBe(reviewer.id);
  });
});
describe("verification evidence validation", () => {
  it("requires canonical base64 including padding bits",()=>{
    const canonical=Buffer.from('%PDF-').toString('base64');
    expect(canonical).toBe('JVBERi0=');
    for(const value of [canonical.slice(0,-1),canonical+'=',canonical+'A',canonical+'\n','JVBERi1=','data:application/pdf;base64,'+canonical,'']) {
      expect(()=>validateVerificationFile({contentType:'application/pdf',dataBase64:value})).toThrow();
    }
    expect(validateVerificationFile({contentType:'application/pdf',dataBase64:canonical})).toEqual(Buffer.from('%PDF-'));
  });
  it("accepts supported signatures and enforces the exact decoded size limit",()=>{
    for(const [contentType,bytes] of [['image/png',Buffer.from([137,80,78,71,13,10,26,10])],['image/jpeg',Buffer.from([255,216,255,224])]] as const) {
      expect(validateVerificationFile({contentType,dataBase64:bytes.toString('base64')})).toEqual(bytes);
    }
    const maximum=Buffer.alloc(8*1024*1024);maximum.write('%PDF-');
    expect(validateVerificationFile({contentType:'application/pdf',dataBase64:maximum.toString('base64')})).toHaveLength(maximum.length);
    expect(()=>validateVerificationFile({contentType:'application/pdf',dataBase64:Buffer.concat([maximum,Buffer.from('x')]).toString('base64')})).toThrow();
    expect(()=>validateVerificationFile({contentType:'application/pdf',dataBase64:'A'.repeat(4*Math.ceil(maximum.length/3)+4)})).toThrow();
  });
  it("rejects false MIME types and invalid base64", () => {
    expect(() => validateVerificationFile({ contentType: "application/pdf", dataBase64: Buffer.from("<script>alert(1)</script>").toString("base64") })).toThrow();
    expect(() => validateVerificationFile({ contentType: "image/png", dataBase64: "?bad" })).toThrow();
  });
});
