import { eq, and, desc, like, or, sql, gte, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  users, companies, employees, trainings, trainingCategories, trainingModules,
  quizQuestions, orders, orderItems, enrollments, moduleProgress, quizAttempts,
  certificates, recurrencies, quoteRequests, messages, supportTickets, webinars, webinarRegistrations, cartItems,
  slides, sessions, sessionRegistrations, articles,
  learningObjectives, objectiveProgress, certificateObjectives, notifications, processedWebhookEvents,
  examSessions, proctoringEvents, externalTrainings, roleRequirements,
  courseTemplates, contentRevisions, regulatoryChanges,
  affiliations, credentials, accessLogs, signoffs, appSettings, passportDocuments,
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
export async function getPublicTrainings(filters: {
  type?: string; domain?: string; language?: string; categoryId?: number; search?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(trainings).where(eq(trainings.isPublished, true));
  const result = await query.orderBy(desc(trainings.isFeatured), trainings.title);
  return result.filter((t) => {
    if (filters.type && t.type !== filters.type) return false;
    if (filters.domain && t.domain !== filters.domain) return false;
    if (filters.language && t.language !== filters.language) return false;
    if (filters.categoryId && t.categoryId !== filters.categoryId) return false;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      if (!t.title.toLowerCase().includes(s) && !(t.description ?? "").toLowerCase().includes(s)) return false;
    }
    return true;
  });
}

export async function getFeaturedTrainings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trainings)
    .where(and(eq(trainings.isPublished, true), eq(trainings.isFeatured, true)))
    .orderBy(trainings.title)
    .limit(6);
}

export async function getTrainingBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(trainings).where(eq(trainings.slug, slug)).limit(1);
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
    result.push({ ...item, training: training[0] ?? null });
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
  if (!db) return [];
  const enrs = await db.select().from(enrollments).where(eq(enrollments.userId, userId)).orderBy(desc(enrollments.createdAt));
  const result = [];
  for (const e of enrs) {
    const training = await db.select().from(trainings).where(eq(trainings.id, e.trainingId)).limit(1);
    result.push({ ...e, training: training[0] ?? null });
  }
  return result;
}

export async function getEnrollmentById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(enrollments).where(and(eq(enrollments.id, id), eq(enrollments.userId, userId))).limit(1);
  if (!result[0]) return null;
  const training = await db.select().from(trainings).where(eq(trainings.id, result[0].trainingId)).limit(1);
  const modules = await db.select().from(trainingModules).where(eq(trainingModules.trainingId, result[0].trainingId)).orderBy(trainingModules.sortOrder);
  const progress = await db.select().from(moduleProgress).where(eq(moduleProgress.enrollmentId, id));
  return { ...result[0], training: training[0] ?? null, modules, progress };
}

export async function updateEnrollmentProgress(enrollmentId: number, progressPercent: number, status?: string) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = { progressPercent };
  if (status) updateData.status = status;
  if (progressPercent >= 100) { updateData.status = "completed"; updateData.completedAt = new Date(); }
  await db.update(enrollments).set(updateData).where(eq(enrollments.id, enrollmentId));
}

// ─── Certificates ─────────────────────────────────────────────────────────────
export async function getUserCertificates(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const certs = await db.select().from(certificates).where(eq(certificates.userId, userId)).orderBy(desc(certificates.issuedAt));
  const result = [];
  for (const c of certs) {
    const training = await db.select().from(trainings).where(eq(trainings.id, c.trainingId)).limit(1);
    result.push({ ...c, training: training[0] ?? null });
  }
  return result;
}

export async function getCertificateByCode(code: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(certificates).where(eq(certificates.verificationCode, code)).limit(1);
  if (!result[0]) return null;
  const training = await db.select().from(trainings).where(eq(trainings.id, result[0].trainingId)).limit(1);
  const user = await db.select().from(users).where(eq(users.id, result[0].userId)).limit(1);
  return { ...result[0], training: training[0] ?? null, user: user[0] ?? null };
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

export async function updateEmployee(id: number, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.update(employees).set(data as any).where(eq(employees.id, id));
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
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(50);
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return rows.length;
}

export async function markNotificationRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  return { success: true };
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
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
  const all = await db.select().from(trainings).where(eq(trainings.isPublished, true));
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
export async function ensureEnrollmentForEmployee(userId: number, trainingId: number, recurrencyMonths?: number | null) {
  const db = await getDb();
  if (!db) return;
  let expiresAt: Date | undefined;
  if (recurrencyMonths) { expiresAt = new Date(); expiresAt.setMonth(expiresAt.getMonth() + recurrencyMonths); }
  const existing = await db.select().from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.trainingId, trainingId))).limit(1);
  if (existing[0]) {
    if (existing[0].expiresAt && new Date(existing[0].expiresAt).getTime() < Date.now()) {
      await db.update(enrollments).set({ status: "not_started", progressPercent: 0, completedAt: null, expiresAt: expiresAt ?? null })
        .where(eq(enrollments.id, existing[0].id));
    }
    return;
  }
  await db.insert(enrollments).values({ userId, trainingId, status: "not_started", progressPercent: 0, expiresAt });
}

export async function upsertRecurrency(params: { companyId: number; employeeId: number; trainingId: number; periodMonths: number }) {
  const db = await getDb();
  if (!db) return;
  const nextDueAt = new Date(); nextDueAt.setMonth(nextDueAt.getMonth() + params.periodMonths);
  const existing = await db.select().from(recurrencies)
    .where(and(eq(recurrencies.employeeId, params.employeeId), eq(recurrencies.trainingId, params.trainingId))).limit(1);
  if (existing[0]) {
    await db.update(recurrencies).set({ nextDueAt, status: "ok", periodMonths: params.periodMonths }).where(eq(recurrencies.id, existing[0].id));
  } else {
    await db.insert(recurrencies).values({
      companyId: params.companyId, employeeId: params.employeeId, trainingId: params.trainingId,
      periodMonths: params.periodMonths, nextDueAt, status: "ok",
    });
  }
}

