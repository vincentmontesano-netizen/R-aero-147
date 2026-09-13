import { storagePut } from "./storage";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { createPassportDocument, deletePassportDocument, getPassportDocuments, getPassportHistory, getPassportHistoryPage, setPassportSharing, validatePassportFile } from "./passport";
import { canReadPrivateFile } from "./storageAccess";
import { passportDocuments, passportEvents, users, companies, affiliations } from "../drizzle/schema";
vi.mock("./storage", () => ({ storagePut: vi.fn(async (key: string) => ({ key, url: `/storage/${key}-${randomUUID()}` })) }));
const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)("passport archive · PostgreSQL", () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  async function fixture() {
    const db = (await getDb())!;
    const [owner, manager, outsider] = await db.insert(users).values(["owner", "manager", "outsider"].map(name => ({ openId: randomUUID(), name }))).returning();
    const [company] = await db.insert(companies).values({ name: "Passport fixture" }).returning();
    await db.insert(affiliations).values([{ personId: owner.id, orgId: company.id, role: "MEMBER" }, { personId: manager.id, orgId: company.id, role: "MANAGER" }]);
    const bytes = Buffer.from("%PDF-1.7\nfixture-only\n%%EOF");
    const doc = await createPassportDocument({ personId: owner.id, kind: "LICENSE", title: "Licence fixture", contentType: "application/pdf", fileName: "licence.pdf", dataBase64: bytes.toString("base64") });
    return { db, owner, manager, outsider, company, doc, bytes, key: doc.fileUrl.slice("/storage/".length) };
  }
  it("archives once under concurrency, preserves evidence and removes company access to old links", async () => {
    const { db, owner, manager, outsider, doc, bytes, key } = await fixture();
    expect(doc.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    await setPassportSharing(owner.id, true);
    expect(await canReadPrivateFile(key, manager)).toBe(true);
    expect(await deletePassportDocument(doc.id, outsider.id)).toEqual({ ok: false });
    expect(await Promise.all([deletePassportDocument(doc.id, owner.id), deletePassportDocument(doc.id, owner.id)])).toEqual([{ ok: true }, { ok: true }]);
    expect(await getPassportDocuments(owner.id)).toHaveLength(0);
    expect(await getPassportDocuments(owner.id, true)).toHaveLength(1);
    expect(await canReadPrivateFile(key, manager)).toBe(false);
    expect(await canReadPrivateFile(key, owner)).toBe(true);
    expect(await canReadPrivateFile(key, outsider)).toBe(false);
    expect((await getPassportHistory(owner.id)).filter(e => e.action === "archived")).toHaveLength(1);
    expect(await getPassportHistory(outsider.id)).toHaveLength(0);
    await expect(db.delete(passportDocuments).where(eq(passportDocuments.id, doc.id))).rejects.toThrow();
    await expect(db.update(passportDocuments).set({ archivedAt: null }).where(eq(passportDocuments.id, doc.id))).rejects.toThrow();
    await expect(db.delete(passportEvents).where(eq(passportEvents.personId, owner.id))).rejects.toThrow();
  });
  it("pages the owner's immutable history without duplicates when new events arrive", async () => {
    const { db, owner, outsider } = await fixture();
    const inserted = await db.insert(passportEvents).values(Array.from({ length: 205 }, () => ({ personId: owner.id, actorId: owner.id, action: 'sharing_changed', data: { before: false, after: true } }))).returning();
    await db.insert(passportEvents).values({ personId: outsider.id, actorId: outsider.id, action: 'sharing_changed', data: { before: false, after: true } });
    const expected = (await db.select().from(passportEvents).where(eq(passportEvents.personId, owner.id))).map(event => event.id).sort((a, b) => b - a);
    const first = await getPassportHistoryPage(owner.id);
    expect(first.entries).toHaveLength(100);
    expect(first.entries[0].id).toBe(inserted[204].id);
    await db.insert(passportEvents).values({ personId: owner.id, actorId: owner.id, action: 'sharing_changed', data: { before: true, after: false } });
    const second = await getPassportHistoryPage(owner.id, first.nextCursor!);
    const third = await getPassportHistoryPage(owner.id, second.nextCursor!);
    expect(second.entries).toHaveLength(100);
    expect(third.entries).toHaveLength(6);
    expect(third.nextCursor).toBeNull();
    expect([...first.entries, ...second.entries, ...third.entries].map(event => event.id)).toEqual(expected);
    expect((await getPassportHistory(owner.id))).toHaveLength(100);
    await expect(getPassportHistoryPage(owner.id, -1)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, owner.id));
    await expect(getPassportHistoryPage(owner.id, first.nextCursor!)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it("reuses one stored upload and event for concurrent retries, including after archival", async () => {
    const { db, owner, outsider, bytes } = await fixture();
    const input = { personId: owner.id, kind: 'LICENSE' as const, title: ' Retry fixture ', contentType: 'application/pdf', fileName: 'retry.pdf', dataBase64: bytes.toString('base64'), requestId: randomUUID() };
    const stored = vi.mocked(storagePut).mock.calls.length;
    const receipts = await Promise.all([createPassportDocument(input), createPassportDocument(input), createPassportDocument({ ...input, requestId: input.requestId.toUpperCase() })]);
    expect(new Set(receipts.map(document => document.id)).size).toBe(1);
    expect(vi.mocked(storagePut).mock.calls.length).toBe(stored + 1);
    expect((await getPassportHistory(owner.id)).filter(event => event.documentId === receipts[0].id)).toHaveLength(1);
    for (const changed of [{ title: 'Changed' }, { fileName: 'changed.pdf' }, { issuedAt: new Date('2026-01-01') }, { dataBase64: Buffer.from('%PDF-1.7\nDifferent').toString('base64') }]) {
      await expect(createPassportDocument({ ...input, ...changed })).rejects.toMatchObject({ code: 'CONFLICT' });
    }
    expect(vi.mocked(storagePut).mock.calls.length).toBe(stored + 1);
    const foreign = await createPassportDocument({ ...input, personId: outsider.id });
    expect(foreign.id).not.toBe(receipts[0].id);
    await deletePassportDocument(receipts[0].id, owner.id);
    const archived = await createPassportDocument(input);
    expect(archived.id).toBe(receipts[0].id);
    expect(archived.archivedAt).not.toBeNull();
    expect((await getPassportHistory(owner.id)).filter(event => event.documentId === archived.id && event.action === 'uploaded')).toHaveLength(1);
    expect(vi.mocked(storagePut).mock.calls.length).toBe(stored + 2);
    await expect(db.update(passportDocuments).set({ requestId: randomUUID() }).where(eq(passportDocuments.id, foreign.id))).rejects.toThrow();
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, owner.id));
    await expect(createPassportDocument(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it("refuses inactive owners before storage, archive and sharing writes while preserving their history", async () => {
    const { db, owner, doc, bytes } = await fixture();
    await setPassportSharing(owner.id, true);
    const before = await getPassportHistory(owner.id);
    const stored = vi.mocked(storagePut).mock.calls.length;
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, owner.id));
    for (const operation of [
      () => getPassportDocuments(owner.id),
      () => getPassportDocuments(owner.id, true),
      () => getPassportHistory(owner.id),
      () => createPassportDocument({ personId: owner.id, kind: 'LICENSE', title: 'Denied', contentType: 'application/pdf', fileName: 'denied.pdf', dataBase64: bytes.toString('base64') }),
      () => deletePassportDocument(doc.id, owner.id),
      () => setPassportSharing(owner.id, false),
      () => setPassportSharing(owner.id, true),
    ]) await expect(operation()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(vi.mocked(storagePut).mock.calls.length).toBe(stored);
    expect((await db.select().from(passportDocuments).where(eq(passportDocuments.personId, owner.id)))).toHaveLength(1);
    expect((await db.select().from(passportDocuments).where(eq(passportDocuments.id, doc.id)))[0].archivedAt).toBeNull();
    expect((await db.select().from(users).where(eq(users.id, owner.id)))[0].passportShared).toBe(true);
    expect(await db.select().from(passportEvents).where(eq(passportEvents.personId, owner.id))).toHaveLength(before.length);
  });

  it("locks active document content and records sharing changes without duplicate events", async () => {
    const { db, owner, manager, company, doc, key } = await fixture();
    await expect(db.update(passportDocuments).set({ fileUrl: "/storage/changed" }).where(eq(passportDocuments.id, doc.id))).rejects.toThrow();
    await Promise.all([setPassportSharing(owner.id, true), setPassportSharing(owner.id, true)]);
    expect((await getPassportHistory(owner.id)).filter(e => e.action === "sharing_changed")).toHaveLength(1);
    expect(await canReadPrivateFile(key, manager)).toBe(true);
    await db.update(companies).set({ status: "SUSPENDED" }).where(eq(companies.id, company.id));
    expect(await canReadPrivateFile(key, manager)).toBe(false);
    await setPassportSharing(owner.id, false);
    const history = await getPassportHistory(owner.id);
    expect(history[0].data).toEqual({ before: true, after: false });
  });
});
describe("passport file validation", () => {
  it("rejects malformed encodings, wrong media signatures, oversized files and accepts bounded PDF bytes", () => {
    const pdf = Buffer.from("%PDF-1.7\nfixture");
    expect(validatePassportFile({ contentType: "application/pdf", dataBase64: pdf.toString("base64") })).toEqual(pdf);
    for (const value of ["", "!!!", "YW=J", Buffer.from("<script>bad</script>").toString("base64")]) expect(() => validatePassportFile({ contentType: "application/pdf", dataBase64: value })).toThrow();
    expect(() => validatePassportFile({ contentType: "text/html", dataBase64: pdf.toString("base64") })).toThrow();
    expect(() => validatePassportFile({ contentType: "application/pdf", dataBase64: "A".repeat(13981020) })).toThrow();
    const large = Buffer.alloc(1024 * 1024, 32); pdf.copy(large);
    expect(validatePassportFile({ contentType: "application/pdf", dataBase64: large.toString("base64") }).length).toBe(large.length);
  });
});
