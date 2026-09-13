import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, deleteSession, getUserSessions } from "./db";
import { registerForSession, registerForWebinar, cancelSessionReservation } from "./admissions";
import { users, sessions, sessionRegistrations, webinars, webinarRegistrations, sessionAdmissionEvents } from "../drizzle/schema";
const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)("classroom admissions · PostgreSQL", () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  async function fixture() {
    const db = (await getDb())!;
    const [a, b] = await db.insert(users).values([1, 2].map(() => ({ openId: randomUUID() }))).returning();
    const future = new Date(Date.now() + 86400000);
    const [session] = await db.insert(sessions).values({ title: "Last seat", startDate: future, seats: 1 }).returning();
    const [webinar] = await db.insert(webinars).values({ title: "Last webinar seat", scheduledAt: future, maxParticipants: 1 }).returning();
    return { db, a, b, session, webinar };
  }
  it("allocates the last session and webinar places only once under concurrency", async () => {
    const { db, a, b, session, webinar } = await fixture();
    const results = await Promise.allSettled([registerForSession(a.id, session.id), registerForSession(b.id, session.id)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.select().from(sessionRegistrations).where(eq(sessionRegistrations.sessionId, session.id))).toHaveLength(1);
    expect((await db.select().from(sessions).where(eq(sessions.id, session.id)))[0]).toMatchObject({ seatsTaken: 1, status: "full" });
    const webinarResults = await Promise.allSettled([registerForWebinar(a.id, webinar.id), registerForWebinar(b.id, webinar.id)]);
    expect(webinarResults.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.select().from(webinarRegistrations).where(eq(webinarRegistrations.webinarId, webinar.id))).toHaveLength(1);
  });
  it("reuses repeated reservations and counts cancelled registrations from the actual roster", async () => {
    const { db, a, b, session, webinar } = await fixture();
    await Promise.all([registerForSession(a.id, session.id), registerForSession(a.id, session.id)]);
    await Promise.all([registerForWebinar(a.id, webinar.id), registerForWebinar(a.id, webinar.id)]);
    expect(await db.select().from(webinarRegistrations).where(eq(webinarRegistrations.webinarId, webinar.id))).toHaveLength(1);
    await db.update(sessionRegistrations).set({ status: "cancelled" }).where(eq(sessionRegistrations.sessionId, session.id));
    expect((await registerForSession(b.id, session.id)).success).toBe(true);
    const registrations = await db.select().from(sessionRegistrations).where(eq(sessionRegistrations.sessionId, session.id));
    expect(registrations).toHaveLength(2);
    expect(registrations.filter(r => r.status === "registered")).toHaveLength(1);
  });
  it("rejects cancelled, completed, already started, paid-without-entitlement and suspended admissions", async () => {
    const { db, a, session, webinar } = await fixture();
    for (const status of ["cancelled", "completed"] as const) {
      await db.update(sessions).set({ status }).where(eq(sessions.id, session.id));
      await db.update(webinars).set({ status }).where(eq(webinars.id, webinar.id));
      await expect(registerForSession(a.id, session.id)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      await expect(registerForWebinar(a.id, webinar.id)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    }
    await db.update(sessions).set({ status: "scheduled", priceHt: "100.00" }).where(eq(sessions.id, session.id));
    await expect(registerForSession(a.id, session.id)).rejects.toThrow("rattachée");
    await db.update(sessions).set({ priceHt: "0.00", startDate: new Date(0) }).where(eq(sessions.id, session.id));
    await expect(registerForSession(a.id, session.id)).rejects.toThrow("commencé");
    await db.update(webinars).set({ status: "scheduled", scheduledAt: new Date(0) }).where(eq(webinars.id, webinar.id));
    await expect(registerForWebinar(a.id, webinar.id)).rejects.toThrow("commencé");
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, a.id));
    await expect(registerForSession(a.id, session.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await db.select().from(sessionRegistrations).where(eq(sessionRegistrations.sessionId, session.id))).toHaveLength(0);
  });
  it("cancels once, releases capacity, retains history and prevents foreign or late cancellation", async () => {
    const { db, a, b, session } = await fixture();
    await registerForSession(a.id, session.id);
    await expect(cancelSessionReservation(b.id, session.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await Promise.all([cancelSessionReservation(a.id, session.id), cancelSessionReservation(a.id, session.id)]);
    expect((await getUserSessions(a.id))[0].registrationStatus).toBe("cancelled");
    expect((await db.select().from(sessions).where(eq(sessions.id, session.id)))[0]).toMatchObject({ status: "scheduled", seatsTaken: 0 });
    const events = await db.select().from(sessionAdmissionEvents).where(eq(sessionAdmissionEvents.sessionId, session.id));
    expect(events.map(e => e.action).sort()).toEqual(["cancelled", "registered"]);
    await expect(db.delete(sessionAdmissionEvents).where(eq(sessionAdmissionEvents.sessionId, session.id))).rejects.toThrow();
    await expect(db.delete(sessionRegistrations).where(eq(sessionRegistrations.sessionId, session.id))).rejects.toThrow();
    await expect(db.update(sessionRegistrations).set({ status: "registered" }).where(eq(sessionRegistrations.sessionId, session.id))).rejects.toThrow();
    await registerForSession(b.id, session.id);
    await db.update(sessions).set({ startDate: new Date(0) }).where(eq(sessions.id, session.id));
    await expect(cancelSessionReservation(b.id, session.id)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await deleteSession(session.id);
    expect((await getUserSessions(b.id))[0].status).toBe("cancelled");
    expect(await db.select().from(sessionRegistrations).where(eq(sessionRegistrations.sessionId, session.id))).toHaveLength(2);
  });

});
