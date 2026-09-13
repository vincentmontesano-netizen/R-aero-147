import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb, type DatabaseTransaction } from "./db";
import { courseMedia, copiedCourseMedia, legacyCourseMediaLinks, enrollments, trainingVersions, type User } from "../drizzle/schema";
import { requireAuthorCourse } from "./makerAccess";
import { requireEnrollment } from "./learningAccess";
import { storagePut } from "./storage";

type Actor = { id: number; role: string };
export async function saveCourseMedia(actor: Actor, trainingId: number, bytes: Buffer, contentType: string, origin: "generated" | "uploaded" = "generated", executor?: DatabaseTransaction) {
  await requireAuthorCourse(actor, trainingId);
  if (!bytes.length || bytes.length > 50 * 1024 * 1024) throw new TRPCError({ code: origin === "uploaded" ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR", message: "Média vide ou supérieur à 50 Mo." });
  const png = contentType === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = contentType === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const mp3 = contentType === "audio/mpeg" && (bytes.subarray(0, 3).toString() === "ID3" || (bytes[0] === 255 && (bytes[1] & 0xe0) === 0xe0));
  const pdf = contentType === "application/pdf" && bytes.subarray(0, 5).toString() === "%PDF-";
  const mp4 = contentType === "video/mp4" && bytes.length >= 16 && bytes.subarray(4, 8).toString() === "ftyp" && bytes.readUInt32BE(0) >= 16 && bytes.readUInt32BE(0) <= bytes.length && ["isom", "iso2", "iso6", "mp41", "mp42", "avc1", "M4V ", "dash"].includes(bytes.subarray(8, 12).toString());
  if (!png && !jpeg && !mp3 && !pdf && !mp4) throw new TRPCError({ code: origin === "uploaded" ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR", message: "Format de média non reconnu." });
  const ext = png ? "png" : jpeg ? "jpg" : mp3 ? "mp3" : pdf ? "pdf" : "mp4";
  const stored = await storagePut(`course-media/${trainingId}/${randomUUID()}.${ext}`, bytes, contentType);
  const db = (await getDb())!;
  const [record] = await (executor ?? db).insert(courseMedia).values({ origin, trainingId, createdBy: actor.id, storageKey: stored.key, contentType, byteSize: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }).returning();
  return { url: stored.url, mediaId: record.id };
}

export function mediaUrls(value: unknown): string[] {
  if (typeof value === "string") return value.match(/\/storage\/(?:course-media|courses)\/[A-Za-z0-9/_.-]+/g) ?? [];
  if (Array.isArray(value)) return value.flatMap(mediaUrls);
  if (value && typeof value === "object") return Object.values(value).flatMap(mediaUrls);
  return [];
}

/** Publication cannot accidentally reference a private asset belonging to another course. */
export async function validateCourseMediaReferences(trainingId: number, content: unknown) {
  const keys = Array.from(new Set(mediaUrls(content).map(url => url.slice("/storage/".length))));
  if (!keys.length) return;
  const db = (await getDb())!;
  const records = await db.select({ key: courseMedia.storageKey }).from(courseMedia).where(and(eq(courseMedia.trainingId, trainingId), inArray(courseMedia.storageKey, keys)));
  const legacy = await db.select({ key: legacyCourseMediaLinks.storageKey }).from(legacyCourseMediaLinks).where(and(eq(legacyCourseMediaLinks.trainingId, trainingId), inArray(legacyCourseMediaLinks.storageKey, keys)));
  const copied = await db.select({key:copiedCourseMedia.storageKey}).from(copiedCourseMedia).where(and(eq(copiedCourseMedia.trainingId,trainingId),inArray(copiedCourseMedia.storageKey,keys)));
  if (new Set([...records,...legacy,...copied].map(r=>r.key)).size !== keys.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Un média privé est introuvable ou appartient à une autre formation." });
}

export async function canReadCourseMedia(key: string, actor: User) {
  const db = (await getDb())!;
  const media = key.startsWith("courses/")
    ? await db.select({ trainingId: legacyCourseMediaLinks.trainingId }).from(legacyCourseMediaLinks).where(eq(legacyCourseMediaLinks.storageKey, key))
    : await db.select({ trainingId: courseMedia.trainingId }).from(courseMedia).where(eq(courseMedia.storageKey, key));
  const copied = await db.select({trainingId:copiedCourseMedia.trainingId}).from(copiedCourseMedia).where(eq(copiedCourseMedia.storageKey,key));
  media.push(...copied);
  for (const link of media) {
    try { await requireAuthorCourse(actor, link.trainingId, true); return true; }
    catch (error) { if (!(error instanceof TRPCError)) throw error; }
  }
  const ids = media.map(m => m.trainingId);
  if (!ids.length) return false;
  const records = await db.select({ enrollment: enrollments, snapshot: trainingVersions.snapshot }).from(enrollments)
    .innerJoin(trainingVersions, eq(trainingVersions.id, enrollments.trainingVersionId))
    .where(and(eq(enrollments.userId, actor.id), inArray(enrollments.trainingId, ids)));
  for (const record of records) {
    if (!mediaUrls(record.snapshot).includes(`/storage/${key}`)) continue;
    try { await requireEnrollment(actor.id, record.enrollment.id); return true; }
    catch (error) { if (!(error instanceof TRPCError) || error.code !== "FORBIDDEN") throw error; }
  }
  return false;
}

export async function verifyCourseMediaBytes(key: string, bytes: Buffer) {
  const db = (await getDb())!;
  const [media] = await db.select().from(courseMedia).where(eq(courseMedia.storageKey, key));
  return !!media && bytes.length === media.byteSize && createHash("sha256").update(bytes).digest("hex") === media.sha256;
}

export async function uploadCourseMedia(actor: Actor, trainingId: number, base64: string, contentType: string) {
  await requireAuthorCourse(actor, trainingId);
  // Keep the encoded request comfortably below the existing 50 MiB JSON limit.
  if (!base64.length || base64.length > 34952536 || base64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(base64)) throw new TRPCError({ code: "BAD_REQUEST", message: "Fichier encodé invalide ou supérieur à 25 Mo." });
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > 25 * 1024 * 1024 || bytes.toString("base64") !== base64) throw new TRPCError({ code: "BAD_REQUEST", message: "Fichier encodé invalide ou supérieur à 25 Mo." });
  return saveCourseMedia(actor, trainingId, bytes, contentType, "uploaded");
}
