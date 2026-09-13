import { and, eq, isNull, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { trainings, trainingModules, quizQuestions, learningObjectives, slides, enrollments, contentEvents } from "../drizzle/schema";
export type ContentKind = "training" | "module" | "question" | "objective" | "slide";
const tables = { training: trainings, module: trainingModules, question: quizQuestions, objective: learningObjectives, slide: slides };
/** Whole-course archive preserves existing learners; individual content needs versioning once used. */
export async function archiveContent(kind: ContentKind, id: number, actorId?: number) {
  const db = (await getDb())!;
  return db.transaction(async tx => {
    const table = tables[kind];
    const [record] = await tx.select().from(table).where(eq(table.id, id));
    if (!record) throw new TRPCError({ code: "NOT_FOUND" });
    const trainingId = kind === "training" ? id : (record as { trainingId: number }).trainingId;
    const [course] = await tx.select().from(trainings).where(eq(trainings.id, trainingId)).for("update");
    if (!course) throw new TRPCError({ code: "NOT_FOUND" });
    const [current] = await tx.select().from(table).where(eq(table.id, id)).for("update");
    if (current.archivedAt) return { success: true as const };
    if (kind !== "training") {
      const used = await tx.select({ id: enrollments.id }).from(enrollments).where(and(eq(enrollments.trainingId, trainingId), isNull(enrollments.trainingVersionId))).limit(1);
      if (course.isPublished || used.length) throw new TRPCError({ code: "CONFLICT", message: "Dépubliez la formation avant archivage. Les inscriptions historiques sans version doivent être traitées par l’équipe pédagogique." });
      if (kind === "module") {
        for (const child of [quizQuestions, slides, learningObjectives]) {
          const linked = await tx.select({ id: child.id }).from(child).where(and(eq(child.moduleId, id), isNull(child.archivedAt))).limit(1);
          if (linked.length) throw new TRPCError({ code: "CONFLICT", message: "Réaffectez ou archivez d’abord les contenus de ce chapitre." });
        }
      }
      if (kind === "objective") {
        for (const child of [quizQuestions, slides, trainingModules]) {
          const linked = await tx.select({ id: child.id }).from(child).where(and(eq(child.objectiveId, id), isNull(child.archivedAt))).limit(1);
          if (linked.length) throw new TRPCError({ code: "CONFLICT", message: "Réaffectez d’abord les contenus liés à cet objectif." });
        }
      }
    }
    const patch = kind === "training" ? { archivedAt: new Date(), isPublished: false, isFeatured: false } : { archivedAt: new Date() };
    const [after] = await tx.update(table).set(patch).where(eq(table.id, id)).returning();
    await tx.insert(contentEvents).values({ trainingId, actorId, entityType: kind, entityId: id, action: "archived", beforeState: current, afterState: after });
    return { success: true as const };
  });
}

export async function contentHistory(trainingId: number) {
  const db = (await getDb())!;
  return db.select().from(contentEvents).where(eq(contentEvents.trainingId, trainingId)).orderBy(desc(contentEvents.id)).limit(100);
}
