import { createHash } from "node:crypto";
import { and, desc, eq, inArray, sql, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { operatorApproval as approval, approvalDocuments as documents, approvalFindings as findings, approvalEvents as events, users } from "../drizzle/schema";
import { storagePut } from "./storage";
import { validateVerificationFile } from "./verification";

async function dbReady() { const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." }); return db; }
function reject(message: string) { throw new TRPCError({ code: "BAD_REQUEST", message }); }
const profile = z.object({
  expectedRevision:z.number().int().min(0).max(2147483647).nullable().optional(),
  legalName: z.string().trim().min(2).max(255), authority: z.string().trim().min(2).max(255), reference: z.string().trim().max(128).optional(),
  scope: z.string().trim().min(5).max(20000), locations: z.string().trim().min(5).max(10000),
  accountableManagerId: z.number().int().positive(), trainingManagerId: z.number().int().positive(), qualityManagerId: z.number().int().positive(),
}).refine(v => v.trainingManagerId !== v.qualityManagerId, { message: "Le responsable formation et le responsable qualité doivent être distincts." });
const approvalAdminProcedure=adminProcedure.use(async({ctx,next})=>{
  const db=await dbReady();
  const [actor]=await db.select().from(users).where(eq(users.id,ctx.user.id));
  if(!actor||actor.status!=='active'||actor.role!=='admin')throw new TRPCError({code:'FORBIDDEN'});
  return next({ctx:{...ctx,user:actor}});
});
export const approvalRouter = router({
  overview: approvalAdminProcedure.query(async () => {
    const db = await dbReady();
    return { profile: (await db.select().from(approval).where(eq(approval.id, 1)))[0] ?? null,
      documents: await db.select().from(documents).orderBy(desc(documents.createdAt)),
      findings: await db.select().from(findings).orderBy(desc(findings.createdAt)),
      events: await db.select().from(events).orderBy(desc(events.createdAt)).limit(200),
      staff: await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(eq(users.status, "active")),
    };
  }),
  historyPage: approvalAdminProcedure.input(z.object({beforeId:z.number().int().positive().max(2147483647).optional()}).optional()).query(async({input})=>{
    const rows=await (await dbReady()).select().from(events).where(input?.beforeId===undefined?undefined:lt(events.id,input.beforeId)).orderBy(desc(events.id)).limit(51);
    const entries=rows.slice(0,50);
    return {entries,nextCursor:rows.length>50?entries[entries.length-1].id:null};
  }),
  saveProfile: approvalAdminProcedure.input(profile).mutation(async ({ ctx, input }) => {
    const db = await dbReady();
    const {expectedRevision,...values}=input;
    return db.transaction(async tx => {
      await tx.execute((await import("drizzle-orm")).sql`select pg_advisory_xact_lock(hashtext('operator-approval'))`);
      const before = (await tx.select().from(approval).where(eq(approval.id, 1)).for("update"))[0];
      if(expectedRevision!==undefined&&(before?expectedRevision!==before.revision:expectedRevision!==null))throw new TRPCError({code:'CONFLICT',message:'Le dossier organisme a changé. Votre brouillon n’a pas été enregistré.'});
      const ids = Array.from(new Set([input.accountableManagerId, input.trainingManagerId, input.qualityManagerId]));
      const staff = await tx.select().from(users).where(and(inArray(users.id, ids), eq(users.status, "active")));
      if (staff.length !== ids.length) reject("Les responsables doivent être des utilisateurs actifs.");
      // Changing scope or nominated people requires a new review of the recorded approval.
      const [result] = await tx.insert(approval).values({ ...values, id: 1, status: "preparation" }).onConflictDoUpdate({ target: approval.id, set: { ...values, status: "preparation", approvalDocumentId: null, mtoeDocumentId: null, updatedAt: new Date() } }).returning();
      await tx.insert(events).values({ actorId: ctx.user.id, action: "profile_saved", entityId: 1, previous: before ?? null, current: result });
      return result;
    });
  }),
  setStatus: approvalAdminProcedure.input(z.object({ expectedRevision:z.number().int().min(0).max(2147483647).optional(), status: z.enum(["preparation", "submitted", "approved", "suspended", "withdrawn"]), reason: z.string().trim().min(5).max(4000), approvalDocumentId: z.number().int().positive().optional(), mtoeDocumentId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
    const db = await dbReady();
    return db.transaction(async tx => {
      const before = (await tx.select().from(approval).where(eq(approval.id, 1)).for("update"))[0];
      if (!before) reject("Enregistrez d’abord le dossier organisme.");
      if(input.expectedRevision!==undefined&&before.revision!==input.expectedRevision)throw new TRPCError({code:'CONFLICT',message:'Le dossier organisme a changé. Consultez sa version actuelle avant d’enregistrer cette décision.'});
      if (input.status === "approved") {
        const files = await tx.select().from(documents).where(inArray(documents.kind, ["approval", "mtoe"]));
        if (!before.reference || !files.some(f => f.kind === "approval" && f.id === input.approvalDocumentId) || !files.some(f => f.kind === "mtoe" && f.id === input.mtoeDocumentId)) reject("La référence, la décision de l’autorité et le MTOE sont requis.");
        const nominated = Array.from(new Set([before.accountableManagerId, before.trainingManagerId, before.qualityManagerId]));
        const active = await tx.select({ id: users.id }).from(users).where(and(inArray(users.id, nominated), eq(users.status, "active")));
        if (active.length !== nominated.length) reject("Les responsables désignés doivent être actifs avant cet enregistrement.");
        if (before.trainingManagerId === before.qualityManagerId) reject("Les responsabilités formation et qualité doivent être indépendantes.");
      }
      const [result] = await tx.update(approval).set({ status: input.status, ...(input.status === "approved" ? { approvalDocumentId: input.approvalDocumentId, mtoeDocumentId: input.mtoeDocumentId } : {}) }).where(eq(approval.id, 1)).returning();
      await tx.insert(events).values({ actorId: ctx.user.id, action: "status_recorded", entityId: 1, previous: before, current: { ...result, reason: input.reason } });
      return result;
    });
  }),
  upload: approvalAdminProcedure.input(z.object({ requestId:z.string().uuid().transform(value=>value.toLowerCase()).optional(), kind: z.enum(["approval", "mtoe", "scope", "staff", "audit", "evidence"]), title: z.string().trim().min(2).max(255), revision: z.string().trim().min(1).max(64), fileName: z.string().min(1).max(255), contentType: z.enum(["application/pdf", "image/png", "image/jpeg"]), dataBase64: z.string().max(11200000) })).mutation(async ({ ctx, input }) => {
    const buffer = validateVerificationFile(input);
    const db = await dbReady();
    const actor=ctx.user;
    const fingerprint=createHash('sha256').update(JSON.stringify({kind:input.kind,title:input.title,revision:input.revision,fileName:input.fileName,contentType:input.contentType,sha256:createHash('sha256').update(buffer).digest('hex')})).digest('hex');
    return db.transaction(async tx => {
      if(input.requestId){
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`approval-upload:${actor.id}:${input.requestId}`}))`);
        const [prior]=await tx.select().from(documents).where(and(eq(documents.uploadedBy,actor.id),eq(documents.requestId,input.requestId)));
        if(prior){
          if(prior.fingerprint!==fingerprint)throw new TRPCError({code:'CONFLICT',message:'Cette demande correspond à un autre dépôt documentaire.'});
          return prior;
        }
      }
      const ext = input.contentType === "application/pdf" ? "pdf" : input.contentType === "image/png" ? "png" : "jpg";
      const file = await storagePut(`approval/${input.kind}/document.${ext}`, buffer, input.contentType);
      const [result] = await tx.insert(documents).values({ kind: input.kind, title: input.title, revision: input.revision, fileName: input.fileName, fileUrl: file.url, uploadedBy: actor.id, requestId:input.requestId, fingerprint }).returning();
      await tx.insert(events).values({ actorId: actor.id, action: "document_added", entityId: result.id, current: result });
      return result;
    });
  }),
  createFinding: approvalAdminProcedure.input(z.object({ title: z.string().trim().min(3).max(255), reference: z.string().trim().min(2).max(128), severity: z.enum(["level1", "level2", "observation"]), description: z.string().trim().min(10).max(10000), ownerId: z.number().int().positive(), dueAt: z.date() })).mutation(async ({ ctx, input }) => {
    const db = await dbReady();
    const owner = (await db.select().from(users).where(and(eq(users.id, input.ownerId), eq(users.status, "active"))).limit(1))[0];
    if (!owner) reject("Le responsable doit être un utilisateur actif.");
    return db.transaction(async tx => {
      const [result] = await tx.insert(findings).values(input).returning();
      await tx.insert(events).values({ actorId: ctx.user.id, action: "finding_opened", entityId: result.id, current: result });
      return result;
    });
  }),
  updateFinding: approvalAdminProcedure.input(z.object({ id: z.number().int().positive(), expectedRevision:z.number().int().min(0).max(2147483647).optional(), rootCause: z.string().trim().min(5).max(10000), correctiveAction: z.string().trim().min(5).max(10000), evidenceId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
    const db = await dbReady();
    return db.transaction(async tx => {
      const before = (await tx.select().from(findings).where(eq(findings.id, input.id)).for("update"))[0];
      if (!before || before.status === "closed") reject("Écart introuvable ou déjà clôturé.");
      if(input.expectedRevision!==undefined&&before.revision!==input.expectedRevision)throw new TRPCError({code:'CONFLICT',message:'Cet écart a changé depuis son ouverture. Rechargez-le avant de confirmer cette action.'});
      if (input.evidenceId && !(await tx.select().from(documents).where(and(eq(documents.id, input.evidenceId), inArray(documents.kind, ["evidence", "audit"]))).limit(1))[0]) reject("Justificatif introuvable.");
      const [result] = await tx.update(findings).set({ rootCause: input.rootCause, correctiveAction: input.correctiveAction, evidenceId: input.evidenceId ?? null, status: input.evidenceId ? "ready" : "in_progress" }).where(eq(findings.id, input.id)).returning();
      await tx.insert(events).values({ actorId: ctx.user.id, action: "finding_updated", entityId: input.id, previous: before, current: result });
      return result;
    });
  }),
  closeFinding: approvalAdminProcedure.input(z.object({ id: z.number().int().positive(), expectedRevision:z.number().int().min(0).max(2147483647).optional(), note: z.string().trim().min(5).max(4000) })).mutation(async ({ ctx, input }) => {
    const db = await dbReady();
    return db.transaction(async tx => {
      const before = (await tx.select().from(findings).where(eq(findings.id, input.id)).for("update"))[0];
      if (!before || before.status !== "ready" || !before.evidenceId) reject("Un plan d’action et une preuve sont requis avant clôture.");
      if(input.expectedRevision!==undefined&&before.revision!==input.expectedRevision)throw new TRPCError({code:'CONFLICT',message:'Cet écart a changé depuis son ouverture. Rechargez-le avant de confirmer cette action.'});
      if (before.ownerId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "La clôture exige un autre administrateur que le responsable de l’action." });
      const contributed = await tx.select({ id: events.id }).from(events).where(and(eq(events.entityId, input.id), eq(events.action, "finding_updated"), eq(events.actorId, ctx.user.id))).limit(1);
      if (contributed.length) throw new TRPCError({ code: "FORBIDDEN", message: "La clôture exige un administrateur indépendant du plan d’action." });
      const [result] = await tx.update(findings).set({ status: "closed", closureNote: input.note, closedBy: ctx.user.id, closedAt: new Date() }).where(eq(findings.id, input.id)).returning();
      await tx.insert(events).values({ actorId: ctx.user.id, action: "finding_closed", entityId: input.id, previous: before, current: result });
      return result;
    });
  }),
});
