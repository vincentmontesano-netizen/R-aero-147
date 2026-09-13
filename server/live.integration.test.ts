import { beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { getLiveAccess, joinLiveRoom, getLiveMessages, postLiveMessage, createLivePoll, getLivePolls, voteLivePoll, closeLivePoll, getEngagementScores, getPresenceHistory, setMessageAnswered } from "./live";
import { liveInstructorAssignments, users, trainings, sessions, sessionRegistrations, livePollVotes, liveParticipants, livePresenceIntervals, liveMessages, livePolls } from "../drizzle/schema";
const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)("live classroom scope · PostgreSQL", () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  async function fixture() {
    const db = (await getDb())!;
    const [owner, other, learner, outsider] = await db.insert(users).values(["instructor", "instructor", "user", "user"].map(role => ({ openId: randomUUID(), role: role as "instructor" | "user" }))).returning();
    const [course] = await db.insert(trainings).values({ title: "Classroom fixture", slug: randomUUID(), type: "webinar", ownerUserId: owner.id }).returning();
    const [room] = await db.insert(sessions).values({ trainingId: course.id, title: "Classroom", startDate: new Date(), endDate: new Date(Date.now()+3600000), liveRoom: "private-fixture-room", replayUrl: "https://example.test/private-replay" }).returning();
    await db.insert(liveInstructorAssignments).values({roomType:"session",roomId:room.id,userId:owner.id,active:true});
    await db.insert(sessionRegistrations).values({ sessionId: room.id, userId: learner.id });
    return { db, owner, other, learner, outsider, room };
  }
  it("denies outsiders on read/write and does not reveal room or replay addresses", async () => {
    const { outsider, room } = await fixture();
    const access = await getLiveAccess("session", room.id, outsider);
    expect(access).toMatchObject({ isRegistered: false, roomName: null, replayUrl: null });
    await expect(joinLiveRoom("session", room.id, outsider.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getLiveMessages("session", room.id, outsider.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(postLiveMessage({ roomType: "session", roomId: room.id, userId: outsider.id, kind: "chat", content: "intrusion" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("uses current account state instead of a stale role or display name for room access", async () => {
    const { db, learner, owner, room } = await fixture();
    await db.update(users).set({ name: 'Current participant' }).where(eq(users.id, learner.id));
    expect(await getLiveAccess('session', room.id, { ...learner, role: 'admin', name: 'Old name' })).toMatchObject({ isRegistered: true, isModerator: false, displayName: 'Current participant' });
    await db.update(users).set({ role: 'user' }).where(eq(users.id, owner.id));
    expect(await getLiveAccess('session', room.id, owner)).toMatchObject({ isRegistered: false, isModerator: false, roomName: null, replayUrl: null });
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, learner.id));
    await expect(getLiveAccess('session', room.id, learner)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(postLiveMessage({ roomType: 'session', roomId: room.id, userId: learner.id, kind: 'chat', content: 'Suspended' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it("records one message for concurrent retries and binds the request to its author and content", async () => {
    const { db, learner, owner, room } = await fixture();
    const input = { roomType: 'session' as const, roomId: room.id, userId: learner.id, kind: 'chat' as const, content: ' Bonjour ', requestId: randomUUID() };
    const receipts = await Promise.all([postLiveMessage(input), postLiveMessage(input), postLiveMessage({ ...input, requestId: input.requestId.toUpperCase() })]);
    expect(receipts[0]?.messageId).toBeGreaterThan(0);
    expect(receipts[1]).toEqual(receipts[0]); expect(receipts[2]).toEqual(receipts[0]);
    expect(await db.select().from(liveMessages).where(eq(liveMessages.roomId, room.id))).toHaveLength(1);
    await expect(postLiveMessage({ ...input, content: 'Different' })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(postLiveMessage({ ...input, kind: 'qa' })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await postLiveMessage({ ...input, userId: owner.id }))?.messageId).not.toBe(receipts[0]?.messageId);
    const messages = await getLiveMessages('session', room.id, learner.id);
    expect(messages.chat).toHaveLength(2);
    expect(messages.chat.every(message => message.content === 'Bonjour' && !('requestId' in message))).toBe(true);
    await db.update(sessionRegistrations).set({ status: 'cancelled' }).where(eq(sessionRegistrations.sessionId, room.id));
    await expect(postLiveMessage(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it("preserves the first question moderator across retries and concurrent confirmations", async () => {
    const { db, learner, owner, other, room } = await fixture();
    const post = (kind: 'chat' | 'qa') => postLiveMessage({ roomType: 'session', roomId: room.id, userId: learner.id, kind, content: 'Fixture message' });
    const question = (await post('qa'))!;
    await expect(setMessageAnswered(question.messageId, learner.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(setMessageAnswered(question.messageId, other.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await db.insert(liveInstructorAssignments).values({ roomType: 'session', roomId: room.id, userId: other.id, active: true });
    const read = async (id: number) => (await db.select().from(liveMessages).where(eq(liveMessages.id, id)))[0];
    await setMessageAnswered(question.messageId, owner.id);
    await Promise.all([setMessageAnswered(question.messageId, owner.id), setMessageAnswered(question.messageId, other.id)]);
    expect(await read(question.messageId)).toMatchObject({ isAnswered: true, answeredByUserId: owner.id });
    const concurrent = (await post('qa'))!;
    await Promise.all([setMessageAnswered(concurrent.messageId, owner.id), setMessageAnswered(concurrent.messageId, other.id)]);
    const recorded = (await read(concurrent.messageId)).answeredByUserId;
    expect([owner.id, other.id]).toContain(recorded);
    await setMessageAnswered(concurrent.messageId, recorded === owner.id ? other.id : owner.id);
    expect((await read(concurrent.messageId)).answeredByUserId).toBe(recorded);
    const chat = (await post('chat'))!;
    await expect(setMessageAnswered(chat.messageId, owner.id)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(await read(chat.messageId)).toMatchObject({ isAnswered: false, answeredByUserId: null });
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, owner.id));
    await expect(setMessageAnswered(question.messageId, owner.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it("limits moderators to their course and conceals open quiz keys and counts", async () => {
    const { db, owner, other, learner, room } = await fixture();
    const params = { roomType: "session" as const, roomId: room.id, kind: "quiz" as const, question: "Question?", options: ["A", "B"], correct: [1] };
    await expect(createLivePoll(params, other.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const poll = await createLivePoll(params, owner.id);
    await Promise.all([voteLivePoll({ pollId: poll!.id, userId: learner.id, choices: [1] }), voteLivePoll({ pollId: poll!.id, userId: learner.id, choices: [1] })]);
    expect(await db.select().from(livePollVotes).where(eq(livePollVotes.pollId, poll!.id))).toHaveLength(1);
    expect((await getLivePolls("session", room.id, learner.id))[0]).toMatchObject({ correct: null, counts: [], myChoices: [1] });
    expect((await getLivePolls("session", room.id, owner.id))[0].correct).toEqual([1]);
    await expect(closeLivePoll(poll!.id, other.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getEngagementScores("session", room.id, learner.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(voteLivePoll({ pollId: poll!.id, userId: learner.id, choices: [9] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await closeLivePoll(poll!.id, owner.id);
    expect((await getLivePolls("session", room.id, learner.id))[0].correct).toEqual([1]);
    await expect(voteLivePoll({ pollId: poll!.id, userId: learner.id, choices: [0] })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
  it("groups room poll results without mixing voters, rooms or hidden quiz corrections", async () => {
    const { db, owner, learner, room } = await fixture();
    const foreign = await fixture();
    const create = (kind: 'poll' | 'quiz', question: string) => createLivePoll({ roomType: 'session', roomId: room.id, kind, question, options: ['A', 'B', 'C'], correct: kind === 'quiz' ? [1] : undefined }, owner.id);
    const poll = (await create('poll', 'Poll'))!;
    const quiz = (await create('quiz', 'Quiz'))!;
    const empty = (await create('poll', 'Empty'))!;
    const elsewhere = (await createLivePoll({ roomType: 'session', roomId: foreign.room.id, kind: 'poll', question: 'Foreign', options: ['A', 'B'] }, foreign.owner.id))!;
    await voteLivePoll({ pollId: poll.id, userId: learner.id, choices: [0, 2] });
    await voteLivePoll({ pollId: poll.id, userId: owner.id, choices: [2] });
    await voteLivePoll({ pollId: quiz.id, userId: learner.id, choices: [1] });
    await voteLivePoll({ pollId: elsewhere.id, userId: foreign.learner.id, choices: [0] });
    // Identical timestamps still have a deterministic newest-first order.
    for (const id of [poll.id, quiz.id, empty.id]) await db.update(livePolls).set({ createdAt: new Date('2026-01-01T00:00:00Z') }).where(eq(livePolls.id, id));
    const participant = await getLivePolls('session', room.id, learner.id);
    expect(participant.map(p => p.id)).toEqual([empty.id, quiz.id, poll.id]);
    expect(participant[0]).toMatchObject({ counts: [0, 0, 0], totalVotes: 0, myChoices: [] });
    expect(participant[1]).toMatchObject({ counts: [], correct: null, totalVotes: 1, myChoices: [1] });
    expect(participant[2]).toMatchObject({ counts: [1, 0, 2], totalVotes: 2, myChoices: [0, 2] });
    const moderator = await getLivePolls('session', room.id, owner.id);
    expect(moderator[1]).toMatchObject({ counts: [0, 1, 0], correct: [1], myChoices: [] });
    expect(moderator[2].myChoices).toEqual([2]);
    expect(participant.every(p => !('userId' in p) && !('votes' in p))).toBe(true);
    await closeLivePoll(quiz.id, owner.id);
    expect((await getLivePolls('session', room.id, learner.id))[1]).toMatchObject({ counts: [0, 1, 0], correct: [1] });
  });

  it("rechecks cancelled registrations, paid access and concurrent presence", async () => {
    const { db, learner, room } = await fixture();
    await Promise.all([joinLiveRoom("session", room.id, learner.id), joinLiveRoom("session", room.id, learner.id)]);
    expect(await db.select().from(liveParticipants).where(eq(liveParticipants.roomId, room.id))).toHaveLength(1);
    await db.update(sessions).set({ priceHt: "100.00" }).where(eq(sessions.id, room.id));
    await expect(joinLiveRoom("session", room.id, learner.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.update(sessions).set({ priceHt: "0.00" }).where(eq(sessions.id, room.id));
    await db.update(sessionRegistrations).set({ status: "cancelled" }).where(eq(sessionRegistrations.sessionId, room.id));
    await expect(getLiveMessages("session", room.id, learner.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("counts only consecutive observed intervals and preserves an immutable presence journal", async () => {
    const { db, owner, learner, outsider, room } = await fixture();
    const start = Date.now();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(start);
      await joinLiveRoom("session", room.id, learner.id);
      for (const offset of [30000, 60000, 180000, 210000]) {
        vi.setSystemTime(start + offset);
        await joinLiveRoom("session", room.id, learner.id);
      }
      await Promise.all([joinLiveRoom("session", room.id, learner.id), joinLiveRoom("session", room.id, learner.id)]);
      const history = await getPresenceHistory("session", room.id, owner.id);
      expect(history.entries).toHaveLength(4);
      expect(history.entries.map(e => e.creditedMilliseconds)).toEqual([30000, 0, 30000, 30000]);
      expect((await getEngagementScores("session", room.id, owner.id))[0].attendanceMin).toBe(1);
      expect((await getPresenceHistory("session", room.id, owner.id, history.entries[1].id)).entries).toHaveLength(2);
      await expect(getPresenceHistory("session", room.id, outsider.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(getPresenceHistory("session", room.id, learner.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(db.delete(livePresenceIntervals).where(eq(livePresenceIntervals.roomId, room.id))).rejects.toThrow();
      await expect(db.update(livePresenceIntervals).set({ creditedMilliseconds: 45000 }).where(eq(livePresenceIntervals.roomId, room.id))).rejects.toThrow();
    } finally { vi.useRealTimers(); }
  });

});