export async function getCompanySubscriptionView(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user?.companyId) return null;
  const company = (await db.select().from(companies).where(eq(companies.id, user.companyId)).limit(1))[0];
  if (!company) return null;
  const emps = await db.select().from(employees).where(eq(employees.companyId, company.id));
  const regCount = (await getRegulatoryTrainings()).length;
  return {
    companyId: company.id,
    subscriptionType: company.subscriptionType ?? "none",
    subscriptionStatus: company.subscriptionStatus ?? null,
    subscriptionExpiresAt: company.subscriptionExpiresAt ?? null,
    employeeCount: emps.length,
    regulatoryTrainingCount: regCount,
    hasStripeCustomer: !!company.stripeCustomerId,
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
  const db = await getDb();
  if (!db) return null;
  await db.insert(quoteRequests).values(data as any);
  return { success: true };
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
export async function getMyQuotes(userId: number, email: string | null) {
  const db = await getDb();
  if (!db) return [];
  const all = await db.select().from(quoteRequests).orderBy(desc(quoteRequests.createdAt));
  const e = email?.toLowerCase() ?? null;
  return all.filter((q) => q.userId === userId || (e != null && q.contactEmail?.toLowerCase() === e));
}

export async function findUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1))[0] ?? null;
}

// ─── Quote messaging (admin ↔ client thread on a quote) ───────────────────────
export async function getQuoteMessages(quoteRequestId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(messages).where(eq(messages.quoteRequestId, quoteRequestId)).orderBy(messages.createdAt);
  const out = [];
  for (const m of rows) {
    const u = (await db.select().from(users).where(eq(users.id, m.fromUserId)).limit(1))[0];
    out.push({ ...m, fromName: u?.name ?? null, fromRole: u?.role ?? null });
  }
  return out;
}

export async function createQuoteMessage(data: { quoteRequestId: number; fromUserId: number; toUserId?: number | null; content: string; subject?: string | null }) {
  const db = await getDb();
  if (!db) return null;
  const inserted = await db.insert(messages).values({
    quoteRequestId: data.quoteRequestId, fromUserId: data.fromUserId, toUserId: data.toUserId ?? null,
    content: data.content, subject: data.subject ?? null,
  }).returning();
  return inserted[0];
}

// Mark every message in the thread NOT written by the reader as read.
export async function markQuoteMessagesRead(quoteRequestId: number, readerUserId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(messages).set({ isRead: true })
    .where(and(eq(messages.quoteRequestId, quoteRequestId), ne(messages.fromUserId, readerUserId)));
}

// ─── Support tickets + broadcast notifications ────────────────────────────────
export async function createSupportTicket(userId: number, data: { subject: string; message?: string; priority?: string }) {
  const db = await getDb();
  if (!db) return null;
  const t = (await db.insert(supportTickets).values({ userId, subject: data.subject, priority: data.priority ?? "normal", status: "OPEN" }).returning())[0];
  if (t && data.message) await db.insert(messages).values({ ticketId: t.id, fromUserId: userId, content: data.message });
  return t;
}

export async function getMyTickets(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(supportTickets).where(eq(supportTickets.userId, userId)).orderBy(desc(supportTickets.updatedAt));
}

export async function getAdminTickets() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(supportTickets).orderBy(desc(supportTickets.updatedAt));
  const out = [];
  for (const tkt of rows) {
    const u = (await db.select().from(users).where(eq(users.id, tkt.userId)).limit(1))[0];
    out.push({ ...tkt, userName: u?.name ?? null, userEmail: u?.email ?? null });
  }
  return out;
}

export async function getTicketById(id: number) {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1))[0] ?? null;
}

export async function getTicketThread(ticketId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(messages).where(eq(messages.ticketId, ticketId)).orderBy(messages.createdAt);
  const out = [];
  for (const m of rows) {
    const u = (await db.select().from(users).where(eq(users.id, m.fromUserId)).limit(1))[0];
    out.push({ ...m, fromName: u?.name ?? null, fromRole: u?.role ?? null });
  }
  return out;
}

export async function postTicketMessage(ticketId: number, fromUserId: number, content: string) {
  const db = await getDb();
  if (!db) return null;
  const m = (await db.insert(messages).values({ ticketId, fromUserId, content }).returning())[0];
  await db.update(supportTickets).set({ updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));
  return m;
}

export async function setTicketStatus(ticketId: number, status: string) {
  const db = await getDb();
  if (!db) return { ok: false };
  await db.update(supportTickets).set({ status }).where(eq(supportTickets.id, ticketId));
  return { ok: true };
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
  return db.select().from(webinars).orderBy(webinars.scheduledAt);
}

export async function registerForWebinar(userId: number, webinarId: number) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(webinarRegistrations).where(and(eq(webinarRegistrations.userId, userId), eq(webinarRegistrations.webinarId, webinarId))).limit(1);
  if (existing.length === 0) {
    await db.insert(webinarRegistrations).values({ userId, webinarId });
  }
  return { success: true };
}

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
  return rows.map(({ passwordHash, ...rest }) => {
    const a = affByPerson.get(rest.id);
    const orgId = a?.orgId ?? rest.companyId ?? null;
    return { ...rest, organizationName: orgId ? compName.get(orgId) ?? null : null, affiliationRole: a?.role ?? null };
  });
}

export async function getAdminTrainings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trainings).orderBy(desc(trainings.createdAt));
}

export async function createTraining(data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(trainings).values(data as any);
  return { success: true };
}

export async function updateTraining(id: number, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.update(trainings).set(data as any).where(eq(trainings.id, id));
  return { success: true };
}

