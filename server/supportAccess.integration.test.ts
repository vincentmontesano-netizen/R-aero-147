import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { users, supportTickets, messages } from "../drizzle/schema";
const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)("support confidentiality · PostgreSQL", () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  it("reserves another person's conversation and back-office actions to admins", async () => {
    const db = (await getDb())!;
    const people = await db.insert(users).values((["user", "instructor", "company_manager", "admin"] as const).map(role => ({ role, openId: randomUUID(), name: role, passwordHash: "fixture-private" }))).returning();
    const [owner, instructor, manager, admin] = people;
    const [ticket] = await db.insert(supportTickets).values({ userId: owner.id, subject: "Personal assistance" }).returning();
    await db.insert(messages).values({ ticketId: ticket.id, fromUserId: owner.id, content: "Private learner conversation" });
    const caller = (user: typeof owner) => appRouter.createCaller({ user, affiliations: [], req: { headers: {} }, res: {} } as unknown as TrpcContext);
    await db.insert(supportTickets).values(Array.from({ length: 50 }, (_, i) => ({ userId: owner.id, subject: `Newer request ${i}` })));
    const firstPage = await caller(owner).support.myList({});
    expect(firstPage.entries).toHaveLength(50);
    expect(firstPage.entries.some(entry => entry.id === ticket.id)).toBe(false);
    expect(firstPage.nextCursor).not.toBeNull();
    for (const other of [instructor, manager]) {
      await expect(caller(other).support.detail({ ticketId: ticket.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller(other).support.thread({ ticketId: ticket.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller(other).support.reply({ ticketId: ticket.id, content: "Unauthorized reply" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller(other).support.adminList()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller(other).support.setStatus({ ticketId: ticket.id, status: "CLOSED" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    const detail = await caller(owner).support.detail({ ticketId: ticket.id });
    expect(detail).toEqual({ id: ticket.id, subject: ticket.subject, status: ticket.status, requestKind: ticket.requestKind, createdAt: ticket.createdAt, updatedAt: ticket.updatedAt });
    expect(await caller(admin).support.detail({ ticketId: ticket.id })).toEqual(detail);
    expect(await caller(owner).support.thread({ ticketId: ticket.id })).toHaveLength(1);
    const visible = await caller(admin).support.thread({ ticketId: ticket.id });
    expect(visible[0]).toMatchObject({ content: "Private learner conversation", fromName: "user" });
    expect(visible[0]).not.toHaveProperty("passwordHash");
    await caller(admin).support.setStatus({ ticketId: ticket.id, status: "PENDING" });
    expect((await db.select().from(supportTickets).where(eq(supportTickets.id, ticket.id)))[0].status).toBe("PENDING");
    expect(await db.select().from(messages).where(eq(messages.ticketId, ticket.id))).toHaveLength(1);
    const [personal] = await db.insert(supportTickets).values({ userId: instructor.id, subject: "Instructor's own request" }).returning();
    expect(await caller(instructor).support.thread({ ticketId: personal.id })).toEqual([]);
    expect((await caller(admin).support.detail({ ticketId: ticket.id })).status).toBe("PENDING");
    await db.update(users).set({ role: "user" }).where(eq(users.id, admin.id));
    await expect(caller(admin).support.detail({ ticketId: ticket.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, owner.id));
    await expect(caller(owner).support.detail({ ticketId: ticket.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const ticketId of [0, 1.5, 2147483648]) await expect(caller(instructor).support.detail({ ticketId })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
