import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNull, isNotNull, lt, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "./db";
import { users, affiliations, companies, verificationCases as cases, verificationDocuments as documents, verificationEvents as events, type User } from "../drizzle/schema";
import { storagePut } from "./storage";
import { adminProcedure, protectedProcedure, router } from "./_core/trpc";

type Actor = Pick<User, "id" | "role" | "status">;
type Case = typeof cases.$inferSelect;
const fail = (message: string, code: "FORBIDDEN" | "BAD_REQUEST" | "CONFLICT" = "FORBIDDEN"): never => { throw new TRPCError({ code, message }); };
async function database() { const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." }); return db; }
async function currentVerificationActor(identity: Pick<Actor, 'id'>): Promise<Actor> {
  const db = await database();
  const [actor] = await db.select({ id: users.id, role: users.role, status: users.status }).from(users).where(eq(users.id, identity.id));
  if (!actor || actor.status !== 'active') fail('Compte inactif.');
  return actor;
}
async function manager(actor: Actor, companyId: number) {
  const db = await database();
  const org = (await db.select({ id: companies.id, status: companies.status }).from(companies).where(eq(companies.id, companyId)).limit(1))[0];
  const membership = (await db.select().from(affiliations).where(and(eq(affiliations.personId, actor.id), eq(affiliations.orgId, companyId), eq(affiliations.role, "MANAGER"), eq(affiliations.status, "ACTIVE"))).limit(1))[0];
  if (!org || org.status !== "ACTIVE" || !membership) fail("Une affiliation active de responsable est requise.");
}
export async function assertVerificationAccess(actor: Actor, record: Case, allowAdmin = true) {
  actor = await currentVerificationActor(actor);
  if (allowAdmin && actor.role === "admin") return;
  if (record.kind === "kyc") { if (record.personId !== actor.id) fail("Dossier inaccessible."); }
  else { if (!record.companyId) fail("Dossier inaccessible."); await manager(actor, record.companyId!); }
}
const editable = (record: Case) => { if (!["draft", "needs_information", "rejected"].includes(record.status)) fail("Ce dossier est verrouillé pendant ou après son examen.", "CONFLICT"); };
const form = z.object({
  expectedRevision: z.number().int().min(0).max(2147483647).nullable().optional(),
  kind: z.enum(["kyc", "kyb"]), companyId: z.number().int().positive().optional(),
  legalName: z.string().trim().min(2).max(255), country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  registrationNumber: z.string().trim().max(128).optional(), address: z.string().trim().min(5).max(2000),
}).superRefine((v, ctx) => { if (v.kind === "kyb" && (!v.companyId || !v.registrationNumber)) ctx.addIssue({ code: "custom", message: "Société et numéro d’immatriculation requis." }); });

export async function saveVerification(actor: Actor, input: z.infer<typeof form>) {
  actor = await currentVerificationActor(actor);
  if (input.kind === "kyb") await manager(actor, input.companyId!);
  const db = await database();
  const subjectKey = `${input.kind}:${input.kind === "kyc" ? actor.id : input.companyId}`;
  return db.transaction(async tx => {
    // A transaction-scoped lock serializes creation as well as edits of one subject.
    await tx.execute((await import("drizzle-orm")).sql`select pg_advisory_xact_lock(hashtext(${subjectKey}))`);
    const existing = (await tx.select().from(cases).where(eq(cases.subjectKey, subjectKey)).for("update").limit(1))[0];
    if (existing) { await assertVerificationAccess(actor, existing, false); editable(existing); }
    if (input.expectedRevision !== undefined && (existing ? input.expectedRevision !== existing.revision : input.expectedRevision !== null)) fail("Ce dossier a changé depuis son ouverture. Votre brouillon n’a pas été enregistré.", "CONFLICT");
    const values = { legalName: input.legalName, country: input.country, address: input.address, registrationNumber: input.kind === "kyb" ? input.registrationNumber : null, status: "draft" };
    const [record] = existing ? await tx.update(cases).set(values).where(eq(cases.id, existing.id)).returning() : await tx.insert(cases).values({ ...values, subjectKey, kind: input.kind, personId: actor.id, companyId: input.kind === "kyb" ? input.companyId : null }).returning();
    await tx.insert(events).values({ caseId: record.id, actorId: actor.id, action: existing ? "updated" : "created", previous: existing ?? null, current: record });
    return record;
  });
}
export function validateVerificationFile(input: { contentType: string; dataBase64: string }) {
  if (!input.dataBase64 || input.dataBase64.length > 4 * Math.ceil(8 * 1024 * 1024 / 3) || input.dataBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.dataBase64)) fail("Fichier encodé invalide ou supérieur à 8 Mo.", "BAD_REQUEST");
  const buffer = Buffer.from(input.dataBase64, "base64");
  if (buffer.toString("base64") !== input.dataBase64) fail("Encodage du fichier invalide.", "BAD_REQUEST");
  if (!buffer.length || buffer.length > 8 * 1024 * 1024) fail("Le fichier doit être non vide et faire au maximum 8 Mo.", "BAD_REQUEST");
  const valid = input.contentType === "application/pdf" ? buffer.subarray(0, 5).toString() === "%PDF-" : input.contentType === "image/png" ? buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : input.contentType === "image/jpeg" && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (!valid) fail("Formats acceptés : PDF, JPEG et PNG. Le contenu doit correspondre au format.", "BAD_REQUEST");
  return buffer;
}
export async function addVerificationDocument(actor: Actor, input: { caseId: number; kind: string; fileName: string; contentType: string; dataBase64: string; requestId?: string }) {
  const requestId = input.requestId?.toLowerCase();
  if (requestId !== undefined && !z.string().uuid().safeParse(requestId).success) fail("Identifiant de dépôt invalide.", "BAD_REQUEST");
  const buffer = validateVerificationFile(input);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const db = await database();
  return db.transaction(async tx => {
    const record = (await tx.select().from(cases).where(eq(cases.id, input.caseId)).for("update").limit(1))[0];
    if (!record) fail("Dossier inaccessible.");
    await assertVerificationAccess(actor, record, false);
    if (requestId) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`verification-upload:${actor.id}:${requestId}`}))`);
      const [existing] = await tx.select().from(documents).where(and(eq(documents.uploadedBy, actor.id), eq(documents.requestId, requestId)));
      if (existing) {
        if (existing.caseId !== input.caseId || existing.kind !== input.kind || existing.fileName !== input.fileName || existing.contentType !== input.contentType || existing.sha256 !== sha256) fail("Cette demande correspond à un autre dépôt.", "CONFLICT");
        return existing;
      }
    }
    editable(record);
    if (!(record.kind === "kyc" ? ["identity", "supporting"] : ["registration", "authority", "supporting"]).includes(input.kind)) fail("Type de pièce incompatible.", "BAD_REQUEST");
    const ext = input.contentType === "application/pdf" ? "pdf" : input.contentType === "image/png" ? "png" : "jpg";
    const file = await storagePut(`verification/${record.id}/document.${ext}`, buffer, input.contentType);
    const [document] = await tx.insert(documents).values({ caseId: record.id, kind: input.kind, fileName: input.fileName, contentType: input.contentType, uploadedBy: actor.id, requestId, sha256, fileUrl: file.url }).returning();
    await tx.update(cases).set({updatedAt:new Date()}).where(eq(cases.id,record.id));
    await tx.insert(events).values({ caseId: record.id, actorId: actor.id, action: "document_added", current: { documentId: document.id, kind: document.kind } });
    return document;
  });
}
export async function changeVerificationStatus(actor: Actor, caseId: number, status: "submitted" | "approved" | "rejected" | "needs_information", note?: string, expectedRevision?: number) {
  actor = await currentVerificationActor(actor);
  const db = await database();
  return db.transaction(async tx => {
    const record = (await tx.select().from(cases).where(eq(cases.id, caseId)).for("update").limit(1))[0];
    if (!record) fail("Dossier inaccessible.");
    if (status === "submitted") {
      await assertVerificationAccess(actor, record, false); editable(record);
      const files = await tx.select().from(documents).where(and(eq(documents.caseId, caseId), isNull(documents.archivedAt)));
      const required = record.kind === "kyc" ? ["identity"] : ["registration", "authority"];
      if (required.some(kind => !files.some(f => f.kind === kind))) fail("Ajoutez les pièces requises avant l’envoi.", "BAD_REQUEST");
    } else {
      if (actor.status !== "active" || actor.role !== "admin" || actor.id === record.personId) fail("Un autre administrateur doit examiner ce dossier.");
      const contributed = await tx.select({ id: events.id }).from(events).where(and(eq(events.caseId, caseId), eq(events.actorId, actor.id), inArray(events.action, ["created", "updated", "document_added", "submitted"]))).limit(1);
      const affiliated = record.companyId ? await tx.select({ id: affiliations.id }).from(affiliations).where(and(eq(affiliations.orgId, record.companyId), eq(affiliations.personId, actor.id), eq(affiliations.status, "ACTIVE"))).limit(1) : [];
      if (contributed.length || affiliated.length) fail("La revue exige un administrateur indépendant du dossier et de la compagnie.");
      if (record.status !== "submitted") fail("Ce dossier n’est pas en attente de décision.", "CONFLICT");
      if (!note?.trim()) fail("Une justification est requise.", "BAD_REQUEST");
    }
    if (expectedRevision !== undefined && record.revision !== expectedRevision) fail("Ce dossier a changé depuis sa consultation. Rechargez-le avant de confirmer cette action.", "CONFLICT");
    const [updated] = await tx.update(cases).set({ status, ...(status === "submitted" ? { submittedAt: new Date() } : { reviewNote: note!.trim(), reviewedBy: actor.id, reviewedAt: new Date() }) }).where(eq(cases.id, caseId)).returning();
    await tx.insert(events).values({ caseId, actorId: actor.id, action: status, previous: record, current: updated });
    return updated;
  });
}
export async function readVerification(actor: Actor, id: number) {
  const db = await database();
  const record = (await db.select().from(cases).where(eq(cases.id, id)).limit(1))[0];
  if (!record) fail("Dossier inaccessible.");
  await assertVerificationAccess(actor, record);
  return record;
}
export async function readVerificationHistory(actor: Actor, id: number, beforeId?: number) {
  const db = await database();
  const [record] = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
  if (!record) fail("Dossier inaccessible.");
  await assertVerificationAccess(actor, record);
  const rows = await db.select({ id: events.id, actorId: events.actorId, action: events.action, createdAt: events.createdAt,
    reviewNote: sql<string | null>`case when ${events.action} in ('approved','rejected','needs_information') then ${events.current}->>'reviewNote' else null end`,
  }).from(events).where(and(eq(events.caseId, id), beforeId === undefined ? undefined : lt(events.id, beforeId))).orderBy(desc(events.id)).limit(51);
  const entries = rows.slice(0, 50);
  return { entries, nextCursor: rows.length > 50 ? entries[entries.length - 1].id : null };
}
export async function readVerificationDocuments(actor: Actor, id: number, archived = false, beforeId?: number) {
  const db = await database();
  const [record] = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
  if (!record) fail("Dossier inaccessible.");
  await assertVerificationAccess(actor, record);
  const rows = await db.select({id:documents.id,kind:documents.kind,fileName:documents.fileName,contentType:documents.contentType,createdAt:documents.createdAt,archivedAt:documents.archivedAt,
    fileUrl:sql<string|null>`case when ${documents.archivedAt} is null then ${documents.fileUrl} else null end`,
  }).from(documents).where(and(eq(documents.caseId,id),archived?isNotNull(documents.archivedAt):isNull(documents.archivedAt),beforeId===undefined?undefined:lt(documents.id,beforeId))).orderBy(desc(documents.id)).limit(51);
  const entries=rows.slice(0,50);
  return {entries,nextCursor:rows.length>50?entries[entries.length-1].id:null};
}
export const verificationRouter = router({
  mine: protectedProcedure.query(async ({ ctx }) => {
    await currentVerificationActor(ctx.user);
    const db = await database();
    const orgs = await db.select({orgId:affiliations.orgId}).from(affiliations).innerJoin(companies,eq(companies.id,affiliations.orgId)).where(and(eq(companies.status,"ACTIVE"),eq(affiliations.personId, ctx.user.id), eq(affiliations.role, "MANAGER"), eq(affiliations.status, "ACTIVE")));
    return db.select({id:cases.id,kind:cases.kind,legalName:cases.legalName,status:cases.status}).from(cases).where(or(and(eq(cases.kind, "kyc"), eq(cases.personId, ctx.user.id)), orgs.length ? and(eq(cases.kind,"kyb"),inArray(cases.companyId, orgs.map(o => o.orgId))) : undefined)).orderBy(desc(cases.id)).limit(200);
  }),
  minePage: protectedProcedure.input(z.object({beforeId:z.number().int().positive().max(2147483647).optional()}).optional()).query(async ({ ctx, input }) => {
    await currentVerificationActor(ctx.user);
    const db = await database();
    const orgs = await db.select({orgId:affiliations.orgId}).from(affiliations).innerJoin(companies,eq(companies.id,affiliations.orgId)).where(and(eq(companies.status,"ACTIVE"),eq(affiliations.personId, ctx.user.id), eq(affiliations.role, "MANAGER"), eq(affiliations.status, "ACTIVE")));
    const rows=await db.select({id:cases.id,kind:cases.kind,legalName:cases.legalName,status:cases.status}).from(cases).where(and(
      or(and(eq(cases.kind,"kyc"),eq(cases.personId,ctx.user.id)),orgs.length?and(eq(cases.kind,"kyb"),inArray(cases.companyId,orgs.map(o=>o.orgId))):undefined),
      input?.beforeId===undefined?undefined:lt(cases.id,input.beforeId)
    )).orderBy(desc(cases.id)).limit(51);
    const entries=rows.slice(0,50);
    return {entries,nextCursor:rows.length>50?entries[entries.length-1].id:null};
  }),
  documentsPage: protectedProcedure.input(z.object({id:z.number().int().positive(),archived:z.boolean().default(false),beforeId:z.number().int().positive().max(2147483647).optional()})).query(({ctx,input})=>readVerificationDocuments(ctx.user,input.id,input.archived,input.beforeId)),
  history: protectedProcedure.input(z.object({ id: z.number().int().positive(), beforeId: z.number().int().positive().max(2147483647).optional() })).query(({ctx,input}) => readVerificationHistory(ctx.user,input.id,input.beforeId)),
  detail: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ ctx, input }) => readVerification(ctx.user, input.id)),
  save: protectedProcedure.input(form).mutation(({ ctx, input }) => saveVerification(ctx.user, input)),
  upload: protectedProcedure.input(z.object({ caseId: z.number().int().positive(), kind: z.enum(["identity", "registration", "authority", "supporting"]), fileName: z.string().min(1).max(255), contentType: z.enum(["application/pdf", "image/png", "image/jpeg"]), dataBase64: z.string().max(11200000), requestId: z.string().uuid().optional() })).mutation(({ ctx, input }) => addVerificationDocument(ctx.user, input)),
  archiveDocument: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await database();
    return db.transaction(async tx => {
      const doc = (await tx.select().from(documents).where(eq(documents.id, input.id)).limit(1))[0];
      if (!doc) fail("Pièce inaccessible.");
      const record = (await tx.select().from(cases).where(eq(cases.id, doc.caseId)).for("update").limit(1))[0];
      if (!record) fail("Dossier inaccessible.");
      await assertVerificationAccess(ctx.user, record, false); editable(record);
      const [currentDocument]=await tx.select().from(documents).where(eq(documents.id,doc.id));
      if (!currentDocument.archivedAt) {
        await tx.update(documents).set({ archivedAt: new Date() }).where(eq(documents.id, doc.id));
        await tx.update(cases).set({updatedAt:new Date()}).where(eq(cases.id,record.id));
        await tx.insert(events).values({ caseId: record.id, actorId: ctx.user.id, action: "document_archived", current: { documentId: doc.id } });
      }
      return { ok: true };
    });
  }),
  submit: protectedProcedure.input(z.object({ id: z.number().int().positive(), expectedRevision:z.number().int().min(0).max(2147483647).optional() })).mutation(({ ctx, input }) => changeVerificationStatus(ctx.user, input.id, "submitted", undefined, input.expectedRevision)),
  queue: adminProcedure.query(async ({ ctx }) => {
    const actor = await currentVerificationActor(ctx.user);
    if (actor.role !== 'admin') fail('Accès administrateur requis.');
    return (await database()).select({id:cases.id,kind:cases.kind,legalName:cases.legalName,status:cases.status}).from(cases).orderBy(desc(cases.id)).limit(200);
  }),
  queuePage: adminProcedure.input(z.object({
    beforeId: z.number().int().positive().max(2147483647).optional(),
    status: z.enum(["draft", "submitted", "needs_information", "approved", "rejected"]).optional(),
  }).optional()).query(async ({ ctx, input }) => {
    const actor = await currentVerificationActor(ctx.user);
    if (actor.role !== 'admin') fail('Accès administrateur requis.');
    const rows = await (await database()).select({ id: cases.id, kind: cases.kind, legalName: cases.legalName, status: cases.status }).from(cases)
      .where(and(input?.beforeId !== undefined ? lt(cases.id, input.beforeId) : undefined, input?.status ? eq(cases.status, input.status) : undefined))
      .orderBy(desc(cases.id)).limit(51);
    const entries = rows.slice(0, 50);
    return { entries, nextCursor: rows.length > 50 ? entries[entries.length - 1].id : null };
  }),
  review: adminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected", "needs_information"]), expectedRevision:z.number().int().min(0).max(2147483647).optional(), note: z.string().trim().min(5).max(4000) })).mutation(({ ctx, input }) => changeVerificationStatus(ctx.user, input.id, input.status, input.note, input.expectedRevision)),
});