// Delete a training. Refuses if it has learner/financial records (enrollments or
// order items) — those should be preserved; unpublish instead. Otherwise removes
// the training and its authoring content (modules, objectives, slides, questions…).
export async function deleteTraining(id: number) {
  const db = await getDb();
  if (!db) return { success: false as const, reason: "no_db" as const };
  const enr = await db.select().from(enrollments).where(eq(enrollments.trainingId, id)).limit(1);
  const oi = await db.select().from(orderItems).where(eq(orderItems.trainingId, id)).limit(1);
  if (enr[0] || oi[0]) return { success: false as const, reason: "in_use" as const };
  await db.delete(quizQuestions).where(eq(quizQuestions.trainingId, id));
  await db.delete(learningObjectives).where(eq(learningObjectives.trainingId, id));
  await db.delete(slides).where(eq(slides.trainingId, id));
  await db.delete(trainingModules).where(eq(trainingModules.trainingId, id));
  await db.delete(recurrencies).where(eq(recurrencies.trainingId, id));
  await db.delete(roleRequirements).where(eq(roleRequirements.trainingId, id));
  await db.delete(cartItems).where(eq(cartItems.trainingId, id));
  await db.delete(trainings).where(eq(trainings.id, id));
  return { success: true as const };
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

export async function updateQuoteRequestStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(quoteRequests).set({ status: status as any }).where(eq(quoteRequests.id, id));
  return { success: true };
}

// ─── Training Modules ─────────────────────────────────────────────────────────
export async function getTrainingModules(trainingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trainingModules).where(eq(trainingModules.trainingId, trainingId)).orderBy(trainingModules.sortOrder);
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
  const allModules = await db.select().from(trainingModules)
    .where(eq(trainingModules.trainingId,
      (await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).limit(1))[0]?.trainingId ?? 0
    ));
  const completedModules = await db.select().from(moduleProgress)
    .where(and(eq(moduleProgress.enrollmentId, enrollmentId), eq(moduleProgress.isCompleted, true)));
  const progress = allModules.length > 0 ? Math.round((completedModules.length / allModules.length) * 100) : 0;
  const status = progress >= 100 ? "completed" : "in_progress";
  await db.update(enrollments).set({
    progressPercent: progress,
    status: status as any,
    ...(status === "completed" ? { completedAt: new Date() } : {}),
    ...(status === "in_progress" ? { startedAt: new Date() } : {}),
    lastAccessedAt: new Date(),
  }).where(eq(enrollments.id, enrollmentId));
  return { progress, status };
}

// ─── Quiz Questions ───────────────────────────────────────────────────────────
export async function getQuizQuestions(trainingId: number, moduleId?: number) {
  const db = await getDb();
  if (!db) return [];
  const all = await db.select().from(quizQuestions).where(eq(quizQuestions.trainingId, trainingId)).orderBy(quizQuestions.sortOrder);
  if (moduleId !== undefined) return all.filter((q) => q.moduleId === moduleId || q.moduleId === null);
  return all;
}

// ─── Quiz Attempts ────────────────────────────────────────────────────────────
// Grade a single answer by question type. qcm/qcu/true_false: exact index-set match.
// free_text: keyword (accent/case-insensitive substring) or regex match. matching:
// the set of (left,right) pairs equals the answer key.
const _normText = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export function gradeQuizAnswer(q: any, ua: any): boolean {
  if (q.type === "free_text") {
    const text = _normText(String(ua ?? ""));
    const key = q.answerKey ?? {};
    if (!text) return false;
    if (Array.isArray(key.keywords) && key.keywords.length && key.keywords.some((k: string) => text.includes(_normText(k)))) return true;
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

  const allQuestions = await db.select().from(quizQuestions).where(eq(quizQuestions.trainingId, params.trainingId));
  // If this is a proctored exam session, score ONLY the questions that were served
  // (random subset), and close the session.
  let questions = allQuestions;
  if (params.sessionId) {
    const session = (await db.select().from(examSessions).where(eq(examSessions.id, params.sessionId)).limit(1))[0];
    if (session?.questionIds?.length) {
      const idset = new Set(session.questionIds);
      questions = allQuestions.filter((q) => idset.has(q.id));
    }
    if (session && !session.submittedAt) {
      await db.update(examSessions).set({ submittedAt: new Date(), status: "submitted" }).where(eq(examSessions.id, params.sessionId));
    }
  }
  const training = await db.select().from(trainings).where(eq(trainings.id, params.trainingId)).limit(1);

  let score = 0;
  const maxScore = questions.reduce((s, q) => s + (q.points ?? 1), 0);

  for (const q of questions) {
    if (gradeQuizAnswer(q, params.answers[String(q.id)])) score += q.points ?? 1;
  }

  const passingScore = training[0]?.passingScore ?? 75;
  const isPassed = maxScore > 0 ? (score / maxScore) * 100 >= passingScore : false;

  await db.insert(quizAttempts).values({
    enrollmentId: params.enrollmentId,
    userId: params.userId,
    trainingId: params.trainingId,
    score,
    maxScore,
    isPassed,
    answers: params.answers as any,
    completedAt: new Date(),
    attemptNumber: params.attemptNumber,
  });

  // If passed, mark enrollment as completed
  if (isPassed) {
    await db.update(enrollments).set({
      status: "completed",
      completedAt: new Date(),
      progressPercent: 100,
    }).where(eq(enrollments.id, params.enrollmentId));
  }

  return {
    score,
    maxScore,
    percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
    isPassed,
    passingScore,
    feedback: questions.map((q) => ({
      questionId: q.id,
      isCorrect: gradeQuizAnswer(q, params.answers[String(q.id)]),
      explanation: q.explanation,
    })),
  };
}

export async function getQuizAttempts(enrollmentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quizAttempts).where(eq(quizAttempts.enrollmentId, enrollmentId)).orderBy(desc(quizAttempts.startedAt));
}

