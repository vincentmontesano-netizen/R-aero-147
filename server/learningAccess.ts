import { hasSubscriptionCapacity } from "../shared/subscriptionCapacity";
import { eq, and } from "drizzle-orm";
import { orders, trainingLicenses, employees } from "../drizzle/schema";
import { assertActiveAffiliation } from "./access";
import { readCurriculum } from "./curriculum";
import { TRPCError } from "@trpc/server";
import { getUserById, getDb, getEnrollmentById, getUserEnrollments, getCompanyById } from "./db";
import type { QuizQuestion, Enrollment } from "../drizzle/schema";

/** Learner routes never grant staff an implicit bypass into another person's record. */
export async function requireEnrollment(userId: number, enrollmentId: number, trainingId?: number) {
  const person=await getUserById(userId);
  if(person?.status!=='active')throw new TRPCError({code:'FORBIDDEN',message:'Compte actif requis.'});
  const enrollment = await getEnrollmentById(enrollmentId, userId);
  if (!enrollment || (trainingId !== undefined && enrollment.trainingId !== trainingId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Cette inscription ne vous est pas accessible." });
  }
  if (enrollment.status === "expired" || (enrollment.expiresAt && enrollment.expiresAt.getTime() <= Date.now())) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Votre accès à cette formation a expiré." });
  }
  await requireAssignedOrganization(userId, enrollment.assignedOrgId);
  await requirePaidAccess(enrollment);
  await requireSubscriptionAccess(enrollment);
  return enrollment;
}

export async function requireTrainingAccess(userId: number, trainingId: number) {
  const enrollments = await getUserEnrollments(userId);
  for (const candidate of enrollments) {
    if (candidate.trainingId !== trainingId) continue;
    try { return await requireEnrollment(userId, candidate.id, trainingId); }
    catch (error) {
      if (!(error instanceof TRPCError) || error.code !== "FORBIDDEN") throw error;
    }
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "Une inscription active à cette formation est requise." });
}

/** Explicit projection: answer keys and explanations stay on the grading server. */
export function learnerQuestion(q: QuizQuestion) {
  return {
    id: q.id, trainingId: q.trainingId, moduleId: q.moduleId, objectiveId: q.objectiveId,
    type: q.type, question: q.question, options: q.options, optionsRight: q.optionsRight, points: q.points, sortOrder: q.sortOrder,
  };
}

export async function learnerCurriculum(userId: number, trainingId: number, enrollmentId?: number) {
  const enrollment = enrollmentId != null ? await requireEnrollment(userId, enrollmentId, trainingId) : await requireTrainingAccess(userId, trainingId);
  return readCurriculum(enrollment.trainingVersionId);
}

async function requireAssignedOrganization(userId: number, orgId?: number | null) {
  if (!orgId) return;
  await assertActiveAffiliation(userId, orgId);
  const company = await getCompanyById(orgId);
  if (company?.status !== "ACTIVE") throw new TRPCError({ code: "FORBIDDEN", message: "Accès compagnie suspendu." });
}

async function requirePaidAccess(enrollment: { id: number; orderId?: number | null; trainingLicenseId?: number | null }) {
  if (!enrollment.orderId) return;
  const db = (await getDb())!;
  const [order] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, enrollment.orderId));
  if (order?.status !== "paid") throw new TRPCError({ code: "FORBIDDEN", message: "L’accès lié à cette commande n’est pas actif." });
  if (enrollment.trainingLicenseId) {
    const [license] = await db.select().from(trainingLicenses).where(eq(trainingLicenses.id, enrollment.trainingLicenseId));
    if (!license || license.revokedAt || license.enrollmentId !== enrollment.id) throw new TRPCError({ code: "FORBIDDEN", message: "Licence inactive." });
  }
}

async function requireSubscriptionAccess(enrollment: Enrollment) {
  if (!enrollment.stripeSubscriptionId) return;
  const company = enrollment.assignedOrgId ? await getCompanyById(enrollment.assignedOrgId) : null;
  if (!company || company.stripeSubscriptionId !== enrollment.stripeSubscriptionId || company.subscriptionType === "none" ||
      company.subscriptionStatus !== "active" || !company.subscriptionExpiresAt || company.subscriptionExpiresAt.getTime() <= Date.now()) {
    throw new TRPCError({ code: "FORBIDDEN", message: "L’abonnement associé à cette inscription n’est pas actif." });
  }
  const db = (await getDb())!;
  const roster = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.companyId, company.id), eq(employees.isActive, true)));
  if (!hasSubscriptionCapacity(company, roster.length)) throw new TRPCError({ code: "FORBIDDEN", message: "L’effectif actif dépasse les places vérifiées de l’abonnement. Contactez votre responsable compagnie." });
  const [employee] = enrollment.employeeId ? await db.select().from(employees).where(eq(employees.id, enrollment.employeeId)) : [];
  if (!employee?.isActive || employee.companyId !== company.id || employee.userId !== enrollment.userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Votre accès salarié à cet abonnement n’est plus actif." });
  }
}
