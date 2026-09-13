import { requestPedagogicalReview, decidePedagogicalReview } from "./pedagogicalReview";
import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { getDb, updateTraining, ensureEnrollmentForEmployee, upsertRecurrency } from "./db";
import { users, companies, affiliations, trainings, trainingModules, quizQuestions, employees, enrollments, recurrencies } from "../drizzle/schema";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)("company distribution · PostgreSQL", () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  async function fixture() {
    const db = (await getDb())!;
    const [company, other] = await db.insert(companies).values([{ name: "Distribution" }, { name: "Other company" }]).returning();
    const [manager, learner, stranger] = await db.insert(users).values([
      { openId: randomUUID(), role: "company_manager" as const, companyId: company.id },
      { openId: randomUUID(), role: "user" as const, companyId: company.id },
      { openId: randomUUID(), role: "company_manager" as const, companyId: other.id },
    ]).returning();
    await db.insert(affiliations).values([{ personId: manager.id, orgId: company.id, role: "MANAGER" }, { personId: learner.id, orgId: company.id, role: "MEMBER" }, { personId: stranger.id, orgId: other.id, role: "MANAGER" }]);
    const [employee] = await db.insert(employees).values({ companyId: company.id, userId: learner.id, firstName: "Test", lastName: "Learner", email: `${randomUUID()}@example.test` }).returning();
    const [course] = await db.insert(trainings).values({ title: "Internal", slug: randomUUID(), ownerOrgId: company.id, ownerUserId: manager.id }).returning();
    const [chapter] = await db.insert(trainingModules).values({ trainingId: course.id, title: "Chapter", content: "Lesson" }).returning();
    await db.insert(quizQuestions).values([chapter.id, null].map(moduleId => ({ trainingId: course.id, moduleId, question: "Choose A", options: ["A", "B"], correctAnswer: [0] })));
    const caller = (user: typeof manager) => appRouter.createCaller({ user, affiliations: [], req: { headers: {} }, res: {} } as unknown as TrpcContext);
    return { db, company, manager, learner, stranger, employee, course, caller };
  }
  it("requires company management and forbids roster transfers or foreign employee changes", async () => {
    const { manager, learner, stranger, employee, caller, db, company } = await fixture();
    await expect(caller(learner).company.employees()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(stranger).company.updateEmployee({ id: employee.id, firstName: "Intrusion" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(manager).company.updateEmployee({ id: employee.id, companyId: company.id + 1 } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await caller(manager).company.updateEmployee({ id: employee.id, firstName: "Updated" });
    expect((await db.select().from(employees).where(eq(employees.id, employee.id)))[0].firstName).toBe("Updated");
    await db.update(affiliations).set({ status: "INACTIVE" }).where(eq(affiliations.personId, manager.id));
    await expect(caller(manager).company.employees()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("assigns a published internal version atomically, idempotently and only to active members", async () => {
    const { db, manager, learner, stranger, course, company, caller } = await fixture();
    const api = caller(manager), params = { trainingId: course.id, userIds: [learner.id] };
    await expect(api.maker.assign(params)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const [reviewer] = await db.insert(users).values({ openId: randomUUID(), role: "admin" }).returning();
    const review = await requestPedagogicalReview(manager, course.id);
    await decidePedagogicalReview(reviewer, review.id, "approved", "Fixture content inspected");
    await updateTraining(course.id, { isPublished: true }, manager.id);
    await expect(api.maker.assign({ ...params, userIds: [learner.id, stranger.id] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await db.select().from(enrollments).where(eq(enrollments.trainingId, course.id))).toHaveLength(0);
    await expect(caller(stranger).maker.assign(params)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const results = await Promise.all([api.maker.assign(params), api.maker.assign(params)]);
    expect(results.reduce((n, r) => n + r.created, 0)).toBe(1);
    const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.trainingId, course.id));
    expect(enrollment).toMatchObject({ assignedOrgId: company.id, assignedBy: manager.id });
    expect(enrollment.trainingVersionId).toBeTypeOf("number");
    expect(await caller(learner).learning.modules({ trainingId: course.id, enrollmentId: enrollment.id })).toHaveLength(1);
    await expect(db.update(enrollments).set({ assignedOrgId: null }).where(eq(enrollments.id, enrollment.id))).rejects.toThrow();
    await db.update(affiliations).set({ status: "INACTIVE" }).where(and(eq(affiliations.personId, learner.id), eq(affiliations.orgId, company.id)));
    await expect(api.maker.assign(params)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(learner).learning.modules({ trainingId: course.id, enrollmentId: enrollment.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("renews expired access without overwriting the old result or moving qualification deadlines", async () => {
    const { db, manager, learner, course, company, employee } = await fixture();
    const [reviewer] = await db.insert(users).values({ openId: randomUUID(), role: "admin" }).returning();
    const review = await requestPedagogicalReview(manager, course.id);
    await decidePedagogicalReview(reviewer, review.id, "approved", "Fixture content inspected");
    await updateTraining(course.id, { isPublished: true }, manager.id);
    const oldDate = new Date("2020-01-01T00:00:00Z");
    const [old] = await db.insert(enrollments).values({ userId: learner.id, trainingId: course.id, status: "completed", progressPercent: 100, completedAt: oldDate, expiresAt: oldDate }).returning();
    await Promise.all([ensureEnrollmentForEmployee(learner.id, course.id, 24, company.id, employee.id), ensureEnrollmentForEmployee(learner.id, course.id, 24, company.id, employee.id)]);
    const records = await db.select().from(enrollments).where(eq(enrollments.trainingId, course.id));
    expect(records).toHaveLength(2);
    expect(records.find(e => e.id !== old.id)?.assignedOrgId).toBe(company.id);
    expect(records.find(e => e.id === old.id)).toMatchObject({ status: "completed", progressPercent: 100, completedAt: oldDate });
    const params = { companyId: company.id, employeeId: employee.id, trainingId: course.id, periodMonths: 24 };
    await upsertRecurrency(params);
    let [rec] = await db.select().from(recurrencies).where(eq(recurrencies.employeeId, employee.id));
    expect(rec).toMatchObject({ status: "not_started", nextDueAt: null });
    await db.update(recurrencies).set({ nextDueAt: oldDate, status: "overdue" }).where(eq(recurrencies.id, rec.id));
    await upsertRecurrency(params);
    [rec] = await db.select().from(recurrencies).where(eq(recurrencies.id, rec.id));
    expect(rec).toMatchObject({ status: "overdue", nextDueAt: oldDate });
  });
});