// ─── Exam sessions, random question bank & proctoring (V2.1) ─────────────────
// Returns the exam question set: a random subset of N when randomizeQuestions +
// examQuestionCount are configured, otherwise all training questions.
export async function getExamQuestions(trainingId: number) {
  const db = await getDb();
  if (!db) return [];
  const training = (await db.select().from(trainings).where(eq(trainings.id, trainingId)).limit(1))[0];
  const all = await db.select().from(quizQuestions).where(eq(quizQuestions.trainingId, trainingId)).orderBy(quizQuestions.sortOrder);
  const n = training?.examQuestionCount ?? 0;
  if (!training?.randomizeQuestions || n <= 0 || n >= all.length) return all;
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export async function startExamSession(params: { enrollmentId: number; userId: number; trainingId: number; attemptNumber: number }) {
  const db = await getDb();
  if (!db) return null;
  const training = (await db.select().from(trainings).where(eq(trainings.id, params.trainingId)).limit(1))[0];
  const questions = await getExamQuestions(params.trainingId);
  const expiresAt = training?.examTimeLimitMin ? new Date(Date.now() + training.examTimeLimitMin * 60000) : null;
  const inserted = await db.insert(examSessions).values({
    enrollmentId: params.enrollmentId, userId: params.userId, trainingId: params.trainingId,
    attemptNumber: params.attemptNumber, questionIds: questions.map((q) => q.id), expiresAt, status: "active",
  }).returning({ id: examSessions.id });
  return { sessionId: inserted[0]?.id ?? null, expiresAt, timeLimitMin: training?.examTimeLimitMin ?? null, questions };
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

export async function updateExternalTraining(id: number, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.update(externalTrainings).set(data as any).where(eq(externalTrainings.id, id));
  return { success: true };
}

export async function deleteExternalTraining(id: number, opts?: { companyId?: number | null; isAdmin?: boolean }) {
  const db = await getDb();
  if (!db) return;
  const row = (await db.select().from(externalTrainings).where(eq(externalTrainings.id, id)).limit(1))[0];
  if (!row) return { success: false };
  if (!opts?.isAdmin && opts?.companyId != null && row.companyId !== opts.companyId) return { success: false };
  await db.delete(externalTrainings).where(eq(externalTrainings.id, id));
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
export function ruleMatchesEmployee(emp: any, rule: any): boolean {
  if (!rule.jobTitleContains && !rule.licenseCategoryContains) return true; // applies to all
  const jt = (emp.jobTitle ?? "").toLowerCase();
  const lc = (emp.licenseCategories ?? "").toLowerCase();
  const jMatch = rule.jobTitleContains ? jt.includes(String(rule.jobTitleContains).toLowerCase()) : false;
  const lMatch = rule.licenseCategoryContains ? lc.includes(String(rule.licenseCategoryContains).toLowerCase()) : false;
  return jMatch || lMatch;
}

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
  const db = await getDb();
  if (!db) return [];
  const all = await db.select().from(roleRequirements);
  const filtered = all.filter((r) => r.companyId == null || r.companyId === companyId);
  const result = [];
  for (const r of filtered) {
    const t = (await db.select().from(trainings).where(eq(trainings.id, r.trainingId)).limit(1))[0];
    result.push({ ...r, training: t ?? null });
  }
  return result;
}

export async function createRoleRequirement(data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(roleRequirements).values(data as any);
  return { success: true };
}

export async function deleteRoleRequirement(id: number, opts?: { companyId?: number | null; isAdmin?: boolean }) {
  const db = await getDb();
  if (!db) return;
  const row = (await db.select().from(roleRequirements).where(eq(roleRequirements.id, id)).limit(1))[0];
  if (!row) return { success: false };
  if (!opts?.isAdmin && opts?.companyId != null && row.companyId !== opts.companyId) return { success: false };
  await db.delete(roleRequirements).where(eq(roleRequirements.id, id));
  return { success: true };
}

// Training Needs Analysis: for each active employee, create the recurrencies
// required by matching role rules that aren't tracked yet. Returns how many were added.
export async function runTNA(companyId: number) {
  const db = await getDb();
  if (!db) return { created: 0 };
  const rules = (await db.select().from(roleRequirements)).filter((r) => r.companyId == null || r.companyId === companyId);
  const emps = (await db.select().from(employees).where(eq(employees.companyId, companyId))).filter((e) => e.isActive !== false);
  let created = 0;
  for (const emp of emps) {
    for (const rule of rules) {
      if (!ruleMatchesEmployee(emp, rule)) continue;
      const existing = await db.select().from(recurrencies)
        .where(and(eq(recurrencies.employeeId, emp.id), eq(recurrencies.trainingId, rule.trainingId))).limit(1);
      if (existing[0]) continue;
      const nextDueAt = new Date(); nextDueAt.setMonth(nextDueAt.getMonth() + rule.periodMonths);
      await db.insert(recurrencies).values({ companyId, employeeId: emp.id, trainingId: rule.trainingId, periodMonths: rule.periodMonths, nextDueAt, status: "not_started" });
      created++;
    }
  }
  return { created };
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
export async function createCredentialForIssuedCertificate(certificateId: number) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(credentials).where(eq(credentials.certificateId, certificateId)).limit(1);
  if (existing[0]) return existing[0];
  const cert = (await db.select().from(certificates).where(eq(certificates.id, certificateId)).limit(1))[0];
  if (!cert) return null;
  const enr = (await db.select().from(enrollments).where(eq(enrollments.id, cert.enrollmentId)).limit(1))[0];

  let origin: "ORG_ASSIGNED" | "INDEPENDENT" = "INDEPENDENT";
  let orgId: number | null = null;
  if (enr?.employeeId) {
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

// INV-5: a person surfaces a prior/external qualification THEMSELVES. Creates a LIVING,
// PERSON-controlled, INDEPENDENT credential marked surfaced, linked to the person's
// active affiliation so it becomes visible in that org's bounded view.
export async function surfaceCredentialForPerson(personId: number, data: {
  label: string; provider?: string | null; trainingId?: number | null; objectiveIds?: number[];
  completedAt?: Date | null; expiresAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) return null;
  const aff = (await db.select().from(affiliations)
    .where(and(eq(affiliations.personId, personId), eq(affiliations.status, "ACTIVE"))).limit(1))[0];
  const inserted = await db.insert(credentials).values({
    personId, trainingId: data.trainingId ?? null, moduleId: data.trainingId ?? null,
    part66Coverage: data.objectiveIds ?? [], label: data.label, provider: data.provider ?? null,
    state: "LIVING", controller: "PERSON", origin: "INDEPENDENT",
    affiliationId: aff?.id ?? null, surfacedByPersonAt: new Date(),
    obtainedAt: data.completedAt ?? null, expiresAt: data.expiresAt ?? null,
  }).returning();
  return inserted[0];
}

// INV-5: the person may withdraw a surfaced credential ONLY while it is not locked
// (i.e., not yet relied upon by the org during employment). Locked → refused.
export async function unsurfaceCredentialForPerson(personId: number, credentialId: number): Promise<{ ok: boolean; reason?: string }> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "db" };
  const cred = (await db.select().from(credentials).where(eq(credentials.id, credentialId)).limit(1))[0];
  if (!cred || cred.personId !== personId) return { ok: false, reason: "not_found" };
  if (cred.surfacedByPersonAt == null || cred.origin !== "INDEPENDENT") return { ok: false, reason: "not_surfaced" };
  const locked = cred.lockedInOrgViewUntil != null && new Date(cred.lockedInOrgViewUntil).getTime() > Date.now();
  if (locked) return { ok: false, reason: "locked" };
  await db.delete(credentials).where(eq(credentials.id, credentialId));
  return { ok: true };
}

// INV-5: once an org relies on a person's surfaced credentials, lock them for the
// duration of the affiliation (a proof can't be withdrawn mid-employment to hide a lapse).
const LOCK_SENTINEL = new Date("9999-12-31T00:00:00Z"); // "locked while employed"
export async function lockSurfacedCredentialsForOrg(personId: number, orgId: number): Promise<{ locked: number }> {
  const db = await getDb();
  if (!db) return { locked: 0 };
  const aff = (await db.select().from(affiliations)
    .where(and(eq(affiliations.personId, personId), eq(affiliations.orgId, orgId))).limit(1))[0];
  const creds = await db.select().from(credentials).where(eq(credentials.personId, personId));
  let locked = 0;
  for (const c of creds) {
    if (c.surfacedByPersonAt == null) continue;            // only surfaced credentials
    if (c.lockedInOrgViewUntil != null) continue;          // already locked
    if (aff && c.affiliationId != null && c.affiliationId !== aff.id) continue; // surfaced to another org
    await db.update(credentials).set({ lockedInOrgViewUntil: LOCK_SENTINEL }).where(eq(credentials.id, c.id));
    locked++;
  }
  return { locked };
}

export async function getPersonCredentials(personId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(credentials).where(eq(credentials.personId, personId)).orderBy(desc(credentials.createdAt));
}

// ─── Sign-offs (INV-4: the human determination of compliance by a manager) ────
export async function createSignoff(data: {
  managerPersonId: number; subjectPersonId: number; orgId: number; affiliationId?: number | null;
  credentialId?: number | null; trainingId?: number | null; scope?: string; decision?: string; note?: string | null;
}) {
  const db = await getDb();
  if (!db) return null;
  const inserted = await db.insert(signoffs).values({
    managerPersonId: data.managerPersonId, subjectPersonId: data.subjectPersonId, orgId: data.orgId,
    affiliationId: data.affiliationId ?? null, credentialId: data.credentialId ?? null, trainingId: data.trainingId ?? null,
    scope: data.scope ?? "COMPETENCE", decision: data.decision ?? "VALIDATED", note: data.note ?? null,
  }).returning();
  return inserted[0];
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
    out.push({ ...s, managerName: mgr?.name ?? null, trainingTitle: t?.title ?? null });
  }
  return out;
}

export async function setAffiliationRole(affiliationId: number, role: "MANAGER" | "MEMBER") {
  const db = await getDb();
  if (!db) return { ok: false };
  await db.update(affiliations).set({ role }).where(eq(affiliations.id, affiliationId));
  return { ok: true };
}

// ─── Erasure & retention (INV-7) ──────────────────────────────────────────────
// Freeze the credentials that served as proof-of-compliance-during-employment for an
// org: state→FROZEN, controller→ORG, with an immutable (pseudonymised) snapshot. These
// survive the person's erasure under the org's legal retention basis.
export async function freezeCredentialsForOrg(personId: number, orgId: number): Promise<{ frozen: number }> {
  const db = await getDb();
  if (!db) return { frozen: 0 };
  const aff = (await db.select().from(affiliations).where(and(eq(affiliations.personId, personId), eq(affiliations.orgId, orgId))).limit(1))[0];
  const creds = await db.select().from(credentials).where(eq(credentials.personId, personId));
  let frozen = 0;
  for (const c of creds) {
    if (c.state === "FROZEN") continue;
    // Org proof = org-assigned credentials, or person-surfaced credentials already relied
    // upon (locked). Purely independent/unsurfaced credentials are NOT org proof.
    const isOrgProof = c.origin === "ORG_ASSIGNED" || (c.surfacedByPersonAt != null && c.lockedInOrgViewUntil != null);
    if (!isOrgProof) continue;
    if (c.affiliationId != null && aff && c.affiliationId !== aff.id) continue; // belongs to another org
    let trainingTitle: string | null = null;
    let certNumber: string | null = null;
    if (c.trainingId) trainingTitle = (await db.select().from(trainings).where(eq(trainings.id, c.trainingId)).limit(1))[0]?.title ?? null;
    if (c.certificateId) certNumber = (await db.select().from(certificates).where(eq(certificates.id, c.certificateId)).limit(1))[0]?.certificateNumber ?? null;
    const snapshot = {
      trainingTitle, certNumber, label: c.label, part66Coverage: c.part66Coverage,
      obtainedAt: c.obtainedAt, expiresAt: c.expiresAt, frozenAt: new Date().toISOString(),
      note: "Snapshot de preuve-de-conformité-pendant-l'emploi (personne pseudonymisée).",
    };
    await db.update(credentials)
      .set({ state: "FROZEN", controller: "ORG", frozenSnapshot: snapshot, lockedInOrgViewUntil: aff?.endedAt ?? new Date() })
      .where(eq(credentials.id, c.id));
    frozen++;
  }
  return { frozen };
}

// INV-7: right to erasure reconciled with regulatory retention. Freezes org proof FIRST,
// then deletes the person's LIVING/independent layer + transient personal data, then
// PSEUDONYMISES the users row (kept, because FROZEN credentials reference it). Affiliations
// → INACTIVE; roster link detached. Detached applicatively (no SQL cascade).
export async function erasePerson(personId: number): Promise<{ frozen: number; deletedCredentials: number; pseudonymised: boolean }> {
  const db = await getDb();
  if (!db) return { frozen: 0, deletedCredentials: 0, pseudonymised: false };

  // 1) Freeze org proof for every org the person was affiliated with (active or past).
  const affs = await db.select().from(affiliations).where(eq(affiliations.personId, personId));
  let frozen = 0;
  for (const aff of affs) frozen += (await freezeCredentialsForOrg(personId, aff.orgId)).frozen;

  // 2) Delete the LIVING / independent credential layer (everything not frozen as org proof).
  const creds = await db.select().from(credentials).where(eq(credentials.personId, personId));
  let deletedCredentials = 0;
  for (const c of creds) {
    if (c.state === "FROZEN") continue;
    await db.delete(credentials).where(eq(credentials.id, c.id));
    deletedCredentials++;
  }

  // 3) Delete transient purely-personal data.
  await db.delete(cartItems).where(eq(cartItems.userId, personId));
  await db.delete(notifications).where(eq(notifications.userId, personId));
  await db.delete(quizAttempts).where(eq(quizAttempts.userId, personId));
  await db.delete(examSessions).where(eq(examSessions.userId, personId));

  // 4) Pseudonymise the users row — KEEP it (frozen credentials/certs reference it).
  await db.update(users).set({
    name: "Personne effacée", email: null, passwordHash: null, status: "suspended",
    licenseNumber: null, licenseCategories: null, typeRatings: null, jobTitle: null, marketingOptIn: false,
  }).where(eq(users.id, personId));

  // 5) Affiliations → INACTIVE (materialises lock end); 6) detach roster link.
  await db.update(affiliations).set({ status: "INACTIVE", endedAt: new Date() }).where(eq(affiliations.personId, personId));
  await db.update(employees).set({ userId: null }).where(eq(employees.userId, personId));

  return { frozen, deletedCredentials, pseudonymised: true };
}

// ─── Course templates + content lifecycle / versioning (V2.6) ────────────────
export async function getCourseTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(courseTemplates).orderBy(courseTemplates.code);
}

