import {ruleMatchesEmployee} from "../shared/roleMatching";
export {ruleMatchesEmployee} from "../shared/roleMatching";
import {supportMessageInput} from "../shared/supportMessageInput";
import {supportListInput} from "../shared/supportListInput";
import {learningProgressInput} from "../shared/learningProgressInput";
import {catalogueInput} from "../shared/catalogueInput";
import {quoteListInput} from "../shared/quoteListInput";
import {quoteMessageInput,quoteThreadInput} from "../shared/quoteMessageInput";
import {quoteStatusInput} from "../shared/quoteStatusInput";
import {quoteRequestInput} from "../shared/quoteRequestInput";
import {roleRequirementInput} from "../shared/roleRequirementInput";
import {parseEmployeeCsv} from "./employeeCsv";
import {addCalendarMonths} from "../shared/calendarMonths";
import { normalizeFreeText, isUsableKeyword } from "../shared/freeTextAnswer";
import {supportRequestInput} from "../shared/supportRequest";
import type {SignoffSnapshot} from "../shared/signoffSnapshot";
import {supportStatusEvents,accountClosures,credentialSharingEvents,certificateArchives} from "../drizzle/schema";
import {certificateStatus} from '../shared/certificateStatus';
import { embeddedQuizSchema, embeddedQuizFields } from "../shared/embeddedQuiz";
import { videoCuesSchema } from "../shared/videoCues";
import { courseDraftInput } from "./courseDraftInput";
import { mediaUrls } from "./courseMedia";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { validateCourseMediaReferences } from "./courseMedia";
import { hasSubscriptionCapacity } from "../shared/subscriptionCapacity";
import { requireApprovedReview } from "./pedagogicalReview";
import { readCurriculum } from "./curriculum";
import { trainingVersions } from "../drizzle/schema";
import { archiveContent } from "./contentArchive";
import { assessCourse } from "./courseReadiness";
import { TRPCError } from "@trpc/server";
import { eq, and, inArray, lt, isNull, desc, like, or, sql, gte, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  supportNotificationOutbox, users, companies, employees, trainings, trainingCategories, trainingModules,
  quizQuestions, orders, orderItems, enrollments, moduleProgress, quizAttempts,
  certificates, recurrencies, supportCreationRequests, supportMessageRequests, quoteMessageRequests, quoteStatusEvents, quoteCreationRequests, quoteRequests, messages, supportTickets, webinars, webinarRegistrations, cartItems,
  slides, sessions, sessionRegistrations, articles,
  learningObjectives, objectiveProgress, certificateObjectives, notifications, processedWebhookEvents,
  examSessions, examFinalizationFailures, proctoringEvents, externalTrainings, roleRequirements,
  courseTemplates, courseTemplateUses, contentRevisions, regulatoryChanges,
  affiliations, credentials, accessLogs, signoffs, appSettings,
  offers, faqItems,
  type InsertUser,
} from "../drizzle/schema";
import { sendEmail, expiryReminderEmail } from "./email";
import { storagePut } from "./storage";

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _client = postgres(process.env.DATABASE_URL, { max: 10 });
      _db = drizzle(_client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── App settings (key/value store, e.g. admin-configured AI API keys) ────────
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const r = (await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1))[0];
  return r?.value ?? null;
}

export async function setSetting(key: string, value: string | null) {
  const db = await getDb();
  if (!db) return { ok: false };
  await db.insert(appSettings).values({ key, value }).onConflictDoUpdate({ target: appSettings.key, set: { value } });
  // Apply to the running process immediately so dependents (AI) pick it up without restart.
  if (value && value.trim()) process.env[key] = value.trim();
  else delete process.env[key];
  return { ok: true };
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(appSettings);
  const out: Record<string, string> = {};
  for (const r of rows) if (r.value != null) out[r.key] = r.value;
  return out;
}

// Load persisted settings into process.env at boot (DB overrides .env — it's the admin's
// explicit choice via the Settings UI).
export async function loadSettingsIntoEnv() {
  const all = await getAllSettings();
  for (const [k, v] of Object.entries(all)) if (v && v.trim()) process.env[k] = v.trim();
  return Object.keys(all).length;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  (["name", "email", "loginMethod"] as const).forEach((f) => {
    if (user[f] !== undefined) { values[f] = user[f] ?? null; updateSet[f] = user[f] ?? null; }
  });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Trainings (public) ───────────────────────────────────────────────────────
const publicTrainingFields={
 id:trainings.id,title:trainings.title,slug:trainings.slug,description:trainings.description,
 objectives:trainings.objectives,prerequisites:trainings.prerequisites,targetAudience:trainings.targetAudience,
 categoryId:trainings.categoryId,type:trainings.type,domain:trainings.domain,language:trainings.language,
 durationHours:trainings.durationHours,level:trainings.level,priceHt:trainings.priceHt,priceTtc:trainings.priceTtc,
 priceEnterprise:trainings.priceEnterprise,part147Reference:trainings.part147Reference,
 isFeatured:trainings.isFeatured,thumbnailUrl:trainings.thumbnailUrl,recurrencyMonths:trainings.recurrencyMonths,
 variant:trainings.variant,passingScore:trainings.passingScore,maxAttempts:trainings.maxAttempts,
};
export async function getPublicTrainings(input:unknown={}) {
 const parsed=catalogueInput.safeParse(input);
 if(!parsed.success)throw new TRPCError({code:"BAD_REQUEST"});
 const filters=parsed.data;
 const db=await getDb();if(!db)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
 return db.select(publicTrainingFields).from(trainings).where(and(
  eq(trainings.isPublished,true),isNull(trainings.ownerOrgId),isNull(trainings.archivedAt),
  filters.type?sql`${trainings.type}::text = ${filters.type}`:undefined,
  filters.domain?sql`${trainings.domain}::text = ${filters.domain}`:undefined,
  filters.language?eq(trainings.language,filters.language):undefined,
  filters.categoryId?eq(trainings.categoryId,filters.categoryId):undefined,
  filters.search?sql`(strpos(lower(${trainings.title}),lower(${filters.search})) > 0 OR strpos(lower(coalesce(${trainings.description},'')),lower(${filters.search})) > 0)`:undefined,
 )).orderBy(desc(trainings.isFeatured),trainings.title,trainings.id);
}

export async function getFeaturedTrainings() {
  const db = await getDb();
  if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
  return db.select(publicTrainingFields).from(trainings)
    .where(and(eq(trainings.isPublished, true), isNull(trainings.ownerOrgId), isNull(trainings.archivedAt), eq(trainings.isFeatured, true)))
    .orderBy(trainings.title)
    .limit(6);
}

export async function getTrainingBySlug(slug: string) {
  if(!z.string().min(1).max(255).safeParse(slug).success)throw new TRPCError({code:"BAD_REQUEST"});
  const db = await getDb();
  if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
  const result = await db.select(publicTrainingFields).from(trainings).where(and(eq(trainings.slug, slug), eq(trainings.isPublished, true), isNull(trainings.ownerOrgId), isNull(trainings.archivedAt))).limit(1);
  return result[0] ?? null;
}

export async function getTrainingCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trainingCategories).orderBy(trainingCategories.sortOrder);
}

// ─── Cart ─────────────────────────────────────────────────────────────────────
export async function getCartItems(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const items = await db.select().from(cartItems).where(eq(cartItems.userId, userId));
  const result = [];
  for (const item of items) {
    const training = await db.select().from(trainings).where(eq(trainings.id, item.trainingId)).limit(1);
    if (training[0]?.isPublished && !training[0].archivedAt && training[0].ownerOrgId == null) result.push({ ...item, training: training[0] });
  }
  return result;
}

export async function getCartCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(cartItems).where(eq(cartItems.userId, userId));
  return Number(result[0]?.count ?? 0);
}

export async function addToCart(userId: number, trainingId: number, quantity = 1) {
  const db = await getDb();
  if (!db) return;
  const training = (await db.select().from(trainings).where(eq(trainings.id, trainingId)).limit(1))[0];
  if (!training?.isPublished || training.archivedAt || training.ownerOrgId != null) throw new TRPCError({ code: "NOT_FOUND", message: "Formation indisponible à l’achat." });
  const existing = await db.select().from(cartItems).where(and(eq(cartItems.userId, userId), eq(cartItems.trainingId, trainingId))).limit(1);
  if (existing.length > 0) {
    await db.update(cartItems).set({ quantity: (existing[0].quantity ?? 1) + quantity }).where(eq(cartItems.id, existing[0].id));
  } else {
    await db.insert(cartItems).values({ userId, trainingId, quantity });
  }
}

export async function removeFromCart(userId: number, itemId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.userId, userId)));
}

export async function clearCart(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(cartItems).where(eq(cartItems.userId, userId));
}

// ─── Enrollments ──────────────────────────────────────────────────────────────
export async function getUserEnrollments(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
  const rows = await db.select({
    enrollment: enrollments,
    versionId: trainingVersions.id,
    versionTraining: sql<(typeof trainingVersions.$inferSelect)['snapshot']['training'] | null>`${trainingVersions.snapshot}->'training'`,
    currentTraining: trainings,
  }).from(enrollments)
    .leftJoin(trainingVersions, eq(trainingVersions.id, enrollments.trainingVersionId))
    .leftJoin(trainings, eq(trainings.id, enrollments.trainingId))
    .where(eq(enrollments.userId, userId)).orderBy(desc(enrollments.createdAt), desc(enrollments.id));
  return rows.map(row => {
    if (row.enrollment.trainingVersionId != null && row.versionId == null) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Version du parcours indisponible. Contactez l’équipe pédagogique.' });
    }
    return { ...row.enrollment, training: row.versionTraining ?? row.currentTraining ?? null };
  });
}

export async function getEnrollmentById(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
  const result = await db.select().from(enrollments).where(and(eq(enrollments.id, id), eq(enrollments.userId, userId))).limit(1);
  if (!result[0]) return null;
  const training = await db.select().from(trainings).where(eq(trainings.id, result[0].trainingId)).limit(1);
  const modules = await db.select().from(trainingModules).where(and(eq(trainingModules.trainingId, result[0].trainingId), isNull(trainingModules.archivedAt))).orderBy(trainingModules.sortOrder);
  const progress = await db.select().from(moduleProgress).where(eq(moduleProgress.enrollmentId, id));
  const curriculum = await readCurriculum(result[0].trainingVersionId);
  return { ...result[0], training: curriculum?.training ?? training[0] ?? null, modules: curriculum?.modules ?? modules, progress };
}

export async function updateEnrollmentProgress(enrollmentId: number, progressPercent: number, status?: string) {
  const parsed=learningProgressInput.safeParse({enrollmentId,progressPercent,status});
  if(!parsed.success)throw new TRPCError({code:"BAD_REQUEST"});
  const db=await getDb();if(!db)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
  // Content viewing advances only an active enrollment; assessments own completion.
  await db.update(enrollments).set({
    progressPercent:sql`greatest(coalesce(${enrollments.progressPercent},0),${progressPercent})`,
    status:sql`CASE WHEN ${enrollments.status} = 'in_progress' OR ${progressPercent} > 0 OR ${status === 'in_progress'} THEN 'in_progress'::enrollment_status ELSE 'not_started'::enrollment_status END`,
  }).where(and(eq(enrollments.id,enrollmentId),inArray(enrollments.status,['not_started','in_progress'])));
}

// ─── Certificates ─────────────────────────────────────────────────────────────
export async function getUserCertificates(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
  const rows = await db.select({
    certificate: certificates,
    archivedTraining: sql<(typeof certificateArchives.$inferSelect)['snapshot']['training'] | null>`${certificateArchives.snapshot}->'training'`,
    versionTraining: sql<(typeof trainingVersions.$inferSelect)['snapshot']['training'] | null>`${trainingVersions.snapshot}->'training'`,
    versionId: trainingVersions.id,
    enrollmentVersionId: enrollments.trainingVersionId,
    currentTraining: trainings,
  }).from(certificates)
    .leftJoin(certificateArchives, eq(certificateArchives.certificateId, certificates.id))
    .leftJoin(enrollments, eq(enrollments.id, certificates.enrollmentId))
    .leftJoin(trainingVersions, eq(trainingVersions.id, enrollments.trainingVersionId))
    .leftJoin(trainings, eq(trainings.id, certificates.trainingId))
    .where(eq(certificates.userId, userId)).orderBy(desc(certificates.issuedAt), desc(certificates.id));
  return rows.map(row => {
    if (!row.archivedTraining && row.enrollmentVersionId != null && row.versionId == null) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Version du parcours indisponible. Contactez l’équipe pédagogique.' });
    }
    return { ...row.certificate, training: row.archivedTraining ?? row.versionTraining ?? row.currentTraining ?? null };
  });
}

export async function getCertificateByCode(code: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(certificates).where(eq(certificates.verificationCode, code)).limit(1);
  if (!result[0]) return null;
  const [archive]=await db.select().from(certificateArchives).where(eq(certificateArchives.certificateId,result[0].id));
  const training = await db.select().from(trainings).where(eq(trainings.id, result[0].trainingId)).limit(1);
  const user = await db.select({ name: users.name }).from(users).where(eq(users.id, result[0].userId)).limit(1);
  const [enrolled] = await db.select().from(enrollments).where(eq(enrollments.id, result[0].enrollmentId));
  const curriculum = archive?null:await readCurriculum(enrolled?.trainingVersionId);
  const course=archive?.snapshot.training??curriculum?.training??training[0];
  return {
    userId:result[0].userId, // Internal audit subject; removed by the public route.
    certificateNumber:result[0].certificateNumber,
    issuedAt:result[0].issuedAt,expiresAt:result[0].expiresAt,
    status:certificateStatus(result[0]),
    training:course?{title:course.title,part147Reference:course.part147Reference??null}:null,
    user:archive?{name:archive.snapshot.learnerName}:user[0]??null,
  };
}

// ─── Company ──────────────────────────────────────────────────────────────────
export async function getUserCompany(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]?.companyId) return null;
  const company = await db.select().from(companies).where(eq(companies.id, user[0].companyId)).limit(1);
  return company[0] ?? null;
}

export async function createOrUpdateCompany(userId: number, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return null;
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]) return null;
  if (user[0].companyId) {
    await db.update(companies).set(data as any).where(eq(companies.id, user[0].companyId));
    const updated = await db.select().from(companies).where(eq(companies.id, user[0].companyId)).limit(1);
    return updated[0];
  } else {
    const inserted = await db.insert(companies).values(data as any).returning({ id: companies.id });
    const insertId = inserted[0]?.id;
    if (insertId) await db.update(users).set({ companyId: insertId }).where(eq(users.id, userId));
    const created = await db.select().from(companies).where(eq(companies.id, insertId)).limit(1);
    return created[0];
  }
}

// ─── Employees ────────────────────────────────────────────────────────────────
export async function getCompanyEmployees(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]?.companyId) return [];
  return db.select().from(employees).where(eq(employees.companyId, user[0].companyId)).orderBy(employees.lastName);
}

export async function createEmployee(userId: number, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return null;
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]?.companyId) return null;
  await db.insert(employees).values({ ...data as any, companyId: user[0].companyId });
  return { success: true };
}

export async function updateEmployee(id: number, data: Record<string, unknown>, companyId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(employees).set(data as any).where(and(eq(employees.id, id), eq(employees.companyId, companyId)));
}

// ─── Recurrencies ─────────────────────────────────────────────────────────────
// Recompute a recurrency status from its due date — the source of truth is the date,
// not a frozen column. Overdue if past, "due_soon" within 90 days, else "ok".
export function computeRecurrencyStatus(
  nextDueAt: Date | null,
  lastCompletedAt?: Date | null,
): "ok" | "due_soon" | "overdue" | "not_started" {
  if (!nextDueAt) return lastCompletedAt ? "ok" : "not_started";
  const now = Date.now();
  const due = new Date(nextDueAt).getTime();
  if (due < now) return "overdue";
  const DAYS_90 = 90 * 24 * 60 * 60 * 1000;
  return due - now <= DAYS_90 ? "due_soon" : "ok";
}

export async function getCompanyRecurrencies(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]?.companyId) return [];
  const recs = await db.select().from(recurrencies).where(eq(recurrencies.companyId, user[0].companyId));
  const result = [];
  for (const r of recs) {
    const fresh = computeRecurrencyStatus(r.nextDueAt, r.lastCompletedAt);
    if (fresh !== r.status) {
      await db.update(recurrencies).set({ status: fresh }).where(eq(recurrencies.id, r.id));
      r.status = fresh;
    }
    const emp = await db.select().from(employees).where(eq(employees.id, r.employeeId)).limit(1);
    const training = await db.select().from(trainings).where(eq(trainings.id, r.trainingId)).limit(1);
    result.push({ ...r, employee: emp[0] ?? null, training: training[0] ?? null });
  }
  return result;
}

// ─── Notifications ──────────────────────────────────────────────────────────
export async function createNotification(data: {
  userId: number; type: string; title: string; body?: string | null; link?: string | null; dedupeKey?: string | null;
}) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(notifications).values(data as any);
  return { success: true };
}

export async function getUserNotifications(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt),desc(notifications.id)).limit(50);
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  const [result] = await db.select({count:sql<number>`count(*)::int`}).from(notifications).where(and(eq(notifications.userId,userId),eq(notifications.isRead,false)));
  return result.count;
}

export async function markNotificationRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  return { success: true };
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
  return { success: true };
}

async function notificationExists(userId: number, dedupeKey: string) {
  const db = await getDb();
  if (!db) return true;
  const existing = await db.select().from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.dedupeKey, dedupeKey))).limit(1);
  return !!existing[0];
}

