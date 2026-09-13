import { createHash } from "node:crypto";
import { and, desc, eq, isNull, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { requireAuthorCourse, courseOwnership, listAuthorCourses } from "./makerAccess";
import { assessCourse } from "./courseReadiness";
import { trainings, trainingModules, quizQuestions, slides, learningObjectives, pedagogicalReviews, pedagogicalDecisions, pedagogicalWithdrawals, trainingVersions, type CurriculumSnapshot } from "../drizzle/schema";
type Actor = { id: number; role: string };
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export function curriculumFingerprint(snapshot: CurriculumSnapshot) {
  const plain = JSON.parse(JSON.stringify(snapshot));
  for (const key of ["isPublished", "publishedVersionId", "version", "reviewStatus", "isFeatured", "createdAt", "updatedAt"]) delete plain.training[key];
  for (const key of ["modules", "questions", "slides", "objectives"]) {
    plain[key].sort((a: { id: number }, b: { id: number }) => a.id - b.id);
    for (const item of plain[key]) { delete item.createdAt; delete item.updatedAt; }
  }
  const stable = (v: any): any => Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
  return createHash("sha256").update(JSON.stringify(stable(plain))).digest("hex");
}
export async function requireApprovedReview(tx: Tx, snapshot: CurriculumSnapshot) {
  if (snapshot.training.type !== "elearning") return null;
  const [review] = await tx.select({ id: pedagogicalReviews.id, decision: pedagogicalDecisions.decision, withdrawalId: pedagogicalWithdrawals.id }).from(pedagogicalReviews)
    .leftJoin(pedagogicalDecisions, eq(pedagogicalDecisions.reviewId, pedagogicalReviews.id))
    .leftJoin(pedagogicalWithdrawals, eq(pedagogicalWithdrawals.reviewId, pedagogicalReviews.id))
    .where(and(eq(pedagogicalReviews.trainingId, snapshot.training.id), eq(pedagogicalReviews.fingerprint, curriculumFingerprint(snapshot)))).orderBy(desc(pedagogicalReviews.id)).limit(1);
  if (!review || review.decision !== "approved" || review.withdrawalId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cette version doit être relue et approuvée avant publication." });
  return review.id;
}
export async function requestPedagogicalReview(actor: Actor, trainingId: number) {
  await requireAuthorCourse(actor, trainingId);
  const db = (await getDb())!;
  return db.transaction(async tx => {
    const [training] = await tx.select().from(trainings).where(eq(trainings.id, trainingId)).for("update");
    const modules = await tx.select().from(trainingModules).where(and(eq(trainingModules.trainingId, trainingId), isNull(trainingModules.archivedAt)));
    const questions = await tx.select().from(quizQuestions).where(and(eq(quizQuestions.trainingId, trainingId), isNull(quizQuestions.archivedAt)));
    const deck = await tx.select().from(slides).where(and(eq(slides.trainingId, trainingId), isNull(slides.archivedAt)));
    const objectives = await tx.select().from(learningObjectives).where(and(eq(learningObjectives.trainingId, trainingId), isNull(learningObjectives.archivedAt)));
    if (!assessCourse(training, modules, questions, deck).ready) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Complétez le parcours avant de demander une revue." });
    const snapshot = { training, modules, questions, slides: deck, objectives };
    const fingerprint = curriculumFingerprint(snapshot);
    const [existing] = await tx.select().from(pedagogicalReviews).where(and(eq(pedagogicalReviews.trainingId, trainingId), eq(pedagogicalReviews.fingerprint, fingerprint))).orderBy(desc(pedagogicalReviews.id)).limit(1);
    if (existing) {
      const [decision] = await tx.select().from(pedagogicalDecisions).where(eq(pedagogicalDecisions.reviewId, existing.id));
      const [withdrawal] = await tx.select().from(pedagogicalWithdrawals).where(eq(pedagogicalWithdrawals.reviewId, existing.id));
      if (decision?.decision !== "rejected" && !withdrawal) return { id: existing.id };
    }
    const [review] = await tx.insert(pedagogicalReviews).values({ trainingId, requestedBy: actor.id, snapshot, fingerprint }).returning({ id: pedagogicalReviews.id });
    return review;
  });
}
async function canReview(actor: Actor, review: typeof pedagogicalReviews.$inferSelect) {
  if (actor.id === review.requestedBy || actor.id === review.snapshot.training.ownerUserId) throw new TRPCError({ code: "FORBIDDEN", message: "La revue doit être réalisée par une autre personne que l’auteur et le demandeur." });
  if (actor.role === "admin") return;
  const orgId = review.snapshot.training.ownerOrgId;
  if (!orgId) throw new TRPCError({ code: "FORBIDDEN" });
  await courseOwnership(actor, orgId);
}
export async function listPedagogicalReviews(actor: Actor, trainingId: number) {
  await requireAuthorCourse(actor, trainingId);
  const db = (await getDb())!;
  return db.select({ id: pedagogicalReviews.id, requestedBy: pedagogicalReviews.requestedBy, createdAt: pedagogicalReviews.createdAt, decision: pedagogicalDecisions.decision, reviewedBy: pedagogicalDecisions.reviewedBy, note: pedagogicalDecisions.note, withdrawnAt: pedagogicalWithdrawals.createdAt, withdrawalReason: pedagogicalWithdrawals.reason })
    .from(pedagogicalReviews).leftJoin(pedagogicalDecisions, eq(pedagogicalDecisions.reviewId, pedagogicalReviews.id)).leftJoin(pedagogicalWithdrawals, eq(pedagogicalWithdrawals.reviewId, pedagogicalReviews.id)).where(eq(pedagogicalReviews.trainingId, trainingId)).orderBy(desc(pedagogicalReviews.id));
}
export async function reviewSnapshot(actor: Actor, reviewId: number) {
  const db = (await getDb())!;
  const [review] = await db.select().from(pedagogicalReviews).where(eq(pedagogicalReviews.id, reviewId));
  if (!review) throw new TRPCError({ code: "NOT_FOUND" });
  await requireAuthorCourse(actor, review.trainingId);
  return review;
}
export async function decidePedagogicalReview(actor: Actor, reviewId: number, decision: "approved" | "rejected", note: string) {
  const db = (await getDb())!;
  const review = await reviewSnapshot(actor, reviewId);
  await canReview(actor, review);
  if (!note.trim()) throw new TRPCError({ code: "BAD_REQUEST" });
  const [result] = await db.insert(pedagogicalDecisions).values({ reviewId, reviewedBy: actor.id, decision, note: note.trim() }).onConflictDoNothing().returning();
  if (!result) throw new TRPCError({ code: "CONFLICT", message: "Cette revue a déjà été décidée." });
  return { success: true };
}

export async function pendingPedagogicalReviews(actor: Actor) {
  const db = (await getDb())!;
  const courses = await listAuthorCourses(actor);
  if (!courses.length) return [];
  const rows = await db.select({ id: pedagogicalReviews.id, trainingId: pedagogicalReviews.trainingId, requestedBy: pedagogicalReviews.requestedBy, createdAt: pedagogicalReviews.createdAt }).from(pedagogicalReviews)
    .leftJoin(pedagogicalDecisions, eq(pedagogicalDecisions.reviewId, pedagogicalReviews.id)).where(and(inArray(pedagogicalReviews.trainingId, courses.map(c => c.id)), isNull(pedagogicalDecisions.id))).orderBy(desc(pedagogicalReviews.id)).limit(100);
  return rows.filter(r => r.requestedBy !== actor.id && courses.find(c => c.id === r.trainingId)?.ownerUserId !== actor.id).map(r => ({ ...r, title: courses.find(c => c.id === r.trainingId)!.title }));
}

export async function withdrawPedagogicalApproval(actor: Actor, reviewId: number, reason: string) {
  const review = await reviewSnapshot(actor, reviewId);
  if (reason.trim().length < 10) throw new TRPCError({ code: "BAD_REQUEST", message: "Précisez le motif du retrait." });
  const db = (await getDb())!;
  return db.transaction(async tx => {
    // Same course lock as publication: a concurrent publication cannot escape withdrawal.
    const [course] = await tx.select().from(trainings).where(eq(trainings.id, review.trainingId)).for("update");
    const [decision] = await tx.select().from(pedagogicalDecisions).where(eq(pedagogicalDecisions.reviewId, reviewId));
    if (decision?.decision !== "approved") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Seule une approbation peut être retirée." });
    const [withdrawal] = await tx.insert(pedagogicalWithdrawals).values({ reviewId, withdrawnBy: actor.id, reason: reason.trim() }).onConflictDoNothing().returning();
    if (!withdrawal) return { success: true };
    const [published] = course.publishedVersionId ? await tx.select().from(trainingVersions).where(eq(trainingVersions.id, course.publishedVersionId)) : [];
    if (published?.reviewId === reviewId) await tx.update(trainings).set({ isPublished: false, reviewStatus: "needs_review" }).where(eq(trainings.id, course.id));
    return { success: true };
  });
}
