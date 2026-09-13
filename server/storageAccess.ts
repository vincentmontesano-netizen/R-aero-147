import { canReadCourseMedia } from "./courseMedia";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { affiliations, orders, passportDocuments, companies, users, verificationDocuments, verificationCases, approvalDocuments, certificates } from "../drizzle/schema";
import type { User } from "../drizzle/schema";

/** Re-evaluated for every download: an old link does not preserve revoked access. */
export async function canReadPrivateFile(key: string, actor: User | null): Promise<boolean> {
  if (!actor || actor.status !== "active") return false;
  const db = await getDb();
  if (!db) return false;
  const [current]=await db.select().from(users).where(eq(users.id,actor.id));
  if(current?.status!=='active'||current.sessionVersion!==actor.sessionVersion)return false;
  actor=current;
  if (key.startsWith("course-media/") || key.startsWith("courses/")) return canReadCourseMedia(key, actor);
  const url = `/storage/${key}`;
  if (key.startsWith("approval/")) {
    if (actor.role !== "admin") return false;
    return !!(await db.select({ id: approvalDocuments.id }).from(approvalDocuments).where(eq(approvalDocuments.fileUrl, url)).limit(1))[0];
  }
  if (key.startsWith("verification/")) {
    const document = (await db.select().from(verificationDocuments).where(eq(verificationDocuments.fileUrl, url)).limit(1))[0];
    if (!document || document.archivedAt) return false;
    const record = (await db.select().from(verificationCases).where(eq(verificationCases.id, document.caseId)).limit(1))[0];
    if (!record) return false;
    try { await (await import("./verification")).assertVerificationAccess(actor, record); return true; } catch { return false; }
  }
  if (key.startsWith("certificates/")) {
    const [certificate]=await db.select({userId:certificates.userId}).from(certificates).where(eq(certificates.pdfUrl,url)).limit(1);
    return !!certificate&&(actor.id===certificate.userId||actor.role==='admin');
  }
  if (key.startsWith("invoices/")) {
    const [archive]=await db.execute<{userId:number}>(sql`select "userId" from invoice_archives where "storageKey"=${key}`);
    if(archive)return actor.id===archive.userId||actor.role==="admin";
    const order = (await db.select({ userId: orders.userId }).from(orders).where(eq(orders.invoiceUrl, url)).limit(1))[0];
    return !!order && (actor.id === order.userId || actor.role === "admin");
  }
  if (!key.startsWith("passport/")) return false;
  const document = (await db.select().from(passportDocuments).where(eq(passportDocuments.fileUrl, url)).limit(1))[0];
  if (!document) return false;
  if (document.personId === actor.id || actor.role === "admin") return true;
  if (document.archivedAt) return false;
  const owner = (await db.select({ shared: users.passportShared }).from(users).where(eq(users.id, document.personId)).limit(1))[0];
  if (!owner?.shared) return false;
  const managerOrgs = await db.select({ orgId: affiliations.orgId }).from(affiliations).innerJoin(companies, eq(companies.id, affiliations.orgId)).where(and(
    eq(companies.status, "ACTIVE"), eq(affiliations.personId, actor.id), eq(affiliations.status, "ACTIVE"), eq(affiliations.role, "MANAGER"),
  ));
  const ownerOrgs = await db.select({ orgId: affiliations.orgId }).from(affiliations).where(and(
    eq(affiliations.personId, document.personId), eq(affiliations.status, "ACTIVE"),
  ));
  return managerOrgs.some(m => ownerOrgs.some(o => o.orgId === m.orgId));
}
