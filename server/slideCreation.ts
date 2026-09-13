import {videoCuesSchema} from "../shared/videoCues";
import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getDb, checkedSlideActivities } from './db';
import { users, slides, slideCreationRequests } from '../drizzle/schema';
import { requireAuthorCourse, validateSlideLinks } from './makerAccess';

export const slideCreationInput = z.object({
  trainingId:z.number().int().positive(),moduleId:z.number().nullable().optional(),objectiveId:z.number().nullable().optional(),sortOrder:z.number().optional(),
  title:z.string().optional(),body:z.string().optional(),imageUrl:z.string().optional(),imagePrompt:z.string().optional(),videoUrl:z.string().optional(),audioUrl:z.string().optional(),
  videoCues:videoCuesSchema.nullable().optional(),quizQuestion:z.string().nullable().optional(),quizOptions:z.array(z.string()).nullable().optional(),quizCorrect:z.array(z.number()).nullable().optional(),quizExplanation:z.string().nullable().optional(),
  requestId:z.string().uuid().transform(value=>value.toLowerCase()).optional(),
});

export async function createAuthorSlide(actorId: number, raw: z.input<typeof slideCreationInput>) {
  const { requestId, ...input } = slideCreationInput.parse(raw);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
  const [actor] = await db.select({ id: users.id, role: users.role, status: users.status }).from(users).where(eq(users.id, actorId));
  if (actor?.status !== 'active') throw new TRPCError({ code: 'FORBIDDEN' });
  await requireAuthorCourse(actor, input.trainingId);
  // Parsing fixes object-key order, before computing the request fingerprint.
  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return db.transaction(async tx => {
    if (requestId) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`slide-create:${actor.id}:${requestId}`}))`);
      const [prior] = await tx.select().from(slideCreationRequests).where(and(eq(slideCreationRequests.actorId, actor.id), eq(slideCreationRequests.requestId, requestId)));
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new TRPCError({ code: 'CONFLICT', message: 'Cette demande correspond à une autre création de diapositive.' });
        const [slide] = await tx.select().from(slides).where(eq(slides.id, prior.slideId));
        if (!slide || slide.trainingId !== input.trainingId) throw new TRPCError({ code: 'CONFLICT', message: 'La diapositive créée ne peut pas être retrouvée.' });
        return { success: true, id: slide.id, replayed: true, archived: !!slide.archivedAt };
      }
    }
    await validateSlideLinks(input.trainingId, input);
    const [slide] = await tx.insert(slides).values(checkedSlideActivities(input) as typeof slides.$inferInsert).returning();
    if (requestId) await tx.insert(slideCreationRequests).values({ actorId: actor.id, requestId, slideId: slide.id, fingerprint });
    return { success: true, id: slide.id, replayed: false, archived: false };
  });
}
