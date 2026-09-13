import { beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { getDb } from './db';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';
import { users, trainings, companies, affiliations, learningObjectives, objectiveCreationRequests } from '../drizzle/schema';
const url = process.env.RAERO_TEST_DATABASE_URL;
const caller = (user: typeof users.$inferSelect) => appRouter.createCaller({ user, affiliations: [], req: { headers: {} }, res: {} } as unknown as TrpcContext);
describe.skipIf(!url)('objective creation recovery · PostgreSQL', () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  async function fixture() {
    const db = (await getDb())!;
    const [owner, peer, outsider] = await db.insert(users).values(['admin', 'admin', 'instructor'].map(role => ({ openId: randomUUID(), role: role as 'admin' | 'instructor' }))).returning();
    const [course, other] = await db.insert(trainings).values(['Objective course', 'Other course'].map(title => ({ title, slug: randomUUID(), ownerUserId: owner.id }))).returning();
    const input = { trainingId: course.id, title: 'Objective instructions', description: 'Verified training content', knowledgeLevel: '3' as const, sortOrder: 1, requestId: randomUUID() };
    return { db, owner, peer, outsider, course, other, input };
  }
  it('serializes same-request creations and never rewrites a recovered objective or archive', async () => {
    const { db, owner, peer, outsider, course, other, input } = await fixture();
    const api = caller(owner).maker.content.objectives;
    const results = await Promise.all([api.create(input), api.create(input), api.create({ ...input, requestId: input.requestId.toUpperCase() })]);
    expect(new Set(results.map(result => result.objectiveId)).size).toBe(1);
    expect(results.filter(result => !result.replayed)).toHaveLength(1);
    expect(await db.select().from(learningObjectives).where(eq(learningObjectives.trainingId, course.id))).toHaveLength(1);
    expect(await db.select().from(objectiveCreationRequests).where(eq(objectiveCreationRequests.actorId, owner.id))).toHaveLength(1);
    const objectiveId = results[0].objectiveId;
    for (const changes of [{ title: 'Changed request' }, { knowledgeLevel: '2' as const }, { sortOrder: 2 }, { trainingId: other.id }]) {
      await expect(api.create({ ...input, ...changes })).rejects.toMatchObject({ code: 'CONFLICT' });
    }
    await expect(caller(outsider).maker.content.objectives.create(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await caller(peer).maker.content.objectives.create(input)).objectiveId).not.toBe(objectiveId);
    await api.update({ id: objectiveId, title: 'Edited after creation', knowledgeLevel: '2' as const });
    expect(await api.create(input)).toMatchObject({ objectiveId, replayed: true, archived: false });
    expect((await db.select().from(learningObjectives).where(eq(learningObjectives.id, objectiveId)))[0]).toMatchObject({ title: 'Edited after creation', knowledgeLevel: '2' as const });
    await api.delete({ id: objectiveId });
    expect(await api.create(input)).toMatchObject({ objectiveId, replayed: true, archived: true });
    expect((await db.select().from(learningObjectives).where(eq(learningObjectives.id, objectiveId)))[0].archivedAt).toBeTruthy();
    await expect(db.update(objectiveCreationRequests).set({ fingerprint: '0'.repeat(64) }).where(eq(objectiveCreationRequests.objectiveId, objectiveId))).rejects.toThrow();
    await expect(db.delete(objectiveCreationRequests).where(eq(objectiveCreationRequests.objectiveId, objectiveId))).rejects.toThrow();
    await expect(db.execute(sql`truncate objective_creation_requests`)).rejects.toThrow();
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, owner.id));
    await expect(api.create(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('rechecks active company management before returning a previous creation', async () => {
    const { db, owner, course, input } = await fixture();
    const [company] = await db.insert(companies).values({ name: 'Objective recovery company' }).returning();
    const [manager] = await db.update(users).set({ role: 'company_manager' }).where(eq(users.id, owner.id)).returning();
    await db.update(trainings).set({ ownerOrgId: company.id }).where(eq(trainings.id, course.id));
    await db.insert(affiliations).values({ personId: manager.id, orgId: company.id, role: 'MANAGER' });
    const api = caller(manager).maker.content.objectives;
    const first = await api.create(input);
    await db.update(affiliations).set({ status: 'INACTIVE' }).where(eq(affiliations.personId, manager.id));
    await expect(api.create(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await db.select().from(objectiveCreationRequests).where(eq(objectiveCreationRequests.objectiveId, first.objectiveId))).toHaveLength(1);
  });
  it('keeps legacy requests compatible and canonicalizes request payload key order', async () => {
    const { db, owner, course, input } = await fixture();
    const api = caller(owner).maker.content.objectives;
    const { requestId, ...legacy } = input;
    expect((await api.create(legacy)).objectiveId).not.toBe((await api.create(legacy)).objectiveId);
    expect(await db.select().from(objectiveCreationRequests).where(eq(objectiveCreationRequests.actorId, owner.id))).toHaveLength(0);
    const first = await api.create(input);
    const reordered = Object.fromEntries(Object.entries(input).reverse()) as typeof input;
    expect(await api.create(reordered)).toMatchObject({ objectiveId: first.objectiveId, replayed: true });
    expect(await db.select().from(learningObjectives).where(eq(learningObjectives.trainingId, course.id))).toHaveLength(3);
    await expect(api.create({ ...input, requestId: 'invalid' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
