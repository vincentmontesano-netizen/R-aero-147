import { validateCourseMediaReferences } from "./courseMedia";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { affiliations, companies, trainings, slides, trainingModules, learningObjectives } from "../drizzle/schema";

type Author = { id: number; role: string };
async function managerOrganizations(actor: Author) {
  const db = (await getDb())!;
  const rows = await db.select({ id: companies.id }).from(affiliations).innerJoin(companies, eq(companies.id, affiliations.orgId))
    .where(and(eq(affiliations.personId, actor.id), eq(affiliations.role, "MANAGER"), eq(affiliations.status, "ACTIVE"), eq(companies.status, "ACTIVE")));
  return rows.map(r => r.id);
}
export async function authorWorkspaces(actor: Author) {
  const db = (await getDb())!;
  const ids = actor.role === "admin" ? null : await managerOrganizations(actor);
  const organizations = await db.select({ orgId: companies.id, name: companies.name }).from(companies).where(and(eq(companies.status, "ACTIVE"), ids ? inArray(companies.id, ids) : undefined)).orderBy(companies.name);
  const result: Array<{ orgId: number | null; name: string | null }> = organizations;
  if (actor.role === "admin" || actor.role === "instructor") result.unshift({ orgId: null, name: null });
  return result;
}
export async function courseOwnership(actor: Author, orgId?: number) {
  if (orgId != null) {
    const db = (await getDb())!;
    const [org] = await db.select({ status: companies.status }).from(companies).where(eq(companies.id, orgId));
    if (org?.status !== "ACTIVE") throw new TRPCError({ code: "FORBIDDEN", message: "Organisation inactive ou introuvable." });
    if (actor.role !== "admin" && !(await managerOrganizations(actor)).includes(orgId)) throw new TRPCError({ code: "FORBIDDEN" });
    return { ownerUserId: actor.id, ownerOrgId: orgId };
  }
  if (actor.role === "admin" || actor.role === "instructor") return { ownerUserId: actor.id, ownerOrgId: null };
  const orgs = await managerOrganizations(actor);
  if (orgs.length !== 1) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Sélectionnez une organisation active pour créer la formation." });
  return { ownerUserId: actor.id, ownerOrgId: orgs[0] };
}
export async function listAuthorCourses(actor: Author) {
  const db = (await getDb())!;
  if (actor.role === "admin") return db.select().from(trainings).where(isNull(trainings.archivedAt)).orderBy(trainings.title);
  const orgs = await managerOrganizations(actor);
  return db.select().from(trainings).where(and(isNull(trainings.archivedAt), or(
    actor.role === "instructor" ? and(eq(trainings.ownerUserId, actor.id), isNull(trainings.ownerOrgId)) : undefined,
    inArray(trainings.ownerOrgId, orgs),
  ))).orderBy(trainings.title);
}
export async function requireAuthorCourse(actor: Author, trainingId: number, allowArchived = false) {
  const db = (await getDb())!;
  const course = (await db.select().from(trainings).where(eq(trainings.id, trainingId)).limit(1))[0];
  if (!course || (!allowArchived && course.archivedAt)) throw new TRPCError({ code: "NOT_FOUND" });
  if (actor.role === "admin") return course;
  const permitted = course.ownerOrgId != null ? (await managerOrganizations(actor)).includes(course.ownerOrgId)
    : actor.role === "instructor" && course.ownerUserId === actor.id;
  if (!permitted) throw new TRPCError({ code: "FORBIDDEN", message: "Cette formation n’appartient pas à votre espace de création." });
  return course;
}
export async function requireAuthorSlides(actor: Author, ids: number[]) {
  const db = (await getDb())!;
  const rows = await db.select().from(slides).where(and(inArray(slides.id, ids), isNull(slides.archivedAt)));
  if (rows.length !== new Set(ids).size) throw new TRPCError({ code: "NOT_FOUND" });
  for (const trainingId of Array.from(new Set(rows.map(r => r.trainingId)))) await requireAuthorCourse(actor, trainingId);
  return rows;
}
export async function validateSlideLinks(trainingId: number, data: Record<string, unknown>) {
  await validateCourseMediaReferences(trainingId, data);
  const db = (await getDb())!;
  for (const [key, table] of [["moduleId", trainingModules], ["objectiveId", learningObjectives]] as const) {
    if (data[key] == null) continue;
    const row = (await db.select({ trainingId: table.trainingId }).from(table).where(and(eq(table.id, Number(data[key])), isNull(table.archivedAt))).limit(1))[0];
    if (!row || row.trainingId !== trainingId) throw new TRPCError({ code: "BAD_REQUEST", message: "Rattachement à une autre formation interdit." });
  }
}

export async function requireAuthorContent(actor: Author, kind: "module" | "question" | "objective", id: number, patch: Record<string, unknown> = {}) {
  const db = (await getDb())!;
  const table = kind === "module" ? trainingModules : kind === "objective" ? learningObjectives : (await import("../drizzle/schema")).quizQuestions;
  const [row] = await db.select({ trainingId: table.trainingId }).from(table).where(and(eq(table.id, id), isNull(table.archivedAt))).limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND" });
  await requireAuthorCourse(actor, row.trainingId);
  const fields = kind === "module" ? ["title", "description", "content", "videoUrl", "pdfUrl", "durationMinutes", "sortOrder", "isRequired", "quizPassingScore", "quizMaxAttempts", "quizTimeLimitMin", "objectiveId"] : kind === "objective" ? ["moduleId", "code", "title", "description", "knowledgeLevel", "isRequired", "sortOrder"] : ["moduleId", "objectiveId", "question", "type", "options", "correctAnswer", "optionsRight", "answerKey", "explanation", "points", "sortOrder"];
  if (Object.keys(patch).some(k => !fields.includes(k))) throw new TRPCError({ code: "BAD_REQUEST", message: "Champ non modifiable." });
  await validateSlideLinks(row.trainingId, patch);
  return row;
}
