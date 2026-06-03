/**
 * Live classroom (TIER 2): Jitsi room access + presence, chat/Q&A, polls/quizzes,
 * and per-learner engagement scoring. Realtime is delivered by client polling — no
 * WebSocket. Rooms are keyed by (roomType ∈ "webinar"|"session", roomId).
 */
import { eq, and, desc, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  webinars, sessions, webinarRegistrations, sessionRegistrations, users,
  liveParticipants, liveMessages, livePolls, livePollVotes,
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
    return { title: w.title, status: w.status, replayUrl: w.replayUrl, liveRoom: w.liveRoom, scheduledAt: w.scheduledAt };
  }
  const s = (await db.select().from(sessions).where(eq(sessions.id, roomId)).limit(1))[0];
  if (!s) return null;
  return { title: s.title, status: s.status, replayUrl: s.replayUrl, liveRoom: s.liveRoom, scheduledAt: s.startDate };
}

async function isRegistered(db: any, roomType: RoomType, roomId: number, userId: number) {
  if (roomType === "webinar") {
    const r = await db.select().from(webinarRegistrations).where(and(eq(webinarRegistrations.webinarId, roomId), eq(webinarRegistrations.userId, userId))).limit(1);
    return !!r[0];
  }
  const r = await db.select().from(sessionRegistrations).where(and(eq(sessionRegistrations.sessionId, roomId), eq(sessionRegistrations.userId, userId))).limit(1);
  return !!r[0];
}

export async function getLiveAccess(roomType: RoomType, roomId: number, user: { id: number; role: string; name?: string | null }) {
  const db = await getDb();
  if (!db) return null;
  const room = await loadRoom(db, roomType, roomId);
  if (!room) return null;
  const isModerator = user.role === "admin" || user.role === "instructor";
  const registered = isModerator ? true : await isRegistered(db, roomType, roomId, user.id);
  return {
    roomType, roomId, title: room.title, status: room.status,
    roomName: roomNameFor(roomType, roomId, room.liveRoom),
    replayUrl: room.replayUrl ?? null, isRegistered: registered, isModerator,
    displayName: user.name ?? "Participant",
  };
}

// ─── Presence ────────────────────────────────────────────────────────────────
export async function joinLiveRoom(roomType: RoomType, roomId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  const existing = (await db.select().from(liveParticipants)
    .where(and(eq(liveParticipants.roomType, roomType), eq(liveParticipants.roomId, roomId), eq(liveParticipants.userId, userId))).limit(1))[0];
  if (existing) {
    await db.update(liveParticipants).set({ lastSeenAt: new Date() }).where(eq(liveParticipants.id, existing.id));
  } else {
    await db.insert(liveParticipants).values({ roomType, roomId, userId });
  }
  return { success: true };
}

export async function getParticipants(roomType: RoomType, roomId: number) {
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
  const us = await db.select().from(users).where(inArray(users.id, unique));
  const map: Record<number, string> = {};
  for (const u of us) map[u.id] = u.name ?? u.email ?? `#${u.id}`;
  return map;
}

// ─── Chat & Q&A ──────────────────────────────────────────────────────────────
export async function postLiveMessage(params: { roomType: RoomType; roomId: number; userId: number; kind: "chat" | "qa"; content: string }) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(liveMessages).values({ roomType: params.roomType, roomId: params.roomId, userId: params.userId, kind: params.kind, content: params.content });
  return { success: true };
}

export async function getLiveMessages(roomType: RoomType, roomId: number) {
  const db = await getDb();
  if (!db) return { chat: [], qa: [] };
  const rows = await db.select().from(liveMessages)
    .where(and(eq(liveMessages.roomType, roomType), eq(liveMessages.roomId, roomId))).orderBy(liveMessages.createdAt);
  const names = await namesFor(db, rows.map((r: any) => r.userId));
  const decorate = (r: any) => ({ ...r, authorName: names[r.userId] ?? `#${r.userId}` });
  return {
    chat: rows.filter((r: any) => r.kind === "chat").map(decorate),
    qa: rows.filter((r: any) => r.kind === "qa").map(decorate),
  };
}

