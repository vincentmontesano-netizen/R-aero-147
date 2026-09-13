import { liveAdmission, requireLiveAdmission } from "./liveAdmission";
import { requireTrainingAccess } from "./learningAccess";
import { TRPCError } from "@trpc/server";
import { z } from 'zod';
/**
 * Live classroom (TIER 2): Jitsi room access + presence, chat/Q&A, polls/quizzes,
 * and per-learner engagement scoring. Realtime is delivered by client polling — no
 * WebSocket. Rooms are keyed by (roomType ∈ "webinar"|"session", roomId).
 */
import { eq, and, desc, inArray, ne, lt, sql } from "drizzle-orm";
import { getDb, type DatabaseTransaction } from "./db";
import {
  liveReplayEvents, companies, liveInstructorAssignments, trainings, webinars, sessions, webinarRegistrations, sessionRegistrations, users,
  liveParticipants, livePresenceIntervals, liveMessages, livePolls, livePollVotes,
} from "../drizzle/schema";

type RoomType = "webinar" | "session";
const ONLINE_WINDOW_MS = 45_000;

export function roomNameFor(roomType: string, roomId: number, override?: string | null): string {
  return override && override.trim() ? override.trim() : `raero-${roomType}-${roomId}`;
}

async function loadRoom(db: any, roomType: RoomType, roomId: number) {
  if (roomType === "webinar") {
    const w = (await db.select().from(webinars).where(eq(webinars.id, roomId)).limit(1))[0];
    if (!w) return null;
    return { requiresPurchase: false, trainingId: w.trainingId, title: w.title, status: w.status, replayUrl: w.replayUrl, replayRevision: w.replayRevision, liveRoom: w.liveRoom, scheduledAt: w.scheduledAt, endsAt: w.durationMinutes && w.durationMinutes > 0 ? new Date(w.scheduledAt.getTime() + w.durationMinutes * 60_000) : null };
  }
  const s = (await db.select().from(sessions).where(eq(sessions.id, roomId)).limit(1))[0];
  if (!s) return null;
  return { requiresPurchase: Number(s.priceHt ?? 0) > 0, trainingId: s.trainingId, title: s.title, status: s.status, replayUrl: s.replayUrl, replayRevision: s.replayRevision, liveRoom: s.liveRoom, scheduledAt: s.startDate, endsAt: s.endDate };
}

async function isRegistered(db: any, roomType: RoomType, roomId: number, userId: number) {
  if (roomType === "webinar") {
    const r = await db.select().from(webinarRegistrations).where(and(eq(webinarRegistrations.webinarId, roomId), eq(webinarRegistrations.userId, userId))).limit(1);
    return !!r[0];
  }
  const r = await db.select().from(sessionRegistrations).where(and(eq(sessionRegistrations.sessionId, roomId), eq(sessionRegistrations.userId, userId), ne(sessionRegistrations.status, "cancelled"))).limit(1);
  return !!r[0];
}

export async function getLiveAccess(roomType: RoomType, roomId: number, identity: { id: number; role?: string; name?: string | null }) {
  const db = await getDb();
  if (!db) return null;
  const [user] = await db.select({ id: users.id, role: users.role, name: users.name, status: users.status }).from(users).where(eq(users.id, identity.id));
  if (!user || user.status !== "active") throw new TRPCError({ code: "FORBIDDEN" });
  const room = await loadRoom(db, roomType, roomId);
  if (!room) return null;
  let isModerator = user.role === "admin";
  if (user.role === "instructor") {
    const [assignment] = await db.select().from(liveInstructorAssignments).where(and(eq(liveInstructorAssignments.roomType,roomType),eq(liveInstructorAssignments.roomId,roomId),eq(liveInstructorAssignments.userId,user.id),eq(liveInstructorAssignments.active,true)));
    isModerator = !!assignment;
    if (isModerator && room.trainingId) {
      const [course] = await db.select().from(trainings).where(eq(trainings.id,room.trainingId));
      if (!course || course.archivedAt) isModerator = false;
      if (course?.ownerOrgId) { const [company] = await db.select().from(companies).where(eq(companies.id,course.ownerOrgId)); if(company?.status !== "ACTIVE") isModerator = false; }
    }
  }
  let registered = room.status !== "cancelled" && (isModerator || await isRegistered(db, roomType, roomId, user.id));
  if (registered && !isModerator) {
    const [course] = room.trainingId ? await db.select().from(trainings).where(eq(trainings.id, room.trainingId)) : [];
    if (room.requiresPurchase || course?.ownerOrgId != null) {
      try { if (!room.trainingId) throw new Error("Missing course"); await requireTrainingAccess(user.id, room.trainingId); } catch { registered = false; }
    }
  }
  return {
    roomType, roomId, title: room.title, status: room.status,
    roomName: registered ? roomNameFor(roomType, roomId, room.liveRoom) : null,
    replayRevision: registered ? room.replayRevision : null,
    replayUrl: registered ? room.replayUrl ?? null : null, isRegistered: registered, isModerator,
    displayName: user.name ?? "Participant",
    videoAdmission: liveAdmission(room.scheduledAt,room.endsAt,room.status,isModerator),
  };
}

