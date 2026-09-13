import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb, getObjectiveCompletion, startExamSession, submitQuizAttempt, updateEnrollmentProgress, saveExamAnswers, finalizeExpiredExams, updateModuleProgress } from "./db";
import { learningObjectives, enrollments, examSessions, examFinalizationFailures, quizAttempts, quizQuestions, trainings, trainingModules, moduleProgress } from "../drizzle/schema";
import { issueCertificate } from "./certificate";

// Run only against an explicitly selected disposable database, never production.
const enabled = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!enabled)("exam integrity · PostgreSQL", () => {
  beforeAll(() => { process.env.DATABASE_URL = enabled!; });

  async function fixture(maxAttempts = 3) {
    const db = (await getDb())!;
    const [training] = await db.insert(trainings).values({ title: "Integration exam", slug: randomUUID(), maxAttempts, examTimeLimitMin: 30 }).returning();
    const [enrollment] = await db.insert(enrollments).values({ userId: 90001, trainingId: training.id }).returning();
    const [question] = await db.insert(quizQuestions).values({ trainingId: training.id, question: "Choose A", options: ["A", "B"], correctAnswer: [0] }).returning();
    const params = { userId: enrollment.userId, enrollmentId: enrollment.id, trainingId: training.id, attemptNumber: 99 };
    return { db, training, enrollment, question, params };
  }

  it.each([false,true])("uses recorded objective evidence without regrading (recorded: %s)", async recorded => {
    const {db,params,question,training}=await fixture();
    const [objective]=await db.insert(learningObjectives).values({trainingId:training.id,title:'Historical objective'}).returning();
    await db.update(quizQuestions).set({objectiveId:objective.id}).where(eq(quizQuestions.id,question.id));
    expect(await getObjectiveCompletion(params.enrollmentId)).toMatchObject([{isCompleted:false,unavailableQuestionCount:0}]);
    if (recorded) {
      const session=(await startExamSession(params))!;
      await submitQuizAttempt({...params,sessionId:session.sessionId,answers:{[question.id]:[0]}});
    } else {
      await db.insert(quizAttempts).values({...params,attemptNumber:1,answers:{[question.id]:[0]},score:1,totalPoints:1,percentage:'100',isPassed:true});
    }
    const expected=[{isCompleted:recorded,unavailableQuestionCount:recorded?0:1}];
    expect(await getObjectiveCompletion(params.enrollmentId)).toMatchObject(expected);
    await db.update(quizQuestions).set({correctAnswer:[1]}).where(eq(quizQuestions.id,question.id));
    expect(await getObjectiveCompletion(params.enrollmentId)).toMatchObject(expected);
    expect((await db.select().from(quizAttempts).where(eq(quizAttempts.enrollmentId,params.enrollmentId)))[0]).toMatchObject({score:1,isPassed:true});
  });

  it("reuses one active session across concurrent starts and ignores client attempt numbers", async () => {
    const { db, params } = await fixture();
    const sessions = await Promise.all([startExamSession(params), startExamSession(params)]);
    expect(sessions[0]!.sessionId).toBe(sessions[1]!.sessionId);
    const rows = await db.select().from(examSessions).where(eq(examSessions.enrollmentId, params.enrollmentId));
    expect(rows).toHaveLength(1);
    expect(rows[0].attemptNumber).toBe(1);
  });

  it("resumes a second active attempt with its original deadline, questions and saved revision", async () => {
    const { db, params, question } = await fixture();
    const first = (await startExamSession(params))!;
    await submitQuizAttempt({ ...params, sessionId: first.sessionId, answers: { [question.id]: [1] } });
    const second = (await startExamSession(params))!;
    expect(second.attemptNumber).toBe(2);
    const answers = { [question.id]: [0] };
    await saveExamAnswers({ userId: params.userId, sessionId: second.sessionId, revision: 0, answers });
    const resumed = (await startExamSession({ ...params, attemptNumber: 1 }))!;
    expect(resumed).toMatchObject({ sessionId: second.sessionId, attemptNumber: 2, answerRevision: 1, savedAnswers: answers });
    expect(resumed.expiresAt).toEqual(second.expiresAt);
    expect(resumed.questions).toEqual(second.questions);
    expect(await db.select().from(examSessions).where(eq(examSessions.enrollmentId, params.enrollmentId))).toHaveLength(2);
  });

  it("returns the same result for concurrent submissions, persists one result and completes the enrollment", async () => {
    const { db, params, question } = await fixture();
    const session = (await startExamSession(params))!;
    const input = { ...params, sessionId: session.sessionId, answers: { [question.id]: [0] } };
    const results = await Promise.allSettled([submitQuizAttempt(input), submitQuizAttempt(input)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(2);
    const attempts = await db.select().from(quizAttempts).where(eq(quizAttempts.enrollmentId, params.enrollmentId));
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ isPassed: true, attemptNumber: 1 });
    // A response lost in transit must not allow a later payload to replace the recorded result.
    expect(await submitQuizAttempt({ ...input, answers: { [question.id]: [1] } })).toMatchObject({ isPassed: true, score: attempts[0].score });
    expect(await db.select().from(quizAttempts).where(eq(quizAttempts.enrollmentId, params.enrollmentId))).toHaveLength(1);
    await updateEnrollmentProgress(params.enrollmentId, 20, "in_progress");
    expect((await db.select().from(enrollments).where(eq(enrollments.id, params.enrollmentId)))[0].status).toBe("completed");
  });

  it("stores immutable feedback with the score and reuses it after the answer key changes", async () => {
    const { db, params, question } = await fixture();
    const session = (await startExamSession(params))!;
    const input = { ...params, sessionId: session.sessionId, answers: { [question.id]: [0] } };
    const first = await submitQuizAttempt(input);
    const [attempt] = await db.select().from(quizAttempts).where(eq(quizAttempts.enrollmentId, params.enrollmentId));
    expect(first).toMatchObject({feedbackAvailable: true, feedback: [{questionId: question.id, question: question.question, isCorrect: true}]});
    expect(attempt.feedback).toEqual(first!.feedback);
    await db.update(quizQuestions).set({correctAnswer: [1], explanation: 'Changed later'}).where(eq(quizQuestions.id, question.id));
    await expect(db.update(examSessions).set({questionSnapshot: [{...question, correctAnswer: [1], explanation: 'Changed snapshot'}]}).where(eq(examSessions.id, session.sessionId))).rejects.toThrow();
    expect(await submitQuizAttempt({...input, answers: {[question.id]: [1]}})).toEqual(first);
    await expect(db.update(quizAttempts).set({feedback: []}).where(eq(quizAttempts.id, attempt.id))).rejects.toThrow();
    await expect(db.update(quizAttempts).set({score: 0}).where(eq(quizAttempts.id, attempt.id))).rejects.toThrow();
    await expect(db.delete(quizAttempts).where(eq(quizAttempts.id, attempt.id))).rejects.toThrow();
    await expect(db.execute(sql`truncate quiz_attempts`)).rejects.toThrow();
  });

  it("does not regrade a stored result using the current grading implementation", async () => {
    const { db, params, question } = await fixture();
    const session = (await startExamSession(params))!;
    const feedback = [{questionId: question.id, isCorrect: false, explanation: 'Recorded by an earlier grader'}];
    await db.insert(quizAttempts).values({...params, attemptNumber: session.attemptNumber, score: 0, maxScore: 1, isPassed: false, answers: {[question.id]: [0]}, feedback});
    await db.update(examSessions).set({status: 'submitted', submittedAt: new Date()}).where(eq(examSessions.id, session.sessionId));
    expect(await submitQuizAttempt({...params, sessionId: session.sessionId, answers: {}})).toMatchObject({score: 0, isPassed: false, feedbackAvailable: true, feedback});
  });

  it("returns legacy recorded scores without inventing historical feedback", async () => {
    const { db, params, question } = await fixture();
    const session = (await startExamSession(params))!;
    await db.insert(quizAttempts).values({...params, attemptNumber: session.attemptNumber, score: 1, maxScore: 1, isPassed: true, answers: {[question.id]: [1]}});
    await db.update(examSessions).set({status: 'submitted', submittedAt: new Date()}).where(eq(examSessions.id, session.sessionId));
    expect(await submitQuizAttempt({...params, sessionId: session.sessionId, answers: {}})).toMatchObject({score: 1, isPassed: true, feedbackAvailable: false, feedback: []});
  });

  it("blocks missing, foreign and mismatched sessions", async () => {
    const { params, question } = await fixture();
    const session = (await startExamSession(params))!;
    const input = { ...params, sessionId: session.sessionId, answers: { [question.id]: [0] } };
    await expect(submitQuizAttempt({ ...input, sessionId: undefined })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(submitQuizAttempt({ ...input, userId: 90002 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(submitQuizAttempt({ ...input, trainingId: params.trainingId + 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("fails late answers even when correct and enforces the server attempt limit", async () => {
    const { db, params, question } = await fixture(1);
    const session = (await startExamSession(params))!;
    await db.update(examSessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(examSessions.id, session.sessionId));
    const result = await submitQuizAttempt({ ...params, sessionId: session.sessionId, answers: { [question.id]: [0] } });
    expect(result).toMatchObject({ isPassed: false, expired: true });
    await expect(startExamSession({ ...params, attemptNumber: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("preserves questions and passing threshold when the author edits the live bank", async () => {
    const { db, params, question } = await fixture();
    const session = (await startExamSession(params))!;
    await db.update(quizQuestions).set({ question: "Changed question", correctAnswer: [1] }).where(eq(quizQuestions.id, question.id));
    await db.update(trainings).set({ passingScore: 101 }).where(eq(trainings.id, params.trainingId));
    await expect(db.update(examSessions).set({ passingScoreSnapshot: 0 }).where(eq(examSessions.id, session.sessionId))).rejects.toThrow();
    const resumed = (await startExamSession(params))!;
    expect(resumed.questions[0].question).toBe("Choose A");
    expect(session.passingScore).toBe(75);
    expect(resumed.passingScore).toBe(75);
    expect(await submitQuizAttempt({ ...params, sessionId: session.sessionId, answers: { [question.id]: [0] } })).toMatchObject({ isPassed: true, passingScore: 75 });
    expect((await startExamSession(params))!).toMatchObject({ completed: true, passingScore: 75 });
  });

  it("resumes saved answers and rejects stale revisions, foreign candidates and late saves", async () => {
    const { db, params, question } = await fixture();
    const session = (await startExamSession(params))!;
    const input = { sessionId: session.sessionId, userId: params.userId, answers: { [question.id]: [0] }, revision: 0 };
    expect(await saveExamAnswers(input)).toMatchObject({ revision: 1 });
    expect((await startExamSession(params))!.savedAnswers).toEqual(input.answers);
    expect(await saveExamAnswers(input)).toMatchObject({ revision: 1 });
    await expect(saveExamAnswers({ ...input, answers: { [question.id]: [1] } })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(saveExamAnswers({ ...input, userId: 90002, revision: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.update(examSessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(examSessions.id, session.sessionId));
    await expect(saveExamAnswers({ ...input, revision: 1 })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("acknowledges concurrent identical save retries once without renewing their timestamp or accepting older revisions", async () => {
    const { db, params, question } = await fixture();
    const session = (await startExamSession(params))!;
    const input = { sessionId: session.sessionId, userId: params.userId, answers: { [question.id]: [0] }, revision: 0 };
    const results = await Promise.all([saveExamAnswers(input), saveExamAnswers(input), saveExamAnswers(input)]);
    expect(results[0].revision).toBe(1);
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
    const [stored] = await db.select().from(examSessions).where(eq(examSessions.id, session.sessionId));
    expect(stored.answerRevision).toBe(1);
    expect(stored.answersSavedAt).toEqual(results[0].savedAt);
    await saveExamAnswers({ ...input, revision: 1 });
    await expect(saveExamAnswers(input)).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(saveExamAnswers({ ...input, userId: 90002, revision: 1 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await db.update(examSessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(examSessions.id, session.sessionId));
    await expect(saveExamAnswers({ ...input, revision: 1 })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it("grades saved answers at expiry without trusting answers delivered after the deadline", async () => {
    const { db, params, question } = await fixture();
    const session = (await startExamSession(params))!;
    await saveExamAnswers({ sessionId: session.sessionId, userId: params.userId, answers: { [question.id]: [0] }, revision: 0 });
    await db.update(examSessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(examSessions.id, session.sessionId));
    await finalizeExpiredExams(params.enrollmentId);
    expect(await submitQuizAttempt({ ...params, sessionId: session.sessionId, answers: { [question.id]: [1] } })).toMatchObject({ isPassed: true, expired: true });
    const resumed = (await startExamSession(params))!;
    expect(resumed.completed).toBe(true);
    expect(resumed.sessionId).toBe(session.sessionId);
    expect(await db.select().from(quizAttempts).where(eq(quizAttempts.enrollmentId, params.enrollmentId))).toHaveLength(1);
  });

  it("does not certify a client completion percentage or a legacy completed flag without a passing result", async () => {
    const { db, params } = await fixture();
    await updateEnrollmentProgress(params.enrollmentId, 100);
    expect((await db.select().from(enrollments).where(eq(enrollments.id, params.enrollmentId)))[0].status).toBe("in_progress");
    await db.update(enrollments).set({ status: "completed" }).where(eq(enrollments.id, params.enrollmentId));
    expect(await issueCertificate(params.enrollmentId, "https://example.test")).toBeNull();
  });
  it("requires chapter passes, isolates attempts and reserves completion for the final", async () => {
    const { db, params, question } = await fixture(1);
    const chapters = await db.insert(trainingModules).values([
      { trainingId: params.trainingId, title: "Chapter one", quizPassingScore: 100, quizMaxAttempts: 1, quizTimeLimitMin: 5 },
      { trainingId: params.trainingId, title: "Chapter two", quizMaxAttempts: 2 },
      { trainingId: params.trainingId, title: "Optional", isRequired: false },
    ]).returning();
    const questions = await db.insert(quizQuestions).values(chapters.slice(0, 2).map(m => ({ trainingId: params.trainingId, moduleId: m.id, question: m.title, options: ["A", "B"], correctAnswer: [0] }))).returning();
    await updateEnrollmentProgress(params.enrollmentId, 100);
    await expect(startExamSession(params)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(updateModuleProgress(params.enrollmentId, chapters[0].id)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(startExamSession({ ...params, moduleId: -1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const first = (await startExamSession({ ...params, moduleId: chapters[0].id }))!;
    expect(first.questions.map(q => q.id)).toEqual([questions[0].id]);
    expect(first.timeLimitMin).toBe(5);
    expect(first.passingScore).toBe(100);
    await db.update(trainingModules).set({ quizPassingScore: 50 }).where(eq(trainingModules.id, chapters[0].id));
    expect((await startExamSession({ ...params, moduleId: chapters[0].id }))!.passingScore).toBe(100);
    await expect(db.update(examSessions).set({ moduleId: chapters[1].id }).where(eq(examSessions.id, first.sessionId))).rejects.toThrow();
    expect(await submitQuizAttempt({ ...params, sessionId: first.sessionId, answers: { [questions[0].id]: [0] } })).toMatchObject({ isPassed: true, passingScore: 100 });
    expect((await db.select().from(moduleProgress).where(eq(moduleProgress.enrollmentId, params.enrollmentId)))[0].isCompleted).toBe(true);
    expect((await db.select().from(enrollments).where(eq(enrollments.id, params.enrollmentId)))[0].status).toBe("in_progress");
    expect((await startExamSession({ ...params, moduleId: chapters[0].id }))!).toMatchObject({ completed: true, sessionId: first.sessionId, passingScore: 100 });
    await db.update(enrollments).set({ status: "completed" }).where(eq(enrollments.id, params.enrollmentId));
    expect(await issueCertificate(params.enrollmentId, "https://example.test")).toBeNull();
    await db.update(enrollments).set({ status: "in_progress" }).where(eq(enrollments.id, params.enrollmentId));
    await expect(startExamSession(params)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const second = (await startExamSession({ ...params, moduleId: chapters[1].id }))!;
    expect(second.attemptNumber).toBe(1);
    const failed = { ...params, sessionId: second.sessionId, answers: { [questions[1].id]: [1] } };
    expect(await submitQuizAttempt(failed)).toMatchObject({ isPassed: false });
    expect(await submitQuizAttempt(failed)).toMatchObject({ isPassed: false });
    const retry = (await startExamSession({ ...params, moduleId: chapters[1].id }))!;
    expect(retry.attemptNumber).toBe(2);
    await submitQuizAttempt({ ...params, sessionId: retry.sessionId, answers: { [questions[1].id]: [0] } });
    const final = (await startExamSession(params))!;
    expect(final.attemptNumber).toBe(1);
    expect(final.questions.map(q => q.id)).toEqual([question.id]);
    await submitQuizAttempt({ ...params, sessionId: final.sessionId, answers: { [question.id]: [0] } });
    expect((await db.select().from(enrollments).where(eq(enrollments.id, params.enrollmentId)))[0].status).toBe("completed");
  });

  it("isolates an incoherent expired session, records its failure and finalizes the next exam", async () => {
    const { db, params, question } = await fixture();
    const healthy = await startExamSession(params);
    await saveExamAnswers({ ...params, sessionId: healthy!.sessionId, answers: { [question.id]: [0] }, revision: 0 });
    await db.update(examSessions).set({ expiresAt: new Date(Date.now() - 60000) }).where(eq(examSessions.id, healthy!.sessionId));
    const [broken] = await db.insert(examSessions).values({ enrollmentId: params.enrollmentId, userId: params.userId, trainingId: params.trainingId, attemptNumber: 2, status: "active", questionIds: [2147483647], questionSnapshot: [], expiresAt: new Date(Date.now() - 120000) }).returning();
    expect(await finalizeExpiredExams(params.enrollmentId)).toEqual({ processed: 1, failed: 1 });
    expect((await db.select().from(examSessions).where(eq(examSessions.id, healthy!.sessionId)))[0].status).toBe("expired");
    expect((await db.select().from(examSessions).where(eq(examSessions.id, broken.id)))[0].status).toBe("active");
    const failures = await db.select().from(examFinalizationFailures).where(eq(examFinalizationFailures.examSessionId, broken.id));
    expect(failures).toHaveLength(1);
    expect(failures[0].errorCode).toBe("PRECONDITION_FAILED");
    expect(await finalizeExpiredExams(params.enrollmentId)).toEqual({ processed: 0, failed: 0 });
    // The global admin list contains only the oldest 100 failures; inspect this fixture directly.
    expect(await db.select().from(examFinalizationFailures).where(eq(examFinalizationFailures.examSessionId, broken.id))).toHaveLength(1);
    await expect(db.delete(examFinalizationFailures).where(eq(examFinalizationFailures.examSessionId, broken.id))).rejects.toThrow();
  });

});
