import { beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { getDb } from './db';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';
import { users, trainings, companies, affiliations, quizQuestions, questionCreationRequests } from '../drizzle/schema';
const url = process.env.RAERO_TEST_DATABASE_URL;
const caller = (user: typeof users.$inferSelect) => appRouter.createCaller({ user, affiliations: [], req: { headers: {} }, res: {} } as unknown as TrpcContext);
describe.skipIf(!url)('question creation recovery · PostgreSQL', () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  async function fixture() {
    const db = (await getDb())!;
    const [owner, peer, outsider] = await db.insert(users).values(['admin', 'admin', 'instructor'].map(role => ({ openId: randomUUID(), role: role as 'admin' | 'instructor' }))).returning();
    const [course, other] = await db.insert(trainings).values(['Question course', 'Other course'].map(title => ({ title, slug: randomUUID(), ownerUserId: owner.id }))).returning();
    const input = { trainingId: course.id, type: 'qcu' as const, question: 'Choose the verified instruction', options: ['A', 'B'], correctAnswer: [0], sortOrder: 1, requestId: randomUUID() };
    return { db, owner, peer, outsider, course, other, input };
  }
  it('serializes same-request creations and never rewrites a recovered question or archive', async () => {
    const { db, owner, peer, outsider, course, other, input } = await fixture();
    const api = caller(owner).maker.content.questions;
    const results = await Promise.all([api.create(input), api.create(input), api.create({ ...input, requestId: input.requestId.toUpperCase() })]);
    expect(new Set(results.map(result => result.questionId)).size).toBe(1);
    expect(results.filter(result => !result.replayed)).toHaveLength(1);
    expect(await db.select().from(quizQuestions).where(eq(quizQuestions.trainingId, course.id))).toHaveLength(1);
    expect(await db.select().from(questionCreationRequests).where(eq(questionCreationRequests.actorId, owner.id))).toHaveLength(1);
    const questionId = results[0].questionId;
    for (const changes of [{ question: 'Changed request' }, { correctAnswer: [1] }, { sortOrder: 2 }, { trainingId: other.id }]) {
      await expect(api.create({ ...input, ...changes })).rejects.toMatchObject({ code: 'CONFLICT' });
    }
    await expect(caller(outsider).maker.content.questions.create(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await caller(peer).maker.content.questions.create(input)).questionId).not.toBe(questionId);
    await api.update({ id: questionId, question: 'Edited after creation', correctAnswer: [1] });
    expect(await api.create(input)).toMatchObject({ questionId, replayed: true, archived: false });
    expect((await db.select().from(quizQuestions).where(eq(quizQuestions.id, questionId)))[0]).toMatchObject({ question: 'Edited after creation', correctAnswer: [1] });
    await api.delete({ id: questionId });
    expect(await api.create(input)).toMatchObject({ questionId, replayed: true, archived: true });
    expect((await db.select().from(quizQuestions).where(eq(quizQuestions.id, questionId)))[0].archivedAt).toBeTruthy();
    await expect(db.update(questionCreationRequests).set({ fingerprint: '0'.repeat(64) }).where(eq(questionCreationRequests.questionId, questionId))).rejects.toThrow();
    await expect(db.delete(questionCreationRequests).where(eq(questionCreationRequests.questionId, questionId))).rejects.toThrow();
    await expect(db.execute(sql`truncate question_creation_requests`)).rejects.toThrow();
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, owner.id));
    await expect(api.create(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('rechecks active company management before returning a previous creation', async () => {
    const { db, owner, course, input } = await fixture();
    const [company] = await db.insert(companies).values({ name: 'Question recovery company' }).returning();
    const [manager] = await db.update(users).set({ role: 'company_manager' }).where(eq(users.id, owner.id)).returning();
    await db.update(trainings).set({ ownerOrgId: company.id }).where(eq(trainings.id, course.id));
    await db.insert(affiliations).values({ personId: manager.id, orgId: company.id, role: 'MANAGER' });
    const api = caller(manager).maker.content.questions;
    const first = await api.create(input);
    await db.update(affiliations).set({ status: 'INACTIVE' }).where(eq(affiliations.personId, manager.id));
    await expect(api.create(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await db.select().from(questionCreationRequests).where(eq(questionCreationRequests.questionId, first.questionId))).toHaveLength(1);
  });
  it('keeps legacy requests compatible and canonicalizes request payload key order', async () => {
    const { db, owner, course, input } = await fixture();
    const api = caller(owner).maker.content.questions;
    const { requestId, ...legacy } = input;
    expect((await api.create(legacy)).questionId).not.toBe((await api.create(legacy)).questionId);
    expect(await db.select().from(questionCreationRequests).where(eq(questionCreationRequests.actorId, owner.id))).toHaveLength(0);
    const first = await api.create(input);
    const reordered = Object.fromEntries(Object.entries(input).reverse()) as typeof input;
    expect(await api.create(reordered)).toMatchObject({ questionId: first.questionId, replayed: true });
    expect(await db.select().from(quizQuestions).where(eq(quizQuestions.trainingId, course.id))).toHaveLength(3);
    await expect(api.create({ ...input, requestId: 'invalid' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