// Scan recurrencies + enrollments for approaching/passed deadlines and create
// in-app notifications (idempotent via dedupeKey) + best-effort reminder emails.
export async function generateExpiryAlerts() {
  const db = await getDb();
  if (!db) return { created: 0 };
  let created = 0;
  const now = Date.now();
  const DAYS_90 = 90 * 24 * 60 * 60 * 1000;

  // 1) Company recurrencies due soon / overdue → notify the linked user account.
  const recs = await db.select().from(recurrencies);
  for (const r of recs) {
    const status = computeRecurrencyStatus(r.nextDueAt, r.lastCompletedAt);
    if (status !== "due_soon" && status !== "overdue") continue;
    const emp = (await db.select().from(employees).where(eq(employees.id, r.employeeId)).limit(1))[0];
    if (!emp?.userId) continue;
    const training = (await db.select().from(trainings).where(eq(trainings.id, r.trainingId)).limit(1))[0];
    const period = r.nextDueAt ? new Date(r.nextDueAt).toISOString().slice(0, 7) : "na";
    const dedupeKey = `recurrency:${r.id}:${status}:${period}`;
    if (await notificationExists(emp.userId, dedupeKey)) continue;
    const title = status === "overdue"
      ? `Recyclage en retard : ${training?.title ?? "formation"}`
      : `Recyclage bientôt dû : ${training?.title ?? "formation"}`;
    await db.insert(notifications).values({
      userId: emp.userId, type: `recurrency_${status}`, title,
      body: r.nextDueAt ? `Échéance le ${new Date(r.nextDueAt).toLocaleDateString("fr-FR")}.` : null,
      link: "/dashboard", dedupeKey,
    });
    created++;
    const u = (await db.select().from(users).where(eq(users.id, emp.userId)).limit(1))[0];
    if (u?.email) {
      const dueLabel = status === "overdue" ? "est en retard de recyclage" : "arrive bientôt à échéance";
      const mail = expiryReminderEmail({ name: u.name ?? "", trainingTitle: training?.title ?? "votre formation", dueLabel });
      await sendEmail({ to: u.email, ...mail });
    }
  }

  // 2) Individual enrollments whose certification expiry is approaching/passed.
  const enrs = await db.select().from(enrollments);
  for (const e of enrs) {
    if (!e.expiresAt) continue;
    const exp = new Date(e.expiresAt).getTime();
    if (exp - now > DAYS_90) continue;
    const overdue = exp < now;
    const training = (await db.select().from(trainings).where(eq(trainings.id, e.trainingId)).limit(1))[0];
    const period = new Date(e.expiresAt).toISOString().slice(0, 7);
    const dedupeKey = `enrollment:${e.id}:${overdue ? "overdue" : "due_soon"}:${period}`;
    if (await notificationExists(e.userId, dedupeKey)) continue;
    await db.insert(notifications).values({
      userId: e.userId, type: overdue ? "enrollment_overdue" : "enrollment_due_soon",
      title: overdue
        ? `Certification expirée : ${training?.title ?? "formation"}`
        : `Certification bientôt expirée : ${training?.title ?? "formation"}`,
      body: `Validité jusqu'au ${new Date(e.expiresAt).toLocaleDateString("fr-FR")}.`,
      link: "/dashboard", dedupeKey,
    });
    created++;
  }

  return { created };
}

// ─── Subscription support (B2B "conformité-as-a-subscription") ───────────────
export async function getCompanyById(companyId: number) {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(companies).where(eq(companies.id, companyId)).limit(1))[0] ?? null;
}

export async function findCompanyByStripeCustomerId(customerId: string) {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(companies).where(eq(companies.stripeCustomerId, customerId)).limit(1))[0] ?? null;
}

// Regulatory modules = published trainings carrying a recyclage period.
export async function getRegulatoryTrainings() {
  const db = await getDb();
  if (!db) return [];
  const all = await db.select().from(trainings).where(and(eq(trainings.isPublished, true), isNull(trainings.ownerOrgId), isNull(trainings.archivedAt)));
  return all.filter((t) => t.recurrencyMonths != null);
}

export async function setCompanySubscription(companyId: number, fields: Partial<{
  subscriptionType: "none" | "standard" | "all_inclusive";
  subscriptionStatus: string | null;
  subscriptionExpiresAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}>) {
  const db = await getDb();
  if (!db) return;
  await db.update(companies).set(fields as any).where(eq(companies.id, companyId));
  return { success: true };
}

export async function getCompanyActiveEmployees(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  const all = await db.select().from(employees).where(eq(employees.companyId, companyId));
  return all.filter((e) => e.isActive !== false);
}

// Create (or renew when expired) an enrollment for an employee-linked user account.
export async function ensureEnrollmentForEmployee(userId: number, trainingId: number, recurrencyMonths?: number | null, assignedOrgId?: number, employeeId?: number, requireSubscription = false) {
  const db = await getDb();
  if (!db) return;
  return db.transaction(async tx => {
    const [training] = await tx.select().from(trainings).where(eq(trainings.id, trainingId)).for("update");
    if (!training?.isPublished || training.archivedAt || !training.publishedVersionId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Une version publiée est requise pour attribuer cet accès." });
    let subscriptionId: string | null = null;
    if (assignedOrgId) {
      const [company] = await tx.select().from(companies).where(eq(companies.id, assignedOrgId)).for("update");
      if (requireSubscription && (company?.subscriptionType === "none" || company?.subscriptionStatus !== "active" || !company.subscriptionExpiresAt || company.subscriptionExpiresAt.getTime() <= Date.now())) return { created: false };
      if (requireSubscription) {
        if (!company.stripeSubscriptionId || !employeeId) return { created: false };
        const roster = await tx.select({ id: employees.id }).from(employees).where(and(eq(employees.companyId, assignedOrgId), eq(employees.isActive, true)));
        if (!hasSubscriptionCapacity(company, roster.length)) return { created: false };
        const [employee] = await tx.select().from(employees).where(eq(employees.id, employeeId));
        if (!employee?.isActive || employee.companyId !== assignedOrgId || employee.userId !== userId) return { created: false };
        subscriptionId = company.stripeSubscriptionId;
      }
      const [affiliation] = await tx.select().from(affiliations).where(and(eq(affiliations.personId, userId), eq(affiliations.orgId, assignedOrgId), eq(affiliations.status, "ACTIVE"))).for("update");
      if (company?.status !== "ACTIVE" || !affiliation || (training.ownerOrgId != null && training.ownerOrgId !== assignedOrgId)) throw new TRPCError({ code: "FORBIDDEN", message: "Affiliation compagnie active requise." });
    }
    if (requireSubscription && !subscriptionId) return { created: false };
    const previous = await tx.select().from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.trainingId, trainingId))).orderBy(desc(enrollments.id));
    const active = previous.find(e => e.stripeSubscriptionId === subscriptionId && e.status !== "expired" && (!e.expiresAt || e.expiresAt.getTime() > Date.now()));
    if (active) return { enrollmentId: active.id, created: false };
    let expiresAt: Date | undefined;
    if (recurrencyMonths) expiresAt = addCalendarMonths(new Date(), recurrencyMonths);
    const [created] = await tx.insert(enrollments).values({ userId, trainingId, expiresAt, assignedOrgId, employeeId, stripeSubscriptionId: subscriptionId }).returning();
    return { enrollmentId: created.id, created: true };
  });
}

export async function upsertRecurrency(params: { companyId: number; employeeId: number; trainingId: number; periodMonths: number }) {
  const db = await getDb();
  if (!db) return;
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`recurrency:${params.employeeId}:${params.trainingId}`}))`);
    const [existing] = await tx.select().from(recurrencies).where(and(eq(recurrencies.employeeId, params.employeeId), eq(recurrencies.trainingId, params.trainingId))).limit(1);
    if (existing) {
      await tx.update(recurrencies).set({ periodMonths: params.periodMonths }).where(eq(recurrencies.id, existing.id));
    } else {
      await tx.insert(recurrencies).values({ ...params, nextDueAt: null, status: "not_started" });
    }
  });
}

export async function getCompanySubscriptionView(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user?.companyId) return null;
  return getSubscriptionViewForCompany(user.companyId);
}

export async function getSubscriptionViewForCompany(companyId: number) {
  const db = await getDb();
  if (!db) return null;
  const company = (await db.select().from(companies).where(eq(companies.id, companyId)).limit(1))[0];
  if (!company) return null;
  const emps = await db.select().from(employees).where(eq(employees.companyId, company.id));
  const regCount = (await getRegulatoryTrainings()).length;
  return {
    companyId: company.id,
    subscriptionType: company.subscriptionType ?? "none",
    subscriptionStatus: company.subscriptionStatus ?? null,
    subscriptionExpiresAt: company.subscriptionExpiresAt ?? null,
    employeeCount: emps.filter(e => e.isActive).length,
    subscriptionQuantity: company.subscriptionQuantity,
    capacityAvailable: hasSubscriptionCapacity(company, emps.filter(e => e.isActive).length),
    regulatoryTrainingCount: regCount,
    hasStripeCustomer: !!company.stripeCustomerId,
    hasStripeSubscription: !!company.stripeSubscriptionId,
  };
}

export async function isWebhookProcessed(eventId: string) {
  const db = await getDb();
  if (!db) return false;
  const r = await db.select().from(processedWebhookEvents).where(eq(processedWebhookEvents.eventId, eventId)).limit(1);
  return !!r[0];
}

export async function markWebhookProcessed(eventId: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(processedWebhookEvents).values({ eventId }).onConflictDoNothing();
}

// ─── Quotes ───────────────────────────────────────────────────────────────────
export async function createQuoteRequest(data: Record<string, unknown>) {
  const parsed = quoteRequestInput.extend({userId:z.number().int().positive().max(2147483647).nullable().default(null)}).safeParse(data);
  if (!parsed.success) throw new TRPCError({code:"BAD_REQUEST",message:"Les informations de la demande de devis sont invalides."});
  const db = await getDb();
  if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
  const {requestId, ...values} = parsed.data;
  const fingerprint = createHash('sha256').update(JSON.stringify(values)).digest('hex');
  return db.transaction(async tx => {
    if (requestId) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'quote-create:'+requestId}, 0))`);
      const [previous] = await tx.select().from(quoteCreationRequests).where(eq(quoteCreationRequests.requestId, requestId));
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new TRPCError({code:"CONFLICT",message:"Cette référence de demande a déjà été utilisée avec d’autres informations."});
        return {success:true, quoteId:previous.quoteId, replayed:true};
      }
    }
    const [row] = await tx.insert(quoteRequests).values(values).returning({id:quoteRequests.id});
    if (requestId) await tx.insert(quoteCreationRequests).values({requestId,quoteId:row.id,fingerprint});
    return {success:true, quoteId:row.id, replayed:false};
  });
}

export async function getQuoteRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quoteRequests).where(eq(quoteRequests.userId, userId)).orderBy(desc(quoteRequests.createdAt));
}

export async function getQuoteById(id: number) {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(quoteRequests).where(eq(quoteRequests.id, id)).limit(1))[0] ?? null;
}

// A person's quotes = those they submitted while logged in (userId) OR matching their email.
export async function getMyQuotes(userId:number,input:unknown={}) {
  const parsed=quoteListInput.safeParse(input);
  if(!parsed.success)throw new TRPCError({code:"BAD_REQUEST"});
  const db=await getDb();if(!db)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
  return db.transaction(async tx=>{
    const [actor]=await tx.select().from(users).where(eq(users.id,userId)).for('share');
    if(!actor || actor.status!=="active")throw new TRPCError({code:"FORBIDDEN"});
    const rows=await tx.select({id:quoteRequests.id,companyName:quoteRequests.companyName,status:quoteRequests.status,createdAt:quoteRequests.createdAt,trainingTypes:quoteRequests.trainingTypes})
      .from(quoteRequests).where(and(
        or(eq(quoteRequests.userId,actor.id),actor.email?sql`lower(${quoteRequests.contactEmail}) = ${actor.email.toLowerCase()}`:undefined),
        parsed.data.beforeId?lt(quoteRequests.id,parsed.data.beforeId):undefined,
      )).orderBy(desc(quoteRequests.id)).limit(51);
    return {entries:rows.slice(0,50),nextBeforeId:rows.length>50?rows[49].id:null};
  });
}

export async function findUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1))[0] ?? null;
}

// ─── Quote messaging (admin ↔ client thread on a quote) ───────────────────────
async function requireQuoteParticipant(tx:DatabaseTransaction,quoteId:number,actorId:number) {
  const [quote]=await tx.select().from(quoteRequests).where(eq(quoteRequests.id,quoteId)).for('share');
  const [actor]=await tx.select().from(users).where(eq(users.id,actorId)).for('share');
  if (!actor || actor.status!=="active" || !quote || (actor.role!=="admin" && quote.userId!==actor.id && (!actor.email || quote.contactEmail.toLowerCase()!==actor.email.toLowerCase()))) throw new TRPCError({code:"FORBIDDEN"});
  return {quote,actor};
}

export async function getQuoteMessages(quoteId:number,actorId:number) {
  if (!quoteThreadInput.safeParse({quoteId}).success) throw new TRPCError({code:"BAD_REQUEST"});
  const db=await getDb();if(!db)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
  return db.transaction(async tx=>{
    await requireQuoteParticipant(tx,quoteId,actorId);
    const rows=await tx.select({message:messages,fromName:users.name,fromRole:users.role}).from(messages).leftJoin(users,eq(users.id,messages.fromUserId)).where(eq(messages.quoteRequestId,quoteId)).orderBy(messages.createdAt,messages.id);
    // Mark only messages included in this read, not a concurrent new arrival.
    const unread=rows.filter(row=>!row.message.isRead && row.message.fromUserId!==actorId).map(row=>row.message.id);
    if(unread.length)await tx.update(messages).set({isRead:true}).where(inArray(messages.id,unread));
    return rows.map(row=>({...row.message,isRead:row.message.isRead||unread.includes(row.message.id),fromName:row.fromName,fromRole:row.fromRole}));
  });
}

export async function createQuoteMessage(input:unknown,actorId:number) {
  const parsed=quoteMessageInput.safeParse(input);
  if(!parsed.success)throw new TRPCError({code:"BAD_REQUEST"});
  const db=await getDb();if(!db)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
  return db.transaction(async tx=>{
    const {requestId,quoteId,content}=parsed.data;
    if(requestId)await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'quote-message:'+requestId},0))`);
    const {quote,actor}=await requireQuoteParticipant(tx,quoteId,actorId);
    const fingerprint=createHash('sha256').update(JSON.stringify({quoteId,actorId,content})).digest('hex');
    if(requestId){
      const [previous]=await tx.select().from(quoteMessageRequests).where(eq(quoteMessageRequests.requestId,requestId));
      if(previous){
        if(previous.fingerprint!==fingerprint)throw new TRPCError({code:"CONFLICT",message:"Cette référence a déjà été utilisée pour un autre message."});
        const [message]=await tx.select().from(messages).where(eq(messages.id,previous.messageId));
        return {message,quote,actorRole:actor.role,replayed:true};
      }
    }
    const [message]=await tx.insert(messages).values({quoteRequestId:quote.id,fromUserId:actor.id,content}).returning();
    if(requestId)await tx.insert(quoteMessageRequests).values({requestId,messageId:message.id,fingerprint});
    return {message,quote,actorRole:actor.role,replayed:false};
  });
}

// ─── Support tickets + broadcast notifications ────────────────────────────────
export async function createSupportTicket(userId:number,raw:z.input<typeof supportRequestInput>){
  const data=supportRequestInput.parse(raw),db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  return db.transaction(async tx=>{
    if(data.requestId)await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'support-create:'+data.requestId},0))`);
    const [person]=await tx.select().from(users).where(eq(users.id,userId)).for('share');
    if(person?.status!=='active')throw new TRPCError({code:'FORBIDDEN'});
    const fingerprint=createHash('sha256').update(JSON.stringify({userId,subject:data.subject,priority:data.priority??'normal',requestKind:data.requestKind,message:data.message||''})).digest('hex');
    if(data.requestId){
      const [previous]=await tx.select().from(supportCreationRequests).where(eq(supportCreationRequests.requestId,data.requestId));
      if(previous){
        if(previous.fingerprint!==fingerprint)throw new TRPCError({code:'CONFLICT',message:'Cette référence a déjà été utilisée pour une autre demande.'});
        const [ticket]=await tx.select().from(supportTickets).where(eq(supportTickets.id,previous.ticketId));
        return {...ticket,replayed:true};
      }
    }
    const [ticket]=await tx.insert(supportTickets).values({userId,subject:data.subject,priority:data.priority??'normal',status:'OPEN',requestKind:data.requestKind}).returning();
    if(data.message)await tx.insert(messages).values({ticketId:ticket.id,fromUserId:userId,content:data.message});
    await tx.insert(supportStatusEvents).values({ticketId:ticket.id,actorId:userId,actorName:person.name,previousStatus:null,status:'OPEN'});
    if(data.requestId)await tx.insert(supportCreationRequests).values({requestId:data.requestId,ticketId:ticket.id,fingerprint});
    await tx.insert(supportNotificationOutbox).values({key:`ticket:${ticket.id}`,ticketId:ticket.id,audience:'admin'});
    return {...ticket,replayed:false};
  });
}

export async function getMyTickets(userId: number, input: unknown = {}) {
  const parsed = supportListInput.safeParse(input);
  if (!parsed.success) throw new TRPCError({code:'BAD_REQUEST'});
  const {beforeId,status,search} = parsed.data;
  const db = await getDb();
  if (!db) throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  return db.transaction(async tx => {
    const [actor] = await tx.select({status:users.status}).from(users).where(eq(users.id,userId)).for('share');
    if (actor?.status !== 'active') throw new TRPCError({code:'FORBIDDEN'});
    const rows = await tx.select().from(supportTickets).where(and(
      eq(supportTickets.userId,userId),
      beforeId == null ? undefined : lt(supportTickets.id,beforeId),
      status == null ? undefined : eq(supportTickets.status,status),
      !search ? undefined : sql`strpos(lower(${supportTickets.subject}),lower(${search})) > 0`
    )).orderBy(desc(supportTickets.id)).limit(51);
    return {entries:rows.slice(0,50),nextBeforeId:rows.length>50?rows[49].id:null};
  });
}

export async function getAdminTickets(input: unknown = {}) {
  const parsed = supportListInput.safeParse(input);
  if (!parsed.success) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Filtres de support invalides.' });
  const {beforeId, status, search} = parsed.data;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Base de données indisponible.' });
  const rows = await db.select({ ticket: supportTickets, userName: users.name, userEmail: users.email })
    .from(supportTickets).leftJoin(users, eq(users.id, supportTickets.userId))
    .where(and(
      beforeId == null ? undefined : lt(supportTickets.id, beforeId),
      status == null ? undefined : eq(supportTickets.status, status),
      !search ? undefined : sql`(strpos(lower(${supportTickets.subject}), lower(${search})) > 0 OR strpos(lower(coalesce(${users.name}, '')), lower(${search})) > 0 OR strpos(lower(coalesce(${users.email}, '')), lower(${search})) > 0)`
    ))
    .orderBy(desc(supportTickets.id)).limit(51);
  return {
    entries: rows.slice(0, 50).map(({ ticket, userName, userEmail }) => ({ ...ticket, userName, userEmail })),
    nextBeforeId: rows.length > 50 ? rows[49].ticket.id : null,
  };
}

export async function getTicketById(id: number) {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1))[0] ?? null;
}

