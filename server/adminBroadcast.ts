import { createHash } from 'node:crypto';
import { and, eq, desc, lt, sql, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getDb } from './db';
import { users, affiliations, companies, notifications, broadcastRuns, broadcastOutcomes, broadcastRecipients, broadcastRecipientOutcomes, broadcastPayloads, broadcastRetries } from '../drizzle/schema';
import { isEmailConfigured, sendEmail, simpleEmail } from './email';

export const broadcastInput = z.object({
  requestId: z.string().uuid().transform(value => value.toLowerCase()).optional(),
  audience: z.string().regex(/^(all|company:[1-9][0-9]*)$/).optional(),
  userId: z.number().int().positive().optional(),
  title: z.string().trim().min(1).max(255), body: z.string().max(10000).optional(),
  link: z.string().max(512).refine(value => /^\/(?!\/)/.test(value) || /^https:\/\//.test(value)).optional(),
  email: z.boolean().optional(), inApp: z.boolean().default(true),
}).refine(value => Number(value.userId != null) + Number(value.audience != null) === 1, 'Choisissez un destinataire ou une audience.')
  .refine(value => value.inApp || value.email, 'Choisissez au moins un canal.');
const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Rebuild only a complete journal; missing recipient outcomes never authorize a resend.
async function completeBroadcastOutcome(runId:number) {
  const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  return db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`broadcast-outcome:${runId}`}))`);
    const [prior]=await tx.select().from(broadcastOutcomes).where(eq(broadcastOutcomes.runId,runId));
    if(prior)return prior;
    const [run]=await tx.select().from(broadcastRuns).where(eq(broadcastRuns.id,runId));
    if(!run)throw new TRPCError({code:'NOT_FOUND'});
    const counts=await tx.select({status:broadcastRecipientOutcomes.status,count:sql<number>`count(*)::int`}).from(broadcastRecipients)
      .innerJoin(broadcastRecipientOutcomes,eq(broadcastRecipientOutcomes.recipientId,broadcastRecipients.id))
      .where(eq(broadcastRecipients.runId,runId)).groupBy(broadcastRecipientOutcomes.status);
    if(counts.reduce((sum,row)=>sum+row.count,0)!==run.recipients)return null;
    const count=(status:string)=>counts.find(row=>row.status===status)?.count??0;
    const [outcome]=await tx.insert(broadcastOutcomes).values({runId,accepted:count('accepted'),failed:count('unconfirmed'),skipped:count('skipped_configuration')+count('skipped_missing_email')+count('skipped_access')}).returning();
    return outcome;
  });
}

export async function recoverBroadcastOutcome(actorId:number,runId:number){
  const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  const [actor]=await db.select().from(users).where(eq(users.id,actorId));
  if(actor?.role!=='admin'||actor.status!=='active')throw new TRPCError({code:'FORBIDDEN'});
  const outcome=await completeBroadcastOutcome(runId);
  if(!outcome)throw new TRPCError({code:'PRECONDITION_FAILED',message:'Le journal contient encore des résultats absents. Aucun bilan n’a été créé et aucun message n’a été renvoyé.'});
  return outcome;
}

export async function sendAdminBroadcast(actorId: number, raw: z.input<typeof broadcastInput>, retry?: {sourceRecipientId:number; expectedEmail:string; scopeOrgId:number | null}) {
  const {requestId, ...input} = broadcastInput.parse(raw);
  const fingerprint = createHash('sha256').update(JSON.stringify(retry ? {input, retry} : input)).digest('hex');
  const db = await getDb();
  if (!db) throw new TRPCError({code: 'INTERNAL_SERVER_ERROR'});
  const [actor] = await db.select().from(users).where(eq(users.id, actorId));
  if (actor?.role !== 'admin' || actor.status !== 'active') throw new TRPCError({code: 'FORBIDDEN'});
  const dispatch = await db.transaction(async tx => {
    if (retry) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`broadcast-retry:${retry.sourceRecipientId}`}))`);
      const [linked] = await tx.select({run:broadcastRuns}).from(broadcastRetries).innerJoin(broadcastRuns,eq(broadcastRuns.id,broadcastRetries.runId)).where(eq(broadcastRetries.sourceRecipientId,retry.sourceRecipientId));
      if (linked) return {run:linked.run,targets:null};
    }
    if (requestId) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`broadcast:${actorId}:${requestId}`}))`);
      const [prior] = await tx.select().from(broadcastRuns).where(and(eq(broadcastRuns.actorId, actorId), eq(broadcastRuns.requestId, requestId)));
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new TRPCError({code:'CONFLICT',message:'Cette demande correspond à une autre diffusion.'});
        return {run: prior, targets: null};
      }
    }
    const fields = {id: users.id, email: users.email};
    let targets: Array<{id: number; email: string | null}>;
    if (input.userId) {
      targets = await tx.select(fields).from(users).where(and(eq(users.id, input.userId), eq(users.status, 'active')));
      if (!targets.length) throw new TRPCError({code: 'NOT_FOUND', message: 'Destinataire actif introuvable.'});
    } else if (input.audience === 'all') {
      targets = await tx.select(fields).from(users).where(eq(users.status, 'active'));
    } else {
      const orgId = Number(input.audience!.slice(8));
      if (!Number.isSafeInteger(orgId) || orgId > 2147483647) throw new TRPCError({code: 'BAD_REQUEST'});
      const [org] = await tx.select().from(companies).where(and(eq(companies.id, orgId), eq(companies.status, 'ACTIVE')));
      if (!org) throw new TRPCError({code: 'NOT_FOUND', message: 'Compagnie active introuvable.'});
      targets = await tx.selectDistinct(fields).from(users).innerJoin(affiliations, eq(affiliations.personId, users.id))
        .where(and(eq(users.status, 'active'), eq(affiliations.orgId, orgId), eq(affiliations.status, 'ACTIVE')));
    }
    if (retry && (targets.length !== 1 || targets[0].email !== retry.expectedEmail)) throw new TRPCError({code:'CONFLICT',message:'Le destinataire a changé. Vérifiez à nouveau la reprise.'});
    const [record] = await tx.insert(broadcastRuns).values({actorId, requestId, fingerprint: requestId ? fingerprint : null, title: input.title, audience: input.audience, userId: input.userId,
      recipients: targets.length, sent: input.inApp ? targets.length : 0, emailRequested: !!input.email}).returning();
    await tx.insert(broadcastPayloads).values({runId:record.id,body:input.body ?? input.title,link:input.link});
    if (retry) await tx.insert(broadcastRetries).values({sourceRecipientId:retry.sourceRecipientId,runId:record.id,scopeOrgId:retry.scopeOrgId});
    if (input.inApp) for (let offset = 0; offset < targets.length; offset += 500) await tx.insert(notifications).values(targets.slice(offset, offset + 500).map(user => ({userId: user.id, type: 'broadcast', title: input.title, body: input.body ?? '', link: input.link})));
    for (let offset = 0; offset < targets.length; offset += 500) await tx.insert(broadcastRecipients).values(targets.slice(offset, offset + 500).map(user => ({runId: record.id, userId: user.id})));
    return {run: record, targets};
  });
  const {run, targets} = dispatch;
  if (targets === null) {
    const outcome = await completeBroadcastOutcome(run.id);
    if (!outcome) throw new TRPCError({code:'CONFLICT',message:'Diffusion déjà enregistrée, bilan en cours ou incomplet. Consultez le journal ; aucun nouvel envoi n’a été déclenché.'});
    return {sent: run.sent, recipients: run.recipients, email:{requested:run.emailRequested,accepted:outcome.accepted,failed:outcome.failed,skipped:outcome.skipped}};
  }
  const email = {requested: !!input.email, accepted: 0, failed: 0, skipped: 0};
  const recipients = await db.select().from(broadcastRecipients).where(eq(broadcastRecipients.runId, run.id));
  const recipientIds = new Map(recipients.map(recipient => [recipient.userId, recipient.id]));
  const html = simpleEmail(escape(input.title), `<p>${escape(input.body ?? input.title).replace(/\n/g, '<br>')}</p>${input.link ? `<p><a href="${escape(input.link)}">${escape(input.link)}</a></p>` : ''}`).html;
  const stillAllowed = async (target: {id: number; email: string | null}) => {
    const accounts = await db.select({id:users.id,role:users.role,status:users.status,email:users.email}).from(users).where(inArray(users.id,[actorId,target.id]));
    const currentActor = accounts.find(account=>account.id===actorId);
    const currentTarget = accounts.find(account=>account.id===target.id);
    if (currentActor?.role !== 'admin' || currentActor.status !== 'active' || currentTarget?.status !== 'active' || currentTarget.email !== target.email) return false;
    const scopeOrgId = retry?.scopeOrgId ?? (input.audience?.startsWith('company:') ? Number(input.audience.slice(8)) : null);
    if (scopeOrgId != null) {
      const [membership] = await db.select({id:affiliations.id}).from(affiliations).innerJoin(companies,eq(companies.id,affiliations.orgId))
        .where(and(eq(affiliations.orgId,scopeOrgId),eq(affiliations.personId,target.id),eq(affiliations.status,'ACTIVE'),eq(companies.status,'ACTIVE'))).limit(1);
      if (!membership) return false;
    }
    return true;
  };
  for (const user of targets) {
    let status: typeof broadcastRecipientOutcomes.$inferInsert.status;
    if (!input.email) status = 'not_requested';
    else if (!isEmailConfigured()) { status = 'skipped_configuration'; email.skipped++; }
    else if (!user.email) { status = 'skipped_missing_email'; email.skipped++; }
    else if (!await stillAllowed(user)) { status = 'skipped_access'; email.skipped++; }
    else {
      let accepted = false;
      try { accepted = (await sendEmail({to: user.email, subject: input.title, html})).sent; }
      catch { /* SMTP exceptions remain unconfirmed, never automatically resent. */ }
      status = accepted ? 'accepted' : 'unconfirmed';
      if (accepted) email.accepted++; else email.failed++;
    }
    // A storage failure must stop dispatch: do not hide it as an SMTP failure.
    await db.insert(broadcastRecipientOutcomes).values({recipientId: recipientIds.get(user.id)!, status});
  }
  await completeBroadcastOutcome(run.id);
  return {sent: run.sent, recipients: targets.length, email};
}

export const broadcastHistoryInput = z.object({beforeId: z.number().int().positive().max(2147483647).optional()});
export async function broadcastHistory(actorId: number, input: z.infer<typeof broadcastHistoryInput>) {
  const db = await getDb();
  if (!db) throw new TRPCError({code: 'INTERNAL_SERVER_ERROR'});
  const [actor] = await db.select().from(users).where(eq(users.id, actorId));
  if (actor?.role !== 'admin' || actor.status !== 'active') throw new TRPCError({code: 'FORBIDDEN'});
  const rows = await db.select({run: broadcastRuns, outcome: broadcastOutcomes}).from(broadcastRuns)
    .leftJoin(broadcastOutcomes, eq(broadcastRuns.id, broadcastOutcomes.runId))
    .where(input.beforeId ? lt(broadcastRuns.id, input.beforeId) : undefined).orderBy(desc(broadcastRuns.id)).limit(51);
  const entries = rows.slice(0, 50);
  return {entries: entries.map(({run, outcome}) => { const {requestId: _requestId, fingerprint: _fingerprint, ...summary} = run; return {run:summary,outcome}; }), nextCursor: rows.length > 50 ? entries[49].run.id : null};
}

export const broadcastRecipientInput = z.object({runId: z.number().int().positive(), beforeId: z.number().int().positive().max(2147483647).optional()});
export async function broadcastRecipientHistory(actorId: number, input: z.infer<typeof broadcastRecipientInput>) {
  const db = await getDb();
  if (!db) throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
  const [actor] = await db.select().from(users).where(eq(users.id, actorId));
  if (actor?.role !== 'admin' || actor.status !== 'active') throw new TRPCError({code:'FORBIDDEN'});
  const [run] = await db.select({id:broadcastRuns.id}).from(broadcastRuns).where(eq(broadcastRuns.id,input.runId));
  if (!run) throw new TRPCError({code:'NOT_FOUND'});
  const rows = await db.select({recipient:broadcastRecipients,outcome:broadcastRecipientOutcomes}).from(broadcastRecipients)
    .leftJoin(broadcastRecipientOutcomes,eq(broadcastRecipientOutcomes.recipientId,broadcastRecipients.id))
    .where(and(eq(broadcastRecipients.runId,input.runId),input.beforeId ? lt(broadcastRecipients.id,input.beforeId) : undefined))
    .orderBy(desc(broadcastRecipients.id)).limit(51);
  const entries = rows.slice(0,50);
  return {entries,nextCursor:rows.length > 50 ? entries[49].recipient.id : null};
}
