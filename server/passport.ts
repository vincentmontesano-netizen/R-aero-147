import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { and, desc, eq, isNull, isNotNull, sql, lt } from "drizzle-orm";
import { getDb } from "./db";
import { passportDocuments, passportEvents, users } from "../drizzle/schema";
import { storagePut } from "./storage";
export type PassportKind = "ID" | "PASSPORT" | "DIPLOMA" | "CERTIFICATE" | "LICENSE" | "RATING" | "LOGBOOK" | "EXPERIENCE" | "OTHER";
export async function getPassportDocuments(personId: number, archived = false) {
  const db = (await getDb())!;
  const [person] = await db.select({ status: users.status }).from(users).where(eq(users.id, personId));
  if (person?.status !== 'active') throw new TRPCError({ code: 'FORBIDDEN' });
  return db.select().from(passportDocuments).where(and(eq(passportDocuments.personId, personId), archived ? isNotNull(passportDocuments.archivedAt) : isNull(passportDocuments.archivedAt))).orderBy(desc(passportDocuments.createdAt));
}
export async function getPassportHistory(personId: number) {
  return (await getPassportHistoryPage(personId)).entries;
}
export async function getPassportHistoryPage(personId: number, beforeId?: number) {
  if (beforeId !== undefined && (!Number.isSafeInteger(beforeId) || beforeId <= 0)) throw new TRPCError({ code: 'BAD_REQUEST' });
  const db = (await getDb())!;
  const [person] = await db.select({ status: users.status }).from(users).where(eq(users.id, personId));
  if (person?.status !== 'active') throw new TRPCError({ code: 'FORBIDDEN' });
  const rows = await db.select().from(passportEvents).where(and(eq(passportEvents.personId, personId), beforeId !== undefined ? lt(passportEvents.id, beforeId) : undefined)).orderBy(desc(passportEvents.id)).limit(101);
  const entries = rows.slice(0, 100);
  return { entries, nextCursor: rows.length > 100 ? entries[entries.length - 1].id : null };
}
export function validatePassportFile(input: { contentType: string; dataBase64: string }) {
  if (!input.dataBase64 || input.dataBase64.length > 13981016 || (input.dataBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.dataBase64))) throw new Error("Fichier encodé invalide ou supérieur à 10 Mo.");
  const buffer = Buffer.from(input.dataBase64, "base64");
  if (buffer.toString("base64") !== input.dataBase64) throw new Error("Encodage du fichier invalide.");
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw new Error("La taille du fichier doit être comprise entre 1 octet et 10 Mo.");
  const valid = input.contentType === "application/pdf" ? buffer.subarray(0, 5).toString() === "%PDF-" : input.contentType === "image/png" ? buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : input.contentType === "image/jpeg" && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (!valid) throw new Error("Formats acceptés : PDF, PNG, JPEG. Le contenu doit correspondre au format déclaré.");
  return buffer;
}
export async function createPassportDocument(input: {
  personId: number; kind: PassportKind; title: string; issuer?: string | null; reference?: string | null; country?: string | null;
  issuedAt?: Date | null; expiresAt?: Date | null; fileName: string; contentType: string; dataBase64: string; requestId?: string;
}) {
  const db = (await getDb())!;
  if (input.requestId !== undefined && !z.string().uuid().safeParse(input.requestId).success) throw new TRPCError({ code: 'BAD_REQUEST' });
  const requestId = input.requestId?.toLowerCase();
  const buffer = validatePassportFile(input);
  if ([input.issuedAt, input.expiresAt].some(d => d && !Number.isFinite(d.getTime())) || (input.issuedAt && input.expiresAt && input.expiresAt < input.issuedAt)) throw new Error("Dates du document incohérentes.");
  const metadata = { kind: input.kind, title: input.title.trim(), issuer: input.issuer ?? null, reference: input.reference ?? null, country: input.country ?? null, issuedAt: input.issuedAt ?? null, expiresAt: input.expiresAt ?? null, fileName: input.fileName, contentType: input.contentType, fileSize: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') };
  const ext = input.contentType === "application/pdf" ? "pdf" : input.contentType === "image/png" ? "png" : "jpg";
  return db.transaction(async tx => {
    const [person] = await tx.select({ status: users.status }).from(users).where(eq(users.id, input.personId)).for('share');
    if (person?.status !== 'active') throw new TRPCError({ code: 'FORBIDDEN' });
    if (requestId) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`passport-upload:${input.personId}:${requestId}`}))`);
      const [existing] = await tx.select().from(passportDocuments).where(and(eq(passportDocuments.personId, input.personId), eq(passportDocuments.requestId, requestId)));
      if (existing) {
        const matches = Object.entries(metadata).every(([key, value]) => {
          const previous = existing[key as keyof typeof metadata];
          return (value instanceof Date ? value.getTime() : value) === (previous instanceof Date ? previous.getTime() : previous);
        });
        if (!matches) throw new TRPCError({ code: 'CONFLICT', message: 'Cette demande correspond déjà à un autre document.' });
        return existing;
      }
    }
    const file = await storagePut(`passport/${input.personId}/document.${ext}`, buffer, input.contentType);
    const [document] = await tx.insert(passportDocuments).values({ ...metadata, personId: input.personId, requestId, fileUrl: file.url }).returning();
    await tx.insert(passportEvents).values({ personId: input.personId, documentId: document.id, actorId: input.personId, action: "uploaded", data: { title: document.title, sha256: document.sha256, fileSize: document.fileSize } });
    return document;
  });
}
/** Compatibility endpoint: deletion now archives evidence, never removes it. */
export async function deletePassportDocument(id: number, personId: number): Promise<{ ok: boolean }> {
  const db = (await getDb())!;
  return db.transaction(async tx => {
    const [person] = await tx.select({ status: users.status }).from(users).where(eq(users.id, personId)).for('share');
    if (person?.status !== 'active') throw new TRPCError({ code: 'FORBIDDEN' });
    const [document] = await tx.select().from(passportDocuments).where(and(eq(passportDocuments.id, id), eq(passportDocuments.personId, personId))).for("update");
    if (!document) return { ok: false };
    if (document.archivedAt) return { ok: true };
    const archivedAt = new Date();
    await tx.update(passportDocuments).set({ archivedAt }).where(eq(passportDocuments.id, id));
    await tx.insert(passportEvents).values({ personId, documentId: id, actorId: personId, action: "archived", data: { title: document.title, archivedAt: archivedAt.toISOString(), sha256: document.sha256 } });
    return { ok: true };
  });
}
export async function setPassportSharing(personId: number, enabled: boolean): Promise<{ ok: boolean }> {
  const db = (await getDb())!;
  return db.transaction(async tx => {
    const [person] = await tx.select().from(users).where(eq(users.id, personId)).for("update");
    if (person?.status !== "active") throw new TRPCError({ code: "FORBIDDEN" });
    if (!!person.passportShared === enabled) return { ok: true };
    await tx.update(users).set({ passportShared: enabled }).where(eq(users.id, personId));
    await tx.insert(passportEvents).values({ personId, actorId: personId, action: "sharing_changed", data: { before: !!person.passportShared, after: enabled } });
    return { ok: true };
  });
}