async function requireTicketParticipant(tx:DatabaseTransaction,ticketId:number,actorId:number,lock:'share'|'update'){
  const [actor]=await tx.select().from(users).where(eq(users.id,actorId)).for('share');
  const [ticket]=await tx.select().from(supportTickets).where(eq(supportTickets.id,ticketId)).for(lock);
  if(actor?.status!=='active'||!ticket||(actor.role!=='admin'&&ticket.userId!==actorId))throw new TRPCError({code:'FORBIDDEN'});
  return ticket;
}

export async function getSupportTicketDetail(ticketId:number,actorId:number){
  const idSchema=z.number().int().positive().max(2147483647);
  if(!idSchema.safeParse(ticketId).success||!idSchema.safeParse(actorId).success)throw new TRPCError({code:'BAD_REQUEST'});
  const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  return db.transaction(async tx=>{
    const ticket=await requireTicketParticipant(tx,ticketId,actorId,'share');
    return {id:ticket.id,subject:ticket.subject,status:ticket.status,requestKind:ticket.requestKind,createdAt:ticket.createdAt,updatedAt:ticket.updatedAt};
  });
}

export async function getTicketThread(ticketId:number,actorId:number){
  const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  return db.transaction(async tx=>{
    await requireTicketParticipant(tx,ticketId,actorId,'share');
    const rows=await tx.select({message:messages,fromName:users.name,fromRole:users.role}).from(messages).leftJoin(users,eq(users.id,messages.fromUserId)).where(eq(messages.ticketId,ticketId)).orderBy(messages.createdAt,messages.id);
    return rows.map(row=>({...row.message,fromName:row.fromName,fromRole:row.fromRole}));
  });
}

