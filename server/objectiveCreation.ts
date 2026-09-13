import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getDb } from './db';
import { users, learningObjectives, objectiveCreationRequests } from '../drizzle/schema';
import { requireAuthorCourse, validateSlideLinks } from './makerAccess';

export const objectiveCreationInput = z.object({
  trainingId: z.number().int().positive(), title: z.string().min(1),
  moduleId: z.number().nullable().optional(), code: z.string().optional(),
  description: z.string().optional(), knowledgeLevel: z.enum(['1','2','3']).optional(),
  isRequired: z.boolean().optional(), sortOrder: z.number().optional(),
  requestId: z.string().uuid().transform(value=>value.toLowerCase()).optional(),
});

export async function createAuthorObjective(actorId: number, raw: z.input<typeof objectiveCreationInput>) {
  const { requestId, ...input } = objectiveCreationInput.parse(raw);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
  const [actor] = await db.select({ id: users.id, role: users.role, status: users.status }).from(users).where(eq(users.id, actorId));
  if (actor?.status !== 'active') throw new TRPCError({ code: 'FORBIDDEN' });
  await requireAuthorCourse(actor, input.trainingId);
  // Parsing fixes object-key order, before computing the request fingerprint.
  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return db.transaction(async tx => {
    if (requestId) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`objective-create:${actor.id}:${requestId}`}))`);
      const [prior] = await tx.select().from(objectiveCreationRequests).where(and(eq(objectiveCreationRequests.actorId, actor.id), eq(objectiveCreationRequests.requestId, requestId)));
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new TRPCError({ code: 'CONFLICT', message: "Cette demande correspond à une autre création d’objectif." });
        const [objective] = await tx.select().from(learningObjectives).where(eq(learningObjectives.id, prior.objectiveId));
        if (!objective || objective.trainingId !== input.trainingId) throw new TRPCError({ code: 'CONFLICT', message: "L’objectif créé ne peut pas être retrouvé." });
        return { success: true, objectiveId: objective.id, replayed: true, archived: !!objective.archivedAt };
      }
    }
    await validateSlideLinks(input.trainingId, input);
    const [objective] = await tx.insert(learningObjectives).values(input).returning();
    if (requestId) await tx.insert(objectiveCreationRequests).values({ actorId: actor.id, requestId, objectiveId: objective.id, fingerprint });
    return { success: true, objectiveId: objective.id, replayed: false, archived: false };
  });
}