export async function setMessageAnswered(messageId: number, answeredByUserId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(liveMessages).set({ isAnswered: true, answeredByUserId }).where(eq(liveMessages.id, messageId));
  return { success: true };
}

// ─── Polls & live quizzes ──────────────────────────────────────────────────────
export async function createLivePoll(params: { roomType: RoomType; roomId: number; kind: "poll" | "quiz"; question: string; options: string[]; correct?: number[] }) {
  const db = await getDb();
  if (!db) return null;
  const ins = await db.insert(livePolls).values({
    roomType: params.roomType, roomId: params.roomId, kind: params.kind,
    question: params.question, options: params.options, correct: params.correct ?? null, isOpen: true,
  }).returning({ id: livePolls.id });
  return { id: ins[0]?.id };
}

export async function closeLivePoll(pollId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(livePolls).set({ isOpen: false }).where(eq(livePolls.id, pollId));
  return { success: true };
}

export async function voteLivePoll(params: { pollId: number; userId: number; choices: number[] }) {
  const db = await getDb();
  if (!db) return;
  const poll = (await db.select().from(livePolls).where(eq(livePolls.id, params.pollId)).limit(1))[0];
  if (!poll || !poll.isOpen) return { success: false };
  const existing = (await db.select().from(livePollVotes).where(and(eq(livePollVotes.pollId, params.pollId), eq(livePollVotes.userId, params.userId))).limit(1))[0];
  if (existing) {
    await db.update(livePollVotes).set({ choices: params.choices }).where(eq(livePollVotes.id, existing.id));
  } else {
    await db.insert(livePollVotes).values({ pollId: params.pollId, userId: params.userId, choices: params.choices });
  }
  return { success: true };
}

// Polls with aggregated counts per option (instructor sees "quiz" correctness too).
export async function getLivePolls(roomType: RoomType, roomId: number) {
  const db = await getDb();
  if (!db) return [];
  const polls = await db.select().from(livePolls)
    .where(and(eq(livePolls.roomType, roomType), eq(livePolls.roomId, roomId))).orderBy(desc(livePolls.createdAt));
  const result = [];
  for (const p of polls) {
    const votes = await db.select().from(livePollVotes).where(eq(livePollVotes.pollId, p.id));
    const counts = (p.options ?? []).map((_: string, i: number) => votes.filter((v: any) => (v.choices ?? []).includes(i)).length);
    result.push({ ...p, counts, totalVotes: votes.length });
  }
  return result;
}

// ─── Engagement scoring (computed, no extra table) ────────────────────────────
export async function getEngagementScores(roomType: RoomType, roomId: number) {
  const db = await getDb();
  if (!db) return [];
  const parts = await db.select().from(liveParticipants).where(and(eq(liveParticipants.roomType, roomType), eq(liveParticipants.roomId, roomId)));
  const msgs = await db.select().from(liveMessages).where(and(eq(liveMessages.roomType, roomType), eq(liveMessages.roomId, roomId)));
  const polls = await db.select().from(livePolls).where(and(eq(livePolls.roomType, roomType), eq(livePolls.roomId, roomId)));
  const pollById = new Map(polls.map((p: any) => [p.id, p]));
  const votes = polls.length ? await db.select().from(livePollVotes).where(inArray(livePollVotes.pollId, polls.map((p: any) => p.id))) : [];
  const userIds = Array.from(new Set([...parts.map((p: any) => p.userId), ...msgs.map((m: any) => m.userId), ...votes.map((v: any) => v.userId)]));
  const names = await namesFor(db, userIds);

  const scores = userIds.map((uid) => {
    const part = parts.find((p: any) => p.userId === uid);
    const attendanceMin = part ? Math.min(120, Math.round((new Date(part.lastSeenAt).getTime() - new Date(part.joinedAt).getTime()) / 60000)) : 0;
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
export async function setReplayUrl(roomType: RoomType, roomId: number, url: string) {
  const db = await getDb();
  if (!db) return;
  if (roomType === "webinar") {
    await db.update(webinars).set({ replayUrl: url, status: "completed" }).where(eq(webinars.id, roomId));
  } else {
    await db.update(sessions).set({ replayUrl: url, status: "completed" }).where(eq(sessions.id, roomId));
  }
  return { success: true };
}
