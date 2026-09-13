import { and, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getDb } from './db';
import { users, companies, affiliations, broadcastRuns, broadcastRecipients, broadcastRecipientOutcomes, broadcastPayloads, broadcastRetries } from '../drizzle/schema';
import { isEmailConfigured } from './email';
import { sendAdminBroadcast } from './adminBroadcast';
export const broadcastRetryInput = z.object({recipientId:z.number().int().positive(), expectedEmail:z.string().email(), requestId:z.string().uuid()});

export async function previewBroadcastRetry(actorId:number, recipientId:number) {
  const db = await getDb();if(!db) throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  const [actor] = await db.select().from(users).where(eq(users.id,actorId));
  if(actor?.role!=='admin'||actor.status!=='active') throw new TRPCError({code:'FORBIDDEN'});
  const [source] = await db.select({recipient:broadcastRecipients,run:broadcastRuns,outcome:broadcastRecipientOutcomes,payload:broadcastPayloads})
    .from(broadcastRecipients).innerJoin(broadcastRuns,eq(broadcastRuns.id,broadcastRecipients.runId))
    .leftJoin(broadcastRecipientOutcomes,eq(broadcastRecipientOutcomes.recipientId,broadcastRecipients.id))
    .leftJoin(broadcastPayloads,eq(broadcastPayloads.runId,broadcastRuns.id)).where(eq(broadcastRecipients.id,recipientId));
  if(!source) throw new TRPCError({code:'NOT_FOUND'});
  if(!source.run.emailRequested || !source.outcome || !['skipped_configuration','skipped_missing_email','skipped_access'].includes(source.outcome.status)) throw new TRPCError({code:'PRECONDITION_FAILED',message:'Seuls les e-mails explicitement non envoyés peuvent être repris.'});
  if(!source.payload) throw new TRPCError({code:'PRECONDITION_FAILED',message:'Le contenu de cette ancienne diffusion n’a pas été conservé pour une reprise.'});
  const [existing] = await db.select().from(broadcastRetries).where(eq(broadcastRetries.sourceRecipientId,recipientId));
  const [parent] = await db.select().from(broadcastRetries).where(eq(broadcastRetries.runId,source.run.id));
  const scopeOrgId = source.run.audience?.startsWith('company:') ? Number(source.run.audience.slice(8)) : parent?.scopeOrgId ?? null;
  const [target] = await db.select({id:users.id,name:users.name,email:users.email,status:users.status}).from(users).where(eq(users.id,source.recipient.userId));
  let access = target?.status==='active';
  if(scopeOrgId!=null) {
    const [membership] = await db.select({id:affiliations.id}).from(affiliations).innerJoin(companies,eq(companies.id,affiliations.orgId))
      .where(and(eq(affiliations.personId,source.recipient.userId),eq(affiliations.orgId,scopeOrgId),eq(affiliations.status,'ACTIVE'),eq(companies.status,'ACTIVE'))).limit(1);
    access &&= !!membership;
  }
  const reason = existing ? 'already' : !access ? 'access' : !target?.email ? 'address' : !isEmailConfigured() ? 'configuration' : null;
  return {title:source.run.title,body:source.payload.body,link:source.payload.link,userId:source.recipient.userId,name:target?.name ?? null,email:target?.email ?? null,scopeOrgId,existingRunId:existing?.runId ?? null,reason};
}
export async function retryBroadcastRecipient(actorId:number,input:z.infer<typeof broadcastRetryInput>) {
  const preview = await previewBroadcastRetry(actorId,input.recipientId);
  if(preview.reason && preview.reason!=='already') throw new TRPCError({code:'PRECONDITION_FAILED',message:'La reprise n’est pas disponible. Vérifiez le destinataire, ses droits et la configuration SMTP.'});
  if(!preview.existingRunId && preview.email!==input.expectedEmail) throw new TRPCError({code:'CONFLICT',message:'L’adresse a changé depuis la prévisualisation. Vérifiez à nouveau.'});
  return sendAdminBroadcast(actorId,{userId:preview.userId,title:preview.title,body:preview.body,link:preview.link ?? undefined,email:true,inApp:false,requestId:input.requestId},
    {sourceRecipientId:input.recipientId,expectedEmail:input.expectedEmail,scopeOrgId:preview.scopeOrgId});
}
