import { beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { getDb } from './db';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';
import { users, trainings, companies, affiliations, trainingModules, moduleCreationRequests } from '../drizzle/schema';
const url = process.env.RAERO_TEST_DATABASE_URL;
const caller = (user: typeof users.$inferSelect) => appRouter.createCaller({ user, affiliations: [], req: { headers: {} }, res: {} } as unknown as TrpcContext);
describe.skipIf(!url)('module creation recovery · PostgreSQL', () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  async function fixture() {
    const db = (await getDb())!;
    const [owner, peer, outsider] = await db.insert(users).values(['admin', 'admin', 'instructor'].map(role => ({ openId: randomUUID(), role: role as 'admin' | 'instructor' }))).returning();
    const [course, other] = await db.insert(trainings).values(['Module course', 'Other course'].map(title => ({ title, slug: randomUUID(), ownerUserId: owner.id }))).returning();
    const input = { trainingId: course.id, title: 'Chapter instructions', content: 'Verified training content', quizMaxAttempts: 3, sortOrder: 1, requestId: randomUUID() };
    return { db, owner, peer, outsider, course, other, input };
  }
  it('serializes same-request creations and never rewrites a recovered module or archive', async () => {
    const { db, owner, peer, outsider, course, other, input } = await fixture();
    const api = caller(owner).maker.content.modules;
    const results = await Promise.all([api.create(input), api.create(input), api.create({ ...input, requestId: input.requestId.toUpperCase() })]);
    expect(new Set(results.map(result => result.moduleId)).size).toBe(1);
    expect(results.filter(result => !result.replayed)).toHaveLength(1);
    expect(await db.select().from(trainingModules).where(eq(trainingModules.trainingId, course.id))).toHaveLength(1);
    expect(await db.select().from(moduleCreationRequests).where(eq(moduleCreationRequests.actorId, owner.id))).toHaveLength(1);
    const moduleId = results[0].moduleId;
    for (const changes of [{ title: 'Changed request' }, { quizMaxAttempts: 2 }, { sortOrder: 2 }, { trainingId: other.id }]) {
      await expect(api.create({ ...input, ...changes })).rejects.toMatchObject({ code: 'CONFLICT' });
    }
    await expect(caller(outsider).maker.content.modules.create(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await caller(peer).maker.content.modules.create(input)).moduleId).not.toBe(moduleId);
    await api.update({ id: moduleId, title: 'Edited after creation', quizMaxAttempts: 2 });
    expect(await api.create(input)).toMatchObject({ moduleId, replayed: true, archived: false });
    expect((await db.select().from(trainingModules).where(eq(trainingModules.id, moduleId)))[0]).toMatchObject({ title: 'Edited after creation', quizMaxAttempts: 2 });
    await api.delete({ id: moduleId });
    expect(await api.create(input)).toMatchObject({ moduleId, replayed: true, archived: true });
    expect((await db.select().from(trainingModules).where(eq(trainingModules.id, moduleId)))[0].archivedAt).toBeTruthy();
    await expect(db.update(moduleCreationRequests).set({ fingerprint: '0'.repeat(64) }).where(eq(moduleCreationRequests.moduleId, moduleId))).rejects.toThrow();
    await expect(db.delete(moduleCreationRequests).where(eq(moduleCreationRequests.moduleId, moduleId))).rejects.toThrow();
    await expect(db.execute(sql`truncate module_creation_requests`)).rejects.toThrow();
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, owner.id));
    await expect(api.create(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('rechecks active company management before returning a previous creation', async () => {
    const { db, owner, course, input } = await fixture();
    const [company] = await db.insert(companies).values({ name: 'Module recovery company' }).returning();
    const [manager] = await db.update(users).set({ role: 'company_manager' }).where(eq(users.id, owner.id)).returning();
    await db.update(trainings).set({ ownerOrgId: company.id }).where(eq(trainings.id, course.id));
    await db.insert(affiliations).values({ personId: manager.id, orgId: company.id, role: 'MANAGER' });
    const api = caller(manager).maker.content.modules;
    const first = await api.create(input);
    await db.update(affiliations).set({ status: 'INACTIVE' }).where(eq(affiliations.personId, manager.id));
    await expect(api.create(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await db.select().from(moduleCreationRequests).where(eq(moduleCreationRequests.moduleId, first.moduleId))).toHaveLength(1);
  });
  it('keeps legacy requests compatible and canonicalizes request payload key order', async () => {
    const { db, owner, course, input } = await fixture();
    const api = caller(owner).maker.content.modules;
    const { requestId, ...legacy } = input;
    expect((await api.create(legacy)).moduleId).not.toBe((await api.create(legacy)).moduleId);
    expect(await db.select().from(moduleCreationRequests).where(eq(moduleCreationRequests.actorId, owner.id))).toHaveLength(0);
    const first = await api.create(input);
    const reordered = Object.fromEntries(Object.entries(input).reverse()) as typeof input;
    expect(await api.create(reordered)).toMatchObject({ moduleId: first.moduleId, replayed: true });
    expect(await db.select().from(trainingModules).where(eq(trainingModules.trainingId, course.id))).toHaveLength(3);
    await expect(api.create({ ...input, requestId: 'invalid' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