export async function requireLiveRoom(roomType: RoomType, roomId: number, userId: number, moderator = false) {
  const access = await getLiveAccess(roomType, roomId, { id: userId });
  if (!access) throw new TRPCError({ code: "NOT_FOUND" });
  if (!access.isRegistered || (moderator && !access.isModerator)) throw new TRPCError({ code: "FORBIDDEN", message: "Vous n’avez pas accès à cette classe." });
  return access;
}

// ─── Presence ────────────────────────────────────────────────────────────────
export async function joinLiveRoom(roomType: RoomType, roomId: number, userId: number) {
  const access = await requireLiveRoom(roomType, roomId, userId);
  requireLiveAdmission(access.videoAdmission);
  const db = await getDb();
  if (!db) return;
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`live-presence:${roomType}:${roomId}:${userId}`}))`);
  const existing = (await tx.select().from(liveParticipants)
    .where(and(eq(liveParticipants.roomType, roomType), eq(liveParticipants.roomId, roomId), eq(liveParticipants.userId, userId))).limit(1))[0];
    const now = new Date();
    if (existing) {
      const elapsed = now.getTime() - existing.lastSeenAt.getTime();
      if (elapsed > 0) {
        await tx.insert(livePresenceIntervals).values({ roomType, roomId, userId, startedAt: existing.lastSeenAt, endedAt: now, creditedMilliseconds: elapsed <= ONLINE_WINDOW_MS ? elapsed : 0 });
        await tx.update(liveParticipants).set({ lastSeenAt: now }).where(eq(liveParticipants.id, existing.id));
      }
    } else {
      await tx.insert(liveParticipants).values({ roomType, roomId, userId, joinedAt: now, lastSeenAt: now });
    }
  });
  return { success: true };
}

export async function getParticipants(roomType: RoomType, roomId: number, userId: number) {
  await requireLiveRoom(roomType, roomId, userId);
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(liveParticipants).where(and(eq(liveParticipants.roomType, roomType), eq(liveParticipants.roomId, roomId)));
  const names = await namesFor(db, rows.map((r: any) => r.userId));
  const now = Date.now();
  return rows.map((r: any) => ({
    userId: r.userId, name: names[r.userId] ?? `#${r.userId}`,
    online: now - new Date(r.lastSeenAt).getTime() < ONLINE_WINDOW_MS,
    joinedAt: r.joinedAt,
  })).sort((a: any, b: any) => Number(b.online) - Number(a.online));
}

async function namesFor(db: any, userIds: number[]): Promise<Record<number, string>> {
  const unique = Array.from(new Set(userIds)).filter(Boolean);
  if (!unique.length) return {};
  const us = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, unique));
  const map: Record<number, string> = {};
  for (const u of us) map[u.id] = u.name ?? `#${u.id}`;
  return map;
}

// ─── Chat & Q&A ──────────────────────────────────────────────────────────────
export async function postLiveMessage(params: { roomType: RoomType; roomId: number; userId: number; kind: "chat" | "qa"; content: string; requestId?: string }) {
  await requireLiveRoom(params.roomType, params.roomId, params.userId);
  const content = params.content.trim();
  if (!content || content.length > 4000 || (params.requestId !== undefined && !z.string().uuid().safeParse(params.requestId).success)) throw new TRPCError({ code: 'BAD_REQUEST' });
  const requestId = params.requestId?.toLowerCase();
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    if (requestId) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`live-message:${params.userId}:${requestId}`}))`);
      const [existing] = await tx.select().from(liveMessages).where(and(eq(liveMessages.userId, params.userId), eq(liveMessages.requestId, requestId)));
      if (existing) {
        if (existing.roomType !== params.roomType || existing.roomId !== params.roomId || existing.kind !== params.kind || existing.content !== content) throw new TRPCError({ code: 'CONFLICT', message: 'Cette demande correspond déjà à un autre message.' });
        return { success: true, messageId: existing.id };
      }
    }
    const [message] = await tx.insert(liveMessages).values({ roomType: params.roomType, roomId: params.roomId, userId: params.userId, kind: params.kind, content, requestId }).returning({ id: liveMessages.id });
    return { success: true, messageId: message.id };
  });
}

export async function getLiveMessages(roomType: RoomType, roomId: number, userId: number) {
  await requireLiveRoom(roomType, roomId, userId);
  const db = await getDb();
  if (!db) return { chat: [], qa: [] };
  const rows = await db.select().from(liveMessages)
    .where(and(eq(liveMessages.roomType, roomType), eq(liveMessages.roomId, roomId))).orderBy(liveMessages.createdAt);
  const names = await namesFor(db, rows.map((r: any) => r.userId));
  const decorate = ({ requestId: _requestId, ...r }: typeof liveMessages.$inferSelect) => ({ ...r, authorName: names[r.userId] ?? `#${r.userId}` });
  return {
    chat: rows.filter((r: any) => r.kind === "chat").map(decorate),
    qa: rows.filter((r: any) => r.kind === "qa").map(decorate),
  };
}

