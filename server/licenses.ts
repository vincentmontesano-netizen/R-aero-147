import { and, eq, inArray, isNull, or, sql, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { trainingLicenses, trainingVersions, affiliations, companies, users, enrollments, orders, trainings } from "../drizzle/schema";
import { requireManagedCompany } from "./companyTraining";
type Actor = { id: number; role: string };
export async function listLicenses(actor: Actor) {
  const db = (await getDb())!;
  const orgs = await db.select({ id: companies.id }).from(affiliations).innerJoin(companies, eq(companies.id, affiliations.orgId))
    .where(and(eq(affiliations.personId, actor.id), eq(affiliations.role, "MANAGER"), eq(affiliations.status, "ACTIVE"), eq(companies.status, "ACTIVE")));
  return db.select({ id: trainingLicenses.id, orderId: trainingLicenses.orderId, trainingId: trainingLicenses.trainingId, ownerOrgId: trainingLicenses.ownerOrgId,
    assignedName: users.name, assignedUserId: trainingLicenses.assignedUserId, assignedAt: trainingLicenses.assignedAt, enrollmentId: trainingLicenses.enrollmentId, revokedAt: trainingLicenses.revokedAt,
    title: sql<string>`${trainingVersions.snapshot}->'training'->>'title'`, version: trainingVersions.version, paymentStatus: orders.status,
  }).from(trainingLicenses).innerJoin(trainingVersions, eq(trainingVersions.id, trainingLicenses.trainingVersionId)).innerJoin(orders, eq(orders.id, trainingLicenses.orderId)).leftJoin(users, eq(users.id, trainingLicenses.assignedUserId))
    .where(actor.role === "admin" ? undefined : or(and(isNull(trainingLicenses.ownerOrgId), eq(trainingLicenses.ownerUserId, actor.id)), inArray(trainingLicenses.ownerOrgId, orgs.map(o => o.id))))
    .orderBy(desc(trainingLicenses.id)).limit(1000);
}
export async function licenseCandidates(actor: Actor, licenseId: number) {
  const db = (await getDb())!;
  const [license] = await db.select().from(trainingLicenses).where(eq(trainingLicenses.id, licenseId));
  if (!license?.ownerOrgId) throw new TRPCError({ code: "FORBIDDEN" });
  await requireManagedCompany(actor, license.ownerOrgId);
  return db.select({ id: users.id, name: users.name, email: users.email }).from(affiliations).innerJoin(users, eq(users.id, affiliations.personId))
    .where(and(eq(affiliations.orgId, license.ownerOrgId), eq(affiliations.status, "ACTIVE"), eq(users.status, "active")));
}
export async function assignLicense(actor: Actor, licenseId: number, userId: number) {
  const db = (await getDb())!;
  return db.transaction(async tx => {
    const [reference] = await tx.select().from(trainingLicenses).where(eq(trainingLicenses.id, licenseId));
    if (!reference) throw new TRPCError({ code: "NOT_FOUND" });
    const [order] = await tx.select().from(orders).where(eq(orders.id, reference.orderId)).for("update");
    const [license] = await tx.select().from(trainingLicenses).where(eq(trainingLicenses.id, licenseId)).for("update");
    if (order?.status !== "paid" || license.revokedAt) throw new TRPCError({ code: "FORBIDDEN", message: "Cette licence n’est plus disponible." });
    await tx.select().from(trainings).where(eq(trainings.id, license.trainingId)).for("update");
    if (license.ownerOrgId != null) {
      const [company] = await tx.select().from(companies).where(eq(companies.id, license.ownerOrgId)).for("update");
      if (company?.status !== "ACTIVE") throw new TRPCError({ code: "FORBIDDEN" });
      const [manager] = await tx.select().from(affiliations).where(and(eq(affiliations.personId, actor.id), eq(affiliations.orgId, company.id), eq(affiliations.role, "MANAGER"), eq(affiliations.status, "ACTIVE"))).for("update");
      if (actor.role !== "admin" && !manager) throw new TRPCError({ code: "FORBIDDEN" });
      const [member] = await tx.select().from(affiliations).innerJoin(users, eq(users.id, affiliations.personId)).where(and(eq(affiliations.personId, userId), eq(affiliations.orgId, company.id), eq(affiliations.status, "ACTIVE"), eq(users.status, "active"))).for("update");
      if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "Compte affilié actif requis." });
    } else if (actor.id !== license.ownerUserId || userId !== license.ownerUserId) throw new TRPCError({ code: "FORBIDDEN" });
    if (license.assignedUserId != null) {
      if (license.assignedUserId === userId && license.enrollmentId) return { enrollmentId: license.enrollmentId, existing: true };
      throw new TRPCError({ code: "CONFLICT", message: "Cette place est déjà attribuée." });
    }
    const active = await tx.select().from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.trainingId, license.trainingId)));
    if (active.some(e => e.status !== "expired" && (!e.expiresAt || e.expiresAt.getTime() > Date.now()))) throw new TRPCError({ code: "CONFLICT", message: "Cet apprenant possède déjà un accès actif. La place reste disponible." });
    await tx.update(trainingLicenses).set({ assignedUserId: userId, assignedBy: actor.id, assignedAt: new Date() }).where(eq(trainingLicenses.id, licenseId));
    const [enrollment] = await tx.insert(enrollments).values({ userId, trainingId: license.trainingId, orderId: order.id, trainingLicenseId: license.id,
      assignedOrgId: license.ownerOrgId, assignedBy: actor.id }).returning();
    await tx.update(trainingLicenses).set({ enrollmentId: enrollment.id }).where(eq(trainingLicenses.id, licenseId));
    return { enrollmentId: enrollment.id, existing: false };
  });
}