// Instantiate a draft course (training + modules + Part-66 objectives) from a template.
export async function createCourseFromTemplate(templateId: number, ownerUserId?: number) {
  const db = await getDb();
  if (!db) return null;
  const tpl = (await db.select().from(courseTemplates).where(eq(courseTemplates.id, templateId)).limit(1))[0];
  if (!tpl) return null;
  const base = tpl.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const slug = `${base}-${Math.floor(Math.random() * 1e6)}`;
  const ins = await db.insert(trainings).values({
    title: tpl.title, slug, description: tpl.description ?? null, language: tpl.language ?? "fr",
    domain: (tpl.domain as any) ?? "general", type: "elearning", isPublished: false,
    reviewStatus: "draft", version: 1, passingScore: 75, maxAttempts: 3,
  }).returning({ id: trainings.id });
  const trainingId = ins[0].id;
  let order = 1;
  for (const m of (tpl.structure?.modules ?? [])) {
    const modIns = await db.insert(trainingModules).values({ trainingId, title: m.title, content: m.content ?? null, sortOrder: order++ }).returning({ id: trainingModules.id });
    let oo = 1;
    for (const o of (m.objectives ?? [])) {
      await db.insert(learningObjectives).values({ trainingId, moduleId: modIns[0].id, code: o.code ?? null, title: o.title, knowledgeLevel: (o.knowledgeLevel as any) ?? "1", sortOrder: oo++ } as any);
    }
  }
  await db.insert(contentRevisions).values({ trainingId, version: 1, status: "draft", changelog: `Créé depuis le template ${tpl.code ?? tpl.title}`, byUserId: ownerUserId ?? null });
  return { trainingId };
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
  const all = await db.select().from(trainings).where(eq(trainings.isPublished, true));
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
export async function importEmployeesCSV(userId: number, csvData: string) {
  const db = await getDb();
  if (!db) return { imported: 0, errors: [] };

  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]?.companyId) return { imported: 0, errors: ["Aucune entreprise associée à ce compte."] };

  const lines = csvData.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { imported: 0, errors: ["Fichier CSV vide ou invalide."] };

  // Parse header
  const headers = lines[0].split(";").map((h) => h.trim().toLowerCase());
  const imported: number[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] ?? ""; });

    const firstName = row["prenom"] || row["firstname"] || row["prénom"] || "";
    const lastName = row["nom"] || row["lastname"] || "";
    const email = row["email"] || "";

    if (!firstName || !lastName || !email) {
      errors.push(`Ligne ${i + 1} : prénom, nom et email requis.`);
      continue;
    }

    try {
      await db.insert(employees).values({
        companyId: user[0].companyId!,
        firstName,
        lastName,
        email,
        jobTitle: row["fonction"] || row["jobtitle"] || undefined,
        licenseNumber: row["licence"] || row["licensenumber"] || undefined,
        licenseCategories: row["categories"] || row["licensecategories"] || undefined,
        typeRatings: row["typeratings"] || row["type_ratings"] || undefined,
        department: row["departement"] || row["department"] || undefined,
        base: row["base"] || undefined,
      });
      imported.push(i);
    } catch (err) {
      errors.push(`Ligne ${i + 1} : erreur d'insertion (${email}).`);
    }
  }

  return { imported: imported.length, errors };
}

