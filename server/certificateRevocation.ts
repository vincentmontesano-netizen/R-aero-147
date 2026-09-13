import {logAccess} from "./access";
import {eq} from 'drizzle-orm';
import {TRPCError} from '@trpc/server';
import {z} from 'zod';
import {getDb,getCertificateByCode} from './db';
import {certificates,certificateRevocations,users} from '../drizzle/schema';
export const certificateRevocationInput=z.object({certificateNumber:z.string().trim().min(1).max(64),reason:z.string().trim().min(10).max(2000)});
async function requireAdmin(actorId:number){const db=(await getDb())!;const [actor]=await db.select().from(users).where(eq(users.id,actorId));if(actor?.role!=='admin'||actor.status!=='active')throw new TRPCError({code:'FORBIDDEN'});}
export async function adminCertificate(actorId:number,number:string){
 await requireAdmin(actorId);const db=(await getDb())!;
 const [cert]=await db.select().from(certificates).where(eq(certificates.certificateNumber,number));if(!cert)return null;
 const [event]=await db.select({reason:certificateRevocations.reason,createdAt:certificateRevocations.createdAt,actorName:users.name}).from(certificateRevocations).innerJoin(users,eq(users.id,certificateRevocations.actorId)).where(eq(certificateRevocations.certificateId,cert.id));
 const verification=await getCertificateByCode(cert.verificationCode);
 await logAccess({actorId,actorRole:"admin",subjectPersonId:cert.userId,action:"READ_ADMIN_CERTIFICATE",dataAccessed:{fields:["holder","title","certificateNumber","status","revocation"]}});
 return {certificateNumber:cert.certificateNumber,verificationCode:cert.verificationCode,status:verification!.status,holder:verification!.user?.name??null,title:verification!.training?.title??null,revocation:event??null};
}
export async function revokeCertificate(actorId:number,input:z.input<typeof certificateRevocationInput>){
 const data=certificateRevocationInput.parse(input),db=(await getDb())!;
 return db.transaction(async tx=>{
  const [actor]=await tx.select().from(users).where(eq(users.id,actorId)).for('share');
  if(actor?.role!=='admin'||actor.status!=='active')throw new TRPCError({code:'FORBIDDEN'});
  const [cert]=await tx.select().from(certificates).where(eq(certificates.certificateNumber,data.certificateNumber)).for('update');
  if(!cert)throw new TRPCError({code:'NOT_FOUND'});
  if(cert.isValid!==true)return {revoked:true,alreadyRevoked:true};
  await tx.insert(certificateRevocations).values({certificateId:cert.id,actorId,reason:data.reason});
  await tx.update(certificates).set({isValid:false}).where(eq(certificates.id,cert.id));
  return {revoked:true,alreadyRevoked:false};
 });
}
