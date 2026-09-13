import { joinLiveRoom } from "./live";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { issueLiveVideoTicket } from "./liveVideo";
import { liveInstructorAssignments, users, trainings, sessions, sessionRegistrations, liveVideoTickets, webinars, webinarRegistrations, liveParticipants } from "../drizzle/schema";
const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)("signed video admission · PostgreSQL", () => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const appId = "vpaas-magic-cookie-fixture";
  beforeAll(() => {
    process.env.DATABASE_URL = url!;
    vi.stubEnv("JAAS_APP_ID", appId);
    vi.stubEnv("JAAS_API_KEY_ID", `${appId}/fixturekey`);
    vi.stubEnv("JAAS_PRIVATE_KEY", pair.privateKey.export({ format: "pem", type: "pkcs8" }).toString());
  });
  afterAll(() => vi.unstubAllEnvs());
  async function fixture() {
    const db = (await getDb())!;
    const [owner, learner, outsider] = await db.insert(users).values([{ openId: randomUUID(), name: "Teacher", role: "instructor" }, { openId: randomUUID(), name: "Learner", email: `${randomUUID()}@example.test` }, { openId: randomUUID(), role: "instructor" }]).returning();
    const [course] = await db.insert(trainings).values({ title: "Private meeting", slug: randomUUID(), type: "webinar", ownerUserId: owner.id }).returning();
    const [room] = await db.insert(sessions).values({ trainingId: course.id, title: "Meeting", startDate: new Date(), endDate: new Date(Date.now()+3600000), liveRoom: "*" }).returning();
    await db.insert(liveInstructorAssignments).values({roomType:"session",roomId:room.id,userId:owner.id,active:true});
    await db.insert(sessionRegistrations).values({ sessionId: room.id, userId: learner.id });
    return { db, owner, learner, outsider, room };
  }
  it("issues room-specific RSA tickets with server-derived roles, short expiry and no email or privileged features", async () => {
    const { db, owner, learner, room } = await fixture();
    for (const actor of [owner, learner]) {
      const ticket = await issueLiveVideoTicket("session", room.id, actor.id);
      const { payload, protectedHeader } = await jwtVerify(ticket.jwt, pair.publicKey, { audience: "jitsi", issuer: "chat", subject: appId, algorithms: ["RS256"] });
      expect(protectedHeader.kid).toBe(`${appId}/fixturekey`);
      expect(payload.room).toBe(`raero-session-${room.id}`);
      expect(ticket.roomName).toBe(`${appId}/raero-session-${room.id}`);
      expect(ticket.domain).toBe("8x8.vc");
      expect(payload.exp! - payload.iat!).toBe(600);
      expect(payload.context).toMatchObject({ user: { id: String(actor.id), moderator: actor.id === owner.id ? "true" : "false" }, room: { regex: false }, features: { recording: false, transcription: false, livestreaming: false } });
      expect(JSON.stringify(payload)).not.toContain("@example.test");
      await expect(jwtVerify(ticket.jwt, pair.publicKey, { currentDate: new Date((payload.exp! + 1) * 1000) })).rejects.toThrow();
      const [record] = await db.select().from(liveVideoTickets).where(eq(liveVideoTickets.id, payload.jti!));
      expect(record).toMatchObject({ userId: actor.id, roomId: room.id, moderator: actor.id === owner.id });
      expect(record).not.toHaveProperty("jwt");
      await expect(db.delete(liveVideoTickets).where(eq(liveVideoTickets.id, record.id))).rejects.toThrow();
    }
  });
  it("denies outsiders, inactive users, cancelled/completed rooms and missing provider configuration", async () => {
    const { db, learner, outsider, room } = await fixture();
    await expect(issueLiveVideoTicket("session", room.id, outsider.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, learner.id));
    await expect(issueLiveVideoTicket("session", room.id, learner.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.update(users).set({ status: "active" }).where(eq(users.id, learner.id));
    await db.update(sessions).set({ status: "completed" }).where(eq(sessions.id, room.id));
    await expect(issueLiveVideoTicket("session", room.id, learner.id)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await db.update(sessions).set({ status: "cancelled" }).where(eq(sessions.id, room.id));
    await expect(issueLiveVideoTicket("session", room.id, learner.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const next = await fixture();
    vi.stubEnv("JAAS_PRIVATE_KEY", "");
    await expect(issueLiveVideoTicket("session", next.room.id, next.learner.id)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(await db.select().from(liveVideoTickets).where(eq(liveVideoTickets.roomId, next.room.id))).toHaveLength(0);
  });
  it("enforces participant and moderator opening windows and caps ticket expiry at closing", async () => {
    vi.stubEnv("JAAS_PRIVATE_KEY", pair.privateKey.export({format:"pem",type:"pkcs8"}).toString());
    const f=await fixture();
    await f.db.update(sessions).set({startDate:new Date(Date.now()+20*60000),endDate:new Date(Date.now()+80*60000)}).where(eq(sessions.id,f.room.id));
    await expect(issueLiveVideoTicket("session",f.room.id,f.learner.id)).rejects.toMatchObject({code:"PRECONDITION_FAILED"});
    await expect(joinLiveRoom("session",f.room.id,f.learner.id)).rejects.toMatchObject({code:"PRECONDITION_FAILED"});
    await expect(issueLiveVideoTicket("session",f.room.id,f.owner.id)).resolves.toHaveProperty("jwt");
    const end=new Date(Date.now()-14*60000);
    await f.db.update(sessions).set({startDate:new Date(Date.now()-74*60000),endDate:end}).where(eq(sessions.id,f.room.id));
    const ticket=await issueLiveVideoTicket("session",f.room.id,f.learner.id);
    const {payload}=await jwtVerify(ticket.jwt,pair.publicKey);
    expect(payload.exp).toBe(Math.floor((end.getTime()+15*60000)/1000));
    expect(payload.exp!-payload.iat!).toBeLessThanOrEqual(60);
    await f.db.update(sessions).set({endDate:new Date(Date.now()-16*60000)}).where(eq(sessions.id,f.room.id));
    await expect(issueLiveVideoTicket("session",f.room.id,f.owner.id)).rejects.toMatchObject({code:"PRECONDITION_FAILED"});
    await expect(joinLiveRoom("session",f.room.id,f.learner.id)).rejects.toMatchObject({code:"PRECONDITION_FAILED"});
    expect(await f.db.select().from(liveParticipants).where(eq(liveParticipants.roomId,f.room.id))).toHaveLength(0);
  });
  it("requires a valid session end and a positive webinar duration",async()=>{
    const f=await fixture();
    await f.db.update(sessions).set({endDate:null}).where(eq(sessions.id,f.room.id));
    await expect(issueLiveVideoTicket("session",f.room.id,f.owner.id)).rejects.toMatchObject({code:"PRECONDITION_FAILED"});
    await f.db.update(sessions).set({endDate:new Date(Date.now()-60000)}).where(eq(sessions.id,f.room.id));
    await expect(issueLiveVideoTicket("session",f.room.id,f.owner.id)).rejects.toMatchObject({code:"PRECONDITION_FAILED"});
    const [webinar]=await f.db.insert(webinars).values({title:"Timed webinar",scheduledAt:new Date(),durationMinutes:60}).returning();
    await f.db.insert(webinarRegistrations).values({webinarId:webinar.id,userId:f.learner.id});
    await expect(issueLiveVideoTicket("webinar",webinar.id,f.learner.id)).resolves.toHaveProperty("jwt");
    await f.db.update(webinars).set({durationMinutes:0}).where(eq(webinars.id,webinar.id));
    await expect(issueLiveVideoTicket("webinar",webinar.id,f.learner.id)).rejects.toMatchObject({code:"PRECONDITION_FAILED"});
  });

});
