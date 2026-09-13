import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { affiliations, companies, employees, externalTrainings, users } from '../drizzle/schema';
import { getDb } from './db';

export const archiveExternalTrainingInput = z.object({id:z.number().int().positive(),reason:z.string().trim().min(3).max(1000)});
export async function archiveExternalTraining(actorId:number,input:z.infer<typeof archiveExternalTrainingInput>) {
  const {id,reason}=archiveExternalTrainingInput.parse(input);
  const db=(await getDb())!;
  return db.transaction(async tx=>{
    const [actor]=await tx.select().from(users).where(eq(users.id,actorId)).for('share');
    if(actor?.status!=='active') throw new TRPCError({code:'FORBIDDEN'});
    const [record]=await tx.select().from(externalTrainings).where(eq(externalTrainings.id,id)).for('update');
    if(!record) throw new TRPCError({code:'NOT_FOUND'});
    if(actor.role!=='admin') {
      // Both historical organization and current employee must agree: ambiguous
      // or reassigned evidence requires an administrator, never a companyId fallback.
      if(!record.employeeId || !record.companyId) throw new TRPCError({code:'FORBIDDEN'});
      const [company]=await tx.select().from(companies).where(eq(companies.id,record.companyId)).for('share');
      const [employee]=await tx.select().from(employees).where(eq(employees.id,record.employeeId)).for('share');
      const [membership]=await tx.select().from(affiliations).where(and(eq(affiliations.personId,actor.id),eq(affiliations.orgId,record.companyId),eq(affiliations.role,'MANAGER'),eq(affiliations.status,'ACTIVE'))).for('share');
      if(company?.status!=='ACTIVE' || employee?.companyId!==record.companyId || !membership) throw new TRPCError({code:'FORBIDDEN'});
    }
    if(record.archivedAt) return {success:true,alreadyArchived:true};
    await tx.update(externalTrainings).set({archivedAt:new Date(),archivedBy:actor.id,archiveReason:reason}).where(eq(externalTrainings.id,id));
    return {success:true,alreadyArchived:false};
  });
}