// ─── Admin User Detail ────────────────────────────────────────────────────────
export async function getAdminUserDetail(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRows[0]) return null;
  const { passwordHash: _ph, ...user } = userRows[0];
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

export async function adminUpdateModule(id: number, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.update(trainingModules).set(data as any).where(eq(trainingModules.id, id));
  return { success: true };
}

export async function adminDeleteModule(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(moduleProgress).where(eq(moduleProgress.moduleId, id));
  await db.delete(quizQuestions).where(eq(quizQuestions.moduleId, id));
  // Detach objectives bound to this module — they fall back to the training level.
  await db.update(learningObjectives).set({ moduleId: null }).where(eq(learningObjectives.moduleId, id));
  await db.delete(trainingModules).where(eq(trainingModules.id, id));
  return { success: true };
}

// ─── Learning Objectives (Part-66 sub-modules) ───────────────────────────────
export async function getObjectives(trainingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(learningObjectives).where(eq(learningObjectives.trainingId, trainingId)).orderBy(learningObjectives.sortOrder);
}

export async function adminCreateObjective(data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(learningObjectives).values(data as any);
  return { success: true };
}

export async function adminUpdateObjective(id: number, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.update(learningObjectives).set(data as any).where(eq(learningObjectives.id, id));
  return { success: true };
}

