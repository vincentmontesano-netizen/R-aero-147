// ─── Access & permissions layer (person-centric compliance, RGPD) ─────────────
// Enforces the brief's invariants on top of the additive schema:
//   INV-2  org access is bounded by an ACTIVE affiliation
//   INV-3  the org sees ONLY what the regulatory role requires (minimisation)
//   INV-8  every read of personal data is logged (god-mode + public included)
//   INV-9  a member sees exactly what the org sees (+ their private layer)
// The org-scoped view is built as a NEW whitelisted object — we never spread a raw
// row — which is the structural guarantee that personal/elective data can't leak.

import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb, computeRecurrencyStatus, ruleMatchesEmployee } from "./db";
import {
  affiliations, accessLogs, credentials, certificates, enrollments,
  recurrencies, roleRequirements, trainings, employees, companies,
  users, orders, orderItems,
  type Affiliation, type Credential,
} from "../drizzle/schema";

// ─── Affiliations (INV-2) ─────────────────────────────────────────────────────
export async function getActiveAffiliations(personId: number): Promise<Affiliation[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(affiliations)
    .where(and(eq(affiliations.personId, personId), eq(affiliations.status, "ACTIVE")));
}

/** INV-2: an organisation may only reach a person's file through an ACTIVE
 *  affiliation. Throws FORBIDDEN otherwise; returns the affiliation (carrying the
 *  per-org role) on success. */
export async function assertActiveAffiliation(personId: number, orgId: number): Promise<Affiliation> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
  const rows = await db.select().from(affiliations).where(and(
    eq(affiliations.personId, personId),
    eq(affiliations.orgId, orgId),
    eq(affiliations.status, "ACTIVE"),
  )).limit(1);
  if (!rows[0]) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Aucune affiliation active ne lie cette personne à l'organisation." });
  }
  return rows[0];
}

/** The actor's effective role for a given org, derived from their ACTIVE
 *  affiliation (matrix E). Returns null when the actor has no active edge there. */
export async function resolveActorAffiliationRole(actorPersonId: number, orgId: number): Promise<"MANAGER" | "MEMBER" | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(affiliations).where(and(
    eq(affiliations.personId, actorPersonId),
    eq(affiliations.orgId, orgId),
    eq(affiliations.status, "ACTIVE"),
  )).limit(1);
  const role = rows[0]?.role;
  return role === "MANAGER" || role === "MEMBER" ? role : null;
}

// ─── Access log (INV-8) ───────────────────────────────────────────────────────
export type LogAccessInput = {
  actorId?: number | null;
  actorRole?: string | null;
  subjectPersonId?: number | null;
  action: string;
  dataAccessed?: Record<string, unknown> | null;
  justification?: string | null;
  targetOrgId?: number | null;
  ip?: string | null;
};

/** INV-8: record a read of personal data. MUST never throw — logging failure must
 *  not break the read it is auditing. */
export async function logAccess(input: LogAccessInput): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(accessLogs).values({
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      subjectPersonId: input.subjectPersonId ?? null,
      action: input.action,
      dataAccessed: input.dataAccessed ?? null,
      justification: input.justification ?? null,
      targetOrgId: input.targetOrgId ?? null,
      ip: input.ip ?? null,
    });
  } catch (err) {
    console.warn("[access] logAccess failed (swallowed):", err);
  }
}

