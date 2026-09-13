import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, createCourseFromTemplate } from "./db";
import { users, companies, affiliations, trainings, trainingModules, learningObjectives, courseTemplates, courseTemplateUses } from "../drizzle/schema";
const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)("template instantiation · PostgreSQL", () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  async function fixture() {
    const db = (await getDb())!;
    const [actor] = await db.insert(users).values({ openId: randomUUID(), role: "instructor" }).returning();
    const [template] = await db.insert(courseTemplates).values({ title: "Atomic template", domain: "part66", structure: { modules: [{ title: "Chapter one", objectives: [{ title: "Objective one", code: "9.1", knowledgeLevel: "2" }] }, { title: "Chapter two", objectives: [{ title: "Objective two", knowledgeLevel: "3" }] }] } }).returning();
    return { db, actor, template };
  }
  it("creates independent drafts with correct chapter/objective links and an immutable source copy", async () => {
    const { db, actor, template } = await fixture();
    const copies = await Promise.all([createCourseFromTemplate(template.id, actor.id), createCourseFromTemplate(template.id, actor.id)]);
    expect(copies[0].trainingId).not.toBe(copies[1].trainingId);
    for (const copy of copies) {
      const [course] = await db.select().from(trainings).where(eq(trainings.id, copy.trainingId));
      expect(course).toMatchObject({ isPublished: false, reviewStatus: "draft", ownerUserId: actor.id, publishedVersionId: null });
      const chapters = await db.select().from(trainingModules).where(eq(trainingModules.trainingId, course.id)).orderBy(trainingModules.sortOrder);
      const objectives = await db.select().from(learningObjectives).where(eq(learningObjectives.trainingId, course.id)).orderBy(learningObjectives.id);
      expect(chapters).toHaveLength(2);
      expect(objectives.map(o => o.moduleId)).toEqual(chapters.map(c => c.id));
      const [source] = await db.select().from(courseTemplateUses).where(eq(courseTemplateUses.trainingId, course.id));
      expect(source).toMatchObject({ templateId: template.id, createdBy: actor.id, snapshot: { title: "Atomic template", structure: template.structure } });
      await expect(db.delete(courseTemplateUses).where(eq(courseTemplateUses.trainingId, course.id))).rejects.toThrow();
    }
    await db.update(courseTemplates).set({ title: "Changed source" }).where(eq(courseTemplates.id, template.id));
    expect((await db.select().from(courseTemplateUses).where(eq(courseTemplateUses.trainingId, copies[0].trainingId)))[0].snapshot.title).toBe("Atomic template");
  });
  it("rejects invalid later objectives and private media before leaving any partial course", async () => {
    const { db, actor, template } = await fixture();
    await db.update(courseTemplates).set({ structure: { modules: [{ title: "Valid chapter" }, { title: "Invalid chapter", objectives: [{ title: "Bad level", knowledgeLevel: "99" }] }] } }).where(eq(courseTemplates.id, template.id));
    await expect(createCourseFromTemplate(template.id, actor.id)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await db.update(courseTemplates).set({ structure: { modules: [{ title: "Private", content: '<img src="/storage/course-media/foreign/private.png">' }] } }).where(eq(courseTemplates.id, template.id));
    await expect(createCourseFromTemplate(template.id, actor.id)).rejects.toThrow("médias privés");
    expect(await db.select().from(trainings).where(eq(trainings.ownerUserId, actor.id))).toHaveLength(0);
  });
  it("checks destination management inside the creation transaction", async () => {
    const { db, actor, template } = await fixture();
    const [company] = await db.insert(companies).values({ name: "Template destination" }).returning();
    await expect(createCourseFromTemplate(template.id, actor.id, company.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.insert(affiliations).values({ personId: actor.id, orgId: company.id, role: "MANAGER" });
    const created = await createCourseFromTemplate(template.id, actor.id, company.id);
    expect((await db.select().from(trainings).where(eq(trainings.id, created.trainingId)))[0].ownerOrgId).toBe(company.id);
    await db.update(affiliations).set({ status: "INACTIVE" }).where(eq(affiliations.personId, actor.id));
    await expect(createCourseFromTemplate(template.id, actor.id, company.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
