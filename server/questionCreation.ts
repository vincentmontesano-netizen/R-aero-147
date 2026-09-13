import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getDb } from './db';
import { users, quizQuestions, questionCreationRequests } from '../drizzle/schema';
import { requireAuthorCourse, validateSlideLinks } from './makerAccess';

export const questionCreationInput = z.object({
  trainingId: z.number().int().positive(), moduleId: z.number().nullable().optional(), objectiveId: z.number().nullable().optional(),
  question: z.string().min(1), type: z.enum(['qcm', 'qcu', 'true_false', 'free_text', 'matching']),
  options: z.array(z.string()).optional(), correctAnswer: z.array(z.number()).optional(), optionsRight: z.array(z.string()).optional(),
  answerKey: z.object({ keywords: z.array(z.string()).optional(), regex: z.string().optional(), pairs: z.array(z.array(z.number())).optional() }).optional(),
  explanation: z.string().optional(), points: z.number().optional(), sortOrder: z.number().optional(),
  requestId: z.string().uuid().transform(value => value.toLowerCase()).optional(),
});

export async function createAuthorQuestion(actorId: number, raw: z.input<typeof questionCreationInput>) {
  const { requestId, ...input } = questionCreationInput.parse(raw);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
  const [actor] = await db.select({ id: users.id, role: users.role, status: users.status }).from(users).where(eq(users.id, actorId));
  if (actor?.status !== 'active') throw new TRPCError({ code: 'FORBIDDEN' });
  await requireAuthorCourse(actor, input.trainingId);
  // Parsing fixes object-key order, including answerKey; arrays retain their semantic order.
  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return db.transaction(async tx => {
    if (requestId) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`question-create:${actor.id}:${requestId}`}))`);
      const [prior] = await tx.select().from(questionCreationRequests).where(and(eq(questionCreationRequests.actorId, actor.id), eq(questionCreationRequests.requestId, requestId)));
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new TRPCError({ code: 'CONFLICT', message: 'Cette demande correspond à une autre création de question.' });
        const [question] = await tx.select().from(quizQuestions).where(eq(quizQuestions.id, prior.questionId));
        if (!question || question.trainingId !== input.trainingId) throw new TRPCError({ code: 'CONFLICT', message: 'La question créée ne peut pas être retrouvée.' });
        return { success: true, questionId: question.id, replayed: true, archived: !!question.archivedAt };
      }
    }
    await validateSlideLinks(input.trainingId, input);
    const [question] = await tx.insert(quizQuestions).values(input).returning();
    if (requestId) await tx.insert(questionCreationRequests).values({ actorId: actor.id, requestId, questionId: question.id, fingerprint });
    return { success: true, questionId: question.id, replayed: false, archived: false };
  });
}
