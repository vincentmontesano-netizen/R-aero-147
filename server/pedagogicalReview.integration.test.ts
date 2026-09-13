import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, updateTraining, setReviewStatus } from "./db";
import { withdrawPedagogicalApproval, requestPedagogicalReview, decidePedagogicalReview, reviewSnapshot, pendingPedagogicalReviews } from "./pedagogicalReview";
import { users, trainings, trainingModules, quizQuestions, trainingVersions, pedagogicalReviews, pedagogicalDecisions, pedagogicalWithdrawals, enrollments } from "../drizzle/schema";
const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)("pedagogical publication gate · PostgreSQL", () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  async function fixture() {
    const db = (await getDb())!;
    const [author, reviewer, outsider] = await db.insert(users).values(["instructor", "admin", "instructor"].map(role => ({ openId: randomUUID(), role: role as "instructor" | "admin" }))).returning();
    const [course] = await db.insert(trainings).values({ title: "Reviewed course", slug: randomUUID(), ownerUserId: author.id }).returning();
    const [chapter] = await db.insert(trainingModules).values({ trainingId: course.id, title: "Chapter", content: "Lesson" }).returning();
    const questions = await db.insert(quizQuestions).values([chapter.id, null].map(moduleId => ({ trainingId: course.id, moduleId, question: "Choose A", options: ["A", "B"], correctAnswer: [0] }))).returning();
    return { db, author, reviewer, outsider, course, questions };
  }
  it("requires an independent decision and binds publication to its immutable reviewed copy", async () => {
    const { db, author, reviewer, outsider, course, questions } = await fixture();
    await setReviewStatus(course.id, "approved", author.id);
    await expect(updateTraining(course.id, { isPublished: true }, author.id)).rejects.toThrow("relue");
    const [a, b] = await Promise.all([requestPedagogicalReview(author, course.id), requestPedagogicalReview(author, course.id)]);
    expect(a.id).toBe(b.id);
    await expect(decidePedagogicalReview(author, a.id, "approved", "Self")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(reviewSnapshot(outsider, a.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await pendingPedagogicalReviews(reviewer)).some(r => r.id === a.id)).toBe(true);
    await decidePedagogicalReview(reviewer, a.id, "approved", "Content, supports and assessments inspected");
    await updateTraining(course.id, { isPublished: true }, author.id);
    expect((await db.select().from(trainingVersions).where(eq(trainingVersions.trainingId, course.id)))[0].reviewId).toBe(a.id);
    await db.update(quizQuestions).set({ correctAnswer: [1] }).where(eq(quizQuestions.id, questions[0].id));
    await expect(updateTraining(course.id, { isPublished: true }, author.id)).rejects.toThrow("relue");
    expect((await reviewSnapshot(reviewer, a.id)).snapshot.questions.find(q => q.id === questions[0].id)?.correctAnswer).toEqual([0]);
    await expect(db.delete(pedagogicalReviews).where(eq(pedagogicalReviews.id, a.id))).rejects.toThrow();
    await expect(db.update(pedagogicalDecisions).set({ decision: "rejected" }).where(eq(pedagogicalDecisions.reviewId, a.id))).rejects.toThrow();
  });
  it("retains a rejection and allows a new review without rewriting its decision", async () => {
    const { author, reviewer, course } = await fixture();
    const first = await requestPedagogicalReview(author, course.id);
    await decidePedagogicalReview(reviewer, first.id, "rejected", "Review the learning objectives");
    await expect(updateTraining(course.id, { isPublished: true }, author.id)).rejects.toThrow("relue");
    const second = await requestPedagogicalReview(author, course.id);
    expect(second.id).not.toBe(first.id);
    await decidePedagogicalReview(reviewer, second.id, "approved", "Reviewed after clarification");
    await expect(decidePedagogicalReview(reviewer, second.id, "rejected", "Overwrite")).rejects.toMatchObject({ code: "CONFLICT" });
    await updateTraining(course.id, { isPublished: true }, author.id);
  });
  it("withdraws approval once, unpublishes its current version and preserves existing evidence", async () => {
    const { db, author, reviewer, outsider, course } = await fixture();
    const review = await requestPedagogicalReview(author, course.id);
    await decidePedagogicalReview(reviewer, review.id, "approved", "Initial review approved");
    await updateTraining(course.id, { isPublished: true }, author.id);
    const [enrollment] = await db.insert(enrollments).values({ trainingId: course.id, userId: author.id }).returning();
    await expect(withdrawPedagogicalApproval(outsider, review.id, "Foreign withdrawal")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await Promise.all([withdrawPedagogicalApproval(author, review.id, "Incorrect instruction discovered"), withdrawPedagogicalApproval(author, review.id, "Duplicate withdrawal request")]);
    expect(await db.select().from(pedagogicalWithdrawals).where(eq(pedagogicalWithdrawals.reviewId, review.id))).toHaveLength(1);
    const [unpublished] = await db.select().from(trainings).where(eq(trainings.id, course.id));
    expect(unpublished.isPublished).toBe(false);
    expect((await db.select().from(enrollments).where(eq(enrollments.id, enrollment.id)))[0].trainingVersionId).toBe(enrollment.trainingVersionId);
    expect((await db.select().from(pedagogicalDecisions).where(eq(pedagogicalDecisions.reviewId, review.id)))[0].decision).toBe("approved");
    await expect(updateTraining(course.id, { isPublished: true }, author.id)).rejects.toThrow("relue");
    await expect(db.delete(pedagogicalWithdrawals).where(eq(pedagogicalWithdrawals.reviewId, review.id))).rejects.toThrow();
    const fresh = await requestPedagogicalReview(author, course.id);
    expect(fresh.id).not.toBe(review.id);
    await decidePedagogicalReview(reviewer, fresh.id, "approved", "Reassessed after clarification");
    await updateTraining(course.id, { isPublished: true }, author.id);
    await withdrawPedagogicalApproval(author, review.id, "Already withdrawn historical approval");
    expect((await db.select().from(trainings).where(eq(trainings.id, course.id)))[0].isPublished).toBe(true);
  });

});
