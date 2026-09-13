import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { supportStatusEvents,signoffs,credentialSharingEvents,certificateArchives,certificateRevocations,certificates,invoiceArchives,accountClosures,passportDocuments, passportEvents, verificationCases, verificationDocuments, supportTickets, messages, quizAttempts, examSessions, moduleProgress, objectiveProgress, enrollments, affiliations, livePresenceIntervals } from "../drizzle/schema";

/** Subject filters are applied in SQL; exam question snapshots/answer keys are never exported. */
export async function personalExportDetails(personId: number) {
  const db = (await getDb())!;
  const [documents, passportHistory, identityCases, identityDocuments, tickets, supportMessages, attempts, exams, chapters, objectives, organizationHistory, presence] = await Promise.all([
    db.select().from(passportDocuments).where(eq(passportDocuments.personId, personId)),
    db.select().from(passportEvents).where(eq(passportEvents.personId, personId)),
    db.select().from(verificationCases).where(and(eq(verificationCases.personId, personId), eq(verificationCases.kind, "KYC"))),
    db.select({ document: verificationDocuments }).from(verificationDocuments).innerJoin(verificationCases, eq(verificationCases.id, verificationDocuments.caseId)).where(and(eq(verificationCases.personId, personId), eq(verificationCases.kind, "KYC"))),
    db.select().from(supportTickets).where(eq(supportTickets.userId, personId)),
    db.select({ id: messages.id, ticketId: messages.ticketId, content: messages.content, createdAt: messages.createdAt, fromUserId: messages.fromUserId }).from(messages).innerJoin(supportTickets, eq(supportTickets.id, messages.ticketId)).where(eq(supportTickets.userId, personId)),
    db.select().from(quizAttempts).where(eq(quizAttempts.userId, personId)),
    db.select({ id: examSessions.id, enrollmentId: examSessions.enrollmentId, trainingId: examSessions.trainingId, moduleId: examSessions.moduleId, attemptNumber: examSessions.attemptNumber, savedAnswers: examSessions.savedAnswers, answerRevision: examSessions.answerRevision, answersSavedAt: examSessions.answersSavedAt, startedAt: examSessions.startedAt, submittedAt: examSessions.submittedAt, expiresAt: examSessions.expiresAt, status: examSessions.status }).from(examSessions).where(eq(examSessions.userId, personId)),
    db.select({ progress: moduleProgress }).from(moduleProgress).innerJoin(enrollments, eq(enrollments.id, moduleProgress.enrollmentId)).where(eq(enrollments.userId, personId)),
    db.select({ progress: objectiveProgress }).from(objectiveProgress).innerJoin(enrollments, eq(enrollments.id, objectiveProgress.enrollmentId)).where(eq(enrollments.userId, personId)),
    db.select().from(affiliations).where(eq(affiliations.personId, personId)),
    db.select().from(livePresenceIntervals).where(eq(livePresenceIntervals.userId, personId)),
  ]);
  const [decisions,sharing,certificateDocuments,revocations,invoices,closures,ticketHistory]=await Promise.all([
    db.select({id:signoffs.id,orgId:signoffs.orgId,managerPersonId:signoffs.managerPersonId,credentialId:signoffs.credentialId,trainingId:signoffs.trainingId,scope:signoffs.scope,decision:signoffs.decision,note:signoffs.note,snapshot:signoffs.snapshot,signedAt:signoffs.signedAt}).from(signoffs).where(eq(signoffs.subjectPersonId,personId)),
    db.select().from(credentialSharingEvents).where(eq(credentialSharingEvents.personId,personId)),
    db.select({certificateId:certificateArchives.certificateId,snapshot:certificateArchives.snapshot,sha256:certificateArchives.sha256,byteSize:certificateArchives.byteSize,createdAt:certificateArchives.createdAt}).from(certificateArchives).innerJoin(certificates,eq(certificates.id,certificateArchives.certificateId)).where(eq(certificates.userId,personId)),
    db.select({certificateId:certificateRevocations.certificateId,reason:certificateRevocations.reason,createdAt:certificateRevocations.createdAt}).from(certificateRevocations).innerJoin(certificates,eq(certificates.id,certificateRevocations.certificateId)).where(eq(certificates.userId,personId)),
    db.select({orderId:invoiceArchives.orderId,number:invoiceArchives.number,snapshot:invoiceArchives.snapshot,sha256:invoiceArchives.sha256,byteSize:invoiceArchives.byteSize,issuedAt:invoiceArchives.issuedAt}).from(invoiceArchives).where(eq(invoiceArchives.userId,personId)),
    db.select({personId:accountClosures.personId,actorId:accountClosures.actorId,retainedCredentials:accountClosures.retainedCredentials,createdAt:accountClosures.createdAt}).from(accountClosures).where(eq(accountClosures.personId,personId)),
    db.select({event:supportStatusEvents}).from(supportStatusEvents).innerJoin(supportTickets,eq(supportTickets.id,supportStatusEvents.ticketId)).where(eq(supportTickets.userId,personId)),
  ]);
  return {
    passport: { documents, history: passportHistory }, identityVerification: { cases: identityCases, documents: identityDocuments.map(r => r.document) },
    support: { tickets,statusHistory:ticketHistory.map(r=>r.event), messages: supportMessages.map(({ fromUserId, ...message }) => ({ ...message, writtenByYou: fromUserId === personId })) },
    learning: { quizAttempts: attempts, exams, chapterProgress: chapters.map(r => r.progress), objectiveProgress: objectives.map(r => r.progress) },
    organizationHistory, observedPresence: presence,
    evidenceHistory:{decisions,sharing,certificateArchives:certificateDocuments,revocations},
    billingDocuments:{invoiceArchives:invoices},accountClosure:closures[0]??null,
  };
}
