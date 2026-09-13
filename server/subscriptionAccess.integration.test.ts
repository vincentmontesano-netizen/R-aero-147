import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, updateTraining, ensureEnrollmentForEmployee } from "./db";
import { requireEnrollment, requireTrainingAccess } from "./learningAccess";
import { companies, users, employees, affiliations, trainings, enrollments } from "../drizzle/schema";
const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)("subscription learning access · PostgreSQL", () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  async function fixture() {
    const db = (await getDb())!;
    const [company] = await db.insert(companies).values({ name: "Subscribed company", stripeSubscriptionId: `sub_${randomUUID()}`, subscriptionStatus: "active", subscriptionType: "standard", subscriptionQuantity: 1, subscriptionExpiresAt: new Date(Date.now() + 3600000) }).returning();
    const [learner] = await db.insert(users).values({ openId: randomUUID() }).returning();
    await db.insert(affiliations).values({ personId: learner.id, orgId: company.id, role: "MEMBER" });
    const [employee] = await db.insert(employees).values({ companyId: company.id, userId: learner.id, firstName: "Test", lastName: "Learner", email: `${randomUUID()}@example.test` }).returning();
    const [course] = await db.insert(trainings).values({ title: "Subscription curriculum", slug: randomUUID(), type: "webinar" }).returning();
    await updateTraining(course.id, { isPublished: true });
    const grant = () => ensureEnrollmentForEmployee(learner.id, course.id, 24, company.id, employee.id, true);
    return { db, company, learner, employee, course, grant };
  }
  it("records immutable subscription provenance, suspends on cancellation/expiry and preserves learning results", async () => {
    const { db, company, learner, employee, course, grant } = await fixture();
    await Promise.all([grant(), grant()]);
    const [entry] = await db.select().from(enrollments).where(eq(enrollments.trainingId, course.id));
    expect(entry).toMatchObject({ stripeSubscriptionId: company.stripeSubscriptionId, employeeId: employee.id, assignedOrgId: company.id });
    expect(await db.select().from(enrollments).where(eq(enrollments.trainingId, course.id))).toHaveLength(1);
    await db.update(enrollments).set({ status: "completed", progressPercent: 100, completedAt: new Date() }).where(eq(enrollments.id, entry.id));
    await requireEnrollment(learner.id, entry.id);
    for (const patch of [{ subscriptionStatus: "canceled" }, { subscriptionStatus: "past_due" }, { subscriptionExpiresAt: new Date(1) }, { stripeSubscriptionId: "sub_replacement" }]) {
      await db.update(companies).set({ subscriptionStatus: "active", subscriptionExpiresAt: company.subscriptionExpiresAt, stripeSubscriptionId: company.stripeSubscriptionId, ...patch }).where(eq(companies.id, company.id));
      await expect(requireEnrollment(learner.id, entry.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(requireTrainingAccess(learner.id, course.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(db.update(enrollments).set({ stripeSubscriptionId: null }).where(eq(enrollments.id, entry.id))).rejects.toThrow();
    const [preserved] = await db.select().from(enrollments).where(eq(enrollments.id, entry.id));
    expect(preserved).toMatchObject({ status: "completed", progressPercent: 100, stripeSubscriptionId: company.stripeSubscriptionId });
    expect(preserved.completedAt).toBeInstanceOf(Date);
    await db.update(companies).set({ stripeSubscriptionId: company.stripeSubscriptionId }).where(eq(companies.id, company.id));
    await requireEnrollment(learner.id, entry.id);
    await db.update(employees).set({ isActive: false }).where(eq(employees.id, employee.id));
    await expect(requireEnrollment(learner.id, entry.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await grant()).toEqual({ created: false });
  });
  it("keeps independent access usable and creates a new origin on replacement without rewriting history", async () => {
    const { db, company, learner, course, grant } = await fixture();
    const [independent] = await db.insert(enrollments).values({ userId: learner.id, trainingId: course.id }).returning();
    await grant();
    const entries = await db.select().from(enrollments).where(eq(enrollments.trainingId, course.id));
    expect(entries).toHaveLength(2);
    await db.update(companies).set({ subscriptionStatus: "canceled" }).where(eq(companies.id, company.id));
    expect((await requireTrainingAccess(learner.id, course.id)).id).toBe(independent.id);
    expect(await grant()).toEqual({ created: false });
    await db.update(companies).set({ subscriptionStatus: "active", stripeSubscriptionId: "sub_new_fixture" }).where(eq(companies.id, company.id));
    await grant();
    const all = await db.select().from(enrollments).where(eq(enrollments.trainingId, course.id));
    expect(all).toHaveLength(3);
    expect(all.map(e => e.stripeSubscriptionId)).toEqual(expect.arrayContaining([null, company.stripeSubscriptionId, "sub_new_fixture"]));
  });
  it("suspends Standard when the active roster exceeds paid seats and restores after verified capacity changes", async () => {
    const { db, company, learner, course, grant } = await fixture();
    await grant();
    const [entry] = await db.select().from(enrollments).where(eq(enrollments.trainingId, course.id));
    const [extra] = await db.insert(employees).values({ companyId: company.id, firstName: "Second", lastName: "Employee", email: `${randomUUID()}@example.test` }).returning();
    await expect(requireEnrollment(learner.id, entry.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await grant()).toEqual({ created: false });
    await db.update(companies).set({ subscriptionQuantity: 2 }).where(eq(companies.id, company.id));
    await requireEnrollment(learner.id, entry.id);
    await db.update(companies).set({ subscriptionQuantity: 1 }).where(eq(companies.id, company.id));
    await expect(requireEnrollment(learner.id, entry.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.update(employees).set({ isActive: false }).where(eq(employees.id, extra.id));
    await requireEnrollment(learner.id, entry.id);
    await db.update(companies).set({ subscriptionQuantity: null }).where(eq(companies.id, company.id));
    await expect(requireEnrollment(learner.id, entry.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.update(companies).set({ subscriptionType: "all_inclusive", subscriptionQuantity: 1 }).where(eq(companies.id, company.id));
    await db.update(employees).set({ isActive: true }).where(eq(employees.id, extra.id));
    await requireEnrollment(learner.id, entry.id);
    await expect(db.update(companies).set({ subscriptionQuantity: 0 }).where(eq(companies.id, company.id))).rejects.toThrow();
  });

});