export async function adminDeleteObjective(id: number) {
  const db = await getDb();
  if (!db) return;
  // No SQL FKs in this schema — detach references explicitly before deleting.
  await db.update(slides).set({ objectiveId: null }).where(eq(slides.objectiveId, id));
  await db.update(quizQuestions).set({ objectiveId: null }).where(eq(quizQuestions.objectiveId, id));
  await db.update(trainingModules).set({ objectiveId: null }).where(eq(trainingModules.objectiveId, id));
  await db.delete(objectiveProgress).where(eq(objectiveProgress.objectiveId, id));
  await db.delete(certificateObjectives).where(eq(certificateObjectives.objectiveId, id));
  await db.delete(learningObjectives).where(eq(learningObjectives.id, id));
  return { success: true };
}

export async function reorderObjectives(orderedIds: number[]) {
  const db = await getDb();
  if (!db) return;
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(learningObjectives).set({ sortOrder: i }).where(eq(learningObjectives.id, orderedIds[i]));
  }
  return { success: true };
}

// Derived objective-level completion for one enrollment (no extra writes needed):
// an objective is complete when every module attached to it is completed AND
// every question attached to it was answered correctly in the latest attempt.
export async function getObjectiveCompletion(enrollmentId: number) {
  const db = await getDb();
  if (!db) return [];
  const enr = (await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).limit(1))[0];
  if (!enr) return [];
  const objectives = await db.select().from(learningObjectives)
    .where(eq(learningObjectives.trainingId, enr.trainingId)).orderBy(learningObjectives.sortOrder);
  if (objectives.length === 0) return [];
  const mods = await db.select().from(trainingModules).where(eq(trainingModules.trainingId, enr.trainingId));
  const completedModuleIds = new Set(
    (await db.select().from(moduleProgress)
      .where(and(eq(moduleProgress.enrollmentId, enrollmentId), eq(moduleProgress.isCompleted, true)))).map((m) => m.moduleId),
  );
  const qs = await db.select().from(quizQuestions).where(eq(quizQuestions.trainingId, enr.trainingId));
  const lastAttempt = (await db.select().from(quizAttempts)
    .where(eq(quizAttempts.enrollmentId, enrollmentId)).orderBy(desc(quizAttempts.startedAt)).limit(1))[0];
  const answers = (lastAttempt?.answers as Record<string, number[]> | null) ?? {};
  return objectives.map((o) => {
    const objModules = mods.filter((m) => m.objectiveId === o.id);
    const objQuestions = qs.filter((q) => q.objectiveId === o.id);
    const modulesDone = objModules.every((m) => completedModuleIds.has(m.id));
    const questionsDone = objQuestions.every((q) => {
      const ua = answers[String(q.id)] ?? [];
      const correct = (q.correctAnswer as number[] | null) ?? [];
      return correct.length === ua.length && correct.every((c) => ua.includes(c));
    });
    const hasContent = objModules.length > 0 || objQuestions.length > 0;
    return { ...o, isCompleted: hasContent && modulesDone && questionsDone, moduleCount: objModules.length, questionCount: objQuestions.length };
  });
}

// ─── Admin: Quiz Questions CRUD ───────────────────────────────────────────────
export async function adminCreateQuestion(data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(quizQuestions).values(data as any);
  return { success: true };
}

export async function adminUpdateQuestion(id: number, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.update(quizQuestions).set(data as any).where(eq(quizQuestions.id, id));
  return { success: true };
}

export async function adminDeleteQuestion(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(quizQuestions).where(eq(quizQuestions.id, id));
  return { success: true };
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

// Suspend/reactivate an org. Enforced via INV-2: its affiliations are toggled, so its
// managers/members immediately lose/regain the bounded org view. (MVP: a reactivation
// re-activates all edges; per-edge removal should be redone afterwards if needed.)
export async function adminSetOrganizationStatus(id: number, status: "ACTIVE" | "SUSPENDED") {
  const db = await getDb();
  if (!db) return { ok: false };
  await db.update(companies).set({ status }).where(eq(companies.id, id));
  await db.update(affiliations).set({ status: status === "SUSPENDED" ? "INACTIVE" : "ACTIVE" }).where(eq(affiliations.orgId, id));
  return { ok: true };
}

// Hard delete — refused if the org still has roster employees (suspend instead).
export async function adminDeleteOrganization(id: number): Promise<{ ok: boolean; reason?: string; count?: number }> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "db" };
  const emps = await db.select().from(employees).where(eq(employees.companyId, id));
  if (emps.length > 0) return { ok: false, reason: "has_employees", count: emps.length };
  await db.delete(affiliations).where(eq(affiliations.orgId, id));
  await db.delete(roleRequirements).where(eq(roleRequirements.companyId, id));
  await db.delete(companies).where(eq(companies.id, id));
  return { ok: true };
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
const PASSPORT_KINDS = ["ID", "PASSPORT", "DIPLOMA", "CERTIFICATE", "LICENSE", "RATING", "LOGBOOK", "EXPERIENCE", "OTHER"] as const;
export type PassportKind = (typeof PASSPORT_KINDS)[number];

export async function getPassportDocuments(personId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(passportDocuments).where(eq(passportDocuments.personId, personId)).orderBy(desc(passportDocuments.createdAt));
}

