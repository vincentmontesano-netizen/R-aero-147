import { and, eq, ne, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb, type DatabaseTransaction } from "./db";
import { requireTrainingAccess } from "./learningAccess";
import { users, trainings, sessions, sessionRegistrations, sessionAdmissionEvents, webinars, webinarRegistrations } from "../drizzle/schema";

async function requireAdmission(userId: number, trainingId: number | null, paid: boolean) {
  const db = (await getDb())!;
  const [course] = trainingId ? await db.select().from(trainings).where(eq(trainings.id, trainingId)) : [];
  if (trainingId && (!course || !course.isPublished || course.archivedAt)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Formation indisponible à l’inscription." });
  if (paid || course?.ownerOrgId != null) {
    if (!trainingId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cette séance payante doit être rattachée à une formation avant réservation." });
    await requireTrainingAccess(userId, trainingId);
  }
}
async function lockActiveAdmissionUser(tx:DatabaseTransaction,userId:number){
  const [person]=await tx.select({status:users.status}).from(users).where(eq(users.id,userId)).for('share');
  if(person?.status!=='active')throw new TRPCError({code:'FORBIDDEN'});
}
export async function registerForSession(userId: number, sessionId: number) {
  const db = (await getDb())!;
  return db.transaction(async tx => {
    await lockActiveAdmissionUser(tx,userId);
    const [room] = await tx.select().from(sessions).where(eq(sessions.id, sessionId)).for("update");
    if (!room) throw new TRPCError({ code: "NOT_FOUND" });
    if (room.status === "cancelled" || room.status === "completed") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Les inscriptions à cette séance sont fermées." });
    await requireAdmission(userId, room.trainingId, Number(room.priceHt ?? 0) > 0);
    const [existing] = await tx.select().from(sessionRegistrations).where(and(eq(sessionRegistrations.sessionId, sessionId), eq(sessionRegistrations.userId, userId), ne(sessionRegistrations.status, "cancelled")));
    if (existing) return { success: true, message: "Déjà inscrit" };
    if (room.startDate.getTime() <= Date.now()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "La séance a commencé ; les nouvelles inscriptions sont fermées." });
    const [count] = await tx.select({ total: sql<number>`count(distinct ${sessionRegistrations.userId})::int` }).from(sessionRegistrations).where(and(eq(sessionRegistrations.sessionId, sessionId), ne(sessionRegistrations.status, "cancelled")));
    if (count.total >= (room.seats ?? 0)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Session complète." });
    const [registration] = await tx.insert(sessionRegistrations).values({ sessionId, userId }).returning();
    await tx.insert(sessionAdmissionEvents).values({ sessionId, userId, registrationId: registration.id, action: "registered", nextStatus: "registered" });
    const taken = count.total + 1;
    await tx.update(sessions).set({ seatsTaken: taken, status: taken >= (room.seats ?? 0) ? "full" : "scheduled" }).where(eq(sessions.id, sessionId));
    return { success: true, message: "Inscription confirmée" };
  });
}
export async function registerForWebinar(userId: number, webinarId: number) {
  const db = (await getDb())!;
  return db.transaction(async tx => {
    await lockActiveAdmissionUser(tx,userId);
    const [room] = await tx.select().from(webinars).where(eq(webinars.id, webinarId)).for("update");
    if (!room) throw new TRPCError({ code: "NOT_FOUND" });
    if (room.status === "cancelled" || room.status === "completed") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Les inscriptions à ce webinaire sont fermées." });
    await requireAdmission(userId, room.trainingId, false);
    const [existing] = await tx.select().from(webinarRegistrations).where(and(eq(webinarRegistrations.webinarId, webinarId), eq(webinarRegistrations.userId, userId)));
    if (existing) return { success: true };
    if (room.scheduledAt.getTime() <= Date.now()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Le webinaire a commencé ; les nouvelles inscriptions sont fermées." });
    const [count] = await tx.select({ total: sql<number>`count(distinct ${webinarRegistrations.userId})::int` }).from(webinarRegistrations).where(eq(webinarRegistrations.webinarId, webinarId));
    if (room.maxParticipants != null && count.total >= room.maxParticipants) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Webinaire complet." });
    await tx.insert(webinarRegistrations).values({ webinarId, userId });
    return { success: true };
  });
}

export async function cancelSessionReservation(userId: number, sessionId: number) {
  const db = (await getDb())!;
  return db.transaction(async tx => {
    await lockActiveAdmissionUser(tx,userId);
    const [room] = await tx.select().from(sessions).where(eq(sessions.id, sessionId)).for("update");
    if (!room) throw new TRPCError({ code: "NOT_FOUND" });
    const registrations = await tx.select().from(sessionRegistrations).where(and(eq(sessionRegistrations.sessionId, sessionId), eq(sessionRegistrations.userId, userId))).for("update");
    if (!registrations.length) throw new TRPCError({ code: "NOT_FOUND" });
    const active = registrations.filter(r => r.status === "registered");
    if (!active.length && registrations.every(r => r.status === "cancelled")) return { success: true };
    if (registrations.some(r => r.status === "attended") || room.status === "completed" || room.startDate.getTime() <= Date.now()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "L’annulation en ligne est possible uniquement avant le début de la séance." });
    for (const registration of active) {
      await tx.update(sessionRegistrations).set({ status: "cancelled" }).where(eq(sessionRegistrations.id, registration.id));
      await tx.insert(sessionAdmissionEvents).values({ sessionId, userId, registrationId: registration.id, action: "cancelled", previousStatus: "registered", nextStatus: "cancelled" });
    }
    const [count] = await tx.select({ total: sql<number>`count(distinct ${sessionRegistrations.userId})::int` }).from(sessionRegistrations).where(and(eq(sessionRegistrations.sessionId, sessionId), ne(sessionRegistrations.status, "cancelled")));
    await tx.update(sessions).set({ seatsTaken: count.total, ...(room.status === "full" && count.total < (room.seats ?? 0) ? { status: "scheduled" as const } : {}) }).where(eq(sessions.id, sessionId));
    return { success: true };
  });
}