export async function postTicketMessage(ticketId:number,fromUserId:number,raw:string,requestId?:string){
  const parsed=supportMessageInput.safeParse({ticketId,content:raw,requestId});
  if(!parsed.success || !z.number().int().positive().max(2147483647).safeParse(fromUserId).success)throw new TRPCError({code:'BAD_REQUEST'});
  const {content,requestId:operationId}=parsed.data;
  const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  return db.transaction(async tx=>{
    if(operationId)await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'support-message:'+operationId},0))`);
    const ticket=await requireTicketParticipant(tx,ticketId,fromUserId,'update');
    const fingerprint=createHash('sha256').update(JSON.stringify({ticketId,fromUserId,content})).digest('hex');
    if(operationId){
      const [previous]=await tx.select().from(supportMessageRequests).where(eq(supportMessageRequests.requestId,operationId));
      if(previous){
        if(previous.fingerprint!==fingerprint)throw new TRPCError({code:'CONFLICT',message:'Cette référence a déjà été utilisée pour un autre message.'});
        const [message]=await tx.select().from(messages).where(eq(messages.id,previous.messageId));
        return {message,replayed:true};
      }
    }
    const [message]=await tx.insert(messages).values({ticketId,fromUserId,content}).returning();
    await tx.update(supportTickets).set({updatedAt:new Date()}).where(eq(supportTickets.id,ticketId));
    if(operationId)await tx.insert(supportMessageRequests).values({requestId:operationId,messageId:message.id,fingerprint});
    const [actor]=await tx.select({role:users.role}).from(users).where(eq(users.id,fromUserId));
    if(actor.role!=='admin'||ticket.userId!==fromUserId)await tx.insert(supportNotificationOutbox).values({key:`message:${message.id}`,ticketId,messageId:message.id,audience:actor.role==='admin'?'owner':'admin'});
    if(actor.role==='admin'&&ticket.userId!==fromUserId)await tx.insert(notifications).values({userId:ticket.userId,type:'support',title:'Réponse à votre demande de support',body:content.slice(0,120),link:`/support/ticket/${ticket.id}`,dedupeKey:`support-message:${message.id}`});
    return {message,replayed:false};
  });
}

export async function setTicketStatus(ticketId:number,status:string,actorId:number,reason?:string){
  z.enum(['OPEN','PENDING','CLOSED']).parse(status);
  const explanation=z.string().trim().max(2000).optional().parse(reason);
  const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  return db.transaction(async tx=>{
    const [actor]=await tx.select().from(users).where(eq(users.id,actorId)).for('share');
    if(actor?.status!=='active'||actor.role!=='admin')throw new TRPCError({code:'FORBIDDEN'});
    const [ticket]=await tx.select().from(supportTickets).where(eq(supportTickets.id,ticketId)).for('update');
    if(!ticket)throw new TRPCError({code:'NOT_FOUND'});
    if(ticket.status===status)return {ok:true};
    if(ticket.requestKind!=='GENERAL'&&status==='CLOSED'&&(explanation?.length??0)<10)throw new TRPCError({code:'BAD_REQUEST',message:'Expliquez la clôture de cette demande (10 caractères minimum).'});
    await tx.update(supportTickets).set({status}).where(eq(supportTickets.id,ticketId));
    await tx.insert(supportStatusEvents).values({ticketId,actorId,actorName:actor.name,previousStatus:ticket.status,status,reason:explanation||null});
    return {ok:true};
  });
}

export async function getTicketStatusHistory(actorId:number,ticketId:number,cursor?:number){
  const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  const [actor]=await db.select().from(users).where(eq(users.id,actorId));
  const [ticket]=await db.select().from(supportTickets).where(eq(supportTickets.id,ticketId));
  if(actor?.status!=='active'||!ticket||(actor.role!=='admin'&&ticket.userId!==actorId))throw new TRPCError({code:'FORBIDDEN'});
  const rows=await db.select().from(supportStatusEvents).where(and(eq(supportStatusEvents.ticketId,ticketId),cursor==null?undefined:lt(supportStatusEvents.id,cursor))).orderBy(desc(supportStatusEvents.id)).limit(26);
  return {entries:rows.slice(0,25),nextCursor:rows.length>25?rows[24].id:null};
}

// Broadcast a notification to an audience (fan-out over the per-user notifications model).
export async function broadcastNotification(data: { audience: string; title: string; body?: string; link?: string }) {
  const db = await getDb();
  if (!db) return { sent: 0 };
  let targets: { id: number }[] = [];
  if (data.audience === "all") {
    targets = await db.select({ id: users.id }).from(users).where(eq(users.status, "active"));
  } else if (data.audience.startsWith("company:")) {
    const cid = Number(data.audience.split(":")[1]);
    if (cid) targets = await db.select({ id: users.id }).from(users).where(eq(users.companyId, cid));
  }
  for (const tgt of targets) {
    await createNotification({ userId: tgt.id, type: "broadcast", title: data.title, body: data.body ?? null, link: data.link ?? null, dedupeKey: `broadcast:${data.title}:${tgt.id}` });
  }
  return { sent: targets.length };
}

// ─── Webinars ─────────────────────────────────────────────────────────────────
export async function getWebinars() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ webinar: webinars, training: trainings }).from(webinars).leftJoin(trainings, eq(trainings.id, webinars.trainingId)).orderBy(webinars.scheduledAt);
  return rows.filter(r => r.webinar.status !== "cancelled" && (!r.webinar.trainingId || (r.training?.isPublished && !r.training.archivedAt && r.training.ownerOrgId == null))).map(({ webinar }) => {
    const { meetingUrl, liveRoom, replayUrl, ...publicRoom } = webinar;
    return { ...publicRoom, hasReplay: !!replayUrl };
  });
}

export { registerForWebinar, registerForSession } from "./admissions";

// ─── Admin ────────────────────────────────────────────────────────────────────
export async function getAdminStats() {
  const db = await getDb();
  if (!db) return { users: 0, trainings: 0, orders: 0, quotes: 0, enrollments: 0 };
  const [u, t, o, q, e] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(users),
    db.select({ count: sql<number>`count(*)` }).from(trainings),
    db.select({ count: sql<number>`count(*)` }).from(orders),
    db.select({ count: sql<number>`count(*)` }).from(quoteRequests),
    db.select({ count: sql<number>`count(*)` }).from(enrollments),
  ]);
  return {
    users: Number(u[0]?.count ?? 0),
    trainings: Number(t[0]?.count ?? 0),
    orders: Number(o[0]?.count ?? 0),
    quotes: Number(q[0]?.count ?? 0),
    enrollments: Number(e[0]?.count ?? 0),
  };
}

export async function getAdminUsers() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));
  // Attach each user's organisation (active affiliation first, else legacy companyId).
  const affs = await db.select().from(affiliations).where(eq(affiliations.status, "ACTIVE"));
  const comps = await db.select().from(companies);
  const compName = new Map(comps.map((c) => [c.id, c.name]));
  const affByPerson = new Map<number, typeof affs[number]>();
  for (const a of affs) if (!affByPerson.has(a.personId)) affByPerson.set(a.personId, a);
  return rows.map(({ passwordHash, resetToken, resetTokenExpiresAt, twoFactorCode, twoFactorExpiresAt, ...rest }) => {
    const a = affByPerson.get(rest.id);
    const orgId = a?.orgId ?? rest.companyId ?? null;
    return { ...rest, organizationName: orgId ? compName.get(orgId) ?? null : null, affiliationRole: a?.role ?? null };
  });
}

export async function getAdminTrainings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trainings).where(isNull(trainings.archivedAt)).orderBy(desc(trainings.createdAt));
}

export async function createTraining(data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return null;
  if (data.isPublished) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Créez la formation en brouillon et préparez son contenu avant publication." });
  await db.insert(trainings).values(data as any);
  return { success: true };
}

export async function updateTraining(id: number, data: Record<string, unknown>, actorId?: number) {
  if ("archivedAt" in data || "publishedVersionId" in data) throw new TRPCError({ code: "BAD_REQUEST", message: "Utilisez l’action d’archivage dédiée." });
  const db = await getDb();
  if (!db) return;
  await db.transaction(async tx => {
    const [course] = await tx.select().from(trainings).where(eq(trainings.id, id)).for("update");
    if (!course) throw new TRPCError({ code: "NOT_FOUND" });
    if (data.isPublished === true || (course.isPublished && data.isPublished !== false)) {
      const modules = await tx.select().from(trainingModules).where(and(eq(trainingModules.trainingId, id), isNull(trainingModules.archivedAt))).orderBy(trainingModules.sortOrder);
      const questions = await tx.select().from(quizQuestions).where(and(eq(quizQuestions.trainingId, id), isNull(quizQuestions.archivedAt))).orderBy(quizQuestions.sortOrder);
      const deck = await tx.select().from(slides).where(and(eq(slides.trainingId, id), isNull(slides.archivedAt))).orderBy(slides.sortOrder);
      const check = assessCourse({ ...course, ...data } as typeof course, modules, questions, deck);
      if (!check.ready) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Formation incomplète. Corrigez les éléments indiqués dans la préparation à la publication." });
      if (data.isPublished === true) {
        const objectives = await tx.select().from(learningObjectives).where(and(eq(learningObjectives.trainingId, id), isNull(learningObjectives.archivedAt))).orderBy(learningObjectives.sortOrder);
        await validateCourseMediaReferences(id, { training: { ...course, ...data }, modules, slides: deck });
        const reviewId = await requireApprovedReview(tx, { training: { ...course, ...data } as typeof course, modules, questions, slides: deck, objectives });
        const prior = await tx.select().from(trainingVersions).where(eq(trainingVersions.trainingId, id)).orderBy(desc(trainingVersions.version)).limit(1);
        const version = (prior[0]?.version ?? 0) + 1;
        const [published] = await tx.insert(trainingVersions).values({ trainingId: id, version, publishedBy: actorId, reviewId,
          snapshot: { training: { ...course, ...data, version, publishedVersionId: null } as typeof course, modules, questions, slides: deck, objectives } }).returning();
        data = { ...data, publishedVersionId: published.id, version };
      }
    }
    await tx.update(trainings).set(data as any).where(eq(trainings.id, id));
  });
  return { success: true };
}

// Archive the catalogue entry while retaining learner and financial evidence.
export async function deleteTraining(id: number, actorId?: number) {
  return archiveContent("training", id, actorId);
}

export async function getUserOrders(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

export async function getAdminOrders() {
  const db = await getDb();
  if (!db) return [];
  const ords = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const result = [];
  for (const o of ords) {
    const user = await db.select().from(users).where(eq(users.id, o.userId)).limit(1);
    result.push({ ...o, user: user[0] ?? null });
  }
  return result;
}

export async function getAdminQuoteRequests() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quoteRequests).orderBy(desc(quoteRequests.createdAt));
}

export async function updateQuoteRequestStatus(input: unknown, actorId: number) {
  const parsed=quoteStatusInput.safeParse(input);
  if (!parsed.success) throw new TRPCError({code:"BAD_REQUEST"});
  const {id,status,expectedRevision}=parsed.data;
  const db=await getDb();
  if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
  return db.transaction(async tx=>{
    const [quote]=await tx.select().from(quoteRequests).where(eq(quoteRequests.id,id)).for('update');
    const [actor]=await tx.select().from(users).where(eq(users.id,actorId)).for('share');
    if (!actor || actor.role!=="admin" || actor.status!=="active") throw new TRPCError({code:"FORBIDDEN"});
    if (!quote) throw new TRPCError({code:"NOT_FOUND"});
    if (quote.revision!==expectedRevision) throw new TRPCError({code:"CONFLICT",message:"Le statut a changé. Actualisez le devis avant de choisir à nouveau."});
    await tx.execute(sql`SELECT set_config('raero.quote_actor_id', ${String(actorId)}, true)`);
    const [updated]=await tx.update(quoteRequests).set({status}).where(eq(quoteRequests.id,id)).returning();
    return {success:true,revision:updated.revision};
  });
}

export async function getQuoteStatusHistory(quoteId:number, beforeId?:number) {
  const db=await getDb();
  if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
  const rows=await db.select().from(quoteStatusEvents).where(and(eq(quoteStatusEvents.quoteId,quoteId),beforeId?lt(quoteStatusEvents.id,beforeId):undefined)).orderBy(desc(quoteStatusEvents.id)).limit(51);
  return {entries:rows.slice(0,50),nextBeforeId:rows.length>50?rows[49].id:null};
}

// ─── Training Modules ─────────────────────────────────────────────────────────
export async function getTrainingModules(trainingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trainingModules).where(and(eq(trainingModules.trainingId, trainingId), isNull(trainingModules.archivedAt))).orderBy(trainingModules.sortOrder);
}

// ─── Module Progress ──────────────────────────────────────────────────────────
export async function getModuleProgress(enrollmentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(moduleProgress).where(eq(moduleProgress.enrollmentId, enrollmentId));
}

export async function updateModuleProgress(enrollmentId: number, moduleId: number, timeSpentMinutes?: number) {
  const db = await getDb();
  if (!db) return;
  const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId));
  const curriculum = await readCurriculum(enrollment?.trainingVersionId);
  const module = curriculum?.modules.find(m => m.id === moduleId) ?? (await db.select().from(trainingModules).where(eq(trainingModules.id, moduleId)).limit(1))[0];
  if (!module) throw new TRPCError({ code: "NOT_FOUND" });
  const passed = await db.select().from(quizAttempts).where(and(eq(quizAttempts.enrollmentId, enrollmentId), eq(quizAttempts.moduleId, moduleId), eq(quizAttempts.isPassed, true))).limit(1);
  if (!passed.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Validez le QCM du chapitre pour le terminer." });
  const existing = await db.select().from(moduleProgress)
    .where(and(eq(moduleProgress.enrollmentId, enrollmentId), eq(moduleProgress.moduleId, moduleId))).limit(1);
  if (existing.length > 0) {
    await db.update(moduleProgress).set({
      isCompleted: true,
      completedAt: new Date(),
      timeSpentMinutes: (existing[0].timeSpentMinutes ?? 0) + (timeSpentMinutes ?? 0),
    }).where(eq(moduleProgress.id, existing[0].id));
  } else {
    await db.insert(moduleProgress).values({
      enrollmentId, moduleId, isCompleted: true,
      completedAt: new Date(), timeSpentMinutes: timeSpentMinutes ?? 0,
    });
  }
  // Recalculate enrollment progress
  const allModules = curriculum?.modules ?? await getTrainingModules(enrollment?.trainingId ?? 0);
  const completedModules = await db.select().from(moduleProgress)
    .where(and(eq(moduleProgress.enrollmentId, enrollmentId), eq(moduleProgress.isCompleted, true)));
  const progress = allModules.length > 0 ? Math.round((completedModules.length / allModules.length) * 100) : 0;
  const status = "in_progress";
  await db.update(enrollments).set({
    progressPercent: progress,
    status: status as any,
    
    ...(status === "in_progress" ? { startedAt: new Date() } : {}),
    lastAccessedAt: new Date(),
  }).where(and(eq(enrollments.id, enrollmentId), ne(enrollments.status, "completed")));
  return { progress, status };
}

// ─── Quiz Questions ───────────────────────────────────────────────────────────
export async function getQuizQuestions(trainingId: number, moduleId?: number) {
  const db = await getDb();
  if (!db) return [];
  const all = await db.select().from(quizQuestions).where(and(eq(quizQuestions.trainingId, trainingId), isNull(quizQuestions.archivedAt))).orderBy(quizQuestions.sortOrder);
  if (moduleId !== undefined) return all.filter((q) => q.moduleId === moduleId);
  return all;
}

// ─── Quiz Attempts ────────────────────────────────────────────────────────────
// Grade a single answer by question type. qcm/qcu/true_false: exact index-set match.
// free_text: keyword (accent/case-insensitive substring) or regex match. matching:
// the set of (left,right) pairs equals the answer key.
export function gradeQuizAnswer(q: any, ua: any): boolean {
  if (q.type === "free_text") {
    const text = normalizeFreeText(String(ua ?? ""));
    const key = q.answerKey ?? {};
    if (!text) return false;
    if (Array.isArray(key.keywords) && key.keywords.length && key.keywords.some((k: unknown) => isUsableKeyword(k) && text.includes(normalizeFreeText(k)))) return true;
    if (key.regex) { try { return new RegExp(key.regex, "i").test(String(ua)); } catch { return false; } }
    return false;
  }
  if (q.type === "matching") {
    const pairs: number[][] = Array.isArray(ua) ? ua : [];
    const correctPairs: number[][] = (q.answerKey?.pairs as number[][] | undefined) ?? [];
    const k = (p: number[]) => `${p[0]}:${p[1]}`;
    const got = new Set(pairs.map(k));
    return correctPairs.length > 0 && correctPairs.length === got.size && correctPairs.every((p) => got.has(k(p)));
  }
  const userAnswer: number[] = Array.isArray(ua) ? ua : [];
  const correct = (q.correctAnswer as number[] | null) ?? [];
  return correct.length === userAnswer.length && correct.every((c) => userAnswer.includes(c));
}

export async function submitQuizAttempt(params: {
  userId: number;
  enrollmentId: number;
  trainingId: number;
  answers: Record<string, any>;
  attemptNumber: number;
  sessionId?: number;
}) {
  const db = await getDb();
  if (!db) return null;

  if (!params.sessionId) throw new TRPCError({ code: "BAD_REQUEST", message: "Une session d’examen est requise." });
  return db.transaction(async tx => {
  const session = (await tx.select().from(examSessions).where(eq(examSessions.id, params.sessionId!)).for("update").limit(1))[0];
  if (!session || session.userId !== params.userId || session.enrollmentId !== params.enrollmentId || session.trainingId !== params.trainingId)
    throw new TRPCError({ code: "FORBIDDEN", message: "Session d’examen inaccessible." });
  if (session.submittedAt || session.status !== "active") {
    const attempt = (await tx.select().from(quizAttempts).where(and(eq(quizAttempts.enrollmentId, session.enrollmentId), eq(quizAttempts.attemptNumber, session.attemptNumber ?? 1), session.moduleId == null ? isNull(quizAttempts.moduleId) : eq(quizAttempts.moduleId, session.moduleId))).limit(1))[0];
    if (!attempt) throw new TRPCError({ code: "CONFLICT", message: "Cette session est déjà terminée." });
    const score = attempt.score ?? 0, maxScore = attempt.maxScore ?? 0;
    return { score, maxScore, expired: session.status === "expired", percentage: maxScore ? Math.round(score / maxScore * 100) : 0,
      isPassed: !!attempt.isPassed, passingScore: session.passingScoreSnapshot ?? 75,
      feedbackAvailable: attempt.feedback !== null, feedback: attempt.feedback ?? [] };
  }
  const expired = !!session.expiresAt && session.expiresAt.getTime() < Date.now();
  const allQuestions = session.questionSnapshot ?? await tx.select().from(quizQuestions).where(eq(quizQuestions.trainingId, params.trainingId));
  const idset = new Set(session.questionIds ?? []);
  const questions = allQuestions.filter(q => idset.has(q.id));
  if (!questions.length || questions.length !== idset.size)
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "La banque de questions a changé. Contactez l’équipe pédagogique." });
  await tx.update(examSessions).set({ submittedAt: new Date(), status: expired ? "expired" : "submitted" }).where(eq(examSessions.id, session.id));
  const training = await tx.select().from(trainings).where(eq(trainings.id, params.trainingId)).limit(1);

  const answers = expired ? (session.savedAnswers ?? {}) : params.answers;
  let score = 0;
  const maxScore = questions.reduce((s, q) => s + (q.points ?? 1), 0);

  const feedback = questions.map(q => ({ questionId: q.id, question: q.question, isCorrect: gradeQuizAnswer(q, answers[String(q.id)]), explanation: q.explanation }));
  questions.forEach((q, index) => {
    if (feedback[index].isCorrect) score += q.points ?? 1;
  });

  const passingScore = session.passingScoreSnapshot ?? training[0]?.passingScore ?? 75;
  const isPassed = maxScore > 0 ? (score / maxScore) * 100 >= passingScore : false;

  await tx.insert(quizAttempts).values({
    enrollmentId: params.enrollmentId,
    moduleId: session.moduleId,
    userId: params.userId,
    trainingId: params.trainingId,
    score,
    maxScore,
    isPassed,
    answers: answers as any,
    feedback,
    completedAt: new Date(),
    attemptNumber: session.attemptNumber,
  });

  // If passed, mark enrollment as completed
  if (isPassed && session.moduleId == null) {
    await tx.update(enrollments).set({
      status: "completed",
      completedAt: new Date(),
      progressPercent: 100,
    }).where(eq(enrollments.id, params.enrollmentId));
  }

  if (isPassed && session.moduleId != null) {
    await tx.select().from(enrollments).where(eq(enrollments.id, params.enrollmentId)).for("update");
    const progress = (await tx.select().from(moduleProgress).where(and(eq(moduleProgress.enrollmentId, params.enrollmentId), eq(moduleProgress.moduleId, session.moduleId))).limit(1))[0];
    if (progress) await tx.update(moduleProgress).set({ isCompleted: true, completedAt: new Date() }).where(eq(moduleProgress.id, progress.id));
    else await tx.insert(moduleProgress).values({ enrollmentId: params.enrollmentId, moduleId: session.moduleId, isCompleted: true, completedAt: new Date() });
    const [enrolled] = await tx.select().from(enrollments).where(eq(enrollments.id, params.enrollmentId));
    const curriculum = await readCurriculum(enrolled.trainingVersionId);
    const modules = curriculum?.modules ?? await tx.select().from(trainingModules).where(and(eq(trainingModules.trainingId, params.trainingId), isNull(trainingModules.archivedAt)));
    const completed = await tx.select().from(moduleProgress).where(and(eq(moduleProgress.enrollmentId, params.enrollmentId), eq(moduleProgress.isCompleted, true)));
    const percent = modules.length ? Math.round(modules.filter(m => completed.some(p => p.moduleId === m.id)).length / modules.length * 100) : 0;
    await tx.update(enrollments).set({ progressPercent: percent, status: "in_progress", lastAccessedAt: new Date() }).where(and(eq(enrollments.id, params.enrollmentId), ne(enrollments.status, "completed")));
  }
  return {
    score,
    maxScore,
    expired,
    percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
    isPassed,
    passingScore,
    feedbackAvailable: true,
    feedback,
  };
  });
}

export async function getQuizAttempts(enrollmentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quizAttempts).where(eq(quizAttempts.enrollmentId, enrollmentId)).orderBy(desc(quizAttempts.startedAt));
}

// ─── Exam sessions, random question bank & proctoring (V2.1) ─────────────────
// Returns the exam question set: a random subset of N when randomizeQuestions +
// examQuestionCount are configured, otherwise all training questions.
export async function getExamQuestions(trainingId: number, moduleId?: number) {
  const db = await getDb();
  if (!db) return [];
  const training = (await db.select().from(trainings).where(eq(trainings.id, trainingId)).limit(1))[0];
  const all = await db.select().from(quizQuestions).where(and(isNull(quizQuestions.archivedAt), eq(quizQuestions.trainingId, trainingId), moduleId == null ? isNull(quizQuestions.moduleId) : eq(quizQuestions.moduleId, moduleId))).orderBy(quizQuestions.sortOrder);
  const n = training?.examQuestionCount ?? 0;
  if (moduleId != null) return all;
  if (!training?.randomizeQuestions || n <= 0 || n >= all.length) return all;
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export async function startExamSession(params: { enrollmentId: number; userId: number; trainingId: number; attemptNumber: number; moduleId?: number }) {
  const db = await getDb();
  if (!db) return null;
  await finalizeExpiredExams(params.enrollmentId);
  return db.transaction(async tx => {
    const enrollment = (await tx.select().from(enrollments).where(and(eq(enrollments.id, params.enrollmentId), eq(enrollments.userId, params.userId))).for("update").limit(1))[0];
    if (!enrollment || enrollment.trainingId !== params.trainingId || enrollment.status === "expired" || (enrollment.expiresAt && enrollment.expiresAt.getTime() <= Date.now()))
      throw new TRPCError({ code: "FORBIDDEN", message: "Inscription inaccessible ou expirée." });
    const curriculum = await readCurriculum(enrollment.trainingVersionId);
    const training = curriculum?.training ?? (await tx.select().from(trainings).where(eq(trainings.id, params.trainingId)).limit(1))[0];
    if (!training) throw new TRPCError({ code: "NOT_FOUND" });
    const modules = curriculum?.modules ?? await tx.select().from(trainingModules).where(and(eq(trainingModules.trainingId, params.trainingId), isNull(trainingModules.archivedAt)));
    const chapter = modules.find(m => m.id === params.moduleId);
    const policy = { passingScore: chapter?.quizPassingScore ?? training.passingScore ?? 75,
      maxAttempts: chapter?.quizMaxAttempts ?? training.maxAttempts ?? 3,
      timeLimitMin: chapter ? chapter.quizTimeLimitMin : training.examTimeLimitMin };
    if (params.moduleId != null && !modules.some(m => m.id === params.moduleId)) throw new TRPCError({ code: "BAD_REQUEST", message: "Chapitre étranger à cette formation." });
    if (params.moduleId == null) {
      const passed = await tx.select().from(quizAttempts).where(and(eq(quizAttempts.enrollmentId, params.enrollmentId), eq(quizAttempts.isPassed, true)));
      if (modules.some(m => m.isRequired !== false && !passed.some(p => p.moduleId === m.id))) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Validez les QCM de tous les chapitres requis avant l’examen final." });
    }
    const previous = await tx.select().from(examSessions).where(and(eq(examSessions.enrollmentId, params.enrollmentId), params.moduleId == null ? isNull(examSessions.moduleId) : eq(examSessions.moduleId, params.moduleId))).orderBy(desc(examSessions.startedAt));
    const passedScope = await tx.select().from(quizAttempts).where(and(eq(quizAttempts.enrollmentId, params.enrollmentId), eq(quizAttempts.isPassed, true), params.moduleId == null ? isNull(quizAttempts.moduleId) : eq(quizAttempts.moduleId, params.moduleId))).limit(1);
    if (passedScope.length) {
      const finished = previous.find(s => s.submittedAt && s.questionSnapshot && s.attemptNumber === passedScope[0].attemptNumber);
      if (finished) return { sessionId: finished.id, expiresAt: finished.expiresAt, timeLimitMin: policy.timeLimitMin, passingScore: finished.passingScoreSnapshot ?? 75,
        questions: finished.questionSnapshot!, savedAnswers: finished.savedAnswers ?? {}, answerRevision: finished.answerRevision,
        attemptNumber: finished.attemptNumber ?? 1, completed: true };
    }
    const active = previous.find(s => s.status === "active" && !s.submittedAt);
    if (active && (!active.expiresAt || active.expiresAt.getTime() > Date.now())) {
      const questions = (active.questionSnapshot ?? await getQuizQuestions(params.trainingId)).filter(q => active.questionIds?.includes(q.id));
      return { sessionId: active.id, expiresAt: active.expiresAt, timeLimitMin: policy.timeLimitMin, passingScore: active.passingScoreSnapshot ?? training.passingScore ?? 75, questions, savedAnswers: active.savedAnswers ?? {}, answerRevision: active.answerRevision, attemptNumber: active.attemptNumber ?? 1, completed: false };
    }
    if (active) throw new TRPCError({ code: "CONFLICT", message: "Le résultat de cette session expirée est en cours de traitement. Si cette attente persiste, contactez l’équipe pédagogique." });
    if (previous.length >= policy.maxAttempts)
      throw new TRPCError({ code: "FORBIDDEN", message: "Nombre maximal de tentatives atteint." });
    let questions = curriculum ? curriculum.questions.filter(q => params.moduleId == null ? q.moduleId == null : q.moduleId === params.moduleId) : await getExamQuestions(params.trainingId, params.moduleId);
    if (curriculum && params.moduleId == null && training.randomizeQuestions && training.examQuestionCount && training.examQuestionCount < questions.length) {
      questions = [...questions];
      for (let i = questions.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [questions[i], questions[j]] = [questions[j], questions[i]]; }
      questions = questions.slice(0, training.examQuestionCount);
    }
    if (!questions.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Aucune question disponible pour cet examen." });
    const expiresAt = policy.timeLimitMin ? new Date(Date.now() + policy.timeLimitMin * 60000) : null;
    const inserted = await tx.insert(examSessions).values({
      enrollmentId: params.enrollmentId, moduleId: params.moduleId ?? null, userId: params.userId, trainingId: params.trainingId,
      attemptNumber: previous.length + 1, questionIds: questions.map(q => q.id), questionSnapshot: questions, passingScoreSnapshot: policy.passingScore, expiresAt, status: "active",
    }).returning({ id: examSessions.id });
    return { sessionId: inserted[0].id, expiresAt, timeLimitMin: policy.timeLimitMin, passingScore: policy.passingScore, questions, savedAnswers: {}, answerRevision: 0, attemptNumber: previous.length + 1, completed: false };
  });
}

/** Compare-and-set prevents delayed autosaves or a second tab overwriting newer answers. */
export async function saveExamAnswers(params: { sessionId: number; userId: number; revision: number; answers: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  return db.transaction(async tx => {
    const session = (await tx.select().from(examSessions).where(eq(examSessions.id, params.sessionId)).for("update").limit(1))[0];
    if (!session || session.userId !== params.userId) throw new TRPCError({ code: "FORBIDDEN" });
    if (session.status !== "active" || session.submittedAt || (session.expiresAt && session.expiresAt.getTime() <= Date.now()))
      throw new TRPCError({ code: "CONFLICT", message: "La session est terminée. Les réponses ne peuvent plus être modifiées." });
    if (params.revision !== session.answerRevision) {
      // A lost acknowledgement may replay only the immediately preceding, identical save.
      if (params.revision + 1 === session.answerRevision && isDeepStrictEqual(params.answers, session.savedAnswers ?? {})) {
        return { revision: session.answerRevision, savedAt: session.answersSavedAt };
      }
      throw new TRPCError({ code: "CONFLICT", message: "Les réponses ont changé dans une autre fenêtre. Rechargez la session." });
    }
    const ids = new Set((session.questionIds ?? []).map(String));
    if (Object.keys(params.answers).some(id => !ids.has(id))) throw new TRPCError({ code: "BAD_REQUEST", message: "Question étrangère à cette session." });
    const savedAt = new Date();
    await tx.update(examSessions).set({ savedAnswers: params.answers, answerRevision: session.answerRevision + 1, answersSavedAt: savedAt }).where(eq(examSessions.id, session.id));
    return { revision: session.answerRevision + 1, savedAt };
  });
}

/** Expired sessions are graded only against answers received before their deadline. */
export async function finalizeExpiredExams(enrollmentId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for exam finalization");
  const expired = await db.select().from(examSessions).where(and(
    eq(examSessions.status, "active"), sql`${examSessions.expiresAt} <= now()`,
    enrollmentId === undefined ? undefined : eq(examSessions.enrollmentId, enrollmentId),
    sql`not exists (select 1 from exam_finalization_failures f where f."examSessionId" = ${examSessions.id} and f."retryAfter" > now())`,
  )).orderBy(examSessions.expiresAt, examSessions.id).limit(100);
  const result = { processed: 0, failed: 0 };
  for (const session of expired) {
    try {
      await submitQuizAttempt({ sessionId: session.id, userId: session.userId, enrollmentId: session.enrollmentId, trainingId: session.trainingId, answers: {}, attemptNumber: session.attemptNumber ?? 1 });
      result.processed++;
    } catch (error) {
      const errorCode = error instanceof TRPCError ? error.code : "INTERNAL_ERROR";
      await db.insert(examFinalizationFailures).values({ examSessionId: session.id, errorCode, retryAfter: new Date(Date.now() + 5 * 60_000) });
      result.failed++;
    }
  }
  return result;
}

export async function getExamFinalizationFailures() {
  const db = (await getDb())!;
  return db.select({ sessionId: examSessions.id, enrollmentId: examSessions.enrollmentId, trainingId: examSessions.trainingId,
    expiresAt: examSessions.expiresAt, lastFailureAt: sql<Date>`max(${examFinalizationFailures.createdAt})`,
    retryAfter: sql<Date>`max(${examFinalizationFailures.retryAfter})`, failureCount: sql<number>`count(*)::int`,
  }).from(examFinalizationFailures).innerJoin(examSessions, eq(examSessions.id, examFinalizationFailures.examSessionId))
    .where(eq(examSessions.status, "active")).groupBy(examSessions.id).orderBy(examSessions.expiresAt).limit(100);
}

export async function logProctoringEvent(params: { sessionId: number; userId: number; type: string; detail?: string }) {
  const db = await getDb();
  if (!db) return;
  const session = (await db.select().from(examSessions).where(eq(examSessions.id, params.sessionId)).limit(1))[0];
  if (!session || session.userId !== params.userId) return;
  await db.insert(proctoringEvents).values({ sessionId: params.sessionId, type: params.type, detail: params.detail ?? null });
  return { success: true };
}

// Admin: exam integrity = sessions + their proctoring events for an enrollment.
export async function getExamIntegrity(enrollmentId: number) {
  const db = await getDb();
  if (!db) return [];
  const sessions = await db.select().from(examSessions).where(eq(examSessions.enrollmentId, enrollmentId)).orderBy(desc(examSessions.startedAt));
  const result = [];
  for (const s of sessions) {
    const events = await db.select().from(proctoringEvents).where(eq(proctoringEvents.sessionId, s.id)).orderBy(proctoringEvents.at);
    result.push({ ...s, events });
  }
  return result;
}

// ─── Technician file: external trainings + consolidated record (V2.2) ────────
export async function getExternalTrainings(employeeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(externalTrainings).where(eq(externalTrainings.employeeId, employeeId)).orderBy(desc(externalTrainings.completedAt));
}

export async function createExternalTraining(data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(externalTrainings).values(data as any);
  return { success: true };
}

// Consolidated technician dossier: internal (platform) + external + recurrencies.
export async function getTechnicianFile(employeeId: number) {
  const db = await getDb();
  if (!db) return null;
  const emp = (await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1))[0];
  if (!emp) return null;
  const externals = await db.select().from(externalTrainings).where(eq(externalTrainings.employeeId, employeeId)).orderBy(desc(externalTrainings.completedAt));
  const internalEnrollments: any[] = [];
  const internalCertificates: any[] = [];
  if (emp.userId) {
    const enrs = await db.select().from(enrollments).where(eq(enrollments.userId, emp.userId));
    for (const e of enrs) {
      const t = (await db.select().from(trainings).where(eq(trainings.id, e.trainingId)).limit(1))[0];
      internalEnrollments.push({ ...e, training: t ?? null });
    }
    const certs = await db.select().from(certificates).where(eq(certificates.userId, emp.userId)).orderBy(desc(certificates.issuedAt));
    for (const c of certs) {
      const t = (await db.select().from(trainings).where(eq(trainings.id, c.trainingId)).limit(1))[0];
      internalCertificates.push({ ...c, training: t ?? null });
    }
  }
  const recs = await db.select().from(recurrencies).where(eq(recurrencies.employeeId, employeeId));
  const recurrenciesOut = [];
  for (const r of recs) {
    const t = (await db.select().from(trainings).where(eq(trainings.id, r.trainingId)).limit(1))[0];
    recurrenciesOut.push({ ...r, status: computeRecurrencyStatus(r.nextDueAt, r.lastCompletedAt), training: t ?? null });
  }
  return { employee: emp, enrollments: internalEnrollments, certificates: internalCertificates, recurrencies: recurrenciesOut, externalTrainings: externals };
}

// ─── Corporate consolidated view + TNA (V2.3) ────────────────────────────────
// Consolidated compliance rollups grouped by site (base) and by department.
export async function getCompanyConsolidated(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user?.companyId) return null;
  const company = (await db.select().from(companies).where(eq(companies.id, user.companyId)).limit(1))[0];
  const emps = await db.select().from(employees).where(eq(employees.companyId, user.companyId));
  const recs = await db.select().from(recurrencies).where(eq(recurrencies.companyId, user.companyId));
  const empById = new Map(emps.map((e) => [e.id, e]));
  const blank = () => ({ ok: 0, due_soon: 0, overdue: 0, not_started: 0, total: 0 });
  const byBase: Record<string, ReturnType<typeof blank>> = {};
  const byDept: Record<string, ReturnType<typeof blank>> = {};
  for (const r of recs) {
    const emp = empById.get(r.employeeId) as any;
    const status = computeRecurrencyStatus(r.nextDueAt, r.lastCompletedAt);
    const baseKey = (emp?.base as string) || "—";
    const deptKey = (emp?.department as string) || "—";
    byBase[baseKey] = byBase[baseKey] ?? blank();
    byDept[deptKey] = byDept[deptKey] ?? blank();
    (byBase[baseKey] as any)[status]++; byBase[baseKey].total++;
    (byDept[deptKey] as any)[status]++; byDept[deptKey].total++;
  }
  return { country: company?.country ?? null, employeeCount: emps.length, recurrencyCount: recs.length, byBase, byDepartment: byDept };
}

export async function getRoleRequirements(companyId: number | null) {
  const db=await getDb();if(!db)throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
  const scope=companyId===null?isNull(roleRequirements.companyId):or(isNull(roleRequirements.companyId),eq(roleRequirements.companyId,companyId));
  const visibleCourse=or(
    and(isNull(trainings.ownerOrgId),eq(trainings.isPublished,true),isNull(trainings.archivedAt)),
    companyId===null?undefined:eq(trainings.ownerOrgId,companyId),
  );
  const rows=await db.select({rule:roleRequirements,training:{id:trainings.id,title:trainings.title,isPublished:trainings.isPublished,archivedAt:trainings.archivedAt}})
    .from(roleRequirements).leftJoin(trainings,and(eq(trainings.id,roleRequirements.trainingId),visibleCourse))
    .where(and(isNull(roleRequirements.archivedAt),scope)).orderBy(roleRequirements.id);
  return rows.map(row=>({...row.rule,training:row.training}));
}

export async function createRoleRequirement(data: Record<string, unknown>, actorId: number) {
  const parsed = roleRequirementInput.extend({ companyId: z.number().int().positive().max(2147483647).nullable() }).safeParse(data);
  if (!parsed.success) throw new TRPCError({ code: "BAD_REQUEST", message: "Règle invalide : période entière de 1 à 120 mois et champs de longueur autorisée requis." });
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  return db.transaction(async tx => {
    const [actor] = await tx.select().from(users).where(eq(users.id, actorId)).for('share');
    if (actor?.status !== 'active' || (actor.companyId ?? null) !== parsed.data.companyId) throw new TRPCError({code:'FORBIDDEN'});
    if (parsed.data.companyId === null) {
      if (actor.role !== 'admin') throw new TRPCError({code:'FORBIDDEN'});
    } else {
      const [company] = await tx.select().from(companies).where(eq(companies.id, parsed.data.companyId)).for('share');
      if (company?.status !== 'ACTIVE') throw new TRPCError({code:'FORBIDDEN'});
      if (actor.role !== 'admin') {
        const [manager] = await tx.select().from(affiliations).where(and(eq(affiliations.personId,actor.id),eq(affiliations.orgId,company.id),eq(affiliations.role,'MANAGER'),eq(affiliations.status,'ACTIVE'))).for('share');
        if (!manager) throw new TRPCError({code:'FORBIDDEN'});
      }
    }
    const [course] = await tx.select().from(trainings).where(eq(trainings.id, parsed.data.trainingId)).for("share");
    if (!course || course.archivedAt || !course.isPublished) throw new TRPCError({ code: "BAD_REQUEST", message: "Choisissez une formation publiée et non archivée." });
    if (course.ownerOrgId !== null && course.ownerOrgId !== parsed.data.companyId) throw new TRPCError({ code: "FORBIDDEN" });
    await tx.insert(roleRequirements).values({...parsed.data,createdBy:actor.id});
    return { success: true };
  });
}

export async function deleteRoleRequirement(id: number, actorId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  return db.transaction(async tx => {
    const [row] = await tx.select().from(roleRequirements).where(eq(roleRequirements.id, id)).for("update");
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    const [actor] = await tx.select().from(users).where(eq(users.id, actorId)).for("share");
    if (actor?.status !== "active") throw new TRPCError({ code: "FORBIDDEN" });
    if (actor.role !== "admin") {
      if (!row.companyId || actor.companyId !== row.companyId) throw new TRPCError({ code: "FORBIDDEN" });
      const [company] = await tx.select().from(companies).where(eq(companies.id, row.companyId)).for("share");
      const [manager] = await tx.select().from(affiliations).where(and(eq(affiliations.personId, actor.id), eq(affiliations.orgId, row.companyId), eq(affiliations.role, "MANAGER"), eq(affiliations.status, "ACTIVE"))).for("share");
      if (company?.status !== "ACTIVE" || !manager) throw new TRPCError({ code: "FORBIDDEN" });
    }
    if (!row.archivedAt) await tx.update(roleRequirements).set({ archivedAt: new Date(), archivedBy: actor.id }).where(eq(roleRequirements.id, id));
    return { success: true };
  });
}

// Training Needs Analysis: for each active employee, create the recurrencies
// required by matching role rules that aren't tracked yet. Returns how many were added.
export async function runTNA(companyId: number, actorId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`company-tna:${companyId}`}, 0))`);
    const rules = await tx.select().from(roleRequirements).where(and(isNull(roleRequirements.archivedAt), or(isNull(roleRequirements.companyId), eq(roleRequirements.companyId, companyId)))).orderBy(roleRequirements.id).for("share");
    const [company] = await tx.select().from(companies).where(eq(companies.id, companyId)).for("share");
    if (company?.status !== "ACTIVE") throw new TRPCError({ code: "FORBIDDEN" });
    const [actor] = await tx.select().from(users).where(eq(users.id, actorId)).for("share");
    if (actor?.status !== "active") throw new TRPCError({ code: "FORBIDDEN" });
    if (actor.companyId !== companyId) throw new TRPCError({ code: "CONFLICT", message: "La compagnie sélectionnée a changé. Actualisez avant de relancer l’analyse." });
    if (actor.role !== "admin") {
      const [manager] = await tx.select().from(affiliations).where(and(eq(affiliations.personId, actor.id), eq(affiliations.orgId, companyId), eq(affiliations.role, "MANAGER"), eq(affiliations.status, "ACTIVE"))).for("share");
      if (!manager) throw new TRPCError({ code: "FORBIDDEN" });
    }
    const emps = (await tx.select().from(employees).where(eq(employees.companyId, companyId)).orderBy(employees.id).for("share")).filter(e => e.isActive !== false);
    let created = 0;
    const startedAt = new Date();
    for (const emp of emps) {
      const matched = new Map<number, typeof rules>();
      for (const rule of rules) {
        if (!ruleMatchesEmployee(emp, rule)) continue;
        const group = matched.get(rule.trainingId) ?? [];
        group.push(rule);
        matched.set(rule.trainingId, group);
      }
      for (const group of Array.from(matched.values())) {
        const rule = group[0];
        const existing = await tx.select().from(recurrencies)
          .where(and(eq(recurrencies.employeeId, emp.id), eq(recurrencies.trainingId, rule.trainingId))).limit(1);
        if (existing[0]) continue;
        const invalidRule=group.find(item=>!roleRequirementInput.shape.periodMonths.safeParse(item.periodMonths).success);
        if(invalidRule)throw new TRPCError({code:"PRECONDITION_FAILED",message:`Période invalide pour la règle #${invalidRule.id}, formation #${invalidRule.trainingId}. La période doit être un entier de 1 à 120 mois ; archivez et remplacez cette règle après vérification.`});
        if (new Set(group.map(item => item.periodMonths)).size > 1) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Périodes contradictoires pour le salarié #${emp.id}, formation #${rule.trainingId}, règles ${group.slice(0,10).map(item => `#${item.id}`).join(", ")}. Vérifiez les règles avant de relancer l’analyse.` });
        }
        const [course]=await tx.select({id:trainings.id,isPublished:trainings.isPublished,archivedAt:trainings.archivedAt,ownerOrgId:trainings.ownerOrgId}).from(trainings).where(eq(trainings.id,rule.trainingId)).for('share');
        if(!course || !course.isPublished || course.archivedAt || (course.ownerOrgId!==null && course.ownerOrgId!==companyId)) {
          throw new TRPCError({code:"PRECONDITION_FAILED",message:`Formation indisponible pour le suivi #${rule.trainingId}, règle #${rule.id}. Vérifiez le programme et archivez la règle si elle ne s’applique plus.`});
        }
        const nextDueAt = addCalendarMonths(startedAt, rule.periodMonths);
        await tx.insert(recurrencies).values({ companyId, employeeId: emp.id, trainingId: rule.trainingId, periodMonths: rule.periodMonths, nextDueAt, status: "not_started" });
        created++;
      }
    }
    return { created };
  });
}