export async function setMessageAnswered(messageId: number, answeredByUserId: number) {
  const db = await getDb();
  if (!db) return;
  const [message] = await db.select().from(liveMessages).where(eq(liveMessages.id, messageId));
  if (!message) throw new TRPCError({ code: "NOT_FOUND" });
  await requireLiveRoom(message.roomType as RoomType, message.roomId, answeredByUserId, true);
  if (message.kind !== "qa") throw new TRPCError({ code: "BAD_REQUEST", message: "Seule une question peut être marquée comme traitée." });
  await db.update(liveMessages).set({ isAnswered: true, answeredByUserId })
    .where(and(eq(liveMessages.id, messageId), sql`${liveMessages.isAnswered} IS DISTINCT FROM TRUE`));
  return { success: true };
}

// ─── Polls & live quizzes ──────────────────────────────────────────────────────
export async function createLivePoll(params: { roomType: RoomType; roomId: number; kind: "poll" | "quiz"; question: string; options: string[]; correct?: number[] }, userId: number) {
  await requireLiveRoom(params.roomType, params.roomId, userId, true);
  if (params.options.length < 2 || params.options.length > 10 || params.options.some(o => !o.trim()) || (params.kind === "quiz" && !params.correct?.length) || params.correct?.some(c => !Number.isInteger(c) || c < 0 || c >= params.options.length)) throw new TRPCError({ code: "BAD_REQUEST", message: "Options ou correction invalides." });
  const db = await getDb();
  if (!db) return null;
  const ins = await db.insert(livePolls).values({
    roomType: params.roomType, roomId: params.roomId, kind: params.kind,
    question: params.question, options: params.options, correct: params.correct ?? null, isOpen: true,
  }).returning({ id: livePolls.id });
  return { id: ins[0]?.id };
}

export async function closeLivePoll(pollId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  const [poll] = await db.select().from(livePolls).where(eq(livePolls.id, pollId));
  if (!poll) throw new TRPCError({ code: "NOT_FOUND" });
  await requireLiveRoom(poll.roomType as RoomType, poll.roomId, userId, true);
  await db.update(livePolls).set({ isOpen: false }).where(eq(livePolls.id, pollId));
  return { success: true };
}

export async function voteLivePoll(params: { pollId: number; userId: number; choices: number[] }) {
  const db = await getDb();
  if (!db) return;
  return db.transaction(async tx => {
    const [poll] = await tx.select().from(livePolls).where(eq(livePolls.id, params.pollId)).for("update");
    if (!poll) throw new TRPCError({ code: "NOT_FOUND" });
    await requireLiveRoom(poll.roomType as RoomType, poll.roomId, params.userId);
    if (!poll.isOpen) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ce vote est clos." });
    if (!params.choices.length || new Set(params.choices).size !== params.choices.length || params.choices.some(c => !Number.isInteger(c) || c < 0 || c >= (poll.options ?? []).length)) throw new TRPCError({ code: "BAD_REQUEST" });
    const [existing] = await tx.select().from(livePollVotes).where(and(eq(livePollVotes.pollId, params.pollId), eq(livePollVotes.userId, params.userId)));
    if (existing) await tx.update(livePollVotes).set({ choices: params.choices }).where(eq(livePollVotes.id, existing.id));
    else await tx.insert(livePollVotes).values({ pollId: params.pollId, userId: params.userId, choices: params.choices });
    return { success: true };
  });
}

