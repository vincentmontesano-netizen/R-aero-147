import {appRouter} from './routers';
import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, getCertificateByCode, getUserOrders } from "./db";
import { canReadPrivateFile } from "./storageAccess";
import { normalizeStorageKey } from "./storage";
import { generateInvoicePDF } from "./invoice";
import { users, affiliations, companies, passportDocuments, orders, certificates, trainings } from "../drizzle/schema";

const testUrl = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!testUrl)("private documents · PostgreSQL", () => {
  beforeAll(() => { process.env.DATABASE_URL = testUrl!; });
  async function fixture() {
    const db = (await getDb())!;
    const [owner, manager, outsider] = await db.insert(users).values(["owner", "manager", "outsider"].map(name => ({ openId: randomUUID(), name, passwordHash: "SECRET", resetToken: "RESET" }))).returning();
    const key = `passport/${owner.id}/test-${randomUUID()}.pdf`;
    await db.insert(passportDocuments).values({ personId: owner.id, kind: "ID", title: "Test", fileUrl: `/storage/${key}` });
    const [company] = await db.insert(companies).values({ name: "Storage access fixture" }).returning();
    await db.insert(affiliations).values([{ personId: owner.id, orgId: company.id, role: "MEMBER" }, { personId: manager.id, orgId: company.id, role: "MANAGER" }]);
    return { db, owner, manager, outsider, key };
  }
  it("requires owner or explicit shared access through an active manager affiliation", async () => {
    const { db, owner, manager, outsider, key } = await fixture();
    expect(await canReadPrivateFile(key, null)).toBe(false);
    expect(await canReadPrivateFile(key, owner)).toBe(true);
    expect(await canReadPrivateFile(key, manager)).toBe(false);
    await db.update(users).set({ passportShared: true }).where(eq(users.id, owner.id));
    expect(await canReadPrivateFile(key, manager)).toBe(true);
    expect(await canReadPrivateFile(key, outsider)).toBe(false);
    await db.update(affiliations).set({ status: "INACTIVE" }).where(eq(affiliations.personId, owner.id));
    expect(await canReadPrivateFile(key, manager)).toBe(false);
  });
  it("revokes old links when sharing is disabled and rejects suspended users", async () => {
    const { db, owner, manager, key } = await fixture();
    await db.update(users).set({ passportShared: true }).where(eq(users.id, owner.id));
    expect(await canReadPrivateFile(key, manager)).toBe(true);
    await db.update(users).set({ passportShared: false }).where(eq(users.id, owner.id));
    expect(await canReadPrivateFile(key, manager)).toBe(false);
    expect(await canReadPrivateFile(key, { ...owner, status: "suspended" })).toBe(false);
  });
  it("scopes invoice generation, download and order history to the purchaser", async () => {
    const { db, owner, outsider } = await fixture();
    const key = `invoices/${randomUUID()}.pdf`;
    const [order] = await db.insert(orders).values({ userId: owner.id, totalHt: "10", totalTtc: "12", invoiceUrl: `/storage/${key}` }).returning();
    expect(await canReadPrivateFile(key, owner)).toBe(true);
    expect(await canReadPrivateFile(key, outsider)).toBe(false);
    expect(await generateInvoicePDF(order.id, "https://example.test", outsider.id)).toBeNull();
    expect(await getUserOrders(outsider.id)).toHaveLength(0);
    expect((await getUserOrders(owner.id))[0].id).toBe(order.id);
  });
  it("does not expose login credentials on public certificate verification", async () => {
    const { db, owner } = await fixture();
    const code = randomUUID().replaceAll("-", "").slice(0, 24);
    await db.insert(certificates).values({ enrollmentId: -owner.id, userId: owner.id, trainingId: 999999, certificateNumber: randomUUID(), verificationCode: code });
    const certificate = await getCertificateByCode(code);
    expect(certificate?.user).toEqual({ name: "owner" });
  });
  it("returns a minimal public verification and distinguishes expired and revoked certificates",async()=>{
    const {db,owner}=await fixture();
    const [course]=await db.insert(trainings).values({title:'Verification course',slug:randomUUID(),description:'Private course description',isPublished:false,part147Reference:'TEST-REFERENCE'}).returning();
    const code=randomUUID().replaceAll('-','');
    const [cert]=await db.insert(certificates).values({enrollmentId:-owner.id,userId:owner.id,trainingId:course.id,certificateNumber:randomUUID(),verificationCode:code,pdfUrl:'/storage/certificates/private.pdf',expiresAt:new Date(Date.now()-1000),isValid:true}).returning();
    const caller=appRouter.createCaller({user:null,req:{headers:{},ip:'127.0.0.1'},res:{}} as any);
    const result=await caller.public.verifyCertificate({code});
    expect(result?.status).toBe('expired');
    expect(Object.keys(result!).sort()).toEqual(['certificateNumber','expiresAt','issuedAt','status','training','user']);
    expect(result?.training).toEqual({title:'Verification course',part147Reference:'TEST-REFERENCE'});
    expect(result?.user).toEqual({name:'owner'});
    await db.update(certificates).set({isValid:false}).where(eq(certificates.id,cert.id));
    expect((await caller.public.verifyCertificate({code}))?.status).toBe('revoked');
    await db.update(certificates).set({isValid:true,expiresAt:new Date(Date.now()+86400000)}).where(eq(certificates.id,cert.id));
    expect((await caller.public.verifyCertificate({code}))?.status).toBe('valid');
    await expect(caller.public.verifyCertificate({code:'x'.repeat(33)})).rejects.toMatchObject({code:'BAD_REQUEST'});
  });

  it("limits certificate files to the active holder or administrator, including revoked documents",async()=>{
    const {db,owner,outsider,manager}=await fixture();
    const key=`certificates/${randomUUID()}.pdf`;
    await db.insert(certificates).values({enrollmentId:-owner.id,userId:owner.id,trainingId:999999,certificateNumber:randomUUID(),verificationCode:randomUUID().replaceAll('-',''),pdfUrl:`/storage/${key}`,isValid:false});
    expect(await canReadPrivateFile(key,null)).toBe(false);
    expect(await canReadPrivateFile(key,owner)).toBe(true);
    expect(await canReadPrivateFile(key,outsider)).toBe(false);
    expect(await canReadPrivateFile(key,manager)).toBe(false);
    expect(await canReadPrivateFile(key,{...outsider,role:'admin'})).toBe(false);
    const [admin]=await db.update(users).set({role:'admin'}).where(eq(users.id,outsider.id)).returning();
    expect(await canReadPrivateFile(key,admin)).toBe(true);
    await db.update(users).set({role:'user'}).where(eq(users.id,outsider.id));
    expect(await canReadPrivateFile(key,admin)).toBe(false);
    const [renewed]=await db.update(users).set({sessionVersion:owner.sessionVersion+1}).where(eq(users.id,owner.id)).returning();
    expect(await canReadPrivateFile(key,owner)).toBe(false);
    expect(await canReadPrivateFile(key,renewed)).toBe(true);
    expect(await canReadPrivateFile(key,{...owner,status:'suspended'})).toBe(false);
    expect(await canReadPrivateFile(`certificates/${randomUUID()}.pdf`,{...outsider,role:'admin'})).toBe(false);
  });

});

describe("storage paths", () => {
  it("rejects traversal, absolute paths, null bytes and platform-specific separators", () => {
    for (const key of ["../private", "/etc/passwd", "passport/../invoice", "a\\b", "a\0b", "a//b", "a/./b"]) {
      expect(() => normalizeStorageKey(key)).toThrow();
    }
    expect(normalizeStorageKey("passport/1/document.pdf")).toBe("passport/1/document.pdf");
  });
});