// ─── Affiliations (person-centric governance edge) ───────────────────────────
// Backfill: derive affiliations from the legacy single-link model (users.companyId,
// employees.userId). Idempotent (check-first) — safe to run on every seed. Does NOT
// touch users.companyId or any existing company scoping; affiliations run in parallel.
export async function backfillAffiliations(): Promise<{ created: number; linked: number }> {
  const db = await getDb();
  if (!db) return { created: 0, linked: 0 };
  let created = 0;
  let linked = 0;

  // 1) Each user attached to a company → one ACTIVE affiliation (role from global role).
  const allUsers = await db.select().from(users);
  for (const u of allUsers) {
    if (!u.companyId) continue;
    const existing = await db.select().from(affiliations)
      .where(and(eq(affiliations.personId, u.id), eq(affiliations.orgId, u.companyId))).limit(1);
    if (existing[0]) continue;
    await db.insert(affiliations).values({
      personId: u.id, orgId: u.companyId,
      role: u.role === "company_manager" ? "MANAGER" : "MEMBER",
      status: "ACTIVE",
    });
    created++;
  }

  // 2) Each employee linked to a login account → link/create its affiliation, carrying
  //    the pro email as an attribute of the edge (never a login — INV-1).
  const emps = await db.select().from(employees);
  for (const e of emps) {
    if (!e.userId) continue;
    const existing = await db.select().from(affiliations)
      .where(and(eq(affiliations.personId, e.userId), eq(affiliations.orgId, e.companyId))).limit(1);
    if (existing[0]) {
      if (existing[0].employeeId == null) {
        await db.update(affiliations).set({ employeeId: e.id, proEmail: existing[0].proEmail ?? e.email })
          .where(eq(affiliations.id, existing[0].id));
        linked++;
      }
      continue;
    }
    await db.insert(affiliations).values({
      personId: e.userId, orgId: e.companyId, employeeId: e.id, proEmail: e.email,
      role: "MEMBER", status: "ACTIVE",
    });
    created++;
  }

  return { created, linked };
}

// ─── Credentials (dual-state proof of competency) ────────────────────────────
// Create the LIVING credential backing a freshly issued certificate (INV-6). The
// controller/origin are derived from HOW the enrollment arose: an org-assigned
// enrollment (employee link, or a company order) → controller ORG; a self-driven one
// → controller PERSON. Idempotent (one credential per certificate).
export async function createCredentialForIssuedCertificate(certificateId: number,executor?:DatabaseTransaction):Promise<typeof credentials.$inferSelect|null> {
  if(!executor){const db=await getDb();if(!db)return null;return db.transaction(tx=>createCredentialForIssuedCertificate(certificateId,tx));}
  const db=executor;
  const cert = (await db.select().from(certificates).where(eq(certificates.id, certificateId)).limit(1).for('update'))[0];
  if (!cert) return null;
  const existing = await db.select().from(credentials).where(eq(credentials.certificateId, certificateId)).limit(1);
  if (existing[0]) return existing[0];
  const enr = (await db.select().from(enrollments).where(eq(enrollments.id, cert.enrollmentId)).limit(1))[0];

  let origin: "ORG_ASSIGNED" | "INDEPENDENT" = "INDEPENDENT";
  let orgId: number | null = null;
  if (enr?.assignedOrgId) { origin = "ORG_ASSIGNED"; orgId = enr.assignedOrgId; }
  if (origin === "INDEPENDENT" && enr?.employeeId) {
    const emp = (await db.select().from(employees).where(eq(employees.id, enr.employeeId)).limit(1))[0];
    if (emp) { origin = "ORG_ASSIGNED"; orgId = emp.companyId; }
  }
  if (origin === "INDEPENDENT" && enr?.orderId) {
    const ord = (await db.select().from(orders).where(eq(orders.id, enr.orderId)).limit(1))[0];
    if (ord?.companyId) { origin = "ORG_ASSIGNED"; orgId = ord.companyId; }
  }
  const controller: "ORG" | "PERSON" = origin === "ORG_ASSIGNED" ? "ORG" : "PERSON";

  let affiliationId: number | null = null;
  if (origin === "ORG_ASSIGNED" && orgId != null) {
    const aff = (await db.select().from(affiliations).where(and(
      eq(affiliations.personId, cert.userId), eq(affiliations.orgId, orgId), eq(affiliations.status, "ACTIVE"),
    )).limit(1))[0];
    affiliationId = aff?.id ?? null;
  }

  const objs = await db.select().from(certificateObjectives).where(eq(certificateObjectives.certificateId, certificateId));
  const objectiveIds = objs.map((o) => o.objectiveId);

  const inserted = await db.insert(credentials).values({
    personId: cert.userId, trainingId: cert.trainingId, moduleId: cert.trainingId,
    certificateId, part66Coverage: objectiveIds, state: "LIVING",
    controller, origin, affiliationId,
    obtainedAt: cert.issuedAt, expiresAt: cert.expiresAt,
  }).returning();
  return inserted[0];
}

// Backfill: one LIVING credential per certificate that lacks one. Conservative default
// (INDEPENDENT/PERSON) unless the enrollment clearly came from an org. Idempotent.
export async function backfillCredentials(): Promise<{ created: number }> {
  const db = await getDb();
  if (!db) return { created: 0 };
  const certs = await db.select().from(certificates);
  let created = 0;
  for (const c of certs) {
    const has = await db.select().from(credentials).where(eq(credentials.certificateId, c.id)).limit(1);
    if (has[0]) continue;
    if (await createCredentialForIssuedCertificate(c.id)) created++;
  }
  return { created };
}

async function recordCredentialSharing(tx:DatabaseTransaction,proof:typeof credentials.$inferSelect,action:'SHARED'|'WITHDRAWN'){
  const [aff]=proof.affiliationId==null?[]:await tx.select().from(affiliations).where(and(eq(affiliations.id,proof.affiliationId),eq(affiliations.personId,proof.personId)));
  const [org]=aff?await tx.select().from(companies).where(eq(companies.id,aff.orgId)):[];
  const [archive]=proof.certificateId==null?[]:await tx.select().from(certificateArchives).where(eq(certificateArchives.certificateId,proof.certificateId));
  const [training]=proof.trainingId==null?[]:await tx.select().from(trainings).where(eq(trainings.id,proof.trainingId));
  await tx.insert(credentialSharingEvents).values({personId:proof.personId,credentialId:proof.id,orgId:org?.id??null,action,
    proofLabel:proof.label??archive?.snapshot.training.title??training?.title??null,orgName:org?.name??null});
}

export async function getCredentialSharingHistory(personId:number,cursor?:number){
  const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  const rows=await db.select().from(credentialSharingEvents).where(and(eq(credentialSharingEvents.personId,personId),cursor==null?undefined:lt(credentialSharingEvents.id,cursor))).orderBy(desc(credentialSharingEvents.id)).limit(26);
  const entries=rows.slice(0,25);return {entries,nextCursor:rows.length>25?entries[24].id:null};
}

// INV-5: a person surfaces a prior/external qualification THEMSELVES. Creates a LIVING,
// PERSON-controlled, INDEPENDENT credential marked surfaced, linked to the person's
// active affiliation so it becomes visible in that org's bounded view.
export async function surfaceCredentialForPerson(personId: number, data: {
  orgId:number; label: string; provider?: string | null; trainingId?: number | null; objectiveIds?: number[];
  completedAt?: Date | null; expiresAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx=>{
    const [person]=await tx.select().from(users).where(eq(users.id,personId)).for('share');
    const [org]=await tx.select().from(companies).where(eq(companies.id,data.orgId)).for('share');
    const [aff]=await tx.select().from(affiliations).where(and(eq(affiliations.personId,personId),eq(affiliations.orgId,data.orgId),eq(affiliations.status,'ACTIVE'))).for('share');
    if(person?.status!=='active'||org?.status!=='ACTIVE'||!aff)throw new TRPCError({code:'FORBIDDEN',message:'Affiliation active requise pour partager cette preuve.'});
    const [inserted]=await tx.insert(credentials).values({
      personId, trainingId: data.trainingId ?? null, moduleId: data.trainingId ?? null,
      part66Coverage: data.objectiveIds ?? [], label: data.label, provider: data.provider ?? null,
      state: "LIVING", controller: "PERSON", origin: "INDEPENDENT",
      affiliationId: aff.id, surfacedByPersonAt: new Date(),
      obtainedAt: data.completedAt ?? null, expiresAt: data.expiresAt ?? null,
    }).returning();
    await recordCredentialSharing(tx,inserted,'SHARED');
    return inserted;
  });
}