// Decode a base64 payload, persist it via storagePut, and record the document row.
// Self-scoped: the caller always passes ctx.user.id as personId.
export async function createPassportDocument(input: {
  personId: number; kind: PassportKind; title: string; issuer?: string | null; reference?: string | null;
  country?: string | null; issuedAt?: Date | null; expiresAt?: Date | null;
  fileName: string; contentType: string; dataBase64: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("db unavailable");
  const buf = Buffer.from(input.dataBase64, "base64");
  const safeName = (input.fileName || "document").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const { url } = await storagePut(`passport/${input.personId}/${input.kind.toLowerCase()}-${safeName}`, buf, input.contentType);
  const row = {
    personId: input.personId, kind: input.kind, title: input.title.trim(),
    issuer: input.issuer ?? null, reference: input.reference ?? null, country: input.country ?? null,
    issuedAt: input.issuedAt ?? null, expiresAt: input.expiresAt ?? null,
    fileUrl: url, fileName: input.fileName, contentType: input.contentType, fileSize: buf.length,
  };
  const inserted = (await db.insert(passportDocuments).values(row).returning())[0];
  return inserted;
}

// Person consent toggle: expose the whole ID module (documents) to affiliated orgs.
export async function setPassportSharing(personId: number, enabled: boolean): Promise<{ ok: boolean }> {
  const db = await getDb();
  if (!db) return { ok: false };
  await db.update(users).set({ passportShared: enabled }).where(eq(users.id, personId));
  return { ok: true };
}

// Delete only if the document belongs to the requesting person (ownership guard).
export async function deletePassportDocument(id: number, personId: number): Promise<{ ok: boolean }> {
  const db = await getDb();
  if (!db) return { ok: false };
  const doc = (await db.select().from(passportDocuments).where(eq(passportDocuments.id, id)).limit(1))[0];
  if (!doc || doc.personId !== personId) return { ok: false };
  await db.delete(passportDocuments).where(eq(passportDocuments.id, id));
  return { ok: true };
}

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
  return db.select().from(slides).where(eq(slides.trainingId, trainingId)).orderBy(slides.sortOrder);
}

export async function createSlide(data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return null;
  const inserted = await db.insert(slides).values(data as any).returning({ id: slides.id });
  return { id: inserted[0].id };
}

export async function updateSlide(id: number, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.update(slides).set(data as any).where(eq(slides.id, id));
  return { success: true };
}

export async function deleteSlide(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(slides).where(eq(slides.id, id));
  return { success: true };
}

export async function reorderSlides(orderedIds: number[]) {
  const db = await getDb();
  if (!db) return;
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(slides).set({ sortOrder: i + 1 }).where(eq(slides.id, orderedIds[i]));
  }
  return { success: true };
}

/** Create a training plus its slides from an AI-generated outline. */
export async function createCourseWithSlides(params: {
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
}) {
  const db = await getDb();
  if (!db) return null;
  const inserted = await db.insert(trainings).values({
    title: params.title,
    slug: params.slug,
    description: params.description,
    language: params.language ?? "en",
    categoryId: params.categoryId,
    type: "elearning",
    durationHours: params.durationHours,
    isPublished: false,
    passingScore: 75,
    maxAttempts: 3,
  } as any).returning({ id: trainings.id });
  const trainingId = inserted[0].id;
  for (let i = 0; i < params.slides.length; i++) {
    const s = params.slides[i];
    await db.insert(slides).values({ ...s, trainingId, sortOrder: i + 1 } as any);
  }
  return { trainingId };
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
    result.push({ ...s, training: training ?? null });
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

export async function updateSession(id: number, data: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.update(sessions).set(data as any).where(eq(sessions.id, id));
  return { success: true };
}

export async function deleteSession(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(sessionRegistrations).where(eq(sessionRegistrations.sessionId, id));
  await db.delete(sessions).where(eq(sessions.id, id));
  return { success: true };
}

export async function registerForSession(userId: number, sessionId: number) {
  const db = await getDb();
  if (!db) return { success: false, message: "DB indisponible" };
  const s = (await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1))[0];
  if (!s) return { success: false, message: "Session introuvable" };
  const existing = await db.select().from(sessionRegistrations)
    .where(and(eq(sessionRegistrations.sessionId, sessionId), eq(sessionRegistrations.userId, userId), eq(sessionRegistrations.status, "registered"))).limit(1);
  if (existing[0]) return { success: true, message: "Déjà inscrit" };
  if ((s.seatsTaken ?? 0) >= (s.seats ?? 0)) return { success: false, message: "Session complète" };
  await db.insert(sessionRegistrations).values({ sessionId, userId });
  const taken = (s.seatsTaken ?? 0) + 1;
  await db.update(sessions).set({ seatsTaken: taken, ...(taken >= (s.seats ?? 0) ? { status: "full" as const } : {}) }).where(eq(sessions.id, sessionId));
  return { success: true, message: "Inscription confirmée" };
}

export async function getUserSessions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const regs = await db.select().from(sessionRegistrations).where(eq(sessionRegistrations.userId, userId));
  const result = [];
  for (const r of regs) {
    const s = (await db.select().from(sessions).where(eq(sessions.id, r.sessionId)).limit(1))[0];
    if (s) result.push({ ...s, registrationStatus: r.status });
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
  return db.select().from(trainings).where(eq(trainings.isPublished, true)).orderBy(trainings.title);
}

// ─── Admin Compliance Report ──────────────────────────────────────────────────
export async function getAdminComplianceReport() {
  const db = await getDb();
  if (!db) return [];
  const allEnrollments = await db.select().from(enrollments).orderBy(desc(enrollments.createdAt));
  const result = [];
  for (const e of allEnrollments) {
    const user = await db.select().from(users).where(eq(users.id, e.userId)).limit(1);
    const training = await db.select().from(trainings).where(eq(trainings.id, e.trainingId)).limit(1);
    const cert = await db.select().from(certificates).where(eq(certificates.enrollmentId, e.id)).limit(1);
    result.push({
      enrollmentId: e.id,
      userName: user[0]?.name ?? "—",
      userEmail: user[0]?.email ?? "—",
      trainingTitle: training[0]?.title ?? "—",
      trainingType: training[0]?.type ?? "—",
      status: e.status,
      progressPercent: e.progressPercent ?? 0,
      completedAt: e.completedAt,
      expiresAt: e.expiresAt,
      certificateNumber: cert[0]?.certificateNumber ?? null,
    });
  }
  return result;
}
