import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb, adminUpdateUser, adminSetUserRole, adminSetUserStatus } from "./db";

const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)("administrator retention · PostgreSQL", () => {
  const schema = `admin_roles_${randomUUID().replaceAll("-", "")}`;
  let control: ReturnType<typeof postgres>;
  beforeAll(async () => {
    control = postgres(url!, { max: 1 });
    await control.unsafe(`CREATE SCHEMA ${schema}`);
    await control.unsafe(`CREATE TABLE ${schema}.users (LIKE public.users INCLUDING ALL)`);
    const isolated = new URL(url!);
    isolated.searchParams.set("options", `-c search_path=${schema},public`);
    process.env.DATABASE_URL = isolated.toString();
  });
  beforeEach(async () => { await control.unsafe(`TRUNCATE ${schema}.users`); });
  afterAll(async () => {
    if (control) {
      await control.unsafe(`DROP SCHEMA ${schema} CASCADE`);
      await control.end();
    }
  });
  async function admin() {
    const db = (await getDb())!;
    return (await db.insert(users).values({ openId: randomUUID(), role: "admin", status: "active" }).returning())[0];
  }
  it("keeps the last active administrator through every edit entry point", async () => {
    const user = await admin();
    for (const change of [
      () => adminUpdateUser(user.id, { role: "user", name: "Must not save" }),
      () => adminSetUserRole(user.id, "instructor"),
      () => adminSetUserStatus(user.id, "suspended"),
    ]) await expect(change()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const db = (await getDb())!;
    expect((await db.select().from(users).where(eq(users.id, user.id)))[0]).toMatchObject({ role: "admin", status: "active", name: null });
  });
  it("serializes concurrent demotion and suspension of the last two admins", async () => {
    const [a, b] = await Promise.all([admin(), admin()]);
    const results = await Promise.allSettled([
      adminUpdateUser(a.id, { role: "user" }), adminSetUserStatus(b.id, "suspended"),
    ]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
    const db = (await getDb())!;
    expect((await db.select().from(users)).filter(u => u.role === "admin" && u.status === "active")).toHaveLength(1);
  });
  it("allows profile edits and demotion when another active administrator remains", async () => {
    const [a, b] = await Promise.all([admin(), admin()]);
    expect(await adminUpdateUser(a.id, { name: "Updated" })).toMatchObject({ name: "Updated", role: "admin" });
    await adminSetUserRole(a.id, "instructor");
    await adminSetUserStatus(a.id, "suspended");
    expect(await adminUpdateUser(b.id, { role: "admin", name: "Remaining" })).toMatchObject({ role: "admin", name: "Remaining" });
  });
});
