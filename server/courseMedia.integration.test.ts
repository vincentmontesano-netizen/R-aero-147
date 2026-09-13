import { storagePut } from "./storage";
import { readFile } from "node:fs/promises";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb, updateTraining } from "./db";
import { users, companies, affiliations, trainings, slides, enrollments, courseMedia, legacyCourseMediaLinks } from "../drizzle/schema";
import { saveCourseMedia, verifyCourseMediaBytes, validateCourseMediaReferences, uploadCourseMedia } from "./courseMedia";
import { canReadPrivateFile } from "./storageAccess";
vi.mock("./storage", () => ({ storagePut: vi.fn(async (key: string) => ({ key, url: `/storage/${key}` })) }));
const url = process.env.RAERO_TEST_DATABASE_URL;
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
describe.skipIf(!url)("private course media · PostgreSQL", () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  async function fixture() {
    const db = (await getDb())!;
    const [owner, learner, stranger, otherAuthor] = await db.insert(users).values([
      { openId: randomUUID(), role: "instructor" }, { openId: randomUUID() }, { openId: randomUUID() }, { openId: randomUUID(), role: "instructor" },
    ]).returning();
    const [course, otherCourse] = await db.insert(trainings).values([
      { title: "Media course", slug: randomUUID(), type: "webinar", ownerUserId: owner.id },
      { title: "Other course", slug: randomUUID(), type: "webinar", ownerUserId: otherAuthor.id },
    ]).returning();
    return { db, owner, learner, stranger, otherAuthor, course, otherCourse };
  }
  it("authorizes draft assets only to course authors, then only referenced assets to enrolled version learners", async () => {
    const { db, owner, learner, stranger, otherAuthor, course } = await fixture();
    const first = await saveCourseMedia(owner, course.id, png, "image/png");
    const key = first.url.slice("/storage/".length);
    expect(await canReadPrivateFile(key, null)).toBe(false);
    expect(await canReadPrivateFile(key, owner)).toBe(true);
    expect(await canReadPrivateFile(key, otherAuthor)).toBe(false);
    expect(await canReadPrivateFile(key, learner)).toBe(false);
    await db.insert(slides).values({ trainingId: course.id, title: "Media", imageUrl: first.url });
    await updateTraining(course.id, { isPublished: true });
    const [entry] = await db.insert(enrollments).values({ userId: learner.id, trainingId: course.id }).returning();
    expect(await canReadPrivateFile(key, learner)).toBe(true);
    expect(await canReadPrivateFile(key, stranger)).toBe(false);
    const draft = await saveCourseMedia(owner, course.id, png, "image/png");
    expect(await canReadPrivateFile(draft.url.slice(9), learner)).toBe(false);
    await db.update(slides).set({ imageUrl: draft.url }).where(eq(slides.trainingId, course.id));
    await updateTraining(course.id, { isPublished: true });
    expect(await canReadPrivateFile(draft.url.slice(9), learner)).toBe(false);
    expect(await canReadPrivateFile(key, learner)).toBe(true);
    await db.update(enrollments).set({ expiresAt: new Date(1) }).where(eq(enrollments.id, entry.id));
    expect(await canReadPrivateFile(key, learner)).toBe(false);
  });
  it("preserves hashes and ownership, rejects foreign references and detects altered bytes", async () => {
    const { db, owner, otherAuthor, course, otherCourse } = await fixture();
    const api = appRouter.createCaller({ user: otherAuthor, affiliations: [], req: { headers: {} }, res: {} } as unknown as TrpcContext);
    await expect(api.ai.generateImage({ trainingId: course.id, prompt: "Denied request" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(api.ai.generateAudio({ trainingId: course.id, text: "Denied request" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(saveCourseMedia(otherAuthor, course.id, png, "image/png")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(saveCourseMedia(owner, course.id, Buffer.from("<svg/>"), "image/png")).rejects.toThrow("Format");
    const media = await saveCourseMedia(owner, course.id, png, "image/png");
    const key = media.url.slice(9);
    expect(await verifyCourseMediaBytes(key, png)).toBe(true);
    expect(await verifyCourseMediaBytes(key, Buffer.from("altered"))).toBe(false);
    await expect(db.update(courseMedia).set({ trainingId: otherCourse.id }).where(eq(courseMedia.id, media.mediaId))).rejects.toThrow();
    await expect(db.delete(courseMedia).where(eq(courseMedia.id, media.mediaId))).rejects.toThrow();
    await validateCourseMediaReferences(course.id, { body: `<img src="${media.url}">` });
    await expect(validateCourseMediaReferences(otherCourse.id, { imageUrl: media.url })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await db.insert(slides).values({ trainingId: otherCourse.id, title: "Foreign asset", imageUrl: media.url });
    await expect(updateTraining(otherCourse.id, { isPublished: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("removes company author access after their management affiliation ends", async () => {
    const { db, learner } = await fixture();
    const [company] = await db.insert(companies).values({ name: "Internal media" }).returning();
    await db.insert(affiliations).values({ personId: learner.id, orgId: company.id, role: "MANAGER" });
    const [course] = await db.insert(trainings).values({ title: "Internal", slug: randomUUID(), ownerOrgId: company.id, ownerUserId: learner.id }).returning();
    const media = await saveCourseMedia(learner, course.id, png, "image/png");
    expect(await canReadPrivateFile(media.url.slice(9), learner)).toBe(true);
    await db.update(affiliations).set({ status: "INACTIVE" }).where(eq(affiliations.personId, learner.id));
    expect(await canReadPrivateFile(media.url.slice(9), learner)).toBe(false);
  });
  it("imports bounded canonical files with private upload provenance and rejects MIME spoofing", async () => {
    const { db, owner, otherAuthor, course } = await fixture();
    const mp4 = Buffer.alloc(24); mp4.writeUInt32BE(24, 0); mp4.write("ftypisom", 4);
    for (const [bytes, type] of [[mp4, "video/mp4"], [Buffer.from("%PDF-1.7 fixture"), "application/pdf"], [Buffer.from("ID3fixture"), "audio/mpeg"]] as const) {
      const result = await uploadCourseMedia(owner, course.id, bytes.toString("base64"), type);
      const [record] = await db.select().from(courseMedia).where(eq(courseMedia.id, result.mediaId));
      expect(record).toMatchObject({ origin: "uploaded", contentType: type, byteSize: bytes.length });
      expect(await verifyCourseMediaBytes(result.url.slice(9), bytes)).toBe(true);
    }
    for (const base64 of ["", "%%%", "YWJj\n", "YR=="]) await expect(uploadCourseMedia(owner, course.id, base64, "video/mp4")).rejects.toThrow();
    await expect(uploadCourseMedia(owner, course.id, "A".repeat(34952540), "video/mp4")).rejects.toThrow("25 Mo");
    await expect(uploadCourseMedia(owner, course.id, png.toString("base64"), "video/mp4")).rejects.toThrow("Format");
    await expect(uploadCourseMedia(otherAuthor, course.id, mp4.toString("base64"), "video/mp4")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("accepts exactly 25 MiB through the upload API and rejects invalid requests before storage", async () => {
    const { db, owner, course } = await fixture();
    const api = appRouter.createCaller({ user: owner, affiliations: [], req: { headers: {} }, res: {} } as unknown as TrpcContext);
    const bytes = Buffer.alloc(25 * 1024 * 1024);
    bytes.write('%PDF-1.7 synthetic size fixture');
    const base64 = bytes.toString('base64');
    const before = vi.mocked(storagePut).mock.calls.length;
    const result = await api.maker.uploadMedia({ trainingId: course.id, contentType: 'application/pdf', base64 });
    expect((await db.select().from(courseMedia).where(eq(courseMedia.id, result.mediaId)))[0]).toMatchObject({ byteSize: bytes.length, origin: 'uploaded' });
    expect(await verifyCourseMediaBytes(result.url.slice(9), bytes)).toBe(true);
    const oversized = Buffer.concat([bytes, Buffer.from([0])]).toString('base64');
    for (const input of [
      { contentType: 'application/pdf' as const, base64: oversized },
      { contentType: 'application/pdf' as const, base64: '' },
      { contentType: 'application/pdf' as const, base64: '%%%%' },
      { contentType: 'application/pdf' as const, base64: Buffer.from('not a PDF').toString('base64') },
      { contentType: 'video/mp4' as const, base64: png.toString('base64') },
    ]) await expect(api.maker.uploadMedia({ trainingId: course.id, ...input })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(vi.mocked(storagePut).mock.calls.length - before).toBe(1);
    expect(await db.select().from(courseMedia).where(eq(courseMedia.trainingId, course.id))).toHaveLength(1);
  });

  it("captures old references once and never grants legacy access from a newly pasted foreign URL", async () => {
    const { db, owner, learner, otherAuthor, course, otherCourse } = await fixture();
    const key = `courses/images/legacy-${randomUUID()}.png`;
    const url = `/storage/${key}`;
    await db.insert(slides).values({ trainingId: course.id, title: "Legacy", imageUrl: url });
    expect(await canReadPrivateFile(key, owner)).toBe(false);
    // Execute the actual backfill statement against the dedicated test database.
    const migration = await readFile(new URL("../drizzle/migrations/20260913_legacy_course_media.sql", import.meta.url), "utf8");
    const capture = migration.slice(migration.indexOf("INSERT INTO"), migration.indexOf("CREATE TRIGGER"));
    await db.execute(sql.raw(capture));
    expect(await canReadPrivateFile(key, owner)).toBe(true);
    expect(await canReadPrivateFile(key, null)).toBe(false);
    await updateTraining(course.id, { isPublished: true });
    const [entry] = await db.insert(enrollments).values({ userId: learner.id, trainingId: course.id }).returning();
    expect(await canReadPrivateFile(key, learner)).toBe(true);
    await db.insert(slides).values({ trainingId: otherCourse.id, title: "Pasted reference", imageUrl: url });
    expect(await canReadPrivateFile(key, otherAuthor)).toBe(false);
    await expect(updateTraining(otherCourse.id, { isPublished: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(db.delete(legacyCourseMediaLinks).where(eq(legacyCourseMediaLinks.storageKey, key))).rejects.toThrow();
    await db.update(enrollments).set({ expiresAt: new Date(1) }).where(eq(enrollments.id, entry.id));
    expect(await canReadPrivateFile(key, learner)).toBe(false);
    expect(await canReadPrivateFile(`courses/images/unreferenced-${randomUUID()}.png`, owner)).toBe(false);
  });

});
