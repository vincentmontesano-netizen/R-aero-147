import { and, eq, inArray, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { affiliations, companies, users, trainings, enrollments, employees } from "../drizzle/schema";
import { requireAuthorCourse } from "./makerAccess";
type Actor = { id: number; role: string; companyId?: number | null };
export async function requireManagedCompany(actor: Actor, companyId = actor.companyId) {
  const db = (await getDb())!;
  if (!companyId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Sélectionnez une compagnie." });
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  if (!company || company.status !== "ACTIVE") throw new TRPCError({ code: "FORBIDDEN" });
  if (actor.role !== "admin") {
    const [aff] = await db.select().from(affiliations).where(and(eq(affiliations.personId, actor.id), eq(affiliations.orgId, companyId), eq(affiliations.role, "MANAGER"), eq(affiliations.status, "ACTIVE")));
    if (!aff) throw new TRPCError({ code: "FORBIDDEN", message: "Une affiliation manager active est requise." });
  }
  return companyId;
}
export async function requireManagedEmployee(actor: Actor, employeeId: number) {
  const db = (await getDb())!;
  const [employee] = await db.select().from(employees).where(eq(employees.id, employeeId));
  if (!employee) throw new TRPCError({ code: "NOT_FOUND" });
  await requireManagedCompany(actor, employee.companyId);
  return employee;
}
export async function distributionCandidates(actor: Actor, trainingId: number) {
  const course = await requireAuthorCourse(actor, trainingId);
  if (!course.ownerOrgId) return [];
  await requireManagedCompany(actor, course.ownerOrgId);
  const db = (await getDb())!;
  return db.select({ id: users.id, name: users.name, email: users.email }).from(affiliations).innerJoin(users, eq(users.id, affiliations.personId))
    .where(and(eq(affiliations.orgId, course.ownerOrgId), eq(affiliations.status, "ACTIVE"), eq(users.status, "active")));
}
export async function assignCompanyTraining(actor: Actor, trainingId: number, userIds: number[]) {
  const db = (await getDb())!;
  return db.transaction(async tx => {
    const [course] = await tx.select().from(trainings).where(eq(trainings.id, trainingId)).for("update");
    if (!course?.ownerOrgId || course.archivedAt || !course.isPublished || !course.publishedVersionId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Publiez une version de cette formation interne avant attribution." });
    const [company] = await tx.select().from(companies).where(eq(companies.id, course.ownerOrgId)).for("update");
    if (company?.status !== "ACTIVE") throw new TRPCError({ code: "FORBIDDEN" });
    if (actor.role !== "admin") {
      const [manager] = await tx.select().from(affiliations).where(and(eq(affiliations.personId, actor.id), eq(affiliations.orgId, company.id), eq(affiliations.role, "MANAGER"), eq(affiliations.status, "ACTIVE"))).for("update");
      if (!manager) throw new TRPCError({ code: "FORBIDDEN" });
    }
    const ids = Array.from(new Set(userIds));
    const members = await tx.select({ id: users.id }).from(affiliations).innerJoin(users, eq(users.id, affiliations.personId))
      .where(and(eq(affiliations.orgId, company.id), eq(affiliations.status, "ACTIVE"), eq(users.status, "active"), inArray(users.id, ids))).for("update");
    if (new Set(members.map(m => m.id)).size !== ids.length) throw new TRPCError({ code: "FORBIDDEN", message: "Chaque apprenant doit avoir un compte actif affilié à cette compagnie." });
    let created = 0, existing = 0;
    for (const userId of ids) {
      const previous = await tx.select().from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.trainingId, trainingId))).orderBy(desc(enrollments.id));
      if (previous.some(e => e.status !== "expired" && (!e.expiresAt || e.expiresAt.getTime() > Date.now()))) { existing++; continue; }
      const [employee] = await tx.select().from(employees).where(and(eq(employees.companyId, company.id), eq(employees.userId, userId), eq(employees.isActive, true))).limit(1);
      await tx.insert(enrollments).values({ userId, trainingId, employeeId: employee?.id, assignedOrgId: company.id, assignedBy: actor.id });
      created++;
    }
    return { created, existing };
  });
}