// Explicit sharing of an issued certificate preserves its verified identity and objectives.
export async function shareCertificateForPerson(personId:number,orgId:number,certificateId:number){
  const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  return db.transaction(async tx=>{
    const [person]=await tx.select().from(users).where(eq(users.id,personId)).for('share');
    const [org]=await tx.select().from(companies).where(eq(companies.id,orgId)).for('share');
    const [aff]=await tx.select().from(affiliations).where(and(eq(affiliations.personId,personId),eq(affiliations.orgId,orgId),eq(affiliations.status,'ACTIVE'))).for('share');
    if(person?.status!=='active'||org?.status!=='ACTIVE'||!aff)throw new TRPCError({code:'FORBIDDEN'});
    const [cert]=await tx.select().from(certificates).where(eq(certificates.id,certificateId)).for('share');
    if(!cert||cert.userId!==personId)throw new TRPCError({code:'FORBIDDEN'});
    if(certificateStatus(cert)!=='valid')throw new TRPCError({code:'PRECONDITION_FAILED',message:'Ce certificat n’est plus valide.'});
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`share-certificate:${personId}:${aff.id}:${certificateId}`}))`);
    const existing=await tx.select().from(credentials).where(and(eq(credentials.personId,personId),eq(credentials.affiliationId,aff.id),eq(credentials.certificateId,certificateId))).for('update');
    const current=existing.find(c=>c.state==='LIVING'&&(c.expiresAt==null||c.expiresAt.getTime()>Date.now())&&(c.origin==='ORG_ASSIGNED'||c.surfacedByPersonAt!=null));
    if(current)return current;
    const [archive]=await tx.select().from(certificateArchives).where(eq(certificateArchives.certificateId,certificateId));
    const objectives=archive?archive.snapshot.objectives.map(o=>o.id):(await tx.select().from(certificateObjectives).where(eq(certificateObjectives.certificateId,certificateId))).map(o=>o.objectiveId);
    const [created]=await tx.insert(credentials).values({personId,affiliationId:aff.id,certificateId,
      trainingId:cert.trainingId,moduleId:cert.trainingId,part66Coverage:objectives,
      obtainedAt:cert.issuedAt,expiresAt:cert.expiresAt,state:'LIVING',origin:'INDEPENDENT',controller:'PERSON',surfacedByPersonAt:new Date(),
    }).returning();
    await recordCredentialSharing(tx,created,'SHARED');
    return created;
  });
}

// INV-5: the person may withdraw a surfaced credential ONLY while it is not locked
// (i.e., not yet relied upon by the org during employment). Locked → refused.
export async function unsurfaceCredentialForPerson(personId: number, credentialId: number): Promise<{ ok: boolean; reason?: string }> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "db" };
  return db.transaction(async tx => {
    const [person]=await tx.select().from(users).where(eq(users.id,personId)).for('share');
    if(person?.status!=='active')return {ok:false,reason:'inactive'};
    // Serialize with createSignoff: withdrawal must observe a committed reliance lock.
    const [cred] = await tx.select().from(credentials).where(eq(credentials.id, credentialId)).for('update');
    if (!cred || cred.personId !== personId) return { ok: false, reason: "not_found" };
    if (cred.surfacedByPersonAt == null || cred.origin !== "INDEPENDENT") return { ok: false, reason: "not_surfaced" };
    const locked = cred.lockedInOrgViewUntil != null && cred.lockedInOrgViewUntil.getTime() > Date.now();
    if (locked) return { ok: false, reason: "locked" };
    // Keep the original record and references from past decisions; end current sharing.
    await tx.update(credentials).set({ surfacedByPersonAt: null }).where(eq(credentials.id, credentialId));
    await recordCredentialSharing(tx,cred,'WITHDRAWN');
    return { ok: true };
  });
}

// Explicitly validated proof is retained while employed; reading does not set this lock.
const LOCK_SENTINEL = new Date("9999-12-31T00:00:00Z");

export async function getPersonCredentials(personId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(credentials).where(eq(credentials.personId, personId)).orderBy(desc(credentials.createdAt));
}

// ─── Sign-offs (INV-4: the human determination of compliance by a manager) ────
export async function createSignoff(data: {
  requestId:string;
  employeeId:number; managerPersonId: number; subjectPersonId: number; orgId: number; affiliationId?: number | null;
  credentialId?: number | null; trainingId?: number | null; scope?: string; decision?: string; note?: string | null;
}) {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx=>{
    const [actor]=await tx.select().from(users).where(eq(users.id,data.managerPersonId)).for('share');
    if(actor?.status!=='active')throw new TRPCError({code:'FORBIDDEN'});
    const [org]=await tx.select().from(companies).where(eq(companies.id,data.orgId)).for('share');
    if(org?.status!=='ACTIVE')throw new TRPCError({code:'FORBIDDEN'});
    const [employee]=await tx.select().from(employees).where(eq(employees.id,data.employeeId)).for('share');
    if(!employee?.isActive||employee.companyId!==data.orgId||employee.userId!==data.subjectPersonId)throw new TRPCError({code:'FORBIDDEN'});
    const [subject]=await tx.select().from(users).where(eq(users.id,data.subjectPersonId)).for('share');
    if(subject?.status!=='active')throw new TRPCError({code:'FORBIDDEN'});
    if(actor.role!=='admin'){
      const [manager]=await tx.select().from(affiliations).where(and(eq(affiliations.personId,actor.id),eq(affiliations.orgId,data.orgId),eq(affiliations.role,'MANAGER'),eq(affiliations.status,'ACTIVE'))).for('share');
      if(!manager)throw new TRPCError({code:'FORBIDDEN'});
    }
    const [subjectAffiliation]=await tx.select().from(affiliations).where(and(eq(affiliations.personId,data.subjectPersonId),eq(affiliations.orgId,data.orgId),eq(affiliations.status,'ACTIVE'))).for('share');
    if(!subjectAffiliation)throw new TRPCError({code:'FORBIDDEN'});
    const requestId=z.string().uuid().parse(data.requestId).toLowerCase();
    const requestFingerprint=createHash('sha256').update(JSON.stringify({
      employeeId:data.employeeId,subjectPersonId:data.subjectPersonId,orgId:data.orgId,
      credentialId:data.credentialId??null,trainingId:data.trainingId??null,
      scope:data.scope??'COMPETENCE',decision:data.decision??'VALIDATED',note:data.note??null,
    })).digest('hex');
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`signoff:${data.managerPersonId}:${requestId}`}))`);
    const [previous]=await tx.select().from(signoffs).where(and(eq(signoffs.managerPersonId,data.managerPersonId),eq(signoffs.requestId,requestId)));
    if(previous){
      if(previous.requestFingerprint!==requestFingerprint)throw new TRPCError({code:'CONFLICT',message:'Cette demande de signature correspond déjà à une autre décision.'});
      return previous;
    }
    let proofSnapshot:SignoffSnapshot["proof"]=null;
    let proofToLock:number|null=null;
    let credentialId=data.credentialId??null;
    let trainingId=data.trainingId??null;
    if(credentialId!=null){
      const [proof]=await tx.select().from(credentials).where(eq(credentials.id,credentialId)).for('update');
      if(!proof||proof.personId!==data.subjectPersonId)throw new TRPCError({code:'FORBIDDEN',message:'Cette preuve ne concerne pas le technicien.'});
      const [sourceAffiliation]=proof.affiliationId!=null?await tx.select().from(affiliations).where(eq(affiliations.id,proof.affiliationId)).for('share'):[];
      const belongsHere=sourceAffiliation?.id===subjectAffiliation.id&&sourceAffiliation.personId===data.subjectPersonId;
      if(!belongsHere||(proof.origin!=='ORG_ASSIGNED'&&proof.surfacedByPersonAt==null))throw new TRPCError({code:'FORBIDDEN',message:'Cette preuve n’est pas partagée avec cette compagnie.'});
      if(trainingId!=null&&proof.trainingId!==trainingId)throw new TRPCError({code:'BAD_REQUEST',message:'La preuve ne correspond pas à la formation.'});
      trainingId=trainingId??proof.trainingId;
      const [certificate]=proof.certificateId!=null?await tx.select().from(certificates).where(eq(certificates.id,proof.certificateId)).for('share'):[];
      if(certificate&&(certificate.userId!==data.subjectPersonId||certificate.trainingId!==proof.trainingId))throw new TRPCError({code:'FORBIDDEN',message:'Le certificat ne correspond pas à cette preuve.'});
      if((data.decision??'VALIDATED')==='VALIDATED'){
        if(proof.surfacedByPersonAt!=null&&proof.lockedInOrgViewUntil==null)proofToLock=proof.id;
        if(proof.state!=='LIVING'||(proof.expiresAt&&proof.expiresAt.getTime()<=Date.now()))throw new TRPCError({code:'PRECONDITION_FAILED',message:'Cette preuve n’est plus active.'});
        if(proof.certificateId!=null&&(!certificate||certificateStatus(certificate)!=='valid'))throw new TRPCError({code:'PRECONDITION_FAILED',message:'Le certificat associé n’est pas valide.'});
      }
      proofSnapshot={id:proof.id,label:proof.label,state:proof.state,expiresAt:proof.expiresAt?.toISOString()??null,certificate:proof.certificateId==null?null:{id:proof.certificateId,number:certificate?.certificateNumber??null,status:certificate?certificateStatus(certificate):'missing',expiresAt:certificate?.expiresAt?.toISOString()??null}};
    }
    const [training]=trainingId!=null?await tx.select().from(trainings).where(eq(trainings.id,trainingId)).for('share'):[];
    if(trainingId!=null&&!training)throw new TRPCError({code:'BAD_REQUEST',message:'Formation introuvable.'});
    const snapshot:SignoffSnapshot={managerName:actor.name,subjectName:subject.name,trainingTitle:training?.title??null,proof:proofSnapshot};
    const inserted = await tx.insert(signoffs).values({
      managerPersonId: data.managerPersonId, subjectPersonId: data.subjectPersonId, orgId: data.orgId,
      affiliationId: subjectAffiliation.id, credentialId, trainingId,snapshot,
      requestId,requestFingerprint,
      scope: data.scope ?? "COMPETENCE", decision: data.decision ?? "VALIDATED", note: data.note ?? null,
    }).returning();
    if(proofToLock!=null)await tx.update(credentials).set({lockedInOrgViewUntil:LOCK_SENTINEL}).where(eq(credentials.id,proofToLock));
    return inserted[0];
  });
}

export async function getSignoffsForSubject(subjectPersonId: number, orgId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(signoffs)
    .where(and(eq(signoffs.subjectPersonId, subjectPersonId), eq(signoffs.orgId, orgId)))
    .orderBy(desc(signoffs.signedAt));
  const out = [];
  for (const s of rows) {
    const mgr = (await db.select().from(users).where(eq(users.id, s.managerPersonId)).limit(1))[0];
    const t = s.trainingId ? (await db.select().from(trainings).where(eq(trainings.id, s.trainingId)).limit(1))[0] : null;
    out.push({ ...s, managerName: s.snapshot?s.snapshot.managerName:mgr?.name ?? null, trainingTitle: s.snapshot?s.snapshot.trainingTitle:t?.title ?? null });
  }
  return out;
}

export async function setAffiliationRole(affiliationId: number, role: "MANAGER" | "MEMBER") {
  const db = await getDb();
  if (!db) return { ok: false };
  await db.update(affiliations).set({ role }).where(eq(affiliations.id, affiliationId));
  return { ok: true };
}

// Account closure removes profile identity while retaining evidentiary records.
// This does not claim complete erasure of personal data in certificates or archives.
export async function erasePerson(personId:number,actorId:number,password?:string){
  const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  return db.transaction(async tx=>{
    // Serialize closures, including two administrators attempting to close each other.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('account-closures'))`);
    const [actor]=await tx.select().from(users).where(eq(users.id,actorId)).for('update');
    if(actor?.status!=='active'||(actorId!==personId&&actor.role!=='admin'))throw new TRPCError({code:'FORBIDDEN'});
    const [person]=actorId===personId?[actor]:await tx.select().from(users).where(eq(users.id,personId)).for('update');
    if(!person)throw new TRPCError({code:'NOT_FOUND'});
    if(actorId===personId){
      const {verifyPassword}=await import('./auth');
      if(!password||!await verifyPassword(password,person.passwordHash))throw new TRPCError({code:'FORBIDDEN',message:'Mot de passe incorrect.'});
    }
    const [existing]=await tx.select().from(accountClosures).where(eq(accountClosures.personId,personId));
    if(existing)return {closed:true,retainedCredentials:existing.retainedCredentials};
    if(person.role==='admin'&&person.status==='active'){
      const admins=await tx.select({id:users.id}).from(users).where(and(eq(users.role,'admin'),eq(users.status,'active')));
      if(admins.length<=1)throw new TRPCError({code:'PRECONDITION_FAILED',message:'Le dernier administrateur actif ne peut pas fermer son compte.'});
    }
    const proofs=await tx.select().from(credentials).where(eq(credentials.personId,personId)).for('update');
    // Keep proof ownership and original company links; do not transfer private records.
    for(const proof of proofs)if(proof.state!=='FROZEN')await tx.update(credentials).set({state:'FROZEN',frozenSnapshot:proof.frozenSnapshot??{label:proof.label,trainingId:proof.trainingId,certificateId:proof.certificateId,part66Coverage:proof.part66Coverage,obtainedAt:proof.obtainedAt,expiresAt:proof.expiresAt,closedAt:new Date().toISOString()}}).where(eq(credentials.id,proof.id));
    await tx.insert(accountClosures).values({personId,actorId,retainedCredentials:proofs.length});
    await tx.update(users).set({name:'Compte fermé',firstName:null,lastName:null,bio:null,email:null,passwordHash:null,status:'suspended',
      passportShared:false,resetToken:null,resetTokenExpiresAt:null,twoFactorEnabled:false,twoFactorCode:null,twoFactorExpiresAt:null,
      licenseNumber:null,licenseCategories:null,typeRatings:null,jobTitle:null,marketingOptIn:false,companyId:null,
    }).where(eq(users.id,personId));
    await tx.update(affiliations).set({status:'INACTIVE',endedAt:new Date()}).where(and(eq(affiliations.personId,personId),eq(affiliations.status,'ACTIVE')));
    await tx.update(employees).set({userId:null}).where(eq(employees.userId,personId));
    return {closed:true,retainedCredentials:proofs.length};
  });
}

// ─── Course templates + content lifecycle / versioning (V2.6) ────────────────
export async function getCourseTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(courseTemplates).orderBy(courseTemplates.code);
}

// Instantiate a draft course (training + modules + Part-66 objectives) from a template.
const templateStructure = z.object({ modules: z.array(z.object({
  title: z.string().trim().min(1).max(255), content: z.string().max(200000).optional(),
  objectives: z.array(z.object({ code: z.string().max(32).optional(), title: z.string().trim().min(1).max(255), knowledgeLevel: z.enum(["1", "2", "3"]).optional() }).strict()).max(100).optional(),
}).strict()).min(1).max(100) }).strict();
export async function createCourseFromTemplate(templateId: number, ownerUserId?: number, ownerOrgId?: number | null) {
  const db = await getDb();
  if (!db || !ownerUserId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Auteur et base de données requis." });
  return db.transaction(async tx => {
    const [actor] = await tx.select().from(users).where(eq(users.id, ownerUserId)).for("share");
    if (actor?.status !== "active") throw new TRPCError({ code: "FORBIDDEN" });
    if (ownerOrgId != null) {
      const [company] = await tx.select().from(companies).where(eq(companies.id, ownerOrgId)).for("share");
      const [manager] = await tx.select().from(affiliations).where(and(eq(affiliations.personId, ownerUserId), eq(affiliations.orgId, ownerOrgId), eq(affiliations.role, "MANAGER"), eq(affiliations.status, "ACTIVE"))).for("share");
      if (company?.status !== "ACTIVE" || (actor.role !== "admin" && !manager)) throw new TRPCError({ code: "FORBIDDEN" });
    } else if (actor.role !== "admin" && actor.role !== "instructor") throw new TRPCError({ code: "FORBIDDEN" });
    const [tpl] = await tx.select().from(courseTemplates).where(eq(courseTemplates.id, templateId)).for("share");
    if (!tpl) throw new TRPCError({ code: "NOT_FOUND", message: "Modèle introuvable." });
    const domain = z.enum(["b1", "b2", "b1b2", "part66", "general", "management"]).safeParse(tpl.domain ?? "general");
    if (!domain.success || !tpl.title.trim()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Titre ou domaine du modèle invalide." });
    const structure = templateStructure.safeParse(tpl.structure);
    if (!structure.success) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Structure du modèle invalide. Corrigez ses chapitres et objectifs." });
    // Global text templates cannot authorize reuse of another course's private files.
    if (/\/storage\/(?:courses|course-media)\//.test(JSON.stringify(tpl))) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ce modèle référence des médias privés. Importez des supports autorisés dans la nouvelle formation." });
    const base = tpl.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "formation";
    const [created] = await tx.insert(trainings).values({
      ownerUserId, ownerOrgId, title: tpl.title, slug: `${base}-${randomUUID()}`, description: tpl.description ?? null, language: tpl.language ?? "fr",
      domain: domain.data, type: "elearning", isPublished: false, reviewStatus: "draft", version: 1, passingScore: 75, maxAttempts: 3,
    }).returning({ id: trainings.id });
    for (let index = 0; index < structure.data.modules.length; index++) {
      const module = structure.data.modules[index];
      const [chapter] = await tx.insert(trainingModules).values({ trainingId: created.id, title: module.title, content: module.content ?? null, sortOrder: index + 1 }).returning({ id: trainingModules.id });
      if (module.objectives?.length) await tx.insert(learningObjectives).values(module.objectives.map((objective, i) => ({ trainingId: created.id, moduleId: chapter.id, code: objective.code ?? null, title: objective.title, knowledgeLevel: objective.knowledgeLevel ?? "1", sortOrder: i + 1 })));
    }
    await tx.insert(courseTemplateUses).values({ trainingId: created.id, templateId: tpl.id, createdBy: ownerUserId, snapshot: tpl });
    await tx.insert(contentRevisions).values({ trainingId: created.id, version: 1, status: "draft", changelog: `Créé depuis le modèle ${tpl.code ?? tpl.title}`, byUserId: ownerUserId });
    return { trainingId: created.id };
  });
}

export async function setReviewStatus(trainingId: number, status: string, byUserId?: number, changelog?: string) {
  const db = await getDb();
  if (!db) return;
  const t = (await db.select().from(trainings).where(eq(trainings.id, trainingId)).limit(1))[0];
  const newVersion = status === "approved" ? (t?.version ?? 1) + 1 : (t?.version ?? 1);
  await db.update(trainings).set({ reviewStatus: status, version: newVersion }).where(eq(trainings.id, trainingId));
  await db.insert(contentRevisions).values({ trainingId, version: newVersion, status, changelog: changelog ?? null, byUserId: byUserId ?? null });
  return { success: true };
}

export async function getContentRevisions(trainingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contentRevisions).where(eq(contentRevisions.trainingId, trainingId)).orderBy(desc(contentRevisions.at));
}

export async function getRegulatoryChanges() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(regulatoryChanges).orderBy(desc(regulatoryChanges.createdAt));
}

// Record a regulatory change and flag matching published trainings as "needs_review".
export async function createRegulatoryChange(data: { reference: string; summary?: string; effectiveAt?: Date | null; domain?: string }) {
  const db = await getDb();
  if (!db) return { flagged: 0 };
  await db.insert(regulatoryChanges).values({ reference: data.reference, summary: data.summary ?? null, effectiveAt: data.effectiveAt ?? null });
  const all = await db.select().from(trainings).where(and(eq(trainings.isPublished, true), isNull(trainings.ownerOrgId), isNull(trainings.archivedAt)));
  const affected = data.domain ? all.filter((t) => t.domain === data.domain) : all;
  for (const t of affected) {
    await db.update(trainings).set({ reviewStatus: "needs_review" }).where(eq(trainings.id, t.id));
    await db.insert(contentRevisions).values({ trainingId: t.id, version: t.version ?? 1, status: "needs_review", changelog: `Évolution réglementaire : ${data.reference}` });
  }
  return { flagged: affected.length };
}

// ─── User Profile Update ──────────────────────────────────────────────────────
export async function updateUserProfile(userId: number, data: {
  name?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  licenseNumber?: string;
  licenseCategories?: string;
  typeRatings?: string;
  jobTitle?: string;
  preferredLanguage?: string;
  timezone?: string;
  marketingOptIn?: boolean;
}) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.bio !== undefined) updateData.bio = data.bio;
  // Keep the display name in sync when first/last name are provided.
  if ((data.firstName !== undefined || data.lastName !== undefined) && data.name === undefined) {
    const current = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    const fn = data.firstName ?? current?.firstName ?? "";
    const ln = data.lastName ?? current?.lastName ?? "";
    const full = `${fn} ${ln}`.trim();
    if (full) updateData.name = full;
  }
  if (data.licenseNumber !== undefined) updateData.licenseNumber = data.licenseNumber;
  if (data.licenseCategories !== undefined) updateData.licenseCategories = data.licenseCategories;
  if (data.typeRatings !== undefined) updateData.typeRatings = data.typeRatings;
  if (data.jobTitle !== undefined) updateData.jobTitle = data.jobTitle;
  if (data.preferredLanguage !== undefined) updateData.preferredLanguage = data.preferredLanguage;
  if (data.timezone !== undefined) updateData.timezone = data.timezone;
  if (data.marketingOptIn !== undefined) updateData.marketingOptIn = data.marketingOptIn;
  if (Object.keys(updateData).length > 0) {
    await db.update(users).set(updateData as any).where(eq(users.id, userId));
  }
  const updated = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return updated[0];
}