// Polls with aggregated counts per option (instructor sees "quiz" correctness too).
export async function getLivePolls(roomType: RoomType, roomId: number, userId: number) {
  const access = await requireLiveRoom(roomType, roomId, userId);
  const db = await getDb();
  if (!db) return [];
  const polls = await db.select().from(livePolls)
    .where(and(eq(livePolls.roomType, roomType), eq(livePolls.roomId, roomId))).orderBy(desc(livePolls.createdAt), desc(livePolls.id));
  if (!polls.length) return [];
  const summaries = new Map(polls.map(p => [p.id, {
    counts: (p.options ?? []).map(() => 0), totalVotes: 0, myChoices: [] as number[],
  }]));
  const votes = await db.select({ pollId: livePollVotes.pollId, userId: livePollVotes.userId, choices: livePollVotes.choices })
    .from(livePollVotes).where(inArray(livePollVotes.pollId, polls.map(p => p.id)));
  for (const vote of votes) {
    const summary = summaries.get(vote.pollId)!;
    summary.totalVotes++;
    if (vote.userId === userId) summary.myChoices = vote.choices ?? [];
    for (const choice of Array.from(new Set(vote.choices ?? []))) {
      if (Number.isInteger(choice) && choice >= 0 && choice < summary.counts.length) summary.counts[choice]++;
    }
  }
  return polls.map(p => {
    const summary = summaries.get(p.id)!;
    return { id: p.id, kind: p.kind, question: p.question, options: p.options, isOpen: p.isOpen, createdAt: p.createdAt,
      correct: access.isModerator || !p.isOpen ? p.correct : null,
      counts: !access.isModerator && p.kind === "quiz" && p.isOpen ? [] : summary.counts,
      totalVotes: summary.totalVotes, myChoices: summary.myChoices,
    };
  });
}

// ─── Engagement scoring (computed, no extra table) ────────────────────────────
export async function getEngagementScores(roomType: RoomType, roomId: number, userId: number) {
  await requireLiveRoom(roomType, roomId, userId, true);
  const db = await getDb();
  if (!db) return [];
  const parts = await db.select().from(liveParticipants).where(and(eq(liveParticipants.roomType, roomType), eq(liveParticipants.roomId, roomId)));
  const msgs = await db.select().from(liveMessages).where(and(eq(liveMessages.roomType, roomType), eq(liveMessages.roomId, roomId)));
  const polls = await db.select().from(livePolls).where(and(eq(livePolls.roomType, roomType), eq(livePolls.roomId, roomId)));
  const pollById = new Map(polls.map((p: any) => [p.id, p]));
  const votes = polls.length ? await db.select().from(livePollVotes).where(inArray(livePollVotes.pollId, polls.map((p: any) => p.id))) : [];
  const userIds = Array.from(new Set([...parts.map((p: any) => p.userId), ...msgs.map((m: any) => m.userId), ...votes.map((v: any) => v.userId)]));
  const names = await namesFor(db, userIds);

  const observed = await db.select({ userId: livePresenceIntervals.userId, milliseconds: sql<string>`sum(${livePresenceIntervals.creditedMilliseconds})` }).from(livePresenceIntervals)
    .where(and(eq(livePresenceIntervals.roomType, roomType), eq(livePresenceIntervals.roomId, roomId))).groupBy(livePresenceIntervals.userId);
  const observedByUser = new Map(observed.map(row => [row.userId, Number(row.milliseconds)]));
  const scores = userIds.map((uid) => {
    const attendanceMin = Math.floor((observedByUser.get(uid) ?? 0) / 60000);
    const chat = msgs.filter((m: any) => m.userId === uid && m.kind === "chat").length;
    const qa = msgs.filter((m: any) => m.userId === uid && m.kind === "qa").length;
    const userVotes = votes.filter((v: any) => v.userId === uid);
    let quizCorrect = 0;
    for (const v of userVotes) {
      const poll: any = pollById.get(v.pollId);
      if (poll?.kind === "quiz" && poll.correct) {
        const c = poll.correct as number[]; const ch = (v.choices ?? []) as number[];
        if (c.length === ch.length && c.every((x) => ch.includes(x))) quizCorrect++;
      }
    }
    const score = chat * 2 + qa * 3 + userVotes.length * 2 + quizCorrect * 5 + Math.round(Math.min(attendanceMin, 60) * 0.5);
    return { userId: uid, name: names[uid] ?? `#${uid}`, attendanceMin, chat, qa, votes: userVotes.length, quizCorrect, score };
  });
  return scores.sort((a, b) => b.score - a.score);
}