/** Best-effort client IP from an Express request, for public access logging. */
export function ipFromReq(req: any): string | null {
  if (!req) return null;
  const xf = req.headers?.["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0]!.trim();
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

// ─── Org-scoped view (INV-3) ──────────────────────────────────────────────────
export type OrgScopedModule = {
  trainingId: number;
  title: string | null;
  periodMonths: number;
  recurrencyStatus: "ok" | "due_soon" | "overdue" | "not_started";
  nextDueAt: Date | null;
  lastCompletedAt: Date | null;
  hasValidCertificate: boolean;
  certificateNumber: string | null;
  certificateExpiresAt: Date | null;
};

export type OrgScopedView = {
  subjectPersonId: number;
  orgId: number;
  requiredModules: OrgScopedModule[];
  part66Coverage: number[];
  expiringSoon: number;
  overdue: number;
};

/** PURE projection — the heart of INV-3. Given already-fetched rows, build the
 *  whitelisted view field-by-field. It deliberately:
 *   - never carries email / proEmail / any identity field,
 *   - never reads quiz attempts or failed enrollments,
 *   - restricts certificates to REQUIRED trainings (no elective/independent course),
 *   - includes Part-66 coverage only from org-visible credentials (ORG_ASSIGNED or
 *     person-surfaced), intersected with the required trainings.
 *  Kept pure so it is unit-testable without a database. */
export function projectOrgScopedView(input: {
  subjectPersonId: number;
  orgId: number;
  matchedRules: { trainingId: number; periodMonths: number; trainingTitle: string | null }[];
  recurrencies: { trainingId: number; nextDueAt: Date | null; lastCompletedAt: Date | null }[];
  certificates: { trainingId: number; isValid: boolean | null; certificateNumber: string; expiresAt: Date | null; issuedAt: Date | null }[];
  credentials: { trainingId: number | null; origin: string; surfacedByPersonAt: Date | null; part66Coverage: number[] | null }[];
}): OrgScopedView {
  const requiredTrainingIds = new Set(input.matchedRules.map((r) => r.trainingId));

  const recByTraining = new Map<number, (typeof input.recurrencies)[number]>();
  for (const r of input.recurrencies) recByTraining.set(r.trainingId, r);

  // Valid certificates, restricted to required trainings only (INV-3).
  const certByTraining = new Map<number, (typeof input.certificates)[number]>();
  for (const c of input.certificates) {
    if (c.isValid === false) continue;
    if (!requiredTrainingIds.has(c.trainingId)) continue;
    const prev = certByTraining.get(c.trainingId);
    const newer = (c.issuedAt?.getTime() ?? 0) >= (prev?.issuedAt?.getTime() ?? -1);
    if (!prev || newer) certByTraining.set(c.trainingId, c);
  }

  // Part-66 coverage from org-visible credentials only.
  const coverage = new Set<number>();
  for (const cr of input.credentials) {
    const visible = cr.origin === "ORG_ASSIGNED" || cr.surfacedByPersonAt != null;
    if (!visible) continue;
    if (cr.trainingId != null && !requiredTrainingIds.has(cr.trainingId)) continue;
    for (const oid of cr.part66Coverage ?? []) coverage.add(oid);
  }

  const requiredModules: OrgScopedModule[] = [];
  let expiringSoon = 0;
  let overdue = 0;
  for (const r of input.matchedRules) {
    const rec = recByTraining.get(r.trainingId);
    const status = computeRecurrencyStatus(rec?.nextDueAt ?? null, rec?.lastCompletedAt ?? null);
    if (status === "due_soon") expiringSoon++;
    else if (status === "overdue") overdue++;
    const cert = certByTraining.get(r.trainingId);
    requiredModules.push({
      trainingId: r.trainingId,
      title: r.trainingTitle,
      periodMonths: r.periodMonths,
      recurrencyStatus: status,
      nextDueAt: rec?.nextDueAt ?? null,
      lastCompletedAt: rec?.lastCompletedAt ?? null,
      hasValidCertificate: !!cert,
      certificateNumber: cert?.certificateNumber ?? null,
      certificateExpiresAt: cert?.expiresAt ?? null,
    });
  }

  return { subjectPersonId: input.subjectPersonId, orgId: input.orgId, requiredModules, part66Coverage: Array.from(coverage), expiringSoon, overdue };
}

/** Fetch the data an org legitimately needs about a subject and project it through
 *  the whitelist (INV-3). The subject is identified by personId; the affiliation
 *  carries the org + optional roster (employee) link used for requirement matching. */
export async function getOrgScopedView(affiliation: Affiliation, subjectPersonId: number): Promise<OrgScopedView> {
  const orgId = affiliation.orgId;
  const empty: OrgScopedView = { subjectPersonId, orgId, requiredModules: [], part66Coverage: [], expiringSoon: 0, overdue: 0 };
  const db = await getDb();
  if (!db) return empty;

  // Roster record (for role-requirement matching): prefer the affiliation's link,
  // else the subject's employee row in this org.
  let emp: any = affiliation.employeeId
    ? (await db.select().from(employees).where(eq(employees.id, affiliation.employeeId)).limit(1))[0]
    : undefined;
  if (!emp) {
    emp = (await db.select().from(employees)
      .where(and(eq(employees.companyId, orgId), eq(employees.userId, subjectPersonId))).limit(1))[0];
  }

  const allRules = (await db.select().from(roleRequirements)).filter((r) => r.companyId == null || r.companyId === orgId);
  const matched = emp ? allRules.filter((r) => ruleMatchesEmployee(emp, r)) : [];
  const recs = emp ? await db.select().from(recurrencies).where(eq(recurrencies.employeeId, emp.id)) : [];

  // Required trainings = role-requirement matches ∪ trainings the org already tracks via
  // recurrencies for this person (both are "required by the org" for INV-3 purposes).
  const periodByTraining = new Map<number, number>();
  for (const r of matched) periodByTraining.set(r.trainingId, r.periodMonths);
  for (const rec of recs) if (!periodByTraining.has(rec.trainingId)) periodByTraining.set(rec.trainingId, rec.periodMonths ?? 0);

  const matchedRules: { trainingId: number; periodMonths: number; trainingTitle: string | null }[] = [];
  for (const [trainingId, periodMonths] of Array.from(periodByTraining.entries())) {
    const t = (await db.select().from(trainings).where(eq(trainings.id, trainingId)).limit(1))[0];
    matchedRules.push({ trainingId, periodMonths, trainingTitle: t?.title ?? null });
  }

  const certs = await db.select().from(certificates).where(eq(certificates.userId, subjectPersonId));
  const creds = await db.select().from(credentials).where(eq(credentials.personId, subjectPersonId));

  return projectOrgScopedView({
    subjectPersonId,
    orgId,
    matchedRules,
    recurrencies: recs.map((r) => ({ trainingId: r.trainingId, nextDueAt: r.nextDueAt, lastCompletedAt: r.lastCompletedAt })),
    certificates: certs.map((c) => ({ trainingId: c.trainingId, isValid: c.isValid, certificateNumber: c.certificateNumber, expiresAt: c.expiresAt, issuedAt: c.issuedAt })),
    credentials: creds.map((c) => ({ trainingId: c.trainingId, origin: c.origin, surfacedByPersonAt: c.surfacedByPersonAt, part66Coverage: c.part66Coverage })),
  });
}

/** Convenience: build the org-scoped view of a subject from (orgId, personId), looking
 *  up the subject's affiliation (for the roster/employee link used in requirement
 *  matching). Used by the manager's technician-file read. */
export async function orgScopedViewForSubject(orgId: number, subjectPersonId: number): Promise<OrgScopedView> {
  const db = await getDb();
  if (!db) return { subjectPersonId, orgId, requiredModules: [], part66Coverage: [], expiringSoon: 0, overdue: 0 };
  const aff = (await db.select().from(affiliations)
    .where(and(eq(affiliations.personId, subjectPersonId), eq(affiliations.orgId, orgId))).limit(1))[0]
    ?? ({ id: 0, orgId, personId: subjectPersonId, employeeId: null } as unknown as Affiliation);
  return getOrgScopedView(aff, subjectPersonId);
}

// ─── Self view (INV-9) ────────────────────────────────────────────────────────
export type SelfView = {
  personId: number;
  // Exactly what each employer sees of this person (one entry per active affiliation).
  orgViews: { orgId: number; orgName: string | null; view: OrgScopedView }[];
  // The private layer the org never sees.
  privateCredentials: (Credential & { displayTitle: string })[];
  certificates: unknown[];
  enrollments: unknown[];
  // Person consent: when true, affiliated orgs may view the whole ID module (documents).
  passportShared: boolean;
};

/** INV-9: the member sees exactly what the org sees (the org views) PLUS their full
 *  private layer (all credentials incl. independent, all certs, all enrollments). */
export async function getSelfView(personId: number): Promise<SelfView> {
  const base: SelfView = { personId, orgViews: [], privateCredentials: [], certificates: [], enrollments: [], passportShared: false };
  const db = await getDb();
  if (!db) return base;
  const me = (await db.select().from(users).where(eq(users.id, personId)).limit(1))[0];
  base.passportShared = !!me?.passportShared;
  const affs = await getActiveAffiliations(personId);
  for (const aff of affs) {
    const org = (await db.select().from(companies).where(eq(companies.id, aff.orgId)).limit(1))[0];
    base.orgViews.push({ orgId: aff.orgId, orgName: org?.name ?? null, view: await getOrgScopedView(aff, personId) });
  }
  const creds = await db.select().from(credentials).where(eq(credentials.personId, personId));
  for (const c of creds) {
    let title = c.label ?? null;
    if (!title && c.trainingId) title = (await db.select().from(trainings).where(eq(trainings.id, c.trainingId)).limit(1))[0]?.title ?? null;
    base.privateCredentials.push({ ...c, displayTitle: title ?? `Credential #${c.id}` });
  }
  base.certificates = await db.select().from(certificates).where(eq(certificates.userId, personId));
  base.enrollments = await db.select().from(enrollments).where(eq(enrollments.userId, personId));
  return base;
}

// RGPD data portability — a full machine-readable copy of the person's data, assembled
// from the self view + their orders + the access log of reads about them.
export async function exportPersonData(personId: number) {
  const db = await getDb();
  if (!db) return null;
  const self = await getSelfView(personId);
  const u = (await db.select().from(users).where(eq(users.id, personId)).limit(1))[0];
  const profile = u ? {
    id: u.id, name: u.name, email: u.email, licenseNumber: u.licenseNumber,
    licenseCategories: u.licenseCategories, typeRatings: u.typeRatings, jobTitle: u.jobTitle,
    preferredLanguage: u.preferredLanguage, marketingOptIn: u.marketingOptIn,
    dataProcessingConsentAt: u.dataProcessingConsentAt, createdAt: u.createdAt,
  } : null;
  const ords = await db.select().from(orders).where(eq(orders.userId, personId));
  const ordersOut: any[] = [];
  for (const o of ords) {
    const its = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    ordersOut.push({ ...o, items: its });
  }
  const logs = await db.select().from(accessLogs).where(eq(accessLogs.subjectPersonId, personId)).orderBy(desc(accessLogs.at));
  return {
    exportedAt: new Date().toISOString(),
    profile,
    affiliationsView: self.orgViews,
    credentials: self.privateCredentials,
    certificates: self.certificates,
    enrollments: self.enrollments,
    orders: ordersOut,
    accessLogs: logs,
  };
}
