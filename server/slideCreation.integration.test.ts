import { beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { getDb } from './db';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';
import { users, trainings, companies, affiliations, slides, slideCreationRequests } from '../drizzle/schema';
const url = process.env.RAERO_TEST_DATABASE_URL;
const caller = (user: typeof users.$inferSelect) => appRouter.createCaller({ user, affiliations: [], req: { headers: {} }, res: {} } as unknown as TrpcContext);
describe.skipIf(!url)('slide creation recovery · PostgreSQL', () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  async function fixture() {
    const db = (await getDb())!;
    const [owner, peer, outsider] = await db.insert(users).values(['admin', 'admin', 'instructor'].map(role => ({ openId: randomUUID(), role: role as 'admin' | 'instructor' }))).returning();
    const [course, other] = await db.insert(trainings).values(['Slide course', 'Other course'].map(title => ({ title, slug: randomUUID(), ownerUserId: owner.id }))).returning();
    const input = { trainingId: course.id, title: 'Chapter instructions', body: 'Verified training content', quizQuestion: 'Choose', quizOptions: ['A','B'], quizCorrect: [0], sortOrder: 1, requestId: randomUUID() };
    return { db, owner, peer, outsider, course, other, input };
  }
  it('serializes same-request creations and never rewrites a recovered slide or archive', async () => {
    const { db, owner, peer, outsider, course, other, input } = await fixture();
    const api = caller(owner).maker;
    const results = await Promise.all([api.createSlide(input), api.createSlide(input), api.createSlide({ ...input, requestId: input.requestId.toUpperCase() })]);
    expect(new Set(results.map(result => result.id)).size).toBe(1);
    expect(results.filter(result => !result.replayed)).toHaveLength(1);
    expect(await db.select().from(slides).where(eq(slides.trainingId, course.id))).toHaveLength(1);
    expect(await db.select().from(slideCreationRequests).where(eq(slideCreationRequests.actorId, owner.id))).toHaveLength(1);
    const slideId = results[0].id;
    for (const changes of [{ title: 'Changed request' }, { quizCorrect: [1] }, { sortOrder: 2 }, { trainingId: other.id }]) {
      await expect(api.createSlide({ ...input, ...changes })).rejects.toMatchObject({ code: 'CONFLICT' });
    }
    await expect(caller(outsider).maker.createSlide(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await caller(peer).maker.createSlide(input)).id).not.toBe(slideId);
    await api.updateSlide({ id: slideId, title: 'Edited after creation', quizCorrect: [1] });
    expect(await api.createSlide(input)).toMatchObject({ id: slideId, replayed: true, archived: false });
    expect((await db.select().from(slides).where(eq(slides.id, slideId)))[0]).toMatchObject({ title: 'Edited after creation', quizCorrect: [1] });
    await api.deleteSlide({ id: slideId });
    expect(await api.createSlide(input)).toMatchObject({ id: slideId, replayed: true, archived: true });
    expect((await db.select().from(slides).where(eq(slides.id, slideId)))[0].archivedAt).toBeTruthy();
    await expect(db.update(slideCreationRequests).set({ fingerprint: '0'.repeat(64) }).where(eq(slideCreationRequests.slideId, slideId))).rejects.toThrow();
    await expect(db.delete(slideCreationRequests).where(eq(slideCreationRequests.slideId, slideId))).rejects.toThrow();
    await expect(db.execute(sql`truncate slide_creation_requests`)).rejects.toThrow();
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, owner.id));
    await expect(api.createSlide(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('rechecks active company management before returning a previous creation', async () => {
    const { db, owner, course, input } = await fixture();
    const [company] = await db.insert(companies).values({ name: 'Slide recovery company' }).returning();
    const [manager] = await db.update(users).set({ role: 'company_manager' }).where(eq(users.id, owner.id)).returning();
    await db.update(trainings).set({ ownerOrgId: company.id }).where(eq(trainings.id, course.id));
    await db.insert(affiliations).values({ personId: manager.id, orgId: company.id, role: 'MANAGER' });
    const api = caller(manager).maker;
    const first = await api.createSlide(input);
    await db.update(affiliations).set({ status: 'INACTIVE' }).where(eq(affiliations.personId, manager.id));
    await expect(api.createSlide(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await db.select().from(slideCreationRequests).where(eq(slideCreationRequests.slideId, first.id))).toHaveLength(1);
  });
  it('keeps legacy requests compatible and canonicalizes request payload key order', async () => {
    const { db, owner, course, input } = await fixture();
    const api = caller(owner).maker;
    await expect(api.createSlide({...input,quizCorrect:[9]})).rejects.toMatchObject({code:'BAD_REQUEST'});
    expect(await db.select().from(slideCreationRequests).where(eq(slideCreationRequests.actorId,owner.id))).toHaveLength(0);
    expect(await db.select().from(slides).where(eq(slides.trainingId,course.id))).toHaveLength(0);
    const { requestId, ...legacy } = input;
    expect((await api.createSlide(legacy)).id).not.toBe((await api.createSlide(legacy)).id);
    expect(await db.select().from(slideCreationRequests).where(eq(slideCreationRequests.actorId, owner.id))).toHaveLength(0);
    const first = await api.createSlide(input);
    const reordered = Object.fromEntries(Object.entries(input).reverse()) as typeof input;
    expect(await api.createSlide(reordered)).toMatchObject({ id: first.id, replayed: true });
    expect(await db.select().from(slides).where(eq(slides.trainingId, course.id))).toHaveLength(3);
    await expect(api.createSlide({ ...input, requestId: 'invalid' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