// ─── Replay ────────────────────────────────────────────────────────────────────
async function requireReplayModerator(tx: DatabaseTransaction, roomType: RoomType, roomId: number, userId: number, lock: 'share' | 'update') {
    const [actor] = await tx.select().from(users).where(eq(users.id, userId)).for('share');
    if (!actor || actor.status !== 'active' || !['admin', 'instructor'].includes(actor.role)) throw new TRPCError({ code: 'FORBIDDEN' });
    const table = roomType === 'webinar' ? webinars : sessions;
    const [room] = await tx.select().from(table).where(eq(table.id, roomId)).for(lock);
    if (!room) throw new TRPCError({ code: 'NOT_FOUND' });
    if (room.status === 'cancelled') throw new TRPCError({ code: 'FORBIDDEN' });
    if (actor.role !== 'admin') {
      const [assignment] = await tx.select().from(liveInstructorAssignments).where(and(
        eq(liveInstructorAssignments.roomType, roomType), eq(liveInstructorAssignments.roomId, roomId),
        eq(liveInstructorAssignments.userId, userId), eq(liveInstructorAssignments.active, true),
      )).for('share');
      if (!assignment) throw new TRPCError({ code: 'FORBIDDEN' });
      if (room.trainingId) {
        const [course] = await tx.select().from(trainings).where(eq(trainings.id, room.trainingId)).for('share');
        if (!course || course.archivedAt) throw new TRPCError({ code: 'FORBIDDEN' });
        if (course.ownerOrgId) {
          const [company] = await tx.select().from(companies).where(eq(companies.id, course.ownerOrgId)).for('share');
          if (company?.status !== 'ACTIVE') throw new TRPCError({ code: 'FORBIDDEN' });
        }
      }
    }
    return {room,table};
}

export const replayHistoryInput = z.object({roomType:z.enum(['session','webinar']),roomId:z.number().int().positive().max(2147483647),beforeId:z.number().int().positive().max(2147483647).optional()}).strict();
export async function getReplayHistory(userId:number, raw:z.infer<typeof replayHistoryInput>) {
 const parsed=replayHistoryInput.safeParse(raw);
 if(!parsed.success)throw new TRPCError({code:'BAD_REQUEST'});
 const {roomType,roomId,beforeId}=parsed.data;
 const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
 return db.transaction(async tx=>{
  await requireReplayModerator(tx,roomType,roomId,userId,'share');
  const rows=await tx.select().from(liveReplayEvents).where(and(eq(liveReplayEvents.roomType,roomType),eq(liveReplayEvents.roomId,roomId),beforeId?lt(liveReplayEvents.id,beforeId):undefined)).orderBy(desc(liveReplayEvents.id)).limit(51);
  return {entries:rows.slice(0,50),nextCursor:rows.length>50?rows[49].id:null};
 });
}

export async function setReplayUrl(roomType: RoomType, roomId: number, url: string, userId: number, expectedRevision: number) {
  const parsed = z.object({
    roomType: z.enum(['webinar', 'session']),
    roomId: z.number().int().positive().max(2147483647),
    userId: z.number().int().positive().max(2147483647),
    url: z.string().url().max(512).refine(value => value.startsWith('https://')),
    expectedRevision: z.number().int().min(0).max(2147483647),
  }).safeParse({ roomType, roomId, userId, url, expectedRevision });
  if (!parsed.success) throw new TRPCError({ code: 'BAD_REQUEST' });
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
  return db.transaction(async tx => {
    const {room,table}=await requireReplayModerator(tx,roomType,roomId,userId,'update');
    if (room.replayUrl === url && room.status === 'completed') return { success: true };
    if (room.replayRevision !== expectedRevision) throw new TRPCError({code:'CONFLICT',message:'La classe a changé. Relisez son état avant de modifier le replay.'});
    await tx.update(table).set({ replayUrl: url, status: 'completed' }).where(eq(table.id, roomId));
    await tx.execute(sql`insert into live_replay_events ("roomType","roomId","actorId","previousStatus",status,"previousUrl",url)
      values (${roomType},${roomId},${userId},${room.status},'completed',${room.replayUrl},${url})`);
    return { success: true };
  });
}

export async function getPresenceHistory(roomType: RoomType, roomId: number, userId: number, beforeId?: number) {
  await requireLiveRoom(roomType, roomId, userId, true);
  const db = (await getDb())!;
  const rows = await db.select().from(livePresenceIntervals).where(and(eq(livePresenceIntervals.roomType, roomType), eq(livePresenceIntervals.roomId, roomId), beforeId ? lt(livePresenceIntervals.id, beforeId) : undefined)).orderBy(desc(livePresenceIntervals.id)).limit(101);
  const entries = rows.slice(0, 100);
  return { entries, nextCursor: rows.length > 100 ? entries[entries.length - 1].id : null };
}
