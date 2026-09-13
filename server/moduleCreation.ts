import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getDb } from './db';
import { users, trainingModules, moduleCreationRequests } from '../drizzle/schema';
import { requireAuthorCourse, validateSlideLinks } from './makerAccess';

export const moduleCreationInput = z.object({
  trainingId: z.number().int().positive(), title: z.string().min(1),
  description: z.string().optional(), content: z.string().optional(), videoUrl: z.string().optional(), pdfUrl: z.string().optional(),
  durationMinutes: z.number().optional(), sortOrder: z.number().optional(), isRequired: z.boolean().optional(),
  quizPassingScore: z.number().int().min(1).max(100).optional(), quizMaxAttempts: z.number().int().min(1).max(20).optional(),
  quizTimeLimitMin: z.number().int().min(1).max(240).nullable().optional(), objectiveId: z.number().nullable().optional(),
  requestId: z.string().uuid().transform(value=>value.toLowerCase()).optional(),
});

export async function createAuthorModule(actorId: number, raw: z.input<typeof moduleCreationInput>) {
  const { requestId, ...input } = moduleCreationInput.parse(raw);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
  const [actor] = await db.select({ id: users.id, role: users.role, status: users.status }).from(users).where(eq(users.id, actorId));
  if (actor?.status !== 'active') throw new TRPCError({ code: 'FORBIDDEN' });
  await requireAuthorCourse(actor, input.trainingId);
  // Parsing fixes object-key order, before computing the request fingerprint.
  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return db.transaction(async tx => {
    if (requestId) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`module-create:${actor.id}:${requestId}`}))`);
      const [prior] = await tx.select().from(moduleCreationRequests).where(and(eq(moduleCreationRequests.actorId, actor.id), eq(moduleCreationRequests.requestId, requestId)));
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new TRPCError({ code: 'CONFLICT', message: 'Cette demande correspond à une autre création de chapitre.' });
        const [module] = await tx.select().from(trainingModules).where(eq(trainingModules.id, prior.moduleId));
        if (!module || module.trainingId !== input.trainingId) throw new TRPCError({ code: 'CONFLICT', message: 'Le chapitre créé ne peut pas être retrouvé.' });
        return { success: true, moduleId: module.id, replayed: true, archived: !!module.archivedAt };
      }
    }
    await validateSlideLinks(input.trainingId, input);
    const [module] = await tx.insert(trainingModules).values(input).returning();
    if (requestId) await tx.insert(moduleCreationRequests).values({ actorId: actor.id, requestId, moduleId: module.id, fingerprint });
    return { success: true, moduleId: module.id, replayed: false, archived: false };
  });
}