// RGPD consents — marketing opt-in + explicit data-processing consent (timestamped).
export async function setUserConsents(userId: number, data: { marketingOptIn?: boolean; dataProcessingConsent?: boolean }) {
  const db = await getDb();
  if (!db) return null;
  const patch: Record<string, unknown> = { consentUpdatedAt: new Date() };
  if (typeof data.marketingOptIn === "boolean") patch.marketingOptIn = data.marketingOptIn;
  if (typeof data.dataProcessingConsent === "boolean") patch.dataProcessingConsentAt = data.dataProcessingConsent ? new Date() : null;
  await db.update(users).set(patch).where(eq(users.id, userId));
  return (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0] ?? null;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0] ?? null;
}

// ─── Import CSV Employees ─────────────────────────────────────────────────────
export async function importEmployeesCSV(userId: number, csvData: string, companyId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  let rows: ReturnType<typeof parseEmployeeCsv>;
  try { rows = parseEmployeeCsv(csvData); }
  catch (error) { return { imported: 0, errors: [error instanceof Error ? error.message : "Fichier CSV invalide."] }; }
  return db.transaction(async tx => {
    // Pin the authorized destination and keep its access conditions stable until commit.
    const [company] = await tx.select().from(companies).where(eq(companies.id, companyId)).for("share");
    const [actor] = await tx.select().from(users).where(eq(users.id, userId)).for("share");
    if (company?.status !== "ACTIVE" || actor?.status !== "active") throw new TRPCError({ code: "FORBIDDEN" });
    if (actor.companyId !== companyId) throw new TRPCError({ code: "CONFLICT", message: "La compagnie sélectionnée a changé. Actualisez avant de reprendre l’import." });
    if (actor.role !== "admin") {
      const [manager] = await tx.select().from(affiliations).where(and(eq(affiliations.personId, actor.id), eq(affiliations.orgId, companyId), eq(affiliations.role, "MANAGER"), eq(affiliations.status, "ACTIVE"))).for("share");
      if (!manager) throw new TRPCError({ code: "FORBIDDEN" });
    }
    let imported = 0;
    const errors: string[] = [];
    for (const row of rows) {
      if (!row.data) { errors.push(row.error!); continue; }
      try {
        // A savepoint isolates a failed row without aborting all subsequent rows.
        await tx.transaction(async rowTx => {
          await rowTx.insert(employees).values({ companyId, ...row.data! });
        });
        imported++;
      } catch {
        errors.push(`Ligne ${row.line} : erreur d’insertion.`);
      }
    }
    return { imported, errors };
  });
}

// ─── Admin User Detail ────────────────────────────────────────────────────────
export async function getAdminUserDetail(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRows[0]) return null;
  const { passwordHash: _ph, resetToken: _rt, resetTokenExpiresAt: _rte, twoFactorCode: _2fc, twoFactorExpiresAt: _2fe, ...user } = userRows[0];
  const userOrders = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  const userEnrollments = await db.select().from(enrollments).where(eq(enrollments.userId, userId)).orderBy(desc(enrollments.createdAt));
  const userCerts = await db.select().from(certificates).where(eq(certificates.userId, userId)).orderBy(desc(certificates.issuedAt));
  return { user, orders: userOrders, enrollments: userEnrollments, certificates: userCerts };
}

// ─── Admin: Modules CRUD ──────────────────────────────────────────────────────
export async function adminCreateModule(data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(trainingModules).values(data as any);
  return { success: true };
}

export async function adminUpdateModule(id: number, data: Record<string, unknown>, expectedRevision?: number) {
  if ("archivedAt" in data) throw new TRPCError({ code: "BAD_REQUEST", message: "Utilisez l’action d’archivage dédiée." });
  const db = await getDb();
  if (!db) return;
  return db.transaction(async tx=>{
    const [current]=await tx.select().from(trainingModules).where(eq(trainingModules.id,id)).for('update');
    if(!current)throw new TRPCError({code:'NOT_FOUND'});
    if(current.archivedAt || (expectedRevision!==undefined && current.revision!==expectedRevision))throw new TRPCError({code:'CONFLICT',message:'Ce contenu a été modifié ou archivé depuis son ouverture. Votre brouillon n’a pas été enregistré.'});
    await tx.update(trainingModules).set(data as any).where(eq(trainingModules.id,id));
    return {success:true};
  });
}

export async function reorderModules(orderedIds:number[],expectedRevisions:number[]) {
  if(!orderedIds.length || new Set(orderedIds).size!==orderedIds.length || expectedRevisions.length!==orderedIds.length)throw new TRPCError({code:'BAD_REQUEST'});
  const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  return db.transaction(async tx=>{
    const [first]=await tx.select({trainingId:trainingModules.trainingId}).from(trainingModules).where(eq(trainingModules.id,orderedIds[0]));
    if(!first)throw new TRPCError({code:'NOT_FOUND'});
    const rows=await tx.select().from(trainingModules).where(and(eq(trainingModules.trainingId,first.trainingId),isNull(trainingModules.archivedAt))).orderBy(trainingModules.id).for('update');
    const byId=new Map(rows.map(row=>[row.id,row]));
    if(rows.length!==orderedIds.length || orderedIds.some((id,index)=>!byId.has(id)||byId.get(id)!.revision!==expectedRevisions[index]))throw new TRPCError({code:'CONFLICT',message:'Les chapitres ont changé depuis leur chargement. Actualisez la liste avant de réessayer.'});
    for(let i=0;i<orderedIds.length;i++)if(byId.get(orderedIds[i])!.sortOrder!==i+1)await tx.update(trainingModules).set({sortOrder:i+1}).where(eq(trainingModules.id,orderedIds[i]));
    return {success:true};
  });
}

export async function adminDeleteModule(id: number, actorId?: number) {
  return archiveContent("module", id, actorId);
}

// ─── Learning Objectives (Part-66 sub-modules) ───────────────────────────────
export async function getObjectives(trainingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(learningObjectives).where(and(eq(learningObjectives.trainingId, trainingId), isNull(learningObjectives.archivedAt))).orderBy(learningObjectives.sortOrder);
}

export async function adminCreateObjective(data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(learningObjectives).values(data as any);
  return { success: true };
}

export async function adminUpdateObjective(id: number, data: Record<string, unknown>, expectedRevision?: number) {
  if ("archivedAt" in data) throw new TRPCError({ code: "BAD_REQUEST", message: "Utilisez l’action d’archivage dédiée." });
  const db = await getDb();
  if (!db) throw new TRPCError({code: 'INTERNAL_SERVER_ERROR'});
  return db.transaction(async tx => {
    const [current] = await tx.select().from(learningObjectives).where(eq(learningObjectives.id, id)).for('update');
    if (!current) throw new TRPCError({code: 'NOT_FOUND'});
    if (current.archivedAt || (expectedRevision !== undefined && current.revision !== expectedRevision)) throw new TRPCError({code: 'CONFLICT', message: 'Cet objectif a été modifié ou archivé depuis son ouverture. Votre brouillon n’a pas été enregistré.'});
    await tx.update(learningObjectives).set(data as any).where(eq(learningObjectives.id, id));
    return {success: true};
  });
}

export async function adminDeleteObjective(id: number, actorId?: number) {
  return archiveContent("objective", id, actorId);
}

export async function reorderObjectives(orderedIds: number[], expectedSortOrders?: (number | null)[]) {
  if (!orderedIds.length || new Set(orderedIds).size !== orderedIds.length || orderedIds.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new TRPCError({code: 'BAD_REQUEST'});
  if (expectedSortOrders && (expectedSortOrders.length !== orderedIds.length || expectedSortOrders.some(value => value !== null && !Number.isSafeInteger(value)))) throw new TRPCError({code: 'BAD_REQUEST'});
  const db = await getDb();
  if (!db) throw new TRPCError({code: 'INTERNAL_SERVER_ERROR'});
  return db.transaction(async tx => {
    const [first] = await tx.select({trainingId: learningObjectives.trainingId}).from(learningObjectives).where(eq(learningObjectives.id, orderedIds[0]));
    if (!first) throw new TRPCError({code: 'CONFLICT'});
    const rows = await tx.select().from(learningObjectives).where(expectedSortOrders
      ? and(eq(learningObjectives.trainingId, first.trainingId), isNull(learningObjectives.archivedAt))
      : inArray(learningObjectives.id, orderedIds)).orderBy(learningObjectives.id).for('update');
    if (rows.length !== orderedIds.length || rows.some(row => row.archivedAt) || new Set(rows.map(row => row.trainingId)).size !== 1) throw new TRPCError({code: 'CONFLICT', message: 'Les objectifs ont changé ou appartiennent à des formations différentes.'});
    const byId = new Map(rows.map(row => [row.id, row]));
    if (expectedSortOrders && orderedIds.some((id, index) => !byId.has(id) || byId.get(id)!.sortOrder !== expectedSortOrders[index])) throw new TRPCError({code: 'CONFLICT', message: 'L’ordre des objectifs a changé. Actualisez la liste avant de réessayer.'});
    for (let i = 0; i < orderedIds.length; i++) {
      if (byId.get(orderedIds[i])!.sortOrder !== i) await tx.update(learningObjectives).set({sortOrder: i}).where(eq(learningObjectives.id, orderedIds[i]));
    }
    return {success: true};
  });
}

// Derived objective-level completion for one enrollment (no extra writes needed):
// an objective is complete when every module attached to it is completed AND
// every attached question has recorded correct feedback in the retained passing
// attempt (or latest attempt when none passed). Legacy answers are never regraded.
export async function getObjectiveCompletion(enrollmentId: number) {
  const db = await getDb();
  if (!db) return [];
  const enr = (await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).limit(1))[0];
  if (!enr) return [];
  const curriculum = await readCurriculum(enr.trainingVersionId);
  const objectives = curriculum?.objectives ?? await db.select().from(learningObjectives)
    .where(and(eq(learningObjectives.trainingId, enr.trainingId), isNull(learningObjectives.archivedAt))).orderBy(learningObjectives.sortOrder);
  if (objectives.length === 0) return [];
  const mods = curriculum?.modules ?? await db.select().from(trainingModules).where(and(eq(trainingModules.trainingId, enr.trainingId), isNull(trainingModules.archivedAt)));
  const completedModuleIds = new Set(
    (await db.select().from(moduleProgress)
      .where(and(eq(moduleProgress.enrollmentId, enrollmentId), eq(moduleProgress.isCompleted, true)))).map((m) => m.moduleId),
  );
  const qs = curriculum?.questions ?? await db.select().from(quizQuestions).where(and(eq(quizQuestions.trainingId, enr.trainingId), isNull(quizQuestions.archivedAt)));
  const attempts = await db.select().from(quizAttempts).where(eq(quizAttempts.enrollmentId, enrollmentId)).orderBy(desc(quizAttempts.startedAt));
  return objectives.map((o) => {
    const objModules = mods.filter((m) => m.objectiveId === o.id);
    const objQuestions = qs.filter((q) => q.objectiveId === o.id);
    const modulesDone = objModules.every((m) => completedModuleIds.has(m.id));
    let unavailableQuestionCount = 0;
    const questionResults = objQuestions.map(q => {
      const scoped = attempts.filter(a => a.moduleId === q.moduleId);
      const attempt = scoped.find(a => a.isPassed) ?? scoped[0];
      if (!attempt) return false;
      const recorded = attempt.feedback?.find(item => item.questionId === q.id);
      if (!recorded) { unavailableQuestionCount++; return false; }
      return recorded.isCorrect;
    });
    const questionsDone = questionResults.every(Boolean);
    const hasContent = objModules.length > 0 || objQuestions.length > 0;
    return { ...o, unavailableQuestionCount, isCompleted: hasContent && modulesDone && questionsDone, moduleCount: objModules.length, questionCount: objQuestions.length };
  });
}

// ─── Admin: Quiz Questions CRUD ───────────────────────────────────────────────
export async function adminCreateQuestion(data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(quizQuestions).values(data as any);
  return { success: true };
}

export async function adminUpdateQuestion(id: number, data: Record<string, unknown>, expectedRevision?: number) {
  if ("archivedAt" in data) throw new TRPCError({ code: "BAD_REQUEST", message: "Utilisez l’action d’archivage dédiée." });
  const db = await getDb();
  if (!db) return;
  return db.transaction(async tx=>{
    const [current]=await tx.select().from(quizQuestions).where(eq(quizQuestions.id,id)).for('update');
    if(!current)throw new TRPCError({code:'NOT_FOUND'});
    if(current.archivedAt || (expectedRevision!==undefined && current.revision!==expectedRevision))throw new TRPCError({code:'CONFLICT',message:'Ce contenu a été modifié ou archivé depuis son ouverture. Votre brouillon n’a pas été enregistré.'});
    await tx.update(quizQuestions).set(data as any).where(eq(quizQuestions.id,id));
    return {success:true};
  });
}

export async function adminDeleteQuestion(id: number, actorId?: number) {
  return archiveContent("question", id, actorId);
}

// ─── Admin: User status / role ────────────────────────────────────────────────
export async function adminSetUserStatus(id: number, status: "active" | "suspended") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ status }).where(eq(users.id, id));
  return { success: true };
}

export async function adminSetUserRole(id: number, role: "user" | "admin" | "instructor" | "company_manager") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, id));
  return { success: true };
}

export async function countActiveAdmins(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  return (await db.select().from(users).where(and(eq(users.role, "admin"), eq(users.status, "active")))).length;
}

export async function adminUpdateUser(id: number, data: { name?: string; role?: string; jobTitle?: string; licenseNumber?: string; licenseCategories?: string }) {
  const db = await getDb();
  if (!db) return null;
  const patch: Record<string, unknown> = {};
  for (const k of ["name", "role", "jobTitle", "licenseNumber", "licenseCategories"] as const) {
    if (data[k] !== undefined) patch[k] = data[k];
  }
  if (Object.keys(patch).length) await db.update(users).set(patch).where(eq(users.id, id));
  return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0] ?? null;
}

// ─── Admin: organizations (companies) + their managers (MANAGER affiliations) ──
export async function getAdminOrganizations() {
  const db = await getDb();
  if (!db) return [];
  const orgs = await db.select().from(companies).orderBy(desc(companies.createdAt));
  const out = [];
  for (const o of orgs) {
    const emps = await db.select().from(employees).where(eq(employees.companyId, o.id));
    const affs = await db.select().from(affiliations).where(and(eq(affiliations.orgId, o.id), eq(affiliations.status, "ACTIVE")));
    out.push({ ...o, employeeCount: emps.length, managerCount: affs.filter((a) => a.role === "MANAGER").length, memberCount: affs.filter((a) => a.role === "MEMBER").length });
  }
  return out;
}

export async function adminCreateOrganization(data: { name: string; type?: string | null; agreementNumber?: string | null; country?: string; siret?: string; contactEmail?: string }) {
  const db = await getDb();
  if (!db) return null;
  const inserted = await db.insert(companies).values({
    name: data.name, type: data.type ?? null, agreementNumber: data.agreementNumber ?? null, country: data.country ?? "FR",
    siret: data.siret, contactEmail: data.contactEmail, status: "ACTIVE",
  }).returning();
  return inserted[0];
}

export async function adminUpdateOrganization(id: number, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return null;
  const patch: Record<string, unknown> = {};
  for (const k of ["name", "type", "agreementNumber", "country", "siret", "vatNumber", "address", "contactName", "contactEmail", "contactPhone"]) {
    if (data[k] !== undefined) patch[k] = data[k];
  }
  if (Object.keys(patch).length) await db.update(companies).set(patch).where(eq(companies.id, id));
  return (await db.select().from(companies).where(eq(companies.id, id)).limit(1))[0] ?? null;
}

// Organization suspension is independent of each person's membership decision.
export async function adminSetOrganizationStatus(id: number, status: "ACTIVE" | "SUSPENDED", actorId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({code:"INTERNAL_SERVER_ERROR"});
  return db.transaction(async tx => {
    const [actor] = await tx.select().from(users).where(eq(users.id,actorId)).for("share");
    if (!actor || actor.role !== "admin" || actor.status !== "active") throw new TRPCError({code:"FORBIDDEN"});
    const [company] = await tx.select().from(companies).where(eq(companies.id,id)).for("update");
    if (!company) throw new TRPCError({code:"NOT_FOUND"});
    if (company.status === status) return {ok:true};
    await tx.update(companies).set({status}).where(eq(companies.id,id));
    await tx.execute(sql`insert into organization_status_events ("companyId","actorId","previousStatus","status") values (${id},${actorId},${company.status},${status})`);
    return {ok:true};
  });
}

