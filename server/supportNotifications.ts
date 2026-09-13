import {and,eq,desc,lt} from 'drizzle-orm';
import {z} from 'zod';
import {getDb,type DatabaseTransaction} from './db';
import {TRPCError} from '@trpc/server';
import {supportNotificationOutbox,supportTickets,users} from '../drizzle/schema';
import {adminNotifyEmail,isEmailConfigured,sendEmail} from './email';
/** A claim is committed before SMTP. Ambiguous or interrupted sends are never auto-retried. */
export async function dispatchSupportNotification(key:string|number, review?:{actorId:number;expectedRecipient:string}){
 const db=await getDb();if(!db)return;
 const claimed=await db.transaction(async tx=>{
  if(review)await requireNotificationAdmin(tx,review.actorId);
  const [item]=await tx.select().from(supportNotificationOutbox).where(typeof key==='number'?eq(supportNotificationOutbox.id,key):eq(supportNotificationOutbox.key,key)).for('update');
  if(!item){if(review)throw new TRPCError({code:'NOT_FOUND'});return null;}
  if(item.state!=='pending'){
   if(review&&item.state!=='accepted')throw new TRPCError({code:'PRECONDITION_FAILED',message:'Une tentative existe déjà. Vérifiez son résultat auprès du fournisseur.'});
   return null;
  }
  if(!isEmailConfigured()){if(review)throw new TRPCError({code:'PRECONDITION_FAILED',message:'Configuration SMTP indisponible.'});return null;}
  let recipient:string|null=null;
  if(item.audience==='admin')recipient=adminNotifyEmail();
  else{
   const [ticket]=await tx.select().from(supportTickets).where(eq(supportTickets.id,item.ticketId)).for('share');
   const [owner]=ticket?await tx.select().from(users).where(eq(users.id,ticket.userId)).for('share'):[];
   if(owner?.status==='active')recipient=owner.email;
  }
  if(!z.string().email().max(320).safeParse(recipient).success){if(review)throw new TRPCError({code:'PRECONDITION_FAILED',message:'Destinataire indisponible.'});return null;}
  if(review&&recipient!==review.expectedRecipient)throw new TRPCError({code:'CONFLICT',message:'Le destinataire a changé. Actualisez la file avant de confirmer.'});
  const [result]=await tx.update(supportNotificationOutbox).set({state:'sending',recipient,claimedAt:new Date(),claimedBy:review?.actorId??null}).where(eq(supportNotificationOutbox.id,item.id)).returning();
  return result;
 });
 if(!claimed)return;
 let accepted=false;
 try{
  const subject=`${claimed.messageId?'Nouvelle réponse':'Nouvelle demande'} de support #${claimed.ticketId} — R-AERO`;
  const text=`Une ${claimed.messageId?'réponse':'demande'} de support a été enregistrée pour le ticket #${claimed.ticketId}. Connectez-vous à votre espace R-AERO pour la consulter.`;
  accepted=(await sendEmail({to:claimed.recipient!,subject,text,html:`<p>${text}</p>`})).sent;
 }catch{/* Transport uncertainty remains explicitly recorded. */}
 await db.update(supportNotificationOutbox).set({state:accepted?'accepted':'unconfirmed',finishedAt:new Date()}).where(and(eq(supportNotificationOutbox.id,claimed.id),eq(supportNotificationOutbox.state,'sending')));
}
export async function notifySupport(key:string){
 try{await dispatchSupportNotification(key);}catch{console.warn('[support] notification_outcome_unconfirmed');}
}

async function requireNotificationAdmin(tx:DatabaseTransaction,actorId:number){
 const [actor]=await tx.select({role:users.role,status:users.status}).from(users).where(eq(users.id,actorId)).for('share');
 if(actor?.role!=='admin'||actor.status!=='active')throw new TRPCError({code:'FORBIDDEN'});
}
export const supportNotificationListInput=z.object({beforeId:z.number().int().positive().max(2147483647).optional(),ticketId:z.number().int().positive().max(2147483647).optional(),state:z.enum(['pending','sending','accepted','unconfirmed']).optional()}).strict();
export async function listSupportNotifications(actorId:number,raw:unknown={}){
 const parsed=supportNotificationListInput.safeParse(raw);if(!parsed.success)throw new TRPCError({code:'BAD_REQUEST'});
 const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
 const {beforeId,ticketId,state}=parsed.data;
 return db.transaction(async tx=>{
  await requireNotificationAdmin(tx,actorId);
  const rows=await tx.select({item:supportNotificationOutbox,ownerEmail:users.email,ownerStatus:users.status}).from(supportNotificationOutbox)
   .leftJoin(supportTickets,eq(supportTickets.id,supportNotificationOutbox.ticketId)).leftJoin(users,eq(users.id,supportTickets.userId))
   .where(and(beforeId?lt(supportNotificationOutbox.id,beforeId):undefined,ticketId?eq(supportNotificationOutbox.ticketId,ticketId):undefined,state?eq(supportNotificationOutbox.state,state):undefined))
   .orderBy(desc(supportNotificationOutbox.id)).limit(51);
  const configured=isEmailConfigured(),adminEmail=adminNotifyEmail();
  const entries=rows.slice(0,50).map(({item,ownerEmail,ownerStatus})=>{
   const candidate=item.audience==='admin'?adminEmail:ownerStatus==='active'?ownerEmail:null;
   const currentRecipient=z.string().email().max(320).safeParse(candidate).success?candidate:null;
   return {...item,currentRecipient,canSend:item.state==='pending'&&configured&&currentRecipient!==null};
  });
  return {entries,nextCursor:rows.length>50?entries[49].id:null,smtpConfigured:configured};
 });
}
export const supportNotificationSendInput=z.object({id:z.number().int().positive().max(2147483647),expectedRecipient:z.string().email().max(320)}).strict();
export async function sendPendingSupportNotification(actorId:number,raw:z.infer<typeof supportNotificationSendInput>){
 const parsed=supportNotificationSendInput.safeParse(raw);if(!parsed.success)throw new TRPCError({code:'BAD_REQUEST'});
 await dispatchSupportNotification(parsed.data.id,{actorId,expectedRecipient:parsed.data.expectedRecipient});
 const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
 const [item]=await db.select({state:supportNotificationOutbox.state}).from(supportNotificationOutbox).where(eq(supportNotificationOutbox.id,parsed.data.id));
 return item;
}