export async function getOrganizationManagers(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  const affs = await db.select().from(affiliations).where(and(eq(affiliations.orgId, orgId), eq(affiliations.role, "MANAGER")));
  const out = [];
  for (const a of affs) {
    const u = (await db.select().from(users).where(eq(users.id, a.personId)).limit(1))[0];
    out.push({ affiliationId: a.id, status: a.status, personId: a.personId, name: u?.name ?? null, email: u?.email ?? null });
  }
  return out;
}

// Add a manager by email. The person must already have an account (create it first via
// the Users module). Reactivates/promotes an existing affiliation, else creates one.
export async function addOrganizationManager(orgId: number, email: string): Promise<{ ok: boolean; reason?: string }> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "db" };
  const u = (await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1))[0];
  if (!u) return { ok: false, reason: "no_user" };
  const existing = (await db.select().from(affiliations).where(and(eq(affiliations.personId, u.id), eq(affiliations.orgId, orgId))).limit(1))[0];
  if (existing) {
    await db.update(affiliations).set({ role: "MANAGER", status: "ACTIVE", endedAt: null }).where(eq(affiliations.id, existing.id));
  } else {
    await db.insert(affiliations).values({ personId: u.id, orgId, role: "MANAGER", status: "ACTIVE" });
  }
  return { ok: true };
}

export async function removeOrganizationManager(affiliationId: number) {
  const db = await getDb();
  if (!db) return { ok: false };
  await db.update(affiliations).set({ status: "INACTIVE", endedAt: new Date() }).where(eq(affiliations.id, affiliationId));
  return { ok: true };
}

// Manager-scoped view of every affiliation of an org (managers AND members), with
// the linked Person's name/email. Used by the company dashboard "Membres" module.
export async function getOrganizationAffiliates(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  const affs = await db.select().from(affiliations).where(eq(affiliations.orgId, orgId));
  const out = [];
  for (const a of affs) {
    const u = (await db.select().from(users).where(eq(users.id, a.personId)).limit(1))[0];
    out.push({
      affiliationId: a.id, role: a.role, status: a.status, personId: a.personId,
      name: u?.name ?? null, email: u?.email ?? null, proEmail: a.proEmail ?? null, startedAt: a.startedAt,
    });
  }
  return out;
}

// Affiliate an existing Person (looked up by login email) to an org with a given role.
// Reactivates/upgrades an existing edge instead of duplicating (one edge per person↔org).
export async function addOrganizationAffiliate(orgId: number, email: string, role: "MANAGER" | "MEMBER"): Promise<{ ok: boolean; reason?: string }> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "db" };
  const u = (await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1))[0];
  if (!u) return { ok: false, reason: "no_user" };
  const existing = (await db.select().from(affiliations).where(and(eq(affiliations.personId, u.id), eq(affiliations.orgId, orgId))).limit(1))[0];
  if (existing) {
    await db.update(affiliations).set({ role, status: "ACTIVE", endedAt: null }).where(eq(affiliations.id, existing.id));
  } else {
    await db.insert(affiliations).values({ personId: u.id, orgId, role, status: "ACTIVE" });
  }
  return { ok: true };
}

// Single affiliation row (for per-org authorisation checks).
export async function getAffiliationById(affiliationId: number) {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(affiliations).where(eq(affiliations.id, affiliationId)).limit(1))[0] ?? null;
}

// ─── Passport documents (person-owned uploads) ────────────────────────────────
export { getPassportDocuments, createPassportDocument, deletePassportDocument, setPassportSharing } from "./passport";
export type { PassportKind } from "./passport";

// ─── Offers (landing-page pricing, admin-editable) ───────────────────────────
export async function getActiveOffers(language: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(offers).where(and(eq(offers.language, language), eq(offers.isActive, true))).orderBy(offers.sortOrder, offers.id);
}
export async function getAllOffers(language?: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = language
    ? await db.select().from(offers).where(eq(offers.language, language)).orderBy(offers.sortOrder, offers.id)
    : await db.select().from(offers).orderBy(offers.sortOrder, offers.id);
  return rows;
}
export async function createOffer(data: Record<string, unknown>) {
  const db = await getDb(); if (!db) return null;
  return (await db.insert(offers).values(data as any).returning())[0];
}
export async function updateOffer(id: number, data: Record<string, unknown>) {
  const db = await getDb(); if (!db) return null;
  const patch: Record<string, unknown> = {};
  for (const k of ["language", "name", "price", "description", "features", "ctaLabel", "ctaHref", "highlight", "sortOrder", "isActive"]) if (data[k] !== undefined) patch[k] = data[k];
  if (Object.keys(patch).length) await db.update(offers).set(patch).where(eq(offers.id, id));
  return (await db.select().from(offers).where(eq(offers.id, id)).limit(1))[0];
}
export async function deleteOffer(id: number) {
  const db = await getDb(); if (!db) return { ok: false };
  await db.delete(offers).where(eq(offers.id, id));
  return { ok: true };
}

// ─── FAQ (landing-page, admin-editable) ───────────────────────────────────────
export async function getActiveFaq(language: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(faqItems).where(and(eq(faqItems.language, language), eq(faqItems.isActive, true))).orderBy(faqItems.sortOrder, faqItems.id);
}
export async function getAllFaq(language?: string) {
  const db = await getDb();
  if (!db) return [];
  return language
    ? db.select().from(faqItems).where(eq(faqItems.language, language)).orderBy(faqItems.sortOrder, faqItems.id)
    : db.select().from(faqItems).orderBy(faqItems.sortOrder, faqItems.id);
}
export async function createFaqItem(data: Record<string, unknown>) {
  const db = await getDb(); if (!db) return null;
  return (await db.insert(faqItems).values(data as any).returning())[0];
}
export async function updateFaqItem(id: number, data: Record<string, unknown>) {
  const db = await getDb(); if (!db) return null;
  const patch: Record<string, unknown> = {};
  for (const k of ["language", "question", "answer", "sortOrder", "isActive"]) if (data[k] !== undefined) patch[k] = data[k];
  if (Object.keys(patch).length) await db.update(faqItems).set(patch).where(eq(faqItems.id, id));
  return (await db.select().from(faqItems).where(eq(faqItems.id, id)).limit(1))[0];
}
export async function deleteFaqItem(id: number) {
  const db = await getDb(); if (!db) return { ok: false };
  await db.delete(faqItems).where(eq(faqItems.id, id));
  return { ok: true };
}

// ─── Slides (AI-authored courses) ─────────────────────────────────────────────
export async function getSlides(trainingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(slides).where(and(eq(slides.trainingId, trainingId), isNull(slides.archivedAt))).orderBy(slides.sortOrder);
}

export function checkedSlideActivities(data: Record<string, unknown>): Record<string, unknown> {
  const quiz=embeddedQuizSchema.safeParse(data);
  if(!quiz.success)throw new TRPCError({code:"BAD_REQUEST",message:"QCM incomplet ou réponses invalides."});
  if(data.videoCues!=null){const cues=videoCuesSchema.safeParse(data.videoCues);if(!cues.success)throw new TRPCError({code:"BAD_REQUEST",message:"Interactions vidéo invalides."});data={...data,videoCues:cues.data};}
  return {...data,...quiz.data};
}

export async function createSlide(data: Record<string, unknown>) {
  data=checkedSlideActivities(data);
  const db = await getDb();
  if (!db) return null;
  const inserted = await db.insert(slides).values(data as any).returning({ id: slides.id });
  return { id: inserted[0].id };
}

export async function updateSlide(id: number, data: Record<string, unknown>, expectedRevision?: number) {
  if ("archivedAt" in data) throw new TRPCError({ code: "BAD_REQUEST", message: "Utilisez l’action d’archivage dédiée." });
  const db = await getDb();
  if (!db) return;
  return db.transaction(async tx=>{
    const [current]=await tx.select().from(slides).where(eq(slides.id,id)).for("update");
    if(!current)throw new TRPCError({code:"NOT_FOUND"});
    if(current.archivedAt || (expectedRevision !== undefined && current.revision !== expectedRevision)) throw new TRPCError({code:'CONFLICT',message:'Cette diapositive a été modifiée ou archivée depuis son ouverture. Vos changements ne sont pas enregistrés ; consultez la version actuelle avant de les reprendre.'});
    if(embeddedQuizFields.some(key=>key in data)||"videoCues" in data){
      const merged=checkedSlideActivities({...current,...data});
      // Only rewrite activity fields submitted by this patch, plus the coherent quiz group.
      if(embeddedQuizFields.some(key=>key in data))for(const key of embeddedQuizFields)data[key]=merged[key];
      if("videoCues" in data)data.videoCues=merged.videoCues;
    }
    await tx.update(slides).set(data as any).where(eq(slides.id,id));
    return {success:true};
  });
}

export async function deleteSlide(id: number, actorId?: number) {
  return archiveContent("slide", id, actorId);
}

export async function reorderSlides(orderedIds: number[], expectedRevisions?: number[]) {
  if(!orderedIds.length || new Set(orderedIds).size!==orderedIds.length || (expectedRevisions && expectedRevisions.length!==orderedIds.length)) throw new TRPCError({code:'BAD_REQUEST',message:'Liste de diapositives invalide.'});
  const db = await getDb();
  if (!db) return;
  return db.transaction(async tx=>{
    // Lock in one consistent order even when two users request opposite moves.
    const rows=await tx.select().from(slides).where(inArray(slides.id,orderedIds)).orderBy(slides.id).for('update');
    if(rows.length!==orderedIds.length || rows.some(row=>row.archivedAt) || new Set(rows.map(row=>row.trainingId)).size!==1)throw new TRPCError({code:'CONFLICT',message:'La liste de diapositives a changé. Actualisez-la avant de déplacer une diapositive.'});
    const byId=new Map(rows.map(row=>[row.id,row]));
    if(expectedRevisions && orderedIds.some((id,index)=>byId.get(id)!.revision!==expectedRevisions[index]))throw new TRPCError({code:'CONFLICT',message:'Les diapositives ont été modifiées depuis leur chargement. Actualisez la liste avant de réessayer.'});
    for(let i=0;i<orderedIds.length;i++)if(byId.get(orderedIds[i])!.sortOrder!==i+1)await tx.update(slides).set({sortOrder:i+1}).where(eq(slides.id,orderedIds[i]));
    return {success:true};
  });
}

export type DatabaseTransaction = Parameters<Parameters<NonNullable<Awaited<ReturnType<typeof getDb>>>["transaction"]>[0]>[0];

/** Create a training plus its slides from an AI-generated outline. */
export async function createCourseWithSlides(params: {
  ownerUserId?: number; ownerOrgId?: number | null;
  title: string;
  slug: string;
  description?: string;
  language?: string;
  categoryId?: number;
  durationHours?: string;
  slides: Array<{
    title?: string; body?: string; imageUrl?: string; imagePrompt?: string;
    videoUrl?: string; audioUrl?: string;
    quizQuestion?: string; quizOptions?: string[]; quizCorrect?: number[]; quizExplanation?: string;
  }>;
}, executor?: DatabaseTransaction) {
  const {ownerUserId,ownerOrgId,...raw}=params;
  const input=courseDraftInput.parse(raw);
  if(!ownerUserId)throw new TRPCError({code:"FORBIDDEN"});
  if(mediaUrls(input).length)throw new TRPCError({code:"PRECONDITION_FAILED",message:"Dupliquez la formation source pour réutiliser ses médias privés, ou importez vos supports après création du brouillon."});
  const db=(await getDb())!;
  const write=async (tx:DatabaseTransaction)=>{
    const [actor]=await tx.select().from(users).where(eq(users.id,ownerUserId)).for("share");
    if(actor?.status!=="active")throw new TRPCError({code:"FORBIDDEN"});
    if(ownerOrgId!=null){
      const [org]=await tx.select().from(companies).where(eq(companies.id,ownerOrgId)).for("share");
      const [manager]=await tx.select().from(affiliations).where(and(eq(affiliations.personId,ownerUserId),eq(affiliations.orgId,ownerOrgId),eq(affiliations.role,"MANAGER"),eq(affiliations.status,"ACTIVE"))).for("share");
      if(org?.status!=="ACTIVE"||(actor.role!=="admin"&&!manager))throw new TRPCError({code:"FORBIDDEN"});
    }else if(actor.role!=="admin"&&actor.role!=="instructor")throw new TRPCError({code:"FORBIDDEN"});
    const [created]=await tx.insert(trainings).values({ownerUserId,ownerOrgId,reviewStatus:"draft",title:input.title,slug:input.slug,description:input.description,language:input.language??"en",categoryId:input.categoryId,type:"elearning",durationHours:input.durationHours,isPublished:false,passingScore:75,maxAttempts:3}).returning({id:trainings.id});
    for(let i=0;i<input.slides.length;i++)await tx.insert(slides).values({...input.slides[i],trainingId:created.id,sortOrder:i+1});
    return {trainingId:created.id};
  };
  return executor ? write(executor) : db.transaction(write);
}

// ─── Sessions (scheduled inter-company / classroom / virtual) ─────────────────
export async function getUpcomingSessions() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const rows = await db.select().from(sessions).orderBy(sessions.startDate);
  const result = [];
  for (const s of rows) {
    if (s.status === "cancelled") continue;
    if (s.startDate < now && s.status !== "scheduled") continue;
    const training = s.trainingId ? (await db.select().from(trainings).where(eq(trainings.id, s.trainingId)).limit(1))[0] : null;
    if (training && (!training.isPublished || training.ownerOrgId != null)) continue;
    const { meetingUrl, liveRoom, replayUrl, ...publicRoom } = s;
    result.push({ ...publicRoom, hasReplay: !!replayUrl, training: training ?? null });
  }
  return result;
}

export async function getAllSessions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sessions).orderBy(desc(sessions.startDate));
}

export async function createSession(data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(sessions).values(data as any);
  return { success: true };
}

export async function deleteSession(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(sessions).set({ status: "cancelled" }).where(eq(sessions.id, id));
  return { success: true };
}

export async function getUserSessions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const regs = await db.select().from(sessionRegistrations).where(eq(sessionRegistrations.userId, userId));
  const result = [];
  for (const r of regs) {
    const s = (await db.select().from(sessions).where(eq(sessions.id, r.sessionId)).limit(1))[0];
    if (s) { const { meetingUrl, liveRoom, replayUrl, ...publicRoom } = s; result.push({ ...publicRoom, hasReplay: !!replayUrl, registrationId: r.id, registeredAt: r.createdAt, registrationStatus: r.status }); }
  }
  return result;
}

// ─── Articles (news / blog) ───────────────────────────────────────────────────
export async function getPublishedArticles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(articles).where(eq(articles.isPublished, true)).orderBy(desc(articles.publishedAt));
}

export async function getArticleBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(articles).where(eq(articles.slug, slug)).limit(1);
  return r[0] ?? null;
}

export async function getAllArticles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(articles).orderBy(desc(articles.createdAt));
}

export async function createArticle(data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(articles).values(data as any);
  return { success: true };
}

export async function updateArticle(id: number, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.update(articles).set(data as any).where(eq(articles.id, id));
  return { success: true };
}

export async function deleteArticle(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(articles).where(eq(articles.id, id));
  return { success: true };
}

// ─── Published trainings for catalogue PDF ────────────────────────────────────
export async function getAllPublishedTrainings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trainings).where(and(eq(trainings.isPublished, true), isNull(trainings.ownerOrgId), isNull(trainings.archivedAt))).orderBy(trainings.title);
}

// ─── Admin Compliance Report ──────────────────────────────────────────────────
export async function getAdminComplianceReport(actorId:number,cursor?:number,pageSize=50,ip?:string|null) {
  if(!z.number().int().positive().max(2147483647).safeParse(actorId).success)throw new TRPCError({code:'BAD_REQUEST'});
  if(!z.number().int().min(1).max(250).safeParse(pageSize).success || (cursor!==undefined&&!z.number().int().positive().max(2147483647).safeParse(cursor).success))throw new TRPCError({code:'BAD_REQUEST'});
  const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  return db.transaction(async tx=>{
  const [actor]=await tx.select({role:users.role,status:users.status}).from(users).where(eq(users.id,actorId)).for('share');
  if(actor?.role!=='admin'||actor.status!=='active')throw new TRPCError({code:'FORBIDDEN'});
  await tx.insert(accessLogs).values({actorId,actorRole:'admin',action:'READ_COMPLIANCE_REPORT',dataAccessed:{scope:'GOD',fields:['userName','userEmail','certificateNumber'],cursor:cursor??null,pageSize},ip:ip??null});
  const ids=await tx.select({id:enrollments.id}).from(enrollments).where(cursor==null?undefined:lt(enrollments.id,cursor)).orderBy(desc(enrollments.id)).limit(pageSize+1);
  const selected=ids.slice(0,pageSize).map(e=>e.id);
  if(!selected.length)return {entries:[],nextCursor:null};
  const rows=await tx.select({enrollment:enrollments,userName:users.name,userEmail:users.email,
    trainingTitle:trainings.title,trainingType:trainings.type,certificate:certificates,snapshot:certificateArchives.snapshot,
  }).from(enrollments).leftJoin(users,eq(users.id,enrollments.userId)).leftJoin(trainings,eq(trainings.id,enrollments.trainingId))
    .leftJoin(certificates,eq(certificates.enrollmentId,enrollments.id)).leftJoin(certificateArchives,eq(certificateArchives.certificateId,certificates.id))
    .where(inArray(enrollments.id,selected)).orderBy(desc(enrollments.id));
  const groups=new Map<number,typeof rows>();
  for(const row of rows){const group=groups.get(row.enrollment.id)??[];group.push(row);groups.set(row.enrollment.id,group);}
  const entries=Array.from(groups.values()).map(group=>{
    const row=group[0],e=row.enrollment,c=row.certificate;
    const consistent=group.length===1&&c!=null&&c.userId===e.userId&&c.trainingId===e.trainingId;
    const cert=consistent?c:null,snapshot=consistent?row.snapshot:null;
    return {enrollmentId:e.id,userName:row.userName??'—',userEmail:row.userEmail??'—',
      trainingTitle:snapshot?.training.title??row.trainingTitle??'—',trainingType:row.trainingType??'—',
      status:e.status,progressPercent:e.progressPercent??0,completedAt:e.completedAt,expiresAt:e.expiresAt,
      certificateNumber:cert?.certificateNumber??null,
      certificateStatus:cert?certificateStatus(cert):c?'review' as const:'missing' as const,
      certificateExpiresAt:cert?.expiresAt??null,certificateHolderName:cert?(snapshot?.learnerName??row.userName):null,
    };
  });
  return {entries,nextCursor:ids.length>pageSize?selected[pageSize-1]:null};
  });
}
